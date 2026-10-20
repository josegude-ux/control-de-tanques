'use strict';
// Prototipo fase 1: datos de demostración. No autentica perfiles ni exporta Excel.
const STORE='cdt_demo_v1';
const APP_VERSION='0.3.0';
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
const openDB=()=>new Promise((res,rej)=>{const r=indexedDB.open(STORE,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const read=()=>new Promise((res,rej)=>{const t=db.transaction('state','readonly').objectStore('state').get('app');t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)});
const write=()=>new Promise((res,rej)=>{const t=db.transaction('state','readwrite');t.objectStore('state').put(state,'app');t.oncomplete=res;t.onerror=()=>rej(t.error)});
const persist=async()=>{await write();render()};
const toast=t=>{const e=el('toast');e.textContent=t;e.style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>e.style.display='none',3500)};
const card=(body)=>`<div class="card">${body}</div>`;
const action=(text,act,secondary=false)=>`<button class="btn ${secondary?'secondary':''}" data-act="${act}">${text}</button>`;
const roleNames={almacen:'Almacén',reparto:'Reparto',gerencia:'Gerencia (vista de prueba)'};
function navbar(){el('roleButton').textContent=roleNames[state.role]+' ▾';const allowed=state.role==='almacen'?['inicio','carga','historial','admin']:state.role==='reparto'?['inicio','visita','historial','admin']:['inicio','carga','visita','historial','admin'];document.querySelectorAll('[data-page]').forEach(b=>{b.hidden=!allowed.includes(b.dataset.page);b.classList.toggle('active',b.dataset.page===state.page)})}
function home(){const tanks=state.tanks[state.vehicle];let txt=`<h2 class="heading">${state.role==='almacen'?'Almacén':state.role==='reparto'?'Mi vehículo':'Panel de pruebas'}</h2><div class="notice">Datos ficticios, guardados únicamente en este dispositivo. El selector de perfil es de demostración, NO un control de acceso.</div>`;
if(state.role==='almacen'||state.role==='gerencia')txt+=card(`<h3>Cisterna principal</h3><div class="big mono">${fmt(state.cisterna)} L</div><p class="muted tiny">Capacidad nominal 25.000 L · saldo ficticio</p>`);
txt+=`<label class="field">Vehículo<select id="vehicle" class="select"><option value="camion" ${state.vehicle==='camion'?'selected':''}>Camión</option><option value="furgoneta" ${state.vehicle==='furgoneta'?'selected':''}>Furgoneta</option></select></label>`;
txt+=card(`<h3>Existencias ${state.vehicle==='camion'?'del camión':'de la furgoneta'}</h3>${tanks.map((v,i)=>`<div class="tank-line"><div class="row"><b>Tanque ${i+1}</b><strong class="mono">${fmt(v)} / 1.000 L</strong></div><div class="meter"><div style="width:${v/10}%"></div></div></div>`).join('')}<div class="divider"></div><div class="row"><b>Total disponible</b><strong class="big mono">${fmt(tanks.reduce((a,b)=>a+b,0))} L</strong></div>`);
if(state.role==='almacen')txt+=action('Nueva carga de prueba','go-carga');
if(state.role==='reparto')txt+=action(state.openVisit?'Continuar visita':'Nueva visita de prueba','go-visita');
if(state.role==='gerencia')txt+=card('<h3>Fase 1</h3><p>La base central, las importaciones Excel y la autenticación real de Gerencia aún NO están implementadas.</p>');
return txt}
function loadPage(){let tanks=state.tanks[state.vehicle];return `<h2 class="heading">Carga individual</h2><div class="notice">Operación de prueba local. Un tanque por registro. Confirma que el contador físico se ha puesto a cero.</div><form id="loadForm" class="form"><label class="field">Vehículo<select id="loadVehicle"><option value="camion" ${state.vehicle==='camion'?'selected':''}>Camión</option><option value="furgoneta" ${state.vehicle==='furgoneta'?'selected':''}>Furgoneta</option></select></label><label class="field">Tanque del vehículo<select id="loadTank">${tanks.map((v,i)=>`<option value="${i}">Tanque ${i+1} · ${fmt(v)} L disponibles</option>`).join('')}</select></label><label class="field">Destino del sobrante<select id="residual"><option value="mantener">Conservar el sobrante</option><option value="desechar">Desechar sobrante como merma</option></select></label><label class="field">Lectura final del contador (litros cargados)<input id="loadLiters" inputmode="decimal" type="number" min="0.01" step="0.01" required placeholder="Ej. 200" /></label><label class="check"><input type="checkbox" id="zeroLoad" required /> He puesto el contador de carga a cero antes de iniciar esta operación.</label><button class="btn" type="submit">Confirmar carga de prueba</button></form><p class="hint">La v1 registra los movimientos y conserva los saldos locales. El control real del tiempo y la exportación XLSX llegarán en fases siguientes.</p>`}
function visitPage(){
 const v=state.openVisit, available=state.tanks[state.vehicle];
 if(!v)return `<h2 class="heading">Nueva visita</h2><div class="notice">Usa clientes ficticios. Esta fase no contiene el catálogo real de clientes.</div><form id="visitForm" class="form"><label class="field">Cliente de prueba<select id="client" required><option value="Cervecería Ejemplo">Cervecería Ejemplo</option><option value="Bar de Pruebas">Bar de Pruebas</option></select></label><label class="check"><input id="zeroVisit" type="checkbox" required> He puesto el contador de descarga a cero al llegar al cliente.</label><button class="btn" type="submit">Iniciar visita</button></form>${reopenList()}`;
 const editing=v.discharges.find(d=>d.id===editingId);
 return `<h2 class="heading">Visita en curso${v.reopened?' · Reabierta':''}</h2>${card(`<h3>${esc(v.client)}</h3><p class="muted tiny">Inicio: ${showTime(v.started)}</p><div class="row"><span>Descargas registradas</span><b>${v.discharges.length}</b></div><div class="row"><span>Contador del tramo actual</span><b>${fmt(v.reading)} L</b></div><p class="hint">Reinicios excepcionales: ${(v.resets||[]).length}</p>`)}
 ${editing?editForm(v,editing):`<form id="dischargeForm" class="form"><label class="field">Tanque de origen del vehículo<select id="sourceTank">${available.map((liters,i)=>`<option value="${i}" ${v.lastSource===i?'selected':''}>Tanque ${i+1} · ${fmt(liters)} L restantes</option>`).join('')}</select></label><label class="field">Tanque del cliente (obligatorio en cada descarga)<select id="destTank" required><option value="">Seleccionar depósito…</option><option value="1">Tanque cliente 1 · 500 L</option><option value="2">Tanque cliente 2 · 500 L</option><option value="3">Tanque cliente 3 · 250 L</option></select></label><label class="field">Nueva lectura acumulada del contador<input type="number" min="0" step="0.01" inputmode="decimal" id="reading" placeholder="Anterior: ${fmt(v.reading)} L" required /></label><p class="hint">El contador es único para todos los tanques. Cada lectura debe superar la anterior dentro del mismo tramo.</p><button class="btn" type="submit">Registrar descarga</button></form>${v.discharges.length?card(`<h3>Reinicio excepcional del contador</h3><p class="hint">Úsalo solo si has puesto a cero físicamente el contador durante esta visita. No modifica litros ya registrados.</p>${action('Registrar puesta a cero','reset-meter',true)}`):''}`}
 <h3 class="spaced">Descargas de esta visita</h3>${v.discharges.map((d,i)=>card(`<div class="row"><b>Descarga ${i+1}</b><b>${fmt(d.liters)} L</b></div><p class="tiny muted">Vehículo T${d.source+1} → Cliente T${d.dest} · Lectura ${fmt(d.reading)} L${d.segment?' · Tramo '+(d.segment+1):''}</p><button class="linklike" type="button" data-act="edit-discharge" data-id="${esc(d.id)}">Corregir descarga</button>`)).join('')}
 ${v.discharges.length&&!editing?action('Finalizar visita','finish-visit',true):''}
 <p class="hint">Las correcciones y los reinicios se anotan en el historial local. Todavía no existe el envío diario a Gerencia: solo datos de prueba.</p>`;
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
function historyPage(){const movements=[...state.log].reverse();return `<h2 class="heading">Historial local</h2><div class="notice">Se muestran también las correcciones, los reinicios del contador y la reapertura de visitas. Todavía no existe exportación Excel.</div>${movements.length?movements.map(m=>card(`<div class="row"><b>${esc(m.title)}</b><span class="tag">${showTime(m.at)}</span></div><p class="compact">${esc(m.desc)}</p>`)).join(''):'<div class="empty">Todavía no hay movimientos registrados.</div>'}`}
const updatePanel=()=>card(`<h3>Actualizaciones</h3><div class="row"><span>Versión instalada</span><b class="mono">${APP_VERSION}</b></div><p class="update-info">La app busca nuevas versiones al abrirse o regresar a primer plano si hay conexión. No se eliminan los datos locales.</p>${action('Buscar actualizaciones','check-update',true)}${updateAvailable?`<div class="update-ready"><h4>Nueva versión disponible</h4><p class="compact">Puedes instalar la nueva versión sin borrar los movimientos de prueba.</p>${action('Actualizar ahora','apply-update')}</div>`:''}<p class="update-info" id="updateStatus">${navigator.onLine?'Para buscar una nueva versión, toca el botón.':'Sin conexión: se mantiene la versión instalada.'}</p>`);
function adminPage(){return `<h2 class="heading">Configuración de pruebas</h2>${updatePanel()}${card(`<h3>Perfil de demostración</h3><p class="hint">La selección de perfil solo cambia la interfaz. No protege información sensible.</p><label class="field">Vista<select id="chooseRole"><option value="almacen" ${state.role==='almacen'?'selected':''}>Almacén</option><option value="reparto" ${state.role==='reparto'?'selected':''}>Reparto</option><option value="gerencia" ${state.role==='gerencia'?'selected':''}>Gerencia (demo)</option></select></label>`)}${card(`<h3>Copia de seguridad de pruebas</h3><p class="hint">Puedes descargar un JSON con el estado de prueba para guardarlo. No es el Excel diario de operaciones.</p>${action('Descargar copia JSON','backup',true)}`)}${card(`<h3>Restablecer demostración</h3><p>Elimina únicamente los datos de prueba almacenados en este navegador.</p>${action('Reiniciar datos ficticios','reset',true)}`)}${card(`<h3>Estado del desarrollo</h3><p class="compact">Fase 1: interfaz móvil, PWA y persistencia local de movimientos de prueba. Implementado en demo: correcciones auditadas, reinicio de contador y reapertura de visitas. Pendiente: Excel, control real de tiempos, permisos seguros, cifrado y conexión de Gerencia.</p>`)}`}
function render(){navbar();const pages={inicio:home,carga:loadPage,visita:visitPage,historial:historyPage,admin:adminPage};el('screen').innerHTML=pages[state.page]();}
async function navigate(page){if(editingId)editingId=null;if(state.openVisit && page==='carga')return toast('Finaliza primero la visita en curso');state.page=page;await persist()}
async function processLoad(form){const vehicle=el('loadVehicle').value,index=Number(el('loadTank').value),amount=Number(el('loadLiters').value),old=state.tanks[vehicle][index],discard=el('residual').value==='desechar',merma=discard?old:0;const remaining=discard?0:old;if(!el('zeroLoad').checked||!Number.isFinite(amount)||amount<=0||amount+remaining>1000||amount>state.cisterna)return toast('Revisa la cantidad, capacidad, cisterna y confirmación del contador');if(!confirm(`Registrar ${fmt(amount)} L al ${vehicle}, tanque ${index+1}${merma?` y merma de ${fmt(merma)} L`:''}?`))return;
state.tanks[vehicle][index]=remaining+amount;state.cisterna-=amount;const at=now();state.loads.push({id:uid(),vehicle,index,amount,merma,at});state.log.push({title:'Carga',desc:`${vehicle} · Tanque ${index+1} · ${fmt(amount)} L${merma?` · Merma ${fmt(merma)} L`:''}`,at});toast('Carga ficticia guardada');await persist()}
async function startVisit(){if(state.openVisit)return toast('Ya hay una visita abierta');if(!el('zeroVisit').checked)return toast('Confirma la puesta a cero del contador');state.openVisit={id:uid(),client:el('client').value,vehicle:state.vehicle,started:now(),reading:0,segment:0,resets:[],corrections:[],lastSource:0,discharges:[]};await persist()}
async function discharge(){const v=state.openVisit;if(!v)return;const source=Number(el('sourceTank').value),dest=el('destTank').value,reading=Number(el('reading').value),raw=el('reading').value;const liters=Math.round((reading-v.reading)*100)/100;if(!dest||raw.trim()===''||!Number.isFinite(reading)||liters<=0||liters>state.tanks[v.vehicle][source])return toast('Lectura inválida o litros insuficientes en el tanque');if(!confirm(`Registrar ${fmt(liters)} L desde tanque ${source+1} a tanque cliente ${dest}?`))return;state.tanks[v.vehicle][source]=Math.round((state.tanks[v.vehicle][source]-liters)*100)/100;v.lastSource=source;v.reading=reading;v.discharges.push({id:uid(),source,dest,reading,liters,segment:v.segment||0,at:now()});await persist();toast(`Registrados ${fmt(liters)} L. Selecciona otra vez el tanque del cliente.`)}
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
  state.tanks[v.vehicle]=revisedStock;
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
 v.resets??=[];v.resets.push({id:uid(),at:now(),afterDischargeId:v.discharges.at(-1).id,readingBefore:v.reading});
 v.segment=(v.segment||0)+1;v.reading=0;
 state.log.push({title:'Reinicio excepcional del contador',at:now(),desc:`${v.client} · Inicio del tramo ${v.segment+1}`});
 await persist();toast('Contador reiniciado para el siguiente tramo');
}
async function reopenVisit(id){
 const v=state.visits.find(x=>x.id===id);
 if(!canReopen(v))return toast('Solo se puede reabrir la última visita sin movimientos posteriores del vehículo.');
 if(!confirm(`¿Reabrir la visita a ${v.client}?`))return;
 state.visits=state.visits.filter(x=>x.id!==id);
 v.reopened=true;delete v.ended;
 v.segment=v.discharges.at(-1)?.segment||0;
 v.reading=v.resets?.at(-1)?.afterDischargeId===v.discharges.at(-1)?.id?0:(v.discharges.at(-1)?.reading||0);
 v.resets??=[];v.corrections??=[];
 state.openVisit=v;state.vehicle=v.vehicle;state.page='visita';
 editingId=null;
 state.log.push({title:'Visita reabierta',at:now(),desc:`${v.client} · Correcciones permitidas hasta el envío de jornada (pendiente de implementar)`});
 await persist();
}
async function finishVisit(){const v=state.openVisit;if(!v?.discharges.length)return toast('Registra al menos una descarga');if(!confirm(`Finalizar visita a ${v.client} con ${v.discharges.length} descargas?`))return;v.ended=now();state.visits.push(v);state.log.push({title:'Visita cerrada',desc:`${v.client} · ${v.discharges.length} descargas · ${fmt(v.discharges.reduce((s,d)=>s+d.liters,0))} L`,at:v.ended});state.openVisit=null;editingId=null;await persist();toast('Visita ficticia guardada')}
function backup(){const bytes=new Blob([JSON.stringify({app:'control-de-tanques',phase:'demo-1',exported:now(),state},null,2)],{type:'application/json'});const url=URL.createObjectURL(bytes);const a=document.createElement('a');a.href=url;a.download=`control-tanques-DEMO-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000)}
async function handleActions(e){const page=e.target.closest('[data-page]');if(page){await navigate(page.dataset.page);return}const act=e.target.closest('[data-act]')?.dataset.act;if(act==='go-carga')return navigate('carga');if(act==='go-visita')return navigate('visita');if(act==='finish-visit')return finishVisit();if(act==='reset-meter')return resetMeter();if(act==='cancel-edit'){editingId=null;return render()}if(act==='edit-discharge'){editingId=e.target.closest('[data-id]')?.dataset.id;return render()}if(act==='reopen-visit')return reopenVisit(e.target.closest('[data-id]')?.dataset.id);if(act==='backup')return backup();if(act==='check-update')return checkForUpdates(true);if(act==='apply-update')return applyUpdate();if(act==='reset'){if(confirm('¿Eliminar TODOS los movimientos de demostración de este dispositivo?')){state=baseline();await persist()}}}
async function handleChange(e){if(e.target.id==='vehicle'||e.target.id==='loadVehicle'){state.vehicle=e.target.value;await persist()}if(e.target.id==='chooseRole'){state.role=e.target.value;state.page='inicio';await persist()}if(e.target.id==='loadVehicle')render()}
async function handleSubmit(e){if(!['loadForm','visitForm','dischargeForm','editForm'].includes(e.target.id))return;e.preventDefault();if(e.target.id==='loadForm')await processLoad(e.target);if(e.target.id==='visitForm')await startVisit();if(e.target.id==='dischargeForm')await discharge();if(e.target.id==='editForm')await saveCorrection()}
async function init(){try{db=await openDB();state=await read()||baseline();await write();document.addEventListener('click',e=>handleActions(e).catch(console.error));document.addEventListener('change',e=>handleChange(e).catch(console.error));document.addEventListener('submit',e=>handleSubmit(e).catch(console.error));el('roleButton').addEventListener('click',()=>{state.page='admin';persist()});render();setupUpdates().catch(console.warn)}catch(err){el('screen').innerHTML='<div class="notice error">No se puede abrir el almacenamiento local. Comprueba que no estás en navegación privada o que Safari permite datos de sitios web.</div>';console.error(err)}}init();


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
