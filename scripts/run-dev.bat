@echo off
title InsightNote Dev Environment - Clean Reset
echo ==============================================================
echo InsightNote Development Environment - Cleaning ^& Initializing...
echo ==============================================================

:: Get current script path and set roots
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

cd /d "%PROJECT_ROOT%"

echo [1/4] Destroying Docker containers and database volumes...
docker compose down -v --remove-orphans

echo [2/4] Wiping local document store (rag_storage) and server logs...
if exist "rag_storage" rmdir /s /q "rag_storage"
if exist "backend\rag_storage" rmdir /s /q "backend\rag_storage"
if exist "backend\logs" rmdir /s /q "backend\logs"

mkdir "rag_storage"
mkdir "backend\logs"

echo [3/4] Starting fresh PostgreSQL, MongoDB, Neo4j, and Qdrant containers...
docker compose up -d postgres mongodb neo4j qdrant mongo-express adminer

echo [4/4] Starting development servers...
echo Starting Backend server in a new window...
start cmd /k "cd /d "%PROJECT_ROOT%\backend" && conda activate gpu_env && python server.py"

echo Starting Frontend server...
cd /d "%PROJECT_ROOT%\frontend"
npm run dev
