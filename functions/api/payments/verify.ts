import { ensureAppSchema } from '../schema';

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
    if (!authenticatedUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    if (!db) {
        return new Response(JSON.stringify({ error: 'D1 binding not found' }), { status: 500, headers: corsHeaders });
    }

    try {
        await ensureAppSchema(db);

        if (request.method === 'POST') {
            const { payment_method, utr, razorpay_payment_id, razorpay_order_id, razorpay_signature, amount, currency } = await request.json();

            // 1. Get user ID
            const user = await db.prepare('SELECT id FROM users WHERE anon_id = ?').bind(authenticatedUser.uid).first();
            if (!user) {
                return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: corsHeaders });
            }

            if (payment_method === 'upi') {
                // Validate UTR format (12 digits)
                if (!utr || !/^\d{12}$/.test(utr)) {
                    return new Response(JSON.stringify({ error: 'Invalid UTR format. Must be 12 digits.' }), { status: 400, headers: corsHeaders });
                }

                // Check for duplicate UTR
                const existing = await db.prepare('SELECT id FROM payments WHERE transaction_id = ?').bind(utr).first();
                if (existing) {
                    return new Response(JSON.stringify({ error: 'This Transaction ID has already been submitted.' }), { status: 400, headers: corsHeaders });
                }

                // Record UPI Payment (PENDING_RECONCILIATION)
                await db.prepare(
                    'INSERT INTO payments (user_id, transaction_id, amount, currency, payment_method, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(
                    user.id,
                    utr,
                    amount || 500,
                    currency || 'INR',
                    'upi',
                    'PENDING_RECONCILIATION',
                    JSON.stringify({ submitted_at: new Date().toISOString() })
                ).run();

            } else {
                // Razorpay Logic (Existing)
                // In a real production app, verify the Razorpay signature here.
                await db.prepare(
                    'INSERT INTO payments (user_id, transaction_id, amount, currency, payment_method, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(
                    user.id,
                    razorpay_payment_id,
                    amount,
                    currency,
                    'razorpay',
                    'COMPLETED',
                    JSON.stringify({ razorpay_order_id, razorpay_signature })
                ).run();
            }

            // 3. Update User to Premium (LIFETIME) - Optimistic/Instant Automation
            await db.prepare('UPDATE users SET is_premium = 1 WHERE id = ?').bind(user.id).run();

            // 4. Create Subscription record
            await db.prepare(
                'INSERT INTO subscriptions (user_id, tier, status) VALUES (?, ?, ?)'
            ).bind(user.id, 'LIFETIME', 'ACTIVE').run();

            return new Response(JSON.stringify({ success: true, is_premium: true }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
}
