# -*- coding: utf-8 -*-
"""Brancher les statistiques des pubs Meta : une seule question, le jeton.
Le jeton est gardé dans config.json, sur ce PC seulement (jamais dans OneDrive)."""
import getpass
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
CHEMIN = os.path.join(ICI, 'config.json')
COMPTE_GEORAMA = 'act_10215769679460110'


def main():
    cfg = {}
    if os.path.exists(CHEMIN):
        with open(CHEMIN, encoding='utf-8') as f:
            cfg = json.load(f)
    print()
    print(' Brancher les pubs Meta')
    print(' ----------------------')
    actuel = cfg.get('meta_jeton') or ''
    print(' Jeton déjà enregistré : %s' % ('oui (se termine par ...%s)' % actuel[-4:] if actuel else 'aucun'))
    print()
    print(' Copie le jeton (Ctrl+C), puis fais un CLIC DROIT dans cette fenêtre pour le coller, puis Entrée.')
    if actuel:
        print(' (Entrée sans rien coller = garder le jeton déjà enregistré.)')
    print()
    for _ in range(3):
        # Le jeton ne s'affiche pas à l'écran (comme un mot de passe) : on confirme seulement sa longueur et sa fin.
        j = ''.join(ch for ch in getpass.getpass(' Jeton Meta (il reste invisible) : ') if ch.isprintable()).strip()
        if not j and actuel:
            print(' On garde le jeton déjà enregistré.')
            break
        if len(j) < 60 or ' ' in j:
            print(' Ça ne ressemble pas à un jeton Meta (%d caractère(s) reçu(s)). Recommence le collage.' % len(j))
            continue
        cfg['meta_jeton'] = j
        print(' Jeton reçu : %d caractères, se termine par ...%s' % (len(j), j[-4:]))
        break
    else:
        print()
        print(' Aucun jeton reçu. Rien n\'est changé.')
        return 1
    cfg['meta_compte'] = (cfg.get('meta_compte') or COMPTE_GEORAMA).strip()
    with open(CHEMIN, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    print(' Enregistré (compte publicitaire %s).' % cfg['meta_compte'])
    print()
    print(' Test de la connexion à Meta...')
    try:
        import stats
        d = stats.stats_meta(cfg, jours=7)
        if d.get('erreurs'):
            print(' Meta refuse : %s' % '; '.join(d['erreurs'].values()))
            return 1
        print(' Ça marche : %d campagne(s), %d ligne(s) de statistiques sur 7 jours.' % (len(d.get('campagnes') or []), len(d.get('jours') or [])))
    except Exception as e:  # noqa: BLE001
        print(' Meta refuse : %s' % e)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
