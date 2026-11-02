import assert from "node:assert/strict"
import test from "node:test"
import { filterOffers, refreshOffer } from "./catalog.js"

const now = Date.parse("2026-11-02T09:00:00Z")
const hour = 60 * 60 * 1000

function offer(patch) {
  return {
    id: "1",
    product: "Картофель",
    variety: "Гала",
    caliber: "5+",
    volumeTons: 20,
    pricePerKg: 18,
    vat: true,
    city: "Краснодар",
    baseName: "Юг",
    pack: "сетка",
    condition: "мытый",
    updatedAt: now - hour,
    sellerId: "s",
    contacts: { phone: "7999" },
    ...patch,
  }
}

test("today and 24h keep fresh rows and drop old ones", () => {
  const rows = [
    offer({ id: "fresh" }),
    offer({ id: "yesterday", updatedAt: now - 26 * hour }),
  ]
  assert.deepEqual(filterOffers(rows, { fresh: "24h" }, now).map((row) => row.id), ["fresh"])
  assert.deepEqual(filterOffers(rows, { fresh: "today" }, now).map((row) => row.id), ["fresh"])
})

test("filters stack and the row has no phone", () => {
  const rows = [
    offer({}),
    offer({ id: "bulk", pack: "навал", caliber: "6+" }),
  ]
  const found = filterOffers(rows, { pack: "сетка", caliber: "5+", q: "гала" }, now)
  assert.equal(found.length, 1)
  assert.equal(found[0].contacts, undefined)
  assert.equal(found[0].stale, false)
})

test("a row older than two days is stale", () => {
  const found = filterOffers([offer({ updatedAt: now - 3 * 24 * hour })], {}, now)
  assert.equal(found[0].stale, true)
})

test("refresh moves the date and keeps the price", () => {
  const next = refreshOffer(offer({ pricePerKg: 21, updatedAt: now - hour }), now)
  assert.equal(next.updatedAt, now)
  assert.equal(next.pricePerKg, 21)
})
