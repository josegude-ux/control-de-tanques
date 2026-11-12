/* VISURA 14 R9.5 — clasificación de pantallas interiores exclusivamente visual. */
(()=>{'use strict';
 const root=document.getElementById('screen');if(!root)return;
 const pages=new Map([['Gerencia · Saldos y movimientos','balances'],['Gerencia · Importar jornadas','balances'],['Clientes · Gerencia','customers'],['Planificación · Gerencia','planner']]);
 function apply(){
  const heading=root.querySelector(':scope > h2.heading');
  const page=pages.get(heading?.textContent.trim());
  if(page)root.dataset.vr95Page=page;else delete root.dataset.vr95Page;
 }
 new MutationObserver(apply).observe(root,{childList:true});
 apply();
})();
