export interface OpenCodeImagePart {
  mimeType: string;
  data: string;
}

export interface OpenCodeModelTier {
  id: "muse-spark-1.3-contributor" | "deepseek-v4.1-flash" | "hy4-flash-free" | "mimo-v2.6-flash";
  format: "responses" | "chat";
  effort: "xhigh" | "high" | "medium" | "low" | "none";
  structuredOutput: boolean;
  timeoutMs: number;
}

export function buildOpenCodeHeaders(apiKey: string, sessionTag: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "Rizzbot/1.0",
    "x-opencode-session": sessionTag,
  };
}

export function toDataUrl(img: OpenCodeImagePart): string {
  if (img.data.startsWith("data:")) return img.data;
  const mime = img.mimeType || "image/webp";
  return `data:${mime};base64,${img.data}`;
}

export function stripMarkdownJson(rawText: string): string {
  const trimmed = rawText.trim();
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1);
  }
  return stripped;
}
