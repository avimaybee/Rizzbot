import { corsHeadersFor } from "../../lib/cors";
import { telemetry } from "../../lib/telemetry";

export async function onRequest(context: { env: any; request: Request }) {
  const { env, request } = context;

  const corsHeaders = {
    ...corsHeadersFor(request),
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = (env as any).OPENCODE_GO_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENCODE_GO_API_KEY not configured" }), { status: 500, headers: corsHeaders });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const mode = (formData.get('mode') as 'therapist' | 'practice' | 'myvoice') || 'therapist';
    // Optional: client may send pre-encoded WAV base64 (from useVoiceRecorder WAV encoder)
    const audioBase64Field = formData.get('audioBase64') as string | null;
    const audioMimeField = formData.get('mimeType') as string | null;

    if (!audioFile && !audioBase64Field) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), { status: 400, headers: corsHeaders });
    }

    if (audioFile && audioFile.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Audio file too large (max 10MB)" }), { status: 400, headers: corsHeaders });
    }

    let cleanBase64 = "";
    let mimeType = "audio/wav";
    if (audioBase64Field) {
      cleanBase64 = audioBase64Field.includes(",") ? audioBase64Field.split(",")[1] : audioBase64Field;
      mimeType = audioMimeField || "audio/wav";
    } else if (audioFile) {
      const arrayBuffer = await audioFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      cleanBase64 = btoa(binary);
      mimeType = audioFile.type || "audio/webm";
    }

    const prompts: Record<string, string> = {
      therapist: `Transcribe this voice note accurately. Preserve tone, hesitations, uncertainty, and emotionally meaningful phrasing. Return JSON with: transcript, cleanedTranscript, unclearSegments, emotionalTone, containsDirectQuestion. Do not rewrite the user's meaning.`,
      practice: `Transcribe this voice note accurately. If the user is brainstorming a text reply, extract the intended message as draftText. If the user is venting or explaining context, return contextSummary. Return JSON with: transcript, draftText, contextSummary, confidenceNote, needsUserConfirmation.`,
      myvoice: `Transcribe this voice note exactly as spoken — it is a sample of the user's natural texting/chatting style for style analysis. Preserve slang, abbreviations, capitalization, punctuation and emoji habits. Return JSON with: transcript, cleanedTranscript.`
    };

    // Primary: OpenCode Go mimo-v2.6-flash with input_audio (WAV preferred)
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Rizzbot/1.0",
      "x-opencode-session": `rizzbot-voice-${Date.now()}`,
    };

    // OpenAI input_audio expects format wav/mp3; if webm, still try wav label (model is lenient) else fallback to Whisper
    const audioFormat = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") || mimeType.includes("mpeg") ? "mp3" : "wav";

    try {
      const t0 = Date.now();
      const res = await fetch("https://opencode.ai/inference/go/openai/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "mimo-v2.6-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "input_audio", input_audio: { data: cleanBase64, format: audioFormat } },
                { type: "text", text: prompts[mode] + " OUTPUT ONLY RAW VALID JSON." },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(`mimo-v2.6-flash HTTP ${res.status}`);
      const data = (await res.json()) as any;
      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) throw new Error("Empty transcription");
      telemetry(context, (env as any).RIZZBOT_DATA, { endpoint: "voice/transcribe", model: "mimo-v2.6-flash", latencyMs: Date.now() - t0, ok: true, uid: (context as any)?.data?.user?.uid });
      return new Response(text, {
        headers: { ...corsHeaders, "X-Model-Used": "mimo-v2.6-flash" },
      });
    } catch (primaryErr) {
      console.warn("[transcribe] OpenCode primary failed:", (primaryErr as Error).message);
      // Optional Cloudflare Workers AI Whisper fallback
      const ai = (env as any).AI;
      if (ai) {
        try {
          const whisper = await ai.run("@cf/openai/whisper-large-v3-turbo", { audio: cleanBase64 });
          const transcript = typeof whisper?.text === "string" ? whisper.text : JSON.stringify(whisper);
          return new Response(JSON.stringify({ transcript, cleanedTranscript: transcript, mode }), {
            headers: { ...corsHeaders, "X-Model-Used": "whisper-large-v3-turbo" },
          });
        } catch (wErr) {
          console.error("[transcribe] Whisper fallback failed:", wErr);
        }
      }
      throw primaryErr;
    }
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
