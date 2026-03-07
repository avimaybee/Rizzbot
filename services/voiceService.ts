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

export const transcribeAudio = async (
  audioBlob: Blob,
  mode: 'therapist' | 'practice'
): Promise<TranscriptionResponse> => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('mode', mode);

  const response = await fetch('/api/voice/transcribe', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json() as any;
    throw new Error(errorData.error || 'Transcription failed');
  }

  return response.json();
};
