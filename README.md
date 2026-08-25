# SIGE Ruth

Sistema interno de gestión escolar de la Escuela de Lenguaje Ruth. La aplicación está construida con React, Vite y Supabase, y puede instalarse como PWA desde un navegador compatible.

## Desarrollo local

Requisitos: Node.js 20 o superior y un proyecto de Supabase configurado.

```bash
npm install
cp .env.example .env
npm run dev
```

Variables públicas necesarias para la aplicación:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

La variable `SUPABASE_SECRET_KEY` se utiliza solamente para tareas administrativas locales. Nunca debe publicarse en Vercel ni incluirse en el repositorio.

## Verificación

```bash
npm run type-check
npm run build
```

La compilación genera en `dist/` el manifiesto, el service worker y los recursos necesarios para instalar la aplicación.

## Despliegue

El proyecto incluye `vercel.json` con el enrutamiento de SPA y cabeceras de seguridad. En Vercel se deben configurar únicamente las dos variables públicas indicadas arriba.
