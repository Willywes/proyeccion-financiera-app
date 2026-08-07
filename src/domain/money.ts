/**
 * Manejo de dinero. Todo monto viaja como entero en la unidad mínima de la
 * moneda para evitar errores de redondeo de punto flotante.
 */

export interface CurrencyInfo {
  code: string;
  symbol: string;
  /** Decimales de la moneda: CLP = 0, USD = 2. */
  decimals: number;
  /** Separador de miles usado al formatear. */
  groupSeparator: string;
  /** Separador decimal usado al formatear y al parsear entrada del usuario. */
  decimalSeparator: string;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  CLP: {
    code: 'CLP',
    symbol: '$',
    decimals: 0,
    groupSeparator: '.',
    decimalSeparator: ',',
  },
  ARS: {
    code: 'ARS',
    symbol: '$',
    decimals: 2,
    groupSeparator: '.',
    decimalSeparator: ',',
  },
  MXN: {
    code: 'MXN',
    symbol: '$',
    decimals: 2,
    groupSeparator: ',',
    decimalSeparator: '.',
  },
  COP: {
    code: 'COP',
    symbol: '$',
    decimals: 0,
    groupSeparator: '.',
    decimalSeparator: ',',
  },
  PEN: {
    code: 'PEN',
    symbol: 'S/',
    decimals: 2,
    groupSeparator: ',',
    decimalSeparator: '.',
  },
  USD: {
    code: 'USD',
    symbol: 'US$',
    decimals: 2,
    groupSeparator: ',',
    decimalSeparator: '.',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    decimals: 2,
    groupSeparator: '.',
    decimalSeparator: ',',
  },
};

export const DEFAULT_CURRENCY = 'CLP';

export function getCurrency(code: string | undefined): CurrencyInfo {
  return CURRENCIES[code ?? ''] ?? CURRENCIES[DEFAULT_CURRENCY];
}

/** Agrupa la parte entera con el separador de miles de la moneda. */
function groupDigits(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Formatea un monto en unidad mínima como texto legible.
 * `formatMoney(1234500, CLP)` → `"$1.234.500"`
 */
export function formatMoney(
  minorAmount: number,
  currency: CurrencyInfo,
  options: { showSign?: boolean; hideSymbol?: boolean } = {},
): string {
  const { showSign = false, hideSymbol = false } = options;
  const negative = minorAmount < 0;
  const absolute = Math.abs(Math.round(minorAmount));
  const factor = 10 ** currency.decimals;
  const whole = Math.floor(absolute / factor);
  const fraction = absolute % factor;

  let text = groupDigits(String(whole), currency.groupSeparator);
  if (currency.decimals > 0) {
    text += currency.decimalSeparator + String(fraction).padStart(currency.decimals, '0');
  }
  if (!hideSymbol) text = currency.symbol + text;

  if (negative) return '-' + text;
  if (showSign && minorAmount > 0) return '+' + text;
  return text;
}

/** Versión compacta para gráficos y ejes: `$1,2M`, `$450k`. */
export function formatCompactMoney(minorAmount: number, currency: CurrencyInfo): string {
  const factor = 10 ** currency.decimals;
  const major = Math.abs(minorAmount) / factor;
  const sign = minorAmount < 0 ? '-' : '';

  const compact = (value: number, suffix: string) => {
    const rounded = Math.round(value * 10) / 10;
    const text =
      rounded % 1 === 0
        ? String(rounded)
        : String(rounded).replace('.', currency.decimalSeparator);
    return `${sign}${currency.symbol}${text}${suffix}`;
  };

  if (major >= 1_000_000_000) return compact(major / 1_000_000_000, 'MM');
  if (major >= 1_000_000) return compact(major / 1_000_000, 'M');
  if (major >= 1_000) return compact(major / 1_000, 'k');
  return formatMoney(minorAmount, currency);
}

/**
 * Convierte lo que el usuario escribió en un monto en unidad mínima.
 * Tolera separadores de miles, el símbolo de la moneda y espacios.
 * Devuelve `null` si el texto no contiene un número válido.
 */
export function parseMoneyInput(input: string, currency: CurrencyInfo): number | null {
  const cleaned = input
    .replace(/\s/g, '')
    .replace(currency.symbol, '')
    .replace(/[^\d.,-]/g, '');
  if (!cleaned || cleaned === '-') return null;

  // Se descarta el separador de miles y se normaliza el decimal a punto.
  const normalized = cleaned
    .split(currency.groupSeparator)
    .join('')
    .replace(currency.decimalSeparator, '.');

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  return Math.round(value * 10 ** currency.decimals);
}

/** Formatea para mostrar dentro de un input editable (sin símbolo). */
export function formatMoneyForInput(
  minorAmount: number | null,
  currency: CurrencyInfo,
): string {
  if (minorAmount === null) return '';
  return formatMoney(minorAmount, currency, { hideSymbol: true });
}

/** Convierte unidad mínima a unidad mayor (para cálculos con tasas). */
export function toMajor(minorAmount: number, currency: CurrencyInfo): number {
  return minorAmount / 10 ** currency.decimals;
}

/** Reparte `total` en `parts` montos enteros que suman exactamente `total`. */
export function splitEvenly(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, index) =>
    index < remainder ? base + 1 : base,
  );
}
