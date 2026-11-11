/* VISURA · Módulo 14 · Gerencia R8 · Mejora exclusivamente visual.
   No lee ni escribe existencias, operaciones, autenticación, permisos o sincronización.
   Conserva el selector Visual/Simplificada y el cálculo existente de R7. */
(()=>{'use strict';
 const ASSETS={
  cisterna:{src:'assets/gerencia-r8-cisterna.jpg',alt:'Ilustración tridimensional aprobada de un camión cisterna Mahou con cabeza tractora'},
  camion:{src:'assets/gerencia-r8-camion.jpg',alt:'Camión Mahou de caja cerrada con puerta lateral y manguera, basado en el vehículo real aprobado'},
  furgoneta:{src:'assets/gerencia-r8-furgoneta.jpg',alt:'Furgoneta de reparto con identidad corporativa Voldis, ilustración aprobada'}
 };
 function image(item,className){
  const img=document.createElement('img');
  img.src=item.src;
  img.alt=item.alt;
  img.className=className;
  img.loading='lazy';
  img.decoding='async';
  img.draggable=false;
  return img;
 }
 function replaceVehicleArt(card,kind){
  const art=card.querySelector('.vr7-vehicle-art');
  if(!art||art.dataset.vr8Applied==='1')return;
  const img=image(ASSETS[kind],'vr8-vehicle-image');
  const caption=document.createElement('small');
  caption.textContent='Ilustración tridimensional del vehículo';
  art.replaceChildren(img,caption);
  if(kind==='furgoneta'){
   const logo=document.createElement('img');
   logo.className='vr8-voldis-logo';
   logo.src='assets/voldis-logo-autorizado-r8.jpeg';
   logo.alt='Voldis · logotipo aportado y autorizado';
   logo.loading='lazy';
   logo.decoding='async';
   art.appendChild(logo);
  }
  art.dataset.vr8Applied='1';
 }
 function apply(){
  const screen=document.getElementById('screen');
  const dashboard=screen?.querySelector('.vr7-dashboard');
  if(!dashboard)return;
  const cistern=dashboard.querySelector('.vr7-cistern');
  if(cistern&&!cistern.querySelector('.vr8-cistern-figure')){
   const figure=document.createElement('figure');
   figure.className='vr8-cistern-figure';
   figure.appendChild(image(ASSETS.cisterna,'vr8-cistern-image'));
   cistern.appendChild(figure);
  }
  for(const card of dashboard.querySelectorAll('.vr7-vehicle-card')){
   const heading=card.querySelector('.vr7-vehicle-head h4')?.textContent?.trim();
   if(heading==='Camión')replaceVehicleArt(card,'camion');
   else if(heading==='Furgoneta')replaceVehicleArt(card,'furgoneta');
  }
 }
 function init(){
  const root=document.getElementById('screen');
  if(!root)return;
  // Solo observar cambios de la raíz: R7 regenera su panel cuando navega.
  // Las sustituciones interiores R8 no provocan recursión.
  new MutationObserver(apply).observe(root,{childList:true});
  apply();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
