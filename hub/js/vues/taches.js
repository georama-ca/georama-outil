// Tâches (v1.8) : tableau Kanban de l'équipe, qui remplace le tableau Trello « Georama · Pilotage ».
// Mêmes colonnes et mêmes couleurs d'étiquettes que dans Trello. Glisser-déposer à l'ordinateur ;
// au cellulaire, on change de colonne dans la carte. Les tâches du tableau de bord sont les mêmes.
import { esc, ico, toast, initiales, prenom, ouvrirFenetre, options, uid, aujourdhui, ajouterJours, joursEntre, dateCourte } from '../ui.js';

export const COLONNES = [
  { id: 'decisions', nom: 'J’ai besoin de toi', aide: 'Décisions qui attendent une réponse' },
  { id: 'semaine', nom: 'Cette semaine' },
  { id: 'bientot', nom: 'Prochainement' },
  { id: 'plustard', nom: 'Plus tard' },
  { id: 'attente', nom: 'En attente de quelqu’un' },
  { id: 'claude', nom: 'En cours (Claude)' },
  { id: 'termine', nom: 'Terminé' },
];
export const CATEGORIES = [
  { id: 'ventes', nom: 'Ventes et marketing', coul: '#93AA5F' },
  { id: 'site', nom: 'Site web et outil client', coul: '#8CC4E0' },
  { id: 'production', nom: 'Production et imprimantes', coul: '#E2C044' },
  { id: 'presse', nom: 'Presse et salons', coul: '#FF8A3D' },
  { id: 'entreprise', nom: 'Georama Entreprise', coul: '#B798F2' },
  { id: 'finances', nom: 'Finances et administration', coul: '#F07070' },
];
const TERMINE_VISIBLES = 6;

export function colonneDe(t) { return COLONNES.some(c => c.id === t.colonne) ? t.colonne : (t.fait ? 'termine' : 'semaine'); }
const categorie = id => CATEGORIES.find(c => c.id === id) || null;
const ordreDe = t => (typeof t.ordre === 'number' ? t.ordre : 1e9);

function etatVue(ctx) {
  if (!ctx.etat.taches) ctx.etat.taches = { q: '', cat: '', qui: '', toutTermine: false };
  return ctx.etat.taches;
}

function trier(liste, col) {
  if (col === 'termine') return liste.slice().sort((a, b) => String(b.faitLe || b.maj || '').localeCompare(String(a.faitLe || a.maj || '')));
  return liste.slice().sort((a, b) => ordreDe(a) - ordreDe(b) || String(a.echeance || '9').localeCompare(String(b.echeance || '9')) || String(a.titre).localeCompare(String(b.titre)));
}
function dansColonne(m, col) { return trier(m.liste('taches').filter(t => colonneDe(t) === col), col); }
function finDeColonne(m, col) { return dansColonne(m, col).reduce((mx, t) => Math.max(mx, ordreDe(t) >= 1e9 ? 0 : ordreDe(t)), 0) + 1000; }

function echeanceHtml(t) {
  if (!t.echeance) return '';
  const fait = colonneDe(t) === 'termine';
  const j = joursEntre(aujourdhui(), t.echeance);
  const cls = fait ? 'k-ech fait' : j < 0 ? 'k-ech retard' : j <= 2 ? 'k-ech proche' : 'k-ech';
  const txt = j === 0 && !fait ? 'Aujourd’hui' : j === 1 && !fait ? 'Demain' : dateCourte(t.echeance);
  return `<span class="${cls}" title="Échéance">${ico('chrono')}${esc(txt)}</span>`;
}

function carteHtml(t, moi) {
  const cat = categorie(t.cat);
  const sous = Array.isArray(t.sous) ? t.sous : [];
  const faites = sous.filter(s => s.f).length;
  const meta = [
    echeanceHtml(t),
    sous.length ? `<span class="k-meta${faites === sous.length ? ' complet' : ''}" title="Sous-tâches">☑ ${faites}/${sous.length}</span>` : '',
    t.desc ? `<span class="k-meta" title="Il y a une description">${ico('fichier')}</span>` : '',
  ].filter(Boolean).join('');
  const qui = t.qui ? `<span class="initiales k-qui${t.qui === moi ? ' moi' : ''}" title="${esc(t.qui)}">${esc(t.qui === 'Les deux' ? '2' : initiales(t.qui))}</span>` : '';
  return `<div class="kcarte" draggable="true" role="button" tabindex="0" data-act="k-ouvrir" data-id="${esc(t.id)}"${cat ? ` style="--k-cat:${cat.coul}"` : ''}>
      ${cat ? `<span class="k-cat">${esc(cat.nom)}</span>` : ''}
      <span class="k-titre">${esc(t.titre)}</span>
      ${meta || qui ? `<span class="k-bas">${meta}<span class="grow"></span>${qui}</span>` : ''}
    </div>`;
}

function filtrer(ctx, liste) {
  const e = etatVue(ctx);
  const q = e.q.trim().toLowerCase();
  return liste.filter(t => (!e.cat || t.cat === e.cat)
    && (!e.qui || (e.qui === '-' ? !t.qui : t.qui === e.qui || t.qui === 'Les deux'))
    && (!q || (String(t.titre) + ' ' + String(t.desc || '')).toLowerCase().includes(q)));
}

function vueTableau(ctx) {
  const e = etatVue(ctx);
  const m = ctx.m;
  const toutes = m.liste('taches');
  const ouvertes = toutes.filter(t => colonneDe(t) !== 'termine');
  const retard = ouvertes.filter(t => t.echeance && t.echeance < aujourdhui()).length;
  const decisions = ouvertes.filter(t => colonneDe(t) === 'decisions').length;
  const filtre = !!(e.q || e.cat || e.qui);
  const cols = COLONNES.map(c => {
    let l = filtrer(ctx, dansColonne(m, c.id));
    const total = l.length;
    let plus = '';
    if (c.id === 'termine' && !e.toutTermine && l.length > TERMINE_VISIBLES) {
      plus = `<button type="button" class="btn-lien petit k-plus" data-act="k-tout-termine">Voir les ${l.length - TERMINE_VISIBLES} autres</button>`;
      l = l.slice(0, TERMINE_VISIBLES);
    }
    return `<section class="kcol${c.id === 'decisions' ? ' k-decisions' : ''}" data-col="${c.id}" aria-label="${esc(c.nom)}">
        <header class="kcol-tete"><h2 title="${esc(c.aide || c.nom)}">${esc(c.nom)}</h2><span class="k-compte">${total}</span></header>
        <div class="kcol-corps" data-col="${c.id}">${l.map(t => carteHtml(t, ctx.moi)).join('') || `<p class="k-vide">${filtre ? 'Rien avec ces filtres' : 'Rien ici'}</p>`}${plus}</div>
        <form data-form="k-ajout" class="k-ajout"><input type="hidden" name="colonne" value="${c.id}">
          <label class="sr" for="k-aj-${c.id}">Nouvelle carte dans ${esc(c.nom)}</label>
          <input id="k-aj-${c.id}" name="titre" type="text" placeholder="+ Ajouter une carte" autocomplete="off"></form>
      </section>`;
  }).join('');
  const quiOpts = [{ id: '', nom: 'Tout le monde' }].concat(ctx.membres.map(n => ({ id: n, nom: prenom(n) })), [{ id: '-', nom: 'Personne d’assigné' }]);
  return `${ongletsAccueil('taches')}
    <header class="entete">
      <div><p class="surtitre">Pilotage</p><h1 class="titre-1">Tâches</h1>
        <p class="petit doux" style="margin:6px 0 0">${ouvertes.length} à faire${decisions ? ` · <strong>${decisions} décision${decisions > 1 ? 's' : ''} t’attend${decisions > 1 ? 'ent' : ''}</strong>` : ''}${retard ? ` · <span class="retard">${retard} en retard</span>` : ''}</p></div>
      <div class="actions"><button type="button" class="btn" data-act="k-nouvelle">+ Nouvelle tâche</button></div>
    </header>
    <div class="filtres">
      <label class="sr" for="k-q">Chercher une tâche</label>
      <input id="k-q" type="search" placeholder="Chercher une tâche" value="${esc(e.q)}" data-input="k-q" style="flex:1 1 200px;max-width:280px">
      <label class="sr" for="k-cat">Étiquette</label>
      <select id="k-cat" data-chg="k-cat">${options([{ id: '', nom: 'Toutes les étiquettes' }].concat(CATEGORIES), e.cat)}</select>
      <label class="sr" for="k-qui">Pour qui</label>
      <select id="k-qui" data-chg="k-qui">${options(quiOpts, e.qui)}</select>
      ${filtre ? '<button type="button" class="btn-lien petit" data-act="k-effacer">Effacer les filtres</button>' : ''}
      <span class="tres-petit doux grow seulement-ordi" style="text-align:right">Glisse une carte pour la changer de colonne.</span>
    </div>
    <div class="kanban" id="kanban">${cols}</div>`;
}

/* ---------- Fenêtre d'une carte ---------- */
function ligneSous(s, i) {
  return `<div class="k-sous-ligne">
      <input type="checkbox" aria-label="Fait"${s.f ? ' checked' : ''}>
      <label class="sr" for="k-st-${i}">Sous-tâche</label>
      <input id="k-st-${i}" type="text" value="${esc(s.t || '')}" placeholder="Sous-tâche">
      <button type="button" class="btn-ico k-sous-suppr" aria-label="Retirer cette sous-tâche">${ico('fermer')}</button>
    </div>`;
}

export function ouvrirCarte(ctx, id, colonneDefaut) {
  const m = ctx.m;
  const t = id ? m.get('taches', id) : null;
  if (id && !t) { toast('Cette tâche n’existe plus.', true); return; }
  const col = t ? colonneDe(t) : (colonneDefaut || 'semaine');
  const quiOpts = [{ id: '', nom: 'Personne' }].concat(ctx.membres.map(n => ({ id: n, nom: n })), [{ id: 'Les deux', nom: 'Les deux' }]);
  const sous = t && Array.isArray(t.sous) ? t.sous : [];
  let n = sous.length;
  const infos = t ? [t.creePar ? 'Créée par ' + prenom(t.creePar) + (t.creeLe ? ' le ' + dateCourte(t.creeLe.slice(0, 10)) : '') : '',
    t.source === 'trello' ? 'Importée de Trello' : '', t.par ? 'Modifiée par ' + prenom(t.par) + ' le ' + dateCourte(String(t.maj || '').slice(0, 10)) : ''].filter(Boolean).join(' · ') : '';
  const { form } = ouvrirFenetre({
    titre: t ? 'Tâche' : 'Nouvelle tâche',
    large: true,
    corps: `<div class="champs">
        <div style="grid-column:1/-1"><label for="k-titre">Titre</label><input id="k-titre" name="titre" type="text" required value="${esc(t ? t.titre : '')}"></div>
        <div><label for="k-colonne">Colonne</label><select id="k-colonne" name="colonne">${options(COLONNES, col)}</select></div>
        <div><label for="k-cat-c">Étiquette</label><select id="k-cat-c" name="cat">${options(CATEGORIES, t ? t.cat : '', 'Aucune')}</select></div>
        <div><label for="k-qui-c">Pour qui</label><select id="k-qui-c" name="qui">${options(quiOpts, t ? (t.qui || '') : '')}</select></div>
        <div><label for="k-ech">Échéance</label><input id="k-ech" name="echeance" type="date" value="${esc(t ? (t.echeance || '') : '')}"></div>
        <div style="grid-column:1/-1"><label for="k-desc">Description</label><textarea id="k-desc" name="desc" rows="9" placeholder="Détails, liens, ce qui reste à faire…">${esc(t ? (t.desc || '') : '')}</textarea></div>
        <div style="grid-column:1/-1"><p class="surtitre" style="margin:4px 0 6px">Sous-tâches</p>
          <div id="k-sous">${sous.map((s, i) => ligneSous(s, i)).join('')}</div>
          <button type="button" class="btn-lien petit" id="k-sous-ajout">+ Ajouter une sous-tâche</button></div>
      </div>
      ${infos ? `<p class="tres-petit doux" style="margin:12px 0 0">${esc(infos)}</p>` : ''}`,
    pied: t ? `<button type="button" class="btn-lien" data-modal-act="suppr" style="color:var(--balise)">Supprimer</button>` : '',
    onAction: act => {
      if (act === 'suppr' && confirm('Supprimer cette tâche ?')) {
        m.supprimer('taches', t.id);
        toast('Tâche supprimée.');
        return 'fermer';
      }
      return null;
    },
    onSubmit: (d, f) => {
      if (!d.titre) return false;
      const lignes = [...f.querySelectorAll('.k-sous-ligne')].map(l => ({ t: l.querySelector('input[type=text]').value.trim(), f: l.querySelector('input[type=checkbox]').checked })).filter(s => s.t);
      const colonne = COLONNES.some(c => c.id === d.colonne) ? d.colonne : 'semaine';
      const fait = colonne === 'termine';
      const base = t || { id: uid('t'), creePar: ctx.moi, creeLe: new Date().toISOString() };
      const fiche = Object.assign({}, base, {
        titre: d.titre, colonne, cat: d.cat || '', qui: d.qui || '', echeance: d.echeance || '', desc: d.desc || '', sous: lignes,
        fait, faitLe: fait ? (t && t.faitLe && colonneDe(t) === 'termine' ? t.faitLe : new Date().toISOString()) : null,
      });
      if (!t || colonneDe(t) !== colonne) fiche.ordre = finDeColonne(m, colonne);
      m.mettre('taches', fiche);
      if (fait && (!t || colonneDe(t) !== 'termine')) ctx.journal('Tâche terminée : ' + fiche.titre, '#/taches', 'tache');
      else if (fiche.qui && fiche.qui !== ctx.moi && (!t || t.qui !== fiche.qui)) ctx.journal('Tâche pour ' + prenom(fiche.qui) + ' : ' + fiche.titre, '#/taches', 'tache');
      return true;
    },
  });
  form.addEventListener('click', ev => {
    if (ev.target.closest('#k-sous-ajout')) {
      const zone = form.querySelector('#k-sous');
      zone.insertAdjacentHTML('beforeend', ligneSous({ t: '', f: false }, n++));
      zone.lastElementChild.querySelector('input[type=text]').focus();
    }
    const s = ev.target.closest('.k-sous-suppr');
    if (s) s.closest('.k-sous-ligne').remove();
  });
  form.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.matches('.k-sous-ligne input[type=text]')) {
      ev.preventDefault();
      form.querySelector('#k-sous-ajout').click();
    }
  });
}

/* ---------- Glisser-déposer ---------- */
function deplacer(ctx, id, col, avantId) {
  const m = ctx.m;
  const t = m.get('taches', id);
  if (!t) return;
  const avant = colonneDe(t);
  const patch = { colonne: col, fait: col === 'termine', faitLe: col === 'termine' ? (avant === 'termine' ? t.faitLe : new Date().toISOString()) : null };
  if (col !== 'termine') {
    const l = dansColonne(m, col).filter(x => x.id !== id);
    const i = avantId ? l.findIndex(x => x.id === avantId) : -1;
    const suivant = i >= 0 ? l[i] : null;
    const precedent = i >= 0 ? l[i - 1] : l[l.length - 1];
    const op = precedent && ordreDe(precedent) < 1e9 ? ordreDe(precedent) : null;
    const os = suivant && ordreDe(suivant) < 1e9 ? ordreDe(suivant) : null;
    patch.ordre = op !== null && os !== null ? (op + os) / 2 : os !== null ? os - 1000 : op !== null ? op + 1000 : 1000;
    if (suivant && os === null) {
      // Cartes sans ordre (anciennes) : on numérote la colonne une fois.
      l.forEach((x, k) => m.modifier('taches', x.id, { ordre: (k + (k >= i ? 2 : 1)) * 1000 }, true));
      patch.ordre = (i + 1) * 1000;
    }
  }
  m.modifier('taches', id, patch);
  if (col === 'termine' && avant !== 'termine') ctx.journal('Tâche terminée : ' + t.titre, '#/taches', 'tache');
}

function brancherGlisser(ctx) {
  const kb = document.getElementById('kanban');
  if (!kb) return;
  let glisse = null;
  const marque = document.createElement('div');
  marque.className = 'k-marque';
  const carteApres = (zone, y) => [...zone.querySelectorAll('.kcarte:not(.glisse)')].find(c => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; }) || null;
  kb.addEventListener('dragstart', ev => {
    const c = ev.target.closest('.kcarte');
    if (!c) return;
    glisse = c.dataset.id;
    ev.dataTransfer.effectAllowed = 'move';
    try { ev.dataTransfer.setData('text/plain', glisse); } catch (e) { /* rien */ }
    setTimeout(() => c.classList.add('glisse'), 0);
  });
  kb.addEventListener('dragend', () => { glisse = null; kb.querySelectorAll('.glisse').forEach(x => x.classList.remove('glisse')); marque.remove(); });
  kb.addEventListener('dragover', ev => {
    const col = ev.target.closest('.kcol');
    if (!col || !glisse) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    const zone = col.querySelector('.kcol-corps');
    const ap = col.dataset.col === 'termine' ? zone.firstElementChild : carteApres(zone, ev.clientY);
    if (ap) zone.insertBefore(marque, ap); else zone.appendChild(marque);
  });
  kb.addEventListener('drop', ev => {
    const col = ev.target.closest('.kcol');
    if (!col || !glisse) return;
    ev.preventDefault();
    let suivant = marque.nextElementSibling;
    while (suivant && !suivant.classList.contains('kcarte')) suivant = suivant.nextElementSibling;
    const id = glisse;
    glisse = null;
    marque.remove();
    deplacer(ctx, id, col.dataset.col, suivant ? suivant.dataset.id : null);
  });
  kb.addEventListener('keydown', ev => {
    const c = ev.target.closest('.kcarte');
    if (c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); ouvrirCarte(ctx, c.dataset.id); }
  });
}

/* ---------- Pour le tableau de bord ---------- */
// Au cellulaire, Tâches est dans Accueil : deux onglets en haut (pas de 6e bouton en bas).
export function ongletsAccueil(actif) {
  return `<nav class="onglets onglets-accueil" aria-label="Tableau de bord">
      <a href="#/"${actif === '' ? ' aria-current="page"' : ''}>Aperçu</a>
      <a href="#/taches"${actif === 'taches' ? ' aria-current="page"' : ''}>Tâches</a>
    </nav>`;
}
// Ce qui mérite d'être vu tout de suite : décisions, cette semaine, et tout ce qui arrive dans 7 jours.
export function tachesDuMoment(m) {
  const fin = ajouterJours(aujourdhui(), 6);
  return m.liste('taches').filter(t => {
    const c = colonneDe(t);
    return c !== 'termine' && (c === 'decisions' || c === 'semaine' || (t.echeance && t.echeance <= fin));
  }).sort((a, b) => Number(colonneDe(b) === 'decisions') - Number(colonneDe(a) === 'decisions') || String(a.echeance || '9').localeCompare(String(b.echeance || '9')));
}
export function cocherTache(ctx, id, fait) {
  const t = ctx.m.get('taches', id);
  if (!t) return;
  const avant = colonneDe(t);
  ctx.m.modifier('taches', id, fait
    ? { fait: true, faitLe: new Date().toISOString(), colonne: 'termine', colonneAvant: avant !== 'termine' ? avant : (t.colonneAvant || 'semaine') }
    : { fait: false, faitLe: null, colonne: t.colonneAvant || 'semaine', ordre: finDeColonne(ctx.m, t.colonneAvant || 'semaine') }, true);
  if (fait) ctx.journal('Tâche terminée : ' + t.titre, '#/taches', 'tache');
  ctx.m.avertir('local');
}
export function ajouterTache(ctx, { titre, qui, echeance, colonne }) {
  const col = colonne || 'semaine';
  ctx.m.mettre('taches', { id: uid('t'), titre, qui: qui || '', echeance: echeance || '', colonne: col, fait: false, ordre: finDeColonne(ctx.m, col), creePar: ctx.moi, creeLe: new Date().toISOString() }, true);
  if (qui && qui !== ctx.moi) ctx.journal('Nouvelle tâche pour ' + prenom(qui) + ' : ' + titre, '#/taches', 'tache');
  ctx.m.avertir('local');
}

export default {
  titre: 'Tâches',
  render(ctx) { return vueTableau(ctx); },
  actions: {
    'k-ouvrir': (ctx, el) => ouvrirCarte(ctx, el.getAttribute('data-id')),
    'k-nouvelle': ctx => ouvrirCarte(ctx, null, 'semaine'),
    'k-tout-termine': ctx => { etatVue(ctx).toutTermine = true; ctx.rendre(); },
    'k-effacer': ctx => { Object.assign(etatVue(ctx), { q: '', cat: '', qui: '' }); ctx.rendre(); },
  },
  changes: {
    'k-q': (ctx, el) => { etatVue(ctx).q = el.value; ctx.rendre(); },
    'k-cat': (ctx, el) => { etatVue(ctx).cat = el.value; ctx.rendre(); },
    'k-qui': (ctx, el) => { etatVue(ctx).qui = el.value; ctx.rendre(); },
  },
  formulaires: {
    'k-ajout': (ctx, d) => {
      if (!d.titre) return;
      ajouterTache(ctx, { titre: d.titre, colonne: d.colonne });
      setTimeout(() => { const i = document.getElementById('k-aj-' + d.colonne); if (i) i.focus(); }, 0);
    },
  },
  apres(ctx) {
    brancherGlisser(ctx);
    if (ctx.route.sous === 'carte' && ctx.route.id) {
      history.replaceState(null, '', '#/taches');
      ouvrirCarte(ctx, ctx.route.id);
    }
  },
};
