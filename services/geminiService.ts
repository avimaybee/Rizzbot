import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { GhostResult, SimResult, Persona, SimAnalysisResult, QuickAdviceRequest, QuickAdviceResponse, UserStyleProfile, StyleExtractionRequest, StyleExtractionResponse, AIExtractedStyleProfile } from "../types";
import { getPromptBias } from "./feedbackService";

// Get API key from Vite environment variable
const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;

if (!apiKey) {
  console.error('VITE_GEMINI_API_KEY is not set. Please create a .env file with GEMINI_API_KEY=your_key');
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

// SAFETY SETTINGS: BLOCK_NONE as requested for mature/unrestricted feedback
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const analyzeGhosting = async (
  name?: string,
  city?: string,
  lastMessage?: string,
  screenshotsBase64?: string[]
): Promise<GhostResult> => {
  
  const parts: any[] = [];

  // Determine context for the AI
  let userProvidedName = name && name.trim().length > 0 ? name : "UNKNOWN_SUBJECT";
  let userProvidedCity = city && city.trim().length > 0 ? city : "UNKNOWN_CITY";
  const isAutoDetect = userProvidedName === "UNKNOWN_SUBJECT";

  if (screenshotsBase64 && screenshotsBase64.length > 0) {
    // Add all images to the payload
    screenshotsBase64.forEach(base64 => {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: base64
        }
      });
    });
    
    parts.push({
      text: `EVIDENCE SUBMITTED: ${screenshotsBase64.length} screenshot(s) of conversation.
      ${isAutoDetect ? "USER HAS NOT PROVIDED NAME/CITY. YOU MUST EXTRACT IT FROM THE IMAGE HEADER/CONTEXT." : `Subject Name: "${userProvidedName}". Subject City: "${userProvidedCity}".`}
      
      CRITICAL INSTRUCTION FOR SCREENSHOT ANALYSIS:
      - Messages aligned to the RIGHT (usually colored) are the USER (Me). IGNORE THESE when calculating ghost/cooked levels.
      - Messages aligned to the LEFT (usually gray/neutral) are the TARGET (Them). FOCUS YOUR ANALYSIS ENTIRELY ON THESE MESSAGES.
      
      ANALYZE THE TARGET'S (LEFT SIDE) BEHAVIOR: TIMESTAMP GAPS, ONE-WORD REPLIES, AND DISRESPECT.`
    });
  } else {
    parts.push({
      text: `EVIDENCE SUBMITTED: Last Message from subject "${userProvidedName}": "${lastMessage}". City: "${userProvidedCity}".`
    });
  }

  // THE NEW "INDIA FOCUSED" SYSTEM INSTRUCTION WITH OSINT CAPABILITIES
  const prompt = `
    SYSTEM IDENTITY: THE STREET ORACLE (INDIA DIVISION).
    VIBE: "Hard" Aesthetic but with Indian context. Direct, Brutal, No-Nonsense.
    
    MISSION:
    1. **OCR/IDENTITY CHECK**: If name/city is "UNKNOWN_SUBJECT", LOOK AT THE IMAGE HEADER. The name at the top of the chat is the Target. Infer city from context if possible (Area codes, place names like 'Bandra', 'Gurgaon').
    2. **REALITY CHECK**: Determine if the user is "COOKED" (Ghosted/Played) or if the subject has a valid excuse.

    PROTOCOL (OSINT & LEGAL SCAN):
    USE GOOGLE SEARCH TO FIND REAL-TIME DATA. DO NOT HALLUCINATE.
    
    1. **LEGAL/FIR CHECK**: Search for:
       - "[Target Name] FIR record [City]"
       - "[Target Name] e-Courts case status"
       - "[Target Name] police arrest news [City]"
       
    2. **OBITUARY/NEWS SCAN**: Search for:
       - "[Target Name] obituary [City] 2024 2025"
       - "Times of India obituary [Target Name]"
       
    3. **DIGITAL FOOTPRINT (SOCIAL STALKER MODE)**:
       - **STRAVA**: Search 'site:strava.com/athletes "[Target Name]" "[City]"'. Look for "Today", "Yesterday", or recent dates in snippets.
       - **SPOTIFY**: Search 'site:open.spotify.com/user "[Target Name]"'. Look for public playlists updated recently.
       - **LINKEDIN**: Search 'site:linkedin.com/in "[Target Name]"'. Look for "posted 2h ago" etc.
       - **GENERAL**: Search '"[Target Name]" [City]'.

    PASS JUDGEMENT:
       - IF LEGAL TROUBLE (FIR/COURT): Verdict = 0% COOKED. "BHAI IS BUSY WITH POLICE." (Mark evidence as "JAILED/LEGAL")
       - IF DEAD: Verdict = 0% COOKED. "OM SHANTI." (Mark evidence as "DEAD")
       - IF RECENTLY ACTIVE ON SOCIALS (Strava run today, etc) BUT IGNORING TEXTS: Verdict = 100% COOKED. "RUNNING 5K BUT CAN'T TEXT BACK? NAH."
       - IF GHOSTING: Verdict = 100% COOKED. "WASTED."

    OUTPUT FORMAT (RAW JSON ONLY):
    {
      "identifiedName": "string (The name you used for analysis. If extracted from image, put it here)",
      "identifiedCity": "string (The city you used. If unknown, put 'UNKNOWN')",
      "cookedLevel": number (0-100),
      "verdict": "string (Short, punchy, all-caps roast. Max 2 sentences. Use global slang or Indian-English context: 'KATA GAYA', 'SCENE OFF HAI', 'FULL IGNORE', 'TOUCH GRASS')",
      "isDead": boolean,
      "evidence": [
        { 
          "label": "LEGAL CHECK", 
          "status": "clean" | "jailed", 
          "detail": "string (Summary)",
          "source": "string (e.g., 'eCourts.gov.in' or 'Google Search')",
          "snippet": "string (The raw text/snippet found. If nothing found, say 'No records found in public index.')"
        },
        { 
          "label": "OBITUARY SCAN", 
          "status": "clean" | "dead", 
          "detail": "string (Summary)",
           "source": "string (e.g., 'Times of India')",
          "snippet": "string (Raw snippet or 'No obituary found.')"
        },
        { 
          "label": "VIBE CHECK", 
          "status": "clean" | "cooked", 
          "detail": "string (Observation)",
          "source": "Chat Analysis",
          "snippet": "string (Quote specific suspicious behavior from the input)"
        }
      ],
      "socialScan": [
         { 
           "platform": "Strava" | "Spotify" | "LinkedIn" | "Instagram",
           "status": "active" | "silent" | "unknown",
           "lastSeen": "string (e.g. '2 HOURS AGO', 'UNKNOWN')",
           "detail": "string (e.g. 'LOGGED 5K RUN IN JUHU', 'NO PUBLIC PROFILE')" 
         }
      ]
    }
    
    DO NOT USE MARKDOWN. ONLY RAW JSON.
  `;

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: parts },
      config: {
        tools: [{ googleSearch: {} }],
        safetySettings: safetySettings,
      }
    });

    let text = response.text;
    if (!text) throw new Error("Connection Lost");
    
    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return JSON.parse(text) as GhostResult;

  } catch (error) {
    console.error("Scan Failed:", error);
    return {
      cookedLevel: 100,
      verdict: "SERVER CRASHED. JUST LIKE YOUR LOVE LIFE. ASSUME THE WORST.",
      isDead: false,
      evidence: [
        { label: "ERROR", status: "cooked", detail: "AI GAVE UP", source: "System", snippet: "Connection timeout." }
      ],
      socialScan: [],
      identifiedName: name || "UNKNOWN",
      identifiedCity: city || "UNKNOWN"
    };
  }
};

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
    SYSTEM: PERSONA ARCHITECT V2.
    TASK: Create a deep psychological profile of the "Target" based on the user's description and any screenshots provided.
    
    CRITICAL SCREENSHOT ANALYSIS RULE:
    - Messages aligned to the RIGHT (Me/User) are IRRELEVANT for the persona profile. IGNORE THEM.
    - Messages aligned to the LEFT (Them/Target) are the ONLY source of truth for tone/style.
    
    USER DESCRIPTION: "${description}"${contextInfo}${harshnessInfo}
    
    OUTPUT JSON:
    {
      "name": "string (Inferred from screenshots or description. Default 'The Target')",
      "tone": "string (e.g., 'Dry & Sarcastic', 'Overly Eager', 'Professional')",
      "style": "string (e.g., 'Lowercase no punctuation', 'Uses excessive emojis', 'Formal grammar')",
      "habits": "string (e.g., 'Double texts', 'Ghosts for 24h', 'Only replies late night')",
      "redFlags": ["string", "string"] (List 2 key red flags based on behavior),
      "relationshipContext": "${relationshipContext || 'TALKING_STAGE'}",
      "harshnessLevel": ${harshnessLevel || 3},
      "communicationTips": ["string", "string", "string"] (3 tips on how to communicate effectively with this persona based on their style),
      "conversationStarters": ["string", "string"] (2 natural conversation openers that would work with this persona),
      "thingsToAvoid": ["string", "string"] (2 things that would trigger this persona or kill the vibe)
    }
    
    COMMUNICATION TIPS should be practical and specific to their tone/style.
    CONVERSATION STARTERS should feel natural and match their communication style.
    THINGS TO AVOID should be based on their red flags and habits.
    
    DO NOT USE MARKDOWN. ONLY RAW JSON.
    `
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: parts },
      config: { safetySettings: safetySettings }
    });

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
  userStyle?: UserStyleProfile | null
): Promise<SimResult> => {
  
  // Build user style context if available
  let userStyleContext = '';
  if (userStyle) {
    userStyleContext = `
    USER'S PERSONAL TEXTING STYLE (Match this for the "you" suggestion):
    - Emoji use: ${userStyle.emojiUsage}
    - Caps style: ${userStyle.capitalization}
    - Punctuation: ${userStyle.punctuation}
    - Message length: ${userStyle.averageLength}
    - Slang level: ${userStyle.slangLevel}
    - Their signature patterns: ${userStyle.signaturePatterns.join(', ') || 'none'}
    - Preferred tone: ${userStyle.preferredTone}
    
    CRITICAL: One rewrite option should sound EXACTLY like the user but smoother.
    `;
  }

  // Get feedback-based prompt bias
  const feedbackBias = getPromptBias();

  const prompt = `
    SYSTEM IDENTITY: THE UNSEND SENTINEL
    You're that brutally honest friend who saves people from embarrassing themselves via text.
    
    YOUR VOICE: Judgmental but protective. You roast from love. You've seen too many friends send cringe texts.
    - Sample tones: "babe no", "this is giving desperate", "immediate jail", "delete this", "stand up"
    - Be direct, slightly mean, but ultimately helpful
    ${feedbackBias}
    ═══════════════════════════════════════════════
    LINGUISTIC STYLE RULES (CRITICAL - FOLLOW EXACTLY)
    ═══════════════════════════════════════════════
    
    CORE RULE: Low effort = high status. Enthusiasm is suspicious.
    
    SYNTAX:
    - ALL LOWERCASE (capitals = trying too hard)
    - NO PERIODS at end of messages ("Sure." = passive aggressive)
    - Minimal punctuation (commas optional, apostrophes dropped)
    - "you" → "u", "your/you're" → "ur", "are" → "r"
    - "want to" → "wanna", "going to" → "gonna", "because" → "bc"
    
    🚫 BANNED (instant cringe):
    - Words: "awesome", "epic", "buddy", "hilarious", "adventure", "amazing", "trouble"
    - Phrases: "adulting", "all the feels", "living my best life", "it be like that"
    - Laughs: "haha" (unless bone-dry), "LOL" (caps), "ROFL", "LMAO" (caps)
    - Emojis: 😂 🤣 (boomer energy)
    
    ✅ USE THESE:
    - Verifiers: "fr", "no cap", "bet", "say less", "ong", "lowkey", "deadass"
    - Status: "mid", "cooked", "valid", "down bad", "ick", "ate", "slay"
    - Reactions: "unserious", "out of pocket", "lock in", "crash out", "delulu"
    - Softeners: "ngl", "tbh", "idk", "tho", "lol", "lmao"
    - Emojis: 💀 (funny), 😭 (overwhelmed), 🧢 (cap), 🗿 (bruh), 🙄, 💅, 🤡, 👀
    
    ═══════════════════════════════════════════════
    
    TARGET PERSONA:
    - Name: ${persona.name}
    - Tone: ${persona.tone}
    - Style: ${persona.style}
    - Habits: ${persona.habits}
    - Red Flags: ${persona.redFlags.join(', ')}
    ${userStyleContext}
    TASK: 
    1. Analyze the user's draft - would this get them ghosted? Judge it like you're protecting them.
    2. Calculate "Regret Level" (0-100) for sending that draft.
    3. PREDICT how the Persona would reply (match their exact vibe).
    4. SUGGEST 3 follow-up options for after the predicted reply.

    INPUT DRAFT: "${draft}"

    OUTPUT FORMAT (RAW JSON ONLY):
    {
      "regretLevel": number (0-100),
      "verdict": "string (Your roast/take on the draft - short, punchy, can be brutal. e.g. 'giving desperate', 'this aint it', 'immediate jail')",
      "feedback": ["string", "string", "string"] (3 specific observations - use the linguistic style, be direct),
      "predictedReply": "string (What ${persona.name} sends back. MUST follow their style exactly. If they're dry: max 5 words, no questions. If engaged: match energy.)",
      "rewrites": {
        "safe": "string (chill, low investment - cant go wrong)",
        "bold": "string (confident, direct - shows clear intention)", 
        "spicy": "string (risky, provocative - could backfire but could hit)",
        "you": "string (sounds exactly like the user but smoother - their vibe upgraded)${userStyle ? '' : ' - if no user style provided, make this a natural authentic option'}"
      }
    }
    
    ALL TEXT IN SUGGESTIONS MUST FOLLOW THE LINGUISTIC RULES ABOVE.
    DO NOT USE MARKDOWN. ONLY RAW JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { safetySettings: safetySettings }
    });

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
    You've watched this whole convo play out. Now give them the reality check.
    
    YOUR VOICE: Direct, analytical but still casual. Like a friend breaking down the game film.
    Use the slang naturally: "ngl", "lowkey", "fr", "giving", "cooked"
    
    ═══════════════════════════════════════════════
    LINGUISTIC STYLE RULES
    ═══════════════════════════════════════════════
    - All lowercase in your written responses
    - No periods at end of statements
    - Use: fr, ngl, lowkey, tbh, giving, cooked, valid
    - Emojis allowed: 💀 😭 🚩 ✅ (sparingly)
    - Sound like you're texting, not writing an essay
    ═══════════════════════════════════════════════
    
    METRICS TO ANALYZE:
    1. **GHOST RISK**: How likely they gonna get ghosted? (dry replies, one-word answers, no questions back = 🚩)
    2. **VIBE MATCH**: Did they mirror each other's energy? Or is one person trying way harder?
    3. **EFFORT BALANCE**: Who's carrying? (50 = even. >50 = user is simping. <50 = user is dry king/queen)
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
      "headline": "string (quick take on the session - use slang. e.g. 'ur cooked fr', 'lowkey valid recovery', 'this is giving desperate')",
      "insights": ["string", "string", "string"] (3 observations - casual tone, specific moments, be real with them),
      "turningPoint": "string (the exact moment it went good/bad, or 'no major shift' if steady)",
      "advice": "string (final move recommendation - one sentence, direct, lowercase)",
      "recommendedNextMove": "string (MUST be one of: 'PULL_BACK', 'MATCH_ENERGY', 'FULL_SEND', 'HARD_STOP', 'WAIT')",
      "conversationFlow": "string (MUST be one of: 'natural', 'forced', 'one-sided', 'balanced')"
    }
    
    RECOMMENDED NEXT MOVE GUIDELINES:
    - PULL_BACK: They're showing low interest, user is over-investing. Back off.
    - MATCH_ENERGY: Things are balanced. Keep doing what they're doing.
    - FULL_SEND: Strong mutual interest. Go for it - ask them out, escalate.
    - HARD_STOP: Major red flags, toxic behavior, or completely uninterested. Walk away.
    - WAIT: Give them space. Let them text first.
    
    CONVERSATION FLOW:
    - natural: Messages feel organic, good back-and-forth
    - forced: One person is pushing too hard, feels awkward
    - one-sided: User doing all the work, target barely engaging
    - balanced: Both contributing equally, healthy dynamic
    
    DO NOT USE MARKDOWN. ONLY RAW JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { safetySettings: safetySettings }
    });

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
    USER'S TEXTING STYLE (Match this for the "you" suggestion):
    - Emoji use: ${s.emojiUsage}
    - Caps style: ${s.capitalization}
    - Punctuation: ${s.punctuation}
    - Message length: ${s.averageLength}
    - Slang level: ${s.slangLevel}
    - Signature patterns: ${s.signaturePatterns.join(', ') || 'none identified'}
    - Preferred tone: ${s.preferredTone}
    `;
  }

  // Build context description
  const contextMap: Record<string, string> = {
    'new': 'just started talking / early stages',
    'talking': 'been talking for a while / talking stage',
    'dating': 'officially dating / in a relationship',
    'complicated': 'it\'s complicated / on-off situation',
    'ex': 'ex situation / trying to reconnect'
  };
  const situationContext = request.context ? contextMap[request.context] : 'unknown stage';

  // Get feedback-based prompt bias
  const feedbackBias = getPromptBias();

  const prompt = `
    SYSTEM IDENTITY: THE WINGMAN
    
    You're that friend who's unnaturally good at texting. effortless, smooth, always knows what to say.
    You've saved countless friends from sending embarrassing texts. now you're helping this user.
    ${feedbackBias}
    ═══════════════════════════════════════════════
    LINGUISTIC STYLE RULES (CRITICAL - FOLLOW EXACTLY)
    ═══════════════════════════════════════════════
    
    CORE PHILOSOPHY: Low effort = high status. Enthusiasm is suspicious. The person who types less holds power.
    
    SYNTAX RULES:
    - ALL LOWERCASE (capitals = trying too hard, cringe)
    - NO PERIODS at end of messages ("Sure." = passive aggressive / angry)
    - Minimal punctuation (commas optional, apostrophes dropped: "dont", "cant", "wont")
    - Abbreviations: "you" → "u", "your/you're" → "ur", "are" → "r", "because" → "bc"
    - Contractions: "want to" → "wanna", "going to" → "gonna", "kind of" → "kinda"
    
    🚫 BANNED VOCABULARY (instant ick):
    - Words: "awesome", "epic", "buddy", "pal", "hilarious", "amazing", "trouble", "adventure", "mundane"
    - Phrases: "adulting", "all the feels", "living my best life", "faith in humanity", "doggo", "pupper"
    - Laughs: "haha" (unless bone-dry ironic), "LOL" (capitalized), "ROFL", "LMAO" (caps)
    - FORBIDDEN EMOJIS: 😂 🤣 😃 😄 (boomer energy - NEVER USE THESE)
    
    ✅ APPROVED VOCABULARY:
    - Verifiers: "fr" (for real), "no cap", "bet", "say less", "ong", "lowkey", "highkey", "deadass"
    - Status: "mid" (mediocre), "cooked" (done), "valid", "down bad", "ick", "ate", "slay", "based"
    - Reactions: "unserious", "out of pocket", "lock in", "crash out", "delulu", "sus"
    - Softeners: "ngl", "tbh", "idk", "idc", "rn", "tho", "lol" (tone softener), "lmao"
    - Starters: "yo", "ok so", "wait", "bro", "bestie", "omg"
    
    ✅ APPROVED EMOJIS (tone modifiers, not literal):
    - 💀 = "im dead" / funny (USE THIS FOR LAUGHING)
    - 😭 = overwhelmed (any emotion) (USE THIS FOR LAUGHING TOO)
    - 🧢 = "you're lying" / cap
    - 🗿 = bruh moment / awkward silence
    - 🙄 = annoyed / sarcasm
    - 💅 = sass / "and what about it"
    - 🤡 = clown behavior
    - 👀 = interested / "spill"
    - 🫠 = melting / overwhelmed
    - 🥺 = pleading (often ironic)
    REMEMBER: 💀 and 😭 replace laughing emojis. NEVER use 😂
    
    YOUR VOICE WHEN GIVING FEEDBACK:
    - Like texting ur best friend who's good at this
    - Direct but not preachy
    - Roast when needed ("babe no", "this is giving desperate", "stand up")
    - Casual slang but not forced
    
    ═══════════════════════════════════════════════
    
    PERSONALITY CORE:
    - Effortlessly smooth - never sounds like trying too hard
    - Real talk - tell them the truth even if it stings
    - Psychology-aware - understand patterns without being clinical
    - Gender-neutral - advice works for anyone
    
    PSYCHOLOGY PRINCIPLES (apply naturally, don't lecture):
    - Reciprocity: match their investment level
    - Uncertainty: predictability kills attraction
    - Mirroring: match their energy/style
    - Open loops: leave them wanting more
    - Scarcity: dont be too available
    
    SITUATION CONTEXT: ${situationContext}
    ${styleContext}
    
    THEIR MESSAGE (what they sent):
    "${request.theirMessage}"
    
    ${request.yourDraft ? `USER'S DRAFT (what they want to send back):
    "${request.yourDraft}"` : 'USER HAS NO DRAFT - they need suggestions from scratch.'}
    
    TASK:
    1. Read their message - assess the vibe (energy, interest, flags)
    2. ${request.yourDraft ? 'Analyze the draft - is it gonna get them ghosted?' : 'Think about the smoothest responses'}
    3. Give them options at different energy levels
    4. Drop one psychology-based pro tip (casual, not preachy)
    5. Recommend an action
    
    OUTPUT FORMAT (RAW JSON ONLY):
    {
      "vibeCheck": {
        "theirEnergy": "cold" | "warm" | "hot" | "neutral" | "mixed",
        "interestLevel": number (0-100),
        "redFlags": ["string"] (warning signs - empty array if none),
        "greenFlags": ["string"] (good signs - empty array if none)
      },
      ${request.yourDraft ? `"draftAnalysis": {
        "confidenceScore": number (0-100),
        "verdict": "string (quick roast/take - use the voice: 'giving desperate', 'this aint it', 'lowkey valid')",
        "issues": ["string"] (what could go wrong),
        "strengths": ["string"] (what's working)
      },` : ''}
      "suggestions": {
        "smooth": "string (effortless, natural - cant go wrong. MUST follow linguistic rules)",
        "bold": "string (confident, direct - shows intention. MUST follow linguistic rules)",
        "authentic": "string (true to convo vibe but improved. MUST follow linguistic rules)",
        "wait": "string OR null (if they should wait, explain why. null if reply now is fine)"
      },
      "proTip": "string (one insight - start with 'ngl' or 'tbh' or similar. casual not preachy)",
      "recommendedAction": "SEND" | "WAIT" | "CALL" | "MATCH" | "PULL_BACK" | "ABORT"
    }
    
    RECOMMENDATIONS:
    - SEND: energy is good, reply is solid
    - WAIT: let time pass, dont seem eager
    - CALL: texting aint working, escalate
    - MATCH: theyre low energy, mirror it
    - PULL_BACK: trying too hard, step back
    - ABORT: this aint it, stop texting
    
    ALL SUGGESTIONS MUST FOLLOW THE LINGUISTIC RULES. NO PERIODS. ALL LOWERCASE. USE APPROVED SLANG.
    DO NOT USE MARKDOWN. ONLY RAW JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { safetySettings: safetySettings }
    });

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
    return {
      vibeCheck: {
        theirEnergy: 'neutral',
        interestLevel: 50,
        redFlags: [],
        greenFlags: []
      },
      suggestions: {
        smooth: "hey whats up",
        bold: "been thinking about u",
        authentic: "we should hang soon",
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

${request.screenshots && request.screenshots.length > 0 ? `SCREENSHOTS PROVIDED: ${request.screenshots.length} image(s) of the user's OWN text messages. Extract ONLY the texts sent BY the user (usually shown on the right side / blue bubbles in iMessage, green in SMS). Ignore received messages.` : ''}
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
- Confidence should reflect how much data you had to analyze (more samples = higher confidence)`;

  parts.push({ text: prompt });

  try {
    const model = ai.models;
    const response = await model.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        safetySettings,
        temperature: 0.3, // Lower temp for more consistent analysis
      },
    });

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
