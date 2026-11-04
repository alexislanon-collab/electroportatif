/* Service worker EEL — réseau d'abord (toujours à jour en ligne), cache en secours hors-ligne */
var CACHE = 'eel-v42';
var CORE = ['./','./index.html','./app.js','./manifest.json','./logo.png',
            './zxing/reader/index.js','./zxing/share.js','./zxing_reader.wasm'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(CORE.map(function(u){ return c.add(u).catch(function(){}); }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  // ne pas toucher aux requêtes non-GET ni cross-origin (API GitHub, CDN…)
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch(err){ return; }
  if (url.origin !== self.location.origin) return;
  // réseau d'abord : on sert le frais et on met à jour le cache ; hors-ligne on retombe sur le cache
  e.respondWith(
    fetch(req).then(function(res){
      if (res && res.ok){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){}); }
      return res;
    }).catch(function(){
      return caches.match(req, {ignoreSearch:true}).then(function(r){
        return r || caches.match('./index.html', {ignoreSearch:true});
      });
    })
  );
});
