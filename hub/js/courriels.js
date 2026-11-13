// Courriels aux clients : modèles, suggestion du bon courriel au bon moment, ouverture dans Outlook.
import { esc, ouvrirFenetre, fermerFenetre, toast, prenom, dateLongue, aujourdhui, joursEntre, ilYa, argent, ajouterJours } from './ui.js';
import { reglages, formatTexte, nomSegment, totalHT, taxesDe, journaliser, demandeApprobation, dossierCommande, planifier, plaquesDe, nbPlaques } from './donnees.js';
import { jetonEnvoi, autoriserEnvoi } from './auth.js';

const LIMITE_PJ = 3 * 1024 * 1024; // Graph : envoi simple jusqu'à environ 3 Mo de pièces jointes
// Pièces jointes cochées d'office selon le courriel
function pjParDefaut(choix, f, fichiers) {
  if (choix === 'approbation') {
    const rendu = fichiers.find(x => /rendu/i.test(x.nom) && x.image) || fichiers.find(x => x.image);
    return rendu && rendu.nom === f.nom;
  }
  if (choix === 'recue') return /^(Confirmation|Previsualisation)_.*\.pdf$/i.test(f.nom);
  if (choix === 'confirmation') return /^Confirmation_Georama_[A-Z0-9-]+\.pdf$/i.test(f.nom);
  return false;
}
// Images réduites en JPEG (1800 px max) pour rester sous la limite d'envoi
async function alleger(blob, nom) {
  if (!/^image\//.test(blob.type || '') && !/\.(png|jpe?g|webp)$/i.test(nom)) return { blob, nom };
  try {
    const img = await createImageBitmap(blob);
    const k = Math.min(1, 1800 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(img, 0, 0, cv.width, cv.height);
    const jpg = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
    return jpg && jpg.size < blob.size ? { blob: jpg, nom: nom.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg' } : { blob, nom };
  } catch (e) { return { blob, nom }; }
}
async function versBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const MODELES = [
  {
    // v1.14 : commandes régulières du site (G-…), envoyé tout seul depuis info@ avec le PDF client.
    // Pour rassurer : aucune invitation à valider, à changer ni à répondre.
    id: 'confirmation', nom: 'Confirmation (site)',
    objet: 'Confirmation de votre commande Georama ({numero})',
    corps: `Bonjour {prenom},

Merci pour votre commande ! Votre maquette de {lieu} est confirmée et sa place est réservée dans notre calendrier d'impression, à Saint-Félicien.

En bref :
- Numéro de commande : {numero}
- Format : {format}, gamme {gamme}
- Entrée en production : {entree_production}
- Durée d'impression de votre maquette : {duree_impression}
- {ligne_livraison}

Le document joint montre exactement ce qui sera imprimé : la vue 3D de votre maquette, son format, ses couleurs et ses mesures.

Nous vous écrirons quand elle sera prête à partir.

{signature}`,
  },
  {
    id: 'recue', nom: 'Commande reçue',
    objet: 'Votre maquette Georama est commandée ({numero})',
    corps: `Bonjour {prenom},

Merci pour votre commande. Votre maquette de {lieu} est bien reçue.

En bref :
- Numéro : {numero}
- Format : {format}, gamme {gamme}
- Livraison prévue : vers le {date_promise}

Nous vous écrirons dès qu'elle passe en production. Pour toute question, répondez simplement à ce courriel.

{signature}`,
  },
  {
    id: 'approbation', nom: 'Aperçu à approuver',
    objet: 'Votre aperçu Georama est prêt ({numero})',
    corps: `Bonjour {prenom},

L'aperçu 3D de votre maquette de {lieu} est prêt. Vous le trouverez en pièce jointe.

Prenez le temps de le regarder : territoire, repères, couleurs. Si tout vous convient, répondez « J'approuve » à ce courriel et nous lançons l'impression. Pour un ajustement, dites-nous simplement quoi changer.

La maquette est une représentation artistique faite à partir de données publiques (relief LiDAR, cartes et cadastre).

{signature}`,
  },
  {
    id: 'production', nom: 'En production',
    objet: 'Votre maquette est en production ({numero})',
    corps: `Bonjour {prenom},

Bonne nouvelle : votre maquette de {lieu} est en cours d'impression à Saint-Félicien. Couche par couche, votre territoire prend du relief.

Livraison toujours prévue vers le {date_promise}.

{signature}`,
  },
  {
    id: 'prete', nom: 'Prête à récupérer',
    objet: 'Votre maquette est prête ({numero})',
    corps: `Bonjour {prenom},

Votre maquette de {lieu} est terminée et vous attend à Saint-Félicien. Répondez à ce courriel pour convenir d'un moment pour passer la chercher.

{signature}`,
  },
  {
    id: 'expediee', nom: 'Expédiée',
    objet: 'Votre maquette est en route ({numero})',
    corps: `Bonjour {prenom},

Votre maquette de {lieu} est partie par Postes Canada.

Numéro de suivi : {suivi}
Suivre le colis : {lien_suivi}

Elle devrait arriver d'ici quelques jours. Au plaisir de savoir ce que vous en pensez.

{signature}`,
  },
  {
    id: 'merci', nom: 'Merci et avis',
    objet: 'Comment trouvez-vous votre maquette ?',
    corps: `Bonjour {prenom},

Votre maquette de {lieu} est maintenant chez vous. Nous espérons qu'elle vous fait voir votre territoire autrement.

Une photo de la maquette dans son nouveau décor nous ferait très plaisir. Et si vous avez deux minutes, un avis sur notre page Facebook aide beaucoup une jeune entreprise d'ici.

Merci de votre confiance.

{signature}`,
  },
];

const MOTS_ORG = ['famille', 'club', 'ville', 'mrc', 'municipalité', 'parc', 'station', 'inc', 'ltée', 'groupe', 'ferme', 'université', 'golf', 'pourvoirie', 'zec', 'cégep', 'école', 'centre'];
export function salutation(c) {
  const n = String(c.client || '').trim();
  if (!n) return '';
  if (MOTS_ORG.some(m => n.toLowerCase().split(/[\s,()-]+/).includes(m))) return n;
  return prenom(n);
}

export function modeles(m) {
  const perso = reglages(m).modelesCourriel || {};
  return MODELES.map(x => Object.assign({}, x, perso[x.id] || {}, { origine: x }));
}

function signature(ctx) {
  const R = reglages(ctx.m);
  if (R.signatureCourriel) return R.signatureCourriel.replace('{moi}', ctx.moi).replace('{prenom_moi}', prenom(ctx.moi));
  return `${prenom(ctx.moi)}\nGeorama · Changez de perspective\ninfo@georama.ca · georama.ca`;
}
export const SIGNATURE_DEFAUT = '{prenom_moi}\nGeorama · Changez de perspective\ninfo@georama.ca · georama.ca';

// Entrée en production et durée d'impression, d'après la file d'impression du hub.
export function planConfirmation(m, c) {
  const R = reglages(m);
  const pl = plaquesDe(m, c.id);
  const heures = pl.length ? pl.reduce((s, p) => s + (Number(p.heures) || R.heuresParPlaque || 37), 0) : nbPlaques(c) * (R.heuresParPlaque || 37);
  let debutH = null;
  try { (planifier(m).blocs || []).forEach(b => { if (b.c && b.c.id === c.id) debutH = debutH === null ? b.debut : Math.min(debutH, b.debut); }); } catch (e) { debutH = null; }
  const jours = debutH === null ? null : Math.ceil(debutH / 24);
  const dateProd = jours === null ? '' : ajouterJours(aujourdhui(), jours);
  const sansJour = iso => dateLongue(iso).replace(/^\S+\s/, '');
  const h = Math.round(heures);
  const n = pl.length || nbPlaques(c);
  return {
    jours, heures: h, plaques: n,
    entree_production: jours === null ? 'dans les prochains jours' : (jours <= 1 ? 'd\u2019ici 24 heures' : 'dans environ ' + jours + ' jours (vers le ' + sansJour(dateProd) + ')'),
    duree_impression: 'environ ' + h + ' heures' + (h >= 48 ? ' (un peu plus de ' + Math.floor(h / 24) + ' jours)' : '') + (n > 1 ? ' pour vos ' + n + ' plaques' : '') + ', couche par couche',
    ligne_livraison: c.livraison === 'recuperation'
      ? 'Récupération à Saint-Félicien : prête vers le ' + (c.promise ? sansJour(c.promise) : 'bientôt')
      : 'Livraison prévue : vers le ' + (c.promise ? sansJour(c.promise) : 'bientôt'),
  };
}

export function remplir(texte, c, ctx) {
  const R = reglages(ctx.m);
  const ht = totalHT(c);
  const t = taxesDe(ht, R.taxes);
  const v = {
    prenom: salutation(c) || 'bonjour',
    client: c.client || '',
    numero: c.numero || '',
    lieu: c.lieu || 'votre territoire',
    format: formatTexte(c),
    gamme: c.gamme || '',
    segment: nomSegment(c.segment),
    date_promise: c.promise ? dateLongue(c.promise).replace(/^\S+\s/, '') : 'bientôt',
    suivi: c.suivi || '[numéro de suivi]',
    lien_suivi: c.suivi ? 'https://www.canadapost-postescanada.ca/track-reperage/fr#/search?searchFor=' + encodeURIComponent(c.suivi) : '[lien de suivi]',
    lien_zone: c.lien || '',
    total: argent(ht + t.tps + t.tvq, 2),
    signature: signature(ctx),
  };
  if (/\{(entree_production|duree_impression|ligne_livraison)\}/.test(texte)) Object.assign(v, planConfirmation(ctx.m, c));
  return String(texte).replace(/\{(\w+)\}/g, (tout, k) => (k in v ? v[k] : tout));
}

// Le courriel qui convient à l'étape actuelle de la commande, s'il n'a pas déjà été envoyé.
export function suggestion(c) {
  if (!c || !c.courriel || c.statut === 'annulee') return null;
  const envoyes = new Set((c.courriels || []).map(x => x.modele));
  const s = c.statut;
  if (s === 'approbation') return envoyes.has('approbation') ? null : (envoyes.has('recue') ? 'approbation' : 'recue');
  if (s === 'nouvelle') {
    if (estCommandeSite(c)) return envoyes.has('confirmation') || envoyes.has('recue') ? null : 'confirmation';
    return envoyes.has('recue') ? null : 'recue';
  }
  if (s === 'production' || s === 'finition') {
    if (!envoyes.has('recue') && !envoyes.has('production')) return 'production';
    return envoyes.has('production') ? null : 'production';
  }
  if (s === 'expediee') {
    if (!envoyes.has('expediee')) return 'expediee';
    const le = ((c.courriels || []).find(x => x.modele === 'expediee') || {}).le;
    if (!envoyes.has('merci') && le && joursEntre(le.slice(0, 10), aujourdhui()) >= 7) return 'merci';
    return null;
  }
  if (s === 'livree') {
    if (c.livraison === 'recuperation' && !envoyes.has('prete') && !envoyes.has('merci')) return 'prete';
    if (!envoyes.has('merci')) {
      const base = ((c.courriels || []).find(x => x.modele === 'prete') || {}).le || c.expedieeLe;
      if (!base || joursEntre(String(base).slice(0, 10), aujourdhui()) >= 3) return 'merci';
    }
  }
  return null;
}
// Commande régulière du site (G-…) : la confirmation part toute seule depuis info@.
export function estCommandeSite(c) { return !!c && String(c.id || '').startsWith('wix-') && !demandeApprobation(c); }
export function nomModele(id) { return (MODELES.find(x => x.id === id) || { nom: id }).nom; }

// Envoi par Microsoft Graph (/me/sendMail) avec des fichiers du dossier de la commande en pièces jointes.
export async function envoyerGraph(m, c, { a, objet, corps, pieces = [] }) {
  const jeton = await jetonEnvoi();
  const pj = [];
  if (pieces.length) {
    const frais = await m.a.lister(dossierCommande(c)); // liens de téléchargement à jour
    let total = 0;
    for (const nomF of pieces) {
      const x = frais.find(y => y.nom === nomF);
      if (!x || !x.url) continue;
      const brut = await (await fetch(x.url)).blob();
      const { blob, nom } = await alleger(brut, nomF);
      total += blob.size;
      if (total > LIMITE_PJ) throw new Error('Pièces jointes trop lourdes (plus de 3 Mo). Décoche-en une.');
      pj.push({ '@odata.type': '#microsoft.graph.fileAttachment', name: nom, contentType: blob.type || 'application/octet-stream', contentBytes: await versBase64(blob) });
    }
  }
  const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST', headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { subject: objet, body: { contentType: 'Text', content: String(corps) }, toRecipients: [{ emailAddress: { address: a } }], attachments: pj }, saveToSentItems: true }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw Object.assign(new Error('Microsoft refuse l’envoi (' + r.status + '). ' + t.slice(0, 160)), { code: r.status === 403 ? 'consentement' : '' });
  }
  return pj.length;
}

export function ouvrirCourriel(ctx, idCommande, idModele) {
  const m = ctx.m;
  const c = m.get('commandes', idCommande);
  if (!c) return;
  const liste = modeles(m);
  let choix = idModele || suggestion(c) || (demandeApprobation(c) && c.statut === 'approbation' ? 'approbation' : 'recue');
  const envoyes = c.courriels || [];
  const direct = ctx.mode === 'm365';
  let fichiers = ((ctx.etat.fichiers || {})[c.id] || {}).liste || [];
  const joignables = () => fichiers.filter(f => f.image || /\.pdf$/i.test(f.nom));
  const rendus = fichiers.filter(f => f.image);
  const sugg = suggestion(c);

  const corpsHtml = () => {
    const mod = liste.find(x => x.id === choix) || liste[0];
    return `
      <div class="filtres" role="group" aria-label="Modèle" style="margin-bottom:14px">
        ${liste.map(x => `<button type="button" class="puce" data-modal-act="modele:${x.id}" aria-pressed="${x.id === choix}">${esc(x.nom)}${x.id === sugg ? ' ·  suggéré' : ''}${envoyes.some(e => e.modele === x.id) ? ' · envoyé' : ''}</button>`).join('')}
      </div>
      ${c.courriel ? '' : '<div class="bandeau" style="margin-bottom:12px"><span>Cette commande n’a pas de courriel. Ajoute-le dans la commande, ou copie le texte.</span></div>'}
      <div class="champs">
        <div class="champ plein"><label for="co-a">À</label><input id="co-a" name="a" type="email" value="${esc(c.courriel)}"></div>
        <div class="champ plein"><label for="co-objet">Objet</label><input id="co-objet" name="objet" type="text" value="${esc(remplir(mod.objet, c, ctx))}"></div>
        <div class="champ plein"><label for="co-corps">Message</label><textarea id="co-corps" name="corps" rows="14">${esc(remplir(mod.corps, c, ctx))}</textarea>
          <span class="aide">Tu peux modifier le texte ici avant d'envoyer. Pour changer le modèle pour toujours : Paramètres › Courriels aux clients.</span></div>
      </div>
      <div id="co-envoi-etat"></div>
      ${direct && joignables().length ? `<fieldset style="margin-top:12px;border:0;padding:0"><legend class="petit"><strong>Pièces jointes</strong> (envoyées avec le courriel)</legend>
        ${joignables().map((f, i) => `<label class="ligne petit" style="gap:8px;cursor:pointer"><input type="checkbox" name="pj-${i}"${pjParDefaut(choix, f, joignables()) ? ' checked' : ''}> <span class="grow">${esc(f.nom)}</span><span class="doux tres-petit">${Math.max(1, Math.round((f.taille || 0) / 1024))} Ko</span></label>`).join('')}
      </fieldset>` : ''}
      ${choix === 'approbation' && !direct ? `<div class="bandeau info" style="margin-top:12px"><span><strong>N'oublie pas la pièce jointe.</strong> ${rendus.length ? 'Télécharge le rendu, puis glisse-le dans le courriel : ' + rendus.map(f => `<a href="${esc(f.url)}" download="${esc(c.numero + '-' + f.nom)}">${esc(f.nom)}</a>`).join(', ') : 'Pas encore de rendu 3D pour cette commande : demande-le dans la fiche de production.'}</span></div>` : ''}
      ${choix === 'expediee' && !c.suivi ? '<div class="bandeau" style="margin-top:12px"><span>Le numéro de suivi manque : ajoute-le dans la commande pour qu’il apparaisse ici.</span></div>' : ''}
      ${envoyes.length ? `<p class="tres-petit doux" style="margin:12px 0 0">Déjà préparés : ${envoyes.map(e => esc(nomModele(e.modele)) + ' (' + esc(prenom(e.par)) + ', ' + esc(ilYa(e.le)) + ')').join(' · ')}</p>` : ''}`;
  };

  const pied = `<div class="actions"><button type="button" class="btn-2" data-modal-act="copier">Copier le texte</button>${direct ? '<button type="button" class="btn-2" data-modal-act="messagerie">Ouvrir dans ma messagerie</button>' : ''}</div>`;
  const ouvrirMessagerie = d => {
    const a = (d.a || '').trim();
    const lien = 'mailto:' + encodeURIComponent(a).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(d.objet) + '&body=' + encodeURIComponent(String(d.corps).replace(/\r?\n/g, '\r\n'));
    const el = document.createElement('a');
    el.href = lien;
    document.body.appendChild(el);
    el.click();
    el.remove();
    marquer('outlook');
    toast('Courriel prêt dans ta messagerie. Il reste à cliquer « Envoyer ».');
  };
  const montrerAutorisation = form => {
    const z = form.querySelector('#co-envoi-etat');
    if (!z) return;
    z.innerHTML = `<div class="bandeau info" style="margin-top:12px"><span><strong>Envoyer directement depuis le hub.</strong> Microsoft demande une autorisation, une seule fois : le courriel part de ton adresse et se retrouve dans tes Éléments envoyés. (Le texte modifié ici sera à refaire après l’autorisation.)</span>
      <button type="button" class="btn" id="co-autoriser">Donner l’autorisation</button></div>`;
    // Bouton ajouté après l'ouverture de la fenêtre : on le branche ici (les data-modal-act sont branchés à l'ouverture seulement)
    z.querySelector('#co-autoriser').addEventListener('click', () => autoriserEnvoi());
  };
  // Envoi direct par Microsoft Graph, avec les pièces jointes cochées
  const envoyer = async (d, form) => {
    const a = (d.a || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) { toast('Adresse courriel à vérifier.', true); return; }
    const bouton = form.querySelector('button[type=submit]');
    if (bouton) { bouton.disabled = true; bouton.textContent = 'Envoi…'; }
    try {
      const pieces = joignables().filter((f, i) => d['pj-' + i]).map(f => f.nom);
      const n = await envoyerGraph(m, c, { a, objet: d.objet, corps: d.corps, pieces });
      marquer('envoye');
      fermerFenetre();
      toast('Courriel envoyé à ' + a + (n ? ' avec ' + n + ' pièce' + (n > 1 ? 's' : '') + ' jointe' + (n > 1 ? 's' : '') : '') + '.');
    } catch (e) {
      if (bouton) { bouton.disabled = false; bouton.textContent = 'Envoyer'; }
      if (e.code === 'consentement') { montrerAutorisation(form); toast('Il manque l’autorisation d’envoyer. Bouton dans la fenêtre.', true); }
      else toast(e.message || 'Envoi impossible.', true);
    }
  };
  const ouvrir = () => {
    const { dialog, form } = ouvrirFenetre({
      titre: 'Courriel à ' + (c.client || 'client') + ' · ' + c.numero,
      corps: corpsHtml(), pied, large: true,
      onAction(act, f) {
        if (act.startsWith('modele:')) { choix = act.slice(7); setTimeout(ouvrir, 0); return 'fermer'; }
        if (act === 'copier') {
          const txt = 'Objet : ' + f.querySelector('#co-objet').value + '\n\n' + f.querySelector('#co-corps').value;
          navigator.clipboard.writeText(txt).then(() => toast('Texte copié. Colle-le dans ton courriel.'), () => toast('Copie refusée par le navigateur. Sélectionne le texte à la main.', true));
          marquer('copie');
          return null;
        }
        if (act === 'messagerie') {
          const d = {};
          new FormData(f).forEach((v, k) => { d[k] = v; });
          ouvrirMessagerie(d);
          return 'fermer';
        }
        return null;
      },
      onSubmit(d, f) {
        if (!direct) { ouvrirMessagerie(d); return true; }
        envoyer(d, f);
        return false;
      },
    });
    const ok = form.querySelector('button[type=submit]');
    if (ok) ok.textContent = direct ? 'Envoyer' : 'Ouvrir dans ma messagerie';
    // Autorisation d'envoi déjà donnée ? Sinon, le bouton pour la donner s'affiche tout de suite.
    if (direct) jetonEnvoi().catch(e => { if (e.code === 'consentement') montrerAutorisation(form); });
    // Liste des fichiers de la commande (pour les pièces jointes) si elle n'est pas encore chargée
    if (direct && !fichiers.length && m.a.lister) m.a.lister(dossierCommande(c)).then(l => { if (l.length) { fichiers = l; ctx.etat.fichiers = ctx.etat.fichiers || {}; ctx.etat.fichiers[c.id] = Object.assign({}, ctx.etat.fichiers[c.id] || {}, { liste: l, t: Date.now() }); setTimeout(ouvrir, 0); } }).catch(() => {});
    void dialog;
  };
  let deja = false;
  const marquer = (comment) => {
    if (deja) return;
    deja = true;
    const actuel = m.get('commandes', c.id);
    const courriels = (actuel.courriels || []).concat([{ modele: choix, le: new Date().toISOString(), par: ctx.moi, comment }]);
    m.modifier('commandes', c.id, { courriels }, true);
    journaliser(m, 'Courriel « ' + nomModele(choix) + ' » ' + (comment === 'envoye' ? 'envoyé à ' : 'préparé pour ') + c.client + ' (' + c.numero + ')', '#/production/fiche/' + c.id, 'courriel');
    m.avertir('local');
  };
  ouvrir();
}

// Petite carte pour la fiche de production
export function carteCourriels(ctx, c) {
  const sugg = suggestion(c);
  const envoyes = (c.courriels || []).slice().reverse();
  const auto = c.confirmationAuto || {};
  const R = reglages(ctx.m);
  const autoTxt = !estCommandeSite(c) || R.confirmationAuto === false || envoyes.some(e => e.modele === 'confirmation' || e.modele === 'recue') ? ''
    : (auto.erreur ? '<div class="bandeau" style="margin:8px 0"><span>Confirmation automatique pas envoyée : ' + esc(auto.erreur) + '</span></div>'
      : (c.recue && c.recue < (R.confirmationAutoDepuis || '2026-11-13') ? ''
        : '<p class="tres-petit doux" style="margin:8px 0 0">La confirmation (avec le PDF) part toute seule depuis ' + esc(R.courrielConfirmation || 'info@georama.ca') + ' dès que le PDF client est prêt, quand le hub est ouvert avec ce compte.</p>'));
  return `<section class="carte">
    <p class="surtitre">Courriels au client</p>${autoTxt}
    ${sugg ? `<p class="petit" style="margin:8px 0 10px">À envoyer maintenant : <strong>${esc(nomModele(sugg))}</strong></p>
      <button type="button" class="btn" data-act="courriel" data-id="${esc(c.id)}" data-modele="${sugg}" style="width:100%">Préparer « ${esc(nomModele(sugg))} »</button>`
    : `<p class="petit doux" style="margin:8px 0 10px">${c.courriel ? 'Rien à envoyer pour l’instant.' : 'Pas de courriel pour ce client.'}</p>`}
    <button type="button" class="btn-lien" data-act="courriel" data-id="${esc(c.id)}" style="margin-top:6px">Choisir un autre courriel</button>
    ${envoyes.length ? `<div style="margin-top:8px">${envoyes.slice(0, 4).map(e => `<div class="ligne tres-petit"><span class="grow">${esc(nomModele(e.modele))}</span><span class="doux">${esc(prenom(e.par))} · ${esc(ilYa(e.le))}</span></div>`).join('')}</div>` : ''}
  </section>`;
}
