type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => { run: () => Promise<unknown> };
    run: () => Promise<unknown>;
  };
};

const ensureSchemaPromises = new WeakMap<D1Database, Promise<void>>();

const IGNORABLE_SCHEMA_ERRORS = [
  "duplicate column name",
  "already exists",
  "duplicate index",
];

const isIgnorableSchemaError = (message: string): boolean => {
  const lower = message.toLowerCase();
  return IGNORABLE_SCHEMA_ERRORS.some((fragment) => lower.includes(fragment));
};

const runSchemaStatement = async (db: D1Database, sql: string): Promise<void> => {
  try {
    await db.prepare(sql).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isIgnorableSchemaError(message)) {
      return;
    }
    throw error;
  }
};

const ensureSchemaInternal = async (db: D1Database): Promise<void> => {
  await runSchemaStatement(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anon_id TEXT UNIQUE,
      email TEXT,
      display_name TEXT,
      photo_url TEXT,
      provider TEXT DEFAULT 'unknown',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT
    )`
  );

  await runSchemaStatement(db, `ALTER TABLE users ADD COLUMN email TEXT`);
  await runSchemaStatement(db, `ALTER TABLE users ADD COLUMN display_name TEXT`);
  await runSchemaStatement(db, `ALTER TABLE users ADD COLUMN photo_url TEXT`);
  await runSchemaStatement(db, `ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'unknown'`);
  await runSchemaStatement(db, `ALTER TABLE users ADD COLUMN last_login_at TEXT`);

  await runSchemaStatement(
    db,
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      result TEXT,
      mode TEXT,
      persona_name TEXT,
      headline TEXT,
      ghost_risk INTEGER,
      message_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await runSchemaStatement(db, `ALTER TABLE sessions ADD COLUMN mode TEXT`);
  await runSchemaStatement(db, `ALTER TABLE sessions ADD COLUMN persona_name TEXT`);
  await runSchemaStatement(db, `ALTER TABLE sessions ADD COLUMN headline TEXT`);
  await runSchemaStatement(db, `ALTER TABLE sessions ADD COLUMN ghost_risk INTEGER`);
  await runSchemaStatement(db, `ALTER TABLE sessions ADD COLUMN message_count INTEGER DEFAULT 0`);

  await runSchemaStatement(
    db,
    `CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      source TEXT,
      suggestion_type TEXT,
      rating INTEGER,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await runSchemaStatement(
    db,
    `CREATE TABLE IF NOT EXISTS personas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT,
      relationship_context TEXT,
      harshness_level INTEGER,
      communication_tips TEXT,
      conversation_starters TEXT,
      things_to_avoid TEXT,
      tone TEXT,
      style TEXT,
      habits TEXT,
      red_flags TEXT,
      green_flags TEXT,
      their_language TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await runSchemaStatement(db, `ALTER TABLE personas ADD COLUMN tone TEXT`);
  await runSchemaStatement(db, `ALTER TABLE personas ADD COLUMN style TEXT`);
  await runSchemaStatement(db, `ALTER TABLE personas ADD COLUMN habits TEXT`);
  await runSchemaStatement(db, `ALTER TABLE personas ADD COLUMN red_flags TEXT`);
  await runSchemaStatement(db, `ALTER TABLE personas ADD COLUMN green_flags TEXT`);
  await runSchemaStatement(db, `ALTER TABLE personas ADD COLUMN their_language TEXT`);

  await runSchemaStatement(
    db,
    `CREATE TABLE IF NOT EXISTS style_profiles (
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
      ai_summary TEXT,
      favorite_emojis TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await runSchemaStatement(db, `ALTER TABLE style_profiles ADD COLUMN ai_summary TEXT`);
  await runSchemaStatement(db, `ALTER TABLE style_profiles ADD COLUMN favorite_emojis TEXT`);

  await runSchemaStatement(
    db,
    `CREATE TABLE IF NOT EXISTS therapist_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      interaction_id TEXT UNIQUE NOT NULL,
      messages TEXT NOT NULL,
      clinical_notes TEXT,
      summary TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await runSchemaStatement(db, `ALTER TABLE therapist_sessions ADD COLUMN summary TEXT`);

  await runSchemaStatement(
    db,
    `CREATE TABLE IF NOT EXISTS therapist_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      creator TEXT DEFAULT 'USER',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await runSchemaStatement(db, `ALTER TABLE therapist_memories ADD COLUMN creator TEXT DEFAULT 'USER'`);

  await runSchemaStatement(
    db,
    `CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_active_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );

  await runSchemaStatement(db, `ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT 0`);
  await runSchemaStatement(db, `ALTER TABLE users ADD COLUMN premium_until TIMESTAMP`);

  await runSchemaStatement(
    db,
    `CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      transaction_id TEXT UNIQUE,
      amount INTEGER,
      currency TEXT,
      payment_method TEXT,
      status TEXT, -- 'PENDING', 'COMPLETED', 'FAILED'
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await runSchemaStatement(
    db,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      tier TEXT, -- 'LIFETIME', 'MONTHLY'
      status TEXT, -- 'ACTIVE', 'EXPIRED'
      starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ends_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await runSchemaStatement(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_anon_id ON users(anon_id)`);
  await runSchemaStatement(db, `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  await runSchemaStatement(db, `CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)`);
  await runSchemaStatement(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id)`);
  await runSchemaStatement(db, `CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`);
  await runSchemaStatement(db, `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  await runSchemaStatement(db, `CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC)`);
  await runSchemaStatement(db, `CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id)`);
  await runSchemaStatement(db, `CREATE INDEX IF NOT EXISTS idx_style_profiles_user_id ON style_profiles(user_id)`);
  await runSchemaStatement(db, `CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)`);
  await runSchemaStatement(db, `CREATE INDEX IF NOT EXISTS idx_therapist_sessions_user_id ON therapist_sessions(user_id)`);
  await runSchemaStatement(db, `CREATE INDEX IF NOT EXISTS idx_therapist_sessions_updated_at ON therapist_sessions(updated_at DESC)`);
  await runSchemaStatement(db, `CREATE INDEX IF NOT EXISTS idx_therapist_memories_user_type ON therapist_memories(user_id, type)`);
  await runSchemaStatement(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_streaks_user_id ON streaks(user_id)`);
};

export async function ensureAppSchema(db: D1Database): Promise<void> {
  let ensureSchemaPromise = ensureSchemaPromises.get(db);
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = ensureSchemaInternal(db).catch((error) => {
      ensureSchemaPromises.delete(db);
      throw error;
    });
    ensureSchemaPromises.set(db, ensureSchemaPromise);
  }
  await ensureSchemaPromise;
}
