# Fase B — Corrección RLS de lectura (sin ejecutar)

**Staging:** `iuqmzpahyjganhppcsur`  
**Estado:** migración preparada y probada en PostgreSQL local. **NO aplicada en Supabase todavía.**

## Archivo

`database/fase-b-staging-rls-read.sql`

## Matriz de lectura

| kind | Gerencia | Almacén | Reparto |
|------|----------|---------|---------|
| opening / adjustment | sí | sí | sí |
| movement CARGA/DESCARGA | sí | sí (saldos) | sí (saldos) |
| visit | sí | no | solo propias |
| provisional | sí | no | solo su vehículo |
| plan | sí | no | sí |
| customer | sí | no | no |

## Sync automática

- `pull()` → `SELECT` filtrado por `can_read` (OK).
- `tanques_sync_batch` DEFINER → escribe con `can_write`; `stock_problems` DEFINER ve todo el inventario.
- Saldos compartidos siguen siendo coherentes al permitir lecturas de movements de stock a Almacén/Reparto.

## Pruebas

```bash
npm run test:sql   # incluye fase-b-rls-read-scenarios (SELECT API)
npm run test:fase-b
```
