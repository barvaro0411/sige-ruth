# Pruebas de las reglas de la base

Estas pruebas comprueban lo que el frontend **no puede** garantizar: que la
autorización siga viviendo en la base de datos y siga diciendo lo mismo después
de cada migration.

Las que importan son las que **tienen que fallar**. Un `update` rechazado por un
trigger, un `insert` bloqueado por una política, una sede ajena que no aparece:
esas son las que demuestran que esconder un botón no es lo que protege el dato.

## Por qué existen

Toda la seguridad del proyecto está en RLS, triggers y RPC, que es donde debe
estar. Pero eso solo vale mientras alguien lo verifique. El modo de fallo de una
política mal escrita es silencioso: no revienta nada, simplemente deja pasar a
quien no correspondía, o esconde datos a quien sí.

Ya pasó una vez. `perfiles_select_colegas` quedó comprobando el rol de la fila
mirada en vez del de quien mira, y el director terminó viendo un solo perfil: el
suyo. El módulo de Usuarios se veía vacío y los préstamos no aparecían. Nada
falló; solo dejó de funcionar. La comprobación 1 de `03_perfiles_y_aislamiento`
existe para que eso no vuelva a pasar sin que nadie se entere.

## Cómo se ejecutan

Cada archivo abre una transacción y la **revierte al final**. No dejan ni una
fila. Se pueden correr contra producción sin riesgo.

```bash
export DATABASE_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres'
npm run test:rls
```

La cadena de conexión está en Supabase → Project Settings → Database → Connection
string (modo *session*). Es una credencial de administrador: no se guarda en el
repositorio ni se pega en un chat.

Para correr un archivo suelto:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/01_mantenciones.sql
```

Si una comprobación falla, el archivo termina con `raise exception` y `psql`
sale con código distinto de cero. Eso es lo que hace que sirva en CI.

## Qué cubre cada archivo

| Archivo | Comprobaciones | Qué protege |
|---|---|---|
| `01_mantenciones.sql` | 14 | El cliente no elige estado ni reportante; el reporte original no se reescribe; no se resuelve sin describir el trabajo; no se cierra sin resolver; una cerrada no admite cambios. |
| `02_preventivas_y_prestamos.sql` | 20 | `proxima_fecha` es columna generada y no se escribe a mano; una ejecución vieja no adelanta el vencimiento; un recurso no se presta dos veces; la sede se hereda del recurso; un préstamo devuelto no se reabre. |
| `03_perfiles_y_aislamiento.sql` | 7 | La dirección ve a todo el personal (regresión); nadie ve colegas ni datos de sedes que no comparte; `anon` no lee nada. |
| `04_alta_de_usuario.sql` | 7 | El rol y la sede que manda el cliente al registrarse se ignoran; toda cuenta nueva nace inactiva y no lee nada. |

**48 comprobaciones en total.**

Además hay 62 pruebas unitarias del código (`npm test`), sobre el mapa de
permisos, el validador de RUT, el formateo de fechas y los mappers.

## Los actores se eligen solos

Ninguna prueba trae UUID escritos a mano. Cada archivo busca en la base a quien
necesita —alguien de dirección, alguien del personal operativo, una sede— para
que funcionen igual en producción, en una rama de Supabase o en un entorno
local.

Para el aislamiento entre sedes se elige a propósito a la persona con **menos**
sedes asignadas: es la única con la que el escenario tiene sentido. Con alguien
que trabaja en las dos sedes, «ver la otra sede» es el comportamiento correcto y
la prueba no probaría nada.

Si la base no tiene los actores mínimos, las pruebas fallan con un mensaje
explícito en vez de pasar en falso.

## Al agregar una migration

Si toca una política, un trigger o una RPC, agrega acá la comprobación
correspondiente. Una regla de autorización sin prueba es una regla que alguien
va a romper sin enterarse.
