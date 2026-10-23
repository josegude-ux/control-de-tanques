'use strict';
/**
 * DEMO staging conectado al proyecto independiente iuqmzpahyjganhppcsur.
 * Solo clave PUBLICABLE, nunca service_role ni secret key.
 * Nunca debe apuntar al proyecto Supabase de producción.
 */
window.TankConfig={
 env:'staging',
 label:'DEMO STAGING · DATOS FICTICIOS · NO PRODUCCIÓN · v0.10.1',
 supabaseUrl:'https://iuqmzpahyjganhppcsur.supabase.co',
 supabaseAnonKey:'sb_publishable_s79mWzONV_BvYzNZsZPJTQ_3xydPQtx',
 idbName:'cdt_staging_faseb_v1',
 authStorageKey:'tanques-auth-staging-v1',
 cloudMetaPrefix:'tanques-staging-meta',
 cloudProfilePrefix:'tanques-staging',
 swCachePrefix:'control-tanques-staging-',
 swCache:'control-tanques-staging-v0101-fase-b',
 productionHosts:['oevetnszmfxeukcncwji.supabase.co'],
 demoOpening:{cisterna:10000,camion:[500,400,300],furgoneta:[800]}
};
