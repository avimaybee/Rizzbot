/** Shared JSON + payload helpers for Pages Functions. Single source — do not re-implement per endpoint. */

export function toDataUrl(mimeType: string, data: string): string {
  if (!mimeType && !data) return "";
  if (data.startsWith("data:")) return data;
  return `data:${mimeType || "image/webp"};base64,${data}`;
}

/** Strip ```json fences and slice to the outermost object. Throws on invalid JSON. */
export function cleanJsonObject(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    }
    throw new Error("Model output did not contain valid JSON");
  }
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
