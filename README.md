# Control de Tanques — Demo local v0.1

**Estado: prototipo, NO utilizar con datos reales.**

Versión inicial sin Lovable, lista para subir a GitHub y desplegar como sitio estático HTTPS.

## Incluye
- Interfaz móvil para Almacén, Reparto y una vista demostrativa de Gerencia.
- Cantidades iniciales ficticias: cisterna 18.000 L; camión 800/650/1.000 L; furgoneta 900 L.
- Registro local de cargas individuales, control de capacidad y merma del sobrante.
- Visitas a clientes ficticios, contador de descarga acumulativo, varias descargas y saldos por compartimento.
- Mantiene seleccionado el tanque de origen; exige seleccionar tanque del cliente en cada nueva descarga.
- Historial local, persistencia IndexedDB y copia JSON de pruebas.
- PWA con service worker para uso offline **después de haberla abierto una vez desde HTTPS**.

## Todavía NO incluye
- Autenticación o permisos reales; cambiar de perfil es solo una simulación.
- Excel XLSX, importación automática, envío diario o archivo de cargas de Gerencia.
- Cifrado y privacidad real de cronómetros; los cronómetros todavía no están implementados.
- Corrección auditada, reinicio de contador a mitad de visita, conciliación de existencias provisionales.
- Base central Supabase o sincronización Gerencia PC/móvil.
- Operaciones reales ni seguridad de producción.

## Publicación de prueba
1. Subir **los archivos de este ZIP extraídos** a la raíz del repositorio nuevo (`index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `icon.svg`, `README.md`).
2. En GitHub → Settings → Pages → desplegar desde rama `main`, carpeta `/ (root)`. La web será accesible mediante HTTPS en la URL que muestre GitHub Pages. **GitHub Pages puede hacer público el contenido del sitio incluso si el repositorio es privado; no publicar datos sensibles ni claves.**
3. Abrir la web en Safari y, si se desea, Compartir → Añadir a pantalla de inicio.
4. Probar solo con datos ficticios. No confundir una app en GitHub Pages con protección de cuentas o datos.

Los datos se almacenan en IndexedDB del dispositivo/navegador, no en el repositorio. Borrar datos del navegador puede eliminarlos. Descargar respaldo JSON antes de cualquier limpieza.
