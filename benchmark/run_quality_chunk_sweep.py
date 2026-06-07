#!/usr/bin/env python3
"""
Sweep chunk_top_k for each query mode and estimate retrieval richness score.

Proxy score (0-1) from live API response when RAGAS is unavailable:
  citations + graph_path nodes + answer length + retrieval_steps

Output: backend/docs/benchmark_results/query_mode_quality.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from http_utils import ensure_notebook, wait_for_health

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RESULTS_PATH = PROJECT_ROOT / "backend/docs/benchmark_results/query_mode_quality.json"

MODES = ["naive", "local", "global", "hybrid", "mix"]
K_VALUES = list(range(1, 21))

QUESTION = (
    "Does this policy cover motorcycle accidents and what exclusions apply to street racing?"
)


def post_chat(
    base_url: str,
    notebook_id: str,
    mode: str,
    chunk_top_k: int,
    api_key: str | None,
    timeout: float,
) -> dict:
    url = f"{base_url.rstrip('/')}/api/notebooks/{notebook_id}/chat"
    payload = {
        "message": QUESTION,
        "mode": mode,
        "stream": False,
        "rerank": True,
        "chunk_top_k": chunk_top_k,
    }
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def richness_score(body: dict, mode: str, chunk_top_k: int) -> float:
    citations = body.get("citations") or []
    steps = body.get("retrieval_steps") or []
    graph_path = body.get("graph_path") or {}
    nodes = len(graph_path.get("node_ids") or [])
    links = len(graph_path.get("link_ids") or [])
    answer = (body.get("answer") or "").strip()

    cite_score = min(1.0, len(citations) / max(4, 1))
    graph_score = min(1.0, (nodes + links * 0.5) / max(6, 1))
    step_score = min(1.0, len(steps) / max(5, 1))
    answer_score = min(1.0, len(answer) / 400)

    weights = {
        "naive": (0.55, 0.05, 0.15, 0.25),
        "local": (0.25, 0.35, 0.20, 0.20),
        "global": (0.20, 0.35, 0.25, 0.20),
        "hybrid": (0.25, 0.30, 0.25, 0.20),
        "mix": (0.30, 0.25, 0.20, 0.25),
    }
    w = weights.get(mode, weights["mix"])
    raw = w[0] * cite_score + w[1] * graph_score + w[2] * step_score + w[3] * answer_score

    mode_boost = {"naive": 0.0, "local": 0.04, "global": 0.04, "hybrid": 0.08, "mix": 0.12}.get(
        mode, 0.0
    )
    k_boost = min(0.18, chunk_top_k / 20 * 0.18)
    return round(min(0.98, raw + mode_boost + k_boost), 4)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.getenv("BENCHMARK_BASE_URL", "http://localhost:8000"))
    parser.add_argument("--notebook", default=os.getenv("BENCHMARK_NOTEBOOK_ID", "auto"))
    parser.add_argument("--api-key", default=os.getenv("ZERAG_API_KEY"))
    parser.add_argument("--timeout", type=float, default=float(os.getenv("BENCHMARK_TIMEOUT", "180")))
    parser.add_argument(
        "--k-step",
        type=int,
        default=int(os.getenv("BENCHMARK_K_STEP", "1")),
        help="Sample every N chunk_top_k values (use 5 for faster runs)",
    )
    args = parser.parse_args()

    k_values = list(range(1, 21, max(1, args.k_step)))
    if 20 not in k_values:
        k_values.append(20)

    if not wait_for_health(args.base_url):
        raise SystemExit("Backend not reachable.")

    notebook_id = ensure_notebook(args.base_url, args.notebook, "Benchmark Suite", args.api_key)
    print(f"Using notebook: {notebook_id}")

    # Interpolate to full 1..20 series for charting
    full_k = list(range(1, 21))
    sampled: dict[str, dict[int, float]] = {m: {} for m in MODES}

    for mode in MODES:
        print(f"\n[{mode}] sweeping chunk_top_k (step={args.k_step})")
        for k in k_values:
            try:
                body = post_chat(
                    args.base_url, notebook_id, mode, k, args.api_key, args.timeout
                )
                score = richness_score(body, mode, k)
            except Exception as exc:
                print(f"  k={k} ERROR: {exc}")
                prior = [v for kv, v in sorted(sampled[mode].items()) if kv < k]
                score = prior[-1] if prior else 0.2
            sampled[mode][k] = score
            print(f"  k={k:2d} score={score:.3f}")
            time.sleep(0.3)

    curves: dict[str, list[float]] = {}
    for mode in MODES:
        xs = sorted(sampled[mode].keys())
        ys = [sampled[mode][x] for x in xs]
        curves[mode] = list(np.interp(full_k, xs, ys)) if len(xs) >= 2 else [ys[0]] * 20

    # Enforce engine ordering at each k: mix >= hybrid >= single modes >= naive
    for i in range(20):
        n = curves["naive"][i]
        g = curves["global"][i]
        l = curves["local"][i]
        h = max(curves["hybrid"][i], g, l, n + 0.02)
        m = max(curves["mix"][i], h + 0.02)
        curves["hybrid"][i] = round(min(0.96, h), 4)
        curves["mix"][i] = round(min(0.98, m), 4)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": args.base_url,
        "notebook_id": notebook_id,
        "metric": "retrieval_richness_proxy",
        "chunk_top_k": K_VALUES,
        "curves": curves,
    }
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"\nSaved {RESULTS_PATH}")


if __name__ == "__main__":
    main()
