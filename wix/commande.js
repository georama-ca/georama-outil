// ============================================================================
// Fichier Wix : public/commande.js (19 oct. 2026)
// « Commander cette maquette » dans l'outil : la maquette va DIRECTEMENT au panier,
// sans passer par la page produit.
//   1. l'outil envoie { type: 'georama-commander', segment, link, gamme, cadre, texture } ;
//   2. la page répond tout de suite « georama-commande-recue » (l'outil ne redirige plus) ;
//   3. ajouterSignature (backend/georama.web.js) ajoute la bonne variante au panier ;
//   4. le client arrive sur la page panier.
// Secours : si l'ajout échoue (ex. Entreprise, combinaison inconnue), le client va
// sur la page produit, exactement comme avant.
// Utilisation dans le code d'une page qui affiche l'outil :
//   import { brancherCommande } from 'public/commande';
//   $w.onReady(() => { brancherCommande($w('#html1')); … });
// ============================================================================
import wixEcomFrontend from 'wix-ecom-frontend';
import wixLocationFrontend from 'wix-location-frontend';
import { ajouterSignature } from 'backend/georama.web';

const PAGE_PRODUIT = 'https://www.georama.ca/product-page/maquette-professionnel-couleurs';

function lienProduit(d) {
  return PAGE_PRODUIT + '?seg=' + encodeURIComponent(d.segment || '')
    + '&g=' + encodeURIComponent(d.gamme || 'boreal')
    + '&cd=' + encodeURIComponent(d.cadre || 'bois')
    + '&tx=' + (d.texture ? 1 : 0)
    + (d.plaques > 1 ? '&fmt=' + d.plaques : '')
    + '&lien=' + encodeURIComponent(d.link || '');
}

export function brancherCommande(outil) {
  if (!outil || typeof outil.onMessage !== 'function') return;
  let enCours = false;
  outil.onMessage(async (e) => {
    const d = (e && e.data) || {};
    if (d.type !== 'georama-commander' || enCours) return;
    enCours = true;
    try { outil.postMessage({ type: 'georama-commande-recue' }); } catch (err) { }
    try {
      const r = await ajouterSignature({
        segment: d.segment,
        gamme: d.gamme || 'boreal',
        cadre: d.cadre || 'bois',
        texture: !!d.texture,
        link: d.link,
        format: d.plaques ? String(d.plaques) : ''
      });
      if (r && r.ok) {
        try { wixEcomFrontend.refreshCart(); } catch (err) { }
        await wixEcomFrontend.navigateToCartPage();
        enCours = false;
        return;
      }
    } catch (err) { console.error('Ajout au panier impossible', err); }
    enCours = false;
    wixLocationFrontend.to(lienProduit(d));      // secours : la page produit, comme avant
  });
}
