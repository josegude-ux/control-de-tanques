# Control de Tanques v0.6.0 · Conciliación de existencias (DEMO)

Esta versión conserva la v0.5 (cargas, visitas, correcciones, Excel, importación, anti-duplicados y guardado local) y añade en **Gerencia (demo) → Importar jornadas** un panel de conciliación.

## Funcionamiento

1. Los Excel CDT-v0.4 se siguen importando automáticamente y sus IDs no se duplican.
2. Gerencia define los **saldos iniciales de prueba ANTERIORES a la primera operación importada** para cisterna, camión T1-T3 y furgoneta T1. Es obligatorio indicar todos los campos para conciliar.
3. Los movimientos se ordenan por marca temporal, se validan contra el inventario simulado y se descuentan/suman en sus tanques correspondientes.
4. Si falta una carga, hay saldo insuficiente, una merma incoherente o se supera capacidad, el movimiento queda **pendiente**, y se bloquean movimientos dependientes posteriores hasta aclarar la información.
5. Cada importación adicional recalcula la conciliación desde los mismos saldos iniciales, sin duplicar litros; eliminar los saldos iniciales NO borra los Excel importados.
6. La conciliación nunca modifica las cifras de Inicio ni los datos del trabajador.

## Limitaciones importantes

- **SOLO DEMOSTRACIÓN CON DATOS FICTICIOS**. Los saldos calculados NO son inventario oficial.
- No se implementan aún recibos de fábrica ni conciliación formal de declaraciones provisionales. Esos eventos deben modelarse antes de usar existencias reales.
- Sin control real de accesos: Gerencia es un selector visual, no autenticación. El almacenamiento de Gerencia sigue siendo local y no sincroniza PC/móvil.
- Sin tiempos cifrados. No utilizar con datos reales.
- La conciliación requiere que los saldos iniciales precedan a todos los movimientos importados y que no falten operaciones de ese período.

## Prueba sugerida

1. Importar el Excel de reparto de 450 L ya usado en v0.5 (si está importado, no volver a importarlo).
2. Seleccionar Gerencia (demo) y abrir su panel; introducir apertura ficticia de 1.000 L en camión T1, y otros saldos ficticios. Verificar descuento a 550 L T1 si ese es el único movimiento.
3. Importar el mismo Excel otra vez: 0 nuevos, 1 duplicado. El saldo calculado no debe variar.
4. Quitar saldos iniciales de prueba: los registros importados se conservan y se marcan pendientes.

Subir los archivos sueltos del ZIP a la raíz de GitHub Pages. No limpiar datos de Safari ni reinstalar la PWA.
