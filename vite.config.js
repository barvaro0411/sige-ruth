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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // Aumentar límite a 5MB
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // El generador de PDF sale del precarga: son ~1,5 MB que se descargaban
        // en el celular de cada persona aunque nunca abriera una matrícula.
        // Se guarda en caché la primera vez que alguien la usa.
        globIgnores: ['**/vendor-pdf-*.js', '**/vendor-charts-*.js', '**/vendor-excel-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/vendor-excel-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vendor-excel',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /\/assets\/vendor-charts-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vendor-charts',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /\/assets\/vendor-pdf-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vendor-pdf',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 90 },
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
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-pdf': ['@react-pdf/renderer'],
          'vendor-excel': ['xlsx'],
          'vendor-ui': ['lucide-react'],
          'vendor-charts': ['recharts'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  }
})
