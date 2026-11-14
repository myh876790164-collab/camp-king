// =============================================
//  修仙门派：门派山头地图（布局、地形、手绘殿宇图层、弟子小人、各种仙气特效）
//  地图只有本门山头：主峰 / 宗主峰 / 炼丹峰 / 炼器峰 / 演武场 / 典籍峰，另有灵泉、松林、山门
// =============================================
const SECT_W = 64, SECT_H = 48;

// 各座山峰：rect = 平台（石板地，可走可建），hall = 殿宇占地（不能走），anchor = 弟子去这里办事的位置
const PEAKS = {
  zhufeng: { name: '主峰', rect: [24, 17, 16, 13], hall: [27, 17, 10, 4], anchor: [32, 28], sign: '玄天殿', roof: '#c9a23a', tiers: 2,
    desc: '宗门根本所在，灵脉汇聚。弟子在此闭关修炼速度更快。' },
  zongzhu: { name: '宗主峰', rect: [26, 3, 12, 7], hall: [28, 3, 8, 3], anchor: [32, 8], sign: '掌教居', roof: '#3b5dc9', tiers: 1,
    desc: '掌门清修之地，山巅可见满月。掌门在此修炼事半功倍；每月十四至十六可采「太阴月华」。' },
  liandan: { name: '炼丹峰', rect: [4, 6, 13, 9], hall: [5, 6, 6, 3], anchor: [11, 12], sign: '丹鼎阁', roof: '#b13e53', tiers: 1,
    desc: '丹炉昼夜不熄。派弟子炼丹，可把灵草炼成各种丹药；炉火旁可采「丙火之气」。' },
  lianqi: { name: '炼器峰', rect: [47, 6, 13, 9], hall: [53, 6, 6, 3], anchor: [52, 12], sign: '神工坊', roof: '#566c86', tiers: 1,
    desc: '地火锻炉。派弟子炼器，可用玄铁炼出法器；炉边可采「庚金之气」。' },
  yanwu: { name: '演武场', rect: [44, 32, 15, 10], hall: [48, 32, 7, 2], anchor: [51, 38], sign: '演武', roof: '#ef7d57', tiers: 1,
    desc: '弟子切磋比斗之地，演武可提升实战经验（战力）；雷雨天可在此引「紫霄雷气」。' },
  dianji: { name: '典籍峰', rect: [4, 31, 13, 10], hall: [6, 31, 7, 4], anchor: [11, 38], sign: '藏经阁', roof: '#38b764', tiers: 3,
    desc: '收藏本门功法典籍。参悟典籍可积累「悟性」（金丹期体悟神妙必需）；秋季峰顶可采「青冥风气」。' },
};
// 不是山峰的地点
const SECT_SPOTS = {
  forest: { name: '灵松林', anchor: [44, 24], area: [42, 22, 5, 5], desc: '松林幽深，弟子在此采药伐木；春季林中可采「乙木之气」。' },
  spring: { name: '灵泉', anchor: [27, 38], area: [25, 37, 4, 2], desc: '山涧灵泉，可采「癸水之气」。' },
  gate: { name: '山门', anchor: [32, 45], area: [31, 44, 3, 2] },
};
const SECT_HUB = [32, 32];
const SPRING_C = [23, 41], SPRING_R = 3.2;
// 从山脚广场（hub）到各处的石阶小路（弟子沿着这些点走）
const SECT_PATHS = {
  zhufeng: [[32, 32], [32, 28]],
  zongzhu: [[32, 32], [22, 33], [21, 24], [21, 17], [25, 12], [31, 11], [32, 8]],
  liandan: [[32, 32], [22, 33], [19, 22], [13, 16], [11, 12]],
  lianqi: [[32, 32], [42, 33], [44, 22], [51, 16], [52, 12]],
  yanwu: [[32, 32], [40, 34], [46, 37], [51, 38]],
  dianji: [[32, 32], [24, 34], [17, 37], [11, 38]],
  forest: [[32, 32], [42, 33], [43, 27], [44, 24]],
  spring: [[32, 32], [30, 35], [27, 38]],
  gate: [[32, 32], [32, 45]],
};
function sectLoc(id) { return PEAKS[id] || SECT_SPOTS[id]; }
function sectLocName(id) { const l = sectLoc(id); return l ? l.name : id; }

// 可复现的随机数（读档后画面一致）
function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function sectBorder(x, y) {
  const d = Math.min(x, y, SECT_W - 1 - x, SECT_H - 1 - y);
  if (y >= SECT_H - 3 && x >= 30 && x <= 34) return false; // 山门出口
  return d < 2;
}
function isCliffRow(x, y) {
  for (const k in PEAKS) {
    const [px, py, pw, ph] = PEAKS[k].rect;
    if (y === py + ph && x >= px && x < px + pw) return true;
  }
  return false;
}
// 固定的器物（丹炉、锻炉、兵器架）：不能走、不能建
const SECT_PROPS = [
  { kind: 'furnace', rect: [12, 8, 2, 2] },
  { kind: 'forge', rect: [49, 8, 2, 2] },
  { kind: 'rack', rect: [45, 33, 2, 1] },
  { kind: 'rack', rect: [56, 33, 2, 1] },
];
// 每座平台下方两角各一盏石灯
for (const k in PEAKS) { const [px, py, pw, ph] = PEAKS[k].rect; SECT_PROPS.push({ kind: 'lantern', rect: [px + 1, py + ph - 1, 1, 1] }, { kind: 'lantern', rect: [px + pw - 2, py + ph - 1, 1, 1] }); }

// ---------- 地图生成 ----------
function sectMapGen() {
  const N = MAP_W * MAP_H, ter = G.terrain;
  const set = (x, y, t) => { if (inMap(x, y)) ter[idx(x, y)] = t; };
  ter.fill(TER.GRASS);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (sectBorder(x, y)) set(x, y, TER.LOT);
  // 灵泉
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (Math.hypot(x + 0.5 - SPRING_C[0], (y + 0.5 - SPRING_C[1]) * 1.25) < SPRING_R) set(x, y, TER.WATER);
  }
  // 山峰平台 + 平台下方的崖壁 + 殿宇
  for (const k in PEAKS) {
    const p = PEAKS[k], [px, py, pw, ph] = p.rect;
    for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) set(x, y, TER.PAVE);
    for (let x = px; x < px + pw; x++) set(x, py + ph, TER.LOT);
    const [hx, hy, hw, hh] = p.hall;
    for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) set(x, y, TER.LOT);
  }
  for (const pr of SECT_PROPS) { const [x0, y0, w, h] = pr.rect; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, TER.LOT); }
  // 石阶小路：只铺在草地和崖壁上（穿过崖壁的地方变成台阶）
  for (const k in SECT_PATHS) {
    const pts = SECT_PATHS[k];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay);
      const rad = k === 'zhufeng' ? 1.1 : 0.45;
      for (let s = 0; s <= L * 4; s++) {
        const t = s / (L * 4), cx = ax + (bx - ax) * t + 0.5, cy = ay + (by - ay) * t + 0.5;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = Math.floor(cx + dx * rad), y = Math.floor(cy + dy * rad);
          if (!inMap(x, y)) continue;
          const t0 = ter[idx(x, y)];
          if (t0 === TER.GRASS || (t0 === TER.LOT && (isCliffRow(x, y) || (sectBorder(x, y) && k === 'gate')))) set(x, y, TER.DIRT);
        }
      }
    }
  }
  // 山脚广场
  for (let y = 31; y <= 33; y++) for (let x = 29; x <= 35; x++) if (ter[idx(x, y)] === TER.GRASS || ter[idx(x, y)] === TER.DIRT) set(x, y, TER.DIRT);
  // 溪流：西南群山的瀑布流下来，汇入灵泉
  for (let i = 0; i + 1 < SECT_STREAM.length; i++) {
    const [ax, ay] = SECT_STREAM[i], [bx, by] = SECT_STREAM[i + 1], L = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s <= L * 4; s++) { const t = s / (L * 4), x = Math.floor(ax + (bx - ax) * t + 0.5), y = Math.floor(ay + (by - ay) * t + 0.5); if (inMap(x, y) && ter[idx(x, y)] === TER.GRASS) set(x, y, TER.WATER); }
  }
  // 点缀：凉亭、石碑、竹林、梅树、香炉（只放在草地上，不挡路）
  G.sectDecor = [];
  for (const d of SECT_DECOR) {
    const [x0, y0, w, h] = d.rect;
    let ok = true;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const t = terrainAt(x, y); if (d.onPlaza ? t !== TER.PAVE : t !== TER.GRASS) ok = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (terrainAt(x + dx, y + dy) === TER.DIRT && !d.onPlaza) ok = false; }
    if (!ok) continue;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, TER.LOT);
    G.sectDecor.push(d);
  }
  // 几块山石
  const rocks = [[19, 26, 2, 2], [38, 13, 2, 2], [8, 22, 3, 2], [56, 24, 2, 2], [38, 42, 2, 2], [15, 44, 2, 1]];
  for (const [x0, y0, w, h] of rocks) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (ter[idx(x, y)] === TER.GRASS) set(x, y, TER.LOT);
  G.coreX = 31; G.coreY = 24; // 宗门香鼎（2×2）放在主峰广场
  // 资源点
  sectScatter('lingpine', 120, (x, y) => (x >= 39 && x <= 47 && y >= 16 && y <= 30) || Math.random() < 0.35);
  sectScatter('herb', 26, (x, y) => Math.hypot(x - SPRING_C[0], y - SPRING_C[1]) < 9 || (x < 20 && y > 14 && y < 31) || Math.random() < 0.15);
  sectScatter('orevein', 16, (x, y) => (x > 44 && y < 31) || Math.random() < 0.1);
  sectScatter('spiritvein', 9, (x, y) => (Math.min(x, y, SECT_W - 1 - x, SECT_H - 1 - y) < 5));
}

// 画地面时用：殿宇和器物下面当作石板地，群山、山石、崖壁下面当作草地（避免边缘混出奇怪的斑块）
function sectNatTer() {
  // 读档时地图生成不会重跑：从地形里还原点缀（凉亭、竹林……）
  G.sectDecor = SECT_DECOR.filter((d) => { const [x0, y0, w, h] = d.rect; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (terrainAt(x, y) !== TER.LOT) return false; return true; });
  const nt = new Uint8Array(G.terrain);
  const inPlat = (x, y) => { for (const k in PEAKS) { const [px, py, pw, ph] = PEAKS[k].rect; if (x >= px && x < px + pw && y >= py && y < py + ph) return true; } return false; };
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    if (nt[i] !== TER.LOT) continue;
    nt[i] = inPlat(x, y) || inHallOrProp(x, y) ? TER.PAVE : TER.GRASS;
  }
  G.natTer = nt;
}
// 只在草地上、离小路和地点有点距离的地方放资源点
function sectNodeOk(x, y) {
  if (x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2) return false;
  const i = idx(x, y);
  if (G.nodes[i] || G.bld[i] || G.terrain[i] !== TER.GRASS) return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (terrainAt(x + dx, y + dy) === TER.DIRT) return false;
  for (const k in SECT_SPOTS) { const a = SECT_SPOTS[k].anchor; if (Math.hypot(x - a[0], y - a[1]) < 2.5) return false; }
  return true;
}
function sectPlaceNode(type, x, y) {
  if (!sectNodeOk(x, y)) return false;
  const def = G.def.nodes[type];
  G.nodes[idx(x, y)] = { type, x, y, amount: def.amount || 1, max: def.amount || 1, shakeUntil: 0, searchedUntil: 0 };
  return true;
}
function sectScatter(type, count, prefer) {
  let n = 0, tries = 0;
  while (n < count && tries < count * 60) {
    tries++;
    const x = randInt(2, MAP_W - 3), y = randInt(2, MAP_H - 3);
    if (!prefer(x, y)) continue;
    if (sectPlaceNode(type, x, y)) n++;
  }
}
// 每月：资源点慢慢长回来
function sectRegrow() {
  const want = { lingpine: 6, herb: 4, orevein: 1, spiritvein: 0.4 };
  for (const type in want) {
    let k = want[type];
    if (k < 1) { if (Math.random() > k) continue; k = 1; }
    const list = G.nodes.filter((n) => n && n.type === type);
    for (let i = 0, tries = 0; i < k && tries < 60; tries++) {
      let x, y;
      if (list.length && Math.random() < 0.8) { const n = pick(list); x = n.x + randInt(-1, 1); y = n.y + randInt(-1, 1); }
      else { x = randInt(2, MAP_W - 3); y = randInt(2, MAP_H - 3); }
      if (type === 'spiritvein' && Math.min(x, y, SECT_W - 1 - x, SECT_H - 1 - y) >= 5) continue;
      if (sectPlaceNode(type, x, y)) i++;
    }
  }
}

// ---------- 手绘图层（殿宇、崖壁、石阶、群山、灵泉装饰） ----------
function buildSectLayer() {
  const S = 32, c = createCanvas(MAP_W * S, MAP_H * S), g = c.getContext('2d');
  const rng = seededRng((G.sect && G.sect.seed) || 7);
  const R = (a, b) => a + rng() * (b - a);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const terA = (x, y) => terrainAt(x, y);
  // 群山（地图四周）：先铺底色，再叠圆润的山石和松林剪影
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (sectBorder(x, y) && terA(x, y) === TER.LOT) P(x * S, y * S, S, S, '#2f3d39');
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!sectBorder(x, y) || terA(x, y) !== TER.LOT) continue;
    const bx = x * S, by = y * S;
    for (let k = 0; k < 2; k++) {
      const ex = bx + R(4, 28), ey = by + R(6, 26), rx = R(10, 17), ry = R(8, 12);
      g.fillStyle = pick2(rng, ['#43524b', '#4b5b53', '#3d4b45']); g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.ellipse(ex - rx * 0.25, ey - ry * 0.35, rx * 0.6, ry * 0.45, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(95,138,74,0.55)'; g.beginPath(); g.ellipse(ex - rx * 0.2, ey - ry * 0.7, rx * 0.5, ry * 0.22, 0, 0, 7); g.fill();
    }
  }
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!sectBorder(x, y) || terA(x, y) !== TER.LOT) continue;
    const bx = x * S, by = y * S;
    if (!sectBorder(x, y + 1) && y < MAP_H - 1) { P(bx, by + S - 4, S, 4, 'rgba(15,22,22,0.55)'); }
    if (rng() < 0.7) sectPineSil(g, bx + R(4, 28), by + R(12, 30), R(11, 18), pick2(rng, ['#1f3a2c', '#27453a', '#234032']));
  }
  // 群山内侧投下的阴影
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (sectBorder(x, y) || terA(x, y) === TER.LOT) continue;
    const near = sectBorder(x - 1, y) || sectBorder(x + 1, y) || sectBorder(x, y - 1);
    if (near) P(x * S, y * S, S, S, 'rgba(10,20,25,0.18)');
  }
  // 山石
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (terA(x, y) !== TER.LOT || sectBorder(x, y) || isCliffRow(x, y) || inHallOrProp(x, y) || isDecor(x, y)) continue;
    const bx = x * S, by = y * S;
    g.fillStyle = 'rgba(10,15,25,0.3)'; g.beginPath(); g.ellipse(bx + 16, by + 27, 16, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#5b6168'; g.beginPath(); g.ellipse(bx + 16, by + 17, 15, 12, 0, 0, 7); g.fill();
    g.fillStyle = '#7a8088'; g.beginPath(); g.ellipse(bx + 13, by + 13, 10, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#5f8a4a'; g.beginPath(); g.ellipse(bx + 12, by + 8, 7, 3, 0, 0, 7); g.fill();
    P(bx + 20, by + 18, 6, 2, '#4a4f56');
  }
  // 青石板小路（沿路线画平滑的曲线）
  g.save();
  g.beginPath(); g.rect(0, 0, MAP_W * S, MAP_H * S);
  for (const k in PEAKS) { const [px, py, pw, ph] = PEAKS[k].rect; g.rect(px * S, py * S, pw * S, ph * S); }
  g.clip('evenodd'); // 平台上不画小路
  g.lineJoin = 'round'; g.lineCap = 'round';
  const strokePath = (pts, w, col, dash) => {
    g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []);
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo((x + 0.5) * S, (y + 0.5) * S) : g.moveTo((x + 0.5) * S, (y + 0.5) * S))); g.stroke();
  };
  // 底下一条踩实的土路，上面一块块青石板
  for (const k in SECT_PATHS) strokePath(SECT_PATHS[k], (k === 'zhufeng' ? 2.6 : 1.35) * S, 'rgba(92,74,48,0.55)');
  g.setLineDash([]);
  const slab = (cx, cy, ang, w, h) => {
    g.save(); g.translate(cx, cy); g.rotate(ang);
    g.fillStyle = 'rgba(40,32,22,0.45)'; g.fillRect(-w / 2 + 1, -h / 2 + 2, w, h);
    g.fillStyle = pick2(rng, ['#a8a290', '#b3ad9b', '#9d9785', '#aba591']); g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-w / 2, -h / 2, w, 2);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-w / 2, h / 2 - 2, w, 2);
    if (rng() < 0.25) { g.fillStyle = 'rgba(95,138,74,0.6)'; g.fillRect(-w / 2 + R(2, w - 6), -h / 2 + R(1, h - 3), 4, 2); }
    g.restore();
  };
  for (const k in SECT_PATHS) {
    const pts = SECT_PATHS[k], wide = k === 'zhufeng';
    for (let i = 0; i + 1 < pts.length; i++) {
      const ax = (pts[i][0] + 0.5) * S, ay = (pts[i][1] + 0.5) * S, bx = (pts[i + 1][0] + 0.5) * S, by = (pts[i + 1][1] + 0.5) * S;
      const L = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax) + Math.PI / 2, n = Math.max(1, Math.round(L / (S * 0.62)));
      for (let s = 0; s <= n; s++) {
        const t = s / n, cx = ax + (bx - ax) * t + R(-1.5, 1.5), cy = ay + (by - ay) * t + R(-1.5, 1.5);
        if (wide) { slab(cx - Math.cos(ang) * S * 0.55, cy - Math.sin(ang) * S * 0.55, ang + R(-0.05, 0.05), S * 1.05, S * 0.48); slab(cx + Math.cos(ang) * S * 0.55, cy + Math.sin(ang) * S * 0.55, ang + R(-0.05, 0.05), S * 1.05, S * 0.48); }
        else slab(cx, cy, ang + R(-0.12, 0.12), S * R(0.95, 1.1), S * R(0.42, 0.52));
      }
    }
  }
  g.restore();
  {
    const [hx, hy] = SECT_HUB, cx = (hx + 0.5) * S, cy = (hy + 0.6) * S;
    g.fillStyle = 'rgba(92,74,48,0.55)'; g.beginPath(); g.ellipse(cx, cy, 3.3 * S, 1.55 * S, 0, 0, 7); g.fill();
    g.fillStyle = '#aba591'; g.beginPath(); g.ellipse(cx, cy, 3.05 * S, 1.35 * S, 0, 0, 7); g.fill();
    g.strokeStyle = '#8a8472'; g.lineWidth = 2;
    for (const r of [0.45, 0.8]) { g.beginPath(); g.ellipse(cx, cy, 3.05 * S * r, 1.35 * S * r, 0, 0, 7); g.stroke(); }
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; g.beginPath(); g.moveTo(cx + Math.cos(a) * 3.05 * S * 0.45, cy + Math.sin(a) * 1.35 * S * 0.45); g.lineTo(cx + Math.cos(a) * 3.05 * S, cy + Math.sin(a) * 1.35 * S); g.stroke(); }
    g.fillStyle = '#c9a23a'; g.beginPath(); g.ellipse(cx, cy, 0.9 * S, 0.4 * S, 0, 0, 7); g.fill();
    g.fillStyle = '#e8d08a'; g.beginPath(); g.ellipse(cx, cy - 2, 0.7 * S, 0.28 * S, 0, 0, 7); g.fill();
  }
  // 崖壁 + 台阶
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!isCliffRow(x, y)) continue;
    const bx = x * S, by = y * S, t = terA(x, y);
    if (t === TER.LOT) {
      const grd = g.createLinearGradient(0, by, 0, by + S);
      grd.addColorStop(0, '#7f7c6c'); grd.addColorStop(1, '#4f4d43');
      g.fillStyle = grd; g.fillRect(bx, by, S, S);
      for (let k = 0; k < 3; k++) P(bx + R(2, 28), by + R(6, 14), 2, R(8, 16), 'rgba(40,38,30,0.45)');
      P(bx, by, S, 3, '#a8a494'); P(bx, by + 3, S, 2, '#5f8a4a');
      for (let k = 0; k < 3; k++) P(bx + R(0, 30), by + 5, 2, R(2, 6), '#4c7a40');
      P(bx, by + S - 3, S, 3, 'rgba(20,20,20,0.35)');
    } else if (t === TER.DIRT) {
      P(bx, by, S, S, '#8c8778');
      for (let k = 0; k < 4; k++) { P(bx + 1, by + k * 8, S - 2, 6, '#c2bdac'); P(bx + 1, by + k * 8 + 6, S - 2, 2, '#6e6a5e'); }
      if (isCliffRow(x - 1, y) && terA(x - 1, y) === TER.LOT) P(bx, by, 3, S, '#5d5a4e');
      if (isCliffRow(x + 1, y) && terA(x + 1, y) === TER.LOT) P(bx + S - 3, by, 3, S, '#5d5a4e');
    }
  }
  // 平台边缘的白玉栏杆（左右两侧）
  for (const k in PEAKS) {
    const [px, py, pw, ph] = PEAKS[k].rect;
    for (let y = py; y < py + ph; y++) {
      for (const x of [px, px + pw - 1]) {
        const out = x === px ? x - 1 : x + 1;
        if (terA(out, y) === TER.DIRT || inHallOrProp(x, y)) continue;
        const bx = x * S + (x === px ? 2 : S - 6);
        P(bx, y * S, 4, S, '#d8d4c8'); P(bx + 3, y * S, 1, S, '#8f8b80');
        P(bx - 1, y * S + 2, 6, 4, '#ece8dc');
      }
    }
  }
  // 灵泉：岸边石头和荷叶
  for (let k = 0; k < 18; k++) {
    const a = rng() * Math.PI * 2, r = SPRING_R + R(0.1, 0.6);
    const x = (SPRING_C[0] + Math.cos(a) * r) * S, y = (SPRING_C[1] + Math.sin(a) * r / 1.25) * S;
    if (terA(Math.floor(x / S), Math.floor(y / S)) === TER.DIRT) continue;
    g.fillStyle = '#6d7480'; g.beginPath(); g.ellipse(x, y, R(5, 9), R(4, 6), 0, 0, 7); g.fill();
    g.fillStyle = '#9aa1ad'; g.beginPath(); g.ellipse(x - 1, y - 2, R(3, 5), R(2, 3), 0, 0, 7); g.fill();
  }
  for (let k = 0; k < 9; k++) {
    const a = rng() * Math.PI * 2, r = R(0.6, SPRING_R - 0.8);
    const x = (SPRING_C[0] + Math.cos(a) * r) * S, y = (SPRING_C[1] + Math.sin(a) * r / 1.25) * S;
    g.fillStyle = '#3f8a4a'; g.beginPath(); g.ellipse(x, y, 7, 5, 0, 0.3, 6.1); g.lineTo(x, y); g.fill();
    if (rng() < 0.4) { g.fillStyle = '#f7a8c8'; g.beginPath(); g.ellipse(x + 2, y - 2, 3, 2.5, 0, 0, 7); g.fill(); P(x + 1, y - 3, 2, 2, '#fff2f8'); }
  }
  // 演武场：地面上的太极阵和石擂台
  {
    const [px, py, pw, ph] = PEAKS.yanwu.rect, cx = (px + pw / 2) * S, cy = (py + ph / 2 + 1) * S;
    P(cx - 110, cy - 60, 220, 120, 'rgba(120,90,60,0.25)');
    g.strokeStyle = '#c9b48a'; g.lineWidth = 4; g.strokeRect(cx - 110, cy - 60, 220, 120);
    g.fillStyle = '#e8e2d0'; g.beginPath(); g.arc(cx, cy, 40, 0, 7); g.fill();
    g.fillStyle = '#2b2b33'; g.beginPath(); g.arc(cx, cy, 40, -Math.PI / 2, Math.PI / 2); g.arc(cx, cy + 20, 20, Math.PI / 2, -Math.PI / 2, true); g.arc(cx, cy - 20, 20, Math.PI / 2, -Math.PI / 2); g.fill();
    g.fillStyle = '#e8e2d0'; g.beginPath(); g.arc(cx, cy + 20, 6, 0, 7); g.fill();
    g.fillStyle = '#2b2b33'; g.beginPath(); g.arc(cx, cy - 20, 6, 0, 7); g.fill();
    g.strokeStyle = '#8f6a42'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 44, 0, 7); g.stroke();
    // 木人桩
    for (const [dx, dy] of [[-150, -20], [-150, 40], [150, -20], [150, 40]]) {
      P(cx + dx - 4, cy + dy - 20, 8, 26, '#8f6a42'); P(cx + dx - 10, cy + dy - 12, 20, 4, '#6e4a2e'); P(cx + dx - 3, cy + dy - 26, 6, 7, '#a8794f');
    }
  }
  // 器物
  for (const pr of SECT_PROPS) {
    const [x0, y0, w, h] = pr.rect, bx = x0 * S, by = y0 * S;
    if (pr.kind === 'furnace') {
      g.fillStyle = 'rgba(10,15,25,0.35)'; g.beginPath(); g.ellipse(bx + 32, by + 58, 30, 7, 0, 0, 7); g.fill();
      P(bx + 14, by + 40, 6, 18, '#5a4628'); P(bx + 44, by + 40, 6, 18, '#5a4628'); P(bx + 29, by + 44, 6, 14, '#4a3820');
      g.fillStyle = '#8a6a2e'; g.beginPath(); g.ellipse(bx + 32, by + 34, 24, 16, 0, 0, 7); g.fill();
      g.fillStyle = '#b08a3e'; g.beginPath(); g.ellipse(bx + 28, by + 30, 16, 9, 0, 0, 7); g.fill();
      P(bx + 10, by + 18, 44, 6, '#6a5022'); P(bx + 12, by + 16, 40, 3, '#c9a23a');
      P(bx + 6, by + 12, 6, 10, '#6a5022'); P(bx + 52, by + 12, 6, 10, '#6a5022');
      P(bx + 24, by + 34, 16, 6, '#3a2810'); P(bx + 26, by + 35, 12, 4, '#ef7d57');
      g.strokeStyle = '#5a4628'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx + 16, by + 30); g.lineTo(bx + 48, by + 30); g.stroke();
    } else if (pr.kind === 'forge') {
      g.fillStyle = 'rgba(10,15,25,0.35)'; g.beginPath(); g.ellipse(bx + 32, by + 58, 30, 6, 0, 0, 7); g.fill();
      P(bx + 4, by + 20, 30, 38, '#5b5e6a'); P(bx + 4, by + 20, 30, 4, '#8d909c');
      P(bx + 10, by + 34, 18, 14, '#2b1a14'); P(bx + 12, by + 38, 14, 10, '#ef7d57'); P(bx + 15, by + 42, 8, 6, '#ffcd75');
      P(bx + 12, by + 4, 12, 18, '#4a4d58'); P(bx + 10, by + 2, 16, 4, '#6b6e7a');
      P(bx + 40, by + 40, 20, 8, '#3b3e4a'); P(bx + 44, by + 48, 12, 10, '#2b2e38'); P(bx + 38, by + 38, 24, 4, '#6b6e7a');
    } else if (pr.kind === 'lantern') {
      g.fillStyle = 'rgba(10,15,25,0.3)'; g.beginPath(); g.ellipse(bx + 16, by + 29, 10, 3, 0, 0, 7); g.fill();
      P(bx + 9, by + 24, 14, 5, '#9a968a'); P(bx + 13, by + 14, 6, 10, '#b5b0a2');
      P(bx + 9, by + 8, 14, 7, '#c8c3b4'); P(bx + 12, by + 10, 8, 3, '#ffcd75');
      g.fillStyle = '#8a8678'; g.beginPath(); g.moveTo(bx + 5, by + 9); g.lineTo(bx + 27, by + 9); g.lineTo(bx + 16, by + 1); g.fill();
      P(bx + 15, by - 1, 2, 3, '#8a8678');
    } else if (pr.kind === 'rack') {
      P(bx + 4, by + 6, 4, 24, '#6e4a2e'); P(bx + w * S - 8, by + 6, 4, 24, '#6e4a2e'); P(bx + 2, by + 10, w * S - 4, 3, '#8f6a42'); P(bx + 2, by + 22, w * S - 4, 3, '#8f6a42');
      for (let k = 0; k < 5; k++) { const sx = bx + 12 + k * 9; P(sx, by + 2, 2, 26, k % 2 ? '#c8d6e5' : '#94b0c2'); P(sx - 1, by + 20, 4, 3, '#b13e53'); }
    }
  }
  // 瀑布所在的崖壁
  drawWaterfallCliff(g, S);
  // 点缀
  for (const d of G.sectDecor || []) drawSectDecor(g, d, S, rng);
  // 殿宇
  for (const k in PEAKS) drawSectHall(g, PEAKS[k], S, k);
  // 山门牌坊
  drawSectGate(g, S);
  G.sectLayer = c;
  // 冬天的积雪层（按季节调透明度叠上去）
  const sc = createCanvas(MAP_W * S, MAP_H * S), sg = sc.getContext('2d');
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = terA(x, y);
    if (t !== TER.GRASS && !(t === TER.LOT && (sectBorder(x, y) || isCliffRow(x, y)))) continue; // 只积在草地、群山、崖顶上
    const bx = x * S, by = y * S;
    sg.fillStyle = 'rgba(245,250,255,0.85)';
    for (let k = 0; k < 3; k++) { sg.beginPath(); sg.ellipse(bx + R(4, 28), by + R(4, 28), R(5, 10), R(2.5, 5), 0, 0, 7); sg.fill(); }
    if (isCliffRow(x, y)) { sg.fillRect(bx, by, S, 4); }
  }
  for (const k in PEAKS) { const [hx, hy, hw] = PEAKS[k].hall; sg.fillStyle = 'rgba(250,252,255,0.8)'; sg.fillRect(hx * S + 4, hy * S - 4, hw * S - 8, 8); }
  G.sectSnow = sc;
}
// 一些固定点缀
const SECT_STREAM = [[2, 44], [6, 45], [11, 44], [15, 43], [19, 42]];
const SECT_DECOR = [
  { kind: 'pavilion', rect: [36, 36, 2, 2] }, { kind: 'stele', rect: [34, 35, 1, 1] },
  { kind: 'bamboo', rect: [17, 26, 2, 2] }, { kind: 'bamboo', rect: [40, 11, 2, 2] }, { kind: 'bamboo', rect: [8, 24, 2, 1] }, { kind: 'bamboo', rect: [57, 28, 2, 2] },
  { kind: 'plum', rect: [23, 15, 1, 1] }, { kind: 'plum', rect: [41, 16, 1, 1] }, { kind: 'plum', rect: [19, 37, 1, 1] }, { kind: 'plum', rect: [42, 41, 1, 1] }, { kind: 'plum', rect: [25, 11, 1, 1] }, { kind: 'plum', rect: [38, 10, 1, 1] },
  { kind: 'censer', rect: [35, 7, 1, 1], onPlaza: true }, { kind: 'censer', rect: [28, 7, 1, 1], onPlaza: true },
];
function isDecor(x, y) { for (const d of G.sectDecor || []) { const [dx, dy, w, h] = d.rect; if (x >= dx && x < dx + w && y >= dy && y < dy + h) return true; } return false; }
function drawWaterfallCliff(g, S) {
  const P = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(a, b, w, h); };
  const [sx, sy] = SECT_STREAM[0];
  P(0, (sy - 1) * S, sx * S, S * 2.2, '#4f5a55');
  for (let i = 0; i < 6; i++) P(i * 10, (sy - 1) * S + i * 5, 8, 50 - i * 5, 'rgba(30,40,40,0.35)');
  const grd = g.createLinearGradient(0, 0, sx * S, 0); grd.addColorStop(0, '#9fd8ff'); grd.addColorStop(1, '#41a6f6');
  P(S * 0.8, (sy - 1) * S, sx * S - S * 0.8, S * 1.6, grd);
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(sx * S, (sy + 0.6) * S, 14, 6, 0, 0, 7); g.fill();
}
function drawSectDecor(g, d, S, rng) {
  const [x0, y0, w, h] = d.rect, bx = x0 * S, by = y0 * S, W = w * S, H = h * S;
  const P = (a, b, ww, hh, col) => { g.fillStyle = col; g.fillRect(a, b, ww, hh); };
  const O = (x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
  if (d.kind === 'pavilion') {
    O(bx + W / 2, by + H - 4, W / 2, 7, 'rgba(10,15,25,0.3)');
    P(bx + 4, by + H - 14, W - 8, 10, '#bdb8a8'); P(bx + 4, by + H - 14, W - 8, 3, '#dcd7c6');
    for (const px of [bx + 10, bx + W / 2 - 2, bx + W - 14]) { P(px, by + 22, 4, H - 36, '#a8322d'); P(px + 3, by + 22, 1, H - 36, '#7a2020'); }
    P(bx + 8, by + H - 26, W - 16, 3, '#8f6a42');
    g.fillStyle = '#2e6b55'; g.beginPath(); g.moveTo(bx - 4, by + 26); g.quadraticCurveTo(bx + 8, by + 24, bx + 14, by + 12); g.lineTo(bx + W / 2, by - 2); g.lineTo(bx + W - 14, by + 12); g.quadraticCurveTo(bx + W - 8, by + 24, bx + W + 4, by + 26); g.closePath(); g.fill();
    g.fillStyle = '#3f8a6a'; g.beginPath(); g.moveTo(bx + 2, by + 23); g.lineTo(bx + W / 2, by + 2); g.lineTo(bx + W / 2, by + 22); g.fill();
    P(bx + W / 2 - 2, by - 8, 4, 8, '#c9a23a'); O(bx + W / 2, by - 9, 3, 3, '#ffcd75');
  } else if (d.kind === 'stele') {
    O(bx + 16, by + 28, 12, 4, 'rgba(10,15,25,0.3)');
    O(bx + 16, by + 25, 11, 5, '#5b6168'); O(bx + 13, by + 22, 6, 3, '#7a8088'); // 龟趺
    P(bx + 9, by - 10, 14, 34, '#8d909c'); P(bx + 9, by - 10, 14, 3, '#b3b7c2'); P(bx + 20, by - 10, 3, 34, '#6b6e7a');
    g.fillStyle = '#3b3e4a'; for (let i = 0; i < 5; i++) g.fillRect(bx + 12, by - 4 + i * 5, 7, 2);
  } else if (d.kind === 'bamboo') {
    for (let i = 0; i < 9 * w * h / 2; i++) {
      const x = bx + R2(rng, 3, W - 3), base = by + R2(rng, H * 0.5, H), top = base - R2(rng, 30, 46), col = rng() < 0.5 ? '#4c8a3c' : '#5fa04a';
      P(x, top, 2.5, base - top, col);
      for (let yy = top + 6; yy < base; yy += 7) P(x - 0.5, yy, 3.5, 1, '#2f5a28');
      for (let k = 0; k < 3; k++) { g.fillStyle = rng() < 0.5 ? '#6bb050' : '#3f7a35'; g.beginPath(); g.ellipse(x + R2(rng, -6, 8), top + R2(rng, 0, 14), 5, 1.6, R2(rng, -0.6, 0.6), 0, 7); g.fill(); }
    }
  } else if (d.kind === 'plum') {
    O(bx + 16, by + 28, 10, 3, 'rgba(10,15,25,0.3)');
    g.strokeStyle = '#4a2e22'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(bx + 16, by + 28); g.quadraticCurveTo(bx + 12, by + 14, bx + 18, by + 4); g.stroke();
    g.lineWidth = 1.6;
    for (const [a, b, c2, d2] of [[15, 16, 4, 6], [17, 10, 28, 2], [14, 20, 26, 14], [18, 6, 10, -4]]) { g.beginPath(); g.moveTo(bx + a, by + b); g.lineTo(bx + c2, by + d2); g.stroke(); }
  } else if (d.kind === 'censer') {
    O(bx + 16, by + 28, 10, 3, 'rgba(10,15,25,0.3)');
    P(bx + 8, by + 22, 16, 6, '#6a5022'); O(bx + 16, by + 18, 9, 7, '#8a6a2e'); O(bx + 14, by + 16, 5, 3, '#b08a3e');
    P(bx + 6, by + 10, 20, 3, '#6a5022'); P(bx + 7, by + 9, 18, 1.5, '#c9a23a');
    for (const x of [12, 16, 20]) P(bx + x, by + 2, 1, 8, '#8f6a42');
  }
}
function R2(rng, a, b) { return a + rng() * (b - a); }
function pick2(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function inHallOrProp(x, y) {
  for (const k in PEAKS) { const [hx, hy, hw, hh] = PEAKS[k].hall; if (x >= hx && x < hx + hw && y >= hy && y < hy + hh) return true; }
  for (const pr of SECT_PROPS) { const [hx, hy, hw, hh] = pr.rect; if (x >= hx && x < hx + hw && y >= hy && y < hy + hh) return true; }
  return false;
}
function sectPineSil(g, x, y, h, col) {
  g.fillStyle = col;
  for (let k = 0; k < 3; k++) {
    const w = h * (0.55 - k * 0.12), yy = y - k * h * 0.3;
    g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x + w, yy); g.lineTo(x, yy - h * 0.5); g.fill();
  }
  g.fillRect(x - 1, y, 2, 3);
}

// 中式殿宇：台基、红柱、格窗、飞檐屋顶（可多层）、匾额
function drawSectHall(g, peak, S, key) {
  const [hx, hy, hw, hh] = peak.hall, x = hx * S, y = hy * S, W = hw * S, H = hh * S;
  const P = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(a, b, w, h); };
  const roof = peak.roof, roofDk = sectShade(roof, 0.7), roofLt = sectShade(roof, 1.25);
  // 阴影
  P(x + 6, y + H - 2, W, 8, 'rgba(10,15,25,0.3)');
  // 台基 + 台阶
  P(x - 2, y + H - 12, W + 4, 12, '#bdb8a8'); P(x - 2, y + H - 12, W + 4, 3, '#dcd7c6'); P(x - 2, y + H - 2, W + 4, 2, '#7a7668');
  const sw = Math.min(56, W * 0.3);
  for (let k = 0; k < 3; k++) P(x + W / 2 - sw / 2, y + H - 12 + k * 4, sw, 3, k % 2 ? '#cfcab9' : '#e6e1d0');
  const tiers = peak.tiers || 1;
  const wallTop = y + H * (tiers === 3 ? 0.62 : 0.5), wallBot = y + H - 12;
  // 墙身 + 红柱
  P(x + 6, wallTop, W - 12, wallBot - wallTop, '#e2d4b4');
  const cols = Math.max(4, hw + 1), gap = (W - 16) / (cols - 1);
  for (let i = 0; i < cols - 1; i++) {
    const wx = x + 8 + i * gap + 4, ww = gap - 8, mid = i === Math.floor((cols - 1) / 2);
    if (mid) { P(wx, wallTop + 6, ww, wallBot - wallTop - 6, '#5a2e22'); for (let r = 0; r < 3; r++) for (let q = 0; q < 2; q++) P(wx + 4 + q * (ww - 10), wallTop + 12 + r * 8, 2, 2, '#c9a23a'); P(wx + ww / 2 - 1, wallTop + 6, 2, wallBot - wallTop - 6, '#3a1e16'); }
    else {
      P(wx, wallTop + 6, ww, (wallBot - wallTop) * 0.55, '#c9a87a');
      g.strokeStyle = '#6b4a2e'; g.lineWidth = 1;
      for (let gx = wx + 3; gx < wx + ww; gx += 5) { g.beginPath(); g.moveTo(gx, wallTop + 6); g.lineTo(gx, wallTop + 6 + (wallBot - wallTop) * 0.55); g.stroke(); }
      for (let gy = wallTop + 9; gy < wallTop + 6 + (wallBot - wallTop) * 0.55; gy += 5) { g.beginPath(); g.moveTo(wx, gy); g.lineTo(wx + ww, gy); g.stroke(); }
    }
  }
  for (let i = 0; i < cols; i++) { const cx = x + 8 + i * gap; P(cx - 3, wallTop, 6, wallBot - wallTop, '#a8322d'); P(cx + 1, wallTop, 2, wallBot - wallTop, '#7a2020'); }
  P(x + 4, wallTop, W - 8, 5, '#3b6b5a'); P(x + 4, wallTop + 4, W - 8, 2, '#c9a23a'); // 额枋
  // 屋顶（从下往上画每一层）
  const roofLayer = (bx, by, bw, rh) => {
    const ov = 10, lift = 7;
    g.fillStyle = roofDk;
    g.beginPath();
    g.moveTo(bx - ov, by - lift);
    g.quadraticCurveTo(bx - ov * 0.2, by + 2, bx + bw * 0.12, by + 2);
    g.lineTo(bx + bw * 0.88, by + 2);
    g.quadraticCurveTo(bx + bw + ov * 0.2, by + 2, bx + bw + ov, by - lift);
    g.lineTo(bx + bw * 0.82, by - rh);
    g.lineTo(bx + bw * 0.18, by - rh);
    g.closePath(); g.fill();
    g.fillStyle = roof;
    g.beginPath();
    g.moveTo(bx - ov + 4, by - lift - 2);
    g.quadraticCurveTo(bx, by - 2, bx + bw * 0.13, by - 2);
    g.lineTo(bx + bw * 0.87, by - 2);
    g.quadraticCurveTo(bx + bw, by - 2, bx + bw + ov - 4, by - lift - 2);
    g.lineTo(bx + bw * 0.81, by - rh + 3);
    g.lineTo(bx + bw * 0.19, by - rh + 3);
    g.closePath(); g.fill();
    g.strokeStyle = roofDk; g.lineWidth = 1;
    for (let tx = bx + bw * 0.15; tx < bx + bw * 0.86; tx += 4) { g.beginPath(); g.moveTo(tx + (tx - (bx + bw / 2)) * 0.12, by - 3); g.lineTo(tx, by - rh + 4); g.stroke(); }
    P(bx + bw * 0.12, by - 1, bw * 0.76, 3, roofLt);
    P(bx + bw * 0.17, by - rh, bw * 0.66, 5, '#2b2e38'); P(bx + bw * 0.17, by - rh, bw * 0.66, 2, '#566c86');
    for (const ex of [bx + bw * 0.17 - 3, bx + bw * 0.83 - 3]) { P(ex, by - rh - 5, 6, 8, '#c9a23a'); P(ex + (ex < bx + bw / 2 ? -2 : 4), by - rh - 7, 4, 4, '#ffcd75'); }
  };
  if (tiers === 3) {
    const t1 = wallTop - 2;
    roofLayer(x + 2, t1, W - 4, 18);
    P(x + W * 0.2, t1 - 34, W * 0.6, 16, '#e2d4b4'); for (let i = 0; i < 4; i++) P(x + W * 0.2 + i * W * 0.19, t1 - 34, 4, 16, '#a8322d');
    roofLayer(x + W * 0.14, t1 - 32, W * 0.72, 16);
    P(x + W * 0.32, t1 - 62, W * 0.36, 14, '#e2d4b4'); P(x + W * 0.32, t1 - 62, 4, 14, '#a8322d'); P(x + W * 0.68 - 4, t1 - 62, 4, 14, '#a8322d');
    roofLayer(x + W * 0.26, t1 - 60, W * 0.48, 18);
    P(x + W / 2 - 2, t1 - 92, 4, 14, '#c9a23a'); g.fillStyle = '#ffcd75'; g.beginPath(); g.arc(x + W / 2, t1 - 92, 4, 0, 7); g.fill();
  } else if (tiers === 2) {
    roofLayer(x, wallTop - 2, W, 22);
    P(x + W * 0.16, wallTop - 34, W * 0.68, 14, '#e2d4b4');
    for (let i = 0; i < 6; i++) P(x + W * 0.16 + i * W * 0.13, wallTop - 34, 4, 14, '#a8322d');
    roofLayer(x + W * 0.1, wallTop - 30, W * 0.8, 30);
  } else {
    roofLayer(x, wallTop - 2, W, Math.min(40, H * 0.55));
  }
  // 匾额
  g.font = 'bold 12px ' + FONT;
  const tw = g.measureText(peak.sign).width + 14, px = x + W / 2 - tw / 2, py = wallTop + 8;
  P(px - 2, py - 2, tw + 4, 18, '#c9a23a'); P(px, py, tw, 14, '#1d2b53');
  g.fillStyle = '#ffcd75'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(peak.sign, x + W / 2, py + 7.5);
  // 宗主峰：门前松树和仙鹤石像
  if (key === 'zongzhu') { sectPineSil(g, x - 18, y + H + 10, 26, '#2b5a3c'); sectPineSil(g, x + W + 18, y + H + 10, 26, '#2b5a3c'); }
}
function drawSectGate(g, S) {
  const x = 29 * S + 8, y = 43 * S, W = 6 * S - 16;
  const P = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(a, b, w, h); };
  for (const cx of [x + 6, x + W - 18, x + W * 0.33 - 4, x + W * 0.67 - 8]) { P(cx, y - 10, 12, 52, '#a8322d'); P(cx + 8, y - 10, 4, 52, '#7a2020'); P(cx - 4, y + 36, 20, 8, '#bdb8a8'); }
  P(x - 4, y - 18, W + 8, 10, '#3b6b5a'); P(x - 4, y - 10, W + 8, 3, '#c9a23a');
  g.fillStyle = '#2f4f5f'; g.beginPath(); g.moveTo(x - 16, y - 20); g.quadraticCurveTo(x, y - 18, x + 10, y - 28); g.lineTo(x + W - 10, y - 28); g.quadraticCurveTo(x + W, y - 18, x + W + 16, y - 20); g.lineTo(x + W - 6, y - 36); g.lineTo(x + 6, y - 36); g.closePath(); g.fill();
  P(x + 4, y - 38, W - 8, 4, '#2b2e38');
  const name = (G.sect && G.sect.name) || '宗门';
  g.font = 'bold 13px ' + FONT;
  const tw = g.measureText(name).width + 14;
  P(x + W / 2 - tw / 2 - 2, y - 8, tw + 4, 20, '#c9a23a'); P(x + W / 2 - tw / 2, y - 6, tw, 16, '#1d2b53');
  g.fillStyle = '#ffcd75'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, x + W / 2, y + 2);
}
function sectShade(hex, k) {
  const [r, g, b] = hexRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)));
  return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
}

// ---------- 精灵图：资源点 / 建筑 / 图标 / 香鼎 ----------
function bigSprite(w, h, paint) {
  const c = createCanvas(w * 2, h * 2), g = c.getContext('2d');
  g.scale(2, 2);
  const P = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
  const O = (x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
  paint(P, O, g);
  const white = createCanvas(w * 2, h * 2), wg = white.getContext('2d');
  wg.drawImage(c, 0, 0); wg.globalCompositeOperation = 'source-in'; wg.fillStyle = '#fff'; wg.fillRect(0, 0, w * 2, h * 2);
  return { w, h, img: c, flip: c, white };
}
function initSectSprites() {
  const S16 = (paint) => bigSprite(16, 16, paint);
  SPR.lingpine = S16((P, O, g) => {
    P(7, 11, 2, 4, '#5a3e28');
    for (let k = 0; k < 3; k++) { g.fillStyle = k === 0 ? '#1f4a35' : k === 1 ? '#27604a' : '#2f7a5a'; g.beginPath(); g.moveTo(2 + k * 1.5, 12 - k * 3.2); g.lineTo(14 - k * 1.5, 12 - k * 3.2); g.lineTo(8, 4 - k * 1.6); g.fill(); }
    P(6, 4, 1, 1, '#a7f070'); P(9, 7, 1, 1, '#a7f070');
  });
  SPR.herb = S16((P, O) => {
    O(8, 13, 5, 1.6, 'rgba(10,20,10,0.3)');
    for (const [x, h] of [[5, 6], [8, 8], [11, 6], [6.5, 5], [9.5, 5]]) P(x, 13 - h, 1, h, '#38b764');
    O(5, 7, 1.6, 1.2, '#a7f070'); O(11, 7, 1.6, 1.2, '#a7f070'); O(8, 5, 2, 1.6, '#73eff7'); P(7.5, 4.5, 1, 1, '#f4f4f4');
  });
  SPR.orevein = S16((P, O) => {
    O(8, 13, 6, 2, 'rgba(10,10,25,0.35)'); O(8, 10, 6.5, 4.5, '#3b3e4a'); O(7, 8.5, 5, 3, '#566c86');
    P(5, 8, 2, 1, '#c8d6e5'); P(9, 10, 2, 1, '#c8d6e5'); P(10, 7, 1, 1, '#f4f4f4'); P(6, 11, 1, 1, '#94b0c2');
  });
  SPR.spiritvein = S16((P, O, g) => {
    O(8, 13, 6, 2, 'rgba(10,10,25,0.35)'); O(8, 11, 6, 3.5, '#4a4d58');
    for (const [x, h, c] of [[5, 7, '#41a6f6'], [8, 9, '#73eff7'], [11, 6, '#41a6f6']]) { g.fillStyle = c; g.beginPath(); g.moveTo(x - 1.5, 12); g.lineTo(x, 12 - h); g.lineTo(x + 1.5, 12); g.fill(); }
    P(7.5, 5, 1, 2, '#f4f4f4');
  });
  // 建筑
  SPR.s_field = S16((P, O) => {
    P(1, 3, 14, 11, '#5a4628'); P(1, 3, 14, 1, '#7d6a45');
    for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) { P(2.5 + q * 3.3, 5 + r * 3.2, 1, 2, '#38b764'); P(2 + q * 3.3, 4.5 + r * 3.2, 2, 1, '#a7f070'); }
    P(1, 13, 14, 1, '#3a2c18');
  });
  SPR.s_mine = S16((P, O) => {
    O(8, 13, 7, 2, 'rgba(10,10,25,0.35)'); O(8, 10, 7, 5, '#566c86'); P(5, 7, 6, 7, '#1a1c2c');
    P(4, 6, 1.5, 8, '#8f6a42'); P(10.5, 6, 1.5, 8, '#8f6a42'); P(4, 6, 8, 1.5, '#a8794f'); P(7, 12, 2, 1, '#c8d6e5');
  });
  SPR.s_lsmine = S16((P, O, g) => {
    O(8, 13, 7, 2, 'rgba(10,10,25,0.35)'); O(8, 10, 7, 5, '#4a4d58'); P(5, 7, 6, 7, '#1a1c2c');
    P(4, 6, 1.5, 8, '#8f6a42'); P(10.5, 6, 1.5, 8, '#8f6a42'); P(4, 6, 8, 1.5, '#a8794f');
    g.fillStyle = '#73eff7'; g.beginPath(); g.moveTo(7, 13); g.lineTo(8, 9); g.lineTo(9, 13); g.fill();
  });
  SPR.s_lumber = S16((P, O) => {
    O(8, 13.5, 7, 2, 'rgba(10,10,25,0.35)'); P(2, 7, 12, 6, '#8f6a42'); P(2, 7, 12, 1, '#a8794f');
    P(1, 4, 14, 3, '#5a3e28'); P(3, 9, 3, 3, '#5a3e28'); O(11, 11, 2, 2, '#c49a64'); O(11, 11, 1, 1, '#8f6a42');
  });
  SPR.s_array = S16((P, O, g) => {
    O(8, 9, 7, 4.5, '#2b2e38'); O(8, 9, 6, 3.8, '#3b5dc9');
    g.strokeStyle = '#73eff7'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(8, 9, 4.5, 2.8, 0, 0, 7); g.stroke();
    g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.moveTo(8, 9); g.lineTo(8 + Math.cos(a) * 4.5, 9 + Math.sin(a) * 2.8); } g.stroke();
    O(8, 9, 1.4, 1, '#f4f4f4');
    for (const [x, y] of [[2, 9], [14, 9], [8, 5], [8, 13]]) { P(x - 0.7, y - 3, 1.4, 3, '#c8d6e5'); P(x - 0.7, y - 3.6, 1.4, 1, '#73eff7'); }
  });
  SPR.s_dongfu = S16((P, O) => {
    O(8, 13.5, 7, 2, 'rgba(10,10,25,0.35)'); O(8, 9, 7.5, 6, '#5b6168'); O(7, 7, 5, 4, '#7a8088'); O(5, 4, 4, 1.5, '#5f8a4a');
    P(5.5, 8, 5, 6, '#1a1c2c'); O(8, 8, 2.5, 1.5, '#1a1c2c'); P(5, 7, 6, 1, '#a8322d'); P(6, 9, 4, 1.5, '#ffcd75'); P(6.6, 9.2, 2.8, 1, '#a8322d');
  });
  SPR.s_eye = S16((P, O, g) => {
    O(8, 13.5, 6, 2, 'rgba(10,10,25,0.35)'); P(5, 6, 6, 8, '#bdb8a8'); P(5, 6, 6, 1, '#dcd7c6'); P(4, 13, 8, 1.5, '#8d909c');
    O(8, 4, 3, 3, '#41a6f6'); O(7.3, 3.3, 1.2, 1.2, '#f4f4f4');
    g.strokeStyle = 'rgba(115,239,247,0.7)'; g.lineWidth = 0.6; g.beginPath(); g.arc(8, 4, 4.5, 0, 7); g.stroke();
  });
  // 资源图标
  SPR.icon_lingshi = S16((P, O, g) => {
    g.fillStyle = '#1a1c2c'; g.beginPath(); g.moveTo(8, 0.5); g.lineTo(14, 6); g.lineTo(8, 15.5); g.lineTo(2, 6); g.fill();
    g.fillStyle = '#41a6f6'; g.beginPath(); g.moveTo(8, 2); g.lineTo(12.6, 6); g.lineTo(8, 14); g.lineTo(3.4, 6); g.fill();
    g.fillStyle = '#73eff7'; g.beginPath(); g.moveTo(8, 2); g.lineTo(10, 6); g.lineTo(8, 14); g.lineTo(3.4, 6); g.fill();
    P(6, 4, 2, 2, '#f4f4f4');
  });
  SPR.icon_herb = S16((P, O) => {
    P(7.5, 7, 1.5, 8, '#1a1c2c'); P(7.8, 7, 1, 7.5, '#38b764');
    O(5, 7, 3.6, 2.6, '#1a1c2c'); O(11, 6, 3.6, 2.6, '#1a1c2c'); O(5, 7, 2.8, 1.8, '#38b764'); O(11, 6, 2.8, 1.8, '#a7f070');
    O(8, 3, 2.6, 2.6, '#1a1c2c'); O(8, 3, 1.8, 1.8, '#ef7d57'); P(7.5, 2.4, 1, 1, '#ffcd75');
  });
  SPR.icon_ore = S16((P, O) => {
    O(8, 9, 7, 5.5, '#1a1c2c'); O(8, 9, 6, 4.6, '#3b3e4a'); O(7, 8, 4, 3, '#566c86'); P(5, 7, 3, 1.4, '#c8d6e5'); P(10, 10, 2, 1, '#94b0c2');
  });
  SPR.icon_qi = S16((P, O, g) => {
    g.strokeStyle = '#1a1c2c'; g.lineWidth = 3; g.beginPath(); g.arc(8, 8, 5, 0.3, 5.6); g.stroke();
    g.strokeStyle = '#a7f070'; g.lineWidth = 1.6; g.beginPath(); g.arc(8, 8, 5, 0.3, 5.6); g.stroke();
    O(8, 8, 2, 2, '#f4f4f4');
  });
  SPR.icon_fame = S16((P, O, g) => {
    O(8, 8, 6.5, 6.5, '#1a1c2c'); O(8, 8, 5.5, 5.5, '#c9a23a'); O(8, 8, 4, 4, '#ffcd75');
    g.fillStyle = '#b13e53'; g.font = 'bold 6px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('名', 8, 8.3);
  });
  // 宗门香鼎（营地核心，2×2）
  SPR.core_sect = bigSprite(32, 32, (P, O, g) => {
    O(16, 29, 13, 3, 'rgba(10,10,25,0.4)');
    P(3, 24, 26, 5, '#8d909c'); P(3, 24, 26, 1.5, '#bdb8a8');
    P(8, 18, 3, 8, '#5a4628'); P(21, 18, 3, 8, '#5a4628');
    O(16, 16, 11, 8, '#6a5022'); O(16, 15, 10, 7, '#8a6a2e'); O(13, 13, 6, 3.5, '#b08a3e');
    P(5, 8, 22, 4, '#6a5022'); P(6, 7, 20, 1.5, '#c9a23a');
    P(3, 4, 3, 6, '#6a5022'); P(26, 4, 3, 6, '#6a5022'); P(3, 4, 3, 1, '#c9a23a'); P(26, 4, 3, 1, '#c9a23a');
    g.strokeStyle = '#4a3820'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(9, 16); g.quadraticCurveTo(16, 12, 23, 16); g.stroke();
    P(14, 15, 4, 4, '#4a3820'); P(15, 16, 2, 2, '#ffcd75');
    for (const x of [12, 16, 20]) { P(x - 0.5, 1, 1, 7, '#8f6a42'); P(x - 0.5, 0.5, 1, 1, '#ef7d57'); }
  });
  // 模式图标：小楼阁
  SPR.sect_icon = S16((P, O, g) => {
    P(2, 13, 12, 2, '#bdb8a8'); P(4, 8, 8, 5, '#e2d4b4'); P(4, 8, 1.2, 5, '#a8322d'); P(10.8, 8, 1.2, 5, '#a8322d'); P(7, 10, 2, 3, '#5a2e22');
    g.fillStyle = '#38b764'; g.beginPath(); g.moveTo(0.5, 8.5); g.quadraticCurveTo(3, 8, 4, 6); g.lineTo(12, 6); g.quadraticCurveTo(13, 8, 15.5, 8.5); g.lineTo(13, 5); g.lineTo(3, 5); g.fill();
    P(5, 2.5, 6, 2.5, '#e2d4b4');
    g.beginPath(); g.moveTo(2.5, 3.5); g.quadraticCurveTo(4, 3, 5, 1.5); g.lineTo(11, 1.5); g.quadraticCurveTo(12, 3, 13.5, 3.5); g.lineTo(11, 0.5); g.lineTo(5, 0.5); g.fill();
    P(7.5, 0, 1, 1, '#ffcd75');
  });
}

// ---------- 弟子小人（按境界换道袍颜色） ----------
const REALM_ROBE = ['#8a7f6e', '#e6e0cf', '#5fa8d3', '#e0b84a', '#9b6bd3', '#e05050', '#f4f4f4', '#ffcd75'];
function drawCultivator(ctx, p) {
  const hairC = typeof lifeMax === "function" && p.age >= lifeMax(p) * 0.75 ? (p.age >= lifeMax(p) * 0.9 ? "#e8e8f0" : "#9a9aa8") : (p.hair || "#1a1c2c"); // 年老白发
  const x = Math.round(p.x), y = Math.round(p.y);
  const robe = REALM_ROBE[p.realm] || '#8a7f6e', dk = sectShade(robe, 0.72), lt = sectShade(robe, 1.18);
  const sitting = p.pose === 'sit' && !p.moving, moving = p.moving; // 走路时不能保持打坐姿势
  const bob = moving ? -Math.abs(Math.sin(G.time * 9 + p.id)) * 1.2 : 0;
  const f = p.face < 0 ? -1 : 1;
  drawShadow(ctx, x, y + 0.5, sitting ? 13 : 10, 0.85);
  // 光环（金丹以上 / 正在修炼）
  if (p.realm >= 3 || (sitting && p.realm >= 1)) {
    const r = 6 + p.realm * 0.8 + Math.sin(G.time * 3 + p.id) * 0.8;
    const grd = ctx.createRadialGradient(x, y - 7, 0, x, y - 7, r + 4);
    grd.addColorStop(0, 'rgba(255,240,180,0)'); grd.addColorStop(0.6, hexA(robe, 0.18)); grd.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grd; ctx.fillRect(x - r - 4, y - 7 - r - 4, (r + 4) * 2, (r + 4) * 2);
  }
  const P = (a, b, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + (f > 0 ? a : -a - w), y + b + bob, w, h); };
  if (sitting) {
    P(-5, -3, 10, 3, dk); P(-5, -3, 10, 1, robe);           // 盘腿
    P(-3.5, -9, 7, 6, robe); P(-3.5, -9, 1, 6, lt); P(2.5, -9, 1, 6, dk);
    P(-1, -9, 2, 6, p.sash || '#1d2b53');
    P(-4.5, -6, 2, 3, dk); P(2.5, -6, 2, 3, dk); P(-1.5, -5, 3, 1.5, '#f2d0a9'); // 手结印
  } else {
    const step = moving ? Math.sin(G.time * 12 + p.id) * 1.2 : 0;
    P(-2.5 + step, -2, 2, 2, '#2b2e38'); P(0.5 - step, -2, 2, 2, '#2b2e38');
    P(-3.5, -9, 7, 7.5, robe); P(-4, -3, 8, 1.5, dk); P(-3.5, -9, 1, 7, lt); P(2.5, -9, 1, 7, dk);
    P(-3.5, -6, 7, 1.2, p.sash || '#1d2b53');
    P(-5, -8.5, 1.5, 4.5, dk); P(3.5, -8.5, 1.5, 4.5, dk);
    P(-5, -4.2, 1.5, 1.3, '#f2d0a9'); P(3.5, -4.2, 1.5, 1.3, '#f2d0a9');
  }
  // 头
  const hy = sitting ? -13.5 : -13.5;
  P(-2.5, hy, 5, 4.5, '#f2d0a9');
  P(-3, hy - 1, 6, 2, hairC);
  if (p.sex === 'f') { P(-3, hy, 1.2, 6, hairC); P(1.8, hy, 1.2, 6, hairC); P(-1, hy - 2.5, 2, 1.5, hairC); }
  else { P(-1.2, hy - 3, 2.4, 2, hairC); P(-0.4, hy - 3.6, 0.8, 0.8, '#ffcd75'); }
  P(f > 0 ? 0.5 : -1.5, hy + 2, 1, 1, '#1a1c2c'); // 眼
  if (p.head) { P(-3, hy - 2, 6, 1.2, '#ffcd75'); P(-0.6, hy - 4, 1.2, 2, '#ffcd75'); } // 掌门玉冠
  if (p.hurt > 0) { ctx.fillStyle = '#b13e53'; ctx.fillRect(x + 3, y + hy - 3 + bob, 2, 2); }
}
function hexA(hex, a) { const [r, g, b] = hexRgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
