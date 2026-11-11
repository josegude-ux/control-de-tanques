/* VISURA-14 · Interiores R6.1. Presentación exclusiva; no se leen ni modifican saldos, sesiones ni formularios.
   Los banners aprobados permanecen sin cambios y los controles son los originales de la aplicación. */
(()=>{'use strict';
 const opts={
  cargas:{label:'Cargas',desc:'Cisterna Mahou suministrando al camión Bodega Mahou por su puerta lateral',file:'assets/cargas-aprobada.png'},
  descargas:{label:'Descargas',desc:'Camión Bodega Mahou suministrando a los depósitos Mahou del cliente',file:'assets/descargas-aprobada.png'}
 };
 const esc=s=>String(s).replace(/[&<>"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]));
 function makeFigure(kind,existing){
  const x=opts[kind];
  const fig=document.createElement('figure');fig.className='visura-r61-figure';fig.dataset.kind=kind;
  const header=document.createElement('div');header.className='visura-r61-mobile-heading';
  header.innerHTML='<strong>'+x.label+'</strong><span>'+esc(x.desc)+'</span>';
  const clip=document.createElement('div');clip.className='visura-r61-clip';
  const img=existing||document.createElement('img');
  if(!existing)img.src=x.file;
  img.alt=x.desc+'. Imagen ilustrativa sin controles interactivos.';
  img.loading='eager';img.decoding='async';
  img.removeAttribute('width');img.removeAttribute('height');
  clip.appendChild(img);
  const caption=document.createElement('figcaption');caption.className='visura-r61-caption';
  caption.textContent='Imagen ilustrativa · La flecha del gráfico no es un botón';
  fig.append(header,clip,caption);
  return fig;
 }
 function apply(root){
  if(!root)return;
  // Las páginas operativas de carga/descarga conservan exactamente sus formularios.
  const load=!!root.querySelector('#loadForm');
  const discharge=!!root.querySelector('#dischargeForm,#editForm,#extraVisitForm,#deliveryDate');
  if((load||discharge)&&!root.querySelector(':scope > .visura-r61-figure')){
   root.insertBefore(makeFigure(load?'cargas':'descargas'),root.firstChild);
  }
  // Detalles del selector visual de R6: reutilizar su imagen y mantener el botón Volver.
  const detail=root.querySelector('.visura-interior-r6');
  const hero=detail?.querySelector('img.visura-interior-hero');
  if(hero&&!hero.closest('.visura-r61-figure')){
   const kind=detail.getAttribute('aria-label')==='Cargas'?'cargas':'descargas';
   const anchor=document.createComment("VISURA R6.1 figura visual");
   hero.before(anchor);anchor.replaceWith(makeFigure(kind,hero));
  }
  // Retirar únicamente versionado interno en títulos de catálogo de referencia.
  const title=detail?.querySelector('.v28-list h3');
  if(title?.textContent==='Establecimientos del catálogo R5')title.textContent='Establecimientos del catálogo';
  const empty=Array.from(detail?.querySelectorAll('.v23-note')||[]).find(n=>n.textContent==='Sin establecimientos en el catálogo LAB.');
  if(empty)empty.textContent='Sin establecimientos disponibles en el catálogo de referencia.';
 }
 function init(){
  const root=document.getElementById('screen');if(!root)return;
  // Observar solo los hijos directos: el render existente sustituye este contenido.
  const obs=new MutationObserver(()=>apply(root));obs.observe(root,{childList:true});apply(root);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
