# Configuración de Supabase para Gestión Ruth

## 1. Crear el esquema

Todo el esquema vive en `supabase/migrations/`, versionado y en orden. No hay
SQL suelto que aplicar a mano.

```bash
npx --no-install supabase link --project-ref <ref-del-proyecto>
npx --no-install supabase db push
```

Las migrations crean, en este orden: sedes y cursos, perfiles vinculados a
Supabase Auth, estudiantes y sesiones fonoaudiológicas, auditoría por trigger,
permisos y feriados, materiales con ítems e historial, inventario y
movimientos, mantenciones correctivas y preventivas, préstamos de recursos, el
panel de operaciones, las políticas RLS de cada tabla y los buckets privados
`documentos_estudiantes` y `adjuntos_solicitudes`.

Para demostrar la reconstrucción completa sin tocar un proyecto remoto:

```bash
npx --no-install supabase db start
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' npm run test:rls
```

`supabase/seed.sql` contiene únicamente identidades sintéticas `.invalid` para
el entorno local y las pruebas; `db push` no lo carga en producción.

> **No hay módulo de asistencia de estudiantes.** Se lleva en el libro de clases
> y se sube al SIGE del MINEDUC. La tabla se eliminó y el código se retiró.

## 2. Configurar las variables locales

Copia `.env.example` como `.env` y completa los valores del proyecto:

```bash
cp .env.example .env
```

La clave `SUPABASE_SECRET_KEY` se usa únicamente para cargar los datos
iniciales desde el computador. No debe llevar el prefijo `VITE_`, publicarse en
Vercel ni compartirse.

## 3. Crear el primer usuario director

1. En Supabase abre **Authentication > Users**.
2. Crea un usuario con correo y contraseña.
3. El trigger creará su fila en `public.perfiles`, **inactiva y sin rol
   efectivo**: el alta nunca confía en datos que manda el cliente. Por eso el
   paso siguiente incluye `activo = true`.
4. En SQL Editor ejecuta, reemplazando el correo y nombre:

```sql
update public.perfiles
set nombre = 'Nombre Directora', rol = 'director', sede_id = null, activo = true
where email = 'directora@escuelaruth.cl';
```

Un director con `sede_id = null` puede trabajar con ambas sedes. Para el resto
del personal usa `gambino` o `vascongados` y uno de estos roles: `secretaria`,
`docente`, `fonoaudiologo`, `jefe_utp`, `aseo`, `bodega` o `mantencion`.

## 4. Cargar estudiantes y cursos existentes

Con `.env` configurado, ejecuta:

```bash
npm run seed:data
```

El cargador usa la clave de servicio, importa los dos archivos JSON existentes
y evita duplicados de RUT dentro de cada carga.

## 5. Verificar

Ejecuta esta consulta en SQL Editor:

```sql
select 'sedes' as tabla, count(*) from public.sedes
union all select 'cursos', count(*) from public.cursos
union all select 'perfiles', count(*) from public.perfiles
union all select 'estudiantes', count(*) from public.estudiantes;
```

Luego inicia la aplicación:

```bash
npm run dev
```

Inicia sesión con el usuario director y comprueba matrícula, fonoaudiología,
documentos y auditoría.

## 6. Habilitar administración de usuarios

Las migrations ya protegen al último director activo y registran los cambios de
usuarios en auditoría. Falta solo desplegar la función que crea cuentas:

1. Instala/inicia sesión en la CLI y vincula este directorio al proyecto:

```bash
npx --no-install supabase login
npx --no-install supabase link --project-ref TU_PROJECT_REF
```

2. Despliega la función segura que crea cuentas en Supabase Auth:

```bash
npm run deploy:admin-users
```

La función se encuentra en `supabase/functions/admin-users/index.ts`. Supabase
inyecta sus secretos del servidor durante la ejecución; ninguna clave secreta
se incluye en el frontend.

## 7. Usuarios que trabajan en varias sedes

La administración de usuarios permite marcar una o ambas sedes para
coordinadoras, fonoaudiólogas u otros trabajadores compartidos.

Director y sostenedora son transversales: acceden a todas las sedes y no se les
asigna ninguna. Los demás roles solo pueden
consultar las sedes marcadas en su perfil y verán un selector cuando tengan más
de una asignada.

## Migrations

La cadena incluye ahora un baseline reconstruible y una migración de seguridad
posterior a la auditoría. Los cambios nuevos **no deben considerarse aplicados
en producción** hasta completar el procedimiento de
`SECURITY_REMEDIATION.md`. Se corren con `npx --no-install supabase db push` y su orden es el
del nombre del archivo.

Los antiguos parches sueltos de la raíz (`supabase_schema.sql`,
`supabase_gestion_patch.sql` y los demás) siguen retirados. Las definiciones
base necesarias se consolidaron como las migraciones `20260829000000` a
`20260829002000`; las migraciones siguientes convergen al estado funcional
actual y eliminan la antigua tabla de asistencia.

### Pasos manuales que siguen pendientes

1. **Cargar los feriados del año** en la tabla `feriados`. Sin datos, el cálculo de días hábiles solo descuenta sábados y domingos.
2. **Configurar el cupo anual de cada trabajador** en `cupos_permiso`. Ya no hay valor por defecto: sin fila, la persona no ve saldo. El número depende del contrato o estatuto de cada uno, por eso no se fija uno solo para todos.
3. **Crear la cuenta de la sostenedora** desde Usuarios, con rol `sostenedor`. Es quien resuelve los permisos del director, porque nadie resuelve los propios.
4. Opcional: si se instala `pg_cron`, programar `notificar_solicitudes_atrasadas()` para avisar de solicitudes vencidas.

El SQL para cargar los cupos quedó al pie de la migration `...160100_permisos_historial_y_transiciones.sql`.

### Avisos esperados del linter

Los *advisors* de Supabase marcan una vista `SECURITY DEFINER` (advisor 0010) y varias funciones `SECURITY DEFINER` ejecutables por usuarios con sesión. Las dos cosas son deliberadas:

- `calendario_ausencias_vista` tiene que saltarse la RLS para que el equipo vea quién está ausente y pueda cubrir. Expone solo quién y cuándo, nunca el tipo ni el motivo — un permiso puede ser una licencia médica.
- Las funciones señaladas son las RPC del flujo de materiales y los helpers de autorización (`can_access_sede`, `has_role`, `gestiona_bodega`, `gestiona_mantencion`, `comparte_sede_conmigo`). Ser llamables es su propósito, y cada una valida por dentro quién es quien llama. Las funciones internas de trigger sí tienen el `EXECUTE` revocado.

La protección de contraseñas filtradas y MFA se activan en el panel alojado, en
Authentication → Policies. `supabase/config.toml` conserva la configuración no
secreta del entorno local, pero no sustituye esa verificación de producción.
