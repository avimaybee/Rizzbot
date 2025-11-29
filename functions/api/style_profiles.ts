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
        const profile = await db
          .prepare('SELECT * FROM style_profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
          .bind(Number(userId))
          .first();

        return new Response(JSON.stringify(profile || null), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const all = await db.prepare('SELECT * FROM style_profiles LIMIT 100').all();
      return new Response(JSON.stringify(all.results || []), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const {
        user_id,
        emoji_usage,
        capitalization,
        punctuation,
        average_length,
        slang_level,
        signature_patterns,
        preferred_tone,
        raw_samples,
      } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result = await db
        .prepare(
          `INSERT INTO style_profiles 
           (user_id, emoji_usage, capitalization, punctuation, average_length, slang_level, signature_patterns, preferred_tone, raw_samples)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          user_id,
          emoji_usage || null,
          capitalization || null,
          punctuation || null,
          average_length || null,
          slang_level || null,
          typeof signature_patterns === 'string' ? signature_patterns : JSON.stringify(signature_patterns || []),
          preferred_tone || null,
          raw_samples ? JSON.stringify(raw_samples) : null
        )
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
