# Control de Tanques 0.10.0

PWA móvil con Supabase, almacenamiento local y sincronización automática.
Repositorio de esta aplicación: `josegude-ux/control-de-tanques`.

## Uso

- Abrir la app y entrar en **Cuenta** con la misma cuenta de Supabase utilizada en Control de Cargas. Su administrador activo tiene acceso de Gerencia en Tanques.
- Gerencia establece las existencias iniciales comprobadas en **Saldos y movimientos**. No se copian los saldos ficticios antiguos al inventario compartido.
- Los trabajadores pueden crear una cuenta, confirmar su correo e iniciar sesión. Gerencia autoriza el perfil y el vehículo en **Cuenta → Gestionar accesos**. Una cuenta pendiente no puede leer ni escribir movimientos.
- Los cambios se guardan junto con la cola en una transacción de IndexedDB. Se sincronizan al guardar, al recuperar conexión y al volver a la app, con comprobaciones periódicas mientras permanece abierta. **Sincronizar ahora** fuerza un intento.
- iOS puede suspender la aplicación cerrada; la cola continúa al abrirla. La primera conexión de cada dispositivo requiere Internet.
- Cargas, descargas (también de visitas abiertas), correcciones, clientes, planes y ajustes se comparten. Las revisiones simultáneas se presentan en Cuenta; no se sobrescriben silenciosamente. Cada visita y sus descargas se envían juntas.
- Los perfiles locales anteriores permanecen intactos. El espacio conectado se separa por usuario. Gerencia puede recuperar el catálogo anterior desde Cuenta. Los movimientos antiguos de demostración no se publican automáticamente.
- El saldo incluye lo recibido y los pendientes del móvil actual; otros móviles sin cobertura todavía pueden tener operaciones pendientes. Las incoherencias de inventario bloquean nuevas operaciones hasta su revisión.
- La copia JSON incluye los perfiles conectados y la cola. No desinstalar la PWA ni borrar datos del sitio con movimientos pendientes.

## Backend

Se utiliza el proyecto existente de Control de Cargas con tablas separadas `tanques_members`, `tanques_records` y `tanques_audit`. Las tablas de Cargas no se modifican.
Las definiciones aplicadas se conservan en `database/`. La RPC de escritura usa los permisos del usuario y revisiones optimistas. El lote se revierte por completo si alguna revisión ha cambiado. La auditoría se consulta solo por Gerencia; el detalle de visitas solo por su autor o Gerencia.
La clave del cliente es publicable. No contiene claves secretas. SDK Supabase JS 2.57.4 incluido localmente para el arranque sin conexión.

## Verificación

- `node --test tests/sync-core.test.js`: cola persistente, respuesta perdida, corrección durante un envío, conflicto entre dispositivos, cierre/reapertura, borrados, planes, saldos y agrupación de lotes.
- `node tests/browser.cjs`: prueba de navegador en dos contextos independientes con API simulada; inicio de sesión, apertura, carga, descarga, recarga sin conexión, reconexión automática y ausencia de duplicados. Requiere Playwright y Chromium; acepta `CHROMIUM_PATH`.
- Backend real: inserción/actualización con rol autenticado, restricciones de Almacén y Reparto, vehículo asignado, conflicto de revisión y reversión atómica. Pruebas transaccionales con ROLLBACK, sin movimientos de prueba persistentes.

La prueba con la sesión y los dispositivos reales del usuario se realiza al iniciar sesión en la versión publicada. Esta entrega implementa sincronización; no añade un sistema nuevo de medición física ni cronómetro de cargas.
