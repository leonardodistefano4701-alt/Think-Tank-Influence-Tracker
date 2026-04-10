import Database from 'better-sqlite3';
import path from 'path';

export function getDb() {
  const dbPath = path.resolve(process.cwd(), '../ttit.db');
  return new Database(dbPath, { readonly: true });
}
