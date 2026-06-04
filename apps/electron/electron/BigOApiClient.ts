// BigOApiClient.ts
// HTTP client for the BigO backend API.
// Used by AuthHelper and ProcessingHelper to validate licenses,
// track usage, and enforce subscription limits.

import { configHelper } from './ConfigHelper'

// ── API base URL ─────────────────────────────────────────────────────────────
// In production, override with env var BIGO_API_URL.
const API_BASE =
  process.env.BIGO_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://api.getbigo.app'   // TODO: replace with real prod URL
    : 'http://localhost:3000')

// ── Types ────────────────────────────────────────────────────────────────────

export interface LicenseValidateResponse {
  valid: boolean
  licenseKey?: string
  plan: 'free' | 'basic' | 'pro' | 'enterprise'
  solvesUsedToday: number
  solvesLimit: number | null   // null = unlimited
  email?: string
  expiresAt?: string | null
  error?: string
}

export interface SolveTrackResponse {
  ok: boolean
  solvesUsedToday: number
  solvesLimit: number | null
  blocked: boolean   // true if quota exhausted
  error?: string
}

export interface HealthResponse {
  status: 'ok' | 'error'
  latencyMs: number
}

// ── Client ───────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json?.error?.message || `HTTP ${res.status}`)
    }
    return json as T
  } finally {
    clearTimeout(timer)
  }
}

async function get<T>(path: string, headers: Record<string, string> = {}, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: controller.signal,
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json?.error?.message || `HTTP ${res.status}`)
    }
    return json as T
  } finally {
    clearTimeout(timer)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export const bigoApi = {
  /**
   * Validate a license key + optional device fingerprint.
   * Called on app startup and after the user saves a key in Settings.
   */
  async validateLicense(licenseKey: string, deviceId: string): Promise<LicenseValidateResponse> {
    try {
      return await post<LicenseValidateResponse>('/api/licenses/validate', {
        licenseKey,
        deviceId,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      // Offline / server unreachable — use last known state from config
      const cfg = configHelper.loadConfig()
      if (cfg.licenseKey === licenseKey && cfg.licensePlan) {
        return {
          valid: true,
          plan: cfg.licensePlan,
          solvesUsedToday: 0,   // can't know offline
          solvesLimit: cfg.licensePlan === 'free' ? 5 : null,
          error: `Offline — using cached license (${msg})`,
        }
      }
      return { valid: false, plan: 'free', solvesUsedToday: 0, solvesLimit: 5, error: msg }
    }
  },

  /**
   * Record a solve attempt and get back the updated quota.
   * Call this BEFORE running the LLM pipeline.
   * If blocked === true, abort and show the paywall.
   */
  async trackSolve(licenseKey: string | null, deviceId: string): Promise<SolveTrackResponse> {
    try {
      return await post<SolveTrackResponse>('/api/licenses/track-solve', {
        licenseKey: licenseKey || null,
        deviceId,
      })
    } catch (err) {
      // If server is unreachable, allow the solve (fail open).
      // Prevents blocking paying users during a backend outage.
      console.warn('[BigO] trackSolve failed — failing open:', err)
      return { ok: true, solvesUsedToday: 0, solvesLimit: null, blocked: false }
    }
  },

  /**
   * Quick reachability check — used on startup to show offline indicator.
   */
  async ping(): Promise<HealthResponse> {
    const start = Date.now()
    try {
      await get('/health')
      return { status: 'ok', latencyMs: Date.now() - start }
    } catch {
      return { status: 'error', latencyMs: Date.now() - start }
    }
  },
}
