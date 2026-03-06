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
        const userRowRes = await db.prepare('SELECT id FROM users WHERE anon_id = ?').bind(verifiedUid).all();
        const userRow = userRowRes.results?.[0];
        let dbUserId = userRow?.id;

        if (!dbUserId && request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'User mapping not found in database', hint: 'User might not have connected yet.' }), {
                status: 404,
                headers: corsHeaders,
            });
        }

        const url = new URL(request.url);

        // GET: List sessions or get specific session
        if (request.method === 'GET') {
            const interactionId = url.searchParams.get('interaction_id');
            const reqAnonId = url.searchParams.get('anon_id');
            const reqUserId = url.searchParams.get('user_id');
            const limit = parseInt(url.searchParams.get('limit') || '20');
            const offset = parseInt(url.searchParams.get('offset') || '0');

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


            if (interactionId) {
                // Get specific session, ensuring it belongs to the verified user
                const sessionRes = await db.prepare(
                    'SELECT ts.* FROM therapist_sessions ts JOIN users u ON ts.user_id = u.id WHERE ts.interaction_id = ? AND u.anon_id = ?'
                ).bind(interactionId, verifiedUid).all();
                
                const session = sessionRes.results?.[0];

                return new Response(JSON.stringify(session || null), { headers: corsHeaders });
            }

            const query = `
                SELECT ts.* 
                FROM therapist_sessions ts
                JOIN users u ON ts.user_id = u.id
                WHERE u.anon_id = ?
                ORDER BY ts.updated_at DESC
                LIMIT ? OFFSET ?
            `;
            const bindings = [verifiedUid, limit, offset];

            const countQuery = 'SELECT COUNT(*) as total FROM therapist_sessions ts JOIN users u ON ts.user_id = u.id WHERE u.anon_id = ?';
            const countBindings = [verifiedUid];

            const results = await db.prepare(query).bind(...bindings).all();
            const countResult = await db.prepare(countQuery).bind(...countBindings).all();
            const total = countResult.results?.[0]?.total || 0;

            return new Response(JSON.stringify({
                sessions: results.results || [],
                pagination: { total, limit, offset, hasMore: offset + limit < total }
            }), { headers: corsHeaders });
        }

        // POST: Create or Update session
        if (request.method === 'POST') {
            const body = await request.json();
            const { interaction_id, messages, clinical_notes, summary } = body;

            // We ignore client-provided user IDs and use the verified user context
            if (!dbUserId) {
                // Auto-provision basic user row if it doesn't exist yet
                try {
                    const created = await db.prepare('INSERT INTO users (anon_id) VALUES (?)').bind(verifiedUid).run();
                    dbUserId = created?.meta?.last_rowid || created?.meta?.last_row_id;
                } catch (userErr: any) {
                    console.error('[therapist_sessions] Failed to create basic user for session:', userErr.message);
                    return new Response(JSON.stringify({ error: 'Failed to mapped user identity' }), { status: 500, headers: corsHeaders });
                }
            }

            if (!dbUserId) {
                return new Response(JSON.stringify({ error: 'User not found and could not be provisioned' }), { status: 400, headers: corsHeaders });
            }

            // Check if session exists AND ensure ownership
            const existingRes = await db.prepare('SELECT id FROM therapist_sessions WHERE interaction_id = ? AND user_id = ?').bind(interaction_id, dbUserId).all();
            const existing = existingRes.results?.[0];

            if (existing) {
                // UPDATE
                await db.prepare(`
          UPDATE therapist_sessions 
          SET messages = ?, clinical_notes = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
          WHERE interaction_id = ? AND user_id = ?
        `).bind(
                    JSON.stringify(messages || []),
                    JSON.stringify(clinical_notes || {}),
                    summary || null,
                    interaction_id,
                    dbUserId
                ).run();

                return new Response(JSON.stringify({ success: true, action: 'updated', id: existing.id }), { headers: corsHeaders });
            } else {
                // INSERT
                const result = await db.prepare(`
          INSERT INTO therapist_sessions (user_id, interaction_id, messages, clinical_notes, summary)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
                    dbUserId,
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

            // Ensure ownership
            const run = await db.prepare('DELETE FROM therapist_sessions WHERE interaction_id = ? AND user_id = ?').bind(interactionId, dbUserId).run();

            if (run.meta?.changes === 0) {
                return new Response(JSON.stringify({ error: 'Session not found or forbidden' }), { status: 403, headers: corsHeaders });
            }

            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });

    } catch (err: any) {
        console.error('[therapist_sessions] Error:', err);
        return new Response(JSON.stringify({ 
            error: err.message || String(err),
            stack: err.stack,
            hint: 'If this is a schema error, try calling /api/migrate first'
        }), { 
            status: 500, 
            headers: corsHeaders 
        });
    }
}
