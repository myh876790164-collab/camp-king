// =============================================
//  修仙门派：功法特效
//  每条道途有自己的两种主色、修炼时的护体光环（aura）和施法特效（casts，对应各个战斗技能）
//  在哪里看得到：闭关/参悟/采气时身上的光环；演武场上弟子对着木人桩或同门施展道途技能；突破时的光柱；医者疗伤的灵光
// =============================================
const DAO_FX = {
  // 金
  geng: { c1: '#f4f4f4', c2: '#c8d6e5', aura: 'swords', casts: ['sword', 'sword3', 'pillar'] },
  xin: { c1: '#e8f6ff', c2: '#9fd8ff', aura: 'gems', casts: ['needles', 'gemburst', 'sword3'] },
  qian: { c1: '#fff6c0', c2: '#ffcd75', aura: 'rays', casts: ['sword', 'pillar', 'sword3'] },
  shen: { c1: '#f4f4f4', c2: '#ffcd75', aura: 'swords', casts: ['claw', 'sword', 'shock'] },
  you: { c1: '#e8e4d8', c2: '#b8c8d8', aura: 'gems', casts: ['crescent', 'needles', 'sword3'] },
  // 木
  jia: { c1: '#a7f070', c2: '#38b764', aura: 'leaves', casts: ['vine', 'treant', 'thorns'] },
  yi: { c1: '#f7a8c8', c2: '#a7f070', aura: 'petals', casts: ['petalstorm', 'vine', 'petalstorm'] },
  zhen: { c1: '#d8c8ff', c2: '#73eff7', aura: 'sparks', casts: ['bolt', 'bolt3', 'bolt'] },
  yin3: { c1: '#ffcd75', c2: '#a7f070', aura: 'leaves', casts: ['claw', 'roar', 'claw'] },
  mao: { c1: '#ffb8d8', c2: '#f7a8c8', aura: 'petals', casts: ['petalstorm', 'mist', 'petalstorm'] },
  // 水
  ren: { c1: '#41a6f6', c2: '#a0e8ff', aura: 'drops', casts: ['wave', 'wave', 'vortex'] },
  gui: { c1: '#a0e8ff', c2: '#e8f8ff', aura: 'mist', casts: ['needles', 'mist', 'icebolt'] },
  kan: { c1: '#257179', c2: '#41a6f6', aura: 'drops', casts: ['vortex', 'shield', 'wave'] },
  hai: { c1: '#1d2b53', c2: '#41a6f6', aura: 'drops', casts: ['vortex', 'shield', 'maw'] },
  zi: { c1: '#3b5dc9', c2: '#b8a8ff', aura: 'shadow', casts: ['shadow', 'dragon', 'shadow'] },
  // 火
  bing: { c1: '#ffcd75', c2: '#ef7d57', aura: 'flame', casts: ['fireball', 'firerain', 'sunburst'] },
  ding: { c1: '#ffe9a8', c2: '#ef7d57', aura: 'candle', casts: ['fireball', 'beam', 'fireball'] },
  li: { c1: '#ef7d57', c2: '#ffcd75', aura: 'feathers', casts: ['feather', 'beam', 'firerain'] },
  si: { c1: '#b13e53', c2: '#ef7d57', aura: 'flame', casts: ['fireball', 'shield', 'serpent'] },
  wu2: { c1: '#ffcd75', c2: '#b13e53', aura: 'flame', casts: ['charge', 'sunburst', 'firerain'] },
  // 土
  wu: { c1: '#c49a64', c2: '#8f6a42', aura: 'stones', casts: ['fist', 'shield', 'boulder'] },
  ji: { c1: '#d8bf94', c2: '#a7f070', aura: 'dust', casts: ['quake', 'shield', 'boulder'] },
  kun: { c1: '#c49a64', c2: '#ffcd75', aura: 'stones', casts: ['quake', 'shield', 'quake'] },
  chen: { c1: '#73eff7', c2: '#c49a64', aura: 'clouds', casts: ['claw', 'mist', 'dragon'] },
  xu: { c1: '#ef7d57', c2: '#c49a64', aura: 'dust', casts: ['claw', 'shield', 'firerain'] },
  // 阳
  taiyang: { c1: '#fff6c0', c2: '#ffcd75', aura: 'rays', casts: ['fist', 'shield', 'sunburst'] },
  shaoyang: { c1: '#ffe9a8', c2: '#ef7d57', aura: 'rays', casts: ['beam', 'beam', 'sunburst'] },
  yangming: { c1: '#ffcd75', c2: '#f4f4f4', aura: 'rays', casts: ['fist', 'sword3', 'sunburst'] },
  // 阴
  taiyin: { c1: '#e8f0ff', c2: '#b8a8ff', aura: 'moon', casts: ['crescent', 'icebolt', 'moonfall'] },
  shaoyin: { c1: '#ef7d57', c2: '#41a6f6', aura: 'yinyang', casts: ['fireball', 'icebolt', 'vortex'] },
  jueyin: { c1: '#5d275d', c2: '#a7f070', aura: 'shadow', casts: ['shadow', 'shield', 'crescent'] },
};
const PLAIN_FX = { c1: '#f4f4f4', c2: '#c8d6e5', aura: null, casts: ['fist'] };
function daoFx(p) { return (p && p.dao && DAO_FX[p.dao]) || PLAIN_FX; }

// ---------- 修炼光环（每帧直接画，不占特效列表） ----------
function drawDaoAura(ctx, p) {
  const F = daoFx(p);
  if (!F.aura) return;
  const t = G.time + p.id * 1.37, x = p.x, y = p.y - 7, R = 9 + p.realm * 1.2, lv = p.realm;
  const n = 3 + lv;
  ctx.save();
  switch (F.aura) {
    case 'swords': for (let i = 0; i < n; i++) { const a = t * 1.6 + i * Math.PI * 2 / n; fxSwordIcon(ctx, x + Math.cos(a) * R, y + Math.sin(a) * R * 0.45, a + Math.PI / 2, 4, F.c1, F.c2); } break;
    case 'gems': for (let i = 0; i < n; i++) { const a = t * 1.1 + i * 2.1, r = R * (0.6 + 0.4 * Math.sin(t * 2 + i)); fxDiamond(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, 1.5, i % 2 ? F.c1 : F.c2, 0.5 + 0.5 * Math.sin(t * 5 + i)); } break;
    case 'rays': { const g = ctx.createRadialGradient(x, y, 0, x, y, R + 4); g.addColorStop(0, hexA(F.c1, 0.35)); g.addColorStop(1, hexA(F.c2, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R + 4, 0, 7); ctx.fill();
      ctx.strokeStyle = hexA(F.c2, 0.5); ctx.lineWidth = 0.8; for (let i = 0; i < 8; i++) { const a = t * 0.5 + i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); ctx.lineTo(x + Math.cos(a) * (R + 2), y + Math.sin(a) * (R + 2)); ctx.stroke(); } break; }
    case 'leaves': for (let i = 0; i < n; i++) { const ph = (t * 0.4 + i / n) % 1, a = ph * 6.28 * 2 + i; fxLeaf(ctx, x + Math.cos(a) * R * (1 - ph * 0.5), y + 6 - ph * 18, a, i % 2 ? F.c1 : F.c2, 1 - ph); } break;
    case 'petals': for (let i = 0; i < n + 2; i++) { const ph = (t * 0.3 + i / (n + 2)) % 1, a = i * 2.4 + t; fxPetal(ctx, x + Math.cos(a) * R, y - 10 + ph * 18, a, i % 2 ? F.c1 : F.c2, Math.sin(ph * Math.PI)); } break;
    case 'sparks': for (let i = 0; i < n; i++) { if (Math.sin(t * 13 + i * 7) < 0.3) continue; const a = i * 2.3 + Math.floor(t * 6); fxZig(ctx, x + Math.cos(a) * 4, y + Math.sin(a) * 4, x + Math.cos(a) * R, y + Math.sin(a) * R * 0.7, F.c1, 0.8); } break;
    case 'drops': for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i / 3) % 1; ctx.strokeStyle = hexA(F.c2, 0.6 * (1 - ph)); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(x, p.y, 3 + ph * R, (3 + ph * R) * 0.35, 0, 0, 7); ctx.stroke(); }
      for (let i = 0; i < n; i++) { const ph = (t * 0.7 + i / n) % 1; ctx.fillStyle = hexA(F.c1, 1 - ph); ctx.fillRect(x + Math.sin(i * 3.1) * R * 0.8, y - 10 + ph * 14, 1, 2); } break;
    case 'mist': for (let i = 0; i < 4; i++) { const a = t * 0.4 + i * 1.57; ctx.fillStyle = hexA(F.c1, 0.16); ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * 0.7, y + 4 + Math.sin(a) * 3, 5 + lv, 0, 7); ctx.fill(); } break;
    case 'shadow': for (let i = 0; i < n; i++) { const ph = (t * 0.5 + i / n) % 1, a = i * 1.9 + t * 0.3; ctx.fillStyle = hexA(i % 2 ? F.c1 : F.c2, 0.55 * (1 - ph)); ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * (1 - ph), y + Math.sin(a) * R * 0.5 * (1 - ph) - ph * 6, 2.2 - ph, 0, 7); ctx.fill(); } break;
    case 'flame': for (let i = 0; i < n + 2; i++) { const ph = (t * 1.2 + i / (n + 2)) % 1, ox = Math.sin(i * 2.7) * R * 0.7; fxFlameBit(ctx, x + ox, y + 6 - ph * 18, 2.6 * (1 - ph) + 0.5, ph < 0.5 ? F.c1 : F.c2, 1 - ph); } break;
    case 'candle': { const fl = Math.sin(t * 9) * 0.5; fxFlameBit(ctx, x, y - 14 + fl, 2.2, F.c1, 0.9); const g = ctx.createRadialGradient(x, y - 13, 0, x, y - 13, R); g.addColorStop(0, hexA(F.c1, 0.3)); g.addColorStop(1, hexA(F.c1, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 13, R, 0, 7); ctx.fill(); break; }
    case 'feathers': for (let i = 0; i < n; i++) { const a = t * 0.9 + i * Math.PI * 2 / n; fxFeather(ctx, x + Math.cos(a) * R, y + Math.sin(a) * R * 0.45, a, F.c1, F.c2); } break;
    case 'stones': for (let i = 0; i < n; i++) { const a = t * 0.8 + i * Math.PI * 2 / n, bob = Math.sin(t * 2 + i) * 1.5; ctx.fillStyle = '#1a1c2c'; ctx.fillRect(x + Math.cos(a) * R - 1.6, y + Math.sin(a) * R * 0.45 - 1.6 + bob, 3.2, 3.2); ctx.fillStyle = i % 2 ? F.c1 : F.c2; ctx.fillRect(x + Math.cos(a) * R - 1.1, y + Math.sin(a) * R * 0.45 - 1.1 + bob, 2.2, 2.2); } break;
    case 'dust': for (let i = 0; i < n + 3; i++) { const ph = (t * 0.6 + i / (n + 3)) % 1, a = i * 2.2; ctx.fillStyle = hexA(i % 2 ? F.c1 : F.c2, 0.7 * (1 - ph)); ctx.fillRect(x + Math.cos(a) * R * ph, p.y - ph * 5, 1.5, 1.5); } break;
    case 'clouds': for (let i = 0; i < 3; i++) { const a = t * 0.7 + i * 2.1; ctx.fillStyle = hexA(F.c1, 0.3); ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * R, y + Math.sin(a) * R * 0.4, 4, 2, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = hexA(F.c2, 0.5); ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k <= 12; k++) { const a = t * 1.2 + k * 0.45; const px = x + Math.cos(a) * R * 0.9, py = y + Math.sin(a) * R * 0.4 - k * 0.3; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); break;
    case 'moon': { const mx = x, my = y - 16 - Math.sin(t) * 1; ctx.fillStyle = hexA(F.c1, 0.9); ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, 7); ctx.fill(); ctx.fillStyle = '#1a1c2c'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(mx + 1.6, my - 0.8, 3, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R + 3); g.addColorStop(0, hexA(F.c2, 0.25)); g.addColorStop(1, hexA(F.c2, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R + 3, 0, 7); ctx.fill(); break; }
    case 'yinyang': { const a = t * 1.2, r = 5; ctx.translate(x, y - 15); ctx.rotate(a); ctx.fillStyle = F.c1; ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.fill(); ctx.fillStyle = F.c2; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5); ctx.fill();
      ctx.fillStyle = F.c1; ctx.beginPath(); ctx.arc(0, r / 2, r / 2, 0, 7); ctx.fill(); ctx.fillStyle = F.c2; ctx.beginPath(); ctx.arc(0, -r / 2, r / 2, 0, 7); ctx.fill(); break; }
  }
  ctx.restore();
}

// ---------- 小图形 ----------
function fxSwordIcon(ctx, x, y, a, len, c1, c2) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(-0.9, -len - 0.5, 1.8, len * 1.6 + 1);
  ctx.fillStyle = c1; ctx.fillRect(-0.5, -len, 1, len * 1.3);
  ctx.fillStyle = c2; ctx.fillRect(-1.6, len * 0.3, 3.2, 0.9);
  ctx.restore();
}
function fxDiamond(ctx, x, y, s, col, a) { ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.6); ctx.lineTo(x - s, y); ctx.fill(); ctx.globalAlpha = 1; }
function fxLeaf(ctx, x, y, a, col, al) { ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 2.4, 1, 0, 0, 7); ctx.fill(); ctx.restore(); }
function fxPetal(ctx, x, y, a, col, al) { ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 1.8, 1.1, 0, 0, 7); ctx.fill(); ctx.restore(); }
function fxFlameBit(ctx, x, y, r, col, al) { ctx.globalAlpha = Math.max(0, Math.min(1, al)); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - r * 2); ctx.quadraticCurveTo(x + r, y, x, y + r * 0.6); ctx.quadraticCurveTo(x - r, y, x, y - r * 2); ctx.fill(); ctx.globalAlpha = 1; }
function fxFeather(ctx, x, y, a, c1, c2) { ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(0, 0, 1.3, 3.2, 0, 0, 7); ctx.fill(); ctx.fillStyle = c2; ctx.fillRect(-0.3, -3, 0.6, 6); ctx.restore(); }
function fxZig(ctx, x1, y1, x2, y2, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1);
  const n = 5;
  for (let i = 1; i < n; i++) { const k = i / n; ctx.lineTo(x1 + (x2 - x1) * k + rand(-2.5, 2.5), y1 + (y2 - y1) * k + rand(-2.5, 2.5)); }
  ctx.lineTo(x2, y2); ctx.stroke();
}

// ---------- 施法特效（放进 G.effects，由引擎统一更新和绘制） ----------
function castDaoFx(kind, F, x, y, tx, ty, power) {
  const s = Math.min(2, 1 + (power || 0) * 0.15);
  G.effects.push({ type: 'custom', draw: drawCastFx, kind, c1: F.c1, c2: F.c2, x, y, tx, ty, s, seed: Math.random() * 100, t: 0, life: CAST_LIFE[kind] || 0.8 });
}
const CAST_LIFE = { sword: 0.6, sword3: 0.8, needles: 0.5, gemburst: 0.7, pillar: 1.1, claw: 0.45, shock: 0.6, crescent: 0.6, vine: 0.9, treant: 1, thorns: 0.9, petalstorm: 1.1, bolt: 0.5, bolt3: 0.7, roar: 0.8, mist: 1.1, wave: 0.9, vortex: 1.1, icebolt: 0.6, shield: 1, maw: 0.9, shadow: 0.9, dragon: 1.1, fireball: 0.6, firerain: 1.1, sunburst: 1, beam: 0.6, feather: 0.7, serpent: 0.9, charge: 0.6, fist: 0.4, boulder: 0.9, quake: 0.9, moonfall: 1.1, breakthrough: 2.2, failsmoke: 1.4, heal: 1 };
function drawCastFx(ctx, e) {
  const k = e.t / e.life, x = e.x, y = e.y - 8, tx = e.tx, ty = e.ty - 6, c1 = e.c1, c2 = e.c2, s = e.s;
  const lerp = (a, b, f) => a + (b - a) * f, ang = Math.atan2(ty - y, tx - x);
  const fly = Math.min(1, k * 1.6), px = lerp(x, tx, fly), py = lerp(y, ty, fly) - Math.sin(fly * Math.PI) * 4;
  const hit = k > 0.6, hk = (k - 0.6) / 0.4;
  ctx.save();
  switch (e.kind) {
    case 'fist': ctx.globalAlpha = 1 - k; ctx.strokeStyle = c1; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(tx, ty, 2 + k * 6, 0, 7); ctx.stroke(); break;
    case 'sword': if (!hit) fxSwordIcon(ctx, px, py, ang + Math.PI / 2, 5 * s, c1, c2); else { ctx.globalAlpha = 1 - hk; ctx.strokeStyle = c1; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx - 7 * s, ty - 5); ctx.lineTo(tx + 7 * s, ty + 5); ctx.stroke(); } break;
    case 'sword3': for (let i = -1; i <= 1; i++) { const f = Math.min(1, k * 1.6 - Math.abs(i) * 0.1); if (f < 0 || f >= 1) continue; const ox = Math.cos(ang + Math.PI / 2) * i * 5; fxSwordIcon(ctx, lerp(x, tx, f) + ox, lerp(y, ty, f) + Math.sin(ang + Math.PI / 2) * i * 5, ang + Math.PI / 2, 4.5 * s, c1, c2); }
      if (hit) { ctx.globalAlpha = 1 - hk; ctx.strokeStyle = c2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(tx - 6, ty - 6 + i * 4); ctx.lineTo(tx + 6, ty - 2 + i * 4); ctx.stroke(); } } break;
    case 'needles': for (let i = 0; i < 7; i++) { const a = ang + (i - 3) * 0.12, d = Math.min(1, k * 2) * Math.hypot(tx - x, ty - y); ctx.globalAlpha = 1 - k; ctx.strokeStyle = i % 2 ? c1 : c2; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (d - 4), y + Math.sin(a) * (d - 4)); ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); ctx.stroke(); } break;
    case 'gemburst': for (let i = 0; i < 10; i++) { const a = i * 0.628 + e.seed, r = k * 14 * s; fxDiamond(ctx, tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.7, 1.6, i % 2 ? c1 : c2, 1 - k); } break;
    case 'pillar': case 'breakthrough': {
      const big = e.kind === 'breakthrough', w = (big ? 10 : 6) * s, h = big ? 90 : 40, a = Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (1 - Math.max(0, k - 0.6) / 0.4);
      const g = ctx.createLinearGradient(tx - w, 0, tx + w, 0); g.addColorStop(0, hexA(c2, 0)); g.addColorStop(0.5, hexA(c1, 0.85 * a)); g.addColorStop(1, hexA(c2, 0));
      ctx.fillStyle = g; ctx.fillRect(tx - w, ty - h, w * 2, h + 4);
      ctx.strokeStyle = hexA(c1, a); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(tx, ty + 4, w * (1 + k), w * 0.4 * (1 + k), 0, 0, 7); ctx.stroke();
      if (big) for (let i = 0; i < 14; i++) { const ph = (k * 1.5 + i / 14) % 1; ctx.fillStyle = hexA(i % 2 ? c1 : c2, (1 - ph) * a); ctx.fillRect(tx + Math.sin(i * 2.3 + e.seed) * w * 1.2, ty - ph * h, 1.5, 3); }
      break; }
    case 'claw': ctx.globalAlpha = 1 - k; ctx.strokeStyle = c1; ctx.lineWidth = 1.4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(tx - 6 + i * 3, ty - 7); ctx.quadraticCurveTo(tx + i * 3, ty, tx + 5 + i * 3, ty + 7); ctx.stroke(); } break;
    case 'shock': ctx.globalAlpha = 1 - k; ctx.strokeStyle = c2; ctx.lineWidth = 2 * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(tx, ty, 2 + k * 16 * s, 0, 7); ctx.stroke(); break;
    case 'crescent': { const cx = lerp(x, tx, Math.min(1, k * 1.4)), cy = lerp(y, ty, Math.min(1, k * 1.4)); ctx.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3; ctx.translate(cx, cy); ctx.rotate(ang); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(0, 0, 6 * s, -1.2, 1.2); ctx.arc(-2.5, 0, 5 * s, 1.1, -1.1, true); ctx.fill(); break; }
    case 'vine': { ctx.strokeStyle = c2; ctx.lineWidth = 1.4; ctx.beginPath(); const f = Math.min(1, k * 1.8); for (let i = 0; i <= 20 * f; i++) { const q = i / 20, vx = lerp(x, tx, q), vy = lerp(y + 8, ty + 4, q) + Math.sin(q * 14 + e.seed) * 3; i ? ctx.lineTo(vx, vy) : ctx.moveTo(vx, vy); } ctx.stroke();
      if (f >= 1) { ctx.strokeStyle = c1; ctx.globalAlpha = 1 - hk; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(tx, ty - 2 + i * 3, 5, 1.6, 0, 0, 7); ctx.stroke(); } } break; }
    case 'treant': { const h = Math.min(1, k * 2) * 22 * s; ctx.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3; ctx.fillStyle = '#5a3e28'; ctx.fillRect(tx - 2, ty + 4 - h, 4, h); ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(tx, ty + 4 - h, h * 0.45, 0, 7); ctx.fill(); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(tx - 2, ty + 2 - h, h * 0.25, 0, 7); ctx.fill(); break; }
    case 'thorns': for (let i = 0; i < 6; i++) { const ox = (i - 2.5) * 3.5, h = Math.min(1, k * 2.5 - i * 0.1) * 10 * s; if (h <= 0) continue; ctx.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3; ctx.fillStyle = i % 2 ? c1 : c2; ctx.beginPath(); ctx.moveTo(tx + ox - 1.5, ty + 5); ctx.lineTo(tx + ox, ty + 5 - h); ctx.lineTo(tx + ox + 1.5, ty + 5); ctx.fill(); } break;
    case 'petalstorm': for (let i = 0; i < 14; i++) { const a = k * 9 + i * 0.45, r = (1 - k) * 18 + 4; fxPetal(ctx, tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.6, a, i % 2 ? c1 : c2, 1 - k * 0.8); } break;
    case 'bolt': case 'bolt3': {
      const n = e.kind === 'bolt3' ? 3 : 1;
      if (k < 0.5) for (let i = 0; i < n; i++) { const ox = (i - (n - 1) / 2) * 9; fxZig(ctx, tx + ox + rand(-3, 3), ty - 60, tx + ox * 0.3, ty, i % 2 ? c2 : c1, 1.6); }
      ctx.globalAlpha = Math.max(0, 1 - k * 1.5); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(tx, ty, 6 * s * (1 - k), 0, 7); ctx.fill(); break; }
    case 'roar': for (let i = 0; i < 3; i++) { const r = (k * 1.5 - i * 0.2) * 22; if (r <= 0) continue; ctx.globalAlpha = Math.max(0, 1 - k - i * 0.1); ctx.strokeStyle = c1; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, ang - 0.6, ang + 0.6); ctx.stroke(); } break;
    case 'mist': for (let i = 0; i < 6; i++) { const a = i * 1.05 + e.seed, r = 4 + k * 10; ctx.fillStyle = hexA(i % 2 ? c1 : c2, 0.3 * (1 - k)); ctx.beginPath(); ctx.arc(tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.5, 5 + k * 4, 0, 7); ctx.fill(); } break;
    case 'wave': { const f = Math.min(1, k * 1.4); ctx.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3; ctx.strokeStyle = c1; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(lerp(x, tx, f) - Math.cos(ang) * 6, lerp(y, ty, f) - Math.sin(ang) * 6, 8 * s, ang - 1, ang + 1); ctx.stroke(); ctx.strokeStyle = c2; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(lerp(x, tx, f) - Math.cos(ang) * 9, lerp(y, ty, f) - Math.sin(ang) * 9, 8 * s, ang - 0.9, ang + 0.9); ctx.stroke(); break; }
    case 'vortex': { ctx.globalAlpha = 1 - k * 0.8; for (let j = 0; j < 2; j++) { ctx.strokeStyle = j ? c2 : c1; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= 30; i++) { const a = i * 0.4 + k * 12 + j * Math.PI, r = i * 0.45 * s; const vx = tx + Math.cos(a) * r, vy = ty + Math.sin(a) * r * 0.5; i ? ctx.lineTo(vx, vy) : ctx.moveTo(vx, vy); } ctx.stroke(); } break; }
    case 'icebolt': if (!hit) { ctx.translate(px, py); ctx.rotate(ang); ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -2); ctx.lineTo(-3, 2); ctx.fill(); } else for (let i = 0; i < 6; i++) { const a = i * 1.05; fxDiamond(ctx, tx + Math.cos(a) * hk * 8, ty + Math.sin(a) * hk * 5, 1.2, c2, 1 - hk); } break;
    case 'shield': { const a = Math.sin(k * Math.PI); ctx.strokeStyle = hexA(c1, a); ctx.fillStyle = hexA(c2, 0.18 * a); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y + 2, 10 * s, Math.PI, 0); ctx.lineTo(x + 10 * s, y + 8); ctx.lineTo(x - 10 * s, y + 8); ctx.closePath(); ctx.fill(); ctx.stroke(); break; }
    case 'maw': { const o = Math.sin(Math.min(1, k * 2) * Math.PI) * 6; ctx.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3; ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(tx, ty - o, 9, 3, 0, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.ellipse(tx, ty + o, 9, 3, 0, 0, Math.PI); ctx.fill(); break; }
    case 'shadow': for (let i = 0; i < 9; i++) { const a = i * 0.7 + e.seed, r = (1 - k) * 18; ctx.fillStyle = hexA(i % 2 ? c1 : c2, 0.7 * (1 - k * 0.6)); ctx.beginPath(); ctx.arc(tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.6, 2, 0, 7); ctx.fill(); } break;
    case 'dragon': case 'serpent': { const f = Math.min(1, k * 1.3), body = e.kind === 'dragon' ? 3 : 2; ctx.globalAlpha = 1 - Math.max(0, k - 0.75) / 0.25; for (let i = 0; i < 12; i++) { const q = f - i * 0.04; if (q < 0) break; const vx = lerp(x, tx, q), vy = lerp(y, ty, q) + Math.sin(q * 12 + e.seed) * 5; ctx.fillStyle = i ? (i % 2 ? c1 : c2) : '#f4f4f4'; ctx.beginPath(); ctx.arc(vx, vy, body - i * 0.12, 0, 7); ctx.fill(); } break; }
    case 'fireball': if (!hit) { const g = ctx.createRadialGradient(px, py, 0, px, py, 5 * s); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.5, c1); g.addColorStop(1, hexA(c2, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 5 * s, 0, 7); ctx.fill(); for (let i = 1; i < 5; i++) fxFlameBit(ctx, px - Math.cos(ang) * i * 3, py - Math.sin(ang) * i * 3, 2 - i * 0.3, c2, 0.8 - i * 0.15); }
      else { ctx.globalAlpha = 1 - hk; ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(tx, ty, 3 + hk * 9 * s, 0, 7); ctx.fill(); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(tx, ty, 2 + hk * 5 * s, 0, 7); ctx.fill(); } break;
    case 'firerain': for (let i = 0; i < 6; i++) { const st = i * 0.1, f = (k - st) / 0.5; if (f < 0 || f > 1.3) continue; const fx = tx + (i - 2.5) * 5 + Math.sin(i * 3.3) * 3, fy = ty - 50 + Math.min(1, f) * 50; if (f < 1) { fxFlameBit(ctx, fx, fy, 2.2, c1, 1); ctx.strokeStyle = hexA(c2, 0.6); ctx.beginPath(); ctx.moveTo(fx, fy - 10); ctx.lineTo(fx, fy - 2); ctx.stroke(); } else { ctx.fillStyle = hexA(c2, 1 - (f - 1) / 0.3); ctx.beginPath(); ctx.arc(fx, ty, 3, 0, 7); ctx.fill(); } } break;
    case 'sunburst': { const a = Math.sin(Math.min(1, k * 2) * Math.PI / 2) * (1 - Math.max(0, k - 0.6) / 0.4); const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 20 * s); g.addColorStop(0, hexA('#fff6c0', a)); g.addColorStop(0.4, hexA(c1, 0.7 * a)); g.addColorStop(1, hexA(c2, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty, 20 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = hexA(c1, a); ctx.lineWidth = 1; for (let i = 0; i < 12; i++) { const r = i * Math.PI / 6 + k; ctx.beginPath(); ctx.moveTo(tx + Math.cos(r) * 8, ty + Math.sin(r) * 8); ctx.lineTo(tx + Math.cos(r) * 24 * s * k, ty + Math.sin(r) * 24 * s * k); ctx.stroke(); } break; }
    case 'beam': { const a = 1 - k; ctx.strokeStyle = hexA(c2, a); ctx.lineWidth = 4 * s * a; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.strokeStyle = hexA('#fff6c0', a); ctx.lineWidth = 1.5 * a; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); break; }
    case 'feather': for (let i = -2; i <= 2; i++) { const f = Math.min(1, k * 1.5 - Math.abs(i) * 0.05); if (f >= 1) continue; const a = ang + i * 0.18; fxFeather(ctx, x + Math.cos(a) * f * Math.hypot(tx - x, ty - y), y + Math.sin(a) * f * Math.hypot(tx - x, ty - y), a, c1, c2); } break;
    case 'charge': { ctx.globalAlpha = 1 - k; for (let i = 0; i < 5; i++) { const q = Math.min(1, k * 1.6) - i * 0.06; if (q < 0) continue; ctx.fillStyle = i ? c2 : c1; ctx.fillRect(lerp(x, tx, q) - 2, lerp(y, ty, q) - 2, 4, 4); } break; }
    case 'boulder': { const f = Math.min(1, k * 1.6); if (f < 1) { const by = ty - 50 + f * 50; ctx.fillStyle = '#1a1c2c'; ctx.beginPath(); ctx.arc(tx, by, 5.5 * s, 0, 7); ctx.fill(); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(tx, by, 4.5 * s, 0, 7); ctx.fill(); ctx.fillStyle = c2; ctx.fillRect(tx - 1, by - 2, 2, 2); }
      else { ctx.globalAlpha = 1 - hk; for (let i = 0; i < 8; i++) { const a = i * 0.785; ctx.fillStyle = c1; ctx.fillRect(tx + Math.cos(a) * hk * 12 - 1, ty + Math.sin(a) * hk * 6 - 1, 2, 2); } } break; }
    case 'quake': { ctx.globalAlpha = 1 - k; ctx.strokeStyle = c2; ctx.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const a = i * 1.05 + e.seed; ctx.beginPath(); ctx.moveTo(tx, ty + 4); ctx.lineTo(tx + Math.cos(a) * 6 * Math.min(1, k * 3) * s, ty + 4 + Math.sin(a) * 3); ctx.lineTo(tx + Math.cos(a + 0.3) * 13 * Math.min(1, k * 3) * s, ty + 4 + Math.sin(a + 0.3) * 6); ctx.stroke(); }
      for (let i = 0; i < 5; i++) { ctx.fillStyle = c1; ctx.fillRect(tx + Math.sin(i * 4 + e.seed) * 10, ty + 2 - Math.sin(k * Math.PI) * 8, 2, 2); } break; }
    case 'moonfall': { const f = Math.min(1, k * 1.4); ctx.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3; ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(tx, ty - 40 + f * 36, 7 * s, 0, 7); ctx.fill(); ctx.fillStyle = hexA(c2, 0.5); ctx.beginPath(); ctx.arc(tx + 2, ty - 41 + f * 36, 6 * s, 0, 7); ctx.fill(); break; }
    case 'failsmoke': for (let i = 0; i < 8; i++) { const ph = (k + i / 8) % 1; ctx.fillStyle = 'rgba(60,40,70,' + (0.5 * (1 - ph) * (1 - k)) + ')'; ctx.beginPath(); ctx.arc(tx + Math.sin(i * 2.1) * 6 * ph, ty - ph * 22, 2 + ph * 4, 0, 7); ctx.fill(); } break;
    case 'heal': for (let i = 0; i < 5; i++) { const ph = (k + i / 5) % 1; ctx.fillStyle = hexA(c1, 1 - ph); ctx.fillRect(tx + Math.sin(i * 2.7) * 6 - 0.5, ty - ph * 16 - 2, 1, 3); ctx.fillRect(tx + Math.sin(i * 2.7) * 6 - 1.5, ty - ph * 16 - 1, 3, 1); } break;
  }
  ctx.restore();
}

// ---------- 演武场：弟子对着木人桩或同门施展技能 ----------
const DUMMY_POS = [[46.8, 37.6], [46.8, 39.4], [56.2, 37.6], [56.2, 39.4]];
function sectTrainCasts(dt) {
  for (const p of G.sect.people) {
    if (p.away || p.task !== 'train' || p.at !== 'yanwu' || p.moving || p.hurt > 0) continue;
    p.castT = (p.castT === undefined ? rand(0.5, 2) : p.castT) - dt;
    if (p.castT > 0) continue;
    p.castT = rand(2.2, 4);
    const mates = G.sect.people.filter((q) => q !== p && !q.away && q.task === 'train' && q.at === 'yanwu' && !q.moving);
    let tx, ty;
    if (mates.length && Math.random() < 0.5) { const q = pick(mates); tx = q.x; ty = q.y; }
    else { const d = pick(DUMMY_POS); tx = (d[0] + 0.5) * T; ty = (d[1] + 0.4) * T; }
    p.face = tx > p.x ? 1 : -1;
    sectCastSkill(p, tx, ty);
  }
}
function sectCastSkill(p, tx, ty) {
  const F = daoFx(p), cs = skillsOf(p).filter((s) => s.kind === 'c');
  let kind = 'fist', name = '';
  if (cs.length) {
    const i = randInt(0, cs.length - 1);
    kind = F.casts[i % F.casts.length]; name = cs[i].n;
  }
  castDaoFx(kind, F, p.x, p.y, tx, ty, p.realm);
  if (name && G.cam.zoom >= 1.6) addFloat(p.x, p.y - 26, name, F.c1, false);
}
// 突破 / 失败 / 疗伤的特效
function sectBreakFx(p, ok) {
  const F = daoFx(p);
  if (ok) {
    castDaoFx('breakthrough', F, p.x, p.y, p.x, p.y, p.realm);
    if (F.casts) castDaoFx(F.casts[F.casts.length - 1], F, p.x - 20, p.y - 10, p.x, p.y, p.realm);
  } else castDaoFx('failsmoke', F, p.x, p.y, p.x, p.y, 0);
}
function sectHealFx() {
  for (const p of G.sect.people) if (!p.away && p.hurt > 0) castDaoFx('heal', { c1: '#a7f070', c2: '#38b764' }, p.x, p.y, p.x, p.y, 0);
}
