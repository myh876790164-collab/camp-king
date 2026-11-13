// =============================================
//  游戏内界面：全部用 Canvas 画（小游戏平台没有网页 DOM，这样以后好移植）
// =============================================
const UI = { topH: 44, bottomH: 84 };
let uiButtons = [];

// onClick 为 null 的区域只用来“挡住”点击，不让点穿到地图上
// 在可滚动区域里时：按钮跟着内容一起上下移动，超出区域的部分点不到
function addButton(x, y, w, h, onClick) {
  if (uiClip) {
    y -= uiOffY;
    const top = Math.max(y, uiClip.y), bot = Math.min(y + h, uiClip.y + uiClip.h);
    if (bot <= top) return;
    h = bot - top; y = top;
  }
  uiButtons.push({ x, y, w, h, onClick });
}

// ---------- 可滚动区域（文字太多时可以拖动 / 滚轮查看） ----------
let uiClip = null, uiOffY = 0, scrollAreas = [];
function beginScroll(ctx, key, x, y, w, h) {
  G.scroll = G.scroll || {};
  uiOffY = G.scroll[key] || 0;
  uiClip = { key, x, y, w, h };
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 2, y, w + 4, h); ctx.clip();
  ctx.translate(0, -uiOffY);
}
// contentBottom = 内容最下面的 y（滚动前的坐标）
function endScroll(ctx, contentBottom) {
  const c = uiClip;
  ctx.restore();
  uiClip = null; uiOffY = 0;
  const contentH = contentBottom - c.y, max = Math.max(0, contentH - c.h + 12);
  G.scroll[c.key] = Math.max(0, Math.min(max, G.scroll[c.key] || 0));
  scrollAreas.push({ x: c.x, y: c.y, w: c.w, h: c.h, key: c.key, max });
  if (max > 0) {
    // 右边的滚动条
    const th = Math.max(30, c.h * c.h / (contentH + 12)), ty = c.y + (c.h - th) * (G.scroll[c.key] / max);
    ctx.fillStyle = 'rgba(148,176,194,0.18)'; ctx.fillRect(c.x + c.w + 2, c.y, 4, c.h);
    ctx.fillStyle = 'rgba(255,205,117,0.75)'; ctx.fillRect(c.x + c.w + 2, ty, 4, th);
    if (G.scroll[c.key] < max - 4) drawText(ctx, '▼ 拖动查看更多', c.x + c.w / 2, c.y + c.h - 8, 11, '#94b0c2', 'center', false);
  }
}
function scrollAreaAt(sx, sy) {
  for (let i = scrollAreas.length - 1; i >= 0; i--) {
    const a = scrollAreas[i];
    if (a.max > 0 && sx >= a.x && sy >= a.y && sx < a.x + a.w + 8 && sy < a.y + a.h) return a;
  }
  return null;
}
function scrollBy(a, dy) { G.scroll[a.key] = Math.max(0, Math.min(a.max, (G.scroll[a.key] || 0) + dy)); }
function hitUI(sx, sy) {
  for (let i = uiButtons.length - 1; i >= 0; i--) {
    const b = uiButtons[i];
    if (sx >= b.x && sy >= b.y && sx < b.x + b.w && sy < b.y + b.h) return b;
  }
  return null;
}

function drawText(ctx, str, x, y, size, color, align, bold) {
  ctx.font = (bold === false ? '' : 'bold ') + size + 'px ' + FONT;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1a1c2c';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function wrapText(ctx, str, maxW, size) {
  ctx.font = size + 'px ' + FONT;
  const lines = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; }
      else line += ch;
    }
    lines.push(line);
  }
  return lines;
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(26,28,44,0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#566c86';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  addButton(x, y, w, h, null);
}

function drawButton(ctx, x, y, w, h, label, onClick, opt) {
  opt = opt || {};
  ctx.fillStyle = opt.dim ? '#262b44' : (opt.color || '#333c57');
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = opt.active ? '#ffcd75' : '#566c86';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  if (label) drawText(ctx, label, x + w / 2, y + h / 2, opt.size || 14, opt.dim ? '#94b0c2' : '#f4f4f4', 'center');
  addButton(x, y, w, h, onClick ? () => { sfx('click'); onClick(); } : null);
}

function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

// 花费：图标+数字，放不下自动换行
function costRows(ctx, cost, maxW, size) {
  ctx.font = 'bold ' + size + 'px ' + FONT;
  const rows = [[]];
  let rw = 0;
  for (const k in cost) {
    const txt = fmt(cost[k]);
    const it = { k, txt, w: size + 2 + ctx.measureText(txt).width + 5, ok: (G.res[k] || 0) >= cost[k] };
    if (rw + it.w > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0; }
    rows[rows.length - 1].push(it);
    rw += it.w;
  }
  return rows;
}
function drawCostHeight(ctx, cost, maxW, size) { return costRows(ctx, cost, maxW, size).length * (size + 3); }
function drawCost(ctx, cost, cx, y, maxW, size) {
  const rows = costRows(ctx, cost, maxW, size), lh = size + 3;
  rows.forEach((row, r) => {
    const total = row.reduce((s, it) => s + it.w, 0) - 5;
    let x = cx - total / 2;
    const ry = y + r * lh;
    for (const it of row) {
      ctx.drawImage(SPR['icon_' + it.k].img, Math.round(x), Math.round(ry - size / 2), size, size);
      drawText(ctx, it.txt, x + size + 2, ry, size, it.ok ? '#f4f4f4' : '#ef7d57');
      x += it.w;
    }
  });
  return rows.length * lh;
}

// 一排小药丸形状的状态（自动换行，居中）
function drawPills(ctx, items, y, maxW) {
  ctx.font = 'bold 12px ' + FONT;
  const ws = items.map((it) => ctx.measureText(it.text).width + (it.icon ? 30 : 16));
  const rows = [[]];
  let rw = 0;
  items.forEach((it, i) => {
    if (rw + ws[i] > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0; }
    rows[rows.length - 1].push(i);
    rw += ws[i] + 6;
  });
  rows.forEach((row, r) => {
    const total = row.reduce((s, i) => s + ws[i] + 6, -6);
    let x = G.sw / 2 - total / 2;
    const ry = y + r * 24;
    for (const i of row) {
      const it = items[i];
      ctx.fillStyle = 'rgba(26,28,44,0.75)';
      ctx.fillRect(x, ry, ws[i], 20);
      let tx = x + 8;
      if (it.icon) { ctx.drawImage(SPR['icon_' + it.icon].img, x + 6, ry + 3, 14, 14); tx = x + 24; }
      drawText(ctx, it.text, tx, ry + 10, 12, it.color || '#f4f4f4');
      x += ws[i] + 6;
    }
  });
  return rows.length * 24;
}

function unlockedBuildList() {
  const custom = G.def.hooks.buildList && G.def.hooks.buildList(); // 丧尸模式：在建筑里面时建造栏不一样
  return custom || G.def.buildList.filter((t) => G.unlocked.has(t));
}

function drawUI(ctx) {
  uiButtons = [];
  scrollAreas = [];
  const sw = G.sw, sh = G.sh;
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  const playing = G.state === 'play';

  // ---- 顶部资源栏 ----
  drawPanel(ctx, 0, 0, sw, UI.topH);
  const step = sw < 420 ? (G.def.resources.length > 3 ? 60 : 66) : 90;
  let x = 10;
  for (const k of G.def.resources) {
    ctx.drawImage(SPR['icon_' + k].img, x, 12, 20, 20);
    drawText(ctx, fmt(G.res[k]), x + 24, 23, 16, '#f4f4f4');
    x += step;
  }
  drawButton(ctx, sw - 48, 6, 40, 32, '‖', () => { G.state = 'paused'; }, { size: 16 });
  drawButton(ctx, sw - 96, 6, 44, 32, '×' + G.speed, () => { G.speed = G.speed >= (G.def.maxSpeed || 3) ? 1 : G.speed + 1; });

  // ---- 昼夜 + 模式状态 ----
  let label;
  if (G.phase === 'day') label = '第 ' + G.day + ' 天  ☀ 白天 ' + Math.ceil(G.timer) + ' 秒';
  else if (G.def.hasNights) label = '第 ' + G.day + ' 夜  ☾ 剩余敌人 ' + (nightEnemies() + G.spawnLeft + G.bossLeft);
  else label = '第 ' + G.day + ' 夜  ☾ 休息中 ' + Math.ceil(G.timer) + ' 秒';
  if (G.def.hooks.dayLabel) label = G.def.hooks.dayLabel(); // 修仙门派：宗门历法
  ctx.font = 'bold 14px ' + FONT;
  const showNightBtn = G.phase === 'day' && G.def.hasNights && playing;
  const lw = ctx.measureText(label).width + 24, bw = showNightBtn ? 62 : 0;
  const lx = sw / 2 - (lw + bw) / 2, ly = UI.topH + 6;
  ctx.fillStyle = G.phase === 'day' ? 'rgba(26,28,44,0.75)' : 'rgba(93,39,93,0.85)';
  ctx.fillRect(lx, ly, lw, 26);
  drawText(ctx, label, lx + lw / 2, ly + 13, 14, G.phase === 'day' ? '#ffcd75' : '#f4f4f4', 'center');
  if (showNightBtn) drawButton(ctx, lx + lw + 4, ly, 58, 26, '入夜▶', startNightEarly, { color: '#5d275d', size: 12 });
  // 小地图在右上角，状态条往中间收一点，避免挡住
  const mini = !G.inside && G.state === 'play' ? miniLayout() : null;
  if (G.def.hooks.hud) drawPills(ctx, G.def.hooks.hud(), ly + 32, mini ? Math.max(160, sw - 2 * (mini.w + 20)) : sw - 16);
  drawMinimap(ctx);
  if (G.def.hooks.hudExtra) G.def.hooks.hudExtra(ctx); // 丧尸模式：左上角的异能增益条

  // ---- 底部栏：科技/装备 + 建造（可翻页） ----
  const by = sh - UI.bottomH;
  drawPanel(ctx, 0, by, sw, UI.bottomH);
  const fixed = [{ label: G.def.techLabel || '科技', onClick: () => { G.state = 'tech'; G.buildMode = null; }, badge: availableTechCount() > 0 }];
  if (G.mode === 'zombie') fixed.push({ label: '幸存者', onClick: () => { G.state = 'equip'; G.buildMode = null; }, badge: false });
  if (G.def.hooks.extraButtons) fixed.push(...G.def.hooks.extraButtons());
  const fw = 50, gap = 6;
  fixed.forEach((f, i) => {
    const fx = 6 + i * (fw + gap);
    drawButton(ctx, fx, by + 6, fw, UI.bottomH - 12, f.label, f.onClick, { color: '#29366f', size: 13 });
    if (f.badge) { ctx.fillStyle = '#b13e53'; ctx.fillRect(fx + fw - 12, by + 10, 8, 8); }
  });
  const list = unlockedBuildList();
  const areaX = 6 + fixed.length * (fw + gap), areaW = sw - areaX - 6;
  let perPage = list.length, arrows = false;
  if (list.length * (64 + gap) - gap > areaW) {
    arrows = true;
    perPage = Math.max(1, Math.floor((areaW - 2 * (26 + gap) + gap) / (64 + gap)));
  }
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  G.buildPage = Math.max(0, Math.min(pages - 1, G.buildPage || 0));
  const innerX = areaX + (arrows ? 26 + gap : 0), innerW = areaW - (arrows ? 2 * (26 + gap) : 0);
  const shown = list.slice(G.buildPage * perPage, (G.buildPage + 1) * perPage);
  const bwid = Math.min(104, (innerW - gap * (perPage - 1)) / perPage);
  const bx0 = innerX + (innerW - (shown.length * bwid + (shown.length - 1) * gap)) / 2;
  if (arrows) {
    drawButton(ctx, areaX, by + 6, 26, UI.bottomH - 12, '◀', () => { G.buildPage = (G.buildPage + pages - 1) % pages; }, { size: 12, dim: pages < 2 });
    drawButton(ctx, sw - 6 - 26, by + 6, 26, UI.bottomH - 12, '▶', () => { G.buildPage = (G.buildPage + 1) % pages; }, { size: 12, dim: pages < 2 });
  }
  shown.forEach((type, i) => {
    const def = bdef(type);
    const bx = bx0 + i * (bwid + gap), bty = by + 6, bh = UI.bottomH - 12;
    const active = G.buildMode === type;
    drawButton(ctx, bx, bty, bwid, bh, '', () => {
      G.buildMode = G.buildMode === type ? null : type;
      G.selected = null;
    }, { active, color: active ? '#29366f' : '#333c57' });
    ctx.drawImage(SPR[def.sprite || type].img, Math.round(bx + bwid / 2 - 14), bty + 3, 28, 28);
    drawText(ctx, def.name, bx + bwid / 2, bty + 38, 12, canAfford(def.cost) ? '#f4f4f4' : '#94b0c2', 'center');
    drawCost(ctx, def.cost, bx + bwid / 2, bty + 52, bwid - 6, 10);
    const hot = list.indexOf(type) + 1;
    if (sw > 700 && hot <= 9) drawText(ctx, String(hot), bx + 8, bty + 9, 10, '#94b0c2', 'center');
  });

  // ---- 建造提示条 ----
  if (G.buildMode && playing) {
    const def = bdef(G.buildMode);
    const pw = Math.min(480, sw - 16), ph = 40, px = (sw - pw) / 2, py = by - ph - 8;
    drawPanel(ctx, px, py, pw, ph);
    const txt = wrapText(ctx, def.name + '：' + def.desc, pw - 90, 13);
    txt.slice(0, 2).forEach((ln, k, arr) => drawText(ctx, ln, px + 12, py + ph / 2 + (k - (arr.length - 1) / 2) * 15, 13, '#ffcd75'));
    drawButton(ctx, px + pw - 66, py + 6, 58, ph - 12, '取消', () => { G.buildMode = null; }, { size: 13 });
  }

  if (G.selected && playing) drawSelectedPanel(ctx, by);

  // ---- 横幅 ----
  if (G.banner) {
    const b = G.banner;
    ctx.globalAlpha = Math.max(0, Math.min(1, b.life, (b.max - b.life) * 4));
    const bannerY = sh * 0.3;
    drawText(ctx, b.text, sw / 2, bannerY, sw < 500 ? 18 : 24, b.color || '#f4f4f4', 'center');
    if (b.sub) {
      wrapText(ctx, b.sub, Math.min(560, sw - 32), 14).forEach((ln, k) => {
        drawText(ctx, ln, sw / 2, bannerY + 28 + k * 20, 14, '#c8d6e5', 'center');
      });
    }
    ctx.globalAlpha = 1;
  }

  if (G.state === 'tech') drawTechPanel(ctx);
  if (G.state === 'equip') drawEquipPanel(ctx);
  if (G.state === 'members') drawMembersPanel(ctx);
  if (G.state === 'perk') drawPerkOverlay(ctx);
  if (G.state === 'dialog') drawDialog(ctx);
  if (G.state === 'over') drawEndOverlay(ctx, false);
  if (G.def.hooks.drawOverlay) G.def.hooks.drawOverlay(ctx); // 修仙门派：弟子 / 典籍 / 天下 / 纪事面板
  if (G.state === 'victory') drawEndOverlay(ctx, true);
  drawBigMap(ctx);
  if (G.state === 'paused') drawPauseMenu(ctx);
  else drawConfirm(ctx); // 确认框（例如吃第 5 颗晶核、拆床）要画在最上面
}

function drawSelectedPanel(ctx, by) {
  const b = G.selected, def = b.def, sw = G.sw, hooks = G.def.hooks;
  let info;
  if (def.attack) {
    info = '伤害 ' + towerDmg(b).toFixed(0) + '  射程 ' + (towerRange(b) / T).toFixed(1) + '  攻速 ' + towerRate(b).toFixed(2) + '/秒' +
      (def.splash ? '  范围' : '') + (def.slow ? '  减速' : '') + (def.chain ? '  弹射' : '') + (def.burn ? '  燃烧' : '');
  } else if (def.gather) {
    const node = G.def.nodes[def.gather];
    info = b.idle ? '附近没有' + node.name + '了，可以拆掉换个地方' :
      '每 ' + gatherInterval(b).toFixed(1) + ' 秒采集 ' + def.amount + ' ' + RES_INFO[node.res].name;
  } else if (def.produce) {
    info = '每 ' + produceInterval(b).toFixed(1) + ' 秒产出 ' + def.produce.amount + ' ' + RES_INFO[def.produce.res].name;
  } else if (def.trap) {
    info = '每秒伤害 ' + (def.trap * levelMult(b.level) * G.mods.trapDmg).toFixed(0);
  } else {
    info = def.desc;
  }
  const extra = hooks.buildingInfo ? hooks.buildingInfo(b) : null;
  const extraBtns = hooks.panelButtons ? hooks.panelButtons(b) : [];
  const pw = Math.min(460, sw - 16), px = (sw - pw) / 2;
  const extraLines = extra ? wrapText(ctx, extra, pw - 24, 12) : [];
  const ph = 96 + extraLines.length * 16, py = by - ph - 8;
  drawPanel(ctx, px, py, pw, ph);
  drawText(ctx, def.name + '  Lv.' + b.level, px + 12, py + 16, 15, '#ffcd75');
  drawText(ctx, '生命 ' + Math.ceil(b.hp) + '/' + b.maxHp, px + pw - 40, py + 16, 13, '#f4f4f4', 'right');
  drawButton(ctx, px + pw - 32, py + 4, 26, 24, '✕', () => { G.selected = null; }, { size: 12 });
  drawText(ctx, info, px + 12, py + 38, 12, '#c8d6e5', 'left', false);
  extraLines.forEach((ln, k) => drawText(ctx, ln, px + 12, py + 56 + k * 16, 12, '#a7f070', 'left', false));

  const btnY = py + ph - 40, btnH = 32;
  let bx = px + 10;
  if (b.level < CONFIG.MAX_LEVEL) {
    const cost = upgradeCost(b), ok = canAfford(cost);
    const uw = Math.min(210, pw - 110 - extraBtns.length * 76);
    drawButton(ctx, bx, btnY, uw, btnH, '', () => upgradeBuilding(b), { dim: !ok, color: '#29366f' });
    drawText(ctx, '升级', bx + 24, btnY + btnH / 2, 14, ok ? '#f4f4f4' : '#94b0c2', 'center');
    drawCost(ctx, cost, bx + 52 + (uw - 52) / 2, btnY + btnH / 2, uw - 56, 11);
    bx += uw + 6;
  } else {
    drawText(ctx, '已满级', bx + 10, btnY + btnH / 2, 14, '#ffcd75');
    bx += 70;
  }
  for (const eb of extraBtns) {
    drawButton(ctx, bx, btnY, 70, btnH, eb.label, eb.onClick, { dim: eb.dim, size: 12, color: '#b13e53' });
    bx += 76;
  }
  if (b.type !== 'core') {
    drawButton(ctx, px + pw - 80, btnY, 70, btnH, '拆除', () => demolishBuilding(b), { color: '#5d275d', size: 13 });
  }
}

function drawPerkOverlay(ctx) {
  const sw = G.sw, sh = G.sh, list = G.perkChoices;
  ctx.fillStyle = 'rgba(10,10,30,0.78)';
  ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, null);
  const vertical = sw < 680;
  const cw = vertical ? Math.min(340, sw - 32) : 200, ch = vertical ? 86 : 150, gap = 14;
  const totalW = vertical ? cw : list.length * cw + (list.length - 1) * gap;
  const totalH = vertical ? list.length * ch + (list.length - 1) * gap : ch;
  const x0 = (sw - totalW) / 2, y0 = Math.max(120, (sh - totalH) / 2 + 20);
  drawText(ctx, '天亮了！挺过了第 ' + (G.day - 1) + ' 夜', sw / 2, y0 - 70, 22, '#ffcd75', 'center');
  if (G.dawnMsg) drawText(ctx, G.dawnMsg, sw / 2, y0 - 46, 12, '#c8d6e5', 'center', false);
  drawText(ctx, '选择一项强化', sw / 2, y0 - 22, 16, '#f4f4f4', 'center');
  list.forEach((p, i) => {
    const x = vertical ? x0 : x0 + i * (cw + gap);
    const y = vertical ? y0 + i * (ch + gap) : y0;
    const synergy = !!p.needs;
    drawButton(ctx, x, y, cw, ch, '', () => pickPerk(p), { color: synergy ? '#5d275d' : '#29366f', active: synergy });
    drawText(ctx, p.name, x + cw / 2, y + 22, 18, '#ffcd75', 'center');
    wrapText(ctx, p.desc, cw - 24, 13).forEach((ln, k) => drawText(ctx, ln, x + cw / 2, y + 50 + k * 18, 13, '#f4f4f4', 'center', false));
  });
}

function drawDialog(ctx) {
  const d = G.dialog, sw = G.sw, sh = G.sh;
  ctx.fillStyle = 'rgba(10,10,30,0.6)';
  ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, null);
  const pw = Math.min(420, sw - 24);
  const lines = wrapText(ctx, d.text, pw - 32, 14);
  const ph = 70 + lines.length * 20 + d.options.length * 44;
  const px = (sw - pw) / 2, py = (sh - ph) / 2;
  drawPanel(ctx, px, py, pw, ph);
  drawText(ctx, d.title, px + 16, py + 24, 16, '#ffcd75');
  lines.forEach((ln, k) => drawText(ctx, ln, px + 16, py + 52 + k * 20, 14, '#f4f4f4', 'left', false));
  let y = py + 62 + lines.length * 20;
  for (const o of d.options) {
    drawButton(ctx, px + 16, y, pw - 32, 36, o.label, o.disabled ? null : () => {
      G.dialog = null;
      G.state = 'play';
      o.action();
    }, { dim: o.disabled, size: 13 });
    y += 44;
  }
}

function drawEndOverlay(ctx, win) {
  const sw = G.sw, sh = G.sh;
  ctx.fillStyle = win ? 'rgba(10,30,20,0.8)' : 'rgba(30,8,16,0.82)';
  ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, null);
  const cy = sh / 2 - 60;
  drawText(ctx, G.endTitle, sw / 2, cy - 30, 28, win ? '#a7f070' : '#ef7d57', 'center');
  wrapText(ctx, G.endText, Math.min(500, sw - 40), 15).forEach((ln, k) => drawText(ctx, ln, sw / 2, cy + 10 + k * 22, 15, '#f4f4f4', 'center'));
  const by = cy + 70;
  if (win) {
    drawButton(ctx, sw / 2 - 170, by, 160, 44, '继续建设', () => { G.state = 'play'; }, { color: '#1f5e3a', size: 15 });
    drawButton(ctx, sw / 2 + 10, by, 160, 44, '返回主菜单', gotoTitle, { size: 15 });
  } else {
    drawButton(ctx, sw / 2 - 170, by, 160, 44, '重新开始', () => startGame(G.mode), { color: '#b13e53', size: 15 });
    drawButton(ctx, sw / 2 + 10, by, 160, 44, '返回主菜单', gotoTitle, { size: 15 });
    if (hasSave(G.mode)) drawButton(ctx, sw / 2 - 80, by + 54, 160, 40, '读取存档', () => loadGame(G.mode), { size: 14 });
  }
}
