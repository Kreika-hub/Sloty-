import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/pwa-sloty.png', 'sloty-logo-v2.png.png'],
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
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
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
      },
      devOptions: {
        enabled: true,
        type: 'module',
      }
    }),
  ],
});
