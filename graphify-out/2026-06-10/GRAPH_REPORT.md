# Graph Report - sutton-api  (2026-06-09)

## Corpus Check
- 15 files · ~800,656 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 676 nodes · 1209 edges · 77 communities (75 shown, 2 thin omitted)
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 231 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9ddf8529`
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
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]

## God Nodes (most connected - your core abstractions)
1. `RequestStatus` - 29 edges
2. `PhotoUploadResponse` - 27 edges
3. `AdminLoginResponse` - 27 edges
4. `StatusTransitionResponse` - 27 edges
5. `VCRequestUpdate` - 26 edges
6. `VCRequestRecord` - 26 edges
7. `ConsultationCreate` - 26 edges
8. `ConsultationUpdate` - 26 edges
9. `AdminLoginRequest` - 26 edges
10. `StatusTransitionRequest` - 26 edges

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

## Communities (77 total, 2 thin omitted)

### Community 0 - "VC Request Management"
Cohesion: 0.18
Nodes (11): get_consultation_endpoint(), list_vc_requests(), List all VC requests, optionally filtered by status. Admin-protected.      Each, List all VC requests, optionally filtered by status. Admin-protected.      Each, Staff-only: full details of a consultation by internal ID (patients use the toke, Staff-only: full details of a consultation by internal ID (patients use the toke, get_vc_requests(), Get all VC requests, optionally filtered by status. (+3 more)

### Community 1 - "API Data Models"
Cohesion: 0.12
Nodes (72): AdminLoginRequest, chat(), ChatRequest, ChatResponse, FeedbackRequest, HealthResponse, Path, Reject uploads with the wrong content type, empty body, or over size limit. (+64 more)

### Community 2 - "Slide Library Management"
Cohesion: 0.22
Nodes (9): Search slides by treatment type, concern, complexity, cost, etc., Search slides by treatment type, concern, complexity, cost, etc., vc_slide_search(), get_slides_for_vc_presentation(), Search slides by treatment type, concern, complexity, cost, etc.      Args:, Search slides by treatment type, concern, complexity, cost, etc.      Args:, Build a curated slide deck for a VC presentation.      Returns intro slides, rel, Build a curated slide deck for a VC presentation.      Returns intro slides, rel (+1 more)

### Community 3 - "RAG Search Engine"
Cohesion: 0.08
Nodes (34): _build_inverted_index(), _build_inverted_index_from_chunks(), _chunk_text(), _cosine_similarity_sparse(), _get_chunk_text(), _get_chunk_texts(), get_context_for_query(), _get_embedding() (+26 more)

### Community 4 - "Admin API Endpoints"
Cohesion: 0.22
Nodes (9): get_vc_request_endpoint(), Get full details of a VC request. Admin-protected., Get full details of a VC request. Admin-protected., Get full details of a VC request. Admin-protected., get_vc_request(), Get a single VC request by ID., Get a single VC request by ID., Get a single VC request by ID. (+1 more)

### Community 5 - "Consultation Review Workflow"
Cohesion: 0.22
Nodes (9): Update a consultation., Update a consultation., Update a consultation., update_consultation_endpoint(), Update a consultation (watch status, resend, etc.)., Update a consultation (watch status, resend, etc.)., Update a consultation (watch status, resend, etc.)., Update a consultation (watch status, resend, etc.). (+1 more)

### Community 6 - "Admin Authentication"
Cohesion: 0.08
Nodes (30): cleanup_expired_sessions(), create_session(), _hash_password(), invalidate_session(), VC Portal MVP — Admin authentication and route protection.  MVP approach: shared, Invalidate (logout) a session., Invalidate (logout) a session., FastAPI dependency that requires valid admin authentication.          Usage: (+22 more)

### Community 7 - "Training and Testing"
Cohesion: 0.06
Nodes (36): add_training_content(), _canary_scheduler(), _load_chat_history(), load_dr_broome_rules(), load_saved_patches(), load_training_content(), Load chat_history from Supabase on startup., Load chat_history from Supabase on startup. (+28 more)

### Community 8 - "Frontend UI Components"
Cohesion: 0.14
Nodes (13): App(), CAM_SIZES, Consultation, getFullSlideUrl(), RecordingDeck, SavedPresentation, SIZE_PRESETS, Slide (+5 more)

### Community 9 - "Chat Security and Safety"
Cohesion: 0.06
Nodes (32): add_to_conversation(), _build_incident(), chat_stream(), _check_message_safety(), clear_conversation(), _get_client_ip(), _is_ip_banned(), _persist_chat_history() (+24 more)

### Community 10 - "LLM Response Generation"
Cohesion: 0.22
Nodes (9): list_consultations(), List all consultations, optionally filtered by status., List all consultations, optionally filtered by status., List all consultations, optionally filtered by status., get_consultations(), Get all consultations, optionally filtered by status., Get all consultations, optionally filtered by status., Get all consultations, optionally filtered by status. (+1 more)

### Community 11 - "LLM Provider Integration"
Cohesion: 0.22
Nodes (9): list_all_slides(), Get full details for a specific slide., Get full details for a specific slide., Get all slides with full metadata for the manager UI., Get all slides with full metadata for the manager UI., vc_slide_detail(), get_all_slides(), Return all slides with full metadata for the manager UI. (+1 more)

### Community 12 - "Conversation Context Management"
Cohesion: 0.05
Nodes (47): _clean_corporate_filler(), competency_test(), _generate_openrouter_reply(), _generate_openrouter_reply_async(), _generate_reply_with_watchdog(), generate_sutton_reply(), _generate_with_model(), _generate_with_timeout() (+39 more)

### Community 13 - "File Upload Service"
Cohesion: 0.18
Nodes (12): Resolve `filename` inside `base`, blocking path traversal.      Rejects path sep, Serve a patient photo by its uuid filename (public-by-unguessable-name)., Serve a consultation video (public — patient needs to watch)., Resolve `filename` inside `base`, blocking path traversal.      Rejects path sep, Serve a patient photo by its uuid filename (public-by-unguessable-name)., Serve a consultation video (public — patient needs to watch)., _safe_media_path(), serve_consult_video() (+4 more)

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
Nodes (6): autoresearch_apply(), Run autoresearch review and apply prompt patches to Sutton's system prompt., Run autoresearch review and apply prompt patches to Sutton's system prompt., Save new prompt patches to Supabase for persistence., Save new prompt patches to Supabase for persistence., save_patches_to_supabase()

### Community 18 - "Canary Test Reporting"
Cohesion: 0.25
Nodes (8): get_canary_results(), Get canary test history and current status., Get canary test history and current status., Summarize a batch of canary results into a run summary., Summarize a batch of canary results into a run summary., Get canary test history and current status., Summarize a batch of canary results into a run summary., _summarize_canary_run()

### Community 19 - "Model Usage Metrics"
Cohesion: 0.25
Nodes (8): _get_model_distribution(), Watchdog operational status — last 100 response metrics, averages, health., Watchdog operational status — last 100 response metrics, averages, health., Count how many responses each model served., Count how many responses each model served., Watchdog operational status — last 100 response metrics, averages, health., Count how many responses each model served., watchdog_status()

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (8): approve_script(), HITL step: Dr. Broome approves the AI-generated script., HITL step: Dr. Broome approves the AI-generated script., HITL step: Dr. Broome approves the AI-generated script., get_consultation(), Get a single consultation by ID., Get a single consultation by ID., Get a single consultation by ID.

### Community 22 - "Autoresearch Status"
Cohesion: 0.29
Nodes (7): Path, Return (catalog_dir, images_dir), preferring a mounted /data volume., Return (catalog_dir, images_dir), preferring a mounted /data volume., Return path on persistent volume, seeding from app dir if needed., Return path on persistent volume, seeding from app dir if needed., _resolve_path(), _resolve_vc_dir()

### Community 23 - "Community 23"
Cohesion: 0.26
Nodes (11): _atomic_write_json(), create_vc_request(), delete_vc_request(), _load_requests(), VC Slide Sorter — indexes Dr. Broome's case library for the VC agent.  The VC ag, Write JSON atomically (temp + os.replace) so a crash mid-write can't corrupt PHI, Create a new VC request from patient intake.          Required fields (Phase 2 s, Create a new VC request from patient intake.          Required fields (Phase 2 s (+3 more)

### Community 24 - "Competency Test Results"
Cohesion: 0.33
Nodes (6): Build a curated VC presentation deck for a specific guest., Build a curated VC presentation deck for a specific guest., Reorder slides based on a list of slide numbers., Reorder slides based on a list of slide numbers., reorder_slides_endpoint(), vc_build_presentation()

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (10): create_consultation(), Update a VC request (status, notes, etc.)., Update a VC request (status, notes, etc.)., Update a VC request (status, notes, etc.)., Update a VC request (status, notes, etc.)., Save a completed consultation to the archive., Save a completed consultation to the archive., Save a completed consultation to the archive. (+2 more)

### Community 26 - "Content Scanning Service"
Cohesion: 0.67
Nodes (3): dashboard_trends(), Returns daily average scores for trend charts., Returns daily average scores for trend charts.

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (13): Update a VC request (status, notes, etc.). Admin-protected., Update a VC request (status, notes, etc.). Admin-protected., Transition a VC request to a new workflow status with validation.          Valid, Transition a VC request to a new workflow status with validation.          Valid, Mark a consultation as resent and update follow-up dates., Update a VC request (status, notes, etc.). Admin-protected., Transition a VC request to a new workflow status with validation.          Valid, Mark a consultation as resent and update follow-up dates. (+5 more)

### Community 28 - "Community 28"
Cohesion: 0.20
Nodes (10): play_consultation(), Record that the patient pressed play (distinct from opening the page)., Record that the patient pressed play (distinct from opening the page)., record_play_by_token_endpoint(), Record that the patient pressed PLAY on their consultation video., Record that the patient pressed PLAY on their consultation video., Record that the patient pressed PLAY on their consultation video., Record that the patient pressed PLAY on their consultation video. (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (6): Update a slide's metadata (rename, reclassify, etc.)., Update a slide's metadata (rename, reclassify, etc.)., update_slide_endpoint(), Update a slide's metadata (condition, solution, treatments, concerns, etc.)., Update a slide's metadata (condition, solution, treatments, concerns, etc.)., update_slide()

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (3): Submit Dr. Broome's feedback — generates learning rules for BOTH Sutton and her, Submit Dr. Broome's feedback — generates learning rules for BOTH Sutton and her, submit_feedback()

### Community 31 - "Training Session Logging"
Cohesion: 0.12
Nodes (19): get_consultation_by_token_endpoint(), Public patient view via an unguessable token — no sequential-ID enumeration., Public patient view via an unguessable token — no sequential-ID enumeration., Public patient view via an unguessable token — no sequential-ID enumeration., record_watch_by_token_endpoint(), _ensure_tokens(), get_consultation_by_token(), _load_consultations() (+11 more)

### Community 32 - "Community 32"
Cohesion: 0.40
Nodes (5): content_monitor_scan(), Get Dr. Broome's total training time and session history., Get Dr. Broome's total training time and session history., Scan Crown Council for new content (compares against known catalog)., training_stats()

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (4): clear_incidents(), Clear the security incident log. Admin use only., Clear the security incident log. Admin use only., Clear the security incident log. Admin use only.

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
Cohesion: 0.50
Nodes (4): delete_vc_request_endpoint(), Delete a VC request. Admin-protected., Delete a VC request. Admin-protected., Delete a VC request. Admin-protected.

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (6): Add one or more new slides to the library from uploaded images., Add one or more new slides to the library from uploaded images., upload_slide_endpoint(), add_slide(), Add a new slide to the library from uploaded image bytes., Add a new slide to the library from uploaded image bytes.

### Community 44 - "Community 44"
Cohesion: 0.50
Nodes (4): get_request_schema(), Return the VC request schema and valid workflow statuses., Return the VC request schema and valid workflow statuses., Return the VC request schema and valid workflow statuses.

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (6): delete_slide_endpoint(), Delete a slide from the library (removes catalog entry + image file)., Delete a slide from the library (removes catalog entry + image file)., delete_slide(), Remove a slide from the catalog and best-effort delete its image files., Remove a slide from the catalog and best-effort delete its image files.

### Community 46 - "Community 46"
Cohesion: 0.50
Nodes (4): Visual HTML dashboard for Watchdog canary results and system health., Visual HTML dashboard for Watchdog canary results and system health., Visual HTML dashboard for Watchdog canary results and system health., watchdog_dashboard()

### Community 47 - "Community 47"
Cohesion: 0.50
Nodes (4): Remove an IP from the ban list. Admin use only., Remove an IP from the ban list. Admin use only., Remove an IP from the ban list. Admin use only., unban_ip()

### Community 48 - "Community 48"
Cohesion: 0.50
Nodes (4): Security incident log — shows all flagged jailbreak/reverse-engineering attempts, Security incident log — shows all flagged jailbreak/reverse-engineering attempts, Security incident log — shows all flagged jailbreak/reverse-engineering attempts, watchdog_incidents()

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (3): dashboard_full(), Combined dashboard data: ToPS scores + training time + acquisitions + competency, Combined dashboard data: ToPS scores + training time + acquisitions + competency

### Community 50 - "Community 50"
Cohesion: 0.33
Nodes (6): Smart match -- describe guest concerns in natural language, get relevant slides., Smart match -- describe guest concerns in natural language, get relevant slides., vc_slide_match(), match_guest_to_slides(), Smart matching — given a guest's description of their concerns,     find the mos, Smart matching — given a guest's description of their concerns,     find the mos

### Community 51 - "Community 51"
Cohesion: 0.67
Nodes (3): dashboard_stats(), Returns live ToPS evaluation stats for the dashboard., Returns live ToPS evaluation stats for the dashboard.

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (6): Reorder the catalog based on a list of slide numbers., Reorder the catalog based on a list of slide numbers., Persist the catalog back to disk., Persist the catalog back to disk., reorder_slides(), _save_catalog()

### Community 53 - "Community 53"
Cohesion: 0.67
Nodes (3): autoresearch_status(), Get the current state of autoresearch improvements., Get the current state of autoresearch improvements.

### Community 54 - "Community 54"
Cohesion: 0.67
Nodes (3): content_monitor_process(), Process registered content: analyze with Gemini and extract skills., Process registered content: analyze with Gemini and extract skills.

### Community 55 - "Community 55"
Cohesion: 0.67
Nodes (3): content_monitor_register(), Register new content discovered from Crown Council for processing., Register new content discovered from Crown Council for processing.

### Community 56 - "Community 56"
Cohesion: 0.67
Nodes (3): deactivate_training_content(), Deactivate a training content update (soft delete)., Deactivate a training content update (soft delete).

### Community 57 - "Community 57"
Cohesion: 0.67
Nodes (3): list_training_content(), List all persisted training content updates., List all persisted training content updates.

### Community 58 - "Community 58"
Cohesion: 0.67
Nodes (3): rag_status(), Get RAG system status and stats., Get RAG system status and stats.

### Community 59 - "Community 59"
Cohesion: 0.50
Nodes (4): External monitoring endpoint. Returns degraded if avg quality drops below 70., External monitoring endpoint. Returns degraded if avg quality drops below 70., External monitoring endpoint. Returns degraded if avg quality drops below 70., watchdog_health()

### Community 60 - "Community 60"
Cohesion: 0.25
Nodes (8): email_consultation_review(), notify_patient(), Send a review email via Resend (RESEND_API_KEY) or SMTP (SMTP_HOST...).     Retu, Email the consultation review link to the doctor's review address (default pjbro, Send a review email via Resend (RESEND_API_KEY) or SMTP (SMTP_HOST...).     Retu, Email the consultation review link to the doctor's review address (default pjbro, Email the PATIENT their personalized consultation video link, and mark sent., _send_review_email()

### Community 61 - "Community 61"
Cohesion: 0.25
Nodes (8): Delete a recording deck by ID., Delete a recording deck by ID., remove_recording_deck(), delete_recording_deck(), Delete a recording deck by ID., Delete a recording deck by ID., Delete a recording deck by ID., _save_decks()

### Community 62 - "Community 62"
Cohesion: 0.29
Nodes (7): create_recording_deck(), Save a named recording deck (ordered list of slide numbers)., Save a named recording deck (ordered list of slide numbers)., Save a named recording deck (ordered list of slide numbers)., Save a named recording deck (ordered list of slide numbers)., Save a named recording deck (ordered list of slide numbers)., save_recording_deck()

### Community 63 - "Community 63"
Cohesion: 0.29
Nodes (7): generate_script(), Record that a patient watched their consultation video., Record that a patient watched their consultation video., AI Clone agent hook: generate a video script from patient data + slides., Record that a patient watched their consultation video., AI Clone agent hook: generate a video script from patient data + slides., record_watch_endpoint()

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (6): get_slide_detail(), _load_catalog(), Get full details for a specific slide including raw notes., Get full details for a specific slide including raw notes., Load the indexed slide catalog from disk., Load the indexed slide catalog from disk.

### Community 65 - "Community 65"
Cohesion: 0.40
Nodes (5): create_vc_request_endpoint(), Submit a new VC request from patient intake.          Required fields: first_nam, Verify a Cloudflare Turnstile token server-side. Returns False on any failure., Submit a new VC request from patient intake.      Required fields: first_name, l, _verify_turnstile()

### Community 66 - "Community 66"
Cohesion: 0.40
Nodes (5): generate_clone_video(), Request body for AI Clone script generation., AI Clone agent hook: generate video from approved script + slides.          The, AI Clone agent hook: generate video from approved script + slides.          The, AI Clone agent hook: generate video from approved script + slides.          The

### Community 67 - "Community 67"
Cohesion: 0.50
Nodes (4): create_consultation_endpoint(), Save a completed consultation to the archive., Save a completed consultation to the archive., Save a completed consultation to the archive.

### Community 68 - "Community 68"
Cohesion: 0.16
Nodes (15): _audit_log(), _cleanup_old_media(), _client_ip(), _is_phi_public(), _is_public_path(), _is_rate_limited(), maintenance_cleanup(), Allowlist of routes reachable without a staff token. Everything else is     gate (+7 more)

### Community 69 - "Community 69"
Cohesion: 0.50
Nodes (4): HITL step: Dr. Broome rejects the AI-generated script for revision., HITL step: Dr. Broome rejects the AI-generated script for revision., HITL step: Dr. Broome rejects the AI-generated script for revision., reject_script()

### Community 70 - "Community 70"
Cohesion: 0.67
Nodes (3): admin_session_status(), Check current admin session status., Check current admin session status.

### Community 71 - "Community 71"
Cohesion: 0.67
Nodes (3): autoresearch_review(), Review low-scoring evaluations and identify improvement patterns., Review low-scoring evaluations and identify improvement patterns.

### Community 72 - "Community 72"
Cohesion: 0.67
Nodes (3): content_monitor_acquisitions(), List all content acquisitions with status., List all content acquisitions with status.

### Community 73 - "Community 73"
Cohesion: 0.67
Nodes (3): get_latest_conversation(), Return the most recent conversation with full UI data (ToPS scores, critic, etc), Return the most recent conversation with full UI data (ToPS scores, critic, etc)

### Community 74 - "Community 74"
Cohesion: 0.67
Nodes (3): healthz(), Health check endpoint showing provider and model info., Health check endpoint showing provider and model info.

### Community 75 - "Community 75"
Cohesion: 0.67
Nodes (3): rag_search(), Test RAG search with a query., Test RAG search with a query.

### Community 76 - "Community 76"
Cohesion: 0.67
Nodes (3): Stop a Dr. Broome training session timer and log duration., Stop a Dr. Broome training session timer and log duration., training_stop()

## Knowledge Gaps
- **15 isolated node(s):** `PreToolUse`, `HTTPAuthorizationCredentials`, `ndarray`, `Slide`, `RecordingDeck` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get_consultation()` connect `Community 20` to `VC Request Management`, `Community 66`, `Community 68`, `Community 69`, `LLM Response Generation`, `Training Session Logging`, `Community 23`, `Community 27`, `Community 60`, `Community 63`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `update_consultation()` connect `Consultation Review Workflow` to `API Data Models`, `Community 66`, `Community 68`, `Community 69`, `Training Session Logging`, `Community 20`, `Community 23`, `Community 27`, `Community 60`, `Community 63`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `create_consultation()` connect `Community 25` to `API Data Models`, `Community 67`, `Community 68`, `Community 23`, `Training Session Logging`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 21 inferred relationships involving `RequestStatus` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`RequestStatus` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `PhotoUploadResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`PhotoUploadResponse` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `AdminLoginResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`AdminLoginResponse` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `StatusTransitionResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`StatusTransitionResponse` has 21 INFERRED edges - model-reasoned connections that need verification._