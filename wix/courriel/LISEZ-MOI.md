# Courriel « M'envoyer ma maquette » (côté Wix) : PAS ENCORE INSTALLÉ

Brouillon du 18 nov. 2026. L'outil (essai v4.26) est prêt ; ces fichiers restent à installer dans l'éditeur Wix, à tester, puis le site est à publier **à la demande d'Anne-Marie**.

Décisions d'Anne-Marie (18 nov.) : encadré à l'étape 5 ; courriel envoyé tout de suite + relance 3 jours plus tard pour les cases cochées ; **même texte pour les deux** (« Votre maquette vous attend »).

## Messages entre l'outil et la page
- outil → page : `georama-courriel-dispo` ; page → outil : `georama-courriel-pret` (l'encadré s'affiche seulement après).
- outil → page : `georama-courriel` {courriel, rappel, zone, segment, nom, prix} ; page → outil : `georama-courriel-resultat` {ok}.

## À installer
1. `backend/courriel.web.js` (ce dossier). Paquets npm à ajouter dans l'éditeur : `@wix/email-transmissions`, `@wix/essentials` (s'ils n'y sont pas).
2. Collection Wix « CourrielsMaquette » (accès : administrateur seulement) : courriel, zone, segment, rappel (booléen), relanceLe (date), relanceFaite (booléen).
3. `backend/jobs.config` : ajouter la tâche de `jobs.config.exemple.json` (une fois par jour).
4. Code de page : ajouter `page-extrait.js` là où les messages de #html1 sont déjà lus (compteur).
5. Avant le premier envoi : vérifier que info@georama.ca est un expéditeur vérifié (API Sender Emails), le quota du mois (Account Details), et comment noter le consentement du contact (abonnement courriel SUBSCRIBED) pour que la relance de type MARKETING ne soit pas sautée (MARKETING_CONSENT_NOT_GIVEN).
6. Remplir ADRESSE_POSTALE dans courriel.web.js (obligatoire dans la relance, LCAP).
7. Test : envoi à info@georama.ca seulement, puis publication.
8. Politique de confidentialité : ajouter une ligne sur ce courriel (adresse gardée pour l'envoi et la relance).

API utilisée : Email Transmissions, `sendEmailTransmission` (TRANSACTIONAL pour l'envoi demandé, MARKETING + unsubscribeUrlPlaceholder pour la relance). Les envois comptent dans le quota de courriels marketing.
