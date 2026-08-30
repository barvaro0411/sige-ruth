# Gestión Ruth — Contexto y Guía de Desarrollo

Sistema interno de gestión para la Escuela de Lenguaje Ruth (React + TypeScript + Vite + Supabase).

No reemplaza al SIGE del MINEDUC. Resuelve los procesos internos que hoy viven en
papel, WhatsApp, Excel o de palabra. Regla rectora: **si una funcionalidad no
ahorra tiempo, no evita errores ni entrega información útil, no se agrega.**

## Arquitectura & Stack
- **Frontend**: React 18 (`src/app/App.tsx`, `src/features/*`), React Router v7, TanStack Query.
- **Estructura**: `app/` arranque y layout · `auth/` sesión, sede y permisos ·
  `components/` compartidos · `features/` una carpeta por pantalla ·
  `services/` todo el acceso a datos · `db/` el cliente · `types/` · `utils/` ·
  `constants.ts`.
- **Cliente Supabase**: uno solo, en `src/db/database.ts`. **No crear clientes
  nuevos**: dos instancias de Auth sobre el mismo storage compiten por refrescar
  el token. El re-export de compatibilidad `config/supabaseClient.js` se eliminó
  cuando dejó de tener importadores.
- **Contextos**: `AuthContext` (`src/auth/AuthContext.tsx`) y, por dentro de él,
  `SedeContext` (`src/auth/SedeContext.tsx`). Ese orden importa: la RLS de
  `sedes` exige sesión activa.
- **Tipado**: contratos en `src/types/index.ts` — `Tables` (snake_case, crudo de
  la DB) y los tipos de app (camelCase).
- **Mappers**: `src/utils/mappers.ts` para la conversión DB ↔ app.
- **Roles**: `director`, `sostenedor`, `secretaria`, `docente`, `fonoaudiologo`,
  `jefe_utp`, `aseo`, `bodega`, `mantencion`. Se definen **una sola vez**, en
  `src/auth/permissions.js`, junto a los permisos de cada uno. `director` y
  `sostenedor` son transversales: ven todas las sedes y no se les asigna
  ninguna (`esRolTransversal()`).

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
9. **Un `update` que la RLS filtra no falla**: vuelve sin error y con cero filas.
   En los updates cuya única barrera es la política —sin un trigger que levante
   excepción— hay que encadenar `.select('id')` y pasar el resultado por
   `exigirFilaAfectada()` (`src/db/afectadas.ts`). Si no, la app dice «guardado»
   sobre un cambio que nunca ocurrió.

## Decisiones tomadas

- **No hay módulo de asistencia de estudiantes.** Se lleva en el libro de clases
  y se sube al SIGE del MINEDUC; duplicarla acá era doble trabajo, riesgo de
  inconsistencia y ningún valor. La tabla se eliminó y el código se retiró.
- **El generador de PDF se carga bajo demanda** (`lazy` + fuera del precache de
  la PWA): son ~1,5 MB que la mayoría del personal nunca usa.
- **Mantenciones no usa RPC.** El flujo es más simple que el de materiales y
  las reglas caben en dos triggers: `preparar_mantencion` pone reportante y
  estado inicial, `enforce_mantencion_transicion` decide quién mueve qué. Los
  estados existen todos pero no se obliga a recorrerlos: en una escuela chica
  `reportada → resuelta` es un camino válido.
- **El reporte original no se reescribe.** Lugar, descripción y reportante son
  inmutables. Si estaba mal, se cancela y se reporta de nuevo — editar el texto
  dejaría el historial mintiendo.
- **`preventivas.proxima_fecha` es una columna generada** (última ejecución, o
  el inicio, más la frecuencia). Nadie escribe el vencimiento a mano, así que
  no puede quedar desfasado del historial de ejecuciones.
- **Un préstamo abierto por recurso**, garantizado por un índice único parcial,
  no por el formulario. `recursos.estado` se sincroniza solo entre `disponible`
  y `prestado`: `mantencion` y `no_disponible` los pone una persona y no se
  pisan.
- **El panel de operaciones no tiene tablas propias.** Las tres vistas de la
  fase 8 se calculan al vuelo. Un contador guardado aparte es un contador que
  puede quedar mintiendo, y el panel existe para que nadie desconfíe de él.
- **Las fotos se comprimen a WebP antes de subir** (`comprimirFoto`, ~1600 px,
  calidad 0,72). Se sube con datos móviles desde el patio: una foto de celular
  de 4 MB queda en unos 150 KB y se sigue viendo qué está roto.

## Comandos
- `npm run dev` — servidor de desarrollo.
- `npm run type-check` — TypeScript sin emitir. Correr antes de dar por terminada una tarea.
- `npm run build` — compilación de producción (`tsc && vite build`).
- `npm run test:rls` — pruebas de las reglas de la base. Necesita `DATABASE_URL`.
  Cada archivo revierte su transacción: se puede apuntar a producción.

## Al tocar la base
**Toda migration que cambie una política, un trigger o una RPC lleva su prueba**
en `supabase/tests/`. Una regla de autorización sin prueba es una regla que
alguien va a romper sin enterarse: el modo de fallo es silencioso, no revienta
nada. Ya pasó una vez con `perfiles_select_colegas` (ver el README de esa
carpeta).

## Al trabajar con Claude Code
1. **Edición quirúrgica**: modificar solo lo necesario, sin reescribir componentes enteros.
2. **No inspeccionar archivos ignorados**: `scripts/*.json`, `package-lock.json`.
3. **Respuestas concisas**: diffs y explicaciones puntuales.
