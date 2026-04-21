// Game state
let currentRoomId = null;
let userId = null;
let socket = null; // Socket.io connection
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

// Initialize Socket.io connection
socket = io();

// Socket.io event handlers
socket.on('draw-line', (line) => {
  console.log('Received draw-line:', line, 'Current phase:', gamePhase, 'My role:', myRole);
  // Draw line from the current drawer (guessers watch on viewer canvas)
  if (myRole === 'guesser' && (gamePhase === 'drawing' || gamePhase === 'guessing')) {
    drawOnCanvas(line, viewerCtx);
  }
});

socket.on('clear-canvas', () => {
  // Clear canvas when drawer clears it
  if (gamePhase === 'guessing') {
    viewerCtx.fillStyle = 'white';
    viewerCtx.fillRect(0, 0, viewerCanvas.width, viewerCanvas.height);
  }
});

socket.on('player-guess', (data) => {
  // Show other players' guesses in real-time
  const { userId: guesserId, guess, isCorrect } = data;
  if (guesserId !== userId) { // Don't show your own guesses
    addGuessToList(guesserId, guess, isCorrect);
    if (isCorrect) {
      showNotification('🎉 Someone guessed correctly!');
    }
  }
});

socket.on('new-round', (roundData) => {
  console.log('New round:', roundData);
  handleNewRound(roundData);
});

socket.on('guessing-phase', (data) => {
  console.log('Guessing phase started');
  handleGuessingPhase();
});

socket.on('round-over', (results) => {
  console.log('Round over:', results);
  handleRoundOver(results);
});

socket.on('game-over', (finalResults) => {
  console.log('Game over:', finalResults);
  handleGameOver(finalResults);
});

socket.on('game-state-update', (gameState) => {
  console.log('Game state update:', gameState);
});

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
        socket.emit('join-game', roomId);

        // Switch to game view
        document.getElementById('lobby-section').style.display = 'none';
        document.getElementById('game-section').style.display = 'block';

        // Setup polling for game state updates
        setupGameStatePolling();

        showNotification('Joined game successfully!');
    } catch (error) {
        console.error('Error joining room:', error);
        showNotification('Failed to join game: ' + error.message);
    }
}

// Leave room
async function leaveRoom() {
    if (currentRoomId) {
        try {
            // Leave room via HTTP API
            await fetch('/api/leave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: currentRoomId,
                    userId: userId
                })
            });

            // Leave Socket.io room
            if (socket && currentRoomId) {
                socket.emit('leave-room', currentRoomId);
            }

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

    const startButton = document.getElementById('start-game');
    if (startButton) startButton.style.display = 'none';

    try {
        const response = await fetch(`/api/rooms/${currentRoomId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ starterUserId: userId })
        });

        if (response.ok) {
            showNotification('Game started!');
        } else {
            const error = await response.json();
            showNotification('Failed to start game: ' + (error.error || 'Unknown error'));
            // Show button again if start failed
            if (startButton) startButton.style.display = 'block';
        }
    } catch (error) {
        console.error('Error starting game:', error);
        showNotification('Error starting game');
        // Show button again if start failed
        if (startButton) startButton.style.display = 'block';
    }
}

// Setup game state polling
function setupGameStatePolling() {
    let lastUpdate = Date.now();

    // Poll for game state updates every 2 seconds
    setInterval(async () => {
        if (!currentRoomId) return;

        try {
            // Update players list first
            try {
                const snapshotResponse = await fetch(`/api/rooms/${currentRoomId}`);
                if (snapshotResponse.ok) {
                    const snapshotData = await snapshotResponse.json();

                    players.clear();
                    if (snapshotData.players && Array.isArray(snapshotData.players)) {
                        snapshotData.players.forEach(player => {
                            players.set(player.id, player);
                        });
                        updatePlayersList();

                        // Check if game can start
                        const canStart = players.size >= 2;
                        const startButton = document.getElementById('start-game');
                        if (startButton) {
                            startButton.style.display = canStart ? 'block' : 'none';
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching room info:', error);
            }

            // Then update game state
            try {
                const response = await fetch(`/api/rooms/${currentRoomId}/state?lastUpdate=${lastUpdate}&userId=${userId}`);
                if (response.ok) {
                    const gameState = await response.json();

                    // Update game info
                    document.getElementById('current-game-name').textContent = 'Game: ' + currentRoomId;
                    document.getElementById('round-info').textContent = `Round: ${gameState.currentRound}/${gameState.totalRounds}`;

                    // Update scores if available
                    if (gameState.scores) {
                        updateScoresList(gameState.scores);
                    }
                }
            } catch (error) {
                console.error('Error fetching game state:', error);
            }

        } catch (error) {
            console.error('Error in polling loop:', error);
        }
    }, 2000); // Changed to 2 seconds to reduce server load
}

// Handle new round
function handleNewRound(roundData) {
    gamePhase = 'drawing';
    myRole = roundData.drawer === userId ? 'drawer' : 'guesser';

    console.log(`New round: ${roundData.round}, My role: ${myRole}, Word: ${roundData.word}`);

    // Update UI
    document.getElementById('round-info').textContent = `Round: ${roundData.round}/${roundData.totalRounds}`;
    updateTimer(roundData.endTime);

    if (myRole === 'drawer') {
        currentWord = roundData.word;
        document.getElementById('current-word').textContent = currentWord;
        showGamePhase('drawing-phase');
        document.getElementById('role-display').textContent = '🎨 You are DRAWING!';
        // Clear drawing canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        showGamePhase('guessing-phase');
        document.getElementById('role-display').textContent = '🤔 Try to guess what\'s being drawn!';
        // Clear viewer canvas
        viewerCtx.fillStyle = 'white';
        viewerCtx.fillRect(0, 0, viewerCanvas.width, viewerCanvas.height);
        // Disable guess input until guessing phase starts
        const guessInput = document.getElementById('guess-input');
        const submitButton = document.getElementById('submit-guess');
        if (guessInput) guessInput.disabled = true;
        if (submitButton) submitButton.disabled = true;
    }
}

// Handle guessing phase
function handleGuessingPhase() {
    gamePhase = 'guessing';
    if (myRole === 'guesser') {
        document.getElementById('role-display').textContent = '🎯 Make your guess!';
        // Enable guess input
        const guessInput = document.getElementById('guess-input');
        const submitButton = document.getElementById('submit-guess');
        if (guessInput) guessInput.disabled = false;
        if (submitButton) submitButton.disabled = false;
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

// Helper function to get correct canvas coordinates
function getCanvasCoordinates(e, canvasElement) {
    const rect = canvasElement.getBoundingClientRect();
    const scaleX = canvasElement.width / rect.width;
    const scaleY = canvasElement.height / rect.height;

    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
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
    if (!socket || !currentRoomId || gamePhase !== 'drawing' || myRole !== 'drawer') return;

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
        // Send each drawing command via Socket.io for real-time broadcasting
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

// Submit guess
async function submitGuess() {
    const guessInput = document.getElementById('guess-input');
    const submitButton = document.getElementById('submit-guess');
    const guess = guessInput.value.trim();

    if (!guess || !currentRoomId) return;

    // Disable input while submitting
    guessInput.disabled = true;
    submitButton.disabled = true;

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
            // Keep disabled after correct guess
            addGuessToList(userId, guess, true);

            // Broadcast correct guess to other players via Socket.io
            socket.emit('player-guess', {
                roomId: currentRoomId,
                userId: userId,
                guess: guess,
                isCorrect: true
            });
        } else {
            showNotification('❌ Wrong guess, try again!');
            addGuessToList(userId, guess, false);

            // Re-enable input for wrong guesses
            guessInput.disabled = false;
            submitButton.disabled = false;
            guessInput.focus();

            // Broadcast wrong guess to other players via Socket.io
            socket.emit('player-guess', {
                roomId: currentRoomId,
                userId: userId,
                guess: guess,
                isCorrect: false
            });
        }
    } catch (error) {
        console.error('Error submitting guess:', error);
        showNotification('Error submitting guess');
        // Re-enable on error
        guessInput.disabled = false;
        submitButton.disabled = false;
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
    const coords = getCanvasCoordinates(e, canvas);
    [lastX, lastY] = [coords.x, coords.y];
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || gamePhase !== 'drawing' || myRole !== 'drawer') return;

    const coords = getCanvasCoordinates(e, canvas);

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
function clearCanvas() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Broadcast canvas clear via Socket.io
    if (currentRoomId && socket) {
        socket.emit('clear-canvas', currentRoomId);
    }
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