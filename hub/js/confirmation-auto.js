// Confirmation automatique des commandes régulières du site (v1.14).
// Quand le hub est ouvert avec le compte d'envoi (info@georama.ca par défaut), chaque nouvelle commande
// du site (G-…) reçoit un courriel de confirmation avec le PDF client de Georama Production :
// ce qui sera imprimé, le délai avant l'entrée en production et la durée d'impression.
// Le courriel part dès que le PDF « Confirmation_Georama_<numéro>.pdf » est dans le dossier de la commande.
import { reglages, dossierCommande, journaliser } from './donnees.js';
import { modeles, remplir, envoyerGraph, estCommandeSite } from './courriels.js';

const MAX_PDF = 2.9 * 1024 * 1024;   // Graph : envoi simple d'environ 3 Mo de pièces jointes au plus
const VERROU = 'georama-hub-confirmation:';
let enCours = false;

export function compteEnvoi(m) { return String(reglages(m).courrielConfirmation || 'info@georama.ca').trim().toLowerCase(); }
export function sessionEnvoi(ctx) { return ctx.mode === 'm365' && String(ctx.courriel || '').trim().toLowerCase() === compteEnvoi(ctx.m); }

function aConfirmer(m, c) {
  const R = reglages(m);
  if (!estCommandeSite(c) || !c.courriel || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.courriel)) return false;
  if (['annulee', 'livree', 'expediee'].includes(c.statut)) return false;
  if ((c.recue || '') < (R.confirmationAutoDepuis || '2026-11-13')) return false;   // pas les commandes d'avant
  if ((c.courriels || []).some(e => e.modele === 'confirmation' || e.modele === 'recue')) return false;
  const a = c.confirmationAuto || {};
  if (a.erreur && (a.essais || 0) >= 3) return false;
  return true;
}

function verrou(id) {
  try {
    const t = Number(localStorage.getItem(VERROU + id)) || 0;
    if (Date.now() - t < 10 * 60000) return false;
    localStorage.setItem(VERROU + id, String(Date.now()));
    return true;
  } catch (e) { return true; }
}

export async function confirmationsAuto(ctx) {
  const m = ctx.m;
  if (enCours || !m || !sessionEnvoi(ctx) || reglages(m).confirmationAuto === false || !m.a.lister) return;
  const liste = m.liste('commandes').filter(c => aConfirmer(m, c));
  if (!liste.length) return;
  enCours = true;
  try {
    for (const c of liste) {
      let fichiers = [];
      try { fichiers = await m.a.lister(dossierCommande(c)); } catch (e) { continue; }
      const nomPdf = 'Confirmation_Georama_' + String(c.numero || '').replace(/[^\w-]/g, '_') + '.pdf';
      const pdf = fichiers.find(f => f.nom === nomPdf && String(f.maj || '') >= (c.recue || ''));
      if (!pdf) continue;                                  // l'ordi de la maison ne l'a pas encore fait
      const actuel = m.get('commandes', c.id);
      if (!actuel || !aConfirmer(m, actuel) || !verrou(c.id)) continue;
      const essais = ((actuel.confirmationAuto || {}).essais || 0) + 1;
      if (pdf.taille > MAX_PDF) {
        m.modifier('commandes', c.id, { confirmationAuto: { erreur: 'le PDF dépasse 3 Mo ; envoie-la à la main sans le PDF ou avec une version plus légère', essais: 3, le: new Date().toISOString() } }, true);
        m.avertir('local');
        continue;
      }
      const mod = modeles(m).find(x => x.id === 'confirmation');
      try {
        await envoyerGraph(m, actuel, { a: actuel.courriel.trim(), objet: remplir(mod.objet, actuel, ctx), corps: remplir(mod.corps, actuel, ctx), pieces: [nomPdf] });
        const frais = m.get('commandes', c.id) || actuel;
        const courriels = (frais.courriels || []).concat([{ modele: 'confirmation', le: new Date().toISOString(), par: ctx.moi, comment: 'envoye', auto: true }]);
        m.modifier('commandes', c.id, { courriels, confirmationAuto: { envoyee: new Date().toISOString(), essais } }, true);
        journaliser(m, 'Confirmation envoyée toute seule à ' + actuel.client + ' (' + actuel.numero + ') avec le PDF, depuis ' + compteEnvoi(m), '#/production/fiche/' + c.id, 'courriel');
        m.avertir('local');
        ctx.toast('Confirmation envoyée à ' + actuel.client + ' (' + actuel.numero + ').');
      } catch (e) {
        const msg = e.code === 'consentement' ? 'il manque l’autorisation d’envoyer des courriels : Paramètres › Courriels aux clients › « Donner l’autorisation d’envoyer »' : (e.message || 'envoi impossible');
        m.modifier('commandes', c.id, { confirmationAuto: { erreur: msg, essais: e.code === 'consentement' ? 0 : essais, le: new Date().toISOString() } }, true);
        m.avertir('local');
        try { localStorage.removeItem(VERROU + c.id); } catch (x) { /* rien */ }
        if (e.code === 'consentement') break;
      }
    }
  } finally { enCours = false; }
}
