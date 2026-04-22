import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/features'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@app-types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@app': path.resolve(__dirname, './src/app'),
    },
  },
  test: {
    globals:     true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include:  ['src/utils/**'],
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@stripe'))           return 'payment'
            if (id.includes('@tanstack'))          return 'query'
            if (id.includes('@radix-ui'))          return 'ui'
            if (id.includes('xlsx') || id.includes('jspdf')) return 'export'
            if (id.includes('react-router'))       return 'router'
            if (id.includes('react'))              return 'vendor'
          }
          return undefined
        },
      },
    },
  },
})
