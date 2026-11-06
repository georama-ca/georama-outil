// Agent de démonstration : imite l'ordi de la maison en mode démo
// (signal « en ligne », état de l'imprimante, travaux .3mf et rendu, une commande du site).
import { avancement, heuresRestantes, fileImpression } from './donnees.js';

const P = 'georama-hub-demo:';
const lire = k => { try { return JSON.parse(localStorage.getItem(P + k) || 'null'); } catch (e) { return null; } };
const ecrire = (k, items) => { try { localStorage.setItem(P + k, JSON.stringify({ items, maj: new Date().toISOString() })); } catch (e) { /* rien */ } };
const lireFichiers = () => { try { return JSON.parse(localStorage.getItem(P + 'fichiers') || '{}'); } catch (e) { return {}; } };
const ecrireFichiers = f => { try { localStorage.setItem(P + 'fichiers', JSON.stringify(f)); } catch (e) { /* rien */ } };
const IMG = 'demo/rendu-exemple.png';

function ajouterFichier(dossier, nom, image) {
  const f = lireFichiers();
  f[dossier] = (f[dossier] || []).filter(x => x.nom !== nom).concat([{ nom, image, url: image ? IMG : '', taille: image ? 195174 : 4800000, maj: new Date().toISOString(), demo: true }]);
  ecrireFichiers(f);
}

let derniereSignature = '', derniereEcriture = 0;
function signal(m) {
  const imp = fileImpression(m).find(p => p.statut === 'imp' && p.imprimante === 'h2c');
  const resultats = (lire('travaux-resultats') || {}).items || [];
  const enCours = resultats.find(r => r.statut === 'en_cours');
  // N'écrire que si quelque chose change, ou une fois par minute (évite de tout redessiner sans cesse)
  const sig = JSON.stringify([imp && imp.id, imp && Math.round(avancement(imp) * 100), enCours && enCours.id]);
  if (sig === derniereSignature && Date.now() - derniereEcriture < 60000) return;
  derniereSignature = sig;
  derniereEcriture = Date.now();
  ecrire('agent', [{
    id: 'maison', nom: 'Ordi de la maison (démo)', machine: 'PC-GEORAMA', version: '1.0', vu: new Date().toISOString(),
    demarre: new Date(Date.now() - 3 * 86400000).toISOString(),
    capacites: { rendu: true, '3mf': true, imprimantes: true, wix: true },
    travail: enCours ? enCours.message : null,
    imprimantes: [imp ? {
      id: 'h2c', connecte: true, etat: 'RUNNING', pct: Math.round(avancement(imp) * 100), resteMin: Math.round(heuresRestantes(imp) * 60),
      couche: Math.round(avancement(imp) * 312), couches: 312, fichier: 'plaque-' + imp.n + '.3mf', buse: 250, plateau: 70, vu: new Date().toISOString(),
    } : { id: 'h2c', connecte: true, etat: 'IDLE', pct: 0, vu: new Date().toISOString() }],
  }]);
}

function travailler(m) {
  const res = (lire('travaux-resultats') || {}).items || [];
  const parId = new Map(res.map(r => [r.id, r]));
  let change = false;
  m.liste('travaux').forEach(t => {
    const c = m.get('commandes', t.commande) || {};
    const dossier = 'commandes/' + String(c.numero || t.numero || '').replace(/[^A-Za-z0-9_-]/g, '');
    const r = parId.get(t.id);
    if (!r) {
      parId.set(t.id, { id: t.id, type: t.type, commande: t.commande, statut: 'en_cours', debut: new Date().toISOString(), message: t.type === '3mf' ? 'Georama Production travaille… (démo)' : 'Rendu 3D en cours… (démo)' });
      change = true;
    } else if (r.statut === 'en_cours' && Date.now() - new Date(r.debut).getTime() > 4000) {
      if (t.type === '3mf') {
        ajouterFichier(dossier, 'plaque-1.3mf', false);
        ajouterFichier(dossier, 'plaque-1-rendu.png', true);
        Object.assign(r, { statut: 'fait', fin: new Date().toISOString(), fichiers: ['plaque-1.3mf'], message: '1 fichier .3mf produit (démo). Le rendu a suivi.' });
      } else {
        ajouterFichier(dossier, 'plaque-1-rendu.png', true);
        Object.assign(r, { statut: 'fait', fin: new Date().toISOString(), fichiers: ['plaque-1-rendu.png'], message: 'plaque-1.3mf : 5 pièces, 114 412 triangles, 7 s (démo)' });
      }
      change = true;
    }
  });
  if (change) ecrire('travaux-resultats', Array.from(parId.values()));
}

export function demarrerAgentDemo(m) {
  if (!lire('fichiers-init')) {
    ajouterFichier('commandes/G-2026-041', 'plaque-A1.3mf', false);
    ajouterFichier('commandes/G-2026-041', 'plaque-A1-rendu.png', true);
    ecrire('travaux-resultats', [{ id: 'auto-G-2026-041-plaque-A1', type: 'rendu', commande: 'c41', statut: 'fait', debut: new Date(Date.now() - 86400000).toISOString(), fin: new Date(Date.now() - 86390000).toISOString(), fichiers: ['plaque-A1-rendu.png'], message: 'Rendu automatique : plaque-A1.3mf (démo)' }]);
    ecrire('boite-wix', [{
      id: 'demo-10031-1', wixId: 'demo-10031', wixNumero: '10031', date: new Date().toISOString(), client: 'Gabriel Roy', courriel: 'gabriel@exemple.ca',
      lien: 'https://www.georama.ca/zone?p=peche&g=sapiniere', segment: 'peche', gamme: 'Sapinière', produit: 'signature', prix: 250, livraison: 'postes', payee: true,
      article: 'Lac Kénogami · Signature 10 × 12 po',
    }]);
    try { localStorage.setItem(P + 'fichiers-init', '"1"'); } catch (e) { /* rien */ }
  }
  const tour = async () => { signal(m); travailler(m); await m.rafraichir(); };
  tour();
  setInterval(tour, 2000);
}
