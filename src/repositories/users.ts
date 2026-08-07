/** Perfil local único. La app es de un solo usuario por dispositivo. */

import { getDb } from '../db/client';
import { nowTimestamp } from '../domain/dates';
import { DEFAULT_CURRENCY } from '../domain/money';
import type { User } from '../domain/types';
import { mapUser, type UserRow } from './mappers';

export async function getUser(): Promise<User | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<UserRow>(
    'SELECT * FROM users ORDER BY id LIMIT 1',
  );
  return row ? mapUser(row) : null;
}

export async function hasUser(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM users',
  );
  return (row?.total ?? 0) > 0;
}

export interface CreateUserInput {
  name: string;
  pinHash: string;
  pinSalt: string;
  currency?: string;
  openingBalance?: number;
  projectionMonths?: number;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO users (name, pin_hash, pin_salt, currency, opening_balance,
                        projection_months, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name.trim(),
      input.pinHash,
      input.pinSalt,
      input.currency ?? DEFAULT_CURRENCY,
      input.openingBalance ?? 0,
      input.projectionMonths ?? 12,
      nowTimestamp(),
    ],
  );

  const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [
    result.lastInsertRowId,
  ]);
  if (!row) throw new Error('No se pudo crear el perfil');
  return mapUser(row);
}

export interface UpdateUserInput {
  name?: string;
  currency?: string;
  openingBalance?: number;
  projectionMonths?: number;
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<void> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (input.name !== undefined) {
    fields.push('name = ?');
    values.push(input.name.trim());
  }
  if (input.currency !== undefined) {
    fields.push('currency = ?');
    values.push(input.currency);
  }
  if (input.openingBalance !== undefined) {
    fields.push('opening_balance = ?');
    values.push(input.openingBalance);
  }
  if (input.projectionMonths !== undefined) {
    fields.push('projection_months = ?');
    values.push(input.projectionMonths);
  }
  if (fields.length === 0) return;

  const db = await getDb();
  await db.runAsync(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
}

export async function updateUserPin(
  id: number,
  pinHash: string,
  pinSalt: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE users SET pin_hash = ?, pin_salt = ? WHERE id = ?', [
    pinHash,
    pinSalt,
    id,
  ]);
}
