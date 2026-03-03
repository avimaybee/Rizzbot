import { ensureAppSchema } from './schema';

export async function onRequest(context: any) {
  const { env, request, data } = context;
  const db = env.RIZZBOT_DATA || env.RIZZBOT || env.RIZZBOT_DB || env.RIZZBOT_D1 || env.RIZZBOT_DATASET || env["rizzbot data"];

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const reqUserId = url.searchParams.get('user_id');

      if (reqUserId && Number(reqUserId) !== dbUserId) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot access other users\' data' }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      // Always fetch for the verified user
      const profile = await db
        .prepare('SELECT * FROM style_profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
        .bind(dbUserId)
        .first();

      return new Response(JSON.stringify(profile || null), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const {
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

      // We ignore client-provided user IDs and use the verified user context
      if (!dbUserId) {
        // Auto-provision basic user row if it doesn't exist yet
        try {
          const created = await db.prepare('INSERT INTO users (anon_id) VALUES (?)').bind(verifiedUid).run();
          dbUserId = created?.meta?.last_rowid || created?.meta?.last_row_id;
        } catch (userErr: any) {
          console.error('[style_profiles.ts] Failed to create basic user for style_profile:', userErr.message);
          return new Response(JSON.stringify({ error: 'Failed to mapped user identity' }), { status: 500, headers: corsHeaders });
        }
      }

      if (!dbUserId) {
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
          dbUserId,
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
