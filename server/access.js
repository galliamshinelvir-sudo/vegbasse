const REVEAL_MS = 30 * 60 * 1000

export function interpretAlfaStatus(orderStatus) {
  const code = Number(orderStatus)
  if (code === 2) return "paid"
  if (code === 6 || code === 3) return "failed"
  return "pending"
}

export function issueAccess(order, status, takenLogins, random) {
  if (status !== "paid") return { ok: false, reason: "unpaid" }
  if (order.userId) {
    return { ok: true, reason: "already", userId: order.userId, login: order.login, password: null }
  }
  const login = freeLogin(order.baseName, takenLogins)
  return {
    ok: true,
    reason: "new",
    login,
    password: random(),
    revealUntil: Date.now() + REVEAL_MS,
  }
}

export function openPaidOrder(order, now) {
  if (order.status !== "paid") return { kind: "unpaid" }
  if (!order.passwordOnce || (order.revealUntil && now > order.revealUntil)) {
    return { kind: "hidden", login: order.login }
  }
  return { kind: "show", login: order.login, password: order.passwordOnce }
}

function freeLogin(baseName, taken) {
  const stem = latinStem(baseName)
  let login = stem
  let n = 2
  while (taken.has(login)) {
    login = `${stem}${n}`
    n += 1
  }
  return login
}

function latinStem(baseName) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  }
  const stem = String(baseName || "")
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 16)
  return stem || "baza"
}
