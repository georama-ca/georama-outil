// ============================================================================
// Page d'atterrissage Georama (copie de la page Terre à bois).
// Les textes de Terre à bois sont remplacés à l'ouverture par ceux du segment
// ci-dessous (CONFIG). Pour changer un texte : modifier CONFIG, rien d'autre.
// ============================================================================
import wixWindowFrontend from 'wix-window-frontend';
import wixSeoFrontend from 'wix-seo-frontend';

const CONFIG = {
  "segment": "peche",
  "textes": [
    [
      "TERRE À BOIS · ÉRABLIÈRE · CHALET",
      "LAC · FOND · PROFONDEURS"
    ],
    [
      "Votre terre comme vous ne l",
      "Le fond de votre lac, enfin visible."
    ],
    [
      "Vos lignes de lot, vos coteaux",
      "Les fosses, les hauts-fonds et les pentes du fond, en 3D et en couleur. Une maquette pour mieux connaître votre lac et retrouver vos meilleurs coins de pêche."
    ],
    [
      "Le numéro est sur votre compte de taxes",
      "Gratuit, sans inscription : l'outil indique si la carte du fond existe pour votre lac. Places limitées pour Noël : commandez avant le 1er décembre."
    ],
    [
      "Votre terre en relief, en 30 secondes",
      "Votre lac en relief, en 30 secondes"
    ],
    [
      "Entrez votre numéro de lot",
      "Cherchez votre lac, ajoutez vos quais et vos coins de pêche, puis voyez votre maquette accrochée au mur. Rien à payer pour essayer."
    ],
    [
      "CE QUE L'OUTIL AJOUTE À VOTRE TERRE",
      "CE QUE L'OUTIL AJOUTE À VOTRE LAC"
    ],
    [
      "Trois étapes, et votre terre",
      "Trois étapes, et votre lac prend du relief"
    ],
    [
      "Je cadre ma propriété",
      "Je trouve mon lac"
    ],
    [
      "L'outil s'ouvre avec le cadastre",
      "L'outil indique si la carte du fond (bathymétrie) existe pour mon lac. J'ajoute mes quais, mes repères et mes coins de pêche."
    ],
    [
      "Mon lot en vedette",
      "Le fond en vedette"
    ],
    [
      "Votre terre ressort en relief",
      "Les profondeurs se lisent en couleurs : hauts-fonds, pentes et fosses."
    ],
    [
      "Cabane à sucre, chalet, camp",
      "Quai, chalet, bouée, coin de pêche : placez-les sur la carte, ils deviennent de petits repères imprimés sur la maquette."
    ],
    [
      "Vos sentiers et chemins",
      "Les berges en relief"
    ],
    [
      "Tracez-les à la main",
      "Le terrain autour du lac, les ruisseaux et les chemins d'accès, en relief."
    ],
    [
      "Votre forêt",
      "Les profondeurs écrites"
    ],
    [
      "Érablières, essences",
      "La légende indique les profondeurs : haut-fond, profond, fosse."
    ]
  ],
  "boutons": [
    [
      "Voir ma terre en couleurs",
      "Voir mon lac en couleurs"
    ],
    [
      "Essayer avec ma terre",
      "Essayer avec mon lac"
    ],
    [
      "Voir ma terre",
      "Voir mon lac"
    ]
  ],
  "champ": "Nom du lac",
  "seoTitre": "Maquette 3D de lac et carte bathymétrique | Georama",
  "seoDescription": "Le fond de votre lac en maquette 3D : fosses, hauts-fonds et profondeurs imprimés en couleur. Aperçu gratuit en ligne, fabriqué au Québec."
};

const OUTIL  = '#html1';     // bloc de l'outil
const CHAMP  = '#textBox1';  // champ de recherche du haut de page
const BOUTON = '#button11';  // bouton de recherche du haut de page

let outilPret = false, enAttente = null;

function envoyer(msg) {
  if (outilPret) $w(OUTIL).postMessage(msg);
  else enAttente = msg;
}

function chercher() {
  const q = ($w(CHAMP).value || '').replace(/\s*\n\s*/g, ' ').trim();
  if (!q) return;
  envoyer({ type: 'georama-chercher', q });
  $w(OUTIL).scrollTo();
}

// remplace le texte en gardant la mise en forme du premier morceau
function nouveauHtml(html, texte) {
  const esc = texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let fait = false;
  return html.split(/(<[^>]+>)/).map((m) => {
    if (m.startsWith('<') || !m.replace(/&nbsp;|​|\s/g, '')) return m;
    if (fait) return '';
    fait = true;
    return esc;
  }).join('');
}
const propre = (t) => String(t || '').replace(/[​ ]/g, ' ').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
const tous = (x) => (Array.isArray(x) ? x : x && typeof x.length === 'number' ? Array.from(x) : x ? [x] : []);
function remplacerTextes(liste) {
  tous(liste).forEach((el) => {
    try {
      const t = propre(el.text);
      const r = CONFIG.textes.find(([debut]) => t.startsWith(propre(debut)));
      if (r) el.html = nouveauHtml(el.html, r[1]);
    } catch (e) { }
  });
}
function remplacerBoutons(liste) {
  tous(liste).forEach((b) => {
    try {
      const t = propre(b.label);
      const r = CONFIG.boutons.find(([o]) => t === propre(o));
      if (r) b.label = r[1];
    } catch (e) { }
  });
}

$w.onReady(() => {
  try { wixSeoFrontend.setTitle(CONFIG.seoTitre); } catch (e) { }
  try { wixSeoFrontend.setMetaTags([{ name: 'description', content: CONFIG.seoDescription }]); } catch (e) { }
  // d'abord les répéteurs (chaque élément séparément), ensuite le reste de la page
  try { tous($w('Repeater')).forEach((r) => r.forEachItem(($item) => { remplacerTextes($item('Text')); remplacerBoutons($item('Button')); })); } catch (e) { }
  remplacerTextes($w('Text'));
  remplacerBoutons($w('Button'));
  try { $w(CHAMP).placeholder = CONFIG.champ; } catch (e) { }

  $w(OUTIL).onMessage((e) => {
    const d = e.data || {};
    if (d.type === 'georama-pret') {
      outilPret = true;
      $w(OUTIL).postMessage({ type: 'georama-profil', p: CONFIG.segment });
      if (enAttente) { $w(OUTIL).postMessage(enAttente); enAttente = null; }
    }
    if (d.type === 'georama-etape' && d.premiere) {
      wixWindowFrontend.trackEvent('CustomEvent', { event: 'georama_' + d.etape, eventCategory: 'outil', eventLabel: d.segment });
    }
  });
  $w(BOUTON).onClick(chercher);
  $w(CHAMP).onKeyPress((e) => { if (e.key === 'Enter') chercher(); });
});
