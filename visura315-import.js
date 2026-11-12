/* VISURA 315 — importación inicial desde archivo privado. No contiene el catálogo. */
(()=>{'use strict';
let busy=false;
function eligible(){return typeof TankCloud!=='undefined'&&TankCloud.connected()&&TankCloud.member()?.active&&TankCloud.member()?.role==='gerencia'&&!TankCloud.isStaging()&&typeof state!=='undefined'&&state.role==='gerencia'&&state.page==='clientes'&&!(state.customers||[]).length;}
async function run(file){
  const origin='https://josegude-ux.github.io', base='https://oevetnszmfxeukcncwji.supabase.co', key="sb_publishable_HH9O16zA-hT7ElScoYOSUQ_u-tcD-ei";

  const stop=m=>{throw new Error(m)};
  if(!file || file.size!==36323) stop('Seleccione el fichero privado R2 original.');
  const raw=await file.arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!=='485d486b0b93ab89d23bcb69269565e85ccbaa36e387dcfb7822a4cf13b1dffc') stop('El fichero no es el catálogo R2 autorizado. No se ha escrito nada.');
  const changes=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  if(!Array.isArray(changes)||changes.length!==68)stop('Lote incorrecto.');
  if(location.origin!==origin || !location.pathname.startsWith('/control-de-tanques/') || location.pathname.includes('/demo/')) stop('Destino incorrecto. Abra la aplicación oficial, no DEMO.');
  if(typeof isR2PendingName!=='function' || typeof isR2PendingRoute!=='function' || !Array.from(document.scripts).some(x=>x.src.includes('315-review'))) stop('Falta publicar/activar la interfaz de consulta R2 protegida. No se ha escrito nada.');
  if(typeof TankCloud==='undefined' || !TankCloud.connected() || !TankCloud.member()?.active || TankCloud.member()?.role!=='gerencia' || TankCloud.isStaging()) stop('Inicie sesión en Gerencia en la aplicación oficial.');
  if(TankCloud.count() || Object.keys(TankCloud.meta()?.conflicts||{}).length || state?.openVisit || (state?.customers||[]).length) stop('Hay registros locales o pendientes: no se puede ejecutar este lote inicial.');
  const local=JSON.parse(localStorage.getItem('tanques-auth-v1')||'null');
  const token=local?.access_token;
  if(!token || Number(local.expires_at||0)*1000<=Date.now()+60000) stop('La sesión ha caducado o no está disponible. Vuelva a iniciar sesión normalmente.');
  const headers={apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'};
  async function request(path,options={}){const r=await fetch(base+path,{...options,headers:{...headers,...options.headers},cache:'no-store'});if(!r.ok)stop('Supabase rechazó la operación (HTTP '+r.status+'). No reintente automáticamente.');return r.json()}
  const user=await request('/auth/v1/user');
  const member=await request('/rest/v1/tanques_members?select=*&user_id=eq.'+encodeURIComponent(user.id));
  if(member.length!==1 || !member[0].active || member[0].role!=='gerencia' || TankCloud.member().user_id!==user.id) stop('Gerencia no verificada.');
  async function snapshot(){const [records,members,audit]=await Promise.all([request('/rest/v1/tanques_records?select=*&order=key.asc&limit=1000'),request('/rest/v1/tanques_members?select=*&order=user_id.asc&limit=1000'),request('/rest/v1/tanques_audit?select=*&order=id.asc&limit=1000')]);if([records,members,audit].some(a=>a.length>=1000))stop('Snapshot incompleto; detener.');return {records,members,audit};}
  const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
  const before=await snapshot();
  const expected=new Map(changes.map(c=>[c.key,c]));
  const checkComplete=rows=>rows.length===68 && rows.every(r=>{const c=expected.get(r.key);return c&&r.kind==='customer'&&!r.deleted&&r.revision===1&&r.owner_id===user.id&&stable(r.payload)===stable(c.payload)});
  const existing=before.records.filter(r=>r.kind==='customer'||r.key.startsWith('customer:'));
  if(existing.length){if(checkComplete(existing)){alert('R2 ya incorporado íntegramente. Sin reejecución.');return}stop('Existen clientes o claves previas. No se sobrescribe ni se repite el lote.');}
  if(before.records.length!==6 || before.records.filter(r=>r.kind==='movement'&&!r.deleted).length!==4 || before.records.filter(r=>r.kind==='visit'&&!r.deleted).length!==1 || before.audit.length!==10 || before.members.length!==1)stop('La base ha cambiado desde CP005; detener sin escribir.');
  const opening=before.records.find(r=>r.key==='opening:global'&&!r.deleted);
  if(opening?.payload?.camion?.length!==3||opening?.payload?.furgoneta?.length!==1)stop('No se acreditan los cuatro depósitos de vehículo.');
  // Backup privado cifrado, sin sesión ni credenciales. Cifrado PBKDF2 + AES-GCM; lectura verificada antes de escritura.
  const pass=prompt('Elija una frase de paso privada (mínimo 16 caracteres) para cifrar el respaldo de TANQUES. No la comparta.');
  if(!pass||pass.length<16)stop('Respaldo no creado.');
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12)), enc=new TextEncoder();
  const material=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
  const aes=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const plain=enc.encode(JSON.stringify({project:'oevetnszmfxeukcncwji',scope:'tanques',created:new Date().toISOString(),...before}));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,plain));
  const dec=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv},aes,ct));
  if(dec.length!==plain.length||dec.some((b,i)=>b!==plain[i]))stop('Copia no verificable.');
  const b64=a=>btoa(Array.from(a,b=>String.fromCharCode(b)).join(''));
  const artifact={format:'VISURA315-TANQUES-BACKUP-v1',kdf:'PBKDF2-SHA256',iterations:600000,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),ciphertext:b64(ct)};
  // El operador debe recuperar el fichero guardado, no basta el descifrado en memoria.
  const backup=new Blob([JSON.stringify(artifact)],{type:'application/json'}), url=URL.createObjectURL(backup);
  const saved=await new Promise((resolve,reject)=>{
    const d=document.createElement('dialog');d.style.cssText='max-width:540px;width:90%;padding:24px;border:1px solid #888;border-radius:12px;box-sizing:border-box;';
    const h=document.createElement('h2');h.textContent='Respaldo privado de TANQUES';
    const msg=document.createElement('p');msg.textContent='Descarga la copia cifrada, guárdala en una ubicación privada y vuelve a seleccionarla para verificar que es recuperable. Conserva la frase de paso fuera del archivo.';
    const a=document.createElement('a');a.href=url;a.download='VISURA-TANQUES-respaldo-privado-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.textContent='Descargar respaldo cifrado';a.style.display='block';a.style.margin='16px 0';
    const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';inp.style.maxWidth='100%';
    const label=document.createElement('label');label.style.cssText='display:flex;gap:8px;margin:16px 0;align-items:start';const chk=document.createElement('input');chk.type='checkbox';label.append(chk,document.createTextNode('He cerrado las demás sesiones y dispositivos TANQUES y confirmado que no hay otros escritores o sincronizaciones pendientes durante esta ventana. Conservo la frase de paso.'));
    const go=document.createElement('button');go.type='button';go.textContent='Verificar copia y continuar';go.disabled=true;
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar sin importar';cancel.style.marginLeft='12px';
    const enable=()=>{go.disabled=!inp.files?.length||!chk.checked};inp.addEventListener('change',enable);chk.addEventListener('change',enable);
    const finish=()=>{d.close();d.remove();URL.revokeObjectURL(url)};
    go.addEventListener('click',()=>{const f=inp.files?.[0];if(!f||!chk.checked)return;finish();resolve(f)});
    cancel.addEventListener('click',()=>{finish();reject(new Error('Cancelado antes de escribir.'))});d.addEventListener('cancel',e=>{e.preventDefault();finish();reject(new Error('Cancelado antes de escribir.'))});
    d.append(h,msg,a,inp,label,go,cancel);document.body.append(d);d.showModal();
  });
  if(saved.size!==backup.size)stop('Tamaño del respaldo guardado diferente; no se escribe.');
  const disk=JSON.parse(await saved.text());if(stable(disk)!==stable(artifact))stop('El archivo guardado no es el respaldo de esta sesión.');
  const from64=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));
  const restored=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(disk.iv)},aes,from64(disk.ciphertext)));
  if(restored.length!==plain.length||restored.some((b,i)=>b!==plain[i]))stop('El respaldo guardado no se puede recuperar íntegramente.');
  if(!confirm('Copia guardada verificada. ¿Incorporar ahora los 68 clientes en un único lote? No se borrarán ni actualizarán registros.'))stop('Cancelado antes de escribir.');
  // Relectura inmediata, sin reintento de escritura. No prueba exclusión de otros escritores.
  if(!TankCloud.connected()||!TankCloud.member()?.active||TankCloud.member().role!=='gerencia'||TankCloud.member().user_id!==user.id||TankCloud.count()||Object.keys(TankCloud.meta()?.conflicts||{}).length||state?.openVisit||(state?.customers||[]).length)stop('Han aparecido cambios locales o cambió la sesión.');
  if(stable(await snapshot())!==stable(before))stop('La base cambió durante el respaldo. No se ha escrito nada.');
  let failure=null;try{await request('/rest/v1/rpc/tanques_sync_batch',{method:'POST',body:JSON.stringify({changes})})}catch(e){failure=e}
  // Incluso con ACK perdido, relectura; jamás reenviar el lote a ciegas.
  const after=await snapshot();const customers=after.records.filter(r=>r.kind==='customer'||r.key.startsWith('customer:'));
  if(!checkComplete(customers)){if(failure)stop('Resultado no confirmado. Consulte coordinación; no reintente.');stop('No se acredita el lote completo; detener.');}
  const untouched=after.records.filter(r=>!expected.has(r.key));
  const previousAudit=after.audit.filter(r=>before.audit.some(x=>x.id===r.id));const newAudit=after.audit.filter(r=>!before.audit.some(x=>x.id===r.id));
  if(stable(untouched)!==stable(before.records)||stable(after.members)!==stable(before.members)||stable(previousAudit)!==stable(before.audit)||newAudit.length!==68||newAudit.some(r=>r.actor_id!==user.id||!expected.has(r.record_key)||r.previous!==null)||new Set(newAudit.map(r=>r.record_key)).size!==68)stop('Lote presente, pero existen diferencias de histórico/auditoría que requieren conciliación. No se reintenta.');
  const totals=customers.reduce((v,r)=>[v[0]+r.payload.tanques250,v[1]+r.payload.tanques500],[0,0]);if(totals[0]!==164||totals[1]!==35)stop('Capacidad inconsistente.');
  console.info('VISURA 315: 68 clientes, 199 tanques nominales, 58.500 L; seis registros previos y 68 auditorías nuevas verificados.');
  alert('68 clientes incorporados y verificados. Abra Gerencia → Clientes tras sincronizar la aplicación.');
}
function open(){
 if(busy||!eligible())return;
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
 input.style.cssText='position:fixed;left:-9999px;top:0;';document.body.append(input);
 input.addEventListener('cancel',()=>input.remove(),{once:true});
 input.addEventListener('change',async()=>{const file=input.files?.[0];input.remove();if(!file||busy||!eligible())return;busy=true;try{await run(file)}catch(e){alert('VISURA 315: '+e.message)}finally{busy=false;}},{once:true});
 input.click();
}
window.Visura315InitialImport=Object.freeze({open,eligible});
})();
