#!/bin/bash
echo "===================================================="
echo "Starting FastAPI Backend (gpu_env)..."
echo "===================================================="
cd "$(dirname "$0")/../backend"
C:/Users/nguye/anaconda3/envs/gpu_env/python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
