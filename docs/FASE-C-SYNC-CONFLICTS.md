# Fase C — Sincronización, concurrencia y conflictos (octubre de 2026)

**Ámbito:** rama experimental `fix/fase-c-sync-resilience`, basada en `ed56aaefe782c26984cbbe7d57712c0be4e693f8` (PR #2 en borrador). No fusionar con `main`, no aplicar nuevas migraciones, no desplegar producción hasta superar pruebas integrales.

## Objetivo operativo

Una carga, descarga o corrección puede comenzar sin cobertura, pero no debe perderse, confirmarse prematuramente, duplicarse ni romper la contabilidad. El servidor es autoridad final de revisiones, permisos y límites de inventario. El navegador conserva una cola durable y ofrece revisión humana de conflictos.

**Invariantes de aceptación**

1. **Durabilidad antes de confirmación al operario.** La operación y la cola de cambios se guardan en una única transacción IndexedDB; en caso de fallo el cliente no avanza `meta.last` y debe permitir reintentar.
2. **Entrega idempotente.** Si se pierde la respuesta HTTP después del commit, un nuevo `pull` reconoce la misma firma y suprime la operación pendiente sin generar un segundo movimiento.
3. **No sobrescritura ciega.** Dos revisiones de una misma clave producen `CONFLICT` y se conservan las dos versiones para una decisión explícita.
4. **Inventario serializado en el servidor.** La RPC procesa cada lote bajo `pg_advisory_xact_lock` y rechaza el lote entero si deja saldos o capacidades inválidos.
5. **Visita íntegra.** Visita y descargas relacionadas se envían en un único lote; no fraccionarlas al llegar al límite de 500 registros.
6. **Sincronización automática razonable.** Reintentos con retroceso hasta 120 s para fallos continuados. Recuperación al volver la red, entrar en primer plano y pulsar «Sincronizar ahora». No prometer ejecución mientras iOS suspende la PWA.
7. **Seguridad entre entornos.** Demo y aplicación original usan distinta IndexedDB, caché de pertenencia, almacenamiento de autenticación, service worker y nombre de bloqueo de pestañas.
8. **Revalidación de permisos.** Una instantánea completa de RLS elimina del estado remoto las filas revocadas; los pendientes locales no se borran automáticamente.

## Implementación C1 (rama de desarrollo)

- `sync-core.js`: `retryDelay` y `reconcileSnapshot`.
- `cloud-sync.js`: prefijo de membresía y bloqueo multi-pestaña por entorno; captura sobre copia de `meta`, commit IndexedDB y solo entonces sustitución de estado; reconstrucción de filas RLS desde `pull` completo; retroceso de reintentos, conservación de pendientes y errores de inventario visibles.
- `tests/fase-c-resilience.test.js`: ocho regresiones para reintentos, cambios de visibilidad RLS, respuesta perdida, conflicto optimista, aislamiento y orden del commit durable.
- `tests/fase-c-idb.test.js`: integración simulada con fallo de transacción IndexedDB antes del commit y recuperación del mismo movimiento, sin perder ni duplicar la cola.
- `npm run test:fase-c`: pruebas específicas. `npm test`: pruebas previas más Fase C.

Las ocho regresiones de lógica de Fase C se han ejecutado contra las fuentes de la rama usando un intérprete JavaScript aislado y han pasado. También se comprobó con un arnés JavaScript un fallo transaccional de IndexedDB seguido de una captura recuperada. El test equivalente de Node se ha añadido a la rama. **La ejecución integral de `npm test` en Node y pruebas en dos PWA reales sigue pendiente**; no afirmar que están superadas hasta ejecutarlas.

## Matriz obligatoria de validación C2 (sin tocar producción)

| Caso | Dispositivos / situación | Resultado exigido |
|---|---|---|
| A | Almacén offline: dos cargas; reconectar | Ambas aparecen una sola vez en Gerencia y Reparto |
| B | Descarga con respuesta HTTP perdida tras commit | Sin duplicado, cola vacía tras `pull` |
| C | Camión y furgoneta desconectados, descargas distintas | No se mezclan perfiles y solo disminuyen los tanques correspondientes |
| D | Dos descargas simultáneas que consumen más litros que el disponible | La segunda se rechaza; primera válida, ninguna existencia negativa |
| E | Dos versiones diferentes del mismo registro | Conflicto visible, ninguna sustitución silenciosa |
| F | Se edita un registro mientras la RPC está en vuelo | La edición posterior conserva su versión y queda pendiente |
| G | Se cierra/reabre la PWA con pendientes y sin red | Se recuperan los cambios de IndexedDB |
| H | Almacén desactivado con cola offline | No se transmite; copia recuperable y registro local conservado |
| I | Demo y original abiertos en el mismo origen de GitHub Pages | Sin interferencia de bloqueo/caché/sesión |
| J | Cambio de rol/vehículo con historial remoto ya descargado | RLS impide lectura nueva y datos obsoletos no aparecen en vistas activas |
| K | Visita con más cambios que el límite permitido | Error claro; ningún envío parcial |
| L | Fallos 403, 5xx o «STOCK» repetidos | Cola íntegra, mensaje claro, retroceso; no tormenta de solicitudes |

## Riesgos abiertos C3 (bloquean salida a producción)

- **Cambio de rol con pendientes antiguos:** la cola pertenece a la cuenta, no se separa todavía por permiso de operación. Debe definirse retención segura, cuarentena de pendientes no autorizados, cambio inmediato a perfil permitido y recuperación supervisada.
- **Datos de establecimientos en eventos compartidos:** los movimientos de descarga pueden contener `client`/`dest` en el `payload`, aunque RLS permita esos movimientos a toda la flota para calcular saldos. Diseñar un resumen de existencias sin información sensible o endpoints filtrados antes de producción; no confiar solo en filtros de interfaz.
- **Caída de IndexedDB/cuota en iPhone:** planificar exportación de emergencia y pruebas reales de restauración; ninguna garantía si se borran datos del sitio antes de sincronizar.
- **Concurrencia de pestañas sin Web Locks API:** decidir un mecanismo alternativo o dejar una sola pestaña editable cuando no esté disponible.
- **Controles externos:** revisar avisos de Supabase sobre `SECURITY DEFINER` y protección de contraseñas filtradas; no cambiar la RPC sin pruebas SQL.

## Criterios para integración

- `npm test`, SQL aislado y pruebas de dos dispositivos completas.
- 0 duplicados / 0 pérdidas / 0 saldos negativos.
- 0 consultas a producción desde DEMO.
- Auditoría y recuperabilidad de conflictos verificadas.
- Code review de funciones de permisos y exposición de datos.
- Aprobación explícita antes de despliegue o fusionar PR.

**Estado:** C1 en revisión; C2/C3 pendientes. Producción, `main` y el PR #2 permanecen fuera de este trabajo.
