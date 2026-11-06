// Tableau de bord (Cockpit).
import { esc, argent, pct, dateLongue, dateCourte, aujourdhui, joursEntre, initiales, prenom, uid, options, heures, nombre } from '../ui.js';
import { reglages, estActive, resume, planifier, nomSegment, formatTexte, fileImpression, joursAvantNoel, moisCourant, STATUTS_PROSPECT } from '../donnees.js';
import { badgeStatut, promiseTexte, ouvrirCommande } from './commandes.js';

function etatVue(ctx) {
  if (!ctx.etat.tableau) ctx.etat.tableau = { voirFaites: false };
  return ctx.etat.tableau;
}

export default {
  titre: 'Tableau de bord',
  render(ctx) {
    const m = ctx.m;
    const R = reglages(m);
    const e = etatVue(ctx);
    const cmds = m.liste('commandes');
    const actives = cmds.filter(estActive);
    const aApprouver = actives.filter(c => c.statut === 'approbation').length;
    const enProd = actives.filter(c => c.statut === 'production').length;
    const file = fileImpression(m).filter(p => p.statut !== 'fini');
    const plan = planifier(m);
    const mois = resume(m, moisCourant());
    const annee = resume(m, aujourdhui().slice(0, 4));
    const progression = R.objectif ? Math.max(0, Math.min(100, annee.benefice / R.objectif * 100)) : 0;
    const jNoel = joursAvantNoel(m);

    const noel = jNoel >= 0 ? `<div class="bandeau${plan.tard ? '' : ' vert'}">
        <strong class="o">Noël</strong>
        <span>Dernières commandes le ${esc(dateCourte(R.dateLimiteNoel))} : il reste ${jNoel} jour${jNoel > 1 ? 's' : ''}. ${file.length} plaque${file.length > 1 ? 's' : ''} en file, environ ${nombre(Math.ceil(plan.finH / 24))} jour${plan.finH > 24 ? 's' : ''} d'impression.
        ${plan.tard ? `<strong class="o">${plan.tard} plaque${plan.tard > 1 ? 's' : ''} finirai${plan.tard > 1 ? 'ent' : 't'} après le ${esc(dateCourte(R.dernierEnvoi))}.</strong>` : 'Tout part à temps.'}</span>
        <a href="#/production/planification" class="btn-lien">Voir la planification</a>
      </div>` : '';

    const prochaines = actives.slice().sort((a, b) => String(a.promise || '9').localeCompare(String(b.promise || '9'))).slice(0, 6);
    const lignesCmd = prochaines.map(c => `<button type="button" class="ligne ligne-btn" data-act="ouvrir" data-id="${esc(c.id)}">
        <span class="grow"><strong>${esc(c.numero)}</strong> · ${esc(nomSegment(c.segment))}, ${esc(c.lieu || c.client)}<br><span class="petit doux">${esc(formatTexte(c))} · ${esc(c.gamme)}</span></span>
        ${badgeStatut(c.statut)}
        <span class="petit num" style="min-width:120px;text-align:right">${promiseTexte(c)}</span>
      </button>`).join('');

    const taches = m.liste('taches').filter(t => e.voirFaites || !t.fait)
      .sort((a, b) => Number(a.fait) - Number(b.fait) || String(a.echeance || '9').localeCompare(String(b.echeance || '9')));
    const lignesT = taches.map(t => {
      const j = t.echeance ? joursEntre(aujourdhui(), t.echeance) : null;
      const quand = t.echeance ? `<span class="tres-petit ${!t.fait && j < 0 ? 'retard' : 'doux'}">${j === 0 ? 'Aujourd’hui' : esc(dateCourte(t.echeance))}</span>` : '';
      return `<div class="ligne">
        <input type="checkbox" id="t-${esc(t.id)}" data-chg="tache" data-id="${esc(t.id)}"${t.fait ? ' checked' : ''}>
        <label for="t-${esc(t.id)}" class="grow" style="cursor:pointer;${t.fait ? 'text-decoration:line-through;color:var(--texte-doux)' : ''}">${esc(t.titre)}<br>${quand}</label>
        <span class="initiales${t.qui === ctx.moi ? ' moi' : ''}" title="${esc(t.qui)}">${esc(initiales(t.qui))}</span>
        <button type="button" class="btn-ico" data-act="suppr-tache" data-id="${esc(t.id)}" aria-label="Supprimer la tâche">×</button>
      </div>`;
    }).join('');

    const prospects = m.liste('prospects').filter(p => !['gagne', 'perdu'].includes(p.statut));
    const aRelancer = prospects.filter(p => p.prochaine && p.prochaine <= aujourdhui()).length;
    const soum = prospects.filter(p => p.statut === 'soumission').length;
    const pubMois = m.liste('campagnes').reduce((s, k) => s + (Number(k.depense) || 0), 0);
    const visites = m.liste('campagnes').reduce((s, k) => s + (Number(k.visites) || 0), 0);
    const demo = ctx.mode === 'demo';

    return `
      <header class="entete">
        <div><p class="surtitre">${esc(dateLongue(aujourdhui()))}</p><h1 class="titre-1">Bonjour ${esc(prenom(ctx.moi))}</h1></div>
        <div class="actions">
          ${demo ? '<span class="etiquette vert">Données d’exemple</span>' : ''}
          <button type="button" class="btn" data-act="nouvelle">+ Nouvelle commande</button>
        </div>
      </header>
      ${demo ? `<div class="bandeau info"><span><strong>Mode démo.</strong> Tout reste dans ce navigateur. Pour travailler à deux avec les comptes Georama, active Microsoft 365 dans <a href="#/parametres">Paramètres</a>.</span></div>` : ''}
      ${noel}
      <section class="g4" aria-label="Indicateurs">
        <a class="carte kpi" href="#/commandes" style="text-decoration:none;color:inherit"><p class="surtitre">Commandes en cours</p><p class="valeur">${actives.length}</p><p class="detail">${aApprouver} à approuver · ${enProd} en production</p></a>
        <a class="carte kpi" href="#/production" style="text-decoration:none;color:inherit"><p class="surtitre">Plaques en file</p><p class="valeur">${file.length}</p><p class="detail">Environ ${heures(plan.heuresTotal)} d'impression</p></a>
        <a class="carte kpi" href="#/finances" style="text-decoration:none;color:inherit"><p class="surtitre">Ventes du mois</p><p class="valeur">${argent(mois.ventesHT)}</p><p class="detail">${mois.nbVentes} commande${mois.nbVentes > 1 ? 's' : ''} · avant taxes</p></a>
        <a class="carte kpi" href="#/finances" style="text-decoration:none;color:inherit"><p class="surtitre">Objectif annuel</p><p class="valeur">${pct(progression)}</p>
          <div class="barre" style="margin-top:10px"><span style="width:${progression}%"></span></div>
          <p class="detail">Bénéfice ${argent(annee.benefice)} sur ${argent(R.objectif)}</p></a>
      </section>
      <div class="g3">
        <section class="carte s2">
          <div class="carte-tete"><h2>Commandes qui approchent</h2><a href="#/commandes">Tout voir</a></div>
          ${lignesCmd || '<p class="vide">Aucune commande en cours.</p>'}
        </section>
        <section class="carte">
          <div class="carte-tete"><h2>À faire</h2><button type="button" class="btn-lien" data-act="voir-faites">${e.voirFaites ? 'Cacher les faites' : 'Voir les faites'}</button></div>
          <form data-form="tache" class="filtres" style="margin-bottom:6px">
            <label class="sr" for="nv-tache">Nouvelle tâche</label>
            <input id="nv-tache" name="titre" type="text" placeholder="Nouvelle tâche" required style="flex:1 1 160px">
            <label class="sr" for="nv-qui">Pour qui</label>
            <select id="nv-qui" name="qui" style="flex:1 1 120px;min-width:0">${options(ctx.membres.map(n => ({ id: n, nom: prenom(n) })), ctx.moi)}</select>
            <label class="sr" for="nv-quand">Échéance</label>
            <input id="nv-quand" name="echeance" type="date" style="flex:1 1 140px">
            <button type="submit" class="btn-2">Ajouter</button>
          </form>
          ${lignesT || '<p class="vide">Rien à faire. Profites-en.</p>'}
        </section>
      </div>
      <section class="carte g4" aria-label="Marketing et finances" style="display:grid">
        <a href="#/marketing" style="text-decoration:none;color:inherit"><p class="surtitre">Prospects actifs</p><p class="kpi valeur" style="margin:8px 0 0;font-size:26px;font-weight:700">${prospects.length}</p><p class="petit doux" style="margin:4px 0 0">${soum} en soumission${aRelancer ? ` · <span class="retard">${aRelancer} à relancer</span>` : ''}</p></a>
        <a href="#/marketing/campagnes" style="text-decoration:none;color:inherit"><p class="surtitre">Visites des pubs</p><p style="margin:8px 0 0;font-size:26px;font-weight:700" class="num">${nombre(visites)}</p><p class="petit doux" style="margin:4px 0 0">Toutes campagnes</p></a>
        <a href="#/marketing/campagnes" style="text-decoration:none;color:inherit"><p class="surtitre">Dépensé en pubs</p><p style="margin:8px 0 0;font-size:26px;font-weight:700" class="num">${argent(pubMois, 2)}</p><p class="petit doux" style="margin:4px 0 0">Toutes campagnes</p></a>
        <a href="#/finances" style="text-decoration:none;color:inherit"><p class="surtitre">À encaisser</p><p style="margin:8px 0 0;font-size:26px;font-weight:700" class="num">${argent(annee.aEncaisser, 2)}</p><p class="petit doux" style="margin:4px 0 0">Commandes non payées</p></a>
      </section>`;
  },
  actions: {
    nouvelle: ctx => ouvrirCommande(ctx, null),
    ouvrir: (ctx, el) => ouvrirCommande(ctx, el.getAttribute('data-id')),
    'voir-faites': ctx => { const e = etatVue(ctx); e.voirFaites = !e.voirFaites; ctx.rendre(); },
    'suppr-tache': (ctx, el) => ctx.m.supprimer('taches', el.getAttribute('data-id')),
  },
  changes: {
    tache: (ctx, el) => ctx.m.modifier('taches', el.getAttribute('data-id'), { fait: el.checked, faitLe: el.checked ? new Date().toISOString() : null }),
  },
  formulaires: {
    tache: (ctx, d) => {
      if (!d.titre) return;
      ctx.m.mettre('taches', { id: uid('t'), titre: d.titre, qui: d.qui || ctx.moi, echeance: d.echeance || '', fait: false });
      setTimeout(() => { const i = document.getElementById('nv-tache'); if (i) i.focus(); }, 0);
    },
  },
};
export { STATUTS_PROSPECT };
