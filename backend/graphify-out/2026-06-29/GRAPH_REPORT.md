# Graph Report - sutton-api  (2026-06-29)

## Corpus Check
- 16 files · ~801,755 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 689 nodes · 1270 edges · 68 communities (66 shown, 2 thin omitted)
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 263 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `59843817`
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
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 76|Community 76]]

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
- `admin_logout()` --calls--> `invalidate_session()`  [EXTRACTED]
  app/main.py → app/auth.py
- `Request` --uses--> `AdminLoginRequest`  [INFERRED]
  app/main.py → app/models.py
- `Request` --uses--> `AdminLoginResponse`  [INFERRED]
  app/main.py → app/models.py

## Import Cycles
- None detected.

## Communities (68 total, 2 thin omitted)

### Community 0 - "VC Request Management"
Cohesion: 0.05
Nodes (49): approve_script(), email_consultation_review(), generate_clone_video(), generate_script(), get_consultation_endpoint(), list_consultations(), notify_patient(), Submit Dr. Broome's feedback — generates learning rules for BOTH Sutton and her (+41 more)

### Community 1 - "API Data Models"
Cohesion: 0.13
Nodes (71): AdminLoginRequest, ChatRequest, ChatResponse, FeedbackRequest, HealthResponse, Path, Upload a consultation video. Returns the file path for linking to a consultation, Request body for AI Clone script generation. (+63 more)

### Community 2 - "Slide Library Management"
Cohesion: 0.18
Nodes (11): Search slides by treatment type, concern, complexity, cost, etc., Build a curated VC presentation deck for a specific guest., Build a curated VC presentation deck for a specific guest., vc_build_presentation(), vc_slide_search(), get_slides_for_vc_presentation(), Search slides by treatment type, concern, complexity, cost, etc.      Args:, Search slides by treatment type, concern, complexity, cost, etc.      Args: (+3 more)

### Community 3 - "RAG Search Engine"
Cohesion: 0.08
Nodes (34): _build_inverted_index(), _build_inverted_index_from_chunks(), _chunk_text(), _cosine_similarity_sparse(), _get_chunk_text(), _get_chunk_texts(), get_context_for_query(), _get_embedding() (+26 more)

### Community 4 - "Admin API Endpoints"
Cohesion: 0.33
Nodes (6): add_slide(), Persist the catalog back to disk., Persist the catalog back to disk., Add a new slide to the library from uploaded image bytes., Add a new slide to the library from uploaded image bytes., _save_catalog()

### Community 5 - "Consultation Review Workflow"
Cohesion: 0.67
Nodes (3): list_feedback(), Staff view of all tester feedback (admin-only)., Staff view of all tester feedback (admin-only).

### Community 6 - "Admin Authentication"
Cohesion: 0.10
Nodes (23): cleanup_expired_sessions(), create_session(), _hash_password(), invalidate_session(), VC Portal MVP — Admin authentication and route protection.  MVP approach: shared, Validate a bearer token and return the session if valid., Invalidate (logout) a session., FastAPI dependency that requires valid admin authentication.          Usage: (+15 more)

### Community 7 - "Training and Testing"
Cohesion: 0.05
Nodes (38): add_training_content(), _canary_scheduler(), _get_model_distribution(), _load_chat_history(), load_dr_broome_rules(), load_saved_patches(), load_training_content(), Load chat_history from Supabase on startup. (+30 more)

### Community 8 - "Frontend UI Components"
Cohesion: 0.14
Nodes (13): App(), CAM_SIZES, Consultation, getFullSlideUrl(), RecordingDeck, SavedPresentation, SIZE_PRESETS, Slide (+5 more)

### Community 9 - "Chat Security and Safety"
Cohesion: 0.06
Nodes (35): add_to_conversation(), _build_incident(), chat(), chat_stream(), _check_message_safety(), clear_conversation(), _get_client_ip(), _is_ip_banned() (+27 more)

### Community 10 - "LLM Response Generation"
Cohesion: 0.33
Nodes (6): get_consultations(), _load_consultations(), Get all consultations, optionally filtered by status., Get all consultations, optionally filtered by status., Get all consultations, optionally filtered by status., Get all consultations, optionally filtered by status.

### Community 11 - "LLM Provider Integration"
Cohesion: 0.33
Nodes (6): Get full details for a specific slide., Get full details for a specific slide., vc_slide_detail(), get_slide_detail(), Get full details for a specific slide including raw notes., Get full details for a specific slide including raw notes.

### Community 12 - "Conversation Context Management"
Cohesion: 0.07
Nodes (28): get_request_schema(), get_vc_request_endpoint(), list_vc_requests(), List all VC requests, optionally filtered by status. Admin-protected.      Each, List all VC requests, optionally filtered by status. Admin-protected.      Each, Return the VC request schema and valid workflow statuses., Get full details of a VC request. Admin-protected., Return the VC request schema and valid workflow statuses. (+20 more)

### Community 13 - "File Upload Service"
Cohesion: 0.07
Nodes (31): admin_logout(), create_vc_request_endpoint(), Reject uploads with the wrong content type, empty body, or over size limit., Reject uploads with the wrong content type, empty body, or over size limit., Add one or more new slides to the library from uploaded images., Add one or more new slides to the library from uploaded images., Invalidate the current admin session., Upload a patient photo. Returns the file path for linking to a request. (+23 more)

### Community 14 - "System Infrastructure"
Cohesion: 0.40
Nodes (6): Content Monitor Service, Crown Council, .env Configuration, Health Check Endpoint, Selenium, Sutton API Service

### Community 15 - "Embedding Generation"
Cohesion: 0.53
Nodes (5): chunk_text(), get_embedding(), load_all_chunks(), main(), Batch embedding generator for RAG system. Generates all embeddings upfront and c

### Community 16 - "Chat History Persistence"
Cohesion: 0.25
Nodes (8): list_recording_decks(), List all saved recording decks., List all saved recording decks., get_recording_decks(), _load_decks(), Return all saved recording decks., Return all saved recording decks., Return all saved recording decks.

### Community 17 - "Prompt Patch Management"
Cohesion: 0.33
Nodes (6): autoresearch_apply(), Save new prompt patches to Supabase for persistence., Run autoresearch review and apply prompt patches to Sutton's system prompt., Run autoresearch review and apply prompt patches to Sutton's system prompt., Save new prompt patches to Supabase for persistence., save_patches_to_supabase()

### Community 18 - "Canary Test Reporting"
Cohesion: 0.22
Nodes (9): clear_incidents(), get_canary_results(), Clear the security incident log. Admin use only., Clear the security incident log. Admin use only., Get canary test history and current status., Get canary test history and current status., Summarize a batch of canary results into a run summary., Summarize a batch of canary results into a run summary. (+1 more)

### Community 19 - "Model Usage Metrics"
Cohesion: 0.33
Nodes (6): delete_slide_endpoint(), Delete a slide from the library (removes catalog entry + image file)., Delete a slide from the library (removes catalog entry + image file)., delete_slide(), Remove a slide from the catalog and best-effort delete its image files., Remove a slide from the catalog and best-effort delete its image files.

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (5): 1-wFoyJwZZA8pA87RZBr6lFsKHxH6tGGxYgHBxnNFjs, created_at, expires_at, is_valid, token

### Community 22 - "Autoresearch Status"
Cohesion: 0.29
Nodes (7): Path, Return (catalog_dir, images_dir), preferring a mounted /data volume., Return (catalog_dir, images_dir), preferring a mounted /data volume., Return path on persistent volume, seeding from app dir if needed., Return path on persistent volume, seeding from app dir if needed., _resolve_path(), _resolve_vc_dir()

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (17): delete_vc_request_endpoint(), Delete a VC request. Admin-protected., Delete a VC request. Admin-protected., create_vc_request(), delete_vc_request(), _load_requests(), Create a new VC request from patient intake.          Required fields (Phase 2 s, Create a new VC request from patient intake.          Required fields (Phase 2 s (+9 more)

### Community 24 - "Competency Test Results"
Cohesion: 0.33
Nodes (6): Reorder slides based on a list of slide numbers., Reorder slides based on a list of slide numbers., reorder_slides_endpoint(), Reorder the catalog based on a list of slide numbers., Reorder the catalog based on a list of slide numbers., reorder_slides()

### Community 25 - "Community 25"
Cohesion: 0.22
Nodes (9): create_consultation_endpoint(), Save a completed consultation to the archive., Save a completed consultation to the archive., create_consultation(), Save a completed consultation to the archive., Save a completed consultation to the archive., Save a completed consultation to the archive., Save a completed consultation to the archive. (+1 more)

### Community 26 - "Content Scanning Service"
Cohesion: 0.67
Nodes (3): content_monitor_process(), Process registered content: analyze with Gemini and extract skills., Process registered content: analyze with Gemini and extract skills.

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (3): _load_catalog(), Load the indexed slide catalog from disk., Load the indexed slide catalog from disk.

### Community 28 - "Community 28"
Cohesion: 0.17
Nodes (12): play_consultation(), Staff-only integer-id play recorder (patients use the by-token route)., Delete a recording deck by ID., Staff-only integer-id play recorder (patients use the by-token route)., Delete a recording deck by ID., remove_recording_deck(), Record that the patient pressed PLAY on their consultation video., Record that the patient pressed PLAY on their consultation video. (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (6): Update a slide's metadata (rename, reclassify, etc.)., Update a slide's metadata (rename, reclassify, etc.)., update_slide_endpoint(), Update a slide's metadata (condition, solution, treatments, concerns, etc.)., Update a slide's metadata (condition, solution, treatments, concerns, etc.)., update_slide()

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (3): deactivate_training_content(), Deactivate a training content update (soft delete)., Deactivate a training content update (soft delete).

### Community 31 - "Training Session Logging"
Cohesion: 0.15
Nodes (14): Staff-only integer-id watch recorder (patients use the by-token route)., Staff-only integer-id watch recorder (patients use the by-token route)., record_watch_endpoint(), _ensure_tokens(), Backfill an unguessable token for any legacy consultation missing one., Backfill an unguessable token for any legacy consultation missing one., Backfill an unguessable token for any legacy consultation missing one., Backfill an unguessable token for any legacy consultation missing one. (+6 more)

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (3): content_monitor_scan(), Scan Crown Council for new content (compares against known catalog)., Scan Crown Council for new content (compares against known catalog).

### Community 33 - "Community 33"
Cohesion: 0.15
Nodes (14): _audit_log(), _client_ip(), _is_phi_public(), _is_public_path(), _is_rate_limited(), Allowlist of routes reachable without a staff token. Everything else is     gate, Allowlist of routes reachable without a staff token. Everything else is     gate, HIPAA access-audit line — metadata only, NO PHI (no names/photos/content).     W (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (6): Get high-level stats about the VC slide catalog., Get high-level stats about the VC slide catalog., vc_slide_stats(), get_catalog_stats(), Return high-level stats about the slide catalog., Return high-level stats about the slide catalog.

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (3): competency_results(), Get competency test history and pass rate., Get competency test history and pass rate.

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (3): Start a Dr. Broome training session timer., Start a Dr. Broome training session timer., training_start()

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (3): rag_status(), Get RAG system status and stats., Get RAG system status and stats.

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (3): Get Dr. Broome's total training time and session history., Get Dr. Broome's total training time and session history., training_stats()

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (6): list_all_slides(), Get all slides with full metadata for the manager UI., Get all slides with full metadata for the manager UI., get_all_slides(), Return all slides with full metadata for the manager UI., Return all slides with full metadata for the manager UI.

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (3): Remove an IP from the ban list. Admin use only., Remove an IP from the ban list. Admin use only., unban_ip()

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (7): create_recording_deck(), Save a named recording deck (ordered list of slide numbers)., Save a named recording deck (ordered list of slide numbers)., Save a named recording deck (ordered list of slide numbers)., Save a named recording deck (ordered list of slide numbers)., Save a named recording deck (ordered list of slide numbers)., save_recording_deck()

### Community 50 - "Community 50"
Cohesion: 0.33
Nodes (6): Search slides by treatment type, concern, complexity, cost, etc., Smart match -- describe guest concerns in natural language, get relevant slides., vc_slide_match(), match_guest_to_slides(), Smart matching — given a guest's description of their concerns,     find the mos, Smart matching — given a guest's description of their concerns,     find the mos

### Community 52 - "Community 52"
Cohesion: 0.40
Nodes (5): dashboard_stats(), dashboard_trends(), Returns live ToPS evaluation stats for the dashboard., Returns live ToPS evaluation stats for the dashboard., Returns daily average scores for trend charts.

### Community 54 - "Community 54"
Cohesion: 0.50
Nodes (4): AdminSession, Active admin session., Active admin session., Active admin session.

### Community 55 - "Community 55"
Cohesion: 0.67
Nodes (3): content_monitor_register(), Register new content discovered from Crown Council for processing., Register new content discovered from Crown Council for processing.

### Community 56 - "Community 56"
Cohesion: 0.67
Nodes (3): autoresearch_review(), Review low-scoring evaluations and identify improvement patterns., Review low-scoring evaluations and identify improvement patterns.

### Community 57 - "Community 57"
Cohesion: 0.67
Nodes (3): autoresearch_status(), Get the current state of autoresearch improvements., Get the current state of autoresearch improvements.

### Community 58 - "Community 58"
Cohesion: 0.67
Nodes (3): dashboard_full(), Combined dashboard data: ToPS scores + training time + acquisitions + competency, Combined dashboard data: ToPS scores + training time + acquisitions + competency

### Community 59 - "Community 59"
Cohesion: 0.67
Nodes (3): External monitoring endpoint. Returns degraded if avg quality drops below 70., External monitoring endpoint. Returns degraded if avg quality drops below 70., watchdog_health()

### Community 61 - "Community 61"
Cohesion: 0.25
Nodes (10): _atomic_write_json(), delete_recording_deck(), get_feedback(), VC Slide Sorter — indexes Dr. Broome's case library for the VC agent.  The VC ag, Write JSON atomically (temp + os.replace) so a crash mid-write can't corrupt PHI, Delete a recording deck by ID., Delete a recording deck by ID., Delete a recording deck by ID. (+2 more)

### Community 62 - "Community 62"
Cohesion: 0.67
Nodes (3): get_latest_conversation(), Return the most recent conversation with full UI data (ToPS scores, critic, etc), Return the most recent conversation with full UI data (ToPS scores, critic, etc)

### Community 63 - "Community 63"
Cohesion: 0.67
Nodes (3): healthz(), Health check endpoint showing provider and model info., Health check endpoint showing provider and model info.

### Community 64 - "Community 64"
Cohesion: 0.05
Nodes (47): _clean_corporate_filler(), competency_test(), _generate_openrouter_reply(), _generate_openrouter_reply_async(), _generate_reply_with_watchdog(), generate_sutton_reply(), _generate_with_model(), _generate_with_timeout() (+39 more)

### Community 65 - "Community 65"
Cohesion: 0.17
Nodes (12): get_consultation_by_token_endpoint(), Public patient view via an unguessable token — no sequential-ID enumeration., Public patient view via an unguessable token — no sequential-ID enumeration., record_play_by_token_endpoint(), record_watch_by_token_endpoint(), get_consultation_by_token(), Get a single consultation by its unguessable share token., Get a single consultation by its unguessable share token. (+4 more)

### Community 66 - "Community 66"
Cohesion: 0.67
Nodes (3): list_training_content(), List all persisted training content updates., List all persisted training content updates.

### Community 67 - "Community 67"
Cohesion: 0.67
Nodes (3): rag_search(), Test RAG search with a query., Test RAG search with a query.

### Community 68 - "Community 68"
Cohesion: 0.33
Nodes (6): _cleanup_old_media(), maintenance_cleanup(), Delete consult video files older than `days` (0 = disabled). Returns counts., Run media retention (delete consult videos older than VIDEO_RETENTION_DAYS)., Delete consult video files older than `days` (0 = disabled). Returns counts., Run media retention (delete consult videos older than VIDEO_RETENTION_DAYS).

### Community 69 - "Community 69"
Cohesion: 0.67
Nodes (3): Baseline security headers on every response (force_https is set in fly.toml)., Baseline security headers on every response (force_https is set in fly.toml)., security_headers()

### Community 71 - "Community 71"
Cohesion: 0.67
Nodes (3): Security incident log — shows all flagged jailbreak/reverse-engineering attempts, Security incident log — shows all flagged jailbreak/reverse-engineering attempts, watchdog_incidents()

### Community 72 - "Community 72"
Cohesion: 0.67
Nodes (3): content_monitor_acquisitions(), List all content acquisitions with status., List all content acquisitions with status.

### Community 73 - "Community 73"
Cohesion: 0.67
Nodes (3): Visual HTML dashboard for Watchdog canary results and system health., Visual HTML dashboard for Watchdog canary results and system health., watchdog_dashboard()

### Community 76 - "Community 76"
Cohesion: 0.67
Nodes (3): Stop a Dr. Broome training session timer and log duration., Stop a Dr. Broome training session timer and log duration., training_stop()

## Knowledge Gaps
- **20 isolated node(s):** `graphify`, `SECURITY — Patient input is UNTRUSTED (prompt-injection discipline) — MANDATORY`, `PreToolUse`, `HTTPAuthorizationCredentials`, `ndarray` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get_consultation()` connect `VC Request Management` to `Community 65`, `LLM Response Generation`, `Community 61`, `Training Session Logging`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `update_consultation()` connect `VC Request Management` to `Community 65`, `API Data Models`, `LLM Response Generation`, `Community 61`, `Training Session Logging`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `create_consultation()` connect `Community 25` to `Community 65`, `API Data Models`, `LLM Response Generation`, `Community 23`, `Community 61`, `Training Session Logging`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 22 inferred relationships involving `RequestStatus` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`RequestStatus` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `PhotoUploadResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`PhotoUploadResponse` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `AdminLoginResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`AdminLoginResponse` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `StatusTransitionResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`StatusTransitionResponse` has 22 INFERRED edges - model-reasoned connections that need verification._