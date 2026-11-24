// Reçus consignés tout seuls (v1.16.0).
// Le hub lit le dossier des reçus du OneDrive Georama (par défaut 05_Finances_et_Comptabilite/05_Reçus_2026,
// sous-dossiers compris) : chaque nouveau PDF devient une dépense « À vérifier » avec le fournisseur, la date,
// le montant avant taxes, la TPS, la TVQ et le reçu joint. Deux copies du même reçu ne comptent qu'une fois ;
// un reçu déjà entré à la main est relié à sa dépense au lieu d'en créer une deuxième.
import { reglages, journaliser } from './donnees.js';
import { lireRecu, cleRecu } from './recus-lecture.js';

export const DOSSIER_RECUS = '05_Finances_et_Comptabilite/05_Reçus_2026';
const CLE_VUS = 'georama-hub-recus-vus';
const EXT = /\.(pdf|jpe?g|png|webp|heic)$/i;
let enCours = false;
export const etatRecus = { dernier: '', erreur: '', sansAcces: false, ajoutes: 0, relies: 0, doublons: 0, fichiers: 0, enCours: false };

export function dossierRecus(m) { return String(reglages(m).dossierRecus || DOSSIER_RECUS).replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''); }
function lireVus() { try { return JSON.parse(localStorage.getItem(CLE_VUS) || '{}') || {}; } catch (e) { return {}; } }
function ecrireVus(v) { try { localStorage.setItem(CLE_VUS, JSON.stringify(v)); } catch (e) { /* rien */ } }

let pdfjs = null;
async function textePdf(buf) {
  if (!pdfjs) {
    pdfjs = await import('../vendor/pdfjs-6.2.108/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs-6.2.108/pdf.worker.min.mjs', import.meta.url).href;
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const lignes = [];
  for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    let l = '';
    for (const it of tc.items) { l += it.str; if (it.hasEOL) { lignes.push(l); l = ''; } else l += ' '; }
    if (l.trim()) lignes.push(l);
  }
  try { doc.destroy(); } catch (e) { /* rien */ }
  return lignes.join('\n');
}

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const premierMot = s => norm(s).split(/[\s(]/).filter(Boolean)[0] || '';
const memeFournisseur = (a, b) => { const x = premierMot(a), y = premierMot(b); return !!x && !!y && (norm(b).includes(x) || norm(a).includes(y)); };
const ecartJours = (a, b) => (a && b) ? Math.abs(new Date(a) - new Date(b)) / 864e5 : 0;
const court = n => n.length > 34 ? n.slice(0, 22) + '…' + n.slice(-8) : n;
const totalDe = d => (Number(d.montant) || 0) + (Number(d.tps) || 0) + (Number(d.tvq) || 0);

// Traite une liste de fichiers. lireTexte(f) rend le texte du PDF (ou '' si illisible). Rend le bilan.
export async function traiterRecus(m, fichiers, lireTexte, { force = false, vus = {} } = {}) {
  const R = reglages(m);
  const ignores = new Set(R.recusIgnores || []);
  const bilan = { ajoutes: 0, relies: 0, doublons: 0, illisibles: 0, nouveaux: [] };
  const existants = () => m.liste('depenses');
  const cles = new Set(existants().map(d => d.recu && d.recu.cle).filter(Boolean));
  const items = new Set(existants().map(d => d.recu && d.recu.itemId).filter(Boolean));
  // Les originaux avant les copies « (1) »
  const tries = fichiers.filter(f => EXT.test(f.nom)).sort((a, b) => /\(\d+\)\.[^.]+$/.test(a.nom) - /\(\d+\)\.[^.]+$/.test(b.nom) || String(a.nom).localeCompare(b.nom));
  for (const f of tries) {
    if (!force && vus[f.id] && vus[f.id] === f.etag) continue;
    if (items.has(f.id)) { vus[f.id] = f.etag; continue; }
    let r = lireRecu('', f.nom);
    if (/\.pdf$/i.test(f.nom)) { try { r = lireRecu(await lireTexte(f), f.nom); } catch (e) { /* illisible : à compléter à la main */ } }
    const cle = r.lu ? cleRecu(r, f.nom) : 'recu-f-' + String(f.id).replace(/[^\w-]/g, '').slice(-16);
    if (ignores.has(cle)) { vus[f.id] = f.etag; continue; }
    if (cles.has(cle)) { bilan.doublons++; vus[f.id] = f.etag; continue; }
    const recu = { cle, itemId: f.id, nom: f.nom, webUrl: f.webUrl || '', numero: r.numero || '', total: r.total, date: r.date || '' };
    // Déjà entrée à la main (même fournisseur, même total à 1 $ près, moins de 4 mois d'écart) : on relie.
    if (r.lu) {
      const tol = Math.max(1, r.total * 0.005);
      const pareille = existants().find(d => !d.recu && !d.auto && memeFournisseur(d.fournisseur, r.fournisseur) && Math.abs(totalDe(d) - r.total) <= tol && ecartJours(d.date, r.date) <= 120);
      if (pareille) {
        const patch = { recu };
        if (r.date && pareille.date !== r.date) { patch.aVerifier = true; patch.dateRecu = r.date; }
        m.modifier('depenses', pareille.id, patch, true);
        cles.add(cle); items.add(f.id); vus[f.id] = f.etag; bilan.relies++;
        continue;
      }
    }
    const desc = r.description ? r.description + ' · ' : '';
    const d = {
      id: cle, source: 'recu', aVerifier: true,
      date: r.date || String(f.maj || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      fournisseur: r.fournisseur || f.nom.replace(/\.[^.]+$/, ''), categorie: r.categorie || 'Autre',
      montant: r.montant || 0, tps: r.tps || 0, tvq: r.tvq || 0, taxesAuto: false,
      note: r.lu ? desc + 'Lu dans le reçu ' + court(f.nom) + (r.numero ? ' (no ' + r.numero + ')' : '') : 'Reçu ' + court(f.nom) + ' : montant pas lu, à entrer',
      recu, facture: { webUrl: f.webUrl || '', nom: f.nom, recu: true, type: f.type || '', ajoutee: new Date().toISOString() },
    };
    if (r.periodeFin) d.periodeFin = r.periodeFin;
    if (!r.lu) bilan.illisibles++;
    m.mettre('depenses', d, true);
    cles.add(cle); items.add(f.id); vus[f.id] = f.etag; bilan.ajoutes++; bilan.nouveaux.push(d);
  }
  return bilan;
}

export async function lireRecusAuto(ctx, { force = false, manuel = false } = {}) {
  const m = ctx.m;
  if (enCours || !m || !m.a || !m.a.listerDrive) { if (manuel && m && !m.a.listerDrive) ctx.toast('La lecture des reçus demande une session Microsoft (pas la démo).', true); return null; }
  if (!manuel && reglages(m).recusAuto === false) return null;
  enCours = true; etatRecus.enCours = true;
  try {
    // v1.16.1 : d'abord par l'identifiant du dossier noté dans reglages (marche pour un compte à qui le dossier est partagé),
    // sinon par son chemin dans le OneDrive (compte propriétaire : info@).
    const R0 = reglages(m);
    const refNotee = R0.recusRef && R0.recusRef.dossier === dossierRecus(m) ? R0.recusRef : null;
    let fichiers;
    try { fichiers = await m.a.listerDrive(dossierRecus(m), 2, refNotee); }
    catch (e) { if (!refNotee) throw e; fichiers = await m.a.listerDrive(dossierRecus(m), 2, null); }
    if (fichiers.ref && (!refNotee || refNotee.itemId !== fichiers.ref.itemId)) {
      m.mettre('reglages', Object.assign({}, reglages(m), { id: 'general', recusRef: { dossier: dossierRecus(m), driveId: fichiers.ref.driveId, itemId: fichiers.ref.itemId } }), true);
    }
    const vus = force ? {} : lireVus();
    const bilan = await traiterRecus(m, fichiers, async f => {
      if (!f.url || f.taille > 20 * 1048576) return '';
      const rep = await fetch(f.url);
      if (!rep.ok) return '';
      return textePdf(await rep.arrayBuffer());
    }, { force, vus });
    ecrireVus(vus);
    Object.assign(etatRecus, { dernier: new Date().toISOString(), erreur: '', sansAcces: false, fichiers: fichiers.length, ajoutes: bilan.ajoutes, relies: bilan.relies, doublons: bilan.doublons });
    // État partagé (vu par les autres comptes) : à chaque ajout, sinon au plus une fois l'heure
    const E = reglages(m).recusEtat || {};
    if (bilan.ajoutes || bilan.relies || !E.le || Date.now() - new Date(E.le) > 3600000) {
      m.mettre('reglages', Object.assign({}, reglages(m), { id: 'general', recusEtat: { le: etatRecus.dernier, par: ctx.courriel || ctx.moi || '', fichiers: fichiers.length } }), true);
    }
    if (bilan.ajoutes || bilan.relies) {
      m.avertir('local');
      journaliser(m, bilan.ajoutes + ' reçu' + (bilan.ajoutes > 1 ? 's' : '') + ' ajouté' + (bilan.ajoutes > 1 ? 's' : '') + ' aux dépenses' + (bilan.relies ? ', ' + bilan.relies + ' relié' + (bilan.relies > 1 ? 's' : '') + ' à une dépense déjà entrée' : '') + ' (dossier des reçus)', '#/finances/depenses', 'depense');
      ctx.toast(bilan.ajoutes + ' reçu' + (bilan.ajoutes > 1 ? 's' : '') + ' ajouté' + (bilan.ajoutes > 1 ? 's' : '') + ' aux dépenses, à vérifier dans Finances › Dépenses.');
    } else if (manuel) ctx.toast('Aucun nouveau reçu (' + fichiers.length + ' fichier' + (fichiers.length > 1 ? 's' : '') + ' dans le dossier).');
    return bilan;
  } catch (e) {
    // Compte sans accès au dossier (ex. charles@ : seul Hub-Georama lui est partagé) : pas une erreur, c'est la session info@ qui lit.
    etatRecus.sansAcces = e.code === 'acces' || e.code === 'introuvable';
    etatRecus.erreur = etatRecus.sansAcces ? '' : (e.message || 'lecture impossible');
    etatRecus.dernier = new Date().toISOString();
    if (manuel) ctx.toast(etatRecus.sansAcces ? 'Ce compte n’a pas accès au dossier des reçus : ils sont lus par le hub ouvert avec info@.' : 'Reçus : ' + etatRecus.erreur, true);
    return null;
  } finally { enCours = false; etatRecus.enCours = false; if (manuel) ctx.rendre && ctx.rendre(); }
}
