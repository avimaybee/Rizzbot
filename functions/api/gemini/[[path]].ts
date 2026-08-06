export async function onRequest(context: { env: any; request: Request; data?: any }) {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // This generic Gemini proxy was an open reverse proxy to the Gemini API
  // (any authenticated user could call arbitrary models on the shared key).
  // All legitimate traffic goes through /api/gemini/generate and /api/gemini/stream.
  return new Response(JSON.stringify({ error: 'Direct Gemini proxy is disabled.' }), {
    status: 403,
    headers: corsHeaders,
  });
}
