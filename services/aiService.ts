import { SimResult, Persona, SimAnalysisResult, UserStyleProfile, ClinicalNotes, TherapistResponse } from "../types";
import { getAuthHeaders } from "./authHeaders";
import { logger } from "./logger";

export { getQuickAdvice } from "./quickAdviceService";
export type { QuickImageAttachment, QuickModelStatus } from "./quickAdviceService";

function cleanJson(text: string): any {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a !== -1 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error("Invalid JSON from AI");
  }
}

async function opencodeGenerate(args: {
  systemInstruction: string;
  prompt: string;
  images?: Array<{ mimeType: string; data: string }>;
  effort?: "medium" | "low" | "high";
}): Promise<{ text: string; model: string }> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch("/api/opencode/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      task: "persona",
      systemInstruction: args.systemInstruction,
      prompt: args.prompt,
      images: args.images ?? [],
      effort: args.effort ?? "medium",
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`opencode/generate ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

// ---------- Practice: Persona ----------

export const generatePersona = async (
  description: string,
  screenshotsBase64: string[],
  relationshipContext?: 'NEW_MATCH' | 'TALKING_STAGE' | 'DATING' | 'SITUATIONSHIP' | 'EX' | 'FRIEND',
  harshnessLevel?: 1 | 2 | 3 | 4 | 5
): Promise<Persona> => {
  const images = (screenshotsBase64 || []).map((base64) => {
    const m = base64.match(/^data:([^;]+);base64,/);
    return { mimeType: m ? m[1] : "image/png", data: base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "") };
  });
  const prompt = `Create a psychological profile of the Target. USER DESCRIPTION: "${description}" RELATIONSHIP: ${relationshipContext || "TALKING_STAGE"} HARSHNESS: ${harshnessLevel || 3}. Messages on RIGHT are user (ignore), LEFT are target (truth). OUTPUT RAW JSON: {"name":string,"tone":string,"mood":string,"familiarity":number,"style":string,"habits":string,"redFlags":[string,string],"greenFlags":[string,string],"relationshipContext":"${relationshipContext || "TALKING_STAGE"}","harshnessLevel":${harshnessLevel || 3},"communicationTips":[string,string,string],"conversationStarters":[string,string],"thingsToAvoid":[string,string],"theirLanguage":[string,string]} DO NOT USE MARKDOWN. ONLY RAW JSON.`;
  try {
    const { text } = await opencodeGenerate({
      systemInstruction: "You are PERSONA ARCHITECT V2 - CONNECTION ANALYST. Output only raw JSON.",
      prompt,
      images,
      effort: "medium",
    });
    if (!text) throw new Error("No data");
    const data = cleanJson(text);
    return { ...data, id: Date.now().toString(), description };
  } catch (e) {
    logger.error("Persona Gen Failed", e);
    return { id: Date.now().toString(), name: "The Mystery", description, tone: "Unknown", style: "Standard", habits: "Unpredictable", redFlags: ["Analysis Failed"] };
  }
};

// ---------- Practice: Simulate ----------

export const simulateDraft = async (
  userId: string | undefined,
  draft: string,
  persona: Persona,
  userStyle?: UserStyleProfile | null,
  conversationHistory?: { draft: string; result: SimResult }[],
  images?: string[],
  options?: { goal?: string; sessionMemory?: string; escalationPhase?: 'warmup' | 'probe' | 'deep' | 'close' }
): Promise<SimResult> => {
  const goal = options?.goal?.trim() || "";
  const escalationPhase = options?.escalationPhase || (conversationHistory?.length ? "probe" : "warmup");
  let conversationContext = "";
  if (conversationHistory && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-12);
    conversationContext = recent.map((turn, idx) => `Turn ${idx + 1}:\n  User: "${turn.draft}"\n  ${persona.name}: "${turn.result.predictedReply}"`).join("\n\n");
  }
  const actorPrompt = `YOU ARE ${persona.name}, a real person texting. Tone: ${persona.tone}. Mood: ${persona.mood || "Neutral"}. Familiarity: ${persona.familiarity || 20}/100. Style: ${persona.style}. Habits: ${persona.habits}. Stage: ${persona.relationshipContext || "TALKING_STAGE"}. Phase: ${escalationPhase}. ${goal ? `Their goal: "${goal}" (respond naturally, don't name it).` : ""} ${conversationContext ? `History:\n${conversationContext}\n` : ""} The other person just said: "${draft}" Reply as ${persona.name} — short, in character, no narration.`;
  const imgs = (images || []).map((b) => {
    const m = b.match(/^data:([^;]+);base64,/);
    return { mimeType: m ? m[1] : "image/png", data: b.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "") };
  });
  try {
    const { text } = await opencodeGenerate({
      systemInstruction: `You are ${persona.name}. Reply exactly as they would. Never break character.`,
      prompt: actorPrompt,
      images: imgs,
      effort: "medium",
    });
    let actorReply = (text || "").trim();
    if (!actorReply) throw new Error("Connection Lost");
    // Heuristic state (same as legacy)
    const replyLower = actorReply.toLowerCase();
    const wordCount = actorReply.split(/\s+/).filter(Boolean).length;
    const hasQuestion = /[?？]/.test(actorReply);
    const warmSignals = ["haha", "lol", "lmao", "😂", "💀", "😭", "🥹", "✨", "🤭", "🫶", "!!", "!!!"].filter((s) => replyLower.includes(s)).length;
    const coldSignals = ["k", "ok", "yeah", "mhm", "cool", "nice", "sure", "ig", "👍", "🙂", "..."].filter((s) => replyLower.startsWith(s) || replyLower.includes(s)).length;
    let familiarityDelta = 0;
    if (hasQuestion && wordCount >= 4) familiarityDelta += 2;
    else if (wordCount >= 8) familiarityDelta += 1;
    if (warmSignals >= 2) familiarityDelta += 1;
    if (coldSignals >= 2 || wordCount <= 2) familiarityDelta -= 1;
    familiarityDelta = Math.max(-3, Math.min(3, familiarityDelta));
    let updatedMood = persona.mood || "Neutral";
    if (warmSignals >= 2) updatedMood = "Playful";
    else if (hasQuestion) updatedMood = "Curious";
    else if (coldSignals >= 2 || wordCount <= 2) updatedMood = "Guarded";
    return { regretLevel: 0, verdict: "", feedback: [], predictedReply: actorReply, rewrites: { safe: actorReply, bold: actorReply, spicy: actorReply, you: actorReply }, updatedMood, updatedFamiliarity: familiarityDelta };
  } catch (error) {
    logger.error("Sim Failed:", error);
    return { regretLevel: 50, verdict: "SYSTEM ERROR", feedback: ["AI Overheated.", "Try again."], predictedReply: "...", rewrites: { safe: "damn", bold: "bruh", spicy: "no way 💀", you: "hmm interesting" } };
  }
};

export const analyzeSimulation = async (
  history: { draft: string; result: SimResult }[],
  persona: Persona,
  userStyle?: UserStyleProfile | null,
  goal?: string
): Promise<SimAnalysisResult> => {
  const transcript = history.map((h, i) => `Turn ${i + 1}:\nUser: "${h.draft}"\nTarget (${persona.name}): "${h.result.predictedReply}"`).join("\n\n");
  const prompt = `Analyze this practice conversation. Transcript:\n${transcript}\n${goal ? `User goal: ${goal}\n` : ""}OUTPUT RAW JSON: {"ghostRisk":number,"vibeMatch":number,"effortBalance":number,"headline":string,"insights":[string,string,string],"turningPoint":string,"advice":string,"recommendedNextMove":"PULL_BACK"|"MATCH_ENERGY"|"FULL_SEND"|"HARD_STOP"|"WAIT","conversationFlow":"natural"|"forced"|"one-sided"|"balanced"} ONLY JSON.`;
  try {
    const { text } = await opencodeGenerate({
      systemInstruction: "You are THE UNSENT SENTINEL - SESSION ANALYST. Warm, honest, slang-aware. Output only raw JSON.",
      prompt,
      effort: "medium",
    });
    return cleanJson(text) as SimAnalysisResult;
  } catch {
    return { ghostRisk: 50, vibeMatch: 50, effortBalance: 50, headline: "Session needs review", insights: ["Keep energy matched", "Ask open questions"], turningPoint: "Unknown", advice: "Match their energy" };
  }
};

// ---------- Style extraction ----------

export const extractUserStyle = async (request: { screenshots?: string[]; sampleTexts?: string[] }): Promise<any> => {
  const images = (request.screenshots || []).map((b) => {
    const m = b.match(/^data:([^;]+);base64,/);
    return { mimeType: m ? m[1] : "image/png", data: b.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "") };
  });
  const prompt = `Analyze the USER's own messages (RIGHT-side bubbles, or provided samples) for texting style. Samples: ${(request.sampleTexts || []).slice(0, 10).join(" | ")}. OUTPUT RAW JSON: {"profile":{"capitalization":"always_lowercase","punctuation":"minimal","emojiFrequency":"light","favoriteEmojis":[],"commonPhrases":[],"messageLengthTendency":"short","energyLevel":"chill","openerStyle":"","closerStyle":""},"confidence":70,"extractedPatterns":[],"summary":"GenZ summary"}. ONLY JSON.`;
  try {
    const { text } = await opencodeGenerate({
      systemInstruction: "You analyze texting style from the user's own messages. Output only raw JSON.",
      prompt,
      images,
      effort: "low",
    });
    return cleanJson(text);
  } catch {
    return { profile: { capitalization: "always_lowercase", punctuation: "minimal", emojiFrequency: "light", favoriteEmojis: [], commonPhrases: [], messageLengthTendency: "short", energyLevel: "chill", openerStyle: "", closerStyle: "" }, confidence: 0, extractedPatterns: [], summary: "neutral texter" };
  }
};

export const generateSessionClosure = async (messages: any[], clinicalNotes?: ClinicalNotes): Promise<any> => {
  const transcript = messages.slice(-40).map((m: any) => `${m.role}: ${String(m.content || "").slice(0, 600)}`).join("\n");
  const prompt = `Summarize this therapy session. Transcript:\n${transcript}\nNotes: ${JSON.stringify(clinicalNotes || {})}\nOUTPUT RAW JSON: {"summary":"2-3 sentences","insight":"one key insight, no cliches","workedOn":[string],"nextStep":"string"} ONLY JSON.`;
  try {
    const { text } = await opencodeGenerate({
      systemInstruction: "You write concise therapy session closures. Output only raw JSON.",
      prompt,
      effort: "low",
    });
    return cleanJson(text);
  } catch {
    return { summary: "You showed up and did honest work.", insight: "Small patterns compound.", workedOn: ["honesty"], nextStep: "Notice one pattern this week." };
  }
};

// ---------- Therapist streaming ----------

export interface TherapistStreamCallbacks {
  onChunk: (text: string) => void;
  onNotesUpdate: (notes: Partial<ClinicalNotes>) => void;
  onExerciseAssign?: (exercise: { type: string; context: string }) => void;
  onToolCall?: (toolName: string, args: any) => void;
}

export interface TherapistMessagePart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

const THERAPIST_SI = `You are a Relationship Therapist AI. Warm but honest, unbiased, Socratic. Use lowercase intimate style, Markdown only (no HTML). After every response you MUST call update_session_analysis with keyThemes + emotionalState. Assign exercises sparingly (boundary_builder, needs_assessment, attachment_quiz). Use save_memory for significant new facts. Be concise, curious, non-preachy.`;

const THERAPIST_TOOLS = [
  { type: "function", function: { name: "update_session_analysis", description: "Update clinical notes. Call after every response.", parameters: { type: "object", properties: { attachmentStyle: { type: "string" }, keyThemes: { type: "array", items: { type: "string" } }, emotionalState: { type: "string" }, relationshipDynamic: { type: "string" }, userInsights: { type: "array", items: { type: "string" } }, actionItems: { type: "array", items: { type: "string" } }, customNotes: { type: "string" } }, required: ["keyThemes", "emotionalState"] } } },
  { type: "function", function: { name: "assign_exercise", description: "Assign boundary_builder, needs_assessment, or attachment_quiz.", parameters: { type: "object", properties: { type: { type: "string" }, context: { type: "string" } }, required: ["type", "context"] } } },
  { type: "function", function: { name: "log_epiphany", description: "Log a breakthrough.", parameters: { type: "object", properties: { content: { type: "string" }, category: { type: "string" } }, required: ["content", "category"] } } },
  { type: "function", function: { name: "show_perspective_bridge", description: "Reconstruct partner perspective.", parameters: { type: "object", properties: { partnerPerspective: { type: "string" }, suggestedMotive: { type: "string" } } } } },
  { type: "function", function: { name: "show_communication_insight", description: "Gottman-style insight.", parameters: { type: "object", properties: { patternName: { type: "string" }, explanation: { type: "string" }, suggestion: { type: "string" } } } } },
  { type: "function", function: { name: "flag_projection", description: "Flag potential projection.", parameters: { type: "object", properties: { behavior: { type: "string" }, potentialRoot: { type: "string" } } } } },
  { type: "function", function: { name: "generate_closure_script", description: "Closure script.", parameters: { type: "object", properties: { tone: { type: "string" }, script: { type: "string" }, explanation: { type: "string" } } } } },
  { type: "function", function: { name: "trigger_safety_intervention", description: "Safety resources for risk.", parameters: { type: "object", properties: { level: { type: "string" }, reason: { type: "string" }, calmDownText: { type: "string" } } } } },
  { type: "function", function: { name: "log_parental_pattern", description: "Generational pattern.", parameters: { type: "object", properties: { parentTrait: { type: "string" }, partnerTrait: { type: "string" }, insight: { type: "string" } } } } },
  { type: "function", function: { name: "assign_values_matrix", description: "Values matrix.", parameters: { type: "object", properties: { userValues: { type: "array", items: { type: "string" } }, partnerValues: { type: "array", items: { type: "string" } } } } } },
  { type: "function", function: { name: "save_memory", description: "Save GLOBAL or SESSION memory.", parameters: { type: "object", properties: { type: { type: "string" }, content: { type: "string" } }, required: ["type", "content"] } } },
];

export const streamTherapistAdvice = async (
  userMessage: string,
  history: { role: "user" | "model"; parts: TherapistMessagePart[] }[],
  _previousInteractionId: string | undefined,
  images: string[] | undefined,
  currentNotes: ClinicalNotes | undefined,
  onChunk: (text: string) => void,
  onNotesUpdate: (notes: Partial<ClinicalNotes>) => void,
  onExerciseAssign?: (exercise: { type: string; context: string }) => void,
  onToolCall?: (toolName: string, args: any) => void,
  memories?: { type: 'GLOBAL' | 'SESSION'; content: string; created_at?: string }[],
  pastSessions?: { created_at?: string; clinical_notes?: any; messages?: any[]; summary?: string }[]
): Promise<string> => {
  const parts: TherapistMessagePart[] = [];
  if (pastSessions && pastSessions.length > 0) {
    const pastBlock = pastSessions.slice(0, 5).map((s, i) => {
      const notes = s.clinical_notes || {};
      return `Session ${i + 1}: themes=${Array.isArray(notes.keyThemes) ? notes.keyThemes.join(", ") : "n/a"} state=${notes.emotionalState || "n/a"} summary=${s.summary || ""}`;
    }).join("\n");
    parts.push({ text: `[PREVIOUS SESSIONS]\n${pastBlock}` });
  }
  if (memories && memories.length > 0) {
    parts.push({ text: `[MEMORIES]\n${memories.map((m) => `- [${m.type}] ${m.content}`).join("\n")}` });
  }
  if (currentNotes && (currentNotes.keyThemes?.length || currentNotes.customNotes || currentNotes.emotionalState)) {
    parts.push({ text: `[CLINICAL NOTES] attachment=${currentNotes.attachmentStyle || "unknown"} themes=${currentNotes.keyThemes?.join(", ") || "none"} state=${currentNotes.emotionalState || "n/a"}` });
  }
  if (images && images.length > 0) {
    for (const b of images) {
      const m = b.match(/^data:([^;]+);base64,/);
      parts.push({ inlineData: { mimeType: m ? m[1] : "image/png", data: b.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "") } });
    }
  }
  parts.push({ text: userMessage });

  const contents = [...history, { role: "user" as const, parts }];

  const authHeaders = await getAuthHeaders();
  const res = await fetch("/api/opencode/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ contents, systemInstruction: THERAPIST_SI, tools: THERAPIST_TOOLS }),
  });
  if (!res.ok || !res.body) throw new Error(`opencode/stream ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  const handleCalls = (calls: Array<{ name: string; args: any }>) => {
    for (const fc of calls) {
      if (fc.name === "update_session_analysis") onNotesUpdate(fc.args);
      else if (fc.name === "assign_exercise" && onExerciseAssign) onExerciseAssign(fc.args);
      else if (onToolCall) onToolCall(fc.name, fc.args);
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let chunk: any;
      try { chunk = JSON.parse(line); } catch { continue; }
      if (chunk.type === "text") {
        fullText += chunk.content;
        onChunk(chunk.content);
      } else if (chunk.type === "functionCalls") {
        handleCalls(chunk.calls || []);
      } else if (chunk.type === "error") {
        throw new Error(chunk.message || "Stream error");
      }
    }
  }
  if (buffer.trim()) {
    try {
      const chunk = JSON.parse(buffer);
      if (chunk.type === "text") {
        fullText += chunk.content;
        onChunk(chunk.content);
      } else if (chunk.type === "functionCalls") handleCalls(chunk.calls || []);
    } catch { /* ignore */ }
  }
  void fullText;
  const newId = `session_${Date.now()}`;
  return newId;
};

export const __therapistTools = THERAPIST_TOOLS;
export const __therapistSystemInstruction = THERAPIST_SI;

export type { ClinicalNotes, TherapistResponse };

/** Legacy Quick stream spike (Plan 009) — disabled. Use getQuickAdvice. */
export const streamQuickAdvice = async (..._args: any[]): Promise<never> => {
  throw new Error("streamQuickAdvice is disabled");
};

