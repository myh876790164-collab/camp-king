// =============================================
//  修仙门派：Q 版休闲风弟子形象
//  大头小身、圆脸大眼、腮红；道袍按境界换色，腰带用弟子自己的颜色
//  每个弟子按编号固定一套外貌（发型 + 发饰 + 肤色），第一次画时生成，存在 p.lk
//  画法：16×22 格的像素画 → 自动描边（暖棕色，比纯黑柔和）+ 上亮下暗 → 缓存成小图
//  地图上 1 格 = 0.8 个世界单位；名录和人物页里放大画头像
// =============================================
const SECT_LOOK_W = 16, SECT_LOOK_H = 25, SECT_LOOK_CELL = 0.8; // 上面留 3 行给发髻、发饰、斗笠
const SECT_SKINS = ['#f8dfc8', '#f4d4b4', '#ecc39c'];
const SECT_HAIR_F = ['twinbun', 'pony', 'loose', 'topbun', 'twinbraid', 'sidebun', 'loose', 'twinbun'];
const SECT_HAIR_M = ['topbun', 'crown', 'pony', 'short', 'loose', 'topbun', 'short', 'bald'];
const SECT_ACC_F = ['ribbon', 'flower', 'pin', 'ribbon', 'ahoge', 'leaf', 'none', 'flower'];
const SECT_ACC_M = ['none', 'ahoge', 'leaf', 'ribbon', 'none', 'pin', 'douli', 'none'];
const SECT_HAIR_NAME = { twinbun: '双丸子', pony: '高马尾', loose: '披发', topbun: '道髻', twinbraid: '双辫', sidebun: '侧髻', crown: '束发冠', short: '碎发', bald: '小光头' };
let sectLookCache = {};
// 掌门用玩家角色（js/avatar.js）的发型
const SECT_FROM_AVATAR = { long: 'loose', bob: 'loose', ponytail: 'pony', twintail: 'twinbun', bun: 'topbun', braid: 'twinbraid', topknot: 'topbun', short: 'short', messy: 'short', slick: 'crown', buzz: 'short', mohawk: 'short', curly: 'short' };

function sectLookOf(p) {
  if (p.lk) return p.lk;
  let s = (p.id * 2654435761) >>> 0;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pk = (a) => a[Math.floor(r() * a.length)];
  const f = p.sex === 'f';
  p.lk = { hair: pk(f ? SECT_HAIR_F : SECT_HAIR_M), acc: pk(f ? SECT_ACC_F : SECT_ACC_M), skin: Math.floor(r() * SECT_SKINS.length) };
  if (p.lk.hair === 'bald' && p.lk.acc !== 'leaf') p.lk.acc = 'none'; // 小光头不戴发饰（顶多头上落片叶子）
  return p.lk;
}
// 新掌门套用玩家角色的发型（sect.js 新开局时调用）
function sectLookFromAvatar(p) {
  const L = avLook();
  p.lk = { hair: SECT_FROM_AVATAR[L.hair] || (p.sex === 'f' ? 'loose' : 'topbun'), acc: p.sex === 'f' ? 'pin' : 'none', skin: L.skin === 'tan' || L.skin === 'brown' || L.skin === 'dark' ? 2 : L.skin === 'light' ? 0 : 1 };
}
function sectHairColor(p) {
  if (typeof lifeMax === 'function' && p.age >= lifeMax(p) * 0.75) return p.age >= lifeMax(p) * 0.9 ? '#e8e8f0' : '#9a9aa8'; // 年老白发
  return p.hair || '#1a1c2c';
}
function sectLsh(hex, k) { // k>0 变亮，k<0 变暗
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}

// 画一张格子图。pose：stand / walk0 / walk1 / sit
function sectLookGrid(p, pose) {
  const W = SECT_LOOK_W, H = SECT_LOOK_H, grid = new Array(W * H).fill(null);
  const R = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const xx = x + i, yy = y + j + 3; if (xx >= 0 && yy >= 0 && xx < W && yy < H) grid[yy * W + xx] = c; } };
  const X = (x, y) => { y += 3; if (x >= 0 && y >= 0 && x < W && y < H) grid[y * W + x] = null; };
  const lk = sectLookOf(p), sit = pose === 'sit', f = p.sex === 'f';
  const oy = sit ? 2 : 0; // 坐着时头低一点
  const skin = SECT_SKINS[lk.skin] || SECT_SKINS[0], skinD = sectLsh(skin, -0.12);
  const h = sectHairColor(p), hD = sectLsh(h, -0.25), hL = sectLsh(h, 0.3);
  const robe = REALM_ROBE[p.realm] || '#8a7f6e', rD = sectLsh(robe, -0.22), rL = sectLsh(robe, 0.25);
  const sash = p.sash || '#1d2b53', inner = '#f6f0e0', shoe = '#4a3830';
  const gold = '#ffcd75';
  const old = h === '#e8e8f0' || h === '#9a9aa8';
  // ---- 1) 身后的头发 ----
  if (lk.hair === 'loose') { R(2, 5 + oy, 12, 9, hD); R(3, 14 + oy, 10, 2, hD); }
  if (lk.hair === 'pony') { R(1, 2 + oy, 2, 2, h); R(0, 4 + oy, 2, 8, hD); R(1, 12 + oy, 1, 2, hD); }
  if (lk.hair === 'sidebun') { R(0, 3 + oy, 3, 3, h); R(1, 3 + oy, 1, 1, hL); }
  // ---- 2) 身体 ----
  if (!sit) {
    // 脚（走路时一只脚抬起）
    const lu = pose === 'walk0' ? -1 : 0, ru = pose === 'walk1' ? -1 : 0;
    R(5, 20 + lu, 2, 2, shoe); R(9, 20 + ru, 2, 2, shoe);
    // 道袍：上窄下宽
    R(5, 12, 6, 5, robe); R(4, 16, 8, 4, robe); R(3, 18, 10, 2, robe);
    R(10, 12, 1, 5, rD); R(11, 16, 1, 4, rD); R(12, 18, 1, 2, rD); R(3, 19, 10, 1, rD);
    R(5, 12, 1, 4, rL);
    // 交领（右衽）
    R(7, 12, 2, 1, inner); R(7, 13, 1, 1, inner); R(8, 13, 1, 2, rD); R(6, 12, 1, 1, rD);
    // 腰带 + 垂下来的结
    R(5, 15, 6, 1, sash); R(9, 16, 1, 2, sash); R(10, 17, 1, 1, sectLsh(sash, -0.2));
    // 宽袖子 + 小手
    R(2, 13, 3, 4, robe); R(11, 13, 3, 4, rD); R(2, 16, 3, 1, rD); R(11, 16, 3, 1, sectLsh(robe, -0.35));
    R(3, 17, 1, 1, skin); R(12, 17, 1, 1, skinD);
    if (p.head) { R(3, 19, 10, 1, gold); R(5, 15, 6, 1, gold); } // 掌门：金边道袍 + 金腰带
  } else {
    // 盘腿打坐
    R(2, 18, 12, 3, rD); R(3, 17, 10, 1, robe); R(2, 20, 12, 1, sectLsh(robe, -0.35));
    R(5, 13, 6, 5, robe); R(10, 13, 1, 5, rD); R(5, 13, 1, 4, rL);
    R(7, 13, 2, 1, inner); R(8, 14, 1, 1, rD);
    R(5, 16, 6, 1, p.head ? gold : sash);
    R(3, 14, 2, 3, robe); R(11, 14, 2, 3, rD);
    R(6, 17, 4, 1, skin); R(7, 16, 2, 1, skin); // 双手结印
  }
  // ---- 3) 头（圆脸） ----
  R(3, 2 + oy, 10, 10, skin);
  for (const [cx, cy] of [[3, 2], [4, 2], [11, 2], [12, 2], [3, 3], [12, 3], [3, 11], [12, 11]]) X(cx, cy + oy);
  R(12, 5 + oy, 1, 6, skinD); R(4, 11 + oy, 8, 1, skinD);
  // 脸（朝右，眼睛偏右一格）
  const eye = '#2b1d1d';
  if (sit) { R(6, 8 + oy, 2, 1, eye); R(10, 8 + oy, 2, 1, eye); R(5, 7 + oy, 1, 1, f ? eye : skin); } // 闭眼入定
  else {
    R(6, 7 + oy, 2, 2, eye); R(10, 7 + oy, 2, 2, eye);
    R(6, 7 + oy, 1, 1, '#ffffff'); R(10, 7 + oy, 1, 1, '#ffffff');
    if (f) { R(5, 7 + oy, 1, 1, eye); R(12, 7 + oy, 1, 1, eye); }
  }
  R(5, 9 + oy, 1, 1, '#f4a6a6'); R(11, 9 + oy, 1, 1, '#f4a6a6'); // 腮红
  R(8, 10 + oy, 2, 1, f ? '#d9707a' : '#b8665a'); if (!f) X(9, 10 + oy); // 小嘴
  if (old && !f) { R(6, 10 + oy, 5, 2, h); R(7, 12 + oy, 3, 1, h); R(8, 10 + oy, 1, 1, '#b8665a'); } // 老爷爷的白胡子
  // ---- 4) 前面的头发 ----
  const cap = () => { R(3, 1 + oy, 10, 3, h); R(4, 0 + oy, 8, 1, h); R(3, 4 + oy, 1, 4, h); R(12, 4 + oy, 1, 4, h); R(4, 4 + oy, 2, 1, h); R(7, 4 + oy, 1, 1, h); R(10, 4 + oy, 2, 1, h); R(4, 5 + oy, 1, 1, h); R(11, 5 + oy, 1, 1, h); R(5, 1 + oy, 4, 1, hL); };
  switch (lk.hair) {
    case 'topbun': cap(); R(6, -1 + oy, 4, 2, h); R(7, -1 + oy, 1, 1, hL); R(6, 1 + oy, 4, 1, p.head ? gold : sash); break;
    case 'crown': cap(); R(6, -1 + oy, 4, 1, '#c9a227'); R(7, -2 + oy, 2, 1, '#c9a227'); R(5, 0 + oy, 6, 1, '#c9a227'); break;
    case 'pony': cap(); R(2, 1 + oy, 1, 2, sash); break;
    case 'loose': cap(); R(3, 4 + oy, 1, 8, h); R(12, 4 + oy, 1, 8, hD); break;
    case 'twinbun': cap(); R(1, -1 + oy, 3, 3, h); R(12, -1 + oy, 3, 3, h); R(1, -1 + oy, 1, 1, hL); R(12, -1 + oy, 1, 1, hL); R(3, 1 + oy, 1, 1, sash); R(12, 1 + oy, 1, 1, sash); break;
    case 'twinbraid': cap(); for (let y = 6; y < 15; y++) { R(2, y + oy, 1, 1, y % 2 ? h : hD); R(13, y + oy, 1, 1, y % 2 ? h : hD); } R(2, 15 + oy, 1, 1, sash); R(13, 15 + oy, 1, 1, sash); break;
    case 'sidebun': cap(); R(2, 3 + oy, 1, 1, gold); break;
    case 'short': cap(); R(5, -1 + oy, 1, 1, h); R(8, -1 + oy, 1, 1, h); R(10, -1 + oy, 1, 1, h); R(6, 4 + oy, 1, 1, h); break;
    case 'bald': R(4, 1 + oy, 8, 1, skin); R(6, 2 + oy, 1, 1, '#c9a27a'); R(8, 2 + oy, 1, 1, '#c9a27a'); R(10, 2 + oy, 1, 1, '#c9a27a'); R(6, 3 + oy, 1, 1, skinD); break;
  }
  // ---- 5) 发饰 ----
  const acc = lk.acc;
  if (acc === 'ribbon') { R(11, 1 + oy, 2, 1, sash); R(13, 1 + oy, 1, 2, sash); R(12, 2 + oy, 1, 1, sectLsh(sash, -0.2)); }
  else if (acc === 'flower') { R(10, 0 + oy, 2, 2, '#f48fb1'); R(11, 0 + oy, 1, 1, '#ffe08a'); }
  else if (acc === 'pin') { R(11, -1 + oy, 1, 1, gold); R(12, -2 + oy, 1, 1, gold); R(10, 0 + oy, 1, 1, gold); R(12, -1 + oy, 1, 1, '#e23b3b'); }
  else if (acc === 'ahoge' && lk.hair !== 'bald') { R(8, -1 + oy, 1, 1, h); R(9, -2 + oy, 1, 1, h); R(10, -2 + oy, 1, 1, h); }
  else if (acc === 'leaf') { R(9, -1 + oy, 2, 1, '#5ac06a'); R(10, -2 + oy, 1, 1, '#8ee09a'); R(9, 0 + oy, 1, 1, '#3e8a4a'); }
  else if (acc === 'douli' && !p.head) { R(0, 1 + oy, 16, 1, '#c9a46a'); R(2, 0 + oy, 12, 1, '#d9b97a'); R(5, -1 + oy, 6, 1, '#e4c98a'); R(7, -2 + oy, 2, 1, '#e4c98a'); R(1, 2 + oy, 14, 1, '#a88550'); }
  // 掌门玉冠
  if (p.head) { R(6, -2 + oy, 4, 1, gold); R(7, -3 + oy, 2, 1, gold); R(7, -2 + oy, 2, 1, '#73eff7'); }
  // 受伤：头上缠绷带
  if (p.hurt > 0) { R(3, 4 + oy, 10, 1, '#f4f4f4'); R(4, 3 + oy, 1, 1, '#f4f4f4'); R(10, 4 + oy, 1, 1, '#e23b3b'); }
  return grid;
}
// 格子 → 图片（描边 + 光影），带缓存
function sectLookImg(p, pose) {
  const lk = sectLookOf(p);
  const key = [lk.hair, lk.acc, lk.skin, sectHairColor(p), p.realm, p.sash, p.sex, p.head ? 1 : 0, p.hurt > 0 ? 1 : 0, pose].join('|');
  if (sectLookCache[key]) return sectLookCache[key];
  const W = SECT_LOOK_W, H = SECT_LOOK_H, grid = sectLookGrid(p, pose);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : grid[y * W + x]);
  const cv = createCanvas(W + 2, H + 2), g = cv.getContext('2d');
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
    const c = at(x, y);
    if (c) {
      let col = c;
      if (!at(x, y - 1)) col = sectLsh(c, 0.16); else if (!at(x, y + 1)) col = sectLsh(c, -0.14); else if (!at(x + 1, y)) col = sectLsh(c, -0.07);
      g.fillStyle = col; g.fillRect(x + 1, y + 1, 1, 1);
    } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) { g.fillStyle = '#3a2a2e'; g.fillRect(x + 1, y + 1, 1, 1); }
  }
  if (Object.keys(sectLookCache).length > 600) sectLookCache = {};
  return (sectLookCache[key] = cv);
}
// 地图上画一个弟子：x,y 是脚底，cell 每格多大（世界单位），face 朝向
function sectDrawLook(ctx, p, x, y, cell, pose, face) {
  const img = sectLookImg(p, pose), w = img.width * cell, h = img.height * cell;
  const old = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (face < 0) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, y - h + cell, w, h); ctx.restore(); }
  else ctx.drawImage(img, x - w / 2, y - h + cell, w, h);
  ctx.imageSmoothingEnabled = old;
}
// 名录 / 人物页的头像（左上角 x,y，scale 每格多少像素）
function sectPortrait(ctx, p, x, y, scale, pose) {
  const img = sectLookImg(p, pose || 'stand'), old = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(x), Math.round(y), img.width * scale, img.height * scale);
  ctx.imageSmoothingEnabled = old;
}
