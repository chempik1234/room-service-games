# Getting Started with RoomService JavaScript SDK

This guide will help you set up and use the RoomService JavaScript SDK.

## Prerequisites

- Node.js >= 16.0.0
- A running RoomService instance

## Installation

```bash
npm install @chempik1234/room-service-js
```

## Setting Up RoomService

### Option 1: Self-Hosted with Docker

If you have the RoomService project:

```bash
cd /path/to/RoomService
task up   # Start RoomService with Docker
```

RoomService will start on `localhost:50050`.

### Option 2: Using Environment Variables

```bash
# Set these in your .env file or environment
export ROOM_SERVICE_HOST=localhost:50050
export ROOM_SERVICE_API_KEY=123
```

### Option 3: Custom Configuration

```javascript
const client = new RoomServiceClient({
  host: 'my-server.com:50050',
  apiKey: 'my-secret-key',
  secure: true  // Use TLS
});
```

## Your First Room

Here's a complete example to get you started:

```javascript
import { RoomServiceClient } from '@chempik1234/room-service-js';

async function main() {
  // 1. Create a client
  const client = new RoomServiceClient({
    host: 'localhost:50050',
    apiKey: process.env.ROOM_SERVICE_API_KEY || '123'
  });

  try {
    // 2. Create a room
    console.log('Creating room...');
    const roomId = await client.createRoom({
      game: 'tic-tac-toe',
      max_players: '2'
    });
    console.log('Room created:', roomId);

    // 3. Join the room
    const userId = 'player-1';
    await client.joinRoom(roomId, {
      userId,
      userName: 'Alice'
    });
    console.log('Joined room');

    // 4. Set some data
    await client.setData(roomId, userId, 'board', [
      '', '', '',
      '', '', '',
      '', '', ''
    ]);
    await client.setData(roomId, userId, 'turn', 'X');
    console.log('Game data set');

    // 5. Get room state
    const snapshot = await client.getRoomSnapshot(roomId, userId);
    console.log('Users in room:', snapshot.users.map(u => u.name));
    console.log('Room data:', snapshot.data);

    // 6. Clean up
    await client.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
```

## Common Patterns

### Creating a Room

```javascript
// Simple room
const roomId = await client.createRoom();

// Room with options
const roomId = await client.createRoom({
  game_type: 'chess',
  max_users: '2',
  private: 'true',
  rated: 'true'
});
```

### Listing Available Rooms

```javascript
const rooms = await client.listRooms();

// Find chess games waiting for players
const chessGames = rooms.filter(r =>
  r.roomOptions.game_type === 'chess' &&
  r.roomOptions.status === 'waiting'
);

console.log('Available games:', chessGames);
```

### Joining a Room

```javascript
await client.joinRoom(roomId, {
  userId: 'user-123',
  userName: 'Alice',
  metadata: {
    avatar: 'cat.png',
    country: 'US',
    rating: '1500'
  }
});
```

### Setting Game Data

```javascript
// Simple value
await client.setData(roomId, userId, 'status', 'playing');

// Complex object
await client.setData(roomId, userId, 'gameState', {
  board: ['', '', 'X', '', 'O', '', '', '', ''],
  currentPlayer: 'X',
  moveCount: 2
});

// Array (list)
await client.setData(roomId, userId, 'moves', ['e2-e4', 'e7-e5']);
```

### Reading Data

```javascript
const snapshot = await client.getRoomSnapshot(roomId, userId);

// Access data
const board = snapshot.data.board;          // Array
const currentTurn = snapshot.data.turn;     // String
const moveCount = snapshot.data.moveCount;  // Number

// Get users
const players = snapshot.users;
players.forEach(user => {
  console.log(user.name, user.metadata);
});
```

### Data Operations

```javascript
// SET - Replace value
await client.setData(roomId, userId, 'score', 100);

// DELETE - Remove data
await client.deleteData(roomId, userId, 'tempData');

// APPEND - Add to list
await client.appendToList(roomId, userId, 'chatMessages', 'Hello!');

// REMOVE - Remove from list by index
await client.removeFromList(roomId, userId, 'chatMessages', '0');
```

## Real-Time Updates

For real-time games, use streaming:

```javascript
import { RoomServiceClient } from '@chempik1234/room-service-js';

const client = new RoomServiceClient();

async function playGame() {
  const stream = await client.openStream();

  // Create and join room
  await stream.createRoom({ game: 'chess' });

  // Listen for room creation
  stream.on('RoomCreated', (event) => {
    const roomId = event.roomId;
    console.log('Room created:', roomId);

    // Join the room
    stream.joinRoom(roomId, {
      userId: 'player-1',
      userName: 'Alice'
    });
  });

  // Listen for new players
  stream.on('JoinedRoom', (event) => {
    console.log('Player joined:', event.user.name);
  });

  // Listen for data changes (moves, state updates)
  stream.on('DataEdited', (event) => {
    if (event.dataId === 'board') {
      console.log('Board updated:', event.value);
      // Update UI
    }
  });

  // Listen for errors
  stream.on('ErrorMessage', (event) => {
    console.error('Error:', event.error);
  });
}

playGame();
```

## Error Handling

```javascript
import { RoomServiceError } from '@chempik1234/room-service-js';

try {
  await client.createRoom({ max_users: '10' });
} catch (error) {
  if (error instanceof RoomServiceError) {
    if (error.isAuthenticationError()) {
      // Wrong API key
      console.log('Check your ROOM_SERVICE_API_KEY');
    } else if (error.isPermissionError()) {
      // Not authorized (e.g., trying to delete room as non-owner)
      console.log('You need to be the room owner');
    } else if (error.isNotFoundError()) {
      // Room doesn't exist
      console.log('Room not found');
    } else if (error.isInvalidArgumentError()) {
      // Invalid input
      console.log('Invalid arguments');
    }
  }
}
```

## Project Setup

### New Project

```bash
mkdir my-game
cd my-game
npm init -y
npm install @chempik1234/room-service-js
```

### TypeScript Setup

```bash
npm install -D typescript @types/node
npx tsc --init
```

### ES Modules

Add to your `package.json`:

```json
{
  "type": "module"
}
```

Or use `.mjs` extension for your files.

### CommonJS

If you're using CommonJS (require), the SDK still works:

```javascript
const { RoomServiceClient } = require('@chempik1234/room-service-js');
```

## Testing Your Setup

Create a file `test.js`:

```javascript
import { RoomServiceClient } from '@chempik1234/room-service-js';

const client = new RoomServiceClient();

async function test() {
  try {
    // Create room
    const roomId = await client.createRoom({ test: 'true' });
    console.log('✓ Room created:', roomId);

    // Join room
    await client.joinRoom(roomId, {
      userId: 'test-user',
      userName: 'Test'
    });
    console.log('✓ Joined room');

    // Set data
    await client.setData(roomId, 'test-user', 'ping', 'pong');
    console.log('✓ Data set');

    // Get snapshot
    const snapshot = await client.getRoomSnapshot(roomId, 'test-user');
    console.log('✓ Snapshot:', snapshot.data);

    // List rooms
    const rooms = await client.listRooms();
    console.log('✓ Rooms list:', rooms.length);

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

test();
```

Run it:

```bash
node test.js
```

## Troubleshooting

### "Proto file not found"

Make sure the RoomService project is checked out alongside your project:

```
Projects/
├── RoomService/
└── your-project/
```

Or set the proto path explicitly.

### "Connection refused"

Make sure RoomService is running:

```bash
# In RoomService directory
task up
task logs
```

### "Authentication failed"

Check your API key:

```bash
# In RoomService directory
grep ROOM_SERVICE_API_KEY .env
```

### Port Already in Use

Change the port:

```javascript
const client = new RoomServiceClient({
  host: 'localhost:50051'  // Different port
});
```

Or stop the conflicting service.

## Next Steps

- [API Reference](API_REFERENCE.md) - Complete API documentation
- [Streaming Guide](STREAMING_GUIDE.md) - Real-time updates
- [LLM Prompting Guide](LLM_PROMPTING_GUIDE.md) - Using with AI assistants
- Check out the [examples](../examples/) directory

## Support

- GitHub Issues: https://github.com/yourusername/room-service-js/issues
- RoomService Docs: https://github.com/yourusername/RoomService
