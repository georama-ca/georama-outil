// Tableau de bord (Cockpit).
import { esc, argent, pct, dateLongue, dateCourte, aujourdhui, ajouterJours, joursEntre, initiales, prenom, uid, options, heures, nombre, ilYa, versDate, ico } from '../ui.js';
import {
  reglages, estActive, resume, planifier, nomSegment, formatTexte, fileImpression, joursAvantNoel, moisCourant,
  activiteRecente, minutesSemaine, debutSemaine, agent, icoSegment, statutProspect,
} from '../donnees.js';
import { badgeStatut, promiseTexte, ouvrirCommande } from './commandes.js';
import { suggestion, nomModele } from '../courriels.js';
import { totauxMeta, statsWix } from './suivi.js';
import { tachesDuMoment, cocherTache, ajouterTache, colonneDe } from './taches.js';

function etatVue(ctx) {
  if (!ctx.etat.tableau) ctx.etat.tableau = { voirFaites: false };
  return ctx.etat.tableau;
}

function sept(ctx) {
  const m = ctx.m;
  const R = reglages(m);
  const auj = aujourdhui();
  const fin = ajouterJours(auj, 6);
  const evts = [];
  const ajout = (date, type, texte, h, couleur) => evts.push({ date: date < auj ? 'retard' : date, type, texte, h, couleur });
  m.liste('commandes').filter(c => estActive(c) && c.promise && c.promise <= fin)
    .forEach(c => ajout(c.promise, 'cmd', `<strong>${esc(c.numero)}</strong> promise à ${esc(c.client)}`, '#/production/fiche/' + c.id, 'var(--accent)'));
  m.liste('taches').filter(t => colonneDe(t) !== 'termine' && t.echeance && t.echeance <= fin)
    .forEach(t => ajout(t.echeance, 'tache', `${esc(t.titre)}${t.qui ? ` <span class="doux">· ${esc(prenom(t.qui))}</span>` : ''}`, '#/taches/carte/' + t.id, 'var(--eau)'));
  m.liste('prospects').filter(p => !['gagne', 'perdu'].includes(p.statut) && p.prochaine && p.prochaine <= fin)
    .forEach(p => ajout(p.prochaine, 'prospect', `${esc(p.action || statutProspect(p.statut).nom)} · ${esc(p.organisation)}`, '#/marketing', 'var(--balise)'));
  m.liste('campagnes').filter(k => k.fin && k.fin >= auj && k.fin <= fin)
    .forEach(k => ajout(k.fin, 'pub', `Fin de la campagne ${esc(k.nom)}`, '#/marketing/campagnes', 'var(--bordure-controle)'));
  const aEcrire = m.liste('commandes').filter(c => suggestion(c));
  aEcrire.slice(0, 3).forEach(c => ajout(auj, 'courriel', `Courriel « ${esc(nomModele(suggestion(c)))} » à ${esc(c.client)}`, '#/production/fiche/' + c.id, 'var(--accent-texte)'));
  if (aEcrire.length > 3) ajout(auj, 'courriel', `Et ${aEcrire.length - 3} autre${aEcrire.length - 3 > 1 ? 's' : ''} courriel${aEcrire.length - 3 > 1 ? 's' : ''} client${aEcrire.length - 3 > 1 ? 's' : ''} à envoyer`, '#/commandes?courriels', 'var(--accent-texte)');
  [[R.dateLimiteNoel, 'Dernières commandes de Noël'], [R.dernierEnvoi, 'Dernier envoi avant Noël']].forEach(([d, t]) => { if (d >= auj && d <= fin) ajout(d, 'noel', `<strong>${t}</strong>`, '#/production/planification', 'var(--balise)'); });
  const jours = ['retard'];
  for (let i = 0; i < 7; i++) jours.push(ajouterJours(auj, i));
  const blocs = jours.map(j => {
    const l = evts.filter(e => e.date === j);
    if (!l.length) return '';
    let titre;
    if (j === 'retard') titre = 'En retard';
    else if (j === auj) titre = 'Aujourd’hui';
    else if (j === ajouterJours(auj, 1)) titre = 'Demain';
    else titre = versDate(j).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric' });
    return `<div class="jour"><div class="jour-titre${j === auj ? ' auj' : ''}"${j === 'retard' ? ' style="color:var(--balise)"' : ''}>${esc(titre)}</div>
      ${l.map(e => `<a class="evt" href="${e.h}" style="color:inherit;text-decoration:none"><span class="pt" style="background:${e.couleur}"></span><span>${e.texte}</span></a>`).join('')}</div>`;
  }).join('');
  return blocs || '<p class="vide">Une semaine tranquille. Bon moment pour prospecter.</p>';
}

function fil(ctx) {
  const l = activiteRecente(ctx.m, 10);
  const nouveaux = l.filter(a => a.qui !== ctx.moi && ctx.vuAvant && a.quand > ctx.vuAvant).length;
  const items = l.map(a => {
    const nv = a.qui !== ctx.moi && ctx.vuAvant && a.quand > ctx.vuAvant;
    const corps = `<span class="initiales${a.qui === ctx.moi ? ' moi' : ''}" title="${esc(a.qui)}">${esc(initiales(a.qui))}</span>
      <span class="grow"><span>${esc(a.texte)}</span>${nv ? '<span class="nouveau">NOUVEAU</span>' : ''}<br><span class="tres-petit doux">${esc(prenom(a.qui))} · ${esc(ilYa(a.quand))}</span></span>`;
    return a.lien ? `<a class="fil-item" href="${esc(a.lien)}" style="color:inherit;text-decoration:none">${corps}</a>` : `<div class="fil-item">${corps}</div>`;
  }).join('');
  return { html: items || '<p class="vide">Le fil se remplit à mesure que vous travaillez : commandes, plaques, prospects…</p>', nouveaux };
}

function semaine(ctx) {
  const m = ctx.m;
  const R = reglages(m);
  const obj = (R.heuresSemaine || 10) * 60;
  const membres = ctx.membres;
  const lignes = membres.map(n => {
    const min = minutesSemaine(m, n);
    const p = Math.min(100, Math.round(min / obj * 100));
    return `<div style="display:flex;align-items:center;gap:12px;padding:6px 0">
      <span class="anneau-semaine" style="background:conic-gradient(${n === ctx.moi ? 'var(--accent)' : 'var(--eau)'} 0 ${p}%, var(--bordure) ${p}% 100%)"><span>${p}%</span></span>
      <span class="grow"><strong>${esc(prenom(n))}</strong><br><span class="petit doux">${heures(min / 60)} sur ${heures(obj / 60)}</span></span>
    </div>`;
  }).join('');
  const annee = aujourdhui().slice(0, 4);
  const livrees = m.liste('commandes').filter(c => ['expediee', 'livree'].includes(c.statut) && String(c.expedieeLe || c.promise || c.recue).slice(0, 4) === annee).length;
  const deb = debutSemaine();
  const semaineLiv = m.liste('commandes').filter(c => ['expediee', 'livree'].includes(c.statut) && (c.expedieeLe || '') >= deb).length;
  const a = agent(m);
  const etatAgent = !a.installe ? `<a href="#/parametres">Installer l'ordi de la maison</a>`
    : a.enLigne ? `<span class="vert-t">En ligne</span>${a.travail ? ' · ' + esc(a.travail) : ''}` : `<span class="retard">Hors ligne depuis ${esc(ilYa(a.vu))}</span>`;
  return `${lignes}
    <div class="ligne" style="margin-top:6px"><span class="grow">Maquettes livrées en ${annee}</span><strong class="num" style="font-size:20px">${livrees}</strong></div>
    <div class="ligne"><span class="grow">Livrées cette semaine</span><strong class="num">${semaineLiv}</strong></div>
    <div class="ligne"><span class="grow" style="display:flex;align-items:center;gap:8px">${ico('maison').replace('<svg', '<svg width="18" height="18"')}Ordi de la maison</span><span class="petit">${etatAgent}</span></div>`;
}

function premiersPas(ctx) {
  const m = ctx.m;
  const R = reglages(m);
  if (ctx.mode === 'demo' || R.premiersPasMasques) return '';
  const etapes = [
    { t: 'Ajouter une première commande (ou laisser l’ordi de la maison importer celles du site)', ok: m.liste('commandes').length > 0, h: '#/commandes' },
    { t: 'Partager le dossier Hub-Georama avec l’autre personne (Paramètres)', ok: !!R.partageFait, h: '#/parametres' },
    { t: 'Indiquer les bobines chargées dans les AMS', ok: m.liste('filament').some(f => f.type === 'ams' && f.couleur), h: '#/production/filament' },
    { t: 'Installer l’agent sur l’ordi de la maison (rendus 3D, imprimante, commandes du site)', ok: agent(m).installe, h: '#/parametres' },
    { t: 'Ajouter les prospects Entreprise à contacter', ok: m.liste('prospects').length > 0, h: '#/marketing' },
  ];
  const n = etapes.filter(e => e.ok).length;
  if (n === etapes.length) return '';
  return `<section class="carte">
    <div class="carte-tete"><h2>Premiers pas · ${n}/${etapes.length}</h2><button type="button" class="btn-lien" data-act="masquer-pp">Masquer</button></div>
    <ol class="premiers-pas" style="margin:0;padding-left:20px">${etapes.map(e => `<li class="${e.ok ? 'fait' : ''}">${e.ok ? esc(e.t) : `<a href="${e.h}">${esc(e.t)}</a>`}</li>`).join('')}</ol>
  </section>`;
}

export default {
  titre: 'Tableau de bord',
  render(ctx) {
    const m = ctx.m;
    const R = reglages(m);
    const e = etatVue(ctx);
    const cmds = m.liste('commandes');
    const actives = cmds.filter(estActive);
    const aApprouver = actives.filter(c => c.statut === 'approbation').length;
    const enProd = actives.filter(c => c.statut === 'production').length;
    const file = fileImpression(m).filter(p => p.statut !== 'fini');
    const plan = planifier(m);
    const mois = resume(m, moisCourant());
    const annee = resume(m, aujourdhui().slice(0, 4));
    const progression = R.objectif ? Math.max(0, Math.min(100, annee.benefice / R.objectif * 100)) : 0;
    const jNoel = joursAvantNoel(m);
    const deb = debutSemaine();
    const nouvellesSem = cmds.filter(c => (c.recue || '') >= deb).length;
    const minSem = minutesSemaine(m, ctx.moi);

    const noel = jNoel >= 0 ? `<div class="bandeau${plan.tard ? '' : ' vert'}">
        <strong class="o">Noël</strong>
        <span>Dernières commandes le ${esc(dateCourte(R.dateLimiteNoel))} : il reste ${jNoel} jour${jNoel > 1 ? 's' : ''}. ${file.length} plaque${file.length > 1 ? 's' : ''} en file, environ ${nombre(Math.ceil(plan.finH / 24))} jour${plan.finH > 24 ? 's' : ''} d'impression.
        ${plan.tard ? `<strong class="o">${plan.tard} plaque${plan.tard > 1 ? 's' : ''} finirai${plan.tard > 1 ? 'ent' : 't'} après le ${esc(dateCourte(R.dernierEnvoi))}.</strong>` : 'Tout part à temps.'}</span>
        <a href="#/production/planification" class="btn-lien">Voir la planification</a>
      </div>` : '';

    const prochaines = actives.slice().sort((a, b) => String(a.promise || '9').localeCompare(String(b.promise || '9'))).slice(0, 6);
    const lignesCmd = prochaines.map(c => `<button type="button" class="ligne ligne-btn" data-act="ouvrir" data-id="${esc(c.id)}">
        ${icoSegment(c.segment, 22)}
        <span class="grow"><strong>${esc(c.numero)}</strong> · ${esc(c.lieu || c.client)}<br><span class="petit doux">${esc(nomSegment(c.segment))} · ${esc(formatTexte(c))} · ${esc(c.gamme)}</span></span>
        ${badgeStatut(c.statut)}
        <span class="petit num" style="min-width:120px;text-align:right">${promiseTexte(c)}</span>
      </button>`).join('');

    const tousMoment = tachesDuMoment(m);
    const taches = tousMoment.slice(0, 8);
    const decisionsN = tousMoment.filter(t => colonneDe(t) === 'decisions').length;
    const lignesT = taches.map(t => {
      const j = t.echeance ? joursEntre(aujourdhui(), t.echeance) : null;
      const quand = t.echeance ? `<span class="tres-petit ${!t.fait && j < 0 ? 'retard' : 'doux'}">${j === 0 ? 'Aujourd’hui' : esc(dateCourte(t.echeance))}</span>` : '';
      return `<div class="ligne">
        <input type="checkbox" id="t-${esc(t.id)}" data-chg="tache" aria-label="Marquer comme faite" data-id="${esc(t.id)}"${t.fait ? ' checked' : ''}>
        <a href="#/taches/carte/${esc(t.id)}" class="grow" style="color:inherit;text-decoration:none">${colonneDe(t) === 'decisions' ? '<span class="etiquette orange" style="font-size:11px;padding:0 8px;margin-right:6px">Décision</span>' : ''}${esc(t.titre)}<br>${quand}</a>
        ${t.qui ? `<span class="initiales${t.qui === ctx.moi ? ' moi' : ''}" title="${esc(t.qui)}">${esc(t.qui === 'Les deux' ? '2' : initiales(t.qui))}</span>` : ''}
      </div>`;
    }).join('');

    const prospects = m.liste('prospects').filter(p => !['gagne', 'perdu'].includes(p.statut));
    const aRelancer = prospects.filter(p => p.prochaine && p.prochaine <= aujourdhui()).length;
    const soum = prospects.filter(p => p.statut === 'soumission').length;
    const meta30 = totauxMeta(m, 30);
    const wix30 = statsWix(m);
    const pubs = meta30 ? meta30.depense : m.liste('campagnes').reduce((s, k) => s + (Number(k.depense) || 0), 0);
    const visites = wix30 && wix30.achalandage && wix30.achalandage.TOTAL_SESSIONS ? (wix30.achalandage.TOTAL_SESSIONS.total || 0) : m.liste('campagnes').reduce((s, k) => s + (Number(k.visites) || 0), 0);
    const demo = ctx.mode === 'demo';
    const f = fil(ctx);
    const resumeSemaine = [
      nouvellesSem ? nouvellesSem + ' nouvelle' + (nouvellesSem > 1 ? 's' : '') + ' commande' + (nouvellesSem > 1 ? 's' : '') + ' cette semaine' : 'Pas encore de commande cette semaine',
      minSem ? heures(minSem / 60) + ' de travail pour toi' : '',
      f.nouveaux ? f.nouveaux + ' nouveauté' + (f.nouveaux > 1 ? 's' : '') + ' de l’équipe depuis ta dernière visite' : '',
    ].filter(Boolean).join(' · ');

    return `
      <header class="entete">
        <div><p class="surtitre">${esc(dateLongue(aujourdhui()))}</p><h1 class="titre-1">Bonjour ${esc(prenom(ctx.moi))}</h1>
          <p class="petit doux" style="margin:6px 0 0">${esc(resumeSemaine)}.</p></div>
        <div class="actions">
          ${demo ? '<span class="etiquette vert">Données d’exemple</span>' : ''}
          <button type="button" class="btn-2" data-act="recherche-g">${ico('loupe').replace('<svg', '<svg width="16" height="16"')} Rechercher</button>
          <button type="button" class="btn" data-act="nouvelle">+ Nouvelle commande</button>
        </div>
      </header>
      ${demo ? `<div class="bandeau info"><span><strong>Mode démo.</strong> Tout reste dans ce navigateur et l'ordi de la maison est simulé. Pour travailler à deux avec les comptes Georama, active Microsoft 365 dans <a href="#/parametres">Paramètres</a>. Astuce : <kbd>Ctrl K</kbd> pour tout chercher, <kbd>?</kbd> pour les raccourcis.</span></div>` : ''}
      ${noel}
      ${premiersPas(ctx)}
      <section class="g4" aria-label="Indicateurs">
        <a class="carte kpi" href="#/commandes" style="text-decoration:none;color:inherit"><p class="surtitre">Commandes en cours</p><p class="valeur">${actives.length}</p><p class="detail">${aApprouver} à approuver · ${enProd} en production</p></a>
        <a class="carte kpi" href="#/production" style="text-decoration:none;color:inherit"><p class="surtitre">Plaques en file</p><p class="valeur">${file.length}</p><p class="detail">Environ ${heures(plan.heuresTotal)} d'impression</p></a>
        <a class="carte kpi" href="#/finances" style="text-decoration:none;color:inherit"><p class="surtitre">Ventes du mois</p><p class="valeur">${argent(mois.ventesHT)}</p><p class="detail">${mois.nbVentes} commande${mois.nbVentes > 1 ? 's' : ''} · avant taxes</p></a>
        <a class="carte kpi" href="#/finances" style="text-decoration:none;color:inherit"><p class="surtitre">Objectif annuel</p><p class="valeur">${pct(progression)}</p>
          <div class="barre" style="margin-top:10px"><span style="width:${progression}%"></span></div>
          <p class="detail">Bénéfice ${argent(annee.benefice)} sur ${argent(R.objectif)}</p></a>
      </section>
      <div class="g3">
        <section class="carte s2">
          <div class="carte-tete"><h2>Commandes qui approchent</h2><a href="#/commandes">Tout voir</a></div>
          ${lignesCmd || '<p class="vide">Aucune commande en cours. <button type="button" class="btn-lien" data-act="nouvelle">Ajouter une commande</button></p>'}
        </section>
        <section class="carte">
          <div class="carte-tete"><h2>À faire${decisionsN ? ` <span class="etiquette orange" style="font-size:11px;vertical-align:middle">${decisionsN} décision${decisionsN > 1 ? 's' : ''}</span>` : ''}</h2><a href="#/taches">Toutes les tâches${tousMoment.length > taches.length ? ' (+' + (tousMoment.length - taches.length) + ')' : ''}</a></div>
          <form data-form="tache" class="filtres" style="margin-bottom:6px">
            <label class="sr" for="nv-tache">Nouvelle tâche</label>
            <input id="nv-tache" name="titre" type="text" placeholder="Nouvelle tâche" required style="flex:1 1 160px">
            <label class="sr" for="nv-qui">Pour qui</label>
            <select id="nv-qui" name="qui" style="flex:1 1 120px;min-width:0">${options(ctx.membres.map(n => ({ id: n, nom: prenom(n) })), ctx.moi)}</select>
            <label class="sr" for="nv-quand">Échéance</label>
            <input id="nv-quand" name="echeance" type="date" style="flex:1 1 140px">
            <button type="submit" class="btn-2">Ajouter</button>
          </form>
          ${lignesT || '<p class="vide">Rien pour cette semaine. Profites-en.</p>'}
        </section>
      </div>
      <div class="g3">
        <section class="carte"><div class="carte-tete"><h2>Les 7 prochains jours</h2></div>${sept(ctx)}</section>
        <section class="carte" id="fil"><div class="carte-tete"><h2>Fil de l'équipe</h2>${f.nouveaux ? `<span class="nouveau" style="font-size:11px;padding:2px 8px">${f.nouveaux} NOUVEAU${f.nouveaux > 1 ? 'X' : ''}</span>` : ''}</div>${f.html}</section>
        <section class="carte"><div class="carte-tete"><h2>La semaine Georama</h2><span class="tres-petit doux">Objectif ${R.heuresSemaine || 10} h chacun</span></div>${semaine(ctx)}</section>
      </div>
      <section class="carte g4" aria-label="Marketing et finances" style="display:grid">
        <a href="#/marketing" style="text-decoration:none;color:inherit"><p class="surtitre">Prospects actifs</p><p style="margin:8px 0 0;font-size:26px;font-weight:700" class="num">${prospects.length}</p><p class="petit doux" style="margin:4px 0 0">${soum} en soumission${aRelancer ? ` · <span class="retard">${aRelancer} à relancer</span>` : ''}</p></a>
        <a href="#/marketing/suivi" style="text-decoration:none;color:inherit"><p class="surtitre">${wix30 && wix30.achalandage ? 'Visites du site' : 'Visites des pubs'}</p><p style="margin:8px 0 0;font-size:26px;font-weight:700" class="num">${nombre(visites)}</p><p class="petit doux" style="margin:4px 0 0">${wix30 && wix30.achalandage ? '30 derniers jours (Wix)' : 'Toutes campagnes'}</p></a>
        <a href="#/marketing/suivi" style="text-decoration:none;color:inherit"><p class="surtitre">Dépensé en pubs</p><p style="margin:8px 0 0;font-size:26px;font-weight:700" class="num">${argent(pubs, 2)}</p><p class="petit doux" style="margin:4px 0 0">${meta30 ? '30 derniers jours (Meta)' : 'Toutes campagnes'}</p></a>
        <a href="#/finances" style="text-decoration:none;color:inherit"><p class="surtitre">À encaisser</p><p style="margin:8px 0 0;font-size:26px;font-weight:700" class="num">${argent(annee.aEncaisser, 2)}</p><p class="petit doux" style="margin:4px 0 0">Commandes non payées</p></a>
      </section>`;
  },
  actions: {
    nouvelle: ctx => ouvrirCommande(ctx, null),
    ouvrir: (ctx, el) => ouvrirCommande(ctx, el.getAttribute('data-id')),
    'recherche-g': ctx => ctx.global.recherche(),
    'voir-faites': ctx => { const e = etatVue(ctx); e.voirFaites = !e.voirFaites; ctx.rendre(); },
    'suppr-tache': (ctx, el) => ctx.m.supprimer('taches', el.getAttribute('data-id')),
    'masquer-pp': ctx => ctx.m.mettre('reglages', Object.assign({}, reglages(ctx.m), { id: 'general', premiersPasMasques: true })),
  },
  changes: {
    tache: (ctx, el) => cocherTache(ctx, el.getAttribute('data-id'), el.checked),
  },
  formulaires: {
    tache: (ctx, d) => {
      if (!d.titre) return;
      ajouterTache(ctx, { titre: d.titre, qui: d.qui || ctx.moi, echeance: d.echeance || '', colonne: 'semaine' });
      setTimeout(() => { const i = document.getElementById('nv-tache'); if (i) i.focus(); }, 0);
    },
  },
};
