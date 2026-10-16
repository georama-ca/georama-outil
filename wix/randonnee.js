// ============================================================================
// Page d'atterrissage Georama (copie de la page Terre à bois).
// Les textes de Terre à bois sont remplacés à l'ouverture par ceux du segment
// ci-dessous (CONFIG). Pour changer un texte : modifier CONFIG, rien d'autre.
// ============================================================================
import wixWindowFrontend from 'wix-window-frontend';
import wixSeoFrontend from 'wix-seo-frontend';

const CONFIG = {
  "segment": "pleinair",
  "textes": [
    [
      "TERRE À BOIS · ÉRABLIÈRE · CHALET",
      "SOMMET · SENTIER · TRACÉ GPS"
    ],
    [
      "Votre terre comme vous ne l",
      "Le sommet que vous avez gravi, posé sur votre mur."
    ],
    [
      "Vos lignes de lot, vos coteaux",
      "Votre randonnée, votre course en sentier ou votre ascension préférée devient une maquette 3D : le relief exact, les sentiers et votre tracé GPS imprimés en couleur."
    ],
    [
      "Le numéro est sur votre compte de taxes",
      "Gratuit, sans inscription : cherchez votre sommet ou importez votre tracé GPS. Places limitées pour Noël : commandez avant le 1er décembre."
    ],
    [
      "Votre terre en relief, en 30 secondes",
      "Votre sommet en relief, en 30 secondes"
    ],
    [
      "Entrez votre numéro de lot",
      "Cherchez votre sommet, ajoutez votre tracé GPS, puis voyez votre maquette accrochée au mur. Rien à payer pour essayer."
    ],
    [
      "CE QUE L'OUTIL AJOUTE À VOTRE TERRE",
      "CE QUE L'OUTIL AJOUTE À VOTRE SOMMET"
    ],
    [
      "Trois étapes, et votre terre",
      "Trois étapes, et votre sommet prend du relief"
    ],
    [
      "Je cadre ma propriété",
      "Je trouve mon sommet"
    ],
    [
      "L'outil s'ouvre avec le cadastre",
      "L'outil s'ouvre avec le relief, les lacs et les sentiers déjà affichés. J'ajoute mon tracé GPS (GPX ou KML) ou je le dessine sur la carte."
    ],
    [
      "Mon lot en vedette",
      "Votre tracé en vedette"
    ],
    [
      "Votre terre ressort en relief",
      "Votre parcours GPS (GPX ou KML) imprimé en relief, du départ jusqu'au sommet."
    ],
    [
      "Cabane à sucre, chalet, camp",
      "Refuge, belvédère, point de départ : placez-les sur la carte, ils deviennent de petits objets imprimés sur la maquette."
    ],
    [
      "Vos sentiers et chemins",
      "Vos sentiers"
    ],
    [
      "Tracez-les à la main",
      "Les sentiers s'affichent tout seuls. Ajoutez les vôtres à la main ou par fichier GPS."
    ],
    [
      "Votre forêt",
      "Le relief exact"
    ],
    [
      "Érablières, essences",
      "Le terrain vient des données LiDAR du Québec : chaque crête et chaque vallée est à sa place."
    ]
  ],
  "boutons": [
    [
      "Voir ma terre en couleurs",
      "Voir mon sommet en couleurs"
    ],
    [
      "Essayer avec ma terre",
      "Essayer avec mon sommet"
    ],
    [
      "Voir ma terre",
      "Voir mon sommet"
    ]
  ],
  "champ": "Nom du sommet, du parc ou du sentier",
  "seoTitre": "Maquette 3D de sommet et de sentier | Georama",
  "seoDescription": "Transformez votre randonnée en maquette 3D : relief exact, sentiers et tracé GPS imprimés en couleur. Aperçu gratuit en ligne, fabriqué au Québec."
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
  // les éléments d'un répéteur ne sont pas touchés ici (Wix les copierait dans tous les éléments)
  const dansRepeteur = (el) => { let p = el; for (let i = 0; i < 12 && p; i++) { try { p = p.parent; } catch (e) { return false; } if (p && p.type === '$w.Repeater') return true; } return false; };
  const textes = tous($w('Text')), boutons = tous($w('Button'));
  const idsRep = textes.concat(boutons).filter(dansRepeteur).map((el) => el.id);
  remplacerTextes(textes.filter((el) => !idsRep.includes(el.id)));
  remplacerBoutons(boutons.filter((el) => !idsRep.includes(el.id)));
  // les répéteurs (atouts, étapes) sont modifiés directement dans l'éditeur, page par page
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
