/* Informe diario de cargas y descargas (VISURA 300 CP-030 R2).
   Lógica pura, sin DOM ni red: compartida con las pruebas de Node.
   Solo lee registros; nunca crea movimientos ni modifica saldos o colas. */
(function(root){
 'use strict';
 // Nombres visibles de perfil: única fuente en role-rules.js.
 const Roles=typeof module==='object'&&module.exports?require('./role-rules.js'):root.TankRoles;
 const ops=()=>Roles.roleLabel('gerencia');
 const VEHICLES=['camion','furgoneta'];
 const VEHICLE_NAMES={camion:'Camión',furgoneta:'Furgoneta'};
 const TZ='Europe/Madrid';
 const round=n=>{const v=Math.round(Number(n)*100)/100;return Number.isFinite(v)?v:0;};
 const parts=(iso,opts)=>{const d=new Date(iso);if(!iso||Number.isNaN(d.getTime()))return null;
  return Object.fromEntries(new Intl.DateTimeFormat('es-ES',{timeZone:TZ,...opts}).formatToParts(d).map(p=>[p.type,p.value]));};
 /** Día natural en Europe/Madrid (YYYY-MM-DD), con horario de verano/invierno. */
 function madridDay(iso){const p=parts(iso,{year:'numeric',month:'2-digit',day:'2-digit'});return p?`${p.year}-${p.month}-${p.day}`:'';}
 function madridTime(iso){const p=parts(iso,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});return p?`${p.hour}:${p.minute}`:'—';}
 function madridStamp(iso){const p=parts(iso,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});return p?`${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`:'—';}
 const shortRef=id=>String(id||'').slice(0,8)||'—';

 /**
  * records: [{key,kind,owner_id,vehicle,payload,deleted,pending}]
  * opts: {date:'YYYY-MM-DD', scope:'gerencia'|'almacen'|'reparto', account, operator, vehicle,
  *        names:{[user_id]:nombre}, provisionalReasons:[texto], generatedAt, cutoff}
  */
 function buildDailyReport(records,opts){
  const o={operator:'',vehicle:'',names:{},provisionalReasons:[],...opts};
  // Deduplicar por clave estable: una fila pendiente sustituye a la confirmada de la misma clave.
  const byKey=new Map();
  for(const r of records||[]){if(!r?.key)continue;const prev=byKey.get(r.key);if(!prev||r.pending)byKey.set(r.key,r);}
  const all=[...byKey.values()];
  const visits=new Map(all.filter(r=>r.kind==='visit'&&r.payload?.id).map(r=>[r.payload.id,r]));
  const author=r=>r.owner_id?(o.names[r.owner_id]||('Usuario '+String(r.owner_id).slice(0,6))):'Autor no verificable';
  const inScope=(r,type)=>{
   if(o.scope==='almacen')return type==='CARGA'&&!!r.owner_id&&r.owner_id===o.account;
   if(o.scope==='reparto')return type==='DESCARGA'&&!!r.owner_id&&r.owner_id===o.account;
   if(o.scope==='gerencia')return !o.operator||r.owner_id===o.operator;
   return false;
  };
  const vehicles={};
  for(const v of VEHICLES)vehicles[v]={id:v,name:VEHICLE_NAMES[v],loads:[],discharges:[]};
  const unknownVehicle=[];let pendingInScope=0;
  for(const r of all){
   if(r.kind!=='movement'||r.deleted)continue;
   const p=r.payload||{},type=p.type;
   if(type!=='CARGA'&&type!=='DESCARGA')continue;
   if(madridDay(p.time)!==o.date)continue;
   if(!inScope(r,type))continue;
   const vehicle=p.vehicle||r.vehicle;
   if(o.vehicle&&vehicle!==o.vehicle)continue;
   if(!vehicles[vehicle]){unknownVehicle.push(r.key);continue;}
   if(r.pending)pendingInScope++;
   if(type==='CARGA'){
    vehicles[vehicle].loads.push({id:p.id,time:p.time,hour:madridTime(p.time),tank:p.tank,litres:round(p.litres),loss:round(p.loss),
     author:author(r),ownerId:r.owner_id||null,ref:shortRef(p.id),pending:!!r.pending,cisternPending:!!p.cisternPending});
   }else{
    const visitRow=visits.get(p.visitId),visit=visitRow?.payload||null;
    const d=visit?.discharges?.find(x=>x.id===p.id)||null;
    const corrected=!!visit?.corrections?.some(c=>c.dischargeId===p.id||c.id===p.id);
    const cancelled=!!(p.cancelled||visit?.cancelledAt);
    const status=cancelled?'Anulada':corrected?'Corregida':'';
    vehicles[vehicle].discharges.push({id:p.id,time:p.time,hour:madridTime(p.time),client:visit?.client||'Cliente no disponible',
     sourceTank:p.tank,destTank:d?.dest??'—',litres:round(p.litres),visitRef:shortRef(p.visitId),ref:shortRef(p.id),
     author:author(r),ownerId:r.owner_id||null,status,cancelled,pending:!!r.pending});
   }
  }
  const sum=(xs,f)=>round(xs.reduce((a,x)=>a+f(x),0));
  const totals={loads:0,loss:0,discharges:0,cancelled:0,loadCount:0,dischargeCount:0};
  for(const v of VEHICLES){
   const x=vehicles[v];
   x.loads.sort((a,b)=>String(a.time).localeCompare(String(b.time)));
   x.discharges.sort((a,b)=>String(a.time).localeCompare(String(b.time)));
   x.totals={loads:sum(x.loads,l=>l.litres),loss:sum(x.loads,l=>l.loss),discharges:sum(x.discharges,d=>d.litres),
    cancelled:sum(x.discharges.filter(d=>d.cancelled),d=>d.litres),loadCount:x.loads.length,dischargeCount:x.discharges.length};
   x.totals.difference=round(x.totals.loads-x.totals.discharges);
   for(const k of Object.keys(totals))totals[k]=round(totals[k]+x.totals[k]);
  }
  totals.difference=round(totals.loads-totals.discharges);
  const reasons=[...o.provisionalReasons];
  if(pendingInScope)reasons.push(`${pendingInScope} operación(es) de este informe aún no están sincronizadas.`);
  const notes=[];
  if(totals.cancelled)notes.push(`Incluye ${totals.cancelled.toLocaleString('es-ES')} L de descargas anuladas pendientes de conciliación por ${ops()}.`);
  if(unknownVehicle.length)notes.push(`${unknownVehicle.length} movimiento(s) sin vehículo identificado no se incluyen.`);
  if(all.some(r=>r.kind==='movement'&&!r.deleted&&madridDay(r.payload?.time)===o.date&&vehicles[r.payload?.vehicle||r.vehicle]&&r.payload?.type==='DESCARGA'))notes.push('Corregida: valor vigente tras la corrección. Anulada: pendiente de conciliar; sus litros cuentan hasta el ajuste de '+ops()+'.');
  notes.push('La diferencia es cargas menos descargas del día; no equivale a existencias finales.');
  const title=o.scope==='almacen'?'Informe de cargas — Operario':o.scope==='reparto'?'Informe de descargas — Operario':'Informe general — '+ops();
  return {title,date:o.date,scope:o.scope,operator:o.operator?author({owner_id:o.operator}):'',vehicleFilter:o.vehicle?VEHICLE_NAMES[o.vehicle]:'',
   vehicles:VEHICLES.filter(v=>!o.vehicle||v===o.vehicle).map(v=>vehicles[v]),totals,provisional:reasons.length>0,reasons,notes,
   showLoads:o.scope!=='reparto',showDischarges:o.scope!=='almacen',empty:totals.loadCount+totals.dischargeCount===0,
   generatedAt:o.generatedAt||new Date().toISOString(),cutoff:o.cutoff||null};
 }
 function fileName(date){return `VISURA_TANQUES_MOVIMIENTOS_${date}.pdf`;}
 const api={madridDay,madridTime,madridStamp,buildDailyReport,fileName,VEHICLE_NAMES};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.TankReport=api;
})(typeof self!=='undefined'?self:this);
