// =============================================
//  修仙门派：庶务杂役（资源建筑）、挑战掌门之位、峰主推举
// =============================================

// 采药房：竹篱小屋，门口晒着药草
SPR.s_herbhut = bigSprite(16, 16, (P, O, g) => {
  O(8, 14, 7, 1.8, 'rgba(10,10,25,0.35)');
  P(3, 7, 10, 7, '#a8794f'); P(3, 7, 10, 1, '#c49a64'); P(6.5, 9.5, 3, 4.5, '#3a2a22');
  g.fillStyle = '#5f8a4a'; g.beginPath(); g.moveTo(1.5, 7.5); g.lineTo(8, 2); g.lineTo(14.5, 7.5); g.fill(); // 茅草顶
  g.fillStyle = '#7aa85a'; g.beginPath(); g.moveTo(3, 7); g.lineTo(8, 3); g.lineTo(8, 7); g.fill();
  O(13, 12.5, 2.4, 1.2, '#c49a64'); P(11.5, 11, 3, 1, '#38b764'); P(12, 10.4, 1, 1, '#a7f070'); P(13.5, 10.6, 1, 1, '#ef7d57'); // 药篓
  P(1, 11, 1, 3, '#8f6a42'); P(1, 10.5, 2.5, 0.6, '#a7f070'); // 晾药架
});
// 庶务杂役的逻辑在 js/chores.js（经典模式也用）

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
