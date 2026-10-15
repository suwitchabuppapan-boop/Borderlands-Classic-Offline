(function (root) {
  "use strict";
  const D =
    typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const jobName = (id) => D.jobs[id].name;
  const npcName = (id) => D.npcs.find((n) => n.id === id).name;
  function createState() {
    const s = {
      version: 1,
      baseLevel: 1,
      jobLevel: 1,
      exp: 0,
      jexp: 0,
      job: "Novice",
      weaponSchool: "sword",
      silver: 45,
      statPoints: 0,
      skillPoints: 0,
      stats: { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 },
      skills: { first_aid: 1, bash: 0, magnum: 0, provoke: 0 },
      inventory: { potion: 5, ether: 3, novice_cap: 1 },
      equipment: {
        weapon: "rusty_sword",
        armor: "cloth_armor",
        accessory: null,
        head: null,
      },
      zone: 0,
      player: { x: 250, y: 310, hp: 150, sp: 50, facing: 0 },
      kills: {},
      quest: 0,
      questActive: false,
      hotbar: [
        "skill:first_aid",
        "skill:bash",
        "skill:magnum",
        "skill:provoke",
        "item:potion",
        "item:ether",
        "action:attack",
        "action:interact",
        "action:auto",
      ],
      settings: { hair: 0, autoPotion: 40, autoSkill: true },
      auto: false,
      target: null,
      destination: null,
      cooldowns: {},
      monsters: [],
      effects: [],
      log: [],
      clock: 0,
      regen: 0,
      seed: 123456789,
    };
    const st = stats(s);
    s.player.hp = st.maxHp;
    s.player.sp = st.maxSp;
    spawn(s);
    return s;
  }
  function stats(s) {
    const equipment = Object.values(s.equipment)
      .filter(Boolean)
      .map((id) => D.items[id]);
    let weight = equipment.reduce((n, i) => n + i.weight, 0);
    for (const [id, n] of Object.entries(s.inventory))
      weight += D.items[id].weight * n;
    const a = s.stats;
    return {
      maxHp:
        90 + a.vit * 10 + s.baseLevel * 10 + (s.job === "Swordman" ? 60 : 0),
      maxSp: 25 + a.int * 5 + s.baseLevel * 2,
      atk:
        8 +
        a.str * 2 +
        s.baseLevel +
        equipment.reduce((n, i) => n + (i.atk || 0), 0),
      def:
        Math.floor(a.vit / 3) + equipment.reduce((n, i) => n + (i.def || 0), 0),
      hit: 80 + a.dex + s.baseLevel,
      flee: a.agi + s.baseLevel,
      crit: Math.min(35, 3 + a.luk * 0.5),
      interval: Math.max(0.3, 1.05 - a.agi * 0.012 - a.dex * 0.003),
      weight,
      capacity: 2000 + a.str * 30 + (s.job === "Swordman" ? 800 : 0),
    };
  }
  function weaponProfile(s) {
    const item = D.items[s.equipment.weapon];
    return D.weaponTypes[item?.weaponType || s.weaponSchool] || D.weaponTypes.sword;
  }
  function attackRange(s) {
    return weaponProfile(s).range;
  }
  function equipReason(s, id) {
    if (
      typeof id !== "string" || !own(D.items, id) ||
      !["weapon", "armor", "accessory", "head"].includes(D.items[id].type)
    ) return "ใส่อุปกรณ์นี้ไม่ได้";
    const item = D.items[id];
    if (item.type === "weapon" && item.weaponType !== (s.weaponSchool || "sword"))
      return `อาวุธนี้ใช้ได้เฉพาะสาย${D.weaponSchools[item.weaponType].name} • เปลี่ยนสายที่เมืองก่อน`;
    if (!(s.inventory[id] > 0)) return "ไม่มีอุปกรณ์นี้ในกระเป๋า";
    return "";
  }
  function random(s) {
    s.seed = (s.seed * 1664525 + 1013904223) >>> 0;
    return s.seed / 4294967296;
  }
  function spawn(s) {
    s.monsters = D.maps[s.zone].mobs.map((kind, i) => ({
      uid: `${s.zone}-${i}`,
      kind,
      x: 410 + (i % 3) * 185,
      y: 135 + Math.floor(i / 3) * 190,
      hp: D.monsters[kind].hp,
      cd: 1 + i * 0.17,
      dead: 0,
      provoke: 0,
    }));
    s.target = null;
    s.destination = null;
  }
  function note(s, text) {
    s.log.unshift(text);
    s.log.length = Math.min(s.log.length, 40);
    return text;
  }
  function effect(s, x, y, text, color = "#fff") {
    s.effects.push({ x, y, text, color, ttl: 1 });
    if (s.effects.length > 40) s.effects.shift();
  }
  function gain(s, exp, jexp) {
    s.exp += exp;
    s.jexp += jexp;
    let leveled = false;
    while (s.baseLevel < 30 && s.exp >= baseNeed(s)) {
      s.exp -= baseNeed(s);
      s.baseLevel++;
      s.statPoints += 3;
      leveled = true;
    }
    while (
      s.jobLevel < (s.job === "Novice" ? 10 : 50) &&
      s.jexp >= jobNeed(s)
    ) {
      s.jexp -= jobNeed(s);
      s.jobLevel++;
      if (s.job === "Swordman") s.skillPoints++;
    }
    if (s.baseLevel === 30) s.exp = 0;
    if (s.jobLevel === (s.job === "Novice" ? 10 : 50)) s.jexp = 0;
    if (leveled) {
      const st = stats(s);
      s.player.hp = st.maxHp;
      s.player.sp = st.maxSp;
      effect(s, s.player.x, s.player.y - 30, "LEVEL UP", "#f3d187");
      note(s, `ระดับตัวละคร ${s.baseLevel} • ได้รับแต้มสเตตัส`);
    }
  }
  const baseNeed = (s) => 25 + s.baseLevel * 18;
  const jobNeed = (s) => 12 + s.jobLevel * 9;
  function nearby(s, id) {
    return (
      s.zone === 0 &&
      dist(
        s.player,
        D.npcs.find((n) => n.id === id),
      ) < 85
    );
  }
  function kill(s, m) {
    if (m.dead) return;
    const d = D.monsters[m.kind];
    m.hp = 0;
    m.dead = d.boss ? 25 : 10;
    s.kills[m.kind] = (s.kills[m.kind] || 0) + 1;
    s.silver += d.silver;
    s.inventory[d.drop] = (s.inventory[d.drop] || 0) + 1;
    gain(s, d.exp, d.jexp);
    note(s, `${d.name} • +${d.exp} EXP · +${d.silver} ${D.world.currency}`);
    effect(s, m.x, m.y, `+${d.exp} EXP`, "#e5d79c");
    if (s.target === m.uid) {
      s.target = null;
      s.destination = null;
    }
  }
  function damage(s, m, mult = 1, always = false) {
    const d = D.monsters[m.kind],
      st = stats(s),
      critical = random(s) * 100 < st.crit;
    if (
      !always &&
      !critical &&
      random(s) * 100 > clamp(st.hit - d.level * 2, 75, 98)
    ) {
      effect(s, m.x, m.y - 20, "MISS", "#bec8cd");
      return;
    }
    const amount = Math.max(
      1,
      Math.round(
        st.atk * mult * (critical ? 1.65 : 1) -
          d.def * (m.provoke > 0 ? 0.5 : 1),
      ),
    );
    m.hp -= amount;
    effect(
      s,
      m.x,
      m.y - 25,
      (critical ? "CRIT " : "") + amount,
      critical ? "#ffdc82" : "#fff3cf",
    );
    if (m.hp <= 0) kill(s, m);
  }
  function doAction(s, action, p = {}) {
    const st = stats(s),
      fail = (message) => ({ ok: false, message }),
      ok = (message = "") => ({ ok: true, message });
    if (action === "move") {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
        return fail("ตำแหน่งไม่ถูกต้อง");
      s.destination = { x: clamp(p.x, 30, 930), y: clamp(p.y, 60, 510) };
      s.target = null;
      s.auto = false;
      return ok();
    }
    if (action === "target") {
      const m = s.monsters.find((m) => m.uid === p.target && !m.dead);
      if (!m) return fail("ไม่พบเป้าหมาย");
      s.target = m.uid;
      s.auto = false;
      return ok();
    }
    if (action === "auto") {
      s.auto = !s.auto;
      s.target = null;
      s.destination = null;
      return ok(s.auto ? "เปิดต่อสู้อัตโนมัติ" : "หยุดต่อสู้อัตโนมัติ");
    }
    if (action === "attack" || action === "skill") {
      if (st.weight >= st.capacity * 0.9)
        return fail("น้ำหนักเกิน 90% • ขายของที่ตลาดท่าน้ำก่อน");
      const id = action === "attack" ? "attack" : p.id;
      if (id !== "attack" && (!own(D.skills, id) || !s.skills[id]))
        return fail("ยังไม่ได้เรียนสกิลนี้");
      if ((s.cooldowns[id] || 0) > 0)
        return fail("กำลังรอสกิลหรือการโจมตีพร้อมใช้งาน");
      const skill = D.skills[id];
      if (skill && s.player.sp < skill.sp) return fail("SP ไม่เพียงพอ");
      const m = s.monsters.find(
        (m) => m.uid === (p.target || s.target) && !m.dead,
      );
      if (
        id !== "first_aid" &&
        id !== "magnum" &&
        (!m || dist(s.player, m) >
          (id === "attack" ? attackRange(s) : id === "provoke" ? 180 : 58))
      )
        return fail("เลือกศัตรูและเดินเข้าใกล้ก่อน");
      if (id === "provoke" && D.monsters[m.kind].boss)
        return fail("คำรามพิทักษ์ใช้กับบอสไม่ได้");
      if (
        id === "magnum" &&
        !s.monsters.some((m) => !m.dead && dist(s.player, m) < 100)
      )
        return fail("ไม่มีศัตรูในระยะ");
      if (skill) s.player.sp -= skill.sp;
      s.cooldowns[id] = skill ? skill.cooldown : st.interval;
      if (id === "first_aid") {
        s.player.hp = Math.min(st.maxHp, s.player.hp + 20);
        effect(s, s.player.x, s.player.y - 30, "+20 HP", "#b6edb8");
      } else if (id === "magnum") {
        s.monsters
          .filter((m) => !m.dead && dist(s.player, m) < 100)
          .forEach((m) => damage(s, m, 1.6 + s.skills.magnum * 0.25, true));
        effect(s, s.player.x, s.player.y, `✹ ${D.skills.magnum.name}`, "#f4b489");
      } else if (id === "provoke") {
        m.provoke = 15;
        effect(s, m.x, m.y - 30, D.skills.provoke.name, "#d7b5ed");
      } else {
        const dx = m.x - s.player.x,
          dy = m.y - s.player.y;
        if (dx || dy)
          s.player.facing =
            Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2;
        damage(s, m, id === "bash" ? 1.5 + s.skills.bash * 0.15 : 1);
        s.cooldowns.swing = 0.22;
      }
      return ok();
    }
    if (action === "use") {
      if (
        !own(D.items, p.id) ||
        D.items[p.id].type !== "use" ||
        !(s.inventory[p.id] > 0)
      )
        return fail("ไม่มีไอเทมนี้ในกระเป๋า");
      const i = D.items[p.id];
      s.inventory[p.id]--;
      if (!s.inventory[p.id]) delete s.inventory[p.id];
      s.player.hp = Math.min(st.maxHp, s.player.hp + (i.hp || 0));
      s.player.sp = Math.min(st.maxSp, s.player.sp + (i.sp || 0));
      effect(
        s,
        s.player.x,
        s.player.y - 30,
        i.hp ? `+${i.hp} HP` : `+${i.sp} SP`,
        i.color,
      );
      return ok(`ใช้ ${i.name}`);
    }
    if (action === "buy" || action === "sell") {
      if (!nearby(s, "merchant"))
        return fail(`เดินเข้าใกล้${npcName("merchant")}ที่${D.maps[0].name}`);
      const qty = p.qty === undefined ? 1 : p.qty;
      if (!Number.isInteger(qty) || qty < 1 || qty > 999)
        return fail("จำนวนไม่ถูกต้อง");
      if (!own(D.items, p.id)) return fail("ไม่พบไอเทม");
      const i = D.items[p.id];
      if (action === "buy") {
        if (i.type === "loot") return fail("ร้านไม่ขายไอเทมนี้");
        if (s.silver < i.price * qty) return fail(`${D.world.currency}ไม่เพียงพอ`);
        if (st.weight + i.weight * qty > st.capacity)
          return fail("น้ำหนักเกินความจุ");
        s.silver -= i.price * qty;
        s.inventory[p.id] = (s.inventory[p.id] || 0) + qty;
      } else {
        if ((s.inventory[p.id] || 0) < qty) return fail("จำนวนไอเทมไม่เพียงพอ");
        s.inventory[p.id] -= qty;
        if (!s.inventory[p.id]) delete s.inventory[p.id];
        s.silver += Math.max(1, Math.floor(i.price / 2)) * qty;
      }
      return ok(`${action === "buy" ? "ซื้อ" : "ขาย"} ${i.name} ×${qty}`);
    }
    if (action === "school") {
      if (s.zone !== 0) return fail("เปลี่ยนสายอาวุธได้เฉพาะในเมืองท่าน้ำอรุณ");
      if (typeof p.id !== "string" || !own(D.weaponSchools, p.id))
        return fail("ไม่พบสายอาวุธนี้");
      const school = D.weaponSchools[p.id];
      const owned = (id) => typeof id === "string" && own(D.items, id) &&
        D.items[id].type === "weapon" && D.items[id].weaponType === school.weaponType &&
        (s.inventory[id] > 0 || s.equipment.weapon === id);
      const id = p.weapon === undefined
        ? Object.keys(D.items).filter(owned).sort((a, b) => D.items[b].atk - D.items[a].atk)[0]
        : p.weapon;
      if (!owned(id))
        return fail(`ต้องมีอาวุธประเภท${D.weaponTypes[school.weaponType].name}ของตนเองเพื่อเปลี่ยนสาย`);
      if (s.weaponSchool === p.id && s.equipment.weapon === id) return ok();
      const old = s.equipment.weapon;
      if (old !== id) {
        s.inventory[id]--;
        if (!s.inventory[id]) delete s.inventory[id];
        if (old) s.inventory[old] = (s.inventory[old] || 0) + 1;
        s.equipment.weapon = id;
      }
      s.weaponSchool = p.id;
      s.destination = null;
      s.target = null;
      s.auto = false;
      return ok(`เปลี่ยนเป็นสาย${school.name}แล้ว • สวม ${D.items[id].name}`);
    }
    if (action === "equip") {
      const reason = equipReason(s, p.id);
      if (reason) return fail(reason);
      const slot = D.items[p.id].type,
        old = s.equipment[slot];
      s.inventory[p.id]--;
      if (!s.inventory[p.id]) delete s.inventory[p.id];
      if (old) s.inventory[old] = (s.inventory[old] || 0) + 1;
      s.equipment[slot] = p.id;
      return ok(`สวม ${D.items[p.id].name}`);
    }
    if (action === "unequip") {
      if (!own(s.equipment, p.slot) || !s.equipment[p.slot])
        return fail("ช่องนี้ว่าง");
      const id = s.equipment[p.slot];
      s.inventory[id] = (s.inventory[id] || 0) + 1;
      s.equipment[p.slot] = null;
      return ok("ถอดอุปกรณ์แล้ว");
    }
    if (action === "stat") {
      if (!own(s.stats, p.id) || s.statPoints < 1 || s.stats[p.id] >= 99)
        return fail("ไม่มีแต้ม หรือค่าสถานะเต็มแล้ว");
      s.stats[p.id]++;
      s.statPoints--;
      return ok("เพิ่มสเตตัสแล้ว");
    }
    if (action === "learn") {
      if (
        !own(D.skills, p.id) ||
        p.id === "first_aid" ||
        s.job !== "Swordman" ||
        s.skillPoints < 1 ||
        s.skills[p.id] >= D.skills[p.id].max
      )
        return fail(`ต้องเป็น${jobName("Swordman")}และมีแต้มสกิล`);
      if (p.id === "magnum" && s.skills.bash < 5)
        return fail(`ต้องเรียน${D.skills.bash.name}ระดับ 5 ก่อน`);
      s.skills[p.id]++;
      s.skillPoints--;
      return ok(`เรียน ${D.skills[p.id].name}`);
    }
    if (action === "job") {
      if (s.job !== "Novice" || s.jobLevel < 10 || !nearby(s, "guide"))
        return fail(
          `${jobName("Novice")}ระดับอาชีพ 10 • คุย${npcName("guide")}เพื่อเปลี่ยนอาชีพ`,
        );
      s.job = "Swordman";
      s.jobLevel = 1;
      s.jexp = 0;
      s.skillPoints = 1;
      s.player.hp = stats(s).maxHp;
      return ok(`ยินดีด้วย! คุณเป็น${jobName("Swordman")}แล้ว`);
    }
    if (action === "quest") {
      if (!nearby(s, "guide"))
        return fail(`คุย${npcName("guide")}เพื่อรับภารกิจหรือรับรางวัล`);
      const q = D.quests[s.quest];
      if (!q) return fail(`คุณทำภารกิจครบแล้ว • ผู้กล้าแห่ง${D.world.title}`);
      if (!s.questActive) {
        s.questActive = true;
        return ok(`รับภารกิจ: ${q.title}`);
      }
      if ((s.kills[q.kind] || 0) < q.count) return fail("ยังทำภารกิจไม่ครบ");
      s.silver += q.silver;
      gain(s, q.exp, q.exp);
      s.quest++;
      s.questActive = false;
      return ok(`ภารกิจสำเร็จ! +${q.silver} ${D.world.currency}`);
    }
    if (action === "heal") {
      if (!nearby(s, "healer"))
        return fail(`เดินเข้าใกล้${npcName("healer")}ที่ศาลาสมุนไพร`);
      s.player.hp = st.maxHp;
      s.player.sp = st.maxSp;
      return ok("พักฟื้น HP / SP เต็มแล้ว");
    }
    if (action === "travel") {
      if (p.direction !== 1 && p.direction !== -1)
        return fail("ประตูไม่ถูกต้อง");
      const z = s.zone + p.direction;
      if (
        z < 0 ||
        z >= D.maps.length ||
        Math.abs(s.player.y - 280) > 65 ||
        (p.direction === 1 ? s.player.x < 885 : s.player.x > 75)
      )
        return fail("เดินไปที่ประตูริมแผนที่");
      s.zone = z;
      s.player.x = p.direction === 1 ? 85 : 865;
      s.player.y = 280;
      s.auto = false;
      spawn(s);
      return ok(`เข้าสู่ ${D.maps[z].name}`);
    }
    if (action === "bind") {
      if (!Number.isInteger(p.slot) || p.slot < 0 || p.slot > 8)
        return fail("ช่องไม่ถูกต้อง");
      if (!validBinding(p.value, s, true))
        return fail("เลือกสกิลที่เรียนแล้วหรือไอเทมใช้แล้วหมด");
      s.hotbar[p.slot] = p.value;
      return ok("จัดแถบลัดแล้ว");
    }
    return fail("คำสั่งไม่ถูกต้อง");
  }
  function act(s, action, p = {}) {
    const r = doAction(s, action, p);
    if (r.message) note(s, r.message);
    return r;
  }
  function recoverPlayer(s) {
    s.zone = 0;
    s.player.x = 250;
    s.player.y = 310;
    s.auto = false;
    s.cooldowns = {};
    s.regen = 0;
    spawn(s);
    const st = stats(s);
    s.player.hp = st.maxHp;
    s.player.sp = st.maxSp;
    note(s, `พักฟื้นที่${D.maps[0].name} • อุปกรณ์และความคืบหน้ายังอยู่`);
  }
  function tick(s, seconds) {
    const dt = clamp(Number.isFinite(seconds) ? seconds : 0, 0, 0.1);
    if (!dt) return;
    s.clock += dt;
    for (const id of Object.keys(s.cooldowns))
      s.cooldowns[id] = Math.max(0, s.cooldowns[id] - dt);
    s.effects = s.effects.filter((e) => (e.ttl -= dt) > 0);
    if (s.player.hp <= 0) {
      recoverPlayer(s);
      return;
    }
    const st = stats(s);
    if (s.auto) {
      if (
        (s.player.hp / st.maxHp) * 100 < s.settings.autoPotion &&
        s.inventory.potion > 0
      )
        doAction(s, "use", { id: "potion" });
      if (!s.monsters.some((m) => m.uid === s.target && !m.dead)) {
        const m = s.monsters
          .filter((m) => !m.dead)
          .sort((a, b) => dist(a, s.player) - dist(b, s.player))[0];
        s.target = m ? m.uid : null;
      }
    }
    const target = s.monsters.find((m) => m.uid === s.target && !m.dead);
    if (target) {
      const gap = dist(target, s.player);
      if (gap > weaponProfile(s).approachRange)
        s.destination = { x: target.x, y: target.y };
      else {
        s.destination = null;
        if (
          s.auto &&
          s.settings.autoSkill &&
          s.skills.bash &&
          gap <= 58 &&
          s.player.sp >= D.skills.bash.sp &&
          !(s.cooldowns.bash > 0)
        )
          doAction(s, "skill", { id: "bash", target: target.uid });
        else doAction(s, "attack", { target: target.uid });
      }
    }
    if (s.destination) {
      const dx = s.destination.x - s.player.x,
        dy = s.destination.y - s.player.y,
        d = Math.hypot(dx, dy),
        step = Math.min(d, 145 * dt);
      if (d < 2) s.destination = null;
      else {
        s.player.x = clamp(s.player.x + (dx / d) * step, 30, 930);
        s.player.y = clamp(s.player.y + (dy / d) * step, 60, 510);
        s.player.facing =
          Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2;
      }
    }
    for (const m of s.monsters) {
      if (m.dead) {
        m.dead = Math.max(0, m.dead - dt);
        if (!m.dead) {
          m.hp = D.monsters[m.kind].hp;
          m.provoke = 0;
          m.cd = 1;
        }
        continue;
      }
      const d = D.monsters[m.kind];
      m.provoke = Math.max(0, m.provoke - dt);
      m.cd = Math.max(0, m.cd - dt);
      const gap = dist(m, s.player);
      if (gap < 175 && s.player.x > 310) {
        if (gap > 40) {
          m.x += ((s.player.x - m.x) / gap) * d.speed * dt;
          m.y += ((s.player.y - m.y) / gap) * d.speed * dt;
        } else if (!m.cd) {
          m.cd = d.boss ? 1.5 : 1.8;
          if (random(s) * 100 < clamp(88 + d.level - st.flee, 55, 96)) {
            const hit = Math.max(
              1,
              Math.round(d.atk * (m.provoke ? 1.2 : 1) - st.def),
            );
            s.player.hp = Math.max(0, s.player.hp - hit);
            effect(s, s.player.x, s.player.y - 35, `−${hit}`, "#ffa7a1");
          } else effect(s, s.player.x, s.player.y - 35, "DODGE", "#aee0cd");
        }
      }
    }
    if (s.player.hp <= 0) {
      recoverPlayer(s);
      return;
    }
    s.regen += dt;
    if (s.regen >= 4) {
      s.regen = 0;
      if (st.weight < st.capacity * 0.5) {
        s.player.hp = Math.min(
          st.maxHp,
          s.player.hp + Math.max(2, Math.floor(s.stats.vit / 2)),
        );
        s.player.sp = Math.min(
          st.maxSp,
          s.player.sp + Math.max(2, Math.floor(s.stats.int / 3)),
        );
      }
    }
  }
  function validBinding(v, s, learned = false) {
    if (v === null) return true;
    if (typeof v !== "string") return false;
    const [type, id, ...extra] = v.split(":");
    if (extra.length) return false;
    return type === "action"
      ? ["attack", "interact", "auto"].includes(id)
      : type === "item"
        ? own(D.items, id) && D.items[id].type === "use"
        : type === "skill"
          ? own(D.skills, id) && (!learned || s.skills[id] > 0)
          : false;
  }
  function serialize(s) {
    const keep = [
      "baseLevel",
      "jobLevel",
      "exp",
      "jexp",
      "job",
      "weaponSchool",
      "silver",
      "statPoints",
      "skillPoints",
      "stats",
      "skills",
      "inventory",
      "equipment",
      "zone",
      "player",
      "kills",
      "quest",
      "questActive",
      "hotbar",
      "settings",
    ];
    return JSON.stringify(
      { version: 1, state: Object.fromEntries(keep.map((k) => [k, s[k]])) },
      null,
      2,
    );
  }
  function deserialize(text) {
    const bad = () => {
      throw new Error("ไฟล์เซฟไม่ถูกต้อง หรือเป็นคนละรุ่น");
    };
    if (typeof text !== "string" || text.length > 1000000) bad();
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      bad();
    }
    if (
      !raw ||
      raw.version !== 1 ||
      !raw.state ||
      typeof raw.state !== "object"
    )
      bad();
    const v = raw.state;
    const obj = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
    const num = (n, min, max, int = true) =>
      typeof n === "number" &&
      Number.isFinite(n) &&
      n >= min &&
      n <= max &&
      (!int || Number.isInteger(n));
    if (!["Novice", "Swordman"].includes(v.job)) bad();
    for (const [k, min, max] of [
      ["baseLevel", 1, 30],
      ["jobLevel", 1, v.job === "Novice" ? 10 : 50],
      ["exp", 0, 100000],
      ["jexp", 0, 100000],
      ["silver", 0, 100000000],
      ["statPoints", 0, 10000],
      ["skillPoints", 0, 10000],
      ["zone", 0, 2],
      ["quest", 0, 3],
    ])
      if (!num(v[k], min, max)) bad();
    for (const key of [
      "stats",
      "skills",
      "inventory",
      "equipment",
      "player",
      "kills",
      "settings",
    ])
      if (!obj(v[key])) bad();
    for (const k of Object.keys(D.statNames))
      if (!num(v.stats[k], 1, 99)) bad();
    if (Object.keys(v.stats).length !== 6) bad();
    for (const k of Object.keys(D.skills))
      if (!num(v.skills[k], k === "first_aid" ? 1 : 0, D.skills[k].max)) bad();
    if (Object.keys(v.skills).length !== 4) bad();
    if (
      (v.job === "Novice" &&
        (v.skills.bash || v.skills.magnum || v.skills.provoke)) ||
      (v.skills.magnum > 0 && v.skills.bash < 5)
    )
      bad();
    for (const [k, n] of Object.entries(v.inventory))
      if (!own(D.items, k) || !num(n, 0, 100000)) bad();
    const equipmentSlots = ["weapon", "armor", "accessory", "head"];
    const legacyEquipment = !own(v.equipment, "head");
    if (
      Object.keys(v.equipment).length !== (legacyEquipment ? 3 : 4) ||
      Object.keys(v.equipment).some((slot) => !equipmentSlots.includes(slot))
    )
      bad();
    for (const slot of legacyEquipment ? equipmentSlots.slice(0, 3) : equipmentSlots)
      if (
        !own(v.equipment, slot) ||
        (v.equipment[slot] !== null &&
          (!own(D.items, v.equipment[slot]) ||
            D.items[v.equipment[slot]].type !== slot))
      )
        bad();
    const wornWeaponType = D.items[v.equipment.weapon]?.weaponType;
    const weaponSchool = own(v, "weaponSchool") ? v.weaponSchool : wornWeaponType || "sword";
    if (
      typeof weaponSchool !== "string" || !own(D.weaponSchools, weaponSchool) ||
      (wornWeaponType && wornWeaponType !== weaponSchool)
    ) bad();
    for (const [k, n] of Object.entries(v.kills))
      if (!own(D.monsters, k) || !num(n, 0, 1000000)) bad();
    if (
      !num(v.player.x, 30, 930, false) ||
      !num(v.player.y, 60, 510, false) ||
      !num(v.player.hp, 0, 100000, false) ||
      !num(v.player.sp, 0, 100000, false) ||
      !num(v.player.facing, 0, 3)
    )
      bad();
    if (
      !Array.isArray(v.hotbar) ||
      v.hotbar.length !== 9 ||
      !v.hotbar.every((b) => validBinding(b, v))
    )
      bad();
    if (
      typeof v.questActive !== "boolean" ||
      !num(v.settings.hair, 0, 5) ||
      !num(v.settings.autoPotion, 0, 90) ||
      typeof v.settings.autoSkill !== "boolean"
    )
      bad();
    const s = createState();
    for (const k of Object.keys(JSON.parse(serialize(s)).state)) s[k] = v[k];
    s.weaponSchool = weaponSchool;
    if (legacyEquipment) s.equipment = { ...v.equipment, head: null };
    const st = stats(s);
    s.player.hp = Math.min(s.player.hp, st.maxHp);
    s.player.sp = Math.min(s.player.sp, st.maxSp);
    spawn(s);
    return s;
  }
  const api = {
    createState,
    stats,
    attackRange,
    equipReason,
    act,
    tick,
    serialize,
    deserialize,
    spawn,
    gain,
    baseNeed,
    jobNeed,
    dist,
  };
  if (typeof module === "object") module.exports = api;
  else root.BCCore = api;
})(typeof window === "undefined" ? globalThis : window);
