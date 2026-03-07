import { GoogleGenAI } from "@google/genai";

export async function onRequest(context: { env: any; request: Request; data?: any }) {
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

  const ai = new GoogleGenAI({ apiKey });
  const body = await request.json() as any;
  const { modelChain, contents, systemInstruction, tools, safetySettings, config: incomingConfig } = body;

  const MODELS = modelChain || ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"];

  let lastError: any = null;

  for (const modelId of MODELS) {
    try {
      const config: any = { ...incomingConfig };
      if (modelId.startsWith("gemini-3")) {
        config.thinkingConfig = { thinkingLevel: "HIGH" };
      } else if (modelId.startsWith("gemini-2.5")) {
        config.thinkingConfig = { thinkingBudget: 4096 };
      }

      const response = await ai.models.generateContent({
        model: modelId,
        contents,
        config: {
          ...config,
          systemInstruction,
          safetySettings,
          tools: tools ? [{ functionDeclarations: tools }] : undefined,
        }
      });
      
      return new Response(JSON.stringify({
        text: response.text,
        functionCalls: response.functionCalls,
        model: modelId
      }), {
        headers: {
          ...corsHeaders,
          'X-Model-Used': modelId
        }
      });
    } catch (err: any) {
      lastError = err;
      console.error(`Generation error with ${modelId}:`, err);

      const isQuotaError = err?.status === 429 || String(err?.message).toLowerCase().includes("quota") || String(err?.message).toLowerCase().includes("resource_exhausted");
      const isOverloaded = err?.status === 503 || String(err?.message).toLowerCase().includes("overloaded") || String(err?.message).toLowerCase().includes("unavailable");

      if (isQuotaError || isOverloaded) {
        continue;
      }

      break;
    }
  }

  return new Response(JSON.stringify({ 
    error: "All fallback models failed.", 
    message: lastError?.message,
    status: lastError?.status 
  }), { 
    status: lastError?.status || 500, 
    headers: corsHeaders 
  });
}
