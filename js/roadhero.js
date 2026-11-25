// =============================================
//  公路求生：车外的主角（精细像素）和宠物猫狗
//  主角按玩家设置的角色外观（肤色、发色发型、上衣、裤子 / 裙子、帽子、眼镜）逐像素画：
//  走路 4 帧（腿和胳膊交替摆、身子一起一伏）、站着呼吸、搜完回来背着一大袋东西、
//  近战挥武器（3 帧挥砍弧线）、远程举枪开火（枪口火光、后坐）、被打时闪白；手上拿的是当前随身武器。
//  宠物：猫 / 狗各有走路 4 帧、坐着摇尾巴、趴着睡觉（车内外都用）。
//  坐标：精细像素，原点在脚下中间，朝右画
// =============================================
const RDH_CACHE = {};
let RDH_N = 0;
function rdhRamp(c) { return [rdMix(c, '#fff6e4', 0.28), c, rdMix(c, '#1e140e', 0.25), rdMix(c, '#1e140e', 0.48)]; }
function rdhLook(o) {
  const R = G.road, suit = R && R.suit ? RD_PARTS[R.suit] : null;
  if (o.shirt) { const s = (o.seed != null ? o.seed + 1 : o.shirt.charCodeAt(3)) * 7; return { skin: ['#f2d0a9', '#d9a77c', '#b07a52'][s % 3], hair: ['#3a2a22', '#6a4a2a', '#2a2a30', '#a8a090'][s % 4], hs: ['short', 'long', 'short', 'cap'][s % 4], top: o.shirt, t2: null, bot: '#4a4a5a', skirt: false, hat: s % 4 === 3 ? '#6a5a3a' : null, glasses: null, suit: null }; }
  const L = avLook();
  const suitC = suit && suit.id !== 'suit1' ? ({ suit2: '#e8c060', suit3: '#4a5040', suit4: '#e8c060', suit5: '#b84a3a', suit6: '#6a7484', suit7: '#9aa8b4', suit8: '#5a6040', suit9: '#6a4a98' })[suit.id] : null;
  const hat = avHas(L, 'cap') || avHas(L, 'beret') || avHas(L, 'strawhat') || avHas(L, 'bandana') || avHas(L, 'headband');
  return { skin: AV_SKIN[L.skin], hair: L.hc, hs: L.hair, top: suitC || L.tc, t2: suitC ? null : (['jacket', 'labcoat', 'coat', 'suit', 'armor'].includes(L.top) ? L.t2 : null), bot: suitC ? rdMix(suitC, '#1e140e', 0.3) : L.bc,
    skirt: !suitC && ['skirt', 'longskirt', 'qipao'].includes(L.bot), hat, hatType: avHas(L, 'strawhat') ? 'straw' : (avHas(L, 'bandana') || avHas(L, 'headband')) ? 'band' : hat ? 'cap' : null,
    glasses: avHas(L, 'sunglasses') || avHas(L, 'visor'), suit: suitC, helmet: suit && ['suit4', 'suit6', 'suit8', 'suit9'].includes(suit.id) };
}
function rdhWeapon(B, id, x, y, ang, swing) { // 手上的随身武器（x,y 手的位置）
  if (!id) return;
  const n = parseInt(id.replace(/\D+/g, ''), 10), S = ['#e2e0d8', '#b4b0a6', '#86827a', '#5a5650'], dx = Math.cos(ang), dy = Math.sin(ang);
  const seg = (a, b, c, w) => { for (let k = Math.round(a); k <= b; k++) for (let j = 0; j < (w || 1); j++) rdcPix(B, Math.round(x + dx * k - dy * j), Math.round(y + dy * k + dx * j), c, 2); };
  if (n === 1) { seg(-2, 14, S[2], 2); seg(13, 15, '#c84a3a', 2); }
  else if (n === 2) { seg(-2, 14, '#8a5a34', 2); seg(11, 15, '#c83a2a', 4); }
  else if (n === 13) { seg(-2, 6, '#7a5634', 2); seg(6, 16, '#c8965a', 3); }
  else if (n === 10) { seg(-3, 4, '#d8a840', 6); }
  else if (n === 11) { seg(-2, 3, '#3a3632', 2); seg(3, 18, '#73eff7', 1); seg(3, 18, '#ffffff', 1); }
  else if (n === 6) { seg(-4, 4, '#e8a040', 5); seg(4, 16, S[1], 3); }
  else if (n === 3) { seg(-4, 10, '#8a5a34', 2); for (let k = -5; k <= 5; k++) rdcPix(B, Math.round(x + dx * 8 - dy * k), Math.round(y + dy * 8 + dx * k), S[2], 2); }
  else if (n === 4 || n === 12) { seg(-1, 7, n === 12 ? '#7a54ac' : S[2], 2); seg(-1, 1, '#4a3428', 4); if (n === 12) rdcPix(B, Math.round(x + dx * 7), Math.round(y + dy * 7), '#73eff7', 4); }
  else if (n === 9) { seg(-8, 14, '#686c48', 4); seg(14, 16, '#c84a3a', 4); }
  else { const L = n === 8 ? 22 : n === 5 ? 14 : 18; seg(-6, 2, n === 7 ? '#3a3632' : '#8a5a34', 3); seg(2, L, S[2], 2); if (n === 8) seg(0, 6, '#2a2622', 1); }
}
// 生成一帧主角：pose 'stand' | 'walk' | 'run'；fr 0~3；act: null | 'swing0~2' | 'shoot'；carry 背着东西
function rdhBuild(K, Lk, pose, fr, act, carry, wpn) {
  const B = rdcPaper(80, 80, 40, 66), T = rdhRamp(Lk.top), Pn = rdhRamp(Lk.bot), Sk = rdhRamp(Lk.skin), H = rdhRamp(Lk.hair);
  const walk = pose !== 'stand', sw = walk ? [-4, 0, 4, 0][fr] * (pose === 'run' ? 1.4 : 1) : 0, bob = walk && fr % 2 ? -1 : 0, breathe = !walk && fr >= 2 ? -1 : 0, by = bob + breathe;
  const limb = (x0, y0, x1, y1, w, R) => rdnLimb(B, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), w, R);
  // 后面那条腿 + 胳膊（暗一点）
  if (Lk.skirt) { limb(-1, -12, -1 - sw * 0.5, 0, 2, Sk.slice(1)); } else limb(-1, -16, -2 - sw, 0, 4, Pn.slice(1));
  rdcRect(B, Math.round(-4 - sw), -2, 6, 2, '#2a1e16', 1);
  const armBack = act ? 0 : -sw * 0.8;
  limb(-1, -29 + by, -2 + armBack, -18 + by, 3, T.slice(1));
  // 背包 / 背着的大袋子
  if (carry) { rdnBlob(B, -9, -27 + by, 7, 8, ['#d8c090', '#b89a64', '#8a7040', '#5e4a26']); rdcLine(B, -10, -34 + by, -7, -20 + by, '#6a5030', 1); }
  else { rdcBox(B, -10, -29 + by, 5, 12, ['#9a7048', '#7a5434', '#5a3c22'], 1, 0, 1); rdcRect(B, -6, -29 + by, 1, 12, '#4a3020', 1); }
  // 前面那条腿
  if (Lk.skirt) { limb(1, -12, 2 + sw * 0.5, 0, 2, Sk); rdcPoly(B, [[-5, -17 + by], [5, -17 + by], [7, -9 + by], [-7, -9 + by]], Pn, 1); }
  else limb(1, -16, 2 + sw, 0, 4, Pn);
  rdcRect(B, Math.round(0 + sw), -2, 6, 2, '#3a2a1e', 1); rdcPix(B, Math.round(5 + sw), -2, '#5a4430', 1);
  // 身体
  for (let y = -30; y < -15; y++) for (let x = -5; x <= 5; x++) { if ((y === -30 && Math.abs(x) > 3) || (y === -29 && Math.abs(x) > 4)) continue; rdcPix(B, x, y + by, rdcRampAt(T, 0.15 + (x + 5) / 10 * 0.45 + (y + 30) / 15 * 0.25, x, y), 1); }
  if (Lk.t2) for (let y = -29; y < -16; y++) { rdcPix(B, 1, y + by, Lk.t2, 1); rdcPix(B, 2, y + by, rdMix(Lk.t2, '#1e140e', 0.2), 1); }
  rdcRect(B, -5, -17 + by, 11, 1, T[3], 1); // 腰带
  rdcLine(B, -4, -29 + by, -6, -20 + by, '#5a3c22', 1); // 背包带
  // 头
  const hy = -37 + by;
  for (let y = -6; y <= 5; y++) for (let x = -5; x <= 6; x++) { if (x * x * 0.8 + y * y > 34) continue; rdcPix(B, x + 1, hy + y, rdcRampAt(Sk, 0.15 + (x + 5) / 11 * 0.35 + (y + 6) / 11 * 0.2, x, y), 1); }
  if (Lk.helmet) { for (let y = -8; y <= 6; y++) for (let x = -7; x <= 8; x++) if (x * x * 0.7 + y * y <= 52) rdcPix(B, x + 1, hy + y, rdcRampAt(T, 0.1 + (y + 8) / 14 * 0.5, x, y), 1); rdcRect(B, 2, hy - 2, 6, 4, '#8ad0e8', 3); rdcPix(B, 3, hy - 2, '#ffffff', 3); }
  else {
    // 头发
    for (let y = -7; y <= -2; y++) for (let x = -6; x <= 6; x++) if (x * x * 0.8 + (y + 1) * (y + 1) <= 36 && (y < -3 || x < -1)) rdcPix(B, x + 1, hy + y, rdcRampAt(H, 0.1 + (y + 7) / 6 * 0.5, x, y), 1);
    for (let y = -2; y <= 2; y++) for (let x = -5; x <= -3; x++) rdcPix(B, x + 1, hy + y, H[1], 1);
    if (['long', 'braid', 'twintail'].includes(Lk.hs)) for (let y = 0; y < 12; y++) for (let x = -6; x <= -2; x++) rdcPix(B, x + (walk ? -Math.round(fr % 2) : 0), hy + y, rdcRampAt(H, 0.3 + y / 12 * 0.4, x, y), 1);
    if (Lk.hs === 'bob') for (let y = 0; y < 5; y++) for (let x = -6; x <= -2; x++) rdcPix(B, x, hy + y, H[2], 1);
    if (Lk.hs === 'ponytail') for (let y = -4; y < 6; y++) { const xx = -7 - Math.round(y * 0.3) - (walk ? fr % 2 : 0); rdcPix(B, xx, hy + y, H[1], 1); rdcPix(B, xx - 1, hy + y, H[2], 1); }
    rdcPix(B, 5, hy - 1, '#1e140e', 1); rdcPix(B, 5, hy - 2, '#1e140e', 1); rdcPix(B, 7, hy + 1, Sk[2], 1); rdcRect(B, 4, hy + 3, 2, 1, Sk[3], 1);
    if (Lk.glasses) rdcRect(B, 3, hy - 2, 5, 2, Lk.glasses === true ? '#1e140e' : Lk.glasses, 2);
    if (Lk.hat) { const Hr = rdhRamp(Lk.hat); if (Lk.hatType === 'band') rdcRect(B, -4, hy - 4, 11, 2, Lk.hat, 1); else { for (let y = -9; y <= -5; y++) for (let x = -5; x <= 6; x++) if (x * x * 0.6 + (y + 5) * (y + 5) * 2 <= 34) rdcPix(B, x + 1, hy + y, rdcRampAt(Hr, 0.1 + (y + 9) / 4 * 0.5, x, y), 1); rdcRect(B, Lk.hatType === 'straw' ? -6 : 3, hy - 5, Lk.hatType === 'straw' ? 16 : 6, 1, Hr[2], 1); } }
  }
  // 前面的胳膊 + 武器
  let hx, hyy, ang = 0.3;
  if (act === 'shoot') { hx = 9; hyy = -27 + by; ang = 0; limb(3, -28 + by, hx, hyy, 3, T); }
  else if (act && act.indexOf('swing') === 0) { const k = +act.slice(5); ang = [-2.2, -0.8, 0.9][k]; hx = 2 + Math.cos(ang) * 8; hyy = -27 + by + Math.sin(ang) * 8; limb(2, -28 + by, hx, hyy, 3, T); }
  else { const as = walk ? sw * 0.8 : 0; hx = 2 + as; hyy = -18 + by; ang = wpn ? 0.5 : 0.3; limb(2, -28 + by, hx, hyy, 3, T); }
  rdcRect(B, Math.round(hx) - 1, Math.round(hyy) - 1, 3, 3, Sk[1], 1);
  rdhWeapon(B, wpn, hx, hyy, ang, act);
  if (act === 'swing1' || act === 'swing2') for (let a = -2.2; a < ang; a += 0.12) rdcPix(B, Math.round(2 + Math.cos(a) * 22), Math.round(-27 + by + Math.sin(a) * 22), '#fff4d8', 3); // 挥砍弧线
  rdcOutline(B);
  return rdcToCanvas(B);
}
// 车外的主角（替换原来的方块小人）；npc：o.shirt 给定上衣颜色（营地里的人）
function rdhPerson(g, x, y, o) {
  const R = G.road, Q = RD_Q, me = !o.shirt, Lk = rdhLook(o), t = G.time;
  const pose = o.pose === 'walk' || o.pose === 'run' ? o.pose : 'stand';
  const fr = pose === 'stand' ? Math.floor(t * 1.2) % 4 : Math.floor(t * (pose === 'run' ? 12 : 9)) % 4;
  const hand = me && o.outside && R && R.hand ? R.hand : null, melee = hand && RD_PARTS[hand].fx.range < 20;
  let act = null;
  if (me && o.outside && R.me.swing > 0) act = melee || !hand ? 'swing' + Math.min(2, Math.floor((0.2 - R.me.swing) / 0.2 * 3)) : 'shoot';
  if (me && o.outside && hand && !melee && R.me.wcd > 0 && R.mons && R.mons.some((m) => Math.abs(m.x - R.me.wx) < RD_PARTS[hand].fx.range)) act = act || 'shoot';
  const carry = me && R.search && R.search.phase === 'back';
  const key = JSON.stringify([Lk, pose, fr, act, carry, hand]);
  let S = RDH_CACHE[key];
  if (!S) { if (++RDH_N > 300) { for (const k in RDH_CACHE) delete RDH_CACHE[k]; RDH_N = 0; } S = RDH_CACHE[key] = rdhBuild(key, Lk, pose, fr, act, carry, hand); }
  const f = o.face < 0 ? -1 : 1;
  g.save(); g.translate(Math.round(x * Q) / Q, Math.round(y * Q) / Q); if (f < 0) g.scale(-1, 1);
  g.fillStyle = 'rgba(20,12,8,0.3)'; g.fillRect(-3, 0, 7, 1 / Q * 2);
  const w = S.cv.width / Q, h = S.cv.height / Q, ox = -S.ox / Q, oy = -S.oy / Q;
  g.drawImage(S.cv, ox, oy, w, h);
  if (me && R.me.hitT > 0 && o.outside) { g.globalAlpha = 0.85; g.drawImage(S.white, ox, oy, w, h); g.globalAlpha = 1; }
  if (act === 'shoot' && Math.floor(t * 20) % 3 === 0) { g.drawImage(rdsGlow('#ffcd75'), 8, -11, 6, 4); g.fillStyle = '#fff8d8'; g.fillRect(9.5, -9.4, 2, 0.67); }
  g.restore();
}

// ---------- 宠物 ----------
function rdhPetBuild(type, st, fr) { // st: 'walk' | 'sit' | 'sleep'
  const B = rdcPaper(60, 40, 30, 32), cat = type === 'cat', C = cat ? ['#f4b070', '#e08a46', '#b0622a', '#7a4018'] : ['#e0c08a', '#c49c64', '#9a7444', '#6a4e2c'];
  const leg = (x, dx) => rdnLimb(B, x, -6, x + dx, 0, 2, C.slice(cat ? 1 : 0));
  if (st === 'sleep') { rdnBlob(B, 0, -4, 10, 4, C); rdnBlob(B, 7, -5, 4, 3, C); rdcLine(B, -9, -2, 4, -1, C[2], 1); if (cat) { rdcPix(B, 8, -9, C[1], 1); rdcPix(B, 10, -9, C[1], 1); } else rdcRect(B, 5, -7, 3, 2, C[3], 1); rdcLine(B, 7, -5, 9, -5, '#2a1a10', 1); rdcOutline(B); return rdcToCanvas(B); }
  const sw = st === 'walk' ? [-2, 0, 2, 0][fr] : 0, sit = st === 'sit';
  if (!sit) { leg(-6, -sw); leg(4, sw); }
  rdnBlob(B, -1, sit ? -6 : -8, sit ? 6 : 9, sit ? 5 : 4, C);
  if (sit) { rdnBlob(B, -3, -3, 5, 3, C); leg(3, 0); } else { leg(-4, sw); leg(6, -sw); }
  const hx = sit ? 4 : 8, hy = sit ? -14 : -12 + (st === 'walk' && fr % 2 ? -1 : 0);
  rdnBlob(B, hx, hy, cat ? 4 : 4, cat ? 4 : 3, C);
  if (cat) { rdcPoly(B, [[hx - 3, hy - 3], [hx - 2, hy - 7], [hx, hy - 3]], C, 1); rdcPoly(B, [[hx + 1, hy - 3], [hx + 3, hy - 7], [hx + 4, hy - 3]], C, 1); rdcPix(B, hx + 2, hy - 1, '#5aa03a', 4); }
  else { rdcPoly(B, [[hx + 2, hy - 1], [hx + 8, hy + 1], [hx + 7, hy + 3], [hx + 2, hy + 2]], C, 1); rdcPix(B, hx + 8, hy + 1, '#2a1a10', 1); rdcPoly(B, [[hx - 3, hy - 2], [hx - 1, hy - 5], [hx + 1, hy - 2]], [C[2], C[3]], 1); rdcLine(B, hx - 2, hy - 2, hx - 3, hy + 2, C[3], 1); rdcPix(B, hx + 2, hy - 1, '#2a1a10', 1); }
  const wag = [-3, 0, 3, 0][fr];
  if (cat) { rdcLine(B, -9, -9, -13, -15 + wag, C[1], 1); rdcLine(B, -10, -9, -14, -15 + wag, C[2], 1); } else rdcLine(B, -9, -10, -14, -12 + wag, C[1], 1);
  if (cat) for (let x = -6; x < 4; x += 3) rdcPix(B, x, sit ? -9 : -11, C[2], 1);
  rdcOutline(B); return rdcToCanvas(B);
}
function rdhPet(g, x, y, type, walking, face, sleep) {
  const t = G.time, st = sleep ? 'sleep' : walking ? 'walk' : 'sit', fr = walking ? Math.floor(t * 10) % 4 : Math.floor(t * 3) % 4, key = 'pet' + type + st + fr;
  const S = RDH_CACHE[key] || (RDH_CACHE[key] = rdhPetBuild(type, st, fr)), Q = RD_Q;
  g.save(); g.translate(Math.round(x * Q) / Q, Math.round(y * Q) / Q); if (face < 0) g.scale(-1, 1);
  g.fillStyle = 'rgba(20,12,8,0.3)'; g.fillRect(-4, 0, 8, 1 / Q * 2);
  g.drawImage(S.cv, -S.ox / Q, -S.oy / Q, S.cv.width / Q, S.cv.height / Q);
  g.restore();
}
