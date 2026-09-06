import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'robots.txt', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gestión Ruth — Plataforma Interna',
        short_name: 'Gestión Ruth',
        description: 'Plataforma interna de gestión para la Escuela de Lenguaje Ruth',
        theme_color: '#1B2A4A',
        background_color: '#1B2A4A',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'es-CL',
        scope: '/',
        start_url: '/',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Al precaché entra el armazón de la app —lo que hace falta para que
        // abra sin red— y nada más.
        //
        // Fuera quedan los dos chunks pesados, que ahora llevan el nombre del
        // módulo que los generó porque `lazy()` los produce: el visor de
        // matrícula (~1,5 MB de @react-pdf) y el motor de gráficas de recharts.
        // Se guardan en caché la primera vez que alguien los usa, con la regla
        // de más abajo.
        globIgnores: [
          '**/MatriculaPreviewModal-*.js',
          '**/CartesianChart-*.js',
        ],
        maximumFileSizeToCacheInBytes: 600 * 1024,
        runtimeCaching: [
          {
            // Los chunks que quedaron fuera del precaché por tamaño. Llevan
            // hash en el nombre, así que `CacheFirst` es seguro: un cambio
            // produce otra URL.
            urlPattern: /\/assets\/.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'chunks-pesados',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  server: {
    port: 5173,
    open: false,
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  build: {
    rollupOptions: {
      output: {
        // Solo se agrupa a mano lo que todo el mundo necesita desde el primer
        // segundo: React y los iconos.
        //
        // El generador de PDF y las gráficas NO van acá, aunque parezca que
        // corresponde. Declararlos como chunk propio los convierte en chunks de
        // nivel superior, y Vite los lista en el `modulepreload` del HTML de
        // entrada — con lo que el navegador se los descargaba en la primera
        // visita aunque los componentes que los usan sean `lazy()`. Eran 1,5 MB
        // de PDF que la mayoría del personal nunca abre, precargados en el
        // celular de quien solo entra a pedir insumos.
        //
        // Sin la declaración, Rollup los deja dentro de los chunks asíncronos
        // que `lazy()` ya genera, que es lo que decía la documentación que
        // pasaba y no pasaba.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  }
})
