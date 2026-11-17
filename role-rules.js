/* Reglas de perfil puras (sin DOM ni red), compartidas con las pruebas de Node.
   No cambian roles internos ni datos: solo deciden qué se permite en pantalla. */
(function(root){
 'use strict';
 /** Una descarga abierta bloquea «Nueva carga» solo al perfil Reparto y solo para su propio vehículo.
     Gerencia ve las visitas abiertas de todos los conductores y Almacén no descarga: a ellos nunca les bloquea. */
 function openVisitBlocksLoad(s,vehicle=s?.vehicle){
  return s?.role==='reparto'&&!!s.openVisit&&s.openVisit.vehicle===vehicle;
 }
 /** Solo Reparto queda anclado al vehículo de su descarga abierta al elegir vehículo de carga. */
 function openVisitLocksLoadVehicle(s){
  return s?.role==='reparto'&&!!s.openVisit;
 }
 const api={openVisitBlocksLoad,openVisitLocksLoadVehicle};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.TankRoles=api;
})(typeof self!=='undefined'?self:this);
