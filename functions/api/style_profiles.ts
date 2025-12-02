export async function onRequest(context: any) {
  const { env, request } = context;
  const db = env.RIZZBOT_DATA || env.RIZZBOT || env.RIZZBOT_DB || env.RIZZBOT_D1 || env.RIZZBOT_DATASET || env["rizzbot data"];

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
    console.error('[style_profiles.ts] D1 binding not found. Available env keys:', Object.keys(env));
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
        const profile = await db
          .prepare('SELECT * FROM style_profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
          .bind(Number(userId))
          .first();

        return new Response(JSON.stringify(profile || null), {
          headers: corsHeaders,
        });
      }

      const all = await db.prepare('SELECT * FROM style_profiles LIMIT 100').all();
      return new Response(JSON.stringify(all.results || []), {
        headers: corsHeaders,
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
        ai_summary,
        favorite_emojis,
      } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const result = await db
        .prepare(
          `INSERT INTO style_profiles 
           (user_id, emoji_usage, capitalization, punctuation, average_length, slang_level, signature_patterns, preferred_tone, raw_samples, ai_summary, favorite_emojis)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
          raw_samples ? JSON.stringify(raw_samples) : null,
          ai_summary || null,
          favorite_emojis ? JSON.stringify(favorite_emojis) : null
        )
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
    console.error('[style_profiles.ts] Error:', err.message, err.stack);
    return new Response(JSON.stringify({
      error: err.message || String(err),
      hint: 'If this is a schema error, try calling /api/migrate first'
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
