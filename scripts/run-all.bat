@echo off
title InsightNote Hybrid Runner
cls
echo ====================================================================
echo             INSIGHTNOTE ALL-IN-ONE HYBRID RUNNER
echo ====================================================================
echo.
echo [1/3] Launching Databases and Admin UIs in Docker...
cd /d "%~dp0\.."
docker compose up -d mongodb mongo-express neo4j qdrant postgres adminer
timeout /t 5 >nul
echo.
echo Mongo Express: http://localhost:8081  user=admin password=pass
echo PostgreSQL UI: http://localhost:8082  system=PostgreSQL server=postgres user=postgres password=password db=insightnote
echo.
echo [2/3] Spawning FastAPI Backend (gpu_env) in a separate window...
start "InsightNote Backend Server" cmd /k "cd backend && C:\Users\nguye\anaconda3\envs\gpu_env\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
echo.
echo [3/3] Launching Next.js Frontend (Docker) in the current window...
echo.
docker compose up --build frontend
echo.
echo ====================================================================
echo InsightNote Stack is closing.
echo ====================================================================
pause
