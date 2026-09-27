import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import transcriptHandler from './api/transcript.js'
import formatsHandler from './api/formats.js'
import downloadHandler from './api/download.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DIST_DIR = path.join(__dirname, 'dist')
const PORT = parseInt(process.env.PORT || '8080', 10)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
}

function decorateReqRes(req, res, url) {
  req.query = Object.fromEntries(url.searchParams.entries())

  res.status = function (code) {
    this.statusCode = code
    return this
  }

  res.json = function (data) {
    if (!this.headersSent) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8')
    }
    this.end(JSON.stringify(data))
    return this
  }
}

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback SPA về index.html cho các route client-side
      const indexFile = path.join(DIST_DIR, 'index.html')
      fs.readFile(indexFile, (readErr, content) => {
        if (readErr) {
          res.statusCode = 404
          res.end('Not Found')
          return
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(content)
      })
      return
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', stats.size)
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    } else {
      res.setHeader('Cache-Control', 'no-cache')
    }
    const stream = fs.createReadStream(filePath)
    stream.pipe(res)
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    decorateReqRes(req, res, url)

    // Health check cho Fly.io
    if (url.pathname === '/healthz' || url.pathname === '/health') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain')
      res.end('OK')
      return
    }

    // Backend API Routes
    if (url.pathname === '/api/transcript') {
      await transcriptHandler(req, res)
      return
    }
    if (url.pathname === '/api/formats') {
      await formatsHandler(req, res)
      return
    }
    if (url.pathname === '/api/download') {
      await downloadHandler(req, res)
      return
    }

    // Static files phục vụ từ thư mục dist/
    let safePath = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '')
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html'
    }
    const targetPath = path.join(DIST_DIR, safePath)

    if (!targetPath.startsWith(DIST_DIR)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }

    serveStaticFile(res, targetPath)
  } catch (error) {
    console.error('Server error:', error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Internal Server Error' }))
    }
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TranscriptFlow server running on http://0.0.0.0:${PORT}`)
})
