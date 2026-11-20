const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/rizzbot\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.rizzbot\.pages\.dev$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

/** Same-origin app calls don't need CORS, but preview deploys + R2 flows do. Reflect only allowed origins. */
export function corsHeadersFor(request: Request, extra?: Record<string, string>): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://rizzbot.pages.dev",
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {}),
  };
}
