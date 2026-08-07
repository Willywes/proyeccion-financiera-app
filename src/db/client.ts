/**
 * Acceso a la base SQLite local del dispositivo.
 *
 * La conexión se abre una única vez y se memoiza como promesa, de modo que
 * varias pantallas montándose en paralelo comparten la misma conexión y las
 * migraciones corren una sola vez. Los repositorios llaman `getDb()`.
 */

import {
  openDatabaseAsync,
  deleteDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';
import { runMigrations } from './migrations';
import { seedDefaults } from './seed';

export const DATABASE_NAME = 'misfinanzas.db';

let connection: Promise<SQLiteDatabase> | null = null;

async function connect(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await runMigrations(db);
  await seedDefaults(db);
  return db;
}

export function getDb(): Promise<SQLiteDatabase> {
  if (!connection) {
    connection = connect().catch((error) => {
      // Si la apertura falla se descarta la promesa memoizada para que el
      // siguiente intento pueda reintentar en vez de quedar pegado en el error.
      connection = null;
      throw error;
    });
  }
  return connection;
}

/**
 * Borra la base por completo y la deja lista de nuevo, ya migrada y sembrada.
 * La usa la opción "borrar todos mis datos" de Ajustes.
 */
export async function resetDatabase(): Promise<void> {
  if (connection) {
    const db = await connection.catch(() => null);
    await db?.closeAsync();
    connection = null;
  }
  await deleteDatabaseAsync(DATABASE_NAME);
  await getDb();
}
