(function () {
  "use strict";
  const D = window.BCData,
    C = window.BCCore,
    R = window.BCRender,
    $ = (id) => document.getElementById(id);
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
      "borderlands-save-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("ส่งออกเซฟแล้ว • เก็บไฟล์นี้ไว้ใช้ Import");
  }
  function loadSave(text) {
    const next = C.deserialize(text);
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
    codex: "คู่มือโลก Borderlands",
    log: "บันทึกการเดินทาง",
    settings: "ตั้งค่าการผจญภัย",
    hotbar: "จัด Hotbar",
    auto: "Auto Battle",
    help: "คู่มือนักผจญภัย",
    npc: "Guild Guide",
    map: "เส้นทางการเดินทาง",
  };
  function openPanel(name) {
    if (!titleNames[name]) return;
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
    panel = null;
    $("panel-window").hidden = true;
    $("panel-backdrop").hidden = true;
    if (lastFocus && lastFocus.isConnected)
      lastFocus.focus({ preventScroll: true });
    else $("game").focus({ preventScroll: true });
  }
  const icon = (id) =>
    `<span class="item-icon" style="color:${D.items[id].color}">${D.items[id].icon}</span>`;
  const button = (act, label, id = "", extra = "") =>
    `<button data-act="${act}"${id ? ` data-id="${id}"` : ""} ${extra}>${label}</button>`;
  const itemMeta = (i) =>
    [
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
      html = `<p class="panel-note">${s.job} · Base Lv.${s.baseLevel} · แต้มสเตตัส <b>${s.statPoints}</b><br>สเตตัสใช้กฎ SOLO ของเกมนี้ เพิ่มหนึ่งค่าต่อหนึ่งแต้ม</p>`;
      for (const [id, name] of Object.entries(D.statNames))
        html += `<div class="stat-row"><span>${name}</span><b>${s.stats[id]}</b>${button("stat", "＋", id, s.statPoints > 0 && s.stats[id] < 99 ? "" : "disabled")}</div>`;
      html += `<div class="stat-summary">${[
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
      html = `<p class="panel-note">น้ำหนัก ${st.weight} / ${st.capacity} · ตั้งแต่ 50% หยุดฟื้น HP/SP · ตั้งแต่ 90% ห้ามโจมตี<br>ซื้อขายได้เมื่ออยู่ใกล้ Merchant เท่านั้น</p>`;
      for (const [id, n] of Object.entries(s.inventory))
        if (n > 0) {
          const i = D.items[id];
          let actions =
            i.type === "use"
              ? button("use", "ใช้", id)
              : ["weapon", "armor", "accessory"].includes(i.type)
                ? button("equip", "สวมใส่", id)
                : "";
          actions += button(
            "sell",
            "ขาย " + Math.max(1, Math.floor(i.price / 2)) + " ◈",
            id,
          );
          html += itemRow(id, n, actions);
        }
      if (!Object.keys(s.inventory).some((k) => s.inventory[k] > 0))
        html += '<p class="empty">กระเป๋าว่าง • ลองออกสำรวจหาไอเทม</p>';
      html +=
        '<button data-open="hotbar" class="outline-button">ใส่ไอเทมหรือสกิลใน Hotbar →</button>';
    }
    if (panel === "equipment") {
      html =
        '<p class="panel-note">อุปกรณ์ที่สวมมีผลกับ ATK / DEF และนับรวมในน้ำหนักกระเป๋า</p>';
      for (const [slot, name] of [
        ["weapon", "อาวุธ"],
        ["armor", "เกราะ"],
        ["accessory", "เครื่องประดับ"],
      ]) {
        html += `<div class="shop-title">${name}</div>`;
        html += s.equipment[slot]
          ? itemRow(
              s.equipment[slot],
              null,
              `<button data-act="unequip" data-slot="${slot}">ถอด</button>`,
            )
          : '<p class="subtle">ยังไม่ได้สวมใส่</p>';
      }
    }
    if (panel === "skills") {
      html = `<p class="panel-note">${s.job} · Job Lv.${s.jobLevel} · แต้มสกิล <b>${s.skillPoints}</b><br>Novice Job Lv.10 → คุย Guild Guide เพื่อเปลี่ยนเป็น Swordman</p>`;
      for (const [id, d] of Object.entries(D.skills))
        html += `<div class="skill-card"><span class="item-icon" style="color:${d.color}">${d.icon}</span><div class="item-info"><b>${d.name} <span class="subtle">Lv.${s.skills[id]} / ${d.max}</span></b><small>${d.thai} · SP ${d.sp} · รอ ${d.cooldown} วินาที<br>${d.description}</small></div>${id === "first_aid" ? '<span class="subtle">เริ่มต้น</span>' : button("learn", "เรียน", id, s.job === "Swordman" && s.skillPoints > 0 && s.skills[id] < d.max ? "" : "disabled")}</div>`;
      html +=
        '<button data-open="hotbar" class="outline-button">จัดสกิลลง Hotbar →</button>';
    }
    if (panel === "quest" || panel === "npc") {
      if (panel === "npc")
        html = `<p class="panel-note">ยินดีต้อนรับ นักผจญภัย! เริ่มจากฝึกต่อสู้ในทุ่งนี้ แล้วออกเดินทางไปยังป่าและถ้ำทางตะวันออก</p><div class="settings-actions">${button("job", s.job === "Swordman" ? "คุณเป็น Swordman แล้ว" : "เปลี่ยนอาชีพ → Swordman", "", s.job === "Novice" && s.jobLevel >= 10 ? 'class="primary"' : "disabled")}</div>`;
      D.quests.forEach((q, i) => {
        html += `<article class="quest-detail ${i < s.quest ? "done" : ""}"><div class="eyebrow">${i < s.quest ? "COMPLETED" : i === s.quest ? "CURRENT CHAPTER" : "NEXT CHAPTER"} · 0${i + 1}</div><h3>${q.title}</h3><p>${q.text} (${Math.min(s.kills[q.kind] || 0, q.count)} / ${q.count})</p><p>รางวัล ${q.silver} Silver · ${q.exp} EXP</p>${i === s.quest ? button("quest", s.questActive ? "รับรางวัลจาก Guild Guide" : "รับภารกิจจาก Guild Guide") : i < s.quest ? "✓ สำเร็จแล้ว" : ""}</article>`;
      });
      if (s.quest >= D.quests.length)
        html +=
          '<p class="panel-note">✦ บทแรกของคุณจบลงแล้ว แต่โลกนี้ยังรอให้คุณออกสำรวจเสมอ</p>';
    }
    if (panel === "shop") {
      html = `<p class="panel-note">เงิน ${s.silver} Silver · ซื้อขายกับ Merchant ใน Starter Meadow<br>หากอยู่ไกลให้คลิกกลับแผนที่ แล้วเดินมาที่ร้านก่อน</p>`;
      for (const [id, d] of Object.entries(D.items))
        if (d.type !== "loot")
          html += itemRow(id, null, button("buy", d.price + " ◈", id));
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
      html = `<p class="panel-note">Auto จะหาเป้าหมาย เดินเข้าระยะ และใช้กฎต่อสู้เดียวกับการเล่นเอง ทำงานเฉพาะขณะหน้าเกมเปิดและไม่มีหน้าต่างเมนูทับอยู่</p><div class="settings-row"><label for="auto-potion">ใช้ยา HP เมื่อเลือดต่ำกว่า</label><select id="auto-potion">${[0, 20, 40, 60, 80, 90].map((n) => `<option value="${n}" ${s.settings.autoPotion === n ? "selected" : ""}>${n ? n + "%" : "ไม่ใช้ยา"}</option>`).join("")}</select></div><div class="settings-row"><label for="auto-skill">ใช้ Bash เมื่อเรียนแล้ว</label><input type="checkbox" id="auto-skill" ${s.settings.autoSkill ? "checked" : ""}></div>`;
    }
    if (panel === "settings") {
      html = `<p class="panel-note">ความคืบหน้าเก็บในเบราว์เซอร์และที่อยู่ที่เล่นนี้ ใช้ Export เพื่อย้ายเครื่องหรือสำรองเซฟ</p><div class="settings-row"><label for="hair-select">สีผมของนักผจญภัย</label><select id="hair-select">${["น้ำตาล", "ทองเข้ม", "ดำ", "แดงอิฐ", "ทองอ่อน", "เทาอมฟ้า"].map((n, i) => `<option value="${i}" ${s.settings.hair === i ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="settings-actions">${button("save", "บันทึกเกม")}${button("export", "Export Save")}${button("import", "Import Save")}</div><p class="panel-note">รองรับเซฟ Borderlands Rebuilt รุ่น 1 • เซฟจากเกมรุ่นเก่าใช้ร่วมกันไม่ได้</p><hr class="section-rule"><p class="panel-note">เริ่มต้นการผจญภัยใหม่จะล้างความคืบหน้าปัจจุบัน ควร Export ไว้ก่อน</p>${button("reset", "เริ่มเกมใหม่", "", 'class="danger"')}`;
    }
    if (panel === "codex") {
      html =
        '<p class="panel-note">สิ่งมีชีวิตทั้งเจ็ดแห่ง Borderlands · ตัวเลขเป็นสมดุล SOLO ของเกมนี้</p>';
      for (const [id, m] of Object.entries(D.monsters))
        html += `<div class="item-row"><span class="item-icon" style="color:${m.color}">${m.boss ? "◆" : "●"}</span><div class="item-info"><b>${m.name} · Lv.${m.level}</b><small>HP ${m.hp} · ATK ${m.atk} · DEF ${m.def}<br>EXP ${m.exp} / Job EXP ${m.jexp} · ของดรอป ${D.items[m.drop].name}</small></div></div>`;
      html +=
        '<button data-open="map" class="outline-button">ดูเส้นทางทั้งสามแผนที่ →</button>';
    }
    if (panel === "map")
      html =
        '<p class="panel-note">เดินไปที่ซุ้มประตูริมแผนที่เพื่อเดินทาง ทุกแผนที่ย้อนกลับได้</p>' +
        D.maps
          .map(
            (m, i) =>
              `<article class="quest-detail"><div class="eyebrow">CHAPTER 0${i + 1}${s.zone === i ? " · คุณอยู่ที่นี่" : ""}</div><h3>${m.name} · ${m.thai}</h3><p>${[...new Set(m.mobs)].map((id) => D.monsters[id].name).join(" · ")}</p></article>`,
          )
          .join("");
    if (panel === "log")
      html = s.log.length
        ? s.log.map((t) => `<div class="log-line">${esc(t)}</div>`).join("")
        : '<p class="empty">ทุกการผจญภัยมีเรื่องราว • ออกไปเริ่มเรื่องของคุณ</p>';
    if (panel === "help")
      html = `<div class="help-list"><p><kbd>WASD / ลูกศร</kbd> เดิน · คลิกพื้นเพื่อเดินไปตำแหน่งนั้น</p><p><kbd>SPACE</kbd> เลือกศัตรูใกล้สุดและเข้าต่อสู้ · คลิกตัวมอนสเตอร์เพื่อเลือกเอง</p><p><kbd>1–9</kbd> ใช้ Hotbar · <kbd>H</kbd> ใช้ยา HP · <kbd>F</kbd> Auto Battle</p><p><kbd>E</kbd> คุย NPC ใกล้ตัว · <kbd>I</kbd> กระเป๋า · <kbd>Q</kbd> เควสต์ · <kbd>M</kbd> แผนที่ · <kbd>Esc</kbd> ปิดเมนู</p><p>คุย Guild Guide เพื่อรับและส่งเควสต์ เมื่อ Job Lv.10 คุยอีกครั้งเพื่อเปลี่ยนเป็น Swordman และเรียนสกิล</p><p>ประตูอยู่ริมแผนที่ซ้ายและขวา Healer ที่หมู่บ้านฟื้น HP/SP ฟรี เมื่อล้มจะกลับหมู่บ้านพร้อมความคืบหน้าเดิม</p><p>เปิดเมนูหรือเปลี่ยนไปแท็บอื่น เกมจะพักให้คุณ บันทึกอัตโนมัติทุก 10 วินาที และควร Export Save เป็นระยะ</p></div>`;
    $("side-panel").innerHTML = html;
  }
  function bindingInfo(value) {
    if (!value) return { label: "ว่าง", icon: "＋", color: "#879c7f" };
    const [kind, id] = value.split(":");
    if (kind === "skill") {
      const d = D.skills[id];
      return {
        label: d.name,
        icon: d.icon,
        color: d.color,
        locked: !state.skills[id],
        cooldown: (state.cooldowns[id] || 0) / d.cooldown,
      };
    }
    if (kind === "item") {
      const d = D.items[id];
      return {
        label: d.name,
        icon: d.icon,
        color: d.color,
        stock: state.inventory[id] || 0,
      };
    }
    return {
      label: { attack: "โจมตี", interact: "คุย NPC", auto: "Auto" }[id],
      icon: { attack: "⚔", interact: "♧", auto: "⟳" }[id],
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
    $("hero-name").textContent = s.job;
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
      s.monsters.filter((m) => !m.dead).length + " MONSTERS";
    $("clock").textContent =
      `${String(Math.floor(s.clock / 60)).padStart(2, "0")}:${String(Math.floor(s.clock % 60)).padStart(2, "0")}`;
    $("combat-mode").textContent = s.auto ? "ON" : "OFF";
    document
      .querySelector('[data-action="auto"]')
      .setAttribute("aria-pressed", String(s.auto));
    const q = D.quests[s.quest];
    $("quest-title").textContent = q ? q.title : "นักผจญภัยแห่ง Borderlands";
    $("quest-description").textContent = q
      ? s.questActive
        ? q.text
        : "คุย Guild Guide เพื่อรับภารกิจ"
      : "คุณทำภารกิจทั้งหมดสำเร็จแล้ว";
    $("quest-count").textContent = q
      ? `${Math.min(s.kills[q.kind] || 0, q.count)} / ${q.count} · ${q.silver} Silver`
      : "✦ การเดินทางยังดำเนินต่อ";
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
    if (a === "reset") {
      if (
        confirm(
          "เริ่มเกมใหม่และแทนที่เซฟปัจจุบัน? หากต้องการเก็บความคืบหน้า ให้ยกเลิกแล้ว Export ก่อน",
        )
      ) {
        state = C.createState();
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
  updateHUD();
  requestAnimationFrame(frame);
  if (storageError) setTimeout(() => toast(storageError), 100);
  else
    setTimeout(
      () => toast("ยินดีต้อนรับ • คุย Guild Guide เพื่อรับภารกิจแรก"),
      500,
    );
})();
