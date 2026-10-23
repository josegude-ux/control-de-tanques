'use strict';
/**
 * DEMO staging — sustituir URL y clave tras crear el proyecto Supabase Free independiente.
 * Este archivo NO debe apuntar nunca a oevetnszmfxeukcncwji (producción).
 * Ver config.staging.example.js y docs/FASE-B-STAGING.md
 */
window.TankConfig={
 env:'staging',
 label:'DEMO STAGING · DATOS FICTICIOS · NO PRODUCCIÓN · v0.10.1',
 supabaseUrl:'https://YOUR_STAGING_PROJECT.supabase.co',
 supabaseAnonKey:'YOUR_STAGING_PUBLISHABLE_OR_ANON_KEY',
 idbName:'cdt_staging_faseb_v1',
 authStorageKey:'tanques-auth-staging-v1',
 cloudMetaPrefix:'tanques-staging-meta',
 cloudProfilePrefix:'tanques-staging',
 swCachePrefix:'control-tanques-staging-',
 swCache:'control-tanques-staging-v0101-fase-b',
 productionHosts:['oevetnszmfxeukcncwji.supabase.co'],
 demoOpening:{cisterna:10000,camion:[500,400,300],furgoneta:[800]}
};
