export async function onRequest(context: { env: any; request: Request }) {
  const { env, request } = context;

  // CORS headers following the pattern used in other Pages Functions
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-goog-api-key',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // Extract path for Google API
  const path = url.pathname.replace(/^\/api\/gemini/, '');
  if (!path || path === '/') {
    return new Response(JSON.stringify({ error: 'Missing path' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const googleUrl = new URL(`https://generativelanguage.googleapis.com${path}`);

  // Copy all existing query parameters
  url.searchParams.forEach((v, k) => {
    if (k !== 'key') googleUrl.searchParams.set(k, v);
  });

  // Inject the API key from backend environment
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not found in backend environment');
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured in backend' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
  googleUrl.searchParams.set('key', apiKey);

  // Prepare headers for forwarding
  const headers = new Headers(request.headers);
  headers.delete('host');

  // Always set x-goog-api-key to the backend API key to replace any placeholder value
  headers.set('x-goog-api-key', apiKey);

  try {
    const response = await fetch(googleUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      // @ts-ignore
      duplex: 'half',
    });

    // Forward the response, including status and headers
    // This correctly handles streaming responses (SSE) for Gemini
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error: any) {
    console.error('Gemini Proxy Error:', error);
    return new Response(JSON.stringify({ error: 'Proxy Error', message: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
