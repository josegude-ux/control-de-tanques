# Fase A — Entrega para revisión (sin publicar en Supabase)

**Rama:** `fix/fase-a-seguridad-inventario`  
**Versión app:** 0.10.1  
**PR:** https://github.com/josegude-ux/control-de-tanques/pull/2  
**Estado:** correcciones de seguridad PR #2 en SQL + tests. **Sin aplicar SQL en Supabase real, sin tocar `main`.**

## Correcciones de seguridad (revisión PR #2 + riesgos A–D)

| # | Problema | Corrección |
|---|----------|------------|
| 1 | INSERT/UPDATE directo en `tanques_records` eludía stock | `REVOKE INSERT/UPDATE/DELETE` a `authenticated`; escritura solo vía `tanques_sync_batch` **SECURITY DEFINER** con `can_write` |
| 2 | Dos descargas concurrentes podían dejar saldo negativo | `pg_advisory_xact_lock(881002301)` + validación `stock_problems` al final del lote |
| 3 | Movimientos sin apertura/ajuste de Gerencia | `stock_problems` → `SIN_APERTURA`; RPC lanza `STOCK: faltan existencias iniciales…` |
| A | `source=null` → tanque 1 | `validSource` + SQL `tank` numérico obligatorio |
| B | Datos de otro vehículo | Visitas por owner; provisionales por vehicle; Reparto sin loads ajenas |
| C | Soft-delete restauraba saldo / anulación sync | Soft-delete `movement` prohibido; stock cuenta deleted; UI cancela en conectado |
| D | Colas al actualizar PWA | Claves IDB estables; SW no toca IndexedDB |
| — | BARALLETE 240,61 L | `affectsStock:false`, sin movement de stock |

## SQL preparado (NO ejecutado en Supabase real)

Archivo: `database/fase-a-seguridad-inventario.sql`

- `can_write`: Almacén solo CARGA; ajuste solo Gerencia; soft-delete movement/visit solo Gerencia  
- `stock_problems`: proyección de saldos + `SIN_APERTURA`  
- `tanques_sync_batch`: DEFINER, advisory lock, permisos, CONFLICT, STOCK  
- Privileges: `SELECT` tabla; `EXECUTE` RPC + `round2`; **sin** `EXECUTE` de `stock_problems` para clientes  

Harness aislado local:

- `tests/sql/isolated-auth-stub.sql`
- `tests/sql/fase-a-scenarios.sql`
- `tests/sql/fase-a-concurrency.sh`
- `tests/sql/run-isolated-fase-a.sh` → BD `tanques_fase_a_iso`

## Pruebas — resultado

### Node

`node --test tests/sync-core.test.js tests/fase-a.test.js` — asserts SQL definer/lock/revoke/SIN_APERTURA.

### SQL aislado

`tests/sql/run-isolated-fase-a.sh` → `ISOLATED_SQL_PASS`

| Escenario | Esperado |
|-----------|----------|
| Sin INSERT/UPDATE/DELETE en tabla | OK |
| Sin EXECUTE `stock_problems` para authenticated | OK |
| INSERT directo denegado | OK |
| Movimiento sin opening → STOCK / apertura | OK |
| Carga Almacén / descarga Reparto | OK |
| Ajuste Almacén rechazado; Gerencia OK | OK |
| Duplicado `base=0` → CONFLICT | OK |
| Existencias insuficientes → STOCK | OK |
| Dos descargas 60+60 sobre 100 L → 1 OK + 1 STOCK | OK |

### Browser Playwright (mock)

`npm run test:browser` / `test:browser:fase-a` (suite previa; mock Supabase).

### Pendientes / no ejecutadas

- Aplicación del SQL en **Supabase real** (prohibido hasta autorización)
- E2E contra staging remoto

## Efectos sobre datos existentes (si se aplica el SQL)

No borra filas ni auditoría. Cierra escrituras directas a la tabla; los clientes deben usar solo la RPC. Requiere frontend 0.10.1 (ya usa `tanques_sync_batch`).

## Despliegue coordinado (cuando se autorice)

1. Frontend 0.10.1  
2. `database/fase-a-seguridad-inventario.sql` completo  
3. Verificar que no queden clientes escribiendo con INSERT directo

## Autorización pendiente

1. Aplicar SQL en Supabase real (cuando proceda)  
2. Merge a `main` / Pages (cuando proceda)
