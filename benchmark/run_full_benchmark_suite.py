#!/usr/bin/env python3
"""
Run the full InsightNote benchmark suite and regenerate all charts.

Usage (gpu_env, backend + DBs running):
    conda activate gpu_env
    python scripts/benchmark/run_full_benchmark_suite.py

Optional:
    python scripts/benchmark/run_full_benchmark_suite.py --skip-ingest
    python scripts/benchmark/run_full_benchmark_suite.py --ingest-only
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = PROJECT_ROOT / "scripts/benchmark"

sys.path.insert(0, str(SCRIPTS))
from http_utils import ensure_notebook, post_json, wait_for_health, wait_for_notebook_ready


def run_step(label: str, cmd: list[str], env: dict | None = None) -> bool:
    print(f"\n{'=' * 60}\n{label}\n{'=' * 60}")
    merged = os.environ.copy()
    if env:
        merged.update(env)
    proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), env=merged)
    if proc.returncode != 0:
        print(f"WARNING: {label} exited with code {proc.returncode}")
        return False
    return True


def ingest_fixture_note(base_url: str, notebook_id: str, api_key: str | None) -> None:
    """Quick text ingest so query benchmarks have indexed content."""
    fixture = PROJECT_ROOT / "backend/tests/fixtures/inputs/sample_note.txt"
    if not fixture.exists():
        return
    content = fixture.read_text(encoding="utf-8")
    url = f"{base_url.rstrip('/')}/api/notebooks/{notebook_id}/sources/note"
    payload = {"title": "Insurance Benchmark Note", "content": content}
    try:
        post_json(url, payload, api_key, timeout=180)
        print(f"Seeded notebook {notebook_id} with sample_note.txt")
        if wait_for_notebook_ready(base_url, notebook_id, api_key, timeout_s=240):
            print("Notebook index ready for query benchmarks")
        else:
            print("Warning: notebook not ready within timeout; query scores may be low")
    except Exception as exc:
        print(f"Could not seed note fixture: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.getenv("BENCHMARK_BASE_URL", "http://localhost:8000"))
    parser.add_argument("--notebook", default=os.getenv("BENCHMARK_NOTEBOOK_ID", "auto"))
    parser.add_argument("--api-key", default=os.getenv("ZERAG_API_KEY"))
    parser.add_argument("--skip-ingest", action="store_true")
    parser.add_argument("--ingest-only", action="store_true")
    parser.add_argument("--rounds", type=int, default=3)
    args = parser.parse_args()

    if not wait_for_health(args.base_url):
        raise SystemExit("Backend not reachable. Start server first.")

    notebook_id = ensure_notebook(
        args.base_url, args.notebook, "Benchmark Suite", args.api_key
    )
    print(f"Benchmark notebook: {notebook_id}")

    py = sys.executable
    common = [
        "--base-url",
        args.base_url,
        "--notebook",
        notebook_id,
    ]
    child_env = {"BENCHMARK_NOTEBOOK_ID": notebook_id}

    if not args.skip_ingest and not args.ingest_only:
        ingest_fixture_note(args.base_url, notebook_id, args.api_key)

    if not args.skip_ingest:
        run_step(
            "MinerU parallel PDF ingest benchmark",
            [py, str(SCRIPTS / "run_ingest_concurrency_benchmark.py"), *common],
            child_env,
        )

    if args.ingest_only:
        run_step("Regenerate charts", [py, str(SCRIPTS / "generate_benchmark_charts.py")])
        run_step(
            "Regenerate auxiliary charts",
            [py, str(PROJECT_ROOT / "scripts/generate_all_benchmarks.py")],
        )
        return

    run_step(
        "Query mode latency benchmark",
        [
            py,
            str(SCRIPTS / "run_mode_latency_benchmark.py"),
            *common,
            "--rounds",
            str(args.rounds),
        ],
        child_env,
    )
    run_step(
        "Query quality chunk_top_k sweep",
        [py, str(SCRIPTS / "run_quality_chunk_sweep.py"), *common],
        child_env,
    )
    run_step("Regenerate all benchmark charts", [py, str(SCRIPTS / "generate_benchmark_charts.py")])
    run_step(
        "Regenerate ingest/token/ccu charts",
        [py, str(PROJECT_ROOT / "scripts/generate_all_benchmarks.py")],
    )
    print("\n=== Benchmark suite complete ===")


if __name__ == "__main__":
    main()
