// ============================================================================
// Code de la page /carte-cadeau (27 nov. 2026). La page statique est dans le bloc HTML #html1
// (outil.georama.ca/carte-cadeau). Elle envoie { type: 'georama-etape', etape: 'carte-offrir' }
// quand un visiteur clique « Offrir une carte-cadeau » ; le compteur Entonnoir le note.
// La visite de la page elle-même est notée par masterPage.js (PAGES_VISITE dans backend/compteur.web.js).
// ============================================================================
import { suivreMsg } from 'public/compteur';

$w.onReady(() => {
  try {
    $w('#html1').onMessage((e) => suivreMsg(e.data, 'carte-cadeau'));
  } catch (e) { }
});
