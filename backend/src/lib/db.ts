import mysql from 'mysql2/promise';
import { config } from './config';

export const pool = mysql.createPool({
  uri: config.databaseUrl,
  connectionLimit: 20,
  waitForConnections: true,
});

export async function query<T>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

export async function queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params?: any[]): Promise<void> {
  await pool.execute(sql, params);
}
