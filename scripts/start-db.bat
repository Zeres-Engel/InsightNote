@echo off
echo ====================================================
echo Starting Persistent Databases (Mongo, Neo4j, Qdrant)
echo ====================================================
cd ..
docker compose up -d mongodb neo4j qdrant
echo Databases are active!
pause
