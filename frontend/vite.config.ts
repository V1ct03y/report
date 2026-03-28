import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 4173,
    allowedHosts: ['report.v1ctory.asia'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4300',
        changeOrigin: true
      }
    }
  }
})
