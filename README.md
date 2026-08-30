# Gestión Ruth

Plataforma interna de la Escuela de Lenguaje Ruth. Está construida con React, Vite y Supabase, y puede instalarse como PWA desde un navegador compatible.

Cubre la gestión administrativa del establecimiento:

- **Permisos y días administrativos** del personal, con aprobación y saldo anual.
- **Solicitudes de materiales**, desde el pedido hasta la entrega.
- **Notificaciones internas** del estado de cada solicitud.
- **Inventario de bodega**, con stock derivado de movimientos y alertas de mínimo.
- **Mantenciones** correctivas y preventivas, reportables desde el celular con foto.
- **Préstamos** de equipos, con atrasos visibles.
- **Panel de operaciones**: qué necesita atención hoy, gasto mensual y lista de compra sugerida.
- **Matrícula** y **seguimiento fonoaudiológico**.

## Qué NO es esta plataforma

**No reemplaza al SIGE del MINEDUC.** La asistencia de estudiantes se sigue declarando en el SIGE, y el registro oficial sigue siendo el libro de clases. Por eso acá no hay módulo de asistencia: duplicarla era doble trabajo, riesgo de inconsistencia y ningún valor. La tabla se eliminó y el código se retiró.

**No es un sistema de control de asistencia laboral.** Ver "Integración futura de marcaje".

## Desarrollo local

Requisitos: Node.js 20 o superior y un proyecto de Supabase configurado.

```bash
npm install
cp .env.example .env
npm run dev
```

Variables públicas necesarias para la aplicación:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (se acepta `VITE_SUPABASE_ANON_KEY` como alternativa)

La variable `SUPABASE_SECRET_KEY` se utiliza solamente para tareas administrativas locales. Nunca debe publicarse en Vercel ni incluirse en el repositorio.

## Verificación

```bash
npm run type-check
npm run build
```

La compilación genera en `dist/` el manifiesto, el service worker y los recursos necesarios para instalar la aplicación.

## Despliegue

El proyecto incluye `vercel.json` con el enrutamiento de SPA y cabeceras de seguridad. En Vercel se deben configurar únicamente las dos variables públicas indicadas arriba.

## Roles

| Rol | Qué hace |
|---|---|
| `director` | Todo: usuarios, permisos, materiales, informes, auditoría. |
| `sostenedor` | Revisa y autoriza gasto, resuelve permisos, ve informes. No administra datos académicos. |
| `secretaria` | Matrícula, ejecuta compras. **No** autoriza gasto ni resuelve permisos. |
| `jefe_utp` | Gestión académica, solicita permisos y materiales. |
| `docente` | Solicita permisos y materiales, confirma entregas. |
| `fonoaudiologo` | Coordinación técnica, sesiones fonoaudiológicas. |
| `aseo` | Pide insumos y reporta lo que se rompe. Nada más, a propósito. |
| `bodega` | Administra el stock, prepara entregas y presta equipos. |
| `mantencion` | Recibe las incidencias, las trabaja y las cierra con su costo. |

Nadie resuelve su propia solicitud, ni siquiera el director: por eso existe el rol `sostenedor`. La regla se aplica en la base de datos, no solo en la interfaz.

## Integración futura de marcaje

La plataforma **no** incluye marcaje de entrada y salida de trabajadores, y no debe presentarse como registro oficial de asistencia laboral.

En Chile el registro de asistencia de los trabajadores está regulado por la Dirección del Trabajo, que fija las condiciones que debe cumplir un sistema electrónico —incluida la autorización previa cuando corresponde—. Un desarrollo propio no cumple esas condiciones por el solo hecho de existir, y afirmar lo contrario expone al empleador.

Si más adelante se necesita marcaje:

1. Verificar con la Dirección del Trabajo qué exige la normativa vigente para el sistema que se quiera usar. **No dar por buena esta sección sin confirmarla**: la normativa cambia y aquí no se certifica nada.
2. Integrarse con un proveedor autorizado, en vez de construir un marcador propio.
3. Usar la plataforma solo como consulta de lo que registre ese proveedor.

Mientras tanto, el módulo de permisos cubre la parte que no tiene esa restricción: quién pidió qué día, quién lo autorizó y cuándo.
