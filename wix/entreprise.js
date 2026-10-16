// ============================================================================
// Page d'atterrissage Georama (copie de la page Terre à bois).
// Les textes de Terre à bois sont remplacés à l'ouverture par ceux du segment
// ci-dessous (CONFIG). Pour changer un texte : modifier CONFIG, rien d'autre.
// ============================================================================
import wixWindowFrontend from 'wix-window-frontend';
import wixSeoFrontend from 'wix-seo-frontend';

const CONFIG = {
  "segment": "entreprise",
  "textes": [
    [
      "TERRE À BOIS · ÉRABLIÈRE · CHALET",
      "PARCS · SKI · GOLF · MUNICIPALITÉS · INDUSTRIES"
    ],
    [
      "Votre terre comme vous ne l",
      "Votre territoire en maquette, pour vos clients et vos équipes."
    ],
    [
      "Vos lignes de lot, vos coteaux",
      "Une maquette 3D sur mesure pour un comptoir d'accueil, une salle du conseil ou une présentation de projet. Grand format assemblé, cadre de bois inclus, sur soumission."
    ],
    [
      "Le numéro est sur votre compte de taxes",
      "Gratuit, sans inscription : explorez votre site, puis demandez votre soumission. Projets dès 900 $."
    ],
    [
      "Votre terre en relief, en 30 secondes",
      "Votre site en relief, en 30 secondes"
    ],
    [
      "Entrez votre numéro de lot",
      "Cadrez votre site, activez les couches utiles à votre équipe, puis demandez votre soumission. Rien à payer pour essayer."
    ],
    [
      "CE QUE L'OUTIL AJOUTE À VOTRE TERRE",
      "CE QUE L'OUTIL AJOUTE À VOTRE SITE"
    ],
    [
      "Trois étapes, et votre terre",
      "Trois étapes, et votre site prend du relief"
    ],
    [
      "Je cadre ma propriété",
      "Je cadre mon site"
    ],
    [
      "L'outil s'ouvre avec le cadastre",
      "L'outil affiche le relief, les bâtiments en 3D et les couches pro : pistes de ski, golf, zones industrielles, territoires fauniques, pentes, forêt, bathymétrie."
    ],
    [
      "Je la vois au mur",
      "Je choisis le format"
    ],
    [
      "Une couleur (Essentiel) ou une gamme",
      "Du 8,5 × 11 po au grand format de plusieurs plaques assemblées, ou une taille sur mesure. Couleurs et cadre de bois inclus."
    ],
    [
      "Je commande, j'approuve",
      "Je demande ma soumission"
    ],
    [
      "Tous mes choix sont déjà remplis",
      "Je reçois une soumission détaillée et un aperçu 3D à approuver. Projets dès 900 $."
    ],
    [
      "Mon lot en vedette",
      "Votre site en 3D"
    ],
    [
      "Votre terre ressort en relief",
      "Bâtiments, installations, pistes de ski, golf et stationnements en relief."
    ],
    [
      "Cabane à sucre, chalet, camp",
      "Pavillon, usine, réservoir, belvédère, enseigne : vos repères deviennent de petits objets imprimés."
    ],
    [
      "Vos sentiers et chemins",
      "Les couches pro"
    ],
    [
      "Tracez-les à la main",
      "Territoires fauniques et parcs, classes de pente, forêt et bathymétrie, pour les équipes qui gèrent un territoire."
    ],
    [
      "Votre forêt",
      "Le grand format"
    ],
    [
      "Érablières, essences",
      "Plusieurs plaques assemblées dans un cadre de bois, du comptoir d'accueil à la salle du conseil."
    ]
  ],
  "boutons": [
    [
      "Voir ma terre en couleurs",
      "Voir mon site en couleurs"
    ],
    [
      "Essayer avec ma terre",
      "Essayer avec mon site"
    ],
    [
      "Voir ma terre",
      "Voir mon site"
    ]
  ],
  "champ": "Adresse ou nom du site",
  "seoTitre": "Maquettes 3D pour entreprises et municipalités | Georama",
  "seoDescription": "Maquettes topographiques 3D sur mesure pour stations, golfs, municipalités, promoteurs et industries. Grand format, cadre inclus, sur soumission."
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
      idsRep.forEach((id) => { try { const el = $item('#' + id); if (el.type === '$w.Button') remplacerBoutons([el]); else remplacerTextes([el]); } catch (e) { } });
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
