/** Movimientos (ingresos y egresos) y sus agregaciones. */

import { getDb } from '../db/client';
import { monthOf, nowTimestamp } from '../domain/dates';
import type {
  CategoryTotal,
  DateKey,
  MonthKey,
  MonthTotals,
  MovementType,
  Transaction,
  TransactionWithCategory,
} from '../domain/types';
import type { ActualMonthTotals } from '../domain/projection';
import {
  mapTransaction,
  mapTransactionWithCategory,
  type TransactionRow,
} from './mappers';

/** SELECT con los datos de categoría que necesitan los listados. */
const SELECT_WITH_CATEGORY = `
  SELECT t.*,
         c.name AS category_name,
         c.color AS category_color,
         c.icon AS category_icon
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
`;

export async function listByMonth(month: MonthKey): Promise<TransactionWithCategory[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionRow>(
    `${SELECT_WITH_CATEGORY}
     WHERE t.month = ?
     ORDER BY t.date DESC, t.id DESC`,
    [month],
  );
  return rows.map(mapTransactionWithCategory);
}

export async function listRecent(limit = 8): Promise<TransactionWithCategory[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionRow>(
    `${SELECT_WITH_CATEGORY}
     ORDER BY t.date DESC, t.id DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map(mapTransactionWithCategory);
}

export async function getTransaction(id: number): Promise<Transaction | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE id = ?',
    [id],
  );
  return row ? mapTransaction(row) : null;
}

export interface TransactionInput {
  type: MovementType;
  amount: number;
  categoryId: number | null;
  date: DateKey;
  note?: string | null;
  recurringRuleId?: number | null;
  debtInstallmentId?: number | null;
}

export async function createTransaction(input: TransactionInput): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO transactions (type, amount, category_id, date, month, note,
                               recurring_rule_id, debt_installment_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.type,
      Math.abs(Math.round(input.amount)),
      input.categoryId,
      input.date,
      // `month` se deriva de `date` para que nunca queden desalineados.
      monthOf(input.date),
      input.note?.trim() || null,
      input.recurringRuleId ?? null,
      input.debtInstallmentId ?? null,
      nowTimestamp(),
    ],
  );
  return result.lastInsertRowId;
}

export async function updateTransaction(
  id: number,
  input: Partial<TransactionInput>,
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.type !== undefined) {
    fields.push('type = ?');
    values.push(input.type);
  }
  if (input.amount !== undefined) {
    fields.push('amount = ?');
    values.push(Math.abs(Math.round(input.amount)));
  }
  if (input.categoryId !== undefined) {
    fields.push('category_id = ?');
    values.push(input.categoryId);
  }
  if (input.date !== undefined) {
    fields.push('date = ?', 'month = ?');
    values.push(input.date, monthOf(input.date));
  }
  if (input.note !== undefined) {
    fields.push('note = ?');
    values.push(input.note?.trim() || null);
  }
  if (fields.length === 0) return;

  const db = await getDb();
  await db.runAsync(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ debt_installment_id: number | null }>(
    'SELECT debt_installment_id FROM transactions WHERE id = ?',
    [id],
  );

  await db.withTransactionAsync(async () => {
    // Si el movimiento pagaba una cuota, la cuota vuelve a quedar pendiente.
    if (row?.debt_installment_id) {
      await db.runAsync(
        `UPDATE debt_installments
         SET paid = 0, paid_at = NULL, transaction_id = NULL
         WHERE id = ?`,
        [row.debt_installment_id],
      );
    }
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  });
}

/** Totales reales de un mes. */
export async function getMonthTotals(month: MonthKey): Promise<MonthTotals> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ income: number; expense: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
     FROM transactions
     WHERE month = ?`,
    [month],
  );
  const income = row?.income ?? 0;
  const expense = row?.expense ?? 0;
  return { month, income, expense, net: income - expense };
}

/**
 * Totales por mes en un rango, para alimentar la proyección con una sola
 * consulta en vez de una por mes.
 */
export async function getTotalsByMonth(
  startMonth: MonthKey,
  endMonth: MonthKey,
): Promise<Map<MonthKey, ActualMonthTotals>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    month: string;
    income: number;
    expense: number;
  }>(
    `SELECT month,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
     FROM transactions
     WHERE month BETWEEN ? AND ?
     GROUP BY month`,
    [startMonth, endMonth],
  );

  const totals = new Map<MonthKey, ActualMonthTotals>();
  for (const row of rows) {
    totals.set(row.month, { income: row.income, expense: row.expense });
  }
  return totals;
}

/**
 * Claves `${month}:${ruleId}` de las recurrentes que ya generaron movimiento.
 * La proyección las usa para no sumar dos veces el mismo sueldo o arriendo.
 */
export async function getMaterializedRuleKeys(
  startMonth: MonthKey,
  endMonth: MonthKey,
): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ month: string; recurring_rule_id: number }>(
    `SELECT DISTINCT month, recurring_rule_id
     FROM transactions
     WHERE recurring_rule_id IS NOT NULL AND month BETWEEN ? AND ?`,
    [startMonth, endMonth],
  );
  return new Set(rows.map((row) => `${row.month}:${row.recurring_rule_id}`));
}

/** Gasto o ingreso del mes agrupado por categoría, ordenado de mayor a menor. */
export async function getCategoryTotals(
  month: MonthKey,
  type: MovementType,
): Promise<CategoryTotal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    category_id: number | null;
    category_name: string | null;
    category_color: string | null;
    category_icon: string | null;
    total: number;
  }>(
    `SELECT t.category_id,
            c.name AS category_name,
            c.color AS category_color,
            c.icon AS category_icon,
            SUM(t.amount) AS total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.month = ? AND t.type = ?
     GROUP BY t.category_id
     ORDER BY total DESC`,
    [month, type],
  );

  const grandTotal = rows.reduce((accumulator, row) => accumulator + row.total, 0);

  return rows.map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name ?? 'Sin categoría',
    categoryColor: row.category_color ?? '#94a3b8',
    categoryIcon: row.category_icon ?? '📦',
    type,
    total: row.total,
    share: grandTotal > 0 ? Math.round((row.total / grandTotal) * 100) : 0,
  }));
}

/**
 * Neto acumulado de los movimientos anteriores a un mes.
 *
 * Es lo que ancla la proyección: el saldo con el que arranca un mes es el saldo
 * inicial del perfil más todo lo que se movió antes de ese mes.
 */
export async function getNetBeforeMonth(month: MonthKey): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ net: number }>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) AS net
     FROM transactions
     WHERE month < ?`,
    [month],
  );
  return row?.net ?? 0;
}

/** Neto acumulado incluyendo el mes indicado. */
export async function getNetThroughMonth(month: MonthKey): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ net: number }>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) AS net
     FROM transactions
     WHERE month <= ?`,
    [month],
  );
  return row?.net ?? 0;
}

/** Meses que tienen al menos un movimiento, del más reciente al más antiguo. */
export async function listMonthsWithData(): Promise<MonthKey[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ month: string }>(
    'SELECT DISTINCT month FROM transactions ORDER BY month DESC',
  );
  return rows.map((row) => row.month);
}
