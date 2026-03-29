"""
RAG (Retrieval-Augmented Generation) module for Sutton.

Provides vector-based semantic search over ToPS training content.
Uses Gemini embeddings for vectorization and cosine similarity for retrieval.
This is the "hallucination killer" — instead of dumping all training content
into the system prompt, we search for only the most relevant chunks per query.
"""

import json
import os
import hashlib
import re
from collections import defaultdict
import numpy as np
from typing import Optional

# --- Configuration ---
# Memory-mapped numpy format (lowest memory footprint)
EMBEDDINGS_NPY_PATH = os.environ.get("EMBEDDINGS_NPY_PATH", "/tmp/rag_embeddings.npy")
# Split data files for low-memory loading
CHUNKS_META_PATH = os.environ.get("CHUNKS_META_PATH", "/tmp/rag_chunks_meta.json")
INVERTED_INDEX_PATH = os.environ.get("INVERTED_INDEX_PATH", "/tmp/rag_inverted_index.json")
CHUNKS_TEXT_PATH = os.environ.get("CHUNKS_TEXT_PATH", "/tmp/rag_chunks_text.jsonl")
CHUNKS_TEXT_OFFSETS_PATH = os.environ.get("CHUNKS_TEXT_OFFSETS_PATH", "/tmp/rag_chunks_text_offsets.json")
# Legacy paths (fallback)
CHUNKS_JSON_PATH = os.environ.get("CHUNKS_JSON_PATH", "/tmp/rag_chunks.json")
EMBEDDINGS_NPZ_PATH = os.environ.get("EMBEDDINGS_NPZ_PATH", "/tmp/rag_embeddings.npz")
EMBEDDINGS_CACHE_PATH = os.environ.get("EMBEDDINGS_CACHE_PATH", "/data/rag_embeddings.json" if os.path.exists("/data") else "/tmp/rag_embeddings.json")
CHUNK_SIZE = 800  # characters per chunk
CHUNK_OVERLAP = 200  # overlap between chunks
TOP_K = 5  # number of relevant chunks to retrieve per query

# --- Globals ---
_chunks_meta: list[dict] = []  # [{"source": str, "category": str}, ...] — NO text (loaded on-demand)
_chunks_text_offsets: list[int] = []  # byte offsets into the JSONL file for random text access
_chunks_text_file = None  # file handle for JSONL text file (kept open for random reads)
_embeddings: list[list[float]] = []  # parallel array of embedding vectors (used only for legacy/generation)
_embeddings_matrix: Optional[np.ndarray] = None  # precomputed numpy matrix (float16 for memory efficiency)
_inverted_index: dict[str, list[int]] = {}  # keyword -> list of chunk indices (pre-built, loaded from file)
_gemini_client = None
_is_initialized = False
_num_chunks = 0

# Dental/ToPS domain stop words to exclude from indexing
_STOP_WORDS = frozenset({
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up',
    'that', 'this', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we',
    'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
    'their', 'what', 'which', 'who', 'whom', 'also', 'like', 'get', 'got',
    'one', 'two', 'make', 'know', 'think', 'see', 'come', 'want', 'look',
    'use', 'find', 'give', 'tell', 'say', 'said', 'go', 'going', 'take',
    'way', 'well', 'back', 'even', 'new', 'work', 'first', 'last', 'long',
    'great', 'little', 'right', 'still', 'much', 'thing', 'things',
})


def _chunk_text(text: str, source: str, category: str) -> list[dict]:
    """Split text into overlapping chunks for better retrieval."""
    chunks = []
    if len(text) <= CHUNK_SIZE:
        chunks.append({
            "id": hashlib.md5(f"{source}:{text[:100]}".encode()).hexdigest(),
            "text": text.strip(),
            "source": source,
            "category": category,
        })
        return chunks

    start = 0
    chunk_idx = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunk_text = text[start:end].strip()
        if chunk_text:
            chunks.append({
                "id": hashlib.md5(f"{source}:{chunk_idx}:{chunk_text[:50]}".encode()).hexdigest(),
                "text": chunk_text,
                "source": source,
                "category": category,
            })
        start = end - CHUNK_OVERLAP
        chunk_idx += 1

    return chunks


def _tokenize(text: str) -> list[str]:
    """Tokenize text into lowercase words, filtering stop words."""
    words = re.findall(r'[a-z0-9]+', text.lower())
    return [w for w in words if w not in _STOP_WORDS and len(w) > 2]


def _build_inverted_index(chunks: list[dict]) -> dict[str, list[int]]:
    """Build an inverted index from chunk text for keyword pre-filtering.
    Memory: ~2-4MB for 6671 chunks. Much cheaper than loading full embedding matrix."""
    index: dict[str, list[int]] = defaultdict(list)
    for i, chunk in enumerate(chunks):
        tokens = set(_tokenize(chunk["text"]))
        for token in tokens:
            index[token].append(i)
    return dict(index)


def _keyword_prefilter(query: str, top_n: int = 300) -> list[int]:
    """Use inverted index to find candidate chunks matching query keywords.
    Returns indices of the most relevant chunks based on keyword overlap."""
    if not _inverted_index:
        # Fallback: return all indices (will trigger full scan)
        return list(range(_num_chunks))

    query_tokens = _tokenize(query)
    if not query_tokens:
        return list(range(min(top_n, _num_chunks)))

    # Score chunks by number of matching keywords
    scores: dict[int, int] = defaultdict(int)
    for token in query_tokens:
        for idx in _inverted_index.get(token, []):
            scores[idx] += 1

    if not scores:
        # No keyword matches — return a sample of chunks
        return list(range(min(top_n, _num_chunks)))

    # Sort by score (descending) and return top_n
    sorted_indices = sorted(scores.keys(), key=lambda i: scores[i], reverse=True)
    return sorted_indices[:top_n]


def _cosine_similarity_sparse(query_vec: np.ndarray, matrix: np.ndarray, indices: list[int]) -> list[tuple[int, float]]:
    """Compute cosine similarity between query vector and SELECTED document vectors.
    Only loads the specified rows from the (memory-mapped) matrix.
    Returns list of (index, score) tuples."""
    q = query_vec.astype(np.float32)
    query_norm = q / (np.linalg.norm(q) + 1e-10)

    results = []
    # Process in small batches to minimize memory
    batch_size = 100
    for batch_start in range(0, len(indices), batch_size):
        batch_indices = indices[batch_start:batch_start + batch_size]
        # Load only the needed rows from mmap
        rows = np.array([matrix[i] for i in batch_indices], dtype=np.float32)
        norms = np.linalg.norm(rows, axis=1, keepdims=True) + 1e-10
        rows_norm = rows / norms
        scores = rows_norm @ query_norm
        for j, idx in enumerate(batch_indices):
            results.append((idx, float(scores[j])))
        del rows, norms, rows_norm, scores

    return results


def _get_embedding(text: str) -> list[float]:
    """Get embedding vector for text using Gemini embedding model."""
    if not _gemini_client:
        raise RuntimeError("Gemini client not initialized for embeddings")

    try:
        result = _gemini_client.models.embed_content(
            model="gemini-embedding-001",
            contents=text,
        )
        return result.embeddings[0].values
    except Exception as e:
        print(f"Embedding error: {e}")
        # Fallback to preview model
        try:
            result = _gemini_client.models.embed_content(
                model="gemini-embedding-2-preview",
                contents=text,
            )
            return result.embeddings[0].values
        except Exception as e2:
            print(f"Fallback embedding error: {e2}")
            raise


def _load_cache() -> tuple[list[dict], list[list[float]]]:
    """Load cached embeddings from disk. Prefers compact binary format (.npz + .json)."""
    # Try binary format first (40MB vs 266MB, much faster, lower memory)
    if os.path.exists(EMBEDDINGS_NPZ_PATH) and os.path.exists(CHUNKS_JSON_PATH):
        try:
            print(f"Loading binary embeddings from {EMBEDDINGS_NPZ_PATH}")
            npz_data = np.load(EMBEDDINGS_NPZ_PATH)
            embeddings_f16 = npz_data["embeddings"]  # float16 array
            with open(CHUNKS_JSON_PATH, "r") as f:
                chunks = json.load(f)
            print(f"Loaded {len(chunks)} chunks, {embeddings_f16.shape} embeddings (binary format)")
            return chunks, embeddings_f16  # Return numpy array directly
        except Exception as e:
            print(f"Warning: Could not load binary cache: {e}")

    # Fallback to legacy JSON format
    if not os.path.exists(EMBEDDINGS_CACHE_PATH):
        return [], []
    try:
        print(f"Loading JSON embeddings from {EMBEDDINGS_CACHE_PATH}")
        with open(EMBEDDINGS_CACHE_PATH, "r") as f:
            data = json.load(f)
        return data.get("chunks", []), data.get("embeddings", [])
    except Exception as e:
        print(f"Warning: Could not load embeddings cache: {e}")
        return [], []


def _save_cache(chunks: list[dict], embeddings: list[list[float]]):
    """Save embeddings to disk cache."""
    try:
        cache_dir = os.path.dirname(EMBEDDINGS_CACHE_PATH)
        if cache_dir and not os.path.exists(cache_dir):
            os.makedirs(cache_dir, exist_ok=True)
        with open(EMBEDDINGS_CACHE_PATH, "w") as f:
            json.dump({"chunks": chunks, "embeddings": embeddings}, f)
        print(f"Saved {len(chunks)} chunk embeddings to cache")
    except Exception as e:
        print(f"Warning: Could not save embeddings cache: {e}")


def _load_chunks_from_files(training_data_dir: str) -> list[dict]:
    """Load training content from filesystem and chunk it. Memory-intensive — only used when cache is missing."""
    all_chunks = []

    # 1. Load text transcripts (379 files)
    transcripts_dir = os.path.join(training_data_dir, "transcripts")
    if os.path.exists(transcripts_dir):
        count = 0
        for fname in sorted(os.listdir(transcripts_dir)):
            if not fname.endswith(".json"):
                continue
            fpath = os.path.join(transcripts_dir, fname)
            try:
                with open(fpath, "r") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    text = data.get("content", "") or data.get("text", "") or data.get("analysis", "")
                    if isinstance(text, dict):
                        text = json.dumps(text)
                    title = data.get("title", fname)
                    all_chunks.extend(_chunk_text(text, f"transcript:{title}", "training"))
                    count += 1
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict):
                            text = item.get("content", "") or item.get("text", "") or item.get("analysis", "")
                            if isinstance(text, dict):
                                text = json.dumps(text)
                            title = item.get("title", fname)
                            all_chunks.extend(_chunk_text(text, f"transcript:{title}", "training"))
                    count += 1
            except Exception as e:
                print(f"Warning: Could not load transcript {fname}: {e}")
        print(f"Loaded {count} text transcript files")

    # 2. Load video transcripts (327 files)
    video_dir = os.path.join(training_data_dir, "video_transcripts")
    if os.path.exists(video_dir):
        count = 0
        for fname in sorted(os.listdir(video_dir)):
            if not fname.endswith(".json"):
                continue
            fpath = os.path.join(video_dir, fname)
            try:
                with open(fpath, "r") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    text = data.get("analysis", "") or data.get("content", "") or data.get("text", "")
                    if isinstance(text, dict):
                        text = json.dumps(text)
                    title = data.get("title", data.get("video_title", fname))
                    all_chunks.extend(_chunk_text(text, f"video:{title}", "video_training"))
                    count += 1
            except Exception as e:
                print(f"Warning: Could not load video transcript {fname}: {e}")
        print(f"Loaded {count} video transcript files")

    # 3. Load Crown Council content
    cc_dir = os.path.join(training_data_dir, "crown-council")
    if os.path.exists(cc_dir):
        for fname in sorted(os.listdir(cc_dir)):
            fpath = os.path.join(cc_dir, fname)
            if fname.endswith(".json"):
                try:
                    with open(fpath, "r") as f:
                        data = json.load(f)
                    if isinstance(data, dict):
                        text = json.dumps(data)
                    elif isinstance(data, list):
                        text = json.dumps(data)
                    else:
                        text = str(data)
                    all_chunks.extend(_chunk_text(text, f"crown-council:{fname}", "crown_council"))
                except Exception:
                    pass
            elif fname.endswith(".md"):
                try:
                    with open(fpath, "r") as f:
                        text = f.read()
                    all_chunks.extend(_chunk_text(text, f"crown-council:{fname}", "crown_council"))
                except Exception:
                    pass
        print(f"Loaded Crown Council content")

    # 4. Load ToPS content
    tops_dir = os.path.join(training_data_dir, "tops")
    if os.path.exists(tops_dir):
        for fname in sorted(os.listdir(tops_dir)):
            fpath = os.path.join(tops_dir, fname)
            try:
                with open(fpath, "r") as f:
                    text = f.read()
                all_chunks.extend(_chunk_text(text, f"tops:{fname}", "tops"))
            except Exception:
                pass
        print(f"Loaded ToPS content")

    # 5. Load frameworks
    frameworks_dir = os.path.join(training_data_dir, "..", "frameworks")
    if os.path.exists(frameworks_dir):
        for fname in sorted(os.listdir(frameworks_dir)):
            fpath = os.path.join(frameworks_dir, fname)
            try:
                with open(fpath, "r") as f:
                    text = f.read()
                all_chunks.extend(_chunk_text(text, f"framework:{fname}", "framework"))
            except Exception:
                pass
        print(f"Loaded frameworks content")

    # 6. Load Natural Laws synthesis
    nl_path = os.path.join(training_data_dir, "crown-council", "natural_laws_synthesis.md")
    if os.path.exists(nl_path):
        with open(nl_path, "r") as f:
            text = f.read()
        all_chunks.extend(_chunk_text(text, "natural_laws_synthesis", "philosophy"))
        print(f"Loaded Natural Laws synthesis")

    # 7. Load verbal skills map
    vs_path = os.path.join(training_data_dir, "natural_law_verbal_skills_map.json")
    if os.path.exists(vs_path):
        try:
            with open(vs_path, "r") as f:
                data = json.load(f)
            text = json.dumps(data)
            all_chunks.extend(_chunk_text(text, "verbal_skills_map", "verbal_skills"))
            print(f"Loaded verbal skills map")
        except Exception:
            pass

    return all_chunks


def _get_chunk_text(index: int) -> str:
    """Read a single chunk's text from the JSONL file using pre-computed byte offsets.
    This avoids loading all chunk text into memory — only reads the specific line needed."""
    if _chunks_text_file is None or index >= len(_chunks_text_offsets):
        return ""
    try:
        _chunks_text_file.seek(_chunks_text_offsets[index])
        line = _chunks_text_file.readline()
        return json.loads(line)
    except Exception as e:
        print(f"Warning: Could not read chunk text at index {index}: {e}")
        return ""


def _get_chunk_texts(indices: list[int]) -> list[str]:
    """Read multiple chunk texts from the JSONL file. Batched for efficiency."""
    results = []
    for idx in indices:
        results.append(_get_chunk_text(idx))
    return results


def initialize(gemini_client, training_data_dir: str = "/home/ubuntu/repos/cccd-training-architect/data"):
    """
    Initialize the RAG system with ultra-low memory loading for 256MB Fly.io machines.

    Memory budget breakdown:
    - Python + FastAPI + libs: ~100MB
    - Chunk metadata (source/category only, no text): ~2MB
    - Pre-built inverted index: ~5MB
    - Text offsets array: ~0.1MB
    - Embeddings via mmap: ~0 RSS (OS pages on demand)
    - Total at init: ~107MB (well within 256MB)
    - Per-query: ~3MB temporary (300 candidate rows from mmap)
    """
    global _chunks_meta, _chunks_text_offsets, _chunks_text_file
    global _embeddings, _embeddings_matrix, _inverted_index
    global _gemini_client, _is_initialized, _num_chunks

    _gemini_client = gemini_client

    # === Primary path: Split data files (lowest memory) ===
    split_files_exist = all(os.path.exists(p) for p in [
        EMBEDDINGS_NPY_PATH, CHUNKS_META_PATH, INVERTED_INDEX_PATH,
        CHUNKS_TEXT_PATH, CHUNKS_TEXT_OFFSETS_PATH
    ])

    if split_files_exist:
        try:
            print("Loading RAG with split-file architecture (ultra-low memory)...")

            # 1. Memory-mapped embeddings (~0 RSS)
            _embeddings_matrix = np.load(EMBEDDINGS_NPY_PATH, mmap_mode='r')
            print(f"  Embeddings mmap: {_embeddings_matrix.shape}")

            # 2. Chunk metadata WITHOUT text (~2MB)
            with open(CHUNKS_META_PATH, "r") as f:
                _chunks_meta = json.load(f)
            print(f"  Chunk metadata: {len(_chunks_meta)} entries")

            # 3. Pre-built inverted index (~5MB)
            with open(INVERTED_INDEX_PATH, "r") as f:
                _inverted_index = json.load(f)
            print(f"  Inverted index: {len(_inverted_index)} keys")

            # 4. Text offsets for random access (~0.1MB)
            with open(CHUNKS_TEXT_OFFSETS_PATH, "r") as f:
                _chunks_text_offsets = json.load(f)

            # 5. Open text file handle (kept open, ~0 RSS)
            _chunks_text_file = open(CHUNKS_TEXT_PATH, "r")

            _num_chunks = len(_chunks_meta)
            _embeddings = []
            _is_initialized = True

            if _embeddings_matrix.shape[0] != _num_chunks:
                print(f"  Warning: embeddings ({_embeddings_matrix.shape[0]}) != chunks ({_num_chunks})")

            print(f"RAG initialized (split-file): {_num_chunks} chunks, dim={_embeddings_matrix.shape[1]}, index keys={len(_inverted_index)}")
            print("RAG system initialized successfully")
            return
        except Exception as e:
            print(f"Warning: Could not load split files: {e}")

    # === Fallback: Legacy full chunks JSON ===
    if os.path.exists(EMBEDDINGS_NPY_PATH) and os.path.exists(CHUNKS_JSON_PATH):
        try:
            print("Falling back to legacy chunks JSON loading...")
            _embeddings_matrix = np.load(EMBEDDINGS_NPY_PATH, mmap_mode='r')
            with open(CHUNKS_JSON_PATH, "r") as f:
                cached_chunks = json.load(f)
            if _embeddings_matrix.shape[0] == len(cached_chunks):
                # Convert to split format for future low-memory loading
                _chunks_meta = [{"source": c["source"], "category": c["category"]} for c in cached_chunks]
                _inverted_index = _build_inverted_index_from_chunks(cached_chunks)
                _num_chunks = len(cached_chunks)
                _embeddings = []
                _is_initialized = True
                print(f"RAG index built (legacy): {_num_chunks} chunks")
                print("RAG system initialized successfully")
                return
        except Exception as e:
            print(f"Warning: Could not load legacy cache: {e}")

    print("Warning: No valid RAG data found. RAG search will be unavailable.")
    _is_initialized = False


def _build_inverted_index_from_chunks(chunks: list[dict]) -> dict[str, list[int]]:
    """Build inverted index from full chunk dicts (legacy fallback only)."""
    index: dict[str, list[int]] = defaultdict(list)
    for i, chunk in enumerate(chunks):
        tokens = set(_tokenize(chunk.get("text", "")))
        for token in tokens:
            index[token].append(i)
    return dict(index)


def search(query: str, top_k: int = TOP_K, category_filter: Optional[str] = None) -> list[dict]:
    """
    Two-stage search for memory-efficient RAG on low-memory machines:
    1. Keyword pre-filter: narrows 6671 chunks to ~300 candidates using inverted index (~0 RAM)
    2. Sparse cosine similarity: loads only candidate rows from mmap (~3MB vs 39MB for full scan)
    3. Text loaded on-demand only for top results (~5KB)

    Returns a list of dicts: {"text": str, "source": str, "category": str, "score": float}
    """
    if not _is_initialized or _embeddings_matrix is None or _num_chunks == 0:
        return []

    try:
        query_embedding = np.array(_get_embedding(query), dtype=np.float32)
    except Exception as e:
        print(f"RAG search error: {e}")
        return []

    # Stage 1: Keyword pre-filter to find candidate chunks
    candidate_indices = _keyword_prefilter(query, top_n=300)

    # Apply category filter if specified
    if category_filter:
        candidate_indices = [i for i in candidate_indices if i < len(_chunks_meta) and _chunks_meta[i]["category"] == category_filter]

    if not candidate_indices:
        return []

    # Stage 2: Sparse cosine similarity on candidates only
    scored = _cosine_similarity_sparse(query_embedding, _embeddings_matrix, candidate_indices)

    # Sort by score descending and take top-k
    scored.sort(key=lambda x: x[1], reverse=True)

    # Stage 3: Load text only for top results (on-demand from JSONL)
    results = []
    for idx, score in scored[:top_k]:
        if score < 0.1:  # Skip very low relevance
            continue
        text = _get_chunk_text(idx)
        meta = _chunks_meta[idx] if idx < len(_chunks_meta) else {"source": "unknown", "category": "unknown"}
        results.append({
            "text": text,
            "source": meta["source"],
            "category": meta["category"],
            "score": score,
        })

    return results


def get_context_for_query(query: str, max_chars: int = 4000) -> str:
    """
    Get formatted context string for a guest query.
    This is what gets injected into Sutton's prompt instead of the entire training corpus.
    """
    results = search(query, top_k=8)
    if not results:
        return ""

    context_parts = []
    total_chars = 0
    for r in results:
        text = r["text"]
        if total_chars + len(text) > max_chars:
            # Truncate to fit
            remaining = max_chars - total_chars
            if remaining > 100:
                text = text[:remaining]
            else:
                break
        context_parts.append(f"[Source: {r['source']} | Relevance: {r['score']:.2f}]\n{text}")
        total_chars += len(text)

    return "\n\n---\n\n".join(context_parts)


def get_stats() -> dict:
    """Get RAG system stats."""
    return {
        "initialized": _is_initialized,
        "total_chunks": _num_chunks,
        "embedding_dimensions": _embeddings_matrix.shape[1] if _embeddings_matrix is not None else 0,
        "categories": list(set(c["category"] for c in _chunks_meta)) if _chunks_meta else [],
        "chunks_by_category": {
            cat: sum(1 for c in _chunks_meta if c["category"] == cat)
            for cat in set(c["category"] for c in _chunks_meta)
        } if _chunks_meta else {},
        "inverted_index_keys": len(_inverted_index),
        "architecture": "split-file" if _chunks_text_file else "legacy",
    }
