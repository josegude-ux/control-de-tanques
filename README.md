# Control de Tanques — Demo local v0.2 · Identidad Mahou

**Prototipo solo con datos ficticios. No usar con operaciones reales.**

## Cambios
- Logo Mahou en cabecera de todas las pantallas (Inicio, Carga, Visita, Historial y Más).
- Estética roja/blanca/gris y tema PWA actualizado.
- Conserva la clave de datos IndexedDB original (`cdt_demo_v1`) para preservar movimientos de la demo.
- Versión de caché del service worker renovada.

## Fuente y disponibilidad del logo
El logotipo Mahou referencia el archivo original `MahouLogo.svg` atribuido a Grupo Mahou-San Miguel en [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:MahouLogo.svg). **El archivo gráfico no se ha podido descargar e incluir físicamente en el ZIP**. Necesita internet para mostrarse desde su enlace; sin conexión se sustituye por el texto «Mahou». Para uso plenamente offline hay que incorporar una copia local autorizada del SVG. La marca comercial sigue sujeta a derechos de marca; confirma autorización para usarla.

## Publicar
Extrae los archivos del ZIP y súbelos a la raíz de `control-de-tanques` en GitHub, sustituyendo los siete archivos de v0.1. Github Pages actualizará la aplicación. No borres los datos del navegador ni uses «Reiniciar datos ficticios» si quieres conservar las pruebas anteriores.

## Funciones existentes
- Registro local de cargas por tanque, merma del sobrante y control de capacidad.
- Visitas, descargas con contador acumulativo, cambio de tanque y saldos locales.
- Perfiles simulados, historial e IndexedDB; copia de seguridad JSON.

## Pendiente
- Exportación/importación Excel, auditoría de correcciones, reinicio excepcional del contador.
- Usuarios con permisos reales, cifrado de tiempos y base compartida de Gerencia.
- PWA y uso offline completos con el logo descargado localmente.
