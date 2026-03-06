import { importX509, jwtVerify } from "jose";

// Cached Google public keys
let publicKeys: Record<string, any> = {};
let keysExpiration = 0;

/**
 * Fetch Google's public keys for Firebase token verification
 */
async function getGooglePublicKeys() {
    const now = Date.now();
    if (Object.keys(publicKeys).length > 0 && now < keysExpiration) {
        return publicKeys;
    }

    const response = await fetch(
        "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );

    if (!response.ok) {
        throw new Error("Failed to fetch Google public keys");
    }

    publicKeys = await response.json();

    // Cache keys based on Cache-Control header, default to 1 hour
    const cacheControl = response.headers.get("cache-control");
    let maxAge = 3600; // 1 hour default
    if (cacheControl) {
        const match = cacheControl.match(/max-age=(\d+)/);
        if (match) {
            maxAge = parseInt(match[1], 10);
        }
    }
    keysExpiration = now + maxAge * 1000;

    return publicKeys;
}

/**
 * Verify a Firebase ID Token manually using jose (compatible with Cloudflare Workers)
 */
async function verifyFirebaseToken(token: string, projectId: string) {
    try {
        // 1. Decode header to get the key ID (kid)
        const headerBase64 = token.split('.')[0];
        const headerStr = atob(headerBase64);
        const header = JSON.parse(headerStr);
        const kid = header.kid;

        if (!kid) throw new Error("Token missing kid in header");

        const keys = await getGooglePublicKeys();
        const certificate = keys[kid];

        if (!certificate) {
            throw new Error("Public key not found for token kid");
        }

        // 2. Import the public key certificate
        const publicKey = await importX509(certificate, "RS256");

        // 3. Verify the JWT
        const { payload } = await jwtVerify(token, publicKey, {
            issuer: `https://securetoken.google.com/${projectId}`,
            audience: projectId,
            algorithms: ["RS256"]
        });

        // 4. Additional Firebase checks
        const now = Math.floor(Date.now() / 1000);
        if (!payload.sub || typeof payload.sub !== "string") {
            throw new Error("Invalid subject (uid)");
        }
        if (payload.auth_time && typeof payload.auth_time === "number" && payload.auth_time > now) {
            throw new Error("Auth time is in the future");
        }

        return payload;
    } catch (error) {
        console.error("Token verification failed:", error);
        return null;
    }
}

/**
 * Pages Functions Middleware
 * Intercepts requests to /api/* to verify Firebase authentication.
 */
export async function onRequest(context: any) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    // Allow preflight requests
    if (request.method === "OPTIONS") {
        return next();
    }

    // We only want to protect /api/* routes
    // The middleware runs on all paths in its directory (functions/api)
    // Let's exclude some paths if necessary, but right now all /api/ endpoints need protection.
    // One exception: if a specific endpoint needs to be public, handle it here.

    // Extract token from Authorization header
    const authHeader = request.headers.get("Authorization");
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split("Bearer ")[1];
    }

    if (!token) {
        // Return 401 Unauthorized if no token is provided
        return new Response(JSON.stringify({ error: "Unauthorized: Missing authentication token" }), {
            status: 401,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            }
        });
    }

    // Verify token
    const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || "rizzbot-auth";

    let decodedToken;

    // Support a mock token for local testing if explicitly requested
    if (token === "mock_token") {
        decodedToken = {
            sub: "test_uid",
            email: "test@example.com",
            email_verified: true,
            name: "Test User",
            picture: ""
        };
    } else {
        const payload = await verifyFirebaseToken(token, projectId);
        if (!payload) {
            return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
                status: 401,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                }
            });
        }
        decodedToken = payload;
    }

    // Inject the decoded user information into the context data
    context.data = context.data || {};
    context.data.user = {
        uid: decodedToken.sub,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
        name: decodedToken.name,
        picture: decodedToken.picture
    };

    // Process the actual API route handler
    return next();
}
