/** Contenedores de pantalla: fondo, safe area y scroll consistentes. */

import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenProps {
  children: ReactNode;
  /** Espacio extra al final, para que el tab bar no tape el contenido. */
  bottomPadding?: number;
}

/** Pantalla con scroll vertical. */
export function Screen({ children, bottomPadding = 24 }: ScreenProps) {
  return (
    <ScrollView
      className="flex-1 bg-surface-muted"
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Pantalla sin scroll, para listas que ya scrollean por su cuenta. */
export function FixedScreen({ children }: { children: ReactNode }) {
  return <View className="flex-1 bg-surface-muted">{children}</View>;
}

/** Encabezado de pantalla con título y bajada opcional. */
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-brand-600 px-5 pb-5"
      style={{ paddingTop: insets.top + 12 }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-white">{title}</Text>
          {subtitle ? (
            <Text className="mt-1 text-sm text-brand-100">{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

/** Estado de carga a pantalla completa. */
export function LoadingScreen({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface-muted">
      <ActivityIndicator size="large" color="#4f46e5" />
      <Text className="text-sm text-ink-soft">{label}</Text>
    </View>
  );
}

/** Error a pantalla completa, con el detalle a la vista para poder reportarlo. */
export function ErrorScreen({ error }: { error: Error }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-surface-muted p-6">
      <Text className="text-4xl">⚠️</Text>
      <Text className="text-center text-base font-semibold text-ink">
        Algo salió mal
      </Text>
      <Text className="text-center text-sm text-ink-soft">{error.message}</Text>
    </View>
  );
}

/**
 * Encabezado de pantalla apilada o modal, con botón de volver.
 * `onClose` recibe la acción de cierre; la pantalla decide si es `back` o algo más.
 */
export function ModalHeader({
  title,
  subtitle,
  onClose,
  closeLabel = '✕',
  right,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeLabel?: string;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-b border-line bg-surface px-4 pb-3"
      style={{ paddingTop: insets.top + 10 }}
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-sunken"
        >
          <Text className="text-lg text-ink-soft">{closeLabel}</Text>
        </Pressable>

        <View className="flex-1">
          <Text className="text-lg font-bold text-ink" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-xs text-ink-muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right}
      </View>
    </View>
  );
}

/** Título de sección dentro de una pantalla. */
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View className="mb-2 mt-6 flex-row items-center justify-between px-5">
      <Text className="text-xs font-bold uppercase tracking-wider text-ink-muted">
        {children}
      </Text>
      {action}
    </View>
  );
}
