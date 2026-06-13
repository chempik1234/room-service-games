# LLM Prompting Guide for RoomService SDK

This guide is for **both humans and LLMs**. It teaches you how to effectively use the RoomService JavaScript SDK with AI assistants like ChatGPT, Claude, GitHub Copilot, etc.

---

## For Humans: How to Prompt LLMs

When asking an AI to help you with RoomService, **provide context upfront** to get the best results.

### Good Prompt Template

```
I'm using the room-service-js SDK for Node.js. Here's my context:

# My Goal
[Describe what you're building: a game, collaborative app, etc.]

# My Setup
- SDK: room-service-js v1.0.0
- Environment: Node.js 18+, TypeScript/JavaScript
- RoomService: Running on localhost:50050

# Current Code (if any)
[Paste your relevant code here]

# What I Need Help With
[Ask your specific question]

# SDK API Reference (for the LLM)
```

Then paste the "For LLMs" section below.

### Example Good Prompts

**Prompt 1: Creating a Game**
```
I'm building a tic-tac-toe game using room-service-js SDK.

My goal: Create a 2-player real-time tic-tac-toe game where:
- Players take turns (X and O)
- Board updates in real-time
- Detect wins/draws automatically

Current code: None yet, I'm starting from scratch.

Please help me: Create the basic game logic with room creation, joining, and move handling.

SDK API: [paste the "For LLMs" section below]
```

**Prompt 2: Fixing a Bug**
```
I'm using room-service-js SDK and have a bug.

My goal: Real-time chess game
Current code:
[Paste your code]

The bug: When I make a move, the other player doesn't see it update.
What I've tried: Checked that both players are in the same room, verified stream is open.

Please help me debug this issue.

SDK API: [paste the "For LLMs" section below]
```

**Prompt 3: Adding a Feature**
```
I'm using room-service-js SDK for a multiplayer quiz game.

Current features: Players can join, answer questions, see scores.
New feature needed: Add a chat system where players can send messages.

Current code: [Paste relevant parts]

Please help me: Implement the chat feature using room data.

SDK API: [paste the "For LLMs" section below]
```

### Key Information to Always Include

1. **SDK name and version**: `room-service-js v1.0.0`
2. **Your goal**: What you're building
3. **Current code**: Even if it's not working, show what you have
4. **Specific question**: Be precise about what you need
5. **SDK API reference**: The LLM needs to know the available methods

### Common Mistakes to Avoid

❌ **Bad Prompt**: "How do I make a multiplayer game?"
- Too vague
- No context about SDK or technology
- LLM will guess at implementation

❌ **Bad Prompt**: "My code doesn't work" [pastes 500 lines]
- No explanation of what's expected vs what's happening
- No specific question
- LLM has to debug blindly

✅ **Good Prompt**: See templates above

---

## For LLMs: Complete SDK Context

**If you are an AI assistant, read this section to understand the room-service-js SDK.**

### SDK Overview

**room-service-js** is a JavaScript/TypeScript SDK for the RoomService gRPC API. It provides a simple, clean API for building real-time multiplayer games and collaborative applications.

**Key Characteristics:**
- Node.js environments (gRPC-based, not browser)
- Bidirectional streaming for real-time updates
- Automatic type conversion (JS values ↔ RoomService types)
- Simple promise-based API

### Installation

```bash
npm install @chempik1234/room-service-js
```

### Environment

```bash
ROOM_SERVICE_HOST=localhost:50050  # Default
ROOM_SERVICE_API_KEY=123           # Default
```

### Main Client API

```javascript
import { RoomServiceClient } from '@chempik1234/room-service-js';

const client = new RoomServiceClient({
  host: 'localhost:50050',
  apiKey: process.env.ROOM_SERVICE_API_KEY,
  secure: false,
  timeout: 5000
});
```

### Methods (Unary/Request-Response)

All methods are async and return promises.

#### Room Management
```javascript
// Create room, returns room ID
const roomId = await client.createRoom({
  max_users: '10',
  game_type: 'chess'
});

// Delete room (owner only)
await client.deleteRoom(roomId, userId);

// List all rooms (returns RoomInfo[])
const rooms = await client.listRooms();
// RoomInfo = { roomId, roomOwnerId, roomOptions }

// Get rooms a specific user is in
const myRooms = await client.getUserActiveRooms('user-123');
// Returns: RoomInfo[] for rooms containing this user
```

#### User Management
```javascript
// Join room (idempotent)
await client.joinRoom(roomId, {
  userId: 'user-123',
  userName: 'Alice',
  metadata: { avatar: 'cat.png' }  // optional
});

// Leave room (idempotent)
await client.leaveRoom(roomId, userId);

// Kick user (owner only)
await client.leaveRoom(roomId, ownerId, kickedUserId);
```

#### Data Operations
```javascript
// SET mode - Replace value
await client.setData(roomId, userId, 'key', 'value');
await client.setData(roomId, userId, 'count', 42);
await client.setData(roomId, userId, 'enabled', true);
await client.setData(roomId, userId, 'list', ['a', 'b']);
await client.setData(roomId, userId, 'obj', { key: 'value' });

// DELETE mode - Remove key
await client.deleteData(roomId, userId, 'key');

// APPEND mode - Add to list
await client.appendToList(roomId, userId, 'list', 'newItem');

// REMOVE mode - Remove from list/map by index/key
await client.removeFromList(roomId, userId, 'list', '0');

// Generic method with mode
await client.setDataMode(roomId, userId, 'key', value, 'SET');
await client.setDataMode(roomId, userId, 'key', null, 'DELETE');
await client.setDataMode(roomId, userId, 'key', value, 'APPEND');
await client.setDataMode(roomId, userId, 'key', null, 'REMOVE', 'index');
```

#### Queries
```javascript
// Get full room snapshot
const snapshot = await client.getRoomSnapshot(roomId, userId);
// Returns: { roomId, roomOptions, data: {}, users: [] }
```

#### Owner Management
```javascript
// Transfer ownership (new owner must be in room)
await client.setOwner(roomId, currentOwnerId, newOwnerId);
```

#### Cleanup
```javascript
await client.close();
```

### Streaming API (Real-Time)

For real-time games and collaborative apps:

```javascript
const stream = await client.openStream();

// Listen to all events
stream.on('event', (event) => {
  console.log('Event type:', event.type);
});

// Listen to specific events
stream.on('RoomCreated', (event) => {
  console.log('Room created:', event.roomId);
});

stream.on('JoinedRoom', (event) => {
  console.log('User joined:', event.user.name, event.user.id);
});

stream.on('LeftRoom', (event) => {
  console.log('User left:', event.kickedUserId || 'voluntary');
});

stream.on('DataEdited', (event) => {
  console.log('Data changed:', event.dataId, event.value, event.mode);
});

stream.on('OwnerChanged', (event) => {
  console.log('New owner:', event.newOwnerId);
});

stream.on('FullRoomSnapshot', (event) => {
  console.log('Full state:', event.data, event.users);
});

stream.on('ErrorMessage', (event) => {
  console.error('Error:', event.error);
});

// Send commands via stream
await stream.createRoom({ game: 'chess' });
await stream.joinRoom(roomId, { userId, userName });
await stream.setData(roomId, userId, 'move', 'e2-e4');
await stream.setOwner(roomId, userId, newOwnerId);
await stream.refreshRoom(roomId, userId);

// Close stream
await stream.close();
```

### Event Types

All events have: `type`, `timestamp`, `roomId`, `userId`

1. **RoomCreated**: `{ roomId, roomOptions }`
2. **RoomDeleted**: `{ deletedRoomId }`
3. **JoinedRoom**: `{ roomId, user: { id, name, metadata } }`
4. **LeftRoom**: `{ roomId, kickedUserId? }`
5. **DataEdited**: `{ roomId, dataId, value?, mode: 'SET'|'DELETE'|'APPEND'|'REMOVE' }`
6. **OwnerChanged**: `{ newOwnerId, ownerHasChanged }`
7. **FullRoomSnapshot**: `{ roomId, data: {}, users: [], roomOptions: {} }`
8. **ErrorMessage**: `{ error }`

### Value Types

Automatic conversion - you don't need to worry about types:

```javascript
// These are all handled automatically
await client.setData(roomId, userId, 'string', 'hello');
await client.setData(roomId, userId, 'int', 42);
await client.setData(roomId, userId, 'float', 3.14);
await client.setData(roomId, userId, 'bool', true);
await client.setData(roomId, userId, 'list', ['a', 'b']);
await client.setData(roomId, userId, 'map', { key: 'value' });
```

For explicit control:
```javascript
import { stringValue, intValue, listValue, mapValue } from '@chempik1234/room-service-js';
await client.setData(roomId, userId, 'key', stringValue('hello'));
await client.setData(roomId, userId, 'key', listValue([stringValue('a')]));
```

### Error Handling

```javascript
import { RoomServiceError } from '@chempik1234/room-service-js';

try {
  await client.createRoom({ max_users: '10' });
} catch (error) {
  if (error instanceof RoomServiceError) {
    console.error(error.message, error.code);

    error.isAuthenticationError();  // code 16
    error.isPermissionError();      // code 7
    error.isNotFoundError();        // code 5
    error.isInvalidArgumentError(); // code 3
  }
}
```

### Common Patterns

#### Pattern 1: Simple Game Room
```javascript
// Create game room
const roomId = await client.createRoom({
  game: 'tic-tac-toe',
  max_players: '2'
});

// Join as player
await client.joinRoom(roomId, {
  userId: 'player-1',
  userName: 'Alice'
});

// Initialize game state
await client.setData(roomId, 'player-1', 'board', Array(9).fill(''));
await client.setData(roomId, 'player-1', 'turn', 'X');
await client.setData(roomId, 'player-1', 'status', 'waiting');
```

#### Pattern 2: Real-Time Updates
```javascript
const stream = await client.openStream();

// Set up event handlers before joining
stream.on('DataEdited', (event) => {
  if (event.dataId === 'board') {
    renderBoard(event.value);
  }
});

stream.on('JoinedRoom', (event) => {
  if (event.user.id !== myUserId) {
    console.log('Opponent joined:', event.user.name);
  }
});

// Then join room
await stream.joinRoom(roomId, { userId, userName });
```

#### Pattern 3: Find Available Games
```javascript
// List all rooms and filter
const rooms = await client.listRooms();
const available = rooms.filter(r =>
  r.roomOptions.game === 'chess' &&
  r.roomOptions.status === 'waiting' &&
  r.roomOptions.private !== 'true'
);

console.log('Available games:', available);

// Or get only rooms a user is in
const myRooms = await client.getUserActiveRooms('user-123');
const myActiveGames = myRooms.filter(r =>
  r.roomOptions.game === 'chess' &&
  r.roomOptions.status !== 'finished'
);
```

#### Pattern 4: Track Player Moves
```javascript
// Add move to history
await client.appendToList(roomId, userId, 'moves', {
  from: 'e2',
  to: 'e4',
  player: 'Alice',
  timestamp: Date.now()
});
```

#### Pattern 5: Detect Game End
```javascript
// Store game state
await client.setData(roomId, userId, 'gameState', {
  status: 'playing',
  winner: null,
  board: [...]
});

// When game ends
await client.setData(roomId, userId, 'gameState', {
  status: 'finished',
  winner: 'player-1',
  board: [...]
});
```

### Data Model Examples

#### Tic-Tac-Toe
```javascript
await client.setData(roomId, userId, 'board', [
  '', '', '',
  '', 'X', '',
  '', '', 'O'
]);
await client.setData(roomId, userId, 'turn', 'X');
await client.setData(roomId, userId, 'players', {
  X: 'player-1',
  O: 'player-2'
});
```

#### Chat
```javascript
await client.setData(roomId, userId, 'messages', [
  { user: 'Alice', text: 'Hello!', time: 1234567890 }
]);
await client.appendToList(roomId, userId, 'messages', {
  user: 'Bob',
  text: 'Hi Alice!',
  time: 1234567891
});
```

#### Chess
```javascript
await client.setData(roomId, userId, 'fen', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
await client.setData(roomId, userId, 'moves', ['e2-e4']);
await client.setData(roomId, userId, 'captured', { white: [], black: [] });
```

### Important Notes for LLMs

1. **All gRPC complexity is hidden** - Users don't need to know about protobuf, metadata, etc.
2. **Auto-conversion** - JS values are automatically converted to RoomService types
3. **Idempotent operations** - `joinRoom` and `leaveRoom` are safe to call multiple times
4. **Owner actions** - `deleteRoom`, `kick user`, `setOwner` require owner permissions
5. **Stream vs Single** - Use streaming for real-time, single commands for simple operations
6. **Event-driven** - In streaming, you receive events for ALL room changes, not just your own

### What NOT to Assume

❌ Don't assume HTTP/WebSocket - this is gRPC
❌ Don't assume browser compatibility - this is Node.js only
❌ Don't assume server-side game logic - SDK is stateless, RoomService just stores/broadcasts
❌ Don't assume authentication is complex - simple API key header
✅ DO assume simple, clean API that handles all complexity

### When Users Ask About...

**Browser support**: Explain this SDK is Node.js only. For browsers, they need a Node.js backend.

**Security**: Explain that RoomService doesn't enforce game logic - clients must implement their own validation.

**Scalability**: RoomService handles the storage/sync, but game logic runs on clients.

**Deployment**: They need to run RoomService (Docker recommended) and their Node.js app.

---

## Quick Reference Card for LLMs

### Instant Client
```javascript
const client = new RoomServiceClient();
```

### Core Operations
```javascript
const roomId = await client.createRoom({ game: 'chess' });
await client.joinRoom(roomId, { userId, userName });
await client.setData(roomId, userId, 'key', value);
const snap = await client.getRoomSnapshot(roomId, userId);
```

### Streaming
```javascript
const stream = await client.openStream();
stream.on('DataEdited', (e) => { /* handle */ });
await stream.setData(roomId, userId, 'key', value);
```

### Data Modes
- SET = replace
- DELETE = remove key
- APPEND = add to list
- REMOVE = remove from list by index

### Events
RoomCreated, RoomDeleted, JoinedRoom, LeftRoom, DataEdited, OwnerChanged, FullRoomSnapshot, ErrorMessage
