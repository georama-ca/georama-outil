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

### v1.13.0 (10 novembre 2026)
- AMS en direct : l'agent 1.7 lit les 9 fentes de l'imprimante (2 AMS 2 Pro + AMS HT, bobines Bambu lues par leur puce) : couleur, type, reste en %. Production › File d'impression : pastilles des 9 fentes sous chaque imprimante. Filament et AMS : liste « AMS en direct » ; « Prêt pour quelle gamme ? » se base sur l'AMS réel quand il est connu.
- Avant de lancer : l'agent relaie les couleurs du dernier .3mf de chaque commande (rapport de Georama Production). Le hub compare avec l'AMS : « AMS prêt » ou « AMS : n couleur(s) à charger », avec la couleur manquante, les pièces qui l'utilisent et la fente à libérer (vide, ou couleur dont la commande n'a pas besoin).
- Couleurs : PETG Basic de Bambu Lab seulement (13 couleurs, ajout du jaune). Bleu pâle, crème et noir doux ne sont plus proposés (gardés « (ancien) » pour les fiches existantes). Gamme Boréal : eau en bleu brumeux.

### v1.12.3 (9 novembre 2026)
- Correctif : le bouton « Donner l'autorisation » de la fenêtre du courriel ne faisait rien (bouton ajouté après l'ouverture de la fenêtre, jamais branché). Il ouvre maintenant la page d'autorisation Microsoft.

### v1.12.2 (9 novembre 2026)
- Courriels aux clients envoyés directement depuis le hub (bouton « Envoyer » dans la fenêtre du courriel) : Microsoft Graph /me/sendMail, au nom de la personne connectée, copie dans ses Éléments envoyés. Autorisation « Mail.Send » demandée une seule fois (bouton « Donner l'autorisation » dans la fenêtre). Pièces jointes à cocher parmi les fichiers de la commande (images réduites en JPEG 1800 px, 3 Mo au total) : rendu coché d'office pour « Aperçu à approuver », PDF de confirmation pour « Commande reçue ». « Ouvrir dans ma messagerie » reste offert.

### v1.12.1 (9 novembre 2026)
- Agent 1.6.1 : les commandes du site n'entraient plus parce que la date « importer depuis » de config.json contenait autre chose qu'une date (une clé collée au mauvais endroit dans Configurer) : toutes les commandes étaient écartées. Une valeur qui n'est pas une date est maintenant ignorée (2026-11-01 par défaut) et n'est plus recopiée dans agent.json. Configurer redemande la date tant qu'elle n'est pas au format AAAA-MM-JJ.
- index.html : numéros de version des fichiers remis à jour (ils étaient restés à 1.11.4 en v1.12.0).

### v1.12.0 (9 novembre 2026)
- Fiche de production › étape « Envoi » : champ du numéro de suivi et bouton « Envoyer le suivi à Wix » (commande venue du site, livraison par la poste). Cocher « Envoi » avec un numéro de suivi l'envoie aussi tout seul. Wix crée l'expédition (Postes Canada) et envoie au client son courriel avec le lien de suivi. Travail `suivi-wix`, traité par l'agent ; résultat (lien de suivi, erreur) affiché dans la fiche.
- Agent 1.6 : travail `suivi-wix` (GET /ecom/v1/orders/{id} puis POST create-fulfillment, transporteur canadaPost). Demande la permission « Gérer les commandes » de la clé API (message clair si Wix répond 403). Mise à jour : télécharger l'agent (Paramètres) ou ouvrir `05_Georama-production\agent-1.6\` et double-cliquer sur Installer.bat.
- Pont produire_hub.py : le message du travail « 3mf » inclut le contrôle qualité de Georama Production 4.21 (filaments, étanchéité, triangles, hauteur, fichiers, purges).

### v1.11.4 (9 novembre 2026)
- Commande du site importée : le hub lance tout de suite la première version de Georama Production (aperçu rapide, .3mf, PDF client) pour l'ordi de la maison (réglage `productionAuto`, activé par défaut).
- Une commande en cours sans plaques (ex. entrée par import) reçoit ses plaques dans la file automatiquement.
- Agent 1.5 : diagnostic Wix dans agent.json (`wix_diag` : commandes lues, numéros, écartées et pourquoi) et message clair si la recherche de commandes ne renvoie rien (permission « Commandes » de la clé API).

### v1.11.3 (8 novembre 2026)
- Tâches fusionnées dans le Tableau de bord, sur ordi comme au cellulaire : onglets « Aperçu · Tâches » en haut de la page, plus d'entrée Tâches séparée dans le menu (#/taches marche toujours). Raccourcis 1 à 5 de nouveau alignés sur le menu.

### v1.11.2 (8 novembre 2026)
- Ventes : une commande reliée à des paiements Wix compte seulement la partie NON payée par Wix (ex. contrat de 1 250 $ dont 500 $ inscrits dans Wix et le reste par virement Interac). Avant, elle disparaissait au complet dès qu'un paiement Wix y était relié.
- 8 commandes passées entrées dans commandes.json (Clients), champ `importe: true`.

### v1.11.1 (8 novembre 2026)
- Chrono : arrêt automatique après 20 minutes sans activité dans le hub (souris, clavier, toucher, ou travail dans le cadre Georama Production). Le temps est enregistré jusqu'à la dernière activité, avec une note ; un message l'explique au retour. Vérifié aussi à l'ouverture du hub (ordi en veille, onglet fermé).
- Nouvelle version publiée : le hub la détecte (toutes les 3 minutes et au retour sur l'onglet). Il se recharge tout seul si rien n'est en attente d'envoi et que personne ne s'en sert ; sinon un bandeau « Recharger » s'affiche.

### v1.11 (8 novembre 2026)
- Suivi automatique des courriels de prospection (js/suivi-courriels.js). Le hub lit seulement les en-têtes des courriels de la personne connectée (autorisation Microsoft « Mail.ReadBasic », demandée une fois par le bouton « Activer » de Prospection ; jamais le contenu), toutes les 15 minutes au plus.
- Les échanges sont reliés aux prospects par adresse, ou par domaine quand un seul prospect l'utilise (jamais Gmail, Hotmail, Sogetel, regionmekinac.com partagé, etc.). Historique dans la nouvelle collection « courriels » et sur la fiche du prospect.
- Premier envoi : le prospect passe à « Contacté », prochaine action « Relancer si pas de réponse » dans 7 jours. Réponse reçue : « Répondre », aujourd'hui.
- Une seule carte « Relancer N prospects » dans « J'ai besoin de toi » (Tâches), tenue à jour ; filtre « À relancer » dans Prospection.
- Fiche prospect : boutons « Écrire / Relancer dans Outlook » (Outlook Web) ou autre logiciel (mailto), avec un modèle prérempli.
- 97 prospects ajoutés à partir des brouillons de prospection de info@ (27 et 26 octobre), étalés à 10 par jour ouvrable du 9 au 20 novembre.

### v1.10 (8 novembre 2026)
- **Campagnes › Conversions Meta et zones choisies** : par jour, les conversions comptées par Meta à côté des zones vraiment choisies dans l'outil par les visiteurs des pubs (avec le degré de lien entre les deux). Par campagne : dépensé, clics, conversions Meta, zones choisies, jusqu'à l'étape 5, coût par zone. Par publicité (utm_content) : zones et visiteurs allés jusqu'à l'étape 5. Les groupes Facebook (gratuits) à part. Les jours où le compteur du site était plein ne comptent pas.
- **Marketing › Contenu** : calendrier de contenu (mois), publications prévues à la main (page Facebook, groupes, Instagram, Reel, blogue, infolettre, presse ; statut idée / à préparer / prêt / publié ; segment ; texte prêt à copier) + automatique : articles du blogue Wix, infolettres envoyées, publications de la page Facebook (si le jeton le permet), début et fin des pubs Meta, tâches marketing avec échéance. Rythme du mois par canal, 3 prochaines semaines, idées sans date. Au cellulaire : liste du mois. Plan proposé par Claude jusqu'à la mi-décembre (à adapter).
- **Dépenses automatiques** (Finances › Dépenses) : les pubs Meta du mois (lues dans Meta) et les abonnements (Wix, Microsoft 365, Meshy… montant et fréquence entrés une fois). Une dépense « Auto » s'efface dès que la vraie facture du même fournisseur est entrée pour ce mois-là.
- Agent : stats.py lit aussi les articles du blogue Wix, les dépenses Meta par mois (13 mois) et, si le jeton le permet, les publications de la page Facebook.

### v1.9.2 (8 novembre 2026)
- **Marketing › Campagnes** montre maintenant les campagnes Meta lues automatiquement (dépensé, vues, clics, visites, conversions, 30 jours), et les totaux en haut les incluent. Les campagnes hors Meta restent dans « Autres campagnes (suivies à la main) ».

### v1.9.1 (8 novembre 2026)
- **Pubs Meta branchées** : l'ordi de la maison lit les campagnes et les dépenses Meta (API v27.0). Jeton collé avec « Brancher Meta.bat » (une seule question, jeton invisible).

### v1.9 (8 novembre 2026)
- **Finances lues dans Wix** : les ventes viennent maintenant des paiements reçus par Wix (Finances > Paiements du site : factures Wix, boutique, paiement en personne). Chaque paiement apparaît dans la liste des ventes avec l'étiquette « Wix », sa méthode (carte, Apple Pay, en personne…) et un lien vers le paiement dans Wix. Les commandes du hub payées autrement (comptant) restent comptées ; celles déjà payées par la boutique Wix ne sont pas comptées deux fois. Agent 1.4 : stats.py lit les transactions chaque heure (permission « Wix Paiements » de la clé API).

### v1.8.2 (8 novembre 2026)
- **Georama Production prend toute la page** (ordinateur) : plus rien en haut. Les 3 outils (choisir une commande, recharger, agrandir) sont dans la colonne d'icônes à gauche ; « Agrandir » ne garde qu'une colonne mince avec ces 3 boutons. Choisir une commande ouvre une petite liste. Va de pair avec Georama Production v4.14 (en-tête compact quand il est dans le hub).

### v1.8.1 (8 novembre 2026)
- **Cellulaire** : Tâches est maintenant dans Accueil (onglets « Aperçu » et « Tâches » en haut de l'accueil). La barre du bas revient à 5 boutons. À l'ordinateur, rien ne change (Tâches reste dans le menu).

### v1.8 (8 novembre 2026)
- **Tâches** (nouveau menu, aussi en bas sur le cellulaire) : tableau Kanban qui remplace le tableau Trello « Georama · Pilotage ». Mêmes colonnes (J'ai besoin de toi, Cette semaine, Prochainement, Plus tard, En attente de quelqu'un, En cours (Claude), Terminé) et mêmes couleurs d'étiquettes. Glisser-déposer à l'ordinateur ; dans la carte : colonne, étiquette, pour qui, échéance, description, sous-tâches. « + Ajouter une carte » au bas de chaque colonne. Filtres par étiquette et par personne, recherche (aussi dans Ctrl K). Les 52 cartes de Trello sont importées (taches.json).
- **Tableau de bord** : « À faire » montre les décisions, la semaine et ce qui arrive dans 7 jours ; lien vers toutes les tâches.
- **Georama Production** : une seule ligne en haut (onglets, commande, boutons Recharger et Agrandir en icônes).

### v1.7 (8 novembre 2026)
- **Mode Georama Production** (ordinateur) : dans Production › Georama Production, le menu du hub devient une colonne d'icônes (chrono, recherche et compte restent au bas), le grand titre disparaît et le programme prend toute la hauteur de l'écran. Bouton **« Agrandir »** : cache aussi le menu et les onglets du hub (retenu sur cet ordi) ; « Réduire » pour les revoir. Bouton **« Recharger »** : relance l'affichage du programme.
- **Plus d'onglet en trop** : le bouton « Démarrer Georama Production » lance le programme sans ouvrir de nouvel onglet ; le hub l'affiche dans sa page (« Lancer depuis le hub.vbs » mis à jour dans le dossier georama-production, rien à réinstaller).
- suivi.js ajouté à la liste des fichiers versionnés (évite un mélange de versions en cache).

### v1.6 (8 novembre 2026)
- **Georama Production dans le hub** (ordinateur) : Production › Georama Production. L'interface du programme s'affiche dans le hub et reste ouverte pendant qu'on navigue ailleurs. Choisir une commande charge son lien et son numéro tout seuls (Georama Production v4.13). Bouton « Démarrer » s'il n'est pas ouvert (une fois par ordi : « Installer le bouton du hub.cmd »). Ce qui est produit dans Georama Production arrive tout seul dans la fiche de la commande (agent 1.4).
- **Demandes reçues par le site** (Prospection) : les formulaires Wix (Prévisualisation gratuite, Évaluation Premium, Contact) arrivent dans le hub ; « Ajouter aux prospects » en un clic, ou « Ignorer ».
- **Site et pubs** : recherche Google (clics, apparitions, ce que les gens cherchent), infolettres (reçus, ouverts, clics), nouveaux abonnés, codes promo et leurs utilisations.
- **Compteur Entonnoir** : tout l'historique est copié chaque heure dans OneDrive › Hub-Georama › entonnoir (un fichier par mois). Bouton « Vider le compteur (archive gardée) » : retire du site les entrées de plus de 7 jours, après vérification de la copie. Les zones des visiteurs restent visibles (historique complet).
- **Agent 1.4** : synchro Georama Production → fiche, archive Entonnoir, formulaires, infolettres, codes promo, Search Console.

### v1.5 (8 novembre 2026)
- **Marketing › Site et pubs** : achalandage du site Wix (visites et visiteurs par jour), zones choisies par les visiteurs sur une carte (segment, provenance, appareil, étape la plus loin, lien pour revoir la zone), pubs Meta par campagne (dépensé, vues, clics, visites, conversions), paniers abandonnés. Alerte quand le compteur « Entonnoir » du site est plein. Le tableau de bord prend les visites (Wix) et le dépensé (Meta) automatiquement quand ils sont branchés.
- **Dépenses** : photo ou PDF de la facture (appareil photo du cellulaire), réduite et gardée dans OneDrive › Hub-Georama › factures › AAAA-MM. Étiquette « Facture » dans la liste.
- **Ouvrir Georama Production sur cet ordi** (sur ordinateur seulement) : lance Georama Production sur l'ordi où l'on se trouve et copie le lien de la commande. Une fois par ordi : « Installer le bouton du hub.cmd » dans le dossier georama-production.
- **Agent 1.3** : lit chaque heure l'achalandage (Wix Analytics), les paniers abandonnés, les zones de la collection Entonnoir et les pubs Meta (jeton ads_read collé dans Configurer.bat) ; écrit stats-wix.json et stats-meta.json. Permissions de la clé Wix : Wix Data et Wix Données analytiques en plus de la boutique.

### v1.4 (8 novembre 2026)
- **Georama Production depuis le hub**, sur n'importe quel appareil : dans la fiche de production d'une commande, choisir le format (celui du lien, 10 × 12, 20 × 24 ou 24 × 30 po) et la gamme, puis « Aperçu rapide », « Produire le .3mf » ou « PDF client ». L'ordi de la maison fait le calcul ; les images, le .3mf et le PDF arrivent dans le dossier de la commande.
- **Interface cellulaire** : barre du haut simple (chrono, recherche, mon compte) et 5 onglets en bas (Accueil, Commandes, Production, Marketing, Finances). Les sous-onglets glissent de côté.
- **Agent 1.2** : nouveaux travaux (aperçu, PDF), gamme et format transmis à Georama Production par le pont `produire_hub.py` (inclus dans le zip et copié par Installer.bat). Les anciens agents 1.1 gardent « Produire le .3mf ».

### v1.3 (8 novembre 2026)
- **Appli sur le cellulaire** : le hub s'installe comme une appli (icône Georama, plein écran) sur Android, iPhone et ordinateur. Paramètres > « Appli sur le cellulaire » : bouton Installer (Android, Chrome) ou marche à suivre (iPhone, Safari). Rien n'est gardé en cache : l'appli charge toujours la dernière version du hub.

### v1.2 (8 novembre 2026)
- **Qui est connecté** : Paramètres > Équipe > « Comptes Microsoft » associe chaque compte à une personne (ex. info@georama.ca = Maryse Perron Chartier). Le nom sert partout : « Bonjour », chrono, tâches, historique et signature des courriels. Gardé dans OneDrive (reglages.json), rien dans le code public.

### v1.1.2 (8 novembre 2026)
- Correctif : le tableau de bord plantait (« Cannot read properties of undefined (reading 'find') ») dès qu'une commande expédiée ou livrée n'avait encore aucun courriel dans son historique.

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
