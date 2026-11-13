// =============================================
//  异能的「看得见」部分
//  1) 增益清单：把一个人当前生效的所有异能加成换算成具体数字（面板里显示）
//  2) 战斗时左上角的增益条：一眼看到自己激活了哪些异能和化学反应
//  3) 每种异能独特的战斗特效：近战挥砍光效、子弹拖尾、命中粒子
// =============================================

// ---------- 1) 增益清单 ----------
// 返回 [{ text, color }]，数值都是叠加了配比、等级、化学反应、上限之后的最终值
function abBuffList(p) {
  const a = AB(p), out = [];
  if (!a) return out;
  const add = (cond, text, color) => { if (cond) out.push({ text, color: color || '#f4f4f4' }); };
  const em = 1 + a.elem;
  add(a.meleeMul > 1.001, '近战伤害 +' + pct(a.meleeMul - 1), '#ff9aa8');
  add(a.rangedMul > 1.001, '枪械伤害 +' + pct(a.rangedMul - 1), '#ffe066');
  add(a.rateMul > 1.001, '攻击速度 +' + pct(a.rateMul - 1), '#73eff7');
  add(a.moveMul > 1.001, '移动速度 +' + pct(a.moveMul - 1), '#73eff7');
  add(a.hpAdd > 0 || a.hpMul > 1, '生命上限 +' + Math.round((a.hpAdd + 100) * a.hpMul - 100), '#ff9aa8');
  add(a.rangeAdd > 0, '攻击距离 +' + a.rangeAdd.toFixed(1) + ' 格', '#c8a2ff');
  add(true, '暴击率 ' + pct(BASE_CRIT + a.crit) + '（伤害 ×' + a.critMul.toFixed(1) + '）', '#ffe066');
  add(a.double > 0, pct(a.double) + ' 几率连击两次', '#73eff7');
  add(a.sweep > 0, '近战横扫 ' + a.sweep + ' 个敌人', '#9be0b0');
  add(a.knock > 0, '击退敌人', '#c8a2ff');
  add(a.burn > 0, '点燃：每秒 ' + pct(a.burn * em) + ' 攻击伤害' + (a.burnSpread ? '，会蔓延' : ''), '#ef7d57');
  add(a.slow > 0, '敌人减速 ' + pct(Math.min(0.85, a.slow * em)), '#a9e4ff');
  add(a.freeze > 0, '冻结几率 ' + pct(Math.min(1, a.freeze * em)) + (a.frozenBonus ? '，冻结目标受伤 +' + pct(a.frozenBonus) : ''), '#a9e4ff');
  add(a.chain > 0, '闪电连锁 ' + a.chain + ' 个（各 ' + pct(a.chainDmg * em) + '）' + (a.chainStun ? '并麻痹' : ''), '#ffe066');
  add(a.plasma > 0, '每次攻击溅射 ' + pct(a.plasma) + ' 伤害', '#ffe066');
  add(a.steam > 0, '蒸汽爆裂：火打减速目标会爆炸', '#dff6ff');
  add(a.quake > 0, '近战震荡周围 1.5 格', '#c49a64');
  add(a.root > 0, '定身几率 ' + pct(a.root), '#38b764');
  add(a.confuse > 0, '混乱几率 ' + pct(a.confuse) + (a.puppet ? '（会攻击同类）' : ''), '#ff9ad5');
  add(a.blades > 0, '每 2 秒射出飞刃', '#c8ccd8');
  add(a.blizzard > 0, '3 格内丧尸持续减速', '#a9e4ff');
  add(a.psyBlast > 0, '每 8 秒精神冲击（4 格）', '#ff9ad5');
  add(a.reduce > 0, '受到伤害 -' + pct(a.reduce), '#c8ccd8');
  add(a.thorns > 0, '反弹 ' + pct(a.thorns * 3) + ' 伤害', '#c8ccd8');
  add(a.shieldMax > 0, '岩石护盾 ' + Math.round(a.shieldMax), '#c49a64');
  add(a.dodge > 0, '闪避 ' + pct(a.dodge) + (a.dodgeCrit ? '（闪避后必暴击）' : ''), '#7a86f0');
  add(a.recover > 0, '受伤时回复 ' + pct(a.recover), '#a7f070');
  add(a.regen > 0, '每秒回复 ' + a.regen.toFixed(1) + ' 生命', '#a7f070');
  add(a.healAlly > 0, (a.campHeal ? '全营地' : '身边') + '同伴每秒 +' + a.healAlly.toFixed(1), '#a7f070');
  add(a.searchMul > 1.001, '搜刮速度 +' + pct(a.searchMul - 1), '#b06cd0');
  add(a.lootMul > 1.001, '搜到的物资 +' + pct(a.lootMul - 1), '#b06cd0');
  add(a.xpMul > 1.001, '技能经验 +' + pct(a.xpMul - 1), '#b06cd0');
  add(a.dawnFood > 0, '每天 食物 +' + Math.round(a.dawnFood * a.dawnMul), '#38b764');
  add(a.dawnWater > 0, '每天 水 +' + Math.round(a.dawnWater * a.dawnMul), '#41a6f6');
  add(a.moraleUp > 0, '全队每天士气 +' + Math.round(a.moraleUp) + (a.moraleFloor ? '（不低于 ' + a.moraleFloor + '）' : ''), '#ff9ad5');
  return out;
}

// 把增益画成一排排彩色小标签，返回底部 y
function drawBuffChips(ctx, list, x, y, w) {
  let ix = x;
  for (const b of list) {
    ctx.font = 'bold 11px ' + FONT;
    const bw = ctx.measureText(b.text).width + 14;
    if (ix + bw > x + w && ix > x) { ix = x; y += 24; }
    ctx.fillStyle = '#1a1c2c'; ctx.fillRect(ix, y, bw, 20);
    ctx.fillStyle = b.color; ctx.fillRect(ix, y, 3, 20);
    drawText(ctx, b.text, ix + 8, y + 10, 11, b.color);
    ix += bw + 5;
  }
  return y + 26;
}

// ---------- 2) 战斗时左上角的增益条 ----------
function drawBuffStrip(ctx) {
  const p = G.player, a = AB(p);
  if (!a || G.state !== 'play') return;
  const x = 8, w = G.sw >= 700 ? 150 : 104;
  let y = UI.topH + 38;
  const types = Object.keys(p.ab.w).sort((q, r) => p.ab.w[r] - p.ab.w[q]);
  const rows = types.length + Math.min(3, a.combos.length) + (a.shieldMax ? 1 : 0);
  ctx.fillStyle = 'rgba(26,28,44,0.72)';
  ctx.fillRect(x - 3, y - 3, w + 6, rows * 18 + 6);
  for (const t of types) {
    ctx.drawImage(SPR['icon_core_' + t].img, x, y, 16, 16);
    drawText(ctx, ABIL[t].name + ' ×' + p.ab.w[t] + ' Lv' + p.ab.lv[t], x + 19, y + 8, 11, ABIL[t].color);
    y += 18;
  }
  for (const c of a.combos.slice(0, 3)) {
    drawText(ctx, '⚡' + c.name, x + 2, y + 8, 11, '#ffe066');
    y += 18;
  }
  if (a.shieldMax) {
    ctx.fillStyle = '#1a1c2c'; ctx.fillRect(x, y + 3, w, 10);
    ctx.fillStyle = '#c49a64'; ctx.fillRect(x + 1, y + 4, (w - 2) * Math.min(1, (p.shield || 0) / a.shieldMax), 8);
    drawText(ctx, '护盾 ' + Math.round(p.shield || 0), x + w / 2, y + 8, 10, '#f4f4f4', 'center');
    y += 18;
  }
  addButton(x - 3, UI.topH + 35, w + 6, rows * 18 + 6, () => { G.state = 'equip'; G.equipTab = 'ability'; G.zSel = p; G.abGuide = false; });
}

// ---------- 3) 战斗特效 ----------
// c 主色 / c2 高光色，w 挥砍粗细，r 半径，arcs 几道弧，shape 粒子形状，n 粒子数，g 粒子重力（负数 = 往上飘），spread 粒子散开速度
const ABFX = {
  power: { c: '#d14a5e', c2: '#ffb3b3', w: 3.8, r: 11, arcs: 1, shape: 'dot', n: 6, g: 160, spread: 55, ring: 1 },      // 厚重红弧 + 冲击波
  speed: { c: '#73eff7', c2: '#ffffff', w: 1.2, r: 10, arcs: 3, shape: 'streak', n: 4, g: 0, spread: 80 },             // 三道细残影
  mind: { c: '#b06cd0', c2: '#f0d0ff', w: 1.8, r: 10, arcs: 1, shape: 'diamond', n: 4, g: 0, spread: 28 },             // 紫色菱形光点
  tele: { c: '#c8a2ff', c2: '#ffffff', w: 1.5, r: 10, arcs: 1, shape: 'ringlet', n: 2, g: 0, spread: 12, ring: 1 },    // 念力波纹
  electric: { c: '#ffe066', c2: '#ffffff', w: 1.6, r: 10, arcs: 1, jag: 1, shape: 'spark', n: 7, g: 0, spread: 90 },   // 锯齿电弧 + 火花
  fire: { c: '#ef7d57', c2: '#ffcd75', w: 2.8, r: 10, arcs: 1, shape: 'flame', n: 8, g: -110, spread: 26 },            // 火舌往上窜
  ice: { c: '#a9e4ff', c2: '#ffffff', w: 2, r: 10, arcs: 1, shape: 'diamond', n: 6, g: 70, spread: 45 },               // 冰晶碎片
  heal: { c: '#a7f070', c2: '#ffffff', w: 1.8, r: 10, arcs: 1, shape: 'plus', n: 3, g: -45, spread: 18 },              // 绿色十字上浮
  metal: { c: '#c8ccd8', c2: '#ffffff', w: 1.4, r: 11, arcs: 2, shape: 'spark', n: 6, g: 200, spread: 75 },            // 双道银光 + 金属火星
  earth: { c: '#c49a64', c2: '#6e4a2e', w: 3.2, r: 10, arcs: 1, shape: 'chunk', n: 5, g: 300, spread: 55 },            // 碎石飞溅
  wind: { c: '#9be0b0', c2: '#ffffff', w: 1.2, r: 13, arcs: 3, shape: 'streak', n: 3, g: 0, spread: 60, wide: 1 },     // 宽大的风刃
  water: { c: '#41a6f6', c2: '#c8e8ff', w: 2.2, r: 10, arcs: 1, shape: 'dot', n: 8, g: 240, spread: 50 },              // 水花
  wood: { c: '#38b764', c2: '#a7f070', w: 2, r: 10, arcs: 1, shape: 'leaf', n: 5, g: 50, spread: 35 },                 // 飘落的叶子
  space: { c: '#7a86f0', c2: '#101224', w: 2.6, r: 11, arcs: 1, rift: 1, shape: 'diamond', n: 3, g: 0, spread: 20 },   // 空间裂缝
  spirit: { c: '#ff9ad5', c2: '#ffffff', w: 1.6, r: 10, arcs: 1, wave: 1, shape: 'ringlet', n: 3, g: -20, spread: 14 }, // 精神波
};

// 这次攻击用哪种异能的特效：按配比随机（3 火 2 冰 → 六成是火）
function pickAbType(p) {
  if (!p.ab || !p.ab.w) return null;
  let r = Math.random() * 5;
  for (const t in p.ab.w) { r -= p.ab.w[t]; if (r <= 0) return t; }
  return Object.keys(p.ab.w)[0];
}

// 画一个粒子（位置按初速度 + 重力算出来，不需要每帧更新）
function drawAbParticle(ctx, e, k) {
  const t = e.t, x = e.x + e.vx * t, y = e.y + e.vy * t + 0.5 * e.g * t * t, s = e.size * (1 - k * 0.5);
  ctx.globalAlpha = 1 - k * k;
  ctx.fillStyle = ctx.strokeStyle = e.color;
  switch (e.shape) {
    case 'streak': ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - e.vx * 0.05, y - e.vy * 0.05); ctx.stroke(); break;
    case 'spark': ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - e.vx * 0.03 + rand(-1, 1), y - e.vy * 0.03 + rand(-1, 1)); ctx.stroke(); break;
    case 'diamond': ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.7, y); ctx.fill(); break;
    case 'plus': ctx.fillRect(x - s, y - 0.5, s * 2, 1); ctx.fillRect(x - 0.5, y - s, 1, s * 2); break;
    case 'flame': ctx.fillStyle = k < 0.4 ? e.c2 : e.color; ctx.fillRect(x - s / 2, y - s / 2, s, s * 1.3); break;
    case 'chunk': ctx.fillStyle = e.c2; ctx.fillRect(x - s / 2 - 0.5, y - s / 2 - 0.5, s + 1, s + 1); ctx.fillStyle = e.color; ctx.fillRect(x - s / 2, y - s / 2, s, s); break;
    case 'leaf': ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 14 + e.seed) * 2, y, s, s * 0.45, t * 6 + e.seed, 0, 7); ctx.fill(); break;
    case 'ringlet': ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 1 + k * e.size * 2.5, 0, 7); ctx.stroke(); break;
    default: ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
}
function fxParticles(t, x, y, n, ang, speedMul) {
  const f = ABFX[t];
  if (!f) return;
  for (let i = 0; i < n; i++) {
    const a = ang === undefined ? rand(0, 6.283) : ang + rand(-0.9, 0.9), v = f.spread * rand(0.4, 1) * (speedMul || 1);
    G.effects.push({
      type: 'custom', draw: drawAbParticle, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (f.g < 0 ? 10 : 0), g: f.g,
      shape: f.shape, color: Math.random() < 0.35 ? f.c2 : f.c, c2: f.c2, size: f.shape === 'chunk' ? 2.5 : rand(1.4, 2.6), seed: rand(0, 6),
      t: 0, life: rand(0.25, 0.5),
    });
  }
}

// 近战挥砍光效
function drawAbSwing(ctx, e, k) {
  const f = ABFX[e.ab], a = Math.atan2(e.ty - e.y, e.tx - e.x);
  const sweep = f.wide ? 1.5 : 1.2, back = f.wide ? 1.3 : 1.0;
  ctx.lineCap = 'round';
  for (let i = 0; i < f.arcs; i++) {
    const r = f.r + i * 2.6, lag = i * 0.22;
    const a0 = a - back + k * sweep - lag, a1 = a + 0.45 + k * sweep - lag;
    const path = () => {
      ctx.beginPath();
      if (f.jag) { // 电：锯齿状
        for (let q = 0; q <= 8; q++) {
          const aa = a0 + (a1 - a0) * q / 8, rr = r + (q % 2 ? 2.2 : -1.6) + rand(-0.8, 0.8);
          const px = e.x + Math.cos(aa) * rr, py = e.y + Math.sin(aa) * rr;
          if (q) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
      } else ctx.arc(e.x, e.y, r, a0, a1);
    };
    ctx.globalAlpha = (1 - k) * 0.4;
    ctx.strokeStyle = f.c; ctx.lineWidth = f.w + 2.5; path(); ctx.stroke();        // 外层光晕
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = f.w; path(); ctx.stroke();                                       // 主体
    ctx.strokeStyle = f.rift ? f.c2 : f.c2; ctx.lineWidth = Math.max(0.6, f.w * 0.35); path(); ctx.stroke(); // 高光（空间系是黑色裂缝）
  }
  if (f.rift) { // 空间：一道穿过目标的裂缝
    const len = 9 * (1 - k * 0.3), nx = Math.cos(a + 1.1), ny = Math.sin(a + 1.1);
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.strokeStyle = f.c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.tx - nx * len, e.ty - ny * len); ctx.lineTo(e.tx + nx * len, e.ty + ny * len); ctx.stroke();
    ctx.strokeStyle = f.c2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(e.tx - nx * len, e.ty - ny * len); ctx.lineTo(e.tx + nx * len, e.ty + ny * len); ctx.stroke();
  }
  if (f.wave) { // 精神：朝目标扩散的波纹
    ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = f.c; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(e.x, e.y, 6 + i * 4 + k * 10, a - 0.5, a + 0.5); ctx.stroke(); }
  }
  ctx.lineCap = 'butt';
  ctx.lineWidth = 1;
}
function fxSwing(p, target, t) {
  const f = ABFX[t], x = p.x, y = p.y - 6, tx = target.x, ty = target.y - 4;
  G.effects.push({ type: 'custom', draw: drawAbSwing, ab: t, x, y, tx, ty, t: 0, life: f.arcs > 1 ? 0.26 : 0.2 });
  fxParticles(t, tx, ty, f.n, Math.atan2(ty - y, tx - x));
  if (f.ring) G.effects.push({ type: 'ring', x: tx, y: ty, t: 0, life: 0.3, size: 11, color: f.c });
}
// 子弹 / 飞刃命中
function fxImpact(t, x, y, ang) {
  const f = ABFX[t];
  if (!f) return;
  fxParticles(t, x, y, Math.ceil(f.n * 0.8), ang, 0.9);
  if (f.ring || f.wave) G.effects.push({ type: 'ring', x, y, t: 0, life: 0.28, size: 9, color: f.c });
}

// 带异能的子弹：彩色拖尾 + 沿途洒落粒子
function drawAbTrail(ctx, p) {
  const f = ABFX[p.ab];
  if (!f) return false;
  const vx = p.vx || 0, vy = p.vy || 0, len = p.ab === 'speed' || p.ab === 'wind' ? 16 : 11;
  const x0 = p.x - vx * len, y0 = p.y - vy * len;
  const path = () => {
    ctx.beginPath();
    if (f.jag) { // 电：闪电形的拖尾
      ctx.moveTo(x0, y0);
      for (let q = 1; q < 5; q++) ctx.lineTo(x0 + (p.x - x0) * q / 5 - vy * rand(-2.5, 2.5), y0 + (p.y - y0) * q / 5 + vx * rand(-2.5, 2.5));
      ctx.lineTo(p.x, p.y);
    } else { ctx.moveTo(x0, y0); ctx.lineTo(p.x, p.y); }
  };
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.35; ctx.strokeStyle = f.c; ctx.lineWidth = 4; path(); ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineWidth = 2; path(); ctx.stroke();
  ctx.strokeStyle = f.c2; ctx.lineWidth = 0.9; path(); ctx.stroke();
  ctx.lineCap = 'butt'; ctx.lineWidth = 1;
  // 弹头
  ctx.fillStyle = f.rift ? f.c : f.c2;
  if (f.shape === 'diamond') { ctx.beginPath(); ctx.moveTo(p.x, p.y - 2.5); ctx.lineTo(p.x + 2, p.y); ctx.lineTo(p.x, p.y + 2.5); ctx.lineTo(p.x - 2, p.y); ctx.fill(); }
  else if (f.shape === 'ringlet') { ctx.strokeStyle = f.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5 + Math.sin(G.time * 30) * 0.8, 0, 7); ctx.stroke(); }
  else if (f.shape === 'chunk') { ctx.fillStyle = f.c2; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); ctx.fillStyle = f.c; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
  else ctx.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
  // 沿途洒落的粒子（游戏暂停时 G.clock 不走，不会一直生成）
  if (G.clock - (p.et || 0) > 0.03) {
    p.et = G.clock;
    G.effects.push({
      type: 'custom', draw: drawAbParticle, x: p.x, y: p.y, vx: rand(-12, 12) - vx * 20, vy: rand(-12, 12) - vy * 20 - (f.g < 0 ? 14 : 0), g: f.g * 0.5,
      shape: f.shape, color: Math.random() < 0.4 ? f.c2 : f.c, c2: f.c2, size: f.shape === 'chunk' ? 2 : rand(1.2, 2.2), seed: rand(0, 6), t: 0, life: rand(0.2, 0.35),
    });
  }
  return true;
}
