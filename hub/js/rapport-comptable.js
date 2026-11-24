// Rapport pour le comptable (v1.15.0) : une page imprimable (ou « Enregistrer en PDF ») qui réunit
// sommaire, revenus et dépenses par mois, dépenses par catégorie, achats d'équipement, taxes,
// détail des ventes et des dépenses, et les questions à poser. Plus un export CSV de tout.
import { esc, argent, dateCourte, ouvrirFenetre, aujourdhui, toast, telecharger, csv } from './ui.js';
import { reglages, ventes, depenses, ventesTaxables, nomSegment, TPS, TVQ } from './donnees.js';

const QUESTIONS_DEFAUT = [
  'Forme juridique : Georama est au nom de Charles ; une lettre parle de « Atelier Georama S.E.N.C. ». Quelle est la bonne forme et comment déclarer les revenus (T2125 pour chaque associé ?) ?',
  'Taxes : Georama n’est pas inscrite à la TPS ni à la TVQ (petit fournisseur, moins de 30 000 $ sur 4 trimestres). Confirmer le moment de l’inscription et s’il vaut mieux s’inscrire volontairement (récupérer les taxes payées sur l’imprimante et le filament).',
  'Imprimante 3D et autres équipements : amortissement (catégorie de DPA) plutôt que dépense de l’année ?',
  'Subvention de la MRC du Domaine-du-Roy (Fonds de développement économique, jusqu’à 1 670 $, 35 % de l’imprimante) : comment l’inscrire (revenu ou réduction du coût de l’imprimante) ?',
  'Cartes-cadeaux vendues (275 $, utilisées plus tard) : revenu à la vente ou à l’utilisation ?',
  'Pubs Meta et abonnements (Wix, Microsoft 365, Meshy) : les reçus téléchargés de ces sites suffisent-ils comme pièces justificatives ? Une dépense payée avec une carte personnelle est-elle correcte ?',
  'Bureau et atelier à la maison, véhicule pour les livraisons : quelles dépenses peuvent être réclamées ?',
];

function moisEntre(de, a) {
  const l = [];
  let [y, m] = de.split('-').map(Number);
  const [y2, m2] = a.split('-').map(Number);
  for (let i = 0; i < 120 && (y < y2 || (y === y2 && m <= m2)); i++) {
    l.push(y + '-' + String(m).padStart(2, '0'));
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return l;
}
const nomMois = id => { const s = new Date(Number(id.slice(0, 4)), Number(id.slice(5, 7)) - 1, 1).toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };

function premierMois(m) {
  const dates = m.liste('commandes').map(c => c.recue).concat(m.liste('depenses').map(d => d.date)).filter(Boolean).sort();
  return (dates[0] || aujourdhui()).slice(0, 7);
}

function donnees(m, de, a) {
  const mois = moisEntre(de, a);
  const v = [], d = [];
  mois.forEach(id => { ventes(m, id).forEach(x => v.push(x)); depenses(m, id).forEach(x => d.push(x)); });
  v.sort((x, y) => String(x.c.recue).localeCompare(String(y.c.recue)));
  d.sort((x, y) => String(x.d.date).localeCompare(String(y.d.date)));
  return { mois, v, d };
}

function rapportHtml(m, de, a, questions) {
  const R = reglages(m);
  const inscrite = !!R.taxes;
  const { mois, v, d } = donnees(m, de, a);
  const s = (l, f) => l.reduce((t, x) => t + f(x), 0);
  const ventesHT = s(v, x => x.ht), taxesPercues = s(v, x => x.tps + x.tvq);
  const depHT = s(d, x => x.ht), depTaxes = s(d, x => x.tps + x.tvq);
  const depCout = depHT + (inscrite ? 0 : depTaxes);
  const benefice = ventesHT - depCout;
  const aEncaisser = s(v.filter(x => !x.c.payee), x => x.ht + x.tps + x.tvq);
  const parMois = mois.map(id => {
    const vm = v.filter(x => String(x.c.recue).slice(0, 7) === id), dm = d.filter(x => String(x.d.date).slice(0, 7) === id);
    const c = s(dm, x => x.ht) + (inscrite ? 0 : s(dm, x => x.tps + x.tvq));
    return { id, ventes: s(vm, x => x.ht), nb: vm.length, depenses: c, benefice: s(vm, x => x.ht) - c };
  }).filter(x => x.nb || x.depenses);
  const parCat = {};
  d.forEach(x => { const k = x.d.categorie || 'Autre'; parCat[k] = parCat[k] || { ht: 0, tx: 0, n: 0 }; parCat[k].ht += x.ht; parCat[k].tx += x.tps + x.tvq; parCat[k].n += 1; });
  const equip = d.filter(x => x.d.categorie === 'Équipement');
  const vt = ventesTaxables(m);
  const sansFacture = d.filter(x => !x.d.auto && !x.d.facture).length;
  const auto = d.filter(x => x.d.auto).length;
  const periode = de === a ? nomMois(de) : nomMois(de) + ' à ' + nomMois(a);
  const qs = String(questions || '').split('\n').map(t => t.trim()).filter(Boolean);
  const ligneV = x => `<tr><td>${esc(dateCourte(x.c.recue))}</td><td>${esc(x.c.numero || '')}</td><td>${esc(x.c.client || '')}</td><td>${esc(x.c.wixPaiement ? 'Wix · ' + (x.c.wixPaiement.methode || x.c.produit || '') : (x.c.produit || nomSegment(x.c.segment) || ''))}</td><td class="d">${argent(x.ht, 2)}</td>${inscrite ? `<td class="d">${argent(x.tps, 2)}</td><td class="d">${argent(x.tvq, 2)}</td>` : ''}<td>${x.c.payee ? 'Oui' : '<strong>Non</strong>'}</td></tr>`;
  const ligneD = x => `<tr><td>${esc(dateCourte(x.d.date))}</td><td>${esc(x.d.fournisseur || '')}${x.d.note ? `<br><span class="note">${esc(x.d.note)}</span>` : ''}</td><td>${esc(x.d.categorie || '')}</td><td class="d">${argent(x.ht, 2)}</td><td class="d">${argent(x.tps, 2)}</td><td class="d">${argent(x.tvq, 2)}</td><td class="d">${argent(x.ht + x.tps + x.tvq, 2)}</td><td>${x.d.auto ? 'Estimée' : x.d.facture ? 'Oui' : '<strong>À trouver</strong>'}</td></tr>`;
  return `<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"><title>Georama · Rapport pour le comptable · ${esc(periode)}</title>
<style>
  @page { size: letter; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.4 "Segoe UI", Arial, sans-serif; color: #1d2320; margin: 0; padding: 24px; background: #fff; }
  h1 { font-size: 20pt; margin: 0 0 2px; } h2 { font-size: 13pt; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #3d5a40; color: #2b3f2d; break-after: avoid; }
  .sous { color: #5b655f; margin: 0 0 14px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }
  .kpi { border: 1px solid #cfd6d1; border-radius: 6px; padding: 8px 10px; } .kpi b { display: block; font-size: 14pt; } .kpi span { color: #5b655f; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 6px; font-size: 9.5pt; }
  th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #e1e6e2; vertical-align: top; }
  th { background: #eef2ef; font-weight: 600; } td.d, th.d { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 700; border-top: 2px solid #3d5a40; }
  tr { break-inside: avoid; } .note { color: #5b655f; font-size: 8.5pt; }
  .encadre { border: 1px solid #cfd6d1; border-left: 4px solid #3d5a40; border-radius: 4px; padding: 8px 12px; margin: 8px 0; }
  ol { margin: 6px 0 0 18px; padding: 0; } li { margin: 0 0 6px; }
  .pied { margin-top: 24px; color: #5b655f; font-size: 8.5pt; }
  .barre-imp { position: sticky; top: 0; background: #fff; padding: 8px 0 12px; display: flex; gap: 8px; }
  .barre-imp button { font: inherit; padding: 8px 14px; border-radius: 6px; border: 1px solid #3d5a40; background: #3d5a40; color: #fff; cursor: pointer; }
  .barre-imp button.b2 { background: #fff; color: #3d5a40; }
  @media print { .barre-imp { display: none; } body { padding: 0; } h2 { break-after: avoid; } .saut { break-before: page; } }
</style></head><body>
<div class="barre-imp"><button onclick="window.print()">Imprimer ou enregistrer en PDF</button><button class="b2" onclick="window.close()">Fermer</button></div>
<h1>Georama · Rapport pour le comptable</h1>
<p class="sous">Période : <strong>${esc(periode)}</strong> · préparé le ${esc(dateCourte(aujourdhui()))} à partir du hub Georama · Charles Desbiens et Maryse Perron Chartier · Saint-Félicien</p>

<h2>Sommaire</h2>
<div class="kpis">
  <div class="kpi"><span>Revenus (ventes)</span><b>${argent(ventesHT, 2)}</b><span>${v.length} vente${v.length > 1 ? 's' : ''}</span></div>
  <div class="kpi"><span>Dépenses ${inscrite ? 'avant taxes' : 'taxes incluses'}</span><b>${argent(depCout, 2)}</b><span>${d.length} dépense${d.length > 1 ? 's' : ''}</span></div>
  <div class="kpi"><span>Bénéfice avant impôts</span><b>${argent(benefice, 2)}</b><span>Revenus moins dépenses</span></div>
  <div class="kpi"><span>À encaisser</span><b>${argent(aEncaisser, 2)}</b><span>Ventes pas encore payées</span></div>
</div>
<div class="encadre"><strong>Taxes :</strong> ${inscrite
    ? `Georama est inscrite. TPS et TVQ perçues : ${argent(taxesPercues, 2)} ; payées sur les dépenses : ${argent(depTaxes, 2)} (TPS ${(TPS * 100).toLocaleString('fr-CA')} %, TVQ ${(TVQ * 100).toLocaleString('fr-CA')} %).`
    : `Georama n’est pas inscrite à la TPS ni à la TVQ : aucune taxe perçue sur les ventes. Les taxes payées sur les dépenses (${argent(depTaxes, 2)}) ne sont pas récupérées : elles sont comptées dans les dépenses. Ventes des 4 derniers trimestres civils : ${argent(vt.quatreTrimestres, 2)} sur le seuil de ${argent(vt.seuil)} (petit fournisseur).`}</div>

<h2>Par mois</h2>
<table><thead><tr><th>Mois</th><th class="d">Ventes</th><th class="d">Nombre</th><th class="d">Dépenses</th><th class="d">Bénéfice</th></tr></thead>
<tbody>${parMois.map(x => `<tr><td>${esc(nomMois(x.id))}</td><td class="d">${argent(x.ventes, 2)}</td><td class="d">${x.nb}</td><td class="d">${argent(x.depenses, 2)}</td><td class="d">${argent(x.benefice, 2)}</td></tr>`).join('') || '<tr><td colspan="5">Aucune donnée pour cette période.</td></tr>'}</tbody>
<tfoot><tr><td>Total</td><td class="d">${argent(ventesHT, 2)}</td><td class="d">${v.length}</td><td class="d">${argent(depCout, 2)}</td><td class="d">${argent(benefice, 2)}</td></tr></tfoot></table>

<h2>Dépenses par catégorie</h2>
<table><thead><tr><th>Catégorie</th><th class="d">Nombre</th><th class="d">Avant taxes</th><th class="d">Taxes payées</th><th class="d">Total</th></tr></thead>
<tbody>${Object.entries(parCat).sort((x, y) => (y[1].ht + y[1].tx) - (x[1].ht + x[1].tx)).map(([k, x]) => `<tr><td>${esc(k)}</td><td class="d">${x.n}</td><td class="d">${argent(x.ht, 2)}</td><td class="d">${argent(x.tx, 2)}</td><td class="d">${argent(x.ht + x.tx, 2)}</td></tr>`).join('') || '<tr><td colspan="5">Aucune dépense.</td></tr>'}</tbody>
<tfoot><tr><td>Total</td><td class="d">${d.length}</td><td class="d">${argent(depHT, 2)}</td><td class="d">${argent(depTaxes, 2)}</td><td class="d">${argent(depHT + depTaxes, 2)}</td></tr></tfoot></table>
${equip.length ? `<p><strong>Achats d’équipement (à amortir ?)</strong> : ${equip.map(x => esc(x.d.fournisseur) + ' (' + esc(dateCourte(x.d.date)) + ', ' + argent(x.ht + x.tps + x.tvq, 2) + ')').join(' ; ')}.</p>` : ''}
<p class="note">${auto ? auto + ' dépense' + (auto > 1 ? 's' : '') + ' « Estimée » : pubs Meta (montant lu dans Meta, taxes estimées) ou abonnement entré une fois ; le reçu officiel reste à joindre. ' : ''}${sansFacture ? sansFacture + ' dépense' + (sansFacture > 1 ? 's' : '') + ' sans facture jointe dans le hub (« À trouver »).' : 'Toutes les dépenses entrées à la main ont leur facture dans OneDrive › Hub-Georama › factures.'}</p>

${qs.length ? `<h2>Questions pour le comptable</h2><ol>${qs.map(q => `<li>${esc(q)}</li>`).join('')}</ol>` : ''}

<h2 class="saut">Détail des ventes</h2>
<table><thead><tr><th>Date</th><th>Numéro</th><th>Client</th><th>Paiement / produit</th><th class="d">${inscrite ? 'Avant taxes' : 'Montant'}</th>${inscrite ? '<th class="d">TPS</th><th class="d">TVQ</th>' : ''}<th>Payée</th></tr></thead>
<tbody>${v.map(ligneV).join('') || `<tr><td colspan="${inscrite ? 8 : 6}">Aucune vente.</td></tr>`}</tbody>
<tfoot><tr><td colspan="4">Total</td><td class="d">${argent(ventesHT, 2)}</td>${inscrite ? `<td class="d">${argent(s(v, x => x.tps), 2)}</td><td class="d">${argent(s(v, x => x.tvq), 2)}</td>` : ''}<td></td></tr></tfoot></table>
<p class="note">Ventes = paiements reçus par Wix (boutique, factures, paiement en personne) plus les commandes du hub payées autrement (virement Interac, comptant). Une commande payée par Wix n’est comptée qu’une fois.</p>

<h2>Détail des dépenses</h2>
<table><thead><tr><th>Date</th><th>Fournisseur</th><th>Catégorie</th><th class="d">Avant taxes</th><th class="d">TPS</th><th class="d">TVQ</th><th class="d">Total</th><th>Facture</th></tr></thead>
<tbody>${d.map(ligneD).join('') || '<tr><td colspan="8">Aucune dépense.</td></tr>'}</tbody>
<tfoot><tr><td colspan="3">Total</td><td class="d">${argent(depHT, 2)}</td><td class="d">${argent(s(d, x => x.tps), 2)}</td><td class="d">${argent(s(d, x => x.tvq), 2)}</td><td class="d">${argent(depHT + depTaxes, 2)}</td><td></td></tr></tfoot></table>

<p class="pied">Document de travail tiré du hub Georama (outil.georama.ca/hub), pour préparer la rencontre. Les fichiers CSV des ventes et des dépenses de la même période peuvent être remis au besoin.</p>
</body></html>`;
}

export function ouvrirRapportComptable(ctx) {
  const m = ctx.m;
  const R = reglages(m);
  const ajd = aujourdhui();
  const debut = premierMois(m), fin = ajd.slice(0, 7), annee = ajd.slice(0, 4);
  const choix = moisEntre(debut < (Number(annee) - 1) + '-01' ? debut : (Number(annee) - 1) + '-01', fin).reverse();
  const opt = sel => choix.map(id => `<option value="${id}"${id === sel ? ' selected' : ''}>${esc(nomMois(id))}</option>`).join('');
  const questions = R.questionsComptable || QUESTIONS_DEFAUT.join('\n');
  const { form } = ouvrirFenetre({
    titre: 'Rapport pour le comptable',
    corps: `<p class="petit doux" style="margin:0 0 12px">Une page à imprimer ou à enregistrer en PDF : sommaire, revenus et dépenses par mois, dépenses par catégorie, taxes, détail des ventes et des dépenses, et tes questions.</p>
      <div class="actions" style="flex-wrap:wrap;margin:0 0 10px">
        <button type="button" class="btn-2" data-prereg="${debut}|${fin}">Depuis le début</button>
        <button type="button" class="btn-2" data-prereg="${annee}-01|${fin}">Année ${annee}</button>
        <button type="button" class="btn-2" data-prereg="${fin}|${fin}">Mois en cours</button>
      </div>
      <div class="champs">
        <div class="champ"><label for="rc-de">Du mois</label><select id="rc-de" name="de">${opt(debut)}</select></div>
        <div class="champ"><label for="rc-a">Au mois (inclus)</label><select id="rc-a" name="a">${opt(fin)}</select></div>
        <div class="champ plein"><label for="rc-q">Questions pour le comptable (une par ligne, gardées pour la prochaine fois)</label>
          <textarea id="rc-q" name="questions" rows="9">${esc(questions)}</textarea></div>
      </div>`,
    pied: `<div class="actions"><button type="button" class="btn-2" data-modal-act="csv">Exporter tout en CSV</button><button type="button" class="btn-lien" data-modal-act="defaut">Remettre les questions suggérées</button></div>`,
    onAction(act) {
      if (act === 'defaut') { form.querySelector('#rc-q').value = QUESTIONS_DEFAUT.join('\n'); return null; }
      if (act === 'csv') {
        let de = form.querySelector('#rc-de').value, a = form.querySelector('#rc-a').value;
        if (de > a) [de, a] = [a, de];
        const { v, d } = donnees(m, de, a);
        const l = [['Type', 'Date', 'Numéro ou fournisseur', 'Client ou catégorie', 'Détail', 'Avant taxes', 'TPS', 'TVQ', 'Total', 'Payée ou facture']];
        v.forEach(x => l.push(['Vente', x.c.recue, x.c.numero, x.c.client, x.c.wixPaiement ? 'Wix ' + (x.c.wixPaiement.methode || '') : (x.c.produit || ''), x.ht.toFixed(2), x.tps.toFixed(2), x.tvq.toFixed(2), (x.ht + x.tps + x.tvq).toFixed(2), x.c.payee ? 'payée' : 'à encaisser']));
        d.forEach(x => l.push(['Dépense', x.d.date, x.d.fournisseur, x.d.categorie, x.d.note || '', x.ht.toFixed(2), x.tps.toFixed(2), x.tvq.toFixed(2), (x.ht + x.tps + x.tvq).toFixed(2), x.d.auto ? 'estimée' : x.d.facture ? 'facture jointe' : 'facture à trouver']));
        telecharger('georama-comptable-' + de + (de === a ? '' : '_' + a) + '.csv', csv(l), 'text/csv;charset=utf-8');
        return null;
      }
      return null;
    },
    onSubmit(val) {
      let de = val.de, a = val.a;
      if (de > a) [de, a] = [a, de];
      const q = String(val.questions || '').trim();
      if (q !== (R.questionsComptable || QUESTIONS_DEFAUT.join('\n'))) m.mettre('reglages', Object.assign({}, reglages(m), { id: 'general', questionsComptable: q }));
      const w = window.open('', '_blank');
      if (!w) { toast('Le navigateur a bloqué la nouvelle fenêtre. Autorise les fenêtres pour outil.georama.ca, puis réessaie.', true); return false; }
      w.document.open(); w.document.write(rapportHtml(m, de, a, q)); w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* rien */ } }, 600);
      return true;
    },
  });
  const ok = form.querySelector('button[type=submit]');
  if (ok) ok.textContent = 'Ouvrir le rapport';
  form.querySelectorAll('[data-prereg]').forEach(b => b.addEventListener('click', () => {
    const [de, a] = b.getAttribute('data-prereg').split('|');
    const s1 = form.querySelector('#rc-de'), s2 = form.querySelector('#rc-a');
    if ([...s1.options].some(o => o.value === de)) s1.value = de;
    if ([...s2.options].some(o => o.value === a)) s2.value = a;
  }));
}

export const _test = { rapportHtml, moisEntre, QUESTIONS_DEFAUT };
