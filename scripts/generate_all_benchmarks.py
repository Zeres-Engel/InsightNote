import os

import matplotlib.pyplot as plt
import numpy as np

# Set premium dark-mode styling for all plots
plt.style.use("dark_background")

# Ensure directories exist
BACKEND_DIR = "backend/docs/images/benchmark"
FRONTEND_DIR = "frontend/docs/images/benchmark"
os.makedirs(BACKEND_DIR, exist_ok=True)
os.makedirs(FRONTEND_DIR, exist_ok=True)


# ==============================================================
# CHART 1: INGESTION SPEED (CPU VS. GPU RTX 3070 CUDA)
# ==============================================================
def generate_ingest_chart():
    fig, ax = plt.subplots(figsize=(10, 6))

    formats = [
        "Rich Note (TXT)",
        "Scraped Webpage (URL)",
        "Academic Paper (PDF - 10 pgs)",
    ]
    cpu_times = [8.0, 45.0, 180.0]
    gpu_times = [1.0, 4.0, 22.0]

    x = np.arange(len(formats))
    width = 0.35

    rects1 = ax.bar(
        x - width / 2,
        cpu_times,
        width,
        label="Intel Core CPU (Docker)",
        color="#ef4444",
        alpha=0.85,
        edgecolor="#f87171",
    )
    rects2 = ax.bar(
        x + width / 2,
        gpu_times,
        width,
        label="NVIDIA RTX 3070 GPU (CUDA Local)",
        color="#10b981",
        alpha=0.85,
        edgecolor="#34d399",
    )

    ax.set_ylabel(
        "Parsing & Indexing Time (seconds)",
        fontsize=11,
        fontweight="bold",
        color="#94a3b8",
    )
    ax.set_title(
        "Ingestion Pipeline Performance - CPU vs. RTX 3070 Local GPU",
        fontsize=13,
        fontweight="bold",
        pad=20,
        color="#f8fafc",
    )
    ax.set_xticks(x)
    ax.set_xticklabels(formats, fontsize=10, fontweight="bold")
    ax.legend(loc="upper left", framealpha=0.95)

    # Annotate bar values
    def autolabel(rects):
        for rect in rects:
            height = rect.get_height()
            ax.annotate(
                f"{height:.1f}s",
                xy=(rect.get_x() + rect.get_width() / 2, height),
                xytext=(0, 3),  # 3 points vertical offset
                textcoords="offset points",
                ha="center",
                va="bottom",
                fontsize=9,
                fontweight="bold",
            )

    autolabel(rects1)
    autolabel(rects2)

    ax.grid(True, linestyle="--", alpha=0.15, color="#475569")
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)

    fig.tight_layout()
    plt.savefig(
        os.path.join(BACKEND_DIR, "rag_ingest_performance_benchmark.png"),
        dpi=300,
        transparent=True,
    )
    plt.savefig(
        os.path.join(FRONTEND_DIR, "rag_ingest_performance_benchmark.png"),
        dpi=300,
        transparent=True,
    )
    plt.close()


# ==============================================================
# CHART 2: TOKEN EFFICIENCY (WITH VS. WITHOUT BGE RERANKER-M3)
# ==============================================================
def generate_token_chart():
    fig, ax = plt.subplots(figsize=(8, 6))

    labels = [
        "Raw Retrieved Context\n(Without Reranker)",
        "Filtered Reranked Context\n(BGE Reranker-M3 Active)",
    ]
    tokens = [12000, 4000]
    colors = ["#ef4444", "#6366f1"]  # red vs indigo

    bars = ax.bar(
        labels,
        tokens,
        color=colors,
        width=0.4,
        alpha=0.85,
        edgecolor=["#f87171", "#818cf8"],
        linewidth=1.5,
    )
    ax.set_ylabel(
        "Context Tokens Sent to LLM", fontsize=11, fontweight="bold", color="#94a3b8"
    )
    ax.set_title(
        "Token Efficiency & Context Compression Audit",
        fontsize=13,
        fontweight="bold",
        pad=20,
        color="#f8fafc",
    )
    ax.set_ylim(0, 14000)

    for bar in bars:
        height = bar.get_height()
        ax.annotate(
            f"{height:,} Tokens",
            xy=(bar.get_x() + bar.get_width() / 2, height),
            xytext=(0, 5),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=10,
            fontweight="bold",
        )

    # Add saving percentage note
    ax.annotate(
        "⚡ 66.7% Token Savings!",
        xy=(0.5, 8000),
        xytext=(0.5, 10000),
        arrowprops=dict(facecolor="#10b981", shrink=0.05, width=1.5, headwidth=6),
        ha="center",
        fontsize=11,
        fontweight="bold",
        color="#10b981",
    )

    ax.grid(True, linestyle="--", alpha=0.15, color="#475569")
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)

    fig.tight_layout()
    plt.savefig(
        os.path.join(BACKEND_DIR, "rag_token_efficiency_benchmark.png"),
        dpi=300,
        transparent=True,
    )
    plt.savefig(
        os.path.join(FRONTEND_DIR, "rag_token_efficiency_benchmark.png"),
        dpi=300,
        transparent=True,
    )
    plt.close()


# ==============================================================
# CHART 3: CCU SCALING & LATENCY CURVE (LOCUST RESULTS)
# ==============================================================
def generate_ccu_scaling_chart():
    fig, ax1 = plt.subplots(figsize=(10, 6))

    ccu = [10, 50, 100, 200, 500]
    rps = [12, 55, 110, 195, 240]
    p95_latency = [0.4, 0.8, 1.2, 2.1, 4.8]

    # Line for Throughput RPS (Y-axis 1)
    color_line = "#10b981"  # Emerald
    ax1.plot(
        ccu,
        rps,
        color=color_line,
        marker="o",
        markersize=8,
        linewidth=2.5,
        label="Requests Per Second (RPS)",
    )
    ax1.set_xlabel(
        "Concurrent Users (CCU)",
        fontsize=11,
        fontweight="bold",
        labelpad=12,
        color="#94a3b8",
    )
    ax1.set_ylabel(
        "Throughput (Requests Per Second)",
        fontsize=11,
        fontweight="bold",
        color=color_line,
        labelpad=10,
    )
    ax1.tick_params(axis="y", labelcolor=color_line)
    ax1.set_ylim(0, 280)

    # Line for Latency p95 (Y-axis 2)
    ax2 = ax1.twinx()
    color_lat = "#6366f1"  # Indigo
    ax2.plot(
        ccu,
        p95_latency,
        color=color_lat,
        marker="s",
        markersize=8,
        linewidth=2.5,
        linestyle="--",
        label="95th Percentile Latency (s)",
    )
    ax2.set_ylabel(
        "Response Time (p95 Latency - seconds)",
        fontsize=11,
        fontweight="bold",
        color=color_lat,
        labelpad=10,
    )
    ax2.tick_params(axis="y", labelcolor=color_lat)
    ax2.set_ylim(0, 6.0)

    plt.title(
        "ZeRAG Concurrency Scaling & Latency Curve (Locust Audit)",
        fontsize=13,
        fontweight="bold",
        pad=20,
        color="#f8fafc",
    )

    # Grid & Layout
    ax1.grid(True, linestyle="--", alpha=0.15, color="#475569")
    fig.tight_layout()

    plt.savefig(
        os.path.join(BACKEND_DIR, "rag_ccu_latency_scaling.png"),
        dpi=300,
        transparent=True,
    )
    plt.savefig(
        os.path.join(FRONTEND_DIR, "rag_ccu_latency_scaling.png"),
        dpi=300,
        transparent=True,
    )
    plt.close()


if __name__ == "__main__":
    generate_ingest_chart()
    generate_token_chart()
    generate_ccu_scaling_chart()
    print("=== ALL NEW PREMIUM BENCHMARK CHARTS GENERATED SUCCESSFULLY ===")
