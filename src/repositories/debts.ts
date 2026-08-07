/**
 * Deudas y sus cuotas.
 *
 * Al crear una deuda se genera y persiste la tabla de cuotas completa. Esa
 * tabla es la fuente de verdad: la proyección lee de ahí y el usuario puede
 * editar una cuota puntual sin recalcular todo.
 */

import { getDb } from '../db/client';
import { buildSchedule, DEFAULT_DUE_DAY } from '../domain/amortization';
import { currentMonth, nowTimestamp, todayKey } from '../domain/dates';
import type {
  Debt,
  DebtInstallment,
  DebtKind,
  DebtSummary,
  MonthKey,
} from '../domain/types';
import { getDebtCategoryId } from './categories';
import {
  mapDebt,
  mapDebtInstallment,
  type DebtInstallmentRow,
  type DebtRow,
} from './mappers';

export async function getDebt(id: number): Promise<Debt | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DebtRow>('SELECT * FROM debts WHERE id = ?', [id]);
  return row ? mapDebt(row) : null;
}

export async function listInstallments(debtId: number): Promise<DebtInstallment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DebtInstallmentRow>(
    'SELECT * FROM debt_installments WHERE debt_id = ? ORDER BY number',
    [debtId],
  );
  return rows.map(mapDebtInstallment);
}

export async function getInstallment(id: number): Promise<DebtInstallment | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DebtInstallmentRow>(
    'SELECT * FROM debt_installments WHERE id = ?',
    [id],
  );
  return row ? mapDebtInstallment(row) : null;
}

/** Deudas con totales calculados y la próxima cuota por pagar. */
export async function listDebts(
  options: { includeClosed?: boolean } = {},
): Promise<DebtSummary[]> {
  const db = await getDb();
  const where = options.includeClosed ? '' : 'WHERE d.closed_at IS NULL';

  const rows = await db.getAllAsync<
    DebtRow & {
      installments_paid: number;
      total_to_pay: number;
      total_paid: number;
      monthly_amount: number | null;
    }
  >(
    `SELECT d.*,
            COALESCE(SUM(i.paid), 0) AS installments_paid,
            COALESCE(SUM(i.amount), 0) AS total_to_pay,
            COALESCE(SUM(CASE WHEN i.paid = 1 THEN i.amount END), 0) AS total_paid,
            (SELECT amount FROM debt_installments
             WHERE debt_id = d.id ORDER BY number LIMIT 1) AS monthly_amount
     FROM debts d
     LEFT JOIN debt_installments i ON i.debt_id = d.id
     ${where}
     GROUP BY d.id
     ORDER BY d.closed_at IS NOT NULL, d.created_at DESC`,
  );

  // La próxima cuota pendiente de cada deuda, en una sola consulta.
  const nextRows = await db.getAllAsync<DebtInstallmentRow>(
    `SELECT i.* FROM debt_installments i
     WHERE i.paid = 0
       AND i.number = (
         SELECT MIN(number) FROM debt_installments
         WHERE debt_id = i.debt_id AND paid = 0
       )`,
  );
  const nextByDebt = new Map<number, DebtInstallment>();
  for (const row of nextRows) {
    nextByDebt.set(row.debt_id, mapDebtInstallment(row));
  }

  return rows.map((row) => ({
    ...mapDebt(row),
    installmentsPaid: row.installments_paid,
    totalToPay: row.total_to_pay,
    totalPaid: row.total_paid,
    totalPending: row.total_to_pay - row.total_paid,
    nextInstallment: nextByDebt.get(row.id) ?? null,
    monthlyAmount: row.monthly_amount ?? 0,
  }));
}

export async function getDebtSummary(id: number): Promise<DebtSummary | null> {
  const all = await listDebts({ includeClosed: true });
  return all.find((debt) => debt.id === id) ?? null;
}

export interface DebtInput {
  name: string;
  kind: DebtKind;
  principal: number;
  annualRate: number;
  installmentsTotal: number;
  startMonth: MonthKey;
  categoryId?: number | null;
  note?: string | null;
  dueDay?: number;
  /** Cuota conocida; manda sobre `annualRate` al generar la tabla. */
  fixedInstallment?: number | null;
}

/** Crea la deuda y genera su tabla de cuotas. */
export async function createDebt(input: DebtInput): Promise<number> {
  const db = await getDb();
  const categoryId = input.categoryId ?? (await getDebtCategoryId());

  const schedule = buildSchedule({
    principal: input.principal,
    annualRate: input.annualRate,
    installmentsTotal: input.installmentsTotal,
    startMonth: input.startMonth,
    dayOfMonth: input.dueDay ?? DEFAULT_DUE_DAY,
    fixedInstallment: input.fixedInstallment ?? null,
  });

  let debtId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO debts (name, kind, principal, annual_rate, installments_total,
                          start_month, category_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name.trim(),
        input.kind,
        Math.abs(Math.round(input.principal)),
        input.annualRate,
        Math.max(1, Math.round(input.installmentsTotal)),
        input.startMonth,
        categoryId,
        input.note?.trim() || null,
        nowTimestamp(),
      ],
    );
    debtId = result.lastInsertRowId;

    for (const row of schedule) {
      await db.runAsync(
        `INSERT INTO debt_installments (debt_id, number, due_month, due_date, amount,
                                        principal_part, interest_part)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          debtId,
          row.number,
          row.dueMonth,
          row.dueDate,
          row.amount,
          row.principalPart,
          row.interestPart,
        ],
      );
    }
  });

  return debtId;
}

/** Actualiza datos descriptivos. No toca la tabla de cuotas. */
export async function updateDebt(
  id: number,
  input: Partial<Pick<DebtInput, 'name' | 'kind' | 'categoryId' | 'note'>>,
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.name !== undefined) {
    fields.push('name = ?');
    values.push(input.name.trim());
  }
  if (input.kind !== undefined) {
    fields.push('kind = ?');
    values.push(input.kind);
  }
  if (input.categoryId !== undefined) {
    fields.push('category_id = ?');
    values.push(input.categoryId);
  }
  if (input.note !== undefined) {
    fields.push('note = ?');
    values.push(input.note?.trim() || null);
  }
  if (fields.length === 0) return;

  const db = await getDb();
  await db.runAsync(`UPDATE debts SET ${fields.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
}

/**
 * Reconstruye sólo las cuotas pendientes con parámetros nuevos, conservando
 * las ya pagadas. Sirve para renegociaciones o para corregir el plan sin
 * perder el historial de pagos.
 */
export async function rebuildPendingInstallments(
  debtId: number,
  params: {
    annualRate: number;
    remainingInstallments: number;
    startMonth: MonthKey;
    dueDay?: number;
    fixedInstallment?: number | null;
    /** Capital pendiente; si se omite se deduce de las cuotas ya pagadas. */
    remainingPrincipal?: number;
  },
): Promise<void> {
  const db = await getDb();
  const debt = await getDebt(debtId);
  if (!debt) return;

  const paidRow = await db.getFirstAsync<{ count: number; principal_paid: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(principal_part), 0) AS principal_paid
     FROM debt_installments
     WHERE debt_id = ? AND paid = 1`,
    [debtId],
  );
  const paidCount = paidRow?.count ?? 0;
  const remainingPrincipal =
    params.remainingPrincipal ?? Math.max(0, debt.principal - (paidRow?.principal_paid ?? 0));

  const schedule = buildSchedule({
    principal: remainingPrincipal,
    annualRate: params.annualRate,
    installmentsTotal: params.remainingInstallments,
    startMonth: params.startMonth,
    dayOfMonth: params.dueDay ?? DEFAULT_DUE_DAY,
    fixedInstallment: params.fixedInstallment ?? null,
  });

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM debt_installments WHERE debt_id = ? AND paid = 0', [
      debtId,
    ]);

    for (const row of schedule) {
      await db.runAsync(
        `INSERT INTO debt_installments (debt_id, number, due_month, due_date, amount,
                                        principal_part, interest_part)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          debtId,
          // Se numera a continuación de las cuotas ya pagadas.
          paidCount + row.number,
          row.dueMonth,
          row.dueDate,
          row.amount,
          row.principalPart,
          row.interestPart,
        ],
      );
    }

    await db.runAsync(
      'UPDATE debts SET annual_rate = ?, installments_total = ? WHERE id = ?',
      [params.annualRate, paidCount + schedule.length, debtId],
    );
  });
}

export async function deleteDebt(id: number): Promise<void> {
  const db = await getDb();
  // Las cuotas caen por ON DELETE CASCADE; los movimientos ya registrados se
  // conservan como historial de gasto real.
  await db.runAsync('DELETE FROM debts WHERE id = ?', [id]);
}

/** Ajusta el monto o vencimiento de una cuota puntual sin pagar. */
export async function updateInstallment(
  id: number,
  input: { amount?: number; dueDate?: string },
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (input.amount !== undefined) {
    fields.push('amount = ?');
    values.push(Math.abs(Math.round(input.amount)));
  }
  if (input.dueDate !== undefined) {
    fields.push('due_date = ?', 'due_month = ?');
    values.push(input.dueDate, input.dueDate.slice(0, 7));
  }
  if (fields.length === 0) return;

  const db = await getDb();
  await db.runAsync(`UPDATE debt_installments SET ${fields.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
}

/**
 * Marca una cuota como pagada y registra el egreso correspondiente.
 * Devuelve el id del movimiento creado, o `null` si la cuota ya estaba pagada.
 */
export async function payInstallment(
  installmentId: number,
  options: { date?: string; amount?: number } = {},
): Promise<number | null> {
  const db = await getDb();
  const installment = await getInstallment(installmentId);
  if (!installment || installment.paid) return null;

  const debt = await getDebt(installment.debtId);
  if (!debt) return null;

  const date = options.date ?? todayKey();
  const amount = options.amount ?? installment.amount;
  const timestamp = nowTimestamp();
  let transactionId = 0;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO transactions (type, amount, category_id, date, month, note,
                                 recurring_rule_id, debt_installment_id, created_at)
       VALUES ('expense', ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        Math.abs(Math.round(amount)),
        debt.categoryId,
        date,
        date.slice(0, 7),
        `${debt.name} · cuota ${installment.number}/${debt.installmentsTotal}`,
        installmentId,
        timestamp,
      ],
    );
    transactionId = result.lastInsertRowId;

    await db.runAsync(
      `UPDATE debt_installments
       SET paid = 1, paid_at = ?, transaction_id = ?
       WHERE id = ?`,
      [timestamp, transactionId, installmentId],
    );

    // Si no queda ninguna cuota pendiente, la deuda se cierra sola.
    const pending = await db.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM debt_installments WHERE debt_id = ? AND paid = 0',
      [installment.debtId],
    );
    if ((pending?.total ?? 0) === 0) {
      await db.runAsync('UPDATE debts SET closed_at = ? WHERE id = ?', [
        timestamp,
        installment.debtId,
      ]);
    }
  });

  return transactionId;
}

/** Revierte el pago de una cuota y borra el movimiento asociado. */
export async function unpayInstallment(installmentId: number): Promise<void> {
  const db = await getDb();
  const installment = await getInstallment(installmentId);
  if (!installment || !installment.paid) return;

  await db.withTransactionAsync(async () => {
    if (installment.transactionId !== null) {
      await db.runAsync('DELETE FROM transactions WHERE id = ?', [
        installment.transactionId,
      ]);
    }
    await db.runAsync(
      `UPDATE debt_installments
       SET paid = 0, paid_at = NULL, transaction_id = NULL
       WHERE id = ?`,
      [installmentId],
    );
    // Al reabrirse una cuota, la deuda deja de estar cerrada.
    await db.runAsync('UPDATE debts SET closed_at = NULL WHERE id = ?', [
      installment.debtId,
    ]);
  });
}

/** Todas las cuotas sin pagar. La proyección las consume completas. */
export async function listPendingInstallments(): Promise<DebtInstallment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DebtInstallmentRow>(
    'SELECT * FROM debt_installments WHERE paid = 0 ORDER BY due_month, due_date',
  );
  return rows.map(mapDebtInstallment);
}

export interface UpcomingInstallment extends DebtInstallment {
  debtName: string;
  debtKind: string;
  installmentsTotal: number;
}

/** Próximas cuotas por vencer, con el nombre de su deuda, para el resumen. */
export async function listUpcomingInstallments(
  limit = 5,
): Promise<UpcomingInstallment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<
    DebtInstallmentRow & {
      debt_name: string;
      debt_kind: string;
      installments_total: number;
    }
  >(
    `SELECT i.*,
            d.name AS debt_name,
            d.kind AS debt_kind,
            d.installments_total
     FROM debt_installments i
     JOIN debts d ON d.id = i.debt_id
     WHERE i.paid = 0
     ORDER BY i.due_date
     LIMIT ?`,
    [limit],
  );

  return rows.map((row) => ({
    ...mapDebtInstallment(row),
    debtName: row.debt_name,
    debtKind: row.debt_kind,
    installmentsTotal: row.installments_total,
  }));
}

/** Cuotas que vencen en un mes, pagadas y pendientes. */
export async function listInstallmentsForMonth(
  month: MonthKey,
): Promise<UpcomingInstallment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<
    DebtInstallmentRow & {
      debt_name: string;
      debt_kind: string;
      installments_total: number;
    }
  >(
    `SELECT i.*,
            d.name AS debt_name,
            d.kind AS debt_kind,
            d.installments_total
     FROM debt_installments i
     JOIN debts d ON d.id = i.debt_id
     WHERE i.due_month = ?
     ORDER BY i.paid, i.due_date`,
    [month],
  );

  return rows.map((row) => ({
    ...mapDebtInstallment(row),
    debtName: row.debt_name,
    debtKind: row.debt_kind,
    installmentsTotal: row.installments_total,
  }));
}

/** Total comprometido en cuotas para un mes. */
export async function getMonthDebtLoad(
  month: MonthKey = currentMonth(),
): Promise<{ total: number; pending: number; count: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    total: number;
    pending: number;
    count: number;
  }>(
    `SELECT COALESCE(SUM(amount), 0) AS total,
            COALESCE(SUM(CASE WHEN paid = 0 THEN amount END), 0) AS pending,
            COUNT(*) AS count
     FROM debt_installments
     WHERE due_month = ?`,
    [month],
  );
  return {
    total: row?.total ?? 0,
    pending: row?.pending ?? 0,
    count: row?.count ?? 0,
  };
}

/** Cuotas vencidas sin pagar, para avisar de atrasos. */
export async function listOverdueInstallments(
  reference: MonthKey = currentMonth(),
): Promise<UpcomingInstallment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<
    DebtInstallmentRow & {
      debt_name: string;
      debt_kind: string;
      installments_total: number;
    }
  >(
    `SELECT i.*,
            d.name AS debt_name,
            d.kind AS debt_kind,
            d.installments_total
     FROM debt_installments i
     JOIN debts d ON d.id = i.debt_id
     WHERE i.paid = 0 AND i.due_month < ?
     ORDER BY i.due_date`,
    [reference],
  );

  return rows.map((row) => ({
    ...mapDebtInstallment(row),
    debtName: row.debt_name,
    debtKind: row.debt_kind,
    installmentsTotal: row.installments_total,
  }));
}
