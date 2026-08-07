/**
 * Proyección de saldo hacia adelante.
 *
 * La tabla mes a mes de abajo no es decoración: es la vista alternativa del
 * mismo dato del gráfico, para quien no puede leer una línea o necesita el
 * número exacto.
 */

import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { addMonths, currentMonth, monthLabel } from '../../src/domain/dates';
import {
  averageMonthlyNet,
  buildProjection,
  debtLoadRatio,
} from '../../src/domain/projection';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { listRecurringRules } from '../../src/repositories/recurring';
import { listPendingInstallments } from '../../src/repositories/debts';
import {
  getMaterializedRuleKeys,
  getNetBeforeMonth,
  getTotalsByMonth,
} from '../../src/repositories/transactions';
import { BalanceChart } from '../../src/ui/BalanceChart';
import { Button, SegmentedControl } from '../../src/ui/Button';
import { Card, DataRow, Divider } from '../../src/ui/Card';
import { EmptyState, Notice, ProgressBar } from '../../src/ui/Feedback';
import { MoneyText, BalanceText } from '../../src/ui/MoneyText';
import {
  ErrorScreen,
  LoadingScreen,
  Screen,
  SectionTitle,
} from '../../src/ui/Screen';
import { DEBT_MARK } from '../../src/theme/chart';

type Horizon = '6' | '12' | '24';

export default function ProjectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [horizon, setHorizon] = useState<Horizon>('12');

  const months = Number(horizon);
  const startMonth = currentMonth();
  const endMonth = addMonths(startMonth, months - 1);

  const load = useCallback(async () => {
    const [actuals, rules, pendingInstallments, materializedRules, netBefore] =
      await Promise.all([
        getTotalsByMonth(startMonth, endMonth),
        listRecurringRules({ onlyActive: true }),
        listPendingInstallments(),
        getMaterializedRuleKeys(startMonth, endMonth),
        getNetBeforeMonth(startMonth),
      ]);

    const projection = buildProjection({
      startMonth,
      months,
      // El saldo con el que arranca el mes actual: punto de partida del perfil
      // más todo lo que ya se movió en meses anteriores.
      openingBalance: (user?.openingBalance ?? 0) + netBefore,
      actuals,
      recurring: rules,
      pendingInstallments,
      materializedRules,
    });

    return { projection, ruleCount: rules.length };
  }, [startMonth, endMonth, months, user?.openingBalance]);

  const { data, loading, error } = useAsyncData(
    load,
    `proyeccion:${startMonth}:${months}:${user?.openingBalance ?? 0}`,
  );

  if (error) return <ErrorScreen error={error} />;
  if (loading && !data) return <LoadingScreen label="Calculando proyección…" />;
  if (!data) return <LoadingScreen />;

  const { projection, ruleCount } = data;
  const { rows, totals, firstNegativeMonth, overdue, finalBalance } = projection;

  const monthlyAverage = averageMonthlyNet(rows);
  const debtRatio = debtLoadRatio(rows);

  const hasSomethingToProject =
    ruleCount > 0 || totals.debtPayments > 0 || totals.income > 0 || totals.expense > 0;

  return (
    <Screen bottomPadding={32}>
      <View className="bg-brand-600 px-5 pb-6" style={{ paddingTop: insets.top + 12 }}>
        <Text className="text-2xl font-bold text-white">Proyección</Text>
        <Text className="mt-1 text-sm text-brand-100">
          Cómo se ve tu saldo si todo sigue igual
        </Text>

        <View className="mt-5 items-center">
          <Text className="text-xs uppercase tracking-wider text-brand-200">
            Saldo estimado en {monthLabel(endMonth, { short: true })}
          </Text>
          <View className="mt-1">
            <MoneyText
              amount={finalBalance}
              size="hero"
              className={finalBalance < 0 ? 'text-expense-200' : 'text-white'}
            />
          </View>
        </View>
      </View>

      <View className="px-5 py-4">
        <SegmentedControl<Horizon>
          value={horizon}
          onChange={setHorizon}
          options={[
            { value: '6', label: '6 meses' },
            { value: '12', label: '12 meses' },
            { value: '24', label: '24 meses' },
          ]}
        />
      </View>

      {!hasSomethingToProject ? (
        <View className="mx-5">
          <Card>
            <EmptyState
              icon="📈"
              title="Todavía no hay nada que proyectar"
              description="Agrega tus ingresos y gastos fijos (sueldo, arriendo, cuentas) y la proyección se calcula sola."
              action={
                <Button
                  label="Agregar ingresos y gastos fijos"
                  onPress={() => router.push('/fijos')}
                />
              }
            />
          </Card>
        </View>
      ) : (
        <>
          {/* Alertas antes del gráfico: si hay un problema, se ve primero. */}
          <View className="gap-3 px-5">
            {firstNegativeMonth ? (
              <Notice
                tone="danger"
                title={`Tu saldo queda en rojo en ${monthLabel(firstNegativeMonth)}`}
              >
                Con tus ingresos, gastos fijos y cuotas actuales, el dinero no alcanza
                a partir de ese mes. Conviene bajar gastos o reprogramar alguna deuda.
              </Notice>
            ) : (
              <Notice tone="success" title="Tu saldo se mantiene positivo">
                {`En los próximos ${months} meses no se proyecta un saldo negativo.`}
              </Notice>
            )}

            {overdue.count > 0 ? (
              <Notice
                tone="warning"
                title={`${overdue.count} ${overdue.count === 1 ? 'cuota vencida' : 'cuotas vencidas'} sin pagar`}
              >
                Se sumaron al mes en curso, porque se siguen debiendo hoy.
              </Notice>
            ) : null}

            {debtRatio >= 30 ? (
              <Notice tone="warning" title={`Tus cuotas son el ${debtRatio}% de tus ingresos`}>
                Sobre el 30% se considera una carga alta para un presupuesto familiar.
              </Notice>
            ) : null}
          </View>

          {/* Gráfico de saldo. */}
          <SectionTitle>Saldo proyectado</SectionTitle>
          <View className="mx-5">
            <Card>
              <BalanceChart rows={rows} />
            </Card>
          </View>

          {/* Cifras agregadas del período. */}
          <SectionTitle>Resumen del período</SectionTitle>
          <View className="mx-5">
            <Card>
              <DataRow
                label="Ingresos proyectados"
                value={<MoneyText amount={totals.income} type="income" size="sm" />}
              />
              <Divider />
              <DataRow
                label="Egresos proyectados"
                value={<MoneyText amount={totals.expense} type="expense" size="sm" />}
              />
              <Divider />
              <DataRow
                label="De eso, en cuotas de deuda"
                value={
                  <MoneyText
                    amount={totals.debtPayments}
                    size="sm"
                    className="text-debt-700"
                  />
                }
                hint={`${debtRatio}% de tus ingresos`}
              />
              <Divider />
              <DataRow
                label="Promedio disponible al mes"
                value={<BalanceText amount={monthlyAverage} size="sm" />}
                hint={
                  monthlyAverage >= 0
                    ? 'Lo que te queda libre cada mes en promedio'
                    : 'Cada mes gastas más de lo que entra'
                }
              />

              {debtRatio > 0 ? (
                <View className="mt-3 gap-1.5">
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-ink-soft">Carga de deuda</Text>
                    <Text className="text-xs font-semibold text-ink">{debtRatio}%</Text>
                  </View>
                  <ProgressBar value={debtRatio} color={DEBT_MARK} />
                </View>
              ) : null}
            </Card>
          </View>

          {/* Tabla mes a mes: el mismo dato del gráfico, en números exactos. */}
          <SectionTitle>Mes a mes</SectionTitle>
          <View className="mx-5 overflow-hidden rounded-card border border-line bg-surface">
            {rows.map((row, index) => (
              <View key={row.month}>
                {index > 0 ? <Divider /> : null}
                <MonthRow
                  month={row.month}
                  income={row.income}
                  expense={row.expense}
                  debtPayments={row.debtPayments}
                  net={row.net}
                  closingBalance={row.closingBalance}
                  isCurrent={row.isCurrent}
                />
              </View>
            ))}
          </View>

          <Text className="px-5 pt-4 text-xs leading-4 text-ink-muted">
            La proyección usa tus ingresos y gastos fijos más las cuotas de deuda
            programadas. Los meses ya cursados muestran tus movimientos reales.
          </Text>
        </>
      )}
    </Screen>
  );
}

/** Fila expandible de un mes proyectado. */
function MonthRow({
  month,
  income,
  expense,
  debtPayments,
  net,
  closingBalance,
  isCurrent,
}: {
  month: string;
  income: number;
  expense: number;
  debtPayments: number;
  net: number;
  closingBalance: number;
  isCurrent: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => setExpanded((value) => !value)}
      className="px-4 py-3 active:bg-surface-sunken"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-medium text-ink">
              {monthLabel(month, { short: true })}
            </Text>
            {isCurrent ? (
              <View className="rounded-pill bg-brand-100 px-2 py-0.5">
                <Text className="text-[10px] font-semibold text-brand-700">
                  En curso
                </Text>
              </View>
            ) : null}
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-xs text-ink-muted">Resultado</Text>
            <MoneyText
              amount={net}
              size="xs"
              className={net < 0 ? 'text-expense-700' : 'text-income-700'}
            />
          </View>
        </View>

        <View className="items-end">
          <BalanceText amount={closingBalance} size="base" />
          <Text className="text-[11px] text-ink-muted">saldo al cierre</Text>
        </View>
      </View>

      {expanded ? (
        <View className="mt-3 gap-1 rounded-xl bg-surface-sunken p-3">
          <DataRow
            label="Ingresos"
            value={<MoneyText amount={income} type="income" size="xs" />}
          />
          <DataRow
            label="Egresos"
            value={<MoneyText amount={expense} type="expense" size="xs" />}
          />
          {debtPayments > 0 ? (
            <DataRow
              label="Cuotas de deuda"
              value={
                <MoneyText amount={debtPayments} size="xs" className="text-debt-700" />
              }
            />
          ) : null}
          <Divider />
          <DataRow label="Resultado" value={<BalanceText amount={net} size="xs" />} />
        </View>
      ) : null}
    </Pressable>
  );
}
