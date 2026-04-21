import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { RoomServiceClient } from '@chempik1234/room-service-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server);
const PORT = process.env.PORT || 3002;

// Game word list for drawing
const WORD_LIST = [
  'sun', 'tree', 'house', 'car', 'dog', 'cat', 'bird', 'fish', 'flower',
  'mountain', 'beach', 'computer', 'phone', 'book', 'pencil', 'chair',
  'table', 'clock', 'guitar', 'pizza', 'ice cream', 'rainbow', 'star',
  'moon', 'cloud', 'robot', 'alien', 'dragon', 'castle', 'boat',
  'airplane', 'bicycle', 'butterfly', 'elephant', 'giraffe', 'lion',
  'monkey', 'penguin', 'turtle', 'snake', 'spider', 'bat', 'owl'
];

// Game state management
const games = new Map(); // roomId -> game state

// Initialize RoomService client
const client = new RoomServiceClient({
  host: process.env.ROOM_SERVICE_HOST?.split(':')[0] || 'localhost',
  port: parseInt(process.env.ROOM_SERVICE_HOST?.split(':')[1] || '50050'),
  apiKey: process.env.ROOM_SERVICE_API_KEY || '123'
});

app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Get all Gartic Phone rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await client.listRooms();

    // Filter only Gartic Phone rooms with game info
    const garticRooms = await Promise.all(
      rooms
        .filter(room => room.roomOptions?.game_type === 'gartic_phone')
        .map(async (room) => {
          try {
            const snapshot = await client.getRoomSnapshot(room.roomId);
            const gameState = games.get(room.roomId);

            return {
              ...room,
              currentPlayers: snapshot.users.length,
              maxPlayers: parseInt(room.roomOptions?.max_size || '5'),
              gameStatus: gameState?.status || 'waiting', // waiting, drawing, guessing, finished
              currentRound: gameState?.currentRound || 0,
              totalRounds: parseInt(room.roomOptions?.total_rounds || '5'),
              roundTimeLeft: gameState?.roundEndTime ? Math.max(0, Math.ceil((gameState.roundEndTime - Date.now()) / 1000)) : 0
            };
          } catch (error) {
            return {
              ...room,
              currentPlayers: 0,
              maxPlayers: parseInt(room.roomOptions?.max_size || '5'),
              gameStatus: 'waiting',
              currentRound: 0,
              totalRounds: 5,
              roundTimeLeft: 0
            };
          }
        })
    );

    res.json({ rooms: garticRooms });
  } catch (error) {
    console.error('Error getting rooms:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// Get random word for drawing
app.get('/api/word', (req, res) => {
  const randomIndex = Math.floor(Math.random() * WORD_LIST.length);
  res.json({ word: WORD_LIST[randomIndex] });
});

// Join room endpoint
app.post('/api/rooms/:roomId/join', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { playerName, userId, color, brushSize } = req.body;

    await client.joinRoom(roomId, {
      userId: userId,
      userName: playerName,
      metadata: {
        color: color || '#000000',
        brushSize: brushSize || '5'
      }
    });

    // Get room snapshot to return current state
    const snapshot = await client.getRoomSnapshot(roomId);

    res.json({
      success: true,
      roomId: roomId,
      snapshot: {
        currentPlayers: snapshot.users.length,
        maxPlayers: parseInt(snapshot.roomOptions?.max_size || '5')
      }
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Leave room endpoint
app.post('/api/leave', async (req, res) => {
  try {
    const { roomId, userId } = req.body;

    if (client && roomId && userId) {
      await client.leaveRoom(roomId, userId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

// Get room info for game state
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const snapshot = await client.getRoomSnapshot(roomId);

    // Prepare game-friendly data
    const gameData = {
      roomId: snapshot.roomId,
      roomOptions: snapshot.roomOptions,
      currentPlayers: snapshot.users.length,
      maxPlayers: parseInt(snapshot.roomOptions?.max_size || '5'),
      players: snapshot.users.map(user => ({
        id: user.id,
        name: user.name,
        color: user.metadata?.color || '#000000',
        brushSize: user.metadata?.brushSize || '5'
      }))
    };

    res.json(gameData);
  } catch (error) {
    console.error('Error getting room info:', error);
    res.status(500).json({ error: 'Failed to get room info' });
  }
});

// Get game state for polling
app.get('/api/rooms/:roomId/state', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { lastUpdate, userId } = req.query;

    let gameState = games.get(roomId);

    // Auto-initialize game state if room exists but no game state
    if (!gameState) {
      try {
        const snapshot = await client.getRoomSnapshot(roomId);
        if (snapshot && snapshot.roomOptions?.game_type === 'gartic_phone') {
          // Initialize game state for existing room
          games.set(roomId, {
            status: 'waiting',
            currentRound: 0,
            totalRounds: parseInt(snapshot.roomOptions?.total_rounds || '5'),
            roundTime: parseInt(snapshot.roomOptions?.round_time || '180'),
            players: new Map(),
            scores: new Map(),
            currentDrawer: null,
            currentWord: null,
            roundStartTime: null,
            roundEndTime: null,
            guesses: new Map(),
            drawerHistory: []
          });
          gameState = games.get(roomId);
          console.log(`Auto-initialized game state for room ${roomId}`);
        } else {
          return res.status(404).json({ error: 'Room not found or not a Gartic Phone room' });
        }
      } catch (error) {
        return res.status(404).json({ error: 'Room not found' });
      }
    }

    // Prepare safe state for client
    const safeState = {
      status: gameState.status,
      currentRound: gameState.currentRound,
      totalRounds: gameState.totalRounds,
      roundTimeLeft: gameState.roundEndTime ? Math.max(0, Math.ceil((gameState.roundEndTime - Date.now()) / 1000)) : 0,
      currentDrawer: gameState.currentDrawer,
      scores: Object.fromEntries(gameState.scores),
      hasGuessed: userId ? gameState.guesses.has(userId) : false
    };

    res.json(safeState);
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

// Create new Gartic Phone room
app.post('/api/rooms', async (req, res) => {
  try {
    const { roomName, totalRounds = 5, roundTime = 180 } = req.body; // 3 minutes default

    const room = await client.createRoom({
      name: roomName || `Gartic Phone ${Date.now()}`,
      game_type: 'gartic_phone',
      max_size: '5', // Max 5 players
      total_rounds: totalRounds.toString(),
      round_time: roundTime.toString(),
      created_at: Date.now().toString()
    });

    // Initialize game state
    games.set(room.roomId, {
      status: 'waiting',
      currentRound: 0,
      totalRounds: totalRounds,
      roundTime: roundTime,
      players: new Map(),
      scores: new Map(),
      currentDrawer: null,
      currentWord: null,
      roundStartTime: null,
      roundEndTime: null,
      guesses: new Map(),
      drawerHistory: []
    });

    res.json({ room });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Start game
app.post('/api/rooms/:roomId/start', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { starterUserId } = req.body;

    let gameState = games.get(roomId);

    // Auto-initialize game state if room exists but no game state
    if (!gameState) {
      try {
        const snapshot = await client.getRoomSnapshot(roomId);
        if (snapshot && snapshot.roomOptions?.game_type === 'gartic_phone') {
          // Initialize game state for existing room
          games.set(roomId, {
            status: 'waiting',
            currentRound: 0,
            totalRounds: parseInt(snapshot.roomOptions?.total_rounds || '5'),
            roundTime: parseInt(snapshot.roomOptions?.round_time || '180'),
            players: new Map(),
            scores: new Map(),
            currentDrawer: null,
            currentWord: null,
            roundStartTime: null,
            roundEndTime: null,
            guesses: new Map(),
            drawerHistory: []
          });
          gameState = games.get(roomId);
          console.log(`Auto-initialized game state for room ${roomId}`);
        } else {
          return res.status(404).json({ error: 'Room not found or not a Gartic Phone room' });
        }
      } catch (error) {
        return res.status(404).json({ error: 'Room not found' });
      }
    }

    if (gameState.status !== 'waiting') {
      return res.status(400).json({ error: 'Game already started' });
    }

    // Start first round
    await startNewRound(roomId, gameState);

    res.json({ success: true, message: 'Game started!' });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Submit guess
app.post('/api/rooms/:roomId/guess', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, guess } = req.body;

    const gameState = games.get(roomId);
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (gameState.status !== 'guessing') {
      return res.status(400).json({ error: 'Not in guessing phase' });
    }

    if (userId === gameState.currentDrawer) {
      return res.status(400).json({ error: 'Drawer cannot guess' });
    }

    if (gameState.guesses.has(userId)) {
      return res.status(400).json({ error: 'Already guessed this round' });
    }

    const isCorrect = guess.toLowerCase().trim() === gameState.currentWord.toLowerCase();

    if (isCorrect) {
      // Calculate score based on time remaining
      const timeBonus = Math.floor((gameState.roundEndTime - Date.now()) / 1000);
      const baseScore = 100;
      const score = baseScore + timeBonus;

      // Update scores
      const currentScore = gameState.scores.get(userId) || 0;
      gameState.scores.set(userId, currentScore + score);

      // Award drawer points
      const drawerScore = gameState.scores.get(gameState.currentDrawer) || 0;
      gameState.scores.set(gameState.currentDrawer, drawerScore + 50);

      gameState.guesses.set(userId, { guess, isCorrect, timestamp: Date.now() });

      // Check if all non-drawer players have guessed correctly
      const snapshot = await client.getRoomSnapshot(roomId);
      const nonDrawerPlayers = snapshot.users.filter(u => u.id !== gameState.currentDrawer);
      const correctGuesses = Array.from(gameState.guesses.values()).filter(g => g.isCorrect).length;

      if (correctGuesses >= nonDrawerPlayers.length - 1) {
        // End round early if everyone guessed correctly
        await endRound(roomId, gameState);
      }

      res.json({ correct: true, score, message: 'Correct guess!' });
    } else {
      gameState.guesses.set(userId, { guess, isCorrect, timestamp: Date.now() });
      res.json({ correct: false, message: 'Wrong guess, try again!' });
    }
  } catch (error) {
    console.error('Error submitting guess:', error);
    res.status(500).json({ error: 'Failed to submit guess' });
  }
});

// Helper function to start a new round
async function startNewRound(roomId, gameState) {
  gameState.currentRound++;
  gameState.status = 'drawing';

  // Select random drawer (everyone should draw once)
  const snapshot = await client.getRoomSnapshot(roomId);
  const players = snapshot.users;

  if (!gameState.drawerHistory) {
    gameState.drawerHistory = [];
  }

  // Select a player who hasn't drawn yet
  const availableDrawers = players.filter(p => !gameState.drawerHistory.includes(p.id));
  const drawer = availableDrawers.length > 0
    ? availableDrawers[Math.floor(Math.random() * availableDrawers.length)]
    : players[Math.floor(Math.random() * players.length)];

  gameState.currentDrawer = drawer.id;
  gameState.drawerHistory.push(drawer.id);
  gameState.guesses.clear();

  // Get random word
  const randomIndex = Math.floor(Math.random() * WORD_LIST.length);
  gameState.currentWord = WORD_LIST[randomIndex];

  // Set round time
  gameState.roundStartTime = Date.now();
  gameState.roundEndTime = Date.now() + (gameState.roundTime * 1000);

  // Notify room via WebSocket
  io.to(roomId).emit('new-round', {
    round: gameState.currentRound,
    drawer: drawer.id,
    drawerName: drawer.name,
    word: gameState.currentWord,
    endTime: gameState.roundEndTime,
    totalRounds: gameState.totalRounds
  });

  // Auto-transition to guessing phase after 30 seconds
  setTimeout(async () => {
    if (games.has(roomId) && games.get(roomId).status === 'drawing') {
      await startGuessingPhase(roomId, games.get(roomId));
    }
  }, 30000); // 30 seconds drawing time
}

// Helper function to start guessing phase
async function startGuessingPhase(roomId, gameState) {
  gameState.status = 'guessing';

  // Notify room via WebSocket
  io.to(roomId).emit('guessing-phase', {
    startTime: Date.now(),
    endTime: gameState.roundEndTime
  });
}

// Helper function to end a round
async function endRound(roomId, gameState) {
  gameState.status = 'round_over';

  // Notify room of round results via WebSocket
  io.to(roomId).emit('round-over', {
    round: gameState.currentRound,
    word: gameState.currentWord,
    scores: Object.fromEntries(gameState.scores),
    guesses: Array.from(gameState.guesses.entries())
  });

  // Wait a bit then start next round or end game
  setTimeout(async () => {
    if (gameState.currentRound >= gameState.totalRounds) {
      await endGame(roomId, gameState);
    } else {
      await startNewRound(roomId, gameState);
    }
  }, 5000); // 5 seconds to see results
}

// Helper function to end the game
async function endGame(roomId, gameState) {
  gameState.status = 'finished';

  // Notify room of final results via WebSocket
  io.to(roomId).emit('game-over', {
    finalScores: Object.fromEntries(gameState.scores),
    winner: Array.from(gameState.scores.entries()).sort((a, b) => b[1] - a[1])[0]
  });

  // Reset game after 10 seconds
  setTimeout(async () => {
    const currentGameState = games.get(roomId);
    if (currentGameState) {
      currentGameState.status = 'waiting';
      currentGameState.currentRound = 0;
      currentGameState.scores.clear();
      currentGameState.guesses.clear();
      currentGameState.drawerHistory = [];
    }
  }, 10000);
}

// Socket.io real-time events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join game room
  socket.on('join-game', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined game ${roomId}`);
  });

  // Leave game room
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left game ${roomId}`);
  });

  // Handle drawing commands (real-time broadcasting)
  socket.on('draw-line', (data) => {
    const { roomId, line } = data;
    // Broadcast to all clients in the room except sender
    socket.to(roomId).emit('draw-line', line);
    console.log(`Drawing line in game ${roomId}`);
  });

  // Handle canvas clear
  socket.on('clear-canvas', (roomId) => {
    socket.to(roomId).emit('clear-canvas');
    console.log(`Canvas cleared in game ${roomId}`);
  });

  // Handle guess submissions (real-time broadcasting)
  socket.on('player-guess', (data) => {
    const { roomId, userId, guess, isCorrect } = data;
    // Broadcast guess to all clients in room except sender
    socket.to(roomId).emit('player-guess', { userId, guess, isCorrect });
    console.log(`Player ${userId} guessed "${guess}" in game ${roomId} - ${isCorrect ? 'CORRECT!' : 'wrong'}`);
  });

  // Handle game state updates
  socket.on('game-state-update', (data) => {
    const { roomId, gameState } = data;
    // Broadcast game state to all clients in room
    socket.to(roomId).emit('game-state-update', gameState);
    console.log(`Game state update in ${roomId}: ${gameState}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Cleanup
server.listen(PORT, () => {
  console.log(`Gartic Phone server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`RoomService: ${process.env.ROOM_SERVICE_HOST || 'localhost:50050'}`);
  console.log(`WebSocket: Real-time drawing and guessing enabled! 🎨`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing RoomService connection...');
  await client.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing RoomService connection...');
  await client.close();
  process.exit(0);
});