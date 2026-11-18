'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../role-rules.js');

const open={id:'v1',vehicle:'camion',discharges:[]};

test('Reparto con descarga abierta: no puede cargar su propio vehículo',()=>{
 assert.equal(R.openVisitBlocksLoad({role:'reparto',vehicle:'camion',openVisit:open}),true);
});

test('Reparto con descarga abierta en otro vehículo: no bloquea',()=>{
 assert.equal(R.openVisitBlocksLoad({role:'reparto',vehicle:'furgoneta',openVisit:open}),false);
 assert.equal(R.openVisitBlocksLoad({role:'reparto',vehicle:'camion',openVisit:open},'furgoneta'),false);
});

test('Gerencia y Almacén nunca quedan bloqueados por visitas abiertas',()=>{
 for(const role of ['gerencia','almacen']){
  assert.equal(R.openVisitBlocksLoad({role,vehicle:'camion',openVisit:open}),false,role);
  assert.equal(R.openVisitLocksLoadVehicle({role,vehicle:'camion',openVisit:open}),false,role);
 }
});

test('Sin visita abierta no hay bloqueo',()=>{
 assert.equal(R.openVisitBlocksLoad({role:'reparto',vehicle:'camion',openVisit:null}),false);
 assert.equal(R.openVisitLocksLoadVehicle({role:'reparto',openVisit:null}),false);
 assert.equal(R.openVisitBlocksLoad(null),false);
});

test('Reparto con descarga abierta queda anclado a su vehículo en el selector de carga',()=>{
 assert.equal(R.openVisitLocksLoadVehicle({role:'reparto',vehicle:'camion',openVisit:open}),true);
});

test('Etiqueta visible de gerencia: Operaciones (rol interno sin cambios)',()=>{
 assert.equal(R.roleLabel('gerencia'),'Operaciones');
 assert.equal(R.roleLabel('almacen'),'Almacén');
 assert.equal(R.roleLabel('reparto'),'Reparto');
 assert.ok('gerencia' in R.ROLE_LABELS,'la clave interna sigue siendo gerencia');
 assert.equal(R.roleLabel('otro'),'otro');
});

test('relabel: textos heredados y del historial guardado',()=>{
 assert.equal(R.relabel('Solo Gerencia puede ajustar existencias'),'Solo Operaciones puede ajustar existencias');
 assert.equal(R.relabel('Ajuste de existencias · Gerencia'),'Ajuste de existencias · Operaciones');
 assert.equal(R.relabel('PENDIENTE DE GERENCIA'),'PENDIENTE DE OPERACIONES');
 assert.equal(R.relabel('rol gerencia interno'),'rol gerencia interno','minúsculas (claves internas) intactas');
 assert.equal(R.relabel('Gerencial'),'Gerencial','solo palabra completa');
 assert.equal(R.relabel(''),'');assert.equal(R.relabel(null),null);
});
