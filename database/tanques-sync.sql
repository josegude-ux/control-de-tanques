-- Control de Tanques: separate tables, existing Cargas tables are untouched.
create schema if not exists tanques_private;
revoke all on schema tanques_private from public;
grant usage on schema tanques_private to authenticated;
create table public.tanques_members (
 user_id uuid primary key references auth.users(id),
 nombre text not null default '',
 role text not null default 'pendiente' check(role in ('pendiente','gerencia','almacen','reparto')),
 vehicle text check(vehicle in ('camion','furgoneta')),
 active boolean not null default false
);
alter table public.tanques_members enable row level security;
create function tanques_private.member_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.tanques_members where user_id=(select auth.uid()) and active and (select auth.uid()) is not null
$$;
revoke all on function tanques_private.member_role() from public;
grant execute on function tanques_private.member_role() to authenticated;
create policy member_read on public.tanques_members for select to authenticated using(user_id=(select auth.uid()) or (select tanques_private.member_role())='gerencia');
create policy member_request on public.tanques_members for insert to authenticated with check(user_id=(select auth.uid()) and role='pendiente' and not active and vehicle is null);
create policy member_admin on public.tanques_members for update to authenticated using((select tanques_private.member_role())='gerencia') with check((select tanques_private.member_role())='gerencia');
grant select,insert,update on public.tanques_members to authenticated;
insert into public.tanques_members(user_id,nombre,role,active)
 select id,nombre,'gerencia',true from public.usuarios_app where activo and rol='administrador';
create table public.tanques_records (
 key text primary key check(length(key) between 1 and 250),
 kind text not null check(kind in ('movement','visit','customer','plan','opening','adjustment','provisional')),
 owner_id uuid not null default auth.uid() references auth.users(id),
 vehicle text check(vehicle in ('camion','furgoneta')),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 deleted boolean not null default false,
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
create index tanques_records_owner on public.tanques_records(owner_id);
create index tanques_records_kind_vehicle on public.tanques_records(kind,vehicle);
alter table public.tanques_records enable row level security;
create function tanques_private.can_write(k text,v text,p jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.tanques_members m where m.user_id=(select auth.uid()) and m.active and (
 m.role='gerencia' or
 (m.role='almacen' and ((k='movement' and p->>'type'='CARGA') or k='adjustment')) or
 (m.role='reparto' and v=m.vehicle and (k in ('visit','provisional') or (k='movement' and p->>'type'='DESCARGA')))))
$$;
revoke all on function tanques_private.can_write(text,text,jsonb) from public;
grant execute on function tanques_private.can_write(text,text,jsonb) to authenticated;
create policy records_read on public.tanques_records for select to authenticated using(
 (select tanques_private.member_role()) is not null and
 (kind <> 'visit' or owner_id=(select auth.uid()) or (select tanques_private.member_role())='gerencia'));
create policy records_insert on public.tanques_records for insert to authenticated with check(owner_id=(select auth.uid()) and tanques_private.can_write(kind,vehicle,payload));
create policy records_update on public.tanques_records for update to authenticated using(
 (owner_id=(select auth.uid()) or (select tanques_private.member_role())='gerencia') and tanques_private.can_write(kind,vehicle,payload)
) with check((owner_id=(select auth.uid()) or (select tanques_private.member_role())='gerencia') and tanques_private.can_write(kind,vehicle,payload));
grant select,insert,update on public.tanques_records to authenticated;
create table public.tanques_audit (
 id bigint generated always as identity primary key,
 record_key text not null references public.tanques_records(key),
 actor_id uuid not null references auth.users(id),
 changed_at timestamptz not null default now(),
 previous jsonb,
 current_value jsonb not null
);
create index tanques_audit_record on public.tanques_audit(record_key);
create index tanques_audit_actor on public.tanques_audit(actor_id);
alter table public.tanques_audit enable row level security;
grant select on public.tanques_audit to authenticated;
create policy audit_read on public.tanques_audit for select to authenticated using((select tanques_private.member_role())='gerencia');
create function tanques_private.validate_record() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.key<>old.key or new.owner_id<>old.owner_id or new.kind<>old.kind then raise exception 'Identidad inmutable'; end if;
  if new.revision<>old.revision+1 then raise exception 'Revision incorrecta'; end if;
 elsif new.revision<>1 then raise exception 'Revision inicial incorrecta'; end if;
 if new.kind='movement' and (new.payload->>'type' is null or new.payload->>'type' not in ('CARGA','DESCARGA') or new.vehicle is null or
    coalesce((new.payload->>'litres')::numeric,0)<=0 or (new.payload->>'litres')::numeric>1000 or
    coalesce((new.payload->>'tank')::int,0) not between 1 and (case when new.vehicle='camion' then 3 else 1 end) or
    coalesce((new.payload->>'loss')::numeric,0) not between 0 and 1000 or new.payload->>'time' is null) then
  raise exception 'Movimiento inválido';
 end if;
 new.updated_at=clock_timestamp(); return new;
end $$;
create trigger tanques_validate before insert or update on public.tanques_records for each row execute function tanques_private.validate_record();
create function tanques_private.audit_record() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null then raise exception 'Sesion requerida'; end if;
 insert into public.tanques_audit(record_key,actor_id,previous,current_value) values(new.key,auth.uid(),case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function tanques_private.audit_record() from public;
create trigger tanques_audit after insert or update on public.tanques_records for each row execute function tanques_private.audit_record();
create function public.tanques_sync_batch(changes jsonb) returns setof public.tanques_records language plpgsql security invoker set search_path='' as $$
declare c jsonb; r public.tanques_records; n int;
begin
 if auth.uid() is null or tanques_private.member_role() is null then raise exception 'Usuario no autorizado'; end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>500 then raise exception 'Lote inválido'; end if;
 for c in select value from jsonb_array_elements(changes) loop
  if (c->>'base')::int=0 then
   insert into public.tanques_records(key,kind,vehicle,payload,deleted) values(c->>'key',c->>'kind',c->>'vehicle',c->'payload',coalesce((c->>'deleted')::boolean,false)) returning * into r;
  else
   update public.tanques_records set payload=c->'payload',vehicle=c->>'vehicle',deleted=coalesce((c->>'deleted')::boolean,false),revision=revision+1
    where key=c->>'key' and revision=(c->>'base')::int returning * into r;
   get diagnostics n=row_count;
   if n<>1 then raise exception 'CONFLICT: %',c->>'key'; end if;
  end if;
  return next r;
 end loop;
end $$;
revoke all on function public.tanques_sync_batch(jsonb) from public,anon;
grant execute on function public.tanques_sync_batch(jsonb) to authenticated;
