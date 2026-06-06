@echo off
title InsightNote - Normal Start
echo ==============================================================
echo InsightNote - Starting Databases ^& Servers (Data Preserved)...
echo ==============================================================

:: Get current script path and set roots
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

cd /d "%PROJECT_ROOT%"

echo [1/2] Starting PostgreSQL, MongoDB, Neo4j, and Qdrant containers...
docker compose up -d postgres mongodb neo4j qdrant mongo-express adminer

echo [2/2] Starting development servers...
echo Starting Backend server in a new window...
start cmd /k "cd /d "%PROJECT_ROOT%\backend" && conda activate gpu_env && python server.py"

echo Starting Frontend server...
cd /d "%PROJECT_ROOT%\frontend"
npm run dev
