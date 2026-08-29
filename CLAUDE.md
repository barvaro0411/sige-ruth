# Gestión Ruth — Contexto y Guía de Desarrollo

Sistema interno de gestión para la Escuela de Lenguaje Ruth (React + TypeScript + Vite + Supabase).

No reemplaza al SIGE del MINEDUC. Resuelve los procesos internos que hoy viven en
papel, WhatsApp, Excel o de palabra. Regla rectora: **si una funcionalidad no
ahorra tiempo, no evita errores ni entrega información útil, no se agrega.**

## Arquitectura & Stack
- **Frontend**: React 18 (`src/App.tsx`, `src/features/*`), React Router v7, TanStack Query.
- **Cliente Supabase**: uno solo, en `src/db/database.ts`. `src/config/supabaseClient.js`
  es un re-export de compatibilidad — **no crear clientes nuevos**: dos instancias
  de Auth sobre el mismo storage compiten por refrescar el token.
- **Contextos**: `AuthContext` (`src/auth/AuthContext.tsx`) y, por dentro de él,
  `SedeContext` (`src/config/SedeContext.tsx`). Ese orden importa: la RLS de
  `sedes` exige sesión activa.
- **Tipado**: contratos en `src/types/index.ts` — `Tables` (snake_case, crudo de
  la DB) y los tipos de app (camelCase).
- **Mappers**: `src/utils/mappers.ts` para la conversión DB ↔ app.
- **Roles**: `director`, `sostenedor`, `secretaria`, `docente`, `fonoaudiologo`, `jefe_utp`.
  `director` y `sostenedor` son transversales: ven todas las sedes y no se les
  asigna ninguna (`esRolTransversal()` en `src/auth/permissions.js`).

## Reglas del proyecto

1. **La autorización vive en la base.** RLS y RPC, no solo botones escondidos.
   Ocultar una opción en el frontend no es una medida de seguridad.
2. **Los cambios de estado pasan por RPC.** En materiales, un trigger rechaza
   cualquier `update` directo sobre `estado`. El cliente nunca manda estado,
   revisor ni timestamps: los pone la base con `auth.uid()` y `now()`.
3. **Nadie resuelve su propia solicitud**, ni el director. Para eso existe el
   rol sostenedora.
4. **No se borra historia.** Una solicitud enviada se cancela, no se elimina.
   Un error de stock se corrige con un movimiento de ajuste.
5. **Todo cambio de base va en `supabase/migrations/`**, versionado, partiendo
   del estado real de producción. Nada de SQL suelto aplicado a mano.
6. **Dinero en `numeric`**, nunca en coma flotante.
7. **Las sedes se leen de la tabla `sedes`**, no se escriben en el código.
8. **Acceso a datos en `src/services/*Service.ts`.** Sin consultas a Supabase
   dentro de componentes de presentación.

## Decisiones tomadas

- **No hay módulo de asistencia de estudiantes.** Se lleva en el libro de clases
  y se sube al SIGE del MINEDUC; duplicarla acá era doble trabajo, riesgo de
  inconsistencia y ningún valor. La tabla se eliminó y el código se retiró.
- **El generador de PDF se carga bajo demanda** (`lazy` + fuera del precache de
  la PWA): son ~1,5 MB que la mayoría del personal nunca usa.

## Comandos
- `npm run dev` — servidor de desarrollo.
- `npm run type-check` — TypeScript sin emitir. Correr antes de dar por terminada una tarea.
- `npm run build` — compilación de producción (`tsc && vite build`).

## Al trabajar con Claude Code
1. **Edición quirúrgica**: modificar solo lo necesario, sin reescribir componentes enteros.
2. **No inspeccionar archivos ignorados**: `scripts/*.json`, `package-lock.json`.
3. **Respuestas concisas**: diffs y explicaciones puntuales.
