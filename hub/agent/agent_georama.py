# -*- coding: utf-8 -*-
"""Agent Georama : l'ordi de la maison qui travaille pour le hub.

Il tourne en continu sur un PC Windows allumé, connecté au OneDrive Georama.
Il échange avec le hub (outil.georama.ca/hub) uniquement par des fichiers dans
le dossier OneDrive du hub : aucun port ouvert, rien d'exposé sur Internet.

Ce qu'il fait :
  - signale qu'il est en ligne (agent.json, toutes les 20 secondes) ;
  - crée un dossier par commande en cours : Hub-Georama/commandes/<numéro>/ ;
  - fait le rendu 3D (PNG) de tout .3mf déposé dans un dossier de commande ;
  - exécute les travaux demandés dans le hub (.3mf avec Georama Production, rendu 3D) ;
  - (optionnel) lit l'état des imprimantes Bambu Lab sur le réseau local ;
  - (optionnel) récupère les nouvelles commandes du site Wix.

Fichiers écrits par l'agent (un seul auteur par fichier, donc pas de conflit OneDrive) :
  agent.json, travaux-resultats.json, boite-wix.json et les images de rendu.
"""
import datetime as dt
import glob
import json
import logging
import os
import platform
import re
import shutil
import shlex
import socket
import subprocess
import sys
import threading
import time
import traceback
import urllib.error
import urllib.request
from urllib.parse import urlparse, parse_qs

VERSION = '1.7.3'
ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

ACTIVES = ('nouvelle', 'approbation', 'production', 'finition')
MAX_JOURNAL = 2 * 1024 * 1024

log = logging.getLogger('agent')


def maintenant():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')


def configurer_journal():
    chemin = os.path.join(ICI, 'agent.log')
    try:
        if os.path.exists(chemin) and os.path.getsize(chemin) > MAX_JOURNAL:
            os.replace(chemin, chemin + '.1')
    except OSError:
        pass
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s',
                        handlers=[logging.FileHandler(chemin, encoding='utf-8'), logging.StreamHandler(sys.stdout)])


def lire_config():
    defaut = {
        'nom': 'Ordi de la maison',
        'dossier_hub': os.path.join(os.path.expanduser('~'), 'OneDrive - Georama', '01_Direction_et_Administration', 'Hub-Georama'),
        'intervalle_secondes': 20,
        'rendu_automatique': True,
        'rendu_largeur': 1600,
        'rendu_hauteur': 1200,
        'commande_3mf': '',
        'dossier_production': os.path.join(os.path.expanduser('~'), 'OneDrive - Georama', '04_Operations_et_Ressources_Techniques',
                                           '05_Georama-production', 'georama-production'),
        'delai_apercu_minutes': 60,
        'delai_3mf_minutes': 360,
        'imprimantes': [],
        'wix_cle_api': '',
        'wix_site_id': '',
        'wix_depuis': '2026-11-01',
        'wix_minutes': 10,
        'stats_minutes': 60,
        'meta_jeton': '',
        'meta_compte': '',
    }
    chemin = os.path.join(ICI, 'config.json')
    if os.path.exists(chemin):
        with open(chemin, encoding='utf-8') as f:
            defaut.update(json.load(f))
    defaut['dossier_hub'] = os.path.expandvars(os.path.expanduser(defaut['dossier_hub']))
    defaut['dossier_production'] = os.path.expandvars(os.path.expanduser(defaut['dossier_production'] or ''))
    return defaut


def lire_json(chemin, defaut=None):
    try:
        with open(chemin, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return defaut
    except (ValueError, OSError) as e:
        log.warning('Lecture impossible de %s : %s', chemin, e)
        return defaut


def ecrire_json(chemin, items):
    tmp = chemin + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump({'items': items, 'maj': maintenant(), 'par': 'agent ' + VERSION}, f, ensure_ascii=False, indent=1)
    os.replace(tmp, chemin)


def nom_dossier(numero):
    return ''.join(c for c in (numero or 'sans-numero') if c.isalnum() or c in '-_') or 'sans-numero'


# ---------------------------------------------------------------- Imprimantes Bambu
class Imprimante(threading.Thread):
    """Lit l'état d'une imprimante Bambu Lab en mode réseau local (MQTT, port 8883).
    Il faut l'adresse IP, le numéro de série et le code d'accès (écran de l'imprimante)."""

    def __init__(self, cfg):
        super().__init__(daemon=True)
        self.cfg = cfg
        self.etat = {'id': cfg.get('id', 'h2c'), 'connecte': False, 'vu': None}
        self.verrou = threading.Lock()

    def instantane(self):
        with self.verrou:
            return dict(self.etat)

    def lire_ams(self, p):
        """1.7 : contenu des fentes de l'AMS (bobines Bambu lues par leur puce) -> etat['ams'].
        AMS 2 Pro : unités 0 à 3 (fentes A à D) ; AMS HT : unités 128 et plus (une fente)."""
        ams = p.get('ams')
        if not isinstance(ams, dict) or not isinstance(ams.get('ams'), list):
            return
        fentes = {f['cle']: f for f in self.etat.get('ams') or []}
        for u in ams['ams']:
            try:
                uid = int(u.get('id', 0))
            except (TypeError, ValueError):
                continue
            ht = uid >= 128
            nom_u = ('AMS HT %d' % (uid - 127)) if ht else ('AMS %d' % (uid + 1))
            for t in u.get('tray') or []:
                try:
                    tid = int(t.get('id', 0))
                except (TypeError, ValueError):
                    continue
                cle = '%d-%d' % (uid, tid)
                f = fentes.get(cle) or {'cle': cle, 'fente': nom_u if ht else '%s %s' % (nom_u, 'ABCD'[tid % 4])}
                if 'tray_type' in t or 'tray_color' in t:
                    typ = (t.get('tray_type') or '').strip()
                    col = (t.get('tray_color') or '')[:6].upper()
                    f['vide'] = not typ
                    f['type'] = typ
                    f['couleur'] = ('#' + col) if (typ and len(col) == 6) else None
                    f['marque'] = (t.get('tray_sub_brands') or '').strip()
                    if t.get('remain') not in (None, -1):
                        f['reste'] = t.get('remain')
                elif len(t) <= 1 and 'vide' not in f:        # fente sans bobine (rapport complet)
                    f['vide'] = True
                fentes[cle] = f
        self.etat['ams'] = sorted(fentes.values(), key=lambda f: [int(x) for x in f['cle'].split('-')])
        self.etat['amsVu'] = maintenant()

    def run(self):
        try:
            import ssl
            import paho.mqtt.client as mqtt
        except ImportError:
            log.warning('paho-mqtt absent : état des imprimantes désactivé (relancer Installer.bat).')
            return
        serie = self.cfg['serie']

        def sur_connexion(client, *_args):
            log.info('Imprimante %s connectée.', self.etat['id'])
            client.subscribe('device/%s/report' % serie)
            client.publish('device/%s/request' % serie, json.dumps({'pushing': {'sequence_id': '0', 'command': 'pushall'}}))
            with self.verrou:
                self.etat['connecte'] = True

        def sur_message(_client, _userdata, msg):
            try:
                p = json.loads(msg.payload.decode('utf-8', 'replace')).get('print') or {}
            except ValueError:
                return
            with self.verrou:
                for cle, nom in (('gcode_state', 'etat'), ('mc_percent', 'pct'), ('mc_remaining_time', 'resteMin'),
                                 ('layer_num', 'couche'), ('total_layer_num', 'couches'), ('subtask_name', 'fichier'),
                                 ('nozzle_temper', 'buse'), ('bed_temper', 'plateau')):
                    if cle in p:
                        self.etat[nom] = p[cle]
                self.lire_ams(p)
                self.etat['vu'] = maintenant()

        def sur_deconnexion(*_args):
            with self.verrou:
                self.etat['connecte'] = False

        while True:
            try:
                try:
                    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
                except AttributeError:
                    client = mqtt.Client()
                client.username_pw_set('bblp', self.cfg['code_acces'])
                client.tls_set(cert_reqs=ssl.CERT_NONE)
                client.tls_insecure_set(True)
                client.on_connect = sur_connexion
                client.on_message = sur_message
                client.on_disconnect = sur_deconnexion
                client.connect(self.cfg['ip'], 8883, 60)
                derniere = time.time()
                client.loop_start()
                while True:
                    time.sleep(5)
                    if time.time() - derniere > 300:  # tout l'état, aux 5 minutes
                        client.publish('device/%s/request' % serie, json.dumps({'pushing': {'sequence_id': '0', 'command': 'pushall'}}))
                        derniere = time.time()
                    if not client.is_connected():
                        raise ConnectionError('déconnectée')
            except Exception as e:  # noqa: BLE001 — on réessaie toujours
                log.warning('Imprimante %s : %s. Nouvel essai dans 60 s.', self.etat['id'], e)
                with self.verrou:
                    self.etat['connecte'] = False
                try:
                    client.loop_stop()
                except Exception:  # noqa: BLE001
                    pass
                time.sleep(60)


# ---------------------------------------------------------------- Wix
SEGMENTS_LIEN = {'proprio': 'terre', 'terre': 'terre', 'chasse': 'chasse', 'peche': 'peche', 'sommet': 'sommet',
                 'randonnee': 'sommet', 'pleinair': 'sommet', 'ville': 'ville', 'entreprise': 'entreprise',
                 'agricole': 'agricole', 'champs': 'agricole', 'ferme': 'agricole'}
GAMMES_LIEN = {'boreal': 'Boréal', 'sapiniere': 'Sapinière', 'arctique': 'Arctique', 'terre': 'Terre', 'mono': 'Monochrome', 'monochrome': 'Monochrome'}


def lire_lien(lien):
    try:
        q = parse_qs(urlparse(lien).query)
    except ValueError:
        return {}
    v = lambda k: (q.get(k) or [''])[0].lower()
    fm = v('fm')
    produit = 'gf4' if fm.startswith(('508', '431')) else 'gf6' if fm.startswith(('609', '520')) else ''
    return {'segment': SEGMENTS_LIEN.get(v('p'), ''), 'gamme': GAMMES_LIEN.get(v('g'), ''), 'produit': produit}


DIAG_WIX = {}


def date_depuis(cfg):
    """Date à partir de laquelle on importe les commandes Wix. Une valeur qui n'est pas une date
    (ex. une clé collée au mauvais endroit dans Configurer) est ignorée : sinon toutes les commandes
    seraient écartées. On ne recopie jamais la valeur invalide nulle part (elle peut être secrète)."""
    v = str(cfg.get('wix_depuis') or '').strip()
    return v if re.match(r'^\d{4}-\d{2}-\d{2}$', v) else '2026-11-01'


def commandes_wix(cfg):
    corps = json.dumps({'search': {'cursorPaging': {'limit': 50}, 'sort': [{'fieldName': 'createdDate', 'order': 'DESC'}]}}).encode()
    cle = ''.join(ch for ch in str(cfg['wix_cle_api']) if ch.isprintable()).strip()
    req = urllib.request.Request('https://www.wixapis.com/ecom/v1/orders/search', data=corps, method='POST', headers={
        'Authorization': cle, 'wix-site-id': str(cfg['wix_site_id']).strip(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            donnees = json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'replace')[:300]
        raise RuntimeError('Wix répond %s : %s' % (e.code, detail or e.reason)) from None
    sortie = []
    lues = donnees.get('orders', [])
    DIAG_WIX.clear()
    depuis = date_depuis(cfg)
    DIAG_WIX.update({'quand': maintenant(), 'lues': len(lues), 'depuis': depuis,
                     'depuis_corrige': depuis != str(cfg.get('wix_depuis') or '').strip(),
                     'numeros': [str(o.get('number', '')) for o in lues[:10]], 'ecartees': []})
    for o in lues:
        cree = o.get('createdDate', '')
        if cree[:10] < depuis:
            DIAG_WIX['ecartees'].append('%s : avant le %s' % (o.get('number'), depuis))
            continue
        if o.get('status') in ('INITIALIZED',) or o.get('archived'):
            DIAG_WIX['ecartees'].append('%s : statut %s%s' % (o.get('number'), o.get('status'), ' archivée' if o.get('archived') else ''))
            continue
        contact = (o.get('billingInfo') or {}).get('contactDetails') or {}
        nom = ' '.join(x for x in (contact.get('firstName'), contact.get('lastName')) if x) or (o.get('buyerInfo') or {}).get('email', 'Client Wix')
        livraison = ((o.get('shippingInfo') or {}).get('title') or '').lower()
        recup = any(m in livraison for m in ('cueillette', 'récup', 'recup', 'saint-félicien', 'saint-felicien', 'pickup'))
        for i, li in enumerate(o.get('lineItems', [])):
            champs = ((li.get('catalogReference') or {}).get('options') or {}).get('customTextFields') or {}
            lien = next((str(x) for x in champs.values() if 'georama.ca/zone' in str(x)), '')
            infos = lire_lien(lien)
            nom_produit = ((li.get('productName') or {}).get('original') or '')
            options = ' '.join(((d.get('plainText') or {}).get('original') or '') + ' ' + ((d.get('colorInfo') or {}).get('original') or '')
                               for d in li.get('descriptionLines', []))
            texte = (nom_produit + ' ' + options).lower()
            produit = infos.get('produit') or ('gf6' if '24 × 30' in texte or '24 x 30' in texte else 'gf4' if '20 × 24' in texte or '20 x 24' in texte
                                               else 'essentiel' if 'essentiel' in texte else 'signature')
            prix = float(((li.get('price') or {}).get('amount')) or 0) * int(li.get('quantity') or 1)
            sortie.append({
                'id': '%s-%d' % (o.get('id'), i + 1), 'wixId': o.get('id'), 'wixNumero': str(o.get('number', '')),
                'date': cree, 'client': nom, 'courriel': (o.get('buyerInfo') or {}).get('email') or contact.get('email', ''),
                'telephone': contact.get('phone', ''), 'lien': lien, 'segment': infos.get('segment') or 'terre',
                'gamme': infos.get('gamme') or 'Boréal', 'produit': produit, 'prix': round(prix, 2),
                'livraison': 'recuperation' if recup else 'postes', 'payee': o.get('paymentStatus') == 'PAID',
                'article': (nom_produit + (' · ' + options.strip() if options.strip() else ''))[:200],
            })
    return sortie


# ---------------------------------------------------------------- Agent
class Agent:
    def __init__(self, cfg):
        self.cfg = cfg
        self.hub = cfg['dossier_hub']
        self.demarre = maintenant()
        self.imprimantes = []
        for c in cfg.get('imprimantes') or []:
            if c.get('ip') and c.get('serie') and c.get('code_acces'):
                t = Imprimante(c)
                t.start()
                self.imprimantes.append(t)
        self.resultats = {}
        self.dernier_wix = 0
        self.messages = []
        self.travail_en_cours = None
        self.besoins = {}               # 1.7 : couleurs de filament de chaque commande (rapport.json de Production)

    def chemin(self, *p):
        return os.path.join(self.hub, *p)

    def charger_resultats(self):
        d = lire_json(self.chemin('travaux-resultats.json'), {'items': []}) or {'items': []}
        self.resultats = {r['id']: r for r in d.get('items', []) if 'id' in r}

    def sauver_resultats(self):
        limite = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=60)).isoformat()
        items = [r for r in self.resultats.values() if (r.get('fin') or r.get('debut') or maintenant()) >= limite]
        ecrire_json(self.chemin('travaux-resultats.json'), items)

    def resultat(self, rid, **champs):
        r = self.resultats.get(rid, {'id': rid})
        r.update(champs)
        r['maj'] = maintenant()
        self.resultats[rid] = r
        self.sauver_resultats()
        return r

    def menage_conflits(self):
        """v1.7.2 : supprime les copies de conflit OneDrive de agent.json (agent-<ordi>-<n>.json, créées quand deux
        agents écrivaient en même temps). Seulement ces fichiers-là, et seulement s'ils contiennent un signal d'agent."""
        if getattr(self, '_menage_fait', 0) > time.time() - 3600:
            return
        self._menage_fait = time.time()
        motif = re.compile(r'^agent-[A-Za-z0-9_.-]+\.json$')
        n = 0
        try:
            for nom in os.listdir(self.hub):
                if not motif.match(nom) or nom == 'agent-maison.json':
                    continue
                chemin = os.path.join(self.hub, nom)
                d = lire_json(chemin, {}) or {}
                items = d.get('items') if isinstance(d, dict) else None
                if not (items and isinstance(items[0], dict) and items[0].get('id') == 'maison'):
                    continue
                os.remove(chemin)
                n += 1
        except OSError as e:
            log.warning('Ménage des copies de conflit : %s', e)
        if n:
            log.info('Ménage : %d copie(s) de conflit de agent.json supprimée(s).', n)

    def signal(self):
        self.menage_conflits()
        pont = bool(self.pont())
        capacites = {'rendu': True, '3mf': pont or bool(self.cfg.get('commande_3mf')), 'apercu': pont, 'pdf': pont,
                     'imprimantes': bool(self.imprimantes), 'ams': bool(self.imprimantes),
                     'wix': bool(self.cfg.get('wix_cle_api') and self.cfg.get('wix_site_id')),
                     'stats_wix': bool(self.cfg.get('wix_cle_api') and self.cfg.get('wix_site_id')),
                     'meta': bool(self.cfg.get('meta_jeton') and self.cfg.get('meta_compte'))}
        item = {'id': 'maison', 'nom': self.cfg.get('nom'), 'machine': socket.gethostname(), 'systeme': platform.platform(terse=True),
                'version': VERSION, 'vu': maintenant(), 'demarre': self.demarre, 'capacites': capacites,
                'travail': self.travail_en_cours, 'imprimantes': [t.instantane() for t in self.imprimantes],
                'messages': self.messages[-5:], 'wix_diag': dict(DIAG_WIX),
                'besoins': {k: {kk: vv for kk, vv in v.items() if kk != 't'} for k, v in self.besoins.items()}}
        # v1.7.3 : signal dans agent-maison.json (seul l'ordi de la maison l'écrit). agent.json n'est plus écrit :
        # un vieil agent resté sur un autre ordi peut y écrire sans se battre avec celui-ci (copies de conflit).
        ecrire_json(self.chemin('agent-maison.json'), [item])

    def commandes(self):
        d = lire_json(self.chemin('commandes.json'), {'items': []}) or {'items': []}
        return [c for c in d.get('items', []) if not c.get('supprime')]

    def dossiers_commandes(self, cmds):
        for c in cmds:
            if c.get('statut') in ACTIVES and c.get('numero'):
                os.makedirs(self.chemin('commandes', nom_dossier(c['numero'])), exist_ok=True)

    def rendre(self, chemin_3mf, rid=None, cmd=None):
        from rendu3mf import rendre_fichier
        nom = os.path.basename(chemin_3mf)
        sortie = os.path.splitext(chemin_3mf)[0] + '-rendu.png'
        rid = rid or 'auto-' + nom_dossier(os.path.basename(os.path.dirname(chemin_3mf))) + '-' + nom_dossier(os.path.splitext(nom)[0])
        self.travail_en_cours = 'Rendu 3D de ' + nom
        self.signal()
        self.resultat(rid, type='rendu', statut='en_cours', debut=maintenant(), commande=cmd, message='Rendu de ' + nom)
        t0 = time.time()
        try:
            info = rendre_fichier(chemin_3mf, sortie, self.cfg.get('rendu_largeur', 1600), self.cfg.get('rendu_hauteur', 1200))
            self.resultat(rid, statut='fait', fin=maintenant(), fichiers=[info['fichier']],
                          message='%s : %s pièces, %s triangles, %d s' % (nom, info['pieces'], f"{info['triangles']:,}".replace(',', ' '), time.time() - t0))
            log.info('Rendu fait : %s', sortie)
        except Exception as e:  # noqa: BLE001
            log.error('Rendu impossible pour %s : %s', chemin_3mf, traceback.format_exc())
            self.resultat(rid, statut='erreur', fin=maintenant(), message='Rendu impossible : %s' % e)
        finally:
            self.travail_en_cours = None

    def rendus_automatiques(self):
        if not self.cfg.get('rendu_automatique', True):
            return
        for f in sorted(glob.glob(self.chemin('commandes', '*', '*.3mf'))):
            png = os.path.splitext(f)[0] + '-rendu.png'
            try:
                if os.path.exists(png) and os.path.getmtime(png) >= os.path.getmtime(f):
                    continue
                if time.time() - os.path.getmtime(f) < 30:  # fichier peut-être en cours de copie
                    continue
            except OSError:
                continue
            self.rendre(f, cmd=os.path.basename(os.path.dirname(f)))
            return  # un rendu par tour : le signal « en ligne » reste à jour

    def travaux(self, cmds):
        d = lire_json(self.chemin('travaux.json'), {'items': []}) or {'items': []}
        par_id = {c['id']: c for c in cmds}
        for t in sorted(d.get('items', []), key=lambda x: x.get('demandeLe', '')):
            if t.get('supprime') or t['id'] in self.resultats:
                continue
            if t.get('type') == 'vider-entonnoir':
                self.vider_entonnoir(t)
                return
            if t.get('type') == 'suivi-wix':
                self.suivi_wix(t, par_id.get(t.get('commande')) or {})
                return
            c = par_id.get(t.get('commande')) or {}
            dossier = self.chemin('commandes', nom_dossier(c.get('numero') or t.get('numero')))
            os.makedirs(dossier, exist_ok=True)
            if t.get('type') == 'rendu':
                fichiers = sorted(glob.glob(os.path.join(dossier, '*.3mf')))
                if not fichiers:
                    self.resultat(t['id'], type='rendu', statut='erreur', commande=t.get('commande'), debut=maintenant(), fin=maintenant(),
                                  message='Aucun .3mf dans le dossier de la commande. Dépose-le dans OneDrive (commandes/%s) ou demande le .3mf.' % os.path.basename(dossier))
                    return
                for i, f in enumerate(fichiers):
                    self.rendre(f, rid=t['id'] if i == 0 else t['id'] + '-' + str(i + 1), cmd=t.get('commande'))
                return
            if t.get('type') in ('apercu', 'pdf') or (t.get('type') == '3mf' and self.pont()):
                self.lancer_production(t, c, dossier)
                return
            if t.get('type') == '3mf':
                self.produire_3mf(t, c, dossier)
                return
            self.resultat(t['id'], statut='erreur', debut=maintenant(), fin=maintenant(), message='Travail inconnu : %s' % t.get('type'))
            return

    def pont(self):
        """Georama Production avec son pont produire_hub.py (v2) : (python, script) ou None."""
        d = self.cfg.get('dossier_production') or ''
        py = os.path.join(d, '.venv', 'Scripts', 'python.exe') if os.name == 'nt' else os.path.join(d, '.venv', 'bin', 'python')
        script = os.path.join(d, 'produire_hub.py')
        return (py, script) if d and os.path.exists(py) and os.path.exists(script) else None

    def lancer_production(self, t, c, dossier):
        """Aperçu rapide, .3mf ou PDF client avec Georama Production (gamme et format choisis dans le hub)."""
        mode = t.get('type')
        noms = {'apercu': 'Aperçu rapide', '3mf': 'Production du .3mf', 'pdf': 'PDF client'}
        lien = t.get('lien') or c.get('lien') or ''
        if not lien:
            self.resultat(t['id'], type=mode, statut='erreur', commande=t.get('commande'), debut=maintenant(), fin=maintenant(),
                          message='La commande n\u2019a pas de lien de zone.')
            return
        py, script = self.pont()
        opt = t.get('options') or {}
        args = [py, script, '--mode', mode, '--lien', lien, '--numero', c.get('numero') or t.get('numero') or '',
                '--sortie', dossier, '--client', c.get('client') or '']
        if opt.get('gamme'):
            args += ['--gamme', str(opt['gamme'])]
        if opt.get('format'):
            args += ['--format', str(opt['format'])]
        self.travail_en_cours = noms.get(mode, mode) + ' de ' + (c.get('numero') or '')
        self.resultat(t['id'], type=mode, statut='en_cours', commande=t.get('commande'), debut=maintenant(),
                      message='Georama Production travaille… (' + noms.get(mode, mode).lower() + ')')
        self.signal()
        log.info('Georama Production (%s) : %s', mode, ' '.join(args[2:]))
        minutes = int(self.cfg.get('delai_3mf_minutes' if mode == '3mf' else 'delai_apercu_minutes', 360 if mode == '3mf' else 60))
        try:
            p = subprocess.run(args, capture_output=True, text=True, timeout=minutes * 60, encoding='utf-8', errors='replace',
                               cwd=os.path.dirname(script), env=dict(os.environ, PYTHONUTF8='1'),
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            res = {}
            for ligne in (p.stdout or '').splitlines():
                if ligne.startswith('##RESULTAT '):
                    try:
                        res = json.loads(ligne[len('##RESULTAT '):])
                    except ValueError:
                        pass
            if p.returncode == 0 and res.get('statut') == 'fait':
                self.resultat(t['id'], statut='fait', fin=maintenant(), fichiers=res.get('fichiers') or [], message=res.get('message') or 'Fait.')
            else:
                fin = res.get('message') or ' / '.join((p.stderr or p.stdout or '').strip().splitlines()[-3:])[:400]
                log.error('Georama Production (%s) arrêté, code %s : %s', mode, p.returncode, (p.stderr or '')[-2000:])
                self.resultat(t['id'], statut='erreur', fin=maintenant(), message='Georama Production s\u2019est arrêté. ' + fin)
        except subprocess.TimeoutExpired:
            self.resultat(t['id'], statut='erreur', fin=maintenant(), message='Trop long : arrêté après %s minutes.' % minutes)
        except Exception as e:  # noqa: BLE001
            self.resultat(t['id'], statut='erreur', fin=maintenant(), message='Lancement impossible : %s' % e)
        finally:
            self.travail_en_cours = None

    def produire_3mf(self, t, c, dossier):
        modele = self.cfg.get('commande_3mf') or ''
        lien = t.get('lien') or c.get('lien') or ''
        if not modele:
            self.resultat(t['id'], type='3mf', statut='erreur', commande=t.get('commande'), debut=maintenant(), fin=maintenant(),
                          message='Georama Production n’est pas encore branché sur l’agent (réglage « commande_3mf »). En attendant : produis le .3mf comme d’habitude et dépose-le dans le dossier de la commande, le rendu se fera tout seul.')
            return
        if not lien:
            self.resultat(t['id'], type='3mf', statut='erreur', commande=t.get('commande'), debut=maintenant(), fin=maintenant(),
                          message='La commande n’a pas de lien de zone.')
            return
        avant = set(glob.glob(os.path.join(dossier, '*.3mf')))
        cmd = modele.format(lien=lien, sortie=dossier, numero=c.get('numero', ''), gamme=c.get('gamme', ''), segment=c.get('segment', ''))
        self.travail_en_cours = '.3mf de ' + (c.get('numero') or '')
        self.resultat(t['id'], type='3mf', statut='en_cours', commande=t.get('commande'), debut=maintenant(), message='Georama Production travaille…')
        self.signal()
        log.info('Production du .3mf : %s', cmd)
        try:
            p = subprocess.run(cmd if os.name == 'nt' else shlex.split(cmd), shell=(os.name == 'nt'), capture_output=True, text=True,
                               timeout=int(self.cfg.get('delai_3mf_minutes', 360)) * 60, encoding='utf-8', errors='replace')
            nouveaux = sorted(set(glob.glob(os.path.join(dossier, '*.3mf'))) - avant)
            if p.returncode == 0 and nouveaux:
                self.resultat(t['id'], statut='fait', fin=maintenant(), fichiers=[os.path.basename(x) for x in nouveaux],
                              message='%d fichier(s) .3mf produit(s). Le rendu suit.' % len(nouveaux))
            else:
                fin = (p.stderr or p.stdout or '').strip().splitlines()[-3:]
                self.resultat(t['id'], statut='erreur', fin=maintenant(),
                              message='Georama Production s’est arrêté (code %s). %s' % (p.returncode, ' / '.join(fin)[:400]))
        except subprocess.TimeoutExpired:
            self.resultat(t['id'], statut='erreur', fin=maintenant(), message='Trop long : arrêté après %s minutes.' % self.cfg.get('delai_3mf_minutes', 360))
        except Exception as e:  # noqa: BLE001
            self.resultat(t['id'], statut='erreur', fin=maintenant(), message='Lancement impossible : %s' % e)
        finally:
            self.travail_en_cours = None

    def wix(self):
        if not (self.cfg.get('wix_cle_api') and self.cfg.get('wix_site_id')):
            return
        if time.time() - self.dernier_wix < 60 * float(self.cfg.get('wix_minutes', 10)):
            return
        self.dernier_wix = time.time()
        try:
            nouvelles = commandes_wix(self.cfg)
            ancien = lire_json(self.chemin('boite-wix.json'), {'items': []}) or {'items': []}
            connus = {x['id']: x for x in ancien.get('items', [])}
            for n in nouvelles:
                connus[n['id']] = n
            ecrire_json(self.chemin('boite-wix.json'), sorted(connus.values(), key=lambda x: x.get('date', ''))[-300:])
            log.info('Wix : %d article(s) de commande lus. %s', len(nouvelles), DIAG_WIX)
            if not DIAG_WIX.get('lues'):
                txt = 'Wix : la recherche de commandes ne renvoie rien. La clé API a sans doute besoin de la permission « Commandes » (Wix eCommerce : lire les commandes).'
                if not any(m.get('texte') == txt for m in self.messages):
                    self.messages.append({'quand': maintenant(), 'texte': txt})
        except Exception as e:  # noqa: BLE001
            self.messages.append({'quand': maintenant(), 'texte': 'Wix : %s' % e})
            log.warning('Wix : %s', e)

    def archiver_entonnoir(self, live):
        """Copie la collection Entonnoir du site dans OneDrive (Hub-Georama/entonnoir/AAAA-MM.json) ; rend tout l'historique."""
        dossier = self.chemin('entonnoir')
        os.makedirs(dossier, exist_ok=True)
        par_mois = {}
        for e in live:
            par_mois.setdefault((e.get('_createdDate') or 'inconnu')[:7], []).append(e)
        for mois, lst in par_mois.items():
            f = os.path.join(dossier, mois + '.json')
            ancien = {x.get('_id'): x for x in ((lire_json(f, {'items': []}) or {}).get('items') or [])}
            n = len(ancien)
            for e in lst:
                ancien[e.get('_id')] = e
            if len(ancien) != n or not os.path.exists(f):
                ecrire_json(f, sorted(ancien.values(), key=lambda x: x.get('_createdDate') or ''))
        tout = []
        for f in sorted(glob.glob(os.path.join(dossier, '*.json'))):
            tout += ((lire_json(f, {'items': []}) or {}).get('items') or [])
        return tout

    def vider_entonnoir(self, t):
        """Demandé dans le hub (bouton) : archive à jour, puis retire du site les entrées archivées de plus de N jours."""
        import stats
        jours = int((t.get('options') or {}).get('jours') or 7)
        self.resultat(t['id'], type='vider-entonnoir', statut='en_cours', debut=maintenant(), message='Archive du compteur…')
        try:
            live = stats.entrees_entonnoir(self.cfg)
            archive = {e.get('_id') for e in self.archiver_entonnoir(live)}
            limite = (dt.datetime.utcnow() - dt.timedelta(days=jours)).strftime('%Y-%m-%dT%H:%M:%S')
            ids = [e['_id'] for e in live if (e.get('_createdDate') or '') < limite and e.get('_id') in archive]
            faits = stats.supprimer_entonnoir(self.cfg, ids) if ids else 0
            self.resultat(t['id'], statut='fait', fin=maintenant(),
                          message='%d entrée(s) archivée(s) dans OneDrive puis retirée(s) du site ; il en reste %d.' % (faits, len(live) - faits))
            log.info('Entonnoir vidé : %d entrée(s) retirée(s) (plus de %d jours).', faits, jours)
            self.dernier_stats = 0
        except Exception as e:  # noqa: BLE001
            self.resultat(t['id'], statut='erreur', fin=maintenant(), message='Compteur non vidé : %s' % e)

    def suivi_wix(self, t, c):
        """Agent 1.6 : envoie le numéro de suivi à Wix (expédition de la commande) ; Wix avertit le client par courriel.
        Demande la permission « Gérer les commandes » de la clé API."""
        o = t.get('options') or {}
        suivi = (o.get('suivi') or c.get('suivi') or '').strip()
        wix_id = c.get('wixId') or o.get('wixId')
        transporteur = o.get('transporteur') or 'canadaPost'
        self.resultat(t['id'], type='suivi-wix', statut='en_cours', commande=t.get('commande'), debut=maintenant(), message='Envoi du suivi à Wix…')
        if not wix_id or not suivi:
            self.resultat(t['id'], statut='erreur', fin=maintenant(), message='Il manque le numéro de suivi ou le lien avec la commande Wix.')
            return
        cle = ''.join(ch for ch in str(self.cfg['wix_cle_api']) if ch.isprintable()).strip()
        entetes = {'Authorization': cle, 'wix-site-id': str(self.cfg['wix_site_id']).strip(), 'Content-Type': 'application/json'}
        try:
            req = urllib.request.Request('https://www.wixapis.com/ecom/v1/orders/%s' % wix_id, headers=entetes)
            with urllib.request.urlopen(req, timeout=60) as r:
                commande = json.loads(r.read().decode('utf-8')).get('order') or {}
            lignes = [{'id': li['id']} for li in commande.get('lineItems', []) if li.get('id')]
            corps = json.dumps({'fulfillment': {'lineItems': lignes, 'trackingInfo': {'trackingNumber': suivi, 'shippingProvider': transporteur}}}).encode()
            req = urllib.request.Request('https://www.wixapis.com/ecom/v1/fulfillments/orders/%s/create-fulfillment' % wix_id, data=corps, method='POST', headers=entetes)
            with urllib.request.urlopen(req, timeout=60) as r:
                rep = json.loads(r.read().decode('utf-8'))
            lien = ''
            for f in (rep.get('orderWithFulfillments') or {}).get('fulfillments', []):
                if (f.get('trackingInfo') or {}).get('trackingNumber') == suivi:
                    lien = (f.get('trackingInfo') or {}).get('trackingLink') or ''
            self.resultat(t['id'], statut='fait', fin=maintenant(), lienSuivi=lien,
                          message='Suivi %s envoyé à Wix (commande n° %s) : le client reçoit le courriel d\u2019expédition de Wix.' % (suivi, c.get('wixNumero') or '?'))
            log.info('Suivi %s envoyé à Wix pour %s.', suivi, c.get('numero'))
        except urllib.error.HTTPError as e:
            detail = e.read().decode('utf-8', 'replace')[:300]
            if e.code == 409:
                self.resultat(t['id'], statut='fait', fin=maintenant(), message='Ce suivi était déjà dans Wix pour cette commande.')
            elif e.code == 403:
                self.resultat(t['id'], statut='erreur', fin=maintenant(), message='Wix refuse (403) : ajouter la permission « Gérer les commandes » à la clé API du hub, puis redemander.')
            else:
                self.resultat(t['id'], statut='erreur', fin=maintenant(), message='Wix répond %s : %s' % (e.code, detail or e.reason))
        except Exception as e:  # noqa: BLE001
            self.resultat(t['id'], statut='erreur', fin=maintenant(), message='Suivi non envoyé : %s' % e)

    def synchro_production(self, cmds):
        """Ce qui est produit directement dans Georama Production (même numéro de commande) arrive dans la fiche du hub."""
        if time.time() - getattr(self, 'dernier_synchro', 0) < 60:
            return
        self.dernier_synchro = time.time()
        racine = os.path.join(self.cfg.get('dossier_production') or '', 'commandes')
        if not os.path.isdir(racine):
            return
        noms = {'apercu_plan.png': 'apercu-rapide.png', 'coupe.png': 'coupe.png', 'plan_plaques.png': 'plan-plaques.png'}
        for c in cmds:
            num = (c.get('numero') or '').strip()
            if not num:
                continue
            src = os.path.join(racine, 'georama_' + re.sub(r'[^\w\-]', '_', num))
            if not os.path.isdir(src):
                continue
            dest = self.chemin('commandes', nom_dossier(num))
            self.lire_besoins(num, src)
            try:
                os.makedirs(dest, exist_ok=True)
                deja = [os.path.getmtime(f) for f in glob.glob(os.path.join(dest, '*.3mf'))]
                for f in glob.glob(os.path.join(src, '*.3mf')):
                    t = os.path.getmtime(f)
                    if not any(d >= t - 1 for d in deja):          # pas déjà copié par le pont (même date)
                        shutil.copy2(f, os.path.join(dest, os.path.basename(f)))
                        log.info('Synchro Production : %s -> %s', os.path.basename(f), dest)
                for f in glob.glob(os.path.join(src, '*')):
                    b = os.path.basename(f)
                    cible = noms.get(b) or (b if b.lower().endswith('.pdf') and b.split('_')[0] in ('Confirmation', 'Previsualisation', 'Soumission') else None)
                    if not cible:
                        continue
                    d = os.path.join(dest, cible)
                    if not os.path.exists(d) or os.path.getmtime(f) > os.path.getmtime(d) + 1:
                        shutil.copy2(f, d)
            except OSError as e:
                log.warning('Synchro Production (%s) : %s', num, e)

    def lire_besoins(self, num, src):
        """1.7 : couleurs de filament du dernier .3mf de Georama Production (rapport.json) pour le hub,
        qui les compare au contenu de l'AMS avant de lancer une plaque."""
        f = os.path.join(src, 'rapport.json')
        try:
            if not os.path.isfile(f):
                return
            t = os.path.getmtime(f)
            deja = self.besoins.get(num)
            if deja and deja.get('t') == t:
                return
            with open(f, encoding='utf-8') as fh:
                r = json.load(fh)
            fil = r.get('filaments') or {}
            cols = sorted({str(v).upper() for v in fil.values() if v})
            noms = {}
            for piece, info in (r.get('pieces') or {}).items():
                col = str((info or {}).get('couleur') or '').upper()
                if col:
                    noms.setdefault(col, []).append(piece)
            self.besoins[num] = {'t': t, 'couleurs': cols, 'pieces': {k: v[:4] for k, v in noms.items()},
                                 'fait': dt.datetime.fromtimestamp(t).isoformat(timespec='seconds')}
        except (OSError, ValueError) as e:
            log.warning('Couleurs de %s illisibles : %s', num, e)

    def stats(self):
        """Achalandage Wix, paniers abandonnés, zones des visiteurs et pubs Meta, une fois l'heure (stats-wix.json, stats-meta.json)."""
        if time.time() - getattr(self, 'dernier_stats', 0) < 60 * float(self.cfg.get('stats_minutes', 60)):
            return
        self.dernier_stats = time.time()
        import stats
        if self.cfg.get('wix_cle_api') and self.cfg.get('wix_site_id'):
            entrees = None
            try:
                entrees = self.archiver_entonnoir(stats.entrees_entonnoir(self.cfg))
            except Exception as e:  # noqa: BLE001
                log.warning('Archive Entonnoir : %s', e)
            try:
                d = stats.stats_wix(self.cfg, entrees)
                ecrire_json(self.chemin('stats-wix.json'), [dict(d, id='wix', lu=maintenant())])
                log.info('Stats Wix : %d zone(s), erreurs : %s', len(d.get('zones') or []), d.get('erreurs') or 'aucune')
            except Exception as e:  # noqa: BLE001
                log.warning('Stats Wix : %s', e)
        if self.cfg.get('meta_jeton') and self.cfg.get('meta_compte'):
            try:
                d = stats.stats_meta(self.cfg)
                ecrire_json(self.chemin('stats-meta.json'), [dict(d, id='meta', lu=maintenant())])
                log.info('Stats Meta : %d ligne(s), erreurs : %s', len(d.get('jours') or []), d.get('erreurs') or 'aucune')
            except Exception as e:  # noqa: BLE001
                log.warning('Stats Meta : %s', e)

    def tour(self):
        self.signal()
        cmds = self.commandes()
        self.dossiers_commandes(cmds)
        self.charger_resultats()
        self.travaux(cmds)
        self.synchro_production(cmds)
        self.rendus_automatiques()
        self.wix()
        self.stats()
        self.signal()

    def ordi_officiel(self):
        """v1.7.1 : nom de l'ordi de la maison choisi dans le hub (reglages.json › ordiMaison).
        Deux agents qui écrivent agent.json en même temps créent des centaines de copies de conflit
        OneDrive et se disputent les travaux : un agent sur un autre ordi reste donc en veille."""
        r = lire_json(os.path.join(self.hub, 'reglages.json'), {}) or {}
        items = r.get('items') if isinstance(r, dict) else None
        return str(((items or [{}])[0] or {}).get('ordiMaison') or '').strip()

    def boucle(self):
        log.info('Agent Georama %s démarré. Dossier du hub : %s', VERSION, self.hub)
        en_veille = False
        while True:
            debut = time.time()
            try:
                officiel = self.ordi_officiel() if os.path.isdir(self.hub) else ''
                if not os.path.isdir(self.hub):
                    log.warning('Dossier du hub introuvable : %s (OneDrive synchronisé ? hub déjà créé ?)', self.hub)
                elif officiel and officiel.lower() != socket.gethostname().lower():
                    if not en_veille:
                        log.warning("L'ordi de la maison est %s, pas %s : l'agent reste en veille (aucun fichier écrit). "
                                    "Pour l'arrêter pour de bon : Arreter agent.bat, puis retirer son raccourci du dossier Démarrage.",
                                    officiel, socket.gethostname())
                        en_veille = True
                    time.sleep(60)
                    continue
                else:
                    en_veille = False
                    self.tour()
            except Exception:  # noqa: BLE001
                log.error('Erreur dans le tour : %s', traceback.format_exc())
            time.sleep(max(2, float(self.cfg.get('intervalle_secondes', 20)) - (time.time() - debut)))


def main():
    configurer_journal()
    cfg = lire_config()
    if '--une-fois' in sys.argv:
        Agent(cfg).tour()
        return
    if '--test-rendu' in sys.argv:
        from rendu3mf import rendre_fichier
        print(rendre_fichier(sys.argv[sys.argv.index('--test-rendu') + 1]))
        return
    Agent(cfg).boucle()


if __name__ == '__main__':
    main()
