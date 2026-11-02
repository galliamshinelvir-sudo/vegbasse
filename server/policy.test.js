import assert from "node:assert/strict"
import test from "node:test"
import { assessLogin, recordFailure, recordSuccess, LOCK_MS } from "./policy.js"

test("captcha starts on the third failure", () => {
  assert.equal(assessLogin({ failures: 2, lockedUntil: 0 }, 1000).captcha, false)
  const after = recordFailure({ failures: 2, lockedUntil: 0 }, 1000)
  assert.equal(assessLogin(after, 1000).captcha, true)
  assert.equal(assessLogin(after, 1000).ok, true)
})

test("eighth failure locks the next quarter hour", () => {
  const locked = recordFailure({ failures: 7, lockedUntil: 0 }, 5000)
  assert.equal(locked.lockedUntil, 5000 + LOCK_MS)
  const gate = assessLogin(locked, 5000 + 10)
  assert.equal(gate.ok, false)
  assert.equal(gate.reason, "locked")
  assert.equal(assessLogin(locked, locked.lockedUntil).ok, true)
})

test("success clears the counter", () => {
  assert.deepEqual(recordSuccess(), { failures: 0, lockedUntil: 0 })
})
