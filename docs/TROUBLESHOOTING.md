# Troubleshooting Guide

Common issues when running InsightNote locally or in Docker.

**Start here first:** [SETUP.md](SETUP.md) · [DOCKER.md](DOCKER.md) · [CONFIG_REFERENCE.md](CONFIG_REFERENCE.md)

---

## Quick diagnostics

```bash
# Backend alive?
curl http://localhost:8000/api/health

# All Docker services up?
docker compose ps

# Backend log (last errors)
tail -n 100 backend/logs/server.log

# Frontend build OK?
cd frontend && npm run build
```

---

## Frontend shows mock / sandbox data

**Symptoms:** Graph shows insurance demo nodes; chat gives preset answers; no real ingestion.

**Causes:**
1. Backend not running
2. Backend on wrong port
3. CORS/network blocked

**Fix:**
```bash
# Start backend
conda activate gpu_env && cd backend && python server.py

# Verify health
curl http://localhost:8000/api/health
# Expected: {"status":"ok","service":"insightnote-backend",...}
```

Check browser console for failed `/api/*` requests. Ensure `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` when using Docker frontend.

---

## LLM / embedding API errors

**Symptoms:** Chat returns empty answers; server log shows 401/403/connection errors; embedding dimension warnings.

**Cause:** `backend/config/config.yaml` profile doesn't match available API keys.

**Fix:**

| config.yaml binding | Required `.env` key |
|---|---|
| `openai` | `OPENAI_API_KEY` |
| `gemini` | `GOOGLE_API_KEY` |

Remember: docker-compose `LLM_BINDING=openai` env var is **ignored** unless YAML references it. Edit `config.yaml` directly.

**Docker + Gemini:** add to `docker-compose.yml`:
```yaml
- GOOGLE_API_KEY=${GOOGLE_API_KEY}
```

See [SETUP.md](SETUP.md) for full profile examples.

---

## Graph empty after upload

**Symptoms:** Source shows `ready` but right panel has no nodes.

**Causes:**
1. Neo4j not running
2. Ingest failed silently (check logs)
3. Wrong notebook selected

**Fix:**
```bash
docker compose up -d neo4j
# Check Neo4j Browser: http://localhost:7474
# Run: MATCH (n) RETURN count(n)
```

Check `backend/logs/server.log` for Neo4j connection errors during ingest.

Refresh graph: switch notebook or reload page after source reaches `ready`.

---

## Pipeline stuck on `processing`

**Symptoms:** Progress bar never reaches `ready`.

**Causes:**
1. MinerU/GPU processing slow or crashed
2. MongoDB doc status not updating
3. LLM unavailable for entity extraction

**Fix:**
```bash
# Check job status
curl http://localhost:8000/api/pipeline/jobs/{job_id}

# Check Mongo doc status
docker exec -it insightnote-mongodb mongosh insightnote --eval "db.getCollectionNames()"
```

Review server log for `Traceback` during `apipeline_process_enqueue_documents`.

Try a simple `.txt` file first to isolate PDF/MinerU issues.

---

## Chat history not saved

**Symptoms:** Messages disappear after refresh (when backend is online).

**Cause:** PostgreSQL unavailable; only localStorage cache works.

**Fix:**
```bash
docker compose up -d postgres
# Verify
curl http://localhost:8082  # Adminer
```

Check `POSTGRES_URI` — use `localhost` when backend runs on host, `postgres` when backend runs in Docker.

---

## `attached to a different loop` (asyncio)

**Symptoms:** Backend crash or hung ingestion under parallel uploads.

**Cause:** asyncio primitives bound to wrong event loop (legacy issue; lazy-init fix in place).

**Fix:** Check `backend/app/core/utils.py` rate limiters use lazy initialization. Restart backend. Reduce parallel upload count during debugging.

---

## WebGL graph: stale highlights / floating particles

**Symptoms:** Old cyan/emerald glow persists after Reset View or new query.

**Fix:** Ensure `KnowledgeGraphPanel.tsx` calls `fgRef.current.refresh()` in `useEffect` on `highlightPath` change. Click **Reset View** in UI.

See [GRAPH_VISUALIZATION.md](GRAPH_VISUALIZATION.md).

---

## Port already in use

**Symptoms:** `docker compose up` fails; or `EADDRINUSE` on 3000/8000.

**Fix:**
```bash
# Find process on Windows
netstat -ano | findstr :8000
netstat -ano | findstr :3000

# Or change ports in docker-compose.yml / vite.config.ts
```

---

## pytest failures in wrong environment

**Symptoms:** Import errors, CUDA/GPU warnings, MinerU failures in tests.

**Fix:** Always use `gpu_env`:
```bash
conda activate gpu_env
cd backend && pytest tests/ -v
```

---

## Docker volume / stale data issues

**Symptoms:** Old documents appear after "fresh" start; notebook delete didn't fully clear.

**Fix:**
```bash
docker compose down -v
rm -rf backend/rag_storage/*
mkdir -p backend/rag_storage backend/logs
```

See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for per-database reset options.

---

## Authentication errors (`401`)

**Symptoms:** API returns 401 on `/health` or other routes.

**Cause:** `ZERAG_API_KEY` set in `.env` but frontend not sending header.

**Fix:** Either unset `ZERAG_API_KEY` for local dev, or add auth header in `api.ts` requests.

Root `/health` (not `/api/health`) requires auth when key is configured.

---

## MinerU / PDF parsing slow

**Symptoms:** `document_understanding` step takes minutes.

**Expected:** MinerU is GPU-intensive. `server.py` forces CPU in Docker by default.

**Fix for speed:** Run backend locally in `gpu_env` with CUDA available instead of full Docker backend.

---

## Still stuck?

1. Collect `backend/logs/server.log` (last 200 lines)
2. Note which workflow: Docker full stack vs hybrid local dev
3. Note `config.yaml` LLM binding and which API keys are set (not the key values)
4. Check [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) to verify data landed in expected DB
