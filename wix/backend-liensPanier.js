// À ajouter à la fin de backend/georama.web.js (20 oct. 2026)
// Pour la page panier : les liens de visualisation des maquettes du panier du visiteur
export const liensPanier = webMethod(Permissions.Anyone, async () => {
  try {
    const c = await currentCart.getCurrentCart();
    return (c.lineItems || []).map((li) => {
      const ch = (li.catalogReference && li.catalogReference.options && li.catalogReference.options.customTextFields) || {};
      const lien = Object.values(ch).find((v) => /georama\.ca\/zone/.test(String(v)));
      const nom = (li.productName && (li.productName.translated || li.productName.original)) || 'Maquette Georama';
      return lien ? { nom, lien: String(lien) } : null;
    }).filter(Boolean);
  } catch (e) {
    return [];      // panier vide ou introuvable
  }
});
