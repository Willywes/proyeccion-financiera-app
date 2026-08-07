/** Filas reutilizables de las listas de la app. */

import { Pressable, Text, View } from 'react-native';
import { dateLabel } from '../domain/dates';
import { MoneyText } from './MoneyText';
import { Badge } from './Feedback';
import type { TransactionWithCategory } from '../domain/types';
import type { UpcomingInstallment } from '../repositories/debts';

/** Círculo con el icono y color de la categoría. */
export function CategoryAvatar({
  icon,
  color,
  size = 40,
}: {
  icon: string | null;
  color: string | null;
  size?: number;
}) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        // Fondo tenue del color de la categoría, con el emoji arriba.
        backgroundColor: `${color ?? '#94a3b8'}22`,
      }}
    >
      <Text style={{ fontSize: size * 0.45 }}>{icon ?? '📦'}</Text>
    </View>
  );
}

export function TransactionItem({
  transaction,
  onPress,
  showDate = true,
}: {
  transaction: TransactionWithCategory;
  onPress?: () => void;
  showDate?: boolean;
}) {
  const title = transaction.categoryName ?? 'Sin categoría';
  const subtitleParts = [
    showDate ? dateLabel(transaction.date, { withYear: false }) : null,
    transaction.note,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 px-5 py-3 active:bg-surface-sunken"
    >
      <CategoryAvatar icon={transaction.categoryIcon} color={transaction.categoryColor} />

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-base font-medium text-ink" numberOfLines={1}>
            {title}
          </Text>
          {transaction.debtInstallmentId !== null ? (
            <Badge label="Cuota" tone="debt" />
          ) : transaction.recurringRuleId !== null ? (
            <Badge label="Fijo" tone="brand" />
          ) : null}
        </View>
        {subtitleParts.length > 0 ? (
          <Text className="text-xs text-ink-muted" numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </Text>
        ) : null}
      </View>

      <MoneyText amount={transaction.amount} type={transaction.type} size="base" />
    </Pressable>
  );
}

/** Fila de cuota, en el detalle de una deuda y en las próximas a vencer. */
export function InstallmentItem({
  installment,
  onPress,
  showDebtName = false,
  overdue = false,
}: {
  installment: UpcomingInstallment;
  onPress?: () => void;
  showDebtName?: boolean;
  overdue?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 px-5 py-3 active:bg-surface-sunken"
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-full ${
          installment.paid ? 'bg-income-100' : overdue ? 'bg-expense-100' : 'bg-debt-100'
        }`}
      >
        <Text className="text-base">
          {installment.paid ? '✓' : overdue ? '!' : String(installment.number)}
        </Text>
      </View>

      <View className="flex-1">
        <Text className="text-base font-medium text-ink" numberOfLines={1}>
          {showDebtName
            ? installment.debtName
            : `Cuota ${installment.number} de ${installment.installmentsTotal}`}
        </Text>
        <Text className="text-xs text-ink-muted">
          {showDebtName
            ? `Cuota ${installment.number}/${installment.installmentsTotal} · vence ${dateLabel(installment.dueDate, { withYear: false })}`
            : `Vence ${dateLabel(installment.dueDate)}`}
        </Text>
      </View>

      <View className="items-end gap-1">
        <MoneyText
          amount={installment.amount}
          size="base"
          className={installment.paid ? 'text-ink-muted' : 'text-ink'}
        />
        {installment.paid ? (
          <Badge label="Pagada" tone="income" />
        ) : overdue ? (
          <Badge label="Atrasada" tone="expense" />
        ) : null}
      </View>
    </Pressable>
  );
}

/** Fila con el borde superior fino que separa elementos de una lista. */
export function ListSeparator() {
  return <View className="ml-[72px] h-px bg-line" />;
}
