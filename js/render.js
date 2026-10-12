/* Original procedural pixel artwork, authored for this game. */
(function (root) {
  "use strict";
  const D = root.BCData;
  let backgrounds = [];
  const rect = (c, x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), w, h);
  };
  function ellipse(c, x, y, rx, ry, color) {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }
  function label(c, text, x, y, color = "#f4eacc", size = 10) {
    c.font = `${size}px Tahoma, sans-serif`;
    c.textAlign = "center";
    c.lineWidth = 3;
    c.strokeStyle = "#26382aed";
    c.strokeText(text, x, y);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
  function tree(c, x, y, size = 1, zone = 0) {
    c.save();
    c.translate(x, y);
    c.scale(size, size);
    ellipse(c, 5, 5, 27, 9, "#203b2938");
    rect(c, -5, -35, 10, 39, zone === 2 ? "#666471" : "#786846");
    rect(c, -2, -30, 4, 33, zone === 2 ? "#868089" : "#9b8660");
    const colors =
      zone === 1
        ? ["#214634", "#315e41", "#447754", "#5d8a60"]
        : ["#3e633a", "#527844", "#668952", "#89a664"];
    for (let i = 0; i < 3; i++) {
      const w = 58 - i * 9,
        y0 = -39 - i * 18;
      rect(c, -w / 2, y0, w, 23, colors[0]);
      rect(c, -w / 2 + 4, y0 - 6, w - 8, 22, colors[1]);
      rect(c, -w / 2 + 9, y0 - 10, w - 20, 17, colors[2]);
      rect(c, -w / 2 + 12, y0 - 8, w - 33, 5, colors[3]);
    }
    c.restore();
  }
  function rock(c, x, y, zone) {
    ellipse(c, x + 4, y + 8, 20, 7, "#1b2d2630");
    rect(c, x - 15, y - 7, 29, 17, zone === 2 ? "#6d718b" : "#7e8a73");
    rect(c, x - 11, y - 13, 22, 15, zone === 2 ? "#9395a7" : "#a4aa90");
    rect(c, x - 8, y - 12, 10, 3, zone === 2 ? "#b0b2c5" : "#bfc2a5");
    rect(c, x + 5, y - 3, 9, 11, zone === 2 ? "#565b73" : "#6e7c67");
  }
  function house(c, x, y, roof) {
    ellipse(c, x, y + 8, 64, 14, "#22342733");
    rect(c, x - 48, y - 68, 96, 73, "#d9ca9c");
    rect(c, x - 43, y - 65, 86, 66, "#e7d9ad");
    rect(c, x - 50, y - 75, 100, 12, "#614f37");
    rect(c, x - 59, y - 83, 118, 12, roof);
    rect(c, x - 50, y - 94, 100, 13, roof);
    rect(c, x - 38, y - 103, 76, 12, roof);
    for (let i = -45; i < 48; i += 12)
      rect(c, x + i, y - 85, 8, 3, "#e4b68a55");
    rect(c, x - 49, y - 63, 8, 68, "#786d49");
    rect(c, x + 41, y - 63, 8, 68, "#786d49");
    rect(c, x - 14, y - 33, 28, 37, "#5b5640");
    rect(c, x - 10, y - 29, 20, 33, "#8a7952");
    rect(c, x + 5, y - 14, 3, 3, "#dac58d");
    for (const dx of [-32, 22]) {
      rect(c, x + dx, y - 51, 17, 20, "#786b47");
      rect(c, x + dx + 3, y - 48, 11, 13, "#b2c7ae");
      rect(c, x + dx + 8, y - 48, 2, 13, "#e6d5a2");
    }
    rect(c, x - 18, y + 2, 36, 5, "#ac9e72");
  }
  function portal(c, x, y, left, zone) {
    ellipse(c, x, y + 8, 22, 10, "#d4ce9833");
    rect(c, x - 16, y - 34, 7, 44, "#9d9d7c");
    rect(c, x + 10, y - 34, 7, 44, "#9d9d7c");
    rect(c, x - 16, y - 40, 33, 9, "#c3be9a");
    rect(c, x - 13, y - 35, 4, 39, "#d8cea5");
    rect(c, x - 8, y - 30, 17, 37, zone === 2 ? "#a3adc34d" : "#cbd39c55");
    label(c, left ? "◂ กลับ" : "เดินทาง ▸", x, y + 28, "#f3e3ab", 9);
  }
  function background(zone) {
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = 560;
    const g = c.getContext("2d"),
      map = D.maps[zone];
    let seed = 7643 + zone * 990;
    const r = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    rect(g, 0, 0, 960, 560, map.color);
    for (let y = 0; y < 560; y += 24)
      for (let x = 0; x < 960; x += 24) {
        const shade = r();
        if (shade > 0.6)
          rect(
            g,
            x,
            y,
            24,
            24,
            zone === 2
              ? shade > 0.9
                ? "#515469"
                : "#484d61"
              : shade > 0.9
                ? "#92a36525"
                : "#bac3860c",
          );
      }
    // Winding footpaths and welcoming village commons.
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(0, 280);
    g.bezierCurveTo(160, 270, 285, 400, 440, 330);
    g.bezierCurveTo(630, 230, 780, 305, 960, 280);
    g.strokeStyle = zone === 2 ? "#6d6a73" : "#b8b18a";
    g.lineWidth = 57;
    g.stroke();
    g.strokeStyle = zone === 2 ? "#8b829033" : "#d0c79b";
    g.lineWidth = 43;
    g.stroke();
    if (zone === 0) {
      g.beginPath();
      g.moveTo(155, 150);
      g.lineTo(155, 380);
      g.lineTo(255, 345);
      g.strokeStyle = "#c3bc91";
      g.lineWidth = 45;
      g.stroke();
      // Quiet pond in the lower meadow.
      ellipse(g, 710, 480, 120, 54, "#a6b58a");
      ellipse(g, 710, 475, 110, 47, "#628f88");
      ellipse(g, 710, 471, 98, 38, "#82a8a0");
      for (let i = 0; i < 18; i++)
        rect(g, 620 + r() * 170, 442 + r() * 52, 8 + r() * 18, 2, "#bbd5b84d");
    }
    for (let i = 0; i < 440; i++) {
      const x = r() * 950,
        y = r() * 550;
      if (zone !== 2) {
        rect(g, x, y, 2, 4, "#c7d3a23b");
        if (i % 11 === 0) {
          rect(g, x, y - 3, 3, 3, i % 2 ? "#ecd8ab" : "#e2bcb3");
          rect(g, x + 3, y, 3, 2, "#dddba5");
        }
      } else {
        rect(g, x, y, 2, 2, "#a2adc525");
      }
    }
    if (zone === 0) {
      house(g, 142, 139, "#9b7051");
      house(g, 121, 425, "#ad8660");
      rect(g, 277, 246, 25, 6, "#d0c4a5");
      rect(g, 280, 239, 19, 7, "#b09b80");
      for (let i = 0; i < 5; i++) {
        rect(g, 50 + i * 18, 210, 5, 33, "#ada87a");
        rect(g, 50 + i * 18, 217, 20, 4, "#c8bf8a");
        rect(g, 50 + i * 18, 231, 20, 4, "#c8bf8a");
      }
      label(g, "ADVENTURER’S GUILD", 142, 30, "#eee0ac", 8);
      label(g, "TRADING POST", 121, 453, "#eee0ac", 8);
    }
    for (let i = 0; i < 28; i++) {
      const x = 25 + r() * 910,
        y = 60 + r() * 450;
      if (zone === 0 && (x < 340 || y > 415)) continue;
      if (Math.abs(y - 280) < 60) continue;
      if (zone === 2) {
        rock(g, x, y, zone);
        if (i % 3 === 0) {
          g.fillStyle = "#95c5ca";
          g.beginPath();
          g.moveTo(x, y - 44);
          g.lineTo(x + 10, y - 8);
          g.lineTo(x - 9, y - 4);
          g.closePath();
          g.fill();
          rect(g, x, y - 31, 2, 23, "#d5ece4");
        }
      } else tree(g, x, y, 0.65 + r() * 0.5, zone);
    }
    for (let i = 0; i < 19; i++) {
      const x = 335 + r() * 600,
        y = 70 + r() * 435;
      if (Math.abs(y - 290) > 65) rock(g, x, y, zone);
    }
    // Forest boundary gives the playfield a framed, sheltered feeling.
    for (let x = 10; x < 980; x += 55)
      if (zone !== 2) {
        tree(g, x, 40, 0.8, zone);
        tree(g, x, 568, 0.7, zone);
      } else {
        rock(g, x, 25, zone);
        rock(g, x, 553, zone);
      }
    if (zone > 0) portal(g, 42, 280, true, zone);
    if (zone < 2) portal(g, 920, 280, false, zone);
    const vignette = g.createRadialGradient(480, 270, 190, 480, 280, 600);
    vignette.addColorStop(0, "#10291900");
    vignette.addColorStop(1, "#10201838");
    g.fillStyle = vignette;
    g.fillRect(0, 0, 960, 560);
    return c;
  }
  function person(
    c,
    x,
    y,
    {
      job = "Novice",
      hair = 0,
      facing = 0,
      walk = 0,
      weapon = null,
      npcColor = null,
      attack = 0,
    } = {},
  ) {
    c.save();
    c.translate(Math.round(x), Math.round(y));
    ellipse(c, 0, 3, 13, 5, "#22302355");
    const bob = walk ? Math.round(Math.sin(walk * 13)) : 0;
    c.translate(0, bob);
    const back = facing === 2,
      side = facing === 1 || facing === 3,
      flip = facing === 3 ? -1 : 1;
    c.scale(flip, 1);
    const coat = npcColor || (job === "Swordman" ? "#99aeb0" : "#d8c9a8"),
      dark = job === "Swordman" ? "#687e88" : "#877e69";
    const stride = walk ? Math.round(Math.sin(walk * 13) * 3) : 0;
    rect(c, -8, -8 + stride, 6, 9, "#424e4b");
    rect(c, 2, -8 - stride, 6, 9, "#424e4b");
    rect(c, -9, -1 + stride, 7, 4, "#5a4b3f");
    rect(c, 2, -1 - stride, 8, 4, "#5a4b3f");
    if (weapon && back) {
      c.save();
      c.rotate(-0.45);
      rect(c, 12, -29, 3, 25, "#c9d2c4");
      rect(c, 7, -7, 13, 3, "#a58c50");
      c.restore();
    }
    rect(c, -9, -27, 18, 22, dark);
    rect(c, -7, -27, 14, 18, coat);
    rect(c, -6, -27, 5, 15, "#eff0d330");
    rect(c, -10, -11, 20, 3, "#716343");
    rect(c, -2, -11, 4, 3, "#c3aa68");
    rect(c, -13, -25, 5, 14, coat);
    rect(c, 8, -25, 5, 14, coat);
    rect(c, -13, -13, 5, 5, "#dab795");
    rect(c, 8, -13, 5, 5, "#dab795");
    rect(c, -8, -42, 17, 15, "#e4bf98");
    rect(c, -9, -38, 3, 7, "#d4a67f");
    rect(c, 8, -38, 3, 7, "#d4a67f");
    const hairColors = [
        "#756048",
        "#a48152",
        "#493f3b",
        "#a36750",
        "#d3bb80",
        "#687c88",
      ],
      hc = hairColors[hair % 6];
    rect(c, -9, -46, 18, 8, hc);
    rect(c, -11, -43, 5, 13, hc);
    rect(c, 6, -43, 5, 8, hc);
    rect(c, -6, -47, 12, 3, hc);
    if (back) rect(c, -8, -39, 17, 10, hc);
    else {
      rect(c, side ? 3 : -4, -35, 2, 3, "#344b3e");
      if (!side) rect(c, 4, -35, 2, 3, "#344b3e");
      rect(c, 0, -29, 4, 2, "#bd856a");
    }
    if (weapon && !back) {
      c.save();
      c.translate(12, -16);
      c.rotate(attack ? -0.9 : 0.25);
      rect(c, 0, -23, 3, 24, weapon === "moon_blade" ? "#bfcfe9" : "#cad1bd");
      rect(c, -1, -24, 2, 3, "#f0ecce");
      rect(c, -4, 0, 11, 3, "#ba9b56");
      rect(c, 0, 3, 3, 6, "#78583f");
      c.restore();
    }
    c.restore();
  }
  function monster(c, m, t, selected) {
    const d = D.monsters[m.kind],
      scale = d.boss ? 1.7 : 1;
    const bob = Math.round(Math.sin(t * 3 + m.x) * 2);
    c.save();
    c.translate(Math.round(m.x), Math.round(m.y));
    ellipse(c, 0, 3, 19 * scale, 6 * scale, "#23352655");
    if (selected) {
      c.strokeStyle = "#f5d58d";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(0, 4, 24 * scale, 9 * scale, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.scale(scale, scale);
    c.translate(0, bob);
    const a = d.color;
    if (d.shape === "slime") {
      rect(c, -17, -16, 34, 15, a);
      rect(c, -13, -24, 25, 15, a);
      rect(c, -8, -29, 16, 8, a);
      rect(c, -13, -22, 7, 6, "#ffffff66");
      rect(c, -15, -3, 30, 4, "#6a665d44");
      rect(c, -6, -14, 3, 4, "#3d4a40");
      rect(c, 7, -14, 3, 4, "#3d4a40");
      rect(c, 0, -7, 4, 2, "#ac6765");
    }
    if (d.shape === "bug") {
      for (let i = 0; i < 3; i++) {
        rect(c, -17 + i * 11, -17 - (i % 2) * 3, 15, 17, a);
        rect(c, -14 + i * 11, -19 - (i % 2) * 3, 10, 3, "#d7e0aa");
        rect(c, -13 + i * 11, -2, 4, 5, "#536b47");
      }
      rect(c, 13, -13, 3, 3, "#334733");
      rect(c, 10, -28, 2, 10, "#c4d4a0");
    }
    if (d.shape === "rabbit") {
      rect(c, -13, -20, 27, 22, a);
      rect(c, -10, -28, 21, 15, a);
      rect(c, -9, -48, 6, 23, a);
      rect(c, 5, -45, 6, 20, a);
      rect(c, -7, -45, 2, 15, "#cf9aa9");
      rect(c, 7, -42, 2, 14, "#cf9aa9");
      rect(c, -14, -2, 9, 5, a);
      rect(c, 7, -2, 9, 5, a);
      rect(c, -5, -23, 3, 4, "#51495c");
      rect(c, 5, -23, 3, 4, "#51495c");
      rect(c, 0, -15, 3, 2, "#c48e9e");
    }
    if (d.shape === "tree") {
      rect(c, -15, -37, 30, 38, a);
      rect(c, -19, -4, 13, 7, "#806f51");
      rect(c, 6, -4, 13, 7, "#806f51");
      rect(c, -19, -32, 6, 20, "#7a684e");
      rect(c, 12, -36, 7, 24, "#b49b70");
      rect(c, -9, -25, 5, 5, "#423c2c");
      rect(c, 5, -25, 5, 5, "#423c2c");
      rect(c, -5, -12, 13, 5, "#5a4d32");
      rect(c, -21, -41, 39, 8, "#4f7145");
      rect(c, -14, -48, 29, 10, "#78915a");
      rect(c, -8, -52, 16, 7, "#92a969");
    }
    if (d.shape === "bee") {
      ellipse(c, -12, -27, 14, 7, "#d6e8d1bb");
      ellipse(c, 13, -29, 14, 7, "#d6e8d1bb");
      rect(c, -15, -22, 31, 19, a);
      rect(c, -7, -22, 6, 19, "#62563c");
      rect(c, 5, -22, 5, 19, "#62563c");
      rect(c, 12, -17, 7, 12, a);
      rect(c, 16, -15, 3, 4, "#303e38");
      rect(c, -19, -12, 6, 3, "#e3d4aa");
    }
    if (d.shape === "golem") {
      rect(c, -16, -34, 32, 28, "#789997");
      rect(c, -12, -31, 24, 21, a);
      rect(c, -12, -48, 25, 19, "#abc6be");
      rect(c, -8, -40, 5, 3, "#e3efb2");
      rect(c, 5, -40, 5, 3, "#e3efb2");
      rect(c, -23, -30, 9, 28, "#8ca6a0");
      rect(c, 16, -30, 9, 28, "#8ca6a0");
      rect(c, -14, -8, 10, 13, "#718d8b");
      rect(c, 5, -8, 10, 13, "#718d8b");
      rect(c, -3, -27, 7, 12, "#cbe3b4");
      rect(c, -1, -25, 3, 8, "#f2f4cb");
    }
    c.restore();
    label(
      c,
      `${d.name}  Lv.${d.level}`,
      m.x,
      m.y - (d.boss ? 89 : d.shape === "rabbit" ? 57 : 42),
      d.boss ? "#f0d79c" : "#e9e8c9",
      d.boss ? 11 : 9,
    );
    if (m.hp < d.hp || selected) {
      const w = d.boss ? 64 : 32;
      rect(c, m.x - w / 2, m.y + 12, w, 4, "#2f382c");
      rect(
        c,
        m.x - w / 2,
        m.y + 12,
        w * Math.max(0, m.hp / d.hp),
        4,
        "#cf9882",
      );
    }
  }
  function view(canvas, s) {
    const screenWidth = canvas.clientWidth || 960;
    const screenHeight = canvas.clientHeight || 560;
    const scale = Math.max(screenWidth / 960, screenHeight / 560) * 1.15;
    const width = screenWidth / scale;
    const height = screenHeight / scale;
    return {
      scale,
      width,
      height,
      x: Math.max(0, Math.min(960 - width, s.player.x - width / 2)),
      y: Math.max(0, Math.min(560 - height, s.player.y - height / 2)),
    };
  }
  function draw(canvas, s) {
    const camera = view(canvas, s);
    const density = Math.min(root.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(canvas.clientWidth * density));
    const pixelHeight = Math.max(1, Math.round(canvas.clientHeight * density));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const c = canvas.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.imageSmoothingEnabled = false;
    c.save();
    c.setTransform(
      camera.scale * density,
      0,
      0,
      camera.scale * density,
      -camera.x * camera.scale * density,
      -camera.y * camera.scale * density,
    );
    if (!backgrounds[s.zone]) backgrounds[s.zone] = background(s.zone);
    c.drawImage(backgrounds[s.zone], 0, 0);
    if (s.destination) {
      c.strokeStyle = "#e6d99a88";
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(s.destination.x, s.destination.y, 9, 4, 0, 0, Math.PI * 2);
      c.stroke();
    }
    const entities = s.monsters
      .filter((m) => !m.dead)
      .map((m) => ({
        y: m.y,
        draw: () => monster(c, m, s.clock, m.uid === s.target),
      }));
    if (s.zone === 0)
      for (const n of D.npcs)
        entities.push({
          y: n.y,
          draw: () => {
            person(c, n.x, n.y, {
              npcColor: n.color,
              hair: n.id === "healer" ? 4 : 1,
            });
            label(c, n.name, n.x, n.y - 54, "#f4df9c", 9);
            if (n.id === "guide")
              label(c, s.questActive ? "?" : "!", n.x, n.y - 72, "#f6d580", 19);
            if (root.BCCore.dist(s.player, n) < 85)
              label(c, "E · " + n.thai, n.x, n.y + 22, "#f5e9b5", 10);
          },
        });
    entities.push({
      y: s.player.y,
      draw: () => {
        ellipse(c, s.player.x, s.player.y + 4, 15, 6, "#e7d79633");
        person(c, s.player.x, s.player.y, {
          job: s.job,
          hair: s.settings.hair,
          facing: s.player.facing,
          walk: s.destination ? s.clock : 0,
          weapon: s.equipment.weapon,
          attack: s.cooldowns.swing > 0,
        });
        label(c, s.job, s.player.x, s.player.y - 55, "#fff1b5", 10);
      },
    });
    entities.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
    for (const e of s.effects) {
      c.globalAlpha = Math.min(1, e.ttl * 2);
      label(c, e.text, e.x, e.y - (1 - e.ttl) * 28, e.color, 13);
      c.globalAlpha = 1;
    }
    // Soft drifting dust, entirely cosmetic and deterministic.
    for (let i = 0; i < 12; i++) {
      const x = (i * 89 + s.clock * 5) % 960,
        y = 95 + ((i * 47) % 350) + Math.sin(s.clock + i) * 9;
      rect(c, x, y, 2, 2, s.zone === 2 ? "#e3eacc88" : "#f4ecb66b");
    }
    c.restore();
  }
  function minimap(canvas, s) {
    const c = canvas.getContext("2d");
    c.fillStyle = D.maps[s.zone].color;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.strokeStyle = "#c6bf9480";
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(0, 56);
    c.lineTo(192, 56);
    c.stroke();
    for (const m of s.monsters)
      if (!m.dead)
        rect(
          c,
          m.x / 5 - 1,
          m.y / 5 - 1,
          3,
          3,
          D.monsters[m.kind].boss ? "#e7c586" : "#ecc0a6",
        );
    if (s.zone === 0)
      for (const n of D.npcs)
        rect(c, n.x / 5 - 2, n.y / 5 - 2, 4, 4, "#ccd1a9");
    rect(c, s.player.x / 5 - 2, s.player.y / 5 - 2, 5, 5, "#fff2bd");
  }
  function portrait(canvas, s) {
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, 68, 76);
    c.save();
    c.translate(34, 68);
    c.scale(1.2, 1.2);
    person(c, 0, 0, {
      job: s.job,
      hair: s.settings.hair,
      weapon: s.equipment.weapon,
    });
    c.restore();
  }
  root.BCRender = { draw, minimap, portrait, view };
})(window);
