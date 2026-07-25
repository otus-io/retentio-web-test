import fs from 'node:fs'
import path from 'node:path'

/**
 * Load E2E credentials from local env files (gitignored).
 * Does not override variables already set in the shell / CI.
 * Files (later overrides earlier for unset keys): `.env.e2e`, then `.env.local`.
 */
export function loadE2EEnv() {
  const preexisting = new Set(Object.keys(process.env))
  for (const name of ['.env.e2e', '.env.local']) {
    const file = path.resolve(process.cwd(), name)
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!preexisting.has(key)) {
        process.env[key] = value
      }
    }
  }
}
