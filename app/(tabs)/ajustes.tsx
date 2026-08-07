/** Perfil, preferencias, gestión de datos. */

import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { resetDatabase } from '../../src/db/client';
import { CURRENCIES } from '../../src/domain/money';
import { PIN_LENGTH, isValidPinFormat } from '../../src/auth/pin';
import { Button, Chip } from '../../src/ui/Button';
import { Card, Divider } from '../../src/ui/Card';
import { Field, MoneyField, TextField, ToggleRow } from '../../src/ui/Input';
import { Notice } from '../../src/ui/Feedback';
import { Screen, SectionTitle } from '../../src/ui/Screen';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    user,
    lockEnabled,
    setLockEnabled,
    saveProfile,
    changePin,
    lock,
    resetSession,
    error,
  } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [openingBalance, setOpeningBalance] = useState<number | null>(
    user?.openingBalance ?? 0,
  );
  const [currency, setCurrency] = useState(user?.currency ?? 'CLP');
  const [savedNotice, setSavedNotice] = useState(false);
  const [saving, setSaving] = useState(false);

  const [changingPin, setChangingPin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    setSaving(true);
    await saveProfile({
      name,
      currency,
      openingBalance: openingBalance ?? 0,
    });
    setSaving(false);
    setSavedNotice(true);
    // El aviso se apaga solo: no vale un botón para descartar algo así.
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleChangePin = async () => {
    setPinMessage(null);
    if (!isValidPinFormat(newPin)) {
      setPinMessage(`El PIN nuevo debe tener ${PIN_LENGTH} dígitos`);
      return;
    }
    const ok = await changePin(currentPin, newPin);
    if (ok) {
      setChangingPin(false);
      setCurrentPin('');
      setNewPin('');
      setPinMessage(null);
      Alert.alert('PIN actualizado', 'Tu nuevo PIN queda activo desde ahora.');
    } else {
      setPinMessage(error ?? 'No se pudo cambiar el PIN');
    }
  };

  const handleReset = () => {
    Alert.alert(
      '¿Borrar todos tus datos?',
      'Se eliminan tus movimientos, deudas, categorías y tu perfil. Esta acción no se puede deshacer y no hay copia de respaldo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase();
            resetSession();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View className="bg-brand-600 px-5 pb-6" style={{ paddingTop: insets.top + 12 }}>
        <Text className="text-2xl font-bold text-white">Ajustes</Text>
        <Text className="mt-1 text-sm text-brand-100">
          {user?.name ? `Perfil de ${user.name}` : 'Tu perfil local'}
        </Text>
      </View>

      {/* Perfil. */}
      <SectionTitle>Tu perfil</SectionTitle>
      <View className="mx-5">
        <Card className="gap-4">
          <TextField label="Nombre" value={name} onChangeText={setName} maxLength={40} />

          <MoneyField
            label="Saldo inicial"
            value={openingBalance}
            onChange={setOpeningBalance}
            hint="Punto de partida de las proyecciones. Es el dinero que tenías cuando empezaste a usar la app."
          />

          <Field label="Moneda">
            <View className="flex-row flex-wrap gap-2">
              {Object.values(CURRENCIES).map((option) => (
                <Chip
                  key={option.code}
                  label={`${option.symbol} ${option.code}`}
                  selected={currency === option.code}
                  onPress={() => setCurrency(option.code)}
                />
              ))}
            </View>
          </Field>

          <Button
            label="Guardar cambios"
            onPress={handleSaveProfile}
            loading={saving}
          />

          {savedNotice ? <Notice tone="success" title="Cambios guardados" /> : null}
        </Card>
      </View>

      {/* Organización. */}
      <SectionTitle>Organización</SectionTitle>
      <View className="mx-5 overflow-hidden rounded-card border border-line bg-surface">
        <NavRow
          icon="🔁"
          label="Ingresos y gastos fijos"
          description="Sueldo, arriendo, cuentas y suscripciones"
          onPress={() => router.push('/fijos')}
        />
        <Divider />
        <NavRow
          icon="🏷️"
          label="Categorías"
          description="Crear, editar y archivar categorías"
          onPress={() => router.push('/categorias')}
        />
      </View>

      {/* Seguridad. */}
      <SectionTitle>Seguridad</SectionTitle>
      <View className="mx-5">
        <Card>
          <ToggleRow
            label="Pedir PIN al abrir"
            description="Protege tus finanzas si alguien más toma tu teléfono"
            value={lockEnabled}
            onChange={(value) => void setLockEnabled(value)}
          />

          <Divider />

          {!changingPin ? (
            <View className="pt-3">
              <Button
                label="Cambiar PIN"
                variant="secondary"
                onPress={() => setChangingPin(true)}
              />
            </View>
          ) : (
            <View className="gap-3 pt-3">
              <TextField
                label="PIN actual"
                value={currentPin}
                onChangeText={setCurrentPin}
                keyboardType="number-pad"
                maxLength={PIN_LENGTH}
                placeholder="••••"
              />
              <TextField
                label="PIN nuevo"
                value={newPin}
                onChangeText={setNewPin}
                keyboardType="number-pad"
                maxLength={PIN_LENGTH}
                placeholder="••••"
                error={pinMessage}
              />
              <View className="flex-row gap-3">
                <Button
                  label="Cancelar"
                  variant="secondary"
                  className="flex-1"
                  onPress={() => {
                    setChangingPin(false);
                    setCurrentPin('');
                    setNewPin('');
                    setPinMessage(null);
                  }}
                />
                <Button label="Guardar" className="flex-1" onPress={handleChangePin} />
              </View>
            </View>
          )}

          {lockEnabled ? (
            <View className="pt-3">
              <Button label="Bloquear ahora" variant="ghost" onPress={lock} />
            </View>
          ) : null}
        </Card>
      </View>

      {/* Datos. */}
      <SectionTitle>Tus datos</SectionTitle>
      <View className="mx-5 gap-3">
        <Card>
          <Text className="text-sm leading-5 text-ink-soft">
            Todo lo que registras se guarda únicamente en este teléfono, en una base
            de datos local. No hay servidor, no hay cuenta y nada sale del
            dispositivo. Eso también significa que no hay respaldo automático: si
            desinstalas la app o pierdes el teléfono, los datos se van con él.
          </Text>
        </Card>

        <Card>
          <Text className="mb-3 text-sm font-semibold text-ink">Borrar todo</Text>
          <Text className="mb-3 text-xs leading-4 text-ink-soft">
            Elimina movimientos, deudas, categorías y tu perfil, y deja la app como
            recién instalada.
          </Text>
          <Button label="Borrar todos mis datos" variant="danger" onPress={handleReset} />
        </Card>
      </View>

      <Text className="px-5 pb-2 pt-6 text-center text-xs text-ink-muted">
        Mis Finanzas · versión 0.1.0
      </Text>
    </Screen>
  );
}

function NavRow({
  icon,
  label,
  description,
  onPress,
}: {
  icon: string;
  label: string;
  description?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 p-4 active:bg-surface-sunken"
    >
      <Text className="text-xl">{icon}</Text>
      <View className="flex-1">
        <Text className="text-base text-ink">{label}</Text>
        {description ? (
          <Text className="text-xs text-ink-muted">{description}</Text>
        ) : null}
      </View>
      <Text className="text-lg text-ink-muted">›</Text>
    </Pressable>
  );
}
