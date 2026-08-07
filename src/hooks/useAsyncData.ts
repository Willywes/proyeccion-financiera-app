/**
 * Carga datos de SQLite y los recarga cada vez que la pantalla toma foco.
 *
 * Como no hay servidor ni caché entre pantallas, volver a consultar al enfocar
 * es la forma más simple de que los cambios hechos en otra pantalla (registrar
 * un gasto, pagar una cuota) se reflejen al volver.
 *
 * `cacheKey` identifica la consulta: cuando cambia, se recarga. Va como string
 * en lugar de un arreglo de dependencias para que el efecto tenga dependencias
 * estables y no haya que desactivar la regla de hooks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /** Vuelve a ejecutar el loader manualmente. */
  reload: () => void;
}

export function useAsyncData<T>(
  loader: () => Promise<T>,
  cacheKey: string,
): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // El loader se guarda en un ref para que cambiar la función en cada render no
  // dispare recargas: la recarga la manda `cacheKey`.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loaderRef.current();
      if (!mountedRef.current) return;
      setData(result);
      setError(null);
    } catch (caught) {
      if (!mountedRef.current) return;
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void run();
    }, [run, cacheKey, reloadToken]),
  );

  return { data, loading, error, reload };
}
