import os
import random

from locust import HttpUser, between, task


class InsightNoteLoadTester(HttpUser):
    # Simulate a realistic user pacing (think/read time between 1 and 3 seconds)
    wait_time = between(1.0, 3.0)

    def on_start(self):
        """Pre-configure isolated session variables for virtual users"""
        # Targeting the 'GSI' stress notebook or default
        self.notebook_id = "notebook_gsi"
        self.headers = {"Content-Type": "application/json"}

    @task(60)
    def test_concurrent_chat_query(self):
        """Simulate concurrent active chat reasoning questions"""
        payload = {
            "message": "Summarize the key AEC software solutions provided by GSI Group.",
            "mode": "mix",
            "stream": False,
            "rerank": True,
        }
        self.client.post(
            f"/api/notebooks/{self.notebook_id}/chat",
            json=payload,
            headers=self.headers,
            name="/api/notebooks/{id}/chat",
        )

    @task(30)
    def test_concurrent_sources_listing(self):
        """Simulate polling active sources (Pillar 1 Sidebar loading)"""
        self.client.get(
            f"/api/notebooks/{self.notebook_id}/sources",
            name="/api/notebooks/{id}/sources",
        )

    @task(10)
    def test_concurrent_graph_fetching(self):
        """Simulate active WebGL 3D Graph loading (Pillar 3 Panel)"""
        self.client.get(
            f"/api/notebooks/{self.notebook_id}/graph", name="/api/notebooks/{id}/graph"
        )
