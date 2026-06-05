#!/bin/bash
clear
echo "===================================================================="
echo "             INSIGHTNOTE ALL-IN-ONE HYBRID RUNNER"
echo "===================================================================="
echo ""
echo "[1/3] Launching Databases and Admin UIs in Docker..."
cd "$(dirname "$0")/.."
docker compose up -d mongodb mongo-express neo4j qdrant postgres adminer
sleep 5
echo ""
echo "Mongo Express: http://localhost:8081  user=admin password=pass"
echo "PostgreSQL UI: http://localhost:8082  system=PostgreSQL server=postgres user=postgres password=password db=insightnote"
echo ""
echo "[2/3] Spawning FastAPI Backend (gpu_env) in a background process..."
cd backend
C:/Users/nguye/anaconda3/envs/gpu_env/python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..
echo "Backend running in background with PID: $BACKEND_PID"
echo ""
echo "[3/3] Launching Next.js Frontend (Docker) in the current terminal..."
echo ""
docker compose up --build frontend

# Clean up background backend process when exiting
kill $BACKEND_PID 2>/dev/null || true
