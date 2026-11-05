import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'logo-icon.png',
        'offline.html',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png'
      ],
      manifest: {
        id: '/',
        name: 'AlgoArena — Competitive Brain & Algorithm Training',
        short_name: 'AlgoArena',
        description: 'Competitive coding, puzzle-solving, and algorithmic arena platform for software engineers.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0B0B0B',
        theme_color: '#0B0B0B',
        categories: ['education', 'games', 'developer tools'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Daily Challenge',
            short_name: 'Daily',
            description: 'Solve today’s algorithmic assessment',
            url: '/daily-challenge',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Cognitive Arenas',
            short_name: 'Arenas',
            description: 'Browse problem sets and training tracks',
            url: '/games',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Leaderboard',
            short_name: 'Ranks',
            description: 'Check global competitive ratings',
            url: '/leaderboard',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        // Exclude live WebSocket endpoints and all API requests from being cached as precache files
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
        runtimeCaching: [
          // 1. Google Fonts stylesheets (Stale While Revalidate)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 2. Google Fonts webfont files (Cache First, 1 year expiry)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 3. Static static images and assets
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'algoarena-images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          // 4. IMPORTANT SECURITY RULE: NEVER CACHE SENSITIVE API OR WEBSOCKET ENDPOINTS
          // Auth, Attempts, Submissions, Matchmaking, Competitions, WebSockets are strictly NetworkOnly
          {
            urlPattern: /^\/api\/(auth|matches|competitions|games\/.*\/attempts|games\/daily\/attempts).*/,
            handler: 'NetworkOnly'
          },
          // 5. Read-only catalog endpoints like /api/games (StaleWhileRevalidate with short TTL for offline preview)
          {
            urlPattern: /^\/api\/games$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'algoarena-catalog-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 12
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
