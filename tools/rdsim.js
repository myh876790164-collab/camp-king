// 公路求生自动游玩模拟（调数值用，不会被游戏加载）
// 用法：在浏览器里打开游戏后，把本文件内容粘进控制台（或用 javascript 工具执行），然后 rdSim('courier', 60)
// 返回：死亡原因、公里数、天数，以及每隔几天一行：天 公里 生命 心情 油/电 食物 水 废料 弹药 车耐久 击杀 搜索次数 最高品阶 外星晶体
window.rdSim = function (veh, days) {
  startGame('road', { veh }); G.banner = null; const R = G.road; const rows = [], dun = []; let lastDay = 0, deaths = null, hikeT = -99, emerg = 0;
  const autoEquip = () => { const st = rdStats();
    for (let i = R.inv.length - 1; i >= 0; i--) { const id = R.inv[i], p = RD_PARTS[id]; if (!p) continue;
      if (p.slot === 'in') { if (rdFreeCell(p) >= 0) rdInstall(i, 'in'); continue; }
      if (p.slot === 'weapon') { let m = -1; for (let k = 0; k < st.mounts; k++) if (!R.wpn[k]) { m = k; break; } if (m < 0) { let lo = 99; for (let k = 0; k < st.mounts; k++) { const t = RD_PARTS[R.wpn[k]].tier; if (t < lo) { lo = t; m = k; } } if (lo >= p.tier) m = -1; } if (m >= 0) rdInstall(i, 'weapon', m); continue; }
      if (p.slot === 'hand' || p.slot === 'suit') { if (!R[p.slot] || RD_PARTS[R[p.slot]].tier < p.tier) rdInstall(i, p.slot); continue; }
      if (p.slot === 'trailer') { if (!R.ext.trailer && p.fx.cells) rdInstall(i, 'trailer'); continue; }
      const cur = R.ext[p.slot]; if (!cur || RD_PARTS[cur].tier < p.tier) { if (p.slot === 'engine' && p.fx.electric && R.veh !== 'ebike') continue; rdInstall(i, p.slot); }
    }
    for (let i = R.inv.length - 1; i >= 0; i--) if (R.inv.length > 12) rdDismantle(i);
  };
  for (let s = 0; s < days * 240 * 20; s++) {
    update(0.05);
    if (G.state === 'dialog') { const o = G.dialog.options.find((o) => !o.disabled); G.dialog = null; G.state = 'play'; if (o) o.action(); }
    if (G.state === 'rpanel') { G.state = 'play'; R.trade = null; }
    if (G.state === 'over') { deaths = G.endTitle + ' / ' + R.me.lastHurt; break; }
    // 副本：矿点前刹车、塌方 / 火箭弹红圈时冲刺；结算后直接回公路（js/roaddungeon.js）
    if (R.dun) { const D = R.dun; if (D.phase === 'run') { const n = D.note || ''; D.drive = /矿点|跟前/.test(n) ? 'stop' : /塌方|红圈|躲开|猛撞/.test(n) || D.blockM ? 'boost' : 'go'; } if (D.phase === 'result' && !D._logged) { D._logged = 1; dun.push([Math.floor(D.realKm), D.id, D.result.rank + '/' + D.result.list.length, D.result.tier, '分' + Math.round(D.result.list.find((x) => x.me).score)].join(' ')); D.phase = 'warpOut'; D.pt = 0; } continue; }
    if (R.driving) { const ns = rdNearSite(); if (ns && Math.abs(ns.km - R.km) * RD_PX_KM < 12) rdStartSearch(ns); }
    if (s % 20 === 0) {
      const me = R.me, st = rdStats();
      if (G.res.ammo < 10 && G.res.scrap > 20 && st.craft) rdMakeAmmo();
      if (R.speedNow < 1 && (R.broken || R.hpV < st.hp * 0.5) && G.res.scrap >= 4) rdRepair();
      if (R.broken && R.speedNow < 1 && G.res.scrap < 4) { rdEmergencyRepair(); emerg++; }
      if (!R.driving && R.speedNow < 1 && me.loc !== 'out' && me.loc !== 'site' && !R.broken) {
        const ns = rdNearSite();
        if (ns && (R.mons || []).length < 2) rdStartSearch(ns);
        else if (((G.res.fuel < 1 && st.fuelKm > 0) || (G.res.power < 1 && st.powKm > 0)) && R.t - hikeT > 12) { hikeT = R.t; rdHike(); }
        else if (!(me.act && me.act.type === 'sleep') && (me.energy > 30 || st.autopilot)) rdToggleDrive();
      }
    }
    const d = rdDay();
    if (d !== lastDay) { lastDay = d; autoEquip(); const st = rdStats(); rows.push([d, Math.floor(R.km), Math.round(R.me.hp), Math.round(R.me.mood), Math.floor(G.res.fuel) + '/' + Math.floor(G.res.power), Math.floor(G.res.food), Math.floor(G.res.water), Math.floor(G.res.scrap), Math.floor(G.res.ammo), Math.round(R.hpV) + '/' + st.hp, R.stats.kills, R.stats.searched, Math.max(0, ...rdInstalled().map((p) => p.tier)), Math.floor(G.res.alien)].join(' ')); }
  }
  return { veh, deaths, km: Math.floor(R.km), day: rdDay(), emerg, dun, rows: rows.filter((r, i) => i % 10 === 0 || i === rows.length - 1) };
};
