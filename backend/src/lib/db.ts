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

export async function executeInsert(sql: string, params?: any[]): Promise<number> {
  const [result] = await pool.execute<mysql.ResultSetHeader>(sql, params);
  return result.insertId;
}

export async function executeAffected(sql: string, params?: any[]): Promise<number> {
  const [result] = await pool.execute<mysql.ResultSetHeader>(sql, params);
  return result.affectedRows;
}

export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
