/* Original Siam maps and complete authored school sprites. See ASSET_PROVENANCE.md. */
(function (root) {
  "use strict";
  const D = root.BCData;
  const classAtlases = Object.freeze(Object.fromEntries(Object.entries(D.classes).map(([id,job])=>[id,job.atlas])));
  const atlasGrids = { townsfolk:[2,2], "siam-weapons":[4,2], "siam-equipment":[4,2], "class-weapons":[4,2],
    "siam-headgear":[4,3], ...Object.fromEntries(Object.values(classAtlases).map(name=>[name,[6,4]])) };
  const assetNames = ["meadow","woodland","cavern","sprites","townsfolk",
    "siam-weapons","siam-equipment","siam-headgear","class-weapons",...new Set(Object.values(classAtlases))];
  const assets = { ready: false, failed: [], loaded: 0, total: assetNames.length };
  const images = {}, cells = {};
  const hairAtlases = new Map(), trackers = new WeakMap();
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
  const hairColors = ["#956446", "#c49c56", "#49434a", "#b45d45", "#dcc484", "#718ca6"];
  const monsterCells = { poring: 8, fabre: 9, lunatic: 10, willow: 11, hornet: 12, poporing: 13, guardian: 14 };
  const monsterHeights = { poring: 20, fabre: 23, lunatic: 29, willow: 30, hornet: 28, poporing: 22, guardian: 48 };
  let textScale = 1;

  function load(name) {
    const img = new Image(); images[name] = img;
    img.onload = () => {
      if (!["meadow", "woodland", "cavern"].includes(name)) measureCells(img, name);
      assets.loaded++;
      assets.ready = assets.loaded === assets.total;
    };
    img.onerror = () => { if (!assets.failed.includes(name)) assets.failed.push(name); };
    img.src = `assets/art/${name}.webp?v=${encodeURIComponent(D.world.release)}`;
  }
  // Character bounds are measured offline from the authored art. Measuring the
  // full alpha box alone would shrink a character whenever its weapon is raised.
  function measureCells(img, name) {
    const school = Object.keys(classAtlases).find(key => classAtlases[key] === name);
    if (school) {
      cells[name] = (root.BCSchoolArt?.frames?.[school] || []).map(frame => frame?.bounds || null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const c = canvas.getContext("2d", { willReadFrequently: true });
    c.drawImage(img, 0, 0);
    const pixels = c.getImageData(0, 0, canvas.width, canvas.height).data;
    const [columns, rows] = atlasGrids[name] || [4, 4];
    const bands = name === "siam-headgear" ? root.BCSiamArt?.headgear?.rowPixelBands : null;
    cells[name] = [];
    for (let cell = 0; cell < columns * rows; cell++) {
      const column = cell % columns, row = Math.floor(cell / columns);
      const sx = Math.round(column * canvas.width / columns), ex = Math.round((column + 1) * canvas.width / columns);
      const sy = Math.round(bands?.[row] ?? row * canvas.height / rows);
      const ey = Math.round(bands?.[row + 1] ?? (row + 1) * canvas.height / rows);
      let left = ex, top = ey, right = sx - 1, bottom = sy - 1;
      for (let y = sy; y < ey; y++) for (let x = sx; x < ex; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 64) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      cells[name][cell] = right >= left && bottom >= top
        ? { x: left, y: top, w: right - left + 1, h: bottom - top + 1 } : null;
    }
  }
  function classOf(opts) {
    if (own(opts,"classId")) return own(classAtlases,opts.classId) ? opts.classId : null;
    return "villager";
  }
  function frameCell(pose = {}) {
    const facing = Number.isFinite(pose.facing) ? Math.max(0, Math.min(3, Math.round(pose.facing))) : 0;
    let column = 0;
    if (pose.mode === "walk") {
      const step = Number.isFinite(pose.frame) ? ((Math.round(pose.frame) % 4) + 4) % 4 : 0;
      column = [1, 2, 1, 2][step];
    } else if (pose.mode === "attack") {
      const progress = Number.isFinite(pose.progress) ? Math.max(0, Math.min(1, pose.progress)) : 0;
      column = progress < .3 ? 3 : progress < .7 ? 4 : 5;
    }
    return { facing, column, cell: facing * 6 + column };
  }
  function authoredFrame(school, pose = {}, height = 34) {
    if (!own(classAtlases, school)) return null;
    const atlas = classAtlases[school], frame = frameCell(pose);
    const art = root.BCSchoolArt?.frames?.[school]?.[frame.cell], img = images[atlas];
    const b = art?.bounds;
    if (!img?.complete || !img.naturalWidth || !b || ![b.x, b.y, b.w, b.h, art?.bodyHeight,
      ...(art?.foot || []), ...(art?.head || [])].every(Number.isFinite)
      || b.w <= 0 || b.h <= 0 || art.bodyHeight <= 0 || art.foot?.length !== 2 || art.head?.length !== 2
      || b.x < 0 || b.y < 0 || b.x + b.w > img.naturalWidth || b.y + b.h > img.naturalHeight) return null;
    const scale = height / art.bodyHeight;
    return { authored: true, classId: school, school, atlas, ...frame, scale, source: b,
      bounds: { x: (b.x - art.foot[0]) * scale, y: (b.y - art.foot[1]) * scale, w: b.w * scale, h: b.h * scale },
      head: { x: (art.head[0] - art.foot[0]) * scale, y: (art.head[1] - art.foot[1]) * scale },
      silhouette: art.silhouette, sourceFoot: art.foot, foot: { x: 0, y: 0 }, bodyHeight: height };
  }
  function tintedAtlas(hair, name, school) {
    const palette = Number.isFinite(hair) ? ((Math.round(hair) % hairColors.length) + hairColors.length) % hairColors.length : 0;
    if (!palette || !school) return images[name];
    const key = `${name}:${palette}`;
    if (hairAtlases.has(key)) return hairAtlases.get(key);
    const img = images[name], canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const c = canvas.getContext("2d", { willReadFrequently: true });
    c.drawImage(img, 0, 0);
    const data = c.getImageData(0, 0, canvas.width, canvas.height);
    const rgb = hairColors[palette].match(/\w\w/g).map(value => parseInt(value, 16));
    for (const frame of root.BCSchoolArt?.frames?.[school] || []) {
      const b = frame.hair;
      if (!b || ![b.x, b.y, b.w, b.h].every(Number.isFinite)) continue;
      const left = Math.max(0, Math.ceil(b.x)), top = Math.max(0, Math.ceil(b.y));
      const right = Math.min(canvas.width, Math.floor(b.x + b.w)), bottom = Math.min(canvas.height, Math.floor(b.y + b.h));
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = data.data[i], g = data.data[i + 1], blue = data.data[i + 2], alpha = data.data[i + 3];
        if (alpha < 64 || r < 48 || r > 185 || g > r * .87 || blue > g * .93) continue;
        const light = (.3 * r + .6 * g + .1 * blue) / 105;
        for (let channel = 0; channel < 3; channel++) data.data[i + channel] = Math.min(255, rgb[channel] * light);
      }
    }
    c.putImageData(data, 0, 0);
    if (hairAtlases.size >= 12) hairAtlases.delete(hairAtlases.keys().next().value);
    hairAtlases.set(key, canvas);
    return canvas;
  }
  function ellipse(c, x, y, rx, ry, color) {
    c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  }
  function label(c, text, x, y, color = "#fff", size = 11) {
    c.font = `${size / textScale}px Tahoma, sans-serif`; c.textAlign = "center";
    c.lineWidth = 2.4 / textScale; c.strokeStyle = "#344039ce"; c.lineJoin = "round";
    c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y);
  }
  function sprite(c, cell, x, y, height, hair = 0, bob = 0, name = "sprites") {
    const b = cells[name]?.[cell];
    if (!b) { ellipse(c, x, y - height / 2, height / 4, height / 2, "#d8cab2"); return; }
    const width = height * b.w / b.h;
    c.drawImage(images[name], b.x, b.y, b.w, b.h, x - width / 2, y - height + bob, width, height);
  }
  function headgearModel(id, pose) {
    const appearance = D.items[id]?.appearance;
    if (appearance?.layer !== "head") return null;
    const row = { cap: 0, cat_ears: 1, circlet: 2 }[appearance.style];
    const sourceFacing = root.BCSiamArt?.headgear?.runtimeDirectionColumns?.[pose.facing] ?? pose.facing;
    const b = cells["siam-headgear"]?.[row * 4 + sourceFacing];
    if (!b) return null;
    const width = pose.facing === 1 || pose.facing === 3 ? 13 : 15, height = width * b.h / b.w;
    const offset = appearance.style === "circlet" ? 4.8 : appearance.style === "cap" ? 3.5 : 1;
    return { name: "siam-headgear", source: b, x: pose.head.x - width / 2, y: pose.head.y + offset - height, w: width, h: height };
  }
  function paintPerson(c, x, y, plan, hair, head) {
    const b = plan.source, box = plan.bounds;
    c.save();
    if (plan.silhouette?.length) {
      c.beginPath();
      plan.silhouette.forEach(([sx, sy], i) => {
        const px = x + (sx - plan.sourceFoot[0]) * plan.scale;
        const py = y + (sy - plan.sourceFoot[1]) * plan.scale;
        if (i) c.lineTo(px, py); else c.moveTo(px, py);
      });
      c.closePath(); c.clip();
    }
    c.drawImage(tintedAtlas(hair, plan.atlas, plan.school), b.x, b.y, b.w, b.h,
      x + box.x, y + box.y, box.w, box.h);
    c.restore();
    const hat = headgearModel(head, plan);
    if (hat) {
      const source = hat.source;
      c.drawImage(images[hat.name], source.x, source.y, source.w, source.h, x + hat.x, y + hat.y, hat.w, hat.h);
    }
  }
  function person(c, x, y, opts = {}) {
    ellipse(c, x, y + 1.5, 7, 2.6, "#293c3b48");
    if (opts.npc) {
      const cell = { guide: 0, merchant: 1, healer: 2 }[opts.npc];
      sprite(c, cell, x, y, opts.npc === "healer" ? 35 : 34, 0, 0, "townsfolk");
      return { npc: opts.npc, atlas: "townsfolk", cell };
    }
    const school = classOf(opts), pose = opts.pose || root.BCAppearance.idle(opts.facing || 0);
    const plan = authoredFrame(school, pose);
    if (!plan) {
      ellipse(c, x, y - 17, 6, 16, "#d8cab2");
      return { authored: false, classId: school, school, loading: true };
    }
    paintPerson(c, x, y, plan, opts.hair || 0, opts.head);
    return plan;
  }
  function monster(c, m, t, selected) {
    const d = D.monsters[m.kind], height = monsterHeights[m.kind];
    ellipse(c, m.x, m.y + 2, d.boss ? 16 : 8, d.boss ? 5 : 3, "#233b3c44");
    if (selected) {
      c.strokeStyle = "#f6bb68"; c.lineWidth = 1.2 / textScale;
      c.beginPath(); c.ellipse(m.x, m.y + 2, d.boss ? 19 : 11, d.boss ? 6 : 4, 0, 0, Math.PI * 2); c.stroke();
    }
    sprite(c, monsterCells[m.kind], m.x, m.y, height, 0, Math.sin(t * 3 + m.x) * .65);
    if (selected || d.boss) label(c, `${d.name} · Lv.${d.level}`, m.x, m.y - height - 5 / textScale, "#fff", 10);
    if (m.hp < d.hp || selected) {
      const w = (d.boss ? 44 : 29) / textScale, h = 3 / textScale;
      c.fillStyle = "#263748"; c.fillRect(m.x - w / 2, m.y + 7 / textScale, w, h);
      c.fillStyle = "#e98399"; c.fillRect(m.x - w / 2, m.y + 7 / textScale, w * Math.max(0, m.hp / d.hp), h);
    }
  }
  function portal(c, x, y, left) {
    c.save();
    c.strokeStyle = "#d7f7ffb0"; c.lineWidth = 1.8 / textScale;
    c.beginPath(); c.ellipse(x, y - 11, 8, 17, 0, 0, Math.PI * 2); c.stroke();
    ellipse(c, x, y + 4, 12, 4, "#b3edff40");
    label(c, left ? "◂ กลับ" : "เดินทาง ▸", x, y + 18 / textScale, "#e8f8ff", 10);
    c.restore();
  }
  function view(canvas, s) {
    const screenWidth = canvas.clientWidth || 960, screenHeight = canvas.clientHeight || 560;
    const scale = Math.max(screenWidth / 960, screenHeight / 560);
    const width = screenWidth / scale, height = screenHeight / scale;
    return { scale, width, height,
      x: Math.max(0, Math.min(960 - width, s.player.x - width / 2)),
      y: Math.max(0, Math.min(560 - height, s.player.y - height / 2)) };
  }
  function draw(canvas, s) {
    const camera = view(canvas, s), density = Math.min(root.devicePixelRatio || 1, 2);
    if (!trackers.has(s)) trackers.set(s, root.BCAppearance.createTracker());
    const pose = root.BCAppearance.sample(trackers.get(s), s);
    const width = Math.max(1, Math.round(canvas.clientWidth * density));
    const height = Math.max(1, Math.round(canvas.clientHeight * density));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const c = canvas.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, width, height);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    c.save();
    c.setTransform(camera.scale * density, 0, 0, camera.scale * density,
      -camera.x * camera.scale * density, -camera.y * camera.scale * density);
    textScale = camera.scale;
    const ground = images[["meadow", "woodland", "cavern"][s.zone]];
    if (ground.complete && ground.naturalWidth) c.drawImage(ground, 0, 0, 960, 560);
    else { c.fillStyle = D.maps[s.zone].color; c.fillRect(0, 0, 960, 560); }
    if (s.zone > 0) portal(c, 42, 280, true);
    if (s.zone < 2) portal(c, 920, 280, false);
    if (s.destination) {
      c.strokeStyle = "#fffde9b0"; c.lineWidth = 1 / textScale;
      c.beginPath(); c.ellipse(s.destination.x, s.destination.y, 6, 3, 0, 0, Math.PI * 2); c.stroke();
    }
    const entities = s.monsters.filter(m => !m.dead).map(m => ({ y: m.y,
      draw: () => monster(c, m, s.clock, m.uid === s.target) }));
    if (s.zone === 0) for (const n of D.npcs) entities.push({ y: n.y, draw: () => {
      person(c, n.x, n.y, { npc: n.id });
      label(c, n.name, n.x, n.y - 39, "#f5f1ce", 10);
      if (n.id === "guide") label(c, s.questActive ? "?" : "!", n.x, n.y - 52, "#ffe695", 15);
      if (root.BCCore.dist(s.player, n) < 85) label(c, "E · " + n.thai, n.x, n.y + 13 / textScale, "#fff", 11);
    } });
    entities.push({ y: s.player.y, draw: () => {
      ellipse(c, s.player.x, s.player.y + 4, 15, 6, "#d6eced15");
      person(c, s.player.x, s.player.y, { job: s.job, hair: s.settings.hair, facing: s.player.facing,
        classId: s.classId, weapon: s.equipment.weapon, head: s.equipment.head, pose });
      label(c, D.classes[s.classId].name, s.player.x, s.player.y - (s.equipment.head ? 46 : 39), "#fff", 11);
    } });
    entities.sort((a, b) => a.y - b.y).forEach(e => e.draw());
    for (const e of s.effects) {
      c.globalAlpha = Math.min(1, e.ttl * 2);
      label(c, e.text, e.x, e.y - (1 - e.ttl) * 28, e.color, 13); c.globalAlpha = 1;
    }
    if (!assets.ready) label(c, assets.failed.length ? "โหลดภาพไม่ครบ · ลองรีเฟรชหน้าเว็บ" : "กำลังโหลดภาพ…",
      s.player.x, s.player.y - 58, "#fff", 11);
    c.restore(); textScale = 1;
  }
  function minimap(canvas, s) {
    const c = canvas.getContext("2d"), sx = canvas.width / 960, sy = canvas.height / 560;
    const ground = images[["meadow", "woodland", "cavern"][s.zone]];
    c.clearRect(0, 0, canvas.width, canvas.height);
    if (ground.complete && ground.naturalWidth) c.drawImage(ground, 0, 0, canvas.width, canvas.height);
    else { c.fillStyle = D.maps[s.zone].color; c.fillRect(0, 0, canvas.width, canvas.height); }
    for (const m of s.monsters) if (!m.dead) {
      c.fillStyle = D.monsters[m.kind].boss ? "#ffdb79" : "#ee8d91";
      c.fillRect(m.x * sx - 1, m.y * sy - 1, 2, 2);
    }
    if (s.zone === 0) for (const n of D.npcs) ellipse(c, n.x * sx, n.y * sy, 2, 2, "#69edee");
    ellipse(c, s.player.x * sx, s.player.y * sy, 3, 3, "#fff");
    c.strokeStyle = "#546180"; c.lineWidth = 1; c.stroke();
  }
  function portraitFrame(s, width, height, options = {}) {
    const pose = options.pose || root.BCAppearance.idle(0);
    const school = classOf(own(s,"classId") ? {classId:s.classId} : {});
    const plan = authoredFrame(school, pose);
    if (!plan) return null;
    const bodyBounds = plan.bounds, headBounds = headgearModel(s.equipment.head, plan);
    const shadowBounds = { x: -7, y: -1.1, w: 14, h: 5.2 };
    const bounds = [bodyBounds, headBounds, shadowBounds].filter(Boolean);
    const left = Math.min(...bounds.map(b => b.x)), top = Math.min(...bounds.map(b => b.y));
    const right = Math.max(...bounds.map(b => b.x + b.w)), bottom = Math.max(...bounds.map(b => b.y + b.h));
    const padding = Number.isFinite(options.padding) ? Math.max(0, options.padding) : 4;
    const scale = Math.max(0, Math.min((width - padding * 2) / (right - left), (height - padding * 2) / (bottom - top)));
    return { plan, scale, x: width / 2 - (left + right) * scale / 2,
      y: height / 2 - (top + bottom) * scale / 2, bodyBounds, headBounds,
      bounds: { x: left, y: top, w: right - left, h: bottom - top } };
  }
  function portrait(canvas, s) {
    const c = canvas.getContext("2d"); c.clearRect(0, 0, canvas.width, canvas.height);
    c.imageSmoothingEnabled = true;
    const frame = portraitFrame(s, canvas.width, canvas.height);
    if (!frame) {
      c.save(); c.translate(canvas.width / 2, canvas.height - 5);
      person(c, 0, 0, { classId: s.classId, head: s.equipment.head }); c.restore();
      return null;
    }
    c.save(); c.translate(frame.x, frame.y); c.scale(frame.scale, frame.scale);
    ellipse(c, 0, 1.5, 7, 2.6, "#293c3b48");
    paintPerson(c, 0, 0, frame.plan, s.settings.hair, s.equipment.head);
    c.restore();
    return frame;
  }
  assetNames.forEach(load);
  root.BCRender = { draw, minimap, portrait, portraitFrame, authoredFrame, frameCell, view, assets, person, cells, images };
})(window);
