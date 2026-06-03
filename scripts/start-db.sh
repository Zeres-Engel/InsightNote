#!/bin/bash
echo "===================================================="
echo "Starting Persistent Databases (Mongo, Neo4j, Qdrant)"
echo "===================================================="
cd "$(dirname "$0")/.."
docker compose up -d mongodb neo4j qdrant
echo "Databases are active!"
