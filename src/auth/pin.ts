/**
 * Hash del PIN de acceso local.
 *
 * Alcance real de esta protección: el PIN evita que alguien que toma el
 * teléfono desbloqueado abra la app y vea las finanzas. No protege contra un
 * análisis forense del dispositivo, porque la base SQLite no está cifrada.
 *
 * Se usa SHA-256 con salt aleatorio por usuario y estiramiento por iteración.
 * Un PIN de 4 dígitos son sólo 10.000 combinaciones, así que el estiramiento
 * es lo que encarece probarlas todas si alguien extrae el archivo. Cada
 * iteración es una llamada nativa, por eso el número es moderado: en un Android
 * de gama baja 1.000 iteraciones tardan del orden de cientos de milisegundos,
 * que es aceptable para un login pero incómodo para un ataque por fuerza bruta.
 */

import * as Crypto from 'expo-crypto';

const STRETCH_ITERATIONS = 1000;
const SALT_BYTES = 16;
export const PIN_LENGTH = 4;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(SALT_BYTES);
  return toHex(bytes);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  let digest = `${salt}:${pin}`;
  for (let iteration = 0; iteration < STRETCH_ITERATIONS; iteration += 1) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digest);
  }
  return digest;
}

/**
 * Compara en tiempo constante respecto al contenido, para no filtrar cuántos
 * caracteres coinciden a través del tiempo de respuesta.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyPin(
  pin: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const hash = await hashPin(pin, salt);
  return safeCompare(hash, expectedHash);
}

/** Valida el formato: exactamente `PIN_LENGTH` dígitos. */
export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}
