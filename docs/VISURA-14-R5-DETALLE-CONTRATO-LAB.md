# VISURA TANQUES — Detalle individual R5 · Contrato de integración LAB

**Orden existente:** VISURA-14-WORK-TANQUES-001. **Checkpoint funcional conservado:** CP033. **Estado:** diseño aprobado, integración preparada, no implementada. **Base:** lab/visura-14-r41-listado-movil @ 96049ea6c2f000027c094032a94a024503954803.

## Auditoría de datos y rutas (app.js)
- `state.tanks[state.vehicle]` es un arreglo de saldos por tanque de vehículo; `state.vehicle` distingue `camion` y `furgoneta`. No hay entidad de tanque de planta con ID T-01/T-02/T-03 verificada.
- Capacidad de vehículo usada en vista y operaciones: 1.000 L por tanque; no usar 10.000 L de la maqueta.
- `state.cloudStockReady` y `state.cloudStockProblems` gobiernan la fiabilidad visual en el listado R4.1. El detalle debe reutilizar idénticas condiciones y no inferir validez por un valor numérico aislado.
- `TankCloud.connected()`, `TankCloud.member()?.active` y `TankCloud.permitted('almacen'|'reparto')` gobiernan conexión y permisos. No modificar autenticación ni autorización.
- `navbar()` y `navigate(page)` tienen rutas existentes: inicio, carga, visita, historial, admin, recibir-plan, jornada, gerencia, clientes y planificacion. No existe una ruta de detalle individual. Introducir un panel visual local o navegación de consulta reversible, sin registrar nueva ruta persistida ni modificar contratos.
- La pantalla de carga y la visita tienen validaciones, confirmaciones y movimientos propios. **No** duplicar sus formularios ni crear botones directos que eludan validaciones.
- El modo desconectado `legacyHome()` utiliza datos ficticios y advertencia explícita; mantenerlo intacto.
- El saldo puede incluir movimientos pendientes de este móvil y no sincronizados desde otros; conservar aviso textual. No inventar estado «En carga», «Descargando» ni fecha de último movimiento del tanque.

## Diseño R5 aprobado
- Encabezado: Tanque N · Camión/Furgoneta, volver al listado.
- Imagen industrial Mahou decorativa, sin codificar volumen en el líquido representado ni sustituir datos.
- Dos bloques: litros actuales y capacidad nominal (1.000 L, contrato actual). Porcentaje/barra solo con saldo finito entre 0 y 1.000 y saldos fiables.
- Sin datos, pendiente de Gerencia, error de conciliación, desconexión y permiso insuficiente: mensajes claros; no mostrar porcentajes no verificados.
- Mantener navegación inferior, selector de vehículo y áreas seguras iOS; controles accesibles ≥44px, VoiceOver, texto no dependiente del color.
- Acciones existentes solo por rutas ya autorizadas; sin nuevos efectos de escritura.

## Criterios de aceptación previos a integración
1. Comparar listado y detalle para cada vehículo; mismos litros, misma fiabilidad, misma capacidad.
2. Verificar rol Almacén/Reparto/Gerencia; ningún acceso no autorizado a acciones.
3. Volver al listado sin cambiar `state.vehicle`, `state.tanks` ni persistencia.
4. Estados de datos ausentes, NaN, negativos, >1.000, sin conexión y conflictos.
5. iPhone Safari y Chromium móvil; no solapamiento de barra inferior.
6. CI de sintaxis, regresiones existentes y nuevas pruebas de detalle; SHA y ejecución documentados.

## Exclusiones
No modificar main, Supabase, datos reales, autenticación, INVENTA, PREPARA ALMACÉN, rama Copilot, sincronización ni operaciones existentes. No fusionar ni publicar. No afirmar pruebas R5 hasta ejecutarlas.
