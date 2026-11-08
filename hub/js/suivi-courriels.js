// Suivi automatique des courriels de prospection.
// Le hub lit les EN-TÊTES des courriels de la personne connectée (objet, date, expéditeur,
// destinataires : autorisation Microsoft « Mail.ReadBasic », jamais le contenu), les relie aux
// prospects par adresse (ou par domaine quand un seul prospect l'utilise), puis :
//  - garde l'historique des échanges dans la collection « courriels » (partagée) ;
//  - passe le prospect à « Contacté » au premier envoi et prévoit une relance 7 jours plus tard ;
//  - signale les réponses reçues (« Répondre ») ;
//  - tient à jour une carte « Relances prospection » dans « J'ai besoin de toi » (Tâches).
import { jetonCourriel, autoriserCourriel } from './auth.js';
import { aujourdhui, ajouterJours, joursEntre, prenom } from './ui.js';
import { journaliser, reglages } from './donnees.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const DELAI_RELANCE = 7;
const INTERVALLE = 15 * 60000;
const ID_TACHE = 'relances-prospection';
// Domaines partagés par beaucoup de monde : jamais utilisés pour deviner un prospect.
const PUBLICS = new Set(['gmail.com', 'hotmail.com', 'hotmail.ca', 'live.ca', 'live.com', 'outlook.com', 'msn.com', 'yahoo.com', 'yahoo.ca',
  'icloud.com', 'me.com', 'videotron.ca', 'videotron.qc.ca', 'sogetel.net', 'digicom.qc.ca', 'bell.net', 'sympatico.ca', 'cgocable.ca',
  'globetrotter.net', 'telus.net', 'derytele.com', 'cablevision.qc.ca', 'qc.aira.com', 'georama.ca']);

const cle = (n, ctx) => 'georama-hub-courriel-' + n + ':' + (ctx.courriel || ctx.moi || '').toLowerCase();
function lire(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function ecrire(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* rien */ } }

// État pour l'affichage : 'demo' | 'inactif' | 'actif' | 'erreur'
export function etatCourriel(ctx) {
  if (ctx.mode !== 'm365') return { etat: 'demo' };
  const actif = lire(cle('actif', ctx)) === 'oui';
  const derniere = lire(cle('derniere', ctx));
  const erreur = lire(cle('erreur', ctx));
  return { etat: !actif ? 'inactif' : erreur ? 'erreur' : 'actif', derniere, erreur };
}
export function activerCourriel(ctx) {
  ecrire(cle('actif', ctx), 'oui');
  ecrire(cle('erreur', ctx), '');
  autoriserCourriel();
}
export function desactiverCourriel(ctx) { ecrire(cle('actif', ctx), ''); }

const domaine = a => String(a || '').toLowerCase().split('@')[1] || '';
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

// Index des prospects : par adresse exacte, et par domaine quand le domaine n'appartient qu'à un prospect.
function indexProspects(m) {
  const parAdresse = new Map(), parDomaine = new Map(), compte = new Map();
  m.liste('prospects').forEach(p => {
    String(p.courriel || '').split(/[;,\s]+/).filter(x => x.includes('@')).forEach(a => {
      a = a.toLowerCase();
      parAdresse.set(a, p);
      const d = domaine(a);
      if (d && !PUBLICS.has(d)) { compte.set(d, (compte.get(d) || new Set()).add(p.id)); parDomaine.set(d, p); }
    });
  });
  compte.forEach((ids, d) => { if (ids.size > 1) parDomaine.delete(d); });
  return a => { a = String(a || '').toLowerCase(); return parAdresse.get(a) || parDomaine.get(domaine(a)) || null; };
}

async function lireMessages(depuis) {
  const t = await jetonCourriel();
  const sel = 'id,internetMessageId,subject,sentDateTime,receivedDateTime,from,toRecipients,ccRecipients,webLink,isDraft';
  let url = GRAPH + '/me/messages?$select=' + sel + '&$filter=' + encodeURIComponent('receivedDateTime ge ' + depuis + ' and isDraft eq false')
    + '&$orderby=receivedDateTime desc&$top=100';
  const tous = [];
  for (let page = 0; url && page < 10; page++) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error('Autorisation des courriels refusée (' + r.status + ').'), { code: 'consentement' });
    if (!r.ok) throw new Error('Lecture des courriels impossible (' + r.status + ').');
    const d = await r.json();
    tous.push(...(d.value || []));
    url = d['@odata.nextLink'] || '';
  }
  return tous;
}

let enCours = null;
export function synchroniserCourriels(ctx, force = false) {
  const e = etatCourriel(ctx);
  if (e.etat === 'demo' || e.etat === 'inactif') return Promise.resolve(null);
  if (!force && e.derniere && Date.now() - Date.parse(e.derniere) < INTERVALLE) return Promise.resolve(null);
  if (!enCours) enCours = faire(ctx).finally(() => { enCours = null; });
  return enCours;
}

async function faire(ctx) {
  const m = ctx.m;
  const moi = String(ctx.courriel || '').toLowerCase();
  const kDepuis = cle('depuis', ctx);
  const depuis = lire(kDepuis) || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 19) + 'Z';
  const debut = new Date().toISOString();
  let msgs;
  try {
    msgs = await lireMessages(depuis);
  } catch (err) {
    ecrire(cle('erreur', ctx), err.code === 'consentement' ? 'consentement' : err.message);
    ecrire(cle('derniere', ctx), new Date().toISOString());
    m.avertir('local');
    return { erreur: err.message };
  }
  ecrire(cle('erreur', ctx), '');
  const trouver = indexProspects(m);
  const connus = new Set(m.liste('courriels', true).map(c => c.id));
  const nouveaux = [];
  msgs.forEach(msg => {
    const de = ((msg.from && msg.from.emailAddress && msg.from.emailAddress.address) || '').toLowerCase();
    const envoye = de === moi;
    const autres = envoye ? [].concat(msg.toRecipients || [], msg.ccRecipients || []).map(r => r.emailAddress && r.emailAddress.address) : [de];
    const vus = new Set();
    autres.filter(Boolean).forEach(a => {
      const p = trouver(a);
      if (!p || vus.has(p.id)) return;
      vus.add(p.id);
      const id = 'c' + hash((msg.internetMessageId || msg.id) + '|' + p.id);
      if (connus.has(id)) return;
      connus.add(id);
      nouveaux.push({ id, prospect: p.id, sens: envoye ? 'envoye' : 'recu', date: msg.sentDateTime || msg.receivedDateTime,
        sujet: msg.subject || '', avec: a.toLowerCase(), boite: moi, lien: msg.webLink || '' });
    });
  });
  nouveaux.sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach(c => m.mettre('courriels', c, true));
  appliquer(ctx, nouveaux);
  majTacheRelances(ctx);
  // Une marge d'un jour pour rattraper les messages déplacés ou arrivés en retard.
  ecrire(kDepuis, new Date(Date.parse(debut) - 86400000).toISOString().slice(0, 19) + 'Z');
  ecrire(cle('derniere', ctx), new Date().toISOString());
  m.avertir('local');
  return { nouveaux: nouveaux.length };
}

// Échanges d'un prospect, du plus récent au plus ancien
export function echanges(m, prospectId) {
  return m.liste('courriels').filter(c => c.prospect === prospectId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
export function dernierEchange(m, prospectId) { return echanges(m, prospectId)[0] || null; }

// Prospects qui attendent une relance : dernier échange = envoi, il y a 7 jours ou plus, toujours « Contacté ».
export function aRelancer(m) {
  const auj = aujourdhui();
  return m.liste('prospects').filter(p => p.statut === 'contacte').map(p => ({ p, d: dernierEchange(m, p.id) }))
    .filter(x => x.d && x.d.sens === 'envoye' && joursEntre(x.d.date.slice(0, 10), auj) >= DELAI_RELANCE)
    .sort((a, b) => String(a.d.date).localeCompare(String(b.d.date)));
}

function appliquer(ctx, nouveaux) {
  const m = ctx.m;
  const contactes = [], reponses = [];
  const parProspect = new Map();
  nouveaux.forEach(c => parProspect.set(c.prospect, c));
  parProspect.forEach((c, pid) => {
    const p = m.get('prospects', pid);
    if (!p || ['gagne', 'perdu'].includes(p.statut)) return;
    const dernier = dernierEchange(m, pid);
    if (!dernier || dernier.id !== c.id) return; // un échange plus récent existe déjà
    const jour = c.date.slice(0, 10);
    if (c.sens === 'envoye') {
      const patch = { action: 'Relancer si pas de réponse', prochaine: ajouterJours(jour, DELAI_RELANCE) };
      if (p.statut === 'a_contacter') { patch.statut = 'contacte'; contactes.push(p.organisation); }
      m.modifier('prospects', pid, patch, true);
    } else {
      const patch = { action: 'Répondre (courriel reçu)', prochaine: jour < aujourdhui() ? aujourdhui() : jour };
      if (p.statut === 'a_contacter') patch.statut = 'contacte';
      m.modifier('prospects', pid, patch, true);
      reponses.push(p.organisation);
    }
  });
  if (contactes.length) journaliser(m, (contactes.length === 1 ? contactes[0] + ' passe à « Contacté »' : contactes.length + ' prospects passent à « Contacté » : ' + contactes.slice(0, 6).join(', ') + (contactes.length > 6 ? '…' : '')) + ' (courriel envoyé).', '#/marketing', 'prospect');
  reponses.forEach(o => journaliser(m, 'Réponse reçue de ' + o + '. À toi de jouer.', '#/marketing', 'prospect'));
}

// Une seule carte dans « J'ai besoin de toi », mise à jour à chaque lecture (pas une carte par prospect).
function majTacheRelances(ctx) {
  const m = ctx.m;
  const l = aRelancer(m);
  const t = m.liste('taches', true).find(x => x.id === ID_TACHE);
  const coches = new Set(((t && !t.supprime && t.sous) || []).filter(s => s.f).map(s => s.t));
  const sous = l.map(x => {
    const txt = x.p.organisation + ' (envoyé le ' + x.d.date.slice(0, 10) + ')';
    return { t: txt, f: coches.has(txt) };
  });
  const reste = sous.filter(s => !s.f).length;
  if (!t || t.supprime) {
    if (!reste) return;
    m.mettre('taches', { id: ID_TACHE, titre: '', colonne: 'decisions', cat: 'ventes', qui: '', echeance: aujourdhui(), fait: false, ordre: -1, creePar: 'Hub', creeLe: new Date().toISOString(), sous: [] }, true);
  }
  const avant = m.get('taches', ID_TACHE);
  const titre = reste ? 'Relancer ' + reste + ' prospect' + (reste > 1 ? 's' : '') + ' (pas de réponse depuis ' + DELAI_RELANCE + ' jours)' : 'Relances prospection : tout est à jour';
  const desc = 'Carte tenue à jour par le hub à partir des courriels envoyés.\nPour relancer : Marketing › Prospection, filtre « À relancer », puis le bouton « Relancer » de la fiche.\nCocher une ligne = déjà relancé autrement (téléphone…).';
  const patch = reste
    ? { titre, sous, desc, colonne: 'decisions', fait: false, qui: (l[0] && l[0].p.responsable) || '' }
    : { titre, sous, desc, colonne: 'termine', fait: true, faitLe: new Date().toISOString() };
  if (avant && avant.titre === patch.titre && JSON.stringify(avant.sous || []) === JSON.stringify(sous) && avant.colonne === patch.colonne) return;
  m.modifier('taches', ID_TACHE, patch, true);
}

// Liens pour écrire depuis Outlook avec un modèle.
export function modeleCourriel(ctx, p, relance) {
  const R = reglages(ctx.m);
  const sig = R.signatureCourriel ? R.signatureCourriel.replace('{moi}', ctx.moi).replace('{prenom_moi}', prenom(ctx.moi)) : ctx.moi + '\nGeorama · Changez de perspective\ngeorama.ca';
  const signature = '\n\nAu plaisir,\n' + sig;
  const d = dernierEchange(ctx.m, p.id);
  if (relance) {
    return {
      sujet: d && d.sujet ? (/^re\s*:/i.test(d.sujet) ? d.sujet : 'RE: ' + d.sujet) : 'Suivi : ' + (p.organisation || '') + ' en relief',
      corps: 'Bonjour' + (p.contact ? ' ' + prenom(p.contact) : '') + ',\n\nJe me permets un petit suivi de mon courriel' + (d ? ' du ' + d.date.slice(0, 10) : '') + ' au sujet d’une maquette en relief pour ' + (p.organisation || 'votre territoire') + '. L’aperçu 3D gratuit tient toujours : un simple oui et je vous l’envoie.' + signature,
    };
  }
  return {
    sujet: p.brouillon || ((p.organisation || 'Votre territoire') + ' en relief'),
    corps: 'Bonjour' + (p.contact ? ' ' + prenom(p.contact) : '') + ',\n\nJe m’appelle ' + prenom(ctx.moi) + ', de Georama à Saint-Félicien. Nous fabriquons des maquettes topographiques en relief à partir des données LiDAR du Québec.\n\n'
      + 'Pour vous donner une idée, je peux vous préparer gratuitement un aperçu 3D de votre territoire. Seriez-vous ouvert à un court appel cette semaine ?' + signature,
  };
}
export function lienOutlook(p, mod) {
  return 'https://outlook.office.com/mail/deeplink/compose?to=' + encodeURIComponent(p.courriel || '') + '&subject=' + encodeURIComponent(mod.sujet) + '&body=' + encodeURIComponent(mod.corps);
}
export function lienMailto(p, mod) {
  return 'mailto:' + encodeURIComponent(p.courriel || '').replace(/%40/g, '@') + '?subject=' + encodeURIComponent(mod.sujet) + '&body=' + encodeURIComponent(mod.corps.replace(/\r?\n/g, '\r\n'));
}
