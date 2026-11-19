# Plan 011 — Quick Mode Cloudflare R2 Media Storage & 10-Screenshot WebP Pipeline

> **Before you start — drift check.** This plan was written against commit `c7728b1` (`main`). Before touching anything, run:
>
> ```bash
> git log --oneline c7728b1..HEAD -- wrangler.toml functions/api/sessions.ts services/dbService.ts app/components/QuickModeScreen.tsx app/components/HistoryScreen.tsx
> ```
>
> If any of those files changed since `c7728b1`, **STOP and read the diff** before applying edits. All symbol names and line numbers below are verified against `c7728b1`.

## Status

- **Priority**: P0 (eliminates multi-megabyte base64 bloat in D1 `sessions.result` JSON and `sessionStorage`, and unlocks 1–10 screenshot uploads in Quick Mode)
- **Effort**: ~3–4 hours
- **Depends on**: Plan 010 (`/api/opencode/quick` accepting up to 10 screenshots)
- **Risk**: Low-Medium (adds Cloudflare R2 binding `RIZZBOT_MEDIA` and authenticated `/api/media` endpoint; retains transparent fallback for legacy base64 D1 rows and offline local dev)

---

## Why this matters

Currently, Quick Mode (`app/components/QuickModeScreen.tsx:78-90, 106, 165-184, 233-270`) and D1 history (`functions/api/sessions.ts:109-164`, `app/components/HistoryScreen.tsx:51-55, 231-256`) handle screenshots in a fragile, unscalable way:

1. **Hard 3-Screenshot Cap & Uncompressed Raw File Data URLs**:
   - `QuickModeScreen.tsx:168` hardcodes `const remainingSlots = 3 - screenshots.length;`.
   - `toDataUrl(file)` (`QuickModeScreen.tsx:78-90`) reads the raw uncompressed `File` via `reader.readAsDataURL(file)` without resizing or WebP compression! Ten modern iPhone screenshots (3–6MB each as PNG) would exceed 40MB of raw base64.
2. **`sessionStorage` Crash (`useSessionState` on `quick_screenshots`)**:
   - `QuickModeScreen.tsx:106` stores `screenshots` in `sessionStorage` via `useSessionState<string[]>("quick_screenshots", [], authUser?.uid)`.
   - Browsers enforce a strict ~5MB `sessionStorage` ceiling per origin; uploading 4–10 screenshots overflows `sessionStorage` or bloats memory. Keeping `screenshots` in React `useState<string[]>([])` (while keeping `theirMessage`, `yourDraft`, and `context` in `useSessionState`) prevents `sessionStorage` overflow.
3. **Multi-Megabyte Base64 Bloat Inside D1 `sessions.result` JSON**:
   - `QuickModeScreen.tsx:233-245` passes `request: { screenshots, theirMessage, yourDraft, context }` into `createSession(authUser.uid, { request, response, ... })`, which stores the entire JSON object inside the D1 `sessions.result` `TEXT` column (`functions/api/sessions.ts:124, 134`).
   - By uploading the compressed WebP screenshots to Cloudflare R2 (`RIZZBOT_MEDIA`) via `POST /api/media` before calling `createSession`, `request.screenshots` in D1 stores tiny 45-byte R2 keys (`["r2:quick/uid/1795000000-0-a1b2c3.webp"]`) instead of megabytes of base64!
4. **Authenticated `<img>` Tag Pitfall**:
   - Because `functions/api/_middleware.ts:90-163` requires `Authorization: Bearer <Firebase ID Token>` on every `/api/*` request (and sets `context.data.user.uid`), rendering `<img src="/api/media?key=..." />` directly in JSX would fail with **HTTP 401 Unauthorized**.
   - We need `<R2Image srcOrKey={...} />` backed by `services/mediaService.ts` (using `getFirebaseToken()` from `services/firebaseService.ts`) that fetches `r2:...` keys with the Bearer header, caches `URL.createObjectURL(blob)` in memory, and renders legacy `data:image/...` or raw base64 strings directly without network requests.

---

## Current state (verified at `c7728b1`)

1. **`wrangler.toml:1-17`**:
   - Binds D1 database `RIZZBOT_DATA` (`database_name = "rizzbot"`). Has **no** `[[r2_buckets]]` binding yet.
2. **`functions/api/_middleware.ts:153-159`**:
   - Injects `context.data.user = { uid: decodedToken.sub, email: ..., ... }`.
3. **`functions/api/sessions.ts:109-164`**:
   - `POST /api/sessions` stores `body.result` (JSON string containing `request.screenshots` or `screenshots`) in `sessions.result`.
   - `DELETE /api/sessions?id=...` deletes `FROM sessions WHERE id = ? AND user_id = ?` without cleaning up any R2 objects referenced inside `sessions.result`.
4. **`app/components/QuickModeScreen.tsx:78-90, 106, 165-184, 233-270, 493`**:
   - `toDataUrl` reads uncompressed files; `handleUpload` limits to `3 - screenshots.length`; line 493 says `"1–3 images supported"`; `createSession` writes raw `screenshots` base64 strings into D1.
5. **`app/components/HistoryScreen.tsx:51-55, 239-254`**:
   - `getScreenshots(session)` reads `session.parsedResult?.request?.screenshots || session.parsedResult?.screenshots || []`.
   - Lines 241–252 render `<img src={screenshot.startsWith("data:") ? screenshot : \`data:image/png;base64,\${screenshot}\`} />`.

---

## Scope

### Files to create
1. `functions/api/media.ts` — Authenticated Cloudflare Pages Function handling `POST /api/media` (upload up to 10 compressed WebP/JPEG images to `env.RIZZBOT_MEDIA` under `quick/${verifiedUid}/${timestamp}-${idx}-${rand}.webp`), `GET /api/media?key=...` (verify `cleanKey.startsWith(\`quick/\${verifiedUid}/\`)` and stream object), and `DELETE /api/media?key=...`.
2. `app/utils/imageOptimize.ts` — Client-side image resizer & WebP compressor (`MAX_QUICK_SCREENSHOTS = 10`, `MAX_IMAGE_DIMENSION = 1280`, `WEBP_QUALITY = 0.80` with JPEG `0.82` fallback, returning a `data:image/webp;base64,...` data URL).
3. `app/utils/imageOptimize.test.ts` — Unit tests for `calculateScaledDimensions`, `isR2MediaKey`, and `clampScreenshotList`.
4. `services/mediaService.ts` — Frontend R2 helper using `getFirebaseToken()` from `./firebaseService` (`uploadScreenshotsToR2(dataUrls: string[]): Promise<string[]>`, `resolveMediaUrl(srcOrKey: string): Promise<string>`).
5. `app/components/ui/R2Image.tsx` — Drop-in `<R2Image srcOrKey={...} style={...} className={...} />` component that resolves `r2:quick/...` keys via `resolveMediaUrl()` and renders legacy base64/data-URL strings directly.

### Files to modify
1. `wrangler.toml` — Add `[[r2_buckets]]` binding (`binding = "RIZZBOT_MEDIA"`, `bucket_name = "rizzbot-media"`).
2. `functions/api/sessions.ts` — In `DELETE /api/sessions?id=...` (lines 142–164), query `SELECT result FROM sessions WHERE id = ? AND user_id = ?` before deleting the row, extract any `r2:quick/${verifiedUid}/...` keys from `parsed.request?.screenshots` / `parsed.screenshots`, and delete them from `env.RIZZBOT_MEDIA` (best-effort).
3. `app/components/QuickModeScreen.tsx` —
   - Change `screenshots` from `useSessionState<string[]>("quick_screenshots", ...)` to `useState<string[]>([])` (and remove any stale `"quick_screenshots"` key from `sessionStorage`) so 10 screenshots never overflow `sessionStorage`.
   - Replace `toDataUrl` with `optimizeImageFileToDataUrl` from `../utils/imageOptimize`.
   - Raise upload cap from `3` to `MAX_QUICK_SCREENSHOTS` (`10`) and add clipboard paste (`onPaste`) support so users can paste screenshots directly.
   - Before `createSession` (lines 233–270), call `const storedScreenshots = await uploadScreenshotsToR2(screenshots)` so D1 stores `r2:quick/...` keys (automatically falling back to the compressed WebP data URLs if R2 is not bound in local dev).
4. `app/components/HistoryScreen.tsx` — Replace `<img src={screenshot...} />` on lines 241–252 with `<R2Image srcOrKey={screenshot} ... />`.

---

## Step-by-Step Implementation Instructions

### Step 1: Update `wrangler.toml`

When deploying to Cloudflare, create the R2 bucket once (`npx wrangler r2 bucket create rizzbot-media`) and add the binding to `wrangler.toml`:

```toml
name = "deadorghosting"
pages_build_output_dir = "dist"
compatibility_date = "2024-11-01"

[[d1_databases]]
binding = "RIZZBOT_DATA"
database_name = "rizzbot"
database_id = "2fbdfbe8-f878-4ffe-a224-c7ec0ea47371"

[[r2_buckets]]
binding = "RIZZBOT_MEDIA"
bucket_name = "rizzbot-media"
```

---

### Step 2: Create `functions/api/media.ts`

Create `functions/api/media.ts`. Note how `functions/api/_middleware.ts:153` attaches the verified user at `context.data.user.uid`:

```ts
const MAX_UPLOAD_IMAGES = 10;
const MAX_SINGLE_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB per compressed WebP screenshot

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function stripR2Prefix(rawKey: string): string {
  return rawKey.startsWith("r2:") ? rawKey.slice(3) : rawKey;
}

function isOwnedKey(cleanKey: string, uid: string): boolean {
  if (!uid || cleanKey.includes("..")) return false;
  return cleanKey.startsWith(`quick/${uid}/`);
}

function parseDataUrlOrBase64(input: string): { bytes: Uint8Array; mimeType: string } {
  let mimeType = "image/webp";
  let cleanBase64 = input;
  const match = input.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    cleanBase64 = match[2];
  }
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { bytes, mimeType };
}

export async function onRequest(context: { env: any; request: Request; data?: any }) {
  const { env, request, data } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const verifiedUid = data?.user?.uid as string | undefined;
  if (!verifiedUid) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const bucket = env.RIZZBOT_MEDIA;
  if (!bucket) {
    return new Response(JSON.stringify({ error: "RIZZBOT_MEDIA binding not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);

  if (request.method === "POST") {
    let body: { images?: string[] };
    try {
      body = (await request.json()) as { images?: string[] };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const images = Array.isArray(body.images) ? body.images.slice(0, MAX_UPLOAD_IMAGES) : [];
    if (images.length === 0) {
      return new Response(JSON.stringify({ keys: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    const keys: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const item = images[i];
      if (typeof item !== "string" || !item.trim()) continue;
      if (item.startsWith(`r2:quick/${verifiedUid}/`)) {
        keys.push(item);
        continue;
      }

      const { bytes, mimeType } = parseDataUrlOrBase64(item);
      if (bytes.byteLength > MAX_SINGLE_IMAGE_BYTES) {
        return new Response(
          JSON.stringify({ error: `Image ${i + 1} exceeds 2MB compressed limit` }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ext = mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp";
      const rand = crypto.randomUUID().slice(0, 8);
      const objectKey = `quick/${verifiedUid}/${now}-${i}-${rand}.${ext}`;

      await bucket.put(objectKey, bytes, {
        httpMetadata: {
          contentType: mimeType,
          cacheControl: "private, max-age=31536000, immutable",
        },
      });

      keys.push(`r2:${objectKey}`);
    }

    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (request.method === "GET") {
    const rawKey = url.searchParams.get("key") || "";
    const cleanKey = stripR2Prefix(rawKey);

    if (!isOwnedKey(cleanKey, verifiedUid)) {
      return new Response(JSON.stringify({ error: "Forbidden: invalid or unowned media key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const obj = await bucket.get(cleanKey);
    if (!obj) {
      return new Response(JSON.stringify({ error: "Media not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = new Headers(corsHeaders);
    if (typeof obj.writeHttpMetadata === "function") {
      obj.writeHttpMetadata(headers);
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "image/webp");
    }
    headers.set("Cache-Control", "private, max-age=31536000, immutable");
    return new Response(obj.body, { status: 200, headers });
  }

  if (request.method === "DELETE") {
    const rawKey = url.searchParams.get("key") || "";
    const cleanKey = stripR2Prefix(rawKey);

    if (!isOwnedKey(cleanKey, verifiedUid)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await bucket.delete(cleanKey);
    return new Response(JSON.stringify({ deleted: cleanKey }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

---

### Step 3: Clean Up R2 Objects on Session Deletion (`functions/api/sessions.ts:142-164`)

In `functions/api/sessions.ts`, inside `if (request.method === 'DELETE')` (lines 142–164), before executing `DELETE FROM sessions WHERE id = ? AND user_id = ?`, query the session's `result` JSON string and delete any owned `r2:quick/${verifiedUid}/...` keys from `env.RIZZBOT_MEDIA`:

```ts
    if (request.method === 'DELETE') {
      const sessionId = url.searchParams.get('id');
      if (!sessionId) {
        return new Response(JSON.stringify({ error: 'Session ID required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const existing = await db
        .prepare('SELECT result FROM sessions WHERE id = ? AND user_id = ?')
        .bind(parseInt(sessionId), dbUserId)
        .first();

      const run = await db
        .prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
        .bind(parseInt(sessionId), dbUserId)
        .run();

      if (run.meta?.changes === 0) {
        return new Response(JSON.stringify({ error: 'Session not found or forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      // Best-effort R2 media cleanup for screenshots stored in session.result
      if (env.RIZZBOT_MEDIA && existing?.result && typeof existing.result === 'string') {
        try {
          const parsed = JSON.parse(existing.result);
          const candidateLists = [
            parsed?.request?.screenshots,
            parsed?.screenshots,
          ];
          const r2Keys: string[] = [];
          for (const list of candidateLists) {
            if (Array.isArray(list)) {
              for (const item of list) {
                if (typeof item === 'string' && item.startsWith(`r2:quick/${verifiedUid}/`)) {
                  r2Keys.push(item.slice(3));
                }
              }
            }
          }
          if (r2Keys.length > 0) {
            await env.RIZZBOT_MEDIA.delete(r2Keys);
          }
        } catch (cleanupErr) {
          console.warn('[sessions.ts] Best-effort R2 cleanup failed:', cleanupErr);
        }
      }

      return new Response(JSON.stringify({ success: run.success }), {
        headers: corsHeaders,
      });
    }
```

---

### Step 4: Create `app/utils/imageOptimize.ts` & `app/utils/imageOptimize.test.ts`

Create `app/utils/imageOptimize.ts`:

```ts
export const MAX_QUICK_SCREENSHOTS = 10;
export const MAX_IMAGE_DIMENSION = 1280;
export const WEBP_QUALITY = 0.80;

export function calculateScaledDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_IMAGE_DIMENSION
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: maxDimension, height: maxDimension };
  }
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  if (width >= height) {
    return {
      width: maxDimension,
      height: Math.max(1, Math.round((height * maxDimension) / width)),
    };
  }
  return {
    width: Math.max(1, Math.round((width * maxDimension) / height)),
    height: maxDimension,
  };
}

export function isR2MediaKey(value: string): boolean {
  return typeof value === "string" && (value.startsWith("r2:quick/") || value.startsWith("quick/"));
}

export function clampScreenshotList<T>(
  existing: T[],
  incoming: T[],
  max: number = MAX_QUICK_SCREENSHOTS
): T[] {
  return [...existing, ...incoming].slice(0, max);
}

/**
 * Resizes an image File to <= 1280px on its longest edge and encodes as WebP (0.80)
 * (with JPEG 0.82 fallback). Returns a full `data:image/webp;base64,...` data URL
 * so it drops directly into `screenshots: string[]` in QuickModeScreen.
 */
export function optimizeImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to read file as data URL"));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        const { width, height } = calculateScaledDimensions(img.width, img.height, MAX_IMAGE_DIMENSION);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL("image/webp", WEBP_QUALITY);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
```

Create `app/utils/imageOptimize.test.ts` with `bun:test` unit tests covering `calculateScaledDimensions`, `isR2MediaKey`, and `clampScreenshotList`.

---

### Step 5: Create `services/mediaService.ts` & `app/components/ui/R2Image.tsx`

#### 5A. Create `services/mediaService.ts` (uses `getFirebaseToken` from `./firebaseService`)

```ts
import { getFirebaseToken } from "./firebaseService";
import { isR2MediaKey } from "../app/utils/imageOptimize";

const blobUrlCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();

/**
 * Uploads 1-10 compressed screenshot data URLs to Cloudflare R2 (/api/media).
 * Returns an array of `r2:quick/<uid>/...` keys for D1 session storage.
 * Falls back to the compressed data URLs if R2 is unavailable in local dev.
 */
export async function uploadScreenshotsToR2(dataUrls: string[]): Promise<string[]> {
  if (!Array.isArray(dataUrls) || dataUrls.length === 0) return [];

  try {
    const token = await getFirebaseToken();
    const res = await fetch("/api/media", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ images: dataUrls.slice(0, 10) }),
    });

    if (!res.ok) {
      throw new Error(`POST /api/media returned ${res.status}`);
    }

    const data = (await res.json()) as { keys?: string[] };
    if (Array.isArray(data.keys) && data.keys.length === dataUrls.slice(0, 10).length) {
      // Pre-populate the local session's blobUrlCache with the dataUrls so History renders instantaneously
      data.keys.forEach((key, idx) => {
        if (!blobUrlCache.has(key) && dataUrls[idx]) {
          blobUrlCache.set(key, dataUrls[idx]);
        }
      });
      return data.keys;
    }
    throw new Error("Mismatched R2 key count");
  } catch (err) {
    console.warn("[mediaService] Falling back to inline compressed WebP data URLs:", err);
    return dataUrls;
  }
}

/**
 * Resolves either an R2 key ("r2:quick/uid/...") or a legacy base64/data-URL string into a renderable img src.
 */
export async function resolveMediaUrl(srcOrKey: string): Promise<string> {
  if (!srcOrKey) return "";

  if (!isR2MediaKey(srcOrKey)) {
    if (srcOrKey.startsWith("data:") || srcOrKey.startsWith("blob:") || srcOrKey.startsWith("http")) {
      return srcOrKey;
    }
    return `data:image/png;base64,${srcOrKey}`;
  }

  const cached = blobUrlCache.get(srcOrKey);
  if (cached) return cached;

  const existingInflight = inflightRequests.get(srcOrKey);
  if (existingInflight) return existingInflight;

  const promise = (async () => {
    try {
      const token = await getFirebaseToken();
      const res = await fetch(`/api/media?key=${encodeURIComponent(srcOrKey)}`, {
        method: "GET",
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
```

#### 5B. Create `app/components/ui/R2Image.tsx`

```tsx
import React, { useEffect, useState } from "react";
import { resolveMediaUrl } from "../../../services/mediaService";
import { isR2MediaKey } from "../../utils/imageOptimize";

interface R2ImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  srcOrKey: string;
}

export const R2Image: React.FC<R2ImageProps> = ({
  srcOrKey,
  alt = "Screenshot",
  style,
  className,
  ...rest
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(() =>
    isR2MediaKey(srcOrKey)
      ? ""
      : srcOrKey.startsWith("data:")
      ? srcOrKey
      : `data:image/png;base64,${srcOrKey}`
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);

    if (!isR2MediaKey(srcOrKey)) {
      setResolvedSrc(
        srcOrKey.startsWith("data:") ? srcOrKey : `data:image/png;base64,${srcOrKey}`
      );
      return;
    }

    resolveMediaUrl(srcOrKey)
      .then((url) => {
        if (active) setResolvedSrc(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [srcOrKey]);

  if (failed) {
    return (
      <div
        className={className}
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5E8E0",
          color: "rgba(26,18,8,0.5)",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
        }}
      >
        Unavailable
      </div>
    );
  }

  if (!resolvedSrc) {
    return (
      <div
        className={`animate-pulse ${className || ""}`}
        style={{ ...style, backgroundColor: "#E8E0D4" }}
      />
    );
  }

  return <img src={resolvedSrc} alt={alt} style={style} className={className} {...rest} />;
};
```

---

### Step 6: Wire 10-Screenshot R2 Pipeline into `QuickModeScreen.tsx` & `HistoryScreen.tsx`

1. **`app/components/QuickModeScreen.tsx`**:
   - Replace `const [screenshots, setScreenshots] = useSessionState<string[]>("quick_screenshots", [], authUser?.uid);` (line 106) with `const [screenshots, setScreenshots] = useState<string[]>([]);` so 10 screenshots never blow up `sessionStorage`.
   - Replace `toDataUrl` (lines 78–90) with `optimizeImageFileToDataUrl` and `MAX_QUICK_SCREENSHOTS` (`10`) from `../utils/imageOptimize`.
   - In `handleUpload` (lines 165–184):
     ```ts
     const remainingSlots = MAX_QUICK_SCREENSHOTS - screenshots.length;
     if (remainingSlots <= 0) {
       toast(`Maximum ${MAX_QUICK_SCREENSHOTS} screenshots allowed`, "error");
       return;
     }
     const picked = Array.from(files).slice(0, remainingSlots);
     const encoded = await Promise.all(picked.map((f) => optimizeImageFileToDataUrl(f)));
     setScreenshots((prev) => [...prev, ...encoded]);
     ```
   - Update line 493 helper copy from `"1–3 images supported"` to `"1–10 screenshots supported (or paste)"`.
   - In `handleAnalyze` (lines 230–271), upload screenshots to R2 in the background before calling `createSession`:
     ```ts
     if (authUser?.uid) {
       logSession(authUser.uid, "quick", undefined, derivedGhostRisk);
       void recordActivity(authUser.uid).catch(() => {});
       void (async () => {
         const storedScreenshots = screenshots.length
           ? await uploadScreenshotsToR2(screenshots)
           : [];
         const sessionPayload = {
           request: {
             screenshots: storedScreenshots,
             theirMessage,
             yourDraft,
             context,
           },
           response,
           vibeCheck: response.vibeCheck,
           suggestions: response.suggestions,
         };
         const sessionMeta = {
           mode: "quick" as const,
           headline: response.summary || response.proTip || "Quick analysis",
           ghost_risk: derivedGhostRisk,
           message_count: response.extractedUnrepliedMessages?.length || 1,
         };
         await createSession(authUser.uid, sessionPayload, sessionMeta).catch((sessionErr) => {
           console.error("Failed to save session:", sessionErr);
           queuePendingSession(authUser.uid, sessionPayload, sessionMeta);
         });
       })();
     }
     ```
2. **`app/components/HistoryScreen.tsx:240-253`**:
   - Import `R2Image` from `./ui/R2Image`.
   - Replace the `<img key={idx} src={...} ... />` inside `SessionDetail` (lines 241–252) with `<R2Image key={idx} srcOrKey={screenshot} alt={`Screenshot ${idx + 1}`} style={{ width: "100%", aspectRatio: "9 / 16", objectFit: "cover", borderRadius: 12, border: "1px solid #E8E0D4" }} />`.

---

## Test Plan

1. **Unit tests**:
   ```bash
   npm test
   ```
   Verify `app/utils/imageOptimize.test.ts` and all 26+ tests pass.
2. **Typecheck & Build**:
   ```bash
   npm run typecheck && npm run build
   ```
   Must exit 0.

---

## Done Criteria

- [ ] `wrangler.toml` contains the `[[r2_buckets]]` binding for `RIZZBOT_MEDIA` (`rizzbot-media`).
- [ ] `functions/api/media.ts` implements authenticated `POST`, `GET`, and `DELETE` checking `context.data?.user?.uid` and `quick/${verifiedUid}/` key ownership.
- [ ] `functions/api/sessions.ts` cleans up `r2:quick/${verifiedUid}/...` keys from `sessions.result` when a session is deleted.
- [ ] `app/utils/imageOptimize.ts` + `app/utils/imageOptimize.test.ts` resize images to `<= 1280px` and compress to WebP `0.80` with `MAX_QUICK_SCREENSHOTS = 10`.
- [ ] `services/mediaService.ts` and `app/components/ui/R2Image.tsx` use `getFirebaseToken()` from `./firebaseService` to resolve `r2:...` keys and render legacy base64 strings.
- [ ] `QuickModeScreen.tsx` supports up to 10 screenshots without storing base64 arrays in `sessionStorage`.
- [ ] `npm run typecheck`, `npm test`, and `npm run build` all exit 0.

---

## STOP Conditions

- **STOP** if `<img src="/api/media?key=..." />` is rendered directly in JSX without `<R2Image />` — `/api/*` requires the Firebase `Authorization: Bearer` header.
- **STOP** if `GET /api/media` or `DELETE /api/media` allows accessing keys outside `quick/${verifiedUid}/`.
