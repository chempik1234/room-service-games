import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { RoomServiceClient } from '@chempik1234/room-service-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server);
const PORT = process.env.PORT || 3001;

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

// Get only pixel battle rooms with detailed info
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await client.listRooms();

    // Filter only pixel battle rooms and add detailed info
    const pixelBattleRooms = await Promise.all(
      rooms
        .filter(room => room.roomOptions?.game_type === 'pixel_battle')
        .map(async (room) => {
          try {
            // Get current room snapshot for real-time info
            const snapshot = await client.getRoomSnapshot(room.roomId);

            return {
              ...room,
              currentPlayers: snapshot.users.length,
              maxPlayers: parseInt(room.roomOptions?.max_size || '10'),
              createdAt: new Date(parseInt(room.roomOptions?.created_at || Date.now())).toISOString(),
              hasCanvasData: snapshot.values.canvas_data !== undefined
            };
          } catch (error) {
            // If snapshot fails, return basic room info
            return {
              ...room,
              currentPlayers: 0,
              maxPlayers: parseInt(room.roomOptions?.max_size || '10'),
              createdAt: new Date(parseInt(room.roomOptions?.created_at || Date.now())).toISOString(),
              hasCanvasData: false
            };
          }
        })
    );

    res.json({ rooms: pixelBattleRooms });
  } catch (error) {
    console.error('Error getting rooms:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// Get room snapshot for visitors (deltas)
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const snapshot = await client.getRoomSnapshot(roomId);

    // Prepare visitor-friendly data
    const visitorData = {
      roomId: snapshot.roomId,
      roomOptions: snapshot.roomOptions,
      currentPlayers: snapshot.users.length,
      maxPlayers: parseInt(snapshot.roomOptions?.max_size || '10'),
      hasCanvasData: snapshot.values.canvas_data !== undefined,
      lastActivity: new Date(snapshot.timestamp).toISOString(),
      players: snapshot.users.map(user => ({
        id: user.id,
        name: user.name,
        isOwner: user.id === snapshot.roomOwnerId
      }))
    };

    res.json(visitorData);
  } catch (error) {
    console.error('Error getting room snapshot:', error);
    res.status(500).json({ error: 'Failed to get room info' });
  }
});

// Create new pixel battle room
app.post('/api/rooms', async (req, res) => {
  try {
    const { roomName, maxSize = 10 } = req.body;

    const room = await client.createRoom({
      name: roomName || `Pixel Battle ${Date.now()}`,
      game_type: 'pixel_battle',
      max_size: maxSize.toString(),
      created_at: Date.now().toString(),
      version: '1.0'
    });

    res.json({ room });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
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
        maxPlayers: parseInt(snapshot.roomOptions?.max_size || '10'),
        hasCanvasData: snapshot.values?.canvas_data !== undefined
      }
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Kick user from room
app.post('/api/rooms/:roomId/kick', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { adminUserId, targetUserId } = req.body;

    if (!adminUserId || !targetUserId) {
      return res.status(400).json({ error: 'Missing user IDs' });
    }

    // Only room owner can kick
    const snapshot = await client.getRoomSnapshot(roomId);
    if (snapshot.roomOwnerId !== adminUserId) {
      return res.status(403).json({ error: 'Only room owner can kick users' });
    }

    // Leave room with kickedUserId parameter
    await client.leaveRoom(roomId, adminUserId, targetUserId);

    res.json({ success: true, message: `User ${targetUserId} kicked from room` });
  } catch (error) {
    console.error('Error kicking user:', error);
    res.status(500).json({ error: 'Failed to kick user' });
  }
});

// Delete room
app.delete('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }

    // Only room owner can delete
    const snapshot = await client.getRoomSnapshot(roomId);
    if (snapshot.roomOwnerId !== userId) {
      return res.status(403).json({ error: 'Only room owner can delete room' });
    }

    await client.deleteRoom(roomId, userId);

    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Leave room endpoint for browser close cleanup
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

// Get canvas data from room state
app.get('/api/rooms/:roomId/canvas', async (req, res) => {
  try {
    const { roomId } = req.params;
    const snapshot = await client.getRoomSnapshot(roomId);

    res.json({
      canvasData: snapshot.values.canvas_data || null,
      timestamp: snapshot.timestamp
    });
  } catch (error) {
    console.error('Error getting canvas data:', error);
    res.status(500).json({ error: 'Failed to get canvas data' });
  }
});

// Save drawing commands to room state
app.post('/api/rooms/:roomId/draw', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { lines } = req.body;

    if (!Array.isArray(lines)) {
      return res.status(400).json({ error: 'lines must be an array' });
    }

    // Get current room snapshot
    const snapshot = await client.getRoomSnapshot(roomId);

    // Get existing drawings or create new array
    const existingDrawings = snapshot.values.drawings ?
      JSON.parse(snapshot.values.drawings.stringValue || '[]') : [];

    // Add new drawings to the array
    const allDrawings = [...existingDrawings, ...lines];

    // Store in room state (limit to last 1000 drawings to prevent memory issues)
    const limitedDrawings = allDrawings.slice(-1000);

    await client.setData(roomId, 'drawings', JSON.stringify(limitedDrawings));

    res.json({ success: true, count: lines.length });
  } catch (error) {
    console.error('Error saving drawing commands:', error);
    res.status(500).json({ error: 'Failed to save drawing commands' });
  }
});

// Get drawing commands from room state
app.get('/api/rooms/:roomId/drawings', async (req, res) => {
  try {
    const { roomId } = req.params;
    console.log(`Fetching drawings for room: ${roomId}`);

    const snapshot = await client.getRoomSnapshot(roomId);
    console.log(`Snapshot retrieved:`, JSON.stringify(snapshot.values, null, 2));

    let drawings = [];
    if (snapshot.values && snapshot.values.drawings) {
      try {
        drawings = JSON.parse(snapshot.values.drawings.stringValue || '[]');
        console.log(`Parsed ${drawings.length} drawings`);
      } catch (e) {
        console.error('Error parsing drawings:', e);
        drawings = [];
      }
    } else {
      console.log('No drawings found in room values');
    }

    res.json({ lines: drawings });
  } catch (error) {
    console.error('Error getting drawing commands:', error);
    res.status(500).json({ error: 'Failed to get drawing commands', details: error.message });
  }
});

// Keep old canvas endpoint for backward compatibility
app.post('/api/rooms/:roomId/canvas', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { canvasData } = req.body;

    // Get current room snapshot
    const snapshot = await client.getRoomSnapshot(roomId);

    // Update canvas data in room state
    await client.updateRoom(roomId, {
      values: {
        ...snapshot.values,
        canvas_data: canvasData
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving canvas data:', error);
    res.status(500).json({ error: 'Failed to save canvas data' });
  }
});

// Get room updates (polling endpoint for real-time updates)
app.get('/api/rooms/:roomId/updates', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { lastUpdate } = req.query;

    const snapshot = await client.getRoomSnapshot(roomId);

    // Check if there are updates since the last check
    const hasUpdates = !lastUpdate || snapshot.timestamp > parseInt(lastUpdate);

    res.json({
      hasUpdates: hasUpdates,
      timestamp: snapshot.timestamp,
      currentPlayers: snapshot.users.length,
      players: snapshot.users.map(user => ({
        id: user.id,
        name: user.name,
        color: user.metadata?.color || '#000000',
        brushSize: user.metadata?.brushSize || '5'
      }))
    });
  } catch (error) {
    console.error('Error getting room updates:', error);
    res.status(500).json({ error: 'Failed to get room updates' });
  }
});

// Socket.io real-time drawing events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // Handle drawing commands
  socket.on('draw-line', (data) => {
    const { roomId, line } = data;
    // Broadcast to all clients in the room except sender
    socket.to(roomId).emit('draw-line', line);
    console.log(`Drawing line in room ${roomId} - broadcasting to ${roomId}`);
  });

  // Handle canvas clear
  socket.on('clear-canvas', (roomId) => {
    socket.to(roomId).emit('clear-canvas');
    console.log(`Canvas cleared in room ${roomId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Pixel Battle server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`RoomService: ${process.env.ROOM_SERVICE_HOST || 'localhost:50050'}`);
  console.log(`WebSocket: Real-time drawing enabled! 🎨`);
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