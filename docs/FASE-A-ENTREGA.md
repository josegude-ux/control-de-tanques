# Fase A — Entrega para revisión (sin publicar)

**Rama local:** `fix/fase-a-seguridad-inventario`  
**Versión app:** 0.10.1  
**Estado:** cambios listos en el entorno aislado. **Sin push, sin PR, sin SQL en Supabase real.**

## Errores corregidos (cliente)

| Problema | Corrección |
|----------|------------|
| Borrado de visitas en modo conectado | Bloqueado en UI + `forbidSyncedDelete` en `capture` |
| Ajuste de existencias por Almacén | Solo Gerencia (`extract` + panel + `canAdjustStock`) |
| Anulación restauraba saldo (tombstone) | `cancelledAt` ya no marca descargas `deleted` |
| Reintento perdido si `sync()` sale anticipado | `retryAfterGate` reprograma offline; busy deja el `finally` |
| Carrera save ∥ sync | `createGate()` / `exclusive` |
| Cuenta desactivada con cola | No descarta pendientes; mensaje + backup; no push |
| Precisión decimal | `litres()` a 2 decimales en core y mutaciones |
| Doble submit de formularios | `formBusy` |

## SQL preparado (NO ejecutado)

Archivo: `database/fase-a-seguridad-inventario.sql`

- `can_write`: Almacén solo `CARGA` (sin `adjustment`)
- Soft-delete movement/visit solo Gerencia
- Validación reforzada opening/adjustment + redondeo
- `tanques_sync_batch`: `unique_violation` → CONFLICT; post-lote `STOCK:` si existencias inválidas
- Auditoría existente (`tanques_audit`) sigue registrando inserts/updates

## Efectos sobre datos existentes (si se aplica el SQL)

- No borra filas ni auditoría.
- Adjustments futuros de Almacén serán rechazados por RLS (los ya guardados permanecen).
- Lotes que dejen tanque/cisterna inválidos fallarán enteros (transacción).
- Requiere **despliegue coordinado** frontend 0.10.1 + este SQL.

## Pruebas

```bash
node --test tests/sync-core.test.js tests/fase-a.test.js
```

Resultado esperado: 24 tests OK (9 sync-core + 15 fase-a).

No se usaron registros reales de Supabase.  
`tests/browser.cjs` (Playwright) no se ejecutó aquí (requiere Chromium); la lógica cubierta está en unit tests.

## Pendiente (fuera de Fase A / requiere tu autorización)

- Push de la rama / PR
- Aplicar SQL en Supabase
- Lectura RLS más restrictiva de movimientos
- Restore desde JSON de backup
- Pull incremental por `updated_at`
- Flujo Gerencia de anulación con ajuste de saldo explícito
- E2E Playwright contra mock/staging

## Referencias de negocio (solo tests; no escritas en BD real)

- Opening 20/10/2026: C 977 / 413,57 / 0 · F 990 · Cisterna 23.000
- 450 L Cervecería Ejemplo: excluidos del opening de prueba
- BARALLETE BAR 240,61 L: conservada en test de anulación sin tombstone

## Autorización solicitada

Para continuar hace falta tu OK explícito para, por separado:

1. `git push -u origin fix/fase-a-seguridad-inventario`
2. Crear pull request
3. Aplicar `database/fase-a-seguridad-inventario.sql` en el proyecto Supabase
