export const empty = () => ({pending:{}, records:{}, conflicts:{}, lastSuccess:null});
// Separate database per authenticated account; no cross-account pending uploads.
export async function openSyncStorage(accountId) {
  if (!accountId) throw new Error('Sesión requerida');
  const db = await new Promise((resolve,reject) => {
    const request = indexedDB.open('cdt-cloud-v1-' + accountId, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sync');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const read = () => new Promise((resolve,reject) => {
    const r = db.transaction('sync').objectStore('sync').get('state');
    r.onsuccess = () => resolve(r.result || empty());
    r.onerror = () => reject(r.error);
  });
  const transaction = change => new Promise((resolve,reject) => {
    const tx = db.transaction('sync','readwrite'), store = tx.objectStore('sync');
    const r = store.get('state');
    r.onsuccess = () => {try { const state = r.result || empty(); change(state); store.put(state,'state'); } catch(error) { tx.abort(); reject(error); }};
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Guardado cancelado'));
  });
  return {read, transaction, close:() => db.close()};
}
