/* PDF A4 del informe diario, sin librerías externas (funciona sin conexión).
   Helvetica estándar con codificación WinAnsi (tildes y ñ). Solo genera bytes. */
(function(root){
 'use strict';
 const W=595.28,H=841.89,M=36;
 // Anchura aproximada de Helvetica (milésimas de em) para recortar textos largos.
 const width=(s,size)=>{let w=0;for(const ch of String(s)){const c=ch.charCodeAt(0);
  w+=' ,.;:il|!\'`ìíîïj'.includes(ch)?278:'frtI()[]/-'.includes(ch)?333:'mMW'.includes(ch)?833:(c>=65&&c<=90)?667:(c>=48&&c<=57)?556:556;}
  return w*size/1000;};
 const fit=(s,max,size)=>{s=String(s??'');if(width(s,size)<=max)return s;while(s.length&&width(s+'…',size)>max)s=s.slice(0,-1);return s+'…';};
 const enc=s=>{const out=[];for(const ch of String(s)){let c=ch.charCodeAt(0);
   if(ch==='…')c=0x85;else if(ch==='→')c=0xBB;else if(ch==='−')c=0x2D;else if(ch==='—'||ch==='–')c=0x96;else if(ch==='€')c=0x80;else if(ch==='·')c=0xB7;else if(c>255)c=0x3F;
   if(c===0x28||c===0x29||c===0x5C)out.push(0x5C);out.push(c);}return out;};
 const num=n=>Number(n).toFixed(2).replace(/\.?0+$/,'');

 function Doc(){
  const pages=[];let ops=null;
  const api={
   page(){ops=[];pages.push(ops);return api;},
   text(x,y,s,size=9,bold=false,color=null){ops.push({t:'text',x,y,s,size,bold,color});return api;},
   right(x,y,s,size=9,bold=false){return api.text(x-width(s,size),y,s,size,bold);},
   line(x1,y1,x2,y2,w=0.5,gray=0.6){ops.push({t:'line',x1,y1,x2,y2,w,gray});return api;},
   rect(x,y,w,h,gray){ops.push({t:'rect',x,y,w,h,gray});return api;},
   count:()=>pages.length,
   build(footer){
    const objs=[];const add=s=>{objs.push(s);return objs.length;};
    const catalog=add(null),pagesObj=add(null);
    const f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids=[];
    pages.forEach((p,i)=>{
     if(footer)footer(api,i+1,pages.length,p);
     const bytes=[];const push=s=>{for(const ch of s)bytes.push(ch.charCodeAt(0));};
     for(const o of p){
      if(o.t==='text'){push(`BT ${o.color?o.color.join(' ')+' rg ':'0 0 0 rg '}/${o.bold?'F2':'F1'} ${o.size} Tf ${num(o.x)} ${num(H-o.y)} Td (`);bytes.push(...enc(o.s));push(') Tj ET\n');}
      if(o.t==='line')push(`${o.gray} G ${o.w} w ${num(o.x1)} ${num(H-o.y1)} m ${num(o.x2)} ${num(H-o.y2)} l S\n`);
      if(o.t==='rect')push(`${o.gray} g ${num(o.x)} ${num(H-o.y-o.h)} ${num(o.w)} ${num(o.h)} re f 0 g\n`);
     }
     const content=add({stream:bytes});
     kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`));
    });
    objs[catalog-1]=`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objs[pagesObj-1]=`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`;
    const out=[];const push=s=>{for(const ch of s)out.push(ch.charCodeAt(0));};
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');const offsets=[];
    objs.forEach((o,i)=>{offsets.push(out.length);push(`${i+1} 0 obj\n`);
     if(o&&o.stream){push(`<< /Length ${o.stream.length} >>\nstream\n`);out.push(...o.stream);push('\nendstream');}else push(o);
     push('\nendobj\n');});
    const xref=out.length;
    push(`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join(''));
    push(`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Uint8Array(out);
   }
  };
  return api;
 }

 const L=n=>Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:2})+' L';

 /** Dibuja el informe de TankReport.buildDailyReport y devuelve los bytes del PDF. */
 function renderReport(rep,R){
  const doc=Doc();let y=0;const bottom=H-M-24;
  const header=()=>{
   doc.page();y=M;
   doc.rect(0,0,W,6,0.2);
   doc.text(M,y+14,'VISURA PREPARA · TANQUES',9,true,[0.71,0.11,0.2]);
   doc.text(M,y+34,rep.title,16,true);
   const dateText=rep.date.split('-').reverse().join('/');
   doc.right(W-M,y+14,'Fecha del informe: '+dateText,9,true);
   doc.right(W-M,y+28,'Generado: '+R.madridStamp(rep.generatedAt)+' (Europe/Madrid)',8);
   const scope=[rep.operator?'Operario: '+rep.operator:'',rep.vehicleFilter?'Vehículo: '+rep.vehicleFilter:''].filter(Boolean).join(' · ');
   if(scope)doc.right(W-M,y+40,scope,8);
   doc.text(M,y+46,rep.cutoff?'Datos sincronizados hasta: '+R.madridStamp(rep.cutoff):'Sin sincronización registrada en este dispositivo',7.5,false,[0.4,0.4,0.4]);
   y+=54;
   if(rep.provisional){doc.rect(M,y,W-2*M,16,0.9);doc.text(M+6,y+11,'PROVISIONAL — '+fit(rep.reasons.join(' '),W-2*M-90,8),8,true,[0.7,0.1,0.1]);y+=22;}
   doc.line(M,y,W-M,y,0.8,0.3);y+=12;
  };
  const need=h=>{if(y+h>bottom)header();};
  const table=(title,cols,rows,totalRow)=>{
   need(48);
   doc.text(M,y+10,title,10,true);y+=16;
   const drawHead=()=>{doc.rect(M,y,W-2*M,14,0.92);let x=M+4;for(const c of cols){if(c.align==='right')doc.right(x+c.w-6,y+10,c.label,7.5,true);else doc.text(x,y+10,c.label,7.5,true);x+=c.w;}y+=16;};
   drawHead();
   if(!rows.length){doc.text(M+4,y+9,'Sin movimientos registrados',8,false,[0.4,0.4,0.4]);y+=16;}
   for(const r of rows){
    if(y+13>bottom){header();doc.text(M,y+10,title+' (continuación)',10,true);y+=16;drawHead();}
    let x=M+4;for(const c of cols){const v=fit(r[c.key],c.w-8,8);if(c.align==='right')doc.right(x+c.w-6,y+9,v,8);else doc.text(x,y+9,v,8);x+=c.w;}
    doc.line(M,y+12.5,W-M,y+12.5,0.3,0.85);y+=13;
   }
   if(totalRow){need(16);doc.text(M+4,y+10,totalRow[0],8.5,true);doc.right(W-M-6,y+10,totalRow[1],8.5,true);y+=18;}
  };
  const summaryLines=(title,lines)=>{
   need(18+lines.length*13);
   doc.rect(M,y,W-2*M,16+lines.length*13,0.96);doc.text(M+6,y+12,title,9.5,true);y+=18;
   for(const [k,v] of lines){doc.text(M+12,y+9,k,8.5);doc.right(W-M-8,y+9,v,8.5,true);y+=13;}
   y+=8;
  };
  header();
  if(rep.empty){doc.text(M,y+12,'Sin movimientos registrados para esta fecha y este ámbito.',10);y+=26;}
  for(const v of rep.vehicles){
   need(60);
   doc.rect(M,y,W-2*M,20,0.2);doc.text(M+8,y+14,v.name.toUpperCase(),11,true,[1,1,1]);y+=28;
   if(rep.showLoads)table('Cargas (cisterna → '+v.name.toLowerCase()+')',
    [{key:'hour',label:'Hora',w:42},{key:'tank',label:'Tanque',w:48},{key:'litres',label:'Litros',w:70,align:'right'},{key:'loss',label:'Merma',w:60,align:'right'},{key:'author',label:'Operario',w:150},{key:'ref',label:'Referencia',w:153}],
    v.loads.map(l=>({hour:l.hour,tank:'T'+l.tank,litres:L(l.litres),loss:l.loss?L(l.loss):'—',author:l.author+(l.pending?' *':''),ref:l.ref})),
    ['Subtotal cargas · '+v.totals.loadCount+' mov. · merma '+L(v.totals.loss),L(v.totals.loads)]);
   if(rep.showDischarges)table('Descargas ('+v.name.toLowerCase()+' → cliente)',
    [{key:'hour',label:'Hora',w:38},{key:'client',label:'Cliente',w:133},{key:'tanks',label:'Origen → dest.',w:66},{key:'litres',label:'Litros',w:62,align:'right'},{key:'author',label:'Operario',w:92},{key:'ref',label:'Visita / ref.',w:68},{key:'status',label:'Estado',w:64}],
    v.discharges.map(d=>({hour:d.hour,client:d.client,tanks:'T'+d.sourceTank+' → '+d.destTank,litres:L(d.litres),author:d.author+(d.pending?' *':''),ref:d.visitRef+' / '+d.ref,status:d.status||'—'})),
    ['Subtotal descargas · '+v.totals.dischargeCount+' mov.',L(v.totals.discharges)]);
   const lines=[];
   if(rep.showLoads)lines.push(['Total cargas',L(v.totals.loads)],['Merma registrada (aparte)',L(v.totals.loss)]);
   if(rep.showDischarges)lines.push(['Total descargas',L(v.totals.discharges)]);
   if(rep.showLoads&&rep.showDischarges)lines.push(['Diferencia cargas − descargas',L(v.totals.difference)]);
   lines.push(['Número de movimientos',String(v.totals.loadCount+v.totals.dischargeCount)]);
   summaryLines('Resumen '+v.name,lines);
  }
  const t=rep.totals,g=[];
  if(rep.showLoads)g.push(['Cargas de todos los vehículos ('+t.loadCount+')',L(t.loads)],['Merma registrada (aparte)',L(t.loss)]);
  if(rep.showDischarges)g.push(['Descargas de todos los vehículos ('+t.dischargeCount+')',L(t.discharges)]);
  if(rep.showLoads&&rep.showDischarges)g.push(['Diferencia conjunta cargas − descargas',L(t.difference)]);
  summaryLines('RESUMEN GENERAL DEL DÍA',g);
  need(14*(rep.notes.length+1));
  for(const n of [...rep.notes,'* Operación guardada en el dispositivo y aún no sincronizada.'])
   {doc.text(M,y+9,fit(n,W-2*M,7.5),7.5,false,[0.35,0.35,0.35]);y+=12;}
  return doc.build((d,i,n,ops)=>{ops.push({t:'text',x:M,y:H-M+10,s:'VISURA PREPARA · TANQUES · '+rep.title+' · '+rep.date.split('-').reverse().join('/'),size:7,bold:false,color:[0.4,0.4,0.4]});
   const s='Página '+i+' de '+n;ops.push({t:'text',x:W-M-width(s,7),y:H-M+10,s,size:7,bold:false,color:[0.4,0.4,0.4]});});
 }
 const api={renderReport};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.TankReportPDF=api;
})(typeof self!=='undefined'?self:this);
