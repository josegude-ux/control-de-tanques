# Fase A — Corrección de riesgos (auditoría v0.10.1)

**Rama:** `fix/fase-a-seguridad-inventario`  
**Base:** commit `82eda9a` + fixes de riesgos A–D  
**Estado:** correcciones locales. **Sin push sin autorización. Sin SQL en Supabase real. Sin merge/PWA.**

## Riesgos y correcciones

| Id | Riesgo | Corrección |
|----|--------|------------|
| A | `source=null` → `null+1` = tanque 1 | `validSource()`; extract no emite movement sin origen entero ≥0; SQL exige `tank` numérico |
| B | Lectura/reenvío de otros vehículos | hydrate/extract: visitas por `owner_id`; provisionales filtrados por `vehicle`; Reparto no materializa loads ajenas |
| C | Anulación visitas sync | UI cancela también en modo conectado; soft-delete de **movement** prohibido en SQL; stock cuenta movements deleted hasta adjustment |
| D | Migración / colas locales | Claves IDB documentadas y estables; SW no toca IndexedDB; meta se rehidrata sin vaciar `pending` |
| — | Soft-delete restauraba saldo | Bloqueante anterior: prohibido + proyección incluye deleted |
| BARALLETE | 240,61 L origen desconocido | `PENDING_BARALLETE` `sourceTank:null` `affectsStock:false`; no movement de stock |

## Plan E2E staging (pendiente autorización)

1. Proyecto Supabase **staging** independiente (no prod).  
2. Backup `tanques_*` + definición previa RPC/grants.  
3. Usuarios: Gerencia / Almacén / Reparto-camión.  
4. Aplicar `database/fase-a-seguridad-inventario.sql` solo en staging.  
5. Casos: A–D, concurrencia, SIN_APERTURA, CONFLICT, BARALLETE, cola offline→update→sync.  
6. Ensayar rollback.  
7. Go/no-go producción.

## No hacer aún

- Push sin autorización  
- SQL en Supabase real  
- Merge a `main` / publicar PWA  
- Crear proyecto staging (hasta que se autorice)
