import { base64ToBytes } from "../lib/json";
import { corsHeadersFor } from "../lib/cors";

export async function onRequest(context: any) {
  const { env, request, data } = context;

  const corsHeaders: Record<string, string> = {
    ...corsHeadersFor(request),
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authenticatedUser = data?.user;
  if (!authenticatedUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized: No verified user context' }), {
      status: 401,
      headers: corsHeaders,
    });
  }
  const uid = authenticatedUser.uid as string;

  const bucket = (env as any).RIZZBOT_MEDIA;
  if (!bucket) {
    return new Response(JSON.stringify({ error: 'RIZZBOT_MEDIA bucket binding not configured' }), {
      status: 503,
      headers: corsHeaders,
    });
  }

  const MAX_UPLOAD_IMAGES = 10;
  const MAX_SINGLE_IMAGE_BYTES = 2 * 1024 * 1024;

  const stripR2Prefix = (rawKey: string): string =>
    rawKey.startsWith('r2:') ? rawKey.slice(3) : rawKey;

  const isOwnedKey = (cleanKey: string, userId: string): boolean => {
    if (!userId || cleanKey.includes('..')) return false;
    return cleanKey.startsWith(`quick/${userId}/`);
  };

  const base64ToUint8Array = (base64: string): Uint8Array => base64ToBytes(base64);

  if (request.method === 'POST') {
    let body: { images?: Array<{ data: string; mimeType?: string }> };
    try {
      body = (await request.json()) as { images?: Array<{ data: string; mimeType?: string }> };
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const images = Array.isArray(body.images) ? body.images.slice(0, MAX_UPLOAD_IMAGES) : [];
    if (images.length === 0) {
      return new Response(JSON.stringify({ keys: [] }), { status: 200, headers: corsHeaders });
    }

    const now = Date.now();
    const keys: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img || typeof img.data !== 'string' || !img.data.trim()) continue;

      const bytes = base64ToUint8Array(img.data);
      if (bytes.byteLength > MAX_SINGLE_IMAGE_BYTES) {
        return new Response(
          JSON.stringify({ error: `Image at index ${i} exceeds 2MB compressed limit` }),
          { status: 413, headers: corsHeaders }
        );
      }

      const mimeType =
        img.mimeType === 'image/png' || img.mimeType === 'image/jpeg' || img.mimeType === 'image/webp'
          ? img.mimeType
          : 'image/webp';
      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'webp';
      const rand = crypto.randomUUID().slice(0, 8);
      const objectKey = `quick/${uid}/${now}-${i}-${rand}.${ext}`;

      await bucket.put(objectKey, bytes, {
        httpMetadata: {
          contentType: mimeType,
          cacheControl: 'private, max-age=31536000, immutable',
        },
      });

      keys.push(`r2:${objectKey}`);
    }

    return new Response(JSON.stringify({ keys }), { status: 200, headers: corsHeaders });
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const rawKey = url.searchParams.get('key') || '';
    const cleanKey = stripR2Prefix(rawKey);

    if (!isOwnedKey(cleanKey, uid)) {
      return new Response(JSON.stringify({ error: 'Forbidden: invalid or unowned media key' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const obj = await bucket.get(cleanKey);
    if (!obj) {
      return new Response(JSON.stringify({ error: 'Media object not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const headers = new Headers();
    if (typeof obj.writeHttpMetadata === 'function') {
      obj.writeHttpMetadata(headers);
    }
    if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'image/webp');
    }
    headers.set('Cache-Control', 'private, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(obj.body, { status: 200, headers });
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const rawKey = url.searchParams.get('key') || '';
    const cleanKey = stripR2Prefix(rawKey);

    if (!isOwnedKey(cleanKey, uid)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    await bucket.delete(cleanKey);
    return new Response(JSON.stringify({ deleted: cleanKey }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: corsHeaders,
  });
}

