/* VISURA-14 CP030 · R5 LAB · Vista de solo lectura. Sin operaciones de inventario. */
(()=>{'use strict';
let view=null;let cloud=null;const active=()=>!cloud?.connected?.()||Boolean(cloud?.member?.()?.active);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const authorized=s=>active();
const customerList=s=>{
 if(s?.role!=='gerencia'||!authorized(s))return '';
 const rows=Array.isArray(s?.customers)?s.customers:[];
 if(!rows.length)return '<p class="v23-note">Sin establecimientos en el catálogo LAB.</p>';
 return '<div class="v28-list"><h3>Establecimientos del catálogo R5</h3>'+rows.slice(0,12).map(c=>'<article class="v28-customer"><strong>'+esc(c?.nombre||'Sin nombre')+'</strong><span>'+esc(c?.poblacion||'Población no indicada')+'</span><small>Sin medición de nivel asociada</small></article>').join('')+'</div>';
};
const clients=s=>'<section class="v23 visura-interior-r6" aria-label="Descargas"><button data-visura="back">← Volver al inicio</button><h2>Descargas</h2><p class="v23-note">Referencia visual; sin niveles reales de clientes.</p><img class="visura-interior-hero" src="assets/descargas-aprobada.png" alt="Descargas: camión Bodega Mahou suministrando a los tanques Mahou del cliente">'+customerList(s)+(s?.role==='gerencia'&&authorized(s)?'<div class="v25-actions"><button data-page="clientes">Abrir clientes</button><button data-page="planificacion">Abrir planificación</button></div>':'')+'</section>';
const loads=s=>{
 const values=s?.tanks?.[s.vehicle], problems=s?.cloudStockProblems||[];
 const demo=cloud?.canOperate?.()===false;
 const validated=Boolean(s?.cloudStockReady)&&!problems.length&&Boolean(cloud?.connected?.())&&Boolean(cloud?.member?.()?.active)&&!demo;
 const preview=demo&&Boolean(s?.cloudStockReady)&&!problems.length;
 const good=v=>(validated||preview)&&typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1000;
 const all=Array.isArray(values)&&values.length&&values.every(good);
 const items=Array.isArray(values)?values.map((v,i)=>{const valid=good(v),pct=valid?Math.round(v/10):0;return '<article class="v23-tank"><h3>Tanque '+(i+1)+'</h3><div class="v23-cylinder" role="img" aria-label="'+(valid?(demo?'Nivel DEMO ':'Nivel ')+pct+' por ciento':'Nivel no validado')+'"><div class="v23-liquid" style="width:'+pct+'%"></div></div><p>'+(valid?esc(v.toLocaleString('es-ES'))+' L · '+pct+' %'+(demo?' · DEMO':''):'Saldo no validado')+'</p></article>'}).join(''):'<p>Sin tanques disponibles.</p>';
 const total=all?'<p class="v28-total">'+(demo?'Total ficticio':'Total')+': '+esc(values.reduce((a,b)=>a+b,0).toLocaleString('es-ES'))+' L</p>':'<p class="v23-note">Total no disponible: saldos sin validar.</p>';
 return '<section class="v23 visura-interior-r6" aria-label="Cargas"><button data-visura="back">← Volver al inicio</button><h2>Cargas</h2><p class="v23-note">'+(demo?'LAB · DATOS FICTICIOS · NO SON EXISTENCIAS REALES':validated?'Lectura de existencias conectadas':'Saldos sin validar')+'</p><img class="visura-interior-hero" src="assets/cargas-aprobada.png" alt="Cargas: camión cisterna Mahou abasteciendo al camión Bodega Mahou"><div class="v23-grid">'+items+'</div>'+total+'<div class="v25-actions">'+(['almacen','gerencia'].includes(s?.role)?'<button data-page="carga">Ir a carga</button>':'')+(['reparto','gerencia'].includes(s?.role)?'<button data-page="visita">Ir a descarga</button>':'')+'<button data-page="historial">Historial</button></div></section>';
};
window.VISURA_LAB_VISUAL={
 bindCloud(c){cloud=c},
 render(s,detail){if(s?.page!=='inicio'||detail){view=null;return null;}return view==='clientes'?clients(s):view==='cargas'?loads(s):null},
 chooser(){return '<section class="v23 v23-chooser"><h2>VISURA PREPARA · TANQUES</h2><p class="v23-note">R5 LAB · Selector visual integrado</p><div class="v23-grid"><button data-visura="clientes"><img src="referencia-clientes.jpg" alt="Tanques verticales"><strong>Tanques de clientes</strong></button><button data-visura="cargas"><img src="referencia-cargas.jpg" alt="Depósito horizontal"><strong>Nuestras cargas</strong></button></div></section>'},
 reset(){view=null},
 isOpen(){return view!==null},
 handle(e,s,rerender){const button=e.target.closest('[data-visura]');if(!button||s?.page!=='inicio'||!authorized(s))return false;const next=button.dataset.visura;if(!['back','clientes','cargas'].includes(next))return false;view=next==='back'?null:next;rerender();return true}
};
})();