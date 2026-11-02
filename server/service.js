import { randomUUID } from "node:crypto"
import { assessLogin, recordFailure, recordSuccess } from "./policy.js"
import { filterOffers, refreshOffer } from "./catalog.js"
import { interpretAlfaStatus, issueAccess } from "./access.js"
import { registerPayment, readPaymentStatus } from "./alfa.js"
import { checkPassword, hashPassword, randomPassword } from "./passwords.js"

const HOUR = 60 * 60 * 1000

export function createService(options) {
  const store = options.store
  const cfg = options.cfg
  const now = options.now || (() => Date.now())
  const captchas = options.captchas || new Map()
  const register = options.register || registerPayment
  const statusOf = options.statusOf || readPaymentStatus
  const makePassword = options.password || randomPassword
  const hash = options.hash || hashPassword

  return {
    login,
    logout,
    me,
    captcha: newCaptcha,
    offers,
    contacts,
    addOffer,
    refresh,
    demands,
    addDemand,
    saveProfile,
    startAccess,
    settle,
    order,
  }

  function login(input, sessionAdd) {
    const key = `${input.ip}|${String(input.login || "").trim().toLowerCase()}`
    const data = store.read()
    const attempt = data.attempts[key] || { failures: 0, lockedUntil: 0 }
    const gate = assessLogin(attempt, now())
    if (!gate.ok) return { status: 429, body: { error: "Вход закрыт на 15 минут", lockedUntil: gate.lockedUntil } }
    if (gate.captcha && !consumeCaptcha(input.captchaId, input.captchaAnswer)) {
      if (!String(input.captchaAnswer || "").trim()) {
        return { status: 401, body: { error: "Нужна капча", captcha: newCaptcha() } }
      }
      const next = recordFailure(attempt, now())
      return store.update((draft) => ({ ...draft, attempts: { ...draft.attempts, [key]: next } })).then(() => ({
        status: 401,
        body: { error: "Капча не сошлась", captcha: assessLogin(next, now()).ok ? newCaptcha() : null, locked: !assessLogin(next, now()).ok },
      }))
    }
    const user = data.users.find((item) => item.login === String(input.login || "").trim())
    if (!user || !checkPassword(input.password || "", user.passwordHash)) {
      const next = recordFailure(attempt, now())
      return store.update((draft) => ({ ...draft, attempts: { ...draft.attempts, [key]: next } })).then(() => ({
        status: 401,
        body: { error: "Неверный логин или пароль", captcha: assessLogin(next, now()).captcha ? newCaptcha() : null },
      }))
    }
    const session = { id: randomUUID(), userId: user.id, expires: now() + (input.remember ? 30 * 24 * HOUR : 12 * HOUR) }
    return store.update((draft) => ({
      ...draft,
      attempts: { ...draft.attempts, [key]: recordSuccess() },
      sessions: draft.sessions.concat(session),
    })).then(() => {
      sessionAdd(session)
      return { status: 200, body: publicUser(user) }
    })
  }

  function logout(sessionId) {
    return store.update((draft) => ({
      ...draft,
      sessions: draft.sessions.filter((item) => item.id !== sessionId),
    })).then(() => ({ status: 200, body: { ok: true } }))
  }

  function me(user) {
    return { status: 200, body: user ? publicUser(user) : null }
  }

  function offers(user, query) {
    if (!user) return { status: 401, body: { error: "Нужен вход" } }
    return { status: 200, body: filterOffers(store.read().offers, query, now()) }
  }

  function contacts(user, offerId) {
    if (!user) return { status: 401, body: { error: "Нужен вход" } }
    const offer = store.read().offers.find((item) => item.id === offerId)
    if (!offer) return { status: 404, body: { error: "Партия не найдена" } }
    return { status: 200, body: offer.contacts }
  }

  function addOffer(user, input) {
    if (!user) return { status: 401, body: { error: "Нужен вход" } }
    const offer = normalizeOffer(input, user, now())
    if (!offer) return { status: 400, body: { error: "Заполните товар, цену и объём" } }
    return store.update((draft) => ({ ...draft, offers: draft.offers.concat(offer) })).then(() => ({
      status: 201,
      body: filterOffers([offer], {}, now())[0],
    }))
  }

  function refresh(user, offerId) {
    if (!user) return { status: 401, body: { error: "Нужен вход" } }
    const current = store.read().offers.find((item) => item.id === offerId)
    if (!current || current.sellerId !== user.id) return { status: 404, body: { error: "Это не ваша партия" } }
    const next = {
      ...refreshOffer(current, now()),
      contacts: { phone: user.phone, whatsapp: user.whatsapp, telegram: user.telegram },
    }
    return store.update((draft) => ({
      ...draft,
      offers: draft.offers.map((item) => (item.id === offerId ? next : item)),
    })).then(() => ({ status: 200, body: filterOffers([next], {}, now())[0] }))
  }

  function demands(user) {
    if (!user) return { status: 401, body: { error: "Нужен вход" } }
    return { status: 200, body: store.read().demands.slice().sort((a, b) => b.createdAt - a.createdAt) }
  }

  function addDemand(user, input) {
    if (!user) return { status: 401, body: { error: "Нужен вход" } }
    const text = String(input.text || "").trim()
    const phone = String(input.phone || user.phone || "").trim()
    if (text.length < 5 || phone.length < 6) return { status: 400, body: { error: "Напишите, что ищете, и телефон" } }
    const demand = { id: randomUUID(), userId: user.id, baseName: user.baseName, text, phone, city: String(input.city || "").trim(), createdAt: now() }
    return store.update((draft) => ({ ...draft, demands: draft.demands.concat(demand) })).then(() => ({
      status: 201,
      body: demand,
    }))
  }

  function saveProfile(user, input) {
    if (!user) return { status: 401, body: { error: "Нужен вход" } }
    const profile = {
      phone: String(input.phone || "").trim(),
      whatsapp: String(input.whatsapp || "").trim(),
      telegram: String(input.telegram || "").trim(),
    }
    return store.update((draft) => ({
      ...draft,
      users: draft.users.map((item) => (item.id === user.id ? { ...item, ...profile } : item)),
    })).then(() => ({ status: 200, body: profile }))
  }

  function startAccess(input) {
    const baseName = String(input.baseName || "").trim()
    if (baseName.length < 2) return Promise.resolve({ status: 400, body: { error: "Введите название базы" } })
    const order = {
      orderNumber: randomUUID().slice(0, 8),
      baseName,
      amountRub: cfg.priceRub,
      status: "pending",
      alfaOrderId: "",
      formUrl: "",
      userId: "",
      login: "",
      passwordOnce: "",
      revealUntil: 0,
    }
    return register(cfg, order).then((payment) => {
      order.formUrl = payment.formUrl
      order.alfaOrderId = payment.alfaOrderId || ""
      order.mode = payment.mode
      return store.update((draft) => ({ ...draft, orders: draft.orders.concat(order) })).then(() => ({
        status: 201,
        body: { orderNumber: order.orderNumber, formUrl: order.formUrl, amountRub: order.amountRub },
      }))
    }).catch((error) => ({ status: 502, body: { error: error.message || "Банк не выдал ссылку" } }))
  }

  function settle(orderNumber, demoConfirm) {
    const current = store.read().orders.find((item) => item.orderNumber === orderNumber)
    if (!current) return Promise.resolve({ status: 404, body: { error: "Счёт не найден" } })
    if (current.userId) return Promise.resolve({ status: 200, body: view(current) })
    return paymentStatus(current, demoConfirm).then((status) => {
      if (status !== "paid") return { status: 402, body: { error: "Оплата ещё не прошла", status } }
      const taken = new Set(store.read().users.map((item) => item.login))
      const issued = issueAccess(current, "paid", taken, makePassword)
      const user = {
        id: randomUUID(),
        login: issued.login,
        passwordHash: hash(issued.password),
        baseName: current.baseName,
        phone: "",
        whatsapp: "",
        telegram: "",
      }
      const saved = {
        ...current,
        status: "paid",
        userId: user.id,
        login: issued.login,
        passwordOnce: issued.password,
        revealUntil: issued.revealUntil,
      }
      return store.update((draft) => {
        const existing = draft.orders.find((item) => item.orderNumber === orderNumber)
        if (!existing || existing.userId) return draft
        return {
          ...draft,
          users: draft.users.concat(user),
          orders: draft.orders.map((item) => (item.orderNumber === orderNumber ? saved : item)),
        }
      }).then((draft) => {
        const stored = draft.orders.find((item) => item.orderNumber === orderNumber)
        return { status: 200, body: view(stored) }
      })
    })
  }

  function order(orderNumber) {
    const current = store.read().orders.find((item) => item.orderNumber === orderNumber)
    if (!current) return { status: 404, body: { error: "Счёт не найден" } }
    return { status: 200, body: view(current) }
  }

  function paymentStatus(current, demoConfirm) {
    if (current.mode === "demo") return Promise.resolve(demoConfirm ? "paid" : "pending")
    return statusOf(cfg, current.alfaOrderId).then((data) => interpretAlfaStatus(data.orderStatus))
  }

  function view(current) {
    const opened = current.status === "paid"
      ? { kind: current.passwordOnce && now() <= current.revealUntil ? "show" : "hidden", login: current.login, password: current.passwordOnce }
      : { kind: "unpaid" }
    if (opened.kind !== "show") return { kind: opened.kind, login: current.login || "", amountRub: current.amountRub }
    return { kind: "show", login: opened.login, password: opened.password, amountRub: current.amountRub }
  }

  function newCaptcha() {
    const left = 2 + Math.floor(Math.random() * 8)
    const right = 2 + Math.floor(Math.random() * 8)
    const id = randomUUID()
    captchas.set(id, { answer: String(left + right), expires: now() + 5 * 60 * 1000 })
    return { id, question: `${left} + ${right}` }
  }

  function consumeCaptcha(id, answer) {
    const found = captchas.get(id)
    captchas.delete(id)
    return Boolean(found && found.expires >= now() && found.answer === String(answer || "").trim())
  }
}

function publicUser(user) {
  return {
    id: user.id,
    login: user.login,
    baseName: user.baseName,
    phone: user.phone,
    whatsapp: user.whatsapp,
    telegram: user.telegram,
  }
}

function normalizeOffer(input, user, now) {
  const product = String(input.product || "").trim()
  const pricePerKg = Number(input.pricePerKg)
  const volumeTons = Number(input.volumeTons)
  if (!product || !(pricePerKg > 0) || !(volumeTons > 0)) return null
  return {
    id: randomUUID(),
    product,
    variety: String(input.variety || "").trim(),
    caliber: String(input.caliber || "").trim(),
    volumeTons,
    pricePerKg,
    vat: input.vat !== false,
    city: String(input.city || "").trim(),
    baseName: user.baseName,
    pack: String(input.pack || "").trim(),
    condition: String(input.condition || "").trim(),
    updatedAt: now,
    sellerId: user.id,
    contacts: {
      phone: user.phone,
      whatsapp: user.whatsapp,
      telegram: user.telegram,
    },
  }
}
