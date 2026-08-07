/**
 * Monto formateado.
 *
 * El signo `+`/`−` va siempre que haya un tipo de movimiento, no sólo el color:
 * verde y rojo se confunden con daltonismo rojo-verde, así que el signo es la
 * señal que de verdad distingue un ingreso de un egreso. Ver `theme/chart.ts`.
 */

import { Text } from 'react-native';
import { useCurrency } from '../hooks/useCurrency';
import type { MovementType } from '../domain/types';

type MoneySize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'hero';

const SIZE_CLASS: Record<MoneySize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-2xl',
  hero: 'text-4xl',
};

interface MoneyTextProps {
  /** Monto en unidad mínima, siempre positivo si se entrega `type`. */
  amount: number;
  /**
   * Tipo de movimiento. Con `income` se muestra `+`, con `expense` `−`.
   * Si se omite, el signo sale del propio monto (saldos, netos).
   */
  type?: MovementType;
  size?: MoneySize;
  /** Fuerza un color; por defecto lo decide el tipo o el signo. */
  className?: string;
  /** Muestra el monto en versión compacta (`$1,2M`). */
  compact?: boolean;
}

export function MoneyText({
  amount,
  type,
  size = 'base',
  className,
  compact = false,
}: MoneyTextProps) {
  const { format, formatCompact } = useCurrency();

  const text = compact ? formatCompact(Math.abs(amount)) : format(Math.abs(amount));
  const prefix = type === 'income' ? '+' : type === 'expense' ? '−' : amount < 0 ? '−' : '';

  const colorClass =
    className ??
    (type === 'income'
      ? 'text-income-700'
      : type === 'expense'
        ? 'text-expense-700'
        : amount < 0
          ? 'text-expense-700'
          : 'text-ink');

  return (
    <Text className={`font-bold ${SIZE_CLASS[size]} ${colorClass}`}>
      {prefix}
      {text}
    </Text>
  );
}

/** Saldo: neutro cuando es positivo, en rojo cuando queda bajo cero. */
export function BalanceText({
  amount,
  size = 'base',
  compact = false,
}: {
  amount: number;
  size?: MoneySize;
  compact?: boolean;
}) {
  return (
    <MoneyText
      amount={amount}
      size={size}
      compact={compact}
      className={amount < 0 ? 'text-expense-700' : 'text-ink'}
    />
  );
}
