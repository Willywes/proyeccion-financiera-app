/**
 * Colores de los gráficos y de los montos.
 *
 * Por qué hay dos tokens por concepto (marca y texto):
 *
 * El verde/rojo de "ingreso/egreso" es la convención de cualquier app de
 * finanzas, pero es justo el par que se confunde con daltonismo rojo-verde
 * (deuteranopia y protanopia, ~8% de los hombres). Medido en OKLab, el par
 * obvio emerald-700 (#047857) + rose-600 (#e11d48) queda en ΔE 5.8 para
 * deuteranopia: indistinguible.
 *
 * La solución no es abandonar la convención, es separar el par por luminosidad
 * y no depender nunca del color solo:
 *
 *   - MARCAS gráficas (barras, líneas, puntos): `INCOME_MARK` + `EXPENSE_MARK`.
 *     Ese par mide ΔE 10.6 en protanopia y 34.0 en visión normal: pasa. El rosa
 *     claro queda bajo 3:1 de contraste contra el fondo, así que toda marca que
 *     lo use va obligatoriamente acompañada de su valor en texto.
 *
 *   - TEXTO de montos: `INCOME_TEXT` + `EXPENSE_TEXT`, ambos con contraste
 *     suficiente para leerse. Su separación cae en la banda 6–8, admisible sólo
 *     porque el texto siempre lleva el signo `+` o `−` delante, que es la señal
 *     redundante más clara que existe.
 *
 * Si más adelante se agrega tema oscuro, estos pasos NO sirven tal cual: hay que
 * elegir pasos propios de las mismas escalas y volver a validarlos contra la
 * superficie oscura.
 */

/** Marcas gráficas. Par validado para daltonismo. */
export const INCOME_MARK = '#047857';
export const EXPENSE_MARK = '#fb7185';

/** Texto de montos. Contraste suficiente; el signo aporta la señal redundante. */
export const INCOME_TEXT = '#047857';
export const EXPENSE_TEXT = '#be123c';

/** Saldo proyectado y elementos de marca. */
export const BALANCE_LINE = '#4f46e5';
export const BALANCE_FILL = '#c7d2fe';

/** Deuda y cuotas. */
export const DEBT_MARK = '#d97706';

/** Ejes, grillas y superficies del gráfico: recesivos, nunca compiten. */
export const AXIS_COLOR = '#cbd5e1';
export const GRID_COLOR = '#e2e8f0';
export const ZERO_LINE_COLOR = '#94a3b8';
export const SURFACE = '#ffffff';

/** Zona bajo cero: alerta sin gritar. */
export const NEGATIVE_ZONE = '#ffe4e6';

/** Clases Tailwind para texto de montos, según el tipo de movimiento. */
export const AMOUNT_TEXT_CLASS = {
  income: 'text-income-700',
  expense: 'text-expense-700',
} as const;
