-- Control de Tanques 0.10.4 — Reparto puede operar con camión o furgoneta.
-- Antes: un repartidor solo podía escribir registros del vehículo asignado en tanques_members.vehicle.
-- Ahora: cualquier repartidor activo puede escribir visitas, provisionales y DESCARGAS de ambos vehículos.
-- tanques_members.vehicle se conserva como vehículo por defecto al abrir la app.
-- Gerencia ya tenía acceso a todo; Almacén no cambia.
-- No modifica datos. Reversible ejecutando la definición anterior (database/tanques-sync.sql).

create or replace function tanques_private.can_write(k text, v text, p jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.tanques_members m where m.user_id=(select auth.uid()) and m.active and (
 m.role='gerencia' or
 (m.role='almacen' and ((k='movement' and p->>'type'='CARGA') or k='adjustment')) or
 (m.role='reparto' and v in ('camion','furgoneta') and (k in ('visit','provisional') or (k='movement' and p->>'type'='DESCARGA')))))
$$;
revoke all on function tanques_private.can_write(text,text,jsonb) from public;
grant execute on function tanques_private.can_write(text,text,jsonb) to authenticated;
