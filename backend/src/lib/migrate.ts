import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { logger } from './logger';

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = path.join(__dirname, '../../migrations');
  let files: string[];
  try {
    files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch {
    logger.error({ migrationsDir }, 'migrations directory not found');
    await conn.end();
    process.exit(1);
  }

  for (const file of files) {
    const [rows] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT filename FROM schema_migrations WHERE filename = ?',
      [file]
    );
    if (rows.length > 0) {
      logger.info({ file }, 'skip');
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await conn.execute(sql);
    await conn.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
    logger.info({ file }, 'apply');
  }

  await conn.end();
  logger.info('migrations complete');
}

migrate().catch(err => {
  logger.error(err, 'migration failed');
  process.exit(1);
});
