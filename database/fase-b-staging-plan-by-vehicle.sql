-- =============================================================================
-- FASE B — Planificación por vehículo a nivel API (staging DEMO)
-- =============================================================================
-- Destino ÚNICO: iuqmzpahyjganhppcsur
-- Prohibido:     oevetnszmfxeukcncwji
--
-- Prerrequisito: fase-b-staging-rls-read.sql ya aplicada.
-- NO EJECUTAR hasta autorización. NO aplicar en producción.
--
-- Problema: kind=plan se almacenaba como plan:SEMANA (vehicle NULL) con entregas
--   de camión y furgoneta; can_read daba a Reparto la fila completa.
-- Solución:
--   * Filas por vehículo: key plan:SEMANA|camion|furgoneta, columna vehicle set.
--   * can_read: Reparto solo si v = member.vehicle; Gerencia sigue viendo todo.
--   * Almacén: sin plan (igual que antes).
--   * Existencias: opening/adjustment/CARGA/DESCARGA sin cambios (compartidos).
--   * Auditoría: sin cambios (tanques_audit solo Gerencia).
--   * Compat: filas legacy plan:SEMANA (vehicle NULL) → solo Gerencia las lee;
--     el cliente Gerencia las reescribe al sync como filas por vehículo.
-- =============================================================================

do $$ begin
  raise notice 'FASE_B_PLAN_BY_VEHICLE: solo iuqmzpahyjganhppcsur — NUNCA oevetnszmfxeukcncwji';
end $$;

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

-- Política SELECT ya apunta a can_read; no hace falta recrearla.
-- Refuerzo idempotente sync_batch.
revoke all on function public.tanques_sync_batch(jsonb) from public, anon;
grant execute on function public.tanques_sync_batch(jsonb) to authenticated;

select 'FASE_B_STAGING_PLAN_BY_VEHICLE_LISTA — destino iuqmzpahyjganhppcsur — NO ejecutada automáticamente' as estado;
