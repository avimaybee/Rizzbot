import { getAuthHeaders } from "./authHeaders";

export interface TranscriptionResponse {
  transcript: string;
  cleanedTranscript?: string;
  durationMs?: number;
  language?: string;
  emotionalTone?: string;
  unclearSegments?: string[];
  // Practice mode fields
  draftText?: string;
  contextSummary?: string;
}

function extForMime(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("flac")) return "flac";
  return "webm";
}

export const transcribeAudio = async (
  audioBlob: Blob,
  mode: 'therapist' | 'practice' | 'myvoice'
): Promise<TranscriptionResponse> => {
  const formData = new FormData();
  const ext = extForMime(audioBlob.type);
  formData.append('audio', audioBlob, `recording.${ext}`);
  formData.append('mode', mode);

  const authHeaders = await getAuthHeaders();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch('/api/voice/transcribe', {
      method: 'POST',
      headers: Object.keys(authHeaders).length > 0 ? authHeaders : undefined,
      body: formData,
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      let msg = 'Transcription failed';
      try {
        const errorData = JSON.parse(text) as any;
        msg = errorData?.error || errorData?.message || msg;
      } catch { /* keep default */ }
      throw new Error(msg);
    }

    try {
      return JSON.parse(text) as TranscriptionResponse;
    } catch {
      return { transcript: text, cleanedTranscript: text } as TranscriptionResponse;
    }
  } finally {
    window.clearTimeout(timer);
  }
};
