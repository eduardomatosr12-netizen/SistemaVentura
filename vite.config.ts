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
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,json,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.(asaas|whatsapp)\.com\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],
      },
    }),
  ],
})
