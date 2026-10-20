'use strict';
// Versión 0.9: existencias iniciales provisionales y conciliación pendiente (demo).
const STORE='cdt_demo_v1';
const APP_VERSION='0.9.2';
const UPDATE_CHECK_MS=6*60*60*1000;
let updateAvailable=false, updating=false, lastUpdateCheck=0;
const baseline=()=>({role:'reparto',page:'inicio',vehicle:'camion',tanks:{camion:[800,650,1000],furgoneta:[900]},cisterna:18000,loads:[],visits:[],openVisit:null,log:[],created:new Date().toISOString()});
let db,state;
let editingId=null;
const el=id=>document.getElementById(id);
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>Number(n||0).toLocaleString('es-ES',{maximumFractionDigits:2});
const now=()=>new Date().toISOString();
const showTime=t=>new Date(t).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'});
const profileKeys={almacen:'workspace-almacen-v08',reparto:'workspace-reparto-v08',gerencia:'workspace-gerencia-v08'};
const activeProfile=()=>state?.role||'reparto';
const openDB=()=>new Promise((res,rej)=>{const r=indexedDB.open(STORE,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const dbGet=(key)=>new Promise((res,rej)=>{const r=db.transaction('state','readonly').objectStore('state').get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const dbPut=(key,value)=>new Promise((res,rej)=>{const t=db.transaction('state','readwrite');t.objectStore('state').put(value,key);t.oncomplete=res;t.onerror=()=>rej(t.error)});
const read=()=>dbGet(profileKeys[activeProfile()]);
const write=()=>dbPut(profileKeys[activeProfile()],state);
const cleanProfile=(role)=>({...baseline(),role,page:'inicio'});
const cloneState=x=>JSON.parse(JSON.stringify(x));
// Declaración local de apertura: NO es una carga de almacén.
// Preservar el registro original para auditoría, y jamás sumar un Excel sobre una apertura provisional.
const provisionalFor=(vehicle)=>state?.provisionalOpenings?.[vehicle]||null;
function provisionalPanel(){
 if(state.role!=='reparto')return '';
 const vehicle=state.vehicle,active=provisionalFor(vehicle),today=localDay(now());
 const pastOperations=(state.visits||[]).some(v=>v.vehicle===vehicle&&localDay(v.started)===today)||
  (state.openVisit?.vehicle===vehicle)||
  Object.values(state.receivedLoads||{}).some(m=>m.vehicle===vehicle&&localDay(m.receivedAt||m.time)===today);
 if(active){
  const latest=(state.pendingLoads||[]).filter(m=>m.vehicle===vehicle&&m.reason?.includes('provisional'));
  return card(`<h3>Existencias provisionales · ${vehicle==='camion'?'Camión':'Furgoneta'}</h3><div class="notice">Pendientes de revisión por Gerencia. No se suman automáticamente las cargas recibidas.</div><p class="compact">Declaradas el ${showTime(active.at)} · Apertura: ${active.amounts.map((n,i)=>`T${i+1}: ${fmt(n)} L`).join(' · ')}</p><p class="hint">Cargas pendientes de conciliación: ${latest.length}. Se mantienen las descargas y los litros restantes actuales.</p>`);
 }
 const fields=state.tanks[vehicle].map((v,i)=>`<label class="field">Tanque ${i+1} · máximo 1.000 L<input id="provTank${i}" type="number" inputmode="decimal" min="0" max="1000" step="0.01" value="${v}" required></label>`).join('');
 return card(`<h3>Inicio excepcional sin archivo de cargas</h3><p class="hint">Úsalo únicamente cuando aún no hayas recibido las cargas de Gerencia. Sustituye el saldo local de apertura; NO registra una carga. Quedará pendiente de revisión.</p>${pastOperations?'<div class="notice">Ya existen operaciones de hoy para este vehículo. No se puede modificar su apertura.</div>':`<form id="provisionalForm" class="form">${fields}<label class="check"><input id="provisionalConfirm" type="checkbox" required> Confirmo que he comprobado estos litros en el vehículo.</label><button class="btn" type="submit">Guardar apertura provisional</button></form>`}`);
}
async function saveProvisional(){
 if(state.role!=='reparto'||provisionalFor(state.vehicle))return toast('Ya existe una apertura provisional para este vehículo');
 if(state.sentJournals?.[journalKey(localDay(now()),'reparto')])return toast('La jornada ya está enviada; no se puede cambiar la apertura');
 const v=state.vehicle,day=localDay(now());
 if(state.openVisit?.vehicle===v||(state.visits||[]).some(x=>x.vehicle===v&&localDay(x.started)===day)||Object.values(state.receivedLoads||{}).some(m=>m.vehicle===v&&localDay(m.receivedAt||m.time)===day))return toast('Ya hay operaciones de hoy; no se puede cambiar la apertura');
 const amounts=state.tanks[v].map((_,i)=>{const field=el('provTank'+i);return field?.value.trim()===''?NaN:Number(field?.value)});
 if(!el('provisionalConfirm')?.checked||amounts.some(n=>!Number.isFinite(n)||n<0||n>1000))return toast('Revisa todos los litros y confirma la declaración');
 if(!confirm('¿Declarar estas existencias de forma PROVISIONAL? Quedarán pendientes de Gerencia; no representan una carga validada.'))return;
 state.provisionalOpenings??={};state.provisionalHistory??=[];
 const record={id:uid(),vehicle:v,date:day,at:now(),previous:state.tanks[v].slice(),amounts:amounts.slice(),status:'pendiente'};
 state.provisionalOpenings[v]=record;state.provisionalHistory.push(record);
 state.tanks[v]=amounts.slice();
 state.log.push({title:'Apertura provisional',desc:`${v}: ${amounts.map((n,i)=>`T${i+1} ${fmt(n)} L`).join(', ')} · Pendiente de Gerencia`,at:record.at});
 invalidateDraft('reparto');await persist();toast('Existencias provisionales registradas. Pendientes de Gerencia.');
}

function migrateLegacy(old){
 const reparto=cleanProfile('reparto'),almacen=cleanProfile('almacen'),gerencia=cleanProfile('gerencia');
 if(!old)return {reparto,almacen,gerencia};
 // Reparto hereda los saldos realmente visibles de la v0.7 y sus visitas.
 Object.assign(reparto,{vehicle:old.vehicle||'camion',tanks:cloneState(old.tanks||reparto.tanks),visits:cloneState(old.visits||[]),openVisit:cloneState(old.openVisit||null),log:cloneState(old.log||[]).filter(x=>!/carga/i.test(x.title||'')),receivedLoads:cloneState(old.receivedLoads||{}),pendingLoads:cloneState(old.pendingLoads||[]),lastHandoff:cloneState(old.lastHandoff||null),sentJournals:cloneState(Object.fromEntries(Object.entries(old.sentJournals||{}).filter(([k])=>k.endsWith('|reparto')))),preparedJournals:cloneState(Object.fromEntries(Object.entries(old.preparedJournals||{}).filter(([k])=>k.endsWith('|reparto'))))});
 // En la v0.7 las cargas se sumaban en el mismo espacio. Ya están incluidas
 // en los saldos legados del repartidor, por eso se registran sus IDs como aplicados.
 for(const l of old.loads||[])if(l.id&&!reparto.receivedLoads[l.id])reparto.receivedLoads[l.id]={id:l.id,legacyApplied:true,receivedAt:now()};
 const loads=cloneState(old.loads||[]);
 // Reconstruir el saldo local de Almacén desde saldos ficticios + sus cargas,
 // nunca copiando el saldo de Reparto (que incluye descargas).
 const stock=cloneState(cleanProfile('almacen').tanks);
 for(const l of loads){const ix=Number(l.index),v=l.vehicle;if(!stock[v]||!Number.isInteger(ix)||ix<0||ix>=stock[v].length)continue;const current=stock[v][ix],loss=Number(l.merma||0),litres=Number(l.amount||0);if(Number.isFinite(loss)&&Number.isFinite(litres)&&loss>=0&&litres>0)stock[v][ix]=Math.max(0,Math.min(1000,current-loss+litres));}
 Object.assign(almacen,{vehicle:old.vehicle||'camion',tanks:stock,cisterna:Number.isFinite(old.cisterna)?old.cisterna:18000,loads,log:cloneState(old.log||[]).filter(x=>/carga|merma/i.test(x.title||'')),sentJournals:cloneState(Object.fromEntries(Object.entries(old.sentJournals||{}).filter(([k])=>k.endsWith('|almacen')))),preparedJournals:cloneState(Object.fromEntries(Object.entries(old.preparedJournals||{}).filter(([k])=>k.endsWith('|almacen'))))});
 gerencia.manager=cloneState(old.manager||{journals:{},movements:{},incidents:[],lastResult:null});
 return {reparto,almacen,gerencia};
}
async function ensureProfiles(){
 const marker=await dbGet('migration-v08-done');
 if(marker)return;
 const legacy=await dbGet('app');
 const parts=migrateLegacy(legacy);
 // Una única transacción: o se migran los tres perfiles y el marcador o ninguno.
 await new Promise((res,rej)=>{const t=db.transaction('state','readwrite'),o=t.objectStore('state');
  o.put(parts.almacen,profileKeys.almacen);o.put(parts.reparto,profileKeys.reparto);o.put(parts.gerencia,profileKeys.gerencia);
  o.put({at:now(),legacyPreserved:!!legacy},'migration-v08-done');t.oncomplete=res;t.onerror=()=>rej(t.error);
 });
}
async function changeProfile(next){
 if(!profileKeys[next])return;
 await write();const nextState=await dbGet(profileKeys[next]);
 if(!nextState)throw new Error('No se encontró el espacio de este perfil');
 state=nextState;state.role=next;state.page='inicio';editingId=null;await write();await dbPut('active-role-v08',next);render();
 toast('Datos locales de '+roleNames[next]+' cargados. Perfil de demostración, sin contraseña.');
}
const persist=async()=>{await write();render()};
const toast=t=>{const e=el('toast');e.textContent=t;e.style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>e.style.display='none',3500)};
const card=(body)=>`<div class="card">${body}</div>`;
const action=(text,act,secondary=false)=>`<button class="btn ${secondary?'secondary':''}" data-act="${act}">${text}</button>`;
const roleNames={almacen:'Almacén',reparto:'Reparto',gerencia:'Gerencia (vista de prueba)'};
function navbar(){el('roleButton').textContent=roleNames[state.role]+' ▾';const allowed=state.role==='almacen'?['inicio','carga','historial','admin']:state.role==='reparto'?['inicio','visita','historial','admin']:['inicio','carga','visita','historial','gerencia','admin'];document.querySelectorAll('[data-page]').forEach(b=>{b.hidden=!allowed.includes(b.dataset.page);b.classList.toggle('active',b.dataset.page===state.page)})}
function home(){const tanks=state.tanks[state.vehicle];let txt=`<h2 class="heading">${state.role==='almacen'?'Almacén':state.role==='reparto'?'Mi vehículo':'Panel de pruebas'}</h2><div class="notice">Datos ficticios guardados localmente por perfil. Cada perfil usa su propio registro; NO existe autenticación real.</div>`;
if(state.role==='almacen'||state.role==='gerencia')txt+=card(`<h3>Cisterna principal</h3><div class="big mono">${fmt(state.cisterna)} L</div><p class="muted tiny">Capacidad nominal 25.000 L · saldo ficticio</p>`);
txt+=`<label class="field">Vehículo<select id="vehicle" class="select"><option value="camion" ${state.vehicle==='camion'?'selected':''}>Camión</option><option value="furgoneta" ${state.vehicle==='furgoneta'?'selected':''}>Furgoneta</option></select></label>`;
txt+=card(`<h3>Existencias ${state.vehicle==='camion'?'del camión':'de la furgoneta'}</h3>${tanks.map((v,i)=>`<div class="tank-line"><div class="row"><b>Tanque ${i+1}</b><strong class="mono">${fmt(v)} / 1.000 L</strong></div><div class="meter"><div style="width:${v/10}%"></div></div></div>`).join('')}<div class="divider"></div><div class="row"><b>Total disponible</b><strong class="big mono">${fmt(tanks.reduce((a,b)=>a+b,0))} L</strong></div>`);
if(state.role==='almacen')txt+=action('Nueva carga de prueba','go-carga');
if(state.role==='reparto'){txt+=provisionalFor(state.vehicle)?'<div class="notice">Existencias PROVISIONALES · pendientes de Gerencia.</div>':'';txt+=action(state.openVisit?'Continuar visita':'Nueva visita de prueba','go-visita');}
if(state.role==='gerencia')txt+=card('<h3>Gerencia · importación de pruebas</h3><p>Puedes importar Excel de jornada sin modificar las existencias de demostración.</p>'+action('Abrir importaciones','go-gerencia')+'<p class="hint">La sincronización entre PC y móvil y los permisos reales siguen pendientes.</p>');
return txt}
function loadPage(){let tanks=state.tanks[state.vehicle];return `<h2 class="heading">Carga individual</h2><div class="notice">Operación de prueba local. Un tanque por registro. Confirma que el contador físico se ha puesto a cero.</div><form id="loadForm" class="form"><label class="field">Vehículo<select id="loadVehicle"><option value="camion" ${state.vehicle==='camion'?'selected':''}>Camión</option><option value="furgoneta" ${state.vehicle==='furgoneta'?'selected':''}>Furgoneta</option></select></label><label class="field">Tanque del vehículo<select id="loadTank">${tanks.map((v,i)=>`<option value="${i}">Tanque ${i+1} · ${fmt(v)} L disponibles</option>`).join('')}</select></label><label class="field">Destino del sobrante<select id="residual"><option value="mantener">Conservar el sobrante</option><option value="desechar">Desechar sobrante como merma</option></select></label><label class="field">Lectura final del contador (litros cargados)<input id="loadLiters" inputmode="decimal" type="number" min="0.01" step="0.01" required placeholder="Ej. 200" /></label><label class="check"><input type="checkbox" id="zeroLoad" required /> He puesto el contador de carga a cero antes de iniciar esta operación.</label><button class="btn" type="submit">Confirmar carga de prueba</button></form><p class="hint">La v1 registra los movimientos y conserva los saldos locales. El Excel diario se genera desde Más → Enviar jornada. El tiempo real queda pendiente.</p>`}
function visitPage(){
 const v=state.openVisit, available=state.tanks[state.vehicle];
 if(!v)return `<h2 class="heading">Nueva visita</h2><div class="notice">Usa clientes ficticios. Esta fase no contiene el catálogo real de clientes.</div><form id="visitForm" class="form"><label class="field">Cliente de prueba<select id="client" required><option value="Cervecería Ejemplo">Cervecería Ejemplo</option><option value="Bar de Pruebas">Bar de Pruebas</option></select></label><label class="check"><input id="zeroVisit" type="checkbox" required> He puesto el contador de descarga a cero al llegar al cliente.</label><button class="btn" type="submit">Iniciar visita</button></form>${reopenList()}`;
 const editing=v.discharges.find(d=>d.id===editingId);
 return `<h2 class="heading">Visita en curso${v.reopened?' · Reabierta':''}</h2>${card(`<h3>${esc(v.client)}</h3><p class="muted tiny">Inicio: ${showTime(v.started)}</p><div class="row"><span>Descargas registradas</span><b>${v.discharges.length}</b></div><div class="row"><span>Contador del tramo actual</span><b>${fmt(v.reading)} L</b></div><p class="hint">Reinicios excepcionales: ${(v.resets||[]).length}</p>`)}
 ${editing?editForm(v,editing):`<form id="dischargeForm" class="form"><label class="field">Tanque de origen del vehículo<select id="sourceTank">${available.map((liters,i)=>`<option value="${i}" ${v.lastSource===i?'selected':''}>Tanque ${i+1} · ${fmt(liters)} L restantes</option>`).join('')}</select></label><label class="field">Tanque del cliente (obligatorio en cada descarga)<select id="destTank" required><option value="">Seleccionar depósito…</option><option value="1">Tanque cliente 1 · 500 L</option><option value="2">Tanque cliente 2 · 500 L</option><option value="3">Tanque cliente 3 · 250 L</option></select></label><label class="field">Nueva lectura acumulada del contador<input type="number" min="0" step="0.01" inputmode="decimal" id="reading" placeholder="Anterior: ${fmt(v.reading)} L" required /></label><p class="hint">El contador es único para todos los tanques. Cada lectura debe superar la anterior dentro del mismo tramo.</p><button class="btn" type="submit">Registrar descarga</button></form>${v.discharges.length?card(`<h3>Reinicio excepcional del contador</h3><p class="hint">Úsalo solo si has puesto a cero físicamente el contador durante esta visita. No modifica litros ya registrados.</p>${action('Registrar puesta a cero','reset-meter',true)}`):''}`}
 <h3 class="spaced">Descargas de esta visita</h3>${v.discharges.map((d,i)=>card(`<div class="row"><b>Descarga ${i+1}</b><b>${fmt(d.liters)} L</b></div><p class="tiny muted">Vehículo T${d.source+1} → Cliente T${d.dest} · Lectura ${fmt(d.reading)} L${d.segment?' · Tramo '+(d.segment+1):''}</p><button class="linklike" type="button" data-act="edit-discharge" data-id="${esc(d.id)}">Corregir descarga</button>`)).join('')}
 ${v.discharges.length&&!editing?action('Finalizar visita','finish-visit',true):''}
 <p class="hint">Las correcciones y los reinicios se anotan en el historial local. Puedes generar el Excel diario desde Más → Enviar jornada. Solo datos de prueba.</p>`;
}
function editForm(v,d){
 return card(`<h3>Corregir descarga</h3><p class="hint">La lectura puede afectar a los litros de la descarga siguiente del mismo tramo. Se revisarán las existencias de todos los tanques antes de guardar.</p><form id="editForm" class="form"><label class="field">Tanque del cliente<select id="editDest" required><option value="1" ${d.dest==='1'?'selected':''}>Tanque cliente 1 · 500 L</option><option value="2" ${d.dest==='2'?'selected':''}>Tanque cliente 2 · 500 L</option><option value="3" ${d.dest==='3'?'selected':''}>Tanque cliente 3 · 250 L</option></select></label><label class="field">Lectura acumulada corregida (L)<input id="editReading" inputmode="decimal" type="number" min="0.01" step="0.01" required value="${d.reading}"></label><label class="field">Motivo de corrección<select id="editReason"><option value="Tanque del cliente incorrecto">Tanque del cliente incorrecto</option><option value="Lectura del contador incorrecta">Lectura del contador incorrecta</option><option value="Otro error de registro">Otro error de registro</option></select></label><button class="btn" type="submit">Guardar corrección</button><button class="btn secondary" type="button" data-act="cancel-edit">Cancelar</button></form>`);
}
function reopenList(){
 const eligible=state.visits.filter(canReopen);
 return `${eligible.length?`<h3 class="spaced">Visitas cerradas · pendientes de envío</h3>${eligible.slice().reverse().map(v=>card(`<div class="row"><div><b>${esc(v.client)}</b><p class="tiny muted">${showTime(v.ended)} · ${v.discharges.length} descargas</p></div><button class="btn small secondary" type="button" data-act="reopen-visit" data-id="${esc(v.id)}">Reabrir</button></div>`)).join('')}`:''}`;
}
function canReopen(v){
 if(!v||!v.ended||state.openVisit||v.sentAt)return false;
 const laterVisit=state.visits.some(x=>x.id!==v.id&&x.vehicle===v.vehicle&&x.started>v.ended);
 const laterLoad=state.loads.some(x=>x.vehicle===v.vehicle&&x.at>v.ended);
 return !laterVisit&&!laterLoad;
}
function historyPage(){const movements=[...state.log].reverse();return `<h2 class="heading">Historial local</h2><div class="notice">Se muestran también las correcciones, los reinicios del contador y la reapertura de visitas. Las jornadas se pueden exportar desde Más → Enviar jornada.</div>${movements.length?movements.map(m=>card(`<div class="row"><b>${esc(m.title)}</b><span class="tag">${showTime(m.at)}</span></div><p class="compact">${esc(m.desc)}</p>`)).join(''):'<div class="empty">Todavía no hay movimientos registrados.</div>'}`}
const updatePanel=()=>card(`<h3>Actualizaciones</h3><div class="row"><span>Versión instalada</span><b class="mono">${APP_VERSION}</b></div><p class="update-info">La app busca nuevas versiones al abrirse o regresar a primer plano si hay conexión. No se eliminan los datos locales.</p>${action('Buscar actualizaciones','check-update',true)}${updateAvailable?`<div class="update-ready"><h4>Nueva versión disponible</h4><p class="compact">Puedes instalar la nueva versión sin borrar los movimientos de prueba.</p>${action('Actualizar ahora','apply-update')}</div>`:''}<p class="update-info" id="updateStatus">${navigator.onLine?'Para buscar una nueva versión, toca el botón.':'Sin conexión: se mantiene la versión instalada.'}</p>`);
function adminPage(){return `<h2 class="heading">Configuración de pruebas</h2>${card(`<h3>Enviar jornada · Excel</h3><p class="hint">Un Excel por fecha y perfil. Funciona sin conexión. Reenvía el mismo archivo cuando ya esté marcado como enviado.</p>${action('Abrir envío de jornada','go-jornada')}`)}${updatePanel()}${state.role==='reparto'?provisionalPanel():''}${state.role==='reparto'?card(`<h3>Recibir cargas de Gerencia · Pruebas</h3><p class="hint">Importa el Excel de traspaso correspondiente a tu vehículo. Las cargas repetidas no se aplican dos veces y las incoherentes se dejan pendientes.</p><label class="field">Archivo de cargas .xlsx<input id="handoffFile" type="file" accept=".xlsx"></label><p class="hint">${esc(handoffSummary())}</p>`):''}${state.role==='gerencia'?card(`<h3>Gerencia · Excel recibidos</h3><p class="hint">Solo importaciones locales de pruebas; no hay sincronización ni acceso seguro.</p>${action('Abrir importador de Excel','go-gerencia')}`):''}${card(`<h3>Perfil de demostración</h3><p class="hint">Cada perfil dispone de su propio espacio de datos local en este navegador. NO equivale a un acceso seguro: no hay contraseña ni aislamiento entre usuarios.</p><label class="field">Vista<select id="chooseRole"><option value="almacen" ${state.role==='almacen'?'selected':''}>Almacén</option><option value="reparto" ${state.role==='reparto'?'selected':''}>Reparto</option><option value="gerencia" ${state.role==='gerencia'?'selected':''}>Gerencia (demo)</option></select></label>`)}${card(`<h3>Copia de seguridad de pruebas</h3><p class="hint">Guarda un JSON con los tres perfiles locales y el archivo de Gerencia. No es el Excel diario de operaciones.</p>${action('Descargar copia JSON','backup',true)}`)}${card(`<h3>Restablecer demostración</h3><p>Restablece únicamente el perfil visible; los otros perfiles y la copia previa a v0.8 se conservan.</p>${action('Reiniciar datos ficticios','reset',true)}`)}${card(`<h3>Estado del desarrollo</h3><p class="compact">Fase 1: interfaz móvil, PWA y persistencia local de movimientos de prueba. Implementado en demo: correcciones auditadas, reinicio de contador y reapertura de visitas. Excel de jornada en fase de pruebas. Implementada: importación local de pruebas por Gerencia. En pruebas: conciliación de existencias. Pendiente: sincronización, control real de tiempos, permisos seguros, cifrado y conexión de Gerencia.</p>`)}`}

// v0.4 · Excel local por día y perfil. No hay identificación auténtica ni control de permisos todavía.
const localDay=iso=>{if(!iso)return '';const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
let journalDate=localDay(new Date().toISOString());
let journalWorker='Operario de prueba';
const journalRole=()=>state.role==='almacen'?'almacen':state.role==='reparto'?'reparto':null;
const journalKey=(date,role)=>`${date}|${role}`;
function invalidateDraft(role){if(!state.preparedJournals)return;for(const k of Object.keys(state.preparedJournals))if(k.endsWith('|'+role))delete state.preparedJournals[k];}
function journalSources(date,role){
 const loads=role==='almacen'?state.loads.filter(l=>localDay(l.at)===date):[];
 const visits=role==='reparto'?state.visits.filter(v=>localDay(v.started)===date):[];
 return {loads,visits};
}
function journalSnapshot(date,role){
 const {loads,visits}=journalSources(date,role);
 const movements=[];
 if(role==='almacen')for(const l of loads)movements.push([l.id,'CARGA',l.vehicle,l.index+1,'', '',l.amount,l.merma||0, l.at]);
 else for(const v of visits)for(const d of v.discharges)movements.push([d.id,'DESCARGA',v.vehicle,d.source+1,v.client,Number(d.dest),d.liters,0,d.at]);
 const corrections=visits.flatMap(v=>(v.corrections||[]).map(c=>[c.id,v.id,c.dischargeId,c.reason,JSON.stringify(c.previous),JSON.stringify(c.next),c.at]));
 const resets=visits.flatMap(v=>(v.resets||[]).map(r=>[r.id,v.id,r.afterDischargeId,r.readingBefore,r.at]));
 const meta={id:uid(),date,role,worker:journalWorker,vehicle:state.vehicle,createdAt:now(),demo:true};
 const provisional=role==='reparto'?(state.provisionalHistory||[]).filter(p=>p.date===date).map(p=>({id:p.id,vehicle:p.vehicle,at:p.at,amounts:p.amounts,status:p.status})):[];
 return {meta,provisional,movements,loads:loads.map(l=>[l.id,l.vehicle,l.index+1,l.amount,l.merma||0,l.at]),visits:visits.map(v=>[v.id,v.vehicle,v.client,v.started,v.ended,v.discharges.length]),discharges:visits.flatMap(v=>v.discharges.map(d=>[d.id,v.id,v.vehicle,v.client,d.source+1,d.dest,d.segment||0,d.reading,d.liters,d.at])),corrections,resets};
}
function journalTabs(s){
 const m=s.meta;
 return [
 ['Jornada',[['Campo','Valor'],['ID de jornada',m.id],['Fecha',m.date],['Perfil',m.role],['Operario (demo)',m.worker],['Vehículo orientativo',m.vehicle],['Entorno','SOLO DEMOSTRACIÓN'],['Formato','CDT-v0.4'],['Exportación UTC',m.createdAt]]],
 ['Movimientos',[['ID','Tipo','Vehículo','Tanque origen','Cliente','Tanque destino','Litros','Merma (L)','Fecha y hora'],...s.movements]],
 ['Cargas',[['ID','Vehículo','Tanque','Litros cargados','Merma','Fecha y hora'],...s.loads]],
 ['Visitas',[['ID','Vehículo','Cliente','Inicio','Fin','Nº descargas'],...s.visits]],
 ['Descargas',[['ID','ID visita','Vehículo','Cliente','Tanque origen','Tanque cliente','Tramo contador','Lectura acumulada','Litros','Fecha y hora'],...s.discharges]],
 ['Correcciones',[['ID','ID visita','ID descarga','Motivo','Valor anterior','Valor corregido','Fecha y hora'],...s.corrections]],
 ['Reinicios',[['ID','ID visita','Tras descarga','Lectura anterior','Fecha y hora'],...s.resets]],
 ['Control',[['Parámetro','Valor'],['Formato','CDT-v0.4'],['ID jornada',m.id],['Fecha',m.date],['Perfil',m.role],['Duplicados','Usar IDs únicos, no sumar dos veces'],['Control de tiempos','No implementado; NO usar con datos reales'],['Aperturas provisionales',JSON.stringify(s.provisional||[])],['Revisión provisional',(s.provisional||[]).length?'PENDIENTE DE GERENCIA':'NINGUNA']]]
 ];
}
function journalPage(){
 const role=journalRole();if(!role)return `<h2 class="heading">Enviar jornada</h2><div class="notice">Cambia a Almacén o Reparto para exportar la jornada de ese perfil. Gerencia tendrá su propio sistema de importación en la siguiente fase.</div>${action('Volver a Más','go-admin',true)}`;
 const sent=state.sentJournals?.[journalKey(journalDate,role)];const {loads,visits}=journalSources(journalDate,role),items=role==='almacen'?loads.length:visits.reduce((n,v)=>n+v.discharges.length,0),liters=role==='almacen'?loads.reduce((n,v)=>n+v.amount,0):visits.reduce((n,v)=>n+v.discharges.reduce((t,d)=>t+d.liters,0),0);
 return `<h2 class="heading">Enviar jornada</h2><div class="notice">Exportación Excel local · SOLO DATOS DE PRUEBA. No hay envío automático ni recepción confirmada.</div><label class="field">Fecha de la jornada<input type="date" id="journalDate" value="${esc(journalDate)}"></label><label class="field">Operario (etiqueta de prueba)<input id="journalWorker" value="${esc(journalWorker)}" maxlength="70" placeholder="Operario de prueba"></label>${card(`<div class="row"><b>Perfil</b><b>${role==='almacen'?'Almacén':'Reparto'}</b></div><div class="row"><span>Movimientos</span><b>${items}</b></div><div class="row"><span>Litros</span><b>${fmt(liters)} L</b></div><div class="row"><span>Estado</span><b>${sent?'Marcada como enviada':'Editable'}</b></div>`)}${sent?card(`<h3>Jornada cerrada</h3><p class="hint">El mismo Excel puede volver a descargarse. No se generan identificadores nuevos.</p>${action('Reenviar mismo Excel','resend-xlsx')}`):`${state.openVisit&&localDay(state.openVisit.started)===journalDate?`<div class="notice error">Cierra primero la visita abierta de esta fecha.</div>`:''}${action('Generar y compartir Excel','make-xlsx')}<p class="hint">Después de comprobar que has compartido el archivo, podrás marcar la jornada como enviada. Si cancelas el envío, déjala editable.</p>${state.preparedJournals?.[journalKey(journalDate,role)]?action('Marcar jornada como enviada','mark-sent',true):''}`}<p class="hint">El archivo conserva las operaciones, correcciones y reinicios. No borra nada del móvil. Las horas guardadas son marcas de eventos; todavía NO existe control real de duración ni cifrado.</p>${action('Volver a Más','go-admin',true)}`;
}
async function sendJournal(resend){
 const role=journalRole();if(!role)return toast('Selecciona perfil Almacén o Reparto');
 const key=journalKey(journalDate,role);
 if(!resend&&state.openVisit&&localDay(state.openVisit.started)===journalDate)return toast('Finaliza antes la visita abierta');
 if(!resend&&!journalSources(journalDate,role)[role==='almacen'?'loads':'visits'].length)return toast('No hay movimientos cerrados para esa jornada');
 let snapshot;
 if(resend){snapshot=state.sentJournals?.[key];if(!snapshot)return toast('No hay una jornada enviada para reenviar');}
 else{snapshot=journalSnapshot(journalDate,role);state.preparedJournals??={};state.preparedJournals[key]=snapshot;await write();}
 const file=`control-tanques-DEMO-${role}-${journalDate}.xlsx`;
 const blob=SheetXLSX.generate(journalTabs(snapshot));const xfile=typeof File==='function'?new File([blob],file,{type:blob.type}):null;
 try{if(xfile&&navigator.canShare?.({files:[xfile]})&&navigator.share){await navigator.share({files:[xfile],title:'Jornada de prueba · Control de Tanques'});toast('Compartir completado; confirma después si realmente se envió');}
 else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Excel descargado. Compártelo desde Archivos.');}}
 catch(err){if(err.name==='AbortError')toast('No se completó el compartir. Puedes intentarlo de nuevo.');else {console.error(err);toast('No se pudo compartir. Inténtalo de nuevo.')}}
 render();
}
async function markJournalSent(){
 const role=journalRole(),key=journalKey(journalDate,role),draft=state.preparedJournals?.[key];
 if(!draft)return toast('Genera primero el Excel');
 if(!confirm('¿Has enviado o guardado el archivo correctamente? Marcar como enviada bloqueará las correcciones de esta jornada. El sistema NO puede comprobar la recepción en Gerencia.'))return;
 state.sentJournals??={};state.sentJournals[key]=structuredClone(draft);
 for(const v of state.visits)if(role==='reparto'&&localDay(v.started)===journalDate)v.sentAt=now();
 for(const l of state.loads)if(role==='almacen'&&localDay(l.at)===journalDate)l.sentAt=now();
 delete state.preparedJournals[key];await persist();toast('Jornada marcada como enviada; disponible para reenviar');
}


// Gerencia v0.6: archivo local de prueba y conciliación cronológica, sin sincronización central.
// No modifica los saldos de los trabajadores ni constituye base sincronizada.
function managerState(){state.manager??={journals:{},movements:{},incidents:[],lastResult:null};return state.manager}
// Solo vista informativa: los saldos de Inicio y los movimientos importados nunca se sobrescriben.
// La apertura se declara ANTES de la primera operación importada (no es un inventario actual).
const vehicleTanks={camion:3,furgoneta:1};
function parseOpening(g){
 const o=g.opening;
 if(!o||!Array.isArray(o.camion)||!Array.isArray(o.furgoneta)||o.camion.length!==3||o.furgoneta.length!==1||
  ![o.cisterna,...o.camion,...o.furgoneta].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=25000))return null;
 if(o.cisterna>25000||[...o.camion,...o.furgoneta].some(n=>n>1000))return null;
 return o;
}
function reconcileManager(g){
 const opening=parseOpening(g), imported=Object.values(g.movements||{});
 const sorted=imported.slice().sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)||String(a.id).localeCompare(String(b.id)));
 const results={}, problems=[];
 if(!opening){
  for(const m of sorted)results[m.id]={status:'pendiente',reason:'Indicar existencias iniciales para conciliar'};
  return {ready:false,results,problems:[],accepted:0,pending:sorted.length,balances:null};
 }
 const balances={cisterna:opening.cisterna,camion:opening.camion.slice(),furgoneta:opening.furgoneta.slice()};
 const blocked={cisterna:false,camion:false,furgoneta:false};
 let accepted=0,pending=0;
 // Todos los movimientos guardados se vuelven a calcular a cada importación.
 for(const m of sorted){
  let reason='';const v=m.vehicle,t=Number(m.tank)-1;
  const qty=Number(m.litres),loss=Number(m.loss||0);
  if(!['camion','furgoneta'].includes(v)||!Number.isInteger(t)||t<0||t>=vehicleTanks[v]||
       !Number.isFinite(qty)||qty<=0||!Number.isFinite(loss)||loss<0||!Number.isFinite(Date.parse(m.time)))reason='Movimiento incompleto o inválido';
  else if(blocked[v]||(m.type==='CARGA'&&blocked.cisterna))reason='Pendiente de resolver un movimiento anterior del vehículo o cisterna';
  else if(m.type==='CARGA'){
   // La merma de la carga debe corresponder al sobrante previo completo, o ser cero.
   const previous=balances[v][t];
   if(qty>balances.cisterna+1e-6)reason='Cisterna sin saldo suficiente o recepción de fábrica no registrada';
   else if(loss>0&&Math.abs(loss-previous)>1e-6)reason='Merma diferente del sobrante teórico del tanque';
   else if(previous-loss+qty>1000+1e-6)reason='Capacidad del tanque superada';
   else{balances.cisterna=Number((balances.cisterna-qty).toFixed(6));balances[v][t]=Number((previous-loss+qty).toFixed(6))}
  }else if(m.type==='DESCARGA'){
   if(qty>balances[v][t]+1e-6)reason='Descarga superior al saldo disponible; puede faltar una carga';
   else balances[v][t]=Number((balances[v][t]-qty).toFixed(6));
  }else reason='Tipo de movimiento desconocido';
  if(reason){
   results[m.id]={status:'pendiente',reason};problems.push({id:m.id,vehicle:v,tank:t+1,reason});pending++;
   // No seguir aprobando otros movimientos que dependan de stock ya dudoso.
   if(['camion','furgoneta'].includes(v))blocked[v]=true;
   if(m.type==='CARGA')blocked.cisterna=true;
  }else{results[m.id]={status:'conciliado'};accepted++}
 }
 return {ready:true,results,problems,accepted,pending,balances};
}
function reconciliationPanel(g){
 const r=reconcileManager(g),o=parseOpening(g),tanks=r.balances;
 const quantity=(id,label,value,max)=>`<label class="field">${label}<input inputmode="decimal" type="number" step="0.01" min="0" max="${max}" id="${id}" value="${value===null?'':esc(value)}" placeholder="Litros iniciales"></label>`;
 const openingCard=card(`<h3>Existencias iniciales de prueba</h3><p class="hint">Introduce cantidades existentes ANTES de la primera operación de todos los Excel importados. No son los litros actuales del móvil. No alteran el Inicio ni los movimientos. Si no conoces los saldos, deja pendiente la conciliación.</p><form id="openingForm" class="form">${quantity('openingCisterna','Cisterna principal (máx. 25.000 L)',o?.cisterna??null,25000)}<h4>Camión</h4>${[0,1,2].map(i=>quantity('openingCamion'+i,`Tanque ${i+1} (máx. 1.000 L)`,o?.camion[i]??null,1000)).join('')}<h4>Furgoneta</h4>${quantity('openingFurgoneta','Tanque 1 (máx. 1.000 L)',o?.furgoneta[0]??null,1000)}<button class="btn" type="submit">Guardar saldos iniciales y recalcular</button></form>${o?action('Quitar saldos iniciales de pruebas','clear-opening',true):''}`);
 const overview=card(`<h3>Conciliación cronológica</h3><div class="row"><span>Movimientos conciliados</span><b>${r.accepted}</b></div><div class="row"><span>Movimientos pendientes</span><b>${r.pending}</b></div><p class="hint">Orden cronológico de los archivos importados. Al recibir más Excel se recalcula todo. Las cantidades no son saldos oficiales hasta comprobar los registros de apertura, cargas y recepciones de fábrica.</p>${!r.ready?'<div class="notice">Introduce los saldos iniciales para activar la simulación de conciliación.</div>':''}`);
 const balanceCard=tanks?card(`<h3>Saldo calculado · No oficial</h3><div class="row"><span>Cisterna principal</span><b>${fmt(tanks.cisterna)} L</b></div>${['camion','furgoneta'].map(v=>`<h4>${v==='camion'?'Camión':'Furgoneta'} ${r.problems.some(p=>p.vehicle===v)?'· Pendiente':''}</h4>${tanks[v].map((n,i)=>`<div class="row"><span>Tanque ${i+1}</span><b>${fmt(n)} L</b></div>`).join('')}`).join('')}<p class="hint">Si hay incidencias, los saldos afectados solo reflejan movimientos anteriores validados, no el inventario actual.</p>`):'';
 const problemCard=r.problems.length?card(`<h3>Movimientos pendientes</h3>${r.problems.slice(0,15).map(x=>`<p class="compact"><b>${esc(x.vehicle||'')}, tanque ${Number(x.tank)||'—'}</b> · ${esc(x.reason)} <span class="muted mono">${esc(String(x.id).slice(0,10))}</span></p>`).join('')}${r.problems.length>15?`<p class="hint">Y ${r.problems.length-15} incidencias más.</p>`:''}`):'';
 return overview+openingCard+balanceCard+problemCard;
}
async function saveOpening(){
 const n=id=>{const field=el(id);if(!field||field.value.trim()==='')return NaN;return Number(field.value)};
 const opening={cisterna:n('openingCisterna'),camion:[0,1,2].map(i=>n('openingCamion'+i)),furgoneta:[n('openingFurgoneta')]};
 if(!Number.isFinite(opening.cisterna)||opening.cisterna<0||opening.cisterna>25000||
    [...opening.camion,...opening.furgoneta].some(x=>!Number.isFinite(x)||x<0||x>1000))return toast('Indica litros válidos en todos los campos');
 if(!confirm('¿Guardar estos saldos iniciales ficticios y recalcular los Excel importados?'))return;
 managerState().opening=opening;await persist();toast('Conciliación de pruebas recalculada');
}

// Fase v0.7: intercambio de cargas en Excel (demostración local, sin autenticación).
const handoffMarker='CDT-TRASPASO-v0.7';
function handoffSummary(){const a=state.receivedLoads||{};return `Cargas recibidas en este dispositivo: ${Object.keys(a).length}. Pendientes: ${(state.pendingLoads||[]).length}.`}
function handoffRows(vehicle){
 const g=managerState(),recon=reconcileManager(g);
 const loads=Object.values(g.movements||{}).filter(m=>m.type==='CARGA'&&m.vehicle===vehicle&&recon.results[m.id]?.status==='conciliado').sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)||a.id.localeCompare(b.id));
 const stamp=now(),tag=uid();
 return {loads,tabs:[['Traspaso',[['Campo','Valor'],['Formato',handoffMarker],['Entorno','SOLO DEMOSTRACIÓN'],['Vehículo',vehicle],['ID traspaso',tag],['Generado UTC',stamp],['Nº cargas',loads.length]]],['Cargas',[['ID carga','Vehículo','Tanque','Litros cargados','Merma','Fecha y hora','ID jornada'],...loads.map(m=>[m.id,m.vehicle,m.tank,m.litres,m.loss||0,m.time,m.journalId])]] ]};
}
async function exportHandoff(){
 if(state.role!=='gerencia')return;
 const vehicle=el('handoffVehicle')?.value||'camion',r=handoffRows(vehicle);
 if(!r.loads.length)return toast('No hay cargas conciliadas para ese vehículo. Importa primero un Excel de Almacén y revisa los saldos iniciales.');
 const filename=`control-tanques-DEMO-cargas-${vehicle}-${new Date().toISOString().slice(0,10)}.xlsx`;
 const blob=SheetXLSX.generate(r.tabs),file=new File([blob],filename,{type:blob.type});
 try{if(navigator.canShare?.({files:[file]})&&navigator.share)await navigator.share({files:[file],title:'Cargas para reparto · DEMO'});
 else{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}toast('Archivo de traspaso preparado. Envía solo al repartidor correcto.');}
 catch(err){if(err.name!=='AbortError'){console.error(err);toast('Error al compartir el archivo')}else toast('Envío cancelado')}
}
async function receiveHandoff(file){
 if(state.role!=='reparto')return toast('Selecciona Reparto');
 if(state.openVisit)return toast('Finaliza la visita antes de importar cargas');
 try{
  const parsed=CDTTransfer.parse(await file.arrayBuffer());
  if(parsed.vehicle!==state.vehicle)return toast('El archivo corresponde a otro vehículo. Cambia de vehículo antes de importar.');
  state.receivedLoads??={};state.pendingLoads??=[];
  let added=0,duplicates=0,pending=0;
  for(const m of parsed.loads){
   if(state.receivedLoads[m.id]||(state.loads||[]).some(l=>l.id===m.id)){duplicates++;continue}
   if(provisionalFor(m.vehicle)){
    if(!state.pendingLoads.some(x=>x.id===m.id))state.pendingLoads.push({...m,reason:'Apertura provisional: requiere conciliación de Gerencia; no sumar al saldo declarado'});
    pending++;continue;
   }
   const t=m.tank-1,previous=state.tanks[m.vehicle][t];
   const proposed=previous-m.loss+m.litres;
   if(m.loss>0&&Math.abs(m.loss-previous)>0.001||proposed<0||proposed>1000){
    if(!state.pendingLoads.some(x=>x.id===m.id))state.pendingLoads.push({...m,reason:'No coincide el saldo local o la capacidad del tanque; requiere revisión de Gerencia'});
    pending++;continue;
   }
   state.tanks[m.vehicle][t]=Number(proposed.toFixed(4));state.receivedLoads[m.id]={...m,receivedAt:now()};
   state.pendingLoads=state.pendingLoads.filter(x=>x.id!==m.id);
   state.log.push({title:'Carga de Gerencia (demo)',desc:`${m.vehicle}, tanque ${m.tank}: +${fmt(m.litres)} L, merma ${fmt(m.loss)} L. ID ${m.id}`,at:now()});added++;
  }
  state.lastHandoff={file:file.name,added,duplicates,pending,at:now()};
  await persist();toast(`Cargas: ${added} aplicadas, ${duplicates} repetidas, ${pending} pendientes`);
 }catch(err){console.error(err);toast(err.message||'Archivo de cargas inválido')}
}
function managerPage(){
 const g=managerState(),journals=Object.values(g.journals),movements=Object.values(g.movements);
 const last=g.lastResult;
 return `<h2 class="heading">Gerencia · Importar jornadas</h2><div class="notice">DEMOSTRACIÓN LOCAL. Sin autenticación ni sincronización real. Conciliación de saldos ficticios, separada de Inicio. Solo Excel CDT-v0.4.</div>
 ${card(`<h3>Seleccionar Excel de jornada</h3><label class="field">Archivo .xlsx<input id="managerFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><p class="hint">Al seleccionar el Excel, importa automáticamente los movimientos válidos. Un ID repetido nunca se contabiliza dos veces.</p>`)}
 ${last?card(`<h3>Último resultado de importación</h3><div class="row"><span>Archivo</span><b>${esc(last.file)}</b></div><div class="row"><span>Importados</span><b>${last.added}</b></div><div class="row"><span>Duplicados</span><b>${last.duplicates}</b></div><div class="row"><span>Incidencias</span><b>${last.issues}</b></div><p class="hint">${esc(last.note)}</p>`):''}
 ${card(`<h3>Archivo general local (pruebas)</h3><div class="row"><span>Jornadas registradas</span><b>${journals.length}</b></div><div class="row"><span>Movimientos únicos</span><b>${movements.length}</b></div><div class="row"><span>Litros de cargas importadas</span><b>${fmt(movements.filter(x=>x.type==='CARGA').reduce((s,x)=>s+x.litres,0))} L</b></div><div class="row"><span>Litros de descargas importadas</span><b>${fmt(movements.filter(x=>x.type==='DESCARGA').reduce((s,x)=>s+x.litres,0))} L</b></div><div class="row"><span>Incidencias acumuladas</span><b>${g.incidents.length}</b></div><p class="hint">Los totales son movimientos archivados. La conciliación se muestra separada y no modifica Inicio.</p>`)}
 ${journals.some(j=>(j.provisional||[]).length)?card(`<h3>Existencias provisionales · Pendientes de Gerencia</h3>${journals.flatMap(j=>(j.provisional||[]).map(p=>`<p class="compact"><b>${esc(j.date)} · ${esc(p.vehicle)}</b> · ${p.amounts.map((n,i)=>`T${i+1} ${fmt(n)} L`).join(' · ')}<br><span class="muted">Declaración del repartidor, NO conciliada con cargas.</span></p>`)).join('')}<p class="hint">La conciliación de saldos no valida por sí sola estas declaraciones; verificar contra cargas originales antes de aprobar.</p>`):''}
 ${g.incidents.length?card(`<h3>Incidencias recientes</h3>${g.incidents.slice(-8).reverse().map(x=>`<p class="compact">${esc(x.file)} · ${esc(x.id)}: ${esc(x.reason)}</p>`).join('')}`):''}
 ${journals.length?card(`<h3>Jornadas importadas</h3>${journals.slice().reverse().slice(0,12).map(j=>`<div class="row"><span>${esc(j.date)} · ${esc(j.role)}</span><b>${esc(j.worker)}</b></div>`).join('')}`):''}
 ${reconciliationPanel(g)}
 ${card(`<h3>Comunicar cargas al repartidor · Pruebas</h3><p class="hint">Se exportan únicamente cargas conciliadas de Almacén. No incluye duraciones ni datos reales. Si no hay cargas conciliadas, no se generará archivo.</p><label class="field">Vehículo<select id="handoffVehicle"><option value="camion">Camión</option><option value="furgoneta">Furgoneta</option></select></label>${action('Generar Excel de cargas','export-handoff')}`)}
 ${action('Descargar copia JSON','backup',true)}`;
}
// Comparación canónica: no depende del orden de las propiedades ni de metadatos adicionales.
// journalId identifica la exportación/jornada, no el contenido físico del movimiento.
// Los cambios reales en campos del movimiento siguen generando incidencia.
const MOVEMENT_FIELDS=['id','type','vehicle','tank','client','dest','litres','loss','time','date','role'];
function movementDifferences(a,b){
 return MOVEMENT_FIELDS.filter(k=>{
  const x=a[k],y=b[k];
  if(k==='litres'||k==='loss'||k==='tank')return !(Number.isFinite(Number(x))&&Number.isFinite(Number(y))&&Math.abs(Number(x)-Number(y))<0.000001);
  return String(x??'')!==String(y??'');
 });
}
async function importManagerFile(file){
 if(state.role!=='gerencia'){toast('Selecciona la vista Gerencia (demo)');return}
 if(!file.name.toLowerCase().endsWith('.xlsx')){toast('Selecciona un archivo XLSX');return}
 try{
  const parsed=CDTImport.parse(await file.arrayBuffer()),g=managerState();
  const already=g.journals[parsed.meta.id];let added=0,duplicates=0,issues=0;
  const accepted=[];const notices=[...parsed.issues.map(x=>({file:file.name,id:x.id,reason:x.reason}))];
  for(const m of parsed.movements){
   const prior=g.movements[m.id];
   if(prior){const changed=movementDifferences(prior,m);if(changed.length){issues++;notices.push({file:file.name,id:m.id,reason:'ID existente con contenido diferente (campos: '+changed.join(', ')+')'})}else duplicates++;}
   else{accepted.push(m);added++;}
  }
  issues+=parsed.issues.length;
  // Se guarda un lote completo de movimientos validados y resumen en una sola escritura IndexedDB.
  for(const m of accepted)g.movements[m.id]=m;
  if(!already)g.journals[parsed.meta.id]={...parsed.meta,source:file.name,firstImport:now(),rows:parsed.summary.rows,provisional:parsed.provisional||[]};
  g.incidents.push(...notices);
  g.lastResult={file:file.name,added,duplicates,issues,note:already?'Esta jornada ya existía. Solo se incorporaron IDs que faltaban.':'Registro local de prueba actualizado.'};
  await persist();toast(`Excel leído: ${added} nuevos, ${duplicates} repetidos, ${issues} incidencias`);
 }catch(err){console.error('Importación',err);toast(err.message||'No se pudo importar el Excel');}
}

function render(){navbar();const pages={inicio:home,carga:loadPage,visita:visitPage,historial:historyPage,admin:adminPage,jornada:journalPage,gerencia:managerPage};el('screen').innerHTML=pages[state.page]();}
async function navigate(page){if(editingId)editingId=null;if(state.openVisit && page==='carga')return toast('Finaliza primero la visita en curso');state.page=page;await persist()}
async function processLoad(form){if(state.sentJournals?.[journalKey(localDay(now()),'almacen')])return toast('Jornada de Almacén ya enviada');const vehicle=el('loadVehicle').value,index=Number(el('loadTank').value),amount=Number(el('loadLiters').value),old=state.tanks[vehicle][index],discard=el('residual').value==='desechar',merma=discard?old:0;const remaining=discard?0:old;if(!el('zeroLoad').checked||!Number.isFinite(amount)||amount<=0||amount+remaining>1000||amount>state.cisterna)return toast('Revisa la cantidad, capacidad, cisterna y confirmación del contador');if(!confirm(`Registrar ${fmt(amount)} L al ${vehicle}, tanque ${index+1}${merma?` y merma de ${fmt(merma)} L`:''}?`))return;
invalidateDraft('almacen');state.tanks[vehicle][index]=remaining+amount;state.cisterna-=amount;const at=now();state.loads.push({id:uid(),vehicle,index,amount,merma,at});state.log.push({title:'Carga',desc:`${vehicle} · Tanque ${index+1} · ${fmt(amount)} L${merma?` · Merma ${fmt(merma)} L`:''}`,at});toast('Carga ficticia guardada');await persist()}
async function startVisit(){if(state.sentJournals?.[journalKey(localDay(now()),'reparto')])return toast('Jornada de Reparto ya enviada');if(state.openVisit)return toast('Ya hay una visita abierta');if(!el('zeroVisit').checked)return toast('Confirma la puesta a cero del contador');state.openVisit={id:uid(),client:el('client').value,vehicle:state.vehicle,started:now(),reading:0,segment:0,resets:[],corrections:[],lastSource:0,discharges:[]};await persist()}
async function discharge(){const v=state.openVisit;if(!v)return;const source=Number(el('sourceTank').value),dest=el('destTank').value,reading=Number(el('reading').value),raw=el('reading').value;const liters=Math.round((reading-v.reading)*100)/100;if(!dest||raw.trim()===''||!Number.isFinite(reading)||liters<=0||liters>state.tanks[v.vehicle][source])return toast('Lectura inválida o litros insuficientes en el tanque');if(!confirm(`Registrar ${fmt(liters)} L desde tanque ${source+1} a tanque cliente ${dest}?`))return;invalidateDraft('reparto');state.tanks[v.vehicle][source]=Math.round((state.tanks[v.vehicle][source]-liters)*100)/100;v.lastSource=source;v.reading=reading;v.discharges.push({id:uid(),source,dest,reading,liters,segment:v.segment||0,at:now()});await persist();toast(`Registrados ${fmt(liters)} L. Selecciona otra vez el tanque del cliente.`)}
function calcRevised(v,id,nextReading){
 const array=v.discharges.map(d=>({...d})); const at=array.findIndex(d=>d.id===id);
 if(at<0)throw Error('No se encontró la descarga');
 array[at].reading=nextReading;
 for(let i=0;i<array.length;i++){
  const previous=i>0&&Number(array[i-1].segment||0)===Number(array[i].segment||0)?array[i-1].reading:0;
  const litres=Math.round((Number(array[i].reading)-Number(previous))*100)/100;
  if(!Number.isFinite(litres)||litres<=0)throw Error(`La lectura deja inválida la descarga ${i+1}. Comprueba la lectura siguiente.`);
  array[i].liters=litres;
 }
 const oldTotal=Array(state.tanks[v.vehicle].length).fill(0),newTotal=[...oldTotal];
 for(const d of v.discharges)oldTotal[d.source]+=d.liters;
 for(const d of array)newTotal[d.source]+=d.liters;
 const revisedStock=state.tanks[v.vehicle].map((n,i)=>Math.round((n+oldTotal[i]-newTotal[i])*100)/100);
 if(revisedStock.some(n=>n<0||n>1000))throw Error('La corrección dejaría existencias inválidas en un tanque.');
 return {array,revisedStock};
}
async function saveCorrection(){
 const v=state.openVisit,d=v?.discharges.find(d=>d.id===editingId);if(!d)return;
 const text=el('editReading').value,readNew=Number(text),destNew=el('editDest').value,reason=el('editReason').value;
 if(text.trim()===''||!Number.isFinite(readNew)||readNew<=0)return toast('Introduce una lectura válida');
 if(readNew===d.reading&&destNew===d.dest)return toast('No hay cambios que guardar');
 try{
  const {array,revisedStock}=calcRevised(v,d.id,readNew);
  const previous={source:d.source,dest:d.dest,reading:d.reading,liters:d.liters};
  const after=array.find(x=>x.id===d.id);after.dest=destNew;
  if(!confirm('Guardar corrección y actualizar existencias? Se conservará el registro original.'))return;
  invalidateDraft('reparto');state.tanks[v.vehicle]=revisedStock;
  v.discharges=array;
  v.reading=(v.resets||[]).at(-1)?.afterDischargeId===array.at(-1)?.id?0:(array.at(-1)?.reading||0);
  const audit={id:uid(),dischargeId:d.id,reason,at:now(),previous,next:{source:after.source,dest:after.dest,reading:after.reading,liters:after.liters}};
  v.corrections??=[];v.corrections.push(audit);
  state.log.push({title:'Corrección de descarga',at:audit.at,desc:`${v.client}: cliente T${previous.dest} → T${destNew}, lectura ${fmt(previous.reading)} → ${fmt(readNew)} L; motivo: ${reason}`});
  editingId=null;await persist();toast('Corrección guardada con historial');
 }catch(err){toast(err.message)}
}
async function resetMeter(){
 const v=state.openVisit;
 if(!v||!v.discharges.length)return toast('No hay descargas que separar');
 if((v.resets||[]).at(-1)?.afterDischargeId===v.discharges.at(-1).id)return toast('El contador ya figura reiniciado. Registra primero otra descarga.');
 if(!confirm('¿Has puesto a cero físicamente el contador de descarga? Solo confirma si realmente ha ocurrido.'))return;
 invalidateDraft('reparto');v.resets??=[];v.resets.push({id:uid(),at:now(),afterDischargeId:v.discharges.at(-1).id,readingBefore:v.reading});
 v.segment=(v.segment||0)+1;v.reading=0;
 state.log.push({title:'Reinicio excepcional del contador',at:now(),desc:`${v.client} · Inicio del tramo ${v.segment+1}`});
 await persist();toast('Contador reiniciado para el siguiente tramo');
}
async function reopenVisit(id){
 const v=state.visits.find(x=>x.id===id);
 if(!canReopen(v))return toast('Solo se puede reabrir la última visita sin movimientos posteriores del vehículo.');
 if(!confirm(`¿Reabrir la visita a ${v.client}?`))return;
 invalidateDraft('reparto');state.visits=state.visits.filter(x=>x.id!==id);
 v.reopened=true;delete v.ended;
 v.segment=v.discharges.at(-1)?.segment||0;
 v.reading=v.resets?.at(-1)?.afterDischargeId===v.discharges.at(-1)?.id?0:(v.discharges.at(-1)?.reading||0);
 v.resets??=[];v.corrections??=[];
 state.openVisit=v;state.vehicle=v.vehicle;state.page='visita';
 editingId=null;
 state.log.push({title:'Visita reabierta',at:now(),desc:`${v.client} · Correcciones permitidas antes del envío de jornada`});
 await persist();
}
async function finishVisit(){const v=state.openVisit;if(!v?.discharges.length)return toast('Registra al menos una descarga');if(!confirm(`Finalizar visita a ${v.client} con ${v.discharges.length} descargas?`))return;invalidateDraft('reparto');v.ended=now();state.visits.push(v);state.log.push({title:'Visita cerrada',desc:`${v.client} · ${v.discharges.length} descargas · ${fmt(v.discharges.reduce((s,d)=>s+d.liters,0))} L`,at:v.ended});state.openVisit=null;editingId=null;await persist();toast('Visita ficticia guardada')}
async function backup(){const profiles={};for(const [role,key] of Object.entries(profileKeys))profiles[role]=await dbGet(key);const bytes=new Blob([JSON.stringify({app:'control-de-tanques',phase:'demo-v08',exported:now(),profiles},null,2)],{type:'application/json'});const url=URL.createObjectURL(bytes);const a=document.createElement('a');a.href=url;a.download=`control-tanques-DEMO-perfiles-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000)}
async function handleActions(e){const page=e.target.closest('[data-page]');if(page){await navigate(page.dataset.page);return}const act=e.target.closest('[data-act]')?.dataset.act;if(act==='go-admin')return navigate('admin');if(act==='clear-opening'){if(confirm('¿Quitar los saldos iniciales ficticios? Los Excel importados y sus identificadores se conservarán.')){delete managerState().opening;await persist();}return;}if(act==='go-gerencia')return navigate('gerencia');if(act==='export-handoff')return exportHandoff();if(act==='go-jornada')return navigate('jornada');if(act==='make-xlsx')return sendJournal(false);if(act==='resend-xlsx')return sendJournal(true);if(act==='mark-sent')return markJournalSent();if(act==='go-carga')return navigate('carga');if(act==='go-visita')return navigate('visita');if(act==='finish-visit')return finishVisit();if(act==='reset-meter')return resetMeter();if(act==='cancel-edit'){editingId=null;return render()}if(act==='edit-discharge'){editingId=e.target.closest('[data-id]')?.dataset.id;return render()}if(act==='reopen-visit')return reopenVisit(e.target.closest('[data-id]')?.dataset.id);if(act==='backup')return backup();if(act==='check-update')return checkForUpdates(true);if(act==='apply-update')return applyUpdate();if(act==='reset'){if(confirm('¿Reiniciar solamente el perfil '+roleNames[state.role]+'? Antes guarda una copia JSON. Los otros perfiles y la copia anterior se mantienen.')){const role=state.role;state=cleanProfile(role);await persist()}}}
async function handleChange(e){if(e.target.id==='vehicle'||e.target.id==='loadVehicle'){state.vehicle=e.target.value;await persist()}if(e.target.id==='chooseRole'){await changeProfile(e.target.value)}if(e.target.id==='loadVehicle')render();if(e.target.id==='journalDate'){journalDate=e.target.value;render()}if(e.target.id==='journalWorker'){journalWorker=e.target.value.trim();}if(e.target.id==='managerFile'&&e.target.files?.[0])await importManagerFile(e.target.files[0]);if(e.target.id==='handoffFile'&&e.target.files?.[0])await receiveHandoff(e.target.files[0]);}
async function handleSubmit(e){if(!['loadForm','visitForm','dischargeForm','editForm','openingForm','provisionalForm'].includes(e.target.id))return;e.preventDefault();if(e.target.id==='openingForm')return saveOpening();if(e.target.id==='provisionalForm')return saveProvisional();if(e.target.id==='loadForm')await processLoad(e.target);if(e.target.id==='visitForm')await startVisit();if(e.target.id==='dischargeForm')await discharge();if(e.target.id==='editForm')await saveCorrection()}
async function init(){try{db=await openDB();await ensureProfiles();const previous=await dbGet('app');const rememberedRole=await dbGet('active-role-v08');const startingRole=profileKeys[rememberedRole]?rememberedRole:(profileKeys[previous?.role]?previous.role:'reparto');state=await dbGet(profileKeys[startingRole])||cleanProfile(startingRole);state.role=startingRole;await write();document.addEventListener('click',e=>handleActions(e).catch(console.error));document.addEventListener('change',e=>handleChange(e).catch(console.error));document.addEventListener('submit',e=>handleSubmit(e).catch(console.error));el('roleButton').addEventListener('click',()=>{state.page='admin';persist()});render();setupUpdates().catch(console.warn)}catch(err){el('screen').innerHTML='<div class="notice error">No se puede abrir el almacenamiento local. Comprueba que no estás en navegación privada o que Safari permite datos de sitios web.</div>';console.error(err)}}init();


// Actualizaciones GitHub Pages: version.json + service worker. Estado IndexedDB intacto.
function setUpdateStatus(message){const node=el('updateStatus');if(node)node.textContent=message}
function hasActiveOperation(){return Boolean(state?.openVisit)}
async function checkForUpdates(manual=false){
  if(updating)return;
  if(!navigator.onLine){if(manual)toast('Sin conexión: no se pueden buscar actualizaciones');setUpdateStatus('Sin conexión. Tus datos locales siguen disponibles.');return}
  lastUpdateCheck=Date.now();
  try{
    const resp=await fetch(`./version.json?t=${Date.now()}`,{cache:'no-store'});
    if(!resp.ok)throw new Error('No se pudo consultar version.json');
    const remote=await resp.json();
    if(!/^\d+\.\d+\.\d+$/.test(remote.version))throw new Error('Versión remota inválida');
    const compare=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]-y[i]}return 0};
    updateAvailable=compare(remote.version,APP_VERSION)>0;
    if(updateAvailable){setUpdateStatus(`Disponible: v${remote.version}`);toast(`Nueva versión ${remote.version} disponible`);}
    else {setUpdateStatus(`Tienes la versión más reciente (v${APP_VERSION}).`);if(manual)toast('Ya tienes la última versión')}
    if(state?.page==='admin'){render();setUpdateStatus(updateAvailable?`Nueva versión ${remote.version} disponible`:`Tienes la versión más reciente (v${APP_VERSION}).`)}
  }catch(err){console.warn('Error al comprobar actualización:',err);if(manual)toast('No se ha podido comprobar la versión. Inténtalo después.');setUpdateStatus('No se pudo comprobar la versión. La aplicación sigue funcionando.');}
}
async function applyUpdate(){
  if(!updateAvailable){toast('No hay ninguna actualización pendiente');return}
  if(hasActiveOperation()&&!confirm('Tienes una visita abierta. Es preferible terminarla antes de actualizar. ¿Continuar igualmente?'))return;
  if(!confirm('¿Aplicar la actualización ahora? Tus registros locales se conservarán.'))return;
  if(!navigator.onLine){toast('Necesitas conexión para actualizar');return}
  updating=true;toast('Preparando actualización…');
  try{
    if('serviceWorker' in navigator){
      const reg=await navigator.serviceWorker.getRegistration('./');
      if(reg){
        const waitForControl=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
        await reg.update();
        if(reg.waiting){reg.waiting.postMessage({type:'SKIP_WAITING'});await Promise.race([waitForControl,new Promise(r=>setTimeout(r,5000))])}
      }
    }
    // Invalidar la caché de recursos de la versión anterior antes de recargar.
    if('caches' in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('control-tanques-demo-')).map(k=>caches.delete(k)))}
    location.reload();
  }catch(err){console.error(err);updating=false;toast('No se completó la actualización. Vuelve a intentarlo.');}
}
async function setupUpdates(){
  if('serviceWorker' in navigator&&location.protocol==='https:'){
    try{await navigator.serviceWorker.register('./sw.js')}catch(err){console.warn('Service worker no disponible:',err)}
  }
  // Usar siempre versión remota no cacheada. Evitar consultas continuas.
  setTimeout(()=>checkForUpdates(false),1800);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&Date.now()-lastUpdateCheck>UPDATE_CHECK_MS)checkForUpdates(false);
  });
}
