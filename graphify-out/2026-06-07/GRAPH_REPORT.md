# Graph Report - sutton-api  (2026-06-07)

## Corpus Check
- 15 files · ~799,189 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 475 nodes · 954 edges · 45 communities (34 shown, 11 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 209 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `84f6b61e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_VC Request Management|VC Request Management]]
- [[_COMMUNITY_API Data Models|API Data Models]]
- [[_COMMUNITY_Slide Library Management|Slide Library Management]]
- [[_COMMUNITY_RAG Search Engine|RAG Search Engine]]
- [[_COMMUNITY_Admin API Endpoints|Admin API Endpoints]]
- [[_COMMUNITY_Consultation Review Workflow|Consultation Review Workflow]]
- [[_COMMUNITY_Admin Authentication|Admin Authentication]]
- [[_COMMUNITY_Training and Testing|Training and Testing]]
- [[_COMMUNITY_Frontend UI Components|Frontend UI Components]]
- [[_COMMUNITY_Chat Security and Safety|Chat Security and Safety]]
- [[_COMMUNITY_LLM Response Generation|LLM Response Generation]]
- [[_COMMUNITY_LLM Provider Integration|LLM Provider Integration]]
- [[_COMMUNITY_Conversation Context Management|Conversation Context Management]]
- [[_COMMUNITY_File Upload Service|File Upload Service]]
- [[_COMMUNITY_System Infrastructure|System Infrastructure]]
- [[_COMMUNITY_Embedding Generation|Embedding Generation]]
- [[_COMMUNITY_Chat History Persistence|Chat History Persistence]]
- [[_COMMUNITY_Prompt Patch Management|Prompt Patch Management]]
- [[_COMMUNITY_Canary Test Reporting|Canary Test Reporting]]
- [[_COMMUNITY_Model Usage Metrics|Model Usage Metrics]]
- [[_COMMUNITY_Performance Review Analysis|Performance Review Analysis]]
- [[_COMMUNITY_Autoresearch Status|Autoresearch Status]]
- [[_COMMUNITY_Competency Test Results|Competency Test Results]]
- [[_COMMUNITY_Content Scanning Service|Content Scanning Service]]
- [[_COMMUNITY_Training Session Logging|Training Session Logging]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]

## God Nodes (most connected - your core abstractions)
1. `RequestStatus` - 27 edges
2. `PhotoUploadResponse` - 24 edges
3. `AdminLoginResponse` - 24 edges
4. `StatusTransitionResponse` - 24 edges
5. `VCRequestCreate` - 23 edges
6. `VCRequestUpdate` - 23 edges
7. `VCRequestRecord` - 23 edges
8. `ConsultationCreate` - 23 edges
9. `ConsultationUpdate` - 23 edges
10. `AdminLoginRequest` - 23 edges

## Surprising Connections (you probably didn't know these)
- `test_traversal_is_blocked()` --calls--> `_safe_media_path()`  [EXTRACTED]
  tests/test_media_path_traversal.py → app/main.py
- `test_valid_filename_stays_in_base()` --calls--> `_safe_media_path()`  [EXTRACTED]
  tests/test_media_path_traversal.py → app/main.py
- `Request` --uses--> `AdminLoginRequest`  [INFERRED]
  app/main.py → app/models.py
- `Request` --uses--> `AdminLoginResponse`  [INFERRED]
  app/main.py → app/models.py
- `Request` --uses--> `ConsultationCreate`  [INFERRED]
  app/main.py → app/models.py

## Import Cycles
- None detected.

## Communities (45 total, 11 thin omitted)

### Community 0 - "VC Request Management"
Cohesion: 0.08
Nodes (29): create_vc_request_endpoint(), delete_vc_request_endpoint(), get_vc_request_endpoint(), list_vc_requests(), Submit a new VC request from patient intake.          Required fields: first_nam, List all VC requests, optionally filtered by status. Admin-protected., Get full details of a VC request. Admin-protected., Update a VC request (status, notes, etc.). Admin-protected. (+21 more)

### Community 1 - "API Data Models"
Cohesion: 0.22
Nodes (48): AdminLoginRequest, ChatRequest, ChatResponse, FeedbackRequest, HealthResponse, Request body for AI Clone script generation., RecordingDeckRequest, ReorderRequest (+40 more)

### Community 2 - "Slide Library Management"
Cohesion: 0.20
Nodes (10): Search slides by treatment type, concern, complexity, cost, etc., Build a curated VC presentation deck for a specific guest., vc_build_presentation(), vc_slide_search(), get_slides_for_vc_presentation(), Search slides by treatment type, concern, complexity, cost, etc.      Args:, Search slides by treatment type, concern, complexity, cost, etc.      Args:, Build a curated slide deck for a VC presentation.      Returns intro slides, rel (+2 more)

### Community 3 - "RAG Search Engine"
Cohesion: 0.08
Nodes (34): _build_inverted_index(), _build_inverted_index_from_chunks(), _chunk_text(), _cosine_similarity_sparse(), _get_chunk_text(), _get_chunk_texts(), get_context_for_query(), _get_embedding() (+26 more)

### Community 4 - "Admin API Endpoints"
Cohesion: 0.50
Nodes (4): content_monitor_process(), content_monitor_scan(), Scan Crown Council for new content (compares against known catalog)., Process registered content: analyze with Gemini and extract skills.

### Community 5 - "Consultation Review Workflow"
Cohesion: 0.12
Nodes (20): approve_script(), generate_clone_video(), generate_script(), get_consultation_endpoint(), list_consultations(), List all consultations, optionally filtered by status., Staff-only: full details of a consultation by internal ID (patients use the toke, Update a consultation. (+12 more)

### Community 6 - "Admin Authentication"
Cohesion: 0.11
Nodes (20): cleanup_expired_sessions(), create_session(), _hash_password(), invalidate_session(), VC Portal MVP — Admin authentication and route protection.  MVP approach: shared, Remove expired sessions from memory., Hash a password with SHA-256 for comparison., Verify the admin password against the stored hash. (+12 more)

### Community 7 - "Training and Testing"
Cohesion: 0.10
Nodes (21): add_training_content(), _canary_scheduler(), _load_chat_history(), load_dr_broome_rules(), load_saved_patches(), load_training_content(), Load chat_history from Supabase on startup., Add new ToPS training content that persists across restarts and updates Sutton's (+13 more)

### Community 8 - "Frontend UI Components"
Cohesion: 0.14
Nodes (13): App(), CAM_SIZES, Consultation, getFullSlideUrl(), RecordingDeck, SavedPresentation, SIZE_PRESETS, Slide (+5 more)

### Community 9 - "Chat Security and Safety"
Cohesion: 0.09
Nodes (26): add_to_conversation(), _build_incident(), chat(), chat_stream(), _check_message_safety(), clear_conversation(), _get_client_ip(), _is_ip_banned() (+18 more)

### Community 12 - "Conversation Context Management"
Cohesion: 0.07
Nodes (32): _clean_corporate_filler(), competency_test(), _generate_openrouter_reply(), _generate_openrouter_reply_async(), _generate_reply_with_watchdog(), generate_sutton_reply(), _generate_with_model(), _generate_with_timeout() (+24 more)

### Community 13 - "File Upload Service"
Cohesion: 0.09
Nodes (22): create_recording_deck(), Save a named recording deck (ordered list of slide numbers)., Upload a patient photo. Returns the file path for linking to a request., Resolve `filename` inside `base`, blocking path traversal.      Rejects path sep, Serve a patient photo by its uuid filename (public-by-unguessable-name)., Upload a consultation video. Returns the file path for linking to a consultation, Serve a consultation video (public — patient needs to watch)., _safe_media_path() (+14 more)

### Community 14 - "System Infrastructure"
Cohesion: 0.40
Nodes (6): Content Monitor Service, Crown Council, .env Configuration, Health Check Endpoint, Selenium, Sutton API Service

### Community 15 - "Embedding Generation"
Cohesion: 0.53
Nodes (5): chunk_text(), get_embedding(), load_all_chunks(), main(), Batch embedding generator for RAG system. Generates all embeddings upfront and c

### Community 16 - "Chat History Persistence"
Cohesion: 0.15
Nodes (16): list_recording_decks(), List all saved recording decks., Delete a recording deck by ID., remove_recording_deck(), delete_recording_deck(), get_recording_decks(), _load_decks(), VC Slide Sorter — indexes Dr. Broome's case library for the VC agent.  The VC ag (+8 more)

### Community 17 - "Prompt Patch Management"
Cohesion: 0.50
Nodes (4): autoresearch_apply(), Run autoresearch review and apply prompt patches to Sutton's system prompt., Save new prompt patches to Supabase for persistence., save_patches_to_supabase()

### Community 18 - "Canary Test Reporting"
Cohesion: 0.50
Nodes (4): get_canary_results(), Get canary test history and current status., Summarize a batch of canary results into a run summary., _summarize_canary_run()

### Community 19 - "Model Usage Metrics"
Cohesion: 0.50
Nodes (4): _get_model_distribution(), Watchdog operational status — last 100 response metrics, averages, health., Count how many responses each model served., watchdog_status()

### Community 31 - "Training Session Logging"
Cohesion: 0.12
Nodes (20): create_consultation_endpoint(), Save a completed consultation to the archive., Record that a patient watched their consultation video., record_watch_endpoint(), create_consultation(), _ensure_tokens(), get_consultations(), _load_consultations() (+12 more)

### Community 42 - "Community 42"
Cohesion: 0.25
Nodes (8): Get high-level stats about the VC slide catalog., vc_slide_stats(), get_catalog_stats(), _load_catalog(), Load the indexed slide catalog from disk., Load the indexed slide catalog from disk., Return high-level stats about the slide catalog., Return high-level stats about the slide catalog.

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (6): add_slide(), Persist the catalog back to disk., Persist the catalog back to disk., Add a new slide to the library from uploaded image bytes., Add a new slide to the library from uploaded image bytes., _save_catalog()

### Community 44 - "Community 44"
Cohesion: 0.50
Nodes (4): admin_session_status(), play_consultation(), Record that the patient pressed play (distinct from opening the page)., Check current admin session status.

### Community 45 - "Community 45"
Cohesion: 0.40
Nodes (5): delete_slide_endpoint(), Delete a slide from the library (removes catalog entry + image file)., delete_slide(), Remove a slide from the catalog and best-effort delete its image files., Remove a slide from the catalog and best-effort delete its image files.

### Community 46 - "Community 46"
Cohesion: 0.25
Nodes (8): get_consultation_by_token_endpoint(), Public patient view via an unguessable token — no sequential-ID enumeration., Mark a consultation as resent and update follow-up dates., record_play_by_token_endpoint(), resend_consultation(), get_consultation_by_token(), Get a single consultation by its unguessable share token., record_play_by_token()

### Community 47 - "Community 47"
Cohesion: 0.18
Nodes (11): email_consultation_review(), list_all_slides(), Get all slides with full metadata for the manager UI., Add one or more new slides to the library from uploaded images., Send a review email via Resend (RESEND_API_KEY) or SMTP (SMTP_HOST...).     Retu, Email the consultation review link to the doctor's review address (default pjbro, _send_review_email(), upload_slide_endpoint() (+3 more)

### Community 49 - "Community 49"
Cohesion: 0.40
Nodes (5): Get full details for a specific slide., vc_slide_detail(), get_slide_detail(), Get full details for a specific slide including raw notes., Get full details for a specific slide including raw notes.

### Community 50 - "Community 50"
Cohesion: 0.20
Nodes (10): Smart match -- describe guest concerns in natural language, get relevant slides., Update a slide's metadata (rename, reclassify, etc.)., update_slide_endpoint(), vc_slide_match(), match_guest_to_slides(), Smart matching — given a guest's description of their concerns,     find the mos, Smart matching — given a guest's description of their concerns,     find the mos, Update a slide's metadata (condition, solution, treatments, concerns, etc.). (+2 more)

### Community 52 - "Community 52"
Cohesion: 0.40
Nodes (5): Reorder slides based on a list of slide numbers., reorder_slides_endpoint(), Reorder the catalog based on a list of slide numbers., Reorder the catalog based on a list of slide numbers., reorder_slides()

### Community 53 - "Community 53"
Cohesion: 0.06
Nodes (30): autoresearch_review(), clear_incidents(), content_monitor_register(), dashboard_full(), dashboard_stats(), get_latest_conversation(), healthz(), list_training_content() (+22 more)

### Community 68 - "Community 68"
Cohesion: 0.50
Nodes (4): _is_public_path(), When VC_ADMIN_PASSWORD is set, require a valid staff token for every     non-pub, Allowlist of routes reachable without a staff token. Everything else is     gate, staff_auth_gate()

## Knowledge Gaps
- **15 isolated node(s):** `PreToolUse`, `HTTPAuthorizationCredentials`, `ndarray`, `Slide`, `RecordingDeck` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RequestStatus` connect `API Data Models` to `VC Request Management`, `Community 53`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `get_consultation()` connect `Consultation Review Workflow` to `Community 46`, `Community 47`, `Chat History Persistence`, `Community 53`, `Training Session Logging`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `update_slide()` connect `Community 50` to `Chat History Persistence`, `Community 42`, `Community 43`, `Community 53`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `RequestStatus` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`RequestStatus` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `PhotoUploadResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`PhotoUploadResponse` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `AdminLoginResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`AdminLoginResponse` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `StatusTransitionResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`StatusTransitionResponse` has 19 INFERRED edges - model-reasoned connections that need verification._