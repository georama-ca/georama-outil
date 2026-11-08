// Calendrier de contenu (v1.10) : la stratégie de publication de Georama sur un seul calendrier.
// À la main : publications prévues (Facebook, groupes, Instagram, Reel, blogue, infolettre, presse), avec statut.
// Automatique (lu par l'ordi de la maison) : articles du blogue Wix, infolettres envoyées, publications de la page
// Facebook (si le jeton Meta le permet), début et fin des pubs Meta, et les tâches marketing qui ont une échéance.
import { esc, ico, toast, ouvrirFenetre, options, uid, aujourdhui, ajouterJours, dateCourte, nombre, prenom } from '../ui.js';
import { SEGMENTS, nomSegment, estPerso } from '../donnees.js';
import { statsWix, statsMeta } from './suivi.js';
import { colonneDe } from './taches.js';

export const CANAUX = [
  { id: 'facebook', nom: 'Page Facebook', coul: '#5B93F0' },
  { id: 'groupe', nom: 'Groupes Facebook', coul: '#8FB3F5' },
  { id: 'instagram', nom: 'Instagram', coul: '#E5679A' },
  { id: 'reel', nom: 'Reel / vidéo', coul: '#B77BE8' },
  { id: 'blogue', nom: 'Blogue', coul: '#9AB168' },
  { id: 'infolettre', nom: 'Infolettre', coul: '#E2C044' },
  { id: 'presse', nom: 'Presse', coul: '#FF8A3D' },
  { id: 'autre', nom: 'Autre', coul: '#B9BDB4' },
];
const AUTRES = { pub: { nom: 'Pub Meta', coul: '#8CC4E0' }, tache: { nom: 'Tâche', coul: '#858D82' } };
export const STATUTS = [
  { id: 'idee', nom: 'Idée' }, { id: 'afaire', nom: 'À préparer' }, { id: 'pret', nom: 'Prêt' }, { id: 'publie', nom: 'Publié' },
];
// Rythme visé (modifiable plus tard dans Paramètres) : par mois.
const RYTHME = [{ canal: 'facebook', mois: 12 }, { canal: 'groupe', mois: 4 }, { canal: 'blogue', mois: 2 }, { canal: 'infolettre', mois: 1 }];
const canal = id => CANAUX.find(c => c.id === id) || AUTRES[id] || CANAUX[CANAUX.length - 1];
const statut = id => STATUTS.find(s => s.id === id) || STATUTS[0];
const jourLocal = iso => { if (!iso) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso; const d = new Date(iso); return isNaN(d) ? String(iso).slice(0, 10) : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function etatVue(ctx) {
  if (!ctx.etat.contenu) ctx.etat.contenu = { mois: aujourdhui().slice(0, 7), canal: '' };
  return ctx.etat.contenu;
}

// Tous les éléments datés (à la main + automatiques).
export function elements(m) {
  const l = [];
  m.liste('contenus').forEach(c => l.push({ id: c.id, date: c.date || '', canal: c.canal || 'autre', titre: c.titre, statut: c.statut || 'idee', segment: c.segment, lien: c.lien, qui: c.qui, manuel: true }));
  const w = statsWix(m), me = statsMeta(m);
  ((w && w.blogue) || []).forEach(p => l.push({ id: 'blog-' + p.id, date: jourLocal(p.date), canal: 'blogue', titre: p.titre, statut: 'publie', lien: p.lien, auto: 'Blogue Wix' }));
  ((w && w.infolettres) || []).filter(c => c.date).forEach(c => l.push({ id: 'lettre-' + c.id, date: jourLocal(c.date), canal: 'infolettre', titre: c.titre || c.sujet, statut: 'publie', auto: 'Infolettre Wix',
    detail: c.stats && c.stats.delivered ? nombre(c.stats.delivered) + ' reçus · ' + nombre(c.stats.opened || 0) + ' ouverts' : '' }));
  ((me && me.publications) || []).forEach(p => l.push({ id: 'fb-' + p.id, date: jourLocal(p.date), canal: 'facebook', titre: (p.texte || 'Publication').split('\n')[0].slice(0, 90), statut: 'publie', lien: p.lien, auto: 'Page Facebook' }));
  ((me && me.campagnes) || []).filter(k => !estPerso(k.nom)).filter(k => k.statut === 'ACTIVE' || (k.fin && k.fin.slice(0, 10) >= ajouterJours(aujourdhui(), -60))).forEach(k => {
    if (k.debut) l.push({ id: 'pubd-' + k.id, date: jourLocal(k.debut), canal: 'pub', titre: 'Début de la pub : ' + k.nom, statut: 'publie', auto: 'Pubs Meta' });
    if (k.fin) l.push({ id: 'pubf-' + k.id, date: jourLocal(k.fin), canal: 'pub', titre: 'Fin de la pub : ' + k.nom, statut: 'publie', auto: 'Pubs Meta' });
  });
  m.liste('taches').filter(t => t.echeance && ['ventes', 'presse', 'site'].includes(t.cat) && colonneDe(t) !== 'termine')
    .forEach(t => l.push({ id: 'tache-' + t.id, date: t.echeance, canal: 'tache', titre: t.titre, statut: 'afaire', lienInterne: '#/taches/carte/' + t.id, auto: 'Tâches' }));
  return l;
}

function puce(x) {
  const c = canal(x.canal);
  const s = x.manuel ? statut(x.statut) : null;
  const attrs = x.manuel ? `data-act="ct-ouvrir" data-id="${esc(x.id)}" role="button" tabindex="0"`
    : x.lienInterne ? `data-act="ct-lien" data-href="${esc(x.lienInterne)}" role="button" tabindex="0"`
    : x.lien ? `data-act="ct-externe" data-href="${esc(x.lien)}" role="button" tabindex="0"` : '';
  return `<span class="ct-puce${x.manuel && x.statut !== 'publie' ? ' prevu' : ''}${x.statut === 'idee' ? ' idee' : ''}" style="--ct:${c.coul}" ${attrs} title="${esc(c.nom + (s ? ' · ' + s.nom : ' · ' + (x.auto || '')) + ' : ' + x.titre)}">${esc(x.titre)}</span>`;
}

function grille(ctx, items) {
  const e = etatVue(ctx);
  const [a, mo] = e.mois.split('-').map(Number);
  const premier = new Date(a, mo - 1, 1);
  const decal = (premier.getDay() + 6) % 7;
  const nbJours = new Date(a, mo, 0).getDate();
  const auj = aujourdhui();
  const cases = [];
  for (let i = 0; i < decal; i++) cases.push('<div class="ct-jour vide" aria-hidden="true"></div>');
  for (let j = 1; j <= nbJours; j++) {
    const d = e.mois + '-' + String(j).padStart(2, '0');
    const l = items.filter(x => x.date === d);
    cases.push(`<div class="ct-jour${d === auj ? ' auj' : ''}${d < auj ? ' passe' : ''}" data-act="ct-nouveau-jour" data-date="${d}">
        <span class="ct-num">${j}</span>${l.slice(0, 4).map(puce).join('')}${l.length > 4 ? `<span class="tres-petit doux">+ ${l.length - 4} autre${l.length - 4 > 1 ? 's' : ''}</span>` : ''}
      </div>`);
  }
  return `<div class="ct-entete-sem" aria-hidden="true">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(x => `<span>${x}</span>`).join('')}</div>
    <div class="ct-grille">${cases.join('')}</div>`;
}

function ligneAgenda(x) {
  const c = canal(x.canal);
  const s = x.manuel ? statut(x.statut) : null;
  const act = x.manuel ? `data-act="ct-ouvrir" data-id="${esc(x.id)}"` : x.lienInterne ? `data-act="ct-lien" data-href="${esc(x.lienInterne)}"` : x.lien ? `data-act="ct-externe" data-href="${esc(x.lien)}"` : '';
  return `<button type="button" class="ligne ligne-btn" ${act} style="border-radius:6px">
      <span class="pastille-etat" style="background:${c.coul}"></span>
      <span class="grow petit"><strong>${esc(x.titre)}</strong><br><span class="doux">${x.date ? esc(dateCourte(x.date)) + ' · ' : ''}${esc(c.nom)}${x.segment ? ' · ' + esc(nomSegment(x.segment)) : ''}${x.detail ? ' · ' + esc(x.detail) : ''}${x.qui ? ' · ' + esc(prenom(x.qui)) : ''}</span></span>
      ${s ? `<span class="etiquette ${s.id === 'publie' ? 'vert' : s.id === 'pret' ? 'bleu' : s.id === 'idee' ? 'gris' : 'orange'}">${esc(s.nom)}</span>` : `<span class="tres-petit doux">${esc(x.auto || '')}</span>`}
    </button>`;
}

export function vueContenu(ctx) {
  const e = etatVue(ctx);
  const m = ctx.m;
  let items = elements(m);
  if (e.canal) items = items.filter(x => x.canal === e.canal);
  const [a, mo] = e.mois.split('-').map(Number);
  const auj = aujourdhui();
  const venir = items.filter(x => x.date && x.date >= auj && x.date <= ajouterJours(auj, 21)).sort((x, y) => x.date.localeCompare(y.date));
  const idees = items.filter(x => x.manuel && !x.date);
  const duMois = elements(m).filter(x => x.date.slice(0, 7) === e.mois);
  const rythme = RYTHME.map(r => {
    const fait = duMois.filter(x => x.canal === r.canal && x.statut === 'publie').length;
    const prevu = duMois.filter(x => x.canal === r.canal && x.statut !== 'publie').length;
    const c = canal(r.canal);
    return `<div><p class="surtitre" style="margin:0">${esc(c.nom)}</p>
      <p style="margin:4px 0 0"><span class="num" style="font-size:22px;font-weight:700">${nombre(fait)}</span> <span class="petit doux">publié${fait > 1 ? 's' : ''}${prevu ? ' · ' + nombre(prevu) + ' prévu' + (prevu > 1 ? 's' : '') : ''} · visé ${nombre(r.mois)}</span></p>
      <div class="barre" style="height:6px;margin-top:6px"><span style="width:${Math.min(100, (fait + prevu) / r.mois * 100)}%;background:${c.coul}"></span></div></div>`;
  }).join('');
  const me = statsMeta(m);
  const errFb = me && me.erreurs && me.erreurs.publications;
  return `
    <section class="carte">
      <div class="carte-tete" style="flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:6px">
          <button type="button" class="btn-ico" data-act="ct-mois" data-d="-1" aria-label="Mois précédent">${ico('haut').replace('<svg', '<svg style="transform:rotate(-90deg)"')}</button>
          <h2 style="margin:0;min-width:150px;text-align:center">${esc(MOIS[mo - 1].charAt(0).toUpperCase() + MOIS[mo - 1].slice(1))} ${a}</h2>
          <button type="button" class="btn-ico" data-act="ct-mois" data-d="1" aria-label="Mois suivant">${ico('haut').replace('<svg', '<svg style="transform:rotate(90deg)"')}</button>
          ${e.mois !== auj.slice(0, 7) ? '<button type="button" class="btn-lien petit" data-act="ct-aujourdhui">Aujourd’hui</button>' : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label class="sr" for="ct-canal">Canal</label>
          <select id="ct-canal" data-chg="ct-canal" style="width:auto">${options([{ id: '', nom: 'Tous les canaux' }].concat(CANAUX, [{ id: 'pub', nom: 'Pubs Meta' }, { id: 'tache', nom: 'Tâches' }]), e.canal)}</select>
          <button type="button" class="btn" data-act="ct-nouveau">+ Publication</button>
        </div>
      </div>
      <div class="ct-legende">${CANAUX.slice(0, 7).concat([{ id: 'pub', ...AUTRES.pub }, { id: 'tache', ...AUTRES.tache }]).map(c => `<span><span class="pastille-etat" style="background:${c.coul}"></span>${esc(c.nom)}</span>`).join('')}<span class="doux">Contour pointillé : prévu, pas encore publié</span></div>
      <div class="seulement-ordi">${grille(ctx, items)}</div>
      <div class="seulement-mobile">${items.filter(x => x.date.slice(0, 7) === e.mois).sort((x, y) => x.date.localeCompare(y.date)).map(ligneAgenda).join('') || '<p class="vide">Rien ce mois-ci.</p>'}</div>
      ${errFb ? `<p class="tres-petit doux" style="margin:8px 0 0">Page Facebook pas lue : ${esc(errFb)}</p>` : ''}
    </section>
    <div class="g3">
      <section class="carte"><h2>Rythme du mois</h2><div style="display:flex;flex-direction:column;gap:14px">${rythme}</div>
        <p class="tres-petit doux" style="margin:10px 0 0">Compte ce qui est publié (lu automatiquement ou marqué « Publié ») et ce qui est prévu ce mois-là.</p></section>
      <section class="carte"><div class="carte-tete"><h2>Les 3 prochaines semaines</h2></div>${venir.map(ligneAgenda).join('') || '<p class="vide">Rien de prévu. <button type="button" class="btn-lien" data-act="ct-nouveau">Planifier une publication</button></p>'}</section>
      <section class="carte"><div class="carte-tete"><h2>Idées sans date</h2><button type="button" class="btn-lien" data-act="ct-idee">+ Idée</button></div>${idees.map(ligneAgenda).join('') || '<p class="vide">Note ici les idées de publications, sans date. Tu les places dans le calendrier plus tard.</p>'}</section>
    </div>`;
}

export function ouvrirContenu(ctx, id, prerempli) {
  const m = ctx.m;
  const c = (id && m.get('contenus', id)) || Object.assign({ statut: 'afaire', canal: 'facebook', qui: ctx.moi }, prerempli || {});
  const quiOpts = [{ id: '', nom: 'Personne' }].concat(ctx.membres.map(n => ({ id: n, nom: n })));
  const { form } = ouvrirFenetre({
    titre: id ? 'Publication' : 'Nouvelle publication', large: true,
    corps: `<div class="champs">
      <div class="champ plein"><label for="ct-titre">Sujet</label><input id="ct-titre" name="titre" type="text" required value="${esc(c.titre || '')}" placeholder="Ex. : Avant / après d’une maquette de terre à bois"></div>
      <div class="champ"><label for="ct-date">Date de publication</label><input id="ct-date" name="date" type="date" value="${esc(c.date || '')}"><span class="aide">Vide = idée sans date.</span></div>
      <div class="champ"><label for="ct-c">Canal</label><select id="ct-c" name="canal">${options(CANAUX, c.canal)}</select></div>
      <div class="champ"><label for="ct-s">Statut</label><select id="ct-s" name="statut">${options(STATUTS, c.statut)}</select></div>
      <div class="champ"><label for="ct-seg">Segment visé</label><select id="ct-seg" name="segment">${options(SEGMENTS, c.segment || '', 'Tous')}</select></div>
      <div class="champ"><label for="ct-qui">Qui s’en occupe</label><select id="ct-qui" name="qui">${options(quiOpts, c.qui || '')}</select></div>
      <div class="champ"><label for="ct-lien">Lien (une fois publié)</label><input id="ct-lien" name="lien" type="url" value="${esc(c.lien || '')}" placeholder="https://…"></div>
      <div class="champ plein"><label for="ct-texte">Texte ou brouillon</label><textarea id="ct-texte" name="texte" rows="8" placeholder="Le texte de la publication, les photos à prendre, le lien vers l’outil avec utm…">${esc(c.texte || '')}</textarea></div>
    </div>
    ${c.propose ? '<p class="tres-petit doux" style="margin:8px 0 0">Proposé par Claude : à adapter ou supprimer.</p>' : ''}`,
    pied: id ? `<div class="actions"><button type="button" class="btn-2 btn-danger" data-modal-act="supprimer">Supprimer</button><button type="button" class="btn-2" data-modal-act="copier">Copier le texte</button></div>` : '',
    onAction(act, f) {
      if (act === 'supprimer' && confirm('Supprimer cette publication du calendrier ?')) { m.supprimer('contenus', id); return 'fermer'; }
      if (act === 'copier') {
        const t = f.querySelector('#ct-texte').value;
        navigator.clipboard.writeText(t).then(() => toast('Texte copié : colle-le dans Facebook.'), () => toast('Copie refusée par le navigateur.', true));
      }
      return null;
    },
    onSubmit(v) {
      const fiche = Object.assign({}, c, { id: c.id || uid('ct'), titre: v.titre, date: v.date || '', canal: v.canal, statut: v.statut, segment: v.segment || '', qui: v.qui || '', lien: v.lien || '', texte: v.texte || '' });
      if (!c.id) fiche.creePar = ctx.moi;
      m.mettre('contenus', fiche);
      return true;
    },
  });
  return form;
}

export const actionsContenu = {
  'ct-mois': (ctx, el) => {
    const e = etatVue(ctx);
    const [a, mo] = e.mois.split('-').map(Number);
    const d = new Date(a, mo - 1 + Number(el.getAttribute('data-d')), 1);
    e.mois = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    ctx.rendre();
  },
  'ct-aujourdhui': ctx => { etatVue(ctx).mois = aujourdhui().slice(0, 7); ctx.rendre(); },
  'ct-nouveau': ctx => ouvrirContenu(ctx, null, { date: aujourdhui() }),
  'ct-idee': ctx => ouvrirContenu(ctx, null, { statut: 'idee' }),
  'ct-nouveau-jour': (ctx, el, ev) => { if (ev && ev.target.closest('.ct-puce')) return; ouvrirContenu(ctx, null, { date: el.getAttribute('data-date') }); },
  'ct-ouvrir': (ctx, el) => ouvrirContenu(ctx, el.getAttribute('data-id')),
  'ct-lien': (ctx, el) => { location.hash = el.getAttribute('data-href'); },
  'ct-externe': (ctx, el) => { window.open(el.getAttribute('data-href'), '_blank', 'noopener'); },
};
export const changesContenu = {
  'ct-canal': (ctx, el) => { etatVue(ctx).canal = el.value; ctx.rendre(); },
};
