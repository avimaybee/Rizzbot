export async function onRequest(context: any) {
  const { env, request } = context;
  const db = env.RIZZBOT_DATA || env.RIZZBOT || env.RIZZBOT_DB || env.RIZZBOT_D1 || env.RIZZBOT_DATASET;

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
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const userId = url.searchParams.get('user_id');
      const personaId = url.searchParams.get('persona_id');

      if (personaId) {
        const persona = await db.prepare('SELECT * FROM personas WHERE id = ?').bind(Number(personaId)).first();
        return new Response(JSON.stringify(persona || null), {
          headers: corsHeaders,
        });
      }

      if (userId) {
        const personas = await db.prepare('SELECT * FROM personas WHERE user_id = ? ORDER BY created_at DESC').bind(Number(userId)).all();
        return new Response(JSON.stringify(personas.results || []), {
          headers: corsHeaders,
        });
      }

      // All personas (no auth)
      const all = await db.prepare('SELECT * FROM personas LIMIT 100').all();
      return new Response(JSON.stringify(all.results || []), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const {
        user_id,
        name,
        relationship_context,
        harshness_level,
        communication_tips,
        conversation_starters,
        things_to_avoid,
      } = body;

      if (!user_id || !name) {
        return new Response(JSON.stringify({ error: 'user_id and name required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const result = await db
        .prepare(
          `INSERT INTO personas (user_id, name, relationship_context, harshness_level, communication_tips, conversation_starters, things_to_avoid)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          user_id,
          name,
          relationship_context || null,
          harshness_level || null,
          typeof communication_tips === 'string' ? communication_tips : JSON.stringify(communication_tips || []),
          typeof conversation_starters === 'string' ? conversation_starters : JSON.stringify(conversation_starters || []),
          typeof things_to_avoid === 'string' ? things_to_avoid : JSON.stringify(things_to_avoid || [])
        )
        .run();

      return new Response(JSON.stringify({ success: true, id: result?.meta?.last_rowid }), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'PUT') {
      const body = await request.json();
      const { id, name, relationship_context, harshness_level, communication_tips, conversation_starters, things_to_avoid } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const result = await db
        .prepare(
          `UPDATE personas SET name = ?, relationship_context = ?, harshness_level = ?, communication_tips = ?, conversation_starters = ?, things_to_avoid = ?
           WHERE id = ?`
        )
        .bind(
          name || null,
          relationship_context || null,
          harshness_level || null,
          typeof communication_tips === 'string' ? communication_tips : JSON.stringify(communication_tips || []),
          typeof conversation_starters === 'string' ? conversation_starters : JSON.stringify(conversation_starters || []),
          typeof things_to_avoid === 'string' ? things_to_avoid : JSON.stringify(things_to_avoid || []),
          id
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

      const result = await db.prepare('DELETE FROM personas WHERE id = ?').bind(Number(id)).run();

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
