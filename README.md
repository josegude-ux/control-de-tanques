# Control de Tanques v0.9.0 — Existencias provisionales (demo)

## Funcionalidad
- En Reparto → Más aparece «Inicio excepcional sin archivo de cargas». Solo antes de la primera operación del vehículo ese día.
- Se introducen litros de cada tanque, con confirmación. Se registra la declaración anterior y nueva y se marca pendiente de Gerencia.
- Las descargas posteriores descuentan del saldo declarado.
- Si llega un Excel de Gerencia mientras haya una apertura provisional, sus cargas quedan pendientes, **sin sumarse**, para evitar duplicar existencias.
- El Excel diario sigue teniendo ocho hojas; la hoja Control incluye la declaración provisional para que Gerencia pueda verla al importar la jornada.
- Gerencia muestra las aperturas provisionales recibidas, pendientes de cotejo manual. **Esta versión no implementa aún la resolución automática ni un archivo de saldos confirmados.**

## Instalación y seguridad
- Descarga primero una copia JSON con la v0.8. No borres los datos del dispositivo.
- Sustituye los doce archivos en GitHub Pages y actualiza a v0.9.0.
- Solo DEMO. No hay permisos reales, sincronización ni tiempos protegidos. Los perfiles no son un sistema de seguridad.
- No utilizar con datos reales.
