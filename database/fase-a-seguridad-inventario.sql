-- FASE A — Seguridad e integridad de inventario (REVISIÓN; NO ejecutar aún en Supabase real)
-- Proyecto: control-de-tanques
-- Compatibilidad: requiere tablas/funciones de tanques-sync.sql (+ preferible tanques-validation.sql).
--
-- Incluye correcciones de revisión PR #2:
--   1) Escrituras solo vía RPC (sin INSERT/UPDATE directo que eluda stock).
--   2) Serialización de lotes de stock (pg_advisory_xact_lock) frente a concurrencia.
--   3) Rechazo explícito de movimientos sin apertura/ajuste de Gerencia.
--
-- Efectos sobre datos existentes:
--   * No borra filas ni auditoría.
--   * Restringe quién puede escribir `adjustment` (solo gerencia).
--   * Soft-delete de movement/visit solo permitido a gerencia.
--   * Inserts duplicados (misma key, base=0) → CONFLICT.
-- Despliegue coordinado: este SQL + frontend 0.10.1 juntos.

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
  -- Soft-delete de movement prohibido: restauraría litros en proyección. Conciliar con adjustment.
  if new.deleted and not old.deleted and new.kind='movement' then
    raise exception 'No se puede borrar un movimiento sincronizado; Gerencia debe conciliar con un ajuste de existencias';
  end if;
  if new.deleted and not old.deleted and new.kind='visit'
     and coalesce(tanques_private.member_role(),'')<>'gerencia' then
    raise exception 'Solo Gerencia puede anular visitas sincronizadas';
  end if;
 elsif new.revision<>1 then raise exception 'Revision inicial incorrecta'; end if;

 if new.kind='movement' then
  -- tank obligatorio y explícito (json null / ausente → inválido; no default a tanque 1).
  if new.payload->>'type' is null or new.payload->>'type' not in ('CARGA','DESCARGA') or new.vehicle is null
     or new.payload->>'vehicle' is distinct from new.vehicle
     or new.key is distinct from 'movement:'||(new.payload->>'id')
     or new.payload->'tank' is null or jsonb_typeof(new.payload->'tank')<>'number'
     or coalesce((new.payload->>'litres')::numeric,0)<=0 or (new.payload->>'litres')::numeric>1000
     or (new.payload->>'tank')::int not between 1 and (case when new.vehicle='camion' then 3 else 1 end)
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

-- Proyecta existencias (misma regla que sync-core.balances).
-- Si hay movimientos sin opening/ajuste → problema SIN_APERTURA.
create or replace function tanques_private.stock_problems() returns text[]
language plpgsql stable security definer set search_path='' as $$
declare
 opening jsonb; latest jsonb; base jsonb; adj_at text;
 m record; t int; qty numeric; loss numeric;
 cisterna numeric; camion numeric[]; furgoneta numeric[];
 problems text[] := array[]::text[];
 has_mov boolean;
begin
 -- Movements (incl. soft-deleted) cuentan para detectar actividad sin apertura.
 select exists(select 1 from public.tanques_records where kind='movement') into has_mov;
 select payload into opening from public.tanques_records
  where kind='opening' and not deleted order by key limit 1;
 select payload into latest from public.tanques_records
  where kind='adjustment' and not deleted order by payload->>'at' desc nulls last limit 1;
 base := coalesce(latest->'next', opening);
 if base is null then
  if has_mov then return array['SIN_APERTURA']; end if;
  return problems;
 end if;
 adj_at := latest->>'at';
 cisterna := case when base->>'cisterna' is null then null else tanques_private.round2((base->>'cisterna')::numeric) end;
 camion := array[
   tanques_private.round2((base->'camion'->>0)::numeric),
   tanques_private.round2((base->'camion'->>1)::numeric),
   tanques_private.round2((base->'camion'->>2)::numeric)
 ];
 furgoneta := array[tanques_private.round2((base->'furgoneta'->>0)::numeric)];

 -- Proyectar TODOS los movements (también deleted): anulación ≠ restaurar saldo.
 for m in
   select payload from public.tanques_records
   where kind='movement'
     and coalesce((payload->>'affectsStock')::boolean, true) is not false
     and (adj_at is null or payload->>'time' > adj_at)
   order by payload->>'time', payload->>'id'
 loop
   if m.payload->'tank' is null or jsonb_typeof(m.payload->'tank')<>'number' then
     problems := problems || array[coalesce(m.payload->>'id','?')]; continue;
   end if;
   t := (m.payload->>'tank')::int-1;
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

-- Única vía de escritura: RPC con auth, can_write, bloqueo de stock y validación final.
-- SECURITY DEFINER: authenticated ya no tiene INSERT/UPDATE directo en la tabla.
create or replace function public.tanques_sync_batch(changes jsonb)
returns setof public.tanques_records
language plpgsql security definer set search_path='' as $$
declare
 c jsonb; r public.tanques_records; existing public.tanques_records;
 n int; problems text[]; uid uuid; role text; veh text;
begin
 uid := auth.uid();
 if uid is null then raise exception 'Usuario no autorizado'; end if;
 role := tanques_private.member_role();
 if role is null then raise exception 'Usuario no autorizado'; end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>500 then
   raise exception 'Lote inválido';
 end if;

 -- Serializa lecturas/escrituras de inventario entre dispositivos concurrentes.
 perform pg_advisory_xact_lock(881002301);

 for c in select value from jsonb_array_elements(changes) loop
  if c->>'kind' is null or c->>'key' is null then raise exception 'Cambio inválido'; end if;
  veh := nullif(c->>'vehicle','');
  if not tanques_private.can_write(c->>'kind', veh, c->'payload') then
    raise exception 'Permiso denegado: %', c->>'key';
  end if;

  if (c->>'base')::int=0 then
   begin
     insert into public.tanques_records(key,kind,owner_id,vehicle,payload,deleted)
     values(
       c->>'key', c->>'kind', uid, veh, c->'payload',
       coalesce((c->>'deleted')::boolean,false)
     ) returning * into r;
   exception when unique_violation then
     raise exception 'CONFLICT: %', c->>'key';
   end;
  else
   select * into existing from public.tanques_records where key=c->>'key' for update;
   if not found then raise exception 'CONFLICT: %', c->>'key'; end if;
   if existing.owner_id is distinct from uid and role is distinct from 'gerencia' then
     raise exception 'Permiso denegado: %', c->>'key';
   end if;
   if not tanques_private.can_write(existing.kind, veh, c->'payload') then
     raise exception 'Permiso denegado: %', c->>'key';
   end if;
   update public.tanques_records
     set payload=c->'payload', vehicle=veh,
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
   if problems @> array['SIN_APERTURA'] then
     raise exception 'STOCK: faltan existencias iniciales de Gerencia (opening/ajuste).';
   end if;
   raise exception 'STOCK: existencias inválidas tras el lote (%). Revise cargas/descargas o ajuste de Gerencia.',
     array_to_string(problems, ', ');
 end if;
end $$;

revoke all on function public.tanques_sync_batch(jsonb) from public, anon;
grant execute on function public.tanques_sync_batch(jsonb) to authenticated;

revoke all on function tanques_private.round2(numeric) from public, anon;
revoke all on function tanques_private.stock_problems() from public, anon, authenticated;
-- stock_problems es SECURITY DEFINER (lee la tabla completa para proyectar saldo);
-- authenticated no necesita EXECUTE directo; solo la RPC (también DEFINER) la invoca.
-- round2: GRANT a authenticated por compatibilidad; el trigger corre bajo el definer de la RPC.
grant execute on function tanques_private.round2(numeric) to authenticated;

-- Cerrar el bypass: nada de INSERT/UPDATE/DELETE directo a la tabla para clientes.
revoke insert, update, delete on public.tanques_records from authenticated;
revoke insert, update, delete on public.tanques_records from anon;
revoke insert, update, delete on public.tanques_records from public;
grant select on public.tanques_records to authenticated;
