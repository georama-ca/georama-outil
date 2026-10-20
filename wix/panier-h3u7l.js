// ============================================================================
// Code de la PAGE PANIER (h3u7l), 20 oct. 2026
// Encadré « Votre lien de visualisation 3D » au-dessus du panier :
// l'élément HTML #html1 affiche https://outil.georama.ca/panier/lien.html ;
// cette page lui envoie les liens des maquettes du panier (champ « Lieu à géolocaliser »).
// Panier vide ou sans lien : l'encadré est replié.
// ============================================================================
import wixEcomFrontend from 'wix-ecom-frontend';
import { liensPanier } from 'backend/georama.web';

const ID_LIEN = '#html1';

$w.onReady(() => {
  let el;
  try { el = $w(ID_LIEN); } catch (e) { return; }
  if (!el || !el.id) return;
  let liens = [];
  const envoyer = () => { try { el.postMessage({ type: 'georama-liens', liens }); } catch (e) { } };
  const maj = async () => {
    try { liens = await liensPanier(); } catch (e) { liens = []; }
    if (liens.length) { try { el.expand(); } catch (e) { } envoyer(); }
    else { try { el.collapse(); } catch (e) { } }
  };
  el.onMessage((e) => { if (e.data && e.data.type === 'georama-lien-pret') envoyer(); });
  try { wixEcomFrontend.onCartChange(() => maj()); } catch (e) { }
  maj();
});
