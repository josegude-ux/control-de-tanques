# VISURA TANQUES · Contrato de integración y validación CP033

Orden existente: VISURA-14-WORK-TANQUES-001. Rama aislada: lab/visura-14-cp033-planificacion.
Base inmutable de referencia: 48538f904e3dd650c6fcfa976ee99fa13f56bfe6 (Control de Tanques 0.10.0).

## Estado contrastado en código

- `app.js`: `plannerPage()` implementa planificación de Gerencia con semana, lunes-viernes, selección de clientes habituales o del catálogo, búsqueda, vehículo, litros, edición, eliminación y resumen diario/semanal.
- `saveBulkPlan()`, `savePlan()`, `deletePlan()`: guardan planes en `state.weeklyPlans` mediante `persist()`. Los planes previamente exportados se marcan `needsResend` al modificarse.
- `exportPlan(vehicle)`: genera Excel semanal por vehículo con versión y filas de entregas, usando `SheetXLSX.generate`; el envío real no queda acreditado por generar el archivo.
- `plan-import-local.js`: valida el formato de Excel CDT y sus metadatos antes de la recepción; no acepta hojas arbitrarias.
- `app.js`: `receivedPlanPanel()` muestra planificación recibida por Reparto. La recepción compara versiones y evita duplicar una importación idéntica.
- `cloud-sync.js`: persiste/sincroniza estado mediante Supabase, IndexedDB y cola offline. El backend utiliza tablas TANQUES dentro de un proyecto compartido con Control de Cargas.
- `pruebas-tanques/planificacion-movil.html`: página separada, ficticia y sin Supabase; validada por el usuario en Safari iPhone. No equivale a una prueba del flujo integrado.

## Límites y contrato de seguridad

1. No sustituir `plannerPage()` por el prototipo aislado ni crear una segunda fuente de verdad.
2. No modificar tablas, RPC, políticas RLS, autenticación, cola offline, inventario ni perfiles compartidos.
3. Mantener planificación y existencias como conceptos separados: litros previstos no son movimientos físicos.
4. Conservar roles: planificación para Gerencia, recepción para Reparto; verificar autorización tanto en navegación como en escritura real.
5. No prometer recepción, entrega, sincronización ni auditoría por el mero hecho de exportar Excel.
6. No publicar cambios funcionales en `main` sin pruebas de regresión y revisión de impacto.
7. Los cambios de pruebas en esta rama no deben tocar `index.html`, `app.js`, `cloud-sync.js`, `sync-core.js`, `database/` ni `sw.js` hasta contar con validación específica.

## Matriz mínima de pruebas pendiente

- Gerencia: crear varias entregas de lunes a viernes, filtrar clientes, editar litros/vehículo, eliminar y revisar totales.
- Exportación: comprobar versión, datos y formato XLSX por vehículo; edición posterior marca necesidad de reenvío.
- Reparto: importar Excel compatible, reimportar idéntico sin duplicados, rechazar versión antigua y archivo malformado.
- Permisos: Almacén y Reparto no deben escribir planificación de Gerencia; usuarios pendientes no acceden a datos conectados.
- Persistencia: recarga, desconexión y reconexión; ninguna entrega ficticia debe afectar saldos reales.
- Regresión: carga, descarga, historial, cuentas, sincronización y datos previos intactos.
- Safari físico: verificar el flujo integrado completo; la prueba aislada CP033 solo cubrió interacciones básicas.

Estado: contrato recuperado y rama aislada creada; pruebas integradas y publicación funcional pendientes.
