// Production › Règles d'impression (v1.17.1) : affichées avec le style du hub (cartes, tableaux, étiquettes),
// valeurs lues en direct dans Georama Production de cet ordi (GET http://127.0.0.1:8765/api/regles, Production 4.72+,
// qui permet la lecture depuis outil.georama.ca). Le texte des règles suit la page /regles de Production 4.71.
import { esc } from './ui.js';

const API = 'http://127.0.0.1:8765/api/regles';
const etat = { donnees: null, erreur: '', charge: false, enCours: false, le: 0 };

const nb = x => (x === null || x === undefined || x === '') ? '—' : String(typeof x === 'number' ? Math.round(x * 100) / 100 : x).replace('.', ',');

export async function chargerRegles(ctx, force = false) {
  if (etat.enCours || (!force && etat.charge && Date.now() - etat.le < 60000)) return;
  etat.enCours = true;
  try {
    const r = await fetch(API, { cache: 'no-store' });
    if (!r.ok) throw new Error('réponse ' + r.status);
    etat.donnees = await r.json();
    etat.erreur = '';
  } catch (e) {
    // Production arrêté, ou trop ancien (avant 4.72, il ne permet pas la lecture depuis le hub)
    let actif = false;
    try { await fetch('http://127.0.0.1:8765/api/infos', { mode: 'no-cors', cache: 'no-store' }); actif = true; } catch (x) { /* arrêté */ }
    etat.erreur = actif ? 'ancien' : 'arrete';
  }
  etat.charge = true; etat.le = Date.now(); etat.enCours = false;
  if (ctx.route.vue === 'production' && ctx.route.sous === 'regles') ctx.rendre();
}

const OR = [
  ['Une seule couleur, un seul filament', 'Les pièces de même couleur partagent un filament. Jamais deux verts identiques sur deux buses.'],
  ['Tous les réglages déclarés', 'Chaque réglage changé est inscrit dans le fichier, sinon Bambu Studio remet sa valeur par défaut.'],
  ['Tour de purge à portée des deux buses', 'Entre x = 25 et 325 mm, bordure comprise, à droite de la maquette.', c => 'à ' + nb(c.tour_ecart) + ' mm de la maquette, bas à y = ' + nb(c.tour_y) + ' mm'],
  ['Maquette décalée vers la gauche', 'Pour laisser la place à la tour dans la zone que les deux buses atteignent.', c => 'centre x = ' + nb((c.centre || [])[0]) + ' mm'],
  ['1re couche de la plaque réussie', 'Les réglages de la plaque du 22 nov., celle qui a collé partout.', c => nb(c.plateau_1re) + ' °C · débit ' + nb(c.debit_1re) + ' · ' + nb(c.vitesse_1re) + '/' + nb(c.remplissage_1re) + ' mm/s'],
  ['Lissage sur les lacs seulement', '« Top surfaces » sur la pièce Eau. Jamais sur les rivières ni les chutes.', c => 'pièces : ' + (c.lissage || []).join(', ')],
  ['« Precise Z height » décoché', 'Coché, il rend la tour de purge énorme.', c => c.precise_z ? 'coché (à vérifier)' : 'décoché', c => !!c.precise_z],
  ['Dos sans petites îles', 'Lettres en pochoir : le centre du o, du D, du e est relié au reste.', c => c.pochoir ? 'activé · fente de ' + nb(c.pont) + ' mm' : 'éteint', c => !c.pochoir],
  ['Socle de la couleur du sol', 'Vert en Boréal. Sol beige ou blanc : couleur du socle choisie à la main.'],
  ['Contrôle qualité 6/6', 'Filaments ≤ 9, pièces étanches, moins de 20 M de triangles, hauteur ≤ 80 mm, fichiers, purges.'],
];
const ROUTINE = [
  ['Produire', '« Produire le .3mf » depuis le hub ou Production. Le tranchage automatique suit (environ 30 min).'],
  ['Ouvrir et trancher', 'Ouvrir le fichier de la commande dans Bambu Studio, « Slice plate » si demandé, puis « Print plate ».'],
  ['Envoyer', 'Chaque couleur pointe vers une bobine chargée, « Nivellement du plateau » coché, puis « Send ».'],
  ['Regarder la 1re couche', 'Environ 30 min : lignes plates et collées autour des lettres. Sinon, arrêter tout de suite.'],
];
const BUSES = [
  ['Buse gauche', '1 hotend 0,4 mm, x = 0 à 325 mm. AMS HT.'],
  ['Buse droite', '6 hotends 0,4 mm (5 dans le support, 1 sur la tête), x = 25 à 330 mm. AMS A et B.'],
  ['Plateau', 'BIQU CryoGrip Pro Glacier. Eau très chaude puis alcool isopropylique ; décoller à froid.'],
  ['Plaque max', '260 × 310 mm (264 × 314,8 avec la bordure de cadre, sans brim).'],
  ['Ventilation ext.', 'Toujours au minimum.'],
  ['Buses inconnues', '« Not enough available hotends » : « Refresh » dans la synchronisation des buses, puis retrancher.'],
  ['Réseau', 'Jamais en mode LAN pendant une impression ; « LAN Only » désactivé pour Bambu Handy.'],
];
const JAMAIS = [
  ['Synchroniser les bobines dans le projet', 'ça ajoute un 2e vert sur l’autre buse (3 j 20 h au lieu de 2 j 17 h, dos abîmé le 24 nov.).'],
  ['Changer une couleur ou une température dans Bambu Studio', 'changer la commande dans Production et refaire le .3mf.'],
  ['Laver le CryoGrip au savon sans rincer longuement', 'le film empêche la 1re couche de coller.'],
  ['Baisser le plateau sous 75 °C ou le débit de 1re couche sous 1', 'essai du 25 nov. raté.'],
  ['Pousser la tour de purge contre le bord droit', 'hors de portée de la buse gauche, « Print plate » reste grisé.'],
  ['Passer en mode LAN pendant une impression', ''],
];
const HISTORIQUE = [
  ['25 nov.', '4.70', 'Lettres du dos en pochoir', 'Îles du o et du D qui décollent (idée d’Anne-Marie)'],
  ['25 nov.', '4.69', 'Retour à 80/75 °C, débit 1, 30/60 mm/s', '1re couche décollée partout en 4.67'],
  ['25 nov.', '4.68', 'Maquette décalée de 6 mm, tour dans la zone commune', 'Tranchage refusé dès qu’une couleur allait sur la buse gauche'],
  ['25 nov.', '4.67', 'Plateau 65/60 °C, débit 0,9, 20/30 mm/s', 'Essai abandonné'],
  ['24 nov.', '4.66', 'Tranchage automatique en arrière-plan', 'Ne plus passer la soirée à trancher'],
  ['24 nov.', '4.65', 'Réglages Bambu écrits dans le .3mf', 'Ouvrir, trancher, envoyer, sans rien vérifier'],
  ['22 nov.', '4.64', 'Lettres de 4,5 mm, logo de 8 cm', 'Lettres de 2,8 mm décollées'],
  ['22 nov.', '4.63', 'Socle couleur du sol, dos couleur des chemins', 'Moins de changements de filament, texte lisible'],
];
function reglages3mf(c) {
  return [
    ['Plateau, 1re couche', nb(c.plateau_1re) + ' °C', '65 °C le 25 nov. : 1re couche décollée', 'PLATEAU_1RE_COUCHE_C'],
    ['Plateau, couches suivantes', nb(c.plateau) + ' °C', 'Comme la plaque réussie du 22 nov.', 'PLATEAU_C'],
    ['Type de plateau', 'Textured PEI Plate', 'Plateau réel : CryoGrip Glacier', '(fixe)'],
    ['Buse, 1re couche', nb(c.buse_1re) + ' °C', 'Modèle Bambu : 245 °C', 'PREMIERE_COUCHE_BUSE_C'],
    ['Débit, 1re couche', nb(c.debit_1re), '0,9 : lignes pas assez écrasées', 'PREMIERE_COUCHE_DEBIT'],
    ['Vitesse 1re couche, contours', nb(c.vitesse_1re) + ' mm/s', 'Modèle Bambu : 50 mm/s', 'PREMIERE_COUCHE_VITESSE_MM_S'],
    ['Vitesse 1re couche, remplissage', nb(c.remplissage_1re) + ' mm/s', 'Modèle Bambu : 105 mm/s', 'PREMIERE_COUCHE_REMPLISSAGE_MM_S'],
    ['Brim', nb(c.brim) + ' mm (aucun avec un cadre)', 'Plaque de 304,8 mm sur 320 mm', 'BORDURE_MM'],
    ['Bordure de cadre', nb(c.cadre_bordure) + ' mm tout le tour', 'Tient au plateau à la place du brim', 'CADRE_BORDURE_MM'],
    ['Precise Z height', c.precise_z ? 'coché' : 'décoché', 'Coché : tour de purge énorme', 'PRECISE_Z'],
    ['Lissage (ironing)', 'Top surfaces : ' + (c.lissage || []).join(', '), 'Lacs parfaits, rivières abîmées', 'LISSAGE_PIECES'],
    ['Tour de purge', 'à ' + nb(c.tour_ecart) + ' mm, y = ' + nb(c.tour_y) + ' mm', 'À portée des deux buses (x ≤ 325 − largeur − 5)', 'TOUR_PURGE_ECART_MM'],
    ['Position de la maquette', 'x = ' + nb((c.centre || [])[0]) + ', y = ' + nb((c.centre || [])[1]) + ' mm', 'Place pour la tour à droite', 'PLATEAU_CENTRE_MM'],
    ['Purges', '× ' + nb(c.purge_fonce) + ' du foncé vers le clair, ' + nb(c.purge_max) + ' mm³ au plus', 'Taches foncées sur le beige', 'PURGE_FONCE_VERS_CLAIR'],
    ['Chambre', nb(c.chambre) + ' °C (mode Chauffage)', 'PETG sans décollement', 'CHAMBRE_C'],
    ['Extraction de la chambre', nb(c.extraction) + ' %', 'Modèle Bambu : 70 %', 'EXTRACTION_PENDANT_IMPRESSION'],
  ];
}

// Plateau vu de dessus (1 unité = 1 mm, origine à 20,20), couleurs du hub
function plateau(c) {
  const brim = (c && c.brim) || 0, cx = c && c.centre ? c.centre[0] : 165;
  const mx = 20 + cx - 127 - brim, mw = 254 + 2 * brim;
  const tx = 20 + Math.min(325 - 20 - 5, cx + 127 + brim + ((c && c.tour_ecart) || 0));
  return `<svg viewBox="0 0 370 380" role="img" aria-label="Plateau de la H2C vu de dessus" style="width:100%;height:auto;display:block;font-family:inherit">
    <rect x="20" y="20" width="330" height="320" rx="6" fill="var(--fond)" stroke="var(--bordure-controle)"/>
    <rect x="20" y="20" width="25" height="320" fill="rgba(140,196,224,.18)"/>
    <rect x="345" y="20" width="5" height="320" fill="rgba(255,103,31,.35)"/>
    <rect x="${mx}" y="27.6" width="${mw}" height="314.8" fill="rgba(147,170,95,.28)" stroke="var(--accent)" stroke-width="1.5"/>
    <rect x="${tx}" y="200" width="20" height="120" fill="var(--bordure-controle)" stroke="var(--texte-doux)"/>
    <text x="32.5" y="185" fill="var(--eau)" font-size="10" font-weight="600" transform="rotate(-90 32.5 185)" text-anchor="middle">buse gauche seulement</text>
    <text x="${mx + mw / 2}" y="190" fill="var(--texte)" font-size="13" font-weight="700" text-anchor="middle">Maquette 10 × 12</text>
    <text x="${tx + 10}" y="192" fill="var(--texte-doux)" font-size="10" font-weight="600" text-anchor="middle">tour</text>
    <text x="20" y="362" fill="var(--texte-doux)" font-size="11">x = 0</text>
    <text x="45" y="375" fill="var(--eau)" font-size="10" text-anchor="middle">25</text>
    <text x="345" y="375" fill="var(--balise)" font-size="10" text-anchor="middle">325</text>
    <text x="350" y="362" fill="var(--texte-doux)" font-size="11" text-anchor="end">330 mm</text>
  </svg>
  <div class="tres-petit doux" style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px">
    <span><span class="pastille" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:rgba(140,196,224,.5);margin-right:5px"></span>x 0 à 25 : buse gauche seulement</span>
    <span><span class="pastille" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:rgba(255,103,31,.6);margin-right:5px"></span>x 325 à 330 : buse droite seulement</span>
    <span><span class="pastille" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--accent);margin-right:5px"></span>Maquette</span>
    <span><span class="pastille" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--bordure-controle);margin-right:5px"></span>Tour de purge</span>
  </div>`;
}

function avis() {
  if (!etat.charge) return `<div class="bandeau info" style="margin:0 0 16px"><span class="petit">Lecture des réglages dans Georama Production de cet ordi…</span></div>`;
  if (!etat.erreur) return '';
  const txt = etat.erreur === 'ancien'
    ? '<strong>Georama Production de cet ordi est trop ancien pour envoyer ses réglages au hub</strong> (il faut la 4.72). Redémarre-le avec « Redémarrer Georama Production ».'
    : '<strong>Georama Production n’est pas ouvert sur cet ordi</strong> (ou Chrome n’a pas encore permis au hub de le voir). Les règles s’affichent quand même ; les valeurs en direct arrivent dès qu’il est ouvert.';
  return `<div class="bandeau${etat.erreur === 'arrete' ? ' info' : ''}" style="margin:0 0 16px"><span class="petit" style="flex:1 1 320px">${txt}</span>
    <span class="actions">${etat.erreur === 'arrete' ? '<button type="button" class="btn" data-act="gp-demarrer">Démarrer Georama Production</button>' : ''}
    <button type="button" class="btn-2" data-act="regles-relire">Relire</button></span></div>`;
}

export function vueRegles() {
  const c = etat.donnees || {};
  const ok = !!etat.donnees;
  const v = s => ok ? esc(s) : '—';
  const kpi = (sur, val, det) => `<div class="carte kpi"><p class="surtitre">${sur}</p><p class="valeur" style="font-size:22px;line-height:28px">${val}</p>${det ? `<p class="detail">${det}</p>` : ''}</div>`;
  const pastilleNo = n => `<span style="flex:0 0 auto;display:inline-flex;width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--sur-accent);font-weight:700;font-size:13px;align-items:center;justify-content:center">${n}</span>`;
  return `${avis()}
    <p class="petit doux" style="margin:0 0 14px;max-width:820px">Tout ce que Georama Production écrit dans chaque .3mf pour la H2C : il ne reste qu’à ouvrir le fichier, trancher et envoyer. Les valeurs sont lues en direct dans les réglages de Production${ok ? ' (v' + esc(c.version) + ')' : ''}.</p>
    <div class="g6" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:16px">
      ${kpi('Version', ok ? 'v' + esc(c.version) : '—', 'Georama Production')}
      ${kpi('Plateau', ok ? v(nb(c.plateau_1re) + ' puis ' + nb(c.plateau) + ' °C') : '—', '1re couche, puis la suite')}
      ${kpi('Buse 1re couche', ok ? v(nb(c.buse_1re) + ' °C') : '—', 'Débit ' + (ok ? esc(nb(c.debit_1re)) : '—'))}
      ${kpi('Chambre', ok ? v(nb(c.chambre) + ' °C') : '—', 'Mode Chauffage')}
      ${kpi('Tranchage auto', ok ? (c.trancher_auto ? 'Activé' : 'Éteint') : '—', 'Bambu Studio en arrière-plan')}
    </div>

    <section class="carte" style="margin-bottom:16px">
      <div class="carte-tete"><h2>Les règles d’or</h2><span class="tres-petit doux">Si une saute, le fichier se tranche mal ou l’impression rate.</span></div>
      <div class="g2" style="gap:0 24px">${OR.map((r, i) => {
        const val = r[2] && ok ? r[2](c) : '';
        const alerte = r[3] && ok ? r[3](c) : false;
        return `<div class="ligne" style="align-items:flex-start;gap:12px;${i < 2 ? 'border-top:0' : ''}">${pastilleNo(i + 1)}
          <span class="grow"><strong class="petit">${esc(r[0])}</strong><br><span class="petit doux">${esc(r[1])}</span>${val ? `<br><span class="etiquette ${alerte ? 'orange' : 'vert'}" style="margin-top:6px;white-space:normal">${esc(val)}</span>` : ''}</span></div>`;
      }).join('')}</div>
    </section>

    <section class="carte" style="margin-bottom:16px">
      <div class="carte-tete"><h2>Routine d’impression</h2><span class="tres-petit doux">Quatre étapes, du hub à la 1re couche.</span></div>
      <div class="g4">${ROUTINE.map((r, i) => `<div style="display:flex;gap:10px;align-items:flex-start">${pastilleNo(i + 1)}<span><strong class="petit">${esc(r[0])}</strong><br><span class="petit doux">${esc(r[1])}</span></span></div>`).join('')}</div>
    </section>

    <section class="carte" style="margin-bottom:16px">
      <div class="carte-tete"><h2>Réglages écrits dans le .3mf</h2><span class="tres-petit doux">Profil « 0.16mm High Quality @BBL H2C - georama »</span></div>
      <div style="overflow-x:auto"><table class="liste"><thead><tr><th>Réglage Bambu Studio</th><th>Valeur</th><th>Pourquoi</th><th>Dans Production</th></tr></thead>
        <tbody>${ok ? reglages3mf(c).map(l => `<tr><td>${esc(l[0])}</td><td class="vert-t" style="font-weight:700;white-space:nowrap">${esc(l[1])}</td><td class="petit doux">${esc(l[2])}</td><td class="tres-petit doux" style="font-family:ui-monospace,Consolas,monospace">${esc(l[3])}</td></tr>`).join('')
          : '<tr><td colspan="4" class="petit doux">Valeurs lues dans Georama Production dès qu’il est ouvert sur cet ordi.</td></tr>'}</tbody></table></div>
      <p class="tres-petit doux" style="margin:10px 0 0">Pour changer une valeur : le réglage de config.py, puis « Redémarrer ». Inchangé dans le profil : 1re couche de 0,2 mm, couches de 0,16 mm, 3 parois, 6 couches pleines dessus, nid d’abeille 15 %, aucun support. Répartition des filaments : « Auto For Flush ».</p>
    </section>

    <section class="carte" style="margin-bottom:16px">
      <div class="carte-tete"><h2>Plateau et buses de la H2C</h2><span class="tres-petit doux">La maquette et la tour de purge restent dans la zone que les deux buses atteignent.</span></div>
      <div class="g2" style="align-items:start">
        <div style="max-width:400px">${plateau(ok ? c : null)}</div>
        <div>${BUSES.map(b => `<div class="ligne" style="align-items:flex-start"><strong class="petit" style="width:130px;flex:0 0 auto">${esc(b[0])}</strong><span class="grow petit doux">${esc(b[1])}</span></div>`).join('')}</div>
      </div>
    </section>

    <div class="g2" style="align-items:start;margin-bottom:16px">
      <section class="carte">
        <div class="carte-tete"><h2>Le dos de la maquette</h2></div>
        <p class="petit doux" style="margin:0 0 4px">Le dos est la 1re couche imprimée : c’est là que tout se joue pour le décollement.</p>
        <div class="ligne"><span class="petit"><strong>Texte</strong> : lettres de ${v(nb(c.lettres) + ' mm (minimum ' + nb(c.lettres_min) + ' mm)')}, texte court ; le texte complet reste dans le PDF client.</span></div>
        <div class="ligne"><span class="petit"><strong>Pochoir</strong> : le centre du o, du D, du e est relié au vert autour par une fente de ${v(nb(c.pont) + ' mm')}. La 1re couche verte est d’un seul morceau.</span></div>
        <div class="ligne"><span class="petit"><strong>Remplissage</strong> : logo et texte de la couleur des chemins (gris en Boréal) ; gravés en creux sans chemins ou si c’est la couleur du socle.</span></div>
        <div class="ligne"><span class="petit"><strong>Logo</strong> : ${ok ? esc(nb(c.logo / 10) + ' cm') : '—'} de large au plus, sous l’accroche du haut.</span></div>
        <div class="ligne"><span class="petit"><strong>Accroches</strong> : une en haut, une 2e en paysage ; le texte les contourne. Aucune en grand format.</span></div>
      </section>
      <section class="carte">
        <div class="carte-tete"><h2>À ne jamais faire</h2></div>
        ${JAMAIS.map(j => `<div class="ligne" style="justify-content:flex-start;align-items:flex-start"><span class="retard" style="flex:0 0 auto">✕</span><span class="petit"><strong class="retard">${esc(j[0])}</strong>${j[1] ? '<span class="doux"> : ' + esc(j[1]) + '</span>' : ''}</span></div>`).join('')}
      </section>
    </div>

    <section class="carte" style="margin-bottom:16px">
      <div class="carte-tete"><h2>Historique des réglages</h2></div>
      <div style="overflow-x:auto"><table class="liste"><thead><tr><th>Date</th><th>Version</th><th>Changement</th><th>Raison</th></tr></thead>
        <tbody>${HISTORIQUE.map(h => `<tr><td class="petit" style="white-space:nowrap">${esc(h[0])}</td><td class="vert-t" style="font-weight:700">${esc(h[1])}</td><td class="petit">${esc(h[2])}</td><td class="petit doux">${esc(h[3])}</td></tr>`).join('')}</tbody></table></div>
    </section>
    <p class="tres-petit doux" style="margin:0">Document de référence complet : « Règles d’or : export 3MF et réglages Bambu de Georama Production » (Claude Docs).</p>`;
}
export const _etatRegles = etat;
