const state = { captchaId: "", me: null }

const rack = document.querySelector("#rack")
const menu = document.querySelector("#menu")
const loginDialog = document.querySelector("#login-dialog")
const contactsDialog = document.querySelector("#contacts-dialog")
const loginForm = document.querySelector("#login-form")
const payForm = document.querySelector("#pay-form")
const loginError = document.querySelector("#login-error")
const payError = document.querySelector("#pay-error")
const captchaLine = document.querySelector("#captcha-line")
const captchaAnswer = document.querySelector("#captcha-a")
const board = document.querySelector("#board")
const home = document.querySelector("#home")

rack.addEventListener("click", () => { menu.hidden = !menu.hidden })
document.querySelector("#open-login").addEventListener("click", () => { menu.hidden = true; loginDialog.showModal() })
document.querySelector("#open-contacts").addEventListener("click", () => { menu.hidden = true; contactsDialog.showModal() })
document.querySelector("#close-login").addEventListener("click", () => loginDialog.close())
document.querySelector("#close-contacts").addEventListener("click", () => contactsDialog.close())
document.querySelector("#logout").addEventListener("click", logout)
loginForm.addEventListener("submit", onLogin)
payForm.addEventListener("submit", onPay)
document.querySelector("#lot-form").addEventListener("submit", onLot)
document.querySelector("#profile-form").addEventListener("submit", onProfile)
document.querySelector("#demand-form").addEventListener("submit", onDemand)
for (const id of ["q", "fresh", "caliber", "pack", "condition", "city"]) {
  document.querySelector(`#${id}`).addEventListener("input", loadOffers)
}

boot()

async function boot() {
  const price = await api("/api/price")
  document.querySelector("#price").textContent = `${Number(price.amountRub).toLocaleString("ru-RU")} ₽`
  state.me = await api("/api/me")
  showUser()
  if (state.me) await openBoard()
}

async function onLogin(event) {
  event.preventDefault()
  loginError.textContent = ""
  const data = new FormData(loginForm)
  const result = await api("/api/login", {
    login: data.get("login"),
    password: data.get("password"),
    remember: data.get("remember") === "on",
    captchaId: state.captchaId,
    captchaAnswer: captchaAnswer.value,
  })
  if (result.error) {
    loginError.textContent = result.error
    showCaptcha(result.captcha)
    return
  }
  state.me = result
  loginDialog.close()
  showUser()
  await openBoard()
}

async function onPay(event) {
  event.preventDefault()
  payError.textContent = ""
  const data = new FormData(payForm)
  const result = await api("/api/access", { baseName: data.get("baseName") })
  if (result.error) {
    payError.textContent = result.error
    return
  }
  location.href = result.formUrl
}

async function logout() {
  await api("/api/logout", {})
  state.me = null
  menu.hidden = true
  showUser()
  board.hidden = true
  home.hidden = false
}

function showUser() {
  const who = document.querySelector("#who")
  const logoutButton = document.querySelector("#logout")
  who.hidden = !state.me
  logoutButton.hidden = !state.me
  if (state.me) who.textContent = state.me.baseName
  const profile = document.querySelector("#profile-form")
  if (state.me) {
    profile.phone.value = state.me.phone || ""
    profile.whatsapp.value = state.me.whatsapp || ""
    profile.telegram.value = state.me.telegram || ""
    document.querySelector("#demand-form").phone.value = state.me.phone || ""
  }
}

async function openBoard() {
  home.hidden = true
  board.hidden = false
  await loadOffers()
  await loadDemands()
}

async function loadOffers() {
  const params = new URLSearchParams()
  for (const id of ["q", "fresh", "caliber", "pack", "condition", "city"]) {
    const value = document.querySelector(`#${id}`).value
    if (value) params.set(id, value)
  }
  const rows = await api(`/api/offers?${params}`)
  if (rows.error) return
  fillSelect("#caliber", "Калибр", [...new Set(rows.map((row) => row.caliber).filter(Boolean))])
  fillSelect("#city", "Город", [...new Set(rows.map((row) => row.city).filter(Boolean))])
  document.querySelector("#rows").innerHTML = rows.map(rowHtml).join("")
  document.querySelectorAll("[data-contacts]").forEach((button) => {
    button.addEventListener("click", () => reveal(button))
  })
  document.querySelectorAll("[data-refresh]").forEach((button) => {
    button.addEventListener("click", () => refresh(button.dataset.refresh))
  })
}

function rowHtml(row) {
  const mine = state.me && row.sellerId === state.me.id
  const when = new Date(row.updatedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  return `<tr class="${row.stale ? "stale" : ""}">
    <td>${esc(row.product)}</td>
    <td>${esc(row.variety)}</td>
    <td>${esc(row.caliber)}</td>
    <td>${row.volumeTons}</td>
    <td>${row.pricePerKg}</td>
    <td>${row.vat ? "с НДС" : "без"}</td>
    <td>${esc(row.city)} · ${esc(row.baseName)}</td>
    <td>${when}${row.stale ? " · несвежее" : ""}</td>
    <td>
      <button type="button" data-contacts="${esc(row.id)}">Показать контакты</button>
      ${mine ? `<button type="button" data-refresh="${esc(row.id)}">Актуализировать</button>` : ""}
    </td>
  </tr>`
}

async function reveal(button) {
  const contacts = await api(`/api/offers/${button.dataset.contacts}/contacts`, {})
  if (contacts.error) return
  const phone = contacts.phone ? `<a href="tel:+${esc(contacts.phone)}">${esc(contacts.phone)}</a>` : ""
  const whatsapp = contacts.whatsapp ? `<a href="${esc(contacts.whatsapp)}">WhatsApp</a>` : ""
  const telegram = contacts.telegram ? `<a href="${esc(contacts.telegram)}">Telegram</a>` : ""
  button.parentElement.innerHTML = [phone, whatsapp, telegram].filter(Boolean).join(" · ") || "Контакты не заполнены"
}

async function refresh(id) {
  await api(`/api/offers/${id}/refresh`, {})
  await loadOffers()
}

async function onLot(event) {
  event.preventDefault()
  const data = new FormData(event.target)
  await api("/api/offers", {
    product: data.get("product"),
    variety: data.get("variety"),
    caliber: data.get("caliber"),
    volumeTons: Number(data.get("volumeTons")),
    pricePerKg: Number(data.get("pricePerKg")),
    city: data.get("city"),
    pack: data.get("pack"),
    condition: data.get("condition"),
    vat: data.get("vat") === "on",
  })
  event.target.reset()
  await loadOffers()
}

async function onProfile(event) {
  event.preventDefault()
  const data = new FormData(event.target)
  state.me = { ...state.me, ...(await api("/api/profile", {
    phone: data.get("phone"),
    whatsapp: data.get("whatsapp"),
    telegram: data.get("telegram"),
  })) }
}

async function onDemand(event) {
  event.preventDefault()
  const data = new FormData(event.target)
  await api("/api/demands", { text: data.get("text"), city: data.get("city"), phone: data.get("phone") })
  event.target.reset()
  await loadDemands()
}

async function loadDemands() {
  const rows = await api("/api/demands")
  if (rows.error) return
  document.querySelector("#demands").innerHTML = rows.map((row) =>
    `<li>${esc(row.baseName)} · ${esc(row.city)} · ${esc(row.text)} · ${esc(row.phone)}</li>`).join("")
}

function fillSelect(selector, label, values) {
  const select = document.querySelector(selector)
  const current = select.value
  const options = values.filter((value) => ![...select.options].some((option) => option.value === value))
  for (const value of options) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = value
    select.append(option)
  }
  select.value = current
  select.options[0].textContent = label
}

function showCaptcha(captcha) {
  captchaLine.hidden = !captcha
  captchaAnswer.hidden = !captcha
  if (!captcha) return
  state.captchaId = captcha.id
  document.querySelector("#captcha-q").textContent = captcha.question
  captchaAnswer.value = ""
}

async function api(url, payload) {
  const response = await fetch(url, payload === undefined ? undefined : {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  return response.json()
}

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]))
}
