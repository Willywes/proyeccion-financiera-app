/** Tarjeta base y variantes de contenido. */

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface CardProps {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
}

export function Card({ children, className = '', onPress }: CardProps) {
  const base =
    'rounded-card border border-line bg-surface p-4 shadow-sm shadow-black/5';

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${base} active:opacity-70 ${className}`}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={`${base} ${className}`}>{children}</View>;
}

/** Fila etiqueta/valor, el patrón más repetido en detalles y resúmenes. */
export function DataRow({
  label,
  value,
  valueClassName = 'text-ink',
  hint,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  hint?: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-2">
      <View className="flex-1">
        <Text className="text-sm text-ink-soft">{label}</Text>
        {hint ? <Text className="text-xs text-ink-muted">{hint}</Text> : null}
      </View>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text className={`text-sm font-semibold ${valueClassName}`}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

/** Separador horizontal fino. */
export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px bg-line ${className}`} />;
}
