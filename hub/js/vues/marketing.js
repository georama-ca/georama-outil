// Module Marketing et prospection.
import { esc, argent, nombre, dateCourte, options, ouvrirFenetre, aujourdhui, joursEntre, uid, toast, initiales } from '../ui.js';
import { STATUTS_PROSPECT, statutProspect, TYPES_PROSPECT, CANAUX, SEGMENTS, nomSegment, journaliser, reglages } from '../donnees.js';
import { ouvrirCommande } from './commandes.js';
import { vueSuivi, monterCarte, etatSuivi, totauxMeta, statsWix, tableauMeta } from './suivi.js';
import { blocCorrelation } from './correlation.js';
import { vueContenu, actionsContenu, changesContenu } from './contenu.js';

function etatVue(ctx) {
  if (!ctx.etat.mkt) ctx.etat.mkt = { q: '', statut: 'actifs' };
  return ctx.etat.mkt;
}

function ouvrirProspect(ctx, id, prerempli) {
  const m = ctx.m;
  const p = (id && m.get('prospects', id)) || Object.assign({ statut: 'a_contacter', responsable: ctx.moi, prochaine: aujourdhui() }, prerempli || {});
  const corps = `<div class="champs">
    <div class="champ plein"><label for="p-org">Organisation</label><input id="p-org" name="organisation" type="text" required value="${esc(p.organisation)}"></div>
    <div class="champ"><label for="p-type">Type</label><select id="p-type" name="type">${options(TYPES_PROSPECT, p.type, 'Choisir')}</select></div>
    <div class="champ"><label for="p-region">Région</label><input id="p-region" name="region" type="text" value="${esc(p.region)}" placeholder="Ex. : Mauricie"></div>
    <div class="champ"><label for="p-contact">Personne contact</label><input id="p-contact" name="contact" type="text" value="${esc(p.contact)}"></div>
    <div class="champ"><label for="p-courriel">Courriel</label><input id="p-courriel" name="courriel" type="email" value="${esc(p.courriel)}"></div>
    <div class="champ"><label for="p-tel">Téléphone</label><input id="p-tel" name="telephone" type="tel" value="${esc(p.telephone)}"></div>
    <div class="champ"><label for="p-valeur">Valeur estimée ($)</label><input id="p-valeur" name="valeur" type="number" min="0" step="1" value="${esc(p.valeur)}"></div>
    <div class="champ"><label for="p-statut">Étape</label><select id="p-statut" name="statut">${options(STATUTS_PROSPECT, p.statut)}</select></div>
    <div class="champ"><label for="p-resp">Responsable</label><select id="p-resp" name="responsable">${options(ctx.membres, p.responsable)}</select></div>
    <div class="champ"><label for="p-action">Prochaine action</label><input id="p-action" name="action" type="text" value="${esc(p.action)}" placeholder="Ex. : Relancer par courriel"></div>
    <div class="champ"><label for="p-quand">Quand</label><input id="p-quand" name="prochaine" type="date" value="${esc(p.prochaine)}"></div>
    <div class="champ plein"><label for="p-notes">Notes</label><textarea id="p-notes" name="notes">${esc(p.notes)}</textarea></div>
  </div>`;
  const pied = id ? `<div class="actions"><button type="button" class="btn-2 btn-danger" data-modal-act="supprimer">Supprimer</button>
    <button type="button" class="btn-2" data-modal-act="commande">Créer une commande</button></div>` : '';
  ouvrirFenetre({
    titre: id ? p.organisation : 'Nouveau prospect', corps, pied,
    onAction(act) {
      if (act === 'supprimer') { if (!confirm('Supprimer ' + p.organisation + ' ?')) return null; m.supprimer('prospects', id); return 'fermer'; }
      if (act === 'commande') {
        setTimeout(() => ouvrirCommande(ctx, null, { client: p.organisation, courriel: p.courriel, telephone: p.telephone, segment: 'entreprise', produit: 'mesure', prix: Number(p.valeur) || 0, statut: 'approbation', notes: 'Prospect : ' + (p.contact || '') }), 50);
        m.modifier('prospects', id, { statut: 'gagne' }, true);
        journaliser(m, 'Prospect gagné : ' + p.organisation + '. Bravo.', '#/marketing', 'prospect');
        m.avertir('local');
        return 'fermer';
      }
      return null;
    },
    onSubmit(d) {
      const n = m.mettre('prospects', Object.assign({}, p, d, { id: id || uid('r'), valeur: Number(d.valeur) || 0 }), true);
      if (!id) journaliser(m, 'Nouveau prospect : ' + n.organisation + (p.demande ? ' (demande reçue par le site)' : ''), '#/marketing', 'prospect');
      else if (p.statut !== n.statut) journaliser(m, n.organisation + ' passe à « ' + statutProspect(n.statut).nom + ' »', '#/marketing', 'prospect');
      m.avertir('local');
      toast(id ? 'Prospect enregistré.' : 'Prospect ajouté.');
    },
  });
}

function ouvrirCampagne(ctx, id) {
  const m = ctx.m;
  const k = (id && m.get('campagnes', id)) || { canal: CANAUX[0], segment: 'terre', debut: aujourdhui(), budget: 50 };
  const corps = `<div class="champs">
    <div class="champ plein"><label for="k-nom">Nom de la campagne</label><input id="k-nom" name="nom" type="text" required value="${esc(k.nom)}"></div>
    <div class="champ"><label for="k-canal">Canal</label><select id="k-canal" name="canal">${options(CANAUX, k.canal)}</select></div>
    <div class="champ"><label for="k-seg">Segment</label><select id="k-seg" name="segment">${options(SEGMENTS, k.segment, 'Tous')}</select></div>
    <div class="champ"><label for="k-debut">Début</label><input id="k-debut" name="debut" type="date" value="${esc(k.debut)}"></div>
    <div class="champ"><label for="k-fin">Fin</label><input id="k-fin" name="fin" type="date" value="${esc(k.fin)}"></div>
    <div class="champ"><label for="k-budget">Budget ($)</label><input id="k-budget" name="budget" type="number" min="0" step="0.01" value="${esc(k.budget)}"></div>
    <div class="champ"><label for="k-dep">Dépensé à ce jour ($)</label><input id="k-dep" name="depense" type="number" min="0" step="0.01" value="${esc(k.depense)}"></div>
    <div class="champ"><label for="k-vis">Visites de l'outil</label><input id="k-vis" name="visites" type="number" min="0" step="1" value="${esc(k.visites)}"></div>
    <div class="champ"><label for="k-cmd">Commandes obtenues</label><input id="k-cmd" name="commandes" type="number" min="0" step="1" value="${esc(k.commandes)}"></div>
    <div class="champ plein"><label for="k-notes">Notes</label><textarea id="k-notes" name="notes">${esc(k.notes)}</textarea>
      <span class="aide">Le montant dépensé sert au suivi des résultats. Pour la comptabilité, entre la facture dans Finances.</span></div>
  </div>`;
  ouvrirFenetre({
    titre: id ? k.nom : 'Nouvelle campagne', corps,
    pied: id ? '<div class="actions"><button type="button" class="btn-2 btn-danger" data-modal-act="supprimer">Supprimer</button></div>' : '',
    onAction(act) { if (act === 'supprimer' && confirm('Supprimer la campagne ' + k.nom + ' ?')) { m.supprimer('campagnes', id); return 'fermer'; } return null; },
    onSubmit(d) {
      m.mettre('campagnes', Object.assign({}, k, d, { id: id || uid('k'), budget: Number(d.budget) || 0, depense: Number(d.depense) || 0, visites: Number(d.visites) || 0, commandes: Number(d.commandes) || 0 }));
      toast('Campagne enregistrée.');
    },
  });
}

// Demandes reçues par les formulaires du site (sauf l'infolettre) : à transformer en prospect en un clic.
function demandesATraiter(ctx) {
  const w = statsWix(ctx.m);
  const deja = new Set(ctx.m.liste('prospects', true).map(p => p.demande).filter(Boolean));
  const ignorees = new Set(reglages(ctx.m).demandesIgnorees || []);
  return ((w && w.formulaires) || []).filter(d => !d.infolettre && !deja.has(d.id) && !ignorees.has(d.id));
}
function carteDemandes(ctx) {
  const l = demandesATraiter(ctx);
  if (!l.length) return '';
  return `<section class="carte" style="border-color:var(--accent-texte)">
    <div class="carte-tete"><h2>Demandes reçues par le site · ${l.length}</h2><span class="tres-petit doux">Formulaires Wix, lus par l’ordi de la maison</span></div>
    ${l.slice(0, 10).map(d => `<div class="ligne" style="align-items:flex-start;flex-wrap:wrap">
      <span class="grow petit" style="min-width:220px"><strong>${esc(d.nom || d.courriel || 'Sans nom')}</strong> · ${esc(d.formulaire)}<br>
        <span class="doux">${esc(dateCourte((d.date || '').slice(0, 10)))}${d.courriel ? ' · <a href="mailto:' + esc(d.courriel) + '">' + esc(d.courriel) + '</a>' : ''}${d.lieu ? ' · ' + esc(d.lieu) : ''}</span>
        ${d.message ? '<br><span class="doux">' + esc(d.message).slice(0, 200) + '</span>' : ''}</span>
      <span class="actions"><button type="button" class="btn" data-act="demande-prospect" data-id="${esc(d.id)}">Ajouter aux prospects</button>
      <button type="button" class="btn-lien" data-act="demande-ignorer" data-id="${esc(d.id)}">Ignorer</button></span>
    </div>`).join('')}
  </section>`;
}

function vueProspects(ctx) {
  const e = etatVue(ctx);
  const tous = ctx.m.liste('prospects');
  const q = e.q.toLowerCase();
  const liste = tous
    .filter(p => e.statut === 'tous' || (e.statut === 'actifs' ? !['gagne', 'perdu'].includes(p.statut) : p.statut === e.statut))
    .filter(p => !q || [p.organisation, p.region, p.contact, p.type, p.notes].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => String(a.prochaine || '9').localeCompare(String(b.prochaine || '9')));
  const compte = id => tous.filter(p => p.statut === id).length;
  const valeur = tous.filter(p => !['gagne', 'perdu'].includes(p.statut)).reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const entonnoir = STATUTS_PROSPECT.map(s => `<button type="button" class="carte kpi" data-act="filtre-statut" data-s="${s.id}" style="text-align:left;cursor:pointer;color:inherit;font:inherit;${e.statut === s.id ? 'border-color:var(--accent-texte)' : ''}">
      <p class="surtitre">${esc(s.nom)}</p><p class="valeur" style="font-size:24px">${compte(s.id)}</p></button>`).join('');
  const lignes = liste.map(p => {
    const s = statutProspect(p.statut);
    const j = p.prochaine ? joursEntre(aujourdhui(), p.prochaine) : null;
    const actif = !['gagne', 'perdu'].includes(p.statut);
    return `<tr class="cliquable" data-act="ouvrir" data-id="${esc(p.id)}" tabindex="0">
      <td><strong>${esc(p.organisation)}</strong><br><span class="petit doux">${esc(p.type)}${p.region ? ' · ' + esc(p.region) : ''}</span></td>
      <td class="petit">${esc(p.contact)}${p.courriel ? `<br><a href="mailto:${esc(p.courriel)}">${esc(p.courriel)}</a>` : ''}${p.telephone ? `<br>${esc(p.telephone)}` : ''}</td>
      <td><span class="etiquette ${s.classe}">${esc(s.nom)}</span></td>
      <td class="petit">${esc(p.action)}${p.prochaine && actif ? `<br><span class="${j < 0 ? 'retard' : j === 0 ? 'vert-t' : 'doux'}">${j < 0 ? 'En retard · ' : j === 0 ? 'Aujourd’hui · ' : ''}${esc(dateCourte(p.prochaine))}</span>` : ''}</td>
      <td class="droite num">${p.valeur ? argent(p.valeur) : ''}</td>
      <td><span class="initiales" title="${esc(p.responsable)}">${esc(initiales(p.responsable))}</span></td>
    </tr>`;
  }).join('');
  return `
    ${carteDemandes(ctx)}
    <section class="g6" aria-label="Étapes">${entonnoir}</section>
    <div class="filtres">
      <label class="sr" for="cherche-p">Chercher</label>
      <input id="cherche-p" type="search" placeholder="Organisation, région, contact" value="${esc(e.q)}" data-input="cherche">
      <label class="sr" for="filtre-p">Étape</label>
      <select id="filtre-p" data-chg="statut">${options([{ id: 'actifs', nom: 'En cours' }, { id: 'tous', nom: 'Tous' }].concat(STATUTS_PROSPECT), e.statut)}</select>
      <span class="petit doux">Valeur en cours : ${argent(valeur)}</span>
    </div>
    <div class="carte table-boite" style="padding:6px 8px">
      <table class="liste"><thead><tr><th>Organisation</th><th>Contact</th><th>Étape</th><th>Prochaine action</th><th class="droite">Valeur</th><th><span class="sr">Responsable</span></th></tr></thead>
      <tbody>${lignes || '<tr><td colspan="6" class="vide">Aucun prospect ici. <button type="button" class="btn-lien" data-act="nouveau">Ajouter un prospect</button></td></tr>'}</tbody></table>
    </div>`;
}

function vueCampagnes(ctx) {
  const ks = ctx.m.liste('campagnes').sort((a, b) => String(b.debut || '').localeCompare(String(a.debut || '')));
  const tot = ks.reduce((s, k) => ({ dep: s.dep + (Number(k.depense) || 0), vis: s.vis + (Number(k.visites) || 0), cmd: s.cmd + (Number(k.commandes) || 0) }), { dep: 0, vis: 0, cmd: 0 });
  const auj = aujourdhui();
  const lignes = ks.map(k => {
    const enCours = (!k.debut || k.debut <= auj) && (!k.fin || k.fin >= auj);
    const util = k.budget ? Math.min(100, (Number(k.depense) || 0) / k.budget * 100) : 0;
    return `<tr class="cliquable" data-act="ouvrir-k" data-id="${esc(k.id)}" tabindex="0">
      <td><strong>${esc(k.nom)}</strong><br><span class="petit doux">${esc(k.canal)}</span></td>
      <td>${esc(k.segment ? nomSegment(k.segment) : 'Tous')}</td>
      <td class="petit num">${esc(dateCourte(k.debut))}${k.fin ? ' au ' + esc(dateCourte(k.fin)) : ''}<br>${enCours ? '<span class="etiquette vert">En cours</span>' : '<span class="etiquette gris">Terminée</span>'}</td>
      <td class="num" style="min-width:150px">${argent(k.depense, 2)} <span class="doux">/ ${argent(k.budget)}</span><div class="barre" style="margin-top:6px;height:6px"><span style="width:${util}%"></span></div></td>
      <td class="droite num">${nombre(k.visites)}</td>
      <td class="droite num">${nombre(k.commandes)}</td>
      <td class="droite num">${k.commandes ? argent((Number(k.depense) || 0) / k.commandes, 2) : '—'}</td>
    </tr>`;
  }).join('');
  const meta = totauxMeta(ctx.m, 30);
  const dep = tot.dep + (meta ? meta.depense : 0), vis = tot.vis + (meta ? meta.vues : 0);
  return `
    <section class="g4" aria-label="Totaux">
      <div class="carte kpi"><p class="surtitre">Dépensé</p><p class="valeur">${argent(dep, 2)}</p>${meta ? `<p class="detail">dont Meta ${argent(meta.depense, 2)} · 30 j</p>` : ''}</div>
      <div class="carte kpi"><p class="surtitre">Visites</p><p class="valeur">${nombre(vis)}</p>${meta ? `<p class="detail">dont Meta ${nombre(meta.vues)} · 30 j</p>` : ''}</div>
      <div class="carte kpi"><p class="surtitre">Commandes</p><p class="valeur">${nombre(tot.cmd)}</p>${meta ? `<p class="detail">${nombre(meta.conversions)} conversions Meta · 30 j</p>` : ''}</div>
      <div class="carte kpi"><p class="surtitre">Coût par commande</p><p class="valeur">${tot.cmd ? argent(dep / tot.cmd, 2) : '—'}</p></div>
    </section>
    <section class="carte">
      <div class="carte-tete"><h2>Campagnes Meta</h2><span class="tres-petit doux">Lues automatiquement par l’ordi de la maison</span></div>
      ${tableauMeta(ctx.m)}
    </section>
    <section class="carte">
      <div class="carte-tete"><h2>Conversions Meta et zones choisies</h2><span class="tres-petit doux">Ce que les pubs font vraiment dans l’outil</span></div>
      ${blocCorrelation(ctx.m)}
    </section>
    <section class="carte table-boite" style="padding:6px 8px">
      <div class="carte-tete" style="padding:10px 10px 0"><h2>Autres campagnes (suivies à la main)</h2></div>
      <table class="liste"><thead><tr><th>Campagne</th><th>Segment</th><th>Période</th><th>Dépensé / budget</th><th class="droite">Visites</th><th class="droite">Commandes</th><th class="droite">Coût / commande</th></tr></thead>
      <tbody>${lignes || '<tr><td colspan="7" class="vide">Aucune. Pour une campagne hors Meta (journal, salon, Google…) : <button type="button" class="btn-lien" data-act="nouvelle-k">Ajouter une campagne</button></td></tr>'}</tbody></table>
    </section>`;
}

export default {
  titre: 'Marketing',
  render(ctx) {
    const sous = ctx.route.sous;
    return `<header class="entete">
        <div><p class="surtitre">Marketing et prospection</p><h1 class="titre-1">${sous === 'campagnes' ? 'Campagnes' : sous === 'suivi' ? 'Site et pubs' : sous === 'contenu' ? 'Calendrier de contenu' : 'Prospection Entreprise'}</h1></div>
        <div class="actions">${sous === 'campagnes' ? '<button type="button" class="btn" data-act="nouvelle-k">+ Nouvelle campagne</button>' : sous === 'suivi' || sous === 'contenu' ? '' : '<button type="button" class="btn" data-act="nouveau">+ Nouveau prospect</button>'}</div>
      </header>
      <nav class="onglets" aria-label="Sections">
        <a href="#/marketing/suivi"${sous === 'suivi' ? ' aria-current="page"' : ''}>Site et pubs</a>
        <a href="#/marketing"${!sous ? ' aria-current="page"' : ''}>Prospection</a>
        <a href="#/marketing/campagnes"${sous === 'campagnes' ? ' aria-current="page"' : ''}>Campagnes</a>
        <a href="#/marketing/contenu"${sous === 'contenu' ? ' aria-current="page"' : ''}>Contenu</a>
      </nav>
      ${sous === 'campagnes' ? vueCampagnes(ctx) : sous === 'suivi' ? vueSuivi(ctx) : sous === 'contenu' ? vueContenu(ctx) : vueProspects(ctx)}`;
  },
  actions: {
    ...actionsContenu,
    nouveau: ctx => ouvrirProspect(ctx, null),
    ouvrir: (ctx, el) => ouvrirProspect(ctx, el.getAttribute('data-id')),
    'nouvelle-k': ctx => ouvrirCampagne(ctx, null),
    'demande-prospect': (ctx, el) => {
      const d = demandesATraiter(ctx).find(x => x.id === el.getAttribute('data-id'));
      if (!d) return;
      const details = (d.champs || []).filter(c => c.valeur).map(c => (c.libelle || c.cle) + ' : ' + c.valeur).join('\n');
      ouvrirProspect(ctx, null, { organisation: d.nom || d.courriel || 'Demande du site', contact: d.nom || '', courriel: d.courriel || '', telephone: d.telephone || '',
        action: 'Répondre à la demande', notes: 'Demande reçue par le site (' + d.formulaire + ', ' + (d.date || '').slice(0, 10) + ')\n' + details, demande: d.id });
    },
    'vider-entonnoir': ctx => {
      if (!confirm('Vider le compteur « Entonnoir » du site ?\n\nL’ordi de la maison vérifie d’abord que tout est copié dans OneDrive (Hub-Georama › entonnoir), puis retire du site Wix les entrées de plus de 7 jours. Sur le site, ces entrées ne pourront pas être remises ; la copie reste dans OneDrive.')) return;
      ctx.m.mettre('travaux', { id: uid('w'), type: 'vider-entonnoir', options: { jours: 7 }, demandePar: ctx.moi, demandeLe: new Date().toISOString() }, true);
      journaliser(ctx.m, 'Compteur Entonnoir : vidage demandé (archive gardée dans OneDrive)', '#/marketing/suivi', 'travail');
      ctx.m.avertir('local');
      toast('Demande envoyée à l’ordi de la maison.');
    },
    'demande-ignorer': (ctx, el) => {
      const R = reglages(ctx.m);
      ctx.m.mettre('reglages', Object.assign({}, R, { id: 'general', demandesIgnorees: (R.demandesIgnorees || []).concat([el.getAttribute('data-id')]).slice(-500) }));
      toast('Demande mise de côté.');
    },
    'ouvrir-k': (ctx, el) => ouvrirCampagne(ctx, el.getAttribute('data-id')),
    'filtre-statut': (ctx, el) => { const e = etatVue(ctx); const s = el.getAttribute('data-s'); e.statut = e.statut === s ? 'actifs' : s; ctx.rendre(); },
  },
  changes: {
    ...changesContenu,
    cherche: (ctx, el) => { etatVue(ctx).q = el.value; ctx.rendre(); },
    statut: (ctx, el) => { etatVue(ctx).statut = el.value; ctx.rendre(); },
    suivi: (ctx, el) => { const e = etatSuivi(ctx); e[el.getAttribute('data-cle')] = el.value; e.vue = null; ctx.rendre(); },
  },
  apres(ctx, racine) {
    racine.querySelectorAll('tr.cliquable').forEach(tr => tr.addEventListener('keydown', ev => { if (ev.key === 'Enter') tr.click(); }));
    if (ctx.route.sous === 'suivi') monterCarte(ctx, racine);
  },
};
