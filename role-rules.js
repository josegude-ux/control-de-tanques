/* Reglas y etiquetas de perfil, compartidas con las pruebas de Node.
   No cambian roles internos ni datos: el rol sigue siendo 'gerencia' en IndexedDB,
   Supabase y cloud-sync.js; aquí solo se decide qué se permite y cómo se nombra en pantalla. */
(function(root){
 'use strict';
 /** Única fuente de los nombres visibles de cada perfil. */
 const ROLE_LABELS=Object.freeze({almacen:'Almacén',reparto:'Reparto',gerencia:'Operaciones'});
 function roleLabel(role){return ROLE_LABELS[role]||String(role||'');}
 const LEGACY=/\bGerencia\b|\bGERENCIA\b/g;
 /** Textos heredados (código anterior, cloud-sync.js, mensajes del servidor, historial ya guardado)
     aún dicen «Gerencia»: se muestran con la etiqueta vigente. No altera datos guardados. */
 function relabel(text){
  if(typeof text!=='string'||!text)return text;
  const label=roleLabel('gerencia');
  return text.replace(LEGACY,m=>m==='GERENCIA'?label.toLocaleUpperCase('es-ES'):label);
 }

 /** Una descarga abierta bloquea «Nueva carga» solo al perfil Reparto y solo para su propio vehículo.
     Gerencia ve las visitas abiertas de todos los conductores y Almacén no descarga: a ellos nunca les bloquea. */
 function openVisitBlocksLoad(s,vehicle=s?.vehicle){
  return s?.role==='reparto'&&!!s.openVisit&&s.openVisit.vehicle===vehicle;
 }
 /** Solo Reparto queda anclado al vehículo de su descarga abierta al elegir vehículo de carga. */
 function openVisitLocksLoadVehicle(s){
  return s?.role==='reparto'&&!!s.openVisit;
 }

 // ---- Navegador: aplica relabel a lo que se pinta (texto y atributos legibles), nunca a valores de formularios.
 const ATTRS=['aria-label','title','placeholder','alt'];
 const SKIP=/^(SCRIPT|STYLE|TEXTAREA)$/;
 const needs=t=>typeof t==='string'&&(t.includes('Gerencia')||t.includes('GERENCIA'));
 function relabelTree(node){
  if(!node||typeof document==='undefined')return;
  if(node.nodeType===3){if(needs(node.nodeValue)&&!SKIP.test(node.parentNode?.nodeName||''))node.nodeValue=relabel(node.nodeValue);return;}
  if(node.nodeType!==1&&node.nodeType!==9&&node.nodeType!==11)return;
  if(node.nodeType===1&&SKIP.test(node.nodeName))return;
  const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let t;
  while((t=walker.nextNode()))if(needs(t.nodeValue)&&!SKIP.test(t.parentNode?.nodeName||''))t.nodeValue=relabel(t.nodeValue);
  const els=node.nodeType===1?[node,...node.querySelectorAll('*')]:[...node.querySelectorAll('*')];
  for(const e of els)for(const a of ATTRS){const v=e.getAttribute(a);if(needs(v))e.setAttribute(a,relabel(v));}
  labelCloudRoles(node);
 }
 // cloud-sync.js (sin cambios) pinta claves internas en minúsculas en el panel de cuenta y en Gestionar accesos.
 // Las <option> de memberRole-* no tienen value: su texto ES el valor que se guarda en Supabase.
 // Se fija primero value con la clave interna y solo después se cambia el texto visible.
 const ACCOUNT_LINE=/^(.+ · )(gerencia|almacen|reparto)((?: · DEMO)?)$/;
 function labelCloudRoles(node){
  if(!node||node.nodeType!==1&&node.nodeType!==9&&node.nodeType!==11)return;
  const q=s=>node.nodeType===1&&node.matches(s)?[node,...node.querySelectorAll(s)]:[...node.querySelectorAll(s)];
  for(const o of q('select[id^="memberRole-"] option')){
   const key=o.hasAttribute('value')?o.getAttribute('value'):o.textContent.trim();
   if(!o.hasAttribute('value'))o.setAttribute('value',key);
   if(ROLE_LABELS[key]&&o.textContent!==ROLE_LABELS[key])o.textContent=ROLE_LABELS[key];
  }
  for(const p of q('.card > p')){
   if(p.children.length)continue;
   const m=ACCOUNT_LINE.exec(p.textContent);
   if(m)p.textContent=m[1]+roleLabel(m[2])+m[3];
  }
 }
 let installed=false;
 /** Se instala una vez: cubre pantallas, avisos, insignia de sincronización, capas visuales y diálogos. */
 function installLabels(target=document.body){
  if(installed||typeof document==='undefined'||!target)return;installed=true;
  relabelTree(target);
  new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)relabelTree(n);}).observe(target,{childList:true,subtree:true});
  for(const name of ['alert','confirm','prompt']){const orig=window[name].bind(window);window[name]=(msg,...rest)=>orig(relabel(msg),...rest);}
 }

 const api={ROLE_LABELS,roleLabel,relabel,relabelTree,labelCloudRoles,installLabels,openVisitBlocksLoad,openVisitLocksLoadVehicle};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.TankRoles=api;
})(typeof self!=='undefined'?self:this);
