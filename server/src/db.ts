/**
 * Context Server — Database Layer (libSQL/Turso)
 *
 * Supports:
 * - Local SQLite file (TURSO_DATABASE_URL=file:./data/context.db)
 * - Remote Turso database (TURSO_DATABASE_URL=libsql://...)
 */

import { createClient, type Client } from "@libsql/client";

let db: Client;

export function getDb(): Client {
  if (!db) {
    const url = process.env.TURSO_DATABASE_URL || "file:./data/context.db";
    const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
    db = createClient({ url, authToken });
  }
  return db;
}

export async function initDb(): Promise<void> {
  const client = getDb();

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      channel TEXT NOT NULL,
      group_id TEXT NOT NULL,
      channel_id TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      webhook_url TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_spaces_lookup ON spaces(channel, group_id);

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space_id TEXT NOT NULL,
      path TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT 'text/plain',
      version INTEGER NOT NULL DEFAULT 1,
      modified_by TEXT NOT NULL DEFAULT 'unknown',
      size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(space_id, path)
    );

    CREATE INDEX IF NOT EXISTS idx_files_space ON files(space_id);

    CREATE TABLE IF NOT EXISTS file_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space_id TEXT NOT NULL,
      path TEXT NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      modified_by TEXT NOT NULL,
      saved_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_history_file ON file_history(space_id, path);

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'human',
      role TEXT,
      channel_user_id TEXT,
      capabilities TEXT,
      added_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_members_space ON members(space_id);

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      line INTEGER NOT NULL DEFAULT 0,
      end_line INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      author_type TEXT NOT NULL DEFAULT 'human',
      status TEXT NOT NULL DEFAULT 'open',
      resolved_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_annotations_space ON annotations(space_id);
    CREATE INDEX IF NOT EXISTS idx_annotations_file ON annotations(space_id, file_path);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL,
      type TEXT NOT NULL,
      channel TEXT,
      target TEXT,
      message TEXT NOT NULL,
      created_by TEXT NOT NULL,
      sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_space ON notifications(space_id, sent);

    CREATE TABLE IF NOT EXISTS file_blobs (
      space_id TEXT NOT NULL,
      path TEXT NOT NULL,
      data BLOB NOT NULL,
      PRIMARY KEY(space_id, path)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS user_spaces (
      user_id TEXT NOT NULL,
      space_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      PRIMARY KEY(user_id, space_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_spaces_user ON user_spaces(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_spaces_space ON user_spaces(space_id);
  `);
}
