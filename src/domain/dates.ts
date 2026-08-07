/**
 * Utilidades de fecha basadas en strings (`YYYY-MM-DD` y `YYYY-MM`).
 *
 * Se trabaja con strings en lugar de `Date` porque `new Date('2026-08-07')`
 * se interpreta como UTC y en zonas con offset negativo (todo Latinoamérica)
 * "hoy" se corre un día. Los strings son estables y comparables lexicográficamente.
 */

import type { DateKey, MonthKey } from './types';

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const MONTH_NAMES_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const pad = (value: number) => String(value).padStart(2, '0');

/** Fecha de hoy en hora local, como `YYYY-MM-DD`. */
export function todayKey(): DateKey {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Mes en curso en hora local, como `YYYY-MM`. */
export function currentMonth(): MonthKey {
  return todayKey().slice(0, 7);
}

/** Día del mes de hoy (1–31). */
export function todayDayOfMonth(): number {
  return new Date().getDate();
}

/** Extrae el mes de una fecha: `2026-08-07` → `2026-08`. */
export function monthOf(date: DateKey): MonthKey {
  return date.slice(0, 7);
}

/** Descompone `YYYY-MM` en año y mes numéricos. */
export function splitMonth(month: MonthKey): { year: number; month: number } {
  const [year, monthNumber] = month.split('-');
  return { year: Number(year), month: Number(monthNumber) };
}

/** Desplaza un mes en `offset` meses (acepta negativos). */
export function addMonths(month: MonthKey, offset: number): MonthKey {
  const { year, month: monthNumber } = splitMonth(month);
  // Se pasa a índice absoluto de meses para no lidiar con acarreos a mano.
  const absolute = year * 12 + (monthNumber - 1) + offset;
  return `${Math.floor(absolute / 12)}-${pad((absolute % 12) + 1)}`;
}

/** Cantidad de meses de `from` a `to`. Negativo si `to` es anterior. */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const a = splitMonth(from);
  const b = splitMonth(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/** Lista de `count` meses consecutivos empezando en `start`. */
export function monthRange(start: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) =>
    addMonths(start, index),
  );
}

/** Días que tiene el mes, considerando años bisiestos. */
export function daysInMonth(month: MonthKey): number {
  const { year, month: monthNumber } = splitMonth(month);
  // El día 0 del mes siguiente es el último día de este mes.
  return new Date(year, monthNumber, 0).getDate();
}

/**
 * Construye una fecha dentro del mes, recortando el día al último día válido.
 * `dateInMonth('2026-02', 31)` → `2026-02-28`, útil para recurrentes con día 31.
 */
export function dateInMonth(month: MonthKey, dayOfMonth: number): DateKey {
  const limit = daysInMonth(month);
  const day = Math.min(Math.max(1, Math.round(dayOfMonth)), limit);
  return `${month}-${pad(day)}`;
}

/** Comparador para ordenar meses o fechas (funciona con ambos formatos). */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isPastMonth(month: MonthKey, reference = currentMonth()): boolean {
  return month < reference;
}

export function isCurrentMonth(month: MonthKey, reference = currentMonth()): boolean {
  return month === reference;
}

export function isFutureMonth(month: MonthKey, reference = currentMonth()): boolean {
  return month > reference;
}

/** `2026-08` → `agosto 2026`. Con `capitalize` → `Agosto 2026`. */
export function monthLabel(
  month: MonthKey,
  options: { short?: boolean; withYear?: boolean; capitalize?: boolean } = {},
): string {
  const { short = false, withYear = true, capitalize = true } = options;
  const { year, month: monthNumber } = splitMonth(month);
  const names = short ? MONTH_NAMES_SHORT : MONTH_NAMES;
  let name = names[monthNumber - 1] ?? month;
  if (capitalize) name = name.charAt(0).toUpperCase() + name.slice(1);
  if (!withYear) return name;
  return short ? `${name} ${String(year).slice(2)}` : `${name} ${year}`;
}

/** `2026-08-07` → `7 ago 2026`. */
export function dateLabel(date: DateKey, options: { withYear?: boolean } = {}): string {
  const { withYear = true } = options;
  const [year, month, day] = date.split('-');
  const name = MONTH_NAMES_SHORT[Number(month) - 1] ?? month;
  return withYear ? `${Number(day)} ${name} ${year}` : `${Number(day)} ${name}`;
}

/** Etiqueta relativa amable para encabezados: `Este mes`, `Mes pasado`. */
export function relativeMonthLabel(month: MonthKey, reference = currentMonth()): string {
  const diff = monthsBetween(reference, month);
  if (diff === 0) return 'Este mes';
  if (diff === 1) return 'Próximo mes';
  if (diff === -1) return 'Mes pasado';
  return monthLabel(month);
}

/** Timestamp ISO completo, para columnas `created_at`. */
export function nowTimestamp(): string {
  return new Date().toISOString();
}
