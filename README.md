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
