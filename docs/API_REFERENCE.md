# API Reference

Complete API reference for the RoomService JavaScript SDK.

## RoomServiceClient

### Constructor

```javascript
new RoomServiceClient(options?: RoomServiceClientOptions)
```

**Options:**
- `host?: string` - RoomService address (default: `localhost:50050`)
- `apiKey?: string` - API key (default: from `ROOM_SERVICE_API_KEY` env or `'123'`)
- `secure?: boolean` - Use TLS (default: `false`)
- `timeout?: number` - Request timeout in ms (default: `5000`)

---

### Room Management

#### createRoom

```javascript
async createRoom(roomOptions?: { [key: string]: string }, userId?: string): Promise<string>
```

Create a new room and return its ID.

**Example:**
```javascript
const roomId = await client.createRoom({
  game_type: 'chess',
  max_users: '2'
});
```

---

#### deleteRoom

```javascript
async deleteRoom(roomId: string, userId: string): Promise<void>
```

Delete a room (owner only).

**Example:**
```javascript
await client.deleteRoom(roomId, 'owner-user-id');
```

---

#### listRooms

```javascript
async listRooms(): Promise<RoomInfo[]>
```

List all rooms without user lists or internal data.

**Returns:**
```javascript
Array<{
  roomId: string;
  roomOwnerId: string;
  roomOptions: { [key: string]: string };
}>
```

**Example:**
```javascript
const rooms = await client.listRooms();
const chessRooms = rooms.filter(r => r.roomOptions.game_type === 'chess');
```

---

#### getUserActiveRooms

```javascript
async getUserActiveRooms(userId: string): Promise<RoomInfo[]>
```

List rooms that a specific user is currently in.

**Parameters:**
- `userId: string` - The user ID to filter rooms by

**Returns:**
```javascript
Array<{
  roomId: string;
  roomOwnerId: string;
  roomOptions: { [key: string]: string };
}>
```

**Example:**
```javascript
// Get all rooms a user is in
const myRooms = await client.getUserActiveRooms('player-1');
console.log('Player 1 is in:', myRooms.length, 'rooms');

// Find specific game types
const myChessGames = myRooms.filter(r =>
  r.roomOptions.game_type === 'chess'
);
```

---

### User Management

#### joinRoom

```javascript
async joinRoom(roomId: string, options: JoinOptions): Promise<RoomSnapshot | null>
```

Join a room (idempotent - safe to call multiple times).

**Options:**
```javascript
{
  userId: string;
  userName: string;
  metadata?: { [key: string]: string };
}
```

**Example:**
```javascript
await client.joinRoom(roomId, {
  userId: 'player-1',
  userName: 'Alice',
  metadata: { avatar: 'cat.png' }
});
```

---

#### leaveRoom

```javascript
async leaveRoom(roomId: string, userId: string, kickedUserId?: string): Promise<void>
```

Leave a room or kick another user (owner only).

**Example:**
```javascript
// Leave room
await client.leaveRoom(roomId, 'my-user-id');

// Kick another user
await client.leaveRoom(roomId, 'owner-id', 'trouble-maker-id');
```

---

### Data Operations

#### setData

```javascript
async setData(roomId: string, userId: string, dataId: string, value: any): Promise<void>
```

Set data (SET mode - replaces entire value).

**Example:**
```javascript
await client.setData(roomId, userId, 'status', 'active');
await client.setData(roomId, userId, 'score', 100);
await client.setData(roomId, userId, 'board', ['', '', 'X', ...]);
```

---

#### setDataMode

```javascript
async setDataMode(
  roomId: string,
  userId: string,
  dataId: string,
  value: any,
  mode: 'SET' | 'DELETE' | 'APPEND' | 'REMOVE',
  itemIndex?: string
): Promise<void>
```

Set data with specific mode.

**Modes:**
- `SET` - Replace entire value or item
- `DELETE` - Remove data key
- `APPEND` - Add to list
- `REMOVE` - Remove from list/map by index/key

**Example:**
```javascript
await client.setDataMode(roomId, userId, 'status', 'active', 'SET');
await client.setDataMode(roomId, userId, 'old', null, 'DELETE');
await client.setDataMode(roomId, userId, 'list', 'item', 'APPEND');
await client.setDataMode(roomId, userId, 'list', null, 'REMOVE', '0');
```

---

#### deleteData

```javascript
async deleteData(roomId: string, userId: string, dataId: string): Promise<void>
```

Delete data key.

**Example:**
```javascript
await client.deleteData(roomId, userId, 'tempData');
```

---

#### appendToList

```javascript
async appendToList(roomId: string, userId: string, dataId: string, value: any): Promise<void>
```

Append value to a list.

**Example:**
```javascript
await client.appendToList(roomId, userId, 'moves', 'e2-e4');
```

---

#### removeFromList

```javascript
async removeFromList(roomId: string, userId: string, dataId: string, itemIndex: string): Promise<void>
```

Remove item from list or map by index/key.

**Example:**
```javascript
await client.removeFromList(roomId, userId, 'players', '0');
```

---

### Queries

#### getRoomSnapshot

```javascript
async getRoomSnapshot(roomId: string, userId?: string): Promise<RoomSnapshot>
```

Get complete room state.

**Returns:**
```javascript
{
  roomId: string;
  roomOptions: { [key: string]: string };
  data: { [key: string]: any };
  users: Array<{
    id: string;
    name: string;
    metadata: { [key: string]: string };
  }>;
}
```

**Example:**
```javascript
const snapshot = await client.getRoomSnapshot(roomId);
console.log('Users:', snapshot.users);
console.log('Data:', snapshot.data);
```

---

### Owner Management

#### setOwner

```javascript
async setOwner(roomId: string, userId: string, newOwnerId: string): Promise<void>
```

Transfer ownership to another user (must be in room).

**Example:**
```javascript
await client.setOwner(roomId, 'current-owner', 'new-owner');
```

---

### Streaming

#### openStream

```javascript
async openStream(): Promise<RoomServiceStream>
```

Open bidirectional stream for real-time updates.

---

## RoomServiceStream

### Event Listeners

#### on

```javascript
stream.on(eventType: string, handler: (event: any) => void): void
```

Register event handler.

**Event Types:**
- `'event'` - All events
- `'RoomCreated'`
- `'RoomDeleted'`
- `'JoinedRoom'`
- `'LeftRoom'`
- `'DataEdited'`
- `'OwnerChanged'`
- `'FullRoomSnapshot'`
- `'ErrorMessage'`

**Example:**
```javascript
stream.on('DataEdited', (event) => {
  console.log(event.dataId, event.value, event.mode);
});
```

---

#### off

```javascript
stream.off(eventType: string, handler: (event: any) => void): void
```

Remove event handler.

---

### Stream Commands

```javascript
// Create room
await stream.createRoom(roomOptions, userId?)

// Delete room
await stream.deleteRoom(roomId, userId)

// Join room
await stream.joinRoom(roomId, { userId, userName, metadata? })

// Leave room
await stream.leaveRoom(roomId, userId, kickedUserId?)

// Set data
await stream.setData(roomId, userId, dataId, value, mode?, itemIndex?)

// Set owner
await stream.setOwner(roomId, userId, newOwnerId)

// Refresh snapshot
await stream.refreshRoom(roomId, userId?)

// Close stream
await stream.close()
```

---

## Value Helpers

Functions for explicit type control:

```javascript
import {
  stringValue,
  intValue,
  floatValue,
  boolValue,
  listValue,
  mapValue
} from '@chempik1234/room-service-js';

stringValue('hello')
intValue(42)
floatValue(3.14)
boolValue(true)
listValue([stringValue('a'), stringValue('b')])
mapValue({ key: stringValue('value') })
```

---

## Error Handling

```javascript
import { RoomServiceError } from '@chempik1234/room-service-js';

try {
  await client.createRoom({ max_users: '10' });
} catch (error) {
  if (error instanceof RoomServiceError) {
    error.isAuthenticationError()  // Code 16
    error.isPermissionError()      // Code 7
    error.isNotFoundError()        // Code 5
    error.isInvalidArgumentError() // Code 3
  }
}
```

---

## Types

### RoomInfo
```javascript
{
  roomId: string;
  roomOwnerId: string;
  roomOptions: { [key: string]: string };
}
```

### RoomSnapshot
```javascript
{
  roomId: string;
  roomOptions: { [key: string]: string };
  data: { [key: string]: any };
  users: Array<{
    id: string;
    name: string;
    metadata: { [key: string]: string };
  }>;
}
```

### Event Types

All events have: `type`, `timestamp`, `roomId`, `userId`

#### RoomCreated
```javascript
{ roomId, roomOptions }
```

#### RoomDeleted
```javascript
{ deletedRoomId }
```

#### JoinedRoom
```javascript
{ roomId, user: { id, name, metadata } }
```

#### LeftRoom
```javascript
{ roomId, kickedUserId? }
```

#### DataEdited
```javascript
{ roomId, dataId, value?, mode: 'SET'|'DELETE'|'APPEND'|'REMOVE' }
```

#### OwnerChanged
```javascript
{ newOwnerId, ownerHasChanged }
```

#### FullRoomSnapshot
```javascript
{ roomId, data: {}, users: [], roomOptions: {} }
```

#### ErrorMessage
```javascript
{ error }
```
