// =============================================
//  操作：鼠标 / 触屏统一处理
//  点击 = 采集 / 建造 / 选中（丧尸模式：移动 / 搜索 / 对话）
//  拖动 = 移动视角；滚轮或双指 = 缩放
// =============================================
const pointers = new Map();
let drag = null, pinch = null;

function getPos(e) {
  const r = G.canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// 当前地图大小（在建筑里面时是室内地图）
function worldW() { return G.inside ? G.inside.W * T : MAP_W * T; }
function worldH() { return G.inside ? G.inside.H * T : MAP_H * T; }
function minZoom() { return G.inside ? 1.6 : Math.max(0.8, Math.min(G.sw / (MAP_W * T), G.sh / (MAP_H * T)) * 0.95); }
function defaultZoom() { return Math.max(2, Math.min(5, G.sw / (22 * T), G.sh / (16 * T))); }

function clampCamera() {
  if (!G.cam) return;
  const z = G.cam.zoom, margin = 3 * T;
  const hw = G.sw / 2 / z, hh = G.sh / 2 / z;
  const mw = worldW(), mh = worldH();
  G.cam.x = mw + margin * 2 < hw * 2 ? mw / 2 : Math.max(hw - margin, Math.min(mw + margin - hw, G.cam.x));
  G.cam.y = mh + margin * 2 < hh * 2 ? mh / 2 : Math.max(hh - margin, Math.min(mh + margin - hh, G.cam.y));
}

function zoomAt(sx, sy, zoom) {
  const before = screenToWorld(sx, sy);
  G.cam.zoom = Math.max(minZoom(), Math.min(6, zoom));
  const after = screenToWorld(sx, sy);
  G.cam.x += before.x - after.x;
  G.cam.y += before.y - after.y;
  clampCamera();
}

function handleTap(sx, sy) {
  G.lastTap = { x: sx, y: sy }; // 大地图用：点在哪里
  const hit = hitUI(sx, sy);
  if (hit) { if (hit.onClick) hit.onClick(); return; }
  if (G.scene !== 'game' || G.state !== 'play') return;
  const t = screenToTile(sx, sy), w = screenToWorld(sx, sy);
  if (G.inside && G.def.hooks.tapInside) { G.def.hooks.tapInside(t.x, t.y, w.x, w.y); return; } // 丧尸模式：在建筑里面
  if (G.buildMode) { tryBuild(G.buildMode, t.x, t.y); return; }
  if (G.def.hooks.onWorldTap && G.def.hooks.onWorldTap(w.x, w.y)) return;
  const b = inMap(t.x, t.y) ? G.bld[idx(t.x, t.y)] : null;
  if (b) { G.selected = b; return; }
  G.selected = null;
  if (G.player) { playerTap(t.x, t.y, w.x, w.y); return; }
  const n = inMap(t.x, t.y) ? G.nodes[idx(t.x, t.y)] : null;
  if (n && G.def.tapGather) tapNode(n);
}

const KEYMAP = {
  w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right',
};

function setupInput(canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    const p = getPos(e);
    pointers.set(e.pointerId, p);
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      drag = { sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: false, onUI: !!hitUI(p.x, p.y), button: e.button, scroll: scrollAreaAt(p.x, p.y) };
    } else if (pointers.size === 2 && G.cam) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: G.cam.zoom };
      if (drag) drag.moved = true;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = getPos(e);
    if (e.pointerType === 'mouse' && G.cam) G.hover = screenToTile(p.x, p.y);
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, p);
    if (G.scene !== 'game') return;
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
      return;
    }
    if (drag && pointers.size === 1) {
      if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 8) drag.moved = true;
      if (drag.moved && drag.scroll) scrollBy(drag.scroll, -(p.y - drag.ly)); // 拖动滚动面板里的文字
      if (drag.moved && !drag.onUI && G.state === 'play') {
        G.cam.x -= (p.x - drag.lx) / G.cam.zoom;
        G.cam.y -= (p.y - drag.ly) / G.cam.zoom;
        G.camFollow = false;
        clampCamera();
      }
      drag.lx = p.x;
      drag.ly = p.y;
    }
  });

  const end = (e) => {
    const p = getPos(e);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (e.type === 'pointerup' && drag && !drag.moved && pointers.size === 0) {
      if (drag.button === 2) G.buildMode = null;
      else handleTap(p.x, p.y);
    }
    if (pointers.size === 1 && drag) {
      const rest = [...pointers.values()][0];
      drag.lx = rest.x;
      drag.ly = rest.y;
    }
    if (pointers.size === 0) drag = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') G.hover = null; });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (G.scene !== 'game' || !G.cam) return;
    const p = getPos(e);
    const area = scrollAreaAt(p.x, p.y);
    if (area) { scrollBy(area, e.deltaY > 0 ? 48 : -48); return; } // 滚轮滚动面板
    if (G.state !== 'play') return; // 打开面板时不缩放地图
    zoomAt(p.x, p.y, G.cam.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (G.scene !== 'game') return;
    if (KEYMAP[key] && G.player) {
      G.keys[KEYMAP[key]] = true;
      e.preventDefault();
      return;
    }
    if (key === 'm' && G.scene === 'game' && G.state === 'play') { G.mapOpen = !G.mapOpen; return; } // M 键：大地图
    if (key === 'escape') {
      if (G.confirm) G.confirm = null;
      else if (G.mapOpen) G.mapOpen = false;
      else if (G.buildMode || G.selected) { G.buildMode = null; G.selected = null; }
      else if (G.state === 'play') G.state = 'paused';
      else if (G.state === 'paused' || G.state === 'tech' || G.state === 'equip' || G.state === 'members') G.state = 'play';
      return;
    }
    if (G.state !== 'play') return;
    const n = parseInt(key, 10);
    const list = unlockedBuildList();
    if (n >= 1 && n <= Math.min(9, list.length)) {
      const type = list[n - 1];
      G.buildMode = G.buildMode === type ? null : type;
      G.selected = null;
    } else if (key === ' ') {
      G.speed = G.speed >= 3 ? 1 : G.speed + 1;
      e.preventDefault();
    } else if (key === 'n') {
      startNightEarly();
    } else if (key === 't') {
      G.state = 'tech';
    } else if (key === 'e' && G.mode === 'zombie') {
      G.state = 'equip';
    } else if (key === 'e' && G.mode === 'island') {
      openMembers();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.key.toLowerCase()];
    if (k) G.keys[k] = false;
  });
  window.addEventListener('blur', () => { G.keys = {}; });
}
