#!/bin/bash

echo "🚂 Deploying all games to Railway individually..."
echo ""

# Function to deploy a single game
deploy_game() {
    local game_dir=$1
    local game_name=$2

    echo "🎮 Deploying $game_name..."
    cd "$game_dir"

    # Check if already initialized
    if [ -f ".railway/config/railway.json" ]; then
        echo "   Already initialized, deploying..."
        railway up
    else
        echo "   Initializing new project..."
        railway init
        railway up
    fi

    cd ..
    echo "   ✅ $game_name deployed!"
    echo ""
}

# Deploy each game
deploy_game "tic-tac-toe" "Tic-Tac-Toe"
deploy_game "pixel-battle" "Pixel Battle"
deploy_game "gartic-phone" "Gartic Phone"

echo "🎉 All games deployed to Railway!"
echo ""
echo "Check Railway dashboard for your game URLs"