'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const R=require('../report-core.js');
const P=require('../report-pdf.js');

const mv=(id,type,vehicle,litres,time,owner,extra={},pending=false)=>({key:'movement:'+id,kind:'movement',owner_id:owner,vehicle,pending,
 payload:{id,type,vehicle,tank:1,litres,loss:0,time,...extra}});
const visit=(id,owner,client,discharges,extra={})=>({key:'visit:'+id,kind:'visit',owner_id:owner,vehicle:'camion',payload:{id,client,discharges,...extra}});
const base={date:'2026-11-17',names:{alm:'Ana',rep1:'Iván',rep2:'Nacho',ger:'José'}};
const day=[
 mv('c1','CARGA','camion',400,'2026-11-17T06:10:00Z','alm',{loss:10}),
 mv('c2','CARGA','furgoneta',300,'2026-11-17T06:20:00Z','ger'),
 mv('d1','DESCARGA','camion',120,'2026-11-17T09:00:00Z','rep1',{visitId:'v1'}),
 mv('d2','DESCARGA','furgoneta',80,'2026-11-17T10:00:00Z','rep2',{visitId:'v2'}),
 visit('v1','rep1','Bar Uno',[{id:'d1',dest:'2'}]),
 visit('v2','rep2','Bar Dos',[{id:'d2',dest:'1'}]),
];

test('Gerencia: subtotales por vehículo y total general',()=>{
 const r=R.buildDailyReport(day,{...base,scope:'gerencia'});
 const [cam,fur]=r.vehicles;
 assert.equal(cam.totals.loads,400);assert.equal(cam.totals.discharges,120);assert.equal(cam.totals.difference,280);assert.equal(cam.totals.loss,10);
 assert.equal(fur.totals.loads,300);assert.equal(fur.totals.discharges,80);
 assert.equal(r.totals.loads,700);assert.equal(r.totals.discharges,200);assert.equal(r.totals.difference,500);
 assert.equal(cam.discharges[0].client,'Bar Uno');assert.equal(cam.discharges[0].destTank,'2');
 assert.equal(fur.loads[0].author,'José','la actividad de Gerencia como operario se incluye con su autor');
 assert.equal(r.provisional,false);
});

test('Día sin movimientos',()=>{
 const r=R.buildDailyReport(day,{...base,date:'2026-11-16',scope:'gerencia'});
 assert.equal(r.empty,true);assert.equal(r.totals.loads,0);
});

test('Sin duplicados: pendiente y confirmado con la misma clave cuentan una vez',()=>{
 const r=R.buildDailyReport([...day,{...day[0],pending:true}],{...base,scope:'gerencia'});
 assert.equal(r.vehicles[0].loads.length,1);assert.equal(r.totals.loads,700);
 assert.equal(r.provisional,true,'operación sin sincronizar marca el informe como provisional');
});

test('Descarga corregida usa el valor vigente y queda señalada',()=>{
 const recs=day.map(x=>x.key==='visit:v1'?visit('v1','rep1','Bar Uno',[{id:'d1',dest:'2'}],{corrections:[{dischargeId:'d1'}]}):x);
 const r=R.buildDailyReport(recs,{...base,scope:'gerencia'});
 assert.equal(r.vehicles[0].discharges[0].status,'Corregida');assert.equal(r.vehicles[0].totals.discharges,120);
});

test('Anulación pendiente: se señala y no se resta automáticamente',()=>{
 const recs=day.map(x=>x.key==='movement:d1'?mv('d1','DESCARGA','camion',120,'2026-11-17T09:00:00Z','rep1',{visitId:'v1',cancelled:true}):x);
 const r=R.buildDailyReport(recs,{...base,scope:'gerencia'});
 assert.equal(r.vehicles[0].discharges[0].status,'Anulada');
 assert.equal(r.totals.discharges,200);assert.equal(r.totals.cancelled,120);
 assert.ok(r.notes.some(n=>n.includes('anuladas')));
});

test('Visita que cruza medianoche: cada descarga cuenta en su día (Europe/Madrid)',()=>{
 const recs=[mv('n1','DESCARGA','camion',50,'2026-11-17T22:50:00Z','rep1',{visitId:'vn'}),mv('n2','DESCARGA','camion',60,'2026-11-17T23:10:00Z','rep1',{visitId:'vn'})];
 assert.equal(R.buildDailyReport(recs,{...base,scope:'gerencia'}).totals.discharges,50,'23:50 en Madrid es el 17');
 assert.equal(R.buildDailyReport(recs,{...base,date:'2026-11-18',scope:'gerencia'}).totals.discharges,60,'00:10 en Madrid es el 18');
});

test('Horario de verano: 22:30 UTC del 30/06 es el 01/07 en Madrid',()=>{
 assert.equal(R.madridDay('2026-06-30T22:30:00Z'),'2026-07-01');
 assert.equal(R.madridDay('2026-12-31T22:30:00Z'),'2026-12-31');
});

test('Almacén solo ve sus cargas; Reparto solo sus descargas',()=>{
 const a=R.buildDailyReport(day,{...base,scope:'almacen',account:'alm'});
 assert.equal(a.totals.loadCount,1);assert.equal(a.totals.dischargeCount,0);assert.equal(a.showDischarges,false);
 const r1=R.buildDailyReport(day,{...base,scope:'reparto',account:'rep1'});
 assert.equal(r1.totals.dischargeCount,1);assert.equal(r1.totals.loadCount,0);assert.equal(r1.vehicles[0].discharges[0].client,'Bar Uno');
 const other=R.buildDailyReport(day,{...base,scope:'reparto',account:'nadie'});
 assert.equal(other.empty,true,'sin acceso a descargas ajenas');
 const noAuthor=R.buildDailyReport([{...day[2],owner_id:null}],{...base,scope:'reparto',account:'rep1'});
 assert.equal(noAuthor.empty,true,'sin autor fiable no se atribuye a nadie');
});

test('Gerencia filtra por operario y por vehículo',()=>{
 const byOp=R.buildDailyReport(day,{...base,scope:'gerencia',operator:'rep2'});
 assert.equal(byOp.totals.discharges,80);assert.equal(byOp.totals.loads,0);assert.equal(byOp.operator,'Nacho');
 const byVeh=R.buildDailyReport(day,{...base,scope:'gerencia',vehicle:'furgoneta'});
 assert.equal(byVeh.vehicles.length,1);assert.equal(byVeh.totals.loads,300);
});

test('Ámbito sin rol válido no devuelve datos',()=>{
 assert.equal(R.buildDailyReport(day,{...base,scope:'pendiente'}).empty,true);
});

test('PDF válido, multipágina y sin modificar los registros',()=>{
 const recs=[...day];for(let i=0;i<120;i++)recs.push(mv('x'+i,'DESCARGA','camion',1,'2026-11-17T12:00:00Z','rep1',{visitId:'v1'}));
 const before=JSON.stringify(recs);
 const rep=R.buildDailyReport(recs,{...base,scope:'gerencia',provisionalReasons:['Prueba']});
 const bytes=P.renderReport(rep,R);
 const text=Buffer.from(bytes).toString('latin1');
 assert.ok(text.startsWith('%PDF-1.4'));assert.ok(text.trimEnd().endsWith('%%EOF'));
 const pages=Number(/\/Count (\d+)/.exec(text)[1]);assert.ok(pages>=3,'tabla larga se reparte en varias páginas');
 assert.ok(text.includes('PROVISIONAL'));assert.ok(text.includes('P\xe1gina 1 de '+pages));
 assert.equal(JSON.stringify(recs),before);
 assert.equal(R.fileName('2026-11-17'),'VISURA_TANQUES_MOVIMIENTOS_2026-11-17.pdf');
});

test('El informe solo lee: la fuente de nube no expone escritura',()=>{
 const cloud=fs.readFileSync(path.join(__dirname,'..','cloud-sync.js'),'utf8');
 const fn=cloud.slice(cloud.indexOf('function reportSource'),cloud.indexOf('async function loadMembers'));
 assert.doesNotMatch(fn,/meta\.pending\s*=|delete |tx\(|save\(|sync\(/);
});

test('Título del informe general con la etiqueta Operaciones',()=>{
 const r=R.buildDailyReport(day,{...base,scope:'gerencia'});
 assert.equal(r.title,'Informe general — Operaciones');
 assert.ok(!JSON.stringify(r).includes('Gerencia'));
});

test('Informe diario por vehículo: solo ese vehículo y archivo propio',()=>{
 const r=R.buildDailyReport(day,{...base,scope:'gerencia',vehicle:'camion'});
 assert.equal(r.vehicleId,'camion');assert.equal(r.vehicleFilter,'Camión');
 assert.ok(r.vehicles.every(v=>v.id==='camion'));
 assert.equal(R.fileName(r.date,r.vehicleId),'VISURA_TANQUES_MOVIMIENTOS_2026-11-17_CAMION.pdf');
 assert.equal(R.fileName('2026-11-17','furgoneta'),'VISURA_TANQUES_MOVIMIENTOS_2026-11-17_FURGONETA.pdf');
 assert.equal(R.fileName('2026-11-17','otro'),'VISURA_TANQUES_MOVIMIENTOS_2026-11-17.pdf');
});
