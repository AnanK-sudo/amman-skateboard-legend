import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/amman-skateboard-legend/' : '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
})
