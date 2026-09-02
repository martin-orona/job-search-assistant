import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// https://vite.dev/config/
function jobPostingProxyPlugin(): Plugin {
  return {
    name: 'job-posting-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/job-postings/proxy') !== true) {
          next()
          return
        }

        const requestUrl = new URL(req.url, 'http://localhost')
        const targetUrl = requestUrl.searchParams.get('url')

        if (!targetUrl) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('A valid http or https URL is required.')
          return
        }

        let parsedUrl: URL
        try {
          parsedUrl = new URL(targetUrl)
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('A valid http or https URL is required.')
          return
        }

        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          res.statusCode = 400
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('A valid http or https URL is required.')
          return
        }

        const upstreamResponse = await fetch(parsedUrl)
        const html = await upstreamResponse.text()

        if (!upstreamResponse.ok) {
          res.statusCode = upstreamResponse.status
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(
            `<html><body><h1>Unable to load page</h1><p>The remote server returned ${upstreamResponse.status} (${upstreamResponse.statusText}).</p></body></html>`,
          )
          return
        }

        const baseHref = parsedUrl.origin + parsedUrl.pathname
        const baseTag = `<base href="${baseHref}" />`
        const nextHtml = html.includes('<head')
          ? html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`)
          : `<html><head>${baseTag}</head><body>${html}</body></html>`

        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(nextHtml)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), jobPostingProxyPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})