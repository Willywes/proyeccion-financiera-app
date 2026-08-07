/** Pantalla de desbloqueo: pide el PIN para abrir la sesión. */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthContext';
import { PIN_LENGTH } from '../src/auth/pin';
import { PinPad } from '../src/ui/PinPad';

export default function LockScreen() {
  const insets = useSafeAreaInsets();
  const { unlock, user, error } = useAuth();

  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleComplete = useCallback(
    async (value: string) => {
      setChecking(true);
      const ok = await unlock(value);
      setChecking(false);
      if (!ok) {
        setPin('');
        setAttempts((count) => count + 1);
      }
    },
    [unlock],
  );

  const greeting = user?.name ? `Hola, ${user.name}` : 'Hola';

  return (
    <View
      className="flex-1 bg-surface-muted px-5"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }}
    >
      <View className="items-center gap-2 pb-10">
        <Text className="text-5xl">🔒</Text>
        <Text className="text-2xl font-bold text-ink">{greeting}</Text>
        <Text className="text-sm text-ink-soft">Ingresa tu PIN para continuar</Text>
      </View>

      <PinPad
        length={PIN_LENGTH}
        value={pin}
        onChange={setPin}
        onComplete={handleComplete}
        error={error}
        busy={checking}
      />

      {attempts >= 3 ? (
        <Text className="mt-6 px-6 text-center text-xs leading-4 text-ink-muted">
          Si olvidaste tu PIN no hay forma de recuperarlo: no hay servidor ni correo
          de recuperación, todo vive en este teléfono. Tendrías que reinstalar la app
          y empezar de nuevo.
        </Text>
      ) : null}
    </View>
  );
}
