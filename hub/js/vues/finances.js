// Module Finances : ventes, dépenses, taxes, objectif.
import { esc, argent, pct, dateCourte, options, ouvrirFenetre, aujourdhui, uid, toast, telecharger, csv } from '../ui.js';
import { reglages, resume, ventes, depenses, CATEGORIES_DEPENSE, nomSegment, taxesDe, moisCourant, TPS, TVQ, journaliser } from '../donnees.js';
import { ouvrirCommande } from './commandes.js';

function etatVue(ctx) {
  if (!ctx.etat.fin) ctx.etat.fin = { periode: moisCourant() };
  return ctx.etat.fin;
}
function periodes() {
  const l = [];
  const d = new Date();
  const a = d.getFullYear();
  l.push({ id: String(a), nom: 'Année ' + a });
  for (let i = 0; i < 14; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const id = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
    const nom = x.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });
    l.push({ id, nom: nom.charAt(0).toUpperCase() + nom.slice(1) });
  }
  l.push({ id: String(a - 1), nom: 'Année ' + (a - 1) });
  return l;
}
const nomPeriode = id => (periodes().find(p => p.id === id) || { nom: id }).nom;

function ouvrirDepense(ctx, id) {
  const m = ctx.m;
  const d = (id && m.get('depenses', id)) || { date: aujourdhui(), categorie: 'Filament', taxesAuto: true };
  const corps = `<div class="champs">
    <div class="champ"><label for="d-date">Date</label><input id="d-date" name="date" type="date" required value="${esc(d.date)}"></div>
    <div class="champ"><label for="d-four">Fournisseur</label><input id="d-four" name="fournisseur" type="text" required value="${esc(d.fournisseur)}"></div>
    <div class="champ"><label for="d-cat">Catégorie</label><select id="d-cat" name="categorie">${options(CATEGORIES_DEPENSE, d.categorie)}</select></div>
    <div class="champ"><label for="d-montant">Montant avant taxes ($)</label><input id="d-montant" name="montant" type="number" min="0" step="0.01" required value="${esc(d.montant)}"></div>
    <div class="champ"><label for="d-tps">TPS payée ($)</label><input id="d-tps" name="tps" type="number" min="0" step="0.01" value="${esc(d.tps)}"></div>
    <div class="champ"><label for="d-tvq">TVQ payée ($)</label><input id="d-tvq" name="tvq" type="number" min="0" step="0.01" value="${esc(d.tvq)}"></div>
    <div class="champ plein"><label class="case"><input type="checkbox" name="taxesAuto" id="d-auto"${d.taxesAuto !== false ? ' checked' : ''}> Calculer TPS (5 %) et TVQ (9,975 %) à partir du montant</label>
      <span class="aide">Décoche pour une facture sans taxes (ex. : fournisseur hors Canada) ou pour entrer les montants exacts du reçu.</span></div>
    <div class="champ plein"><label for="d-note">Note</label><input id="d-note" name="note" type="text" value="${esc(d.note)}" placeholder="Ex. : 4 bobines PETG"></div>
  </div>`;
  const { form } = ouvrirFenetre({
    titre: id ? 'Dépense · ' + d.fournisseur : 'Nouvelle dépense', corps,
    pied: id ? '<div class="actions"><button type="button" class="btn-2 btn-danger" data-modal-act="supprimer">Supprimer</button></div>' : '',
    onAction(act) { if (act === 'supprimer' && confirm('Supprimer cette dépense ?')) { m.supprimer('depenses', id); return 'fermer'; } return null; },
    onSubmit(v) {
      const montant = Number(v.montant) || 0;
      const t = v.taxesAuto ? taxesDe(montant, true) : { tps: Number(v.tps) || 0, tvq: Number(v.tvq) || 0 };
      m.mettre('depenses', Object.assign({}, d, { id: id || uid('d'), date: v.date, fournisseur: v.fournisseur, categorie: v.categorie, montant, tps: t.tps, tvq: t.tvq, taxesAuto: !!v.taxesAuto, note: v.note }), true);
      if (!id) journaliser(m, 'Dépense ajoutée : ' + v.fournisseur + ' (' + argent(montant, 2) + ')', '#/finances/depenses', 'depense');
      m.avertir('local');
      toast('Dépense enregistrée.');
    },
  });
  const maj = () => {
    const auto = form.querySelector('#d-auto').checked;
    const mt = Number(form.querySelector('#d-montant').value) || 0;
    form.querySelector('#d-tps').readOnly = auto;
    form.querySelector('#d-tvq').readOnly = auto;
    if (auto) { form.querySelector('#d-tps').value = (Math.round(mt * TPS * 100) / 100).toFixed(2); form.querySelector('#d-tvq').value = (Math.round(mt * TVQ * 100) / 100).toFixed(2); }
  };
  form.querySelector('#d-auto').addEventListener('change', maj);
  form.querySelector('#d-montant').addEventListener('input', maj);
  maj();
}

function vueResume(ctx) {
  const m = ctx.m;
  const R = reglages(m);
  const e = etatVue(ctx);
  const r = resume(m, e.periode);
  const annee = aujourdhui().slice(0, 4);
  const ra = resume(m, annee);
  const prog = R.objectif ? Math.max(0, Math.min(100, ra.benefice / R.objectif * 100)) : 0;
  const v = ventes(m, e.periode).sort((a, b) => String(b.c.recue).localeCompare(String(a.c.recue)));
  const netTps = r.tpsPercue - r.tpsPayee, netTvq = r.tvqPercue - r.tvqPayee;
  // Projection simple : bénéfice moyen par mois écoulé × 12
  const moisEcoules = new Date().getMonth() + 1;
  const parMois = [];
  for (let i = 1; i <= 12; i++) {
    const id = annee + '-' + String(i).padStart(2, '0');
    const x = resume(m, id);
    if (x.nbVentes || x.nbDepenses || i <= moisEcoules) parMois.push({ id, x });
  }
  const moisActifs = parMois.filter(p => p.x.nbVentes || p.x.nbDepenses);
  const premier = moisActifs.length ? Number(moisActifs[0].id.slice(5)) : moisEcoules;
  const rythme = ra.benefice / Math.max(1, moisEcoules - premier + 1);
  const lignesMois = parMois.filter(p => Number(p.id.slice(5)) >= premier).map(p => {
    const nom = new Date(Number(annee), Number(p.id.slice(5)) - 1, 1).toLocaleDateString('fr-CA', { month: 'long' });
    return `<tr${p.id === e.periode ? ' class="choisi"' : ''}><td>${esc(nom.charAt(0).toUpperCase() + nom.slice(1))}</td><td class="droite num">${argent(p.x.ventesHT, 2)}</td><td class="droite num">${argent(p.x.depensesHT, 2)}</td><td class="droite num ${p.x.benefice < 0 ? 'retard' : ''}">${argent(p.x.benefice, 2)}</td></tr>`;
  }).join('');
  return `
    <section class="g4" aria-label="Indicateurs">
      <div class="carte kpi"><p class="surtitre">Ventes · avant taxes</p><p class="valeur">${argent(r.ventesHT, 2)}</p><p class="detail">${r.nbVentes} commande${r.nbVentes > 1 ? 's' : ''} · ${esc(nomPeriode(e.periode))}</p></div>
      <div class="carte kpi"><p class="surtitre">Dépenses · avant taxes</p><p class="valeur">${argent(r.depensesHT, 2)}</p><p class="detail">${r.nbDepenses} dépense${r.nbDepenses > 1 ? 's' : ''}</p></div>
      <div class="carte kpi"><p class="surtitre">Bénéfice</p><p class="valeur${r.benefice < 0 ? ' retard' : ''}">${argent(r.benefice, 2)}</p><p class="detail">Ventes moins dépenses</p></div>
      <div class="carte kpi"><p class="surtitre">À encaisser</p><p class="valeur">${argent(r.aEncaisser, 2)}</p><p class="detail">Commandes non payées, taxes incluses</p></div>
    </section>
    <div class="g3">
      <section class="carte">
        <h2>Objectif ${esc(annee)}</h2>
        <p class="num" style="margin:4px 0 8px;font-size:28px;font-weight:700">${pct(prog)}</p>
        <div class="barre"><span style="width:${prog}%"></span></div>
        <p class="petit" style="margin:10px 0 0">Bénéfice ${argent(ra.benefice, 2)} sur ${argent(R.objectif)}.</p>
        <p class="petit doux" style="margin:6px 0 0">Au rythme actuel : environ ${argent(rythme)} par mois, soit ${argent(rythme * 12)} sur 12 mois.</p>
        <p class="tres-petit doux" style="margin:6px 0 0">Objectif modifiable dans Paramètres. Bénéfice avant impôts et salaires.</p>
      </section>
      <section class="carte">
        <h2>Taxes · ${esc(nomPeriode(e.periode))}</h2>
        ${R.taxes ? `<div class="ligne"><span class="grow">TPS perçue</span><span class="num">${argent(r.tpsPercue, 2)}</span></div>
        <div class="ligne"><span class="grow">TPS payée (CTI)</span><span class="num">− ${argent(r.tpsPayee, 2)}</span></div>
        <div class="ligne"><strong class="grow">TPS à remettre</strong><strong class="num">${argent(netTps, 2)}</strong></div>
        <div class="ligne"><span class="grow">TVQ perçue</span><span class="num">${argent(r.tvqPercue, 2)}</span></div>
        <div class="ligne"><span class="grow">TVQ payée (RTI)</span><span class="num">− ${argent(r.tvqPayee, 2)}</span></div>
        <div class="ligne"><strong class="grow">TVQ à remettre</strong><strong class="num">${argent(netTvq, 2)}</strong></div>` : '<p class="petit doux">Taxes désactivées dans Paramètres.</p>'}
        <p class="tres-petit doux" style="margin:8px 0 0">Estimation pour préparer la déclaration. La comptabilité officielle reste dans QuickBooks.</p>
      </section>
      <section class="carte table-boite">
        <h2>Par mois · ${esc(annee)}</h2>
        <table class="liste"><thead><tr><th>Mois</th><th class="droite">Ventes</th><th class="droite">Dépenses</th><th class="droite">Bénéfice</th></tr></thead><tbody>${lignesMois || '<tr><td colspan="4" class="vide">Rien encore cette année.</td></tr>'}</tbody></table>
      </section>
    </div>
    <section class="carte table-boite">
      <div class="carte-tete"><h2>Ventes · ${esc(nomPeriode(e.periode))}</h2><button type="button" class="btn-2" data-act="export-ventes">Exporter (CSV)</button></div>
      <table class="liste"><thead><tr><th>Date</th><th>Commande</th><th>Client</th><th>Segment</th><th class="droite">Avant taxes</th><th class="droite">TPS</th><th class="droite">TVQ</th><th class="droite">Total</th><th>Payée</th></tr></thead>
      <tbody>${v.map(x => `<tr>
        <td class="petit num">${esc(dateCourte(x.c.recue))}</td>
        <td><button type="button" class="btn-lien" data-act="ouvrir-cmd" data-id="${esc(x.c.id)}">${esc(x.c.numero)}</button></td>
        <td>${esc(x.c.client)}</td><td class="petit">${esc(nomSegment(x.c.segment))}</td>
        <td class="droite num">${argent(x.ht, 2)}</td><td class="droite num">${argent(x.tps, 2)}</td><td class="droite num">${argent(x.tvq, 2)}</td><td class="droite num"><strong>${argent(x.ht + x.tps + x.tvq, 2)}</strong></td>
        <td><label class="case" style="min-height:32px"><input type="checkbox" data-chg="payee" data-id="${esc(x.c.id)}"${x.c.payee ? ' checked' : ''}><span class="sr">Payée</span></label></td>
      </tr>`).join('') || '<tr><td colspan="9" class="vide">Aucune vente pour cette période.</td></tr>'}</tbody></table>
    </section>`;
}

function vueDepenses(ctx) {
  const m = ctx.m;
  const e = etatVue(ctx);
  const d = depenses(m, e.periode).sort((a, b) => String(b.d.date).localeCompare(String(a.d.date)));
  const parCat = {};
  d.forEach(x => { parCat[x.d.categorie] = (parCat[x.d.categorie] || 0) + x.ht; });
  const total = d.reduce((s, x) => s + x.ht, 0);
  return `
    <div class="cote">
      <section class="carte principal table-boite">
        <div class="carte-tete"><h2>Dépenses · ${esc(nomPeriode(e.periode))}</h2><button type="button" class="btn-2" data-act="export-depenses">Exporter (CSV)</button></div>
        <table class="liste"><thead><tr><th>Date</th><th>Fournisseur</th><th>Catégorie</th><th class="droite">Avant taxes</th><th class="droite">TPS</th><th class="droite">TVQ</th></tr></thead>
        <tbody>${d.map(x => `<tr class="cliquable" data-act="ouvrir-d" data-id="${esc(x.d.id)}" tabindex="0">
          <td class="petit num">${esc(dateCourte(x.d.date))}</td><td>${esc(x.d.fournisseur)}${x.d.note ? `<br><span class="petit doux">${esc(x.d.note)}</span>` : ''}</td>
          <td class="petit">${esc(x.d.categorie)}</td><td class="droite num">${argent(x.ht, 2)}</td><td class="droite num">${argent(x.tps, 2)}</td><td class="droite num">${argent(x.tvq, 2)}</td></tr>`).join('') || '<tr><td colspan="6" class="vide">Aucune dépense pour cette période. <button type="button" class="btn-lien" data-act="nouvelle-d">Ajouter une dépense</button></td></tr>'}</tbody></table>
      </section>
      <aside class="carte lateral">
        <h2>Par catégorie</h2>
        ${Object.entries(parCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="ligne"><span class="grow petit">${esc(c)}</span><span class="num petit">${argent(v, 2)}</span></div>
          <div class="barre" style="height:6px;margin:-4px 0 6px"><span style="width:${total ? v / total * 100 : 0}%"></span></div>`).join('') || '<p class="vide">—</p>'}
        <div class="ligne"><strong class="grow">Total</strong><strong class="num">${argent(total, 2)}</strong></div>
      </aside>
    </div>`;
}

export default {
  titre: 'Finances',
  render(ctx) {
    const e = etatVue(ctx);
    const sous = ctx.route.sous;
    return `<header class="entete">
        <div><p class="surtitre">Finances</p><h1 class="titre-1">${sous === 'depenses' ? 'Dépenses' : 'Vue d’ensemble'}</h1></div>
        <div class="actions">
          <label class="sr" for="periode">Période</label>
          <select id="periode" data-chg="periode" style="width:auto">${options(periodes(), e.periode)}</select>
          <button type="button" class="btn" data-act="nouvelle-d">+ Dépense</button>
        </div>
      </header>
      <nav class="onglets" aria-label="Sections">
        <a href="#/finances"${sous !== 'depenses' ? ' aria-current="page"' : ''}>Vue d'ensemble</a>
        <a href="#/finances/depenses"${sous === 'depenses' ? ' aria-current="page"' : ''}>Dépenses</a>
      </nav>
      ${sous === 'depenses' ? vueDepenses(ctx) : vueResume(ctx)}`;
  },
  actions: {
    'nouvelle-d': ctx => ouvrirDepense(ctx, null),
    'ouvrir-d': (ctx, el) => ouvrirDepense(ctx, el.getAttribute('data-id')),
    'ouvrir-cmd': (ctx, el) => ouvrirCommande(ctx, el.getAttribute('data-id')),
    'export-ventes': ctx => {
      const e = etatVue(ctx);
      const l = [['Date', 'Numéro', 'Client', 'Courriel', 'Segment', 'Produit', 'Avant taxes', 'TPS', 'TVQ', 'Total', 'Payée']];
      ventes(ctx.m, e.periode).forEach(x => l.push([x.c.recue, x.c.numero, x.c.client, x.c.courriel, nomSegment(x.c.segment), x.c.produit, x.ht.toFixed(2), x.tps.toFixed(2), x.tvq.toFixed(2), (x.ht + x.tps + x.tvq).toFixed(2), x.c.payee ? 'oui' : 'non']));
      telecharger('georama-ventes-' + e.periode + '.csv', csv(l), 'text/csv;charset=utf-8');
    },
    'export-depenses': ctx => {
      const e = etatVue(ctx);
      const l = [['Date', 'Fournisseur', 'Catégorie', 'Avant taxes', 'TPS', 'TVQ', 'Total', 'Note']];
      depenses(ctx.m, e.periode).forEach(x => l.push([x.d.date, x.d.fournisseur, x.d.categorie, x.ht.toFixed(2), x.tps.toFixed(2), x.tvq.toFixed(2), (x.ht + x.tps + x.tvq).toFixed(2), x.d.note || '']));
      telecharger('georama-depenses-' + e.periode + '.csv', csv(l), 'text/csv;charset=utf-8');
    },
  },
  changes: {
    periode: (ctx, el) => { etatVue(ctx).periode = el.value; ctx.rendre(); },
    payee: (ctx, el) => ctx.m.modifier('commandes', el.getAttribute('data-id'), { payee: el.checked }),
  },
  apres(ctx, racine) {
    racine.querySelectorAll('tr.cliquable').forEach(tr => tr.addEventListener('keydown', ev => { if (ev.key === 'Enter') tr.click(); }));
  },
};
