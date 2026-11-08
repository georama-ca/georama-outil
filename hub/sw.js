// Hub Georama : service worker de l'appli installée (cellulaire, ordinateur).
// Aucun fichier en cache : l'appli charge toujours la version en ligne du hub,
// donc elle suit chaque mise à jour toute seule. Sans réseau : petite page d'attente.
const VERSION = '1.5.0';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.clients.claim();
  })());
});

const HORS_LIGNE = `<!doctype html><html lang="fr-CA"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Hub Georama</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0D1110;color:#F3F3EF;font-family:Montserrat,system-ui,sans-serif;text-align:center;padding:24px}
button{margin-top:16px;padding:12px 20px;border-radius:10px;border:0;background:#93AA5F;color:#0D1110;font-weight:600;font-size:16px}</style></head>
<body><div><h1 style="font-size:20px">Pas de connexion Internet</h1>
<p>Le hub a besoin d'Internet pour lire les données dans OneDrive.</p>
<button onclick="location.reload()">Réessayer</button></div></body></html>`;

self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;   // le reste passe directement au réseau
  e.respondWith(fetch(e.request).catch(() => new Response(HORS_LIGNE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
