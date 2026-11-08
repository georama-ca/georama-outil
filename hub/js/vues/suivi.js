// Suivi du site et des pubs (v1.5) : achalandage Wix, zones choisies par les visiteurs (Entonnoir),
// paniers abandonnés et pubs Meta. Les chiffres arrivent de l'ordi de la maison (agent 1.3) :
// stats-wix.json et stats-meta.json dans OneDrive > Hub-Georama.
import { esc, argent, nombre, dateCourte, ilYa } from '../ui.js';

export const OUTIL = 'https://outil.georama.ca/index.html?';
const SEG = {
  chasse: ['Chasse', '#FF671F'], proprio: ['Terre à bois', '#9AB168'], terre: ['Terre à bois', '#9AB168'],
  peche: ['Pêche', '#3BA3E0'], pleinair: ['Sommet', '#B9A3F0'], sommet: ['Sommet', '#B9A3F0'], randonnee: ['Sommet', '#B9A3F0'],
  ville: ['Ville', '#F2C14E'], entreprise: ['Entreprise', '#E8E8E0'], ferme: ['Agricole', '#C98B4E'], agricole: ['Agricole', '#C98B4E'],
};
export const nomSeg = s => (SEG[s] || [s || '—'])[0];
const couleurSeg = s => (SEG[s] || [0, '#B9BDB4'])[1];
const ETAPES = {
  zone: 'Zone choisie', '3d': 'Vue 3D', mur: 'Au mur', table: 'Sur la table', ajouts: 'Ajouts', etape3: 'Ajouts',
  couleurs: 'Couleurs', etape4: 'Couleurs', 'etape5-commande': 'Étape 5', lien: 'Lien copié', commander: '« Commander »',
  panier: 'Panier', paiement: 'Paiement', achat: 'Achat',
};
export const nomEtape = e => ETAPES[e] || e;
const RANG = Object.keys(ETAPES);

export function statsWix(m) { return ((m.externes.statsWix || [])[0]) || null; }
export function statsMeta(m) { return ((m.externes.statsMeta || [])[0]) || null; }

function provenance(z) {
  const s = (z.source || '').toLowerCase();
  if (s === 'meta' || z.campagne) return 'Pub Meta';
  if (/facebook|fb|groupe/.test(s)) return 'Facebook (groupes)';
  if (/instagram/.test(s)) return 'Instagram';
  if (/google/.test(s)) return 'Google';
  if (/courriel|email|mail/.test(s)) return 'Courriel';
  if (!s || s === 'direct') return 'Direct';
  return z.source;
}

export function parseZone(q) {
  const p = new URLSearchParams(q || '');
  const lat = parseFloat(p.get('lat')), lon = parseFloat(p.get('lon'));
  return { lat, lon, km: parseFloat(p.get('l')) || 0, seg: p.get('p') || '', ok: isFinite(lat) && isFinite(lon) };
}

// Totaux Meta sur une période (jours) pour le tableau de bord.
export function totauxMeta(m, jours = 30) {
  const s = statsMeta(m);
  if (!s || !s.jours) return null;
  const depuis = new Date(Date.now() - jours * 86400000).toISOString().slice(0, 10);
  return s.jours.filter(j => (j.date || '') >= depuis).reduce((t, j) => ({
    depense: t.depense + (j.depense || 0), clics: t.clics + (j.clics_lien || 0), vues: t.vues + (j.vues_page || 0),
    impressions: t.impressions + (j.impressions || 0), conversions: t.conversions + (j.conversions || 0),
  }), { depense: 0, clics: 0, vues: 0, impressions: 0, conversions: 0 });
}

function barres(jours, unite) {
  if (!jours || !jours.length) return '<p class="petit doux">Pas encore de données.</p>';
  const max = Math.max(1, ...jours.map(j => j.valeur || 0));
  const w = 100 / jours.length;
  const rects = jours.map((j, i) => {
    const h = Math.round((j.valeur || 0) / max * 100);
    return `<rect x="${(i * w + w * 0.15).toFixed(2)}" y="${100 - h}" width="${(w * 0.7).toFixed(2)}" height="${Math.max(h, 0.5)}" rx="0.6" fill="var(--accent)"><title>${esc(dateCourte(j.date))} : ${nombre(j.valeur)} ${esc(unite)}</title></rect>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:120px;display:block" role="img" aria-label="${esc(unite)} par jour">${rects}</svg>
    <div class="tres-petit doux" style="display:flex;justify-content:space-between;margin-top:4px"><span>${esc(dateCourte(jours[0].date))}</span><span>max ${nombre(max)} / jour</span><span>${esc(dateCourte(jours[jours.length - 1].date))}</span></div>`;
}

export function etatSuivi(ctx) {
  if (!ctx.etat.suivi) ctx.etat.suivi = { seg: '', prov: '', periode: '30', vue: null };
  return ctx.etat.suivi;
}

export function vueSuivi(ctx) {
  const m = ctx.m;
  const w = statsWix(m), me = statsMeta(m);
  const e = etatSuivi(ctx);
  const alertes = [];
  if (!w) alertes.push('Les statistiques arrivent de l’ordi de la maison (agent 1.3) une fois l’heure. Rien de reçu pour l’instant.');
  if (w && w.erreurs) Object.values(w.erreurs).forEach(t => alertes.push(t));
  const vidage = m.liste('travaux').filter(t => t.type === 'vider-entonnoir').sort((a, b) => String(b.demandeLe).localeCompare(String(a.demandeLe)))[0];
  const resVidage = vidage && (m.externes.resultats || []).find(r => r.id === vidage.id);
  let blocCompteur = '';
  if (w && w.entonnoir && (w.entonnoir.plein || w.entonnoir.total > 3000 || vidage)) {
    const etatV = !vidage ? '' : !resVidage ? 'Demande envoyée à l’ordi de la maison…' : resVidage.statut === 'en_cours' ? 'L’ordi de la maison archive et vide le compteur…' : resVidage.message || '';
    blocCompteur = `<div class="bandeau" style="flex-direction:column;align-items:flex-start;gap:8px">
      <span>${w.entonnoir.plein ? `<strong>Le compteur « Entonnoir » du site est plein</strong> (${nombre(w.entonnoir.total)} entrées) : plus aucune étape de visiteur n’est enregistrée depuis le ${esc(dateCourte(w.entonnoir.derniere_entree))}` : `Compteur « Entonnoir » du site : ${nombre(w.entonnoir.total)} entrées sur 4 000.`}</span>
      <span class="petit">Tout l’historique est déjà copié dans OneDrive › Hub-Georama › entonnoir (rien ne se perd). Vider le compteur retire du site les entrées de plus de 7 jours ; les zones restent visibles ici.</span>
      ${etatV ? `<span class="petit"><strong>${esc(etatV)}</strong></span>` : ''}
      ${!vidage || (resVidage && resVidage.statut !== 'en_cours') ? '<button type="button" class="btn" data-act="vider-entonnoir">Vider le compteur (archive gardée)</button>' : ''}
    </div>`;
  }
  if (me && me.erreurs) Object.values(me.erreurs).forEach(t => alertes.push('Meta : ' + t));

  const ach = (w && w.achalandage) || {};
  const sess = ach.TOTAL_SESSIONS || {}, vis = ach.TOTAL_UNIQUE_VISITORS || {}, cmd = ach.TOTAL_ORDERS || {}, form = ach.TOTAL_FORMS_SUBMITTED || {};
  const tm = totauxMeta(m, 30);

  // zones
  const depuis = e.periode === 'tout' ? '' : new Date(Date.now() - Number(e.periode) * 86400000).toISOString();
  const toutes = ((w && w.zones) || []).map(z => Object.assign({}, z, { prov: provenance(z), pz: parseZone(z.zone) }));
  const zones = toutes.filter(z => (!depuis || (z.date || '') >= depuis) && (!e.seg || nomSeg(z.segment) === e.seg) && (!e.prov || z.prov === e.prov));
  const segs = [...new Set(toutes.map(z => nomSeg(z.segment)))].sort();
  const provs = [...new Set(toutes.map(z => z.prov))].sort();
  const opt = (liste, val, tous) => `<option value="">${tous}</option>` + liste.map(x => `<option${x === val ? ' selected' : ''}>${esc(x)}</option>`).join('');
  const loin = zones.filter(z => RANG.indexOf(z.plus_loin) >= RANG.indexOf('etape5-commande')).length;
  const cartes = zones.slice(0, 60).map(z => `<div class="ligne" style="align-items:flex-start">
      <span class="pastille-etat" style="background:${couleurSeg(z.segment)};margin-top:6px"></span>
      <span class="grow petit"><strong>${esc(nomSeg(z.segment))}</strong> · ${esc(z.prov)}${z.contenu ? ' <span class="doux">(' + esc(z.contenu) + ')</span>' : ''}<br>
        <span class="doux">${esc(ilYa(z.date))} · ${esc(z.appareil || '')}${z.pz.km ? ' · ' + nombre(z.pz.km, 1) + ' km' : ''} · plus loin : ${esc(nomEtape(z.plus_loin))}</span></span>
      ${z.zone ? `<a class="btn-lien petit" href="${esc(OUTIL + z.zone)}" target="_blank" rel="noopener">Voir la zone</a>` : '<span class="tres-petit doux" title="L’outil ne note la zone qu’à partir de la vue 3D">zone non notée</span>'}
    </div>`).join('');

  // pubs Meta par campagne (30 jours)
  let metaHtml = '<p class="petit doux" style="margin:0">Pas branché. Le jeton Meta (permission ads_read) se colle dans Configurer.bat sur l’ordi de la maison.</p>';
  if (me && me.jours) {
    const parK = {};
    me.jours.forEach(j => { const k = parK[j.campagne] = parK[j.campagne] || { nom: j.nom, depense: 0, impressions: 0, clics: 0, vues: 0, conv: 0, dernier: '' }; k.depense += j.depense; k.impressions += j.impressions; k.clics += j.clics_lien; k.vues += j.vues_page; k.conv += j.conversions; if (j.date > k.dernier) k.dernier = j.date; });
    const statut = Object.fromEntries((me.campagnes || []).map(c => [c.id, c.statut]));
    const lignes = Object.entries(parK).sort((a, b) => b[1].dernier.localeCompare(a[1].dernier)).map(([id, k]) => `<tr>
        <td><strong>${esc(k.nom)}</strong><br>${statut[id] === 'ACTIVE' ? '<span class="etiquette vert">Active</span>' : '<span class="etiquette gris">' + esc(statut[id] || 'Terminée') + '</span>'}</td>
        <td class="droite num">${argent(k.depense, 2)}</td><td class="droite num">${nombre(k.impressions)}</td>
        <td class="droite num">${nombre(k.clics)}</td><td class="droite num">${nombre(k.vues)}</td><td class="droite num">${nombre(k.conv)}</td>
        <td class="droite num">${k.clics ? argent(k.depense / k.clics, 2) : '—'}</td></tr>`).join('');
    metaHtml = `<div class="table-boite"><table class="liste"><thead><tr><th>Campagne</th><th class="droite">Dépensé</th><th class="droite">Vues de la pub</th><th class="droite">Clics</th><th class="droite">Visites</th><th class="droite">Conversions</th><th class="droite">$ / clic</th></tr></thead>
      <tbody>${lignes || '<tr><td colspan="7" class="vide">Aucune dépense sur 30 jours.</td></tr>'}</tbody></table></div>
      <p class="tres-petit doux" style="margin:6px 0 0">30 derniers jours. Lu ${esc(ilYa(me.lu))}.</p>`;
  }

  // Google (Search Console), infolettres, abonnés, codes promo
  const rech = w && w.recherche;
  let rechHtml = '<p class="petit doux" style="margin:0">Pas encore lu.</p>';
  if (rech && rech.jours) {
    const cl = rech.jours.reduce((s, j) => s + j.clics, 0), im = rech.jours.reduce((s, j) => s + j.impressions, 0);
    rechHtml = `<div class="g4" style="margin-bottom:10px"><div><p class="surtitre">Clics</p><p class="valeur" style="font-size:24px">${nombre(cl)}</p></div><div><p class="surtitre">Apparitions</p><p class="valeur" style="font-size:24px">${nombre(im)}</p></div></div>
      ${barres(rech.jours.map(j => ({ date: j.cle, valeur: j.impressions })), 'apparitions dans Google')}
      <h3 class="petit" style="margin:14px 0 6px">Ce que les gens cherchent</h3>
      ${(rech.requetes || []).map(q => `<div class="ligne"><span class="grow petit">${esc(q.cle)}</span><span class="tres-petit doux num">${nombre(q.clics)} clic${q.clics > 1 ? 's' : ''} · ${nombre(q.impressions)} vues · rang ${nombre(q.position, 1)}</span></div>`).join('')}
      <p class="tres-petit doux" style="margin:6px 0 0">Du ${esc(dateCourte(rech.debut))} au ${esc(dateCourte(rech.fin))} (Google a 2 ou 3 jours de retard).</p>`;
  }
  const lettres = ((w && w.infolettres) || []).map(c => {
    const s = c.stats || {}, env = s.delivered || 0;
    return `<div class="ligne"><span class="grow petit"><strong>${esc(c.titre || c.sujet)}</strong><br><span class="doux">${esc(dateCourte((c.date || '').slice(0, 10)))} · ${nombre(env)} reçus</span></span>
      <span class="tres-petit num">${env ? Math.round((s.opened || 0) / env * 100) : 0} % ouverts · ${env ? Math.round((s.clicked || 0) / env * 100) : 0} % clics</span></div>`;
  }).join('');
  const il30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const abonnes = ((w && w.formulaires) || []).filter(f => f.infolettre && (f.date || '') >= il30 && (f.champs || []).some(c => c.valeur === 'oui')).length;
  const codes = ((w && w.coupons) || []).map(c => `<div class="ligne"><span class="grow petit"><strong>${esc(c.code)}</strong> · ${esc(c.rabais)}<br><span class="doux">${esc(c.nom || '')}${c.fin ? ' · jusqu’au ' + esc(dateCourte(c.fin)) : ''}</span></span>
    <span class="tres-petit num">${nombre(c.utilisations)}${c.limite ? ' / ' + nombre(c.limite) : ''} utilisé${c.utilisations > 1 ? 's' : ''}</span>${c.actif ? '<span class="etiquette vert">Actif</span>' : '<span class="etiquette gris">Inactif</span>'}</div>`).join('');

  const paniers = ((w && w.paniers) || []).slice(0, 15).map(p => `<div class="ligne"><span class="grow petit"><strong>${p.montant ? argent(p.montant, 2) : '—'}</strong> · ${esc((p.articles || []).join(', ') || 'Maquette')}${p.prenom ? ' · ' + esc(p.prenom) : ''}<br><span class="doux">${esc(ilYa(p.date))}</span></span>${p.recupere || p.statut === 'RECOVERED' ? '<span class="etiquette vert">Récupéré</span>' : '<span class="etiquette orange">Abandonné</span>'}</div>`).join('');

  return `
    ${blocCompteur}
    ${alertes.map(t => `<div class="bandeau"><span>${esc(t)}</span></div>`).join('')}
    <section class="g4" aria-label="30 derniers jours">
      <div class="carte kpi"><p class="surtitre">Visites du site</p><p class="valeur">${nombre(sess.total || 0)}</p><p class="detail">${nombre(vis.total || 0)} visiteurs · 30 j</p></div>
      <div class="carte kpi"><p class="surtitre">Zones choisies</p><p class="valeur">${nombre(toutes.filter(z => (z.date || '') >= new Date(Date.now() - 30 * 86400000).toISOString()).length)}</p><p class="detail">visiteurs · 30 j</p></div>
      <div class="carte kpi"><p class="surtitre">Commandes Wix</p><p class="valeur">${nombre(cmd.total || 0)}</p><p class="detail">${nombre(form.total || 0)} formulaire${(form.total || 0) > 1 ? 's' : ''} · 30 j</p></div>
      <div class="carte kpi"><p class="surtitre">Pubs Meta</p><p class="valeur">${tm ? argent(tm.depense, 2) : '—'}</p><p class="detail">${tm ? nombre(tm.clics) + ' clics · 30 j' : 'pas branché'}</p></div>
    </section>
    <section class="carte"><div class="carte-tete"><h2>Achalandage du site</h2><span class="tres-petit doux">${w ? 'Lu ' + esc(ilYa(w.lu)) : ''}</span></div>${barres(sess.jours, 'visites')}</section>
    <section class="carte">
      <div class="carte-tete"><h2>Zones choisies par les visiteurs</h2><span class="tres-petit doux">${nombre(zones.length)} visiteur${zones.length > 1 ? 's' : ''} · ${nombre(zones.filter(z => z.pz.ok).length)} sur la carte · ${nombre(loin)} jusqu’à l’étape 5 ou plus</span></div>
      <div class="champs" style="margin-bottom:10px">
        <div class="champ"><label for="sv-per">Période</label><select id="sv-per" data-chg="suivi" data-cle="periode"><option value="7"${e.periode === '7' ? ' selected' : ''}>7 jours</option><option value="30"${e.periode === '30' ? ' selected' : ''}>30 jours</option><option value="tout"${e.periode === 'tout' ? ' selected' : ''}>Tout</option></select></div>
        <div class="champ"><label for="sv-seg">Segment</label><select id="sv-seg" data-chg="suivi" data-cle="seg">${opt(segs, e.seg, 'Tous')}</select></div>
        <div class="champ"><label for="sv-prov">Provenance</label><select id="sv-prov" data-chg="suivi" data-cle="prov">${opt(provs, e.prov, 'Toutes')}</select></div>
      </div>
      <div id="carte-zones" style="height:320px;border-radius:8px;overflow:hidden;background:var(--surface-2)" data-zones="${esc(JSON.stringify(zones.filter(z => z.pz.ok).slice(0, 400).map(z => [z.pz.lat, z.pz.lon, couleurSeg(z.segment), nomSeg(z.segment), z.prov, nomEtape(z.plus_loin), z.zone])))}"></div>
      <div style="margin-top:10px">${cartes || '<p class="petit doux">Aucune zone pour ces filtres.</p>'}</div>
      ${zones.length > 60 ? `<p class="tres-petit doux">Les 60 plus récentes sont listées ; toutes sont sur la carte.</p>` : ''}
    </section>
    <section class="carte"><div class="carte-tete"><h2>Pubs Meta</h2></div>${metaHtml}</section>
    <section class="carte"><div class="carte-tete"><h2>Recherche Google</h2></div>${rechHtml}</section>
    <div class="cote">
      <section class="carte principal"><div class="carte-tete"><h2>Infolettres</h2><span class="tres-petit doux">${nombre(abonnes)} nouvel${abonnes > 1 ? 's' : ''} abonné${abonnes > 1 ? 's' : ''} · 30 j</span></div>${lettres || '<p class="petit doux">Aucune infolettre envoyée.</p>'}</section>
      <section class="carte lateral"><div class="carte-tete"><h2>Codes promo</h2></div>${codes || '<p class="petit doux">Aucun code promo.</p>'}</section>
    </div>
    <section class="carte"><div class="carte-tete"><h2>Paniers abandonnés</h2></div>${paniers || '<p class="petit doux">Aucun panier abandonné.</p>'}</section>`;
}

// Carte des zones (Leaflet chargé à la demande).
let leafletPromesse = null;
function chargerLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletPromesse) return leafletPromesse;
  leafletPromesse = new Promise((ok, ko) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = () => ok(); s.onerror = () => { leafletPromesse = null; ko(new Error('Leaflet')); };
    document.head.appendChild(s);
  });
  return leafletPromesse;
}
export function monterCarte(ctx, racine) {
  const el = racine.querySelector('#carte-zones');
  if (!el) return;
  let pts = [];
  try { pts = JSON.parse(el.getAttribute('data-zones') || '[]'); } catch (e) { pts = []; }
  chargerLeaflet().then(() => {
    if (!el.isConnected) return;
    const e = etatSuivi(ctx);
    const carte = window.L.map(el, { scrollWheelZoom: false, attributionControl: true });
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(carte);
    const groupe = [];
    pts.forEach(([la, lo, coul, seg, prov, etape, zone]) => {
      const mk = window.L.circleMarker([la, lo], { radius: 7, color: '#0D1110', weight: 1, fillColor: coul, fillOpacity: 0.9 }).addTo(carte);
      mk.bindPopup(`<strong>${esc(seg)}</strong><br>${esc(prov)} · ${esc(etape)}<br><a href="${esc(OUTIL + zone)}" target="_blank" rel="noopener">Voir la zone</a>`);
      groupe.push([la, lo]);
    });
    if (e.vue) carte.setView(e.vue.c, e.vue.z);
    else if (groupe.length) carte.fitBounds(groupe, { padding: [20, 20], maxZoom: 9 });
    else carte.setView([48, -72], 6);
    carte.on('moveend', () => { e.vue = { c: carte.getCenter(), z: carte.getZoom() }; });
  }).catch(() => { el.innerHTML = '<p class="petit doux" style="padding:16px">Carte indisponible (pas de connexion).</p>'; });
}
