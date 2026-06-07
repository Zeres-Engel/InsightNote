"""Shared HTTP helpers for benchmark scripts."""

from __future__ import annotations

import json
import mimetypes
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

BENCHMARK_NOTEBOOK_NAME = "Benchmark Suite"
AUTO_NOTEBOOK_IDS = frozenset({"", "default", "auto"})


def get_json(url: str, api_key: str | None = None, timeout: float = 30) -> Any:
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def post_json(
    url: str,
    payload: dict,
    api_key: str | None = None,
    timeout: float = 120,
) -> tuple[float, dict]:
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    started = time.perf_counter()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return time.perf_counter() - started, body


def upload_file(
    url: str,
    file_path: Path,
    api_key: str | None = None,
    timeout: float = 300,
) -> tuple[float, dict]:
    boundary = f"----InsightNoteBenchmark{int(time.time() * 1000)}"
    filename = file_path.name
    file_bytes = file_path.read_bytes()
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    started = time.perf_counter()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    return time.perf_counter() - started, result


def wait_for_health(base_url: str, timeout_s: float = 120) -> bool:
    deadline = time.time() + timeout_s
    url = f"{base_url.rstrip('/')}/api/health"
    while time.time() < deadline:
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(2)
    return False


def resolve_notebook_id(
    base_url: str,
    notebook_id: str | None,
    name: str | None = None,
    api_key: str | None = None,
) -> str:
    """Return an existing notebook id or create one via POST /api/notebooks."""
    label = name or BENCHMARK_NOTEBOOK_NAME
    root = base_url.rstrip("/")

    if notebook_id and notebook_id not in AUTO_NOTEBOOK_IDS:
        try:
            get_json(f"{root}/api/notebooks/{notebook_id}", api_key)
            return notebook_id
        except urllib.error.HTTPError as exc:
            if exc.code != 404:
                raise

    try:
        notebooks = get_json(f"{root}/api/notebooks", api_key)
        for nb in notebooks:
            if nb.get("name") == label:
                return nb["id"]
    except Exception:
        pass

    _, body = post_json(f"{root}/api/notebooks", {"name": label}, api_key)
    return body["id"]


def ensure_notebook(
    base_url: str,
    notebook_id: str | None,
    name: str | None = None,
    api_key: str | None = None,
) -> str:
    """Backward-compatible alias for resolve_notebook_id."""
    return resolve_notebook_id(base_url, notebook_id, name, api_key)


def wait_for_notebook_ready(
    base_url: str,
    notebook_id: str,
    api_key: str | None = None,
    timeout_s: float = 300,
    min_sources: int = 1,
) -> bool:
    """Poll notebook until indexed sources are ready."""
    deadline = time.time() + timeout_s
    url = f"{base_url.rstrip('/')}/api/notebooks/{notebook_id}"
    while time.time() < deadline:
        try:
            nb = get_json(url, api_key)
            status = nb.get("status")
            count = int(nb.get("source_count") or 0)
            if status == "ready" and count >= min_sources:
                return True
        except Exception:
            pass
        time.sleep(3)
    return False
