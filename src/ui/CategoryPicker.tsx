/** Selección de categoría en los formularios. */

import { ScrollView, Text, View } from 'react-native';
import { Chip } from './Button';
import { Field } from './Input';
import type { Category } from '../domain/types';

export function CategoryPicker({
  categories,
  value,
  onChange,
  label = 'Categoría',
  error,
}: {
  categories: Category[];
  value: number | null;
  onChange: (categoryId: number | null) => void;
  label?: string;
  error?: string | null;
}) {
  if (categories.length === 0) {
    return (
      <Field label={label}>
        <Text className="text-sm text-ink-muted">
          No hay categorías de este tipo. Puedes crearlas desde Ajustes.
        </Text>
      </Field>
    );
  }

  return (
    <Field label={label} error={error}>
      {/* Las categorías se envuelven en varias líneas: con 20+ opciones un
          scroll horizontal esconde la mitad y obliga a explorar a ciegas. */}
      <View className="flex-row flex-wrap gap-2">
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            icon={category.icon}
            color={category.color}
            selected={value === category.id}
            onPress={() => onChange(category.id)}
          />
        ))}
      </View>
    </Field>
  );
}

/** Paleta de colores para crear o editar una categoría. */
const COLOR_OPTIONS = [
  '#e11d48',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#10b981',
  '#0d9488',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
  '#78716c',
  '#64748b',
];

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <Field label="Color">
      <View className="flex-row flex-wrap gap-2">
        {COLOR_OPTIONS.map((color) => (
          <View
            key={color}
            className={`h-10 w-10 items-center justify-center rounded-full ${
              value === color ? 'border-2 border-ink' : ''
            }`}
          >
            <Text
              onPress={() => onChange(color)}
              accessibilityRole="button"
              accessibilityLabel={`Color ${color}`}
              accessibilityState={{ selected: value === color }}
              className="h-8 w-8 rounded-full"
              style={{ backgroundColor: color }}
            />
          </View>
        ))}
      </View>
    </Field>
  );
}

/** Iconos disponibles al crear una categoría. */
const ICON_OPTIONS = [
  '💼', '🧾', '🛍️', '🏘️', '📈', '🎁', '➕', '🏠', '💡', '📶',
  '🛒', '🍔', '🚌', '💊', '🎓', '💳', '📺', '👕', '🎬', '🐾',
  '🛠️', '🏦', '⚠️', '➖', '🚗', '✈️', '🎮', '📚', '☕', '🎵',
  '👶', '💰', '🔧', '📦',
];

export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  return (
    <Field label="Icono">
      <ScrollView className="max-h-32">
        <View className="flex-row flex-wrap gap-2">
          {ICON_OPTIONS.map((icon) => (
            <Text
              key={icon}
              onPress={() => onChange(icon)}
              accessibilityRole="button"
              accessibilityLabel={`Icono ${icon}`}
              accessibilityState={{ selected: value === icon }}
              className={`h-10 w-10 rounded-xl pt-1.5 text-center text-xl ${
                value === icon ? 'bg-brand-100' : 'bg-surface-sunken'
              }`}
            >
              {icon}
            </Text>
          ))}
        </View>
      </ScrollView>
    </Field>
  );
}
