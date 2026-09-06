# Remediación y despliegue seguro

## Refuerzo del 6 de septiembre de 2026

- La caché de consultas y mutaciones se vacía al cerrar sesión, cambiar de
  cuenta o revalidar un cambio de rol, sedes o contraseña temporal. Las
  respuestas de perfil anteriores al cierre no pueden restaurar la sesión.
- El cierre oculta los datos inmediatamente, incluso mientras espera la red.
  El refresco automático del token no renueva el plazo de inactividad y un
  clic después del vencimiento no lo reinicia. Si localStorage está bloqueado,
  el plazo se mantiene en memoria durante la vida de la pestaña.
- `admin-users` exige que el director haya reemplazado su contraseña temporal
  antes de crear cuentas. El cuerpo JSON se limita a 16 KiB durante la lectura,
  incluso sin Content-Length; ambas contraseñas admiten como máximo 128
  caracteres. Las respuestas llevan `Cache-Control: no-store` y la dependencia
  de Supabase de la función queda fijada a una versión concreta.
- Browserslist se actualizó de 4.28.2 a 4.28.9 para resolver los avisos
  [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) y
  [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g).
  CI audita también dependencias de desarrollo y usa un token de GitHub de
  solo lectura. El escáner de secretos muestra únicamente nombres de archivos
  y falla si no puede completar el análisis.

Validación local: pruebas unitarias y de ciclo de sesión, TypeScript, ESLint,
compilación de producción, escáneres de secretos/privacidad y `npm audit`.
Las pruebas de sesión usan servicios simulados; no acreditan la configuración
del Supabase desplegado ni sustituyen las pruebas RLS. En este entorno no se
dispone de Deno, Docker ni psql para ejecutar la función y la base localmente.

Este refuerzo no introduce migraciones SQL. El frontend se publicó en producción
el 6 de septiembre de 2026 en https://sige-ruth.vercel.app, despliegue Vercel
`dpl_LCDs1oLgmxsbNCbuxwwAZuSw33jE` (READY). Se verificaron HTTP 200, la pantalla
de inicio de sesión, las cabeceras CSP/DENY/nosniff y ausencia de errores de
JavaScript durante esa visita. Los assets coinciden con la compilación local.
La actualización de `admin-users` sigue pendiente de autenticar la CLI de
Supabase; la función existente responde al preflight del dominio de producción.
No se modificó la base de datos. Los cambios de CI se incluyen en la rama
`remediacion-auditoria-septiembre`; el workflow se ejecuta en pushes a `main`
y en pull requests dirigidos a `main`.
El cierre por inactividad es una protección del navegador: para imponer plazos
a clientes externos se requiere también configurar sesiones en Supabase Auth.

Referencias de implementación:
[limpieza de QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientclear)
y [cierre de sesión de Supabase](https://supabase.com/docs/reference/javascript/auth-signout).

Este cambio corrige el código y deja las migraciones preparadas, pero **no
modifica automáticamente producción ni reescribe el historial remoto**. Esas
operaciones requieren una ventana coordinada, respaldo y revisión del estado
real.

## 1. Incidente de datos versionados

El archivo inseguro fue retirado del árbol actual. Para eliminarlo del historial:

1. Cambiar temporalmente el repositorio a privado y congelar pushes.
2. Crear un respaldo cifrado con acceso limitado para preservar evidencia.
3. Revisar colaboradores, forks, clones, Actions, artefactos y cachés.
4. En un clon de mantenimiento, instalar `git-filter-repo` y ejecutar:

   ```bash
   git filter-repo --path scripts/seed_custom_data.js --invert-paths
   ```

5. Verificar el resultado antes de hacer un push forzado coordinado de todas
   las ramas y etiquetas. Todos los colaboradores deben eliminar sus clones
   antiguos y volver a clonar.
6. Registrar alcance, responsables y fechas; evaluar la notificación de
   privacidad que corresponda con asesoría competente.

No se debe ejecutar el paso 4 sobre el único clon ni hacer el push forzado sin
la coordinación anterior.

## 2. Migraciones en una base existente

Los tres archivos `20260829000000`, `20260829001000` y `20260829002000`
constituyen el baseline reconstruido. En producción las tablas base ya existen,
por lo que esos archivos deben marcarse como aplicados, no ejecutarse otra vez.

```bash
npx --no-install supabase migration list
npx --no-install supabase migration repair 20260829000000 20260829001000 20260829002000 --status applied
npx --no-install supabase db push --dry-run
```

Solo después de confirmar que el `dry-run` propone las migraciones posteriores,
aplicar con `npx --no-install supabase db push`. En una instancia nueva, no se hace `repair`:
`supabase db reset` debe ejecutar toda la cadena desde el baseline.

Antes del push, consultar `pg_policies` en producción y ejecutar
`npm run test:rls` contra local/staging. Después del push, repetir consultas
directas de solo lectura por rol en producción; las pruebas con fixtures no se
ejecutan allí. La migración nueva no descarga documentos ni inspecciona su
contenido.

## 3. Auth y Edge Function

1. Desplegar nuevamente `admin-users` después de aplicar la migración.
2. En Authentication → Policies, configurar un mínimo de 12 caracteres,
   combinación fuerte y protección contra contraseñas filtradas.
3. Exigir MFA a cuentas administrativas según la política institucional.
4. Verificar Site URL y redirects contra `supabase/config.toml`.

El flujo de alta ahora limita intentos, marca la contraseña como temporal,
bloquea los datos por RLS y obliga a reemplazarla antes de continuar.

## 4. Objetos huérfanos

Inventariar únicamente nombres/rutas y tamaños mediante SQL o la API
administrativa. No descargar archivos. Revisar por separado:

- objetos de `documentos_estudiantes` sin fila en `estudiantes_documentos`;
- objetos de `adjuntos_solicitudes` sin fila en `adjuntos_solicitudes`;
- metadata cuya ruta ya no existe en Storage.

La consulta de solo lectura preparada para este inventario está en
`supabase/maintenance/inventario_storage_huerfano.sql`. Ejecutarla en una
sesión administrativa y conservar el resultado en un repositorio de incidentes
con acceso restringido, nunca en Git.

La eliminación debe aprobarse después de revisar el inventario y conservar un
registro de lo eliminado.

## 5. Verificación mínima de despliegue

```bash
npm ci
npm run lint
npm run type-check
npm test
npm run build
npm audit --omit=dev
npm run test:rls
```

`test:rls` usa Supabase local o una rama aislada; nunca la base de producción.

Verificar además los encabezados CSP en Preview, cada rol mediante llamadas
directas a Supabase y los flujos subir/eliminar de ambos buckets.
