// =============================================
//  角色设置（所有模式通用）：角色 ID + 外观
//  存在 localStorage 的 campking_profile（会跟着「导出存档备份」一起导出）
//  外观 = 预设形象（男女各 12 款，不同风格）；画法：
//    · avDrawFull：精致的全身像素画（20×34 格，自动描边 + 光影），用在角色界面、主菜单
//    · avBuildSprite：16×16 的游戏内小人（丧尸模式主角、荒岛的你、经典/极寒的营地之主）
//    · avLook()：给公路求生 / 修仙门派用的颜色和发型参数
// =============================================
const AV_SKIN = { light: '#f8dcc4', fair: '#f2d0a9', tan: '#d9a77c', brown: '#b07a52', dark: '#7a4e35' };
// hair 发型 · top 上衣 · bot 下装 · acc 配饰 [种类, 颜色]
const AV_LOOKS = [
  // ---------- 男 ----------
  { id: 'm1', n: '废土拾荒者', sex: 'm', skin: 'fair', hair: 'messy', hc: '#3a2a22', top: 'jacket', tc: '#8f6a42', t2: '#566c86', bot: 'pants', bc: '#4a4a55', sc: '#3a2a22', acc: [['goggles', '#73eff7'], ['scarf', '#b13e53']] },
  { id: 'm2', n: '机车骑手', sex: 'm', skin: 'fair', hair: 'slick', hc: '#1a1c2c', top: 'jacket', tc: '#262b44', t2: '#b13e53', bot: 'pants', bc: '#333c57', sc: '#1a1c2c', acc: [['sunglasses', '#1a1c2c'], ['gloves', '#1a1c2c']] },
  { id: 'm3', n: '特种兵', sex: 'm', skin: 'tan', hair: 'buzz', hc: '#4a2f1d', top: 'armor', tc: '#4c5a36', t2: '#6e7d4a', bot: 'pants', bc: '#4c5a36', sc: '#2a2a33', acc: [['beret', '#3b4a2a'], ['gloves', '#3b3b2a']] },
  { id: 'm4', n: '外科医生', sex: 'm', skin: 'light', hair: 'short', hc: '#2a1d14', top: 'labcoat', tc: '#f4f4f4', t2: '#41a6f6', bot: 'pants', bc: '#29366f', sc: '#e8e4d8', acc: [['glasses', '#333c57']] },
  { id: 'm5', n: '高中生', sex: 'm', skin: 'fair', hair: 'short', hc: '#1a1c2c', top: 'suit', tc: '#29366f', t2: '#f4f4f4', bot: 'pants', bc: '#29366f', sc: '#3a2a22', acc: [['tie', '#b13e53']] },
  { id: 'm6', n: '朋克乐手', sex: 'm', skin: 'fair', hair: 'mohawk', hc: '#e04f8f', top: 'jacket', tc: '#1a1c2c', t2: '#f4f4f4', bot: 'pants', bc: '#3b5dc9', sc: '#1a1c2c', acc: [['earring', '#ffcd75'], ['choker', '#94b0c2']] },
  { id: 'm7', n: '西装精英', sex: 'm', skin: 'light', hair: 'slick', hc: '#2a1d14', top: 'suit', tc: '#333c57', t2: '#f4f4f4', bot: 'pants', bc: '#333c57', sc: '#1a1c2c', acc: [['tie', '#ffcd75'], ['glasses', '#1a1c2c']] },
  { id: 'm8', n: '农场主', sex: 'm', skin: 'tan', hair: 'short', hc: '#6e4a2e', top: 'tee', tc: '#b13e53', t2: '#f4f4f4', bot: 'overalls', bc: '#3b5dc9', sc: '#6e4a2e', acc: [['strawhat', '#e4c9a0'], ['beard', '#6e4a2e']] },
  { id: 'm9', n: '赛博黑客', sex: 'm', skin: 'fair', hair: 'messy', hc: '#73eff7', top: 'hoodie', tc: '#262b44', t2: '#73eff7', bot: 'pants', bc: '#1a1c2c', sc: '#73eff7', acc: [['visor', '#73eff7']] },
  { id: 'm10', n: '江湖侠客', sex: 'm', skin: 'fair', hair: 'topknot', hc: '#1a1c2c', top: 'robe', tc: '#3e5a8a', t2: '#ffcd75', bot: 'pants', bc: '#2a3a5a', sc: '#1a1c2c', acc: [['headband', '#b13e53']] },
  { id: 'm11', n: '独眼老兵', sex: 'm', skin: 'tan', hair: 'buzz', hc: '#d8d8d8', top: 'coat', tc: '#5a4a3a', t2: '#94b0c2', bot: 'pants', bc: '#3b3b44', sc: '#2a2a33', acc: [['beard', '#d8d8d8'], ['eyepatch', '#1a1c2c']] },
  { id: 'm12', n: '篮球少年', sex: 'm', skin: 'brown', hair: 'curly', hc: '#1a1c2c', top: 'tank', tc: '#ef7d57', t2: '#f4f4f4', bot: 'shorts', bc: '#ef7d57', sc: '#f4f4f4', acc: [['headband', '#f4f4f4']] },
  // ---------- 女 ----------
  { id: 'f1', n: '废土游侠', sex: 'f', skin: 'fair', hair: 'ponytail', hc: '#6e4a2e', top: 'jacket', tc: '#a8794f', t2: '#333c57', bot: 'pants', bc: '#4a4a55', sc: '#3a2a22', acc: [['bandana', '#b13e53'], ['gloves', '#6e4a2e']] },
  { id: 'f2', n: '机车甜心', sex: 'f', skin: 'light', hair: 'long', hc: '#e8c25a', top: 'jacket', tc: '#b13e53', t2: '#1a1c2c', bot: 'pants', bc: '#1a1c2c', sc: '#1a1c2c', acc: [['sunglasses', '#1a1c2c'], ['earring', '#ffcd75']] },
  { id: 'f3', n: '战地军医', sex: 'f', skin: 'fair', hair: 'bun', hc: '#3a2a22', top: 'armor', tc: '#4c5a36', t2: '#e8e4d8', bot: 'pants', bc: '#4c5a36', sc: '#2a2a33', acc: [['armband', '#e23b3b']] },
  { id: 'f4', n: '白衣医生', sex: 'f', skin: 'light', hair: 'bob', hc: '#2a1d14', top: 'labcoat', tc: '#f4f4f4', t2: '#73b8d8', bot: 'skirt', bc: '#333c57', sc: '#1a1c2c', acc: [['glasses', '#5d275d']] },
  { id: 'f5', n: '水手服少女', sex: 'f', skin: 'fair', hair: 'twintail', hc: '#1a1c2c', top: 'sailor', tc: '#f4f4f4', t2: '#29366f', bot: 'skirt', bc: '#29366f', sc: '#3a2a22', acc: [['ribbon', '#b13e53']] },
  { id: 'f6', n: '朋克少女', sex: 'f', skin: 'fair', hair: 'bob', hc: '#c27bd6', top: 'jacket', tc: '#1a1c2c', t2: '#e04f8f', bot: 'skirt', bc: '#262b44', sc: '#1a1c2c', acc: [['headphones', '#e04f8f'], ['choker', '#1a1c2c']] },
  { id: 'f7', n: '职场精英', sex: 'f', skin: 'light', hair: 'long', hc: '#3a2a22', top: 'suit', tc: '#566c86', t2: '#f4f4f4', bot: 'skirt', bc: '#566c86', sc: '#1a1c2c', acc: [['earring', '#f4f4f4']] },
  { id: 'f8', n: '农场姑娘', sex: 'f', skin: 'tan', hair: 'braid', hc: '#a0603a', top: 'tee', tc: '#f4f4f4', t2: '#f4f4f4', bot: 'overalls', bc: '#3b5dc9', sc: '#6e4a2e', acc: [['strawhat', '#e4c9a0'], ['flower', '#ef7d57']] },
  { id: 'f9', n: '赛博歌姬', sex: 'f', skin: 'fair', hair: 'twintail', hc: '#73eff7', top: 'idol', tc: '#262b44', t2: '#e04f8f', bot: 'skirt', bc: '#e04f8f', sc: '#f4f4f4', acc: [['headphones', '#73eff7']] },
  { id: 'f10', n: '江湖侠女', sex: 'f', skin: 'fair', hair: 'long', hc: '#1a1c2c', top: 'robe', tc: '#b13e53', t2: '#ffcd75', bot: 'longskirt', bc: '#8a2f40', sc: '#1a1c2c', acc: [['hairpin', '#ffcd75']] },
  { id: 'f11', n: '民国旗袍', sex: 'f', skin: 'light', hair: 'bun', hc: '#1a1c2c', top: 'qipao', tc: '#2f7f6a', t2: '#ffcd75', bot: 'qipao', bc: '#2f7f6a', sc: '#1a1c2c', acc: [['flower', '#e23b3b'], ['earring', '#f4f4f4']] },
  { id: 'f12', n: '荒野探险家', sex: 'f', skin: 'tan', hair: 'ponytail', hc: '#3a2a22', top: 'jacket', tc: '#c4a27a', t2: '#f4f4f4', bot: 'shorts', bc: '#8f6a42', sc: '#5a3e28', acc: [['cap', '#a3804f']] },
];
const AV_BY_ID = {};
for (const l of AV_LOOKS) AV_BY_ID[l.id] = l;
const AV_NAME_A = ['夜行', '孤狼', '白鸦', '铁锤', '荒原', '烈火', '寒星', '流浪', '黎明', '风暴', '月影', '赤狐', '青山', '北风', '小满', '阿飞', '老K', '橘子'];
const AV_NAME_B = ['', '', '者', '客', '君', '酱', '侠', '号', '哥', '姐', '仔'];

// ---------- 存取 ----------
let avProfileCache = null;
function avProfile() {
  if (avProfileCache) return avProfileCache;
  let p = null;
  try { p = JSON.parse(Store.get('campking_profile') || 'null'); } catch (e) { p = null; }
  if (!p || !p.name) { p = { name: avRandomName(), look: 'm1', set: false }; Store.set('campking_profile', JSON.stringify(p)); } // 第一次就存下来，ID 不会每次打开都变
  if (!AV_BY_ID[p.look]) p.look = 'm1';
  avProfileCache = p;
  return p;
}
function avSave() { Store.set('campking_profile', JSON.stringify(avProfile())); avApply(); }
function avReload() { avProfileCache = null; avApply(); } // 导入备份后调用
function avRandomName() { return AV_NAME_A[Math.floor(Math.random() * AV_NAME_A.length)] + AV_NAME_B[Math.floor(Math.random() * AV_NAME_B.length)] + (Math.random() < 0.4 ? Math.floor(Math.random() * 90 + 10) : ''); }
function avLook(id) { return AV_BY_ID[id || avProfile().look] || AV_LOOKS[0]; }
function avName() { return avProfile().name; }
function avShade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; } else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}
function avHas(L, k) { const a = L.acc.find((x) => x[0] === k); return a ? a[1] : null; }

// ---------- 精致全身像（20×34 格） ----------
const AV_W = 20, AV_H = 34;
const AV_CACHE = {};
function avGrid(L) {
  const grid = new Array(AV_W * AV_H).fill(null);
  const R = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < AV_W && yy < AV_H) grid[yy * AV_W + xx] = c; } };
  const X = (x, y) => { if (x >= 0 && y >= 0 && x < AV_W && y < AV_H) grid[y * AV_W + x] = null; };
  const skin = AV_SKIN[L.skin], skinD = avShade(skin, -0.14), h = L.hc, hD = avShade(h, -0.25), hL = avShade(h, 0.25);
  const t = L.tc, tD = avShade(t, -0.2), t2 = L.t2, b = L.bc, bD = avShade(b, -0.18), f = L.sex === 'f';
  // 1) 身后：长发、马尾、双马尾、披风
  if (L.hair === 'long') { R(4, 5, 12, 14, hD); R(5, 19, 10, 2, hD); }
  if (L.hair === 'ponytail') { R(14, 3, 3, 3, h); R(15, 6, 2, 9, hD); R(15, 15, 1, 2, hD); }
  if (L.hair === 'twintail') { R(1, 4, 3, 3, h); R(1, 7, 3, 10, hD); R(2, 17, 2, 2, hD); R(16, 4, 3, 3, h); R(16, 7, 3, 10, hD); R(16, 17, 2, 2, hD); }
  if (L.top === 'hoodie') R(5, 9, 10, 4, tD);
  // 2) 下装
  const legsSkin = (y0) => { R(7, y0, 2, 31 - y0, skin); R(11, y0, 2, 31 - y0, skinD); };
  if (L.bot === 'pants' || L.bot === 'overalls') { R(6, 22, 4, 9, b); R(10, 22, 4, 9, bD); R(10, 22, 1, 9, avShade(b, -0.3)); }
  else if (L.bot === 'shorts') { R(6, 22, 8, 4, b); R(10, 22, 4, 4, bD); legsSkin(26); }
  else if (L.bot === 'skirt') { legsSkin(26); R(6, 22, 8, 3, b); R(5, 25, 10, 2, b); R(5, 26, 10, 1, bD); for (let x = 6; x < 14; x += 2) R(x, 23, 1, 3, bD); }
  else if (L.bot === 'longskirt') { R(6, 22, 8, 4, b); R(5, 26, 10, 3, b); R(4, 29, 12, 2, bD); }
  else if (L.bot === 'qipao') { legsSkin(27); }
  // 3) 鞋
  if (f && (L.bot === 'skirt' || L.bot === 'qipao')) { R(6, 31, 3, 2, L.sc); R(11, 31, 3, 2, L.sc); R(8, 32, 1, 1, L.sc); R(13, 32, 1, 1, L.sc); }
  else { R(5, 31, 5, 2, L.sc); R(10, 31, 5, 2, avShade(L.sc, -0.1)); R(5, 32, 5, 1, avShade(L.sc, -0.3)); R(10, 32, 5, 1, avShade(L.sc, -0.3)); }
  // 4) 上身
  const arms = (c, c2) => { R(4, 13, 2, 8, c); R(14, 13, 2, 8, c2 || avShade(c, -0.12)); };
  const hands = (c) => { R(4, 21, 2, 2, c || skin); R(14, 21, 2, 2, c || skinD); };
  R(6, 13, 8, 9, t); R(12, 13, 2, 9, tD);
  if (L.top === 'tee') { arms(skin, skinD); R(4, 13, 2, 3, t); R(14, 13, 2, 3, tD); R(8, 13, 4, 1, avShade(t, -0.3)); }
  else if (L.top === 'tank') { arms(skin, skinD); R(6, 13, 1, 2, skin); R(13, 13, 1, 2, skinD); R(8, 13, 4, 1, skin); R(9, 16, 2, 2, t2); }
  else if (L.top === 'jacket') { arms(t); R(8, 13, 4, 9, t2); R(9, 13, 2, 9, avShade(t2, -0.12)); R(7, 13, 1, 3, tD); R(12, 13, 1, 3, tD); R(7, 16, 1, 6, tD); R(4, 19, 2, 1, tD); R(14, 19, 2, 1, tD); }
  else if (L.top === 'hoodie') { arms(t); R(7, 18, 6, 3, tD); R(8, 14, 1, 3, t2); R(11, 14, 1, 3, t2); R(8, 17, 1, 1, t2); R(11, 17, 1, 1, t2); }
  else if (L.top === 'coat' || L.top === 'labcoat') { arms(t); R(8, 13, 4, 9, t2); R(6, 22, 3, 6, t); R(11, 22, 3, 6, tD); R(7, 13, 1, 9, tD); R(12, 13, 1, 9, tD); R(6, 18, 2, 2, tD); if (L.top === 'labcoat') R(6, 17, 2, 1, '#41a6f6'); }
  else if (L.top === 'armor') { arms(t); R(6, 14, 8, 6, t2); R(7, 16, 2, 3, avShade(t2, -0.25)); R(11, 16, 2, 3, avShade(t2, -0.25)); R(6, 21, 8, 1, '#2a2a33'); R(9, 21, 2, 1, '#94b0c2'); }
  else if (L.top === 'suit') { arms(t); R(8, 13, 4, 6, t2); R(7, 13, 1, 5, tD); R(12, 13, 1, 5, tD); R(8, 18, 1, 1, tD); R(11, 18, 1, 1, tD); R(9, 20, 2, 1, '#ffcd75'); }
  else if (L.top === 'sailor') { arms(t); R(6, 13, 8, 2, t2); R(7, 15, 6, 1, t2); R(8, 16, 4, 1, t2); R(9, 17, 2, 1, avHas(L, 'ribbon') || '#b13e53'); R(4, 19, 2, 1, t2); R(14, 19, 2, 1, t2); R(6, 21, 8, 1, t2); }
  else if (L.top === 'robe') {
    R(3, 13, 3, 9, t); R(14, 13, 3, 9, tD); R(3, 20, 3, 2, avShade(t, -0.3)); R(14, 20, 3, 2, avShade(t, -0.4));
    for (let i = 0; i < 4; i++) { R(7 + i, 13 + i, 1, 1, t2); R(12 - i, 13 + i, 1, 1, avShade(t2, -0.2)); }
    R(6, 19, 8, 2, t2); R(9, 19, 2, 2, avShade(t2, -0.25));
    if (L.bot !== 'longskirt') { R(6, 21, 8, 6, t); R(10, 21, 1, 6, tD); }
  }
  else if (L.top === 'idol') { arms(t); R(6, 13, 8, 1, t2); R(6, 21, 8, 1, t2); R(9, 14, 2, 2, t2); R(8, 15, 1, 1, t2); R(11, 15, 1, 1, t2); R(4, 13, 2, 2, t2); R(14, 13, 2, 2, t2); for (let x = 6; x < 14; x += 2) R(x, 22, 1, 1, t2); }
  else if (L.top === 'qipao') { arms(skin, skinD); R(4, 13, 2, 3, t); R(14, 13, 2, 3, tD); R(8, 12, 4, 1, t); R(9, 13, 3, 1, t2); R(11, 14, 1, 3, t2); R(6, 22, 8, 5, t); R(12, 22, 2, 5, tD); R(11, 23, 1, 4, skin); R(6, 20, 8, 1, t2); }
  if (L.bot === 'overalls') { R(7, 16, 6, 6, b); R(7, 13, 1, 3, b); R(12, 13, 1, 3, b); R(8, 16, 1, 1, '#ffcd75'); R(11, 16, 1, 1, '#ffcd75'); R(8, 18, 4, 1, bD); }
  if (L.top !== 'robe' && L.bot === 'pants') R(6, 21, 8, 1, avShade(b, -0.35));
  hands(avHas(L, 'gloves'));
  // 5) 脖子 + 头
  R(9, 12, 2, 1, skinD);
  R(5, 3, 10, 9, skin); X(5, 3); X(14, 3); X(5, 11); X(14, 11); R(13, 4, 1, 7, avShade(skin, -0.06)); R(4, 7, 1, 2, skin); R(15, 7, 1, 2, skinD);
  // 脸
  const eye = '#1a1c2c';
  R(7, 7, 2, 2, eye); R(11, 7, 2, 2, eye); R(7, 7, 1, 1, '#f4f4f4'); R(11, 7, 1, 1, '#f4f4f4');
  if (f) { R(6, 7, 1, 1, eye); R(13, 7, 1, 1, eye); R(6, 9, 1, 1, '#f0a3a3'); R(13, 9, 1, 1, '#f0a3a3'); R(9, 10, 2, 1, '#d9707a'); }
  else { R(9, 10, 2, 1, '#9a5a4a'); }
  R(7, 6, 2, 1, f ? hL : hD); R(11, 6, 2, 1, f ? hL : hD); if (!f) { R(6, 6, 1, 1, hD); R(13, 6, 1, 1, hD); }
  // 6) 前面的头发
  const bangs = () => { R(5, 2, 10, 3, h); R(4, 3, 1, 5, h); R(15, 3, 1, 5, h); R(6, 5, 2, 1, h); R(9, 5, 1, 1, h); R(12, 5, 2, 1, h); R(6, 2, 5, 1, hL); };
  switch (L.hair) {
    case 'short': R(5, 2, 10, 3, h); R(4, 3, 1, 4, h); R(15, 3, 1, 4, h); R(6, 5, 1, 1, h); R(12, 5, 2, 1, h); R(6, 2, 4, 1, hL); break;
    case 'messy': R(5, 2, 10, 3, h); R(4, 3, 1, 4, h); R(15, 3, 1, 4, h); R(5, 1, 1, 1, h); R(8, 1, 2, 1, h); R(12, 1, 1, 1, h); R(7, 0, 1, 1, h); R(13, 0, 1, 1, h); R(6, 5, 1, 1, h); R(9, 5, 1, 1, h); R(13, 5, 1, 1, h); R(7, 2, 3, 1, hL); break;
    case 'slick': R(5, 2, 10, 2, h); R(4, 3, 1, 4, h); R(15, 3, 1, 4, h); R(6, 4, 3, 1, h); R(6, 2, 7, 1, hL); break;
    case 'buzz': R(5, 2, 10, 2, h); R(4, 3, 1, 3, h); R(15, 3, 1, 3, h); break;
    case 'mohawk': R(8, 0, 4, 4, h); R(9, 0, 1, 4, hL); R(5, 3, 3, 1, avShade(skin, -0.2)); R(12, 3, 3, 1, avShade(skin, -0.2)); break;
    case 'curly': R(4, 1, 12, 4, h); R(4, 1, 1, 1, null); R(15, 1, 1, 1, null); for (let x = 5; x < 15; x += 3) { R(x, 0, 2, 1, h); R(x, 1, 1, 1, hL); } R(4, 5, 1, 2, h); R(15, 5, 1, 2, h); break;
    case 'topknot': R(5, 2, 10, 3, h); R(4, 3, 1, 4, h); R(15, 3, 1, 4, h); R(8, 0, 4, 2, h); R(8, 2, 4, 1, avHas(L, 'headband') || '#ffcd75'); R(9, 0, 1, 1, hL); break;
    case 'long': bangs(); R(4, 7, 1, 7, h); R(15, 7, 1, 7, hD); break;
    case 'bob': bangs(); R(4, 3, 2, 8, h); R(14, 3, 2, 8, hD); R(4, 10, 2, 1, hD); break;
    case 'ponytail': bangs(); R(15, 3, 1, 3, h); break;
    case 'twintail': bangs(); R(3, 4, 1, 2, avHas(L, 'ribbon') || avShade(h, 0.4)); R(16, 4, 1, 2, avHas(L, 'ribbon') || avShade(h, 0.4)); break;
    case 'bun': bangs(); R(7, 0, 6, 2, h); R(8, 0, 2, 1, hL); break;
    case 'braid': bangs(); for (let y = 8; y < 20; y++) R(14 + (y % 2), y, 2, 1, y % 2 ? h : hD); R(14, 20, 2, 1, '#ffcd75'); break;
  }
  // 7) 配饰
  for (const [k, c] of L.acc) {
    if (k === 'goggles') { R(4, 4, 12, 1, '#6e4a2e'); R(6, 3, 3, 2, c); R(11, 3, 3, 2, c); R(6, 3, 1, 1, '#f4f4f4'); R(11, 3, 1, 1, '#f4f4f4'); }
    else if (k === 'sunglasses') { R(6, 7, 3, 2, c); R(11, 7, 3, 2, c); R(9, 7, 2, 1, c); R(7, 7, 1, 1, '#566c86'); R(12, 7, 1, 1, '#566c86'); }
    else if (k === 'glasses') { R(6, 6, 4, 1, c); R(10, 6, 4, 1, c); R(6, 7, 1, 2, c); R(13, 7, 1, 2, c); R(9, 7, 2, 1, c); R(4, 7, 2, 1, c); R(14, 7, 2, 1, c); R(8, 8, 1, 1, '#c8e8f8'); R(12, 8, 1, 1, '#c8e8f8'); }
    else if (k === 'beret') { R(4, 1, 11, 2, c); R(5, 0, 7, 1, c); R(13, 3, 2, 1, c); R(6, 1, 2, 1, '#ffcd75'); }
    else if (k === 'cap') { R(5, 1, 10, 3, c); R(3, 4, 9, 1, avShade(c, -0.25)); R(6, 1, 4, 1, avShade(c, 0.25)); }
    else if (k === 'strawhat') { R(6, 0, 8, 3, c); R(2, 3, 16, 1, c); R(1, 4, 18, 1, avShade(c, -0.2)); R(6, 2, 8, 1, '#b13e53'); }
    else if (k === 'bandana') { R(5, 4, 10, 1, c); R(5, 3, 10, 1, avShade(c, -0.15)); R(15, 4, 2, 1, c); R(16, 5, 1, 2, c); }
    else if (k === 'headband') { if (L.hair !== 'topknot') { R(5, 4, 10, 1, c); R(15, 4, 1, 1, c); R(16, 5, 1, 3, c); } else { R(16, 2, 1, 4, c); } }
    else if (k === 'visor') { R(5, 7, 10, 2, c); R(5, 7, 10, 1, avShade(c, 0.4)); R(4, 7, 1, 2, '#333c57'); R(15, 7, 1, 2, '#333c57'); }
    else if (k === 'eyepatch') { R(11, 7, 2, 2, c); R(5, 5, 10, 1, c); }
    else if (k === 'beard') { R(6, 10, 8, 2, c); R(7, 12, 6, 1, c); R(9, 10, 2, 1, '#9a5a4a'); R(5, 8, 1, 3, c); R(14, 8, 1, 3, c); }
    else if (k === 'scarf') { R(6, 12, 8, 2, c); R(12, 14, 2, 4, avShade(c, -0.2)); R(12, 18, 1, 1, c); }
    else if (k === 'earring') { R(4, 9, 1, 1, c); R(15, 9, 1, 1, c); }
    else if (k === 'headphones') { R(5, 1, 10, 1, '#333c57'); R(4, 2, 1, 4, '#333c57'); R(15, 2, 1, 4, '#333c57'); R(3, 6, 2, 4, c); R(15, 6, 2, 4, c); }
    else if (k === 'flower') { R(12, 1, 3, 3, c); R(13, 2, 1, 1, '#ffcd75'); }
    else if (k === 'hairpin') { R(13, 0, 1, 4, c); R(12, 0, 3, 1, c); R(14, 4, 1, 2, '#e23b3b'); }
    else if (k === 'armband') { R(14, 15, 2, 2, '#f4f4f4'); R(14, 15, 1, 2, c); R(15, 16, 1, 1, c); }
    else if (k === 'choker') R(8, 12, 4, 1, c);
    else if (k === 'tie') { R(9, 13, 2, 1, c); R(9, 14, 2, 5, avShade(c, -0.1)); R(9, 19, 1, 1, c); }
  }
  return grid;
}
// 把格子画成图片：自动描边 + 上亮下暗
function avImage(id) {
  if (AV_CACHE[id]) return AV_CACHE[id];
  const L = avLook(id), grid = avGrid(L), W = AV_W + 2, H = AV_H + 2;
  const cv = createCanvas(W, H), g = cv.getContext('2d');
  const at = (x, y) => (x < 0 || y < 0 || x >= AV_W || y >= AV_H ? null : grid[y * AV_W + x]);
  for (let y = -1; y <= AV_H; y++) for (let x = -1; x <= AV_W; x++) {
    const c = at(x, y);
    if (c) {
      let col = c;
      if (!at(x, y - 1)) col = avShade(c, 0.14); else if (!at(x, y + 1)) col = avShade(c, -0.16); else if (!at(x + 1, y)) col = avShade(c, -0.08);
      g.fillStyle = col; g.fillRect(x + 1, y + 1, 1, 1);
    } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) { g.fillStyle = '#1a1c2c'; g.fillRect(x + 1, y + 1, 1, 1); }
  }
  return (AV_CACHE[id] = cv);
}
// 画全身像：x,y 是脚底中心，scale 每格多少像素
function avDrawFull(ctx, id, x, y, scale) {
  const img = avImage(id), old = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(x - img.width * scale / 2), Math.round(y - img.height * scale), img.width * scale, img.height * scale);
  ctx.imageSmoothingEnabled = old;
}

// ---------- 16×16 游戏内小人（套用 sprites.js 的 makeSprite，有同样的光影和 2 倍高清） ----------
// 临时颜色放在调色板的 1~7 号：1 头发 2 皮肤 3 上衣 4 上衣第二色 5 下装 6 鞋 7 配饰
function avBuildSprite(id) {
  const L = avLook(id), pal = { 1: L.hc, 2: AV_SKIN[L.skin], 3: L.tc, 4: L.t2, 5: L.bc, 6: L.sc, 7: (L.acc[0] || [0, '#ffcd75'])[1] };
  for (const k in pal) { PALETTE[k] = pal[k]; PAL_RGB[k] = hexRgb(pal[k]); }
  const rows = [
    '................', '......kkkkk.....', '.....k11111k....', '.....k12221k....',
    '.....k2k2k2k....', '.....k22222k....', '......kkkkk.....', '.....k33433k....',
    '....k2334332k...', '....k2334332k...', '.....k33333k....', '.....k55555k....',
    '.....k55k55k....', '.....k5k.k5k....', '.....k6k.k6k....', '......k...k.....',
  ].map((r) => r.split(''));
  const set = (x, y, c) => { if (y >= 0 && y < 16 && x >= 0 && x < 16) rows[y][x] = c; };
  const f = L.sex === 'f';
  // 上衣：长袖 / 短袖
  if (L.top === 'tee' || L.top === 'tank' || L.top === 'qipao') { set(5, 8, '2'); set(10, 8, '2'); set(5, 9, '2'); set(10, 9, '2'); }
  else { set(5, 8, '3'); set(10, 8, '3'); }
  if (L.top === 'tee' || L.top === 'idol' || L.top === 'hoodie') { set(8, 7, '3'); set(8, 8, '3'); set(8, 9, '3'); }
  if (L.top === 'robe' || L.top === 'labcoat' || L.top === 'coat') { set(4, 10, 'k'); set(5, 10, '3'); set(10, 10, '3'); set(11, 10, 'k'); }
  // 下装
  if (L.bot === 'skirt' || L.bot === 'longskirt' || L.bot === 'qipao') {
    const sk = L.bot === 'qipao' ? '3' : '5';
    rows[11] = '....k5555555k...'.replace(/5/g, sk).split(''); rows[12] = '.....k2k.k2k....'.split('');
    if (L.bot === 'longskirt') rows[12] = '....k5555555k...'.split('');
  } else if (L.bot === 'shorts') { rows[12] = '.....k22k22k....'.split(''); rows[13] = '.....k2k.k2k....'.split(''); }
  // 发型
  if (['long', 'bob', 'braid'].includes(L.hair) || (f && L.hair !== 'ponytail' && L.hair !== 'twintail' && L.hair !== 'bun')) { set(5, 3, '1'); set(11, 3, '1'); set(5, 4, '1'); set(11, 4, '1'); set(4, 3, 'k'); set(12, 3, 'k'); set(4, 4, 'k'); set(12, 4, 'k'); }
  if (L.hair === 'long') { set(4, 5, 'k'); set(5, 5, '1'); set(11, 5, '1'); set(12, 5, 'k'); set(5, 6, '1'); set(11, 6, '1'); }
  if (L.hair === 'ponytail') { set(11, 3, '1'); set(12, 3, '1'); set(12, 4, '1'); set(13, 4, 'k'); set(12, 5, '1'); set(13, 3, 'k'); set(12, 6, 'k'); }
  if (L.hair === 'twintail') { set(4, 3, '1'); set(12, 3, '1'); set(4, 4, '1'); set(12, 4, '1'); set(4, 5, '1'); set(12, 5, '1'); set(3, 3, 'k'); set(13, 3, 'k'); set(3, 4, 'k'); set(13, 4, 'k'); set(3, 5, 'k'); set(13, 5, 'k'); set(4, 6, 'k'); set(12, 6, 'k'); }
  if (L.hair === 'bun' || L.hair === 'topknot') { set(7, 0, 'k'); set(8, 0, 'k'); set(9, 0, 'k'); set(8, 1, '1'); }
  if (L.hair === 'mohawk') { set(8, 0, 'k'); set(8, 1, '1'); set(7, 2, '2'); set(9, 2, '2'); set(6, 2, '2'); set(10, 2, '2'); }
  if (L.hair === 'messy' || L.hair === 'curly') { set(6, 0, 'k'); set(9, 0, 'k'); set(6, 1, '1'); set(9, 1, '1'); }
  // 配饰
  if (avHas(L, 'sunglasses') || avHas(L, 'visor')) { const c = avHas(L, 'visor') ? '7' : 'k'; set(6, 4, c); set(7, 4, c); set(8, 4, c); set(9, 4, c); set(10, 4, c); }
  if (avHas(L, 'beard')) { set(7, 5, '1'); set(8, 5, '1'); set(9, 5, '1'); }
  if (avHas(L, 'cap') || avHas(L, 'beret') || avHas(L, 'strawhat')) { for (let x = 6; x <= 10; x++) set(x, 2, '7'); set(5, 2, '7'); set(11, 2, '7'); if (avHas(L, 'strawhat')) { set(4, 3, '7'); set(12, 3, '7'); } }
  if (avHas(L, 'bandana') || avHas(L, 'headband') || avHas(L, 'goggles')) { for (let x = 6; x <= 10; x++) set(x, 3, '7'); }
  if (avHas(L, 'scarf')) { set(6, 7, '7'); set(7, 7, '7'); set(9, 7, '7'); set(10, 7, '7'); }
  return makeSprite(rows.map((r) => r.join('')));
}
// 把当前角色套到各模式：丧尸模式的主角、荒岛的「你」、经典/极寒的营地之主
function avApply() {
  if (typeof SPR === 'undefined' || !SPR.player) return;
  const s = avBuildSprite();
  SPR.player = s; SPR.villagerme = s; SPR.avatar = s;
}

// ---------- 经典 / 极寒：营地之主站在主基地旁边 ----------
function avDrawCommander(ctx) {
  const c = G.core;
  if (!c || !SPR.avatar) return;
  void 0;
  const sz = (c.size || 2) * T;
  // 在主基地门口左右踱步
  const ph = G.time * 0.35, walk = Math.sin(ph) * T * 0.9;
  const x = c.cx + walk, y = c.cy + sz / 2 + 7;
  const moving = Math.abs(Math.cos(ph)) > 0.25, face = Math.cos(ph) >= 0 ? 1 : -1;
  const bob = moving ? -Math.abs(Math.sin(G.time * 9)) * 1.2 : 0;
  drawShadow(ctx, x, y + 1, 11);
  ctx.drawImage(face < 0 ? SPR.avatar.flip : SPR.avatar.img, x - 8, y - 14 + bob, 16, 16);
  drawWorldLabel(ctx, avName(), x, y - 18, '#ffcd75');
}

// ---------- 角色设置界面 ----------
function avOpen(from) { G.avFrom = from || 'title'; G.avFilter = G.avFilter || 'all'; gotoScene('avatar'); if (G.scroll) G.scroll.avatar = 0; }
function avEditName() {
  const P = avProfile();
  const v = window.prompt('输入角色 ID（最多 8 个字）', P.name);
  if (v == null) return;
  const s = v.replace(/\s+/g, '').slice(0, 8);
  if (s) { P.name = s; P.set = true; avSave(); }
}
function drawAvatarScene(ctx) {
  const sw = G.sw, sh = G.sh, P = avProfile(), L = avLook();
  drawText(ctx, '角色设置', sw / 2, 34, 22, '#ffcd75', 'center');
  drawButton(ctx, 10, 12, 70, 34, '返回', () => gotoScene(G.avFrom === 'modes' ? 'modes' : 'title'), { size: 13 });
  const wide = sw >= 700 || (sw > sh && sw >= 560); // 横屏（含横屏手机）：左边预览、右边列表
  // ---- 预览卡片 ----
  const pw = wide ? (sw >= 700 ? 250 : 210) : Math.min(sw - 20, 420), ph = wide ? sh - 70 : 176;
  const px = wide ? 12 : (sw - pw) / 2, py = 60;
  drawPanel(ctx, px, py, pw, ph);
  // 背景小舞台（矮屏幕时人物缩小，下面的按钮才放得下）
  const scale = wide ? Math.max(3, Math.min(6, Math.floor((ph - 110) / 38))) : 4, stageH = 36 * scale + 14;
  ctx.fillStyle = 'rgba(65,166,246,0.08)'; ctx.fillRect(px + 8, py + 8, wide ? pw - 16 : 120, wide ? stageH : ph - 16);
  const stageX = wide ? px + pw / 2 : px + 68, stageY = wide ? py + stageH - 2 : py + ph - 14;
  drawShadow(ctx, stageX, stageY, 60);
  avDrawFull(ctx, P.look, stageX, stageY + scale, scale);
  // 信息和按钮
  const ix = wide ? px + 14 : px + 140, iy = wide ? py + stageH + 24 : py + 22, iw = wide ? pw - 28 : pw - 152;
  drawText(ctx, P.name, ix, iy, 18, '#f4f4f4', 'left');
  drawText(ctx, (L.sex === 'f' ? '♀ ' : '♂ ') + L.n, ix, iy + 24, 13, L.sex === 'f' ? '#f0a3c8' : '#73b8f0', 'left', false);
  const bw = Math.min(110, (iw - 6) / 2);
  drawButton(ctx, ix, iy + 42, bw, 34, '修改ID', avEditName, { color: '#1f5e3a', size: 13 });
  drawButton(ctx, ix + bw + 6, iy + 42, bw, 34, '随机ID', () => { P.name = avRandomName(); P.set = true; avSave(); }, { size: 13 });
  if (wide) {
    const tips = ['ID 会显示在：', '· 丧尸求生 / 荒岛求生的「你」', '· 修仙门派新开局的掌门', '· 公路求生的主角和聊天室', '· 经典 / 极寒营地之主的头顶', '外观会用在各模式的主角身上', '（已经开始的存档不会改名）'];
    tips.forEach((t, i) => { const ty = iy + 98 + i * 18; if (ty < py + ph - 8) drawText(ctx, t, ix, ty, 11, i ? '#94b0c2' : '#c8d6e5', 'left', false); });
  }
  // ---- 形象列表 ----
  const gx = wide ? px + pw + 12 : 10, gy = wide ? 60 : py + ph + 10, gw = sw - gx - 12, gh = sh - gy - 10;
  const tabs = [['all', '全部'], ['m', '男'], ['f', '女']];
  tabs.forEach(([k, l], i) => drawButton(ctx, gx + i * 64, gy, 60, 30, l, () => { G.avFilter = k; if (G.scroll) G.scroll.avatar = 0; }, { active: G.avFilter === k, color: G.avFilter === k ? '#29366f' : '#333c57', size: 13 }));
  drawText(ctx, AV_LOOKS.length + ' 款形象', gx + gw, gy + 15, 11, '#94b0c2', 'right', false);
  const list = AV_LOOKS.filter((l) => G.avFilter === 'all' || l.sex === G.avFilter);
  const cw = 92, chh = 124, cols = Math.max(2, Math.floor((gw - 4) / (cw + 8))), gap = (gw - cols * cw) / Math.max(1, cols - 1);
  const top = gy + 38;
  beginScroll(ctx, 'avatar', gx, top, gw - 8, gh - 38);
  list.forEach((l, i) => {
    const cx = gx + (i % cols) * (cw + Math.min(gap, 14)), cy = top + 4 + Math.floor(i / cols) * (chh + 8);
    const sel = l.id === P.look;
    ctx.fillStyle = sel ? 'rgba(255,205,117,0.18)' : 'rgba(38,43,68,0.9)'; ctx.fillRect(cx, cy, cw, chh);
    ctx.strokeStyle = sel ? '#ffcd75' : '#566c86'; ctx.lineWidth = 2; ctx.strokeRect(cx + 1, cy + 1, cw - 2, chh - 2);
    drawShadow(ctx, cx + cw / 2, cy + 96, 30);
    avDrawFull(ctx, l.id, cx + cw / 2, cy + 99, 2.5);
    drawText(ctx, l.n, cx + cw / 2, cy + 112, 11, sel ? '#ffcd75' : '#f4f4f4', 'center');
    drawText(ctx, l.sex === 'f' ? '♀' : '♂', cx + cw - 9, cy + 11, 11, l.sex === 'f' ? '#f0a3c8' : '#73b8f0', 'center');
    addButton(cx, cy, cw, chh, () => { P.look = l.id; P.set = true; avSave(); sfx('click'); });
  });
  endScroll(ctx, top + 4 + Math.ceil(list.length / cols) * (chh + 8));
}
