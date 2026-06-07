import os

import matplotlib.pyplot as plt
import numpy as np

# Recreate the exact styling and data points of the user's context recall benchmark
fig, ax = plt.subplots(figsize=(10, 6))

chunk_top_k = np.arange(1, 21)

# Meticulously mapped data curves from the user's line plot
naive = [
    0.19,
    0.38,
    0.48,
    0.57,
    0.605,
    0.638,
    0.638,
    0.638,
    0.638,
    0.638,
    0.638,
    0.638,
    0.69,
    0.75,
    0.753,
    0.753,
    0.78,
    0.796,
    0.796,
    0.796,
]
global_mode = [
    0.33,
    0.37,
    0.40,
    0.47,
    0.495,
    0.56,
    0.655,
    0.642,
    0.71,
    0.728,
    0.793,
    0.74,
    0.74,
    0.745,
    0.84,
    0.868,
    0.868,
    0.868,
    0.868,
    0.842,
]
local = [
    0.33,
    0.44,
    0.50,
    0.53,
    0.595,
    0.612,
    0.658,
    0.683,
    0.695,
    0.695,
    0.742,
    0.742,
    0.73,
    0.768,
    0.77,
    0.77,
    0.77,
    0.77,
    0.815,
    0.77,
]
hybrid = [
    0.33,
    0.42,
    0.502,
    0.53,
    0.595,
    0.605,
    0.678,
    0.71,
    0.72,
    0.74,
    0.812,
    0.812,
    0.812,
    0.812,
    0.844,
    0.844,
    0.844,
    0.844,
    0.844,
    0.868,
]
mix = [
    0.33,
    0.37,
    0.47,
    0.52,
    0.538,
    0.538,
    0.605,
    0.615,
    0.615,
    0.665,
    0.70,
    0.73,
    0.73,
    0.75,
    0.812,
    0.812,
    0.812,
    0.812,
    0.844,
    0.844,
]

# Plot lines with exact markers, line styles, and colors matching the reference
ax.plot(
    chunk_top_k,
    naive,
    label="NAIVE",
    color="#1d85e0",
    marker="o",
    linestyle="-",
    linewidth=2,
)
ax.plot(
    chunk_top_k,
    global_mode,
    label="GLOBAL",
    color="#10b981",
    marker="s",
    linestyle="--",
    linewidth=2,
)
ax.plot(
    chunk_top_k,
    local,
    label="LOCAL",
    color="#ef4444",
    marker="^",
    linestyle="-.",
    linewidth=2,
)
ax.plot(
    chunk_top_k,
    hybrid,
    label="HYBRID",
    color="#a855f7",
    marker="d",
    linestyle=":",
    linewidth=2,
)
ax.plot(
    chunk_top_k,
    mix,
    label="MIX",
    color="#f59e0b",
    marker="v",
    linestyle="-",
    linewidth=2,
)

ax.set_xlabel(
    "chunk_top_k", fontsize=11, fontweight="bold", labelpad=10, color="#475569"
)
ax.set_ylabel("Score", fontsize=11, fontweight="bold", labelpad=10, color="#475569")
ax.set_title(
    "RAG Query Quality Benchmark - Context Recall vs chunk_top_k",
    fontsize=13,
    fontweight="bold",
    pad=15,
    color="#1e293b",
)

ax.set_xlim(0.5, 21.0)
ax.set_ylim(-0.05, 1.05)
ax.set_xticks(np.arange(0, 21, 2.5))
ax.set_yticks(np.arange(0.0, 1.1, 0.2))

# Style grid, spines, and legends
ax.grid(True, linestyle="--", alpha=0.3, color="#cbd5e1")
ax.legend(loc="upper left", shadow=True, fancybox=True, framealpha=0.95)

# Style spines
for spine in ["top", "right"]:
    ax.spines[spine].set_visible(False)
for spine in ["left", "bottom"]:
    ax.spines[spine].set_color("#94a3b8")

fig.tight_layout()

# Save path
OUTPUT_PATH = "backend/docs/images/benchmark/rag_query_quality_benchmark.png"
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
plt.savefig(OUTPUT_PATH, dpi=300)
print(
    "=== RAG QUALITY BENCHMARK CHART GENERATED SUCCESSFULLY IN backend/docs/images/benchmark ==="
)
