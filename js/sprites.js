// =============================================
//  像素画：每个字符代表一种颜色，'.' 是透明
//  很多建筑共用模板，通过“换色”（subst）做出不同样子
// =============================================
const PALETTE = {
  k: '#1a1c2c', p: '#5d275d', m: '#9a4fb0', r: '#b13e53', o: '#ef7d57', y: '#ffcd75',
  l: '#a7f070', G: '#38b764', e: '#1f5e3a', t: '#257179', u: '#3b5dc9', c: '#41a6f6',
  a: '#73eff7', w: '#f4f4f4', s: '#94b0c2', d: '#566c86', D: '#333c57', b: '#6e4a2e',
  h: '#b07a45', f: '#8f6a42', F: '#a3804f', T: '#e4c9a0', U: '#c4a27a', n: '#29366f',
  S: '#e8b796', H: '#4a2f1d', C: '#3b5dc9', P: '#333c57', Z: '#8db36b', g: '#5a7a45',
};
const FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';

// 以后移植到微信/抖音小游戏时，只需要改这一个函数
function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---------- 自然资源 ----------
const SPR_TREE = [
  '.....kkkkkk.....', '...kkGGGGGGkk...', '..kGGlGGGGGGek..', '.kGlGGGGGGGGGek.',
  '.kGGGGGlGGGGGek.', 'kGGlGGGGGGGGeeek', 'kGGGGGGGGGGeGeek', 'keGGGGGGGeGGeeek',
  '.keGGeGGGGGeeek.', '.keeeGGGeeGeeek.', '..kkeeeeeeeekk..', '....kkkbbkkk....',
  '......kbhk......', '......kbhk......', '.....kbbhbk.....', '......kkkk......',
];
const SPR_PINE = [
  '.......kk.......', '......kwwk......', '.....kwwewk.....', '.....keeeek.....',
  '....kwweewwk....', '...kweeeeeeek...', '...keeeeeeeek...', '..kwwweeeewwwk..',
  '..keeeeeeeeeek..', '.kwweeeeeeeewwk.', '.keeeeeeeeeeeek.', '..kkkkkbbkkkkk..',
  '.......bh.......', '.......bh.......', '......kbbk......', '................',
];
const SPR_PALM = [
  '........G.......', '...GGG.GGG.GG...', '..GlGGGGGGGGlG..', '.GG..GGlGG..GG..',
  '.G..GG.bb.GG..G.', '...G...hb...G...', '.......hb.......', '......hb........',
  '......hb........', '......bh........', '......hb........', '.......hb.......',
  '.......hb.......', '......bhbb......', '.....kkkkkk.....', '................',
];
const SPR_BERRY = [
  '................', '................', '................', '.....kkkkkk.....',
  '...kkGGGGGGkk...', '..kGGrGGlGGrGk..', '.kGGGGGGrGGGGek.', '.kGrGlGGGGGrGek.',
  '.kGGGGrGGGGGeek.', '.keGGGGGlrGGeek.', '..keeGrGGGGeek..', '...kkeeeeeekk...',
  '.....kkkkkk.....',
];
const SPR_ROCK = [
  '................', '................', '................', '................',
  '......kkkkk.....', '....kkssswskk...', '...kssswwssssk..', '..ksswssssssdk..',
  '..kssssssssddk..', '.kdsssssssddddk.', '.kdssssdsddddDk.', '.kddsssddddDDDk.',
  '..kdddddddDDDk..', '...kkkkkkkkkk...',
];
const SPR_DEADTREE = [
  '................', '....k.....k.....', '...kbk...kbk....', '....kbk.kbk..k..',
  '.....kbkbk..kbk.', '..k...kbbkkbk...', '.kbk..kbbbbk....', '..kbkkbbbk......',
  '....kbbbk.......', '.....kbbk.......', '.....kbhk.......', '.....kbhk.......',
  '.....kbbk.......', '....kbbhbk......', '.....kkkk.......',
];
const SPR_RUIN = [
  '................', '.......kk.......', '.....kkddkk.....', '...kkdDdddDkk...',
  '..kdddDddkdddk..', '.kkkkkkk..kkkkk.', '..ksssskk.ksssk.', '..kskkskssskkk..',
  '..kskDkssskDsk..', '..kssssssssssk..', '..kssskkkssssk..', '..ksskDDkssDsk..',
  '..ksskDDksssskk.', '..kddkDDkdddddk.', '..kkkkkkkkkkkkk.',
];
const SPR_CAR = [
  '................', '................', '................', '................',
  '....kkkkkkk.....', '...krrrrrrrk....', '..krkakkakrrk...', '..krkaakaakrrk..',
  '.krrrrrrrrrrrrk.', '.korrrrbrrrrrok.', '.kbrrrrrrrrrrbk.', '.kkkDDkkkkDDkkk.',
  '...kDDk...kDDk..', '....kk.....kk...',
];

// ---------- 建筑 ----------
const SPR_WALL = [
  '................', '................', '.kk..kk..kk..kk.', 'khhkkhhkkhhkkhhk',
  'khbkkhbkkhbkkhbk', 'khbkkhbkkhbkkhbk', 'kkkkkkkkkkkkkkkk', 'khhhhhhhhhhhhhhk',
  'kkkkkkkkkkkkkkkk', 'khbkkhbkkhbkkhbk', 'khbkkhbkkhbkkhbk', 'khbkkhbkkhbkkhbk',
  'khbkkhbkkhbkkhbk', 'kbbkkbbkkbbkkbbk', 'kkkkkkkkkkkkkkkk',
];
const SPR_STONEWALL = [
  '................', 'kkkkkkkkkkkkkkkk', 'ksswsdksswsdkswk', 'kdddddkdddddkddk',
  'kkkkkkkkkkkkkkkk', 'kswksswsdksswsdk', 'kddkdddddkdddddk', 'kkkkkkkkkkkkkkkk',
  'ksswsdksswsdkswk', 'kdddddkdddddkddk', 'kkkkkkkkkkkkkkkk', 'kswksswsdksswsdk',
  'kddkdddddkdddddk', 'kkkkkkkkkkkkkkkk',
];
const SPR_TOWER = [
  '......kkkk......', '.....krrrrk.....', '....krrorrrk....', '...krrrrrrrrk...',
  '..kkkkkkkkkkkk..', '...khbhbhbhbk...', '...khkkkkkkhk...', '...khkbbbbkhk...',
  '...khbhbhbhbk...', '....khbbbbhk....', '....khbkkbhk....', '...kdssssssdk...',
  '...ksswsssssk...', '...kssssssssk...', '...kdddddddDk...', '....kkkkkkkk....',
];
const SPR_CANNON = [
  '................', '................', '......kkkk......', '.....kDDDDk.....',
  '....kDdddDDk....', '....kDkkkkDk....', '....kDDDDDDk....', '...kkkkkkkkkk...',
  '..kssdssdssdsk..', '..kswssssssssk..', '..kssssssssssk..', '..kdssdssdssdk..',
  '..ksssssssssdk..', '..kdddddddddDk..', '...kkkkkkkkkk...',
];
const SPR_HOUSE = [ // R = 屋顶颜色
  '................', '......kkkk......', '.....kRRRRk.....', '....kRRRRRRk....',
  '...kRRRRRRRRk...', '..kRRRRRRRRRRk..', '.kkkkkkkkkkkkkk.', '..khhhhhhhhhhk..',
  '..khbbhhhhbbhk..', '..khbyhhhhbyhk..', '..khhhhkkhhhhk..', '..khhhhkbkhhhk..',
  '..khhhhkbkhhhk..', '..kbbbbkbkbbbk..', '..kkkkkkkkkkkk..',
];
const SPR_SPIKES = [
  '................', '................', '................', '................',
  '..k...k...k...k.', '.kwk.kwk.kwk.kwk', '.ksk.ksk.ksk.ksk', 'kdsdkdsdkdsdkdsd',
  'kbbbbbbbbbbbbbbk', '..k...k...k...k.', '.kwk.kwk.kwk.kwk', '.ksk.ksk.ksk.ksk',
  'kdsdkdsdkdsdkdsd', 'kbbbbbbbbbbbbbbk',
];
const SPR_FARM = [
  '................', '.kkkkkkkkkkkkkk.', '.kflfflfflfflfk.', '.kfGffGffGffGfk.',
  '.kbbbbbbbbbbbbk.', '.kflfflfflfflfk.', '.kfGffGffGffGfk.', '.kbbbbbbbbbbbbk.',
  '.kflfflfflfflfk.', '.kfGffGffGffGfk.', '.kbbbbbbbbbbbbk.', '.kfyffyffyffyfk.',
  '.kfGffGffGffGfk.', '.kbbbbbbbbbbbbk.', '.kkkkkkkkkkkkkk.',
];
const SPR_GARDEN = [
  '................', '................', '...kk.....kk....', '..kryk...kowk...',
  '..kyrk...kwok...', '...kGk.kk.kGk...', '...kGkkmyk.Gk...', '..kkGkkymk.Gkk..',
  '.kGGGGkGkGGGGGk.', '.kGlGGGGGGGlGek.', '.kGGGeGGlGGGGek.', '..keeGGGGGGeek..',
  '...kkeeeeeekk...', '....kkkkkkkk....',
];
const SPR_DOCK = [
  '................', '................', 'kkkkkkkkkkkkkkkk', 'khhhhkhhhhkhhhhk',
  'kbbbbkbbbbkbbbbk', 'kkkkkkkkkkkkkkkk', 'khhhhkhhhhkhhhhk', 'kbbbbkbbbbkbbbbk',
  'kkkkkkkkkkkkkkkk', 'khhhhkhhhhkhhhhk', 'kbbbbkbbbbkbbbbk', 'kkkkkkkkkkkkkkkk',
  '.kb.......kb....', '.kb.......kb....', '.kk.......kk....',
];
const SPR_STATUE = [
  '.......kk.......', '......kwsk......', '......kssk......', '.....kwssdk.....',
  '.....ksssdk.....', '.....kwssdk.....', '.....ksssdk.....', '.....kwssdk.....',
  '.....ksssdk.....', '....kksssddk....', '...kddddddDDk...', '...kssssssssk...',
  '..kddddddddDDk..', '..kssswsssssDk..', '..kkkkkkkkkkkk..',
];
const SPR_SIGNAL = [
  '......kyyk......', '.....koyyok.....', '.....korrok.....', '......kkkk......',
  '.....khkkhk.....', '.....kh..hk.....', '....khkkkkhk....', '....kh....hk....',
  '....khkkkkhk....', '...kh......hk...', '...khkkkkkkhk...', '...kh......hk...',
  '..khkkkkkkkkhk..', '..kh........hk..', '.kkk........kkk.',
];
const SPR_HEATER = [
  '................', '.......kk.......', '.......kdk......', '.......kdk......',
  '....kkkkdkkk....', '...kDDDDDDDDk...', '...kDkkkkkkDk...', '...kDkoyyokDk...',
  '...kDkyooykDk...', '...kDkkkkkkDk...', '...kDDDDDDDDk...', '...kddddddddk...',
  '....kk....kk....',
];
const SPR_COLLECTOR = [
  '................', '.kkkkkkkkkkkkkk.', '.kaaccccccccuuk.', '..kaccccccccuk..',
  '...kkkkkkkkkk...', '....kdsssssdk...', '....kucacccuk...', '....kucccccuk...',
  '....kdsssssdk...', '....kucccccuk...', '....kucccacuk...', '....kdsssssdk...',
  '....kkkkkkkkk...',
];
const SPR_WORKBENCH = [
  '................', '................', '................', '....kk....kk....',
  '...ksdk..kssk...', '....kdk..kbk....', '.kkkkkkkkkkkkkk.', '.khhhhhhhhhhhhk.',
  '.kbbbbbbbbbbbbk.', '.kkkkkkkkkkkkkk.', '..kbk......kbk..', '..kbk......kbk..',
  '..kbk......kbk..', '..kkk......kkk..',
];

// ---------- 角色 / 怪物 ----------
const SPR_SLIME = [
  '................', '................', '................', '................',
  '................', '................', '......kkkk......', '....kkaacckk....',
  '...kaacccccck...', '..kaccccccccuk..', '..kccwkccwkcuk..', '..kccwkccwkcuk..',
  '.kcccccccccccuk.', '.kucccccccccuuk.', '..kuuuuuuuuuuk..', '...kkkkkkkkkk...',
];
const SPR_BAT = [
  '................', '................', '................', '................',
  '................', 'kk....k..k....kk', 'kmk...kmmk...kmk', 'kmmk.kmmmmk.kmmk',
  'kmmmkmrmmrmkmmmk', '.kmmmmmmmmmmmmk.', '..kmmkmmmmkmmk..', '...kk.kmmk.kk...',
  '......kwwk......', '.......kk.......',
];
const SPR_SKELETON = [
  '................', '................', '......kkkk......', '.....kwwwwk.....',
  '....kwwwwwwk....', '....kwkwwkwk....', '....kwwwwwwk....', '.....kwkkwk.....',
  '......kkkk......', '...kkwwwwwwkk...', '..kwk.kwwk.kwk..', '..kwk.kwwk.kwk..',
  '..kk..kwwk..kk..', '.....kwkkwk.....', '.....kwk.kwk....', '.....kk..kk.....',
];
// 人形模板：H 头发 S 皮肤 C 上衣 P 裤子
const SPR_PERSON = [
  '................', '......kkkkk.....', '.....kHHHHHk....', '.....kHSSSHk....',
  '.....kSkSkSk....', '.....kSSSSSk....', '......kkkkk.....', '.....kCCCCCk....',
  '....kSCCCCCSk...', '....kSCCCCCSk...', '.....kCCCCCk....', '.....kPPPPPk....',
  '.....kPPkPPk....', '.....kPk.kPk....', '.....kkk.kkk....', '................',
];
const SPR_WOLF = [
  '................', '................', '................', '................',
  '................', '..kk............', '.kwak...........', '.kwwwk......kk..',
  'kwkwwwkkkkkkwak.', '.kwwwwwwwwwwwk..', '..kwwwswwwwwk...', '...kwwwwwwwsk...',
  '...kwk.kwk.kwk..', '...kwk..kk.kwk..', '...kk.......kk..',
];
const SPR_YETI = [
  '................', '....kkkkkkk.....', '...kwwwwwwwk....', '..kwwsssssswk...',
  '..kwskksksswk...', '..kwsssssssswk..', '..kwssrrrsswk...', '.kwwwsssssswwk..',
  'kwwwwwwwwwwwwwk.', 'kwkwwwwwwwwwkwk.', 'kwkwwwwwwwwwkwk.', '.k.kwwwwwwwk.k..',
  '...kwwwwwwwk....', '...kwwk.kwwk....', '...kkkk.kkkk....',
];

const SPR_BOAR = [
  '................', '................', '................', '................',
  '................', '................', '..kk.......kk...', '.kbbkkkkkkkbbk..',
  'kbbbbbbbbbbbbbk.', 'kbwkbbbbbbbbbbk.', 'kffbbbbbbbbbbbk.', '.kbbbbbbbbbbbbk.',
  '..kbk.kbk.kbbk..', '..kbk.kbk..kbk..', '..kk..kk...kk...',
];
const SPR_SHIP = [
  '.......k........', '.......kk.......', '.......kwk......', '.......kwwk.....',
  '.......kwwwk....', '.......kwwwwk...', '.......kwwwwwk..', '.......kkkkkkk..',
  '.......k........', 'kkkkkkkkkkkkkkkk', 'khhhhhhhhhhhhhk.', '.kbbbbbbbbbbbk..',
  '..kbbbbbbbbbk...', '...kkkkkkkkk....',
];

// ---------- 小图标 8×8 ----------
const ICONS = {
  wood: ['..kkkk..', '.khhhhk.', 'kbhyyhbk', 'kbhyhhbk', 'kbhhhhbk', '.kbbbbk.', '..kkkk..'],
  stone: ['........', '..kkkk..', '.kswssk.', 'kswsssdk', 'kssssddk', '.kddddk.', '..kkkk..'],
  gold: ['..kkkk..', '.kyyyyk.', 'kyywyyok', 'kyyyyyok', 'kyyyyook', 'kyyyoook', '.kooook.', '..kkkk..'],
  food: ['....kk..', '...kook.', '..kooook', '.kooook.', '.kyook..', 'kwkk....', 'kwk.....', '.k......'],
  water: ['...kk...', '...kck..', '..kcck..', '.kccack.', '.kccack.', '.kcccck.', '..kcck..', '...kk...'],
  parts: ['..k..k..', '.kdkkdk.', 'kdssssdk', '.ksDDsk.', '.ksDDsk.', 'kdssssdk', '.kdkkdk.', '..k..k..'],
  coal: ['........', '..kkkk..', '.kDdDDk.', 'kDsDDdDk', 'kDDDdDDk', '.kDDDDk.', '..kkkk..'],
  heart: ['........', '.kk.kk..', 'krrkrrk.', 'kroorrk.', 'krrrrrk.', '.krrrk..', '..krk...', '...k....'],
  temp: ['...kk...', '..kwwk..', '..kwrk..', '..kwrk..', '..kwrk..', '.krrrrk.', '.krrrrk.', '..kkkk..'],
  person: ['...kk...', '..kSSk..', '..kSSk..', '...kk...', '.kCCCCk.', '.kCCCCk.', '..kPPk..', '..k..k..'],
  iron: ['........', '........', '..kkkkk.', '.kswssk.', 'kswsssdk', 'kddddddk', '.kkkkkk.'],
  fire: ['...k....', '..kok...', '..koyk..', '.koyyok.', '.kyyyyk.', 'koyyyyok', '.kbbbbk.', '..kkkk..'],
  // 丧尸模式的武器 / 护甲 / 消耗品
  fists: ['........', '..kkkk..', '.kSSSSk.', 'kSkSkSSk', 'kSSSSSSk', '.kSSSSk.', '..kkkk..', '........'],
  knife: ['.......k', '......kw', '.....kwk', '....kwk.', '...kwk..', '..kbk...', '.kbk....', '.kk.....'],
  bat: ['......kk', '.....khk', '....khk.', '...khk..', '..khk...', '.kbk....', 'kbk.....', 'kk......'],
  axe: ['..kkk...', '.krrrk..', 'krrwrk..', '.krrkbk.', '..k.kbk.', '.....kbk', '......kb', '.......k'],
  pistol: ['........', 'kkkkkkk.', 'kddddddk', 'kDDkkkk.', '.kDk....', '.kDk....', '.kkk....', '........'],
  shotgun: ['........', '........', 'kkkkkkkk', 'kddddhhk', 'kkkkkhhk', '.....khk', '.....kk.', '........'],
  rifle: ['........', 'k.......', 'kkkkkkkk', 'kDDDDDDk', 'kkkDkhhk', '...kkhhk', '.....khk', '.....kk.'],
  none: ['........', '..k..k..', '.kDkkDk.', '.kDDDDk.', '.kDDDDk.', '.kDDDDk.', '..kkkk..', '........'],
  jacket: ['.kk..kk.', 'kbbkkbbk', 'kbbbbbbk', 'kbkbbkbk', 'kbkbbkbk', '.kbbbbk.', '.kbbbbk.', '.kkkkkk.'],
  vest: ['.kk..kk.', 'kDDkkDDk', 'kDdDDdDk', 'kDdDDdDk', 'kDDDDDDk', '.kDDDDk.', '.kDDDDk.', '.kkkkkk.'],
  riot: ['..kkkk..', '.kssssk.', 'kkaaaakk', 'kssssssk', 'ksdssdsk', 'ksdssdsk', '.ksssk..', '.kkkkk..'],
  bandage: ['........', '.kkkkkk.', 'kwwwwwwk', 'kwTwwTwk', 'kwwwwwwk', '.kkkkkk.', '........', '........'],
  medkit: ['..kkkk..', '.kwwwwk.', 'kwwrrwwk', 'kwrrrrwk', 'kwwrrwwk', 'kwwwwwwk', '.kkkkkk.', '........'],
};

const SPR_DUMPSTER = [
  '................', '................', '................', '..kkkkkkkkkkkk..',
  '.kGGGGGGGGGGGGk.', '.kkkkkkkkkkkkkk.', '.keGGGGGGGGGGek.', '.keGGGkkkkGGGek.',
  '.keGGGGGGGGGGek.', '.keGrGGGGGGGGek.', '.keeeeeeeeeeeek.', '.kkkkkkkkkkkkkk.',
  '..kDk......kDk..', '..kkk......kkk..',
];

// ---------- 高清化 ----------
// 原始字符画先用 Scale2x 算法放大 2 倍（斜线变圆滑），
// 再自动加光影：上边缘受光变亮、下边缘背光变暗，看起来更立体。
// 图片实际是 2 倍分辨率，但 w/h 仍是原尺寸，绘制时按原尺寸画。
const SPRITE_HD = 2;
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const PAL_RGB = {};
for (const k in PALETTE) PAL_RGB[k] = hexRgb(PALETTE[k]);

function scale2x(grid, w, h) {
  const W = w * 2, out = new Array(W * h * 2).fill('.');
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : grid[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      let e0 = P, e1 = P, e2 = P, e3 = P;
      if (C === A && C !== D && A !== B) e0 = A;
      if (A === B && A !== C && B !== D) e1 = B;
      if (D === C && D !== B && C !== A) e2 = C;
      if (B === D && B !== A && D !== C) e3 = D;
      const o = y * 2 * W + x * 2;
      out[o] = e0; out[o + 1] = e1; out[o + W] = e2; out[o + W + 1] = e3;
    }
  }
  return out;
}

// 把字符画变成图片：普通版、左右翻转版、受击闪白版
function makeSprite(rows, subst) {
  const h = rows.length;
  let w = 0;
  for (const r of rows) w = Math.max(w, r.length);
  const grid = new Array(w * h).fill('.');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      let ch = rows[y][x];
      if (subst && subst[ch]) ch = subst[ch];
      if (PALETTE[ch]) grid[y * w + x] = ch;
    }
  }
  const S = SPRITE_HD, W = w * S, H = h * S;
  const big = scale2x(grid, w, h);
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && big[y * W + x] !== '.' && big[y * W + x] !== 'k';
  const img = createCanvas(W, H), flip = createCanvas(W, H), white = createCanvas(W, H);
  const a = img.getContext('2d'), c = white.getContext('2d');
  const id = a.createImageData(W, H), wd = c.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = big[y * W + x];
      if (ch === '.') continue;
      let [r, g, b] = PAL_RGB[ch];
      if (ch !== 'k') {
        if (!solid(x, y - 1)) { r += (255 - r) * 0.24; g += (255 - g) * 0.22; b += (255 - b) * 0.16; }      // 顶部受光
        else if (!solid(x, y + 1)) { r *= 0.74; g *= 0.76; b *= 0.86; }                                    // 底部背光（偏冷）
        else if (!solid(x + 1, y)) { r *= 0.86; g *= 0.87; b *= 0.92; }                                    // 右侧阴影
        else if (!solid(x - 1, y)) { r += (255 - r) * 0.1; g += (255 - g) * 0.09; b += (255 - b) * 0.06; } // 左侧微亮
      }
      const o = (y * W + x) * 4;
      id.data[o] = r; id.data[o + 1] = g; id.data[o + 2] = b; id.data[o + 3] = 255;
      wd.data[o] = wd.data[o + 1] = wd.data[o + 2] = wd.data[o + 3] = 255;
    }
  }
  a.putImageData(id, 0, 0);
  c.putImageData(wd, 0, 0);
  const f = flip.getContext('2d');
  f.translate(W, 0);
  f.scale(-1, 1);
  f.drawImage(img, 0, 0);
  return { w, h, img, flip, white };
}

// 柔和的椭圆阴影（画在角色、建筑、树木脚下）
let SHADOW_IMG = null;
function drawShadow(ctx, x, y, w, alpha) {
  if (!SHADOW_IMG) {
    SHADOW_IMG = createCanvas(32, 16);
    const g = SHADOW_IMG.getContext('2d');
    g.setTransform(1, 0, 0, 0.5, 0, 0);
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(10,10,30,0.55)');
    gr.addColorStop(0.65, 'rgba(10,10,30,0.35)');
    gr.addColorStop(1, 'rgba(10,10,30,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
  }
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(SHADOW_IMG, x - w / 2, y - w / 4, w, w / 2);
  if (alpha !== undefined) ctx.globalAlpha = 1;
}

// ---------- 2×2 营地（用代码画） ----------
function blankGrid(S) {
  const g = [];
  for (let y = 0; y < S; y++) g.push(new Array(S).fill('.'));
  const set = (x, y, ch) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < S && y < S) g[y][x] = ch;
  };
  return { g, set, rows: () => g.map((r) => r.join('')) };
}

function dirtPatch(set, S) {
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x - 15.5) / 15.5, dy = (y - 20) / 11;
      const d = dx * dx + dy * dy;
      if (d < 1) set(x, y, d > 0.85 ? 'b' : ((x * 7 + y * 13) % 11 === 0 ? 'F' : 'f'));
    }
  }
}

function tentCoreRows() {
  const { set, rows } = blankGrid(32);
  dirtPatch(set, 32);
  const apexX = 11, apexY = 4, baseY = 20;
  for (let y = apexY; y <= baseY; y++) {
    const half = (y - apexY) * 0.6;
    const x0 = Math.round(apexX - half), x1 = Math.round(apexX + half);
    for (let x = x0; x <= x1; x++) {
      let ch = x < apexX ? 'T' : 'U';
      if (x === x0 || x === x1 || y === baseY) ch = 'k';
      set(x, y, ch);
    }
  }
  for (let y = 13; y < baseY; y++) {
    const half = (y - 13) * 0.45;
    for (let x = Math.round(apexX - half); x <= Math.round(apexX + half); x++) set(x, y, 'D');
  }
  for (let i = 0; i < 12; i++) {
    const ang = i / 12 * Math.PI * 2;
    set(23 + Math.cos(ang) * 4, 25 + Math.sin(ang) * 2.2, i % 2 ? 's' : 'd');
  }
  for (let x = 21; x <= 25; x++) set(x, 25, 'b');
  set(22, 24, 'h'); set(23, 25, 'h'); set(24, 26, 'h');
  for (let y = 3; y <= 22; y++) set(28, y, 'b');
  set(28, 2, 'y');
  for (let y = 4; y <= 8; y++) for (let x = 29; x <= 31; x++) set(x, y, y === 4 ? 'o' : 'r');
  return rows();
}

function bunkerCoreRows() {
  const { set, rows } = blankGrid(32);
  dirtPatch(set, 32);
  for (let y = 8; y <= 24; y++) {
    for (let x = 3; x <= 28; x++) {
      let ch = (x - 3) % 4 === 0 ? 's' : 'd';
      if (y <= 9) ch = 's';
      if (x === 3 || x === 28 || y === 8 || y === 24) ch = 'k';
      set(x, y, ch);
    }
  }
  for (let y = 14; y <= 23; y++) for (let x = 13; x <= 18; x++) set(x, y, x === 13 || x === 18 || y === 14 ? 'k' : 'D');
  for (let x = 6; x <= 10; x++) set(x, 12, 'a');
  for (let x = 21; x <= 25; x++) set(x, 12, 'a');
  for (let i = 0; i < 7; i++) {
    const bx = 2 + i * 4;
    for (let x = bx; x < bx + 4; x++) { set(x, 26, 'k'); set(x, 27, x === bx || x === bx + 3 ? 'k' : 'h'); set(x, 28, 'k'); }
  }
  for (let y = 1; y <= 8; y++) set(25, y, 'k');
  set(25, 0, 'r');
  for (let x = 4; x <= 8; x++) set(x, 7, 'r');
  return rows();
}

function furnaceCoreRows() {
  const { set, rows } = blankGrid(32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = (x - 15.5) / 15.5, dy = (y - 21) / 10.5;
      if (dx * dx + dy * dy < 1) set(x, y, (x + y) % 5 === 0 ? 'D' : 'd');
    }
  }
  for (let y = 9; y <= 28; y++) {
    for (let x = 6; x <= 25; x++) {
      let ch = ((y - 9) % 4 === 0 || (x + ((y - 9) >> 2) * 2) % 6 === 0) ? 'd' : 's';
      if (x === 6 || x === 25 || y === 9 || y === 28) ch = 'k';
      set(x, y, ch);
    }
  }
  for (let y = 0; y <= 9; y++) for (let x = 19; x <= 23; x++) set(x, y, x === 19 || x === 23 || y === 0 ? 'k' : 'D');
  for (let y = 18; y <= 25; y++) for (let x = 10; x <= 21; x++) set(x, y, x === 10 || x === 21 || y === 18 ? 'k' : (y > 22 ? 'r' : 'o'));
  return rows();
}

const SPR = {};
function initSprites() {
  SPR.tree = makeSprite(SPR_TREE);
  SPR.pine = makeSprite(SPR_PINE);
  SPR.palm = makeSprite(SPR_PALM);
  SPR.berry = makeSprite(SPR_BERRY);
  SPR.rock = makeSprite(SPR_ROCK);
  SPR.coal = makeSprite(SPR_ROCK, { s: 'D', w: 's', d: 'k', D: 'k' });
  SPR.deadtree = makeSprite(SPR_DEADTREE);
  SPR.ruin = makeSprite(SPR_RUIN);
  SPR.car = makeSprite(SPR_CAR);

  SPR.wall = makeSprite(SPR_WALL);
  SPR.stonewall = makeSprite(SPR_STONEWALL);
  SPR.barricade = makeSprite(SPR_WALL, { h: 's', b: 'd' });
  SPR.tower = makeSprite(SPR_TOWER);
  SPR.frost = makeSprite(SPR_TOWER, { r: 'c', o: 'a' });
  SPR.tesla = makeSprite(SPR_TOWER, { r: 'u', o: 'y' });
  SPR.flame = makeSprite(SPR_TOWER, { r: 'o', o: 'y' });
  SPR.floodlight = makeSprite(SPR_TOWER, { r: 'w', o: 'y', h: 'd', b: 'D' });
  SPR.turret = makeSprite(SPR_CANNON, { s: 'd', w: 's', d: 'D' });
  SPR.cannon = makeSprite(SPR_CANNON);
  SPR.spikes = makeSprite(SPR_SPIKES);
  SPR.lumber = makeSprite(SPR_HOUSE, { R: 'o' });
  SPR.quarry = makeSprite(SPR_HOUSE, { R: 'u' });
  SPR.market = makeSprite(SPR_HOUSE, { R: 'y', y: 'o' });
  SPR.shelter = makeSprite(SPR_HOUSE, { R: 'F', h: 'T', b: 'U' });
  SPR.forager = makeSprite(SPR_HOUSE, { R: 'G' });
  SPR.house = makeSprite(SPR_HOUSE, { R: 'r' });
  SPR.tavern = makeSprite(SPR_HOUSE, { R: 'p' });
  SPR.coalmine = makeSprite(SPR_HOUSE, { R: 'D' });
  SPR.bunk = makeSprite(SPR_HOUSE, { R: 'd', h: 's', b: 'd' });
  SPR.farm = makeSprite(SPR_FARM);
  SPR.garden = makeSprite(SPR_GARDEN);
  SPR.dock = makeSprite(SPR_DOCK);
  SPR.statue = makeSprite(SPR_STATUE);
  SPR.signal = makeSprite(SPR_SIGNAL);
  SPR.heater = makeSprite(SPR_HEATER);
  SPR.collector = makeSprite(SPR_COLLECTOR);
  SPR.workbench = makeSprite(SPR_WORKBENCH);
  SPR.vegfarm = makeSprite(SPR_FARM, { y: 'r' });
  SPR.smelter = makeSprite(SPR_HEATER, { D: 'd', d: 's' });
  SPR.ironore = makeSprite(SPR_ROCK, { s: 'd', w: 'o', d: 'b', D: 'k' });
  SPR.boar = makeSprite(SPR_BOAR);
  SPR.ship = makeSprite(SPR_SHIP);
  SPR.wreck = makeSprite(SPR_SHIP, { w: 'T', h: 'f' });
  SPR.canoe = makeSprite(SPR_SHIP, { w: 'r', h: 'b' });
  SPR.cannibal = makeSprite(SPR_PERSON, { C: 'p', P: 'b', H: 'r', S: 'f' });

  SPR.core_classic = makeSprite(tentCoreRows());
  SPR.core_island = makeSprite(tentCoreRows(), { T: 'G', U: 'e', r: 'y', o: 'w' });
  SPR.core_zombie = makeSprite(bunkerCoreRows());
  SPR.core_frost = makeSprite(furnaceCoreRows());

  SPR.slime = makeSprite(SPR_SLIME);
  SPR.boss = makeSprite(SPR_SLIME, { c: 'o', a: 'y', u: 'r' });
  SPR.frostslime = makeSprite(SPR_SLIME, { c: 'a', a: 'w', u: 'c' });
  SPR.bat = makeSprite(SPR_BAT);
  SPR.skeleton = makeSprite(SPR_SKELETON);
  SPR.iceskel = makeSprite(SPR_SKELETON, { w: 'a' });
  SPR.wolf = makeSprite(SPR_WOLF);
  SPR.yeti = makeSprite(SPR_YETI);
  SPR.player = makeSprite(SPR_PERSON, { C: 'r', P: 'D' });
  SPR.survivor = makeSprite(SPR_PERSON, { C: 'G', P: 'b', H: 'k' });
  SPR.stranger = makeSprite(SPR_PERSON, { C: 'y', P: 'n', H: 'h' });
  SPR.bandit = makeSprite(SPR_PERSON, { C: 'k', P: 'D', H: 'r' });
  SPR.walker = makeSprite(SPR_PERSON, { S: 'Z', C: 'd', P: 'n', H: 'g' });
  SPR.runner = makeSprite(SPR_PERSON, { S: 'Z', C: 'r', P: 'D', H: 'k' });
  SPR.brute = makeSprite(SPR_PERSON, { S: 'g', C: 'p', P: 'k', H: 'k' });
  const villagerLooks = [{ C: 'y', H: 'H' }, { C: 'c', H: 'k' }, { C: 'o', H: 'h' }, { C: 'l', H: 'b' }];
  villagerLooks.forEach((s, i) => { SPR['villager' + i] = makeSprite(SPR_PERSON, Object.assign({ P: 'b' }, s)); });

  for (const k in ICONS) SPR['icon_' + k] = makeSprite(ICONS[k]);
  // 丧尸模式：幸存者不同外貌、城市行道树、垃圾箱
  const zLooks = [{ C: 'G', P: 'b', H: 'k' }, { C: 'u', P: 'D', H: 'H' }, { C: 'o', P: 'n', H: 'h' }, { C: 'w', P: 'D', H: 'y' },
    { C: 'm', P: 'b', H: 'k' }, { C: 'd', P: 'k', H: 'r' }];
  zLooks.forEach((s, i) => { SPR['zs' + i] = makeSprite(SPR_PERSON, s); });
  SPR.ctree = makeSprite(SPR_TREE, { G: 'g', l: 'Z', e: 'e' });
  SPR.zpine = makeSprite(SPR_PINE, { w: 'G' });
  SPR.dumpster = makeSprite(SPR_DUMPSTER);
}
