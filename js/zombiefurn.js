// =============================================
//  丧尸末世：建筑内部家具的精细像素模型（照公路求生 js/roadfurn.js 的画法和精细度）
//  每格 32×32 像素（原来的两倍精细），逐像素画在「像素纸」上：
//    · 公路求生的暖色调色板（RDF）、色带渐变 + 棋盘格抖点过渡
//    · 3/4 俯视：箱体上面一截是亮的顶面，下面是暗的正面；高的家具（冰箱、衣柜、货柜）往上探出一截
//    · rdcPolish 体积光（左上暖亮、右下冷暗）、rdcWeather 轻微磨损锈斑、rdcOutSel 深褐彩色描边
//  画好的家具按「种类 + 占地」缓存；js/interior.js 的 paintFurniture 先问这里。
//  名字统一用 zfn / ZFN_ 前缀
// =============================================
const ZFN_S = 32;          // 每格多少像素
const ZFN_UP = 16;         // 高家具往上探出的空间
const ZFN_CACHE = {};
const ZFN = {
  wood: RDF.wood, dark: RDF.dark, steel: RDF.steel, white: RDF.white, sheet: RDF.sheet, red: RDF.red, blue: RDF.blue,
  olive: RDF.olive, green: RDF.green, orange: RDF.orange, plum: RDF.plum, yellow: RDF.yellow, card: RDF.card, copper: RDF.copper,
  teal: ['#a8ccc4', '#7aa49c', '#547c76', '#365450'], navy: ['#8aa0c4', '#5e7498', '#42526e', '#2c3648'],
  glass: ['#cfe4e0', '#93b8b4', '#5f8286', '#3a5056'], screen: ['#5a6a70', '#3a464c', '#242c30'], water: ['#c4e0e0', '#94c0c4', '#6a9ca4'],
  leaf: ['#b4bc6c', '#8a9a50', '#66783c', '#48582c'], hay: ['#f0d488', '#d8b460', '#b08c40', '#806428'], burlap: ['#d8c49a', '#b8a078', '#907a56', '#64543a'],
  chalk: ['#5a7a5a', '#46644a', '#344e3a'], fire: ['#e8987e', '#c66e56', '#a8442e', '#6e2a1c'],
};
const ZFN_BOOKS = ['#c66e56', '#6a94bc', '#8ab45e', '#d8aa3e', '#a0649c', '#dc8a46', '#e2ddd0'];

// ---------- 小工具（坐标：像素，原点 = 占地左上角） ----------
const zfnB = (B, x, y, w, h, R, m) => rdcBox(B, Math.round(x), Math.round(y), Math.round(w), Math.round(h), R, m || 1, 0, 1);
const zfnR = (B, x, y, w, h, c, m) => rdcRect(B, Math.round(x), Math.round(y), Math.round(w), Math.round(h), c, m || 1);
const zfnL = (B, x0, y0, x1, y1, c, m) => rdcLine(B, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), c, m || 1);
const zfnO = (B, x, y, w, h, r, R, m, sh) => rdfRound(B, Math.round(x), Math.round(y), Math.round(w), Math.round(h), r, R, m || 1, sh);
// 3/4 俯视的箱体：上面 top 像素是亮的顶面，下面是正面（从中间色渐变到暗色），交界处一条暗线
function zfnBox(B, x, y, w, h, top, R, m) {
  const n = R.length;
  zfnB(B, x, y, w, top, [R[0], R[1]], m);
  zfnB(B, x, y + top, w, h - top, R.slice(1), m);
  zfnR(B, x, y + top, w, 1, R[Math.min(n - 1, 2)], m);
  zfnR(B, x, y, w, 1, rdcMix(rdcHex(R[0]), 0xfff2c4, 0.4), m); // 顶边受光
}
function zfnKnob(B, x, y) { rdcPix(B, x, y, '#e8e4d8', 2); rdcPix(B, x + 1, y, '#bcb8ae', 2); rdcPix(B, x, y + 1, '#8e8a80', 2); rdcPix(B, x + 1, y + 1, '#625e56', 2); }
function zfnLegs(B, xs, y0, y1, R) { for (const x of xs) for (let y = y0; y < y1; y++) { rdcPix(B, x, y, R[1], 2); rdcPix(B, x + 1, y, R[2], 2); } }
// 门板：凹进去的嵌板（上沿暗、下沿亮）
function zfnPanel(B, x, y, w, h, R) {
  zfnR(B, x, y, w, h, R[1]);
  zfnR(B, x, y, w, 1, R[Math.min(R.length - 1, 3)], 6); zfnR(B, x, y, 1, h, R[Math.min(R.length - 1, 3)], 6);
  zfnR(B, x, y + h - 1, w, 1, R[0]); zfnR(B, x + w - 1, y, 1, h, R[0]);
}
// 一排书 / 货品：高矮不一的彩色小竖条
function zfnBooks(B, x, y, w, h, seed, cols) {
  for (let xx = x; xx < x + w;) {
    const bw = 2 + Math.floor(rdcHash(xx, seed, 3) * 2), bh = h - Math.floor(rdcHash(xx, seed, 5) * 3), c = (cols || ZFN_BOOKS)[Math.floor(rdcHash(xx, seed, 7) * (cols || ZFN_BOOKS).length)];
    if (xx + bw > x + w) break;
    zfnR(B, xx, y + h - bh, bw, bh, c, 7); zfnR(B, xx, y + h - bh, bw, 1, rdcMix(rdcHex(c), 0xffffff, 0.3), 7);
    xx += bw + (rdcHash(xx, seed, 9) < 0.15 ? 1 : 0);
  }
}
// 床：床头板 + 床垫 + 枕头 + 被子（被子颜色 R），W×H 是占地
function zfnBedBase(B, W, H, frame, R, metal) {
  zfnB(B, 1, -6, W - 2, 12, frame, metal ? 2 : 1); zfnR(B, 1, -6, W - 2, 1, frame[0], metal ? 2 : 1);
  zfnB(B, 1, 4, W - 2, H - 6, frame, metal ? 2 : 1);
  zfnO(B, 3, 4, W - 6, H - 10, 3, ZFN.sheet);
  zfnO(B, 6, 6, W - 12, 10, 4, ZFN.white, 1, 0);
  zfnO(B, 3, 19, W - 6, H - 25, 3, R, 1, 0.05);
  zfnR(B, 4, 19, W - 8, 2, rdcMix(rdcHex(R[0]), 0xffffff, 0.35)); // 被子翻折的边
  for (let y = 26; y < H - 8; y += 9) zfnL(B, 6, y, W - 8, y + 2, R[2]);          // 被子褶皱
  zfnB(B, 1, H - 6, W - 2, 5, frame, metal ? 2 : 1);
}

// ---------- 每种家具的画法：(B, W, H)，W/H = 占地像素 ----------
const ZFN_PAINT = {
  rug: (B, W, H) => {
    zfnR(B, 2, 2, W - 4, H - 4, ZFN.plum[2], 7); zfnR(B, 4, 4, W - 8, H - 8, ZFN.plum[1], 7); zfnR(B, 6, 6, W - 12, H - 12, ZFN.red[2], 7);
    for (let x = 6; x < W - 6; x += 4) { rdcPix(B, x, 6, ZFN.yellow[1], 7); rdcPix(B, x + 2, H - 7, ZFN.yellow[1], 7); }
    // 中间的菱形花纹：深色填充 + 金色描边，里面再套一个小菱形
    const cx = Math.round(W / 2), cy = Math.round(H / 2), R0 = Math.min(cy - 9, Math.round(W / 4));
    for (let y = -R0; y <= R0; y++) for (let x = -R0 * 1.6; x <= R0 * 1.6; x++) {
      const d = Math.abs(x) / 1.6 + Math.abs(y);
      if (d > R0) continue;
      const c = d > R0 - 1.2 ? ZFN.yellow[0] : d > R0 * 0.55 ? ZFN.plum[2] : d > R0 * 0.55 - 1.2 ? ZFN.yellow[1] : ZFN.red[1];
      rdcPix(B, Math.round(cx + x), cy + y, c, 7);
    }
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) rdcPix(B, cx + sx * (R0 * 1.6 + 4 + k * 3), cy, ZFN.yellow[1], 7);
    for (let y = 3; y < H - 3; y += 2) { rdcPix(B, 0, y, ZFN.sheet[1], 7); rdcPix(B, 1, y, ZFN.sheet[2], 7); rdcPix(B, W - 1, y, ZFN.sheet[1], 7); rdcPix(B, W - 2, y, ZFN.sheet[2], 7); } // 流苏
  },
  sofa: (B, W) => { // 面朝我们：靠背在上
    zfnO(B, 3, -8, W - 6, 18, 5, ZFN.red);
    for (let k = 0; k < 2; k++) zfnO(B, 8 + k * (W - 16) / 2, 8, (W - 16) / 2 - 1, 16, 4, ZFN.red, 1, 0.02);
    for (const x of [0, W - 9]) zfnO(B, x, 0, 9, 26, 4, ZFN.red, 1, 0.1);
    zfnO(B, 12, -4, 14, 9, 3, ZFN.orange, 1, 0); // 靠垫
    zfnLegs(B, [3, W - 5], 26, 30, ZFN.dark);
  },
  sofab: (B, W) => { // 背对我们：坐垫在上，靠背在下
    for (let k = 0; k < 2; k++) zfnO(B, 8 + k * (W - 16) / 2, 2, (W - 16) / 2 - 1, 12, 4, ZFN.red, 1, 0);
    zfnO(B, 3, 12, W - 6, 17, 5, ZFN.red, 1, 0.2);
    for (let x = 8; x < W - 8; x += 7) zfnR(B, x, 16, 1, 9, ZFN.red[2]); // 靠背的缝线
    for (const x of [0, W - 9]) zfnO(B, x, 0, 9, 28, 4, ZFN.red, 1, 0.1);
  },
  tv: (B, W) => {
    zfnBox(B, 2, 16, W - 4, 14, 4, ZFN.wood); zfnPanel(B, 5, 22, (W - 12) / 2, 6, ZFN.wood); zfnPanel(B, W / 2 + 1, 22, (W - 12) / 2, 6, ZFN.wood);
    zfnR(B, W / 2 - 3, 13, 6, 4, ZFN.dark[1], 2);
    zfnB(B, 3, -8, W - 6, 21, ZFN.dark, 2); zfnB(B, 5, -6, W - 10, 16, ZFN.screen, 3);
    zfnL(B, 7, -5, 12, -5, '#8aa0a8', 3); zfnL(B, 7, -4, 9, -4, '#8aa0a8', 3); rdcPix(B, W - 6, 11, '#d84a3a', 4);
  },
  bookshelf: (B, W) => {
    zfnBox(B, 2, -12, W - 4, 42, 4, ZFN.wood);
    for (let k = 0; k < 3; k++) { const y = -6 + k * 11; zfnR(B, 4, y, W - 8, 9, ZFN.dark[2], 6); zfnBooks(B, 5, y + 1, W - 10, 8, k * 7 + W); zfnR(B, 4, y + 9, W - 8, 2, ZFN.wood[1]); }
  },
  table: (B, W) => {
    zfnLegs(B, [5, W - 7], 18, 29, ZFN.wood);
    zfnBox(B, 3, 4, W - 6, 15, 11, ZFN.wood);
    for (let x = 8; x < W - 6; x += 8) zfnR(B, x, 5, 1, 10, ZFN.wood[1]); // 木纹
    zfnO(B, W / 2 - 4, 6, 8, 6, 3, ZFN.white, 2, 0); zfnR(B, W / 2 - 2, 8, 4, 2, ZFN.orange[1], 7); // 盘子
  },
  plant: (B, W) => {
    zfnB(B, W / 2 - 7, 18, 14, 11, ZFN.copper); zfnR(B, W / 2 - 8, 17, 16, 3, ZFN.copper[0]); zfnR(B, W / 2 - 6, 18, 12, 1, ZFN.dark[1], 6);
    const L = [[-9, 6, 9], [3, 5, 9], [-6, -2, 10], [2, -4, 9], [-2, 3, 11], [-12, 12, 7], [6, 11, 7]];
    for (const [dx, dy, s] of L) zfnO(B, W / 2 + dx, dy, s, s * 0.8, 3, ZFN.leaf, 1, dy < 4 ? 0 : 0.2);
    for (let k = 0; k < 5; k++) rdcPix(B, W / 2 - 6 + k * 3, 2 + (k % 2) * 4, ZFN.leaf[0], 1);
  },
  counter: (B, W) => {
    zfnBox(B, 0, 0, W, 30, 9, ZFN.wood);
    zfnB(B, 0, 0, W, 9, ['#e2e0d8', '#bcb8ae'], 2); zfnR(B, 0, 9, W, 1, ZFN.steel[3], 2); // 台面
    zfnPanel(B, 3, 12, W / 2 - 4, 15, ZFN.wood); zfnPanel(B, W / 2 + 1, 12, W / 2 - 4, 15, ZFN.wood);
    zfnKnob(B, W / 2 - 4, 18); zfnKnob(B, W / 2 + 2, 18);
    zfnO(B, 5, 2, 7, 5, 2, ZFN.orange, 1, 0); zfnR(B, 20, 3, 6, 3, ZFN.blue[1], 7); // 台面上的罐子、碗
  },
  stove: (B, W) => {
    zfnBox(B, 0, 0, W, 30, 12, ZFN.white);
    for (const [x, y] of [[8, 3], [22, 3], [8, 9], [22, 9]]) { rdgBall(B, x, y, 3, ZFN.dark, 2); zfnR(B, x - 1, y, 3, 1, '#a85a2a', 2); }
    zfnB(B, 4, 16, W - 8, 11, ZFN.dark, 2); zfnB(B, 6, 18, W - 12, 7, ZFN.screen, 3); zfnR(B, 8, 15, W - 16, 1, ZFN.steel[1], 2);
    for (let k = 0; k < 4; k++) zfnKnob(B, 5 + k * 7, 13);
  },
  fridge: (B, W) => {
    zfnO(B, 3, -14, W - 6, 44, 3, ZFN.white);
    zfnR(B, 4, -10, W - 8, 1, ZFN.white[0]); zfnR(B, 3, 0, W - 6, 1, ZFN.white[3], 6); // 冷冻室和冷藏室的门缝
    zfnR(B, W - 8, -8, 2, 6, ZFN.steel[2], 2); zfnR(B, W - 8, 4, 2, 12, ZFN.steel[2], 2);
    zfnR(B, 8, 6, 5, 5, ZFN.yellow[1], 7); zfnR(B, 14, 9, 4, 6, ZFN.blue[1], 7); zfnR(B, 9, 13, 6, 1, ZFN.red[1], 7); // 冰箱贴、便条
  },
  chair: (B, W) => {
    zfnB(B, 9, 0, 14, 12, ZFN.wood); for (let x = 12; x < 22; x += 4) zfnR(B, x, 2, 2, 8, ZFN.wood[2], 6);
    zfnBox(B, 7, 11, 18, 10, 6, ZFN.wood);
    zfnLegs(B, [8, 22], 21, 29, ZFN.wood);
  },
  bed: (B, W, H) => zfnBedBase(B, W, H, ZFN.wood, ZFN.blue),
  cbed: (B, W, H) => zfnBedBase(B, W, H, ZFN.steel, ZFN.olive, true),
  hbed: (B, W, H) => { zfnBedBase(B, W, H, ZFN.steel, ZFN.teal, true); for (const x of [0, W - 2]) zfnR(B, x, 22, 2, 22, ZFN.steel[2], 2); zfnR(B, W - 5, 0, 3, 8, '#d84a3a', 4); },
  bunkbed: (B, W, H) => {
    zfnBedBase(B, W, H, ZFN.dark, ZFN.olive, true);
    for (const x of [0, W - 3]) zfnB(B, x, -10, 3, H + 8, ZFN.dark, 2);
    zfnB(B, 2, -12, W - 4, 4, ZFN.dark, 2);
    for (let y = 22; y < H - 6; y += 6) zfnR(B, W - 6, y, 4, 1, ZFN.steel[2], 2); // 梯子
  },
  wardrobe: (B, W) => {
    zfnBox(B, 2, -14, W - 4, 44, 4, ZFN.wood);
    zfnPanel(B, 4, -8, W / 2 - 5, 34, ZFN.wood); zfnPanel(B, W / 2 + 1, -8, W / 2 - 5, 34, ZFN.wood);
    zfnR(B, W / 2, -9, 1, 36, ZFN.wood[3], 6); zfnKnob(B, W / 2 - 3, 6); zfnKnob(B, W / 2 + 2, 6);
    zfnB(B, 2, 26, W - 4, 4, ZFN.wood);
  },
  drawer: (B, W) => {
    zfnBox(B, 5, 10, W - 10, 19, 5, ZFN.wood);
    for (let k = 0; k < 2; k++) { zfnPanel(B, 7, 16 + k * 6, W - 14, 5, ZFN.wood); zfnKnob(B, W / 2 - 1, 18 + k * 6); }
    zfnR(B, W / 2 - 1, 4, 2, 7, ZFN.steel[2], 2); zfnO(B, W / 2 - 6, -3, 12, 8, 3, ZFN.yellow, 1, 0); // 台灯
    zfnR(B, 9, 11, 5, 2, ZFN.red[1], 7); // 一本书
  },
  toilet: (B, W) => {
    zfnO(B, W / 2 - 8, -2, 16, 10, 2, ZFN.white); zfnR(B, W / 2 - 7, -1, 14, 2, ZFN.white[0]); zfnKnob(B, W / 2 + 4, 1);
    zfnO(B, W / 2 - 9, 8, 18, 20, 7, ZFN.white);
    zfnO(B, W / 2 - 6, 11, 12, 12, 5, ZFN.water, 3);
  },
  bathtub: (B, W, H) => {
    zfnO(B, 1, 2, W - 2, H - 4, 8, ZFN.white);
    zfnO(B, 5, 7, W - 10, H - 14, 6, ZFN.water, 3, 0.1);
    for (let k = 0; k < 3; k++) zfnL(B, 9, 16 + k * 12, W - 11, 18 + k * 12, ZFN.water[0], 3);
    zfnR(B, W / 2 - 2, 0, 4, 6, ZFN.steel[1], 2); zfnR(B, W / 2 - 5, 2, 10, 2, ZFN.steel[2], 2);
  },
  sink: (B, W) => {
    zfnBox(B, 4, 8, W - 8, 21, 7, ZFN.wood); zfnPanel(B, 7, 17, W - 14, 9, ZFN.wood); zfnKnob(B, W / 2 - 1, 21);
    zfnO(B, 6, 5, W - 12, 10, 4, ZFN.white, 2, 0); zfnO(B, 9, 7, W - 18, 6, 3, ZFN.water, 3);
    zfnR(B, W / 2 - 1, 1, 2, 6, ZFN.steel[1], 2); zfnR(B, W / 2 - 1, 1, 5, 2, ZFN.steel[1], 2);
    zfnB(B, 8, -12, W - 16, 12, ZFN.glass, 3); zfnL(B, 10, -10, 14, -6, '#e6efe4', 3); // 镜子
  },
  medcab: (B, W) => {
    zfnBox(B, 4, -6, W - 8, 32, 4, ZFN.white);
    zfnR(B, W / 2 - 2, 2, 4, 14, '#c84a3a', 7); zfnR(B, W / 2 - 7, 7, 14, 4, '#c84a3a', 7);
    zfnR(B, 6, 20, W - 12, 1, ZFN.white[3], 6); zfnKnob(B, W - 9, 22);
  },
  desk: (B, W) => {
    zfnBox(B, 1, 6, W - 2, 22, 10, ZFN.wood);
    zfnPanel(B, W - 16, 18, 12, 4, ZFN.wood); zfnPanel(B, W - 16, 23, 12, 4, ZFN.wood); zfnKnob(B, W - 11, 19); zfnKnob(B, W - 11, 24);
    zfnLegs(B, [4], 16, 28, ZFN.wood);
    zfnR(B, 15, 4, 4, 4, ZFN.dark[1], 2); zfnB(B, 7, -10, 20, 15, ZFN.dark, 2); zfnB(B, 9, -8, 16, 10, ['#6a8a90', '#4a6268', '#30424a'], 3); // 显示器
    zfnL(B, 10, -7, 14, -7, '#a8c8cc', 3);
    zfnB(B, 8, 9, 18, 4, ZFN.steel, 2); // 键盘
    zfnR(B, W - 22, 8, 9, 7, ZFN.sheet[0], 7); zfnR(B, W - 20, 10, 5, 1, ZFN.sheet[2], 7); // 文件
    zfnO(B, W - 10, 7, 5, 6, 2, ZFN.red, 1, 0); // 杯子
  },
  filing: (B, W) => {
    zfnBox(B, 4, -10, W - 8, 40, 4, ZFN.steel, 2);
    for (let k = 0; k < 3; k++) { zfnPanel(B, 6, -4 + k * 11, W - 12, 10, ZFN.steel); zfnR(B, W / 2 - 4, 0 + k * 11, 8, 2, ZFN.steel[4], 2); zfnR(B, W / 2 - 2, -2 + k * 11, 4, 1, ZFN.sheet[0], 7); }
  },
  cooler: (B, W) => {
    zfnBox(B, 8, 8, W - 16, 22, 4, ZFN.white);
    zfnR(B, W / 2 - 4, 16, 3, 3, '#5a9ad8', 2); zfnR(B, W / 2 + 1, 16, 3, 3, '#d84a3a', 2); zfnR(B, 11, 22, W - 22, 2, ZFN.steel[3], 2);
    zfnO(B, 9, -10, W - 18, 20, 5, ZFN.water, 3, 0); zfnR(B, 12, -6, 2, 10, '#eaf6f6', 3); // 水桶
  },
  vending: (B, W) => {
    zfnBox(B, 2, -14, W - 4, 44, 4, ZFN.red);
    zfnB(B, 4, -8, W - 12, 28, ZFN.dark, 2);
    for (let r = 0; r < 4; r++) { zfnBooks(B, 5, -7 + r * 7, W - 14, 5, r * 5 + 3, ['#d8aa3e', '#8ab45e', '#6a94bc', '#e8987e', '#e2ddd0']); zfnR(B, 5, -2 + r * 7, W - 14, 1, ZFN.steel[3], 2); }
    zfnR(B, W - 7, -6, 3, 6, ZFN.steel[1], 2); zfnR(B, W - 7, 2, 3, 2, ZFN.yellow[0], 4);
    zfnB(B, 6, 22, W - 12, 5, ZFN.dark, 2); // 取货口
  },
  shelf: (B, W) => {
    zfnBox(B, 0, -2, W, 32, 5, ZFN.steel, 2);
    for (let k = 0; k < 2; k++) { const y = 4 + k * 12; zfnR(B, 2, y, W - 4, 10, ZFN.dark[2], 6); zfnBooks(B, 3, y + 1, W - 6, 9, k * 11 + W, ['#d8aa3e', '#c66e56', '#8ab45e', '#6a94bc', '#e8987e', '#dc8a46']); zfnR(B, 2, y + 10, W - 4, 2, ZFN.steel[1], 2); }
    zfnR(B, 0, 28, W, 2, ZFN.steel[3], 2);
  },
  register: (B, W) => {
    zfnBox(B, 0, 8, W, 22, 9, ZFN.wood); zfnB(B, 0, 8, W, 9, ['#e2e0d8', '#bcb8ae'], 2);
    zfnPanel(B, 3, 20, W - 6, 7, ZFN.wood);
    zfnB(B, 8, -2, 16, 13, ZFN.dark, 2); zfnB(B, 10, 0, 12, 4, ['#a7c870', '#7a9a48'], 4); for (let k = 0; k < 3; k++) zfnR(B, 10 + k * 4, 6, 3, 2, ZFN.steel[1], 2);
    zfnB(B, W - 22, 10, 14, 5, ZFN.steel, 2); zfnR(B, W - 20, 11, 10, 1, '#d84a3a', 4); // 扫码台
  },
  crate: (B, W) => {
    zfnBox(B, 3, 4, W - 6, 25, 8, ZFN.wood);
    for (let y = 13; y < 28; y += 5) zfnR(B, 4, y, W - 8, 1, ZFN.wood[3], 6);
    zfnL(B, 5, 13, W - 6, 27, ZFN.wood[0]); zfnL(B, W - 6, 13, 5, 27, ZFN.wood[0]);
    zfnR(B, 3, 12, 3, 17, ZFN.wood[2]); zfnR(B, W - 6, 12, 3, 17, ZFN.wood[2]);
    zfnR(B, 7, 6, W - 14, 1, ZFN.wood[2]);
  },
  freezer: (B, W) => {
    zfnBox(B, 1, 4, W - 2, 25, 13, ZFN.white);
    zfnB(B, 3, 6, W - 6, 9, ['#e8f4f8', '#c0dce4', '#90b4c0'], 3);
    for (let k = 0; k < 5; k++) rdcPix(B, 5 + k * 5, 8 + (k % 2) * 3, '#ffffff', 3);
    zfnR(B, W / 2 - 5, 19, 10, 2, ZFN.steel[3], 2); zfnR(B, 4, 25, 4, 2, '#73c870', 4);
  },
  rack: (B, W) => { // 仓储货架：橙色横梁 + 钢立柱，上面堆着纸箱
    for (const x of [1, W / 2 - 1, W - 4]) zfnB(B, x, -12, 3, 42, ZFN.steel, 2);
    for (let k = 0; k < 3; k++) {
      const y = -6 + k * 12; zfnR(B, 1, y + 8, W - 2, 3, ZFN.orange[1], 2); zfnR(B, 1, y + 8, W - 2, 1, ZFN.orange[0], 2);
      for (let x = 5; x < W - 12; x += 14) if (rdcHash(x, k, 4) < 0.8) { const bw = 10 + Math.floor(rdcHash(x, k, 6) * 3), bh = 6 + Math.floor(rdcHash(x, k, 8) * 3); zfnBox(B, x, y + 8 - bh, bw, bh, 2, ZFN.card); zfnR(B, x + bw / 2, y + 8 - bh, 1, 2, ZFN.sheet[1], 7); }
    }
    zfnR(B, 1, 29, W - 2, 1, ZFN.steel[3], 2);
  },
  medshelf: (B, W) => {
    zfnBox(B, 2, -12, W - 4, 42, 4, ZFN.white);
    for (let k = 0; k < 3; k++) {
      const y = -6 + k * 11; zfnR(B, 4, y, W - 8, 9, ZFN.white[3], 6);
      for (let x = 5; x < W - 6; x += 5) { const c = ['#f8f6ee', '#c84a3a', '#93c8bc', '#d8aa3e'][(x + k) % 4]; zfnO(B, x, y + 2, 4, 7, 1, [c, rdcMix(rdcHex(c), 0x2e1c3a, 0.3)], 7); }
      zfnR(B, 4, y + 9, W - 8, 2, ZFN.white[1]);
    }
  },
  bars: (B, W) => {
    zfnB(B, 0, 4, W, 3, ZFN.steel, 2); zfnB(B, 0, 22, W, 3, ZFN.steel, 2);
    for (let x = 2; x < W - 1; x += 5) zfnB(B, x, -6, 2, 34, ZFN.steel, 2);
    zfnR(B, W / 2 - 3, 13, 6, 5, ZFN.dark[1], 2); rdcPix(B, W / 2, 15, ZFN.yellow[0], 2); // 门锁
  },
  gunlocker: (B, W) => {
    zfnBox(B, 2, -12, W - 4, 42, 4, ZFN.olive, 2);
    zfnB(B, 5, -6, W - 10, 30, ZFN.dark, 6);
    for (const x of [8, 15, 22]) { zfnR(B, x, -4, 2, 16, ZFN.dark[0], 2); zfnR(B, x - 1, 10, 4, 8, ZFN.wood[2]); zfnR(B, x, -4, 1, 16, ZFN.steel[2], 2); }
    zfnR(B, 5, 20, W - 10, 1, ZFN.olive[3], 2); zfnR(B, W / 2 - 2, 26, 4, 2, ZFN.yellow[1], 2);
  },
  plocker: (B, W) => ZFN_PAINT._locker(B, W, ZFN.navy),
  flocker: (B, W) => ZFN_PAINT._locker(B, W, ZFN.fire),
  locker: (B, W) => ZFN_PAINT._locker(B, W, ZFN.steel),
  _locker: (B, W, R) => {
    zfnBox(B, 2, -12, W - 4, 42, 4, R, 2);
    for (let k = 0; k < 2; k++) {
      const x = 4 + k * (W / 2 - 3); zfnPanel(B, x, -6, W / 2 - 5, 34, R);
      for (let y = -3; y < 4; y += 2) zfnR(B, x + 2, y, W / 2 - 9, 1, R[3], 6); // 通风口
      zfnR(B, x + W / 2 - 9, 10, 2, 5, ZFN.steel[1], 2);
    }
  },
  bench: (B, W) => {
    zfnLegs(B, [4, W - 6], 20, 29, ZFN.dark);
    zfnBox(B, 1, 10, W - 2, 11, 6, ZFN.wood);
    for (let x = 10; x < W - 4; x += 10) zfnR(B, x, 11, 1, 5, ZFN.wood[2]);
  },
  truck: (B, W, H) => { // 消防车（俯视斜角）：车厢 + 驾驶室 + 梯子 + 轮子
    for (const x of [14, W - 30]) for (const y of [4, H - 10]) zfnO(B, x, y, 16, 8, 3, ZFN.dark, 5);
    zfnBox(B, 3, 6, W - 6, H - 14, 14, ZFN.fire);
    zfnB(B, W - 34, 2, 30, H - 10, ZFN.fire); zfnB(B, W - 30, 6, 22, 16, ZFN.glass, 3); zfnL(B, W - 28, 8, W - 22, 14, '#e6efe4', 3);
    zfnR(B, W - 30, 2, 22, 3, '#ffd860', 4); zfnR(B, W - 22, 2, 6, 3, '#5a9ad8', 4); // 警灯
    for (let x = 8; x < W - 40; x += 6) zfnR(B, x, 10, 2, 10, ZFN.steel[1], 2); zfnR(B, 6, 10, W - 46, 2, ZFN.steel[0], 2); zfnR(B, 6, 18, W - 46, 2, ZFN.steel[2], 2); // 梯子
    zfnR(B, 3, H - 22, W - 40, 3, ZFN.sheet[0], 7); // 反光条
    for (let x = 10; x < W - 44; x += 16) zfnPanel(B, x, H - 18, 12, 8, ZFN.fire);
  },
  toolbox: (B, W) => {
    zfnR(B, W / 2 - 6, 8, 12, 2, ZFN.dark[1], 2); zfnR(B, W / 2 - 6, 8, 2, 6, ZFN.dark[1], 2); zfnR(B, W / 2 + 4, 8, 2, 6, ZFN.dark[1], 2);
    zfnBox(B, 4, 13, W - 8, 16, 5, ZFN.fire, 2);
    zfnR(B, 5, 22, W - 10, 1, ZFN.fire[3], 6); zfnR(B, W / 2 - 2, 20, 4, 3, ZFN.steel[1], 2);
  },
  schooldesk: (B, W) => {
    zfnLegs(B, [6, W - 8], 12, 18, ZFN.steel);
    zfnBox(B, 3, 2, W - 6, 11, 8, ZFN.wood); zfnR(B, 8, 4, 8, 3, ZFN.sheet[0], 7); zfnR(B, 18, 5, 6, 1, ZFN.blue[1], 7);
    zfnB(B, 9, 18, 14, 4, ZFN.navy); zfnBox(B, 8, 20, 16, 7, 4, ZFN.navy); zfnLegs(B, [9, 21], 27, 31, ZFN.steel);
  },
  board: (B, W) => {
    zfnB(B, 1, -10, W - 2, 26, ZFN.wood); zfnB(B, 4, -7, W - 8, 20, ZFN.chalk, 1);
    for (let k = 0; k < 4; k++) zfnL(B, 8 + (k % 2) * 6, -4 + k * 4, 8 + (k % 2) * 6 + 10 + (k * 7) % 14, -4 + k * 4, '#d8e0d0', 7);
    zfnL(B, W - 18, -2, W - 10, 6, '#d8e0d0', 7); zfnL(B, W - 10, -2, W - 18, 6, '#d8e0d0', 7);
    zfnB(B, 2, 16, W - 4, 3, ZFN.wood); zfnR(B, 10, 15, 4, 1, '#f8f6ee', 7);
  },
  ltable: (B, W) => {
    zfnLegs(B, [4, W / 2, W - 6], 18, 29, ZFN.steel);
    zfnBox(B, 1, 4, W - 2, 15, 11, ZFN.wood);
    for (let x = 10; x < W - 6; x += 16) { zfnO(B, x, 6, 8, 6, 3, ZFN.white, 2, 0); zfnR(B, x + 2, 8, 4, 2, ZFN.orange[1], 7); }
  },
  machine: (B, W, H) => {
    zfnBox(B, 2, -6, W - 4, H + 4, 12, ZFN.teal, 2);
    zfnB(B, 8, 12, W - 16, 22, ZFN.steel, 2); zfnB(B, 12, 16, 18, 12, ZFN.screen, 3);
    for (let k = 0; k < 4; k++) rdgBall(B, 40 + (k % 2) * 10, 18 + Math.floor(k / 2) * 10, 3, ZFN.steel, 2);
    for (let x = 4; x < W - 4; x += 6) { zfnR(B, x, H - 6, 3, 4, ZFN.yellow[1], 7); zfnR(B, x + 3, H - 6, 3, 4, ZFN.dark[1], 7); } // 警示斜纹
    rdcPix(B, W - 10, 0, '#d84a3a', 4); rdcPix(B, W - 7, 0, '#73c870', 4);
    zfnB(B, 10, -14, 10, 10, ZFN.steel, 2); zfnR(B, 12, -12, 6, 2, ZFN.dark[1], 2); // 料斗
  },
  workbench2: (B, W) => {
    zfnLegs(B, [3, W - 5], 18, 30, ZFN.wood);
    zfnBox(B, 1, 6, W - 2, 14, 9, ZFN.wood);
    zfnB(B, 5, 2, 8, 6, ZFN.steel, 2); zfnR(B, 4, 4, 2, 2, ZFN.steel[3], 2); // 台钳
    zfnR(B, 20, 9, 10, 2, ZFN.steel[1], 2); zfnR(B, 28, 7, 3, 6, ZFN.wood[2]); // 锤子
    zfnR(B, 36, 10, 8, 2, '#c84a3a', 7); zfnR(B, 48, 8, 2, 6, ZFN.steel[2], 2);
    zfnB(B, 4, -10, W - 8, 10, ZFN.wood); for (let x = 8; x < W - 8; x += 7) zfnR(B, x, -8, 2, 6, ZFN.steel[2], 2); // 挂板上的工具
  },
  hay: (B, W) => {
    zfnO(B, 2, 4, W - 4, 25, 4, ZFN.hay);
    for (let y = 8; y < 28; y += 3) for (let x = 4; x < W - 4; x += 3) if (rdcHash(x, y, 2) < 0.4) rdcPix(B, x, y, ZFN.hay[rdcHash(x, y, 3) < 0.5 ? 0 : 2], 1);
    zfnR(B, 2, 12, W - 4, 1, ZFN.wood[3], 6); zfnR(B, 2, 22, W - 4, 1, ZFN.wood[3], 6);
  },
  tractor: (B, W, H) => {
    zfnO(B, 4, H - 26, 22, 24, 8, ZFN.dark, 5); zfnO(B, 9, H - 21, 12, 14, 5, ZFN.steel, 2); // 大后轮
    zfnO(B, W - 22, H - 16, 14, 14, 6, ZFN.dark, 5);
    zfnBox(B, 18, 14, W - 24, 28, 9, ZFN.green);
    zfnB(B, 22, -6, 26, 22, ZFN.dark, 2); zfnB(B, 25, -3, 20, 14, ZFN.glass, 3); zfnB(B, 20, -10, 30, 4, ZFN.green);
    zfnR(B, W - 16, 4, 3, 12, ZFN.dark[1], 2); // 排气管
    for (let x = W - 30; x < W - 10; x += 4) zfnR(B, x, 22, 2, 8, ZFN.green[3], 6);
  },
  sack: (B, W) => {
    zfnO(B, 3, 6, 15, 23, 6, ZFN.burlap); zfnO(B, 14, 9, 15, 20, 6, ZFN.burlap, 1, 0.2);
    zfnR(B, 7, 6, 6, 2, ZFN.burlap[3], 6); zfnR(B, 18, 9, 6, 2, ZFN.burlap[3], 6);
    zfnR(B, 6, 16, 8, 3, ZFN.red[2], 7); zfnR(B, 18, 18, 7, 3, ZFN.green[2], 7);
  },
  pallet: (B, W) => {
    for (let k = 0; k < 4; k++) zfnB(B, 2, 4 + k * 6, W - 4, 4, ZFN.wood);
    for (const x of [3, W / 2 - 2, W - 7]) zfnB(B, x, 4, 4, 23, [ZFN.wood[2], ZFN.wood[3]]);
    zfnBox(B, 8, 0, 14, 12, 4, ZFN.card); zfnR(B, 8, 6, 14, 1, ZFN.card[3], 6); // 一个纸箱
  },
};
// 软的东西（地毯、床、沙发、草垛、麻袋）不做锈斑
const ZFN_SOFT = { rug: 1, sofa: 1, sofab: 1, bed: 1, cbed: 1, hay: 1, sack: 1, plant: 1, toilet: 1, bathtub: 1 };

// 画好的家具图（按种类 + 占地缓存）：{ cv, ox, oy }，cv 是 2 倍精度（1 地图像素 = 2 图像素）
function zfnSprite(k, w, h) {
  const key = k + w + 'x' + h;
  if (ZFN_CACHE[key]) return ZFN_CACHE[key];
  const f = ZFN_PAINT[k]; if (!f) return null;
  const W = w * ZFN_S, H = h * ZFN_S, B = rdcPaper(W + 8, H + ZFN_UP + 6, 4, ZFN_UP);
  f(B, W, H);
  if (!ZFN_SOFT[k]) rdcWeather(B, k.length * 17 + w, -0.25, 9999);
  rdcPolish(B);
  if (k !== 'rug') rdcOutSel(B);
  return (ZFN_CACHE[key] = rdcToCanvas(B));
}
// js/interior.js 的 paintFurniture 先问这里；画了就返回 true（只在丧尸末世）
function zfnPaint(g, f) {
  if (G.mode !== 'zombie') return false;
  const S = zfnSprite(f.k, f.w, f.h);
  if (!S) return false;
  g.drawImage(S.cv, f.x * T - S.ox / 2, f.y * T - S.oy / 2, S.cv.width / 2, S.cv.height / 2);
  return true;
}
