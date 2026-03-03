
import { ensureAppSchema } from './schema';

export async function onRequest(context: any) {
    const { env, request, data } = context;
    const db = env.RIZZBOT_DATA || env.RIZZBOT || env.RIZZBOT_DB || env.RIZZBOT_D1 || env.RIZZBOT_DATASET || env["rizzbot data"];

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };

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
        return new Response(JSON.stringify({ error: 'DB binding not found' }), { status: 500, headers: corsHeaders });
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

        const url = new URL(request.url);

        // GET memories
        if (request.method === 'GET') {
            const reqUserId = url.searchParams.get('user_id');
            const sessionId = url.searchParams.get('session_id');
            const type = url.searchParams.get('type'); // GLOBAL or SESSION
            const reqAnonId = url.searchParams.get('anon_id');

            if (reqAnonId && reqAnonId !== verifiedUid) {
                return new Response(JSON.stringify({ error: 'Forbidden: Cannot access other users\' data' }), {
                    status: 403,
                    headers: corsHeaders,
                });
            }

            if (reqUserId && Number(reqUserId) !== dbUserId) {
                return new Response(JSON.stringify({ error: 'Forbidden: Cannot access other users\' data' }), {
                    status: 403,
                    headers: corsHeaders,
                });
            }

            let query = 'SELECT * FROM therapist_memories WHERE user_id = ?';
            const bindings: any[] = [dbUserId];

            if (type) {
                query += ' AND type = ?';
                bindings.push(type);
            }

            if (sessionId) {
                query += ' AND session_id = ?';
                bindings.push(sessionId);
            }

            query += ' ORDER BY created_at DESC';

            const results = await db.prepare(query).bind(...bindings).all();
            return new Response(JSON.stringify({ memories: results.results || [] }), { headers: corsHeaders });
        }

        // POST create memory
        if (request.method === 'POST') {
            const body = await request.json();
            const { session_id, type, content, creator } = body;

            // We ignore client-provided user IDs and use the verified user context
            if (!dbUserId) {
                // Auto-provision basic user row if it doesn't exist yet
                try {
                    const created = await db.prepare('INSERT INTO users (anon_id) VALUES (?)').bind(verifiedUid).run();
                    dbUserId = created?.meta?.last_rowid || created?.meta?.last_row_id;
                } catch (userErr: any) {
                    console.error('[memories] Failed to create basic user for memory:', userErr.message);
                    return new Response(JSON.stringify({ error: 'Failed to mapped user identity' }), { status: 500, headers: corsHeaders });
                }
            }

            if (!dbUserId) return new Response(JSON.stringify({ error: 'User required' }), { status: 400, headers: corsHeaders });
            if (!content || !type) return new Response(JSON.stringify({ error: 'Content and Type required' }), { status: 400, headers: corsHeaders });

            const res = await db.prepare(`
        INSERT INTO therapist_memories (user_id, session_id, type, content, creator)
        VALUES (?, ?, ?, ?, ?)
      `).bind(dbUserId, session_id || null, type, content, creator || 'USER').run();

            return new Response(JSON.stringify({ success: true, id: res.meta?.last_rowid }), { headers: corsHeaders });
        }

        // PUT update memory
        if (request.method === 'PUT') {
            const body = await request.json();
            const { id, content, type, creator } = body;

            if (!id || !content || !type) return new Response(JSON.stringify({ error: 'ID, Content, and Type required' }), { status: 400, headers: corsHeaders });

            // Ensure ownership before updating
            const run = await db.prepare('UPDATE therapist_memories SET content = ?, type = ?, creator = ? WHERE id = ? AND user_id = ?')
                .bind(content, type, creator || 'USER', id, dbUserId).run();

            if (run.meta?.changes === 0) {
                return new Response(JSON.stringify({ error: 'Memory not found or forbidden' }), { status: 403, headers: corsHeaders });
            }

            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        // DELETE memory
        if (request.method === 'DELETE') {
            const id = url.searchParams.get('id');
            if (!id) return new Response(JSON.stringify({ error: 'ID required' }), { status: 400, headers: corsHeaders });

            // Ensure ownership
            const run = await db.prepare('DELETE FROM therapist_memories WHERE id = ? AND user_id = ?').bind(id, dbUserId).run();

            if (run.meta?.changes === 0) {
                return new Response(JSON.stringify({ error: 'Memory not found or forbidden' }), { status: 403, headers: corsHeaders });
            }

            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
}
