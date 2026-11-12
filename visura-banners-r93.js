/* VISURA 14 R9.3 — presentación de accesos cuando una imagen no se puede cargar. */
(()=>{'use strict';
 const selector='.v23-chooser.visura-r4-banners .v23-grid>button>img';
 function update(img){
  if(!img.matches(selector)||!img.complete)return;
  img.parentElement.classList.toggle('vr93-banner-failed',img.naturalWidth===0);
 }
 document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement)update(e.target)},true);
 document.addEventListener('load',e=>{if(e.target instanceof HTMLImageElement)update(e.target)},true);
 const root=document.getElementById('screen');
 if(root){
  const scan=()=>root.querySelectorAll(selector).forEach(update);
  new MutationObserver(scan).observe(root,{childList:true,subtree:true});
  scan();
 }
})();
