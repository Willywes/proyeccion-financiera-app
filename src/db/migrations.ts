/**
 * Migraciones de la base local.
 *
 * El versionado usa `PRAGMA user_version`, que SQLite guarda en el archivo.
 * Para cambiar el schema se agrega una entrada nueva al final de `MIGRATIONS`
 * y se sube `SCHEMA_VERSION`; nunca se edita una migración ya publicada,
 * porque los dispositivos que ya la corrieron no la volverían a ejecutar.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const SCHEMA_VERSION = 1;

interface Migration {
  version: number;
  /** SQL idempotente en lo posible; corre dentro de una transacción. */
  statements: string[];
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT NOT NULL,
         pin_hash TEXT NOT NULL,
         pin_salt TEXT NOT NULL,
         currency TEXT NOT NULL DEFAULT 'CLP',
         opening_balance INTEGER NOT NULL DEFAULT 0,
         projection_months INTEGER NOT NULL DEFAULT 12,
         created_at TEXT NOT NULL
       )`,

      `CREATE TABLE IF NOT EXISTS categories (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT NOT NULL,
         type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
         color TEXT NOT NULL DEFAULT '#6366f1',
         icon TEXT NOT NULL DEFAULT '📦',
         is_default INTEGER NOT NULL DEFAULT 0,
         archived_at TEXT
       )`,
      `CREATE INDEX IF NOT EXISTS idx_categories_type ON categories (type, archived_at)`,

      `CREATE TABLE IF NOT EXISTS debts (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT NOT NULL,
         kind TEXT NOT NULL DEFAULT 'other'
           CHECK (kind IN ('loan', 'credit_card', 'installment', 'other')),
         principal INTEGER NOT NULL,
         annual_rate REAL NOT NULL DEFAULT 0,
         installments_total INTEGER NOT NULL,
         start_month TEXT NOT NULL,
         category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
         note TEXT,
         closed_at TEXT,
         created_at TEXT NOT NULL
       )`,

      `CREATE TABLE IF NOT EXISTS debt_installments (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         debt_id INTEGER NOT NULL REFERENCES debts (id) ON DELETE CASCADE,
         number INTEGER NOT NULL,
         due_month TEXT NOT NULL,
         due_date TEXT NOT NULL,
         amount INTEGER NOT NULL,
         principal_part INTEGER NOT NULL DEFAULT 0,
         interest_part INTEGER NOT NULL DEFAULT 0,
         paid INTEGER NOT NULL DEFAULT 0,
         paid_at TEXT,
         transaction_id INTEGER,
         UNIQUE (debt_id, number)
       )`,
      `CREATE INDEX IF NOT EXISTS idx_installments_pending
         ON debt_installments (paid, due_month)`,
      `CREATE INDEX IF NOT EXISTS idx_installments_debt
         ON debt_installments (debt_id, number)`,

      `CREATE TABLE IF NOT EXISTS recurring_rules (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT NOT NULL,
         type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
         amount INTEGER NOT NULL,
         category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
         day_of_month INTEGER NOT NULL DEFAULT 1
           CHECK (day_of_month BETWEEN 1 AND 31),
         start_month TEXT NOT NULL,
         end_month TEXT,
         active INTEGER NOT NULL DEFAULT 1,
         created_at TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS idx_recurring_active
         ON recurring_rules (active, start_month)`,

      `CREATE TABLE IF NOT EXISTS transactions (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
         amount INTEGER NOT NULL CHECK (amount >= 0),
         category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
         date TEXT NOT NULL,
         month TEXT NOT NULL,
         note TEXT,
         recurring_rule_id INTEGER REFERENCES recurring_rules (id) ON DELETE SET NULL,
         debt_installment_id INTEGER REFERENCES debt_installments (id) ON DELETE SET NULL,
         created_at TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_month ON transactions (month, type)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category_id)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_rule
         ON transactions (recurring_rule_id, month)`,
    ],
  },
];

/** Aplica las migraciones que falten. Seguro de llamar en cada arranque. */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // WAL mejora la concurrencia entre lecturas y escrituras en el dispositivo.
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= SCHEMA_VERSION) return;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;

    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
    });
    // `PRAGMA user_version` no acepta parámetros enlazados, y el valor es un
    // entero literal de este archivo, no entrada del usuario.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }
}
