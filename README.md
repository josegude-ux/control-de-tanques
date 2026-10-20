# Control de Tanques v0.2.3 — Corrección de actualizaciones

Se ha detectado que Safari mostraba la cabecera 0.2.2 con JavaScript anterior en caché. Esta versión utiliza rutas versionadas de `app.js` y `styles.css`, y presenta **Actualizaciones** al principio del menú Más.

**Instalación:** subir todos los archivos descomprimidos a la raíz de la rama `main` en GitHub, sustituyendo los anteriores. No elimines datos de Safari ni desinstales la PWA. Tras publicarse, recarga la aplicación con conexión; si se mantiene antigua, cierra y abre la pestaña, o prueba Safari normal. Los datos de demostración quedan en IndexedDB.

**Estado:** interfaz de pruebas. Aún no incluye Excel, autenticación real ni sincronización de Gerencia.

# Control de Tanques — Demo local v0.2.1 · Logo Mahou local corregido

**Prototipo solo con datos ficticios. No usar con operaciones reales.**

## Cambios
- Logo Mahou en cabecera de todas las pantallas (Inicio, Carga, Visita, Historial y Más).
- Estética roja/blanca/gris y tema PWA actualizado.
- Conserva la clave de datos IndexedDB original (`cdt_demo_v1`) para preservar movimientos de la demo.
- Versión de caché del service worker renovada.

## Logo Mahou
- Usa el PNG que has compartido en este chat, convertido a fondo transparente.
- Se incorpora localmente como `mahou-logo.png`: no depende de conexiones ni imágenes externas.
- Se limita expresamente a 40 × 40 px (36 × 36 en móvil), en cabecera, sin alterar la lógica de la app.
- El uso de la marca debe estar autorizado por el titular si se distribuye la aplicación.

## Publicar
Extrae los archivos del ZIP y súbelos a la raíz de `control-de-tanques` en GitHub, sustituyendo los archivos anteriores y añadiendo `mahou-logo.png`. Github Pages actualizará la aplicación. No borres los datos del navegador ni uses «Reiniciar datos ficticios» si quieres conservar las pruebas anteriores.

## Funciones existentes
- Registro local de cargas por tanque, merma del sobrante y control de capacidad.
- Visitas, descargas con contador acumulativo, cambio de tanque y saldos locales.
- Perfiles simulados, historial e IndexedDB; copia de seguridad JSON.

## Pendiente
- Exportación/importación Excel, auditoría de correcciones, reinicio excepcional del contador.
- Usuarios con permisos reales, cifrado de tiempos y base compartida de Gerencia.
- PWA y uso offline completos con el logo descargado localmente.

## v0.2.2: actualización desde la aplicación
- **Más → Actualizaciones**: versión instalada, Buscar actualizaciones, Actualizar ahora.
- `version.json` publica la versión actual y se consulta por red sin caché.
- Comprueba al abrir y al volver al primer plano (máximo una vez cada seis horas).
- Actualizar ahora renueva archivos de la PWA y recarga tras confirmación; muestra advertencia si hay una visita abierta.
- Conserva IndexedDB `cdt_demo_v1` sin migraciones, sin borrar movimientos locales.
- Sigue siendo un prototipo: comprueba la primera actualización en un dispositivo de prueba.
- En futuras versiones: actualizar version.json, APP_VERSION en app.js y CACHE en sw.js al publicar.
