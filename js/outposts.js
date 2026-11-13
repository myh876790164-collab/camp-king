// =============================================
//  派驻 / 分基地（丧尸模式）
//  把一栋楼里的丧尸清干净 → 进楼点「派驻」→ 选一名同伴驻守，建成分基地
//  分基地每天天亮产出物资（不同建筑产出不同），驻守的人能力越强、分基地等级越高，产出越多
//  夜里分基地可能被丧尸袭击：守住了没事，守不住就会丢掉（人逃回营地）
//  你的初始营地建筑也有同样的独特产出（不用派人）
// =============================================

// 每种建筑每天的基础产出。give = 资源；其余是特殊效果
const OUTPUT = {
  police: { give: { ammo: 6 } },
  supermarket: { give: { food: 4, water: 3 } },
  hospital: { give: {}, bandage: 1, medkit: 0.25, text: '绷带 +1（25% 几率再出 1 个急救包）' },
  factory: { give: { parts: 6 } },
  firestation: { give: { water: 6 } },
  school: { give: {}, morale: 3, train: 1, text: '训练：全员士气 +3，每人随机一项技能经验 +1' },
  gasstation: { give: { parts: 3, ammo: 2 } },
  apartment: { give: { food: 2, water: 2 }, attract: 1, text: '食物 +2、水 +2，并吸引新的幸存者来投奔' },
  house: { give: { food: 1, water: 1 } },
  office: { give: { parts: 3 } },
  shop: { give: { food: 3 } },
  warehouse: { give: { parts: 4 } },
  barn: { give: { food: 5 } },
};
const OUTPOST_COST = { parts: 15, food: 5 };
const OUTPOST_UPGRADE = [null, { parts: 25 }, { parts: 45 }]; // 升到 2 级 / 3 级的费用
const OUTPOST_MAX_LV = 3;

function campSurvivors() { return G.survivors.filter((s) => s.post === undefined || s.post === null); }
function outposts() { return G.structs.filter((s) => s.op); }
function outpostWorker(st) { const i = G.structs.indexOf(st); return G.survivors.find((s) => s.post === i) || null; }
function workerMul(s) { return Math.min(2, 1 + 0.08 * s.skills.scav + 0.03 * abLevel(s) + (hasT(s, 'scavenger') ? 0.15 : 0)); }
function levelMul(lv) { return 1 + 0.5 * (lv - 1); }
function outpostMul(st) { const w = outpostWorker(st); return levelMul(st.op.lv) * (w ? workerMul(w) : 1); }

// 产出说明文字（mult = 倍数）
function outputText(type, mult) {
  const o = OUTPUT[type];
  if (!o) return '无';
  const parts = Object.keys(o.give).map((r) => RES_INFO[r].name + ' +' + Math.max(1, Math.round(o.give[r] * mult)));
  if (o.text && !parts.length) return o.text;
  if (o.attract) parts.push('吸引幸存者');
  return parts.join('、');
}
// 实际发放一次产出，返回文字
function applyOutput(type, mult) {
  const o = OUTPUT[type], got = [];
  if (!o) return '';
  for (const r in o.give) {
    const n = Math.max(1, Math.round(o.give[r] * mult));
    G.res[r] = (G.res[r] || 0) + n;
    got.push(RES_INFO[r].name + '+' + n);
  }
  if (o.bandage) { const n = Math.max(1, Math.round(o.bandage * mult)); addItem('c:bandage', n); got.push('绷带+' + n); }
  if (o.medkit && Math.random() < o.medkit * mult) { addItem('c:medkit'); got.push('急救包+1'); }
  if (o.morale) { for (const p of allPeople()) changeMorale(p, o.morale); got.push('士气+' + o.morale); }
  if (o.train) { for (const p of allPeople()) gainSkill(p, pick(['shoot', 'melee', 'scav']), o.train * mult); got.push('训练'); }
  if (o.attract && G.npcs.length < 10 && Math.random() < 0.5 * mult) { spawnNpc(); got.push('有人来投奔'); }
  return got.join(' ');
}

// 建立分基地
function establishOutpost(st, s) {
  if (!canAfford(OUTPOST_COST)) { showBanner('物资不够', '建立分基地需要 零件 15、食物 5', 2.5, '#ef7d57'); sfx('bad'); return; }
  pay(OUTPOST_COST);
  st.op = { lv: 1 };
  s.post = G.structs.indexOf(st);
  s.state = 'post'; s.target = null; s.bag = null; s.path = [];
  const d = structEntrance(st) || { x: st.x, y: st.y + st.h };
  s.x = (d.x + 0.5) * T; s.y = (d.y + 0.5) * T;
  placeSurvivors();
  showBanner('分基地建成：' + STRUCTS[st.type].name, s.name + ' 驻守在这里，每天产出 ' + outputText(st.type, outpostMul(st)), 4, '#73eff7');
  sfx('win');
}
function recallOutpost(st, lost) {
  const s = outpostWorker(st);
  st.op = null;
  if (s) { s.post = null; s.state = 'base'; placeSurvivors(); s.x = s.hx; s.y = s.hy; }
  if (!lost) showBanner('已撤回', (s ? s.name + ' 回到了营地，' : '') + STRUCTS[st.type].name + '分基地已放弃', 2.5, '#c8d6e5');
  return s;
}
function upgradeOutpost(st) {
  const cost = OUTPOST_UPGRADE[st.op.lv];
  if (!cost) return;
  if (!canAfford(cost)) { showBanner('零件不够', '', 2, '#ef7d57'); sfx('bad'); return; }
  pay(cost);
  st.op.lv++;
  showBanner('分基地升到 ' + st.op.lv + ' 级', '每天产出 ' + outputText(st.type, outpostMul(st)) + '，也更不容易被攻破', 3, '#73eff7');
  sfx('build');
}

// 驻守者的战斗力（守夜用）
function outpostPower(st) {
  const s = outpostWorker(st);
  if (!s) return 0;
  let w = WEAPONS[s.weapon];
  if (w.ammo && (G.res.ammo || 0) < 5) w = WEAPONS.fists; // 没子弹，枪就没用
  return w.dmg * personDmgMult(s, w) + abLevel(s) * 3 + st.op.lv * 8 + (ARMORS[s.armor].hp / 10);
}
function outpostRaidChance(st) {
  if (G.day < 3) return 0; // 头两天不会被袭击
  return Math.max(0.05, Math.min(0.4, 0.1 + STRUCTS[st.type].danger * 0.04 - 0.06 * (st.op.lv - 1)));
}
function outpostWinChance(st) {
  const threat = 14 + G.day * 2.5 + STRUCTS[st.type].danger * 4;
  return Math.max(0.15, Math.min(0.95, 0.5 + (outpostPower(st) - threat) / 50));
}

// 天亮结算：昨晚有没有被袭击 + 今天的产出
function outpostsDawn(msgs) {
  for (const st of outposts()) {
    const s = outpostWorker(st), name = STRUCTS[st.type].name;
    if (!s) { st.op = null; continue; }
    // 昨晚真的有丧尸来袭（js/defense.js）：驻守的人倒下 = 分基地失守
    if (st.raided) {
      st.raided = false;
      if (!s.down) {
        msgs.push(s.name + ' 守住了' + name + '分基地');
        if (Math.random() < 0.3) { const t = pick(ABIL_KEYS); addItem('k:' + t); msgs.push('缴获' + CORES[t].name); }
      } else {
        recallOutpost(st, true);
        s.down = false;
        s.hp = Math.max(1, personMaxHp(s) * 0.2);
        changeMorale(s, -15);
        st.zIn = Math.ceil(STRUCTS[st.type].danger * 0.8) + 1; st.zs = null;
        msgs.push('⚠ ' + name + '分基地被丧尸攻破，' + s.name + ' 逃回了营地');
        continue;
      }
    }
    const got = applyOutput(st.type, outpostMul(st));
    if (got) msgs.push(name + '分基地：' + got);
  }
  // 自己的营地建筑也有独特产出
  const home = G.structs.find((q) => q.home);
  if (home && OUTPUT[home.type]) { const got = applyOutput(home.type, 1); if (got) msgs.push('营地产出：' + got); }
}

// ---------- 界面 ----------
// 在楼里点「派驻」
function openStationDialog(st) {
  const name = STRUCTS[st.type].name;
  if (!OUTPUT[st.type]) { showBanner('这里不能建分基地', '', 2, '#ef7d57'); return; }
  // 人在楼里时按现在实际还活着的丧尸算
  const zLeft = G.inside && G.inside.s === st ? G.inside.zombies.filter((m) => m.alive).length : (st.zIn || 0);
  if (zLeft > 0) {
    showBanner('先清理掉楼里的丧尸', '把这栋楼里的丧尸全部消灭，才能派人驻守', 3, '#ef7d57'); sfx('bad'); return;
  }
  const free = campSurvivors().filter((s) => !s.down && (s.state || 'base') === 'base');
  const options = free.slice(0, 5).map((s) => ({
    label: '派 ' + s.name + ' 驻守（产出 ' + outputText(st.type, workerMul(s)) + '）',
    disabled: !canAfford(OUTPOST_COST),
    action: () => establishOutpost(st, s),
  }));
  options.push({ label: '取消', action: () => {} });
  G.dialog = {
    title: '在' + name + '建立分基地',
    text: '派一名同伴驻守，每天天亮产出：' + outputText(st.type, 1) + '（驻守的人搜刮技能、异能越高越多）。\n费用：零件 15、食物 5。驻守的人不再守营地、不占营地床位，但照常吃饭。\n第 3 天起夜里可能有少量丧尸来袭，驻守的人会迎战，被打倒的话分基地就丢了。' +
      (free.length ? '' : '\n\n现在营地里没有空闲的同伴（外出搜刮的要等他们回来）。'),
    options,
  };
  G.state = 'dialog';
  sfx('click');
}
// 在分基地里点「分基地」
function openOutpostDialog(st) {
  const s = outpostWorker(st), name = STRUCTS[st.type].name, lv = st.op.lv, up = OUTPOST_UPGRADE[lv];
  const options = [];
  if (up) options.push({ label: '升到 ' + (lv + 1) + ' 级（零件 ' + up.parts + '）：产出 +50%，更难被攻破', disabled: !canAfford(up), action: () => upgradeOutpost(st) });
  options.push({ label: '撤回 ' + (s ? s.name : '') + '，放弃分基地', action: () => recallOutpost(st) });
  options.push({ label: '关闭', action: () => {} });
  G.dialog = {
    title: name + '分基地 · ' + lv + ' 级',
    text: '驻守：' + (s ? s.name + '（' + WEAPONS[s.weapon].name + '）' : '无') + '\n每天产出：' + outputText(st.type, outpostMul(st)) +
      '\n夜里被袭击的几率：' + (G.day < 3 ? '第 3 天起才会有' : pct(Math.min(0.8, outpostRaidChance(st) * 2)) + '，每次约 ' + outpostRaidCount(st) + ' 只丧尸') +
      '\n驻守的人会在门口迎战，被打倒的话分基地就丢了。给 TA 换好武器和护甲、提升异能，或者升级分基地（来的丧尸更少）',
    options,
  };
  G.state = 'dialog';
  sfx('click');
}
