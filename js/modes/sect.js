// =============================================
//  模式 5：修仙门派
//  你是一派掌门。每年开山收徒，派弟子在各峰修炼、采气、炼丹、炼器、制符、演武、参悟、外出历练。
//  境界：凡人 → 筑基 → 炼气 → 金丹 → 化神 → 元婴（炼虚、合道暂未开放）
//    凡人：百日筑基（闭关攒满 100 天的修为）
//    筑基：按所修功法记载的方法采集「天地真气」，服下 3 缕后冲击炼气；第一缕真气决定此人的道途（31 条，见 js/sectdao.js）
//    炼气：把服下的真气逐步炼化、与肉身结合；炼化圆满后结成金丹（真气越多、道途越精纯、根骨越好，金丹品阶越高）
//    金丹：参悟、演武、顿悟来「体悟神妙」，悟性圆满时诞生神通（由道途 × 职业决定），再冲击化神
//    化神：以神通为元神、金丹为胚胎，孕育元婴；孕婴圆满后冲击元婴
//  道途越精纯，突破越容易、突破后提升越大；丹药、符箓、法器都带道途属性，同道途 / 同属性效果最好
//  时间：1 天 = 1 秒（×1 速度），1 月 = 30 天，1 年 = 12 月（百日筑基 ≈ 100 秒）
// =============================================
const SECT_DAY = 1;
const SECT_VER = 2; // 存档里的道途体系版本（旧存档读入时自动转换）
const REALMS = ['凡人', '筑基', '炼气', '金丹', '化神', '元婴', '炼虚', '合道'];
const REALM_CAP = 5; // 元婴以上暂未开放
const REALM_MUL = [1, 3, 6, 15, 40, 100];
const REALM_LIFE = [0, 30, 60, 200, 500, 1000];
const STIPEND = [1, 2, 3, 6, 12, 24];
const REALM_FAME = [0, 2, 5, 12, 25, 50];
const MONTH_CN = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const SEASON_CN = ['春', '夏', '秋', '冬'];
function dayCN(d) {
  const n = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (d <= 10) return '初' + n[d];
  if (d < 20) return '十' + n[d - 10];
  if (d === 20) return '二十';
  if (d < 30) return '廿' + n[d - 20];
  return '三十';
}
function sectCal(t) {
  const day = Math.floor(t === undefined ? G.sect.t : t);
  return { year: Math.floor(day / 360) + 1, month: Math.floor((day % 360) / 30) + 1, day: (day % 30) + 1 };
}
function sectSeason() { return Math.floor((sectCal().month - 1) / 3); }
function fmtDate(t) { const c = sectCal(t); return '第' + c.year + '年' + MONTH_CN[c.month - 1] + dayCN(c.day); }
function fullMoon() { const d = sectCal().day; return d >= 14 && d <= 16; }

// ---------- 丹药 / 法器 / 符箓（炼制时带上主炼弟子的道途） ----------
const PILLS = {
  zhuji: { name: '筑基丹', cost: { herb: 12 }, days: 20, desc: '凡人冲击筑基时服用，成功率 +25%（按契合度打折）' },
  peiyuan: { name: '培元丹', cost: { herb: 15 }, days: 25, desc: '60 天内修炼速度 +50%' },
  liaoshang: { name: '疗伤丹', cost: { herb: 8 }, days: 10, desc: '治好伤势（契合度越高越彻底）' },
  ningshen: { name: '凝神丹', cost: { herb: 25 }, days: 40, desc: '金丹期悟性 +15；其他境界当前修炼进度 +10' },
  pojing: { name: '破境丹', cost: { herb: 30, lingshi: 20 }, days: 45, desc: '下次突破（筑基以上）成功率 +15%' },
  yanshou: { name: '延寿丹', cost: { herb: 50, lingshi: 60 }, days: 90, desc: '寿元 +10 年（每人最多服用 2 颗）' },
};
const FORGE = {
  faqi: { name: '法器', cost: { ore: 15, lingshi: 10 }, days: 30, power: [20, 60], desc: '战力 +20~60' },
  lingqi: { name: '灵器', cost: { ore: 40, lingshi: 40 }, days: 60, power: [80, 160], desc: '战力 +80~160（炼器峰 3 级解锁）', lv: 3 },
};
const TALIS = {
  gong: { name: '攻伐符', cost: { herb: 6, lingshi: 8 }, days: 15, desc: '战斗时自动使用：战力 +40%' },
  hu: { name: '护身符', cost: { herb: 8, lingshi: 10 }, days: 20, desc: '战败时自动使用：免于受伤和陨落' },
  juling: { name: '聚灵符', cost: { herb: 10, lingshi: 15 }, days: 25, desc: '贴身佩戴：60 天内修炼速度 +30%' },
};
const WEAPON_NAMES = ['青锋剑', '赤炎扇', '玄铁印', '碧玉笛', '紫金葫芦', '寒霜刃', '流云袖', '镇山尺', '落星锤', '缚龙索', '照胆镜', '惊鸿伞'];
const WEAPON_NOUN = ['剑', '刃', '印', '扇', '铃', '镜', '珠', '旗', '葫芦', '尺', '环', '钟'];
function weaponName(dao) { return dao && DAOS[dao] ? pick(DAOS[dao].img) + pick(WEAPON_NOUN) : pick(WEAPON_NAMES); }
function itemKey(id, dao) { return id + '|' + (dao || ''); }
function splitKey(k) { const [id, dao] = k.split('|'); return { id, dao: dao || null }; }
function itemName(id, dao, book) { return (dao ? DAOS[dao].name + '·' : '') + book[id].name; }

// ---------- 差事 ----------
const TASKS = {
  cult: { name: '闭关修炼', desc: '推进当前境界的修炼进度' },
  gather: { name: '采集真气', desc: '按所修功法记载的方法采集真气（存入宗门）' },
  alchemy: { name: '炼丹', loc: 'liandan', desc: '在炼丹峰开炉炼丹（先在炼丹峰选丹方）。丹药带主炼弟子的道途' },
  forge: { name: '炼器', loc: 'lianqi', desc: '在炼器峰炼制法器（先在炼器峰选图谱）。法器带主炼弟子的道途' },
  fu: { name: '制符', loc: 'dianji', desc: '在典籍峰书写符箓（先在典籍峰选符方）。符箓带主笔弟子的道途' },
  train: { name: '演武', loc: 'yanwu', desc: '切磋比斗，积累实战经验（战力）' },
  study: { name: '参悟典籍', loc: 'dianji', desc: '积累悟性（金丹期诞生神通必需），偶尔神识精进' },
  labor: { name: '宗门杂务', loc: 'forest', desc: '采药、伐木、挖矿，为宗门产出资源' },
  travel: { name: '外出历练', loc: 'gate', desc: '下山去天下各处历练，有机缘也有凶险' },
};
const TASK_ORDER = ['cult', 'gather', 'alchemy', 'forge', 'fu', 'train', 'study', 'labor'];
const CRAFT = { alchemy: { peak: 'liandan', book: () => PILLS }, forge: { peak: 'lianqi', book: () => FORGE }, fu: { peak: 'dianji', book: () => TALIS } };
const PEAK_TASK = { liandan: 'alchemy', lianqi: 'forge', dianji: 'fu' };
function taskLoc(p) {
  if (p.hurt > 0) return p.head ? 'zongzhu' : 'zhufeng';
  if (p.task === 'cult') return p.head ? 'zongzhu' : 'zhufeng';
  if (p.task === 'gather') return p.manual ? DAOS[p.manual].loc : 'zhufeng';
  return TASKS[p.task].loc || 'zhufeng';
}
// ---------- 天下 ----------
const REGIONS = {
  center: { name: '中州', danger: 0.8, desc: '人烟鼎盛、坊市林立，较为安全，适合赚取灵石。' },
  east: { name: '东海', danger: 1.1, desc: '海外仙岛星罗棋布，多产灵草，常有海妖出没。' },
  south: { name: '南疆', danger: 1.35, desc: '瘴气密林，妖兽横行，灵草与毒物并生，常有灵兽出没。' },
  west: { name: '西漠', danger: 1.25, desc: '黄沙之下埋着上古修士洞府，偶有功法残卷出土。' },
  north: { name: '北原', danger: 1.5, desc: '冰原雪岭，妖兽凶悍，盛产玄铁。' },
};
const SECT_NAMES = ['青岚宗', '玄霄宗', '紫阳宗', '云渺宗', '太初宗', '归元宗'];
const OTHER_SECTS = ['凌霄阁', '赤霞谷', '落星宗', '玄冥教', '百草门', '苍梧剑派', '碧波岛', '金刚寺', '天机阁', '血煞宗'];
const SURNAMES = '李王张刘陈杨赵黄周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡丁魏薛叶余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆孔白崔康秦江顾孟龙段雷钱汤尹黎易常武乔贺文'.split('');
const SURNAMES2 = ['慕容', '上官', '欧阳', '司徒', '南宫', '令狐', '独孤', '东方'];
const GIVEN_M = '云风逸尘玄清远明岳霄辰凌寒墨青渊承卓衡啸言知守怀若然川羽晏离修昭恒'.split('');
const GIVEN_F = '婉清雪月灵瑶语嫣若霜薇芷烟岚秋璃音梦绮鸢素宁瑾萱'.split('');
function randName(sex) {
  const s = Math.random() < 0.08 ? pick(SURNAMES2) : pick(SURNAMES);
  const pool = sex === 'f' ? GIVEN_F : GIVEN_M;
  return s + pick(pool) + (Math.random() < 0.55 ? pick(pool) : '');
}
const HAIRS = ['#1a1c2c', '#1a1c2c', '#2b2e38', '#3a2a22', '#5a3e28'];
const SASHES = ['#1d2b53', '#3b5dc9', '#38b764', '#b13e53', '#5d275d', '#257179'];
const APT_TEXT = { jian: '天生剑骨', shu: '灵觉通透', fu: '笔意天成', dan: '天生药体', qi: '巧手匠心', shou: '万兽亲和', gui: '阴灵之体' };

// ---------- 人物 ----------
let sectPid = 1;
function rollAttr(mean) { return Math.max(1, Math.min(10, Math.round(mean + gauss() * 1.6))); }
function makePerson(o) {
  o = o || {};
  const sex = o.sex || (Math.random() < 0.45 ? 'f' : 'm');
  const mean = o.mean || 5;
  const p = {
    id: sectPid++, name: o.name || randName(sex), sex, age: o.age || randInt(10, 18),
    bone: rollAttr(mean), mind: rollAttr(mean), qi: rollAttr(mean), charm: rollAttr(mean),
    realm: o.realm || 0, task: 'cult', manual: null, dao: null, sht: null, prof: null, apt: pick(PROF_IDS), mix: {}, gain: 0, beast: null,
    zj: 0, base: 0, qiTaken: 0, refine: 0, dan: 0, wu: 0, ying: 0, qiAcc: 0, comeback: 0,
    weapon: null, exp: 0, hurt: 0, loy: 70, rel: {}, mate: null, log: [],
    lifeBonus: 0, yanshou: 0, buf: { peiyuan: 0, zhuji: 0, pojing: 0, juling: 0 },
    hair: pick(HAIRS), sash: pick(SASHES), head: false,
    x: 0, y: 0, route: [], loc: null, at: null, from: 'gate', moving: false, face: 1, wt: 0, away: 0, travel: null,
  };
  if (o.head) { p.head = true; p.bone = Math.max(p.bone, 6); p.mind = Math.max(p.mind, 6); p.charm = Math.max(p.charm, 5); }
  return p;
}
function lifeMax(p) { return Math.round((50 + p.bone * 3 + REALM_LIFE[p.realm]) * Math.max(0.5, 1 + sumFx(p, 'life')) + p.lifeBonus); }
function spellPower(p) { return Math.round(p.qi * 6 * REALM_MUL[p.realm] * (1 + sumFx(p, 'spell')) * (p.sht && p.prof === 'shu' ? 1.6 : 1)); }
function manaMax(p) { return Math.round(p.qi * 10 * REALM_MUL[p.realm] * (1 + sumFx(p, 'mana'))); }
function weaponPower(p) {
  const w = p.weapon;
  if (!w) return 0;
  return Math.round(w.power * itemFactor(p, w.dao) * (1 + sumFx(p, 'weapon')) * (p.sht && p.prof === 'qi' ? 1.5 : 1));
}
function shtPowerMul(p) { return !p.sht ? 1 : p.prof === 'jian' ? 1.5 : (p.prof === 'gui' || !p.prof) ? 1.3 : 1.15; }
function personPower(p) {
  const body = (p.bone * 8 + p.mind * 2) * REALM_MUL[p.realm] * (1 + sumFx(p, 'power')) * (1 + 0.08 * synergy(p));
  const dan = p.realm >= 3 ? 1 + (10 - p.dan) * 0.03 : 1;
  const raw = (body + spellPower(p)) * dan * shtPowerMul(p) * (1 + 0.15 * (p.gain || 0)) + weaponPower(p) + beastPower(p) + p.exp;
  return Math.round(raw * (p.hurt > 0 ? 0.6 : 1));
}
function peakLv(id) { return G.sect.peaks[id] ? G.sect.peaks[id].lv : 1; }
function cultSpeed(p) {
  let s = (0.55 + p.mind * 0.09) * (1 + sumFx(p, 'speed')) * G.mods.cult;
  const loc = taskLoc(p);
  if (loc === 'zhufeng') s *= 1 + 0.1 * peakLv('zhufeng');
  if (loc === 'zongzhu') s *= 1.5 * (1 + 0.1 * peakLv('zongzhu'));
  let arr = 0;
  for (const b of G.buildings) if (b.type === 'julingzhen' && Math.hypot(b.cx - p.x, b.cy - p.y) < 3.5 * T) arr = Math.max(arr, 0.25 * b.level);
  s *= 1 + arr;
  if (p.buf.peiyuan > 0) s *= 1 + 0.5 * (p.buf.peiyuanK || 1);
  if (p.buf.juling > 0) s *= 1 + 0.3 * (p.buf.julingK || 1);
  if (p.mate) { const m = sectPerson(p.mate); if (m && !m.away && m.task === p.task) s *= 1.1; }
  return s;
}
function breakChance(p) {
  let c = [0.55, 0.5, 0.42, 0.38, 0.2][p.realm] + p.mind * 0.035 + sumFx(p, 'brk') + G.mods.brk + synergy(p) * 0.03 + (p.comeback || 0);
  if (p.dao) c += (daoPurity(p) - 0.7) * 0.3;
  if (p.realm === 0 && p.buf.zhuji) c += 0.25 * p.buf.zhuji;
  if (p.realm >= 1 && p.buf.pojing) c += 0.15 * p.buf.pojing;
  if (p.realm === 1) c += p.base / 100 * 0.15;
  if (p.realm === 3) c += (9 - p.dan) * 0.02;
  if (p.head) c += 0.02 * peakLv('zongzhu');
  if (p.hurt > 0) c -= 0.2;
  return Math.max(0.05, Math.min(0.95, c));
}
function realmNeed(p) {
  const r = p.realm;
  if (r === 0) return { title: '百日筑基', text: '闭关修炼，攒满 100 天的修为后即可冲击筑基。服用「筑基丹」可提高成功率。', v: p.zj, max: 100, ready: p.zj >= 100 };
  if (r === 1) {
    const t = p.manual ? DAOS[p.dao || p.manual].qiName : '（尚未修习功法）';
    return { title: '服气定道 · 冲击炼气', text: '修习功法后按功法记载采集天地真气，服下 3 缕即可冲击炼气。第一缕必须是「' + t + '」，它决定此人的道途，之后不能更换功法。之后服下其他真气也算数，但会降低道途的精纯。闭关可稳固根基。', v: p.qiTaken, max: 3, ready: p.qiTaken >= 3, extra: '根基 ' + Math.floor(p.base) + '/100' };
  }
  if (r === 2) return { title: '炼化真气 · 结丹', text: '闭关把服下的真气一点点炼化、与肉身结合。根骨越好炼化越快；多服真气（最多 9 缕）能加快炼化；道途越精纯，结出的金丹品阶越高。炼化圆满即可冲击金丹。', v: p.refine, max: 100, ready: p.refine >= 100, extra: '已服真气 ' + p.qiTaken + '/9' };
  if (r === 3) return { title: '体悟神妙 · 诞生神通', text: '参悟典籍、演武、外出历练、顿悟都能积累悟性。悟性圆满时，金丹与道途相合、借职业之形，诞生神通，即可冲击化神。', v: p.wu, max: 100, ready: p.wu >= 100 && !!p.sht, extra: p.sht ? '神通：' + p.sht : '尚未诞生神通' };
  if (r === 4) return { title: '孕育元婴', text: '以神通「' + p.sht + '」为元神，以' + danName(p.dan) + '为胚胎，二者相合孕育元婴。金丹品阶越高，孕育越快。孕育圆满即可冲击元婴（失败会走火入魔，折损寿元）。', v: p.ying, max: 100, ready: p.ying >= 100 };
  return { title: '元婴老祖', text: '已达元婴之境。炼虚、合道之境尚未开放。', v: 1, max: 1, ready: false };
}
function danName(d) { return ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][d] + '品金丹'; }
function sectPerson(id) { return G.sect.people.find((q) => q.id === id); }
function headOf() { return G.sect.people.find((q) => q.head); }
function sectCapacity() { return 3 + 2 * (G.core ? G.core.level - 1 : 0) + 2 * countType('dongfu') + G.mods.cap; }
function discipleCount() { return G.sect.people.filter((q) => !q.head).length; }

// ---------- 纪事 ----------
function sectLog(text, color, p) {
  G.sect.log.unshift({ d: fmtDate(), text, color: color || '#c8d6e5' });
  if (G.sect.log.length > 300) G.sect.log.pop();
  if (p) { p.log.unshift(fmtDate() + '　' + text); if (p.log.length > 30) p.log.pop(); }
}
function worldLog(text) {
  G.sect.world.unshift({ d: fmtDate(), text });
  if (G.sect.world.length > 200) G.sect.world.pop();
}

// ---------- 移动 ----------
function tileCenter(pt) { return { x: (pt[0] + 0.5) * T, y: (pt[1] + 0.5) * T }; }
function pickSeat(loc) {
  const L = sectLoc(loc), [ax, ay] = L.anchor;
  for (let k = 0; k < 40; k++) {
    let x, y;
    if (L.rect) { x = randInt(L.rect[0] + 1, L.rect[0] + L.rect[2] - 2); y = randInt(L.rect[1] + 1, L.rect[1] + L.rect[3] - 1); if (Math.hypot(x - ax, y - ay) > 4.5) continue; }
    else { x = randInt(L.area[0], L.area[0] + L.area[2] - 1); y = randInt(L.area[1], L.area[1] + L.area[3] - 1); }
    if (!inMap(x, y) || solidTer(G.terrain[idx(x, y)]) || G.bld[idx(x, y)] || G.nodes[idx(x, y)]) continue;
    return { x: (x + rand(0.25, 0.75)) * T, y: (y + rand(0.4, 0.8)) * T };
  }
  return tileCenter(L.anchor);
}
function goTo(p, loc) {
  if (p.loc === loc && (p.route.length || p.at === loc)) return;
  const from = p.at || p.from || 'zhufeng';
  p.route = [];
  if (from !== loc) {
    const a = SECT_PATHS[from] || [SECT_HUB], b = SECT_PATHS[loc] || [SECT_HUB];
    for (let i = a.length - 1; i >= 0; i--) p.route.push(tileCenter(a[i]));
    for (let i = 1; i < b.length; i++) p.route.push(tileCenter(b[i]));
  }
  p.route.push(pickSeat(loc));
  p.loc = loc;
  p.at = null;
}
function movePerson(p, dt) {
  if (!p.route.length) { p.moving = false; return; }
  const tgt = p.route[0], dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy);
  const sp = 1.7 * T * (1 + p.realm * 0.18) * (p.hurt > 0 ? 0.6 : 1);
  p.moving = true;
  if (Math.abs(dx) > 0.5) p.face = dx > 0 ? 1 : -1;
  if (d <= sp * dt) {
    p.x = tgt.x; p.y = tgt.y; p.route.shift();
    if (!p.route.length) { p.moving = false; if (!p.at) { p.at = p.loc; p.from = p.loc; } }
  } else { p.x += dx / d * sp * dt; p.y += dy / d * sp * dt; }
}
function idleWander(p, dt) {
  if (p.route.length || p.at !== p.loc) return;
  const roam = p.task === 'labor' || p.task === 'train' || p.task === 'alchemy' || p.task === 'forge';
  p.pose = !roam && !p.moving ? 'sit' : 'stand';
  if (!roam) return;
  p.wt -= dt;
  if (p.wt <= 0) { p.wt = rand(2, 5); p.route.push(pickSeat(p.loc)); }
}
function assignTask(p, task, opt) {
  if (task === 'gather' && !p.manual) { showBanner('还不能采气', p.name + ' 尚未修习功法，不知道采气之法（在人物面板修习功法）', 3, '#ef7d57'); sfx('bad'); return; }
  if (task === 'travel') {
    p.travel = { region: opt.region, months: opt.months, left: opt.months, loot: { lingshi: 0, herb: 0, ore: 0 }, notes: [] };
    sectLog(p.name + ' 辞别师门，前往' + REGIONS[opt.region].name + '历练（' + opt.months + ' 个月）', '#ffcd75', p);
  }
  p.task = task;
  p.pose = 'stand';
  goTo(p, taskLoc(p));
}
function setProf(p, id) {
  if (p.realm >= 3 || p.prof === id) return;
  if (p.prof === 'shou' && p.beast) sectLog(p.name + ' 放归了灵兽「' + p.beast.name + '」', '#94b0c2', p);
  p.prof = id;
  p.beast = null;
  if (id === 'shou') {
    const el = daoGroup(p.dao || p.manual) || pick(Object.keys(BEASTS));
    p.beast = { name: pick(BEASTS[el]), el, lv: 0 };
    sectLog(p.name + ' 转修御兽之道，与「' + p.beast.name + '」缔结灵契', '#a7f070', p);
  } else sectLog(p.name + ' 立志成为' + PROFS[id].name + (p.apt === id ? '（正合天赋）' : ''), '#ffcd75', p);
}

// ---------- 每日 ----------
function sectDaily() {
  const S = G.sect;
  if (S.weatherLeft > 0) S.weatherLeft--;
  else {
    const s = sectSeason(), r = Math.random();
    if (s === 1 && r < 0.07) { S.weather = 'storm'; S.weatherLeft = randInt(1, 3); }
    else if (r < [0.08, 0.1, 0.05, 0.02][s]) { S.weather = 'rain'; S.weatherLeft = randInt(1, 4); }
    else if (s === 3 && r < 0.18) { S.weather = 'snow'; S.weatherLeft = randInt(2, 5); }
    else { S.weather = 'clear'; S.weatherLeft = 0; }
  }
  const acc = S.acc;
  for (const p of S.people) {
    if (p.away) continue;
    for (const k of ['peiyuan', 'juling']) if (p.buf[k] > 0) p.buf[k]--;
    if (sumFx(p, 'loyal')) p.loy = Math.max(p.loy, sumFx(p, 'loyal'));
    if (p.hurt > 0) {
      p.hurt = Math.max(0, p.hurt - 1 - sumFx(p, 'heal'));
      if (p.hurt === 0) sectLog(p.name + ' 伤势痊愈', '#a7f070', p);
      if (p.loc !== taskLoc(p)) goTo(p, taskLoc(p));
      continue;
    }
    if (p.loc !== taskLoc(p)) goTo(p, taskLoc(p));
    if (p.at !== taskLoc(p)) continue;
    const sp = cultSpeed(p);
    const wuK = 1 + sumFx(p, 'wu'), yingK = 1 + sumFx(p, 'ying');
    switch (p.task) {
      case 'cult':
        if (p.realm === 0) p.zj = Math.min(100, p.zj + sp);
        else if (p.realm === 1) p.base = Math.min(100, p.base + sp * 0.5);
        else if (p.realm === 2 && p.qiTaken > 0) p.refine = Math.min(100, p.refine + sp * 0.12 * (0.7 + p.bone * 0.06) * (1 + sumFx(p, 'refine')) * (1 + 0.08 * Math.max(0, p.qiTaken - 3)));
        else if (p.realm === 3) p.wu = Math.min(100, p.wu + sp * 0.02 * wuK);
        else if (p.realm === 4) p.ying = Math.min(100, p.ying + sp * 0.03 * yingK * (1.3 - p.dan * 0.06));
        break;
      case 'gather': {
        const d = DAOS[p.manual], r = d.rate();
        if (r <= 0) break;
        p.qiAcc += 0.012 * (0.6 + p.mind * 0.08) * r * (1 + p.realm * 0.25) * (1 + sumFx(p, 'gather'));
        if (p.manual === 'zhen' && S.weather === 'storm' && Math.random() < 0.02) { p.hurt = randInt(15, 30); sectLog(p.name + ' 引雷时被天雷击伤，需养伤 ' + p.hurt + ' 天', '#ef7d57', p); break; }
        while (p.qiAcc >= 1) {
          p.qiAcc -= 1; S.qi[p.manual] = (S.qi[p.manual] || 0) + 1;
          addFloat(p.x, p.y - 18, '+1 ' + d.qiName, d.color, true);
          sectLog(p.name + ' 采得一缕' + d.qiName, d.color, p);
        }
        break;
      }
      case 'alchemy': case 'forge': case 'fu': {
        const cr = CRAFT[p.task], job = S.jobs[cr.peak];
        const k = p.task === 'alchemy' ? (1 + sumFx(p, 'alch')) * G.mods.alch : p.task === 'fu' ? 1 + sumFx(p, 'fuSpeed') : 1;
        if (job) job.work += (0.6 + p.mind * 0.1 + p.qi * 0.05) * (1 + 0.1 * peakLv(cr.peak)) * k;
        else p.exp += 0.05;
        break;
      }
      case 'train':
        p.exp += (0.4 + p.bone * 0.06) * (1 + 0.1 * peakLv('yanwu')) * REALM_MUL[p.realm] * 0.5 * (1 + sumFx(p, 'train'));
        if (p.realm === 3) p.wu = Math.min(100, p.wu + 0.015 * wuK);
        break;
      case 'study':
        if (p.realm === 3) p.wu = Math.min(100, p.wu + (0.06 + p.mind * 0.008) * (1 + 0.1 * peakLv('dianji')) * wuK);
        else if (p.realm === 4) p.ying = Math.min(100, p.ying + sp * 0.012 * yingK);
        else if (p.realm === 0) p.zj = Math.min(100, p.zj + sp * 0.3);
        if (p.mind < 10 && Math.random() < 0.0015 * peakLv('dianji') * (1 + sumFx(p, 'mindGrow'))) { p.mind++; sectLog(p.name + ' 参悟典籍有得，神识精进（神识 ' + p.mind + '）', '#73eff7', p); }
        break;
      case 'labor': {
        const k = (0.7 + p.bone * 0.06) * (1 + p.realm * 0.3) * (1 + sumFx(p, 'labor'));
        acc.herb += 0.25 * k; acc.wood += 0.3 * k; acc.ore += 0.1 * k; acc.lingshi += 0.06 * k;
        break;
      }
    }
    if (p.realm === 3 && p.wu >= 100 && !p.sht) {
      p.sht = makeShentong(p);
      sectLog(p.name + ' 体悟神妙，金丹与' + DAOS[p.dao].name + '道途相合，诞生神通「' + p.sht + '」（' + ST_EFFECT[p.prof || 'none'] + '）！可以冲击化神了', '#ffcd75', p);
      showBanner('神通诞生：' + p.sht, p.name + ' 体悟神妙，可以冲击化神了', 4, '#ffcd75');
      sfx('win');
    }
    if (p.realm < REALM_CAP && realmNeed(p).ready && !p.readyNoted) { p.readyNoted = true; sectLog(p.name + ' 修为圆满，可以冲击' + REALMS[p.realm + 1] + '了（在弟子面板操作）', '#a7f070', p); }
  }
  for (const k of ['herb', 'wood', 'ore', 'lingshi']) { const n = Math.floor(acc[k]); if (n > 0) { G.res[k] += n; acc[k] -= n; } }
  for (const task in CRAFT) finishCraft(task);
}
// 主炼弟子：本行职业优先，其次神识高的
function leadCrafter(task) {
  const cs = G.sect.people.filter((q) => !q.away && q.task === task && q.at === CRAFT[task].peak);
  const prof = { alchemy: 'dan', forge: 'qi', fu: 'fu' }[task];
  cs.sort((a, b) => (b.prof === prof) - (a.prof === prof) || b.mind - a.mind);
  return cs[0] || null;
}
function finishCraft(task) {
  const S = G.sect, cr = CRAFT[task], job = S.jobs[cr.peak];
  if (!job || job.work < job.days) return;
  S.jobs[cr.peak] = null;
  const lead = leadCrafter(task), mind = lead ? lead.mind : 4, dao = job.dao;
  if (task === 'alchemy') {
    const ok = Math.random() < Math.min(0.95, 0.5 + mind * 0.04 + peakLv('liandan') * 0.05 + G.mods.alchOk + (lead ? sumFx(lead, 'alchOk') + (lead.sht && lead.prof === 'dan' ? 0.1 : 0) : 0));
    const name = itemName(job.id, dao, PILLS);
    if (ok) {
      const n = 1 + (Math.random() < 0.3 + peakLv('liandan') * 0.08 ? 1 : 0) + (Math.random() < 0.1 ? 1 : 0);
      S.items[itemKey(job.id, dao)] = (S.items[itemKey(job.id, dao)] || 0) + n;
      sectLog('炼丹峰开炉成功，炼成「' + name + '」×' + n, '#a7f070');
      showBanner('丹成！', name + ' ×' + n, 3, '#a7f070');
    } else { sectLog('炼丹峰丹炉炸炉，「' + name + '」炼制失败，灵草化为灰烬', '#ef7d57'); showBanner('炸炉了……', name + ' 炼制失败', 3, '#ef7d57'); }
  } else if (task === 'forge') {
    const f = FORGE[job.id], power = Math.round(rand(f.power[0], f.power[1]) * G.mods.forge * (1 + 0.05 * peakLv('lianqi')) * (1 + (lead ? sumFx(lead, 'forge') : 0)));
    const w = { name: weaponName(dao), power, dao };
    S.weapons.push(w);
    sectLog('炼器峰炼成' + (dao ? DAOS[dao].name + '属' : '') + f.name + '「' + w.name + '」（战力 +' + power + '）', '#a7f070');
    showBanner('器成！', f.name + '「' + w.name + '」 战力 +' + power, 3, '#a7f070');
  } else {
    const n = randInt(2, 4), name = itemName(job.id, dao, TALIS);
    S.talis[itemKey(job.id, dao)] = (S.talis[itemKey(job.id, dao)] || 0) + n;
    sectLog('典籍峰书成「' + name + '」×' + n, '#a7f070');
    showBanner('符成！', name + ' ×' + n, 3, '#a7f070');
  }
  sfx('win');
}

// ---------- 突破 ----------
function attemptBreak(p) {
  const need = realmNeed(p);
  if (!need.ready || p.realm >= REALM_CAP) return;
  const c = breakChance(p), to = REALMS[p.realm + 1];
  p.readyNoted = false;
  const usedPill = (p.realm === 0 && p.buf.zhuji) || (p.realm >= 1 && p.buf.pojing);
  if (p.realm === 0) p.buf.zhuji = 0; else p.buf.pojing = 0;
  if (Math.random() < c) {
    p.realm++;
    p.comeback = 0;
    const r = p.realm, pur = daoPurity(p);
    let msg = p.name + ' 突破成功，晋入' + to + '期！';
    if (r === 1) msg = p.name + ' 百日筑基功成，踏入仙途，晋入筑基期！';
    if (r === 2) msg = p.name + ' 服下的' + DAOS[p.dao].qiName + '在体内流转，晋入炼气期！（道途：' + daoLabel(p.dao) + '）';
    if (r === 3) {
      p.dan = Math.max(1, Math.min(9, 9 - Math.floor((p.qiTaken - 3) * 0.6 + (p.bone - 5) * 0.4 + pur * 3 + rand(0, 2))));
      msg = p.name + ' 精气与' + DAOS[p.dao].name + '真气相合，结成' + danName(p.dan) + '，晋入金丹期！';
    }
    if (r === 4) msg = p.name + ' 以神通「' + p.sht + '」化作元神，晋入化神期！';
    if (r === 5) msg = p.name + ' 元神与金丹相合，孕出元婴，晋入元婴期！成为一代老祖！';
    // 道途越精纯，突破后提升越大
    let extra = '';
    if (p.dao) {
      p.gain = (p.gain || 0) + pur;
      extra = '道途精纯 ' + Math.round(pur * 100) + '%，战力根基 +' + Math.round(pur * 15) + '%';
      if (Math.random() < pur * 0.8) { const k = pick(['bone', 'mind', 'qi']); if (p[k] < 10) { p[k]++; extra += '，' + { bone: '根骨', mind: '神识', qi: '灵气' }[k] + ' +1'; } }
    }
    if (p.beast) { p.beast.lv++; extra += (extra ? '，' : '') + '灵兽「' + p.beast.name + '」随之成长'; }
    G.sect.fame += REALM_FAME[r];
    sectLog(msg + (extra ? '（' + extra + '）' : ''), '#ffcd75', p);
    showBanner('突破成功！' + to + '期', msg + (extra ? '\n' + extra : '') + '（声望 +' + REALM_FAME[r] + '）', 5, '#ffcd75');
    sfx('win');
    addParticles(p.x, p.y - 8, '#ffcd75', 30);
    if (r === 5 && !G.sect.won) {
      G.sect.won = true;
      victory('元婴老祖出世！', G.sect.name + ' 立宗 ' + sectCal().year + ' 年，' + p.name + ' 修成元婴，宗门从此名震天下。\n（炼虚、合道之境尚未开放，可以继续经营宗门）');
    }
  } else {
    const safe = Math.min(0.9, sumFx(p, 'failSafe'));
    const lose = (v) => Math.round(v * (1 - safe));
    let msg;
    if (p.realm === 0) { p.zj = 100 - lose(40); p.hurt = lose(15); msg = '冲击筑基失败，经脉受损（修为退回 ' + Math.round(p.zj) + ' 天）'; }
    else if (p.realm === 1) { if (safe < 0.5) p.qiTaken = 2; p.hurt = lose(20); msg = '冲击炼气失败' + (safe < 0.5 ? '，一缕真气散逸' : '，真气稳住了'); }
    else if (p.realm === 2) { p.refine = 100 - lose(30); p.hurt = lose(30); msg = '结丹失败，金丹溃散（炼化退回 ' + Math.round(p.refine) + '%）'; }
    else if (p.realm === 3) { p.wu = 100 - lose(40); p.hurt = lose(30); msg = '冲击化神失败，元神不稳（悟性退回 ' + Math.round(p.wu) + '）'; }
    else {
      p.ying = 100 - lose(50); p.hurt = lose(90); p.lifeBonus -= lose(20);
      msg = '冲击元婴失败，走火入魔！（孕婴退回 ' + Math.round(p.ying) + '%，折寿 ' + lose(20) + ' 年）';
      if (Math.random() < 0.03 * (1 - safe)) { sectLog(p.name + ' 冲击元婴时心魔反噬，身死道消……', '#b13e53', p); showBanner('身死道消', p.name + ' 冲击元婴失败，陨落了', 5, '#b13e53'); personFalls(p); return; }
    }
    if (p.hurt > 0) msg += '，养伤 ' + p.hurt + ' 天';
    p.comeback = sumFx(p, 'comeback');
    if (p.comeback) msg += '。阴尽阳生，下次突破成功率 +' + Math.round(p.comeback * 100) + '%';
    sectLog(p.name + ' ' + msg, '#ef7d57', p);
    showBanner('突破失败', p.name + ' ' + msg + (usedPill ? '（丹药药力已散）' : ''), 4, '#ef7d57');
    sfx('bad');
    goTo(p, taskLoc(p));
  }
}
// 服用真气：筑基期第一缕必须是功法对应的真气（定道），之后什么真气都算，但会影响精纯
function canTakeQi(p, id) {
  if (p.realm < 1 || p.realm > 2 || !(G.sect.qi[id] > 0)) return false;
  if (p.qiTaken >= (p.realm === 1 ? 3 : 9)) return false;
  if (!p.dao) return id === p.manual;
  return true;
}
function takeQi(p, id) {
  id = id || p.dao || p.manual;
  if (!canTakeQi(p, id)) return;
  const d = DAOS[id];
  G.sect.qi[id]--;
  p.qiTaken++;
  touchDao(p, id, 1);
  if (!p.dao) { p.dao = id; sectLog(p.name + ' 服下第一缕' + d.qiName + '，道途已定：' + daoLabel(id), d.color, p); }
  else sectLog(p.name + ' 服下一缕' + d.qiName + '（' + p.qiTaken + '/' + (p.realm === 1 ? 3 : 9) + '，道途精纯 ' + Math.round(daoPurity(p) * 100) + '%）', d.color, p);
  addParticles(p.x, p.y - 8, d.color, 16);
  sfx('coin');
}
// 服用丹药：效果 × 契合度
function usePill(p, key) {
  const S = G.sect, { id, dao } = splitKey(key);
  if (!(S.items[key] > 0)) return;
  if (id === 'yanshou' && p.yanshou >= 2) { showBanner('无效', p.name + ' 已经服过 2 颗延寿丹，再服也没用了', 2.5, '#ef7d57'); return; }
  if (id === 'liaoshang' && !(p.hurt > 0)) { showBanner('不用吃', p.name + ' 没有受伤', 2, '#94b0c2'); return; }
  const f = itemFactor(p, dao) * (1 + sumFx(p, 'pill')) * (p.sht && p.prof === 'dan' ? 1.5 : 1);
  S.items[key]--;
  if (id === 'zhuji') p.buf.zhuji = f;
  if (id === 'pojing') p.buf.pojing = f;
  if (id === 'peiyuan') { p.buf.peiyuan = 60; p.buf.peiyuanK = f; }
  if (id === 'liaoshang') p.hurt = Math.max(0, Math.round(p.hurt * (1 - Math.min(1, f))));
  if (id === 'yanshou') { p.yanshou++; p.lifeBonus += Math.round(10 * f); }
  if (id === 'ningshen') {
    const v = 10 * f;
    if (p.realm === 0) p.zj = Math.min(100, p.zj + v);
    else if (p.realm === 1) p.base = Math.min(100, p.base + v);
    else if (p.realm === 2) p.refine = Math.min(100, p.refine + v);
    else if (p.realm === 3) p.wu = Math.min(100, p.wu + v * 1.5);
    else if (p.realm === 4) p.ying = Math.min(100, p.ying + v);
  }
  if (dao) touchDao(p, dao, 0.3);
  sectLog(p.name + ' 服下' + itemName(id, dao, PILLS) + '（契合 ' + Math.round(f * 100) + '%）', '#a7f070', p);
  addParticles(p.x, p.y - 8, '#a7f070', 14);
  sfx('coin');
}
function useJuling(p, key) {
  const S = G.sect, { dao } = splitKey(key);
  if (!(S.talis[key] > 0)) return;
  S.talis[key]--;
  const f = talisK(p, dao);
  p.buf.juling = 60; p.buf.julingK = f;
  if (dao) touchDao(p, dao, 0.2);
  sectLog(p.name + ' 贴上' + itemName('juling', dao, TALIS) + '（效果 ×' + f.toFixed(2) + '）', '#a7f070', p);
  sfx('coin');
}
function talisK(p, dao) { return itemFactor(p, dao) * (1 + sumFx(p, 'fu')) * (p.sht && p.prof === 'fu' ? 2 : 1); }
// 战斗时自动挑一张最契合的符
function bestTalis(p, id) {
  const S = G.sect;
  let best = null, bk = 0;
  for (const k in S.talis) { if (!(S.talis[k] > 0)) continue; const s = splitKey(k); if (s.id !== id) continue; const f = talisK(p, s.dao); if (f > bk) { bk = f; best = k; } }
  return best ? { key: best, k: bk } : null;
}
function learnManual(p, id) {
  if (p.dao) return;
  p.manual = id;
  sectLog(p.name + ' 开始修习' + DAOS[id].gf.name, '#73eff7', p);
  if (p.task === 'gather') goTo(p, taskLoc(p));
}
function equipWeapon(p, i) {
  const S = G.sect, w = S.weapons[i];
  if (!w) return;
  S.weapons.splice(i, 1);
  if (p.weapon) S.weapons.push(p.weapon);
  p.weapon = w;
  if (w.dao) touchDao(p, w.dao, 0.5);
  sectLog(p.name + ' 祭炼了「' + w.name + '」（契合 ' + Math.round(itemFactor(p, w.dao) * 100) + '%）', '#c8d6e5', p);
}
function startJob(peak, id) {
  const S = G.sect, task = PEAK_TASK[peak], book = CRAFT[task].book(), rec = book[id];
  if (S.jobs[peak] || !canAfford(rec.cost)) return;
  pay(rec.cost);
  const lead = leadCrafter(task);
  const dao = lead ? lead.dao : null;
  S.jobs[peak] = { id, work: 0, days: rec.days, dao };
  sectLog({ liandan: '炼丹峰开炉炼制「', lianqi: '炼器峰开始炼制「', dianji: '典籍峰开始书写「' }[peak] + itemName(id, dao, book) + '」' + (lead ? '（主' + (task === 'fu' ? '笔' : '炼') + '：' + lead.name + '）' : ''), '#ffcd75');
  sfx('build');
}
function upgradePeak(id) {
  const pk = G.sect.peaks[id], cost = peakUpCost(id);
  if (pk.lv >= 5 || !canAfford(cost)) return;
  pay(cost);
  pk.lv++;
  sectLog(PEAKS[id].name + ' 扩建至 ' + pk.lv + ' 级', '#ffcd75');
  showBanner(PEAKS[id].name + ' 扩建完成', '等级 ' + pk.lv, 2.5, '#ffcd75');
  sfx('build');
}
function peakUpCost(id) { const lv = G.sect.peaks[id].lv; return { lingshi: Math.round(40 * Math.pow(lv, 1.6)), wood: 30 * lv, ore: 10 * lv }; }

// ---------- 招收弟子 ----------
function makeCandidates() {
  const fame = G.sect.fame, n = 3 + G.mods.recruit;
  G.sect.cands = [];
  for (let i = 0; i < n; i++) {
    const p = makePerson({ mean: 4.2 + Math.min(3, fame / 60) + G.mods.recruit * 0.3 });
    p.cost = Math.max(5, 10 + (p.bone + p.mind + p.qi + p.charm - 20) * 2);
    G.sect.cands.push(p);
  }
  G.sect.candUntil = G.sect.t + 90;
}
function recruit(c) {
  if (discipleCount() >= sectCapacity()) { showBanner('门下已满', '扩建宗门香鼎或修建洞府可以收更多弟子', 3, '#ef7d57'); sfx('bad'); return; }
  if (G.res.lingshi < c.cost) { showBanner('灵石不足', '收入门下需要 ' + c.cost + ' 灵石（拜师礼、道袍、洞府）', 2.5, '#ef7d57'); sfx('bad'); return; }
  G.res.lingshi -= c.cost;
  G.sect.cands = G.sect.cands.filter((q) => q !== c);
  addPerson(c, 'gate');
  sectLog(c.name + ' 拜入山门，成为' + G.sect.name + '弟子（' + APT_TEXT[c.apt] + '，宜' + PROFS[c.apt].name + '）', '#a7f070', c);
  sfx('coin');
}
function addPerson(p, at) {
  const a = tileCenter(sectLoc(at).anchor);
  p.x = a.x; p.y = a.y; p.at = at; p.from = at; p.loc = null;
  G.sect.people.push(p);
  goTo(p, taskLoc(p));
}
// 陨落：鬼修有机会残魂不灭（返回 true = 真的死了）
function personFalls(p, reason) {
  if (p.prof === 'gui' && (p.sht || Math.random() < 0.5)) {
    p.hurt = 180; p.exp = Math.round(p.exp * 0.5);
    if (p.realm === 4) p.ying = Math.max(0, p.ying - 30); else if (p.realm === 3) p.wu = Math.max(0, p.wu - 30); else if (p.realm === 2) p.refine = Math.max(0, p.refine - 30);
    sectLog('【鬼修】' + p.name + ' 肉身将毁之际，残魂不灭，遁回山门温养（养伤 180 天）', '#b8a8ff', p);
    showBanner('残魂不灭', p.name + ' 以鬼道秘法保住一缕残魂', 4, '#b8a8ff');
    if (p.away) travelReturn(p);
    return false;
  }
  personDies(p, reason);
  return true;
}
function personDies(p, reason) {
  const S = G.sect;
  S.people = S.people.filter((q) => q !== p);
  for (const q of S.people) { delete q.rel[p.id]; if (q.mate === p.id) q.mate = null; }
  if (p.weapon) S.weapons.push(p.weapon);
  if (reason) sectLog(reason, '#b13e53');
  if (p.head) {
    const heir = S.people.filter((q) => !q.away).sort((a, b) => b.realm - a.realm || personPower(b) - personPower(a))[0] || S.people[0];
    if (!heir) {
      gameOver('宗门传承断绝');
      G.endText = G.sect.name + ' 立宗 ' + sectCal().year + ' 年，掌门 ' + p.name + ' 仙逝，门下再无弟子……\n声望 ' + Math.floor(S.fame);
      return;
    }
    heir.head = true;
    heir.loy = 100;
    sectLog(heir.name + ' 继任' + S.name + '掌门', '#ffcd75', heir);
    showBanner('新任掌门', heir.name + ' 继任掌门之位', 4, '#ffcd75');
    goTo(heir, taskLoc(heir));
  }
}

// ---------- 人际：道途也影响缘分 ----------
function daoAffinity(a, b) {
  if (!a.dao || !b.dao) return { v: 0, text: '' };
  const A = DAOS[a.dao], B = DAOS[b.dao];
  if (HE[A.name[0]] === B.name[0]) return { v: 0.2, text: A.name[0] + B.name[0] + '相合' };
  if (a.dao === b.dao || daoGroup(a.dao) === daoGroup(b.dao)) return { v: 0.1, text: '同道相契' };
  const wa = daoWx(a.dao), wb = daoWx(b.dao);
  if (SHENG[wa] === wb) return { v: 0.08, text: EL[wa].name + '生' + EL[wb].name };
  if (SHENG[wb] === wa) return { v: 0.08, text: EL[wb].name + '生' + EL[wa].name };
  if (KE[wa] === wb) return { v: -0.15, text: EL[wa].name + '克' + EL[wb].name };
  if (KE[wb] === wa) return { v: -0.15, text: EL[wb].name + '克' + EL[wa].name };
  return { v: 0, text: '' };
}

// ---------- 机缘事件（每月每人） ----------
function personEvent(p) {
  const S = G.sect, others = S.people.filter((q) => q !== p && !q.away);
  const w = [['dun', 2 + p.mind * 0.3], ['qi', 1 + p.charm * 0.3], ['meet', 1.2], ['loss', 1.1], ['rel', others.length ? p.charm * 0.35 : 0]];
  let r = Math.random() * w.reduce((s, x) => s + x[1], 0), type = 'dun';
  for (const [k, v] of w) { r -= v; if (r <= 0) { type = k; break; } }
  const N = p.name;
  if (type === 'dun') {
    const lines = ['观云海翻涌，忽有所悟', '听松涛阵阵，心境澄明', '梦中见一白发老者传道', '于月下练剑，剑意自生', '看落叶飘零，悟得枯荣之理'];
    let gain = '';
    if (p.realm === 0) { p.zj = Math.min(100, p.zj + 15); gain = '修为 +15 天'; }
    else if (p.realm === 1) { p.base = Math.min(100, p.base + 20); gain = '根基 +20'; }
    else if (p.realm === 2) { p.refine = Math.min(100, p.refine + 12); gain = '炼化 +12%'; }
    else if (p.realm === 3) { p.wu = Math.min(100, p.wu + 25); gain = '悟性 +25'; }
    else if (p.realm === 4) { p.ying = Math.min(100, p.ying + 8); gain = '孕婴 +8%'; }
    else { p.exp += 200; gain = '战力 +200'; }
    sectLog('【顿悟】' + N + ' ' + pick(lines) + '（' + gain + '）', '#73eff7', p);
  } else if (type === 'qi') {
    const roll = Math.random();
    if (roll < 0.28) { const n = randInt(10, 30); G.res.herb += n; sectLog('【奇遇】' + N + ' 在后山发现一片野生灵草（灵草 +' + n + '）', '#a7f070', p); }
    else if (roll < 0.5) { const n = randInt(20, 60); G.res.lingshi += n; sectLog('【奇遇】' + N + ' 在溪涧中拾到一枚古修储物袋（灵石 +' + n + '）', '#a7f070', p); }
    else if (roll < 0.76) { const k = pick(DAO_IDS); S.qi[k] = (S.qi[k] || 0) + 1; sectLog('【奇遇】' + N + ' 偶遇天地异象，收得一缕' + DAOS[k].qiName, DAOS[k].color, p); }
    else if (roll < 0.88) { const dao = Math.random() < 0.6 ? pick(DAO_IDS) : null, pw = randInt(30, 80); S.weapons.push({ name: weaponName(dao), power: pw, dao }); sectLog('【奇遇】' + N + ' 从山洞中寻得一件前人遗留的' + (dao ? DAOS[dao].name + '属' : '') + '法器（战力 +' + pw + '）', '#a7f070', p); }
    else if (roll < 0.94 && p.prof === 'shou') {
      if (!p.beast || p.beast.lv < 2) { const el = pick(Object.keys(BEASTS)); p.beast = { name: pick(BEASTS[el]), el, lv: (p.beast ? p.beast.lv : 0) + 1 }; sectLog('【奇遇】' + N + ' 在山中收服了一只「' + p.beast.name + '」作为灵宠', '#a7f070', p); }
      else { p.beast.lv++; sectLog('【奇遇】' + N + ' 的灵兽「' + p.beast.name + '」吞服灵果，又成长了', '#a7f070', p); }
    }
    else { giveManual(pick(DAO_IDS), '【奇遇】' + N + ' 在古洞石壁上发现功法刻文', p); }
  } else if (type === 'meet') {
    fight(p, pick(['山中妖狼', '游荡散修', '邪修', '夺宝贼人', '黑熊精']), 1, '山门外');
  } else if (type === 'loss') {
    const roll = Math.random();
    if (roll < 0.35 && G.res.lingshi > 10) { const n = Math.min(Math.floor(G.res.lingshi * 0.15), randInt(8, 30)); G.res.lingshi -= n; sectLog('【损失】' + N + ' 下山采买时被骗（灵石 -' + n + '）', '#ef7d57', p); }
    else if (roll < 0.6) {
      let lost = '';
      if (p.realm === 0) { p.zj = Math.max(0, p.zj - 10); lost = '修为 -10 天'; }
      else if (p.realm === 2) { p.refine = Math.max(0, p.refine - 8); lost = '炼化 -8%'; }
      else if (p.realm === 3) { p.wu = Math.max(0, p.wu - 10); lost = '悟性 -10'; }
      else if (p.realm === 4) { p.ying = Math.max(0, p.ying - 5); lost = '孕婴 -5%'; }
      else { p.base = Math.max(0, p.base - 10); lost = '根基 -10'; }
      sectLog('【心魔】' + N + ' 修炼时心魔作祟（' + lost + '）', '#ef7d57', p);
    } else if (roll < 0.8) { p.hurt = Math.max(p.hurt, randInt(10, 25)); sectLog('【意外】' + N + ' 练功时岔了气，需养伤 ' + p.hurt + ' 天', '#ef7d57', p); }
    else { const n = Math.min(Math.floor(G.res.herb * 0.3), randInt(5, 15)); G.res.herb -= n; sectLog('【损失】药圃遭了虫害（灵草 -' + n + '）', '#ef7d57', p); }
  } else if (type === 'rel') {
    const q = pick(others), cur = p.rel[q.id] || 0, aff = daoAffinity(p, q);
    const good = Math.random() < 0.35 + (p.charm + q.charm) * 0.035 + sumFx(p, 'charm') + aff.v;
    const d = good ? randInt(15, 30) : -randInt(15, 30), nv = Math.max(-100, Math.min(100, cur + d));
    p.rel[q.id] = nv; q.rel[p.id] = nv;
    const why = aff.text ? '（' + aff.text + '）' : '';
    if (good) {
      if (nv >= 80 && p.sex !== q.sex && !p.mate && !q.mate && p.charm + q.charm >= 11) {
        p.mate = q.id; q.mate = p.id;
        sectLog('【姻缘】' + N + ' 与 ' + q.name + ' 情投意合，结为道侣' + why + '（同修时速度 +10%）', '#f7a8c8', p);
        q.log.unshift(fmtDate() + '　与 ' + N + ' 结为道侣');
      } else sectLog('【人际】' + N + ' 与 ' + q.name + ' 论道切磋，' + (nv >= 50 ? '引为知己' : '交情渐深') + why, '#f7a8c8', p);
      p.loy = Math.min(100, p.loy + 3); q.loy = Math.min(100, q.loy + 3);
    } else {
      sectLog('【人际】' + N + ' 与 ' + q.name + ' 因琐事起了争执' + why + (nv <= -40 ? '，从此势同水火' : ''), '#ef7d57', p);
      p.loy = Math.max(0, p.loy - 4); q.loy = Math.max(0, q.loy - 4);
    }
  }
}
function giveManual(id, why, p) {
  const S = G.sect, d = DAOS[id];
  if (S.manuals.includes(id)) {
    const n = randInt(20, 50); G.res.lingshi += n;
    sectLog(why + '，可惜是本门已有的' + d.gf.name + '，转手卖了（灵石 +' + n + '）', '#a7f070', p);
    return;
  }
  S.manuals.push(id);
  sectLog(why + '，得到' + d.gf.name + '！（' + daoLabel(id) + '道途，记载「' + d.qiName + '」的采集之法）', '#ffcd75', p);
  showBanner('获得功法', d.gf.name + '　' + daoLabel(id), 4, '#ffcd75');
  sfx('win');
}
// 战斗：战力比较 × 道途克制 × 符箓
function fight(p, foe, danger, where) {
  const year = sectCal().year, foeDao = FOE_DAO[foe] || null;
  const ep = Math.round((80 + year * 25 + Math.pow(year, 1.6) * 6) * danger * rand(0.5, 1.5) * (where === '山门外' ? 0.7 : 1));
  let pp = personPower(p);
  const clash = daoClash(p.dao, foeDao);
  pp *= clash.k;
  if (foeDao && DAOS[foeDao].pol === 'yin') pp *= 1 + sumFx(p, 'antiYin');
  if (ep > pp) pp *= 1 + sumFx(p, 'underdog');
  const notes = [];
  if (clash.text) notes.push(clash.text);
  const gong = bestTalis(p, 'gong');
  if (gong) { G.sect.talis[gong.key]--; pp *= 1 + 0.4 * gong.k; notes.push('祭出' + itemName('gong', splitKey(gong.key).dao, TALIS)); }
  const foeName = foe + (foeDao ? '（' + DAOS[foeDao].name + '属）' : '');
  const tail = notes.length ? '〔' + notes.join('；') + '〕' : '';
  const win = Math.random() < pp / (pp + ep);
  if (win) {
    const loot = Math.round(ep * rand(0.1, 0.25));
    p.exp += Math.round(ep * 0.05 * (1 + sumFx(p, 'train')));
    if (p.travel) p.travel.loot.lingshi += loot; else G.res.lingshi += loot;
    if (p.realm === 3) p.wu = Math.min(100, p.wu + 5);
    sectLog('【遭遇】' + p.name + ' 在' + where + '遇上' + foeName + '（战力约 ' + ep + '），一番斗法将其击退（灵石 +' + loot + '）' + tail, '#ffcd75', p);
    return true;
  }
  const hu = bestTalis(p, 'hu');
  if (hu && Math.random() < Math.min(1, 0.5 + 0.5 * hu.k)) {
    G.sect.talis[hu.key]--;
    sectLog('【遭遇】' + p.name + ' 在' + where + '遇上' + foeName + '（战力约 ' + ep + '），不敌，幸得护身符护住周身，全身而退' + tail, '#ffcd75', p);
    return true;
  }
  const safe = Math.min(0.9, sumFx(p, 'safe'));
  const hurt = Math.round(randInt(20, 60) * (1 - safe * 0.5));
  p.hurt = Math.max(p.hurt, hurt);
  if (pp < ep * 0.35 && Math.random() < 0.15 * (1 - safe)) {
    sectLog('【遭遇】' + p.name + ' 在' + where + '遇上' + foeName + '（战力约 ' + ep + '），力战不敌……' + tail, '#b13e53', p);
    return !personFalls(p, p.name + ' 在' + where + '陨落，身死道消');
  }
  sectLog('【遭遇】' + p.name + ' 在' + where + '遇上' + foeName + '（战力约 ' + ep + '），不敌负伤而逃（养伤 ' + hurt + ' 天）' + tail, '#ef7d57', p);
  return false;
}
// 外出历练：每月结算一次
function travelMonth(p) {
  const tv = p.travel, reg = REGIONS[tv.region], S = G.sect;
  const secret = S.secret && S.secret.region === tv.region, lootK = 1 + sumFx(p, 'loot');
  p.exp += 10 * (1 + p.realm);
  if (p.realm === 3) p.wu = Math.min(100, p.wu + 3 * (1 + sumFx(p, 'wu')));
  if (p.realm === 4) p.ying = Math.min(100, p.ying + 0.6);
  if (p.hurt > 0) p.hurt = Math.max(0, p.hurt - 30);
  if (Math.random() < 0.45 + p.charm * 0.02) {
    const r = Math.random(), where = reg.name;
    if (r < 0.32) {
      const foes = { center: ['劫修', '恶霸修士'], east: ['海妖', '蛟龙幼崽'], south: ['毒蛟', '瘴林妖王'], west: ['沙虫', '古尸'], north: ['冰原狼王', '雪妖'] }[tv.region];
      if (!fight(p, pick(foes), reg.danger, where)) return;
      if (!S.people.includes(p) || !p.travel) return;
    } else if (r < 0.52) {
      const loot = { center: ['lingshi', 40, 90], east: ['herb', 20, 50], south: ['herb', 25, 60], west: ['lingshi', 30, 70], north: ['ore', 15, 40] }[tv.region];
      const n = Math.round(randInt(loot[1], loot[2]) * (secret ? 2 : 1) * lootK);
      tv.loot[loot[0]] += n;
    } else if (r < 0.68) {
      const k = pick(DAO_IDS), n = secret ? 2 : 1;
      S.qi[k] = (S.qi[k] || 0) + n;
      sectLog('【历练】' + p.name + ' 在' + where + '偶得' + n + '缕' + DAOS[k].qiName, DAOS[k].color, p);
    } else if (r < 0.77 || (secret && r < 0.87)) {
      const rare = DAO_IDS.filter((k) => !S.manuals.includes(k) && (secret || tv.region === 'west' || DAOS[k].rare < 3));
      const id = rare.length && (secret || tv.region === 'west' || Math.random() < 0.4) ? pick(rare) : pick(DAO_IDS);
      giveManual(id, '【历练】' + p.name + ' 在' + where + (secret ? '秘境深处' : '一处古修洞府') + '中寻得功法', p);
    } else if (r < 0.84) {
      const dao = Math.random() < 0.7 ? pick(DAO_IDS) : null, pw = Math.round(randInt(40, 120) * (secret ? 1.5 : 1));
      S.weapons.push({ name: weaponName(dao), power: pw, dao });
      sectLog('【历练】' + p.name + ' 在' + where + '坊市淘到一件' + (dao ? DAOS[dao].name + '属' : '') + '法器（战力 +' + pw + '）', '#a7f070', p);
    } else if (r < 0.9 && (tv.region === 'south' || tv.region === 'north' || tv.region === 'east')) {
      if (p.prof === 'shou') {
        if (!p.beast || Math.random() < 0.5) { const el = pick(Object.keys(BEASTS)); p.beast = { name: pick(BEASTS[el]), el, lv: (p.beast ? p.beast.lv : 0) + 1 }; sectLog('【历练】' + p.name + ' 在' + where + '收服了一只「' + p.beast.name + '」', '#a7f070', p); }
        else { p.beast.lv++; sectLog('【历练】' + p.name + ' 的灵兽「' + p.beast.name + '」在' + where + '厮杀中成长了', '#a7f070', p); }
      } else { const n = Math.round(randInt(20, 50) * lootK); tv.loot.herb += n; }
    } else {
      S.fame += 3;
      sectLog('【历练】' + p.name + ' 在' + where + '仗义出手，救下一村百姓，' + S.name + '声名远播（声望 +3）', '#ffcd75', p);
    }
  }
  tv.left--;
  if (tv.left <= 0) travelReturn(p);
}
function travelReturn(p) {
  const tv = p.travel;
  if (tv) {
    for (const k in tv.loot) if (tv.loot[k] > 0) G.res[k] += tv.loot[k];
    const got = Object.keys(tv.loot).filter((k) => tv.loot[k] > 0).map((k) => RES_INFO[k].name + ' ' + tv.loot[k]).join('、');
    sectLog(p.name + ' 历练归来' + (got ? '，带回 ' + got : '') + (p.hurt > 0 ? '（身上带伤）' : ''), '#ffcd75', p);
  }
  p.away = 0; p.travel = null; p.task = 'cult';
  const a = tileCenter(SECT_SPOTS.gate.anchor);
  p.x = a.x; p.y = a.y; p.at = 'gate'; p.from = 'gate'; p.loc = null; p.route = [];
  goTo(p, taskLoc(p));
}

// ---------- 宗门事件 & 天下大事（每月） ----------
function sectDefense(home) {
  return home.reduce((s, q) => s + personPower(q) * (1 + sumFx(q, 'def')), 0) * (1 + 0.3 * countType('zhenyan') + 0.1 * (G.core ? G.core.level - 1 : 0));
}
function sectEvent() {
  const S = G.sect, r = Math.random(), home = S.people.filter((q) => !q.away);
  if (r < 0.05 && home.length) {
    const beast = pick(['一群赤眼妖狼', '一头千年黑熊精', '一伙山匪散修', '一条修炼成精的大蟒']);
    const year = sectCal().year;
    const ep = (150 + year * 60) * rand(0.7, 1.3);
    if (sectDefense(home) > ep) { const n = Math.round(ep * 0.1); G.res.lingshi += n; S.fame += 2; sectLog('【宗门】' + beast + '来犯山门，被众弟子合力击退（灵石 +' + n + '，声望 +2）', '#ffcd75'); }
    else {
      const lose = { lingshi: Math.floor(G.res.lingshi * 0.2), herb: Math.floor(G.res.herb * 0.3) };
      G.res.lingshi -= lose.lingshi; G.res.herb -= lose.herb;
      const v = pick(home); v.hurt = Math.max(v.hurt, randInt(20, 40));
      sectLog('【宗门】' + beast + '来犯山门，护山不力！（灵石 -' + lose.lingshi + '，灵草 -' + lose.herb + '，' + v.name + ' 受伤）', '#ef7d57', v);
      showBanner('山门遇袭', beast + '来犯，损失惨重（修建护山阵眼、提升弟子战力可以防御）', 4, '#ef7d57');
    }
  } else if (r < 0.09) {
    const o = pick(S.sects);
    if (Math.random() < 0.5) {
      const n = randInt(20, 60); G.res.lingshi += n; o.att = Math.min(100, o.att + 5);
      sectLog('【往来】' + o.name + ' 遣使来访，赠灵石 ' + n + '（与' + o.name + '交情 +5）', '#a7f070');
    } else if (home.length) {
      const champ = home.slice().sort((a, b) => personPower(b) - personPower(a))[0];
      const clash = daoClash(champ.dao, o.dao);
      const ep = o.power * rand(0.25, 0.5), mp = personPower(champ) * clash.k, win = Math.random() < mp / (mp + ep);
      const tail = '〔' + o.name + '修' + DAOS[o.dao].name + '道途' + (clash.text ? '；' + clash.text : '') + '〕';
      if (win) { S.fame += 5; o.att -= 3; sectLog('【往来】' + o.name + ' 弟子上门挑战，' + champ.name + ' 出战获胜，扬我宗威（声望 +5）' + tail, '#ffcd75', champ); }
      else { S.fame = Math.max(0, S.fame - 2); champ.hurt = Math.max(champ.hurt, 15); sectLog('【往来】' + o.name + ' 弟子上门挑战，' + champ.name + ' 惜败（声望 -2）' + tail, '#ef7d57', champ); }
    }
  } else if (r < 0.12) {
    const lv = Math.random() < 0.7 ? 1 : 2, c = makePerson({ mean: 5, realm: lv, age: randInt(25, 60) });
    c.manual = pick(DAO_IDS); c.dao = lv >= 2 ? c.manual : null; c.qiTaken = lv >= 2 ? 3 : 0; c.zj = 100;
    if (c.dao) touchDao(c, c.dao, 3);
    c.prof = Math.random() < 0.7 ? c.apt : pick(PROF_IDS);
    if (c.prof === 'shou') { const el = daoGroup(c.manual); c.beast = { name: pick(BEASTS[el]), el, lv: 0 }; }
    c.cost = 40 + lv * 40;
    G.state = 'dialog';
    G.dialog = { title: '散修投奔', text: '一位' + REALMS[lv] + '期' + PROFS[c.prof].name + '「' + c.name + '」（' + (c.sex === 'f' ? '女' : '男') + '，' + c.age + ' 岁）慕名而来，修的是' + DAOS[c.manual].gf.name + '（' + daoLabel(c.manual) + '），愿拜入门下。\n根骨 ' + c.bone + '　神识 ' + c.mind + '　灵气 ' + c.qi + '　魅力 ' + c.charm + '\n需要 ' + c.cost + ' 灵石安置。', options: [
      { label: '收留（灵石 ' + c.cost + '）', disabled: G.res.lingshi < c.cost || discipleCount() >= sectCapacity(), action: () => { G.res.lingshi -= c.cost; addPerson(c, 'gate'); if (!S.manuals.includes(c.manual)) giveManual(c.manual, '散修 ' + c.name + ' 献上本门未有的功法'); sectLog('散修 ' + c.name + '（' + REALMS[lv] + '期' + PROFS[c.prof].name + '）投奔' + S.name, '#a7f070', c); } },
      { label: '婉拒', action: () => {} },
    ] };
  } else if (r < 0.15 && S.manuals.length < DAO_IDS.length) {
    const left = DAO_IDS.filter((k) => !S.manuals.includes(k)), id = pick(left), d = DAOS[id], price = [0, 100, 180, 300][d.rare];
    G.state = 'dialog';
    G.dialog = { title: '云游书商', text: '一位云游书商路过山门，手里有一部' + d.gf.name + '（' + daoLabel(id) + '）。\n' + d.concept + '\n道途特性：' + d.path.text + '；功法特性：' + d.gf.text + '\n开价 ' + price + ' 灵石。', options: [
      { label: '买下（灵石 ' + price + '）', disabled: G.res.lingshi < price, action: () => { G.res.lingshi -= price; giveManual(id, '从云游书商手中购得功法'); } },
      { label: '不买', action: () => {} },
    ] };
  }
}
function worldEvent() {
  const S = G.sect, o = pick(S.sects), o2 = pick(S.sects.filter((x) => x !== o)), rg = pick(Object.keys(REGIONS)), R = REGIONS[rg].name;
  const r = Math.random();
  if (r < 0.2) { o.power = Math.round(o.power * 1.3); o.lv = Math.min(5, o.lv + (Math.random() < 0.4 ? 1 : 0)); worldLog(o.name + '宗主闭关多年，' + DAOS[o.dao].name + '道途大成，门中已有' + REALMS[o.lv] + '期修士坐镇'); }
  else if (r < 0.35) { o.power = Math.round(o.power * 0.8); worldLog(R + '爆发兽潮，' + o.name + '首当其冲，损失惨重'); }
  else if (r < 0.5) {
    const c = daoClash(o.dao, o2.dao), win = c.k >= 1 ? o : o2;
    worldLog(o.name + '（' + DAOS[o.dao].name + '）与' + o2.name + '（' + DAOS[o2.dao].name + '）为争夺一条灵脉大打出手，' + (c.text ? c.text.split('，')[0] + '，' : '') + win.name + '略占上风');
  }
  else if (r < 0.62 && !S.secret) { S.secret = { region: rg, left: 6 }; worldLog(R + '有上古秘境开启（约 6 个月），各派弟子蜂拥而至——此时派弟子去' + R + '历练，收获翻倍，还可能得到珍稀功法'); showBanner('秘境开启', R + '有上古秘境现世，派弟子前往历练收获翻倍', 4, '#73eff7'); }
  else if (r < 0.74) { worldLog(R + '坊市举办拍卖会，一部' + DAOS[pick(DAO_IDS)].gf.name + '残卷拍出天价'); }
  else if (r < 0.86) { worldLog('天降异象，' + R + '上空紫气东来三日不散，传言有异宝出世'); }
  else { worldLog(pick(['散修', '魔修', '剑修', '鬼修', '符修']) + '「' + randName('m') + '」在' + R + '连挑数派，名动一时'); }
}

function sectMonthly() {
  const S = G.sect, cal = sectCal();
  const ds = S.people.filter((q) => !q.head);
  const need = ds.reduce((s, q) => s + STIPEND[q.realm], 0);
  if (need > 0) {
    if (G.res.lingshi >= need) { G.res.lingshi -= need; for (const q of ds) q.loy = Math.min(100, q.loy + 1); }
    else {
      G.res.lingshi = 0;
      for (const q of ds) q.loy = Math.max(sumFx(q, 'loyal') || 0, q.loy - 8);
      sectLog('宗门灵石不足，弟子月俸发不出来了，人心浮动（忠诚 -8）', '#ef7d57');
      showBanner('月俸不足！', '本月需要 ' + need + ' 灵石发月俸，弟子忠诚下降', 3.5, '#ef7d57');
    }
  }
  for (const q of ds.slice()) {
    if (q.loy < 15 && !q.away && Math.random() < 0.3) {
      const n = Math.min(Math.floor(G.res.lingshi * 0.2), 50); G.res.lingshi -= n;
      personDies(q, q.name + ' 心灰意冷，叛出师门' + (n ? '，还卷走了 ' + n + ' 灵石' : ''));
    }
  }
  for (const p of S.people.slice()) {
    if (!S.people.includes(p)) continue;
    if (p.away) { travelMonth(p); continue; }
    if (Math.random() < (0.05 + p.charm * 0.01) * (1 + sumFx(p, 'fortune'))) personEvent(p);
  }
  sectEvent();
  if (Math.random() < 0.35) worldEvent();
  if (S.secret && --S.secret.left <= 0) { worldLog(REGIONS[S.secret.region].name + '的秘境关闭了'); S.secret = null; }
  sectRegrow();
  if (cal.month === 6) {
    const home = S.people.filter((q) => !q.away && !q.head);
    if (home.length >= 2) {
      const rank = home.map((q) => [q, personPower(q) * rand(0.8, 1.2)]).sort((a, b) => b[1] - a[1]);
      const w = rank[0][0];
      w.exp += 50 * (1 + w.realm); G.res.lingshi += 20; S.fame += 2; w.loy = Math.min(100, w.loy + 10);
      sectLog('【宗门大比】' + rank.slice(0, 3).map((x, i) => ['魁首', '次席', '三甲'][i] + ' ' + x[0].name + (x[0].dao ? '（' + DAOS[x[0].dao].name + '）' : '')).join('，') + '（魁首获赏，声望 +2）', '#ffcd75', w);
      showBanner('宗门大比', '魁首：' + w.name, 3, '#ffcd75');
    }
  }
  if (cal.month === 12) {
    const n = Math.round(20 + S.fame * 0.5);
    G.res.lingshi += n;
    sectLog('年关将至，山下凡人世家送来供奉（灵石 +' + n + '）', '#a7f070');
  }
}
function sectYearly() {
  const S = G.sect, y = sectCal().year;
  for (const p of S.people.slice()) {
    p.age++;
    if (p.age >= lifeMax(p)) personDies(p, (p.head ? '掌门 ' : '') + p.name + ' 寿元耗尽，于' + (p.away ? '外' : '洞府中') + '坐化，享年 ' + p.age + ' 岁');
  }
  if (G.state === 'over') return;
  makeCandidates();
  sectLog('第 ' + y + ' 年开春，' + S.name + '开山收徒（三个月内可在「弟子」面板挑选）', '#ffcd75');
  showBanner('第 ' + y + ' 年 · 开山收徒', '有 ' + S.cands.length + ' 位少年前来拜师，打开「弟子」面板挑选', 4, '#ffcd75');
  worldEvent();
}

// ---------- 旧存档转换（8 种真气 → 31 条道途） ----------
const OLD_DAO = { jin: 'geng', mu: 'yi', shui: 'gui', huo: 'bing', tu: 'wu', lei: 'zhen', yin: 'taiyin', feng: 'jueyin' };
function migrateSect(S) {
  if (S.v >= SECT_VER) return;
  const m = (id) => (id && OLD_DAO[id]) || id;
  S.manuals = [...new Set(S.manuals.map(m))];
  const qi = {}; for (const k in S.qi) qi[m(k)] = (qi[m(k)] || 0) + S.qi[k]; S.qi = qi;
  const items = {}; for (const k in S.items) items[k.includes('|') ? k : itemKey(k, null)] = S.items[k]; S.items = items;
  S.talis = S.talis || {};
  S.jobs.dianji = S.jobs.dianji || null;
  for (const w of S.weapons) w.dao = w.dao || null;
  for (const o of S.sects) o.dao = o.dao || pick(DAO_IDS);
  for (const p of S.people) {
    p.manual = m(p.manual); p.dao = m(p.dao);
    p.mix = p.mix || {}; if (p.dao && !Object.keys(p.mix).length) p.mix[p.dao] = Math.max(1, p.qiTaken);
    p.prof = p.prof || null; p.apt = p.apt || pick(PROF_IDS); p.gain = p.gain || 0; p.beast = p.beast || null; p.comeback = p.comeback || 0;
    p.buf = Object.assign({ peiyuan: 0, zhuji: 0, pojing: 0, juling: 0 }, p.buf);
    if (p.buf.zhuji === true) p.buf.zhuji = 1;
    if (p.buf.pojing === true) p.buf.pojing = 1;
    if (p.weapon) p.weapon.dao = p.weapon.dao || null;
  }
  S.v = SECT_VER;
}

// ---------- 模式定义 ----------
MODES.sect = {
  id: 'sect',
  name: '修仙门派',
  tag: '经营 · 修仙 · 弟子养成',
  icon: 'sect_icon',
  desc: '你是一派掌门。31 条道途（五行 × 天干八卦地支、三阴三阳）、七大职业、道途生克。每年开山收徒，凡人 → 筑基 → 炼气 → 金丹 → 化神 → 元婴。',
  intro: '点山峰查看功能，点弟子查看属性与修炼进度；底部「弟子」「典籍」「天下」「纪事」管理宗门。',
  resources: ['lingshi', 'herb', 'ore', 'wood'],
  startRes: { lingshi: 150, herb: 30, ore: 15, wood: 40 },
  dayTime: 1e9,
  hasNights: false,
  tapGather: true,
  coreSprite: 'core_sect',
  mapW: SECT_W, mapH: SECT_H, startZoom: 2.4, maxSpeed: 5,
  techLabel: '传承', techTitle: '宗门传承',
  groundColors: {
    [TER.GRASS]: ['#477a4a', '#3a6640', '#558a52'],
    [TER.PAVE]: ['#a19c8e', '#928d80', '#aea99b'],
    [TER.DIRT]: ['#7d6a4a', '#6a583b', '#8e7b57'],
    [TER.LOT]: ['#4a5a52', '#3f504a', '#55665e'],
  },
  miniColors: { [TER.LOT]: '#3f504a', [TER.PAVE]: '#c8c2b0', [TER.DIRT]: '#9c8a64', [TER.GRASS]: '#3f6b45' },
  noFlowers: false, cleanPave: true,
  loseText: '宗门香火断绝……',
  mapGen: sectMapGen,

  nodes: {
    lingpine: { name: '灵松', res: 'wood', amount: 12, sprite: 'lingpine' },
    herb: { name: '灵草', res: 'herb', amount: 6, sprite: 'herb' },
    orevein: { name: '玄铁矿', res: 'ore', amount: 15, sprite: 'orevein' },
    spiritvein: { name: '灵石矿脉', res: 'lingshi', amount: 20, sprite: 'spiritvein' },
  },

  buildList: ['lingtian', 'lumberyard', 'kuangdong', 'lsmine', 'julingzhen', 'dongfu', 'zhenyan'],
  buildings: {
    core: { name: '宗门香鼎', size: 2, hp: 2000, upgrade: { lingshi: 120, wood: 60, ore: 20 }, desc: '宗门气运所系。升级后可多收 2 名弟子' },
    lingtian: { name: '灵田', hp: 100, cost: { wood: 15, lingshi: 10 }, sprite: 's_field', produce: { res: 'herb', amount: 1, interval: 7 }, desc: '种植灵草，持续产出灵草' },
    lumberyard: { name: '伐木场', hp: 100, cost: { lingshi: 10 }, sprite: 's_lumber', gather: 'lingpine', radius: 3, interval: 2.5, amount: 1, desc: '自动砍伐 3 格内的灵松' },
    kuangdong: { name: '矿洞', hp: 100, cost: { wood: 25 }, sprite: 's_mine', gather: 'orevein', radius: 3, interval: 4, amount: 1, desc: '自动开采 3 格内的玄铁矿' },
    lsmine: { name: '灵石矿', hp: 100, cost: { wood: 30, ore: 10 }, sprite: 's_lsmine', gather: 'spiritvein', radius: 3, interval: 5, amount: 1, locked: true, desc: '自动开采 3 格内的灵石矿脉（矿脉多在群山脚下）' },
    julingzhen: { name: '聚灵阵', hp: 150, cost: { lingshi: 60, ore: 20 }, sprite: 's_array', locked: true, desc: '3.5 格内修炼的弟子速度 +25%（每级再 +25%）。建在主峰广场上最划算' },
    dongfu: { name: '洞府', hp: 200, cost: { wood: 40, lingshi: 30 }, sprite: 's_dongfu', locked: true, desc: '弟子居所，每座可多收 2 名弟子' },
    zhenyan: { name: '护山阵眼', hp: 300, cost: { ore: 30, lingshi: 50 }, sprite: 's_eye', locked: true, desc: '每座让宗门抵御妖兽、山匪时的防御 +30%' },
  },

  techs: [
    { id: 'lingmai', name: '灵脉勘探', desc: '解锁 灵石矿（开采群山脚下的灵石矿脉）', cost: { lingshi: 40, wood: 30 }, unlock: ['lsmine'] },
    { id: 'zhenfa', name: '阵法初解', desc: '解锁 聚灵阵（提升附近弟子修炼速度）', cost: { lingshi: 80, ore: 20 }, unlock: ['julingzhen'] },
    { id: 'dongfu', name: '开辟洞府', desc: '解锁 洞府（每座多收 2 名弟子）', cost: { lingshi: 60, wood: 60 }, unlock: ['dongfu'] },
    { id: 'xinfa', name: '宗门心法', desc: '全宗修炼速度 +15%', cost: { lingshi: 120, herb: 30 }, apply: (m) => { m.cult *= 1.15; } },
    { id: 'dandao', name: '丹道精进', desc: '炼丹速度 +25%，成丹率 +10%', cost: { lingshi: 100, herb: 60 }, apply: (m) => { m.alch *= 1.25; m.alchOk += 0.1; } },
    { id: 'qidao', name: '器道精进', desc: '炼出的法器威力 +30%', cost: { lingshi: 100, ore: 50 }, apply: (m) => { m.forge *= 1.3; } },
    { id: 'husan', name: '护山大阵', desc: '解锁 护山阵眼（抵御妖兽山匪）', cost: { lingshi: 120, ore: 40 }, req: ['zhenfa'], unlock: ['zhenyan'] },
    { id: 'shoutu', name: '广开山门', desc: '每年多一位拜师少年，资质更好；门下名额 +1', cost: { lingshi: 150, wood: 50 }, apply: (m) => { m.recruit += 1; m.cap += 1; } },
    { id: 'jiejing', name: '破境心得', desc: '所有突破成功率 +5%', cost: { lingshi: 200, herb: 80 }, req: ['xinfa'], apply: (m) => { m.brk += 0.05; } },
    { id: 'xinfa2', name: '无上心法', desc: '全宗修炼速度再 +25%', cost: { lingshi: 400, herb: 120, ore: 60 }, req: ['jiejing'], apply: (m) => { m.cult *= 1.25; } },
  ],
  monsters: {},

  hooks: {
    init() {
      Object.assign(G.mods, { cult: 1, alch: 1, alchOk: 0, forge: 1, recruit: 0, cap: 0, brk: 0 });
      const manuals = DAO_STARTER.slice().sort(() => Math.random() - 0.5).slice(0, 2);
      G.sect = {
        v: SECT_VER, name: pick(SECT_NAMES), seed: randInt(1, 1e9), t: 0, fame: 5, people: [], cands: [], candUntil: 0,
        manuals, qi: {}, items: { [itemKey('zhuji', null)]: 1 }, talis: {}, weapons: [], jobs: { liandan: null, lianqi: null, dianji: null },
        peaks: {}, log: [], world: [], weather: 'clear', weatherLeft: 0, secret: null, acc: { herb: 0, wood: 0, ore: 0, lingshi: 0 },
        sects: OTHER_SECTS.slice().sort(() => Math.random() - 0.5).slice(0, 6).map((n) => ({ name: n, region: pick(Object.keys(REGIONS)), lv: randInt(1, 3), power: randInt(300, 1200), att: randInt(-20, 30), dao: pick(DAO_IDS) })),
      };
      for (const k in PEAKS) G.sect.peaks[k] = { lv: 1 };
      sectPid = 1;
      const head = makePerson({ head: true, mean: 6.5, age: 32, sex: Math.random() < 0.5 ? 'f' : 'm' });
      head.zj = 30; head.manual = manuals[0];
      addPerson(head, 'zongzhu');
      setProf(head, head.apt);
      for (let i = 0; i < 2; i++) { const d = makePerson({ mean: 4.6 }); addPerson(d, 'zhufeng'); }
      makeCandidates();
      sectLog(G.sect.name + ' 立宗。掌门 ' + head.name + '（' + PROFS[head.prof].name + '）携两名弟子开山，藏经阁中有' + manuals.map((m) => DAOS[m].gf.name).join('、'), '#ffcd75', head);
      worldLog('天下五域：中州、东海、南疆、西漠、北原，宗门林立。' + G.sect.sects.map((s) => s.name + '（' + DAOS[s.dao].name + '）').join('、') + '等名门各据一方');
      G.introNote = '这里是「' + G.sect.name + '」，你是掌门 ' + head.name + '。';
      G.members = G.sect.people;
      sectNatTer();
      buildSectLayer();
    },
    save() { return { sect: G.sect, pid: sectPid }; },
    load(d) {
      G.sect = d.sect;
      migrateSect(G.sect);
      sectPid = d.pid || 1000;
      for (const p of G.sect.people) { if (!p.away) { p.route = []; p.from = taskLoc(p); const s = pickSeat(taskLoc(p)); p.x = s.x; p.y = s.y; p.at = taskLoc(p); p.loc = taskLoc(p); } }
      G.members = G.sect.people;
      sectNatTer();
      buildSectLayer();
    },
    update(dt) {
      const S = G.sect;
      const before = Math.floor(S.t);
      S.t += dt / SECT_DAY;
      const after = Math.floor(S.t);
      for (let d = before + 1; d <= after; d++) {
        G.day = d + 1;
        sectDaily();
        if (G.state === 'over') return;
        if (d % 30 === 0) {
          sectMonthly();
          if (G.state === 'over') return;
          if (d % 360 === 0) sectYearly();
          if (G.state === 'over') return;
          if (G.state === 'play') saveGame();
        }
      }
      if (S.cands.length && S.t > S.candUntil) { S.cands = []; sectLog('今年的拜师少年们下山去了', '#94b0c2'); }
      for (const p of S.people) {
        if (p.away) continue;
        movePerson(p, dt);
        idleWander(p, dt);
        if (p.task === 'travel' && p.at === 'gate' && !p.route.length) { p.away = p.travel.months; p.at = null; }
      }
      G.members = S.people.filter((q) => !q.away);
      sectAmbient(dt);
    },
    dayLabel() {
      const c = sectCal(), wn = { clear: '晴', rain: '雨', storm: '雷雨', snow: '雪' }[G.sect.weather];
      return G.sect.name + ' · 第' + c.year + '年 ' + MONTH_CN[c.month - 1] + '（' + monthBranch() + '月）' + dayCN(c.day) + ' ' + ganzhiText() + ' · ' + SEASON_CN[sectSeason()] + ' · ' + wn + (fullMoon() ? ' · 满月' : '');
    },
    hud() {
      const S = G.sect, qn = Object.values(S.qi).reduce((s, n) => s + n, 0);
      const out = [
        { icon: 'fame', text: '声望 ' + Math.floor(S.fame), color: '#ffcd75' },
        { icon: 'person', text: '弟子 ' + discipleCount() + '/' + sectCapacity(), color: discipleCount() >= sectCapacity() ? '#ef7d57' : '#f4f4f4' },
        { icon: 'qi', text: '真气 ' + qn, color: '#a7f070' },
      ];
      if (S.cands.length) out.push({ text: '开山收徒中（' + S.cands.length + ' 人）', color: '#73eff7' });
      if (S.secret) out.push({ text: REGIONS[S.secret.region].name + '秘境开启', color: '#73eff7' });
      return out;
    },
    extraButtons() {
      const S = G.sect;
      const ready = S.people.some((p) => !p.away && p.realm < REALM_CAP && realmNeed(p).ready);
      return [
        { label: '弟子', onClick: () => openSect('list'), badge: ready || S.cands.length > 0 },
        { label: '典籍', onClick: () => openSect('library'), badge: false },
        { label: '天下', onClick: () => openSect('world'), badge: false },
        { label: '纪事', onClick: () => openSect('chron'), badge: false },
      ];
    },
    onWorldTap(wx, wy) { return sectWorldTap(wx, wy); },
    buildingInfo(b) {
      if (b.type === 'core') return '门下名额 ' + discipleCount() + '/' + sectCapacity() + '　声望 ' + Math.floor(G.sect.fame);
      if (b.type === 'julingzhen') return '3.5 格内修炼速度 +' + (25 * b.level) + '%';
      if (b.type === 'zhenyan') return '宗门防御 +30%';
      if (b.type === 'dongfu') return '门下名额 +2';
      return null;
    },
    drawUnder(ctx) { if (G.sectLayer) ctx.drawImage(G.sectLayer, 0, 0, MAP_W * T, MAP_H * T); },
    drawWorld(ctx) { drawSectWorld(ctx); },
    drawScreen(ctx) { drawSectScreen(ctx); },
    drawOverlay(ctx) { if (G.state === 'sect') drawSectPanel(ctx); },
  },
};
