(function () {
  "use strict";
  const D = window.BCData,
    C = window.BCCore,
    SkillRules = window.BCSkillRules,
    SwordRules = window.BCSwordRules,
    R = window.BCRender,
    Clock = window.BCSimulationClock,
    $ = (id) => document.getElementById(id);
  const world = D.world,
    npc = (id) => D.npcs.find((person) => person.id === id);
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
    hudTime = 0,
    lastSaveAt = Date.now(),
    pumping = false,
    catchupTimer = null,
    manualDestination = null,
    toastTimer,
    hotSignature = "",
    selectedInventoryItem = "potion",
    inventoryCategory = "all",
    shopWeaponType = "",
    skillsTab = "current",
    skillAllocation = null,
    selectedTreeSkill = null,
    codexTab = "world",
    catalogCollection = "regular",
    catalogType = "all",
    catalogStatus = "all",
    catalogWeaponType = "all",
    catalogGrade = "all",
    catalogPathsOpen = false,
    catalogSearch = "",
    shopVisit = false,
    guideVisit = false,
    questBlockNotice = "",
    lastFocus = null,
    protectStorage = false,
    storageError = "";
  const keys = new Set();
  const tradeQuantities = new Map();
  const numberText = value => Number(value).toLocaleString("en-US",{maximumFractionDigits:1});
  const tradeQuantity = value => /^\d+$/.test(String(value).trim()) ? Number(value) : NaN;
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
  const simulation = Clock.create(Date.now());
  function clearManualMovement() {
    keys.clear();
    if (manualDestination && state.destination === manualDestination) state.destination = null;
    manualDestination = null;
  }
  function readyForAction() {
    if (pumping) return true;
    const result = pump(Date.now());
    if (!result.behind) return true;
    toast("กำลังคำนวณการฟาร์มที่ค้างอยู่ • รอสักครู่แล้วสั่งใหม่");
    return false;
  }
  function toast(message) {
    if (!message) return;
    $("toast").textContent = message;
    $("toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 3600);
  }
  function save(manual = false) {
    if (manual && !readyForAction()) return false;
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
      lastSaveAt = Date.now();
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
    if (!readyForAction()) return;
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
    if (!readyForAction()) return false;
    const next = C.deserialize(text);
    codexTab = "world";
    catalogCollection = "regular";
    catalogType = "all";
    catalogStatus = "all";
    catalogWeaponType = "all";
    catalogGrade = "all";
    catalogPathsOpen = false;
    catalogSearch = "";
    shopVisit = false;
    guideVisit = false;
    questBlockNotice = "";
    skillAllocation = null;
    selectedTreeSkill = null;
    tradeQuantities.clear();
    state = next;
    simulation.reset(Date.now());
    clearManualMovement();
    protectStorage = false;
    hotSignature = "";
    save();
    updateHUD();
    if (panel) renderPanel();
    toast(next.swordMigration?.refundedPoints ? `นำเข้าเซฟสำเร็จ · คืนแต้มสกิลนักดาบ ${next.swordMigration.refundedPoints} แต้ม จัดใหม่ได้ในผังสกิล` : "นำเข้าเซฟสำเร็จ");
  }
  function run(action, p = {}) {
    if (!readyForAction()) return { ok: false, message: "กำลังคำนวณการฟาร์มที่ค้างอยู่" };
    if (["move", "target", "auto", "travel"].includes(action)) {
      shopVisit = false;
      guideVisit = false;
    }
    const result = C.act(state, action, p);
    if (result.message) toast(result.message);
    updateHUD();
    if (panel) renderPanel();
    if (panel === "skills" && ["learn", "skill"].includes(action)) {
      const learned = $("side-panel").querySelector(`[data-act="${action}"][data-id="${p.id}"]`);
      const focus = learned && !learned.disabled ? learned : $("side-panel").querySelector(`[data-skills-tab="${skillsTab}"]`);
      focus?.focus({ preventScroll: true });
    }
    return result;
  }
  const questPhaseNames = {
    idle: "พร้อมเริ่ม", starting: "เริ่มเดินทาง", accepting: "รับภารกิจ",
    traveling: "เดินทาง", fighting: "ต่อสู้", waiting: "รอมอนสเตอร์",
    returning: "กลับส่งภารกิจ", healing: "ฟื้นพลัง", blocked: "หยุดเพื่อเตรียมตัว",
    complete: "เควสต์หลักสำเร็จ",
  };
  function questAutoCard(s) {
    const status = C.autoQuestStatus(s), complete = s.quest >= D.quests.length;
    return `<section class="quest-auto-card" aria-label="ทำเควสต์หลักอัตโนมัติ"><h3>ทำเควสต์หลักอัตโนมัติ</h3><div class="quest-auto-panel-status" role="status" aria-live="polite">${esc(questPhaseNames[status.phase] || "พร้อมเริ่ม")}${status.message ? ` · ${esc(status.message)}` : ""}</div><p class="panel-note">รับภารกิจ เดินทาง ต่อสู้ และกลับส่งให้ครูอิน ต่อเนื่องทั้ง 3 ภารกิจ โดยใช้สเตตัส อุปกรณ์ และเสบียงที่มี<br>ใช้ค่า Auto Skill / Auto Potion ที่ตั้งไว้ ฟาร์มต่อระหว่างเปิดเมนูและสลับแท็บ · สั่งเดินหรือโจมตีเองเพื่อหยุด Auto Quest</p>${button(status.active ? "auto-quest-stop" : "auto-quest", status.active ? "หยุดทำเควสต์อัตโนมัติ" : "ทำเควสต์หลักอัตโนมัติ", "", `${complete && !status.active ? "disabled" : ""} aria-pressed="${status.active}" class="${status.active ? "danger" : "primary"}"`)}</section>`;
  }
  function updateQuestAutoUI() {
    const status = C.autoQuestStatus(state), phase = questPhaseNames[status.phase] || "พร้อมเริ่ม";
    const hud = $("quest-auto-status"), toggle = $("quest-auto-toggle");
    const message = `${phase}${status.message ? ` · ${status.message}` : ""}`;
    if (hud.textContent !== message) hud.textContent = message;
    hud.title = hud.textContent;
    hud.dataset.phase = status.phase;
    toggle.dataset.act = status.active ? "auto-quest-stop" : "auto-quest";
    toggle.textContent = status.active ? "หยุด Auto Quest" : "ทำเควสต์หลักอัตโนมัติ";
    toggle.setAttribute("aria-pressed", String(status.active));
    toggle.disabled = !status.active && state.quest >= D.quests.length;
    const panelStatus = $("side-panel").querySelector(".quest-auto-panel-status");
    if (panelStatus && panelStatus.textContent !== message) panelStatus.textContent = message;
    if (status.active || status.phase === "idle") questBlockNotice = "";
  }
  function notifyQuestBlock() {
    const status = C.autoQuestStatus(state);
    if (status.phase !== "blocked" || panel) return;
    const notice = `${status.questIndex}:${status.message}`;
    if (notice === questBlockNotice) return;
    questBlockNotice = notice;
    openPanel("quest");
    toast(status.message);
  }
  function toggleQuestAuto(action) {
    const starting = action === "auto-quest" && !C.autoQuestStatus(state).active;
    shopVisit = false;
    guideVisit = false;
    keys.clear();
    if (starting) {
      closePanel();
      resume();
    }
    const result = run(action);
    if (starting && result.ok) save();
    if (!panel) $("game").focus({ preventScroll: true });
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
    ["weapon", "อาวุธ", "training_stick"],
    ["armor", "เกราะ", "cloth_armor"],
    ["accessory", "เครื่องประดับ", "bronze_ring"],
  ];
  const equipmentTypes = equipmentSlots.map(([slot]) => slot);
  const weaponTypeName = (item) => D.weaponTypes?.[item?.weaponType]?.name || "";
  const classInfo = (s) => D.classes[s.classId];
  const className = (s) => classInfo(s).name;
  const classLabel = (s) => `Class ${classInfo(s).tier} · Job Lv.${s.jobLevel}`;
  const compatibleClasses = (type) => Object.values(D.classes)
    .filter((d) => d.weaponType === type)
    .map((d) => `${d.name} (Class ${d.tier})`)
    .join(" / ");
  const equipmentCaption = (s) => ["head", "weapon"]
    .map((slot) => {
      const item = D.items[s.equipment[slot]], type = weaponTypeName(item);
      return `<span>${esc(item?.name || (slot === "head" ? "ไม่สวมหมวก" : "รูปลักษณ์อาวุธฝึกประจำอาชีพ"))}${type ? ` · ${esc(type)}` : ""}</span>`;
    })
    .join("");
  function openPanel(name) {
    if (!titleNames[name]) return;
    shopVisit = false;
    guideVisit = false;
    lastFocus = document.activeElement;
    panel = name;
    if (name === "skills") { skillsTab = "current"; skillAllocation = null; selectedTreeSkill = null; }
    clearManualMovement();
    $("panel-window").hidden = false;
    $("panel-backdrop").hidden = false;
    renderPanel();
    $("panel-window").querySelector('[data-action="close"]').focus();
  }
  function closePanel() {
    if (shopVisit || guideVisit) state.destination = null;
    shopVisit = false;
    guideVisit = false;
    panel = null;
    skillAllocation = null;
    selectedTreeSkill = null;
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
  const nearGuide = () => state.zone === 0 && C.dist(state.player, npc("guide")) < 85;
  function walkToGuide() {
    if (state.zone !== 0) return;
    closePanel();
    resume();
    const guide = npc("guide");
    const result = run("move", { x: guide.x + 48, y: guide.y });
    guideVisit = result.ok;
    if (guideVisit) toast(`กำลังเดินไปหา${guide.name} · ถึงแล้วจะเปิดเส้นทางอาชีพ`);
  }
  // Equipment uses the same atlas art as the character; other icons stay compact SVGs.
  function artIcon(id) {
    const item = D.items[id], art = item?.iconArt;
    if(item?.weaponType==="two_hand_sword")return `<svg class="game-icon item-art" viewBox="0 0 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M5 29l8-9" stroke="#775335" stroke-width="4"/><path d="M4 28l2 2M10 19l5 5" stroke="#d8b363" stroke-width="2.5"/><path d="M12 20L26 3l2 6-13 14z" fill="${esc(item.color||'#c4d6df')}" stroke="#3f5364" stroke-width="1"/><path d="M14 21L26 6" stroke="#fff4cf"/></svg>`;
    if (art) {
      const atlas = window.BCSiamArt?.atlases?.[art.atlas] || { width: 128, height: 64, columns: 4, rows: 2 },
        bounds = window.BCSiamArt?.iconBounds?.[art.atlas]?.[art.cell],
        cellWidth = bounds?.w ?? atlas.width / atlas.columns,
        cellHeight = bounds?.h ?? atlas.height / atlas.rows,
        sourceX = bounds?.x ?? (art.cell % atlas.columns) * cellWidth,
        sourceY = bounds?.y ?? Math.floor(art.cell / atlas.columns) * cellHeight,
        url = `assets/art/${art.atlas}.webp?v=${encodeURIComponent(world.release)}`;
      const boxes = art.complete ? [[0, 0, 32, 32, 0]] : item.weaponType === "dual_sword"
        ? [[0, 1, 23, 30, -16], [9, 1, 23, 30, 16]]
        : item.weaponType === "knuckle"
          ? [[0, 7, 21, 21, -12], [11, 4, 21, 21, 12]]
          : [[0, 0, 32, 32, 0]];
      const instances = boxes.map(([x, y, width, height, angle]) => {
        const scale = Math.min(width / cellWidth, height / cellHeight),
          w = cellWidth * scale, h = cellHeight * scale;
        return `<g transform="rotate(${angle} ${x + width / 2} ${y + height / 2})"><svg class="item-art-instance" x="${x + (width - w) / 2}" y="${y + (height - h) / 2}" width="${w}" height="${h}" viewBox="${sourceX} ${sourceY} ${cellWidth} ${cellHeight}" overflow="hidden"><image href="${esc(url)}" x="0" y="0" width="${atlas.width}" height="${atlas.height}"/></svg></g>`;
      }).join("");
      return `<svg class="game-icon item-art" data-atlas="${esc(art.atlas)}" data-cell="${art.cell}" viewBox="0 0 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${instances}</svg>`;
    }
    const ink = '#273143';
    const bottle = (color) => `<path d="M12 3h8v5l-2 3c6 3 8 15 2 18h-8c-6-3-4-15 2-18l-2-3z" fill="#e1e7db"/><path d="M9 18c-1 5 0 9 4 10h6c4-1 5-5 4-10z" fill="${color}"/><path d="M12 3h8v4h-8z" fill="#b79b6c"/><path d="M12 13l-2 8" stroke="#fff" stroke-width="2" opacity=".75"/><path d="M16 25v-8c-4-3-6 1-1 3m1 2c6-4 7 1 0 2" fill="none" stroke="#edf2d6" stroke-width="1.5"/>`;
    const blade = (color) => `<path d="M5 27l4-6 3 3-4 6z" fill="#785238"/><path d="M6 24l5-2m-3 5l4-2" stroke="#d6b476" stroke-width="1.5"/><path d="M9 22C17 15 21 11 25 3c4 7-1 16-13 22z" fill="${color}"/><path d="M12 23c8-6 13-13 13-18" fill="none" stroke="#f7eed7"/><path d="M9 20l5 5" stroke="#d5b05c" stroke-width="2"/>`;
    const armor = (color) => `<path d="M10 6l4-3h4l4 3 6 2-3 9-4-2 2 13H9l2-13-4 2-3-9z" fill="${color}"/><path d="M13 4l3 6 3-6M9 11l3 2m8 0l3-2M12 22h8" stroke="#e6d7b1"/><path d="M15 12h3v12h-3z" fill="#fff" opacity=".15"/>`;
    const book = (color) => `<path d="M6 4h20v24H6z" fill="${color}"/><path d="M4 5h4v24H4z" fill="#795d44"/><path d="M9 7h14v18H9z" fill="#eedcbd"/><path d="M12 11h8m-8 4h8m-8 4h5" stroke="#927b67"/><path d="M22 6h3v9l-1.5-2-1.5 2z" fill="#b6515f"/>`;
    let shape;
    if (D.skills[id] && id !== "first_aid") {
      const skill = D.skills[id], type = D.classes[skill.owner]?.weaponType, color = skill.color || "#bdd4c1";
      const bow = `<path d="M8 3c19 3 19 23 0 26l5-13z" fill="none" stroke="${color}" stroke-width="3"/><path d="M8 3l5 13-5 13M4 16h24m-5-4 5 4-5 4" fill="none" stroke="#f2e5bc" stroke-width="1.4"/>`;
      const fist = `<path d="M5 15V9l4-2 4 2 4-3 5 3 4 6-4 12H11z" fill="${color}"/><path d="M10 10v7m6-8v8m6-5v7M7 18l6 4h8" fill="none" stroke="#f5e2bc" stroke-width="1.5"/>`;
      if (["bow", "magic_bow"].includes(type)) shape = bow;
      else if (["knuckle", "claw"].includes(type)) shape = fist;
      else if (type === "book") shape = book(color);
      else if (["staff", "orb"].includes(type)) shape = `<path d="M8 29l10-17" stroke="#d1b377" stroke-width="3"/><circle cx="20" cy="10" r="7" fill="${color}"/><path d="M20 3l3 7-3 7-3-7z" fill="#f2e5c6"/><path d="M12 10c0 10 16 10 16 0" fill="none" stroke="#dac18a" stroke-width="1.5"/>`;
      else if (type === "dual_sword") shape = `<g transform="translate(-2 -2) scale(.85)">${blade(color)}</g><g transform="translate(34 2) scale(-.8 .8)">${blade(color)}</g>`;
      else if (type === "sword_shield") shape = `${blade(color)}<path d="M17 17l7-3 7 3-2 10-5 4-5-4z" fill="#76998a"/><path d="M24 17v10m-4-8h8" stroke="#f2d99a" stroke-width="1.5"/>`;
      else shape = blade(color);
      const badge = skill.kind === "passive"
        ? '<path d="M24 18l2 3 4 1-2 3v4l-4-1-3 2-1-4-3-2 4-2z" fill="#e0c176"/><circle cx="24" cy="24" r="2" fill="#557466"/>'
        : skill.category === "attack"
          ? '<path d="M24 18l1 4 5-1-3 4 2 5-5-3-4 3 1-5-3-3 5 1z" fill="#f4bf8d"/>'
          : '<circle cx="24" cy="24" r="7" fill="#d6e6c1"/><path d="M24 20v8m-4-4h8" stroke="#608578" stroke-width="2"/>';
      shape = `<g>${shape}</g>${badge}`;
    }
    else if (['potion', 'ether', 'green_potion'].includes(id)) shape = bottle(D.items[id].color);
    else if (id === 'novice_cap') shape = '<ellipse cx="16" cy="23" rx="14" ry="5" fill="#d6b479"/><path d="M5 23L16 5l11 18z" fill="#d8bd83"/><path d="M9 18h14M11 14h10M13 10h6M5 23h22M16 6v17M12 12l-2 11m10-11l2 11" fill="none" stroke="#9e8455"/><path d="M3 24c7 3 19 3 26 0" fill="none" stroke="#f3e2b7" stroke-width="1.5"/><path d="M12 27l4 3 4-3" fill="none" stroke="#657c6b"/>';
    else if (id === 'cat_ears') shape = '<path d="M5 22L3 3l11 8h4L29 3l-2 19z" fill="#676475"/><path d="M7 15L6 7l7 6m7 0l6-6-1 8" fill="#e7a3b2"/><path d="M5 21c4-8 18-8 22 0v5h-4v-4c-4-5-10-5-14 0v4H5z" fill="#b1a3bf"/><path d="M8 20c4-5 13-5 17 0" fill="none" stroke="#ede1e2"/>';
    else if (id === 'silver_circlet') shape = '<path d="M4 18l3 8h18l3-8-6 2-6-7-6 7z" fill="#d7bd7b"/><path d="M10 21c-7-4-5-10-1-8-4 3 3 4 4 5m6 0c1-1 8-2 4-5 4-2 6 4-1 8" fill="none" stroke="#e6d4a2" stroke-width="2"/><path d="M16 3l5 13-5 7-5-7z" fill="#ddc589"/><path d="M16 9l3 7-3 4-3-4z" fill="#77aaa0"/><path d="M7 25h18" fill="none" stroke="#fff0c8" stroke-width="1.5"/>';
    else if (id.includes('sword') || id === 'moon_blade' || ['attack','equipment'].includes(id)) shape = blade(D.items[id]?.color || '#dbe5ef');
    else if (id.includes('armor')) shape = armor(D.items[id].color);
    else if (id === 'apple') shape = '<path d="M18 7c10 0 14 12 5 20-5 4-13 4-17 1 6-4-1-10 3-16 2-3 5-5 9-5z" fill="#dfb556"/><path d="M9 24c5 2 10-3 11-9" fill="none" stroke="#f9d784" stroke-width="2"/><path d="M17 8l1-5" stroke="#806340" stroke-width="1.5"/><path d="M19 4c0-3 8-4 10-1-3 4-6 4-10 1z" fill="#769260"/>';
    else if (id === 'bronze_ring') shape = '<ellipse cx="16" cy="17" rx="10" ry="11" fill="#bb844c"/><ellipse cx="16" cy="17" rx="6" ry="7" fill="#39485e"/><path d="M8 13c2-6 11-8 15-2" fill="none" stroke="#f1d598" stroke-width="3"/><path d="M19 24l4-4" stroke="#e1b779" stroke-width="2"/>';
    else if (['moon_charm','guardian_core','jellopy'].includes(id)) { const color = D.items[id]?.color || '#c4a0de'; shape = `<path d="M16 3l10 11-4 13-12 1-6-14z" fill="${color}"/><path d="M16 3l-4 12 10 12-1-15z" fill="#fff" opacity=".35"/><path d="M4 14l8 1 9-3 5 2M12 15l-2 13" fill="none" stroke="#617080"/>`; }
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
    else shape = '<path d="M16 2l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#b7addf"/><path d="M16 6v20M6 16h20" stroke="#f7ecff"/><circle cx="16" cy="16" r="4" fill="#e1d9f9"/>';
    return `<svg class="game-icon" viewBox="0 0 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g stroke="${ink}" stroke-width=".8" stroke-linejoin="round">${shape}</g></svg>`;
  }
  const icon = (id) => `<span class="item-icon" aria-hidden="true">${artIcon(id)}</span>`;
  const button = (act, label, id = "", extra = "") =>
    `<button data-act="${act}"${id ? ` data-id="${id}"` : ""} ${extra}>${label}</button>`;
  const rarityNames = { common: "ธรรมดา", uncommon: "ไม่ธรรมดา", rare: "หายาก", boss: "เฉพาะบอส" };
  const itemTypeNames = { weapon: "อาวุธ", armor: "เกราะ", head: "ศีรษะ", accessory: "เครื่องประดับ", use: "ของใช้", loot: "ของดรอป" };
  const tierLabel = (tier) => tier ? `แนะนำ Lv.${(tier - 1) * 5 + 1}–${tier * 5}` : "";
  const gradeNames = { 1: "เริ่มต้น", 2: "รุ่นกลาง", 3: "รุ่นปลายทาง" };
  const availabilityNames = { available: "หาได้แล้ว", planned: "ยังไม่เปิด" };
  const itemLevel = (i) => i.recommendedLevel
    ? `แนะนำ Base Lv.${i.recommendedLevel.min}–${i.recommendedLevel.max}` : tierLabel(i.tier);
  function weaponRole(i) {
    const profile = D.weaponTypes[i.weaponType];
    if (!profile) return "";
    return `โจมตีปกติ ${profile.basicMagic ? "MATK" : "ATK"}/${profile.primaryStat.toUpperCase()}${i.weaponType === "magic_bow" ? " · สกิลเวท MATK/INT" : ""} · ระยะ ${profile.range} · รอบตี ${profile.interval.toFixed(2)} วินาที`;
  }
  const itemPrices = (id) => {
    const buy = window.BCItemRules.buyPrice(id), sell = window.BCItemRules.sellPrice(id);
    return `${buy === null ? "ไม่มีขายในร้าน" : `ซื้อ ${buy} ${world.currency}`} · ${sell ? `ขาย ${sell} ${world.currency}` : "ขายไม่ได้"}`;
  };
  const itemMeta = (i) =>
    [
      rarityNames[i.rarity] || "",
      i.grade ? `ขั้นอาวุธ ${i.grade} · ${gradeNames[i.grade]}` : "",
      itemLevel(i),
      itemTypeNames[i.type] || "",
      weaponTypeName(i),
      i.type === "weapon" ? `${i.weaponType === classInfo(state).weaponType ? "สวมได้" : "ต้องเป็นอาชีพ"} · ${compatibleClasses(i.weaponType)}` : "",
      i.type === "weapon" ? weaponRole(i) : "",
      i.atk ? `ATK +${i.atk}` : "",
      i.matk ? `MATK +${i.matk}` : "",
      i.def ? `DEF +${i.def}` : "",
      i.mdef ? `MDEF +${i.mdef}` : "",
      i.hp ? `ฟื้น HP ${Math.round(i.hp * C.stats(state).hpItemMultiplier)} (พื้นฐาน ${i.hp})` : "",
      i.sp ? `ฟื้น SP ${Math.round(i.sp * C.stats(state).spItemMultiplier)} (พื้นฐาน ${i.sp})` : "",
      `น้ำหนัก ${i.weight}`,
    ]
      .filter(Boolean)
      .join(" · ");
  function sourceRows(id) {
    const sources = window.BCItemRules.sourcesFor(id);
    if (!sources.length) return '<p class="source-empty">ยังไม่มีแหล่งรับเพิ่ม</p>';
    return `<ul class="item-sources">${sources.map((source) => {
      const quantity = source.min ? ` ×${source.min === source.max ? source.min : `${source.min}–${source.max}`}` : "";
      const chance = typeof source.chance === "number" ? ` · ${Number((source.chance * 100).toFixed(2))}%${quantity}` : "";
      const kind = { shop: "ร้านค้า", monster: "ดรอป", quest: "รับรางวัลภารกิจ", start: "เริ่มต้น" }[source.kind] || "แหล่งที่ได้";
      return `<li class="${source.available ? "available" : "future-source"}"><span>${kind} · ${esc(source.name)}${chance}${source.firstClear ? " · ปราบครั้งแรก" : ""}</span>${source.available ? "" : '<em>ยังไม่เปิด</em>'}</li>`;
    }).join("")}</ul>`;
  }
  const itemSources = (id) => `<details class="item-source-help"><summary>แหล่งที่ได้และโอกาสดรอป</summary>${sourceRows(id)}</details>`;
  const itemRow = (id, count, actions) =>
    `<div class="item-row" data-item="${id}"${D.items[id].weaponType ? ` data-weapon-type="${D.items[id].weaponType}"` : ""}>${icon(id)}<div class="item-info"><b>${esc(D.items[id].name)}${count === null ? "" : ` <span class="subtle">×${count}</span>`}</b><small class="item-availability availability-${window.BCItemRules.availability(id)}">${availabilityNames[window.BCItemRules.availability(id)] || ""}</small><small>${esc(itemMeta(D.items[id]))}</small><small class="item-prices">${esc(itemPrices(id))}</small>${itemSources(id)}</div><div class="item-actions">${actions}</div></div>`;
  function tradeControls(s,id,mode) {
    const raw=tradeQuantities.get(`${mode}:${id}`)??"1",q=window.BCItemRules.tradeQuote(s,id,mode,tradeQuantity(raw),C.stats(s));
    const name=mode==="buy"?"ซื้อ":"ขาย",inputId=`trade-${mode}-${id}`;
    return `<div class="trade-controls" data-trade-mode="${mode}" data-trade-id="${id}"><label for="${inputId}">จำนวน${name}</label><div class="trade-amount"><button data-trade-adjust="-1" aria-label="ลดจำนวน${name} ${esc(D.items[id].name)}">−</button><input id="${inputId}" data-trade-qty type="number" inputmode="numeric" min="1" max="${q.limit}" step="1" value="${esc(raw)}" aria-label="จำนวน${name} ${esc(D.items[id].name)}"><button data-trade-adjust="1" aria-label="เพิ่มจำนวน${name} ${esc(D.items[id].name)}">+</button><button data-trade-max title="สูงสุดตามของ เงิน และน้ำหนักขณะนี้"${q.maxQuantity?'':' disabled'}>สูงสุด</button></div><small data-trade-owned></small><small class="trade-total" data-trade-total></small><small class="trade-weight" data-trade-weight></small><small class="shop-reason" data-trade-reason></small>${button(mode,name,id,`${q.ok?'':'disabled '}class="trade-submit"`)}</div>`;
  }
  function weightSummary(s,st) {
    const percent=st.weight/st.capacity*100,status=percent>=90?"over":percent>=50?"heavy":"normal";
    return `<div class="inventory-weight-summary" data-weight-status="${status}"><b>น้ำหนัก <span data-bag-weight>${numberText(st.weight)}</span> / <span data-bag-capacity>${numberText(st.capacity)}</span> · <span data-bag-percent>${percent.toFixed(1)}%</span></b><progress max="${st.capacity}" value="${Math.min(st.weight,st.capacity)}" aria-label="น้ำหนักกระเป๋า"></progress><small>เหลือ ${numberText(Math.max(0,st.capacity-st.weight))} · เงิน <span data-trade-money>${numberText(s.silver)}</span> ${esc(world.currency)}</small><small>50% หยุดฟื้น HP/SP · 90% หยุดโจมตี</small></div>`;
  }
  function heavyItems(s) {
    const rows=Object.entries(D.items).map(([id,item])=>{const count=s.inventory[id]||0,worn=Object.values(s.equipment).filter(value=>value===id).length;return{id,count,worn,total:(count+worn)*item.weight};}).filter(row=>row.total>0).sort((a,b)=>b.total-a.total||a.id.localeCompare(b.id)).slice(0,3);
    return `<b>ของที่หนักที่สุด</b><ul>${rows.map(row=>`<li>${esc(D.items[row.id].name)} · ${row.count?`กระเป๋า ${numberText(row.count)}`:''}${row.count&&row.worn?' + ':''}${row.worn?`สวม ${row.worn}`:''} × ${D.items[row.id].weight} = <b>${numberText(row.total)}</b></li>`).join('')}</ul><small>นับของสวมใส่ครั้งเดียว · ช่องเพิ่มตามชนิดไอเทม จำกัดด้วยน้ำหนัก</small>`;
  }
  function updateTrades() {
    if(!["inventory","shop"].includes(panel))return;
    const st=C.stats(state),root=$("side-panel");
    const set=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text;};
    root.querySelectorAll('.trade-controls').forEach(box=>{
      const id=box.dataset.tradeId,mode=box.dataset.tradeMode,input=box.querySelector('[data-trade-qty]');
      const q=window.BCItemRules.tradeQuote(state,id,mode,tradeQuantity(input.value),st);
      const valid=q.quantity>0&&Number.isFinite(q.total),weight=valid&&Number.isFinite(q.weightAfter)&&q.weightAfter>=0;
      set(box.querySelector('[data-trade-owned]'),`มีในกระเป๋า ${numberText(q.owned)} · ต่อชิ้น ${numberText(q.unitPrice??0)} ${world.currency}`);
      set(box.querySelector('[data-trade-total]'),valid?`รวม ${numberText(q.total)} ${world.currency}`:'ระบุจำนวนเต็มตั้งแต่ 1');
      set(box.querySelector('[data-trade-weight]'),weight?`น้ำหนักหลัง${mode==='buy'?'ซื้อ':'ขาย'} ${numberText(q.weightAfter)} / ${numberText(st.capacity)} (${(q.weightAfter/st.capacity*100).toFixed(1)}%)`:'น้ำหนักหลังรายการ —');
      set(box.querySelector('[data-trade-reason]'),q.ok?'':q.message);
      box.querySelector('.trade-submit').disabled=!q.ok;box.querySelector('[data-trade-max]').disabled=q.maxQuantity<1;
      box.querySelector('[data-trade-adjust="-1"]').disabled=!(q.quantity>1);
      box.querySelector('[data-trade-adjust="1"]').disabled=q.quantity>=q.limit;
      input.setAttribute('aria-invalid',String(!Number.isSafeInteger(tradeQuantity(input.value))||tradeQuantity(input.value)<1||tradeQuantity(input.value)>q.limit));
    });
    const summary=root.querySelector('.inventory-weight-summary');
    if(summary){const signature=JSON.stringify([st.weight,st.capacity,state.silver]);if(summary.dataset.signature!==signature){summary.dataset.signature=signature;const replacement=document.createElement('div');replacement.innerHTML=weightSummary(state,st);summary.replaceWith(replacement.firstElementChild);root.querySelector('.inventory-weight-summary').dataset.signature=signature;}}
    const heavy=root.querySelector('.inventory-heavy-list');if(heavy){const html=heavyItems(state);if(heavy.innerHTML!==html)heavy.innerHTML=html;}
    set(root.querySelector('[data-bag-footer-weight]'),`Wt. ${numberText(st.weight)} / ${numberText(st.capacity)}`);
    set(root.querySelector('[data-bag-footer-money]'),`◈ ${numberText(state.silver)} ${world.currency}`);
  }
  function itemCatalog() {
    const ids = catalogCollection === "all" ? Object.keys(D.items) : D.itemCatalog[catalogCollection];
    const query = catalogSearch.trim().toLocaleLowerCase("th");
    const matches = ids.filter((id) => {
      const item = D.items[id];
      return (catalogType === "all" || item.type === catalogType) &&
        (catalogStatus === "all" || window.BCItemRules.availability(id) === catalogStatus) &&
        (catalogWeaponType === "all" || item.weaponType === catalogWeaponType) &&
        (catalogGrade === "all" || item.grade === Number(catalogGrade)) && (!query ||
        [item.name, weaponTypeName(item), itemTypeNames[item.type], rarityNames[item.rarity],
          item.weaponType ? compatibleClasses(item.weaponType) : "", availabilityNames[window.BCItemRules.availability(id)],
          ...window.BCItemRules.sourcesFor(id).map((s) => s.name)].join(" ").toLocaleLowerCase("th").includes(query));
    });
    const select = (id, label, value, entries) => `<label for="${id}">${label}<select id="${id}">${entries.map(([key, name]) => `<option value="${key}"${value === key ? " selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`;
    const paths = Object.entries(D.itemCatalog.progressions);
    const progressions = `<details class="weapon-progressions"${catalogPathsOpen ? " open" : ""}><summary>เส้นทางอาวุธ ${paths.length} ประเภท · 3 ขั้น</summary><p class="panel-note">ขั้นอาวุธแยกจาก Class · เลเวลเป็นคำแนะนำ · สวมได้เฉพาะประเภทประจำอาชีพ</p>${paths.map(([type, path]) => `<article class="weapon-path" data-weapon-type="${type}"><h3>${esc(D.weaponTypes[type].name)}</h3><small>${esc(compatibleClasses(type))}</small><ol>${path.map((id) => {
      const i = D.items[id], availability = window.BCItemRules.availability(id);
      return `<li data-path-item="${id}" data-availability="${availability}">${icon(id)}<span><b>ขั้น ${i.grade} · ${esc(i.name)}</b><small>${esc([i.atk ? `ATK +${i.atk}` : "", i.matk ? `MATK +${i.matk}` : "", i.def ? `DEF +${i.def}` : "", itemLevel(i)].filter(Boolean).join(" · "))}</small><em class="availability-${availability}">${availabilityNames[availability]}</em></span></li>`;
    }).join("")}</ol></article>`).join("")}</details>`;
    return `<p class="panel-note">อาวุธครบทุกประเภท · ช่วงเลเวลเป็นคำแนะนำ<br>“ยังไม่เปิด” คือแหล่งในอนาคต</p><div class="catalog-filters">${
      select("catalog-collection", "รายการ", catalogCollection, [["regular", `รายการปกติ ${D.itemCatalog.regular.length} ชิ้น`], ["upgrades", `อาวุธอัปเกรด ${D.itemCatalog.upgrades.length} ชิ้น`], ["all", `ทั้งหมด ${Object.keys(D.items).length} ชิ้น`]]) +
      select("catalog-status", "สถานะแหล่งหา", catalogStatus, [["all", "ทุกสถานะ"], ...Object.entries(availabilityNames)]) +
      select("catalog-type", "ประเภท", catalogType, [["all", "ทุกประเภท"], ...Object.entries(itemTypeNames)]) +
      select("catalog-weapon-type", "ประเภทอาวุธ", catalogWeaponType, [["all", "อาวุธทุกประเภท"], ...paths.map(([type]) => [type, D.weaponTypes[type].name])]) +
      select("catalog-grade", "ขั้นอาวุธ", catalogGrade, [["all", "ทุกขั้น"], ...Object.entries(gradeNames).map(([grade, name]) => [grade, `${grade} · ${name}`])])
    }<label class="catalog-search" for="catalog-search">ค้นหาไอเทม อาชีพ หรือแหล่งที่ได้<input id="catalog-search" type="search" value="${esc(catalogSearch)}" placeholder="ชื่อไอเทม อาชีพ หรือมอนสเตอร์" autocomplete="off"></label></div>${progressions}<p class="catalog-count" role="status">พบ ${matches.length} ชิ้น</p><div class="catalog-list">${matches.map((id) => {
      const item = D.items[id];
      const availability = window.BCItemRules.availability(id);
      return `<article class="catalog-card rarity-${item.rarity || "common"}" data-item="${id}" data-availability="${availability}">${icon(id)}<div class="item-info"><h3>${esc(item.name)}</h3><span class="item-availability availability-${availability}">${availabilityNames[availability] || ""}</span><small>${esc(itemMeta(item))}</small><small class="item-prices">${esc(itemPrices(id))}</small>${sourceRows(id)}</div></article>`;
    }).join("") || '<p class="catalog-empty">ไม่พบไอเทม ลองเปลี่ยนคำค้นหรือประเภท</p>'}</div>`;
  }
  function optionsBinding(selected) {
    let opts = [
      ["", "ช่องว่าง"],
      ["action:attack", "โจมตี"],
      ["action:interact", "คุย NPC"],
      ["action:auto", "Auto Battle"],
    ];
    for (const [id, d] of Object.entries(D.skills))
      if (state.skills[id] && C.skillAvailable(state, id) && !SkillRules.isPassive(id)) opts.push(["skill:" + id, d.name]);
    for (const [id, d] of Object.entries(D.items))
      if (d.type === "use") opts.push(["item:" + id, d.name]);
    if (selected && !opts.some((o) => o[0] === selected) && !(selected.startsWith("skill:") && SkillRules.isPassive(selected.split(":")[1])))
      opts.push([
        selected,
        selected.startsWith("skill:") && !C.skillAvailable(state, selected.split(":")[1])
          ? "ช่องว่าง · สกิลที่ยังใช้ไม่ได้"
          : "ยังไม่เรียน: " + (D.skills[selected.split(":")[1]]?.name || selected),
      ]);
    return opts
      .map(
        ([v, n]) =>
          `<option value="${v}" ${v === (selected || "") ? "selected" : ""}>${esc(n)}</option>`,
      )
      .join("");
  }
  function classSelector(s) {
    const current = classInfo(s), route = [];
    for (let id = s.classId; id; id = D.classes[id].parent) route.unshift(D.classes[id].name);
    const near = nearGuide(), progress = C.trialProgress(s);
    const location = near
      ? `อยู่ใกล้${npc("guide").name}แล้ว · พร้อมรับการทดสอบหรือเปลี่ยนอาชีพเมื่อครบเงื่อนไข`
      : s.zone === 0
        ? `ต้องอยู่ใกล้${npc("guide").name}ที่${npc("guide").thai}เพื่อรับการทดสอบและเปลี่ยนอาชีพ`
        : `กลับ${D.maps[0].name} แล้วไปหา${npc("guide").name}เพื่อรับการทดสอบและเปลี่ยนอาชีพ`;
    const children = C.availableClasses(s);
    return `<section class="class-selector" aria-label="เส้นทางอาชีพ"><h3>เส้นทางอาชีพ · ${esc(className(s))}</h3><p class="class-route">${route.map(esc).join(" → ")} <span class="subtle">· ${classLabel(s)}</span></p><p class="panel-note">${esc(current.tier === 2 ? "ถึงอาชีพขั้นสุดท้ายของเส้นทางนี้แล้ว" : "เลือกได้เฉพาะอาชีพถัดไปในเส้นทาง เมื่อเปลี่ยนแล้ว Job Lv.เริ่มที่ 1 และคงสกิลที่สืบทอดไว้")}<br>${esc(location)}</p>${!near && s.zone === 0 ? button("walk-guide", `เดินไปหา${esc(npc("guide").name)}`, "", 'class="outline-button guide-route"') : ""}${children.length ? `<div class="class-grid">${children.map((id) => {
      const d = D.classes[id], reason = C.classChangeReason(s, id);
      const trial = d.trial, active = progress?.classId === id ? progress : null;
      const trialReason = s.jobLevel < 40 ? "ต้องมี Job Lv.40" : !near ? `ต้องอยู่ใกล้${npc("guide").name}` : "";
      const trialText = trial ? `กำจัด${D.monsters[trial.kind].name} ${active ? active.current : 0} / ${trial.count} ตัว${active ? " · นับหลังรับทดสอบ" : " · ต้องรับทดสอบก่อน"}` : "";
      return `<article class="class-card" data-class="${id}"><span class="item-icon">${artIcon(d.trainingWeapon)}</span><b>${esc(d.name)}</b><small>Class ${d.tier} · ${esc(D.weaponTypes[d.weaponType].name)}</small><p>${esc(d.description)}</p><small class="class-requirement">ต้องมี Job Lv.${d.tier === 1 ? 10 : 40}${trial ? " + ผ่านการทดสอบ" : ""}</small>${trial ? `<small class="trial-progress${active?.complete ? " complete" : ""}" data-trial="${id}">${esc(trialText)}</small>${button("class-trial", active ? (active.complete ? "ทดสอบสำเร็จ" : "กำลังทดสอบ") : "รับการทดสอบ", id, trialReason || active ? `disabled title="${esc(trialReason || "รับการทดสอบนี้แล้ว")}"` : "")}` : ""}${button("class", "เปลี่ยนอาชีพ", id, reason ? `disabled title="${esc(reason)}"` : 'class="primary"')}<small class="class-reason">${esc(reason || "พร้อมเปลี่ยนอาชีพ")}</small></article>`;
    }).join("")}</div>` : ""}<p class="panel-note class-equipment-rule">สวมอาวุธได้เฉพาะประเภทประจำอาชีพ · ซื้ออาวุธของอาชีพถัดไปเก็บไว้ได้ · เปลี่ยนอาชีพไม่แจกอาวุธหรืออัฐ · ดาบและโล่ใช้ช่องอาวุธเดียวกัน</p></section>`;
  }
  function skillCard(s, id) {
    const d = D.skills[id], owner = D.classes[d.owner], passive = SkillRules.isPassive(id);
    const reason = C.learnReason(s, id);
    return `<article class="skill-card" data-skill="${id}" data-class="${d.owner || "villager"}" data-kind="${passive ? "passive" : "active"}"><span class="item-icon">${artIcon(id)}</span><div class="item-info"><b>${esc(d.name)} <span class="subtle">Lv.${s.skills[id] || 0} / ${d.max}</span></b><small class="skill-owner">${owner ? `${esc(owner.name)} · Class ${owner.tier}${d.owner !== s.classId ? " · สืบทอด" : ""}` : "ใช้ได้ทุกอาชีพ"}</small>${skillMeta(s, id)}<small class="skill-description">${esc(d.description)}</small>${id !== "first_aid" && reason ? `<small class="skill-reason">${esc(reason)}</small>` : ""}</div>${skillControls(s, id, reason)}</article>`;
  }
  function swordLevelText(s, id, level) {
    const v = SwordRules.levelInfo(id,level,s.baseLevel), pct = n => numberText(n*100);
    if (!v) return "";
    switch(id) {
      case "swordsman_discipline": case "swordsman_twohand_mastery": return `ความเสียหายแยกจาก DEF +${v.masteryFlat} ต่อฮิต`;
      case "swordsman_recovery": return `ฟื้น ${5*level} + ${pct(.002*level)}% Max HP / 10 วินาที · ผลยา HP +${pct(v.hpItemBonus)}%`;
      case "arun_slash": return `ATK ${pct(v.power)}% · HIT +${v.hitBonus} · SP ${v.sp}${level>=6&&s.skills.swordsman_fatal_blow?` · มึนงง ${pct(v.fatalBlowChance)}%`:""}`;
      case "swordsman_provoke": return `สำเร็จ ${pct(v.successChance)}% · เป้า ATK +${pct(v.enemyAtkMultiplier-1)}% / DEF −${pct(1-v.enemyDefMultiplier)}% · SP ${v.sp}`;
      case "swordsman_sweep": return `ATK ${pct(v.power)}% · HIT +${v.hitBonus} · HP ${v.hpCost} / SP ${v.sp}`;
      case "swordsman_stance": return `MDEF +${v.mdefBonus} · ${v.duration} วินาที / 7 ครั้ง · SP ${v.sp}`;
      case "swordsman_moving_recovery": return "ฟื้น HP ตามธรรมชาติขณะเดิน 50%";
      case "swordsman_fatal_blow": return "ฟาดฟันรุนแรง Lv.6–10 ทำให้มึนงง 5 วินาที";
      case "swordsman_auto_berserk": return "HP <25%: ATK +32% / VIT DEF −55% · เปิด SP 1 / ปิดฟรี";
      default: return "";
    }
  }
  function skillMeta(s, id, showTable = false) {
    const d = D.skills[id], passive = SkillRules.isPassive(id), sword = SwordRules.isSwordSkill(id);
    const roles = { attack: "โจมตี", buff: "เสริมพลัง", utility: "สนับสนุน", heal: "ฟื้นฟู" };
    const mechanics = { cone: "โจมตีเป็นพัด", radial: "โจมตีรอบตัว", chain: "โจมตีชิ่ง", pierce: "โจมตีทะลุแนว", shield: "สร้างโล่", mark: "วางตราบนเป้าหมาย", empower: "เสริมสกิลครั้งถัดไป", cleanse: "ชำระสถานะ", move: "เคลื่อนที่", debuff: "ลดพลังศัตรู", provoke: "ยั่วยุ", toggle: "เปิด / ปิด", trap: "วางกับดัก", sanctuary: "ฟื้นฟูและโจมตีรอบตัว" };
    const level = Math.max(1,s.skills[id]||0), cost = SkillRules.spCost(s,id,id==="swordsman_auto_berserk"&&s.classCombat?.autoBerserk?.enabled), range = SkillRules.rangeFor(s,id);
    let html = passive ? `<small class="skill-meta"><span class="skill-kind passive">ติดตัว</span> เรียนแล้วทำงานอัตโนมัติ · ไม่ใช้ช่อง Hotbar</small>` : `<small class="skill-meta"><span class="skill-kind active">กดใช้</span> ${mechanics[d.kind]||roles[d.category]||"สกิลอาชีพ"} · <span data-skill-sp="${id}" data-effective-sp="${cost}">SP ${cost}</span> · CD ${d.cooldown} วินาที${range>0?` · ระยะ ${sword?(id==='swordsman_provoke'?9:1)+' ช่อง':range}`:" · ตนเอง"}</small>`;
    if (d.questSkill) html += '<small class="skill-training">สกิลพิเศษ · เรียนฟรีกับครูอินในเมือง</small>';
    const requirements=Object.entries(d.requirements||{});
    if(requirements.length)html+=`<small class="skill-prerequisites">ต้องเรียน ${requirements.map(([key,lv])=>`${esc(D.skills[key].name)} Lv.${lv}`).join(' · ')}</small>`;
    if(sword)html+=`<small class="skill-level-effect" data-level-effect="${id}">${s.skills[id]?'ระดับปัจจุบัน':'ตัวอย่างระดับ 1'}: ${esc(swordLevelText(s,id,level))}</small>`;
    if(showTable&&sword&&d.max>1)html+=`<details class="skill-level-table"><summary>ดูผลทั้ง ${d.max} ระดับ</summary><table><thead><tr><th scope="col">Lv.</th><th scope="col">ผลของสกิล</th></tr></thead><tbody>${Array.from({length:d.max},(_,i)=>`<tr data-level="${i+1}"${s.skills[id]===i+1?' class="learned-level"':''}><th scope="row">${i+1}</th><td>${esc(swordLevelText(s,id,i+1))}</td></tr>`).join('')}</tbody></table></details>`;
    if(["swordsman_stance","swordsman_sweep","swordsman_auto_berserk"].includes(id))html+=`<small class="skill-live-state" data-skill-live="${id}" aria-live="polite"></small>`;
    return html;
  }
  function skillControls(s, id, reason) {
    const d = D.skills[id], passive = SkillRules.isPassive(id);
    const learn = id === "first_aid"
      ? '<span class="skill-starting">เริ่มต้น</span>'
      : button("learn", d.questSkill ? "เรียนฟรี" : "เรียน", id, `${reason ? `disabled title="${esc(reason)}"` : ""} aria-label="เรียน ${esc(d.name)}"`);
    const use = passive ? "" : button("skill", "ใช้", id, `class="skill-use" aria-label="ใช้ ${esc(d.name)}"${s.skills[id] ? "" : ' disabled title="ต้องเรียนสกิลก่อน"'}`);
    return `<div class="skill-actions">${learn}${use}</div>`;
  }
  function updateSkillReadiness() {
    document.querySelectorAll('.skill-use[data-id]').forEach(el => {
      const id=el.dataset.id,skill=D.skills[id],r=C.actionReadiness(state,id);
      el.disabled=!r.ready;el.title=r.reason||`ใช้ ${skill.name}`;
      el.dataset.readinessSource=r.source||"";el.dataset.readinessRemaining=String(r.remaining);
      el.textContent=r.remaining>0?`${(Math.ceil(r.remaining*10)/10).toFixed(1)}s`:id==="swordsman_auto_berserk"?(state.classCombat?.autoBerserk?.enabled?"ปิด":"เปิด"):"ใช้";
    });
    document.querySelectorAll('[data-skill-sp]').forEach(el=>{
      const id=el.dataset.skillSp,cost=SkillRules.spCost(state,id,id==="swordsman_auto_berserk"&&state.classCombat?.autoBerserk?.enabled);
      if(el.dataset.effectiveSp!==String(cost)){el.dataset.effectiveSp=String(cost);el.textContent=`SP ${cost}`;}
    });
    document.querySelectorAll('[data-skill-live]').forEach(el=>{
      const id=el.dataset.skillLive,cs=state.classCombat,buff=cs?.buffs?.[id];
      let text="";
      if(id==="swordsman_auto_berserk")text=cs?.autoBerserk?.enabled?(cs.autoBerserk.active?"เปิดอยู่ · คลั่งทำงาน: ATK +32% / VIT DEF −55%":"เปิดอยู่ · รอ HP ต่ำกว่า 25%"):"ปิดอยู่";
      else if(buff?.remaining>0)text=id==="swordsman_stance"?`ยืนหยัด ${buff.remaining.toFixed(1)} วินาที · เหลือ ${buff.hitsRemaining} ครั้ง`:`เสริมพลังไฟ 20% · ${buff.remaining.toFixed(1)} วินาที`;
      if(el.textContent!==text)el.textContent=text;
    });
  }
  function skillTree(s) {
    const tree = window.BCSkillTree, accessible = tree.nodesFor(s.classId);
    if (!tree.validateAllocation(s,skillAllocation).ok) skillAllocation=tree.createAllocation(s);
    const plan=tree.validateAllocation(s,skillAllocation), nodes=[...accessible.ancestry,...accessible.shared];
    if(!nodes.some(n=>n.skillId===selectedTreeSkill))selectedTreeSkill=nodes[0]?.skillId;
    const progress = C.trialProgress(s);
    const tile = (node,shared=false) => {
      const { classId, classDef: c, skillId, skill: d } = node;
      const relation = classId === s.classId ? "own" : "inherited";
      const passive=SkillRules.isPassive(skillId),level=plan.levels[skillId]??s.skills[skillId],pending=skillAllocation?.increments[skillId]||0;
      const add=tree.adjustAllocation(s,skillAllocation,skillId,1), remove=tree.adjustAllocation(s,skillAllocation,skillId,-1);
      const disabled=!add.ok;
      return `<article class="${shared?'skill-shared-node':'skill-tree-node'}" data-class="${classId}" data-skill="${skillId}" data-state="${relation}" data-kind="${passive?'passive':'active'}" data-selected="${selectedTreeSkill===skillId}" data-learned="${s.skills[skillId]>0}" data-pending="${pending>0}"><button class="skill-node-select" data-skill-select="${skillId}" aria-label="ดู ${esc(d.name)} · ระดับ ${level} จาก ${d.max}" aria-pressed="${selectedTreeSkill===skillId}" aria-controls="skill-tree-detail">${artIcon(skillId)}</button><h3 class="skill-node-name">${esc(d.name)}</h3><small class="skill-node-kind">${passive?'ติดตัว':'กดใช้'}${d.questSkill?' · เรียนฟรี':''}${pending?' · แต้มร่าง +'+pending:''}</small>${shared?'<span class="skill-starting">เริ่มต้น · 1 / 1</span>':`<div class="skill-level-controls"><button data-skill-adjust="${skillId}" data-delta="-1" aria-label="ลดแต้มร่าง ${esc(d.name)}"${remove.ok?'':' disabled'}>−</button><output class="skill-node-level" aria-label="ระดับในแผน ${esc(d.name)}">${level} / ${d.max}</output><button data-skill-adjust="${skillId}" data-delta="1" aria-label="เพิ่มแต้มร่าง ${esc(d.name)}"${disabled?' disabled':''}>+</button></div>`}</article>`;
    };
    const classes = [...new Set(accessible.ancestry.map(n => n.classId))];
    const groups = classes.map(classId => {
      const c = D.classes[classId], trial = c.trial, active = progress?.classId === classId ? progress : null;
      const trialText = trial ? ` · ทดสอบกำจัด${D.monsters[trial.kind].name} ${trial.count} ตัว${active ? ` (${active.current}/${trial.count}${active.complete ? " · สำเร็จ" : ""})` : " · นับหลังรับทดสอบ"}` : "";
      return `<section class="skill-tree-group" data-skill-class="${classId}"><header class="skill-tree-group-heading"><h3>Class ${c.tier} · ${esc(c.name)}</h3><small>${accessible.ancestry.filter(n=>n.classId===classId).length} สกิล · ${classId===s.classId?'อาชีพปัจจุบัน':'สืบทอด'}</small></header><div class="skill-tree-grid">${accessible.ancestry.filter(n => n.classId === classId).map(n=>tile(n)).join("")}</div><small class="skill-tree-requirement">Job Lv.${c.tier===1?10:40}${esc(trialText)}</small></section>`;
    }).join("");
    const selected=nodes.find(n=>n.skillId===selectedTreeSkill),id=selected?.skillId,d=selected?.skill,c=selected?.classDef;
    const pending=skillAllocation?.increments[id]||0,reason=id?C.learnReason(s,id):"";
    const detail=selected?`<aside class="skill-tree-detail" id="skill-tree-detail" aria-labelledby="skill-tree-detail-title"><header><span class="item-icon">${artIcon(id)}</span><div><h3 id="skill-tree-detail-title">${esc(d.name)}</h3><small>ปัจจุบัน Lv.${s.skills[id]} / ${d.max}${pending?` · แผน Lv.${plan.levels[id]}`:''}</small></div></header>${skillMeta(s,id,true)}<p class="skill-tree-description">${esc(d.description)}</p><small class="skill-tree-requirement">${d.owner?`เปิดเมื่อเปลี่ยน ${esc(c.name)} · Job Lv.${c.tier===1?10:40}${c.trial?' + ผ่านการทดสอบ':''}`:'สกิลเริ่มต้นทุกอาชีพ'}</small>${id!=='first_aid'&&reason?`<small class="skill-reason">${esc(reason)}</small>`:''}${pending?'<small class="skill-tree-draftnote">แต้มร่างยังไม่ส่งผลในเกม · ค่า SP แสดงระดับที่เรียนจริง</small>':''}${SkillRules.isPassive(id)?'<small class="skill-tree-draftnote">ทำงานอัตโนมัติเมื่อยืนยันเรียน · ไม่ใช้ช่อง Hotbar</small>':`<div class="skill-actions">${button('skill','ใช้สกิล',id,`class="skill-use" aria-label="ใช้ ${esc(d.name)}"${s.skills[id]?'':' disabled'}`)}</div>`}</aside>`:'';
    return `<div class="skill-atlas-layout"><div class="skill-atlas-boards">${groups?`<section class="skill-tree-path" aria-label="สกิลอาชีพปัจจุบันและที่สืบทอด">${groups}</section>`:'<p class="panel-note">ชาวบ้าน Job Lv.10 เลือก Class 1 กับครูอินเพื่อเปิดผังอาชีพ</p>'}<section class="skill-tree-shared" aria-label="สกิลร่วมทุกอาชีพ"><h3>สกิลร่วมทุกอาชีพ</h3>${accessible.shared.map(n=>tile(n,true)).join('')}</section></div>${detail}</div><div class="skill-plan-bar"><div>ใช้ในแผน <b data-plan-spent>${plan.spent}</b> · เหลือ <b data-plan-remaining>${plan.remaining}</b> แต้ม</div><div class="skill-plan-actions"><button data-plan-reset${plan.entries.length?'':' disabled'}>ล้างแผน</button><button data-plan-apply class="primary"${plan.entries.length?'':' disabled'}>ยืนยันเรียน</button></div><small class="skill-plan-hint">− ลดได้เฉพาะแต้มร่าง · ปิดหน้าต่างจะยกเลิกแต้มที่ยังไม่ยืนยัน</small></div>`;
  }
  function rerenderSkillTree(selector) {
    const scroll=$("panel-window").scrollTop;
    renderPanel();
    const el=$("side-panel").querySelector(selector);
    (el&&!el.disabled?el:$("side-panel").querySelector(`[data-skill-select="${selectedTreeSkill}"]`))?.focus({preventScroll:true});
    $("panel-window").scrollTop=scroll;
  }
  function updateSkillAllocation() {
    if(panel!=="skills"||skillsTab!=="tree")return;
    const tree=window.BCSkillTree,plan=tree.validateAllocation(state,skillAllocation);
    if(!plan.ok){skillAllocation=tree.createAllocation(state);renderPanel();return;}
    for(const [selector,value]of [['[data-skill-points]',state.skillPoints],['[data-plan-spent]',plan.spent],['[data-plan-remaining]',plan.remaining]]) {
      const el=$("side-panel").querySelector(selector);if(el&&el.textContent!==String(value))el.textContent=value;
    }
    const reason=$("side-panel").querySelector('.skill-tree-detail .skill-reason');
    if(reason){const text=C.learnReason(state,selectedTreeSkill);if(reason.textContent!==text)reason.textContent=text;reason.hidden=!text;}
    $("side-panel").querySelectorAll('[data-skill-adjust]').forEach(el=>{const id=el.dataset.skillAdjust;const result=tree.adjustAllocation(state,skillAllocation,id,el.dataset.delta==='1'?1:-1);el.disabled=!result.ok;el.title=result.message||'';});
  }
  function applySkillAllocation() {
    if(!readyForAction())return;
    const plan=window.BCSkillTree.validateAllocation(state,skillAllocation);
    if(!plan.ok||!plan.entries.length){toast(plan.message||"เพิ่มแต้มในแผนก่อนยืนยัน");renderPanel();return;}
    const result=C.act(state,"learn-plan",skillAllocation);
    if(result.ok){skillAllocation=window.BCSkillTree.createAllocation(state);save();}
    if(result.message)toast(result.message);
    updateHUD();rerenderSkillTree(`[data-skill-select="${selectedTreeSkill}"]`);
  }
  const statNumber = (value) => Number(value).toLocaleString("en-US", { maximumFractionDigits: 1, useGrouping: false });
  function statBuild(s, st) {
    const type = classInfo(s).weaponType;
    let detail = type === "magic_bow"
      ? s.skills.arcane_dual_art > 0
        ? "DEX เป็นค่าหลักสำหรับยิงปกติและเสริมสกิลเวทด้วยศรสองศาสตร์ · INT เป็นค่าเสริมเวท · AGI ช่วยยิงไว"
        : "DEX เพิ่มยิงปกติ · INT เพิ่มสกิลเวท · เรียนศรสองศาสตร์เพื่อให้ DEX เสริมพลังเวท · AGI ช่วยยิงไว"
      : st.basicMagic
        ? "INT เพิ่มพลังเวทและ SP · DEX ช่วยความเร็วโจมตีเล็กน้อย · VIT ช่วยยืนสู้"
        : type === "bow"
          ? "DEX เพิ่มพลังธนูและความแม่นยำ · AGI ช่วยยิงไว · VIT เพิ่ม HP"
          : type === "sword_shield"
            ? "STR เพิ่มพลังดาบ · VIT เพิ่ม HP และป้องกัน · DEX ช่วยความแม่นยำ"
            : "STR เพิ่มพลังโจมตีประชิด · AGI ช่วยตีไว · DEX ช่วยความแม่นยำ · VIT เพิ่ม HP";
    if (["acolyte", "divine_scribe", "garuda_monk"].includes(s.classId)) detail += ` · อักขระจู่โจมและคลื่นอาคมใช้ ${type === "knuckle" ? "ATK ของสนับมือ" : "MATK ของหนังสือ"} ตามอาชีพปัจจุบัน`;
    return `<p class="stat-build"><b>${esc(D.weaponTypes[type].name)} · ตีปกติ${st.basicMagic ? "เวท" : "กายภาพ"} ใช้ ${esc(st.primaryStat.toUpperCase())}</b><span>${esc(detail)}</span></p>`;
  }
  function statResetCard(s) {
    const refund = C.statRefund(s), reason = C.statResetReason(s);
    const unavailable = reason || (refund ? "" : "ค่าสเตตัสทั้ง 6 เป็น 1 แล้ว ยังไม่มีแต้มให้คืน");
    return `<section class="stat-reset" aria-label="รีสเตตัสฟรี"><div><b>รีสเตตัสฟรีที่${esc(npc("guide").name)}</b><small>คืน ${refund} แต้มที่ลงไว้ · คงแต้มที่เหลือ ${s.statPoints} แต้ม</small><small>${esc(reason || (refund ? "คืนค่าสเตตัสทั้ง 6 เป็น 1 แล้วเลือกลงแต้มใหม่ได้" : "ยังไม่ได้ลงแต้มสเตตัส"))}</small></div><div class="stat-reset-actions">${button("reset-stats", "คืนแต้มทั้งหมด", "", unavailable ? `disabled title="${esc(unavailable)}"` : "")}${reason && s.zone === 0 ? button("walk-guide", `เดินไปหา${esc(npc("guide").name)}`, "", 'class="outline-button"') : ""}</div></section>`;
  }
  function statSummary(s, st) {
    const cells = [
      ["atk", "ATK", st.atk, "พลังโจมตีกายภาพ"],
      ["matk", "MATK", st.matk, "พลังโจมตีเวท · คทา หนังสือ แก้วมณีใช้ตีปกติด้วย"],
      ["def", "DEF", st.def, "ป้องกันกายภาพ · ดูส่วนพื้นฐานและอุปกรณ์ในรายละเอียด"],
      ["mdef", "MDEF", st.mdef, `ป้องกันเวท · มีผลกับการโจมตีเวทของ${D.monsters.willow.name}`],
      ["hit", "HIT", st.hit, "ความแม่นยำของการโจมตีกายภาพ"],
      ["flee", "FLEE", st.flee, "หลบการโจมตีกายภาพทั่วไป"],
      ["crit", "CRIT", `${statNumber(st.crit)}%`, "โอกาสคริติคอลเฉพาะตีปกติกายภาพ · ความเสียหาย ×1.4"],
      ["aspd", "ASPD", st.aspd, "ความเร็วโจมตี · ค่าสูงขึ้น ตีได้เร็วขึ้น"],
      ["interval", "ตีทุก", `${st.interval.toFixed(2)}s`, "ระยะห่างระหว่างการตีปกติ · ไม่เปลี่ยนความเร็วเดินหรือคูลดาวน์สกิล"],
    ];
    const contribution = (base, gear) => `${statNumber(base)} + ${statNumber(gear)}`;
    return `<div class="stat-summary" aria-label="พลังต่อสู้">${cells.map(([id, label, value, help]) => `<div title="${esc(help)}"><span>${label}</span><b data-derived="${id}">${typeof value === "number" ? statNumber(value) : value}</b></div>`).join("")}</div><details class="stat-details"><summary>รายละเอียดพลังป้องกันและฟื้นฟู</summary><dl class="stat-detail-grid"><div><dt>ATK พื้นฐาน + อุปกรณ์</dt><dd>${contribution(st.baseAtk, st.gearAtk)}</dd></div><div><dt>MATK พื้นฐาน + อุปกรณ์</dt><dd>${contribution(st.baseMatk, st.gearMatk)}</dd></div><div><dt>DEF พื้นฐาน + เกราะ</dt><dd>${contribution(st.softDef, st.hardDef)}</dd></div><div><dt>MDEF พื้นฐาน + เกราะเวท</dt><dd>${contribution(st.softMdef, st.hardMdef)}</dd></div><div><dt>HP / SP สูงสุด</dt><dd>${st.maxHp} / ${st.maxSp}</dd></div><div><dt>ฟื้น HP / SP ทุก 4 วินาที</dt><dd><span data-derived="hpRegen">${st.hpRegen}</span> / <span data-derived="spRegen">${st.spRegen}</span></dd></div><div><dt>หลบสมบูรณ์ (ตีปกติกายภาพ)</dt><dd>${statNumber(st.perfectDodge)}%</dd></div><div><dt>ความจุน้ำหนัก</dt><dd>${st.capacity}</dd></div></dl><p class="panel-note">เกราะลดความเสียหายด้วย 100 / (100 + เกราะ) แล้วหักป้องกันพื้นฐาน ×0.25 แยก DEF / MDEF ตามชนิดโจมตี ค่าคริติคอลใช้กับตีปกติกายภาพเท่านั้น</p><p class="panel-note">ฟื้นฟูทุก 4 วินาทีเมื่อน้ำหนักต่ำกว่า 50%${SwordRules.isSwordLineage(s)?" · สายนักดาบฟื้น HP ขณะยืน เดินได้ 50% เมื่อเรียนฟื้นฟูขณะเคลื่อนที่ · ฟื้นฟูพลังชีวิตแยกทำงานทุก 10 วินาทีที่ยืนนิ่ง":""} · VIT และฟื้นฟูพลังชีวิตเพิ่มผลยา HP, INT เพิ่มผลยา SP · AGI ไม่เพิ่มความเร็วเดินหรือทำให้คูลดาวน์สกิลสั้นลง</p></details>`;
  }
  function renderPanel() {
    $("panel-window").classList.toggle("skill-tree-window",panel==="skills"&&skillsTab==="tree");
    $("panel-title").textContent = titleNames[panel] + (["status", "equipment"].includes(panel) ? ` · ${className(state)}` : "");
    const s = state,
      st = C.stats(s);
    let html = "";
    if (panel === "status") {
      html = `<p class="panel-note">${esc(className(s))} · Class ${classInfo(s).tier} · Base Lv.${s.baseLevel} · Job Lv.${s.jobLevel} · แต้มสเตตัส <b>${s.statPoints}</b></p><div class="status-layout"><div class="paper-doll"><div class="equipment-slots">${equipmentSlots.map(([slot, name, placeholder]) => `<button class="${s.equipment[slot] ? "" : "empty-equipment"}" data-open="equipment" data-slot="${slot}" title="${name}: ${s.equipment[slot] ? D.items[s.equipment[slot]].name : "ยังไม่ได้สวมใส่"}" aria-label="เปิดอุปกรณ์ ${name}">${artIcon(s.equipment[slot] || placeholder)}</button>`).join("")}</div><canvas id="status-portrait" width="96" height="124" aria-label="ตัวละครพร้อมอาวุธและเครื่องประดับศีรษะ"></canvas><div class="job-label">${esc(className(s))}</div><div class="equipment-caption">${equipmentCaption(s)}</div></div><div>`;
      for (const [id, name] of Object.entries(D.statNames)) {
        const cost = C.statCost(s.stats[id]);
        const reason = s.stats[id] >= 99 ? "เต็ม 99 แล้ว" : s.statPoints < cost ? `แต้มไม่พอ ต้องใช้ ${cost} แต้ม` : "";
        html += `<div class="stat-row" data-stat="${id}"><span class="stat-name" title="${esc(name)}">${id.toUpperCase()}</span><b>${s.stats[id]}</b><small class="stat-cost${reason ? " unavailable" : ""}">${s.stats[id] >= 99 ? "เต็ม 99" : `${cost} แต้ม${s.statPoints < cost ? '<em class="stat-short-reason">ไม่พอ</em>' : ''}`}</small>${button("stat", "＋", id, `${reason ? "disabled " : ""}title="${esc(reason || `เพิ่ม ${name} ใช้ ${cost} แต้ม`)}" aria-label="${esc(`เพิ่ม ${name}${reason ? ` · ${reason}` : ` ใช้ ${cost} แต้ม`}`)}" aria-describedby="stat-effect-${id}"`)}</div>`;
      }
      html += `</div></div>${statBuild(s, st)}<details class="stat-guide"><summary>ผลของสเตตัสทั้ง 6 · ดูก่อนลงแต้ม</summary><dl>${Object.entries(D.statNames).map(([id, name]) => `<div><dt>${esc(name)}</dt><dd id="stat-effect-${id}">${esc(D.statHelp[id])}</dd></div>`).join("")}</dl><p class="panel-note">เริ่มต้นค่า 1 · สูงสุด 99 · เพิ่ม 1 ค่าใช้ 2 + ปัดลง((ค่าปัจจุบัน − 1) / 10) แต้ม เมื่อ Base Lv.เพิ่ม ได้ 4 + ปัดลง(Base Lv.ใหม่ / 5) แต้ม</p></details>${statSummary(s, st)}${statResetCard(s)}`;
    }
    if (panel === "inventory") {
      const allItems = Object.entries(s.inventory).filter(([, count]) => count > 0);
      const items = allItems.filter(([id]) => inventoryCategory === "all" || (inventoryCategory === "equip" ? equipmentTypes.includes(D.items[id].type) : D.items[id].type === inventoryCategory));
      if (!items.some(([id]) => id === selectedInventoryItem)) selectedInventoryItem = items[0]?.[0] || null;
      html = weightSummary(s,st)+`<div class="inventory-heavy-list">${heavyItems(s)}</div><div class="inventory-tabs">${[["all","ทั้งหมด"],["use","ยา"],["equip","อุปกรณ์"],["loot","ของดรอป"]].map(([category,name]) => `<button data-item-category="${category}" aria-pressed="${inventoryCategory === category}">${name}</button>`).join("")}<span class="inventory-count">${allItems.length} ชนิด</span></div><div class="inventory-grid">`;
      for (const [id, count] of items) html += `<button class="inventory-tile" data-choose-item="${id}" aria-pressed="${id === selectedInventoryItem}" aria-label="${D.items[id].name} ×${count}" title="${D.items[id].name}">${icon(id)}<span class="quantity">${count}</span></button>`;
      for (let i = items.length; i < Math.max(24, Math.ceil(items.length / 8) * 8); i++) html += '<div class="inventory-empty-slot" aria-hidden="true"></div>';
      html += `</div><div class="inventory-footer"><span data-bag-footer-weight>Wt. ${numberText(st.weight)} / ${numberText(st.capacity)}</span><span data-bag-footer-money>◈ ${s.silver.toLocaleString()} ${esc(world.currency)}</span></div>`;
      if (selectedInventoryItem) {
        const id = selectedInventoryItem, i = D.items[id];
        let actions = i.type === "use" ? button("use", "ใช้", id) : equipmentTypes.includes(i.type) ? button("equip", "สวมใส่", id, C.equipReason(s, id) ? `disabled title="${esc(C.equipReason(s, id))}"` : "") : "";
        actions += tradeControls(s,id,"sell");
        html += `<div class="inventory-detail">${itemRow(id, s.inventory[id], "")}<div class="item-actions">${actions}</div>${equipmentTypes.includes(i.type) && C.equipReason(s,id) ? `<small class="shop-reason">${esc(C.equipReason(s,id))}</small>` : ""}</div>`;
      } else html += '<p class="empty">ไม่มีไอเทมในหมวดนี้</p>';
      html += `<p class="panel-note" style="margin-top:7px">เลือกไอเทมเพื่อใช้หรือสวมใส่ · ขายได้ใกล้${esc(npc("merchant").name)}<br>น้ำหนัก 50% หยุดฟื้น HP/SP · 90% ห้ามโจมตี</p>`;
      html +=
        '<button data-open="hotbar" class="outline-button">ใส่ไอเทมหรือสกิลใน Hotbar →</button>';
    }
    if (panel === "equipment") {
      html =
        `<p class="panel-note">ชุดและรูปลักษณ์อาวุธฝึกเป็นแบบประจำอาชีพถาวร อาวุธที่สวมเพิ่มค่าสถานะ เครื่องศีรษะเปลี่ยนภาพได้ทันที</p><div class="equipment-layout"><div class="equipment-preview"><canvas id="equipment-portrait" width="104" height="140" aria-label="ตัวละครพร้อมอุปกรณ์ที่สวมใส่"></canvas><div class="job-label">${esc(className(s))}</div><div class="equipment-caption">${equipmentCaption(s)}</div></div><div class="equipment-list">`;
      for (const [slot, name] of equipmentSlots) {
        html += `<div class="shop-title">${name}</div>`;
        html += s.equipment[slot]
          ? itemRow(
              s.equipment[slot],
              null,
              `<button data-act="unequip" data-slot="${slot}">ถอด</button>`,
            )
          : `<p class="subtle">${slot === "weapon" ? "แสดงอาวุธฝึกประจำอาชีพถาวร · ไม่มีโบนัสจากไอเทม" : "ยังไม่ได้สวมใส่"}</p>`;
      }
      html += '</div></div><button data-open="inventory" class="outline-button">เลือกอุปกรณ์จากกระเป๋า →</button><p class="panel-note equipment-note">อุปกรณ์แยกโบนัส ATK / MATK และ DEF / MDEF ตามที่ระบุ และนับรวมในน้ำหนักกระเป๋า</p>';
    }
    if (panel === "skills") {
      const ids = C.skillsFor(s);
      const passiveCount = ids.filter(id => SkillRules.isPassive(id)).length;
      html = `<div class="skills-tabs" role="tablist" aria-label="มุมมองสกิล">${[["current", "สกิลปัจจุบัน"], ["tree", "ผังสกิลอาชีพ"]].map(([id, label]) => `<button id="skills-tab-${id}" data-skills-tab="${id}" role="tab" aria-selected="${skillsTab === id}" aria-controls="skills-tabpanel" tabindex="${skillsTab === id ? 0 : -1}">${label}</button>`).join("")}</div><div id="skills-tabpanel" role="tabpanel" aria-labelledby="skills-tab-${skillsTab}"><div class="${skillsTab==='tree'?'skill-tree-summary':'panel-note'}"><span>${esc(className(s))} · ${classLabel(s)}</span><span>แต้มสกิล <b data-skill-points>${s.skillPoints}</b> · กดใช้ ${ids.length-passiveCount} / ติดตัว ${passiveCount}</span></div>`;
      if (skillsTab === "tree") html += skillTree(s);
      else {
        for (const id of ids) html += skillCard(s, id);
      }
      html += '<button data-open="hotbar" class="outline-button">จัดสกิลลง Hotbar →</button></div>';
    }
    if (panel === "quest" || panel === "npc") {
      if (panel === "npc")
        html = `<p class="panel-note">${esc(npc("guide").dialogue)}</p>`;
      html += questAutoCard(s);
      D.quests.forEach((q, i) => {
        const rewards = Object.entries(q.items || {});
        html += `<article class="quest-detail ${i < s.quest ? "done" : ""}"><div class="eyebrow">${i < s.quest ? "สำเร็จแล้ว" : i === s.quest ? "ภารกิจปัจจุบัน" : "บทต่อไป"} · 0${i + 1}</div><h3>${q.title}</h3><p>${q.text} (${Math.min(s.kills[q.kind] || 0, q.count)} / ${q.count})</p><p>รางวัล ${q.silver} ${esc(world.currency)} · ${q.exp} EXP</p>${rewards.length ? `<div class="quest-item-rewards">${rewards.map(([id, count]) => `<span data-item="${id}">${icon(id)}${esc(D.items[id].name)} ×${count}</span>`).join("")}</div>` : ""}${i === s.quest ? button("quest", s.questActive ? `รับรางวัลจาก${esc(npc("guide").name)}` : `รับภารกิจจาก${esc(npc("guide").name)}`) : i < s.quest ? "✓ สำเร็จแล้ว" : ""}</article>`;
      });
      if (s.quest >= D.quests.length)
        html +=
          '<p class="panel-note">✦ บทแรกของคุณจบลงแล้ว แต่โลกนี้ยังรอให้คุณออกสำรวจเสมอ</p>';
      if (panel === "npc") html += statResetCard(s);
    }
    if (panel === "shop") {
      const near = nearMerchant();
      const location = near
        ? `อยู่ใกล้${npc("merchant").name}แล้ว · เลือกซื้อของได้`
        : s.zone === 0
          ? `ยังอยู่ไกล · ต้องเดินเข้าใกล้${npc("merchant").name}ก่อนซื้อขาย`
          : `กลับ${D.maps[0].name}ผ่านประตูแผนที่ แล้วไปหา${npc("merchant").name}เพื่อซื้อขาย`;
      html = weightSummary(s,st)+`<p class="panel-note">${esc(npc("merchant").dialogue)}<br>${esc(location)}</p>`;
      if (!near && s.zone === 0)
        html += `<div class="settings-actions">${button("walk-shop", `เดินไปหา${esc(npc("merchant").name)}`, "", 'class="primary"')}</div>`;
      const groups = [["weapon", "อาวุธ"], ["use", "ยาและเสบียง"], ["head", "เครื่องศีรษะ"], ["armor", "เกราะ"], ["accessory", "เครื่องประดับ"]];
      for (const [type, title] of groups) {
        html += `<section class="shop-section" data-slot="${type}" aria-labelledby="shop-title-${type}"><div class="shop-title" id="shop-title-${type}">${title}</div>`;
        if (type === "weapon") html += `<div class="shop-filter"><label for="shop-weapon-type">ประเภทอาวุธ</label><select id="shop-weapon-type"><option value="">ทั้งหมด</option>${Object.entries(D.weaponTypes || {}).filter(([id]) => id !== "training").map(([id, weapon]) => `<option value="${id}"${shopWeaponType === id ? " selected" : ""}>${esc(weapon.name)}</option>`).join("")}</select></div>`;
        for (const [id, d] of Object.entries(D.items)) {
          const price = window.BCItemRules.buyPrice(id);
          if (price === null || d.type !== type || (type === "weapon" && shopWeaponType && d.weaponType !== shopWeaponType)) continue;
          html += itemRow(id, null, tradeControls(s,id,"buy"));
        }
        html += "</section>";
      }
      html +=
        '<button data-open="inventory" class="outline-button">เปิดกระเป๋าเพื่อขายของ →</button>';
    }
    if (panel === "hotbar") {
      html =
        '<p class="panel-note">เลือกสกิลที่เรียน ไอเทม หรือการกระทำในช่อง 1–9 การจัดช่องจะบันทึกไปพร้อมเซฟ<br>Class 2 มีสกิลกดใช้รวมปฐมพยาบาล 7 สกิล เหลือ 2 ช่องสำหรับยา · สกิลติดตัวทำงานเองโดยไม่ใช้ช่อง</p>';
      s.hotbar.forEach(
        (v, i) =>
          (html += `<div class="bind-row"><label for="bind-value-${i}">ช่อง <kbd>${i + 1}</kbd></label><select id="bind-value-${i}" data-bind="${i}">${optionsBinding(v)}</select></div>`),
      );
    }
    if (panel === "auto") {
      html = `${questAutoCard(s)}<p class="panel-note">Auto Battle จะหาเป้าหมายและต่อสู้ในแมปปัจจุบัน · Auto Quest จะเลือกเฉพาะมอนสเตอร์ที่ต้องใช้ในภารกิจ ทำงานเฉพาะขณะหน้าเกมเปิดและฟาร์มต่อได้แม้เปิดเมนูทับอยู่</p><div class="settings-row"><label for="auto-potion">ใช้ยา HP เมื่อเลือดต่ำกว่า</label><select id="auto-potion">${[0, 20, 40, 60, 80, 90].map((n) => `<option value="${n}" ${s.settings.autoPotion === n ? "selected" : ""}>${n ? n + "%" : "ไม่ใช้ยา"}</option>`).join("")}</select></div><div class="settings-row"><label for="auto-skill">ใช้สกิลอาชีพที่เรียนแล้วเมื่อเหมาะกับเป้าหมาย</label><input type="checkbox" id="auto-skill" ${s.settings.autoSkill ? "checked" : ""}></div>`;
    }
    if (panel === "settings") {
      html = `<p class="panel-note">ความคืบหน้าเก็บในเบราว์เซอร์และที่อยู่ที่เล่นนี้ ใช้ Export เพื่อย้ายเครื่องหรือสำรองเซฟ</p><div class="settings-row"><label for="hair-select">สีผมของนักผจญภัย</label><select id="hair-select">${["น้ำตาล", "ทองเข้ม", "ดำ", "แดงอิฐ", "ทองอ่อน", "เทาอมฟ้า"].map((n, i) => `<option value="${i}" ${s.settings.hair === i ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="settings-actions">${button("save", "บันทึกเกม")}${button("export", "Export Save")}${button("import", "Import Save")}</div><p class="panel-note">Export Save เพื่อสำรองความคืบหน้า และ Import Save เพื่อเล่นต่อ</p><hr class="section-rule"><p class="panel-note">เริ่มต้นการผจญภัยใหม่จะล้างความคืบหน้าปัจจุบัน ควร Export ไว้ก่อน</p>${button("reset", "เริ่มเกมใหม่", "", 'class="danger"')}`;
    }
    if (panel === "codex") {
      html = `<div class="codex-tabs" aria-label="หมวดคู่มือ">${[["world", "โลกและมอนสเตอร์"], ["items", "สารานุกรมไอเทม"]].map(([id, name]) => `<button data-codex-tab="${id}" aria-pressed="${codexTab === id}">${name}</button>`).join("")}</div>`;
      if (codexTab === "items") html += itemCatalog();
      else {
        html += `<p class="panel-note">${esc(world.intro)}</p><p class="panel-note">สิ่งมีชีวิตแห่งลุ่มน้ำและป่าหิมพานต์ · สมดุลสำหรับการผจญภัยคนเดียว</p>`;
        for (const [id, m] of Object.entries(D.monsters)) {
          const drops = Object.keys(D.items).flatMap((itemId) => window.BCItemRules.sourcesFor(itemId)
            .filter((source) => source.kind === "monster" && source.available && source.name === m.name)
            .map((source) => `${esc(D.items[itemId].name)} ${Number((source.chance * 100).toFixed(2))}% ×${source.min === source.max ? source.min : `${source.min}–${source.max}`}`));
          html += `<div class="item-row" data-monster="${id}"><span class="item-icon" style="color:${m.color}">${m.boss ? "◆" : "●"}</span><div class="item-info"><b>${esc(m.name)} · Lv.${m.level}</b><small>HP ${m.hp} · ${m.attackMagic ? "MATK" : "ATK"} ${m.atk} · DEF ${m.def} / MDEF ${m.mdef}<br>โจมตี${m.attackMagic ? "เวท · ป้องกันด้วย MDEF" : "กายภาพ · ป้องกันด้วย DEF"}<br>EXP ${m.exp} / Job EXP ${m.jexp}<br>${esc(m.description)}</small><details class="item-source-help"><summary>ของดรอปและโอกาสได้รับ</summary><small>${drops.join("<br>")}</small></details></div></div>`;
        }
        html += '<button data-open="map" class="outline-button">ดูเส้นทางทั้งสามแผนที่ →</button>';
      }
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
      html = `<div class="help-list"><p>${esc(world.intro)}</p><p><kbd>WASD / ลูกศร</kbd> เดิน · คลิกพื้นเพื่อเดินไปตำแหน่งนั้น</p><p><kbd>SPACE</kbd> เลือกศัตรูใกล้สุดและเข้าต่อสู้ · คลิกตัวมอนสเตอร์เพื่อเลือกเอง</p><p><kbd>1–9</kbd> ใช้ Hotbar · <kbd>H</kbd> ใช้ยา HP · <kbd>F</kbd> Auto Battle</p><p><kbd>E</kbd> คุย NPC ใกล้ตัว · <kbd>I</kbd> กระเป๋า · <kbd>Q</kbd> เควสต์ · <kbd>M</kbd> แผนที่ · <kbd>Esc</kbd> ปิดเมนู</p><p>เปิดกระเป๋า → หมวดอุปกรณ์ → เลือกอาวุธหรือหมวก → สวมใส่ อาวุธต้องตรงกับประเภทของอาชีพ ซื้ออาวุธสำหรับอาชีพถัดไปเก็บได้ ภาพชุดและท่าถือเป็นแบบประจำอาชีพถาวร อาวุธที่สวมเพิ่มค่าสถานะ ถอดแล้วใช้รูปลักษณ์อาวุธฝึกโดยไม่มีโบนัส ดาบและโล่อยู่ในช่องอาวุธเดียวกัน</p><p>คุย${esc(npc("guide").name)}ที่${esc(npc("guide").thai)}เพื่อรับและส่งเควสต์ ชาวบ้าน Job Lv.10 เลือก Class 1 ได้ 5 อาชีพ จากนั้น Job Lv.40 รับการทดสอบเพื่อเลือก Class 2 หนึ่งในสองเส้นทาง ต้องอยู่ใกล้ครูอิน การทดสอบนับเฉพาะตัวที่กำจัดหลังรับ เมื่อเปลี่ยนอาชีพ Job Lv.เริ่มที่ 1 และสืบทอดสกิลเดิม โดยไม่แจกอาวุธหรืออัฐ</p><p>ซุ้มทางเดินอยู่ริมแผนที่ซ้ายและขวา เดินจาก${esc(D.maps[0].name)}สู่${esc(D.maps[1].name)}และ${esc(D.maps[2].name)} ${esc(npc("healer").name)}ที่${esc(npc("healer").thai)}ฟื้น HP/SP ฟรี เมื่อล้มจะกลับท่าน้ำพร้อมความคืบหน้าเดิม</p><p>เปิด Auto Battle หรือ Auto Quest แล้วฟาร์มต่อได้ระหว่างเปิดเมนู ย่อหน้าต่าง หรือสลับแท็บ หากเบราว์เซอร์พักการทำงาน ระบบจะคำนวณเวลาที่ค้างเมื่อกลับมา ต้องเปิดหน้าเกมไว้ · บันทึกอัตโนมัติทุก 10 วินาที และควร Export Save เป็นระยะ</p></div>`;
    if (panel === "help")
      html += `<div class="help-list stat-guide-note"><p>สเตตัสเริ่มที่ 1 ทั้ง 6 ค่า พร้อม 48 แต้ม ใช้แต้มมากขึ้นทุกช่วง 10 ค่า ดูค่าใช้จ่ายที่ปุ่ม ＋ ในหน้าสเตตัส STR ใช้กับอาวุธประชิด, DEX ใช้กับธนู, INT ใช้กับคทา หนังสือ และแก้วมณี ธนูมนตรายิงปกติใช้ DEX สกิลเวทใช้ INT และเรียนศรสองศาสตร์เพื่อให้ DEX เสริมเวทได้ อักขระจู่โจมและคลื่นอาคมใช้ MATK เมื่อถือหนังสือ และเปลี่ยนเป็น ATK เมื่อเป็นนักสู้ครุฑาสายสนับมือ</p><p>AGI ช่วยความเร็วตีและหลบกายภาพ, VIT เพิ่ม HP ป้องกันและผลยา HP, INT เพิ่ม SP ป้องกันเวทและผลยา SP ส่วน LUK ช่วยคริติคอลกายภาพและหลบสมบูรณ์ คริเฉพาะตีปกติกายภาพ ความเสียหาย ×1.4 ไม่ใช้กับสกิลหรือเวท ความเร็วเดินและคูลดาวน์สกิลคงเดิม</p><p>นักดาบอรุณมีสกิล 10 สกิล: 7 สกิลหลักเรียนได้ถึงระดับ 10 และ 3 สกิลพิเศษเรียนฟรีกับครูอิน ส่วนอาชีพอื่นมีสกิลประจำอาชีพ 4 สกิลถึงระดับ 5 เมื่อเปลี่ยน Class 2 จะสืบทอดสกิล Class 1 สกิลติดตัวไม่ใช้ช่อง Hotbar จัดแต้มในผังก่อนยืนยัน และเรียนสกิลที่เป็นเงื่อนไขให้ครบก่อน สกิลคลั่งอัตโนมัติต้องเปิดเองหนึ่งครั้งแล้วทำงานเมื่อ HP ต่ำกว่า 25%</p><p>DEF ป้องกันกายภาพ ส่วน MDEF ป้องกันเวท เช่น ${esc(D.monsters.willow.name)} อุปกรณ์ระบุ ATK / MATK แยกกัน เปิดรายละเอียดในหน้าสเตตัสเพื่อดูส่วนพื้นฐาน ส่วนเกราะ และอัตราฟื้นฟู</p><p>คุย${esc(npc("guide").name)}ที่${esc(npc("guide").thai)}เพื่อรีสเตตัสฟรี คืนแต้มที่ลงไว้ทั้งหมดและจัดบิลด์ใหม่ได้ โดยคงอาชีพ อุปกรณ์ และความคืบหน้า</p></div>`;
    $("side-panel").innerHTML = html;
    if ($("status-portrait")) R.portrait($("status-portrait"), s);
    if (["status", "equipment", "npc"].includes(panel)) $("side-panel").insertAdjacentHTML("beforeend", classSelector(s));
    if ($("equipment-portrait")) R.portrait($("equipment-portrait"), s);
    updateSkillReadiness();
    updateTrades();
  }
  function bindingInfo(value) {
    if (!value) return { label: "ว่าง", icon: "", color: "#879c7f" };
    const [kind, id] = value.split(":");
    if (kind === "skill") {
      const d = D.skills[id];
      if (!d || !C.skillAvailable(state, id) || SkillRules.isPassive(id))
        return { label: "ว่าง · สกิลที่ยังใช้ไม่ได้", icon: "", color: "#879c7f", locked: true };
      return {
        label: `${d.name} · SP ${SkillRules.spCost(state, id,id==="swordsman_auto_berserk"&&state.classCombat?.autoBerserk?.enabled)} · รอ ${d.cooldown} วินาที`,
        icon: artIcon(id),
        color: d.color,
        locked: !state.skills[id] || !C.skillAvailable(state, id),
        cooldown: d.cooldown > 0 ? (state.cooldowns[id] || 0) / d.cooldown : 0,
        skillId: id,
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
    const sig = JSON.stringify([state.classId, state.hotbar, state.inventory, state.skills]);
    if (sig !== hotSignature) {
      hotSignature = sig;
      $("hotbar-slots").innerHTML = state.hotbar
        .map((v, i) => {
          const d = bindingInfo(v);
          return `<button class="hot-slot ${d.locked ? "locked" : ""}" data-hot="${i}" title="${d.label} · ปุ่ม ${i + 1}" aria-label="ช่อง ${i + 1}: ${d.label}"><small>${i + 1}</small>${d.stock === undefined ? "" : `<span class="stock">${d.stock}</span>`}<span class="glyph" style="color:${d.color}">${d.icon}</span><span class="slot-label">${d.label}</span><span class="cooldown" id="cool-${i}"></span></button>`;
        })
        .join("");
    }
    state.hotbar.forEach((value,i)=>{
      const info=bindingInfo(value),slot=$("hotbar-slots").querySelector(`[data-hot="${i}"]`),overlay=$("cool-"+i);
      const attack=value==="action:attack",r=info.skillId?C.actionReadiness(state,info.skillId):attack?C.actionReadiness(state,"attack"):null;
      const busy=["action","aftercast","flinch"].includes(r?.source),blocked=info.locked||info.skillId&&!r.ready||attack&&busy;
      slot.disabled=!!blocked;slot.classList.toggle("action-busy",busy);
      slot.dataset.readinessSource=r?.source||"";slot.dataset.readinessRemaining=String(r?.remaining||0);
      const reason=r&&!r.ready?r.reason:"";
      slot.title=`${info.label}${reason?` · ${reason}`:""} · ปุ่ม ${i+1}`;
      slot.setAttribute("aria-label",`ช่อง ${i+1}: ${info.label}${reason?` · ${reason}`:""}`);
      const fraction=Math.max(info.cooldown||0,busy?r.remaining/(r.source==="aftercast"?2:r.source==="flinch" ? .12 : info.skillId ? .45 : .28):0);
      overlay.style.height=Math.max(0,Math.min(1,fraction))*100+"%";
      overlay.textContent=r?.remaining>0?(Math.ceil(r.remaining*10)/10).toFixed(1):"";
    });
  }
  function updateHUD() {
    const s = state,
      st = C.stats(s),
      map = D.maps[s.zone];
    $("hero-name").textContent = className(s);
    $("job-level").textContent = classLabel(s);
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
    $("weight-val").textContent = `${numberText(st.weight)} / ${numberText(st.capacity)}`;
    $("weight-val").title = `น้ำหนัก ${(st.weight/st.capacity*100).toFixed(1)}% · 50% หยุดฟื้น HP/SP · 90% หยุดโจมตี`;
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
    updateQuestAutoUI();
    const target = s.monsters.find((m) => m.uid === s.target && !m.dead);
    $("target-box").hidden = !target;
    if (target) {
      const d = D.monsters[target.kind];
      $("target-box").innerHTML =
        `${d.name} · ${Math.ceil(target.hp)} / ${d.hp}${d.attackMagic ? ' · เวท (MDEF)' : ''}<div class="target-meter"><i style="width:${Math.max(0, (target.hp / d.hp) * 100)}%"></i></div>`;
    }
    R.minimap($("minimap"), s);
    R.portrait($("portrait"), s);
    if ($("status-portrait")) R.portrait($("status-portrait"), s);
    if ($("equipment-portrait")) R.portrait($("equipment-portrait"), s);
    updateHotbar();
    updateSkillReadiness();
    updateSkillAllocation();
    updateTrades();
    let statusBar=$("active-skill-status");
    if(!statusBar){statusBar=document.createElement("div");statusBar.id="active-skill-status";statusBar.setAttribute("aria-label","สถานะสกิล");document.querySelector(".card.character").append(statusBar);}
    const statuses=Object.entries(s.classCombat?.buffs||{}).filter(([,b])=>b.remaining>0&&!("shieldRemaining" in b&&b.shieldRemaining<=0)&&!("empowerRemaining" in b&&b.empowerRemaining<=0)).map(([id,b])=>`${D.skills[id]?.name||"บัฟ"} ${Math.ceil(b.remaining)}s${b.shieldRemaining>0?` · โล่ ${Math.ceil(b.shieldRemaining)}`:""}`);
    if(s.classCombat?.orbTimer>0&&s.classCombat.orbCharges>0)statuses.push(`มณี ${s.classCombat.orbCharges}/3 · ${Math.ceil(s.classCombat.orbTimer)}s`);
    const statusKey=statuses.join("|");if(statusBar.dataset.value!==statusKey){statusBar.dataset.value=statusKey;statusBar.innerHTML=statuses.map(text=>`<span>${esc(text)}</span>`).join("");}statusBar.hidden=!statuses.length;
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
    if (kind === "skill") {
      if (!C.skillAvailable(state, id) || SkillRules.isPassive(id)) {
        toast("ช่องนี้ยังใช้สกิลไม่ได้ · เลือกจัด Hotbar เพื่อใส่สกิลอาชีพที่เรียนแล้ว");
        return;
      }
      run("skill", { id });
    } else if (kind === "item") run("use", { id });
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
    if (!readyForAction()) return;
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
    if (!b || b.disabled) return;
    if (b.hasAttribute("data-trade-adjust") || b.hasAttribute("data-trade-max")) {
      const box=b.closest('.trade-controls');
      if(!box)return;
      const id=box.dataset.tradeId,mode=box.dataset.tradeMode,input=box.querySelector('[data-trade-qty]');
      const q=window.BCItemRules.tradeQuote(state,id,mode,tradeQuantity(input.value),C.stats(state));
      const current=tradeQuantity(input.value);
      const amount=b.hasAttribute('data-trade-max')?q.maxQuantity:Math.max(1,Math.min(q.limit,(Number.isSafeInteger(current)?current:0)+Number(b.dataset.tradeAdjust)));
      if(amount<1)return;
      input.value=String(amount);tradeQuantities.set(`${mode}:${id}`,input.value);
      updateTrades();input.focus({preventScroll:true});
      return;
    }
    if (b.dataset.skillSelect) {
      const id=b.dataset.skillSelect;
      if(panel!=="skills"||skillsTab!=="tree"||!C.skillAvailable(state,id))return;
      selectedTreeSkill=id;
      rerenderSkillTree(`[data-skill-select="${id}"]`);
      return;
    }
    if (b.dataset.skillAdjust) {
      if(panel!=="skills"||skillsTab!=="tree")return;
      const id=b.dataset.skillAdjust,delta=Number(b.dataset.delta);
      const result=window.BCSkillTree.adjustAllocation(state,skillAllocation,id,delta);
      if(!result.ok){toast(result.message);return;}
      skillAllocation=result.draft;selectedTreeSkill=id;
      rerenderSkillTree(`[data-skill-adjust="${id}"][data-delta="${delta}"]`);
      return;
    }
    if (b.hasAttribute("data-plan-apply")) {
      if(panel==="skills"&&skillsTab==="tree")applySkillAllocation();
      return;
    }
    if (b.hasAttribute("data-plan-reset")) {
      if(panel!=="skills"||skillsTab!=="tree")return;
      skillAllocation=window.BCSkillTree.createAllocation(state);
      rerenderSkillTree(`[data-skill-select="${selectedTreeSkill}"]`);
      return;
    }
    if (b.dataset.skillsTab) {
      skillsTab = b.dataset.skillsTab === "tree" ? "tree" : "current";
      renderPanel();
      $("side-panel").querySelector(`[data-skills-tab="${skillsTab}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (b.dataset.codexTab) {
      codexTab = b.dataset.codexTab === "items" ? "items" : "world";
      renderPanel();
      $("side-panel").querySelector(`[data-codex-tab="${codexTab}"]`)?.focus({ preventScroll: true });
      return;
    }
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
    if (!readyForAction()) return;
    if (a === "buy" || a === "sell") {
      const box=b.closest('.trade-controls');
      if(!box)return;
      const id=box.dataset.tradeId,input=box.querySelector('[data-trade-qty]'),scroll=$("panel-window").scrollTop;
      tradeQuantities.set(`${a}:${id}`,input.value);
      run(a,{id,qty:tradeQuantity(input.value)});
      $("panel-window").scrollTop=scroll;
      $("side-panel").querySelector(`[data-trade-mode="${a}"][data-trade-id="${id}"] [data-trade-qty]`)?.focus({preventScroll:true});
      return;
    }
    if (a === "auto-quest" || a === "auto-quest-stop") {
      toggleQuestAuto(a);
      return;
    }
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
    if (a === "walk-guide") {
      walkToGuide();
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
        tradeQuantities.clear();
        state = C.createState();
        simulation.reset(Date.now());
        clearManualMovement();
        shopVisit = false;
        guideVisit = false;
        questBlockNotice = "";
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
    if ((el.dataset.bind !== undefined || ["hair-select", "auto-potion", "auto-skill"].includes(el.id)) && !readyForAction()) {
      renderPanel();
      return;
    }
    if (["catalog-type", "catalog-collection", "catalog-status", "catalog-weapon-type", "catalog-grade"].includes(el.id)) {
      if (el.id === "catalog-type") catalogType = Object.hasOwn(itemTypeNames, el.value) ? el.value : "all";
      else if (el.id === "catalog-collection") {
        catalogCollection = ["regular", "upgrades", "all"].includes(el.value) ? el.value : "regular";
      } else if (el.id === "catalog-status") {
        catalogStatus = Object.hasOwn(availabilityNames, el.value) ? el.value : "all";
      } else if (el.id === "catalog-weapon-type") catalogWeaponType = Object.hasOwn(D.itemCatalog.progressions, el.value) ? el.value : "all";
      else catalogGrade = ["1", "2", "3"].includes(el.value) ? el.value : "all";
      renderPanel();
      $(el.id).focus({ preventScroll: true });
    } else if (el.id === "shop-weapon-type") {
      shopWeaponType = Object.hasOwn(D.weaponTypes || {}, el.value) ? el.value : "";
      renderPanel();
      $("shop-weapon-type").focus({ preventScroll: true });
    } else if (el.dataset.bind !== undefined) {
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
  document.addEventListener("toggle", (event) => {
    if (event.target.matches(".weapon-progressions")) catalogPathsOpen = event.target.open;
  }, true);
  document.addEventListener("input", (event) => {
    const el = event.target;
    if (el.matches('[data-trade-qty]')) {
      const box=el.closest('.trade-controls');
      tradeQuantities.set(`${box.dataset.tradeMode}:${box.dataset.tradeId}`,el.value);
      updateTrades();return;
    }
    if (el.id !== "catalog-search") return;
    catalogSearch = el.value;
    const position = el.selectionStart;
    renderPanel();
    $("catalog-search").focus({ preventScroll: true });
    if (position !== null) $("catalog-search").setSelectionRange(position, position);
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
      if (event.target.matches("[data-skills-tab]") && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        skillsTab = event.key === "Home" ? "current" : event.key === "End" ? "tree" : skillsTab === "current" ? "tree" : "current";
        renderPanel();
        $("side-panel").querySelector(`[data-skills-tab="${skillsTab}"]`).focus({ preventScroll: true });
        return;
      }
      if (event.key === "Tab") {
        const focusable = [
          ...$("panel-window").querySelectorAll(
            "button:not(:disabled),select:not(:disabled),input:not(:disabled),summary",
          ),
        ].filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
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
      if (!readyForAction()) return;
      shopVisit = false;
      guideVisit = false;
      if (C.autoQuestStatus(state).active) run("auto-quest-stop");
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
    if (!pumping) pump(Date.now());
    keys.delete(key);
    if (!keys.size) clearManualMovement();
  });
  function suspend() {
    clearManualMovement();
    pump(Date.now());
    save();
  }
  function resume() {
    pump(Date.now());
  }
  window.addEventListener("blur", suspend);
  window.addEventListener("focus", resume);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspend();
    else resume();
  });
  window.addEventListener("pagehide", suspend);
  function simulationStep(dt) {
      if (!panel && !document.hidden && keys.size) {
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
          manualDestination = state.destination;
        } else state.destination = null;
      }
      C.tick(state, dt);
      if (
        !keys.size &&
        state.destination &&
        C.dist(state.player, state.destination) < 2
      )
        state.destination = null;
      if (!C.autoQuestStatus(state).active && Math.abs(state.player.y - 280) < 48) {
        if (state.player.x > 904 && state.zone < 2)
          C.act(state, "travel", { direction: 1 });
        else if (state.player.x < 56 && state.zone > 0)
          C.act(state, "travel", { direction: -1 });
      }
      if (shopVisit && (state.zone !== 0 || !state.destination)) {
        shopVisit = false;
        if (nearMerchant()) openPanel("shop");
      }
      if (guideVisit && (state.zone !== 0 || !state.destination)) {
        guideVisit = false;
        if (nearGuide()) openPanel("npc");
      }
      notifyQuestBlock();
  }
  function pump(now) {
    if (pumping) return { behind: simulation.pendingSeconds >= Clock.STEP };
    pumping = true;
    let result;
    try { result = simulation.advance(now, simulationStep); }
    finally { pumping = false; }
    const banner = $("pause-banner");
    banner.hidden = !result.behind;
    if (result.behind) {
      banner.textContent = `กำลังคำนวณการฟาร์มต่อเนื่อง • เหลือ ${Math.ceil(result.pendingSeconds)} วินาที`;
      if (catchupTimer === null) catchupTimer = setTimeout(() => {
        catchupTimer = null;
        pump(Date.now());
      }, 0);
    }
    hudTime += result.steps * Clock.STEP;
    if (!document.hidden && hudTime >= .12) { updateHUD(); hudTime = 0; }
    if (now - lastSaveAt >= 10000) {
      lastSaveAt = now;
      save();
    }
    return result;
  }
  setInterval(() => pump(Date.now()), 250);
  function frame() {
    pump(Date.now());
    R.draw($("game"), state);
    requestAnimationFrame(frame);
  }
  window.BCGame = {
    get state() {
      return state;
    },
    loadSave,
    save: () => save(true),
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
  else if(state.swordMigration?.refundedPoints) setTimeout(()=>toast(`อัปเดตสกิลนักดาบแล้ว · คืนแต้ม ${state.swordMigration.refundedPoints} แต้ม จัดใหม่ได้ในผังสกิล`),500);
  else
    setTimeout(
      () => toast(`ยินดีต้อนรับสู่${world.title} • คุย${npc("guide").name}เพื่อรับภารกิจแรก`),
      500,
    );
})();
