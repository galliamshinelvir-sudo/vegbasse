const DAY = 24 * 60 * 60 * 1000
const MOSCOW = 3 * 60 * 60 * 1000
export const STALE_MS = 2 * DAY

export function moscowDay(ms) {
  return new Date(ms + MOSCOW).toISOString().slice(0, 10)
}

export function matchesFresh(updatedAt, now, mode) {
  if (mode === "24h") return now - updatedAt <= DAY
  if (mode === "today") return moscowDay(updatedAt) === moscowDay(now)
  return true
}

export function filterOffers(offers, query, now) {
  const q = (query.q || "").trim().toLowerCase()
  return offers
    .filter((offer) => matchesFresh(offer.updatedAt, now, query.fresh || ""))
    .filter((offer) => !query.caliber || offer.caliber === query.caliber)
    .filter((offer) => !query.pack || offer.pack === query.pack)
    .filter((offer) => !query.condition || offer.condition === query.condition)
    .filter((offer) => !query.city || offer.city === query.city)
    .filter((offer) => !q || `${offer.product} ${offer.variety}`.toLowerCase().includes(q))
    .map((offer) => toRow(offer, now))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function toRow(offer, now) {
  return {
    id: offer.id,
    product: offer.product,
    variety: offer.variety,
    caliber: offer.caliber,
    volumeTons: offer.volumeTons,
    pricePerKg: offer.pricePerKg,
    vat: offer.vat,
    city: offer.city,
    baseName: offer.baseName,
    pack: offer.pack,
    condition: offer.condition,
    updatedAt: offer.updatedAt,
    sellerId: offer.sellerId,
    stale: now - offer.updatedAt > STALE_MS,
  }
}

export function refreshOffer(offer, now) {
  return { ...offer, updatedAt: now }
}
