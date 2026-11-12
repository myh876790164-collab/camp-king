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

  const z = G.cam.zoom, hooks = G.def.hooks;
  const ox = Math.round((G.sw / 2 - G.cam.x * z) * dpr);
  const oy = Math.round((G.sh / 2 - G.cam.y * z) * dpr);
  ctx.setTransform(z * dpr, 0, 0, z * dpr, ox, oy);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(G.ground, 0, 0);

  const tl = screenToWorld(0, 0), br = screenToWorld(G.sw, G.sh);
  const x0 = Math.max(0, Math.floor(tl.x / T) - 1), y0 = Math.max(0, Math.floor(tl.y / T) - 1);
  const x1 = Math.min(MAP_W - 1, Math.floor(br.x / T) + 1), y1 = Math.min(MAP_H - 1, Math.floor(br.y / T) + 1);

  // 资源点
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const n = G.nodes[idx(x, y)];
      if (!n) continue;
      const def = G.def.nodes[n.type];
      let sx = x * T;
      if (G.time < n.shakeUntil) sx += Math.sin(G.time * 80) * 1.2;
      const searched = n.searchedUntil > G.day;
      if (searched) ctx.globalAlpha = 0.5;
      ctx.drawImage(SPR[def.sprite || n.type].img, sx, y * T);
      ctx.globalAlpha = 1;
      if (def.res && n.amount < n.max) hpBar(ctx, x * T + 3, y * T + 15, 10, n.amount / n.max, '#ffcd75');
      if (def.search && !searched && G.phase === 'day') {
        ctx.fillStyle = '#ffcd75';
        ctx.fillRect(x * T + 7, y * T - 1 + Math.sin(G.time * 4 + x) * 1, 2, 2);
      }
    }
  }

  // 建筑
  for (const b of G.buildings) {
    const spr = buildingSprite(b), s = b.size * T;
    ctx.drawImage(b.hit > 0 ? spr.white : spr.img, b.x * T, b.y * T, s, s);
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
    ctx.drawImage(SPR[bdef(G.buildMode).sprite || G.buildMode].img, hx * T, hy * T);
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
    const bob = m.def.fly ? Math.sin(G.time * 10 + m.bob) * 2 : -Math.abs(Math.sin(G.time * 8 + m.bob)) * 1.5 * s;
    if (!m.def.fly) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(m.x - 5 * s, m.y + 2 * s, 10 * s, 2 * s);
    }
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
    if (p.kind !== 'bullet') continue;
    ctx.moveTo(p.x - p.vx * 4, p.y - p.vy * 4);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  for (const p of G.projectiles) {
    if (p.kind === 'rock') {
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
    if (e.type === 'p') {
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - 1, e.y - 1, 2, 2);
    } else if (e.type === 'puff') {
      const r = e.size * (0.4 + k * 0.6);
      ctx.strokeStyle = e.color;
      ctx.strokeRect(e.x - r, e.y - r, r * 2, r * 2);
    } else if (e.type === 'boom') {
      ctx.fillStyle = '#ef7d57';
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
      ctx.strokeStyle = '#ef7d57';
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
  l.fillStyle = 'rgba(12,10,40,' + dark.toFixed(3) + ')';
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
}
