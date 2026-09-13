import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * The database is a read-only, immutable build artifact that ships inside the
 * deployment, so it is opened once per process and reused.
 *
 * The file lives at web/data/ttit.db. In the Docker image (Railway) the
 * Dockerfile copies it to /app/data/ttit.db and sets DB_PATH; locally it is
 * found under web/data/ relative to the working directory.
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
