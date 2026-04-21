@echo off
REM Railway Deployment Script for Windows
REM Deploy all RoomService games to Railway with a single command

echo 🚂 Deploying RoomService Games to Railway...
echo.

REM Check if Railway CLI is installed
where railway >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Railway CLI not found. Installing...
    call npm install -g @railway/cli
)

REM Check if user is logged in
echo 🔐 Checking Railway login status...
railway status || railway login

echo 🚀 Deploying all games...
echo.

REM Deploy all services
railway up

echo.
echo ✅ Deployment complete!
echo.
echo 🎮 Your games are now live:
echo    - Pixel Battle: https://pixel-battle-production.up.railway.app
echo    - Gartic Phone: https://gartic-phone-production.up.railway.app
echo    - Tic-Tac-Toe: https://tic-tac-toe-production.up.railway.app
echo.
echo 🔧 Configure environment variables in Railway dashboard:
echo    ROOMSERVICE_HOST=your-roomservice-host:50052
echo    ROOMSERVICE_API_KEY=your-api-key
echo    NODE_ENV=production
echo.
echo 📊 Monitor your deployments: railway dashboard