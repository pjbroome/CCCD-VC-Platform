FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
# ffmpeg: consultation videos are transcoded on upload (H.264 720p + AAC + faststart).
# Phone-recorded clips arrive at ~30 MB and take seconds to start on mobile data; the
# transcode lands them at ~8-12 MB with the moov atom at the front so playback begins
# immediately instead of after a full download.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==1.8.4 && \
    poetry config virtualenvs.create false

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install dependencies
RUN poetry install --no-root --no-interaction --no-ansi && \
    pip install boto3

# Copy application code
COPY app/ app/

# Copy pre-generated RAG data if available (use generate_embeddings.py to rebuild)
# These files are optional — app runs with RAG_ENABLED=false if missing
COPY rag_chunks_meta.json* /tmp/
COPY rag_inverted_index.json* /tmp/
COPY rag_chunks_text.jsonl* /tmp/
COPY rag_chunks_text_offsets.json* /tmp/
COPY rag_embeddings.npy* /tmp/

# Expose port
EXPOSE 8000

# Health check — embeddings are pre-cached so startup is fast
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

# Run the application
CMD ["fastapi", "run", "app/main.py", "--port", "8000", "--host", "0.0.0.0"]
