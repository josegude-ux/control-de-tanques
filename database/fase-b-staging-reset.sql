-- FASE B — Restablecer datos DEMO en STAGING (NO producción).
-- Borra solo tablas tanques_* del proyecto staging. NO toca Auth users.
-- CONFIRMAR project ref antes de ejecutar. NUNCA en oevetnszmfxeukcncwji.

\set ON_ERROR_STOP on

-- Descomentar tras verificar que estás en el proyecto staging:
-- truncate table public.tanques_audit restart identity cascade;
-- truncate table public.tanques_records cascade;
-- Conservar tanques_members (usuarios de prueba) o truncar también si se desea:
-- truncate table public.tanques_members cascade;

select 'FASE_B_RESET_TEMPLATE — descomenta truncate solo en staging verificado' as estado;
