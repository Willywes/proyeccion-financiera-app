/**
 * Cálculo de tablas de cuotas (sistema francés: cuota fija).
 *
 * Todos los montos entran y salen como enteros en unidad mínima. El capital
 * siempre cierra exacto: la última cuota absorbe las diferencias de redondeo,
 * así la suma de `principalPart` es idéntica al capital financiado.
 */

import { addMonths, dateInMonth } from './dates';
import { splitEvenly } from './money';
import type { DateKey, MonthKey } from './types';

export interface ScheduleInput {
  /** Capital financiado, en unidad mínima. */
  principal: number;
  /** Tasa anual en porcentaje, ej. `24.5`. Usar `0` para deudas sin interés. */
  annualRate: number;
  installmentsTotal: number;
  /** Mes de vencimiento de la primera cuota. */
  startMonth: MonthKey;
  /** Día de vencimiento; se recorta en meses cortos. */
  dayOfMonth?: number;
  /**
   * Cuota conocida de antemano ("12 cuotas de $50.000"). Si se entrega, manda
   * sobre la tasa: el interés total pasa a ser `cuota × n − capital`.
   */
  fixedInstallment?: number | null;
}

export interface ScheduleRow {
  number: number;
  dueMonth: MonthKey;
  dueDate: DateKey;
  amount: number;
  principalPart: number;
  interestPart: number;
  /** Capital que queda por pagar después de esta cuota. */
  balanceAfter: number;
}

export const DEFAULT_DUE_DAY = 5;

/**
 * Cuota mensual del sistema francés.
 * `C = P · i / (1 − (1 + i)^−n)`, con `i` = tasa mensual.
 */
export function monthlyPayment(
  principal: number,
  annualRate: number,
  installments: number,
): number {
  if (installments <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate <= 0) return Math.round(principal / installments);

  const factor = (1 + monthlyRate) ** -installments;
  return Math.round((principal * monthlyRate) / (1 - factor));
}

/** Genera la tabla de cuotas completa. */
export function buildSchedule(input: ScheduleInput): ScheduleRow[] {
  const {
    principal,
    annualRate,
    installmentsTotal,
    startMonth,
    dayOfMonth = DEFAULT_DUE_DAY,
    fixedInstallment = null,
  } = input;

  const count = Math.max(0, Math.round(installmentsTotal));
  if (count === 0 || principal <= 0) return [];

  const rowAt = (index: number) => {
    const dueMonth = addMonths(startMonth, index);
    return { dueMonth, dueDate: dateInMonth(dueMonth, dayOfMonth) };
  };

  // Caso 1: cuota conocida. El interés total es la diferencia contra el capital
  // y se reparte parejo entre las cuotas; no hay tasa que simular.
  if (fixedInstallment !== null && fixedInstallment > 0) {
    const totalInterest = Math.max(0, fixedInstallment * count - principal);
    const principalParts = splitEvenly(principal, count);
    const interestParts = splitEvenly(totalInterest, count);
    let balance = principal;

    return principalParts.map((principalPart, index) => {
      balance -= principalPart;
      const interestPart = interestParts[index];
      const { dueMonth, dueDate } = rowAt(index);
      return {
        number: index + 1,
        dueMonth,
        dueDate,
        amount: principalPart + interestPart,
        principalPart,
        interestPart,
        balanceAfter: balance,
      };
    });
  }

  // Caso 2: sin interés. Reparto exacto del capital.
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate <= 0) {
    const parts = splitEvenly(principal, count);
    let balance = principal;
    return parts.map((principalPart, index) => {
      balance -= principalPart;
      const { dueMonth, dueDate } = rowAt(index);
      return {
        number: index + 1,
        dueMonth,
        dueDate,
        amount: principalPart,
        principalPart,
        interestPart: 0,
        balanceAfter: balance,
      };
    });
  }

  // Caso 3: sistema francés. Se simula el saldo cuota por cuota.
  const payment = monthlyPayment(principal, annualRate, count);
  const rows: ScheduleRow[] = [];
  let balance = principal;

  for (let index = 0; index < count; index += 1) {
    const isLast = index === count - 1;
    const interestPart = Math.round(balance * monthlyRate);
    let principalPart: number;
    let amount: number;

    if (isLast) {
      // La última cuota liquida el saldo, sea cual sea el redondeo acumulado.
      principalPart = balance;
      amount = principalPart + interestPart;
    } else {
      principalPart = payment - interestPart;
      // Con tasas muy altas la cuota redondeada podría no cubrir el interés,
      // dejando el saldo estancado. Se fuerza un abono mínimo de 1 unidad.
      if (principalPart < 1) principalPart = 1;
      if (principalPart > balance) principalPart = balance;
      amount = principalPart + interestPart;
    }

    balance -= principalPart;
    const { dueMonth, dueDate } = rowAt(index);
    rows.push({
      number: index + 1,
      dueMonth,
      dueDate,
      amount,
      principalPart,
      interestPart,
      balanceAfter: balance,
    });

    // Si el capital quedó liquidado antes de la última cuota, no se generan más.
    if (balance <= 0 && !isLast) break;
  }

  return rows;
}

export interface ScheduleTotals {
  totalToPay: number;
  totalInterest: number;
  totalPrincipal: number;
  /** Cuota más frecuente, útil para mostrar "12 cuotas de $X". */
  representativeInstallment: number;
}

export function scheduleTotals(rows: ScheduleRow[]): ScheduleTotals {
  const totals = rows.reduce(
    (accumulator, row) => ({
      totalToPay: accumulator.totalToPay + row.amount,
      totalInterest: accumulator.totalInterest + row.interestPart,
      totalPrincipal: accumulator.totalPrincipal + row.principalPart,
    }),
    { totalToPay: 0, totalInterest: 0, totalPrincipal: 0 },
  );

  return {
    ...totals,
    representativeInstallment: rows.length > 0 ? rows[0].amount : 0,
  };
}

/**
 * Tasa anual implícita cuando se conoce el precio y la cuota
 * ("$500.000 en 12 cuotas de $50.000" → ~35% anual).
 * Resuelve por bisección; devuelve `0` si la cuota no genera interés.
 */
export function impliedAnnualRate(
  principal: number,
  installment: number,
  installments: number,
): number {
  if (principal <= 0 || installments <= 0) return 0;
  const total = installment * installments;
  if (total <= principal) return 0;

  let low = 0;
  let high = 1000; // 1000% anual como techo de búsqueda

  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2;
    const candidate = monthlyPayment(principal, middle, installments);
    if (candidate < installment) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return Math.round(((low + high) / 2) * 100) / 100;
}
