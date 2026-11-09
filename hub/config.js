// Hub Georama — réglages de connexion.
// Les deux identifiants viennent de l'inscription de l'application dans Microsoft Entra
// (voir LISEZMOI.md). Ce ne sont pas des secrets : ils peuvent être publics.
// Tant qu'ils sont vides, le hub fonctionne en mode démo (données dans ce navigateur seulement).
export const CONFIG = {
  version: '1.12.0',
  versionDate: '2026-11-09',
  // « ID d'application (client) » de l'application « Hub Georama »
  clientId: '0eb2728a-feed-4887-b94e-b001bf64d465',
  // « ID de l'annuaire (locataire) » de Georama
  tenantId: '37ce75ab-7920-4aa7-a41a-97d2fc98c981',
  // Dossier des données dans le OneDrive Georama de la personne qui crée le hub
  dossier: '01_Direction_et_Administration/Hub-Georama',
};
