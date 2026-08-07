import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { LoadingScreen } from '../src/ui/Screen';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Las rutas se montan según el estado de sesión. Con `Stack.Protected`, las
 * pantallas cuyo guard es falso quedan fuera del árbol de navegación: no basta
 * con esconderlas, no existen, así que no hay forma de llegar a los datos con
 * un deep link mientras la app está bloqueada.
 */
function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen label="Abriendo tus datos…" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'needs-setup'}>
        <Stack.Screen name="bienvenida" />
      </Stack.Protected>

      <Stack.Protected guard={status === 'locked'}>
        <Stack.Screen name="bloqueo" />
      </Stack.Protected>

      <Stack.Protected guard={status === 'unlocked'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="movimiento/[id]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="fijo/[id]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="deuda/nueva"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="deuda/[id]" />
        <Stack.Screen name="categorias" />
        <Stack.Screen name="fijos" />
      </Stack.Protected>
    </Stack>
  );
}
