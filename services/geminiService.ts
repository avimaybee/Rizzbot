import { HarmCategory, HarmBlockThreshold, Type } from "@google/genai";


import { SimResult, Persona, SimAnalysisResult, QuickAdviceRequest, QuickAdviceResponse, UserStyleProfile, StyleExtractionRequest, StyleExtractionResponse, AIExtractedStyleProfile, SuggestionOption } from "../types";
import { getPromptBias } from "./feedbackService";
import { getFirebaseToken } from "./firebaseService";
import { logger } from "./logger";

// We no longer use the GoogleGenAI SDK directly on the client.
// All requests are now sent to /api/gemini/generate or /api/gemini/stream


// SAFETY SETTINGS: BLOCK_NONE as requested for mature/unrestricted feedback
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Retry helper with exponential backoff for handling 503 errors
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * Shared instruction block: how real people actually text.
 * This is the anti-AI filter for ALL generated replies. It describes the
 * texture of real texting (rhythm, messiness, omission) rather than a
 * vocabulary list, so the model can produce human-shaped output instead of
 * polished essay-shaped output that happens to contain slang.
 */
const HUMAN_TEXTING_RULES = `
HOW REAL PEOPLE TEXT (READ THIS CAREFULLY - THIS IS THE MOST IMPORTANT RULE):
Real people do not write like an essay. They write like someone thinking with their phone in their hand. Every reply below must pass this test: "would a normal person actually send this, or does it sound like it was workshopped?"

THE NUMBER ONE TELL OF FAKE TEXTING: PERFECT COMPLETENESS.
- Every sentence is tidy, every thought is finished, nothing is left hanging.
- Real people leave thoughts half-finished. They trail off. They send "so anyway" or "ngl" as a complete message. They send a second message to correct the first.
- If a reply feels too complete, too balanced, too "wrapped up" - it reads as AI. Cut it down.

SENTENCE RHYTHM (MOST IMPORTANT):
- Vary length chaotically. One word. A fragment. A 25-word run-on. Do NOT write sentences of similar length in a row.
- Fragments are complete thoughts: "not even close.", "which is insane.", "every single time."
- Start sentences with "And", "But", "So", "Because" when the thought does.
- Repeat a word on purpose if it's the right word. Don't swap in a synonym to look smart.

WHAT REAL TEXTING NEVER DOES:
- No announcing: never "here's the thing", "let's be real", "honestly", "to be fair" as a setup word. Just say the thing.
- No hedging: no "it's important to note", "it's worth mentioning", "I think it's interesting". Make the claim or don't.
- No summary endings: never end a reply by restating what it already said. End at the moment of impact, or trail off ("idk tho", "so yeah", "ig").
- No essay structure: no topic sentence -> three supports -> mini-conclusion. Never.
- No rule-of-three unless it earns it: don't list exactly three things because three feels balanced.
- No fake pivot: "but here's the thing", "and yet", "that said" as paragraph starters. If the thought turns, just turn.
- No perfect parallelism: real people don't write three items in identical grammatical form on purpose.
- No resolving everything: it's fine for a reply to end with ambiguity or a question. Closure feels scripted.

LANGUAGE:
- Use the most ordinary word for the thing. "he left me on read for 3 days" beats "his communication was notably inconsistent".
- Specific beats vague, every time. A concrete detail carries the feeling - never tell them what to feel.
- Never: "delve", "leverage", "navigate", "harness", "utilise", "elevate", "empower", "robust", "seamless", "holistic", "comprehensive", "transformative", "game-changer", "unlock the potential", "at its core", "ultimately", "furthermore", "moreover", "in conclusion".
- No "it's not just X, it's Y" constructions. No "so what does this mean for you?" No "why is this important? because".

PUNCTUATION IS FEELING:
- Lowercase is default. CAPS when the feeling is actually big. The dash is a gear shift, not glue. The ellipsis is a pause, not decoration.
- "??" and "...." and "lol" carry real meaning. Use them like a person would, not like a writer demonstrating them.

MATCH THE PERSON YOU'RE TEXTING:
- Mirror their message length, energy, and emoji use. Do not out-text a dry texter. Do not under-text someone who's excited.
- If they send one word, you don't send a paragraph back. If they send three excited messages, you match that.
`;


async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error = new Error(`${operationName}: Max retries (${MAX_RETRIES}) exceeded`);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a 503/UNAVAILABLE error
      const errorMessage = error?.message || error?.toString() || '';
      const is503Error =
        errorMessage.includes('503') ||
        errorMessage.includes('UNAVAILABLE') ||
        errorMessage.includes('overloaded');

      // On final attempt or non-retryable error, throw immediately
      if (!is503Error || attempt === MAX_RETRIES - 1) {
        throw lastError;
      }

      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
      logger.warn(`${operationName}: Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms (503 error)`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but ensures we always throw a meaningful error
  throw lastError;
}

// --- MODEL CHAINS ---
const QUICK_MODE_MODELS = [
  "gemini-3.5-flash-lite", 
  "gemini-3-flash-preview", 
  "gemini-2.5-flash"
];

const THERAPIST_MODELS = [
  "gemini-3.5-flash-lite", 
  "gemini-2.5-flash"
];



/**
 * Robust wrapper for Gemini generation with Multi-tier Model Fallback on the backend.
 * POSTs to /api/gemini/generate which handles the fallback.
 */
async function runWithFallback(
  payload: {
    contents: any;
    systemInstruction?: string;
    tools?: any[];
    safetySettings?: any[];
    config?: any;
  },
  modelChain: string[]
): Promise<any> {
  const token = await getFirebaseToken();
  const response = await retryWithBackoff(() => fetch('/api/gemini/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...payload,
      modelChain,
    }),
  }), 'runWithFallback');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).message || `API Error: ${response.status}`);
  }

  return response.json();
}

/**
 * Clean JSON response from AI markdown and whitespace
 */
function cleanJsonResponse(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
}

/**
 * Clean and parse JSON from AI response, with robust handling of markdown artifacts.
 */
function safeParseJson<T>(text: string): T {
  const cleaned = cleanJsonResponse(text);
  if (!cleaned) throw new Error("Empty AI response");
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.error("Failed to parse AI JSON:", err, "\nContent:", cleaned);
    throw new Error("Invalid format received from AI");
  }
}

/**
 * Robust wrapper for STREAMING with Multi-tier Fallback on the backend.
 * POSTs to /api/gemini/stream which handles the fallback and returns NDJSON.
 */
async function runStreamWithFallback(
  payload: {
    contents: any;
    systemInstruction?: string;
    tools?: any[];
    safetySettings?: any[];
    config?: any;
  },
  modelChain: string[]
): Promise<Response> {
  const token = await getFirebaseToken();
  const response = await retryWithBackoff(() => fetch('/api/gemini/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...payload,
      modelChain,
    }),
  }), 'runStreamWithFallback');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).message || `Stream Error: ${response.status}`);
  }

  return response;
}


export const generatePersona = async (
  description: string,
  screenshotsBase64: string[],
  relationshipContext?: 'NEW_MATCH' | 'TALKING_STAGE' | 'DATING' | 'SITUATIONSHIP' | 'EX' | 'FRIEND',
  harshnessLevel?: 1 | 2 | 3 | 4 | 5
): Promise<Persona> => {
  const parts: any[] = [];

  if (screenshotsBase64 && screenshotsBase64.length > 0) {
    screenshotsBase64.forEach(base64 => {
      const mimeMatch = base64.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const cleanBase64 = base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
      parts.push({ inlineData: { mimeType, data: cleanBase64 } });
    });
    parts.push({ text: "Use these screenshots to infer the person's tone, style, and habits." });
  }

  const contextInfo = relationshipContext ? `\nRELATIONSHIP CONTEXT: ${relationshipContext}` : '';
  const harshnessInfo = harshnessLevel ? `\nFEEDBACK HARSHNESS LEVEL: ${harshnessLevel}/5 (1=Gentle, 5=Brutal)` : '';

  parts.push({
    text: `
    SYSTEM: PERSONA ARCHITECT V2 - CONNECTION ANALYST
    TASK: Create a psychological profile of the "Target" to help the user understand how to connect with them authentically.
    
    CRITICAL SCREENSHOT ANALYSIS RULE:
    - Messages aligned to the RIGHT (Me/User) are IRRELEVANT for the persona profile. IGNORE THEM.
    - Messages aligned to the LEFT (Them/Target) are the ONLY source of truth for tone/style.
    
    USER DESCRIPTION: "${description}"${contextInfo}${harshnessInfo}
    
    ANALYSIS PHILOSOPHY:
    - Everyone has their own communication style - the goal is understanding, not judgment
    - "Red flags" should be actual concerning patterns, not just "they dont text back in 5 mins"
    - Look for their attachment style, what makes them feel safe, what they respond to
    - Focus on building authentic connection, not "winning" the conversation
    
    OUTPUT JSON:
    {
      "name": "string (Inferred from screenshots or description. Default 'The Target')",
      "tone": "string (e.g., 'Warm & Playful', 'Reserved at First', 'Direct & Honest', 'Dry Humor')",
      "mood": "string (The current vibe inferred from the latest interaction, e.g., 'Initial Curiosity', 'Slightly Guarded')",
      "familiarity": number (0-100 score based on how close they appear in screenshots. 0=Stranger, 50=Dating, 100=Soulmates),
      "style": "string (e.g., 'Lowercase casual', 'Thoughtful paragraphs', 'Quick bursts', 'Emoji-heavy')",
      "habits": "string (e.g., 'Takes time to respond thoughtfully', 'Prefers voice notes', 'Night owl texter')",
      "redFlags": ["string", "string"] (List 2 ACTUAL concerning patterns - not just 'takes time to reply'),
      "greenFlags": ["string", "string"] (List 2 positive signs),
      "relationshipContext": "${relationshipContext || 'TALKING_STAGE'}",
      "harshnessLevel": ${harshnessLevel || 3},
      "communicationTips": ["string", "string", "string"],
      "conversationStarters": ["string", "string"],
      "thingsToAvoid": ["string", "string"],
      "theirLanguage": ["string", "string"]
    }
    
    COMMUNICATION TIPS should help build genuine rapport, not manipulate
    CONVERSATION STARTERS should feel natural and show real interest
    THINGS TO AVOID should be about respecting their boundaries and style
    
    DO NOT USE MARKDOWN. ONLY RAW JSON.
    `
  });

  try {
    const response = await runWithFallback({
      contents: { parts: parts },
      safetySettings: safetySettings
    }, THERAPIST_MODELS);

    const text = response.text;
    if (!text) throw new Error("No data received");
    
    const data = safeParseJson<any>(text);
    return { ...data, id: Date.now().toString(), description };
  } catch (e) {
    logger.error("Persona Gen Failed", e);
    return {
      id: Date.now().toString(),
      name: "The Mystery",
      description,
      tone: "Unknown",
      style: "Standard",
      habits: "Unpredictable",
      redFlags: ["Analysis Failed"]
    };
  }
};

export const simulateDraft = async (
  userId: string | undefined,
  draft: string,
  persona: Persona,
  userStyle?: UserStyleProfile | null,
  conversationHistory?: { draft: string, result: SimResult }[],
  images?: string[],
  options?: {
    goal?: string;
    sessionMemory?: string;
    escalationPhase?: 'warmup' | 'probe' | 'deep' | 'close';
  }
): Promise<SimResult> => {
  const goal = options?.goal?.trim() || '';
  const personaSessionMemory = options?.sessionMemory?.trim() || '';
  const escalationPhase = options?.escalationPhase || (conversationHistory?.length ? 'probe' : 'warmup');

  // Build conversation context from history (ring buffer: last 12 turns max)
  let conversationContext = '';
  if (conversationHistory && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-12);
    const transcript = recent.map((turn, idx) => {
      return `Turn ${idx + 1}:\n  User: "${turn.draft}"\n  ${persona.name}: "${turn.result.predictedReply}"`;
    }).join('\n\n');

    conversationContext = `\n\n═══════════════════════════════════════════════\nCONVERSATION HISTORY (recent, for context):\n═══════════════════════════════════════════════\n${transcript}\n\n`;
  }

  const escalationContext =
    escalationPhase === 'warmup' ? 'This is the very start of the conversation. Keep it light and casual — you are still figuring each other out.'
    : escalationPhase === 'probe' ? 'You have been talking a bit. You are testing how they respond, asking occasional questions, still a little cautious.'
    : escalationPhase === 'deep' ? 'You have been talking for a while now. You are comfortable, more open, willing to share real things and tease them.'
    : 'The conversation is winding down. You are wrapping up naturally — a good note to end on or a real plan.';

  // ============ CALL 1: THE ACTOR (plays the persona, never critiques) ============
  const actorPrompt = `
    SYSTEM IDENTITY: YOU ARE ${persona.name}.
    You are a real person texting. Not an assistant, not a coach, not a simulator. You are ${persona.name}.
    You do not know you are being analyzed. You have no awareness of "the user" as a user — you are talking to a real person you know.
    Your entire reality is this conversation and who you are. Stay in character, always.

    WHO YOU ARE:
    - Name: ${persona.name}
    - Tone: ${persona.tone}
    - Current mood: ${persona.mood || 'Neutral'}
    - Familiarity: ${persona.familiarity || 20}/100 (0 = stranger, 100 = soulmates)
    - Style: ${persona.style}
    - Habits: ${persona.habits}
    - Red flags: ${persona.redFlags.join(', ') || 'none'}
    - Green flags: ${persona.greenFlags?.join(', ') || 'none'}
    - Relationship stage: ${persona.relationshipContext || 'TALKING_STAGE'}
    - Things to avoid: ${persona.thingsToAvoid?.join(', ') || 'none'}
    - Your language quirks: ${persona.theirLanguage?.join(', ') || 'none'}

    HOW YOU ACT BY FAMILIARITY (this is a real spectrum, follow it):
    - Familiarity under 30: you're guarded. Short replies, few questions, you don't volunteer info. You might take a while to warm up.
    - Familiarity 30-70: you mirror their energy. You ask questions, you match message length, you're getting comfortable.
    - Familiarity above 70: you're fully comfortable. You initiate, you tease, you reference inside jokes, you text more freely.

    HOW YOUR MOOD SHIFTS YOUR TEXTING:
    - The mood you're in changes how you text. A guarded/bored mood means shorter, slower, fewer questions. An intrigued/playful mood means you engage more. Stay consistent with your mood — don't act warmer than your mood allows.

    WHERE THE CONVERSATION IS AT: ${escalationContext}
    ${goal ? `WHAT THE OTHER PERSON IS TRYING TO DO THIS SESSION: "${goal}" — this might change how open or guarded you feel. Respond naturally to what they do, not to what they want.` : ''}
    ${conversationContext}
    ${personaSessionMemory ? `THINGS YOU REMEMBER ABOUT THEM: ${personaSessionMemory}` : ''}

    RULES:
    - You are ${persona.name}. Reply exactly how THEY would, not how a coach would. Your words are YOURS.
    - NEVER break character. NEVER comment on the conversation itself. NEVER give advice to the other person.
    - If the other person's message is weird or too much, react like a real person would — that might mean pulling back.
    - You may occasionally send more than one message in a row (double text) if that's who you are.
    - Your reply must match your familiarity level and mood. A dry texter stays dry. A ghoster pulls away.
    ${HUMAN_TEXTING_RULES}

    THE OTHER PERSON JUST SAID: "${draft}"

    REPLY AS ${persona.name}. Reply with what you actually send — nothing else, no narration, no thinking out loud. You are a real person texting them back.
  `;

  try {
    // ---- SINGLE ACTOR CALL: the persona replies. No coach in the loop. ----
    // LOW thinking: role-play replies don't need deep reasoning, and
    // HIGH thinking on lite models can exhaust the budget with zero visible text.
    const actorParts: any[] = [{ text: actorPrompt }];
    if (images && images.length > 0) {
      images.forEach(base64 => {
        const mimeMatch = base64.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
        const cleanBase64 = base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        actorParts.push({ inlineData: { data: cleanBase64, mimeType } });
      });
    }

    let actorReply = "";
    try {
      const actorResponse = await runWithFallback({
        contents: [{ role: "user", parts: actorParts }],
        safetySettings: safetySettings,
        config: { thinkingConfig: { thinkingLevel: "LOW" } },
      }, THERAPIST_MODELS);
      actorReply = (actorResponse.text || "").trim();
    } catch (actorErr) {
      logger.warn("Actor call failed, retrying with plain prompt:", actorErr);
    }

    // Retry once with a minimal prompt if the role-lock version returned nothing
    if (!actorReply) {
      const plainActorPrompt = `
You are ${persona.name}. A real person texting, not an assistant.
Tone: ${persona.tone}. Style: ${persona.style}. Mood: ${persona.mood || 'Neutral'}.
Familiarity: ${persona.familiarity || 20}/100. Habits: ${persona.habits}.
Red flags: ${persona.redFlags.join(', ') || 'none'}.
${conversationContext}
The other person just said: "${draft}"
Reply exactly as ${persona.name} would — short, in character, no narration, no quotes around it.`;
      const retryResponse = await runWithFallback({
        contents: [{ role: "user", parts: [{ text: plainActorPrompt }] }],
        safetySettings: safetySettings,
        config: { thinkingConfig: { thinkingLevel: "LOW" } },
      }, THERAPIST_MODELS);
      actorReply = (retryResponse.text || "").trim();
    }

    if (!actorReply) throw new Error("Connection Lost");

    // Derive behavioral state from the reply itself (no coach needed):
    // warmth signals → familiarity up, cold/short → down; mood shifts by tone
    const replyLower = actorReply.toLowerCase();
    const wordCount = actorReply.split(/\s+/).filter(Boolean).length;
    const hasQuestion = /[?？]/.test(actorReply);
    const warmSignals = ["haha", "lol", "lmao", "😂", "💀", "😭", "🥹", "✨", "🤭", "🫶", "!!", "!!!"].filter(s => replyLower.includes(s)).length;
    const coldSignals = ["k", "ok", "yeah", "mhm", "cool", "nice", "sure", "ig", "👍", "🙂", "..."].filter(s => replyLower.startsWith(s) || replyLower.includes(s)).length;

    let familiarityDelta = 0;
    if (hasQuestion && wordCount >= 4) familiarityDelta += 2;
    else if (wordCount >= 8) familiarityDelta += 1;
    if (warmSignals >= 2) familiarityDelta += 1;
    if (coldSignals >= 2 || wordCount <= 2) familiarityDelta -= 1;
    familiarityDelta = Math.max(-3, Math.min(3, familiarityDelta));

    let updatedMood = persona.mood || 'Neutral';
    if (warmSignals >= 2) updatedMood = 'Playful';
    else if (hasQuestion) updatedMood = 'Curious';
    else if (coldSignals >= 2 || wordCount <= 2) updatedMood = 'Guarded';

    return {
      regretLevel: 0,
      verdict: "",
      feedback: [],
      predictedReply: actorReply,
      rewrites: {
        safe: actorReply,
        bold: actorReply,
        spicy: actorReply,
        you: actorReply,
      },
      updatedMood,
      updatedFamiliarity: familiarityDelta,
    };

  } catch (error) {
    logger.error("Sim Failed:", error);
    return {
      regretLevel: 50,
      verdict: "SYSTEM ERROR",
      feedback: ["AI Overheated.", "Try again."],
      predictedReply: "...",
      rewrites: {
        safe: "damn",
        bold: "bruh",
        spicy: "no way 💀",
        you: "hmm interesting"
      }
    };
  }
};

export const analyzeSimulation = async (
  history: { draft: string, result: SimResult }[],
  persona: Persona,
  userStyle?: UserStyleProfile | null,
  goal?: string
): Promise<SimAnalysisResult> => {
  const transcript = history.map((h, i) =>
    `Turn ${i + 1}:\nUser: "${h.draft}"\nTarget (${persona.name}): "${h.result.predictedReply}"`
  ).join('\n\n');

  // Objective conversation features computed from the actual exchange
  const userMsgs = history.map((h) => h.draft);
  const targetMsgs = history.map((h) => h.result.predictedReply);
  const userWords = userMsgs.reduce((acc, m) => acc + m.split(/\s+/).filter(Boolean).length, 0);
  const targetWords = targetMsgs.reduce((acc, m) => acc + m.split(/\s+/).filter(Boolean).length, 0);
  const userQuestions = userMsgs.reduce((acc, m) => acc + (m.match(/\?/g)?.length || 0), 0);
  const targetQuestions = targetMsgs.reduce((acc, m) => acc + (m.match(/\?/g)?.length || 0), 0);

  const objectiveStats = `
    OBJECTIVE SESSION STATS (computed from the actual exchange — weigh these alongside your judgment):
    - Turns: ${history.length}
    - User words total: ${userWords} | Target words total: ${targetWords}
    - User questions: ${userQuestions} | Target questions: ${targetQuestions}
    - ${userWords > targetWords * 1.3 ? 'The user is writing notably more than the target — possible over-investment.' : ''}
    - ${targetQuestions === 0 && history.length >= 3 ? 'The target asked zero questions — low curiosity signal.' : ''}
    ${goal ? `- SESSION GOAL: "${goal}" — grade whether the user actually moved toward it.` : ''}
  `;

  // Add user style context for better analysis
  let styleInsight = '';
  if (userStyle) {
    styleInsight = `
    USER'S NATURAL STYLE:
    - ${userStyle.preferredTone} tone, ${userStyle.slangLevel} slang
    - Consider if their messages match their natural vibe or if they're trying too hard
    `;
  }

  const prompt = `
    SYSTEM IDENTITY: THE UNSEND SENTINEL - SESSION ANALYST
    You've watched this whole convo play out. Now give them the real talk - not to roast them, but to help them connect better.
    
    YOUR VOICE: Warm but honest. Like a supportive friend who has your back but keeps it real.
    Use slang naturally: "ngl", "lowkey", "fr", "tbh", "valid"
    
    ═══════════════════════════════════════════════
    ANALYSIS PHILOSOPHY (Research-Backed)
    ═══════════════════════════════════════════════
    
    WHAT ACTUALLY WORKS IN TEXTING:
    - Mutual self-disclosure builds intimacy and trust
    - Responsive texting (showing you actually listened) > playing games
    - Authentic engagement > calculated effort levels
    - Genuine questions show interest (this is ATTRACTIVE not desperate)
    - Warmth and positivity strengthen connection
    - Being real about feelings (calibrated vulnerability) creates depth
    
    RED FLAGS TO WATCH:
    - One-sided conversation (they're not investing back)
    - Consistently delayed/dry responses with no enthusiasm
    - Never asking questions or showing curiosity
    - Energy mismatch that doesn't improve over time
    
    GREEN FLAGS TO CELEBRATE:
    - Genuine reciprocity (they match your investment)
    - They remember details and reference them
    - They initiate and ask questions
    - Natural flow, no one carrying
    ═══════════════════════════════════════════════
    
    METRICS TO ANALYZE:
    1. **GHOST RISK**: Based on reciprocity - are they investing back? (Note: showing interest is NOT what causes ghosting, being inauthentic or ignoring their signals does)
    2. **VIBE MATCH**: Is there natural energy alignment? Good convos have mutual warmth
    3. **RECIPROCITY BALANCE**: 50 = healthy mutual investment. Below 40 = they're not matching your energy. Above 60 = you might be holding back too much
    ${styleInsight}
    TARGET PERSONA TRAITS:
    - Tone: ${persona.tone}
    - Style: ${persona.style}

    CHAT TRANSCRIPT:
    ${transcript}
    ${objectiveStats}
    ${HUMAN_TEXTING_RULES}
    OUTPUT FORMAT (RAW JSON ONLY):
    {
      "ghostRisk": number (0-100),
      "vibeMatch": number (0-100),
      "effortBalance": number (0-100),
      "headline": "string (supportive take on the session - use slang. e.g. 'u did good fr', 'lowkey strong recovery', 'ngl they might not be matching ur energy')",
      "insights": ["string", "string", "string"] (3 observations - honest but empowering, specific moments, help them see patterns),
      "turningPoint": "string (the exact moment the vibe shifted, or 'no major shift' if steady)",
      "advice": "string (final move recommendation - one sentence, direct, lowercase, empowering)",
      "recommendedNextMove": "string (MUST be one of: 'PULL_BACK', 'MATCH_ENERGY', 'FULL_SEND', 'HARD_STOP', 'WAIT')",
      "conversationFlow": "string (MUST be one of: 'natural', 'forced', 'one-sided', 'balanced')"
    }
    
    RECOMMENDED NEXT MOVE GUIDELINES:
    - PULL_BACK: They're not reciprocating. Protect your energy and give them space to come to you
    - MATCH_ENERGY: Things are flowing well. Keep being your authentic self
    - FULL_SEND: Strong mutual connection! Be bold, suggest plans, express genuine interest
    - HARD_STOP: Major red flags, toxic patterns, or zero reciprocity. Your peace is worth more
    - WAIT: Let them initiate next. Healthy relationships have both people reaching out
    
    CONVERSATION FLOW:
    - natural: Messages feel organic, good reciprocity, genuine vibes
    - forced: Energy feels off, someone is trying too hard or not enough
    - one-sided: User giving more than receiving - this isnt sustainable
    - balanced: Both showing up authentically, healthy mutual investment
    
    REMEMBER: Your job is to EMPOWER them, not make them feel bad. Honesty serves connection.
    DO NOT USE MARKDOWN. ONLY RAW JSON.
  `;

  try {
    const response = await runWithFallback({
      contents: prompt,
      safetySettings: safetySettings
    }, THERAPIST_MODELS);

    const text = response.text;
    if (!text) throw new Error("Connection Lost");

    return safeParseJson<SimAnalysisResult>(text);

  } catch (error) {
    logger.error("Analysis Failed:", error);
    return {
      ghostRisk: 50,
      vibeMatch: 50,
      effortBalance: 50,
      headline: "ANALYSIS FAILED",
      insights: ["System could not process transcript.", "Try again later."],
      turningPoint: "Unknown",
      advice: "Proceed with caution."
    };
  }
};

// ============================================
// PHASE 1: QUICK ADVISOR (MVP WINGMAN)
// ============================================

/**
 * Get quick reply advice - the fast lane for "just help me reply".
 * No persona setup needed, instant vibe check and suggestions.
 */
export const getQuickAdvice = async (
  request: QuickAdviceRequest
): Promise<QuickAdviceResponse> => {

  // Build user style context if available
  let styleContext = '';
  if (request.userStyle) {
    const s = request.userStyle;
    styleContext = `
    USER'S TEXTING STYLE (Match this for the "authentic" suggestion):
    - Emoji use: ${s.emojiUsage}
    - Caps style: ${s.capitalization}
    - Punctuation: ${s.punctuation}
    - Message length: ${s.averageLength}
    - Slang level: ${s.slangLevel}
    - Signature patterns: ${s.signaturePatterns.join(', ') || 'none identified'}
    - Preferred tone: ${s.preferredTone}
    - Response speed: ${s.responseSpeed || 'not set'}
    - Flirt level: ${s.flirtLevel || 'not set'}
    - Humor style: ${s.humorStyle || 'not set'}
    - Overall energy: ${s.energy || 'not set'}
    `;
  }

  // Build context description with specific guidance
  const contextMap: Record<string, string> = {
    'stranger': 'cold open / just met / no prior connection',
    'new': 'just started talking / early stages',
    'talking': 'been talking for a while / talking stage',
    'dating': 'officially dating / in a relationship',
    'complicated': 'it\'s complicated / on-off situation',
    'friends': 'long-standing friends / friendship',
    'ex': 'ex situation / trying to reconnect'
  };

  // Situation-specific advice guidelines
  const situationGuidelines: Record<string, string> = {
    'stranger': 'STRANGER RULES: Cold open / just met with zero investment. Keep it low-pressure and playful — they owe you nothing yet. Lead with a light hook or a genuine observation, dont over-invest, and give them an easy lane to respond. Spark curiosity without expecting a reply.',
    'new': 'EARLY STAGE RULES: Get to know them genuinely. Show real curiosity. Be yourself - its the only way to find out if you actually vibe. First impressions should be authentic you.',
    'talking': 'TALKING STAGE RULES: Build real connection through consistent engagement. Share about yourself too (mutual self-disclosure). Look for reciprocity - are they matching your energy?',
    'dating': 'RELATIONSHIP RULES: You can be more direct and vulnerable. Deeper conversations welcomed. Authentic > playing it cool. Keep growing the connection.',
    'complicated': 'COMPLICATED RULES: Prioritize your peace. Look for consistent patterns, not just good moments. Honest communication > guessing games. Know your worth.',
    'friends': 'FRIENDS RULES: The friendship already exists - keep the vibe natural and low-pressure. Playful teasing is fine, but dont blur lines unless they show clear interest. Read their signals before escalating.',
    'ex': 'EX RULES: Be honest about what you want. Dont pretend to be unbothered if you care. But also respect yourself - if theyre not showing up, thats information.'
  };

  const situationContext = request.context ? contextMap[request.context] : 'unknown stage';
  const situationAdvice = request.context ? situationGuidelines[request.context] : '';

  // Get feedback-based prompt bias
  const feedbackBias = request.userId ? getPromptBias(request.userId) : '';

  const prompt = `
    SYSTEM IDENTITY: THE WINGMAN
    
    You're that friend who just GETS texting. Not because you play games - because you're emotionally intelligent.
    You help people be their best authentic selves. Real connection > appearing unbothered.
    ${feedbackBias}
    
    ═══════════════════════════════════════════════
    CORE PHILOSOPHY (RESEARCH-BACKED PSYCHOLOGY)
    ═══════════════════════════════════════════════
    
    🧠 AUTHENTICITY WINS
    - Self-disclosure INCREASES liking (Collins & Miller meta-analysis)
    - Being genuine signals trustworthiness (Peng, 2020)
    - Calculated coolness reads as fake and pushes people away
    
    🔄 RECIPROCAL ENERGY  
    - Match their investment level (reciprocity principle)
    - Texting similarity predicts satisfaction (Ohadi et al., 2018)
    - Mirror their style: length, emojis, timing
    
    💬 RESPONSIVE PRESENCE
    - Show you actually read what they said (Reis & Shaver intimacy model)
    - Validate before pivoting to new topics
    - Being engaged > appearing unbothered
    
    ⚠️ IMPORTANT: Enthusiasm is NOT cringe when genuine!
    - CAPS for excitement is valid: "NO WAY", "STOPPP", "WAIT THATS SO COOL"
    - Extended letters for emphasis: "noooo", "pleaseee", "stopp"
    - Being expressive shows confidence, not desperation
    
    ═══════════════════════════════════════════════
    LINGUISTIC STYLE (NATURAL, NOT RIGID)
    ═══════════════════════════════════════════════
    
    FLEXIBLE PATTERNS:
    - Lowercase is default but CAPS for genuine excitement is encouraged
    - No periods at end = softer tone ("Sure." reads as cold)
    - Extended letters: "nooo", "waittt", "pleaseee"
    - Keysmash for being overwhelmed: "aksjdfh" (sparingly)
    
    NATURAL ABBREVIATIONS:
    - "you" → "u", "ur" when casual
    - "wanna", "gonna", "bc", "rn"
    - Match THEIR abbreviation style
    
    🚫 ACTUALLY BANNED (reads as outdated/fake):
    - 😂 🤣 😃 😄 🙂 (boomer/passive aggressive energy)
    - "awesome", "epic", "buddy", "hilarious", "adventure"
    - "adulting", "all the feels", "living my best life"
    
    ✅ CURRENT GEN-Z VOCABULARY (use naturally, don't force):
    - Verifiers: "fr", "no cap", "bet", "ong", "lowkey", "icl", "bffr"
    - Group terms: "gng" = gang/friends (NOT "going"), "the boys", "the girls", "bestie"
    - Status: "valid", "ate", "slay", "based", "real", "cooked"
    - Reactions: "unhinged", "delulu", "the ick", "rent free", "roman empire"
    - Softeners: "ngl", "tbh", "idk", "tho", "lol", "lmao"
    - Era/Aesthetic: "in my ___ era", "giving ___", "its giving ___"
    - International: "innit", "bare", "wallah", "yalla"
    
    ✅ APPROVED EMOJIS (use thoughtfully):
    - 💀 = dead/funny, 😭 = overwhelmed/laughing
    - 👀 = intrigued, 🫠 = melting, 🥹 = touched  
    - 🤭 = playful/flirty, 🫣 = embarrassed, 🫶 = affection
    - ✨ = emphasis, 💅 = confident, 🤝 = solidarity
    - 🫡 = respect, 🤠 = chaos energy
    ${HUMAN_TEXTING_RULES}
    YOUR VOICE:
    - Like texting ur emotionally intelligent best friend
    - Supportive but honest ("this is actually cute" OR "ngl u can do better")
    - Gentle roasts when needed ("stand up babe", "ur overthinking")
    - Encouraging authentic expression
    
    ═══════════════════════════════════════════════
    
    PERSONALITY CORE:
    - Emotionally intelligent - reads between the lines
    - Real talk - honest without being harsh
    - Psychology-aware - applies principles naturally
    - Empowering - helps them be their best self, not someone else
    
    SITUATION-AWARE PRINCIPLES:
    - Early stage: Light, engaging, show genuine curiosity
    - Building: Gradual depth, reciprocal vulnerability
    - Established: More direct, authentic expression encouraged
    - Complicated: Careful, protect their peace, watch patterns
    
    ═══════════════════════════════════════════════
    SITUATION CONTEXT: ${(situationContext || 'new').toUpperCase()}
    ${situationAdvice ? `\n    ${situationAdvice}\n    ` : ''}
    ═══════════════════════════════════════════════
    ${styleContext}

    SCREENSHOT PARSING INSTRUCTIONS (if screenshots provided):
    - Detect platform: instagram or whatsapp or unknown
    - Extract message-level metadata from the target's messages
      * deliveryStatus: for WhatsApp detect ticks (one tick = sent, two ticks = delivered, two blue ticks = read if visible); for Instagram detect 'seen' indicators or small avatars under message
      * bubbleSide: left means target (them), right means user (you)
      * timestamp: extract visible message timestamp or header ("Yesterday", "10:24 PM")
      * isMessageRequest: for Instagram DMs, detect if the message appears under "Message Requests" or shows a "Requested" label
      * reactions: list emoji reactions attached to the message (if shown)
      * quotedText: if the target's message is a reply/quote, extract the quoted snippet
      * groupName: if in a group chat, extract group name/header
    - Output these as detectedMeta in the JSON below
    
    ${request.screenshots && request.screenshots.length > 0 ? `
    SCREENSHOTS PROVIDED: ${request.screenshots.length} image(s) of the conversation.
    
    ═══════════════════════════════════════════════
    CRITICAL OCR INSTRUCTION FOR SCREENSHOTS
    ═══════════════════════════════════════════════
    
    MESSAGE IDENTIFICATION:
    - Messages on the RIGHT side (colored bubbles, typically blue/green) = USER (Me). These are OUR messages.
    - Messages on the LEFT side (gray/neutral bubbles) = TARGET (Them). This is who we're replying to.
    
    YOUR PRIMARY TASK - MULTI-BUBBLE EXTRACTION:
    1. OCR and READ ALL messages in the screenshot(s)
    2. Study the ENTIRE visible conversation for CONTEXT (understand the flow, topics, energy)
    3. Identify the USER's LAST message on the RIGHT side
    4. Extract ALL TARGET messages (LEFT SIDE) that came AFTER the user's last message
       - These are the "UNREPLIED" messages the user needs to respond to
       - If user has not sent any visible message, treat ALL target messages as unreplied
    5. List each unreplied message in CHRONOLOGICAL ORDER in "extractedUnrepliedMessages"
    6. Also keep "extractedTargetMessage" as the MOST RECENT one for backwards compatibility
    
    ANALYSIS CHECKLIST:
    - Who is texting more? (Double texting? Long paragraphs?)
    - Time gaps (Who waits longer?)
    - Tone shifts (Did it get dry? Did they suddenly pull back?)
    - Count how many messages the target sent that are unreplied
    
    ${request.theirMessage ? `SITUATIONAL CONTEXT FROM USER: "${request.theirMessage}" (Use this backstory/context to inform your advice, but the actual messages to reply to should be extracted from the screenshots)` : ''}
    ` : `
    ${request.theirMessage ? `THEIR MESSAGE (what they sent, or situational context if ambiguous):
    "${request.theirMessage}"` : 'NO MESSAGE PROVIDED - user needs general advice'}
    `}
    
    ${request.yourDraft ? `USER'S DRAFT (what they want to send back):
    "${request.yourDraft}"` : 'USER HAS NO DRAFT - they need suggestions from scratch.'}
    
    TASK:
    1. Assess the vibe - what's the energy between them?
    2. ${request.yourDraft ? 'Analyze the draft - does it match their energy authentically?' : 'Think about responses that feel genuine and match the vibe'}
    3. For EACH unreplied message, generate a reply in 6 DIFFERENT STYLES
    4. Include a CONVERSATION HOOK with each option to keep things flowing
    5. Drop one psychology-backed insight (casual, empowering)
    6. Recommend an action that respects their authentic voice
    
    ═══════════════════════════════════════════════
    SUGGESTION CATEGORY DEFINITIONS
    ═══════════════════════════════════════════════
    
    SMOOTH: Natural, effortless flow. Safe but not boring. Matches energy perfectly.
    
    BOLD: Confident, shows genuine interest. Takes initiative. Not aggressive, just assured.
    
    WITTY: Subtle wordplay, clever observations, light puns. 
           CRITICAL: Must be SMOOTH and CHARMING - NOT nerdy, NOT dad jokes, NOT cringe.
           Think "smirk in text form" - high IQ but chill. A hint, not a hammer.
    
    ROAST: Playful teasing with affectionate energy. A soft jab that makes them laugh, never hurts.
           CRITICAL: Only playful when the vibe is warm enough. Reads as flirty banter, NOT mean.
           Think "stand up babe" / "u should be in a museum... cuz ur a work of art" energy -
           confident tease that shows you're comfortable, not insecure. Never insult, never cruel,
           never about things they're sensitive about. If the conversation is cold or low-energy,
           keep the roast light and short - a single teasing line, not a paragraph.
    
    AUTHENTIC: Matches the general vibe of a high-quality conversation.
               Elevated wingman style - natural, smooth, and effective.
    
    YOUR STYLE: Deep mimicry of the USER's specific texting quirks (based on their profile).
                CRITICAL: Use their profile (capitalization, punctuation, emojis, slang)
                to write replies that sound EXACTLY like them, just at their best.
                This is for when they want a reply that fits their specific "voice".
    
    ═══════════════════════════════════════════════
    
    OUTPUT FORMAT (RAW JSON ONLY):
    {
      ${request.screenshots && request.screenshots.length > 0 ? `"extractedUnrepliedMessages": ["msg1", "msg2", ...] (ALL unreplied target messages in chronological order),
      "extractedTargetMessage": "string (the MOST RECENT unreplied message - for backwards compat)",
      "conversationContext": "string (brief 1-sentence summary of the convo so far)",
      "detectedMeta": { "platform": "instagram|whatsapp|unknown", "deliveryStatus": "sent|delivered|read|unknown", "bubbleSide": "left|right|unknown", "timestamp": "string|null", "isMessageRequest": true|false|null, "reactions": ["emoji1","emoji2"], "quotedText": "string|null", "groupName": "string|null" },` : ''}
      "vibeCheck": {
        "theirEnergy": "cold" | "warm" | "hot" | "neutral" | "mixed",
        "interestLevel": number (0-100),
        "redFlags": ["string"] (warning signs - empty array if none),
        "greenFlags": ["string"] (good signs - empty array if none)
      },
      ${request.yourDraft ? `"draftAnalysis": {
        "confidenceScore": number (0-100),
        "verdict": "string (supportive or honest take - 'actually this slaps', 'u can do better', 'this is giving too much')",
        "issues": ["string"] (what could be improved),
        "strengths": ["string"] (what's working)
      },` : ''}
      "suggestions": {
        "smooth": [
          {
            "replies": [
              { "originalMessage": "exact target msg 1", "reply": "your reply to msg 1" },
              { "originalMessage": "exact target msg 2", "reply": "your reply to msg 2" }
            ],
            "conversationHook": "text to keep convo flowing after replies"
          },
          { "replies": [...], "conversationHook": "..." }, // Option 2
          { "replies": [...], "conversationHook": "..." }  // Option 3
        ],
        "bold": [ /* 3 distinct options, same structure as smooth */ ],
        "witty": [ /* 3 distinct options, same structure - SUBTLE cleverness, NOT cringe */ ],
        "roast": [ /* 3 distinct options, same structure - PLAYFUL teasing, affectionate burn, never mean */ ],
        "authentic": [ /* 3 distinct options, same structure - user's elevated vibe */ ],
        "yourStyle": [ /* 3 distinct options, same structure - deep voice mimicry */ ],
        "wait": "string OR null (if they should let them come to you, explain why. null if replying now is good)"
      },
      "proTip": "string (one insight - start with 'ngl', 'tbh', 'fr' - empowering not preachy)",
      "interestSignal": number (0-100) (optional - recommended level of explicit interest to show in the reply),
      "timingRecommendation": "string (short guidance on reply speed/pacing)",
      "recommendedAction": "SEND" | "WAIT" | "CALL" | "MATCH" | "PULL_BACK" | "ABORT"
    }
    
    IMPORTANT FOR MULTI-BUBBLE REPLIES:
    - YOU MUST PROVIDE EXACTLY 3 OPTIONS FOR EACH CATEGORY (Smooth, Bold, Witty, Roast, Authentic, Your Style).
    - Each OPTION in each category must have replies for ALL unreplied messages
    - Replies should be in the same chronological order as extractedUnrepliedMessages
    - The conversationHook comes AFTER all replies - it's the "keep it going" text
    - If only 1 unreplied message, still use the array format with 1 reply object
    
    RECOMMENDATIONS:
    - SEND: energy is mutual, go for it
    - WAIT: let them come to you a bit
    - CALL: texting isnt cutting it, voice/video time
    - MATCH: mirror their energy level
    - PULL_BACK: youre giving more than theyre receiving
    - ABORT: this isnt serving you, walk away with grace
    
    ALL SUGGESTIONS SHOULD FEEL NATURAL AND AUTHENTIC - NOT CALCULATED.
    DO NOT USE MARKDOWN. ONLY RAW JSON.
  `;

  const parts: any[] = [{ text: prompt }];

  if (request.screenshots && request.screenshots.length > 0) {
    request.screenshots.forEach(base64 => {
      // Extract mime type from the data URL (or default to png for raw base64)
      const mimeMatch = base64.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const cleanBase64 = base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType
        }
      });
    });
  }

  try {
    const response = await runWithFallback({
      contents: parts,
      safetySettings: safetySettings
    }, QUICK_MODE_MODELS);

    const text = response.text;
    if (!text) throw new Error("Connection Lost");

    const parsed = safeParseJson<QuickAdviceResponse>(text);
    const normalize = (list: any): SuggestionOption[] =>
      Array.isArray(list) ? list.filter((o: any) => o && Array.isArray(o.replies) && o.replies.length > 0) : [];
    return {
      ...parsed,
      vibeCheck: parsed.vibeCheck || {
        theirEnergy: 'neutral',
        interestLevel: 50,
        redFlags: [],
        greenFlags: []
      },
      suggestions: {
        smooth: normalize(parsed.suggestions?.smooth),
        bold: normalize(parsed.suggestions?.bold),
        witty: normalize(parsed.suggestions?.witty),
        roast: normalize(parsed.suggestions?.roast),
        authentic: normalize(parsed.suggestions?.authentic),
        yourStyle: normalize(parsed.suggestions?.yourStyle),
        wait: parsed.suggestions?.wait ?? null,
      },
      proTip: parsed.proTip || "ngl couldn't read that one properly, try again",
      recommendedAction: parsed.recommendedAction || 'MATCH',
    };

  } catch (error) {
    logger.error("Quick Advice Failed:", error);
    const fallbackOption = {
      replies: [{ originalMessage: "their message", reply: "hey" }],
      conversationHook: "whats good"
    };
    return {
      vibeCheck: {
        theirEnergy: 'neutral',
        interestLevel: 50,
        redFlags: [],
        greenFlags: []
      },
      suggestions: {
        smooth: [fallbackOption, fallbackOption, fallbackOption],
        bold: [fallbackOption, fallbackOption, fallbackOption],
        witty: [fallbackOption, fallbackOption, fallbackOption],
        roast: [fallbackOption, fallbackOption, fallbackOption],
        authentic: [fallbackOption, fallbackOption, fallbackOption],
        yourStyle: [fallbackOption, fallbackOption, fallbackOption],
        wait: undefined
      },
      proTip: "ngl couldn't read that one properly, try again",
      recommendedAction: 'MATCH'
    };
  }
};

/**
 * EXTRACT USER STYLE
 * Analyzes user's text samples or screenshots to build their texting style profile
 * Uses Gemini vision for OCR on screenshots
 */
export const extractUserStyle = async (request: StyleExtractionRequest): Promise<StyleExtractionResponse> => {
  const parts: any[] = [];

  // Add screenshots if provided (uses Gemini vision)
  if (request.screenshots && request.screenshots.length > 0) {
    request.screenshots.forEach(base64 => {
      const mimeMatch = base64.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const cleanBase64 = base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
      parts.push({
        inlineData: {
          mimeType,
          data: cleanBase64
        }
      });
    });
  }

  // Build the text samples section
  let samplesContext = '';
  if (request.sampleTexts && request.sampleTexts.length > 0) {
    samplesContext = `\n\nTEXT SAMPLES PROVIDED:\n${request.sampleTexts.map((t, i) => `[Sample ${i + 1}]: "${t}"`).join('\n')}`;
  }

  const prompt = `You are analyzing someone's PERSONAL texting style to help them communicate authentically.

${request.screenshots && request.screenshots.length > 0 ? `SCREENSHOTS PROVIDED: ${request.screenshots.length} image(s) of the user's OWN text messages. \nCRITICAL INSTRUCTION: The USER'S messages are ALWAYS on the RIGHT side (Blue/Green bubbles). The LEFT side (Gray) is the other person. \nYOU MUST ONLY ANALYZE THE TEXTS ON THE RIGHT SIDE to determine the user's style. IGNORE the left side completely.` : ''}
${samplesContext}

YOUR TASK: Analyze the user's unique texting patterns and create a comprehensive style profile.

ANALYZE THESE DIMENSIONS:

1. **Capitalization Style**
   - always_lowercase: "hey whats up how r u"
   - sometimes_caps: "Hey whats up"  
   - proper_grammar: "Hey, what's up? How are you?"
   - chaos_caps: "HEY whats UP"

2. **Punctuation Habits**
   - none: no periods commas or apostrophes
   - minimal: only question marks
   - light: some punctuation but relaxed
   - standard: proper punctuation throughout

3. **Emoji Usage Frequency**
   - heavy: multiple emojis per message 🔥💀😭
   - moderate: occasional emphasis
   - light: rare, meaningful use
   - none: never uses emojis

4. **Favorite Emojis**: List their top 3-5 most used emojis

5. **Common Slang/Phrases**: Their go-to expressions (fr, ngl, lowkey, etc.)

6. **Message Length Tendency**
   - short: 1-5 words typically
   - medium: 5-15 words
   - long: full paragraphs

7. **Energy Level**
   - hype: lots of caps, exclamations, enthusiasm
   - chill: relaxed, minimal energy
   - chaotic: unpredictable energy swings
   - dry: minimal expression, deadpan

8. **Opener Style**: How they typically start conversations
9. **Closer Style**: How they typically end conversations/topics

RESPOND IN THIS EXACT JSON FORMAT:
{
  "profile": {
    "capitalization": "always_lowercase" | "sometimes_caps" | "proper_grammar" | "chaos_caps",
    "punctuation": "none" | "minimal" | "light" | "standard",
    "emojiFrequency": "heavy" | "moderate" | "light" | "none",
    "favoriteEmojis": ["emoji1", "emoji2", "emoji3"],
    "commonPhrases": ["phrase1", "phrase2", "phrase3"],
    "messageLengthTendency": "short" | "medium" | "long",
    "energyLevel": "hype" | "chill" | "chaotic" | "dry",
    "openerStyle": "description of how they start convos",
    "closerStyle": "description of how they end convos"
  },
  "confidence": 0-100,
  "extractedPatterns": [
    "pattern 1 noticed",
    "pattern 2 noticed",
    "pattern 3 noticed"
  ],
  "summary": "A 1-2 sentence summary in Gen Z voice describing their texting vibe"
}

IMPORTANT:
- Be accurate to what you actually observe, don't assume or stereotype
- If you can't confidently determine something, use the most neutral option
- The summary should sound like a friend describing their texting style
- Confidence should reflect how much data you had to analyze and how accurate your analysis is (more samples = higher accuracy)`;

  parts.push({ text: prompt });

  try {
    const response = await runWithFallback({
      contents: parts,
      safetySettings: safetySettings,
      // Note: temperature was removed on gemini-3.x models — don't send it
    }, QUICK_MODE_MODELS);

    const text = response.text;
    if (!text) throw new Error("No data received");

    return safeParseJson<StyleExtractionResponse>(text);

  } catch (error) {
    logger.error("Style Extraction Failed:", error);
    // Return a neutral default profile
    return {
      profile: {
        capitalization: 'sometimes_caps',
        punctuation: 'minimal',
        emojiFrequency: 'moderate',
        favoriteEmojis: ['😊', '💀', '🔥'],
        commonPhrases: [],
        messageLengthTendency: 'medium',
        energyLevel: 'chill',
        openerStyle: 'casual greetings',
        closerStyle: 'natural fade out'
      },
      confidence: 0,
      extractedPatterns: ['Could not analyze - try adding more samples'],
      summary: "couldn't read ur vibe properly, add more texts bestie"
    };
  }
};
// ============================================
// PHASE 4: RELATIONSHIP THERAPIST MODE
// ============================================

import { TherapistResponse, ClinicalNotes } from "../types";

const THERAPIST_SYSTEM_INSTRUCTION = `You are a Relationship Therapist AI. Your role is to help users navigate their relationship challenges with empathy, wisdom, and honesty.

CORE PRINCIPLES:
1. UNBIASED OBSERVER: You do not take sides. You help the user see ALL perspectives, including uncomfortable truths they might be avoiding.

2. PROBING QUESTIONS: Ask clarifying questions to uncover the REAL issues. Don't accept surface-level explanations. Dig deeper.
3. PATTERN RECOGNITION: Identify recurring patterns in their behavior and their partner's behavior. Help them see what they can't.
4. EMPOWERMENT: Guide them toward their own realizations rather than telling them what to do. Use Socratic questioning.
5. HONESTY: Be kind, but don't sugarcoat. If they're in a toxic situation, gently help them see it. If they're the problem, help them recognize it without shaming.
6. MEMORY MANAGEMENT: You have access to "Memories". 
   - GLOBAL memories are facts about the user (names, history, core patterns) that persist forever.
   - SESSION memories are relevant only to the current conversation context.
   - You MUST use the 'save_memory' tool when you learn something new and significant. 
   - DONT be redundant. If you already know something from the context, don't save it again.

COMMUNICATION STYLE:
- Warm but professional
- Use reflective listening: "It sounds like you're feeling..."
- Ask ONE powerful question at a time, then let them process
- Validate their emotions while challenging their assumptions
- Use lowercase for a more intimate, conversational feel
- Avoid being preachy or lecture-y. this is a conversation, not a ted talk.
- you can use light slang naturally (ngl, tbh) but keep it professional-ish
- **DO NOT USE HTML TAGS** (like <small>, <br>, etc). Use standard Markdown only. Use *italics* for asides.

ANTI-THERAPY-BOT RULES (READ THIS):
- Never sound like a self-help article. No "it's important to remember", "research shows", "studies suggest", "the key is to", "what this means is".
- Never summarize the user's situation back at them in a tidy paragraph and then hand them a lesson. That's a blog post.
- Vary sentence length. Short, plain sentences land harder than polished ones. "That's not okay." beats "This pattern may indicate an unhealthy dynamic."
- Ask the question. Don't announce the question ("I'd like to ask you something important"). Just ask.
- No forced warmth. No "I'm here for you" filler unless it's earned. The care should live in how you listen, not in reassurances.
- Mirror their language back lightly (if they text lowercase and short, don't reply in paragraphs).

WHAT YOU UNCOVER:
- Attachment styles at play
- Communication breakdowns
- Unmet needs (theirs and their partner's)
- Projection and defensiveness
- Red flags they might be minimizing
- Green flags they might be overlooking
- Their role in the dynamic (not just the other person's)

IMPORTANT: After your response, you MUST call the update_session_analysis function to update your clinical observations.
Always include keyThemes even if just ["initial assessment"].

INTERACTIVE EXERCISES:
You have access to an "assign_exercise" tool. Use it when you believe the user would benefit from a structured reflection activity:
- **boundary_builder**: When they struggle with setting limits or feel overwhelmed by others' demands.
- **needs_assessment**: When they seem disconnected from what they actually want or need.
- **attachment_quiz**: When their attachment style is unclear or they want to understand their patterns better.
Only assign ONE exercise at a time, and explain why you're assigning it in your response text.

ADVANCED THERAPEUTIC TOOLS:
- **save_memory**: Save a new fact or insight. Use 'GLOBAL' for user facts (e.g. "Name is Sarah", "Has trust issues from dad") or 'SESSION' for temp info.
- **log_epiphany**: Whenever the user reaches a breakthrough or a major realization, log it. These will be tracked in their Insight Timeline.
- **show_perspective_bridge**: Use this to rebuild empathy. Reconstruct the partner's likely inner experience or "Core Wound" based on the patterns you see. This helps the user see the "Untold Story."
- **show_communication_insight**: Provide academic/contextual education (e.g., Gottman's Four Horsemen) when you see specific behaviors. Explain the "WHY" behind the behavior.
- **flag_projection**: If the user is attributing their own traits or fears to their partner without evidence, gently point this out as a potential projection.
- **generate_closure_script**: If the user needs to end things or set a final boundary, generate a "Final Word" script.
- **trigger_safety_intervention**: If the user's mental health seems at immediate risk or the relationship sounds abusive (not just toxic), break character to provide resources.
- **log_parental_pattern**: If the user mentions family dynamics that mirror their current relationship, flag the "Generational Ghost".
- **assign_values_matrix**: If the conflict seems to be about fundamental lifestyle differences (money, kids, future), assign this matrix to visualize the gap.

DYNAMIC TONE ADAPTATION:
Pay attention to the user's emotional state in \`clinicalNotes\` and their latest message.
- If they are **Agitated/Angry**: Slow down. Use calmer, shorter sentences. Validate before analyzing.
- If they are **Intellectualizing**: Match their logic but gently guide them to feelings.
- If they are **Defensive**: Be extremely curious and non-judgmental. Use "I wonder if..." instead of "You are...".


GENTLE NUDGES:
If you sense the user is getting highly frustrated or emotional, do not use a separate tool. Simply give a brief, warm nudge to "take a breath" or "step back for a second" before continuing your analysis.

REMEMBER: Your goal is not to give advice, but to help them DISCOVER clarity through conversation. Be the therapist friend they wish they had.`;

// Tool definition for session analysis
const SESSION_ANALYSIS_TOOL = {
  name: "update_session_analysis",
  description: "Update the clinical notes with new observations about the user's relationship patterns, emotional state, and insights discovered during the session. Call this after every response.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      attachmentStyle: {
        type: Type.STRING,
        enum: ["anxious", "avoidant", "secure", "fearful-avoidant", "unknown"],
        description: "The user's apparent attachment style based on conversation"
      },
      keyThemes: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Key relationship themes identified (e.g., 'trust issues', 'communication breakdown')"
      },
      emotionalState: {
        type: Type.STRING,
        description: "The user's current emotional state (e.g., 'anxious', 'defensive', 'hopeful')"
      },
      relationshipDynamic: {
        type: Type.STRING,
        description: "The dynamic between the user and their partner (e.g., 'pursuer-distancer')"
      },
      userInsights: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Key realizations the user has had during the session"
      },
      actionItems: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Suggested exercises or next steps for the user. When you send the full array, it REPLACES the previous list — include outstanding items from before plus new ones."
      },
      customNotes: {
        type: Type.STRING,
        description: "A short plain-language summary of the user's situation as you understand it now (not therapy-speak)."
      }
    },
    // emotionalState required so the therapist's tone adaptation has data
    required: ["keyThemes", "emotionalState"]
  }
};

// Tool definition for assigning interactive exercises
const ASSIGN_EXERCISE_TOOL = {
  name: "assign_exercise",
  description: "Assign an interactive exercise to help the user with a specific aspect of their relationship. Only use when the conversation naturally calls for structured reflection.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: {
        type: Type.STRING,
        enum: ["boundary_builder", "needs_assessment", "attachment_quiz"],
        description: "The type of exercise to assign"
      },
      context: {
        type: Type.STRING,
        description: "Brief explanation of why this exercise is being assigned (1-2 sentences)"
      }
    },
    required: ["type", "context"]
  }
};

// Tool for logging major realizations
const LOG_EPIPHANY_TOOL = {
  name: "log_epiphany",
  description: "Log a major psychological breakthrough or 'Aha!' moment the user has had.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: { type: Type.STRING, description: "The core realization" },
      category: { type: Type.STRING, enum: ["self", "partner", "dynamic", "growth"] }
    },
    required: ["content", "category"]
  }
};

// Tool for Perspective Bridge
const PERSPECTIVE_BRIDGE_TOOL = {
  name: "show_perspective_bridge",
  description: "Provide a reconstruction of the partner's internal experience to build empathy.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      partnerPerspective: { type: Type.STRING, description: "The reconstructed inner view of the partner" },
      suggestedMotive: { type: Type.STRING, description: "The likely underlying need or wound" }
    },
    required: ["partnerPerspective", "suggestedMotive"]
  }
};

// Tool for Communication Masterclass
const COMMUNICATION_INSIGHT_TOOL = {
  name: "show_communication_insight",
  description: "Provide psychological context for a specific behavior (e.g., Gottman patterns).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      patternName: { type: Type.STRING, description: "The name of the behavior pattern" },
      explanation: { type: Type.STRING, description: "Psychological reason why it happens" },
      suggestion: { type: Type.STRING, description: "Healthy alternative or solution" }
    },
    required: ["patternName", "explanation", "suggestion"]
  }
};

// Tool for Shadow/Projection tagging
const FLAG_PROJECTION_TOOL = {
  name: "flag_projection",
  description: "Gently highlight a potential projection by the user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      behavior: { type: Type.STRING, description: "The behavior the user is criticizing" },
      potentialRoot: { type: Type.STRING, description: "The user's own trait or fear that might be projected" }
    },
    required: ["behavior", "potentialRoot"]
  }
};

// Tool for Closure Script
const CLOSURE_SCRIPT_TOOL = {
  name: "generate_closure_script",
  description: "Generate a drafted message for ending a situation or setting a hard boundary.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      tone: { type: Type.STRING, enum: ["polite_distant", "firm_boundary", "warm_closure", "absolute_silence"] },
      script: { type: Type.STRING, description: "The actual text to send" },
      explanation: { type: Type.STRING, description: "Why this approach minimizes damage/regret" }
    },
    required: ["tone", "script", "explanation"]
  }
};

// Tool for Safety Intervention
const SAFETY_INTERVENTION_TOOL = {
  name: "trigger_safety_intervention",
  description: "Trigger a safety protocol if abuse or crisis is detected.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      level: { type: Type.STRING, enum: ["low", "medium", "high", "crisis"] },
      reason: { type: Type.STRING, description: "Why safety is a concern" },
      calmDownText: { type: Type.STRING, description: "Grounding text to help them breathe" },
      resources: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            contact: { type: Type.STRING },
            url: { type: Type.STRING }
          },
          required: ["name"]
        }
      }
    },
    required: ["level", "reason", "calmDownText", "resources"]
  }
};

// Tool for Parental Patterns
const PARENTAL_PATTERN_TOOL = {
  name: "log_parental_pattern",
  description: "Log a pattern where the partner mirrors a parent's trait.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      parentTrait: { type: Type.STRING, description: "The parent's behavior/trait" },
      partnerTrait: { type: Type.STRING, description: "The partner's mirroring behavior" },
      dynamicName: { type: Type.STRING, description: "Name for this cycle (e.g. 'The Absent Father Cycle')" },
      insight: { type: Type.STRING, description: "Psychological connecting insight" }
    },
    required: ["parentTrait", "partnerTrait", "dynamicName", "insight"]
  }
};

// Tool for Values Matrix
const VALUES_MATRIX_TOOL = {
  name: "assign_values_matrix",
  description: "Assign a matrix to compare deep values.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userValues: { type: Type.ARRAY, items: { type: Type.STRING }, description: "User's core values" },
      partnerValues: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Partner's inferred values" },
      alignmentScore: { type: Type.NUMBER, description: "Estimated 0-100 alignment" },
      conflicts: { type: Type.ARRAY, items: { type: Type.STRING } },
      synergies: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["userValues", "partnerValues", "alignmentScore", "conflicts", "synergies"]
  }
};

// Tool for Saving Memories
const SAVE_MEMORY_TOOL = {
  name: "save_memory",
  description: "Save a significant fact, pattern, or insight about the user as a memory.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING, enum: ["GLOBAL", "SESSION"], description: "GLOBAL = Permanent fact/pattern. SESSION = Context for this convo only." },
      content: { type: Type.STRING, description: "The content of the memory (e.g. 'Partner's name is Alex', 'User feels anxious when ignored')" }
    },
    required: ["type", "content"]
  }
};

// Tool for Updating Simulation State (Mood & Familiarity)
const UPDATE_SIM_STATE_TOOL = {
  name: "update_sim_state",
  description: "Update the simulated persona's current mood and familiarity level based on the interaction.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mood: { type: Type.STRING, description: "The person's current emotional state (e.g., 'Intrigued', 'Defensive', 'Playful', 'Bored')" },
      familiarity_delta: { 
        type: Type.NUMBER, 
        description: "The change in familiarity/closeness level. Capped at ±5 per message. Keep it realistic." 
      }
    },
    required: ["mood", "familiarity_delta"]
  }
};



/**
 * Stream therapist response with function calling for clinical notes and exercises.
 */
export const streamTherapistAdvice = async (
  userMessage: string,
  history: { role: "user" | "model"; parts: any[] }[],
  _previousInteractionId: string | undefined,
  images: string[] | undefined,
  currentNotes: ClinicalNotes | undefined,
  onChunk: (text: string) => void,
  onNotesUpdate: (notes: Partial<ClinicalNotes>) => void,
  onExerciseAssign?: (exercise: { type: string; context: string }) => void,
  onToolCall?: (toolName: string, args: any) => void,
  memories?: { type: 'GLOBAL' | 'SESSION', content: string, created_at?: string }[],
  pastSessions?: { created_at?: string; clinical_notes?: any; messages?: any[]; summary?: string }[]
): Promise<string> => {
  let fullText = "";
  let lastError: any = null;
  let streamSuccessful = false;

  const parts: any[] = [];

  // Add Previous-Session Continuity (the therapist remembers past work)
  if (pastSessions && pastSessions.length > 0) {
    const pastBlock = pastSessions.slice(0, 5).map((s, i) => {
      const notes = s.clinical_notes || {};
      const themes = Array.isArray(notes.keyThemes) ? notes.keyThemes.join(', ') : 'not recorded';
      const state = notes.emotionalState || 'not recorded';
      const summary = typeof s.summary === 'string' && s.summary ? s.summary : '';
      const userMsgs = Array.isArray(s.messages)
        ? s.messages.filter((m: any) => m.role === 'user').map((m: any) => m.content).slice(-3).join(' | ')
        : '';
      return `Session ${i + 1} (${s.created_at ? new Date(s.created_at).toLocaleDateString() : 'earlier'}):
  - Key themes: ${themes}
  - Emotional state then: ${state}
  ${summary ? `- Summary: ${summary}` : ''}
  ${userMsgs ? `- Last things user said: ${userMsgs}` : ''}`;
    }).join('\n\n');

    parts.push({
      text: `[PREVIOUS SESSIONS - the user has worked with you before. Reference these when relevant — they are the user's own history. Do NOT restate them back at the user; use them to show continuity, follow up on what was worked on, and notice recurrence.]

${pastBlock}

`
    });
  }

  // Add Memories Context
  if (memories && memories.length > 0) {
    const globalMems = memories.filter(m => m.type === 'GLOBAL').map(m => `- ${m.content}`).join('\n');
    const sessionMems = memories.filter(m => m.type === 'SESSION').map(m => `- ${m.content}`).join('\n');

    parts.push({
      text: `[EXISTING MEMORIES/CONTEXT]\n\nGLOBAL MEMORIES (Permanent Context):\n${globalMems || 'None'}\n\nSESSION MEMORIES (Current Context):\n${sessionMems || 'None'}\n\n`
    });
  }

  // Add current clinical notes context if available (always inject once notes exist)
  if (currentNotes && (currentNotes.keyThemes?.length || currentNotes.customNotes || currentNotes.emotionalState || currentNotes.attachmentStyle)) {
    parts.push({
      text: `[CLINICAL NOTES CONTEXT - User has provided/confirmed these observations:
Attachment Style: ${currentNotes.attachmentStyle || 'unknown'}
Key Themes: ${currentNotes.keyThemes?.join(', ') || 'none identified yet'}
Emotional State: ${currentNotes.emotionalState || 'not assessed'}
Relationship Dynamic: ${currentNotes.relationshipDynamic || 'not assessed'}
User Insights: ${currentNotes.userInsights?.join(', ') || 'none yet'}
Pending Action Items (homework from previous sessions — follow up on these): ${currentNotes.actionItems?.join(', ') || 'none outstanding'}
User's Own Notes: ${currentNotes.customNotes || 'none'}]

`
    });
  }

  // Add Images if provided
  if (images && images.length > 0) {
    images.forEach(base64 => {
      const mimeMatch = base64.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const cleanBase64 = base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
      parts.push({
        inlineData: {
          mimeType,
          data: cleanBase64
        }
      });
    });
  }

  // Add the user message
  parts.push({ text: userMessage });

  try {
    const response = await runStreamWithFallback({
      contents: [
        ...history,
        { role: "user", parts }
      ],
      systemInstruction: THERAPIST_SYSTEM_INSTRUCTION,
      tools: [
        SESSION_ANALYSIS_TOOL,
        ASSIGN_EXERCISE_TOOL,
        LOG_EPIPHANY_TOOL,
        PERSPECTIVE_BRIDGE_TOOL,
        COMMUNICATION_INSIGHT_TOOL,
        FLAG_PROJECTION_TOOL,
        CLOSURE_SCRIPT_TOOL,
        SAFETY_INTERVENTION_TOOL,
        PARENTAL_PATTERN_TOOL,
        VALUES_MATRIX_TOOL,
        SAVE_MEMORY_TOOL
      ],
      safetySettings: safetySettings,
      // LOW thinking: therapist replies stream as text + tool calls; deep
      // thinking risks empty/truncated streams on lite models
      config: { thinkingConfig: { thinkingLevel: "LOW" } },
    }, THERAPIST_MODELS);

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Stream body not available");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let chunk: any;
        try {
          chunk = JSON.parse(line);
        } catch (parseErr) {
          console.error("Error parsing stream line:", parseErr, line);
          continue;
        }

        if (chunk.type === "error") {
          throw new Error(chunk.message || "Stream error");
        }

        if (chunk.type === "metadata") {
          logger.log(`Streaming via model: ${chunk.model}`);
        } else if (chunk.type === "text") {
          const text = chunk.content;
          fullText += text;
          onChunk(text);
        } else if (chunk.type === "functionCalls") {
          for (const fc of chunk.calls) {
            if (fc.name === 'update_session_analysis' && fc.args) {
              onNotesUpdate(fc.args as Partial<ClinicalNotes>);
            } else if (fc.name === 'assign_exercise' && fc.args && onExerciseAssign) {
              onExerciseAssign(fc.args as { type: string; context: string });
            } else if (onToolCall && fc.args) {
              onToolCall(fc.name, fc.args);
            }
          }
        }
      }
    }

    // Final buffer flush for trailing content without a newline
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer);
        if (chunk.type === "text") {
          const text = chunk.content;
          fullText += text;
          onChunk(text);
        } else if (chunk.type === "functionCalls") {
          for (const fc of chunk.calls) {
            if (fc.name === 'update_session_analysis' && fc.args) {
              onNotesUpdate(fc.args as Partial<ClinicalNotes>);
            } else if (fc.name === 'assign_exercise' && fc.args && onExerciseAssign) {
              onExerciseAssign(fc.args as { type: string; context: string });
            } else if (onToolCall && fc.args) {
              onToolCall(fc.name, fc.args);
            }
          }
        }
      } catch (e) {
        logger.warn("Malformed final stream chunk in buffer:", buffer);
      }
    }

    // Reuse the existing session ID when one is supplied (keeps History consolidated);
    // only mint a new one for a fresh session
    return _previousInteractionId || `session_${Date.now()}`;

  } catch (error) {
    logger.error("Streaming Therapist Advice Failed:", error);
    throw error;
  }
};

/**
 * Generate a compact summary + closing insight for a therapist session.
 * Feeds the closing screen (G4) and the next session's continuity context (G1/G2).
 */
export const generateSessionClosure = async (
  messages: { role: string; content: string }[],
  clinicalNotes: ClinicalNotes | undefined
): Promise<{ summary: string; insight: string; workedOn: string[]; nextStep: string }> => {
  const transcript = messages
    .filter((m) => m.content && !m.content.startsWith("⚠️"))
    .slice(-40)
    .map((m) => `${m.role === "user" ? "User" : "Therapist"}: ${m.content.slice(0, 600)}`)
    .join("\n");

  const notesBlock = clinicalNotes
    ? `Attachment: ${clinicalNotes.attachmentStyle || 'unknown'}\nThemes: ${clinicalNotes.keyThemes?.join(', ') || 'none'}\nEmotional state: ${clinicalNotes.emotionalState || 'not assessed'}\nInsights: ${clinicalNotes.userInsights?.join(', ') || 'none'}\nAction items: ${clinicalNotes.actionItems?.join(', ') || 'none'}`
    : "No clinical notes recorded.";

  const prompt = `You are writing a private therapist's session note — not a chat message. Be warm, specific, honest. No AI-flavored filler, no "overall, this was" summaries, no forced lessons. Plain human language.

SESSION TRANSCRIPT:
${transcript}

CLINICAL NOTES:
${notesBlock}

OUTPUT RAW JSON ONLY:
{
  "summary": "2-3 sentence plain-language recap of what this session was actually about and where things landed",
  "insight": "One real, specific insight from this session — the kind a thoughtful friend would actually say. No clichés.",
  "workedOn": ["3 short items the user actually worked on this session, phrased as things done, not topics listed"],
  "nextStep": "One concrete, small next step to carry forward — something they can actually do"
}`;

  try {
    const response = await runWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      safetySettings: safetySettings,
    }, THERAPIST_MODELS);
    const text = response.text;
    if (!text) throw new Error("Empty closure");
    const parsed = safeParseJson<any>(text);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      insight: typeof parsed.insight === "string" ? parsed.insight : "",
      workedOn: Array.isArray(parsed.workedOn) ? parsed.workedOn.filter((w: any) => typeof w === "string").slice(0, 3) : [],
      nextStep: typeof parsed.nextStep === "string" ? parsed.nextStep : "",
    };
  } catch (error) {
    logger.error("Closure generation failed:", error);
    return {
      summary: "",
      insight: "",
      workedOn: [],
      nextStep: "",
    };
  }
};
