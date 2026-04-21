/**
 * Tic-Tac-Toe Demo Server
 *
 * This is a simple Node.js server that serves the tic-tac-toe demo.
 * It also provides API endpoints that use the RoomService SDK.
 *
 * To run:
 * 1. npm install
 * 2. npm start
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomServiceClient } from 'room-service-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize RoomService client
const roomServiceClient = new RoomServiceClient({
  host: process.env.ROOM_SERVICE_HOST || 'https://roomservice-proxy-production.up.railway.app:50051',
  apiKey: process.env.ROOM_SERVICE_API_KEY || 'rs_live_tenant-dabusick-addaa112_72c81ea6-a72a-4577-8763-c6522fa8afd7'
});

// API: Create a new game room
app.post('/api/room/create', async (req, res) => {
  try {
    const { playerName, userId } = req.body;

    const roomId = await roomServiceClient.createRoom({
      game: 'tic-tac-toe',
      max_players: '2'
    });

    // Use provided userId or generate one
    const finalUserId = userId || `player-${Date.now()}`;

    // Auto-join as player X with symbol in metadata
    await roomServiceClient.joinRoom(roomId, {
      userId: finalUserId,
      userName: playerName || 'Player 1',
      metadata: { symbol: 'X' }
    });

    // Initialize game state
    await roomServiceClient.setData(roomId, finalUserId, 'board', Array(9).fill(''));
    await roomServiceClient.setData(roomId, finalUserId, 'currentPlayer', 'X');
    await roomServiceClient.setData(roomId, finalUserId, 'gameStatus', 'waiting');
    // Store players as list: [{id, name, symbol}, ...]
    await roomServiceClient.setData(roomId, finalUserId, 'players', [
      { id: finalUserId, name: playerName || 'Player 1', symbol: 'X' }
    ]);

    res.json({
      roomId,
      userId: finalUserId,
      symbol: 'X'
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Join an existing room
app.post('/api/room/:roomId/join', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { playerName, userId: clientUserId } = req.body;

    // Get current room state to determine symbol
    const tempUserId = clientUserId || `temp-${Date.now()}`;
    const snapshot = await roomServiceClient.getRoomSnapshot(roomId, tempUserId);
    const existingUsers = snapshot.users || [];

    // Check if user is already in the room (reconnecting after refresh)
    const existingUser = existingUsers.find(u => u.id === clientUserId);

    if (existingUser) {
      // User is reconnecting - return their current state
      const users = snapshot.users || [];
      const players = users.map(u => ({
        id: u.id,
        name: u.name,
        symbol: u.metadata?.symbol || ''
      }));

      res.json({
        roomId,
        userId: existingUser.id,
        symbol: existingUser.metadata?.symbol || 'X',
        board: snapshot.data.board || Array(9).fill(''),
        currentPlayer: snapshot.data.currentPlayer || 'X',
        gameStatus: snapshot.data.gameStatus || 'waiting',
        winner: snapshot.data.winner || null,
        players
      });
      return;
    }

    // New user joining - check if room is full
    if (existingUsers.length >= 2) {
      return res.status(400).json({ error: 'Room is already full' });
    }

    const userId = clientUserId || `player-${Date.now()}`;

    // Determine symbol based on existing users (check metadata for symbol)
    let symbol = 'O';
    if (existingUsers.length === 0) {
      symbol = 'X';
    } else if (existingUsers.length === 1) {
      const existingSymbol = existingUsers[0].metadata?.symbol || 'X';
      symbol = existingSymbol === 'X' ? 'O' : 'X';
    }

    // Join room with symbol in metadata
    await roomServiceClient.joinRoom(roomId, {
      userId,
      userName: playerName || 'Player 2',
      metadata: { symbol }
    });

    // Get fresh snapshot after joining to get updated users list
    const freshSnapshot = await roomServiceClient.getRoomSnapshot(roomId, userId);
    const users = freshSnapshot.users || [];
    const players = users.map(u => ({
      id: u.id,
      name: u.name,
      symbol: u.metadata?.symbol || ''
    }));

    // Start game if both players are present
    let gameStatus = freshSnapshot.data.gameStatus || 'waiting';
    if (users.length === 2) {
      await roomServiceClient.setData(roomId, userId, 'gameStatus', 'playing');
      gameStatus = 'playing';
    }

    res.json({
      roomId,
      userId,
      symbol,
      board: freshSnapshot.data.board || Array(9).fill(''),
      currentPlayer: freshSnapshot.data.currentPlayer || 'X',
      gameStatus,
      players
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Get room state
app.get('/api/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.query;

    const snapshot = await roomServiceClient.getRoomSnapshot(roomId, userId as string);

    res.json({
      roomId: snapshot.roomId,
      board: snapshot.data.board || Array(9).fill(''),
      currentPlayer: snapshot.data.currentPlayer || 'X',
      gameStatus: snapshot.data.gameStatus || 'waiting',
      winner: snapshot.data.winner || null,
      players: snapshot.data.players || [],
      users: snapshot.users || []
    });
  } catch (error) {
    console.error('Error getting room:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Make a move
app.post('/api/room/:roomId/move', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, index, symbol } = req.body;

    // Get current state
    const snapshot = await roomServiceClient.getRoomSnapshot(roomId, userId);
    let board = snapshot.data.board || Array(9).fill('');
    let currentPlayer = snapshot.data.currentPlayer || 'X';
    let gameStatus = snapshot.data.gameStatus || 'waiting';

    // Validate move
    if (gameStatus !== 'playing') {
      return res.status(400).json({ error: 'Game is not in playing state' });
    }

    if (index < 0 || index > 8) {
      return res.status(400).json({ error: 'Invalid cell index' });
    }

    if (board[index] !== '') {
      return res.status(400).json({ error: 'Cell is already occupied' });
    }

    if (currentPlayer !== symbol) {
      return res.status(400).json({ error: 'Not your turn' });
    }

    // Make the move
    board[index] = symbol;

    // Check for win/draw
    const result = checkWin(board);
    let winner = snapshot.data.winner;

    if (result) {
      gameStatus = 'finished';
      winner = result === 'draw' ? null : result;
    } else {
      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    }

    // Update state
    await roomServiceClient.setData(roomId, userId, 'board', board);
    await roomServiceClient.setData(roomId, userId, 'currentPlayer', currentPlayer);
    await roomServiceClient.setData(roomId, userId, 'gameStatus', gameStatus);
    if (winner) {
      await roomServiceClient.setData(roomId, userId, 'winner', winner);
    }

    res.json({
      board,
      currentPlayer,
      gameStatus,
      winner
    });
  } catch (error) {
    console.error('Error making move:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Reset game
app.post('/api/room/:roomId/reset', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    await roomServiceClient.setData(roomId, userId, 'board', Array(9).fill(''));
    await roomServiceClient.setData(roomId, userId, 'currentPlayer', 'X');
    await roomServiceClient.setData(roomId, userId, 'gameStatus', 'playing');
    await roomServiceClient.setData(roomId, userId, 'winner', ''); // Set to empty string instead of null

    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting game:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Leave room
app.post('/api/room/:roomId/leave', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    await roomServiceClient.leaveRoom(roomId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Check for win/draw
function checkWin(board: string[]): string | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  if (!board.includes('')) {
    return 'draw';
  }

  return null;
}

// Start server
app.listen(PORT, () => {
  console.log(`🎮 Tic-Tac-Toe demo server running at http://localhost:${PORT}`);
  console.log(`📡 RoomService at: ${process.env.ROOM_SERVICE_HOST || 'localhost:50050'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Closing RoomService client...');
  await roomServiceClient.close();
  process.exit(0);
});
