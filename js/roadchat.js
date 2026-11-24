// =============================================
//  公路求生 · 聊天室（「全民穿越公路求生」公共频道）
//  所有人都被传送到无尽的末日公路上，各开各的车，只能在频道里聊天、交易（系统传送）
//  数据：js/roadchatnpc.js（500 个普通幸存者）、js/roadchatvip.js / roadchatvip2.js（20 个重要角色）
//  聊天时钟 C.clk 用现实秒数：开车时跟着游戏走（加速也加速），打开聊天面板时也继续刷新
// =============================================
const RC_CHANNEL = '华夏区 · 第 7749 号公路频道';
let rcCache = null;
function rcPeople() {
  if (rcCache) return rcCache;
  const list = rcBuildNpcs(), byId = {};
  for (const n of list) byId[n.id] = n;
  const vips = RC_VIPS.map((v) => { const o = Object.assign({ vip: true }, v, { lines: {} }); for (const k in v.lines) o.lines[k] = v.lines[k].split('|'); byId[o.id] = o; return o; });
  rcCache = { list, vips, byId, total: list.length + vips.length };
  return rcCache;
}
function rcR(a) { return a[Math.floor(Math.random() * a.length)]; }
function rcC() { return rdR().chat; }
function rcEnsure() {
  const R = rdR();
  if (R.chat) return R.chat;
  R.chat = { msgs: [], q: [], clk: 0, nextIdle: 2, nextEv: 30 + Math.random() * 20, unread: 0, dead: {}, story: {}, me: avProfile().set ? avName() : '幸存者No.' + (10000 + Math.floor(Math.random() * 90000)), cd: {}, heat: 0, filter: 'all', ticker: true };
  const C = R.chat;
  rcSys('欢迎来到无尽公路。所有被传送者已被分配到平行的公路上，公共频道已开启。你的编号：' + C.me, 0);
  rcSys('提示：频道内可以交易，物品由系统传送；请谨防诈骗，任何「先付款」都要三思。', 0.5);
  for (let i = 0; i < 4; i++) rcQueue(rcPickSpeaker(), 'hello', { who: C.me }, 1.5 + i * 1.6);
  return C;
}
function rcAlive() { const P = rcPeople(), C = rcC(); return P.total - Object.keys(C.dead).length; }
function rcStamp() { const h = Math.floor(rdHour()), m = Math.floor((rdHour() % 1) * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }

// ---------- 说话 ----------
function rcFill(t, p, ctx) {
  const C = rcC();
  return t.replace(/\{(\w+)\}/g, (_, k) => {
    if (k === 'me') return C.me;
    if (k === 'who') return ctx.who || '有人';
    if (k === 'item') return ctx.item || '好东西';
    if (k === 'n') return String(ctx.n != null ? ctx.n : Math.floor(rdR().km * (0.6 + Math.random() * 0.8) + 20));
    if (p && p[k]) return p[k];
    return '';
  });
}
// 某个人对某个事件说一句话（返回文字）
function rcLine(p, ev, ctx) {
  const C = rcC();
  if (p.vip) {
    // 重要角色：闲聊时有时讲自己的故事（按顺序）
    if (ev === 'idle' && p.lines.story && Math.random() < 0.3) {
      const i = C.story[p.id] || 0;
      if (i < p.lines.story.length) { C.story[p.id] = i + 1; return rcFill(p.lines.story[i], p, ctx); }
    }
    const pool = p.lines[ev] || p.lines.idle;
    return rcFill(rcR(pool), p, ctx);
  }
  const A = RC_ARCH[p.arch].lines;
  let t;
  const r = Math.random();
  if (ev === 'idle') {
    // 闲聊：一半是用游戏内容拼出来的动态台词，其余是职业闲聊和性格台词
    if (r < 0.5) t = rcDynText('idle', p);
    else if (r < 0.65) t = rcR(RC_JOB_IDLE[p.job].split('|'));
    else t = rcR(A.idle.split('|'));
  } else if (RC_DYN[ev] && r < 0.2) t = rcDynText(ev, p);
  else { const pool = A[ev].split('|'); t = pool[rcR(p.lines[ev])]; }
  return rcFill(t, p, ctx);
}
function rcTagOf(p) { return p.vip ? (p.fakeTag || p.tag) : ''; }
function rcColorOf(p) { return p.vip ? p.color : '#c8d6e5'; }
function rcPush(m) {
  const R = rdR(), C = rcC();
  m.h = rcStamp(); m.at = C.clk;
  C.msgs.unshift(m);
  if (C.msgs.length > 150) C.msgs.length = 150;
  if (!(G.state === 'rpanel' && R.panel === 'chat')) C.unread = Math.min(99, C.unread + 1);
}
function rcSys(text, delay, act) { const C = rcC(); C.q.push({ at: C.clk + (delay || 0), sys: true, t: text, act }); }
// 排队：过几秒再说（像真人在打字）
function rcQueue(p, ev, ctx, delay, extra) {
  if (!p) return;
  const C = rcC();
  C.q.push(Object.assign({ at: C.clk + delay, pid: p.id, ev, ctx: ctx || {} }, extra || {}));
}
function rcDeliver(q) {
  const C = rcC(), P = rcPeople();
  if (q.sys) { rcPush({ sys: true, t: q.t, act: q.act }); return; }
  if (q.mine) { rcPush({ n: C.me, c: '#f4f4f4', t: q.t, mine: true }); return; }
  const p = P.byId[q.pid];
  if (!p || C.dead[p.id]) return;
  const text = q.text || (q.special ? rcFill(rcR(p.lines.special), p, q.ctx) : rcLine(p, q.ev, q.ctx));
  const m = { n: p.name, tag: rcTagOf(p), c: rcColorOf(p), t: text, pid: p.id, vip: !!p.vip };
  if (q.act) m.act = Object.assign({ until: C.clk + 150 }, q.act);
  rcPush(m);
  if (q.gift) rcGift(p);
  if (q.act && q.act.type === 'extort' && G.state === 'play') rcExtortDialog(m);
}

// ---------- 挑人 ----------
function rcPickSpeaker(filter) {
  const P = rcPeople(), C = rcC();
  for (let k = 0; k < 30; k++) {
    const p = P.list[Math.floor(Math.random() * P.list.length)];
    if (C.dead[p.id] || (filter && !filter(p))) continue;
    if (Math.random() > p.talk / 1.7) continue;
    return p;
  }
  return null;
}
function rcVip(role, notId) {
  const P = rcPeople(), C = rcC();
  const a = P.vips.filter((v) => (!role || v.role === role) && v.id !== notId && !C.dead[v.id]);
  return a.length ? rcR(a) : null;
}
function rcVipById(id) { return rcPeople().byId[id]; }

// ---------- 事件：发系统消息 + 安排大家的反应 ----------
function rcEvent(ev, ctx, opt) {
  if (!rdR()) return;
  const C = rcEnsure();
  ctx = ctx || {};
  opt = opt || {};
  let d = 2 + Math.random() * 2;
  const n = opt.count || (2 + Math.floor(Math.random() * 3));
  const used = {};
  for (let i = 0; i < n; i++) {
    const p = rcPickSpeaker((x) => !used[x.id] && x.name !== ctx.who);
    if (!p) continue;
    used[p.id] = true;
    rcQueue(p, ev, ctx, d);
    d += 3 + Math.random() * 5;
  }
  // 重要角色也来插一句
  const vipChance = opt.vipChance != null ? opt.vipChance : 0.55;
  if (Math.random() < vipChance) { const v = rcVip(opt.vipRole); if (v && v.name !== ctx.who) rcQueue(v, ev, ctx, 0.8 + Math.random() * d); }
  return d;
}
const RC_WEATHER_SYS = { dust: '【气象】沙尘暴正在影响本区域，能见度极低。', rad: '【气象】辐射风暴来袭！辐射指数急剧上升，请待在车内。', rain: '【气象】暴雨覆盖本区域，可以收集雨水。' };
function rcWeather(type) {
  const ev = type === 'storm' ? 'rain' : type;
  if (!RC_EVENTS[ev]) return;
  rcEnsure();
  rcSys(RC_WEATHER_SYS[ev], 0.3);
  rcEvent(ev, {}, { count: 2 + Math.floor(Math.random() * 3), vipChance: 0.3 });
}
// 你开出了好东西（全服公告）
function rcPlayerRare(p) {
  const C = rcEnsure();
  const item = '【' + RD_TIER_NAME[p.tier] + '】' + p.name;
  C.best = item;
  rcSys('【全服公告】恭喜幸存者「' + C.me + '」获得 ' + item + '！', 0.5);
  rcEvent('rare', { who: C.me, item }, { count: 3 + Math.floor(Math.random() * 3) });
  C.heat = (C.heat || 0) + 1;
  if (Math.random() < 0.5) rcQueue(rcVipById(rcR(['v_lei', 'v_jiu', 'v_he', 'v_she'])), 'rare', { who: C.me, item }, 6 + Math.random() * 4);
}

// 世界事件（每 35~85 秒一次）
function rcWorldEvent() {
  const R = rdR(), C = rcC(), P = rcPeople();
  const evs = [['horde', 2], ['drop', 1.6], ['death', 1.4], ['rare', 1.6], ['alien', R.km > 150 ? 1.4 : 0.5], ['raid', 1.5], ['rank', 1], ['trader', 2.2], ['scam', 0.8]];
  if (R.km > 60 && !C.extort && (C.gangAt == null)) evs.push(['extort', 0.5 + (C.heat || 0) * 0.4]);
  let tot = evs.reduce((s, e) => s + e[1], 0), r = Math.random() * tot, ev = evs[0][0];
  for (const e of evs) { r -= e[1]; if (r <= 0) { ev = e[0]; break; } }
  const someone = () => { const p = rcPickSpeaker(); return p ? p.name : '无名氏'; };
  const rareItem = () => { const ps = Object.values(RD_PARTS).filter((p) => p.tier >= 4); const p = rcR(ps); return '【' + RD_TIER_NAME[p.tier] + '】' + p.name; };
  if (ev === 'horde') {
    rcSys('【系统警报】一股辐射兽潮正在穿越公路，沿线幸存者请注意！', 0);
    rcEvent('horde');
    if (Math.random() < 0.45 && R.km > 3) { R.encT = Math.min(R.encT, 0.3); rcSys('【系统】兽潮的一部分正在向你靠近！', 4); }
  } else if (ev === 'drop') {
    rcSys('【全服空投】系统向所有公路投放了补给空投，你附近也有一个。先到先得！', 0, { type: 'drop', label: '抢空投', until: C.clk + 120 });
    rcEvent('drop');
  } else if (ev === 'death') {
    const v = rcPickSpeaker();
    if (!v) return;
    rcQueue(v, null, {}, 0, { text: rcR(['救命！车被围住了！谁来帮帮我！', '油没了……怪物在撞门……', '有人吗……我受伤了，药也没了', '车翻了，我出不去……', '它们进来了，进来了！', '如果我没了，帮我跟家里人说一声……']) });
    C.q.push({ at: C.clk + 5, die: v.id });
    rcSys('【系统】幸存者「' + v.name + '」的生命信号已消失。', 6);
    rcEvent('death', { who: v.name });
    C.q.forEach((q) => { if (q.ev === 'death' && !q.sys) q.at += 6; });
  } else if (ev === 'rare') {
    const who = Math.random() < 0.2 ? rcVip().name : someone(), item = rareItem();
    rcSys('【全服公告】恭喜幸存者「' + who + '」获得 ' + item + '！', 0);
    rcEvent('rare', { who, item });
  } else if (ev === 'alien') {
    rcSys('【系统】检测到来源不明的脉冲信号……信号特征与外星坠落舱一致。', 0);
    const v = rcVip('alien'), km = 4 + Math.floor(Math.random() * 9);
    if (v) rcQueue(v, null, { n: km }, 2.5, { special: true, act: { type: 'coord', label: '前往', km } });
    rcEvent('alien', {}, { vipChance: 0.6 });
  } else if (ev === 'raid') {
    const who = someone();
    rcSys('【快讯】「' + who + '」的车遭到铁颅帮洗劫，物资被抢光了。', 0);
    rcQueue(rcVip('warlord'), 'raid', { who }, 2 + Math.random() * 2);
    rcEvent('raid', { who }, { vipChance: 0.5 });
    if (Math.random() < 0.5) rcQueue(rcVipById('v_zhao'), 'raid', { who }, 8);
  } else if (ev === 'rank') {
    const top = Math.random() < 0.35 ? rcVip().name : someone(), n = Math.round(R.km * (1.3 + Math.random() * 0.8) + 120);
    const alive = rcAlive(), rank = Math.max(1, Math.round(alive * (1 - Math.min(0.995, R.km / (R.km + 400)))));
    rcSys('【里程榜】第一名：「' + top + '」' + n + ' 公里 · 你：' + Math.floor(R.km) + ' 公里，第 ' + rank + ' 名', 0);
    rcEvent('rank', { who: top, n: Math.floor(R.km * (0.5 + Math.random())) });
  } else if (ev === 'trader') {
    const v = rcVip('merchant');
    if (!v) return;
    rcQueue(v, null, {}, 0, { special: true, act: { type: 'trade', label: '交易' } });
    rcEvent('trader', { who: v.name }, { count: 2 + Math.floor(Math.random() * 3), vipChance: 0.3 });
  } else if (ev === 'scam') {
    const v = rcVipById('v_huang');
    const n = 15 + Math.floor(Math.random() * 26);
    rcQueue(v, null, { n }, 0, { special: true, act: { type: 'scam', label: '付款', n } });
    if (Math.random() < 0.6) rcQueue(rcPickSpeaker((p) => p.arch === 'gou' || p.arch === 'vet'), null, {}, 4, { text: rcR(['别信他，黄金眼是骗子', '又来了，上次骗了我二十个废料', '先付款的都是骗子，新人注意', '黄金眼，你还敢出来？']) });
  } else if (ev === 'extort') {
    const n = 20 + Math.floor(R.km / 25) + Math.floor(Math.random() * 15);
    C.extort = true;
    rcQueue(rcVipById('v_jiu'), null, {}, 0, { text: rcFill('{me}，你的车我拍到了，嘿嘿。老大，目标确认', null, {}) });
    rcQueue(rcVipById('v_lei'), null, { n }, 3, { special: true, act: { type: 'extort', label: '回应', n } });
    if (Math.random() < 0.5) rcQueue(rcVipById('v_hou'), null, {}, 8, { text: rcFill('{me}……我偷偷说，交了吧，他们真的会来的', null, {}) });
  }
}

// ---------- 时钟 ----------
function rcTick(dt) {
  const R = rdR();
  if (!R) return;
  const C = rcEnsure();
  C.clk += dt;
  // 送达排队的消息
  if (C.q.length) {
    C.q.sort((a, b) => a.at - b.at);
    while (C.q.length && C.q[0].at <= C.clk) {
      const q = C.q.shift();
      if (q.die) { C.dead[q.die] = 1; continue; }
      rcDeliver(q);
    }
  }
  // 闲聊
  if (C.clk >= C.nextIdle) {
    C.nextIdle = C.clk + 12 + Math.random() * 16; // 平均 20 秒一条闲聊
    const p = Math.random() < 0.08 ? rcVip() : rcPickSpeaker();
    if (p) rcQueue(p, 'idle', {}, 0);
    // 偶尔有人接话
    if (p && Math.random() < 0.12) { const q = rcPickSpeaker(); if (q) rcQueue(q, null, {}, 3 + Math.random() * 4, { text: '@' + p.name + ' ' + rcR(RC_REPLY) }); }
  }
  // 世界事件（平均两分半一次）
  if (C.clk >= C.nextEv) { C.nextEv = C.clk + 150 + Math.random() * 120; rcWorldEvent(); }
  // 天亮 / 入夜
  const h = rdHour();
  if (C.lastH != null) {
    if (C.lastH < 6 && h >= 6) { rcSys('【系统】第 ' + rdDay() + ' 天。频道存活 ' + rcAlive() + ' / ' + rcPeople().total + ' 人。', 0); if (Math.random() < 0.6) rcEvent('dawn', {}, { count: 1 + Math.floor(Math.random() * 2), vipChance: 0.1 }); }
    if (C.lastH < 20 && h >= 20) { rcSys('【系统】夜幕降临，夜间怪物活跃度上升。', 0); if (Math.random() < 0.6) rcEvent('night', {}, { count: 1 + Math.floor(Math.random() * 2), vipChance: 0.1 }); }
  }
  C.lastH = h;
  // 勒索没理会 = 拒绝
  for (const m of C.msgs) if (m.act && m.act.type === 'extort' && !m.act.used && C.clk > m.act.until) { m.act.used = true; rcExtortRefuse(true); }
  // 铁颅帮来找麻烦
  if (C.gangAt != null && R.t >= C.gangAt && G.state === 'play') { C.gangAt = null; rcGangAttack(); }
}

// ---------- 你在频道里发言 ----------
const RC_MY_LINES = {
  hello: ['大家好，我是{me}，刚上路，请多关照！', '有人吗？新人报到！', '大家好！我开着一辆小破车，在往前开', '各位好，{me}，还活着'],
  brag: ['刚开出了{item}，运气爆棚！', '看我的新装备：{item}！', '我已经开了 {n} 公里了！', '今天运气不错，{item}到手'],
};
function rcSend(kind) {
  const C = rcEnsure(), R = rdR();
  if (C.cd[kind] && C.clk < C.cd[kind]) return;
  C.cd[kind] = C.clk + 25;
  let text, ctx = { who: C.me };
  if (kind === 'hello') text = rcFill(rcR(RC_MY_LINES.hello), null, ctx);
  else if (kind === 'help') {
    const need = ['food', 'water', 'med', 'ammo', 'fuel'].sort((a, b) => G.res[a] - G.res[b])[0];
    C.need = need;
    text = rcR(['求助！' + RD_RES[need].name + '快没了，谁能帮帮我……', '有没有好心人，' + RD_RES[need].name + '只剩 ' + Math.floor(G.res[need]) + ' 了', '救急！缺' + RD_RES[need].name + '，在线等']);
  } else {
    const item = C.best || rcBestOwned();
    ctx.item = item; ctx.n = Math.floor(R.km);
    text = item && Math.random() < 0.7 ? rcFill(rcR(RC_MY_LINES.brag.slice(0, 2).concat(RC_MY_LINES.brag[3])), null, ctx) : rcFill(RC_MY_LINES.brag[2], null, ctx);
    C.heat = (C.heat || 0) + 0.5;
  }
  C.q.push({ at: C.clk, mine: true, t: text });
  rcEvent(kind, ctx, { count: 3 + Math.floor(Math.random() * 3), vipChance: kind === 'help' ? 0 : 0.5 });
  if (kind === 'help') {
    // 友好角色送物资（每天最多一次），骗子和放贷的也会来
    if (C.giftDay !== rdDay() && Math.random() < 0.75) { C.giftDay = rdDay(); rcQueue(rcVip('friend'), null, {}, 3 + Math.random() * 3, { special: true, gift: true }); }
    else rcQueue(rcVip('friend'), 'help', ctx, 3);
    const sn = 15 + Math.floor(Math.random() * 20);
    if (Math.random() < 0.35) rcQueue(rcVipById('v_huang'), null, { n: sn }, 7, { special: true, act: { type: 'scam', label: '付款', n: sn } });
    else if (Math.random() < 0.4) rcQueue(rcVipById(rcR(['v_mo', 'v_she', 'v_lei', 'v_hou'])), 'help', ctx, 7);
  }
  if (kind === 'brag' && Math.random() < 0.5) rcQueue(rcVipById(rcR(['v_lei', 'v_jiu', 'v_he', 'v_she', 'v_qian', 'v_hong'])), 'brag', ctx, 5);
}
function rcBestOwned() {
  const R = rdR(), ids = R.inv.concat(Object.values(R.ext), R.wpn, R.inner.map((it) => it.id), [R.hand, R.suit]).filter((id) => id && RD_PARTS[id]);
  if (!ids.length) return null;
  const p = ids.map((id) => RD_PARTS[id]).sort((a, b) => b.tier - a.tier)[0];
  return p.tier >= 3 ? '【' + RD_TIER_NAME[p.tier] + '】' + p.name : null;
}

// ---------- 角色互动 ----------
function rcGift(p) {
  const C = rcC();
  const k = C.need || ['food', 'water', 'med', 'ammo', 'fuel'].sort((a, b) => G.res[a] - G.res[b])[0];
  const n = rdGain(k, (k === 'ammo' ? 12 : 4) + Math.floor(Math.random() * 6));
  if (n > 0) { rdLog(p.name + '通过系统传送送来了 ' + RD_RES[k].name + ' +' + n, '#a7f070'); showBanner('收到系统传送', p.name + '送来 ' + RD_RES[k].name + ' +' + n, 3, '#a7f070'); sfx('coin'); rdR().me.mood = Math.min(100, rdR().me.mood + 10); }
}
function rcAct(m) {
  const R = rdR(), C = rcC(), a = m.act;
  if (!a || a.used || C.clk > a.until) return;
  if (a.type === 'trade') {
    a.used = true;
    rdOpenTrade(null);
    if (R.trade) R.trade.name = m.n + '（系统传送）';
    if (G.scroll) G.scroll.rpanel = 0;
  } else if (a.type === 'coord') {
    a.used = true;
    const km = a.km || 6;
    R.sites.push({ type: 'alien', km: R.km + km, seed: Math.floor(Math.random() * 1e6), searched: false, danger: 0.6 });
    rdLog(m.n + '发来坐标：前方 ' + km + ' 公里处有外星坠落舱', '#73eff7');
    showBanner('坐标已标记', '前方 ' + km + ' 公里：外星坠落舱', 3, '#73eff7');
    rcQueue(rcPeople().byId[m.pid], null, {}, 1.5, { text: rcR(['小心点，' + C.me, '去吧，' + C.me + '，有发现告诉我', '记得带足弹药', '嗯，祝你好运']) });
  } else if (a.type === 'drop') {
    a.used = true;
    R.t += 1;
    const r = Math.random();
    if (r < 0.55) {
      const got = [];
      for (const k of ['food', 'water', 'med', 'ammo', 'fuel']) if (Math.random() < 0.5) { const g = rdGain(k, 3 + Math.floor(Math.random() * 8)); if (g) got.push(RD_RES[k].name + ' +' + g); }
      if (Math.random() < 0.3) { const p = rdRollPart({ slots: Object.keys(RD_SLOTS), partChance: 1 }, null); if (p) { R.inv.push(p.id); got.push(p.name); rdFound(p); } }
      rdLog('抢到空投：' + (got.join('，') || '一箱压缩饼干'), '#a7f070');
      showBanner('抢到空投！', got.slice(0, 4).join('　') || '一箱压缩饼干', 3, '#a7f070');
      C.q.push({ at: C.clk + 0.5, mine: true, t: rcR(['抢到空投了！', '空投到手，谢谢系统！', '我抢到啦！']) });
      rcEvent('rare', { who: C.me, item: '空投' }, { count: 2, vipChance: 0 });
    } else if (r < 0.8) {
      rdLog('赶到空投点时，箱子已经被人撬空了', '#94b0c2');
      showBanner('来晚了', '空投已经被人抢走了', 3, '#94b0c2');
    } else {
      rdSpawnGroup(rdVehX() + 120, true);
      rdLog('空投点有埋伏！怪物被降落伞吸引过来了', '#ef7d57');
      showBanner('空投点有埋伏！', '', 3, '#ef7d57');
    }
    G.state = 'play';
  } else if (a.type === 'scam') {
    rdDialog(m.n, m.n + '说只要先付 ' + a.n + ' 废料，马上通过系统传送发货。', [
      { label: '付款 ' + a.n + ' 废料', disabled: G.res.scrap < a.n, action: () => { a.used = true; G.res.scrap -= a.n; rcScammed(m, a.n); } },
      { label: '不信，算了', action: () => { a.used = true; } }]);
  } else if (a.type === 'extort') rcExtortDialog(m);
}
function rcScammed(m, n) {
  const C = rcC(), v = rcVipById('v_huang');
  rdLog('付给' + m.n + ' ' + n + ' 废料……', '#ef7d57');
  rcQueue(v, null, {}, 1, { text: '收到！马上发货～亲，稍等哦' });
  rcSys('【系统】「' + v.name + '」已将你拉黑。', 9);
  for (let i = 0; i < 3; i++) { const p = rcPickSpeaker(); if (p) rcQueue(p, null, {}, 11 + i * 2.5, { text: rcR(v.lines.exposed) }); }
  rcQueue(rcVipById('v_qian'), null, {}, 15, { text: '{me}，被黄金眼骗了吧？下次来多多杂货铺，童叟无欺'.replace('{me}', C.me) });
  rdLog('（黄金眼收了废料就把你拉黑了。频道里“先付款”的多半是骗子）', '#94b0c2');
}
// 铁颅帮勒索
function rcExtortDialog(m) {
  const C = rcC(), R = rdR(), a = m.act;
  if (!a || a.used) return;
  const st = rdStats();
  rdDialog('铁颅帮的勒索', '雷霸天在频道里点了你的名：交 ' + a.n + ' 废料保护费。\n不交的话，铁颅帮的车队会找上门来。', [
    { label: '交 ' + a.n + ' 废料', disabled: G.res.scrap < a.n, action: () => {
      a.used = true; G.res.scrap -= a.n; C.extort = false; C.heat = 0;
      rdLog('交了 ' + a.n + ' 废料保护费给铁颅帮', '#94b0c2');
      rcQueue(rcVipById('v_he'), null, {}, 1, { text: C.me + '，理性的选择。已登记，本周你是安全的' });
      rcQueue(rcVipById('v_lei'), null, {}, 3, { text: '识相。' + C.me + '，铁颅帮罩你' });
      for (let i = 0; i < 2; i++) { const p = rcPickSpeaker(); if (p) rcQueue(p, 'raid', { who: C.me }, 5 + i * 2); }
    } },
    { label: '拒绝', action: () => { a.used = true; rcExtortRefuse(false); } },
    { label: '火拼（消耗 25 弹药）', disabled: G.res.ammo < 25 || st.mounts < 1, action: () => {
      a.used = true; G.res.ammo -= 25; C.extort = false;
      const power = rdWeapons().reduce((s, w) => s + w.p.fx.dmg * (w.p.fx.count || 1) * w.p.fx.rate, 0);
      const win = Math.random() < Math.min(0.85, 0.35 + power / 120 + R.km / 6000);
      if (win) {
        const n = rdGain('scrap', 25 + Math.floor(Math.random() * 30));
        rdLog('跟铁颅帮的人火拼，打赢了！缴获废料 +' + n, '#a7f070'); showBanner('火拼胜利！', '铁颅帮的车队被打退了，废料 +' + n, 4, '#a7f070'); sfx('win');
        rcQueue(rcVipById('v_pao'), null, {}, 1, { text: '……大炮输了？不可能！' });
        rcQueue(rcVipById('v_lei'), null, {}, 3, { text: C.me + '，你有种。这笔账，铁颅帮记下了' });
        rcQueue(rcVipById('v_zhao'), null, {}, 6, { text: '好样的' + C.me + '！铁颅帮也不是打不过的！' });
        rcEvent('brag', { who: C.me }, { count: 3, vipChance: 0 });
        C.heat = (C.heat || 0) + 1;
      } else {
        rdHurtVehicle(st.hp * 0.3, true); G.res.scrap = Math.max(0, G.res.scrap - 20);
        rdLog('火拼失败，车被打得千疮百孔，还被抢走了 20 废料', '#ef7d57'); showBanner('火拼失败', '车辆受到重创', 4, '#ef7d57'); sfx('bad');
        rcQueue(rcVipById('v_lei'), null, {}, 1, { text: '不自量力。' + C.me + '，下次记得交钱' });
        rcQueue(rcVipById('v_lin'), null, {}, 5, { text: C.me + '，你受伤了吗？有需要跟我说！' });
      }
    } }]);
}
function rcExtortRefuse(silent) {
  const C = rcC(), R = rdR();
  C.extort = false;
  C.gangAt = R.t + 2 + Math.random() * 4;
  rcQueue(rcVipById('v_lei'), null, {}, 1, { text: silent ? C.me + '，不回话？好，铁颅帮亲自上门' : '好，' + C.me + '，你会后悔的' });
  rcQueue(rcVipById('v_pao'), null, {}, 3, { text: '老大，我去！' });
  if (Math.random() < 0.6) rcQueue(rcVipById('v_hong'), null, {}, 6, { text: C.me + '……跑快点，第一车队已经出发了' });
  rcQueue(rcVipById('v_zhao'), null, {}, 8, { text: C.me + '，别怕！他们来了就打回去，我在频道里给你撑腰' });
}
function rcGangAttack() {
  const R = rdR(), st = rdStats(), C = rcC();
  rdHurtVehicle(st.hp * (0.15 + Math.random() * 0.1), true);
  rdSpawnGroup(rdVehX() + 220, false);
  rdSpawnGroup(rdVehX() - rdVeh().len - 160, false, true);
  rdLog('铁颅帮的车队来了！他们朝车开火，还放出了驯养的变异兽', '#ef7d57');
  showBanner('铁颅帮来袭！', '他们放出了驯养的变异兽——打退它们！', 4, '#ef7d57'); sfx('bad');
  rcSys('【快讯】铁颅帮的车队袭击了「' + C.me + '」！', 0.5);
  rcQueue(rcVipById('v_lei'), 'raid', { who: C.me }, 2);
  C.heat = 0;
}

// ---------- 聊天面板 ----------
function rcPanel(c) {
  const R = rdR(), C = rcEnsure(), ctx = c.ctx;
  // 打开面板时也继续刷新
  const now = performance.now();
  if (C._real) rcTick(Math.min(0.25, (now - C._real) / 1000));
  C._real = now;
  C.unread = 0;
  rdLine(c, RC_CHANNEL + ' · 存活 ' + rcAlive() + ' 人 · 你是「' + C.me + '」', 12, '#ffcd75');
  // 发言按钮
  const bw = Math.min(96, (c.w - 12) / 4);
  const sends = [['hello', '打招呼'], ['help', '求助'], ['brag', '炫耀']];
  sends.forEach(([k, l], i) => { const wait = C.cd[k] && C.clk < C.cd[k]; drawButton(ctx, c.x + i * (bw + 4), c.y, bw, 32, wait ? l + ' ' + Math.ceil(C.cd[k] - C.clk) : l, wait ? null : () => rcSend(k), { color: '#1f5e3a', size: 13, dim: wait }); });
  drawButton(ctx, c.x + 3 * (bw + 4), c.y, bw, 32, C.filter === 'vip' ? '只看重要' : '看全部', () => { C.filter = C.filter === 'vip' ? 'all' : 'vip'; }, { color: '#333c57', size: 12 });
  c.y += 38;
  drawButton(ctx, c.x, c.y, 150, 26, '主界面滚动：' + (C.ticker ? '开' : '关'), () => { C.ticker = !C.ticker; }, { color: '#333c57', size: 11 });
  if (c.w > 440) drawText(ctx, '彩色名字 = 重要角色 · 消息右边的按钮可以交易/前往/回应', c.x + 158, c.y + 13, 10, '#94b0c2', 'left', false);
  c.y += 32;
  for (const m of C.msgs) {
    if (C.filter === 'vip' && !m.sys && !m.vip && !m.mine) continue;
    rcDrawMsg(c, m);
  }
}
function rcDrawMsg(c, m) {
  const ctx = c.ctx, C = rcC();
  const fresh = Math.max(0, 1 - (C.clk - (m.at || 0)) / 1.2);
  const live = m.act && !m.act.used && C.clk <= m.act.until;
  const tw = c.w - (live ? 76 : 8);
  const y0 = c.y;
  if (m.sys) {
    const lines = wrapText(ctx, m.t, tw - 8, 12);
    const h = lines.length * 17 + 8;
    ctx.fillStyle = 'rgba(93,39,93,0.35)'; ctx.fillRect(c.x, c.y, c.w, h);
    lines.forEach((ln, i) => drawText(ctx, ln, c.x + 6, c.y + 12 + i * 17, 12, '#ffcd75', 'left', false));
    c.y += h + 4;
  } else {
    const lines = wrapText(ctx, m.t, tw - 8, 12);
    const h = 18 + lines.length * 17 + 4;
    ctx.fillStyle = m.mine ? 'rgba(31,94,58,0.45)' : m.vip ? 'rgba(41,54,111,0.55)' : 'rgba(38,43,68,0.6)'; ctx.fillRect(c.x, c.y, c.w, h);
    drawText(ctx, m.n, c.x + 6, c.y + 10, 12, m.c, 'left', true);
    ctx.font = 'bold 12px ' + FONT;
    let nx = c.x + 12 + ctx.measureText(m.n).width;
    if (m.tag) {
      ctx.font = '10px ' + FONT;
      const w = ctx.measureText(m.tag).width + 8;
      ctx.fillStyle = m.c; ctx.globalAlpha = 0.85; ctx.fillRect(nx, c.y + 3, w, 14); ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a1c2c'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(m.tag, nx + 4, c.y + 10);
      nx += w + 6;
    }
    drawText(ctx, m.h || '', c.x + c.w - 6, c.y + 10, 10, '#566c86', 'right', false);
    lines.forEach((ln, i) => drawText(ctx, ln, c.x + 6, c.y + 27 + i * 17, 12, '#f4f4f4', 'left', false));
    c.y += h + 4;
  }
  if (live) drawButton(ctx, c.x + c.w - 70, y0 + (c.y - y0 - 4) / 2 - 15, 64, 30, m.act.label || '查看', () => rcAct(m), { color: m.act.type === 'extort' ? '#b13e53' : m.act.type === 'scam' ? '#a8794f' : '#1f5e3a', size: 12, active: true });
  if (fresh > 0) { ctx.fillStyle = 'rgba(255,205,117,' + (fresh * 0.25).toFixed(3) + ')'; ctx.fillRect(c.x, y0, c.w, c.y - y0 - 4); }
}
// 主界面上滚动显示最新几条
function rcTicker(ctx, x, y, w) {
  const R = rdR();
  if (!R || !R.chat || !R.chat.ticker) return 0;
  const C = R.chat, ms = C.msgs.slice(0, 3).reverse();
  if (!ms.length) return 0;
  const lh = 18, h = ms.length * lh + 6;
  ctx.fillStyle = 'rgba(26,28,44,0.55)'; ctx.fillRect(x, y, w, h);
  ms.forEach((m, i) => {
    const age = C.clk - (m.at || 0);
    ctx.globalAlpha = i === ms.length - 1 ? 1 : 0.75;
    const head = m.sys ? '' : m.n + '：';
    let body = m.t;
    ctx.font = 'bold 12px ' + FONT;
    const hw = head ? ctx.measureText(head).width : 0;
    ctx.font = '12px ' + FONT;
    while (body.length > 1 && ctx.measureText(body).width > w - 10 - hw) body = body.slice(0, -2) + '…';
    if (head) drawText(ctx, head, x + 5, y + 12 + i * lh, 12, m.sys ? '#ffcd75' : m.c, 'left', true);
    drawText(ctx, body, x + 5 + hw, y + 12 + i * lh, 12, m.sys ? '#ffcd75' : age < 1.5 ? '#ffffff' : '#c8d6e5', 'left', false);
  });
  ctx.globalAlpha = 1;
  addButton(x, y, w, h, () => rdOpenPanel('chat'));
  return h;
}

// 调试用：统计每个人的台词有多少是独一无二的（在浏览器控制台里运行 rcAudit()）
function rcAudit() {
  const P = rcPeople(), seen = {};
  let total = 0, events = Object.keys(RC_EVENTS).length;
  const per = [];
  for (const p of P.list) {
    let cnt = 0;
    for (const ev in RC_EVENTS) {
      if (!p.lines[ev]) continue;
      const pool = RC_ARCH[p.arch].lines[ev].split('|');
      for (const i of p.lines[ev]) { const t = pool[i]; seen[t] = (seen[t] || 0) + 1; total++; cnt++; }
    }
    per.push(cnt);
  }
  return { npcs: P.list.length, vips: P.vips.length, events, linesPerNpc: [Math.min(...per), Math.max(...per)], combos: total, distinct: Object.keys(seen).length };
}
