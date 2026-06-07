#!/usr/bin/env python3
"""
Measure average chat latency per ZeRAG query mode against a live InsightNote backend.

Usage (backend must be running with indexed notebook):
    python scripts/benchmark/run_mode_latency_benchmark.py
    python scripts/benchmark/run_mode_latency_benchmark.py --notebook default --rounds 5

Output:
    backend/docs/benchmark_results/query_mode_latency.json
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from http_utils import ensure_notebook, wait_for_health

MODE_LABELS = {
    "naive": "Naive (Vector Only)",
    "local": "Local (Entity Focus)",
    "global": "Global (Relationship Focus)",
    "hybrid": "Hybrid (Entity + Relationship)",
    "mix": "Mix (Entity + Relationship + Vector)",
}

DEFAULT_QUESTIONS = {
    "naive": "What are the main coverage clauses in the indexed documents?",
    "local": "Which entities are directly linked to the primary policy document?",
    "global": "What relationships connect coverage types to exclusion rules?",
    "hybrid": "How do policy entities relate to claim procedures across documents?",
    "mix": "Summarize cross-document coverage and cite the most relevant passages.",
}


def post_chat(
    base_url: str,
    notebook_id: str,
    mode: str,
    message: str,
    api_key: str | None,
    timeout: float,
) -> tuple[float, int]:
    url = f"{base_url.rstrip('/')}/api/notebooks/{notebook_id}/chat"
    payload = {
        "message": message,
        "mode": mode,
        "stream": False,
        "rerank": True,
    }
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            resp.read()
            status = resp.status
    except urllib.error.HTTPError as exc:
        elapsed = time.perf_counter() - started
        raise RuntimeError(f"HTTP {exc.code} for mode={mode}: {exc.read()[:300]!r}") from exc
    elapsed = time.perf_counter() - started
    return elapsed, status


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark InsightNote query modes")
    parser.add_argument("--base-url", default=os.getenv("BENCHMARK_BASE_URL", "http://localhost:8000"))
    parser.add_argument("--notebook", default=os.getenv("BENCHMARK_NOTEBOOK_ID", "auto"))
    parser.add_argument("--rounds", type=int, default=int(os.getenv("BENCHMARK_ROUNDS", "3")))
    parser.add_argument("--timeout", type=float, default=float(os.getenv("BENCHMARK_TIMEOUT", "120")))
    parser.add_argument("--api-key", default=os.getenv("ZERAG_API_KEY"))
    parser.add_argument(
        "--output",
        default="backend/docs/benchmark_results/query_mode_latency.json",
    )
    args = parser.parse_args()

    if not wait_for_health(args.base_url):
        raise SystemExit("Backend not reachable. Start server first.")

    notebook_id = ensure_notebook(args.base_url, args.notebook, "Benchmark Suite", args.api_key)
    print(f"Using notebook: {notebook_id}")

    project_root = Path(__file__).resolve().parents[2]
    output_path = project_root / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Benchmark target: {args.base_url}")
    print(f"Notebook: {notebook_id} | rounds/mode: {args.rounds}")

    results: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": args.base_url,
        "notebook_id": notebook_id,
        "rounds_per_mode": args.rounds,
        "modes": {},
    }

    for mode in MODES:
        samples: list[float] = []
        question = DEFAULT_QUESTIONS[mode]
        print(f"\n[{mode}] {MODE_LABELS[mode]}")
        for i in range(args.rounds):
            elapsed, status = post_chat(
                args.base_url,
                notebook_id,
                mode,
                question,
                args.api_key,
                args.timeout,
            )
            samples.append(elapsed)
            print(f"  run {i + 1}/{args.rounds}: {elapsed:.2f}s (HTTP {status})")
            time.sleep(0.5)

        avg = statistics.mean(samples)
        results["modes"][mode] = {
            "label": MODE_LABELS[mode],
            "latency_avg_s": round(avg, 3),
            "latency_min_s": round(min(samples), 3),
            "latency_max_s": round(max(samples), 3),
            "samples_s": [round(s, 3) for s in samples],
            "rps_at_single_user": round(1.0 / avg, 2) if avg > 0 else 0,
        }

    # Estimate relative RPS @ 100 CCU from inverse latency (for chart scaling only)
    baseline = results["modes"]["naive"]["latency_avg_s"]
    for mode in MODES:
        lat = results["modes"][mode]["latency_avg_s"]
        results["modes"][mode]["rps_estimated_100ccu"] = (
            round(120 * (baseline / lat), 1) if lat > 0 else 0
        )

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved: {output_path}")
    print("Next: python scripts/benchmark/generate_benchmark_charts.py")


if __name__ == "__main__":
    main()
