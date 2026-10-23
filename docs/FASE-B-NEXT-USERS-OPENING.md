# Fase B — Siguiente paso (NO ejecutado · detenerse aquí)

**Bloqueo actual:** falta aplicar `fase-b-staging-rls-read.sql` en `iuqmzpahyjganhppcsur` (sin anon key / DB password en el agente).  
**Prohibido:** producción `oevetnszmfxeukcncwji`, datos reales, tocar `main`, publicar PWA.

Cuando autorices y entregues credenciales DEMO (o confirmes SQL Editor), orden:

## 0. Prerrequisito remoto

1. Confirmar `fase-b-staging-seguridad.sql` ya en staging.  
2. Pegar y ejecutar `database/fase-b-staging-rls-read.sql` solo en SQL Editor de `iuqmzpahyjganhppcsur`.  
3. Verificar matriz Gerencia / Almacén / Reparto (camión y furgoneta).  
4. Solo entonces continuar.

## 1. Cuatro usuarios Auth (ficticios)

| Email sugerido | Rol | Vehículo |
|----------------|-----|----------|
| demo.gerencia@example.test | gerencia | — |
| demo.almacen@example.test | almacen | — |
| demo.reparto.camion@example.test | reparto | camion |
| demo.reparto.furgoneta@example.test | reparto | furgoneta |

Crear en Auth Dashboard → anotar UUID → `database/fase-b-staging-seed.sql` (`tanques_members`, `active=true`).

## 2. Opening DEMO (vía Gerencia + RPC)

- cisterna: **10000** L  
- camión: **[500, 400, 300]** L  
- furgoneta: **[800]** L  
- `demo: true` + label ficticio  

Plantilla: `database/fase-b-staging-opening-demo.sql` (preferido: login Gerencia → `tanques_sync_batch`).

## 3. Conexión DEMO

Rellenar `demo/config.js` con URL `https://iuqmzpahyjganhppcsur.supabase.co` + anon key (nunca producción).

**Este documento no crea usuarios ni existencias.** Requiere autorización explícita tras RLS remoto OK.
