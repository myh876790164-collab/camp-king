// =============================================
//  菜单场景：开始界面、模式选择、读取存档、设置、暂停菜单、确认框
// =============================================
function gotoScene(s) { G.scene = s; uiButtons = []; }
function gotoTitle() { G.state = 'play'; G.buildMode = null; G.selected = null; gotoScene('title'); }

function askConfirm(text, onYes) { G.confirm = { text, onYes }; }

function drawScene(ctx) {
  uiButtons = [];
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  drawTitleBackground(ctx);
  if (G.scene === 'title') drawTitle(ctx);
  else if (G.scene === 'modes') drawModeSelect(ctx);
  else if (G.scene === 'load') drawLoadScreen(ctx);
  else if (G.scene === 'settings') drawSettings(ctx);
  drawConfirm(ctx);
}

// 背景：夜空 + 篝火营地
function drawTitleBackground(ctx) {
  const sw = G.sw, sh = G.sh;
  const grd = ctx.createLinearGradient(0, 0, 0, sh);
  grd.addColorStop(0, '#0d0f1e');
  grd.addColorStop(0.6, '#29366f');
  grd.addColorStop(1, '#1a1c2c');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, sw, sh);
  if (!G.stars) G.stars = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random() * 0.6, s: Math.random() }));
  for (const s of G.stars) {
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(G.time * (0.5 + s.s) + s.x * 10));
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(s.x * sw, s.y * sh, s.s > 0.8 ? 2 : 1, s.s > 0.8 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
  const groundY = sh * 0.82;
  ctx.fillStyle = '#1f3a2a';
  ctx.fillRect(0, groundY, sw, sh - groundY);
  ctx.imageSmoothingEnabled = false;
  if (G.scene !== 'title') return;
  const sc = Math.max(2, Math.min(6, Math.floor(Math.min(sw / 160, sh / 150))));
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    const tx = sw / 2 + i * 26 * sc - 8 * sc;
    const tsc = sc * (Math.abs(i) > 2 ? 0.8 : 1);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(SPR.tree.img, tx, groundY - 15 * tsc, 16 * tsc, 16 * tsc);
  }
  ctx.globalAlpha = 1;
  const cs = sc * 1.4;
  const cx = sw / 2 - 16 * cs, cy = groundY - 26 * cs;
  const glow = ctx.createRadialGradient(sw / 2, cy + 22 * cs, 0, sw / 2, cy + 22 * cs, 60 * cs);
  glow.addColorStop(0, 'rgba(239,125,87,0.35)');
  glow.addColorStop(1, 'rgba(239,125,87,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sw / 2 - 60 * cs, cy - 40 * cs, 120 * cs, 110 * cs);
  ctx.drawImage(SPR.core_classic.img, cx, cy, 32 * cs, 32 * cs);
  const fx = cx + 23 * cs, fy = cy + 25 * cs;
  const h = (5 + Math.sin(G.time * 18) + Math.random() * 1.5) * cs;
  ctx.fillStyle = '#b13e53'; ctx.fillRect(fx - 2 * cs, fy - h, 5 * cs, h);
  ctx.fillStyle = '#ef7d57'; ctx.fillRect(fx - cs, fy - h + cs, 3 * cs, h - cs);
  ctx.fillStyle = '#ffcd75'; ctx.fillRect(fx, fy - h * 0.6, cs, h * 0.6);
}

function drawLogo(ctx, y) {
  const sw = G.sw, size = Math.min(64, sw / 7);
  ctx.font = 'bold ' + size + 'px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a1c2c';
  ctx.fillText('CAMP KING', sw / 2 + 4, y + 4);
  ctx.fillStyle = '#ef7d57';
  ctx.fillText('CAMP KING', sw / 2, y);
  ctx.fillStyle = '#ffcd75';
  ctx.fillText('CAMP KING', sw / 2, y - 2);
  drawText(ctx, '营 地 之 王', sw / 2, y + size * 0.75, 16, '#f4f4f4', 'center');
}

function drawTitle(ctx) {
  const sw = G.sw, sh = G.sh;
  drawLogo(ctx, sh * 0.16);
  const bw = Math.min(260, sw - 40), bh = 48, x = (sw - bw) / 2;
  let y = sh * 0.34;
  drawButton(ctx, x, y, bw, bh, '开始游戏', () => gotoScene('modes'), { color: '#b13e53', size: 18 });
  y += bh + 14;
  const anySave = MODE_ORDER.some(hasSave);
  drawButton(ctx, x, y, bw, bh, '读取存档', () => gotoScene('load'), { size: 18, dim: !anySave });
  y += bh + 14;
  drawButton(ctx, x, y, bw, bh, '设置', () => { G.settingsFrom = 'title'; gotoScene('settings'); }, { size: 18 });
  drawText(ctx, 'v0.2 原型', sw - 10, sh - 12, 11, '#566c86', 'right', false);
}

function drawModeSelect(ctx) {
  const sw = G.sw, sh = G.sh;
  drawText(ctx, '选择游戏模式', sw / 2, 34, 22, '#ffcd75', 'center');
  drawButton(ctx, 10, 12, 70, 34, '返回', () => gotoScene('title'), { size: 13 });
  const cols = sw >= 760 ? 2 : 1;
  const gap = 12, cw = Math.min(cols === 2 ? 340 : 420, (sw - 24 - (cols - 1) * gap) / cols);
  const ch = cols === 2 ? 150 : Math.min(140, (sh - 80 - 3 * gap) / 4);
  const totalW = cols * cw + (cols - 1) * gap, x0 = (sw - totalW) / 2;
  const totalH = Math.ceil(4 / cols) * (ch + gap) - gap;
  const y0 = Math.max(64, (sh - totalH) / 2 + 20);
  MODE_ORDER.forEach((id, i) => {
    const m = MODES[id];
    const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap);
    drawButton(ctx, x, y, cw, ch, '', () => {
      if (hasSave(id)) askConfirm('「' + m.name + '」已有存档，开始新游戏会覆盖它（存档会在下次天亮时被替换）。继续吗？', () => startGame(id));
      else startGame(id);
    }, { color: 'rgba(26,28,44,0.92)' });
    const isz = Math.min(48, ch - 40);
    ctx.drawImage(SPR[m.icon].img, x + 12, y + 14, isz, isz);
    const tx = x + isz + 24;
    drawText(ctx, (i + 1) + '. ' + m.name, tx, y + 22, 17, '#ffcd75');
    drawText(ctx, m.tag, tx, y + 44, 12, '#73eff7', 'left', false);
    const maxLines = Math.max(1, Math.floor((ch - 64) / 16));
    wrapText(ctx, m.desc, cw - (tx - x) - 12, 12).slice(0, maxLines).forEach((ln, k) => {
      drawText(ctx, ln, tx, y + 66 + k * 16, 12, '#c8d6e5', 'left', false);
    });
  });
}

function drawLoadScreen(ctx) {
  const sw = G.sw, sh = G.sh;
  drawText(ctx, '读取存档', sw / 2, 34, 22, '#ffcd75', 'center');
  drawButton(ctx, 10, 12, 70, 34, '返回', () => gotoScene('title'), { size: 13 });
  const pw = Math.min(460, sw - 24), px = (sw - pw) / 2, rh = 64, gap = 10;
  let y = Math.max(70, sh / 2 - (4 * (rh + gap)) / 2);
  drawText(ctx, '每天天亮时会自动存档，也可以在暂停菜单里手动保存', sw / 2, y - 16, 12, '#94b0c2', 'center', false);
  for (const id of MODE_ORDER) {
    const info = saveInfo(id);
    ctx.fillStyle = 'rgba(26,28,44,0.92)';
    ctx.fillRect(px, y, pw, rh);
    ctx.strokeStyle = '#566c86';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, y + 1, pw - 2, rh - 2);
    ctx.drawImage(SPR[MODES[id].icon].img, px + 10, y + 12, 40, 40);
    drawText(ctx, MODES[id].name, px + 60, y + 20, 15, '#ffcd75');
    if (info) {
      drawText(ctx, '第 ' + info.day + ' 天 · ' + info.when, px + 60, y + 44, 12, '#c8d6e5', 'left', false);
      drawButton(ctx, px + pw - 140, y + 14, 70, 36, '读取', () => loadGame(id), { color: '#1f5e3a', size: 13 });
      drawButton(ctx, px + pw - 64, y + 14, 54, 36, '删除', () => askConfirm('确定删除「' + MODES[id].name + '」的存档吗？删除后无法恢复。', () => deleteSave(id)), { color: '#5d275d', size: 12 });
    } else {
      drawText(ctx, '（空）', px + 60, y + 44, 12, '#566c86', 'left', false);
    }
    y += rh + gap;
  }
}

function drawSettings(ctx) {
  const sw = G.sw, sh = G.sh, s = G.settings;
  const back = () => { saveSettings(); if (G.settingsFrom === 'pause') { gotoScene('game'); G.state = 'paused'; } else gotoScene('title'); };
  drawText(ctx, '设置', sw / 2, 34, 22, '#ffcd75', 'center');
  drawButton(ctx, 10, 12, 70, 34, '返回', back, { size: 13 });
  const pw = Math.min(420, sw - 24), px = (sw - pw) / 2, rh = 52;
  let y = Math.max(80, sh * 0.2);
  const row = (label, value, onClick) => {
    ctx.fillStyle = 'rgba(26,28,44,0.92)';
    ctx.fillRect(px, y, pw, rh);
    drawText(ctx, label, px + 16, y + rh / 2, 15, '#f4f4f4');
    drawButton(ctx, px + pw - 120, y + 8, 108, rh - 16, value, onClick, { color: '#29366f', size: 14 });
    y += rh + 10;
  };
  row('音效', s.sfx ? '开' : '关', () => { s.sfx = !s.sfx; unlockAudio(); saveSettings(); });
  row('采集/生产飘字', s.floats ? '显示' : '隐藏', () => { s.floats = !s.floats; saveSettings(); });
  const darkNames = { 0.6: '偏亮', 1: '标准', 1.3: '偏暗' };
  row('夜晚亮度', darkNames[s.dark] || '标准', () => { s.dark = s.dark === 0.6 ? 1 : s.dark === 1 ? 1.3 : 0.6; saveSettings(); });
  y += 10;
  drawButton(ctx, px, y, pw, 44, '清除所有存档', () => askConfirm('确定清除全部 4 个模式的存档吗？无法恢复。', () => MODE_ORDER.forEach(deleteSave)), { color: '#5d275d', size: 14 });
  y += 64;
  const tips = [
    '操作说明：点击 = 采集/建造/选中，拖动 = 移动视角，滚轮/双指 = 缩放',
    '电脑快捷键：1~9 建造，T 科技，E 装备，N 入夜，空格 加速，Esc 暂停',
    '丧尸模式：WASD/方向键 移动角色，也可以点地面移动',
  ];
  tips.forEach((t) => {
    wrapText(ctx, t, pw, 12).forEach((ln) => { drawText(ctx, ln, sw / 2, y, 12, '#94b0c2', 'center', false); y += 18; });
  });
}

function drawPauseMenu(ctx) {
  const sw = G.sw, sh = G.sh;
  ctx.fillStyle = 'rgba(10,10,30,0.75)';
  ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, null);
  const bw = Math.min(260, sw - 40), bh = 46, x = (sw - bw) / 2;
  let y = sh / 2 - 130;
  drawText(ctx, '暂停 · ' + G.def.name, sw / 2, y - 20, 22, '#ffcd75', 'center');
  drawButton(ctx, x, y, bw, bh, '继续游戏', () => { G.state = 'play'; }, { color: '#1f5e3a', size: 16 });
  y += bh + 12;
  const canSave = G.phase === 'day';
  drawButton(ctx, x, y, bw, bh, canSave ? '保存游戏' : '保存游戏（夜晚不能存档）', () => {
    if (!canSave) return;
    if (saveGame()) showBanner('已保存', G.def.name + ' · 第 ' + G.day + ' 天', 2, '#a7f070');
    G.state = 'play';
  }, { dim: !canSave, size: canSave ? 16 : 13 });
  y += bh + 12;
  drawButton(ctx, x, y, bw, bh, '设置', () => { G.settingsFrom = 'pause'; gotoScene('settings'); }, { size: 16 });
  y += bh + 12;
  drawButton(ctx, x, y, bw, bh, '返回主菜单', () => askConfirm('返回主菜单？上次存档之后的进度会丢失。', gotoTitle), { color: '#5d275d', size: 16 });
  drawConfirm(ctx);
}

function drawConfirm(ctx) {
  const c = G.confirm;
  if (!c) return;
  const sw = G.sw, sh = G.sh;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, null);
  const pw = Math.min(380, sw - 24);
  const lines = wrapText(ctx, c.text, pw - 32, 14);
  const ph = 90 + lines.length * 20, px = (sw - pw) / 2, py = (sh - ph) / 2;
  drawPanel(ctx, px, py, pw, ph);
  lines.forEach((ln, k) => drawText(ctx, ln, px + 16, py + 26 + k * 20, 14, '#f4f4f4', 'left', false));
  const by = py + ph - 52;
  drawButton(ctx, px + 16, by, (pw - 44) / 2, 38, '取消', () => { G.confirm = null; }, { size: 14 });
  drawButton(ctx, px + 28 + (pw - 44) / 2, by, (pw - 44) / 2, 38, '确定', () => { const f = c.onYes; G.confirm = null; f(); }, { color: '#b13e53', size: 14 });
}
