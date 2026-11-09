'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
class FakeDOMParser {
 parseFromString(xml) {
  const rows=[...xml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)].map(m=>m[1]);
  return {
   querySelector:()=>null,
   getElementsByTagName:tag=>tag==='row'?rows.map(row=>({
    getElementsByTagName:t=>t==='c'?[...row.matchAll(/<c[^>]*>(.*?)<\/c>/gs)].map(c=>({
     getElementsByTagName:k=>{
      const pattern=k==='t'?/<t[^>]*>(.*?)<\/t>/s:/<v[^>]*>(.*?)<\/v>/s;
      const match=c[1].match(pattern);
      return match?[{textContent:match[1]}]:[];
     }
    })):[]
   })):[]
  };
 }
}
const context={TextEncoder,TextDecoder,Uint8Array,DataView,Blob,DOMParser:FakeDOMParser};vm.createContext(context);
vm.runInContext(read('xlsx-local.js')+';globalThis.generate=SheetXLSX.generate',context);
vm.runInContext(read('plan-import-local.js')+';globalThis.parse=CDTPlanImport.parse',context);
const metadata=(version=1)=>[['Semana','2026-11-09'],['Vehículo','camion'],['Versión',version],['Estado','DEMO'],['Generado','2026-11-10']];
const header=['ID entrega','Fecha','Vehículo','Repartidor','Cliente','Población','Litros previstos','Dirección','Enlace Maps'];
const row=(date='2026-11-09',id='p1')=>[id,date,'camion','Iván','Cliente ficticio','Prueba',150,'',''];
async function roundtrip(rows,version=1){const blob=context.generate([['Plan semanal',metadata(version)],['Entregas',[header,...rows]]]);return context.parse(await blob.arrayBuffer());}
test('real XLSX generator to real parser roundtrip',async()=>{const p=await roundtrip([row()]);assert.equal(p.week,'2026-11-09');assert.equal(p.vehicle,'camion');assert.equal(p.entries[0].liters,150);});
test('real parser rejects next week',async()=>{await assert.rejects(()=>roundtrip([row('2026-11-16')]),/fecha|inválidos/);});
test('real parser rejects weekend',async()=>{await assert.rejects(()=>roundtrip([row('2026-11-14')]),/fecha|inválidos/);});
test('real parser rejects duplicate ID',async()=>{await assert.rejects(()=>roundtrip([row(),row('2026-11-10')]),/duplicados/);});
test('real parser rejects invalid amount',async()=>{await assert.rejects(()=>roundtrip([[...row().slice(0,6),-5,'','']]),/inválidos/);});
