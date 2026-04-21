# 🎮 RoomService Games - Quick Setup Guide

## 🚀 Quick Start

### Option 1: Start All Games at Once
```bash
# Install dependencies first
make install

# Start all games (each on different ports)
make all
```

### Option 2: Start Individual Games
```bash
make tic-tac-toe      # http://localhost:3000
make pixel-battle    # http://localhost:3001
make gartic-phone    # http://localhost:3002
```

## 🔧 Available Make Commands

### Game Management
- `make tic-tac-toe` - Start Tic-Tac-Toe game
- `make pixel-battle` - Start Pixel Battle game
- `make gartic-phone` - Start Gartic Phone game
- `make all` - Start all games at once
- `make stop` - Stop all running games
- `make restart` - Restart all games

### Development
- `make install` - Install dependencies for all games
- `make dev` - Start all games in development mode
- `make clean` - Clean node_modules and build files
- `make test` - Run tests for all games

### Monitoring
- `make status` - Show which game servers are running
- `make health` - Health check for all games
- `make logs` - Show logs from all games

### Deployment
- `make railway` - Deploy all games to Railway

## 📁 Configuration

### Shared Environment Variables
All games use the **root `.env` file** for RoomService configuration:

```bash
ROOMSERVICE_HOST=localhost:50050
ROOMSERVICE_API_KEY=123
NODE_ENV=development
```

### Individual Game Ports
- **Tic-Tac-Toe**: Port 3000
- **Pixel Battle**: Port 3001
- **Gartic Phone**: Port 3002

## 🎯 Game URLs

Once started, access games at:
- http://localhost:3000 - Tic-Tac-Toe
- http://localhost:3001 - Pixel Battle
- http://localhost:3002 - Gartic Phone

## 🚂 Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy all games
make railway
```

## 🛠️ Troubleshooting

### Port Already in Use
```bash
make stop    # Kill all game servers
make all    # Start fresh
```

### Dependencies Issues
```bash
make clean   # Remove node_modules
make install # Reinstall dependencies
```

### Check Status
```bash
make status   # See which servers are running
make health   # Health check all games
```

## 📚 Game Documentation

- **Tic-Tac-Toe**: Basic multiplayer demonstration
- **Pixel Battle**: Advanced drawing with SDK features
- **Gartic Phone**: Drawing/guessing game with scoring

See individual game folders for detailed documentation.