# Contributing to InsightNote

Guidelines for developing, testing, and integrating changes.

---

## Branch workflow

| Branch | Purpose |
|---|---|
| `develop` | **All active development** — feature work, bug fixes, docs |
| `release` | Staging and pre-release validation |
| `main` | Production-ready releases only |

Flow: `develop` → `release` → `main`

Do **not** create git tags or releases unless explicitly requested by the project owner.

---

## Before you start

1. Read [docs/SETUP.md](docs/SETUP.md) — environment and LLM configuration
2. Read [AGENTS.md](AGENTS.md) — coding rules for UI, sandbox mode, and graph highlights
3. Work on the `develop` branch

---

## Local development setup

### Recommended (hybrid)

```bash
cp .env.example .env
# Edit backend/config/config.yaml for your LLM profile

docker compose up -d postgres mongodb neo4j qdrant
conda activate gpu_env
cd backend && python server.py

# Separate terminal
cd frontend && npm run dev
```

Windows shortcut: `scripts/run-dev.bat`

### Full Docker

```bash
docker compose up -d --build
```

See [docs/DOCKER.md](docs/DOCKER.md).

---

## Making changes

### Frontend

- All API calls go through `frontend/src/lib/api.ts` — never add direct DB calls
- Match types in `frontend/src/lib/types.ts`
- Keep sandbox fallback in `mock-data.ts` working when backend is down
- Graph highlights: cyan (query), emerald (ingest); call `fgRef.current.refresh()` on highlight change
- Never expose raw IDs (`doc-`, `chunk-`, `job_`) in UI copy

### Backend

- Primary API router: `backend/app/api/routers/insightnote_routes.py`
- Config changes go in `backend/config/config.yaml` — not hardcoded in routes
- Graceful degradation when DB is offline — no unhandled 500s for missing Neo4j/Qdrant
- Strip internal identifiers from API responses and progress messages

### Documentation

- Update relevant docs when changing API shapes, config keys, or pipeline steps
- [docs/SETUP.md](docs/SETUP.md) is the configuration source of truth
- [frontend/docs/API_CONTRACT.md](frontend/docs/API_CONTRACT.md) must match actual endpoints

---

## Pre-push checklist

All items must pass before pushing to `develop`:

```bash
# 1. Frontend build (TypeScript + Vite)
cd frontend && npm run build

# 2. Backend tests (gpu_env required)
conda activate gpu_env
cd backend && pytest tests/ -v
```

Taskfile shortcuts:

```bash
task app:lint-frontend    # npm run build
task test:all             # pytest tests/ -v
task lint:backend         # python compileall
```

---

## Code style

- **Minimal diffs** — change only what the task requires
- **Match existing patterns** — read surrounding code before adding abstractions
- **No drive-by refactors** — don't rename or reformat unrelated files
- **Comments** — only for non-obvious business logic
- **Tests** — add only when they cover meaningful behavior; don't test the obvious

---

## Multi-agent coordination

This project frequently runs parallel AI agents. Before deep edits:

1. Check for concurrent changes in active files
2. Use Grapuco MCP tools for symbol search and impact analysis (see [AGENTS.md](AGENTS.md))
3. Never blindly revert another agent's working code
4. Run full build + pytest after merging overlapping changes

---

## Commit messages

Use clear, concise messages focused on **why**:

```
fix: align pipeline step names in API responses with frontend polling

docs: add DATABASE_SCHEMA reference for multi-notebook isolation
```

Only commit when explicitly asked.

---

## Documentation map

| Doc | When to update |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | New env vars, setup steps, LLM profiles |
| [docs/CONFIG_REFERENCE.md](docs/CONFIG_REFERENCE.md) | New config.yaml keys |
| [frontend/docs/API_CONTRACT.md](frontend/docs/API_CONTRACT.md) | New/changed API endpoints |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Schema or isolation changes |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | New common failure modes |
| [AGENTS.md](AGENTS.md) | Agent coding rules changes |

---

## Getting help

1. [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
2. `backend/logs/server.log`
3. http://localhost:8000/docs (Swagger)
