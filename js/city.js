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

// ---------- 城市地图生成（参考《僵尸毁灭工程》的布局） ----------
// 不是整齐的棋盘：
//   · 主镇：中间一小片不规则的街道网格（营地就在这里），还有一条斜穿的林荫道
//   · 一条弯曲的高速公路横穿地图，路上堵满废弃汽车，路边有加油站和工厂
//   · 西边一条蜿蜒的河，路过河的地方是桥
//   · 弯弯曲曲的乡道连接东边的小村庄、河对岸的郊区住宅区（带尽头回车场）
//   · 乡道旁的农场（农舍 + 谷仓 + 农田），其余地方是大片森林和草地
// G.roads 记录每条路的中心线，画地面时用平滑曲线画出来（游戏逻辑仍按格子）
function cityMapGen(campType) {
  const N = MAP_W * MAP_H;
  G.structs = [];
  G.decor = [];
  G.structAt = new Int16Array(N).fill(-1);
  G.roads = [];
  G.fields = [];
  G.crosswalks = [];
  const nat = (G.natTer = new Uint8Array(N).fill(TER.GRASS)); // 路面下面原本的地形（画地面用）
  G.terrain.fill(TER.GRASS);
  const roadMask = new Uint8Array(N), sidewalk = new Uint8Array(N), occ = new Uint8Array(N), noTree = new Uint8Array(N);
  const ccx = G.coreX + 1, ccy = G.coreY + 1;
  const setT = (x, y, t, n) => { if (!inMap(x, y)) return; const i = idx(x, y); G.terrain[i] = t; if (n !== undefined) nat[i] = n; };

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
  // 从 a 到 b 的弯曲路线：中间加几个随机偏移的控制点
  const wiggle = (a, b, amp, n) => {
    const ctrl = [a], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    for (let k = 1; k < n; k++) {
      const t = k / n, off = rand(-amp, amp);
      ctrl.push([a[0] + dx * t - dy / len * off, a[1] + dy * t + dx / len * off]);
    }
    ctrl.push(b);
    return smooth(ctrl);
  };
  // 把路“刷”到格子上
  const addRoad = (pts, w, kind) => {
    const road = { pts: pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]), w, kind };
    G.roads.push(road);
    const side = kind === 'street' ? 1 : 0, r = w / 2 + side + 1;
    for (const [px, py] of pts) {
      for (let y = Math.floor(py - r); y <= py + r; y++) for (let x = Math.floor(px - r); x <= px + r; x++) {
        if (!inMap(x, y)) continue;
        const i = idx(x, y), d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
        if (d <= w / 2 + 0.15) {
          if (kind === 'dirt') { if (G.terrain[i] === TER.WATER) continue; if (G.terrain[i] !== TER.ROAD) G.terrain[i] = TER.DIRT; }
          else { G.terrain[i] = TER.ROAD; sidewalk[i] = 0; }
          roadMask[i] = 1;
        } else if (side && d <= w / 2 + 1.1 && G.terrain[i] !== TER.ROAD && G.terrain[i] !== TER.WATER) {
          G.terrain[i] = TER.PAVE; sidewalk[i] = 1;
        }
        if (d <= w / 2 + 2.5) noTree[i] = 1;
      }
    }
    return road;
  };
  const cul = (x, y) => { // 尽头回车场（圆形掉头区）
    G.roads.push({ pts: [[x, y]], w: 4, kind: 'circle' });
    for (let yy = Math.floor(y - 3); yy <= y + 3; yy++) for (let xx = Math.floor(x - 3); xx <= x + 3; xx++) {
      if (!inMap(xx, yy)) continue;
      const i = idx(xx, yy);
      if (Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= 2.15) { G.terrain[i] = TER.ROAD; roadMask[i] = 1; }
      noTree[i] = 1;
    }
  };
  const nearestOn = (road, x, y) => road.pts.reduce((b, p) => (Math.hypot(p[0] - x, p[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? p : b));
  const pointAt = (road, f) => road.pts[Math.floor((road.pts.length - 1) * f)];

  // ---- 1) 河流（西边，蜿蜒） ----
  const rx0 = randInt(22, 26), k1 = rand(0, 6.28), k2 = rand(0, 6.28);
  const riverX = (y) => rx0 + 4 * Math.sin(y / 12 + k1) + 2 * Math.sin(y / 5 + k2);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (Math.abs(x + 0.5 - riverX(y + 0.5)) < 1.8) setT(x, y, TER.WATER, TER.WATER);
  }

  // ---- 2) 主镇街道网格（间距不均匀，有的路段缺失，营地街区四周一定有路） ----
  const vx = [ccx - 21 + randInt(-1, 1), ccx - 9, ccx + 8, ccx + 20 + randInt(-1, 1)];
  const hy = [ccy - 19 + randInt(-1, 1), ccy - 8, ccy + 7, ccy + 17 + randInt(-1, 1)];
  const town = { x0: vx[0] - 3, x1: vx[3] + 3, y0: hy[0] - 3, y1: hy[3] + 3 };
  const vSeg = [], hSeg = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const must = (i === 1 || i === 2) && j === 1;
    vSeg.push(must || Math.random() < 0.82 ? [i, j] : null);
  }
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) {
    const must = (j === 1 || j === 2) && i === 1;
    hSeg.push(must || Math.random() < 0.82 ? [i, j] : null);
  }
  for (const s of vSeg) if (s) addRoad(resample([[vx[s[0]], hy[s[1]]], [vx[s[0]], hy[s[1] + 1]]], 0.5), 2, 'street');
  for (const s of hSeg) if (s) addRoad(resample([[vx[s[0]], hy[s[1]]], [vx[s[0] + 1], hy[s[1]]]], 0.5), 2, 'street');
  // 路口斑马线
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) G.crosswalks.push([vx[i], hy[j]]);
  // 斜穿城区西北角的林荫道（打破棋盘格）
  const diag = addRoad(wiggle([vx[0], hy[1] + 1], [vx[1] - 1, hy[0]], 2, 3), 2, 'street');

  // ---- 3) 高速公路（北边，横穿全图，过河有桥） ----
  const hwyY = Math.max(4, hy[0] - randInt(9, 12));
  const hwy = addRoad(wiggle([-2, hwyY + rand(-3, 3)], [MAP_W + 2, hwyY + rand(-3, 3)], 5, 6), 3, 'hwy');
  // 城区北边两条路连到高速
  for (const x of [vx[1], vx[3]]) {
    const p = nearestOn(hwy, x, hy[0]);
    addRoad(wiggle([x, hy[0]], [p[0], p[1]], 1.5, 2), 2, 'rural');
  }

  // ---- 4) 东边的村庄 + 连接的乡道 ----
  const vcx = Math.min(MAP_W - 12, vx[3] + randInt(16, 20)), vcy = Math.min(MAP_H - 12, hy[2] + randInt(4, 8));
  const vill = [];
  vill.push(addRoad(resample([[vcx - 7, vcy], [vcx + 8, vcy]], 0.5), 2, 'street'));
  vill.push(addRoad(resample([[vcx, vcy - 8], [vcx, vcy + 9]], 0.5), 2, 'street'));
  vill.push(addRoad(wiggle([vcx + 8, vcy], [vcx + 6, vcy - 12], 2, 2), 2, 'street'));
  G.crosswalks.push([vcx, vcy]);
  const eastRoad = addRoad(wiggle([vx[3], hy[1]], [vcx - 7, vcy], 4, 4), 2, 'rural');
  addRoad(wiggle([vcx, vcy - 8], nearestOn(hwy, vcx + 4, vcy - 20), 3, 3), 2, 'rural');

  // ---- 5) 河对岸的郊区：一条弯路 + 几条尽头路 ----
  const subRoad = addRoad(wiggle([vx[0], hy[2]], [6, hy[2] + randInt(6, 14)], 4, 4), 2, 'rural'); // 过河
  const subMain = addRoad(wiggle([8, hy[0] - 2], [9, Math.min(MAP_H - 4, hy[3] + 8)], 3, 5), 2, 'street');
  for (let k = 0; k < 4; k++) {
    const p = pointAt(subMain, 0.12 + k * 0.24), dir = k % 2 ? -1 : 1;
    const end = [Math.max(3, Math.min(riverX(p[1]) - 4, p[0] + dir * randInt(5, 8))), p[1] + rand(-3, 3)];
    if (Math.abs(end[0] - p[0]) < 3) continue;
    addRoad(wiggle(p, end, 1.2, 2), 2, 'street');
    cul(end[0], end[1]);
  }
  // 东北角的郊区（城区和村庄之间）
  const neStart = pointAt(eastRoad, 0.45);
  const ne = addRoad(wiggle(neStart, [neStart[0] + rand(-3, 3), neStart[1] - randInt(10, 14)], 3, 3), 2, 'street');
  cul(ne.pts[ne.pts.length - 1][0], ne.pts[ne.pts.length - 1][1]);

  // ---- 6) 往南的乡道 + 农场的土路 ----
  const south = addRoad(wiggle([vx[2], hy[3]], [vx[2] + rand(-14, 14), MAP_H + 2], 6, 4), 2, 'rural');
  const farmRoads = [];
  for (const f of [0.35, 0.75]) {
    const p = pointAt(south, f), dir = Math.random() < 0.5 ? -1 : 1;
    farmRoads.push({ road: addRoad(wiggle(p, [p[0] + dir * randInt(10, 14), p[1] + rand(-3, 3)], 1.5, 2), 1, 'dirt'), dir });
  }
  const p2 = pointAt(subRoad, 0.6);
  farmRoads.push({ road: addRoad(wiggle(p2, [p2[0] + rand(-3, 3), Math.min(MAP_H - 4, p2[1] + randInt(9, 12))], 1.5, 2), 1, 'dirt'), dir: 1 });

  // ---- 建筑放置工具 ----
  const fits = (x, y, w, h) => {
    if (x < 1 || y < 1 || x + w >= MAP_W - 1 || y + h >= MAP_H - 1) return false;
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      const i = idx(xx, yy), inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
      if (occ[i] || roadMask[i]) return false;
      if (inside && (G.terrain[i] === TER.WATER || sidewalk[i] || G.nodes[i])) return false;
    }
    return true;
  };
  const nearRoad = (x, y, w, h, r) => {
    for (let yy = y - r; yy < y + h + r; yy++) for (let xx = x - r; xx < x + w + r; xx++) if (inMap(xx, yy) && roadMask[idx(xx, yy)]) return true;
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
  const inRect = (b, type, tries) => {
    const d = STRUCTS[type];
    for (let t = 0; t < (tries || 30); t++) {
      const x = randInt(b.x0, b.x1 - d.w + 1), y = randInt(b.y0, b.y1 - d.h + 1);
      if (fits(x, y, d.w, d.h)) return place(type, x, y);
    }
    return null;
  };
  // 沿着路两边盖房子
  const alongRoad = (road, pool, every, maxDist) => {
    for (let k = randInt(0, every); k < road.pts.length; k += every) {
      const [px, py] = road.pts[k];
      for (let t = 0; t < 10; t++) {
        const type = pick(pool), d = STRUCTS[type];
        const x = Math.round(px + rand(-maxDist, maxDist) - d.w / 2), y = Math.round(py + rand(-maxDist, maxDist) - d.h / 2);
        if (fits(x, y, d.w, d.h) && nearRoad(x, y, d.w, d.h, 2)) { place(type, x, y); break; }
      }
    }
  };

  // ---- 7) 营地街区 ----
  const camp = { x0: vx[1] + 2, x1: vx[2] - 3, y0: hy[1] + 2, y1: hy[2] - 3 };
  for (let y = camp.y0 - 1; y <= camp.y1 + 1; y++) for (let x = camp.x0 - 1; x <= camp.x1 + 1; x++) {
    const i = idx(x, y);
    if (G.terrain[i] === TER.ROAD || sidewalk[i]) continue;
    G.terrain[i] = TER.DIRT; nat[i] = TER.DIRT; noTree[i] = 1;
  }
  const hd = STRUCTS[campType];
  place(campType, ccx - Math.floor(hd.w / 2), G.coreY - hd.h, { home: true, left: 0 });
  for (let y = camp.y0; y <= camp.y1; y++) for (let x = camp.x0; x <= camp.x1; x++) occ[idx(x, y)] = 1; // 营地里不再盖楼

  // ---- 8) 主镇的街区：先放重要建筑，再按区域填满 ----
  const blocks = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (i === 1 && j === 1) continue;
    const b = { x0: vx[i] + 2, x1: vx[i + 1] - 3, y0: hy[j] + 2, y1: hy[j + 1] - 3, down: i === 1 || j === 1 };
    blocks.push(b);
  }
  blocks.sort(() => Math.random() - 0.5);
  const park = blocks.find((b) => !b.down);
  for (const b of blocks) {
    if (b.down) for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const i = idx(x, y); if (!occ[i] && !roadMask[i] && !sidewalk[i]) { G.terrain[i] = TER.PAVE; nat[i] = TER.PAVE; } }
  }
  const must = ['hospital', 'police', 'firestation', 'school', 'supermarket'];
  for (const type of must) for (const b of blocks.filter((q) => q !== park)) if (inRect(b, type, 25)) break;
  for (const b of blocks) {
    if (b === park) {
      const mx = Math.floor((b.x0 + b.x1) / 2), my = Math.floor((b.y0 + b.y1) / 2);
      if (fits(mx - 1, my - 1, 2, 2)) place('fountain', mx - 1, my - 1);
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
        const i = idx(x, y);
        if (occ[i] || roadMask[i]) continue;
        if (Math.random() < 0.2) placeNode('ctree', x, y, 6);
        else if (Math.random() < 0.06) G.decor.push(['bench', (x + 0.5) * T, (y + 0.7) * T]);
        noTree[i] = 1;
      }
      continue;
    }
    const pool = b.down ? ['apartment', 'office', 'office', 'apartment', 'shop', 'shop'] : ['house', 'house', 'house', 'apartment', 'shop'];
    for (let t = 0; t < 45; t++) inRect(b, pick(pool), 12);
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const i = idx(x, y);
      noTree[i] = 1;
      if (occ[i] || roadMask[i] || sidewalk[i]) continue;
      const r = Math.random();
      if (r < 0.05) placeNode('ctree', x, y, 6);
      else if (r < 0.08) placeNode('dumpster', x, y, 6);
    }
  }
  for (let y = town.y0; y <= town.y1; y++) for (let x = town.x0; x <= town.x1; x++) if (inMap(x, y)) noTree[idx(x, y)] = 1;
  alongRoad(diag, ['house', 'shop', 'apartment'], 5, 4);

  // ---- 9) 路边的建筑 ----
  for (const type of ['gasstation', 'gasstation', 'factory', 'factory']) {
    for (let t = 0; t < 40; t++) {
      const [px, py] = pick(hwy.pts), d = STRUCTS[type];
      const x = Math.round(px + rand(-6, 6) - d.w / 2), y = Math.round(py + rand(-6, 6) - d.h / 2);
      if (fits(x, y, d.w, d.h) && nearRoad(x, y, d.w, d.h, 2)) { place(type, x, y); break; }
    }
  }
  alongRoad(hwy, ['gasstation', 'factory', 'shop', 'house'], 26, 5);
  for (const r of vill) alongRoad(r, ['house', 'house', 'shop', 'apartment', 'gasstation'], 4, 4);
  const vb = { x0: vcx - 9, x1: vcx + 10, y0: vcy - 10, y1: vcy + 11 };
  inRect(vb, 'supermarket', 40); inRect(vb, 'firestation', 30);
  for (const r of G.roads) {
    if (r.kind === 'street' && r !== diag && !vill.includes(r) && r.pts.length > 4 && (r.pts[0][0] < vx[0] - 4 || r.pts[0][0] > vx[3] + 4 || r.pts[0][1] < hy[0] - 4 || r.pts[0][1] > hy[3] + 4 || r === ne))
      alongRoad(r, ['house', 'house', 'house', 'shop'], 4, 4); // 郊区住宅
  }
  alongRoad(subRoad, ['house', 'house', 'shop'], 9, 4);
  alongRoad(eastRoad, ['house', 'shop', 'gasstation'], 10, 4);
  alongRoad(south, ['house', 'barn', 'factory'], 12, 5);

  // ---- 10) 农场：土路尽头的农舍 + 谷仓 + 农田 ----
  for (const { road, dir } of farmRoads) {
    const [ex, ey] = road.pts[road.pts.length - 1];
    const fx = Math.round(ex + (dir > 0 ? 1 : -9)), fy = Math.round(ey - 3);
    for (let y = fy; y < fy + 6; y++) for (let x = fx; x < fx + 8; x++) {
      if (!inMap(x, y)) continue;
      const i = idx(x, y);
      if (occ[i] || roadMask[i] || G.terrain[i] === TER.WATER) continue;
      G.terrain[i] = TER.DIRT; nat[i] = TER.DIRT; noTree[i] = 1; occ[i] = 2;
    }
    G.fields.push([fx, fy, 8, 6]);
    const near = { x0: Math.round(ex) - 8, x1: Math.round(ex) + 8, y0: Math.round(ey) - 9, y1: Math.round(ey) + 9 };
    inRect(near, 'barn', 40); inRect(near, 'house', 40);
    for (let y = near.y0; y <= near.y1; y++) for (let x = near.x0; x <= near.x1; x++) if (inMap(x, y)) noTree[idx(x, y)] = 1;
  }

  // ---- 11) 森林和草地上的树 ----
  const fn = makeNoise(), fn2 = makeNoise();
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    const i = idx(x, y);
    if (noTree[i] || occ[i] || G.terrain[i] !== TER.GRASS || distToCore(x, y) < 10) continue;
    const f = fn(x * 0.09, y * 0.09) * 0.75 + fn2(x * 0.3, y * 0.3) * 0.25;
    const p = f > 0.52 ? 0.55 : f > 0.45 ? 0.16 : 0.03;
    if (Math.random() < p) placeNode(Math.random() < 0.45 ? 'fpine' : 'ftree', x, y, 6);
  }

  // ---- 12) 街景：路灯、消防栓、垃圾、路障、汽车 ----
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    if (sidewalk[i] && !occ[i] && !G.nodes[i]) {
      if ((x * 7 + y * 13) % 9 === 0) G.decor.push(['lamp', (x + 0.5) * T, (y + 0.8) * T, Math.random() < 0.35]);
      else if (Math.random() < 0.04) G.decor.push([pick(['hydrant', 'trash', 'trash', 'papers', 'cone']), (x + rand(0.2, 0.8)) * T, (y + rand(0.3, 0.9)) * T]);
    } else if (G.terrain[i] === TER.ROAD && Math.random() < 0.01 && distToCore(x, y) > 6) {
      G.decor.push([pick(['barrier', 'cone', 'papers']), (x + 0.5) * T, (y + 0.6) * T]);
    }
  }
  // 高速公路上堵满了车，其他路上零星几辆
  for (const r of G.roads) {
    if (r.kind === 'circle' || r.kind === 'dirt') continue;
    const dens = r.kind === 'hwy' ? 0.3 : 0.06;
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
    const im = decorImg(d[0], d[3] && !day);
    ctx.drawImage(im.img, d[1] - im.w / 2, d[2] - im.h, im.w, im.h);
  }
  // 建筑（从上往下画，前面的楼挡住后面的楼）
  if (!G.structOrder || G.structOrder.length !== G.structs.length) G.structOrder = G.structs.slice().sort((a, b) => a.y + a.h - b.y - b.h);
  for (const s of G.structOrder) {
    const d = STRUCTS[s.type];
    if (s.x > x1 + 1 || s.x + s.w < x0 - 1 || s.y > y1 + 3 || s.y + s.h < y0 - 1) continue;
    const im = structImg(s.type, s.v), sx = s.x * T, sy = s.y * T - d.ex, bottom = (s.y + s.h) * T;
    ctx.fillStyle = 'rgba(10,10,30,0.28)';
    ctx.fillRect(sx + s.w * T, sy + 8, 4, bottom - sy - 6);
    ctx.fillRect(sx + 5, bottom, s.w * T - 1, 3);
    ctx.drawImage(im.img, sx, sy, im.w, im.h);
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
