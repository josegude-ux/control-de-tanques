/* VISURA 14 R9.4: clasificación estrictamente visual de pantallas existentes. */
(()=>{'use strict';
 const root=document.getElementById('screen'),nav=document.querySelector('nav.nav');
 if(!root||!nav)return;
 const types=new Map([['Carga','load'],['Carga de Gerencia (demo)','load'],['Descarga','unload'],['Visita cerrada','unload'],['Corrección de descarga','audit'],['Reinicio excepcional del contador','audit'],['Visita reabierta','audit'],['Visita de prueba eliminada','audit'],['Anulación pendiente de comunicar','audit'],['Ajuste de existencias · Gerencia','audit']]);
 function apply(){
  const page=nav.querySelector('button[data-page].active')?.dataset.page;
  root.classList.toggle('vr94-history',page==='historial');
  root.classList.toggle('vr94-admin',page==='admin');
  if(page!=='historial')return;
  for(const card of root.querySelectorAll(':scope > .card')){
   const row=card.querySelector(':scope > .row');
   const title=row?.querySelector(':scope > b');
   if(!title||!row.querySelector(':scope > .tag'))continue;
   card.classList.add('vr94-movement');
   card.dataset.vr94Kind=types.get(title.textContent.trim())||'other';
  }
 }
 new MutationObserver(apply).observe(root,{childList:true});
 new MutationObserver(apply).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
 apply();
})();
