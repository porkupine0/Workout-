// Iron Log offline support. The app and its photo model are kept on the phone, so the app opens and works without
// internet. Your data never goes through here: it's saved on the phone by the app itself.
const SHELL = "ironlog-shell-v1", FONTS = "ironlog-fonts-v2", VISION = "ironlog-vision-v1";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./body-scan.js"];
const OWN = [SHELL, FONTS, VISION];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES.map(u => new Request(u, { cache:"reload" })))).then(() => self.skipWaiting()));
});
// only remove this app's old caches: other apps on this site keep theirs
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("ironlog-") && !OWN.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// the page: the newest copy when online, the saved copy when offline or when the network is too slow (3.5 s)
function page(req){
  return new Promise(resolve => {
    let done = false;
    const saved = () => caches.match("./index.html", { cacheName:SHELL });
    const finish = r => { if (!done && r){ done = true; resolve(r); } };
    const timer = setTimeout(() => saved().then(finish), 3500);
    fetch(req).then(res => {
      if (res.ok){ const copy = res.clone(); caches.open(SHELL).then(c => c.put("./index.html", copy)); }
      clearTimeout(timer); finish(res);
    }).catch(() => { clearTimeout(timer); saved().then(r => finish(r || Response.error())); });
  });
}
// saved copy first, refreshed in the background
function fresh(req, name){
  return caches.open(name).then(c => c.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
}
// the photo model files never change for a version: keep them once fetched
function keep(req){
  return caches.open(VISION).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; })));
}

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate"){ e.respondWith(page(req)); return; }
  if (url.origin === location.origin){
    if (url.pathname.includes("/vision/")) e.respondWith(keep(req));
    else if (url.pathname.startsWith(new URL("./", location).pathname)) e.respondWith(fresh(req, SHELL));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(fresh(req, FONTS));
});
