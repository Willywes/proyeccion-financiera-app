/// <reference types="nativewind/types" />

/**
 * `global.css` se importa como efecto secundario en el layout raíz para que
 * NativeWind inyecte las utilidades de Tailwind. TypeScript necesita saber que
 * un `.css` es un módulo válido aunque no exporte nada.
 */
declare module '*.css';
