// =============================================
//  中立商人「精明的冬瓜」（丧尸模式）
//  红头发、白 T 恤的女孩，头顶一个钱袋子。不定期在白天出现在营地附近，天黑前离开
//  卖「植物改造装置」的图纸（买一次永久解锁建造）、子弹、急救包，也收晶核
//  图纸建筑（机制参考塔防游戏里的植物，名字和外观是原创的）：
//    籽弹炮台：自动瞄准射击 · 霜籽炮台：减速 · 双发籽弹炮台：一次两发 · 硬壳果墙：超厚的墙
//    地雷薯：踩中爆炸 · 铁皮重瓜：跳起来砸最强的敌人（专治巨尸） · 爆燃辣椒：十字烈焰 · 双生爆果：放下就炸
// =============================================

// ---------- 图纸建筑：每帧的特殊逻辑 ----------
// 一次性装置用完就消失
function bpRemove(b) { if (b.alive) { b.alive = false; removeBuilding(b); } }
function enemiesNear(x, y, r) { return G.monsters.filter((m) => m.alive && !m.def.fly && Math.hypot(m.x - x, m.y - y) < r); }

const BP_UPDATE = {
  // 双发：主炮开火后 0.12 秒再补一发
  twingun(b, dt) {
    if (b.cd > (b.lastCd || 0) + 0.01) { b.twinT = 0.12; }
    b.lastCd = b.cd;
    if (b.twinT > 0 && (b.twinT -= dt) <= 0) {
      const [best] = nearestMonsters(b.cx, b.cy, towerRange(b));
      if (best) towerShoot(b, best);
    }
  },
  // 地雷薯：埋好 6 秒后才能用，丧尸踩上去爆炸
  mine(b, dt) {
    b.armT = (b.armT || 0) + dt;
    b.spr = b.armT >= 6 ? (Math.sin(G.time * 8) > 0 ? 'b_mine2' : 'b_mine3') : 'b_mine';
    if (b.armT < 6) return;
    if (!enemiesNear(b.cx, b.cy, T * 0.75).length) return;
    for (const m of enemiesNear(b.cx, b.cy, T * 1.4)) hurtMonster(m, 600 * G.mods.dmg);
    G.effects.push({ type: 'boom', x: b.cx, y: b.cy, t: 0, life: 0.4, size: T * 1.4, color: '#ffcd75' });
    fxParticlesAt(b.cx, b.cy, '#c49a64', 14);
    addFloat(b.cx, b.cy - 14, '轰！', '#ffcd75', true);
    sfx('hit');
    bpRemove(b);
  },
  // 铁皮重瓜：敌人靠近就跳起来砸血最多的那只
  melon(b) {
    const near = enemiesNear(b.cx, b.cy, T * 1.7);
    if (!near.length) return;
    const t = near.sort((p, q) => q.hp - p.hp)[0];
    G.effects.push({ type: 'custom', draw: drawMelonDrop, x: t.x, y: t.y, sx: b.cx, sy: b.cy, t: 0, life: 0.45 });
    hurtMonster(t, 2000 * G.mods.dmg);
    for (const m of enemiesNear(t.x, t.y, T * 1.1)) if (m !== t) hurtMonster(m, 150 * G.mods.dmg);
    addFloat(t.x, t.y - 20, '砸扁！-' + Math.round(2000 * G.mods.dmg), '#ffcd75', true);
    sfx('hit');
    bpRemove(b);
  },
  // 爆燃辣椒：敌人进入 2 格就引爆，横竖各 7 格烈焰
  chili(b) {
    if (!enemiesNear(b.cx, b.cy, T * 2).length) return;
    const R = 7 * T;
    for (const m of G.monsters) {
      if (!m.alive) continue;
      const onRow = Math.abs(m.y - b.cy) < T * 0.7 && Math.abs(m.x - b.cx) < R;
      const onCol = Math.abs(m.x - b.cx) < T * 0.7 && Math.abs(m.y - b.cy) < R;
      if (!onRow && !onCol) continue;
      hurtMonster(m, 800 * G.mods.dmg);
      m.burnDps = Math.max(m.burnDps || 0, 40); m.burnUntil = G.clock + 3;
    }
    for (let k = -7; k <= 7; k++) {
      for (const [dx, dy] of [[k, 0], [0, k]]) {
        G.effects.push({ type: 'custom', draw: drawFlameTile, x: b.cx + dx * T, y: b.cy + dy * T, t: 0, life: 0.6 + Math.abs(k) * 0.03 });
      }
    }
    addFloat(b.cx, b.cy - 16, '烈焰！', '#ef7d57', true);
    sfx('hit');
    bpRemove(b);
  },
  // 双生爆果：放下 1.5 秒后爆炸
  bomb(b, dt) {
    b.bt = (b.bt || 0) + dt;
    b.spr = b.bt % 0.3 < 0.15 ? 'b_bomb' : 'b_bomb2';
    if (b.bt < 1.5) return;
    for (const m of enemiesNear(b.cx, b.cy, T * 2.5)) hurtMonster(m, 1000 * G.mods.dmg);
    G.effects.push({ type: 'boom', x: b.cx, y: b.cy, t: 0, life: 0.5, size: T * 2.5, color: '#ef7d57' });
    G.effects.push({ type: 'ring', x: b.cx, y: b.cy, t: 0, life: 0.5, size: T * 3, color: '#ffcd75' });
    fxParticlesAt(b.cx, b.cy, '#b13e53', 20);
    addFloat(b.cx, b.cy - 16, '爆！', '#ef7d57', true);
    sfx('hit');
    bpRemove(b);
  },
};
function fxParticlesAt(x, y, color, n) { addParticles(x, y, color, n); }

// 铁皮重瓜落下的动画
function drawMelonDrop(ctx, e, k) {
  const h = (1 - k) * 18, x = e.x, y = e.y - 6 - h;
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(10,10,25,0.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 7 * (0.5 + k * 0.5), 3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#1a1c2c'; ctx.beginPath(); ctx.ellipse(x, y, 8, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5a7a45'; ctx.beginPath(); ctx.ellipse(x, y, 7, 6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#94b0c2'; ctx.fillRect(x - 7, y - 1, 14, 2); ctx.fillRect(x - 1, y - 6, 2, 12);
  if (k > 0.8) { ctx.fillStyle = '#ffcd75'; ctx.globalAlpha = (1 - k) * 5; ctx.fillRect(x - 10, e.y - 1, 20, 2); }
  ctx.globalAlpha = 1;
}
// 一格烈焰
function drawFlameTile(ctx, e, k) {
  const h = 10 + Math.sin(G.time * 30 + e.x) * 3;
  ctx.globalAlpha = 1 - k;
  ctx.fillStyle = '#b13e53'; ctx.fillRect(e.x - 7, e.y - h + 4, 14, h);
  ctx.fillStyle = '#ef7d57'; ctx.fillRect(e.x - 5, e.y - h + 6, 10, h - 3);
  ctx.fillStyle = '#ffcd75'; ctx.fillRect(e.x - 2, e.y - h * 0.6 + 6, 4, h * 0.6 - 3);
  ctx.globalAlpha = 1;
}

// ---------- 图纸建筑的像素画 ----------
function bpSprite(paint) {
  const c = createCanvas(32, 32), g = c.getContext('2d');
  g.scale(2, 2);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const O = (x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
  paint(P, O);
  const white = createCanvas(32, 32), wg = white.getContext('2d');
  wg.drawImage(c, 0, 0); wg.globalCompositeOperation = 'source-in'; wg.fillStyle = '#fff'; wg.fillRect(0, 0, 32, 32);
  return { w: 16, h: 16, img: c, flip: c, white };
}
// 沙袋花盆（炮台的底座）
function potBase(P, O) { O(8, 13.5, 6.5, 2.5, '#1a1c2c'); O(8, 13, 6, 2, '#b8a07a'); P(2.5, 12.5, 11, 0.6, '#8a7650'); }
function initMerchantSprites() {
  const shooter = (body, light, dark, barrels) => (P, O) => {
    potBase(P, O);
    P(7, 8, 2, 5, '#2f5a3c');                                    // 茎
    P(4, 10, 3, 1.5, '#38704a'); P(9, 9.5, 3, 1.5, '#38704a');    // 叶子
    O(8, 6, 4.8, 4.3, '#1a1c2c'); O(8, 6, 4.2, 3.7, body);        // 头
    O(6.8, 4.8, 1.6, 1.2, light);
    for (const by of barrels) { P(11, by - 1.3, 4.5, 2.6, '#1a1c2c'); P(11.5, by - 0.9, 3.6, 1.8, dark); P(14.5, by - 0.9, 0.6, 1.8, '#1a1c2c'); } // 炮管
    P(6, 5.5, 1.2, 1.2, '#1a1c2c');                                // 眼睛
  };
  SPR.b_seedgun = bpSprite(shooter('#5aa04c', '#a7f070', '#38704a', [6]));
  SPR.b_frostgun = bpSprite(shooter('#73a7e0', '#dff6ff', '#41579a', [6]));
  SPR.b_twingun = bpSprite(shooter('#3b8f4a', '#a7f070', '#2f5a3c', [4.6, 7.6]));
  SPR.b_nutwall = bpSprite((P, O) => {
    O(8, 9, 7, 6.8, '#1a1c2c'); O(8, 9, 6.4, 6.2, '#8f5a3a'); O(6.5, 6.5, 3, 2.5, '#b07a45');
    P(4, 9, 8, 0.7, '#6e4a2e'); P(8, 4, 0.7, 10, '#6e4a2e');      // 果壳纹路
    P(5.5, 8, 1, 1.2, '#1a1c2c'); P(9.5, 8, 1, 1.2, '#1a1c2c');   // 眼睛
  });
  const mine = (light) => (P, O) => {
    O(8, 12, 6.5, 3, '#6a5838'); O(8, 11.5, 5.5, 2.4, '#7d6a45'); // 土堆
    O(8, 10, 3.6, 2.6, '#1a1c2c'); O(8, 10, 3, 2.1, '#c49a64');   // 薯
    P(7.6, 6, 0.8, 3.5, '#566c86'); O(8, 6, 1.4, 1.4, light);      // 天线 + 指示灯
  };
  SPR.b_mine = bpSprite(mine('#566c86'));
  SPR.b_mine2 = bpSprite(mine('#ef3b3b'));
  SPR.b_mine3 = bpSprite(mine('#7a1c2c'));
  SPR.b_melon = bpSprite((P, O) => {
    O(8, 13.5, 6, 2, 'rgba(10,10,25,0.35)');
    O(8, 9, 6.8, 5.8, '#1a1c2c'); O(8, 9, 6.2, 5.2, '#5a7a45'); O(6, 7, 2.5, 1.8, '#8db36b');
    P(1.8, 8.4, 12.4, 1.4, '#94b0c2'); P(7.3, 3.8, 1.4, 10.4, '#94b0c2'); // 铁箍
    P(4, 8.6, 0.8, 0.8, '#1a1c2c'); P(11, 8.6, 0.8, 0.8, '#1a1c2c');      // 铆钉
    P(7.5, 2, 1, 2, '#6e4a2e');
  });
  SPR.b_chili = bpSprite((P, O) => {
    potBase(P, O);
    O(8, 8, 2.8, 5.2, '#1a1c2c'); O(8, 8, 2.3, 4.7, '#d13a3a'); O(7.2, 6.5, 0.8, 2.5, '#ff8a8a');
    P(7.2, 2, 1.6, 2, '#38704a'); P(6, 2.3, 4, 1, '#38704a');
    P(6.8, 8, 0.9, 1, '#1a1c2c'); P(8.6, 8, 0.9, 1, '#1a1c2c');
  });
  const bomb = (glow) => (P, O) => {
    O(8, 13.5, 6, 2, 'rgba(10,10,25,0.35)');
    for (const bx of [5.2, 10.8]) { O(bx, 10, 3.6, 3.6, '#1a1c2c'); O(bx, 10, 3.1, 3.1, glow ? '#ff5050' : '#b13e53'); O(bx - 1, 9, 1, 0.8, '#ffb3b3'); }
    P(5, 4, 0.8, 3, '#38704a'); P(10.6, 4, 0.8, 3, '#38704a'); P(5, 3.5, 6.4, 0.8, '#38704a');
  };
  SPR.b_bomb = bpSprite(bomb(false));
  SPR.b_bomb2 = bpSprite(bomb(true));
  // 商人：红色长发 + 白 T 恤 + 牛仔裤
  SPR.merchant = makeSprite([
    '................', '.....kkkkkk.....', '....krrrrrrk....', '...krrrrrrrrk...',
    '...krSSSSSSrk...', '...krSkSSkSrk...', '...krSSSSSSrk...', '...krrSrrSrrk...',
    '...krkwwwwkrk...', '...krSwwwwwSk...', '....kSwwwwwSk...', '.....kwwwwwk....',
    '.....kuuuuuk....', '.....kuukuuk....', '.....kuk.kuk....', '.....kkk.kkk....',
  ], { u: 'C' });
}

// 头顶的钱袋子
function drawMoneyBag(ctx, x, y) {
  const b = Math.sin(G.time * 3) * 1.2;
  y += b;
  ctx.fillStyle = '#1a1c2c'; ctx.beginPath(); ctx.ellipse(x, y + 1, 5, 4.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#c49a64'; ctx.beginPath(); ctx.ellipse(x, y + 1, 4.3, 3.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(x - 2.5, y - 4.5, 5, 2.5);
  ctx.fillStyle = '#8f6a42'; ctx.fillRect(x - 2, y - 4, 4, 1.6);
  ctx.fillStyle = '#ffcd75'; ctx.fillRect(x - 1.5, y - 0.5, 3, 0.8); ctx.fillRect(x - 1.5, y + 1.2, 3, 0.8); ctx.fillRect(x - 0.4, y - 1.5, 0.8, 4.5); // ¥
  ctx.fillStyle = '#ffcd75'; ctx.globalAlpha = 0.6 + Math.sin(G.time * 6) * 0.4; ctx.fillRect(x + 4, y - 4, 1, 1); ctx.globalAlpha = 1;
}

// ---------- 商人出现 / 离开 ----------
const MERCHANT_LINES = [
  '我是精明的冬瓜！走过路过不要错过～',
  '末日也要做生意嘛，童叟无欺哦！',
  '这些图纸可是我从植物研究所……呃，捡来的。',
  '砍价？精明的冬瓜从来不砍价。',
  '巨尸来了别怕，买个铁皮重瓜，砸它！',
  '晶核我也收，亮晶晶的我最喜欢了。',
];
const BLUEPRINTS = {
  seedgun: { price: { parts: 25 }, line: '最畅销的款式，种下去就自己打！' },
  frostgun: { price: { parts: 30, water: 10 }, line: '冻得它们走不动路～' },
  twingun: { price: { parts: 45 }, line: '一次两发，效率翻倍！', need: 'seedgun' },
  nutwall: { price: { parts: 20, food: 5 }, line: '又硬又厚，丧尸啃到牙疼。' },
  mine: { price: { parts: 25 }, line: '埋好等 6 秒，谁踩谁倒霉。' },
  melon: { price: { parts: 40, food: 10 }, line: '专治那种大块头！' },
  chili: { price: { parts: 35, food: 10 }, line: '一条街都给你烧干净。' },
  bomb: { price: { parts: 40 }, line: '放下就炸，别站太近哦。' },
};

function merchantNpc() { return G.npcs.find((n) => n.kind === 'merchant'); }
// 天亮时决定今天来不来、什么时候来
function planMerchant() {
  G.merchantAt = null;
  if (G.day < 2) return;
  if (G.day === 2 || Math.random() < 0.55) G.merchantAt = rand(G.def.dayTime * 0.4, G.def.dayTime * 0.85);
}
function spawnMerchant() {
  const pos = randomWalkable(G.core.cx, G.core.cy, 5, 8);
  if (!pos) return;
  const owned = Object.keys(BLUEPRINTS).filter((k) => !G.unlocked.has(k));
  const avail = owned.filter((k) => !BLUEPRINTS[k].need || G.unlocked.has(BLUEPRINTS[k].need));
  const stock = avail.sort(() => Math.random() - 0.5).slice(0, 3);
  G.npcs.push({ x: (pos.x + 0.5) * T, y: (pos.y + 0.5) * T, kind: 'merchant', name: '精明的冬瓜', face: 1, stock, sold: [] });
  showBanner('精明的冬瓜来了！', '头顶钱袋子的红发女孩在营地附近摆摊，点她就能交易（天黑前会离开）', 4, '#ffcd75');
  sfx('coin');
}
function updateMerchant() {
  if (G.phase !== 'day') return;
  const m = merchantNpc();
  if (!m && G.merchantAt && G.timer <= G.merchantAt) { G.merchantAt = null; spawnMerchant(); }
  if (m && G.timer < 12) {
    addPuff(m.x, m.y - 6, '#ffcd75', 10);
    addFloat(m.x, m.y - 20, '冬瓜收摊啦，下次见～', '#ffcd75', true);
    removeNpc(m);
  }
}

// 交易对话框（买完会重新打开，方便连续买）
function openMerchant(npc) {
  const options = [];
  for (const k of npc.stock) {
    const bp = BLUEPRINTS[k], d = bdef(k);
    if (npc.sold.includes(k)) continue;
    options.push({
      label: '图纸·' + d.name + '（' + mcostText(bp.price) + '）',
      disabled: !canAfford(bp.price),
      action: () => {
        pay(bp.price); npc.sold.push(k); G.unlocked.add(k);
        showBanner('获得图纸：' + d.name, d.desc + '。已加入建造栏', 4, '#a7f070');
        sfx('win');
        openMerchant(npc);
      },
    });
  }
  options.push({ label: '子弹 ×20（零件 10）', disabled: G.res.parts < 10, action: () => { G.res.parts -= 10; G.res.ammo = (G.res.ammo || 0) + 20; sfx('coin'); openMerchant(npc); } });
  options.push({ label: '急救包 ×1（食物 8、水 8）', disabled: G.res.food < 8 || G.res.water < 8, action: () => { G.res.food -= 8; G.res.water -= 8; addItem('c:medkit'); sfx('coin'); openMerchant(npc); } });
  const cores = Object.keys(G.inventory).filter((k) => k[0] === 'k');
  if (cores.length) options.push({ label: '卖 1 颗' + itemName(cores[0]) + '（换零件 15）', action: () => { takeItem(cores[0]); G.res.parts += 15; sfx('coin'); openMerchant(npc); } });
  options.push({ label: '下次再说', action: () => {} });
  const lines = npc.stock.filter((k) => !npc.sold.includes(k)).map((k) => '· ' + bdef(k).name + '：' + bdef(k).desc).join('\n');
  G.dialog = {
    title: '精明的冬瓜',
    text: '“' + pick(MERCHANT_LINES) + '”\n' + (lines ? '今天的图纸（买一次永久解锁）：\n' + lines : '今天的图纸卖完啦～'),
    options,
  };
  G.state = 'dialog';
  sfx('click');
}
function mcostText(c) { return Object.keys(c).map((k) => RES_INFO[k].name + ' ' + c[k]).join('、'); }
