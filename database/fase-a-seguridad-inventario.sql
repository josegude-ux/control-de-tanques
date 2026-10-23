-- FASE A — Seguridad e integridad de inventario (REVISIÓN; NO ejecutar aún en Supabase real)
-- Proyecto: control-de-tanques
-- Compatibilidad: requiere tablas/funciones de tanques-sync.sql (+ preferible tanques-validation.sql).
-- Efectos sobre datos existentes:
--   * No borra filas ni auditoría.
--   * Restringe quién puede escribir `adjustment` (solo gerencia).
--   * Rechaza lotes que dejen existencias inválidas (negativas / >capacidad).
--   * Soft-delete de movement/visit solo permitido a gerencia.
--   * Inserts duplicados (misma key, base=0) → CONFLICT (sin doble contabilización).
-- Despliegue coordinado: aplicar ESTE SQL y el frontend de la rama fix/fase-a-seguridad-inventario juntos.

create or replace function tanques_private.can_write(k text, v text, p jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
   select 1 from public.tanques_members m
   where m.user_id=(select auth.uid()) and m.active and (
     m.role='gerencia' or
     (m.role='almacen' and k='movement' and p->>'type'='CARGA') or
     (m.role='reparto' and v=m.vehicle and (
       k in ('visit','provisional') or (k='movement' and p->>'type'='DESCARGA')
     ))
   )
 );
$$;

create or replace function tanques_private.round2(n numeric) returns numeric
language sql immutable set search_path='' as $$
 select round(coalesce(n,0), 2);
$$;

create or replace function tanques_private.validate_record() returns trigger
language plpgsql set search_path='' as $$
declare b jsonb; item jsonb; q numeric;
begin
 if new.key not like new.kind||':%' then raise exception 'Clave inválida'; end if;
 if TG_OP='UPDATE' then
  if new.key<>old.key or new.owner_id<>old.owner_id or new.kind<>old.kind then raise exception 'Identidad inmutable'; end if;
  if new.revision<>old.revision+1 then raise exception 'Revision incorrecta'; end if;
  -- Soft-delete de movimientos/visitas: solo Gerencia (conservación de históricos).
  if new.deleted and not old.deleted and new.kind in ('movement','visit')
     and coalesce(tanques_private.member_role(),'')<>'gerencia' then
    raise exception 'Solo Gerencia puede anular movimientos o visitas sincronizados';
  end if;
 elsif new.revision<>1 then raise exception 'Revision inicial incorrecta'; end if;

 if new.kind='movement' then
  if new.payload->>'type' is null or new.payload->>'type' not in ('CARGA','DESCARGA') or new.vehicle is null
     or new.payload->>'vehicle' is distinct from new.vehicle
     or new.key is distinct from 'movement:'||(new.payload->>'id')
     or coalesce((new.payload->>'litres')::numeric,0)<=0 or (new.payload->>'litres')::numeric>1000
     or coalesce((new.payload->>'tank')::int,0) not between 1 and (case when new.vehicle='camion' then 3 else 1 end)
     or coalesce((new.payload->>'loss')::numeric,0) not between 0 and 1000
     or new.payload->>'time' is null then
    raise exception 'Movimiento inválido';
  end if;
  perform (new.payload->>'time')::timestamptz;
  new.payload = jsonb_set(new.payload,'{litres}',to_jsonb(tanques_private.round2((new.payload->>'litres')::numeric)),true);
  new.payload = jsonb_set(new.payload,'{loss}',to_jsonb(tanques_private.round2(coalesce((new.payload->>'loss')::numeric,0))),true);
 end if;

 if new.kind in ('opening','adjustment') then
  b=case when new.kind='opening' then new.payload else new.payload->'next' end;
  if b is null or jsonb_typeof(b->'camion') is distinct from 'array'
     or jsonb_typeof(b->'furgoneta') is distinct from 'array' then
    raise exception 'Existencias incompletas';
  end if;
  if jsonb_array_length(b->'camion')<>3 or jsonb_array_length(b->'furgoneta')<>1 then
    raise exception 'Número de tanques incorrecto';
  end if;
  for item in select value from jsonb_array_elements((b->'camion')||(b->'furgoneta')) loop
   if jsonb_typeof(item) <> 'number' then raise exception 'Litros inválidos'; end if;
   q=tanques_private.round2(item::text::numeric);
   if q<0 or q>1000 then raise exception 'Capacidad superada'; end if;
  end loop;
  if new.kind='opening' and (new.key<>'opening:global' or b->>'cisterna' is null) then
    raise exception 'Apertura inválida';
  end if;
  if b->>'cisterna' is not null and (tanques_private.round2((b->>'cisterna')::numeric)<0
     or tanques_private.round2((b->>'cisterna')::numeric)>25000) then
    raise exception 'Cisterna inválida';
  end if;
  if new.kind='adjustment' then
   if new.payload->>'at' is null then raise exception 'Fecha de ajuste obligatoria'; end if;
   perform (new.payload->>'at')::timestamptz;
  end if;
 end if;

 new.updated_at=clock_timestamp();
 return new;
end $$;

-- Proyecta existencias desde registros no borrados (misma regla que sync-core.balances).
create or replace function tanques_private.stock_problems() returns text[]
language plpgsql stable set search_path='' as $$
declare
 opening jsonb; latest jsonb; base jsonb; adj_at text;
 m record; t int; qty numeric; loss numeric;
 cisterna numeric; camion numeric[]; furgoneta numeric[];
 problems text[] := array[]::text[];
begin
 select payload into opening from public.tanques_records
  where kind='opening' and not deleted order by key limit 1;
 select payload into latest from public.tanques_records
  where kind='adjustment' and not deleted order by payload->>'at' desc nulls last limit 1;
 base := coalesce(latest->'next', opening);
 if base is null then return problems; end if;
 adj_at := latest->>'at';
 cisterna := case when base->>'cisterna' is null then null else tanques_private.round2((base->>'cisterna')::numeric) end;
 camion := array[
   tanques_private.round2((base->'camion'->>0)::numeric),
   tanques_private.round2((base->'camion'->>1)::numeric),
   tanques_private.round2((base->'camion'->>2)::numeric)
 ];
 furgoneta := array[tanques_private.round2((base->'furgoneta'->>0)::numeric)];

 for m in
   select payload from public.tanques_records
   where kind='movement' and not deleted
     and (adj_at is null or payload->>'time' > adj_at)
   order by payload->>'time', payload->>'id'
 loop
   t := coalesce((m.payload->>'tank')::int,0)-1;
   qty := tanques_private.round2((m.payload->>'litres')::numeric);
   loss := tanques_private.round2(coalesce((m.payload->>'loss')::numeric,0));
   if m.payload->>'vehicle'='camion' then
     if t<0 or t>2 or qty<=0 then problems := problems || array[m.payload->>'id']; continue; end if;
     if m.payload->>'type'='CARGA' then camion[t+1] := tanques_private.round2(camion[t+1]+qty-loss);
     else camion[t+1] := tanques_private.round2(camion[t+1]-qty); end if;
     if m.payload->>'type'='CARGA' and cisterna is not null then
       cisterna := tanques_private.round2(cisterna-qty);
     end if;
     if camion[t+1]<-0.001 or camion[t+1]>1000.001 or (cisterna is not null and cisterna<-0.001) then
       problems := problems || array[m.payload->>'id'];
     end if;
   elsif m.payload->>'vehicle'='furgoneta' then
     if t<>0 or qty<=0 then problems := problems || array[m.payload->>'id']; continue; end if;
     if m.payload->>'type'='CARGA' then furgoneta[1] := tanques_private.round2(furgoneta[1]+qty-loss);
     else furgoneta[1] := tanques_private.round2(furgoneta[1]-qty); end if;
     if m.payload->>'type'='CARGA' and cisterna is not null then
       cisterna := tanques_private.round2(cisterna-qty);
     end if;
     if furgoneta[1]<-0.001 or furgoneta[1]>1000.001 or (cisterna is not null and cisterna<-0.001) then
       problems := problems || array[m.payload->>'id'];
     end if;
   else
     problems := problems || array[coalesce(m.payload->>'id','?')];
   end if;
 end loop;
 return problems;
end $$;

create or replace function public.tanques_sync_batch(changes jsonb)
returns setof public.tanques_records
language plpgsql security invoker set search_path='' as $$
declare c jsonb; r public.tanques_records; n int; problems text[];
begin
 if auth.uid() is null or tanques_private.member_role() is null then
   raise exception 'Usuario no autorizado';
 end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>500 then
   raise exception 'Lote inválido';
 end if;

 for c in select value from jsonb_array_elements(changes) loop
  if (c->>'base')::int=0 then
   begin
     insert into public.tanques_records(key,kind,vehicle,payload,deleted)
     values(c->>'key',c->>'kind',c->>'vehicle',c->'payload',coalesce((c->>'deleted')::boolean,false))
     returning * into r;
   exception when unique_violation then
     raise exception 'CONFLICT: %', c->>'key';
   end;
  else
   update public.tanques_records
     set payload=c->'payload', vehicle=c->>'vehicle',
         deleted=coalesce((c->>'deleted')::boolean,false), revision=revision+1
     where key=c->>'key' and revision=(c->>'base')::int
     returning * into r;
   get diagnostics n=row_count;
   if n<>1 then raise exception 'CONFLICT: %', c->>'key'; end if;
  end if;
  return next r;
 end loop;

 problems := tanques_private.stock_problems();
 if coalesce(array_length(problems,1),0)>0 then
   raise exception 'STOCK: existencias inválidas tras el lote (%). Revise cargas/descargas o ajuste de Gerencia.',
     array_to_string(problems, ', ');
 end if;
end $$;

revoke all on function public.tanques_sync_batch(jsonb) from public, anon;
grant execute on function public.tanques_sync_batch(jsonb) to authenticated;

-- Mínimo privilegio: authenticated debe poder ejecutar helpers usados por
-- validate_record (trigger, SECURITY INVOKER) y tanques_sync_batch (SECURITY INVOKER).
-- Sin este GRANT, PostgREST/authenticated recibe "permission denied for function".
-- No se usa SECURITY DEFINER en round2/stock_problems: heredan RLS del invocador.
revoke all on function tanques_private.round2(numeric) from public, anon;
revoke all on function tanques_private.stock_problems() from public, anon;
grant execute on function tanques_private.round2(numeric) to authenticated;
grant execute on function tanques_private.stock_problems() to authenticated;
