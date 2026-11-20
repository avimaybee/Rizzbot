import { toDataUrl, cleanJsonObject } from "../../lib/json";
import { corsHeadersFor } from "../../lib/cors";
import { telemetry } from "../../lib/telemetry";

interface GenerateRequest {
  task: "persona" | "simulate" | "analyze_simulation" | "extract_style" | "session_closure";
  systemInstruction: string;
  prompt: string;
  images?: Array<{ mimeType: string; data: string }>;
  effort?: "medium" | "low" | "high";
}

function cleanJson(raw: string): string {
  try {
    return JSON.stringify(cleanJsonObject(raw));
  } catch {
    return raw;
  }
}

export async function onRequest(context: any) {
  const { env, request, data } = context;
  const cors = { ...corsHeadersFor(request), "Content-Type": "application/json" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const apiKey = (env as any).OPENCODE_GO_API_KEY as string | undefined;
  if (!apiKey) return new Response(JSON.stringify({ error: "OPENCODE_GO_API_KEY missing" }), { status: 500, headers: cors });

  const uid = (data?.user?.uid as string) || (data?.uid as string) || "anon";

  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors });
  }
  if (!body.prompt || !body.systemInstruction) {
    return new Response(JSON.stringify({ error: "Missing prompt/systemInstruction" }), { status: 400, headers: cors });
  }

  const images = Array.isArray(body.images) ? body.images.slice(0, 10) : [];
  const effort = body.effort || "medium";

  const chain = [
    { id: "muse-spark-1.3-contributor", format: "responses" as const, effort, timeoutMs: 55_000, structured: true },
    { id: "deepseek-v4.1-flash", format: "chat" as const, effort: "high" as const, timeoutMs: 55_000, structured: true },
    { id: "hy4-flash-free", format: "chat" as const, effort: "high" as const, timeoutMs: 60_000, structured: false },
  ];

  const headers = () => ({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "Rizzbot/1.0",
    "x-opencode-session": `rizzbot-generate-${uid}-${Date.now()}`,
  });

  let lastError = "";
  const db = (env as any).RIZZBOT_DATA;
  for (const spec of chain) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), spec.timeoutMs);
    const t0 = Date.now();
    try {
      let rawText = "";
      let modelUsed = spec.id;
      if (spec.format === "responses") {
        const parts: any[] = images.map((img) => ({ type: "input_image", image_url: toDataUrl(img.mimeType, img.data) }));
        parts.push({ type: "input_text", text: body.prompt });
        const res = await fetch("https://opencode.ai/inference/go/openai/v1/responses", {
          method: "POST",
          headers: headers(),
          signal: controller.signal,
          body: JSON.stringify({
            model: spec.id,
            instructions: body.systemInstruction,
            input: [{ role: "user", content: parts }],
            reasoning: { effort: spec.effort },
            text: { format: { type: "json_object" } },
          }),
        });
        if (!res.ok) throw new Error(`${spec.id} HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
        const dataJson = (await res.json()) as any;
        rawText = dataJson.output_text || "";
        if (!rawText && Array.isArray(dataJson.output)) {
          rawText = dataJson.output.flatMap((o: any) => (o.type === "message" ? (o.content || []).map((c: any) => c.text || "") : [])).join("");
        }
      } else {
        const userContent: any[] = images.map((img) => ({ type: "image_url", image_url: { url: toDataUrl(img.mimeType, img.data) } }));
        userContent.push({ type: "text", text: body.prompt });
        const payload: any = {
          model: spec.id,
          reasoning_effort: spec.effort,
          messages: [
            { role: "system", content: body.systemInstruction },
            { role: "user", content: userContent },
          ],
        };
        if (spec.structured) payload.response_format = { type: "json_object" };
        const res = await fetch("https://opencode.ai/inference/go/openai/v1/chat/completions", {
          method: "POST",
          headers: headers(),
          signal: controller.signal,
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`${spec.id} HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
        const dataJson = (await res.json()) as any;
        rawText = dataJson.choices?.[0]?.message?.content ?? "";
      }
      if (!rawText.trim()) throw new Error(`${spec.id} empty response`);
      // Validate JSON but return raw text for client-side parsing (preserves existing safeParseJson)
      cleanJson(rawText);
      telemetry(context, db, { endpoint: "opencode/generate", model: modelUsed, latencyMs: Date.now() - t0, ok: true, uid });
      return new Response(JSON.stringify({ text: rawText, model: modelUsed }), { status: 200, headers: { ...cors, "X-Model-Used": modelUsed } });
    } catch (e: any) {
      lastError = e?.message || String(e);
      console.warn(`[opencode/generate] ${spec.id} failed:`, lastError);
      telemetry(context, db, { endpoint: "opencode/generate", model: spec.id, latencyMs: Date.now() - t0, ok: false, error: lastError.slice(0, 300), uid });
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return new Response(JSON.stringify({ error: "All OpenCode Go models failed", message: lastError }), { status: 502, headers: cors });
}

export const onRequestPost = onRequest;

