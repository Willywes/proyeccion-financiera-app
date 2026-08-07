/** Primer arranque: crear el perfil local y su PIN. */

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthContext';
import { PIN_LENGTH } from '../src/auth/pin';
import { CURRENCIES, DEFAULT_CURRENCY, parseMoneyInput } from '../src/domain/money';
import { Button, Chip } from '../src/ui/Button';
import { Card } from '../src/ui/Card';
import { Field, TextField } from '../src/ui/Input';
import { Notice } from '../src/ui/Feedback';
import { PinPad } from '../src/ui/PinPad';

type Step = 'profile' | 'pin' | 'confirm';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { createProfile, error } = useAuth();

  const [step, setStep] = useState<Step>('profile');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [balanceText, setBalanceText] = useState('');
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openingBalance =
    parseMoneyInput(balanceText, CURRENCIES[currency] ?? CURRENCIES[DEFAULT_CURRENCY]) ?? 0;

  const goToPin = () => {
    if (name.trim().length < 2) {
      setLocalError('Escribe tu nombre para personalizar la app');
      return;
    }
    setLocalError(null);
    setStep('pin');
  };

  const handlePinComplete = (value: string) => {
    setPin(value);
    setLocalError(null);
    setStep('confirm');
  };

  const handleConfirmComplete = async (value: string) => {
    if (value !== pin) {
      setLocalError('Los PIN no coinciden. Inténtalo de nuevo.');
      setConfirmation('');
      setPin('');
      setStep('pin');
      return;
    }

    setSaving(true);
    setLocalError(null);
    const created = await createProfile({
      name: name.trim(),
      pin,
      currency,
      openingBalance,
    });
    setSaving(false);
    if (!created) {
      setPin('');
      setConfirmation('');
      setStep('pin');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-brand-600"
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 32,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6 pb-8">
          <Text className="text-4xl">💰</Text>
          <Text className="mt-3 text-3xl font-bold text-white">Mis Finanzas</Text>
          <Text className="mt-2 text-base leading-6 text-brand-100">
            Controla tus ingresos, gastos y deudas. Todo queda guardado en este
            teléfono, sin cuentas ni internet.
          </Text>
        </View>

        <View className="flex-1 rounded-t-[28px] bg-surface-muted px-5 pt-6">
          {step === 'profile' ? (
            <View className="gap-5">
              <Text className="text-xl font-bold text-ink">Empecemos</Text>

              <TextField
                label="¿Cómo te llamas?"
                value={name}
                onChangeText={setName}
                placeholder="Tu nombre"
                autoFocus
                maxLength={40}
                error={localError}
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

              <TextField
                label="¿Cuánto dinero tienes ahora?"
                value={balanceText}
                onChangeText={setBalanceText}
                placeholder="0"
                keyboardType="numeric"
                hint="Es el punto de partida de tus proyecciones. Puedes cambiarlo después."
              />

              <Button label="Continuar" onPress={goToPin} />
            </View>
          ) : null}

          {step === 'pin' ? (
            <View className="gap-4">
              <View>
                <Text className="text-xl font-bold text-ink">Crea tu PIN</Text>
                <Text className="mt-1 text-sm text-ink-soft">
                  {PIN_LENGTH} dígitos para entrar a la app.
                </Text>
              </View>

              <PinPad
                length={PIN_LENGTH}
                value={pin}
                onChange={setPin}
                onComplete={handlePinComplete}
                error={localError}
              />

              <Card className="bg-brand-50">
                <Text className="text-xs leading-4 text-ink-soft">
                  El PIN protege la app de miradas ajenas en tu teléfono. Anótalo en
                  algún lugar seguro: como todo se guarda sólo aquí, no hay forma de
                  recuperarlo si lo olvidas.
                </Text>
              </Card>
            </View>
          ) : null}

          {step === 'confirm' ? (
            <View className="gap-4">
              <View>
                <Text className="text-xl font-bold text-ink">Repite tu PIN</Text>
                <Text className="mt-1 text-sm text-ink-soft">
                  Para confirmar que quedó bien guardado.
                </Text>
              </View>

              <PinPad
                length={PIN_LENGTH}
                value={confirmation}
                onChange={setConfirmation}
                onComplete={handleConfirmComplete}
                error={localError ?? error}
                busy={saving}
              />
            </View>
          ) : null}

          {error && step === 'profile' ? (
            <View className="mt-4">
              <Notice tone="danger" title="No se pudo guardar">
                {error}
              </Notice>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
