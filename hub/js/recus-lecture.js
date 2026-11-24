// Lecture d'un reçu ou d'une facture (texte tiré du PDF) : fournisseur, date, numéro, montants (v1.16.0).
// Module pur (sans navigateur) pour pouvoir le tester avec node sur de vrais reçus.

const MOIS = { jan: 1, janv: 1, janvier: 1, january: 1, feb: 2, fev: 2, fevr: 2, fevrier: 2, february: 2, mar: 3, mars: 3, march: 3,
  apr: 4, avr: 4, avril: 4, april: 4, mai: 5, may: 5, jun: 6, juin: 6, june: 6, jul: 7, juil: 7, juillet: 7, july: 7,
  aug: 8, aou: 8, aout: 8, august: 8, sep: 9, sept: 9, septembre: 9, september: 9, oct: 10, octobre: 10, october: 10,
  nov: 11, novembre: 11, november: 11, dec: 12, decembre: 12, december: 12 };
const sansAccents = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const p2 = n => String(n).padStart(2, '0');
const valide = (a, m, j) => a >= 2000 && a <= 2100 && m >= 1 && m <= 12 && j >= 1 && j <= 31 ? a + '-' + p2(m) + '-' + p2(j) : '';

// Toutes les dates d'une ligne, dans l'ordre.
export function dates(ligne) {
  const s = sansAccents(ligne).toLowerCase();
  const l = [];
  const re = /(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})\/(\d{1,2})\/(\d{4})|(\d{1,2})(?:er)?\s+([a-z]{3,9})\.?\s+(\d{4})|([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/g;
  let x;
  while ((x = re.exec(s))) {
    let d = '';
    if (x[1]) d = valide(+x[1], +x[2], +x[3]);
    else if (x[4]) {
      // jj/mm/aaaa (Canada, Microsoft) ; si le premier nombre dépasse 12, c'est forcément le jour
      const a = +x[4], b = +x[5];
      d = b > 12 ? valide(+x[6], a, b) : valide(+x[6], b, a);
    } else if (x[7] && MOIS[x[8]]) d = valide(+x[9], MOIS[x[8]], +x[7]);
    else if (x[10] && MOIS[x[10]]) d = valide(+x[12], MOIS[x[10]], +x[11]);
    if (d) l.push(d);
  }
  return l;
}

// Montants d'argent d'une ligne (avec deux décimales ; les pourcentages sont exclus).
export function montants(ligne) {
  const l = [];
  const re = /\d{1,3}(?:[   ,.]\d{3})*[.,]\d{2}(?!\d)|\d+[.,]\d{2}(?!\d)/g;
  let x;
  while ((x = re.exec(ligne))) {
    const apres = ligne.slice(x.index + x[0].length).trimStart();
    if (apres.startsWith('%')) continue;
    const avant = ligne.slice(Math.max(0, x.index - 1), x.index);
    if (/[\d.,]/.test(avant)) continue;
    let t = x[0].replace(/[   ]/g, '');
    const dec = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
    t = t.slice(0, dec).replace(/[.,]/g, '') + '.' + t.slice(dec + 1);
    const n = Number(t);
    if (Number.isFinite(n)) l.push(n);
  }
  return l;
}
const seulMontant = ligne => /^\s*(?:CA\$|\$CA|CAD|US\$|\$)?\s*[\d  .,]+\s*(?:\$|CA\$|\$CA|CAD)?\s*$/.test(ligne) && montants(ligne).length === 1;

// Cherche la première ligne qui correspond à l'étiquette et rend le montant (sur la ligne, après l'étiquette, sinon la ligne suivante si elle n'a qu'un montant).
function chercher(lignes, re, { dernier = false, exclure = null } = {}) {
  for (let i = 0; i < lignes.length; i++) {
    const L = lignes[i];
    const m = re.exec(L);
    if (!m || (exclure && exclure.test(L))) continue;
    const reste = L.slice(m.index + m[0].length);
    const v = montants(reste);
    if (v.length) return dernier ? v[v.length - 1] : v[0];
    if (i + 1 < lignes.length && seulMontant(lignes[i + 1])) return montants(lignes[i + 1])[0];
  }
  return null;
}

// Premier montant après l'étiquette, pour chaque ligne qui la contient.
function tous(lignes, re, exclure) {
  const l = [];
  lignes.forEach(L => { const m = re.exec(L); if (!m || exclure.test(L)) return; const v = montants(L.slice(m.index + m[0].length)); if (v.length) l.push(v[0]); });
  return l;
}

const FOURNISSEURS = [
  { re: /wix\.com/i, nom: 'Wix', cat: 'Logiciels et abonnements' },
  { re: /meta platforms|meta publicit|facebook ads/i, nom: 'Meta (pubs Facebook et Instagram)', cat: 'Publicité' },
  { re: /microsoft/i, nom: 'Microsoft 365', cat: 'Logiciels et abonnements' },
  { re: /bambu\s?lab/i, nom: 'Bambu Lab', cat: 'Filament' },
  { re: /anthropic/i, nom: 'Anthropic (Claude)', cat: 'Logiciels et abonnements' },
  { re: /meshy/i, nom: 'Meshy', cat: 'Logiciels et abonnements' },
  { re: /canva/i, nom: 'Canva', cat: 'Logiciels et abonnements' },
  { re: /google/i, nom: 'Google', cat: 'Logiciels et abonnements' },
  { re: /postes canada|canada post/i, nom: 'Postes Canada', cat: 'Expédition' },
  { re: /uline/i, nom: 'Uline', cat: 'Cadres et emballage' },
  { re: /amazon/i, nom: 'Amazon', cat: 'Autre' },
];

export function lireRecu(texte, nomFichier = '') {
  const lignes = String(texte || '').split(/\r?\n/).map(s => s.replace(/[\u0000-\u001f\u2013\u2014]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const tout = lignes.join('\n');
  const r = { fournisseur: '', categorie: 'Autre', date: '', numero: '', total: null, sousTotal: null, montant: 0, tps: 0, tvq: 0, periodeFin: '', description: '', lu: false };
  if (!lignes.length) return r;

  // Fournisseur et catégorie
  const f = FOURNISSEURS.find(x => x.re.test(tout));
  if (f) { r.fournisseur = f.nom; r.categorie = f.cat; }
  else r.fournisseur = (lignes.find(l => /[a-z]/i.test(l) && l.length <= 40 && !/facture|invoice|re[çc]u|receipt|page/i.test(l)) || nomFichier.replace(/\.[^.]+$/, '')).slice(0, 40);

  // Total payé
  r.total = chercher(lignes, /net payment|grand total|total \(including tax\)|total \(taxes? incluses?\)|total ttc|amount due|amount paid|montant pay[ée]|montant d[ûu]/i);
  if (r.total == null) {
    const i = lignes.findIndex(l => /^(pay[ée]|paid)$/i.test(l));
    if (i >= 0 && lignes[i + 1] && montants(lignes[i + 1]).length) r.total = montants(lignes[i + 1])[0];
  }
  if (r.total == null) r.total = chercher(lignes, /\btotal\b/i, { exclure: /sous-total|subtotal|excl|hors tax|avant tax|items subtotal|total tax/i });

  // Sous-total (avant taxes)
  for (const re of [/total exclud(?:e|ing) tax|total hors taxes|montant hors taxes|total avant taxes/i, /sous-total|subtotal/i]) {
    r.sousTotal = chercher(lignes, re);
    if (r.sousTotal != null) break;
  }
  if (r.sousTotal != null && r.total != null && (r.sousTotal > r.total + 0.005 || r.sousTotal < r.total / 1.2)) r.sousTotal = null;

  // Date : d'abord une ligne avec une étiquette de date, sinon la première date du document
  const etiq = /date de la facture|date de facturation|date of issue|document date|invoice date|billing date|payment date|date d'[ée]mission|date du paiement|date :/i;
  for (let i = 0; i < lignes.length && !r.date; i++) {
    if (!etiq.test(lignes[i])) continue;
    r.date = dates(lignes[i])[0] || (lignes[i + 1] && dates(lignes[i + 1])[0]) || '';
  }
  if (!r.date) for (const l of lignes) { if (/p[ée]riode|du .* au |billing period|activity on/i.test(l)) continue; const d = dates(l)[0]; if (d) { r.date = d; break; } }
  if (!r.date) for (const l of lignes) { const d = dates(l)[0]; if (d) { r.date = d; break; } }

  // Fin de la période couverte (reçus Meta : « Du 21 oct 2026, 00 h 00 au 13 nov 2026, 23 h 59 »)
  lignes.forEach(l => { const m = /\bau\s+(.+)$/i.exec(l); if (/^du\s/i.test(l) && m) { const d = dates(m[1])[0]; if (d && d > r.periodeFin) r.periodeFin = d; } });

  // Numéro de facture
  const n = /(?:billing number|invoice number|order number|num[ée]ro de r[ée]f[ée]rence|facture\s*(?:no|n°|#|:)?|invoice\s*#)\s*[:#]?\s*#?\s*([A-Z0-9][A-Z0-9-]{4,}(?:[ \u00a0\u2009-]+\d{3,6}\b)?)/i.exec(tout);
  if (n) r.numero = n[1].replace(/[ \u00a0\u2009]+/g, '-');

  // Description courte (pour la note)
  const desc = lignes.find(l => /forfait|domaine|messagerie|frais de traitement|claude pro|business standard|meta publicit|filament|petg|pla\b|h2c|h3c|ams/i.test(l));
  if (desc) r.description = desc.slice(0, 80);

  // Bambu Lab : imprimante ou AMS = Équipement, sinon Filament
  if (r.fournisseur === 'Bambu Lab' && /\b(h2c|h2d|h3c|x1c|p1s|p2s|a1)\b|automatic material system|\bams\b/i.test(tout) && (r.total || 0) > 150) r.categorie = 'Équipement';
  if (r.fournisseur === 'Wix' && /frais de traitement|wix payments/i.test(tout)) { r.categorie = 'Autre'; r.description = 'Wix Payments : frais de traitement'; }

  // Montants : avant taxes + TPS + TVQ = total
  if (r.total != null) {
    const ht = r.sousTotal != null ? r.sousTotal : r.total;
    const taxes = Math.round((r.total - ht) * 100) / 100;
    r.montant = Math.round(ht * 100) / 100;
    if (taxes > 0.004) {
      const taux = ht ? taxes / ht : 0;
      if (Math.abs(taux - 0.05) < 0.004) { r.tps = taxes; r.tvq = 0; }
      else if (Math.abs(taux - 0.09975) < 0.004) { r.tps = 0; r.tvq = taxes; }
      else { r.tps = Math.round(Math.min(taxes, ht * 0.05) * 100) / 100; r.tvq = Math.round((taxes - r.tps) * 100) / 100; }
      // Montants de TPS et TVQ écrits sur le reçu, s'ils concordent avec le total (au cent près)
      const lesTps = tous(lignes, /\b(?:gst|tps)\b/i, /num[ée]ro|registration|RT\d{4}/i);
      const lesTvq = tous(lignes, /\b(?:qst|tvq)\b/i, /num[ée]ro|registration|TQ\d{4}|NR\d/i);
      trouve: for (const a of lesTps) for (const b of lesTvq) if (Math.abs(ht + a + b - r.total) < 0.015) { r.tps = a; r.tvq = b; break trouve; }
    }
    r.lu = true;
  }
  return r;
}

// Clé stable d'un reçu (deux copies du même reçu donnent la même clé).
export function cleRecu(r, nomFichier) {
  const base = r.numero ? (r.fournisseur + '|' + r.numero) : (r.fournisseur + '|' + r.date + '|' + (r.total || 0) + '|' + (r.numero ? '' : String(nomFichier || '').replace(/\s*\(\d+\)(?=\.[^.]+$)/, '')));
  let h = 0;
  for (const c of sansAccents(base).toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 'recu-' + h.toString(36);
}
