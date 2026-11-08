// Campagnes (v1.10) : lien entre les conversions Meta et les zones vraiment choisies dans l'outil.
// Les visiteurs des pubs arrivent avec utm_campaign (ex. lancement-noel) et utm_content (la pub : peche-B…),
// notés par l'outil dans l'Entonnoir ; l'ordi de la maison les regroupe par visite (stats-wix.json › zones).
import { esc, argent, nombre, dateCourte } from '../ui.js';
import { statsWix, statsMeta, nomSeg, RANG } from './suivi.js';

const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const jour = iso => { const d = new Date(iso); return isNaN(d) ? String(iso || '').slice(0, 10) : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const loin = z => RANG.indexOf(z.plus_loin) >= RANG.indexOf('etape5-commande');
const deLaPub = z => (z.source || '').toLowerCase() === 'meta';
const desGroupes = z => /facebook|fb|groupe/.test((z.source || '').toLowerCase());

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 4) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
function lecture(r) {
  if (r === null) return 'Pas assez de jours avec des données pour comparer.';
  const a = Math.abs(r);
  const force = a >= 0.7 ? 'fort' : a >= 0.4 ? 'moyen' : a >= 0.2 ? 'faible' : 'presque nul';
  if (a < 0.2) return `Lien ${force} (r = ${nombre(r, 2)}) : les conversions comptées par Meta et les zones choisies ne bougent pas ensemble. Les « conversions » Meta ne veulent donc pas dire « zone choisie ».`;
  return `Lien ${force} (r = ${nombre(r, 2)}) : les jours où Meta compte ${r > 0 ? 'plus' : 'moins'} de conversions, il y a ${r > 0 ? 'aussi plus' : 'plutôt moins'} de zones choisies dans l'outil.`;
}

// Deux séries par jour : conversions Meta et zones choisies venues des pubs.
function graphique(jours) {
  if (!jours.length) return '';
  const max = Math.max(1, ...jours.map(j => Math.max(j.conv, j.zones)));
  const w = 100 / jours.length;
  const rects = jours.map((j, i) => {
    const hc = j.conv / max * 100, hz = j.zones / max * 100;
    const x = i * w;
    return `<rect x="${(x + w * 0.12).toFixed(2)}" y="${(100 - hc).toFixed(2)}" width="${(w * 0.36).toFixed(2)}" height="${Math.max(hc, 0.4).toFixed(2)}" fill="var(--eau)"><title>${esc(dateCourte(j.date))} : ${nombre(j.conv)} conversion(s) Meta</title></rect>
      <rect x="${(x + w * 0.52).toFixed(2)}" y="${(100 - hz).toFixed(2)}" width="${(w * 0.36).toFixed(2)}" height="${Math.max(hz, 0.4).toFixed(2)}" fill="${j.trou ? 'var(--bordure)' : 'var(--accent)'}"><title>${esc(dateCourte(j.date))} : ${j.trou ? 'compteur du site plein, pas de données' : nombre(j.zones) + ' zone(s) choisie(s) par les visiteurs des pubs'}</title></rect>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:140px;display:block" role="img" aria-label="Conversions Meta et zones choisies par jour">${rects}</svg>
    <div class="tres-petit doux" style="display:flex;justify-content:space-between;gap:8px;margin-top:4px"><span>${esc(dateCourte(jours[0].date))}</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:var(--eau);border-radius:2px"></span> conversions Meta · <span style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:2px"></span> zones choisies (visiteurs des pubs)</span>
      <span>${esc(dateCourte(jours[jours.length - 1].date))}</span></div>`;
}

export function blocCorrelation(m) {
  const me = statsMeta(m), w = statsWix(m);
  if (!me || !me.jours || !w || !w.zones) return '<p class="petit doux" style="margin:0">Il faut les pubs Meta et les zones du site (lus par l’ordi de la maison) pour comparer.</p>';
  const zones = w.zones.map(z => Object.assign({}, z, { jour: jour(z.date) }));
  const pub = zones.filter(deLaPub);
  // Jours couverts par le compteur du site (sans le trou quand il était plein).
  const joursZones = [...new Set(zones.map(z => z.jour))].sort();
  const premierZ = joursZones[0] || '', dernierZ = joursZones[joursZones.length - 1] || '';
  const parJour = {};
  me.jours.forEach(j => { const d = parJour[j.date] = parJour[j.date] || { date: j.date, conv: 0, clics: 0, dep: 0, zones: 0 }; d.conv += j.conversions || 0; d.clics += j.clics_lien || 0; d.dep += j.depense || 0; });
  pub.forEach(z => { const d = parJour[z.jour]; if (d) d.zones += 1; });
  const jours = Object.values(parJour).sort((a, b) => a.date.localeCompare(b.date)).map(d => Object.assign(d, { trou: d.date > dernierZ || d.date < premierZ }));
  const comparables = jours.filter(d => !d.trou);
  const r = pearson(comparables.map(d => d.conv), comparables.map(d => d.zones));
  const totConv = comparables.reduce((s, d) => s + d.conv, 0), totZ = comparables.reduce((s, d) => s + d.zones, 0);

  // Par campagne Meta : utm_campaign retrouvé dans le nom de la campagne (ex. « Lancement Noël… » ↔ lancement-noel).
  const utms = [...new Set(zones.map(z => z.campagne).filter(Boolean))];
  const parK = {};
  me.jours.forEach(j => { const k = parK[j.campagne] = parK[j.campagne] || { nom: j.nom, dep: 0, clics: 0, conv: 0 }; k.dep += j.depense || 0; k.clics += j.clics_lien || 0; k.conv += j.conversions || 0; });
  const lignesK = Object.values(parK).sort((a, b) => b.dep - a.dep).map(k => {
    const utm = utms.find(u => u.length >= 4 && slug(k.nom).includes(u)) || '';
    const zs = utm ? pub.filter(z => z.campagne === utm) : [];
    const n = zs.length, l = zs.filter(loin).length;
    return `<tr><td><strong>${esc(k.nom)}</strong><br><span class="tres-petit doux">${utm ? 'repérée sur le site : « ' + esc(utm) + ' »' : 'pas encore vue sur le site'}</span></td>
      <td class="droite num">${argent(k.dep, 2)}</td><td class="droite num">${nombre(k.clics)}</td><td class="droite num">${nombre(k.conv)}</td>
      <td class="droite num"><strong>${utm ? nombre(n) : '—'}</strong></td><td class="droite num">${utm ? nombre(l) : '—'}</td>
      <td class="droite num">${n ? argent(k.dep / n, 2) : '—'}</td><td class="droite num">${n && k.clics ? nombre(n / k.clics * 100, 0) + ' %' : '—'}</td></tr>`;
  }).join('');
  const groupes = zones.filter(desGroupes);
  const ligneGroupes = groupes.length ? `<tr><td><strong>Groupes Facebook</strong> <span class="etiquette gris">gratuit</span><br><span class="tres-petit doux">publications dans les groupes</span></td>
      <td class="droite num">0,00 $</td><td class="droite num">—</td><td class="droite num">—</td><td class="droite num"><strong>${nombre(groupes.length)}</strong></td><td class="droite num">${nombre(groupes.filter(loin).length)}</td><td class="droite num">0,00 $</td><td class="droite num">—</td></tr>` : '';

  // Par pub (utm_content) : quelle publicité amène des zones et des visiteurs qui vont loin.
  const parPub = {};
  zones.filter(z => (deLaPub(z) || desGroupes(z)) && z.contenu).forEach(z => {
    const p = parPub[z.contenu] = parPub[z.contenu] || { contenu: z.contenu, n: 0, loin: 0, pub: 0, seg: {} };
    p.n += 1; if (loin(z)) p.loin += 1; if (deLaPub(z)) p.pub += 1; p.seg[z.segment] = (p.seg[z.segment] || 0) + 1;
  });
  const lignesPub = Object.values(parPub).sort((a, b) => b.n - a.n).slice(0, 15).map(p => {
    const seg = Object.entries(p.seg).sort((a, b) => b[1] - a[1])[0];
    const taux = p.n ? p.loin / p.n * 100 : 0;
    return `<div class="ligne"><span class="grow petit"><strong>${esc(p.contenu)}</strong> <span class="doux">· ${esc(nomSeg(seg && seg[0]))}${p.pub < p.n ? ' · dont ' + nombre(p.n - p.pub) + ' des groupes' : ''}</span></span>
      <span class="petit num" style="min-width:90px;text-align:right">${nombre(p.n)} zone${p.n > 1 ? 's' : ''}</span>
      <span class="petit num" style="min-width:150px;text-align:right">${nombre(p.loin)} jusqu’à l’étape 5 <span class="doux">(${nombre(taux, 0)} %)</span></span></div>`;
  }).join('');
  const trous = jours.filter(d => d.trou).length;

  return `<div class="g3" style="align-items:start">
      <div class="s2">${graphique(jours)}</div>
      <div>
        <p class="surtitre" style="margin:0">Sur ${nombre(comparables.length)} jours comparables</p>
        <p style="margin:6px 0 0"><span class="num" style="font-size:24px;font-weight:700">${nombre(totZ)}</span> zones choisies par les visiteurs des pubs<br>
          <span class="num" style="font-size:24px;font-weight:700">${nombre(totConv)}</span> conversions comptées par Meta</p>
        <p class="petit" style="margin:10px 0 0">${esc(lecture(r))}</p>
        ${trous ? `<p class="tres-petit doux" style="margin:6px 0 0">${nombre(trous)} jour${trous > 1 ? 's' : ''} en gris : le compteur du site était plein (aucune zone notée), ces jours-là ne comptent pas.</p>` : ''}
      </div>
    </div>
    <div class="table-boite" style="margin-top:14px"><table class="liste"><thead><tr><th>Campagne</th><th class="droite">Dépensé</th><th class="droite">Clics</th><th class="droite">Conversions Meta</th><th class="droite">Zones choisies</th><th class="droite">Jusqu’à l’étape 5</th><th class="droite">Coût par zone</th><th class="droite">Zones / 100 clics</th></tr></thead>
      <tbody>${lignesK}${ligneGroupes}</tbody></table></div>
    ${lignesPub ? `<h3 class="petit" style="margin:16px 0 6px">Par publicité (étiquette utm_content)</h3>${lignesPub}` : ''}
    <p class="tres-petit doux" style="margin:8px 0 0">Zones choisies : visites où la personne a choisi un territoire dans l’outil (étape zone ou plus loin). Étape 5 : la personne s’est rendue à la commande. Les conversions Meta sont ce que le pixel compte (vues de page, clics, etc.).</p>`;
}
