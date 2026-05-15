import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(async ({ mode }) => {
  const pwaPlugin = mode === 'test'
    ? null
    : (await import('vite-plugin-pwa')).VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'robots.txt'],
      manifest: {
        name: 'SIGE Ruth — Gestión Escolar',
        short_name: 'SIGE Ruth',
        description: 'Sistema de Gestión Escolar para la Escuela de Lenguaje Ruth',
        theme_color: '#1B2A4A',
        background_color: '#1B2A4A',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/vendor-pdf-*.js', '**/vendor-charts-*.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
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
    });

  return {
    plugins: [
      react(),
      pwaPlugin
    ].filter(Boolean),
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      open: false,
      allowedHosts: 'all',
      hmr: {
        host: '127.0.0.1',
        protocol: 'ws',
        clientPort: 5173,
      },
    },
    build: {
      modulePreload: {
        resolveDependencies: (_url, deps) => deps.filter(dep => !dep.includes('vendor-pdf')),
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-pdf': ['@react-pdf/renderer'],
            'vendor-icons': ['lucide-react'],
            'vendor-charts': ['recharts'],
          }
        }
      },
      chunkSizeWarningLimit: 1000,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
    }
  };
})
