// Carte-cadeau en PDF envoyée toute seule (v1.14.9).
// Quand une carte-cadeau est achetée sur le site, le hub ouvert avec le compte d'envoi (info@georama.ca par défaut)
// remplit le modèle PDF (Pour, De la part de, Message) et l'envoie à la personne qui a acheté, prêt à imprimer.
// Le code de la carte n'est jamais lisible par l'API de Wix (il est masqué) : il arrive dans le courriel de carte-cadeau
// de Wix. La case « Code de la carte » du PDF reste donc à remplir par la personne qui achète.
import { reglages, journaliser, estCarteCadeau, dossierCommande } from './donnees.js';
import { envoyerGraph, SIGNATURE_DEFAUT } from './courriels.js';
import { compteEnvoi, sessionEnvoi } from './confirmation-auto.js';
import { prenom } from './ui.js';

const MODELE_PDF = new URL('../../carte-cadeau/pdf/carte-cadeau-georama-modele.pdf', import.meta.url).href;
const PDF_LIB = new URL('../vendor/pdf-lib-1.17.1.esm.min.js', import.meta.url).href;
const VERROU = 'georama-hub-carte-cadeau:';
const ATTENTE_DETAILS_MIN = 75;      // temps laissé à l'ordi de la maison pour lire le détail de la carte dans Wix
let enCours = false;

function versionAuMoins(v, min) {
  const a = String(v || '0').split('.').map(Number), b = min.split('.').map(Number);
  for (let i = 0; i < b.length; i++) { if ((a[i] || 0) !== b[i]) return (a[i] || 0) > b[i]; }
  return true;
}

// Détail de la carte lu par l'agent (1.7.5) dans Wix : destinataire, expéditeur, message, 4 derniers caractères du code.
export function detailCarte(m, c) {
  return (m.externes.cartes || []).find(x => x.wixId && x.wixId === c.wixId) || null;
}

function aEnvoyer(m, c) {
  if (!estCarteCadeau(c) || !c.courriel || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.courriel)) return false;
  if (c.statut === 'annulee' || c.payee === false) return false;
  const k = c.carteCadeauPdf || {};
  if (k.envoyee) return false;
  if (k.erreur && (k.essais || 0) >= 3) return false;
  return true;
}

// Faut-il encore attendre le détail de la carte ? Seulement si l'agent de la maison sait le lire (1.7.5 ou plus).
function attendreDetails(m, c) {
  if (detailCarte(m, c)) return false;
  const agent = (m.externes.agent || [])[0] || {};
  if (!versionAuMoins(agent.version, '1.7.5')) return false;
  const depuis = Date.parse(c.importeeLe || '') || 0;
  return Date.now() - depuis < ATTENTE_DETAILS_MIN * 60000;
}

function verrou(id) {
  try {
    const t = Number(localStorage.getItem(VERROU + id)) || 0;
    if (Date.now() - t < 10 * 60000) return false;
    localStorage.setItem(VERROU + id, String(Date.now()));
    return true;
  } catch (e) { return true; }
}

function propre(t, max) { return String(t || '').replace(/[^\x20-\x7E -ÿ\n’‘“”…–—œŒ€]/g, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[–—]/g, '-').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/€/g, 'EUR').trim().slice(0, max); }

// Remplit le modèle. Les cases restent modifiables à l'écran (la personne peut corriger avant d'imprimer).
export async function pdfCarte(valeurs, charger = async url => new Uint8Array(await (await fetch(url, { cache: 'no-cache' })).arrayBuffer())) {
  const { PDFDocument } = await import(PDF_LIB);
  const doc = await PDFDocument.load(await charger(MODELE_PDF));
  const f = doc.getForm();
  const mettre = (nom, texte, max, taille) => {
    const champ = f.getTextField(nom);
    if (taille) champ.setFontSize(taille);
    const t = propre(texte, max);
    if (t) champ.setText(nom === 'message' ? t : t.replace(/\n/g, ' '));
  };
  mettre('pour', valeurs.pour, 60, 11);
  mettre('de', valeurs.de, 60, 11);
  mettre('message', valeurs.message, 420, 10);
  mettre('code', valeurs.code, 40, 11);
  doc.setTitle('Carte-cadeau Georama');
  return new Blob([await doc.save()], { type: 'application/pdf' });
}

export function texteCourriel(m, c, ctx, d) {
  const R = reglages(m);
  const signature = String(R.signatureCourriel || SIGNATURE_DEFAUT).replace('{moi}', ctx.moi || 'L’équipe Georama').replace('{prenom_moi}', prenom(ctx.moi) || 'L’équipe Georama');
  const pn = prenom(c.client);
  const dest = d && d.pourCourriel && d.pourCourriel.toLowerCase() !== String(c.courriel).toLowerCase();
  const fin = d && d.suffixe ? ' Il se termine par ' + d.suffixe + '.' : '';
  const lignes = [
    'Bonjour' + (pn ? ' ' + pn : '') + ',',
    '',
    'Merci pour votre achat. Voici votre carte-cadeau Georama en PDF, prête à imprimer et à remettre en main propre.',
    '',
    'Le code de la carte se trouve dans le courriel de carte-cadeau ' + (dest ? 'envoyé à ' + (d.pour || 'la personne qui la reçoit') + ', à la date que vous avez choisie.' : 'envoyé par Georama à l’adresse choisie au moment de l’achat.') + fin
      + ' Inscrivez-le dans la case « Code de la carte » du PDF, à l’écran ou à la main une fois la page imprimée.',
    '',
    'Les cases « Pour », « De la part de » et « Message » se modifient aussi à l’écran avant l’impression.',
    '',
    'La carte donne droit à une maquette Georama Signature de 10 × 12 po, jusqu’à 7 couleurs, livraison incluse. Elle n’expire pas : la personne prend le temps de choisir son lieu sur georama.ca.',
    '',
    signature,
  ];
  return { objet: 'Votre carte-cadeau Georama à imprimer', corps: lignes.join('\n') };
}

async function envoyerUne(ctx, c, auto) {
  const m = ctx.m;
  const d = detailCarte(m, c);
  const blob = await pdfCarte({ pour: d && d.pour, de: (d && d.de) || c.client, message: d && d.message });
  const nom = 'Carte-cadeau_Georama_' + String(c.numero || '').replace(/[^\w-]/g, '_') + '.pdf';
  const { objet, corps } = texteCourriel(m, c, ctx, d);
  await envoyerGraph(m, c, { a: c.courriel.trim(), objet, corps, jointes: [{ nom, blob }] });
  if (m.a.televerser) m.a.televerser(dossierCommande(c) + '/' + nom, blob).catch(() => {});   // copie dans le dossier de la commande
  const frais = m.get('commandes', c.id) || c;
  const courriels = (frais.courriels || []).concat([{ modele: 'carte-cadeau', le: new Date().toISOString(), par: ctx.moi, comment: 'envoye', auto: !!auto }]);
  m.modifier('commandes', c.id, { courriels, carteCadeauPdf: { envoyee: new Date().toISOString(), essais: ((frais.carteCadeauPdf || {}).essais || 0) + 1, details: !!d } }, true);
  journaliser(m, 'Carte-cadeau en PDF envoyée à ' + c.client + ' (' + c.numero + ') depuis ' + compteEnvoi(m), '#/production/fiche/' + c.id, 'courriel');
  m.avertir('local');
}

export async function cartesCadeauxAuto(ctx) {
  const m = ctx.m;
  if (enCours || !m || !sessionEnvoi(ctx) || reglages(m).carteCadeauAuto === false) return;
  const liste = m.liste('commandes').filter(c => aEnvoyer(m, c) && !attendreDetails(m, c));
  if (!liste.length) return;
  enCours = true;
  try {
    for (const c of liste) {
      const actuel = m.get('commandes', c.id);
      if (!actuel || !aEnvoyer(m, actuel) || !verrou(c.id)) continue;
      const essais = ((actuel.carteCadeauPdf || {}).essais || 0) + 1;
      try {
        await envoyerUne(ctx, actuel, true);
        ctx.toast('Carte-cadeau en PDF envoyée à ' + actuel.client + ' (' + actuel.numero + ').');
      } catch (e) {
        const msg = e.code === 'consentement' ? 'il manque l’autorisation d’envoyer des courriels : Paramètres › Courriels aux clients › « Donner l’autorisation d’envoyer »' : (e.message || 'envoi impossible');
        m.modifier('commandes', c.id, { carteCadeauPdf: { erreur: msg, essais: e.code === 'consentement' ? 0 : essais, le: new Date().toISOString() } }, true);
        m.avertir('local');
        try { localStorage.removeItem(VERROU + c.id); } catch (x) { /* rien */ }
        if (e.code === 'consentement') break;
      }
    }
  } finally { enCours = false; }
}

// Bouton de la fiche : envoyer (ou renvoyer) tout de suite.
export async function envoyerCarteMaintenant(ctx, id) {
  const m = ctx.m;
  const c = m.get('commandes', id);
  if (!c || !estCarteCadeau(c)) return;
  if (!c.courriel) { ctx.toast('Pas de courriel pour cette carte-cadeau.'); return; }
  if (!sessionEnvoi(ctx)) { ctx.toast('Ouvre le hub avec ' + compteEnvoi(m) + ' pour envoyer la carte.'); return; }
  if ((c.carteCadeauPdf || {}).envoyee && !confirm('La carte a déjà été envoyée à ' + c.courriel + '. La renvoyer ?')) return;
  try {
    await envoyerUne(ctx, c, false);
    ctx.toast('Carte-cadeau en PDF envoyée à ' + c.client + '.');
  } catch (e) {
    ctx.toast('Envoi impossible : ' + (e.message || 'erreur'));
  }
}
