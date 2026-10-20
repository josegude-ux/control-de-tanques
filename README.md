# Control de Tanques · Demo v0.4 · Excel local

## Novedades
- **Más → Enviar jornada** en Almacén y Reparto.
- Archivo `.xlsx` real generado sin conexión y sin dependencias externas (`xlsx-local.js`). Una jornada por fecha y perfil.
- Compartir con el menú de iOS si está disponible; si no, descargar para compartir desde Archivos.
- Después del envío, **Marcar jornada como enviada** para bloquear reaperturas y poder **reenviar el mismo Excel**, con identificadores idénticos.
- Hojas: Jornada, Movimientos, Cargas, Visitas, Descargas, Correcciones, Reinicios y Control.
- Conserva IndexedDB `cdt_demo_v1` y el sistema de actualizaciones v0.3.

## MUY IMPORTANTE
- Solo datos ficticios: aún no existen autenticación, seguridad de perfiles, cifrado de tiempos, importación de Gerencia ni base central.
- La fecha/hora en las hojas indica cuándo se registró cada operación; **no mide tiempos de trabajo**. Hasta que exista cifrado y permisos, NO exportar datos reales ni tiempos exclusivos de Gerencia.
- El teléfono no puede confirmar que un correo haya llegado; «Marcar como enviada» es una declaración manual.
- Reenviar preserva ID y contenido de la jornada; Gerencia necesitará validación de IDs para evitar duplicados (pendiente).
- Guardar copia de seguridad JSON antes de actualizar y no borrar datos del sitio.

## Instalación
Sube los **10 archivos** del ZIP a la raíz de `josegude-ux/control-de-tanques`, incluyendo `xlsx-local.js`, reemplazando los existentes. No subir el ZIP como único archivo. Comprueba que GitHub Pages publica v0.4.0.
