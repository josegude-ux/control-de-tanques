'use strict';
// Instalación ligera (0.10.9): la precarga del service worker debe ser pequeña y completa.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const files=[...new Set([...sw.matchAll(/'\.\/([^'?]*)/g)].map(m=>m[1]||'index.html'))];
const LIMIT=1.5e6;

test('Todos los archivos de la precarga existen',()=>{
 const missing=files.filter(f=>!fs.existsSync(path.join(root,f)));
 assert.deepEqual(missing,[]);
});

test(`La precarga completa pesa menos de ${LIMIT/1e6} MB`,()=>{
 const total=files.reduce((t,f)=>t+fs.statSync(path.join(root,f)).size,0);
 assert.ok(total<LIMIT,`precarga ${(total/1e6).toFixed(2)} MB`);
});

test('Ninguna imagen de la precarga supera 300 KB',()=>{
 const heavy=files.filter(f=>/\.(png|jpe?g|webp)$/i.test(f)).map(f=>[f,fs.statSync(path.join(root,f)).size]).filter(([,n])=>n>300e3);
 assert.deepEqual(heavy,[]);
});

// Dimensiones leídas de la cabecera del archivo, sin dependencias.
function size(file){
 const b=fs.readFileSync(path.join(root,file));
 if(b.slice(1,4).toString()==='PNG')return [b.readUInt32BE(16),b.readUInt32BE(20)];
 let i=2;while(i<b.length){if(b[i]!==0xFF){i++;continue}const m=b[i+1];if(m>=0xC0&&m<=0xC3)return [b.readUInt16BE(i+7),b.readUInt16BE(i+5)];i+=2+b.readUInt16BE(i+2);}
 throw Error('formato no reconocido '+file);
}
test('Las imágenes conservan proporción y tamaño útil en móvil',()=>{
 for(const f of ['assets/cargas-aprobada.png','assets/descargas-aprobada.png']){
  const [w,h]=size(f);assert.equal(w/h,3,f+' debe seguir siendo 3:1 (2172×724 en el HTML)');assert.ok(w>=1170,f+' cubre 390 px a 3x');
 }
 const [lw,lh]=size('logo-control-tanques.png');assert.equal(lw,lh);assert.ok(lw>=600);
 assert.deepEqual(size('Control_de_Tanques_icon_512.png'),[512,512],'icono del manifiesto 512×512');
});
