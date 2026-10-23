export function supabaseTransport(client) {
  return {
    async push(item) {
      const {data,error} = await client.rpc('cdt_apply_record', {p_kind:item.kind,p_id:item.id,p_data:item.data,p_base:item.base,p_mutation:item.mutation});
      if(error) throw error;
      return data;
    },
    async pull() {
      const rows = [];
      let after = '';
      for(let page = 0; page < 1000; page++) {
        let query = client.from('cdt_records').select('key,kind,id,data,revision').order('key').limit(200);
        if(after) query = query.gt('key',after);
        const {data,error} = await query;
        if(error) throw error;
        if(!Array.isArray(data)) throw new Error('Respuesta de sincronización inválida');
        rows.push(...data);
        if(data.length < 200) return rows;
        after = data.at(-1).key;
      }
      throw new Error('Sincronización demasiado grande; datos locales conservados');
    }
  };
}
