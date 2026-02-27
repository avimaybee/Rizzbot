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

export type Module = 'standby' | 'simulator' | 'quick' | 'profile' | 'history' | 'therapist';

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
  favoriteEmojis?: string[]; // User's frequently used emojis extracted from samples
  rawSamples?: string[]; // User's MCQ text samples for persistence
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
  userId?: string; // Optional: user ID for feedback biasing
}

/**
 * Individual reply to a specific target message.
 */
export interface MessageReply {
  originalMessage: string; // The target's message this replies to
  reply: string;           // The suggested reply
}

/**
 * A complete suggestion option with replies to all unreplied messages + hook.
 */
export interface SuggestionOption {
  replies: MessageReply[];      // Replies to each unreplied message (in order)
  conversationHook: string;     // Text to keep the conversation flowing
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
  // All unreplied messages from target (in chronological order)
  extractedUnrepliedMessages?: string[];
  // Legacy: single extracted message (kept for backwards compat)
  extractedTargetMessage?: string;
  // Brief context summary of the conversation
  conversationContext?: string;
  draftAnalysis?: {
    // Only if yourDraft provided
    confidenceScore: number; // 0-100 (positive framing)
    verdict: string;
    issues: string[];
    strengths: string[];
  };
  suggestions: {
    smooth: SuggestionOption[];    // 3 options - natural, effortless
    bold: SuggestionOption[];      // 3 options - confident, direct
    witty: SuggestionOption[];     // 3 options - subtle wordplay, clever (not cringe)
    authentic: SuggestionOption[]; // 3 options - user's vibe, elevated (not forced copy)
    wait?: string | null;          // Sometimes best move is no move - explains why
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
 * Wellbeing check-in reason.
 */
export type WellbeingReason = 'late_night' | 'same_person' | 'high_frequency' | 'high_risk';

/**
 * Wellbeing check-in state.
 */
export interface WellbeingState {
  lastCheckIn?: number; // When we last showed a check-in
  dismissedUntil?: number; // User dismissed, don't show until this time
  triggered: boolean; // Should we show check-in
  reason: WellbeingReason | null;
}

// ============================================
// PHASE 4: Relationship Therapist Mode
// ============================================


export interface ClosureScript {
  tone: 'polite_distant' | 'firm_boundary' | 'warm_closure' | 'absolute_silence';
  script: string;
  explanation: string;
}

export interface SafetyIntervention {
  level: 'low' | 'medium' | 'high' | 'crisis';
  reason: string;
  resources: { name: string; contact?: string; url?: string }[];
  calmDownText: string;
}

export interface ParentalPatternV2 {
  parentTrait: string;
  partnerTrait: string;
  dynamicName: string; // e.g. "The Absent Father / Distant Boyfriend Cycle"
  insight: string;
}

export interface ValuesMatrix {
  userValues: string[];
  partnerValues: string[]; // Inferred
  alignmentScore: number; // 0-100
  conflicts: string[];
  synergies: string[];
}


/**
 * A single message in the therapist chat history.
 */
export interface TherapistMessage {
  role: 'user' | 'therapist';
  content: string;
  timestamp: number;
  images?: string[]; // Optional attached images (base64)
  // New Interactive Elements
  perspective?: PerspectiveInsight;
  pattern?: PatternInsight;
  projection?: ProjectionInsight;
  exercise?: TherapistExercise;
  suggestedPrompts?: string[]; // Tactical follow-up questions

  // Psychological Depth Elements
  closureScript?: ClosureScript;
  safetyIntervention?: SafetyIntervention;
  parentalPattern?: ParentalPatternV2;
  valuesMatrix?: ValuesMatrix;
}

/**
 * Clinical notes updated by the AI during the session.
 * These are editable by the user and fed back to the AI.
 */
export interface ClinicalNotes {
  attachmentStyle?: 'anxious' | 'avoidant' | 'secure' | 'fearful-avoidant' | 'unknown';
  keyThemes: string[]; // e.g., "Trust issues", "Communication breakdown", "Projection"
  emotionalState?: string; // e.g., "Anxious", "Defensive", "Hopeful"
  relationshipDynamic?: string; // e.g., "Pursuer-Distancer", "Codependent", "Healthy"
  userInsights: string[]; // Key realizations the user has had
  actionItems: string[]; // Suggested exercises or next steps
  customNotes?: string; // Free-form notes the user can edit
  epiphanies?: Epiphany[]; // Tracked realizations for high-level progress
}

/**
 * A major realization or "Aha!" moment logged by the AI.
 */
export interface Epiphany {
  id: string;
  content: string;
  category: 'self' | 'partner' | 'dynamic' | 'growth';
  timestamp: number;
}

/**
 * Specialized insights provided by the therapist tools.
 */
export interface PerspectiveInsight {
  partnerPerspective: string;
  suggestedMotive: string;
}

export interface PatternInsight {
  patternName: string; // e.g., "The Four Horsemen: Contempt"
  explanation: string;
  suggestion: string;
}

export interface ProjectionInsight {
  behavior: string;
  potentialRoot: string;
}

/**
 * Interactive exercises assigned by the therapist.
 */
export type ExerciseType = 'boundary_builder' | 'needs_assessment' | 'attachment_quiz';

export interface TherapistExercise {
  type: ExerciseType;
  context: string; // Why this exercise was assigned
  completed?: boolean;
  result?: any; // The result of the exercise (e.g., list of boundaries)
}

/**
 * Response from the therapist AI.
 */
export interface TherapistResponse {
  reply: string; // The therapist's chat message
  interactionId: string; // ID of the interaction for stateful continuity
  clinicalNotes?: Partial<ClinicalNotes>; // Updated clinical notes from this turn
  exercise?: TherapistExercise; // Optional interactive exercise assigned
}
