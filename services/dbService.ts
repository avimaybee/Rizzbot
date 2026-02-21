// Database Service Layer – client-side helpers for fetching/posting to D1 APIs

const API_BASE = typeof window === 'undefined' ? '' : '';
const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// Reduce console spam in development when DB is unavailable
const logDbError = (message: string, ...args: any[]) => {
  if (isDevelopment) {
    // Only log once per session using a flag
    const logKey = `db_error_${message.slice(0, 30)}`;
    if (!(window as any)[logKey]) {
      console.warn(`[DB] ${message} (local dev - DB features disabled)`, ...args);
      (window as any)[logKey] = true;
    }
  } else {
    console.error(`[DB] ${message}`, ...args);
  }
};

export interface User {
  id: number;
  firebase_uid?: string;
  anon_id?: string;  // Deprecated, keeping for backwards compat
  email?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  provider?: string | null;
  created_at: string;
  last_login_at?: string;
}

export interface UserData {
  email?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  provider?: string | null;
}

export interface Persona {
  id?: number;
  user_id: number;
  name: string;
  relationship_context?: string;
  harshness_level?: number;
  communication_tips?: string[] | string;
  conversation_starters?: string[] | string;
  things_to_avoid?: string[] | string;
  created_at?: string;
}

export interface StyleProfile {
  id?: number;
  user_id: number;
  emoji_usage?: string;
  capitalization?: string;
  punctuation?: string;
  average_length?: string;
  slang_level?: string;
  signature_patterns?: string[] | string;
  preferred_tone?: string;
  raw_samples?: any;
  ai_summary?: string;
  favorite_emojis?: string[] | string;
  created_at?: string;
}

export interface FeedbackEntry {
  id?: number;
  user_id: number;
  source: string;
  suggestion_type: string;
  rating: number;
  metadata?: any;
  created_at?: string;
}

export interface ParsedSessionResult {
  // Quick mode fields
  vibeCheck?: {
    theirEnergy?: string;
    interestLevel?: number;
    redFlags?: string[];
    greenFlags?: string[];
  };
  suggestions?: {
    smooth?: string | string[];
    bold?: string | string[];
    authentic?: string | string[];
    witty?: unknown[];
    wait?: string | null;
  };
  screenshots?: string[];
  request?: {
    screenshots?: string[];
    theirMessage?: string;
  };
  response?: {
    vibeCheck?: ParsedSessionResult['vibeCheck'];
    suggestions?: ParsedSessionResult['suggestions'];
  };
  // Simulator mode fields
  history?: Array<{ role?: string; content?: string; [key: string]: unknown }>;
  analysis?: {
    ghostRisk?: number;
    vibeMatch?: number;
    effortBalance?: number;
    headline?: string;
    insights?: string[];
  };
  headline?: string;
  ghostRisk?: number;
}

export interface Session {
  id: number;
  user_id?: number;
  firebase_uid?: string;
  anon_id?: string;
  result: string;
  mode?: 'simulator' | 'quick';
  persona_name?: string;
  headline?: string;
  ghost_risk?: number;
  message_count?: number;
  created_at: string;
  parsedResult?: ParsedSessionResult;
}

export interface SessionsResponse {
  sessions: Session[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ===== Users API =====

/**
 * Fetch or create user by Firebase UID (or legacy anon_id)
 * Now accepts optional user data for storing email, display name, etc.
 */
export async function getOrCreateUser(firebaseUid: string, userData?: UserData): Promise<User> {
  const res = await fetch(`/api/users?firebase_uid=${encodeURIComponent(firebaseUid)}`);

  // Check content type before parsing JSON
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    logDbError('getOrCreateUser: Expected JSON but got: ' + contentType);
    throw new Error('API returned non-JSON response. Backend may not be deployed correctly.');
  }

  if (res.ok) {
    const data = await res.json();
    // User exists, update their data if provided
    if (userData && data.user) {
      // Fire off update in background (don't block)
      updateUserData(data.user.id, userData).catch(console.error);
    }
    return data.user;
  }

  // User doesn't exist, create them
  return createUser(firebaseUid, userData);
}

/**
 * Create user with Firebase UID and optional user data
 */
export async function createUser(firebaseUid: string, userData?: UserData): Promise<User> {
  const res = await fetch(`/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firebase_uid: firebaseUid,
      anon_id: firebaseUid, // For backwards compat with existing schema
      ...userData,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create user: ${res.statusText}`);
  const data = await res.json();
  return data.user;
}

/**
 * Update user profile data
 */
export async function updateUserData(userId: number, userData: UserData): Promise<void> {
  const res = await fetch(`/api/users`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: userId, ...userData }),
  });
  if (!res.ok) {
    console.error(`Failed to update user data: ${res.statusText}`);
  }
}

// ===== Personas API =====

/**
 * Get personas for a user
 */
export async function getPersonas(userId: number): Promise<Persona[]> {
  const res = await fetch(`/api/personas?user_id=${userId}`);
  if (!res.ok) throw new Error(`Failed to get personas: ${res.statusText}`);
  return res.json();
}

/**
 * Get single persona by ID
 */
export async function getPersona(personaId: number): Promise<Persona | null> {
  const res = await fetch(`/api/personas?persona_id=${personaId}`);
  if (!res.ok) throw new Error(`Failed to get persona: ${res.statusText}`);
  return res.json();
}

/**
 * Create persona
 */
export async function createPersona(persona: Persona): Promise<{ id: number }> {
  const res = await fetch(`/api/personas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(persona),
  });
  if (!res.ok) throw new Error(`Failed to create persona: ${res.statusText}`);
  return res.json();
}

/**
 * Update persona
 */
export async function updatePersona(id: number, updates: Partial<Persona>): Promise<{ success: boolean }> {
  const res = await fetch(`/api/personas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  });
  if (!res.ok) throw new Error(`Failed to update persona: ${res.statusText}`);
  return res.json();
}

/**
 * Delete persona
 */
export async function deletePersona(id: number): Promise<{ success: boolean }> {
  const res = await fetch(`/api/personas?id=${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete persona: ${res.statusText}`);
  return res.json();
}

// ===== Style Profiles API =====

/**
 * Get user's style profile (most recent)
 */
export async function getStyleProfile(userId: number): Promise<StyleProfile | null> {
  const res = await fetch(`/api/style_profiles?user_id=${userId}`);
  if (!res.ok) throw new Error(`Failed to get style profile: ${res.statusText}`);
  return res.json();
}

/**
 * Save style profile
 */
export async function saveStyleProfile(profile: StyleProfile): Promise<{ id: number }> {
  const res = await fetch(`/api/style_profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error(`Failed to save style profile: ${res.statusText}`);
  return res.json();
}

// ===== Feedback API =====

/**
 * Get feedback stats for user (aggregated by suggestion type)
 */
export async function getFeedback(userId: number): Promise<any[]> {
  const res = await fetch(`/api/feedback?user_id=${userId}`);
  if (!res.ok) throw new Error(`Failed to get feedback: ${res.statusText}`);
  return res.json();
}

/**
 * Submit feedback entry
 */
export async function submitFeedback(feedback: FeedbackEntry): Promise<{ id: number }> {
  const res = await fetch(`/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback),
  });
  if (!res.ok) throw new Error(`Failed to submit feedback: ${res.statusText}`);
  return res.json();
}

// ===== Sessions API =====

/**
 * Get user's sessions with pagination
 */
export async function getSessions(firebaseUid?: string, limit = 20, offset = 0): Promise<SessionsResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (firebaseUid) params.set('anon_id', firebaseUid);

  const res = await fetch(`/api/sessions?${params}`);

  // Handle 404 (no sessions found - this is normal for new users)
  if (res.status === 404) {
    return {
      sessions: [],
      pagination: { total: 0, limit, offset, hasMore: false }
    };
  }

  // Check content type before parsing JSON
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    logDbError('getSessions: Expected JSON but got: ' + contentType);
    // Return empty sessions instead of crashing - likely API not deployed or route issue
    return {
      sessions: [],
      pagination: { total: 0, limit, offset, hasMore: false }
    };
  }

  if (!res.ok) {
    throw new Error(`Failed to get sessions: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.sessions) {
    data.sessions = data.sessions.map((s: any) => {
      let parsedResult: ParsedSessionResult = {};
      try {
        parsedResult = typeof s.result === 'string' ? JSON.parse(s.result) : s.result ?? {};
      } catch (e) {
        logDbError('Failed to parse session result', e);
      }
      return { ...s, parsedResult };
    });
  }

  return data;
}

/**
 * Create session (stores simulation result or quick advice)
 * Uses Firebase UID for user identification
 */
export async function createSession(
  firebaseUid: string,
  result: any,
  options?: {
    mode?: 'simulator' | 'quick';
    persona_name?: string;
    headline?: string;
    ghost_risk?: number;
    message_count?: number;
  }
): Promise<{ lastInsertId: number }> {
  const res = await fetch(`/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_anon_id: firebaseUid,
      result,
      ...options,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.statusText}`);
  return res.json();
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: number): Promise<{ success: boolean }> {
  const res = await fetch(`/api/sessions?id=${sessionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete session: ${res.statusText}`);
  return res.json();
}

// ===== Therapist Sessions API =====

export interface TherapistSession {
  id?: number;
  interaction_id: string;
  messages: any[];
  clinical_notes: any; // ClinicalNotes type
  created_at?: string;
  updated_at?: string;
}

/**
 * Save or update a therapist session
 */
export async function saveTherapistSession(
  firebaseUid: string,
  interactionId: string,
  messages: any[],
  clinicalNotes: any
): Promise<{ success: boolean; id?: number }> {
  const res = await fetch('/api/therapist_sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_anon_id: firebaseUid,
      interaction_id: interactionId,
      messages,
      clinical_notes: clinicalNotes
    })
  });
  if (!res.ok) throw new Error(`Failed to save therapist session: ${res.statusText}`);
  return res.json();
}

/**
 * Get a specific therapist session by interaction ID
 */
export async function getTherapistSession(interactionId: string): Promise<TherapistSession | null> {
  const res = await fetch(`/api/therapist_sessions?interaction_id=${interactionId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to get therapist session: ${res.statusText}`);
  }
  const data = await res.json();
  if (!data) return null;

  // Parse JSON fields
  return {
    ...data,
    messages: typeof data.messages === 'string' ? JSON.parse(data.messages) : data.messages,
    clinical_notes: typeof data.clinical_notes === 'string' ? JSON.parse(data.clinical_notes) : data.clinical_notes
  };
}

/**
 * Get all therapist sessions for a user
 */
export async function getTherapistSessions(firebaseUid: string): Promise<TherapistSession[]> {
  const res = await fetch(`/api/therapist_sessions?anon_id=${firebaseUid}`);
  if (!res.ok) throw new Error(`Failed to get therapist sessions: ${res.statusText}`);
  const data = await res.json();

  return (data.sessions || []).map((s: any) => ({
    ...s,
    messages: typeof s.messages === 'string' ? JSON.parse(s.messages) : s.messages,
    clinical_notes: typeof s.clinical_notes === 'string' ? JSON.parse(s.clinical_notes) : s.clinical_notes
  }));
}

// ===== Therapist Memories API =====

export interface TherapistMemory {
  id?: number;
  user_id?: string;
  session_id?: string | null;
  type: 'GLOBAL' | 'SESSION';
  content: string;
  created_at?: string;
}

export async function getMemories(firebaseUid: string, type?: 'GLOBAL' | 'SESSION', sessionId?: string): Promise<TherapistMemory[]> {
  const params = new URLSearchParams({ anon_id: firebaseUid });
  if (type) params.set('type', type);
  if (sessionId) params.set('session_id', sessionId);

  const res = await fetch(`/api/memories?${params}`);
  if (!res.ok) throw new Error(`Failed to get memories: ${res.statusText}`);
  const data = await res.json();
  return data.memories || [];
}

export async function saveMemory(firebaseUid: string, type: 'GLOBAL' | 'SESSION', content: string, sessionId?: string): Promise<{ success: boolean; id?: number }> {
  const res = await fetch('/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_anon_id: firebaseUid,
      type,
      content,
      session_id: sessionId
    })
  });
  if (!res.ok) throw new Error(`Failed to save memory: ${res.statusText}`);
  return res.json();
}

export async function deleteMemory(id: number): Promise<{ success: boolean }> {
  const res = await fetch(`/api/memories?id=${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete memory: ${res.statusText}`);
  return res.json();
}

export async function updateMemory(id: number, content: string, type: 'GLOBAL' | 'SESSION'): Promise<{ success: boolean }> {
  const res = await fetch(`/api/memories`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, content, type })
  });
  if (!res.ok) throw new Error(`Failed to update memory: ${res.statusText}`);
  return res.json();
}

