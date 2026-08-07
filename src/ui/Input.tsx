/** Campos de formulario. */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { dateLabel, monthLabel } from '../domain/dates';
import { useCurrency } from '../hooks/useCurrency';
import type { DateKey, MonthKey } from '../domain/types';

/** Etiqueta + mensaje de error alrededor de cualquier control. */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-ink-soft">{label}</Text>
      {children}
      {error ? (
        <Text className="text-xs text-expense-600">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-ink-muted">{hint}</Text>
      ) : null}
    </View>
  );
}

const INPUT_CLASS =
  'rounded-xl border border-line-strong bg-surface px-4 py-3 text-base text-ink';

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  autoFocus = false,
  multiline = false,
  keyboardType = 'default',
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  autoFocus?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'number-pad' | 'decimal-pad';
  maxLength?: number;
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoFocus={autoFocus}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        className={`${INPUT_CLASS} ${multiline ? 'h-24' : ''} ${
          error ? 'border-expense-500' : ''
        }`}
        style={multiline ? { textAlignVertical: 'top' } : undefined}
      />
    </Field>
  );
}

/**
 * Campo de monto. Muestra el símbolo de la moneda y va reformateando con
 * separadores de miles a medida que se escribe, para que el usuario lea la
 * cifra sin contar ceros.
 */
export function MoneyField({
  label,
  value,
  onChange,
  error,
  hint,
  autoFocus = false,
  accent = 'brand',
}: {
  label: string;
  /** Monto en unidad mínima, o `null` si está vacío. */
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string | null;
  hint?: string;
  autoFocus?: boolean;
  accent?: 'brand' | 'income' | 'expense';
}) {
  const { currency, parse, formatForInput } = useCurrency();
  const [text, setText] = useState(() => formatForInput(value));

  // El texto visible vive en estado local para poder reformatearlo mientras se
  // escribe, así que hay que resincronizarlo cuando `value` cambia desde fuera
  // (al cargar un registro para editar). Si el cambio vino del propio tipeo,
  // el texto ya representa ese monto y no se toca: reescribirlo movería el cursor.
  const textRef = useRef(text);
  textRef.current = text;
  useEffect(() => {
    if (parse(textRef.current) !== value) setText(formatForInput(value));
    // Sólo `value`: incluir `text` volvería a correr esto en cada pulsación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const accentClass =
    accent === 'income'
      ? 'text-income-700'
      : accent === 'expense'
        ? 'text-expense-700'
        : 'text-ink';

  const handleChange = (next: string) => {
    const parsed = parse(next);
    // Mientras el texto no sea un número válido se deja tal cual, para no
    // pelear con el usuario a mitad de tipeo.
    setText(parsed === null ? next : formatForInput(parsed));
    onChange(parsed);
  };

  return (
    <Field label={label} error={error} hint={hint}>
      <View
        className={`flex-row items-center rounded-xl border bg-surface px-4 ${
          error ? 'border-expense-500' : 'border-line-strong'
        }`}
      >
        <Text className={`mr-2 text-lg font-semibold ${accentClass}`}>
          {currency.symbol}
        </Text>
        <TextInput
          value={text}
          onChangeText={handleChange}
          placeholder="0"
          placeholderTextColor="#94a3b8"
          keyboardType={currency.decimals > 0 ? 'decimal-pad' : 'number-pad'}
          autoFocus={autoFocus}
          className={`flex-1 py-3 text-xl font-bold ${accentClass}`}
        />
      </View>
    </Field>
  );
}

/** Convierte `YYYY-MM-DD` a `Date` en hora local, sin desfase de zona. */
function parseDateKey(date: DateKey): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date): DateKey {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: DateKey;
  onChange: (value: DateKey) => void;
  error?: string | null;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} error={error} hint={hint}>
      <Pressable
        onPress={() => setVisible(true)}
        className={`flex-row items-center justify-between rounded-xl border bg-surface px-4 py-3 ${
          error ? 'border-expense-500' : 'border-line-strong'
        }`}
      >
        <Text className="text-base text-ink">{dateLabel(value)}</Text>
        <Text className="text-base">📅</Text>
      </Pressable>

      {visible ? (
        <DateTimePicker
          value={parseDateKey(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, selected) => {
            // En Android el diálogo es modal: se cierra con cualquier resultado.
            setVisible(Platform.OS === 'ios' && event.type !== 'dismissed');
            if (event.type === 'set' && selected) onChange(toDateKey(selected));
          }}
        />
      ) : null}
    </Field>
  );
}

/** Selector de mes con flechas, para campos `YYYY-MM`. */
export function MonthField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: MonthKey;
  onChange: (value: MonthKey) => void;
  error?: string | null;
  hint?: string;
}) {
  const shift = (offset: number) => {
    const [year, month] = value.split('-').map(Number);
    const absolute = year * 12 + (month - 1) + offset;
    const nextYear = Math.floor(absolute / 12);
    const nextMonth = String((absolute % 12) + 1).padStart(2, '0');
    onChange(`${nextYear}-${nextMonth}`);
  };

  return (
    <Field label={label} error={error} hint={hint}>
      <View className="flex-row items-center justify-between rounded-xl border border-line-strong bg-surface px-2 py-1">
        <Pressable
          onPress={() => shift(-1)}
          accessibilityLabel="Mes anterior"
          className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-sunken"
        >
          <Text className="text-lg text-brand-600">‹</Text>
        </Pressable>
        <Text className="text-base font-semibold text-ink">{monthLabel(value)}</Text>
        <Pressable
          onPress={() => shift(1)}
          accessibilityLabel="Mes siguiente"
          className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-sunken"
        >
          <Text className="text-lg text-brand-600">›</Text>
        </Pressable>
      </View>
    </Field>
  );
}

/** Interruptor simple para preferencias. */
export function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      className="flex-row items-center justify-between gap-4 py-3"
    >
      <View className="flex-1">
        <Text className="text-base text-ink">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-xs text-ink-muted">{description}</Text>
        ) : null}
      </View>
      <View
        className={`h-7 w-12 justify-center rounded-pill px-0.5 ${
          value ? 'bg-brand-600' : 'bg-line-strong'
        }`}
      >
        <View
          className={`h-6 w-6 rounded-full bg-white shadow ${value ? 'self-end' : 'self-start'}`}
        />
      </View>
    </Pressable>
  );
}
