/** Alta y edición de un ingreso o gasto fijo. La ruta `nuevo` abre vacío. */

import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { currentMonth, todayDayOfMonth } from '../../src/domain/dates';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { listCategories } from '../../src/repositories/categories';
import {
  createRecurringRule,
  deleteRecurringRule,
  getRecurringRule,
  updateRecurringRule,
} from '../../src/repositories/recurring';
import { Button, SegmentedControl } from '../../src/ui/Button';
import { CategoryPicker } from '../../src/ui/CategoryPicker';
import { Notice } from '../../src/ui/Feedback';
import { MoneyField, MonthField, TextField, ToggleRow } from '../../src/ui/Input';
import {
  ErrorScreen,
  LoadingScreen,
  ModalHeader,
  Screen,
} from '../../src/ui/Screen';
import type { MonthKey, MovementType } from '../../src/domain/types';

export default function RecurringRuleFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  const isNew = params.id === 'nuevo';
  const ruleId = isNew ? null : Number(params.id);

  const [name, setName] = useState('');
  const [type, setType] = useState<MovementType>('expense');
  const [amount, setAmount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [dayText, setDayText] = useState(String(Math.min(todayDayOfMonth(), 28)));
  const [startMonth, setStartMonth] = useState<MonthKey>(currentMonth());
  const [hasEnd, setHasEnd] = useState(false);
  const [endMonth, setEndMonth] = useState<MonthKey>(currentMonth());
  const [active, setActive] = useState(true);

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [incomeCategories, expenseCategories, existing] = await Promise.all([
      listCategories('income'),
      listCategories('expense'),
      ruleId !== null ? getRecurringRule(ruleId) : Promise.resolve(null),
    ]);
    return { incomeCategories, expenseCategories, existing };
  }, [ruleId]);

  const { data, loading, error } = useAsyncData(load, `fijo-form:${params.id}`);

  const existing = data?.existing ?? null;
  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setType(existing.type);
    setAmount(existing.amount);
    setCategoryId(existing.categoryId);
    setDayText(String(existing.dayOfMonth));
    setStartMonth(existing.startMonth);
    setActive(existing.active);
    if (existing.endMonth) {
      setHasEnd(true);
      setEndMonth(existing.endMonth);
    }
  }, [existing]);

  if (error) return <ErrorScreen error={error} />;
  if (loading && !data) return <LoadingScreen />;

  const categories =
    type === 'income' ? (data?.incomeCategories ?? []) : (data?.expenseCategories ?? []);
  const dayOfMonth = Number(dayText) || 1;

  const validate = (): boolean => {
    const next: Record<string, string | null> = {};
    if (name.trim().length < 2) next.name = 'Ponle un nombre, ej: Sueldo';
    if (!amount || amount <= 0) next.amount = 'Ingresa un monto mayor a cero';
    if (categoryId === null) next.category = 'Elige una categoría';
    if (dayOfMonth < 1 || dayOfMonth > 31) next.day = 'Día entre 1 y 31';
    if (hasEnd && endMonth < startMonth) {
      next.end = 'El mes de término no puede ser anterior al de inicio';
    }
    setErrors(next);
    return Object.values(next).every((value) => !value);
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        name,
        type,
        amount: amount!,
        categoryId,
        dayOfMonth,
        startMonth,
        endMonth: hasEnd ? endMonth : null,
        active,
      };

      if (ruleId === null) await createRecurringRule(payload);
      else await updateRecurringRule(ruleId, payload);

      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (ruleId === null) return;

    Alert.alert(
      '¿Eliminar este fijo?',
      'Deja de contar en tus proyecciones. Los movimientos que ya se registraron a partir de él se mantienen en tu historial.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteRecurringRule(ruleId);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      <ModalHeader
        title={isNew ? 'Nuevo fijo' : 'Editar fijo'}
        onClose={() => router.back()}
      />

      <Screen>
        <View className="gap-5 p-5">
          <SegmentedControl<MovementType>
            value={type}
            onChange={(next) => {
              setType(next);
              setCategoryId(null);
            }}
            options={[
              { value: 'expense', label: 'Gasto fijo', activeClassName: 'bg-expense-600' },
              { value: 'income', label: 'Ingreso fijo', activeClassName: 'bg-income-700' },
            ]}
          />

          <TextField
            label="Nombre"
            value={name}
            onChangeText={setName}
            placeholder={type === 'income' ? 'Ej: Sueldo' : 'Ej: Arriendo'}
            error={errors.name}
            maxLength={60}
            autoFocus={isNew}
          />

          <MoneyField
            label="Monto mensual"
            value={amount}
            onChange={setAmount}
            error={errors.amount}
            accent={type === 'income' ? 'income' : 'expense'}
          />

          <CategoryPicker
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            error={errors.category}
          />

          <TextField
            label="Día del mes"
            value={dayText}
            onChangeText={setDayText}
            keyboardType="number-pad"
            maxLength={2}
            error={errors.day}
            hint="En febrero y meses de 30 días se ajusta al último día"
          />

          <MonthField
            label="Desde qué mes"
            value={startMonth}
            onChange={setStartMonth}
          />

          <View className="rounded-card border border-line bg-surface px-4">
            <ToggleRow
              label="Tiene fecha de término"
              description="Para cosas que se acaban, como un plan a plazo fijo"
              value={hasEnd}
              onChange={setHasEnd}
            />
          </View>

          {hasEnd ? (
            <MonthField
              label="Hasta qué mes"
              value={endMonth}
              onChange={setEndMonth}
              error={errors.end}
            />
          ) : null}

          {!isNew ? (
            <View className="rounded-card border border-line bg-surface px-4">
              <ToggleRow
                label="Activo"
                description="Si lo pausas deja de contar en las proyecciones"
                value={active}
                onChange={setActive}
              />
            </View>
          ) : null}

          <Notice tone="info" title="Cómo se usa esto">
            Los fijos no registran movimientos solos. Aparecen como pendientes en el
            resumen del mes y se confirman con un toque cuando de verdad ocurren.
          </Notice>

          <Button
            label={isNew ? 'Guardar fijo' : 'Guardar cambios'}
            onPress={handleSave}
            loading={saving}
          />

          {!isNew ? (
            <Button label="Eliminar fijo" variant="ghost" onPress={handleDelete} />
          ) : null}

          <View className="h-4" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
