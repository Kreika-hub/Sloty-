import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt', // ← cambiado: permite mostrar "hay nueva versión"
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'sloty-logo-v2.png.png'],
      manifest: {
        name: 'Sloty - Estacionamientos',
        short_name: 'Sloty',
        description: 'Gestión inteligente de estacionamientos',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1a1a2e',
        theme_color: '#1a1a2e',
        icons: [
          {
            src: '/icons/pwa-sloty.png',  // ← sin espacio
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'               // ← separado
          },
          {
            src: '/icons/pwa-sloty.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/pwa-sloty.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'          // ← separado
          }
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,webp}'],
        runtimeCaching: [
          {
            // Supabase API — NetworkFirst con fallback a caché
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Google Fonts — CacheFirst (raramente cambian)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            // QR libs (cdnjs/unpkg) — StaleWhileRevalidate
            urlPattern: /^https:\/\/(cdnjs\.cloudflare\.com|unpkg\.com)\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-libs',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    }),
  ],
});
