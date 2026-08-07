/**
 * Desglose por categoría.
 *
 * Barras horizontales, no un gráfico de torta: comparar longitudes es mucho más
 * preciso que comparar ángulos, y en un teléfono angosto las barras dejan lugar
 * al nombre y al monto en la misma fila.
 *
 * Cada barra lleva su nombre, su icono y su monto en texto, así que la identidad
 * nunca depende del color de la categoría — que además el usuario puede cambiar.
 */

import { View, Text } from 'react-native';
import { ProgressBar } from './Feedback';
import { MoneyText } from './MoneyText';
import type { CategoryTotal } from '../domain/types';

export function CategoryBreakdown({
  items,
  /** Cuántas categorías mostrar antes de agrupar el resto en "Otras". */
  limit = 6,
}: {
  items: CategoryTotal[];
  limit?: number;
}) {
  if (items.length === 0) return null;

  const visible = items.slice(0, limit);
  const rest = items.slice(limit);
  // La cola se agrupa en una fila en vez de recortarse en silencio.
  const restTotal = rest.reduce((accumulator, item) => accumulator + item.total, 0);
  const restShare = rest.reduce((accumulator, item) => accumulator + item.share, 0);

  // Las barras se escalan contra la categoría mayor, no contra el total: así se
  // aprovecha todo el ancho y las diferencias entre categorías se ven mejor.
  const maxTotal = Math.max(...visible.map((item) => item.total), restTotal, 1);

  return (
    <View className="gap-3">
      {visible.map((item) => (
        <View key={item.categoryId ?? item.categoryName} className="gap-1.5">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm">{item.categoryIcon}</Text>
            <Text className="flex-1 text-sm font-medium text-ink" numberOfLines={1}>
              {item.categoryName}
            </Text>
            <Text className="text-xs text-ink-muted">{item.share}%</Text>
            <MoneyText amount={item.total} size="sm" className="text-ink" />
          </View>
          <ProgressBar
            value={(item.total / maxTotal) * 100}
            color={item.categoryColor}
            height={6}
          />
        </View>
      ))}

      {rest.length > 0 ? (
        <View className="gap-1.5">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm">📦</Text>
            <Text className="flex-1 text-sm font-medium text-ink-soft">
              Otras {rest.length} categorías
            </Text>
            <Text className="text-xs text-ink-muted">{restShare}%</Text>
            <MoneyText amount={restTotal} size="sm" className="text-ink-soft" />
          </View>
          <ProgressBar value={(restTotal / maxTotal) * 100} color="#94a3b8" height={6} />
        </View>
      ) : null}
    </View>
  );
}
