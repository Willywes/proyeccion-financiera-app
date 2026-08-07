/**
 * Motor de proyección de saldo mes a mes.
 *
 * Regla que ordena todo el cálculo, para que ningún monto se cuente dos veces:
 *
 *   - Mes pasado    → sólo movimientos reales. Ya ocurrió, es historia.
 *   - Mes en curso  → movimientos reales + lo que todavía no ocurre
 *                     (recurrentes con vencimiento posterior a hoy que aún no
 *                     se registraron, y cuotas del mes sin pagar).
 *   - Mes futuro    → recurrentes vigentes + cuotas programadas, más cualquier
 *                     movimiento que el usuario haya anotado por adelantado.
 *
 * Una recurrente "ya materializada" es una que generó un movimiento real en ese
 * mes: se excluye del plan porque su monto ya viene en los datos reales. Lo
 * mismo con las cuotas pagadas, que salen de `pendingInstallments`.
 *
 * Las cuotas vencidas e impagas de meses anteriores no se pierden: se arrastran
 * al mes en curso, porque se siguen debiendo hoy.
 */

import { currentMonth as getCurrentMonth, monthRange, todayDayOfMonth } from './dates';
import type {
  DebtInstallment,
  MonthKey,
  MonthProjection,
  RecurringRule,
} from './types';

/** Totales reales de un mes, calculados desde la tabla de movimientos. */
export interface ActualMonthTotals {
  income: number;
  expense: number;
}

export interface ProjectionInput {
  /** Primer mes de la proyección. */
  startMonth: MonthKey;
  /** Cuántos meses generar (incluye `startMonth`). */
  months: number;
  /** Saldo disponible al comenzar `startMonth`, en unidad mínima. */
  openingBalance: number;
  /** Totales reales por mes. Los meses sin datos se tratan como cero. */
  actuals: Map<MonthKey, ActualMonthTotals>;
  /** Reglas recurrentes del usuario (se filtran por vigencia y estado). */
  recurring: RecurringRule[];
  /** Cuotas de deuda todavía sin pagar, de cualquier mes. */
  pendingInstallments: DebtInstallment[];
  /** Claves `${month}:${recurringRuleId}` que ya generaron un movimiento real. */
  materializedRules: Set<string>;
  /** Mes considerado "hoy". Se inyecta para poder testear. */
  referenceMonth?: MonthKey;
  /** Día del mes considerado "hoy". Se inyecta para poder testear. */
  referenceDay?: number;
}

export interface ProjectionResult {
  rows: MonthProjection[];
  /** Cuotas vencidas sin pagar, arrastradas al mes en curso. */
  overdue: { count: number; amount: number };
  /** Primer mes en que el saldo proyectado queda bajo cero. */
  firstNegativeMonth: MonthKey | null;
  /** Acumulados de todo el rango proyectado. */
  totals: {
    income: number;
    expense: number;
    debtPayments: number;
    net: number;
  };
  /** Saldo al terminar el último mes del rango. */
  finalBalance: number;
}

/** `true` si la regla está vigente y activa en ese mes. */
function isRuleActiveIn(rule: RecurringRule, month: MonthKey): boolean {
  if (!rule.active) return false;
  if (month < rule.startMonth) return false;
  if (rule.endMonth !== null && month > rule.endMonth) return false;
  return true;
}

export function buildProjection(input: ProjectionInput): ProjectionResult {
  const {
    startMonth,
    months,
    openingBalance,
    actuals,
    recurring,
    pendingInstallments,
    materializedRules,
    referenceMonth = getCurrentMonth(),
    referenceDay = todayDayOfMonth(),
  } = input;

  const monthKeys = monthRange(startMonth, months);

  // Cuotas pendientes agrupadas por mes de vencimiento, para no recorrer la
  // lista completa en cada iteración.
  const pendingByMonth = new Map<MonthKey, DebtInstallment[]>();
  let overdueCount = 0;
  let overdueAmount = 0;

  for (const installment of pendingInstallments) {
    if (installment.dueMonth < referenceMonth) {
      // Vencida: se arrastra al mes en curso.
      overdueCount += 1;
      overdueAmount += installment.amount;
      continue;
    }
    const bucket = pendingByMonth.get(installment.dueMonth);
    if (bucket) bucket.push(installment);
    else pendingByMonth.set(installment.dueMonth, [installment]);
  }

  const rows: MonthProjection[] = [];
  let balance = openingBalance;
  let firstNegativeMonth: MonthKey | null = null;
  const totals = { income: 0, expense: 0, debtPayments: 0, net: 0 };

  for (const month of monthKeys) {
    const isPast = month < referenceMonth;
    const isCurrent = month === referenceMonth;

    const real = actuals.get(month) ?? { income: 0, expense: 0 };
    let plannedIncome = 0;
    let plannedExpense = 0;
    let plannedDebt = 0;

    if (!isPast) {
      for (const rule of recurring) {
        if (!isRuleActiveIn(rule, month)) continue;
        // Ya se registró un movimiento real de esta regla en este mes.
        if (materializedRules.has(`${month}:${rule.id}`)) continue;
        // En el mes en curso, lo que ya venció y no se registró se considera
        // pasado y no se suma: sólo se proyecta lo que aún está por ocurrir.
        if (isCurrent && rule.dayOfMonth < referenceDay) continue;

        if (rule.type === 'income') plannedIncome += rule.amount;
        else plannedExpense += rule.amount;
      }

      for (const installment of pendingByMonth.get(month) ?? []) {
        plannedDebt += installment.amount;
      }

      // Las cuotas en mora se cobran contra el mes en curso.
      if (isCurrent) plannedDebt += overdueAmount;
    }

    const income = real.income + plannedIncome;
    const expense = real.expense + plannedExpense + plannedDebt;
    const net = income - expense;
    const opening = balance;
    balance = opening + net;

    if (firstNegativeMonth === null && balance < 0) firstNegativeMonth = month;

    totals.income += income;
    totals.expense += expense;
    totals.debtPayments += plannedDebt;
    totals.net += net;

    rows.push({
      month,
      isPast,
      isCurrent,
      income,
      expense,
      debtPayments: plannedDebt,
      net,
      openingBalance: opening,
      closingBalance: balance,
      breakdown: {
        realIncome: real.income,
        realExpense: real.expense,
        plannedIncome,
        plannedExpense,
        plannedDebt,
      },
    });
  }

  return {
    rows,
    overdue: { count: overdueCount, amount: overdueAmount },
    firstNegativeMonth,
    totals,
    finalBalance: balance,
  };
}

/**
 * Capacidad de pago estimada: cuánto queda libre al mes, en promedio, después
 * de ingresos, gastos y cuotas. Sirve para advertir si tomar una deuda nueva
 * cabe en el presupuesto.
 */
export function averageMonthlyNet(rows: MonthProjection[]): number {
  const future = rows.filter((row) => !row.isPast);
  if (future.length === 0) return 0;
  const sum = future.reduce((accumulator, row) => accumulator + row.net, 0);
  return Math.round(sum / future.length);
}

/**
 * Cuánto de los egresos proyectados se va en deuda, como porcentaje 0–100.
 * Sobre ~30% del ingreso ya es una carga alta para un presupuesto doméstico.
 */
export function debtLoadRatio(rows: MonthProjection[]): number {
  const future = rows.filter((row) => !row.isPast);
  const income = future.reduce((accumulator, row) => accumulator + row.income, 0);
  const debt = future.reduce((accumulator, row) => accumulator + row.debtPayments, 0);
  if (income <= 0) return debt > 0 ? 100 : 0;
  return Math.min(100, Math.round((debt / income) * 100));
}
