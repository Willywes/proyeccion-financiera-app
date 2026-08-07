/**
 * Tipos del dominio.
 *
 * Convenciones importantes:
 * - Los montos se guardan como ENTEROS en la unidad mínima de la moneda
 *   ("minor units"). Para CLP (0 decimales) 1 unidad = $1. Para USD serían
 *   centavos. Nunca se usan floats para dinero. Ver `domain/money.ts`.
 * - Las fechas se guardan como texto `YYYY-MM-DD` y los meses como `YYYY-MM`.
 *   Se evita `Date` en el almacenamiento para no arrastrar zonas horarias.
 */

/** Tipo de movimiento. */
export type MovementType = 'income' | 'expense';

/** Naturaleza de una deuda, sólo informativa/visual. */
export type DebtKind = 'loan' | 'credit_card' | 'installment' | 'other';

/** `YYYY-MM-DD` */
export type DateKey = string;
/** `YYYY-MM` */
export type MonthKey = string;

export interface User {
  id: number;
  name: string;
  pinHash: string;
  pinSalt: string;
  /** Código ISO de moneda, ej. `CLP`. */
  currency: string;
  /** Saldo con el que arranca la proyección (unidad mínima). */
  openingBalance: number;
  /** Cuántos meses hacia adelante proyectar por defecto. */
  projectionMonths: number;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  type: MovementType;
  /** Color hex usado en la UI, ej. `#10b981`. */
  color: string;
  /** Emoji corto usado como icono. */
  icon: string;
  isDefault: boolean;
  archivedAt: string | null;
}

export interface Transaction {
  id: number;
  type: MovementType;
  /** Monto positivo en unidad mínima. El signo lo determina `type`. */
  amount: number;
  categoryId: number | null;
  date: DateKey;
  /** Denormalizado desde `date` para agrupar y filtrar rápido por mes. */
  month: MonthKey;
  note: string | null;
  /** Regla que originó este movimiento, si vino de un recurrente. */
  recurringRuleId: number | null;
  /** Cuota de deuda que este movimiento paga, si aplica. */
  debtInstallmentId: number | null;
  createdAt: string;
}

/** Movimiento con datos de su categoría, para listados. */
export interface TransactionWithCategory extends Transaction {
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
}

/**
 * Ingreso o egreso que se repite todos los meses (sueldo, arriendo, streaming).
 * Es la base de la proyección a futuro.
 */
export interface RecurringRule {
  id: number;
  name: string;
  type: MovementType;
  amount: number;
  categoryId: number | null;
  /** Día del mes en que ocurre (1–31, se recorta a meses cortos). */
  dayOfMonth: number;
  startMonth: MonthKey;
  /** `null` = sin fecha de término. */
  endMonth: MonthKey | null;
  active: boolean;
  createdAt: string;
}

export interface RecurringRuleWithCategory extends RecurringRule {
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
}

export interface Debt {
  id: number;
  name: string;
  kind: DebtKind;
  /** Monto financiado (unidad mínima). */
  principal: number;
  /** Tasa anual en porcentaje, ej. 24.5. `0` = sin interés. */
  annualRate: number;
  installmentsTotal: number;
  /** Mes de la primera cuota. */
  startMonth: MonthKey;
  categoryId: number | null;
  note: string | null;
  /** Fecha en que se marcó como cerrada/pagada por completo. */
  closedAt: string | null;
  createdAt: string;
}

export interface DebtInstallment {
  id: number;
  debtId: number;
  /** Número de cuota, 1-indexado. */
  number: number;
  dueMonth: MonthKey;
  dueDate: DateKey;
  amount: number;
  principalPart: number;
  interestPart: number;
  paid: boolean;
  paidAt: string | null;
  /** Movimiento generado al pagar la cuota. */
  transactionId: number | null;
}

/** Deuda con totales calculados, para listados y tarjetas. */
export interface DebtSummary extends Debt {
  installmentsPaid: number;
  /** Suma de todas las cuotas (capital + interés). */
  totalToPay: number;
  totalPaid: number;
  totalPending: number;
  /** Cuota siguiente sin pagar, si queda alguna. */
  nextInstallment: DebtInstallment | null;
  monthlyAmount: number;
}

/** Totales de un mes ya ocurrido o en curso, calculados desde movimientos reales. */
export interface MonthTotals {
  month: MonthKey;
  income: number;
  expense: number;
  net: number;
}

/** Gasto agrupado por categoría, para el desglose del mes. */
export interface CategoryTotal {
  categoryId: number | null;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  type: MovementType;
  total: number;
  /** Porcentaje sobre el total del tipo, 0–100. */
  share: number;
}

/** Una fila de la proyección mes a mes. */
export interface MonthProjection {
  month: MonthKey;
  /** `true` si el mes ya terminó: los números son reales, no estimados. */
  isPast: boolean;
  /** `true` para el mes en curso: mezcla movimientos reales y pendientes. */
  isCurrent: boolean;
  income: number;
  expense: number;
  /** Parte de `expense` que corresponde a cuotas de deuda. */
  debtPayments: number;
  net: number;
  openingBalance: number;
  closingBalance: number;
  /** Desglose por origen, para explicar de dónde sale cada número. */
  breakdown: {
    realIncome: number;
    realExpense: number;
    plannedIncome: number;
    plannedExpense: number;
    plannedDebt: number;
  };
}
