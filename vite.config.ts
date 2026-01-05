// 
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      port: 3000,
      host: '0.0.0.0'
    },

    plugins: [react()],

    define: {
      'process.env': {},
      __GEMINI_API_KEY__: JSON.stringify(env.GEMINI_API_KEY)
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },

    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react')) return 'react-vendor'
              if (id.includes('axios')) return 'axios-vendor'
              return 'vendor'
            }
          }
        }
      }
    }
  }
})
