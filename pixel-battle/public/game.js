// Game state
let currentRoomId = null;
let userId = null;
let client = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let players = new Map();

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
            container.innerHTML = data.rooms.map(room => `
                <div class="room-item" onclick="selectRoom('${room.roomId}')">
                    <div class="room-name">${room.roomOptions?.name || room.roomId}</div>
                    <div class="room-info">ID: ${room.roomId}</div>
                </div>
            `).join('');
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
        // Import RoomService dynamically
        const { RoomServiceClient } = await import('@chempik1234/room-service-js');

        // Initialize client
        client = new RoomServiceClient({
            host: window.location.hostname,
            port: parseInt(window.location.port) || 3001,
            apiKey: '123' // Should match server
        });

        // Connect to room
        await client.connect();
        currentRoomId = roomId;

        // Join the room with user info (allowing rejoin with same user ID)
        await client.joinRoom(roomId, {
            userId: userId,
            name: playerName,
            metadata: {
                color: colorPicker.value,
                brushSize: brushSize.value
            }
        });

        // Switch to game view
        document.getElementById('lobby-section').style.display = 'none';
        document.getElementById('game-section').style.display = 'block';

        // Setup event handlers
        setupGameEvents(client);

        showNotification('Joined room successfully!');
    } catch (error) {
        console.error('Error joining room:', error);
        showNotification('Failed to join room: ' + error.message);
    }
}

// Leave room properly
async function leaveRoom() {
    if (client && currentRoomId) {
        try {
            // Send leave command
            await client.leaveRoom(currentRoomId, userId);
            await client.close();

            // Reset state
            currentRoomId = null;
            players.clear();

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

// Setup game event handlers
function setupGameEvents(client) {
    // Handle room events
    client.on('joinedRoom', (event) => {
        if (event.joinedRoom?.userFull) {
            const user = event.joinedRoom.userFull;
            players.set(user.id, user);
            updatePlayersList();
        }
    });

    client.on('leftRoom', (event) => {
        if (event.leftRoom?.kickedUserId) {
            players.delete(event.leftRoom.kickedUserId);
            updatePlayersList();
        }
    });

    client.on('dataEdited', (event) => {
        if (event.dataEdited?.dataId === 'canvas_draw') {
            // Handle drawing data
            const drawData = JSON.parse(event.dataEdited.dataValue?.stringValue || '{}');
            drawOnCanvas(drawData);
        }
    });

    client.on('fullRoom', (event) => {
        if (event.fullRoom) {
            // Update room info
            document.getElementById('current-room-name').textContent =
                'Room: ' + (event.fullRoom.roomOptions?.name || currentRoomId);
            document.getElementById('player-count').textContent =
                'Players: ' + event.fullRoom.users.length;

            // Update players list
            players.clear();
            event.fullRoom.users.forEach(user => {
                players.set(user.id, user);
            });
            updatePlayersList();
        }
    });

    // Handle errors
    client.on('error', (error) => {
        console.error('RoomService error:', error);
        showNotification('Connection error: ' + error.message);
    });
}

// Update players list
function updatePlayersList() {
    const list = document.getElementById('players-list');
    list.innerHTML = Array.from(players.values()).map(player => `
        <li>
            ${player.name} ${player.id === userId ? '(You)' : ''}
        </li>
    `).join('');
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

async function sendDrawData(fromX, fromY, toX, toY) {
    if (!client || !currentRoomId) return;

    const drawData = {
        color: colorPicker.value,
        size: brushSize.value,
        fromX,
        fromY,
        toX,
        toY
    };

    try {
        await client.sendData(currentRoomId, 'canvas_draw', {
            stringValue: JSON.stringify(drawData)
        });
    } catch (error) {
        console.error('Error sending draw data:', error);
    }
}

// Canvas event listeners
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

canvas.addEventListener('mousemove', (e) => {
    mouseX.textContent = e.offsetX;
    mouseY.textContent = e.offsetY;

    if (!isDrawing) return;

    drawOnCanvas({
        color: colorPicker.value,
        size: brushSize.value,
        fromX: lastX,
        fromY: lastY,
        toX: e.offsetX,
        toY: e.offsetY
    });

    sendDrawData(lastX, lastY, e.offsetX, e.offsetY);
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);

// Clear canvas
async function clearCanvas() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (client && currentRoomId) {
        try {
            await client.sendData(currentRoomId, 'canvas_clear', {
                stringValue: 'clear'
            });
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
    if (client && currentRoomId) {
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
    if (document.hidden && client && currentRoomId) {
        console.log('Page hidden - connection maintained');
    } else if (!document.hidden && client && currentRoomId) {
        console.log('Page visible - connection active');
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