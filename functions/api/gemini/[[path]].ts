export async function onRequest(context: { env: any; request: Request }) {
  const { env, request } = context;
  const url = new URL(request.url);

  // Extract path for Google API
  const path = url.pathname.replace(/^\/api\/gemini/, '');
  if (!path || path === '/') {
    return new Response(JSON.stringify({ error: 'Missing path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
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
      headers: { 'Content-Type': 'application/json' }
    });
  }
  googleUrl.searchParams.set('key', apiKey);

  // Prepare headers for forwarding
  const headers = new Headers(request.headers);
  headers.delete('host');

  // Ensure x-goog-api-key header is also set if used
  if (headers.has('x-goog-api-key')) {
    headers.set('x-goog-api-key', apiKey);
  }

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
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
