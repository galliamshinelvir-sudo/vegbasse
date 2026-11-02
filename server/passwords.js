import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 32).toString("hex")
  return `${salt}:${hash}`
}

export function checkPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":")
  if (!salt || !hash) return false
  const next = scryptSync(password, salt, 32)
  const prev = Buffer.from(hash, "hex")
  return next.length === prev.length && timingSafeEqual(next, prev)
}

export function randomPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const bytes = randomBytes(10)
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("")
}
