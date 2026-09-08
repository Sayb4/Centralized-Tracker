const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_WINDOW_MS = 15 * 60 * 1000

interface AttemptRecord {
  count: number
  windowStart: number
}

const attempts = new Map<string, AttemptRecord>()

function getMaxAttempts(): number {
  const raw = process.env.LOGIN_RATE_LIMIT_MAX
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_MAX_ATTEMPTS
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ATTEMPTS
}

function getWindowMs(): number {
  const raw = process.env.LOGIN_RATE_LIMIT_WINDOW_MS
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_WINDOW_MS
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WINDOW_MS
}

function getRecord(key: string, now: number): AttemptRecord {
  const existing = attempts.get(key)
  const windowMs = getWindowMs()

  if (!existing || now - existing.windowStart >= windowMs) {
    const fresh = { count: 0, windowStart: now }
    attempts.set(key, fresh)
    return fresh
  }

  return existing
}

export function getClientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  return request.headers.get('x-real-ip') ?? 'unknown'
}

export function buildLoginRateLimitKey(ip: string, identifier: string): string {
  return `${ip}:${identifier.toLowerCase()}`
}

export function checkLoginRateLimit(key: string): {
  allowed: boolean
  retryAfterSeconds?: number
} {
  const now = Date.now()
  const record = getRecord(key, now)
  const maxAttempts = getMaxAttempts()
  const windowMs = getWindowMs()

  if (record.count >= maxAttempts) {
    const retryAfterMs = record.windowStart + windowMs - now
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    }
  }

  return { allowed: true }
}

export function recordLoginFailure(key: string): void {
  const now = Date.now()
  const record = getRecord(key, now)
  record.count += 1
  attempts.set(key, record)
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key)
}
