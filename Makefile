.PHONY: help start stop restart install clean

# Default target
help:
	@echo "🎮 RoomService Games - Available Commands:"
	@echo ""
	@echo "Individual Games:"
	@echo "  make tic-tac-toe     - Start Tic-Tac-Toe (port 3000)"
	@echo "  make pixel-battle   - Start Pixel Battle (port 3001)"
	@echo "  make gartic-phone   - Start Gartic Phone (port 3002)"
	@echo ""
	@echo "Multiple Games:"
	@echo "  make all            - Start all games at once"
	@echo "  make games          - Start all games (same as all)"
	@echo ""
	@echo "Utilities:"
	@echo "  make stop           - Stop all game servers"
	@echo "  make restart        - Restart all game servers"
	@echo "  make install        - Install dependencies for all games"
	@echo "  make clean          - Clean node_modules and build files"
	@echo "  make status         - Show running games"
	@echo "  make health         - Health check all games"
	@echo ""
	@echo "Development:"
	@echo "  make dev            - Start all games in development mode"
	@echo "  make logs           - Show logs from all games"
	@echo ""
	@echo "Railway Deployment:"
	@echo "  make railway        - Deploy to Railway (railway up)"

# Individual games
tic-tac-toe:
	@echo "🎯 Starting Tic-Tac-Toe..."
	@cd tic-tac-toe && npm start

pixel-battle:
	@echo "🎨 Starting Pixel Battle..."
	@cd pixel-battle && npm start

gartic-phone:
	@echo "🎭 Starting Gartic Phone..."
	@cd gartic-phone && npm start

# Start all games
all: tic-tac-toe pixel-battle gartic-phone
	@echo "✅ All games started!"

games: all

# Development mode
dev:
	@echo "🔧 Starting all games in development mode..."
	@cd tic-tac-toe && npm run dev &
	@cd pixel-battle && npm run dev &
	@cd gartic-phone && npm run dev &
	@echo "✅ All games started in development mode!"

# Stop all games
stop:
	@echo "🛑 Stopping all game servers..."
	@taskkill /F /IM node.exe 2>nul || echo "No game servers running"
	@echo "✅ All game servers stopped"

# Restart all games
restart: stop all
	@echo "🔄 Restarting all games..."

# Install dependencies
install:
	@echo "📦 Installing dependencies for all games..."
	@cd tic-tac-toe && npm install --silent
	@cd pixel-battle && npm install --silent
	@cd gartic-phone && npm install --silent
	@echo "✅ Dependencies installed!"

# Clean build files
clean:
	@echo "🧹 Cleaning build files..."
	@rm -rf tic-tac-toe/node_modules
	@rm -rf pixel-battle/node_modules
	@rm -rf gartic-phone/node_modules
	@echo "✅ Clean completed!"

# Show running games
status:
	@echo "📊 Running game servers:"
	@netstat -ano | findstr ":3000\|:3001\|:3002" | findstr "LISTENING" || echo "No game servers running"

# Show logs
logs:
	@echo "📋 Recent logs from all games:"
	@echo "Tic-Tac-Toe logs:"
	@tail -f tic-tac-toe/*.log 2>/dev/null || echo "No logs found"
	@echo "Pixel Battle logs:"
	@tail -f pixel-battle/*.log 2>/dev/null || echo "No logs found"
	@echo "Gartic Phone logs:"
	@tail -f gartic-phone/*.log 2>/dev/null || echo "No logs found"

# Railway deployment
railway:
	@echo "🚂 Deploying to Railway..."
	@railway up

# Health check
health:
	@echo "🏥 Health check for all games:"
	@curl -s http://localhost:3000/health && echo "✅ Tic-Tac-Toe: Healthy" || echo "❌ Tic-Tac-Toe: Down"
	@curl -s http://localhost:3001/health && echo "✅ Pixel Battle: Healthy" || echo "❌ Pixel Battle: Down"
	@curl -s http://localhost:3002/health && echo "✅ Gartic Phone: Healthy" || echo "❌ Gartic Phone: Down"