# Fase B — Planificación por vehículo (API)

**Staging:** `iuqmzpahyjganhppcsur`  
**Estado:** preparado y probado en PostgreSQL local. **NO aplicado en Supabase.**  
**Prerrequisito remoto:** `fase-b-staging-rls-read.sql` ya aplicada.

## Problema

Las filas `plan:SEMANA` agrupaban entregas de camión y furgoneta (`vehicle` NULL).  
RLS permitía a Reparto el SELECT de esa fila completa; el filtrado solo ocurría en el cliente.

## Diseño

| Capa | Cambio |
|------|--------|
| Clave | `plan:SEMANA\|camion` / `plan:SEMANA\|furgoneta` |
| Columna `vehicle` | `camion` / `furgoneta` (no NULL) |
| `can_read` | Reparto: `kind=plan` solo si `vehicle = member.vehicle` |
| Gerencia | Sigue leyendo todas las filas plan (+ legado) |
| Almacén | Sin plan |
| Stock | `opening` / `adjustment` / CARGA / DESCARGA sin cambios |
| Auditoría | `tanques_audit` intacta (solo Gerencia) |
| Cliente | `sync-core` emite/hidrata por vehículo; legado `plan:SEMANA` se hidrata y se reescribe al sync |

## Archivos

- `database/fase-b-staging-plan-by-vehicle.sql` — migración incremental (CREATE OR REPLACE `can_read`)
- `database/fase-b-staging-rls-read.sql` — alineado para instalaciones nuevas
- `sync-core.js` — extract/hydrate
- `tests/sql/fase-b-plan-by-vehicle-scenarios.sql`

## Aplicación (cuando se autorice)

Solo en SQL Editor de **iuqmzpahyjganhppcsur**:

```sql
-- pegar database/fase-b-staging-plan-by-vehicle.sql
```

No producción. No usuarios. No opening en este paso.
