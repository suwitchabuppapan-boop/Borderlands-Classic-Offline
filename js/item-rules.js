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
  const api = { buyPrice, sellPrice, rollDrops, sourcesFor };
  if (typeof module === "object") module.exports = api;
  else root.BCItemRules = api;
})(typeof window === "undefined" ? globalThis : window);
