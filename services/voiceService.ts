import { getAuthHeaders } from "./authHeaders";
import { convertAudioBlobToWavBase64 } from "../app/hooks/useVoiceRecorder";

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

async function tryWavEncode(blob: Blob): Promise<{ base64: string; mimeType: string } | null> {
  try {
    return await convertAudioBlobToWavBase64(blob);
  } catch {
    return null;
  }
}

export const transcribeAudio = async (
  audioBlob: Blob,
  mode: 'therapist' | 'practice' | 'myvoice'
): Promise<TranscriptionResponse> => {
  const formData = new FormData();
  const wav = await tryWavEncode(audioBlob);
  if (wav) {
    formData.append('audioBase64', wav.base64);
    formData.append('mimeType', wav.mimeType);
    // Keep a File entry too for backends that expect it (harmless)
    formData.append('audio', audioBlob, 'recording.webm');
  } else {
    formData.append('audio', audioBlob, 'recording.webm');
  }
  formData.append('mode', mode);

  const authHeaders = await getAuthHeaders();
  const response = await fetch('/api/voice/transcribe', {
    method: 'POST',
    headers: Object.keys(authHeaders).length > 0 ? authHeaders : undefined,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json() as any;
    throw new Error(errorData.error || errorData.message || 'Transcription failed');
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as TranscriptionResponse;
  } catch {
    // Whisper-style plain transcript fallback
    return { transcript: text } as TranscriptionResponse;
  }
};
