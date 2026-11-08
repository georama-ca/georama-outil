// Courriels aux clients : modèles, suggestion du bon courriel au bon moment, ouverture dans Outlook.
import { esc, ouvrirFenetre, toast, prenom, dateLongue, aujourdhui, joursEntre, ilYa, argent } from './ui.js';
import { reglages, formatTexte, nomSegment, totalHT, taxesDe, journaliser, demandeApprobation } from './donnees.js';

export const MODELES = [
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
  return String(texte).replace(/\{(\w+)\}/g, (tout, k) => (k in v ? v[k] : tout));
}

// Le courriel qui convient à l'étape actuelle de la commande, s'il n'a pas déjà été envoyé.
export function suggestion(c) {
  if (!c || !c.courriel || c.statut === 'annulee') return null;
  const envoyes = new Set((c.courriels || []).map(x => x.modele));
  const s = c.statut;
  if (s === 'approbation') return envoyes.has('approbation') ? null : (envoyes.has('recue') ? 'approbation' : 'recue');
  if (s === 'nouvelle') return envoyes.has('recue') ? null : 'recue';
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
export function nomModele(id) { return (MODELES.find(x => x.id === id) || { nom: id }).nom; }

export function ouvrirCourriel(ctx, idCommande, idModele) {
  const m = ctx.m;
  const c = m.get('commandes', idCommande);
  if (!c) return;
  const liste = modeles(m);
  let choix = idModele || suggestion(c) || (demandeApprobation(c) && c.statut === 'approbation' ? 'approbation' : 'recue');
  const envoyes = c.courriels || [];
  const fichiers = ((ctx.etat.fichiers || {})[c.id] || {}).liste || [];
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
      ${choix === 'approbation' ? `<div class="bandeau info" style="margin-top:12px"><span><strong>N'oublie pas la pièce jointe.</strong> ${rendus.length ? 'Télécharge le rendu, puis glisse-le dans le courriel : ' + rendus.map(f => `<a href="${esc(f.url)}" download="${esc(c.numero + '-' + f.nom)}">${esc(f.nom)}</a>`).join(', ') : 'Pas encore de rendu 3D pour cette commande : demande-le dans la fiche de production.'}</span></div>` : ''}
      ${choix === 'expediee' && !c.suivi ? '<div class="bandeau" style="margin-top:12px"><span>Le numéro de suivi manque : ajoute-le dans la commande pour qu’il apparaisse ici.</span></div>' : ''}
      ${envoyes.length ? `<p class="tres-petit doux" style="margin:12px 0 0">Déjà préparés : ${envoyes.map(e => esc(nomModele(e.modele)) + ' (' + esc(prenom(e.par)) + ', ' + esc(ilYa(e.le)) + ')').join(' · ')}</p>` : ''}`;
  };

  const pied = `<div class="actions"><button type="button" class="btn-2" data-modal-act="copier">Copier le texte</button></div>`;
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
        return null;
      },
      onSubmit(d) {
        const a = (d.a || '').trim();
        const lien = 'mailto:' + encodeURIComponent(a).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(d.objet) + '&body=' + encodeURIComponent(String(d.corps).replace(/\r?\n/g, '\r\n'));
        const el = document.createElement('a');
        el.href = lien;
        document.body.appendChild(el);
        el.click();
        el.remove();
        marquer('outlook');
        toast('Courriel prêt dans ta messagerie. Il reste à cliquer « Envoyer ».');
      },
    });
    const ok = form.querySelector('button[type=submit]');
    if (ok) ok.textContent = 'Ouvrir dans ma messagerie';
    void dialog;
  };
  let deja = false;
  const marquer = (comment) => {
    if (deja) return;
    deja = true;
    const actuel = m.get('commandes', c.id);
    const courriels = (actuel.courriels || []).concat([{ modele: choix, le: new Date().toISOString(), par: ctx.moi, comment }]);
    m.modifier('commandes', c.id, { courriels }, true);
    journaliser(m, 'Courriel « ' + nomModele(choix) + ' » préparé pour ' + c.client + ' (' + c.numero + ')', '#/production/fiche/' + c.id, 'courriel');
    m.avertir('local');
  };
  ouvrir();
}

// Petite carte pour la fiche de production
export function carteCourriels(ctx, c) {
  const sugg = suggestion(c);
  const envoyes = (c.courriels || []).slice().reverse();
  return `<section class="carte">
    <p class="surtitre">Courriels au client</p>
    ${sugg ? `<p class="petit" style="margin:8px 0 10px">À envoyer maintenant : <strong>${esc(nomModele(sugg))}</strong></p>
      <button type="button" class="btn" data-act="courriel" data-id="${esc(c.id)}" data-modele="${sugg}" style="width:100%">Préparer « ${esc(nomModele(sugg))} »</button>`
    : `<p class="petit doux" style="margin:8px 0 10px">${c.courriel ? 'Rien à envoyer pour l’instant.' : 'Pas de courriel pour ce client.'}</p>`}
    <button type="button" class="btn-lien" data-act="courriel" data-id="${esc(c.id)}" style="margin-top:6px">Choisir un autre courriel</button>
    ${envoyes.length ? `<div style="margin-top:8px">${envoyes.slice(0, 4).map(e => `<div class="ligne tres-petit"><span class="grow">${esc(nomModele(e.modele))}</span><span class="doux">${esc(prenom(e.par))} · ${esc(ilYa(e.le))}</span></div>`).join('')}</div>` : ''}
  </section>`;
}
