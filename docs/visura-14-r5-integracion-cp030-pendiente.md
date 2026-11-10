# VISURA PREPARA TANQUES — integración R5 CP030 (preparación de revisión)

Orden: VISURA-14-WORK-TANQUES-001
Checkpoint: VISURA-14-CP033-R5-INTEGRACION-CANDIDATA-030
Fuente local: VISURA_14_R5_LAB_INTEGRACION_CP030.zip
SHA-256: 97471ca92032864ff73d24a9158c6997c6e7fb0e0888fbd046bffb80a349451c

## Estado
Rama aislada creada para integrar la candidata R5; **el código CP030 todavía NO se ha transferido a esta rama**.
No fusionar ni publicar. Validación funcional en navegador pendiente.

## Integración prevista
- Conservar el código actual de control-de-tanques y sus contratos Supabase.
- Adaptar en revisión el selector «Tanques de clientes» / «Nuestras cargas» al Inicio existente.
- Incorporar imágenes aprobadas y componentes visuales de la candidata.
- Reutilizar rutas de clientes, planificación, carga, descarga e historial, respetando perfiles.
- Separar datos de demostración de saldos reales.
- Comparar cambios contra HEAD antes de reemplazar ningún archivo.

## Restricciones
No tocar main, Supabase, INVENTA, ALMACÉN, Copilot ni producción. No hacer merge o deploy sin autorización.
