// =============================================
//  科技研究：每个模式在配置里定义 techs 列表
//    req   = 需要先研究的科技
//    cond  = 额外条件（例如幸福度达到多少），condText 是给玩家看的说明
//    unlock = 解锁的建筑   apply = 研究后的加成
// =============================================
function techState(t) {
  if (G.techs[t.id]) return 'done';
  if (t.req && t.req.some((r) => !G.techs[r])) return 'locked';
  if (t.cond && !t.cond()) return 'locked';
  return 'avail';
}

function techLockText(t) {
  const missing = (t.req || []).filter((r) => !G.techs[r])
    .map((r) => (G.def.techs.find((x) => x.id === r) || { name: r }).name);
  if (missing.length) return '需要先研究：' + missing.join('、');
  if (t.cond && !t.cond()) return t.condText || '条件未满足';
  return '';
}

function researchTech(t) {
  const st = techState(t);
  if (st === 'done') return;
  if (st === 'locked') { showBanner('还不能研究', techLockText(t), 2.5, '#ef7d57'); sfx('bad'); return; }
  if (!canAfford(t.cost)) { showBanner('资源不足', '研究「' + t.name + '」需要更多资源', 2, '#ef7d57'); sfx('bad'); return; }
  pay(t.cost);
  G.techs[t.id] = true;
  if (t.unlock) t.unlock.forEach((u) => G.unlocked.add(u));
  if (t.apply) t.apply(G.mods, G);
  refreshAllBuildings();
  sfx('win');
  showBanner('研究完成：' + t.name, t.desc, 3, '#ffcd75');
}

function availableTechCount() {
  return G.def.techs.filter((t) => techState(t) === 'avail' && canAfford(t.cost)).length;
}

function drawTechPanel(ctx) {
  const sw = G.sw, sh = G.sh;
  ctx.fillStyle = 'rgba(10,10,30,0.7)';
  ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, null);
  const pw = Math.min(580, sw - 16), px = (sw - pw) / 2, top = 8, bottom = sh - 8;
  drawPanel(ctx, px, top, pw, bottom - top);
  drawText(ctx, '科技研究', px + 14, top + 22, 18, '#ffcd75');
  drawButton(ctx, px + pw - 44, top + 8, 36, 30, '✕', () => { G.state = 'play'; }, { size: 14 });

  const techs = G.def.techs;
  const rowH = 66, gap = 6, listTop = top + 48, listBottom = bottom - 52;
  const perPage = Math.max(1, Math.floor((listBottom - listTop + gap) / (rowH + gap)));
  const pages = Math.max(1, Math.ceil(techs.length / perPage));
  G.techPage = Math.max(0, Math.min(pages - 1, G.techPage || 0));
  const costW = Math.min(150, pw * 0.32);

  techs.slice(G.techPage * perPage, (G.techPage + 1) * perPage).forEach((t, i) => {
    const st = techState(t), y = listTop + i * (rowH + gap);
    const color = st === 'done' ? '#1f5e3a' : st === 'avail' ? '#29366f' : '#262b44';
    drawButton(ctx, px + 8, y, pw - 16, rowH, '', () => researchTech(t), { color });
    drawText(ctx, (st === 'done' ? '✔ ' : '') + t.name, px + 20, y + 16, 15, st === 'locked' ? '#94b0c2' : '#ffcd75');
    wrapText(ctx, t.desc, pw - 50 - costW, 12).slice(0, 2).forEach((ln, k) => {
      drawText(ctx, ln, px + 20, y + 36 + k * 16, 12, '#c8d6e5', 'left', false);
    });
    const rx = px + pw - 16 - costW / 2;
    if (st === 'done') {
      drawText(ctx, '已研究', rx, y + rowH / 2, 13, '#a7f070', 'center');
    } else if (st === 'locked') {
      wrapText(ctx, techLockText(t), costW - 8, 11).slice(0, 3).forEach((ln, k, arr) => {
        drawText(ctx, ln, rx, y + rowH / 2 + (k - (arr.length - 1) / 2) * 14, 11, '#ef7d57', 'center', false);
      });
    } else {
      const h = drawCostHeight(ctx, t.cost, costW - 8, 12);
      drawCost(ctx, t.cost, rx, y + rowH / 2 - h / 2 + 7, costW - 8, 12);
    }
  });

  if (pages > 1) {
    const by = bottom - 44;
    drawButton(ctx, px + 12, by, 70, 34, '◀', () => { G.techPage--; });
    drawText(ctx, (G.techPage + 1) + ' / ' + pages, px + pw / 2, by + 17, 14, '#f4f4f4', 'center');
    drawButton(ctx, px + pw - 82, by, 70, 34, '▶', () => { G.techPage++; });
  }
}
