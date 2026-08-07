/** Alta y edición de un movimiento. La ruta `nuevo` abre el formulario vacío. */

import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { todayKey } from '../../src/domain/dates';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { listCategories } from '../../src/repositories/categories';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from '../../src/repositories/transactions';
import { Button, SegmentedControl } from '../../src/ui/Button';
import { CategoryPicker } from '../../src/ui/CategoryPicker';
import { Notice } from '../../src/ui/Feedback';
import { DateField, MoneyField, TextField } from '../../src/ui/Input';
import {
  ErrorScreen,
  LoadingScreen,
  ModalHeader,
  Screen,
} from '../../src/ui/Screen';
import type { DateKey, MovementType } from '../../src/domain/types';

export default function TransactionFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; tipo?: string }>();

  const isNew = params.id === 'nuevo';
  const transactionId = isNew ? null : Number(params.id);

  const [type, setType] = useState<MovementType>(
    params.tipo === 'income' ? 'income' : 'expense',
  );
  const [amount, setAmount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState<DateKey>(todayKey());
  const [note, setNote] = useState('');

  const [amountError, setAmountError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkedToDebt, setLinkedToDebt] = useState(false);

  const load = useCallback(async () => {
    const [incomeCategories, expenseCategories, existing] = await Promise.all([
      listCategories('income'),
      listCategories('expense'),
      transactionId !== null ? getTransaction(transactionId) : Promise.resolve(null),
    ]);
    return { incomeCategories, expenseCategories, existing };
  }, [transactionId]);

  const { data, loading, error } = useAsyncData(
    load,
    `movimiento-form:${params.id}`,
  );

  // Los datos del movimiento existente se cargan una vez en el estado del
  // formulario; a partir de ahí manda lo que el usuario edita.
  const existing = data?.existing ?? null;
  useEffect(() => {
    if (!existing) return;
    setType(existing.type);
    setAmount(existing.amount);
    setCategoryId(existing.categoryId);
    setDate(existing.date);
    setNote(existing.note ?? '');
    setLinkedToDebt(existing.debtInstallmentId !== null);
  }, [existing]);

  if (error) return <ErrorScreen error={error} />;
  if (loading && !data) return <LoadingScreen />;

  const categories =
    type === 'income' ? (data?.incomeCategories ?? []) : (data?.expenseCategories ?? []);

  const validate = (): boolean => {
    let valid = true;
    if (amount === null || amount <= 0) {
      setAmountError('Ingresa un monto mayor a cero');
      valid = false;
    } else {
      setAmountError(null);
    }
    if (categoryId === null) {
      setCategoryError('Elige una categoría');
      valid = false;
    } else {
      setCategoryError(null);
    }
    return valid;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      if (transactionId === null) {
        await createTransaction({
          type,
          amount: amount!,
          categoryId,
          date,
          note,
        });
      } else {
        await updateTransaction(transactionId, {
          type,
          amount: amount!,
          categoryId,
          date,
          note,
        });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (transactionId === null) return;

    Alert.alert(
      '¿Eliminar este movimiento?',
      linkedToDebt
        ? 'Además se marcará la cuota como pendiente otra vez.'
        : 'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(transactionId);
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
        title={isNew ? 'Nuevo movimiento' : 'Editar movimiento'}
        onClose={() => router.back()}
      />

      <Screen>
        <View className="gap-5 p-5">
          <SegmentedControl<MovementType>
            value={type}
            onChange={(next) => {
              setType(next);
              // La categoría pertenece a un tipo: al cambiar de tipo deja de
              // ser válida y se limpia en vez de guardar algo inconsistente.
              setCategoryId(null);
            }}
            options={[
              { value: 'expense', label: 'Gasto', activeClassName: 'bg-expense-600' },
              { value: 'income', label: 'Ingreso', activeClassName: 'bg-income-700' },
            ]}
          />

          {linkedToDebt ? (
            <Notice tone="warning" title="Este movimiento paga una cuota">
              Si cambias el monto, la cuota de la deuda mantiene su valor original.
              Para reprogramar la deuda usa su pantalla de detalle.
            </Notice>
          ) : null}

          <MoneyField
            label="Monto"
            value={amount}
            onChange={(next) => {
              setAmount(next);
              if (next !== null && next > 0) setAmountError(null);
            }}
            error={amountError}
            autoFocus={isNew}
            accent={type === 'income' ? 'income' : 'expense'}
          />

          <CategoryPicker
            categories={categories}
            value={categoryId}
            onChange={(next) => {
              setCategoryId(next);
              setCategoryError(null);
            }}
            error={categoryError}
          />

          <DateField label="Fecha" value={date} onChange={setDate} />

          <TextField
            label="Nota (opcional)"
            value={note}
            onChangeText={setNote}
            placeholder="Ej: supermercado del fin de semana"
            maxLength={140}
          />

          <Button
            label={isNew ? 'Guardar movimiento' : 'Guardar cambios'}
            onPress={handleSave}
            loading={saving}
            variant={type === 'income' ? 'income' : 'expense'}
          />

          {!isNew ? (
            <Button label="Eliminar movimiento" variant="ghost" onPress={handleDelete} />
          ) : null}

          <Text className="pb-4 text-center text-xs text-ink-muted">
            Los movimientos se guardan sólo en este teléfono.
          </Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
