

export interface Persona {
  id: string;
  name: string;
  description: string;
  tone: string; // "Warm & Playful", "Reserved at First", "Direct & Honest"
  style: string; // "Lowercase casual", "Thoughtful paragraphs", "Quick bursts"
  habits: string; // "Takes time to respond thoughtfully", "Prefers voice notes"
  redFlags: string[]; // Actual concerning patterns, not minor things
  greenFlags?: string[]; // Positive signs noticed in their communication
  // Phase 2 fields
  relationshipContext?: 'NEW_MATCH' | 'TALKING_STAGE' | 'DATING' | 'SITUATIONSHIP' | 'EX' | 'FRIEND';
  harshnessLevel?: 1 | 2 | 3 | 4 | 5; // 1 = Gentle, 5 = Brutal
  communicationTips?: string[]; // How to build genuine connection with them
  conversationStarters?: string[]; // Natural, authentic openers
  thingsToAvoid?: string[]; // What would make them feel pressured
  theirLanguage?: string[]; // Words/phrases they use - helps speak their language
}

export interface SimResult {
  regretLevel: number; // 0-100 (0 = Safe, 100 = Suicide mission)
  verdict: string; // "ABSOLUTE FIRE" or "IMMEDIATE JAIL"
  feedback: string[]; // 3 bullet points
  predictedReply?: string; // What the target might say
  rewrites: {
    safe: string;
    bold: string;
    spicy: string;
    you?: string; // User's authentic style, upgraded
  };
}

export interface SimAnalysisResult {
  ghostRisk: number; // 0-100
  vibeMatch: number; // 0-100
  effortBalance: number; // 0-100 (50 = Equal, >50 User trying too hard)
  headline: string; // "Overall session ghost risk: 65%"
  insights: string[]; // 2-3 bullet points
  turningPoint: string; // "Things got weird after..."
  advice: string; // "Pull back" or "Go for it"
  // Phase 2 fields
  recommendedNextMove?: 'PULL_BACK' | 'MATCH_ENERGY' | 'FULL_SEND' | 'HARD_STOP' | 'WAIT';
  conversationFlow?: 'natural' | 'forced' | 'one-sided' | 'balanced';
}

export type AppState = 'landing' | 'loading' | 'results' | 'error';

// ============================================
// PHASE 1: Quick Advisor Types (MVP Wingman)
// ============================================

/**
 * User's style profile for personalized suggestions.
 * Built from onboarding or learned over time.
 */
export interface UserStyleProfile {
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy';
  capitalization: 'lowercase' | 'normal' | 'mixed';
  punctuation: 'none' | 'minimal' | 'full';
  averageLength: 'short' | 'medium' | 'long';
  slangLevel: 'formal' | 'casual' | 'heavy-slang';
  signaturePatterns: string[]; // ["haha", "lol", "..."]
  preferredTone: 'playful' | 'chill' | 'direct' | 'sweet';
  // Extended fields for richer personalization
  energy?: 'low' | 'medium' | 'high'; // Overall texting energy
  responseSpeed?: 'instant' | 'normal' | 'slow'; // How fast they typically reply
  flirtLevel?: 'none' | 'subtle' | 'moderate' | 'bold'; // Flirtatiousness
  humorStyle?: 'dry' | 'playful' | 'sarcastic' | 'wholesome'; // Humor type
  aiSummary?: string; // AI-generated personality summary
}

/**
 * Request for AI-powered style extraction from screenshots or text.
 */
export interface StyleExtractionRequest {
  screenshots?: string[]; // Base64 encoded images
  sampleTexts?: string[]; // Pasted text samples
}

/**
 * Raw AI-extracted style profile (intermediate format).
 * This is what the AI returns before we map it to UserStyleProfile.
 */
export interface AIExtractedStyleProfile {
  capitalization: 'always_lowercase' | 'sometimes_caps' | 'proper_grammar' | 'chaos_caps';
  punctuation: 'none' | 'minimal' | 'light' | 'standard';
  emojiFrequency: 'heavy' | 'moderate' | 'light' | 'none';
  favoriteEmojis: string[];
  commonPhrases: string[];
  messageLengthTendency: 'short' | 'medium' | 'long';
  energyLevel: 'hype' | 'chill' | 'chaotic' | 'dry';
  openerStyle: string;
  closerStyle: string;
}

/**
 * Response from AI style extraction.
 */
export interface StyleExtractionResponse {
  profile: AIExtractedStyleProfile;
  confidence: number; // 0-100 how confident the AI is
  extractedPatterns: string[]; // Detected patterns
  summary: string; // Brief personality summary
}

/**
 * Request for quick reply advice.
 * Fast lane - no persona setup needed.
 */
export interface QuickAdviceRequest {
  theirMessage: string; // What they sent
  yourDraft?: string; // Optional: what you're thinking of saying
  context?: 'new' | 'talking' | 'dating' | 'complicated' | 'ex';
  userStyle?: UserStyleProfile; // If available from onboarding
  screenshots?: string[]; // Optional: screenshots of the conversation
}

/**
 * Quick advice response with vibe check and suggestions.
 */
export interface QuickAdviceResponse {
  vibeCheck: {
    theirEnergy: 'cold' | 'warm' | 'hot' | 'neutral' | 'mixed';
    interestLevel: number; // 0-100
    redFlags: string[]; // e.g., "dry responses", "taking forever to reply"
    greenFlags: string[]; // e.g., "asking questions", "using your name"
  };
  // Extracted from screenshot OCR - the target's last message we're replying to
  extractedTargetMessage?: string;
  draftAnalysis?: {
    // Only if yourDraft provided
    confidenceScore: number; // 0-100 (positive framing)
    verdict: string;
    issues: string[];
    strengths: string[];
  };
  suggestions: {
    smooth: string | string[]; // Natural flow, effortless - can be single or array of 3
    bold: string | string[]; // Confident, direct - can be single or array of 3
    authentic: string | string[]; // True to convo vibe but improved - can be single or array of 3
    wait?: string | null; // Sometimes best move is no move - explains why
  };
  proTip: string; // One psychology-backed insight
  recommendedAction: 'SEND' | 'WAIT' | 'CALL' | 'MATCH' | 'PULL_BACK' | 'ABORT';
  // New guidance fields (0-100 scale and short timing text)
  interestSignal?: number; // 0-100 recommended explicit interest level to show
  timingRecommendation?: string; // e.g., "reply within a few hours; prioritize thoughtful reply over speed"
  // Detected metadata from screenshots (if provided)
  detectedMeta?: {
    platform?: 'instagram' | 'whatsapp' | 'unknown';
    deliveryStatus?: 'sent' | 'delivered' | 'read' | 'unknown';
    bubbleSide?: 'left' | 'right' | 'unknown';
    timestamp?: string | null; // raw timestamp string if extracted
    isMessageRequest?: boolean | null; // Instagram DM request or similar
    reactions?: string[]; // emoji reactions attached to the target's message
    quotedText?: string | null; // if a quoted/reply preview is present
    groupName?: string | null; // group chat name if detected
  };
}

// ============================================
// PHASE 2: Enhanced Types (Future)
// ============================================

/**
 * Enhanced persona with conversation tips.
 */
export interface PersonaV2 extends Persona {
  communicationTips: string[]; // How to vibe with them
  conversationStarters: string[]; // Natural openers
  thingsToAvoid: string[]; // What NOT to say
  attachmentStyle?: 'secure' | 'anxious' | 'avoidant' | 'fearful';
}

/**
 * Enhanced session analysis with psychology insights.
 */
export interface SimAnalysisResultV2 extends SimAnalysisResult {
  recommendedNextMove: 'PULL_BACK' | 'MATCH_ENERGY' | 'FULL_SEND' | 'HARD_STOP' | 'WAIT';
  conversationFlow: 'natural' | 'forced' | 'one-sided' | 'balanced';
  psychologyInsight: string; // One key behavioral observation
}

// ============================================
// PHASE 3: Feedback Loop & Wellbeing Types
// ============================================

/**
 * Single feedback entry for a suggestion.
 * Stored in localStorage, ready for Supabase migration.
 */
export interface FeedbackEntry {
  id: string; // UUID
  timestamp: number; // Unix timestamp
  source: 'quick' | 'practice'; // Which module
  suggestionType: 'smooth' | 'bold' | 'authentic' | 'safe' | 'spicy' | 'you';
  rating: 'helpful' | 'mid' | 'off'; // User's feedback
  context?: string; // Optional: relationship context
  // Metadata for learning
  theirEnergy?: 'cold' | 'warm' | 'hot' | 'neutral' | 'mixed';
  recommendedAction?: string;
}

/**
 * Aggregated feedback statistics for prompt biasing.
 * Calculated from FeedbackEntry array.
 */
export interface FeedbackStats {
  totalFeedback: number;
  // Per-type ratings
  smoothRatings: { helpful: number; mid: number; off: number };
  boldRatings: { helpful: number; mid: number; off: number };
  authenticRatings: { helpful: number; mid: number; off: number };
  safeRatings: { helpful: number; mid: number; off: number };
  spicyRatings: { helpful: number; mid: number; off: number };
  youRatings: { helpful: number; mid: number; off: number };
  // Derived insights
  prefersBold: boolean; // Bold suggestions rated helpful more than off
  prefersConservative: boolean; // Safe suggestions rated higher than spicy
  authenticWorks: boolean; // 'you' style suggestions working well
  // Last updated
  lastUpdated: number;
}

/**
 * Session tracking for wellbeing detection.
 * Tracks usage patterns to identify concerning behavior.
 */
export interface SessionLog {
  id: string;
  timestamp: number;
  module: 'quick' | 'practice';
  personaName?: string; // For detecting same-person obsession
  duration?: number; // Session duration in seconds
  ghostRisk?: number; // If available from analysis
  hourOfDay: number; // 0-23 for late-night detection
}

/**
 * Wellbeing check-in state.
 */
export interface WellbeingState {
  lastCheckIn?: number; // When we last showed a check-in
  dismissedUntil?: number; // User dismissed, don't show until this time
  triggered: boolean; // Should we show check-in
  reason?: 'late_night' | 'same_person' | 'high_frequency' | 'high_risk';
}