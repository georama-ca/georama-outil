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

VERSION = '1.3'
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
    for o in donnees.get('orders', []):
        cree = o.get('createdDate', '')
        if cree[:10] < cfg.get('wix_depuis', ''):
            continue
        if o.get('status') in ('INITIALIZED',) or o.get('archived'):
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

    def signal(self):
        pont = bool(self.pont())
        capacites = {'rendu': True, '3mf': pont or bool(self.cfg.get('commande_3mf')), 'apercu': pont, 'pdf': pont,
                     'imprimantes': bool(self.imprimantes),
                     'wix': bool(self.cfg.get('wix_cle_api') and self.cfg.get('wix_site_id')),
                     'stats_wix': bool(self.cfg.get('wix_cle_api') and self.cfg.get('wix_site_id')),
                     'meta': bool(self.cfg.get('meta_jeton') and self.cfg.get('meta_compte'))}
        item = {'id': 'maison', 'nom': self.cfg.get('nom'), 'machine': socket.gethostname(), 'systeme': platform.platform(terse=True),
                'version': VERSION, 'vu': maintenant(), 'demarre': self.demarre, 'capacites': capacites,
                'travail': self.travail_en_cours, 'imprimantes': [t.instantane() for t in self.imprimantes],
                'messages': self.messages[-5:]}
        ecrire_json(self.chemin('agent.json'), [item])

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
            log.info('Wix : %d article(s) de commande lus.', len(nouvelles))
        except Exception as e:  # noqa: BLE001
            self.messages.append({'quand': maintenant(), 'texte': 'Wix : %s' % e})
            log.warning('Wix : %s', e)

    def stats(self):
        """Achalandage Wix, paniers abandonnés, zones des visiteurs et pubs Meta, une fois l'heure (stats-wix.json, stats-meta.json)."""
        if time.time() - getattr(self, 'dernier_stats', 0) < 60 * float(self.cfg.get('stats_minutes', 60)):
            return
        self.dernier_stats = time.time()
        import stats
        if self.cfg.get('wix_cle_api') and self.cfg.get('wix_site_id'):
            try:
                d = stats.stats_wix(self.cfg)
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
        self.rendus_automatiques()
        self.wix()
        self.stats()
        self.signal()

    def boucle(self):
        log.info('Agent Georama %s démarré. Dossier du hub : %s', VERSION, self.hub)
        while True:
            debut = time.time()
            try:
                if not os.path.isdir(self.hub):
                    log.warning('Dossier du hub introuvable : %s (OneDrive synchronisé ? hub déjà créé ?)', self.hub)
                else:
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
