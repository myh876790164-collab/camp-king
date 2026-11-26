// =============================================
//  公路求生：副本主题（矿洞、鬼城、军阀基地、外星人基地）—— 画面、目标物、主题怪、规则
//  每个主题往 RDX_THEMES 里加一项（框架见 js/roaddungeon.js）：
//    drawBack 自己画背景 + 路面（预先画好的长条图，和公路风景一样缓存）
//    drawObjs 目标物（矿点、矿车、塌方、灯笼、大门、能量核心……）
//    enter / tick / onKill / hud / bonus 规则
// =============================================
const RDY_CACHE = {};
function rdyBlit(g, L, sc, baseY, W, lit) { // 世界坐标里平铺一张长条图（baseY = 图里 y=0 那一行在画面上的位置）
  const Q = RD_Q, tw = L.cv.width / Q, off = ((sc % tw) + tw) % tw;
  for (let x = -off; x < W; x += tw) {
    g.drawImage(L.cv, Math.round(x * Q) / Q, baseY - L.base / Q, tw, L.cv.height / Q);
    if (lit) for (const l of L.lights) { const lx = x + l.x / Q; if (lx < -10 || lx > W + 10) continue; lit.push({ x: lx, y: baseY + l.y / Q, kind: l.kind, col: l.col, r: l.r, ph: l.ph, a: 1, a2: 0 }); }
  }
}
function rdyLayer(B) { return { cv: rdsToCanvas(B), lights: B.lights, base: B.base }; }
function rdySprite(key, w, h, ox, oy, fn) { if (RDY_CACHE[key]) return RDY_CACHE[key]; const B = rdcPaper(w, h, ox, oy); fn(B); rdcOutline(B); return (RDY_CACHE[key] = rdcToCanvas(B)); }
function rdyDraw(g, S, x, y, flip) { const Q = RD_Q; g.save(); g.translate(Math.round(x * Q) / Q, Math.round(y * Q) / Q); if (flip) g.scale(-1, 1); g.drawImage(S.cv, -S.ox / Q, -S.oy / Q, S.cv.width / Q, S.cv.height / Q); g.restore(); }
function rdyBar(g, x, y, w, p, col) { g.fillStyle = '#1a120c'; g.fillRect(x - w / 2 - 0.34, y - 0.34, w + 0.67, 2); g.fillStyle = col; g.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, p)), 1.33); }
function rdyRnd(a, b) { return a + Math.random() * (b - a); }
// 底下补一块地面色（长条图不够高时）
function rdyFillBelow(g, L, gy, W, H, col) { const y = gy + (L.cv.height - L.base) / RD_Q - 1; if (y < H) { g.fillStyle = col; g.fillRect(0, y, W, H - y); } }

// ================= 矿洞 =================
const RDY_ROCK = ['#7a6a58', '#625444', '#4c4034', '#382e24', '#241c16'];
function rdyMineTiles() {
  if (RDY_CACHE.mine) return RDY_CACHE.mine;
  const s = 71, TW = RDS_TW, Rk = rdsR(RDY_ROCK), Wd = rdsR(['#b08458', '#8a6440', '#66482c', '#44301c']);
  // ---- 后墙：岩层、裂缝、矿脉闪光，每隔一段一副木支架 + 吊灯 ----
  const B = rdsPaper(330);
  for (let x = 0; x < TW; x++) for (let y = -330; y < 12; y++) {
    const i = (y + B.base) * TW + x, n = rdtN2(x, y, 48, 24, s);
    let v = 1.3 + (n - 0.5) * 1.5 + (Math.floor((y + rdtN2(x, 0, 96, 1, s + 1) * 20) / 7) & 1) * 0.35 + (y < -250 ? (-250 - y) / 60 : 0);
    if (Math.abs(rdtN2(x, y, 32, 12, s + 2) - 0.5) < 0.02) v += 1.3;
    const h = rdcHash(x, y, s); if (h < 0.05) v += 0.6; else if (h > 0.96) v -= 0.6;
    if (h > 0.9985) { B.c[i] = h > 0.9993 ? 0x73e0f0 : 0xf0c050; B.m[i] = 3; continue; }
    B.c[i] = rdsPick(Rk, v, x, y); B.m[i] = 2;
  }
  for (let k = 0; k < 4; k++) {
    const x0 = k * 384 + 60;
    for (const px of [x0, x0 + 150]) for (let y = -206; y < 12; y++) for (let j = 0; j < 9; j++) rdsPx(B, px + j, y, rdsPick(Wd, 0.3 + j / 9 * 2.4 + ((y + 400) % 23 === 0 ? 0.8 : 0), px + j, y), 1);
    for (let x = x0 - 8; x < x0 + 168; x++) for (let y = -216; y < -204; y++) rdsPx(B, x, y, rdsPick(Wd, (y + 216) / 12 * 2.6, x, y), 1);
    rdsLine(B, x0 + 9, -150, x0 + 40, -204, Wd[2], 1); rdsLine(B, x0 + 150, -150, x0 + 120, -204, Wd[2], 1);
    const lx = x0 + 79; rdsLine(B, lx, -204, lx, -186, 0x2a2420, 2); rdsRect(B, lx - 4, -186, 9, 3, 0x3a3430, 1); rdsRect(B, lx - 3, -183, 7, 5, 0xffd890, 3); rdsPx(B, lx, -181, 0xffffff, 3); rdsLight(B, lx, -180, 'win', '#ffc870', 7);
  }
  rdsOutline(B, rdsC(RDC_PAL.out), rdsC(RDC_PAL.out2));
  const back = rdyLayer(B);
  // ---- 近处：矿石堆、木箱、油桶、报废矿车 ----
  const N = rdsPaper(170);
  for (let k = 0; k < 9; k++) {
    const x = rdsRand(s + 3, k) * TW, t = k % 4;
    if (t === 0) { rdsRock(N, x, 50, 26, Rk, s + k, { strata: 4 }); for (let j = 0; j < 10; j++) rdsPx(N, x - 20 + rdsRand(s, k * 10 + j) * 40, -4 - rdsRand(s + 9, k * 10 + j) * 20, j % 3 ? 0xf0c050 : 0x8ae0f0, 3); }
    else if (t === 1) { for (let c = 0; c < 2; c++) { const cx = x + c * 26; for (let xx = 0; xx < 24; xx++) for (let y = -22 - c * 4; y < 0; y++) rdsPx(N, cx + xx, y, rdsPick(Wd, 1 + (xx % 8 === 0 ? 1.2 : 0) + (y + 22) / 22, cx + xx, y), 1); } }
    else if (t === 2) { rdsCol(N, x, 0, -26, 16, RDT_RUST, s + k, { bands: 8 }); rdsCol(N, x + 18, 0, -26, 16, rdsR(['#5a6a7a', '#44525e', '#303a44']), s + k, { bands: 8 }); }
    else { rdsPoly(N, [[x - 26, -30], [x + 26, -30], [x + 20, -6], [x - 20, -6]], (px, py, tt) => rdsPick(RDT_RUST, 0.5 + tt * 2.4, px, py), 1); for (const wx of [x - 12, x + 12]) rdtEllipse(N, wx, -4, 5, 5, (px, py, d) => rdsPx(N, px, py, d < 0.3 ? 0x8a8478 : 0x2a2420, 1)); }
  }
  for (let k = 0; k < 6; k++) { const x = rdsRand(s + 4, k) * TW, L = 30 + rdsRand(s + 5, k) * 60; for (let y = -170; y < -170 + L; y++) rdsPx(N, x + Math.round(Math.sin(y * 0.2) * 1.2), y, k % 2 ? 0x3a3430 : 0x5a4a3a, 2); }
  rdsOutline(N, rdsC(RDC_PAL.out), rdsC(RDC_PAL.out2));
  const near = rdyLayer(N);
  // ---- 地面 + 铁轨（车就开在铁轨上） ----
  const F = rdtPaper(TW, 75, 400), Gr = rdtRamp('#6a5640');
  for (let x = 0; x < TW; x++) for (let y = -42; y < 400; y++) { const i = (y + F.base) * TW + x; let v = 2 + (rdtN2(x, y, 48, 20, s + 6) - 0.5) * 1.6; const h = rdcHash(x, y, s + 8); if (h < 0.07) v += 0.8; else if (h > 0.95) v -= 0.8; F.c[i] = rdsPick(Gr, v + (y > 30 ? 0.5 : 0), x, y); F.m[i] = 2; }
  for (let x = 0; x < TW; x++) { for (let y = -3; y <= -1; y++) rdsPx(F, x, y, y === -3 ? 0xa8a49a : 0x5a5650, 2); for (let y = 12; y <= 15; y++) rdsPx(F, x, y, y === 12 ? 0xd8d4c8 : y === 13 ? 0x8a867c : 0x4a4640, 2); }
  for (let x = 0; x < TW; x += 30) { for (let xx = 0; xx < 16; xx++) for (let y = 16; y < 22; y++) rdsPx(F, x + xx, y, rdsPick(Wd, 1 + (y - 16) / 6 * 1.5 + (xx === 15 ? 1 : 0), x + xx, y), 1); rdsPx(F, x + 4, 14, 0x2a2622, 2); rdsPx(F, x + 11, 14, 0x2a2622, 2); }
  rdtGroundBits(F, 0, Gr, s);
  const floor = rdyLayer(F);
  return (RDY_CACHE.mine = { back, near, floor });
}
function rdyOre(kind) { return rdySprite('ore' + kind, 60, 44, 30, 40, (B) => { rdyRockC(B, 0, 0, 44, 26, RDY_ROCK); const C = [['#f0d070', '#c8a040'], ['#8ae8f8', '#4ab0c8'], ['#f09070', '#c05040'], ['#7a7064', '#5a5248']][kind]; for (let k = 0; k < 6; k++) { const x = -14 + k * 6, h = 6 + (k % 3) * 4; rdcPoly(B, [[x - 2, -10 - (k % 2) * 4], [x + 1, -10 - h - (k % 2) * 4], [x + 3, -10 - (k % 2) * 4]], C, kind === 3 ? 2 : 4); } }); }
function rdyRockC(B, cx, by, w, h, R) { for (let y = -h; y <= 0; y++) for (let x = -w / 2; x <= w / 2; x++) { const nx = x / (w / 2), ny = (y + h * 0.5) / (h * 0.6); if (nx * nx + ny * ny > 1 + (rdcHash(x, y, 4) - 0.5) * 0.2) continue; rdcPix(B, Math.round(cx + x), Math.round(by + y), rdcRampAt(R, 0.2 + nx * 0.3 + (y + h) / h * 0.5, x, y), 2); } }
function rdyCart() { return rdySprite('cart', 90, 60, 45, 52, (B) => { rdcPoly(B, [[-30, -40], [30, -40], [24, -12], [-24, -12]], RDT_RUST.map((c) => '#' + c.toString(16).padStart(6, '0')), 2); rdcRect(B, -32, -42, 64, 3, '#8a867c', 2); for (let x = -22; x <= 22; x += 11) rdcLine(B, x, -38, x * 0.8, -14, '#5a3018', 2); for (let k = 0; k < 7; k++) rdgBall(B, -18 + k * 6, -44 - (k % 3) * 3, 4, k % 3 ? ['#f0d070', '#c8a040', '#8a6a20'] : ['#8a8070', '#6a6050', '#4a4438']); for (const wx of [-16, 16]) { rdgBall(B, wx, -6, 6, ['#6a645e', '#4a443e', '#2c2722']); rdcPix(B, wx, -6, '#c8c4bc', 2); } }); }

// 矿洞专用怪的样子
Object.assign(RDN_BUILD, {
  digworm(B, fr, atk) { for (let k = 0; k < 5; k++) { const x = -18 + k * 7, y = -6 - Math.round(Math.sin(fr * 1.57 + k * 0.9) * 2) - (k === 4 ? (atk ? 14 : 8) : k === 3 ? 3 : 0); rdnBlob(B, x, y, 6, 6, ['#9a7a8a', '#7a5a6a', '#5a3e4e', '#3a2632']); for (let j = -3; j <= 3; j += 3) rdcPix(B, x + j, y - 5, '#c8a8b0', 1); }
    const hx = 14, hy = atk ? -22 : -16; for (let k = 0; k < 9; k++) rdcLine(B, hx, hy - 5 + k, hx + 12 - Math.abs(k - 4) * 2, hy, k % 2 ? '#c8c4bc' : '#8a867c', 1); rdnEye(B, hx - 2, hy - 4, '#ff9a50', 2); },
  cavebug(B, fr, atk) { const up = atk ? -2 : 0; for (let k = 0; k < 3; k++) { const ph = (fr + k) % 2 ? 2 : -2, lx = -6 + k * 6; rdcLine(B, lx, -3, lx + ph, 0, '#2a2018', 1); } rdnBlob(B, -3, -6 + up, 9, 5, ['#8a7a5a', '#6a5a3e', '#4a3e28', '#2e2618']); rdnBlob(B, -7, -6 + up, 4, 3, ['#fff0a0', '#ffd060', '#c89020'], 4); rdcLine(B, -4, -10 + up, 4, -10 + up, '#3a3020', 1); rdnBlob(B, 7, -5 + up, 3, 3, ['#6a5a3e', '#4a3e28']); rdcLine(B, 9, -7 + up, 13, -11 + up, '#2a2018', 1); rdnEye(B, 8, -6 + up, '#ffd060', 1); },
});

Object.assign(RDX_THEMES, {
  mine: {
    name: '矿洞', dur: 210, color: '#e8a040', hour: 19.3, biomes: [0, 1, 4], npcGoal: 1.0,
    desc: ['一条废弃的地下矿道，铁轨一路通向深处', '矿点前「刹车」停下就会自动开采；矿车顶着往前推', '头顶出现裂缝说明要塌方——刹车或冲刺躲开'],
    goals: '挖矿（每处 +50）、推矿车（每辆 +100）、杀敌、活到最后',
    pool: ['cavebug', 'digworm', 'roach', 'spider'], waveGap: [6, 9], hpMul: 0.9, dmgMul: 0.55,
    slots: ['engine', 'util'], partFilter: (p) => ['engine', 'util', 'tank'].includes(p.slot) || (p.slot === 'in' && p.kind === 'bench'),
    res: { gold: { scrap: 90, ammo: 20, power: 20 }, silver: { scrap: 55, ammo: 10 }, bronze: { scrap: 30 }, fail: { scrap: 8 } },
    enter(D) {
      const X = (d) => (D.baseKm + d) * RD_PX_KM;
      for (let d = 4; d < 150; d += rdyRnd(8, 13)) D.objs.push({ k: 'ore', x: X(d) + 30, prog: 0, kind: Math.floor(Math.random() * 3) });
      for (let d = 18; d < 140; d += rdyRnd(30, 40)) D.objs.push({ k: 'cart', x: X(d), pushed: 0 });
      D.caveT = 14; D.ore = 0; D.carts = 0;
    },
    tick(D, dt) {
      const R = G.road, vx = rdVehX(), L = rdVeh().len, stopped = R.speedNow < 3; D.note = ''; D.creep = false;
      for (const o of D.objs) {
        if (o.k === 'ore' && !o.done && o.x > vx - 8 && o.x < vx + 120) { // 矿点在车头前面
          if (o.x > vx + 40) { D.note = '前方有矿点：按「刹车」，车会停在它跟前开采'; D.creep = true; continue; }
          if (stopped) { o.prog += dt / 2.5; if (Math.random() < 0.3) rdSpark(o.x + (Math.random() - 0.5) * 12, -10, '#f0d070'); if (o.prog >= 1) { o.done = true; D.goal += 50; D.ore++; rdFloat(o.x, -30, '矿石 +50 分', '#f0d070'); sfx('coin'); } }
          else D.note = '矿点就在车头前：「刹车」停下开采';
        }
        if (o.k === 'cart' && !o.done && vx + 2 >= o.x - 12 && o.x - 12 > vx - 40) { const nx = vx + 14; o.pushed += Math.max(0, nx - o.x); o.x = Math.max(o.x, nx); if (o.pushed > 3 * RD_PX_KM) { o.done = true; D.goal += 100; D.carts++; rdFloat(o.x, -40, '矿车送达 +100 分', '#e8a040'); sfx('coin'); } else D.note = '推着矿车走：再推 ' + Math.max(0, 3 - o.pushed / RD_PX_KM).toFixed(1) + ' 公里'; }
        if (o.k === 'cave') {
          o.t -= dt;
          if (o.t <= 0 && !o.fell) { o.fell = true; o.life = 6; G.shake = 0.4; for (let k = 0; k < 14; k++) rdBurst(o.x + (Math.random() - 0.5) * 60, -60, '#7a6a58', 2);
            if (vx > o.x - 34 && vx - L < o.x + 34 && !D.out) { rdHurtVehicle(22 * (1 + D.realKm / 2400)); rdFloat(vx - L / 2, -30, '被落石砸中！', '#ef7d57'); }
            for (const m of R.mons) if (Math.abs(m.x - o.x) < 34) rdHitMon(m, 200, null); }
          if (o.fell) o.life -= dt;
          if (!o.fell && vx > o.x - 60 && vx - L < o.x + 40) D.note = '头顶要塌方了！刹车或冲刺躲开';
        }
      }
      D.objs = D.objs.filter((o) => !(o.k === 'cave' && o.fell && o.life <= 0));
      D.caveT -= dt; if (D.caveT <= 0 && D.t < D.dur - 8) { D.caveT = rdyRnd(16, 26); D.objs.push({ k: 'cave', x: vx + rdyRnd(150, 230), t: 3.2 }); }
    },
    drawBack(g, D, W, H, gy, day, scroll) {
      const T = rdyMineTiles(), lit = [];
      g.fillStyle = '#16110c'; g.fillRect(0, 0, W, gy);
      rdyBlit(g, T.back, scroll * 0.3, gy - 10, W, lit); rdyBlit(g, T.near, scroll * 0.6, gy - 12, W, lit); rdyBlit(g, T.floor, scroll, gy, W, lit);
      rdyFillBelow(g, T.floor, gy, W, H, '#3a2e22');
      rdsDrawLights(g, lit, day); RDS_LIT = lit;
    },
    drawObjs(g, D, gy) {
      const t = G.time;
      for (const o of D.objs) {
        const x = rdSX(o.x); if (x < -60 || x > RDV.W + 60) continue;
        if (o.k === 'ore') { rdyDraw(g, rdyOre(o.done ? 3 : o.kind), x, gy - 1); if (!o.done) { if (o.prog > 0) rdyBar(g, x, gy - 20, 16, o.prog, '#f0d070'); else if (Math.sin(t * 4 + o.x) > 0.6) { g.globalAlpha = 0.6; g.drawImage(rdsGlow(['#f0d070', '#8ae8f8', '#f09070'][o.kind]), x - 6, gy - 16, 12, 12); g.globalAlpha = 1; } } }
        else if (o.k === 'cart') { rdyDraw(g, rdyCart(), x, gy + 4); if (!o.done) rdyBar(g, x, gy - 20, 18, o.pushed / (3 * RD_PX_KM), '#e8a040'); }
        else if (o.k === 'cave') {
          if (!o.fell) { const a = 0.35 + Math.sin(t * 12) * 0.2; g.globalAlpha = a; for (let k = -34; k < 34; k += 4) { g.fillStyle = (k >> 2) & 1 ? '#e04a3a' : '#2a1a10'; g.fillRect(x + k, gy - 1, 4, 2); } g.globalAlpha = 1; g.fillStyle = '#d8c8a8'; for (let k = 0; k < 6; k++) { const p = (t * 1.5 + k / 6) % 1; g.fillRect(x - 30 + rdHash(k + o.x) * 60, (gy - 70) + p * 60, 0.67, 1); } rdyTextW(g, Math.ceil(o.t) + '', x, gy - 40); }
          else { g.fillStyle = '#5a4a3a'; for (let k = 0; k < 9; k++) { const rx = x - 30 + rdHash(k * 3 + o.x) * 60, rs = 3 + rdHash(k + o.x) * 4; g.fillRect(rx - rs / 2, gy - rs + 2, rs, rs); } }
        }
      }
    },
    hud(ctx, D) { drawText(ctx, '矿石 ' + D.ore + ' · 矿车 ' + D.carts, 10, G.sw < G.sh ? 160 : 122, 12, '#e8a040', 'left'); },
    bonus(D, tier, rewards) { if (D.ore > 0 && tier !== 'fail') { const n = rdGain('scrap', D.ore * 5); if (n) rewards.push({ res: 'scrap', n }); } },
  },
});
// 世界坐标里写一个小数字（塌方倒计时等）
function rdyTextW(g, s, x, y) { g.save(); g.font = 'bold 8px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 2; g.strokeStyle = '#24160f'; g.strokeText(s, x, y); g.fillStyle = '#ffd860'; g.fillText(s, x, y); g.restore(); }
