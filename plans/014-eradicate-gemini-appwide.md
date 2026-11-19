# Plan 014 — Eradicate Gemini App-Wide (100% OpenCode Go Migration for Therapist, Practice, Style Extraction & Voice)

> **Before you start — drift check.** This plan was written against commit `c7728b1` (`main`) and must be executed **after** Plans 010–013. Before touching anything, run:
>
> ```bash
> git log --oneline c7728b1..HEAD -- services/geminiService.ts services/voiceService.ts functions/api/gemini/ functions/api/voice/transcribe.ts app/hooks/useVoiceRecorder.ts package.json vite.config.ts
> ```
>
> If unexpected changes exist, **STOP and read the diff** before applying edits. All symbol names, tool definitions, NDJSON streaming events, and line numbers below are verified against `c7728b1`.

## Status

- **Priority**: P0 (completes 100% removal of `@google/genai`, `/api/gemini/*` endpoints, and `GEMINI_API_KEY` from the entire repository)
- **Effort**: ~4–5 hours
- **Depends on**: Plans 010, 011, 012, and 013 (`getQuickAdvice` already migrated to `/api/opencode/quick`)
- **Risk**: Medium (migrates `/api/gemini/generate` → `/api/opencode/generate`, `/api/gemini/stream` → `/api/opencode/stream`, and `/api/voice/transcribe` to OpenCode Go; renames `services/geminiService.ts` → `services/aiService.ts`; deletes `functions/api/gemini/*`; removes `@google/genai` from `package.json` and `vite.config.ts:32`)

---

## Why this matters

After Plans 010–013, Quick Mode runs 100% on OpenCode Go (`muse-spark-1.3-contributor:xhigh` → `deepseek-v4.1-flash:high` → `hy4-flash-free:high`). However, the rest of the application still depends on `@google/genai`, `services/geminiService.ts`, `functions/api/gemini/{generate,stream,[[path]]}.ts`, `functions/api/voice/transcribe.ts`, and `GEMINI_API_KEY`.

### Complete Inventory of Remaining Gemini Dependencies (Verified at `c7728b1`)

| Feature / Call Site | Current File & Exact Lines | Functions Imported / Used | Target Replacement |
| :--- | :--- | :--- | :--- |
| **Quick Mode** | `app/components/QuickModeScreen.tsx:25` | `import { getQuickAdvice, streamQuickAdvice } from "../../services/geminiService"` | `import { getQuickAdvice, streamQuickAdvice } from "../../services/aiService"` (`POST /api/opencode/quick`) |
| **Practice Mode** | `app/components/PracticeScreen.tsx:30` | `import { analyzeSimulation, generatePersona, simulateDraft } from "../../services/geminiService"` | `import { analyzeSimulation, generatePersona, simulateDraft } from "../../services/aiService"` (`POST /api/opencode/generate`) |
| **My Voice Style Analysis** | `app/components/MyVoiceScreen.tsx:23` | `import { extractUserStyle } from "../../services/geminiService"` | `import { extractUserStyle } from "../../services/aiService"` (`POST /api/opencode/generate`) |
| **Therapist Mode** | `app/components/TherapistScreen.tsx:42` | `import { generateSessionClosure, streamTherapistAdvice } from "../../services/geminiService"` | `import { generateSessionClosure, streamTherapistAdvice } from "../../services/aiService"` (`POST /api/opencode/stream` & `POST /api/opencode/generate`) |
| **Voice Transcription** | `functions/api/voice/transcribe.ts:1-114`, `services/voiceService.ts:15-36`, `app/hooks/useVoiceRecorder.ts:57-60` | `import { GoogleGenAI } from "@google/genai"`, `env.GEMINI_API_KEY`, `gemini-3.5-flash-lite` | OpenCode Go `mimo-v2.6-flash` (`input_audio` with client-side 16kHz WAV conversion) |
| **Client Service** | `services/geminiService.ts:1` | `import { HarmCategory, HarmBlockThreshold, Type } from "@google/genai"` | Replace with `services/aiService.ts` (standard JSON Schema types, zero `@google/genai` imports) and **delete** `services/geminiService.ts` |
| **Server Gemini Proxy** | `functions/api/gemini/generate.ts`, `stream.ts`, `[[path]].ts` | `import { GoogleGenAI } from "@google/genai"`, `env.GEMINI_API_KEY` | **Delete** entire `functions/api/gemini/` directory |
| **Dependencies & Bundler** | `package.json:14`, `vite.config.ts:16-17, 32` | `"@google/genai": "^1.30.0"`, `genai: ['@google/genai']` | Remove from `package.json` and `vite.config.ts` |

---

## Approved OpenCode Go Model Routing Per Endpoint

Every model below is verified in the ultra-affordable/free OpenCode Go tiers (`<$0.0015/call` or `$0` free):

| Endpoint | Primary Model | Fallback 1 | Fallback 2 (Free) | Why |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/opencode/quick` (Plan 010) | `muse-spark-1.3-contributor` (`xhigh`) | `deepseek-v4.1-flash` (`high`) | `hy4-flash-free` (`high`) | #1 in 23-ballot blind tournament (`70.9%` Borda, `82.2%` Ext Gemini) |
| `POST /api/opencode/generate` (`generatePersona`, `simulateDraft`, `analyzeSimulation`, `extractUserStyle`, `generateSessionClosure`) | `muse-spark-1.3-contributor` (`medium` or `low`) | `deepseek-v4.1-flash` (`high`) | `hy4-flash-free` (`high`) | Supports multimodal vision (`input_image`) for `generatePersona` & `extractUserStyle`, plus fast low-latency roleplay turns for `simulateDraft` |
| `POST /api/opencode/stream` (`streamTherapistAdvice` + 11 tools) | `deepseek-v4.1-flash` (`high`) | `hy4-flash-free` (`high`) | `muse-spark-1.3-contributor` (`medium`) | Native OpenAI `/v1/chat/completions` streaming (`stream: true`) + function calling (`tools`) + vision (`image_url`) + `zdr: true` ($100/mo allowance ≈ 100k calls) |
| `POST /api/voice/transcribe` (`therapist`, `practice`, `myvoice`) | `mimo-v2.6-flash` | `hy4-flash-free` (text cleanup fallback if browser transcript provided) | — | `mimo-v2.6-flash` natively supports `input_audio` on OpenCode Go (`$60/mo` allowance ≈ 60k calls/mo) |

---

## Scope

### Files to create
1. `functions/api/opencode/generate.ts` — Drop-in OpenCode Go replacement for `functions/api/gemini/generate.ts`. Accepts `{ contents, systemInstruction, config }` (the exact shape sent by `runWithFallback` in `services/geminiService.ts:78-107`), translates Gemini `contents` (`parts` with `{ text }` and `{ inlineData: { mimeType, data } }`) into OpenCode Go `/v1/responses` (`muse-spark-1.3-contributor`) and `/v1/chat/completions` (`deepseek-v4.1-flash` → `hy4-flash-free`), and returns `{ text, model }`.
2. `functions/api/opencode/stream.ts` — Drop-in OpenCode Go replacement for `functions/api/gemini/stream.ts`. Accepts `{ contents, systemInstruction, tools }` (the exact shape sent by `runStreamWithFallback` in `services/geminiService.ts:141-170`), streams via `deepseek-v4.1-flash` (`high`) → `hy4-flash-free` (`high`), executes the multi-round tool loop (up to `MAX_TOOL_ROUNDS = 4` when the model emits `tool_calls`), and writes the **exact same NDJSON chunks** expected by `streamTherapistAdvice` (`services/geminiService.ts:1564-1595`):
   - `{"type":"metadata","model":"deepseek-v4.1-flash"}\n`
   - `{"type":"text","content":"..."}\n`
   - `{"type":"functionCalls","calls":[{"name":"...","args":{...}}]}\n`
   - `{"type":"error","message":"..."}\n`
3. `services/aiService.ts` — Complete replacement for `services/geminiService.ts` with **zero** `@google/genai` imports, pointing `runWithFallback` to `/api/opencode/generate` and `runStreamWithFallback` to `/api/opencode/stream`.

### Files to modify
1. `functions/api/voice/transcribe.ts` — Remove `import { GoogleGenAI } from "@google/genai"` and `env.GEMINI_API_KEY`; transcribe the uploaded audio file via OpenCode Go `mimo-v2.6-flash` (`https://opencode.ai/inference/go/openai/v1/chat/completions` with `input_audio`) using `env.OPENCODE_GO_API_KEY` and preserving the exact JSON output schemas for `therapist`, `practice`, and `myvoice` (`lines 48-52`).
2. `app/hooks/useVoiceRecorder.ts` & `services/voiceService.ts` — Add an in-browser `AudioContext` WAV converter (`convertBlobToWav`) in `services/voiceService.ts` so the `Blob` uploaded in `formData.append('audio', wavBlob, 'recording.wav')` is 16kHz mono PCM WAV (`format: "wav"`), which is universally supported by OpenAI-compatible `input_audio` endpoints.
3. `app/components/QuickModeScreen.tsx:25` — Change import from `../../services/geminiService` to `../../services/aiService`.
4. `app/components/PracticeScreen.tsx:30` — Change import from `../../services/geminiService` to `../../services/aiService`.
5. `app/components/MyVoiceScreen.tsx:23` — Change import from `../../services/geminiService` to `../../services/aiService`.
6. `app/components/TherapistScreen.tsx:42` — Change import from `../../services/geminiService` to `../../services/aiService`.
7. `package.json:14` — Remove `"@google/genai": "^1.30.0"`.
8. `vite.config.ts:16-17, 32` — Remove `GEMINI_API_KEY` defines and remove `genai: ['@google/genai'],` from `manualChunks`.

### Files to delete
1. `services/geminiService.ts`
2. `functions/api/gemini/generate.ts`
3. `functions/api/gemini/stream.ts`
4. `functions/api/gemini/[[path]].ts`

---

## Step-by-Step Implementation Instructions

### Step 1: Create `functions/api/opencode/generate.ts`

Because `generatePersona` (`services/geminiService.ts:238`), `simulateDraft` (`lines 357, 377`), `analyzeSimulation` (`line 552`), `extractUserStyle` (`line 1096`), and `generateSessionClosure` (`line 1667`) all call `runWithFallback({ contents, systemInstruction, config })`, making `functions/api/opencode/generate.ts` accept `{ contents, systemInstruction, config }` and return `{ text, model }` makes the entire migration seamless!

Create `functions/api/opencode/generate.ts`:

```ts
interface ExtractedInput {
  texts: string[];
  images: Array<{ mimeType: string; data: string }>;
}

/**
 * Extracts text and inlineData image parts from any of the 3 `contents` formats
 * used across generatePersona ({ parts }), simulateDraft ([{ role, parts }]),
 * analyzeSimulation (string), extractUserStyle (parts[]), and generateSessionClosure.
 */
function normalizeContents(contents: unknown): ExtractedInput {
  const texts: string[] = [];
  const images: Array<{ mimeType: string; data: string }> = [];

  const visitPart = (part: unknown) => {
    if (!part) return;
    if (typeof part === "string") {
      texts.push(part);
      return;
    }
    if (typeof part === "object") {
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") {
        texts.push(p.text);
      }
      if (p.inlineData && typeof p.inlineData === "object") {
        const inline = p.inlineData as { mimeType?: string; data?: string };
        if (typeof inline.data === "string" && inline.data.trim()) {
          images.push({
            mimeType: inline.mimeType || "image/webp",
            data: inline.data,
          });
        }
      }
      if (Array.isArray(p.parts)) {
        p.parts.forEach(visitPart);
      }
    }
  };

  if (typeof contents === "string") {
    texts.push(contents);
  } else if (Array.isArray(contents)) {
    contents.forEach(visitPart);
  } else if (contents && typeof contents === "object") {
    visitPart(contents);
  }

  return { texts, images };
}

function toDataUrl(img: { mimeType: string; data: string }): string {
  if (img.data.startsWith("data:")) return img.data;
  return `data:${img.mimeType || "image/webp"};base64,${img.data}`;
}

export async function onRequest(context: { env: any; request: Request; data?: any }) {
  const { env, request, data } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = env.OPENCODE_GO_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENCODE_GO_API_KEY not configured" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const body = (await request.json()) as {
    contents?: unknown;
    systemInstruction?: string;
    config?: { thinkingConfig?: { thinkingLevel?: string }; plainText?: boolean };
  };

  const { texts, images } = normalizeContents(body.contents);
  const promptText = texts.join("\n\n").trim();
  if (!promptText && images.length === 0) {
    return new Response(JSON.stringify({ error: "Empty contents" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const uid = (data?.user?.uid as string) || "anon";
  // Map LOW thinking config (used by simulateDraft actor call) to "low", otherwise "medium"
  const requestedLevel = body.config?.thinkingConfig?.thinkingLevel?.toUpperCase();
  const museEffort = requestedLevel === "LOW" ? "low" : "medium";
  const chatEffort = requestedLevel === "LOW" ? "low" : "high";

  const models = [
    { id: "muse-spark-1.3-contributor", format: "responses" as const, effort: museEffort },
    { id: "deepseek-v4.1-flash", format: "chat" as const, effort: chatEffort },
    { id: "hy4-flash-free", format: "chat" as const, effort: chatEffort },
  ];

  let lastError: Error | null = null;

  for (const spec of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Rizzbot/1.0",
        "x-opencode-session": `rizzbot-gen-${uid}-${Date.now()}`,
      };

      if (spec.format === "responses") {
        const contentParts: Array<Record<string, unknown>> = images.map((img) => ({
          type: "input_image",
          image_url: toDataUrl(img),
        }));
        contentParts.push({ type: "input_text", text: promptText });

        const res = await fetch("https://opencode.ai/inference/go/openai/v1/responses", {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            model: spec.id,
            ...(body.systemInstruction ? { instructions: body.systemInstruction } : {}),
            input: [{ role: "user", content: contentParts }],
            reasoning: { effort: spec.effort },
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`${spec.id} HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }

        const json = (await res.json()) as {
          output_text?: string;
          output?: Array<{ type?: string; content?: Array<{ text?: string }> }>;
        };
        let text = typeof json.output_text === "string" ? json.output_text : "";
        if (!text && Array.isArray(json.output)) {
          text = json.output
            .filter((item) => item.type === "message" && Array.isArray(item.content))
            .flatMap((item) => item.content!.map((c) => c.text || ""))
            .join("");
        }
        if (!text.trim()) throw new Error(`Empty response from ${spec.id}`);

        return new Response(JSON.stringify({ text, model: spec.id }), {
          headers: { ...corsHeaders, "X-Model-Used": spec.id },
        });
      } else {
        const userContent: Array<Record<string, unknown>> = images.map((img) => ({
          type: "image_url",
          image_url: { url: toDataUrl(img) },
        }));
        userContent.push({ type: "text", text: promptText });

        const messages: Array<Record<string, unknown>> = [];
        if (body.systemInstruction) {
          messages.push({ role: "system", content: body.systemInstruction });
        }
        messages.push({ role: "user", content: userContent });

        const res = await fetch("https://opencode.ai/inference/go/openai/v1/chat/completions", {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            model: spec.id,
            reasoning_effort: spec.effort,
            messages,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`${spec.id} HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }

        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = json.choices?.[0]?.message?.content ?? "";
        if (!text.trim()) throw new Error(`Empty response from ${spec.id}`);

        return new Response(JSON.stringify({ text, model: spec.id }), {
          headers: { ...corsHeaders, "X-Model-Used": spec.id },
        });
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[opencode/generate] ${spec.id} failed:`, lastError.message);
    } finally {
      clearTimeout(timer);
    }
  }

  return new Response(
    JSON.stringify({
      error: "All fallback models failed.",
      message: lastError?.message || "Generation failed",
    }),
    { status: 500, headers: corsHeaders }
  );
}
```

---

### Step 2: Create `functions/api/opencode/stream.ts` (NDJSON Stream + 11 Therapist Tools)

Look closely at how `functions/api/gemini/stream.ts:38-140` and `streamTherapistAdvice` (`services/geminiService.ts:1525-1620`) work:
- The client sends `{ contents, systemInstruction, tools }` to the stream endpoint.
- The server returns `Content-Type: application/x-ndjson; charset=utf-8` where each line is a JSON object:
  - `{ type: "metadata", model: modelId }`
  - `{ type: "text", content: "..." }`
  - `{ type: "functionCalls", calls: [{ name: "update_session_analysis", args: { ... } }] }`
  - `{ type: "error", message: "..." }`
- When the model emits a function call (e.g. `update_session_analysis`), `functions/api/gemini/stream.ts:118-139` sends `{ type: "functionCalls", calls }` to the client, appends a synthetic tool response `{ status: "recorded" }` to the conversation history, and loops up to `MAX_TOOL_ROUNDS = 4` if the model hasn't finished its text response yet.

In `functions/api/opencode/stream.ts`, write the full implementation:

```ts
function normalizeSchemaTypes(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(normalizeSchemaTypes);

  const copy: Record<string, any> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "type" && typeof v === "string") {
      copy[k] = v.toLowerCase();
    } else if (typeof v === "object" && v !== null) {
      copy[k] = normalizeSchemaTypes(v);
    } else {
      copy[k] = v;
    }
  }
  return copy;
}

function toOpenAiTools(tools: any[] | undefined): any[] | undefined {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || "",
      parameters: normalizeSchemaTypes(t.parameters || { type: "object", properties: {} }),
    },
  }));
}

function toOpenAiMessages(contents: any[], systemInstruction?: string): any[] {
  const messages: any[] = [];
  if (systemInstruction && systemInstruction.trim()) {
    messages.push({ role: "system", content: systemInstruction.trim() });
  }

  for (const turn of Array.isArray(contents) ? contents : []) {
    if (!turn || typeof turn !== "object") continue;
    const role = turn.role === "model" ? "assistant" : "user";
    const parts = Array.isArray(turn.parts) ? turn.parts : [];

    const contentParts: any[] = [];
    for (const p of parts) {
      if (typeof p?.text === "string" && p.text.length > 0) {
        contentParts.push({ type: "text", text: p.text });
      } else if (p?.inlineData?.data) {
        const mime = p.inlineData.mimeType || "image/png";
        const dataUrl = p.inlineData.data.startsWith("data:")
          ? p.inlineData.data
          : `data:${mime};base64,${p.inlineData.data}`;
        contentParts.push({ type: "image_url", image_url: { url: dataUrl } });
      }
    }

    if (contentParts.length === 1 && contentParts[0].type === "text") {
      messages.push({ role, content: contentParts[0].text });
    } else if (contentParts.length > 0) {
      messages.push({ role, content: contentParts });
    }
  }

  return messages;
}

export async function onRequest(context: { env: any; request: Request; data?: any }) {
  const { env, request, data } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = env.OPENCODE_GO_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENCODE_GO_API_KEY not configured" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const body = (await request.json()) as {
    contents?: any[];
    systemInstruction?: string;
    tools?: any[];
  };

  const uid = (data?.user?.uid as string) || "anon";
  const openAiTools = toOpenAiTools(body.tools);
  const models = ["deepseek-v4.1-flash", "hy4-flash-free"] as const;

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const sendChunk = async (payload: Record<string, unknown>) => {
    try {
      await writer.write(encoder.encode(JSON.stringify(payload) + "\n"));
    } catch {
      // Client disconnected
    }
  };

  (async () => {
    let lastError: Error | null = null;
    let streamStarted = false;

    for (const modelId of models) {
      try {
        const messages = toOpenAiMessages(body.contents || [], body.systemInstruction);
        const MAX_TOOL_ROUNDS = 4;
        let round = 0;
        let finished = false;

        while (!finished && round < MAX_TOOL_ROUNDS) {
          round++;
          const res = await fetch("https://opencode.ai/inference/go/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "User-Agent": "Rizzbot/1.0",
              "x-opencode-session": `rizzbot-stream-${uid}-${Date.now()}`,
            },
            body: JSON.stringify({
              model: modelId,
              reasoning_effort: "low",
              stream: true,
              messages,
              ...(openAiTools ? { tools: openAiTools, tool_choice: "auto" } : {}),
            }),
          });

          if (!res.ok || !res.body) {
            const errBody = await res.text().catch(() => "");
            throw new Error(`${modelId} HTTP ${res.status}: ${errBody.slice(0, 200)}`);
          }

          if (!streamStarted) {
            await sendChunk({ type: "metadata", model: modelId });
            streamStarted = true;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let sseBuffer = "";
          let roundText = "";
          const toolCallMap = new Map<number, { id: string; name: string; argsText: string }>();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() || "";

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith("data:")) continue;
              const dataStr = line.slice(5).trim();
              if (!dataStr || dataStr === "[DONE]") continue;

              let parsed: any;
              try {
                parsed = JSON.parse(dataStr);
              } catch {
                continue;
              }

              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;

              if (typeof delta.content === "string" && delta.content.length > 0) {
                roundText += delta.content;
                await sendChunk({ type: "text", content: delta.content });
              }

              if (Array.isArray(delta.tool_calls)) {
                for (const tc of delta.tool_calls) {
                  const idx = typeof tc.index === "number" ? tc.index : 0;
                  const existing = toolCallMap.get(idx) || {
                    id: tc.id || `call_${idx}_${Date.now()}`,
                    name: "",
                    argsText: "",
                  };
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name += tc.function.name;
                  if (tc.function?.arguments) existing.argsText += tc.function.arguments;
                  toolCallMap.set(idx, existing);
                }
              }
            }
          }

          if (toolCallMap.size > 0) {
            const emittedCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
            const assistantToolCalls: any[] = [];
            const toolResponses: any[] = [];

            for (const entry of toolCallMap.values()) {
              if (!entry.name) continue;
              let parsedArgs: Record<string, unknown> = {};
              try {
                parsedArgs = entry.argsText ? JSON.parse(entry.argsText) : {};
              } catch {
                parsedArgs = {};
              }
              emittedCalls.push({ name: entry.name, args: parsedArgs });
              assistantToolCalls.push({
                id: entry.id,
                type: "function",
                function: { name: entry.name, arguments: entry.argsText || "{}" },
              });
              toolResponses.push({
                role: "tool",
                tool_call_id: entry.id,
                content: JSON.stringify({ status: "recorded" }),
              });
            }

            if (emittedCalls.length > 0) {
              await sendChunk({ type: "functionCalls", calls: emittedCalls });
            }

            // If the model already streamed its conversational text reply AND called tools, we're done!
            // If it only emitted tool calls with zero visible text, feed the tool responses back for the text turn.
            if (roundText.trim().length > 0) {
              finished = true;
            } else {
              messages.push({
                role: "assistant",
                content: roundText || null,
                tool_calls: assistantToolCalls,
              });
              messages.push(...toolResponses);
            }
          } else {
            finished = true;
          }
        }

        await writer.close();
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[opencode/stream] ${modelId} failed:`, lastError.message);
        if (streamStarted) break;
      }
    }

    await sendChunk({
      type: "error",
      message: lastError?.message || "All OpenCode Go stream models failed.",
    });
    try {
      await writer.close();
    } catch {
      // Ignore already-closed writer
    }
  })();

  return new Response(readable, { headers: corsHeaders });
}
```

---

### Step 3: Migrate Voice Transcription to OpenCode Go (`functions/api/voice/transcribe.ts` & `services/voiceService.ts`)

1. **Add Client-Side 16kHz Mono WAV Conversion in `services/voiceService.ts`**:
   - Browsers record `MediaRecorder` blobs as `audio/webm;codecs=opus` or `audio/mp4` (`app/hooks/useVoiceRecorder.ts:57-59`).
   - OpenCode Go's `mimo-v2.6-flash` (`POST https://opencode.ai/inference/go/openai/v1/chat/completions`) accepts OpenAI `input_audio` with `format: "wav"` or `"mp3"`.
   - In `services/voiceService.ts`, add `convertBlobToWav(audioBlob: Blob): Promise<Blob>` using `AudioContext.decodeAudioData()` (16kHz mono 16-bit PCM WAV) before appending `formData.append('audio', wavBlob, 'recording.wav')`.
2. **Rewrite `functions/api/voice/transcribe.ts` with Zero `@google/genai` Imports**:
   - Remove `import { GoogleGenAI } from "@google/genai";` (line 1) and `const apiKey = env.GEMINI_API_KEY;` (line 21).
   - Read `const apiKey = env.OPENCODE_GO_API_KEY;`.
   - Keep the exact `prompts` dictionary for `therapist`, `practice`, and `myvoice` (`lines 48-52`).
   - Send `POST https://opencode.ai/inference/go/openai/v1/chat/completions` with:
     ```ts
     const uid = (context as any).data?.user?.uid || "anon";
     const res = await fetch("https://opencode.ai/inference/go/openai/v1/chat/completions", {
       method: "POST",
       headers: {
         Authorization: `Bearer ${apiKey}`,
         "Content-Type": "application/json",
         "User-Agent": "Rizzbot/1.0",
         "x-opencode-session": `rizzbot-voice-${uid}-${Date.now()}`,
       },
       body: JSON.stringify({
         model: "mimo-v2.6-flash",
         response_format: { type: "json_object" },
         messages: [
           {
             role: "user",
             content: [
               {
                 type: "input_audio",
                 input_audio: {
                   data: base64Audio,
                   format: audioFile.name?.endsWith(".mp3") ? "mp3" : "wav",
                 },
               },
               {
                 type: "text",
                 text: prompts[mode] + "\nOutput ONLY raw valid JSON.",
               },
             ],
           },
         ],
       }),
     });
     ```
   - Extract `const rawText = data.choices?.[0]?.message?.content || "";`, strip any markdown fences, and return the JSON response with `'X-Model-Used': 'mimo-v2.6-flash'`.

---

### Step 4: Replace `services/geminiService.ts` with `services/aiService.ts` & Delete `functions/api/gemini/*`

1. Create `services/aiService.ts` from `services/geminiService.ts`:
   - Remove `import { HarmCategory, HarmBlockThreshold, Type } from "@google/genai";` (`line 1`) and `safetySettings` (`lines 15-20`).
   - Define a lightweight local `const SchemaType = { OBJECT: "object", STRING: "string", NUMBER: "number", BOOLEAN: "boolean", ARRAY: "array" } as const;` for the 11 Therapist tool declarations (`SESSION_ANALYSIS_TOOL`, `ASSIGN_EXERCISE_TOOL`, `LOG_EPIPHANY_TOOL`, `PERSPECTIVE_BRIDGE_TOOL`, `COMMUNICATION_INSIGHT_TOOL`, `FLAG_PROJECTION_TOOL`, `CLOSURE_SCRIPT_TOOL`, `SAFETY_INTERVENTION_TOOL`, `PARENTAL_PATTERN_TOOL`, `VALUES_MATRIX_TOOL`, `SAVE_MEMORY_TOOL`, `UPDATE_SIM_STATE_TOOL`).
   - Point `runWithFallback` (`line 89`) to `fetch('/api/opencode/generate', ...)` instead of `'/api/gemini/generate'`.
   - Point `runStreamWithFallback` (`line 152`) to `fetch('/api/opencode/stream', ...)` instead of `'/api/gemini/stream'`.
   - Keep `getQuickAdvice` and `streamQuickAdvice` pointing to `fetch('/api/opencode/quick', ...)` from Plan 010.
2. Update the 4 component imports:
   - `app/components/QuickModeScreen.tsx:25`: `import { getQuickAdvice, streamQuickAdvice } from "../../services/aiService";`
   - `app/components/PracticeScreen.tsx:30`: `import { analyzeSimulation, generatePersona, simulateDraft } from "../../services/aiService";`
   - `app/components/MyVoiceScreen.tsx:23`: `import { extractUserStyle } from "../../services/aiService";`
   - `app/components/TherapistScreen.tsx:42`: `import { generateSessionClosure, streamTherapistAdvice } from "../../services/aiService";`
3. Delete `services/geminiService.ts`.
4. Delete `functions/api/gemini/generate.ts`, `functions/api/gemini/stream.ts`, and `functions/api/gemini/[[path]].ts`.

---

### Step 5: Remove `@google/genai` from `package.json` and `vite.config.ts`

> **CRITICAL BUILD REQUIREMENT**: `vite.config.ts:32` hardcodes `genai: ['@google/genai']` inside `build.rollupOptions.output.manualChunks`. You **must** remove line 32 in `vite.config.ts` when removing `@google/genai` from `package.json`, or `npm run build` will fail with an unresolved Rollup entry module error.

1. In `package.json:14`, delete `"@google/genai": "^1.30.0",`.
2. In `vite.config.ts`:
   - Delete lines 16–17 (`'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),` and `'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)`).
   - Delete line 32 (`genai: ['@google/genai'],`) from `manualChunks`.

---

## Test Plan

1. **Zero-Gemini Grep Audit**:
   ```bash
   git grep -E "@google/genai|/api/gemini|geminiService|GEMINI_API_KEY" -- app/ services/ functions/ package.json vite.config.ts
   ```
   Must return **0 matches**.
2. **TypeScript Check**:
   ```bash
   npm run typecheck
   ```
   Must exit 0.
3. **Unit Tests**:
   ```bash
   npm test
   ```
   Must pass all unit tests.
4. **Production Build**:
   ```bash
   npm run build
   ```
   Must succeed with 0 errors and no `genai-*.js` bundle chunk.

---

## Done Criteria

- [ ] `functions/api/opencode/generate.ts` and `functions/api/opencode/stream.ts` exist and route Practice, Style Extraction, Session Closure, and Therapist streaming + 11 tools through OpenCode Go (`OPENCODE_GO_API_KEY`).
- [ ] `functions/api/voice/transcribe.ts` and `services/voiceService.ts` convert audio to 16kHz WAV and transcribe via OpenCode Go `mimo-v2.6-flash` with zero `@google/genai` imports.
- [ ] `services/aiService.ts` replaces `services/geminiService.ts` across `QuickModeScreen.tsx`, `PracticeScreen.tsx`, `MyVoiceScreen.tsx`, and `TherapistScreen.tsx`.
- [ ] `services/geminiService.ts` and `functions/api/gemini/*` are deleted.
- [ ] `@google/genai` is removed from `package.json` AND `genai: ['@google/genai']` is removed from `vite.config.ts:32`.
- [ ] `git grep -E "@google/genai|/api/gemini|geminiService|GEMINI_API_KEY" -- app/ services/ functions/ package.json vite.config.ts` returns 0 matches.
- [ ] `npm run typecheck`, `npm test`, and `npm run build` all exit 0.

---

## STOP Conditions

- **STOP** if `vite.config.ts` still contains `genai: ['@google/genai']` after removing `@google/genai` from `package.json`.
- **STOP** if any file in `app/`, `services/`, or `functions/` still references `@google/genai`, `/api/gemini`, `geminiService`, or `GEMINI_API_KEY`.
