import assert from "node:assert/strict"
import test from "node:test"
import { interpretAlfaStatus, issueAccess, openPaidOrder } from "./access.js"

test("only a deposited alfa payment counts as paid", () => {
  assert.equal(interpretAlfaStatus(2), "paid")
  assert.equal(interpretAlfaStatus(0), "pending")
  assert.equal(interpretAlfaStatus(6), "failed")
})

test("unpaid order does not create a login", () => {
  const result = issueAccess({ baseName: "Юг" }, "pending", new Set(), () => "secret")
  assert.equal(result.ok, false)
  assert.equal(result.reason, "unpaid")
})

test("paid order creates a login once", () => {
  const taken = new Set(["yug"])
  const first = issueAccess({ baseName: "Юг" }, "paid", taken, () => "secret")
  assert.equal(first.ok, true)
  assert.equal(first.login, "yug2")
  assert.equal(first.password, "secret")
  const again = issueAccess({ baseName: "Юг", userId: "u1", login: "юг2" }, "paid", taken, () => "other")
  assert.equal(again.reason, "already")
  assert.equal(again.password, null)
})

test("password stays visible until the reveal window ends", () => {
  const order = { status: "paid", login: "юг", passwordOnce: "secret", revealUntil: 5000 }
  assert.equal(openPaidOrder(order, 4000).kind, "show")
  assert.equal(openPaidOrder(order, 5001).kind, "hidden")
  assert.equal(openPaidOrder({ status: "pending" }, 1).kind, "unpaid")
})
