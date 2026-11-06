import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const distDir = path.join(ROOT, 'dist')

function fail(message) {
  console.error(`\x1b[31m[DIST SECURITY AUDIT FAILED]\x1b[0m ${message}`)
  process.exit(1)
}

function scanDist(dir) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scanDist(fullPath)
    } else if (/\.(js|html|json|map)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8')
      if (/sk_[a-zA-Z0-9]{20,}/.test(content)) {
        fail(`Found secret API key pattern (sk_...) in built client bundle: ${entry.name}`)
      }
      if (content.includes('ELEVENLABS_API_KEY')) {
        fail(`Found ELEVENLABS_API_KEY identifier in built client bundle: ${entry.name}`)
      }
      if (content.includes('service_role')) {
        fail(`Found service_role reference in built client bundle: ${entry.name}`)
      }
    }
  }
}

scanDist(distDir)
console.log('\x1b[32m[DIST SECURITY AUDIT]\x1b[0m Built client bundle verified: no server-only secrets found in dist.')

