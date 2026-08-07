/** Selector de mes que encabeza las pantallas de resumen y movimientos. */

import { Pressable, Text, View } from 'react-native';
import { currentMonth, isCurrentMonth, monthLabel } from '../domain/dates';
import { useMonthStore } from '../state/useMonthStore';

export function MonthSwitcher({ onSurface = 'brand' }: { onSurface?: 'brand' | 'light' }) {
  const month = useMonthStore((state) => state.month);
  const goToPreviousMonth = useMonthStore((state) => state.goToPreviousMonth);
  const goToNextMonth = useMonthStore((state) => state.goToNextMonth);
  const goToCurrentMonth = useMonthStore((state) => state.goToCurrentMonth);

  const isCurrent = isCurrentMonth(month);
  const onBrand = onSurface === 'brand';

  const arrowClass = onBrand
    ? 'text-xl font-bold text-white'
    : 'text-xl font-bold text-brand-600';
  const labelClass = onBrand
    ? 'text-base font-semibold text-white'
    : 'text-base font-semibold text-ink';
  const pressableClass = onBrand
    ? 'h-10 w-10 items-center justify-center rounded-full active:bg-brand-700'
    : 'h-10 w-10 items-center justify-center rounded-full active:bg-surface-sunken';

  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        onPress={goToPreviousMonth}
        accessibilityRole="button"
        accessibilityLabel="Mes anterior"
        className={pressableClass}
      >
        <Text className={arrowClass}>‹</Text>
      </Pressable>

      <Pressable
        onPress={goToCurrentMonth}
        accessibilityRole="button"
        accessibilityLabel={`${monthLabel(month)}. Toca para volver al mes actual`}
        className="flex-1 items-center"
      >
        <Text className={labelClass}>{monthLabel(month)}</Text>
        {!isCurrent ? (
          <Text
            className={`text-[11px] ${onBrand ? 'text-brand-200' : 'text-ink-muted'}`}
          >
            Volver a {monthLabel(currentMonth(), { short: true })}
          </Text>
        ) : null}
      </Pressable>

      <Pressable
        onPress={goToNextMonth}
        accessibilityRole="button"
        accessibilityLabel="Mes siguiente"
        className={pressableClass}
      >
        <Text className={arrowClass}>›</Text>
      </Pressable>
    </View>
  );
}
