// Game state
let currentRoomId = null;
let userId = null;
let client = null;
let players = new Map();
let scores = new Map();
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let drawQueue = [];
let batchInterval = null;
let gamePhase = 'waiting'; // waiting, drawing, guessing, results, gameover
let myRole = 'player'; // drawer, guesser, spectator
let currentWord = null;
let roundTimer = null;
let gameStateTimer = null;

// Generate or retrieve user ID
function getUserId() {
    let id = localStorage.getItem('garticPhone_userId');
    if (!id) {
        id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('garticPhone_userId', id);
    }
    return id;
}

// Initialize user ID
userId = getUserId();

// DOM elements
const canvas = document.getElementById('game-canvas');
const viewerCanvas = document.getElementById('viewer-canvas');
const ctx = canvas.getContext('2d');
const viewerCtx = viewerCanvas.getContext('2d');
const colorPicker = document.getElementById('color-picker');
const brushSize = document.getElementById('brush-size');

// Initialize canvases
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, canvas.width, canvas.height);
viewerCtx.fillStyle = 'white';
viewerCtx.fillRect(0, 0, viewerCanvas.width, viewerCanvas.height);

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
            container.innerHTML = '<p>No games available. Create one!</p>';
        } else {
            container.innerHTML = data.rooms.map(room => {
                const playerCount = room.currentPlayers || 0;
                const maxPlayers = room.maxPlayers || 5;
                const isFull = playerCount >= maxPlayers;
                const statusClass = isFull ? 'status-full' : 'status-available';

                return `
                <div class="room-item ${statusClass}" onclick="${isFull ? '' : `selectRoom('${room.roomId}')`}">
                    <div class="room-name">${room.roomOptions?.name || room.roomId}</div>
                    <div class="room-details">
                        <div class="room-info">👥 ${playerCount}/${maxPlayers} players</div>
                        <div class="room-info">🎮 ${room.gameStatus || 'waiting'}</div>
                        <div class="room-info">🔄 Round ${room.currentRound}/${room.totalRounds}</div>
                        ${room.roundTimeLeft > 0 ? `<div class="room-info">⏱️ ${Math.floor(room.roundTimeLeft / 60)}:${(room.roundTimeLeft % 60).toString().padStart(2, '0')}</div>` : ''}
                    </div>
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
    const totalRounds = document.getElementById('total-rounds').value || 5;

    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName, totalRounds })
        });

        const data = await response.json();
        if (data.room) {
            document.getElementById('room-id').value = data.room.roomId;
            showNotification('Game created! Join to start playing.');
        }
    } catch (error) {
        console.error('Error creating room:', error);
        showNotification('Failed to create game');
    }
}

// Join room
async function joinRoom() {
    const roomId = document.getElementById('room-id').value.trim();
    const playerName = document.getElementById('player-name').value.trim() || 'Player';

    if (!roomId) {
        showNotification('Please enter or select a game ID');
        return;
    }

    try {
        // Import RoomService dynamically
        const { RoomServiceClient } = await import('@chempik1234/room-service-js');

        // Initialize client
        client = new RoomServiceClient({
            host: window.location.hostname,
            port: parseInt(window.location.port) || 3002,
            apiKey: '123'
        });

        // Connect to room
        await client.connect();
        currentRoomId = roomId;

        // Join the room
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

        showNotification('Joined game successfully!');
    } catch (error) {
        console.error('Error joining room:', error);
        showNotification('Failed to join game: ' + error.message);
    }
}

// Leave room
async function leaveRoom() {
    if (client && currentRoomId) {
        try {
            await client.leaveRoom(currentRoomId, userId);
            await client.close();

            // Reset state
            currentRoomId = null;
            players.clear();
            scores.clear();
            gamePhase = 'waiting';

            // Switch back to lobby
            document.getElementById('game-section').style.display = 'none';
            document.getElementById('lobby-section').style.display = 'block';

            // Clear canvases
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            viewerCtx.fillStyle = 'white';
            viewerCtx.fillRect(0, 0, viewerCanvas.width, viewerCanvas.height);

            showNotification('Left game successfully');
        } catch (error) {
            console.error('Error leaving room:', error);
            showNotification('Error leaving game');
        }
    }
}

// Start game
async function startGame() {
    if (!currentRoomId) return;

    try {
        const response = await fetch(`/api/rooms/${currentRoomId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ starterUserId: userId })
        });

        if (response.ok) {
            showNotification('Game started!');
        } else {
            showNotification('Failed to start game');
        }
    } catch (error) {
        console.error('Error starting game:', error);
        showNotification('Error starting game');
    }
}

// Setup game event handlers
function setupGameEvents(client) {
    // Handle user joined
    client.on('joinedRoom', (event) => {
        if (event.joinedRoom?.userFull) {
            const user = event.joinedRoom.userFull;
            players.set(user.id, user);
            updatePlayersList();
            checkCanStartGame();
        }
    });

    // Handle user left
    client.on('leftRoom', (event) => {
        if (event.leftRoom?.kickedUserId) {
            players.delete(event.leftRoom.kickedUserId);
            updatePlayersList();
            checkCanStartGame();
        }
    });

    // Handle drawing data (batched)
    client.on('dataEdited', (event) => {
        if (event.dataEdited?.dataId === 'canvas_draw_batch') {
            const batchData = JSON.parse(event.dataEdited.dataValue?.stringValue || '{}');
            if (batchData.lines && Array.isArray(batchData.lines)) {
                batchData.lines.forEach(line => drawOnCanvas(line, viewerCtx));
            }
        }
    });

    // Handle game state changes
    client.on('dataEdited', (event) => {
        if (event.dataEdited?.dataId === 'new_round') {
            const roundData = JSON.parse(event.dataEdited.dataValue?.stringValue || '{}');
            handleNewRound(roundData);
        } else if (event.dataEdited?.dataId === 'guessing_phase') {
            handleGuessingPhase();
        } else if (event.dataEdited?.dataId === 'round_over') {
            const results = JSON.parse(event.dataEdited.dataValue?.stringValue || '{}');
            handleRoundOver(results);
        } else if (event.dataEdited?.dataId === 'game_over') {
            const finalResults = JSON.parse(event.dataEdited.dataValue?.stringValue || '{}');
            handleGameOver(finalResults);
        }
    });

    // Handle room snapshot
    client.on('fullRoom', (event) => {
        if (event.fullRoom) {
            document.getElementById('current-game-name').textContent =
                'Game: ' + (event.fullRoom.roomOptions?.name || currentRoomId);

            // Update players list
            players.clear();
            scores.clear();
            event.fullRoom.users.forEach(user => {
                players.set(user.id, user);
                scores.set(user.id, 0); // Initialize scores
            });
            updatePlayersList();
            checkCanStartGame();
        }
    });

    // Handle errors
    client.on('error', (error) => {
        console.error('RoomService error:', error);
        showNotification('Connection error: ' + error.message);
    });
}

// Handle new round
function handleNewRound(roundData) {
    gamePhase = 'drawing';
    myRole = roundData.drawer === userId ? 'drawer' : 'guesser';

    // Update UI
    document.getElementById('round-info').textContent = `Round: ${roundData.round}/${5}`; // TODO: Get total rounds
    updateTimer(roundData.endTime);

    if (myRole === 'drawer') {
        currentWord = roundData.word;
        document.getElementById('current-word').textContent = currentWord;
        showGamePhase('drawing-phase');
        document.getElementById('role-display').textContent = '🎨 You are DRAWING!';
    } else {
        showGamePhase('guessing-phase');
        document.getElementById('role-display').textContent = '🤔 Try to guess what\'s being drawn!';
        // Clear viewer canvas
        viewerCtx.fillStyle = 'white';
        viewerCtx.fillRect(0, 0, viewerCanvas.width, viewerCanvas.height);
    }
}

// Handle guessing phase
function handleGuessingPhase() {
    gamePhase = 'guessing';
    if (myRole === 'guesser') {
        document.getElementById('role-display').textContent = '🎯 Make your guess!';
    }
}

// Handle round over
function handleRoundOver(results) {
    gamePhase = 'results';
    showGamePhase('results-phase');

    const resultsHTML = `
        <h3>The word was: ${results.word}</h3>
        <h4>Guesses:</h4>
        <ul>
            ${results.guesses.map(([userId, guess]) => `
                <li class="${guess.isCorrect ? 'correct' : 'incorrect'}">
                    ${players.get(userId)?.name || 'Unknown'}: ${guess.guess}
                    ${guess.isCorrect ? '✅' : '❌'}
                </li>
            `).join('')}
        </ul>
        <h4>Current Scores:</h4>
        ${Object.entries(results.scores).map(([uid, score]) => `
            <div>${players.get(uid)?.name || 'Unknown'}: ${score} points</div>
        `).join('')}
    `;

    document.getElementById('round-results').innerHTML = resultsHTML;
    updateScoresList(results.scores);
}

// Handle game over
function handleGameOver(finalResults) {
    gamePhase = 'gameover';
    showGamePhase('gameover-phase');

    const winner = finalResults.winner;
    const winnerName = players.get(winner[0])?.name || 'Unknown';

    const finalHTML = `
        <h3>🏆 Winner: ${winnerName} with ${winner[1]} points! 🏆</h3>
        <h4>Final Scores:</h4>
        ${Object.entries(finalResults.finalScores).sort((a, b) => b[1] - a[1]).map(([uid, score], index) => `
            <div class="score-item">
                ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  '} ${players.get(uid)?.name || 'Unknown'}: ${score} points
            </div>
        `).join('')}
    `;

    document.getElementById('final-results').innerHTML = finalHTML;
}

// Show specific game phase
function showGamePhase(phaseId) {
    const phases = ['drawing-phase', 'guessing-phase', 'results-phase', 'gameover-phase', 'waiting-phase'];
    phases.forEach(phase => {
        document.getElementById(phase).style.display = phase === phaseId ? 'block' : 'none';
    });
}

// Update players list
function updatePlayersList() {
    const list = document.getElementById('players-list');
    if (players.size === 0) {
        list.innerHTML = '<div class="player-item">No players yet</div>';
        return;
    }

    list.innerHTML = Array.from(players.values()).map(player => {
        const isYou = player.id === userId;
        return `<div class="player-item">${player.name} ${isYou ? '(You)' : ''}</div>`;
    }).join('');
}

// Update scores list
function updateScoresList(newScores) {
    if (newScores) {
        Object.entries(newScores).forEach(([uid, score]) => {
            scores.set(uid, score);
        });
    }

    const list = document.getElementById('scores-list');
    if (scores.size === 0) {
        list.innerHTML = '<div class="score-item">No scores yet</div>';
        return;
    }

    list.innerHTML = Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([uid, score]) => `
            <div class="score-item">${players.get(uid)?.name || 'Unknown'}: ${score} pts</div>
        `).join('');
}

// Check if can start game (min 2 players)
function checkCanStartGame() {
    const canStart = players.size >= 2;
    document.getElementById('start-game').style.display = canStart ? 'block' : 'none';
}

// Update timer
function updateTimer(endTime) {
    if (roundTimer) clearInterval(roundTimer);

    roundTimer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        document.getElementById('timer').textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (remaining <= 0) {
            clearInterval(roundTimer);
        }
    }, 1000);
}

// Drawing functions (same as pixel battle with batching)
function drawOnCanvas(data, context = ctx) {
    context.beginPath();
    context.strokeStyle = data.color;
    context.lineWidth = data.size;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.moveTo(data.fromX, data.fromY);
    context.lineTo(data.toX, data.toY);
    context.stroke();
}

async function sendDrawData(fromX, fromY, toX, toY) {
    if (!client || !currentRoomId || gamePhase !== 'drawing' || myRole !== 'drawer') return;

    drawQueue.push({
        color: colorPicker.value,
        size: brushSize.value,
        fromX,
        fromY,
        toX,
        toY
    });

    if (!batchInterval) {
        batchInterval = setInterval(sendBatchedDrawData, 100);
    }
}

async function sendBatchedDrawData() {
    if (drawQueue.length === 0) {
        clearInterval(batchInterval);
        batchInterval = null;
        return;
    }

    const batch = [...drawQueue];
    drawQueue = [];

    try {
        await client.setData(currentRoomId, userId, 'canvas_draw_batch', {
            stringValue: JSON.stringify({
                timestamp: Date.now(),
                lines: batch
            })
        });
    } catch (error) {
        console.error('Error sending batched draw data:', error);
    }
}

// Submit guess
async function submitGuess() {
    const guessInput = document.getElementById('guess-input');
    const guess = guessInput.value.trim();

    if (!guess || !currentRoomId) return;

    try {
        const response = await fetch(`/api/rooms/${currentRoomId}/guess`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, guess })
        });

        const result = await response.json();

        if (result.correct) {
            showNotification(`🎉 Correct! +${result.score} points!`);
            guessInput.value = '';
            guessInput.disabled = true;
        } else {
            showNotification('❌ Wrong guess, try again!');
            addGuessToList(userId, guess, false);
        }
    } catch (error) {
        console.error('Error submitting guess:', error);
        showNotification('Error submitting guess');
    }
}

function addGuessToList(userId, guess, isCorrect) {
    const list = document.getElementById('guesses-list');
    const player = players.get(userId);
    const playerName = player?.name || 'Unknown';

    const guessItem = document.createElement('div');
    guessItem.className = `guess-item ${isCorrect ? 'correct' : 'incorrect'}`;
    guessItem.textContent = `${playerName}: ${guess}`;
    list.appendChild(guessItem);
    list.scrollTop = list.scrollHeight;
}

// Canvas event listeners
canvas.addEventListener('mousedown', (e) => {
    if (gamePhase !== 'drawing' || myRole !== 'drawer') return;
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || gamePhase !== 'drawing' || myRole !== 'drawer') return;

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
function clearCanvas() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Event listeners
document.getElementById('create-room').addEventListener('click', createRoom);
document.getElementById('join-room').addEventListener('click', joinRoom);
document.getElementById('leave-room').addEventListener('click', leaveRoom);
document.getElementById('start-game').addEventListener('click', startGame);
document.getElementById('clear-canvas').addEventListener('click', clearCanvas);
document.getElementById('refresh-rooms').addEventListener('click', loadRooms);
document.getElementById('submit-guess').addEventListener('click', submitGuess);
document.getElementById('guess-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitGuess();
});

// Handle browser close
window.addEventListener('beforeunload', (e) => {
    if (client && currentRoomId) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});

// Initial load
loadRooms();
setInterval(loadRooms, 10000); // Refresh rooms every 10 seconds