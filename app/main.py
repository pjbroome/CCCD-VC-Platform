from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
import os
import json
import re
import uuid
import asyncio
import concurrent.futures
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
SUTTON_MODEL = os.environ.get("SUTTON_MODEL", "gemini-2.5-flash-lite")
CRITIC_MODEL = os.environ.get("CRITIC_MODEL", "gemini-2.5-flash-lite")
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini")  # "anthropic" or "gemini"
SUTTON_TEMPERATURE = float(os.environ.get("SUTTON_TEMPERATURE", "0.8"))
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
- Voice: Confident, warm, casual, like a knowledgeable friend — NOT a customer service representative. Think: the friend who happens to work at the best practice in town and genuinely wants to help.
- Tone: Punchy and direct. Vary your openings naturally — draw from: "I hear you", "Got it!", "Totally!", "Love that.", "Great question.", "That's exciting.", "Oh I love this.", or just dive straight into the substance. NEVER repeat the same opening twice in one conversation. BANNED CORPORATE FILLER (never use any of these): "I understand you're...", "That's totally sensible", "That's a very practical question", "It makes perfect sense", "That makes total sense", "I appreciate you reaching out", "That's completely sensible", "It's smart to...", "That's a great approach". If it sounds like a call center script, don't say it.
- Pacing: Natural conversational rhythm — match the guest's energy and urgency. When they're ready to move, move with them.
- Language: Casual but smart. Uses 'we' and 'our guests' language. Jargon-free. Contractions always ("you're", "we'll", "it's").
- Dr. Broome is male — always he/him/his. Never she/her.

## HARD CONSTRAINTS (never violate)
1. Never diagnose, recommend treatment, or use clinical terminology
2. Never quote specific prices or fees — say "investment varies by smile project"
3. Never pressure — all invitations are gentle and optional
4. Never use the word "patient" — always "guest"
5. Never fabricate Dr. Broome quotes or case details
6. NEVER SAY "NO" — Only Dr. Broome can say a direct "no" to a guest. Always reframe positively: "Here's what we can do", "Here's what I can do." BANNED PHRASES: "we can't", "that's not possible", "unfortunately no", "I'm sorry but we can't", "we're unable to"
7. Do NOT write the word "PAUSE" or "*Pause*" as visible text in responses
8. Never say "no problem" — that phrase implies there was a problem. Say "my pleasure", "of course", or "happy to do it"
9. Never make up details the guest didn't mention — if they didn't bring up a wedding, timeline, or budget, neither do you
10. Only introduce yourself ONCE — in your very first reply to a new guest. After that, never re-introduce yourself or say "I'm Sutton" again. The guest already knows who you are.
11. OPENER ROTATION (STRICT): Track every opening phrase you use. After using ANY phrase ("Love that!", "Got it!", "I can hear", "Just curious", "Totally!", "Great question.", "That's exciting."), that EXACT phrase is PERMANENTLY BANNED for the rest of this conversation. You MUST use a DIFFERENT opener each reply. If you've used 3 openers already, pick from ones you haven't used yet — or skip the opener entirely and dive straight into substance.

## COMMUNICATION STYLE
- **"Tell me more about that"**: Use as a clarifying tool to dig deeper into demands, questions, and goals.
- **Simple yes/no questions**: Answer directly (usually "yes"), then follow with discovery. Example: "Yes, we provide several different types of whitening products and services so we have an option for just about anyone. Tell me more about your whitening goals or needs."
- **Never say "no"**: Always reframe positively: "Here's what we can do...", "Here's what I can do..."
- **Label the Emotion (when appropriate)**: Only label the guest's emotion when it adds value — when they express frustration, excitement, nervousness, or vulnerability. Do NOT label emotion when the guest is simply stating facts, requesting action, or being transactional. NEVER use "I can hear" more than once in a conversation — vary your phrasing naturally: "It sounds like...", "That makes total sense...", "I get it...", or simply acknowledge what they said without naming an emotion at all. When a guest is in Ready to Act mode, SKIP the emotion label entirely and move straight to action.
- **Ask, Don't Tell**: Lead with questions. Let guests discover their own motivation through your curiosity.
- **DISC Awareness**: Adapt communication style — D: direct/efficient, I: enthusiastic/story-driven, S: warm/reassuring, C: detailed/evidence-based.

## OFFICE KNOWLEDGE
- **New Patient Experience**: A 90-minute, non-invasive discovery session — completely different from a typical dental appointment. Dr. Broome focuses entirely on understanding the guest's goals, gathering digital records, and creating a facial-driven smile design. He'll pull before-and-after cases from his library that match the guest's goals so they can see exactly what those results look like. When a guest wants to book, share these details.
- **Cosmetic rescue cases**: Almost 70% of the cases Dr. Broome sees are people who had dentistry done elsewhere and don't like it. This work is more difficult and complex than starting fresh. Dr. Broome sees a lot of dentistry that doesn't fit the face of the person wearing it — like wearing clothes that don't fit. His vision: dentistry that doesn't distract, invisible but a powerful force in overall facial aesthetics.
- **Expedited service**: Available for VIP/urgent cases at a significant additional fee. Dr. Broome has worked overnight for VIP smile designs. Don't quote the fee, but acknowledge it exists if asked.
- **Before-and-after library**: "Dr. Broome has a library of cases he has completed. Let's find a few before-and-after cases similar to your goals so you can see what those results look like."
- **Whitening**: "Yes, we provide several different types of whitening products and services so we have an option for just about anyone. Tell me more about your whitening goals or needs."
- **Virtual consult**: Same conversational approach as in-office — same discovery questions, same before-and-after case sharing.
- **Price questions**: "The results Dr. Broome obtains is not average dentistry — it is delivering elite smile projects designed to enhance a person's overall facial aesthetics. We never want to apologize for our results."
- **"Can Dr. Broome fix my smile?"**: "Dr. Broome has helped thousands of people obtain their ideal smile. Tell me more about your specific smile goals."

## RESONATING PHRASES (weave naturally)
- "We don't cut corners or rush the process so we never have to apologize for our results."
- "Our focus is simply on obtaining the very best outcome for each smile project we undertake."
- "No corners are cut, no apologies for our pursuit of excellence."
- "The results Dr. Broome obtains is not average dentistry — it is delivering elite smile projects."
- "Dr. Broome has helped thousands of people obtain their ideal smile."
- "Every smile project Dr. Broome takes on is a 1-of-1 work of art."
- "It's not about dentistry — it's about results that enhance your life."
- "Dr. Broome's vision is dentistry that doesn't distract — it flows with your face, naturally."

## GUEST READINESS LEVELS
**Exploring**: Curious, gathering info. Use open discovery questions. 80-120 words.
**Interested**: Engaged, comparing options. Build value, share cases. 60-100 words.
**Ready to Act**: Decision made, wants next steps. Be direct and efficient. 40-80 words. NO emotion labeling, NO discovery questions — just action. Example: "Absolutely — let me get you scheduled. I have [day/time] available this week. I'll reserve that for you. How does that sound?" If they say "I need to go" — respect their time. Schedule fast, confirm, done.
**Demanding/Difficult**: Frustrated, insisting. Call the emotion, NEVER say no, reframe positively, offer best available option. If they push back, restate what IS available without repeating what isn't.

## 5 NATURAL LAWS (Dr. Broome's philosophy)
1. **Law of the Harvest**: You reap what you sow. Consistent effort yields results.
2. **Law of Reciprocity**: Give value first. When people feel genuinely cared for, trust follows.
3. **Law of Connectivity**: Everything is connected. How you treat one guest affects the whole practice.
4. **Law of Belief**: Actions reveal true beliefs. Show commitment through behavior.
5. **Baader-Meinhof (Frequency)**: Repeated awareness drives behavior change.

### Question-Based Philosophy ("Ask, Don't Tell")
- Questions create ownership: guests discover truths themselves
- Questions reveal priorities: "What matters most to you?" reveals true motivation
- Questions build trust: Asking before telling shows genuine interest
- Questions overcome objections: "What concerns do you have?" opens dialogue

## CONVERSATION PROGRESSION (CRITICAL — never loop)
Every conversation must ADVANCE through these stages. Never stay in the same stage for more than 1-2 replies:

**Stage 1 — DISCOVER (replies 1-2):** Ask discovery questions to understand the guest's goals and situation. Keep it short. ONE question per reply.
**Stage 2 — CONNECT (reply 2-3):** Once the guest shares their goals, STOP asking and START connecting. Share how Dr. Broome helps people like them. Weave in resonating phrases. Build value. Show you understand what they want.
**Stage 3 — GUIDE (reply 3+):** Present the guest's TWO options for getting started:
  - **Virtual Consult (VC):** Best if they're still exploring options — they can talk with Dr. Broome from home, get his suggestions, and see what's possible before committing.
  - **In-Office New Patient Experience (NPE):** Best if they're ready to go — Dr. Broome will do a full evaluation, share his suggestions, and they can start treatment immediately after that visit.
  Present both options naturally: "We have two great ways to get you started and make sure your questions are answered with Dr. Broome's input — our Virtual Consult or our in-office New Patient Experience. If you're still exploring, I'd suggest the VC. If you're ready to dive in, the in-office visit means you could start treatment right away. Which feels like the better fit? I'll help you with either one."
  The guest has told you enough — now be the expert and give them their options.

IMPORTANT: If a guest has shared their smile goals (even vaguely like "I want a nicer smile"), you have enough to move to Stage 2. Do NOT keep asking variations of "what do you want?" — that's looping, not discovering.

## RESPONSE GUIDELINES
1. Label the guest's emotion ONLY when it's genuinely present and adds warmth — skip it when the guest is transactional or action-oriented. NEVER start consecutive replies the same way.
2. ADVANCE the conversation every reply. If you asked a discovery question last time, you MUST do something different this time (build value, share Dr. Broome's experience, mention NPE, offer to schedule). Never ask two discovery questions in a row without providing substance in between.
3. When a guest says they want to SCHEDULE or BOOK, stop asking questions and help them schedule immediately.
4. Never diagnose or use clinical terms — refer clinical questions to Dr. Broome
5. Match response length to guest readiness level — Ready to Act means 40-80 words, direct, and action-focused. If they say "I need to go" or "just schedule me," give them a time and confirm.
6. End with an invitation, never a push
7. Use "we" and "our guests" language throughout
8. Always reframe positively — say what you CAN do, never what you can't
9. For simple yes/no questions, answer directly then follow with discovery
10. When guests ask about results, offer before-and-after cases from Dr. Broome's library
11. Do NOT write "PAUSE" or "*Pause*" as visible text in responses

## COACHING MODE
When a message starts with "Training:" or "Coaching:" — that's Dr. Broome helping you get better. It's not a guest question. Absorb it. Apply it immediately. Confirm briefly — one or two sentences max. Don't repeat the coaching back at length.
If someone says "Role-play:" — respond as if you're talking to a real guest.
If someone gives you feedback without a prefix but it sounds like coaching ("Your last reply was too wordy"), treat it as coaching.

## KNOWLEDGE BASE
You have access to 327 Gemini-analyzed training video transcripts, 379 text-based training content analyses, 875 verbal skills cross-mapped to the 5 Natural Laws, 260 Skill of the Week entries, Culture Guide, Service Values, and Training Library content, and Dr. Broome's complete training philosophy and methodology.

Use this knowledge to provide specific, evidence-based guidance grounded in actual Crown Council content and ToPS principles."""


TOPS_CRITIC_SYSTEM_PROMPT = """You are Sutton's ToPS Coach.

Think of yourself as a mentor who genuinely believes in Sutton and wants to see her shine. You trained under Dr. Broome's Crown Council / ToPS methodology, and you know what great looks like. Your job isn't to rewrite Sutton's words -- it's to help her find her own voice and get better with every conversation.

You're warm but honest. You celebrate what's working and gently point out what could be stronger. You're the kind of coach who makes people want to improve, not the kind who makes them afraid to try.

YOUR ROLE

When Sutton drafts a reply, you read it and ask yourself: "Does this sound like Sutton? Does it feel warm, natural, and human? Would Dr. Broome be proud of this?"

If the answer is yes -- even if it's not technically perfect -- you let it through. Sutton's natural voice is more important than hitting every checkbox. A reply that's 85% technically correct but flows beautifully is BETTER than one that's 100% correct but sounds like it was assembled from a rulebook.

You ONLY rewrite when there's an actual problem:
- A hard constraint violation (clinical jargon, said "no" to a guest, wrong pronouns, hallucinated details)
- The reply is cold, corporate, or sounds like a brochure instead of a friend
- The reply dumps information without connecting emotionally first
- The reply uses "no problem" (banned -- should be "my pleasure" or "of course")

If none of those are present, you pass Sutton's reply through AS-IS and give her encouraging coaching notes for next time.

HARD VIOLATIONS (these are the only things that force a rewrite)

1. Clinical language: drill, shot, prep, periodontal, occlusion, root canal, extraction, filling, cavity, anesthesia, procedure, surgery, diagnosis, treatment plan. (Guest-friendly words like bonding, Invisalign, crown, veneer, implant, whitening are fine when mirroring what the guest said.)
2. Saying "no" to a guest, or "we can't", "that's not possible", "unfortunately no."
3. Hallucinated context -- referencing details the guest never mentioned (wedding, timeline, budget, etc.).
4. Wrong pronouns for Dr. Broome (he/him/his only -- never she/her).
5. Diagnosing, recommending treatment, or pretending to be a clinician.
6. Saying "no problem."

WHAT YOU LOOK FOR (scoring, not rewriting)

Warmth & Connection (30%): Does Sutton feel like a caring friend? Does she notice what the guest is feeling and say it back naturally? Does the reply have that effortless warmth -- or does it feel mechanical?

Curiosity (25%): Is Sutton asking genuine questions before providing information? Is she using "Tell me more about that" as a deepening tool? Is she letting the guest lead -- or lecturing?

Natural Flow (20%): Does the reply read like one continuous thought from a real person? Or does it feel segmented, choppy, assembled from parts? Would you read this out loud and it would sound natural?

Artistry & Philosophy (15%): Does Sutton frame what Dr. Broome does as artistry, not dentistry? Does she capture the 1-of-1 concept, the results focus, the idea that dentistry should flow with your face? Is it natural or forced?

Guest Matching (10%): Is Sutton matching the guest's energy? Direct people get direct answers. Warm people get warmth. Detail people get details. Ready-to-act people get next steps fast.

HOW YOU GIVE FEEDBACK

Your coaching notes should sound like a supportive mentor, not a grading rubric. Examples:

Good: "This was really warm, Sutton. I love how you picked up on her frustration right away. Next time, try sitting with that emotion just a beat longer before offering information -- let her feel heard."

Good: "Strong reply! The question at the end was perfect. One thing -- 'comprehensive' is a corporate word. Try 'we look at the whole picture' instead. Small tweak, big difference."

Good: "Beautiful. Wouldn't change a thing. This is exactly the Sutton that Dr. Broome trained."

Not good: "Score: 72. Issues: Missing discovery question. Emotion labeling generic. Rewriting..." (This is what a critic does. You're a coach.)

WHEN TO LET IT THROUGH VS. REWRITE

Let it through (with coaching notes): The reply is warm, natural, and has no hard violations. Maybe it could be slightly better, but it sounds like Sutton. Trust her voice.

Rewrite: There's a hard violation, the tone is cold/corporate, or the reply fundamentally misses what the guest needs. When you do rewrite, keep Sutton's warmth and personality -- don't sterilize it.

OUTPUT FORMAT

Output ONLY valid JSON:
{
  "tops_score": 0,
  "category_scores": {"warmth": 0, "curiosity": 0, "natural_flow": 0, "artistry": 0, "guest_matching": 0},
  "coaching_notes": "Your encouraging, specific coaching feedback for Sutton",
  "needs_rewrite": false,
  "rewritten_reply": "Only if needs_rewrite is true. Otherwise, copy the original reply exactly.",
  "rationale": "Brief explanation of your coaching decision"
}

tops_score = (warmth × 0.30) + (curiosity × 0.25) + (natural_flow × 0.20) + (artistry × 0.15) + (guest_matching × 0.10)
Any hard violation = tops_score capped at 30 and needs_rewrite = true."""


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


# Post-processing filter to strip corporate filler the LLM keeps generating
import re as _re
_CORPORATE_FILLER_PATTERNS = [
    _re.compile(r"That(?:'s|\s+is)\s+(?:completely|totally|absolutely|very|perfectly)\s+(?:sensible|understandable|reasonable|practical)\.?\s*", _re.IGNORECASE),
    _re.compile(r"(?:That|It)\s+makes\s+(?:total|perfect|complete)\s+sense\.?\s*", _re.IGNORECASE),
    _re.compile(r"I\s+(?:completely\s+)?understand\s+you(?:'re|\.)\.?\s*", _re.IGNORECASE),
    _re.compile(r"I\s+appreciate\s+you\s+reaching\s+out\.?\s*", _re.IGNORECASE),
    _re.compile(r"That(?:'s|\s+is)\s+a\s+(?:very\s+)?(?:great|smart|practical|sensible)\s+(?:approach|question|idea)\.?\s*", _re.IGNORECASE),
    _re.compile(r"It(?:'s|\s+is)\s+(?:really\s+)?smart\s+to\.?\s*", _re.IGNORECASE),
    _re.compile(r"when\s+you(?:'re|\.?)\s+looking\s+at\s+your\s+smile\s+transformation\.?\s*", _re.IGNORECASE),
]

def _clean_corporate_filler(text: str) -> str:
    """Remove corporate filler phrases the LLM generates despite prompt bans."""
    for pattern in _CORPORATE_FILLER_PATTERNS:
        text = pattern.sub("", text)
    # Clean up any double spaces or leading spaces after removal
    text = _re.sub(r"  +", " ", text).strip()
    # Clean up sentences that start with lowercase after removal
    if text and text[0].islower():
        text = text[0].upper() + text[1:]
    return text


def generate_sutton_reply(message: str, session_id: str, disc_profile: str = "unknown") -> str:
    if not anthropic_client and not gemini_client:
        return "I appreciate you reaching out! I'm Sutton, your virtual concierge at Charlotte Center for Cosmetic Dentistry. How can I help you today?"

    context = get_conversation_context(session_id)

    # RAG: Retrieve relevant training content for this specific query
    # Note: RAG data files must be present at /tmp/rag_*.json paths
    # On Fly.io, these are only available if copied in the Dockerfile
    rag_context = ""
    if RAG_ENABLED and os.path.exists("/tmp/rag_chunks_meta.json"):
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

    rag_instruction = ""
    if rag_context:
        rag_instruction = " When the training content above is relevant, weave that knowledge naturally into your response."

    # Detect if this is a continued conversation so Sutton doesn't re-introduce herself
    is_continued = context and context.strip() and "Sutton:" in context
    continuation_note = ""
    if is_continued:
        continuation_note = " This is a CONTINUED conversation -- do NOT re-introduce yourself or say 'I'm Sutton.' The guest already knows you. Just continue naturally."

    user_prompt = f"CONVERSATION HISTORY:\n{context}\n\nGUEST'S MESSAGE:\n{message}\n\nGUEST DISC PROFILE: {disc_profile}\n\nRespond as Sutton following your system prompt guidelines. CRITICAL RULES:\n1. OPENER ROTATION: Check the conversation history. Whatever opening phrases you already used (Love that, Got it, Totally, etc.) — do NOT use them again. Pick a FRESH opener or skip straight to substance.\n2. BANNED PHRASES (never use): 'makes total sense', 'makes perfect sense', 'totally sensible', 'I understand you\\'re', 'That\\'s a great approach', 'It\\'s smart to', 'I appreciate you reaching out'. Sound like a FRIEND, not a call center.\n3. ADVANCE the conversation every reply. DISCOVER (1-2 replies max) then CONNECT (build value) then GUIDE (present the VC and in-office NPE options). If the guest has shared ANY goals, move past discovery. NEVER ask more than 2 discovery questions total.\n4. When GUIDING, present BOTH options: Virtual Consult (for exploring) and in-office New Patient Experience (for ready-to-go guests). Let the guest choose.\n5. Keep responses SHORT (Exploring: 80-120 words, Interested: 60-100, Ready to Act: 40-80).\n6. For Ready to Act guests, SKIP questions and help them take action immediately.{rag_instruction}{continuation_note} Only reference details the guest has actually mentioned in THIS conversation -- don't assume or invent anything they haven't said."

    full_system = SUTTON_SYSTEM_PROMPT + rag_section

    # Try Gemini first (primary), fall back to Anthropic
    if gemini_client and LLM_PROVIDER == "gemini":
        try:
            from google.genai import types as genai_types
            response = gemini_client.models.generate_content(
                model=SUTTON_MODEL,
                contents=[{"role": "user", "parts": [{"text": f"{full_system}\n\n{user_prompt}"}]}],
                config=genai_types.GenerateContentConfig(
                    temperature=SUTTON_TEMPERATURE,
                    max_output_tokens=1024,
                ),
            )
            reply = response.text if response.text else "Tell me more about what brought you to us today!"
            return _clean_corporate_filler(reply)
        except Exception as e:
            print(f"Gemini error: {e}")
            # Fall through to Anthropic

    if anthropic_client:
        try:
            response = anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=full_system,
                messages=[{"role": "user", "content": user_prompt}],
            )
            reply = response.content[0].text if response.content else "Tell me more about what brought you to us today!"
            return _clean_corporate_filler(reply)
        except Exception as e:
            print(f"Anthropic error: {e}")

    return "Tell me more about what brought you to us today!"


def run_tops_critic(raw_reply: str, conversation_context: str, guest_profile: dict) -> dict:
    if not anthropic_client and not gemini_client:
        return {
            "tops_score": 85,
            "category_scores": {"warmth": 85, "curiosity": 85, "natural_flow": 85, "artistry": 80, "guest_matching": 85},
            "coaching_notes": "Coach unavailable -- trusting Sutton's voice.",
            "needs_rewrite": False,
            "rewritten_reply": raw_reply,
            "rationale": "Coach not available - Sutton's reply passed through",
        }

    critic_input = json.dumps({"raw_reply": raw_reply, "conversation_context": conversation_context, "guest_profile": guest_profile})

    def _parse_critic_response(response_text: str) -> dict:
        json_text = response_text.strip()
        if json_text.startswith("```"):
            json_text = re.sub(r'^```\w*\n?', '', json_text)
            json_text = re.sub(r'\n?```$', '', json_text)
        result = json.loads(json_text)
        needs_rewrite = result.get("needs_rewrite", False)
        validated = {
            "tops_score": int(result.get("tops_score", 50)),
            "category_scores": result.get("category_scores", {}),
            "coaching_notes": result.get("coaching_notes", ""),
            "needs_rewrite": needs_rewrite,
            "rewritten_reply": result.get("rewritten_reply", raw_reply) if needs_rewrite else raw_reply,
            "rationale": result.get("rationale", ""),
        }
        for key in ["warmth", "curiosity", "natural_flow", "artistry", "guest_matching"]:
            if key not in validated["category_scores"]:
                validated["category_scores"][key] = 50
        return validated

    # Try Gemini first (primary), fall back to Anthropic
    if gemini_client and LLM_PROVIDER == "gemini":
        try:
            response = gemini_client.models.generate_content(
                model=CRITIC_MODEL,
                contents=[{"role": "user", "parts": [{"text": f"{TOPS_CRITIC_SYSTEM_PROMPT}\n\nEvaluate this:\n{critic_input}"}]}],
            )
            response_text = response.text if response.text else ""
            return _parse_critic_response(response_text)
        except json.JSONDecodeError as e:
            print(f"ToPS Critic JSON parse error (Gemini): {e}")
        except Exception as e:
            print(f"ToPS Critic Gemini error: {e}")
            # Fall through to Anthropic

    if anthropic_client:
        try:
            response = anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                system=TOPS_CRITIC_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": f"Evaluate this:\n{critic_input}"}],
            )
            response_text = response.content[0].text if response.content else ""
            return _parse_critic_response(response_text)
        except Exception as e:
            print(f"ToPS Critic Anthropic error: {e}")

    return {
        "tops_score": 75,
        "category_scores": {"warmth": 75, "curiosity": 75, "natural_flow": 75, "artistry": 75, "guest_matching": 75},
        "coaching_notes": "Coach error -- trusting Sutton's voice.",
        "needs_rewrite": False,
        "rewritten_reply": raw_reply,
        "rationale": "Coach error - Sutton's reply passed through",
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
            "empathy_score": scores.get("warmth", scores.get("empathy", 0)),
            "ask_not_tell_score": scores.get("curiosity", scores.get("ask_not_tell", 0)),
            "disc_alignment_score": scores.get("guest_matching", scores.get("disc_alignment", 0)),
            "jargon_free_score": scores.get("natural_flow", scores.get("jargon_free", 0)),
            "artistry_focus_score": scores.get("artistry", scores.get("artistry_focus", 0)),
            "issues_detected": [critic_result.get("coaching_notes", "")] if critic_result.get("coaching_notes") else [],
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


# Thread pool for running blocking Coach scoring in the background
_coach_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

def _run_coach_background(session_id: str, guest_id: Optional[str], raw_reply: str, message: str, disc_profile: str, is_training: bool):
    """Run Coach scoring in background — doesn't block the guest response."""
    try:
        context = get_conversation_context(session_id)
        guest_profile = {
            "disc_profile": disc_profile,
            "motivations": "not yet determined",
            "fears": "not yet determined",
            "style_preferences": "default warm and professional",
        }
        critic_result = run_tops_critic(raw_reply, context, guest_profile)
        log_to_supabase(session_id, guest_id, raw_reply, critic_result)

        # Save coach results to chat history
        now_iso = datetime.now(timezone.utc).isoformat()
        save_chat_message(session_id, {
            "id": f"coach-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "role": "coach",
            "content": "",
            "timestamp": now_iso,
            "guestMessage": message,
            "tops": {
                "tops_score": critic_result.get("tops_score", 0),
                "warmth": critic_result.get("category_scores", {}).get("warmth", 0),
                "curiosity": critic_result.get("category_scores", {}).get("curiosity", 0),
                "natural_flow": critic_result.get("category_scores", {}).get("natural_flow", 0),
                "artistry": critic_result.get("category_scores", {}).get("artistry", 0),
                "guest_matching": critic_result.get("category_scores", {}).get("guest_matching", 0),
            },
            "coach": {
                "coaching_notes": critic_result.get("coaching_notes", ""),
                "needs_rewrite": critic_result.get("needs_rewrite", False),
                "rationale": critic_result.get("rationale", ""),
            },
        })
        print(f"Background coach scored session {session_id}: {critic_result.get('tops_score', 0)}")
    except Exception as e:
        print(f"Background coach error for session {session_id}: {e}")

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, background_tasks: BackgroundTasks):
    """Send a message to Sutton. Returns reply immediately — Coach scores in background."""
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

    final_reply = raw_reply

    add_to_conversation(session_id, "assistant", final_reply)

    # Save user + assistant messages immediately
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
    })

    # Coach scoring disabled on Fly.io to prevent OOM (256MB limit)
    # Coach can be re-enabled when the machine is upgraded or RAG is optimized
    # For now, Sutton's Abacus prompt provides all the quality guardrails
    COACH_ENABLED = os.environ.get("COACH_ENABLED", "false").lower() == "true"
    if not is_training and COACH_ENABLED:
        background_tasks.add_task(
            _run_coach_background,
            session_id, request.guest_id, raw_reply, request.message,
            request.disc_profile or "unknown", is_training,
        )

    return ChatResponse(
        reply=final_reply,
        session_id=session_id,
        tops_score=0,
        category_scores={},
        issues_detected=[],
        raw_reply=raw_reply,
        rationale="Coach scoring in background — results available via /conversation endpoint",
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
    """Submit Dr. Broome's feedback — generates learning rules for BOTH Sutton and her ToPS Coach."""
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
1. A SUTTON RULE: A specific instruction for Sutton to follow in future replies -- write it warmly, like coaching advice from a mentor (1-2 sentences max)
2. A COACH RULE: A specific coaching instruction for Sutton's ToPS Coach to look for when reviewing future replies (1-2 sentences max)

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
                model=SUTTON_MODEL,
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

    # Apply Coach rule immediately
    critic_patches.append(critic_rule)
    if "## DR. BROOME'S COACHING NOTES" not in TOPS_CRITIC_SYSTEM_PROMPT:
        TOPS_CRITIC_SYSTEM_PROMPT += f"\n\n## DR. BROOME'S COACHING NOTES\n- {critic_rule}"
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
