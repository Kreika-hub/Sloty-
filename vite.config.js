import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';


export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico', 'favicon.png', 'apple-touch-icon.png',
        'icons/pwa-192x192.png', 'icons/pwa-512x512.png',
        'icons/maskable-icon-512x512.png', 'icons/apple-touch-icon-180x180.png',
        'sloty-logo-v2.png'
      ],
      manifest: {
        id: '/',
        name: 'Sloty',
        short_name: 'Sloty',
        description: 'Gestión inteligente de estacionamientos',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#1a1a2e',
        theme_color: '#1a1a2e',
        categories: ['business', 'productivity', 'utilities'],
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
        navigateFallback: '/index.html',
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
