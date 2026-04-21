// Game state
let currentRoomId = null;
let userId = null;
let socket = null; // Socket.io connection
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let players = new Map();
let isRoomOwner = false;
let drawQueue = []; // Batch draw updates
let batchInterval = null;

// Generate or retrieve user ID
function getUserId() {
    let id = localStorage.getItem('pixelBattle_userId');
    if (!id) {
        id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('pixelBattle_userId', id);
    }
    return id;
}

// Initialize user ID
userId = getUserId();

// Initialize Socket.io connection
socket = io();

// Socket.io event handlers
socket.on('connect', () => {
    console.log('Connected to WebSocket server');
});

socket.on('draw-line', (line) => {
    // Draw line from another player
    drawOnCanvas(line);
});

socket.on('clear-canvas', () => {
    // Clear canvas when another player clears it
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
});

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('color-picker');
const brushSize = document.getElementById('brush-size');
const mouseX = document.getElementById('mouse-x');
const mouseY = document.getElementById('mouse-y');

// Initialize canvas
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Show notification
function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), duration);
}

// Room management
async function loadRooms() {
    try {
        const response = await fetch('/api/rooms');
        const data = await response.json();

        const container = document.getElementById('rooms-container');
        if (data.rooms.length === 0) {
            container.innerHTML = '<p>No rooms available. Create one!</p>';
        } else {
            container.innerHTML = data.rooms.map(room => {
                const playerCount = room.currentPlayers || 0;
                const maxPlayers = room.maxPlayers || 10;
                const isFull = playerCount >= maxPlayers;
                const statusClass = isFull ? 'status-full' : 'status-available';

                return `
                <div class="room-item ${statusClass}" onclick="${isFull ? '' : `selectRoom('${room.roomId}')`}">
                    <div class="room-header">
                        <div class="room-name">${room.roomOptions?.name || room.roomId}</div>
                        <div class="room-status ${statusClass}">
                            ${isFull ? 'FULL' : 'OPEN'}
                        </div>
                    </div>
                    <div class="room-details">
                        <div class="room-info">👥 ${playerCount}/${maxPlayers} players</div>
                        <div class="room-info">🎨 Canvas: ${room.hasCanvasData ? 'Active' : 'Empty'}</div>
                        <div class="room-info">🕐 Created: ${new Date(room.createdAt).toLocaleTimeString()}</div>
                    </div>
                    <div class="room-info small">ID: ${room.roomId}</div>
                </div>
            `}).join('');
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
        showNotification('Failed to load rooms');
    }
}

function selectRoom(roomId) {
    document.getElementById('room-id').value = roomId;
}

// Create room
async function createRoom() {
    const roomName = document.getElementById('room-name').value.trim();
    const maxSize = document.getElementById('max-size').value || 10;

    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName, maxSize })
        });

        const data = await response.json();
        if (data.room) {
            document.getElementById('room-id').value = data.room.roomId;
            showNotification('Room created! Join to start playing.');
            // Refresh room list to show the newly created room
            await loadRooms();
        }
    } catch (error) {
        console.error('Error creating room:', error);
        showNotification('Failed to create room');
    }
}

// Join room
async function joinRoom() {
    const roomId = document.getElementById('room-id').value.trim();
    const playerName = document.getElementById('player-name').value.trim() || 'Player';

    if (!roomId) {
        showNotification('Please enter or select a room ID');
        return;
    }

    try {
        // Join room via HTTP API
        const response = await fetch(`/api/rooms/${roomId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerName: playerName,
                userId: userId,
                color: colorPicker.value,
                brushSize: brushSize.value
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to join room');
        }

        const data = await response.json();
        currentRoomId = roomId;

        // Join Socket.io room for real-time updates
        socket.emit('join-room', roomId);

        // Clear canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Load existing drawings from the room (one-time load)
        try {
            const drawingsResponse = await fetch(`/api/rooms/${roomId}/drawings`);
            const drawingsData = await drawingsResponse.json();

            if (drawingsData.lines && Array.isArray(drawingsData.lines)) {
                // Draw existing lines
                drawingsData.lines.forEach(line => {
                    drawOnCanvas(line);
                });
            }
        } catch (error) {
            console.error('Error loading existing drawings:', error);
        }

        // Switch to game view
        document.getElementById('lobby-section').style.display = 'none';
        document.getElementById('game-section').style.display = 'block';

        // Setup game events
        setupGameEvents();

        showNotification('Joined room successfully!');
    } catch (error) {
        console.error('Error joining room:', error);
        showNotification('Failed to join room: ' + error.message);
    }
}

// Leave room properly
async function leaveRoom() {
    if (currentRoomId) {
        try {
            // Send leave command via HTTP API
            await fetch('/api/leave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: currentRoomId,
                    userId: userId
                })
            });

            // Reset state
            currentRoomId = null;
            players.clear();

            // Leave Socket.io room
            if (socket && currentRoomId) {
                socket.emit('leave-room', currentRoomId);
            }

            // Switch back to lobby
            document.getElementById('game-section').style.display = 'none';
            document.getElementById('lobby-section').style.display = 'block';

            // Clear canvas
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            showNotification('Left room successfully');
        } catch (error) {
            console.error('Error leaving room:', error);
            showNotification('Error leaving room');
        }
    }
}

// Setup game event handlers with WebSockets
function setupGameEvents() {
    let lastUpdate = Date.now();

    // Poll for room updates every 1 second (players list, room info)
    setInterval(async () => {
        if (!currentRoomId) return;

        try {
            const response = await fetch(`/api/rooms/${currentRoomId}/updates?lastUpdate=${lastUpdate}`);
            const data = await response.json();

            if (data.hasUpdates) {
                lastUpdate = data.timestamp;

                // Update players list
                players.clear();
                data.players.forEach(player => {
                    players.set(player.id, player);
                });
                updatePlayersList();

                // Update room info
                document.getElementById('current-room-name').textContent = 'Room: ' + currentRoomId;
                document.getElementById('player-count').textContent = 'Players: ' + data.currentPlayers;
            }
        } catch (error) {
            console.error('Error polling for updates:', error);
        }
    }, 1000);
}

// Update players list
function updatePlayersList() {
    const list = document.getElementById('players-list');

    if (players.size === 0) {
        list.innerHTML = '<li>No players yet</li>';
        return;
    }

    list.innerHTML = Array.from(players.values()).map(player => {
        const isYou = player.id === userId;
        const isOwner = player.id === currentRoomId; // Assuming room owner is stored differently

        let playerInfo = `${player.name} ${isYou ? '(You)' : ''}`;

        if (isOwner) {
            playerInfo += ' 👑';
        }

        // Add kick button for room owner
        if (isRoomOwner && !isYou && isOwner) {
            playerInfo += ` <button class="btn-kick" onclick="kickPlayer('${player.id}')">🚫</button>`;
        }

        return `<li>${playerInfo}</li>`;
    }).join('');
}

// Kick player function
async function kickPlayer(targetUserId) {
    if (!isRoomOwner) {
        showNotification('Only room owner can kick players');
        return;
    }

    try {
        const response = await fetch(`/api/rooms/${currentRoomId}/kick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminUserId: userId,
                targetUserId: targetUserId
            })
        });

        if (response.ok) {
            showNotification('Player kicked successfully');
        } else {
            showNotification('Failed to kick player');
        }
    } catch (error) {
        console.error('Error kicking player:', error);
        showNotification('Error kicking player');
    }
}

// Drawing functions
function drawOnCanvas(data) {
    ctx.beginPath();
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(data.fromX, data.fromY);
    ctx.lineTo(data.toX, data.toY);
    ctx.stroke();
}

// Batched drawing updates for better performance
async function sendDrawData(fromX, fromY, toX, toY) {
    if (!currentRoomId) return;

    // Add to batch queue
    drawQueue.push({
        color: colorPicker.value,
        size: brushSize.value,
        fromX,
        fromY,
        toX,
        toY
    });

    // Start batch interval if not running
    if (!batchInterval) {
        batchInterval = setInterval(sendBatchedDrawData, 100); // Send every 100ms
    }
}

// Send batched draw data via WebSocket
async function sendBatchedDrawData() {
    if (drawQueue.length === 0) {
        clearInterval(batchInterval);
        batchInterval = null;
        return;
    }

    // Get current batch and clear queue
    const batch = [...drawQueue];
    drawQueue = [];

    try {
        // Send each drawing command via WebSocket for real-time broadcasting
        batch.forEach(line => {
            socket.emit('draw-line', {
                roomId: currentRoomId,
                line: line
            });
        });
    } catch (error) {
        console.error('Error sending drawing data:', error);
    }
}

// Helper function to get correct canvas coordinates
function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

// Canvas event listeners
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const coords = getCanvasCoordinates(e);
    [lastX, lastY] = [coords.x, coords.y];
});

canvas.addEventListener('mousemove', (e) => {
    const coords = getCanvasCoordinates(e);
    mouseX.textContent = Math.round(coords.x);
    mouseY.textContent = Math.round(coords.y);

    if (!isDrawing) return;

    drawOnCanvas({
        color: colorPicker.value,
        size: brushSize.value,
        fromX: lastX,
        fromY: lastY,
        toX: coords.x,
        toY: coords.y
    });

    sendDrawData(lastX, lastY, coords.x, coords.y);
    [lastX, lastY] = [coords.x, coords.y];
});

canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);

// Clear canvas
async function clearCanvas() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentRoomId && socket) {
        try {
            // Broadcast canvas clear via WebSocket
            socket.emit('clear-canvas', currentRoomId);
        } catch (error) {
            console.error('Error clearing canvas:', error);
        }
    }
}

// Event listeners
document.getElementById('create-room').addEventListener('click', createRoom);
document.getElementById('join-room').addEventListener('click', joinRoom);
document.getElementById('leave-room').addEventListener('click', leaveRoom);
document.getElementById('clear-canvas').addEventListener('click', clearCanvas);
document.getElementById('refresh-rooms').addEventListener('click', loadRooms);

// Handle browser close/tab close - proper cleanup
window.addEventListener('beforeunload', (e) => {
    if (currentRoomId) {
        // Send leave command synchronously
        navigator.sendBeacon('/api/leave', JSON.stringify({
            roomId: currentRoomId,
            userId: userId
        }));

        // Show confirmation dialog
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});

// Handle page visibility changes (tab switching)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentRoomId) {
        console.log('Page hidden - polling continues');
    } else if (!document.hidden && currentRoomId) {
        console.log('Page visible - polling active');
    }
});

// Handle connection errors
window.addEventListener('offline', () => {
    showNotification('Connection lost - trying to reconnect...');
});

window.addEventListener('online', () => {
    showNotification('Connection restored!');
});

// Initial load
loadRooms();
setInterval(loadRooms, 10000); // Refresh rooms every 10 seconds