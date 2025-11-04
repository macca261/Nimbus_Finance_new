import fs from 'node:fs'
import path from 'node:path'

const envPath = (process.env.NIMBUS_DB_PATH || '').trim()
const fallback = path.join(__dirname, '..', '..', 'data', 'nimbus.sqlite')
const targets = [envPath ? path.resolve(envPath) : fallback]

// Clean up legacy dev.db if present
const legacy = path.join(__dirname, '..', '..', 'data', 'dev.db')
if (!targets.includes(legacy)) targets.push(legacy)

for (const target of targets) {
  if (!target) continue
  const dir = path.dirname(target)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  try { if (fs.existsSync(target)) fs.unlinkSync(target) } catch {}
}

// Re-require DB to re-create schema on the default path
// eslint-disable-next-line @typescript-eslint/no-var-requires
const loaded = require('../../src/db')
const resolved = envPath ? path.resolve(envPath) : fallback
console.log('DB reset at', resolved)

// keep requirement so TypeScript doesn't remove unused import
void loaded


