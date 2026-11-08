# -*- coding: utf-8 -*-
"""Statistiques pour le hub (agent 1.3) : achalandage Wix, paniers abandonnés, zones choisies par
les visiteurs (collection Entonnoir du site) et pubs Meta.

Tout se lit avec les clés gardées sur ce PC (config.json) ; le hub ne reçoit que des chiffres,
dans stats-wix.json et stats-meta.json (OneDrive > Hub-Georama). Aucun nom ni courriel de visiteur.
"""
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

WIX = 'https://www.wixapis.com'
MESURES = ['TOTAL_SESSIONS', 'TOTAL_UNIQUE_VISITORS', 'TOTAL_ORDERS', 'TOTAL_SALES', 'TOTAL_FORMS_SUBMITTED', 'CLICKS_TO_CONTACT']
ORDRE_ETAPES = ['zone', '3d', 'mur', 'table', 'ajouts', 'etape3', 'couleurs', 'etape4', 'etape5-commande', 'lien', 'commander', 'panier', 'paiement', 'achat']
PERMISSIONS = {
    'achalandage': 'Site Analytics (lecture)',
    'zones': 'Wix Data : Read Data Items',
    'paniers': 'Wix eCommerce : Read Orders',
}


def _propre(s):
    return ''.join(ch for ch in str(s or '') if ch.isprintable()).strip()


def wix(cfg, methode, chemin, corps=None):
    data = json.dumps(corps).encode() if corps is not None else None
    req = urllib.request.Request(WIX + chemin, data=data, method=methode, headers={
        'Authorization': _propre(cfg.get('wix_cle_api')), 'wix-site-id': _propre(cfg.get('wix_site_id')),
        'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'replace')[:200]
        raise RuntimeError('Wix répond %s%s' % (e.code, (' : ' + detail) if detail else '')) from None


def achalandage(cfg, jours=30):
    fin = date.today() - timedelta(days=1)
    debut = fin - timedelta(days=jours - 1)
    q = [('dateRange.startDate', debut.isoformat()), ('dateRange.endDate', fin.isoformat())] + [('measurementTypes', m) for m in MESURES]
    r = wix(cfg, 'GET', '/analytics/v2/site-analytics/data?' + urllib.parse.urlencode(q))
    lignes = (r.get('data') or {}).get('data') if isinstance(r.get('data'), dict) else r.get('data')
    sortie = {}
    for m in lignes or []:
        sortie[m.get('type')] = {'total': m.get('total'), 'jours': [{'date': v.get('date'), 'valeur': v.get('value')} for v in m.get('values', [])]}
    return sortie


def paniers(cfg):
    corps = {'query': {'sort': [{'fieldName': 'createdDate', 'order': 'DESC'}], 'paging': {'limit': 50, 'offset': 0}}}
    r = wix(cfg, 'POST', '/ecom/v1/abandoned-checkout/query', corps)
    sortie = []
    for p in r.get('abandonedCheckouts') or r.get('results') or []:
        prix = (p.get('totalPrice') or p.get('subtotalPrice') or {})
        articles = []
        for li in p.get('lineItems') or []:
            nom = ((li.get('productName') or {}).get('original')) or li.get('productName') or ''
            articles.append(str(nom)[:80])
        contact = p.get('contactDetails') or {}
        sortie.append({
            'id': p.get('id'), 'date': p.get('createdDate'), 'statut': p.get('status'),
            'montant': prix.get('amount') or prix.get('convertedAmount'), 'articles': articles,
            'prenom': contact.get('firstName') or '',     # prénom seulement, pour reconnaître un client qui écrit
            'recupere': p.get('checkoutRecoveredDate') or '',
        })
    return sortie


def zones(cfg, maximum=1000):
    """Une ligne par session de visiteur qui a choisi une zone : la zone, le segment, la provenance, l'étape atteinte."""
    sessions, total, offset = {}, None, 0
    while offset < maximum:
        corps = {'dataCollectionId': 'Entonnoir',
                 'query': {'filter': {'zone': {'$ne': ''}}, 'sort': [{'fieldName': '_createdDate', 'order': 'DESC'}],
                           'paging': {'limit': 100, 'offset': offset}},
                 'returnTotalCount': offset == 0}
        r = wix(cfg, 'POST', '/wix-data/v2/items/query', corps)
        if offset == 0:
            total = (r.get('pagingMetadata') or {}).get('total')
        items = r.get('dataItems') or []
        for it in items:
            d = it.get('data') or {}
            quand = d.get('_createdDate')
            quand = quand.get('$date') if isinstance(quand, dict) else quand
            cle = d.get('session') or it.get('id')
            s = sessions.setdefault(cle, {'session': cle, 'date': quand, 'debut': quand, 'segment': d.get('segment') or '',
                                          'source': d.get('source') or '', 'campagne': d.get('campagne') or '',
                                          'contenu': d.get('contenu') or '', 'appareil': d.get('appareil') or '',
                                          'page': d.get('page') or '', 'zone': d.get('zone') or '', 'etapes': []})
            if quand and quand < (s['debut'] or quand):
                s['debut'] = quand
            e = d.get('etape') or ''
            if e and e not in s['etapes']:
                s['etapes'].append(e)
        if len(items) < 100:
            break
        offset += 100
    for s in sessions.values():
        rang = [ORDRE_ETAPES.index(e) for e in s['etapes'] if e in ORDRE_ETAPES]
        s['plus_loin'] = ORDRE_ETAPES[max(rang)] if rang else (s['etapes'][0] if s['etapes'] else 'zone')
    liste = sorted(sessions.values(), key=lambda x: x.get('date') or '', reverse=True)
    return liste, total


def entonnoir_etat(cfg):
    corps = {'dataCollectionId': 'Entonnoir', 'query': {'sort': [{'fieldName': '_createdDate', 'order': 'DESC'}], 'paging': {'limit': 1}},
             'returnTotalCount': True}
    r = wix(cfg, 'POST', '/wix-data/v2/items/query', corps)
    total = (r.get('pagingMetadata') or {}).get('total') or 0
    dernier = ((r.get('dataItems') or [{}])[0].get('data') or {}).get('_createdDate')
    dernier = dernier.get('$date') if isinstance(dernier, dict) else dernier
    return {'total': total, 'plein': total >= 4000, 'derniere_entree': dernier}


def stats_wix(cfg):
    sortie, erreurs = {'version': 1}, {}
    for nom, fn in (('achalandage', lambda: achalandage(cfg)), ('paniers', lambda: paniers(cfg)), ('entonnoir', lambda: entonnoir_etat(cfg))):
        try:
            sortie[nom] = fn()
        except Exception as e:  # noqa: BLE001
            erreurs[nom] = _message(e, PERMISSIONS.get(nom, PERMISSIONS['zones']))
    try:
        sortie['zones'], sortie['zones_total_entrees'] = zones(cfg)
    except Exception as e:  # noqa: BLE001
        erreurs['zones'] = _message(e, PERMISSIONS['zones'])
    sortie['erreurs'] = erreurs
    return sortie


def _message(e, permission):
    t = str(e)
    if ' 403' in t or ' 401' in t or 'PERMISSION' in t.upper():
        return 'La clé API Wix n’a pas la permission « %s ». À ajouter dans manage.wix.com > Clés API (le jeton ne change pas).' % permission
    return t[:300]


# ---------------------------------------------------------------- Meta (pubs)
def meta(cfg, chemin, **params):
    params['access_token'] = _propre(cfg.get('meta_jeton'))
    url = 'https://graph.facebook.com/' + chemin.lstrip('/') + '?' + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode('utf-8', 'replace')).get('error', {}).get('message', '')
        except ValueError:
            msg = ''
        raise RuntimeError('Meta répond %s%s' % (e.code, (' : ' + msg[:200]) if msg else '')) from None


def _toutes(cfg, chemin, **params):
    r = meta(cfg, chemin, **params)
    lignes = list(r.get('data') or [])
    for _ in range(20):
        suivant = (r.get('paging') or {}).get('next')
        if not suivant:
            break
        with urllib.request.urlopen(suivant, timeout=60) as f:
            r = json.loads(f.read().decode('utf-8'))
        lignes += r.get('data') or []
    return lignes


def stats_meta(cfg, jours=30):
    compte = _propre(cfg.get('meta_compte'))
    if compte and not compte.startswith('act_'):
        compte = 'act_' + compte
    sortie = {'version': 1, 'compte': compte, 'erreurs': {}}
    try:
        sortie['campagnes'] = [{
            'id': c.get('id'), 'nom': c.get('name'), 'statut': c.get('effective_status') or c.get('status'),
            'budget_jour': (float(c['daily_budget']) / 100) if c.get('daily_budget') else None,
            'budget_total': (float(c['lifetime_budget']) / 100) if c.get('lifetime_budget') else None,
            'debut': c.get('start_time'), 'fin': c.get('stop_time')}
            for c in _toutes(cfg, compte + '/campaigns', fields='id,name,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time', limit=100)]
    except Exception as e:  # noqa: BLE001
        sortie['erreurs']['campagnes'] = str(e)[:300]
    try:
        fin = date.today()
        debut = fin - timedelta(days=jours - 1)
        lignes = _toutes(cfg, compte + '/insights', level='campaign', time_increment=1, limit=500,
                         time_range=json.dumps({'since': debut.isoformat(), 'until': fin.isoformat()}),
                         fields='campaign_id,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,actions,date_start')
        jours_l = []
        for l in lignes:
            actions = {a.get('action_type'): float(a.get('value') or 0) for a in l.get('actions') or []}
            jours_l.append({'date': l.get('date_start'), 'campagne': l.get('campaign_id'), 'nom': l.get('campaign_name'),
                            'depense': float(l.get('spend') or 0), 'impressions': int(l.get('impressions') or 0),
                            'portee': int(l.get('reach') or 0), 'clics': int(l.get('clicks') or 0),
                            'clics_lien': int(l.get('inline_link_clicks') or 0),
                            'vues_page': actions.get('landing_page_view', 0),
                            'conversions': sum(v for k, v in actions.items() if k.startswith('offsite_conversion'))})
        sortie['jours'] = jours_l
    except Exception as e:  # noqa: BLE001
        sortie['erreurs']['statistiques'] = str(e)[:300]
    return sortie
