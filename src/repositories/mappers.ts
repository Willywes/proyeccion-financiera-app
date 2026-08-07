/**
 * Traducción entre filas de SQLite (snake_case, booleanos como 0/1) y los
 * tipos del dominio (camelCase, booleanos reales).
 */

import type {
  Category,
  Debt,
  DebtInstallment,
  RecurringRule,
  RecurringRuleWithCategory,
  Transaction,
  TransactionWithCategory,
  User,
} from '../domain/types';

export interface UserRow {
  id: number;
  name: string;
  pin_hash: string;
  pin_salt: string;
  currency: string;
  opening_balance: number;
  projection_months: number;
  created_at: string;
}

export interface CategoryRow {
  id: number;
  name: string;
  type: string;
  color: string;
  icon: string;
  is_default: number;
  archived_at: string | null;
}

export interface TransactionRow {
  id: number;
  type: string;
  amount: number;
  category_id: number | null;
  date: string;
  month: string;
  note: string | null;
  recurring_rule_id: number | null;
  debt_installment_id: number | null;
  created_at: string;
  category_name?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
}

export interface RecurringRuleRow {
  id: number;
  name: string;
  type: string;
  amount: number;
  category_id: number | null;
  day_of_month: number;
  start_month: string;
  end_month: string | null;
  active: number;
  created_at: string;
  category_name?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
}

export interface DebtRow {
  id: number;
  name: string;
  kind: string;
  principal: number;
  annual_rate: number;
  installments_total: number;
  start_month: string;
  category_id: number | null;
  note: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface DebtInstallmentRow {
  id: number;
  debt_id: number;
  number: number;
  due_month: string;
  due_date: string;
  amount: number;
  principal_part: number;
  interest_part: number;
  paid: number;
  paid_at: string | null;
  transaction_id: number | null;
}

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    pinHash: row.pin_hash,
    pinSalt: row.pin_salt,
    currency: row.currency,
    openingBalance: row.opening_balance,
    projectionMonths: row.projection_months,
    createdAt: row.created_at,
  };
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type === 'income' ? 'income' : 'expense',
    color: row.color,
    icon: row.icon,
    isDefault: row.is_default === 1,
    archivedAt: row.archived_at,
  };
}

export function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type === 'income' ? 'income' : 'expense',
    amount: row.amount,
    categoryId: row.category_id,
    date: row.date,
    month: row.month,
    note: row.note,
    recurringRuleId: row.recurring_rule_id,
    debtInstallmentId: row.debt_installment_id,
    createdAt: row.created_at,
  };
}

export function mapTransactionWithCategory(row: TransactionRow): TransactionWithCategory {
  return {
    ...mapTransaction(row),
    categoryName: row.category_name ?? null,
    categoryColor: row.category_color ?? null,
    categoryIcon: row.category_icon ?? null,
  };
}

export function mapRecurringRule(row: RecurringRuleRow): RecurringRule {
  return {
    id: row.id,
    name: row.name,
    type: row.type === 'income' ? 'income' : 'expense',
    amount: row.amount,
    categoryId: row.category_id,
    dayOfMonth: row.day_of_month,
    startMonth: row.start_month,
    endMonth: row.end_month,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

export function mapRecurringRuleWithCategory(
  row: RecurringRuleRow,
): RecurringRuleWithCategory {
  return {
    ...mapRecurringRule(row),
    categoryName: row.category_name ?? null,
    categoryColor: row.category_color ?? null,
    categoryIcon: row.category_icon ?? null,
  };
}

export function mapDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    name: row.name,
    kind:
      row.kind === 'loan' || row.kind === 'credit_card' || row.kind === 'installment'
        ? row.kind
        : 'other',
    principal: row.principal,
    annualRate: row.annual_rate,
    installmentsTotal: row.installments_total,
    startMonth: row.start_month,
    categoryId: row.category_id,
    note: row.note,
    closedAt: row.closed_at,
    createdAt: row.created_at,
  };
}

export function mapDebtInstallment(row: DebtInstallmentRow): DebtInstallment {
  return {
    id: row.id,
    debtId: row.debt_id,
    number: row.number,
    dueMonth: row.due_month,
    dueDate: row.due_date,
    amount: row.amount,
    principalPart: row.principal_part,
    interestPart: row.interest_part,
    paid: row.paid === 1,
    paidAt: row.paid_at,
    transactionId: row.transaction_id,
  };
}
