/* Original illustrated maps and chibi sprite atlas. See ASSET_PROVENANCE.md. */
(function (root) {
  "use strict";
  const D = root.BCData;
  const assets = { ready: false, failed: [], loaded: 0, total: 8 };
  const images = {};
  const cells = {};
  const hairAtlases = new Map();
  const trackers = new WeakMap();
  let textScale = 1;
  const hairColors = ["#956446", "#c49c56", "#49434a", "#b45d45", "#dcc484", "#718ca6"];
  // This illustrated equipment sheet has taller weapon cells. Keep the full blades
  // in their own source band instead of cutting them into the circlet frames.
  const gearRowBands = [0, .25, .47, .605, 1];
  const monsterCells = { poring: 8, fabre: 9, lunatic: 10, willow: 11, hornet: 12, poporing: 13, guardian: 14 };
  const monsterHeights = { poring: 20, fabre: 23, lunatic: 29, willow: 30, hornet: 28, poporing: 22, guardian: 48 };

  function load(name) {
    const img = new Image();
    images[name] = img;
    img.onload = () => {
      if (!["meadow", "woodland", "cavern"].includes(name)) measureCells(img, name);
      assets.loaded++;
      assets.ready = assets.loaded === assets.total;
    };
    img.onerror = () => assets.failed.push(name);
    img.src = `assets/art/${name}.webp`;
  }
  // Atlas gutters vary slightly; painted bounds put every sprite's feet on the ground.
  function measureCells(img, name) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const c = canvas.getContext("2d", { willReadFrequently: true });
    c.drawImage(img, 0, 0);
    const pixels = c.getImageData(0, 0, canvas.width, canvas.height).data;
    cells[name] = [];
    for (let cell = 0; cell < 16; cell++) {
      const sx = Math.round((cell % 4) * canvas.width / 4);
      const row = Math.floor(cell / 4);
      const sy = Math.round(name === "gear" ? gearRowBands[row] * canvas.height : row * canvas.height / 4);
      const ex = Math.round((cell % 4 + 1) * canvas.width / 4);
      const ey = Math.round(name === "gear" ? gearRowBands[row + 1] * canvas.height : (row + 1) * canvas.height / 4);
      let left = ex, top = ey, right = sx, bottom = sy;
      for (let y = sy; y < ey; y++) for (let x = sx; x < ex; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 64) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      cells[name][cell] = right >= left && bottom >= top
        ? { x: left, y: top, w: right - left + 1, h: bottom - top + 1 }
        : null;
    }
  }
  function tintedAtlas(hair, name) {
    if (!hair) return images[name];
    const key = `${name}:${hair}`;
    if (hairAtlases.has(key)) return hairAtlases.get(key);
    const img = images[name];
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const c = canvas.getContext("2d", { willReadFrequently: true });
    c.drawImage(img, 0, 0);
    const data = c.getImageData(0, 0, canvas.width, canvas.height);
    const rgb = hairColors[hair % hairColors.length].match(/\w\w/g).map(n => parseInt(n, 16));
    for (let cell = 0; cell < (name === "sprites" ? 8 : 16); cell++) {
      const b = cells[name][cell];
      if (!b) continue;
      for (let y = b.y; y < b.y + b.h * .44; y++) for (let x = b.x; x < b.x + b.w; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = data.data[i], g = data.data[i + 1], blue = data.data[i + 2], alpha = data.data[i + 3];
        if (alpha < 64 || r < 48 || r > 185 || g > r * .87 || blue > g * .93) continue;
        const light = (.3 * r + .6 * g + .1 * blue) / 105;
        for (let channel = 0; channel < 3; channel++) data.data[i + channel] = Math.min(255, rgb[channel] * light);
      }
    }
    c.putImageData(data, 0, 0);
    // Bound palette memory while retaining the recently used animation atlases.
    if (hairAtlases.size >= 12) hairAtlases.delete(hairAtlases.keys().next().value);
    hairAtlases.set(key, canvas);
    return canvas;
  }
  function ellipse(c, x, y, rx, ry, color) {
    c.fillStyle = color;
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  }
  function label(c, text, x, y, color = "#fff", size = 11) {
    c.font = `${size / textScale}px Tahoma, sans-serif`;
    c.textAlign = "center";
    c.lineWidth = 2.4 / textScale;
    c.strokeStyle = "#344039ce";
    c.lineJoin = "round";
    c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y);
  }
  function sprite(c, cell, x, y, height, hair = 0, bob = 0, name = "sprites") {
    const b = cells[name]?.[cell];
    if (!b) {
      ellipse(c, x, y - height / 2, height / 4, height / 2, "#d8cab2");
      return;
    }
    const width = height * b.w / b.h;
    c.drawImage(hair ? tintedAtlas(hair, name) : images[name], b.x, b.y, b.w, b.h,
      x - width / 2, y - height + bob, width, height);
  }
  function weapon(c, x, y, id, pose) {
    const appearance = D.items[id]?.appearance;
    if (!appearance || appearance.layer !== "weapon") return;
    const cell = { short_sword: 12, long_sword: 13, moon_blade: 14 }[appearance.style];
    const b = cells.gear?.[cell];
    if (!b) return;
    c.save();
    c.translate(x + pose.hand.x, y + pose.hand.y);
    const restingAngle = pose.facing === 3 ? -.32 : .32;
    c.rotate(pose.hand.angle + (pose.mode === "attack" ? 0 : restingAngle));
    const height = appearance.length + 5;
    const width = height * b.w / b.h;
    c.drawImage(images.gear, b.x, b.y, b.w, b.h, -width / 2, -height * .81, width, height);
    // A short arc helps read the strike even at the small world sprite size.
    if (pose.mode === "attack" && pose.frame === 1) {
      c.strokeStyle = id === "moon_blade" ? "#cce5ffba" : "#fff5d68f";
      c.lineWidth = 1;
      c.beginPath(); c.arc(0, 0, appearance.length * .85, -2.9, -1.1); c.stroke();
    }
    c.restore();
  }
  function headgear(c, x, y, id, pose) {
    const appearance = D.items[id]?.appearance;
    if (!appearance || appearance.layer !== "head") return;
    const row = { cap: 0, cat_ears: 1, circlet: 2 }[appearance.style];
    const b = cells.gear?.[row * 4 + pose.facing];
    if (!b) return;
    const width = pose.facing === 1 || pose.facing === 3 ? 13 : 15;
    const height = width * b.h / b.w;
    const offset = appearance.style === "circlet" ? 4.8 : appearance.style === "cap" ? 3.5 : 1;
    c.drawImage(images.gear, b.x, b.y, b.w, b.h,
      x + pose.head.x - width / 2, y + pose.head.y + offset - height, width, height);
  }
  function person(c, x, y, opts = {}) {
    const { job = "Novice", hair = 0, facing = 0, weapon: id, head, pose = root.BCAppearance.idle(facing), npc } = opts;
    ellipse(c, x, y + 1.5, 7, 2.6, "#293c3b48");
    const height = npc === "healer" ? 35 : 34;
    let name = "sprites", cell = npc === "healer" ? 15 : (job === "Swordman" || npc === "guide" ? 4 : 0) + pose.facing;
    if (!npc && pose.mode === "walk") {
      name = job === "Swordman" ? "swordman-walk" : "novice-walk";
      cell = pose.facing * 4 + pose.frame;
    } else if (!npc && pose.mode === "attack") {
      name = "attacks"; cell = pose.facing * 4 + (job === "Swordman" ? 2 : 0) + pose.frame;
    }
    // Keep the base character visible while an animation atlas is still downloading.
    if (!cells[name]?.[cell]) { name = "sprites"; cell = (job === "Swordman" ? 4 : 0) + pose.facing; }
    if (pose.hand.behind) weapon(c, x, y, id, pose);
    sprite(c, cell, x + pose.lean, y, height, npc ? 0 : hair, pose.bob, name);
    if (!pose.hand.behind) weapon(c, x, y, id, pose);
    headgear(c, x, y, head, pose);
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
        weapon: s.equipment.weapon, head: s.equipment.head, pose });
      label(c, s.job, s.player.x, s.player.y - (s.equipment.head ? 46 : 39), "#fff", 11);
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
  function portrait(canvas, s) {
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.imageSmoothingEnabled = true;
    c.save();
    const scale = Math.min(canvas.width / 40, canvas.height / 45);
    c.translate(canvas.width / 2, canvas.height - 4);
    c.scale(scale, scale);
    person(c, 0, 0, { job: s.job, hair: s.settings.hair, weapon: s.equipment.weapon,
      head: s.equipment.head, pose: root.BCAppearance.idle(0) });
    c.restore();
  }
  ["meadow", "woodland", "cavern", "sprites", "novice-walk", "swordman-walk", "attacks", "gear"].forEach(load);
  root.BCRender = { draw, minimap, portrait, view, assets };
})(window);
