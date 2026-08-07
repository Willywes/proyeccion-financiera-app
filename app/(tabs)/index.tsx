/** Resumen del mes: en qué estoy, qué falta por pagar y en qué se me va. */

import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { currentMonth, isCurrentMonth, monthLabel } from '../../src/domain/dates';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { useMonthStore } from '../../src/state/useMonthStore';
import {
  getCategoryTotals,
  getMonthTotals,
  getNetThroughMonth,
  listByMonth,
} from '../../src/repositories/transactions';
import { listPendingRulesForMonth, materializeRule } from '../../src/repositories/recurring';
import {
  getMonthDebtLoad,
  listOverdueInstallments,
  listUpcomingInstallments,
} from '../../src/repositories/debts';
import { Button, FloatingActionButton } from '../../src/ui/Button';
import { Card, Divider } from '../../src/ui/Card';
import { CategoryBreakdown } from '../../src/ui/CategoryBreakdown';
import { EmptyState, Notice } from '../../src/ui/Feedback';
import { InstallmentItem, TransactionItem } from '../../src/ui/ListItems';
import { MoneyText, BalanceText } from '../../src/ui/MoneyText';
import { MonthSwitcher } from '../../src/ui/MonthSwitcher';
import {
  ErrorScreen,
  LoadingScreen,
  Screen,
  SectionTitle,
} from '../../src/ui/Screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const month = useMonthStore((state) => state.month);

  const load = useCallback(
    async () => {
      const [
        totals,
        expenseByCategory,
        transactions,
        pendingRules,
        upcoming,
        overdue,
        debtLoad,
        netThroughMonth,
      ] = await Promise.all([
        getMonthTotals(month),
        getCategoryTotals(month, 'expense'),
        listByMonth(month),
        listPendingRulesForMonth(month),
        listUpcomingInstallments(3),
        listOverdueInstallments(),
        getMonthDebtLoad(month),
        getNetThroughMonth(month),
      ]);

      return {
        totals,
        expenseByCategory,
        transactions,
        pendingRules,
        upcoming,
        overdue,
        debtLoad,
        netThroughMonth,
      };
    },
    [month],
  );

  const { data, loading, error, reload } = useAsyncData(load, `resumen:${month}`);

  if (error) return <ErrorScreen error={error} />;
  if (loading && !data) return <LoadingScreen />;
  if (!data) return <LoadingScreen />;

  const {
    totals,
    expenseByCategory,
    transactions,
    pendingRules,
    upcoming,
    overdue,
    debtLoad,
    netThroughMonth,
  } = data;

  // Saldo acumulado a la fecha: el punto de partida del perfil más todo lo
  // registrado hasta el mes que se está mirando.
  const runningBalance = (user?.openingBalance ?? 0) + netThroughMonth;
  const viewingCurrentMonth = isCurrentMonth(month);

  const handleRegisterRule = async (ruleId: number) => {
    await materializeRule(ruleId, month);
    reload();
  };

  return (
    <View className="flex-1">
      <Screen bottomPadding={96}>
        {/* Encabezado con saldo y selector de mes. */}
        <View
          className="bg-brand-600 px-5 pb-6"
          style={{ paddingTop: insets.top + 12 }}
        >
          <Text className="text-sm text-brand-100">
            Hola{user?.name ? `, ${user.name}` : ''} 👋
          </Text>

          <View className="mt-4">
            <MonthSwitcher />
          </View>

          <View className="mt-5 items-center">
            <Text className="text-xs uppercase tracking-wider text-brand-200">
              {viewingCurrentMonth
                ? 'Saldo disponible'
                : `Saldo al cierre de ${monthLabel(month, { short: true })}`}
            </Text>
            <View className="mt-1">
              <MoneyText
                amount={runningBalance}
                size="hero"
                className={runningBalance < 0 ? 'text-expense-200' : 'text-white'}
              />
            </View>
          </View>

          <View className="mt-5 flex-row gap-3">
            <View className="flex-1 rounded-card bg-brand-700/60 p-3">
              <Text className="text-xs text-brand-100">Ingresos</Text>
              <MoneyText
                amount={totals.income}
                size="lg"
                className="text-white"
              />
            </View>
            <View className="flex-1 rounded-card bg-brand-700/60 p-3">
              <Text className="text-xs text-brand-100">Egresos</Text>
              <MoneyText
                amount={totals.expense}
                size="lg"
                className="text-white"
              />
            </View>
          </View>
        </View>

        <View className="gap-3 px-5 pt-4">
          {/* Resultado del mes: lo primero que uno quiere saber. */}
          <Card>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm text-ink-soft">Resultado del mes</Text>
                <Text className="text-xs text-ink-muted">
                  {totals.net >= 0 ? 'Estás ahorrando' : 'Estás gastando más de lo que entra'}
                </Text>
              </View>
              <BalanceText amount={totals.net} size="xl" />
            </View>
          </Card>

          {overdue.length > 0 ? (
            <Notice
              tone="danger"
              title={`${overdue.length} ${overdue.length === 1 ? 'cuota atrasada' : 'cuotas atrasadas'}`}
              action={
                <Button
                  label="Ver deudas"
                  variant="danger"
                  size="sm"
                  onPress={() => router.push('/deudas')}
                />
              }
            >
              Se siguen contando en tus proyecciones hasta que las marques como pagadas.
            </Notice>
          ) : null}

          {debtLoad.pending > 0 && viewingCurrentMonth ? (
            <Notice tone="warning" title="Cuotas por pagar este mes">
              <View className="flex-row items-center gap-1">
                <Text className="text-xs text-ink-soft">Te quedan cuotas por</Text>
                <MoneyText amount={debtLoad.pending} size="xs" className="text-debt-700" />
              </View>
            </Notice>
          ) : null}
        </View>

        {/* Fijos del mes que aún no se registran. */}
        {pendingRules.length > 0 ? (
          <>
            <SectionTitle
              action={
                <Text
                  onPress={() => router.push('/fijos')}
                  className="text-xs font-semibold text-brand-600"
                >
                  Administrar
                </Text>
              }
            >
              Fijos pendientes de {monthLabel(month, { short: true })}
            </SectionTitle>
            <View className="mx-5 overflow-hidden rounded-card border border-line bg-surface">
              {pendingRules.map((rule, index) => (
                <View key={rule.id}>
                  {index > 0 ? <Divider /> : null}
                  <View className="flex-row items-center gap-3 p-3">
                    <View className="flex-1">
                      <Text className="text-base font-medium text-ink" numberOfLines={1}>
                        {rule.name}
                      </Text>
                      <Text className="text-xs text-ink-muted">
                        Día {rule.dayOfMonth} · {rule.categoryName ?? 'Sin categoría'}
                      </Text>
                    </View>
                    <MoneyText amount={rule.amount} type={rule.type} size="sm" />
                    <Button
                      label="Registrar"
                      size="sm"
                      variant="secondary"
                      onPress={() => handleRegisterRule(rule.id)}
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Próximas cuotas. */}
        {upcoming.length > 0 ? (
          <>
            <SectionTitle
              action={
                <Text
                  onPress={() => router.push('/deudas')}
                  className="text-xs font-semibold text-brand-600"
                >
                  Ver todas
                </Text>
              }
            >
              Próximas cuotas
            </SectionTitle>
            <View className="mx-5 overflow-hidden rounded-card border border-line bg-surface">
              {upcoming.map((installment, index) => (
                <View key={installment.id}>
                  {index > 0 ? <Divider /> : null}
                  <InstallmentItem
                    installment={installment}
                    showDebtName
                    overdue={installment.dueMonth < currentMonth()}
                    onPress={() => router.push(`/deuda/${installment.debtId}`)}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* En qué se va la plata. */}
        {expenseByCategory.length > 0 ? (
          <>
            <SectionTitle>En qué gastaste</SectionTitle>
            <View className="mx-5">
              <Card>
                <CategoryBreakdown items={expenseByCategory} />
              </Card>
            </View>
          </>
        ) : null}

        {/* Últimos movimientos del mes. */}
        <SectionTitle
          action={
            transactions.length > 0 ? (
              <Text
                onPress={() => router.push('/movimientos')}
                className="text-xs font-semibold text-brand-600"
              >
                Ver todos
              </Text>
            ) : undefined
          }
        >
          Movimientos de {monthLabel(month, { short: true })}
        </SectionTitle>

        <View className="mx-5 overflow-hidden rounded-card border border-line bg-surface">
          {transactions.length === 0 ? (
            <EmptyState
              icon="🧾"
              title="Sin movimientos este mes"
              description="Registra tu primer ingreso o gasto para empezar a ver tus números."
              action={
                <Button
                  label="Registrar movimiento"
                  onPress={() => router.push('/movimiento/nuevo')}
                />
              }
            />
          ) : (
            transactions.slice(0, 6).map((transaction, index) => (
              <View key={transaction.id}>
                {index > 0 ? <Divider /> : null}
                <TransactionItem
                  transaction={transaction}
                  onPress={() => router.push(`/movimiento/${transaction.id}`)}
                />
              </View>
            ))
          )}
        </View>
      </Screen>

      <FloatingActionButton
        onPress={() => router.push('/movimiento/nuevo')}
        label="Registrar"
      />
    </View>
  );
}
