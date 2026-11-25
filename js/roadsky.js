// =============================================
//  公路求生：天空、昼夜光照、天气、地区色调
//  天空：三段渐变（夜里深蓝，黄昏地平线橙红、上面一层粉紫），像素太阳（光晕、黄昏变大变红）、
//        有月相的月亮（环形山、月晕）、会闪的星星 + 银河 + 偶尔的流星、飘动的像素云（白天白、黄昏底下被照成橙粉、夜里灰蓝、暴雨时乌云密布）；
//        外星区天上的发光裂缝、辐射区的绿色极光。
//  天气（有渐入渐出）：沙尘暴（整片黄沙雾、三层飞沙、大团沙云、滚过公路的风滚草）、
//        辐射风暴（绿色天光、发光尘埃、落下的辐射灰、绿色闪电）、暴雨（乌云、三层斜雨、路面溅起的水花、湿路反光、闪电）；
//        冰封高原的暴雨变成暴风雪。没有天气时每个地区也有自己的飘浮物（飞沙、灰烬、落叶和雾、荧光尘、小雪、孢子）。
//  地区色调：每个地区一层很淡的整体色调（荒漠暖黄、城郊冷灰、森林灰绿、辐射黄绿、高原冷蓝、外星紫），
//        两个地区交界处 27 公里内平滑过渡；黄昏整个画面偏暖；四角稍暗。
// =============================================
const RDK = { flash: 0, bolt: null, next: 0, lastT: 0, clouds: {}, cloudCol: {} };
function rdkSmooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
// 进入新地区时，上一个地区还剩多少（0~1，前 10% 路程平滑过渡）
function rdkBlend(km) { if (km < RD_BIOME_LEN) return 0; /* 刚开局还在第一个地区：不和「上一个地区」混 */ const into = (km % RD_BIOME_LEN) / RD_BIOME_LEN; return into < 0.1 ? 1 - rdkSmooth(into / 0.1) : 0; }
// 天气强度：刚来时慢慢变强，快结束时慢慢变弱
function rdkWI() {
  const w = G.road && G.road.weather; if (!w) return 0;
  const dur = w.dur || w.left + 1, age = dur - w.left;
  return Math.max(0, Math.min(1, age / 0.6, w.left / 0.6));
}
function rdkQ(c) { const n = parseInt(c.slice(1), 16), q = (v) => Math.min(255, Math.round(v / 8) * 8); return '#' + ((1 << 24) + (q((n >> 16) & 255) << 16) + (q((n >> 8) & 255) << 8) + q(n & 255)).toString(16).slice(1); }
function rdkCircle(g, cx, cy, r, col) { g.fillStyle = col; for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y + r * 0.6)); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }

// ---------- 像素云：先算形状（每个像素是 亮面 / 暗面 / 空），按颜色上色后缓存 ----------
function rdkCloudShape(v) {
  if (RDK.clouds[v]) return RDK.clouds[v];
  const n = 4 + Math.floor(rdHash(v * 7 + 1) * 4), blobs = [];
  let x = 14;
  for (let i = 0; i < n; i++) { const r = 10 + rdHash(v * 13 + i) * 16 * (1 - Math.abs(i - n / 2) / n); blobs.push([x, 40 - r * 0.5, r]); x += r * (0.9 + rdHash(v + i * 3) * 0.5); }
  const W = Math.ceil(x + 24), H = 56, m = new Uint8Array(W * H);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    let inside = false, lit = false;
    for (const b of blobs) { const dx = px - b[0], dy = py - b[1], d = dx * dx + dy * dy; if (d < b[2] * b[2]) { inside = true; if (dy < -b[2] * 0.15 && d < (b[2] - 2) * (b[2] - 2)) lit = true; } }
    if (py > 44) inside = false;
    if (inside) m[py * W + px] = lit ? 1 : ((px + py) & 1) && py < 38 ? 1 : 2;
  }
  for (let px = 0; px < W; px++) for (let py = 1; py < H; py++) if (m[py * W + px] && !m[(py - 1) * W + px]) m[py * W + px] = 3; // 顶上一圈最亮
  return (RDK.clouds[v] = { W, H, m });
}
function rdkCloud(v, c1, c2, c0) {
  const key = v + c0 + c1 + c2;
  if (RDK.cloudCol[key]) return RDK.cloudCol[key];
  if (Object.keys(RDK.cloudCol).length > 60) RDK.cloudCol = {};
  const S = rdkCloudShape(v), cv = createCanvas(S.W, S.H), g = cv.getContext('2d'), im = g.createImageData(S.W, S.H), d = im.data;
  const cs = [0, parseInt(c1.slice(1), 16), parseInt(c2.slice(1), 16), parseInt(c0.slice(1), 16)];
  for (let i = 0; i < S.W * S.H; i++) { const k = S.m[i]; if (!k) continue; const c = cs[k]; d[i * 4] = (c >> 16) & 255; d[i * 4 + 1] = (c >> 8) & 255; d[i * 4 + 2] = c & 255; d[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  return (RDK.cloudCol[key] = cv);
}

// ---------- 天空 ----------
function rdkSky(g, W, gy, b, pb, blend, day, dusk, h) {
  const R = G.road, t = G.time, Q = RD_Q;
  const dt = Math.max(0, Math.min(0.2, t - RDK.lastT)); RDK.lastT = t;
  const sc = (i) => blend > 0 ? rdMix(b.sky[i], pb.sky[i], blend) : b.sky[i];
  const wt = R.weather ? R.weather.type : null, wi = rdkWI();
  let top = rdMix('#0b0d1c', sc(0), day), mid = rdMix('#141a36', rdMix(sc(0), sc(1), 0.55), day), bot = rdMix('#262a52', sc(1), day);
  if (dusk > 0) { mid = rdMix(mid, '#c8607a', dusk * 0.4); bot = rdMix(bot, '#f08a4a', dusk * 0.75); }
  if (wi > 0) {
    const wc = wt === 'dust' ? ['#a87a4c', '#d0a068'] : wt === 'rad' ? ['#46663a', '#9ac06a'] : b.snow ? ['#8a96a4', '#c4ccd6'] : ['#2a303c', '#4e5664'];
    const n = (c) => rdMix(c, '#0b0d1c', (1 - day) * 0.8), k = wi * 0.8;
    top = rdMix(top, n(wc[0]), k); mid = rdMix(mid, n(rdMix(wc[0], wc[1], 0.5)), k); bot = rdMix(bot, n(wc[1]), k);
  }
  const gr = g.createLinearGradient(0, 0, 0, gy);
  gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bot);
  g.fillStyle = gr; g.fillRect(0, 0, W, gy);
  // 星星、银河、流星
  const sa = Math.max(0, (0.6 - day) / 0.6) * (1 - wi);
  if (sa > 0.01) {
    g.globalAlpha = sa * 0.22; g.fillStyle = '#c8d0ff';
    for (let i = 0; i < 260; i++) { const x = rdHash(i * 3.1) * W, y = gy * 0.05 + x * 0.22 + (rdHash(i * 5.7) - 0.5) * gy * 0.18; if (y < gy * 0.8) g.fillRect(Math.round(x), Math.round(y), 1 / Q * 2, 1 / Q * 2); }
    for (let i = 0; i < 110; i++) {
      const x = Math.round(rdHash(i) * W), y = Math.round(rdHash(i + 99) * gy * 0.75), tw = Math.sin(t * (1 + rdHash(i + 3) * 3) + i * 1.7);
      g.globalAlpha = sa * (0.45 + 0.55 * (tw * 0.5 + 0.5)); g.fillStyle = rdHash(i + 7) > 0.85 ? '#ffd890' : rdHash(i + 8) > 0.8 ? '#a8c8ff' : '#f4f4f4';
      g.fillRect(x, y, 1, 1);
      if (rdHash(i + 11) > 0.93 && tw > 0.3) { g.fillRect(x - 1, y, 3, 1 / Q); g.fillRect(x + 0.33, y - 1, 1 / Q, 3); }
    }
    const p = (t % 23) / 1.1; if (p < 1) { const sx = W * (0.25 + rdHash(Math.floor(t / 23)) * 0.6), sy = gy * 0.15; g.globalAlpha = sa * (1 - p); g.fillStyle = '#ffffff'; for (let k = 0; k < 12; k++) { g.globalAlpha = sa * (1 - p) * (1 - k / 12); g.fillRect(Math.round(sx - p * 40 + k * 1.6), Math.round(sy + p * 14 - k * 0.55), 1, 1); } }
    g.globalAlpha = 1;
  }
  // 太阳
  const sunT = (h - 5) / 15;
  if (sunT > 0 && sunT < 1) {
    const sx = W * (0.1 + sunT * 0.8), sy = gy * 0.75 - Math.sin(sunT * Math.PI) * gy * 0.6, dim = wt === 'dust' || wt === 'storm' ? wi : wt === 'rad' ? wi * 0.6 : 0;
    const col = rdMix(wt === 'rad' ? rdMix('#fff2c0', '#d0ff90', wi) : '#fff2c0', '#ff6a3a', dusk), r = 6 + Math.round(dusk * 2);
    g.globalAlpha = (0.45 + dusk * 0.3) * (1 - dim * 0.6); const hs = 34 + dusk * 30; g.drawImage(rdsGlow(rdkQ(col)), sx - hs, sy - hs, hs * 2, hs * 2);
    g.globalAlpha = 0.18 * (1 - dim * 0.7); rdkCircle(g, sx, sy, r + 4, col); g.globalAlpha = 0.3 * (1 - dim * 0.7); rdkCircle(g, sx, sy, r + 2, col);
    g.globalAlpha = 1 - dim * 0.65; rdkCircle(g, sx, sy, r, col); rdkCircle(g, sx - 1, sy - 1, r - 3, rdMix(col, '#ffffff', 0.5));
    g.globalAlpha = 1;
  } else { // 月亮（8 天一轮月相）
    const mt = ((h + 24 - 19) % 24) / 10, mx = W * (0.1 + mt * 0.8), my = gy * 0.7 - Math.sin(Math.min(1, mt) * Math.PI) * gy * 0.55, ph = Math.floor((R.t || 0) / 24) % 8, a = 1 - wi * 0.8;
    g.globalAlpha = 0.35 * a; g.drawImage(rdsGlow('#a8b8f0'), mx - 26, my - 26, 52, 52);
    g.globalAlpha = a; rdkCircle(g, mx, my, 5, '#ecebe0'); g.fillStyle = '#b8b6aa'; g.fillRect(Math.round(mx - 2), Math.round(my - 1), 2, 2); g.fillRect(Math.round(mx + 1), Math.round(my + 2), 1, 1); g.fillRect(Math.round(mx + 2), Math.round(my - 3), 1, 1);
    if (ph !== 4) { const off = ph < 4 ? 2 + ph * 2.2 : -2 - (8 - ph) * 2.2; const lc = rdMix(top, mid, Math.min(1, my / gy * 1.6)); rdkCircle(g, mx + off, my - 0.5, 5, lc); }
    g.globalAlpha = 1;
  }
  // 极光（辐射区 / 辐射风暴）
  const aur = Math.max(b.rad >= 1 ? (1 - blend) : 0, pb.rad >= 1 ? blend : 0, wt === 'rad' ? wi : 0) * (0.35 + (1 - day) * 0.65);
  if (aur > 0.02) for (let k = 0; k < 3; k++) { g.fillStyle = ['#a7f070', '#70f0b0', '#d8ff80'][k]; for (let x = 0; x < W; x += 1) { const y = gy * (0.12 + k * 0.08) + Math.sin(x / 26 + t * 0.4 + k * 2) * 6 + Math.sin(x / 9 - t * 0.7) * 2; g.globalAlpha = aur * 0.22 * (0.5 + 0.5 * Math.sin(x / 40 + t * 0.6 + k)); g.fillRect(x, Math.round(y), 1, 4 + k); } }
  g.globalAlpha = 1;
  // 云
  const storm = wt === 'storm' ? wi : 0, dust = wt === 'dust' ? wi : 0;
  let c1 = rdMix(rdMix('#f8f2e4', sc(1), 0.25), '#ffb070', dusk * 0.7);
  c1 = rdMix(c1, '#2a3050', (1 - day) * 0.85); c1 = rdMix(c1, '#545a66', storm * 0.85); c1 = rdMix(c1, '#c09060', dust * 0.7); if (wt === 'rad') c1 = rdMix(c1, '#7a9a5a', wi * 0.6);
  let c2 = rdMix(c1, rdMix(sc(1), '#3a3a50', 0.5), 0.4); c2 = rdMix(c2, '#c0587a', dusk * 0.45 * day + dusk * 0.2);
  const c0 = rdMix(c1, '#ffffff', 0.35 * day * (1 - storm));
  const qc0 = rdkQ(c0), qc1 = rdkQ(c1), qc2 = rdkQ(c2), n = 5 + Math.round(storm * 12) + Math.round(dust * 2), wind = 3 + storm * 10 + dust * 14, scroll = rdVehX();
  for (let i = 0; i < n; i++) {
    const v = i % 8, cv = rdkCloud(v, qc1, qc2, qc0), cw = cv.width / Q, big = i >= 5 ? 1.0 : 0;
    const span = W + cw + 40, x = ((rdHash(i * 2.3) * span * 3 - scroll * 0.02 * (1 + rdHash(i) * 0.5) - t * wind * (0.5 + rdHash(i + 4))) % span + span) % span - cw - 20;
    const y = big ? gy * (0.02 + rdHash(i + 9) * 0.25) : gy * (0.08 + rdHash(i + 9) * 0.42);
    g.globalAlpha = big ? storm : 0.92;
    g.drawImage(cv, Math.round(x * Q) / Q, Math.round(y * Q) / Q, cw, cv.height / Q);
  }
  g.globalAlpha = 1;
  // 外星区：天上的发光裂缝
  const alien = Math.max(b.alien ? 1 - blend : 0, pb.alien ? blend : 0);
  if (alien > 0.02) {
    const pts = [[0.18, 0.12], [0.27, 0.2], [0.33, 0.16], [0.42, 0.25], [0.5, 0.21], [0.58, 0.3]], pulse = 0.6 + Math.sin(t * 1.3) * 0.25;
    for (let k = 0; k + 1 < pts.length; k++) { const ax = pts[k][0] * W, ay = pts[k][1] * gy, bx = pts[k + 1][0] * W, by = pts[k + 1][1] * gy;
      g.globalAlpha = alien * pulse * 0.35; g.drawImage(rdsGlow('#73eff7'), (ax + bx) / 2 - 20, (ay + by) / 2 - 14, 40, 28);
      g.globalAlpha = alien * pulse; g.fillStyle = '#d8fdff'; const L = Math.ceil(Math.hypot(bx - ax, by - ay)); for (let s = 0; s <= L; s++) g.fillRect(Math.round(ax + (bx - ax) * s / L), Math.round(ay + (by - ay) * s / L), 1, 1); }
    g.globalAlpha = 1;
  }
  // 闪电（暴雨、辐射风暴）
  RDK.flash = Math.max(0, RDK.flash - dt * 2.5);
  if ((wt === 'storm' && !b.snow) || wt === 'rad') {
    if (wi > 0.5 && t > RDK.next) { RDK.flash = 1; RDK.next = t + 3 + Math.random() * 9; const pts = []; let x = W * (0.1 + Math.random() * 0.8), y = 0; while (y < gy * 0.8) { pts.push([x, y]); x += (Math.random() - 0.5) * 8; y += 3 + Math.random() * 5; } RDK.bolt = { pts, br: Math.floor(pts.length * (0.3 + Math.random() * 0.3)), col: wt === 'rad' ? '#c0ff80' : '#f0f4ff' }; }
  } else RDK.next = Math.max(RDK.next, t + 2);
  if (RDK.bolt && RDK.flash > 0.35) {
    const B2 = RDK.bolt; g.globalAlpha = RDK.flash * 0.5; g.drawImage(rdsGlow(B2.col === '#c0ff80' ? '#a7f070' : '#c8d8ff'), B2.pts[0][0] - 40, gy * 0.2, 80, gy * 0.6);
    g.globalAlpha = RDK.flash; g.fillStyle = B2.col;
    const line = (a, c) => { const L = Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1])); for (let s = 0; s <= L; s++) g.fillRect(Math.round(a[0] + (c[0] - a[0]) * s / L), Math.round(a[1] + (c[1] - a[1]) * s / L), 1, 1); };
    for (let k = 0; k + 1 < B2.pts.length; k++) line(B2.pts[k], B2.pts[k + 1]);
    const p0 = B2.pts[B2.br]; if (p0) { let q = p0; for (let k = 1; k < 6; k++) { const nq = [q[0] + k * 2 + 2, q[1] + 4]; line(q, nq); q = nq; } }
    g.globalAlpha = 1;
  }
  return { top, mid, bot };
}

// ---------- 天气 + 各地区的飘浮物 ----------
function rdkWeather(g, W, H, gy, day, b, bi) {
  const R = G.road, t = G.time, w = R.weather, wi = rdkWI(), Q = RD_Q;
  const P = (i, s) => rdHash(i * 1.7 + s * 13.1);
  const fall = (i, s, spdX, spdY, ph) => { const x = ((P(i, s) * W * 3 + t * spdX * (0.6 + P(i, s + 1) * 0.8)) % W + W) % W, y = ((P(i, s + 2) * H * 3 + t * spdY * (0.6 + P(i, s + 3) * 0.8)) % H + H) % H; return [x + Math.sin(t * 1.3 + i + (ph || 0)) * 3 * (ph != null ? 1 : 0), y]; };
  // 地区飘浮物（有天气时变少）
  const k = 1 - wi;
  if (k > 0.05) {
    if (bi === 0) { g.fillStyle = '#e8c890'; for (let i = 0; i < 14; i++) { const p = fall(i, 1, -90, 0); const y = gy - 4 + P(i, 5) * 26; g.globalAlpha = 0.35 * k; g.fillRect(Math.round(p[0]), Math.round(y), 3 + P(i, 6) * 5, 1 / Q); } }
    else if (bi === 1) { for (let i = 0; i < 26; i++) { const p = fall(i, 2, -14, 9, 0); g.globalAlpha = 0.5 * k; g.fillStyle = i % 7 === 0 ? '#e8e0cc' : '#8a8680'; g.fillRect(Math.round(p[0]), Math.round(p[1]), i % 7 === 0 ? 2 : 1 / Q * 2, i % 7 === 0 ? 1 : 1 / Q * 2); } }
    else if (bi === 2) {
      for (let i = 0; i < 4; i++) { const x = ((P(i, 3) * W * 2 - t * 4 - rdVehX() * 0.3) % (W + 120) + W + 120) % (W + 120) - 60, y = gy - 18 - P(i, 4) * 20; g.globalAlpha = 0.14 * k; g.drawImage(rdsGlow('#d0d0b8'), x - 60, y - 14, 120, 28); }
      for (let i = 0; i < 20; i++) { const p = fall(i, 3, -18, 14, 1); g.globalAlpha = 0.8 * k; g.fillStyle = ['#b0683a', '#8a5a2a', '#c09040', '#6a7a3a'][i % 4]; g.fillRect(Math.round(p[0]), Math.round(p[1]), Math.sin(t * 4 + i) > 0 ? 2 : 1, 1); }
    }
    else if (bi === 3) { for (let i = 0; i < 26; i++) { const p = fall(i, 4, -6, -6, 2); g.globalAlpha = (0.4 + 0.4 * Math.sin(t * 2 + i)) * k; g.fillStyle = '#c8ff90'; g.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1); if (i % 5 === 0) { g.globalAlpha *= 0.4; g.drawImage(rdsGlow('#a7f070'), p[0] - 4, p[1] - 4, 8, 8); } } }
    else if (bi === 4) { g.fillStyle = '#ffffff'; for (let i = 0; i < 50; i++) { const p = fall(i, 5, -10, 16, 3); g.globalAlpha = (0.5 + P(i, 9) * 0.5) * k; g.fillRect(Math.round(p[0]), Math.round(p[1]), P(i, 8) > 0.8 ? 1 : 2 / Q, P(i, 8) > 0.8 ? 1 : 2 / Q); } }
    else { for (let i = 0; i < 24; i++) { const p = fall(i, 6, -5, -8, 4), c = i % 3 ? '#73eff7' : '#f070ff'; g.globalAlpha = (0.5 + 0.4 * Math.sin(t * 2.5 + i)) * k; g.fillStyle = c; g.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1); g.globalAlpha *= 0.5; g.drawImage(rdsGlow(c), p[0] - 3, p[1] - 3, 6, 6); } }
    g.globalAlpha = 1;
  }
  if (!w || wi <= 0) return;
  if (w.type === 'dust') {
    const hz = g.createLinearGradient(0, 0, 0, H); hz.addColorStop(0, 'rgba(200,150,95,' + (0.45 * wi) + ')'); hz.addColorStop(gy / H, 'rgba(214,164,108,' + (0.55 * wi) + ')'); hz.addColorStop(1, 'rgba(190,140,90,' + (0.25 * wi) + ')');
    g.fillStyle = hz; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) { const x = ((P(i, 20) * W * 3 - t * 70 * (0.6 + P(i, 21))) % (W + 240) + W + 240) % (W + 240) - 120, y = gy - 10 - P(i, 22) * 70, s = 60 + P(i, 23) * 70; g.globalAlpha = 0.3 * wi; g.drawImage(rdsGlow('#d8a868'), x - s, y - s * 0.4, s * 2, s * 0.8); }
    const L = [[40, 140, 3, 0.45], [60, 220, 6, 0.55], [26, 320, 10, 0.7]];
    for (let l = 0; l < 3; l++) { g.fillStyle = l === 2 ? '#f0d8a8' : '#e0c088'; for (let i = 0; i < L[l][0]; i++) { const p = fall(i, 30 + l, -L[l][1], 6); g.globalAlpha = L[l][3] * wi; g.fillRect(Math.round(p[0]), Math.round(p[1]), L[l][2], l === 2 ? 1 : 1 / Q * 2); } }
    for (let k2 = 0; k2 < 2; k2++) { const p = ((t / 6 + k2 * 0.5) % 1), x = W + 20 - p * (W + 40), y = gy + 1 + k2 * 6 - Math.abs(Math.sin(p * 26)) * 7, a0 = -t * 7; g.globalAlpha = wi; g.fillStyle = '#7a5a36'; for (let s = 0; s < 14; s++) { const an = a0 + s / 14 * 6.283, r = 3 + (s % 3) * 0.6; g.fillRect(Math.round((x + Math.cos(an) * r) * Q) / Q, Math.round((y - 3.5 + Math.sin(an) * r) * Q) / Q, 1 / Q * 2, 1 / Q * 2); } }
  } else if (w.type === 'rad') {
    g.fillStyle = 'rgba(150,230,90,' + ((0.1 + Math.sin(t * 2.2) * 0.04) * wi) + ')'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) { const p = fall(i, 40, -20, 10, 5); g.globalAlpha = 0.55 * wi; g.fillStyle = '#9aa888'; g.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1); }
    for (let i = 0; i < 40; i++) { const p = fall(i, 41, -30, -12, 6); g.globalAlpha = (0.5 + 0.5 * Math.sin(t * 3 + i)) * wi; g.fillStyle = '#d8ff90'; g.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1); if (i % 4 === 0) { g.globalAlpha *= 0.5; g.drawImage(rdsGlow('#a7f070'), p[0] - 5, p[1] - 5, 10, 10); } }
  } else if (b.snow) { // 暴风雪
    g.fillStyle = 'rgba(220,230,240,' + (0.3 * wi) + ')'; g.fillRect(0, 0, W, H);
    const L = [[90, -60, 30, 1 / Q * 2, 0.5], [80, -120, 50, 1, 0.7], [40, -200, 80, 2, 0.85]];
    g.fillStyle = '#ffffff'; for (let l = 0; l < 3; l++) for (let i = 0; i < L[l][0]; i++) { const p = fall(i, 50 + l, L[l][1], L[l][2], 7); g.globalAlpha = L[l][4] * wi; g.fillRect(Math.round(p[0]), Math.round(p[1]), L[l][3], L[l][3]); }
  } else { // 暴雨
    g.fillStyle = 'rgba(18,24,40,' + (0.25 * wi) + ')'; g.fillRect(0, 0, W, H);
    const L = [[70, 260, 3, 0.3], [90, 340, 5, 0.45], [50, 430, 8, 0.65]];
    for (let l = 0; l < 3; l++) { g.fillStyle = l === 2 ? '#c8d8ec' : '#9ab0c8'; for (let i = 0; i < L[l][0]; i++) { const p = fall(i, 60 + l, -L[l][1] * 0.3, L[l][1]); g.globalAlpha = L[l][3] * wi; for (let s = 0; s < L[l][2]; s++) g.fillRect(Math.round(p[0] + s * 0.3), Math.round(p[1] - s), 1 / Q * (l === 2 ? 3 : 2), 1); } }
    // 湿路反光 + 水花
    g.globalAlpha = 0.1 * wi; g.fillStyle = '#c0d4ec'; for (let y = gy - 8; y < gy + 8; y += 3) g.fillRect(0, y, W, 1 / Q);
    const fr = Math.floor(t * 12);
    g.fillStyle = '#d8e4f4'; for (let i = 0; i < 26; i++) { const x = rdHash(fr * 31 + i) * W, y = gy - 8 + rdHash(fr * 17 + i * 3) * 16; g.globalAlpha = 0.8 * wi; g.fillRect(x - 1, y - 1 / Q, 1 / Q, 1 / Q); g.fillRect(x + 1 / Q, y - 1 / Q, 1 / Q, 1 / Q); g.fillRect(x, y - 2 / Q, 1 / Q, 1 / Q); g.fillRect(x + 2 / Q, y - 2 / Q, 1 / Q, 1 / Q); }
  }
  g.globalAlpha = 1;
}

// ---------- 整体色调（地区、黄昏、闪电、暗角） ----------
const RDK_GRADE = ['#f0a860', '#8a96a8', '#9aa478', '#a8e070', '#a8c8ec', '#b480e8'];
function rdkGrade(g, W, H, gy, bi, pi, blend, day, dusk) {
  const col = blend > 0 ? rdMix(RDK_GRADE[bi], RDK_GRADE[pi], blend) : RDK_GRADE[bi];
  g.globalCompositeOperation = 'soft-light';
  g.globalAlpha = 0.28 * (0.4 + 0.6 * day); g.fillStyle = col; g.fillRect(0, 0, W, H);
  if (dusk > 0.02) { g.globalAlpha = dusk * 0.4; g.fillStyle = '#ff8048'; g.fillRect(0, 0, W, H); }
  g.globalCompositeOperation = 'source-over';
  if (RDK.flash > 0.01) { g.globalAlpha = RDK.flash * 0.3; g.fillStyle = RDK.bolt && RDK.bolt.col === '#c0ff80' ? '#c0ff80' : '#e8f0ff'; g.fillRect(0, 0, W, H); }
  g.globalAlpha = 1;
  if (!RDK.vig || RDK.vig.w !== W || RDK.vig.h !== H) { const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(10,8,20,0)'); vg.addColorStop(1, 'rgba(10,8,20,0.32)'); RDK.vig = { w: W, h: H, g: vg }; }
  g.fillStyle = RDK.vig.g; g.fillRect(0, 0, W, H);
}
// 夜里车灯在雨、沙、雪里照出的光柱
function rdkBeam(g, gy, day) {
  const wi = rdkWI(), a = (1 - day) * wi; if (a < 0.03) return;
  const ax = RDV.ax, st = G.road.st || rdStats(), reach = st.light ? 150 : 70;
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.16 * a;
  const gr = g.createLinearGradient(ax, 0, ax + reach, 0); gr.addColorStop(0, '#fff0c8'); gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(ax, gy - 10); g.lineTo(ax + reach, gy - 30); g.lineTo(ax + reach, gy + 12); g.lineTo(ax, gy - 4); g.fill();
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}
