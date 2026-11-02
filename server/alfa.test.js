import assert from "node:assert/strict"
import test from "node:test"
import { registerPayment } from "./alfa.js"

test("without a bank token the link stays on this site", async () => {
  let called = false
  const result = await registerPayment(
    { publicBase: "http://localhost:3080" },
    { orderNumber: "a1", amountRub: 3000 },
    () => { called = true },
  )
  assert.equal(called, false)
  assert.equal(result.mode, "demo")
  assert.equal(result.formUrl, "http://localhost:3080/pay/demo/a1")
})

test("a bank token registers an order and returns the bank link", async () => {
  const result = await registerPayment(
    { publicBase: "http://localhost:3080", apiUrl: "https://bank.test", token: "tok" },
    { orderNumber: "a2", amountRub: 3000 },
    async (_url, options) => {
      assert.match(options.body.toString(), /amount=300000/)
      assert.match(options.body.toString(), /token=tok/)
      return { json: async () => ({ orderId: "bank-1", formUrl: "https://bank.test/pay/1" }) }
    },
  )
  assert.equal(result.mode, "alfa")
  assert.equal(result.formUrl, "https://bank.test/pay/1")
})
