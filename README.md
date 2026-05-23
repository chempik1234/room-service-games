# RoomService JavaScript SDK

> A simple, clean SDK for the RoomService gRPC API - Build real-time multiplayer games easily!

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Easy-to-use API for JavaScript/TypeScript developers
- Full support for RoomService gRPC methods
- Bidirectional streaming support for real-time updates
- TypeScript types included (works with pure JavaScript too)
- Works in Node.js environments
- Handles all the complex gRPC stuff for you

## Quick Start

### Installation

```bash
npm install room-service-js
```

### Basic Usage

```javascript
import { RoomServiceClient } from 'room-service-js';

// Initialize client with multi-tenant proxy
const client = new RoomServiceClient({
  host: 'https://roomservice-proxy-production.up.railway.app', // Full URL works!
  apiKey: 'rs_live_yourtenantid_uuid' // From your control panel
});

// Create a room
const roomId = await client.createRoom({
  max_users: '10',
  game_type: 'tic-tac-toe'
});

// Join the room
await client.joinRoom(roomId, {
  userId: 'player-1',
  userName: 'Alice'
});

// Set game data
await client.setData(roomId, 'player-1', 'board', [
  '', '', '',
  '', '', '',
  '', '', ''
]);

await client.setData(roomId, 'player-1', 'turn', 'X');

// Get room state
const snapshot = await client.getRoomSnapshot(roomId, 'player-1');
console.log('Users:', snapshot.users);
console.log('Data:', snapshot.data);

// Clean up
await client.close();
```

### Smart Hostname Handling

The SDK automatically handles all these hostname formats:

```javascript
// All of these work perfectly:
new RoomServiceClient({ host: 'localhost:50050' })
new RoomServiceClient({ host: 'roomservice-proxy.up.railway.app' })
new RoomServiceClient({ host: 'https://roomservice-proxy.up.railway.app' })
new RoomServiceClient({ host: 'http://roomservice-proxy.up.railway.app' })
new RoomServiceClient({ host: 'grpc://roomservice-proxy.up.railway.app' })
```

Just copy the hostname directly from your browser or control panel! 🎉

## Real-Time Streaming

For real-time games and collaborative apps:

```javascript
import { RoomServiceClient } from 'room-service-js';

const client = new RoomServiceClient();
const stream = await client.openStream();

// Listen for events
stream.on('DataEdited', (event) => {
  console.log('Data changed:', event.dataId, event.value);
  // Update your UI here
});

stream.on('JoinedRoom', (event) => {
  console.log('User joined:', event.user.name);
});

stream.on('LeftRoom', (event) => {
  console.log('User left');
});

// Send commands
await stream.createRoom({ game: 'chess' });
const roomId = '...';  // Get from RoomCreated event
await stream.joinRoom(roomId, { userId: 'player-1', userName: 'Alice' });
await stream.setData(roomId, 'player-1', 'move', 'e2-e4');

// Later...
await stream.close();
await client.close();
```

### 🚀 Room-Specific Streaming (Optimized)

For multiplayer games and apps where clients interact with one room at a time:

```javascript
// Optimized streaming - receive events from specific room only
const roomId = 'game-room-123';
const gameStream = await client.openStream(roomId);

gameStream.on('DataEdited', (event) => {
  console.log('Game move:', event.dataId, event.value);
  // Update your game UI
});

gameStream.on('JoinedRoom', (event) => {
  console.log('Player joined:', event.user.name);
  // Update player list
});

// All commands must match the specified room
await gameStream.joinRoom(roomId, { userId: 'player-1', userName: 'Alice' });
await gameStream.setData(roomId, 'player-1', 'move', 'e2-e4');

// Server validates that all commands match the room-id metadata
```

**Benefits of room-specific streaming:**
- ✅ **Performance**: Only receive events from your room
- ✅ **Bandwidth**: Reduced network traffic
- ✅ **Validation**: Server ensures commands match the specified room
- ✅ **Gaming**: Perfect for multiplayer games

**When to use:**
- `openStream()` - Admin dashboards, monitoring, multi-room apps
- `openStream(roomId)` - Multiplayer games, collaborative tools, chat apps

> 💡 **Unity Games**: Use `openStream(roomId)` for optimal performance in your multiplayer games!

## API Reference

### Room Management

```javascript
// Create a new room
const roomId = await client.createRoom({
  max_users: '10',
  game_type: 'chess',
  private: 'true'
});

// Delete a room (owner only)
await client.deleteRoom(roomId, 'owner-user-id');

// List all rooms
const rooms = await client.listRooms();

// Get rooms a specific user is in
const myRooms = await client.getUserActiveRooms('player-1');
```

### User Management

```javascript
// Join a room
await client.joinRoom(roomId, {
  userId: 'player-1',
  userName: 'Alice',
  metadata: { avatar: 'cat.png', country: 'US' }
});

// Leave a room
await client.leaveRoom(roomId, 'my-user-id');

// Kick another user (owner only)
await client.leaveRoom(roomId, 'owner-id', 'trouble-maker-id');
```

### Data Operations

```javascript
// SET - Replace entire value
await client.setData(roomId, userId, 'game_state', 'active');
await client.setData(roomId, userId, 'score', 100);
await client.setData(roomId, userId, 'board', ['', '', 'X', ...]);

// DELETE - Remove data key
await client.deleteData(roomId, userId, 'temp_data');

// APPEND - Add to list
await client.appendToList(roomId, userId, 'moves', 'e2-e4');

// REMOVE - Remove from list/map
await client.removeFromList(roomId, userId, 'players', '0');
```

### Queries

```javascript
// Get full room snapshot
const snapshot = await client.getRoomSnapshot(roomId, userId);
console.log(snapshot.data);      // Room data
console.log(snapshot.users);     // Array of users
console.log(snapshot.roomOptions); // Room options
```

### Streaming

```javascript
const stream = await client.openStream();

// Listen to all events
stream.on('event', (event) => {
  console.log('Event:', event.type);
});

// Listen to specific events
stream.on('RoomCreated', (event) => { ... });
stream.on('JoinedRoom', (event) => { ... });
stream.on('LeftRoom', (event) => { ... });
stream.on('DataEdited', (event) => { ... });
stream.on('OwnerChanged', (event) => { ... });
stream.on('FullRoomSnapshot', (event) => { ... });
stream.on('ErrorMessage', (event) => { ... });

// Send commands via stream
await stream.createRoom({ game: 'chess' });
await stream.joinRoom(roomId, { userId, userName });
await stream.setData(roomId, userId, 'move', 'e2-e4');
await stream.refreshRoom(roomId, userId);

// Close stream
await stream.close();
```

## Value Types

The SDK automatically converts JavaScript values to RoomService types:

```javascript
// Strings
await client.setData(roomId, userId, 'status', 'active');

// Numbers (automatically int or float)
await client.setData(roomId, userId, 'count', 42);
await client.setData(roomId, userId, 'price', 3.14);

// Booleans
await client.setData(roomId, userId, 'enabled', true);

// Arrays
await client.setData(roomId, userId, 'tags', ['game', 'multiplayer']);

// Objects
await client.setData(roomId, userId, 'config', {
  maxPlayers: 10,
  private: false
});

// Nested structures
await client.setData(roomId, userId, 'playerStats', {
  wins: 5,
  losses: 2,
  history: ['win', 'loss', 'win']
});
```

For explicit type control, you can use value helpers:

```javascript
import {
  stringValue,
  intValue,
  floatValue,
  boolValue,
  listValue,
  mapValue
} from 'room-service-js';

await client.setData(roomId, userId, 'count', intValue(42));
await client.setData(roomId, userId, 'tags', listValue([
  stringValue('game'),
  stringValue('multiplayer')
]));
```

## Error Handling

```javascript
import { RoomServiceError } from 'room-service-js';

try {
  await client.createRoom({ max_users: '10' });
} catch (error) {
  if (error instanceof RoomServiceError) {
    console.error('Error:', error.message);

    // Check specific error types
    if (error.isAuthenticationError()) {
      console.log('Check your API key');
    } else if (error.isPermissionError()) {
      console.log('You need to be the owner');
    } else if (error.isNotFoundError()) {
      console.log('Room not found');
    } else if (error.isServerError()) {
      console.log('Server error - try again later');
    }

    // Get user-friendly message
    console.log('User message:', error.getUserMessage());
  }
}
```

### Multi-Tenant Authentication

When using the RoomService proxy, your API key automatically routes requests to your tenant instance:

```javascript
// Get your API key from the control panel
const client = new RoomServiceClient({
  host: 'https://roomservice-proxy.up.railway.app',
  apiKey: 'rs_live_yourtenantid_uuid' // Format: rs_live_tenantid_uuid
});

// All requests are automatically authenticated with your API key
await client.createRoom({ game_type: 'chess' });
```

**Error Codes:**

| Code | Meaning | Solution |
|------|---------|----------|
| 16 | Unauthenticated | Invalid API key - check control panel |
| 7 | Permission Denied | Tenant may be suspended or insufficient permissions |
| 5 | Not Found | Room doesn't exist |
| 13 | Internal Server Error | RoomService instance down - retry later |
| 14 | Unavailable | Temporary issue - retry later |
| 3 | Invalid Argument | Check command format |
| 8 | Resource Exhausted | Rate limited - retry later |

## Configuration

### Environment Variables

```bash
# RoomService connection (optional, can also pass in constructor)
ROOM_SERVICE_HOST=https://roomservice-proxy.up.railway.app
ROOM_SERVICE_API_KEY=rs_live_yourtenantid_uuid
```

### Client Options

```javascript
const client = new RoomServiceClient({
  host: 'https://roomservice-proxy.up.railway.app', // RoomService proxy address
  apiKey: 'rs_live_yourtenantid_uuid',              // Your tenant's API key
  secure: false,                                     // Use TLS (default: false)
  timeout: 5000                                      // Request timeout in ms
});
```

### Multi-Tenant Setup

For multi-tenant deployments, use the RoomService proxy:

```javascript
// 1. Get your API key from the control panel (rs_live_tenantid_uuid)
// 2. Use the proxy hostname
const client = new RoomServiceClient({
  host: 'https://roomservice-proxy.up.railway.app',
  apiKey: 'rs_live_mytenant_abc123def456'
});

// The proxy automatically routes your requests to your tenant instance
// No need to specify tenant ID manually!
```

## Documentation

- [Getting Started Guide](docs/GETTING_STARTED.md) - Complete setup and first steps
- [API Reference](docs/API_REFERENCE.md) - Full API documentation
- [Streaming Guide](docs/STREAMING_GUIDE.md) - Real-time updates with streaming
- [LLM Prompting Guide](docs/LLM_PROMPTING_GUIDE.md) - How to use with AI assistants

## Examples

See the `examples/` directory for complete examples:

- **Tic-Tac-Toe** - A complete 2-player game with real-time updates
- **Quick Start** - Simple examples to get you started

## Requirements

- Node.js >= 16.0.0
- RoomService backend running (see [Getting Started](docs/GETTING_STARTED.md))

## Browser Support

This SDK currently supports Node.js environments only. For browser applications, create a Node.js backend that uses the SDK and exposes REST/WebSocket endpoints to your frontend.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
