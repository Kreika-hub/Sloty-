import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.jpg', 'icons/icon-512.jpg'],
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
            src: '/icons/icon-192.jpg',
            sizes: '192x192',
            type: 'image/jpeg',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable'
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5
            }
          }
        ]
      }
    }),
  ],
});
