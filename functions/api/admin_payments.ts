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

    const authenticatedUser = data?.user;
    // Simple Admin Check: For now, we'll use a hardcoded email or just allow the owner's UID if known.
    // Ideally, this should be a role in the DB.
    // For this quick project, we'll check if the email belongs to the user who provided it.
    const isAdmin = authenticatedUser?.email === 'avimaybe7@gmail.com'; // Placeholder for Avi's email based on UPI

    if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: corsHeaders });
    }

    try {
        await ensureAppSchema(db);

        if (request.method === 'GET') {
            // List payments with user info
            const payments = await db.prepare(`
                SELECT p.*, u.email as user_email, u.anon_id as user_uid
                FROM payments p
                JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
                LIMIT 100
            `).all();

            return new Response(JSON.stringify(payments.results), { headers: corsHeaders });
        }

        if (request.method === 'POST') {
            const { payment_id, status } = await request.json();

            // Update status (e.g. COMPLETED or REJECTED)
            await db.prepare('UPDATE payments SET status = ? WHERE id = ?')
                .bind(status, payment_id)
                .run();

            // If rejected, remove premium
            if (status === 'REJECTED') {
                const payment = await db.prepare('SELECT user_id FROM payments WHERE id = ?').bind(payment_id).first();
                if (payment) {
                    await db.prepare('UPDATE users SET is_premium = 0 WHERE id = ?').bind(payment.user_id).run();
                }
            }

            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
}
