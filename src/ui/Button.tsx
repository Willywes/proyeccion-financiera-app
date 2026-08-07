/** Botones y controles de acción. */

import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'income' | 'expense';
type ButtonSize = 'md' | 'sm';

const CONTAINER_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 active:bg-brand-700',
  secondary: 'bg-surface border border-line-strong active:bg-surface-sunken',
  ghost: 'bg-transparent active:bg-surface-sunken',
  danger: 'bg-expense-600 active:bg-expense-700',
  // Paso 700 en ingreso: con texto blanco encima, el 600 queda justo de contraste.
  income: 'bg-income-700 active:bg-income-600',
  expense: 'bg-expense-600 active:bg-expense-700',
};

const LABEL_STYLES: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-ink',
  ghost: 'text-brand-600',
  danger: 'text-white',
  income: 'text-white',
  expense: 'text-white',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  md: 'h-12 px-5',
  sm: 'h-9 px-3',
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Emoji o texto corto a la izquierda del label. */
  icon?: string;
  className?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className = '',
}: ButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={`flex-row items-center justify-center gap-2 rounded-pill ${
        SIZE_STYLES[size]
      } ${CONTAINER_STYLES[variant]} ${inactive ? 'opacity-40' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'ghost' ? '#4f46e5' : '#ffffff'}
        />
      ) : (
        <>
          {icon ? <Text className={LABEL_STYLES[variant]}>{icon}</Text> : null}
          <Text
            className={`${size === 'sm' ? 'text-sm' : 'text-base'} font-semibold ${
              LABEL_STYLES[variant]
            }`}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Chip seleccionable, usado en filtros y selección de categoría. */
export function Chip({
  label,
  selected = false,
  onPress,
  color,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /** Color de acento cuando está seleccionado; por defecto el de marca. */
  color?: string;
  icon?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-1.5 rounded-pill border px-3 py-2 ${
        selected ? 'border-transparent' : 'border-line-strong bg-surface'
      }`}
      style={selected && color ? { backgroundColor: color } : undefined}
    >
      {icon ? <Text className="text-sm">{icon}</Text> : null}
      <Text
        className={`text-sm font-medium ${selected ? 'text-white' : 'text-ink-soft'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Selector segmentado de dos o más opciones. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; activeClassName?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row rounded-pill bg-surface-sunken p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`flex-1 items-center justify-center rounded-pill py-2 ${
              active ? (option.activeClassName ?? 'bg-brand-600') : ''
            }`}
          >
            <Text
              className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink-soft'}`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Botón flotante para la acción principal de la pantalla. */
export function FloatingActionButton({
  onPress,
  icon = '+',
  label,
}: {
  onPress: () => void;
  icon?: string;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Agregar'}
      className="absolute bottom-6 right-5 h-14 flex-row items-center justify-center gap-2 rounded-pill bg-brand-600 px-5 shadow-lg shadow-brand-900/30 active:bg-brand-700"
    >
      <Text className="text-xl font-bold text-white">{icon}</Text>
      {label ? <Text className="font-semibold text-white">{label}</Text> : null}
    </Pressable>
  );
}
