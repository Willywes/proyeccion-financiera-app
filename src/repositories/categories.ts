/** Categorías de ingresos y egresos. */

import { getDb } from '../db/client';
import { DEBT_CATEGORY_NAME } from '../db/seed';
import { nowTimestamp } from '../domain/dates';
import type { Category, MovementType } from '../domain/types';
import { mapCategory, type CategoryRow } from './mappers';

/** Lista las categorías activas; opcionalmente filtra por tipo. */
export async function listCategories(type?: MovementType): Promise<Category[]> {
  const db = await getDb();
  const rows = type
    ? await db.getAllAsync<CategoryRow>(
        `SELECT * FROM categories
         WHERE archived_at IS NULL AND type = ?
         ORDER BY name COLLATE NOCASE`,
        [type],
      )
    : await db.getAllAsync<CategoryRow>(
        `SELECT * FROM categories
         WHERE archived_at IS NULL
         ORDER BY type DESC, name COLLATE NOCASE`,
      );
  return rows.map(mapCategory);
}

/** Incluye archivadas, para poder mostrar el nombre en movimientos antiguos. */
export async function listAllCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories ORDER BY type DESC, name COLLATE NOCASE',
  );
  return rows.map(mapCategory);
}

export async function getCategory(id: number): Promise<Category | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CategoryRow>(
    'SELECT * FROM categories WHERE id = ?',
    [id],
  );
  return row ? mapCategory(row) : null;
}

/** Categoría a la que se imputan los pagos de cuotas por defecto. */
export async function getDebtCategoryId(): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM categories
     WHERE name = ? AND type = 'expense'
     ORDER BY archived_at IS NOT NULL, id
     LIMIT 1`,
    [DEBT_CATEGORY_NAME],
  );
  return row?.id ?? null;
}

export interface CategoryInput {
  name: string;
  type: MovementType;
  color: string;
  icon: string;
}

export async function createCategory(input: CategoryInput): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO categories (name, type, color, icon, is_default)
     VALUES (?, ?, ?, ?, 0)`,
    [input.name.trim(), input.type, input.color, input.icon],
  );
  return result.lastInsertRowId;
}

export async function updateCategory(
  id: number,
  input: Partial<CategoryInput>,
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (input.name !== undefined) {
    fields.push('name = ?');
    values.push(input.name.trim());
  }
  if (input.type !== undefined) {
    fields.push('type = ?');
    values.push(input.type);
  }
  if (input.color !== undefined) {
    fields.push('color = ?');
    values.push(input.color);
  }
  if (input.icon !== undefined) {
    fields.push('icon = ?');
    values.push(input.icon);
  }
  if (fields.length === 0) return;

  const db = await getDb();
  await db.runAsync(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
}

/**
 * Se archiva en lugar de borrar: los movimientos históricos conservan su
 * categoría y el historial no cambia de forma retroactiva.
 */
export async function archiveCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET archived_at = ? WHERE id = ?', [
    nowTimestamp(),
    id,
  ]);
}

export async function restoreCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET archived_at = NULL WHERE id = ?', [id]);
}

/** Cuántos movimientos usan la categoría; se muestra antes de archivarla. */
export async function countCategoryUsage(id: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM transactions WHERE category_id = ?',
    [id],
  );
  return row?.total ?? 0;
}
