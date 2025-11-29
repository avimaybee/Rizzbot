export async function onRequest(context: any) {
  const { env, request } = context;
  const db = env.RIZZBOT_DATA || env.RIZZBOT || env.RIZZBOT_DB || env.RIZZBOT_D1 || env.RIZZBOT_DATASET;

  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 binding not found' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // All feedback (admin)
      const all = await db.prepare('SELECT * FROM feedback LIMIT 500').all();
      return new Response(JSON.stringify(all.results || []), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { user_id, source, suggestion_type, rating, metadata } = body;

      if (!user_id || !source || !suggestion_type || rating === undefined) {
        return new Response(JSON.stringify({ error: 'user_id, source, suggestion_type, rating required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result = await db
        .prepare('INSERT INTO feedback (user_id, source, suggestion_type, rating, metadata) VALUES (?, ?, ?, ?, ?)')
        .bind(user_id, source, suggestion_type, Number(rating), metadata ? JSON.stringify(metadata) : null)
        .run();

      return new Response(JSON.stringify({ success: true, id: result?.meta?.last_rowid }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
