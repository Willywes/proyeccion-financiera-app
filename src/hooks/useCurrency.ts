/** Moneda configurada en el perfil, con helpers de formato ya enlazados. */

import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  formatCompactMoney,
  formatMoney,
  formatMoneyForInput,
  getCurrency,
  parseMoneyInput,
  type CurrencyInfo,
} from '../domain/money';

export interface CurrencyHelpers {
  currency: CurrencyInfo;
  format: (minorAmount: number, options?: { showSign?: boolean }) => string;
  formatCompact: (minorAmount: number) => string;
  formatForInput: (minorAmount: number | null) => string;
  parse: (input: string) => number | null;
}

export function useCurrency(): CurrencyHelpers {
  const { user } = useAuth();
  const currency = getCurrency(user?.currency);

  return useMemo(
    () => ({
      currency,
      format: (minorAmount, options) => formatMoney(minorAmount, currency, options),
      formatCompact: (minorAmount) => formatCompactMoney(minorAmount, currency),
      formatForInput: (minorAmount) => formatMoneyForInput(minorAmount, currency),
      parse: (input) => parseMoneyInput(input, currency),
    }),
    [currency],
  );
}
