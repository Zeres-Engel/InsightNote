@echo off
echo ====================================================
echo Starting Next.js Frontend in Docker...
echo ====================================================
cd ..
docker compose up --build frontend
pause
