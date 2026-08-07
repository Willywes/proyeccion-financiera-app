/**
 * Estado de sesión local.
 *
 * Estados posibles:
 *   loading      → aún no se sabe si hay perfil creado
 *   needs-setup  → primera vez, hay que crear perfil y PIN
 *   locked       → hay perfil y el bloqueo está activo: pide PIN
 *   unlocked     → sesión abierta
 *
 * La sesión vive en memoria: al cerrar la app vuelve a `locked`. Lo único que
 * se persiste fuera de SQLite es la preferencia de bloqueo, en SecureStore.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../domain/types';
import {
  createUser,
  getUser,
  updateUser,
  updateUserPin,
  type UpdateUserInput,
} from '../repositories/users';
import { generateSalt, hashPin, verifyPin } from './pin';

const LOCK_PREFERENCE_KEY = 'misfinanzas.lock_enabled';

export type AuthStatus = 'loading' | 'needs-setup' | 'locked' | 'unlocked';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** `false` si el usuario desactivó el PIN en Ajustes. */
  lockEnabled: boolean;
  /** Error de la última operación, en texto listo para mostrar. */
  error: string | null;
  createProfile: (input: {
    name: string;
    pin: string;
    currency: string;
    openingBalance: number;
  }) => Promise<boolean>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  setLockEnabled: (enabled: boolean) => Promise<void>;
  saveProfile: (input: UpdateUserInput) => Promise<void>;
  /** Recarga el perfil desde la base, tras cambios en Ajustes. */
  refreshUser: () => Promise<void>;
  /** Vuelve al estado inicial después de borrar todos los datos. */
  resetSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readLockPreference(): Promise<boolean> {
  try {
    const stored = await SecureStore.getItemAsync(LOCK_PREFERENCE_KEY);
    // Sin valor guardado, el bloqueo viene activado.
    return stored !== '0';
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [lockEnabled, setLockEnabledState] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Arranque: decide si hay que crear perfil, pedir PIN o entrar directo.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [existing, lockPreference] = await Promise.all([
          getUser(),
          readLockPreference(),
        ]);
        if (cancelled) return;

        setLockEnabledState(lockPreference);
        setUser(existing);

        if (!existing) setStatus('needs-setup');
        else setStatus(lockPreference ? 'locked' : 'unlocked');
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : 'No se pudo abrir la base de datos local',
        );
        setStatus('needs-setup');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const createProfile = useCallback<AuthContextValue['createProfile']>(
    async ({ name, pin, currency, openingBalance }) => {
      setError(null);
      try {
        const salt = await generateSalt();
        const pinHash = await hashPin(pin, salt);
        const created = await createUser({
          name,
          pinHash,
          pinSalt: salt,
          currency,
          openingBalance,
        });
        setUser(created);
        setStatus('unlocked');
        return true;
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'No se pudo crear el perfil',
        );
        return false;
      }
    },
    [],
  );

  const unlock = useCallback<AuthContextValue['unlock']>(
    async (pin) => {
      setError(null);
      // Se relee el perfil: puede haber cambiado el PIN en otra sesión.
      const current = user ?? (await getUser());
      if (!current) {
        setStatus('needs-setup');
        return false;
      }

      const valid = await verifyPin(pin, current.pinSalt, current.pinHash);
      if (!valid) {
        setError('PIN incorrecto');
        return false;
      }

      setUser(current);
      setStatus('unlocked');
      return true;
    },
    [user],
  );

  const lock = useCallback(() => {
    setError(null);
    setStatus(user ? 'locked' : 'needs-setup');
  }, [user]);

  const changePin = useCallback<AuthContextValue['changePin']>(
    async (currentPin, newPin) => {
      setError(null);
      if (!user) return false;

      const valid = await verifyPin(currentPin, user.pinSalt, user.pinHash);
      if (!valid) {
        setError('El PIN actual no coincide');
        return false;
      }

      const salt = await generateSalt();
      const pinHash = await hashPin(newPin, salt);
      await updateUserPin(user.id, pinHash, salt);
      setUser({ ...user, pinHash, pinSalt: salt });
      return true;
    },
    [user],
  );

  const setLockEnabled = useCallback<AuthContextValue['setLockEnabled']>(
    async (enabled) => {
      setLockEnabledState(enabled);
      await SecureStore.setItemAsync(LOCK_PREFERENCE_KEY, enabled ? '1' : '0');
    },
    [],
  );

  const saveProfile = useCallback<AuthContextValue['saveProfile']>(
    async (input) => {
      if (!user) return;
      await updateUser(user.id, input);
      const refreshed = await getUser();
      if (refreshed) setUser(refreshed);
    },
    [user],
  );

  const refreshUser = useCallback(async () => {
    const refreshed = await getUser();
    setUser(refreshed);
    if (!refreshed) setStatus('needs-setup');
  }, []);

  const resetSession = useCallback(() => {
    setUser(null);
    setError(null);
    setStatus('needs-setup');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      lockEnabled,
      error,
      createProfile,
      unlock,
      lock,
      changePin,
      setLockEnabled,
      saveProfile,
      refreshUser,
      resetSession,
    }),
    [
      status,
      user,
      lockEnabled,
      error,
      createProfile,
      unlock,
      lock,
      changePin,
      setLockEnabled,
      saveProfile,
      refreshUser,
      resetSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return context;
}

/** Perfil garantizado. Sólo para pantallas detrás del login. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('No hay perfil activo en esta pantalla');
  return user;
}
