# RoomService Games

Example multiplayer games built with [RoomService JS SDK](https://www.npmjs.com/package/@chempik1234/room-service-js).

## 🎮 Games

### 1. Tic-Tac-Toe
Classic two-player game demonstrating basic RoomService integration.
- **Port**: 3000
- **Features**: Basic multiplayer, real-time updates

### 2. Pixel Battle 🎨
Real-time multiplayer canvas drawing game with full SDK features.
- **Port**: 3001
- **Features**:
  - Room filtering (only shows pixel battle rooms)
  - Kick functionality (room owner can kick players)
  - Room deletion (owner can delete room)
  - Detailed room info (player counts, canvas status)
  - **Batched drawing updates** (~90% network reduction)
  - Proper disconnect handling

### 3. Gartic Phone 🎯
Drawing and guessing game with scoring system.
- **Port**: 3002
- **Features**:
  - One player draws, others guess
  - Scoring system (time bonus + correct guesses)
  - 3-minute rounds with 30s drawing time
  - Max 5 players per game
  - Rotating drawers
  - Batched drawing updates

## 🚀 Quick Start

### 🏠 Local Development
```bash
# Install dependencies
npm install

# Start a game
cd pixel-battle    # or gartic-phone, tic-tac-toe
npm start
```

### 🚂 Railway Deployment (Recommended)

**Simple One-Command Deployment:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy all games with one command!
railway up
```

**That's it!** All 3 games deploy automatically with:
- ✅ Free tier covers all games
- ✅ Automatic SSL certificates
- ✅ Real-time connections work perfectly
- ✅ Auto-deploys on every git push

📖 **See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) for detailed guide**

### 💻 Local SDK Development
```bash
# In the SDK directory
cd room-service-js
npm link

# In each game directory
cd ../room-service-games/pixel-battle
npm link @chempik1234/room-service-js
npm install
npm start
```

## 📋 Requirements

- Node.js >= 16.0.0
- RoomService server running
- Environment variables configured (see .env.example in each game folder)

## 🔧 Configuration

Each game has its own `.env` file:

```bash
# RoomService Configuration
ROOMSERVICE_HOST=localhost:50050
ROOMSERVICE_API_KEY=123

# Production example:
# ROOMSERVICE_HOST=roomky.chickenkiller.com:50052
# ROOMSERVICE_API_KEY=rs_live_tenant-20s-b15968f3_dbb54fa5-e970-4b0e-a044-41313bf79dee

# Server Configuration
PORT=3001
NODE_ENV=development
```

## 🎯 Game Features

### Pixel Battle
- ✅ **Room Management**: Create, join, filter rooms
- ✅ **User Management**: Kick players, delete rooms
- ✅ **Real-time Drawing**: Batched canvas updates
- ✅ **Disconnect Handling**: Proper cleanup on browser close
- ✅ **Performance**: Optimized network calls

### Gartic Phone
- ✅ **Game Phases**: Waiting → Drawing → Guessing → Results
- ✅ **Scoring System**: Time-based + correct guess bonuses
- ✅ **Role-based UI**: Different interfaces for drawer/guessers
- ✅ **Word Selection**: 40 drawing words included
- ✅ **Smart Synchronization**: Event-driven game flow

## 🔗 SDK Features Used

All games demonstrate comprehensive RoomService SDK usage:

- ✅ `listRooms()` - Get all rooms with filtering
- ✅ `getRoomSnapshot()` - Real-time room state
- ✅ `joinRoom()` - Join with user metadata
- ✅ `leaveRoom()` - Leave with optional kick parameter
- ✅ `deleteRoom()` - Room deletion
- ✅ `setData()` - Set room data with batched updates
- ✅ `deleteData()` - Clear room data
- ✅ Event handling - Real-time game state updates
- ✅ Stream management - Efficient data synchronization

## 📱 API Endpoints

Each game server provides REST APIs:

### Common Endpoints
- `GET /health` - Health check
- `GET /api/rooms` - List all game rooms
- `POST /api/rooms` - Create new room
- `POST /api/leave` - Leave room (for browser close cleanup)

### Pixel Battle Specific
- `GET /api/rooms/:roomId` - Get room snapshot (visitor info)
- `POST /api/rooms/:roomId/kick` - Kick player (owner only)
- `DELETE /api/rooms/:roomId` - Delete room (owner only)

### Gartic Phone Specific
- `GET /api/word` - Get random word for drawing
- `POST /api/rooms/:roomId/start` - Start game
- `POST /api/rooms/:roomId/guess` - Submit guess
- `GET /api/rooms/:roomId/state` - Get current game state

## 🎨 Performance Optimizations

### Batched Drawing Updates
Both drawing games use batched canvas updates:
- **Before**: 1 network call per line drawn
- **After**: 1 network call per 100ms (batch of lines)
- **Result**: ~90% reduction in network traffic
- **Implementation**: Queue system with interval-based sending

```javascript
// Batch drawing (instead of per-line)
drawQueue.push({ fromX, fromY, toX, toY, color, size });
setInterval(sendBatchedDrawData, 100);
```

## 🚢 Deployment

### 🚂 **Railway Deployment (Recommended)**

**Why Railway?**
- ✅ Full container hosting (not serverless)
- ✅ Long-running game servers
- ✅ WebSocket support for real-time multiplayer
- ✅ Free tier covers all 3 games
- ✅ Automatic GitHub deployments

**Quick Deploy:**
1. Push repository to GitHub
2. Deploy via [railway.app](https://railway.app)
3. Set environment variables
4. Games auto-deploy on every push

📖 **Full Guide**: [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

### 🏠 **Local Development**

**Environment Setup:**
1. Copy `.env.example` to `.env`
2. Update `ROOMSERVICE_HOST` and `ROOMSERVICE_API_KEY`
3. Set appropriate `PORT` for each game

**Starting Games:**
```bash
# Terminal 1: Pixel Battle
cd pixel-battle && npm start

# Terminal 2: Gartic Phone
cd gartic-phone && npm start

# Terminal 3: Tic-Tac-Toe
cd tic-tac-toe && npm start
```

### 📦 **Production Deployment**

**Option 1: Railway (Recommended)**
- Auto-deploys from GitHub
- Handles SSL certificates
- Built-in monitoring
- Free tier available

**Option 2: Traditional Hosting**
1. Build the SDK: `cd room-service-js && npm run build`
2. Publish to npm: `npm publish`
3. Update game dependencies: `npm install @chempik1234/room-service-js@latest`
4. Deploy to any Node.js hosting (DigitalOcean, AWS, etc.)

## 📚 Documentation

- **SDK README**: See `room-service-js/README.md`
- **API Documentation**: See `room-service-js/docs/`
- **Examples**: Each game folder contains complete working examples

## 🤝 Contributing

Contributions are welcome! The games demonstrate:
- Real-time multiplayer functionality
- SDK feature implementation
- Performance optimization techniques
- Game state management
- User interface design

## 📄 License

MIT

## 🙏 Acknowledgments

Built with [RoomService JS SDK](https://www.npmjs.com/package/@chempik1234/room-service-js) - A JavaScript/TypeScript SDK for RoomService gRPC API.