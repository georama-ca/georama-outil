// Stockage des données du hub.
// - Mode démo : dans ce navigateur (localStorage).
// - Mode Microsoft 365 : un fichier JSON par collection dans un dossier OneDrive Georama,
//   partagé entre les membres. Deux personnes peuvent travailler en même temps :
//   chaque fiche garde sa date de mise à jour et la plus récente gagne.
import { jeton } from './auth.js';
import { CONFIG } from '../config.js';

export const COLLECTIONS = ['commandes', 'plaques', 'taches', 'prospects', 'campagnes', 'depenses', 'filament', 'reglages'];
const GRAPH = 'https://graph.microsoft.com/v1.0';

/* ---------- Mode démo ---------- */
export class AdaptateurLocal {
  constructor(prefixe = 'georama-hub-demo:') { this.prefixe = prefixe; this.type = 'demo'; }
  async preparer() { return true; }
  async lire(coll) {
    try { const t = localStorage.getItem(this.prefixe + coll); return { items: t ? JSON.parse(t).items || [] : null, etag: null }; }
    catch (e) { return { items: null, etag: null }; }
  }
  async ecrire(coll, items) {
    try { localStorage.setItem(this.prefixe + coll, JSON.stringify({ items, maj: new Date().toISOString() })); } catch (e) { throw new Error('Le navigateur refuse d’enregistrer.'); }
    return { etag: null };
  }
  vider() { COLLECTIONS.forEach(c => { try { localStorage.removeItem(this.prefixe + c); } catch (e) { /* rien */ } }); }
}

/* ---------- Mode Microsoft 365 (OneDrive) ---------- */
const CLE_LIEU = 'georama-hub-lieu';
export function lireLieu() { try { return JSON.parse(localStorage.getItem(CLE_LIEU) || 'null'); } catch (e) { return null; } }
export function ecrireLieu(l) { try { if (l) localStorage.setItem(CLE_LIEU, JSON.stringify(l)); else localStorage.removeItem(CLE_LIEU); } catch (e) { /* rien */ } }

async function graph(chemin, opts = {}) {
  const t = await jeton();
  const r = await fetch(chemin.startsWith('http') ? chemin : GRAPH + chemin, Object.assign({}, opts, {
    headers: Object.assign({ Authorization: 'Bearer ' + t }, opts.headers || {}),
  }));
  return r;
}
function cheminEncode(p) { return p.split('/').filter(Boolean).map(encodeURIComponent).join('/'); }
function encoderPartage(url) {
  const b = btoa(unescape(encodeURIComponent(url.trim()))).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  return 'u!' + b;
}

export class AdaptateurOneDrive {
  constructor() { this.type = 'onedrive'; this.lieu = lireLieu(); this.etags = {}; }

  // Trouve (ou crée) le dossier des données dans le OneDrive de la personne connectée.
  async creerDansMonOneDrive(dossier = CONFIG.dossier) {
    const p = cheminEncode(dossier);
    let r = await graph('/me/drive/root:/' + p);
    if (r.status === 404) {
      const lis = 'Dossier des données du Hub Georama.\r\nNe pas renommer ni déplacer les fichiers .json.\r\nPour donner accès à une autre personne : partager ce dossier (modification), puis coller le lien dans Paramètres du hub.\r\n';
      const c = await graph('/me/drive/root:/' + p + '/LISEZMOI.txt:/content', { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: lis });
      if (!c.ok) throw new Error('Impossible de créer le dossier (' + c.status + ').');
      r = await graph('/me/drive/root:/' + p);
    }
    if (!r.ok) throw new Error('Dossier introuvable (' + r.status + ').');
    const it = await r.json();
    this.lieu = { driveId: it.parentReference.driveId, itemId: it.id, nom: dossier, webUrl: it.webUrl };
    ecrireLieu(this.lieu);
    return this.lieu;
  }

  // Utilise un dossier partagé par une autre personne (lien de partage OneDrive).
  async utiliserLienPartage(url) {
    const r = await graph('/shares/' + encoderPartage(url) + '/driveItem', { headers: { Prefer: 'redeemSharingLink' } });
    if (!r.ok) throw new Error(r.status === 403 || r.status === 404 ? 'Ce lien ne donne pas accès au dossier. Demande un lien « modification » pour les personnes de Georama.' : 'Lien refusé (' + r.status + ').');
    const it = await r.json();
    if (!it.folder) throw new Error('Ce lien mène à un fichier, pas à un dossier.');
    this.lieu = { driveId: it.parentReference.driveId, itemId: it.id, nom: it.name, webUrl: it.webUrl, partage: true };
    ecrireLieu(this.lieu);
    return this.lieu;
  }

  async preparer() {
    if (this.lieu && this.lieu.driveId) return true;
    await this.creerDansMonOneDrive();
    return true;
  }

  base(coll) { return '/drives/' + encodeURIComponent(this.lieu.driveId) + '/items/' + encodeURIComponent(this.lieu.itemId) + ':/' + coll + '.json:'; }

  async lire(coll) {
    const r = await graph(this.base(coll));
    if (r.status === 404) { this.etags[coll] = null; return { items: null, etag: null }; }
    if (!r.ok) throw new Error('Lecture de ' + coll + ' refusée (' + r.status + ').');
    const meta = await r.json();
    const url = meta['@microsoft.graph.downloadUrl'];
    let contenu;
    if (url) {
      const f = await fetch(url, { cache: 'no-store' });
      contenu = await f.json();
    } else {
      const f = await graph(this.base(coll) + '/content');
      contenu = await f.json();
    }
    this.etags[coll] = meta.eTag;
    return { items: (contenu && contenu.items) || [], etag: meta.eTag };
  }

  async ecrire(coll, items, etag) {
    const h = { 'Content-Type': 'application/json' };
    if (etag) h['If-Match'] = etag; else h['If-None-Match'] = '*';
    const r = await graph(this.base(coll) + '/content', {
      method: 'PUT', headers: h,
      body: JSON.stringify({ items, maj: new Date().toISOString(), version: CONFIG.version }, null, 1),
    });
    if (r.status === 412 || r.status === 409) { const e = new Error('conflit'); e.conflit = true; throw e; }
    if (!r.ok) throw new Error('Enregistrement de ' + coll + ' refusé (' + r.status + ').');
    const it = await r.json();
    this.etags[coll] = it.eTag;
    return { etag: it.eTag };
  }
}

/* ---------- Magasin ---------- */
// Fusionne deux listes de fiches par identifiant : la fiche la plus récente (champ maj) gagne.
export function fusionner(a, b) {
  const m = new Map();
  (a || []).forEach(x => m.set(x.id, x));
  (b || []).forEach(x => {
    const y = m.get(x.id);
    if (!y || String(x.maj || '') >= String(y.maj || '')) m.set(x.id, x);
  });
  return Array.from(m.values());
}

export class Magasin {
  constructor(adaptateur, utilisateur) {
    this.a = adaptateur;
    this.qui = utilisateur;
    this.donnees = {};
    this.etags = {};
    this.sales = {};
    this.minuteries = {};
    this.ecouteurs = new Set();
    this.etat = 'pret';
    this.erreur = '';
    this.derniere = null;
    COLLECTIONS.forEach(c => { this.donnees[c] = []; this.sales[c] = new Set(); });
  }
  abonner(fn) { this.ecouteurs.add(fn); return () => this.ecouteurs.delete(fn); }
  avertir(source) { this.ecouteurs.forEach(fn => { try { fn(source); } catch (e) { console.error(e); } }); }
  changerEtat(etat, erreur = '') { this.etat = etat; this.erreur = erreur; if (etat === 'pret') this.derniere = new Date(); this.avertir('etat'); }

  async charger() {
    this.changerEtat('attente');
    await this.a.preparer();
    const vides = [];
    await Promise.all(COLLECTIONS.map(async c => {
      const { items, etag } = await this.a.lire(c);
      if (items === null) vides.push(c);
      this.donnees[c] = items || [];
      this.etags[c] = etag;
    }));
    this.changerEtat('pret');
    return { vides };
  }

  // Relit le stockage (changements de l'autre personne) sans écraser ce qui n'est pas encore envoyé.
  async rafraichir() {
    if (this.a.type === 'demo' || this.etat === 'attente') return false;
    if (COLLECTIONS.some(c => this.sales[c].size)) return false;
    let change = false;
    try {
      for (const c of COLLECTIONS) {
        const { items, etag } = await this.a.lire(c);
        if (etag && etag === this.etags[c]) continue;
        const avant = JSON.stringify(this.donnees[c]);
        this.donnees[c] = fusionner(this.donnees[c], items || []);
        this.etags[c] = etag;
        if (JSON.stringify(this.donnees[c]) !== avant) change = true;
      }
      this.changerEtat('pret');
    } catch (e) {
      this.changerEtat('erreur', e.message);
    }
    if (change) this.avertir('distant');
    return change;
  }

  liste(c, avecSupprimes = false) { return this.donnees[c].filter(x => avecSupprimes || !x.supprime); }
  get(c, id) { return this.donnees[c].find(x => x.id === id && !x.supprime) || null; }

  mettre(c, item, silencieux = false) {
    const fiche = Object.assign({}, item, { maj: new Date().toISOString(), par: this.qui });
    const i = this.donnees[c].findIndex(x => x.id === fiche.id);
    if (i >= 0) this.donnees[c][i] = Object.assign({}, this.donnees[c][i], fiche);
    else this.donnees[c].push(fiche);
    this.sales[c].add(fiche.id);
    this.planifier(c);
    if (!silencieux) this.avertir('local');
    return this.get(c, fiche.id);
  }
  modifier(c, id, patch, silencieux = false) {
    const x = this.get(c, id);
    if (!x) return null;
    return this.mettre(c, Object.assign({}, x, patch), silencieux);
  }
  supprimer(c, id) {
    const i = this.donnees[c].findIndex(x => x.id === id);
    if (i < 0) return;
    this.donnees[c][i] = { id, supprime: true, maj: new Date().toISOString(), par: this.qui };
    this.sales[c].add(id);
    this.planifier(c);
    this.avertir('local');
  }
  remplacerTout(c, items) {
    this.donnees[c] = items.map(x => Object.assign({}, x, { maj: x.maj || new Date().toISOString() }));
    this.donnees[c].forEach(x => this.sales[c].add(x.id));
    this.planifier(c);
  }

  planifier(c) {
    clearTimeout(this.minuteries[c]);
    this.minuteries[c] = setTimeout(() => this.envoyer(c), this.a.type === 'demo' ? 50 : 800);
  }

  async envoyer(c, essai = 0) {
    if (!this.sales[c].size) return;
    const envoyes = new Set(this.sales[c]);
    this.changerEtat('attente');
    try {
      let liste = this.donnees[c];
      let etag = this.etags[c];
      if (this.a.type !== 'demo') {
        // Relire juste avant d'écrire pour garder les changements de l'autre personne.
        // Fiche par fiche, la plus récente gagne (la nôtre en cas d'égalité).
        const distant = await this.a.lire(c);
        etag = distant.etag;
        this.donnees[c] = fusionner(distant.items || [], this.donnees[c]);
        liste = this.donnees[c];
      }
      // Les fiches supprimées depuis plus de 60 jours sont oubliées.
      const limite = new Date(Date.now() - 60 * 86400000).toISOString();
      liste = liste.filter(x => !(x.supprime && String(x.maj) < limite));
      const r = await this.a.ecrire(c, liste, etag);
      this.etags[c] = r.etag;
      envoyes.forEach(id => this.sales[c].delete(id));
      this.changerEtat(COLLECTIONS.some(k => this.sales[k].size) ? 'attente' : 'pret');
    } catch (e) {
      if (e.conflit && essai < 3) return this.envoyer(c, essai + 1);
      console.error(e);
      this.changerEtat('erreur', e.message);
      clearTimeout(this.minuteries[c]);
      this.minuteries[c] = setTimeout(() => this.envoyer(c), 15000);
    }
  }

  enAttente() { return COLLECTIONS.some(c => this.sales[c].size); }

  exporter() {
    const o = { hub: 'Georama', version: CONFIG.version, exporte: new Date().toISOString(), donnees: {} };
    COLLECTIONS.forEach(c => { o.donnees[c] = this.liste(c); });
    return o;
  }
  importer(obj) {
    if (!obj || !obj.donnees) throw new Error('Fichier de sauvegarde non reconnu.');
    COLLECTIONS.forEach(c => {
      const items = obj.donnees[c];
      if (!Array.isArray(items)) return;
      this.donnees[c] = fusionner(this.donnees[c], items);
      items.forEach(x => this.sales[c].add(x.id));
      this.planifier(c);
    });
    this.avertir('local');
  }
}
