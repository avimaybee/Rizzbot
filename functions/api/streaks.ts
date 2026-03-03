import { ensureAppSchema } from './schema';

const getDB = (env: any) =>
  env.RIZZBOT_DATA ||
  env.RIZZBOT ||
  env.RIZZBOT_DB ||
  env.RIZZBOT_D1 ||
  env.RIZZBOT_DATASET ||
  env["rizzbot data"] ||
  env.DB ||
  env.D1_DB ||
  env.__D1_NAMESPACES__?.DB;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
  'Content-Type': 'application/json',
};

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestGet = async (context: any) => {
  const { env, request, data } = context;
  const db = getDB(env);
  if (!db) return new Response(JSON.stringify({ error: 'No database' }), { status: 500, headers: corsHeaders });

  // Ensure authenticated user exists in context
  const authenticatedUser = data?.user;
  if (!authenticatedUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized: No verified user context' }), {
      status: 401,
      headers: corsHeaders,
    });
  }
  const verifiedUid = authenticatedUser.uid;

  const url = new URL(request.url);
  const reqAnonId = url.searchParams.get('anon_id');
  if (reqAnonId && reqAnonId !== verifiedUid) {
    return new Response(JSON.stringify({ error: 'Forbidden: Cannot access other users\' data' }), { status: 403, headers: corsHeaders });
  }

  try {
    await ensureAppSchema(db);

    const user = await db.prepare('SELECT id FROM users WHERE anon_id = ?').bind(verifiedUid).first();
    if (!user) {
      return new Response(JSON.stringify({ streak: { current_streak: 0, longest_streak: 0, last_active_date: null } }), { headers: corsHeaders });
    }

    const streak = await db.prepare('SELECT current_streak, longest_streak, last_active_date FROM streaks WHERE user_id = ?').bind(user.id).first();
    return new Response(JSON.stringify({
      streak: streak || { current_streak: 0, longest_streak: 0, last_active_date: null }
    }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
};

export const onRequestPost = async (context: any) => {
  const { env, data } = context;
  const db = getDB(env);
  if (!db) return new Response(JSON.stringify({ error: 'No database' }), { status: 500, headers: corsHeaders });

  // Ensure authenticated user exists in context
  const authenticatedUser = data?.user;
  if (!authenticatedUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized: No verified user context' }), {
      status: 401,
      headers: corsHeaders,
    });
  }
  const verifiedUid = authenticatedUser.uid;

  try {
    await ensureAppSchema(db);

    const user = await db.prepare('SELECT id FROM users WHERE anon_id = ?').bind(verifiedUid).first();
    if (!user) {
      const todayForNewUser = new Date().toISOString().split('T')[0];
      await db.prepare('INSERT INTO users (anon_id) VALUES (?)').bind(verifiedUid).run();
      const newUser = await db.prepare('SELECT id FROM users WHERE anon_id = ?').bind(verifiedUid).first();
      if (!newUser) {
        throw new Error(`Failed to create user for anon_id: ${verifiedUid}`);
      }
      await db
        .prepare('INSERT INTO streaks (user_id, current_streak, longest_streak, last_active_date) VALUES (?, 1, 1, ?)')
        .bind(newUser.id, todayForNewUser)
        .run();
      return new Response(JSON.stringify({ streak: { current_streak: 1, longest_streak: 1, last_active_date: todayForNewUser } }), { headers: corsHeaders });
    }

    const today = new Date().toISOString().split('T')[0];
    const existing = await db.prepare('SELECT current_streak, longest_streak, last_active_date FROM streaks WHERE user_id = ?').bind(user.id).first() as any;

    if (!existing) {
      await db.prepare('INSERT INTO streaks (user_id, current_streak, longest_streak, last_active_date) VALUES (?, 1, 1, ?)').bind(user.id, today).run();
      return new Response(JSON.stringify({ streak: { current_streak: 1, longest_streak: 1, last_active_date: today } }), { headers: corsHeaders });
    }

    if (existing.last_active_date === today) {
      return new Response(JSON.stringify({ streak: existing }), { headers: corsHeaders });
    }

    const lastDate = new Date(existing.last_active_date);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    let newStreak: number;
    if (diffDays === 1) {
      newStreak = existing.current_streak + 1;
    } else {
      newStreak = 1;
    }

    const newLongest = Math.max(existing.longest_streak, newStreak);

    await db.prepare('UPDATE streaks SET current_streak = ?, longest_streak = ?, last_active_date = ?, updated_at = datetime(\'now\') WHERE user_id = ?')
      .bind(newStreak, newLongest, today, user.id).run();

    return new Response(JSON.stringify({ streak: { current_streak: newStreak, longest_streak: newLongest, last_active_date: today } }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
};
