-- Isolated from Control de Cargas. No existing table is altered.
begin;
create table public.cdt_members (
 user_id uuid primary key references auth.users(id),
 role text not null check(role in ('gerencia','almacen','reparto')),
 active boolean not null default true
);
alter table public.cdt_members enable row level security;
create policy own_membership on public.cdt_members for select to authenticated using (user_id=auth.uid());
grant select on public.cdt_members to authenticated;
revoke all on public.cdt_members from anon;

create function public.cdt_role() returns text language sql stable security definer set search_path = '' as $$
 select role from public.cdt_members where user_id=auth.uid() and active;
$$;
revoke all on function public.cdt_role() from public;
grant execute on function public.cdt_role() to authenticated;

create table public.cdt_records (
 key text generated always as (kind || ':' || id) stored primary key,
 kind text not null check(kind in ('load','visit','customer','plan','opening','timing')),
 id text not null check(length(id) between 1 and 200),
 owner_id uuid not null references auth.users(id),
 data jsonb not null check(jsonb_typeof(data)='object'),
 revision integer not null check(revision>0),
 updated_at timestamptz not null default now()
);
alter table public.cdt_records enable row level security;
create policy visible_records on public.cdt_records for select to authenticated using (
 public.cdt_role()='gerencia' or
 (public.cdt_role() is not null and kind<>'timing' and (owner_id=auth.uid() or kind in ('load','customer','plan','opening')))
);
grant select on public.cdt_records to authenticated;
revoke all on public.cdt_records from anon;

create table public.cdt_mutations (
 mutation uuid primary key,
 actor uuid not null references auth.users(id),
 record_key text not null references public.cdt_records(key),
 revision integer not null,
 payload jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.cdt_mutations enable row level security;
create policy manager_audit on public.cdt_mutations for select to authenticated using (public.cdt_role()='gerencia');
grant select on public.cdt_mutations to authenticated;
revoke all on public.cdt_mutations from anon;

create function public.cdt_apply_record(p_kind text,p_id text,p_data jsonb,p_base integer,p_mutation uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 actor uuid := auth.uid();
 actor_role text := public.cdt_role();
 record_key text := p_kind || ':' || p_id;
 old public.cdt_records%rowtype;
 prior public.cdt_mutations%rowtype;
 next_revision integer;
begin
 if actor is null or actor_role is null then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 if p_kind is null or p_id is null or p_data is null or p_base is null or p_base<0 or p_mutation is null then raise exception 'Registro inválido'; end if;
 if not (actor_role='gerencia' or (actor_role='almacen' and p_kind in ('load','timing')) or (actor_role='reparto' and p_kind in ('visit','timing'))) then
   raise exception 'Operación no permitida para este perfil' using errcode='42501';
 end if;
 -- Serialize equal record keys, including their first insertion.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(record_key,0));
 select * into prior from public.cdt_mutations where mutation=p_mutation;
 if found then
   if prior.actor<>actor or prior.record_key<>record_key or prior.payload<>p_data then raise exception 'Identificador de envío reutilizado'; end if;
   return jsonb_build_object('state','ok','revision',prior.revision);
 end if;
 select * into old from public.cdt_records where key=record_key for update;
 if found then
   if old.owner_id<>actor and actor_role<>'gerencia' then raise exception 'Registro de otro usuario' using errcode='42501'; end if;
   if old.revision<>p_base then return jsonb_build_object('state','conflict','revision',old.revision); end if;
   next_revision := old.revision+1;
   update public.cdt_records set data=p_data, revision=next_revision, updated_at=now() where key=record_key;
 else
   if p_base<>0 then raise exception 'Registro remoto inexistente'; end if;
   next_revision := 1;
   insert into public.cdt_records(kind,id,owner_id,data,revision) values(p_kind,p_id,actor,p_data,next_revision);
 end if;
 insert into public.cdt_mutations(mutation,actor,record_key,revision,payload) values(p_mutation,actor,record_key,next_revision,p_data);
 return jsonb_build_object('state','ok','revision',next_revision);
end;
$$;
revoke all on function public.cdt_apply_record(text,text,jsonb,integer,uuid) from public;
grant execute on function public.cdt_apply_record(text,text,jsonb,integer,uuid) to authenticated;
commit;
-- Memberships must be provisioned by the project administrator, never by clients.
