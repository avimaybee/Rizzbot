export interface GhostRequest {
  name: string;
  city: string;
  lastMessage?: string; // Optional if using screenshot
  screenshots?: string[]; // Array of Base64 strings
}

export interface EvidenceItem {
  label: string;
  status: 'clean' | 'suspicious' | 'dead' | 'jailed' | 'cooked';
  detail: string;
}

export interface SocialFootprint {
  platform: 'Spotify' | 'Strava' | 'Venmo' | 'Instagram' | 'LinkedIn' | 'General';
  status: 'active' | 'silent' | 'unknown';
  lastSeen: string; // "2 hours ago", "Yesterday", "Unknown"
  detail: string; // "Updated 'Gym' playlist"
}

export interface GhostResult {
  cookedLevel: number; // 0-100 (Replaced ghostScore)
  verdict: string;
  evidence: EvidenceItem[];
  socialScan: SocialFootprint[]; // New OSINT data
  isDead: boolean;
  memeUrl?: string; // Optional generated image concept
  identifiedName?: string; // OCR extracted name
  identifiedCity?: string; // OCR extracted/inferred city
}

export type AppState = 'landing' | 'loading' | 'results' | 'error';