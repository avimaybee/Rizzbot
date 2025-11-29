// Database Service Layer – client-side helpers for fetching/posting to D1 APIs

const API_BASE = typeof window === 'undefined' ? '' : '';

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

export interface Session {
  id: number;
  user_id?: number;
  firebase_uid?: string;
  anon_id?: string;
  result: string;
  created_at: string;
}

// ===== Users API =====

/**
 * Fetch or create user by Firebase UID (or legacy anon_id)
 * Now accepts optional user data for storing email, display name, etc.
 */
export async function getOrCreateUser(firebaseUid: string, userData?: UserData): Promise<User> {
  const res = await fetch(`/api/users?firebase_uid=${encodeURIComponent(firebaseUid)}`);
  
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
 * Get user's sessions (or all if no user_id)
 */
export async function getSessions(userId?: number): Promise<Session[]> {
  const url = userId ? `/api/sessions?user_id=${userId}` : `/api/sessions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to get sessions: ${res.statusText}`);
  return res.json();
}

/**
 * Create session (stores simulation result or quick advice)
 * Uses Firebase UID for user identification
 */
export async function createSession(firebaseUid: string, result: any): Promise<{ lastInsertId: number }> {
  const res = await fetch(`/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_anon_id: firebaseUid, result }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.statusText}`);
  return res.json();
}
