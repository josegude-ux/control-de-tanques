'use strict';
/**
 * FASE B — Configuración DEMO / staging (NO producción).
 *
 * Cómo usar:
 * 1. Copia este archivo a config.staging.js (gitignored) o rellena en el despliegue DEMO.
 * 2. Crea un proyecto Supabase NUEVO (Free) distinto de oevetnszmfxeukcncwji.
 * 3. Aplica database/tanques-sync.sql + tanques-validation.sql + fase-a-seguridad-inventario.sql
 *    SOLO en ese proyecto.
 * 4. Aplica database/fase-b-staging-seed.sql y crea los 4 usuarios Auth de prueba.
 * 5. Sirve la PWA desde otra URL (p.ej. /demo/ o Pages distinto) con este script ANTES de cloud-sync.js.
 *
 * NUNCA pongas aquí la URL ni la clave del proyecto de producción.
 */
window.TankConfig={
 env:'staging',
 label:'DEMO STAGING · DATOS FICTICIOS · NO PRODUCCIÓN',
 // Sustituir tras crear el proyecto staging (Free):
 supabaseUrl:'https://YOUR_STAGING_PROJECT.supabase.co',
 supabaseAnonKey:'YOUR_STAGING_PUBLISHABLE_OR_ANON_KEY',
 // Aislamiento local respecto a la app de producción en el mismo dispositivo:
 idbName:'cdt_staging_faseb_v1',
 authStorageKey:'tanques-auth-staging-v1',
 cloudMetaPrefix:'tanques-staging-meta',
 cloudProfilePrefix:'tanques-staging',
 swCachePrefix:'control-tanques-staging-',
 swCache:'control-tanques-staging-v0101-fase-b',
 // Hosts de producción bloqueados en modo staging (escritura denegada):
 productionHosts:['oevetnszmfxeukcncwji.supabase.co'],
 demoOpening:{
  cisterna:10000,
  camion:[500,400,300],
  furgoneta:[800]
 }
};
