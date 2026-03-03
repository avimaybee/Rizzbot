import { ensureAppSchema } from './schema';

export async function onRequest(context: any) {
  const { env, request, data } = context;
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
    console.error('[personas.ts] D1 binding not found. Available env keys:', Object.keys(env));
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

    // Get the internal user DB ID associated with this verified firebase UID
    // Most resources are keyed by user_id
    const user = await db.prepare('SELECT id FROM users WHERE anon_id = ?').bind(verifiedUid).first();
    const dbUserId = user?.id;

    if (!dbUserId) {
      return new Response(JSON.stringify({ error: 'User mapping not found in database' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const reqUserId = url.searchParams.get('user_id');
      const personaId = url.searchParams.get('persona_id');

      if (reqUserId && Number(reqUserId) !== dbUserId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      if (personaId) {
        const persona = await db.prepare('SELECT * FROM personas WHERE id = ? AND user_id = ?').bind(Number(personaId), dbUserId).first();
        if (!persona) return new Response(JSON.stringify(null), { headers: corsHeaders });
        return new Response(JSON.stringify(persona), { headers: corsHeaders });
      }

      // Default: fetch all personas for the authenticated user
      const personas = await db.prepare('SELECT * FROM personas WHERE user_id = ? ORDER BY created_at DESC').bind(dbUserId).all();
      return new Response(JSON.stringify(personas.results || []), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const {
        name,
        relationship_context,
        harshness_level,
        communication_tips,
        conversation_starters,
        things_to_avoid,
        tone,
        style,
        habits,
        redFlags,
        greenFlags,
        theirLanguage,
      } = body;

      if (!name) {
        return new Response(JSON.stringify({ error: 'name required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const result = await db
        .prepare(
          `INSERT INTO personas (user_id, name, relationship_context, harshness_level, communication_tips, conversation_starters, things_to_avoid, tone, style, habits, red_flags, green_flags, their_language)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          dbUserId, // Always assign to the verified user
          name,
          relationship_context || null,
          harshness_level || null,
          typeof communication_tips === 'string' ? communication_tips : JSON.stringify(communication_tips || []),
          typeof conversation_starters === 'string' ? conversation_starters : JSON.stringify(conversation_starters || []),
          typeof things_to_avoid === 'string' ? things_to_avoid : JSON.stringify(things_to_avoid || []),
          tone || null,
          style || null,
          habits || null,
          typeof redFlags === 'string' ? redFlags : JSON.stringify(redFlags || []),
          typeof greenFlags === 'string' ? greenFlags : JSON.stringify(greenFlags || []),
          typeof theirLanguage === 'string' ? theirLanguage : JSON.stringify(theirLanguage || [])
        )
        .run();

      return new Response(JSON.stringify({ success: true, id: result?.meta?.last_rowid }), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'PUT') {
      const body = await request.json();
      const { id, name, relationship_context, harshness_level, communication_tips, conversation_starters, things_to_avoid, tone, style, habits, redFlags, greenFlags, theirLanguage } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Verify ownership before update
      const existing = await db.prepare('SELECT id FROM personas WHERE id = ? AND user_id = ?').bind(id, dbUserId).first();
      if (!existing) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      const result = await db
        .prepare(
          `UPDATE personas SET name = ?, relationship_context = ?, harshness_level = ?, communication_tips = ?, conversation_starters = ?, things_to_avoid = ?, tone = ?, style = ?, habits = ?, red_flags = ?, green_flags = ?, their_language = ?
           WHERE id = ? AND user_id = ?`
        )
        .bind(
          name || null,
          relationship_context || null,
          harshness_level || null,
          typeof communication_tips === 'string' ? communication_tips : JSON.stringify(communication_tips || []),
          typeof conversation_starters === 'string' ? conversation_starters : JSON.stringify(conversation_starters || []),
          typeof things_to_avoid === 'string' ? things_to_avoid : JSON.stringify(things_to_avoid || []),
          tone || null,
          style || null,
          habits || null,
          typeof redFlags === 'string' ? redFlags : JSON.stringify(redFlags || []),
          typeof greenFlags === 'string' ? greenFlags : JSON.stringify(greenFlags || []),
          typeof theirLanguage === 'string' ? theirLanguage : JSON.stringify(theirLanguage || []),
          id,
          dbUserId
        )
        .run();

      return new Response(JSON.stringify({ success: true, changes: result?.meta?.changes }), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');

      if (!id) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Ensure user can only delete their own personas
      const result = await db.prepare('DELETE FROM personas WHERE id = ? AND user_id = ?').bind(Number(id), dbUserId).run();

      if (result.meta?.changes === 0) {
        return new Response(JSON.stringify({ error: 'Persona not found or forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify({ success: true, changes: result?.meta?.changes }), {
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  } catch (err: any) {
    console.error('[personas.ts] Error:', err.message, err.stack);
    return new Response(JSON.stringify({
      error: err.message || String(err),
      hint: 'If this is a schema error, try calling /api/migrate first'
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
