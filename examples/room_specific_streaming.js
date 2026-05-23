/**
 * Room-Specific Streaming Example
 *
 * This example demonstrates how to use room-id metadata for optimized streaming.
 * This is particularly useful for games and applications where clients typically
 * interact with only one room at a time.
 */

const { RoomServiceClient } = require('../dist/index.js');

// Configuration
const client = new RoomServiceClient({
  host: 'localhost:50050',
  apiKey: '123',
});

async function main() {
  try {
    // Example 1: Default streaming (all rooms)
    console.log('=== Example 1: Default Streaming (All Rooms) ===');
    const allRoomsStream = await client.openStream();

    allRoomsStream.on('event', (event) => {
      console.log(`[All Rooms] Received event: ${event.type}`);
    });

    // Example 2: Optimized room-specific streaming
    console.log('\n=== Example 2: Room-Specific Streaming (Optimized) ===');
    const roomId = 'game-room-123';
    const gameStream = await client.openStream(roomId);

    gameStream.on('event', (event) => {
      console.log(`[Room ${roomId}] Received event: ${event.type}`);
    });

    gameStream.on('FullRoomSnapshot', (event) => {
      console.log(`[Room ${roomId}] Room snapshot:`, event.room);
      console.log(`[Room ${roomId}] Users:`, event.users);
    });

    gameStream.on('DataEdited', (event) => {
      console.log(`[Room ${roomId}] Data edited:`, event.dataId, event.mode);
    });

    // Example 3: Real-time game usage
    console.log('\n=== Example 3: Real-time Game Usage ===');
    await demonstrateGamePlay(gameStream, roomId);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

async function demonstrateGamePlay(stream, roomId) {
  const userId = 'player-1';

  // Join a room
  console.log('Joining room...');
  await stream.joinRoom(roomId, {
    id: userId,
    name: 'Player One',
    metadata: { skill: 'intermediate' }
  });

  // Set game state
  await stream.setData(roomId, userId, 'game_status', 'waiting_for_players');
  await stream.setData(roomId, userId, 'max_players', 4);
  await stream.setData(roomId, userId, 'current_players', 1);

  console.log('Waiting for events (press Ctrl+C to exit)...');

  // Simulate game updates
  setTimeout(async () => {
    await stream.setData(roomId, userId, 'game_status', 'in_progress');
    await stream.setData(roomId, userId, 'current_players', 2);
  }, 3000);

  setTimeout(async () => {
    await stream.setData(roomId, userId, 'move', 'e2-e4');
    await stream.setData(roomId, userId, 'turn', 'player-2');
  }, 6000);

  // Keep the stream open to receive events
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Leave the room
  await stream.leaveRoom(roomId, userId);
  await stream.close();
}

// Benefits of room-specific streaming:
console.log(`
Benefits of Room-Specific Streaming:
=====================================
1. Performance: Client only receives events from the specified room
2. Bandwidth: Reduced network traffic by filtering irrelevant events
3. Server Load: Lower server resource usage
4. Validation: Server validates all commands match the specified room
5. Gaming: Perfect for multiplayer games where players are in one room

Use Cases:
- Multiplayer games (players typically in one game room)
- Collaborative editing (users work on one document at a time)
- Real-time dashboards (specific room/channel monitoring)
- Chat applications (users in one chat room)

When to use:
- Use openStream() for admin dashboards, monitoring, multi-room apps
- Use openStream(roomId) for games, collaborative tools, chat apps
`);

main().catch(console.error);
