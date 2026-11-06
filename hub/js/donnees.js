// Règles d'affaires de Georama : segments, produits, gammes, statuts, étapes, calculs.
import { aujourdhui, ajouterJours, joursEntre, versDate, isoJour, uid } from './ui.js';

export const SEGMENTS = [
  { id: 'terre', nom: 'Terre à bois' },
  { id: 'chasse', nom: 'Chasse' },
  { id: 'peche', nom: 'Pêche' },
  { id: 'sommet', nom: 'Sommet' },
  { id: 'ville', nom: 'Ville' },
  { id: 'entreprise', nom: 'Entreprise' },
  { id: 'agricole', nom: 'Agricole' },
];
export const nomSegment = id => (SEGMENTS.find(s => s.id === id) || { nom: id || '—' }).nom;

export const PRODUITS = [
  { id: 'essentiel', nom: 'Essentiel · 10 × 12 po', prix: 175, plaques: 1 },
  { id: 'signature', nom: 'Signature · 10 × 12 po', prix: 250, plaques: 1 },
  { id: 'gf4', nom: 'Grand format · 20 × 24 po', prix: 995, plaques: 4 },
  { id: 'gf6', nom: 'Grand format · 24 × 30 po', prix: 1450, plaques: 6 },
  { id: 'mesure', nom: 'Sur mesure (soumission)', prix: 0, plaques: 1 },
];
export const produit = id => PRODUITS.find(p => p.id === id) || PRODUITS[0];

export const COULEURS = {
  noir: { nom: 'Noir', hex: '#000000' },
  noirdoux: { nom: 'Noir doux', hex: '#2B2B2B' },
  blanc: { nom: 'Blanc', hex: '#FFFFFF' },
  creme: { nom: 'Crème', hex: '#F1DFCF' },
  beige: { nom: 'Beige', hex: '#DBC8B6' },
  gris: { nom: 'Gris', hex: '#7F7E83' },
  brun: { nom: 'Brun', hex: '#4F2C1D' },
  vert: { nom: 'Vert', hex: '#009639' },
  vertpin: { nom: 'Vert pin', hex: '#034638' },
  bleupale: { nom: 'Bleu pâle', hex: '#8CC8EC' },
  bleu: { nom: 'Bleu', hex: '#0086D6' },
  bleugris: { nom: 'Bleu-gris', hex: '#688197' },
  bleufonce: { nom: 'Bleu foncé', hex: '#001489' },
  orange: { nom: 'Orange', hex: '#FF671F' },
  rouge: { nom: 'Rouge', hex: '#D6001C' },
};
// Gammes : socle, terrain, forêt, eau, lot et tracés
export const GAMMES = {
  'Boréal': ['noir', 'beige', 'vert', 'bleupale', 'orange'],
  'Sapinière': ['brun', 'beige', 'vertpin', 'bleu', 'orange'],
  'Arctique': ['gris', 'blanc', 'bleu', 'bleufonce'],
  'Terre': ['brun', 'beige', 'bleugris', 'orange'],
  'Monochrome': ['blanc'],
};
export const NOMS_GAMMES = Object.keys(GAMMES);

export const STATUTS = [
  { id: 'nouvelle', nom: 'Nouvelle', classe: 'bleu' },
  { id: 'approbation', nom: 'À approuver', classe: 'vert' },
  { id: 'production', nom: 'En production', classe: '' },
  { id: 'finition', nom: 'Finition', classe: '' },
  { id: 'expediee', nom: 'Expédiée', classe: 'gris' },
  { id: 'livree', nom: 'Livrée', classe: 'gris' },
  { id: 'annulee', nom: 'Annulée', classe: 'gris' },
];
export const statut = id => STATUTS.find(s => s.id === id) || STATUTS[0];
export const ACTIVES = ['nouvelle', 'approbation', 'production', 'finition'];
export const estActive = c => ACTIVES.includes(c.statut);
export const estVendue = c => c.statut !== 'annulee';
export const demandeApprobation = c => c.segment === 'entreprise' || c.produit === 'mesure';

export const STATUTS_PLAQUE = {
  a3mf: { nom: '.3mf à produire', classe: 'orange' },
  prete: { nom: 'Prête', classe: '' },
  imp: { nom: 'En impression', classe: 'vert' },
  fini: { nom: 'Imprimée', classe: 'gris' },
};

export const ETAPES = [
  { id: 'commande', titre: 'Vérifier la commande' },
  { id: '3mf', titre: 'Produire le .3mf' },
  { id: 'tranche', titre: 'Trancher dans Bambu Studio' },
  { id: 'filament', titre: 'Charger la gamme de couleurs' },
  { id: 'impression', titre: 'Imprimer les plaques' },
  { id: 'mentions', titre: 'Vérifier les mentions au dos' },
  { id: 'qualite', titre: 'Contrôle qualité' },
  { id: 'photo', titre: 'Photographier' },
  { id: 'envoi', titre: 'Emballer et expédier' },
];
export function noteEtape(id, c) {
  switch (id) {
    case 'commande': return demandeApprobation(c)
      ? 'Approbation écrite du client reçue à info@georama.ca. Segment, format, couches et repères.'
      : 'Segment, format, couches et repères. Pas d’approbation à attendre.';
    case '3mf': return 'Dans Georama Production, à partir du lien de la commande.';
    case 'tranche': return 'Couches 0,16 mm (1re couche 0,2 mm), 3 parois, remplissage 15 %. Déplacer la tour d’amorçage si Bambu avertit.';
    case 'filament': return 'Gamme ' + (c.gamme || '—') + ' : vérifier les bobines dans les AMS.';
    case 'impression': return 'Se coche toute seule quand toutes les plaques sont imprimées.';
    case 'mentions': return 'Filigrane, sources des données, « représentation artistique ».';
    case 'qualite': return (c.segment === 'peche' ? 'Lac creusé d’au moins 25 mm. ' : '') + 'Couleurs, relief et surface sans défaut.' + (nbPlaques(c) > 1 ? ' Jonctions des plaques alignées.' : '');
    case 'photo': return 'Lumière naturelle, sur bois pâle, légère plongée.';
    case 'envoi': return c.livraison === 'recuperation' ? 'Récupération gratuite à Saint-Félicien : aviser le client.' : 'Postes Canada : ajouter le numéro de suivi dans la commande.';
    default: return '';
  }
}

export const STATUTS_PROSPECT = [
  { id: 'a_contacter', nom: 'À contacter', classe: 'bleu' },
  { id: 'contacte', nom: 'Contacté', classe: '' },
  { id: 'rencontre', nom: 'Rencontre', classe: '' },
  { id: 'soumission', nom: 'Soumission', classe: 'vert' },
  { id: 'gagne', nom: 'Gagné', classe: 'plein' },
  { id: 'perdu', nom: 'Perdu', classe: 'gris' },
];
export const statutProspect = id => STATUTS_PROSPECT.find(s => s.id === id) || STATUTS_PROSPECT[0];
export const TYPES_PROSPECT = ['Municipalité / MRC', 'Parc / plein air', 'Station de ski', 'Golf', 'Tourisme', 'Éducation', 'Industrie', 'Foresterie', 'Agricole', 'Immobilier', 'Autre'];
export const CANAUX = ['Meta (Facebook, Instagram)', 'Google', 'Salon / événement', 'Courriel', 'Bouche-à-oreille', 'Autre'];
export const CATEGORIES_DEPENSE = ['Filament', 'Publicité', 'Expédition', 'Cadres et emballage', 'Équipement', 'Logiciels et abonnements', 'Salons', 'Autre'];

export const TPS = 0.05;
export const TVQ = 0.09975;

export const REGLAGES_DEFAUT = {
  id: 'general',
  objectif: 90000,
  heuresParPlaque: 37,
  heuresParJour: 20,
  heuresSemaine: 10,
  delaiJours: 21,
  livraison: 25,
  taxes: true,
  dateLimiteNoel: '2026-12-01',
  dernierEnvoi: '2026-12-18',
  membres: ['Charles Desbiens', 'Maryse Perron Chartier'],
  imprimantes: [
    { id: 'h2c', nom: 'Bambu Lab H2C', active: true },
    { id: 'h3c', nom: 'Bambu Lab H3C', active: false },
  ],
};
export function reglages(m) {
  const r = m.get('reglages', 'general');
  return Object.assign({}, REGLAGES_DEFAUT, r || {});
}

export function nbPlaques(c) {
  if (c.produit === 'mesure') return Math.max(1, Number(c.plaques) || 1);
  return produit(c.produit).plaques;
}
export function formatTexte(c) {
  const p = produit(c.produit);
  if (c.produit === 'mesure') return 'Sur mesure · ' + nbPlaques(c) + ' plaque' + (nbPlaques(c) > 1 ? 's' : '');
  return p.nom.split(' · ')[1] + (p.plaques > 1 ? ' · ' + p.plaques + ' plaques' : '');
}
export function totalHT(c) { return (Number(c.prix) || 0) + (c.livraison === 'postes' ? Number(c.fraisLivraison ?? 25) : 0); }
export function taxesDe(montant, actif = true) {
  if (!actif) return { tps: 0, tvq: 0 };
  return { tps: Math.round(montant * TPS * 100) / 100, tvq: Math.round(montant * TVQ * 100) / 100 };
}

export function prochainNumero(m, c) {
  const annee = (c.recue || aujourdhui()).slice(0, 4);
  const pref = demandeApprobation(c) ? 'S' : 'G';
  let max = 0;
  m.liste('commandes').forEach(x => {
    const r = new RegExp('^' + pref + '-' + annee + '-(\\d+)$').exec(x.numero || '');
    if (r) max = Math.max(max, Number(r[1]));
  });
  return pref + '-' + annee + '-' + String(max + 1).padStart(3, '0');
}

// Crée ou ajuste les plaques d'une commande dans la file d'impression.
export function synchroniserPlaques(m, c) {
  const R = reglages(m);
  const toutes = m.liste('plaques').filter(p => p.commande === c.id);
  if (!estActive(c)) {
    toutes.filter(p => p.statut === 'a3mf' || p.statut === 'prete').forEach(p => m.supprimer('plaques', p.id));
    return;
  }
  const n = nbPlaques(c);
  let rangMax = m.liste('plaques').reduce((s, p) => Math.max(s, Number(p.rang) || 0), 0);
  for (let i = 1; i <= n; i++) {
    if (!toutes.find(p => p.n === i)) {
      rangMax += 1;
      m.mettre('plaques', { id: uid('p'), commande: c.id, n: i, total: n, statut: 'a3mf', rang: rangMax, heures: R.heuresParPlaque }, true);
    }
  }
  toutes.forEach(p => {
    if (p.n > n && (p.statut === 'a3mf' || p.statut === 'prete')) m.supprimer('plaques', p.id);
    else if (p.total !== n) m.modifier('plaques', p.id, { total: n }, true);
  });
}

export function plaquesDe(m, idCommande) {
  return m.liste('plaques').filter(p => p.commande === idCommande).sort((a, b) => a.n - b.n);
}
export function fileImpression(m) {
  const cmds = new Map(m.liste('commandes').map(c => [c.id, c]));
  return m.liste('plaques')
    .filter(p => { const c = cmds.get(p.commande); return c && estActive(c); })
    .sort((a, b) => (a.rang || 0) - (b.rang || 0));
}

// Avancement d'une plaque en impression (estimé à partir de l'heure de départ)
export function avancement(p, maintenant = Date.now()) {
  if (p.statut === 'fini') return 1;
  if (p.statut !== 'imp' || !p.debut) return 0;
  const ecoule = (maintenant - new Date(p.debut).getTime()) / 3600000;
  return Math.max(0, Math.min(0.99, ecoule / (Number(p.heures) || 37)));
}
export function heuresRestantes(p, maintenant = Date.now()) {
  if (p.statut === 'fini') return 0;
  const h = Number(p.heures) || 37;
  return h * (1 - avancement(p, maintenant));
}

// Planification : répartit les plaques non imprimées sur les imprimantes actives.
export function planifier(m, opts = {}) {
  const R = reglages(m);
  const imprimantes = (opts.imprimantes || R.imprimantes.filter(i => i.active)).map(i => i.id);
  if (!imprimantes.length) imprimantes.push('h2c');
  const hpj = Number(opts.heuresParJour || R.heuresParJour) || 20;
  const debut = Date.now();
  const libre = {};
  imprimantes.forEach(i => { libre[i] = 0; });
  const cmds = new Map(m.liste('commandes').map(c => [c.id, c]));
  const file = fileImpression(m).filter(p => p.statut !== 'fini');
  const blocs = [];
  // Les plaques déjà en impression restent sur leur imprimante.
  file.filter(p => p.statut === 'imp').forEach(p => {
    const imp = imprimantes.includes(p.imprimante) ? p.imprimante : imprimantes[0];
    const dur = heuresRestantes(p) / hpj * 24;
    blocs.push({ p, imp, debut: libre[imp], fin: libre[imp] + dur, c: cmds.get(p.commande) });
    libre[imp] += dur;
  });
  const restantes = file.filter(p => p.statut !== 'imp');
  const extra = Number(opts.extra) || 0;
  for (let k = 0; k < extra; k++) restantes.push({ id: 'x' + k, n: 1, total: 1, statut: 'prevue', heures: R.heuresParPlaque, simule: true });
  restantes.forEach(p => {
    let imp = imprimantes[0];
    imprimantes.forEach(i => { if (libre[i] < libre[imp]) imp = i; });
    const dur = (Number(p.heures) || R.heuresParPlaque) / hpj * 24;
    blocs.push({ p, imp, debut: libre[imp], fin: libre[imp] + dur, c: cmds.get(p.commande) });
    libre[imp] += dur;
  });
  const finH = Math.max(0, ...Object.values(libre));
  const fin = new Date(debut + finH * 3600000);
  const limite = versDate(R.dernierEnvoi);
  limite.setHours(23, 59);
  const limiteH = (limite.getTime() - debut) / 3600000;
  blocs.forEach(b => {
    b.finDate = new Date(debut + b.fin * 3600000);
    b.tard = b.fin > limiteH;
    if (b.c && b.c.promise) { const pr = versDate(b.c.promise); pr.setHours(23, 59); b.enRetard = b.finDate > pr; }
  });
  const heuresTotal = file.reduce((s, p) => s + heuresRestantes(p), 0) + extra * R.heuresParPlaque;
  return {
    blocs, imprimantes, fin, finH, limiteH, heuresTotal,
    nbPlaques: file.length + extra,
    tard: blocs.filter(b => b.tard).length,
    margeJours: Math.floor((limiteH - finH) / 24),
    capaciteSemaine: Math.floor(imprimantes.length * hpj * 7 / (R.heuresParPlaque || 37)),
  };
}

export function joursAvantNoel(m) { return joursEntre(aujourdhui(), reglages(m).dateLimiteNoel); }
export function datePromise(m, recue) { return ajouterJours(recue || aujourdhui(), reglages(m).delaiJours); }

export function moisDe(iso) { return (iso || '').slice(0, 7); }
export function dansPeriode(iso, periode) {
  if (!iso) return false;
  if (periode.length === 4) return iso.slice(0, 4) === periode;
  return iso.slice(0, 7) === periode;
}
export function ventes(m, periode) {
  const R = reglages(m);
  return m.liste('commandes').filter(c => estVendue(c) && dansPeriode(c.recue, periode)).map(c => {
    const ht = totalHT(c);
    return Object.assign({ ht }, taxesDe(ht, R.taxes), { c });
  });
}
export function depenses(m, periode) {
  return m.liste('depenses').filter(d => dansPeriode(d.date, periode)).map(d => ({
    ht: Number(d.montant) || 0, tps: Number(d.tps) || 0, tvq: Number(d.tvq) || 0, d,
  }));
}
export function resume(m, periode) {
  const v = ventes(m, periode), d = depenses(m, periode);
  const s = (l, k) => l.reduce((t, x) => t + x[k], 0);
  return {
    ventesHT: s(v, 'ht'), tpsPercue: s(v, 'tps'), tvqPercue: s(v, 'tvq'),
    depensesHT: s(d, 'ht'), tpsPayee: s(d, 'tps'), tvqPayee: s(d, 'tvq'),
    nbVentes: v.length, nbDepenses: d.length,
    benefice: s(v, 'ht') - s(d, 'ht'),
    aEncaisser: v.filter(x => !x.c.payee).reduce((t, x) => t + x.ht + x.tps + x.tvq, 0),
  };
}

export function commandeTexte(c) { return (c.numero || '') + ' · ' + (c.lieu || c.client || ''); }

export function moisCourant() { return isoJour(new Date()).slice(0, 7); }

/* ---------- Fil d'activité ---------- */
export function journaliser(m, texte, lien = '', type = '') {
  m.mettre('activite', { id: uid('a'), quand: new Date().toISOString(), qui: m.qui, texte, lien, type }, true);
}
export function activiteRecente(m, n = 12) {
  return m.liste('activite').slice().sort((a, b) => String(b.quand).localeCompare(String(a.quand))).slice(0, n);
}

/* ---------- Temps de travail ---------- */
export const CATEGORIES_TEMPS = ['Production', 'Commandes et clients', 'Marketing', 'Prospection', 'Finances', 'Développement (outils)', 'Autre'];
export function debutSemaine(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const j = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - j);
  return isoJour(x);
}
export function minutesSemaine(m, qui) {
  const deb = debutSemaine();
  return m.liste('temps').filter(t => t.qui === qui && (t.date || '') >= deb).reduce((s, t) => s + (Number(t.minutes) || 0), 0);
}

/* ---------- Ordi de la maison (agent) ---------- */
export function agent(m) {
  const a = (m.externes.agent || [])[0];
  if (!a) return { installe: false, enLigne: false };
  const age = (Date.now() - new Date(a.vu).getTime()) / 1000;
  return Object.assign({}, a, { installe: true, enLigne: age < 150, age });
}
export function etatImprimanteDirect(m, idImp) {
  const a = agent(m);
  if (!a.enLigne) return null;
  const e = (a.imprimantes || []).find(i => i.id === idImp);
  if (!e || !e.vu || (Date.now() - new Date(e.vu).getTime()) > 10 * 60000) return null;
  return e;
}
export function travauxDe(m, idCommande) {
  const res = new Map((m.externes.resultats || []).map(r => [r.id, r]));
  return m.liste('travaux').filter(t => t.commande === idCommande)
    .sort((a, b) => String(b.demandeLe).localeCompare(String(a.demandeLe)))
    .map(t => Object.assign({}, t, { resultat: res.get(t.id) || null }));
}
export function dossierCommande(c) { return 'commandes/' + String(c.numero || 'sans-numero').replace(/[^A-Za-z0-9_-]/g, ''); }

/* ---------- Commandes du site Wix (déposées par l'agent) ---------- */
export function importerWix(m) {
  const R = reglages(m);
  const ignores = new Set(R.wixIgnores || []);
  const ajoutees = [];
  (m.externes.wix || []).forEach(w => {
    const id = 'wix-' + w.id;
    if (ignores.has(w.id) || m.donnees.commandes.some(c => c.id === id)) return;
    const recue = String(w.date || '').slice(0, 10) || aujourdhui();
    const c = {
      id, wixId: w.wixId, wixNumero: w.wixNumero, client: w.client || 'Client du site', courriel: w.courriel, telephone: w.telephone,
      lien: w.lien, lieu: w.article || '', segment: w.segment || 'terre', produit: w.produit || 'signature', gamme: w.gamme || 'Boréal',
      prix: Number(w.prix) || 0, livraison: w.livraison || 'postes', fraisLivraison: R.livraison, payee: !!w.payee,
      recue, promise: ajouterJours(recue, R.delaiJours), responsable: (R.membres || [])[0] || m.qui, etapes: {}, tempsMin: 0,
      notes: 'Commande du site Wix n° ' + (w.wixNumero || '?') + (w.article ? ' · ' + w.article : ''),
    };
    c.statut = demandeApprobation(c) ? 'approbation' : 'nouvelle';
    c.numero = prochainNumero(m, c);
    const sauvee = m.mettre('commandes', c, true);
    synchroniserPlaques(m, sauvee);
    journaliser(m, 'Commande du site ' + sauvee.numero + ' ajoutée automatiquement (' + sauvee.client + ')', '#/production/fiche/' + sauvee.id, 'wix');
    ajoutees.push(sauvee);
  });
  if (ajoutees.length) m.avertir('local');
  return ajoutees;
}

/* ---------- Icônes de segments (trait, style Georama) ---------- */
const ICONES_SEG = {
  terre: '<path d="M12 3 7 11h3l-4 6h12l-4-6h3z"/><path d="M12 17v4"/>',
  chasse: '<path d="M8 21V9h8v12M7 9l5-5 5 5M10 13h4"/><path d="M8 21l-3 0M16 21h3"/>',
  peche: '<path d="M3 12c3-4 8-5 12-2l4-3v10l-4-3c-4 3-9 2-12-2z"/><circle cx="8" cy="11" r="0.8" fill="currentColor"/>',
  sommet: '<path d="M3 20 10 8l3 5 2-3 6 10z"/><path d="M8.5 11 10 8l1.5 2.5"/>',
  ville: '<path d="M4 21V9l5-3v15M9 21V4h6v17M15 21v-9h5v9M3 21h18"/>',
  entreprise: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 13h18"/>',
  agricole: '<path d="M4 21V11l8-6 8 6v10z"/><path d="M9 21v-6h6v6M4 11h16"/>',
};
export function icoSegment(id, taille = 18) {
  return `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;color:var(--accent-texte)">${ICONES_SEG[id] || ICONES_SEG.terre}</svg>`;
}
