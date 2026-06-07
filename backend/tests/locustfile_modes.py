"""
Locust load test — one task per ZeRAG query mode.

Run (backend must be live with indexed notebook):
    cd backend
    locust -f tests/locustfile_modes.py --host=http://localhost:8000

Headless example (100 users, 60s):
    locust -f tests/locustfile_modes.py --host=http://localhost:8000 \\
        --headless -u 100 -r 10 -t 60s --html ../backend/docs/benchmark_results/locust_report.html
"""

import os
import random

from locust import HttpUser, between, tag, task

NOTEBOOK_ID = os.getenv("BENCHMARK_NOTEBOOK_ID", "default")
API_KEY = os.getenv("ZERAG_API_KEY")

QUESTIONS = [
    "What are the key coverage clauses?",
    "Which entities link to the main policy?",
    "How do exclusions relate to claim procedures?",
    "Summarize cross-document coverage with citations.",
]


class ZeRAGModeLoadUser(HttpUser):
    wait_time = between(1.0, 2.5)

    def _headers(self):
        headers = {"Content-Type": "application/json"}
        if API_KEY:
            headers["Authorization"] = f"Bearer {API_KEY}"
        return headers

    def _chat(self, mode: str, name: str):
        payload = {
            "message": random.choice(QUESTIONS),
            "mode": mode,
            "stream": False,
            "rerank": True,
        }
        self.client.post(
            f"/api/notebooks/{NOTEBOOK_ID}/chat",
            json=payload,
            headers=self._headers(),
            name=name,
        )

    @tag("naive")
    @task(10)
    def chat_naive(self):
        self._chat("naive", "POST /chat [naive]")

    @tag("local")
    @task(10)
    def chat_local(self):
        self._chat("local", "POST /chat [local]")

    @tag("global")
    @task(10)
    def chat_global(self):
        self._chat("global", "POST /chat [global]")

    @tag("hybrid")
    @task(15)
    def chat_hybrid(self):
        self._chat("hybrid", "POST /chat [hybrid]")

    @tag("mix")
    @task(20)
    def chat_mix(self):
        self._chat("mix", "POST /chat [mix]")
