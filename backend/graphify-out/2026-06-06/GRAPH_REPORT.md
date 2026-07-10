# Graph Report - sutton-api  (2026-06-06)

## Corpus Check
- 14 files · ~798,144 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 419 nodes · 873 edges · 40 communities (27 shown, 13 thin omitted)
- Extraction: 76% EXTRACTED · 24% INFERRED · 0% AMBIGUOUS · INFERRED: 209 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `51726545`
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
- [[_COMMUNITY_Training Session Tracking|Training Session Tracking]]
- [[_COMMUNITY_Performance Review Analysis|Performance Review Analysis]]
- [[_COMMUNITY_Autoresearch Status|Autoresearch Status]]
- [[_COMMUNITY_Security Log Management|Security Log Management]]
- [[_COMMUNITY_Competency Test Results|Competency Test Results]]
- [[_COMMUNITY_Content Registration|Content Registration]]
- [[_COMMUNITY_Content Scanning Service|Content Scanning Service]]
- [[_COMMUNITY_System Dashboard|System Dashboard]]
- [[_COMMUNITY_Evaluation Statistics|Evaluation Statistics]]
- [[_COMMUNITY_RAG System Status|RAG System Status]]
- [[_COMMUNITY_Feedback Submission|Feedback Submission]]
- [[_COMMUNITY_Training Session Logging|Training Session Logging]]
- [[_COMMUNITY_Video Streaming Service|Video Streaming Service]]
- [[_COMMUNITY_Watchdog Health Monitoring|Watchdog Health Monitoring]]

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
- `Request` --uses--> `AdminLoginRequest`  [INFERRED]
  app/main.py → app/models.py
- `Request` --uses--> `AdminLoginResponse`  [INFERRED]
  app/main.py → app/models.py
- `Request` --uses--> `ConsultationCreate`  [INFERRED]
  app/main.py → app/models.py
- `Request` --uses--> `ConsultationUpdate`  [INFERRED]
  app/main.py → app/models.py
- `Request` --uses--> `PhotoUploadResponse`  [INFERRED]
  app/main.py → app/models.py

## Import Cycles
- None detected.

## Communities (40 total, 13 thin omitted)

### Community 0 - "VC Request Management"
Cohesion: 0.06
Nodes (49): create_consultation_endpoint(), create_recording_deck(), create_vc_request_endpoint(), delete_vc_request_endpoint(), get_vc_request_endpoint(), list_recording_decks(), list_vc_requests(), play_consultation() (+41 more)

### Community 1 - "API Data Models"
Cohesion: 0.19
Nodes (52): AdminLoginRequest, ChatRequest, ChatResponse, FeedbackRequest, HealthResponse, Transition a VC request to a new workflow status with validation.          Valid, Request body for AI Clone script generation., RecordingDeckRequest (+44 more)

### Community 2 - "Slide Library Management"
Cohesion: 0.06
Nodes (40): delete_slide_endpoint(), list_all_slides(), Get high-level stats about the VC slide catalog., Search slides by treatment type, concern, complexity, cost, etc., Get full details for a specific slide., Smart match -- describe guest concerns in natural language, get relevant slides., Build a curated VC presentation deck for a specific guest., Get all slides with full metadata for the manager UI. (+32 more)

### Community 3 - "RAG Search Engine"
Cohesion: 0.08
Nodes (34): _build_inverted_index(), _build_inverted_index_from_chunks(), _chunk_text(), _cosine_similarity_sparse(), _get_chunk_text(), _get_chunk_texts(), get_context_for_query(), _get_embedding() (+26 more)

### Community 4 - "Admin API Endpoints"
Cohesion: 0.06
Nodes (28): admin_session_status(), autoresearch_status(), content_monitor_process(), content_monitor_scan(), dashboard_stats(), dashboard_trends(), get_request_schema(), list_training_content() (+20 more)

### Community 5 - "Consultation Review Workflow"
Cohesion: 0.10
Nodes (27): approve_script(), email_consultation_review(), generate_clone_video(), generate_script(), get_consultation_endpoint(), list_consultations(), Send a review email via Resend (RESEND_API_KEY) or SMTP (SMTP_HOST...).     Retu, Email the consultation review link to the doctor's review address (default pjbro (+19 more)

### Community 6 - "Admin Authentication"
Cohesion: 0.11
Nodes (20): cleanup_expired_sessions(), create_session(), _hash_password(), invalidate_session(), VC Portal MVP — Admin authentication and route protection.  MVP approach: shared, Remove expired sessions from memory., Hash a password with SHA-256 for comparison., Verify the admin password against the stored hash. (+12 more)

### Community 7 - "Training and Testing"
Cohesion: 0.17
Nodes (13): add_training_content(), _canary_scheduler(), _load_chat_history(), load_dr_broome_rules(), load_saved_patches(), load_training_content(), Add new ToPS training content that persists across restarts and updates Sutton's, Background task that runs canary tests on a schedule. (+5 more)

### Community 8 - "Frontend UI Components"
Cohesion: 0.14
Nodes (13): App(), CAM_SIZES, Consultation, getFullSlideUrl(), RecordingDeck, SavedPresentation, SIZE_PRESETS, Slide (+5 more)

### Community 9 - "Chat Security and Safety"
Cohesion: 0.10
Nodes (24): add_to_conversation(), _build_incident(), chat(), chat_stream(), _check_message_safety(), clear_conversation(), _get_client_ip(), _is_ip_banned() (+16 more)

### Community 10 - "LLM Response Generation"
Cohesion: 0.20
Nodes (10): _generate_reply_with_watchdog(), _generate_with_model(), _generate_with_timeout(), _quick_quality_check(), Record a response metric for watchdog monitoring., Generate a reply with a specific Gemini model. Blocking call., Generate with timeout. Returns (reply, timed_out).     If timed_out is True, rep, Run a fast quality check using the Critic. Returns ToPS score (0-100).     Uses (+2 more)

### Community 11 - "LLM Provider Integration"
Cohesion: 0.18
Nodes (12): _clean_corporate_filler(), competency_test(), _generate_openrouter_reply(), _generate_openrouter_reply_async(), generate_sutton_reply(), Generate a reply using OpenRouter (OpenAI-compatible API).     If 'messages' is, Async wrapper for OpenRouter generation (runs in thread pool)., Generate a Sutton reply using the configured LLM provider.     Fallback chain: O (+4 more)

### Community 12 - "Conversation Context Management"
Cohesion: 0.24
Nodes (10): get_conversation(), get_conversation_context(), get_conversation_messages(), log_to_supabase(), _prepare_sutton_prompt(), Prepare the system prompt, user prompt, and config for Sutton.     Returns (full, Run Coach scoring in background — doesn't block the guest response., Get conversation context as flat text (for Gemini fallback). (+2 more)

### Community 13 - "File Upload Service"
Cohesion: 0.29
Nodes (7): Upload a patient photo. Returns the file path for linking to a request., Upload a consultation video. Returns the file path for linking to a consultation, upload_consult_video(), upload_patient_photo(), Return path on persistent volume, seeding from app dir if needed., _resolve_path(), Path

### Community 14 - "System Infrastructure"
Cohesion: 0.40
Nodes (6): Content Monitor Service, Crown Council, .env Configuration, Health Check Endpoint, Selenium, Sutton API Service

### Community 15 - "Embedding Generation"
Cohesion: 0.53
Nodes (5): chunk_text(), get_embedding(), load_all_chunks(), main(), Batch embedding generator for RAG system. Generates all embeddings upfront and c

### Community 16 - "Chat History Persistence"
Cohesion: 0.25
Nodes (8): Run a single canary test scenario and return results., Run all canary test scenarios and return aggregate results., Send email alert when canary tests fail., Manually trigger a canary test suite run. Returns results immediately., _run_canary_suite(), _run_single_canary(), _send_canary_alert(), trigger_canary()

### Community 17 - "Prompt Patch Management"
Cohesion: 0.50
Nodes (4): autoresearch_apply(), Run autoresearch review and apply prompt patches to Sutton's system prompt., Save new prompt patches to Supabase for persistence., save_patches_to_supabase()

### Community 18 - "Canary Test Reporting"
Cohesion: 0.50
Nodes (4): get_canary_results(), Get canary test history and current status., Summarize a batch of canary results into a run summary., _summarize_canary_run()

### Community 19 - "Model Usage Metrics"
Cohesion: 0.50
Nodes (4): _get_model_distribution(), Watchdog operational status — last 100 response metrics, averages, health., Count how many responses each model served., watchdog_status()

### Community 20 - "Training Session Tracking"
Cohesion: 0.50
Nodes (4): Start a Dr. Broome training session timer., Get Dr. Broome's total training time and session history., training_start(), training_stats()

## Knowledge Gaps
- **13 isolated node(s):** `HTTPAuthorizationCredentials`, `ndarray`, `Slide`, `RecordingDeck`, `SavedPresentation` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RequestStatus` connect `API Data Models` to `VC Request Management`, `Admin API Endpoints`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `get_consultation()` connect `Consultation Review Workflow` to `VC Request Management`, `Admin API Endpoints`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `update_consultation()` connect `Consultation Review Workflow` to `VC Request Management`, `API Data Models`, `Admin API Endpoints`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `RequestStatus` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`RequestStatus` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `PhotoUploadResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`PhotoUploadResponse` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `AdminLoginResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`AdminLoginResponse` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `StatusTransitionResponse` (e.g. with `AdminLoginRequest` and `ChatRequest`) actually correct?**
  _`StatusTransitionResponse` has 19 INFERRED edges - model-reasoned connections that need verification._