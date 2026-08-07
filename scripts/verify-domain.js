/**
 * Verificación de la lógica de dominio: amortización y proyección.
 *
 * Correr con `npm run test:domain`, que primero compila `src/domain/*.ts` a
 * `.domain-build/` y después ejecuta este archivo.
 *
 * Es a propósito un script plano sin framework de tests: el dominio es TypeScript
 * puro, sin React ni SQLite, así que corre en Node tal cual y no hace falta traer
 * jest, babel-jest ni un entorno de React Native sólo para verificar aritmética.
 *
 * Lo que se cubre acá es justo lo que más duele si se rompe: que el capital de una
 * deuda cierre exacto pese a los redondeos, y que la proyección no cuente dos
 * veces el mismo sueldo ni pierda una cuota vencida.
 */
const { buildSchedule, scheduleTotals, monthlyPayment, impliedAnnualRate } = require('../.domain-build/amortization.js');
const { buildProjection } = require('../.domain-build/projection.js');

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n       esperado: ${JSON.stringify(expected)}\n       obtenido: ${JSON.stringify(actual)}`); }
}
function checkTrue(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label} ${detail}`); }
}

console.log('\n=== AMORTIZACIÓN ===');

// 1. Sin interés, divisible exacto.
let s = buildSchedule({ principal: 1200000, annualRate: 0, installmentsTotal: 12, startMonth: '2026-09' });
check('sin interés: 12 cuotas', s.length, 12);
check('sin interés: cuota = 100.000', s[0].amount, 100000);
check('sin interés: capital cierra', s.reduce((a, r) => a + r.principalPart, 0), 1200000);
check('sin interés: interés cero', s.reduce((a, r) => a + r.interestPart, 0), 0);
check('sin interés: saldo final 0', s[11].balanceAfter, 0);
check('sin interés: primer vencimiento', s[0].dueDate, '2026-09-05');
check('sin interés: último vencimiento', s[11].dueDate, '2027-08-05');

// 2. Sin interés, NO divisible: el reparto debe cerrar exacto igual.
s = buildSchedule({ principal: 1000000, annualRate: 0, installmentsTotal: 7, startMonth: '2026-09' });
check('reparto no divisible: capital cierra', s.reduce((a, r) => a + r.principalPart, 0), 1000000);
check('reparto no divisible: saldo final 0', s[6].balanceAfter, 0);
checkTrue('reparto no divisible: cuotas difieren máx 1', Math.max(...s.map(r => r.amount)) - Math.min(...s.map(r => r.amount)) <= 1);

// 3. Con interés (sistema francés).
s = buildSchedule({ principal: 2000000, annualRate: 18, installmentsTotal: 24, startMonth: '2026-09' });
check('francés: 24 cuotas', s.length, 24);
check('francés: capital cierra exacto', s.reduce((a, r) => a + r.principalPart, 0), 2000000);
check('francés: saldo final 0', s[23].balanceAfter, 0);
checkTrue('francés: interés total > 0', s.reduce((a, r) => a + r.interestPart, 0) > 0);
checkTrue('francés: interés decrece', s[0].interestPart > s[23].interestPart);
checkTrue('francés: capital crece', s[0].principalPart < s[23].principalPart);
const pago = monthlyPayment(2000000, 18, 24);
checkTrue('francés: cuota ~99.850', Math.abs(pago - 99850) < 500, `cuota=${pago}`);
checkTrue('francés: amount = capital + interés', s.every(r => r.amount === r.principalPart + r.interestPart));

// 4. Cuota conocida.
s = buildSchedule({ principal: 500000, annualRate: 0, installmentsTotal: 12, startMonth: '2026-09', fixedInstallment: 50000 });
let t = scheduleTotals(s);
check('cuota fija: total a pagar', t.totalToPay, 600000);
check('cuota fija: interés = 100.000', t.totalInterest, 100000);
check('cuota fija: capital cierra', t.totalPrincipal, 500000);

// 5. Tasa implícita.
const tasa = impliedAnnualRate(500000, 50000, 12);
checkTrue('tasa implícita 500k→12x50k ≈ 35%', tasa > 30 && tasa < 42, `tasa=${tasa}`);
check('tasa implícita sin interés = 0', impliedAnnualRate(600000, 50000, 12), 0);

// 6. Borde: tasa altísima no debe dejar capital sin amortizar ni colgarse.
s = buildSchedule({ principal: 1000000, annualRate: 400, installmentsTotal: 24, startMonth: '2026-09' });
checkTrue('tasa 400%: capital cierra', s.reduce((a, r) => a + r.principalPart, 0) === 1000000, `suma=${s.reduce((a, r) => a + r.principalPart, 0)}`);
check('tasa 400%: saldo final 0', s[s.length - 1].balanceAfter, 0);

// 7. Borde: día 31 se recorta en meses cortos.
s = buildSchedule({ principal: 300000, annualRate: 0, installmentsTotal: 3, startMonth: '2027-01', dayOfMonth: 31 });
check('día 31 en enero', s[0].dueDate, '2027-01-31');
check('día 31 recortado en febrero', s[1].dueDate, '2027-02-28');
check('día 31 en marzo', s[2].dueDate, '2027-03-31');

// 8. Borde: una sola cuota, y cero cuotas.
check('1 cuota: monto completo', buildSchedule({ principal: 90000, annualRate: 0, installmentsTotal: 1, startMonth: '2026-09' })[0].amount, 90000);
check('0 cuotas: tabla vacía', buildSchedule({ principal: 90000, annualRate: 0, installmentsTotal: 0, startMonth: '2026-09' }).length, 0);
check('principal 0: tabla vacía', buildSchedule({ principal: 0, annualRate: 5, installmentsTotal: 12, startMonth: '2026-09' }).length, 0);

console.log('\n=== PROYECCIÓN ===');
const REF_MONTH = '2026-08';
const REF_DAY = 7;
const base = {
  startMonth: REF_MONTH,
  months: 6,
  openingBalance: 1000000,
  actuals: new Map(),
  recurring: [],
  pendingInstallments: [],
  materializedRules: new Set(),
  referenceMonth: REF_MONTH,
  referenceDay: REF_DAY,
};
const rule = (o) => ({ id: 1, name: 'x', type: 'income', amount: 0, categoryId: null, dayOfMonth: 15, startMonth: '2020-01', endMonth: null, active: true, createdAt: '', ...o });
const cuota = (o) => ({ id: 1, debtId: 1, number: 1, dueMonth: REF_MONTH, dueDate: `${REF_MONTH}-05`, amount: 0, principalPart: 0, interestPart: 0, paid: false, paidAt: null, transactionId: null, ...o });

// 1. Sin datos: saldo constante.
let p = buildProjection(base);
check('vacío: saldo constante', p.rows.map(r => r.closingBalance), Array(6).fill(1000000));
check('vacío: sin mes negativo', p.firstNegativeMonth, null);

// 2. Sueldo y arriendo fijos: crecimiento lineal.
p = buildProjection({ ...base, recurring: [
  rule({ id: 1, type: 'income', amount: 900000, dayOfMonth: 30 }),
  rule({ id: 2, type: 'expense', amount: 400000, dayOfMonth: 10 }),
]});
check('fijos: neto mensual 500.000', p.rows.map(r => r.net), Array(6).fill(500000));
check('fijos: saldo acumula', p.rows[5].closingBalance, 1000000 + 500000 * 6);

// 3. Mes en curso: lo que ya venció y no se registró NO se proyecta.
p = buildProjection({ ...base, months: 2, recurring: [
  rule({ id: 1, type: 'expense', amount: 100000, dayOfMonth: 3 }),   // día 3 < hoy 7 → se ignora este mes
  rule({ id: 2, type: 'expense', amount: 200000, dayOfMonth: 20 }),  // día 20 > hoy 7 → se proyecta
]});
check('mes en curso: sólo lo no vencido', p.rows[0].expense, 200000);
check('mes siguiente: todo cuenta', p.rows[1].expense, 300000);

// 4. Regla ya materializada: no se cuenta dos veces.
p = buildProjection({ ...base, months: 1,
  recurring: [rule({ id: 7, type: 'income', amount: 900000, dayOfMonth: 30 })],
  actuals: new Map([[REF_MONTH, { income: 900000, expense: 0 }]]),
  materializedRules: new Set([`${REF_MONTH}:7`]),
});
check('materializada: no duplica', p.rows[0].income, 900000);

// 4b. Misma situación sin marcar como materializada: se duplicaría (control).
p = buildProjection({ ...base, months: 1,
  recurring: [rule({ id: 7, type: 'income', amount: 900000, dayOfMonth: 30 })],
  actuals: new Map([[REF_MONTH, { income: 900000, expense: 0 }]]),
});
check('control: sin marca se suma dos veces', p.rows[0].income, 1800000);

// 5. Mes pasado: sólo lo real, nada planificado.
p = buildProjection({ ...base, startMonth: '2026-06', months: 3,
  recurring: [rule({ id: 1, type: 'expense', amount: 500000, dayOfMonth: 10 })],
  actuals: new Map([['2026-06', { income: 100000, expense: 20000 }]]),
});
check('mes pasado: es pasado', p.rows[0].isPast, true);
check('mes pasado: sólo real', [p.rows[0].income, p.rows[0].expense], [100000, 20000]);
check('mes en curso: marcado', p.rows[2].isCurrent, true);

// 6. Cuotas: se suman al mes que vencen.
p = buildProjection({ ...base, months: 3, pendingInstallments: [
  cuota({ id: 1, dueMonth: '2026-09', amount: 150000 }),
  cuota({ id: 2, dueMonth: '2026-10', amount: 150000 }),
]});
check('cuotas: mes actual sin cuota', p.rows[0].debtPayments, 0);
check('cuotas: septiembre', p.rows[1].debtPayments, 150000);
check('cuotas: octubre', p.rows[2].debtPayments, 150000);

// 7. Cuota vencida impaga: se arrastra al mes en curso, no se pierde.
p = buildProjection({ ...base, months: 2, pendingInstallments: [
  cuota({ id: 1, dueMonth: '2026-05', amount: 80000 }),
  cuota({ id: 2, dueMonth: '2026-06', amount: 80000 }),
]});
check('mora: contadas', p.overdue.count, 2);
check('mora: monto', p.overdue.amount, 160000);
check('mora: cargada al mes en curso', p.rows[0].debtPayments, 160000);
check('mora: no se repite el mes siguiente', p.rows[1].debtPayments, 0);

// 8. Cruce a negativo detectado en el mes correcto.
p = buildProjection({ ...base, openingBalance: 100000, months: 4,
  recurring: [rule({ id: 1, type: 'expense', amount: 60000, dayOfMonth: 20 })],
});
// cierres: 40.000 / -20.000 / -80.000 / -140.000
check('negativo: primer mes bajo cero', p.firstNegativeMonth, '2026-09');
check('negativo: cierres', p.rows.map(r => r.closingBalance), [40000, -20000, -80000, -140000]);

// 9. Vigencia de reglas: fuera de rango no cuenta.
p = buildProjection({ ...base, months: 3, recurring: [
  rule({ id: 1, type: 'income', amount: 500000, dayOfMonth: 20, startMonth: '2026-09' }),
  rule({ id: 2, type: 'income', amount: 300000, dayOfMonth: 20, endMonth: '2026-09' }),
  rule({ id: 3, type: 'income', amount: 700000, dayOfMonth: 20, active: false }),
]});
check('vigencia: agosto (sólo la 2)', p.rows[0].income, 300000);
check('vigencia: septiembre (1 y 2)', p.rows[1].income, 800000);
check('vigencia: octubre (sólo la 1)', p.rows[2].income, 500000);

// 10. Coherencia: opening/closing encadenan y net = ingresos − egresos.
p = buildProjection({ ...base, months: 6,
  recurring: [rule({ id: 1, type: 'income', amount: 900000, dayOfMonth: 20 }), rule({ id: 2, type: 'expense', amount: 350000, dayOfMonth: 20 })],
  pendingInstallments: [cuota({ id: 1, dueMonth: '2026-10', amount: 120000 })],
});
checkTrue('coherencia: closing = opening + net', p.rows.every(r => r.closingBalance === r.openingBalance + r.net));
checkTrue('coherencia: opening encadena', p.rows.every((r, i) => i === 0 || r.openingBalance === p.rows[i - 1].closingBalance));
checkTrue('coherencia: net = ingresos − egresos', p.rows.every(r => r.net === r.income - r.expense));
checkTrue('coherencia: cuotas dentro de egresos', p.rows.every(r => r.expense >= r.debtPayments));
check('coherencia: saldo final = finalBalance', p.rows[5].closingBalance, p.finalBalance);
check('coherencia: totales suman', p.totals.net, p.rows.reduce((a, r) => a + r.net, 0));

console.log(`\n${pass} ok, ${fail} fallas\n`);
process.exit(fail > 0 ? 1 : 0);
