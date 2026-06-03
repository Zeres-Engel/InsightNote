@echo off
title InsightNote Hybrid Runner
cls
echo ====================================================================
echo             INSIGHTNOTE ALL-IN-ONE HYBRID RUNNER
echo ====================================================================
echo.
echo [1/3] Launching Persistent Databases (MongoDB, Neo4j, Qdrant) in Docker...
docker compose up -d mongodb neo4j qdrant
echo.
echo [2/3] Spawning FastAPI Backend (Python 3.11.5) in a separate window...
start "InsightNote Backend Server" cmd /k "cd backend && C:\Users\nguye\AppData\Local\Programs\Python\Python311\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
echo.
echo [3/3] Launching Next.js Frontend (Docker) in the current window...
echo.
docker compose up --build frontend
echo.
echo ====================================================================
echo InsightNote Stack is closing.
echo ====================================================================
pause
