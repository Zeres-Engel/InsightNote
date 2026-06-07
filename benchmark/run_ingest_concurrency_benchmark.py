#!/usr/bin/env python3
"""
Parallel MinerU PDF ingest benchmark.

Uploads N PDFs concurrently, polls pipeline jobs, records wall-clock and per-job latency.
Requires: backend running, MinerU pipeline available (gpu_env recommended).

Output: backend/docs/benchmark_results/ingest_concurrency.json
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from http_utils import ensure_notebook, upload_file, wait_for_health

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PDF_DIR = PROJECT_ROOT / "backend/tests/fixtures/inputs/benchmark_pdfs"
RESULTS_PATH = PROJECT_ROOT / "backend/docs/benchmark_results/ingest_concurrency.json"


def poll_job(base_url: str, job_id: str, timeout_s: float = 600) -> dict:
    url = f"{base_url.rstrip('/')}/api/pipeline/jobs/{job_id}"
    deadline = time.time() + timeout_s
    started = time.perf_counter()
    last = {}
    while time.time() < deadline:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=30) as resp:
            last = json.loads(resp.read().decode("utf-8"))
        if last.get("status") in {"ready", "failed"}:
            break
        time.sleep(1.5)
    last["elapsed_s"] = round(time.perf_counter() - started, 3)
    return last


def upload_one(base_url: str, notebook_id: str, pdf_path: Path, api_key: str | None) -> dict:
    url = f"{base_url.rstrip('/')}/api/notebooks/{notebook_id}/sources/upload"
    t0 = time.perf_counter()
    _, body = upload_file(url, pdf_path, api_key=api_key)
    job_id = body.get("pipeline_job_id") or body.get("job_id")
    job = poll_job(base_url, job_id) if job_id else {"status": "unknown"}
    return {
        "file": pdf_path.name,
        "upload_s": round(time.perf_counter() - t0, 3),
        "job_id": job_id,
        "status": job.get("status"),
        "pipeline_elapsed_s": job.get("elapsed_s"),
        "steps": job.get("steps", []),
    }


def run_batch(
    base_url: str,
    notebook_id: str,
    pdf_paths: list[Path],
    workers: int,
    api_key: str | None,
) -> dict:
    wall_start = time.perf_counter()
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [
            pool.submit(upload_one, base_url, notebook_id, p, api_key) for p in pdf_paths
        ]
        for fut in as_completed(futures):
            results.append(fut.result())
    wall = time.perf_counter() - wall_start
    ok = [r for r in results if r.get("status") == "ready"]
    pipeline_times = [r["pipeline_elapsed_s"] for r in ok if r.get("pipeline_elapsed_s")]
    return {
        "parallel_workers": workers,
        "documents": len(pdf_paths),
        "wall_clock_s": round(wall, 3),
        "successful": len(ok),
        "failed": len(results) - len(ok),
        "avg_pipeline_s": round(statistics.mean(pipeline_times), 3) if pipeline_times else None,
        "max_pipeline_s": round(max(pipeline_times), 3) if pipeline_times else None,
        "jobs": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.getenv("BENCHMARK_BASE_URL", "http://localhost:8000"))
    parser.add_argument("--notebook", default=os.getenv("BENCHMARK_NOTEBOOK_ID", "auto"))
    parser.add_argument("--api-key", default=os.getenv("ZERAG_API_KEY"))
    parser.add_argument(
        "--concurrency-levels",
        default="1,3,5",
        help="Comma-separated parallel upload counts",
    )
    args = parser.parse_args()

    fixture_script = Path(__file__).parent / "fixtures" / "generate_sample_pdfs.py"
    if not PDF_DIR.exists() or len(list(PDF_DIR.glob("*.pdf"))) < 5:
        os.system(f'"{sys.executable}" "{fixture_script}"')

    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if not pdfs:
        raise SystemExit(f"No PDF fixtures in {PDF_DIR}")

    print(f"Waiting for backend at {args.base_url} ...")
    if not wait_for_health(args.base_url):
        raise SystemExit("Backend not reachable. Start server first.")

    notebook_id = ensure_notebook(args.base_url, args.notebook, "Benchmark Ingest", args.api_key)
    print(f"Using notebook: {notebook_id}")

    levels = [int(x.strip()) for x in args.concurrency_levels.split(",") if x.strip()]
    batches = []
    for n in levels:
        subset = pdfs[:n]
        print(f"\n=== Parallel ingest: {n} PDF(s), workers={n} (MinerU pipeline) ===")
        batch = run_batch(args.base_url, notebook_id, subset, n, args.api_key)
        batches.append(batch)
        print(
            f"  wall={batch['wall_clock_s']}s success={batch['successful']}/{batch['documents']} "
            f"avg_pipeline={batch['avg_pipeline_s']}s"
        )

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": args.base_url,
        "notebook_id": notebook_id,
        "parser": "MinerU (PDF upload)",
        "batches": batches,
    }
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"\nSaved {RESULTS_PATH}")


if __name__ == "__main__":
    main()
