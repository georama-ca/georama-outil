// Hub Georama — démarrage, coquille (menu Cockpit), navigation et connexion.
import { CONFIG } from '../config.js';
import * as auth from './auth.js';
import { Magasin, AdaptateurLocal, AdaptateurOneDrive, lireLieu, ecrireLieu } from './store.js';
import { reglages, REGLAGES_DEFAUT } from './donnees.js';
import { donneesDemo, amsVides } from './demo.js';
import { esc, ico, toast, initiales, prenom } from './ui.js';
import tableau from './vues/tableau.js';
import commandes from './vues/commandes.js';
import production from './vues/production.js';
import marketing from './vues/marketing.js';
import finances from './vues/finances.js';
import parametres from './vues/parametres.js';

const VUES = { '': tableau, commandes, production, marketing, finances, parametres };
const MENU = [
  { id: '', nom: 'Tableau de bord', ico: 'accueil' },
  { id: 'commandes', nom: 'Commandes et clients', ico: 'commandes' },
  { id: 'production', nom: 'Production', ico: 'production' },
  { id: 'marketing', nom: 'Marketing et prospection', ico: 'marketing' },
  { id: 'finances', nom: 'Finances', ico: 'finances' },
];
const CLE_MODE = 'georama-hub-mode';
const CLE_MOI_DEMO = 'georama-hub-moi-demo';

const racine = document.getElementById('app');
const ctx = {
  m: null, mode: 'demo', moi: '', courriel: '', etat: {},
  get R() { return reglages(ctx.m); },
  get membres() { const l = ctx.R.membres || []; return l.includes(ctx.moi) || !ctx.moi ? l : l.concat([ctx.moi]); },
  route: { vue: '', sous: '', id: '' },
  aller(h) { if (location.hash === h) ctx.rendre(); else location.hash = h; },
  rendre: () => rendre(),
  toast,
};

function lireRoute() {
  const h = (location.hash || '#/').replace(/^#\/?/, '');
  const [chemin, q] = h.split('?');
  const p = chemin.split('/').map(decodeURIComponent);
  return { vue: VUES[p[0]] ? p[0] : '', sous: p[1] || '', id: p[2] || '', q: new URLSearchParams(q || '') };
}

function etatSync() {
  const m = ctx.m;
  if (ctx.mode === 'demo') return `<span class="pastille-etat attente"></span><span class="tres-petit doux">Mode démo · ce navigateur seulement</span>`;
  if (m.etat === 'erreur') return `<span class="pastille-etat erreur"></span><span class="tres-petit" style="color:var(--balise)">Pas enregistré : ${esc(m.erreur)}. Nouvel essai sous peu.</span>`;
  if (m.etat === 'attente' || m.enAttente()) return `<span class="pastille-etat attente"></span><span class="tres-petit doux">Enregistrement dans OneDrive…</span>`;
  const h = m.derniere ? m.derniere.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }) : '';
  return `<span class="pastille-etat"></span><span class="tres-petit doux">OneDrive Georama · à jour ${esc(h)}</span>`;
}

function coquille(corps) {
  const r = ctx.route;
  const nav = MENU.map(i => `<a class="nav" href="#/${i.id}"${r.vue === i.id ? ' aria-current="page"' : ''}>${ico(i.ico)}<span>${esc(i.nom)}</span></a>`).join('');
  const choixMoi = ctx.mode === 'demo'
    ? `<label class="tres-petit doux" for="moi-demo">Je suis</label>
       <select id="moi-demo" data-chg="moi-demo">${ctx.membres.map(n => `<option${n === ctx.moi ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`
    : `<button type="button" class="btn-lien" data-act="deconnexion">Se déconnecter</button>`;
  return `<div class="coquille">
    <nav class="menu" aria-label="Menu principal">
      <p class="marque">GEORAMA</p>
      <p class="surtitre sous-marque" style="font-size:11px">Hub · v${esc(CONFIG.version)}</p>
      ${nav}
      <div class="espace"></div>
      <a class="nav" href="#/parametres"${r.vue === 'parametres' ? ' aria-current="page"' : ''}>${ico('reglages')}<span>Paramètres</span></a>
      <div class="qui">
        <div class="qui-ligne"><span class="initiales moi">${esc(initiales(ctx.moi))}</span><span class="petit" style="font-weight:600">${esc(ctx.moi)}</span></div>
        ${choixMoi}
      </div>
      <p class="sync" id="sync">${etatSync()}</p>
    </nav>
    <main class="contenu" id="contenu">${corps}</main>
  </div>`;
}

function rendre() {
  if (!ctx.m) return;
  ctx.route = lireRoute();
  const vue = VUES[ctx.route.vue];
  const actif = document.activeElement;
  const focusId = actif && actif.id && racine.contains(actif) ? actif.id : null;
  const sel = focusId && typeof actif.selectionStart === 'number' ? [actif.selectionStart, actif.selectionEnd] : null;
  const defile = window.scrollY;
  let corps;
  try { corps = vue.render(ctx); }
  catch (e) { console.error(e); corps = `<div class="bandeau"><strong class="o">Oups.</strong><span>Cet écran a eu un problème : ${esc(e.message)}. Les données ne sont pas touchées.</span></div>`; }
  racine.innerHTML = coquille(corps);
  document.title = (vue.titre ? vue.titre + ' · ' : '') + 'Hub Georama';
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* type sans sélection */ } } }
  }
  if (ctx.dernierHash === location.hash) window.scrollTo(0, defile);
  ctx.dernierHash = location.hash;
  if (vue.apres) vue.apres(ctx, racine);
}

function vueActive() { return VUES[ctx.route.vue]; }
function trouver(ev, attr) { const el = ev.target.closest('[' + attr + ']'); return el && racine.contains(el) ? el : null; }

racine.addEventListener('click', ev => {
  const el = trouver(ev, 'data-act');
  if (!el) return;
  const nom = el.getAttribute('data-act');
  if (GLOBAL[nom]) { ev.preventDefault(); GLOBAL[nom](el, ev); return; }
  const v = vueActive();
  if (v.actions && v.actions[nom]) { ev.preventDefault(); v.actions[nom](ctx, el, ev); }
});
['change', 'input'].forEach(type => racine.addEventListener(type, ev => {
  const el = trouver(ev, type === 'change' ? 'data-chg' : 'data-input');
  if (!el) return;
  const nom = el.getAttribute(type === 'change' ? 'data-chg' : 'data-input');
  if (GLOBAL[nom]) { GLOBAL[nom](el, ev); return; }
  const v = vueActive();
  const h = v.changes && v.changes[nom];
  if (h) h(ctx, el, ev);
}));
racine.addEventListener('submit', ev => {
  const f = ev.target.closest('form[data-form]');
  if (!f) return;
  ev.preventDefault();
  const data = {};
  new FormData(f).forEach((v, k) => { data[k] = typeof v === 'string' ? v.trim() : v; });
  const v = vueActive();
  const h = v.formulaires && v.formulaires[f.getAttribute('data-form')];
  if (h) h(ctx, data, f);
});

const GLOBAL = {
  'moi-demo': el => { ctx.moi = el.value; try { localStorage.setItem(CLE_MOI_DEMO, el.value); } catch (e) { /* rien */ } ctx.m.qui = el.value; rendre(); },
  deconnexion: () => { if (confirm('Te déconnecter du hub ?')) auth.seDeconnecter(); },
  connexion: () => auth.seConnecter(),
  'mode-demo': () => { try { localStorage.setItem(CLE_MODE, 'demo'); } catch (e) { /* rien */ } location.reload(); },
};
ctx.global = GLOBAL;

/* ---------- Écrans avant le hub ---------- */
function ecranConnexion(message) {
  racine.innerHTML = `<div class="connexion"><div class="boite">
    <p class="marque" style="margin:0">GEORAMA</p>
    <p class="surtitre">Hub · v${esc(CONFIG.version)}</p>
    <h1 class="titre-1" style="font-size:26px;line-height:32px">Bonjour</h1>
    <p class="doux" style="margin:0">Connecte-toi avec ton compte Microsoft 365 Georama. Les données restent dans le OneDrive Georama.</p>
    ${message ? `<div class="bandeau"><span>${esc(message)}</span></div>` : ''}
    <button type="button" class="btn" id="btn-connexion">Se connecter avec Microsoft</button>
    <button type="button" class="btn-lien" id="btn-demo" style="align-self:flex-start">Essayer en mode démo (sans connexion)</button>
  </div></div>`;
  document.getElementById('btn-connexion').onclick = () => { try { localStorage.setItem(CLE_MODE, 'm365'); } catch (e) { /* rien */ } auth.seConnecter(); };
  document.getElementById('btn-demo').onclick = GLOBAL['mode-demo'];
}

function ecranDossier(adaptateur, message) {
  racine.innerHTML = `<div class="connexion"><div class="boite">
    <p class="marque" style="margin:0">GEORAMA</p>
    <h1 class="titre-1" style="font-size:24px;line-height:30px">Où sont les données du hub ?</h1>
    <p class="doux" style="margin:0">Une seule fois par appareil. Choisis selon ta situation.</p>
    ${message ? `<div class="bandeau"><span>${esc(message)}</span></div>` : ''}
    <div class="carte" style="display:flex;flex-direction:column;gap:10px">
      <strong>Je crée le hub</strong>
      <span class="petit doux">Crée (ou retrouve) le dossier <strong>${esc(CONFIG.dossier)}</strong> dans ton OneDrive Georama.</span>
      <button type="button" class="btn" id="btn-creer">Utiliser mon OneDrive</button>
    </div>
    <div class="carte" style="display:flex;flex-direction:column;gap:10px">
      <strong>On m'a partagé le dossier</strong>
      <label class="petit doux" for="lien-partage">Colle le lien de partage du dossier Hub-Georama (accès en modification).</label>
      <input type="url" id="lien-partage" placeholder="https://georama-my.sharepoint.com/…">
      <button type="button" class="btn-2" id="btn-lien">Utiliser ce dossier partagé</button>
    </div>
  </div></div>`;
  const occupe = (b, t) => { b.disabled = true; b.textContent = t; };
  document.getElementById('btn-creer').onclick = async e => {
    occupe(e.target, 'Préparation…');
    try { await adaptateur.creerDansMonOneDrive(); demarrer(); } catch (err) { ecranDossier(adaptateur, err.message); }
  };
  document.getElementById('btn-lien').onclick = async e => {
    const v = document.getElementById('lien-partage').value;
    if (!v) return;
    occupe(e.target, 'Vérification…');
    try { await adaptateur.utiliserLienPartage(v); demarrer(); } catch (err) { ecranDossier(adaptateur, err.message); }
  };
}

/* ---------- Démarrage ---------- */
async function demarrer() {
  const retour = await auth.traiterRetour();
  let mode = 'demo';
  try { mode = localStorage.getItem(CLE_MODE) || ''; } catch (e) { mode = ''; }
  if (retour.statut === 'connecte') mode = 'm365';
  if (!auth.idsConfigures()) mode = 'demo';
  else if (!mode) mode = auth.estConnecte() ? 'm365' : '';
  if (mode === 'm365' && !auth.estConnecte()) { ecranConnexion(retour.statut === 'erreur' ? retour.message : ''); return; }
  if (!mode) { ecranConnexion(retour.statut === 'erreur' ? retour.message : ''); return; }
  try { localStorage.setItem(CLE_MODE, mode); } catch (e) { /* rien */ }
  ctx.mode = mode;

  if (mode === 'm365') {
    const u = auth.utilisateur();
    ctx.moi = u ? u.nom : 'Moi';
    ctx.courriel = u ? u.courriel : '';
    const a = new AdaptateurOneDrive();
    if (!lireLieu()) { ecranDossier(a); return; }
    ctx.m = new Magasin(a, ctx.moi);
    racine.innerHTML = '<p style="padding:40px" class="doux">Lecture des données dans OneDrive…</p>';
    try {
      const { vides } = await ctx.m.charger();
      if (vides.includes('reglages')) {
        const membres = REGLAGES_DEFAUT.membres.includes(ctx.moi) ? REGLAGES_DEFAUT.membres : [ctx.moi].concat(REGLAGES_DEFAUT.membres);
        ctx.m.mettre('reglages', Object.assign({}, REGLAGES_DEFAUT, { membres }), true);
      }
      if (vides.includes('filament')) amsVides().forEach(x => ctx.m.mettre('filament', x, true));
    } catch (e) {
      if (e.code === 'non_connecte') { ecranConnexion(e.message); return; }
      if (/\(40[34]\)/.test(e.message)) { ecrireLieu(null); ecranDossier(a, 'Le dossier n’est plus accessible. Choisis-le de nouveau.'); return; }
      racine.innerHTML = `<div class="connexion"><div class="boite"><h1 class="titre-3">Lecture impossible</h1><p class="doux">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Réessayer</button></div></div>`;
      return;
    }
  } else {
    const a = new AdaptateurLocal();
    let moi = '';
    try { moi = localStorage.getItem(CLE_MOI_DEMO) || ''; } catch (e) { moi = ''; }
    ctx.moi = moi || REGLAGES_DEFAUT.membres[0];
    ctx.m = new Magasin(a, ctx.moi);
    const { vides } = await ctx.m.charger();
    if (vides.includes('commandes') && vides.includes('reglages')) {
      const d = donneesDemo();
      Object.entries(d).forEach(([c, items]) => ctx.m.remplacerTout(c, items));
    }
  }

  ctx.m.abonner(source => {
    if (source === 'etat') { const s = document.getElementById('sync'); if (s) s.innerHTML = etatSync(); return; }
    rendre();
  });
  window.addEventListener('hashchange', rendre);
  if (ctx.mode !== 'demo') {
    setInterval(() => { if (document.visibilityState === 'visible') ctx.m.rafraichir(); }, 45000);
    window.addEventListener('focus', () => ctx.m.rafraichir());
  }
  window.addEventListener('beforeunload', ev => { if (ctx.m.enAttente() && ctx.mode !== 'demo') { ev.preventDefault(); ev.returnValue = ''; } });
  ctx.prenom = prenom(ctx.moi);
  rendre();
}

demarrer().catch(e => {
  console.error(e);
  racine.innerHTML = `<div class="connexion"><div class="boite"><h1 class="titre-3">Le hub n'a pas pu démarrer</h1><p class="doux">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Réessayer</button></div></div>`;
});
