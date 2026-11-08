# -*- coding: utf-8 -*-
"""Assistant de configuration de l'agent Georama (Wix et imprimante).
Les réponses sont gardées dans config.json, sur ce PC seulement."""
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
CHEMIN = os.path.join(ICI, 'config.json')
SITE_GEORAMA = '6cc4ffd6-5a4b-4c0b-a31c-da167dc6820a'


def lire():
    for p in (CHEMIN, os.path.join(ICI, 'config.exemple.json')):
        if os.path.exists(p):
            with open(p, encoding='utf-8') as f:
                return json.load(f)
    return {}


def demander(question, defaut=''):
    r = input('%s%s : ' % (question, ' [%s]' % defaut if defaut else '')).strip()
    return r or defaut


def oui(question):
    return demander(question + ' (o/n)', 'o').lower().startswith('o')


def main():
    cfg = lire()
    print()
    print(' Configuration de l\'agent Georama')
    print(' ---------------------------------')
    print(' Appuie sur Entrée pour garder la valeur entre crochets.')
    print()

    if oui(' 1. Brancher les commandes du site Wix ?'):
        print()
        print('    Clé API : manage.wix.com > Paramètres du compte > Clés API > Générer une clé.')
        print('    Nom : Agent Georama. Permission à cocher : Wix eCommerce > Lire les commandes')
        print('    (« Read Orders »). Colle la clé ici avec Ctrl+V ou un clic droit, puis Entrée.')
        print('    (Elle reste sur ce PC seulement.)')
        cle = ''.join(ch for ch in input('    Clé API Wix : ') if ch.isprintable()).strip()
        if cle and len(cle) < 40:
            print('    Cette clé semble incomplète (%d caractères). Copie-la de nouveau dans Wix.' % len(cle))
            cle = ''.join(ch for ch in input('    Clé API Wix : ') if ch.isprintable()).strip()
        if cle:
            cfg['wix_cle_api'] = cle
        cfg['wix_site_id'] = demander('    ID du site', cfg.get('wix_site_id') or SITE_GEORAMA)
        cfg['wix_depuis'] = demander('    Importer les commandes passées depuis (AAAA-MM-JJ)', cfg.get('wix_depuis') or '2026-11-01')
        if cfg.get('wix_cle_api'):
            print('    Test de la connexion à Wix...')
            try:
                from agent_georama import commandes_wix
                n = commandes_wix(cfg)
                print('    Ça marche : %d article(s) de commande depuis le %s.' % (len(n), cfg['wix_depuis']))
            except Exception as e:  # noqa: BLE001
                print('    Wix refuse : %s' % e)
                print('    Vérifie la clé et la permission « Read Orders », puis relance Configurer.bat.')
        print()

    if oui(' 2. Brancher l\'imprimante Bambu Lab (état en direct) ?'):
        print()
        print('    Sur l\'écran de l\'imprimante : Réglages > Réseau (adresse IP) et « Code d\'accès LAN ».')
        print('    Le numéro de série est dans Bambu Studio > Appareil, ou sur l\'étiquette de l\'imprimante.')
        imp = (cfg.get('imprimantes') or [{}])[0] or {}
        imp['id'] = 'h2c'
        imp['ip'] = demander('    Adresse IP', imp.get('ip', ''))
        imp['serie'] = demander('    Numéro de série', imp.get('serie', ''))
        code = ''.join(ch for ch in input('    Code d\'accès LAN (8 caractères, écran de l\'imprimante) : ') if ch.isprintable()).strip()
        if code:
            imp['code_acces'] = code
        cfg['imprimantes'] = [imp]
        print()

    if oui(' 3. Brancher les statistiques des pubs Meta ?'):
        print()
        print('    business.facebook.com > Paramètres > Utilisateurs système > Ajouter (rôle Employé),')
        print('    lui donner accès au compte publicitaire Georama, puis « Générer un nouveau jeton »')
        print('    avec la permission « ads_read ». Colle le jeton ici (il reste sur ce PC seulement).')
        jeton = ''.join(ch for ch in input('    Jeton Meta : ') if ch.isprintable()).strip()
        if jeton:
            cfg['meta_jeton'] = jeton
        compte = demander('    Numéro du compte publicitaire (Entrée = celui de Georama)', cfg.get('meta_compte') or 'act_10215769679460110')
        cfg['meta_compte'] = compte.strip()
        if cfg.get('meta_jeton') and cfg.get('meta_compte'):
            print('    Test de la connexion à Meta...')
            try:
                import stats
                d = stats.stats_meta(cfg, jours=7)
                if d.get('erreurs'):
                    print('    Meta refuse : %s' % '; '.join(d['erreurs'].values()))
                else:
                    print('    Ça marche : %d campagne(s), %d ligne(s) de statistiques sur 7 jours.' % (len(d.get('campagnes') or []), len(d.get('jours') or [])))
            except Exception as e:  # noqa: BLE001
                print('    Meta refuse : %s' % e)
        print()

    with open(CHEMIN, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    print(' Réglages enregistrés dans %s' % CHEMIN)


if __name__ == '__main__':
    main()
