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
    const url = new URL(request.url);

    if (request.method === 'GET') {
      // Check if requesting user-specific history
      const userId = url.searchParams.get('user_id');
      const anonId = url.searchParams.get('anon_id');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query: string;
      let bindings: any[] = [];

      if (anonId) {
        // Get sessions for a specific anonymous user
        query = `
          SELECT s.id, s.result, s.created_at, s.mode, s.persona_name, s.headline, s.ghost_risk, s.message_count,
                 u.id AS user_id, u.anon_id
          FROM sessions s
          LEFT JOIN users u ON s.user_id = u.id
          WHERE u.anon_id = ?
          ORDER BY s.created_at DESC
          LIMIT ? OFFSET ?
        `;
        bindings = [anonId, limit, offset];
      } else if (userId) {
        // Get sessions for a specific user by ID
        query = `
          SELECT s.id, s.result, s.created_at, s.mode, s.persona_name, s.headline, s.ghost_risk, s.message_count,
                 u.id AS user_id, u.anon_id
          FROM sessions s
          LEFT JOIN users u ON s.user_id = u.id
          WHERE s.user_id = ?
          ORDER BY s.created_at DESC
          LIMIT ? OFFSET ?
        `;
        bindings = [parseInt(userId), limit, offset];
      } else {
        // Default: get recent sessions (admin view)
        query = `
          SELECT s.id, s.result, s.created_at, s.mode, s.persona_name, s.headline, s.ghost_risk, s.message_count,
                 u.id AS user_id, u.anon_id
          FROM sessions s
          LEFT JOIN users u ON s.user_id = u.id
          ORDER BY s.created_at DESC
          LIMIT ? OFFSET ?
        `;
        bindings = [limit, offset];
      }

      const results = await db.prepare(query).bind(...bindings).all();

      // Also get total count for pagination
      let countQuery = 'SELECT COUNT(*) as total FROM sessions s';
      let countBindings: any[] = [];
      if (anonId) {
        countQuery = 'SELECT COUNT(*) as total FROM sessions s LEFT JOIN users u ON s.user_id = u.id WHERE u.anon_id = ?';
        countBindings = [anonId];
      } else if (userId) {
        countQuery = 'SELECT COUNT(*) as total FROM sessions WHERE user_id = ?';
        countBindings = [parseInt(userId)];
      }

      const countResult = await db.prepare(countQuery).bind(...countBindings).all();
      const total = countResult.results?.[0]?.total || 0;

      return new Response(JSON.stringify({
        sessions: results.results || [],
        pagination: { total, limit, offset, hasMore: offset + limit < total }
      }), {
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

      // Extract metadata for quick display
      const mode = body.mode || 'simulator';
      const personaName = body.persona_name || null;
      const headline = body.headline || null;
      const ghostRisk = body.ghost_risk || null;
      const messageCount = body.message_count || 0;

      const run = await db.prepare(
        'INSERT INTO sessions (user_id, result, mode, persona_name, headline, ghost_risk, message_count) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(userId, result, mode, personaName, headline, ghostRisk, messageCount).run();

      return new Response(JSON.stringify({ success: run.success, lastInsertId: run.meta?.last_rowid }), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'DELETE') {
      const sessionId = url.searchParams.get('id');
      if (!sessionId) {
        return new Response(JSON.stringify({ error: 'Session ID required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const run = await db.prepare('DELETE FROM sessions WHERE id = ?').bind(parseInt(sessionId)).run();
      return new Response(JSON.stringify({ success: run.success }), {
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
