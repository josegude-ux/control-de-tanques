'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('function tankListR41(');
const end=source.indexOf('// R5 LAB:',start)>0?source.indexOf('// R5 LAB:',start):source.indexOf('function home()',start);
assert.ok(start>=0&&end>start,'R4.1 renderer exists');
const ctx={fmt:n=>Number(n).toLocaleString('es-ES',{maximumFractionDigits:2})};
vm.runInNewContext(source.slice(start,end),ctx);
test('validated values render precise liters and percentage',()=>{
 const html=ctx.tankListR41([960,0], 'camion', true, []);
 assert.match(html,/960 L/);
 assert.match(html,/96 % de capacidad/);
 assert.match(html,/0 % de capacidad/);
 assert.match(html,/Total disponible/);
 assert.equal((html.match(/role="progressbar"/g)||[]).length,2);
});
test('pending stock never displays unvalidated figures or bars',()=>{
 const html=ctx.tankListR41([960], 'camion', false, []);
 assert.doesNotMatch(html,/960 L|96 %|progressbar|Total disponible/);
 assert.match(html,/Saldo no validado/);
});
test('conflict hides balances and percentages',()=>{
 const html=ctx.tankListR41([960], 'camion', true, ['conflict']);
 assert.doesNotMatch(html,/960 L|progressbar/);
});
test('invalid data cannot be shown as validated',()=>{
 const html=ctx.tankListR41([NaN,-1,1001], 'camion', true, []);
 assert.doesNotMatch(html,/progressbar|Total disponible/);
});
test('empty vehicle state is explicit',()=>{
 assert.match(ctx.tankListR41([], 'furgoneta', true, []),/No hay existencias disponibles/);
});
