// =============================================
//  修仙门派：程序化像素特效（和公路求生 js/roadvfx.js 同一套做法）
//  逐像素算帧（噪声 + 分档色带 + 4×4 抖动），缓存成小图，按最近邻贴到地图上：
//  1 个特效像素 = 1 个地图像素，所以和地图、弟子的像素一样大、一样锐利。
//  替换了原来用模糊渐变 / 圆弧画的几种法术和光环：
//    火球（噪声溶解）、火雨、烈日（旋转光芒）、光柱 / 突破天柱、雷法（像素闪电 + 空间碎裂）、光束、
//    水系漩涡（螺旋传送门）、暗影（小黑洞）、地裂（岩浆裂谷）、落石炸开；
//    光环：火系「火焰龙卷风」、阳系光芒、烛火、月亮、雷光。
//  生成帧用的函数（rdpxBake、rdpxBoomSheet 等）在 js/roadvfx.js 里，运行时都已加载。
//  名字统一用 sectpx / SECTPX_ 前缀
// =============================================

// 一条道途的色带：白 → 主色 → 副色 → 越来越暗
const SECTPX_RAMPS = {};
function sectpxRamp(c1, c2) {
  const k = c1 + c2;
  return SECTPX_RAMPS[k] || (SECTPX_RAMPS[k] = ['#ffffff', rdMix(c1, '#ffffff', 0.35), c1, c2, rdShade(c2, -0.3), rdShade(c2, -0.55), rdShade(c2, -0.75), '#2a2430']);
}
// 贴图：按地图整像素对齐（ay：0 顶边对齐，0.5 居中，1 底边对齐）
function sectpxBlit(ctx, cv, x, y, ay) {
  ctx.drawImage(cv, Math.round(x - cv.width / 2), Math.round(y - cv.height * (ay == null ? 0.5 : ay)));
}
function sectpxEven(d, min) { return Math.max(min || 4, Math.round(d / 2) * 2); }
// 地图整像素线
function sectpxLine(ctx, x1, y1, x2, y2, th) {
  const ax = Math.round(x1), ay = Math.round(y1), bx = Math.round(x2), by = Math.round(y2), n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1), o = (th - 1) >> 1;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(ax + (bx - ax) * i / n) - o, Math.round(ay + (by - ay) * i / n) - o, th, th);
}
function sectpxDot(ctx, x, y, s) { ctx.fillRect(Math.round(x), Math.round(y), s || 1, s || 1); }
function sectpxHalo(ctx, col, x, y, r, a) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); sectpxBlit(ctx, rdpxHalo(col, sectpxEven(r * 2, 4)), x, y); }

// ---------- 生成帧 ----------
// 螺旋漩涡（俯视压扁的椭圆）：三条对数螺旋臂向中心旋入，中心是深色的「眼」
function sectpxSpiralSheet(D, ramp) {
  const N = ramp.length - 1;
  return rdpxBake('spiral' + D + ramp.join(''), D, sectpxEven(D * 0.55), 8, ramp, (u, v, t, px, py) => {
    const b = rdpxBayer(px, py), rd = Math.hypot(u, v);
    if (rd > 1) return -1;
    if (rd < 0.16) return ramp.length - 1;
    const sw = Math.atan2(v, u) + Math.log(rd) * 3 - t * 6.2832 / 3, band = Math.sin(sw * 3);
    if (band < -0.15 + rd * 0.5) return (rd < 0.6 && b < 0.25) ? N - 1 : -1;
    if (rd > 0.82 && b < (rd - 0.82) / 0.18) return -1;
    return rdpxRamp(Math.max(0, Math.min(1, (1 - rd) * 0.75 + band * 0.3)), N, px, py);
  });
}
// 烈日：白色核心 + 两组反向旋转的光芒（8 道 + 12 道），外圈稀疏的日冕点
function sectpxSunSheet(D, ramp) {
  const N = ramp.length - 1;
  return rdpxBake('sun' + D + ramp.join(''), D, D, 8, ramp, (u, v, t, px, py) => {
    const b = rdpxBayer(px, py), r = Math.hypot(u, v), an = Math.atan2(v, u), T = t * 6.2832;
    if (r < 0.26) return 0;
    if (r < 0.36) return b < 0.6 ? 0 : 1;
    const r1 = 0.5 + 0.5 * Math.cos(8 * an - T), r2 = 0.5 + 0.5 * Math.cos(12 * an + T);
    const len = 0.42 + Math.pow(Math.max(r1, r2 * 0.8), 3) * 0.58;
    if (r < len) return rdpxRamp(Math.max(0, 1 - (r - 0.36) / (len - 0.36 + 0.01)) * 0.8 + 0.1, N - 2, px, py) + 1;
    if (r < 0.58 && b < 0.3) return 2;
    return -1;
  });
}
// 光柱：中间最亮，两边按色带一档档变暗，噪声条纹不停往上流；顶部用抖动点淡出
function sectpxPillarSheet(W, H, ramp) {
  const N = ramp.length - 2;
  return rdpxBake('pillar' + W + 'x' + H + ramp.join(''), W, H, 8, ramp, (u, v, t, px, py) => {
    const b = rdpxBayer(px, py), y01 = (v + 1) / 2, dx = Math.abs(u);
    const n = rdpxN2(u * 3 + 7, y01 * 5 + t * 4) * (1 - t) + rdpxN2(u * 3 + 7, y01 * 5 + t * 4 - 4) * t; // 首尾相接，循环不跳
    if (y01 < 0.3 && b > y01 / 0.3) return -1;
    const w = 0.34 + 0.22 * n + (y01 > 0.9 ? (y01 - 0.9) * 4 : 0);
    if (dx > w) return (dx < w + 0.35 && n > 0.62 && b < 0.2) ? 2 : -1; // 柱子外飘的光点
    return rdpxRamp(Math.max(0, Math.min(1, 1 - dx / w * 0.85 + (n - 0.5) * 0.45)), N, px, py);
  });
}
// 月亮：亮面 + 被暗面切出的月牙
function sectpxMoonSheet(D, c1) {
  return rdpxBake('moon' + D + c1, D, D, 1, ['#ffffff', c1, rdShade(c1, -0.25)], (u, v, t, px, py) => {
    if (Math.hypot(u, v) > 0.95) return -1;
    if (Math.hypot(u - 0.42, v + 0.22) < 0.78) return -1;
    return Math.hypot(u + 0.3, v + 0.3) < 0.4 ? 0 : (u + v > 0.3 ? 2 : 1);
  })[0];
}

// ---------- 闪电与碎裂（地图整像素） ----------
function sectpxBolt(ctx, x1, y1, x2, y2, c1, c2, a) {
  const pts = rdpxBoltPts(x1, y1, x2, y2, 0.5, 4), L = Math.hypot(x2 - x1, y2 - y1), br = [];
  for (let k = 0; k < 2; k++) { const i = 3 + Math.floor(Math.random() * (pts.length - 6)), [bx, by] = pts[i], an = Math.atan2(y2 - y1, x2 - x1) + (Math.random() - 0.5) * 2.2; br.push(rdpxBoltPts(bx, by, bx + Math.cos(an) * L * 0.25, by + Math.sin(an) * L * 0.25, 0.6, 2)); }
  const seg = (P, th) => { for (let i = 1; i < P.length; i++) sectpxLine(ctx, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], th); };
  ctx.globalAlpha = a * 0.6; ctx.fillStyle = c2; seg(pts, 3);
  ctx.globalAlpha = a; ctx.fillStyle = c1; for (const b of br) seg(b, 1);
  ctx.fillStyle = '#ffffff'; seg(pts, 1);
}
function sectpxShatter(ctx, x, y, r, seed, p, c1, c2) {
  const grow = Math.min(1, p * 3), a0 = ctx.globalAlpha;
  for (let i = 0; i < 6; i++) {
    let an = (i + rdpxH2(seed, i) * 0.7) / 6 * 6.283, cx = x, cy = y;
    const L = r * (0.5 + rdpxH2(i, seed) * 0.7) * grow;
    ctx.fillStyle = i % 2 ? c2 : c1;
    for (let s = 0; s < 3; s++) { an += (rdpxH2(seed + s, i * 3) - 0.5) * 0.9; const nx = cx + Math.cos(an) * L / 3, ny = cy + Math.sin(an) * L / 3 * 0.7; sectpxLine(ctx, cx, cy, nx, ny, 1); cx = nx; cy = ny; }
    ctx.globalAlpha = a0 * (1 - p); ctx.fillStyle = '#ffffff';
    sectpxDot(ctx, x + Math.cos(an) * r * (0.4 + p * 1.4), y + Math.sin(an) * r * (0.4 + p * 1.4) * 0.7 + p * p * 5);
    ctx.globalAlpha = a0;
  }
}

// ---------- 施法特效：drawCastFx（js/sectfx.js）先问这里，返回 true 就不走老画法 ----------
function sectpxCast(ctx, e) {
  const k = e.t / e.life, x = e.x, y = e.y - 8, tx = e.tx, ty = e.ty - 6, s = e.s, R = sectpxRamp(e.c1, e.c2);
  const fly = Math.min(1, k * 1.6), px = x + (tx - x) * fly, py = y + (ty - y) * fly - Math.sin(fly * Math.PI) * 4;
  const hit = k > 0.6, hk = (k - 0.6) / 0.4, ang = Math.atan2(ty - y, tx - x), F = RDPX_BOOM_N;
  const boom = (D, f, ring) => rdpxBoomSheet(sectpxEven(D, 6), R, ring)[Math.max(0, Math.min(F - 1, Math.floor(f * F)))];
  ctx.save();
  ctx.globalAlpha = 1;
  let done = true;
  switch (e.kind) {
    case 'fireball':
      if (!hit) {
        for (let i = 3; i >= 1; i--) { ctx.globalAlpha = 0.85 - i * 0.18; sectpxBlit(ctx, boom(8 * s - i, 0.35 + i * 0.14), px - Math.cos(ang) * i * 3, py - Math.sin(ang) * i * 3); }
        ctx.globalAlpha = 1; sectpxBlit(ctx, boom(10 * s, 0.12 + ((G.time * 6) % 1) * 0.12), px, py);
      } else sectpxBlit(ctx, boom(26 * s, hk * 0.95, true), tx, ty);
      break;
    case 'firerain':
      for (let i = 0; i < 6; i++) {
        const f = (k - i * 0.1) / 0.5; if (f < 0 || f > 1.6) continue;
        const fx = tx + (i - 2.5) * 5 + Math.sin(i * 3.3) * 3;
        if (f < 1) { const fy = ty - 50 + f * 50; ctx.globalAlpha = 0.5; ctx.fillStyle = e.c2; sectpxLine(ctx, fx, fy - 9, fx, fy - 3, 1); ctx.globalAlpha = 1; sectpxBlit(ctx, boom(7, 0.15 + (i % 3) * 0.08), fx, fy); }
        else sectpxBlit(ctx, boom(14, (f - 1) / 0.6, true), fx, ty);
      }
      break;
    case 'sunburst': {
      const a = Math.sin(Math.min(1, k * 2) * Math.PI / 2) * (1 - Math.max(0, k - 0.6) / 0.4), fr = sectpxSunSheet(sectpxEven(44 * s * (0.6 + Math.min(1, k * 2) * 0.4) / 4) * 4, R);
      ctx.globalAlpha = a; sectpxBlit(ctx, fr[Math.floor((G.time * 10) % 8)], tx, ty);
      break;
    }
    case 'pillar': case 'breakthrough': {
      const big = e.kind === 'breakthrough', W = sectpxEven((big ? 20 : 12) * s), H = big ? 90 : 40;
      const a = Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (1 - Math.max(0, k - 0.6) / 0.4);
      ctx.globalAlpha = a; sectpxBlit(ctx, sectpxPillarSheet(W, H, R)[Math.floor((G.time * 12) % 8)], tx, ty + 5, 1);
      // 脚下扩散的光圈（像素点围成的椭圆）
      const rx = W * 0.6 * (1 + k), ry = rx * 0.4, n = Math.round(rx * 2.2);
      ctx.fillStyle = e.c1; for (let i = 0; i < n; i++) { const t2 = i / n * 6.283; sectpxDot(ctx, tx + Math.cos(t2) * rx, ty + 4 + Math.sin(t2) * ry); }
      if (big) for (let i = 0; i < 14; i++) { const ph = (k * 1.5 + i / 14) % 1; ctx.globalAlpha = (1 - ph) * a; ctx.fillStyle = i % 2 ? e.c1 : e.c2; sectpxDot(ctx, tx + Math.sin(i * 2.3 + e.seed) * W * 0.9, ty - ph * H, 1); sectpxDot(ctx, tx + Math.sin(i * 2.3 + e.seed) * W * 0.9, ty - ph * H + 1, 1); }
      break;
    }
    case 'bolt': case 'bolt3': {
      const n = e.kind === 'bolt3' ? 3 : 1;
      if (k < 0.5) for (let i = 0; i < n; i++) { const ox = (i - (n - 1) / 2) * 9; sectpxBolt(ctx, tx + ox + rand(-3, 3), ty - 60, tx + ox * 0.3, ty, e.c1, e.c2, 1 - k); }
      sectpxHalo(ctx, e.c1, tx, ty, 7 * s * (1 - k), 1 - k * 1.3);
      ctx.globalAlpha = 1; sectpxShatter(ctx, tx, ty + 2, 9 * s, Math.floor(e.seed * 10), k, e.c1, e.c2);
      break;
    }
    case 'beam': {
      const a = 1 - k, wd = Math.max(1, Math.round(2 * s * a));
      ctx.globalAlpha = a * 0.5; ctx.fillStyle = e.c2; sectpxLine(ctx, x, y, tx, ty, wd * 2 + 1);
      ctx.globalAlpha = a; ctx.fillStyle = '#fff6c0'; sectpxLine(ctx, x, y, tx, ty, 1);
      sectpxHalo(ctx, e.c1, tx, ty, 5 * s, a);
      break;
    }
    case 'vortex': {
      ctx.globalAlpha = 1 - k * 0.8;
      const fr = sectpxSpiralSheet(sectpxEven(26 * s / 2) * 2, R);
      sectpxBlit(ctx, fr[Math.floor((k * 24) % 8)], tx, ty);
      break;
    }
    case 'shadow': { // 暗影：目标处张开一个小黑洞，再塌缩
      const sc = k < 0.25 ? 0.4 + k / 0.25 * 0.6 : 1 - (k - 0.25) / 0.75 * 0.7;
      sectpxBlit(ctx, rdpxHoleSheet(Math.max(8, Math.round(24 * s * sc / 4) * 4))[Math.floor((G.time * 8) % RDPX_HOLE_N)], tx, ty);
      ctx.fillStyle = e.c2; for (let i = 0; i < 9; i++) { const ph = (k * 2 + i / 9) % 1, r = 16 * (1 - ph), a2 = i * 0.7 + e.seed + ph * 4; ctx.globalAlpha = 0.8; sectpxDot(ctx, tx + Math.cos(a2) * r, ty + Math.sin(a2) * r * 0.45); }
      break;
    }
    case 'quake': { // 地裂：目标脚下裂开岩浆裂谷，碎石跳起
      const fr = rdpxRiftSheet(Math.max(12, Math.round(30 * s / 4) * 4));
      ctx.globalAlpha = Math.min(1, (1 - k) * 3); sectpxBlit(ctx, fr[Math.min(RDPX_RIFT_N - 1, Math.floor(k * RDPX_RIFT_N))], tx, ty + 5);
      ctx.globalAlpha = 1 - k; ctx.fillStyle = e.c1; for (let i = 0; i < 5; i++) sectpxDot(ctx, tx + Math.sin(i * 4 + e.seed) * 10, ty + 2 - Math.sin(k * Math.PI) * 8, 2);
      break;
    }
    case 'boulder': {
      const f = Math.min(1, k * 1.6);
      if (f < 1) done = false; // 下落的石头还用老画法
      else { ctx.globalAlpha = 1; sectpxBlit(ctx, boom(22 * s, hk * 0.95, true), tx, ty); }
      break;
    }
    default: done = false;
  }
  ctx.restore();
  return done;
}

// ---------- 修炼光环：drawDaoAura 先问这里 ----------
function sectpxAura(ctx, p, F) {
  const t = G.time + p.id * 1.37, x = p.x, y = p.y - 7, R = 9 + p.realm * 1.2, a0 = ctx.globalAlpha;
  ctx.save();
  let done = true;
  switch (F.aura) {
    case 'flame': { // 火焰龙卷风：画在弟子身后（之后才画人），境界越高越高越粗
      const W = Math.min(60, sectpxEven(R * 2.2 / 3) * 3), H = Math.min(72, Math.round((24 + p.realm * 3) / 6) * 6);
      ctx.globalAlpha = a0 * 0.8; sectpxBlit(ctx, rdpxTornadoSheet(W, H, -0.8)[Math.floor((((t * 14) % RDPX_TOR_N) + RDPX_TOR_N) % RDPX_TOR_N)], x, p.y + 2, 1);
      break;
    }
    case 'rays': {
      sectpxHalo(ctx, F.c2, x, y, R + 4, a0 * 0.4); sectpxHalo(ctx, F.c1, x, y, R * 0.55, a0 * 0.55);
      ctx.globalAlpha = a0 * 0.6; ctx.fillStyle = F.c2;
      for (let i = 0; i < 8; i++) { const a = t * 0.5 + i * Math.PI / 4; sectpxLine(ctx, x + Math.cos(a) * 5, y + Math.sin(a) * 5, x + Math.cos(a) * (R + 2), y + Math.sin(a) * (R + 2), 1); }
      break;
    }
    case 'candle': {
      sectpxHalo(ctx, F.c1, x, y - 13, R, a0 * 0.35);
      ctx.globalAlpha = a0; sectpxBlit(ctx, rdpxBoomSheet(8, sectpxRamp(F.c1, F.c2), false)[Math.floor((t * 8) % 2)], x, y - 14 + Math.round(Math.sin(t * 9) * 0.6));
      break;
    }
    case 'moon': {
      sectpxHalo(ctx, F.c2, x, y, R + 3, a0 * 0.3);
      ctx.globalAlpha = a0 * 0.95; sectpxBlit(ctx, sectpxMoonSheet(8, F.c1), x, y - 16 - Math.round(Math.sin(t)));
      break;
    }
    case 'sparks': {
      for (let i = 0; i < 3 + p.realm; i++) { if (Math.sin(t * 13 + i * 7) < 0.3) continue; const a = i * 2.3 + Math.floor(t * 6); sectpxBolt(ctx, x + Math.cos(a) * 4, y + Math.sin(a) * 4, x + Math.cos(a) * R, y + Math.sin(a) * R * 0.7, F.c1, F.c2, a0 * 0.9); }
      break;
    }
    default: done = false;
  }
  ctx.restore();
  return done;
}
