// Module Commandes et clients.
import { esc, argent, dateCourte, options, ouvrirFenetre, aujourdhui, ajouterJours, joursEntre, uid, toast, initiales } from '../ui.js';
import {
  SEGMENTS, PRODUITS, NOMS_GAMMES, STATUTS, ACTIVES, nomSegment, produit, statut, formatTexte, totalHT,
  prochainNumero, synchroniserPlaques, demandeApprobation, estActive, taxesDe, reglages, plaquesDe, ETAPES,
} from '../donnees.js';

function etatVue(ctx) {
  if (!ctx.etat.commandes) ctx.etat.commandes = { q: '', statut: 'actives', segment: '' };
  return ctx.etat.commandes;
}

export function badgeStatut(id) { const s = statut(id); return `<span class="etiquette ${s.classe}">${esc(s.nom)}</span>`; }

export function promiseTexte(c) {
  if (!c.promise) return '';
  if (!estActive(c)) return esc(dateCourte(c.promise));
  const j = joursEntre(aujourdhui(), c.promise);
  if (j < 0) return `<span class="retard">${esc(dateCourte(c.promise))} · en retard</span>`;
  if (j <= 3) return `<span style="color:var(--balise)">${esc(dateCourte(c.promise))} · dans ${j} j</span>`;
  return esc(dateCourte(c.promise));
}

export function ouvrirCommande(ctx, id, prerempli = {}) {
  const m = ctx.m;
  const R = reglages(m);
  const existante = id ? m.get('commandes', id) : null;
  const recue = aujourdhui();
  const c = existante || Object.assign({
    segment: 'terre', produit: 'signature', gamme: 'Boréal', prix: 250, livraison: 'postes', fraisLivraison: R.livraison,
    recue, promise: ajouterJours(recue, R.delaiJours), responsable: ctx.moi, payee: true, plaques: 1,
  }, prerempli);
  const plaques = existante ? plaquesDe(m, existante.id) : [];
  const impr = plaques.filter(p => p.statut === 'fini').length;
  const corps = `
    ${existante ? `<p class="petit doux" style="margin:0 0 14px">${esc(c.numero)} · ${impr}/${plaques.length || '—'} plaque${plaques.length > 1 ? 's' : ''} imprimée${impr > 1 ? 's' : ''} · modifiée par ${esc(c.par || '—')}</p>` : ''}
    <div class="champs">
      <div class="champ"><label for="f-client">Client</label><input id="f-client" name="client" type="text" required value="${esc(c.client)}" autocomplete="off"></div>
      <div class="champ"><label for="f-courriel">Courriel</label><input id="f-courriel" name="courriel" type="email" value="${esc(c.courriel)}"></div>
      <div class="champ"><label for="f-tel">Téléphone</label><input id="f-tel" name="telephone" type="tel" value="${esc(c.telephone)}"></div>
      <div class="champ"><label for="f-lieu">Territoire</label><input id="f-lieu" name="lieu" type="text" value="${esc(c.lieu)}" placeholder="Ex. : Lac Aylmer, Terre à bois à Normandin"></div>
      <div class="champ plein"><label for="f-lien">Lien de la zone (outil client)</label><input id="f-lien" name="lien" type="url" value="${esc(c.lien)}" placeholder="https://www.georama.ca/zone?p=…"><span class="aide">Le lien se colle ensuite dans Georama Production pour faire le .3mf.</span></div>
      <div class="champ"><label for="f-segment">Segment</label><select id="f-segment" name="segment">${options(SEGMENTS, c.segment)}</select></div>
      <div class="champ"><label for="f-produit">Produit</label><select id="f-produit" name="produit">${options(PRODUITS.map(p => ({ id: p.id, nom: p.nom + (p.prix ? ' · ' + p.prix + ' $' : '') })), c.produit)}</select></div>
      <div class="champ" id="bloc-plaques"${c.produit === 'mesure' ? '' : ' hidden'}><label for="f-plaques">Nombre de plaques</label><input id="f-plaques" name="plaques" type="number" min="1" max="40" value="${esc(c.plaques || 1)}"></div>
      <div class="champ"><label for="f-gamme">Gamme de couleurs</label><select id="f-gamme" name="gamme">${options(NOMS_GAMMES, c.gamme)}</select></div>
      <div class="champ"><label for="f-prix">Prix avant taxes ($)</label><input id="f-prix" name="prix" type="number" min="0" step="0.01" value="${esc(c.prix)}"><span class="aide">Cadre de bois : ajouter 30 $.</span></div>
      <div class="champ"><label for="f-livraison">Livraison</label><select id="f-livraison" name="livraison">${options([{ id: 'postes', nom: 'Postes Canada (' + (c.fraisLivraison ?? R.livraison) + ' $)' }, { id: 'recuperation', nom: 'Récupération à Saint-Félicien' }], c.livraison)}</select></div>
      <div class="champ"><label for="f-recue">Reçue le</label><input id="f-recue" name="recue" type="date" required value="${esc(c.recue)}"></div>
      <div class="champ"><label for="f-promise">Promise le</label><input id="f-promise" name="promise" type="date" value="${esc(c.promise)}"><span class="aide">Par défaut : ${R.delaiJours} jours après la réception.</span></div>
      <div class="champ"><label for="f-statut">Statut</label><select id="f-statut" name="statut">${options(STATUTS, c.statut || (demandeApprobation(c) ? 'approbation' : 'nouvelle'))}</select></div>
      <div class="champ"><label for="f-resp">Responsable</label><select id="f-resp" name="responsable">${options(ctx.membres, c.responsable)}</select></div>
      <div class="champ"><label for="f-suivi">Numéro de suivi</label><input id="f-suivi" name="suivi" type="text" value="${esc(c.suivi)}"></div>
      <div class="champ" style="justify-content:flex-end"><label class="case"><input type="checkbox" name="payee"${c.payee ? ' checked' : ''}> Payée</label></div>
      <div class="champ plein"><label for="f-notes">Notes</label><textarea id="f-notes" name="notes">${esc(c.notes)}</textarea></div>
    </div>`;
  const pied = existante
    ? `<div class="actions"><button type="button" class="btn-2 btn-danger" data-modal-act="supprimer">Supprimer</button>
       <a class="btn-2" href="#/production/fiche/${esc(existante.id)}" data-modal-act="fiche">Fiche de production</a></div>`
    : '';
  const { form } = ouvrirFenetre({
    titre: existante ? 'Commande ' + existante.numero : 'Nouvelle commande',
    corps, pied, large: true,
    onAction(act) {
      if (act === 'supprimer') {
        if (!confirm('Supprimer la commande ' + existante.numero + ' ? Ses plaques sortent de la file.')) return;
        m.supprimer('commandes', existante.id);
        plaquesDe(m, existante.id).forEach(p => m.supprimer('plaques', p.id));
        toast('Commande supprimée.');
        return 'fermer';
      }
      if (act === 'fiche') return 'fermer';
      return null;
    },
    onSubmit(d) {
      const fiche = Object.assign({}, existante || { id: uid('c'), etapes: {}, tempsMin: 0, fraisLivraison: R.livraison }, {
        client: d.client, courriel: d.courriel, telephone: d.telephone, lieu: d.lieu, lien: d.lien,
        segment: d.segment, produit: d.produit, plaques: d.produit === 'mesure' ? Math.max(1, Number(d.plaques) || 1) : produit(d.produit).plaques,
        gamme: d.gamme, prix: Number(d.prix) || 0, livraison: d.livraison, recue: d.recue,
        promise: d.promise || ajouterJours(d.recue, R.delaiJours), statut: d.statut, responsable: d.responsable,
        suivi: d.suivi, payee: !!d.payee, notes: d.notes,
      });
      if (!existante) fiche.numero = prochainNumero(m, fiche);
      if (fiche.statut === 'expediee' || fiche.statut === 'livree') {
        fiche.etapes = Object.assign({}, fiche.etapes);
        if (!fiche.etapes.envoi) fiche.etapes.envoi = { fait: true, par: ctx.moi, le: new Date().toISOString() };
      }
      const sauvee = m.mettre('commandes', fiche, true);
      synchroniserPlaques(m, sauvee);
      m.avertir('local');
      toast(existante ? 'Commande ' + sauvee.numero + ' enregistrée.' : 'Commande ' + sauvee.numero + ' créée. Ses plaques sont dans la file.');
    },
  });
  const prix = form.querySelector('#f-prix');
  let prixTouche = !!existante;
  prix.addEventListener('input', () => { prixTouche = true; });
  form.querySelector('#f-produit').addEventListener('change', e => {
    const p = produit(e.target.value);
    form.querySelector('#bloc-plaques').hidden = e.target.value !== 'mesure';
    if (!prixTouche && p.prix) prix.value = p.prix;
    majStatutDefaut();
  });
  const majStatutDefaut = () => {
    if (existante) return;
    const besoin = form.querySelector('#f-segment').value === 'entreprise' || form.querySelector('#f-produit').value === 'mesure';
    form.querySelector('#f-statut').value = besoin ? 'approbation' : 'nouvelle';
  };
  form.querySelector('#f-segment').addEventListener('change', majStatutDefaut);
  form.querySelector('#f-recue').addEventListener('change', e => {
    if (!existante && e.target.value) form.querySelector('#f-promise').value = ajouterJours(e.target.value, R.delaiJours);
  });
}

function filtrer(ctx) {
  const e = etatVue(ctx);
  const q = e.q.toLowerCase();
  return ctx.m.liste('commandes')
    .filter(c => e.statut === 'toutes' || (e.statut === 'actives' ? ACTIVES.includes(c.statut) : c.statut === e.statut))
    .filter(c => !e.segment || c.segment === e.segment)
    .filter(c => !q || [c.numero, c.client, c.courriel, c.lieu, c.notes].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => ACTIVES.includes(a.statut) && ACTIVES.includes(b.statut)
      ? String(a.promise || '').localeCompare(String(b.promise || ''))
      : String(b.recue || '').localeCompare(String(a.recue || '')));
}

function vueCommandes(ctx) {
  const e = etatVue(ctx);
  const liste = filtrer(ctx);
  const R = reglages(ctx.m);
  const lignes = liste.map(c => {
    const ht = totalHT(c);
    const t = taxesDe(ht, R.taxes);
    return `<tr class="cliquable" data-act="ouvrir" data-id="${esc(c.id)}" tabindex="0">
      <td><strong>${esc(c.numero)}</strong></td>
      <td>${esc(c.client)}<br><span class="petit doux">${esc(c.lieu)}</span></td>
      <td>${esc(nomSegment(c.segment))}</td>
      <td class="petit">${esc(formatTexte(c))}<br><span class="doux">${esc(c.gamme)}</span></td>
      <td>${badgeStatut(c.statut)}</td>
      <td class="petit num">${esc(dateCourte(c.recue))}</td>
      <td class="petit num">${promiseTexte(c)}</td>
      <td class="droite num">${argent(ht + t.tps + t.tvq, 2)}${c.payee ? '' : '<br><span class="etiquette orange">À encaisser</span>'}</td>
      <td><span class="initiales" title="${esc(c.responsable)}">${esc(initiales(c.responsable))}</span></td>
    </tr>`;
  }).join('');
  return `
    <div class="filtres">
      <label class="sr" for="cherche-cmd">Chercher une commande</label>
      <input id="cherche-cmd" type="search" placeholder="Client, numéro, lieu" value="${esc(e.q)}" data-input="cherche">
      <label class="sr" for="filtre-statut">Statut</label>
      <select id="filtre-statut" data-chg="statut">${options([{ id: 'actives', nom: 'En cours' }, { id: 'toutes', nom: 'Toutes' }].concat(STATUTS), e.statut)}</select>
      <label class="sr" for="filtre-seg">Segment</label>
      <select id="filtre-seg" data-chg="segment">${options(SEGMENTS, e.segment, 'Tous les segments')}</select>
      <span class="petit doux">${liste.length} commande${liste.length > 1 ? 's' : ''}</span>
    </div>
    <div class="carte table-boite" style="padding:6px 8px">
      <table class="liste"><thead><tr><th>Numéro</th><th>Client</th><th>Segment</th><th>Format</th><th>Statut</th><th>Reçue</th><th>Promise</th><th class="droite">Total TTC</th><th><span class="sr">Responsable</span></th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="9" class="vide">Aucune commande ici. <button type="button" class="btn-lien" data-act="nouvelle">Ajouter une commande</button></td></tr>`}</tbody></table>
    </div>`;
}

function vueClients(ctx) {
  const groupes = new Map();
  ctx.m.liste('commandes').filter(c => c.statut !== 'annulee').forEach(c => {
    const cle = (c.courriel || c.client || '').toLowerCase();
    if (!groupes.has(cle)) groupes.set(cle, { client: c.client, courriel: c.courriel, telephone: c.telephone, n: 0, total: 0, derniere: '', segments: new Set() });
    const g = groupes.get(cle);
    g.n += 1; g.total += totalHT(c); g.segments.add(nomSegment(c.segment));
    if (String(c.recue) > g.derniere) { g.derniere = c.recue; g.client = c.client; }
    if (c.telephone) g.telephone = c.telephone;
  });
  const liste = Array.from(groupes.values()).sort((a, b) => b.derniere.localeCompare(a.derniere));
  return `<div class="carte table-boite" style="padding:6px 8px">
    <table class="liste"><thead><tr><th>Client</th><th>Courriel</th><th>Téléphone</th><th>Segments</th><th class="droite">Commandes</th><th class="droite">Total avant taxes</th><th>Dernière</th></tr></thead>
    <tbody>${liste.map(g => `<tr class="cliquable" data-act="voir-client" data-q="${esc(g.client)}" tabindex="0">
      <td><strong>${esc(g.client)}</strong></td>
      <td class="petit">${g.courriel ? `<a href="mailto:${esc(g.courriel)}">${esc(g.courriel)}</a>` : ''}</td>
      <td class="petit">${esc(g.telephone)}</td>
      <td class="petit">${esc(Array.from(g.segments).join(', '))}</td>
      <td class="droite num">${g.n}</td><td class="droite num">${argent(g.total)}</td>
      <td class="petit num">${esc(dateCourte(g.derniere))}</td></tr>`).join('') || '<tr><td colspan="7" class="vide">Les clients apparaissent ici dès la première commande.</td></tr>'}</tbody></table>
  </div>`;
}

export default {
  titre: 'Commandes',
  render(ctx) {
    const sous = ctx.route.sous;
    const actives = ctx.m.liste('commandes').filter(estActive).length;
    return `<header class="entete">
        <div><p class="surtitre">Commandes et clients</p><h1 class="titre-1">${sous === 'clients' ? 'Clients' : 'Commandes'}</h1></div>
        <div class="actions"><span class="petit doux">${actives} en cours</span><button type="button" class="btn" data-act="nouvelle">+ Nouvelle commande</button></div>
      </header>
      <nav class="onglets" aria-label="Sections">
        <a href="#/commandes"${sous !== 'clients' ? ' aria-current="page"' : ''}>Commandes</a>
        <a href="#/commandes/clients"${sous === 'clients' ? ' aria-current="page"' : ''}>Clients</a>
      </nav>
      ${sous === 'clients' ? vueClients(ctx) : vueCommandes(ctx)}`;
  },
  actions: {
    nouvelle: ctx => ouvrirCommande(ctx, null),
    ouvrir: (ctx, el) => ouvrirCommande(ctx, el.getAttribute('data-id')),
    'voir-client': (ctx, el) => { const e = etatVue(ctx); e.q = el.getAttribute('data-q'); e.statut = 'toutes'; ctx.aller('#/commandes'); },
  },
  changes: {
    cherche: (ctx, el) => { etatVue(ctx).q = el.value; ctx.rendre(); },
    statut: (ctx, el) => { etatVue(ctx).statut = el.value; ctx.rendre(); },
    segment: (ctx, el) => { etatVue(ctx).segment = el.value; ctx.rendre(); },
  },
  apres(ctx, racine) {
    racine.querySelectorAll('tr.cliquable').forEach(tr => tr.addEventListener('keydown', ev => { if (ev.key === 'Enter') tr.click(); }));
  },
};
export { ETAPES };
