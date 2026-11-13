// =============================================
//  修仙门派：界面（弟子名录、人物详情、山峰、典籍、天下、纪事、收徒）+ 地图上的点击和特效
// =============================================
function openSect(view, opt) {
  G.sui = Object.assign({ view }, opt || {});
  G.state = 'sect';
  G.buildMode = null;
  G.selected = null;
  if (G.scroll) G.scroll['sect_' + view] = 0;
}
function closeSect() { G.state = 'play'; G.sui = null; }

// 内容排版小工具（在滚动区域里从上往下排）
function sectCursor(ctx, x, y, w) { return { ctx, x, y, w }; }
function cLine(c, text, size, color, bold, indent) {
  const lines = wrapText(c.ctx, text, c.w - (indent || 0), size || 13);
  for (const ln of lines) { drawText(c.ctx, ln, c.x + (indent || 0), c.y + (size || 13) / 2 + 2, size || 13, color || '#c8d6e5', 'left', bold === true); c.y += (size || 13) + 6; }
}
function cHead(c, text, color) {
  c.y += 6;
  c.ctx.fillStyle = 'rgba(255,205,117,0.18)'; c.ctx.fillRect(c.x, c.y, c.w, 24);
  drawText(c.ctx, text, c.x + 8, c.y + 12, 14, color || '#ffcd75');
  c.y += 32;
}
function cButtons(c, items, h) {
  h = h || 32;
  const ctx = c.ctx;
  let x = c.x, rowH = 0;
  for (const it of items) {
    ctx.font = 'bold 12px ' + FONT;
    const w = Math.min(c.w, it.w || Math.max(64, ctx.measureText(it.label).width + 22));
    if (x + w > c.x + c.w && x > c.x) { x = c.x; c.y += h + 6; }
    drawButton(ctx, x, c.y, w, h, it.label, it.dim ? null : it.onClick, { dim: it.dim, color: it.color, active: it.active, size: 12 });
    x += w + 6; rowH = h;
  }
  c.y += rowH + 8;
}
function cBar(c, v, max, color, label) {
  const ctx = c.ctx, w = c.w, r = Math.max(0, Math.min(1, v / max));
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(c.x, c.y, w, 16);
  ctx.fillStyle = color; ctx.fillRect(c.x + 2, c.y + 2, (w - 4) * r, 12);
  drawText(ctx, label, c.x + w / 2, c.y + 8, 11, '#f4f4f4', 'center');
  c.y += 24;
}
function pips(ctx, x, y, v, col) {
  for (let i = 0; i < 10; i++) { ctx.fillStyle = i < v ? col : '#333c57'; ctx.fillRect(x + i * 9, y, 7, 8); }
}
const ATTR_INFO = {
  bone: ['根骨', '#ef7d57', (p) => '先天寿元、战力根本（寿元上限 ' + lifeMax(p) + ' 岁）'],
  mind: ['神识', '#73eff7', (p) => '修炼速度、突破几率、炼丹炼器、参悟'],
  qi: ['灵气', '#a7f070', (p) => '术法威力 ' + spellPower(p) + '，灵力 ' + manaMax(p)],
  charm: ['魅力', '#f7a8c8', (p) => '机缘概率、人际关系、结为道侣'],
};

function drawSectPanel(ctx) {
  const sw = G.sw, sh = G.sh, ui = G.sui || { view: 'list' };
  ctx.fillStyle = 'rgba(10,10,30,0.7)'; ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, null);
  const pw = Math.min(720, sw - 12), px = (sw - pw) / 2, top = 6, bottom = sh - 6;
  drawPanel(ctx, px, top, pw, bottom - top);
  const tabs = [['list', '弟子'], ['library', '典籍'], ['world', '天下'], ['chron', '纪事']];
  const tw = Math.min(80, (pw - 60) / 4);
  tabs.forEach(([v, name], i) => {
    const on = ui.view === v || (v === 'list' && (ui.view === 'person' || ui.view === 'recruit'));
    drawButton(ctx, px + 8 + i * (tw + 4), top + 8, tw, 32, name, () => openSect(v), { active: on, color: on ? '#29366f' : '#262b44', size: 13 });
  });
  drawButton(ctx, px + pw - 44, top + 8, 36, 32, '✕', closeSect, { size: 14 });
  const cx = px + 14, cw = pw - 34, cy = top + 50, ch = bottom - cy - 8;
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(px + 6, cy - 4, pw - 12, ch + 8);
  beginScroll(ctx, 'sect_' + ui.view, cx, cy, cw, ch);
  const c = sectCursor(ctx, cx, cy + 4, cw);
  if (ui.view === 'list') sectViewList(c);
  else if (ui.view === 'person') sectViewPerson(c, sectPerson(ui.pid));
  else if (ui.view === 'recruit') sectViewRecruit(c);
  else if (ui.view === 'library') sectViewLibrary(c);
  else if (ui.view === 'world') sectViewWorld(c);
  else if (ui.view === 'chron') sectViewChron(c);
  else if (ui.view === 'peak') sectViewPeak(c, ui.peak);
  endScroll(ctx, c.y + 10);
}

function personStatus(p) {
  if (p.away && p.travel) return '在' + REGIONS[p.travel.region].name + '历练（还剩 ' + p.travel.left + ' 个月）';
  if (p.task === 'travel') return '正前往山门，准备下山历练';
  if (p.hurt > 0) return '养伤中（还需 ' + Math.ceil(p.hurt) + ' 天）';
  const loc = taskLoc(p);
  if (p.at !== loc) return '正前往' + sectLocName(loc);
  if (p.task === 'cult') return '在' + sectLocName(loc) + '闭关（速度 ×' + cultSpeed(p).toFixed(2) + '）';
  if (p.task === 'gather') { const d = DAOS[p.manual], r = d.rate(); return r > 0 ? '在' + sectLocName(loc) + '采集' + d.qiName + '（时机 ×' + (+r.toFixed(2)) + '）' : '在' + sectLocName(loc) + '等待时机：' + d.how; }
  if (p.task === 'alchemy') return G.sect.jobs.liandan ? '在炼丹峰看守丹炉' : '炼丹峰炉中无丹（点炼丹峰选丹方开炉）';
  if (p.task === 'forge') return G.sect.jobs.lianqi ? '在炼器峰锻造法器' : '炼器峰没有活计（点炼器峰选图谱）';
  if (p.task === 'fu') return G.sect.jobs.dianji ? '在典籍峰书写符箓' : '典籍峰没有符方（点典籍峰选符方）';
  return TASKS[p.task].name + '中（' + sectLocName(loc) + '）';
}
function progressText(p) {
  if (p.realm >= REALM_CAP) return '元婴';
  const n = realmNeed(p);
  return n.title + ' ' + (p.realm === 1 ? p.qiTaken + '/3 缕' : Math.floor(n.v) + '%');
}
function profText(p) { return p.prof ? PROFS[p.prof].name : '未定职业'; }
function daoShort(p) { const id = p.dao || p.manual; return id ? DAOS[id].name + (p.dao ? '' : '（修习中）') : '未修功法'; }

// ---------- 弟子名录 ----------
function sectViewList(c) {
  const S = G.sect, ctx = c.ctx;
  cLine(c, S.name + '　声望 ' + Math.floor(S.fame) + '　门下弟子 ' + discipleCount() + '/' + sectCapacity() + '　每月月俸 ' + S.people.filter((q) => !q.head).reduce((s, q) => s + STIPEND[q.realm], 0) + ' 灵石', 13, '#ffcd75', true);
  if (S.cands.length) cButtons(c, [{ label: '开山收徒：' + S.cands.length + ' 位少年在山门外等候 ▶', color: '#1f5e3a', onClick: () => openSect('recruit') }], 34);
  else cLine(c, '每年正月开山收徒（还有 ' + (12 - sectCal().month + 1) + ' 个月）', 12, '#94b0c2');
  const people = S.people.slice().sort((a, b) => (b.head - a.head) || b.realm - a.realm || b.age - a.age);
  for (const p of people) {
    const y = c.y, h = 62, ready = p.realm < REALM_CAP && realmNeed(p).ready && !p.away;
    drawButton(ctx, c.x, y, c.w, h, '', () => openSect('person', { pid: p.id }), { color: ready ? '#3a3a1e' : '#262b44', active: ready });
    ctx.fillStyle = REALM_ROBE[p.realm]; ctx.fillRect(c.x + 6, y + 6, 6, h - 12);
    drawText(ctx, (p.head ? '【掌门】' : '') + p.name, c.x + 20, y + 15, 14, p.head ? '#ffcd75' : '#f4f4f4');
    ctx.font = 'bold 14px ' + FONT;
    const nx = c.x + 28 + ctx.measureText((p.head ? '【掌门】' : '') + p.name).width;
    drawText(ctx, REALMS[p.realm] + '期 · ' + profText(p) + ' · ' + p.age + '/' + lifeMax(p) + '岁 · 战力 ' + personPower(p), nx, y + 15, 12, '#c8d6e5', 'left', false);
    const did = p.dao || p.manual;
    drawText(ctx, daoShort(p), c.x + 20, y + 35, 12, did ? DAOS[did].color : '#566c86', 'left', false);
    drawText(ctx, progressText(p), c.x + 120, y + 35, 12, ready ? '#a7f070' : '#73eff7', 'left', false);
    drawText(ctx, personStatus(p), c.x + 20, y + 52, 11, p.hurt > 0 ? '#ef7d57' : '#94b0c2', 'left', false);
    if (ready) drawText(ctx, '可突破！', c.x + c.w - 10, y + 15, 13, '#a7f070', 'right');
    else if (!p.head) drawText(ctx, '忠诚 ' + p.loy, c.x + c.w - 10, y + 15, 11, p.loy < 30 ? '#ef7d57' : '#94b0c2', 'right', false);
    c.y += h + 6;
  }
}

// ---------- 收徒 ----------
function sectViewRecruit(c) {
  const S = G.sect, ctx = c.ctx;
  cButtons(c, [{ label: '◀ 返回弟子名录', onClick: () => openSect('list') }]);
  cLine(c, '门下名额 ' + discipleCount() + '/' + sectCapacity() + '　（扩建宗门香鼎、修建洞府可以增加名额）', 13, '#ffcd75', true);
  cLine(c, '属性 1~10。根骨：寿元与战力；神识：修炼与突破；灵气：术法与灵力；魅力：机缘与人缘。天赋：选对应职业时战力、术法 +10%。', 12, '#94b0c2');
  if (!S.cands.length) { cLine(c, '今年没有人来拜师了。', 13); return; }
  for (const p of S.cands.slice()) {
    const y = c.y, h = 96;
    ctx.fillStyle = '#262b44'; ctx.fillRect(c.x, y, c.w, h);
    drawText(ctx, p.name + '　' + (p.sex === 'f' ? '女' : '男') + '，' + p.age + ' 岁　' + APT_TEXT[p.apt] + '（宜' + PROFS[p.apt].name + '）', c.x + 10, y + 14, 14, '#f4f4f4');
    let ax = c.x + 10;
    for (const k of ['bone', 'mind', 'qi', 'charm']) {
      const [nm, col] = ATTR_INFO[k];
      drawText(ctx, nm + ' ' + p[k], ax, y + 36, 12, col, 'left', false);
      pips(ctx, ax, y + 46, p[k], col);
      ax += Math.min(140, (c.w - 140) / 4);
    }
    const sum = p.bone + p.mind + p.qi + p.charm;
    drawText(ctx, sum >= 28 ? '资质：天纵奇才' : sum >= 24 ? '资质：上佳' : sum >= 19 ? '资质：中平' : '资质：愚钝', c.x + 10, y + 74, 12, sum >= 24 ? '#ffcd75' : '#94b0c2', 'left', false);
    drawButton(ctx, c.x + c.w - 150, y + 58, 140, 32, '收入门下（灵石 ' + p.cost + '）', () => recruit(p), { color: '#1f5e3a', size: 12, dim: G.res.lingshi < p.cost || discipleCount() >= sectCapacity() });
    c.y += h + 8;
  }
}

// ---------- 人物详情 ----------
function sectViewPerson(c, p) {
  const S = G.sect, ctx = c.ctx, ui = G.sui;
  cButtons(c, [{ label: '◀ 返回弟子名录', onClick: () => openSect('list') }]);
  if (!p) { cLine(c, '此人已不在门中。', 14); return; }
  drawText(ctx, (p.head ? '【掌门】' : '') + p.name, c.x, c.y + 10, 18, p.head ? '#ffcd75' : '#f4f4f4');
  c.y += 26;
  cLine(c, REALMS[p.realm] + '期 ' + profText(p) + '　' + (p.sex === 'f' ? '女' : '男') + '　' + p.age + ' 岁（寿元 ' + lifeMax(p) + '）' + (p.head ? '' : '　忠诚 ' + p.loy) + (p.mate ? '　道侣：' + ((sectPerson(p.mate) || {}).name || '') : ''), 13, '#c8d6e5');
  cLine(c, '天赋：' + APT_TEXT[p.apt] + '（宜' + PROFS[p.apt].name + '）', 12, '#94b0c2');
  for (const k of ['bone', 'mind', 'qi', 'charm']) {
    const [nm, col, f] = ATTR_INFO[k];
    drawText(ctx, nm + ' ' + p[k], c.x, c.y + 8, 13, col);
    pips(ctx, c.x + 62, c.y + 4, p[k], col);
    if (c.w >= 480) { drawText(ctx, f(p), c.x + 160, c.y + 8, 12, '#94b0c2', 'left', false); c.y += 22; }
    else { c.y += 18; cLine(c, f(p), 11, '#94b0c2', false, 8); } // 手机：说明换到下一行
  }
  cLine(c, '战力 ' + personPower(p) + '　术法 ' + spellPower(p) + '　灵力 ' + manaMax(p) + '　修炼速度 ×' + cultSpeed(p).toFixed(2) + (p.realm < REALM_CAP ? '　突破几率 ' + Math.round(breakChance(p) * 100) + '%' : ''), 13, '#f4f4f4', true);
  const bufs = [];
  if (p.buf.zhuji) bufs.push('筑基丹药力 ×' + p.buf.zhuji.toFixed(2));
  if (p.buf.pojing) bufs.push('破境丹药力 ×' + p.buf.pojing.toFixed(2));
  if (p.buf.peiyuan > 0) bufs.push('培元丹（' + p.buf.peiyuan + ' 天）');
  if (p.buf.juling > 0) bufs.push('聚灵符（' + p.buf.juling + ' 天）');
  if (p.comeback) bufs.push('阴尽阳生 +' + Math.round(p.comeback * 100) + '%');
  if (p.weapon) bufs.push('法器「' + p.weapon.name + '」+' + weaponPower(p));
  if (p.beast) bufs.push('灵兽「' + p.beast.name + '」Lv' + p.beast.lv + ' 战力 +' + beastPower(p));
  if (bufs.length) cLine(c, '加持：' + bufs.join('、'), 12, '#a7f070');
  cLine(c, '状态：' + personStatus(p), 12, p.hurt > 0 ? '#ef7d57' : '#73eff7');

  // 修炼
  const n = realmNeed(p);
  cHead(c, '修炼 · ' + REALMS[p.realm] + (p.realm < REALM_CAP ? ' → ' + REALMS[p.realm + 1] : ''));
  cLine(c, n.title + '：' + n.text, 12, '#c8d6e5');
  if (p.realm < REALM_CAP) cBar(c, n.v, n.max, n.ready ? '#a7f070' : '#41a6f6', p.realm === 1 ? '已服真气 ' + p.qiTaken + '/3' : Math.floor(n.v) + '/' + n.max);
  if (n.extra) cLine(c, n.extra, 12, '#94b0c2');
  if (p.realm >= 3) cLine(c, '金丹：' + danName(p.dan) + (p.sht ? '　神通：「' + p.sht + '」（' + ST_EFFECT[p.prof || 'none'] + '）' : ''), 12, '#ffcd75');
  if (p.realm < REALM_CAP && !p.away) cButtons(c, [{ label: '冲击' + REALMS[p.realm + 1] + '（' + Math.round(breakChance(p) * 100) + '%）', dim: !n.ready, color: '#b13e53', onClick: () => askConfirm('让 ' + p.name + ' 冲击' + REALMS[p.realm + 1] + '？成功率 ' + Math.round(breakChance(p) * 100) + '%，失败会受伤、修为倒退。', () => attemptBreak(p)) }], 34);
  if ((p.realm === 1 || p.realm === 2) && !p.away) {
    const max = p.realm === 1 ? 3 : 9, ids = DAO_IDS.filter((k) => S.qi[k] > 0);
    if (!p.dao) cLine(c, '服用真气（第一缕必须是功法对应的' + (p.manual ? DAOS[p.manual].qiName : '真气') + '，用来定道）：', 12, '#94b0c2');
    else cLine(c, '服用真气（' + p.qiTaken + '/' + max + '）：同道途保持精纯；同属性算半分；其他道途会降低精纯。', 12, '#94b0c2');
    if (!ids.length) cLine(c, '宗门没有存下真气（派弟子去采气）。', 12, '#566c86');
    cButtons(c, ids.map((k) => {
      const tag = !p.dao ? '' : k === p.dao ? ' · 同道' : daoGroup(k) === daoGroup(p.dao) ? ' · 同属' : ' · 杂气';
      return { label: DAOS[k].qiName + ' ×' + S.qi[k] + tag, dim: !canTakeQi(p, k), color: k === (p.dao || p.manual) ? '#1f5e3a' : '#29366f', onClick: () => takeQi(p, k) };
    }));
  }

  // 道途与功法
  cHead(c, '道途与功法');
  const did = p.dao || p.manual;
  if (did) {
    const d = DAOS[did];
    cLine(c, (p.dao ? '道途：' : '修习中：') + daoLabel(did) + '　' + d.concept, 12, d.color, true);
    cLine(c, '道途特性：' + d.path.text + (p.dao ? '（随精纯度发挥 ' + Math.round((0.5 + 0.5 * daoPurity(p)) * 100) + '%）' : '（定道后生效）'), 12, '#f4f4f4');
    cLine(c, '功法 ' + d.gf.name + '：' + d.gf.text, 12, '#ffcd75');
    cLine(c, '采气之法（' + d.qiName + '）：' + d.how + '　今日时机 ×' + (+d.rate().toFixed(2)), 12, d.color);
    if (p.dao) {
      const pur = daoPurity(p);
      cBar(c, pur, 1, pur >= 0.85 ? '#a7f070' : pur >= 0.6 ? '#ffcd75' : '#ef7d57', '道途精纯 ' + Math.round(pur * 100) + '%');
      cLine(c, '越精纯：道途特性越完整、突破几率越高、突破后提升越大、金丹品阶越高。', 11, '#94b0c2');
      const mix = Object.keys(p.mix || {}).filter((k) => k !== p.dao && p.mix[k] > 0);
      if (mix.length) cLine(c, '沾染的杂气：' + mix.map((k) => DAOS[k].name + ' ' + (+p.mix[k].toFixed(1))).join('、'), 11, '#94b0c2');
    }
  } else cLine(c, '尚未修习功法。筑基之后需按功法记载采集真气才能继续进境。', 12, '#ef7d57');
  if (!p.dao && S.manuals.length) {
    cLine(c, '可修习的功法（服下第一缕真气后就不能再换）：', 12, '#94b0c2');
    cButtons(c, S.manuals.map((id) => ({ label: (p.manual === id ? '✔ ' : '') + DAOS[id].gf.name + '·' + DAOS[id].name, active: p.manual === id, onClick: () => learnManual(p, id) })));
  }

  // 职业
  cHead(c, '职业');
  if (p.prof) {
    const syn = synergy(p);
    cLine(c, PROFS[p.prof].name + '：' + PROFS[p.prof].desc, 12, '#f4f4f4');
    if (did) cLine(c, '与' + DAOS[did].name + '道途的契合：' + SYN_NAME[syn] + '（战力 ' + (syn >= 0 ? '+' : '') + syn * 8 + '%，突破 ' + (syn >= 0 ? '+' : '') + syn * 3 + '%）　将来神通形态：' + ST_FORMS[p.prof][0].replace('{a}', DAOS[did].img[0]).replace('{b}', DAOS[did].img[1]) + ' 之类', 12, syn > 0 ? '#a7f070' : syn < 0 ? '#ef7d57' : '#c8d6e5');
  } else cLine(c, '尚未选定职业。金丹之前可以选择或更换，金丹后定型。', 12, '#ef7d57');
  if (p.realm < 3 && !p.away) {
    cButtons(c, PROF_IDS.map((k) => {
      const tmp = { prof: k, dao: p.dao, manual: p.manual }, s = synergy(tmp);
      return { label: PROFS[k].name + (p.apt === k ? '★' : '') + (did ? '·' + SYN_NAME[s] : ''), active: p.prof === k, color: p.prof === k ? '#1f5e3a' : s > 0 ? '#29366f' : s < 0 ? '#3a2030' : '#333c57', onClick: () => setProf(p, k) };
    }));
    cLine(c, '★ = 天赋所在；后面是与当前道途的契合度。', 11, '#94b0c2');
  }

  // 差事
  if (!p.away) {
    cHead(c, '差事');
    cButtons(c, TASK_ORDER.map((t) => ({
      label: TASKS[t].name, active: p.task === t, color: p.task === t ? '#1f5e3a' : '#333c57',
      onClick: () => assignTask(p, t),
    })));
    cLine(c, TASKS[p.task] ? TASKS[p.task].desc : '', 12, '#94b0c2');
    cHead(c, '外出历练');
    if (p.hurt > 0) cLine(c, '身上有伤，不宜下山。', 12, '#ef7d57');
    else if (p.task === 'travel') cLine(c, '正准备下山……', 12);
    else {
      cLine(c, '选择去处（敌人会随年份变强，也各有道途属性；战力不足可能负伤甚至陨落）', 12, '#94b0c2');
      cButtons(c, Object.keys(REGIONS).map((k) => ({
        label: REGIONS[k].name + (S.secret && S.secret.region === k ? '（秘境）' : ''), active: ui.region === k, color: ui.region === k ? '#29366f' : '#333c57',
        onClick: () => { ui.region = k; },
      })));
      if (ui.region) {
        const R = REGIONS[ui.region];
        cLine(c, R.name + '：' + R.desc + '　凶险 ' + '★'.repeat(Math.round(R.danger * 3)), 12, '#c8d6e5');
        cButtons(c, [3, 6, 12].map((m) => ({ label: '历练 ' + m + ' 个月', color: '#b13e53', onClick: () => { assignTask(p, 'travel', { region: ui.region, months: m }); ui.region = null; } })));
      }
    }
  }
  // 丹药 / 符箓 / 法器（显示契合度）
  cHead(c, '丹药 · 符箓 · 法器');
  cLine(c, '物品都带道途属性：同道途 100%，同属性 85%，同气 70%，相生 60%，无关 50%，相克 30%（无属性物品 60%）。', 11, '#94b0c2');
  const pills = Object.keys(S.items).filter((k) => S.items[k] > 0);
  if (pills.length && !p.away) cButtons(c, pills.map((k) => { const s = splitKey(k); return { label: '服' + itemName(s.id, s.dao, PILLS) + '×' + S.items[k] + '（' + factorText(itemFactor(p, s.dao), s.dao, p) + '）', color: '#1f5e3a', onClick: () => usePill(p, k) }; }));
  else cLine(c, '没有可用的丹药（在炼丹峰炼制）。', 12, '#566c86');
  const jl = Object.keys(S.talis).filter((k) => S.talis[k] > 0 && splitKey(k).id === 'juling');
  if (jl.length && !p.away) cButtons(c, jl.map((k) => { const s = splitKey(k); return { label: '贴' + itemName('juling', s.dao, TALIS) + '×' + S.talis[k] + '（×' + talisK(p, s.dao).toFixed(2) + '）', color: '#29366f', onClick: () => useJuling(p, k) }; }));
  const tg = Object.keys(S.talis).filter((k) => S.talis[k] > 0 && splitKey(k).id !== 'juling');
  if (tg.length) cLine(c, '攻伐符、护身符在战斗时自动挑最契合的使用。宗门现有：' + tg.map((k) => { const s = splitKey(k); return itemName(s.id, s.dao, TALIS) + '×' + S.talis[k]; }).join('、'), 11, '#c8d6e5');
  cLine(c, '法器：' + (p.weapon ? '「' + p.weapon.name + '」' + (p.weapon.dao ? DAOS[p.weapon.dao].name + '属 ' : '') + '基础 +' + p.weapon.power + ' → 实际 +' + weaponPower(p) : '无'), 12, '#c8d6e5');
  if (S.weapons.length && !p.away) cButtons(c, S.weapons.map((w, i) => ({ label: '祭炼「' + w.name + '」' + (w.dao ? DAOS[w.dao].name : '无属') + ' +' + Math.round(w.power * itemFactor(p, w.dao)), onClick: () => equipWeapon(p, i) })));
  // 人际
  const rels = Object.keys(p.rel).map((id) => [sectPerson(+id), p.rel[id]]).filter((x) => x[0]);
  if (rels.length) {
    cHead(c, '人际');
    cLine(c, rels.map(([q, v]) => { const a = daoAffinity(p, q); return q.name + '：' + (q.id === p.mate ? '道侣' : v >= 50 ? '知己' : v > 0 ? '交好' : v <= -40 ? '死对头' : '不和') + '（' + v + (a.text ? '，' + a.text : '') + '）'; }).join('　'), 12, '#f7a8c8');
  }
  cHead(c, '生平');
  if (!p.log.length) cLine(c, '尚无记载。', 12, '#94b0c2');
  for (const ln of p.log.slice(0, 20)) cLine(c, ln, 12, '#c8d6e5');
}

// ---------- 山峰 ----------
function sectViewPeak(c, id) {
  const S = G.sect, L = sectLoc(id), ctx = c.ctx;
  drawText(ctx, L.name + (PEAKS[id] ? '　Lv.' + S.peaks[id].lv : ''), c.x, c.y + 10, 18, '#ffcd75');
  c.y += 28;
  cLine(c, L.desc || '', 13, '#c8d6e5');
  if (PEAKS[id]) {
    const lv = S.peaks[id].lv;
    const eff = { zhufeng: '在此闭关速度 +' + lv * 10 + '%', zongzhu: '掌门修炼 ×1.5，再 +' + lv * 10 + '%；掌门突破 +' + lv * 2 + '%', liandan: '炼丹速度 +' + lv * 10 + '%，成丹率 +' + lv * 5 + '%', lianqi: '炼器速度、法器威力提升' + (lv >= 3 ? '；可炼灵器' : '（3 级可炼灵器）'), yanwu: '演武收益 +' + lv * 10 + '%', dianji: '参悟、制符速度 +' + lv * 10 + '%' }[id];
    cLine(c, '当前效果：' + eff, 12, '#a7f070');
    if (lv < 5) {
      const cost = peakUpCost(id), ok = canAfford(cost);
      const y = c.y;
      drawButton(ctx, c.x, y, 240, 34, '', () => upgradePeak(id), { dim: !ok, color: '#29366f' });
      drawText(ctx, '扩建', c.x + 26, y + 17, 13, ok ? '#f4f4f4' : '#94b0c2', 'center');
      drawCost(ctx, cost, c.x + 140, y + 17, 180, 12);
      c.y += 44;
    } else cLine(c, '已扩建到最高级', 12, '#ffcd75');
  }
  const task = PEAK_TASK[id];
  if (task) {
    const job = S.jobs[id], book = CRAFT[task].book(), crafters = S.people.filter((q) => !q.away && q.task === task);
    const word = { alchemy: ['丹炉', '炼丹', '丹方', '炼'], forge: ['锻炉', '炼器', '图谱', '炼'], fu: ['符案', '制符', '符方', '笔'] }[task];
    cHead(c, word[0]);
    cLine(c, word[1] + '弟子：' + (crafters.length ? crafters.map((q) => q.name + (q.dao ? '（' + DAOS[q.dao].name + '）' : '')).join('、') : '无（在弟子面板把差事设为「' + TASKS[task].name + '」）'), 12, crafters.length ? '#c8d6e5' : '#ef7d57');
    const lead = leadCrafter(task);
    cLine(c, '成品会带上主' + word[3] + '弟子的道途属性' + (lead ? '：现在由 ' + lead.name + '（' + (lead.dao ? DAOS[lead.dao].name : '无道途 → 无属性') + '）主' + word[3] : '（主' + word[3] + '弟子要先到场）'), 12, '#94b0c2');
    if (job) {
      cLine(c, '正在制作「' + itemName(job.id, job.dao, book) + '」', 13, '#ffcd75', true);
      cBar(c, job.work, job.days, '#ef7d57', Math.floor(job.work) + '/' + job.days + ' 工');
    } else {
      cLine(c, '选择' + word[2] + '开工（材料立即扣除，弟子每天出工推进进度）：', 12, '#94b0c2');
      for (const k in book) {
        const r = book[k], locked = r.lv && S.peaks.lianqi.lv < r.lv, ok = canAfford(r.cost) && !locked;
        const y = c.y;
        drawButton(ctx, c.x, y, c.w, 46, '', () => startJob(id, k), { dim: !ok, color: '#333c57' });
        drawText(ctx, r.name, c.x + 10, y + 14, 13, ok ? '#ffcd75' : '#94b0c2');
        drawText(ctx, r.desc + '　约 ' + r.days + ' 工', c.x + 10, y + 33, 11, '#c8d6e5', 'left', false);
        drawCost(ctx, r.cost, c.x + c.w - 70, y + 23, 120, 12);
        c.y += 52;
      }
    }
  }
  const here = S.people.filter((q) => !q.away && taskLoc(q) === id);
  cHead(c, '在此的门人');
  if (!here.length) cLine(c, '无', 12, '#94b0c2');
  cButtons(c, here.map((q) => ({ label: q.name + ' · ' + REALMS[q.realm] + ' · ' + TASKS[q.task].name, onClick: () => openSect('person', { pid: q.id }) })));
  const qiHere = DAO_IDS.filter((k) => DAOS[k].loc === id);
  if (qiHere.length) {
    cHead(c, '在此可采的真气');
    for (const k of qiHere) cLine(c, DAOS[k].qiName + '（今日 ×' + (+DAOS[k].rate().toFixed(2)) + '）：' + DAOS[k].how + (S.manuals.includes(k) ? '' : '（本门尚无对应功法）'), 12, S.manuals.includes(k) ? DAOS[k].color : '#566c86');
  }
}

// ---------- 典籍（分页：功法 / 道途总览 / 库存 / 生克） ----------
function sectViewLibrary(c) {
  const S = G.sect, ctx = c.ctx, ui = G.sui;
  ui.sub = ui.sub || 'gf';
  cButtons(c, [['gf', '本门功法'], ['all', '道途总览'], ['store', '库存'], ['rule', '生克与职业']].map(([k, name]) => ({ label: name, active: ui.sub === k, color: ui.sub === k ? '#29366f' : '#333c57', onClick: () => { ui.sub = k; G.scroll.sect_library = 0; } })));
  if (ui.sub === 'gf') {
    cHead(c, '藏经阁功法（' + S.manuals.length + '/' + DAO_IDS.length + '）');
    cLine(c, '今日：' + MONTH_CN[sectCal().month - 1] + '（' + monthBranch() + '月）' + dayCN(sectCal().day) + ' ' + ganzhiText() + '，' + SEASON_CN[sectSeason()] + '季，' + { clear: '晴', rain: '雨', storm: '雷雨', snow: '雪' }[S.weather] + (fullMoon() ? '，满月' : '') + '。天干道途逢本日干、地支道途逢本月建最旺。', 12, '#73eff7');
    for (const id of S.manuals) {
      const d = DAOS[id], who = S.people.filter((p) => p.manual === id).map((p) => p.name);
      cLine(c, d.gf.name + '　' + daoLabel(id) + '　' + '◆'.repeat(d.rare), 13, d.color, true);
      cLine(c, d.concept, 12, '#c8d6e5', false, 12);
      cLine(c, '道途特性：' + d.path.text + '；功法特性：' + d.gf.text, 12, '#f4f4f4', false, 12);
      cLine(c, '采气：' + d.how + '（今日 ×' + (+d.rate().toFixed(2)) + '）', 12, d.color, false, 12);
      cLine(c, '修习者：' + (who.length ? who.join('、') : '无'), 11, '#94b0c2', false, 12);
      c.y += 4;
    }
  } else if (ui.sub === 'all') {
    cLine(c, '五行各五道：两道天干、一道八卦、两道地支；阴阳六道：三阳、三阴（按六气归入五行参与生克）。◆ 越多越珍稀。', 12, '#94b0c2');
    for (const el of ['jin', 'mu', 'shui', 'huo', 'tu', 'yang', 'yin']) {
      cHead(c, EL[el].name + (el === 'yang' ? ' · 三阳' : el === 'yin' ? ' · 三阴' : ' 行'), EL[el].color);
      for (const id of DAO_IDS.filter((k) => DAOS[k].el === el)) {
        const d = DAOS[id], have = S.manuals.includes(id);
        cLine(c, d.name + '（' + d.src + (d.qiEl ? '·六气属' + EL[d.qiEl].name : '') + '）' + '◆'.repeat(d.rare) + (have ? '　【本门已有】' : '') + '　' + d.concept, 12, have ? d.color : '#c8d6e5');
        cLine(c, '道途：' + d.path.text + '｜' + d.gf.name + '：' + d.gf.text, 11, '#94b0c2', false, 12);
      }
    }
  } else if (ui.sub === 'store') {
    cHead(c, '真气库存');
    const ks = DAO_IDS.filter((k) => S.qi[k] > 0);
    if (!ks.length) cLine(c, '暂无。', 12, '#566c86');
    for (let i = 0; i < ks.length; i += 2) {
      for (let j = 0; j < 2 && i + j < ks.length; j++) {
        const k = ks[i + j], x = c.x + j * c.w / 2;
        ctx.fillStyle = DAOS[k].color; ctx.beginPath(); ctx.arc(x + 8, c.y + 9, 6, 0, 7); ctx.fill();
        drawText(ctx, DAOS[k].qiName + ' × ' + S.qi[k], x + 20, c.y + 9, 13, '#f4f4f4');
      }
      c.y += 24;
    }
    const list = (store, book, title) => {
      cHead(c, title);
      const ks2 = Object.keys(store).filter((k) => store[k] > 0);
      if (!ks2.length) cLine(c, '暂无。', 12, '#566c86');
      for (const k of ks2) { const s = splitKey(k); cLine(c, itemName(s.id, s.dao, book) + ' × ' + store[k] + '　— ' + book[s.id].desc, 12, s.dao ? DAOS[s.dao].color : '#c8d6e5'); }
    };
    list(S.items, PILLS, '丹药');
    list(S.talis, TALIS, '符箓');
    cHead(c, '法器');
    if (!S.weapons.length) cLine(c, '暂无（在炼器峰炼制，或从历练中获得）', 12, '#566c86');
    for (const w of S.weapons) cLine(c, '「' + w.name + '」' + (w.dao ? DAOS[w.dao].name + '属' : '无属性') + '　战力 +' + w.power, 12, w.dao ? DAOS[w.dao].color : '#c8d6e5');
  } else {
    cHead(c, '五行生克');
    cLine(c, '相生：金生水、水生木、木生火、火生土、土生金。相克：金克木、木克土、土克水、水克火、火克金。', 12, '#f4f4f4');
    cLine(c, '同修为交手时，克制的一方战力 +30%，被克的一方相当于 -23%。阴阳六道按六气归入五行：太阳寒水、阳明燥金、少阳相火、太阴湿土、少阴君火、厥阴风木。', 12, '#c8d6e5');
    cHead(c, '阴阳消长');
    cLine(c, '夏日阳盛：阳性道途对阴性道途战力 +15%；冬日阴盛：阴性对阳性 +15%；春秋平衡。阳干（甲丙戊庚壬）、阳支（子寅辰午申戌）、乾震坎、三阳为阳；其余为阴。', 12, '#c8d6e5');
    cHead(c, '天干五合');
    cLine(c, '甲己合、乙庚合、丙辛合、丁壬合、戊癸合：相合的道途交手不论克制；修这两道的弟子更容易结为知己道侣。五行相生的弟子也更投缘，相克的容易起冲突。', 12, '#c8d6e5');
    cHead(c, '精纯');
    cLine(c, '服下的真气、用过的丹药符箓法器都会在修士身上留下道途印记。本命道途记 1 分、同属性记半分、其他不记分，得分比例就是精纯度。精纯越高：道途特性发挥越完整、突破几率越高（最多 +9%）、突破后战力根基提升越大、属性越容易增长、金丹品阶越高。', 12, '#c8d6e5');
    cHead(c, '职业与道途契合');
    for (const k of PROF_IDS) {
      const best = Object.keys(SYN[k]).filter((e) => SYN[k][e] === 2).map((e) => EL[e].name).join('');
      const bad = Object.keys(SYN[k]).filter((e) => SYN[k][e] < 0).map((e) => EL[e].name).join('');
      const sp = Object.keys(SYN_SPECIAL[k] || {}).map((d) => DAOS[d].name).join('、');
      cLine(c, PROFS[k].name + '：' + PROFS[k].desc, 12, '#ffcd75', true);
      cLine(c, '最契合：' + best + '属' + (sp ? '，以及' + sp : '') + (bad ? '；相悖：' + bad + '属' : '') + '。神通：' + ST_FORMS[k].join(' / ').replace(/\{a\}/g, '甲').replace(/\{b\}/g, '乙') + '（甲乙为道途意象）→ ' + ST_EFFECT[k], 11, '#c8d6e5', false, 12);
    }
  }
}

// ---------- 天下 ----------
function sectViewWorld(c) {
  const S = G.sect;
  cHead(c, '五域');
  for (const k in REGIONS) {
    const R = REGIONS[k], here = S.people.filter((p) => p.away && p.travel && p.travel.region === k).map((p) => p.name);
    cLine(c, R.name + '　凶险 ' + '★'.repeat(Math.round(R.danger * 3)) + (S.secret && S.secret.region === k ? '　【秘境开启中，还剩 ' + S.secret.left + ' 个月】' : ''), 13, '#ffcd75', true);
    cLine(c, R.desc + (here.length ? '　本门在此：' + here.join('、') : ''), 12, '#c8d6e5', false, 12);
  }
  cHead(c, '天下宗门');
  for (const o of S.sects) {
    const att = o.att >= 30 ? '交好' : o.att >= 0 ? '平淡' : o.att > -30 ? '冷淡' : '敌视';
    cLine(c, o.name + '（' + REGIONS[o.region].name + '）　主修' + DAOS[o.dao].name + '　最高' + REALMS[o.lv] + '期　势力 ' + o.power + '　对本门：' + att, 12, o.att < 0 ? '#ef7d57' : '#c8d6e5');
  }
  cHead(c, '天下大事');
  for (const e of S.world.slice(0, 60)) cLine(c, e.d + '　' + e.text, 12, '#c8d6e5');
}
function sectViewChron(c) {
  cHead(c, G.sect.name + '纪事');
  for (const e of G.sect.log.slice(0, 150)) cLine(c, e.d + '　' + e.text, 12, e.color);
}

// ---------- 地图点击 ----------
function sectWorldTap(wx, wy) {
  if (!G.sect) return false;
  const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
  let best = null, bd = 11;
  for (const p of G.sect.people) {
    if (p.away) continue;
    const d = Math.hypot(p.x - wx, p.y - 7 - wy);
    if (d < bd) { bd = d; best = p; }
  }
  if (best) { openSect('person', { pid: best.id }); return true; }
  if (inMap(tx, ty) && (G.bld[idx(tx, ty)] || G.nodes[idx(tx, ty)])) return false;
  for (const k in PEAKS) {
    const [x, y, w, h] = PEAKS[k].rect;
    if (tx >= x && tx < x + w && ty >= y - 1 && ty < y + h) { openSect('peak', { peak: k }); return true; }
  }
  for (const k in SECT_SPOTS) {
    const [x, y, w, h] = SECT_SPOTS[k].area;
    if (k !== 'gate' && tx >= x - 1 && tx <= x + w && ty >= y - 1 && ty <= y + h) { openSect('peak', { peak: k }); return true; }
  }
  if (Math.hypot(wx / T - SPRING_C[0], wy / T - SPRING_C[1]) < SPRING_R + 0.5) { openSect('peak', { peak: 'spring' }); return true; }
  return false;
}

// 地图上的文字：不管怎么缩放，屏幕上都是差不多大小
function sectLabel(ctx, text, x, y, color, px) {
  const z = G.cam.zoom, s = (px || 11) / z;
  ctx.font = 'bold ' + s + 'px ' + FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3 / z; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a1c2c';
  ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
}
// ---------- 地图上的动态效果 ----------
function drawSectWorld(ctx) {
  const S = G.sect, t = G.time;
  // 聚灵阵光环
  for (const b of G.buildings) {
    if (b.type !== 'julingzhen') continue;
    ctx.strokeStyle = 'rgba(115,239,247,' + (0.25 + 0.15 * Math.sin(t * 2)) + ')'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(b.cx, b.cy, 3.5 * T, 3.5 * T * 0.6, 0, 0, 7); ctx.stroke();
    for (let k = 0; k < 6; k++) {
      const a = t * 0.6 + k * Math.PI / 3, r = 2.2 * T;
      ctx.fillStyle = 'rgba(167,240,112,0.7)'; ctx.fillRect(b.cx + Math.cos(a) * r - 1, b.cy + Math.sin(a) * r * 0.6 - 1 - ((t * 8 + k * 5) % 10), 2, 2);
    }
  }
  // 丹炉烟、锻炉火星、符案灵光
  const fur = SECT_PROPS[0].rect, fx = (fur[0] + 1) * T, fy = (fur[1] + 0.4) * T, hot = !!S.jobs.liandan;
  for (let k = 0; k < (hot ? 6 : 3); k++) {
    const ph = (t * 0.5 + k / (hot ? 6 : 3)) % 1;
    ctx.fillStyle = hot ? 'rgba(255,205,117,' + (0.5 * (1 - ph)) + ')' : 'rgba(220,220,230,' + (0.35 * (1 - ph)) + ')';
    ctx.beginPath(); ctx.arc(fx + Math.sin(t + k * 2) * 3 * ph, fy - ph * 22, 2 + ph * 4, 0, 7); ctx.fill();
  }
  const fg = SECT_PROPS[1].rect, gx = (fg[0] + 0.6) * T, gy = (fg[1] + 1.3) * T;
  for (let k = 0; k < (S.jobs.lianqi ? 8 : 2); k++) {
    const ph = (t * 1.3 + k * 0.37) % 1;
    ctx.fillStyle = 'rgba(255,' + (150 + k * 10) + ',80,' + (1 - ph) + ')';
    ctx.fillRect(gx + Math.sin(k * 7.3) * 8 * ph, gy - ph * 16, 1, 1);
  }
  if (S.jobs.dianji) {
    const [ax, ay] = PEAKS.dianji.anchor;
    for (let k = 0; k < 5; k++) {
      const ph = (t * 0.6 + k / 5) % 1;
      ctx.fillStyle = 'rgba(255,220,120,' + (0.8 * (1 - ph)) + ')';
      ctx.fillRect((ax + 0.5) * T + Math.sin(k * 2.1 + t) * 6, (ay - 0.5) * T - ph * 18, 2, 3);
    }
  }
  // 灵泉灵雾
  for (let k = 0; k < 6; k++) {
    const ph = (t * 0.25 + k / 6) % 1, a = k * 1.7;
    ctx.fillStyle = 'rgba(160,230,255,' + (0.5 * Math.sin(ph * Math.PI)) + ')';
    ctx.fillRect((SPRING_C[0] + Math.cos(a) * 1.6) * T, (SPRING_C[1] + Math.sin(a) * 1.2) * T - ph * 14, 1.5, 1.5);
  }
  // 山峰名字
  for (const k in PEAKS) {
    const P = PEAKS[k], [hx, hy, hw] = P.hall;
    sectLabel(ctx, P.name + ' Lv' + S.peaks[k].lv, (hx + hw / 2) * T, hy * T - (P.tiers === 3 ? 34 : P.tiers === 2 ? 26 : 16), '#ffcd75', 13);
  }
  sectLabel(ctx, '灵泉', SPRING_C[0] * T, (SPRING_C[1] - 3) * T, '#73eff7');
  sectLabel(ctx, '灵松林', 44.5 * T, 21 * T, '#a7f070');
  // 弟子
  const ps = S.people.filter((p) => !p.away).sort((a, b) => a.y - b.y);
  for (const p of ps) {
    if (p.beast && !p.moving) { // 灵兽趴在主人脚边
      const col = EL[p.beast.el] ? EL[p.beast.el].color : '#f4f4f4', bx = p.x + 7 * (p.face < 0 ? -1 : 1), by = p.y;
      drawShadow(ctx, bx, by + 0.5, 8, 0.7);
      ctx.fillStyle = '#1a1c2c'; ctx.beginPath(); ctx.ellipse(bx, by - 2.5, 4, 2.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(bx, by - 2.5, 3.3, 2, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + 3 * (p.face < 0 ? -1 : 1), by - 4.5, 1.8, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(bx + 3.5 * (p.face < 0 ? -1 : 1), by - 5, 0.8, 0.8);
    }
    drawCultivator(ctx, p);
    if (p.task === 'gather' && p.at === taskLoc(p) && p.manual && DAOS[p.manual].rate() > 0) {
      const col = DAOS[p.manual].color;
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.8 + k / 4) % 1, a = k * 1.6 + p.id;
        ctx.fillStyle = col; ctx.globalAlpha = ph;
        ctx.fillRect(p.x + Math.cos(a) * 10 * (1 - ph), p.y - 8 + Math.sin(a) * 7 * (1 - ph), 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }
    const ready = p.realm < REALM_CAP && realmNeed(p).ready;
    if (G.cam.zoom >= 2.4 || ready || p.head) sectLabel(ctx, (p.head ? '掌门 ' : '') + p.name, p.x, p.y - 21, p.head ? '#ffcd75' : '#f4f4f4');
    if (ready) sectLabel(ctx, '▲可突破', p.x, p.y - 30 + Math.sin(t * 4) * 1.5, '#a7f070');
  }
}

// ---------- 屏幕层：云雾、仙鹤、雨雪落花、雷光 ----------
function sectAmbient(dt) {
  const F = G.sectFx || (G.sectFx = { parts: [], clouds: [], cranes: [], flash: 0 });
  const w = G.sect.weather;
  if (!F.clouds.length) for (let i = 0; i < 6; i++) F.clouds.push({ x: Math.random(), y: Math.random(), s: rand(0.6, 1.4), v: rand(0.004, 0.012) });
  for (const c of F.clouds) { c.x += c.v * dt; if (c.x > 1.3) { c.x = -0.3; c.y = Math.random(); } }
  const want = w === 'rain' || w === 'storm' ? 90 : w === 'snow' ? 60 : 16;
  while (F.parts.length < want) F.parts.push({ x: Math.random(), y: Math.random() * -0.2, v: rand(0.6, 1.2), ph: Math.random() * 6 });
  if (F.parts.length > want) F.parts.length = want;
  for (const p of F.parts) {
    const fast = w === 'rain' || w === 'storm';
    p.y += dt * (fast ? 0.9 : w === 'snow' ? 0.08 : 0.05) * p.v;
    p.x += dt * (fast ? 0.08 : 0.02 * Math.sin(G.time + p.ph));
    if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); }
  }
  if (w === 'storm') { if (Math.random() < dt * 0.25) F.flash = 0.35; }
  F.flash = Math.max(0, F.flash - dt);
  if (Math.random() < dt * 0.02 && F.cranes.length < 1) F.cranes.push({ x: -0.1, y: rand(0.15, 0.5), v: rand(0.04, 0.07), n: randInt(3, 5) });
  for (const c of F.cranes) c.x += c.v * dt;
  F.cranes = F.cranes.filter((c) => c.x < 1.2);
}
function drawSectScreen(ctx) {
  const F = G.sectFx;
  if (!F) return;
  const sw = G.sw, sh = G.sh, w = G.sect.weather, s = sectSeason();
  for (const c of F.clouds) {
    const x = c.x * sw, y = c.y * sh, r = 110 * c.s;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(240,245,255,0.13)'); g.addColorStop(1, 'rgba(240,245,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (const p of F.parts) {
    const x = p.x * sw, y = p.y * sh;
    if (w === 'rain' || w === 'storm') { ctx.fillStyle = 'rgba(180,200,255,0.45)'; ctx.fillRect(x, y, 1, 9); }
    else if (w === 'snow' || s === 3) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x, y, 2.5, 2.5); }
    else if (s === 0) { ctx.fillStyle = 'rgba(247,168,200,0.85)'; ctx.fillRect(x, y, 3, 2); }
    else if (s === 2) { ctx.fillStyle = 'rgba(239,160,70,0.85)'; ctx.fillRect(x, y, 3, 2); }
    else { ctx.fillStyle = 'rgba(200,255,160,0.5)'; ctx.fillRect(x, y, 1.5, 1.5); }
  }
  if (w === 'rain' || w === 'storm') { ctx.fillStyle = 'rgba(20,30,60,0.18)'; ctx.fillRect(0, 0, sw, sh); }
  if (F.flash > 0) { ctx.fillStyle = 'rgba(230,220,255,' + F.flash + ')'; ctx.fillRect(0, 0, sw, sh); }
  for (const c of F.cranes) {
    for (let k = 0; k < c.n; k++) {
      const x = c.x * sw - k * 22, y = c.y * sh + Math.abs(k - (c.n - 1) / 2) * 12, fl = Math.sin(G.time * 6 + k) * 4;
      ctx.strokeStyle = 'rgba(250,250,255,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 9, y - fl); ctx.lineTo(x, y); ctx.lineTo(x + 9, y - fl); ctx.stroke();
      ctx.fillStyle = '#b13e53'; ctx.fillRect(x + 1, y - 2, 2, 2);
    }
  }
}
