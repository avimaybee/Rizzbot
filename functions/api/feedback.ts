export async function onRequest(context: any) {
  const { env, request } = context;
  const db = env.RIZZBOT_DATA || env.RIZZBOT || env.RIZZBOT_DB || env.RIZZBOT_D1 || env.RIZZBOT_DATASET;

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!db) {
    console.error('[feedback.ts] D1 binding not found. Available env keys:', Object.keys(env));
    return new Response(JSON.stringify({ 
      error: 'D1 binding not found',
      availableBindings: Object.keys(env).filter(k => !k.startsWith('__')),
      hint: 'Check Cloudflare Pages > Settings > Functions > D1 database bindings'
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const userId = url.searchParams.get('user_id');

      if (userId) {
        // Get feedback for user, aggregated by suggestion_type
        const feedback = await db
          .prepare(
            `SELECT source, suggestion_type, rating, COUNT(*) as count 
             FROM feedback 
             WHERE user_id = ? 
             GROUP BY source, suggestion_type, rating 
             ORDER BY created_at DESC`
          )
          .bind(Number(userId))
          .all();

        return new Response(JSON.stringify(feedback.results || []), {
          headers: corsHeaders,
        });
      }

      // All feedback (admin)
      const all = await db.prepare('SELECT * FROM feedback LIMIT 500').all();
      return new Response(JSON.stringify(all.results || []), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { user_id, source, suggestion_type, rating, metadata } = body;

      if (!user_id || !source || !suggestion_type || rating === undefined) {
        return new Response(JSON.stringify({ error: 'user_id, source, suggestion_type, rating required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const result = await db
        .prepare('INSERT INTO feedback (user_id, source, suggestion_type, rating, metadata) VALUES (?, ?, ?, ?, ?)')
        .bind(user_id, source, suggestion_type, Number(rating), metadata ? JSON.stringify(metadata) : null)
        .run();

      return new Response(JSON.stringify({ success: true, id: result?.meta?.last_rowid }), {
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  } catch (err: any) {
    console.error('[feedback.ts] Error:', err.message, err.stack);
    return new Response(JSON.stringify({ 
      error: err.message || String(err),
      hint: 'If this is a schema error, try calling /api/migrate first'
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
