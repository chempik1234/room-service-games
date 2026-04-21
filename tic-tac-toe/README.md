# Tic-Tac-Toe Demo

A real-time multiplayer tic-tac-toe game built with the RoomService JavaScript SDK.

## Features

- 2-player real-time gameplay
- Automatic turn tracking
- Win/draw detection
- Replayable (reset game)
- Simple, clean UI

## Setup

### Prerequisites

1. Node.js >= 16.0.0
2. RoomService running on `localhost:50050`

### Start RoomService

If you have the RoomService project:

```bash
cd /path/to/RoomService
task up
```

### Install Dependencies

```bash
cd examples/tic-tac-toe
npm install
```

### Run the Demo

```bash
npm start
```

The game will be available at `http://localhost:3000`

## How It Works

### Data Model

The game stores the following data in the room:

```javascript
{
  board: ['', '', '', '', '', '', '', '', ''],  // 3x3 board
  currentPlayer: 'X',                          // Whose turn
  gameStatus: 'waiting',                       // waiting, playing, finished
  winner: null,                                // 'X', 'O', or null
  players: {
    X: { id: '...', name: 'Alice' },
    O: { id: '...', name: 'Bob' }
  }
}
```

### Game Flow

1. **Create or Join Room**
   - Player 1 creates a new room (becomes X)
   - Player 2 joins with the Room ID (becomes O)

2. **Gameplay**
   - Players take turns clicking cells
   - Each move updates the `board` data
   - `currentPlayer` switches after each move
   - Win/draw is detected automatically

3. **Game End**
   - When a player wins or it's a draw, `gameStatus` becomes 'finished'
   - Players can click "Reset Game" to play again

### API Endpoints

The server provides REST endpoints that use the RoomService SDK:

- `POST /api/room/create` - Create a new room
- `POST /api/room/:roomId/join` - Join an existing room
- `GET /api/room/:roomId` - Get room state
- `POST /api/room/:roomId/move` - Make a move
- `POST /api/room/:roomId/reset` - Reset the game

## Architecture

```
Browser (HTML/JS)
    ↓ HTTP
Node.js Server (Express)
    ↓ gRPC
RoomService (Go)
```

The Node.js server acts as a bridge between the browser and RoomService, since the SDK is Node.js-only.

## Code Highlights

### Creating a Room

```typescript
import { RoomServiceClient } from 'room-service-js';

const client = new RoomServiceClient({
  host: 'localhost:50050',
  apiKey: process.env.ROOM_SERVICE_API_KEY
});

const roomId = await client.createRoom({
  game: 'tic-tac-toe',
  max_players: '2'
});

await client.joinRoom(roomId, {
  userId: 'player-1',
  userName: 'Alice'
});

// Initialize game state
await client.setData(roomId, userId, 'board', Array(9).fill(''));
await client.setData(roomId, userId, 'currentPlayer', 'X');
```

### Making a Move

```typescript
// Get current state
const snapshot = await client.getRoomSnapshot(roomId, userId);
let board = snapshot.data.board;

// Make move
board[index] = symbol;

// Check for win
const winner = checkWin(board);
if (winner) {
  await client.setData(roomId, userId, 'gameStatus', 'finished');
  await client.setData(roomId, userId, 'winner', winner);
} else {
  await client.setData(roomId, userId, 'board', board);
  await client.setData(roomId, userId, 'currentPlayer', symbol === 'X' ? 'O' : 'X');
}
```

### Real-Time Updates (with Streaming)

For true real-time updates, you would use streaming:

```typescript
const stream = await client.openStream();

stream.on('DataEdited', (event) => {
  if (event.dataId === 'board') {
    updateBoardUI(event.value);
  }
});

await stream.joinRoom(roomId, { userId, userName });
await stream.setData(roomId, userId, 'move', { index, symbol });
```

## Future Improvements

- [ ] Add WebSocket support for true real-time updates
- [ ] Add player matchmaking (list available rooms)
- [ ] Add game history/replay
- [ ] Add player rankings
- [ ] Add chat system
- [ ] Add custom board sizes

## License

MIT
