# Control de Tanques v0.8.0 — espacios locales independientes (demo)

## Qué cambia
- Almacén, Reparto y Gerencia guardan sus estados por separado en IndexedDB, incluso si se prueban en el mismo iPhone.
- Al actualizar desde v0.7, se preserva intacta la clave `app` con el estado anterior. Se crean tres espacios nuevos en una transacción.
- Reparto conserva sus existencias, visitas, jornadas y cargas ya recibidas. Los identificadores de cargas locales anteriores se registran como aplicados para no duplicarlos.
- Almacén conserva sus registros de carga y reconstruye su saldo **de demostración** desde valores iniciales ficticios y sus cargas. Esto puede no coincidir con el saldo de Reparto; es deliberado.
- Gerencia conserva los Excel ya importados y los saldos iniciales de conciliación.
- «Descargar copia JSON» guarda los tres espacios de datos de prueba; «Reiniciar datos ficticios» afecta solo al espacio actual.

## Precauciones
1. **Antes de actualizar**, descarga la copia JSON de v0.7. No borres el navegador ni el icono del escritorio.
2. Sube los 12 archivos a GitHub Pages. La versión instalada debe mostrar 0.8.0.
3. Comprueba los saldos y visitas de Reparto, las cargas de Almacén y los Excel de Gerencia.
4. Cambiar de perfil no es una medida de seguridad. No usar datos reales.
5. La copia JSON de esta versión aún es **solo exportación**, no restauración. Consérvala como respaldo.
6. La v0.8 **no incorpora sincronización de Gerencia**. Sigue siendo local de pruebas, sin permisos reales ni control cifrado de tiempos.

**No se debe interpretar el saldo ficticio de Almacén como inventario físico verificado.**
