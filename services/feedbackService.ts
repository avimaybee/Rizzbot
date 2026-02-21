/**
 * FEEDBACK SERVICE
 * Phase 3: Outcome Feedback Loop
 * 
 * Handles storing and retrieving user feedback on suggestions.
 * Currently uses localStorage, designed for easy Supabase/Cloudflare migration.
 * 
 * MIGRATION NOTES (for Phase 4):
 * - Replace localStorage calls with Supabase client
 * - Add user ID parameter to all functions
 * - Implement proper error handling and retries
 * - Add sync logic for offline-first behavior
 */

import { FeedbackEntry, FeedbackStats, SessionLog, WellbeingState } from '../types';

// Storage keys
const FEEDBACK_KEY = 'therizzbot_feedback';
const SESSIONS_KEY = 'therizzbot_sessions';
const WELLBEING_KEY = 'therizzbot_wellbeing';

/**
 * Get user-specific storage key.
 * Throws if userId is empty or whitespace to prevent key collisions.
 */
const getUserKey = (baseKey: string, userId: string): string => {
  if (!userId || !userId.trim()) {
    throw new Error('userId must be a non-empty string for user-specific storage');
  }
  return `${baseKey}_${userId}`;
};

/**
 * Get stored data with fallback to legacy keys and migration.
 */
const getStoredData = (key: string, userId: string): string | null => {
  const userKey = getUserKey(key, userId);
  let stored = localStorage.getItem(userKey);

  if (!stored) {
    // Fallback to legacy key for backward compatibility
    stored = localStorage.getItem(key);
    if (stored) {
      // Migrate to user-specific key and remove legacy key to prevent
      // other users on the same device from re-importing the same data.
      localStorage.setItem(userKey, stored);
      localStorage.removeItem(key);
    }
  }
  return stored;
};

// ============================================
// FEEDBACK FUNCTIONS
// ============================================

/**
 * Generate a simple UUID for feedback entries.
 * Replace with proper UUID library or Supabase-generated IDs later.
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get all feedback entries from storage.
 */
export const getFeedbackEntries = (userId: string): FeedbackEntry[] => {
  try {
    const stored = getStoredData(FEEDBACK_KEY, userId);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load feedback:', error);
    return [];
  }
};

/**
 * Save a new feedback entry.
 */
export const saveFeedback = (userId: string, entry: Omit<FeedbackEntry, 'id' | 'timestamp'>): FeedbackEntry => {
  const newEntry: FeedbackEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  };

  try {
    const entries = getFeedbackEntries(userId);
    entries.push(newEntry);

    // Keep only last 100 entries to avoid storage bloat
    const trimmed = entries.slice(-100);
    localStorage.setItem(getUserKey(FEEDBACK_KEY, userId), JSON.stringify(trimmed));

    return newEntry;
  } catch (error) {
    console.error('Failed to save feedback:', error);
    return newEntry;
  }
};

/**
 * Calculate aggregate feedback statistics for prompt biasing.
 */
export const calculateFeedbackStats = (userId: string): FeedbackStats => {
  const entries = getFeedbackEntries(userId);

  const stats: FeedbackStats = {
    totalFeedback: entries.length,
    smoothRatings: { helpful: 0, mid: 0, off: 0 },
    boldRatings: { helpful: 0, mid: 0, off: 0 },
    authenticRatings: { helpful: 0, mid: 0, off: 0 },
    safeRatings: { helpful: 0, mid: 0, off: 0 },
    spicyRatings: { helpful: 0, mid: 0, off: 0 },
    youRatings: { helpful: 0, mid: 0, off: 0 },
    prefersBold: false,
    prefersConservative: false,
    authenticWorks: false,
    lastUpdated: Date.now(),
  };

  // Count ratings per type
  entries.forEach(entry => {
    const typeMap: Record<string, keyof FeedbackStats> = {
      smooth: 'smoothRatings',
      bold: 'boldRatings',
      authentic: 'authenticRatings',
      safe: 'safeRatings',
      spicy: 'spicyRatings',
      you: 'youRatings',
    };

    const ratingKey = typeMap[entry.suggestionType];
    if (ratingKey && typeof stats[ratingKey] === 'object') {
      (stats[ratingKey] as { helpful: number; mid: number; off: number })[entry.rating]++;
    }
  });

  // Calculate preferences (need at least 5 ratings to determine)
  const minSamples = 5;

  // Bold preference: bold helpful > bold off
  const boldTotal = stats.boldRatings.helpful + stats.boldRatings.mid + stats.boldRatings.off;
  if (boldTotal >= minSamples) {
    stats.prefersBold = stats.boldRatings.helpful > stats.boldRatings.off;
  }

  // Conservative preference: safe helpful > spicy helpful
  const safeTotal = stats.safeRatings.helpful + stats.safeRatings.mid + stats.safeRatings.off;
  const spicyTotal = stats.spicyRatings.helpful + stats.spicyRatings.mid + stats.spicyRatings.off;
  if (safeTotal >= minSamples && spicyTotal >= minSamples) {
    const safeHelpfulRate = stats.safeRatings.helpful / safeTotal;
    const spicyHelpfulRate = stats.spicyRatings.helpful / spicyTotal;
    stats.prefersConservative = safeHelpfulRate > spicyHelpfulRate;
  }

  // Authentic/you style working
  const youTotal = stats.youRatings.helpful + stats.youRatings.mid + stats.youRatings.off;
  if (youTotal >= minSamples) {
    stats.authenticWorks = stats.youRatings.helpful > (stats.youRatings.mid + stats.youRatings.off);
  }

  return stats;
};

/**
 * Generate prompt bias instructions based on feedback stats.
 * Used by getQuickAdvice() and simulateDraft().
 */
export const getPromptBias = (userId: string): string => {
  const stats = calculateFeedbackStats(userId);

  // Need minimum feedback to generate bias
  if (stats.totalFeedback < 10) {
    return '';
  }

  const biases: string[] = [];

  if (stats.prefersConservative) {
    biases.push('User prefers safer, more conservative suggestions. Lean towards "safe" and "smooth" options.');
  } else if (stats.prefersBold) {
    biases.push('User responds well to bold suggestions. Don\'t hold back on confident, direct options.');
  }

  if (stats.authenticWorks) {
    biases.push('The "you" style suggestions work well for this user. Prioritize authentic voice matching.');
  }

  // Check for specific issues
  const boldOffRate = stats.boldRatings.off / Math.max(1, stats.boldRatings.helpful + stats.boldRatings.mid + stats.boldRatings.off);
  if (boldOffRate > 0.5 && (stats.boldRatings.helpful + stats.boldRatings.mid + stats.boldRatings.off) >= 5) {
    biases.push('User often marks bold suggestions as "off" - calibrate bold options to be less aggressive.');
  }

  const spicyOffRate = stats.spicyRatings.off / Math.max(1, stats.spicyRatings.helpful + stats.spicyRatings.mid + stats.spicyRatings.off);
  if (spicyOffRate > 0.5 && (stats.spicyRatings.helpful + stats.spicyRatings.mid + stats.spicyRatings.off) >= 5) {
    biases.push('Spicy suggestions often miss the mark. Keep "spicy" playful but not too provocative.');
  }

  if (biases.length === 0) {
    return '';
  }

  return `
USER FEEDBACK CONTEXT (adjust suggestions accordingly):
${biases.map(b => `- ${b}`).join('\n')}
`;
};

// ============================================
// SESSION LOGGING (for wellbeing detection)
// ============================================

/**
 * Get all session logs.
 */
export const getSessionLogs = (userId: string): SessionLog[] => {
  try {
    const stored = getStoredData(SESSIONS_KEY, userId);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load sessions:', error);
    return [];
  }
};

/**
 * Log a new session.
 */
export const logSession = (
  userId: string,
  module: 'quick' | 'practice',
  personaName?: string,
  ghostRisk?: number
): SessionLog => {
  const session: SessionLog = {
    id: generateId(),
    timestamp: Date.now(),
    module,
    personaName,
    ghostRisk,
    hourOfDay: new Date().getHours(),
  };

  try {
    const sessions = getSessionLogs(userId);
    sessions.push(session);

    // Keep only last 50 sessions
    const trimmed = sessions.slice(-50);
    localStorage.setItem(getUserKey(SESSIONS_KEY, userId), JSON.stringify(trimmed));

    return session;
  } catch (error) {
    console.error('Failed to log session:', error);
    return session;
  }
};

// ============================================
// WELLBEING CHECK-IN LOGIC
// ============================================

/**
 * Get current wellbeing state.
 */
export const getWellbeingState = (userId: string): WellbeingState => {
  try {
    const stored = getStoredData(WELLBEING_KEY, userId);
    return stored ? JSON.parse(stored) : { triggered: false };
  } catch (error) {
    return { triggered: false };
  }
};

/**
 * Save wellbeing state.
 */
export const saveWellbeingState = (userId: string, state: WellbeingState): void => {
  try {
    localStorage.setItem(getUserKey(WELLBEING_KEY, userId), JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save wellbeing state:', error);
  }
};

/**
 * Check if wellbeing intervention should trigger.
 * Returns the reason if triggered, null otherwise.
 */
export const checkWellbeing = (userId: string): WellbeingState['reason'] | null => {
  const sessions = getSessionLogs(userId);
  const now = Date.now();
  const currentHour = new Date().getHours();

  // Check if dismissed recently (within 24 hours)
  const state = getWellbeingState(userId);
  if (state.dismissedUntil && state.dismissedUntil > now) {
    return null;
  }

  // Check if already triggered recently (within 2 hours)
  if (state.lastCheckIn && (now - state.lastCheckIn) < 2 * 60 * 60 * 1000) {
    return null;
  }

  // Get sessions from last 2 hours and last 24 hours
  const recentSessions = sessions.filter(s => (now - s.timestamp) < 2 * 60 * 60 * 1000);
  const last24h = sessions.filter(s => (now - s.timestamp) < 24 * 60 * 60 * 1000);

  // HEURISTIC 1: Late night usage (midnight to 4am) with high activity in last 24h
  if (currentHour >= 0 && currentHour < 4) {
    const lateNightSessions = last24h.filter(s => {
      const sessionTime = new Date(s.timestamp);
      return sessionTime.getHours() >= 0 && sessionTime.getHours() < 4;
    });
    // If they've had 3+ late night sessions recently
    if (lateNightSessions.length >= 3) {
      return 'late_night';
    }
  }

  // HEURISTIC 2: Same person obsession (5+ sessions about same persona in 24h)
  const personaCounts: Record<string, number> = {};
  last24h.forEach(s => {
    if (s.personaName) {
      personaCounts[s.personaName] = (personaCounts[s.personaName] || 0) + 1;
    }
  });
  const maxPersonaCount = Math.max(0, ...Object.values(personaCounts));
  if (maxPersonaCount >= 5) {
    return 'same_person';
  }

  // HEURISTIC 3: High frequency (8+ sessions in 2 hours)
  if (recentSessions.length >= 8) {
    return 'high_frequency';
  }

  // HEURISTIC 4: Consistently high ghost risk (avg > 70% over last 5 sessions)
  const sessionsWithRisk = sessions.filter(s => s.ghostRisk !== undefined).slice(-5);
  if (sessionsWithRisk.length >= 5) {
    const avgRisk = sessionsWithRisk.reduce((acc, s) => acc + (s.ghostRisk || 0), 0) / sessionsWithRisk.length;
    if (avgRisk > 70) {
      return 'high_risk';
    }
  }

  return null;
};

/**
 * Trigger wellbeing check-in state.
 */
export const triggerWellbeingCheckIn = (userId: string, reason: WellbeingState['reason']): void => {
  const state: WellbeingState = {
    lastCheckIn: Date.now(),
    triggered: true,
    reason,
  };
  saveWellbeingState(userId, state);
};

/**
 * Dismiss wellbeing check-in for specified duration.
 */
export const dismissWellbeingCheckIn = (userId: string, hours: number = 24): void => {
  const state: WellbeingState = {
    lastCheckIn: Date.now(),
    triggered: false,
    dismissedUntil: Date.now() + (hours * 60 * 60 * 1000),
    reason: undefined,
  };
  saveWellbeingState(userId, state);
};

/**
 * Clear wellbeing triggered state (after showing check-in).
 */
export const clearWellbeingTrigger = (userId: string): void => {
  const state = getWellbeingState(userId);
  state.triggered = false;
  saveWellbeingState(userId, state);
};

// ============================================
// MIGRATION HELPERS (for Phase 4 Supabase)
// ============================================

/**
 * Export all local data for migration.
 * Call this when setting up Supabase sync.
 */
export const exportLocalData = (userId: string) => {
  return {
    feedback: getFeedbackEntries(userId),
    sessions: getSessionLogs(userId),
    wellbeing: getWellbeingState(userId),
    exportedAt: Date.now(),
  };
};

/**
 * Clear all local data after successful migration.
 */
export const clearLocalData = (userId: string): void => {
  localStorage.removeItem(getUserKey(FEEDBACK_KEY, userId));
  localStorage.removeItem(getUserKey(SESSIONS_KEY, userId));
  localStorage.removeItem(getUserKey(WELLBEING_KEY, userId));
};
