// Hub Georama — démarrage, coquille (menu Cockpit), navigation et connexion.
import { CONFIG } from '../config.js';
import * as auth from './auth.js';
import { Magasin, AdaptateurLocal, AdaptateurOneDrive, lireLieu, ecrireLieu } from './store.js';
import { reglages, nomDuCompte, REGLAGES_DEFAUT, importerWix, journaliser, CATEGORIES_TEMPS, minutesSemaine, nomSegment, statut as statutCmd, icoSegment } from './donnees.js';
import { donneesDemo, amsVides } from './demo.js';
import { demarrerAgentDemo } from './demo-agent.js';
import { synchroniserCourriels } from './suivi-courriels.js';
import { esc, ico, toast, initiales, prenom, ouvrirFenetre, fermerFenetre, options, uid, heures, aujourdhui, argent, dateCourte } from './ui.js';
import { ouvrirCommande } from './vues/commandes.js';
import tableau from './vues/tableau.js';
import commandes from './vues/commandes.js';
import production, { placerCadre, modeProdMax, outilsProd } from './vues/production.js';
import marketing from './vues/marketing.js';
import finances from './vues/finances.js';
import parametres from './vues/parametres.js';
import taches, { colonneDe, COLONNES } from './vues/taches.js';

const VUES = { '': tableau, taches, commandes, production, marketing, finances, parametres };
const MENU = [
  { id: '', nom: 'Tableau de bord', court: 'Accueil', ico: 'accueil' },
  { id: 'taches', nom: 'Tâches', court: 'Tâches', ico: 'taches', pasEnBas: true }, // au cellulaire : dans Accueil
  { id: 'commandes', nom: 'Commandes et clients', court: 'Commandes', ico: 'commandes' },
  { id: 'production', nom: 'Production', court: 'Production', ico: 'production' },
  { id: 'marketing', nom: 'Marketing et prospection', court: 'Marketing', ico: 'marketing' },
  { id: 'finances', nom: 'Finances', court: 'Finances', ico: 'finances' },
];
const CLE_MODE = 'georama-hub-mode';
const CLE_MOI_DEMO = 'georama-hub-moi-demo';
const CLE_CHRONO_G = 'georama-hub-chrono-global';

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
  const nav = MENU.map(i => `<a class="nav" href="#/${i.id}" title="${esc(i.nom)}"${r.vue === i.id ? ' aria-current="page"' : ''}>${ico(i.ico)}<span>${esc(i.nom)}</span></a>`).join('');
  const choixMoi = ctx.mode === 'demo'
    ? `<label class="tres-petit doux" for="moi-demo">Je suis</label>
       <select id="moi-demo" data-chg="moi-demo">${ctx.membres.map(n => `<option${n === ctx.moi ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`
    : `<button type="button" class="btn-lien" data-act="deconnexion">Se déconnecter</button>`;
  return `<div class="coquille">
    <nav class="menu" aria-label="Menu principal">
      <p class="marque">GEORAMA</p>
      <p class="surtitre sous-marque" style="font-size:11px">Hub · v${esc(CONFIG.version)}</p>
      <button type="button" class="nav-recherche" data-act="recherche" aria-label="Rechercher (Ctrl+K)">${ico('loupe')}<span>Rechercher…</span><kbd>Ctrl K</kbd></button>
      ${nav}
      <div class="espace"></div>
      <a class="nav" href="#/parametres" title="Paramètres"${r.vue === 'parametres' ? ' aria-current="page"' : ''}>${ico('reglages')}<span>Paramètres</span></a>
      <div class="qui">
        <div class="qui-ligne"><span class="initiales moi">${esc(initiales(ctx.moi))}</span><span class="petit" style="font-weight:600">${esc(ctx.moi)}</span></div>
        <div id="chrono-g">${chronoHtml()}</div>
        ${choixMoi}
      </div>
      <p class="sync" id="sync">${etatSync()}</p>
      ${r.vue === 'production' && r.sous === 'georama' ? outilsProd(ctx) : ''}
      <div class="barre-mobile" aria-label="Raccourcis">
        <span id="chrono-m">${chronoMobile()}</span>
        <button type="button" class="icone-barre" data-act="recherche" aria-label="Rechercher">${ico('loupe')}</button>
        <a class="icone-barre initiales-barre${r.vue === 'parametres' ? ' actif' : ''}" href="#/parametres" aria-label="Paramètres et mon compte (${esc(ctx.moi)})">${esc(initiales(ctx.moi))}</a>
      </div>
    </nav>
    <main class="contenu" id="contenu">${corps}</main>
    <nav class="onglets-bas" aria-label="Menu principal">
      ${MENU.filter(i => !i.pasEnBas).map(i => `<a href="#/${i.id}"${r.vue === i.id || (i.id === '' && r.vue === 'taches') ? ' aria-current="page"' : ''}>${ico(i.ico)}<span>${esc(i.court)}</span></a>`).join('')}
    </nav>
  </div>`;
}

/* ---------- Chrono Georama (temps de travail) ---------- */
function lireChronoG() { try { return JSON.parse(localStorage.getItem(CLE_CHRONO_G) || 'null'); } catch (e) { return null; } }
function chronoHtml() {
  const c = lireChronoG();
  const sem = minutesSemaine(ctx.m, ctx.moi);
  const obj = (ctx.R.heuresSemaine || 10) * 60;
  if (c && c.qui === ctx.moi) {
    const min = Math.floor((Date.now() - c.debut) / 60000);
    return `<button type="button" class="btn" data-act="chrono-stop" style="width:100%"><span class="pastille-etat" style="background:var(--sur-accent)"></span>Arrêter · <span class="num">${heures(min / 60)}</span></button>
      <span class="tres-petit doux">Semaine : ${heures((sem + min) / 60)} sur ${heures(obj / 60)}</span>`;
  }
  return `<button type="button" class="btn-2" data-act="chrono-start" style="width:100%">Démarrer mon chrono</button>
    <span class="tres-petit doux">Semaine : ${heures(sem / 60)} sur ${heures(obj / 60)}</span>`;
}
// Cellulaire : le chrono tient dans un bouton de la barre du haut.
function chronoMobile() {
  const c = lireChronoG();
  if (c && c.qui === ctx.moi) {
    const min = Math.floor((Date.now() - c.debut) / 60000);
    return `<button type="button" class="icone-barre chrono-actif" data-act="chrono-stop" aria-label="Arrêter mon chrono">${ico('chrono')}<span class="num">${heures(min / 60)}</span></button>`;
  }
  return `<button type="button" class="icone-barre" data-act="chrono-start" aria-label="Démarrer mon chrono">${ico('chrono')}</button>`;
}
function majChrono() {
  if (!ctx.m) return;
  const el = document.getElementById('chrono-g'); if (el) el.innerHTML = chronoHtml();
  const em = document.getElementById('chrono-m'); if (em) em.innerHTML = chronoMobile();
}
function arreterChrono() {
  const c = lireChronoG();
  if (!c) return;
  const min = Math.max(1, Math.round((Date.now() - c.debut) / 60000));
  const cmds = ctx.m.liste('commandes').filter(x => ['nouvelle', 'approbation', 'production', 'finition'].includes(x.statut));
  ouvrirFenetre({
    titre: 'Bravo : ' + heures(min / 60) + ' pour Georama',
    corps: `<div class="champs">
      <div class="champ"><label for="ch-min">Minutes</label><input id="ch-min" name="minutes" type="number" min="1" max="1440" value="${min}"></div>
      <div class="champ"><label for="ch-cat">Sur quoi ?</label><select id="ch-cat" name="categorie">${options(CATEGORIES_TEMPS, c.categorie || 'Production')}</select></div>
      <div class="champ plein"><label for="ch-cmd">Commande (optionnel)</label><select id="ch-cmd" name="commande">${options(cmds.map(x => ({ id: x.id, nom: x.numero + ' · ' + (x.lieu || x.client) })), '', 'Aucune')}</select></div>
      <div class="champ plein"><label for="ch-note">Note</label><input id="ch-note" name="note" type="text" placeholder="Ex. : appels de prospection Mauricie"></div>
    </div>`,
    onSubmit(d) {
      const minutes = Math.max(1, Number(d.minutes) || min);
      ctx.m.mettre('temps', { id: uid('h'), qui: ctx.moi, date: aujourdhui(), minutes, categorie: d.categorie, commande: d.commande || '', note: d.note || '' }, true);
      if (d.commande) { const x = ctx.m.get('commandes', d.commande); if (x) ctx.m.modifier('commandes', x.id, { tempsMin: (Number(x.tempsMin) || 0) + minutes }, true); }
      try { localStorage.removeItem(CLE_CHRONO_G); } catch (e) { /* rien */ }
      ctx.m.avertir('local');
      toast(heures(minutes / 60) + ' ajoutées à ta semaine. Beau travail.');
    },
  });
}

/* ---------- Recherche rapide (Ctrl+K) ---------- */
function ouvrirRecherche() {
  const pages = [
    { t: 'Tableau de bord', s: 'Page', h: '#/' }, { t: 'Tâches', s: 'Page', h: '#/taches' }, { t: 'Commandes', s: 'Page', h: '#/commandes' }, { t: 'Clients', s: 'Page', h: '#/commandes/clients' },
    { t: 'File d\u2019impression', s: 'Production', h: '#/production' }, { t: 'Fiche de production', s: 'Production', h: '#/production/fiche' },
    { t: 'Planification', s: 'Production', h: '#/production/planification' }, { t: 'Filament et AMS', s: 'Production', h: '#/production/filament' },
    { t: 'Prospection', s: 'Marketing', h: '#/marketing' }, { t: 'Campagnes', s: 'Marketing', h: '#/marketing/campagnes' },
    { t: 'Finances', s: 'Page', h: '#/finances' }, { t: 'Dépenses', s: 'Finances', h: '#/finances/depenses' }, { t: 'Paramètres', s: 'Page', h: '#/parametres' },
  ];
  const actions = [
    { t: 'Nouvelle commande', s: 'Action', f: () => ouvrirCommande(ctx, null) },
    { t: 'Démarrer mon chrono', s: 'Action', f: () => GLOBAL['chrono-start']() },
  ];
  const { dialog } = ouvrirFenetre({
    titre: 'Rechercher', pied: false,
    corps: `<label class="sr" for="rech">Rechercher</label>
      <input id="rech" type="search" placeholder="Numéro, client, lieu, prospect, page…" autocomplete="off">
      <div id="rech-res" role="listbox" style="margin-top:12px;display:flex;flex-direction:column;gap:2px;max-height:60vh;overflow:auto"></div>
      <p class="tres-petit doux" style="margin:10px 0 0">↑ ↓ pour choisir, Entrée pour ouvrir, Échap pour fermer.</p>`,
  });
  const inp = dialog.querySelector('#rech');
  const zone = dialog.querySelector('#rech-res');
  let res = [], actif = 0;
  const calc = () => {
    const q = inp.value.trim().toLowerCase();
    const l = [];
    const ok = (...v) => !q || v.some(x => String(x || '').toLowerCase().includes(q));
    ctx.m.liste('commandes').filter(c => ok(c.numero, c.client, c.lieu, c.courriel, nomSegment(c.segment)))
      .sort((a, b) => String(b.recue).localeCompare(String(a.recue))).slice(0, q ? 8 : 4)
      .forEach(c => l.push({ t: c.numero + ' · ' + c.client, s: statutCmd(c.statut).nom + ' · ' + (c.lieu || nomSegment(c.segment)), seg: c.segment, f: () => ouvrirCommande(ctx, c.id) }));
    ctx.m.liste('taches').filter(t => q && ok(t.titre, t.desc)).sort((a, b) => Number(colonneDe(a) === 'termine') - Number(colonneDe(b) === 'termine')).slice(0, 6)
      .forEach(t => l.push({ t: t.titre, s: 'Tâche · ' + ((COLONNES.find(c => c.id === colonneDe(t)) || {}).nom || ''), h: '#/taches/carte/' + t.id }));
    ctx.m.liste('prospects').filter(p => q && ok(p.organisation, p.contact, p.region)).slice(0, 5)
      .forEach(p => l.push({ t: p.organisation, s: 'Prospect · ' + (p.region || p.type || ''), h: '#/marketing' }));
    ctx.m.liste('depenses').filter(d => q && ok(d.fournisseur, d.note, d.categorie)).slice(0, 3)
      .forEach(d => l.push({ t: d.fournisseur + ' · ' + argent(d.montant, 2), s: 'Dépense · ' + dateCourte(d.date), h: '#/finances/depenses' }));
    actions.filter(a => ok(a.t)).forEach(a => l.push(a));
    pages.filter(p => ok(p.t, p.s)).forEach(p => l.push(p));
    res = l.slice(0, 14);
    actif = 0;
    zone.innerHTML = res.map((r, i) => `<button type="button" class="ligne ligne-btn rech-item" data-i="${i}" role="option" aria-selected="${i === actif}" style="border-top:0;border-radius:6px;padding:10px 12px">
      ${r.seg ? icoSegment(r.seg) : ''}<span class="grow"><strong>${esc(r.t)}</strong><br><span class="tres-petit doux">${esc(r.s)}</span></span></button>`).join('') || '<p class="vide">Rien trouvé.</p>';
  };
  const choisir = i => { const r = res[i]; if (!r) return; fermerFenetre(); if (r.f) r.f(); else ctx.aller(r.h); };
  const surligner = () => zone.querySelectorAll('.rech-item').forEach((b, i) => { b.setAttribute('aria-selected', i === actif); b.style.background = i === actif ? 'var(--fond)' : ''; if (i === actif) b.scrollIntoView({ block: 'nearest' }); });
  inp.addEventListener('input', () => { calc(); surligner(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { actif = Math.min(res.length - 1, actif + 1); surligner(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { actif = Math.max(0, actif - 1); surligner(); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); choisir(actif); }
  });
  zone.addEventListener('click', e => { const b = e.target.closest('.rech-item'); if (b) choisir(Number(b.dataset.i)); });
  calc(); surligner();
  inp.focus();
}

function aideRaccourcis() {
  ouvrirFenetre({ titre: 'Raccourcis clavier', pied: false, corps: `
    <div class="ligne"><span class="grow">Rechercher n'importe quoi</span><kbd>Ctrl K</kbd> <kbd>/</kbd></div>
    <div class="ligne"><span class="grow">Nouvelle commande</span><kbd>N</kbd></div>
    <div class="ligne"><span class="grow">Démarrer ou arrêter mon chrono</span><kbd>T</kbd></div>
    <div class="ligne"><span class="grow">Tableau de bord · Commandes · Production · Marketing · Finances</span><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> <kbd>5</kbd></div>
    <div class="ligne"><span class="grow">Cette aide</span><kbd>?</kbd></div>` });
}

document.addEventListener('keydown', e => {
  if (!ctx.m) return;
  const modal = document.getElementById('modal').open;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!modal) ouvrirRecherche(); return; }
  const t = e.target;
  if (modal || e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
  const k = e.key;
  if (k === '/') { e.preventDefault(); ouvrirRecherche(); }
  else if (k === 'n' || k === 'N') { e.preventDefault(); ouvrirCommande(ctx, null); }
  else if (k === 't' || k === 'T') { e.preventDefault(); (lireChronoG() ? GLOBAL['chrono-stop'] : GLOBAL['chrono-start'])(); }
  else if (k === '?') { e.preventDefault(); aideRaccourcis(); }
  else if (/^[1-5]$/.test(k)) { ctx.aller('#/' + MENU[Number(k) - 1].id); }
});

function verifierWix() {
  const l = importerWix(ctx.m);
  if (l.length) toast(l.length === 1 ? 'Nouvelle commande du site : ' + l[0].numero + ' (' + l[0].client + '). Elle est dans la file.' : l.length + ' nouvelles commandes du site ajoutées.');
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
  catch (e) {
    console.error(e);
    const pile = String(e.stack || '').split('\n').slice(0, 4).map(l => l.replace(/https?:\/\/[^/]+\/hub\//g, '')).join('\n');
    corps = `<div class="bandeau" style="flex-direction:column;align-items:flex-start"><span><strong class="o">Oups.</strong> Cet écran a eu un problème : ${esc(e.message)}. Les données ne sont pas touchées.</span>
      <span class="petit">Essaie d'abord de recharger la page sans cache. Si ça revient, envoie une capture de ce cadre à Claude.</span>
      <button type="button" class="btn-2" onclick="location.reload()">Recharger</button>
      <pre class="tres-petit doux" style="white-space:pre-wrap;margin:0">v${esc(CONFIG.version)} · ${esc(pile)}</pre></div>`;
  }
  const modeProd = ctx.route.vue === 'production' && ctx.route.sous === 'georama';
  document.body.classList.toggle('mode-prod', modeProd);
  document.body.classList.toggle('mode-prod-max', modeProd && modeProdMax());
  racine.innerHTML = coquille(corps);
  document.title = (vue.titre ? vue.titre + ' · ' : '') + 'Hub Georama';
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* type sans sélection */ } } }
  }
  if (ctx.dernierHash === location.hash) window.scrollTo(0, defile);
  ctx.dernierHash = location.hash;
  if (vue.apres) vue.apres(ctx, racine);
  placerCadre();
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
  recherche: () => ouvrirRecherche(),
  'chrono-start': () => {
    try { localStorage.setItem(CLE_CHRONO_G, JSON.stringify({ debut: Date.now(), qui: ctx.moi })); } catch (e) { /* rien */ }
    majChrono();
    toast('Chrono démarré. Bonne session de travail.');
  },
  'chrono-stop': () => arreterChrono(),
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
      const nom = nomDuCompte(reglages(ctx.m), ctx.courriel, ctx.moi);
      if (nom !== ctx.moi) { ctx.moi = nom; ctx.m.qui = nom; }
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

  try {
    ctx.vuAvant = localStorage.getItem('georama-hub-vu:' + ctx.moi) || '';
    // Première visite en démo : faire comme si la dernière visite datait d'hier soir
    if (!ctx.vuAvant && ctx.mode === 'demo') ctx.vuAvant = new Date(Date.now() - 12 * 3600000).toISOString();
    localStorage.setItem('georama-hub-vu:' + ctx.moi, new Date().toISOString());
  } catch (e) { ctx.vuAvant = ''; }
  ctx.journal = (texte, lien, type) => journaliser(ctx.m, texte, lien, type);
  ctx.m.abonner(source => {
    if (source === 'etat') { const s = document.getElementById('sync'); if (s) s.innerHTML = etatSync(); return; }
    if (source === 'distant') verifierWix();
    rendre();
  });
  verifierWix();
  if (ctx.mode === 'demo') demarrerAgentDemo(ctx.m);
  setInterval(majChrono, 20000);
  window.addEventListener('hashchange', rendre);
  if (ctx.mode !== 'demo') {
    setInterval(() => { if (document.visibilityState === 'visible') ctx.m.rafraichir(); }, 30000);
    window.addEventListener('focus', () => ctx.m.rafraichir());
    // Suivi des courriels de prospection (en-têtes seulement), au plus toutes les 15 minutes
    setTimeout(() => synchroniserCourriels(ctx), 4000);
    setInterval(() => { if (document.visibilityState === 'visible') synchroniserCourriels(ctx); }, 5 * 60000);
  }
  window.addEventListener('beforeunload', ev => { if (ctx.m.enAttente() && ctx.mode !== 'demo') { ev.preventDefault(); ev.returnValue = ''; } });
  ctx.prenom = prenom(ctx.moi);
  rendre();
}

demarrer().catch(e => {
  console.error(e);
  racine.innerHTML = `<div class="connexion"><div class="boite"><h1 class="titre-3">Le hub n'a pas pu démarrer</h1><p class="doux">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Réessayer</button></div></div>`;
});
