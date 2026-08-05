import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

// Serves static /guides/* and /compare/* index.html pages before Vite's
// SPA fallback intercepts them (Vite dev only matches exact file paths,
// so clean directory URLs like /guides/api-testing/ otherwise fall
// through to the React app and get bounced by the router's catch-all).
function staticPagesMiddleware() {
  return {
    name: 'static-pages-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (!url.startsWith('/guides/') && !url.startsWith('/compare/')) return next()

        const relPath = url.endsWith('/') ? `${url}index.html` : url
        const filePath = path.join(server.config.publicDir, relPath)

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'text/html')
          fs.createReadStream(filePath).pipe(res)
          return
        }
        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), staticPagesMiddleware()],
  server: {
    port: 5174,
    strictPort: true
  }
})
