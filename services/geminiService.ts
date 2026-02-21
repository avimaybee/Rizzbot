import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SimResult, Persona, SimAnalysisResult, QuickAdviceRequest, QuickAdviceResponse, UserStyleProfile, StyleExtractionRequest, StyleExtractionResponse, AIExtractedStyleProfile } from "../types";
import { getPromptBias } from "./feedbackService";

/**
 * SECURITY NOTE: The Gemini API key is no longer stored in the frontend bundle.
 * Instead, we proxy all requests through our own backend function at /api/gemini
 * which injects the key securely from an environment variable.
 */
const originalFetch = window.fetch;
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = typeof input === 'string'
    ? input
    : (input instanceof URL ? input.href : input.url);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    // If the URL can't be parsed (e.g., a relative or malformed URL), fall through to original fetch
    return originalFetch(input, init);
  }

  if (parsedUrl.hostname === 'generativelanguage.googleapis.com') {
    const proxyUrl = `/api/gemini${parsedUrl.pathname}${parsedUrl.search}`;

    // Handle cases where input is a Request object to preserve headers, method, and body
    if (typeof input !== 'string' && !(input instanceof URL)) {
      // Create a new Request based on the original but with the proxy URL
      const modifiedRequest = new Request(proxyUrl, input);
      return originalFetch(modifiedRequest);
    }

    return originalFetch(proxyUrl, init);
  }
  return originalFetch(input, init);
};

// Initialize with a placeholder. The actual key is handled by the backend proxy.
const ai = new GoogleGenAI({ apiKey: 'PROXY_SECURED' });

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
      console.log(`${operationName}: Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms (503 error)`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but ensures we always throw a meaningful error
  throw lastError;
}

// --- FALLBACK LOGIC ---
const PRIMARY_MODEL = "gemini-3-flash-preview";
const FALLBACK_MODEL = "gemini-2.5-flash"; // Standard free tier, reliable

/**
 * Robust wrapper for Gemini generation with Model Fallback.
 * Tries PRIMARY_MODEL first. If it hits 429 (Quota) or 503 (Overloaded), 
 * it seamlessly retries with FALLBACK_MODEL.
 */
async function runWithFallback(
  operation: (model: string) => Promise<any>,
  operationName: string
): Promise<any> {
  try {
    // Try Primary Model
    return await retryWithBackoff(() => operation(PRIMARY_MODEL), `${operationName} [Primary]`);
  } catch (error: any) {
    const msg = error?.message || error?.toString() || '';

    // Check for Quota (429) or Overloaded (503) or generic 500s that might be model specific
    if (msg.includes('429') || msg.includes('503') || msg.includes('Quota') || msg.includes('Overloaded')) {
      console.warn(`⚠️ ${operationName}: Primary model (${PRIMARY_MODEL}) failed (${msg}). Switching to fallback: ${FALLBACK_MODEL}`);

      // Try Fallback Model
      return await retryWithBackoff(() => operation(FALLBACK_MODEL), `${operationName} [Fallback]`);
    }

    // If it's a safety block or request error, don't retry with fallback, just throw
    throw error;
  }
}

/**
 * Robust wrapper for STREAMING with Fallback.
 * Note: Once a stream starts successfully, we can't fallback mid-stream easily.
 * This protects against the initial connection/handshake failing.
 */
async function runStreamWithFallback(
  operation: (model: string) => Promise<any>,
  operationName: string
): Promise<any> {
  try {
    return await operation(PRIMARY_MODEL);
  } catch (error: any) {
    const msg = error?.message || error?.toString() || '';
    if (msg.includes('429') || msg.includes('503') || msg.includes('Quota')) {
      console.warn(`⚠️ ${operationName}: Primary stream failed. Switching to fallback.`);
      return await operation(FALLBACK_MODEL);
    }
    throw error;
  }
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
      parts.push({ inlineData: { mimeType: "image/png", data: base64 } });
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
      "style": "string (e.g., 'Lowercase casual', 'Thoughtful paragraphs', 'Quick bursts', 'Emoji-heavy')",
      "habits": "string (e.g., 'Takes time to respond thoughtfully', 'Prefers voice notes', 'Night owl texter')",
      "redFlags": ["string", "string"] (List 2 ACTUAL concerning patterns - not just 'takes time to reply'. Examples: 'inconsistent hot/cold behavior', 'avoids direct questions about plans', 'only reaches out when convenient for them'),
      "greenFlags": ["string", "string"] (List 2 positive signs you noticed - e.g., 'asks follow-up questions', 'remembers details', 'initiates conversations'),
      "relationshipContext": "${relationshipContext || 'TALKING_STAGE'}",
      "harshnessLevel": ${harshnessLevel || 3},
      "communicationTips": ["string", "string", "string"] (3 tips on how to build genuine connection with this persona - based on what they respond well to),
      "conversationStarters": ["string", "string"] (2 natural, authentic openers that match their vibe - not tricks, genuine conversation starts),
      "thingsToAvoid": ["string", "string"] (2 things that would make them feel pressured or disconnected),
      "theirLanguage": ["string", "string"] (2-3 words/phrases they use often - helps user speak their language authentically)
    }
    
    COMMUNICATION TIPS should help build genuine rapport, not manipulate
    CONVERSATION STARTERS should feel natural and show real interest
    THINGS TO AVOID should be about respecting their boundaries and style
    
    DO NOT USE MARKDOWN. ONLY RAW JSON.
    `
  });

  try {
    const response = await runWithFallback(
      (modelId) => ai.models.generateContent({
        model: modelId,
        contents: { parts: parts },
        config: { safetySettings: safetySettings }
      }),
      'generatePersona'
    );

    let text = response.text;
    if (!text) throw new Error("No data");
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');

    const data = JSON.parse(text);
    return { ...data, id: Date.now().toString(), description };
  } catch (e) {
    console.error("Persona Gen Failed", e);
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
  draft: string,
  persona: Persona,
  userStyle?: UserStyleProfile | null,
  conversationHistory?: { draft: string, result: SimResult }[]
): Promise<SimResult> => {

  // Build conversation context from history
  let conversationContext = '';
  if (conversationHistory && conversationHistory.length > 0) {
    const transcript = conversationHistory.map((turn, idx) => {
      return `Turn ${idx + 1}:\n  User: "${turn.draft}"\n  ${persona.name}: "${turn.result.predictedReply}"`;
    }).join('\n\n');

    conversationContext = `\n\n═══════════════════════════════════════════════\nCONVERSATION HISTORY (for context):\n═══════════════════════════════════════════════\n${transcript}\n\n`;
  }

  // Build user style context if available
  let userStyleContext = '';
  if (userStyle) {
    userStyleContext = `
    USER'S PERSONAL TEXTING STYLE (Match this for the "you" suggestion without compromising authenticity. authenticity is priority):
    - Emoji use: ${userStyle.emojiUsage}
    - Caps style: ${userStyle.capitalization}
    - Punctuation: ${userStyle.punctuation}
    - Message length: ${userStyle.averageLength}
    - Slang level: ${userStyle.slangLevel}
    - Their signature patterns: ${userStyle.signaturePatterns.join(', ') || 'none'}
    - Preferred tone: ${userStyle.preferredTone}
    
    CRITICAL FOR "YOU" SUGGESTION:
    - Sound EXACTLY like the user would naturally type - don't add extra flair or slang they don't use
    - If they're casual and simple, keep it casual and simple
    - DON'T make it more elaborate or add phrases they wouldn't use
    - Match their exact length preference - if they text short, keep it short
    - Only use emojis if they naturally use emojis
    - The goal is their authentic voice, just slightly polished - NOT a complete rewrite
    `;
  }

  // Get feedback-based prompt bias
  const feedbackBias = getPromptBias();

  const prompt = `
    SYSTEM IDENTITY: THE WINGMAN
    You're that friend who's effortlessly good at texting. Authentic, smooth, emotionally intelligent.
    You help people communicate genuinely - not play games. Real connection > calculated coolness.
    
    YOUR VOICE: Supportive but honest. You want them to succeed AND be themselves.
    - Sample tones: "okay wait this is actually cute", "ngl u can do better", "this aint it babe", "ur overthinking it"
    - Be direct, warm, occasionally roast when needed, but ultimately empowering
    ${feedbackBias}
    ═══════════════════════════════════════════════
    CORE PHILOSOPHY (RESEARCH-BACKED)
    ═══════════════════════════════════════════════
    
    🧠 AUTHENTICITY > CALCULATION
    - Self-disclosure increases liking (Collins & Miller, 1994)
    - Being genuine signals trustworthiness
    - Performed coolness reads as fake
    
    🔄 RECIPROCAL ENERGY
    - Match their investment level (Miller & Kenny, 1986)
    - Mirror their style (length, emojis, timing)
    - Don't over-correct OR under-deliver
    
    💬 RESPONSIVE PRESENCE  
    - Show you read what they said
    - Validate before pivoting
    - Engagement > appearing unbothered
    
    ⚠️ IMPORTANT: Being expressive is NOT cringe. Showing enthusiasm when appropriate is healthy.
    CAPS for genuine excitement is valid: "NO WAY", "STOPPP", "WAIT WHAT"
    
    ═══════════════════════════════════════════════
    LINGUISTIC STYLE RULES
    ═══════════════════════════════════════════════
    
    NATURAL PATTERNS (not rigid rules):
    - Lowercase is standard but caps for emphasis/excitement is valid
    - No periods at end = softer tone ("Sure." vs "sure")
    - Extended letters for emphasis: "nooo", "pleaseee", "stopp"
    - Keysmash for overwhelm: "aksjdfh" (use sparingly)
    
    ABBREVIATIONS (natural usage):
    - "you" → "u", "ur" when casual
    - "want to" → "wanna", "gonna", "bc"
    - Match their abbreviation level
    
    🚫 ACTUALLY BANNED (reads as fake/boomer):
    - 😂 🤣 😃 😄 (outdated reaction emojis)
    - "awesome", "epic", "buddy", "hilarious", "adventure"
    - "adulting", "all the feels", "living my best life"
    - 🙂 (reads passive aggressive)
    
    ✅ GEN-Z APPROVED VOCABULARY:
    - Verifiers: "fr", "no cap", "bet", "ong", "lowkey", "highkey", "icl", "bffr"
    - Group terms: "gng" = gang/friends (NOT "going"), "the boys", "the girls", "bestie"
    - Status: "valid", "cooked", "ate", "slay", "based", "real"
    - Reactions: "unhinged", "delulu", "the ick", "rent free"
    - Softeners: "ngl", "tbh", "idk", "tho", "lol", "lmao"
    - Era talk: "in my ___ era", "giving ___", "its giving ___"
    
    ✅ APPROVED EMOJIS:
    - 💀 = dead/funny, 😭 = overwhelmed (often for laughing)
    - 👀 = intrigued, 🫠 = melting, 🥹 = touched
    - 🤭 = flirty, 🫣 = embarrassed, 🫶 = affection
    - ✨ = emphasis, 💅 = unbothered, 🤝 = agreement
    
    ═══════════════════════════════════════════════
    
    TARGET PERSONA:
    - Name: ${persona.name}
    - Tone: ${persona.tone}
    - Style: ${persona.style}
    - Habits: ${persona.habits}
    - Red Flags: ${persona.redFlags.join(', ')}
    ${conversationContext}
    ${userStyleContext}
    
    TASK: 
    1. Analyze the user's draft - Does it match their target's energy? Is it authentic?
    2. Calculate "Regret Level" (0-100) - would they cringe at this later?
    3. PREDICT how the Persona would reply (match their exact vibe).
    4. SUGGEST 3 follow-up options for after the predicted reply.
    
    ANALYSIS FRAMEWORK:
    - Does it match THEIR energy? (reciprocity principle)
    - Does it sound authentic or calculated?
    - Is it responsive to what they said?
    - Is it appropriate for the relationship stage?

    INPUT DRAFT: "${draft}"

    OUTPUT FORMAT (RAW JSON ONLY):
    {
      "regretLevel": number (0-100),
      "verdict": "string (Your take - supportive OR honest. e.g. 'actually this is cute', 'ur trying too hard', 'they wont get this')",
      "feedback": ["string", "string", "string"] (3 specific observations - be real but constructive),
      "predictedReply": "string (What ${persona.name} sends back. MUST follow their style exactly. If they're dry: max 5 words, no questions. If engaged: match energy.)",
      "rewrites": {
        "safe": "string (authentic, cant go wrong - matches their energy)",
        "bold": "string (confident, shows genuine interest)", 
        "spicy": "string (playful, flirty - adds some tension)",
        "you": "string (MUST sound exactly like what the user would naturally type. Keep the same length, same vibe, same casualness. Just fix any awkwardness. If user is simple, be simple. DO NOT add extra slang, emojis, or phrases they wouldn't use. Less is more.)"
      }
    }
    
    ALL TEXT IN SUGGESTIONS SHOULD FEEL NATURAL AND AUTHENTIC.
    DO NOT USE MARKDOWN. ONLY RAW JSON.
  `;

  try {
    const response = await retryWithBackoff(
      () => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { safetySettings: safetySettings }
      }),
      'simulateDraft'
    );

    let text = response.text;
    if (!text) throw new Error("Connection Lost");

    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return JSON.parse(text) as SimResult;

  } catch (error) {
    console.error("Sim Failed:", error);
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
  userStyle?: UserStyleProfile | null
): Promise<SimAnalysisResult> => {
  const transcript = history.map((h, i) =>
    `Turn ${i + 1}:\nUser: "${h.draft}"\nTarget (${persona.name}): "${h.result.predictedReply}"`
  ).join('\n\n');

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
    const response = await runWithFallback(
      (modelId) => ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: { safetySettings: safetySettings }
      }),
      'analyzeSimulation'
    );

    let text = response.text;
    if (!text) throw new Error("Connection Lost");

    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return JSON.parse(text) as SimAnalysisResult;

  } catch (error) {
    console.error("Analysis Failed:", error);
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
    `;
  }

  // Build context description with specific guidance
  const contextMap: Record<string, string> = {
    'new': 'just started talking / early stages',
    'talking': 'been talking for a while / talking stage',
    'dating': 'officially dating / in a relationship',
    'complicated': 'it\'s complicated / on-off situation',
    'ex': 'ex situation / trying to reconnect'
  };

  // Situation-specific advice guidelines
  const situationGuidelines: Record<string, string> = {
    'new': 'EARLY STAGE RULES: Get to know them genuinely. Show real curiosity. Be yourself - its the only way to find out if you actually vibe. First impressions should be authentic you.',
    'talking': 'TALKING STAGE RULES: Build real connection through consistent engagement. Share about yourself too (mutual self-disclosure). Look for reciprocity - are they matching your energy?',
    'dating': 'RELATIONSHIP RULES: You can be more direct and vulnerable. Deeper conversations welcomed. Authentic > playing it cool. Keep growing the connection.',
    'complicated': 'COMPLICATED RULES: Prioritize your peace. Look for consistent patterns, not just good moments. Honest communication > guessing games. Know your worth.',
    'ex': 'EX RULES: Be honest about what you want. Dont pretend to be unbothered if you care. But also respect yourself - if theyre not showing up, thats information.'
  };

  const situationContext = request.context ? contextMap[request.context] : 'unknown stage';
  const situationAdvice = request.context ? situationGuidelines[request.context] : '';

  // Get feedback-based prompt bias
  const feedbackBias = getPromptBias();

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
    SITUATION CONTEXT: ${situationContext.toUpperCase()}
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
    3. For EACH unreplied message, generate a reply in 4 DIFFERENT STYLES
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
    
    AUTHENTIC: Matches the USER's natural texting vibe (based on their style profile).
               CRITICAL: Use their profile as a GUIDE for voice (length, caps, emoji), 
               but write NATURAL high-quality replies. DO NOT force their exact words/phrases.
               Write like their BEST SELF - same vibe, just polished. Don't caricature them.
    
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
        "authentic": [ /* 3 distinct options, same structure - user's elevated vibe */ ],
        "wait": "string OR null (if they should let them come to you, explain why. null if replying now is good)"
      },
      "proTip": "string (one insight - start with 'ngl', 'tbh', 'fr' - empowering not preachy)",
      "interestSignal": number (0-100) (optional - recommended level of explicit interest to show in the reply),
      "timingRecommendation": "string (short guidance on reply speed/pacing)",
      "recommendedAction": "SEND" | "WAIT" | "CALL" | "MATCH" | "PULL_BACK" | "ABORT"
    }
    
    IMPORTANT FOR MULTI-BUBBLE REPLIES:
    - YOU MUST PROVIDE EXACTLY 3 OPTIONS FOR EACH CATEGORY (Smooth, Bold, Witty, Authentic).
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
      // Remove data URL prefix if present
      const cleanBase64 = base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: "image/png"
        }
      });
    });
  }

  try {
    const response = await runWithFallback(
      (modelId) => ai.models.generateContent({
        model: modelId,
        contents: parts,
        config: { safetySettings: safetySettings }
      }),
      'getQuickAdvice'
    );

    let text = response.text;
    if (!text) throw new Error("Connection Lost");

    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return JSON.parse(text) as QuickAdviceResponse;

  } catch (error) {
    console.error("Quick Advice Failed:", error);
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
        authentic: [fallbackOption, fallbackOption, fallbackOption],
        wait: null
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
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: base64
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
    const model = ai.models;
    const response = await retryWithBackoff(
      () => model.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts }],
        config: {
          safetySettings,
          temperature: 0.3, // Lower temp for more consistent analysis
        },
      }),
      'extractUserStyle'
    );

    let text = response.text?.trim() || '';

    // Clean JSON response
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return JSON.parse(text) as StyleExtractionResponse;

  } catch (error) {
    console.error("Style Extraction Failed:", error);
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
    type: "object",
    properties: {
      attachmentStyle: {
        type: "string",
        enum: ["anxious", "avoidant", "secure", "fearful-avoidant", "unknown"],
        description: "The user's apparent attachment style based on conversation"
      },
      keyThemes: {
        type: "array",
        items: { type: "string" },
        description: "Key relationship themes identified (e.g., 'trust issues', 'communication breakdown')"
      },
      emotionalState: {
        type: "string",
        description: "The user's current emotional state (e.g., 'anxious', 'defensive', 'hopeful')"
      },
      relationshipDynamic: {
        type: "string",
        description: "The dynamic between the user and their partner (e.g., 'pursuer-distancer')"
      },
      userInsights: {
        type: "array",
        items: { type: "string" },
        description: "Key realizations the user has had during the session"
      },
      actionItems: {
        type: "array",
        items: { type: "string" },
        description: "Suggested exercises or next steps for the user"
      }
    },
    required: ["keyThemes"]
  }
};

// Tool definition for assigning interactive exercises
const ASSIGN_EXERCISE_TOOL = {
  name: "assign_exercise",
  description: "Assign an interactive exercise to help the user with a specific aspect of their relationship. Only use when the conversation naturally calls for structured reflection.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["boundary_builder", "needs_assessment", "attachment_quiz"],
        description: "The type of exercise to assign"
      },
      context: {
        type: "string",
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
    type: "object",
    properties: {
      content: { type: "string", description: "The core realization" },
      category: { type: "string", enum: ["self", "partner", "dynamic", "growth"] }
    },
    required: ["content", "category"]
  }
};

// Tool for Perspective Bridge
const PERSPECTIVE_BRIDGE_TOOL = {
  name: "show_perspective_bridge",
  description: "Provide a reconstruction of the partner's internal experience to build empathy.",
  parameters: {
    type: "object",
    properties: {
      partnerPerspective: { type: "string", description: "The reconstructed inner view of the partner" },
      suggestedMotive: { type: "string", description: "The likely underlying need or wound" }
    },
    required: ["partnerPerspective", "suggestedMotive"]
  }
};

// Tool for Communication Masterclass
const COMMUNICATION_INSIGHT_TOOL = {
  name: "show_communication_insight",
  description: "Provide psychological context for a specific behavior (e.g., Gottman patterns).",
  parameters: {
    type: "object",
    properties: {
      patternName: { type: "string", description: "The name of the behavior pattern" },
      explanation: { type: "string", description: "Psychological reason why it happens" },
      suggestion: { type: "string", description: "Healthy alternative or solution" }
    },
    required: ["patternName", "explanation", "suggestion"]
  }
};

// Tool for Shadow/Projection tagging
const FLAG_PROJECTION_TOOL = {
  name: "flag_projection",
  description: "Gently highlight a potential projection by the user.",
  parameters: {
    type: "object",
    properties: {
      behavior: { type: "string", description: "The behavior the user is criticizing" },
      potentialRoot: { type: "string", description: "The user's own trait or fear that might be projected" }
    },
    required: ["behavior", "potentialRoot"]
  }
};

// Tool for Closure Script
const CLOSURE_SCRIPT_TOOL = {
  name: "generate_closure_script",
  description: "Generate a drafted message for ending a situation or setting a hard boundary.",
  parameters: {
    type: "object",
    properties: {
      tone: { type: "string", enum: ["polite_distant", "firm_boundary", "warm_closure", "absolute_silence"] },
      script: { type: "string", description: "The actual text to send" },
      explanation: { type: "string", description: "Why this approach minimizes damage/regret" }
    },
    required: ["tone", "script", "explanation"]
  }
};

// Tool for Safety Intervention
const SAFETY_INTERVENTION_TOOL = {
  name: "trigger_safety_intervention",
  description: "Trigger a safety protocol if abuse or crisis is detected.",
  parameters: {
    type: "object",
    properties: {
      level: { type: "string", enum: ["low", "medium", "high", "crisis"] },
      reason: { type: "string", description: "Why safety is a concern" },
      calmDownText: { type: "string", description: "Grounding text to help them breathe" },
      resources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            contact: { type: "string" },
            url: { type: "string" }
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
    type: "object",
    properties: {
      parentTrait: { type: "string", description: "The parent's behavior/trait" },
      partnerTrait: { type: "string", description: "The partner's mirroring behavior" },
      dynamicName: { type: "string", description: "Name for this cycle (e.g. 'The Absent Father Cycle')" },
      insight: { type: "string", description: "Psychological connecting insight" }
    },
    required: ["parentTrait", "partnerTrait", "dynamicName", "insight"]
  }
};

// Tool for Values Matrix
const VALUES_MATRIX_TOOL = {
  name: "assign_values_matrix",
  description: "Assign a matrix to compare deep values.",
  parameters: {
    type: "object",
    properties: {
      userValues: { type: "array", items: { type: "string" }, description: "User's core values" },
      partnerValues: { type: "array", items: { type: "string" }, description: "Partner's inferred values" },
      alignmentScore: { type: "number", description: "Estimated 0-100 alignment" },
      conflicts: { type: "array", items: { type: "string" } },
      synergies: { type: "array", items: { type: "string" } }
    },
    required: ["userValues", "partnerValues", "alignmentScore", "conflicts", "synergies"]
  }
};

// Tool for Saving Memories
const SAVE_MEMORY_TOOL = {
  name: "save_memory",
  description: "Save a significant fact, pattern, or insight about the user as a memory.",
  parameters: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["GLOBAL", "SESSION"], description: "GLOBAL = Permanent fact/pattern. SESSION = Context for this convo only." },
      content: { type: "string", description: "The content of the memory (e.g. 'Partner's name is Alex', 'User feels anxious when ignored')" }
    },
    required: ["type", "content"]
  }
};


// Helper to safely extract text from a chunk/response
function getResponseText(response: any): string {
  if (typeof response.text === 'function') {
    return response.text();
  } else if (typeof response.text === 'string') {
    return response.text;
  } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    return response.candidates[0].content.parts[0].text;
  }
  return '';
}

// Helper to safely extract function calls from a chunk/response
function getResponseFunctionCalls(response: any): any[] {
  if (typeof response.functionCalls === 'function') {
    return response.functionCalls();
  } else if (Array.isArray(response.functionCalls)) {
    return response.functionCalls;
  } else if (response.candidates?.[0]?.content?.parts) {
    const calls = [];
    for (const part of response.candidates[0].content.parts) {
      if (part.functionCall) {
        calls.push(part.functionCall);
      }
    }
    return calls;
  }
  return [];
}

/**
 * Stream therapist response with function calling for clinical notes and exercises.
 */
export const streamTherapistAdvice = async (
  userMessage: string,
  _previousInteractionId: string | undefined,
  images: string[] | undefined,
  currentNotes: ClinicalNotes | undefined,
  onChunk: (text: string) => void,
  onNotesUpdate: (notes: Partial<ClinicalNotes>) => void,
  onExerciseAssign?: (exercise: { type: string; context: string }) => void,
  onToolCall?: (toolName: string, args: any) => void,
  memories?: { type: 'GLOBAL' | 'SESSION', content: string, created_at?: string }[]
): Promise<string> => {
  try {
    const parts: any[] = [];

    // Add Memories Context
    if (memories && memories.length > 0) {
      const globalMems = memories.filter(m => m.type === 'GLOBAL').map(m => `- ${m.content}`).join('\n');
      const sessionMems = memories.filter(m => m.type === 'SESSION').map(m => `- ${m.content}`).join('\n');

      parts.push({
        text: `[EXISTING MEMORIES/CONTEXT]\n\nGLOBAL MEMORIES (Permanent Context):\n${globalMems || 'None'}\n\nSESSION MEMORIES (Current Context):\n${sessionMems || 'None'}\n\n`
      });
    }

    // Add current clinical notes context if available
    if (currentNotes && (currentNotes.keyThemes?.length || currentNotes.customNotes)) {
      parts.push({
        text: `[CLINICAL NOTES CONTEXT - User has provided/confirmed these observations:
Attachment Style: ${currentNotes.attachmentStyle || 'unknown'}
Key Themes: ${currentNotes.keyThemes?.join(', ') || 'none identified yet'}
Emotional State: ${currentNotes.emotionalState || 'not assessed'}
Relationship Dynamic: ${currentNotes.relationshipDynamic || 'not assessed'}
User Insights: ${currentNotes.userInsights?.join(', ') || 'none yet'}
User's Own Notes: ${currentNotes.customNotes || 'none'}]

`
      });
    }

    // Add images if provided
    if (images && images.length > 0) {
      parts.push({ text: "The user has shared these conversation screenshots for context. Analyze them carefully:" });
      images.forEach(base64 => {
        const cleanBase64 = base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: "image/png"
          }
        });
      });
    }

    // Add the user message
    parts.push({ text: userMessage });

    const result = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: THERAPIST_SYSTEM_INSTRUCTION,
        tools: [{
          functionDeclarations: [
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
          ]
        }],
        safetySettings: safetySettings,
      }
    });

    let fullText = "";

    for await (const chunk of result) {
      // Handle text chunks
      const chunkText = getResponseText(chunk);
      if (chunkText) {
        fullText += chunkText;
        onChunk(chunkText);
      }

      // Handle function calls
      const functionCalls = getResponseFunctionCalls(chunk);
      if (functionCalls && functionCalls.length > 0) {
        for (const fc of functionCalls) {
          if (fc.name === 'update_session_analysis' && fc.args) {
            onNotesUpdate(fc.args as Partial<ClinicalNotes>);
          } else if (fc.name === 'assign_exercise' && fc.args && onExerciseAssign) {
            onExerciseAssign(fc.args as { type: string; context: string });
          } else if (onToolCall && fc.args) {
            // Generic handler for new therapeutic tools
            onToolCall(fc.name, fc.args);
          }
        }
      }
    }

    // Return a simple session ID based on timestamp
    return `session_${Date.now()}`;

  } catch (error) {
    console.error("Streaming Therapist Advice Failed:", error);
    onChunk("something went wrong. let's try that again?");
    return "";
  }
};

/**
 * Get therapist advice (non-streaming fallback).
 */
export const getTherapistAdvice = async (
  userMessage: string,
  _previousInteractionId?: string,
  images?: string[]
): Promise<TherapistResponse> => {
  try {
    const parts: any[] = [];

    if (images && images.length > 0) {
      parts.push({ text: "The user has shared these conversation screenshots:" });
      images.forEach(base64 => {
        const cleanBase64 = base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        parts.push({
          inlineData: { data: cleanBase64, mimeType: "image/png" }
        });
      });
    }

    parts.push({ text: userMessage });

    const result = await retryWithBackoff(
      () => ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: THERAPIST_SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: [SESSION_ANALYSIS_TOOL] }],
          safetySettings: safetySettings,
        }
      }),
      'getTherapistAdvice'
    );

    const response = result;
    const reply = getResponseText(response) || "i'm having trouble processing that. can you try rephrasing?";

    // Extract clinical notes from any function calls
    let clinicalNotes: Partial<ClinicalNotes> | undefined;
    const functionCalls = getResponseFunctionCalls(response);
    if (functionCalls && functionCalls.length > 0) {
      const analysisCall = functionCalls.find(fc => fc.name === 'update_session_analysis');
      if (analysisCall?.args) {
        clinicalNotes = analysisCall.args as Partial<ClinicalNotes>;
      }
    }

    return {
      reply,
      interactionId: `session_${Date.now()}`,
      clinicalNotes
    };

  } catch (error) {
    console.error("Therapist Advice Failed:", error);
    return {
      reply: "something went wrong on my end. let's take a breath and try again?",
      interactionId: ""
    };
  }
};
