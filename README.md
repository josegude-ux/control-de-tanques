# Control de Tanques v0.5 · Importación local de pruebas

## Novedades
- Vista **Gerencia (demo)**: elegir un Excel CDT-v0.4 de Almacén o Reparto y registrar automáticamente los movimientos válidos.
- Detección de IDs duplicados y conflictos de contenido; resumen de la importación e incidencias.
- La importación conserva los saldos de prueba del móvil; los registros de Gerencia quedan en el mismo IndexedDB del dispositivo.
- Copia JSON desde Más o Gerencia.
- Se conservan cargas, visitas, correcciones, reinicios, Excel diario y actualizaciones.

## Limitaciones críticas
- **No es una base central ni sincroniza entre PC y móvil**. Eso queda para una etapa posterior.
- **El selector Gerencia es demostrativo, sin autenticación real**: NO utilizar con datos empresariales.
- **No actualiza existencias reales** ni efectúa aún conciliación cronológica. Importa un libro auxiliar de movimientos y los totales no equivalen a saldo.
- El lector admite exclusivamente los XLSX CDT-v0.4 creados por esta app, sin compresión ZIP, no archivos genéricos de Excel. La protección de tiempos, cifrado, identificación de operadores y conciliación todavía no se han implementado.
- Se pueden importar los Excel de prueba sin internet. No borrar Safari ni datos del sitio.

## Prueba sugerida
1. Actualizar todos los archivos desde GitHub Pages, incluido `xlsx-import-local.js`.
2. En Más, escoger Gerencia (demo) y abrir Gerencia.
3. Importar `control-tanques-DEMO-reparto-2026-10-20.xlsx`.
4. Confirmar que el resumen muestra una descarga nueva de 450 L.
5. Importar el mismo Excel de nuevo. Debe indicar cero nuevos y uno duplicado.
6. Comprobar que las existencias locales siguen idénticas.
