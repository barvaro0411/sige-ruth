# SIGE Ruth - Contexto y Guía de Desarrollo

Sistema Interno de Gestión Escolar para Escuela de Lenguaje (React + TypeScript/JSX + Vite + Supabase).

## Arquitectura & Stack
- **Frontend**: React 18 (`src/App.tsx`, `src/features/*`), React Router v7, TanStack Query.
- **Backend / DB**: Supabase Client (`src/config/supabaseClient.js`).
- **Contextos**: `AuthContext` (`src/auth/AuthContext.tsx`), `SedeContext` (`src/config/SedeContext.tsx`).
- **Tipado**: Contratos en `src/types/index.ts`:
  - `Tables`: Tipos crudos de DB (snake_case).
  - `Estudiante`, `Asistencia`, `Sede`, `User`: Tipos transformados de frontend (camelCase).
- **Mappers**: `src/utils/mappers.ts` para conversión entre DB y App.
- **Roles**: `director`, `secretaria`, `docente`, `fonoaudiologo`, `jefe_utp`.

## Comandos Clave
- `npm run dev`: Iniciar servidor de desarrollo.
- `npm run type-check`: Verificar tipos TypeScript rápidamente (usar antes de terminar tareas).
- `npm run build`: Compilar proyecto (`tsc && vite build`).

## Reglas para Optimización de Tokens en Claude Code
1. **Edición Quirúrgica**: Modifica solo las líneas necesarias, evita reescribir componentes enteros.
2. **Ubicación de Servicios**: Las llamadas a Supabase residen en `src/services/*Service.ts`.
3. **No inspeccionar archivos ignorados**: No leer `.json` de datos estáticos en `src/db/` ni `package-lock.json`.
4. **Respuestas Concisas**: Prioriza diffs y explicaciones puntuales sin re-listar código no modificado.
