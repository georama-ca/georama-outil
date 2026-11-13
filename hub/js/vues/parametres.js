// Paramètres : connexion Microsoft 365, dossier OneDrive, équipe, production, finances, sauvegarde.
import { CONFIG } from '../../config.js';
import * as auth from '../auth.js';
import { lireLieu, ecrireLieu, COLLECTIONS } from '../store.js';
import { reglages, agent, nomDuCompte } from '../donnees.js';
import { donneesDemo } from '../demo.js';
import { esc, toast, telecharger, aujourdhui, ilYa, ico, prenom } from '../ui.js';
import { modeles, SIGNATURE_DEFAUT, MODELES } from '../courriels.js';

const GUIDE = 'https://github.com/georama-ca/georama-outil/blob/main/hub/LISEZMOI.md';

function blocAgent(ctx) {
  const a = agent(ctx.m);
  const etat = !a.installe ? '<span class="etiquette gris">Pas encore installé</span>'
    : a.enLigne ? '<span class="etiquette vert">En ligne</span>' : '<span class="etiquette orange">Hors ligne</span>';
  return `<section class="carte">
    <div class="carte-tete"><h2 style="display:flex;align-items:center;gap:10px">${ico('maison').replace('<svg', '<svg width="22" height="22"')} Ordi de la maison</h2>${etat}</div>
    ${a.installe ? `<p class="petit" style="margin:0 0 10px">${esc(a.machine || '')} · agent v${esc(a.version || '?')} · vu ${esc(ilYa(a.vu))} · démarré ${esc(ilYa(a.demarre))}</p>` : ''}
    <p class="petit" style="margin:0 0 10px">Un PC toujours allumé à la maison, connecté au OneDrive Georama, fait le travail lourd pour le hub. Il ne parle au hub que par le dossier OneDrive : rien n'est ouvert sur Internet.</p>
    <ul class="petit" style="margin:0 0 12px;padding-left:20px;line-height:24px">
      <li><strong>Rendus 3D</strong> : dépose un .3mf dans le dossier d'une commande, l'image apparaît dans sa fiche.</li>
      <li><strong>Georama Production</strong> : dans la fiche d’une commande, « Aperçu rapide », « Produire le .3mf » et « PDF client », avec la gamme et le format au choix.</li>
      <li><strong>Imprimante en direct</strong> : pourcentage, temps restant et fin réelle de la H2C (mode réseau local).</li>
      <li><strong>Commandes du site</strong> : les commandes Wix arrivent toutes seules dans le hub, avec le lien de la zone.</li>
    </ul>
    ${ctx.mode === 'demo' ? '<p class="tres-petit doux" style="margin:0 0 10px">En mode démo, l\u2019ordi de la maison est simulé pour que tu puisses essayer.</p>' : ''}
    <div class="actions">
      <a class="btn" href="agent/agent-georama.zip" download>Télécharger l'agent (Windows)</a>
      <a class="btn-lien" href="https://github.com/georama-ca/georama-outil/blob/main/hub/agent/LISEZMOI.txt" target="_blank" rel="noopener">Guide d'installation</a>
    </div>
    <p class="tres-petit doux" style="margin:10px 0 0">Installation : décompresser, double-cliquer sur Installer.bat. Il démarre ensuite tout seul avec Windows.</p>
  </section>`;
}

function blocConnexion(ctx) {
  const ids = auth.lireIdsAffichage();
  const lieu = lireLieu();
  if (ctx.mode === 'm365') {
    return `<section class="carte">
      <h2>Connexion Microsoft 365</h2>
      <div class="ligne"><span class="grow">Connecté·e</span><strong>${esc(ctx.moi)}</strong></div>
      <div class="ligne"><span class="grow">Compte</span><span class="petit">${esc(ctx.courriel)}</span></div>
      <div class="ligne"><span class="grow">Dossier des données</span><span class="petit">${esc(lieu ? lieu.nom : '—')}${lieu && lieu.partage ? ' (partagé)' : ''}</span></div>
      ${lieu && lieu.webUrl ? `<p style="margin:10px 0"><a href="${esc(lieu.webUrl)}" target="_blank" rel="noopener">Ouvrir le dossier dans OneDrive</a></p>` : ''}
      <label class="case"><input type="checkbox" data-chg="partage"${reglages(ctx.m).partageFait ? ' checked' : ''}> Le dossier est partagé avec l'autre personne</label>
      <div class="bandeau info" style="margin:10px 0"><span><strong>Pour travailler à deux :</strong> dans OneDrive, partage le dossier Hub-Georama avec l'autre personne (peut modifier), puis envoie-lui le lien. À sa première connexion, elle choisit « On m'a partagé le dossier » et colle le lien.</span></div>
      <div class="actions">
        <button type="button" class="btn-2" data-act="changer-dossier">Changer de dossier</button>
        <button type="button" class="btn-2" data-act="deconnexion">Se déconnecter</button>
        <button type="button" class="btn-lien" data-act="vers-demo">Revenir au mode démo</button>
      </div>
    </section>`;
  }
  return `<section class="carte">
    <h2>Connexion Microsoft 365</h2>
    <p class="petit" style="margin:0 0 10px">Le hub est en <strong>mode démo</strong> : les données restent dans ce navigateur. Avec Microsoft 365, chaque personne se connecte avec son compte Georama et les données vont dans le OneDrive Georama, partagées entre vous deux.</p>
    ${auth.idsConfigures() ? `<button type="button" class="btn" data-act="vers-m365">Passer à Microsoft 365</button>` : `
      <p class="petit doux" style="margin:0 0 10px">Il faut d'abord inscrire le hub dans Microsoft Entra (10 minutes, une seule fois). Les étapes sont dans le <a href="${GUIDE}" target="_blank" rel="noopener">guide d'activation</a>.</p>
      <form data-form="ids" class="champs">
        <div class="champ"><label for="ids-client">ID d'application (client)</label><input id="ids-client" name="clientId" type="text" required value="${esc(ids.clientId)}" placeholder="00000000-0000-0000-0000-000000000000"></div>
        <div class="champ"><label for="ids-tenant">ID de l'annuaire (locataire)</label><input id="ids-tenant" name="tenantId" type="text" required value="${esc(ids.tenantId)}" placeholder="00000000-0000-0000-0000-000000000000"></div>
        <div class="champ plein"><span class="lbl">Adresse de redirection à inscrire (type « Application monopage »)</span><code style="padding:10px 12px;border-radius:6px;background:var(--fond);border:1px solid var(--bordure);word-break:break-all">${esc(auth.redirectUri())}</code></div>
        <div class="champ plein"><button type="submit" class="btn" style="align-self:flex-start">Enregistrer et se connecter</button>
          <span class="aide">Ces identifiants ne sont pas des secrets. Envoie-les aussi à Claude pour qu'il les mette dans le hub : ils marcheront alors sur tous les appareils.</span></div>
      </form>`}
  </section>`;
}

// Carte « Appli sur le cellulaire » : installer le hub comme une appli (suit toutes les versions).
function carteAppli() {
  const installe = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const corps = installe
    ? '<p class="petit" style="margin:0">C’est fait : tu utilises l’appli Hub Georama. Elle se met à jour toute seule à chaque nouvelle version.</p>'
    : ios
      ? '<ol class="petit" style="margin:0;padding-left:20px"><li>Ouvre ce hub dans <b>Safari</b>.</li><li>Touche le bouton <b>Partager</b> (carré avec une flèche).</li><li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li></ol>'
      : '<p class="petit doux" style="margin:0 0 12px">Une icône Georama sur l’écran d’accueil, qui ouvre le hub en plein écran. Elle suit chaque nouvelle version toute seule, rien à mettre à jour.</p><div class="actions"><button type="button" class="btn" data-act="installer-appli">Installer l’appli</button></div><p class="tres-petit doux" style="margin:10px 0 0">Si le bouton ne fait rien : menu ⋮ de Chrome → « Installer l’application » (ou « Ajouter à l’écran d’accueil »).</p>';
  return `<section class="carte"><h2>Appli sur le cellulaire</h2>${corps}</section>`;
}

export default {
  titre: 'Paramètres',
  render(ctx) {
    const R = reglages(ctx.m);
    const imp = R.imprimantes.map((i, k) => `<div class="ligne">
      <label class="case grow"><input type="checkbox" name="imp-${k}"${i.active ? ' checked' : ''}> <input type="text" name="impnom-${k}" value="${esc(i.nom)}" aria-label="Nom de l'imprimante ${k + 1}" style="max-width:260px"></label>
      <span class="tres-petit doux">${i.active ? 'En service' : 'Pas en service'}</span></div>`).join('');
    return `<header class="entete"><div><p class="surtitre">Hub · v${esc(CONFIG.version)} · ${esc(CONFIG.versionDate)}</p><h1 class="titre-1">Paramètres</h1></div></header>
      ${blocConnexion(ctx)}
      ${blocAgent(ctx)}
      <form data-form="reglages" style="display:flex;flex-direction:column;gap:16px">
        <div class="g2">
          <section class="carte">
            <h2>Production</h2>
            <div class="champs">
              <div class="champ"><label for="r-hpp">Heures par plaque 10 × 12</label><input id="r-hpp" name="heuresParPlaque" type="number" min="1" max="200" step="0.5" value="${esc(R.heuresParPlaque)}"><span class="aide">Estimé à 37 h (à mesurer). Sert aux nouvelles plaques.</span></div>
              <div class="champ"><label for="r-hpj">Heures d'impression par jour</label><input id="r-hpj" name="heuresParJour" type="number" min="1" max="24" step="1" value="${esc(R.heuresParJour)}"></div>
              <div class="champ"><label for="r-hsem">Heures Georama visées par semaine (chacun)</label><input id="r-hsem" name="heuresSemaine" type="number" min="1" max="80" step="0.5" value="${esc(R.heuresSemaine || 10)}"></div>
              <div class="champ plein"><label class="case"><input type="checkbox" name="chronoAuto"${R.chronoAuto !== false ? ' checked' : ''}> Chrono automatique : démarre dès qu'on se sert du hub, s'arrête après 10 min sans activité</label></div>
              <div class="champ"><label for="r-delai">Délai promis (jours)</label><input id="r-delai" name="delaiJours" type="number" min="1" max="120" value="${esc(R.delaiJours)}"><span class="aide">3 semaines : 2 de production + 7 jours de livraison.</span></div>
              <div class="champ plein"><span class="lbl">Imprimantes</span>${imp}</div>
            </div>
          </section>
          <section class="carte">
            <h2>Ventes et finances</h2>
            <div class="champs">
              <div class="champ"><label for="r-obj">Objectif annuel de bénéfice ($)</label><input id="r-obj" name="objectif" type="number" min="0" step="100" value="${esc(R.objectif)}"></div>
              <div class="champ"><label for="r-liv">Livraison Postes Canada ($)</label><input id="r-liv" name="livraison" type="number" min="0" step="0.01" value="${esc(R.livraison)}"></div>
              <div class="champ"><label for="r-noel">Date limite des commandes de Noël</label><input id="r-noel" name="dateLimiteNoel" type="date" value="${esc(R.dateLimiteNoel)}"></div>
              <div class="champ"><label for="r-envoi">Dernier envoi avant Noël</label><input id="r-envoi" name="dernierEnvoi" type="date" value="${esc(R.dernierEnvoi)}"></div>
              <div class="champ plein"><label class="case"><input type="checkbox" name="taxes"${R.taxes ? ' checked' : ''}> Facturer la TPS et la TVQ sur les ventes</label></div>
            </div>
          </section>
        </div>
        <section class="carte">
          <h2>Équipe</h2>
          <div class="champ"><label for="r-membres">Membres (une personne par ligne)</label><textarea id="r-membres" name="membres" rows="3">${esc((R.membres || []).join('\n'))}</textarea>
            <span class="aide">Pour assigner les commandes, les tâches et les prospects.</span></div>
          <div class="champ"><label for="r-comptes">Comptes Microsoft (une ligne par compte : courriel = personne)</label><textarea id="r-comptes" name="comptes" rows="3" placeholder="info@georama.ca = Maryse Perron Chartier">${esc(Object.entries(R.comptes || {}).map(([k, v]) => k + ' = ' + v).join('\n'))}</textarea>
            <span class="aide">Qui est connecté avec quel compte. Sans ligne, le hub prend le nom du compte Microsoft.</span></div>
        </section>
        <div><button type="submit" class="btn">Enregistrer les paramètres</button></div>
      </form>
      <form data-form="courriels" class="carte">
        <h2>Courriels aux clients</h2>
        <p class="petit doux" style="margin:0 0 12px">Les modèles proposés dans chaque commande. Variables : {prenom} {client} {numero} {lieu} {format} {gamme} {segment} {date_promise} {suivi} {lien_suivi} {lien_zone} {total} {signature} ; pour la confirmation : {entree_production} {duree_impression} {ligne_livraison}.</p>
        <div class="carte" style="background:var(--fond-2, transparent);margin:0 0 14px;display:flex;flex-direction:column;gap:10px">
          <label class="case"><input type="checkbox" name="confirmationAuto"${reglages(ctx.m).confirmationAuto !== false ? ' checked' : ''}> <span><strong>Confirmation automatique</strong> des commandes régulières du site (G-…) : courriel « Confirmation (site) » avec le PDF client, envoyé tout seul dès que le PDF est prêt.</span></label>
          <div class="champs">
            <div class="champ"><label for="conf-compte">Compte qui envoie</label><input id="conf-compte" name="courrielConfirmation" type="email" value="${esc(reglages(ctx.m).courrielConfirmation || 'info@georama.ca')}"><span class="aide">Le courriel part quand le hub est ouvert avec ce compte (n'importe quel appareil).</span></div>
            <div class="champ"><label for="conf-depuis">Pour les commandes reçues depuis le</label><input id="conf-depuis" name="confirmationAutoDepuis" type="date" value="${esc(reglages(ctx.m).confirmationAutoDepuis || '2026-11-13')}"></div>
          </div>
          <div class="actions"><button type="button" class="btn-2" data-act="autoriser-envoi">Donner l’autorisation d’envoyer (une fois par compte)</button></div>
        </div>
        <div class="champ" style="margin-bottom:14px"><label for="sig">Signature ({prenom_moi} = prénom de la personne connectée)</label><textarea id="sig" name="signature" rows="3">${esc(reglages(ctx.m).signatureCourriel || SIGNATURE_DEFAUT)}</textarea></div>
        ${modeles(ctx.m).map(x => `<details style="border-top:1px solid var(--bordure);padding:10px 0">
          <summary style="cursor:pointer;font-weight:600;min-height:32px;display:flex;align-items:center">${esc(x.nom)}${(reglages(ctx.m).modelesCourriel || {})[x.id] ? ' <span class="etiquette vert" style="margin-left:8px">modifié</span>' : ''}</summary>
          <div class="champs" style="margin-top:10px">
            <div class="champ plein"><label for="mo-${x.id}">Objet</label><input id="mo-${x.id}" name="objet-${x.id}" type="text" value="${esc(x.objet)}"></div>
            <div class="champ plein"><label for="mc-${x.id}">Message</label><textarea id="mc-${x.id}" name="corps-${x.id}" rows="10">${esc(x.corps)}</textarea></div>
            <div class="champ plein"><button type="button" class="btn-lien" data-act="reset-modele" data-id="${x.id}" style="align-self:flex-start">Remettre le texte d'origine</button></div>
          </div></details>`).join('')}
        <div style="margin-top:12px"><button type="submit" class="btn">Enregistrer les courriels</button></div>
      </form>
      ${carteAppli()}
      <section class="carte">
        <h2>Sauvegarde</h2>
        <p class="petit doux" style="margin:0 0 12px">Une copie complète des données en un fichier. Utile avant un gros changement ou pour passer du mode démo à Microsoft 365.</p>
        <div class="actions">
          <button type="button" class="btn-2" data-act="exporter">Télécharger une sauvegarde</button>
          <label class="btn-2" for="import-fichier" style="cursor:pointer">Importer une sauvegarde</label>
          <input id="import-fichier" type="file" accept="application/json,.json" class="sr" data-chg="importer">
          ${ctx.mode === 'demo' ? '<button type="button" class="btn-2" data-act="demo-reset">Remettre les données d’exemple</button><button type="button" class="btn-2 btn-danger" data-act="demo-vider">Tout vider</button>' : ''}
        </div>
      </section>
      <p class="tres-petit doux">Hub Georama v${esc(CONFIG.version)} (${esc(CONFIG.versionDate)}). <a href="${GUIDE}" target="_blank" rel="noopener">Guide et journal des versions</a>.</p>`;
  },
  actions: {
    'installer-appli': async () => {
      const offre = window.__offreInstallation;
      if (!offre) { toast('Utilise le menu du navigateur : « Installer l’application » ou « Ajouter à l’écran d’accueil ».'); return; }
      offre.prompt();
      try { const r = await offre.userChoice; if (r && r.outcome === 'accepted') toast('Hub Georama installé.'); } catch (e) { /* rien */ }
      window.__offreInstallation = null;
    },
    'autoriser-envoi': () => auth.autoriserEnvoi(),
    'reset-modele': (ctx, el) => {
      const R = reglages(ctx.m);
      const perso = Object.assign({}, R.modelesCourriel || {});
      delete perso[el.getAttribute('data-id')];
      ctx.m.mettre('reglages', Object.assign({}, R, { id: 'general', modelesCourriel: perso }));
      toast('Texte d\u2019origine remis.');
    },
    deconnexion: ctx => ctx.global.deconnexion(),
    'changer-dossier': () => { if (confirm('Choisir un autre dossier de données sur cet appareil ?')) { ecrireLieu(null); location.reload(); } },
    'vers-demo': () => { try { localStorage.setItem('georama-hub-mode', 'demo'); } catch (e) { /* rien */ } location.reload(); },
    'vers-m365': () => { try { localStorage.setItem('georama-hub-mode', 'm365'); } catch (e) { /* rien */ } auth.seConnecter(); },
    exporter: ctx => telecharger('hub-georama-sauvegarde-' + aujourdhui() + '.json', JSON.stringify(ctx.m.exporter(), null, 1), 'application/json'),
    'demo-reset': ctx => {
      if (!confirm('Remplacer toutes les données de ce navigateur par les exemples ?')) return;
      const d = donneesDemo();
      Object.entries(d).forEach(([c, items]) => ctx.m.remplacerTout(c, items));
      ctx.m.avertir('local');
      toast('Données d’exemple remises.');
    },
    'demo-vider': ctx => {
      if (!confirm('Vider toutes les données de ce navigateur ? (Les réglages restent.)')) return;
      COLLECTIONS.filter(c => c !== 'reglages').forEach(c => ctx.m.remplacerTout(c, []));
      ctx.m.avertir('local');
      toast('Le hub est vide. Prêt pour de vraies données.');
    },
  },
  changes: {
    partage: (ctx, el) => ctx.m.mettre('reglages', Object.assign({}, reglages(ctx.m), { id: 'general', partageFait: el.checked })),
    importer: async (ctx, el) => {
      const f = el.files && el.files[0];
      if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        ctx.m.importer(obj);
        toast('Sauvegarde importée (fusionnée avec les données actuelles).');
      } catch (e) { toast('Import impossible : ' + e.message, true); }
      el.value = '';
    },
  },
  formulaires: {
    courriels: (ctx, d) => {
      const R = reglages(ctx.m);
      const perso = {};
      MODELES.forEach(x => {
        const objet = d['objet-' + x.id], corps = String(d['corps-' + x.id] || '').replace(/\r\n/g, '\n');
        if (objet !== x.objet || corps !== x.corps) perso[x.id] = { objet, corps };
      });
      const sig = String(d.signature || '').replace(/\r\n/g, '\n');
      const compte = String(d.courrielConfirmation || '').trim().toLowerCase();
      ctx.m.mettre('reglages', Object.assign({}, R, {
        id: 'general', modelesCourriel: perso, signatureCourriel: sig === SIGNATURE_DEFAUT ? '' : sig,
        confirmationAuto: d.confirmationAuto === 'on',
        courrielConfirmation: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(compte) ? compte : (R.courrielConfirmation || 'info@georama.ca'),
        confirmationAutoDepuis: /^\d{4}-\d{2}-\d{2}$/.test(d.confirmationAutoDepuis || '') ? d.confirmationAutoDepuis : (R.confirmationAutoDepuis || '2026-11-13'),
      }));
      toast('Courriels enregistrés.');
    },
    ids: (ctx, d) => {
      if (!/^[0-9a-f-]{36}$/i.test(d.clientId) || !/^[0-9a-f-]{36}$/i.test(d.tenantId)) { toast('Les deux identifiants ont la forme 00000000-0000-0000-0000-000000000000.', true); return; }
      auth.enregistrerIds(d.clientId, d.tenantId);
      try { localStorage.setItem('georama-hub-mode', 'm365'); } catch (e) { /* rien */ }
      auth.seConnecter();
    },
    reglages: (ctx, d, form) => {
      const R = reglages(ctx.m);
      const imprimantes = R.imprimantes.map((i, k) => ({ id: i.id, nom: (d['impnom-' + k] || i.nom).trim(), active: form.querySelector('[name="imp-' + k + '"]').checked }));
      if (!imprimantes.some(i => i.active)) { toast('Garde au moins une imprimante en service.', true); return; }
      const membres = String(d.membres || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const comptes = {};
      for (const ligne of String(d.comptes || '').split(/\r?\n/)) {
        const [cour, ...reste] = ligne.split('=');
        const qui = reste.join('=').trim();
        if (cour && cour.includes('@') && qui) comptes[cour.trim().toLowerCase()] = qui;
      }
      ctx.m.mettre('reglages', Object.assign({}, R, {
        id: 'general',
        heuresParPlaque: Number(d.heuresParPlaque) || R.heuresParPlaque,
        heuresParJour: Math.min(24, Number(d.heuresParJour) || R.heuresParJour),
        delaiJours: Number(d.delaiJours) || R.delaiJours,
        heuresSemaine: Number(d.heuresSemaine) || R.heuresSemaine || 10,
        chronoAuto: !!form.querySelector('[name="chronoAuto"]').checked,
        objectif: Number(d.objectif) || 0,
        livraison: Number(d.livraison) || 0,
        dateLimiteNoel: d.dateLimiteNoel || R.dateLimiteNoel,
        dernierEnvoi: d.dernierEnvoi || R.dernierEnvoi,
        taxes: !!form.querySelector('[name="taxes"]').checked,
        membres: membres.length ? membres : R.membres,
        comptes,
        imprimantes,
      }));
      if (ctx.mode === 'm365') {
        const auth0 = auth.utilisateur();
        const nom = nomDuCompte({ comptes }, ctx.courriel, auth0 ? auth0.nom : ctx.moi);
        if (nom !== ctx.moi) { ctx.moi = nom; ctx.m.qui = nom; ctx.prenom = prenom(nom); }
      }
      toast('Paramètres enregistrés.');
    },
  },
};
