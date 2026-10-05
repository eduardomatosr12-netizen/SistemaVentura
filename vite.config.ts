import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Lightning CSS (Vite's default cssMinify) rewrites `max-width`/`min-width`
    // into Media Queries Level 4 range syntax (`(width<=767px)`). Browsers that
    // don't parse range syntax discard the whole block, which silently kills every
    // Tailwind breakpoint plus the `.pb-bottom-nav` mobile rules. Pinning targets
    // below Safari 16.4 / Chrome 104 keeps the legacy `min-width`/`max-width` form.
    cssTarget: ['chrome108', 'safari15.4', 'firefox101'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
