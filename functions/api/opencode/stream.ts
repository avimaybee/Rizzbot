function toOpenAIMessages(contents: any, systemInstruction: string): any[] {
  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
  const arr = Array.isArray(contents) ? contents : [{ role: "user", parts: [{ text: String(contents) }] }];
  for (const item of arr) {
    const role = item.role === "model" ? "assistant" : item.role || "user";
    const parts = item.parts || [];
    const content: any[] = [];
    for (const p of parts) {
      if (typeof p.text === "string" && p.text) content.push({ type: "text", text: p.text });
      else if (p.inlineData?.data) {
        content.push({ type: "image_url", image_url: { url: `data:${p.inlineData.mimeType || "image/webp"};base64,${p.inlineData.data}` } });
      }
    }
    if (content.length === 1 && content[0].type === "text") {
      messages.push({ role, content: content[0].text });
    } else if (content.length > 0) {
      messages.push({ role, content });
    }
  }
  return messages;
}

function toOpenAITools(tools: any[]): any[] {
  if (!Array.isArray(tools)) return [];
  return tools.filter(Boolean).map((t: any) => {
    // Already OpenAI format
    if (t.type === "function" && t.function) return t;
    // Gemini FunctionDeclaration: { name, description, parameters }
    const params = t.parameters || {};
    // Convert Type enum values (may be numeric) — pass through; OpenAI ignores unknown, but map common
    const convert = (node: any): any => {
      if (!node || typeof node !== "object") return node;
      if (Array.isArray(node)) return node.map(convert);
      const out: any = { ...node };
      if (typeof out.type === "number") {
        const map: Record<number, string> = { 1: "string", 2: "number", 3: "integer", 4: "boolean", 5: "array", 6: "object" };
        out.type = map[out.type] || "string";
      }
      if (out.type && typeof out.type === "string") out.type = out.type.toLowerCase().replace("type_", "");
      if (out.properties) {
        const props: any = {};
        for (const [k, v] of Object.entries(out.properties)) props[k] = convert(v);
        out.properties = props;
      }
      if (out.items) out.items = convert(out.items);
      return out;
    };
    return {
      type: "function",
      function: {
        name: t.name,
        description: t.description || "",
        parameters: convert(params),
      },
    };
  }).filter((t) => t.function?.name);
}

export async function onRequest(context: any) {
  const { env, request, data } = context;
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const apiKey = (env as any).OPENCODE_GO_API_KEY as string | undefined;
  if (!apiKey) return new Response(JSON.stringify({ error: "OPENCODE_GO_API_KEY missing" }), { status: 500, headers: cors });

  const uid = (data?.user?.uid as string) || "anon";
  const body = (await request.json().catch(() => ({}))) as any;
  const { contents, systemInstruction, tools } = body;

  const messages = toOpenAIMessages(contents, systemInstruction || "");
  const openAITools = toOpenAITools(tools || []);

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const send = async (obj: any) => {
    try {
      await writer.write(encoder.encode(JSON.stringify(obj) + "\n"));
    } catch { /* client gone */ }
  };

  (async () => {
    const chain = [
      { id: "deepseek-v4.1-flash", timeoutMs: 90_000 },
      { id: "hy4-flash-free", timeoutMs: 90_000 },
    ];
    let started = false;
    let lastError = "";
    for (const spec of chain) {
      try {
        await send({ type: "metadata", model: spec.id });
        const headers = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "Rizzbot/1.0",
          "x-opencode-session": `rizzbot-stream-${uid}-${Date.now()}`,
        };
        const res = await fetch("https://opencode.ai/inference/go/openai/v1/chat/completions", {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: spec.id,
            reasoning_effort: "high",
            stream: true,
            messages,
            ...(openAITools.length > 0 ? { tools: openAITools, tool_choice: "auto" } : {}),
          }),
        });
        if (!res.ok || !res.body) throw new Error(`${spec.id} HTTP ${res.status}`);
        started = true;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        // Accumulate tool calls by index
        const toolAcc = new Map<number, { name: string; argsText: string }>();

        const flushToolCalls = async () => {
          if (toolAcc.size === 0) return;
          const calls: Array<{ name: string; args: any }> = [];
          for (const [, entry] of [...toolAcc.entries()].sort((a, b) => a[0] - b[0])) {
            try {
              calls.push({ name: entry.name, args: entry.argsText ? JSON.parse(entry.argsText) : {} });
            } catch {
              calls.push({ name: entry.name, args: {} });
            }
          }
          await send({ type: "functionCalls", calls });
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            const t = line.trim();
            if (!t || !t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") continue;
            let evt: any;
            try { evt = JSON.parse(payload); } catch { continue; }
            const delta = evt.choices?.[0]?.delta || {};
            if (typeof delta.content === "string" && delta.content) {
              await send({ type: "text", content: delta.content });
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = typeof tc.index === "number" ? tc.index : 0;
                const cur = toolAcc.get(idx) || { name: "", argsText: "" };
                if (tc.function?.name) cur.name = tc.function.name;
                if (typeof tc.function?.arguments === "string") cur.argsText += tc.function.arguments;
                toolAcc.set(idx, cur);
              }
            }
            if (evt.choices?.[0]?.finish_reason === "tool_calls") {
              // will flush after stream ends
            }
          }
        }
        // flush remaining buffer line
        if (buf.trim().startsWith("data:")) {
          try {
            const payload = buf.trim().slice(5).trim();
            if (payload && payload !== "[DONE]") {
              const evt = JSON.parse(payload);
              const delta = evt.choices?.[0]?.delta || {};
              if (typeof delta.content === "string" && delta.content) await send({ type: "text", content: delta.content });
            }
          } catch { /* ignore */ }
        }
        await flushToolCalls();
        await writer.close().catch(() => {});
        return;
      } catch (e: any) {
        lastError = e?.message || String(e);
        console.warn(`[opencode/stream] ${spec.id} failed:`, lastError);
        if (started) {
          await send({ type: "error", message: `Stream interrupted (${spec.id}): ${lastError}` });
          await writer.close().catch(() => {});
          return;
        }
        continue;
      }
    }
    await send({ type: "error", message: "All OpenCode Go stream models failed", details: lastError });
    await writer.close().catch(() => {});
  })();

  return new Response(readable, { status: 200, headers: cors });
}

export const onRequestPost = onRequest;
