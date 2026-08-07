/** Deudas activas, su avance y las cuotas por vencer. */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentMonth, dateLabel, monthLabel } from '../../src/domain/dates';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import {
  getMonthDebtLoad,
  listDebts,
  listOverdueInstallments,
  payInstallment,
} from '../../src/repositories/debts';
import { Button, FloatingActionButton, SegmentedControl } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { Badge, EmptyState, Notice, ProgressBar } from '../../src/ui/Feedback';
import { InstallmentItem } from '../../src/ui/ListItems';
import { MoneyText } from '../../src/ui/MoneyText';
import {
  ErrorScreen,
  LoadingScreen,
  Screen,
  SectionTitle,
} from '../../src/ui/Screen';
import { DEBT_MARK } from '../../src/theme/chart';
import type { DebtKind, DebtSummary } from '../../src/domain/types';

const KIND_LABEL: Record<DebtKind, string> = {
  loan: 'Crédito',
  credit_card: 'Tarjeta',
  installment: 'Cuotas',
  other: 'Otra',
};

const KIND_ICON: Record<DebtKind, string> = {
  loan: '🏦',
  credit_card: '💳',
  installment: '🧾',
  other: '📄',
};

type Scope = 'active' | 'all';

export default function DebtsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<Scope>('active');

  const load = useCallback(async () => {
    const [debts, overdue, monthLoad] = await Promise.all([
      listDebts({ includeClosed: scope === 'all' }),
      listOverdueInstallments(),
      getMonthDebtLoad(currentMonth()),
    ]);
    return { debts, overdue, monthLoad };
  }, [scope]);

  const { data, loading, error, reload } = useAsyncData(load, `deudas:${scope}`);

  if (error) return <ErrorScreen error={error} />;
  if (loading && !data) return <LoadingScreen />;
  if (!data) return <LoadingScreen />;

  const { debts, overdue, monthLoad } = data;

  // Totales de la cartera completa, no sólo de lo que se muestra en pantalla.
  const totalPending = debts.reduce((accumulator, debt) => accumulator + debt.totalPending, 0);
  const activeCount = debts.filter((debt) => debt.closedAt === null).length;

  const handlePay = async (installmentId: number) => {
    await payInstallment(installmentId);
    reload();
  };

  return (
    <View className="flex-1">
      <Screen bottomPadding={96}>
        <View
          className="bg-brand-600 px-5 pb-6"
          style={{ paddingTop: insets.top + 12 }}
        >
          <Text className="text-2xl font-bold text-white">Deudas</Text>
          <Text className="mt-1 text-sm text-brand-100">
            {activeCount === 0
              ? 'No tienes deudas activas'
              : `${activeCount} ${activeCount === 1 ? 'deuda activa' : 'deudas activas'}`}
          </Text>

          <View className="mt-5 flex-row gap-3">
            <View className="flex-1 rounded-card bg-brand-700/60 p-3">
              <Text className="text-xs text-brand-100">Falta por pagar</Text>
              <MoneyText amount={totalPending} size="lg" className="text-white" />
            </View>
            <View className="flex-1 rounded-card bg-brand-700/60 p-3">
              <Text className="text-xs text-brand-100">
                Cuotas de {monthLabel(currentMonth(), { short: true, withYear: false })}
              </Text>
              <MoneyText amount={monthLoad.total} size="lg" className="text-white" />
            </View>
          </View>
        </View>

        {overdue.length > 0 ? (
          <View className="px-5 pt-4">
            <Notice
              tone="danger"
              title={`${overdue.length} ${overdue.length === 1 ? 'cuota atrasada' : 'cuotas atrasadas'}`}
            >
              {`La más antigua venció el ${dateLabel(overdue[0].dueDate)}.`}
            </Notice>
          </View>
        ) : null}

        {debts.length > 0 ? (
          <View className="px-5 pt-4">
            <SegmentedControl<Scope>
              value={scope}
              onChange={setScope}
              options={[
                { value: 'active', label: 'Activas' },
                { value: 'all', label: 'Todas' },
              ]}
            />
          </View>
        ) : null}

        {debts.length === 0 ? (
          <View className="mx-5 mt-6">
            <Card>
              <EmptyState
                icon="💳"
                title={scope === 'active' ? 'Sin deudas activas' : 'Aún no registras deudas'}
                description="Registra un crédito o una compra en cuotas y la app calcula la tabla completa y la suma a tu proyección."
                action={
                  <Button
                    label="Registrar una deuda"
                    onPress={() => router.push('/deuda/nueva')}
                  />
                }
              />
            </Card>
          </View>
        ) : (
          <>
            <SectionTitle>Tus deudas</SectionTitle>
            <View className="gap-3 px-5">
              {debts.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  onPress={() => router.push(`/deuda/${debt.id}`)}
                  onPayNext={
                    debt.nextInstallment
                      ? () => handlePay(debt.nextInstallment!.id)
                      : undefined
                  }
                />
              ))}
            </View>
          </>
        )}

        {overdue.length > 0 ? (
          <>
            <SectionTitle>Cuotas atrasadas</SectionTitle>
            <View className="mx-5 overflow-hidden rounded-card border border-line bg-surface">
              {overdue.map((installment) => (
                <InstallmentItem
                  key={installment.id}
                  installment={installment}
                  showDebtName
                  overdue
                  onPress={() => router.push(`/deuda/${installment.debtId}`)}
                />
              ))}
            </View>
          </>
        ) : null}
      </Screen>

      <FloatingActionButton
        onPress={() => router.push('/deuda/nueva')}
        label="Nueva deuda"
      />
    </View>
  );
}

function DebtCard({
  debt,
  onPress,
  onPayNext,
}: {
  debt: DebtSummary;
  onPress: () => void;
  onPayNext?: () => void;
}) {
  const progress =
    debt.installmentsTotal > 0
      ? (debt.installmentsPaid / debt.installmentsTotal) * 100
      : 0;
  const closed = debt.closedAt !== null;
  const overdue =
    debt.nextInstallment !== null && debt.nextInstallment.dueMonth < currentMonth();

  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-debt-50">
          <Text className="text-lg">{KIND_ICON[debt.kind]}</Text>
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-base font-semibold text-ink" numberOfLines={1}>
              {debt.name}
            </Text>
            {closed ? (
              <Badge label="Pagada" tone="income" />
            ) : overdue ? (
              <Badge label="Atrasada" tone="expense" />
            ) : (
              <Badge label={KIND_LABEL[debt.kind]} tone="debt" />
            )}
          </View>

          <Text className="mt-0.5 text-xs text-ink-muted">
            {debt.installmentsPaid} de {debt.installmentsTotal} cuotas pagadas
            {debt.annualRate > 0 ? ` · ${debt.annualRate}% anual` : ' · sin interés'}
          </Text>

          <View className="mt-3 gap-1.5">
            <ProgressBar value={progress} color={DEBT_MARK} />
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-ink-soft">
                {closed ? 'Pagada por completo' : 'Falta por pagar'}
              </Text>
              <MoneyText
                amount={debt.totalPending}
                size="sm"
                className={closed ? 'text-income-700' : 'text-ink'}
              />
            </View>
          </View>

          {debt.nextInstallment && !closed ? (
            <View className="mt-3 flex-row items-center gap-3 rounded-xl bg-surface-sunken p-3">
              <View className="flex-1">
                <Text className="text-xs text-ink-soft">
                  Cuota {debt.nextInstallment.number} · vence{' '}
                  {dateLabel(debt.nextInstallment.dueDate, { withYear: false })}
                </Text>
                <MoneyText amount={debt.nextInstallment.amount} size="base" />
              </View>
              {onPayNext ? (
                <Button
                  label="Pagar"
                  size="sm"
                  variant="secondary"
                  onPress={onPayNext}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
