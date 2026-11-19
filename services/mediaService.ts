import { getFirebaseToken } from './firebaseService';
import { isR2MediaKey } from '../app/utils/imageOptimize';

const blobUrlCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();

export interface UploadableImage {
  data: string;
  mimeType: string;
}

/**
 * Uploads 1-10 compressed screenshots to Cloudflare R2 (/api/media).
 * If R2 is unavailable in local dev (503) or network fails, gracefully falls back
 * to data URLs so history saving never crashes.
 */
export async function uploadQuickImagesToR2(
  images: UploadableImage[]
): Promise<string[]> {
  if (images.length === 0) return [];

  try {
    const token = await getFirebaseToken();
    const res = await fetch('/api/media', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: images.slice(0, 10).map((img) => ({
          data: img.data,
          mimeType: img.mimeType,
        })),
      }),
    });

    if (!res.ok) {
      throw new Error(`R2 upload returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as { keys?: string[] };
    if (Array.isArray(data.keys) && data.keys.length === images.length) {
      return data.keys;
    }
    throw new Error('R2 upload returned mismatched key count');
  } catch (err) {
    console.warn('[mediaService] Falling back to inline data URLs for session storage:', err);
    return images.map((img) =>
      img.data.startsWith('data:') ? img.data : `data:${img.mimeType || 'image/webp'};base64,${img.data}`
    );
  }
}

/**
 * Resolves either an R2 key ("r2:quick/uid/...") or a legacy base64 string into a renderable img src.
 */
export async function resolveMediaUrl(srcOrKey: string): Promise<string> {
  if (!srcOrKey) return '';

  if (!isR2MediaKey(srcOrKey)) {
    if (srcOrKey.startsWith('data:') || srcOrKey.startsWith('blob:') || srcOrKey.startsWith('http')) {
      return srcOrKey;
    }
    return `data:image/jpeg;base64,${srcOrKey}`;
  }

  const cached = blobUrlCache.get(srcOrKey);
  if (cached) return cached;

  const existingInflight = inflightRequests.get(srcOrKey);
  if (existingInflight) return existingInflight;

  const promise = (async () => {
    try {
      const token = await getFirebaseToken();
      const res = await fetch(`/api/media?key=${encodeURIComponent(srcOrKey)}`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        throw new Error(`GET /api/media failed (${res.status})`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      blobUrlCache.set(srcOrKey, objectUrl);
      return objectUrl;
    } finally {
      inflightRequests.delete(srcOrKey);
    }
  })();

  inflightRequests.set(srcOrKey, promise);
  return promise;
}

export function revokeCachedMediaUrls(): void {
  for (const url of blobUrlCache.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
  blobUrlCache.clear();
}
