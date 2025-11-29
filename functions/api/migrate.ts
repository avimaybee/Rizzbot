export async function onRequest(context: any) {
  const { env, request } = context;
  const db = env.RIZZBOT_DATA || env.RIZZBOT || env.RIZZBOT_DB || env.RIZZBOT_D1 || env.RIZZBOT_DATASET;

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!db) {
    console.error('[migrate.ts] D1 binding not found. Available env keys:', Object.keys(env));
    return new Response(JSON.stringify({ 
      error: 'D1 binding not found. Check your Pages project bindings.',
      tried: ['RIZZBOT_DATA', 'RIZZBOT', 'RIZZBOT_DB', 'RIZZBOT_D1', 'RIZZBOT_DATASET'],
      availableBindings: Object.keys(env).filter(k => !k.startsWith('__')),
      hint: 'Go to Cloudflare Pages > Settings > Functions > D1 database bindings'
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  // Simple in-function list of migrations. Keep ids stable.
  const migrations: Array<{ id: string; sql: string }> = [
    {
      id: '000_create_migrations_table',
      sql: `
CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`,
    },
    // create users and feedback first so sessions can reference users
    {
      id: '002_create_users_and_feedback',
      sql: `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anon_id TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source TEXT,
  suggestion_type TEXT,
  rating INTEGER,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`,
    },
    {
      id: '001_create_sessions',
      sql: `
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  result TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`,
    },
    {
      id: '003_create_personas',
      sql: `
CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  relationship_context TEXT,
  harshness_level INTEGER,
  communication_tips TEXT,
  conversation_starters TEXT,
  things_to_avoid TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS style_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  emoji_usage TEXT,
  capitalization TEXT,
  punctuation TEXT,
  average_length TEXT,
  slang_level TEXT,
  signature_patterns TEXT,
  preferred_tone TEXT,
  raw_samples TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`,
    },
    {
      id: '004_add_firebase_user_fields',
      sql: `
-- Add Firebase user fields to users table
-- Using separate statements for SQLite compatibility
ALTER TABLE users ADD COLUMN email TEXT;
`,
    },
    {
      id: '004b_add_display_name',
      sql: `ALTER TABLE users ADD COLUMN display_name TEXT;`,
    },
    {
      id: '004c_add_photo_url',
      sql: `ALTER TABLE users ADD COLUMN photo_url TEXT;`,
    },
    {
      id: '004d_add_provider',
      sql: `ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'unknown';`,
    },
    {
      id: '004e_add_last_login',
      sql: `ALTER TABLE users ADD COLUMN last_login_at TEXT;`,
    },
    {
      id: '005_create_indexes',
      sql: `
CREATE INDEX IF NOT EXISTS idx_users_anon_id ON users(anon_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id);
CREATE INDEX IF NOT EXISTS idx_style_profiles_user_id ON style_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
`,
    },
  ];

  try {
    // Ensure migrations table exists (in case it's the first run)
    await db.prepare(migrations[0].sql).run();

    const applied = await db.prepare('SELECT id FROM migrations').all();
    const appliedIds = new Set((applied.results || []).map((r: any) => r.id));

    const appliedNow: string[] = [];
    const errors: Array<{id: string, error: string}> = [];

    for (const m of migrations) {
      if (appliedIds.has(m.id)) continue;
      try {
        // Run migration SQL
        await db.prepare(m.sql).run();
        // Record it
        await db.prepare('INSERT INTO migrations (id) VALUES (?)').bind(m.id).run();
        appliedNow.push(m.id);
      } catch (migrationError: any) {
        // Some migrations might fail if columns already exist (ALTER TABLE)
        // Try to continue with other migrations
        const errorMsg = migrationError.message || String(migrationError);
        console.warn(`[migrate.ts] Migration ${m.id} failed:`, errorMsg);
        
        // If it's a "column already exists" error, mark as applied anyway
        if (errorMsg.includes('duplicate column') || errorMsg.includes('already exists')) {
          try {
            await db.prepare('INSERT INTO migrations (id) VALUES (?)').bind(m.id).run();
            appliedNow.push(m.id + ' (skipped - already exists)');
          } catch (e) {
            // Ignore
          }
        } else {
          errors.push({ id: m.id, error: errorMsg });
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      applied: appliedNow,
      errors: errors.length > 0 ? errors : undefined,
      totalMigrations: migrations.length,
      alreadyApplied: appliedIds.size
    }), { headers: corsHeaders });
  } catch (err: any) {
    console.error('[migrate.ts] Error:', err.message, err.stack);
    return new Response(JSON.stringify({ 
      error: err.message || String(err),
      stack: err.stack 
    }), { 
      status: 500, 
      headers: corsHeaders,
    });
  }
}
