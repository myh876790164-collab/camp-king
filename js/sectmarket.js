// =============================================
//  修仙门派：师徒、高阶传承、坊市、悬赏榜
// =============================================

// ---------- 师徒 ----------
// 师承挂在“职位”上（掌门 / 各峰峰主），掌门或峰主换人时，徒弟自动转到新任名下
const MENTOR_ROLES = ['head', 'liandan', 'lianqi', 'dianji', 'yanwu'];
function roleTitle(role) { return role === 'head' ? '掌门' : PEAK_MASTER[role].title; }
function roleHolder(role) {
  if (role === 'head') return headOf() || null;
  const id = G.sect.masters && G.sect.masters[role];
  return id ? sectPerson(id) || null : null;
}
function mentorCap(role) { const h = roleHolder(role); return h ? 1 + h.realm + (role === 'head' ? 1 : 0) : 0; } // 境界越高，能带的徒弟越多
function studentsOf(role) { return G.sect.people.filter((q) => q.mentor === role); }
// 师父的师父……一路往上，会不会绕回到 p 自己（避免两位峰主互相拜师）
function mentorChainHas(h, p) {
  for (let k = 0; h && h.mentor && k < 12; k++) { h = roleHolder(h.mentor); if (h === p) return true; }
  return false;
}
function canApprentice(p, role) {
  const h = roleHolder(role);
  return !!h && h !== p && !p.head && !p.mentor && studentsOf(role).length < mentorCap(role) && !mentorChainHas(h, p);
}
function apprentice(p, role) {
  if (!canApprentice(p, role)) return;
  p.mentor = role; p.mentorSince = G.sect.t;
  const h = roleHolder(role);
  p.loy = Math.min(100, p.loy + 5);
  sectLog(p.name + ' 拜' + roleTitle(role) + ' ' + h.name + ' 为师', '#a7f070', p);
  h.log.unshift(fmtDate() + '　收 ' + p.name + ' 为徒');
}
function expelStudent(p) {
  if (!p.mentor) return;
  const h = roleHolder(p.mentor);
  sectLog(p.name + ' 被' + roleTitle(p.mentor) + (h ? ' ' + h.name : '') + '逐出师门（忠诚 -15）', '#ef7d57', p);
  p.mentor = null; p.loy = Math.max(0, p.loy - 15);
}
// 掌门、峰主换人后检查：自己不能拜自己；名额不够时，最晚入门的先出师
function mentorValidate() {
  for (const role of MENTOR_ROLES) {
    const h = roleHolder(role);
    const st = studentsOf(role).sort((a, b) => (a.mentorSince || 0) - (b.mentorSince || 0));
    for (const q of st) if (q === h || q.head || mentorChainHas(h, q)) q.mentor = null; // 自己拜自己、掌门、循环师承都解除
    const left = studentsOf(role).sort((a, b) => (a.mentorSince || 0) - (b.mentorSince || 0)), cap = mentorCap(role);
    for (const q of left.slice(cap)) { q.mentor = null; sectLog(q.name + ' 的师承转到新任' + roleTitle(role) + '名下，但名额不够，只好暂时出师', '#94b0c2', q); }
  }
}
// 师父给徒弟的加成：看师父的境界、道途是否相合、技艺
function mentorInfo(p) {
  if (!p.mentor) return null;
  const h = roleHolder(p.mentor);
  if (!h || h === p || h.away) return { h, speed: 0, brk: 0, craft: 0, rel: '', paused: true };
  let k = 1, rel = '';
  if (h.dao && p.dao) {
    if (h.dao === p.dao) { k = 1.5; rel = '同道'; }
    else if (daoGroup(h.dao) === daoGroup(p.dao)) { k = 1.25; rel = '同属'; }
    else { const a = daoWx(h.dao), b = daoWx(p.dao); if (KE[a] === b || KE[b] === a) { k = 0.8; rel = '道途相克'; } }
  }
  const head = p.mentor === 'head';
  const speed = (head ? 0.08 + 0.05 * h.realm : 0.04 + 0.03 * h.realm) * k;
  const brk = (head ? 0.02 : 0.01) * h.realm;
  const craft = head ? 0 : Math.min(0.4, 0.1 + Math.max(0, masterScore(h, p.mentor) - 8) * 0.012) * k;
  return { h, speed, brk, craft, rel, k };
}
// 某项差事有没有师父的技艺加成（峰主只教自己那一门）
function mentorCraft(p, task) {
  const m = mentorInfo(p);
  if (!m || !m.craft || p.mentor === 'head') return 0;
  return PEAK_MASTER[p.mentor].task.includes(task) ? m.craft : 0;
}
function mentorText(m, role) {
  if (!m) return '';
  if (m.paused) return '（师父不在山中，加成暂停）';
  return '修炼 +' + Math.round(m.speed * 100) + '%、突破 +' + Math.round(m.brk * 100) + '%' + (m.craft ? '、' + PEAK_MASTER[role].effect.replace(/（.*）/, '') + ' +' + Math.round(m.craft * 100) + '%' : '') + (m.rel ? '（' + m.rel + (m.k > 1 ? '，加成 ×' + m.k : '，加成打折') + '）' : '');
}

// ---------- 高阶传承：本门有化神期以上某属性修士才能研究 ----------
const SECT_MOD_DEFAULTS = { mine: 1, regrow: 1, sdef: 0, qiGather: 1, life: 0 };
function hasHighEl(el) { return G.sect && G.sect.people.some((p) => p.realm >= 4 && p.dao && daoGroup(p.dao) === el); }
function sectSpawnVeins() {
  const anchors = G.buildings.filter((b) => b.def.chore === 'orevein' || b.def.chore === 'spiritvein');
  let o = 0, s = 0;
  for (let k = 0; k < 400 && (o < 6 || s < 4); k++) {
    const a = anchors.length ? pick(anchors) : null;
    const x = a ? a.x + randInt(-5, 5) : randInt(3, MAP_W - 4), y = a ? a.y + randInt(-5, 5) : randInt(3, MAP_H - 4);
    if (o < 6 && sectPlaceNode('orevein', x, y)) o++;
    else if (s < 4 && sectPlaceNode('spiritvein', x, y)) s++;
  }
  G.miniBase = null;
}
const SECT_HIGH_TECHS = [
  { id: 'yishan', name: '移山（土行）', desc: '土行化神修士以神通移来灵脉矿脉：矿洞附近新增 6 处玄铁矿、4 处灵石矿脉；矿洞、灵石矿每趟多背 50%', cost: { lingshi: 400, ore: 80 }, cond: () => hasHighEl('tu'), condText: '需要本门有化神期以上的土行修士', apply: (m) => { m.mine *= 1.5; sectSpawnVeins(); } },
  { id: 'lihuo', name: '离火炼宝（火行）', desc: '火行化神修士以真火坐镇丹炉器炉：炼丹速度 +30%，法器威力 +25%', cost: { lingshi: 400, herb: 100 }, cond: () => hasHighEl('huo'), condText: '需要本门有化神期以上的火行修士', apply: (m) => { m.alch *= 1.3; m.forge *= 1.25; } },
  { id: 'qingdi', name: '青帝沃土（木行）', desc: '木行化神修士以生机滋养山林：灵田产出翻倍，灵草、灵松再生速度翻倍', cost: { lingshi: 350, wood: 150 }, cond: () => hasHighEl('mu'), condText: '需要本门有化神期以上的木行修士', apply: (m) => { m.prod *= 2; m.regrow *= 2; } },
  { id: 'wanjian', name: '万剑护山（金行）', desc: '金行化神修士布下万剑大阵：宗门防御 +40%，法器威力 +15%', cost: { lingshi: 400, ore: 120 }, cond: () => hasHighEl('jin'), condText: '需要本门有化神期以上的金行修士', apply: (m) => { m.sdef += 0.4; m.forge *= 1.15; } },
  { id: 'lingquan', name: '灵泉化海（水行）', desc: '水行化神修士引地下灵泉：全宗采集真气速度 +30%', cost: { lingshi: 350, herb: 80 }, cond: () => hasHighEl('shui'), condText: '需要本门有化神期以上的水行修士', apply: (m) => { m.qiGather *= 1.3; } },
  { id: 'dari', name: '大日照山（阳）', desc: '阳性化神修士引大日真阳普照山门：全宗修炼速度 +10%', cost: { lingshi: 500 }, cond: () => hasHighEl('yang'), condText: '需要本门有化神期以上的三阳修士', apply: (m) => { m.cult *= 1.1; } },
  { id: 'yuehua', name: '太阴寿境（阴）', desc: '阴性化神修士以月华洗炼全宗：所有人寿元 +8%', cost: { lingshi: 500 }, cond: () => hasHighEl('yin'), condText: '需要本门有化神期以上的三阴修士', apply: (m) => { m.life += 0.08; } },
];

// ---------- 坊市 ----------
SPR.s_market = bigSprite(16, 16, (P, O, g) => {
  O(8, 14, 7, 1.8, 'rgba(10,10,25,0.35)');
  P(2, 8, 12, 6, '#8f6a42'); P(2, 8, 12, 1, '#a8794f'); P(3, 10, 4, 3, '#ffcd75'); P(9, 10, 4, 3, '#a7f070');
  P(1.5, 3, 1, 11, '#5a3e28'); P(13.5, 3, 1, 11, '#5a3e28');
  for (let i = 0; i < 6; i++) P(1 + i * 2.4, 2, 2.4, 3.5, i % 2 ? '#f4f4f4' : '#b13e53');
  P(5, 0.5, 6, 2, '#1d2b53'); P(6, 1, 4, 1, '#ffcd75');
});
const MARKET_SELL = { herb: 1.2, ore: 2.5, wood: 0.8 }; // 卖给坊市的单价（灵石）
function marketLv() { const b = G.buildings.find((x) => x.type === 'fangshi'); return b ? b.level : 0; }
function marketK() { return 1 + 0.1 * (marketLv() - 1); }        // 坊市越大，卖价越高、买价越低
function marketBuyK() { return Math.max(0.7, 1 - 0.06 * (marketLv() - 1)); }
const SELLERS = ['散修', '游方丹师', '海外商客', '落魄世家子弟', '南疆药农', '北原猎户', '西漠盗墓客', '中州商会'];
function marketRefresh() {
  const S = G.sect, st = [], n = 5 + marketLv();
  for (let i = 0; i < n; i++) {
    const r = Math.random(), who = pick(SELLERS) + (Math.random() < 0.5 ? '「' + randName(Math.random() < 0.5 ? 'm' : 'f') + '」' : '');
    let it;
    if (r < 0.28) { const k = pick(['herb', 'ore', 'wood']), q = { herb: 30, ore: 20, wood: 40 }[k]; it = { kind: 'res', id: k, n: q, price: Math.round(q * MARKET_SELL[k] * 1.6) }; }
    else if (r < 0.5) { const d = pick(DAO_IDS); it = { kind: 'qi', id: d, n: 1, price: [0, 60, 90, 140][DAOS[d].rare] }; }
    else if (r < 0.7) { const k = pick(Object.keys(PILLS)), d = Math.random() < 0.7 ? pick(DAO_IDS) : null, c = PILLS[k].cost; it = { kind: 'pill', id: k, dao: d, n: 1, price: Math.round((c.herb || 0) * 2.2 + (c.lingshi || 0) * 1.3) }; }
    else if (r < 0.85) { const k = pick(Object.keys(TALIS)), d = Math.random() < 0.7 ? pick(DAO_IDS) : null, c = TALIS[k].cost; it = { kind: 'talis', id: k, dao: d, n: 2, price: Math.round(((c.herb || 0) * 2 + (c.lingshi || 0) * 1.3) * 1.6) }; }
    else if (r < 0.94) { const k = pick(Object.keys(TREASURES)); it = { kind: 'tr', id: k, n: 1, price: { shouguo: 650, lingzhi: 170, daoyuan: 240, huanhun: 280, yuntie: 220, shoudan: 170, wudao: 130, tianyuan: 200, leiyin: 220, yaodan: 160 }[k] || 200 }; }
    else { const left = DAO_IDS.filter((k) => !S.manuals.includes(k)); if (!left.length) continue; const k = pick(left); it = { kind: 'gf', id: k, n: 1, price: [0, 150, 240, 380][DAOS[k].rare] }; }
    it.who = who; st.push(it);
  }
  S.market.stock = st;
  S.market.refreshAt = S.t + 180;
}
function marketItemName(it) {
  if (it.kind === 'res') return RES_INFO[it.id].name + ' ×' + it.n;
  if (it.kind === 'qi') return DAOS[it.id].qiName + ' ×1';
  if (it.kind === 'pill') return sectItemName(it.id, it.dao, PILLS) + ' ×1';
  if (it.kind === 'talis') return sectItemName(it.id, it.dao, TALIS) + ' ×' + it.n;
  if (it.kind === 'tr') return TREASURES[it.id].name;
  return DAOS[it.id].gf.name + '（' + daoLabel(it.id) + '）';
}
function marketBuy(i) {
  const S = G.sect, it = S.market.stock[i];
  if (!it) return;
  const price = Math.round(it.price * marketBuyK());
  if (G.res.lingshi < price) { showBanner('灵石不足', '买下需要 ' + price + ' 灵石', 2, '#ef7d57'); sfx('bad'); return; }
  G.res.lingshi -= price;
  if (it.kind === 'res') G.res[it.id] += it.n;
  else if (it.kind === 'qi') S.qi[it.id] = (S.qi[it.id] || 0) + 1;
  else if (it.kind === 'pill') S.items[itemKey(it.id, it.dao)] = (S.items[itemKey(it.id, it.dao)] || 0) + 1;
  else if (it.kind === 'talis') S.talis[itemKey(it.id, it.dao)] = (S.talis[itemKey(it.id, it.dao)] || 0) + it.n;
  else if (it.kind === 'tr') { S.treasures[it.id] = (S.treasures[it.id] || 0) + 1; }
  else giveManual(it.id, '在坊市从' + it.who + '手中购得功法');
  S.market.stock.splice(i, 1);
  sectLog('在坊市从' + it.who + '手中买下' + marketItemName(it) + '（灵石 -' + price + '）', '#a7f070');
  sfx('coin');
}
function marketSellRes(k, n) {
  n = Math.min(n, Math.floor(G.res[k]));
  if (n <= 0) return;
  const got = Math.round(n * MARKET_SELL[k] * marketK());
  G.res[k] -= n; G.res.lingshi += got;
  sfx('coin');
  return got;
}
// 每月自动出售：资源留够底数，丹药符箓每种留几份，法器留最好的两件
function marketAutoSell() {
  const S = G.sect, M = S.market;
  if (!marketLv() || !M) return;
  let got = 0, other = 0; // got：总收入；other：丹药符箓法器的收入（资源的灵石在 marketSellRes 里已经加过了）
  const parts = [];
  for (const k of ['herb', 'ore', 'wood']) if (M.auto[k]) { const n = Math.floor(G.res[k] - M.keep); if (n > 0) { const g = marketSellRes(k, n); got += g; parts.push(RES_INFO[k].name + n); } }
  const before = got;
  if (M.auto.pill) for (const k in S.items) { const extra = S.items[k] - 2; if (extra > 0) { const c = PILLS[splitKey(k).id].cost, p = Math.round(((c.herb || 0) * 1.5 + (c.lingshi || 0)) * marketK()); S.items[k] -= extra; got += p * extra; parts.push(sectItemName(splitKey(k).id, splitKey(k).dao, PILLS) + extra); } }
  if (M.auto.talis) for (const k in S.talis) { const extra = S.talis[k] - 3; if (extra > 0) { const c = TALIS[splitKey(k).id].cost, p = Math.round(((c.herb || 0) + (c.lingshi || 0)) * marketK()); S.talis[k] -= extra; got += p * extra; parts.push(sectItemName(splitKey(k).id, splitKey(k).dao, TALIS) + extra); } }
  if (M.auto.weapon && S.weapons.length > 2) { S.weapons.sort((a, b) => b.power - a.power); const sold = S.weapons.splice(2); for (const w of sold) got += Math.round(w.power * 0.3 * marketK()); parts.push('法器' + sold.length + '件'); }
  other = got - before;
  G.res.lingshi += other;
  if (got > 0) sectLog('坊市自动售出：' + parts.join('、') + '（灵石 +' + got + '）', '#a7f070');
}

// ---------- 悬赏榜 ----------
const BOUNTY_TYPES = {
  yao: { name: '捉妖', foe: '作乱妖王', titles: ['{r}有妖兽食人，悬赏捉拿', '{r}妖狼成群作乱', '{r}千年蛇妖出洞伤人'], luck: '妖兽材料、妖丹，御兽弟子还可能收服妖兽' },
  gui: { name: '除鬼', foe: '厉鬼', titles: ['{r}古宅闹鬼，求高人超度', '{r}乱葬岗阴气冲天', '{r}有厉鬼夜夜索命'], luck: '阴属真气，鬼修与阴性道途弟子修为精进' },
  mi: { name: '探秘', foe: '秘境守卫', titles: ['{r}发现上古遗迹，招募探路修士', '{r}有秘境入口现世', '{r}古修洞府禁制松动'], luck: '天材地宝，有几率得到功法' },
  zhan: { name: '门派战争', foe: '敌派修士', titles: ['{a}与{b}开战，{a}重金招募助拳修士'], luck: '战争缴获（法器、灵石），与参战两派的关系大幅变化' },
  hu: { name: '护送', foe: '劫修', titles: ['{r}商队招募护卫', '护送{r}世家子弟回乡', '押运一批灵石去{r}'], luck: '额外的灵草、玄铁' },
};
function bountyRefresh() {
  const S = G.sect, maxR = Math.max(0, ...S.people.map((p) => p.realm));
  S.bounties = (S.bounties || []).filter((b) => b.taker && sectPerson(b.taker) && sectPerson(b.taker).away); // 进行中的保留
  const n = 2 + Math.floor(Math.min(4, sectTier()) / 2); // 每半年 2~4 件
  for (let i = 0; i < n; i++) {
    const type = pick(Object.keys(BOUNTY_TYPES)), T0 = BOUNTY_TYPES[type], rg = pick(Object.keys(REGIONS));
    const minRealm = Math.max(0, Math.min(4, maxR - randInt(0, 2)));
    const b = { id: Math.floor(Math.random() * 1e9), type, region: rg, minRealm, months: randInt(2, 6), taker: null };
    b.fee = Math.round(15 * Math.pow(REALM_MUL[minRealm], 0.7) * (0.8 + b.months * 0.1) * (type === 'zhan' ? 1.4 : type === 'hu' ? 0.8 : 1));
    b.fame = 1 + minRealm + (type === 'zhan' ? 2 : 0);
    b.foePower = Math.round(110 * REALM_MUL[minRealm] * rand(0.8, 1.3));
    if (type === 'zhan') { const [a, c] = S.sects.slice().sort(() => Math.random() - 0.5); b.ally = a.name; b.enemy = c.name; b.foeDao = c.dao; b.title = pick(T0.titles).replace(/\{a\}/g, a.name).replace('{b}', c.name); }
    else b.title = pick(T0.titles).replace('{r}', REGIONS[rg].name);
    S.bounties.push(b);
  }
  S.bountyNew = true;
}
function bountyTakers(b) { return G.sect.people.filter((p) => !p.away && !(p.hurt > 0) && p.realm >= b.minRealm && p.task !== 'travel' && !(G.sect.duel && (G.sect.duel.a === p.id || G.sect.duel.b === p.id))); }
function takeBounty(b, p) {
  if (b.taker || !bountyTakers(b).includes(p)) return;
  b.taker = p.id;
  assignTask(p, 'travel', { region: b.region, months: b.months });
  p.travel.bounty = JSON.parse(JSON.stringify(b));
  sectLog('【悬赏】' + p.name + ' 接下悬赏「' + b.title + '」，动身前往' + REGIONS[b.region].name + '（' + b.months + ' 个月）', '#ffcd75', p);
}
// 悬赏的最后一个月结算：和目标斗法，赢了领赏，还有对应的机缘
function resolveBounty(p) {
  const S = G.sect, b = p.travel.bounty, T0 = BOUNTY_TYPES[b.type], where = REGIONS[b.region].name;
  FOE_DAO['敌派修士'] = b.foeDao || 'geng';
  const win = fight(p, T0.foe, 1, where, b.foePower);
  S.bounties = (S.bounties || []).filter((x) => x.id !== b.id);
  if (!S.people.includes(p)) return false;
  if (!win) { sectLog('【悬赏】' + p.name + ' 未能完成悬赏「' + b.title + '」', '#ef7d57', p); if (b.type === 'zhan') { const e = S.sects.find((o) => o.name === b.enemy); if (e) e.att -= 10; } return true; }
  p.travel.loot.lingshi += b.fee; S.fame += b.fame;
  let luck = '';
  if (b.type === 'yao') {
    const ore = Math.round(randInt(5, 15) * (1 + b.minRealm * 0.5)), herb = Math.round(randInt(5, 15) * (1 + b.minRealm * 0.5)); p.travel.loot.ore += ore; p.travel.loot.herb += herb; luck = '剥下妖兽材料（玄铁 ' + ore + '、灵草 ' + herb + '）';
    if (p.prof === 'shou' && Math.random() < 0.5) { const el = pick(Object.keys(BEASTS)); if (!p.beast || Math.random() < 0.4) p.beast = { name: pick(BEASTS[el]), el, lv: (p.beast ? p.beast.lv : 0) + 1 }; else p.beast.lv++; luck += '，还收服了妖兽「' + p.beast.name + '」'; }
    else if (Math.random() < 0.4) { S.treasures.yaodan = (S.treasures.yaodan || 0) + 1; luck += '，取得一枚妖丹'; }
  } else if (b.type === 'gui') {
    const yins = DAO_IDS.filter((k) => DAOS[k].pol === 'yin'); const k = pick(yins); S.qi[k] = (S.qi[k] || 0) + 2; luck = '收得两缕' + DAOS[k].qiName;
    if (p.prof === 'gui' || (p.dao && DAOS[p.dao].pol === 'yin')) { progressBump(p, 15); luck += '，吸纳阴气，修为精进'; }
  } else if (b.type === 'mi') {
    const k = pick(Object.keys(TREASURES).filter((x) => x !== 'shouguo')); S.treasures[k] = (S.treasures[k] || 0) + 1; luck = '夺得「' + TREASURES[k].name + '」';
    if (Math.random() < 0.3) { const left = DAO_IDS.filter((x) => !S.manuals.includes(x)); if (left.length) { giveManual(pick(left), '【悬赏】' + p.name + ' 在秘境中寻得功法', p); } }
  } else if (b.type === 'zhan') {
    const a = S.sects.find((o) => o.name === b.ally), e = S.sects.find((o) => o.name === b.enemy);
    if (a) a.att = Math.min(100, a.att + 20); if (e) { e.att -= 30; e.power = Math.round(e.power * 0.9); }
    const nW = 1; { const d = b.foeDao || pick(DAO_IDS); S.weapons.push({ name: weaponName(d), power: Math.round(randInt(30, 80) * (1 + b.minRealm * 0.4)), dao: d }); }
    const g = Math.round(randInt(20, 50) * (1 + b.minRealm * 0.5)); p.travel.loot.lingshi += g; luck = '缴获法器 ' + nW + ' 件、灵石 ' + g + '（' + b.ally + '交情 +20，' + b.enemy + '交情 -30）';
    worldLog(b.ally + '与' + b.enemy + '一战，' + S.name + '弟子 ' + p.name + ' 助拳，' + b.ally + '大胜');
  } else if (b.type === 'hu') {
    const h = Math.round(randInt(10, 20) * (1 + b.minRealm * 0.5)), o = Math.round(randInt(5, 10) * (1 + b.minRealm * 0.5)); p.travel.loot.herb += h; p.travel.loot.ore += o; luck = '商队另赠灵草 ' + h + '、玄铁 ' + o;
  }
  sectLog('【悬赏】' + p.name + ' 完成悬赏「' + b.title + '」，赏金 ' + b.fee + ' 灵石，声望 +' + b.fame + '。机缘：' + luck, '#ffcd75', p);
  showBanner('悬赏完成', p.name + '：' + b.title, 3.5, '#ffcd75');
  return true;
}

// ---------- 界面：坊市 ----------
function sectViewMarket(c) {
  const S = G.sect, M = S.market, ctx = c.ctx;
  if (!marketLv()) { cLine(c, '宗门还没有坊市。点底部「建筑」修建一座坊市。', 13, '#ef7d57'); return; }
  cHead(c, '坊市 Lv' + marketLv() + '（卖价 ×' + marketK().toFixed(1) + '，买价 ×' + marketBuyK().toFixed(2) + '）');
  cLine(c, '天下修士带来的货物（约每半年换一批）：', 12, '#94b0c2');
  if (!M.stock.length) cLine(c, '货架空了，等下一批货吧。', 12, '#566c86');
  M.stock.forEach((it, i) => {
    const price = Math.round(it.price * marketBuyK()), ok = G.res.lingshi >= price, y = c.y;
    drawButton(ctx, c.x, y, c.w, 40, '', () => marketBuy(i), { dim: !ok, color: '#333c57' });
    drawText(ctx, marketItemName(it), c.x + 10, y + 13, 13, ok ? '#ffcd75' : '#94b0c2');
    drawText(ctx, '卖家：' + it.who, c.x + 10, y + 30, 11, '#94b0c2', 'left', false);
    drawText(ctx, price + ' 灵石', c.x + c.w - 10, y + 20, 13, ok ? '#73eff7' : '#ef7d57', 'right');
    c.y += 46;
  });
  cHead(c, '卖出本门产出');
  for (const k of ['herb', 'ore', 'wood']) {
    const unit = MARKET_SELL[k] * marketK();
    cButtons(c, [10, 50, 200].map((n) => ({ label: '卖' + RES_INFO[k].name + ' ' + n + '（+' + Math.round(n * unit) + '）', dim: G.res[k] < n, onClick: () => marketSellRes(k, n) })), 30);
  }
  cHead(c, '自动出售（每月把多余的卖掉）');
  cLine(c, '资源保留 ' + M.keep + ' 份不卖；丹药每种留 2 颗、符箓每种留 3 张、法器留最好的 2 件。', 12, '#94b0c2');
  cButtons(c, [['herb', '灵草'], ['ore', '玄铁'], ['wood', '灵木'], ['pill', '丹药'], ['talis', '符箓'], ['weapon', '法器']].map(([k, n]) => ({
    label: (M.auto[k] ? '✔ ' : '　') + n, active: M.auto[k], color: M.auto[k] ? '#1f5e3a' : '#333c57', onClick: () => { M.auto[k] = !M.auto[k]; },
  })));
  cButtons(c, [{ label: '资源保留底数：' + M.keep + '（点击切换）', onClick: () => { M.keep = { 50: 100, 100: 200, 200: 500, 500: 50 }[M.keep] || 100; } }]);
}
// ---------- 界面：悬赏榜（放在「天下」页最上面） ----------
function sectViewBounties(c) {
  const S = G.sect, ui = G.sui;
  S.bountyNew = false;
  cHead(c, '悬赏榜（每半年更新一批）');
  if (!S.bounties || !S.bounties.length) { cLine(c, '暂无悬赏。', 12, '#566c86'); return; }
  for (const b of S.bounties) {
    const T0 = BOUNTY_TYPES[b.type], taker = b.taker && sectPerson(b.taker);
    cLine(c, '【' + T0.name + '】' + b.title, 13, '#ffcd75', true);
    cLine(c, '要求：' + REALMS[b.minRealm] + '期以上　历时 ' + b.months + ' 个月　赏金 ' + b.fee + ' 灵石、声望 +' + b.fame + '　目标战力约 ' + b.foePower, 12, '#c8d6e5', false, 12);
    cLine(c, '机缘：' + T0.luck, 11, '#a7f070', false, 12);
    if (taker) { cLine(c, '已由 ' + taker.name + ' 接取，正在' + REGIONS[b.region].name + '执行', 12, '#73eff7', false, 12); continue; }
    if (ui.bounty === b.id) {
      const ps = bountyTakers(b);
      if (!ps.length) cLine(c, '门中暂无符合条件（境界够、没受伤、在山上）的弟子。', 12, '#ef7d57', false, 12);
      cButtons(c, ps.map((p) => ({ label: p.name + '（' + REALMS[p.realm] + '，战力 ' + personPower(p) + '）', color: personPower(p) > b.foePower ? '#1f5e3a' : '#5d275d', onClick: () => { takeBounty(b, p); ui.bounty = null; } })).concat([{ label: '取消', onClick: () => { ui.bounty = null; } }]));
    } else cButtons(c, [{ label: '接取悬赏 ▶ 选择弟子', color: '#29366f', onClick: () => { ui.bounty = b.id; } }]);
  }
}
