# -*- coding: utf-8 -*-
"""Assistant de configuration de l'agent Georama (Wix et imprimante).
Les réponses sont gardées dans config.json, sur ce PC seulement."""
import getpass
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
        print('    (« Read Orders »). Colle la clé ici (rien ne s\'affiche, c\'est normal).')
        cle = getpass.getpass('    Clé API Wix : ').strip()
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
        code = getpass.getpass('    Code d\'accès (rien ne s\'affiche) : ').strip()
        if code:
            imp['code_acces'] = code
        cfg['imprimantes'] = [imp]
        print()

    with open(CHEMIN, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    print(' Réglages enregistrés dans %s' % CHEMIN)


if __name__ == '__main__':
    main()
