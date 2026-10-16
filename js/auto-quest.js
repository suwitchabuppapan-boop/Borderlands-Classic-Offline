/* Main-story intent only. Travel, combat, recovery and rewards retain core guards. */
(function (root) {
  "use strict";
  const D = typeof module === "object" ? require("./classic-data.js") : root.BCData;
  const alive = m => !!m && !m.dead && m.hp > 0;
  function status(s) {
    const q = s.autoQuest;
    return { active: !!q?.active, phase: q?.phase || "idle", message: q?.message || "", questIndex: s.quest };
  }
  function phase(s, next, message) {
    s.autoQuest.phase = next;
    s.autoQuest.message = message;
  }
  function clear(s) { s.auto = false; s.target = null; s.destination = null; }
  function stop(s, message = "หยุดทำเควสต์อัตโนมัติ", next = "idle", clearIntent = true) {
    s.autoQuest = { active: false, phase: next, message };
    if (clearIntent) clear(s);
    return { ok: true, message };
  }
  function start(s) {
    if (!D.quests[s.quest]) return { ok: false, message: "ทำเควสต์หลักครบแล้ว" };
    clear(s);
    s.autoQuest = { active: true, phase: "starting", message: "เริ่มทำเควสต์หลักอัตโนมัติ" };
    return { ok: true, message: s.autoQuest.message };
  }
  const block = (s, message) => stop(s, message, "blocked");
  function action(s, h, name, p) {
    const result = h.act(s, name, p);
    if (!result.ok) block(s, result.message || "ทำคำสั่งไม่ได้ • โปรดตรวจความพร้อมแล้วเริ่มใหม่");
    return result.ok;
  }
  function move(s, h, point) {
    if (s.destination && h.dist(s.destination, point) < 1 && !s.target) return true;
    return action(s, h, "move", { x: point.x, y: point.y });
  }
  function route(s, h, zone, next, message) {
    phase(s, next, message);
    if (s.zone === zone) return true;
    s.target = null;
    const direction = s.zone < zone ? 1 : -1;
    if (Math.abs(s.player.y - 280) <= 65 && (direction === 1 ? s.player.x >= 885 : s.player.x <= 75)) {
      action(s, h, "travel", { direction });
    } else move(s, h, { x: direction === 1 ? 910 : 50, y: 280 });
    return false;
  }
  function approach(s, h, id, next, message) {
    s.target = null;
    const npc = D.npcs.find(n => n.id === id);
    if (!npc || !Number.isFinite(npc.x) || !Number.isFinite(npc.y)) {
      block(s, "ไม่พบผู้ให้บริการเควสต์ • โปรดตรวจข้อมูลเมือง");
      return false;
    }
    if (!route(s, h, 0, next, message)) return false;
    if (h.dist(s.player, npc) < 80) { s.destination = null; return true; }
    move(s, h, npc);
    return false;
  }
  function recover(s, h, st) {
    const percent = 100 * s.player.hp / st.maxHp;
    // Town recovery walks to the existing healer instead of spending supplies.
    if (s.zone === 0 && (percent < 65 || s.player.sp < st.maxSp * .2)) {
      if (approach(s, h, "healer", "healing", "เดินไปพักฟื้นกับหมอมะลิ")) action(s, h, "heal");
      return true;
    }
    if (s.zone === 0 && s.player.x <= 310) return false;
    const threshold = s.settings.autoPotion || 0;
    if (threshold > 0 && percent < threshold) {
      const missing = st.maxHp - s.player.hp;
      const items = Object.keys(s.inventory).filter(id => s.inventory[id] > 0 && D.items[id]?.type === "use" && D.items[id].hp > 0)
        .sort((a,b) => {
          const ha = Math.round(D.items[a].hp * st.hpItemMultiplier), hb = Math.round(D.items[b].hp * st.hpItemMultiplier);
          // Choose a sufficient small dose first, otherwise the largest dose.
          return (ha >= missing ? ha - missing : missing + (missing - ha)) - (hb >= missing ? hb - missing : missing + (missing - hb));
        });
      if (items.length) {
        if (!action(s, h, "use", { id: items[0] })) return true;
        return false;
      }
    }
    if (percent < 60 && s.settings.autoSkill && s.skills.first_aid > 0 && s.player.sp >= D.skills.first_aid.sp && !(s.cooldowns.first_aid > 0)) {
      if (!action(s, h, "skill", { id: "first_aid" })) return true;
      return false;
    }
    const aidPossible = s.settings.autoSkill && s.skills.first_aid > 0 && s.player.sp >= D.skills.first_aid.sp;
    const hasPotion = threshold > 0 && Object.keys(s.inventory).some(id => s.inventory[id] > 0 && D.items[id]?.hp > 0);
    if (percent <= 20 || (threshold > 0 && percent < threshold && !hasPotion && !aidPossible)) {
      block(s, "HP ต่ำและไม่มีการฟื้นพลังพร้อมใช้ • เตรียมยา เปิด Auto Potion หรือพักฟื้นก่อนเริ่มใหม่");
      return true;
    }
    return false;
  }
  function tick(s, dt, h) {
    if (!s.autoQuest?.active) return;
    const q = D.quests[s.quest];
    if (!q) { stop(s, "ทำเควสต์หลักครบทั้ง 3 บทแล้ว", "complete"); return; }
    if (!D.maps[s.zone] || !Array.isArray(D.maps[s.zone].mobs)) { block(s, "ไม่พบแผนที่ปัจจุบัน"); return; }
    const st = h.stats(s);
    if (st.weight >= st.capacity * .9) { block(s, "น้ำหนักถึง 90% • ขายหรือจัดของก่อนทำเควสต์ต่อ"); return; }
    const finished = (s.kills[q.kind] || 0) >= q.count;
    if (!s.questActive || finished) {
      // No need to consume supplies on a safe return/accept route.
      if (recover(s, h, st)) return;
      const message = s.questActive ? `กลับไปแจ้งครูอิน • ${q.title}` : `ไปพบครูอิน • ${q.title}`;
      if (!approach(s, h, "guide", s.questActive ? "returning" : "accepting", message)) return;
      if (!action(s, h, "quest")) return;
      if (!D.quests[s.quest]) stop(s, "ทำเควสต์หลักครบทั้ง 3 บทแล้ว", "complete");
      else phase(s, "starting", "ดำเนินเควสต์หลักบทต่อไป");
      return;
    }
    const zones = D.maps.map((map, index) => map?.mobs?.includes(q.kind) ? index : -1).filter(index => index >= 0)
      .sort((a,b) => Math.abs(a - s.zone) - Math.abs(b - s.zone));
    if (!zones.length || !D.monsters[q.kind]) { block(s, "ยังไม่มีแผนที่เปิดให้ทำเป้าหมายเควสต์นี้"); return; }
    if (recover(s, h, st)) return;
    if (!route(s, h, zones[0], "traveling", `เดินทางไป${D.maps[zones[0]].name}`)) return;
    let target = s.monsters.find(m => m.uid === s.target && m.kind === q.kind && alive(m));
    if (!target) target = s.monsters.filter(m => m.kind === q.kind && alive(m)).sort((a,b) => h.dist(a,s.player) - h.dist(b,s.player))[0];
    if (!target) {
      phase(s, "waiting", `รอ${D.monsters[q.kind].name}เกิดใหม่ • ${Math.min(s.kills[q.kind] || 0, q.count)}/${q.count}`);
      s.target = null;
      if (s.player.x > 310) move(s, h, { x: 250, y: 280 });
      else s.destination = null;
      return;
    }
    phase(s, "fighting", `${q.title} • ${Math.min(s.kills[q.kind] || 0, q.count)}/${q.count}`);
    if (s.target !== target.uid) action(s, h, "target", { target: target.uid });
  }
  const api = { status, start, stop, block, tick };
  if (typeof module === "object") module.exports = api;
  else root.BCAutoQuest = api;
})(typeof window === "object" ? window : globalThis);
