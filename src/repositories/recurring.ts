/**
 * Reglas recurrentes: los ingresos y egresos fijos que se repiten cada mes.
 * Son la base de la proyección a futuro.
 */

import { getDb } from '../db/client';
import { currentMonth, dateInMonth, nowTimestamp } from '../domain/dates';
import type {
  MonthKey,
  MovementType,
  RecurringRule,
  RecurringRuleWithCategory,
} from '../domain/types';
import { createTransaction } from './transactions';
import {
  mapRecurringRule,
  mapRecurringRuleWithCategory,
  type RecurringRuleRow,
} from './mappers';

const SELECT_WITH_CATEGORY = `
  SELECT r.*,
         c.name AS category_name,
         c.color AS category_color,
         c.icon AS category_icon
  FROM recurring_rules r
  LEFT JOIN categories c ON c.id = r.category_id
`;

export async function listRecurringRules(
  options: { onlyActive?: boolean } = {},
): Promise<RecurringRuleWithCategory[]> {
  const db = await getDb();
  const where = options.onlyActive ? 'WHERE r.active = 1' : '';
  const rows = await db.getAllAsync<RecurringRuleRow>(
    `${SELECT_WITH_CATEGORY}
     ${where}
     ORDER BY r.type DESC, r.day_of_month, r.name COLLATE NOCASE`,
  );
  return rows.map(mapRecurringRuleWithCategory);
}

/** Reglas vigentes en un mes dado (activas y dentro de su rango de fechas). */
export async function listActiveRulesForMonth(month: MonthKey): Promise<RecurringRule[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecurringRuleRow>(
    `SELECT * FROM recurring_rules
     WHERE active = 1
       AND start_month <= ?
       AND (end_month IS NULL OR end_month >= ?)
     ORDER BY day_of_month`,
    [month, month],
  );
  return rows.map(mapRecurringRule);
}

export async function getRecurringRule(id: number): Promise<RecurringRule | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RecurringRuleRow>(
    'SELECT * FROM recurring_rules WHERE id = ?',
    [id],
  );
  return row ? mapRecurringRule(row) : null;
}

export interface RecurringRuleInput {
  name: string;
  type: MovementType;
  amount: number;
  categoryId: number | null;
  dayOfMonth: number;
  startMonth: MonthKey;
  endMonth?: MonthKey | null;
  active?: boolean;
}

export async function createRecurringRule(input: RecurringRuleInput): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO recurring_rules (name, type, amount, category_id, day_of_month,
                                  start_month, end_month, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name.trim(),
      input.type,
      Math.abs(Math.round(input.amount)),
      input.categoryId,
      Math.min(31, Math.max(1, Math.round(input.dayOfMonth))),
      input.startMonth,
      input.endMonth ?? null,
      input.active === false ? 0 : 1,
      nowTimestamp(),
    ],
  );
  return result.lastInsertRowId;
}

export async function updateRecurringRule(
  id: number,
  input: Partial<RecurringRuleInput>,
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.name !== undefined) {
    fields.push('name = ?');
    values.push(input.name.trim());
  }
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
  if (input.dayOfMonth !== undefined) {
    fields.push('day_of_month = ?');
    values.push(Math.min(31, Math.max(1, Math.round(input.dayOfMonth))));
  }
  if (input.startMonth !== undefined) {
    fields.push('start_month = ?');
    values.push(input.startMonth);
  }
  if (input.endMonth !== undefined) {
    fields.push('end_month = ?');
    values.push(input.endMonth);
  }
  if (input.active !== undefined) {
    fields.push('active = ?');
    values.push(input.active ? 1 : 0);
  }
  if (fields.length === 0) return;

  const db = await getDb();
  await db.runAsync(`UPDATE recurring_rules SET ${fields.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
}

export async function setRecurringRuleActive(
  id: number,
  active: boolean,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE recurring_rules SET active = ? WHERE id = ?', [
    active ? 1 : 0,
    id,
  ]);
}

export async function deleteRecurringRule(id: number): Promise<void> {
  const db = await getDb();
  // Los movimientos ya generados se conservan; sólo pierden el vínculo.
  await db.runAsync('DELETE FROM recurring_rules WHERE id = ?', [id]);
}

/**
 * Convierte una recurrente en un movimiento real del mes ("ya me pagaron").
 * Devuelve `null` si esa regla ya se registró en ese mes, para que tocar dos
 * veces el botón no duplique el monto.
 */
export async function materializeRule(
  ruleId: number,
  month: MonthKey = currentMonth(),
): Promise<number | null> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM transactions WHERE recurring_rule_id = ? AND month = ?',
    [ruleId, month],
  );
  if (existing) return null;

  const rule = await getRecurringRule(ruleId);
  if (!rule) return null;

  return createTransaction({
    type: rule.type,
    amount: rule.amount,
    categoryId: rule.categoryId,
    date: dateInMonth(month, rule.dayOfMonth),
    note: rule.name,
    recurringRuleId: rule.id,
  });
}

/**
 * Recurrentes del mes que todavía no se registraron, para ofrecerlas como
 * pendientes en el resumen.
 */
export async function listPendingRulesForMonth(
  month: MonthKey = currentMonth(),
): Promise<RecurringRuleWithCategory[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecurringRuleRow>(
    `${SELECT_WITH_CATEGORY}
     WHERE r.active = 1
       AND r.start_month <= ?
       AND (r.end_month IS NULL OR r.end_month >= ?)
       AND NOT EXISTS (
         SELECT 1 FROM transactions t
         WHERE t.recurring_rule_id = r.id AND t.month = ?
       )
     ORDER BY r.day_of_month`,
    [month, month, month],
  );
  return rows.map(mapRecurringRuleWithCategory);
}
