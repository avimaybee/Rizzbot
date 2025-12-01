export async function onRequest(context: any) {
  const { env, request } = context;
  // Try several common binding names to be resilient to the exact name used in Pages settings
  const db = env.RIZZBOT_DATA || env.RIZZBOT || env.RIZZBOT_DB || env.RIZZBOT_D1 || env.RIZZBOT_DATASET || env["rizzbot data"];

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!db) {
    console.error('[sessions.ts] D1 binding not found. Available env keys:', Object.keys(env));
    return new Response(JSON.stringify({
      error: 'D1 binding not found. Check your Pages project bindings.',
      tried: ['RIZZBOT_DATA', 'RIZZBOT', 'RIZZBOT_DB', 'RIZZBOT_D1', 'RIZZBOT_DATASET', 'rizzbot data'],
      availableBindings: Object.keys(env).filter(k => !k.startsWith('__')),
      hint: 'Go to Cloudflare Pages > Settings > Functions > D1 database bindings'
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  try {
    if (request.method === 'GET') {
      // join with users to return anon_id when available
      const results = await db.prepare(`SELECT s.id, s.result, s.created_at, u.id AS user_id, u.anon_id
        FROM sessions s
        LEFT JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC LIMIT 50`).all();
      return new Response(JSON.stringify(results.results || []), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      // Support either user_anon_id (string) or user_id (numeric). Prefer anon id upsert flow.
      const anonId: string | undefined = body.user_anon_id || body.anon_id;
      let userId: number | null = null;

      if (anonId) {
        // try find existing user
        const found = await db.prepare('SELECT id FROM users WHERE anon_id = ?').bind(anonId).all();
        if ((found.results || []).length > 0) {
          userId = found.results[0].id;
        } else {
          // create user with basic fields
          try {
            const created = await db.prepare('INSERT INTO users (anon_id) VALUES (?)').bind(anonId).run();
            userId = created?.meta?.last_rowid || created?.meta?.last_row_id || null;
          } catch (userErr: any) {
            console.warn('[sessions.ts] Failed to create user, continuing without user_id:', userErr.message);
          }
        }
      } else if (body.user_id) {
        userId = Number(body.user_id) || null;
      }

      const result = typeof body.result === 'string' ? body.result : JSON.stringify(body.result || {});

      const run = await db.prepare('INSERT INTO sessions (user_id, result) VALUES (?, ?)').bind(userId, result).run();

      return new Response(JSON.stringify({ success: run.success, lastInsertId: run.meta?.last_rowid }), {
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  } catch (err: any) {
    console.error('[sessions.ts] Error:', err.message, err.stack);
    return new Response(JSON.stringify({
      error: err.message || String(err),
      stack: err.stack,
      hint: 'If this is a schema error, try calling /api/migrate first'
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
