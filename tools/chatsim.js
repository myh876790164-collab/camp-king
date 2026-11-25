// 公路求生聊天室：统计台词数量、模拟玩家看到重复内容的速度
// 用法：在游戏页面里执行本文件内容，然后 chatSim(180)  → 模拟 180 分钟现实时间（×1 速度）
function chatCount() {
  const out = { 普通性格: 0, 职业闲聊: 0, 重要角色: 0, 动态模板: 0 };
  for (const a in RC_ARCH) for (const ev in RC_ARCH[a].lines) out.普通性格 += RC_ARCH[a].lines[ev].split('|').length;
  for (const j in RC_JOB_IDLE) out.职业闲聊 += RC_JOB_IDLE[j].split('|').length;
  for (const v of RC_VIPS) for (const k in v.lines) out.重要角色 += v.lines[k].split('|').length;
  if (typeof RC_DYN !== 'undefined') for (const k in RC_DYN) out.动态模板 += RC_DYN[k].length;
  return out;
}
function chatSim(minutes) {
  startGame('road', { veh: 'courier' });
  const R = G.road;
  rcEnsure();
  const seen = {}, wins = [];
  let win = { n: 0, rep: 0, rep2: 0 };
  const seen2 = {};
  // 严格算法：动态台词只要句式一样（不管换了哪个建筑/怪物/零件）也算重复
  const names = [].concat(Object.values(RD_SITES).map((s) => s.name), Object.values(RD_MONSTERS).map((s) => s.name), RD_PART_LIST.map((s) => s.name), RD_BIOMES.map((s) => s.name), Object.values(RD_RES).map((s) => s.name), RC_CARS, RC_HOMES)
    .sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const nameRe = new RegExp(names.join('|'), 'g');
  const orig = rcPush;
  // 只看话本身（去掉人名、数字），同一句话不同人说也算重复
  rcPush = function (m) { orig(m); if (m.sys || m.mine) return; const k = m.t.replace(/\d+/g, '#').replace(/@\S+/g, '@'); const k2 = k.replace(nameRe, '*'); win.n++; if (seen[k]) win.rep++; if (seen2[k2]) win.rep2++; seen[k] = (seen[k] || 0) + 1; seen2[k2] = 1; };
  let total = 0;
  try {
    for (let s = 0; s < minutes * 60; s += 0.5) {
      R.t += 0.5 / RD_HOUR; rcTick(0.5);
      if (s % 1800 === 1799.5) { wins.push(win); total += win.n; win = { n: 0, rep: 0, rep2: 0 }; }
    }
  } finally { rcPush = orig; }
  const pct = (a, n) => Math.round(a / Math.max(1, n) * 100);
  const rows = wins.map((w, i) => ((i + 1) * 30) + '分钟：' + w.n + '条，重复' + pct(w.rep, w.n) + '%（严格' + pct(w.rep2, w.n) + '%）');
  const at60 = wins.findIndex((w) => w.rep / Math.max(1, w.n) >= 0.6), at60b = wins.findIndex((w) => w.rep2 / Math.max(1, w.n) >= 0.6);
  const when = (i) => i < 0 ? '超过' + minutes + '分钟' : (i + 1) * 30 + '分钟左右';
  return { 每分钟条数: (total / minutes).toFixed(1), 见过的不同句子: Object.keys(seen).length, 重复到60的时间: when(at60), 严格算法重复到60: when(at60b), 明细: rows };
}
