import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Personal Intelligence Studio',
        short_name: 'PI Studio',
        description: '個人智慧工作台 — 生活、健康、財務、AI 實驗室',
        lang: 'zh-TW',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell only; API calls (backend, GitHub raw)
        // always hit the network so data stays fresh.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 菜菜勇者團 — 與 game/server 共用的內容表/型別（單一事實來源）
      '@game': fileURLToPath(new URL('../game/shared', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split big, rarely-changing vendors into their own chunks so the entry
        // stays small, downloads happen in parallel, and they cache long-term.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Keep messaging out of the eager firebase chunk so its dynamic import
          // (only when the user enables push) stays a separate, lazy chunk.
          if (id.includes('firebase/messaging') || id.includes('@firebase/messaging')) return
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
          if (id.includes('chart.js') || id.includes('vue-chartjs')) return 'charts'
          if (id.includes('leaflet')) return 'leaflet'
          if (id.includes('socket.io') || id.includes('engine.io')) return 'socketio'
          if (id.includes('qrcode')) return 'qrcode'
          if (
            id.includes('/vue/') || id.includes('/@vue/') ||
            id.includes('vue-router') || id.includes('pinia') || id.includes('vue-i18n')
          ) return 'vue-vendor'
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
