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
      const firebaseUid = url.searchParams.get('firebase_uid');
      const anonId = url.searchParams.get('anon_id');
      const identifier = firebaseUid || anonId;

      if (identifier) {
        // Get user by firebase_uid (or fallback to anon_id for backwards compat)
        let user = await db.prepare(
          'SELECT id, anon_id, email, display_name, photo_url, provider, created_at, last_login_at FROM users WHERE anon_id = ?'
        ).bind(identifier).first();

        if (!user) {
          // Return 404 to let client know user doesn't exist
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Update last_login_at
        await db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
          .bind(new Date().toISOString(), user.id).run();

        return new Response(JSON.stringify({ user }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get all users (admin only, no auth for now)
      const users = await db.prepare('SELECT id, anon_id, email, display_name, created_at FROM users LIMIT 100').all();
      return new Response(JSON.stringify(users.results || []), {
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check if user exists
      let user = await db.prepare(
        'SELECT id, anon_id, email, display_name, photo_url, provider, created_at FROM users WHERE anon_id = ?'
      ).bind(firebaseUid).first();

      if (!user) {
        // Create new user with all the Firebase data
        const now = new Date().toISOString();
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
      }

      return new Response(JSON.stringify({ user, created: true }), {
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
