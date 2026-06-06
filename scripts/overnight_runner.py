import asyncio
import os
import re
import subprocess
import sys
import time
from datetime import datetime

import httpx

# Resolve project paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_FILE = os.path.join(PROJECT_ROOT, "backend", "logs", "overnight_run_log.txt")
BUG_REPORT = os.path.join(PROJECT_ROOT, "backend", "logs", "overnight_bug_report.md")

os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)


def log_message(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] {msg}"
    print(formatted)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(formatted + "\n")


def record_bug(title, detail, severity="MEDIUM"):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    bug_entry = f"""
## [{timestamp}] {title}
- **Severity**: {severity}
- **Details**:
```
{detail}
```
---
"""
    print(f"\n!!! BUG DETECTED & LOGGED: {title} !!!\n")
    with open(BUG_REPORT, "a", encoding="utf-8") as f:
        f.write(bug_entry + "\n")


async def run_stress_test_cycle(cycle_id):
    log_message(f"=== STARTING OVERNIGHT STRESS CYCLE #{cycle_id} ===")

    # 1. Verify backend health
    log_message("Step 1/5: Checking backend API health...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get("http://localhost:8000/api/health", timeout=3.0)
            if resp.status_code == 200:
                log_message("Backend API is online and healthy!")
            else:
                record_bug(
                    "Backend Health Check Failed",
                    f"GET /api/health returned status code: {resp.status_code}",
                    severity="HIGH",
                )
                return
        except Exception as e:
            record_bug(
                "Backend Unreachable",
                f"Failed to connect to backend: {str(e)}",
                severity="CRITICAL",
            )
            return

    # 2. Stress-test parallel ingestion
    log_message("Step 2/5: Ingestion Stress Test - Creating temporary notebook...")
    notebook_id = f"notebook_stress_test_c{cycle_id}_{int(time.time()) % 1000}"
    notebook_name = f"Stress Test Cycle {cycle_id}"

    async with httpx.AsyncClient() as client:
        try:
            # Create notebook
            resp = await client.post(
                "http://localhost:8000/api/notebooks",
                json={"name": notebook_name},
                timeout=5.0,
            )
            if resp.status_code != 200:
                record_bug(
                    "Failed to Create Notebook",
                    f"POST /api/notebooks returned {resp.status_code}",
                    "HIGH",
                )
                return
            log_message(f"Created isolated stress notebook: {notebook_id}")
        except Exception as e:
            record_bug(
                "Notebook Creation Crash",
                f"Exception during notebook creation: {str(e)}",
                "CRITICAL",
            )
            return

        # Trigger concurrent parallel ingestions (5 URLs + 5 Note sources simultaneously!)
        log_message(
            "Triggering concurrent parallel ingestions of 5 URLs and 5 notes..."
        )
        urls = [
            "https://api.ai-box.vn/",
            "https://api.ai-box.vn/console",
            "https://taphoammo.com/",
            "https://oj.vnoi.info/problem/vnoicup26_r2_a",
            "https://contest.nypc.co.kr/",
        ]
        notes = [
            {
                "title": f"Note A {cycle_id}",
                "content": "Parallel queue stress testing. Asyncio lock boundaries must match active loop.",
            },
            {
                "title": f"Note B {cycle_id}",
                "content": "PostgreSQL baseline is the minimum requirement. Neo4j is the maximum state.",
            },
            {
                "title": f"Note C {cycle_id}",
                "content": "Stretching the limits of multirag indexing. Crawler crawl4ai features active.",
            },
            {
                "title": f"Note D {cycle_id}",
                "content": "Visual audits are taken from Playwright viewport screenshots.",
            },
            {
                "title": f"Note E {cycle_id}",
                "content": "Concurrence ingestion should clear forms instantly and process in background.",
            },
        ]

        tasks = []
        # Queue URLs
        for url in urls:
            tasks.append(
                client.post(
                    f"http://localhost:8000/api/notebooks/{notebook_id}/sources/url",
                    json={"url": url},
                    timeout=8.0,
                )
            )
        # Queue Notes
        for note in notes:
            tasks.append(
                client.post(
                    f"http://localhost:8000/api/notebooks/{notebook_id}/sources/note",
                    json=note,
                    timeout=8.0,
                )
            )

        log_message("Spawning parallel requests concurrently via asyncio.gather...")
        results = await asyncio.gather(*tasks, return_exceptions=True)

        success_count = 0
        failure_count = 0
        for i, res in enumerate(results):
            if isinstance(res, Exception):
                record_bug(
                    "Parallel Ingest Connection Refused",
                    f"Task index {i} failed to connect: {str(res)}",
                    "HIGH",
                )
                failure_count += 1
            elif res.status_code != 200:
                record_bug(
                    "Parallel Ingest Returned Error",
                    f"Task index {i} returned status: {res.status_code}\nResponse: {res.text}",
                    "MEDIUM",
                )
                failure_count += 1
            else:
                success_count += 1

        log_message(
            f"Parallel ingestion queued: {success_count} succeeded, {failure_count} failed."
        )

    # 3. Chat Q&A testing
    log_message("Step 3/5: Running Chat Q&A verification...")
    async with httpx.AsyncClient() as client:
        try:
            # Query chat
            resp = await client.post(
                f"http://localhost:8000/api/notebooks/{notebook_id}/chat",
                json={
                    "message": "What is the core technology of API AI BOX?",
                    "stream": False,
                },
                timeout=15.0,
            )
            if resp.status_code == 200:
                chat_data = resp.json()
                log_message(
                    f"Chat responded successfully: '{chat_data.get('answer', '')[:100]}...'"
                )
            else:
                record_bug(
                    "Chat Query Failed",
                    f"POST /api/notebooks/{notebook_id}/chat returned: {resp.status_code}\nResponse: {resp.text}",
                    "HIGH",
                )
        except Exception as e:
            record_bug(
                "Chat Query Exception", f"Exception during chat query: {str(e)}", "HIGH"
            )

    # 4. Scan Server log for exceptions
    log_message("Step 4/5: Scanning backend logs for exceptions...")
    log_path = os.path.join(PROJECT_ROOT, "backend", "logs", "server.log")
    if os.path.exists(log_path):
        try:
            with open(log_path, "r", encoding="utf-8") as lf:
                lines = lf.readlines()[-200:]  # Scan last 200 lines

            traceback_buffer = []
            in_traceback = False
            for line in lines:
                if (
                    "Traceback (most recent call" in line
                    or "Exception" in line
                    or "Critical error" in line
                ):
                    in_traceback = True
                if in_traceback:
                    traceback_buffer.append(line)
                    if len(traceback_buffer) > 15:  # Cap traceback logging
                        in_traceback = False
                        record_bug(
                            "Captured Log Exception", "".join(traceback_buffer), "HIGH"
                        )
                        traceback_buffer = []
        except Exception as e:
            log_message(f"Failed to scan backend logs: {str(e)}")

    # 5. Clean up temporary notebook (4-DB Sync Purge verification)
    log_message("Step 5/5: Wiping temporary notebook to verify 4-DB Purge...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.delete(
                f"http://localhost:8000/api/notebooks/{notebook_id}", timeout=10.0
            )
            if resp.status_code == 200:
                log_message(
                    f"Notebook {notebook_id} purged successfully from PostgreSQL, MongoDB, Neo4j, and Qdrant."
                )
            else:
                record_bug(
                    "Notebook Purge Failed",
                    f"DELETE /api/notebooks/{notebook_id} returned status: {resp.status_code}",
                    "MEDIUM",
                )
        except Exception as e:
            record_bug(
                "Notebook Purge Exception",
                f"Exception during notebook deletion: {str(e)}",
                "MEDIUM",
            )

    log_message(f"=== COMPLETED OVERNIGHT STRESS CYCLE #{cycle_id} ===\n")


async def main():
    if not os.path.exists(BUG_REPORT):
        with open(BUG_REPORT, "w", encoding="utf-8") as f:
            f.write(
                "# 🛡️ InsightNote Overnight Bug Discovery Report\n\nThis file is generated automatically by the continuous testing orchestrator. Below are the logged exceptions and visual abnormalities discovered during the run.\n\n"
            )

    log_message("==============================================================")
    log_message("INSIGHTNOTE CONTINUOUS OVERNIGHT TEST ORCHESTRATOR INITIALIZED")
    log_message("==============================================================")
    log_message("Press CTRL+C to stop the run and retrieve the final reports.")
    log_message("--------------------------------------------------------------")

    cycle = 1
    try:
        while True:
            await run_stress_test_cycle(cycle)
            cycle += 1
            # Sleep 15 seconds before launching the next cycle
            await asyncio.sleep(15)
    except KeyboardInterrupt:
        log_message("Orchestrator stopped by Master Architect. Saving final reports.")
    except Exception as run_err:
        record_bug("Orchestrator Core Loop Failure", str(run_err), "CRITICAL")


if __name__ == "__main__":
    asyncio.run(main())
