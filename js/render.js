// =============================================
//  画面绘制：地图、建筑、角色、怪物、昼夜光照
// =============================================
function worldToScreen(wx, wy) {
  return { x: (wx - G.cam.x) * G.cam.zoom + G.sw / 2, y: (wy - G.cam.y) * G.cam.zoom + G.sh / 2 };
}
function screenToWorld(sx, sy) {
  return { x: (sx - G.sw / 2) / G.cam.zoom + G.cam.x, y: (sy - G.sh / 2) / G.cam.zoom + G.cam.y };
}
function screenToTile(sx, sy) {
  const w = screenToWorld(sx, sy);
  return { x: Math.floor(w.x / T), y: Math.floor(w.y / T) };
}

function hpBar(ctx, x, y, w, ratio, color) {
  ctx.fillStyle = '#1a1c2c';
  ctx.fillRect(x - 0.5, y - 0.5, w + 1, 2.5);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), 1.5);
}

// 在世界坐标里画小字（例如 NPC 头上的 ! ?）
function drawWorldLabel(ctx, text, x, y, color) {
  ctx.font = 'bold 9px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1a1c2c';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function buildingSprite(b) {
  return SPR[b.type === 'core' ? G.def.coreSprite : (b.def.sprite || b.type)];
}

function render() {
  const ctx = G.ctx, dpr = G.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1a1c2c';
  ctx.fillRect(0, 0, G.canvas.width, G.canvas.height);
  if (G.scene !== 'game') { drawScene(ctx); return; }
  // 丧尸模式：在建筑里面时画室内地图
  if (G.inside && G.def.hooks.renderInside) {
    G.def.hooks.renderInside(ctx);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawVignette(ctx);
    drawUI(ctx);
    return;
  }

  const z = G.cam.zoom, hooks = G.def.hooks;
  const ox = Math.round((G.sw / 2 - G.cam.x * z) * dpr);
  const oy = Math.round((G.sh / 2 - G.cam.y * z) * dpr);
  ctx.setTransform(z * dpr, 0, 0, z * dpr, ox, oy);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(G.ground, 0, 0, MAP_W * T, MAP_H * T);

  const tl = screenToWorld(0, 0), br = screenToWorld(G.sw, G.sh);
  const x0 = Math.max(0, Math.floor(tl.x / T) - 1), y0 = Math.max(0, Math.floor(tl.y / T) - 1);
  const x1 = Math.min(MAP_W - 1, Math.floor(br.x / T) + 1), y1 = Math.min(MAP_H - 1, Math.floor(br.y / T) + 1);

  drawWaterShimmer(ctx, x0, y0, x1, y1);

  // 资源点（树会随风轻轻摆动）
  const zd = z * dpr;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const n = G.nodes[idx(x, y)];
      if (!n) continue;
      const def = G.def.nodes[n.type];
      let sx = x * T;
      if (G.time < n.shakeUntil) sx += Math.sin(G.time * 80) * 1.2;
      const searched = n.searchedUntil > G.day;
      const key = def.sprite || n.type, tall = SWAY[key];
      drawShadow(ctx, x * T + 8, y * T + 14.5, tall ? 15 : 13, 0.8);
      if (searched) ctx.globalAlpha = 0.5;
      if (tall) {
        const k = Math.sin(G.time * 1.7 + x * 0.7 + y * 0.45) * 0.035 * tall;
        const baseY = y * T + 15;
        ctx.setTransform(zd, 0, -k * zd, zd, ox + k * baseY * zd, oy);
        ctx.drawImage(SPR[key].img, sx, y * T, 16, 16);
        ctx.setTransform(zd, 0, 0, zd, ox, oy);
      } else ctx.drawImage(SPR[key].img, sx, y * T, 16, 16);
      ctx.globalAlpha = 1;
      if (def.res && n.amount < n.max) hpBar(ctx, x * T + 3, y * T + 15, 10, n.amount / n.max, '#ffcd75');
      if (def.search && !searched && G.phase === 'day') {
        ctx.fillStyle = '#ffcd75';
        ctx.fillRect(x * T + 7, y * T - 1 + Math.sin(G.time * 4 + x) * 1, 2, 2);
      }
    }
  }

  // 模式自己的地面物体（丧尸模式：城市建筑、路灯、垃圾等）
  if (hooks.drawUnder) hooks.drawUnder(ctx, x0, y0, x1, y1);

  // 建筑（先画所有阴影，再画建筑本体）
  for (const b of G.buildings) if (!isWallLike(b)) drawShadow(ctx, (b.x + b.size / 2) * T + 1, (b.y + b.size) * T - 1.5, b.size * T * 0.95, 0.75);
  for (const b of G.buildings) {
    const s = b.size * T;
    if (isWallLike(b)) drawWallBuilding(ctx, b); // 墙和门自动拼接（js/walls.js）
    else { const spr = buildingSprite(b); ctx.drawImage(b.hit > 0 ? spr.white : spr.img, b.x * T, b.y * T, s, s); }
    for (let i = 1; i < b.level; i++) {
      ctx.fillStyle = '#1a1c2c';
      ctx.fillRect(b.x * T + i * 3 - 2.5, b.y * T + 0.5, 3, 3);
      ctx.fillStyle = '#ffcd75';
      ctx.fillRect(b.x * T + i * 3 - 2, b.y * T + 1, 2, 2);
    }
    if (b.hp < b.maxHp) hpBar(ctx, b.x * T + 2, b.y * T - 2, s - 4, b.hp / b.maxHp, b.type === 'core' ? '#ef7d57' : '#38b764');
    if (b.idle) {
      ctx.fillStyle = '#ffcd75';
      ctx.fillRect(b.x * T + s - 4, b.y * T + 1, 2, 4);
      ctx.fillRect(b.x * T + s - 4, b.y * T + 6, 2, 2);
    }
  }

  // 营地火焰（每帧跳动）
  if (G.core && G.core.alive && G.def.fire && !(G.furnace && furnaceLevel() === 0)) {
    const fx = G.core.x * T + G.def.fire[0], fy = G.core.y * T + G.def.fire[1];
    const h = 5 + Math.sin(G.time * 18) + Math.random() * 1.5;
    ctx.fillStyle = '#b13e53'; ctx.fillRect(fx - 2, fy - h, 5, h);
    ctx.fillStyle = '#ef7d57'; ctx.fillRect(fx - 1, fy - h + 1, 3, h - 1);
    ctx.fillStyle = '#ffcd75'; ctx.fillRect(fx, fy - h * 0.6, 1, h * 0.6);
    drawEmbers(ctx, fx + 0.5, fy - 3);
  }

  const sel = G.selected;
  if (sel) {
    ctx.strokeStyle = '#ffcd75';
    ctx.lineWidth = 1;
    ctx.strokeRect(sel.x * T + 0.5, sel.y * T + 0.5, sel.size * T - 1, sel.size * T - 1);
    drawRange(ctx, sel.type, sel.cx, sel.cy, sel);
  }

  if (G.buildMode && G.hover && inMap(G.hover.x, G.hover.y) && G.state === 'play') {
    const hx = G.hover.x, hy = G.hover.y, ok = !placeProblem(G.buildMode, hx, hy);
    ctx.globalAlpha = 0.6;
    const bd = bdef(G.buildMode);
    if (bd.wall || bd.door) drawWallPreview(ctx, G.buildMode, hx, hy);
    else ctx.drawImage(SPR[bd.sprite || G.buildMode].img, hx * T, hy * T, 16, 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ok ? 'rgba(56,183,100,0.35)' : 'rgba(177,62,83,0.45)';
    ctx.fillRect(hx * T, hy * T, T, T);
    drawRange(ctx, G.buildMode, (hx + 0.5) * T, (hy + 0.5) * T, null);
  }

  if (hooks.drawWorld) hooks.drawWorld(ctx);

  // 怪物（按 y 排序，下面的挡住上面的）
  G.monsters.sort((a, b) => a.y - b.y);
  for (const m of G.monsters) {
    const spr = SPR[m.def.sprite || m.type], s = m.def.scale || 1, w = spr.w * s, h = spr.h * s;
    if (hooks.drawMonsterFx) hooks.drawMonsterFx(ctx, m); // 丧尸模式：变异光环、冻结、混乱等
    const bob = m.def.fly ? Math.sin(G.time * 10 + m.bob) * 2 : -Math.abs(Math.sin(G.time * 8 + m.bob)) * 1.5 * s;
    drawShadow(ctx, m.x, m.y + (m.def.fly ? 4 : 2.5) * s, (m.def.fly ? 8 : 12) * s, m.def.fly ? 0.5 : 0.9);
    const img = m.hit > 0 ? spr.white : (m.face < 0 ? spr.flip : spr.img);
    const top = m.def.fly ? m.y - h / 2 - 6 : m.y - h + 4 * s;
    if (m.slowUntil > G.clock) ctx.globalAlpha = 0.75;
    ctx.drawImage(img, Math.round(m.x - w / 2), Math.round(top + bob), w, h);
    ctx.globalAlpha = 1;
    if (m.burnUntil > G.clock) { ctx.fillStyle = '#ef7d57'; ctx.fillRect(m.x - 1 + Math.sin(G.time * 30) * 2, top + bob + h * 0.3, 2, 2); }
    if (m.hp < m.maxHp) hpBar(ctx, m.x - 5 * s, top + (m.def.fly ? 4 : 2) - 3, 10 * s, m.hp / m.maxHp, '#b13e53');
  }

  drawProjectilesAndEffects(ctx);
  drawDarkness(ctx, ox, oy);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawVignette(ctx);
  if (hooks.drawScreen) hooks.drawScreen(ctx);
  for (const f of G.floats) {
    const p = worldToScreen(f.x, f.y - f.t * 18);
    ctx.globalAlpha = Math.min(1, (1 - f.t / f.life) * 2);
    drawText(ctx, f.text, p.x, p.y, 13, f.color, 'center');
  }
  ctx.globalAlpha = 1;
  drawUI(ctx);
}

function drawProjectilesAndEffects(ctx) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#f4f4f4';
  ctx.beginPath();
  for (const p of G.projectiles) {
    if (p.kind !== 'arrow') continue;
    ctx.moveTo(p.x - p.vx * 5, p.y - p.vy * 5);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#ffcd75';
  ctx.beginPath();
  for (const p of G.projectiles) {
    if (p.kind !== 'bullet' || p.ab) continue; // 带异能的子弹单独画（彩色拖尾）
    ctx.moveTo(p.x - p.vx * 4, p.y - p.vy * 4);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  for (const p of G.projectiles) {
    if (p.ab && typeof drawAbTrail === 'function' && drawAbTrail(ctx, p)) continue; // 异能子弹
    if (p.kind === 'blade') { // 御剑：银色飞刃
      ctx.strokeStyle = '#dff6ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x - p.vx * 6, p.y - p.vy * 6); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.lineWidth = 1;
    } else if (p.kind === 'rock') {
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.fillStyle = '#94b0c2'; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    } else if (p.kind === 'ice') {
      ctx.fillStyle = '#73eff7'; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    } else if (p.kind === 'fire') {
      ctx.fillStyle = Math.random() < 0.5 ? '#ef7d57' : '#ffcd75'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
  }

  for (const e of G.effects) {
    const k = e.t / e.life;
    ctx.globalAlpha = 1 - k;
    if (e.type === 'custom') { // 自带画法的特效（异能挥砍、粒子）
      e.draw(ctx, e, k);
    } else if (e.type === 'p') {
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - 1, e.y - 1, 2, 2);
    } else if (e.type === 'puff') {
      // 一圈向外散开的小烟团
      const r = e.size * (0.35 + k * 0.65), q = (1 - k) * 2.2 + 0.6;
      ctx.fillStyle = e.color;
      for (let j = 0; j < 8; j++) {
        const a = j * 0.785 + e.size;
        ctx.fillRect(e.x + Math.cos(a) * r - q / 2, e.y + Math.sin(a) * r * 0.8 - q / 2 - k * 3, q, q);
      }
    } else if (e.type === 'ring') { // 精神冲击之类的扩散圆环
      ctx.strokeStyle = e.color || '#f4f4f4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * (0.2 + k * 0.8), 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    } else if (e.type === 'boom') {
      ctx.fillStyle = e.color || '#ef7d57';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * (0.5 + k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'bolt') {
      for (const [col, wdt] of [['#73eff7', 2], ['#f4f4f4', 1]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = wdt;
        ctx.beginPath();
        e.pts.forEach(([x, y], i) => {
          const jx = i && i < e.pts.length ? rand(-2, 2) : 0;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x + jx, y + jx);
        });
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    } else if (e.type === 'tracer') {
      ctx.strokeStyle = e.color || '#ef7d57';
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.tx, e.ty);
      ctx.stroke();
    } else if (e.type === 'swing') {
      ctx.strokeStyle = '#f4f4f4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const a = Math.atan2(e.ty - e.y, e.tx - e.x);
      ctx.arc(e.x, e.y, 9, a - 0.9 + k, a + 0.5 + k);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
  ctx.globalAlpha = 1;
}

function drawRange(ctx, type, cx, cy, b) {
  const def = bdef(type);
  ctx.lineWidth = 1;
  let r = 0, fill, stroke;
  if (def.range) {
    r = b ? towerRange(b) : def.range * G.mods.range * T;
    fill = 'rgba(255,205,117,0.08)'; stroke = 'rgba(255,205,117,0.6)';
  } else if (def.gather) {
    r = (def.radius + 0.5) * T;
    fill = 'rgba(115,239,247,0.07)'; stroke = 'rgba(115,239,247,0.55)';
  } else if (def.heat) {
    r = def.heat.radius * T;
    fill = 'rgba(239,125,87,0.08)'; stroke = 'rgba(239,125,87,0.6)';
  } else if (def.aura) {
    r = def.aura.radius * T;
    fill = 'rgba(244,244,244,0.06)'; stroke = 'rgba(244,244,244,0.5)';
  }
  if (!r) return;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// 夜晚：整体压暗，营地、塔、玩家周围有光
function drawDarkness(ctx, ox, oy) {
  const dark = Math.min(0.85, G.dark * G.settings.dark);
  if (dark < 0.01) return;
  const lc = G.light, l = G.lightCtx, z = G.cam.zoom * G.dpr;
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, lc.width, lc.height);
  // 黄昏偏暖紫，深夜偏冷蓝
  const tw = Math.min(1, dark / 0.55);
  l.fillStyle = 'rgba(' + Math.round(70 - 58 * tw) + ',' + Math.round(28 - 18 * tw) + ',' + Math.round(55 - 15 * tw) + ',' + dark.toFixed(3) + ')';
  l.fillRect(0, 0, lc.width, lc.height);
  l.globalCompositeOperation = 'destination-out';
  const lights = [];
  for (const b of G.buildings) if (b.def.light) lights.push({ x: b.cx, y: b.cy, r: b.def.light * (b.type === 'core' ? 1 + Math.sin(G.time * 7) * 0.03 : 1) });
  if (G.def.hooks.lights) lights.push(...G.def.hooks.lights());
  for (const lt of lights) {
    const sx = lt.x * z + ox, sy = lt.y * z + oy, r = lt.r * T * z;
    if (sx < -r || sy < -r || sx > lc.width + r || sy > lc.height + r) continue;
    const g = l.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.7)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g;
    l.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  l.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lc, 0, 0);

  // 暖色火光：在光源附近叠加一层橙色
  for (const [mode, c0, c1] of [['multiply', '255,165,90', 0.7], ['lighter', '255,120,40', 0.14]]) {
    ctx.globalCompositeOperation = mode;
    for (const lt of lights) {
      const sx = lt.x * z + ox, sy = lt.y * z + oy, r = lt.r * T * z * 0.8;
      if (sx < -r || sy < -r || sx > lc.width + r || sy > lc.height + r) continue;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, 'rgba(' + c0 + ',' + (c1 * dark).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + c0 + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  // 萤火虫（草地模式的夜晚）
  if (dark > 0.25 && (G.mode === 'classic' || G.mode === 'island')) {
    const cell = 6 * T;
    const cx0 = Math.floor(-ox / z / cell), cy0 = Math.floor(-oy / z / cell);
    const cx1 = Math.ceil((lc.width - ox) / z / cell), cy1 = Math.ceil((lc.height - oy) / z / cell);
    const a = Math.min(1, (dark - 0.25) * 3);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const h = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
        if (h % 3 !== 0) continue;
        const ph = (h % 1000) / 159;
        const wx = (cx + 0.5) * cell + Math.sin(G.time * 0.4 + ph) * cell * 0.4;
        const wy = (cy + 0.5) * cell + Math.cos(G.time * 0.33 + ph * 1.3) * cell * 0.35;
        const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
        if (!inMap(tx, ty) || G.terrain[idx(tx, ty)] === TER.WATER) continue;
        const blink = 0.5 + 0.5 * Math.sin(G.time * 2.3 + ph * 4);
        const sx = wx * z + ox, sy = wy * z + oy, rr = 3 * z;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
        g.addColorStop(0, 'rgba(210,255,140,' + (0.9 * a * blink).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(160,240,100,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

// 会随风摆动的资源（数字 = 摆动幅度）
const SWAY = { tree: 1, pine: 0.8, palm: 1.4, deadtree: 0.5, berry: 0.4, zpine: 0.8, ctree: 0.8 };

// 水面波光：每个水格偶尔闪一下
function drawWaterShimmer(ctx, x0, y0, x1, y1) {
  const gt = G.groundTer, W = MAP_W * T;
  ctx.fillStyle = '#dff6ff';
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (G.terrain[idx(x, y)] !== TER.WATER) continue;
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const ph = (G.time * 0.45 + (h % 997) / 997) % 1;
      if (ph > 0.3) continue;
      const px = x * T + 2 + (h % 11), py = y * T + 2 + ((h >> 5) % 11);
      if (gt && gt[(py | 0) * W + (px | 0)] !== TER.WATER) continue;
      ctx.globalAlpha = Math.sin(ph / 0.3 * Math.PI) * 0.85;
      const len = 1.5 + (h % 3);
      ctx.fillRect(px - len / 2, py, len, 0.5);
      ctx.fillRect(px - len / 4 + 1, py + 1.5, len / 2, 0.5);
    }
  }
  ctx.globalAlpha = 1;
}

// 篝火的火星和烟
function drawEmbers(ctx, x, y) {
  for (let i = 0; i < 4; i++) {
    const ph = (G.time * 0.22 + i / 4) % 1;
    ctx.globalAlpha = (1 - ph) * 0.22;
    ctx.fillStyle = '#c8ccd8';
    const r = 1.5 + ph * 4;
    ctx.beginPath();
    ctx.arc(x + Math.sin(ph * 4 + i) * 2 + ph * 5, y - 7 - ph * 26, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 8; i++) {
    const ph = (G.time * 0.6 + i / 8) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.fillStyle = ph < 0.4 ? '#ffcd75' : '#ef7d57';
    ctx.fillRect(x + Math.sin(ph * 7 + i * 2.3) * (1.5 + ph * 4), y - ph * 24, 0.8, 0.8);
  }
  ctx.globalAlpha = 1;
}

// 屏幕四角微微压暗，画面更聚焦
let VIGNETTE = null;
function drawVignette(ctx) {
  if (!VIGNETTE || VIGNETTE.w !== G.sw || VIGNETTE.h !== G.sh) {
    const r = Math.hypot(G.sw, G.sh) / 2;
    const g = ctx.createRadialGradient(G.sw / 2, G.sh / 2, r * 0.55, G.sw / 2, G.sh / 2, r);
    g.addColorStop(0, 'rgba(10,8,25,0)');
    g.addColorStop(1, 'rgba(10,8,25,0.38)');
    VIGNETTE = { w: G.sw, h: G.sh, g };
  }
  ctx.fillStyle = VIGNETTE.g;
  ctx.fillRect(0, 0, G.sw, G.sh);
}
