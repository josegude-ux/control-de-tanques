# Control de Tanques — v0.7.0 (demostración)

Actualización del proyecto v0.6, **sin eliminar datos de IndexedDB**.

## Procedimiento de pruebas
1. Cambiar a **Almacén**, registrar carga ficticia con contador confirmado y enviar jornada Excel.
2. Cambiar a **Gerencia (demo)**, importar Excel de Almacén; configurar saldos iniciales coherentes para que las cargas queden conciliadas.
3. En **Gerencia → Comunicar cargas al repartidor**, elegir vehículo y generar XLSX de traspaso.
4. En **Reparto → Más → Recibir cargas de Gerencia**, importar el XLSX. Cada carga con ID único se aplica **una sola vez**; las cargas que no cuadren con el stock local quedan pendientes.
5. Repetir la importación: debe mostrar duplicados y NO cambiar los litros.

## Limitaciones importantes
- Prototipo local y **sin autenticación**. No subir ni importar datos reales.
- En un mismo dispositivo, los perfiles demostrativos comparten almacenamiento y pueden reflejar ya las cargas registradas por Almacén. Para probar recepción real usar otro navegador/dispositivo con existencias iniciales compatibles, sin borrar datos anteriores.
- Traspasos exportan las **cargas conciliadas** existentes, no un saldo absoluto autorizado.
- Las incidencias de conciliación deben revisarse. No se sobrescriben existencias ni se ignoran duplicados.
- El XLSX **no está firmado criptográficamente**. No usar con datos empresariales sin seguridad adicional.
- Sin base compartida de Gerencia, cifrado de tiempos ni control de permisos. Todo sigue siendo ficticio.
- Para actualizar GitHub Pages, subir los 12 archivos a la raíz del repositorio; conservar el mismo origen URL y no borrar datos Safari.
