// AuthHelper.ts
// Manages license key auth state for BigO.
// Validates the key against the BigO backend, caches the result,
// and exposes helpers the main process uses to enforce the paywall.

import { EventEmitter } from 'events'
import { createHash, randomBytes } from 'crypto'
import { configHelper } from './ConfigHelper'
import { bigoApi, LicenseValidateResponse } from './BigOApiClient'
import { logger } from './logger'

// ── Types ────────────────────────────────────────────────────────────────────

export type AuthStatus =
  | 'checking'         // startup validation in progress
  | 'unauthenticated'  // no license key configured
  | 'invalid_key'      // key is present but rejected by server
  | 'no_subscription'  // free-tier, limit reached
  | 'active'           // valid key, quota available

export interface AuthState {
  status: AuthStatus
  plan: 'free' | 'basic' | 'pro' | 'enterprise'
  solvesUsedToday: number
  solvesLimit: number | null
  email?: string
  expiresAt?: string | null
  lastCheckedAt: number
  offlineMode: boolean
}

// How often to re-validate the license against the server (ms)
const REVALIDATE_INTERVAL_MS = 10 * 60 * 1000   // every 10 minutes
// Free-tier daily solve limit (mirrors the backend default)
export const FREE_DAILY_LIMIT = 5

// ── Helper ───────────────────────────────────────────────────────────────────

export class AuthHelper extends EventEmitter {
  private state: AuthState = {
    status: 'checking',
    plan: 'free',
    solvesUsedToday: 0,
    solvesLimit: FREE_DAILY_LIMIT,
    lastCheckedAt: 0,
    offlineMode: false,
  }

  private revalidateTimer: ReturnType<typeof setInterval> | null = null

  // ── Device fingerprint ──────────────────────────────────────────────────────
  // Stable per-machine ID derived from random bytes stored in config.
  // Used to track free-tier usage per device without requiring an account.

  public getDeviceId(): string {
    const cfg = configHelper.loadConfig()
    if (cfg.deviceId) return cfg.deviceId
    const id = createHash('sha256').update(randomBytes(32)).digest('hex').slice(0, 32)
    configHelper.saveConfig({ ...cfg, deviceId: id })
    return id
  }

  // ── Startup validation ──────────────────────────────────────────────────────

  public async initialize(): Promise<AuthState> {
    this.setState({ status: 'checking' })
    const cfg = configHelper.loadConfig()

    if (!cfg.licenseKey) {
      // No key → free tier
      this.setState({
        status: 'unauthenticated',
        plan: 'free',
        solvesUsedToday: 0,
        solvesLimit: FREE_DAILY_LIMIT,
        lastCheckedAt: Date.now(),
      })
      return this.state
    }

    return this.validateAndApply(cfg.licenseKey)
  }

  // ── License key management ──────────────────────────────────────────────────

  public async setLicenseKey(key: string): Promise<AuthState> {
    const trimmed = key.trim()
    if (!trimmed) {
      // Clear the key → revert to free tier
      const cfg = configHelper.loadConfig()
      configHelper.saveConfig({ ...cfg, licenseKey: '', licensePlan: undefined, licenseEmail: undefined })
      this.setState({ status: 'unauthenticated', plan: 'free', solvesUsedToday: 0, solvesLimit: FREE_DAILY_LIMIT })
      return this.state
    }
    return this.validateAndApply(trimmed)
  }

  public async removeLicenseKey(): Promise<void> {
    const cfg = configHelper.loadConfig()
    configHelper.saveConfig({ ...cfg, licenseKey: '', licensePlan: undefined, licenseEmail: undefined })
    this.setState({ status: 'unauthenticated', plan: 'free', solvesUsedToday: 0, solvesLimit: FREE_DAILY_LIMIT })
  }

  // ── Solve quota check ───────────────────────────────────────────────────────

  /**
   * Call this BEFORE running the LLM pipeline.
   * Returns true if the solve should proceed, false if blocked (quota hit).
   */
  public async canSolve(): Promise<{ allowed: boolean; reason?: string }> {
    const cfg = configHelper.loadConfig()
    const result = await bigoApi.trackSolve(cfg.licenseKey || null, this.getDeviceId())

    // Update local state
    this.setState({
      solvesUsedToday: result.solvesUsedToday,
      solvesLimit: result.solvesLimit,
    })

    if (result.blocked) {
      this.setState({ status: 'no_subscription' })
      return {
        allowed: false,
        reason: result.solvesLimit !== null
          ? `Daily limit of ${result.solvesLimit} solves reached. Upgrade to Pro for unlimited.`
          : 'Subscription quota exhausted.',
      }
    }

    return { allowed: true }
  }

  // ── State accessors ─────────────────────────────────────────────────────────

  public getState(): AuthState {
    return { ...this.state }
  }

  public isActive(): boolean {
    return this.state.status === 'active' || this.state.status === 'unauthenticated'
  }

  // ── Periodic re-validation ──────────────────────────────────────────────────

  public startPeriodicRevalidation(): void {
    if (this.revalidateTimer) return
    this.revalidateTimer = setInterval(async () => {
      const cfg = configHelper.loadConfig()
      if (cfg.licenseKey) {
        await this.validateAndApply(cfg.licenseKey)
      }
    }, REVALIDATE_INTERVAL_MS)
  }

  public stopPeriodicRevalidation(): void {
    if (this.revalidateTimer) {
      clearInterval(this.revalidateTimer)
      this.revalidateTimer = null
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async validateAndApply(key: string): Promise<AuthState> {
    let result: LicenseValidateResponse
    try {
      result = await bigoApi.validateLicense(key, this.getDeviceId())
    } catch (err) {
      logger.warn('[Auth] validateLicense threw — treating as offline', err)
      result = {
        valid: false,
        plan: 'free',
        solvesUsedToday: 0,
        solvesLimit: FREE_DAILY_LIMIT,
        error: 'Network error',
      }
    }

    if (!result.valid) {
      this.setState({
        status: 'invalid_key',
        plan: 'free',
        solvesUsedToday: 0,
        solvesLimit: FREE_DAILY_LIMIT,
        offlineMode: !!result.error?.startsWith('Offline'),
        lastCheckedAt: Date.now(),
      })
      return this.state
    }

    // Cache plan in config for offline fallback
    const cfg = configHelper.loadConfig()
    configHelper.saveConfig({
      ...cfg,
      licenseKey: key,
      licensePlan: result.plan,
      licenseEmail: result.email,
    })

    const isOverLimit =
      result.solvesLimit !== null && result.solvesUsedToday >= result.solvesLimit

    this.setState({
      status: isOverLimit ? 'no_subscription' : 'active',
      plan: result.plan,
      solvesUsedToday: result.solvesUsedToday,
      solvesLimit: result.solvesLimit,
      email: result.email,
      expiresAt: result.expiresAt,
      lastCheckedAt: Date.now(),
      offlineMode: !!result.error?.startsWith('Offline'),
    })

    return this.state
  }

  private setState(partial: Partial<AuthState>): void {
    this.state = { ...this.state, ...partial }
    this.emit('state-changed', this.state)
  }
}

export const authHelper = new AuthHelper()
