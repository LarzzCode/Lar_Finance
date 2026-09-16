import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Lar Finance',
        short_name: 'Lar Finance',
        description: 'Aplikasi personal finance untuk transaksi, budget, dompet, tagihan, dan tujuan keuangan.',
        lang: 'id-ID',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#0B1220',
        background_color: '#F7F8FA',
        categories: ['finance', 'productivity'],
        shortcuts: [
          {
            name: 'Catat transaksi',
            short_name: 'Catat',
            description: 'Catat pemasukan atau pengeluaran baru',
            url: '/input',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Laporan keuangan',
            short_name: 'Laporan',
            description: 'Buka laporan dan histori transaksi',
            url: '/rekap',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Dompet',
            short_name: 'Dompet',
            description: 'Lihat saldo seluruh dompet',
            url: '/wallet',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          }
        ],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
