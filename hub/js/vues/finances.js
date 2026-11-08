// Module Finances : ventes, dépenses, taxes, objectif.
import { esc, argent, pct, dateCourte, options, ouvrirFenetre, aujourdhui, uid, toast, telecharger, csv, ilYa } from '../ui.js';
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
  const fact = d.facture;
  const corps = `<div class="champ plein" style="margin-bottom:14px">
      <label for="d-photo">Photo ou PDF de la facture</label>
      <div class="facture-boite">
        <div id="d-apercu" class="facture-apercu">${fact ? '<span class="petit doux">Chargement…</span>' : '<span class="petit doux">Aucune facture jointe</span>'}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <label class="btn-2" for="d-photo" style="cursor:pointer;text-align:center">${fact ? 'Remplacer' : 'Prendre une photo ou choisir'}</label>
          <input id="d-photo" type="file" accept="image/*,application/pdf" class="sr">
          ${fact && fact.webUrl ? `<a class="btn-lien petit" href="${esc(fact.webUrl)}" target="_blank" rel="noopener">Ouvrir dans OneDrive</a>` : ''}
        </div>
      </div>
      <span class="aide">Sur le cellulaire, le bouton ouvre l’appareil photo. La facture est gardée dans OneDrive › Hub-Georama › factures.</span>
    </div>
    <div class="champs">
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
      const idD = id || uid('d');
      m.mettre('depenses', Object.assign({}, d, { id: idD, date: v.date, fournisseur: v.fournisseur, categorie: v.categorie, montant, tps: t.tps, tvq: t.tvq, taxesAuto: !!v.taxesAuto, note: v.note }), true);
      if (!id) journaliser(m, 'Dépense ajoutée : ' + v.fournisseur + ' (' + argent(montant, 2) + ')', '#/finances/depenses', 'depense');
      m.avertir('local');
      if (fichierChoisi) {
        toast('Dépense enregistrée. Envoi de la facture…');
        envoyerFacture(m, idD, v, fichierChoisi)
          .then(() => toast('Facture gardée dans OneDrive.'))
          .catch(err => toast('La facture n’a pas pu être envoyée : ' + err.message + ' La dépense, elle, est enregistrée.', true));
      } else toast('Dépense enregistrée.');
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
  let fichierChoisi = null;
  const apercu = form.querySelector('#d-apercu');
  const montrer = (url, pdf) => { apercu.innerHTML = pdf ? '<span class="petit">PDF prêt à envoyer</span>' : `<img src="${esc(url)}" alt="Facture">`; };
  form.querySelector('#d-photo').addEventListener('change', ev => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    if (f.type === 'application/pdf' && f.size > 4 * 1048576) { toast('Ce PDF dépasse 4 Mo. Prends plutôt une photo.', true); return; }
    fichierChoisi = f;
    if (f.type === 'application/pdf') montrer('', true); else montrer(URL.createObjectURL(f));
  });
  if (fact && fact.chemin && m.a.lienFichier) {
    m.a.lienFichier(fact.chemin).then(url => {
      if (!url) { apercu.innerHTML = '<span class="petit doux">Facture introuvable</span>'; return; }
      if (/\.pdf$/i.test(fact.chemin)) apercu.innerHTML = `<a href="${esc(url)}" target="_blank" rel="noopener">Ouvrir le PDF</a>`;
      else apercu.innerHTML = `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="Facture"></a>`;
    }).catch(() => { apercu.innerHTML = '<span class="petit doux">Facture introuvable</span>'; });
  }
}

// Photo réduite (1800 px, JPEG) pour rester légère ; un PDF part tel quel.
async function preparerFichier(f) {
  if (f.type === 'application/pdf' || !/^image\//.test(f.type)) return { blob: f, ext: f.type === 'application/pdf' ? 'pdf' : (f.name.split('.').pop() || 'bin') };
  const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(f); });
  const k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.82));
  return { blob: blob || f, ext: blob ? 'jpg' : (f.name.split('.').pop() || 'jpg') };
}
async function envoyerFacture(m, idD, v, f) {
  if (!m.a.televerser) throw new Error('stockage sans fichiers');
  const { blob, ext } = await preparerFichier(f);
  if (blob.size > 4 * 1048576) throw new Error('fichier de plus de 4 Mo.');
  const propre = String(v.fournisseur || 'facture').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'facture';
  const chemin = `factures/${String(v.date || '').slice(0, 7) || 'sans-date'}/${v.date || 'sans-date'}_${propre}_${idD}.${ext}`;
  const r = await m.a.televerser(chemin, blob);
  const actuelle = m.get('depenses', idD);
  if (actuelle) m.modifier('depenses', idD, { facture: { chemin: r.chemin, webUrl: r.webUrl, type: blob.type || '', ajoutee: new Date().toISOString() } });
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
  const nbWix = v.filter(x => x.c.wixPaiement).length;
  const sw = ((m.externes.statsWix || [])[0]) || null;
  const errWix = sw && sw.erreurs && sw.erreurs.paiements;
  const lu = sw && sw.lu;
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
  const bandeauWix = errWix ? `<div class="bandeau"><span><strong>Paiements Wix pas lus :</strong> ${esc(errWix)}</span></div>`
    : !sw || !sw.paiements ? `<div class="bandeau info"><span>Les paiements reçus par Wix (factures et boutique) apparaîtront ici dès que l’ordi de la maison les aura lus (chaque heure).</span></div>`
    : `<p class="tres-petit doux" style="margin:0">Ventes = paiements reçus par Wix (factures, boutique, en personne)${lu ? ', lus ' + esc(ilYa(lu)) : ''}, plus les commandes du hub payées autrement.</p>`;
  return `
    ${bandeauWix}
    <section class="g4" aria-label="Indicateurs">
      <div class="carte kpi"><p class="surtitre">Ventes · avant taxes</p><p class="valeur">${argent(r.ventesHT, 2)}</p><p class="detail">${nbWix ? `${nbWix} paiement${nbWix > 1 ? 's' : ''} Wix${r.nbVentes - nbWix ? ' + ' + (r.nbVentes - nbWix) + ' autre' + (r.nbVentes - nbWix > 1 ? 's' : '') : ''}` : `${r.nbVentes} commande${r.nbVentes > 1 ? 's' : ''}`} · ${esc(nomPeriode(e.periode))}</p></div>
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
      <table class="liste"><thead><tr><th>Date</th><th>Commande</th><th>Client</th><th>Segment / paiement</th><th class="droite">Avant taxes</th><th class="droite">TPS</th><th class="droite">TVQ</th><th class="droite">Total</th><th>Payée</th></tr></thead>
      <tbody>${v.map(x => `<tr>
        <td class="petit num">${esc(dateCourte(x.c.recue))}</td>
        <td>${x.c.wixPaiement ? `<span class="etiquette bleu" title="Paiement reçu par Wix">Wix</span> ${x.c.wixPaiement.lienWix ? `<a href="${esc(x.c.wixPaiement.lienWix)}" target="_blank" rel="noopener">${esc(x.c.numero)}</a>` : esc(x.c.numero)}` : `<button type="button" class="btn-lien" data-act="ouvrir-cmd" data-id="${esc(x.c.id)}">${esc(x.c.numero)}</button>`}</td>
        <td>${esc(x.c.client)}</td><td class="petit">${x.c.wixPaiement ? esc(x.c.wixPaiement.methode || '') : esc(nomSegment(x.c.segment))}</td>
        <td class="droite num">${argent(x.ht, 2)}</td><td class="droite num">${argent(x.tps, 2)}</td><td class="droite num">${argent(x.tvq, 2)}</td><td class="droite num"><strong>${argent(x.ht + x.tps + x.tvq, 2)}</strong></td>
        <td>${x.c.wixPaiement ? '<span class="petit doux">Reçu</span>' : `<label class="case" style="min-height:32px"><input type="checkbox" data-chg="payee" data-id="${esc(x.c.id)}"${x.c.payee ? ' checked' : ''}><span class="sr">Payée</span></label>`}</td>
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
          <td class="petit num">${esc(dateCourte(x.d.date))}</td><td>${esc(x.d.fournisseur)}${x.d.facture ? ' <span class="etiquette plein" title="Facture jointe">Facture</span>' : ''}${x.d.note ? `<br><span class="petit doux">${esc(x.d.note)}</span>` : ''}</td>
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
