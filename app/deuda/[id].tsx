/** Detalle de una deuda: avance, tabla de cuotas y registro de pagos. */

import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { currentMonth, dateLabel, monthLabel } from '../../src/domain/dates';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import {
  deleteDebt,
  getDebtSummary,
  listInstallments,
  payInstallment,
  unpayInstallment,
} from '../../src/repositories/debts';
import { Button } from '../../src/ui/Button';
import { Card, DataRow, Divider } from '../../src/ui/Card';
import { Badge, Notice, ProgressBar } from '../../src/ui/Feedback';
import { MoneyText } from '../../src/ui/MoneyText';
import {
  ErrorScreen,
  LoadingScreen,
  ModalHeader,
  Screen,
  SectionTitle,
} from '../../src/ui/Screen';
import { DEBT_MARK } from '../../src/theme/chart';
import type { DebtInstallment, DebtKind } from '../../src/domain/types';

const KIND_LABEL: Record<DebtKind, string> = {
  loan: 'Crédito',
  credit_card: 'Tarjeta de crédito',
  installment: 'Compra en cuotas',
  other: 'Otra deuda',
};

export default function DebtDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const debtId = Number(params.id);

  const [busyInstallment, setBusyInstallment] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [debt, installments] = await Promise.all([
      getDebtSummary(debtId),
      listInstallments(debtId),
    ]);
    return { debt, installments };
  }, [debtId]);

  const { data, loading, error, reload } = useAsyncData(load, `deuda:${debtId}`);

  if (error) return <ErrorScreen error={error} />;
  if (loading && !data) return <LoadingScreen />;

  const debt = data?.debt ?? null;
  const installments = data?.installments ?? [];

  if (!debt) {
    return (
      <>
        <ModalHeader title="Deuda" onClose={() => router.back()} closeLabel="‹" />
        <Screen>
          <View className="p-5">
            <Notice tone="warning" title="Esta deuda ya no existe">
              Puede que la hayas eliminado desde otra pantalla.
            </Notice>
          </View>
        </Screen>
      </>
    );
  }

  const progress =
    debt.installmentsTotal > 0
      ? (debt.installmentsPaid / debt.installmentsTotal) * 100
      : 0;
  const totalInterest = installments.reduce(
    (accumulator, installment) => accumulator + installment.interestPart,
    0,
  );

  const handleTogglePaid = async (installment: DebtInstallment) => {
    setBusyInstallment(installment.id);
    try {
      if (installment.paid) await unpayInstallment(installment.id);
      else await payInstallment(installment.id);
      reload();
    } finally {
      setBusyInstallment(null);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      `¿Eliminar "${debt.name}"?`,
      'Se borran la deuda y todas sus cuotas. Los pagos que ya registraste quedan como gastos en tu historial.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteDebt(debtId);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <>
      <ModalHeader
        title={debt.name}
        subtitle={KIND_LABEL[debt.kind]}
        onClose={() => router.back()}
        closeLabel="‹"
        right={debt.closedAt ? <Badge label="Pagada" tone="income" /> : undefined}
      />

      <Screen>
        {/* Avance. */}
        <View className="p-5">
          <Card className="gap-4">
            <View className="items-center">
              <Text className="text-xs uppercase tracking-wider text-ink-muted">
                Falta por pagar
              </Text>
              <MoneyText
                amount={debt.totalPending}
                size="xl"
                className={debt.totalPending === 0 ? 'text-income-700' : 'text-ink'}
              />
            </View>

            <View className="gap-1.5">
              <ProgressBar value={progress} color={DEBT_MARK} height={10} />
              <View className="flex-row justify-between">
                <Text className="text-xs text-ink-soft">
                  {debt.installmentsPaid} de {debt.installmentsTotal} cuotas
                </Text>
                <Text className="text-xs font-semibold text-ink">
                  {Math.round(progress)}%
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Condiciones. */}
        <SectionTitle>Condiciones</SectionTitle>
        <View className="mx-5">
          <Card>
            <DataRow
              label="Monto financiado"
              value={<MoneyText amount={debt.principal} size="sm" />}
            />
            <Divider />
            <DataRow
              label="Total a pagar"
              value={<MoneyText amount={debt.totalToPay} size="sm" />}
            />
            <Divider />
            <DataRow
              label="Intereses"
              value={
                <MoneyText
                  amount={totalInterest}
                  size="sm"
                  className={totalInterest > 0 ? 'text-expense-700' : 'text-income-700'}
                />
              }
              hint={debt.annualRate > 0 ? `${debt.annualRate}% anual` : 'Sin interés'}
            />
            <Divider />
            <DataRow
              label="Ya pagado"
              value={
                <MoneyText amount={debt.totalPaid} size="sm" className="text-income-700" />
              }
            />
            <Divider />
            <DataRow
              label="Primera cuota"
              value={monthLabel(debt.startMonth)}
            />
            {debt.note ? (
              <>
                <Divider />
                <DataRow label="Nota" value={debt.note} />
              </>
            ) : null}
          </Card>
        </View>

        {/* Tabla de cuotas. */}
        <SectionTitle>Cuotas</SectionTitle>
        <View className="mx-5 overflow-hidden rounded-card border border-line bg-surface">
          {installments.map((installment, index) => {
            const overdue = !installment.paid && installment.dueMonth < currentMonth();
            const isNext =
              !installment.paid && installment.id === debt.nextInstallment?.id;

            return (
              <View key={installment.id}>
                {index > 0 ? <Divider /> : null}
                <View
                  className={`flex-row items-center gap-3 p-3 ${
                    isNext ? 'bg-debt-50' : ''
                  }`}
                >
                  <View
                    className={`h-9 w-9 items-center justify-center rounded-full ${
                      installment.paid
                        ? 'bg-income-100'
                        : overdue
                          ? 'bg-expense-100'
                          : 'bg-surface-sunken'
                    }`}
                  >
                    <Text className="text-xs font-bold text-ink-soft">
                      {installment.paid ? '✓' : installment.number}
                    </Text>
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-medium text-ink">
                        Cuota {installment.number}
                      </Text>
                      {overdue ? <Badge label="Atrasada" tone="expense" /> : null}
                      {isNext && !overdue ? (
                        <Badge label="Próxima" tone="debt" />
                      ) : null}
                    </View>
                    <Text className="text-xs text-ink-muted">
                      Vence {dateLabel(installment.dueDate)}
                      {installment.interestPart > 0
                        ? ` · interés incluido`
                        : ''}
                    </Text>
                  </View>

                  <View className="items-end gap-1">
                    <MoneyText
                      amount={installment.amount}
                      size="sm"
                      className={installment.paid ? 'text-ink-muted' : 'text-ink'}
                    />
                    <Button
                      label={installment.paid ? 'Deshacer' : 'Pagar'}
                      size="sm"
                      variant={installment.paid ? 'ghost' : 'secondary'}
                      loading={busyInstallment === installment.id}
                      onPress={() => handleTogglePaid(installment)}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View className="gap-3 p-5">
          <Notice tone="info" title="Cómo funciona el pago de cuotas">
            Al marcar una cuota como pagada se registra automáticamente el egreso del
            mes, así no tienes que anotarlo dos veces.
          </Notice>

          <Button label="Eliminar deuda" variant="danger" onPress={handleDelete} />
        </View>
      </Screen>
    </>
  );
}
