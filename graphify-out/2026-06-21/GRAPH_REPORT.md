# Graph Report - sutton-api  (2026-06-13)

## Corpus Check
- 16 files · ~801,379 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 568 nodes · 1146 edges · 58 communities (44 shown, 14 thin omitted)
- Extraction: 77% EXTRACTED · 23% INFERRED · 0% AMBIGUOUS · INFERRED: 263 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `17a96509`
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
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Performance Review Analysis|Performance Review Analysis]]
- [[_COMMUNITY_Autoresearch Status|Autoresearch Status]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Competency Test Results|Competency Test Results]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Content Scanning Service|Content Scanning Service]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Training Session Logging|Training Session Logging]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 80|Community 80]]

## God Nodes (most connected - your core abstractions)
1. `RequestStatus` - 30 edges
2. `PhotoUploadResponse` - 29 edges
3. `AdminLoginResponse` - 29 edges
4. `StatusTransitionResponse` - 29 edges
5. `VCRequestUpdate` - 28 edges
6. `VCRequestRecord` - 28 edges
7. `ConsultationCreate` - 28 edges
8. `ConsultationUpdate` - 28 edges
9. `AdminLoginRequest` - 28 edges
10. `StatusTransitionRequest` - 28 edges

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

## Communities (58 total, 14 thin omitted)

### Community 0 - "VC Request Management"
Cohesion: 0.18
Nodes (11): add_training_content(), _load_chat_history(), load_dr_broome_rules(), load_saved_patches(), load_training_content(), Load chat_history from Supabase on startup., Add new ToPS training content that persists across restarts and updates Sutton's, Load persisted prompt patches from Supabase on startup. (+3 more)

### Community 1 - "API Data Models"
Cohesion: 0.12
Nodes (74): AdminLoginRequest, ChatRequest, ChatResponse, FeedbackRequest, HealthResponse, Path, Request body for AI Clone script generation., RecordingDeckRequest (+66 more)

### Community 2 - "Slide Library Management"
Cohesion: 0.20
Nodes (10): Search slides by treatment type, concern, complexity, cost, etc., Build a curated VC presentation deck for a specific guest., vc_build_presentation(), vc_slide_search(), get_slides_for_vc_presentation(), Search slides by treatment type, concern, complexity, cost, etc.      Args:, Search slides by treatment type, concern, complexity, cost, etc.      Args:, Build a curated slide deck for a VC presentation.      Returns intro slides, rel (+2 more)

### Community 3 - "RAG Search Engine"
Cohesion: 0.08
Nodes (34): _build_inverted_index(), _build_inverted_index_from_chunks(), _chunk_text(), _cosine_similarity_sparse(), _get_chunk_text(), _get_chunk_texts(), get_context_for_query(), _get_embedding() (+26 more)

### Community 4 - "Admin API Endpoints"
Cohesion: 0.22
Nodes (10): get_conversation(), get_conversation_context(), get_conversation_messages(), log_to_supabase(), _prepare_sutton_prompt(), Get conversation context as flat text (for Gemini fallback)., Get conversation history as proper multi-turn chat messages.     Returns list of, Prepare the system prompt, user prompt, and config for Sutton.     Returns (full (+2 more)

### Community 5 - "Consultation Review Workflow"
Cohesion: 0.29
Nodes (7): list_feedback(), Staff view of all tester feedback (admin-only)., _atomic_write_json(), get_feedback(), Write JSON atomically (temp + os.replace) so a crash mid-write can't corrupt PHI, _save_consultations(), save_feedback()

### Community 6 - "Admin Authentication"
Cohesion: 0.10
Nodes (23): cleanup_expired_sessions(), create_session(), _hash_password(), invalidate_session(), VC Portal MVP — Admin authentication and route protection.  MVP approach: shared, Validate a bearer token and return the session if valid., Invalidate (logout) a session., FastAPI dependency that requires valid admin authentication.          Usage: (+15 more)

### Community 7 - "Training and Testing"
Cohesion: 0.17
Nodes (12): _canary_scheduler(), _get_model_distribution(), Count how many responses each model served., Run a single canary test scenario and return results., Run all canary test scenarios and return aggregate results., Send email alert when canary tests fail., Background task that runs canary tests on a schedule., Manually trigger a canary test suite run. Returns results immediately. (+4 more)

### Community 8 - "Frontend UI Components"
Cohesion: 0.14
Nodes (13): App(), CAM_SIZES, Consultation, getFullSlideUrl(), RecordingDeck, SavedPresentation, SIZE_PRESETS, Slide (+5 more)

### Community 9 - "Chat Security and Safety"
Cohesion: 0.11
Nodes (21): add_to_conversation(), _build_incident(), chat(), chat_stream(), _check_message_safety(), _get_client_ip(), _is_ip_banned(), _pick_deflection() (+13 more)

### Community 10 - "LLM Response Generation"
Cohesion: 0.18
Nodes (11): _ensure_tokens(), get_consultations(), _load_consultations(), Get all consultations, optionally filtered by status., Get all consultations, optionally filtered by status., Get all consultations, optionally filtered by status., Backfill an unguessable token for any legacy consultation missing one., Backfill an unguessable token for any legacy consultation missing one. (+3 more)

### Community 11 - "LLM Provider Integration"
Cohesion: 0.40
Nodes (5): Get full details for a specific slide., vc_slide_detail(), get_slide_detail(), Get full details for a specific slide including raw notes., Get full details for a specific slide including raw notes.

### Community 12 - "Conversation Context Management"
Cohesion: 0.10
Nodes (22): get_vc_request_endpoint(), list_vc_requests(), List all VC requests, optionally filtered by status. Admin-protected.      Each, Get full details of a VC request. Admin-protected., Update a VC request (status, notes, etc.). Admin-protected., Transition a VC request to a new workflow status with validation.          Valid, transition_request_status(), update_vc_request_endpoint() (+14 more)

### Community 13 - "File Upload Service"
Cohesion: 0.14
Nodes (15): create_vc_request_endpoint(), Upload a patient photo. Returns the file path for linking to a request., Resolve `filename` inside `base`, blocking path traversal.      Rejects path sep, Serve a patient photo by its uuid filename (public-by-unguessable-name)., Upload a consultation video. Returns the file path for linking to a consultation, Serve a consultation video (public — patient needs to watch)., Verify a Cloudflare Turnstile token server-side. Returns False on any failure., Submit a new VC request from patient intake.      Required fields: first_name, l (+7 more)

### Community 14 - "System Infrastructure"
Cohesion: 0.40
Nodes (6): Content Monitor Service, Crown Council, .env Configuration, Health Check Endpoint, Selenium, Sutton API Service

### Community 15 - "Embedding Generation"
Cohesion: 0.53
Nodes (5): chunk_text(), get_embedding(), load_all_chunks(), main(), Batch embedding generator for RAG system. Generates all embeddings upfront and c

### Community 16 - "Chat History Persistence"
Cohesion: 0.15
Nodes (13): create_recording_deck(), list_recording_decks(), List all saved recording decks., Save a named recording deck (ordered list of slide numbers)., get_recording_decks(), _load_decks(), Save a named recording deck (ordered list of slide numbers)., Save a named recording deck (ordered list of slide numbers). (+5 more)

### Community 17 - "Prompt Patch Management"
Cohesion: 0.50
Nodes (4): autoresearch_apply(), Run autoresearch review and apply prompt patches to Sutton's system prompt., Save new prompt patches to Supabase for persistence., save_patches_to_supabase()

### Community 18 - "Canary Test Reporting"
Cohesion: 0.33
Nodes (6): clear_incidents(), get_canary_results(), Clear the security incident log. Admin use only., Get canary test history and current status., Summarize a batch of canary results into a run summary., _summarize_canary_run()

### Community 19 - "Model Usage Metrics"
Cohesion: 0.33
Nodes (6): delete_slide(), Persist the catalog back to disk., Persist the catalog back to disk., Remove a slide from the catalog and best-effort delete its image files., Remove a slide from the catalog and best-effort delete its image files., _save_catalog()

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (5): 1-wFoyJwZZA8pA87RZBr6lFsKHxH6tGGxYgHBxnNFjs, created_at, expires_at, is_valid, token

### Community 22 - "Autoresearch Status"
Cohesion: 0.29
Nodes (7): Path, Return (catalog_dir, images_dir), preferring a mounted /data volume., Return (catalog_dir, images_dir), preferring a mounted /data volume., Return path on persistent volume, seeding from app dir if needed., Return path on persistent volume, seeding from app dir if needed., _resolve_path(), _resolve_vc_dir()

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (15): create_vc_request(), delete_vc_request(), _load_requests(), VC Slide Sorter — indexes Dr. Broome's case library for the VC agent.  The VC ag, Create a new VC request from patient intake.          Required fields (Phase 2 s, Create a new VC request from patient intake.          Required fields (Phase 2 s, Create a new VC request from patient intake.          Required fields (Phase 2 s, Create a new VC request from patient intake.          Required fields (Phase 2 s (+7 more)

### Community 24 - "Competency Test Results"
Cohesion: 0.40
Nodes (5): Reorder slides based on a list of slide numbers., reorder_slides_endpoint(), Reorder the catalog based on a list of slide numbers., Reorder the catalog based on a list of slide numbers., reorder_slides()

### Community 25 - "Community 25"
Cohesion: 0.25
Nodes (8): create_consultation_endpoint(), Save a completed consultation to the archive., create_consultation(), Save a completed consultation to the archive., Save a completed consultation to the archive., Save a completed consultation to the archive., Save a completed consultation to the archive., Save a completed consultation to the archive.

### Community 26 - "Content Scanning Service"
Cohesion: 0.06
Nodes (31): autoresearch_review(), autoresearch_status(), clear_conversation(), content_monitor_process(), dashboard_full(), dashboard_stats(), dashboard_trends(), delete_vc_request_endpoint() (+23 more)

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (3): _load_catalog(), Load the indexed slide catalog from disk., Load the indexed slide catalog from disk.

### Community 28 - "Community 28"
Cohesion: 0.25
Nodes (8): record_play_by_token_endpoint(), Record that the patient pressed PLAY on their consultation video., Record that the patient pressed PLAY on their consultation video., Record that the patient pressed PLAY on their consultation video., Record that the patient pressed PLAY on their consultation video., Record that the patient pressed PLAY on their consultation video., record_play(), record_play_by_token()

### Community 29 - "Community 29"
Cohesion: 0.40
Nodes (5): Update a slide's metadata (rename, reclassify, etc.)., update_slide_endpoint(), Update a slide's metadata (condition, solution, treatments, concerns, etc.)., Update a slide's metadata (condition, solution, treatments, concerns, etc.)., update_slide()

### Community 31 - "Training Session Logging"
Cohesion: 0.29
Nodes (7): Staff-only integer-id watch recorder (patients use the by-token route)., record_watch_endpoint(), Record that a patient OPENED their consultation page., Record that a patient OPENED their consultation page., Record that a patient OPENED their consultation page., Record that a patient OPENED their consultation page., record_watch()

### Community 35 - "Community 35"
Cohesion: 0.40
Nodes (5): Get high-level stats about the VC slide catalog., vc_slide_stats(), get_catalog_stats(), Return high-level stats about the slide catalog., Return high-level stats about the slide catalog.

### Community 43 - "Community 43"
Cohesion: 0.29
Nodes (7): Reject uploads with the wrong content type, empty body, or over size limit., Add one or more new slides to the library from uploaded images., upload_slide_endpoint(), _validate_upload(), add_slide(), Add a new slide to the library from uploaded image bytes., Add a new slide to the library from uploaded image bytes.

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (6): delete_slide_endpoint(), list_all_slides(), Get all slides with full metadata for the manager UI., get_all_slides(), Return all slides with full metadata for the manager UI., Return all slides with full metadata for the manager UI.

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (10): _clean_corporate_filler(), competency_test(), _generate_openrouter_reply(), generate_sutton_reply(), Remove corporate filler phrases the LLM generates despite prompt bans., Generate a reply using OpenRouter (OpenAI-compatible API).     If 'messages' is, Generate a Sutton reply using the configured LLM provider.     Fallback chain: O, Run the ToPS Coach critic on a Sutton reply. Uses OpenRouter, Gemini, or Anthrop (+2 more)

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (5): Smart match -- describe guest concerns in natural language, get relevant slides., vc_slide_match(), match_guest_to_slides(), Smart matching — given a guest's description of their concerns,     find the mos, Smart matching — given a guest's description of their concerns,     find the mos

### Community 61 - "Community 61"
Cohesion: 0.22
Nodes (9): play_consultation(), Staff-only integer-id play recorder (patients use the by-token route)., Delete a recording deck by ID., remove_recording_deck(), delete_recording_deck(), Delete a recording deck by ID., Delete a recording deck by ID., Delete a recording deck by ID. (+1 more)

### Community 64 - "Community 64"
Cohesion: 0.17
Nodes (12): _generate_openrouter_reply_async(), _generate_reply_with_watchdog(), _generate_with_model(), _generate_with_timeout(), _quick_quality_check(), Async wrapper for OpenRouter generation (runs in thread pool)., Record a response metric for watchdog monitoring., Generate a reply with a specific Gemini model. Blocking call. (+4 more)

### Community 65 - "Community 65"
Cohesion: 0.22
Nodes (9): get_consultation_by_token_endpoint(), Public patient view via an unguessable token — no sequential-ID enumeration., record_watch_by_token_endpoint(), get_consultation_by_token(), Get a single consultation by its unguessable share token., Get a single consultation by its unguessable share token., Get a single consultation by its unguessable share token., Get a single consultation by its unguessable share token. (+1 more)

### Community 68 - "Community 68"
Cohesion: 0.15
Nodes (14): _audit_log(), _cleanup_old_media(), _client_ip(), _is_phi_public(), _is_public_path(), _is_rate_limited(), maintenance_cleanup(), Allowlist of routes reachable without a staff token. Everything else is     gate (+6 more)

### Community 80 - "Community 80"
Cohesion: 0.06
Nodes (40): approve_script(), email_consultation_review(), generate_clone_video(), generate_script(), get_consultation_endpoint(), list_consultations(), notify_patient(), Submit Dr. Broome's feedback — generates learning rules for BOTH Sutton and her (+32 more)

## Knowledge Gaps
- **19 isolated node(s):** `PreToolUse`, `HTTPAuthorizationCredentials`, `ndarray`, `token`, `created_at` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get_consultation()` connect `Community 80` to `Content Scanning Service`, `LLM Response Generation`, `Community 23`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `update_consultation()` connect `Community 80` to `API Data Models`, `Consultation Review Workflow`, `LLM Response Generation`, `Community 23`, `Content Scanning Service`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `create_consultation()` connect `Community 25` to `API Data Models`, `Consultation Review Workflow`, `LLM Response Generation`, `Community 23`, `Content Scanning Service`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 22 inferred relationships involving `RequestStatus` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`RequestStatus` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `PhotoUploadResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`PhotoUploadResponse` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `AdminLoginResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`AdminLoginResponse` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `StatusTransitionResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`StatusTransitionResponse` has 22 INFERRED edges - model-reasoned connections that need verification._