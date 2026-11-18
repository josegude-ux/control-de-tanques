# Registro de cambios — VISURA TANQUES (control-de-tanques)

Versiones publicadas desde GitHub `main`. Los paquetes sellados no se modifican; cada cambio va en una versión nueva.
Las versiones 0.10.6 y 0.10.7 no se usan aquí: la línea 315 ya las empleó para sus paquetes (0.10.6 «retorno», 0.10.7-RC1), y se saltan para que no haya dos versiones con el mismo número.

## 0.10.8 — 18/11/2026 · línea 300 TANQUES · PROBADO LAB

### Perfil «Operaciones»
- El perfil Gerencia se muestra como **Operaciones** en pantallas, avisos, diálogos y PDF.
- El rol interno sigue siendo `gerencia` en IndexedDB, Supabase, `cloud-sync.js` y `sync-core.js`.
- Una única fuente de etiquetas en `role-rules.js` (`ROLE_LABELS`, `roleLabel`, `relabel`).
- En «Gestionar accesos» se sigue guardando `gerencia` aunque se lea «Operaciones».

### Incluido de la integración anterior (PR #15)
- «Finaliza primero la visita en curso» solo bloquea «Nueva carga» al perfil Reparto y solo en su propio vehículo.

## 0.10.5 y anteriores
Sin registro de cambios en el repositorio; ver `version.json` y el historial de Git.
