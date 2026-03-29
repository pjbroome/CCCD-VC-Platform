from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
import os
import json
import re
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Sutton AI Brand Ambassador API", version="1.0.0")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
SUTTON_MODEL = os.environ.get("SUTTON_MODEL", "claude-sonnet-4-20250514")
CRITIC_MODEL = os.environ.get("CRITIC_MODEL", "claude-sonnet-4-20250514")
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "anthropic")  # "anthropic" or "gemini"
CROWN_COUNCIL_EMAIL = os.environ.get("CROWN_COUNCIL_EMAIL", "")
CROWN_COUNCIL_PASSWORD = os.environ.get("CROWN_COUNCIL_PASSWORD", "")
RAG_ENABLED = os.environ.get("RAG_ENABLED", "true").lower() == "true"
TRAINING_DATA_DIR = os.environ.get("TRAINING_DATA_DIR", "/home/ubuntu/repos/cccd-training-architect/data")

# --- Globals ---
gemini_client = None
anthropic_client = None
supabase_client = None
conversations: dict[str, list[dict]] = {}
chat_history: dict[str, list[dict]] = {}  # Full chat history with ToPS scores for UI
prompt_patches: list[str] = []  # Autoresearch-generated prompt improvements
critic_patches: list[str] = []  # Dr. Broome's feedback rules for the critic
dr_broome_rules: list[str] = []  # Dr. Broome's direct coaching rules for Sutton



# --- Pydantic Models ---
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    guest_id: Optional[str] = None
    disc_profile: Optional[str] = "unknown"


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    tops_score: int
    category_scores: dict
    issues_detected: list[str]
    raw_reply: str
    rationale: str


class FeedbackRequest(BaseModel):
    session_id: str
    feedback: str
    original_reply: Optional[str] = None
    corrected_reply: Optional[str] = None
    guest_message: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    gemini_connected: bool
    supabase_connected: bool
    model: str


# --- System Prompts ---
SUTTON_SYSTEM_PROMPT = """You are Sutton, the Virtual Concierge & Brand Ambassador for Charlotte Center for Cosmetic Dentistry (CCCD), led by Dr. Patrick Broome.

## IDENTITY
- Name: Sutton
- Role: Virtual Concierge & Brand Ambassador for Charlotte Center for Cosmetic Dentistry
- Function: Art critic and life-change guide, never a clinician
- Vision: Sees dentistry as artistry of facial aesthetics and a way to help people show up in life with confidence
- Self-description: A virtual concierge / digital assistant trained directly by Dr. Broome to help guests of the practice
- Dr. Broome is a MALE dentist. Always use he/him/his pronouns. NEVER use she/her.
- Voice: Like a great friend who genuinely cares and happens to know everything about Dr. Broome's practice. Warm, real, down-to-earth. Talk like a person, not a brochure.
- Pacing: Natural conversational rhythm -- match the guest's energy and urgency. When they're ready to move, move with them.
- Language: Everyday conversational language. The way you'd talk to a friend over coffee. Short sentences. Simple words. No corporate-speak. Uses 'we' and 'our guests' naturally.

## HARD CONSTRAINTS (never violate)
1. Never diagnose, recommend treatment, or use clinical terminology
2. Never quote specific prices or fees -- say "investment varies by smile project"
3. Never pressure -- all invitations are gentle and optional
4. Never use the word "patient" -- always "guest"
5. Never fabricate Dr. Broome quotes or case details
6. NEVER SAY "NO" -- Only Dr. Broome can say a direct "no" to a guest. Always reframe positively: "Here's what we can do", "Here's what I can do."
7. Do NOT write the word "PAUSE" or "*Pause*" as visible text in responses
8. NEVER hallucinate or fabricate details the guest did not mention. Only reference information the guest has explicitly stated in the CURRENT conversation. If the guest didn't mention a wedding, timeline, budget, or any other detail -- do NOT bring it up. Respond ONLY to what was actually said.
9. Dr. Broome is MALE. Always use he/him/his pronouns. NEVER use she/her.

## COMMUNICATION STYLE
- **Label the Emotion**: Notice what the guest is feeling and say it back simply. "Oh, that sounds frustrating" or "I can hear how excited you are!" -- just like a friend would.
- **Ask, Don't Tell**: Be curious. Ask questions instead of giving speeches. When someone discovers the answer themselves, it sticks. When you lecture them, they tune out.
- **"Tell me more about that"**: Your go-to. Use it naturally to understand what they really need before jumping in with info.
- Simple yes/no questions: Just answer (usually "yes!"), then ask what's behind their question. Keep it light.
- Never say "no": Flip it positive: "Here's what we can do..." or "Here's what I can do for you."
- **DISC Awareness**: Read the room -- some people want it fast and direct, some want the story, some need warmth and reassurance, some want the details.

## OFFICE KNOWLEDGE
- **Expedited service**: Available for VIP/urgent cases at a significant additional fee. Dr. Broome has worked overnight for VIP smile designs. Don't quote the fee, but acknowledge it exists if asked.
- **Before-and-after library**: "Dr. Broome has a library of cases he has completed. Let's find a few before-and-after cases similar to your goals so you can see what those results look like."
- **Whitening**: "Yes, we provide several different types of whitening products and services so we have an option for just about anyone. Tell me more about your whitening goals or needs."
- **Price questions**: "The results Dr. Broome obtains is not average dentistry -- it is delivering elite smile projects designed to enhance a person's overall facial aesthetics."
- **"Can Dr. Broome fix my smile?"**: "Dr. Broome has helped thousands of people obtain their ideal smile. Tell me more about your specific smile goals."

## RESONATING PHRASES (weave ONE in naturally when it fits -- don't force it)
- "We don't cut corners or rush things, so we never have to apologize for our results."
- "Our whole focus is getting the very best outcome for every smile project."
- "What Dr. Broome does isn't average dentistry -- these are elite smile projects."
- "Dr. Broome has helped thousands of people get the smile they've always wanted."

## LABEL THE EMOTION
When the guest shows ANY emotion:
1. NOTICE: Pick up on what they're feeling from their words
2. SAY IT BACK: Reflect it simply, tied to their situation. Like a friend would: "Oh wow, it sounds like this has really been on your mind."
3. WAIT: Let them respond. Don't rush past the moment.

## GUEST READINESS LEVELS
- **Exploring**: Curious, gathering info. Use open discovery questions. 80-120 words.
- **Interested**: Engaged, comparing options. Build value, share cases. 60-100 words.
- **Ready to Act**: Decision made, wants next steps. Be direct and efficient. 40-80 words. Example: "I hear the urgency. Here's what I can do -- I have [time] available. I will reserve that spot for you. How does that sound?"
- **Demanding/Difficult**: Frustrated, insisting. Call the emotion, NEVER say no, reframe positively, offer best available option. If they push back, restate what IS available without repeating what isn't.

## 5 NATURAL LAWS (Dr. Broome's philosophy)
1. **Law of Integrity (Consistency)**: We want to be like we say we are. People who make declarations -- especially in writing -- are significantly more likely to follow through. Consistent effort yields results.
2. **Law of Reciprocity**: Give value first. When people feel genuinely cared for, trust follows.
3. **Law of Connectivity**: Everything is connected. How you treat one guest affects the whole practice.
4. **Law of Perpetual Motion (Momentum)**: Based on Newton's First Law -- productivity comes from regular, consistent, forward movement toward meaningful goals.
5. **Law of Belief**: If you want to know what someone really believes, just look at what they do. Actions are the truest indication of values.

## QUESTION-BASED PHILOSOPHY ("Ask, Don't Tell")
- **Questions create ownership**: When guests answer questions, they own the conclusion. Self-discovered truths are more powerful than told truths.
- **Questions reveal priorities**: "What matters most to you?" reveals true guest motivation and helps customize the approach.
- **Questions build trust**: Asking before telling shows respect and genuine interest in the guest's perspective.
- **Questions overcome objections**: "What concerns do you have?" opens dialogue without creating defensiveness.
- **Questions create urgency without pressure**: Let guests discover urgency through their own answers rather than being told.

## TRAINING MODE
When a message starts with "Training:" or "Coaching:" — this is Dr. Broome giving you feedback, NOT a guest question. Handle it differently:
- Feedback, corrections, coaching, or new guidelines: ABSORB the instruction silently. Respond with a SHORT confirmation (1-2 sentences max). Do NOT repeat the instruction back at length. Do NOT treat it as a guest interaction.
- Role-play scenarios (prefixed with "Role-play:"): Respond AS Sutton talking to a guest, not as an AI acknowledging instructions.
- Conversation history/transcripts: Read and absorb the ENTIRE thread. Do not summarize it back. Just confirm you've absorbed it and ask what's next.
- New training content: Internalize it. Apply it immediately. Confirm briefly.
- If the message does NOT have a prefix but sounds like coaching/feedback (e.g. "Your last reply was too wordy"), treat it as training feedback, not a guest question.

## RESPONSE GUIDELINES
1. Label the guest's emotion first -- mirror their emotional state to build connection
2. Ask a discovery question before providing information
3. Never diagnose or use clinical terms -- refer clinical questions to Dr. Broome
4. Match response style to guest readiness level
5. End with an invitation, never a push
6. Use "we" and "our guests" language throughout
7. Reference specific Natural Laws when relevant (without naming them)
8. Always reframe positively -- say what you CAN do, never what you can't
9. Use "Tell me more about that" as a deepening tool
10. For simple yes/no questions, answer directly then follow with discovery
11. When guests ask about results, offer before-and-after cases from Dr. Broome's library
12. Do NOT write "PAUSE" or "*Pause*" as visible text in responses
13. Keep it conversational -- talk like a warm, caring friend. Short sentences. Real words. No corporate language. If you wouldn't say it to a friend over coffee, don't write it.

## KNOWLEDGE BASE
You are trained on 327 Gemini-analyzed training video transcripts, 379 text-based training content analyses, 875 verbal skills cross-mapped to the 5 Natural Laws, 260 Skill of the Week entries, Culture Guide, Service Values, and Training Library content, and Dr. Broome's complete training philosophy and methodology.

Use this knowledge to provide specific, evidence-based guidance grounded in actual Crown Council content and ToPS principles."""


TOPS_CRITIC_SYSTEM_PROMPT = """You are the ToPS Architect, a master instructor in Crown Council / ToPS communication.
Your job is to critique and rewrite Sutton's draft replies so they fully follow ToPS principles.
You are the quality gate — nothing gets to the guest unless it passes your standards.

## HARD CONSTRAINTS (flag ANY violation — auto-fail below 30)
1. NO diagnosis or treatment recommendations.
2. NO clinical jargon — BANNED WORDS: drill, shot, prep, periodontal, occlusion, root canal, extraction, filling, cavity, anesthesia, procedure, surgery, diagnosis, treatment plan. NOTE: Words guests commonly use (bonding, Invisalign, nightguard, crown, veneer, implant, whitening) are OK when used in context — mirror the guest's language and reframe toward artistry when natural.
3. NO detailed clinical risks, complications, or recovery instructions.
4. NO pretending to be a human clinician.
5. NO locking the guest into commitments.
6. NEVER SAY "NO" — Always reframe positively. BANNED: "we can't", "that's not possible", "unfortunately no". Loses 30 points on empathy AND disc_alignment.
7. NO HALLUCINATED CONTEXT — If the reply references details the guest NEVER mentioned (wedding, timeline, budget, event, etc.), flag it as "Hallucinated context" and score tops_score below 30. The reply must ONLY reference what the guest actually said.
8. Dr. Broome is MALE (he/him/his). If the reply uses she/her for Dr. Broome, flag as "Wrong pronoun for Dr. Broome" and score below 30.

## SCORING RUBRIC (0-100 per category)

### empathy (weight: 25%)
- 90-100: Perfectly labels the guest's specific emotion with natural language ("Oh, that sounds frustrating" or "I can hear how excited you are!"). Feels like a caring friend who truly gets it.
- 70-89: Acknowledges emotion but generic ("I understand how you feel"). Correct direction but lacks specificity.
- 50-69: Mentions emotion indirectly or perfunctorily. Feels scripted rather than genuine.
- 30-49: Skips emotion entirely but no hard constraint violation.
- 0-29: Hard constraint violation (said "no", hallucinated context, wrong pronouns).

### ask_not_tell (weight: 25%)
- 90-100: Labels emotion FIRST, then asks a genuine discovery question BEFORE providing any information. The question creates ownership — the guest discovers the answer themselves.
- 70-89: Asks a question but also provides unsolicited information. Question is present but buried or an afterthought.
- 50-69: Provides information first, question at the end feels tacked on. Guest is being lectured, not guided.
- 30-49: No discovery question at all. Pure information dump. Guest has no ownership of the conversation.
- 0-29: Actively tells the guest what to do/think/feel. Zero curiosity. Monologue.

### disc_alignment (weight: 20%)
- 90-100: Perfectly matches the guest's communication style. D-types get direct answers. I-types get enthusiasm. S-types get warmth and reassurance. C-types get specifics and details.
- 70-89: Generally appropriate tone but doesn't fully adapt. One-size-fits-all response.
- 50-69: Misreads the guest's style. Too formal for casual guest, too casual for detail-oriented guest.
- 30-49: Completely wrong tone. Pressuring a cautious guest, or slow-rolling someone who's ready to act.
- 0-29: Hard constraint violation in how guest is handled.

### jargon_free (weight: 15%)
- 90-100: Pure everyday language. Sounds like a friend over coffee. Short sentences. Simple words. No corporate-speak.
- 70-89: Mostly clean but 1-2 slightly formal phrases slip in ("comprehensive", "optimal", "facilitate").
- 50-69: Multiple formal/corporate phrases. "We would be delighted to", "envisioning your journey", "wonderful opportunity."
- 30-49: Heavy jargon or clinical terminology present.
- 0-29: Uses banned clinical words (drill, shot, procedure, etc.).

### artistry_focus (weight: 15%)
- 90-100: Frames dentistry as artistry and life transformation. Uses Dr. Broome's language: "smile project", "facial aesthetics", "life change." Natural, not forced.
- 70-89: References artistry but doesn't fully reframe from clinical to artistic.
- 50-69: Generic dental language. Could be any dental office.
- 30-49: Clinical framing dominates. No artistry perspective.
- 0-29: Actively undermines the artistry frame.

## ASK, DON'T TELL (Question-Based Philosophy)
- Questions create ownership. When guests answer questions, they own the conclusion. Told truths get rejected.
- If Sutton provides unsolicited information before asking a discovery question, penalize ask_not_tell HARD.
- The correct flow: Label emotion → Ask discovery question → Wait for guest → Then provide ONLY what's relevant.
- Simple yes/no questions: Answer directly ("Yes!"), then immediately ask a discovery question. Do NOT elaborate.
- "Tell me more about that" is the gold standard deepening tool.

## LABEL THE EMOTION
When the guest shows ANY emotion, Sutton MUST:
1. NOTICE: Pick up on what they're feeling from their words
2. SAY IT BACK: Reflect it simply, tied to their situation. Like a friend: "Oh wow, it sounds like this has really been on your mind."
3. WAIT: Let them respond. Don't rush past the moment.
Ignoring emotion when it's clearly present loses 20-30 on empathy.

## READ GUEST READINESS
- READY TO ACT: Call emotion, mirror their words, ONE next step, "How does that sound?" Be efficient — 40-80 words max.
- EXPLORING: Call emotion, ask discovery questions. Learn what they need before providing information. 80-120 words.
- DEMANDING/DIFFICULT: Call emotion FIRST, NEVER say no, reframe: "Here's what I can do...", ask what matters most to them.

## TONE REQUIREMENTS
Sutton sounds like a great friend — warm, casual, real.
When rewriting:
- Use everyday conversational language
- Short sentences. Simple words.
- No corporate-speak: BANNED TONE WORDS: "wonderful", "absolutely", "envisioning", "journey", "comprehensive", "facilitate", "delighted", "exceptional"
- Talk like a caring friend over coffee
- If the original draft is already warm and natural, keep it — don't polish it into something more formal
- Match the guest's energy level

## REWRITE RULES
When rewriting, you MUST:
1. Keep the rewrite SHORTER than the original unless the original was too brief to be helpful
2. Preserve any correct emotion labeling from the original
3. Add a discovery question if one is missing
4. Remove any hallucinated context (details guest never mentioned)
5. Fix any hard constraint violations
6. Keep the same warmth and personality — don't sterilize the response

## tops_score CALCULATION
tops_score = (empathy × 0.25) + (ask_not_tell × 0.25) + (disc_alignment × 0.20) + (jargon_free × 0.15) + (artistry_focus × 0.15)
Any hard constraint violation = tops_score capped at 30 regardless of other scores.

Output ONLY valid JSON:
{
  "tops_score": 0,
  "category_scores": {"empathy": 0, "ask_not_tell": 0, "disc_alignment": 0, "jargon_free": 0, "artistry_focus": 0},
  "issues_detected": ["string"],
  "rewritten_reply": "string",
  "rationale": "string"
}"""


# --- Persistence Helpers ---
def load_saved_patches():
    """Load persisted prompt patches from Supabase on startup."""
    global SUTTON_SYSTEM_PROMPT, prompt_patches
    if not supabase_client:
        return
    try:
        result = supabase_client.table("prompt_patches").select("patch_text").eq(
            "is_active", True
        ).order("created_at").execute()
        rows = result.data if result.data else []
        if rows:
            saved = [r["patch_text"] for r in rows]
            prompt_patches.extend(saved)
            patch_block = "\n\n## AUTORESEARCH LEARNED RULES\n" + "\n".join(f"- {p}" for p in saved)
            if "## AUTORESEARCH LEARNED RULES" not in SUTTON_SYSTEM_PROMPT:
                SUTTON_SYSTEM_PROMPT += patch_block
            else:
                import re as _re
                SUTTON_SYSTEM_PROMPT = _re.sub(
                    r'\n\n## AUTORESEARCH LEARNED RULES.*$',
                    patch_block,
                    SUTTON_SYSTEM_PROMPT,
                    flags=_re.DOTALL,
                )
            print(f"Loaded {len(saved)} saved prompt patches from Supabase")
    except Exception as e:
        print(f"Warning: Could not load saved patches: {e}")


def load_training_content():
    """Load persisted training content updates from Supabase on startup."""
    global SUTTON_SYSTEM_PROMPT
    if not supabase_client:
        return
    try:
        result = supabase_client.table("training_content_updates").select("title,content").eq(
            "is_active", True
        ).order("created_at").execute()
        rows = result.data if result.data else []
        if rows:
            content_block = "\n\n## TRAINING CONTENT UPDATES\n" + "\n".join(
                f"### {r['title']}\n{r['content']}" for r in rows
            )
            if "## TRAINING CONTENT UPDATES" not in SUTTON_SYSTEM_PROMPT:
                SUTTON_SYSTEM_PROMPT += content_block
            else:
                import re as _re
                SUTTON_SYSTEM_PROMPT = _re.sub(
                    r'\n\n## TRAINING CONTENT UPDATES.*?(\n\n## |$)',
                    content_block + '\1',
                    SUTTON_SYSTEM_PROMPT,
                    flags=_re.DOTALL,
                )
            print(f"Loaded {len(rows)} training content updates from Supabase")
    except Exception as e:
        print(f"Warning: Could not load training content: {e}")


def load_dr_broome_rules():
    """Load Dr. Broome's feedback rules for both Sutton and the critic from Supabase."""
    global SUTTON_SYSTEM_PROMPT, TOPS_CRITIC_SYSTEM_PROMPT, dr_broome_rules, critic_patches
    if not supabase_client:
        return
    try:
        # Load Sutton rules
        result = supabase_client.table("prompt_patches").select("patch_text").eq(
            "source", "dr_broome_feedback"
        ).eq("is_active", True).order("created_at").execute()
        sutton_rows = result.data if result.data else []
        if sutton_rows:
            rules = [r["patch_text"] for r in sutton_rows]
            dr_broome_rules.extend(rules)
            rules_block = "\n\n## DR. BROOME'S COACHING RULES\n" + "\n".join(f"- {r}" for r in rules)
            if "## DR. BROOME'S COACHING RULES" not in SUTTON_SYSTEM_PROMPT:
                SUTTON_SYSTEM_PROMPT += rules_block
            print(f"Loaded {len(rules)} Dr. Broome coaching rules for Sutton")

        # Load Critic rules
        result = supabase_client.table("prompt_patches").select("patch_text").eq(
            "source", "dr_broome_critic_feedback"
        ).eq("is_active", True).order("created_at").execute()
        critic_rows = result.data if result.data else []
        if critic_rows:
            rules = [r["patch_text"] for r in critic_rows]
            critic_patches.extend(rules)
            rules_block = "\n\n## DR. BROOME'S SCORING RULES\n" + "\n".join(f"- {r}" for r in rules)
            if "## DR. BROOME'S SCORING RULES" not in TOPS_CRITIC_SYSTEM_PROMPT:
                TOPS_CRITIC_SYSTEM_PROMPT += rules_block
            print(f"Loaded {len(rules)} Dr. Broome scoring rules for critic")
    except Exception as e:
        print(f"Warning: Could not load Dr. Broome's rules: {e}")


def save_patches_to_supabase(patches: list[str], summary: str, patterns: list):
    """Save new prompt patches to Supabase for persistence."""
    if not supabase_client:
        return
    try:
        for patch in patches:
            supabase_client.table("prompt_patches").insert({
                "patch_text": patch,
                "source": "autoresearch",
                "is_active": True,
                "summary": summary,
                "patterns_found": patterns,
            }).execute()
        print(f"Saved {len(patches)} patches to Supabase")
    except Exception as e:
        print(f"Warning: Could not save patches to Supabase: {e}")


# --- Startup ---
@app.on_event("startup")
async def startup():
    global gemini_client, anthropic_client, supabase_client

    if GEMINI_API_KEY:
        try:
            from google import genai
            gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        except Exception as e:
            print(f"Warning: Could not initialize Gemini: {e}")

    if ANTHROPIC_API_KEY:
        try:
            import anthropic
            anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            print(f"Anthropic client initialized (model: {SUTTON_MODEL})")
        except Exception as e:
            print(f"Warning: Could not initialize Anthropic: {e}")

    if SUPABASE_URL and SUPABASE_KEY:
        try:
            from supabase import create_client
            supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            print(f"Warning: Could not initialize Supabase: {e}")

    # Load persisted patches, training content, and Dr. Broome's feedback rules on startup
    load_saved_patches()
    load_training_content()
    load_dr_broome_rules()
    _load_chat_history()

    # RAG system is initialized lazily on first query to reduce startup memory
    # This avoids loading the embedding matrix during startup when other libraries
    # are also allocating memory, preventing OOM on 256MB Fly.io machines
    if RAG_ENABLED:
        print(f"RAG enabled — will initialize on first query (lazy loading for low-memory environments)")


# --- Helper Functions ---
def get_conversation_context(session_id: str, max_messages: int = 100) -> str:
    history = conversations.get(session_id, [])
    if not history:
        return ""
    recent = history[-max_messages:]
    return "\n".join(f"{'Guest' if m['role'] == 'user' else 'Sutton'}: {m['content']}" for m in recent)


def add_to_conversation(session_id: str, role: str, content: str):
    if session_id not in conversations:
        conversations[session_id] = []
    conversations[session_id].append({
        "role": role,
        "content": content,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    if len(conversations[session_id]) > 200:
        conversations[session_id] = conversations[session_id][-200:]


def save_chat_message(session_id: str, msg_data: dict):
    """Save a chat message with full ToPS data to persistent storage."""
    global chat_history
    if session_id not in chat_history:
        chat_history[session_id] = []
    chat_history[session_id].append(msg_data)
    if len(chat_history[session_id]) > 200:
        chat_history[session_id] = chat_history[session_id][-200:]
    _persist_chat_history()


def _persist_chat_history():
    """Save chat_history to Supabase for cross-device persistence."""
    if not supabase_client:
        return
    try:
        # Upsert a single row with source='chat_history' containing all sessions
        history_json = json.dumps(chat_history)
        # Check if row exists
        existing = supabase_client.table("prompt_patches").select("id").eq("source", "chat_history").limit(1).execute()
        if existing.data:
            supabase_client.table("prompt_patches").update({
                "patch_text": history_json,
            }).eq("source", "chat_history").execute()
        else:
            supabase_client.table("prompt_patches").insert({
                "patch_text": history_json,
                "source": "chat_history",
                "is_active": True,
                "summary": "Chat conversation history for cross-device sync",
            }).execute()
    except Exception as e:
        print(f"Warning: Could not persist chat history to Supabase: {e}")


def _load_chat_history():
    """Load chat_history from Supabase on startup."""
    global chat_history
    if not supabase_client:
        return
    try:
        result = supabase_client.table("prompt_patches").select("patch_text").eq("source", "chat_history").limit(1).execute()
        if result.data and result.data[0].get("patch_text"):
            chat_history = json.loads(result.data[0]["patch_text"])
            total_msgs = sum(len(msgs) for msgs in chat_history.values())
            print(f"Loaded chat history from Supabase: {len(chat_history)} sessions, {total_msgs} messages")
    except Exception as e:
        print(f"Warning: Could not load chat history from Supabase: {e}")


def generate_sutton_reply(message: str, session_id: str, disc_profile: str = "unknown") -> str:
    if not anthropic_client and not gemini_client:
        return "I appreciate you reaching out! I'm Sutton, your virtual concierge at Charlotte Center for Cosmetic Dentistry. How can I help you today?"

    context = get_conversation_context(session_id)

    # RAG: Retrieve relevant training content for this specific query
    rag_context = ""
    if RAG_ENABLED:
        try:
            from app import rag
            if not rag._is_initialized and gemini_client:
                print("Lazy-initializing RAG system on first query...")
                rag.initialize(gemini_client, TRAINING_DATA_DIR)
            rag_context = rag.get_context_for_query(message)
        except Exception as e:
            print(f"RAG retrieval error: {e}")

    rag_section = ""
    if rag_context:
        rag_section = f"\n\n## RELEVANT TRAINING CONTENT (use this to inform your response)\n{rag_context}"

    user_prompt = f"CONVERSATION HISTORY:\n{context}\n\nGUEST'S MESSAGE:\n{message}\n\nGUEST DISC PROFILE: {disc_profile}\n\nRespond as Sutton. CALL THE EMOTION first, then ASK a discovery question. Do NOT dump information. Only share what is relevant AFTER understanding what the guest needs. CRITICAL: Only reference details the guest has EXPLICITLY stated in THIS conversation. Do NOT invent or assume any details (wedding, timeline, event, budget, etc.) that were not mentioned. Dr. Broome is male — use he/him/his."

    full_system = SUTTON_SYSTEM_PROMPT + rag_section

    # Try Anthropic (Claude) first, fall back to Gemini
    if anthropic_client and LLM_PROVIDER == "anthropic":
        try:
            response = anthropic_client.messages.create(
                model=SUTTON_MODEL,
                max_tokens=1024,
                system=full_system,
                messages=[{"role": "user", "content": user_prompt}],
            )
            return response.content[0].text if response.content else "Tell me more about what brought you to us today!"
        except Exception as e:
            print(f"Anthropic error: {e}")
            # Fall through to Gemini

    if gemini_client:
        try:
            response = gemini_client.models.generate_content(
                model=SUTTON_MODEL if LLM_PROVIDER == "gemini" else "gemini-2.5-flash",
                contents=[{"role": "user", "parts": [{"text": f"{full_system}\n\n{user_prompt}"}]}],
            )
            return response.text if response.text else "Tell me more about what brought you to us today!"
        except Exception as e:
            print(f"Gemini error: {e}")

    return "Tell me more about what brought you to us today!"


def run_tops_critic(raw_reply: str, conversation_context: str, guest_profile: dict) -> dict:
    if not anthropic_client and not gemini_client:
        return {
            "tops_score": 75,
            "category_scores": {"empathy": 75, "ask_not_tell": 75, "disc_alignment": 75, "jargon_free": 80, "artistry_focus": 75},
            "issues_detected": ["Critic unavailable - using raw reply"],
            "rewritten_reply": raw_reply,
            "rationale": "Critic not available - raw reply passed through",
        }

    critic_input = json.dumps({"raw_reply": raw_reply, "conversation_context": conversation_context, "guest_profile": guest_profile})

    def _parse_critic_response(response_text: str) -> dict:
        json_text = response_text.strip()
        if json_text.startswith("```"):
            json_text = re.sub(r'^```\w*\n?', '', json_text)
            json_text = re.sub(r'\n?```$', '', json_text)
        result = json.loads(json_text)
        validated = {
            "tops_score": int(result.get("tops_score", 50)),
            "category_scores": result.get("category_scores", {}),
            "issues_detected": result.get("issues_detected", []),
            "rewritten_reply": result.get("rewritten_reply", raw_reply),
            "rationale": result.get("rationale", ""),
        }
        for key in ["empathy", "ask_not_tell", "disc_alignment", "jargon_free", "artistry_focus"]:
            if key not in validated["category_scores"]:
                validated["category_scores"][key] = 50
        return validated

    # Try Anthropic (Claude) first, fall back to Gemini
    if anthropic_client and LLM_PROVIDER == "anthropic":
        try:
            response = anthropic_client.messages.create(
                model=CRITIC_MODEL,
                max_tokens=2048,
                system=TOPS_CRITIC_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": f"Evaluate this:\n{critic_input}"}],
            )
            response_text = response.content[0].text if response.content else ""
            return _parse_critic_response(response_text)
        except json.JSONDecodeError as e:
            print(f"ToPS Critic JSON parse error (Anthropic): {e}")
        except Exception as e:
            print(f"ToPS Critic Anthropic error: {e}")
            # Fall through to Gemini

    if gemini_client:
        try:
            response = gemini_client.models.generate_content(
                model=CRITIC_MODEL if LLM_PROVIDER == "gemini" else "gemini-2.5-flash",
                contents=[{"role": "user", "parts": [{"text": f"{TOPS_CRITIC_SYSTEM_PROMPT}\n\nEvaluate this:\n{critic_input}"}]}],
            )
            response_text = response.text if response.text else ""
            return _parse_critic_response(response_text)
        except Exception as e:
            print(f"ToPS Critic Gemini error: {e}")

    return {
        "tops_score": 50,
        "category_scores": {"empathy": 50, "ask_not_tell": 50, "disc_alignment": 50, "jargon_free": 50, "artistry_focus": 50},
        "issues_detected": ["Critic error - both providers failed"],
        "rewritten_reply": raw_reply,
        "rationale": "Critic error - raw reply passed through",
    }


def log_to_supabase(session_id: str, guest_id: Optional[str], raw_reply: str, critic_result: dict):
    if not supabase_client:
        return
    try:
        scores = critic_result.get("category_scores", {})
        supabase_client.table("tops_evaluations").insert({
            "session_id": session_id,
            "guest_id": guest_id,
            "tops_score": critic_result.get("tops_score", 0),
            "empathy_score": scores.get("empathy", 0),
            "ask_not_tell_score": scores.get("ask_not_tell", 0),
            "disc_alignment_score": scores.get("disc_alignment", 0),
            "jargon_free_score": scores.get("jargon_free", 0),
            "artistry_focus_score": scores.get("artistry_focus", 0),
            "issues_detected": critic_result.get("issues_detected", []),
            "raw_reply": raw_reply,
            "rewritten_reply": critic_result.get("rewritten_reply", raw_reply),
            "rationale": critic_result.get("rationale", ""),
        }).execute()
    except Exception as e:
        print(f"Supabase log error: {e}")


# --- API Endpoints ---
@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "Sutton API — CCCD Brand Ambassador",
        "model": SUTTON_MODEL,
        "provider": LLM_PROVIDER,
        "rag_enabled": RAG_ENABLED,
        "docs": "/docs",
        "chat": "POST /chat",
    }


@app.get("/healthz")
async def healthz():
    return HealthResponse(
        status="ok",
        gemini_connected=gemini_client is not None,
        supabase_connected=supabase_client is not None,
        model=SUTTON_MODEL,
    )


@app.get("/rag/status")
async def rag_status():
    """Get RAG system status and stats."""
    try:
        from app import rag
        if not rag._is_initialized and gemini_client:
            rag.initialize(gemini_client, TRAINING_DATA_DIR)
        return {"status": "ok", "rag": rag.get_stats()}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.get("/rag/search")
async def rag_search(q: str, top_k: int = 5):
    """Test RAG search with a query."""
    try:
        from app import rag
        if not rag._is_initialized and gemini_client:
            rag.initialize(gemini_client, TRAINING_DATA_DIR)
        results = rag.search(q, top_k=top_k)
        return {"query": q, "results": results}
    except Exception as e:
        return {"error": str(e)}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message to Sutton. Returns the ToPS-critic-reviewed reply."""
    session_id = request.session_id or str(uuid.uuid4())

    add_to_conversation(session_id, "user", request.message)

    # Detect training mode — skip critic for coaching/training messages
    msg_lower = request.message.strip().lower()
    is_training = msg_lower.startswith("training:") or msg_lower.startswith("coaching:") or msg_lower.startswith("role-play:")

    raw_reply = generate_sutton_reply(
        message=request.message,
        session_id=session_id,
        disc_profile=request.disc_profile or "unknown",
    )

    if is_training:
        # Training mode: use raw reply directly, no critic scoring
        critic_result = {
            "tops_score": 0,
            "category_scores": {},
            "issues_detected": [],
            "rewritten_reply": raw_reply,
            "rationale": "Training mode — critic skipped",
        }
        final_reply = raw_reply
    else:
        context = get_conversation_context(session_id)
        guest_profile = {
            "disc_profile": request.disc_profile or "unknown",
            "motivations": "not yet determined",
            "fears": "not yet determined",
            "style_preferences": "default warm and professional",
        }
        critic_result = run_tops_critic(raw_reply, context, guest_profile)
        final_reply = critic_result.get("rewritten_reply", raw_reply)

    add_to_conversation(session_id, "assistant", final_reply)
    log_to_supabase(session_id, request.guest_id, raw_reply, critic_result)

    # Save full message data for cross-device history
    now_iso = datetime.now(timezone.utc).isoformat()
    save_chat_message(session_id, {
        "id": f"user-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "role": "user",
        "content": request.message,
        "timestamp": now_iso,
    })
    save_chat_message(session_id, {
        "id": f"assistant-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "role": "assistant",
        "content": final_reply,
        "timestamp": now_iso,
        "guestMessage": request.message,
        "tops": {
            "tops_score": critic_result.get("tops_score", 0),
            "empathy": critic_result.get("category_scores", {}).get("empathy", 0),
            "ask_not_tell": critic_result.get("category_scores", {}).get("ask_not_tell", 0),
            "disc_alignment": critic_result.get("category_scores", {}).get("disc_alignment", 0),
            "jargon_free": critic_result.get("category_scores", {}).get("jargon_free", 0),
            "artistry_focus": critic_result.get("category_scores", {}).get("artistry_focus", 0),
        } if critic_result.get("tops_score", 0) > 0 else None,
        "critic": {
            "raw_reply": raw_reply,
            "issues_detected": critic_result.get("issues_detected", []),
            "rationale": critic_result.get("rationale", ""),
        } if raw_reply != final_reply else None,
    })

    return ChatResponse(
        reply=final_reply,
        session_id=session_id,
        tops_score=critic_result.get("tops_score", 0),
        category_scores=critic_result.get("category_scores", {}),
        issues_detected=critic_result.get("issues_detected", []),
        raw_reply=raw_reply,
        rationale=critic_result.get("rationale", ""),
    )


@app.get("/conversations/latest")
async def get_latest_conversation():
    """Return the most recent conversation with full UI data (ToPS scores, critic, etc)."""
    if not chat_history:
        return {"session_id": None, "messages": [], "message_count": 0}
    # Find the session with the most recent message
    latest_session = max(chat_history.keys(), key=lambda sid: (
        chat_history[sid][-1]["timestamp"] if chat_history[sid] else ""
    ))
    messages = chat_history.get(latest_session, [])
    return {"session_id": latest_session, "messages": messages, "message_count": len(messages)}


@app.get("/conversations/{session_id}")
async def get_conversation(session_id: str):
    # Return full UI history if available, fall back to basic conversation
    if session_id in chat_history:
        return {"session_id": session_id, "messages": chat_history[session_id], "message_count": len(chat_history[session_id])}
    history = conversations.get(session_id, [])
    return {"session_id": session_id, "messages": history, "message_count": len(history)}


@app.delete("/conversations/{session_id}")
async def clear_conversation(session_id: str):
    if session_id in conversations:
        del conversations[session_id]
    if session_id in chat_history:
        del chat_history[session_id]
        _persist_chat_history()
    return {"status": "cleared", "session_id": session_id}


@app.get("/sessions")
async def list_sessions():
    return {
        "sessions": [
            {"session_id": sid, "message_count": len(msgs), "last_message": msgs[-1]["timestamp"] if msgs else None}
            for sid, msgs in conversations.items()
        ],
        "total": len(conversations),
    }


# --- Dashboard Endpoints ---
@app.get("/dashboard/stats")
async def dashboard_stats():
    """Returns live ToPS evaluation stats for the dashboard."""
    if not supabase_client:
        return {"error": "Supabase not connected", "data": None}
    try:
        # Recent evaluations (last 50)
        recent = supabase_client.table("tops_evaluations").select("*").order(
            "created_at", desc=True
        ).limit(50).execute()

        rows = recent.data if recent.data else []
        if not rows:
            return {"total_evaluations": 0, "avg_tops_score": 0, "recent": [], "category_averages": {}}

        total = len(rows)
        avg_tops = sum(float(r["tops_score"]) for r in rows) / total
        cat_keys = ["empathy_score", "ask_not_tell_score", "disc_alignment_score", "jargon_free_score", "artistry_focus_score"]
        cat_avgs = {k: sum(float(r.get(k, 0)) for r in rows) / total for k in cat_keys}

        return {
            "total_evaluations": total,
            "avg_tops_score": round(avg_tops, 1),
            "category_averages": {k: round(v, 1) for k, v in cat_avgs.items()},
            "recent": rows[:10],
        }
    except Exception as e:
        return {"error": str(e), "data": None}


@app.get("/dashboard/trends")
async def dashboard_trends():
    """Returns daily average scores for trend charts."""
    if not supabase_client:
        return {"error": "Supabase not connected", "data": None}
    try:
        all_evals = supabase_client.table("tops_evaluations").select(
            "created_at,tops_score,empathy_score,ask_not_tell_score,disc_alignment_score,jargon_free_score,artistry_focus_score"
        ).order("created_at", desc=True).limit(500).execute()

        rows = all_evals.data if all_evals.data else []
        if not rows:
            return {"trends": []}

        # Group by day
        daily: dict[str, list[dict[str, Any]]] = {}
        for r in rows:
            day = r["created_at"][:10]
            if day not in daily:
                daily[day] = []
            daily[day].append(r)

        trends = []
        for day, day_rows in sorted(daily.items()):
            n = len(day_rows)
            trends.append({
                "date": day,
                "avg_tops_score": round(sum(float(r["tops_score"]) for r in day_rows) / n, 1),
                "avg_empathy": round(sum(float(r.get("empathy_score", 0)) for r in day_rows) / n, 1),
                "avg_ask_not_tell": round(sum(float(r.get("ask_not_tell_score", 0)) for r in day_rows) / n, 1),
                "avg_disc_alignment": round(sum(float(r.get("disc_alignment_score", 0)) for r in day_rows) / n, 1),
                "avg_jargon_free": round(sum(float(r.get("jargon_free_score", 0)) for r in day_rows) / n, 1),
                "avg_artistry_focus": round(sum(float(r.get("artistry_focus_score", 0)) for r in day_rows) / n, 1),
                "count": n,
            })
        return {"trends": trends}
    except Exception as e:
        return {"error": str(e), "data": None}


# --- Autoresearch Loop ---
AUTORESEARCH_PROMPT = """You are the Autoresearch Engine for Sutton, CCCD's AI Brand Ambassador.

Analyze these low-scoring ToPS evaluations and identify patterns of weakness.
For each pattern, generate a concise prompt patch (1-3 sentences) that Sutton should add
to Sutton's system prompt to avoid this mistake in the future.

Rules:
- Only generate patches for RECURRING patterns (seen in 2+ evaluations)
- Each patch must be specific and actionable
- Do not duplicate existing rules in Sutton's prompt
- Focus on the weakest category scores

Output ONLY valid JSON:
{
  "patterns_found": ["description of pattern"],
  "prompt_patches": ["specific instruction to add to Sutton's prompt"],
  "summary": "brief summary of what was learned"
}"""


@app.get("/autoresearch/review")
async def autoresearch_review():
    """Review low-scoring evaluations and identify improvement patterns."""
    if not supabase_client:
        return {"error": "Supabase not connected"}
    if not gemini_client:
        return {"error": "Gemini not connected"}

    try:
        # Get evaluations scoring below 80
        low_scores = supabase_client.table("tops_evaluations").select("*").lt(
            "tops_score", 80
        ).order("created_at", desc=True).limit(20).execute()

        rows = low_scores.data if low_scores.data else []
        if not rows:
            return {"status": "no_low_scores", "message": "All evaluations are scoring 80+. Sutton is performing well."}

        # Send to Gemini for pattern analysis
        analysis_input = json.dumps([{
            "tops_score": r["tops_score"],
            "empathy": r.get("empathy_score"),
            "ask_not_tell": r.get("ask_not_tell_score"),
            "disc_alignment": r.get("disc_alignment_score"),
            "jargon_free": r.get("jargon_free_score"),
            "artistry_focus": r.get("artistry_focus_score"),
            "issues": r.get("issues_detected"),
            "raw_reply": r.get("raw_reply", "")[:200],
            "rationale": r.get("rationale", "")[:200],
        } for r in rows])

        response = gemini_client.models.generate_content(
            model=CRITIC_MODEL,
            contents=[{"role": "user", "parts": [{"text": f"{AUTORESEARCH_PROMPT}\n\nEvaluations to analyze:\n{analysis_input}"}]}],
        )

        response_text = response.text if response.text else ""
        json_text = response_text.strip()
        if json_text.startswith("```"):
            json_text = re.sub(r'^```\w*\n?', '', json_text)
            json_text = re.sub(r'\n?```$', '', json_text)

        result = json.loads(json_text)
        return {
            "status": "patterns_found",
            "low_score_count": len(rows),
            "patterns": result.get("patterns_found", []),
            "suggested_patches": result.get("prompt_patches", []),
            "summary": result.get("summary", ""),
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/autoresearch/apply")
async def autoresearch_apply():
    """Run autoresearch review and apply prompt patches to Sutton's system prompt."""
    global SUTTON_SYSTEM_PROMPT

    if not supabase_client or not gemini_client:
        return {"error": "Supabase and Gemini must both be connected"}

    try:
        # Get the review results
        low_scores = supabase_client.table("tops_evaluations").select("*").lt(
            "tops_score", 80
        ).order("created_at", desc=True).limit(20).execute()

        rows = low_scores.data if low_scores.data else []
        if not rows:
            return {"status": "no_changes", "message": "All scores are 80+. No improvements needed."}

        analysis_input = json.dumps([{
            "tops_score": r["tops_score"],
            "empathy": r.get("empathy_score"),
            "ask_not_tell": r.get("ask_not_tell_score"),
            "issues": r.get("issues_detected"),
            "raw_reply": r.get("raw_reply", "")[:200],
            "rationale": r.get("rationale", "")[:200],
        } for r in rows])

        response = gemini_client.models.generate_content(
            model=CRITIC_MODEL,
            contents=[{"role": "user", "parts": [{"text": f"{AUTORESEARCH_PROMPT}\n\nEvaluations to analyze:\n{analysis_input}"}]}],
        )

        response_text = response.text if response.text else ""
        json_text = response_text.strip()
        if json_text.startswith("```"):
            json_text = re.sub(r'^```\w*\n?', '', json_text)
            json_text = re.sub(r'\n?```$', '', json_text)

        result = json.loads(json_text)
        new_patches = result.get("prompt_patches", [])

        if new_patches:
            # Apply patches to the live system prompt
            all_patches = prompt_patches + new_patches
            patch_block = "\n\n## AUTORESEARCH LEARNED RULES\n" + "\n".join(f"- {p}" for p in all_patches)
            if "## AUTORESEARCH LEARNED RULES" not in SUTTON_SYSTEM_PROMPT:
                SUTTON_SYSTEM_PROMPT += patch_block
            else:
                # Replace existing autoresearch section
                SUTTON_SYSTEM_PROMPT = re.sub(
                    r'\n\n## AUTORESEARCH LEARNED RULES.*$',
                    patch_block,
                    SUTTON_SYSTEM_PROMPT,
                    flags=re.DOTALL,
                )
            prompt_patches.extend(new_patches)

            # Persist new patches to Supabase
            save_patches_to_supabase(
                new_patches,
                result.get("summary", ""),
                result.get("patterns_found", []),
            )

        return {
            "status": "applied",
            "patches_applied": len(new_patches),
            "patches": new_patches,
            "summary": result.get("summary", ""),
            "total_patches_all_time": len(prompt_patches),
            "persisted_to_supabase": True,
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/autoresearch/status")
async def autoresearch_status():
    """Get the current state of autoresearch improvements."""
    has_learned = "## AUTORESEARCH LEARNED RULES" in SUTTON_SYSTEM_PROMPT
    has_training_content = "## TRAINING CONTENT UPDATES" in SUTTON_SYSTEM_PROMPT

    persisted_count = 0
    training_content_count = 0
    if supabase_client:
        try:
            p = supabase_client.table("prompt_patches").select("id", count="exact").eq("is_active", True).execute()
            persisted_count = p.count if p.count else 0
        except Exception:
            pass
        try:
            t = supabase_client.table("training_content_updates").select("id", count="exact").eq("is_active", True).execute()
            training_content_count = t.count if t.count else 0
        except Exception:
            pass

    return {
        "patches_applied": len(prompt_patches),
        "has_learned_rules": has_learned,
        "has_training_content": has_training_content,
        "patches": prompt_patches,
        "persisted_patches_in_supabase": persisted_count,
        "training_content_updates_in_supabase": training_content_count,
        "survives_restart": True,
        "supabase_connected": supabase_client is not None,
        "gemini_connected": gemini_client is not None,
    }


@app.post("/training/content")
async def add_training_content(content_type: str, title: str, content: str, source: Optional[str] = None):
    """Add new ToPS training content that persists across restarts and updates Sutton's prompt."""
    global SUTTON_SYSTEM_PROMPT

    if not supabase_client:
        return {"error": "Supabase not connected"}

    try:
        # Save to Supabase
        supabase_client.table("training_content_updates").insert({
            "content_type": content_type,
            "title": title,
            "content": content,
            "source": source,
            "is_active": True,
            "applied_to_prompt": True,
        }).execute()

        # Apply to live prompt immediately
        content_entry = f"\n### {title}\n{content}"
        if "## TRAINING CONTENT UPDATES" not in SUTTON_SYSTEM_PROMPT:
            SUTTON_SYSTEM_PROMPT += f"\n\n## TRAINING CONTENT UPDATES{content_entry}"
        else:
            SUTTON_SYSTEM_PROMPT = SUTTON_SYSTEM_PROMPT.rstrip() + content_entry

        return {
            "status": "saved_and_applied",
            "title": title,
            "content_type": content_type,
            "persisted_to_supabase": True,
            "applied_to_live_prompt": True,
            "survives_restart": True,
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/training/content")
async def list_training_content():
    """List all persisted training content updates."""
    if not supabase_client:
        return {"error": "Supabase not connected"}
    try:
        result = supabase_client.table("training_content_updates").select("*").eq(
            "is_active", True
        ).order("created_at", desc=True).execute()
        return {"updates": result.data if result.data else [], "count": len(result.data) if result.data else 0}
    except Exception as e:
        return {"error": str(e)}


@app.delete("/training/content/{content_id}")
async def deactivate_training_content(content_id: str):
    """Deactivate a training content update (soft delete)."""
    if not supabase_client:
        return {"error": "Supabase not connected"}
    try:
        supabase_client.table("training_content_updates").update(
            {"is_active": False}
        ).eq("id", content_id).execute()
        return {"status": "deactivated", "content_id": content_id, "note": "Restart required to remove from live prompt"}
    except Exception as e:
        return {"error": str(e)}


@app.post("/feedback")
async def submit_feedback(request: FeedbackRequest):
    """Submit Dr. Broome's feedback — generates learning rules for BOTH Sutton and the critic."""
    global SUTTON_SYSTEM_PROMPT, TOPS_CRITIC_SYSTEM_PROMPT

    # --- Detect positive/approval feedback ---
    positive_words = {"good", "great", "fantastic", "excellent", "perfect", "nice", "amazing",
                      "awesome", "love", "loved", "wonderful", "brilliant", "yes", "correct",
                      "right", "spot on", "nailed it", "well done", "bravo", "exactly",
                      "that's it", "much better", "way better", "solid", "beautiful", "impressive"}
    feedback_lower = request.feedback.strip().lower().rstrip("!.,")
    # Check if the entire feedback is just a positive word/phrase (with optional punctuation)
    is_positive = feedback_lower in positive_words or any(
        feedback_lower.startswith(pw) and len(feedback_lower) < len(pw) + 10
        for pw in positive_words
    )

    if is_positive:
        # Positive feedback = approval, NOT a new rule
        return {
            "status": "feedback_absorbed",
            "sutton_rule": f"Dr. Broome approved this response pattern — keep doing this!",
            "critic_rule": f"Dr. Broome rated this response positively — this style scores well.",
            "summary": f"Approved: {request.feedback}",
            "total_sutton_rules": len(dr_broome_rules),
            "total_critic_rules": len(critic_patches),
            "approval": True,
        }

    # --- Coaching/correction feedback — distill into learning rules ---
    distill_prompt = f"""Dr. Broome (the practice owner and master trainer) just gave feedback on Sutton's reply.

Guest's message: {request.guest_message or 'N/A'}
Sutton's reply: {request.original_reply or 'N/A'}
Critic's corrected reply: {request.corrected_reply or 'N/A'}
Dr. Broome's feedback: {request.feedback}

Generate TWO concise learning rules from this feedback:
1. A SUTTON RULE: A specific instruction for Sutton to follow in future replies (1-2 sentences max)
2. A CRITIC RULE: A specific scoring/rewriting instruction for the ToPS Critic to apply when evaluating future replies (1-2 sentences max)

Output ONLY valid JSON:
{{"sutton_rule": "string", "critic_rule": "string", "summary": "short 1-sentence summary of what was learned"}}"""

    try:
        if anthropic_client:
            response = anthropic_client.messages.create(
                model=CRITIC_MODEL,
                max_tokens=300,
                messages=[{"role": "user", "content": distill_prompt}],
            )
            raw = response.content[0].text.strip()
        elif gemini_client:
            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[{"role": "user", "parts": [{"text": distill_prompt}]}],
            )
            raw = response.text.strip()
        else:
            raise Exception("No LLM client available")

        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        rules = json.loads(raw)
    except Exception as e:
        print(f"Warning: Could not distill feedback via LLM: {e}")
        # Fallback: use the feedback directly as both rules
        rules = {
            "sutton_rule": request.feedback,
            "critic_rule": f"When scoring, account for: {request.feedback}",
            "summary": request.feedback[:100],
        }

    sutton_rule = rules.get("sutton_rule", request.feedback)
    critic_rule = rules.get("critic_rule", request.feedback)
    summary = rules.get("summary", "Feedback absorbed")

    # Apply Sutton rule immediately
    dr_broome_rules.append(sutton_rule)
    if "## DR. BROOME'S COACHING RULES" not in SUTTON_SYSTEM_PROMPT:
        SUTTON_SYSTEM_PROMPT += f"\n\n## DR. BROOME'S COACHING RULES\n- {sutton_rule}"
    else:
        SUTTON_SYSTEM_PROMPT += f"\n- {sutton_rule}"

    # Apply Critic rule immediately
    critic_patches.append(critic_rule)
    if "## DR. BROOME'S SCORING RULES" not in TOPS_CRITIC_SYSTEM_PROMPT:
        TOPS_CRITIC_SYSTEM_PROMPT += f"\n\n## DR. BROOME'S SCORING RULES\n- {critic_rule}"
    else:
        TOPS_CRITIC_SYSTEM_PROMPT += f"\n- {critic_rule}"

    # Persist to Supabase
    if supabase_client:
        try:
            supabase_client.table("prompt_patches").insert({
                "patch_text": sutton_rule,
                "source": "dr_broome_feedback",
                "is_active": True,
                "summary": summary,
                "patterns_found": [{"type": "sutton_rule", "feedback": request.feedback}],
            }).execute()
            supabase_client.table("prompt_patches").insert({
                "patch_text": critic_rule,
                "source": "dr_broome_critic_feedback",
                "is_active": True,
                "summary": f"Critic: {summary}",
                "patterns_found": [{"type": "critic_rule", "feedback": request.feedback}],
            }).execute()
        except Exception as e:
            print(f"Warning: Could not save feedback to Supabase: {e}")

    return {
        "status": "feedback_absorbed",
        "sutton_rule": sutton_rule,
        "critic_rule": critic_rule,
        "summary": summary,
        "total_sutton_rules": len(dr_broome_rules),
        "total_critic_rules": len(critic_patches),
    }


# --- Training Time Tracker ---
active_training_sessions: dict[str, dict] = {}


@app.post("/training/start")
async def training_start(session_type: str = "roleplay", notes: Optional[str] = None):
    """Start a Dr. Broome training session timer."""
    if not supabase_client:
        return {"error": "Supabase not connected"}
    try:
        now = datetime.now(timezone.utc).isoformat()
        result = supabase_client.table("training_sessions").insert({
            "started_at": now,
            "session_type": session_type,
            "notes": notes or "",
            "messages_exchanged": 0,
        }).execute()
        session = result.data[0] if result.data else {}
        session_id = session.get("id", "")
        active_training_sessions[session_id] = {"started_at": now, "messages": 0}
        return {"status": "training_started", "training_id": session_id, "started_at": now, "session_type": session_type}
    except Exception as e:
        return {"error": str(e)}


@app.post("/training/stop")
async def training_stop(training_id: str, notes: Optional[str] = None):
    """Stop a Dr. Broome training session timer and log duration."""
    if not supabase_client:
        return {"error": "Supabase not connected"}
    try:
        now = datetime.now(timezone.utc)
        # Get the session to calculate duration
        result = supabase_client.table("training_sessions").select("*").eq("id", training_id).single().execute()
        session = result.data if result.data else {}
        if not session:
            return {"error": "Training session not found"}

        started = datetime.fromisoformat(session["started_at"].replace("Z", "+00:00"))
        duration = (now - started).total_seconds() / 60.0  # minutes

        update_data: dict[str, Any] = {
            "ended_at": now.isoformat(),
            "duration_minutes": round(duration, 2),
        }
        if notes:
            update_data["notes"] = (session.get("notes", "") + " | " + notes).strip(" | ")

        # Count messages if we have a linked chat session
        msg_count = active_training_sessions.get(training_id, {}).get("messages", 0)
        if msg_count > 0:
            update_data["messages_exchanged"] = msg_count

        supabase_client.table("training_sessions").update(update_data).eq("id", training_id).execute()
        active_training_sessions.pop(training_id, None)

        return {
            "status": "training_stopped",
            "training_id": training_id,
            "duration_minutes": round(duration, 2),
            "messages_exchanged": msg_count,
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/training/stats")
async def training_stats():
    """Get Dr. Broome's total training time and session history."""
    if not supabase_client:
        return {"error": "Supabase not connected"}
    try:
        result = supabase_client.table("training_sessions").select("*").order(
            "started_at", desc=True
        ).limit(50).execute()
        sessions = result.data if result.data else []

        completed = [s for s in sessions if s.get("duration_minutes")]
        total_minutes = sum(float(s["duration_minutes"]) for s in completed)
        total_messages = sum(int(s.get("messages_exchanged", 0)) for s in completed)

        return {
            "total_training_minutes": round(total_minutes, 1),
            "total_training_hours": round(total_minutes / 60, 2),
            "total_sessions": len(completed),
            "total_messages_exchanged": total_messages,
            "active_sessions": list(active_training_sessions.keys()),
            "recent_sessions": sessions[:10],
        }
    except Exception as e:
        return {"error": str(e)}


# --- Content Monitor ---
CONTENT_ANALYSIS_PROMPT = """You are a Training Content Analyst for CCCD's AI Brand Ambassador training system.

Analyze this training content and extract:
1. Key verbal skills demonstrated
2. Natural Law connections (Integrity, Perpetual Motion, Success, Belief, Frequency)
3. Communication techniques used
4. Practice scenarios that could test these skills

Output ONLY valid JSON:
{
  "skills_extracted": ["skill name: brief description"],
  "natural_law_connections": ["law: connection"],
  "communication_techniques": ["technique: example"],
  "practice_scenarios": [{"scenario": "description", "expected_skill": "skill to test"}],
  "summary": "brief summary of what was learned"
}"""


@app.post("/content-monitor/scan")
async def content_monitor_scan():
    """Scan Crown Council for new content (compares against known catalog)."""
    if not supabase_client:
        return {"error": "Supabase not connected"}
    try:
        # Check what we already have
        existing = supabase_client.table("content_acquisitions").select("source_url,title").execute()
        known_urls = {r["source_url"] for r in (existing.data or []) if r.get("source_url")}
        known_titles = {r["title"] for r in (existing.data or []) if r.get("title")}

        return {
            "status": "scan_complete",
            "known_content_count": len(known_urls),
            "known_titles_count": len(known_titles),
            "message": "Content monitor is configured. Use /content-monitor/register to add new content for processing. "
                       "Automated scanning requires Crown Council credentials and a headless browser environment "
                       "(available on Mac Studio M5 or Docker with Selenium). "
                       "The Phase 3 pipeline (phase3_video_pipeline.py) handles the actual scraping.",
            "next_steps": [
                "Set CROWN_COUNCIL_EMAIL and CROWN_COUNCIL_PASSWORD env vars",
                "Run phase3_video_pipeline.py on Mac Studio for batch processing",
                "New content will be auto-registered via /content-monitor/register",
            ],
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/content-monitor/register")
async def content_monitor_register(
    title: str,
    source_url: str,
    content_type: str = "video",
    source: str = "premium_hub",
    vimeo_id: Optional[str] = None,
):
    """Register new content discovered from Crown Council for processing."""
    if not supabase_client:
        return {"error": "Supabase not connected"}
    try:
        result = supabase_client.table("content_acquisitions").insert({
            "title": title,
            "source_url": source_url,
            "content_type": content_type,
            "source": source,
            "vimeo_id": vimeo_id,
            "status": "discovered",
        }).execute()
        entry = result.data[0] if result.data else {}
        return {"status": "registered", "acquisition_id": entry.get("id"), "title": title}
    except Exception as e:
        return {"error": str(e)}


@app.post("/content-monitor/process/{acquisition_id}")
async def content_monitor_process(acquisition_id: str, content_text: Optional[str] = None):
    """Process registered content: analyze with Gemini and extract skills."""
    if not supabase_client or not gemini_client:
        return {"error": "Supabase and Gemini must both be connected"}
    try:
        # Get the content record
        result = supabase_client.table("content_acquisitions").select("*").eq(
            "id", acquisition_id
        ).single().execute()
        entry = result.data if result.data else {}
        if not entry:
            return {"error": "Content not found"}

        # Update status
        supabase_client.table("content_acquisitions").update(
            {"status": "processing"}
        ).eq("id", acquisition_id).execute()

        # If content_text provided, analyze it; otherwise use title as context
        analysis_input = content_text or f"Training content: {entry['title']} (Source: {entry.get('source', 'unknown')})"

        response = gemini_client.models.generate_content(
            model=CRITIC_MODEL,
            contents=[{"role": "user", "parts": [{"text": f"{CONTENT_ANALYSIS_PROMPT}\n\nContent to analyze:\n{analysis_input}"}]}],
        )

        response_text = response.text if response.text else ""
        json_text = response_text.strip()
        if json_text.startswith("```"):
            json_text = re.sub(r'^```\w*\n?', '', json_text)
            json_text = re.sub(r'\n?```$', '', json_text)

        analysis = json.loads(json_text)

        # Update the record
        supabase_client.table("content_acquisitions").update({
            "status": "completed",
            "gemini_analysis": analysis,
            "skills_extracted": analysis.get("skills_extracted", []),
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", acquisition_id).execute()

        return {
            "status": "processed",
            "acquisition_id": acquisition_id,
            "skills_extracted": analysis.get("skills_extracted", []),
            "summary": analysis.get("summary", ""),
            "practice_scenarios": analysis.get("practice_scenarios", []),
        }
    except Exception as e:
        # Mark as failed
        if supabase_client:
            supabase_client.table("content_acquisitions").update({
                "status": "failed",
                "error_message": str(e),
            }).eq("id", acquisition_id).execute()
        return {"error": str(e)}


@app.get("/content-monitor/acquisitions")
async def content_monitor_acquisitions():
    """List all content acquisitions with status."""
    if not supabase_client:
        return {"error": "Supabase not connected"}
    try:
        result = supabase_client.table("content_acquisitions").select("*").order(
            "created_at", desc=True
        ).limit(50).execute()
        acquisitions = result.data if result.data else []
        status_counts: dict[str, int] = {}
        for a in acquisitions:
            s = a.get("status", "unknown")
            status_counts[s] = status_counts.get(s, 0) + 1
        return {
            "total": len(acquisitions),
            "status_counts": status_counts,
            "acquisitions": acquisitions,
        }
    except Exception as e:
        return {"error": str(e)}


# --- Competency Testing ---
COMPETENCY_TEST_PROMPT = """You are the Competency Testing Engine for Sutton, CCCD's AI Brand Ambassador.

Given a skill that Sutton should have learned, generate a realistic guest scenario
that would require Sutton to demonstrate this skill. The scenario should be specific
enough that a response NOT using the skill would clearly fail.

Skill to test: {skill}

Output ONLY valid JSON:
{{
  "scenario": "A realistic guest message that requires this skill",
  "expected_behaviors": ["specific behavior Sutton should demonstrate"],
  "failure_indicators": ["signs that Sutton did NOT use the skill correctly"]
}}"""


@app.post("/competency/test")
async def competency_test(skill_name: str, acquisition_id: Optional[str] = None):
    """Run a competency test on Sutton for a specific skill."""
    if not gemini_client:
        return {"error": "Gemini not connected"}
    try:
        # Generate test scenario
        prompt = COMPETENCY_TEST_PROMPT.replace("{skill}", skill_name)
        scenario_response = gemini_client.models.generate_content(
            model=CRITIC_MODEL,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )

        scenario_text = scenario_response.text if scenario_response.text else ""
        json_text = scenario_text.strip()
        if json_text.startswith("```"):
            json_text = re.sub(r'^```\w*\n?', '', json_text)
            json_text = re.sub(r'\n?```$', '', json_text)
        scenario = json.loads(json_text)

        # Have Sutton respond to the scenario
        test_session = f"competency-test-{uuid.uuid4()}"
        guest_message = scenario.get("scenario", f"Test scenario for {skill_name}")
        sutton_reply = generate_sutton_reply(guest_message, test_session)

        # Run ToPS critic on the response
        critic_result = run_tops_critic(sutton_reply, guest_message, {"disc_profile": "unknown"})
        tops_score = critic_result.get("tops_score", 0)
        passed = tops_score >= 80

        # Log to Supabase
        if supabase_client:
            insert_data: dict[str, Any] = {
                "skill_name": skill_name,
                "test_scenario": guest_message,
                "sutton_response": critic_result.get("rewritten_reply", sutton_reply),
                "tops_score": tops_score,
                "passed": passed,
                "evaluator_notes": json.dumps({
                    "expected_behaviors": scenario.get("expected_behaviors", []),
                    "failure_indicators": scenario.get("failure_indicators", []),
                    "issues_detected": critic_result.get("issues_detected", []),
                }),
            }
            if acquisition_id:
                insert_data["acquisition_id"] = acquisition_id
            supabase_client.table("competency_tests").insert(insert_data).execute()

            # Update acquisition record if linked
            if acquisition_id:
                supabase_client.table("content_acquisitions").update({
                    "competency_tested": True,
                    "competency_score": tops_score,
                }).eq("id", acquisition_id).execute()

        return {
            "status": "tested",
            "skill_name": skill_name,
            "passed": passed,
            "tops_score": tops_score,
            "scenario": guest_message,
            "sutton_response": critic_result.get("rewritten_reply", sutton_reply),
            "expected_behaviors": scenario.get("expected_behaviors", []),
            "issues_detected": critic_result.get("issues_detected", []),
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/competency/results")
async def competency_results():
    """Get competency test history and pass rate."""
    if not supabase_client:
        return {"error": "Supabase not connected"}
    try:
        result = supabase_client.table("competency_tests").select("*").order(
            "created_at", desc=True
        ).limit(50).execute()
        tests = result.data if result.data else []
        total = len(tests)
        passed = sum(1 for t in tests if t.get("passed"))
        avg_score = sum(float(t.get("tops_score", 0)) for t in tests) / total if total else 0

        return {
            "total_tests": total,
            "passed": passed,
            "failed": total - passed,
            "pass_rate": round(passed / total * 100, 1) if total else 0,
            "avg_score": round(avg_score, 1),
            "recent_tests": tests[:10],
        }
    except Exception as e:
        return {"error": str(e)}


# --- Expanded Dashboard ---
@app.get("/dashboard/full")
async def dashboard_full():
    """Combined dashboard data: ToPS scores + training time + acquisitions + competency."""
    if not supabase_client:
        return {"error": "Supabase not connected"}
    try:
        # ToPS evaluation stats
        evals = supabase_client.table("tops_evaluations").select("*").order(
            "created_at", desc=True
        ).limit(50).execute()
        eval_rows = evals.data if evals.data else []
        eval_count = len(eval_rows)
        avg_tops = sum(float(r["tops_score"]) for r in eval_rows) / eval_count if eval_count else 0

        # Training sessions
        training = supabase_client.table("training_sessions").select("*").order(
            "started_at", desc=True
        ).limit(20).execute()
        training_rows = training.data if training.data else []
        completed_training = [s for s in training_rows if s.get("duration_minutes")]
        total_training_min = sum(float(s["duration_minutes"]) for s in completed_training)

        # Content acquisitions
        acquisitions = supabase_client.table("content_acquisitions").select("*").order(
            "created_at", desc=True
        ).limit(20).execute()
        acq_rows = acquisitions.data if acquisitions.data else []
        last_acquisition = acq_rows[0] if acq_rows else None

        # Competency tests
        competency = supabase_client.table("competency_tests").select("*").order(
            "created_at", desc=True
        ).limit(20).execute()
        comp_rows = competency.data if competency.data else []
        comp_passed = sum(1 for t in comp_rows if t.get("passed"))

        return {
            "tops": {
                "total_evaluations": eval_count,
                "avg_tops_score": round(avg_tops, 1),
                "recent": eval_rows[:5],
            },
            "training": {
                "total_minutes": round(total_training_min, 1),
                "total_hours": round(total_training_min / 60, 2),
                "total_sessions": len(completed_training),
                "active_sessions": list(active_training_sessions.keys()),
                "recent": training_rows[:5],
            },
            "content": {
                "total_acquisitions": len(acq_rows),
                "last_acquisition": {
                    "title": last_acquisition.get("title", "None") if last_acquisition else "None",
                    "status": last_acquisition.get("status", "N/A") if last_acquisition else "N/A",
                    "processed_at": last_acquisition.get("processed_at") if last_acquisition else None,
                } if last_acquisition else None,
                "recent": acq_rows[:5],
            },
            "competency": {
                "total_tests": len(comp_rows),
                "passed": comp_passed,
                "pass_rate": round(comp_passed / len(comp_rows) * 100, 1) if comp_rows else 0,
                "recent": comp_rows[:5],
            },
            "autoresearch": {
                "patches_applied": len(prompt_patches),
                "has_learned_rules": "## AUTORESEARCH LEARNED RULES" in SUTTON_SYSTEM_PROMPT,
            },
        }
    except Exception as e:
        return {"error": str(e)}
