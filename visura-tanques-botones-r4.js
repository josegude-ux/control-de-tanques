/* VISURA TANQUES · presentación de tarjetas autorizadas · sin mutaciones de dominio.
   Envuelve solo chooser() existente; conserva data-visura y sus permisos.
   No cambia contadores, sesiones, IndexedDB, RPC, ni navegación. */
(()=>{'use strict';
  const v=window.VISURA_LAB_VISUAL;
  if(!v || typeof v.chooser!=='function') return;
  const prev=v.chooser.bind(v);
  v.chooser=function(...args){
    let html=prev(...args);
    if(typeof html!=='string') return html;
    if(!html.includes('data-visura="clientes"') || !html.includes('data-visura="cargas"')) return html;
    html=html.replace('v23 v23-chooser','v23 v23-chooser visura-r4-banners');
    html=html.replace('src="referencia-clientes.jpg" alt="Tanques verticales"',
      'src="assets/descargas-aprobada.png" width="2172" height="724" alt="Descargas: camión Bodega Mahou suministrando a los tres depósitos del cliente"');
    html=html.replace('src="referencia-cargas.jpg" alt="Depósito horizontal"',
      'src="assets/cargas-aprobada.png" width="2172" height="724" alt="Cargas: camión cisterna Mahou abasteciendo al camión Bodega Mahou por su puerta lateral"');
    html=html.replace('<strong>Tanques de clientes</strong>','<strong>Descargas</strong>');
    html=html.replace('<strong>Nuestras cargas</strong>','<strong>Cargas</strong>');
    return html;
  };
})();
