/** Barras de progreso, estados vacíos y avisos. */

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * Barra de progreso. Nunca es la única señal: siempre va con su valor en texto,
 * porque el color solo no comunica el dato.
 */
export function ProgressBar({
  /** Porcentaje 0–100. */
  value,
  color = '#4f46e5',
  height = 8,
  trackClassName = 'bg-surface-sunken',
}: {
  value: number;
  color?: string;
  height?: number;
  trackClassName?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <View
      className={`w-full overflow-hidden rounded-pill ${trackClassName}`}
      style={{ height }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    >
      <View
        className="h-full rounded-pill"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View className="items-center gap-2 px-8 py-12">
      <Text className="text-5xl">{icon}</Text>
      <Text className="text-center text-base font-semibold text-ink">{title}</Text>
      {description ? (
        <Text className="text-center text-sm leading-5 text-ink-soft">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-3 w-full">{action}</View> : null}
    </View>
  );
}

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

const NOTICE_STYLES: Record<NoticeTone, { container: string; icon: string }> = {
  info: { container: 'bg-brand-50 border-brand-200', icon: 'ℹ️' },
  warning: { container: 'bg-debt-50 border-debt-200', icon: '⚠️' },
  danger: { container: 'bg-expense-50 border-expense-200', icon: '🚨' },
  success: { container: 'bg-income-50 border-income-200', icon: '✅' },
};

/** Aviso contextual. El icono acompaña al color para no depender de él. */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: NoticeTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const style = NOTICE_STYLES[tone];

  return (
    <View className={`gap-1 rounded-card border p-3 ${style.container}`}>
      <View className="flex-row items-center gap-2">
        <Text>{style.icon}</Text>
        <Text className="flex-1 text-sm font-semibold text-ink">{title}</Text>
      </View>
      {children ? (
        typeof children === 'string' ? (
          <Text className="text-xs leading-4 text-ink-soft">{children}</Text>
        ) : (
          children
        )
      ) : null}
      {action ? <View className="mt-1">{action}</View> : null}
    </View>
  );
}

type BadgeTone = 'neutral' | 'income' | 'expense' | 'debt' | 'brand';

const BADGE_STYLES: Record<BadgeTone, { container: string; label: string }> = {
  neutral: { container: 'bg-surface-sunken', label: 'text-ink-soft' },
  income: { container: 'bg-income-100', label: 'text-income-700' },
  expense: { container: 'bg-expense-100', label: 'text-expense-700' },
  debt: { container: 'bg-debt-100', label: 'text-debt-700' },
  brand: { container: 'bg-brand-100', label: 'text-brand-700' },
};

/** Etiqueta pequeña de estado. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const style = BADGE_STYLES[tone];

  return (
    <View className={`rounded-pill px-2 py-0.5 ${style.container}`}>
      <Text className={`text-[11px] font-semibold ${style.label}`}>{label}</Text>
    </View>
  );
}
