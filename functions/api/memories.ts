
export async function onRequest(context: any) {
    const { env, request } = context;
    const db = env.RIZZBOT_DATA || env.RIZZBOT || env.RIZZBOT_DB || env.RIZZBOT_D1 || env.RIZZBOT_DATASET || env["rizzbot data"];

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!db) {
        return new Response(JSON.stringify({ error: 'DB binding not found' }), { status: 500, headers: corsHeaders });
    }

    try {
        const url = new URL(request.url);

        // GET memories
        if (request.method === 'GET') {
            const userId = url.searchParams.get('user_id');
            const sessionId = url.searchParams.get('session_id');
            const type = url.searchParams.get('type'); // GLOBAL or SESSION
            const anonId = url.searchParams.get('anon_id'); // Resolve anon_id to user_id if needed

            let resolvedUserId = userId;
            if (!resolvedUserId && anonId) {
                const user = await db.prepare('SELECT id FROM users WHERE anon_id = ?').bind(anonId).first();
                if (user) resolvedUserId = user.id;
                else return new Response(JSON.stringify({ memories: [] }), { headers: corsHeaders });
            }

            if (!resolvedUserId) {
                return new Response(JSON.stringify({ error: 'User identifier required' }), { status: 400, headers: corsHeaders });
            }

            let query = 'SELECT * FROM therapist_memories WHERE user_id = ?';
            const bindings: any[] = [resolvedUserId];

            if (type) {
                query += ' AND type = ?';
                bindings.push(type);
            }

            if (sessionId) {
                // If getting session memories, specific session
                // If getting global, ignore session_id usually, but strict filtering requested?
                query += ' AND (session_id = ? OR type = "GLOBAL")';
                bindings.push(sessionId);
            }

            query += ' ORDER BY created_at DESC';

            const results = await db.prepare(query).bind(...bindings).all();
            return new Response(JSON.stringify({ memories: results.results || [] }), { headers: corsHeaders });
        }

        // POST create memory
        if (request.method === 'POST') {
            const body = await request.json();
            const { user_anon_id, session_id, type, content } = body;

            let resolvedUserId = body.user_id;
            if (!resolvedUserId && user_anon_id) {
                const user = await db.prepare('SELECT id FROM users WHERE anon_id = ?').bind(user_anon_id).first();
                if (user) resolvedUserId = user.id;
            }

            if (!resolvedUserId) return new Response(JSON.stringify({ error: 'User required' }), { status: 400, headers: corsHeaders });
            if (!content || !type) return new Response(JSON.stringify({ error: 'Content and Type required' }), { status: 400, headers: corsHeaders });

            const res = await db.prepare(`
        INSERT INTO therapist_memories (user_id, session_id, type, content)
        VALUES (?, ?, ?, ?)
      `).bind(resolvedUserId, session_id || null, type, content).run();

            return new Response(JSON.stringify({ success: true, id: res.meta?.last_rowid }), { headers: corsHeaders });
        }

        // PUT update memory
        if (request.method === 'PUT') {
            const body = await request.json();
            const { id, content, type } = body;

            if (!id || !content || !type) return new Response(JSON.stringify({ error: 'ID, Content, and Type required' }), { status: 400, headers: corsHeaders });

            await db.prepare('UPDATE therapist_memories SET content = ?, type = ? WHERE id = ?')
                .bind(content, type, id).run();

            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        // DELETE memory
        if (request.method === 'DELETE') {
            const id = url.searchParams.get('id');
            if (!id) return new Response(JSON.stringify({ error: 'ID required' }), { status: 400, headers: corsHeaders });
            await db.prepare('DELETE FROM therapist_memories WHERE id = ?').bind(id).run();
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
}
