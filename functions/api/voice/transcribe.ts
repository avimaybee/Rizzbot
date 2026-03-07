import { GoogleGenAI } from "@google/genai";

export async function onRequest(context: { env: any; request: Request }) {
  const { env, request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), { status: 500, headers: corsHeaders });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const mode = (formData.get('mode') as 'therapist' | 'practice') || 'therapist';

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), { status: 400, headers: corsHeaders });
    }

    // Validation: 10MB limit (Cloudflare Worker limit is tight, but Gemini accepts up to 20MB for direct bytes)
    if (audioFile.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Audio file too large (max 10MB)" }), { status: 400, headers: corsHeaders });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const ai = new GoogleGenAI({ apiKey });
    
    // Prompts based on implementation plan
    const prompts = {
      therapist: `Transcribe this voice note accurately. Preserve tone, hesitations, uncertainty, and emotionally meaningful phrasing. Return JSON with: transcript, cleanedTranscript, unclearSegments, emotionalTone, containsDirectQuestion. Do not rewrite the user’s meaning.`,
      practice: `Transcribe this voice note accurately. If the user is brainstorming a text reply, extract the intended message as draftText. If the user is venting or explaining context, return contextSummary. Return JSON with: transcript, draftText, contextSummary, confidenceNote, needsUserConfirmation.`
    };

    const MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"];
    let lastError: any = null;

    for (const modelId of MODELS) {
      try {
        const result = await ai.models.generateContent({
          model: modelId,
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: audioFile.type || "audio/webm",
                    data: base64Audio,
                  },
                },
                { text: prompts[mode] },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
          }
        });

        const text = result.text;
        if (!text) throw new Error("Empty response from Gemini");

        return new Response(text, {
          headers: {
            ...corsHeaders,
            'X-Model-Used': modelId
          }
        });

      } catch (err: any) {
        lastError = err;
        console.error(`Transcription error with ${modelId}:`, err);
        
        const isQuotaError = err?.status === 429 || String(err?.message).toLowerCase().includes("quota");
        const isOverloaded = err?.status === 503 || String(err?.message).toLowerCase().includes("overloaded");

        if (isQuotaError || isOverloaded) continue;
        break;
      }
    }

    throw lastError || new Error("All fallback models failed");

  } catch (error: any) {
    console.error("Transcription Route Error:", error);
    return new Response(JSON.stringify({ 
      error: "Transcription failed", 
      message: error.message 
    }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}
