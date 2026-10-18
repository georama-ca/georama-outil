// ============================================================================
// Page d'accueil Georama (prototype A, octobre 2026)
// Les textes de l'éditeur sont remplacés à l'ouverture par ceux de CONFIG.
// Pour changer un texte : modifier CONFIG, rien d'autre.
// ============================================================================
import wixWindowFrontend from 'wix-window-frontend';
import wixLocationFrontend from 'wix-location-frontend';

const CONFIG = {
  // [début du texte dans l'éditeur, nouveau texte]
  textes: [
    ["Transformez votre territoire", "Votre territoire, en relief."],
    ["Georama transforme des données", "Une terre à bois, un lac, un quartier ou un sommet : Georama transforme les données géographiques du Québec en maquette 3D à accrocher au mur ou à poser sur la table."],
    ["CE QUE L'OUTIL AJOUTE", "SIX FAÇONS DE VOIR VOTRE COIN DE PAYS"],
    ["Une carte, c'est plate", "Que voulez-vous mettre en relief ?"],
    ["Tout se choisit dans l'outil", "Choisissez votre type de maquette : exemples, options et aperçu 3D gratuit avant de commander."]
  ],
  boutons: [
    ["Prévisualisation gratuite →", "Voir en 3D, gratuitement →"]
  ],
  // les six types de maquettes (section sous l'image d'accueil)
  segments: [
    { titre: "Terre à bois, érablière et chalet", texte: "Votre lot, vos coteaux, vos ruisseaux et la cabane à sucre.", couches: "Lignes de lot · ruisseaux · érablières · cabane", prix: "Dès 175 $", url: "/terre-érablière-chalet",
      image: "wix:image://v1/7477d2_d6dd4848d4a145ae998b0f55ab7eecab~mv2.jpg/maquette-3d-erabliere-chalet-terrain-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D d'une érablière et d'un terrain de chalet" },
    { titre: "Territoire de chasse", texte: "L'habitat, vos postes et vos sentiers, en relief.", couches: "Habitat de l'orignal · peuplements forestiers · densité de la forêt", prix: "Dès 175 $", url: "/territoire-de-chasse",
      image: "wix:image://v1/7477d2_548847e79a4b4071a86848739580f8b4~mv2.jpg/maquette-topographique-chasse-salon-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D d'un territoire de chasse sur une tablette du salon" },
    { titre: "Pêche et fond de lac", texte: "Les fosses, les hauts-fonds et les profondeurs de votre lac.", couches: "Bathymétrie · fosses et hauts-fonds · profondeurs en couleur", prix: "Dès 175 $", url: "/terre-érablière-chalet-2",
      image: "wix:image://v1/7477d2_129ac50aadea48a4bbf30cbd14e3efad~mv2.jpg/maquette-3d-lac-bathymetrie-cadre-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D de lac et bathymétrie dans un cadre" },
    { titre: "Sommet et sentier", texte: "Le relief de la montagne, les sentiers et votre tracé GPS.", couches: "Relief exact · sentiers · votre tracé GPS", prix: "Dès 175 $", url: "/terre-érablière-chalet-1",
      image: "wix:image://v1/7477d2_45b9104911d14541ad2374ebdc4dae1b~mv2.jpg/maquette-3d-mont-sentier-randonnee-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D d'un mont et de son sentier de randonnée" },
    { titre: "Ville et quartier", texte: "Vos rues, vos parcs et les bâtiments en 3D.", couches: "Bâtiments en 3D · rues et parcs · relief de la ville", prix: "Dès 175 $", url: "/villeetquartier",
      image: "wix:image://v1/7477d2_e3930cd8d5fb44209f6544787c97ab48~mv2.jpg/maquette-3d-vieux-quebec-batiments-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D du Vieux-Québec et de ses bâtiments" },
    { titre: "Entreprises et institutions", texte: "Grand format sur mesure, cadre inclus, sur soumission.", couches: "Grand format · bâtiments en 3D · couches sur mesure", prix: "Dès 900 $", url: "/terre-érablière-chalet-3",
      image: "wix:image://v1/7477d2_3c73d063db3d420d987185fced2e13d7~mv2.jpg/maquette-3d-chantier-maritime-entreprise-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D grand format d'un chantier maritime" }
  ]
};

// ---- Diaporama de photos dans l'image d'accueil ----
const PHOTOS = [
  { src: "wix:image://v1/7477d2_d6dd4848d4a145ae998b0f55ab7eecab~mv2.jpg/maquette-3d-erabliere-chalet-terrain-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D d'une érablière et d'un terrain de chalet" },
  { src: "wix:image://v1/7477d2_e3930cd8d5fb44209f6544787c97ab48~mv2.jpg/maquette-3d-vieux-quebec-batiments-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D du Vieux-Québec et de ses bâtiments" },
  { src: "wix:image://v1/7477d2_45b9104911d14541ad2374ebdc4dae1b~mv2.jpg/maquette-3d-mont-sentier-randonnee-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D d'un mont et de son sentier de randonnée" },
  { src: "wix:image://v1/7477d2_129ac50aadea48a4bbf30cbd14e3efad~mv2.jpg/maquette-3d-lac-bathymetrie-cadre-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D de lac et bathymétrie dans un cadre" },
  { src: "wix:image://v1/7477d2_a9ed6a38a2834d879511063219d61c42~mv2.jpg/carte-3d-territoire-de-chasse-quebec-georama.jpg#originWidth=1500&originHeight=2000", alt: "Carte 3D d'un territoire de chasse au Québec, imprimée par Georama" },
  { src: "wix:image://v1/7477d2_3c73d063db3d420d987185fced2e13d7~mv2.jpg/maquette-3d-chantier-maritime-entreprise-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D d'un chantier maritime pour une entreprise" },
  { src: "wix:image://v1/7477d2_1496839102204553b4fed257df1eb162~mv2.jpg/maquette-3d-chemins-forestiers-riviere-quebec-georama.jpg#originWidth=2000&originHeight=1500", alt: "Maquette 3D d'une terre à bois avec chemins forestiers et rivière" }
];

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

function diaporama() {
  let g = null;
  try { g = $w('#gallery1'); } catch (e) { return; }
  if (!g || !g.id) return;
  try { g.items = PHOTOS.map((p) => ({ type: 'image', src: p.src, alt: p.alt, title: '', description: '' })); } catch (e) { }
  try { g.clickAction = 'none'; } catch (e) { }
  try { if (wixWindowFrontend.rendering.env !== 'browser') return; } catch (e) { }
  let joue = false;
  try { if (g.galleryCapabilities && g.galleryCapabilities.isPlayable) { g.play(); joue = true; } } catch (e) { }
  if (!joue) setInterval(() => { try { g.next(); } catch (e) { } }, 5000);
}

// les six cartes « Que voulez-vous mettre en relief ? »
function segments() {
  let rep = null;
  try { rep = $w('#repeater4'); } catch (e) { return; }
  if (!rep || !rep.id) return;
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  rep.onItemReady(($item, d) => {
    // le titre est le plus court des deux textes de la carte
    const a = $item('#text46'), b = $item('#text47');
    let titre = a, texte = b;
    try { if (propre(a.text).length > propre(b.text).length) { titre = b; texte = a; } } catch (e) { }
    try { titre.html = nouveauHtml(titre.html, d.titre + ' →'); } catch (e) { }
    try {
      const cls = (texte.html.match(/class="([^"]+)"/) || [])[1] || 'font_8';
      texte.html = '<p class="' + cls + '">' + esc(d.texte) + '</p>' +
        '<p class="' + cls + '"><span style="color:#5D6150;">' + esc(d.couches) + '</span></p>' +
        '<p class="' + cls + '"><span style="font-weight:bold;">' + esc(d.prix) + '</span> · Voir la page →</p>';
    } catch (e) { }
    try { const p = $item('#photoSegment'); p.src = d.image; p.alt = d.alt; } catch (e) { }
    const aller = () => wixLocationFrontend.to(d.url);
    try { $item('#box55').onClick(aller); } catch (e) { }
    try { titre.onClick(aller); } catch (e) { }
    try { $item('#photoSegment').onClick(aller); } catch (e) { }
  });
  rep.data = CONFIG.segments.map((s, i) => ({ _id: 'seg' + i, ...s }));
}

$w.onReady(() => {
  diaporama();
  remplacerTextes($w('Text'));
  remplacerBoutons($w('Button'));
  segments();
});
