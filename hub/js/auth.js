// Connexion avec un compte Microsoft 365 Georama (OAuth 2.0, code d'autorisation + PKCE).
// Aucun mot de passe ne passe par le hub : la page de connexion est celle de Microsoft.
import { CONFIG } from '../config.js';

const SCOPES = 'openid profile offline_access User.Read Files.ReadWrite.All';
// Suivi des courriels de prospection : lecture des en-têtes seulement (objet, date, expéditeur,
// destinataires). Jamais le contenu des messages. Autorisation demandée à part, une seule fois.
export const SCOPE_COURRIEL = 'Mail.ReadBasic';
const CLE = 'georama-hub-jetons';
const CLE_IDS = 'georama-hub-ids';

function lireIds() {
  let local = {};
  try { local = JSON.parse(localStorage.getItem(CLE_IDS) || '{}'); } catch (e) { local = {}; }
  return { clientId: CONFIG.clientId || local.clientId || '', tenantId: CONFIG.tenantId || local.tenantId || '' };
}
export function idsConfigures() { const i = lireIds(); return !!(i.clientId && i.tenantId); }
export function idsDansCode() { return !!(CONFIG.clientId && CONFIG.tenantId); }
export function enregistrerIds(clientId, tenantId) {
  try { localStorage.setItem(CLE_IDS, JSON.stringify({ clientId: clientId.trim(), tenantId: tenantId.trim() })); } catch (e) { /* stockage refusé */ }
}
export function lireIdsAffichage() { return lireIds(); }

export function redirectUri() {
  let p = location.pathname.replace(/index\.html$/, '');
  if (!p.endsWith('/')) p += '/';
  return location.origin + p;
}
function autorite() { return 'https://login.microsoftonline.com/' + encodeURIComponent(lireIds().tenantId) + '/oauth2/v2.0'; }

function b64url(bytes) {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function aleatoire(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); }
async function sha256(txt) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt))); }

function lireJetons() { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { return null; } }
function ecrireJetons(j) { try { localStorage.setItem(CLE, JSON.stringify(j)); } catch (e) { /* stockage refusé */ } }

function decoderJwt(jwt) {
  try {
    const p = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(p).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    return JSON.parse(json);
  } catch (e) { return {}; }
}

export function utilisateur() {
  const j = lireJetons();
  if (!j || !j.id_token) return null;
  const c = decoderJwt(j.id_token);
  return { nom: c.name || c.preferred_username || 'Utilisateur', courriel: c.preferred_username || c.email || '', oid: c.oid || '', tid: c.tid || '' };
}

export async function seConnecter(choisirCompte = true, scopesEnPlus = '') {
  const scope = scopesEnPlus ? SCOPES + ' ' + scopesEnPlus : SCOPES;
  const verifier = aleatoire(48);
  const challenge = b64url(await sha256(verifier));
  const state = aleatoire(16);
  sessionStorage.setItem('georama-hub-pkce', JSON.stringify({ verifier, state, retour: location.hash || '', scope }));
  const q = new URLSearchParams({
    client_id: lireIds().clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (choisirCompte) q.set('prompt', 'select_account');
  location.assign(autorite() + '/authorize?' + q.toString());
}

export function seDeconnecter() {
  localStorage.removeItem(CLE);
  const q = new URLSearchParams({ post_logout_redirect_uri: redirectUri() });
  location.assign(autorite() + '/logout?' + q.toString());
}

async function demanderJetons(params) {
  const corps = new URLSearchParams(Object.assign({ client_id: lireIds().clientId, scope: SCOPES }, params));
  const r = await fetch(autorite() + '/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: corps.toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j.error_description || j.error || ('Erreur ' + r.status));
    err.code = j.error;
    throw err;
  }
  const actuel = lireJetons() || {};
  const jetons = {
    access_token: j.access_token,
    refresh_token: j.refresh_token || actuel.refresh_token,
    id_token: j.id_token || actuel.id_token,
    expire: Date.now() + (Number(j.expires_in) || 3600) * 1000 - 120000,
  };
  ecrireJetons(jetons);
  return jetons;
}

// À appeler au démarrage : termine la connexion si on revient de la page Microsoft.
export async function traiterRetour() {
  const p = new URLSearchParams(location.search);
  if (!p.has('code') && !p.has('error')) return { statut: 'rien' };
  let sauve = {};
  try { sauve = JSON.parse(sessionStorage.getItem('georama-hub-pkce') || '{}'); } catch (e) { sauve = {}; }
  sessionStorage.removeItem('georama-hub-pkce');
  history.replaceState(null, '', location.pathname + (sauve.retour || ''));
  if (p.has('error')) return { statut: 'erreur', message: p.get('error_description') || p.get('error') };
  if (!sauve.state || sauve.state !== p.get('state')) return { statut: 'erreur', message: 'La connexion a expiré. Recommence.' };
  try {
    await demanderJetons({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirectUri(), code_verifier: sauve.verifier, scope: sauve.scope || SCOPES });
    return { statut: 'connecte' };
  } catch (e) {
    return { statut: 'erreur', message: e.message };
  }
}

export function estConnecte() { const j = lireJetons(); return !!(j && (j.refresh_token || (j.access_token && j.expire > Date.now()))); }

let enCours = null;
export async function jeton() {
  const j = lireJetons();
  if (!j) throw Object.assign(new Error('Non connecté'), { code: 'non_connecte' });
  if (j.access_token && j.expire > Date.now()) return j.access_token;
  if (!j.refresh_token) throw Object.assign(new Error('Session expirée'), { code: 'non_connecte' });
  if (!enCours) {
    enCours = demanderJetons({ grant_type: 'refresh_token', refresh_token: j.refresh_token })
      .finally(() => { enCours = null; });
  }
  try {
    const n = await enCours;
    return n.access_token;
  } catch (e) {
    localStorage.removeItem(CLE);
    throw Object.assign(new Error('Session expirée. Reconnecte-toi.'), { code: 'non_connecte' });
  }
}

// Jeton pour lire les en-têtes des courriels. Ne touche pas au jeton principal (fichiers).
// Erreur code 'consentement' tant que la personne n'a pas donné l'autorisation.
const jetonsPlus = {};
export function jetonCourriel() { return jetonPour(SCOPE_COURRIEL); }
// Envoi de courriels depuis le hub (au nom de la personne connectée, enregistrés dans ses Éléments envoyés).
export const SCOPE_ENVOI = 'Mail.Send';
export function jetonEnvoi() { return jetonPour(SCOPE_ENVOI); }
export function autoriserEnvoi() { return seConnecter(false, SCOPE_ENVOI + ' ' + SCOPE_COURRIEL); }
async function jetonPour(scopeDemande) {
  const jetonMail = jetonsPlus[scopeDemande];
  if (jetonMail && jetonMail.expire > Date.now()) return jetonMail.access_token;
  const j = lireJetons();
  if (!j || !j.refresh_token) throw Object.assign(new Error('Non connecté'), { code: 'non_connecte' });
  const corps = new URLSearchParams({ client_id: lireIds().clientId, grant_type: 'refresh_token', refresh_token: j.refresh_token, scope: 'https://graph.microsoft.com/' + scopeDemande + ' offline_access' });
  const r = await fetch(autorite() + '/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corps.toString() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const txt = String(d.error_description || d.error || '');
    const consent = /AADSTS65001|consent/i.test(txt);
    throw Object.assign(new Error(consent ? 'Autorisation Microsoft pas encore donnée.' : txt || ('Erreur ' + r.status)), { code: consent ? 'consentement' : (d.error || 'erreur') });
  }
  if (d.refresh_token) ecrireJetons(Object.assign({}, lireJetons() || {}, { refresh_token: d.refresh_token }));
  jetonsPlus[scopeDemande] = { access_token: d.access_token, expire: Date.now() + (Number(d.expires_in) || 3600) * 1000 - 120000 };
  return jetonsPlus[scopeDemande].access_token;
}
export function autoriserCourriel() { return seConnecter(false, SCOPE_COURRIEL); }
