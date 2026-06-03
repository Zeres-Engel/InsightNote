#!/bin/bash
echo "===================================================="
echo "Starting Next.js Frontend in Docker..."
echo "===================================================="
cd "$(dirname "$0")/.."
docker compose up --build frontend
