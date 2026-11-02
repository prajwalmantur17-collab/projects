import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import speechHandler from './api/speech.ts'

function devApiSpeechPlugin(): Plugin {
  return {
    name: 'dev-api-speech',
    config(_config, { mode }) {
      const env = loadEnv(mode, process.cwd(), '')
      Object.assign(process.env, env)
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url === '/api/speech' || req.url.startsWith('/api/speech?'))) {
          try {
            await speechHandler(req, res)
          } catch (err) {
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'internal_dev_error', message: String(err) }))
            }
          }
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApiSpeechPlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
