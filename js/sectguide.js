// =============================================
//  修仙门派：新手教程、修炼指南（收藏在「典籍 → 修炼指南」）、宗门品阶、建筑弹窗
//  宗门品阶跟着掌门境界走：掌门每突破一次，宗门就升一阶（名额、收徒资质、供奉都会提升）
// =============================================
const SECT_TIERS = [
  { name: '散修小派', desc: '初立山门，无人知晓' },
  { name: '入流宗门', desc: '掌门筑基，总算在附近凡人城镇中有了名号' },
  { name: '三流宗门', desc: '掌门炼气，周边散修开始慕名而来' },
  { name: '二流宗门', desc: '掌门结丹，一方之地数得上的名门' },
  { name: '一流宗门', desc: '掌门化神，各大宗门都要礼让三分' },
  { name: '仙道圣地', desc: '掌门元婴，名震天下的仙道圣地' },
];
function sectTier() { const h = headOf(); return h ? Math.min(5, h.realm) : 0; }
function sectTierBonusText(t) { return '门下名额 +' + t + '，拜师少年资质更好' + (t >= 2 ? '、人数更多' : '') + '，年终供奉 +' + t * 30 + '%'; }

// ---------- 修炼指南 ----------
const SECT_GUIDES = {
  intro: { title: '开宗立派 · 掌门须知', pages: [
    { t: '欢迎，掌门', x: '你是这座山头的掌门。门派由几座山峰组成：\n· 主峰：宗门大殿和香鼎，弟子闭关修炼的地方\n· 宗主峰：掌门的居所，掌门在这里修炼事半功倍\n· 炼丹峰 / 炼器峰 / 典籍峰：炼丹、炼器、制符、参悟\n· 演武场：弟子切磋，积累实战经验\n点山峰可以查看它的作用和升级；点地图上的小人可以查看弟子。' },
    { t: '弟子与差事', x: '弟子可以拜掌门或峰主为师，师父会指点修炼。修建「坊市」可以买卖货物；「天下」页里有悬赏榜，可以派弟子去捉妖、除鬼、探秘、助拳。\n底部按钮：\n· 弟子：查看每个人的属性、修炼进度、给他们安排差事（闭关、采气、炼丹、演武……）\n· 典籍：功法、库存、道途生克，还有你收藏的「修炼指南」\n· 天下：外面的世界和其他宗门\n· 纪事：门中发生的大小事\n· 建筑：修建灵田、矿洞、聚灵阵、洞府等\n· 传承：研究宗门传承（科技）\n每年正月开山收徒，记得去「弟子」面板挑人。' },
    { t: '重中之重：先发展掌门', x: '掌门的境界就是宗门的层次。\n掌门每突破一个大境界，宗门就晋升一阶：散修小派 → 入流 → 三流 → 二流 → 一流 → 仙道圣地。\n每升一阶：门下名额更多、拜师少年资质更好、年终供奉更多。\n所以开局请把最好的资源（丹药、真气、功法）优先给掌门，让掌门在宗主峰专心闭关。' },
    { t: '时间与寿元', x: '在这里，一分钟就是一年。\n每个人都有寿元上限，突破大境界才能延寿（筑基 +50 年、炼气 +100、金丹 +300、化神 +500、元婴 +1000），实际延寿还看道途精纯、突破时的机缘和失败次数。\n寿元将尽时可以服延寿丹、千年灵芝续命。\n右上角的 ×1 按钮可以加速（最高 ×20）。' },
  ] },
  r0: { title: '凡人 → 筑基：百日筑基', x: '1. 打开「弟子」面板，选中掌门，把差事设为「闭关修炼」（掌门会去宗主峰，速度 ×1.5）。\n2. 攒满 100 天的修为（大约 17 秒），进度条满了就会提示「可突破」。\n3. 在人物面板点「冲击筑基」。失败会受伤、修为倒退，可以先在炼丹峰炼一颗「筑基丹」服下提高成功率。\n4. 趁这段时间，给掌门在「道途与功法」里选一部功法——筑基后马上要用到。' },
  r1: { title: '筑基 → 炼气：服气定道', x: '1. 确认掌门已修习一部功法（人物面板 → 道途与功法）。功法决定你能采哪种「天地真气」。\n2. 把差事设为「采集真气」，掌门会去功法记载的地点。注意功法写的时机：天干道途逢本日干最旺，地支道途逢本月月建最旺，有的要晴天、雨天、满月或某个季节。\n3. 采到的真气存进宗门，在人物面板「服用」。服下 3 缕即可冲击炼气。\n4. 第一缕真气决定掌门的道途，之后只服同一道途的真气，保持精纯——越精纯，突破越容易、延寿越多。\n5. 可以派其他修同一功法的弟子帮掌门一起采气。' },
  r2: { title: '炼气 → 金丹：炼化结丹', x: '1. 差事改回「闭关修炼」，把服下的真气一点点炼化进肉身（这一步要好几十年）。\n2. 继续服用同道途真气（最多 9 缕）：能加快炼化，结出的金丹品阶也越高。\n3. 根骨越好炼化越快；在主峰建「聚灵阵」、扩建宗主峰、研究「宗门心法」都能加速。\n4. 炼化圆满后冲击金丹。冲击前可以服「破境丹」「定神丹」，或用「雷劫余烬」。\n5. 这一阶段很长，留意寿元，必要时服延寿丹。' },
  r3: { title: '金丹 → 化神：体悟神妙', x: '1. 金丹期要积累「悟性」：差事设为「参悟典籍」最快（在典籍峰），演武、外出历练、顿悟事件也能增加悟性。\n2. 悟性圆满时，金丹与道途相合、借职业之形诞生神通——职业不同，神通就不同。\n3. 诞生神通后才能冲击化神。\n4. 金丹后职业定型，记得在此之前选好职业（看与道途的契合度）。\n5. 典籍峰扩建、悟性类的道途和性格（如丁火、癸水、悟性超群）会快很多。' },
  r4: { title: '化神 → 元婴：孕育元婴', x: '1. 以神通为元神、金丹为胚胎孕育元婴：差事设为「闭关修炼」，孕婴进度慢慢增长（要上百年）。\n2. 金丹品阶越高，孕婴越快；亥水、坤土、辰土等道途也擅长孕婴。\n3. 冲击元婴失败会走火入魔、折损寿元，甚至有极小几率身死道消。冲击前务必备好定神丹、破境丹、雷劫余烬，宗门里最好存一株九转还魂草。\n4. 化神期寿元很长，但孕婴更长，失败几次就可能等不到下次机会。' },
  r5: { title: '元婴老祖', x: '恭喜！掌门修成元婴，宗门已是名震天下的仙道圣地。\n炼虚、合道之境尚未开放。\n接下来可以培养更多元婴弟子，或者为身后之事做准备——掌门坐化时会把修为传给后辈，由境界最高的弟子继任。' },
};
// 掌门突破后：弹出下一境界的修炼指南，并收进典籍
function sectUnlockGuide(id, show) {
  const S = G.sect;
  S.guides = S.guides || [];
  if (!S.guides.includes(id)) S.guides.push(id);
  if (show) S.guideQueue = (S.guideQueue || []).concat([id]);
}
function sectShowGuide(id, page) {
  const g = SECT_GUIDES[id];
  if (!g) return;
  G.state = 'dialog';
  if (g.pages) {
    const pg = g.pages[page || 0], last = (page || 0) >= g.pages.length - 1;
    G.dialog = { title: g.title + '（' + ((page || 0) + 1) + '/' + g.pages.length + '）· ' + pg.t, text: pg.x, options: [
      last ? { label: '开始修行', action: () => { const q = G.sect.guideQueue || []; if (q.length) sectShowGuide(q.shift()); } }
        : { label: '下一页 ▶', action: () => sectShowGuide(id, (page || 0) + 1) },
      { label: '跳过（之后可在「典籍 → 修炼指南」重看）', action: () => { const q = G.sect.guideQueue || []; if (q.length) sectShowGuide(q.shift()); } },
    ] };
  } else {
    G.dialog = { title: '修炼指南 · ' + g.title, text: g.x + '\n\n（这份指南已收进「典籍 → 修炼指南」）', options: [{ label: '知道了', action: () => { const q = G.sect.guideQueue || []; if (q.length) sectShowGuide(q.shift()); } }] };
  }
}
// 每帧检查有没有待弹出的指南（开局时、掌门突破后）
function sectGuideTick() {
  const S = G.sect;
  if (G.state !== 'play' || !S.guideQueue || !S.guideQueue.length) return;
  sectShowGuide(S.guideQueue.shift());
}
function sectViewGuides(c) {
  const S = G.sect, list = S.guides || ['intro'];
  cHead(c, '修炼指南（掌门每突破一次，就会收录下一境界的指南）');
  const h = headOf();
  if (h) cLine(c, '当前宗门品阶：' + SECT_TIERS[sectTier()].name + '（' + SECT_TIERS[sectTier()].desc + '）　' + sectTierBonusText(sectTier()), 12, '#ffcd75');
  for (const id of ['intro', 'r0', 'r1', 'r2', 'r3', 'r4', 'r5']) {
    const g = SECT_GUIDES[id], have = list.includes(id);
    if (!have) { cLine(c, '○ ' + (id === 'intro' ? g.title : '？？？（掌门突破后收录）'), 13, '#566c86', true); continue; }
    cButtons(c, [{ label: (id === 'intro' ? '◇ ' : '◆ ') + g.title + '　（点击重看）', color: '#29366f', onClick: () => { closeSect(); sectShowGuide(id); } }], 32);
    if (!g.pages) cLine(c, g.x, 12, '#c8d6e5', false, 8);
    c.y += 4;
  }
}

// ---------- 建筑弹窗 ----------
const SECT_BUILD_TECH = {}; // 建筑 → 解锁它的传承名字
function sectBuildTech(type) {
  if (!Object.keys(SECT_BUILD_TECH).length) for (const t of G.def.techs) for (const u of t.unlock || []) SECT_BUILD_TECH[u] = t.name;
  return SECT_BUILD_TECH[type];
}
function drawSectBuildPopup(ctx) {
  const sw = G.sw, sh = G.sh;
  ctx.fillStyle = 'rgba(10,10,30,0.6)'; ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, closeSect);
  const list = G.def.buildList, cols = sw >= 560 ? 2 : 1, cw = Math.min(250, (sw - 40 - (cols - 1) * 10) / cols), chh = 74;
  const rows = Math.ceil(list.length / cols), pw = cols * cw + (cols - 1) * 10 + 28, ph = Math.min(sh - 20, 60 + rows * (chh + 8) + 10);
  const px = (sw - pw) / 2, py = (sh - ph) / 2;
  drawPanel(ctx, px, py, pw, ph);
  drawText(ctx, '修建 · 选择要建造的建筑', px + 14, py + 22, 16, '#ffcd75');
  drawButton(ctx, px + pw - 42, py + 6, 34, 30, '✕', closeSect, { size: 14 });
  const top = py + 46;
  const scroll = 60 + rows * (chh + 8) > ph;
  if (scroll) beginScroll(ctx, 'sectbuild', px + 8, top, pw - 22, ph - 54);
  list.forEach((type, i) => {
    const def = bdef(type), x = px + 14 + (i % cols) * (cw + 10), y = top + Math.floor(i / cols) * (chh + 8);
    const full = def.limit && countType(type) >= def.limit;
    const open = G.unlocked.has(type) && !full, ok = open && canAfford(def.cost);
    drawButton(ctx, x, y, cw, chh, '', open ? () => {
      if (!canAfford(def.cost)) { showBanner('资源不足', '修建' + def.name + '需要更多资源', 2, '#ef7d57'); sfx('bad'); return; }
      closeSect();
      G.buildMode = type;
      G.selected = null;
    } : null, { dim: !ok, color: '#333c57' });
    ctx.globalAlpha = open ? 1 : 0.4;
    ctx.drawImage(SPR[def.sprite || type].img, x + 8, y + 8, 32, 32);
    ctx.globalAlpha = 1;
    drawText(ctx, def.name, x + 48, y + 16, 14, open ? '#ffcd75' : '#94b0c2');
    if (open) drawCost(ctx, def.cost, x + cw - 50, y + 16, 90, 11);
    else drawText(ctx, full ? '已建' : '未解锁', x + cw - 24, y + 16, 11, '#94b0c2', 'center', false);
    const desc = full ? '已经建过了（只能建 ' + def.limit + ' 座）' : open ? def.desc : '需先研究传承「' + (sectBuildTech(type) || '？') + '」';
    wrapText(ctx, desc, cw - 56, 11).slice(0, 3).forEach((ln, k) => drawText(ctx, ln, x + 48, y + 34 + k * 14, 11, open ? '#c8d6e5' : '#ef7d57', 'left', false));
  });
  if (scroll) endScroll(ctx, top + rows * (chh + 8));
}
