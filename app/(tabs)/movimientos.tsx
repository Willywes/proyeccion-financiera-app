/** Lista completa de movimientos del mes, con filtro por tipo. */

import { useCallback, useMemo, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dateLabel } from '../../src/domain/dates';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { useMonthStore } from '../../src/state/useMonthStore';
import { getMonthTotals, listByMonth } from '../../src/repositories/transactions';
import { Button, FloatingActionButton, SegmentedControl } from '../../src/ui/Button';
import { EmptyState } from '../../src/ui/Feedback';
import { ListSeparator, TransactionItem } from '../../src/ui/ListItems';
import { MoneyText } from '../../src/ui/MoneyText';
import { MonthSwitcher } from '../../src/ui/MonthSwitcher';
import { ErrorScreen, FixedScreen, LoadingScreen } from '../../src/ui/Screen';
import type { MovementType, TransactionWithCategory } from '../../src/domain/types';

type Filter = 'all' | MovementType;

export default function TransactionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const month = useMonthStore((state) => state.month);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    const [transactions, totals] = await Promise.all([
      listByMonth(month),
      getMonthTotals(month),
    ]);
    return { transactions, totals };
  }, [month]);

  const { data, loading, error } = useAsyncData(load, `movimientos:${month}`);

  const filtered = useMemo(() => {
    const all = data?.transactions ?? [];
    return filter === 'all' ? all : all.filter((item) => item.type === filter);
  }, [data?.transactions, filter]);

  // Se agrupa por día: leer una lista larga de movimientos sin cortes por
  // fecha obliga a ir comparando fechas fila por fila.
  const sections = useMemo(() => {
    const byDate = new Map<string, TransactionWithCategory[]>();
    for (const transaction of filtered) {
      const bucket = byDate.get(transaction.date);
      if (bucket) bucket.push(transaction);
      else byDate.set(transaction.date, [transaction]);
    }
    return Array.from(byDate.entries()).map(([date, items]) => ({
      title: date,
      data: items,
      total: items.reduce(
        (accumulator, item) =>
          accumulator + (item.type === 'income' ? item.amount : -item.amount),
        0,
      ),
    }));
  }, [filtered]);

  if (error) return <ErrorScreen error={error} />;
  if (loading && !data) return <LoadingScreen />;

  const totals = data?.totals;

  return (
    <FixedScreen>
      <View className="bg-brand-600 px-5 pb-4" style={{ paddingTop: insets.top + 12 }}>
        <MonthSwitcher />

        {totals ? (
          <View className="mt-4 flex-row gap-3">
            <View className="flex-1 rounded-card bg-brand-700/60 p-3">
              <Text className="text-xs text-brand-100">Ingresos</Text>
              <MoneyText amount={totals.income} size="base" className="text-white" />
            </View>
            <View className="flex-1 rounded-card bg-brand-700/60 p-3">
              <Text className="text-xs text-brand-100">Egresos</Text>
              <MoneyText amount={totals.expense} size="base" className="text-white" />
            </View>
            <View className="flex-1 rounded-card bg-brand-700/60 p-3">
              <Text className="text-xs text-brand-100">Balance</Text>
              <MoneyText
                amount={totals.net}
                size="base"
                className={totals.net < 0 ? 'text-expense-200' : 'text-white'}
              />
            </View>
          </View>
        ) : null}
      </View>

      <View className="px-5 py-3">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todo' },
            { value: 'income', label: 'Ingresos', activeClassName: 'bg-income-700' },
            { value: 'expense', label: 'Egresos', activeClassName: 'bg-expense-600' },
          ]}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 96 }}
        ItemSeparatorComponent={ListSeparator}
        renderSectionHeader={({ section }) => (
          <View className="flex-row items-center justify-between bg-surface-muted px-5 pb-1 pt-4">
            <Text className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              {dateLabel(section.title)}
            </Text>
            <MoneyText
              amount={section.total}
              size="xs"
              className={section.total < 0 ? 'text-expense-700' : 'text-income-700'}
            />
          </View>
        )}
        renderItem={({ item }) => (
          <View className="bg-surface">
            <TransactionItem
              transaction={item}
              showDate={false}
              onPress={() => router.push(`/movimiento/${item.id}`)}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🧾"
            title={
              filter === 'all'
                ? 'Sin movimientos este mes'
                : filter === 'income'
                  ? 'Sin ingresos este mes'
                  : 'Sin egresos este mes'
            }
            description="Todo lo que registres aparecerá agrupado por día."
            action={
              <Button
                label="Registrar movimiento"
                onPress={() => router.push('/movimiento/nuevo')}
              />
            }
          />
        }
      />

      <FloatingActionButton onPress={() => router.push('/movimiento/nuevo')} />
    </FixedScreen>
  );
}
