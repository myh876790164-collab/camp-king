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
// ---------- 主角（写实精细像素，车内车外共用一套画法） ----------
// 外观完全照「进游戏前选的角色形象」（js/avatar.js 的 AV_LOOKS）：13 种发型、12 种上衣、6 种下装、鞋色、
// 配饰（护目镜、墨镜、眼镜、手套、贝雷帽、鸭舌帽、草帽、头巾、发带、面罩、眼罩、胡子、围巾、耳环、耳机、花、发簪、袖标、颈圈、领带、蝴蝶结）。
// 比例按真人：身高约 5 个头，腿长占一半；肢体是带明暗的圆柱，关节用两段式反向运动学（IK）算，坐下、开车、抱膝都自然弯曲。
// K = 放大倍数：车外 K = 1（身高 46 精细像素，和车一样的比例），车内 K = 2.4（身高约 110 精细像素 ≈ 37 世界像素，
// 车厢里高 50，正好是 2.2 米高的车厢里站一个 1.7 米的人）。光从左上来（和车一样），描边用彩色描边。
const RDH_LIT = [-0.55, -0.83]; // 光的方向（从左上来）
// 颜色梯度：亮 → 本色（稍微压一点饱和、偏暖，和末日画风统一）→ 暗 → 最暗
// （和车的调色板一个思路：本色往暖灰靠一点、亮部偏奶油色、暗部偏暖褐，不用冷紫）
function rdhRampW(c) { const b = rdMix(c, '#8a7a66', 0.2); return [rdMix(b, '#f6ead0', 0.26), b, rdMix(b, '#3a2418', 0.3), rdMix(b, '#24160f', 0.55)]; }
// 平涂分块：v 小 = 亮边，中间 = 本色，大 = 暗面（不抖点、不渐变）
function rdhBand(R, v) { return R[v < 0.2 ? 0 : v > 0.6 ? 2 : 1]; }
// 圆柱（胶囊）：a → b，半径 r（给了 r1 就从 r 渐变到 r1，像大腿到膝盖越来越细），按光照方向在 ramp 里取色（精细像素坐标）
function rdhCap(B, a, b, r0, R, mat, r1) {
  if (r1 == null) r1 = r0;
  const rm = Math.max(r0, r1);
  const x0 = Math.floor(Math.min(a[0], b[0]) - rm - 1), x1 = Math.ceil(Math.max(a[0], b[0]) + rm + 1);
  const y0 = Math.floor(Math.min(a[1], b[1]) - rm - 1), y1 = Math.ceil(Math.max(a[1], b[1]) + rm + 1);
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L2));
    const ox = px - (a[0] + dx * t), oy = py - (a[1] + dy * t), d = Math.hypot(ox, oy), r = r0 + (r1 - r0) * t;
    if (d > r) continue;
    const s = (ox * RDH_LIT[0] + oy * RDH_LIT[1]) / r; // +1 朝光
    rdcPix(B, x, y, R[s > 0.55 ? 0 : s < -0.4 ? 2 : 1], mat || 1); // 平涂三块：亮边、本色、背光面（和车一样，不做圆滑渐变）
  }
}
// 两段式关节：从 a 伸向 c，两段长 l1 / l2，bend = ±1 决定关节往哪边弯；返回 [关节, 末端]（够不着就伸直）
function rdhIK(a, c, l1, l2, bend) {
  const dx = c[0] - a[0], dy = c[1] - a[1], d0 = Math.hypot(dx, dy) || 0.01, d = Math.min(d0, l1 + l2 - 0.01);
  const A = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))), base = Math.atan2(dy, dx);
  const j = [a[0] + Math.cos(base + bend * A) * l1, a[1] + Math.sin(base + bend * A) * l1];
  return [j, [a[0] + dx / d0 * d, a[1] + dy / d0 * d]];
}
// 角色外观：主角 = 选好的形象（穿防护服时上衣下装换成防护服）；npc（o.shirt）= 随机路人
function rdhLookFull(o) {
  if (o && o.shirt) {
    const s = (o.seed != null ? o.seed + 1 : o.shirt.charCodeAt(3)) * 7;
    return { skin: ['#f2d0a9', '#d9a77c', '#b07a52'][s % 3], hair: ['short', 'long', 'messy', 'ponytail'][s % 4], hc: ['#3a2a22', '#6a4a2a', '#2a2a30', '#a8a090'][s % 4], top: s % 2 ? 'jacket' : 'tee', tc: o.shirt, t2: '#d8d0c0',
      bot: 'pants', bc: '#4a4a5a', sc: '#3a2a22', acc: s % 4 === 3 ? [['cap', '#6a5a3a']] : [], f: s % 4 === 1 || s % 4 === 3, suit: null, helmet: false };
  }
  const R = G.road, suit = R && R.suit ? RD_PARTS[R.suit] : null, L = avLook();
  const suitC = suit && suit.id !== 'suit1' ? ({ suit2: '#e8c060', suit3: '#4a5040', suit4: '#e8c060', suit5: '#b84a3a', suit6: '#6a7484', suit7: '#9aa8b4', suit8: '#5a6040', suit9: '#6a4a98' })[suit.id] : null;
  const base = { skin: AV_SKIN[L.skin], hair: L.hair, hc: L.hc, top: L.top, tc: L.tc, t2: L.t2, bot: L.bot, bc: L.bc, sc: L.sc, acc: L.acc, f: L.sex === 'f', suit: null, helmet: false };
  if (!suitC) return base;
  return Object.assign(base, { top: 'hazmat', tc: suitC, t2: rdMix(suitC, '#1e140e', 0.3), bot: 'pants', bc: rdMix(suitC, '#1e140e', 0.12), sc: '#2a2a30', suit: suitC,
    acc: L.acc.filter((a) => ['glasses', 'sunglasses', 'beard', 'eyepatch', 'earring'].includes(a[0])), helmet: ['suit4', 'suit6', 'suit8', 'suit9'].includes(suit.id) });
}
function rdhAcc(Lk, k) { const a = Lk.acc.find((x) => x[0] === k); return a ? a[1] : null; }

// ---------- 画一个人（缓存成图片）----------
// pose：stand / walk / run / sit / drive / sitfloor / hug / lie / curl；fr：动画帧
// o：hold（手上拿的）、seat（坐的高度，世界像素）、act（车外：swing0~2 / shoot）、wpn（车外随身武器）、carry（背着大袋子）、pack（背包）
function rdhBody(K, Lk, pose, fr, o) {
  const oy = Math.ceil(60 * K) + 8, W = Math.ceil(80 * K) + 24, B = rdcPaper(W, oy + Math.ceil(4 * K) + 6, Math.round(W / 2), oy);
  const lie = pose === 'lie', curl = pose === 'curl';
  // 基础坐标（身高 46 个单位，脚底中间是原点，朝右）→ 精细像素
  const rot = lie || curl; // 躺着：站着的骨架转 90 度（头朝左、脸朝上）；curl = 躺着把膝盖弯起来（短床也睡得下）
  const M = rot ? (p) => [(p[1] + 23) * K, (-p[0] - 5.4) * K] : (p) => [p[0] * K, p[1] * K];
  const Mv = rot ? (v) => [v[1], -v[0]] : (v) => v;
  const add = (p, d) => [p[0] + d[0], p[1] + d[1]], lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const T = rdhRampW(Lk.tc), T2 = rdhRampW(Lk.t2), Pn = rdhRampW(Lk.bc), Sk = rdhRampW(Lk.skin), H = rdhRampW(Lk.hc), Sh = rdhRampW(Lk.sc);
  const dk = (R) => R.map((c) => rdMix(c, '#1e140e', 0.2)); // 后面那一侧暗一点
  const glove = rdhAcc(Lk, 'gloves'), Hd = glove ? rdhRampW(glove) : Sk;
  const top = Lk.top, bot = Lk.bot, f = Lk.f;
  const C = (a, b, r, R, m, r1) => rdhCap(B, M(a), M(b), r * K, R, m, r1 != null ? r1 * K : null);
  // ---- 骨架（基础单位）----
  // 走路 / 跑步 8 帧一个循环：两条腿前后交替、往前迈的脚抬起来、身子在两腿并拢时最高；胳膊和腿反着摆
  // 站着 4 帧呼吸：肩膀一起一伏、手跟着轻轻晃；重心放在后脚上，前脚稍微往前、膝盖不绷直（不僵）
  const walk = pose === 'walk' || pose === 'run', run = pose === 'run';
  const ph = walk ? fr / 8 * Math.PI * 2 : 0, sp = Math.sin(ph), cp = Math.cos(ph), A = run ? 6.4 : 4.8;
  const bob = walk ? -(run ? 1.5 : 0.9) * (1 - Math.abs(sp)) : 0;
  const breathe = walk ? 0 : [0, -0.3, -0.55, -0.3][fr % 4], sway = walk ? 0 : [0, 0.2, 0.35, 0.2][fr % 4];
  const LT = 11, LS = 10.6, AU = 7.6, AF = 6.6; // 大腿、小腿、上臂、前臂
  let hip, sh, ankF, ankB, nod = 0.1; // nod：头往前低一点（弧度）
  const seatU = (o.seat || 0) * RD_Q / K; // 座位高度（基础单位）
  if (pose === 'sit' || pose === 'drive') { hip = [0, -seatU - 1.6]; sh = [0.2 + (pose === 'drive' ? 2.8 : 0), hip[1] - 13.3 + breathe]; ankF = [pose === 'drive' ? 13 : 10.5, -1.6]; ankB = [ankF[0] - 1.6, -1.6]; nod = 0.16; } // 坐着微微含胸
  else if (pose === 'sitfloor' || pose === 'hug') { hip = [-1, -3]; sh = pose === 'hug' ? [2.4, -16.2] : [-0.2, -16.4 + breathe]; ankF = [10, -1.6]; ankB = [8.6, -1.6]; nod = pose === 'hug' ? 0.35 : 0.2; }
  else { // 站、走、跑、躺（躺 = 站着的骨架转 90 度）
    hip = [walk ? 0 : 0.3, -23 + bob]; sh = [(run ? 3.2 : walk ? 1.2 : 0.7), -36.5 + bob + breathe];
    if (walk) {
      const lift = (c) => Math.pow(Math.max(0, c), 1.5) * (run ? 3.6 : 2.2); // 往前迈的那条腿抬脚
      ankF = [A * sp, -1.6 - lift(cp)]; ankB = [-A * sp, -1.6 - lift(-cp)];
    } else { ankF = [1.7, -1.6]; ankB = [-1.3, -1.6]; }
    if (curl) { ankF = [-3.6, -16]; ankB = [-4.2, -15.4]; } // 脚收到屁股边上，膝盖往上弓
    if (run) nod = 0.05;
  }
  const headC = add(sh, pose === 'hug' ? [1.8, -4.6] : [1.0 + nod * 2, -5.0]);
  const faceF = [Math.cos(nod), Math.sin(nod)], faceU = [Math.sin(nod), -Math.cos(nod)];
  const [kneeF, footF] = rdhIK(hip, ankF, LT, LS, -1);
  const [kneeB, footB] = rdhIK(add(hip, [-0.6, 0]), ankB, LT, LS, -1);
  const aF = footF, aB = footB;
  // 手：相对肩膀的目标位置
  const hold = o.hold, act = o.act;
  let hf, hb, ang = 0.4;
  const R2 = (p) => add(sh, p);
  if (curl) { hf = R2([3.5, 9]); hb = R2([2.5, 9.5]); } // 手搭在肚子上
  else if (lie) { hf = R2([1.5, 13.5]); hb = R2([-1, 13.5]); }
  else if (act === 'shoot') { hf = R2([10, 2.5]); hb = R2([7, 3.5]); ang = 0; }
  else if (act && act.indexOf('swing') === 0) { ang = [-2.2, -0.8, 0.9][+act.slice(5)]; hf = R2([Math.cos(ang) * 11, 1 + Math.sin(ang) * 11]); hb = R2([-3, 11]); }
  else if (pose === 'drive') { hf = R2([10.5, 6.5]); hb = R2([9.5, 7.5]); }
  else if (pose === 'hug') { hf = add(kneeF, [0.5, 1.5]); hb = add(kneeB, [-0.5, 2]); }
  else if (hold) {
    const H1 = { arms: [10.5, 9], cup: fr % 2 ? [5, -0.5] : [7.5, 7], can: [8.5, 10], bar: [3, -12 + (fr % 2) * 5], mic: [5.5, -1], cue: [11, 10.5], brush: [11, 1 + (fr % 2)] }[hold] || [6, 12];
    hf = R2(H1); hb = R2(hold === 'bar' ? [-1, H1[1]] : hold === 'arms' ? [H1[0] - 2.5, H1[1] + 1] : hold === 'cue' ? [3, 10] : walk ? [A * 0.6 * sp - 0.5, 12.8] : [-1.4, 12.8]);
  }
  else if (pose === 'sit' || pose === 'sitfloor') { hf = add(hip, [7.4, -1.4]); hb = add(hip, [6.2, -1]); } // 手搭在大腿上
  else if (run) { hf = R2([1.5 - sp * 5.5, 8.6 - Math.max(0, -sp) * 2.5]); hb = R2([1.5 + sp * 5.5, 8.6 - Math.max(0, sp) * 2.5]); } // 跑步：胳膊弯成直角前后甩
  else if (walk) { hf = R2([0.8 - sp * A * 0.62, 12.9 - Math.max(0, -sp) * 1.4]); hb = R2([0.8 + sp * A * 0.62, 12.9 - Math.max(0, sp) * 1.4]); } // 胳膊和腿反着摆，往前摆时手肘弯一点
  else { hf = R2([1.9 + sway, 12.7]); hb = R2([-1.2 + sway * 0.5, 12.9]); } // 站着：手自然垂在身体两侧稍微靠前，手肘微弯
  const shF = add(sh, [0.4, 0.6]), shB = add(sh, [-0.8, 0.9]);
  const [elF, wF] = rdhIK(shF, hf, AU, AF, 1), [elB, wB] = rdhIK(shB, hb, AU, AF, 1);
  // ---- 衣服配色 ----
  const sleeve = top === 'tank' ? 'skin' : (top === 'tee' || top === 'qipao') ? 'short' : top === 'robe' ? 'wide' : 'long';
  const legSkin = bot === 'skirt' || bot === 'qipao' || bot === 'longskirt', shorts = bot === 'shorts';
  // 胳膊：肩膀粗、手腕细；袖子在手肘处有一道褶；手是带拇指的手掌（不是圆球）
  const arm = (s, el, w, R, Sr, back) => {
    const sl = back ? dk(T) : T;
    if (sleeve === 'wide') { C(s, el, 2.0, sl, 1, 1.85); C(el, w, 1.85, sl, 1, 2.0); C(lerp(el, w, 0.85), w, 2.05, back ? dk(T2) : T2); }
    else if (sleeve === 'long') {
      C(s, el, 1.85, sl, 1, 1.45); C(el, w, 1.5, sl, 1, 1.2);
      if (K >= 1.5) { const e = M(el); rdcPix(B, Math.round(e[0]), Math.round(e[1]), sl[2], 1); rdcPix(B, Math.round(e[0]) + 1, Math.round(e[1]) - 1, sl[2], 1); } // 手肘的褶
      if (top === 'sailor' || top === 'idol') C(lerp(el, w, 0.82), w, 1.4, back ? dk(T2) : T2);
    }
    else { C(s, el, 1.7, Sr, 1, 1.3); C(el, w, 1.35, Sr, 1, 1.0); if (sleeve === 'short') C(s, lerp(s, el, 0.48), 1.95, sl, 1, 1.75); }
    if (!back && rdhAcc(Lk, 'armband')) { C(lerp(s, el, 0.45), lerp(s, el, 0.62), 1.9, ['#f8f4ea', '#e0d8c8', '#b0a898', '#807868']); const p = M(lerp(s, el, 0.53)); rdcPix(B, Math.round(p[0]), Math.round(p[1]), rdhAcc(Lk, 'armband'), 1); }
    // 手掌顺着前臂的方向，拇指朝前
    const dx = w[0] - el[0], dy = w[1] - el[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
    const HR = back ? dk(Hd) : Hd;
    B.cur++; // 手单独算一个部件（和袖口之间有分界线）
    C(w, add(w, [ux * 1.8, uy * 1.8]), 1.15, HR, 1, 0.85);
    C(add(w, [ux * 0.5 + Math.abs(uy) * 0.9, uy * 0.5 - Math.abs(ux) * 0.5]), add(w, [ux * 1.1 + Math.abs(uy) * 1.2, uy * 1.1 - Math.abs(ux) * 0.7]), 0.5, HR); // 拇指
    // （手掌画完）
  };
  // 腿：大腿粗、膝盖细、小腿肚鼓一点、脚踝细；鞋有鞋跟、鞋头和深色鞋底
  const leg = (h, k, a, ft, R, Sr, back) => {
    const calf = lerp(k, a, 0.32);
    if (legSkin) { C(h, k, 2.0, Sr, 1, 1.45); C(k, calf, 1.45, Sr, 1, 1.6); C(calf, a, 1.6, Sr, 1, 1.0); }
    else if (shorts) { C(lerp(h, k, 0.7), k, 1.75, Sr, 1, 1.45); C(k, calf, 1.45, Sr, 1, 1.6); C(calf, a, 1.6, Sr, 1, 1.05); C(h, lerp(h, k, 0.72), 2.6, R, 1, 2.3); }
    else {
      C(h, k, 2.65, R, 1, 2.0); C(k, a, 2.0, R, 1, 1.75);
      if (!rot) C(lerp(k, a, 0.86), a, 1.95, back ? dk(Pn) : Pn, 1, 2.1); // 裤脚
      if (K >= 1.5) { const kk = M(k); rdcPix(B, Math.round(kk[0]) + 1, Math.round(kk[1]), R[2], 1); rdcPix(B, Math.round(kk[0]), Math.round(kk[1]) + 1, R[2], 1); } // 膝盖的褶
    }
    const small = f && legSkin, tl = small ? 3.1 : 3.7, S2 = back ? dk(Sh) : Sh;
    B.cur++; // 鞋单独算一个部件
    C(add(a, [-0.9, 0.35]), add(a, [tl, 0.55]), small ? 1.0 : 1.3, S2, 1, small ? 0.8 : 1.15); // 鞋：鞋跟在脚踝后面一点，鞋头略扁
    if (!small) C(add(a, [-1.0, 1.25]), add(a, [tl + 0.3, 1.25]), 0.42, [S2[3], S2[3], S2[3], S2[3]], 1); // 鞋底
  };
  // ---- 头发（身后那一层：长发、马尾、双马尾、辫子、围巾尾巴）----
  const hs = Lk.hair, rx = 3.7, ry = 4.4;
  const HP = (a, b) => add(headC, [faceF[0] * a + faceU[0] * b, faceF[1] * a + faceU[1] * b]); // 头上的点（a 朝前，b 朝上）
  const hairBack = () => {
    if (Lk.helmet) return;
    if (hs === 'long') { C(HP(-3.2, 1), HP(-4.6, -8), 2.3, H); C(HP(-4.6, -8), HP(-4.4, -12.5), 1.7, H); }
    if (hs === 'ponytail') { C(HP(-4.2, 1.4), HP(-6.2, -2), 1.3, H); C(HP(-6.2, -2), HP(-6.4, -8), 1.1, H); }
    if (hs === 'twintail') { C(HP(-3.4, 2.6), HP(-5.4, -3), 1.5, H); C(HP(-5.4, -3), HP(-5.2, -11), 1.3, H); }
    if (hs === 'braid') { for (let k = 0; k < 7; k++) C(HP(-4.4 - k * 0.15, -0.5 - k * 1.7), HP(-4.5 - k * 0.15, -1.7 - k * 1.7), 1.1, k % 2 ? H : dk(H)); C(HP(-5.5, -12.6), HP(-5.5, -12.6), 0.8, rdhRampW('#ffcd75')); }
    const sc = rdhAcc(Lk, 'scarf'); if (sc && !rot) C(add(sh, [-2, -0.3]), add(sh, [-4.2, 5.5]), 1.1, dk(rdhRampW(sc)));
    if (top === 'hoodie' && !rot) C(add(sh, [-2.6, -1.6]), add(sh, [-1.6, 0.4]), 2.3, dk(T)); // 帽兜
  };
  // ---- 躯干：按上衣种类逐像素上色 ----
  const torso = () => {
    const ws = f ? 8.8 : 9.8, ww = f ? 7.4 : 8;
    const h = M(hip), s = M(sh), dx = s[0] - h[0], dy = s[1] - h[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux; // n = 前胸方向
    const lit = nx * RDH_LIT[0] + ny * RDH_LIT[1] > 0 ? 1 : -1, R = ws * K / 2 + 3;
    const x0 = Math.floor(Math.min(h[0], s[0]) - R), x1 = Math.ceil(Math.max(h[0], s[0]) + R), y0 = Math.floor(Math.min(h[1], s[1]) - R), y1 = Math.ceil(Math.max(h[1], s[1]) + R);
    const tie = rdhAcc(Lk, 'tie'), TieR = tie ? rdhRampW(tie) : null, overall = bot === 'overalls';
    const belt = (bot === 'pants' || bot === 'shorts' || bot === 'skirt' || overall) && !['robe', 'coat', 'labcoat', 'qipao', 'idol', 'hazmat'].includes(top);
    // 侧面的身体曲线：前面有胸口、小肚子；后面有肩胛骨、腰往里收、屁股往外鼓（不是一个直筒）
    const bump = (u, c, w) => Math.exp(-((u - c) / w) * ((u - c) / w));
    const half = (u, front) => {
      let hw = (ww + (ws - ww) * Math.min(1, u * 1.3)) / 2;
      if (front) hw += (f ? 0.95 : 0.55) * bump(u, 0.7, 0.16) + 0.25 * bump(u, 0.28, 0.14) - 0.25 * bump(u, 0.48, 0.1);
      else hw += 0.45 * bump(u, 0.82, 0.12) - 0.5 * bump(u, 0.4, 0.16) + (f ? 1.0 : 0.7) * bump(u, 0.04, 0.13);
      if (u > 0.88) hw -= (u - 0.88) * 14; // 圆肩
      return hw;
    };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - h[0], py = y + 0.5 - h[1], u = (px * ux + py * uy) / L, v = (px * nx + py * ny) / K;
      if (u < -0.1 || u > 1.03) continue;
      const hw = half(u, v >= 0);
      if (Math.abs(v) > hw || (u < -0.04 && v > 0)) continue;
      const vn = v / hw, s2 = vn * lit;
      let c = rdhBand(T, 0.4 - s2 * 0.32 + (1 - u) * 0.06), R1 = null;
      if (top === 'jacket' && vn > 0.32 && u < 0.9) R1 = vn < 0.44 ? dk(T) : T2;                    // 敞开的夹克：里面的衣服
      else if ((top === 'coat' || top === 'labcoat') && vn > 0.45) R1 = vn < 0.55 ? dk(T) : T2;
      else if (top === 'suit' && vn > 0.5 && u > 0.42) R1 = T2;                                   // 西装：衬衫领口
      else if (top === 'armor' && u > 0.38 && u < 0.86 && vn > -0.55) R1 = (Math.abs(u - 0.62) < 0.03 || Math.abs(vn - 0.2) < 0.08) ? dk(T2) : T2; // 胸前护甲板
      else if (top === 'sailor' && ((u > 0.8 && vn < 0.2) || (u > 0.72 && vn > 0.7))) R1 = T2;      // 水手领
      else if (top === 'robe' && (Math.abs(vn - (u - 0.35) * 1.6) < 0.13 || u < 0.16)) R1 = T2;    // 交领 + 腰带
      else if (top === 'idol' && (u > 0.92 || u < 0.08 || (u > 0.72 && vn > 0.6))) R1 = T2;
      else if (top === 'qipao' && (u > 0.9 || Math.abs(vn - 0.3 - (u - 0.7)) < 0.1 && u > 0.6)) R1 = T2; // 立领 + 斜襟
      else if (top === 'hoodie' && u > 0.12 && u < 0.34 && vn > 0.1) R1 = dk(T);                    // 卫衣口袋
      else if (top === 'tank' && u > 0.86 && (vn > 0.2 || vn < -0.5)) R1 = Sk;                      // 背心露肩
      else if (top === 'hazmat' && Math.abs(u - 0.55) < 0.025) R1 = T2;
      if (overall && u < 0.62 && vn > -0.4) R1 = (u > 0.56 && vn > 0.45 && vn < 0.75) ? ['#ffe0a0', '#ffcd75', '#c89840', '#806020'] : Pn; // 背带裤
      else if (overall && Math.abs(vn - 0.15) < 0.18) R1 = Pn;
      if (tie && u > 0.28 && u < 0.9 && vn > 0.72) R1 = TieR;
      if (belt && u < 0.07) R1 = vn > 0.7 ? ['#e8d090', '#c8b078', '#988050', '#605030'] : ['#5a4434', '#44322a', '#30221a', '#1e140e'];
      if (R1) c = rdhBand(R1, 0.4 - s2 * 0.3);
      if (!R1 && (top === 'jacket' || top === 'coat' || top === 'hoodie') && Math.abs(vn + 0.15 - (0.75 - u) * 0.9) < 0.06 && u > 0.35 && u < 0.75) c = T[2]; // 衣服褶皱
      rdcPix(B, x, y, c, 1);
    }
    // 领口露一点脖子
    if (!['hazmat', 'qipao', 'hoodie'].includes(top) && !rot) { const p = M(add(sh, [2.6, 0.4])); for (let k = 0; k < Math.max(1, Math.round(K * 0.8)); k++) rdcPix(B, Math.round(p[0]) - k, Math.round(p[1]) + k, Sk[1], 1); }
  };
  // ---- 长下摆：裙子、长裙、旗袍、大衣、长袍（照着腿的位置画，所以坐下时盖在大腿上）----
  const drape = () => {
    let to = 0, R = Pn;
    if (bot === 'skirt') to = 0.85; else if (bot === 'longskirt') to = 2; else if (bot === 'qipao') { to = 1.3; R = T; }
    if (top === 'coat' || top === 'labcoat') { if (to < 0.62) { to = 0.62; R = T; } }
    if (top === 'robe' && bot !== 'longskirt') { to = 1.15; R = T; }
    if (!to) return;
    const at = (k, a) => to <= 1 ? lerp(hip, k, to) : lerp(k, a, to - 1);
    const fw = 2.3 + (to > 1 ? 0.6 : 0.9);
    const pts = [add(hip, [-4.2, -1]), add(hip, [4, -1])];
    if (to > 1) pts.push(add(kneeF, [2.4, 0]), add(at(kneeF, aF), [fw, 0]), add(at(kneeB, aB), [-fw, 0]), add(kneeB, [-2.4, 0]));
    else pts.push(add(at(kneeF, aF), [fw, 0.6]), add(at(kneeB, aB), [-fw, 0.6]));
    rdcPoly(B, pts.map(M), R, 1, 0.1, 0.85);
    if (top === 'labcoat') { const p = M(add(sh, [3.4, 5])); rdcRect(B, Math.round(p[0]), Math.round(p[1]), Math.max(1, Math.round(K * 0.6)), Math.max(2, Math.round(K * 2)), '#5a90c8', 1); } // 胸口别的笔
  };
  // ---- 头：脸、五官、头发、帽子、眼镜 ----
  const head = () => {
    const hc = M(headC), ryK = ry * K, fF = Mv(faceF), fU = Mv(faceU); // fF / fU：画面里的「朝前」「朝上」
    const rel = (x, y) => { const px = (x + 0.5 - hc[0]) / K, py = (y + 0.5 - hc[1]) / K; return [px * fF[0] + py * fF[1], px * fU[0] + py * fU[1]]; };
    const scan = (e, fn) => { const r = Math.ceil((ry + e + 3) * K); for (let y = Math.floor(hc[1] - r); y <= hc[1] + r; y++) for (let x = Math.floor(hc[0] - r); x <= hc[0] + r; x++) { const [a, b] = rel(x, y); fn(x, y, a, b); } };
    const shade = (x, y, R, k) => rdhBand(R, k - ((x + 0.5 - hc[0]) * RDH_LIT[0] + (y + 0.5 - hc[1]) * RDH_LIT[1]) / (ryK + 1) * 0.36);
    const shell = (a, b, e) => (a * a) / ((rx + e) * (rx + e)) + (b * b) / ((ry + e) * (ry + e)) <= 1;
    const pix = (a, b, c, m) => { const p = M(HP(a, b)); rdcPix(B, Math.floor(p[0]), Math.floor(p[1]), c, m || 1); };
    const blk = (a, b, w, h, c, m) => { const n = Math.max(1, Math.round(w * K)), mh = Math.max(1, Math.round(h * K)); const p = M(HP(a, b)); for (let j = 0; j < mh; j++) for (let i = 0; i < n; i++) { const q = [p[0] + fF[0] * i - fU[0] * j, p[1] + fF[1] * i - fU[1] * j]; rdcPix(B, Math.floor(q[0]), Math.floor(q[1]), c, m || 1); } };
    // 脸（下巴往前一点）
    scan(0.6, (x, y, a, b) => { if (shell(a, b, 0) || (a > 0 && a < rx + 0.25 && b < -0.8 && b > -ry + 0.4)) rdcPix(B, x, y, shade(x, y, Sk, 0.38 + (b < -3 ? 0.14 : 0)), 1); });
    if (Lk.helmet) { // 防护服头盔
      const Hr = rdhRampW(Lk.suit);
      scan(3, (x, y, a, b) => { if (shell(a, b, 2.2)) rdcPix(B, x, y, shade(x, y, Hr, 0.42), 2); });
      scan(3, (x, y, a, b) => { if (shell(a, b, 1.6) && a > 0.6 && b > -2.4 && b < 2.6) rdcPix(B, x, y, b > 1.4 ? '#cdeef6' : '#6aa8c0', 3); });
      return;
    }
    // 耳朵
    scan(0.2, (x, y, a, b) => { const d = ((a + 0.4) / 0.8) ** 2 + ((b + 0.2) / 1.15) ** 2; if (d <= 1) rdcPix(B, x, y, d < 0.35 ? Sk[3] : Sk[2], 1); });
    // 五官
    const pw = Math.max(1, Math.round(K * 0.5)), eyeA = 1.9 + (K < 1.5 ? 0.5 : 0);
    if (rot || o.blink) { for (let a = eyeA - 0.6; a <= eyeA + 0.5; a += 1 / K) pix(a, 0.05 + (a > eyeA ? 0.1 : 0), Sk[3]); if (f) pix(eyeA + 0.6, 0.25, '#1e140e'); } // 闭眼（睡觉 / 眨眼）：一条弯弯的线
    else {
      if (K >= 1.5) blk(eyeA - 0.6, 0.6, 0.6, 0.7, '#ece4d6'); // 眼白
      blk(eyeA, 0.7, 0.5, 0.85, '#1e140e');                    // 眼珠
      if (K >= 1.5) blk(eyeA + 0.1, 0.65, 0.25, 0.25, '#f4efe6'); // 眼睛里的高光
      if (K >= 1.5) for (let a = eyeA - 0.6; a <= eyeA + 0.5; a += 1 / K) pix(a, 0.85, Sk[2]); // 上眼皮的阴影
      if (f) blk(eyeA + 0.3, 1.0, 0.45, 0.3, '#1e140e');        // 睫毛
    }
    for (let a = eyeA - 0.7; a <= eyeA + 0.8; a += 1 / K) pix(a, 1.55 + (a > eyeA ? 0.1 : 0), H[2]); // 眉毛
    if (K >= 1.5) for (let a = eyeA - 0.7; a <= eyeA + 0.6; a += 1 / K) pix(a, 1.55 - 0.42, H[3]);
    for (let b = -1.25; b <= 0.1; b += 1 / K) { const out = 0.55 * (1 - Math.abs(b + 0.7) / 0.8); for (let a = rx - 0.3; a <= rx + out; a += 1 / K) pix(a, b, Sk[1]); } // 鼻子
    pix(rx + 0.1, -1.3, Sk[3]);
    for (let a = 2.1; a <= 3.2; a += 1 / K) pix(a, -2.55, f ? '#c0606a' : Sk[3]); // 嘴
    if (K >= 1.5 && f) blk(1.5, -1.1, 0.7, 0.45, rdMix(Lk.skin, '#e07070', 0.4)); // 腮红
    const beard = rdhAcc(Lk, 'beard');
    if (beard) { const Br = rdhRampW(beard); scan(0.8, (x, y, a, b) => { if ((shell(a, b, 0.25) || (a > 0 && a < rx + 0.45 && b < -0.8 && b > -ry - 0.1)) && b < -1.5 + Math.max(0, -a) * 0.9 && a > -1.2) rdcPix(B, x, y, shade(x, y, Br, 0.45), 1); }); for (let a = 2.1; a <= 3.2; a += 1 / K) pix(a, -2.55, Br[3]); }
    // 头发
    const fringe = ['long', 'bob', 'ponytail', 'twintail', 'bun', 'braid'].includes(hs);
    scan(2.8, (x, y, a, b) => {
      let e = hs === 'buzz' ? 0.22 : hs === 'slick' ? 0.55 : hs === 'curly' ? 1.4 + rdcNoise2(x / (1.4 * K), y / (1.4 * K), 5) * 0.8 : 0.9;
      let on = shell(a, b, e) && (b > 1.0 - Math.max(0, -a) * 0.9 || a < -1.0) && !(a > 2.5 && b < 1.9);
      if (hs === 'mohawk') { on = shell(a, b, 2.4) && b > ry - 1.2 && a > -4 && a < 2.4; if (!on && shell(a, b, 0.2) && (b > 1.2 || a < -1.4) && !(a > 2.5 && b < 1.9)) rdcPix(B, x, y, shade(x, y, Sk.map((c) => rdMix(c, Lk.hc, 0.25)), 0.5), 1); }
      if (hs === 'messy' && !on && shell(a, b, 2) && b > 2.4 && rdcHash(Math.round(Math.atan2(b, a) * 5), 0, 9) > 0.45) on = true;
      if (hs === 'bob' && shell(a, b, 1.1) && a < 1.3 && b < 1.5 && b > -4.6) on = true;
      if (fringe && shell(a, b, 0.9) && a > 0.4 && a < 3.4 && b > 1.25) on = true;
      if (hs === 'topknot' && Math.hypot(a + 0.6, b - ry - 1.4) < 1.6) on = true;
      if (hs === 'bun' && Math.hypot(a + 3.6, b - 2.4) < 2.1) on = true;
      if (hs === 'ponytail' && Math.hypot(a + 4.1, b - 1.4) < 1.2) on = true;
      if (!on) return;
      // 头发分成一缕一缕（按绕头的角度分组，组和组之间压暗），受光那侧有一道亮弧（头发的光泽）
      const an = Math.atan2(b, a + 0.8), cl = an * 3.2 + rdcNoise2(a * 0.6, b * 0.6, 7) * 0.9, fr2 = cl - Math.floor(cl);
      let k = 0.44; if (fr2 < 0.16) k += 0.2; else if (fr2 > 0.8) k -= 0.06;
      const rr = Math.hypot(a / (rx + 0.6), b / (ry + 0.6));
      if (hs !== 'buzz' && rr > 0.66 && rr < 0.82 && b > 0.8 && a < 1.6 && a > -3.0) k -= 0.24;
      if (hs === 'slick' && Math.abs(b - ry + 0.6 - a * 0.2) < 0.35) k -= 0.3; // 发胶反光
      let R = H; if (hs === 'buzz') R = H.map((c) => rdMix(c, Lk.skin, 0.3));
      rdcPix(B, x, y, shade(x, y, R, k), 1);
    });
    if (hs === 'topknot') blk(-1.6, ry + 0.75, 2, 0.5, rdhAcc(Lk, 'headband') || '#ffcd75');
    if (hs === 'twintail' || rdhAcc(Lk, 'ribbon')) { const rc = rdhAcc(Lk, 'ribbon') || '#e8a0a8'; if (hs === 'twintail') { blk(-3.4, 3.4, 1.2, 1, rc); } }
    // 帽子、发饰、眼镜
    for (const [k, c] of Lk.acc) {
      const Rc = rdhRampW(c);
      if (k === 'cap') { scan(2, (x, y, a, b) => { if (shell(a, b, 1.25) && b > 1.7) rdcPix(B, x, y, shade(x, y, Rc, 0.38), 1); }); for (let a = 1.6; a <= 7; a += 1 / K) { pix(a, 1.85, Rc[2]); if (K >= 1.5) pix(a, 1.45, Rc[3]); } }
      else if (k === 'beret') scan(3, (x, y, a, b) => { if ((shell(a, b, 1.2) && b > 2.2) || (((a + 2.2) / 3.4) ** 2 + ((b - 3.6) / 1.5) ** 2 <= 1)) rdcPix(B, x, y, shade(x, y, Rc, 0.4), 1); });
      else if (k === 'strawhat') { scan(4, (x, y, a, b) => { if (shell(a, b, 1.4) && b > 2.4) rdcPix(B, x, y, shade(x, y, Math.abs(b - 3) < 0.4 ? rdhRampW('#b13e53') : Rc, 0.35), 1); }); for (let a = -7.5; a <= 7.5; a += 1 / K) { pix(a, 2.45, Rc[1]); if (K >= 1.5) pix(a, 2.05, Rc[2]); } }
      else if (k === 'bandana' || k === 'headband') { if (hs !== 'topknot' || k === 'bandana') { scan(1.5, (x, y, a, b) => { if (shell(a, b, 1.0) && b > 1.5 && b < 2.6 + (k === 'bandana' ? 0.5 : 0)) rdcPix(B, x, y, shade(x, y, Rc, 0.4), 1); }); C(HP(-4.3, 2), HP(-6, -0.2), 0.7, Rc); C(HP(-4.3, 2), HP(-5.6, -1.4), 0.6, dk(Rc)); } }
      else if (k === 'goggles') { scan(1.5, (x, y, a, b) => { if (shell(a, b, 1.0) && b > 2.3 && b < 3.0) rdcPix(B, x, y, '#5a3e28', 1); }); blk(1.6, 3.9, 2.6, 1.5, c, 3); if (K >= 1.5) blk(1.8, 3.7, 0.5, 0.5, '#f4f4f4', 3); }
      else if (k === 'sunglasses') { blk(1.1, 1.25, 2.7, 1.3, c, 2); for (let a = -0.3; a < 1.1; a += 1 / K) pix(a, 0.85, c, 2); if (K >= 1.5) blk(1.5, 1.1, 0.6, 0.35, '#566c86', 2); }
      else if (k === 'glasses') { for (let a = 1.1; a <= 3.7; a += 1 / K) { pix(a, 1.3, c, 2); pix(a, -0.15, c, 2); } for (let b = -0.15; b <= 1.3; b += 1 / K) { pix(1.1, b, c, 2); pix(3.7, b, c, 2); } for (let a = -0.3; a < 1.1; a += 1 / K) pix(a, 0.85, c, 2); }
      else if (k === 'visor') { blk(0.8, 1.45, rx + 1.2 - 0.8, 1.8, c, 3); for (let a = 0.8; a <= rx + 0.4; a += 1 / K) pix(a, 1.45, rdMix(c, '#ffffff', 0.5), 3); for (let a = -0.6; a < 0.8; a += 1 / K) pix(a, 0.6, '#333c57', 2); }
      else if (k === 'eyepatch') { blk(1.3, 1.4, 1.7, 1.7, c, 2); for (let a = -3.7; a < 1.3; a += 1 / K) pix(a, 1.6 + a * 0.06, c, 2); }
      else if (k === 'headphones') { scan(2, (x, y, a, b) => { if (shell(a, b, 1.3) && !shell(a, b, 0.85) && Math.abs(a + 0.4) < 0.9 && b > 0) rdcPix(B, x, y, '#333c57', 2); }); scan(1, (x, y, a, b) => { if (((a + 0.4) / 1.3) ** 2 + ((b + 0.2) / 1.8) ** 2 <= 1) rdcPix(B, x, y, shade(x, y, Rc, 0.4), 2); }); }
      else if (k === 'flower') { const p = HP(-1.2, 3.6); C(p, p, 0.95, Rc); const q = M(p); rdcPix(B, Math.round(q[0]), Math.round(q[1]), '#ffcd75', 1); }
      else if (k === 'hairpin') { C(HP(-4.4, 4), HP(-2, 5.4), 0.35, Rc); C(HP(-2, 5.4), HP(-2, 5.4), 0.5, rdhRampW('#e23b3b')); }
      else if (k === 'earring') { const p = M(HP(-0.4, -1.55)); rdcPix(B, Math.round(p[0]), Math.round(p[1]), c, 2); if (K >= 1.5) rdcPix(B, Math.round(p[0]), Math.round(p[1]) + 1, c, 2); }
    }
  };
  // ---- 背包 / 背着的大袋子（车外）----
  const pack = () => {
    if (o.carry) { C(add(sh, [-5.5, 2]), add(sh, [-5, 7]), 4.2, ['#d8c090', '#b89a64', '#8a7040', '#5e4a26']); C(add(sh, [-5.5, -1.5]), add(sh, [-5.5, -1.5]), 1.6, ['#b89a64', '#8a7040', '#5e4a26', '#3e2e16']); }
    else if (o.pack) C(add(sh, [-5.2, 2]), add(sh, [-5.2, 9.5]), 2.4, ['#9a7048', '#7a5434', '#5a3c22', '#3a2614']);
  };
  // ---- 画的顺序：身后的头发 → 后面的胳膊、腿 → 前面的腿 → 下摆 → 背包 → 身体 → 脖子 → 头 → 前面的胳膊 → 手上的东西 ----
  B.pid = new Uint8Array(B.w * B.h); B.cur = 1; // 每画一个部件编号 +1：后画的（在前面的）部件边上，给先画的那一侧描一道深色分界线
  arm(shB, elB, wB, null, dk(Sk), true); B.cur++;
  leg(add(hip, [-0.6, 0]), kneeB, footB, footB, dk(Pn), dk(Sk), true); B.cur++;
  leg(hip, kneeF, footF, footF, Pn, Sk, false); B.cur++;
  pack(); B.cur++;
  torso(); B.cur++;
  drape(); B.cur++;
  hairBack(); B.cur++; // 披在背上的头发、马尾、帽兜、围巾尾巴（盖在后背上）
  C(add(sh, [0.3, -0.6]), lerp(sh, headC, 0.62), 1.45, dk(Sk)); // 脖子
  const ch = rdhAcc(Lk, 'choker'); if (ch && !rot) C(add(sh, [0.1, -1.5]), add(sh, [1.3, -1.7]), 1.5, rdhRampW(ch));
  const sc = rdhAcc(Lk, 'scarf'); if (sc && !rot) { C(add(sh, [-1.6, -0.8]), add(sh, [2.4, -0.4]), 1.65, rdhRampW(sc)); C(add(sh, [2, 0]), add(sh, [2.6, 4]), 0.9, rdhRampW(sc)); }
  B.cur++; head(); B.cur++;
  arm(shF, elF, wF, null, Sk, false); B.cur++;
  // 手上的东西（精细像素）
  const hp = M(wF), hx = Math.round(hp[0]), hy = Math.round(hp[1]), q = Math.max(1, Math.round(K * 0.9));
  if (hold === 'cup') { rdcBox(B, hx, hy - 4 * q, 3 * q, 4 * q, ['#f0e6d4', '#d4c4a8', '#a8967a'], 2); rdcRect(B, hx + 3 * q, hy - 3 * q, q, 2 * q, '#a8967a', 2); rdcRect(B, hx, hy - 4 * q, 3 * q, Math.max(1, q >> 1), '#6a4a2e', 2); }
  else if (hold === 'can') { rdcBox(B, hx + q, hy - 4 * q, 3 * q, 5 * q, ['#7ab07a', '#4e8a5a', '#2e5a3a'], 2); rdcRect(B, hx + q, hy - 4 * q, 3 * q, q, '#c8c0b0', 2); }
  else if (hold === 'mic') { rdcRect(B, hx, hy - q, q, 4 * q, '#3a3a42', 2); rdcBox(B, hx - q, hy - 3 * q, 3 * q, 2 * q, ['#c8c8c8', '#8a8a92'], 2); }
  else if (hold === 'brush') { rdhCap(B, [hx, hy + 2 * q], [hx + 3 * q, hy - 5 * q], 0.5 * q, ['#a87850', '#8a6040', '#6a4830', '#4a3020'], 2); rdcRect(B, hx + 3 * q, hy - 7 * q, q + 1, 2 * q, '#d06a40', 2); }
  else if (hold === 'cue') rdhCap(B, [hx - 14 * q, hy + 3 * q], [hx + 16 * q, hy - q], 0.45 * q + 0.2, ['#d8b080', '#b08a5a', '#806040', '#584028'], 2);
  else if (hold === 'bar') { const L2 = 13 * q; rdhCap(B, [hx - L2, hy], [hx + L2, hy], 0.5 * q, ['#c8c8d0', '#8a8a92', '#5a5a62', '#3a3a42'], 2); for (const ex of [-L2, L2]) rdcBox(B, hx + ex - q, hy - 3 * q, 2 * q, 7 * q, ['#6a6a72', '#44444c', '#2a2a30'], 2); }
  if (o.wpn) { rdhWeapon(B, o.wpn, hx, hy, ang, act); if (act === 'swing1' || act === 'swing2') { const sp = M(sh); for (let a = -2.2; a < ang; a += 0.12) rdcPix(B, Math.round(sp[0] + Math.cos(a) * 22), Math.round(sp[1] + 1 + Math.sin(a) * 22), '#fff4d8', 3); } }
  rdhSeams(B, K);
  rdcOutSel(B);
  return rdcToCanvas(B);
}
// 部件分界线：像车身面板的接缝一样，前面的部件压在后面部件上的地方，后面那一侧描一圈深色（车外小人描得淡一点）
function rdhSeams(B, K) {
  const W = B.w, H = B.h, c0 = B.c.slice(), P = B.pid, O = rdcHex(RDC_PAL.out), k = K >= 1.5 ? 0.62 : 0.45;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (c0[i] < 0 || !P[i]) continue;
    let front = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (c0[j] >= 0 && P[j] > P[i] && c0[j] !== c0[i]) { front = true; break; } }
    if (front) B.c[i] = rdcMix(c0[i], O, k);
  }
}
// 车外的主角 / 营地里的人（npc：o.shirt 给定上衣颜色）；K = 1，比例和车一致
function rdhPerson(g, x, y, o) {
  const R = G.road, Q = RD_Q, me = !o.shirt, Lk = rdhLookFull(o), t = G.time;
  const pose = o.pose === 'walk' || o.pose === 'run' ? o.pose : 'stand';
  const fr = pose === 'stand' ? Math.floor(t * 1.6) % 4 : Math.floor(t * (pose === 'run' ? 16 : 11)) % 8; // 走路 / 跑步 8 帧
  const blink = pose === 'stand' && (t + (o.seed || 0) * 0.7) % 3.4 < 0.14; // 每 3 秒多眨一次眼
  const hand = me && o.outside && R && R.hand ? R.hand : null, melee = hand && RD_PARTS[hand].fx.range < 20;
  let act = null;
  if (me && o.outside && R.me.swing > 0) act = melee || !hand ? 'swing' + Math.min(2, Math.floor((0.2 - R.me.swing) / 0.2 * 3)) : 'shoot';
  if (me && o.outside && hand && !melee && R.me.wcd > 0 && R.mons && R.mons.some((m) => Math.abs(m.x - R.me.wx) < RD_PARTS[hand].fx.range)) act = act || 'shoot';
  const carry = me && R.search && R.search.phase === 'back';
  const key = 'out' + JSON.stringify([Lk, pose, fr, act, carry, hand, blink]);
  let S = RDH_CACHE[key];
  if (!S) { if (++RDH_N > 300) { for (const k in RDH_CACHE) delete RDH_CACHE[k]; RDH_N = 0; } S = RDH_CACHE[key] = rdhBody(1, Lk, pose, fr, { act, carry, wpn: hand, pack: me, blink }); }
  const f = o.face < 0 ? -1 : 1;
  g.save(); g.translate(Math.round(x * Q) / Q, Math.round(y * Q) / Q); if (f < 0) g.scale(-1, 1);
  g.fillStyle = 'rgba(20,12,8,0.3)'; g.fillRect(-3, 0, 7, 1 / Q * 2);
  const w = S.cv.width / Q, h = S.cv.height / Q, ox = -S.ox / Q, oy = -S.oy / Q;
  g.drawImage(S.cv, ox, oy, w, h);
  if (me && R.me.hitT > 0 && o.outside) { g.globalAlpha = 0.85; g.drawImage(S.white, ox, oy, w, h); g.globalAlpha = 1; }
  if (act === 'shoot' && Math.floor(t * 20) % 3 === 0) { g.drawImage(rdsGlow('#ffcd75'), 8, -14, 6, 4); g.fillStyle = '#fff8d8'; g.fillRect(9.5, -12.4, 2, 0.67); }
  g.restore();
}
// 车内的主角：K = 2.4（和车厢、家具同一比例）。x, y：世界像素的脚底（坐着时 y 是地板，o.seat 是座位高度；躺着时 y 是床面）
// o：pose、face、hold、seat、stool（自带一张小凳子）；会跟着 g 当前的透明度（洗澡半透明）
const RDH_IN_K = 2.4;
function rdhPersonIn(g, x, y, o) {
  const Q = RD_Q, Lk = rdhLookFull({}), t = G.time, pose = o.pose || 'stand', hold = o.hold || null;
  const walk = pose === 'walk' || pose === 'run';
  const fr = walk ? Math.floor(t * (pose === 'run' ? 16 : 11)) % 8 : hold === 'bar' || hold === 'cup' || hold === 'brush' ? Math.floor(t * (hold === 'cup' ? 0.6 : 1.6)) % 2 : Math.floor(t * 1.6) % 4;
  const blink = !walk && pose !== 'lie' && pose !== 'curl' && t % 3.4 < 0.14;
  const seat = Math.round((o.seat || 0) * 2) / 2;
  const key = 'in' + JSON.stringify([Lk, pose, fr, hold, seat, blink]);
  let S = RDH_CACHE[key];
  if (!S) { if (++RDH_N > 300) { for (const k in RDH_CACHE) delete RDH_CACHE[k]; RDH_N = 0; } S = RDH_CACHE[key] = rdhBody(RDH_IN_K, Lk, pose, fr, { hold, seat, blink }); }
  const f = pose === 'lie' || pose === 'curl' || o.face >= 0 ? 1 : -1, a0 = g.globalAlpha;
  g.save(); g.translate(Math.round(x * Q) / Q, Math.round(y * Q) / Q); if (f < 0) g.scale(-1, 1);
  if (o.stool) { // 小木凳（坐的地方没有家具时）
    const sh = seat, W2 = 5;
    g.fillStyle = '#2a1a10'; g.globalAlpha = a0 * 0.3; g.fillRect(-W2 - 1, -0.4, W2 * 2 + 2, 0.8); g.globalAlpha = a0;
    g.fillStyle = '#5a3c22'; g.fillRect(-W2 + 0.7, -sh + 1, 1, sh - 1); g.fillRect(W2 - 1.7, -sh + 1, 1, sh - 1); g.fillRect(-W2 + 1, -sh * 0.45, W2 * 2 - 2, 0.67);
    g.fillStyle = '#8a6040'; g.fillRect(-W2, -sh, W2 * 2, 1.34); g.fillStyle = '#b08a5e'; g.fillRect(-W2, -sh, W2 * 2, 0.34);
  }
  if (!['lie', 'curl', 'sit', 'drive'].includes(pose)) { g.globalAlpha = a0 * 0.32; g.fillStyle = '#140c08'; g.fillRect(-5, -1 / Q, 11, 2 / Q); g.globalAlpha = a0 * 0.16; g.fillRect(-8, -2 / Q, 17, 4 / Q); g.globalAlpha = a0; }
  g.drawImage(S.cv, -S.ox / Q, -S.oy / Q, S.cv.width / Q, S.cv.height / Q);
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
