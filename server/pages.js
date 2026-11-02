export function demoPayPage(order) {
  return page("Тестовая оплата", `
    <main class="sheet">
      <p class="eyebrow">Тестовый режим</p>
      <h1>Оплата доступа</h1>
      <p>Боевой Альфа-Банк ещё не подключён. Эта страница только проверяет путь: после подтверждения сайт один раз создаст логин и пароль.</p>
      <p class="sum">${money(order.amountRub)} на расчётный счёт ИП</p>
      <p>База: ${escapeHtml(order.baseName)}</p>
      <form method="post" action="/pay/demo/${escapeHtml(order.orderNumber)}/confirm">
        <button type="submit">Подтвердить тестовую оплату</button>
      </form>
    </main>`)
}

export function resultPage(result) {
  if (result.kind === "show") {
    return page("Доступ открыт", `
      <main class="sheet">
        <p class="eyebrow">Оплата прошла</p>
        <h1>Запишите вход</h1>
        <p>Пароль виден ограниченное время. Второй кабинет по этому платежу не создаётся.</p>
        <p>Логин</p>
        <p class="secret">${escapeHtml(result.login)}</p>
        <p>Пароль</p>
        <p class="secret">${escapeHtml(result.password)}</p>
        <p><a href="/">Перейти ко входу</a></p>
      </main>`)
  }
  if (result.kind === "hidden") {
    return page("Доступ уже выдан", `
      <main class="sheet">
        <h1>Логин: ${escapeHtml(result.login || "")}</h1>
        <p>Пароль уже был показан. Если он потерян, его задаёт хозяин площадки.</p>
        <p><a href="/">Ко входу</a></p>
      </main>`)
  }
  return page("Оплата не найдена", `
    <main class="sheet">
      <h1>Оплата ещё не прошла</h1>
      <p><a href="/">На главную</a></p>
    </main>`)
}

export function failPage() {
  return page("Оплата не прошла", `
    <main class="sheet">
      <h1>Банк не подтвердил оплату</h1>
      <p><a href="/">Вернуться и попробовать снова</a></p>
    </main>`)
}

function page(title, body) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="/css/board.css">
</head>
<body>${body}</body>
</html>`
}

function money(value) {
  return `${Number(value || 0).toLocaleString("ru-RU")} ₽`
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]))
}
