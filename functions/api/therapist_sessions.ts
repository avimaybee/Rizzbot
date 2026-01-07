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

        // GET: List sessions or get specific session
        if (request.method === 'GET') {
            const interactionId = url.searchParams.get('interaction_id');
            const anonId = url.searchParams.get('anon_id');
            const userId = url.searchParams.get('user_id');
            const limit = parseInt(url.searchParams.get('limit') || '20');
            const offset = parseInt(url.searchParams.get('offset') || '0');

            if (interactionId) {
                // Get specific session
                const session = await db.prepare(
                    'SELECT * FROM therapist_sessions WHERE interaction_id = ?'
                ).bind(interactionId).first();

                return new Response(JSON.stringify(session || null), { headers: corsHeaders });
            }

            let query = '';
            let bindings: any[] = [];
            let countQuery = '';
            let countBindings: any[] = [];

            if (anonId) {
                query = `
          SELECT ts.* 
          FROM therapist_sessions ts
          JOIN users u ON ts.user_id = u.id
          WHERE u.anon_id = ?
          ORDER BY ts.updated_at DESC
          LIMIT ? OFFSET ?
        `;
                bindings = [anonId, limit, offset];

                countQuery = 'SELECT COUNT(*) as total FROM therapist_sessions ts JOIN users u ON ts.user_id = u.id WHERE u.anon_id = ?';
                countBindings = [anonId];
            } else if (userId) {
                query = `
          SELECT * FROM therapist_sessions 
          WHERE user_id = ?
          ORDER BY updated_at DESC
          LIMIT ? OFFSET ?
        `;
                bindings = [userId, limit, offset];

                countQuery = 'SELECT COUNT(*) as total FROM therapist_sessions WHERE user_id = ?';
                countBindings = [userId];
            } else {
                return new Response(JSON.stringify({ error: 'User identifier required' }), { status: 400, headers: corsHeaders });
            }

            const results = await db.prepare(query).bind(...bindings).all();
            const countResult = await db.prepare(countQuery).bind(...countBindings).first();
            const total = countResult?.total || 0;

            return new Response(JSON.stringify({
                sessions: results.results || [],
                pagination: { total, limit, offset, hasMore: offset + limit < total }
            }), { headers: corsHeaders });
        }

        // POST: Create or Update session
        if (request.method === 'POST') {
            const body = await request.json();
            const { user_anon_id, user_id, interaction_id, messages, clinical_notes, summary } = body;

            // RESOLVE USER ID
            let resolvedUserId = user_id;
            if (!resolvedUserId && user_anon_id) {
                const user = await db.prepare('SELECT id FROM users WHERE anon_id = ?').bind(user_anon_id).first();
                if (user) {
                    resolvedUserId = user.id;
                } else {
                    // Auto-create user if missing (should usually exist)
                    try {
                        const created = await db.prepare('INSERT INTO users (anon_id) VALUES (?)').bind(user_anon_id).run();
                        resolvedUserId = created?.meta?.last_rowid || created?.meta?.last_row_id;
                    } catch (e) {
                        console.error("Failed to auto-create user", e);
                    }
                }
            }

            if (!resolvedUserId) {
                return new Response(JSON.stringify({ error: 'User not found' }), { status: 400, headers: corsHeaders });
            }

            // Check if session exists
            const existing = await db.prepare('SELECT id FROM therapist_sessions WHERE interaction_id = ?').bind(interaction_id).first();

            if (existing) {
                // UPDATE
                await db.prepare(`
          UPDATE therapist_sessions 
          SET messages = ?, clinical_notes = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
          WHERE interaction_id = ?
        `).bind(
                    JSON.stringify(messages || []),
                    JSON.stringify(clinical_notes || {}),
                    summary || null,
                    interaction_id
                ).run();

                return new Response(JSON.stringify({ success: true, action: 'updated', id: existing.id }), { headers: corsHeaders });
            } else {
                // INSERT
                const result = await db.prepare(`
          INSERT INTO therapist_sessions (user_id, interaction_id, messages, clinical_notes, summary)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
                    resolvedUserId,
                    interaction_id,
                    JSON.stringify(messages || []),
                    JSON.stringify(clinical_notes || {}),
                    summary || null
                ).run();

                return new Response(JSON.stringify({ success: true, action: 'created', id: result.meta?.last_rowid }), { headers: corsHeaders });
            }
        }

        // DELETE
        if (request.method === 'DELETE') {
            const interactionId = url.searchParams.get('interaction_id');
            if (!interactionId) return new Response(JSON.stringify({ error: 'interaction_id required' }), { status: 400, headers: corsHeaders });

            await db.prepare('DELETE FROM therapist_sessions WHERE interaction_id = ?').bind(interactionId).run();
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });

    } catch (err: any) {
        console.error('[therapist_sessions] Error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
}
