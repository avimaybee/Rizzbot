export async function onRequest(context: any) {
  const { env, request } = context;
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
    console.error('[users.ts] D1 binding not found. Available env keys:', Object.keys(env));
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
      const firebaseUid = url.searchParams.get('firebase_uid');
      const anonId = url.searchParams.get('anon_id');
      const identifier = firebaseUid || anonId;

      if (identifier) {
        // Get user by firebase_uid (or fallback to anon_id for backwards compat)
        // First try with all columns, fall back to basic columns if extra ones don't exist
        let user;
        try {
          user = await db.prepare(
            'SELECT id, anon_id, email, display_name, photo_url, provider, created_at, last_login_at FROM users WHERE anon_id = ?'
          ).bind(identifier).first();
        } catch (columnError: any) {
          // Columns might not exist yet - try basic query
          console.warn('[users.ts] Extended columns query failed, trying basic:', columnError.message);
          user = await db.prepare(
            'SELECT id, anon_id, created_at FROM users WHERE anon_id = ?'
          ).bind(identifier).first();
        }

        if (!user) {
          // Return 404 to let client know user doesn't exist
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404,
            headers: corsHeaders,
          });
        }

        // Update last_login_at (ignore if column doesn't exist)
        try {
          await db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
            .bind(new Date().toISOString(), user.id).run();
        } catch (e) {
          // Column might not exist yet
        }

        return new Response(JSON.stringify({ user }), {
          headers: corsHeaders,
        });
      }

      // Get all users (admin only, no auth for now)
      const users = await db.prepare('SELECT id, anon_id, email, display_name, created_at FROM users LIMIT 100').all();
      return new Response(JSON.stringify(users.results || []), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const firebaseUid = body.firebase_uid || body.anon_id;
      const email = body.email || null;
      const displayName = body.display_name || null;
      const photoUrl = body.photo_url || null;
      const provider = body.provider || 'unknown';

      if (!firebaseUid) {
        return new Response(JSON.stringify({ error: 'firebase_uid or anon_id required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Check if user exists
      let user;
      try {
        user = await db.prepare(
          'SELECT id, anon_id, email, display_name, photo_url, provider, created_at FROM users WHERE anon_id = ?'
        ).bind(firebaseUid).first();
      } catch (e) {
        // Try basic query if extended columns don't exist
        user = await db.prepare(
          'SELECT id, anon_id, created_at FROM users WHERE anon_id = ?'
        ).bind(firebaseUid).first();
      }

      if (!user) {
        // Create new user - try with extended columns first, fall back to basic
        const now = new Date().toISOString();
        try {
          const created = await db.prepare(
            'INSERT INTO users (anon_id, email, display_name, photo_url, provider, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(firebaseUid, email, displayName, photoUrl, provider, now, now).run();

          user = {
            id: created?.meta?.last_row_id || created?.meta?.last_rowid,
            anon_id: firebaseUid,
            email,
            display_name: displayName,
            photo_url: photoUrl,
            provider,
            created_at: now
          };
        } catch (extendedError: any) {
          // Fall back to basic insert
          console.warn('[users.ts] Extended insert failed, trying basic:', extendedError.message);
          const created = await db.prepare(
            'INSERT INTO users (anon_id, created_at) VALUES (?, ?)'
          ).bind(firebaseUid, now).run();

          user = {
            id: created?.meta?.last_row_id || created?.meta?.last_rowid,
            anon_id: firebaseUid,
            created_at: now
          };
        }
      }

      return new Response(JSON.stringify({ user, created: true }), {
        headers: corsHeaders,
      });
    }

    if (request.method === 'PUT') {
      const body = await request.json();
      const userId = body.id;
      const email = body.email;
      const displayName = body.display_name;
      const photoUrl = body.photo_url;
      const provider = body.provider;

      if (!userId) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];

      if (email !== undefined) {
        updates.push('email = ?');
        values.push(email);
      }
      if (displayName !== undefined) {
        updates.push('display_name = ?');
        values.push(displayName);
      }
      if (photoUrl !== undefined) {
        updates.push('photo_url = ?');
        values.push(photoUrl);
      }
      if (provider !== undefined) {
        updates.push('provider = ?');
        values.push(provider);
      }

      // Always update last_login_at
      updates.push('last_login_at = ?');
      values.push(new Date().toISOString());

      values.push(userId);

      if (updates.length > 0) {
        await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  } catch (err: any) {
    console.error('[users.ts] Error:', err.message, err.stack);
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
