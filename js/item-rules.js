/* Shared merchant, loot and guide rules. No DOM, storage, or external requests. */
(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const item = id => typeof id === "string" && own(D.items, id) ? D.items[id] : null;
  function buyPrice(id) {
    const i = item(id);
    return i && i.shop !== false && i.type !== "loot" && Number.isSafeInteger(i.price) && i.price >= 0 ? i.price : null;
  }
  function sellPrice(id) {
    const i = item(id);
    if (!i || i.sellable === false) return 0;
    if (own(i, "sellPrice")) return Number.isSafeInteger(i.sellPrice) && i.sellPrice >= 0 ? i.sellPrice : 0;
    return Number.isSafeInteger(i.price) && i.price >= 0 ? Math.max(1, Math.floor(i.price / 2)) : 0;
  }
  function tradeQuote(s, id, mode, qty, carrying) {
    const limit = mode === "buy" ? 999 : mode === "sell" ? 100000 : 0;
    const record = value => value && typeof value === "object" && !Array.isArray(value);
    const weightValue = value => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
    const result = {
      ok: false, message: "", unitPrice: 0, quantity: 0, total: 0,
      weightDelta: 0, weightAfter: weightValue(carrying?.weight) ? carrying.weight : 0,
      maxQuantity: 0, owned: 0, near: false, limit,
    };
    const reject = message => { result.message = message; return result; };
    if (!limit) return reject("ประเภทรายการไม่ถูกต้อง");
    const i = item(id);
    if (!i) return reject("ไม่พบไอเทม");
    if (!record(s) || !own(s, "zone") || !own(s, "player") || !record(s.player) ||
        !own(s.player, "x") || !own(s.player, "y") || !Number.isFinite(s.player.x) || !Number.isFinite(s.player.y) ||
        !own(s, "silver") || !Number.isSafeInteger(s.silver) || s.silver < 0 ||
        !own(s, "inventory") || !record(s.inventory) || !record(carrying) ||
        !weightValue(carrying.weight) || !weightValue(carrying.capacity) || !weightValue(i.weight))
      return reject("ข้อมูลเงินหรือกระเป๋าไม่ถูกต้อง");
    const owned = own(s.inventory, id) ? s.inventory[id] : 0;
    if (!Number.isSafeInteger(owned) || owned < 0 || owned * i.weight > carrying.weight + 1e-9)
      return reject("ข้อมูลจำนวนไอเทมหรือน้ำหนักไม่ถูกต้อง");
    result.owned = owned;
    const merchant = D.npcs.find(n => n.id === "merchant");
    result.near = !!merchant && s.zone === 0 && Math.hypot(s.player.x - merchant.x, s.player.y - merchant.y) < 85;
    const price = mode === "buy" ? buyPrice(id) : sellPrice(id);
    if (price === null || mode === "sell" && !price)
      return reject(mode === "buy" ? "ร้านไม่ขายไอเทมนี้" : "ขายไอเทมนี้ไม่ได้");
    result.unitPrice = price;
    if (result.near) {
      if (mode === "buy") {
        const room = carrying.capacity - carrying.weight;
        const weightLimit = room < 0 ? 0 : i.weight ? Math.floor(room / i.weight) : limit;
        result.maxQuantity = Math.max(0, Math.min(limit, price ? Math.floor(s.silver / price) : limit, 100000 - owned, weightLimit));
      } else result.maxQuantity = Math.max(0, Math.min(limit, owned, Math.floor((100000000 - s.silver) / price)));
    }
    const validQuantity = Number.isSafeInteger(qty) && qty >= 1 && qty <= limit;
    if (validQuantity) {
      const total = price * qty, delta = i.weight * qty * (mode === "buy" ? 1 : -1);
      const after = carrying.weight + delta;
      if (!Number.isSafeInteger(total) || !Number.isFinite(delta) || Math.abs(delta) > Number.MAX_SAFE_INTEGER ||
          !Number.isFinite(after) || Math.abs(after) > Number.MAX_SAFE_INTEGER) return reject("จำนวนไม่ถูกต้อง");
      result.quantity = qty; result.total = total; result.weightDelta = delta; result.weightAfter = Math.max(0, after);
    }
    if (!result.near) return reject(`เดินเข้าใกล้${merchant?.name || "แม่ค้า"}ที่${D.maps[0].name}`);
    if (!validQuantity) return reject("จำนวนไม่ถูกต้อง");
    if (mode === "buy") {
      if (s.silver < result.total) return reject(`${D.world.currency}ไม่เพียงพอ`);
      if (owned + qty > 100000) return reject("ไอเทมชนิดนี้เต็มกระเป๋าแล้ว");
      if (result.weightAfter > carrying.capacity) return reject("น้ำหนักเกินความจุ");
    } else {
      if (owned < qty) return reject("จำนวนไอเทมไม่เพียงพอ");
      if (s.silver + result.total > 100000000) return reject("จำนวนอัฐเต็มแล้ว");
    }
    result.ok = true;
    return result;
  }
  function rollDrops(kind, rng = Math.random) {
    if (typeof kind !== "string" || !own(D.dropTables, kind)) return [];
    const draw = () => {
      const r = rng();
      if (typeof r !== "number" || !Number.isFinite(r) || r < 0 || r >= 1) throw new RangeError("Random source must return a number in [0, 1)");
      return r;
    };
    const result = [];
    for (const row of D.dropTables[kind]) {
      if (!item(row.item) || !Number.isFinite(row.chance) || row.chance < 0 || row.chance > 1 || !Number.isInteger(row.min) || !Number.isInteger(row.max) || row.min < 1 || row.max < row.min || row.max > 999) throw new RangeError("Invalid drop table row");
      if (row.chance === 0 || (row.chance < 1 && draw() >= row.chance)) continue;
      const qty = row.min === row.max ? row.min : row.min + Math.floor(draw() * (row.max - row.min + 1));
      result.push({ item: row.item, qty });
    }
    return result;
  }
  function sourcesFor(id) {
    if (!item(id)) return [];
    const sources = [], source = (kind, name, available, chance = 1, min = 1, max = min, firstClear = false) => ({ kind, name, available, chance, min, max, firstClear });
    if (buyPrice(id) !== null) sources.push(source("shop", D.npcs.find(n => n.id === "merchant").name, true));
    if (D.itemCatalog.start.includes(id)) sources.push(source("start", "อุปกรณ์เริ่มต้น", true, 1, id === "potion" ? 5 : id === "ether" ? 3 : 1));
    for (const [kind, rows] of Object.entries(D.dropTables)) {
      for (const r of rows) if (r.item === id && r.chance > 0) sources.push(source("monster", D.dropSources[kind].name, own(D.monsters, kind), r.chance, r.min, r.max));
      const firstClear = D.dropSources[kind].firstClear;
      // Planned first-clear rewards stay unavailable until a real quest exists.
      if (firstClear && own(firstClear, id)) sources.push(source("quest", `ปราบ${D.dropSources[kind].name}ครั้งแรก`, false, 1, firstClear[id], firstClear[id], true));
    }
    for (const q of D.quests) if (q.items && own(q.items, id)) sources.push(source("quest", q.title, true, 1, q.items[id], q.items[id], true));
    return sources;
  }
  function availability(id) {
    const i = item(id);
    if (!i) return null;
    return sourcesFor(id).some(source => source.available) ? "available" : "planned";
  }
  const api = { buyPrice, sellPrice, tradeQuote, rollDrops, sourcesFor, availability };
  if (typeof module === "object") module.exports = api;
  else root.BCItemRules = api;
})(typeof window === "undefined" ? globalThis : window);
