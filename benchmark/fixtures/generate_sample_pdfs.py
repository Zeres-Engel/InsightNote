#!/usr/bin/env python3
"""Generate small PDF fixtures for MinerU ingest benchmarks."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

FIXTURE_DIR = Path(__file__).resolve().parents[3] / "backend/tests/fixtures/inputs/benchmark_pdfs"

SECTIONS = [
    ("Policy Overview", "Comprehensive coverage applies to registered policy owners only."),
    ("Exclusions", "Street racing, stunt driving, and DUI void all benefits immediately."),
    ("Claims Process", "Police reports must be filed within 24 hours of any covered accident."),
    ("Motorcycle Clause", "Two-wheeled vehicles are covered when the rider holds a valid license."),
    ("Hospital Benefit", "Hospitalization benefits pay a fixed daily amount during inpatient care."),
]


def write_pdf(path: Path, doc_id: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=letter)
    width, height = letter
    y = height - 72
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, y, f"Insurance Policy Benchmark Document #{doc_id}")
    y -= 28
    c.setFont("Helvetica", 11)
    for title, body in SECTIONS:
        if y < 100:
            c.showPage()
            y = height - 72
            c.setFont("Helvetica", 11)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(72, y, title)
        y -= 16
        c.setFont("Helvetica", 10)
        for line in body.split(". "):
            if not line.strip():
                continue
            c.drawString(84, y, f"- {line.strip().rstrip('.')}.")
            y -= 14
        y -= 8
    c.save()


def main() -> None:
    for i in range(1, 11):
        write_pdf(FIXTURE_DIR / f"policy_bench_{i:02d}.pdf", i)
    print(f"Generated 10 PDFs in {FIXTURE_DIR}")


if __name__ == "__main__":
    main()
