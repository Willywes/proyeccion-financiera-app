/** Gestión de categorías: crear, editar, archivar y restaurar. */

import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAsyncData } from '../src/hooks/useAsyncData';
import {
  archiveCategory,
  countCategoryUsage,
  createCategory,
  listAllCategories,
  restoreCategory,
  updateCategory,
} from '../src/repositories/categories';
import { Button, SegmentedControl } from '../src/ui/Button';
import { Card, Divider } from '../src/ui/Card';
import { Badge, EmptyState } from '../src/ui/Feedback';
import { ColorPicker, IconPicker } from '../src/ui/CategoryPicker';
import { TextField } from '../src/ui/Input';
import { CategoryAvatar } from '../src/ui/ListItems';
import {
  ErrorScreen,
  LoadingScreen,
  ModalHeader,
  Screen,
  SectionTitle,
} from '../src/ui/Screen';
import type { Category, MovementType } from '../src/domain/types';

export default function CategoriesScreen() {
  const router = useRouter();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);

  const load = useCallback(() => listAllCategories(), []);
  const { data, loading, error, reload } = useAsyncData(load, 'categorias');

  if (error) return <ErrorScreen error={error} />;
  if (loading && !data) return <LoadingScreen />;

  const categories = data ?? [];
  const active = categories.filter((category) => category.archivedAt === null);
  const archived = categories.filter((category) => category.archivedAt !== null);
  const income = active.filter((category) => category.type === 'income');
  const expense = active.filter((category) => category.type === 'expense');

  const handleArchive = async (category: Category) => {
    const usage = await countCategoryUsage(category.id);

    Alert.alert(
      `¿Archivar "${category.name}"?`,
      usage > 0
        ? `Hay ${usage} ${usage === 1 ? 'movimiento' : 'movimientos'} con esta categoría. Se conservan tal cual: la categoría sólo deja de aparecer al registrar algo nuevo.`
        : 'Dejará de aparecer al registrar movimientos. Puedes restaurarla cuando quieras.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          onPress: async () => {
            await archiveCategory(category.id);
            reload();
          },
        },
      ],
    );
  };

  const handleRestore = async (category: Category) => {
    await restoreCategory(category.id);
    reload();
  };

  return (
    <View className="flex-1">
      <ModalHeader
        title="Categorías"
        subtitle={`${active.length} activas`}
        onClose={() => router.back()}
        closeLabel="‹"
        right={
          <Button label="Nueva" size="sm" onPress={() => setEditing('new')} />
        }
      />

      <Screen>
        {active.length === 0 ? (
          <View className="mx-5 mt-6">
            <Card>
              <EmptyState
                icon="🏷️"
                title="No hay categorías activas"
                description="Crea al menos una para poder clasificar tus movimientos."
                action={
                  <Button label="Crear categoría" onPress={() => setEditing('new')} />
                }
              />
            </Card>
          </View>
        ) : null}

        {income.length > 0 ? (
          <>
            <SectionTitle>Ingresos</SectionTitle>
            <CategoryList
              categories={income}
              onEdit={setEditing}
              onArchive={handleArchive}
            />
          </>
        ) : null}

        {expense.length > 0 ? (
          <>
            <SectionTitle>Egresos</SectionTitle>
            <CategoryList
              categories={expense}
              onEdit={setEditing}
              onArchive={handleArchive}
            />
          </>
        ) : null}

        {archived.length > 0 ? (
          <>
            <SectionTitle>Archivadas</SectionTitle>
            <View className="mx-5 overflow-hidden rounded-card border border-line bg-surface">
              {archived.map((category, index) => (
                <View key={category.id}>
                  {index > 0 ? <Divider /> : null}
                  <View className="flex-row items-center gap-3 p-3 opacity-60">
                    <CategoryAvatar icon={category.icon} color={category.color} />
                    <View className="flex-1">
                      <Text className="text-base text-ink">{category.name}</Text>
                      <Text className="text-xs text-ink-muted">
                        {category.type === 'income' ? 'Ingreso' : 'Egreso'}
                      </Text>
                    </View>
                    <Button
                      label="Restaurar"
                      size="sm"
                      variant="secondary"
                      onPress={() => handleRestore(category)}
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View className="h-6" />
      </Screen>

      {editing !== null ? (
        <CategoryEditor
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </View>
  );
}

function CategoryList({
  categories,
  onEdit,
  onArchive,
}: {
  categories: Category[];
  onEdit: (category: Category) => void;
  onArchive: (category: Category) => void;
}) {
  return (
    <View className="mx-5 overflow-hidden rounded-card border border-line bg-surface">
      {categories.map((category, index) => (
        <View key={category.id}>
          {index > 0 ? <Divider /> : null}
          <View className="flex-row items-center gap-3 p-3">
            <CategoryAvatar icon={category.icon} color={category.color} />

            <Pressable onPress={() => onEdit(category)} className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-base text-ink">{category.name}</Text>
                {category.isDefault ? <Badge label="Por defecto" /> : null}
              </View>
              <Text className="text-xs text-brand-600">Editar</Text>
            </Pressable>

            <Text
              onPress={() => onArchive(category)}
              accessibilityRole="button"
              className="px-2 text-xs font-semibold text-ink-muted"
            >
              Archivar
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Editor de categoría en una hoja modal. */
function CategoryEditor({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [type, setType] = useState<MovementType>(category?.type ?? 'expense');
  const [color, setColor] = useState(category?.color ?? '#6366f1');
  const [icon, setIcon] = useState(category?.icon ?? '📦');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (name.trim().length < 2) {
      setNameError('El nombre necesita al menos 2 letras');
      return;
    }

    setSaving(true);
    try {
      if (category) await updateCategory(category.id, { name, type, color, icon });
      else await createCategory({ name, type, color, icon });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-surface-muted">
        <ModalHeader
          title={category ? 'Editar categoría' : 'Nueva categoría'}
          onClose={onClose}
        />

        <Screen>
          <View className="gap-5 p-5">
            <View className="items-center gap-2 py-2">
              <CategoryAvatar icon={icon} color={color} size={72} />
              <Text className="text-sm text-ink-soft">Así se va a ver</Text>
            </View>

            <SegmentedControl<MovementType>
              value={type}
              onChange={setType}
              options={[
                { value: 'expense', label: 'Egreso', activeClassName: 'bg-expense-600' },
                { value: 'income', label: 'Ingreso', activeClassName: 'bg-income-700' },
              ]}
            />

            <TextField
              label="Nombre"
              value={name}
              onChangeText={(value) => {
                setName(value);
                setNameError(null);
              }}
              placeholder="Ej: Bencina"
              error={nameError}
              maxLength={30}
              autoFocus={!category}
            />

            <IconPicker value={icon} onChange={setIcon} />
            <ColorPicker value={color} onChange={setColor} />

            <Button
              label={category ? 'Guardar cambios' : 'Crear categoría'}
              onPress={handleSave}
              loading={saving}
            />
          </View>
        </Screen>
      </View>
    </Modal>
  );
}
