/**
 * Saldo proyectado mes a mes.
 *
 * Decisiones de diseño, y por qué:
 *
 * - Una sola serie (el saldo). No hay caja de leyenda: el título de la sección
 *   ya dice qué es la línea. Las barras agrupadas de ingreso/egreso por mes se
 *   descartaron a propósito — con 12 meses en el ancho de un teléfono cada barra
 *   quedaría en ~6 px, ilegible. Esos números van en la tabla mensual de abajo,
 *   que además es la vista alternativa accesible del mismo dato.
 *
 * - La pregunta que responde el gráfico es "¿en qué momento no me alcanza?", así
 *   que lo que se destaca es el cruce por cero: línea de cero marcada, zona
 *   negativa sombreada y el primer mes en rojo etiquetado directamente.
 *
 * - Etiquetas selectivas: sólo el primer punto, el último y el primer negativo.
 *   Un número en cada punto sería ruido.
 */

import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  AXIS_COLOR,
  BALANCE_FILL,
  BALANCE_LINE,
  EXPENSE_TEXT,
  GRID_COLOR,
  NEGATIVE_ZONE,
  ZERO_LINE_COLOR,
} from '../theme/chart';
import { monthLabel } from '../domain/dates';
import { useCurrency } from '../hooks/useCurrency';
import type { MonthProjection } from '../domain/types';

const HEIGHT = 190;
const PADDING = { top: 22, right: 10, bottom: 24, left: 10 };

export function BalanceChart({ rows }: { rows: MonthProjection[] }) {
  const { formatCompact } = useCurrency();
  const [width, setWidth] = useState(0);

  if (rows.length < 2) {
    return (
      <View className="items-center justify-center py-8">
        <Text className="text-sm text-ink-muted">
          Se necesitan al menos dos meses para dibujar la proyección
        </Text>
      </View>
    );
  }

  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const values = rows.map((row) => row.closingBalance);
  // El cero siempre entra en el dominio: sin él no se ve si el saldo lo cruza.
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  // Un margen del 8% evita que la línea toque los bordes del área de dibujo.
  const span = rawMax - rawMin || Math.abs(rawMax) || 1;
  const min = rawMin - span * 0.08;
  const max = rawMax + span * 0.08;

  const xAt = (index: number) =>
    PADDING.left + (plotWidth * index) / (rows.length - 1);
  const yAt = (value: number) =>
    PADDING.top + plotHeight - ((value - min) / (max - min)) * plotHeight;

  const zeroY = yAt(0);
  const linePath = rows
    .map((row, index) => `${index === 0 ? 'M' : 'L'}${xAt(index)},${yAt(row.closingBalance)}`)
    .join(' ');
  // Área bajo la línea, cerrada contra el borde inferior del área de dibujo.
  const areaPath = `${linePath} L${xAt(rows.length - 1)},${PADDING.top + plotHeight} L${xAt(0)},${
    PADDING.top + plotHeight
  } Z`;

  const firstNegativeIndex = rows.findIndex((row) => row.closingBalance < 0);
  const lastIndex = rows.length - 1;

  // Se etiqueta un mes de cada N para que las etiquetas del eje no se pisen.
  const labelStep = Math.max(1, Math.ceil(rows.length / 5));

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {/* Zona bajo cero: el saldo negativo se lee antes de mirar la línea. */}
          {min < 0 ? (
            <Rect
              x={PADDING.left}
              y={zeroY}
              width={plotWidth}
              height={Math.max(0, PADDING.top + plotHeight - zeroY)}
              fill={NEGATIVE_ZONE}
            />
          ) : null}

          {/* Grilla recesiva. */}
          {[0.25, 0.5, 0.75].map((fraction) => {
            const y = PADDING.top + plotHeight * fraction;
            return (
              <Line
                key={fraction}
                x1={PADDING.left}
                y1={y}
                x2={PADDING.left + plotWidth}
                y2={y}
                stroke={GRID_COLOR}
                strokeWidth={1}
              />
            );
          })}

          <Path d={areaPath} fill={BALANCE_FILL} fillOpacity={0.35} />

          {/* Línea de cero: más marcada que la grilla, es la referencia clave. */}
          {min < 0 ? (
            <Line
              x1={PADDING.left}
              y1={zeroY}
              x2={PADDING.left + plotWidth}
              y2={zeroY}
              stroke={ZERO_LINE_COLOR}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          ) : null}

          <Path
            d={linePath}
            stroke={BALANCE_LINE}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Marcadores sólo en los puntos que se etiquetan. */}
          {[0, lastIndex, firstNegativeIndex]
            .filter((index, position, list) => index >= 0 && list.indexOf(index) === position)
            .map((index) => {
              const negative = rows[index].closingBalance < 0;
              return (
                <Circle
                  key={index}
                  cx={xAt(index)}
                  cy={yAt(rows[index].closingBalance)}
                  r={4.5}
                  fill={negative ? EXPENSE_TEXT : BALANCE_LINE}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              );
            })}

          {/* Etiqueta del saldo inicial. */}
          <SvgText
            x={xAt(0)}
            y={Math.max(12, yAt(rows[0].closingBalance) - 10)}
            fontSize={11}
            fontWeight="600"
            fill={rows[0].closingBalance < 0 ? EXPENSE_TEXT : BALANCE_LINE}
            textAnchor="start"
          >
            {formatCompact(rows[0].closingBalance)}
          </SvgText>

          {/* Etiqueta del saldo final. */}
          <SvgText
            x={xAt(lastIndex)}
            y={Math.max(12, yAt(rows[lastIndex].closingBalance) - 10)}
            fontSize={11}
            fontWeight="700"
            fill={rows[lastIndex].closingBalance < 0 ? EXPENSE_TEXT : BALANCE_LINE}
            textAnchor="end"
          >
            {formatCompact(rows[lastIndex].closingBalance)}
          </SvgText>

          {/* Eje X. */}
          <Line
            x1={PADDING.left}
            y1={PADDING.top + plotHeight}
            x2={PADDING.left + plotWidth}
            y2={PADDING.top + plotHeight}
            stroke={AXIS_COLOR}
            strokeWidth={1}
          />

          {rows.map((row, index) => {
            if (index % labelStep !== 0 && index !== lastIndex) return null;
            // El último rótulo se ancla al final para no salirse del lienzo.
            const isLast = index === lastIndex;
            return (
              <SvgText
                key={row.month}
                x={xAt(index)}
                y={HEIGHT - 8}
                fontSize={10}
                fill="#94a3b8"
                textAnchor={index === 0 ? 'start' : isLast ? 'end' : 'middle'}
              >
                {monthLabel(row.month, { short: true, withYear: false })}
              </SvgText>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height: HEIGHT }} />
      )}
    </View>
  );
}
