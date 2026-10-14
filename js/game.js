(function () {
  "use strict";
  const D = window.BCData,
    C = window.BCCore,
    R = window.BCRender,
    $ = (id) => document.getElementById(id);
  const world = D.world,
    npc = (id) => D.npcs.find((person) => person.id === id),
    jobName = (id) => D.jobs[id].name;
  const esc = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  let state = C.createState(),
    panel = null,
    paused = false,
    last = 0,
    hudTime = 0,
    saveTime = 0,
    toastTimer,
    hotSignature = "",
    selectedInventoryItem = "potion",
    inventoryCategory = "all",
    shopVisit = false,
    lastFocus = null,
    protectStorage = false,
    storageError = "";
  const keys = new Set();
  try {
    const saved = localStorage.getItem(D.saveKey);
    if (saved) {
      try {
        state = C.deserialize(saved);
      } catch (e) {
        protectStorage = true;
        storageError =
          "เซฟเดิมอ่านไม่ได้ • Export เกมนี้ได้ หรือ Import เซฟที่สำรองไว้";
      }
    }
  } catch (e) {
    storageError =
      "เบราว์เซอร์บันทึกไม่ได้ • ใช้ Export Save เพื่อเก็บความคืบหน้า";
  }
  function toast(message) {
    if (!message) return;
    $("toast").textContent = message;
    $("toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 3600);
  }
  function save(manual = false) {
    if (protectStorage) {
      if (
        !manual ||
        !confirm(
          "เซฟเดิมอ่านไม่ได้ ต้องการแทนที่ด้วยเกมปัจจุบันหรือไม่? แนะนำสำรองเซฟเดิมก่อน",
        )
      ) {
        storageError = "เก็บเซฟเดิมไว้ • ใช้ Export Save สำหรับเกมปัจจุบัน";
        updateSaveLabel();
        return false;
      }
      protectStorage = false;
    }
    try {
      localStorage.setItem(D.saveKey, C.serialize(state));
      storageError = "";
      $("save-indicator").textContent =
        "● บันทึกแล้ว · " +
        new Date().toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        });
      if (manual) toast("บันทึกความคืบหน้าแล้ว");
      return true;
    } catch (e) {
      storageError = "บันทึกไม่ได้ • ใช้ Export Save";
      updateSaveLabel();
      if (manual) toast("เบราว์เซอร์ไม่อนุญาตให้บันทึก กรุณา Export Save");
      return false;
    }
  }
  function updateSaveLabel() {
    if (storageError) $("save-indicator").textContent = "⚠ " + storageError;
  }
  function exportSave() {
    const blob = new Blob([C.serialize(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "siam-arun-save-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("ส่งออกเซฟแล้ว • เก็บไฟล์นี้ไว้ใช้ Import");
  }
  function loadSave(text) {
    const next = C.deserialize(text);
    shopVisit = false;
    state = next;
    keys.clear();
    protectStorage = false;
    hotSignature = "";
    save();
    updateHUD();
    if (panel) renderPanel();
    toast("นำเข้าเซฟสำเร็จ");
  }
  function run(action, p = {}) {
    if (["move", "target", "auto", "travel"].includes(action)) shopVisit = false;
    const result = C.act(state, action, p);
    if (result.message) toast(result.message);
    updateHUD();
    if (panel) renderPanel();
    return result;
  }
  const titleNames = {
    status: "สถานะตัวละคร",
    skills: "สกิลและอาชีพ",
    inventory: "กระเป๋านักผจญภัย",
    equipment: "อุปกรณ์สวมใส่",
    quest: "บันทึกภารกิจ",
    shop: "ร้านค้านักเดินทาง",
    codex: `คู่มือโลก${world.title}`,
    log: "บันทึกการเดินทาง",
    settings: "ตั้งค่าการผจญภัย",
    hotbar: "จัด Hotbar",
    auto: "Auto Battle",
    help: "คู่มือนักผจญภัย",
    npc: npc("guide").name,
    map: "เส้นทางการเดินทาง",
  };
  const equipmentSlots = [
    ["head", "ศีรษะ", "novice_cap"],
    ["weapon", "อาวุธ", "rusty_sword"],
    ["armor", "เกราะ", "cloth_armor"],
    ["accessory", "เครื่องประดับ", "bronze_ring"],
  ];
  const equipmentTypes = equipmentSlots.map(([slot]) => slot);
  const equipmentCaption = (s) => ["head", "weapon"]
    .map((slot) => `<span>${esc(D.items[s.equipment[slot]]?.name || (slot === "head" ? "ไม่สวมหมวก" : "มือเปล่า"))}</span>`)
    .join("");
  function openPanel(name) {
    if (!titleNames[name]) return;
    shopVisit = false;
    lastFocus = document.activeElement;
    panel = name;
    keys.clear();
    state.destination = null;
    state.target = null;
    $("panel-window").hidden = false;
    $("panel-backdrop").hidden = false;
    renderPanel();
    $("panel-window").querySelector('[data-action="close"]').focus();
  }
  function closePanel() {
    if (shopVisit) state.destination = null;
    shopVisit = false;
    panel = null;
    $("panel-window").hidden = true;
    $("panel-backdrop").hidden = true;
    if (lastFocus && lastFocus.isConnected)
      lastFocus.focus({ preventScroll: true });
    else $("game").focus({ preventScroll: true });
  }
  const nearMerchant = () => state.zone === 0 && C.dist(state.player, npc("merchant")) < 85;
  function walkToShop() {
    if (state.zone !== 0) return;
    closePanel();
    resume();
    const merchant = npc("merchant");
    const result = run("move", { x: merchant.x + 48, y: merchant.y });
    shopVisit = result.ok;
    if (shopVisit) toast(`กำลังเดินไปหา${merchant.name} · ถึงแล้วจะเปิดร้านให้`);
  }
  // Original compact item illustrations; each icon shares the same 32px canvas.
  function artIcon(id) {
    const ink = '#273143';
    const bottle = (color) => `<path d="M12 3h8v5l-2 3c6 3 8 15 2 18h-8c-6-3-4-15 2-18l-2-3z" fill="#e1e7db"/><path d="M9 18c-1 5 0 9 4 10h6c4-1 5-5 4-10z" fill="${color}"/><path d="M12 3h8v4h-8z" fill="#b79b6c"/><path d="M12 13l-2 8" stroke="#fff" stroke-width="2" opacity=".75"/><path d="M16 25v-8c-4-3-6 1-1 3m1 2c6-4 7 1 0 2" fill="none" stroke="#edf2d6" stroke-width="1.5"/>`;
    const blade = (color) => `<path d="M5 27l4-6 3 3-4 6z" fill="#785238"/><path d="M6 24l5-2m-3 5l4-2" stroke="#d6b476" stroke-width="1.5"/><path d="M9 22C17 15 21 11 25 3c4 7-1 16-13 22z" fill="${color}"/><path d="M12 23c8-6 13-13 13-18" fill="none" stroke="#f7eed7"/><path d="M9 20l5 5" stroke="#d5b05c" stroke-width="2"/>`;
    const armor = (color) => `<path d="M10 6l4-3h4l4 3 6 2-3 9-4-2 2 13H9l2-13-4 2-3-9z" fill="${color}"/><path d="M13 4l3 6 3-6M9 11l3 2m8 0l3-2M12 22h8" stroke="#e6d7b1"/><path d="M15 12h3v12h-3z" fill="#fff" opacity=".15"/>`;
    const book = (color) => `<path d="M6 4h20v24H6z" fill="${color}"/><path d="M4 5h4v24H4z" fill="#795d44"/><path d="M9 7h14v18H9z" fill="#eedcbd"/><path d="M12 11h8m-8 4h8m-8 4h5" stroke="#927b67"/><path d="M22 6h3v9l-1.5-2-1.5 2z" fill="#b6515f"/>`;
    let shape;
    if (['potion', 'ether', 'green_potion'].includes(id)) shape = bottle(D.items[id].color);
    else if (id === 'novice_cap') shape = '<ellipse cx="16" cy="23" rx="14" ry="5" fill="#d6b479"/><path d="M5 23L16 5l11 18z" fill="#d8bd83"/><path d="M9 18h14M11 14h10M13 10h6M5 23h22M16 6v17M12 12l-2 11m10-11l2 11" fill="none" stroke="#9e8455"/><path d="M3 24c7 3 19 3 26 0" fill="none" stroke="#f3e2b7" stroke-width="1.5"/><path d="M12 27l4 3 4-3" fill="none" stroke="#657c6b"/>';
    else if (id === 'cat_ears') shape = '<path d="M5 22L3 3l11 8h4L29 3l-2 19z" fill="#676475"/><path d="M7 15L6 7l7 6m7 0l6-6-1 8" fill="#e7a3b2"/><path d="M5 21c4-8 18-8 22 0v5h-4v-4c-4-5-10-5-14 0v4H5z" fill="#b1a3bf"/><path d="M8 20c4-5 13-5 17 0" fill="none" stroke="#ede1e2"/>';
    else if (id === 'silver_circlet') shape = '<path d="M4 18l3 8h18l3-8-6 2-6-7-6 7z" fill="#d7bd7b"/><path d="M10 21c-7-4-5-10-1-8-4 3 3 4 4 5m6 0c1-1 8-2 4-5 4-2 6 4-1 8" fill="none" stroke="#e6d4a2" stroke-width="2"/><path d="M16 3l5 13-5 7-5-7z" fill="#ddc589"/><path d="M16 9l3 7-3 4-3-4z" fill="#77aaa0"/><path d="M7 25h18" fill="none" stroke="#fff0c8" stroke-width="1.5"/>';
    else if (id.includes('sword') || id === 'moon_blade' || ['attack','equipment','bash'].includes(id)) shape = blade(D.items[id]?.color || '#dbe5ef');
    else if (id.includes('armor')) shape = armor(D.items[id].color);
    else if (id === 'apple') shape = '<path d="M18 7c10 0 14 12 5 20-5 4-13 4-17 1 6-4-1-10 3-16 2-3 5-5 9-5z" fill="#dfb556"/><path d="M9 24c5 2 10-3 11-9" fill="none" stroke="#f9d784" stroke-width="2"/><path d="M17 8l1-5" stroke="#806340" stroke-width="1.5"/><path d="M19 4c0-3 8-4 10-1-3 4-6 4-10 1z" fill="#769260"/>';
    else if (id === 'bronze_ring') shape = '<ellipse cx="16" cy="17" rx="10" ry="11" fill="#bb844c"/><ellipse cx="16" cy="17" rx="6" ry="7" fill="#39485e"/><path d="M8 13c2-6 11-8 15-2" fill="none" stroke="#f1d598" stroke-width="3"/><path d="M19 24l4-4" stroke="#e1b779" stroke-width="2"/>';
    else if (['moon_charm','guardian_core','jellopy','provoke'].includes(id)) { const color = D.items[id]?.color || '#c4a0de'; shape = `<path d="M16 3l10 11-4 13-12 1-6-14z" fill="${color}"/><path d="M16 3l-4 12 10 12-1-15z" fill="#fff" opacity=".35"/><path d="M4 14l8 1 9-3 5 2M12 15l-2 13" fill="none" stroke="#617080"/>`; }
    else if (['fluff','log'].includes(id)) shape = '<path d="M5 27C8 12 18 2 28 3c3 9-9 19-18 18z" fill="#e8e4d9"/><path d="M5 27L25 6M13 19v-7m4 3h7M19 12V7" fill="none" stroke="#9ba4b4"/><path d="M6 29l3-6" stroke="#d2bb8f" stroke-width="2"/>';
    else if (id === 'tree_root') shape = '<path d="M13 3h8l-3 11 9 11-4 3-8-9-5 11-6-2 8-14z" fill="#b08760"/><path d="M16 7l-2 10 10 9M11 22l-4 5" fill="none" stroke="#dfbc8c"/>';
    else if (id === 'bee_sting') shape = '<path d="M23 5l5 7-20 17-4-2z" fill="#b8c7d7"/><path d="M24 5l-3-2-8 8 8 5 6-5z" fill="#d7b467"/><path d="M9 25l15-17" stroke="#fff"/>';
    else if (id === 'inventory') shape = '<path d="M9 10V7c0-6 14-6 14 0v3" fill="none" stroke="#d8b68c" stroke-width="3"/><path d="M5 10h22l2 18H3z" fill="#bc8a60"/><path d="M4 10h24l-3 10H7z" fill="#d5ad83"/><path d="M14 17h5v7h-5z" fill="#ebd395"/><path d="M7 24h4m10 0h4" stroke="#8a6044"/>';
    else if (id === 'codex') shape = book('#7f95b9');
    else if (id === 'quest') shape = '<path d="M7 4h20l-2 5v19H6V7z" fill="#eed6aa"/><path d="M6 5h20v5H6z" fill="#b6936b"/><path d="M11 14h10m-10 4h10m-10 4h7" stroke="#997d65"/><path d="M22 21l5 3-2 4-4-1z" fill="#b55362"/>';
    else if (id === 'shop') shape = '<ellipse cx="11" cy="23" rx="8" ry="4" fill="#b9914c"/><path d="M3 19v4c0 6 16 6 16 0v-4z" fill="#d1aa5c"/><ellipse cx="11" cy="19" rx="8" ry="4" fill="#f2d58a"/><circle cx="22" cy="12" r="9" fill="#e5bd6d"/><circle cx="22" cy="12" r="6" fill="#b99048"/><path d="M22 7v10m-3-8h5m-5 6h5" stroke="#f4dca4" stroke-width="2"/>';
    else if (id === 'status') shape = '<path d="M5 29c-1-12 23-12 22 0z" fill="#aa7b76"/><path d="M11 21l5 5 5-5" fill="#f0d3b2"/><ellipse cx="16" cy="13" rx="8" ry="10" fill="#f1ccad"/><path d="M7 15V7c1-9 20-8 19 3l-2 8-3-10-5 5-1-5-6 10z" fill="#c49a62"/><path d="M12 14h1m6 0h1" stroke="#43394a" stroke-width="2"/>';
    else if (id === 'interact') shape = '<path d="M3 5h26v17H17l-7 7v-7H3z" fill="#e5dcc7"/><path d="M8 11h16M8 15h12" stroke="#8d8a99" stroke-width="2"/>';
    else if (id === 'settings') shape = '<path d="M13 3h6l1 4 4 2 4-1 3 5-3 3v4l2 3-3 5-4-1-4 2h-6l-2-4-4-2-4 1-3-5 3-3v-4l-2-3 3-5 4 1 4-2z" fill="#bdc8d8"/><circle cx="16" cy="16" r="6" fill="#556780"/><circle cx="16" cy="16" r="3" fill="#dae4ef"/>';
    else if (id === 'auto') shape = '<path d="M7 11c4-10 20-8 21 3h-5c-1-7-10-8-13-2l3 3H2l2-11zM25 21c-4 10-20 8-21-3h5c1 7 10 8 13 2l-3-3h11l-2 11z" fill="#aec9a7"/>';
    else if (id === 'first_aid') shape = '<path d="M6 5h20v24H6z" fill="#dfd9cf"/><path d="M6 5h20v5H6z" fill="#9b829c"/><path d="M13 12h6v5h5v6h-5v5h-6v-5H8v-6h5z" fill="#df8296"/>';
    else if (id === 'magnum') shape = '<path d="M15 29C-2 24 8 12 8 12c0 7 5 1 5 1s-3-7 6-12c-1 9 2 9 6 6-3 6 8 12 4 18-3 4-9 6-14 4z" fill="#d87d67"/><path d="M16 27c-7-3-5-9 1-15-1 6 7 9 4 13z" fill="#f2d283"/>';
    else shape = '<path d="M16 2l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#b7addf"/><path d="M16 6v20M6 16h20" stroke="#f7ecff"/><circle cx="16" cy="16" r="4" fill="#e1d9f9"/>';
    return `<svg class="game-icon" viewBox="0 0 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g stroke="${ink}" stroke-width=".8" stroke-linejoin="round">${shape}</g></svg>`;
  }
  const icon = (id) => `<span class="item-icon">${artIcon(id)}</span>`;
  const button = (act, label, id = "", extra = "") =>
    `<button data-act="${act}"${id ? ` data-id="${id}"` : ""} ${extra}>${label}</button>`;
  const itemMeta = (i) =>
    [
      i.type === "head" ? "ศีรษะ" : "",
      i.atk ? `ATK +${i.atk}` : "",
      i.def ? `DEF +${i.def}` : "",
      i.hp ? `ฟื้น HP ${i.hp}` : "",
      i.sp ? `ฟื้น SP ${i.sp}` : "",
      `น้ำหนัก ${i.weight}`,
    ]
      .filter(Boolean)
      .join(" · ");
  const itemRow = (id, count, actions) =>
    `<div class="item-row">${icon(id)}<div class="item-info"><b>${D.items[id].name}${count === null ? "" : ` <span class="subtle">×${count}</span>`}</b><small>${itemMeta(D.items[id])}</small></div><div class="item-actions">${actions}</div></div>`;
  function optionsBinding(selected) {
    let opts = [
      ["", "ช่องว่าง"],
      ["action:attack", "โจมตี"],
      ["action:interact", "คุย NPC"],
      ["action:auto", "Auto Battle"],
    ];
    for (const [id, d] of Object.entries(D.skills))
      if (state.skills[id]) opts.push(["skill:" + id, d.name]);
    for (const [id, d] of Object.entries(D.items))
      if (d.type === "use") opts.push(["item:" + id, d.name]);
    if (selected && !opts.some((o) => o[0] === selected))
      opts.push([
        selected,
        "ยังไม่เรียน: " + (D.skills[selected.split(":")[1]]?.name || selected),
      ]);
    return opts
      .map(
        ([v, n]) =>
          `<option value="${v}" ${v === (selected || "") ? "selected" : ""}>${esc(n)}</option>`,
      )
      .join("");
  }
  function renderPanel() {
    $("panel-title").textContent = titleNames[panel];
    const s = state,
      st = C.stats(s);
    let html = "";
    if (panel === "status") {
      html = `<p class="panel-note">${esc(jobName(s.job))} · Base Lv.${s.baseLevel} · Job Lv.${s.jobLevel} · แต้มสเตตัส <b>${s.statPoints}</b></p><div class="status-layout"><div class="paper-doll"><div class="equipment-slots">${equipmentSlots.map(([slot, name, placeholder]) => `<button class="${s.equipment[slot] ? "" : "empty-equipment"}" data-open="equipment" data-slot="${slot}" title="${name}: ${s.equipment[slot] ? D.items[s.equipment[slot]].name : "ยังไม่ได้สวมใส่"}" aria-label="เปิดอุปกรณ์ ${name}">${artIcon(s.equipment[slot] || placeholder)}</button>`).join("")}</div><canvas id="status-portrait" width="96" height="124" aria-label="ตัวละครพร้อมอาวุธและเครื่องประดับศีรษะ"></canvas><div class="job-label">${esc(jobName(s.job))}</div><div class="equipment-caption">${equipmentCaption(s)}</div></div><div>`;
      for (const [id, name] of Object.entries(D.statNames))
        html += `<div class="stat-row"><span>${name}</span><b>${s.stats[id]}</b>${button("stat", "＋", id, s.statPoints > 0 && s.stats[id] < 99 ? "" : "disabled")}</div>`;
      html += `</div></div><div class="stat-summary">${[
        ["ATK", st.atk],
        ["DEF", st.def],
        ["CRIT", st.crit + "%"],
        ["HIT", st.hit],
        ["FLEE", st.flee],
        ["ตีทุก", st.interval.toFixed(2) + "s"],
      ]
        .map(([k, v]) => `<div>${k}<b>${v}</b></div>`)
        .join("")}</div>`;
    }
    if (panel === "inventory") {
      const allItems = Object.entries(s.inventory).filter(([, count]) => count > 0);
      const items = allItems.filter(([id]) => inventoryCategory === "all" || (inventoryCategory === "equip" ? equipmentTypes.includes(D.items[id].type) : D.items[id].type === inventoryCategory));
      if (!items.some(([id]) => id === selectedInventoryItem)) selectedInventoryItem = items[0]?.[0] || null;
      html = `<div class="inventory-tabs">${[["all","ทั้งหมด"],["use","ยา"],["equip","อุปกรณ์"],["loot","ของดรอป"]].map(([category,name]) => `<button data-item-category="${category}" aria-pressed="${inventoryCategory === category}">${name}</button>`).join("")}<span class="inventory-count">${allItems.length} ชนิด</span></div><div class="inventory-grid">`;
      for (const [id, count] of items) html += `<button class="inventory-tile" data-choose-item="${id}" aria-pressed="${id === selectedInventoryItem}" aria-label="${D.items[id].name} ×${count}" title="${D.items[id].name}">${icon(id)}<span class="quantity">${count}</span></button>`;
      for (let i = items.length; i < Math.max(24, Math.ceil(items.length / 8) * 8); i++) html += '<div class="inventory-empty-slot" aria-hidden="true"></div>';
      html += `</div><div class="inventory-footer"><span>Wt. ${st.weight} / ${st.capacity}</span><span>◈ ${s.silver.toLocaleString()} ${esc(world.currency)}</span></div>`;
      if (selectedInventoryItem) {
        const id = selectedInventoryItem, i = D.items[id];
        let actions = i.type === "use" ? button("use", "ใช้", id) : equipmentTypes.includes(i.type) ? button("equip", "สวมใส่", id) : "";
        actions += button("sell", "ขาย " + Math.max(1, Math.floor(i.price / 2)) + " ◈", id);
        html += `<div class="inventory-detail">${itemRow(id, s.inventory[id], "")}<div class="item-actions">${actions}</div></div>`;
      } else html += '<p class="empty">ไม่มีไอเทมในหมวดนี้</p>';
      html += `<p class="panel-note" style="margin-top:7px">เลือกไอเทมเพื่อใช้หรือสวมใส่ · ขายได้ใกล้${esc(npc("merchant").name)}<br>น้ำหนัก 50% หยุดฟื้น HP/SP · 90% ห้ามโจมตี</p>`;
      html +=
        '<button data-open="hotbar" class="outline-button">ใส่ไอเทมหรือสกิลใน Hotbar →</button>';
    }
    if (panel === "equipment") {
      html =
        `<p class="panel-note">เปลี่ยนอาวุธหรือเครื่องประดับศีรษะ ภาพตัวละครจะเปลี่ยนตามทันที</p><div class="equipment-layout"><div class="equipment-preview"><canvas id="equipment-portrait" width="104" height="140" aria-label="ตัวละครพร้อมอุปกรณ์ที่สวมใส่"></canvas><div class="job-label">${esc(jobName(s.job))}</div><div class="equipment-caption">${equipmentCaption(s)}</div></div><div class="equipment-list">`;
      for (const [slot, name] of equipmentSlots) {
        html += `<div class="shop-title">${name}</div>`;
        html += s.equipment[slot]
          ? itemRow(
              s.equipment[slot],
              null,
              `<button data-act="unequip" data-slot="${slot}">ถอด</button>`,
            )
          : '<p class="subtle">ยังไม่ได้สวมใส่</p>';
      }
      html += '</div></div><button data-open="inventory" class="outline-button">เลือกอุปกรณ์จากกระเป๋า →</button><p class="panel-note equipment-note">อุปกรณ์มีผลกับ ATK / DEF และนับรวมในน้ำหนักกระเป๋า</p>';
    }
    if (panel === "skills") {
      html = `<p class="panel-note">${esc(jobName(s.job))} · Job Lv.${s.jobLevel} · แต้มสกิล <b>${s.skillPoints}</b><br>${esc(jobName("Novice"))} Job Lv.10 → คุย${esc(npc("guide").name)}เพื่อเป็น${esc(jobName("Swordman"))}</p>`;
      for (const [id, d] of Object.entries(D.skills))
        html += `<div class="skill-card"><span class="item-icon">${artIcon(id)}</span><div class="item-info"><b>${d.name} <span class="subtle">Lv.${s.skills[id]} / ${d.max}</span></b><small>${d.thai} · SP ${d.sp} · รอ ${d.cooldown} วินาที<br>${d.description}</small></div>${id === "first_aid" ? '<span class="subtle">เริ่มต้น</span>' : button("learn", "เรียน", id, s.job === "Swordman" && s.skillPoints > 0 && s.skills[id] < d.max ? "" : "disabled")}</div>`;
      html +=
        '<button data-open="hotbar" class="outline-button">จัดสกิลลง Hotbar →</button>';
    }
    if (panel === "quest" || panel === "npc") {
      if (panel === "npc")
        html = `<p class="panel-note">${esc(npc("guide").dialogue)}</p><div class="settings-actions">${button("job", s.job === "Swordman" ? `คุณเป็น${esc(jobName("Swordman"))}แล้ว` : `เปลี่ยนอาชีพ → ${esc(jobName("Swordman"))}`, "", s.job === "Novice" && s.jobLevel >= 10 ? 'class="primary"' : "disabled")}</div>`;
      D.quests.forEach((q, i) => {
        html += `<article class="quest-detail ${i < s.quest ? "done" : ""}"><div class="eyebrow">${i < s.quest ? "สำเร็จแล้ว" : i === s.quest ? "ภารกิจปัจจุบัน" : "บทต่อไป"} · 0${i + 1}</div><h3>${q.title}</h3><p>${q.text} (${Math.min(s.kills[q.kind] || 0, q.count)} / ${q.count})</p><p>รางวัล ${q.silver} ${esc(world.currency)} · ${q.exp} EXP</p>${i === s.quest ? button("quest", s.questActive ? `รับรางวัลจาก${esc(npc("guide").name)}` : `รับภารกิจจาก${esc(npc("guide").name)}`) : i < s.quest ? "✓ สำเร็จแล้ว" : ""}</article>`;
      });
      if (s.quest >= D.quests.length)
        html +=
          '<p class="panel-note">✦ บทแรกของคุณจบลงแล้ว แต่โลกนี้ยังรอให้คุณออกสำรวจเสมอ</p>';
    }
    if (panel === "shop") {
      const near = nearMerchant();
      const location = near
        ? `อยู่ใกล้${npc("merchant").name}แล้ว · เลือกซื้อของได้`
        : s.zone === 0
          ? `ยังอยู่ไกล · ต้องเดินเข้าใกล้${npc("merchant").name}ก่อนซื้อขาย`
          : `กลับ${D.maps[0].name}ผ่านประตูแผนที่ แล้วไปหา${npc("merchant").name}เพื่อซื้อขาย`;
      html = `<p class="panel-note">${esc(npc("merchant").dialogue)}<br>เงิน ${s.silver} ${esc(world.currency)}<br>${esc(location)}</p>`;
      if (!near && s.zone === 0)
        html += `<div class="settings-actions">${button("walk-shop", `เดินไปหา${esc(npc("merchant").name)}`, "", 'class="primary"')}</div>`;
      const groups = [["weapon", "อาวุธ"], ["use", "ยาและเสบียง"], ["head", "เครื่องศีรษะ"], ["armor", "เกราะ"], ["accessory", "เครื่องประดับ"]];
      for (const [type, title] of groups) {
        html += `<div class="shop-title">${title}</div>`;
        for (const [id, d] of Object.entries(D.items)) {
          if (d.type !== type) continue;
          const reason = !near ? location : s.silver < d.price
            ? `${world.currency}ไม่เพียงพอ`
            : st.weight + d.weight > st.capacity ? "น้ำหนักเกินความจุ" : "";
          const unavailable = reason ? `disabled title="${esc(reason)}"` : "";
          const explanation = near && reason ? `<small class="shop-reason">${esc(reason)}</small>` : "";
          html += itemRow(id, null, button("buy", `ซื้อ · ${d.price} ${esc(world.currency)}`, id, unavailable) + explanation);
        }
      }
      html +=
        '<button data-open="inventory" class="outline-button">เปิดกระเป๋าเพื่อขายของ →</button>';
    }
    if (panel === "hotbar") {
      html =
        '<p class="panel-note">เลือกสกิลหรือไอเทมในแต่ละช่อง แล้วกดปุ่ม 1–9 เพื่อเรียกใช้ การจัดช่องจะบันทึกไปพร้อมเซฟ</p>';
      s.hotbar.forEach(
        (v, i) =>
          (html += `<div class="bind-row"><label for="bind-value-${i}">ช่อง <kbd>${i + 1}</kbd></label><select id="bind-value-${i}" data-bind="${i}">${optionsBinding(v)}</select></div>`),
      );
    }
    if (panel === "auto") {
      html = `<p class="panel-note">Auto จะหาเป้าหมาย เดินเข้าระยะ และใช้กฎต่อสู้เดียวกับการเล่นเอง ทำงานเฉพาะขณะหน้าเกมเปิดและไม่มีหน้าต่างเมนูทับอยู่</p><div class="settings-row"><label for="auto-potion">ใช้ยา HP เมื่อเลือดต่ำกว่า</label><select id="auto-potion">${[0, 20, 40, 60, 80, 90].map((n) => `<option value="${n}" ${s.settings.autoPotion === n ? "selected" : ""}>${n ? n + "%" : "ไม่ใช้ยา"}</option>`).join("")}</select></div><div class="settings-row"><label for="auto-skill">ใช้${esc(D.skills.bash.name)}เมื่อเรียนแล้ว</label><input type="checkbox" id="auto-skill" ${s.settings.autoSkill ? "checked" : ""}></div>`;
    }
    if (panel === "settings") {
      html = `<p class="panel-note">ความคืบหน้าเก็บในเบราว์เซอร์และที่อยู่ที่เล่นนี้ ใช้ Export เพื่อย้ายเครื่องหรือสำรองเซฟ</p><div class="settings-row"><label for="hair-select">สีผมของนักผจญภัย</label><select id="hair-select">${["น้ำตาล", "ทองเข้ม", "ดำ", "แดงอิฐ", "ทองอ่อน", "เทาอมฟ้า"].map((n, i) => `<option value="${i}" ${s.settings.hair === i ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="settings-actions">${button("save", "บันทึกเกม")}${button("export", "Export Save")}${button("import", "Import Save")}</div><p class="panel-note">ใช้เซฟเดิมต่อในโลก${esc(world.title)}ได้ • อาวุธ หมวก อาชีพ และภารกิจเดิมยังอยู่ครบ</p><hr class="section-rule"><p class="panel-note">เริ่มต้นการผจญภัยใหม่จะล้างความคืบหน้าปัจจุบัน ควร Export ไว้ก่อน</p>${button("reset", "เริ่มเกมใหม่", "", 'class="danger"')}`;
    }
    if (panel === "codex") {
      html =
        `<p class="panel-note">${esc(world.intro)}</p><p class="panel-note">สิ่งมีชีวิตแห่งลุ่มน้ำและป่าหิมพานต์ · สมดุลสำหรับการผจญภัยคนเดียว</p>`;
      for (const [id, m] of Object.entries(D.monsters))
        html += `<div class="item-row"><span class="item-icon" style="color:${m.color}">${m.boss ? "◆" : "●"}</span><div class="item-info"><b>${m.name} · Lv.${m.level}</b><small>HP ${m.hp} · ATK ${m.atk} · DEF ${m.def}<br>EXP ${m.exp} / Job EXP ${m.jexp} · ของดรอป ${D.items[m.drop].name}<br>${esc(m.description)}</small></div></div>`;
      html +=
        '<button data-open="map" class="outline-button">ดูเส้นทางทั้งสามแผนที่ →</button>';
    }
    if (panel === "map")
      html =
        '<p class="panel-note">เดินไปที่ซุ้มประตูริมแผนที่เพื่อเดินทาง ทุกแผนที่ย้อนกลับได้</p>' +
        D.maps
          .map(
            (m, i) =>
              `<article class="quest-detail"><div class="eyebrow">เส้นทาง 0${i + 1}${s.zone === i ? " · คุณอยู่ที่นี่" : ""}</div><h3>${esc(m.name)}</h3><p>${[...new Set(m.mobs)].map((id) => D.monsters[id].name).join(" · ")}</p></article>`,
          )
          .join("");
    if (panel === "log")
      html = s.log.length
        ? s.log.map((t) => `<div class="log-line">${esc(t)}</div>`).join("")
        : '<p class="empty">ทุกการผจญภัยมีเรื่องราว • ออกไปเริ่มเรื่องของคุณ</p>';
    if (panel === "help")
      html = `<div class="help-list"><p>${esc(world.intro)}</p><p><kbd>WASD / ลูกศร</kbd> เดิน · คลิกพื้นเพื่อเดินไปตำแหน่งนั้น</p><p><kbd>SPACE</kbd> เลือกศัตรูใกล้สุดและเข้าต่อสู้ · คลิกตัวมอนสเตอร์เพื่อเลือกเอง</p><p><kbd>1–9</kbd> ใช้ Hotbar · <kbd>H</kbd> ใช้ยา HP · <kbd>F</kbd> Auto Battle</p><p><kbd>E</kbd> คุย NPC ใกล้ตัว · <kbd>I</kbd> กระเป๋า · <kbd>Q</kbd> เควสต์ · <kbd>M</kbd> แผนที่ · <kbd>Esc</kbd> ปิดเมนู</p><p>เปิดกระเป๋า → หมวดอุปกรณ์ → เลือกอาวุธหรือหมวก → สวมใส่ ภาพตัวละครในฉากและหน้าต่างอุปกรณ์จะเปลี่ยนตาม ถอดได้ในเมนูอุปกรณ์</p><p>คุย${esc(npc("guide").name)}ที่${esc(npc("guide").thai)}เพื่อรับและส่งเควสต์ เมื่อ Job Lv.10 กลับมาฝากตัวเป็น${esc(jobName("Swordman"))}และเรียนวิชาดาบ</p><p>ซุ้มทางเดินอยู่ริมแผนที่ซ้ายและขวา เดินจาก${esc(D.maps[0].name)}สู่${esc(D.maps[1].name)}และ${esc(D.maps[2].name)} ${esc(npc("healer").name)}ที่${esc(npc("healer").thai)}ฟื้น HP/SP ฟรี เมื่อล้มจะกลับท่าน้ำพร้อมความคืบหน้าเดิม</p><p>เปิดเมนูหรือเปลี่ยนไปแท็บอื่น เกมจะพักให้คุณ บันทึกอัตโนมัติทุก 10 วินาที และควร Export Save เป็นระยะ</p></div>`;
    $("side-panel").innerHTML = html;
    if ($("status-portrait")) R.portrait($("status-portrait"), s);
    if ($("equipment-portrait")) R.portrait($("equipment-portrait"), s);
  }
  function bindingInfo(value) {
    if (!value) return { label: "ว่าง", icon: "", color: "#879c7f" };
    const [kind, id] = value.split(":");
    if (kind === "skill") {
      const d = D.skills[id];
      return {
        label: d.name,
        icon: artIcon(id),
        color: d.color,
        locked: !state.skills[id],
        cooldown: (state.cooldowns[id] || 0) / d.cooldown,
      };
    }
    if (kind === "item") {
      const d = D.items[id];
      return {
        label: d.name,
        icon: artIcon(id),
        color: d.color,
        stock: state.inventory[id] || 0,
      };
    }
    return {
      label: { attack: "โจมตี", interact: "คุย NPC", auto: "Auto" }[id],
      icon: artIcon(id),
      color: "#d6c18e",
    };
  }
  function updateHotbar() {
    const sig = JSON.stringify([state.hotbar, state.inventory, state.skills]);
    if (sig !== hotSignature) {
      hotSignature = sig;
      $("hotbar-slots").innerHTML = state.hotbar
        .map((v, i) => {
          const d = bindingInfo(v);
          return `<button class="hot-slot ${d.locked ? "locked" : ""}" data-hot="${i}" title="${d.label} · ปุ่ม ${i + 1}" aria-label="ช่อง ${i + 1}: ${d.label}"><small>${i + 1}</small>${d.stock === undefined ? "" : `<span class="stock">${d.stock}</span>`}<span class="glyph" style="color:${d.color}">${d.icon}</span><span class="slot-label">${d.label}</span><span class="cooldown" id="cool-${i}"></span></button>`;
        })
        .join("");
    }
    state.hotbar.forEach(
      (v, i) =>
        ($("cool-" + i).style.height =
          Math.max(0, Math.min(1, bindingInfo(v).cooldown || 0)) * 100 + "%"),
    );
  }
  function updateHUD() {
    const s = state,
      st = C.stats(s),
      map = D.maps[s.zone];
    $("hero-name").textContent = jobName(s.job);
    $("job-level").textContent = `Job Lv.${s.jobLevel}`;
    $("silver").textContent = s.silver.toLocaleString();
    $("level").textContent = `Base Lv.${s.baseLevel}`;
    for (const [key, value, max] of [
      ["hp", s.player.hp, st.maxHp],
      ["sp", s.player.sp, st.maxSp],
    ]) {
      $(key + "-val").textContent = `${Math.ceil(value)} / ${max}`;
      $(key + "-bar").style.width = Math.max(0, value / max) * 100 + "%";
    }
    $("exp-val").textContent = `${s.exp} / ${C.baseNeed(s)}`;
    $("exp-bar").style.width =
      Math.min(100, (s.exp / C.baseNeed(s)) * 100) + "%";
    $("jexp-val").textContent = `${s.jexp} / ${C.jobNeed(s)}`;
    $("jexp-bar").style.width =
      Math.min(100, (s.jexp / C.jobNeed(s)) * 100) + "%";
    $("weight-val").textContent = `${st.weight} / ${st.capacity}`;
    $("weight-val").style.color =
      st.weight >= st.capacity * 0.5 ? "#e1ab84" : "";
    $("zone-number").textContent = "0" + (s.zone + 1);
    $("zone-label").textContent = map.name;
    $("zone-subtitle").textContent = map.subtitle;
    $("world-caption").textContent = map.thai;
    $("map-location").textContent = map.name;
    $("coordinates").textContent =
      `X:${Math.round(s.player.x)} Y:${Math.round(s.player.y)}`;
    $("mob-count").textContent =
      s.monsters.filter((m) => !m.dead).length + " มอนสเตอร์";
    $("clock").textContent =
      `${String(Math.floor(s.clock / 60)).padStart(2, "0")}:${String(Math.floor(s.clock % 60)).padStart(2, "0")}`;
    $("combat-mode").textContent = s.auto ? "ON" : "OFF";
    document
      .querySelector('[data-action="auto"]')
      .setAttribute("aria-pressed", String(s.auto));
    const q = D.quests[s.quest];
    $("quest-title").textContent = q ? q.title : `ผู้กล้าแห่ง${world.title}`;
    $("quest-description").textContent = q
      ? s.questActive
        ? q.text
        : `คุย${npc("guide").name}เพื่อรับภารกิจ`
      : "คุณทำภารกิจทั้งหมดสำเร็จแล้ว";
    $("quest-count").textContent = q
      ? `${Math.min(s.kills[q.kind] || 0, q.count)} / ${q.count} · ${q.silver} ${world.currency}`
      : "❧ การเดินทางยังดำเนินต่อ";
    $("quest-progress-bar").style.width = q
      ? Math.min(100, ((s.kills[q.kind] || 0) / q.count) * 100) + "%"
      : "100%";
    const target = s.monsters.find((m) => m.uid === s.target && !m.dead);
    $("target-box").hidden = !target;
    if (target) {
      const d = D.monsters[target.kind];
      $("target-box").innerHTML =
        `${d.name} · ${Math.ceil(target.hp)} / ${d.hp}<div class="target-meter"><i style="width:${Math.max(0, (target.hp / d.hp) * 100)}%"></i></div>`;
    }
    R.minimap($("minimap"), s);
    R.portrait($("portrait"), s);
    if ($("status-portrait")) R.portrait($("status-portrait"), s);
    if ($("equipment-portrait")) R.portrait($("equipment-portrait"), s);
    updateHotbar();
    updateSaveLabel();
  }
  function interact() {
    if (state.zone !== 0) {
      toast("ไม่มี NPC ใกล้ตัว • เดินกลับหมู่บ้าน");
      return;
    }
    const n = D.npcs.find((n) => C.dist(state.player, n) < 85);
    if (!n) {
      toast("เดินเข้าใกล้ NPC แล้วกด E");
      return;
    }
    if (n.id === "healer") run("heal");
    else openPanel(n.id === "merchant" ? "shop" : "npc");
  }
  function attackNearest() {
    let m = state.monsters.find((m) => m.uid === state.target && !m.dead);
    if (!m)
      m = state.monsters
        .filter((m) => !m.dead)
        .sort((a, b) => C.dist(a, state.player) - C.dist(b, state.player))[0];
    if (m) run("target", { target: m.uid });
    else toast("รอมอนสเตอร์เกิดใหม่สักครู่");
  }
  function useSlot(slot) {
    const v = state.hotbar[slot];
    if (!v) {
      toast("ช่องนี้ว่าง • เลือกจัด Hotbar เพื่อใส่สกิลหรือไอเทม");
      return;
    }
    const [kind, id] = v.split(":");
    if (kind === "skill") run("skill", { id });
    else if (kind === "item") run("use", { id });
    else if (id === "attack") attackNearest();
    else if (id === "interact") interact();
    else if (id === "auto") run("auto");
  }
  function worldPoint(canvas, event) {
    const b = canvas.getBoundingClientRect();
    if (canvas.id === "game") {
      const camera = R.view(canvas, state);
      return {
        x: (event.clientX - b.left) / camera.scale + camera.x,
        y: (event.clientY - b.top) / camera.scale + camera.y,
      };
    }
    return {
      x: ((event.clientX - b.left) / b.width) * 960,
      y: ((event.clientY - b.top) / b.height) * 560,
    };
  }
  $("game").addEventListener("pointerdown", (event) => {
    if (panel) return;
    paused = false;
    $("game").focus({ preventScroll: true });
    const p = worldPoint($("game"), event);
    const m = state.monsters
      .filter(
        (m) =>
          !m.dead &&
          C.dist(m, { x: p.x, y: p.y + 15 }) <
            (D.monsters[m.kind].boss ? 50 : 35),
      )
      .sort((a, b) => C.dist(a, p) - C.dist(b, p))[0];
    if (m) run("target", { target: m.uid });
    else {
      if (state.zone === 0) {
        const n = D.npcs.find((n) => C.dist(n, { x: p.x, y: p.y + 18 }) < 32);
        if (n && C.dist(state.player, n) < 85) {
          if (n.id === "healer") run("heal");
          else openPanel(n.id === "merchant" ? "shop" : "npc");
          return;
        }
      }
      run("move", p);
    }
  });
  $("minimap").addEventListener("pointerdown", (event) =>
    run("move", worldPoint($("minimap"), event)),
  );
  function toggleUI() {
    const hidden = document.body.classList.toggle("hud-hidden");
    const button = document.querySelector('[data-action="toggle-ui"]');
    button.setAttribute("aria-pressed", String(!hidden));
    button.setAttribute("aria-label", hidden ? "แสดง UI" : "ซ่อน UI");
    button.title = hidden ? "แสดง UI (V)" : "ซ่อน UI (V)";
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled)
        await document.documentElement.requestFullscreen();
      else
        toast("เบราว์เซอร์นี้ไม่รองรับโหมดเต็มจอ • เกมยังใช้เต็มหน้าต่างได้");
    } catch {
      toast("เปิดโหมดเต็มจอไม่ได้ • ลองใช้ปุ่ม F11 ของเบราว์เซอร์");
    }
  }
  document.addEventListener("fullscreenchange", () => {
    const active = Boolean(document.fullscreenElement);
    const button = document.querySelector('[data-action="fullscreen"]');
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      active ? "ออกจากโหมดเต็มจอ" : "เข้าโหมดเต็มจอ",
    );
    button.title = active ? "ออกจากเต็มจอ" : "เต็มจอ";
    button.querySelector("span").textContent = active ? "ย่อจอ" : "เต็มจอ";
  });
  document.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b) return;
    if (b.dataset.chooseItem) {
      selectedInventoryItem = b.dataset.chooseItem;
      renderPanel();
      $("side-panel").querySelector(`[data-choose-item="${selectedInventoryItem}"]`)?.focus();
      return;
    }
    if (b.dataset.itemCategory) {
      inventoryCategory = b.dataset.itemCategory;
      renderPanel();
      $("side-panel").querySelector(`[data-item-category="${inventoryCategory}"]`)?.focus();
      return;
    }
    if (b.dataset.panel) {
      openPanel(b.dataset.panel);
      return;
    }
    if (b.dataset.open) {
      openPanel(b.dataset.open);
      return;
    }
    if (b.dataset.hot !== undefined) {
      useSlot(Number(b.dataset.hot));
      return;
    }
    if (b.dataset.action) {
      const a = b.dataset.action;
      if (a === "close") closePanel();
      if (a === "save") save(true);
      if (a === "auto") run("auto");
      if (a === "toggle-ui") toggleUI();
      if (a === "fullscreen") toggleFullscreen();
      return;
    }
    const a = b.dataset.act;
    if (!a) return;
    if (a === "save") {
      save(true);
      return;
    }
    if (a === "export") {
      exportSave();
      return;
    }
    if (a === "import") {
      $("import-file").click();
      return;
    }
    if (a === "walk-shop") {
      walkToShop();
      return;
    }
    if (a === "reset") {
      if (
        confirm(
          "เริ่มเกมใหม่และแทนที่เซฟปัจจุบัน? หากต้องการเก็บความคืบหน้า ให้ยกเลิกแล้ว Export ก่อน",
        )
      ) {
        state = C.createState();
        shopVisit = false;
        protectStorage = false;
        hotSignature = "";
        keys.clear();
        save();
        closePanel();
        updateHUD();
        toast("การเดินทางครั้งใหม่เริ่มแล้ว");
      }
      return;
    }
    run(a, { id: b.dataset.id, slot: b.dataset.slot, qty: 1 });
  });
  document.addEventListener("change", (event) => {
    const el = event.target;
    if (el.dataset.bind !== undefined) {
      const result = C.act(state, "bind", {
        slot: Number(el.dataset.bind),
        value: el.value || null,
      });
      if (!result.ok) {
        toast(result.message);
        renderPanel();
      }
      hotSignature = "";
      updateHUD();
    } else if (el.id === "hair-select") {
      state.settings.hair = Number(el.value);
      updateHUD();
    } else if (el.id === "auto-potion")
      state.settings.autoPotion = Number(el.value);
    else if (el.id === "auto-skill") state.settings.autoSkill = el.checked;
  });
  $("import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error("ไฟล์เซฟใหญ่เกินกำหนด");
      loadSave(await file.text());
    } catch (e) {
      toast(e.message || "ไฟล์เซฟไม่ถูกต้อง");
    }
    event.target.value = "";
  });
  $("panel-backdrop").addEventListener("click", closePanel);
  const movement = {
    w: [0, -1],
    a: [-1, 0],
    s: [0, 1],
    d: [1, 0],
    ArrowUp: [0, -1],
    ArrowLeft: [-1, 0],
    ArrowDown: [0, 1],
    ArrowRight: [1, 0],
  };
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePanel();
      keys.clear();
      return;
    }
    if (panel) {
      if (event.key === "Tab") {
        const focusable = [
          ...$("panel-window").querySelectorAll(
            "button:not(:disabled),select,input",
          ),
        ];
        const first = focusable[0],
          end = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          end.focus();
        } else if (!event.shiftKey && document.activeElement === end) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (event.key === " " && event.target.closest("button")) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (movement[key]) {
      event.preventDefault();
      shopVisit = false;
      keys.add(key);
      return;
    }
    if (event.repeat) return;
    if (key === " ") {
      event.preventDefault();
      attackNearest();
    } else if (/^[1-9]$/.test(key)) useSlot(Number(key) - 1);
    else if (key === "h") run("use", { id: "potion" });
    else if (key === "f") run("auto");
    else if (key === "e") interact();
    else if (key === "i") openPanel("inventory");
    else if (key === "q") openPanel("quest");
    else if (key === "m") openPanel("map");
    else if (key === "v") toggleUI();
  });
  document.addEventListener("keyup", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!movement[key]) return;
    keys.delete(key);
    if (!keys.size && !state.target) state.destination = null;
  });
  function suspend() {
    shopVisit = false;
    keys.clear();
    state.destination = null;
    state.target = null;
    paused = true;
    $("pause-banner").hidden = false;
    save();
  }
  function resume() {
    paused = false;
    last = performance.now();
    $("pause-banner").hidden = true;
  }
  window.addEventListener("blur", suspend);
  window.addEventListener("focus", resume);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspend();
    else resume();
  });
  window.addEventListener("pagehide", () => save());
  function frame(time) {
    const dt = Math.max(0, Math.min(0.1, (time - (last || time)) / 1000));
    last = time;
    if (!paused && !document.hidden && !panel) {
      if (keys.size) {
        let dx = 0,
          dy = 0;
        for (const k of keys) {
          dx += movement[k][0];
          dy += movement[k][1];
        }
        if (dx || dy) {
          const len = Math.hypot(dx, dy);
          C.act(state, "move", {
            x: state.player.x + (dx / len) * 25,
            y: state.player.y + (dy / len) * 25,
          });
        } else state.destination = null;
      }
      C.tick(state, dt);
      if (
        !keys.size &&
        state.destination &&
        C.dist(state.player, state.destination) < 2
      )
        state.destination = null;
      if (Math.abs(state.player.y - 280) < 48) {
        if (state.player.x > 904 && state.zone < 2)
          run("travel", { direction: 1 });
        else if (state.player.x < 56 && state.zone > 0)
          run("travel", { direction: -1 });
      }
      if (shopVisit && (state.zone !== 0 || !state.destination)) {
        shopVisit = false;
        if (nearMerchant()) openPanel("shop");
      }
    }
    R.draw($("game"), state);
    hudTime += dt;
    saveTime += dt;
    if (hudTime > 0.12) {
      updateHUD();
      hudTime = 0;
    }
    if (saveTime > 10) {
      save();
      saveTime = 0;
    }
    requestAnimationFrame(frame);
  }
  window.BCGame = {
    get state() {
      return state;
    },
    loadSave,
    save,
    openPanel,
  };
  document.querySelectorAll(".menu-grid [data-panel]").forEach((button) => {
    const name = button.dataset.panel;
    button.title = titleNames[name];
    button.setAttribute("aria-label", titleNames[name]);
    button.innerHTML = artIcon(name) + `<span class="menu-label">${titleNames[name]}</span>`;
  });
  document.title = `${world.title} · ${world.subtitle}`;
  $("world-title").textContent = world.title;
  $("world-tagline").textContent = world.subtitle;
  $("currency-name").textContent = world.currency;
  $("release-label").textContent = `รุ่น ${world.release}`;
  document.querySelector(".brand").setAttribute("aria-label", `${world.title} หน้าแรก`);
  updateHUD();
  requestAnimationFrame(frame);
  if (storageError) setTimeout(() => toast(storageError), 100);
  else
    setTimeout(
      () => toast(`ยินดีต้อนรับสู่${world.title} • คุย${npc("guide").name}เพื่อรับภารกิจแรก`),
      500,
    );
})();
