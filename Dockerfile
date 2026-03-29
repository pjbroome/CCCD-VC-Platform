FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==1.8.4 && \
    poetry config virtualenvs.create false

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install dependencies
RUN poetry install --no-root --no-interaction --no-ansi

# Copy application code
COPY app/ app/

# Copy pre-generated RAG data — split-file architecture for ultra-low memory (~7MB total)
# Embeddings: memory-mapped, ~0 RSS at load time
COPY rag_embeddings.npy /tmp/rag_embeddings.npy
# Chunk metadata (source/category only, no text): ~0.5MB
COPY rag_chunks_meta.json /tmp/rag_chunks_meta.json
# Pre-built inverted index for keyword pre-filtering: ~2MB
COPY rag_inverted_index.json /tmp/rag_inverted_index.json
# Chunk text as JSONL for on-demand random access: ~4.8MB
COPY rag_chunks_text.jsonl /tmp/rag_chunks_text.jsonl
# Byte offsets for random text access: ~0.1MB
COPY rag_chunks_text_offsets.json /tmp/rag_chunks_text_offsets.json

# Expose port
EXPOSE 8000

# Health check — embeddings are pre-cached so startup is fast
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

# Run the application
CMD ["fastapi", "run", "app/main.py", "--port", "8000", "--host", "0.0.0.0"]
