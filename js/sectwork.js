// =============================================
//  修仙门派：庶务杂役（资源建筑）、挑战掌门之位、峰主推举
// =============================================

// ---------- 庶务杂役 ----------
// 资源建筑（def.chore = 要采的资源点类型）自带杂役：出门找最近的资源点 → 采集 → 背回建筑交货
const CHORE_WORKERS = [0, 1, 1, 2, 2, 3];      // 各等级的杂役人数
const CHORE_RANGE = 12;                         // 最远去几格外找资源点
function choreCount(b) { return CHORE_WORKERS[Math.min(5, b.level)] || 1; }
function choreSpeed(b) { return 1 + 0.1 * (b.level - 1); } // 每级采集、走路快 10%
function sectChoreTick(dt) {
  for (const b of G.buildings) {
    const def = b.def;
    if (!def.chore) continue;
    b.workers = b.workers || [];
    while (b.workers.length < choreCount(b)) b.workers.push({ x: b.cx, y: b.cy + 6, st: 'home', t: rand(0.2, 1.5), carry: 0, face: 1, id: Math.random() * 100 });
    if (b.workers.length > choreCount(b)) b.workers.length = choreCount(b);
    let anyWork = false;
    for (const w of b.workers) {
      const sp = 1.6 * T * choreSpeed(b);
      const walk = (tx, ty) => { const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy); if (Math.abs(dx) > 0.5) w.face = dx > 0 ? 1 : -1; if (d <= sp * dt) { w.x = tx; w.y = ty; return true; } w.x += dx / d * sp * dt; w.y += dy / d * sp * dt; return false; };
      w.moving = false;
      if (w.st === 'home') { // 在建筑门口歇一会儿，然后出门
        w.t -= dt;
        if (w.t > 0) continue;
        const n = findChoreNode(b, w);
        if (!n) { w.t = 2; continue; }
        // 站位在选定时就固定（站在资源点靠近建筑的那一侧），不能跟着朝向变，否则会在树前来回晃
        const side = b.cx < (n.x + 0.5) * T ? -1 : 1;
        w.node = n; w.tx = (n.x + 0.5) * T + 7 * side; w.ty = (n.y + 0.85) * T; w.st = 'go';
      } else if (w.st === 'go') {
        const n = w.node;
        if (!n || G.nodes[idx(n.x, n.y)] !== n) { w.st = 'home'; w.t = 0.3; continue; }
        w.moving = true;
        if (walk(w.tx, w.ty)) { w.st = 'work'; w.t = def.workTime / choreSpeed(b); w.face = (n.x + 0.5) * T > w.x ? 1 : -1; }
      } else if (w.st === 'work') {
        const n = w.node;
        if (!n || G.nodes[idx(n.x, n.y)] !== n) { w.st = 'home'; w.t = 0.3; continue; }
        w.t -= dt; anyWork = true;
        if (Math.floor(w.t * 3) !== Math.floor((w.t + dt) * 3)) n.shakeUntil = G.time + 0.12; // 一下一下地砍、凿
        if (w.t <= 0) {
          const take = Math.min(Math.round(def.carry * (def.chore === 'lingpine' ? 1 : G.mods.mine || 1)), n.amount); // 移山：矿场每趟多背
          n.amount -= take; w.carry = take;
          if (n.amount <= 0) removeNode(n);
          w.node = null; w.st = 'back';
        }
      } else if (w.st === 'back') {
        w.moving = true;
        if (walk(b.cx, b.cy + 6)) {
          const res = G.def.nodes[def.chore].res;
          G.res[res] += w.carry;
          addFloat(b.cx, b.cy - 10, '+' + w.carry + ' ' + RES_INFO[res].name, RES_INFO[res].color);
          w.carry = 0; w.st = 'home'; w.t = 0.6;
        }
      }
      if (w.st !== 'home') anyWork = true;
    }
    b.idle = !anyWork && !findChoreNode(b, null);
  }
}
// 最近的资源点（别的杂役已经盯上的尽量不抢）
function findChoreNode(b, me) {
  const type = b.def.chore, bx = Math.floor(b.cx / T), by = Math.floor(b.cy / T);
  const taken = new Set();
  for (const o of G.buildings) for (const w of o.workers || []) if (w !== me && w.node) taken.add(w.node);
  let best = null, bd = 1e9;
  for (let y = Math.max(0, by - CHORE_RANGE); y <= Math.min(MAP_H - 1, by + CHORE_RANGE); y++) {
    for (let x = Math.max(0, bx - CHORE_RANGE); x <= Math.min(MAP_W - 1, bx + CHORE_RANGE); x++) {
      const n = G.nodes[idx(x, y)];
      if (!n || n.type !== type) continue;
      const d = Math.hypot(x - bx, y - by) + (taken.has(n) ? 6 : 0);
      if (d < bd && Math.hypot(x - bx, y - by) <= CHORE_RANGE) { bd = d; best = n; }
    }
  }
  return best;
}
// 杂役小人：斗笠短褂，干活时挥工具，回程背着货
function drawChoreWorkers(ctx) {
  for (const b of G.buildings) {
    if (!b.def.chore) continue;
    const res = G.def.nodes[b.def.chore].res;
    for (const w of b.workers || []) {
      const x = Math.round(w.x), y = Math.round(w.y), f = w.face < 0 ? -1 : 1;
      const bob = w.moving ? -Math.abs(Math.sin(G.time * 10 + w.id)) : 0;
      const P = (a, c, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x + (f > 0 ? a : -a - ww), y + c + bob, ww, hh); };
      drawShadow(ctx, x, y + 0.5, 8, 0.7);
      const step = w.moving ? Math.sin(G.time * 12 + w.id) : 0;
      P(-2 + step, -2, 1.6, 2, '#3a2a22'); P(0.5 - step, -2, 1.6, 2, '#3a2a22');
      P(-2.5, -7.5, 5, 5.5, '#8f6a42'); P(-2.5, -5, 5, 1, '#5a3e28');
      P(-2, -11, 4, 3.5, '#f2d0a9');
      P(-4, -12, 8, 1.5, '#c9a86a'); P(-2, -13.5, 4, 1.5, '#b08a50'); // 斗笠
      if (w.st === 'work') { // 挥工具
        const sw = Math.sin(G.time * 14 + w.id);
        ctx.save(); ctx.translate(x + 3 * f, y - 7 + bob); ctx.rotate(f * (-0.9 + sw * 0.9));
        ctx.fillStyle = '#6e4a2e'; ctx.fillRect(-0.5, -6, 1, 6); ctx.fillStyle = '#c8d6e5'; ctx.fillRect(-1.5, -7, 3, 1.5);
        ctx.restore();
      }
      if (w.carry > 0) { // 背着货
        const col = res === 'wood' ? '#a8794f' : res === 'ore' ? '#94b0c2' : '#73eff7';
        P(-4.5, -10, 3, 5, col); P(-4.5, -10, 3, 1, '#1a1c2c');
      }
    }
  }
}

// ---------- 峰主推举 ----------
// 技艺 = 属性 + 职业 + 平时干这份差事攒下的经验（p.xp）
const PEAK_MASTER = {
  liandan: { title: '炼丹峰主', task: ['alchemy'], score: (p) => p.mind + p.qi * 0.5 + (p.prof === 'dan' ? 5 : 0) + sumFx(p, 'alch') * 8 + sumFx(p, 'alchOk') * 10, effect: '炼丹速度、成丹率' },
  lianqi: { title: '炼器峰主', task: ['forge'], score: (p) => p.mind * 0.7 + p.bone * 0.6 + (p.prof === 'qi' ? 5 : 0) + sumFx(p, 'forge') * 10, effect: '炼器速度、法器威力' },
  dianji: { title: '典籍峰主', task: ['study', 'fu'], score: (p) => p.mind * 1.3 + (p.prof === 'fu' || p.prof === 'shu' ? 3 : 0) + sumFx(p, 'wu') * 8 + sumFx(p, 'fu') * 5, effect: '参悟、制符速度' },
  yanwu: { title: '演武场主', task: ['train'], score: (p) => Math.log10(Math.max(10, personPower(p))) * 4 + (p.prof === 'jian' ? 3 : 0), effect: '演武收益' },
};
function masterScore(p, peak) {
  const M = PEAK_MASTER[peak], xp = M.task.reduce((s, t) => s + ((p.xp && p.xp[t]) || 0), 0);
  return M.score(p) + p.realm * 1.5 + Math.min(15, Math.sqrt(xp) * 0.5);
}
function sectElectMasters(silent) {
  const S = G.sect;
  S.masters = S.masters || {};
  const pool = S.people.filter((q) => !q.head && !q.away);
  const used = new Set();
  const changes = [];
  for (const peak in PEAK_MASTER) {
    const cands = pool.filter((q) => !used.has(q)).sort((a, b) => masterScore(b, peak) - masterScore(a, peak));
    const m = cands[0];
    const old = S.masters[peak];
    if (!m) { S.masters[peak] = null; continue; }
    used.add(m);
    S.masters[peak] = m.id;
    if (old !== m.id) { changes.push(PEAK_MASTER[peak].title + '：' + m.name); m.loy = Math.min(100, m.loy + 10); sectLog(m.name + ' 被推举为' + PEAK_MASTER[peak].title + '（可收徒 ' + (1 + m.realm) + ' 人，传授' + PEAK_MASTER[peak].effect.replace(/（.*）/, '') + '）' + (old ? '，原峰主门下弟子转入其门下' : ''), '#ffcd75', m); }
  }
  mentorValidate(); // 新峰主接手原峰主的徒弟（名额不够的先出师）
  if (changes.length && !silent) showBanner('峰主推举', changes.join('　'), 4, '#ffcd75');
}
function peakMaster(peak) { const id = G.sect.masters && G.sect.masters[peak]; const p = id ? sectPerson(id) : null; return p && !p.away ? p : null; }
// 峰主加成：技艺越高越多（10%~40%）
function peakMasterBonus(peak) {
  const p = peakMaster(peak);
  if (!p) return 0;
  return Math.min(0.4, 0.1 + Math.max(0, masterScore(p, peak) - 8) * 0.012);
}
function masterTitleOf(p) {
  const M = G.sect.masters || {};
  for (const k in M) if (M[k] === p.id) return PEAK_MASTER[k].title;
  return '';
}

// ---------- 挑战掌门之位 ----------
function canChallengeHead(p) {
  const h = headOf();
  return h && h !== p && !p.away && !h.away && !(p.hurt > 0) && !(h.hurt > 0) && p.realm > h.realm && !G.sect.duel;
}
function startHeadDuel(p, auto) {
  const h = headOf(), S = G.sect;
  if (!canChallengeHead(p)) return;
  S.duel = { a: p.id, b: h.id, t: 0, round: 0 };
  sectLog('【夺位】' + p.name + '（' + REALMS[p.realm] + '期）' + (auto ? '自恃修为已在掌门之上，' : '') + '在演武场向掌门 ' + h.name + '（' + REALMS[h.realm] + '期）发起挑战！', '#ef7d57', p);
  showBanner('挑战掌门之位', p.name + ' 向掌门 ' + h.name + ' 发起挑战，二人前往演武场', 4, '#ef7d57');
  for (const q of [p, h]) { q.pose = 'stand'; goTo(q, 'yanwu'); }
}
// 比斗时两人都去演武场；到齐后过招几回合（有道途特效），然后分出胜负
function sectDuelTick(dt) {
  const S = G.sect, d = S.duel;
  if (!d) return;
  const a = sectPerson(d.a), b = sectPerson(d.b);
  if (!a || !b || a.away || b.away) { S.duel = null; return; }
  d.t += dt;
  const here = a.at === 'yanwu' && b.at === 'yanwu';
  if (!here && d.t < 12) { if (a.loc !== 'yanwu') goTo(a, 'yanwu'); if (b.loc !== 'yanwu') goTo(b, 'yanwu'); return; }
  if (!d.fightT) { d.fightT = 0; a.route = []; b.route = []; const [ax, ay] = PEAKS.yanwu.anchor; a.x = (ax - 1.2) * T; a.y = (ay + 0.6) * T; b.x = (ax + 2.2) * T; b.y = (ay + 0.6) * T; a.face = 1; b.face = -1; }
  d.fightT += dt;
  a.route = []; b.route = []; a.pose = 'stand'; b.pose = 'stand'; // 比斗中站定
  const beat = Math.floor(d.fightT / 0.9);
  if (beat > d.round && d.round < 6) { d.round = beat; const [x, y] = d.round % 2 ? [a, b] : [b, a]; sectCastSkill(x, y.x, y.y); }
  if (d.fightT < 6) return;
  // 分胜负：战力 × 道途克制 × 技能
  const ka = daoClash(a.dao, b.dao), kb = daoClash(b.dao, a.dao), sa = useSkills(a, b.dao), sb = useSkills(b, a.dao);
  const pa = personPower(a) * ka.k * sa.mul * sb.foeMul, pb = personPower(b) * kb.k * sb.mul * sa.foeMul;
  const aWins = Math.random() < pa / (pa + pb);
  const win = aWins ? a : b, lose = aWins ? b : a;
  lose.hurt = Math.max(lose.hurt, randInt(20, 45));
  const why = [ka.text, sa.text && a.name + sa.text, sb.text && b.name + sb.text].filter(Boolean).join('；');
  if (aWins) {
    b.head = false; a.head = true; a.loy = 100; b.loy = Math.max(30, b.loy - 10);
    if (G.sect.masters) for (const k in G.sect.masters) if (G.sect.masters[k] === a.id) G.sect.masters[k] = null;
    sectLog('【夺位】' + a.name + ' 在演武场击败 ' + b.name + '，成为' + S.name + '新任掌门！宗门品阶变为「' + SECT_TIERS[Math.min(5, a.realm)].name + '」' + (why ? '〔' + why + '〕' : ''), '#ffcd75', a);
    showBanner('新任掌门：' + a.name, a.name + ' 击败 ' + b.name + '，宗门晋升为「' + SECT_TIERS[Math.min(5, a.realm)].name + '」', 5, '#ffcd75');
    for (let r = 0; r <= Math.min(5, a.realm); r++) sectUnlockGuide('r' + r, r === Math.min(5, a.realm));
    sectElectMasters(false);
    mentorValidate();
    sfx('win');
  } else {
    a.loy = Math.max(0, a.loy - 15);
    sectLog('【夺位】掌门 ' + b.name + ' 在演武场以弱胜强，击退了挑战者 ' + a.name + '，威望大振（声望 +5）' + (why ? '〔' + why + '〕' : ''), '#ffcd75', b);
    showBanner('掌门守住了位置', b.name + ' 击败了挑战者 ' + a.name, 4, '#ffcd75');
    S.fame += 5;
  }
  sectBreakFx(win, true);
  S.duel = null;
  for (const q of [a, b]) goTo(q, taskLoc(q));
}
// 每年：修为高过掌门、又好战/急躁/不服管的弟子，可能自己发起挑战
function sectAutoChallenge() {
  const h = headOf();
  if (!h) return;
  for (const p of G.sect.people) {
    if (!canChallengeHead(p)) continue;
    const ambition = ((p.traits || []).some((t) => t === 'haozhan' || t === 'jiaozao') ? 0.25 : 0.06) + (p.loy < 50 ? 0.2 : 0);
    if (Math.random() < ambition) { startHeadDuel(p, true); return; }
  }
}
