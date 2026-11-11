/* VISURA-14 R7 — Solo capa visual de Gerencia. Sin cambios de estado operativo, permisos ni sincronización. */
(()=>{'use strict';
 const KEY='visura14.view.gerencia.r7';
 const CAPACITY=1000; // Capacidad por tanque ya utilizada en app.js.
 let mode='visual';
 const root=()=>document.getElementById('screen');
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const fmt=x=>Number(x).toLocaleString('es-ES',{maximumFractionDigits:2});
 function data(){try{return typeof state==='object'&&state?state:null}catch{return null}}
 function cloud(){try{return typeof TankCloud!=='undefined'?TankCloud:null}catch{return null}}
 function connected(){try{return Boolean(cloud()?.connected?.())}catch{return false}}
 function authorized(s){
  if(!s||s.role!=='gerencia')return false;
  if(!connected())return true; // Demo sin sesión: el panel tendrá un rótulo explícito.
  try{const m=cloud()?.member?.();return Boolean(m?.active&&m?.role==='gerencia')}catch{return false}
 }
 function verified(s){return connected()&&Boolean(s.cloudStockReady)&&!(s.cloudStockProblems||[]).length}
 function validArr(a){return Array.isArray(a)&&a.length>0&&a.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=CAPACITY)}
 function icon(kind){
  if(kind==='camion')return `<svg class="vr7-vehicle-svg" viewBox="0 0 290 124" role="img" aria-label="Ilustración de camión de caja cerrada" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="116" width="274" height="3" rx="2" fill="#c4d5e8"/><rect x="18" y="25" width="168" height="68" rx="8" fill="#2c241e" stroke="#6c5143" stroke-width="3"/><rect x="27" y="34" width="150" height="50" rx="4" fill="#463b35"/><path d="M28 34H177" stroke="#aa2737" stroke-width="5"/><rect x="189" y="53" width="62" height="40" rx="8" fill="#fafbfc" stroke="#8ca3b8" stroke-width="3"/><path d="M202 53h28l17 22h-45z" fill="#0d496d"/><path d="M12 93h254" stroke="#334960" stroke-width="7" stroke-linecap="round"/><circle cx="67" cy="98" r="15" fill="#1b2834" stroke="#e0e8f0" stroke-width="4"/><circle cx="67" cy="98" r="5" fill="#fff"/><circle cx="223" cy="98" r="15" fill="#1b2834" stroke="#e0e8f0" stroke-width="4"/><circle cx="223" cy="98" r="5" fill="#fff"/><path d="M37 69h112" stroke="#c9976b" stroke-width="2"/><text x="94" y="62" text-anchor="middle" font-size="16" font-weight="800" fill="#f2f0ed">TANQUE</text></svg>`;
  return `<svg class="vr7-vehicle-svg" viewBox="0 0 290 124" role="img" aria-label="Ilustración de furgoneta cerrada" xmlns="http://www.w3.org/2000/svg"><path d="M22 58q0-22 24-22h145q22 0 31 21l17 37H19V62z" fill="#f9fbfd" stroke="#8da3b9" stroke-width="3"/><path d="M190 45q11 0 15 12l12 27h-43V45z" fill="#0b4a75"/><path d="M53 40h110v42H53z" fill="#e9eef5"/><path d="M23 91h226" stroke="#536a80" stroke-width="6"/><path d="M39 76h117" stroke="#bc263f" stroke-width="5"/><circle cx="68" cy="99" r="15" fill="#1b2834" stroke="#e3eaf1" stroke-width="4"/><circle cx="68" cy="99" r="5" fill="#fff"/><circle cx="210" cy="99" r="15" fill="#1b2834" stroke="#e3eaf1" stroke-width="4"/><circle cx="210" cy="99" r="5" fill="#fff"/><text x="106" y="63" text-anchor="middle" font-size="16" font-weight="800" fill="#0b2647">FURGONETA</text></svg>`;
 }
 function tankRow(v,i,enabled){
  const okay=enabled&&typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=CAPACITY;
  const pct=okay?Math.round(v/CAPACITY*100):0;
  return `<li class="vr7-tank-row"><span class="vr7-tank-symbol" aria-hidden="true">▣</span><div class="vr7-tank-content"><div class="vr7-tank-top"><span>Tanque ${i+1}</span><strong>${okay?`${fmt(v)} / ${fmt(CAPACITY)} L`:'Sin validar'}</strong></div><div class="vr7-meter" role="progressbar" aria-label="Tanque ${i+1}" aria-valuemin="0" aria-valuemax="100" ${okay?`aria-valuenow="${pct}"`:'aria-valuetext="Saldo sin validar"'}><span style="width:${pct}%"></span></div></div>${okay?`<span class="vr7-percent">${pct}%</span>`:''}</li>`;
 }
 function vehicleCard(s,id,label,showNum,kind){
  const arr=s.tanks?.[id];const good=showNum&&validArr(arr);const status=showNum?(connected()?'Datos del sistema':'Demostración'):'Pendiente de validación';
  return `<article class="vr7-vehicle-card" aria-label="Existencias de ${label}"><header class="vr7-vehicle-head"><h4>${label}</h4><span class="vr7-state ${good?'vr7-ok':'vr7-pending'}">${status}</span></header><div class="vr7-vehicle-main"><div class="vr7-vehicle-art">${icon(kind)}<small>Ilustración del tipo de vehículo</small></div><div class="vr7-vehicle-info"><h5>Existencias de ${label.toLowerCase()}</h5>${Array.isArray(arr)&&arr.length?`<ul class="vr7-tanks">${arr.map((v,i)=>tankRow(v,i,good)).join('')}</ul>`:'<p class="vr7-warning">Sin depósitos disponibles.</p>'}</div></div><footer class="vr7-vehicle-total"><span>Total ${label.toLowerCase()}</span><strong>${good?`${fmt(arr.reduce((a,b)=>a+b,0))} L`:'No disponible'}</strong></footer></article>`;
 }
 function dashboard(s){
  const real=verified(s),shown=!connected()||real;
  const c=shown&&validArr(s.tanks?.camion),f=shown&&validArr(s.tanks?.furgoneta);
  const total=c&&f?fmt([...s.tanks.camion,...s.tanks.furgoneta].reduce((a,b)=>a+b,0))+' L':'No disponible';
  const cisternKnown=!(s.stockAdjustment?.cisternKnown===false);
  const cistern=shown&&cisternKnown&&typeof s.cisterna==='number'&&Number.isFinite(s.cisterna)&&s.cisterna>=0?fmt(s.cisterna)+' L':'No disponible';
  const warning=!connected()?'DATOS DE DEMOSTRACIÓN · No son existencias reales':!real?'SALDOS SIN VALIDAR · No se muestran cantidades pendientes de conciliación':'Saldos del sistema; los movimientos de otros dispositivos pueden estar pendientes de sincronización';
  return `<section class="vr7-dashboard ${mode==='simple'?'vr7-simple':''}" aria-label="Gerencia: existencias de camión y furgoneta"><div class="vr7-top"><div><span class="vr7-eyebrow">VISURA PREPARA · TANQUES</span><h3>Gerencia · Vehículos en operación</h3></div>${switcher()}</div><p class="vr7-source ${!connected()?'vr7-demo':''}">${warning}</p><section class="vr7-cistern" aria-label="Cisterna principal"><span class="vr7-cistern-icon" aria-hidden="true">◉</span><div><span>Cisterna principal</span><strong>${cistern}</strong></div></section><div class="vr7-vehicle-grid">${vehicleCard(s,'camion','Camión',shown,'camion')}${vehicleCard(s,'furgoneta','Furgoneta',shown,'furgoneta')}</div><div class="vr7-global-total"><span>Total en vehículos</span><strong>${total}</strong></div><p class="vr7-disclaimer">Saldo con los movimientos recibidos y los pendientes de este móvil. Los de otros móviles sin conexión llegarán cuando se conecten.</p></section>`;
 }
 function switcher(){return `<div class="vr7-switch" role="group" aria-label="Presentación de la pantalla de Gerencia"><span>Vista</span><button type="button" data-vr7-mode="visual" aria-pressed="${mode==='visual'}">Visual</button><button type="button" data-vr7-mode="simple" aria-pressed="${mode==='simple'}">Simplificada</button></div>`}
 function settings(){return `<section class="vr7-settings card" aria-label="Configuración de presentación"><h3>Presentación de Gerencia</h3><p>La vista simplificada oculta ilustraciones pero conserva simultáneamente los datos de Camión y Furgoneta. Esta preferencia es solo visual y se guarda en este navegador.</p>${switcher()}</section>`}
 function readMode(){try{mode=localStorage.getItem(KEY)==='simple'?'simple':'visual'}catch{mode='visual'}}
 function setMode(v){if(!['visual','simple'].includes(v))return;mode=v;try{localStorage.setItem(KEY,mode)}catch{};document.querySelectorAll('.vr7-dashboard').forEach(x=>x.classList.toggle('vr7-simple',v==='simple'));document.querySelectorAll('[data-vr7-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.vr7Mode===mode)))}
 function markOld(target){for(const card of target.querySelectorAll('.card')){const name=card.querySelector(':scope > h3')?.textContent?.trim();if(name==='Cisterna principal'||name==='Existencias del vehículo'||name==='Existencias del camión'||name==='Existencias de la furgoneta'){card.classList.add('vr7-old-card')}}const sel=target.querySelector('label.field:has(#vehicle)');if(sel)sel.classList.add('vr7-operator-selection')}
 function apply(){
  const s=data(),el=root();if(!el||!authorized(s))return;
  if(s.page==='inicio'&&!window.VISURA_LAB_VISUAL?.isOpen?.()){
   if(el.querySelector('.vr7-dashboard'))return;
   const target=el.querySelector('.visura-demo-panel')||el;
   const heading=target.querySelector('h2.heading');
   const wrap=document.createElement('div');wrap.innerHTML=dashboard(s);
   const panel=wrap.firstElementChild;
   if(heading&&heading.parentNode===target)heading.after(panel);else target.prepend(panel);
   markOld(target);
  }else if(s.page==='admin'){
   if(el.querySelector('.vr7-settings'))return;
   const heading=el.querySelector('h2.heading');
   const wrap=document.createElement('div');wrap.innerHTML=settings();
   if(heading&&heading.parentNode===el)heading.after(wrap.firstElementChild);else el.prepend(wrap.firstElementChild);
  }
 }
 function init(){const el=root();if(!el)return;readMode();el.addEventListener('click',e=>{const b=e.target.closest('button[data-vr7-mode]');if(b&&el.contains(b)){e.preventDefault();setMode(b.dataset.vr7Mode)}});const observer=new MutationObserver(()=>apply());observer.observe(el,{childList:true});apply()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
