#!/bin/bash
echo "Multiplayer Game Server Startup"
echo "==================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "ERROR: Node.js is not installed."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

echo "Node.js found"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo ""
echo "Starting Game server..."
echo ""
node ActionNetServer.js 8000 -1