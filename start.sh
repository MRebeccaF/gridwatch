#!/bin/bash
# GridWatch Single-Command Startup Script
# This starts the backend, which automatically serves the built frontend.

cd "$(dirname "$0")"

echo "=========================================="
echo " Starting GridWatch Control Room..."
echo "=========================================="

# 1. Activate virtual environment if it exists, or create one
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    echo "Installing Python dependencies..."
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# 2. Check if frontend build exists, if not build it
if [ ! -d "frontend/dist" ]; then
    echo "Building frontend assets..."
    cd frontend
    npm install
    npm run build
    cd ..
fi

# 3. Check if an old instance is running on port 5001 and stop it
PORT_PID=$(lsof -ti:5001)
if [ ! -z "$PORT_PID" ]; then
    echo "Port 5001 is busy (PID $PORT_PID). Stopping old process..."
    kill -9 $PORT_PID 2>/dev/null
    sleep 1
fi

echo "=========================================="
echo " GridWatch is online!"
echo " Open your browser at: http://localhost:5001"
echo " Press Ctrl+C in this terminal to stop."
echo "=========================================="

python -m backend.app
