# Hub Georama

Le logiciel de gestion de Georama, accessible de partout : https://outil.georama.ca/hub/

Commandes et clients, production (file d'impression, fiche de production, planification de Noël, filament et AMS), marketing et prospection, finances. Pensé pour deux personnes qui travaillent chacune environ 10 heures par semaine dans Georama.

## Comment ça marche

- **Le hub** est une page web hébergée sur GitHub Pages. Il ne contient aucune donnée.
- **Les données** sont des fichiers JSON dans le OneDrive Georama (`01_Direction_et_Administration/Hub-Georama`). Chaque personne se connecte avec son compte Microsoft 365 Georama. Si vous modifiez la même chose en même temps, la modification la plus récente gagne, fiche par fiche.
- **L'ordi de la maison** (optionnel) : un PC toujours allumé qui fait le travail lourd (rendus 3D des .3mf, Georama Production, état de l'imprimante, commandes du site Wix). Il ne parle au hub que par le dossier OneDrive. Voir `agent/LISEZMOI.txt`.
- **Mode démo** : tant que Microsoft 365 n'est pas activé, le hub fonctionne avec des données d'exemple gardées dans le navigateur. Rien n'est partagé.

## Activer Microsoft 365 (10 minutes, une seule fois)

Avec le compte administrateur de Georama :

1. Ouvrir https://entra.microsoft.com
2. **Applications › Inscriptions d'applications › Nouvelle inscription**
   - Nom : `Hub Georama`
   - Types de comptes : **Comptes dans cet annuaire d'organisation uniquement** (Georama seulement)
   - URI de redirection : plateforme **Application monopage (SPA)**, adresse `https://outil.georama.ca/hub/`
   - Cliquer **Inscrire**
3. Sur la page **Vue d'ensemble**, copier :
   - **ID d'application (client)**
   - **ID de l'annuaire (locataire)**
4. **Autorisations d'API › Ajouter une autorisation › Microsoft Graph › Autorisations déléguées** : cocher `Files.ReadWrite.All`, puis **Ajouter**. (User.Read y est déjà.) Si le bouton est offert : **Accorder un consentement d'administrateur pour Georama**.
5. Optionnel, pour limiter l'accès à vous deux : **Applications d'entreprise › Hub Georama › Propriétés › Affectation requise = Oui**, puis **Utilisateurs et groupes › Ajouter** les deux comptes.
6. Envoyer les deux identifiants à Claude (il les met dans `config.js` : ils marcheront sur tous les appareils). En attendant, ils peuvent être collés dans **Paramètres** du hub, sur chaque appareil.

Les identifiants ne sont pas des secrets. Aucun mot de passe ne passe par le hub : la connexion se fait sur la page de Microsoft.

### Première connexion

- **La personne qui crée le hub** choisit « Utiliser mon OneDrive » : le dossier `Hub-Georama` est créé.
- Dans OneDrive, **partager** ce dossier avec l'autre personne (peut modifier) et lui envoyer le lien.
- **L'autre personne** choisit « On m'a partagé le dossier » et colle le lien.

## Raccourcis

| Touche | Action |
|---|---|
| `Ctrl K` ou `/` | Rechercher n'importe quoi (commande, client, prospect, page) |
| `N` | Nouvelle commande |
| `T` | Démarrer ou arrêter mon chrono Georama |
| `1` à `5` | Tableau de bord, Commandes, Production, Marketing, Finances |
| `?` | Aide |

## Journal des versions

### v1.1 (7 novembre 2026)
- **Courriels aux clients en un clic** : 6 modèles (commande reçue, aperçu à approuver, en production, prête à récupérer, expédiée avec suivi Postes Canada, merci et avis). Le hub suggère le bon courriel au bon moment (fiche de production, liste des commandes, « Les 7 prochains jours »), l'ouvre prérempli dans la messagerie ou le copie, et garde l'historique. Modèles et signature modifiables dans Paramètres.
- Filtre « Courriel à envoyer » dans les commandes.
- **Microsoft 365 activé** : application « Hub Georama » inscrite dans Entra (locataire Georama seulement, Files.ReadWrite.All déléguée). Fin du mode démo par défaut.
- **Ordi de la maison v1.1** : assistant `Configurer.bat` pour brancher Wix (clé tapée sur le PC seulement, ID du site Georama déjà rempli, test de connexion) et l'imprimante Bambu.

### v1.0 (6 novembre 2026)
- **Ordi de la maison** : agent Windows (`agent/agent-georama.zip`). Rendu 3D automatique de tout .3mf déposé dans le dossier d'une commande, travaux demandés depuis le hub (« Produire le .3mf », « Refaire le rendu 3D »), état en direct de l'imprimante Bambu (optionnel), commandes du site Wix importées toutes seules (optionnel).
- **Fiche de production** : galerie des rendus 3D, fichiers de la commande, lien vers le dossier OneDrive, suivi des travaux demandés.
- **File d'impression** : carte de l'ordi de la maison, avancement réel de l'imprimante quand il est branché, alertes « terminé », « en pause », « échec ».
- **Tableau de bord** : les 7 prochains jours (promesses, tâches, relances, Noël), fil de l'équipe avec les nouveautés depuis ta dernière visite, la semaine Georama (heures de chacun sur 10 h, maquettes livrées), premiers pas.
- **Chrono Georama** dans le menu : démarrer, arrêter, classer le temps (production, prospection…).
- **Recherche rapide** (`Ctrl K`) et raccourcis clavier.
- Historique de chaque commande, icônes de segments, petite fête à chaque maquette livrée.
- Commandes du site : numéro Wix gardé, lien de la zone récupéré, segment, format et gamme lus dans le lien.

### v0.9 (6 novembre 2026)
- Première version : tableau de bord Cockpit, commandes et clients, production (file, fiche, planification, filament), marketing (prospection, campagnes), finances (ventes, dépenses, taxes, objectif), paramètres, mode démo, connexion Microsoft 365 et stockage OneDrive.
