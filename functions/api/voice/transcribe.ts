import { corsHeadersFor } from "../../lib/cors";
import { telemetry } from "../../lib/telemetry";

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Groq Whisper limit: 25 MB
const SILENCE_HALLUCINATION_RE = /^(thank you\.?|thanks\.?|thanks for watching\.?|bye\.?|you\.?|\.+)$/i;

function isLikelySilenceHallucination(transcript: string, data: any): boolean {
  const segs = Array.isArray(data?.segments) ? data.segments : [];
  if (segs.length > 0 && segs.every((s: any) => typeof s?.no_speech_prob === "number" && s.no_speech_prob > 0.65)) {
    return true;
  }
  const dur = typeof data?.duration === "number" ? data.duration : 0;
  if (dur > 0 && dur <= 2.6 && SILENCE_HALLUCINATION_RE.test(transcript.trim())) {
    const lowConf = segs.some((s: any) => typeof s?.avg_logprob === "number" && s.avg_logprob < -0.2);
    if (lowConf || segs.length === 0) return true;
  }
  return false;
}

function filenameForMime(mime: string, originalName?: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a")) return "recording.m4a";
  if (m.includes("ogg")) return "recording.ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "recording.mp3";
  if (m.includes("wav")) return "recording.wav";
  if (m.includes("flac")) return "recording.flac";
  if (m.includes("webm")) return "recording.webm";
  if (originalName && /\.[a-z0-9]{2,5}$/i.test(originalName)) return originalName;
  return "recording.webm";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function onRequest(context: { env: any; request: Request; data?: any }) {
  const { env, request } = context;

  const corsHeaders = {
    ...corsHeadersFor(request),
    "Content-Type": "application/json; charset=utf-8",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const groqKey = (env as any).GROQ_API_KEY as string | undefined;
  const opencodeKey = (env as any).OPENCODE_GO_API_KEY as string | undefined;
  if (!groqKey && !opencodeKey) {
    return new Response(JSON.stringify({ error: "No transcription provider configured" }), { status: 500, headers: corsHeaders });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const mode = (formData.get("mode") as "therapist" | "practice" | "myvoice") || "therapist";
    const audioBase64Field = formData.get("audioBase64") as string | null;
    const audioMimeField = formData.get("mimeType") as string | null;

    if (!audioFile && !audioBase64Field) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), { status: 400, headers: corsHeaders });
    }

    if (audioFile && audioFile.size > MAX_AUDIO_BYTES) {
      return new Response(JSON.stringify({ error: "Audio recording is too large (max 25MB)" }), { status: 400, headers: corsHeaders });
    }

    const mimeType = audioFile?.type || audioMimeField || "audio/webm";
    const uid = context?.data?.user?.uid;
    const db = (env as any).RIZZBOT_DATA;

    let audioBytes: Uint8Array | null = null;
    if (audioFile) {
      audioBytes = new Uint8Array(await audioFile.arrayBuffer());
    } else if (audioBase64Field) {
      const clean = audioBase64Field.includes(",") ? audioBase64Field.split(",")[1] : audioBase64Field;
      const bin = atob(clean);
      audioBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) audioBytes[i] = bin.charCodeAt(i);
    }

    if (!audioBytes || audioBytes.length < 32) {
      return new Response(JSON.stringify({ error: "No speech detected in recording." }), { status: 400, headers: corsHeaders });
    }

    // 1) Primary: Groq OpenAI Whisper (fast, compressed multipart upload, supports multi-minute audio)
    if (groqKey) {
      const groqModels = ["whisper-large-v3-turbo", "whisper-large-v3"];
      const fileName = filenameForMime(mimeType, audioFile?.name);
      for (const model of groqModels) {
        try {
          const t0 = Date.now();
          const upstreamForm = new FormData();
          upstreamForm.append("file", new Blob([audioBytes], { type: mimeType }), fileName);
          upstreamForm.append("model", model);
          upstreamForm.append("response_format", "verbose_json");
          upstreamForm.append("temperature", "0");

          const res = await fetch(GROQ_TRANSCRIBE_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${groqKey}` },
            body: upstreamForm,
            signal: AbortSignal.timeout(40_000),
          });

          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            throw new Error(`Groq ${model} HTTP ${res.status}: ${detail.slice(0, 160)}`);
          }

          const data = (await res.json()) as any;
          const transcript = typeof data?.text === "string" ? data.text.trim() : "";
          if (!transcript || isLikelySilenceHallucination(transcript, data)) {
            return new Response(
              JSON.stringify({ error: "Didn’t catch any speech in that recording." }),
              { status: 422, headers: corsHeaders }
            );
          }

          const durationMs = typeof data?.duration === "number" ? Math.round(data.duration * 1000) : undefined;
          const language = typeof data?.language === "string" ? data.language : undefined;
          telemetry(context, db, { endpoint: "voice/transcribe", model, latencyMs: Date.now() - t0, ok: true, uid });
          return new Response(
            JSON.stringify({
              transcript,
              cleanedTranscript: transcript,
              durationMs,
              language,
              mode,
            }),
            { headers: { ...corsHeaders, "X-Model-Used": model } }
          );
        } catch (err) {
          console.warn(`[transcribe] ${model} failed:`, (err as Error).message);
        }
      }
    }

    // 2) Fallback: OpenCode Go mimo-v2.6-flash (best-effort if Groq fails or isn't configured)
    if (opencodeKey) {
      const cleanBase64 = audioBase64Field
        ? (audioBase64Field.includes(",") ? audioBase64Field.split(",")[1] : audioBase64Field)
        : bytesToBase64(audioBytes);
      const audioFormat = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") || mimeType.includes("mpeg") ? "mp3" : "wav";
      const prompts: Record<string, string> = {
        therapist: `Transcribe this voice note accurately. Preserve tone, hesitations, uncertainty, and emotionally meaningful phrasing. Return JSON with: transcript, cleanedTranscript, unclearSegments, emotionalTone, containsDirectQuestion. Do not rewrite the user's meaning.`,
        practice: `Transcribe this voice note accurately. If the user is brainstorming a text reply, extract the intended message as draftText. If the user is venting or explaining context, return contextSummary. Return JSON with: transcript, draftText, contextSummary, confidenceNote, needsUserConfirmation.`,
        myvoice: `Transcribe this voice note accurately as spoken. Return JSON with: transcript, cleanedTranscript.`,
      };
      try {
        const t0 = Date.now();
        const res = await fetch("https://opencode.ai/inference/go/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opencodeKey}`,
            "Content-Type": "application/json",
            "User-Agent": "Rizzbot/1.0",
            "x-opencode-session": `rizzbot-voice-${Date.now()}`,
          },
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
          signal: AbortSignal.timeout(40_000),
        });
        if (!res.ok) throw new Error(`mimo-v2.6-flash HTTP ${res.status}`);
        const data = (await res.json()) as any;
        const text = data.choices?.[0]?.message?.content ?? "";
        if (!text.trim()) throw new Error("Empty transcription");
        telemetry(context, db, { endpoint: "voice/transcribe", model: "mimo-v2.6-flash", latencyMs: Date.now() - t0, ok: true, uid });
        return new Response(text, { headers: { ...corsHeaders, "X-Model-Used": "mimo-v2.6-flash" } });
      } catch (primaryErr) {
        console.warn("[transcribe] OpenCode fallback failed:", (primaryErr as Error).message);
      }
    }

    // 3) Optional Cloudflare Workers AI Whisper fallback
    const ai = (env as any).AI;
    if (ai) {
      const whisper = await ai.run("@cf/openai/whisper-large-v3-turbo", { audio: Array.from(audioBytes) });
      const transcript = typeof whisper?.text === "string" ? whisper.text.trim() : JSON.stringify(whisper);
      return new Response(JSON.stringify({ transcript, cleanedTranscript: transcript, mode }), {
        headers: { ...corsHeaders, "X-Model-Used": "cf-whisper-large-v3-turbo" },
      });
    }

    throw new Error("All transcription providers failed");
  } catch (error: any) {
    console.error("Transcription Route Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Transcription failed" }),
      { status: 500, headers: corsHeaders }
    );
  }
}
