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
