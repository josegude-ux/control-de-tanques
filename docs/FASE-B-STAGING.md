# Fase B — Entorno de pruebas multidispositivo (DEMO)

**Versión:** 0.10.1  
**Rama de trabajo:** `fix/fase-a-seguridad-inventario`  
**Estado:** preparación local lista. **Staging Supabase aún no creado. DEMO web aún no publicada** (requiere autorización).

## Objetivo

Comprobar sincronización automática entre iPhone, Android y ordenador con datos **100 % ficticios**, sin tocar producción.

## Aislamiento (obligatorio antes de desplegar)

| Capa | Producción | Staging / DEMO |
|------|------------|----------------|
| Supabase project | `oevetnszmfxeukcncwji` | **Proyecto NUEVO** (Free) |
| URL web | app de producción | otra ruta u origen (`/demo/` u otro Pages) |
| IndexedDB | `cdt_demo_v1` | `cdt_staging_faseb_v1` |
| Auth storage | `tanques-auth-v1` | `tanques-auth-staging-v1` |
| Meta / perfiles cloud | `tanques-cloud-*` | `tanques-staging-*` |
| Service Worker cache | `control-tanques-demo-*` | `control-tanques-staging-*` |
| Guardrail código | — | `assertStagingIsolation()` bloquea host de producción |

Checklist previo a cualquier deploy DEMO:

1. [ ] Project ref staging ≠ `oevetnszmfxeukcncwji`
2. [ ] `demo/config.js` sin URL/clave de producción
3. [ ] SQL Fase A aplicado **solo** en staging
4. [ ] Banner visible: «DEMO STAGING · DATOS FICTICIOS»
5. [ ] En el mismo iPhone, abrir prod y DEMO: colas IndexedDB distintas

## Coste

Supabase **Free tier** basta para estas pruebas. Si el plan gratuito no estuviera disponible o hubiera que pasar a pago, **parar y pedir autorización** antes de generar costes.

## Pasos para crear staging (cuando se autorice)

1. En supabase.com → **New project** (organización distinta o nombre `control-tanques-staging`).
2. Auth → Users: crear  
   - `demo.gerencia@…`  
   - `demo.almacen@…`  
   - `demo.reparto.camion@…`  
   - `demo.reparto.furgoneta@…`  
   Contraseñas solo de prueba; no reutilizar credenciales reales.
3. SQL Editor (proyecto staging):  
   `tanques-sync.sql` → `tanques-validation.sql` → `fase-a-seguridad-inventario.sql`
4. Completar `database/fase-b-staging-seed.sql` con UUID y roles (`gerencia` / `almacen` / `reparto`+vehículo).
5. Copiar URL + anon/publishable key a `demo/config.js`.
6. Gerencia inicia sesión en DEMO y crea opening DEMO (500/400/300 + furgoneta 800 + cisterna 10000) o vía RPC del seed.

## Publicar DEMO accesible desde el móvil

Opciones (todas requieren **autorización explícita** de publicación):

- GitHub Pages en ruta `/demo/` o rama `gh-pages-demo`
- Netlify/Cloudflare Pages Free apuntando al repo (solo carpeta demo + assets)

**No se publica en este turno.** Enlace e instrucciones iPhone se facilitan en cuanto haya URL autorizada.

## Guía de prueba iPhone ↔ otro dispositivo

Usuarios distintos en cada aparato (ejemplo):

| Dispositivo | Usuario | Qué probar |
|-------------|---------|------------|
| iPhone A | Reparto camión | Descarga offline → recuperar cobertura → sync auto |
| Android / PC | Almacén | Carga; ver saldo compartido en iPhone sin pulsar (o «Sincronizar ahora») |
| PC | Gerencia | Opening/ajuste; autorizar miembros; anulación auditada |
| iPhone B | Reparto furgoneta | No puede escribir descargas de camión; saldos flota visibles |

Secuencia sugerida:

1. Gerencia: opening DEMO.  
2. Almacén (online): carga 20 L camión T1.  
3. iPhone camión (offline): descarga 10 L → pendientes.  
4. Volver online: sync automática / forzada; sin duplicados.  
5. Segundo dispositivo: misma descarga no se duplica (CONFLICT).  
6. Dos descargas concurrentes que juntas superan stock → una STOCK.  
7. Anulación visita sync: historial sí, litros no se restauran solos.  
8. Incidencia origen desconocido (tipo BARALLETE): sin asignación a tanque.  
9. Restablecer con `fase-b-staging-reset.sql` solo en staging.

## Pruebas automatizadas (ya locales)

```bash
npm test
npm run test:sql
npm run test:browser:fase-a   # mock, no Supabase real
```

## Restricciones vigentes

- NO Supabase real / producción  
- NO importar datos reales  
- NO merge PR #2 / NO tocar `main`  
- NO push sin autorización adicional  
- NO publicar DEMO sin autorización adicional  
