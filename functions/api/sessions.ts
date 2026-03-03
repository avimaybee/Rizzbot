import { ensureAppSchema } from './schema';

export async function onRequest(context: any) {
  const { env, request, data } = context;
  // Try several common binding names to be resilient to the exact name used in Pages settings
  const db = env.RIZZBOT_DATA || env.RIZZBOT || env.RIZZBOT_DB || env.RIZZBOT_D1 || env.RIZZBOT_DATASET || env["rizzbot data"];

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Ensure authenticated user exists in context
  const authenticatedUser = data?.user;
  if (!authenticatedUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized: No verified user context' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const verifiedUid = authenticatedUser.uid;

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
    await ensureAppSchema(db);

    // Ensure the internal user exists for this verified Firebase UID
    const userRow = await db.prepare('SELECT id FROM users WHERE anon_id = ?').bind(verifiedUid).first();
    let dbUserId = userRow?.id;

    if (!dbUserId && request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'User mapping not found in database' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);

    if (request.method === 'GET') {
      // Check if requesting user-specific history
      const reqUserId = url.searchParams.get('user_id');
      const reqAnonId = url.searchParams.get('anon_id');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      if (reqAnonId && reqAnonId !== verifiedUid) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot access other users\' data' }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      if (reqUserId && Number(reqUserId) !== dbUserId) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot access other users\' data' }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      // If they passed no ID but are verified, just fetch for their verified user ID
      const query = `
        SELECT s.id, s.result, s.created_at, s.mode, s.persona_name, s.headline, s.ghost_risk, s.message_count,
                u.id AS user_id, u.anon_id
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE u.anon_id = ?
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const bindings = [verifiedUid, limit, offset];

      const results = await db.prepare(query).bind(...bindings).all();

      // Also get total count for pagination
      const countQuery = 'SELECT COUNT(*) as total FROM sessions s JOIN users u ON s.user_id = u.id WHERE u.anon_id = ?';
      const countBindings = [verifiedUid];

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

      // We ignore client-provided anon_id or user_id. Always use the verified context.
      if (!dbUserId) {
        // Auto-provision basic user row if it doesn't exist yet so the session can link
        try {
          const created = await db.prepare('INSERT INTO users (anon_id) VALUES (?)').bind(verifiedUid).run();
          dbUserId = created?.meta?.last_rowid || created?.meta?.last_row_id;
        } catch (userErr: any) {
          console.error('[sessions.ts] Failed to create basic user for session:', userErr.message);
        }
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
      ).bind(dbUserId, result, mode, personaName, headline, ghostRisk, messageCount).run();

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

      // Ensure that the session being deleted actually belongs to the verified user
      const run = await db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').bind(parseInt(sessionId), dbUserId).run();

      if (run.meta?.changes === 0) {
        return new Response(JSON.stringify({ error: 'Session not found or forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      }

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
