'use strict';
// Piloto LAB · línea 300 · caracterización de main 1420493cd681 (0.10.9).
// No cambia la aplicación. Fija el comportamiento actual: la planificación no
// ofrece clientes R2 pendientes (id VT315-#### o visura315SourceId).
// No acredita la corrección VISURA-315-CP-PLANIFICACION-R2. Datos ficticios.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function between(startName, endName) {
  const start = source.indexOf('function ' + startName);
  const end = source.indexOf('function ' + endName, start + 1);
  assert.ok(start >= 0, 'falta function ' + startName);
  assert.ok(end > start, 'no se acota ' + startName + ' antes de ' + endName);
  return source.slice(start, end);
}

function extractFunction(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'falta function ' + name);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  assert.fail('función sin cerrar: ' + name);
}

const sandbox = vm.createContext(Object.create(null));
vm.runInContext(
  `'use strict';
  const WEEKDAYS=['Lunes','Martes','Miércoles','Jueves','Viernes'];
  let planDay=0;
  const state={customers:[],receivedPlans:{},vehicle:'camion'};
  ${extractFunction('isR2PendingRoute')}
  ${extractFunction('normalizeCustomer')}
  ${extractFunction('isR2PendingName')}
  ${extractFunction('isR2PendingPlan')}
  ${extractFunction('plannedCustomers')}
  ${extractFunction('plannedEntriesForVehicle')}
  globalThis.__plan = {
    catalog(customers, day){ state.customers = customers; planDay = day; },
    vehicle(vehicle){ state.vehicle = vehicle; },
    received(plans){ state.receivedPlans = plans; },
    plannedIds(){ return plannedCustomers().map(c => c.id); },
    route(c){ return isR2PendingRoute(c); },
    plan(e){ return isR2PendingPlan(e); },
    receivedIds(){ return plannedEntriesForVehicle().map(e => e.customerId); }
  };`,
  sandbox
);
function asList(value) {
  return Array.from(value);
}
const plan = sandbox.__plan;

const ficticios = [
  { id: 'zzh-001', nombre: 'Cervecería Ficticia ZZH', poblacion: 'Laboratorio', reparto: ['Lunes'] },
  { id: 'zzh-002', nombre: 'Bar Ficticio Sin Día', poblacion: 'Laboratorio', reparto: [] },
  { id: 'VT315-0001', nombre: 'Cliente R2 Numerado', poblacion: 'Laboratorio', reparto: ['Lunes'] },
  { id: 'local-9', nombre: 'Cliente R2 Con Origen', poblacion: 'Laboratorio', visura315SourceId: 'origen-ficticio', reparto: ['Lunes'] },
  { id: 'VT315-99', nombre: 'Id Casi R2', poblacion: 'Laboratorio', reparto: ['Martes'] }
];

test('un cliente operativo ficticio sigue siendo planificable', () => {
  plan.catalog(ficticios, 0);
  const ids = plan.plannedIds();
  assert.ok(ids.includes('zzh-001'));
  assert.equal(ids.includes('VT315-0001'), false);
  assert.equal(ids.includes('local-9'), false);
});

test('el lunes lista habituales primero y excluye solo los R2 pendientes', () => {
  plan.catalog(ficticios, 0);
  assert.deepEqual(asList(plan.plannedIds()), ['zzh-001', 'zzh-002', 'VT315-99']);
});

test('cambiar de día no vuelve a mostrar los R2 pendientes', () => {
  plan.catalog(ficticios, 1);
  assert.deepEqual(asList(plan.plannedIds()), ['VT315-99', 'zzh-002', 'zzh-001']);
});

test('catálogo vacío o ausente no inventa clientes', () => {
  plan.catalog([], 0);
  assert.deepEqual(asList(plan.plannedIds()), []);
  plan.catalog(null, 0);
  assert.deepEqual(asList(plan.plannedIds()), []);
});

test('la marca R2 es el id VT315 de cuatro dígitos o un origen 315', () => {
  assert.equal(plan.route(null), false);
  assert.equal(plan.route({ id: 'zzh-001' }), false);
  assert.equal(plan.route({ id: 'VT315-0001' }), true);
  assert.equal(plan.route({ id: 'VT315-99' }), false);
  assert.equal(plan.route({ id: 'vt315-0001' }), false);
  assert.equal(plan.route({ id: 'local-9', visura315SourceId: 'origen-ficticio' }), true);
  assert.equal(plan.route({ id: 'local-9', visura315SourceId: '' }), false);
});

test('una entrega R2 queda pendiente aunque el catálogo también tenga operativos', () => {
  plan.catalog(ficticios, 0);
  assert.equal(plan.plan({ customerId: 'VT315-0001' }), true);
  assert.equal(plan.plan({ customerId: 'local-9', visura315SourceId: 'origen-ficticio' }), true);
  assert.equal(plan.plan({ customerId: 'zzh-001', client: 'Cervecería Ficticia ZZH' }), false);
  assert.equal(plan.plan({ customerId: 'otro', client: 'Cliente R2 Numerado' }), true);
});

test('el plan recibido del vehículo oculta la entrega R2 y conserva la operativa', () => {
  plan.catalog(ficticios, 0);
  plan.vehicle('camion');
  plan.received({
    semana: {
      vehicle: 'camion',
      entries: [
        { customerId: 'VT315-0001' },
        { customerId: 'zzh-001' }
      ]
    },
    otra: { vehicle: 'furgoneta', entries: [{ customerId: 'zzh-002' }] }
  });
  assert.deepEqual(asList(plan.receivedIds()), ['zzh-001']);
});

test('el código de planificación no ofrece un atajo para listar R2', () => {
  const planned = extractFunction('plannedCustomers');
  assert.match(planned, /\.filter\(c=>!isR2PendingRoute\(c\)\)/);
  const page = between('plannerPage()', 'saveBulkPlan()');
  assert.match(page, /all=plannedCustomers\(\)/);
  assert.match(page, /Mostrar todo el catálogo \(\$\{all\.length\}\)/);
  assert.doesNotMatch(page, /state\.customers\.filter/);
});

test('guardar o exportar un R2 pendiente sigue bloqueado', () => {
  assert.match(between('saveBulkPlan()', 'savePlan()'), /isR2PendingRoute\(c\)\)return toast\('Cliente R2 pendiente de validación operativa'\)/);
  assert.match(between('savePlan()', 'deletePlan('), /isR2PendingRoute\(c\)\|\|isR2PendingRoute\(\{id:customerId\}\)\)return toast\('Cliente R2 pendiente de validación operativa'\)/);
  assert.match(between('exportPlan(vehicle)', 'reportScope()'), /entries\.some\(isR2PendingPlan\)\)return toast\('Plan bloqueado: contiene clientes R2 pendientes de validación'\)/);
});

test('el catálogo de Gerencia sigue mostrando la ficha R2; la planificación no', () => {
  const catalogo = between('customerPage()', 'saveCustomer()');
  assert.match(catalogo, /data-catalog-r2=/);
  assert.match(catalogo, /isR2PendingRoute\(x\)/);
  assert.match(between('plannedEntriesForVehicle()', 'visitSelectionPage()'), /\.filter\(e=>!isR2PendingPlan\(e\)\)/);
});
