/* VISURA 14 R9: presentación transversal de recursos R8 y navegación.
   No escribe estado de negocio, no obtiene datos, no modifica permisos. */
(()=>{'use strict';
const KEY='visura14.view.gerencia.r7', ASSETS={cisterna:['assets/gerencia-r8-cisterna.jpg','Camión cisterna Mahou con cabeza tractora'],camion:['assets/gerencia-r8-camion.jpg','Camión Mahou de caja cerrada y puerta lateral'],furgoneta:['assets/gerencia-r8-furgoneta.jpg','Furgoneta de reparto con rótulo Voldis rojo']};
const root=document.getElementById('screen'),nav=document.querySelector('nav.nav');if(!root)return;
let mode='visual';try{mode=localStorage.getItem(KEY)==='simple'?'simple':'visual'}catch{}
const norm=t=>String(t||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const kind=v=>v==='camion'||v==='furgoneta'?v:null;
function picture(k,cls='vr9-image'){const im=document.createElement('img');im.className=cls;im.src=ASSETS[k][0];im.alt=ASSETS[k][1];im.loading='lazy';im.decoding='async';im.draggable=false;return im}
function figure(k){const f=document.createElement('figure');f.className='vr9-art';f.dataset.kind=k;f.append(picture(k));return f}
function attach(target,k,where='after'){if(!target||!k)return;const parent=target.parentElement;if(!parent)return;const next=where==='after'?target.nextElementSibling:parent.querySelector(':scope > .vr9-art');if(next?.classList.contains('vr9-art')){if(next.dataset.kind!==k){next.dataset.kind=k;next.replaceChildren(picture(k))}return}if(where==='after')target.after(figure(k));else target.prepend(figure(k))}
function syncMode(){const dash=root.querySelector('.vr7-dashboard');if(dash&&dash.classList.contains('vr7-simple')!==(mode==='simple'))dash.querySelector('button[data-vr7-mode="'+mode+'"]')?.click();root.classList.toggle('vr9-simple',mode==='simple');root.querySelectorAll('[data-vr9-mode],[data-vr7-mode]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.vr9Mode||b.dataset.vr7Mode)===mode)))}
function selection(){return kind(root.querySelector('#vehicle')?.value)||null}
function apply(){
 // La capa R8 ya coloca las escenas en Gerencia. La imagen de furgoneta contiene el rótulo rojo: retirar el recuadro duplicado.
 root.querySelectorAll('.vr8-voldis-logo').forEach(x=>x.remove());
 // Decorar solamente tarjetas ya renderizadas por el sistema; nunca crear existencias ni mostrar tarjetas ocultas de otros perfiles.
 const base=root.querySelector('.visura-demo-panel')||root;
 for(const card of base.querySelectorAll('.card')){
  if(card.classList.contains('vr7-old-card')||card.closest('.vr7-dashboard'))continue;
  const h=card.querySelector(':scope > h3'), title=norm(h?.textContent);
  if(title==='cisterna principal'){card.classList.add('vr9-summary');attach(h,'cisterna')}
  if(['existencias del vehiculo','existencias del camion','existencias de la furgoneta'].includes(title)){
   const k=title==='existencias del camion'?'camion':title==='existencias de la furgoneta'?'furgoneta':selection();if(k){card.classList.add('vr9-summary');attach(h,k)}
  }
  if(title.startsWith('saldo calculado')){
   for(const row of card.querySelectorAll(':scope > .row')){if(norm(row.firstElementChild?.textContent)==='cisterna principal')attach(row,'cisterna')}
   for(const h4 of card.querySelectorAll(':scope > h4')){const t=norm(h4.textContent);if(t==='camion'||t.startsWith('camion ·'))attach(h4,'camion');else if(t==='furgoneta'||t.startsWith('furgoneta ·'))attach(h4,'furgoneta')}
  }
 }
 // Formularios con selector explícito: la imagen sigue el vehículo mostrado sin tocar su valor o evento.
 for(const id of ['loadVehicle']){const sel=root.querySelector('#'+id);if(sel)attach(sel.closest('label'),kind(sel.value))}
 // Otros lugares con identidad de vehículo explícita, sin cambiar datos ni campos.
 const delivery=root.querySelector(':scope > h2.heading');const dt=norm(delivery?.textContent);
 if(dt==='descarga · camion')attach(delivery,'camion');else if(dt==='descarga · furgoneta')attach(delivery,'furgoneta');
 for(const [id,k] of [['stockC1','camion'],['stockF1','furgoneta'],['stockCistern','cisterna'],['openingCisterna','cisterna']]){const field=root.querySelector('#'+id);if(field)attach(field.closest('label'),k)}
 for(const h4 of root.querySelectorAll('#openingForm > h4')){const k=norm(h4.textContent);if(kind(k))attach(h4,k)}
 // Configuración visual para perfiles no Gerencia; el control de R7 permanece intacto.
 const heading=root.querySelector(':scope > h2.heading');const isSettings=heading&&['mas','configuracion de pruebas'].includes(norm(heading.textContent));
 if(isSettings&&!root.querySelector('.vr7-settings,.vr9-settings')){
  const box=document.createElement('section');box.className='card vr9-settings';box.setAttribute('aria-label','Configuración de presentación');
  box.innerHTML='<h3>Presentación de pantalla</h3><p>La vista simplificada oculta las ilustraciones. Los datos y controles se conservan.</p><div class="vr9-switch" role="group" aria-label="Vista"><button type="button" data-vr9-mode="visual">Visual</button><button type="button" data-vr9-mode="simple">Simplificada</button></div>';heading.after(box)
 }
 syncMode();
 if(nav)for(const b of nav.querySelectorAll('button[data-page]')){if(b.classList.contains('active'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')}
}
root.addEventListener('click',e=>{const own=e.target.closest('button[data-vr9-mode]'),old=e.target.closest('button[data-vr7-mode]');if(own){mode=own.dataset.vr9Mode;try{localStorage.setItem(KEY,mode)}catch{}syncMode()}else if(old){mode=old.dataset.vr7Mode;queueMicrotask(syncMode)}});
root.addEventListener('change',e=>{if(['vehicle','loadVehicle'].includes(e.target.id))queueMicrotask(apply)});
let queued=false;const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;apply()})}});observer.observe(root,{childList:true});
apply();
})();
