import { ensureAppSchema } from '../schema';

async function verifyRazorpaySignature(secret: string, orderId: string, paymentId: string, signature: string): Promise<boolean> {
    try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const data = encoder.encode(`${orderId}|${paymentId}`);
        const mac = await crypto.subtle.sign('HMAC', key, data);
        const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
        return expected === signature;
    } catch {
        return false;
    }
}

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

            // Validate amount (UPI/INR flow is fixed at ₹500)
            const paidAmount = Number(amount) || 0;
            if (payment_method === 'upi' && paidAmount < 500) {
                return new Response(JSON.stringify({ error: 'Invalid amount.' }), { status: 400, headers: corsHeaders });
            }

            if (payment_method === 'upi') {
                // Validate UTR format (12 digits)
                if (!utr || !/^\d{12}$/.test(utr)) {
                    return new Response(JSON.stringify({ error: 'Invalid UTR format. Must be 12 digits.' }), { status: 400, headers: corsHeaders });
                }

                // Record UPI Payment (PENDING_RECONCILIATION) — premium is granted only after admin reconciliation
                const insert = await db.prepare(
                    'INSERT INTO payments (user_id, transaction_id, amount, currency, payment_method, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(
                    user.id,
                    utr,
                    paidAmount,
                    currency || 'INR',
                    'upi',
                    'PENDING_RECONCILIATION',
                    JSON.stringify({ submitted_at: new Date().toISOString() })
                ).run();

                if (!insert.meta?.changes) {
                    return new Response(JSON.stringify({ error: 'This Transaction ID has already been submitted.' }), { status: 400, headers: corsHeaders });
                }

                return new Response(JSON.stringify({
                    success: true,
                    status: 'PENDING_RECONCILIATION',
                    is_premium: false,
                    message: 'Payment submitted. Premium activates once verified (usually within a few hours).'
                }), { headers: corsHeaders });

            } else {
                // Razorpay Logic — verify signature before granting anything
                if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
                    return new Response(JSON.stringify({ error: 'Missing Razorpay verification fields.' }), { status: 400, headers: corsHeaders });
                }

                const razorpaySecret = env.RAZORPAY_KEY_SECRET;
                if (!razorpaySecret) {
                    return new Response(JSON.stringify({ error: 'Payment gateway not configured.' }), { status: 500, headers: corsHeaders });
                }

                // Verify signature: HMAC SHA256 of order_id|payment_id with the key secret
                const signatureValid = await verifyRazorpaySignature(razorpaySecret, razorpay_order_id, razorpay_payment_id, razorpay_signature);

                if (!signatureValid) {
                    await db.prepare(
                        'INSERT INTO payments (user_id, transaction_id, amount, currency, payment_method, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
                    ).bind(
                        user.id,
                        razorpay_payment_id,
                        paidAmount,
                        currency || 'INR',
                        'razorpay',
                        'FAILED',
                        JSON.stringify({ razorpay_order_id, reason: 'invalid_signature' })
                    ).run();
                    return new Response(JSON.stringify({ error: 'Payment verification failed.' }), { status: 400, headers: corsHeaders });
                }

                await db.prepare(
                    'INSERT INTO payments (user_id, transaction_id, amount, currency, payment_method, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(
                    user.id,
                    razorpay_payment_id,
                    paidAmount,
                    currency || 'INR',
                    'razorpay',
                    'COMPLETED',
                    JSON.stringify({ razorpay_order_id })
                ).run();

                // Only now grant premium (verified Razorpay payment)
                await db.prepare('UPDATE users SET is_premium = 1 WHERE id = ?').bind(user.id).run();
                await db.prepare(
                    'INSERT INTO subscriptions (user_id, tier, status) VALUES (?, ?, ?)'
                ).bind(user.id, 'LIFETIME', 'ACTIVE').run();

                return new Response(JSON.stringify({ success: true, status: 'COMPLETED', is_premium: true }), { headers: corsHeaders });
            }
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
}
