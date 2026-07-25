import fs from 'node:fs'
import path from 'node:path'
import type { FullConfig } from '@playwright/test'
import { loadE2EEnv } from './load-env'

loadE2EEnv()

/** Must match AuthContext TOKEN_KEY in src/contexts/AuthContext.tsx */
const TOKEN_KEY = 'wordupx_token'
const authStatePath = path.join('tests', 'e2e', '.auth-state.json')

const apiBaseUrl = (
  process.env.E2E_API_URL ||
  process.env.VITE_API_URL ||
  'https://api.retentio.app:8443'
).replace(/\/$/, '')

async function fetchAuthToken(username: string, password: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`E2E login failed (${res.status}): ${await res.text()}`)
    }
    const body = (await res.json()) as { data?: { token?: string } }
    const token = body.data?.token
    if (!token) {
      throw new Error('E2E login response missing token')
    }
    return token
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`E2E login timed out after 10s (${apiBaseUrl}/auth/login)`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

async function apiRequest(token: string, apiPath: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(`${apiBaseUrl}${apiPath}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(
        `E2E API ${init.method ?? 'GET'} ${apiPath} failed (${res.status}): ${await res.text()}`,
      )
    }
    return res
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`E2E API ${init.method ?? 'GET'} ${apiPath} timed out after 10s`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

async function deleteAllDecks(token: string) {
  const res = await apiRequest(token, '/api/decks')
  const body = (await res.json()) as { data?: { decks?: { id: string }[] | null } }
  for (const deck of body.data?.decks ?? []) {
    await apiRequest(token, `/api/decks/${deck.id}`, { method: 'DELETE' })
  }
}

async function deleteAllTags(token: string) {
  const res = await apiRequest(token, '/api/tags')
  const body = (await res.json()) as { data?: { tags?: { id: string }[] | null } }
  for (const tag of body.data?.tags ?? []) {
    await apiRequest(token, `/api/tags/${tag.id}`, { method: 'DELETE' })
  }
}

export default async function globalSetup(config: FullConfig) {
  const username = process.env.E2E_USERNAME
  const password = process.env.E2E_PASSWORD
  if (!username || !password) {
    if (process.env.CI) {
      throw new Error('E2E_USERNAME and E2E_PASSWORD must be set for e2e tests in CI')
    }
    console.warn('E2E_USERNAME or E2E_PASSWORD not set, skipping global auth setup')
    return
  }

  const baseURL =
    config.projects[0]?.use?.baseURL ??
    process.env.PLAYWRIGHT_TEST_BASE_URL ??
    'http://localhost:5173'

  const token = await fetchAuthToken(username, password)
  await deleteAllDecks(token)
  await deleteAllTags(token)

  const origin = new URL(baseURL).origin

  fs.mkdirSync(path.dirname(authStatePath), { recursive: true })
  fs.writeFileSync(
    authStatePath,
    JSON.stringify(
      {
        cookies: [],
        origins: [
          {
            origin,
            localStorage: [{ name: TOKEN_KEY, value: token }],
          },
        ],
      },
      null,
      2,
    ),
  )
}
