import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.jpg'],
      manifest: {
        name: 'Ventura Luz e Efeitos',
        short_name: 'Ventura',
        description: 'Sistema de gestão para eventos e iluminação',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        id: '/ventura-luz-efeitos',
        categories: ['business', 'productivity'],
        shortcuts: [
          {
            name: 'Painel',
            short_name: 'Painel',
            url: '/home',
            description: 'Visão geral das oportunidades',
          },
          {
            name: 'Contatos',
            short_name: 'Contatos',
            url: '/contatos',
            description: 'Gestão de contatos e funil',
          },
          {
            name: 'Financeiro',
            short_name: 'Financeiro',
            url: '/financeiro',
            description: 'Receitas, despesas e fluxo de caixa',
          },
        ],
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        // The page itself is never force-reloaded: PWAUpdateNotification asks
        // the user first, so an in-progress form is not discarded mid-edit.
        // Safe because the app ships a single bundle (no lazy chunks that a
        // mid-session SW swap could 404).
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,json,woff2}'],
        runtimeCaching: [
          {
            // Webfonts live on a third-party origin and are not in the precache,
            // so without this the installed PWA falls back to the system font
            // on the first offline load.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // NOTE: api.asaas.com is deliberately NOT runtime-cached. A
        // NetworkFirst entry with a long TTL falls back to cache whenever the
        // network fails, which let the Financeiro screen display up to 24h-old
        // balances and charges with no staleness hint. Financial data stays
        // network-only.
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
