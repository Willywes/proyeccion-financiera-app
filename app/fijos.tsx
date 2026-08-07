/**
 * Ingresos y gastos fijos.
 *
 * Es la pantalla que hace útil la proyección: sin recurrentes no hay nada que
 * proyectar hacia adelante más allá de las cuotas de deuda.
 */

import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAsyncData } from '../src/hooks/useAsyncData';
import {
  listRecurringRules,
  setRecurringRuleActive,
} from '../src/repositories/recurring';
import { Button, FloatingActionButton } from '../src/ui/Button';
import { Card, Divider } from '../src/ui/Card';
import { Badge, EmptyState } from '../src/ui/Feedback';
import { CategoryAvatar } from '../src/ui/ListItems';
import { MoneyText } from '../src/ui/MoneyText';
import {
  ErrorScreen,
  LoadingScreen,
  ModalHeader,
  Screen,
  SectionTitle,
} from '../src/ui/Screen';

export default function RecurringRulesScreen() {
  const router = useRouter();

  const load = useCallback(() => listRecurringRules(), []);
  const { data, loading, error, reload } = useAsyncData(load, 'fijos');

  if (error) return <ErrorScreen error={error} />;
  if (loading && !data) return <LoadingScreen />;

  const rules = data ?? [];
  const income = rules.filter((rule) => rule.type === 'income');
  const expense = rules.filter((rule) => rule.type === 'expense');

  // Sólo lo activo cuenta para el resumen mensual: lo pausado no se proyecta.
  const monthlyIncome = income
    .filter((rule) => rule.active)
    .reduce((accumulator, rule) => accumulator + rule.amount, 0);
  const monthlyExpense = expense
    .filter((rule) => rule.active)
    .reduce((accumulator, rule) => accumulator + rule.amount, 0);

  const handleToggle = async (id: number, active: boolean) => {
    await setRecurringRuleActive(id, active);
    reload();
  };

  return (
    <View className="flex-1">
      <ModalHeader
        title="Ingresos y gastos fijos"
        subtitle="Lo que se repite todos los meses"
        onClose={() => router.back()}
        closeLabel="‹"
      />

      <Screen bottomPadding={96}>
        {rules.length > 0 ? (
          <View className="p-5">
            <Card>
              <View className="flex-row">
                <View className="flex-1 items-center">
                  <Text className="text-xs text-ink-soft">Entra al mes</Text>
                  <MoneyText amount={monthlyIncome} type="income" size="lg" />
                </View>
                <View className="w-px bg-line" />
                <View className="flex-1 items-center">
                  <Text className="text-xs text-ink-soft">Sale al mes</Text>
                  <MoneyText amount={monthlyExpense} type="expense" size="lg" />
                </View>
                <View className="w-px bg-line" />
                <View className="flex-1 items-center">
                  <Text className="text-xs text-ink-soft">Queda</Text>
                  <MoneyText
                    amount={monthlyIncome - monthlyExpense}
                    size="lg"
                    className={
                      monthlyIncome - monthlyExpense < 0
                        ? 'text-expense-700'
                        : 'text-ink'
                    }
                  />
                </View>
              </View>
            </Card>
          </View>
        ) : null}

        {rules.length === 0 ? (
          <View className="mx-5 mt-6">
            <Card>
              <EmptyState
                icon="🔁"
                title="Todavía no tienes fijos"
                description="Agrega tu sueldo, el arriendo, las cuentas y las suscripciones. Con eso la app puede proyectar tus próximos meses."
                action={
                  <Button
                    label="Agregar el primero"
                    onPress={() => router.push('/fijo/nuevo')}
                  />
                }
              />
            </Card>
          </View>
        ) : null}

        {income.length > 0 ? (
          <>
            <SectionTitle>Ingresos fijos</SectionTitle>
            <View className="mx-5 overflow-hidden rounded-card border border-line bg-surface">
              {income.map((rule, index) => (
                <View key={rule.id}>
                  {index > 0 ? <Divider /> : null}
                  <RuleRow
                    rule={rule}
                    onPress={() => router.push(`/fijo/${rule.id}`)}
                    onToggle={() => handleToggle(rule.id, !rule.active)}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {expense.length > 0 ? (
          <>
            <SectionTitle>Gastos fijos</SectionTitle>
            <View className="mx-5 overflow-hidden rounded-card border border-line bg-surface">
              {expense.map((rule, index) => (
                <View key={rule.id}>
                  {index > 0 ? <Divider /> : null}
                  <RuleRow
                    rule={rule}
                    onPress={() => router.push(`/fijo/${rule.id}`)}
                    onToggle={() => handleToggle(rule.id, !rule.active)}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}
      </Screen>

      <FloatingActionButton
        onPress={() => router.push('/fijo/nuevo')}
        label="Nuevo fijo"
      />
    </View>
  );
}

function RuleRow({
  rule,
  onPress,
  onToggle,
}: {
  rule: {
    id: number;
    name: string;
    amount: number;
    type: 'income' | 'expense';
    dayOfMonth: number;
    active: boolean;
    categoryName: string | null;
    categoryColor: string | null;
    categoryIcon: string | null;
    endMonth: string | null;
  };
  onPress: () => void;
  onToggle: () => void;
}) {
  return (
    <View className={`flex-row items-center gap-3 p-3 ${rule.active ? '' : 'opacity-50'}`}>
      <CategoryAvatar icon={rule.categoryIcon} color={rule.categoryColor} />

      <Text onPress={onPress} className="flex-1">
        <Text className="text-base font-medium text-ink">{rule.name}</Text>
        {'\n'}
        <Text className="text-xs text-ink-muted">
          Día {rule.dayOfMonth} · {rule.categoryName ?? 'Sin categoría'}
          {rule.endMonth ? ` · hasta ${rule.endMonth}` : ''}
        </Text>
      </Text>

      <View className="items-end gap-1">
        <MoneyText amount={rule.amount} type={rule.type} size="sm" />
        <Text
          onPress={onToggle}
          className="text-[11px] font-semibold text-brand-600"
          accessibilityRole="button"
        >
          {rule.active ? 'Pausar' : 'Activar'}
        </Text>
      </View>

      {!rule.active ? <Badge label="Pausado" /> : null}
    </View>
  );
}
