-- =============================================================================
-- FASE B — Corrección RLS de LECTURA (staging DEMO)
-- =============================================================================
-- Destino ÚNICO: iuqmzpahyjganhppcsur
-- Prohibido:     oevetnszmfxeukcncwji
--
-- Prerrequisito: fase-b-staging-seguridad.sql ya aplicada.
-- NO EJECUTAR hasta autorización. NO aplicar en producción.
--
-- Problema: records_read dejaba leer casi todo (salvo visit ajena) a cualquier activo.
-- Solución: can_read(kind, vehicle, owner_id, payload) + política SELECT sustituida.
--
-- Lectura permitida (resumen):
--   Gerencia  → todo
--   Almacén   → opening, adjustment, movements CARGA/DESCARGA (saldos compartidos);
--               NO visit, provisional, customer, plan
--   Reparto   → opening, adjustment, movements CARGA/DESCARGA (saldos);
--               visit solo propias; provisional/plan solo de su vehículo (API);
--               NO customer ni visit/plan de otros
--   Planes:   filas plan:SEMANA|vehiculo (columna vehicle). Ver fase-b-staging-plan-by-vehicle.sql
--
-- Escritura: sin cambios (sigue solo vía tanques_sync_batch DEFINER + can_write).
-- Sync automática: pull() usa SELECT → RLS; RPC DEFINER escribe y valida stock
--   viendo todas las filas (stock_problems DEFINER).
-- =============================================================================

do $$ begin
  raise notice 'FASE_B_RLS_READ: solo iuqmzpahyjganhppcsur — NUNCA oevetnszmfxeukcncwji';
end $$;

-- Vehículo asignado al miembro activo (null si no aplica).
create or replace function tanques_private.member_vehicle() returns text
language sql stable security definer set search_path='' as $$
 select vehicle from public.tanques_members
  where user_id=(select auth.uid()) and active and (select auth.uid()) is not null
  limit 1;
$$;
revoke all on function tanques_private.member_vehicle() from public, anon;
grant execute on function tanques_private.member_vehicle() to authenticated;

-- ¿Puede el usuario activo leer esta fila?
create or replace function tanques_private.can_read(k text, v text, owner uuid, p jsonb)
returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.tanques_members m
   where m.user_id=(select auth.uid()) and m.active and (select auth.uid()) is not null
     and (
       m.role='gerencia'
       or (
         m.role='almacen' and (
           k in ('opening','adjustment')
           or (k='movement' and coalesce(p->>'type','') in ('CARGA','DESCARGA'))
         )
       )
       or (
         m.role='reparto' and (
           k in ('opening','adjustment')
           or (k='movement' and coalesce(p->>'type','') in ('CARGA','DESCARGA'))
           or (k='visit' and owner=(select auth.uid()))
           or (k='provisional' and v is not distinct from m.vehicle)
           or (k='plan' and v is not distinct from m.vehicle)
         )
       )
     )
 );
$$;
revoke all on function tanques_private.can_read(text,text,uuid,jsonb) from public, anon;
grant execute on function tanques_private.can_read(text,text,uuid,jsonb) to authenticated;

drop policy if exists records_read on public.tanques_records;
create policy records_read on public.tanques_records
 for select to authenticated
 using (tanques_private.can_read(kind, vehicle, owner_id, payload));

-- Refuerzo: sync_batch solo authenticated; anon/public sin EXECUTE (idempotente).
revoke all on function public.tanques_sync_batch(jsonb) from public, anon;
grant execute on function public.tanques_sync_batch(jsonb) to authenticated;

-- Documentar invariantes de la RPC DEFINER (sin cambiar firma):
-- * Exige auth.uid() + member_role() activo.
-- * can_write por cambio; owner check en UPDATE.
-- * Advisory lock + stock_problems (DEFINER lee todo el inventario).
-- * No concede SELECT amplio: el cliente solo ve filas vía records_read / can_read.

select 'FASE_B_STAGING_RLS_READ_LISTA — destino iuqmzpahyjganhppcsur — NO ejecutada automáticamente' as estado;
