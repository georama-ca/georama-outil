// Module Production : file d'impression, fiche de production, planification, filament.
import { esc, dateCourte, dateHeure, heures, nombre, aujourdhui, initiales, prenom, toast, ico, versDate, isoJour, ilYa, uid, ouvrirFenetre } from '../ui.js';
import {
  reglages, fileImpression, plaquesDe, avancement, heuresRestantes, planifier, nomSegment, formatTexte,
  STATUTS_PLAQUE, ETAPES, noteEtape, GAMMES, COULEURS, NOMS_GAMMES, estActive, ACTIVES, demandeApprobation,
  journaliser, agent, etatImprimanteDirect, travauxDe, dossierCommande, icoSegment,
} from '../donnees.js';
import { ouvrirCommande, badgeStatut, promiseTexte, celebrer } from './commandes.js';
import { carteCourriels, ouvrirCourriel } from '../courriels.js';

const UNITES = { A: 'AMS 2 Pro · A', B: 'AMS 2 Pro · B', HT: 'AMS HT' };

function etatVue(ctx) {
  if (!ctx.etat.prod) ctx.etat.prod = { filtre: 'afaire', simH3C: false, hpj: null, extra: 0, gamme: '', fente: '' };
  return ctx.etat.prod;
}
function pastilles(gamme, taille = 14) {
  return `<span class="pastilles" title="Gamme ${esc(gamme)}">${(GAMMES[gamme] || []).map(c => `<span class="pastille" style="width:${taille}px;height:${taille}px;background:${COULEURS[c].hex}"></span>`).join('')}</span>`;
}
function commandesMap(m) { return new Map(m.liste('commandes').map(c => [c.id, c])); }
function imprimantesActives(R) { return R.imprimantes.filter(i => i.active); }
function plaqueSur(m, idImp) { return fileImpression(m).find(p => p.statut === 'imp' && p.imprimante === idImp); }

/* ---------- Actions communes ---------- */
function marquerEtape(m, c, id, fait, qui) {
  const etapes = Object.assign({}, c.etapes || {});
  if (fait) etapes[id] = { fait: true, par: qui, le: new Date().toISOString() };
  else delete etapes[id];
  return m.modifier('commandes', c.id, { etapes }, true);
}
function apresChangementPlaques(ctx, idCommande) {
  const m = ctx.m;
  let c = m.get('commandes', idCommande);
  if (!c) return;
  const pl = plaquesDe(m, c.id);
  if (pl.length && pl.every(p => p.statut !== 'a3mf') && !(c.etapes || {})['3mf']) {
    c = marquerEtape(m, c, '3mf', true, ctx.moi);
    journaliser(m, c.numero + ' : .3mf prêt, les plaques peuvent partir', '#/production/fiche/' + c.id, 'production');
  }
  const toutes = pl.length && pl.every(p => p.statut === 'fini');
  if (toutes && !(c.etapes || {}).impression) {
    c = marquerEtape(m, c, 'impression', true, ctx.moi);
    if (c.statut === 'production' || c.statut === 'nouvelle') c = m.modifier('commandes', c.id, { statut: 'finition' }, true);
    journaliser(m, c.numero + ' : toutes les plaques sont imprimées', '#/production/fiche/' + c.id, 'production');
    toast(c.numero + ' : toutes les plaques sont imprimées. Place à la finition.');
  } else if (!toutes && (c.etapes || {}).impression) {
    c = marquerEtape(m, c, 'impression', false, ctx.moi);
  }
  if (pl.some(p => p.statut === 'imp' || p.statut === 'fini') && c.statut === 'nouvelle') m.modifier('commandes', c.id, { statut: 'production' }, true);
}
function lancer(ctx, idPlaque, idImp) {
  const m = ctx.m;
  const R = reglages(m);
  const p = m.get('plaques', idPlaque);
  const imp = idImp || (imprimantesActives(R).find(i => !plaqueSur(m, i.id)) || {}).id;
  if (!imp) { toast('Toutes les imprimantes sont occupées.', true); return; }
  const c = m.get('commandes', p.commande);
  if (c && c.statut === 'approbation') { if (!confirm(c.numero + ' attend encore l’approbation du client. Lancer quand même ?')) return; }
  m.modifier('plaques', p.id, { statut: 'imp', imprimante: imp, debut: new Date().toISOString(), par: ctx.moi }, true);
  apresChangementPlaques(ctx, p.commande);
  const nomImp = (R.imprimantes.find(i => i.id === imp) || { nom: imp }).nom.replace('Bambu Lab ', '');
  if (c) journaliser(m, c.numero + ' : plaque ' + p.n + '/' + p.total + ' lancée sur la ' + nomImp, '#/production/fiche/' + c.id, 'production');
  m.avertir('local');
  toast('Plaque ' + p.n + '/' + p.total + ' lancée sur la ' + (R.imprimantes.find(i => i.id === imp) || {}).nom.replace('Bambu Lab ', '') + '.');
}
function terminer(ctx, idPlaque) {
  const m = ctx.m;
  const p = m.get('plaques', idPlaque);
  const h = p.debut ? Math.max(0.5, (Date.now() - new Date(p.debut).getTime()) / 3600000) : null;
  m.modifier('plaques', p.id, { statut: 'fini', finLe: new Date().toISOString(), heuresReelles: h ? Math.round(h * 10) / 10 : null }, true);
  const c = m.get('commandes', p.commande);
  if (c && p.total > 1) journaliser(m, c.numero + ' : plaque ' + p.n + '/' + p.total + ' imprimée' + (h ? ' en ' + heures(h) : ''), '#/production/fiche/' + c.id, 'production');
  apresChangementPlaques(ctx, p.commande);
  m.avertir('local');
}
function changerStatutPlaque(ctx, idPlaque, statut) {
  const m = ctx.m;
  const p = m.get('plaques', idPlaque);
  const patch = { statut };
  if (statut !== 'imp') { patch.debut = null; patch.imprimante = null; }
  m.modifier('plaques', p.id, patch, true);
  apresChangementPlaques(ctx, p.commande);
  m.avertir('local');
}

/* ---------- Ordi de la maison ---------- */
export function carteAgent(ctx) {
  const a = agent(ctx.m);
  if (!a.installe) {
    return `<section class="carte agent-carte"><span class="ico-maison">${ico('maison')}</span>
      <div style="flex:1 1 300px"><strong>Ordi de la maison</strong> <span class="etiquette gris">Pas encore installé</span>
      <p class="petit doux" style="margin:4px 0 0">Un PC toujours allumé peut faire les rendus 3D, lancer Georama Production, lire l'imprimante en direct et importer les commandes du site.</p></div>
      <a class="btn-2" href="#/parametres">Comment l'installer</a></section>`;
  }
  const cap = a.capacites || {};
  const puce = (ok, nom) => `<span class="etiquette ${ok ? 'vert' : 'gris'}">${ok ? '' : 'À brancher · '}${nom}</span>`;
  return `<section class="carte agent-carte"><span class="ico-maison">${ico('maison')}</span>
    <div style="flex:1 1 300px"><strong>${esc(a.nom || 'Ordi de la maison')}</strong> ${a.enLigne ? '<span class="etiquette vert">En ligne</span>' : '<span class="etiquette orange">Hors ligne</span>'}
      <p class="petit doux" style="margin:4px 0 0">${esc(a.machine || '')} · vu ${esc(ilYa(a.vu))}${a.travail ? ' · <span class="vert-t">' + esc(a.travail) + '</span>' : ' · en attente de travail'}</p></div>
    <div class="actions">${puce(cap.rendu, 'Rendus 3D')}${puce(cap['3mf'], 'Georama Production')}${puce(cap.imprimantes, 'Imprimante en direct')}${puce(cap.wix, 'Commandes du site')}</div>
  </section>`;
}

/* ---------- File d'impression ---------- */
function vueFile(ctx) {
  const m = ctx.m;
  const R = reglages(m);
  const e = etatVue(ctx);
  const cmds = commandesMap(m);
  const toutes = fileImpression(m);
  const aFaire = toutes.filter(p => p.statut !== 'fini');
  const plan = planifier(m);
  const nb3mf = aFaire.filter(p => p.statut === 'a3mf').length;
  const libres = imprimantesActives(R).filter(i => !plaqueSur(m, i.id));

  const cartesImp = imprimantesActives(R).map(i => {
    const p = plaqueSur(m, i.id);
    const live = etatImprimanteDirect(m, i.id);
    if (!p) {
      if (live && live.etat === 'RUNNING') {
        return `<section class="carte" style="flex:1 1 340px">
          <div class="carte-tete"><h2 style="display:flex;align-items:center;gap:10px"><span class="pastille-etat"></span>${esc(i.nom)}</h2><span class="etiquette vert">Imprime · ${live.pct || 0} %</span></div>
          <p class="petit" style="margin:0 0 6px">L'imprimante imprime <strong>${esc(live.fichier || 'un fichier')}</strong>, lancé hors du hub.</p>
          <p class="tres-petit doux" style="margin:0">En direct de l'imprimante · reste ${heures((live.resteMin || 0) / 60)}</p>
        </section>`;
      }
      const prochaine = aFaire.find(x => x.statut === 'prete');
      const pc = prochaine && cmds.get(prochaine.commande);
      return `<section class="carte" style="flex:1 1 340px">
        <div class="carte-tete"><h2 style="display:flex;align-items:center;gap:10px"><span class="pastille-etat attente"></span>${esc(i.nom)}</h2><span class="etiquette bleu">Libre</span></div>
        <p class="doux petit" style="margin:0 0 12px">Plateau vide.</p>
        ${prochaine ? `<button type="button" class="btn" data-act="lancer" data-id="${esc(prochaine.id)}" data-imp="${esc(i.id)}">Lancer ${esc(pc.numero)} · plaque ${prochaine.n}/${prochaine.total}</button>`
          : `<p class="petit doux" style="margin:0">Aucune plaque prête. ${nb3mf ? nb3mf + ' .3mf à produire.' : ''}</p>`}
      </section>`;
    }
    const c = cmds.get(p.commande);
    const direct = live && ['RUNNING', 'PAUSE', 'FINISH', 'FAILED', 'PREPARE'].includes(live.etat);
    const a = direct ? Math.round(Number(live.pct) || 0) : Math.round(avancement(p) * 100);
    const fin = direct && live.resteMin != null ? new Date(Date.now() + live.resteMin * 60000) : new Date(new Date(p.debut).getTime() + (Number(p.heures) || R.heuresParPlaque) * 3600000);
    const reste = direct && live.resteMin != null ? live.resteMin / 60 : heuresRestantes(p);
    const alerte = direct && live.etat === 'FINISH' ? '<div class="bandeau vert" style="margin-top:12px"><strong class="o">Terminé.</strong><span>L\u2019imprimante a fini cette plaque. Retire-la et clique « Plaque terminée ».</span></div>'
      : direct && live.etat === 'FAILED' ? '<div class="bandeau" style="margin-top:12px"><strong class="o">Échec signalé.</strong><span>L\u2019imprimante signale un problème. Va voir sur place.</span></div>'
        : direct && live.etat === 'PAUSE' ? '<div class="bandeau" style="margin-top:12px"><strong class="o">En pause.</strong><span>L\u2019impression attend (changement de filament ou pause manuelle).</span></div>' : '';
    return `<section class="carte" style="flex:1 1 340px">
      <div class="carte-tete"><h2 style="display:flex;align-items:center;gap:10px"><span class="pastille-etat"></span>${esc(i.nom)}</h2><span class="etiquette vert">Imprime</span></div>
      <div class="imprimante">
        <div class="anneau" style="background:conic-gradient(var(--accent) 0 ${a}%, var(--bordure) ${a}% 100%)"><div><strong class="num" style="font-size:26px;line-height:30px">${a}&nbsp;%</strong><span class="tres-petit doux">plaque ${p.n}/${p.total}</span></div></div>
        <div style="flex:1 1 180px;display:flex;flex-direction:column;gap:4px">
          <strong style="font-size:17px">${esc(c.numero)}</strong>
          <span class="petit doux">${esc(c.lieu || c.client)}</span>
          <span class="petit">Reste ${direct ? '' : 'environ '}${heures(reste)} · fin ${esc(dateHeure(fin.toISOString()))}</span>
          ${direct && live.couches ? `<span class="tres-petit doux">Couche ${nombre(live.couche)} sur ${nombre(live.couches)}${live.buse ? ' · buse ' + Math.round(live.buse) + ' °C' : ''}</span>` : ''}
          <span>${pastilles(c.gamme)} <span class="tres-petit doux">${esc(c.gamme)}</span></span>
        </div>
      </div>
      <div class="actions" style="margin-top:14px">
        <button type="button" class="btn" data-act="terminer" data-id="${esc(p.id)}">Plaque terminée</button>
        <button type="button" class="btn-2" data-act="statut-plaque" data-statut="prete" data-id="${esc(p.id)}">Annuler l'impression</button>
      </div>
      ${alerte}
      <p class="tres-petit doux" style="margin:10px 0 0">${direct ? '<span class="vert-t">En direct de l\u2019imprimante</span> (par l\u2019ordi de la maison).' : 'Avancement estimé à partir de l\u2019heure de départ (' + esc(dateHeure(p.debut)) + ').'}</p>
    </section>`;
  }).join('');

  const visibles = toutes.filter(p => e.filtre === 'toutes' || (e.filtre === 'afaire' ? p.statut !== 'fini' : p.statut === 'fini'));
  const lignes = visibles.map(p => {
    const c = cmds.get(p.commande);
    const idx = toutes.indexOf(p);
    const st = STATUTS_PLAQUE[p.statut];
    let bouton = '';
    if (p.statut === 'a3mf') bouton = `<button type="button" class="btn-2" data-act="statut-plaque" data-statut="prete" data-id="${esc(p.id)}">Le .3mf est fait</button>`;
    else if (p.statut === 'prete') bouton = libres.length ? `<button type="button" class="btn" data-act="lancer" data-id="${esc(p.id)}">Lancer</button>` : '<span class="tres-petit doux">Imprimante occupée</span>';
    else if (p.statut === 'imp') bouton = `<button type="button" class="btn" data-act="terminer" data-id="${esc(p.id)}">Terminée</button>`;
    else bouton = `<button type="button" class="btn-lien" data-act="statut-plaque" data-statut="prete" data-id="${esc(p.id)}">Remettre dans la file</button>`;
    const fin = plan.blocs.find(b => b.p.id === p.id);
    return `<tr>
      <td><div class="rang">
        <button type="button" class="btn-ico" data-act="monter" data-id="${esc(p.id)}" aria-label="Monter"${idx === 0 ? ' disabled' : ''}>${ico('haut')}</button>
        <button type="button" class="btn-ico" data-act="descendre" data-id="${esc(p.id)}" aria-label="Descendre"${idx === toutes.length - 1 ? ' disabled' : ''}>${ico('bas')}</button>
      </div></td>
      <td><a href="#/production/fiche/${esc(c.id)}"><strong>${esc(c.numero)}</strong></a> · plaque ${p.n}/${p.total}<br><span class="petit doux">${esc(nomSegment(c.segment))}, ${esc(c.lieu || c.client)}</span></td>
      <td>${pastilles(c.gamme)}<br><span class="tres-petit doux">${esc(c.gamme)}</span></td>
      <td class="num">${heures(p.statut === 'fini' ? (p.heuresReelles || p.heures) : heuresRestantes(p))}</td>
      <td class="petit num">${fin ? `<span class="${fin.enRetard ? 'retard' : ''}">${esc(dateCourte(isoJour(fin.finDate)))}</span>` : (p.finLe ? esc(dateCourte(p.finLe.slice(0, 10))) : '')}</td>
      <td><span class="etiquette ${st.classe}">${esc(st.nom)}</span></td>
      <td class="droite">${bouton}</td>
    </tr>`;
  }).join('');

  const puce = (id, nom) => `<button type="button" class="puce" data-act="filtre" data-filtre="${id}" aria-pressed="${e.filtre === id}">${nom}</button>`;
  return `
    <section class="g4" aria-label="Indicateurs">
      <div class="carte kpi"><p class="surtitre">Plaques à faire</p><p class="valeur">${aFaire.length}</p><p class="detail">${aFaire.filter(p => p.statut === 'prete').length} prêtes à lancer</p></div>
      <div class="carte kpi"><p class="surtitre">Heures restantes</p><p class="valeur">${nombre(Math.round(plan.heuresTotal))}&nbsp;h</p><p class="detail">${R.heuresParJour} h d'impression par jour</p></div>
      <div class="carte kpi"><p class="surtitre">Fin estimée</p><p class="valeur" style="font-size:22px">${aFaire.length ? esc(plan.fin.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })) : '—'}</p><p class="detail">${plan.tard ? `<span class="retard">${plan.tard} après le ${esc(dateCourte(R.dernierEnvoi))}</span>` : 'Avant le dernier envoi de Noël'}</p></div>
      <div class="carte kpi"><p class="surtitre">.3mf à produire</p><p class="valeur">${nb3mf}</p><p class="detail">Dans Georama Production</p></div>
    </section>
    ${carteAgent(ctx)}
    <div class="cote">${cartesImp}</div>
    <section class="carte">
      <div class="carte-tete"><h2>Ordre d'impression</h2><div class="filtres">${puce('afaire', 'À faire')}${puce('finies', 'Imprimées')}${puce('toutes', 'Toutes')}</div></div>
      <div class="table-boite"><table class="liste">
        <thead><tr><th><span class="sr">Ordre</span></th><th>Commande</th><th>Gamme</th><th>Durée</th><th>Fin prévue</th><th>Statut</th><th><span class="sr">Action</span></th></tr></thead>
        <tbody>${lignes || '<tr><td colspan="7" class="vide">La file est vide. Les plaques arrivent ici dès qu’une commande est créée.</td></tr>'}</tbody>
      </table></div>
      <p class="tres-petit doux" style="margin:10px 0 0">Les flèches changent l'ordre. La fin prévue se recalcule toute seule (en orange : après la date promise au client).</p>
    </section>`;
}

/* ---------- Fiche de production ---------- */
const CLE_CHRONO = 'georama-hub-chrono';
function lireChrono() { try { return JSON.parse(localStorage.getItem(CLE_CHRONO) || '{}'); } catch (e) { return {}; } }
function ecrireChrono(o) { try { localStorage.setItem(CLE_CHRONO, JSON.stringify(o)); } catch (e) { /* rien */ } }

function vueFiche(ctx) {
  const m = ctx.m;
  const enCours = m.liste('commandes').filter(c => ACTIVES.includes(c.statut))
    .sort((a, b) => String(a.promise || '9').localeCompare(String(b.promise || '9')));
  let c = ctx.route.id ? m.get('commandes', ctx.route.id) : null;
  if (!c) c = enCours[0];
  if (!c) return '<p class="vide">Aucune commande en cours. Les fiches apparaissent ici dès qu’une commande est créée.</p>';
  const cartes = (enCours.includes(c) ? enCours : [c].concat(enCours)).map(x => {
    const n = ETAPES.filter(s => (x.etapes || {})[s.id]).length;
    return `<a class="cmd-carte" href="#/production/fiche/${esc(x.id)}"${x.id === c.id ? ' aria-current="true"' : ''}>
      <span style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px"><strong style="white-space:nowrap">${esc(x.numero)}</strong>${badgeStatut(x.statut)}</span>
      <span class="petit doux">${esc(x.lieu || x.client)}</span>
      <span class="barre"><span style="width:${Math.round(n / ETAPES.length * 100)}%"></span></span>
      <span class="tres-petit doux">${n}/${ETAPES.length} étapes · promise ${esc(dateCourte(x.promise))}</span>
    </a>`;
  }).join('');
  const pl = plaquesDe(m, c.id);
  const impr = pl.filter(p => p.statut === 'fini').length;
  const nFait = ETAPES.filter(s => (c.etapes || {})[s.id]).length;
  const prochaine = ETAPES.find(s => !(c.etapes || {})[s.id]);
  const etapes = ETAPES.map((s, i) => {
    const f = (c.etapes || {})[s.id];
    const auto = s.id === 'impression';
    const extra = s.id === 'filament' ? `<div style="margin-top:4px">${pastilles(c.gamme, 18)}</div>`
      : auto ? `<div class="actions" style="margin-top:6px"><span class="etiquette ${impr === pl.length && pl.length ? 'vert' : ''}">${impr}/${pl.length} plaque${pl.length > 1 ? 's' : ''} imprimée${impr > 1 ? 's' : ''}</span>${pl.filter(p => p.statut !== 'fini').map(p => `<span class="etiquette ${STATUTS_PLAQUE[p.statut].classe}">${p.n} · ${esc(STATUTS_PLAQUE[p.statut].nom)}</span>`).join('')}<a href="#/production" class="btn-lien">File d'impression</a></div>`
        : s.id === '3mf' && c.lien ? `<div style="margin-top:4px"><a href="${esc(c.lien)}" target="_blank" rel="noopener">Ouvrir la zone du client</a></div>`
          : s.id === 'envoi' && c.suivi ? `<div class="tres-petit doux" style="margin-top:4px">Suivi : ${esc(c.suivi)}</div>` : '';
    return `<div class="etape${f ? ' faite' : ''}">
      <input type="checkbox" id="et-${s.id}" data-chg="etape" data-etape="${s.id}"${f ? ' checked' : ''}${auto ? ' disabled' : ''} style="width:24px;height:24px;margin-top:2px">
      <div style="flex:1 1 auto;min-width:0">
        <label for="et-${s.id}" class="etape-titre">${i + 1}. ${esc(s.id === 'filament' ? 'Charger la gamme ' + (c.gamme || '') : s.titre)}</label>
        <div class="petit doux">${esc(noteEtape(s.id, c))}</div>
        ${f ? `<div class="tres-petit vert-t" style="margin-top:2px">Fait par ${esc(prenom(f.par))} · ${esc(dateHeure(f.le))}</div>` : ''}
        ${extra}
      </div>
    </div>`;
  }).join('');
  const ch = lireChrono()[c.id];
  const minutes = (Number(c.tempsMin) || 0) + (ch ? Math.floor((Date.now() - ch) / 60000) : 0);
  return `
    <div class="cmd-cartes" aria-label="Commandes en cours">${cartes}</div>
    <div class="cote">
      <div class="principal" style="display:flex;flex-direction:column;gap:16px">
      ${carteFichiers(ctx, c)}
      <section class="carte">
        <div class="carte-tete"><h2 style="display:flex;align-items:center;gap:10px">${icoSegment(c.segment, 22)}${esc(c.numero)} · ${esc(c.lieu || c.client)}</h2><span class="petit doux">${esc(formatTexte(c))} · gamme ${esc(c.gamme)}</span></div>
        ${demandeApprobation(c) && c.statut === 'approbation' ? '<div class="bandeau" style="margin-bottom:8px"><span>Cette commande attend l’approbation écrite du client (info@georama.ca) avant l’impression.</span></div>' : ''}
        ${etapes}
      </section>
      </div>
      <aside class="lateral" style="display:flex;flex-direction:column;gap:16px">
        <section class="carte">
          <p class="surtitre">Avancement</p>
          <p class="num" style="margin:6px 0;font-size:28px;font-weight:700">${Math.round(nFait / ETAPES.length * 100)}&nbsp;%</p>
          <div class="barre"><span style="width:${Math.round(nFait / ETAPES.length * 100)}%"></span></div>
          <p class="petit" style="margin:10px 0 0">${prochaine ? 'Prochaine étape : <strong>' + esc(prochaine.titre) + '</strong>' : '<strong class="vert-t">Maquette livrée. Bravo.</strong>'}</p>
        </section>
        ${carteCourriels(ctx, c)}
        <section class="carte">
          <p class="surtitre">Temps de travail</p>
          <p class="num" style="margin:6px 0;font-size:28px;font-weight:700" id="chrono-val">${heures(minutes / 60)}</p>
          <p class="tres-petit doux" style="margin:0 0 10px">Repère : environ 1 h par maquette, hors impression.</p>
          <div class="actions">
            <button type="button" class="btn" data-act="chrono">${ch ? 'Arrêter le chrono' : 'Démarrer le chrono'}</button>
            <button type="button" class="btn-2" data-act="ajout-temps">+15 min</button>
          </div>
        </section>
        <section class="carte petit" style="display:flex;flex-direction:column;gap:6px">
          <p class="surtitre">Commande</p>
          <span><strong>${esc(c.client)}</strong>${c.courriel ? ` · <a href="mailto:${esc(c.courriel)}">${esc(c.courriel)}</a>` : ''}</span>
          <span>${esc(nomSegment(c.segment))} · promise ${promiseTexte(c)}</span>
          <span>${c.livraison === 'recuperation' ? 'Récupération à Saint-Félicien' : 'Postes Canada'}</span>
          ${c.notes ? `<span class="doux">${esc(c.notes)}</span>` : ''}
          <span>Responsable : ${esc(c.responsable)}</span>
          <button type="button" class="btn-2" data-act="modifier" data-id="${esc(c.id)}" style="margin-top:6px">Modifier la commande</button>
        </section>
      </aside>
    </div>`;
}
function carteFichiers(ctx, c) {
  const m = ctx.m;
  const a = agent(m);
  const cache = (ctx.etat.fichiers || {})[c.id];
  const fichiers = cache ? cache.liste : null;
  const images = (fichiers || []).filter(f => f.image).sort((x, y) => String(y.maj).localeCompare(String(x.maj)));
  const modeles = (fichiers || []).filter(f => /\.3mf$/i.test(f.nom));
  const autres = (fichiers || []).filter(f => !f.image && !/\.3mf$/i.test(f.nom));
  const tr = travauxDe(m, c.id).slice(0, 4);
  const enCours = tr.some(t => !t.resultat || t.resultat.statut === 'en_cours');
  const etiquette = t => {
    const r = t.resultat;
    if (!r) return '<span class="etiquette bleu">En attente</span>';
    if (r.statut === 'en_cours') return '<span class="etiquette vert">En cours…</span>';
    if (r.statut === 'fait') return '<span class="etiquette plein">Fait</span>';
    return '<span class="etiquette orange">À voir</span>';
  };
  const petiteIco = (n, extra = '') => ico(n).replace('<svg', '<svg width="16" height="16"' + extra);
  const galerie = images.length
    ? `<div class="galerie">${images.map(f => `<figure><img src="${esc(f.url)}" alt="Rendu 3D ${esc(f.nom)}" loading="lazy" data-act="voir-image" data-url="${esc(f.url)}" data-nom="${esc(f.nom)}"><figcaption><span>${esc(f.nom.replace(/-rendu\.png$/i, ''))}</span><span>${esc(ilYa(f.maj))}</span></figcaption></figure>`).join('')}</div>`
    : fichiers === null ? '<p class="petit doux">Lecture des fichiers…</p>'
      : `<div class="vide" style="border:1px dashed var(--bordure);border-radius:8px">${ico('image').replace('<svg', '<svg width="28" height="28"')}<br>Pas encore de rendu 3D.<br><span class="tres-petit">Dépose le .3mf dans OneDrive › Hub-Georama › ${esc(dossierCommande(c))}, ou demande-le à l'ordi de la maison.</span></div>`;
  const listeFichiers = modeles.concat(autres).map(f => `<div class="ligne"><span style="display:flex;gap:8px;align-items:center" class="grow">${petiteIco('fichier')}${f.webUrl ? `<a href="${esc(f.webUrl)}" target="_blank" rel="noopener">${esc(f.nom)}</a>` : esc(f.nom)}</span><span class="tres-petit doux">${f.taille ? nombre(f.taille / 1048576, 1) + ' Mo · ' : ''}${esc(ilYa(f.maj))}</span></div>`).join('');
  const etatAgent = a.installe
    ? (a.enLigne ? '<span class="tres-petit vert-t">Ordi de la maison en ligne</span>' : '<span class="tres-petit doux">Ordi de la maison hors ligne : le travail attendra</span>')
    : '<a class="tres-petit" href="#/parametres">Installer l’ordi de la maison</a>';
  return `<section class="carte">
    <div class="carte-tete"><h2>Rendus 3D et fichiers</h2>
      <div class="actions">${cache && cache.url ? `<a class="btn-lien" href="${esc(cache.url)}" target="_blank" rel="noopener">${petiteIco('dossier', ' style="vertical-align:-3px"')} Dossier OneDrive</a>` : ''}
      <button type="button" class="btn-lien" data-act="rafraichir-fichiers">Actualiser</button></div></div>
    ${galerie}
    ${listeFichiers ? `<div style="margin-top:10px">${listeFichiers}</div>` : ''}
    ${blocProduction(ctx, c, a, petiteIco)}
    <div class="actions" style="margin-top:10px">
      <button type="button" class="btn-2" data-act="travail" data-type="rendu"${modeles.length ? '' : ' disabled title="Il faut d’abord un .3mf"'}>Refaire le rendu 3D</button>
      ${etatAgent}
    </div>
    ${c.lien ? '' : '<p class="tres-petit doux" style="margin:6px 0 0">Pour produire le .3mf ici, ajoute le lien de la zone dans la commande.</p>'}
    ${tr.length ? `<div style="margin-top:12px">${tr.map(t => `<div class="ligne"><span class="grow petit"><strong>${esc(NOMS_TRAVAUX[t.type] || t.type)}</strong>${t.options && (t.options.gamme || t.options.format) ? ' <span class="tres-petit doux">(' + esc([t.options.format && FORMATS_PROD[t.options.format], t.options.gamme && GAMMES_PROD[t.options.gamme]].filter(Boolean).join(', ')) + ')</span>' : ''} · demandé par ${esc(prenom(t.demandePar))} ${esc(ilYa(t.demandeLe))}${t.resultat && t.resultat.message ? '<br><span class="doux">' + esc(t.resultat.message) + '</span>' : ''}</span>${etiquette(t)}</div>`).join('')}</div>` : ''}
    ${enCours ? '<p class="tres-petit doux" style="margin:8px 0 0">La page se met à jour toute seule.</p>' : ''}
  </section>`;
}
async function chargerFichiers(ctx, c, force = false) {
  ctx.etat.fichiers = ctx.etat.fichiers || {};
  const sig = JSON.stringify((ctx.m.externes.resultats || []).filter(r => r.commande === c.id || String(r.id).includes(c.numero)).map(r => r.statut + r.maj));
  const ex = ctx.etat.fichiers[c.id];
  if (!force && ex && (ex.chargement || (ex.sig === sig && Date.now() - ex.t < 60000))) return;
  ctx.etat.fichiers[c.id] = Object.assign({}, ex || { liste: null }, { chargement: true });
  try {
    const liste = await ctx.m.a.lister(dossierCommande(c));
    let url = ex && ex.url;
    if (!url && ctx.m.a.urlDossier) url = await ctx.m.a.urlDossier(dossierCommande(c)).catch(() => null);
    ctx.etat.fichiers[c.id] = { liste, url, t: Date.now(), sig };
  } catch (e) {
    ctx.etat.fichiers[c.id] = { liste: [], url: null, t: Date.now(), sig, erreur: e.message };
  }
  if (ctx.route.vue === 'production' && ctx.route.sous === 'fiche') ctx.rendre();
}

function ficheCourante(ctx) {
  const m = ctx.m;
  let c = ctx.route.id ? m.get('commandes', ctx.route.id) : null;
  if (!c) c = m.liste('commandes').filter(x => ACTIVES.includes(x.statut)).sort((a, b) => String(a.promise || '9').localeCompare(String(b.promise || '9')))[0];
  return c;
}

/* ---------- Planification ---------- */
function vuePlanif(ctx) {
  const m = ctx.m;
  const R = reglages(m);
  const e = etatVue(ctx);
  const hpj = e.hpj || R.heuresParJour;
  const actives = imprimantesActives(R);
  const h3c = R.imprimantes.find(i => !i.active);
  const imps = actives.concat(e.simH3C && h3c ? [h3c] : []);
  const plan = planifier(m, { imprimantes: imps, heuresParJour: hpj, extra: e.extra });
  const jours = Math.max(Math.ceil(plan.limiteH / 24) + 7, Math.ceil(plan.finH / 24) + 3, 21);
  const pctH = h => (Math.max(0, Math.min(h, jours * 24)) / (jours * 24) * 100).toFixed(2);
  const ticks = [];
  for (let k = 0; k < jours; k += 7) { const d = new Date(); d.setDate(d.getDate() + k); ticks.push({ g: (k / jours * 100).toFixed(2), t: d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) }); }
  const pistes = imps.map(i => {
    const barres = plan.blocs.filter(b => b.imp === i.id).map(b => {
      const nom = b.p.simule ? 'Noël' : (b.c ? b.c.numero.replace(/^([GS])-\d{4}-/, '$1-') + (b.p.total > 1 ? ' ' + b.p.n + '/' + b.p.total : '') : '');
      const fond = b.tard ? 'var(--balise)' : b.p.simule ? 'var(--eau)' : b.p.statut === 'imp' ? '#A3B972' : 'var(--accent)';
      return `<span class="gantt-barre" title="${esc(nom)} · fin ${esc(dateHeure(b.finDate.toISOString()))}" style="left:${pctH(b.debut)}%;width:${Math.max(0.4, pctH(b.fin) - pctH(b.debut))}%;background:${fond}">${esc(nom)}</span>`;
    }).join('');
    return `<div class="gantt-ligne"><span class="gantt-nom">${esc(i.nom.replace('Bambu Lab ', ''))}${i.active ? '' : '<br><span class="tres-petit doux">simulée</span>'}</span>
      <div class="gantt-piste">${ticks.map(t => `<span class="gantt-trait" style="left:${t.g}%"></span>`).join('')}<span class="gantt-limite" style="left:${pctH(plan.limiteH)}%"></span>${barres}</div></div>`;
  }).join('');
  const ok = plan.tard === 0;
  return `
    <div class="bandeau${ok ? ' vert' : ''}" style="font-size:16px">
      <strong class="o">${ok ? 'Tout part à temps.' : plan.tard + ' plaque' + (plan.tard > 1 ? 's' : '') + ' après le ' + esc(dateCourte(R.dernierEnvoi)) + '.'}</strong>
      <span>${ok ? (plan.margeJours >= 0 ? 'Il reste ' + plan.margeJours + ' jour' + (plan.margeJours > 1 ? 's' : '') + ' de marge avant le dernier envoi pour Noël.' : '') : 'Ajoute une imprimante, imprime plus d’heures par jour ou ferme les commandes plus tôt.'}</span>
    </div>
    <section class="carte g3" style="display:grid" aria-label="Réglages de la simulation">
      <div style="display:flex;flex-direction:column;gap:8px">
        <span class="surtitre">Imprimantes</span>
        <div class="filtres">
          <button type="button" class="puce" data-act="sim-h3c" aria-pressed="${!e.simH3C}">${esc(actives.map(i => i.nom.replace('Bambu Lab ', '')).join(' + ') || 'Aucune')}</button>
          ${h3c ? `<button type="button" class="puce" data-act="sim-h3c" aria-pressed="${e.simH3C}">+ ${esc(h3c.nom.replace('Bambu Lab ', ''))} (simulation)</button>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <label class="surtitre" for="sim-hpj">Impression par jour : ${hpj} h</label>
        <input id="sim-hpj" type="range" min="6" max="24" step="1" value="${hpj}" data-input="sim-hpj">
        <span class="tres-petit doux">Retraits de plaques et nuits sans surveillance réduisent ce nombre.</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <label class="surtitre" for="sim-extra">Commandes de Noël à venir : ${e.extra} plaque${e.extra > 1 ? 's' : ''}</label>
        <input id="sim-extra" type="range" min="0" max="60" step="1" value="${e.extra}" data-input="sim-extra">
        <span class="tres-petit doux">Environ ${R.heuresParPlaque} h chacune (10 × 12 po).</span>
      </div>
    </section>
    <section class="g4" aria-label="Résultat">
      <div class="carte kpi"><p class="surtitre">Plaques</p><p class="valeur">${plan.nbPlaques}</p></div>
      <div class="carte kpi"><p class="surtitre">Heures d'impression</p><p class="valeur">${nombre(Math.round(plan.heuresTotal))}&nbsp;h</p></div>
      <div class="carte kpi"><p class="surtitre">Fin de production</p><p class="valeur" style="font-size:22px">${plan.nbPlaques ? esc(plan.fin.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })) : '—'}</p></div>
      <div class="carte kpi"><p class="surtitre">Capacité par semaine</p><p class="valeur">${plan.capaciteSemaine}</p><p class="detail">plaques de ${R.heuresParPlaque} h</p></div>
    </section>
    <section class="carte table-boite">
      <div style="min-width:760px">
        <div class="filtres tres-petit" style="margin-bottom:8px">
          <span style="display:inline-flex;align-items:center;gap:6px"><span class="pastille" style="border-radius:3px;background:var(--accent)"></span>Commandes reçues</span>
          <span style="display:inline-flex;align-items:center;gap:6px"><span class="pastille" style="border-radius:3px;background:var(--eau)"></span>Noël à venir (simulation)</span>
          <span style="display:inline-flex;align-items:center;gap:6px"><span class="pastille" style="border-radius:3px;background:var(--balise)"></span>Après le ${esc(dateCourte(R.dernierEnvoi))}</span>
        </div>
        <div style="position:relative;height:22px;margin-left:90px">${ticks.map(t => `<span class="tres-petit doux" style="position:absolute;left:${t.g}%;font-weight:600">${esc(t.t)}</span>`).join('')}</div>
        ${pistes}
        <p class="tres-petit doux" style="margin:8px 0 0 90px">Trait orange : ${esc(dateCourte(R.dernierEnvoi))}, dernier envoi pour une livraison avant Noël. Simulation seulement : rien n'est modifié.</p>
      </div>
    </section>`;
}

/* ---------- Filament ---------- */
function stock(m, couleur) { const b = m.get('filament', 'b-' + couleur); return b ? Number(b.stock) || 0 : 0; }
function vueFilament(ctx) {
  const m = ctx.m;
  const e = etatVue(ctx);
  const fentes = m.liste('filament').filter(f => f.type === 'ams').sort((a, b) => (a.unite + a.n).localeCompare(b.unite + b.n));
  if (!e.fente && fentes[0]) e.fente = fentes[0].id;
  const sel = fentes.find(f => f.id === e.fente);
  const prochaine = fileImpression(m).find(p => p.statut !== 'fini');
  const cmdP = prochaine && m.get('commandes', prochaine.commande);
  const gamme = e.gamme || (cmdP && cmdP.gamme) || 'Boréal';
  const unites = ['A', 'B', 'HT'].map(u => {
    const fs = fentes.filter(f => f.unite === u);
    if (!fs.length) return '';
    return `<section class="carte"><h2 style="font-size:16px">${esc(UNITES[u])}</h2><div class="ams">${fs.map(f => {
      const coul = COULEURS[f.couleur];
      const kg = Number(f.kg) || 0;
      const bas = coul && kg < 0.15;
      return `<button type="button" class="fente" data-act="fente" data-id="${esc(f.id)}" aria-pressed="${f.id === e.fente}" aria-label="${esc(UNITES[u])} emplacement ${f.n} : ${esc(coul ? coul.nom : 'vide')}">
        <span class="tres-petit doux" style="align-self:flex-start;font-weight:700">${f.n}</span>
        <span class="bobine" style="background:${coul ? coul.hex : 'transparent'};${coul ? '' : 'border-style:dashed'}"></span>
        <strong class="petit">${esc(coul ? coul.nom : 'Vide')}</strong>
        <span class="petit num" style="color:${bas ? 'var(--balise)' : 'var(--accent-texte)'}">${coul ? nombre(kg, 1) + ' kg' : '—'}</span>
        <span class="barre${bas ? ' orange' : ''}" style="width:100%;height:6px"><span style="width:${Math.round(Math.min(1, kg) * 100)}%"></span></span>
      </button>`;
    }).join('')}</div></section>`;
  }).join('');
  const besoins = (GAMMES[gamme] || []).map(c => {
    const f = fentes.find(x => x.couleur === c);
    let etat, cls;
    if (!f) { etat = 'Pas chargé' + (stock(m, c) ? ' · ' + stock(m, c) + ' sur l’étagère' : ' · aucune bobine'); cls = 'retard'; }
    else if ((Number(f.kg) || 0) < 0.15) { etat = 'Presque vide · ' + nombre(f.kg, 1) + ' kg'; cls = 'retard'; }
    else { etat = (f.unite === 'HT' ? 'HT' : 'AMS ' + f.unite) + '-' + f.n + ' · ' + nombre(f.kg, 1) + ' kg'; cls = 'vert-t'; }
    return { c, etat, cls };
  });
  const manque = besoins.filter(b => b.cls === 'retard').length;
  const etagere = Object.keys(COULEURS).map(k => {
    const s = stock(m, k);
    return `<div class="ligne" style="padding:4px 0">
      <span class="pastille" style="width:18px;height:18px;background:${COULEURS[k].hex}"></span>
      <span class="grow petit">${esc(COULEURS[k].nom)}</span>
      <button type="button" class="btn-ico" data-act="stock" data-c="${k}" data-d="-1" aria-label="Retirer une bobine ${esc(COULEURS[k].nom)}">−</button>
      <strong class="num" style="width:24px;text-align:center;${s ? '' : 'color:var(--balise)'}">${s}</strong>
      <button type="button" class="btn-ico" data-act="stock" data-c="${k}" data-d="1" aria-label="Ajouter une bobine ${esc(COULEURS[k].nom)}">+</button>
    </div>`;
  }).join('');
  const achats = Object.keys(COULEURS).filter(k => stock(m, k) === 0).map(k => {
    const b = m.get('filament', 'b-' + k);
    return `<div class="ligne"><span class="pastille" style="width:18px;height:18px;background:${COULEURS[k].hex}"></span><span class="grow petit">${esc(COULEURS[k].nom)}</span>
      <button type="button" class="${b && b.commandee ? 'etiquette vert' : 'btn-2'}" style="${b && b.commandee ? 'cursor:pointer;background:none' : 'min-height:36px;font-size:12px'}" data-act="commandee" data-c="${k}">${b && b.commandee ? 'Commandée' : 'Marquer commandée'}</button></div>`;
  }).join('');
  const coulSel = sel && COULEURS[sel.couleur];
  return `
    <div class="cote">
      <div class="principal" style="display:flex;flex-direction:column;gap:16px">
        ${unites || '<p class="vide">Aucun AMS configuré.</p>'}
        ${sel ? `<section class="carte">
          <div class="carte-tete"><h2>${esc(UNITES[sel.unite])} · emplacement ${sel.n} : ${esc(coulSel ? coulSel.nom : 'vide')}</h2>
            <div class="actions">
              <button type="button" class="btn-2" data-act="conso"${coulSel ? '' : ' disabled'}>−100 g</button>
              <button type="button" class="btn" data-act="neuve"${coulSel ? '' : ' disabled'}>Bobine neuve</button>
              <button type="button" class="btn-lien" data-act="vider"${coulSel ? '' : ' disabled'}>Vider</button>
            </div></div>
          <p class="petit doux" style="margin:0 0 8px">Charger une autre couleur (prend une bobine sur l'étagère) :</p>
          <div class="palette">${Object.keys(COULEURS).map(k => `<button type="button" data-act="charger" data-c="${k}" aria-pressed="${sel.couleur === k}" style="background:${COULEURS[k].hex}" title="${esc(COULEURS[k].nom)} (${stock(m, k)} en stock)" aria-label="${esc(COULEURS[k].nom)}, ${stock(m, k)} en stock"></button>`).join('')}</div>
        </section>` : ''}
      </div>
      <aside class="lateral" style="display:flex;flex-direction:column;gap:16px">
        <section class="carte">
          <h2>Prêt pour quelle gamme ?</h2>
          <div class="filtres" style="margin-bottom:8px">${NOMS_GAMMES.map(g => `<button type="button" class="puce" data-act="gamme" data-g="${esc(g)}" aria-pressed="${g === gamme}">${esc(g)}</button>`).join('')}</div>
          ${cmdP && !e.gamme ? `<p class="tres-petit doux" style="margin:0 0 6px">Gamme de la prochaine plaque : ${esc(cmdP.numero)}.</p>` : ''}
          <p style="margin:4px 0 6px;font-weight:700" class="${manque ? 'retard' : 'vert-t'}">${manque ? manque + ' couleur' + (manque > 1 ? 's' : '') + ' à régler.' : 'Prêt à imprimer en ' + esc(gamme) + '.'}</p>
          ${besoins.map(b => `<div class="ligne"><span class="pastille" style="width:20px;height:20px;background:${COULEURS[b.c].hex}"></span><span class="grow petit">${esc(COULEURS[b.c].nom)}</span><span class="tres-petit ${b.cls}" style="font-weight:600">${esc(b.etat)}</span></div>`).join('')}
        </section>
        <section class="carte"><h2>Étagère (bobines de 1 kg)</h2>${etagere}</section>
        <section class="carte"><h2>Liste d'achats</h2>${achats || '<p class="vide">Rien à commander.</p>'}</section>
      </aside>
    </div>`;
}
function majFente(ctx, patch) {
  const e = etatVue(ctx);
  ctx.m.modifier('filament', e.fente, patch);
}
function changerStock(m, couleur, delta) {
  const id = 'b-' + couleur;
  const b = m.get('filament', id);
  const n = Math.max(0, (b ? Number(b.stock) || 0 : 0) + delta);
  m.mettre('filament', Object.assign({ id, type: 'bobine', couleur }, b || {}, { stock: n, commandee: delta > 0 ? false : (b ? b.commandee : false) }));
}

/* ---------- Vue ---------- */
// Georama Production depuis le hub (v1.4) : aperçu rapide, .3mf et PDF client, gamme et format au choix.
const NOMS_TRAVAUX = { apercu: 'Aperçu rapide', '3mf': 'Production du .3mf', pdf: 'PDF client', rendu: 'Rendu 3D' };
const FORMATS_PROD = { base: '10 × 12 po', gf4: '20 × 24 po', gf6: '24 × 30 po' };
const GAMMES_PROD = { boreal: 'Boréal', sapiniere: 'Sapinière', arctique: 'Arctique', terre: 'Terre', unie: 'Monochrome' };
function blocProduction(ctx, c, a, petiteIco) {
  const cap = a.capacites || {};
  const choix = ((etatVue(ctx).choixProd || {})[c.id]) || {};
  const sansLien = c.lien ? '' : ' disabled title="Ajoute le lien de la zone dans la commande"';
  const opt = (liste, val) => Object.entries(liste).map(([k, v]) => `<option value="${k}"${k === val ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const vieux = a.installe && cap['3mf'] && !cap.apercu
    ? '<p class="tres-petit doux" style="margin:6px 0 0">L’ordi de la maison a une ancienne version de l’agent : seul « Produire le .3mf » marche (réglages du lien). Mets l’agent à jour pour l’aperçu, le PDF, la gamme et le format.</p>' : '';
  return `<div class="bloc-prod" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--bordure)">
    <h3 class="petit" style="margin:0 0 8px">Georama Production</h3>
    <div class="champs">
      <div class="champ"><label for="gp-format">Format</label><select id="gp-format" data-chg="choix-prod" data-cle="format"><option value="">Celui du lien</option>${opt(FORMATS_PROD, choix.format)}</select></div>
      <div class="champ"><label for="gp-gamme">Gamme de couleurs</label><select id="gp-gamme" data-chg="choix-prod" data-cle="gamme"><option value="">Celle du lien</option>${opt(GAMMES_PROD, choix.gamme)}</select></div>
    </div>
    <div class="actions" style="margin-top:10px">
      <button type="button" class="btn-2" data-act="travail" data-type="apercu"${sansLien}>Aperçu rapide</button>
      <button type="button" class="btn" data-act="travail" data-type="3mf"${sansLien}>${petiteIco('eclair')} Produire le .3mf</button>
      <button type="button" class="btn-2" data-act="travail" data-type="pdf"${sansLien}>PDF client</button>
      <a class="btn-lien seulement-ordi" href="#/production/georama/${esc(c.id)}">Ouvrir dans Georama Production (cet ordi)</a>
    </div>
    <p class="tres-petit doux" style="margin:6px 0 0">Fait sur l’ordi de la maison. Aperçu : quelques minutes. .3mf : jusqu’à quelques heures. Le PDF reprend le dernier calcul (et le rendu 3D s’il y en a un). Pour la carte, les repères et les couleurs une à une : Georama Production sur l’ordi.</p>
    ${vieux}
  </div>`;
}

// Georama Production intégré au hub (v1.6, ordinateur seulement) : l'interface du programme local
// (http://127.0.0.1:8765, sur l'ordi où l'on se trouve) dans un cadre qui reste ouvert pendant qu'on
// navigue dans le hub. Le programme démarre avec le bouton « Démarrer » (lien georama-production:).
const PROD_URL = 'http://127.0.0.1:8765/';
let cadre = null, cadreSrc = '';
function cadreProduction() {
  if (!cadre) {
    cadre = document.createElement('iframe');
    cadre.id = 'cadre-production';
    cadre.title = 'Georama Production';
    cadre.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen; local-network-access; local-network; loopback-network');
    cadre.style.cssText = 'position:fixed;border:1px solid var(--bordure);z-index:15;display:none;background:#2A2F2B;border-radius:8px';
    document.body.appendChild(cadre);
    window.addEventListener('resize', placerCadre);
    window.addEventListener('scroll', placerCadre, true);
  }
  return cadre;
}
export function placerCadre() {
  if (!cadre) return;
  const z = document.getElementById('zone-production');
  if (!z || !z.dataset.pret || document.getElementById('modal').open) { cadre.style.display = 'none'; return; }
  const r = z.getBoundingClientRect();
  Object.assign(cadre.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}
async function serveurPret() {
  try { await fetch(PROD_URL + 'api/infos', { mode: 'no-cors', cache: 'no-store' }); return true; } catch (e) { return false; }
}
function vueGeorama(ctx) {
  const c = ctx.route.id ? ctx.m.get('commandes', ctx.route.id) : null;
  const cmds = ctx.m.liste('commandes').filter(x => ACTIVES.includes(x.statut) && x.lien).sort((a, b) => String(a.promise || '9').localeCompare(String(b.promise || '9')));
  return `<div class="filtres seulement-ordi" style="align-items:center">
      <label for="gp-commande" class="petit">Commande</label>
      <select id="gp-commande" data-chg="gp-commande"><option value="">Aucune (nouvelle zone)</option>${cmds.map(x => `<option value="${esc(x.id)}"${c && c.id === x.id ? ' selected' : ''}>${esc(x.numero)} · ${esc(x.client)}</option>`).join('')}</select>
      ${c ? `<a class="btn-lien petit" href="#/production/fiche/${esc(c.id)}">Fiche de ${esc(c.numero)}</a>` : ''}
      <span class="tres-petit doux grow" style="text-align:right">Ce qui est produit ici arrive tout seul dans la fiche de la commande (même numéro).</span>
    </div>
    <div id="zone-production" style="height:calc(100vh - 230px);min-height:560px;border:1px dashed var(--bordure);border-radius:8px;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px">
      <div id="gp-etat" class="petit doux">Recherche de Georama Production sur cet ordi…</div>
    </div>
    <p class="tres-petit doux seulement-mobile" style="margin:0">Georama Production s’utilise sur un ordinateur. Sur le cellulaire : boutons « Aperçu rapide », « Produire le .3mf » et « PDF client » dans la fiche de la commande.</p>`;
}
async function monterGeorama(ctx) {
  const z = document.getElementById('zone-production');
  if (!z) return;
  const etat = document.getElementById('gp-etat');
  const c = ctx.route.id ? ctx.m.get('commandes', ctx.route.id) : null;
  const src = PROD_URL + (c && c.lien ? '?lien=' + encodeURIComponent(c.lien) + '&numero=' + encodeURIComponent(c.numero || '') : '');
  const e0 = etatVue(ctx);
  const ok = e0.forcerCadre || await serveurPret();
  if (!z.isConnected) return;
  if (ok) {
    const f = cadreProduction();
    if (cadreSrc !== src) { f.src = src; cadreSrc = src; }
    z.dataset.pret = '1';
    if (etat) etat.textContent = '';
    placerCadre();
    return;
  }
  const e = etatVue(ctx);
  const attend = e.demarrage && Date.now() - e.demarrage < 90000;
  etat.innerHTML = attend
    ? 'Démarrage de Georama Production… (jusqu’à une minute la première fois)'
    : `<p style="margin:0 0 12px"><strong>Georama Production n’est pas ouvert sur cet ordi</strong><br><span class="petit doux">(ou Chrome n’a pas encore permis au hub de le voir).</span></p>
       <div class="actions" style="justify-content:center">
         <button type="button" class="btn" data-act="gp-demarrer">Démarrer Georama Production</button>
         <button type="button" class="btn-2" data-act="gp-forcer">Afficher ici quand même</button>
         <a class="btn-2" href="${esc(src)}" target="_blank" rel="noopener">Ouvrir dans un onglet</a>
       </div>
       <p class="tres-petit doux" style="margin:12px 0 0">Si Chrome demande d’autoriser l’accès aux « applis et services de cet appareil » ou au « réseau local » : clique <strong>Autoriser</strong>.<br>
       La première fois sur un ordi : double-clique sur « Installer le bouton du hub.cmd »<br>dans OneDrive › 04_Operations… › 05_Georama-production › georama-production.</p>`;
  if (attend) { clearTimeout(e.minuterieGp); e.minuterieGp = setTimeout(() => { if (ctx.route.sous === 'georama') monterGeorama(ctx); }, 3000); }
}

export default {
  titre: 'Production',
  render(ctx) {
    const sous = ctx.route.sous;
    const ong = (id, nom) => `<a href="#/production${id ? '/' + id : ''}"${sous === id ? ' aria-current="page"' : ''}>${nom}</a>`;
    const titres = { '': 'File d’impression', fiche: 'Fiche de production', planification: 'Planification', filament: 'Filament et AMS', georama: 'Georama Production' };
    const corps = sous === 'fiche' ? vueFiche(ctx) : sous === 'planification' ? vuePlanif(ctx) : sous === 'filament' ? vueFilament(ctx) : sous === 'georama' ? vueGeorama(ctx) : vueFile(ctx);
    return `<header class="entete">
        <div><p class="surtitre">Production</p><h1 class="titre-1">${titres[sous] || titres['']}</h1></div>
        <div class="actions">${sous !== 'georama' ? '<a class="btn-2 seulement-ordi" href="#/production/georama">Georama Production</a>' : ''}</div>
      </header>
      <nav class="onglets" aria-label="Sections de la production">${ong('', 'File d’impression')}${ong('fiche', 'Fiche de production')}${ong('planification', 'Planification')}${ong('filament', 'Filament et AMS')}<a class="seulement-ordi" href="#/production/georama"${sous === 'georama' ? ' aria-current="page"' : ''}>Georama Production</a></nav>
      ${corps}`;
  },
  actions: {
    filtre: (ctx, el) => { etatVue(ctx).filtre = el.getAttribute('data-filtre'); ctx.rendre(); },
    lancer: (ctx, el) => lancer(ctx, el.getAttribute('data-id'), el.getAttribute('data-imp')),
    terminer: (ctx, el) => terminer(ctx, el.getAttribute('data-id')),
    'statut-plaque': (ctx, el) => changerStatutPlaque(ctx, el.getAttribute('data-id'), el.getAttribute('data-statut')),
    monter: (ctx, el) => deplacer(ctx, el.getAttribute('data-id'), -1),
    descendre: (ctx, el) => deplacer(ctx, el.getAttribute('data-id'), 1),
    modifier: (ctx, el) => ouvrirCommande(ctx, el.getAttribute('data-id')),
    courriel: (ctx, el) => ouvrirCourriel(ctx, el.getAttribute('data-id'), el.getAttribute('data-modele') || undefined),
    chrono: ctx => {
      const c = ficheCourante(ctx);
      const ch = lireChrono();
      if (ch[c.id]) {
        const min = Math.max(1, Math.round((Date.now() - ch[c.id]) / 60000));
        delete ch[c.id];
        ecrireChrono(ch);
        ctx.m.modifier('commandes', c.id, { tempsMin: (Number(c.tempsMin) || 0) + min });
        toast(min + ' min ajoutées à ' + c.numero + '.');
      } else { ch[c.id] = Date.now(); ecrireChrono(ch); ctx.rendre(); }
    },
    'ajout-temps': ctx => {
      const c = ficheCourante(ctx);
      ctx.m.mettre('temps', { id: uid('h'), qui: ctx.moi, date: aujourdhui(), minutes: 15, categorie: 'Production', commande: c.id, note: c.numero }, true);
      ctx.m.modifier('commandes', c.id, { tempsMin: (Number(c.tempsMin) || 0) + 15 });
    },
    'gp-forcer': ctx => { etatVue(ctx).forcerCadre = true; monterGeorama(ctx); },
    'gp-demarrer': ctx => {
      etatVue(ctx).demarrage = Date.now();
      location.href = 'georama-production:ouvrir';
      setTimeout(() => monterGeorama(ctx), 1500);
    },
    travail: (ctx, el) => {
      const c = ficheCourante(ctx);
      const type = el.getAttribute('data-type');
      const options = {};
      if (type !== 'rendu') {
        const f = document.getElementById('gp-format'), g = document.getElementById('gp-gamme');
        if (f && f.value) options.format = f.value;
        if (g && g.value) options.gamme = g.value;
        etatVue(ctx).choixProd = Object.assign({}, etatVue(ctx).choixProd, { [c.id]: options });
      }
      ctx.m.mettre('travaux', { id: uid('w'), type, commande: c.id, numero: c.numero, lien: c.lien || '', options, demandePar: ctx.moi, demandeLe: new Date().toISOString() }, true);
      journaliser(ctx.m, ({ apercu: 'Aperçu rapide demandé pour ', '3mf': 'Production du .3mf demandée pour ', pdf: 'PDF client demandé pour ' }[type] || 'Rendu 3D demandé pour ') + c.numero, '#/production/fiche/' + c.id, 'travail');
      ctx.m.avertir('local');
      const a = agent(ctx.m);
      toast(a.enLigne ? 'Demande envoyée à l\u2019ordi de la maison.' : 'Demande enregistrée. L\u2019ordi de la maison s\u2019en occupera dès qu\u2019il sera en ligne.', !a.enLigne);
    },
    'rafraichir-fichiers': ctx => { const c = ficheCourante(ctx); if (c) chargerFichiers(ctx, c, true); },
    'voir-image': (ctx, el) => ouvrirFenetre({ titre: el.getAttribute('data-nom'), pied: false, large: true, corps: `<div class="visionneuse"><img src="${esc(el.getAttribute('data-url'))}" alt="Rendu 3D"></div><p class="tres-petit doux" style="margin:10px 0 0">Rendu d'aperçu fait par l'ordi de la maison à partir du .3mf. Les couleurs suivent les filaments du fichier.</p>` }),
    'sim-h3c': ctx => { const e = etatVue(ctx); e.simH3C = !e.simH3C; ctx.rendre(); },
    fente: (ctx, el) => { etatVue(ctx).fente = el.getAttribute('data-id'); ctx.rendre(); },
    gamme: (ctx, el) => { etatVue(ctx).gamme = el.getAttribute('data-g'); ctx.rendre(); },
    stock: (ctx, el) => changerStock(ctx.m, el.getAttribute('data-c'), Number(el.getAttribute('data-d'))),
    commandee: (ctx, el) => {
      const k = el.getAttribute('data-c');
      const b = ctx.m.get('filament', 'b-' + k);
      ctx.m.mettre('filament', Object.assign({ id: 'b-' + k, type: 'bobine', couleur: k, stock: 0 }, b || {}, { commandee: !(b && b.commandee) }));
    },
    conso: ctx => { const f = ctx.m.get('filament', etatVue(ctx).fente); majFente(ctx, { kg: Math.max(0, Math.round(((Number(f.kg) || 0) - 0.1) * 10) / 10) }); },
    vider: ctx => majFente(ctx, { couleur: '', kg: 0 }),
    neuve: ctx => chargerCouleur(ctx, ctx.m.get('filament', etatVue(ctx).fente).couleur),
    charger: (ctx, el) => chargerCouleur(ctx, el.getAttribute('data-c')),
  },
  changes: {
    'gp-commande': (ctx, el) => { location.hash = '#/production/georama' + (el.value ? '/' + el.value : ''); },
    'choix-prod': (ctx, el) => {
      const c = ficheCourante(ctx);
      if (!c) return;
      const e = etatVue(ctx);
      e.choixProd = Object.assign({}, e.choixProd, { [c.id]: Object.assign({}, (e.choixProd || {})[c.id], { [el.getAttribute('data-cle')]: el.value }) });
    },
    etape: (ctx, el) => {
      const c = ficheCourante(ctx);
      const id = el.getAttribute('data-etape');
      let n = marquerEtape(ctx.m, c, id, el.checked, ctx.moi);
      if (id === '3mf' && el.checked) plaquesDe(ctx.m, c.id).filter(p => p.statut === 'a3mf').forEach(p => ctx.m.modifier('plaques', p.id, { statut: 'prete' }, true));
      if (id === 'envoi') {
        if (el.checked) {
          n = ctx.m.modifier('commandes', c.id, { statut: c.livraison === 'recuperation' ? 'livree' : 'expediee', expedieeLe: aujourdhui() }, true);
          journaliser(ctx.m, n.numero + (n.statut === 'livree' ? ' récupérée par ' : ' expédiée à ') + n.client, '#/production/fiche/' + n.id, 'envoi');
          setTimeout(() => celebrer(ctx, n), 500);
        }
        else if (['expediee', 'livree'].includes(c.statut)) n = ctx.m.modifier('commandes', c.id, { statut: 'finition' }, true);
      }
      if (id === 'commande' && el.checked && c.statut === 'approbation') ctx.m.modifier('commandes', c.id, { statut: 'production' }, true);
      ctx.m.avertir('local');
    },
    'sim-hpj': (ctx, el) => { etatVue(ctx).hpj = Number(el.value); ctx.rendre(); },
    'sim-extra': (ctx, el) => { etatVue(ctx).extra = Number(el.value); ctx.rendre(); },
  },
  apres(ctx) {
    if (ctx.route.sous === 'fiche') { const c = ficheCourante(ctx); if (c) chargerFichiers(ctx, c); }
    if (ctx.route.sous === 'georama') monterGeorama(ctx);
    clearInterval(ctx.etat.minuterieProd);
    if (ctx.route.vue === 'production' && (ctx.route.sous === '' || ctx.route.sous === 'fiche')) {
      ctx.etat.minuterieProd = setInterval(() => {
        if (document.getElementById('modal').open) return;
        if (ctx.route.vue === 'production') ctx.rendre(); else clearInterval(ctx.etat.minuterieProd);
      }, 60000);
    }
  },
};

function chargerCouleur(ctx, couleur) {
  const m = ctx.m;
  if (!couleur) return;
  if (stock(m, couleur) < 1) { toast('Aucune bobine ' + COULEURS[couleur].nom.toLowerCase() + ' sur l’étagère. Elle est dans la liste d’achats.', true); return; }
  changerStock(m, couleur, -1);
  majFente(ctx, { couleur, kg: 1 });
  toast('Bobine ' + COULEURS[couleur].nom.toLowerCase() + ' chargée (1 kg).');
}
function deplacer(ctx, id, sens) {
  const m = ctx.m;
  const file = fileImpression(m);
  const i = file.findIndex(p => p.id === id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= file.length) return;
  // Renuméroter toute la file pour éviter les rangs égaux.
  const ordre = file.map(p => p.id);
  [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  ordre.forEach((pid, k) => { const p = m.get('plaques', pid); if (p.rang !== k + 1) m.modifier('plaques', pid, { rang: k + 1 }, true); });
  m.avertir('local');
}
export { estActive, initiales, versDate };
