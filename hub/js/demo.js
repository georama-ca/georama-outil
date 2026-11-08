// Données d'exemple pour essayer le hub (mode démo seulement). Les dates suivent la date du jour.
import { ajouterJours, aujourdhui } from './ui.js';
import { REGLAGES_DEFAUT } from './donnees.js';

export function donneesDemo() {
  const j = n => ajouterJours(aujourdhui(), n);
  const ilYa = h => new Date(Date.now() - h * 3600000).toISOString();
  const t = new Date().toISOString();
  const C = (o) => Object.assign({ maj: t, par: 'Démo', livraison: 'postes', fraisLivraison: 25, payee: true, etapes: {}, tempsMin: 0 }, o);
  const fait = (...ids) => Object.fromEntries(ids.map(id => [id, { fait: true, par: 'Charles Desbiens', le: ilYa(48) }]));

  const commandes = [
    C({ id: 'c35', courriels: [{ modele: 'recue', le: ilYa(760), par: 'Charles Desbiens', comment: 'outlook' }, { modele: 'production', le: ilYa(500), par: 'Charles Desbiens', comment: 'outlook' }, { modele: 'expediee', le: ilYa(300), par: 'Charles Desbiens', comment: 'outlook' }, { modele: 'merci', le: ilYa(100), par: 'Charles Desbiens', comment: 'outlook' }], numero: 'G-2026-035', client: 'Julie Tremblay', courriel: 'julie@exemple.ca', lieu: 'Érablière, Normandin', segment: 'terre', produit: 'signature', gamme: 'Terre', prix: 250, statut: 'livree', recue: j(-32), promise: j(-11), responsable: 'Charles Desbiens', etapes: fait('commande', '3mf', 'tranche', 'filament', 'impression', 'mentions', 'qualite', 'photo', 'envoi'), tempsMin: 64 }),
    C({ id: 'c36', courriels: [{ modele: 'recue', le: ilYa(670), par: 'Charles Desbiens', comment: 'outlook' }, { modele: 'production', le: ilYa(400), par: 'Charles Desbiens', comment: 'outlook' }, { modele: 'prete', le: ilYa(180), par: 'Charles Desbiens', comment: 'outlook' }], numero: 'G-2026-036', client: 'Marc Gagnon', courriel: 'marc@exemple.ca', lieu: 'ZEC des Passes', segment: 'chasse', produit: 'essentiel', gamme: 'Boréal', prix: 175, statut: 'livree', livraison: 'recuperation', recue: j(-28), promise: j(-7), responsable: 'Maryse Perron Chartier', etapes: fait('commande', '3mf', 'tranche', 'filament', 'impression', 'mentions', 'qualite', 'photo', 'envoi'), tempsMin: 55 }),
    C({ id: 'c37', courriels: [{ modele: 'recue', le: ilYa(480), par: 'Charles Desbiens', comment: 'outlook' }, { modele: 'production', le: ilYa(300), par: 'Charles Desbiens', comment: 'outlook' }], numero: 'G-2026-037', client: 'Sophie Côté', courriel: 'sophie@exemple.ca', lieu: 'Lac Aylmer', segment: 'peche', produit: 'signature', gamme: 'Sapinière', prix: 250, statut: 'expediee', recue: j(-20), promise: j(1), suivi: 'EXEMPLE123CA', responsable: 'Charles Desbiens', etapes: fait('commande', '3mf', 'tranche', 'filament', 'impression', 'mentions', 'qualite', 'photo', 'envoi'), tempsMin: 70 }),
    C({ id: 'c38', courriels: [{ modele: 'recue', le: ilYa(360), par: 'Charles Desbiens', comment: 'outlook' }, { modele: 'production', le: ilYa(200), par: 'Charles Desbiens', comment: 'outlook' }], numero: 'G-2026-038', client: 'Famille Bouchard', courriel: 'bouchard@exemple.ca', lieu: 'Érablière familiale, Saint-Prime', segment: 'terre', produit: 'signature', gamme: 'Terre', prix: 280, statut: 'finition', recue: j(-15), promise: j(6), responsable: 'Maryse Perron Chartier', notes: 'Cadre de bois (+30 $).', etapes: fait('commande', '3mf', 'tranche', 'filament', 'impression'), tempsMin: 35 }),
    C({ id: 'c39', courriels: [{ modele: 'recue', le: ilYa(215), par: 'Charles Desbiens', comment: 'outlook' }], numero: 'G-2026-039', client: 'Louis Simard', courriel: 'louis@exemple.ca', lieu: 'Vieux-Québec', segment: 'ville', produit: 'essentiel', gamme: 'Terre', prix: 175, statut: 'production', recue: j(-9), promise: j(12), responsable: 'Charles Desbiens', etapes: fait('commande') }),
    C({ id: 'c40', numero: 'G-2026-040', client: 'Nadia Lavoie', courriel: 'nadia@exemple.ca', lieu: 'Mont Valin', segment: 'sommet', produit: 'signature', gamme: 'Arctique', prix: 250, statut: 'production', recue: j(-8), promise: j(13), responsable: 'Charles Desbiens', etapes: fait('commande', '3mf', 'tranche') }),
    C({ id: 'c41', courriels: [{ modele: 'recue', le: ilYa(288), par: 'Charles Desbiens', comment: 'outlook' }, { modele: 'production', le: ilYa(60), par: 'Charles Desbiens', comment: 'outlook' }], numero: 'G-2026-041', client: 'Pierre Fortin', courriel: 'pierre@exemple.ca', lieu: 'Rang 4, Saint-Félicien', segment: 'terre', produit: 'gf4', gamme: 'Boréal', prix: 995, statut: 'production', recue: j(-12), promise: j(9), responsable: 'Charles Desbiens', etapes: fait('commande', '3mf', 'tranche', 'filament'), tempsMin: 41 }),
    C({ id: 'c43', numero: 'G-2026-043', client: 'Annie Girard', courriel: 'annie@exemple.ca', lieu: 'Lac Saint-Jean, Chambord', segment: 'peche', produit: 'signature', gamme: 'Sapinière', prix: 250, statut: 'nouvelle', recue: j(-1), promise: j(20), responsable: 'Charles Desbiens', payee: true }),
    C({ id: 'c44', numero: 'G-2026-044', client: 'Éric Morin', courriel: 'eric@exemple.ca', lieu: 'Pourvoirie, secteur nord', segment: 'chasse', produit: 'essentiel', gamme: 'Boréal', prix: 175, statut: 'nouvelle', recue: j(0), promise: j(21), responsable: 'Maryse Perron Chartier' }),
    C({ id: 'c45', courriels: [{ modele: 'recue', le: ilYa(96), par: 'Charles Desbiens', comment: 'outlook' }], numero: 'S-2026-003', client: 'Club de golf (exemple)', courriel: 'direction@exemple.ca', lieu: 'Parcours 18 trous', segment: 'entreprise', produit: 'mesure', plaques: 6, gamme: 'Terre', prix: 1450, statut: 'approbation', livraison: 'recuperation', payee: false, recue: j(-4), promise: j(24), responsable: 'Maryse Perron Chartier', notes: 'Soumission envoyée. Acompte de 50 % à recevoir.' }),
  ];

  const P = (o) => Object.assign({ maj: t, par: 'Démo', heures: 37, total: 1 }, o);
  const plaques = [
    P({ id: 'p38', commande: 'c38', n: 1, statut: 'fini', rang: 1, imprimante: 'h2c', debut: ilYa(120), finLe: ilYa(83) }),
    P({ id: 'p41a', commande: 'c41', n: 1, total: 4, statut: 'fini', rang: 2, imprimante: 'h2c', debut: ilYa(60), finLe: ilYa(23) }),
    P({ id: 'p41b', commande: 'c41', n: 2, total: 4, statut: 'imp', rang: 3, imprimante: 'h2c', debut: ilYa(21) }),
    P({ id: 'p41c', commande: 'c41', n: 3, total: 4, statut: 'prete', rang: 4 }),
    P({ id: 'p41d', commande: 'c41', n: 4, total: 4, statut: 'prete', rang: 5 }),
    P({ id: 'p40', commande: 'c40', n: 1, statut: 'prete', rang: 6 }),
    P({ id: 'p39', commande: 'c39', n: 1, statut: 'a3mf', rang: 7 }),
    P({ id: 'p43', commande: 'c43', n: 1, statut: 'a3mf', rang: 8, heures: 42 }),
    P({ id: 'p44', commande: 'c44', n: 1, statut: 'a3mf', rang: 9 }),
  ];
  for (let i = 1; i <= 6; i++) plaques.push(P({ id: 'p45' + i, commande: 'c45', n: i, total: 6, statut: 'a3mf', rang: 9 + i }));

  const T = (o) => Object.assign({ maj: t, par: 'Démo', fait: false }, o);
  const taches = [
    T({ id: 't1', titre: 'Retirer la plaque 2/4 de G-2026-041', qui: 'Charles Desbiens', echeance: j(0) }),
    T({ id: 't2', titre: 'Relancer le club de golf pour l’acompte', qui: 'Maryse Perron Chartier', echeance: j(1) }),
    T({ id: 't3', titre: 'Commander du PETG beige', qui: 'Charles Desbiens', echeance: j(2) }),
    T({ id: 't4', titre: 'Emballer G-2026-038', qui: 'Maryse Perron Chartier', echeance: j(3) }),
    T({ id: 't5', titre: 'Publier la vidéo de Noël', qui: 'Charles Desbiens', echeance: j(-1), fait: true }),
  ];

  const Pr = (o) => Object.assign({ maj: t, par: 'Démo' }, o);
  const prospects = [
    Pr({ id: 'r1', organisation: 'Club de golf (exemple)', type: 'Golf', region: 'Saguenay–Lac-Saint-Jean', contact: 'Direction générale', statut: 'soumission', prochaine: j(1), action: 'Relancer pour l’acompte', valeur: 1450 }),
    Pr({ id: 'r2', organisation: 'MRC (exemple), Mauricie', type: 'Municipalité / MRC', region: 'Mauricie', contact: 'Service de l’aménagement', statut: 'contacte', prochaine: j(3), action: 'Envoyer la présentation', valeur: 2500 }),
    Pr({ id: 'r3', organisation: 'Station de ski (exemple)', type: 'Station de ski', region: 'Mauricie', contact: 'Marketing', statut: 'a_contacter', prochaine: j(-1), action: 'Premier appel', valeur: 3000 }),
    Pr({ id: 'r4', organisation: 'Parc régional (exemple)', type: 'Parc / plein air', region: 'Mauricie', contact: 'Accueil', statut: 'rencontre', prochaine: j(6), action: 'Rencontre Teams', valeur: 1800 }),
    Pr({ id: 'r5', organisation: 'Ferme laitière (exemple)', type: 'Agricole', region: 'Centre-du-Québec', contact: 'Propriétaire', statut: 'perdu', notes: 'Pas de budget cette année.' }),
  ];

  const Ca = (o) => Object.assign({ maj: t, par: 'Démo' }, o);
  const campagnes = [
    Ca({ id: 'k1', nom: 'Lancement Terre à bois', canal: 'Meta (Facebook, Instagram)', segment: 'terre', debut: j(-16), fin: j(-2), budget: 50, depense: 50, visites: 142, commandes: 3 }),
    Ca({ id: 'k2', nom: 'Lancement Chasse', canal: 'Meta (Facebook, Instagram)', segment: 'chasse', debut: j(-16), fin: j(-2), budget: 50, depense: 48.5, visites: 88, commandes: 2 }),
    Ca({ id: 'k3', nom: 'Noël 2026 · Pêche', canal: 'Meta (Facebook, Instagram)', segment: 'peche', debut: j(-5), fin: j(25), budget: 50, depense: 12.4, visites: 71, commandes: 1 }),
    Ca({ id: 'k4', nom: 'Gestionnaires Entreprise', canal: 'Meta (Facebook, Instagram)', segment: 'entreprise', debut: j(-10), fin: j(20), budget: 50, depense: 21, visites: 24, commandes: 0 }),
  ];

  const D = (o) => Object.assign({ maj: t, par: 'Démo' }, o);
  const depenses = [
    D({ id: 'd1', date: j(-25), fournisseur: 'Bambu Lab', categorie: 'Filament', montant: 180, tps: 9, tvq: 17.96 }),
    D({ id: 'd2', date: j(-3), fournisseur: 'Meta', categorie: 'Publicité', montant: 131.9, tps: 6.6, tvq: 13.16 }),
    D({ id: 'd3', date: j(-6), fournisseur: 'Postes Canada', categorie: 'Expédition', montant: 64, tps: 3.2, tvq: 6.38 }),
    D({ id: 'd4', date: j(-12), fournisseur: 'Fournisseur de cadres (exemple)', categorie: 'Cadres et emballage', montant: 96, tps: 4.8, tvq: 9.58 }),
  ];

  const F = (o) => Object.assign({ maj: t, par: 'Démo' }, o);
  const stock = { noir: 2, noirdoux: 0, blanc: 3, creme: 1, beige: 0, gris: 1, brun: 1, vert: 1, vertpin: 0, bleupale: 1, bleu: 1, bleugris: 0, bleufonce: 1, orange: 2, rouge: 1 };
  const filament = Object.entries(stock).map(([c, n]) => F({ id: 'b-' + c, type: 'bobine', couleur: c, stock: n, commandee: false }));
  [
    ['A', 1, 'noir', 0.8], ['A', 2, 'beige', 0.1], ['A', 3, 'vert', 0.6], ['A', 4, 'bleupale', 0.5],
    ['B', 1, 'orange', 0.7], ['B', 2, 'blanc', 0.9], ['B', 3, 'brun', 0.4], ['B', 4, 'gris', 0.6],
    ['HT', 1, 'vertpin', 0.3],
  ].forEach(([u, n, c, kg]) => filament.push(F({ id: 'ams-' + u + n, type: 'ams', unite: u, n, couleur: c, kg })));

  const reglagesDemo = [Object.assign({}, REGLAGES_DEFAUT, { maj: t, par: 'Démo' })];

  const M = 'Maryse Perron Chartier', Ch = 'Charles Desbiens';
  const A = (h, qui, texte, lien) => ({ id: 'a' + h + texte.length, quand: ilYa(h), qui, texte, lien, maj: t, par: 'Démo' });
  const activite = [
    A(1.5, M, 'Relance envoyée au club de golf pour l\u2019acompte', '#/marketing'),
    A(3, M, 'Nouveau prospect : Parc régional (exemple)', '#/marketing'),
    A(5, M, 'Dépense ajoutée : Postes Canada (64,00 $)', '#/finances/depenses'),
    A(21, Ch, 'G-2026-041 : plaque 2/4 lancée sur la H2C', '#/production/fiche/c41'),
    A(23, Ch, 'G-2026-041 : plaque 1/4 imprimée en 37 h', '#/production/fiche/c41'),
    A(26, M, 'G-2026-037 expédiée à Sophie Côté', '#/production/fiche/c37'),
    A(30, Ch, 'Nouvelle commande G-2026-044 : Éric Morin (Chasse)', '#/production/fiche/c44'),
    A(50, Ch, 'G-2026-040 : .3mf prêt, les plaques peuvent partir', '#/production/fiche/c40'),
  ];
  const H = (j, qui, minutes, categorie, note) => ({ id: 'h' + j + qui.length + minutes, qui, date: ajouterJours(aujourdhui(), -j), minutes, categorie, note, commande: '', maj: t, par: 'Démo' });
  const auj = new Date();
  const jSem = (auj.getDay() + 6) % 7; // jours écoulés depuis lundi
  const temps = [
    H(Math.min(jSem, 1), Ch, 150, 'Production', 'Plaques G-2026-041'),
    H(Math.min(jSem, 2), Ch, 120, 'Commandes et clients', 'Courriels clients'),
    H(0, Ch, 90, 'Développement (outils)', 'Hub Georama'),
    H(Math.min(jSem, 1), M, 180, 'Prospection', 'Appels Mauricie'),
    H(0, M, 60, 'Finances', 'Reçus d\u2019octobre'),
  ];

  return { commandes, plaques, taches, prospects, campagnes, depenses, filament, reglages: reglagesDemo, activite, temps, travaux: [] };
}

// Fentes AMS par défaut pour un hub tout neuf (Microsoft 365) : vides, à remplir.
export function amsVides() {
  const t = new Date().toISOString();
  const l = [];
  [['A', 4], ['B', 4], ['HT', 1]].forEach(([u, n]) => { for (let i = 1; i <= n; i++) l.push({ id: 'ams-' + u + i, type: 'ams', unite: u, n: i, couleur: '', kg: 0, maj: t }); });
  return l;
}
