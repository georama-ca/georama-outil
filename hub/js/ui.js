// Petits outils d'affichage : échappement, formats québécois, icônes, messages, fenêtre.

export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const nf0 = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 1 });

export const nombre = (n, dec = 0) => (dec === 1 ? nf1 : dec === 2 ? nf2 : nf0).format(Number(n) || 0);
export const argent = (n, dec = 0) => (dec ? nf2 : nf0).format(Number(n) || 0) + ' $';
export const pct = n => nf0.format(Math.round(Number(n) || 0)) + ' %';

export function aujourdhui() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function versDate(iso) {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) { const [a, m, j] = iso.split('-').map(Number); return new Date(a, m - 1, j); }
  const d = new Date(iso);
  return isNaN(d) ? null : d;
}
export function isoJour(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function ajouterJours(iso, n) {
  const d = versDate(iso) || new Date();
  d.setDate(d.getDate() + n);
  return isoJour(d);
}
export function joursEntre(isoA, isoB) {
  const a = versDate(isoA), b = versDate(isoB);
  if (!a || !b) return 0;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}
export function dateCourte(iso) {
  const d = versDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}
export function dateLongue(iso) {
  const d = versDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function dateHeure(iso) {
  const d = versDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + d.getHours() + ' h ' + String(d.getMinutes()).padStart(2, '0');
}
export function heures(h) {
  const t = Math.max(0, Number(h) || 0);
  const hh = Math.floor(t), mm = Math.round((t - hh) * 60);
  if (mm === 60) return (hh + 1) + ' h';
  return hh + ' h' + (mm ? ' ' + String(mm).padStart(2, '0') : '');
}
export function initiales(nom) {
  if (!nom) return '?';
  const p = String(nom).trim().split(/[\s-]+/).filter(Boolean);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
export function prenom(nom) { return String(nom || '').trim().split(/\s+/)[0] || ''; }

export function uid(prefixe = '') {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return prefixe + Date.now().toString(36) + Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 8);
}

// Icônes au trait (style Georama : trait 2, bouts arrondis)
const P = {
  accueil: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  commandes: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  production: '<path d="M12 3 21 8 12 13 3 8z"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5"/>',
  marketing: '<path d="M4 10v4h3l6 4V6L7 10z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  finances: '<path d="M4 19h16"/><path d="M7 16V10M12 16V6M17 16v-4"/>',
  reglages: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  haut: '<path d="m6 15 6-6 6 6"/>',
  bas: '<path d="m6 9 6 6 6-6"/>',
  fermer: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chrono: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/>',
  crayon: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  poubelle: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  loupe: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  maison: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>',
  fichier: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  dossier: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  eclair: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
};
export function ico(nom) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nom] || ''}</svg>`;
}

export function toast(message, erreur = false) {
  const zone = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (erreur ? ' erreur' : '');
  el.textContent = message;
  zone.appendChild(el);
  setTimeout(() => el.remove(), erreur ? 7000 : 3500);
}

// Fenêtre (dialog natif). contenu = HTML du corps ; onSubmit reçoit un objet des champs.
export function ouvrirFenetre({ titre, corps, pied, onSubmit, onAction, large }) {
  const d = document.getElementById('modal');
  d.style.width = large ? 'min(980px, calc(100vw - 24px))' : '';
  d.innerHTML = `<form method="dialog" id="modal-form" novalidate>
    <div class="modal-tete"><h2 id="modal-titre">${esc(titre)}</h2>
      <button type="button" class="btn-ico" data-fermer aria-label="Fermer">${ico('fermer')}</button></div>
    <div class="modal-corps">${corps}</div>
    ${pied === false ? '' : `<div class="modal-pied">${pied || ''}<div class="droite">
      <button type="button" class="btn-2" data-fermer>Annuler</button>
      <button type="submit" class="btn" value="ok">Enregistrer</button></div></div>`}
  </form>`;
  const form = d.querySelector('form');
  d.querySelectorAll('[data-fermer]').forEach(b => b.addEventListener('click', () => d.close()));
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = typeof v === 'string' ? v.trim() : v; });
    form.querySelectorAll('input[type=checkbox][name]').forEach(c => { data[c.name] = c.checked; });
    const r = onSubmit ? onSubmit(data, form) : true;
    if (r !== false) d.close();
  });
  if (onAction) {
    d.querySelectorAll('[data-modal-act]').forEach(b => b.addEventListener('click', () => {
      const r = onAction(b.getAttribute('data-modal-act'), form, b);
      if (r === 'fermer') d.close();
    }));
  }
  d.showModal();
  const premier = d.querySelector('.modal-corps input:not([type=hidden]), .modal-corps select, .modal-corps textarea');
  if (premier) premier.focus();
  return { dialog: d, form };
}
export function fermerFenetre() { const d = document.getElementById('modal'); if (d.open) d.close(); }

export function options(liste, valeur, vide) {
  return (vide !== undefined ? `<option value="">${esc(vide)}</option>` : '') +
    liste.map(o => {
      const id = typeof o === 'string' ? o : o.id;
      const nom = typeof o === 'string' ? o : o.nom;
      return `<option value="${esc(id)}"${String(id) === String(valeur ?? '') ? ' selected' : ''}>${esc(nom)}</option>`;
    }).join('');
}

export function telecharger(nom, contenu, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([contenu], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function csv(lignes) {
  const c = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + lignes.map(l => l.map(c).join(',')).join('\r\n');
}

export function ilYa(iso) {
  const d = versDate(iso);
  if (!d) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'à l’instant';
  if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
  if (s < 7 * 86400) { const j = Math.round(s / 86400); return j === 1 ? 'hier' : 'il y a ' + j + ' jours'; }
  return dateCourte(isoJour(d));
}
