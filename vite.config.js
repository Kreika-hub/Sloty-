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
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        importScripts: ['/push-sw.js'],
        navigationPreload: false,
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,webp}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.includes('supabase.co'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 31536000 }
            }
          },
          {
            urlPattern: /^https:\/\/(cdnjs\.cloudflare\.com|unpkg\.com)\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-libs',
              expiration: { maxEntries: 10, maxAgeSeconds: 2592000 }
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
