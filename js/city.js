// =============================================
//  城市：建筑模型（用代码画的像素画）、城市地图生成、街景小物件
//  丧尸模式使用。建筑占地是 TER.LOT（走不过去），可以搜索物资
// =============================================

// w/h = 占地格数，ex = 楼顶高出占地的像素（越高的楼越大），search = 能搜几次，
// dur = 每次搜索秒数，danger = 附近游荡的丧尸数，loot = 物资表 [最少, 最多, 概率]
const STRUCTS = {
  house: { name: '民居', w: 3, h: 3, ex: 6, search: 2, dur: 1.6, danger: 1, loot: { food: [2, 6, 0.7], water: [1, 4, 0.6], parts: [1, 3, 0.4], w: 0.07, a: 0.05, c: 0.1 } },
  apartment: { name: '公寓楼', w: 4, h: 4, ex: 16, search: 4, dur: 2, danger: 2, loot: { food: [3, 7, 0.7], water: [2, 5, 0.6], parts: [1, 3, 0.4], w: 0.1, a: 0.06, c: 0.12 } },
  office: { name: '写字楼', w: 4, h: 4, ex: 26, search: 3, dur: 2, danger: 2, loot: { food: [1, 3, 0.4], water: [2, 5, 0.5], parts: [3, 7, 0.7], c: 0.08 } },
  shop: { name: '便利店', w: 3, h: 2, ex: 6, search: 2, dur: 1.4, danger: 1, loot: { food: [4, 9, 0.85], water: [3, 7, 0.7] } },
  supermarket: { name: '超市', w: 6, h: 4, ex: 8, search: 6, dur: 2.2, danger: 4, loot: { food: [6, 14, 0.95], water: [5, 12, 0.9], parts: [1, 3, 0.3] } },
  hospital: { name: '医院', w: 6, h: 4, ex: 16, search: 5, dur: 2.2, danger: 5, loot: { water: [2, 5, 0.5], c: 0.75 } },
  police: { name: '警察局', w: 5, h: 3, ex: 10, search: 4, dur: 2, danger: 4, loot: { parts: [2, 5, 0.5], w: 0.5, a: 0.35, wPool: ['pistol', 'shotgun', 'rifle', 'knife'], aPool: ['vest', 'riot'] } },
  firestation: { name: '消防站', w: 4, h: 3, ex: 10, search: 3, dur: 1.8, danger: 2, loot: { water: [3, 8, 0.8], w: 0.3, a: 0.25, wPool: ['axe'], aPool: ['jacket'] } },
  school: { name: '学校', w: 6, h: 4, ex: 10, search: 4, dur: 2, danger: 3, loot: { food: [2, 6, 0.6], water: [2, 6, 0.6], parts: [1, 4, 0.5], c: 0.15 } },
  factory: { name: '工厂', w: 6, h: 4, ex: 14, search: 5, dur: 2.4, danger: 3, loot: { parts: [6, 14, 0.95] } },
  gasstation: { name: '加油站', w: 4, h: 3, ex: 8, search: 3, dur: 1.8, danger: 1, loot: { parts: [3, 8, 0.8], food: [1, 4, 0.5], water: [1, 4, 0.5] } },
  warehouse: { name: '仓库', w: 6, h: 4, ex: 8, search: 4, dur: 2.2, danger: 2, loot: { parts: [4, 10, 0.9], food: [1, 4, 0.4], water: [1, 4, 0.4] } },
  barn: { name: '谷仓', w: 4, h: 3, ex: 12, search: 3, dur: 1.8, danger: 1, loot: { food: [3, 8, 0.7], parts: [2, 5, 0.6], w: 0.1, wPool: ['axe', 'bat', 'knife'] } },
  fountain: { name: '喷泉', w: 2, h: 2, ex: 0, search: 1, dur: 1.2, danger: 0, restock: 1, loot: { water: [4, 9, 1] } },
};

// 可复现的随机数（同一种建筑 + 同一个变体 → 画出来一模一样，读档后外观不变）
function mulberry(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shadeHex(c, k) { const [r, g, b] = hexRgb(c); return rgbStr([Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k)]); }

// ---------- 画笔：在 2 倍精度画布上画像素画（单位 = 原始像素，可以用 0.5 画细线） ----------
function makePainter(g, R, W, H) {
  const K = '#1a1c2c';
  const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const box = (x, y, w, h, c, line) => { P(x, y, w, h, line || K); P(x + 0.5, y + 0.5, w - 1, h - 1, c); };
  const pk = (arr) => arr[Math.floor(R() * arr.length)];
  // 窗户：有的完好、有的被木板封住、有的玻璃碎了、极少数还亮着灯
  const win = (x, y, w, h) => {
    const r = R();
    P(x, y, w, h, K);
    if (r < 0.13) {
      P(x + 0.5, y + 0.5, w - 1, h - 1, '#3a2a1d');
      for (let yy = y + 1; yy < y + h - 0.5; yy += 2) P(x + 0.5, yy, w - 1, 1, '#8f6a42');
    } else if (r < 0.27) {
      P(x + 0.5, y + 0.5, w - 1, h - 1, '#11131f');
      P(x + 0.5, y + 0.5, (w - 1) * 0.5, 1, '#5a6f9a');
      P(x + w - 1.5, y + h - 2, 1, 1.5, '#5a6f9a');
    } else {
      P(x + 0.5, y + 0.5, w - 1, h - 1, '#2b3a6b');
      P(x + 0.5, y + 0.5, w - 1, 1, '#4f6db0');
      P(x + 0.5, y + 0.5, 1, h - 1, '#41579a');
      if (r > 0.95) P(x + 1, y + 1.5, w - 2, h - 2.5, '#d9a441');
    }
  };
  // 平屋顶：女儿墙 + 碎石 + 积水
  const roofFlat = (x, y, w, h, col) => {
    box(x, y, w, h, shadeHex(col, 0.8));
    P(x + 1.5, y + 1.5, w - 3, h - 3, col);
    P(x + 1.5, y + 1.5, w - 3, 0.5, shadeHex(col, 0.65));
    P(x + 1.5, y + 1.5, 0.5, h - 3, shadeHex(col, 0.7));
    for (let i = 0; i < (w * h) / 12; i++) P(x + 2 + R() * (w - 4), y + 2 + R() * (h - 4), 0.5, 0.5, shadeHex(col, R() < 0.5 ? 0.8 : 1.15));
    if (R() < 0.7) P(x + 3 + R() * (w - 12), y + 3 + R() * (h - 8), 4 + R() * 5, 1.5, 'rgba(20,30,50,0.35)');
  };
  const acUnit = (x, y) => { box(x, y, 7, 5, '#94b0c2'); for (let i = 1; i < 4; i++) P(x + 1, y + i, 5, 0.5, '#566c86'); };
  const vent = (x, y) => { box(x, y, 3, 3, '#8b93a3'); P(x + 1, y + 1, 1, 1, '#333c57'); };
  const tank = (x, y) => { box(x, y, 8, 9, '#b07a45'); P(x + 1, y + 1, 6, 1.5, '#d49a5e'); P(x + 0.5, y + 4, 7, 0.5, '#6e4a2e'); };
  // 正面外墙（3/4 俯视角能看到的那一面）
  const facade = (x, y, w, h, col) => {
    box(x, y, w, h, col);
    P(x + 0.5, y + 0.5, w - 1, 1, shadeHex(col, 1.18));
    P(x + 0.5, y + h - 1.5, w - 1, 1, shadeHex(col, 0.65));
  };
  const brick = (x, y, w, h, col) => {
    for (let yy = y + 2; yy < y + h - 1; yy += 2) {
      P(x + 0.5, yy, w - 1, 0.5, shadeHex(col, 0.8));
      for (let xx = x + ((yy / 2) % 2 ? 2 : 4); xx < x + w - 1; xx += 4) P(xx, yy - 1.5, 0.5, 1.5, shadeHex(col, 0.85));
    }
  };
  const door = (cx, by, w, h, col) => {
    box(cx - w / 2, by - h, w, h, col || '#4a2f1d');
    P(cx - w / 2 + 1, by - h + 1, w - 2, 0.5, 'rgba(255,255,255,0.25)');
    if (w >= 6) P(cx - 0.25, by - h + 0.5, 0.5, h - 1, K);
  };
  // 破败感：污渍、裂缝、藤蔓、涂鸦
  const decay = (x, y, w, h) => {
    for (let i = 0; i < w / 6; i++) P(x + R() * w, y + R() * h * 0.3, 0.5, 2 + R() * 6, 'rgba(15,15,25,0.2)');
    if (R() < 0.6) {
      let cx = x + 2 + R() * (w - 4), cy = y + 1;
      for (let i = 0; i < 6; i++) { P(cx, cy, 0.5, 1, 'rgba(15,15,25,0.55)'); cx += R() < 0.5 ? -0.5 : 0.5; cy += 1; }
    }
    if (R() < 0.45) {
      const vx = R() < 0.5 ? x + 1 : x + w - 3;
      for (let i = 0; i < h * 0.8; i++) if (R() < 0.75) P(vx + R() * 2, y + h - i, 1, 1, R() < 0.5 ? '#38704a' : '#2f5a3c');
    }
    if (R() < 0.45) {
      const gx = x + 3 + R() * (w - 14), gy = y + h - 6 - R() * 3, gc = pk(['#ef7d57', '#73eff7', '#a7f070', '#b06cd0', '#f4f4f4']);
      for (let i = 0; i < 9; i++) P(gx + i + R(), gy + Math.sin(i * 1.3) * 1.5, 1, 0.5, gc);
    }
  };
  return { g, R, W, H, K, P, box, pk, win, roofFlat, acUnit, vent, tank, facade, brick, door, decay };
}

// ---------- 各种建筑怎么画 ----------
const STRUCT_PAINT = {
  house(p) {
    const { W, H, P, box, pk, R } = p;
    const rc = pk(['#b13e53', '#3b5dc9', '#38704a', '#8f5a3a', '#5d275d']), wc = pk(['#e4c9a0', '#d8dde6', '#e8c170', '#c9b7a0']);
    const fh = 16, rh = H - fh + 2;
    p.facade(2, H - fh, W - 4, fh - 0.5, wc);
    p.win(6, H - fh + 4, 7, 6); p.win(W - 13, H - fh + 4, 7, 6);
    p.door(W / 2, H - 1, 7, 10, pk(['#6e4a2e', '#b13e53', '#29366f']));
    p.decay(2, H - fh, W - 4, fh);
    // 双坡屋顶：后坡暗、前坡亮，中间是屋脊
    box(0.5, 1, W - 1, rh, shadeHex(rc, 0.6));
    P(1, 1.5, W - 2, rh * 0.45, shadeHex(rc, 0.78));
    P(1, 1.5 + rh * 0.45, W - 2, rh * 0.55 - 1, rc);
    P(1, 1.5 + rh * 0.45, W - 2, 0.75, shadeHex(rc, 1.35));
    for (let yy = 4; yy < rh - 1; yy += 3) P(1.5, yy, W - 3, 0.5, shadeHex(rc, 0.68));
    if (R() < 0.4) { const hx = 4 + R() * (W - 14); P(hx, rh * 0.6, 6, 4, '#3a2a1d'); P(hx + 1, rh * 0.6 + 1, 4, 0.5, '#8f6a42'); } // 屋顶破洞
    const cx = W * 0.68;
    box(cx, 0, 4, 8, '#8b4a3c'); P(cx + 0.5, 0.5, 3, 1, '#566c86');
    P(2.5, H - fh + 0.5, W - 5, 1.5, 'rgba(0,0,0,0.3)');
  },
  apartment(p) {
    const { W, H, P, pk, R } = p;
    const wc = pk(['#9c4a3c', '#c9a77a', '#8b93a3', '#b98a6a', '#7c8a6a']);
    const fh = 34;
    p.roofFlat(1, 1, W - 2, H - fh, '#5d6475');
    p.tank(6, 5); p.acUnit(W - 15, 6); p.acUnit(W - 15, 14); p.vent(22, 20); p.vent(30, 9);
    p.box(W / 2 - 6, H - fh - 14, 12, 10, '#6b7282'); P(W / 2 - 2, H - fh - 8, 4, 4, '#1a1c2c'); // 楼梯间
    p.facade(1, H - fh, W - 2, fh, wc);
    if (wc === '#9c4a3c' || wc === '#b98a6a') p.brick(1, H - fh, W - 2, fh, wc);
    for (let f = 0; f < 3; f++) {
      const y = H - fh + 3 + f * 10;
      for (let k = 0; k < 6; k++) {
        const x = 4 + k * 10;
        if (f === 2 && (k === 2 || k === 3)) continue;
        p.win(x, y, 6, 6);
        if (f < 2 && R() < 0.5) { P(x - 1, y + 6, 8, 1, '#3a3f4d'); P(x - 1, y + 5, 0.5, 1, '#3a3f4d'); P(x + 6.5, y + 5, 0.5, 1, '#3a3f4d'); }
      }
    }
    p.door(W / 2, H - 1, 10, 9, '#29366f');
    P(W / 2 - 7, H - 12, 14, 1.5, '#566c86');
    p.decay(1, H - fh, W - 2, fh);
  },
  office(p) {
    const { W, H, P, R } = p;
    const fh = 46;
    p.roofFlat(1, 1, W - 2, H - fh, '#4b5262');
    // 楼顶直升机停机坪
    const cx = W / 2, cy = (H - fh) / 2 + 1;
    for (let a = 0; a < 6.28; a += 0.12) P(cx + Math.cos(a) * 11, cy + Math.sin(a) * 9, 1, 1, '#c8ccd8');
    P(cx - 4, cy - 4, 1.5, 8, '#c8ccd8'); P(cx + 2.5, cy - 4, 1.5, 8, '#c8ccd8'); P(cx - 4, cy - 0.5, 8, 1.5, '#c8ccd8');
    p.acUnit(4, 4); p.vent(W - 8, 5);
    p.facade(1, H - fh, W - 2, fh, '#3a4560');
    for (let f = 0; f < 5; f++) {
      for (let k = 0; k < 7; k++) {
        const x = 3.5 + k * 8.5, y = H - fh + 3 + f * 8;
        if (f === 4 && k >= 2 && k <= 4) continue;
        const broke = R() < 0.12;
        P(x, y, 7, 6, broke ? '#11131f' : '#41579a');
        if (!broke) { P(x, y, 7, 1, '#73a7e0'); P(x + 1 + (k % 3), y + 1, 1, 4, 'rgba(255,255,255,0.18)'); }
      }
    }
    P(W / 2 - 13, H - 10, 26, 9, '#1a1c2c');
    P(W / 2 - 12.5, H - 9.5, 25, 8, '#5a7ab8');
    P(W / 2 - 0.25, H - 9.5, 0.5, 8, '#1a1c2c');
    p.decay(1, H - fh, W - 2, fh);
  },
  shop(p) {
    const { W, H, P, pk } = p;
    const sc = pk(['#38b764', '#ef7d57', '#3b5dc9', '#b13e53']);
    const fh = 20;
    p.roofFlat(1, 1, W - 2, H - fh, '#6b7282');
    p.acUnit(W - 12, 4);
    p.facade(1, H - fh, W - 2, fh, '#d8dde6');
    P(1.5, H - fh + 1, W - 3, 4, sc);
    for (let i = 0; i < 5; i++) P(10 + i * 6, H - fh + 2.5, 3, 1, '#f4f4f4'); // 招牌字
    for (let i = 0; i < 8; i++) P(2 + i * 5.6, H - fh + 5, 2.8, 3, i % 2 ? '#f4f4f4' : sc); // 条纹遮阳棚
    P(1.5, H - fh + 8, W - 3, 0.5, 'rgba(0,0,0,0.4)');
    P(4, H - fh + 9, 18, 9, '#1a1c2c'); P(4.5, H - fh + 9.5, 17, 8, '#4f6db0'); P(5, H - fh + 10, 6, 0.75, '#a9c4f0');
    P(14, H - fh + 13, 3, 3, '#ffcd75'); P(9, H - fh + 14, 3, 2, '#b13e53'); // 货架上的东西
    p.door(W - 11, H - 1, 8, 10, '#4f6db0');
    p.decay(1, H - fh, W - 2, fh);
  },
  supermarket(p) {
    const { W, H, P, R } = p;
    const fh = 24;
    p.roofFlat(1, 1, W - 2, H - fh, '#7a8090');
    for (let i = 0; i < 4; i++) p.acUnit(8 + i * 20 + R() * 4, 6 + R() * 18);
    p.vent(50, 30); p.vent(70, 12);
    p.facade(1, H - fh, W - 2, fh, '#e8eef5');
    P(1.5, H - fh + 1, W - 3, 7, '#b13e53');
    P(1.5, H - fh + 8, W - 3, 1, '#ffcd75');
    // 招牌：购物车图标 + 字
    const cx = W / 2;
    P(cx - 6, H - fh + 2.5, 10, 3, '#ffcd75'); P(cx - 7, H - fh + 2, 1, 1, '#ffcd75');
    P(cx - 5, H - fh + 6, 1.5, 1.5, '#ffcd75'); P(cx + 2, H - fh + 6, 1.5, 1.5, '#ffcd75');
    for (let i = 0; i < 4; i++) { P(10 + i * 6, H - fh + 3, 4, 3, '#f4f4f4'); P(W - 34 + i * 6, H - fh + 3, 4, 3, '#f4f4f4'); }
    // 玻璃橱窗
    for (let x = 4; x < W - 6; x += 9) {
      if (Math.abs(x + 4 - cx) < 9) continue;
      P(x, H - fh + 11, 8, 11, '#1a1c2c');
      P(x + 0.5, H - fh + 11.5, 7, 10, R() < 0.2 ? '#11131f' : '#4f6db0');
      P(x + 1, H - fh + 12, 2, 0.75, '#a9c4f0');
    }
    P(cx - 8, H - 12, 16, 11, '#1a1c2c'); P(cx - 7.5, H - 11.5, 7, 10, '#5a7ab8'); P(cx + 0.5, H - 11.5, 7, 10, '#5a7ab8');
    p.decay(1, H - fh, W - 2, fh);
  },
  hospital(p) {
    const { W, H, P } = p;
    const fh = 32;
    p.roofFlat(1, 1, W - 2, H - fh, '#9aa3b3');
    // 楼顶大红十字
    const cx = W / 2, cy = (H - fh) / 2 + 1;
    P(cx - 10, cy - 10, 20, 20, '#f4f4f4');
    P(cx - 3, cy - 8, 6, 16, '#b13e53'); P(cx - 8, cy - 3, 16, 6, '#b13e53');
    p.acUnit(6, 5); p.acUnit(W - 14, 5); p.vent(W - 10, 22);
    p.facade(1, H - fh, W - 2, fh, '#e8eef5');
    P(1.5, H - fh + 14, W - 3, 1.5, '#41a6f6');
    for (let f = 0; f < 2; f++) for (let k = 0; k < 9; k++) {
      if (f === 1 && k >= 3 && k <= 5) continue;
      p.win(4 + k * 10, H - fh + 4 + f * 13, 7, 7);
    }
    P(cx - 13, H - 14, 26, 3, '#41a6f6'); P(cx - 2, H - 20, 4, 5, '#b13e53'); P(cx - 3.5, H - 18.5, 7, 2, '#b13e53');
    P(cx - 8, H - 11, 16, 10, '#1a1c2c'); P(cx - 7.5, H - 10.5, 15, 9, '#73a7e0'); P(cx - 0.25, H - 10.5, 0.5, 9, '#1a1c2c');
    p.decay(1, H - fh, W - 2, fh);
  },
  police(p) {
    const { W, H, P } = p;
    const fh = 26;
    p.roofFlat(1, 1, W - 2, H - fh, '#5d6475');
    P(8, 6, 3, 3, '#b13e53'); P(12, 6, 3, 3, '#3b5dc9'); // 警灯
    P(W - 12, 2, 1, 14, '#1a1c2c'); P(W - 14, 4, 5, 0.75, '#1a1c2c'); // 天线
    p.acUnit(W - 26, 12); p.vent(30, 8);
    p.facade(1, H - fh, W - 2, fh, '#d8dde6');
    P(1.5, H - fh + 2, W - 3, 4, '#29366f'); P(1.5, H - fh + 6, W - 3, 1, '#f4f4f4');
    for (let i = 0; i < 6; i++) P(W / 2 - 17 + i * 6, H - fh + 3, 4, 2, '#f4f4f4');
    for (let k = 0; k < 7; k++) {
      if (k === 3) continue;
      const x = 4 + k * 10.7, y = H - fh + 10;
      p.win(x, y, 7, 7);
      for (let b = 1; b < 7; b += 2) P(x + b, y, 0.5, 7, '#1a1c2c'); // 铁栏杆
    }
    // 警徽
    const cx = W / 2;
    P(cx - 2, H - fh + 9, 4, 4, '#ffcd75'); P(cx - 3, H - fh + 10, 6, 1.5, '#ffcd75'); P(cx - 0.5, H - fh + 10.5, 1, 1, '#b07a45');
    P(cx - 6, H - 11, 12, 10, '#1a1c2c'); P(cx - 5.5, H - 10.5, 5, 9, '#3b5dc9'); P(cx + 0.5, H - 10.5, 5, 9, '#3b5dc9');
    p.decay(1, H - fh, W - 2, fh);
  },
  firestation(p) {
    const { W, H, P } = p;
    const fh = 28;
    p.roofFlat(1, 1, W - 2, H - fh, '#6b5a52');
    p.box(W - 16, 2, 12, H - fh - 4, '#a8423a'); P(W - 13, 5, 6, 4, '#1a1c2c'); // 训练塔
    P(6, 6, 4, 3, '#b13e53');
    p.facade(1, H - fh, W - 2, fh, '#a8423a');
    p.brick(1, H - fh, W - 2, fh, '#a8423a');
    P(1.5, H - fh + 1.5, W - 3, 3, '#f4f4f4');
    for (let i = 0; i < 5; i++) P(18 + i * 6, H - fh + 2.25, 4, 1.5, '#b13e53');
    // 两个车库门：一个关着，一个开着能看到消防车
    for (let k = 0; k < 2; k++) {
      const x = 5 + k * 29;
      P(x, H - 21, 24, 20, '#1a1c2c');
      if (k === 0) { P(x + 0.5, H - 20.5, 23, 19, '#c8ccd8'); for (let yy = H - 18; yy < H - 1; yy += 2.5) P(x + 0.5, yy, 23, 0.5, '#8b93a3'); }
      else { P(x + 0.5, H - 20.5, 23, 19, '#262b3a'); P(x + 3, H - 12, 18, 10, '#b13e53'); P(x + 4, H - 11, 6, 3, '#73a7e0'); P(x + 3, H - 3, 18, 1, '#ffcd75'); }
    }
    p.decay(1, H - fh, W - 2, fh);
  },
  school(p) {
    const { W, H, P } = p;
    const fh = 28;
    p.roofFlat(1, 1, W - 2, H - fh, '#6b5a52');
    P(10, 2, 1, 22, '#c8ccd8'); P(11, 3, 9, 6, '#b13e53'); P(13, 4, 2, 2, '#ffcd75'); // 旗杆
    p.acUnit(W - 16, 8); p.acUnit(W - 30, 20); p.vent(40, 10);
    p.facade(1, H - fh, W - 2, fh, '#c46a3a');
    p.brick(1, H - fh, W - 2, fh, '#c46a3a');
    P(1.5, H - fh + 13, W - 3, 1, '#e8c170');
    for (let f = 0; f < 2; f++) for (let k = 0; k < 9; k++) {
      if (f === 1 && k >= 4 && k <= 4) continue;
      p.win(4 + k * 10, H - fh + 3 + f * 13, 7, 8);
    }
    // 钟
    const cx = W / 2;
    for (let a = 0; a < 6.28; a += 0.3) P(cx + Math.cos(a) * 4 - 0.5, H - fh - 5 + Math.sin(a) * 4, 1, 1, '#1a1c2c');
    P(cx - 3.5, H - fh - 8.5, 7, 7, '#f4f4f4'); P(cx - 0.25, H - fh - 8, 0.5, 3.5, '#1a1c2c'); P(cx - 0.25, H - fh - 5, 2.5, 0.5, '#1a1c2c');
    p.door(cx, H - 1, 10, 11, '#29366f');
    p.decay(1, H - fh, W - 2, fh);
  },
  factory(p) {
    const { W, H, P, R } = p;
    const fh = 24, rt = H - fh;
    // 锯齿形屋顶（天窗）
    p.box(1, 6, W - 2, rt - 5, '#56607a');
    for (let x = 2; x < W - 14; x += 14) {
      P(x, 7, 10, rt - 7, '#6b7a8f');
      P(x + 10, 7, 3, rt - 7, '#41579a');
      P(x + 10.5, 8, 1, rt - 9, '#73a7e0');
      P(x, 7, 10, 0.75, '#8b9ab0');
    }
    // 大烟囱
    p.box(W - 12, 0, 8, rt + 2, '#8b93a3');
    for (let yy = 2; yy < rt; yy += 6) P(W - 11.5, yy, 7, 2.5, '#b13e53');
    P(W - 11.5, 0.5, 7, 1.5, '#333c57');
    p.facade(1, H - fh, W - 2, fh, '#6b7a8f');
    for (let x = 3; x < W - 2; x += 3) P(x, H - fh + 2, 0.5, fh - 4, '#56607a'); // 波纹钢板
    // 装卸大门（黄黑警示条）
    P(10, H - 18, 26, 17, '#1a1c2c');
    P(10.5, H - 17.5, 25, 16, '#3a3f4d');
    for (let i = 0; i < 6; i++) P(10.5 + i * 4.3, H - 17.5, 2.15, 2, '#ffcd75');
    for (let k = 0; k < 4; k++) p.win(48 + k * 11, H - fh + 4, 8, 5);
    p.door(W - 20, H - 1, 7, 10, '#566c86');
    if (R() < 0.7) { P(42, H - 7, 6, 6, '#8f6a42'); P(42.5, H - 6.5, 5, 0.5, '#b07a45'); } // 木箱
    p.decay(1, H - fh, W - 2, fh);
  },
  gasstation(p) {
    const { W, H, P } = p;
    // 后面的便利亭
    p.roofFlat(30, 1, W - 32, 14, '#6b7282');
    p.facade(30, 15, W - 32, 12, '#e8eef5');
    p.win(34, 18, 8, 6); p.door(W - 9, 27, 6, 9, '#4f6db0');
    // 加油机
    for (let k = 0; k < 2; k++) {
      const x = 8 + k * 22;
      p.box(x, H - 16, 7, 12, '#b13e53'); P(x + 1, H - 14, 5, 3, '#1a1c2c'); P(x + 1.5, H - 13.5, 4, 2, '#a7f070');
      P(x + 7, H - 12, 1, 6, '#1a1c2c');
    }
    // 大雨棚（在最上层）
    p.box(2, 8, 50, 22, '#f4f4f4');
    P(2.5, 26, 49, 3.5, '#b13e53'); P(2.5, 25, 49, 1, '#ffcd75');
    P(3, 9, 48, 1, '#c8ccd8');
    P(10, 30, 2, H - 34, '#8b93a3'); P(42, 30, 2, H - 34, '#8b93a3'); // 柱子
    P(20, 14, 14, 6, '#b13e53'); P(22, 15.5, 10, 3, '#f4f4f4');
  },
  warehouse(p) {
    const { W, H, P, R } = p;
    const fh = 20;
    p.roofFlat(1, 1, W - 2, H - fh, '#9aa0ad');
    for (let x = 8; x < W - 10; x += 16) { P(x, 6, 10, 4, '#1a1c2c'); P(x + 0.5, 6.5, 9, 3, '#73a7e0'); P(x + 1, 7, 3, 0.75, '#c8e0ff'); } // 天窗
    for (let x = 6; x < W - 6; x += 18) { P(x, 22, 10, 4, '#1a1c2c'); P(x + 0.5, 22.5, 9, 3, '#73a7e0'); }
    p.facade(1, H - fh, W - 2, fh, '#b0b6c4');
    for (let x = 3; x < W - 2; x += 3) P(x, H - fh + 2, 0.5, fh - 4, '#8b93a3');
    P(1.5, H - fh + 1.5, W - 3, 1.5, '#41579a');
    // 三个装卸口（编号、有的卷帘门半开）
    for (let k = 0; k < 3; k++) {
      const x = 6 + k * 30;
      P(x, H - 15, 22, 14, '#1a1c2c');
      const open = R() < 0.4 ? 6 : 0;
      P(x + 0.5, H - 14.5, 21, 13 - open, '#8b93a3');
      for (let yy = H - 13; yy < H - 1.5 - open; yy += 2) P(x + 0.5, yy, 21, 0.5, '#6b7282');
      if (open) P(x + 0.5, H - 1.5 - open, 21, open, '#262b3a');
      P(x + 9, H - 18.5, 4, 3, '#ffcd75'); P(x + 10, H - 18, 2, 2, '#1a1c2c');
      P(x - 1, H - 4, 1.5, 3, '#1a1c2c'); P(x + 21.5, H - 4, 1.5, 3, '#1a1c2c'); // 防撞墩
    }
    p.decay(1, H - fh, W - 2, fh);
  },
  barn(p) {
    const { W, H, P, box, R } = p;
    const fh = 22, rh = H - fh + 2;
    // 铁皮屋顶（折线形），有锈迹
    box(0.5, 1, W - 1, rh, '#4b5262');
    P(1, 1.5, W - 2, rh * 0.38, '#5d6a80');
    P(1, 1.5 + rh * 0.38, W - 2, rh * 0.62 - 1, '#6b7a8f');
    P(1, 1.5 + rh * 0.38, W - 2, 0.75, '#94b0c2');
    for (let x = 3; x < W - 2; x += 4) P(x, 2, 0.5, rh - 2, 'rgba(30,35,50,0.45)');
    for (let i = 0; i < 6; i++) P(3 + R() * (W - 10), 3 + R() * (rh - 6), 2 + R() * 4, 1 + R() * 2, 'rgba(160,80,40,0.5)');
    // 红色木墙 + 白边
    p.facade(2, H - fh, W - 4, fh - 0.5, '#a8423a');
    for (let x = 5; x < W - 3; x += 3) P(x, H - fh + 1, 0.5, fh - 2.5, '#8f2f2a');
    P(2.5, H - fh + 0.5, W - 5, 1, '#f4f4f4'); P(2.5, H - fh, 1, fh - 0.5, '#f4f4f4'); P(W - 3.5, H - fh, 1, fh - 0.5, '#f4f4f4');
    P(W / 2 - 4, H - fh + 3, 8, 4, '#1a1c2c'); P(W / 2 - 3.5, H - fh + 3.5, 7, 3, '#e8c170'); // 草料窗
    // 大门（白色 X 形木条）
    box(W / 2 - 10, H - 15, 20, 14, '#8f2f2a', '#f4f4f4');
    for (let k = 0; k < 13; k++) { P(W / 2 - 9.5 + k * 1.5, H - 14.5 + k, 1.2, 1, '#f4f4f4'); P(W / 2 + 8 - k * 1.5, H - 14.5 + k, 1.2, 1, '#f4f4f4'); }
    P(W / 2 - 0.25, H - 15, 0.5, 14, '#f4f4f4');
    // 干草堆
    for (const hx of [4, W - 13]) { box(hx, H - 7, 9, 6, '#e8c170'); P(hx + 1, H - 5, 7, 0.5, '#c4a050'); P(hx + 1, H - 3, 7, 0.5, '#c4a050'); }
  },
  fountain(p) {
    const { W, H, P } = p;
    const cx = W / 2, cy = H / 2 + 1;
    for (let a = 0; a < 6.28; a += 0.05) {
      P(cx + Math.cos(a) * 13 - 1, cy + Math.sin(a) * 11 - 1, 2.5, 2.5, '#566c86');
      P(cx + Math.cos(a) * 12 - 1, cy + Math.sin(a) * 10 - 1, 2, 2, '#c8ccd8');
    }
    for (let r = 10.5; r > 0; r -= 1) for (let a = 0; a < 6.28; a += 0.15) P(cx + Math.cos(a) * r - 0.5, cy + Math.sin(a) * r * 0.85 - 0.5, 1.2, 1.2, r > 7 ? '#3b6fd0' : '#4f86e0');
    p.box(cx - 2, cy - 7, 4, 8, '#c8ccd8');
    P(cx - 1, cy - 9, 2, 2, '#a9c4f0'); P(cx - 4, cy - 6, 1, 1, '#dff6ff'); P(cx + 3, cy - 5, 1, 1, '#dff6ff');
  },
};

const STRUCT_IMG = {};
function structImg(type, variant) {
  const key = type + '_' + variant;
  if (STRUCT_IMG[key]) return STRUCT_IMG[key];
  const d = STRUCTS[type], W = d.w * T, H = d.h * T + d.ex;
  const c = createCanvas(W * 2, H * 2), g = c.getContext('2d');
  g.scale(2, 2);
  let seed = variant * 7919 + 17;
  for (const ch of type) seed = seed * 31 + ch.charCodeAt(0);
  const R = mulberry(seed);
  STRUCT_PAINT[type](makePainter(g, R, W, H));
  STRUCT_IMG[key] = { img: c, w: W, h: H };
  return STRUCT_IMG[key];
}

// ---------- 街景小物件（不挡路） ----------
const DECOR_PAINT = {
  lamp: [8, 28, (P, lit) => {
    P(3.5, 6, 1.5, 21, '#333c57'); P(3, 26, 2.5, 2, '#1a1c2c');
    P(4, 4, 4, 1.5, '#333c57'); P(5, 5.5, 3, 1.5, lit ? '#ffcd75' : '#566c86');
  }],
  hydrant: [6, 8, (P) => { P(1, 1, 4, 7, '#1a1c2c'); P(1.5, 1.5, 3, 6, '#b13e53'); P(0, 3, 6, 1.5, '#b13e53'); P(2, 1.5, 1, 1, '#ef7d57'); }],
  trash: [10, 7, (P) => { P(0.5, 2, 5, 5, '#1a1c2c'); P(1, 2.5, 4, 4, '#333c57'); P(4.5, 3, 5, 4, '#1a1c2c'); P(5, 3.5, 4, 3, '#262b44'); P(2, 1, 1.5, 1.5, '#1a1c2c'); P(1.5, 3, 1, 1, '#566c86'); }],
  cone: [6, 7, (P) => { P(2, 0.5, 2, 2, '#ef7d57'); P(1.5, 2.5, 3, 2, '#f4f4f4'); P(1, 4.5, 4, 1.5, '#ef7d57'); P(0, 6, 6, 1, '#1a1c2c'); }],
  bench: [14, 7, (P) => { P(0, 0.5, 14, 2, '#6e4a2e'); P(0, 3, 14, 2, '#8f6a42'); P(1, 5, 1, 2, '#1a1c2c'); P(12, 5, 1, 2, '#1a1c2c'); }],
  papers: [8, 4, (P) => { P(0, 1, 3, 2, '#d8dde6'); P(4, 0, 3, 2, '#c9b7a0'); P(5, 2.5, 2, 1.5, '#f4f4f4'); }],
  barrier: [16, 7, (P) => { P(0, 1, 16, 4, '#1a1c2c'); for (let i = 0; i < 4; i++) P(0.5 + i * 4, 1.5, 2, 3, i % 2 ? '#f4f4f4' : '#b13e53'); P(2, 5, 1, 2, '#333c57'); P(13, 5, 1, 2, '#333c57'); }],
  // 红绿灯（停电了，灯都是暗的，偶尔一个还闪红灯）
  signal: [8, 24, (P, lit) => {
    P(3.5, 8, 1.5, 15, '#333c57'); P(3, 22, 2.5, 2, '#1a1c2c');
    P(1.5, 0, 5, 10, '#1a1c2c'); P(2, 0.5, 4, 9, '#262b3a');
    P(3, 1.5, 2, 2, lit ? '#ef7d57' : '#4a2a30'); P(3, 4, 2, 2, '#4a4228'); P(3, 6.5, 2, 2, '#1f3a2a');
  }],
};
const DECOR_IMG = {};
function decorImg(kind, lit) {
  const key = kind + (lit ? '1' : '0');
  if (DECOR_IMG[key]) return DECOR_IMG[key];
  const [w, h, paint] = DECOR_PAINT[kind];
  const c = createCanvas(w * 2, h * 2), g = c.getContext('2d');
  g.scale(2, 2);
  paint((x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }, lit);
  DECOR_IMG[key] = { img: c, w, h };
  return DECOR_IMG[key];
}

// ---------- 城市地图生成（按真实城市规划） ----------
// 道路分级：高速公路 → 主干道（4 车道，有行道树）→ 次干道 → 支路 → 小巷
//   · 主干道「中央大道」（东西）和「林荫大道」（南北）在环岛交汇
//   · 高速公路在北边，和林荫大道平面相交（T 字路口，没有高架桥）
//   · 铁路贴着工业区，过马路的地方是平交道口
// 功能分区：
//   · 市中心商务区（东）：小街区、写字楼、公寓、商店、广场
//   · 老城区（中）：营地所在，警局、消防站、医院等公共设施
//   · 工业区（西北，靠铁路和高速）：工厂、仓库、加油站
//   · 住宅区（南）：支路网格（有 T 字路口）、民居、学校、社区公园
//   · 郊区（河西）：弯曲的道路 + 尽头回车场
//   · 城北：农田、树林
// 大型商业建筑旁边有停车场；主干道路口有红绿灯和斑马线
function cityMapGen(campType) {
  const N = MAP_W * MAP_H;
  G.citySeed = randInt(1, 1e9); // 建筑内部布局用的随机种子（存档里保存，读档后户型不变）
  G.structs = [];
  G.decor = [];
  G.structAt = new Int16Array(N).fill(-1);
  G.roads = [];
  G.fields = [];
  G.crosswalks = [];
  G.parking = [];
  const nat = (G.natTer = new Uint8Array(N).fill(TER.GRASS));
  G.terrain.fill(TER.GRASS);
  const roadMask = new Uint8Array(N), sidewalk = new Uint8Array(N), occ = new Uint8Array(N), noTree = new Uint8Array(N);
  const owner = new Int16Array(N); // 每格马路属于哪条路（找路口用）
  const ccx = G.coreX + 1, ccy = G.coreY + 1;

  // ---- 曲线工具 ----
  const cr = (p0, p1, p2, p3, t) => {
    const t2 = t * t, t3 = t2 * t;
    return [0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
  };
  const resample = (pts, step) => {
    const out = [pts[0]];
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
      let d = step - carry;
      while (d <= len) { out.push([ax + (bx - ax) * d / len, ay + (by - ay) * d / len]); d += step; }
      carry = len - (d - step);
    }
    out.push(pts[pts.length - 1]);
    return out;
  };
  const smooth = (ctrl) => {
    if (ctrl.length < 3) return resample(ctrl, 0.5);
    const P = [ctrl[0]].concat(ctrl, [ctrl[ctrl.length - 1]]), out = [];
    for (let i = 1; i < P.length - 2; i++) for (let t = 0; t < 1; t += 0.05) out.push(cr(P[i - 1], P[i], P[i + 1], P[i + 2], t));
    out.push(ctrl[ctrl.length - 1]);
    return resample(out, 0.5);
  };
  const wiggle = (a, b, amp, n) => {
    const ctrl = [a], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    for (let k = 1; k < n; k++) {
      const t = k / n, off = rand(-amp, amp);
      ctrl.push([a[0] + dx * t - dy / len * off, a[1] + dy * t + dx / len * off]);
    }
    ctrl.push(b);
    return smooth(ctrl);
  };
  const line = (a, b) => resample([a, b], 0.5);
  const SIDE = { ave: 1, street: 1, local: 1 };
  const CROSS = { ave: 1, street: 1, local: 1, ring: 1 }; // 这些路相交会画斑马线
  // 把路“刷”到格子上
  const addRoad = (pts, w, kind) => {
    const id = G.roads.length + 1;
    const road = { pts: pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]), w, kind };
    G.roads.push(road);
    const side = SIDE[kind] ? 1 : 0, r = w / 2 + side + 1;
    for (const [px, py] of pts) {
      for (let y = Math.floor(py - r); y <= py + r; y++) for (let x = Math.floor(px - r); x <= px + r; x++) {
        if (!inMap(x, y)) continue;
        const i = idx(x, y), d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
        if (d <= w / 2 + 0.15) {
          if (kind === 'dirt' || kind === 'rail') { if (G.terrain[i] !== TER.ROAD && !(kind === 'dirt' && G.terrain[i] === TER.WATER)) G.terrain[i] = TER.DIRT; }
          else { G.terrain[i] = TER.ROAD; sidewalk[i] = 0; }
          if (CROSS[kind]) owner[i] = owner[i] === 0 || owner[i] === id ? id : -1;
          roadMask[i] = 1;
        } else if (side && d <= w / 2 + 1.1 && G.terrain[i] !== TER.ROAD && G.terrain[i] !== TER.WATER) {
          G.terrain[i] = TER.PAVE; sidewalk[i] = 1; roadMask[i] = 2;
        }
        if (d <= w / 2 + 2.5) noTree[i] = 1;
      }
    }
    return road;
  };
  // 环岛：一圈 3 车道的环形路，中间是绿岛 + 喷泉
  const ring = (cx, cy, r, w) => {
    const id = G.roads.length + 1;
    G.roads.push({ pts: [[cx, cy]], r, w, kind: 'ring' });
    for (let y = Math.floor(cy - r - 3); y <= cy + r + 3; y++) for (let x = Math.floor(cx - r - 3); x <= cx + r + 3; x++) {
      if (!inMap(x, y)) continue;
      const i = idx(x, y), d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (Math.abs(d - r) <= w / 2 + 0.15) { G.terrain[i] = TER.ROAD; sidewalk[i] = 0; roadMask[i] = 1; owner[i] = owner[i] === 0 || owner[i] === id ? id : -1; }
      else if (d > r && d <= r + w / 2 + 1.1 && G.terrain[i] !== TER.ROAD) { G.terrain[i] = TER.PAVE; sidewalk[i] = 1; roadMask[i] = 2; }
      else if (d < r - w / 2) { roadMask[i] = 2; }
      noTree[i] = 1;
    }
  };
  const cul = (x, y) => {
    G.roads.push({ pts: [[x, y]], w: 4, kind: 'circle' });
    for (let yy = Math.floor(y - 3); yy <= y + 3; yy++) for (let xx = Math.floor(x - 3); xx <= x + 3; xx++) {
      if (!inMap(xx, yy)) continue;
      const i = idx(xx, yy), d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
      if (d <= 2.15) { G.terrain[i] = TER.ROAD; roadMask[i] = 1; }
      else if (d <= 3.2 && G.terrain[i] !== TER.ROAD && G.terrain[i] !== TER.WATER) { G.terrain[i] = TER.PAVE; sidewalk[i] = 1; roadMask[i] = 2; }
      noTree[i] = 1;
    }
  };
  const pointAt = (road, f) => road.pts[Math.floor((road.pts.length - 1) * f)];

  // ---- 0) 主要坐标 ----
  const BX = ccx + 9, AY = ccy - 10;           // 林荫大道 x、中央大道 y（环岛在交点）
  const hwyY = Math.max(5, AY - randInt(25, 27)); // 高速公路
  const railY = AY - randInt(16, 17);          // 铁路
  const RIVER = randInt(14, 16);               // 河的大致 x
  const k1 = rand(0, 6.28), k2 = rand(0, 6.28);
  const riverX = (y) => RIVER + 2.5 * Math.sin(y / 11 + k1) + 1.2 * Math.sin(y / 4.7 + k2);
  const zoneAt = (x, y) => {
    if (y < railY) return x < BX ? 'industry' : 'farm';
    if (x < riverX(y) + 3) return 'suburb';
    if (y < AY && x < BX) return 'industry';
    if (x >= BX && y < AY + 20) return 'cbd';
    if (y >= AY + 18) return 'resid';
    return 'old';
  };

  // ---- 1) 河流 + 河边绿地 ----
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const d = Math.abs(x + 0.5 - riverX(y + 0.5));
    if (d < 1.8) { G.terrain[idx(x, y)] = TER.WATER; nat[idx(x, y)] = TER.WATER; }
    else if (d < 3.6) roadMask[idx(x, y)] = roadMask[idx(x, y)] || 3; // 河边不盖楼（滨河绿地）
  }

  // ---- 2) 道路骨架 ----
  // 高速公路
  const hwy = addRoad(wiggle([-2, hwyY + rand(-1.5, 1.5)], [MAP_W + 2, hwyY + rand(-1.5, 1.5)], 2, 5), 3, 'hwy');
  // 铁路
  const rail = addRoad(wiggle([-2, railY + rand(-1, 1)], [MAP_W + 2, railY + rand(-1, 1)], 1, 4), 1.4, 'rail');
  // 中央大道（东西向主干道，过河有桥），在环岛处断开
  const R = 3.6;
  addRoad(wiggle([-2, AY + rand(-2, 2)], [BX - R - 1.2, AY], 1.5, 4), 4, 'ave');
  addRoad(wiggle([BX + R + 1.2, AY], [MAP_W + 2, AY + rand(-2, 2)], 1.2, 3), 4, 'ave');
  // 林荫大道（南北向主干道）：北段穿过铁路，在高速公路处形成平面 T 字路口（没有高架桥）
  const hwyAtBX = hwy.pts.reduce((b, q) => (Math.abs(q[0] - BX) < Math.abs(b[0] - BX) ? q : b));
  addRoad(line([BX, AY - R - 1.2], [BX, hwyAtBX[1] + 1.5]), 4, 'ave'); // 停在高速公路南侧边线，人行道不会伸到路对面
  addRoad(wiggle([BX, AY + R + 1.2], [BX + rand(-6, 6), MAP_H + 2], 2, 4), 4, 'ave');
  ring(BX, AY, R, 3);
  // 次干道（老城区 + 商务区 + 工业区）
  const XW1 = BX - 18, XW2 = BX - 34;          // 老城区两条南北街
  const YS = AY + 18;                          // 老城区南边的东西街
  addRoad(line([XW1, AY + 2], [XW1, MAP_H + 2]), 2, 'street');
  addRoad(line([XW2, railY + 1.5], [XW2, MAP_H + 2]), 2, 'street');
  addRoad(wiggle([-2, YS + rand(-1, 1)], [XW1, YS], 1, 3), 2, 'street');
  addRoad(line([XW1, YS], [BX - 2, YS]), 2, 'street');
  addRoad(line([BX + 2, YS], [MAP_W + 2, YS]), 2, 'street');
  const YN = AY - 9;                           // 工业区和商务区之间的东西街（过河）
  addRoad(wiggle([-2, YN + rand(-1, 1)], [BX - 2, YN], 1, 3), 2, 'street');
  addRoad(line([BX + 2, YN], [MAP_W + 2, YN]), 2, 'street');
  for (const x of [BX + 11, BX + 22, BX + 33]) if (x < MAP_W - 3) addRoad(line([x, railY + 1.5], [x, YS]), 2, 'street');
  addRoad(line([BX + 2, AY + 10], [MAP_W + 2, AY + 10]), 2, 'local');
  addRoad(line([XW2, AY + 9], [XW1, AY + 9]), 1, 'alley');         // 老城区后巷
  addRoad(line([BX - 30 + randInt(0, 6), railY + 1.5], [BX - 30 + randInt(0, 6), YN]), 2, 'street'); // 工业区
  // 住宅区支路网格：有的路段缺失，形成 T 字路口
  const rx = [XW2, XW2 + 8, XW1, XW1 + 9, BX];
  for (let x = BX + 10; x < MAP_W - 3; x += randInt(9, 11)) rx.push(x);
  const ry = [YS];
  for (let y = YS + 9; y < MAP_H - 2; y += randInt(9, 10)) ry.push(y);
  for (let j = 1; j < ry.length; j++) for (let i = 0; i + 1 < rx.length; i++) {
    if (Math.random() < 0.85) addRoad(line([rx[i] + (i ? 0 : 0), ry[j]], [rx[i + 1], ry[j]]), 2, 'local');
  }
  for (let i = 0; i < rx.length; i++) {
    if (rx[i] === XW1 || rx[i] === XW2 || rx[i] === BX) continue;
    for (let j = 0; j + 1 < ry.length; j++) if (Math.random() < 0.8) addRoad(line([rx[i], ry[j]], [rx[i], ry[j + 1]]), 2, 'local');
  }
  addRoad(line([rx[0] - 0, ry[ry.length - 1]], [MAP_W + 2, ry[ry.length - 1]]), 2, 'local');
  // 河西郊区：弯路 + 尽头路
  const sub = addRoad(wiggle([5, railY + 2], [6, MAP_H - 3], 2.5, 5), 2, 'local');
  for (let k = 0; k < 4; k++) {
    const p = pointAt(sub, 0.15 + k * 0.23), toRiver = k % 2 === 0;
    const end = [toRiver ? Math.min(riverX(p[1]) - 4.5, p[0] + randInt(5, 7)) : Math.max(2.5, p[0] - 3), p[1] + rand(-2, 2)];
    if (Math.abs(end[0] - p[0]) < 2.5) continue;
    addRoad(wiggle(p, end, 0.8, 2), 2, 'local');
    cul(end[0], end[1]);
  }
  // 城北：农田的土路
  const farmRoads = [];
  for (const fx of [BX + 14, BX + 32]) {
    if (fx > MAP_W - 8) continue;
    const p = hwy.pts.reduce((b, q) => (Math.abs(q[0] - fx) < Math.abs(b[0] - fx) ? q : b));
    farmRoads.push(addRoad(line([fx, p[1] + 1.5], [fx + rand(-1, 1), railY - 1.5]), 1, 'dirt'));
  }

  // ---- 3) 地面：商务区是硬化广场，工业区是土地，营地街区清空 ----
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    if (roadMask[i] === 1 || sidewalk[i] || G.terrain[i] === TER.WATER) continue;
    const z = zoneAt(x, y);
    if (z === 'cbd') { G.terrain[i] = TER.PAVE; nat[i] = TER.PAVE; }
    else if (z === 'industry') { G.terrain[i] = TER.DIRT; nat[i] = TER.DIRT; }
  }

  // ---- 建筑放置工具 ----
  const fits = (x, y, w, h) => {
    if (x < 1 || y < 1 || x + w >= MAP_W - 1 || y + h >= MAP_H - 1) return false;
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      const i = idx(xx, yy), inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
      if (occ[i] || roadMask[i] === 1) return false;
      if (inside && (roadMask[i] || G.terrain[i] === TER.WATER || G.nodes[i])) return false;
    }
    return true;
  };
  const frontage = (x, y, w, h) => { // 建筑要临街（2 格内有路或人行道）
    for (let yy = y - 2; yy < y + h + 2; yy++) for (let xx = x - 2; xx < x + w + 2; xx++) if (inMap(xx, yy) && (roadMask[idx(xx, yy)] === 1 || roadMask[idx(xx, yy)] === 2)) return true;
    return false;
  };
  const place = (type, x, y, extra) => {
    const d = STRUCTS[type];
    const s = Object.assign({ type, x, y, w: d.w, h: d.h, v: randInt(0, 3), left: d.search, restock: 0 }, extra || {});
    const si = G.structs.length;
    G.structs.push(s);
    for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) {
      const i = idx(xx, yy);
      occ[i] = 1; G.terrain[i] = TER.LOT; nat[i] = TER.PAVE; G.structAt[i] = si;
    }
    for (let yy = y - 1; yy <= y + d.h; yy++) for (let xx = x - 1; xx <= x + d.w; xx++) if (inMap(xx, yy)) noTree[idx(xx, yy)] = 1;
    return s;
  };
  // 停车场：大建筑南边（或北边）一块画了车位的空地
  const parking = (s) => {
    for (const py of [s.y + s.h + 1, s.y - 4]) {
      const px = s.x, pw = s.w, ph = 3;
      let ok = py > 0 && py + ph < MAP_H - 1;
      for (let y = py; ok && y < py + ph; y++) for (let x = px; x < px + pw; x++) {
        const i = idx(x, y);
        if (occ[i] || roadMask[i] === 1 || G.terrain[i] === TER.WATER || G.nodes[i]) { ok = false; break; }
      }
      if (!ok) continue;
      for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) {
        const i = idx(x, y);
        G.terrain[i] = TER.ROAD; nat[i] = TER.PAVE; roadMask[i] = 1; occ[i] = 2; noTree[i] = 1; sidewalk[i] = 0;
      }
      G.parking.push([px, py, pw, ph]);
      for (let k = 0; k < pw; k++) if (Math.random() < 0.3) placeNode('car', px + k, py + (Math.random() < 0.5 ? 0 : ph - 1), 6);
      return;
    }
  };
  const placeIn = (zone, type, tries, big) => {
    const d = STRUCTS[type];
    for (let t = 0; t < (tries || 400); t++) {
      const x = randInt(1, MAP_W - d.w - 1), y = randInt(1, MAP_H - d.h - 1);
      if (zoneAt(x + d.w / 2, y + d.h / 2) !== zone && zone !== 'any') continue;
      if (!fits(x, y, d.w, d.h) || !frontage(x, y, d.w, d.h)) continue;
      const s = place(type, x, y);
      if (big) parking(s);
      return s;
    }
    return null;
  };

  // ---- 4) 营地街区（老城区中心） ----
  const camp = { x0: XW1 + 2, x1: BX - 4, y0: AY + 3, y1: YS - 3 };
  for (let y = camp.y0; y <= camp.y1; y++) for (let x = camp.x0; x <= camp.x1; x++) {
    const i = idx(x, y);
    if (roadMask[i]) continue;
    G.terrain[i] = TER.DIRT; nat[i] = TER.DIRT; noTree[i] = 1;
  }
  const hd = STRUCTS[campType];
  place(campType, ccx - Math.floor(hd.w / 2), G.coreY - hd.h, { home: true, left: 0 });
  for (let y = camp.y0; y <= camp.y1; y++) for (let x = camp.x0; x <= camp.x1; x++) occ[idx(x, y)] = Math.max(occ[idx(x, y)], 2);

  // ---- 5) 环岛中间的喷泉 ----
  place('fountain', BX - 1, AY - 1);

  // ---- 6) 社区公园（住宅区里留一块绿地） ----
  for (let t = 0; t < 200; t++) {
    const x = randInt(XW2 + 2, MAP_W - 12), y = randInt(YS + 3, MAP_H - 9), w = 8, h = 6;
    let ok = true;
    for (let yy = y; ok && yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (roadMask[idx(xx, yy)] || occ[idx(xx, yy)]) { ok = false; break; }
    if (!ok) continue;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const i = idx(xx, yy);
      occ[i] = 2; noTree[i] = 1;
      if (yy === y + 3 || xx === x + 4) { G.terrain[i] = TER.PAVE; nat[i] = TER.PAVE; }
      else if (Math.random() < 0.22) placeNode('ctree', xx, yy, 6);
      else if (Math.random() < 0.08) G.decor.push(['bench', (xx + 0.5) * T, (yy + 0.7) * T]);
    }
    break;
  }

  // ---- 7) 重要建筑（按分区） ----
  placeIn('old', 'police'); placeIn('old', 'firestation'); placeIn('cbd', 'hospital', 600, true) || placeIn('old', 'hospital', 600, true);
  placeIn('resid', 'school', 600, true); placeIn('cbd', 'supermarket', 600, true); placeIn('resid', 'supermarket', 600, true);
  for (let k = 0; k < 3; k++) placeIn('industry', 'factory', 400); for (let k = 0; k < 3; k++) placeIn('industry', 'warehouse', 400);
  // 加油站：高速路口、主干道边
  for (let k = 0; k < 2; k++) {
    for (let t = 0; t < 300; t++) {
      const p = pick(G.roads.filter((r) => r.kind === 'ave' || r.kind === 'hwy')).pts;
      const [px, py] = pick(p), d = STRUCTS.gasstation;
      const x = Math.round(px + rand(-5, 5) - 2), y = Math.round(py + rand(-5, 5) - 1);
      if (fits(x, y, d.w, d.h) && frontage(x, y, d.w, d.h)) { place('gasstation', x, y); break; }
    }
  }
  for (let k = 0; k < 2; k++) placeIn('cbd', 'office', 300, k === 0);

  // ---- 8) 其余建筑：每个分区按自己的类型填满（都要临街） ----
  const POOLS = {
    cbd: ['office', 'office', 'apartment', 'apartment', 'shop', 'shop'],
    old: ['shop', 'shop', 'apartment', 'house', 'house'],
    resid: ['house', 'house', 'house', 'house', 'house', 'apartment', 'shop'],
    suburb: ['house'],
    industry: ['factory', 'warehouse', 'warehouse', 'shop'],
    farm: ['barn', 'house'],
  };
  for (let t = 0; t < 9000; t++) {
    const x = randInt(1, MAP_W - 3), y = randInt(1, MAP_H - 3), z = zoneAt(x, y), pool = POOLS[z];
    if (z === 'farm' && Math.random() < 0.85) continue;
    const type = pick(pool), d = STRUCTS[type];
    if (zoneAt(x + d.w / 2, y + d.h / 2) !== z) continue;
    if (fits(x, y, d.w, d.h) && frontage(x, y, d.w, d.h)) place(type, x, y);
  }

  // ---- 9) 城北农田 ----
  for (const r of farmRoads) {
    const [ex, ey] = r.pts[Math.floor(r.pts.length / 2)];
    for (const dir of [-1, 1]) {
      const fx = Math.round(ex + (dir > 0 ? 1.5 : -9.5)), fy = Math.round(ey - 2), fw = 8, fh = 4;
      let ok = true;
      for (let y = fy; ok && y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) if (!inMap(x, y) || roadMask[idx(x, y)] === 1 || occ[idx(x, y)] || G.terrain[idx(x, y)] === TER.WATER) { ok = false; break; }
      if (!ok) continue;
      for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) { const i = idx(x, y); G.terrain[i] = TER.DIRT; nat[i] = TER.DIRT; occ[i] = 2; noTree[i] = 1; }
      G.fields.push([fx, fy, fw, fh]);
    }
  }

  // ---- 10) 树：城北和河西多树林，住宅区院子里零星几棵，商务区没有 ----
  const fn = makeNoise(), fn2 = makeNoise();
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    const i = idx(x, y);
    if (noTree[i] || occ[i] || roadMask[i] === 1 || G.terrain[i] === TER.WATER || distToCore(x, y) < 10) continue;
    const z = zoneAt(x, y);
    if (z === 'cbd' || z === 'industry') { if (Math.random() < 0.01) placeNode('ctree', x, y, 6); continue; }
    if (z === 'resid' || z === 'old') { if (Math.random() < 0.05) placeNode('ctree', x, y, 6); continue; }
    const f = fn(x * 0.1, y * 0.1) * 0.75 + fn2(x * 0.3, y * 0.3) * 0.25;
    const p = roadMask[i] === 3 ? 0.18 : f > 0.5 ? 0.55 : f > 0.42 ? 0.15 : 0.03;
    if (Math.random() < p) placeNode(Math.random() < 0.45 ? 'fpine' : 'ftree', x, y, 6);
  }

  // ---- 11) 路口：斑马线 + 主干道上的红绿灯 ----
  G.roads.forEach((r, ri) => {
    if (!SIDE[r.kind] || r.pts.length < 8) return;
    const id = ri + 1, pts = r.pts;
    const own = (k) => { const [x, y] = pts[k]; return inMap(Math.floor(x), Math.floor(y)) ? owner[idx(Math.floor(x), Math.floor(y))] : 0; };
    let last = -99;
    const add = (k, k0, k1) => {
      if (k < 1 || k >= pts.length - 1 || Math.abs(k - last) < 4) return;
      last = k;
      const [x, y] = pts[k], a = Math.atan2(pts[k1][1] - pts[k0][1], pts[k1][0] - pts[k0][0]);
      G.crosswalks.push([x, y, Math.round(a * 1000) / 1000, r.w]);
      if (r.kind === 'ave') {
        const nx = -Math.sin(a), ny = Math.cos(a), o = r.w / 2 + 1.3;
        G.decor.push(['signal', (x + nx * o) * T, (y + ny * o) * T]);
      }
    };
    for (let k = 1; k < pts.length; k++) {
      const a = own(k - 1), b = own(k);
      if (a === id && b === -1) add(k - 3, Math.max(0, k - 5), k - 1);
      if (a === -1 && b === id) add(k + 2, k, Math.min(pts.length - 1, k + 4));
    }
  });

  // ---- 12) 街景 ----
  for (const r of G.roads) {
    if (r.kind !== 'ave') continue;
    // 主干道两边的行道树
    for (let k = 3; k < r.pts.length - 1; k += 6) {
      const [x, y] = r.pts[k], [px, py] = r.pts[k - 1], len = Math.hypot(x - px, y - py) || 1;
      const nx = -(y - py) / len, ny = (x - px) / len;
      for (const s of [-1, 1]) {
        const tx = x + nx * s * (r.w / 2 + 0.6), ty = y + ny * s * (r.w / 2 + 0.6);
        const i = inMap(Math.floor(tx), Math.floor(ty)) ? idx(Math.floor(tx), Math.floor(ty)) : -1;
        if (i >= 0 && sidewalk[i] && !occ[i]) G.decor.push(['stree', tx * T, (ty + 0.4) * T]);
      }
    }
  }
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    if (sidewalk[i] && !occ[i] && !G.nodes[i]) {
      if ((x * 7 + y * 13) % 10 === 0) G.decor.push(['lamp', (x + 0.5) * T, (y + 0.8) * T, Math.random() < 0.35]);
      else if (Math.random() < 0.035) G.decor.push([pick(['hydrant', 'trash', 'trash', 'papers', 'cone']), (x + rand(0.2, 0.8)) * T, (y + rand(0.3, 0.9)) * T]);
    } else if (G.terrain[i] === TER.ROAD && Math.random() < 0.008 && distToCore(x, y) > 6) {
      G.decor.push([pick(['barrier', 'cone', 'papers']), (x + 0.5) * T, (y + 0.6) * T]);
    }
  }
  // 高速公路上堵满了车，其他路上零星几辆
  for (const r of G.roads) {
    if (r.pts.length < 2 || r.kind === 'dirt' || r.kind === 'rail' || r.kind === 'alley') continue;
    const dens = r.kind === 'hwy' ? 0.35 : r.kind === 'ave' ? 0.12 : 0.05;
    for (let k = 0; k < r.pts.length; k += 2) {
      if (Math.random() > dens) continue;
      const [px, py] = r.pts[k];
      const x = Math.floor(px + rand(-r.w / 2, r.w / 2)), y = Math.floor(py + rand(-r.w / 2, r.w / 2));
      if (inMap(x, y) && G.terrain[idx(x, y)] === TER.ROAD && nat[idx(x, y)] !== TER.WATER) placeNode('car', x, y, 6);
    }
  }
}

// 建筑的矩形到某点的距离（像素）
function structDist(s, px, py) {
  const dx = Math.max(s.x * T - px, 0, px - (s.x + s.w) * T);
  const dy = Math.max(s.y * T - py, 0, py - (s.y + s.h) * T);
  return Math.hypot(dx, dy);
}
// 建筑周围离玩家最近、能站人的格子（去搜索时走到这里）
function structDoor(s, px, py) {
  let best = null, bd = 1e9;
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
    if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) continue;
    if (isBlocked(x, y)) continue;
    const d = Math.hypot((x + 0.5) * T - px, (y + 0.5) * T - py) + (y === s.y + s.h ? 0 : T * 0.5); // 优先正门
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}

// 画城市（在地面之后、营地建筑之前）
function drawCity(ctx, x0, y0, x1, y1) {
  const day = G.phase === 'day';
  // 地上的小物件
  for (const d of G.decor) {
    if (d[1] < (x0 - 1) * T || d[1] > (x1 + 2) * T || d[2] < (y0 - 1) * T || d[2] > (y1 + 3) * T) continue;
    if (d[0] === 'stree') { // 行道树
      drawShadow(ctx, d[1], d[2] - 1, 13, 0.7);
      ctx.drawImage(SPR.ctree.img, d[1] - 8, d[2] - 15, 16, 16);
      continue;
    }
    const im = decorImg(d[0], d[0] === 'signal' ? Math.sin(G.time * 3 + d[1]) > 0.6 : d[3] && !day);
    ctx.drawImage(im.img, d[1] - im.w / 2, d[2] - im.h, im.w, im.h);
  }
  // 建筑（从上往下画，前面的楼挡住后面的楼）
  if (!G.structOrder || G.structOrder.length !== G.structs.length) G.structOrder = G.structs.slice().sort((a, b) => a.y + a.h - b.y - b.h);
  for (const s of G.structOrder) {
    const d = STRUCTS[s.type];
    if (s.x > x1 + 1 || s.x + s.w < x0 - 1 || s.y > y1 + 3 || s.y + s.h < y0 - 1) continue;
    const im = structImg(s.type, s.v), sx = s.x * T, sy = s.y * T - d.ex, bottom = (s.y + s.h) * T;
    if (d.ex > 0) { // 楼房的影子（喷泉这种平的东西没有）
      ctx.fillStyle = 'rgba(10,10,30,0.28)';
      ctx.fillRect(sx + s.w * T, sy + 8, 4, bottom - sy - 6);
      ctx.fillRect(sx + 5, bottom, s.w * T - 1, 3);
    }
    ctx.drawImage(im.img, sx, sy, im.w, im.h);
    if (structEnterable(s)) {
      // 大门口的门垫 + 靠近时显示「进入」
      const en = structEntrance(s); // 实际能进的门口（正门被挡住时换一个）
      if (en) {
        const ex = en.x * T, ey = en.y * T, p = G.player;
        ctx.fillStyle = '#1a1c2c'; ctx.fillRect(ex + 2.5, ey + 0.5, 11, 3.5);
        ctx.fillStyle = s.home ? '#38b764' : '#8f2f2a'; ctx.fillRect(ex + 3, ey + 1, 10, 2.5);
        if (p && Math.hypot(p.x - ex - 8, p.y - ey - 8) < 3 * T) drawWorldLabel(ctx, '▲进入', ex + 8, ey + 13, s.home ? '#a7f070' : '#ffcd75');
      }
    }
    if (s.home) {
      // 营地旗帜
      const fx = sx + 3, fy = sy - 2;
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(fx, fy - 12, 1, 14);
      ctx.fillStyle = '#38b764'; ctx.fillRect(fx + 1, fy - 12 + Math.sin(G.time * 4) * 0.5, 7, 4);
      ctx.fillStyle = '#a7f070'; ctx.fillRect(fx + 1, fy - 12, 7, 1);
    } else if (day && s.left > 0) {
      const bob = Math.sin(G.time * 3 + s.x) * 1.2;
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(sx + s.w * T / 2 - 1.5, sy - 4.5 + bob, 3, 3);
      ctx.fillStyle = '#ffcd75'; ctx.fillRect(sx + s.w * T / 2 - 1, sy - 4 + bob, 2, 2);
    }
  }
  // 大建筑的名字（放大时显示，方便找路）
  if (G.cam.zoom >= 1.5) {
    for (const s of G.structs) {
      if (s.type === 'house' || s.type === 'shop' || s.type === 'fountain') continue;
      if (s.x > x1 + 1 || s.x + s.w < x0 - 1 || s.y > y1 + 2 || s.y + s.h < y0 - 1) continue;
      const name = (s.home ? '营地·' : '') + STRUCTS[s.type].name + (s.home || s.left > 0 ? '' : '（已搜空）');
      drawWorldLabel(ctx, name, (s.x + s.w / 2) * T, (s.y + s.h) * T - 4, s.home ? '#a7f070' : s.left > 0 ? '#f4f4f4' : '#94b0c2');
    }
  }
}

// 夜里还亮着的路灯（只算屏幕附近的）
function cityLights() {
  const tl = screenToWorld(-80, -80), br = screenToWorld(G.sw + 80, G.sh + 80), out = [];
  for (const d of G.decor) {
    if (d[0] !== 'lamp' || !d[3]) continue;
    if (d[1] < tl.x || d[1] > br.x || d[2] < tl.y || d[2] > br.y) continue;
    out.push({ x: d[1] + 2, y: d[2] - 20, r: 2.6 });
  }
  return out;
}
