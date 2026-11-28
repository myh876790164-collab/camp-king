// =============================================
//  丧尸末世：程序化像素特效（和公路求生 js/roadvfx.js、修仙 js/sectvfx.js 同一套做法）
//  逐像素算帧（噪声 + 分档色带 + 4×4 抖动），缓存成小图，按最近邻贴到地图上：
//  1 个特效像素 = 1 个地图像素，和丧尸、幸存者的像素一样大、一样锐利，不用模糊和圆弧描边。
//  替换了原来的几种画法：
//    爆炸 / 溅射（噪声溶解火球，按颜色换色带：火、等离子、蒸汽、震地碎石+地裂）、
//    闪电连锁（像素闪电 + 空间碎裂）、精神冲击圆环、枪口射线、近战挥砍；
//    异能挥砍光效、异能子弹拖尾、命中粒子（全部对齐到整像素）；
//    着火丧尸身上的火焰龙卷风、冻结丧尸的冰晶外壳、变异丧尸脚下的像素光环。
//  生成帧用的 rdpxBake / rdpxBoomSheet / rdpxTornadoSheet / rdpxRiftSheet 在 js/roadvfx.js，
//  整像素贴图、画线用 js/sectvfx.js 的 sectpxBlit / sectpxLine / sectpxBolt 等（运行时都已加载）。
//  名字统一用 zpx / ZPX_ 前缀
// =============================================

const ZPX_STEAM = ['#ffffff', '#f4fbff', '#dff6ff', '#b8dcef', '#8fb4cc', '#6a8aa4', '#4a5e74', '#33404e'];
const ZPX_DUST = ['#fff0d0', '#e8c890', '#c49a64', '#9a7448', '#6e4a2e', '#5a4636', '#463a32', '#3a302a'];
const ZPX_ICE = ['#ffffff', '#dff6ff', '#a9e4ff', '#73b8e0', '#4a86c0'];

// 爆炸颜色 → 色带
function zpxBoomRamp(col) {
  if (!col || col === '#ef7d57') return RDPX_FIRE;
  if (col === '#dff6ff') return ZPX_STEAM;
  if (col === '#c49a64') return ZPX_DUST;
  return sectpxRamp(col, rdShade(col, -0.35));
}
function zpxFrame(sheet, f, n) { return sheet[Math.max(0, Math.min(n - 1, Math.floor(f * n)))]; }

// ---------- G.effects：drawProjectilesAndEffects（js/render.js）先问这里，返回 true 就不走老画法 ----------
function zpxEffect(ctx, e, k) {
  switch (e.type) {
    case 'boom': {
      const ramp = zpxBoomRamp(e.color), D = sectpxEven(e.size * 2.3, 8);
      ctx.globalAlpha = 1;
      if (e.color === '#c49a64') { // 震地：先在地上裂开一块岩浆裂谷
        ctx.globalAlpha = Math.min(1, (1 - k) * 3);
        sectpxBlit(ctx, zpxFrame(rdpxRiftSheet(Math.max(12, Math.round(e.size * 2.4 / 4) * 4)), k, RDPX_RIFT_N), e.x, e.y + 2);
        ctx.globalAlpha = 1;
      }
      sectpxBlit(ctx, zpxFrame(rdpxBoomSheet(Math.min(128, D), ramp, true), k * 0.8, RDPX_BOOM_N), e.x, e.y - 2); // 地图上的爆炸很短（0.25 秒），只放到烟快散完那帧，火光多留一会
      // 飞溅的火星：沿抛物线飞，颜色随时间变暗
      const n = Math.min(10, 4 + Math.floor(e.size / 4));
      for (let i = 0; i < n; i++) {
        if (k > 0.2 + rdpxH2(i * 3, e.x) * 0.75) continue;
        const an = rdpxH2(e.x * 0.37 + i, i * 1.7 + e.y) * 6.283, sp = e.size * (0.7 + rdpxH2(i, e.x) * 1.1);
        ctx.fillStyle = ramp[Math.min(5, 1 + Math.floor(k * 6))];
        sectpxDot(ctx, e.x + Math.cos(an) * sp * k * 1.3, e.y - 2 + Math.sin(an) * sp * k * 0.8 - sp * k * 0.6 + 14 * k * k, 1);
      }
      return true;
    }
    case 'bolt': { // 闪电连锁：每一跳一道像素闪电，落点空间碎裂
      const a = 1 - k;
      for (let i = 1; i < e.pts.length; i++) {
        const [x1, y1] = e.pts[i - 1], [x2, y2] = e.pts[i];
        sectpxBolt(ctx, x1, y1, x2, y2, '#e8fcff', '#73eff7', a);
        sectpxHalo(ctx, '#73eff7', x2, y2, 5, a * 0.7);
        ctx.globalAlpha = 1; sectpxShatter(ctx, x2, y2, 6, Math.floor(x2 * 7 + y2), k, '#73eff7', '#e8fcff');
      }
      return true;
    }
    case 'ring': { // 扩散圆环：外圈实点 + 里面一圈稀疏的抖动点
      const r = e.size * (0.2 + k * 0.8), col = e.color || '#f4f4f4';
      ctx.globalAlpha = 1 - k; ctx.fillStyle = col;
      zpxEllipse(ctx, e.x, e.y, r, r, 2);
      ctx.fillStyle = rdMix(col, '#ffffff', 0.5); zpxEllipse(ctx, e.x, e.y, r, r, 1);
      ctx.globalAlpha = (1 - k) * 0.6; ctx.fillStyle = col; zpxEllipse(ctx, e.x, e.y, r * 0.72, r * 0.72, 1, 0.35);
      return true;
    }
    case 'tracer': {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = e.color || '#ef7d57'; sectpxLine(ctx, e.x, e.y, e.tx, e.ty, 1);
      ctx.fillStyle = '#ffffff'; sectpxDot(ctx, e.tx, e.ty, 1);
      return true;
    }
    case 'swing': { // 普通近战挥砍：一道整像素的白色弧
      const a = Math.atan2(e.ty - e.y, e.tx - e.x);
      ctx.globalAlpha = (1 - k) * 0.45; ctx.fillStyle = '#94b0c2'; zpxArc(ctx, e.x, e.y, 9, a - 0.9 + k, a + 0.5 + k, 3);
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#f4f4f4'; zpxArc(ctx, e.x, e.y, 9, a - 0.9 + k, a + 0.5 + k, 1);
      return true;
    }
    case 'puff': { // 小烟团：只是把位置对齐到整像素
      const r = e.size * (0.35 + k * 0.65), q = Math.max(1, Math.round((1 - k) * 2.2 + 0.6));
      ctx.fillStyle = e.color;
      for (let j = 0; j < 8; j++) { const an = j * 0.785 + e.size; sectpxDot(ctx, e.x + Math.cos(an) * r - q / 2, e.y + Math.sin(an) * r * 0.8 - q / 2 - k * 3, q); }
      return true;
    }
    case 'p': ctx.fillStyle = e.color; sectpxDot(ctx, e.x - 1, e.y - 1, 2); return true;
    case 'custom':
      if (e.draw === drawAbSwing) { zpxSwing(ctx, e, k); return true; }
      if (e.draw === drawAbParticle) { zpxParticle(ctx, e, k); return true; }
      return false;
  }
  return false;
}

// 整像素椭圆（th 粗细；dens < 1 时只按抖动画一部分点）
function zpxEllipse(ctx, x, y, rx, ry, th, dens) {
  const n = Math.max(8, Math.round((rx + ry) * 3.2));
  for (let i = 0; i < n; i++) {
    const an = i / n * 6.2832, px = Math.round(x + Math.cos(an) * rx), py = Math.round(y + Math.sin(an) * ry);
    if (dens != null && rdpxBayer(px, py) > dens) continue;
    ctx.fillRect(px - ((th - 1) >> 1), py - ((th - 1) >> 1), th, th);
  }
}
// 整像素圆弧（jag：锯齿电弧）
function zpxArc(ctx, x, y, r, a0, a1, th, jag) {
  const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) * r / 2));
  let lx = 0, ly = 0;
  for (let q = 0; q <= n; q++) {
    const aa = a0 + (a1 - a0) * q / n, rr = r + (jag ? (q % 2 ? 2 : -1.5) + rand(-0.8, 0.8) : 0);
    const px = x + Math.cos(aa) * rr, py = y + Math.sin(aa) * rr;
    if (q) sectpxLine(ctx, lx, ly, px, py, th);
    lx = px; ly = py;
  }
}

// ---------- 异能挥砍（像素版 drawAbSwing） ----------
function zpxSwing(ctx, e, k) {
  const f = ABFX[e.ab], a = Math.atan2(e.ty - e.y, e.tx - e.x);
  const sweep = f.wide ? 1.5 : 1.2, back = f.wide ? 1.3 : 1.0, th = Math.max(1, Math.round(f.w));
  for (let i = 0; i < f.arcs; i++) {
    const r = f.r + i * 2.6, lag = i * 0.22, a0 = a - back + k * sweep - lag, a1 = a + 0.45 + k * sweep - lag;
    ctx.globalAlpha = (1 - k) * 0.4; ctx.fillStyle = f.c; zpxArc(ctx, e.x, e.y, r, a0, a1, th + 2, f.jag); // 外层光晕
    ctx.globalAlpha = 1 - k; zpxArc(ctx, e.x, e.y, r, a0, a1, th, f.jag);                                  // 主体
    ctx.fillStyle = f.c2; zpxArc(ctx, e.x, e.y, r, a0 + 0.1, a1 - 0.05, 1, f.jag);                         // 高光（空间系是黑色裂缝）
  }
  if (f.ring) { ctx.globalAlpha = (1 - k) * 0.7; ctx.fillStyle = f.c2; sectpxShatter(ctx, e.tx, e.ty, 6, Math.floor(e.tx * 3), k, f.c, f.c2); }
  if (f.rift) { // 空间：一道穿过目标的裂缝 + 碎裂
    const len = 9 * (1 - k * 0.3), nx = Math.cos(a + 1.1), ny = Math.sin(a + 1.1);
    ctx.globalAlpha = (1 - k) * 0.8; ctx.fillStyle = f.c; sectpxLine(ctx, e.tx - nx * len, e.ty - ny * len, e.tx + nx * len, e.ty + ny * len, 3);
    ctx.fillStyle = f.c2; sectpxLine(ctx, e.tx - nx * len, e.ty - ny * len, e.tx + nx * len, e.ty + ny * len, 1);
    ctx.globalAlpha = 1 - k; sectpxShatter(ctx, e.tx, e.ty, 8, Math.floor(e.tx * 5), k, f.c, '#ffffff');
  }
  if (f.wave) { // 精神：朝目标扩散的像素波纹
    ctx.globalAlpha = (1 - k) * 0.8; ctx.fillStyle = f.c;
    for (let i = 0; i < 3; i++) zpxArc(ctx, e.x, e.y, 6 + i * 4 + k * 10, a - 0.5, a + 0.5, 1);
  }
  if (e.ab === 'fire' && k < 0.6) { ctx.globalAlpha = 1; sectpxBlit(ctx, zpxFrame(rdpxBoomSheet(12, 'fire', false), 0.15 + k, RDPX_BOOM_N), e.tx, e.ty); } // 火：命中处窜起一团小火
}

// ---------- 命中粒子（像素版 drawAbParticle） ----------
function zpxParticle(ctx, e, k) {
  const t = e.t, x = Math.round(e.x + e.vx * t), y = Math.round(e.y + e.vy * t + 0.5 * e.g * t * t), s = Math.max(1, Math.round(e.size * (1 - k * 0.5)));
  ctx.globalAlpha = 1 - k * k;
  ctx.fillStyle = e.color;
  switch (e.shape) {
    case 'streak': sectpxLine(ctx, x, y, x - e.vx * 0.05, y - e.vy * 0.05, 1); break;
    case 'spark': sectpxLine(ctx, x, y, x - e.vx * 0.03, y - e.vy * 0.03, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); break;
    case 'diamond': ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1); if (s > 1) { ctx.fillStyle = e.c2; ctx.fillRect(x, y, 1, 1); } break;
    case 'plus': ctx.fillRect(x - s, y, s * 2 + 1, 1); ctx.fillRect(x, y - s, 1, s * 2 + 1); break;
    case 'flame': ctx.fillStyle = k < 0.4 ? e.c2 : e.color; ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s + 1); if (k < 0.4) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); } break;
    case 'chunk': ctx.fillStyle = e.c2; ctx.fillRect(x - 1, y - 1, s + 1, s + 1); ctx.fillStyle = e.color; ctx.fillRect(x - 1, y - 1, s, s); break;
    case 'leaf': { const lx = x + Math.round(Math.sin(t * 14 + e.seed) * 2); ctx.fillRect(lx - 1, y, 2, 1); ctx.fillRect(lx + (Math.sin(t * 6 + e.seed) > 0 ? 1 : -2), y - 1, 2, 1); break; }
    case 'ringlet': { const r = 1 + k * e.size * 2.5; zpxEllipse(ctx, x, y, r, r, 1); break; }
    default: ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s);
  }
}

// ---------- 异能子弹（像素版 drawAbTrail）：整像素拖尾 + 阶梯光晕弹头 ----------
function zpxTrail(ctx, p) {
  const f = ABFX[p.ab];
  if (!f) return false;
  const vx = p.vx || 0, vy = p.vy || 0, len = p.ab === 'speed' || p.ab === 'wind' ? 16 : 11;
  const x0 = p.x - vx * len, y0 = p.y - vy * len;
  if (f.jag) { // 电：闪电形的拖尾
    sectpxBolt(ctx, x0, y0, p.x, p.y, f.c2, f.c, 1);
  } else if (p.ab === 'fire') { // 火：一串越来越小的火团
    for (let i = 3; i >= 0; i--) { ctx.globalAlpha = 1 - i * 0.2; sectpxBlit(ctx, zpxFrame(rdpxBoomSheet(sectpxEven(9 - i * 1.5, 4), 'fire', false), 0.1 + i * 0.16, RDPX_BOOM_N), p.x - vx * i * 3, p.y - vy * i * 3); }
  } else {
    ctx.globalAlpha = 0.4; ctx.fillStyle = f.c; sectpxLine(ctx, x0, y0, p.x, p.y, 3);
    ctx.globalAlpha = 1; sectpxLine(ctx, (x0 + p.x) / 2, (y0 + p.y) / 2, p.x, p.y, 2);
    ctx.fillStyle = f.c2; sectpxLine(ctx, x0 + vx * len * 0.4, y0 + vy * len * 0.4, p.x, p.y, 1);
  }
  sectpxHalo(ctx, f.c, p.x, p.y, 3.5, 0.55);
  ctx.globalAlpha = 1;
  // 弹头
  const hx = Math.round(p.x), hy = Math.round(p.y);
  if (f.shape === 'diamond') { ctx.fillStyle = f.c; ctx.fillRect(hx, hy - 2, 1, 5); ctx.fillRect(hx - 1, hy - 1, 3, 3); ctx.fillStyle = f.c2; ctx.fillRect(hx, hy, 1, 1); }
  else if (f.shape === 'ringlet') { ctx.fillStyle = f.c; zpxEllipse(ctx, hx, hy, 2.5 + Math.round(Math.sin(G.time * 30)), 2.5 + Math.round(Math.sin(G.time * 30)), 1); }
  else if (f.shape === 'chunk') { ctx.fillStyle = f.c2; ctx.fillRect(hx - 2, hy - 2, 4, 4); ctx.fillStyle = f.c; ctx.fillRect(hx - 1, hy - 1, 2, 2); }
  else if (p.ab !== 'fire') { ctx.fillStyle = f.rift ? f.c : f.c2; ctx.fillRect(hx - 1, hy - 1, 2, 2); }
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

// ---------- 丧尸身上的状态（画在丧尸之后）：着火 → 火焰龙卷风，冻结 → 冰晶外壳 ----------
// 冰晶外壳：Voronoi 切出一块块冰面，边缘最亮，中间半透明（抖动镂空）
function zpxIceSheet(W, H) {
  return rdpxBake('zice' + W + 'x' + H, W, H, 1, ZPX_ICE, (u, v, t, px, py) => {
    const b = rdpxBayer(px, py), e = u * u * 1.1 + v * v * 0.9 + rdpxN2(u * 3 + 2, v * 3) * 0.25;
    if (e > 1) return -1;
    const X = u * 2.6, Y = v * 3.4, xi = Math.floor(X), yi = Math.floor(Y); let f1 = 9, f2 = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = xi + i + rdpxH2(xi + i, yi + j + 5), cy = yi + j + rdpxH2(yi + j + 31, xi + i + 7), d = Math.hypot(X - cx, Y - cy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    if (f2 - f1 < 0.09) return 1;            // 冰块之间的亮棱
    if (e > 0.82) return 2;                  // 外轮廓
    if (u < -0.2 && v < -0.2 && e < 0.45) return b < 0.5 ? 0 : -1; // 左上高光
    return b < 0.3 ? (f1 < 0.35 ? 3 : 4) : -1; // 里面稀疏的冰面，透出丧尸本体
  })[0];
}
function zpxMonsterOver(ctx, m, top, w, h) {
  const c = G.clock;
  if (m.burnUntil > c) {
    const hot = Math.min(1, (m.burnDps || 4) / 12), W = Math.min(48, sectpxEven(w * (0.85 + hot * 0.4) / 3) * 3), H = Math.min(60, Math.round(h * (1.05 + hot * 0.45) / 6) * 6);
    ctx.globalAlpha = Math.min(1, (m.burnUntil - c) * 1.5) * 0.75;
    sectpxBlit(ctx, rdpxTornadoSheet(W, H)[Math.floor((((G.time * 14 + m.bob * 3) % RDPX_TOR_N) + RDPX_TOR_N) % RDPX_TOR_N)], m.x, m.y + 3, 1);
    ctx.globalAlpha = 1;
  }
  if (m.frozenUntil > c) {
    ctx.globalAlpha = Math.min(1, (m.frozenUntil - c) * 3) * 0.85;
    sectpxBlit(ctx, zpxIceSheet(sectpxEven(w + 4), sectpxEven(h + 2)), m.x, m.y + 3, 1);
    if (Math.sin(G.time * 9 + m.bob) > 0.85) { ctx.fillStyle = '#ffffff'; sectpxDot(ctx, m.x - w / 2 + 2 + (m.bob * 7) % (w - 2), top + 3 + (m.bob * 5) % (h * 0.5)); } // 闪一下的冰晶反光
    ctx.globalAlpha = 1;
  }
}
// 变异丧尸脚下的光环：压扁的像素椭圆，外圈实点 + 里面抖动渐隐（4 帧呼吸）
function zpxAuraSheet(col, W) {
  return rdpxBake('zaura' + col + W, W, sectpxEven(W * 0.45), 4, [rdMix(col, '#ffffff', 0.45), col, rdShade(col, -0.3)], (u, v, t, px, py) => {
    const b = rdpxBayer(px, py), r = Math.hypot(u, v), R0 = 0.82 + Math.sin(t * 6.2832) * 0.12;
    if (r > R0) return -1;
    if (r > R0 - 0.16) return (px + py + Math.floor(t * 4)) % 3 === 0 ? 0 : 1;
    return b < (r / R0) * 0.55 ? 2 : -1;
  });
}
function zpxSpecial(ctx, m) {
  const col = ABIL[m.special].color;
  ctx.globalAlpha = 0.8; sectpxBlit(ctx, zpxAuraSheet(col, 16)[Math.floor((G.time * 5 + m.bob) % 4)], m.x, m.y + 2);
  ctx.globalAlpha = 1;
  // 头顶的小晶核：1 像素深色描边的菱形
  const x = Math.round(m.x), y = Math.round(m.y - 20 + Math.sin(G.time * 4 + m.bob));
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(x - 1, y - 3, 3, 7); ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillRect(x - 3, y - 1, 7, 3);
  ctx.fillStyle = col; ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillRect(x - 2, y, 5, 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 1, 1);
}
