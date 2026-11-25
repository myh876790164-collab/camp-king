// =============================================
//  离线支持：第一次联网打开后，游戏文件都会存到手机/电脑里，之后断网也能玩
//  有网时总是先拿最新版本（不用再按 Ctrl+F5），没网时用存下来的版本
//  存档不在这里，存档在浏览器本地存储（localStorage）里
// =============================================
const CACHE = 'campking-v12';

// 安装：读 index.html，把里面引用的所有脚本一起存下来
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const base = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
    await cache.addAll(base);
    try {
      const html = await (await fetch('./index.html', { cache: 'no-cache' })).text();
      const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => './' + m[1]);
      await cache.addAll(srcs);
    } catch (err) { /* 脚本之后访问时也会被存下来 */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// 先联网取最新的，取到了顺便更新缓存；没网就用缓存
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
