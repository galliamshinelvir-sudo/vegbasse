export const CAPTCHA_AFTER = 3
export const LOCK_AFTER = 8
export const LOCK_MS = 15 * 60 * 1000

export function assessLogin(state, now) {
  const lockedUntil = state.lockedUntil || 0
  if (lockedUntil > now) {
    return { ok: false, reason: "locked", captcha: false, lockedUntil }
  }
  return {
    ok: true,
    reason: "open",
    captcha: (state.failures || 0) >= CAPTCHA_AFTER,
    lockedUntil: 0,
  }
}

export function recordFailure(state, now) {
  const failures = (state.failures || 0) + 1
  if (failures >= LOCK_AFTER) {
    return { failures, lockedUntil: now + LOCK_MS }
  }
  return { failures, lockedUntil: 0 }
}

export function recordSuccess() {
  return { failures: 0, lockedUntil: 0 }
}
