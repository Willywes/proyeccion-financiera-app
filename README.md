# Mis Finanzas

App Android de control de gastos personales: se registran ingresos y egresos por
mes, se categorizan, y con eso la app proyecta los meses siguientes y lleva el
control de la deuda futura (cuotas por vencer, atrasos y carga de deuda).

Todo se guarda **en el dispositivo**, en SQLite. No hay servidor, no hay cuenta y
nada sale del teléfono. El acceso se protege con un PIN local.

## Stack

| Pieza | Elección |
|---|---|
| Runtime | Expo SDK 57 · React Native 0.86 · React 19.2 |
| Lenguaje | TypeScript en modo `strict` |
| Navegación | expo-router (rutas por archivos, con rutas protegidas) |
| Estilos | NativeWind 4 (Tailwind CSS para React Native) |
| Base de datos | expo-sqlite con migraciones versionadas |
| Estado | zustand (sólo el mes seleccionado) + estado local por pantalla |
| Gráficos | react-native-svg, gráfico propio (sin librería de charting) |

## Arrancar

```bash
npm install
npm start          # abre Metro; escanea el QR con Expo Go o usa un dev client
npm run android    # arranca directo en un emulador o teléfono conectado
```

Para un build nativo instalable:

```bash
npm run prebuild   # genera la carpeta android/ (expo prebuild)
npm run build:apk  # gradlew assembleRelease
```

Verificaciones:

```bash
npm run typecheck    # tsc --noEmit
npm run test:domain  # 60 aserciones sobre amortización y proyección
```

`test:domain` compila `src/domain` a CommonJS y lo corre en Node. Es un script
plano a propósito: el dominio es TypeScript puro, así que no hace falta jest ni un
entorno de React Native para verificar aritmética. Cubre lo que más duele si se
rompe — que el capital de una deuda cierre exacto pese a los redondeos, y que la
proyección no cuente dos veces el mismo sueldo ni pierda una cuota vencida.

## Estructura

```
app/                          Rutas (expo-router)
├── _layout.tsx               Providers + rutas protegidas según sesión
├── bienvenida.tsx            Primer arranque: perfil, moneda, PIN
├── bloqueo.tsx               Desbloqueo con PIN
├── (tabs)/
│   ├── index.tsx             Resumen del mes
│   ├── movimientos.tsx       Lista por día, con filtro por tipo
│   ├── proyeccion.tsx        Gráfico de saldo + tabla mes a mes
│   ├── deudas.tsx            Deudas, avance y cuotas atrasadas
│   └── ajustes.tsx           Perfil, seguridad, borrar datos
├── movimiento/[id].tsx       Alta/edición de movimiento (`nuevo` = alta)
├── fijo/[id].tsx             Alta/edición de ingreso o gasto fijo
├── fijos.tsx                 Lista de fijos
├── deuda/nueva.tsx           Alta de deuda con vista previa de cuotas
├── deuda/[id].tsx            Detalle, tabla de cuotas, pagos
└── categorias.tsx            Crear, editar y archivar categorías

src/
├── domain/                   Lógica pura, sin React ni SQL
│   ├── types.ts              Modelo de datos
│   ├── money.ts              Montos en enteros, formato y parseo por moneda
│   ├── dates.ts              Helpers de `YYYY-MM` y `YYYY-MM-DD`
│   ├── amortization.ts       Tablas de cuotas (sistema francés)
│   └── projection.ts         Motor de proyección mes a mes
├── db/
│   ├── client.ts             Conexión única a SQLite
│   ├── migrations.ts         Schema versionado con `PRAGMA user_version`
│   └── seed.ts               24 categorías por defecto en español
├── repositories/             Un módulo por entidad; el único lugar con SQL
├── auth/                     PIN con salt + estiramiento, y estado de sesión
├── hooks/                    Carga de datos y helpers de moneda
├── state/                    Store del mes seleccionado
├── theme/chart.ts            Colores de gráficos y montos
└── ui/                       Componentes con clases Tailwind
```

## Decisiones que conviene conocer antes de tocar el código

### El dinero es un entero, nunca un float

Los montos se guardan como enteros en la **unidad mínima** de la moneda: para CLP
(0 decimales) 1 unidad = $1; para USD serían centavos. Nunca hay `0.1 + 0.2` en
un saldo. El formateo y el parseo de lo que escribe el usuario viven en
`domain/money.ts`, con separadores por moneda.

### Las fechas son strings, no `Date`

Se usan `YYYY-MM-DD` y `YYYY-MM` porque `new Date('2026-08-07')` se interpreta
como UTC y en cualquier zona de Latinoamérica "hoy" se corre un día. Además son
comparables y ordenables tal cual. Ver `domain/dates.ts`.

### Cómo evita la proyección contar dos veces lo mismo

`domain/projection.ts` combina movimientos reales con lo planificado según el mes:

- **Mes pasado** → sólo movimientos reales. Ya ocurrió.
- **Mes en curso** → reales + lo que aún no vence (fijos con día posterior a hoy
  que no se registraron, y cuotas del mes sin pagar).
- **Mes futuro** → fijos vigentes + cuotas programadas.

La pieza que hace esto posible es que un movimiento guarda de dónde vino:
`recurring_rule_id` o `debt_installment_id`. Si un fijo ya generó movimiento en
ese mes, se excluye del plan. Las cuotas pagadas salen de la lista de pendientes.

Las cuotas vencidas e impagas de meses anteriores **no desaparecen**: se arrastran
al mes en curso, porque se siguen debiendo hoy.

### Los fijos no se registran solos

Un ingreso o gasto fijo no crea movimientos automáticamente. Aparece como
pendiente en el resumen del mes y se confirma con un toque. Así el historial
refleja lo que de verdad pasó y no lo que se suponía que iba a pasar.

### Las cuotas son datos, no una fórmula

Al crear una deuda se genera y **persiste** la tabla completa de cuotas. Esa tabla
es la fuente de verdad: se puede editar una cuota puntual o reprogramar el saldo
pendiente (`rebuildPendingInstallments`) sin recalcular el pasado. La última cuota
absorbe los redondeos, así la suma de capital cierra exacta contra lo financiado.

Se puede describir una deuda de dos formas, porque la gente las conoce de dos
formas: por tasa ("$2.000.000 al 18% en 24 cuotas") o por cuota ("12 cuotas de
$45.000"). En el segundo caso la app deduce la tasa implícita y la muestra.

### Verde y rojo no alcanzan

El par verde/rojo de ingreso/egreso es la convención en apps financieras, pero es
justo el que se confunde con daltonismo rojo-verde (~8% de los hombres). Medido en
OKLab, el par obvio queda en ΔE 5.8 para deuteranopia: indistinguible.

Por eso hay **dos tokens por concepto** en `theme/chart.ts`: uno para marcas
gráficas (par separado por luminosidad, validado) y otro para texto (con
contraste suficiente). Y sobre todo: el signo `+`/`−` está siempre presente, las
barras siempre llevan su valor en texto, y la proyección tiene una tabla mes a mes
que dice en números lo mismo que dice el gráfico.

Si se agrega tema oscuro, esos pasos **no sirven tal cual**: hay que elegir pasos
propios de las mismas escalas y volver a validarlos contra la superficie oscura.

### Alcance real del PIN

El PIN evita que alguien que toma el teléfono desbloqueado abra la app y vea las
finanzas. Se guarda como SHA-256 con salt por usuario y 1.000 iteraciones de
estiramiento, para encarecer probar las 10.000 combinaciones de 4 dígitos si
alguien extrae el archivo.

Lo que **no** hace: la base SQLite no está cifrada, así que esto no resiste un
análisis forense del dispositivo. Si eso importara, el siguiente paso es SQLCipher
o cifrar los campos sensibles con una clave derivada del PIN.

## Estado y qué falta

Funciona de punta a punta: crear perfil, registrar movimientos categorizados,
definir fijos, crear deudas con su tabla de cuotas, pagar cuotas, ver el resumen
del mes y la proyección con alerta de saldo negativo.

Pendientes naturales, en orden de valor:

1. **Respaldo y restauración** (exportar/importar JSON o CSV). Hoy no hay copia:
   si se desinstala la app, los datos se van. Es la carencia más grande.
2. **Presupuestos por categoría** con aviso al acercarse al límite.
3. **Notificaciones locales** para cuotas por vencer.
4. **Tema oscuro**, con la revalidación de color que se explicó arriba.
5. **Desbloqueo biométrico** (`expo-local-authentication`) además del PIN.
6. **Tests de repositorios**: el dominio ya está cubierto por `test:domain`, pero
   las consultas SQL no. Requiere un SQLite en Node (`better-sqlite3`) corriendo
   las mismas migraciones.

Lo que **no** se probó en un dispositivo real: no tuve emulador Android en esta
sesión. Está verificado que compila (typecheck limpio y bundle de Metro generado)
y que la lógica de dominio es correcta, pero el render y los gestos hay que verlos
en el teléfono.

## Notas de configuración

- `.npmrc` fija `legacy-peer-deps=true`: el árbol de Expo 57 trae un conflicto de
  peers preexistente (`react-dom` pide react ^19.2.8, Expo pinea 19.2.3) y es
  cómo `expo install` resuelve. Efecto colateral a tener presente: npm no
  auto-instala peers, así que `react-native-worklets` (peer de reanimated) y
  `babel-preset-expo` van declarados explícitamente en `package.json`.
- `babel.config.js` y `metro.config.js` existen porque NativeWind 4 los necesita
  (`jsxImportSource` y `withNativeWind`). Si se toca alguno, hay que limpiar la
  caché: `npx expo start --clear`.
