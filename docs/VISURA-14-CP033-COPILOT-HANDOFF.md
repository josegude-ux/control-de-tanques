# VISURA TANQUES · Copilot LAB · CP033

Orden existente: VISURA-14-WORK-TANQUES-001. No crear otra orden ni reconstruir la aplicación.

Base: lab/visura-14-cp033-planificacion, SHA 504b98027561a98e90137b372b4bcdc526a8ff52.
Trabajo: lab/visura-14-cp033-copilot. PR obligatoriamente dirigida a lab/visura-14-cp033-planificacion y en borrador.

Evidencias verificadas: Actions 42721431936 SUCCESS (unitarias y XLSX); 42757617342 SUCCESS (28 unitarias y prueba Chromium de Gerencia → Excel → Reparto con datos ficticios).

## Alcance
- Revisar código existente; no duplicar planificación.
- Ampliar regresión real de UI móvil para edición Gerencia, versiones Excel, permisos Reparto y persistencia tras recarga.
- Verificar explícitamente si el navegador prueba persistencia de datos tras recarga: no confundir carga correcta con persistencia.
- Añadir casos negativos para roles, vehículo incorrecto, versiones divergentes y desconexión con mocks.
- Corregir defectos demostrados y adjuntar prueba roja/verde, SHA y resultado CI.

## Prohibiciones
No modificar main, producción, Supabase, datos reales, autenticación, RPC, RLS, inventarios, INVENTA, PREPARA ALMACÉN ni otros módulos. No fusionar, desplegar, activar auto-merge ni abrir PR contra main. Datos ficticios y backend simulado exclusivamente.

## Entrega
PR borrador hacia LAB con cambios acotados, resultados CI y checkpoint actualizado. En caso de bloqueo, documentar causa y no asumir éxito.

Issue de coordinación: https://github.com/josegude-ux/control-de-tanques/issues/5
