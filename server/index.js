import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { extname, join, normalize } from "node:path"
import { createStore } from "./store.js"
import { seedData } from "./seed.js"
import { createService } from "./service.js"
import { demoPayPage, failPage, resultPage } from "./pages.js"

loadEnv()
const root = join(import.meta.dirname, "..")
const cfg = {
  priceRub: Number(process.env.ACCESS_PRICE_RUB || 3000),
  publicBase: process.env.PUBLIC_BASE_URL || "http://localhost:3080",
  apiUrl: process.env.ALFA_API_URL || "https://pay.alfabank.ru/payment/rest",
  token: process.env.ALFA_TOKEN || "",
  user: process.env.ALFA_USER || "",
  password: process.env.ALFA_PASSWORD || "",
}
const store = createStore(join(root, "data", "db.json"), seedData)
const service = createService({ store, cfg })
const port = Number(process.env.PORT || 3080)

createServer((req, res) => {
  route(req, res).catch(() => send(res, 500, { error: "Сбой сервера" }))
}).listen(port, () => {
  console.log(`vegbasse on http://localhost:${port}`)
})

async function route(req, res) {
  const url = new URL(req.url, cfg.publicBase)
  const user = currentUser(req)
  if (req.method === "GET" && url.pathname === "/api/price") {
    return send(res, 200, { amountRub: cfg.priceRub, alfa: Boolean(cfg.token || cfg.user) })
  }
  if (req.method === "GET" && url.pathname === "/api/me") return send(res, 200, user ? service.me(user).body : null)
  if (req.method === "POST" && url.pathname === "/api/login") {
    const input = await body(req)
    input.ip = req.socket.remoteAddress || ""
    return sendResult(res, await service.login(input, (session) => setSession(res, session)))
  }
  if (req.method === "POST" && url.pathname === "/api/logout") {
    return sendResult(res, await service.logout(cookie(req, "vb")))
  }
  if (req.method === "POST" && url.pathname === "/api/access") return sendResult(res, await service.startAccess(await body(req)))
  if (req.method === "GET" && url.pathname === "/api/offers") return sendResult(res, await asPromise(service.offers(user, Object.fromEntries(url.searchParams))))
  if (req.method === "POST" && url.pathname.startsWith("/api/offers/") && url.pathname.endsWith("/contacts")) {
    return sendResult(res, await asPromise(service.contacts(user, url.pathname.split("/")[3])))
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/offers/") && url.pathname.endsWith("/refresh")) {
    return sendResult(res, await asPromise(service.refresh(user, url.pathname.split("/")[3])))
  }
  if (req.method === "POST" && url.pathname === "/api/offers") return sendResult(res, await asPromise(service.addOffer(user, await body(req))))
  if (req.method === "GET" && url.pathname === "/api/demands") return sendResult(res, await asPromise(service.demands(user)))
  if (req.method === "POST" && url.pathname === "/api/demands") return sendResult(res, await asPromise(service.addDemand(user, await body(req))))
  if (req.method === "POST" && url.pathname === "/api/profile") return sendResult(res, await asPromise(service.saveProfile(user, await body(req))))
  if (req.method === "GET" && url.pathname.startsWith("/pay/demo/")) return html(res, demoPage(url.pathname.split("/")[3]))
  if (req.method === "POST" && url.pathname.startsWith("/pay/demo/") && url.pathname.endsWith("/confirm")) {
    return confirmDemo(res, url.pathname.split("/")[3])
  }
  if (req.method === "GET" && url.pathname === "/pay/return") return html(res, resultPage((await service.settle(url.searchParams.get("order") || "", false)).body))
  if (req.method === "GET" && url.pathname === "/pay/fail") return html(res, failPage())
  if (req.method === "GET") return file(res, url.pathname)
  send(res, 404, { error: "Нет такого адреса" })
}

function currentUser(req) {
  const id = cookie(req, "vb")
  const data = store.read()
  const session = data.sessions.find((item) => item.id === id && item.expires > Date.now())
  if (!session) return null
  return data.users.find((item) => item.id === session.userId) || null
}

function demoPage(orderNumber) {
  const found = store.read().orders.find((item) => item.orderNumber === orderNumber && item.mode === "demo")
  if (!found) return failPage()
  return demoPayPage(found)
}

async function confirmDemo(res, orderNumber) {
  const found = store.read().orders.find((item) => item.orderNumber === orderNumber && item.mode === "demo")
  if (!found) return html(res, failPage())
  await service.settle(orderNumber, true)
  res.writeHead(303, { location: `/pay/return?order=${orderNumber}` })
  res.end()
}

function setSession(res, session) {
  const age = Math.max(1, Math.floor((session.expires - Date.now()) / 1000))
  res.setHeader("Set-Cookie", `vb=${session.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}`)
}

function cookie(req, name) {
  const part = String(req.headers.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))
  return part ? decodeURIComponent(part.slice(name.length + 1)) : ""
}

function body(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on("data", (chunk) => {
      size += chunk.length
      if (size > 20000) reject(new Error("too big"))
      else chunks.push(chunk)
    })
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString()
      if (!text) return resolve({})
      try { resolve(JSON.parse(text)) } catch { resolve({}) }
    })
  })
}

function file(res, pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^[/\\]+/, "")
  const full = normalize(join(root, "public", rel))
  if (!full.startsWith(normalize(join(root, "public")))) return send(res, 403, { error: "Нет" })
  try {
    const data = readFileSync(full)
    res.writeHead(200, { "content-type": type(full) })
    res.end(data)
  } catch {
    send(res, 404, { error: "Нет такого адреса" })
  }
}

function type(file) {
  const ext = extname(file)
  if (ext === ".css") return "text/css; charset=utf-8"
  if (ext === ".js") return "text/javascript; charset=utf-8"
  return "text/html; charset=utf-8"
}

function html(res, text) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
  res.end(text)
}

function send(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(payload))
}

async function sendResult(res, result) {
  send(res, result.status, result.body)
}

function asPromise(value) {
  return Promise.resolve(value)
}

function loadEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
    }
  } catch { /* нет файла — остаются значения по умолчанию */ }
}
