import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * The database is a read-only, immutable build artifact that ships inside the
 * deployment, so it is opened once per process and reused.
 *
 * It previously lived at the repo root and was resolved as
 * `path.resolve(process.cwd(), '../ttit.db')`. That path is outside the Next
 * project root, so Next's file tracer never bundled it and the file did not
 * exist at runtime on Vercel — every page threw SQLITE_CANTOPEN. It now lives
 * under web/data/ and is pulled in via outputFileTracingIncludes in
 * next.config.ts.
 *
 * A new Database() per request also leaked a file descriptor on every request,
 * because nothing ever called .close().
 */
let db: Database.Database | null = null;

function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;

  // cwd differs between `next dev`, `next start` and a serverless bundle, so
  // try the candidates rather than assuming one.
  const candidates = [
    path.join(process.cwd(), 'data', 'ttit.db'),
    path.join(process.cwd(), 'web', 'data', 'ttit.db'),
    path.join(process.cwd(), '..', 'web', 'data', 'ttit.db'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

export function getDb(): Database.Database {
  if (db) return db;
  const dbPath = resolveDbPath();
  db = new Database(dbPath, { readonly: true, fileMustExist: true });
  // The file never changes at runtime; let SQLite keep more of it cached.
  db.pragma('cache_size = -32000');
  return db;
}
