# Build stage
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    UV_SYSTEM_PYTHON=1 \
    UV_COMPILE_BYTECODE=1

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies using uv for speed
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --no-cache -r requirements.txt

# Pre-download Tiktoken cache
RUN mkdir -p /app/data/tiktoken && \
    python -c "import tiktoken; tiktoken.get_encoding('cl100k_base'); tiktoken.get_encoding('o200k_base')" && \
    cp -r /root/.cache/tiktoken/* /app/data/tiktoken/ || true

# Final runtime stage
FROM python:3.12-slim-bookworm

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    TIKTOKEN_CACHE_DIR=/app/data/tiktoken \
    WORKING_DIR=/app/rag_storage

# Install runtime system dependencies (OCR, LibreOffice, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-vie \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy Tiktoken cache
COPY --from=builder /app/data/tiktoken /app/data/tiktoken

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/rag_storage /app/dict_data /app/logs /app/data/inputs

# Expose port
EXPOSE 8000

# Set entry point
CMD ["python", "server.py"]
