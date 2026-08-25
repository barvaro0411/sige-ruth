# Configuración de Supabase para SIGE Ruth

## 1. Crear el esquema

1. Abre el proyecto nuevo en Supabase.
2. Entra a **SQL Editor** y crea una consulta nueva.
3. Copia todo el contenido de `supabase_schema.sql` y ejecútalo una sola vez.
4. La ejecución debe terminar sin errores. El script crea:
   - sedes y cursos base;
   - perfiles vinculados a Supabase Auth;
   - estudiantes, asistencia, sesiones fonoaudiológicas y documentos;
   - auditoría automática;
   - políticas RLS por rol y sede;
   - el bucket privado `documentos_estudiantes`.

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
3. El trigger del esquema creará automáticamente su fila en `public.perfiles`.
4. En SQL Editor ejecuta, reemplazando el correo y nombre:

```sql
update public.perfiles
set nombre = 'Nombre Directora', rol = 'director', sede_id = null
where email = 'directora@escuelaruth.cl';
```

Un director con `sede_id = null` puede trabajar con ambas sedes. Para el resto
del personal usa `gambino` o `vascongados` y uno de estos roles:
`secretaria`, `docente`, `fonoaudiologo` o `jefe_utp`.

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

Inicia sesión con el usuario director y comprueba matrícula, asistencia,
fonoaudiología, documentos y auditoría.

## 6. Habilitar administración de usuarios

1. Ejecuta `supabase_user_admin_patch.sql` en **SQL Editor**. Esto protege al
   último director activo y registra los cambios de usuarios en auditoría.
2. Instala/inicia sesión en la CLI y vincula este directorio al proyecto:

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
```

3. Despliega la función segura que crea cuentas en Supabase Auth:

```bash
npm run deploy:admin-users
```

La función se encuentra en `supabase/functions/admin-users/index.ts`. Supabase
inyecta sus secretos del servidor durante la ejecución; ninguna clave secreta
se incluye en el frontend.

## 7. Usuarios que trabajan en varias sedes

Ejecuta `supabase_multi_sede_patch.sql` si la base fue creada antes de incorporar
el acceso multi-sede. La administración de usuarios permite marcar una o ambas
sedes para coordinadoras, fonoaudiólogas u otros trabajadores compartidos.

Los directores tienen acceso global automáticamente. Los demás roles solo pueden
consultar las sedes marcadas en su perfil y verán un selector cuando tengan más
de una asignada.
