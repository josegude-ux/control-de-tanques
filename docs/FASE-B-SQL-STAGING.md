# Fase B — Migración SQL staging (revisión, sin ejecutar)

**Project ref staging:** `iuqmzpahyjganhppcsur`  
**Producción prohibida:** `oevetnszmfxeukcncwji`  
**Estado:** SQL preparado y verificado en PostgreSQL **local** aislado. **NO ejecutado en Supabase staging todavía.**

## Orden de aplicación (cuando se autorice)

En el SQL Editor de **iuqmzpahyjganhppcsur** únicamente:

1. (Ya hecho) `tanques-sync.sql`  
2. (Ya hecho) `tanques-validation.sql`  
3. **Pendiente:** `database/fase-b-staging-seguridad.sql` ← capa definitiva  
4. (Después) miembros DEMO + `fase-b-staging-opening-demo.sql` / adjustment vía Gerencia  

No aplicar estos scripts en producción.

## Controles cubiertos

| # | Control | Mecanismo |
|---|---------|-----------|
| 1 | Sin escrituras directas | `REVOKE INSERT/UPDATE/DELETE` + RPC DEFINER |
| 2 | `affectsStock=false` | Rechazo en trigger + RPC; no proyecta stock |
| 3 | Roles | `can_write` Gerencia / Almacén CARGA / Reparto+vehículo |
| 4 | Concurrencia / duplicados | `pg_advisory_xact_lock` + `CONFLICT` |
| 5 | Solo ficticios | Opening/ajuste DEMO etiquetado; valores 10000/[500,400,300]/[800] |

## Pruebas locales

```bash
npm run test:sql    # aplica fase-a + fase-b-staging-seguridad + escenarios
npm test            # incluye asserts del SQL
```

## Pendiente para iPhone/Android

1. Autorizar ejecución de `fase-b-staging-seguridad.sql` en `iuqmzpahyjganhppcsur`.  
2. Crear/asignar 4 usuarios Auth + `tanques_members`.  
3. Opening DEMO.  
4. Rellenar `demo/config.js` con URL/anon del staging.  
5. Autorizar publicación URL `/demo/`.  
