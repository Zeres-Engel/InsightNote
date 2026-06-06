#!/bin/bash
# run-dev.sh - Clean Reset & Start InsightNote Dev Environment

echo "=============================================================="
echo "InsightNote Development Environment - Cleaning & Initializing..."
echo "=============================================================="

# Get the directory of the script and resolve paths relative to it
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

cd "$PROJECT_ROOT"

# 1. Stop containers and destroy all persistent volumes (Wipe DBs)
echo "[1/4] Destroying Docker containers and database volumes..."
docker compose down -v --remove-orphans

# 2. Clean up local rag_storage and logs
echo "[2/4] Wiping local document store (rag_storage) and server logs..."
rm -rf "$PROJECT_ROOT/rag_storage"
rm -rf "$PROJECT_ROOT/backend/rag_storage"
rm -rf "$PROJECT_ROOT/backend/logs"

mkdir -p "$PROJECT_ROOT/rag_storage"
mkdir -p "$PROJECT_ROOT/backend/logs"

# 3. Start fresh clean databases
echo "[3/4] Starting fresh PostgreSQL, MongoDB, Neo4j, and Qdrant containers..."
docker compose up -d --build

# 4. Start development servers
echo "[4/4] Starting development servers..."
echo "Starting Backend server in background..."
cd "$PROJECT_ROOT/backend"
# Start backend using python from conda/gpu_env if available, or fall back to default python
if [ -f "$HOME/anaconda3/envs/gpu_env/bin/python" ]; then
    "$HOME/anaconda3/envs/gpu_env/bin/python" server.py &
elif [ -f "C:/Users/nguye/anaconda3/envs/gpu_env/python.exe" ]; then
    "C:/Users/nguye/anaconda3/envs/gpu_env/python.exe" server.py &
else
    python server.py &
fi

echo "Starting Frontend server..."
cd "$PROJECT_ROOT/frontend"
npm run dev
