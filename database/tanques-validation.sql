create or replace function tanques_private.validate_record() returns trigger language plpgsql set search_path='' as $$
declare b jsonb; item jsonb; q numeric;
begin
 if new.key not like new.kind||':%' then raise exception 'Clave inválida'; end if;
 if TG_OP='UPDATE' then
  if new.key<>old.key or new.owner_id<>old.owner_id or new.kind<>old.kind then raise exception 'Identidad inmutable'; end if;
  if new.revision<>old.revision+1 then raise exception 'Revision incorrecta'; end if;
 elsif new.revision<>1 then raise exception 'Revision inicial incorrecta'; end if;
 if new.kind='movement' then
  if new.payload->>'type' is null or new.payload->>'type' not in ('CARGA','DESCARGA') or new.vehicle is null or
    new.payload->>'vehicle' is distinct from new.vehicle or new.key is distinct from 'movement:'||(new.payload->>'id') or
    coalesce((new.payload->>'litres')::numeric,0)<=0 or (new.payload->>'litres')::numeric>1000 or
    coalesce((new.payload->>'tank')::int,0) not between 1 and (case when new.vehicle='camion' then 3 else 1 end) or
    coalesce((new.payload->>'loss')::numeric,0) not between 0 and 1000 or new.payload->>'time' is null then raise exception 'Movimiento inválido'; end if;
  perform (new.payload->>'time')::timestamptz;
 end if;
 if new.kind in ('opening','adjustment') then
  b=case when new.kind='opening' then new.payload else new.payload->'next' end;
  if b is null or jsonb_typeof(b->'camion') is distinct from 'array' or jsonb_typeof(b->'furgoneta') is distinct from 'array' then raise exception 'Existencias incompletas'; end if;
  if jsonb_array_length(b->'camion')<>3 or jsonb_array_length(b->'furgoneta')<>1 then raise exception 'Número de tanques incorrecto'; end if;
  for item in select value from jsonb_array_elements((b->'camion')||(b->'furgoneta')) loop
   if jsonb_typeof(item) <> 'number' then raise exception 'Litros inválidos'; end if;
   q=item::text::numeric;if q<0 or q>1000 then raise exception 'Capacidad superada'; end if;
  end loop;
  if new.kind='opening' and (new.key<>'opening:global' or b->>'cisterna' is null) then raise exception 'Apertura inválida'; end if;
  if b->>'cisterna' is not null and ((b->>'cisterna')::numeric<0 or (b->>'cisterna')::numeric>25000) then raise exception 'Cisterna inválida'; end if;
  if new.kind='adjustment' then
   if new.payload->>'at' is null then raise exception 'Fecha de ajuste obligatoria'; end if;
   perform (new.payload->>'at')::timestamptz;
  end if;
 end if;
 new.updated_at=clock_timestamp(); return new;
end $$;
alter table public.tanques_members add constraint tanques_member_active_role check(not active or role<>'pendiente');
alter table public.tanques_members add constraint tanques_member_vehicle check(role<>'reparto' or not active or vehicle is not null);
