# Registro de cambios — VISURA TANQUES (control-de-tanques)

Versiones publicadas desde GitHub `main`. Los paquetes sellados no se modifican; cada cambio va en una versión nueva.
Las versiones 0.10.6 y 0.10.7 no se usan aquí: la línea 315 ya las empleó para sus paquetes (0.10.6 «retorno», 0.10.7-RC1), y se saltan para que no haya dos versiones con el mismo número.

## 0.10.9 — 18/11/2026 · línea 300 TANQUES · PROBADO LAB

Corrección de uso diario (decisión de 000, CP014: en esta app solo correcciones; las funciones nuevas van a TANQUES 4.0).

### Instalación ligera
- La descarga inicial al instalar o actualizar pasa de **8,0 MB a 1,5 MB**.
- Mismas imágenes, nombres, formatos y proporciones, ajustadas a la resolución que se ve en el móvil:
  - Cabeceras de Cargas y Descargas: 2172×724 → 1200×400 (de 2,4 MB a 0,24 MB cada una).
  - Logo: 1254 → 600 px (de 1,4 MB a 0,12 MB).
  - Icono 512×512: misma medida, de 402 a 124 KB.
  - Imágenes de referencia: 1536 → 768 px de ancho (de ~0,4 MB a ~0,07 MB).
- Antes, si fallaba una sola de esas descargas grandes, la app no quedaba instalada para usarse sin conexión.

### Sin textos de demostración con sesión iniciada
- Nueva carga, Planificación e Historial de Reparto muestran textos de producción con sesión iniciada. Sin sesión (modo demostración) conservan sus avisos de demostración.
- «Visita ficticia guardada» pasa a «Visita guardada».
- Inicio: «saldos ficticios anteriores» pasa a «saldos locales anteriores».
- Selector de perfil (lectores de pantalla) y descripción de la página sin «demostración» ni «prototipo».
- Sin cambios en los nombres de archivos Excel ni en la base local (`cdt_demo_v1`): cambiarlos rompería el intercambio o los datos guardados.

### Pruebas
- Nueva `tests/precarga.test.js`: archivos presentes, total < 1,5 MB, ninguna imagen > 300 KB, proporciones y tamaño útil.
- Nueva `tests/browser-sin-demo.cjs`: recorre con sesión iniciada todas las pantallas de Operaciones, Almacén y Reparto buscando textos de demostración.

## 0.10.8 — 18/11/2026 · línea 300 TANQUES · PROBADO LAB

### Perfil «Operaciones»
- El perfil Gerencia se muestra como **Operaciones** en pantallas, avisos, diálogos y PDF.
- El rol interno sigue siendo `gerencia` en IndexedDB, Supabase, `cloud-sync.js` y `sync-core.js`.
- Una única fuente de etiquetas en `role-rules.js` (`ROLE_LABELS`, `roleLabel`, `relabel`).
- En «Gestionar accesos» se sigue guardando `gerencia` aunque se lea «Operaciones».

### Operaciones: Carga y Descarga completas
- Operaciones puede cargar y descargar desde su propio perfil, y lo que registra se sincroniza (antes se quedaba solo en el móvil).
- La descarga en curso es siempre la propia: Operaciones ya no hereda ni continúa la visita abierta de otro conductor, y solo reabre sus propias visitas.
- Carga y Descarga vuelven a verse en el menú de Operaciones con sesión iniciada.
- Accesos «Nueva carga» y «Nueva descarga» en Inicio.

### Informe PDF diario por vehículo
- Con el filtro de vehículo, el PDF se llama `VISURA_TANQUES_MOVIMIENTOS_AAAA-MM-DD_CAMION.pdf` o `_FURGONETA.pdf`.

### Pruebas
- Nuevas: `tests/browser-operaciones-carga-descarga.cjs`, más pruebas unitarias de sincronización, reglas y PDF.
- Corregidas esperas asíncronas en `browser-fase-a.cjs`, `browser.cjs` y `browser-carga-visita.cjs`.

### Incluido de la integración anterior (PR #15)
- «Finaliza primero la visita en curso» solo bloquea «Nueva carga» al perfil Reparto y solo en su propio vehículo.

## 0.10.5 y anteriores
Sin registro de cambios en el repositorio; ver `version.json` y el historial de Git.
