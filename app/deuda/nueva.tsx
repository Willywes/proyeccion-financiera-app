/**
 * Alta de una deuda.
 *
 * Se ofrecen dos formas de describirla, porque la gente conoce sus deudas de
 * dos maneras distintas:
 *
 *   - "Pedí $2.000.000 al 18% anual en 24 cuotas"  → modo tasa
 *   - "Compré en 12 cuotas de $45.000"             → modo cuota
 *
 * En el segundo caso el interés sale de la diferencia entre lo que se paga en
 * total y el precio, y se muestra la tasa implícita para que quede a la vista
 * cuánto cuesta realmente el crédito.
 */

import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  buildSchedule,
  DEFAULT_DUE_DAY,
  impliedAnnualRate,
  scheduleTotals,
} from '../../src/domain/amortization';
import { currentMonth, dateLabel, monthLabel } from '../../src/domain/dates';
import { createDebt } from '../../src/repositories/debts';
import { Button, Chip, SegmentedControl } from '../../src/ui/Button';
import { Card, DataRow, Divider } from '../../src/ui/Card';
import { Notice } from '../../src/ui/Feedback';
import { Field, MoneyField, MonthField, TextField } from '../../src/ui/Input';
import { MoneyText } from '../../src/ui/MoneyText';
import { ModalHeader, Screen, SectionTitle } from '../../src/ui/Screen';
import type { DebtKind, MonthKey } from '../../src/domain/types';

type Mode = 'rate' | 'installment';

const KINDS: { value: DebtKind; label: string; icon: string }[] = [
  { value: 'loan', label: 'Crédito', icon: '🏦' },
  { value: 'credit_card', label: 'Tarjeta', icon: '💳' },
  { value: 'installment', label: 'Compra en cuotas', icon: '🧾' },
  { value: 'other', label: 'Otra', icon: '📄' },
];

export default function NewDebtScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<DebtKind>('loan');
  const [mode, setMode] = useState<Mode>('rate');
  const [principal, setPrincipal] = useState<number | null>(null);
  const [rateText, setRateText] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState<number | null>(null);
  const [installmentsText, setInstallmentsText] = useState('12');
  const [startMonth, setStartMonth] = useState<MonthKey>(currentMonth());
  const [dueDayText, setDueDayText] = useState(String(DEFAULT_DUE_DAY));
  const [note, setNote] = useState('');

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const installmentsTotal = Number(installmentsText) || 0;
  const annualRate = Number(rateText.replace(',', '.')) || 0;
  const dueDay = Number(dueDayText) || DEFAULT_DUE_DAY;

  // Vista previa en vivo: se recalcula la tabla al cambiar cualquier dato, así
  // el usuario ve la cuota antes de guardar.
  const preview = useMemo(() => {
    if (!principal || principal <= 0 || installmentsTotal <= 0) return null;

    const schedule = buildSchedule({
      principal,
      annualRate: mode === 'rate' ? annualRate : 0,
      installmentsTotal,
      startMonth,
      dayOfMonth: dueDay,
      fixedInstallment: mode === 'installment' ? installmentAmount : null,
    });
    if (schedule.length === 0) return null;

    const totals = scheduleTotals(schedule);
    const impliedRate =
      mode === 'installment' && installmentAmount
        ? impliedAnnualRate(principal, installmentAmount, installmentsTotal)
        : annualRate;

    return { schedule, totals, impliedRate };
  }, [
    principal,
    annualRate,
    installmentAmount,
    installmentsTotal,
    startMonth,
    dueDay,
    mode,
  ]);

  const validate = (): boolean => {
    const next: Record<string, string | null> = {};

    if (name.trim().length < 2) next.name = 'Ponle un nombre para reconocerla';
    if (!principal || principal <= 0) next.principal = 'Ingresa el monto de la deuda';
    if (installmentsTotal < 1 || installmentsTotal > 600) {
      next.installments = 'Entre 1 y 600 cuotas';
    }
    if (mode === 'installment' && (!installmentAmount || installmentAmount <= 0)) {
      next.installmentAmount = 'Ingresa el valor de la cuota';
    }
    if (mode === 'rate' && (annualRate < 0 || annualRate > 500)) {
      next.rate = 'Ingresa una tasa entre 0 y 500';
    }
    if (dueDay < 1 || dueDay > 31) next.dueDay = 'Día entre 1 y 31';

    setErrors(next);
    return Object.values(next).every((value) => !value);
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const debtId = await createDebt({
        name,
        kind,
        principal: principal!,
        annualRate: mode === 'rate' ? annualRate : (preview?.impliedRate ?? 0),
        installmentsTotal,
        startMonth,
        dueDay,
        note,
        fixedInstallment: mode === 'installment' ? installmentAmount : null,
      });
      // Se reemplaza la ruta para que al volver no reaparezca el formulario.
      router.replace(`/deuda/${debtId}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      <ModalHeader title="Nueva deuda" onClose={() => router.back()} />

      <Screen>
        <View className="gap-5 p-5">
          <TextField
            label="Nombre"
            value={name}
            onChangeText={setName}
            placeholder="Ej: Crédito de consumo Banco"
            error={errors.name}
            maxLength={60}
          />

          <Field label="Tipo">
            <View className="flex-row flex-wrap gap-2">
              {KINDS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  icon={option.icon}
                  selected={kind === option.value}
                  onPress={() => setKind(option.value)}
                />
              ))}
            </View>
          </Field>

          <MoneyField
            label="Monto de la deuda"
            value={principal}
            onChange={setPrincipal}
            error={errors.principal}
            hint="Lo que te prestaron o el precio de la compra"
          />

          <Field label="¿Qué dato conoces?">
            <SegmentedControl<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'rate', label: 'La tasa' },
                { value: 'installment', label: 'La cuota' },
              ]}
            />
          </Field>

          {mode === 'rate' ? (
            <TextField
              label="Tasa de interés anual (%)"
              value={rateText}
              onChangeText={setRateText}
              placeholder="0"
              keyboardType="decimal-pad"
              error={errors.rate}
              hint="Déjala en 0 si la compra es sin interés"
            />
          ) : (
            <MoneyField
              label="Valor de cada cuota"
              value={installmentAmount}
              onChange={setInstallmentAmount}
              error={errors.installmentAmount}
              hint="La app calcula el interés que estás pagando"
            />
          )}

          <TextField
            label="Número de cuotas"
            value={installmentsText}
            onChangeText={setInstallmentsText}
            keyboardType="number-pad"
            error={errors.installments}
            maxLength={3}
          />

          <MonthField
            label="Mes de la primera cuota"
            value={startMonth}
            onChange={setStartMonth}
          />

          <TextField
            label="Día de vencimiento"
            value={dueDayText}
            onChangeText={setDueDayText}
            keyboardType="number-pad"
            maxLength={2}
            error={errors.dueDay}
            hint="En meses más cortos se ajusta al último día"
          />

          <TextField
            label="Nota (opcional)"
            value={note}
            onChangeText={setNote}
            placeholder="Ej: crédito para el auto"
            maxLength={140}
          />
        </View>

        {/* Vista previa del plan de pagos. */}
        {preview ? (
          <>
            <SectionTitle>Así queda tu deuda</SectionTitle>
            <View className="mx-5 gap-3">
              <Card>
                <DataRow
                  label="Cuota mensual"
                  value={
                    <MoneyText
                      amount={preview.totals.representativeInstallment}
                      size="base"
                      className="text-debt-700"
                    />
                  }
                  hint={`${preview.schedule.length} cuotas desde ${monthLabel(startMonth, { short: true })}`}
                />
                <Divider />
                <DataRow
                  label="Total a pagar"
                  value={<MoneyText amount={preview.totals.totalToPay} size="sm" />}
                />
                <Divider />
                <DataRow
                  label="Intereses"
                  value={
                    <MoneyText
                      amount={preview.totals.totalInterest}
                      size="sm"
                      className={
                        preview.totals.totalInterest > 0
                          ? 'text-expense-700'
                          : 'text-income-700'
                      }
                    />
                  }
                  hint={
                    preview.totals.totalInterest > 0
                      ? `Es lo que te cuesta el crédito de más`
                      : 'Sin interés'
                  }
                />
                <Divider />
                <DataRow
                  label="Última cuota"
                  value={dateLabel(
                    preview.schedule[preview.schedule.length - 1].dueDate,
                  )}
                />
              </Card>

              {mode === 'installment' && preview.impliedRate > 0 ? (
                <Notice
                  tone="warning"
                  title={`Estás pagando cerca de ${preview.impliedRate}% anual`}
                >
                  Es la tasa que se deduce de pagar {installmentsTotal} cuotas por ese
                  monto. Sirve para comparar con otras alternativas de crédito.
                </Notice>
              ) : null}

              {preview.totals.totalInterest > (principal ?? 0) * 0.5 ? (
                <Notice tone="danger" title="Los intereses son muy altos">
                  Vas a pagar en intereses más de la mitad de lo que te prestaron.
                  Vale la pena revisar si hay una opción más barata.
                </Notice>
              ) : null}
            </View>
          </>
        ) : null}

        <View className="p-5">
          <Button
            label="Guardar deuda"
            onPress={handleSave}
            loading={saving}
            disabled={!preview}
          />
          <Text className="mt-3 text-center text-xs leading-4 text-ink-muted">
            Se generan todas las cuotas y se suman a tu proyección. Después puedes
            editar cuotas puntuales o reprogramar la deuda.
          </Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
