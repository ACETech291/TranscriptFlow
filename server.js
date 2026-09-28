import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import transcriptHandler from './api/transcript.js'
import formatsHandler from './api/formats.js'
import downloadHandler from './api/download.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080

// Middleware
app.use(cors())
app.use(express.json())

// Health check endpoint cho Fly.io
app.get('/healthz', (req, res) => res.status(200).send('OK'))
app.get('/health', (req, res) => res.status(200).send('OK'))


// API routes
app.get('/api/transcript', transcriptHandler)
app.get('/api/formats', formatsHandler)

// Route GET /api/download: Stream video/audio từ YouTube trực tiếp về máy người dùng
app.get('/api/download', downloadHandler)

// Phục vụ toàn bộ static files từ thư mục dist
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback cho tất cả các route còn lại (hỗ trợ cả Express 4 và Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TranscriptFlow Express server running on http://0.0.0.0:${PORT}`)
})
