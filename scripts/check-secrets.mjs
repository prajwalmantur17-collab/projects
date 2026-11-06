import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()

function fail(message) {
  console.error(`\x1b[31m[SECURITY AUDIT FAILED]\x1b[0m ${message}`)
  process.exit(1)
}

function info(message) {
  console.log(`\x1b[32m[SECURITY CHECK]\x1b[0m ${message}`)
}

// 1. Check Git tracked files for unexpected .env files
try {
  const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter(Boolean)

  for (const file of trackedFiles) {
    const base = path.basename(file)
    if (base.startsWith('.env') && base !== '.env.example') {
      fail(`Found real environment file tracked by Git: ${file}. Untrack it immediately with git rm --cached.`)
    }
  }
} catch {
  // Not a git repo or git not available, continue to file checks
}

// 2. Validate .env.example contains only placeholders
const envExamplePath = path.join(ROOT, '.env.example')
if (fs.existsSync(envExamplePath)) {
  const content = fs.readFileSync(envExamplePath, 'utf8')
  if (/sk_[a-zA-Z0-9]{20,}/.test(content)) {
    fail(`.env.example contains a secret key signature (sk_...). Replace it with an empty placeholder.`)
  }
  if (/sb_publishable_[a-zA-Z0-9_]{20,}/.test(content) || /eyJ[a-zA-Z0-9_-]{30,}/.test(content)) {
    fail(`.env.example contains a real token or populated publishable key. Replace with placeholders.`)
  }
}

// 3. Scan src/ for accidental client exposure of server-only secrets
function scanDir(dir) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        scanDir(fullPath)
      }
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      const code = fs.readFileSync(fullPath, 'utf8')
      if (code.includes('VITE_ELEVENLABS_API_KEY')) {
        fail(`Found VITE_ELEVENLABS_API_KEY in ${fullPath}. ElevenLabs keys must never have a VITE_ prefix.`)
      }
      if (code.includes('process.env.ELEVENLABS_API_KEY') && !fullPath.includes('api') && !fullPath.includes('.test.')) {
        fail(`Direct access to ELEVENLABS_API_KEY found outside api/ or tests: ${fullPath}`)
      }
      if (/sk_[a-zA-Z0-9]{24,}/.test(code)) {
        fail(`Hardcoded secret key pattern found in ${fullPath}`)
      }
    }
  }
}

scanDir(path.join(ROOT, 'src'))

info('Pre-build secret hygiene checks passed.')
