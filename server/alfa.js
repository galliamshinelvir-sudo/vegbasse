export async function registerPayment(cfg, order, fetchImpl = fetch) {
  if (!cfg.token && !cfg.user) {
    return { mode: "demo", formUrl: `${cfg.publicBase}/pay/demo/${order.orderNumber}` }
  }
  const body = new URLSearchParams({
    orderNumber: order.orderNumber,
    amount: String(order.amountRub * 100),
    returnUrl: `${cfg.publicBase}/pay/return?order=${order.orderNumber}`,
    failUrl: `${cfg.publicBase}/pay/fail?order=${order.orderNumber}`,
  })
  if (cfg.token) body.set("token", cfg.token)
  else {
    body.set("userName", cfg.user)
    body.set("password", cfg.password)
  }
  const response = await fetchImpl(`${cfg.apiUrl}/register.do`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
  const data = await response.json()
  if (!data.formUrl) {
    throw new Error(data.errorMessage || "alfa register failed")
  }
  return { mode: "alfa", formUrl: data.formUrl, alfaOrderId: data.orderId }
}

export async function readPaymentStatus(cfg, alfaOrderId, fetchImpl = fetch) {
  if (!cfg.token && !cfg.user) return { status: "demo" }
  const body = new URLSearchParams({ orderId: alfaOrderId })
  if (cfg.token) body.set("token", cfg.token)
  else {
    body.set("userName", cfg.user)
    body.set("password", cfg.password)
  }
  const response = await fetchImpl(`${cfg.apiUrl}/getOrderStatusExtended.do`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
  return response.json()
}
