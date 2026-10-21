(function (root) {
  "use strict";
  const D =
    typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const Skills = typeof module === "object" ? require("./skill-rules.js") : root.BCSkillRules;
  const Rules = typeof module === "object" ? require("./stat-rules.js") : root.BCStatRules;
  const Items = typeof module === "object" ? require("./item-rules.js") : root.BCItemRules;
  const Combat = typeof module === "object" ? require("./class-combat.js") : root.BCClassCombat;
  const AutoQuest = typeof module === "object" ? require("./auto-quest.js") : root.BCAutoQuest;
  const Feedback = typeof module === "object" ? require("./combat-feedback.js") : root.BCCombatFeedback;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const jobName = (id) => D.jobs[id].name;
  const npcName = (id) => D.npcs.find((n) => n.id === id).name;
  function createState() {
    const s = {
      version: 1,
      skillVersion: 2,
      baseLevel: 1,
      jobLevel: 1,
      exp: 0,
      jexp: 0,
      job: "Novice",
      classId: "villager",
      classTrial: null,
      weaponSchool: "training",
      silver: 45,
      statVersion: 2,
      statPoints: 48,
      skillPoints: 0,
      stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
      skills: Object.fromEntries(Object.keys(D.skills).map(id => [id, id === "first_aid" ? 1 : 0])),
      inventory: { potion: 5, ether: 3, novice_cap: 1 },
      equipment: {
        weapon: "training_stick",
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
        null,
        null,
        null,
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
  function stats(s) { return Rules.calculate(s, Combat.modifiers(s)); }
  const statCost = Rules.statCost;
  const statRefund = Rules.statRefund;
  function statResetReason(s) { return nearby(s, "guide") ? "" : `คุย${npcName("guide")}ที่เมืองเพื่อรีสเตตัสฟรี`; }
  function classInfo(s) {
    return typeof s.classId === "string" && own(D.classes, s.classId) ? D.classes[s.classId] : D.classes.villager;
  }
  function availableClasses(s) {
    return Object.keys(D.classes).filter(id => D.classes[id].parent === s.classId);
  }
  function trialProgress(s) {
    const t = s.classTrial;
    if (!t || !own(D.classes, t.classId) || !D.classes[t.classId].trial) return null;
    const { kind, count } = D.classes[t.classId].trial;
    const current = Math.min(count, Math.max(0, (s.kills[kind] || 0) - t.baseline));
    return { classId: t.classId, kind, count, current, complete: current >= count };
  }
  function classChangeReason(s, id) {
    if (typeof id !== "string" || !own(D.classes, id) || !availableClasses(s).includes(id)) return "เลือกอาชีพขั้นถัดไปในเส้นทางปัจจุบัน";
    const required = classInfo(s).tier === 0 ? 10 : 40;
    if (s.jobLevel < required) return `ต้องมีระดับอาชีพ ${required}`;
    if (!nearby(s, "guide")) return `คุย${npcName("guide")}ที่เมืองเพื่อเปลี่ยนอาชีพ`;
    if (D.classes[id].tier === 2) {
      const t = trialProgress(s);
      if (!t || t.classId !== id || !t.complete) return "รับและทำบททดสอบอาชีพนี้ให้ครบก่อน";
    }
    return "";
  }
  function skillAvailable(s, id) { return Skills.accessible(s, id); }
  function skillsFor(s) { return Skills.skillsFor(s.classId); }
  function learnReason(s, id) {
    if (!skillAvailable(s, id) || id === "first_aid") return "อาชีพนี้เรียนสกิลนี้ไม่ได้";
    if (s.skillPoints < 1) return "ไม่มีแต้มสกิล";
    if (s.skills[id] >= D.skills[id].max) return "สกิลเต็มระดับแล้ว";
    return "";
  }
  function weaponProfile(s) {
    return D.weaponTypes[classInfo(s).weaponType];
  }
  function attackRange(s) {
    return weaponProfile(s).range;
  }
  function equipReason(s, id) {
    if (typeof id !== "string" || !own(D.items, id) || !["weapon", "armor", "accessory", "head"].includes(D.items[id].type)) return "ใส่อุปกรณ์นี้ไม่ได้";
    const item = D.items[id];
    if (item.type === "weapon" && item.weaponType !== classInfo(s).weaponType) {
      const names = Object.values(D.classes).filter(c => c.weaponType === item.weaponType).map(c => c.name).join(" / ");
      return `อาวุธนี้ใช้ได้เฉพาะอาชีพ ${names}`;
    }
    if (!(s.inventory[id] > 0)) return "ไม่มีอุปกรณ์นี้ในกระเป๋า";
    return "";
  }
  function random(s) {
    s.seed = (s.seed * 1664525 + 1013904223) >>> 0;
    return s.seed / 4294967296;
  }
  function spawn(s) {
    Feedback.clear(s);
    delete s.classCombat;
    delete s.player.skillDebuffs;
    s.monsters = D.maps[s.zone].mobs.map((kind, i) => ({
      uid: `${s.zone}-${i}`,
      kind,
      x: 410 + (i % 3) * 185,
      y: 135 + Math.floor(i / 3) * 190,
      hp: D.monsters[kind].hp,
      cd: 1 + i * 0.17,
      dead: 0,
    }));
    s.target = null;
    s.destination = null;
  }
  function note(s, text) {
    s.log.unshift(text);
    s.log.length = Math.min(s.log.length, 40);
    return text;
  }
  function effect(s, x, y, text, color = "#fff", meta = {}) {
    s.effects.push({ x, y, text, color, ttl: 1, ...meta });
    if (s.effects.length > 40) s.effects.shift();
  }
  function gain(s, exp, jexp) {
    s.exp += exp;
    s.jexp += jexp;
    let leveled = false;
    while (s.baseLevel < 30 && s.exp >= baseNeed(s)) {
      s.exp -= baseNeed(s);
      s.baseLevel++;
      s.statPoints += Rules.levelAward(s.baseLevel);
      leveled = true;
    }
    while (
      s.jobLevel < (classInfo(s).tier === 0 ? 10 : 50) &&
      s.jexp >= jobNeed(s)
    ) {
      s.jexp -= jobNeed(s);
      s.jobLevel++;
      if (classInfo(s).tier > 0) s.skillPoints++;
    }
    if (s.baseLevel === 30) s.exp = 0;
    if (s.jobLevel === (classInfo(s).tier === 0 ? 10 : 50)) s.jexp = 0;
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
    for (const row of Items.rollDrops(m.kind, () => random(s))) s.inventory[row.item] = (s.inventory[row.item] || 0) + row.qty;
    gain(s, d.exp, d.jexp);
    note(s, `${d.name} • +${d.exp} EXP · +${d.silver} ${D.world.currency}`);
    effect(s, m.x, m.y, `+${d.exp} EXP`, "#e5d79c");
    if (s.target === m.uid) {
      s.target = null;
      s.destination = null;
    }
  }
  function feedback(s, event) {
    return Feedback.emit(s, {
      source: s.player, target: s.player, facing: s.player.facing,
      weaponType: classInfo(s).weaponType, skillId: null, result: null,
      phase: "direct", amount: null, magic: false, ...event,
    });
  }
  function damage(s, m, mult = 1, always = false, options = {}) {
    if (!m || m.dead || m.hp <= 0) return false;
    const d = D.monsters[m.kind], st = stats(s), magic = !!options.magic;
    // Random criticals belong only to ordinary physical attacks, never spells,
    // class signatures, traps, or DOT. Magic also bypasses ordinary FLEE.
    const critical = options.normal === true && !magic && random(s) * 100 < Math.max(0, st.crit - (d.luk || 0) / 5);
    if (!magic && !always && !critical && random(s) * 100 > Rules.playerHitChance(st, d)) {
      effect(s, m.x, m.y - 20, "MISS", "#bec8cd", { kind: "miss", target: "monster" });
      feedback(s, { kind: "impact", source: options.source || s.player, target: m,
        skillId: options.skillId || null, phase: options.phase || "direct", result: "miss", amount: 0, magic });
      return false;
    }
    const defense = (magic ? d.mdef || 0 : d.def) * (options.defenseScale ?? 1);
    const passive = Skills.passives(s), skill = D.skills[options.skillId];
    let power = magic ? st.matk : st.atk;
    // Magic-bow dual art replaces the INT coefficient only for its magic arrows.
    if (magic && skill && classInfo(s).weaponType === "magic_bow" && passive.magicBowDexFactor > 0) {
      power = 8 + (s.baseLevel || 1) + Math.floor(s.stats.dex * passive.magicBowDexFactor + s.stats.int * passive.magicBowIntFactor) + Math.floor(s.stats.luk / 3) + st.gearMatk;
    }
    let multiplier = 1;
    if (options.normal && magic) multiplier *= passive.normalMagicMultiplier;
    if (["bow", "magic_bow"].includes(classInfo(s).weaponType)) multiplier *= passive.bowMultiplier;
    if (["aoe", "sanctuary", "radial", "cone", "pierce", "chain"].includes(skill?.kind)) multiplier *= passive.aoeMultiplier;
    if (options.phase === "dot" && options.skillId === "moon_venom") multiplier *= passive.poisonMultiplier;
    if (m.skillMarks?.naga_trap?.remaining > 0) multiplier *= passive.huntMultiplier;
    const amount = Rules.damageTaken(power * mult * multiplier * (critical ? 1.4 : 1), 0, defense);
    m.hp -= amount;
    effect(s, m.x, m.y - 25, (critical ? "CRIT " : "") + amount, critical ? "#ffdc82" : magic ? "#d6c7ff" : "#fff3cf", { kind: "damage", amount, critical, magic, target: "monster" });
    feedback(s, { kind: "impact", source: options.source || s.player, target: m,
      skillId: options.skillId || null, phase: options.phase || "direct", result: critical ? "crit" : "hit", amount, magic });
    if (m.hp <= 0) kill(s, m);
    return true;
  }
  const combatHelpers = { damage, effect, stats, dist, kill, feedback };
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
      if (id !== "attack" && (!skillAvailable(s, id) || !s.skills[id] || Skills.isPassive(id)))
        return fail("ยังไม่ได้เรียนสกิลนี้");
      if (D.skills[id]?.owner) return Combat.cast(s, id, p, combatHelpers);
      if ((s.cooldowns[id] || 0) > 0)
        return fail("กำลังรอสกิลหรือการโจมตีพร้อมใช้งาน");
      const skill = D.skills[id];
      if (skill && s.player.sp < Skills.spCost(s, id)) return fail("SP ไม่เพียงพอ");
      const m = s.monsters.find(
        (m) => m.uid === (p.target || s.target) && !m.dead,
      );
      if (id !== "first_aid" && (!m || dist(s.player, m) > attackRange(s)))
        return fail("เลือกศัตรูและเดินเข้าใกล้ก่อน");
      if (skill) s.player.sp -= Skills.spCost(s, id);
      s.cooldowns[id] = skill ? skill.cooldown : st.interval;
      if (id === "first_aid")
        feedback(s, { kind: "skill", skillId: id, target: s.player });
      if (id === "first_aid") {
        const amount = Math.min(st.maxHp - s.player.hp, Math.round(20 * Skills.passives(s).healMultiplier));
        s.player.hp += amount;
        Combat.afterHeal(s,id,amount);
        effect(s, s.player.x, s.player.y - 30, `+${amount} HP`, "#b6edb8");
      } else {
        const dx = m.x - s.player.x,
          dy = m.y - s.player.y;
        if (dx || dy)
          s.player.facing =
            Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2;
        feedback(s, { kind: id === "attack" ? "attack" : "skill", target: m,
          skillId: id === "attack" ? null : id, magic: id === "attack" && !!st.basicMagic });
        const landed = damage(s, m, 1, false, { normal: id === "attack", magic: id === "attack" && st.basicMagic, skillId: id === "attack" ? null : id, phase: "direct" });
        if (id === "attack" && landed) Combat.afterAttack(s, m, combatHelpers);
        s.cooldowns.swing = 0.22;
      }
      return ok();
    }
    if (action === "use") {
      if (
        typeof p.id !== "string" || !own(D.items, p.id) ||
        D.items[p.id].type !== "use" ||
        !(s.inventory[p.id] > 0)
      )
        return fail("ไม่มีไอเทมนี้ในกระเป๋า");
      const i = D.items[p.id];
      s.inventory[p.id]--;
      if (!s.inventory[p.id]) delete s.inventory[p.id];
      const hp = Math.min(st.maxHp - s.player.hp, Math.round((i.hp || 0) * st.hpItemMultiplier));
      const sp = Math.min(st.maxSp - s.player.sp, Math.round((i.sp || 0) * st.spItemMultiplier));
      s.player.hp += hp;
      s.player.sp += sp;
      effect(
        s,
        s.player.x,
        s.player.y - 30,
        [i.hp ? `+${hp} HP` : "", i.sp ? `+${sp} SP` : ""].filter(Boolean).join(" · "),
        i.color,
      );
      return ok(`ใช้ ${i.name}`);
    }
    if (action === "buy" || action === "sell") {
      const quote=Items.tradeQuote(s,p.id,action,p.qty===undefined?1:p.qty,st);
      if(!quote.ok)return fail(quote.message);
      const i=D.items[p.id],qty=quote.quantity;
      if(action==="buy") {
        s.silver-=quote.total;
        s.inventory[p.id]=quote.owned+qty;
      } else {
        s.inventory[p.id]-=qty;
        if(!s.inventory[p.id])delete s.inventory[p.id];
        s.silver+=quote.total;
      }
      return ok(`${action === "buy" ? "ซื้อ" : "ขาย"} ${i.name} ×${qty}`);
    }
    if (action === "class-trial") {
      if (typeof p.id !== "string" || !own(D.classes, p.id) || classInfo(s).tier !== 1 || !availableClasses(s).includes(p.id)) return fail("เลือกบททดสอบในเส้นทางอาชีพปัจจุบัน");
      if (s.jobLevel < 40 || !nearby(s, "guide")) return fail(`ระดับอาชีพ 40 และคุย${npcName("guide")}เพื่อรับบททดสอบ`);
      if (s.classTrial?.classId === p.id) return ok();
      const trial = D.classes[p.id].trial;
      s.classTrial = { classId: p.id, baseline: s.kills[trial.kind] || 0 };
      return ok(`รับบททดสอบ ${D.classes[p.id].name}`);
    }
    if (action === "class" || action === "job") {
      const id = p.id;
      const reason = classChangeReason(s, id);
      if (reason) return fail(reason);
      const next = D.classes[id], old = s.equipment.weapon;
      if (!old || D.items[old].weaponType !== next.weaponType) {
        if (old) s.inventory[old] = (s.inventory[old] || 0) + 1;
        const primary = D.weaponTypes[next.weaponType].basicMagic ? "matk" : "atk", secondary = primary === "matk" ? "atk" : "matk";
        const weapon = Object.keys(s.inventory).filter(k => s.inventory[k] > 0 && D.items[k].type === "weapon" && D.items[k].weaponType === next.weaponType)
          .sort((a, b) => (D.items[b][primary] || 0) - (D.items[a][primary] || 0) || (D.items[b][secondary] || 0) - (D.items[a][secondary] || 0) || (D.items[b].grade || 0) - (D.items[a].grade || 0) || a.localeCompare(b))[0];
        s.equipment.weapon = weapon || null;
        if (weapon && --s.inventory[weapon] === 0) delete s.inventory[weapon];
      }
      s.classId = id;
      s.weaponSchool = next.weaponType;
      s.job = "Swordman";
      s.jobLevel = 1;
      s.jexp = 0;
      s.skillPoints++;
      s.classTrial = null;
      delete s.classCombat;
      delete s.player.skillDebuffs;
      s.auto = false; s.target = null; s.destination = null;
      s.player.hp = stats(s).maxHp; s.player.sp = stats(s).maxSp;
      return ok(`ยินดีด้วย! คุณเป็น${next.name}แล้ว`);
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
      if (typeof p.id !== "string" || !own(s.stats, p.id) || !own(D.statNames, p.id)) return fail("ค่าสเตตัสไม่ถูกต้อง");
      const cost = statCost(s.stats[p.id]);
      if (!Number.isFinite(cost)) return fail("ค่าสเตตัสเต็ม 99 แล้ว");
      if (s.statPoints < cost) return fail(`ต้องใช้แต้มสเตตัส ${cost} แต้ม`);
      s.stats[p.id]++;
      s.statPoints -= cost;
      return ok("เพิ่มสเตตัสแล้ว");
    }
    if (action === "reset-stats") {
      const reason = statResetReason(s);
      if (reason) return fail(reason);
      const refund = statRefund(s);
      s.statPoints += refund;
      for (const key of Object.keys(D.statNames)) s.stats[key] = 1;
      delete s.classCombat;
      s.auto = false; s.target = null; s.destination = null; s.cooldowns = {};
      for (const m of s.monsters) { delete m.classDots; delete m.skillDebuffs; delete m.skillMarks; m.snare = 0; }
      delete s.player.skillDebuffs;
      const reset = stats(s);
      s.player.hp = Math.min(s.player.hp, reset.maxHp);
      s.player.sp = Math.min(s.player.sp, reset.maxSp);
      return ok(`รีสเตตัสฟรี • คืน ${refund} แต้ม`);
    }
    if (action === "learn-plan") {
      const record = value => value && typeof value === "object" && !Array.isArray(value);
      if (p.classId !== s.classId || !record(p.baseline) || !record(p.increments)) return fail("แผนสกิลไม่ตรงกับตัวละครปัจจุบัน");
      const accessible = skillsFor(s).filter(id => D.skills[id].owner);
      if (Object.keys(p.baseline).length !== accessible.length || accessible.some(id => !own(p.baseline,id) || p.baseline[id] !== s.skills[id])) return fail("ระดับสกิลเปลี่ยนไปแล้ว • จัดแผนใหม่อีกครั้ง");
      const entries = Object.entries(p.increments);
      if (!entries.length || entries.length > accessible.length) return fail("ยังไม่ได้เพิ่มแต้มในแผน");
      let cost = 0;
      for (const [id,count] of entries) {
        if (!accessible.includes(id) || !Number.isInteger(count) || count < 1 || count > D.skills[id].max || learnReason(s,id) || s.skills[id]+count>D.skills[id].max) return fail("แผนสกิลไม่ถูกต้องหรือระดับเกินกำหนด");
        cost += count;
      }
      if (!Number.isInteger(s.skillPoints) || s.skillPoints < cost) return fail("แต้มสกิลไม่พอสำหรับแผนนี้");
      for (const [id,count] of entries) s.skills[id] += count;
      s.skillPoints -= cost;
      return ok(`ยืนยันเรียนสกิลแล้ว • ใช้ ${cost} แต้ม`);
    }
    if (action === "learn") {
      const reason = learnReason(s, p.id);
      if (reason) return fail(reason);
      s.skills[p.id]++;
      s.skillPoints--;
      return ok(`เรียน ${D.skills[p.id].name}`);
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
      for (const [id, qty] of Object.entries(q.items || {})) {
        if ((s.inventory[id] || 0) + qty > 100000) return fail(`${D.items[id].name}เต็มกระเป๋าแล้ว • ขายบางส่วนก่อนรับรางวัล`);
      }
      s.silver += q.silver;
      for (const [id, qty] of Object.entries(q.items || {})) s.inventory[id] = (s.inventory[id] || 0) + qty;
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
    if (action === "auto-quest" || action === "auto-quest-stop" || (action === "auto" && s.autoQuest?.active)) {
      const result = action === "auto-quest" && !s.autoQuest?.active ? AutoQuest.start(s) : AutoQuest.stop(s);
      if (result.message) note(s, result.message);
      return result;
    }
    const r = doAction(s, action, p);
    if (r.ok && s.autoQuest?.active && ["move", "target", "attack", "skill", "auto", "travel", "quest", "class", "job", "class-trial", "reset-stats"].includes(action)) {
      // Cancel only after the real command succeeds. Keep the player's new
      // destination/target instead of clearing it together with automatic intent.
      const destination = action === "move" ? s.destination : null;
      const target = ["target", "attack", "skill"].includes(action) ? (p.target || s.target) : null;
      AutoQuest.stop(s, "ควบคุมตัวละครด้วยตนเองแล้ว");
      s.destination = destination;
      s.target = s.monsters.some(m => m.uid === target && !m.dead) ? target : null;
    }
    if (r.message) note(s, r.message);
    return r;
  }
  function recoverPlayer(s) {
    const questing = !!s.autoQuest?.active;
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
    if (questing) AutoQuest.block(s, "พักฟื้นหลังหมดสติแล้ว • เตรียมอุปกรณ์ สเตตัส และยาก่อนเริ่มเควสต์อัตโนมัติใหม่");
  }
  function tick(s, seconds) {
    const dt = clamp(Number.isFinite(seconds) ? seconds : 0, 0, 0.1);
    if (!dt) return;
    s.clock += dt;
    Feedback.tick(s, dt);
    for (const id of Object.keys(s.cooldowns))
      s.cooldowns[id] = Math.max(0, s.cooldowns[id] - dt);
    s.effects = s.effects.filter((e) => (e.ttl -= dt) > 0);
    if (s.player.hp <= 0) {
      recoverPlayer(s);
      return;
    }
    Combat.tick(s, dt, combatHelpers);
    AutoQuest.tick(s, dt, { act: doAction, stats, dist });
    const st = stats(s);
    if (s.auto) {
      if ((s.player.hp / st.maxHp) * 100 < s.settings.autoPotion) {
        const id = s.inventory.potion > 0 ? "potion" : Object.keys(s.inventory).find(id => s.inventory[id] > 0 && D.items[id]?.type === "use" && D.items[id].hp > 0);
        if (id) doAction(s, "use", { id });
      }
      if (!s.monsters.some((m) => m.uid === s.target && !m.dead)) {
        const m = s.monsters
          .filter((m) => !m.dead)
          .sort((a, b) => dist(a, s.player) - dist(b, s.player))[0];
        s.target = m ? m.uid : null;
      }
    }
    const target = s.monsters.find((m) => m.uid === s.target && !m.dead);
    if (target) {
      const automatic = s.auto || (s.autoQuest?.active && s.autoQuest.phase === "fighting");
      const mobility = automatic && s.settings.autoSkill ? Combat.suggestMovement(s,target,combatHelpers) : null;
      const moved = mobility ? doAction(s,"skill",{id:mobility,target:target.uid}).ok : false;
      const gap = dist(target, s.player);
      if (gap > weaponProfile(s).approachRange)
        s.destination = { x: target.x, y: target.y };
      else {
        s.destination = null;
        if (!moved) {
          let suggested = automatic && s.settings.autoSkill ? Combat.suggestSkill(s, target, combatHelpers) : null;
          // Test the actual cone/line/chain hit list before spending quest resources.
          if (suggested && !Combat.safeForQuest(s, suggested, target)) suggested = null;
          if (suggested && skillAvailable(s, suggested)) {
            const result = doAction(s, "skill", { id: suggested, target: target.uid });
            if (!result.ok) doAction(s, "attack", { target: target.uid });
          } else doAction(s, "attack", { target: target.uid });
        }
      }
    }
    if (s.destination) {
      const dx = s.destination.x - s.player.x,
        dy = s.destination.y - s.player.y,
        d = Math.hypot(dx, dy),
        step = Math.min(d, 145 * Combat.modifiers(s).moveMultiplier * Combat.enemyModifiers(s.player).speedMultiplier * dt);
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
          m.cd = 1;
        }
        continue;
      }
      const d = D.monsters[m.kind];
      m.cd = Math.max(0, m.cd - dt);
      const gap = dist(m, s.player);
      if (gap < 175 && s.player.x > 310) {
        if (gap > 40) {
          const movement = m.snare > 0 ? 0 : d.speed * Combat.enemyModifiers(m).speedMultiplier * dt;
          m.x += ((s.player.x - m.x) / gap) * movement;
          m.y += ((s.player.y - m.y) / gap) * movement;
        } else if (!m.cd) {
          m.cd = d.boss ? 1.5 : 1.8;
          const defense = stats(s);
          const magic = !!d.attackMagic;
          const perfect = !magic && random(s) * 100 < defense.perfectDodge;
          if (!perfect && (magic || random(s) * 100 < Math.max(5, Rules.enemyHitChance(d, defense) - Combat.enemyModifiers(m).hitPenalty))) {
            const incoming = Rules.damageTaken(
              d.atk * Combat.enemyModifiers(m).atkMultiplier,
              magic ? defense.softMdef : defense.softDef,
              magic ? defense.hardMdef : defense.hardDef,
              (Combat.modifiers(s).damageTaken || 1) * Skills.passives(s).damageTakenMultiplier,
            );
            const hit = Combat.absorbDamage(s, incoming);
            s.player.hp = Math.max(0, s.player.hp - hit);
            effect(s, s.player.x, s.player.y - 35, `${magic ? "เวท " : ""}−${hit}`, magic ? "#cab4ff" : "#ffa7a1", { kind: "damage", amount: hit, critical: false, magic, target: "player" });
          } else effect(s, s.player.x, s.player.y - 35, perfect ? "LUCKY" : "DODGE", "#aee0cd", { kind: perfect ? "lucky" : "miss", target: "player" });
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
          s.player.hp + st.hpRegen,
        );
        s.player.sp = Math.min(
          st.maxSp,
          s.player.sp + st.spRegen,
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
          ? own(D.skills, id) && !Skills.isPassive(id) && (!(learned || D.skills[id].owner) || (s.skills[id] > 0 && skillAvailable(s, id)))
          : false;
  }
  function serialize(s) {
    const keep = [
      "skillVersion",
      "baseLevel",
      "jobLevel",
      "exp",
      "jexp",
      "job",
      "classId",
      "classTrial",
      "weaponSchool",
      "silver",
      "statVersion",
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
      { version: 1, state: Object.fromEntries(keep.map((k) => [k, k === "player" ? Object.fromEntries(["x", "y", "hp", "sp", "facing"].map(key => [key, s.player[key]])) : s[k]])) },
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
    if (v.statVersion !== 2 || !own(v, "classId") || !own(v, "weaponSchool") || !own(v, "classTrial")) bad();
    if (!obj(v.equipment) || !obj(v.skills) || !obj(v.kills)) bad();
    const wornWeaponType = typeof v.equipment.weapon === "string" && own(D.items, v.equipment.weapon) ? D.items[v.equipment.weapon].weaponType : undefined;
    const weaponSchool = v.weaponSchool, classId = v.classId;
    if (typeof classId !== "string" || !own(D.classes, classId) || typeof weaponSchool !== "string" || !own(D.weaponTypes, weaponSchool) || D.classes[classId].weaponType !== weaponSchool || (wornWeaponType && wornWeaponType !== weaponSchool)) bad();
    for (const [k, min, max] of [
      ["baseLevel", 1, 30],
      ["jobLevel", 1, D.classes[classId].tier === 0 ? 10 : 50],
      ["exp", 0, 100000],
      ["jexp", 0, 100000],
      ["silver", 0, 100000000],
      ["statPoints", 0, 100000],
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
    // Unknown catalog IDs are discarded; retained IDs still obey the complete
    // current schema. No historic catalog or class/stat/equipment migration runs.
    const skills = Object.fromEntries(Object.entries(v.skills).filter(([id]) => own(D.skills, id)));
    const originalSkills = new Set(["first_aid", "arun_slash", "royal_flurry", "shield_counter", "lotus_bolt", "lotus_storm", "orb_burst", "ward_script", "sanctuary", "garuda_combo", "quick_stab", "moon_venom", "tiger_rend", "aimed_shot", "naga_trap", "arcane_volley"]);
    const upgrading = !own(v, "skillVersion");
    if (!upgrading && v.skillVersion !== 2) bad();
    for (const k of Object.keys(D.skills)) {
      // Only new catalog keys may be filled by this one explicit 1.16 upgrade.
      if (upgrading && !originalSkills.has(k) && !own(skills, k)) skills[k] = 0;
      if (!num(skills[k], k === "first_aid" ? 1 : 0, D.skills[k].max)) bad();
    }
    if (Object.keys(skills).length !== Object.keys(D.skills).length) bad();
    const access = { classId, skills };
    if (Object.keys(skills).some(k => skills[k] > 0 && D.skills[k].owner && !skillAvailable(access, k))) bad();
    const inventory = Object.fromEntries(Object.entries(v.inventory).filter(([id]) => own(D.items, id)));
    for (const n of Object.values(inventory)) if (!num(n, 0, 100000)) bad();
    const equipmentSlots = ["weapon", "armor", "accessory", "head"];
    if (Object.keys(v.equipment).length !== equipmentSlots.length ||
        Object.keys(v.equipment).some(slot => !equipmentSlots.includes(slot))) bad();
    const equipment = {};
    for (const slot of equipmentSlots) {
      const id = v.equipment[slot];
      if (!own(v.equipment, slot) || (id !== null && (typeof id !== "string" || !id))) bad();
      if (id !== null && own(D.items, id) && D.items[id].type !== slot) bad();
      equipment[slot] = id !== null && own(D.items, id) ? id : null;
    }
    for (const [k, n] of Object.entries(v.kills))
      if (!own(D.monsters, k) || !num(n, 0, 1000000)) bad();
    const classTrial = v.classTrial;
    if (classTrial !== null) {
      if (!obj(classTrial) || Object.keys(classTrial).length !== 2 || !own(classTrial, "classId") || !own(classTrial, "baseline") || typeof classTrial.classId !== "string" || !own(D.classes, classTrial.classId)) bad();
      const c = D.classes[classTrial.classId];
      if (D.classes[classId].tier !== 1 || c.parent !== classId || !c.trial || !num(classTrial.baseline, 0, v.kills[c.trial.kind] || 0)) bad();
    }
    if (
      !num(v.player.x, 30, 930, false) ||
      !num(v.player.y, 60, 510, false) ||
      !num(v.player.hp, 0, 100000, false) ||
      !num(v.player.sp, 0, 100000, false) ||
      !num(v.player.facing, 0, 3)
    )
      bad();
    if (!Array.isArray(v.hotbar) || v.hotbar.length !== 9) bad();
    const hotbar = v.hotbar.map(binding => {
      if (typeof binding === "string") {
        const parts = binding.split(":");
        if (parts.length !== 2 || !parts[1]) bad();
        const [type, id] = parts;
        if ((type === "skill" && !own(D.skills, id)) || (type === "item" && !own(D.items, id))) return null;
      }
      if (!validBinding(binding, { ...v, classId, skills })) bad();
      return binding;
    });
    if (
      typeof v.questActive !== "boolean" ||
      !num(v.settings.hair, 0, 5) ||
      !num(v.settings.autoPotion, 0, 90) ||
      typeof v.settings.autoSkill !== "boolean"
    )
      bad();
    const s = createState();
    for (const k of Object.keys(JSON.parse(serialize(s)).state)) s[k] = v[k];
    s.statVersion = 2;
    s.skillVersion = 2;
    s.classId = classId;
    s.classTrial = classTrial;
    s.skills = skills;
    s.weaponSchool = weaponSchool;
    s.inventory = inventory;
    s.equipment = equipment;
    s.hotbar = hotbar;
    s.player = Object.fromEntries(["x", "y", "hp", "sp", "facing"].map(k => [k, v.player[k]]));
    const st = stats(s);
    s.player.hp = Math.min(s.player.hp, st.maxHp);
    s.player.sp = Math.min(s.player.sp, st.maxSp);
    spawn(s);
    return s;
  }
  const api = {
    createState,
    stats,
    statCost,
    statRefund,
    statResetReason,
    attackRange,
    equipReason,
    classInfo,
    availableClasses,
    classChangeReason,
    skillAvailable,
    learnReason,
    skillsFor,
    trialProgress,
    autoQuestStatus: AutoQuest.status,
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
