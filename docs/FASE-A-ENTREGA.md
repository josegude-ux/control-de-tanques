# Fase A — Entrega para revisión (sin publicar)

**Rama:** `fix/fase-a-seguridad-inventario`  
**Versión app:** 0.10.1  
**Estado:** correcciones locales listas para revisión. **Sin push de este fix de permisos, sin PR, sin SQL en Supabase real, sin tocar `main`.**

## Hallazgo de permisos (corregido)

`tanques_private.round2` y `tanques_private.stock_problems` se invocan desde:

- `validate_record()` — trigger **SECURITY INVOKER**
- `tanques_sync_batch()` — RPC **SECURITY INVOKER**

Había `REVOKE … FROM public` **sin** `GRANT EXECUTE … TO authenticated`. En PostgreSQL/Supabase eso provoca `permission denied for function` para el rol `authenticated` en cargas/descargas/ajustes.

**Corrección (mínimo privilegio):**

```sql
revoke all on function tanques_private.round2(numeric) from public, anon;
revoke all on function tanques_private.stock_problems() from public, anon;
grant execute on function tanques_private.round2(numeric) to authenticated;
grant execute on function tanques_private.stock_problems() to authenticated;
```

No se añadió `SECURITY DEFINER` a estos helpers: siguen el RLS del invocador.

## Errores corregidos (cliente + SQL)

| Problema | Corrección |
|----------|------------|
| Borrado de visitas sincronizadas | UI + `forbidSyncedDelete` |
| Ajuste solo Gerencia | cliente + `can_write` SQL |
| Anulación restauraba saldo | sin tombstone automático en descargas |
| Sync: reintentos / carreras / desactivado | `retryAfterGate`, `createGate`, cola conservada |
| Litros / doble submit | `litres()`, `formBusy` |
| **EXECUTE faltante en helpers privados** | **GRANT a `authenticated` (este ciclo)** |

## SQL preparado (NO ejecutado en Supabase real)

Archivo: `database/fase-a-seguridad-inventario.sql`

Harness aislado local:

- `tests/sql/isolated-auth-stub.sql`
- `tests/sql/fase-a-scenarios.sql`
- `tests/sql/run-isolated-fase-a.sh` → BD `tanques_fase_a_iso` (PostgreSQL local)

## Pruebas — resultado

### Aprobadas

**Node** (`node --test tests/sync-core.test.js tests/fase-a.test.js`):

- **24/24 pass**, 0 fail (incluye assert de GRANT EXECUTE en el SQL)

**SQL aislado** (`tests/sql/run-isolated-fase-a.sh` → `ISOLATED_SQL_PASS`):

| Escenario | Resultado |
|-----------|-----------|
| `authenticated` EXECUTE `round2` / `stock_problems` | OK |
| `anon` sin EXECUTE | OK |
| Carga (Almacén) | OK |
| Descarga (Reparto, lote visita+movimiento) | OK |
| Ajuste Almacén rechazado (RLS) | OK |
| Ajuste Gerencia autorizado | OK |
| Duplicado `base=0` → CONFLICT | OK |
| Existencias insuficientes → STOCK | OK |
| Auditoría / no persistencia de rechazos | OK |

### Browser Playwright (ficticio + mock Supabase)

Comandos:

```bash
npm install
CHROMIUM_PATH=/usr/local/bin/google-chrome npm run test:browser
CHROMIUM_PATH=/usr/local/bin/google-chrome npm run test:browser:fase-a
```

| Cobertura pedida | Resultado |
|------------------|-----------|
| 1. Login y permisos Gerencia/Almacén/Reparto | OK (`browser-fase-a`) |
| 2. Sync automática dos dispositivos | OK |
| 3. Cargas/descargas sin conexión | OK |
| 4. Recuperación al volver Internet | OK |
| 5. Prevención de duplicados | OK |
| 6. Datos tras actualizar/recargar PWA | OK |
| 7. Coherencia existencias por tanque | OK (+ rechazo STOCK) |
| Smoke previo `tests/browser.cjs` | OK |

### Pendientes / no ejecutadas

- Aplicación del SQL en **Supabase real** (prohibido hasta autorización)
- E2E contra proyecto staging remoto (no mock)
- Push / PR de commits posteriores a `2d3d2c8` (requiere autorización)

## Efectos sobre datos existentes (si se aplica el SQL)

Sin cambios: no borra filas ni auditoría. Solo añade EXECUTE a helpers ya usados por el flujo autenticado. Sin este GRANT, el frontend 0.10.1 fallaría al sincronizar tras desplegar el resto del SQL Fase A.

## Despliegue coordinado

1. Frontend 0.10.1  
2. `database/fase-a-seguridad-inventario.sql` **completo** (incluye este GRANT)

## Autorización solicitada

1. Push de la rama (incluye este fix de permisos)  
2. Crear PR (cuando proceda)  
3. Aplicar SQL en Supabase real (cuando proceda)
