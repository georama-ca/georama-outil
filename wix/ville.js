// ============================================================================
// Page d'atterrissage Georama (copie de la page Terre à bois).
// Les textes de Terre à bois sont remplacés à l'ouverture par ceux du segment
// ci-dessous (CONFIG). Pour changer un texte : modifier CONFIG, rien d'autre.
// ============================================================================
import wixWindowFrontend from 'wix-window-frontend';
import wixSeoFrontend from 'wix-seo-frontend';

const CONFIG = {
  "segment": "ville",
  "textes": [
    [
      "TERRE À BOIS · ÉRABLIÈRE · CHALET",
      "VILLE · QUARTIER · BÂTIMENTS"
    ],
    [
      "Votre terre comme vous ne l",
      "Votre quartier en relief, rue par rue."
    ],
    [
      "Vos lignes de lot, vos coteaux",
      "Les rues, les parcs, les bâtiments et le relief de votre coin de ville, réunis dans une maquette 3D. Votre maison peut même y être mise en évidence."
    ],
    [
      "Le numéro est sur votre compte de taxes",
      "Gratuit, sans inscription : entrez votre adresse, votre quartier s'encadre tout seul. Places limitées pour Noël : commandez avant le 1er décembre."
    ],
    [
      "Votre terre en relief, en 30 secondes",
      "Votre quartier en relief, en 30 secondes"
    ],
    [
      "Entrez votre numéro de lot",
      "Entrez votre adresse, choisissez votre bâtiment, puis voyez votre maquette accrochée au mur. Rien à payer pour essayer."
    ],
    [
      "CE QUE L'OUTIL AJOUTE À VOTRE TERRE",
      "CE QUE L'OUTIL AJOUTE À VOTRE QUARTIER"
    ],
    [
      "Trois étapes, et votre terre",
      "Trois étapes, et votre quartier prend du relief"
    ],
    [
      "Je cadre ma propriété",
      "Je cadre mon quartier"
    ],
    [
      "L'outil s'ouvre avec le cadastre",
      "L'outil s'ouvre avec les rues, les bâtiments en 3D, les parcs et les plans d'eau. Je déplace le cadre et je choisis mon bâtiment."
    ],
    [
      "Mon lot en vedette",
      "Mon bâtiment en vedette"
    ],
    [
      "Votre terre ressort en relief",
      "Votre maison, votre immeuble ou votre commerce ressort, bien identifié."
    ],
    [
      "Cabane à sucre, chalet, camp",
      "École, parc, commerce préféré : placez-les sur la carte, ils deviennent de petits repères imprimés sur la maquette."
    ],
    [
      "Vos sentiers et chemins",
      "Vos rues et vos parcs"
    ],
    [
      "Tracez-les à la main",
      "Les rues, les parcs, l'eau et les bâtiments en 3D s'affichent tout seuls."
    ],
    [
      "Votre forêt",
      "Le relief de la ville"
    ],
    [
      "Érablières, essences",
      "Les côtes et les vallées de votre quartier, à partir des données LiDAR du Québec."
    ]
  ],
  "boutons": [
    [
      "Voir ma terre en couleurs",
      "Voir mon quartier en couleurs"
    ],
    [
      "Essayer avec ma terre",
      "Essayer avec mon quartier"
    ],
    [
      "Voir ma terre",
      "Voir mon quartier"
    ]
  ],
  "champ": "Adresse ou nom du quartier",
  "seoTitre": "Maquette 3D de ville et de quartier | Georama",
  "seoDescription": "Votre quartier en maquette 3D : rues, bâtiments, parcs et relief imprimés en couleur. Aperçu gratuit en ligne, fabriqué au Québec."
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
  // les éléments d'un répéteur sont traités élément par élément ($item), les autres directement
  const dansRepeteur = (el) => { let p = el; for (let i = 0; i < 12 && p; i++) { try { p = p.parent; } catch (e) { return false; } if (p && p.type === '$w.Repeater') return true; } return false; };
  const textes = tous($w('Text')), boutons = tous($w('Button'));
  const idsRep = textes.concat(boutons).filter(dansRepeteur).map((el) => el.id);
  remplacerTextes(textes.filter((el) => !idsRep.includes(el.id)));
  remplacerBoutons(boutons.filter((el) => !idsRep.includes(el.id)));
  try {
    tous($w('Repeater')).forEach((r) => r.forEachItem(($item) => {
      idsRep.forEach((id) => { try { const el = $item('#' + id); remplacerTextes([el].filter((x) => 'html' in x)); remplacerBoutons([el].filter((x) => 'label' in x)); } catch (e) { } });
    }));
  } catch (e) { }
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
