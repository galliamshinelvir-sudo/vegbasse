const hour = 60 * 60 * 1000

export function seedData(now = Date.now()) {
  return {
    users: [],
    sessions: [],
    attempts: {},
    orders: [],
    demands: [],
    offers: [
      lot("1", "Картофель", "Гала", "5+", 22, 19, true, "Краснодар", "Южная", "сетка", "мытый", now - 2 * hour),
      lot("2", "Лук", "Штутгарт", "4+", 18, 24, false, "Волгоград", "Низовье", "сетка", "грязный", now - 5 * hour),
      lot("3", "Морковь", "Шантане", "2+", 15, 27, true, "Краснодар", "Южная", "навал", "из хранилища", now - 30 * hour),
      lot("4", "Капуста", "Слава", "8+", 12, 16, true, "Астрахань", "Дельта", "сетка", "мытый", now - 70 * hour),
      lot("5", "Свёкла", "Бордо", "6+", 10, 21, false, "Ростов", "Дон", "навал", "грязный", now - hour),
    ],
  }
}

function lot(id, product, variety, caliber, volumeTons, pricePerKg, vat, city, baseName, pack, condition, updatedAt) {
  return {
    id,
    product,
    variety,
    caliber,
    volumeTons,
    pricePerKg,
    vat,
    city,
    baseName,
    pack,
    condition,
    updatedAt,
    sellerId: "seed",
    contacts: {
      phone: "79001234567",
      whatsapp: "https://wa.me/79001234567",
      telegram: "https://t.me/vegbasse_demo",
    },
  }
}
