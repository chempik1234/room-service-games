import express from 'express';
import { RoomServiceClient } from '@chempik1234/room-service-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize RoomService client
const client = new RoomServiceClient({
  host: process.env.ROOMSERVICE_HOST?.split(':')[0] || 'localhost',
  port: parseInt(process.env.ROOMSERVICE_HOST?.split(':')[1] || '50050'),
  apiKey: process.env.ROOMSERVICE_API_KEY || '123'
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
      roomOptions: {
        name: roomName || `Pixel Battle ${Date.now()}`,
        game_type: 'pixel_battle',
        max_size: maxSize.toString(),
        created_at: Date.now().toString(),
        version: '1.0'
      }
    });

    res.json({ room });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
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

app.listen(PORT, () => {
  console.log(`Pixel Battle server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`RoomService: ${process.env.ROOMSERVICE_HOST || 'localhost:50050'}`);
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