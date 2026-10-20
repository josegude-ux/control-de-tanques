# Control de Tanques · Mahou · demo local v0.3

## Novedades
- Corregir tanque de destino y lectura de una descarga dentro de la visita, con motivo e historial.
- Recalcular los litros de la descarga siguiente si el contador es acumulativo, y bloquear cambios que provoquen saldo negativo.
- Registrar puestas a cero excepcionales del contador entre descargas, sin alterar los litros previos.
- Reabrir la última visita cerrada antes del envío diario, solo cuando no existan movimientos posteriores del mismo vehículo.
- Conservar el almacenamiento IndexedDB (`cdt_demo_v1`) para no perder las pruebas.
- Actualización automática con `version.json` y menú Más.

## Limitaciones IMPORTANTES
- Exclusivamente datos ficticios. El selector de perfil NO protege información ni hay gestión de usuarios.
- Todavía no hay Excel, sincronización con Gerencia, tiempos seguros ni control de jornada enviada.
- Las correcciones se restringen a visitas sin movimientos posteriores para evitar descuadres históricos.
- No usar con datos reales hasta completar permisos, auditoría, conciliación y pruebas.

## Instalación
Sube todos los archivos a la raíz de `josegude-ux/control-de-tanques`, reemplazando las versiones anteriores. GitHub Pages publicará desde `main` / raíz. No borres datos del sitio en Safari.
