"""
Batch embedding generator for RAG system.
Generates all embeddings upfront and caches to disk.
Run this BEFORE starting the server so it starts instantly.
"""
import json
import os
import sys
import hashlib
import time

# Add app to path
sys.path.insert(0, os.path.dirname(__file__))

from google import genai

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
TRAINING_DATA_DIR = os.environ.get("TRAINING_DATA_DIR", "/home/ubuntu/repos/cccd-training-architect/data")
CACHE_PATH = os.environ.get("EMBEDDINGS_CACHE_PATH", "/tmp/rag_embeddings.json")
CHUNK_SIZE = 800
CHUNK_OVERLAP = 200

def chunk_text(text, source, category):
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

def load_all_chunks(data_dir):
    all_chunks = []
    
    # Text transcripts
    tdir = os.path.join(data_dir, "transcripts")
    if os.path.exists(tdir):
        count = 0
        for fname in sorted(os.listdir(tdir)):
            if not fname.endswith(".json"):
                continue
            try:
                with open(os.path.join(tdir, fname)) as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    text = data.get("content", "") or data.get("text", "") or data.get("analysis", "")
                    if isinstance(text, dict): text = json.dumps(text)
                    title = data.get("title", fname)
                    all_chunks.extend(chunk_text(text, f"transcript:{title}", "training"))
                    count += 1
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict):
                            text = item.get("content", "") or item.get("text", "") or item.get("analysis", "")
                            if isinstance(text, dict): text = json.dumps(text)
                            title = item.get("title", fname)
                            all_chunks.extend(chunk_text(text, f"transcript:{title}", "training"))
                    count += 1
            except Exception as e:
                print(f"  Skip {fname}: {e}")
        print(f"Loaded {count} text transcripts")

    # Video transcripts
    vdir = os.path.join(data_dir, "video_transcripts")
    if os.path.exists(vdir):
        count = 0
        for fname in sorted(os.listdir(vdir)):
            if not fname.endswith(".json"):
                continue
            try:
                with open(os.path.join(vdir, fname)) as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    text = data.get("analysis", "") or data.get("content", "") or data.get("text", "")
                    if isinstance(text, dict): text = json.dumps(text)
                    title = data.get("title", data.get("video_title", fname))
                    all_chunks.extend(chunk_text(text, f"video:{title}", "video_training"))
                    count += 1
            except Exception as e:
                print(f"  Skip {fname}: {e}")
        print(f"Loaded {count} video transcripts")

    # Crown Council
    ccdir = os.path.join(data_dir, "crown-council")
    if os.path.exists(ccdir):
        for fname in sorted(os.listdir(ccdir)):
            fpath = os.path.join(ccdir, fname)
            if fname.endswith(".json"):
                try:
                    with open(fpath) as f: data = json.load(f)
                    all_chunks.extend(chunk_text(json.dumps(data), f"crown-council:{fname}", "crown_council"))
                except: pass
            elif fname.endswith(".md"):
                try:
                    with open(fpath) as f: text = f.read()
                    all_chunks.extend(chunk_text(text, f"crown-council:{fname}", "crown_council"))
                except: pass
        print("Loaded Crown Council content")

    # ToPS
    topsdir = os.path.join(data_dir, "tops")
    if os.path.exists(topsdir):
        for fname in sorted(os.listdir(topsdir)):
            try:
                with open(os.path.join(topsdir, fname)) as f: text = f.read()
                all_chunks.extend(chunk_text(text, f"tops:{fname}", "tops"))
            except: pass
        print("Loaded ToPS content")

    # Frameworks
    fdir = os.path.join(data_dir, "..", "frameworks")
    if os.path.exists(fdir):
        for fname in sorted(os.listdir(fdir)):
            try:
                with open(os.path.join(fdir, fname)) as f: text = f.read()
                all_chunks.extend(chunk_text(text, f"framework:{fname}", "framework"))
            except: pass
        print("Loaded frameworks")

    # Natural Laws synthesis
    nlpath = os.path.join(data_dir, "crown-council", "natural_laws_synthesis.md")
    if os.path.exists(nlpath):
        with open(nlpath) as f: text = f.read()
        all_chunks.extend(chunk_text(text, "natural_laws_synthesis", "philosophy"))
        print("Loaded Natural Laws synthesis")

    # Verbal skills map
    vspath = os.path.join(data_dir, "natural_law_verbal_skills_map.json")
    if os.path.exists(vspath):
        try:
            with open(vspath) as f: data = json.load(f)
            all_chunks.extend(chunk_text(json.dumps(data), "verbal_skills_map", "verbal_skills"))
            print("Loaded verbal skills map")
        except: pass

    return all_chunks

def get_embedding(client, text, retries=3):
    for attempt in range(retries):
        try:
            result = client.models.embed_content(
                model="gemini-embedding-001",
                contents=text,
            )
            return result.embeddings[0].values
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                wait = 2 ** attempt
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"  Embedding error (attempt {attempt+1}): {e}")
                if attempt == retries - 1:
                    raise
                time.sleep(1)

def main():
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY not set")
        sys.exit(1)

    client = genai.Client(api_key=GEMINI_API_KEY)
    print(f"Training data: {TRAINING_DATA_DIR}")
    print(f"Cache path: {CACHE_PATH}")
    
    # Load chunks
    all_chunks = load_all_chunks(TRAINING_DATA_DIR)
    print(f"\nTotal chunks: {len(all_chunks)}")

    # Check existing cache
    cached_chunks = []
    cached_embeddings = []
    cached_ids = set()
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH) as f:
                data = json.load(f)
            cached_chunks = data.get("chunks", [])
            cached_embeddings = data.get("embeddings", [])
            cached_ids = {c["id"]: i for i, c in enumerate(cached_chunks)}
            print(f"Found cache with {len(cached_chunks)} chunks")
        except Exception as e:
            print(f"Could not load cache: {e}")

    # Generate embeddings
    embeddings = []
    new_count = 0
    cached_count = 0
    error_count = 0
    
    for i, chunk in enumerate(all_chunks):
        # Use cached if available
        if chunk["id"] in cached_ids:
            idx = cached_ids[chunk["id"]]
            if idx < len(cached_embeddings):
                embeddings.append(cached_embeddings[idx])
                cached_count += 1
                if (i + 1) % 500 == 0:
                    print(f"  Progress: {i+1}/{len(all_chunks)} ({cached_count} cached, {new_count} new, {error_count} errors)")
                continue

        # Skip empty text chunks
        text = chunk.get("text", "").strip()
        if not text:
            dim = len(embeddings[0]) if embeddings else 768
            embeddings.append([0.0] * dim)
            error_count += 1
            continue

        # Generate new embedding
        try:
            emb = get_embedding(client, text)
            embeddings.append(emb)
            new_count += 1
        except Exception as e:
            print(f"  ERROR chunk {chunk['id']}: {e}")
            # Zero vector fallback
            dim = len(embeddings[0]) if embeddings else 768
            embeddings.append([0.0] * dim)
            error_count += 1

        if (i + 1) % 100 == 0:
            print(f"  Progress: {i+1}/{len(all_chunks)} ({cached_count} cached, {new_count} new, {error_count} errors)")
            # Save intermediate cache every 500 new embeddings
            if new_count > 0 and new_count % 500 == 0:
                print("  Saving intermediate cache...")
                cache_dir = os.path.dirname(CACHE_PATH)
                if cache_dir and not os.path.exists(cache_dir):
                    os.makedirs(cache_dir, exist_ok=True)
                with open(CACHE_PATH, "w") as f:
                    json.dump({"chunks": all_chunks[:i+1], "embeddings": embeddings}, f)

    # Save final cache
    print(f"\nDone! {cached_count} cached, {new_count} new, {error_count} errors")
    cache_dir = os.path.dirname(CACHE_PATH)
    if cache_dir and not os.path.exists(cache_dir):
        os.makedirs(cache_dir, exist_ok=True)
    with open(CACHE_PATH, "w") as f:
        json.dump({"chunks": all_chunks, "embeddings": embeddings}, f)
    
    size_mb = os.path.getsize(CACHE_PATH) / (1024 * 1024)
    print(f"Cache saved: {CACHE_PATH} ({size_mb:.1f} MB)")
    print(f"Embedding dimensions: {len(embeddings[0]) if embeddings else 0}")

if __name__ == "__main__":
    main()
