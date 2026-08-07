/**
 * Teclado numérico para el PIN.
 *
 * Se usa un teclado propio en lugar de un `TextInput` con teclado del sistema
 * porque así los dígitos no pasan por el diccionario ni por el portapapeles del
 * teclado, y porque los botones grandes se aciertan sin mirar.
 */

import { useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, Text, View } from 'react-native';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function PinPad({
  length,
  value,
  onChange,
  onComplete,
  error,
  busy = false,
}: {
  length: number;
  value: string;
  onChange: (value: string) => void;
  /** Se llama cuando se completan los `length` dígitos. */
  onComplete: (value: string) => void;
  error?: string | null;
  busy?: boolean;
}) {
  // El aviso de completado va en un efecto para no llamar al padre durante el
  // render del hijo que dispara el último dígito.
  useEffect(() => {
    if (value.length === length) onComplete(value);
  }, [value, length, onComplete]);

  const press = (key: string) => {
    if (busy) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();

    if (key === 'del') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= length) return;
    onChange(value + key);
  };

  return (
    <View className="gap-6">
      {/* Puntos de progreso. */}
      <View className="flex-row justify-center gap-4">
        {Array.from({ length }, (_, index) => {
          const filled = index < value.length;
          return (
            <View
              key={index}
              className={`h-4 w-4 rounded-full ${
                error
                  ? 'bg-expense-500'
                  : filled
                    ? 'bg-brand-600'
                    : 'border border-line-strong bg-surface'
              }`}
            />
          );
        })}
      </View>

      {error ? (
        <Text className="text-center text-sm font-medium text-expense-600">{error}</Text>
      ) : null}

      <View className="flex-row flex-wrap justify-center">
        {KEYS.map((key, index) => {
          if (key === '') return <View key={index} className="h-16 w-1/3" />;

          return (
            <View key={index} className="h-16 w-1/3 items-center justify-center p-1.5">
              <Pressable
                onPress={() => press(key)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={key === 'del' ? 'Borrar' : key}
                className={`h-full w-full items-center justify-center rounded-2xl ${
                  key === 'del'
                    ? 'active:bg-surface-sunken'
                    : 'bg-surface active:bg-brand-100'
                } ${busy ? 'opacity-40' : ''}`}
              >
                <Text
                  className={
                    key === 'del'
                      ? 'text-2xl text-ink-soft'
                      : 'text-2xl font-semibold text-ink'
                  }
                >
                  {key === 'del' ? '⌫' : key}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
