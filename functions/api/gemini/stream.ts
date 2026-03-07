import { GoogleGenAI } from "@google/genai";

export async function onRequest(context: { env: any; request: Request; data?: any }) {
  const { env, request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
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

  const ai = new GoogleGenAI({ apiKey });
  const body = await request.json() as any;
  const { modelChain, contents, systemInstruction, tools, safetySettings } = body;

  const MODELS = modelChain || ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"];

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const sendChunk = async (data: any) => {
    try {
      await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
    } catch (e) {
      console.error("Error writing to stream:", e);
    }
  };

  // Background execution for the fallback logic
  (async () => {
    let lastError: any = null;
    let streamStarted = false;
    
    // Create a mutable history that we can append to if the model asks for tool calls.
    const currentHistory = Array.isArray(contents) ? [...contents] : [{ role: "user", parts: [{ text: String(contents) }] }];

    for (const modelId of MODELS) {
      try {
        const config: any = {};
        if (modelId.startsWith("gemini-3")) {
          config.thinkingConfig = { thinkingLevel: "HIGH" };
        } else if (modelId.startsWith("gemini-2.5")) {
          // Gemini 2.5 uses an exact token budget instead of High/Low levels
          config.thinkingConfig = { thinkingBudget: 4096 };
        }

        let generationFinished = false;

        // Loop handles the case where Gemini returns a functionCall and waits for a response
        while (!generationFinished) {
          const result = await ai.models.generateContentStream({
            model: modelId,
            contents: currentHistory,
            config: {
              ...config,
              systemInstruction,
              safetySettings,
              tools: tools ? [{ functionDeclarations: tools }] : undefined,
            }
          });

          let currentFunctionCalls: any[] = [];

          for await (const chunk of result) {
            if (!streamStarted) {
              await sendChunk({ type: "metadata", model: modelId });
              streamStarted = true;
            }

            const text = chunk.text;
            if (text) {
              await sendChunk({ type: "text", content: text });
            }

            const functionCalls = chunk.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              currentFunctionCalls.push(...functionCalls);
              await sendChunk({ type: "functionCalls", calls: functionCalls });
            }
          }

          if (currentFunctionCalls.length > 0) {
            // Reconstruct the history with the model's call and our auto-injected response
            currentHistory.push({
              role: "model",
              parts: currentFunctionCalls.map((fc: any) => ({ functionCall: fc }))
            });
            
            currentHistory.push({
              role: "user",
              parts: currentFunctionCalls.map((fc: any) => ({
                functionResponse: {
                  name: fc.name,
                  response: { status: "recorded" }
                }
              }))
            });
            // Let the while loop cycle naturally so the model can finish its thought based on our response
          } else {
            // Normal text completion
            generationFinished = true;
          }
        }

        await writer.close();
        return; 
      } catch (err: any) {
        lastError = err;
        console.error(`Stream error with ${modelId}:`, err);

        const isQuotaError = err?.status === 429 || String(err?.message).toLowerCase().includes("quota") || String(err?.message).toLowerCase().includes("resource_exhausted");
        const isOverloaded = err?.status === 503 || String(err?.message).toLowerCase().includes("overloaded") || String(err?.message).toLowerCase().includes("unavailable");

        if (!streamStarted && (isQuotaError || isOverloaded)) {
          continue; 
        }

        await sendChunk({ type: "error", message: err.message, status: err.status });
        break;
      }
    }

    if (!streamStarted) {
       await sendChunk({ type: "error", message: "All fallback models failed.", details: lastError?.message });
    }
    try {
      await writer.close();
    } catch (e) {}
  })().catch(err => {
    console.error("Unhandled stream error:", err);
    try {
      writer.abort(err);
    } catch (e) {}
  });

  const modelHeader = MODELS[0];
  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'X-Model-Used': modelHeader, 
    },
  });
}
