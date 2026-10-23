// Transport-independent durable outbox. The adapter must persist atomically.
export const canonical = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
};
const copy = x => structuredClone(x);
export function createSync({storage, remote, online = () => navigator.onLine, uuid = () => crypto.randomUUID(), status = () => {}}) {
  let running, stopped = false, timer, listeners = [];
  async function enqueue(kind, id, data) {
    await storage.transaction(s => {
      const key = kind + ':' + id;
      const existing = s.pending[key];
      if (existing && canonical(existing.data) === canonical(data)) return;
      s.pending[key] = {kind, id, data: copy(data), mutation: uuid(), base: s.records[key]?.revision || 0};
      delete s.conflicts[key];
    });
    schedule(100);
  }
  async function cycle() {
    if (!online()) { status({state:'offline'}); return; }
    status({state:'syncing'});
    const initial = await storage.read();
    for (const [key, item] of Object.entries(initial.pending)) {
      if (initial.conflicts[key]) continue;
      const result = await remote.push(item);
      if (!result || !Number.isInteger(result.revision) || result.revision < 1 || !['ok','conflict'].includes(result.state)) throw new Error('Confirmación del servidor inválida');
      await storage.transaction(s => {
        if (result.state === 'conflict') { s.conflicts[key] = {remoteRevision: result.revision, mutation:item.mutation}; return; }
        s.records[key] = {...copy(item), revision:result.revision};
        if (s.pending[key]?.mutation === item.mutation) delete s.pending[key];
        else if (s.pending[key]) s.pending[key].base = result.revision;
      });
    }
    // Pull completes before any local write. A failed page cannot erase cached rows.
    const rows = await remote.pull();
    await storage.transaction(s => {
      for (const row of rows) {
        const key = row.kind + ':' + row.id;
        if (s.pending[key]) continue;
        if (!s.records[key] || row.revision >= s.records[key].revision) s.records[key] = copy(row);
      }
      s.lastSuccess = new Date().toISOString();
    });
    const final = await storage.read();
    status({state:Object.keys(final.conflicts).length?'conflict':'ready', pending:Object.keys(final.pending).length, conflicts:Object.keys(final.conflicts).length, lastSuccess:final.lastSuccess});
  }
  function sync() {
    if (running) return running;
    running = cycle().catch(error => {status({state:'error', message:error.message}); throw error;}).finally(() => {running = null;});
    return running;
  }
  function schedule(delay = 1000) {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => { sync().catch(() => {}).finally(() => schedule(30000)); }, delay);
  }
  function start(target = window) {
    stopped = false;
    const onOnline = () => schedule(0);
    const onVisible = () => {if (!target.document.hidden) schedule(0);};
    target.addEventListener('online', onOnline);
    target.document.addEventListener('visibilitychange', onVisible);
    listeners.push(() => target.removeEventListener('online', onOnline), () => target.document.removeEventListener('visibilitychange', onVisible));
    schedule(0);
  }
  function stop() {stopped = true; clearTimeout(timer); listeners.splice(0).forEach(fn => fn());}
  return {enqueue, sync, start, stop};
}
