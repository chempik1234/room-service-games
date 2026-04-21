import express from 'express';
import { RoomServiceClient } from 'room-service-js';
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

// Get only pixel battle rooms (filtered)
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await client.getRooms();

    // Filter only pixel battle rooms
    const pixelBattleRooms = rooms.filter(room =>
      room.roomOptions?.game_type === 'pixel_battle'
    );

    res.json({ rooms: pixelBattleRooms });
  } catch (error) {
    console.error('Error getting rooms:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
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
        created_at: Date.now().toString()
      }
    });

    res.json({ room });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
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