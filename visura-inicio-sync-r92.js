/* VISURA 14 R9.2: solo ubicación del panel de conexión. No cambia sincronización. */
(()=>{'use strict';
 const panel=document.getElementById('visuraCloudPanel');
 const main=document.getElementById('screen');
 const nav=document.querySelector('nav.nav');
 if(!panel||!main||!nav)return;
 function layout(){
  const home=!!nav.querySelector('button[data-page="inicio"].active');
  panel.classList.toggle('vr92-home',home);
  main.classList.toggle('vr92-home-layout',home);
  if(home){if(main.nextElementSibling!==panel)main.after(panel);}
  else if(panel.nextElementSibling!==main)main.before(panel);
 }
 new MutationObserver(layout).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
 layout();
})();
