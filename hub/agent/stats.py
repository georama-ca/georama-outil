# -*- coding: utf-8 -*-
"""Statistiques pour le hub (agent 1.4) : achalandage Wix, paniers abandonnés, zones choisies par
les visiteurs (collection Entonnoir du site), demandes reçues par les formulaires, infolettres,
codes promo, recherche Google (Search Console) et pubs Meta.

Tout se lit avec les clés gardées sur ce PC (config.json) ; le hub reçoit stats-wix.json et
stats-meta.json (OneDrive > Hub-Georama, dossier privé de Georama). Les visiteurs anonymes restent
anonymes ; seules les personnes qui ont rempli un formulaire du site apparaissent par leur nom.
"""
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

WIX = 'https://www.wixapis.com'
MESURES = ['TOTAL_SESSIONS', 'TOTAL_UNIQUE_VISITORS', 'TOTAL_ORDERS', 'TOTAL_SALES', 'TOTAL_FORMS_SUBMITTED', 'CLICKS_TO_CONTACT']
ORDRE_ETAPES = ['zone', '3d', 'mur', 'table', 'ajouts', 'etape3', 'couleurs', 'etape4', 'etape5-commande', 'lien', 'commander', 'panier', 'paiement', 'achat']
PERMISSIONS = {                     # noms affichés dans manage.wix.com > Clés API
    'achalandage': 'Wix Données analytiques',
    'zones': 'Wix Data',
    'entonnoir': 'Wix Data',
    'paniers': 'Wix E-commerce',
    'formulaires': 'Wix Formulaires',
    'infolettres': 'Gérer les E-mails marketing',
    'coupons': 'Boutique Wix',
    'recherche': 'SEO',
}
FORMULAIRES_INFOLETTRE = ('infolettre', 'subscribe', 'newsletter')


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


def _quand(d):
    q = d.get('_createdDate')
    return q.get('$date') if isinstance(q, dict) else (q or '')


def entrees_entonnoir(cfg, maximum=6000):
    """Toutes les entrées de la collection Entonnoir du site (pour l'archive dans OneDrive)."""
    sortie, offset = [], 0
    while offset < maximum:
        corps = {'dataCollectionId': 'Entonnoir',
                 'query': {'sort': [{'fieldName': '_createdDate', 'order': 'ASC'}], 'paging': {'limit': 100, 'offset': offset}}}
        items = wix(cfg, 'POST', '/wix-data/v2/items/query', corps).get('dataItems') or []
        for it in items:
            d = dict(it.get('data') or {})
            d['_id'] = d.get('_id') or it.get('id')
            d['_createdDate'] = _quand(d)
            d.pop('_updatedDate', None)
            d.pop('_owner', None)
            sortie.append(d)
        if len(items) < 100:
            break
        offset += 100
    return sortie


def supprimer_entonnoir(cfg, ids):
    """Supprime des entrées de la collection Entonnoir (déjà archivées). Irréversible côté Wix."""
    faits = 0
    for i in range(0, len(ids), 500):
        r = wix(cfg, 'POST', '/wix-data/v2/bulk/items/remove', {'dataCollectionId': 'Entonnoir', 'dataItemIds': ids[i:i + 500]})
        faits += ((r.get('bulkActionMetadata') or {}).get('totalSuccesses') or 0)
    return faits


def zones(entrees):
    """Une ligne par session de visiteur qui a choisi une zone : la zone, le segment, la provenance, l'étape atteinte."""
    sessions = {}
    for d in sorted((e for e in entrees if e.get('session') or e.get('zone')), key=lambda e: e.get('_createdDate') or '', reverse=True):
        quand = d.get('_createdDate') or ''
        cle = d.get('session') or d.get('_id')
        s = sessions.setdefault(cle, {'session': cle, 'date': quand, 'debut': quand, 'segment': d.get('segment') or '',
                                      'source': d.get('source') or '', 'campagne': d.get('campagne') or '',
                                      'contenu': d.get('contenu') or '', 'appareil': d.get('appareil') or '',
                                      'page': d.get('page') or '', 'zone': d.get('zone') or '', 'etapes': []})
        if quand and quand < (s['debut'] or quand):
            s['debut'] = quand
        if not s['zone'] and d.get('zone'):         # la zone n'est notée qu'aux étapes après le choix (3D, mur…)
            s['zone'] = d.get('zone')
        for k in ('segment', 'source', 'campagne', 'contenu', 'appareil'):
            if not s[k] and d.get(k):
                s[k] = d.get(k)
        e = d.get('etape') or ''
        if e and e not in s['etapes']:
            s['etapes'].append(e)
    gardees = []
    for s in sessions.values():
        rang = [ORDRE_ETAPES.index(e) for e in s['etapes'] if e in ORDRE_ETAPES]
        if not rang:            # seulement « lieu » : le visiteur n'a pas encore choisi sa zone
            continue
        s['plus_loin'] = ORDRE_ETAPES[max(rang)]
        gardees.append(s)
    return sorted(gardees, key=lambda x: x.get('date') or '', reverse=True)


def entonnoir_etat(cfg):
    corps = {'dataCollectionId': 'Entonnoir', 'query': {'sort': [{'fieldName': '_createdDate', 'order': 'DESC'}], 'paging': {'limit': 1}},
             'returnTotalCount': True}
    r = wix(cfg, 'POST', '/wix-data/v2/items/query', corps)
    total = (r.get('pagingMetadata') or {}).get('total') or 0
    dernier = ((r.get('dataItems') or [{}])[0].get('data') or {}).get('_createdDate')
    dernier = dernier.get('$date') if isinstance(dernier, dict) else dernier
    return {'total': total, 'plein': total >= 4000, 'derniere_entree': dernier}


def _texte(label):
    """Libellé d'un champ de formulaire : texte simple ou texte riche (Ricos)."""
    if isinstance(label, str):
        return label
    morceaux = []

    def tour(n):
        if isinstance(n, dict):
            t = (n.get('textData') or {}).get('text')
            if t:
                morceaux.append(t)
            for x in n.get('nodes') or []:
                tour(x)
    tour(label or {})
    return ' '.join(morceaux)[:120]


def _valeur(v):
    if isinstance(v, bool):
        return 'oui' if v else 'non'
    if isinstance(v, list):
        return ', '.join(_valeur(x) for x in v)
    if isinstance(v, dict):
        return ', '.join('%s' % x for x in v.values() if isinstance(x, (str, int, float)))
    return str(v if v is not None else '')


def formulaires(cfg):
    r = wix(cfg, 'GET', '/form-schema-service/v4/forms?namespace=wix.form_app.form')
    noms, libelles = {}, {}
    for f in r.get('forms') or []:
        noms[f.get('id')] = f.get('name') or 'Formulaire'
        for ch in f.get('fields') or []:
            if ch.get('target'):
                libelles[(f.get('id'), ch['target'])] = _texte(ch.get('label') or (ch.get('view') or {}).get('label'))
    corps = {'query': {'filter': {'namespace': 'wix.form_app.form'}, 'sort': [{'fieldName': 'createdDate', 'order': 'DESC'}],
                       'cursorPaging': {'limit': 100}}}
    r = wix(cfg, 'POST', '/form-submission-service/v4/submissions/namespace/query', corps)
    sortie = []
    for s in r.get('submissions') or []:
        fid = s.get('formId')
        nom_f = noms.get(fid, 'Formulaire')
        champs = s.get('submissions') or {}
        lignes = [{'cle': k, 'libelle': libelles.get((fid, k)) or k, 'valeur': _valeur(v)} for k, v in champs.items()]

        def trouve(*mots):
            return next((l['valeur'] for l in lignes if any(m in (l['cle'] + ' ' + l['libelle']).lower() for m in mots) and l['valeur']), '')
        sortie.append({
            'id': s.get('id'), 'formulaire': nom_f, 'formId': fid, 'date': s.get('createdDate'), 'statut': s.get('status'),
            'infolettre': any(m in nom_f.lower() for m in FORMULAIRES_INFOLETTRE),
            'nom': trouve('nom', 'name'), 'courriel': trouve('courriel', 'email'), 'telephone': trouve('phone', 'téléphone', 'telephone'),
            'lieu': trouve('lieu', 'address', 'adresse'), 'message': trouve('message', 'particularit', 'long_answer'),
            'champs': lignes[:12],
        })
    return sortie


def infolettres(cfg):
    r = wix(cfg, 'GET', '/email-marketing/v1/campaigns?visibilityStatuses=PUBLISHED&paging.limit=20&paging.offset=0')
    camps = r.get('campaigns') or []
    stats = {}
    ids = [c.get('campaignId') for c in camps if c.get('campaignId')]
    if ids:
        q = urllib.parse.urlencode([('campaignIds', i) for i in ids])
        for st in wix(cfg, 'GET', '/email-marketing/v1/campaigns/statistics?' + q).get('statistics') or []:
            stats[st.get('campaignId')] = st.get('email') or {}
    return [{'id': c.get('campaignId'), 'titre': c.get('title') or c.get('emailSubject'), 'sujet': c.get('emailSubject'),
             'statut': c.get('status'), 'date': (c.get('publishingData') or {}).get('datePublished') or c.get('dateUpdated'),
             'stats': stats.get(c.get('campaignId'), {})} for c in camps]


def coupons(cfg):
    r = wix(cfg, 'POST', '/stores/v2/coupons/query', {'query': {'sort': '[{"dateCreated": "desc"}]'}})
    sortie = []
    for c in r.get('coupons') or []:
        sp = c.get('specification') or {}
        rabais = ('%s %%' % sp['percentOffRate']) if sp.get('percentOffRate') else ('%s $' % sp['moneyOffAmount']) if sp.get('moneyOffAmount') else ''
        fin = sp.get('expirationTime')
        sortie.append({'id': c.get('id'), 'nom': sp.get('name'), 'code': sp.get('code'), 'rabais': rabais, 'actif': sp.get('active'),
                       'utilisations': c.get('numberOfUsages') or 0, 'limite': sp.get('usageLimit'),
                       'fin': date.fromtimestamp(int(fin) / 1000).isoformat() if str(fin or '').isdigit() else ''})
    return sortie


def recherche(cfg, jours=30):
    fin = date.today() - timedelta(days=2)          # Search Console a 2 ou 3 jours de retard
    debut = fin - timedelta(days=jours - 1)
    base = {'startDate': debut.isoformat(), 'endDate': fin.isoformat()}

    def appel(dim, n):
        q = urllib.parse.urlencode(dict(base, dimensions=dim, rowLimit=n))
        return [{'cle': (x.get('keys') or [''])[0], 'clics': x.get('clicks') or 0, 'impressions': x.get('impressions') or 0,
                 'position': round(x.get('position') or 0, 1)} for x in wix(cfg, 'GET', '/gsc/v1/search-analytics?' + q).get('results') or []]
    return {'debut': base['startDate'], 'fin': base['endDate'], 'jours': appel('date', 60), 'requetes': appel('query', 15), 'pages': appel('page', 8)}


def stats_wix(cfg, entrees=None):
    sortie, erreurs = {'version': 2}, {}
    for nom, fn in (('achalandage', lambda: achalandage(cfg)), ('paniers', lambda: paniers(cfg)), ('entonnoir', lambda: entonnoir_etat(cfg)),
                    ('formulaires', lambda: formulaires(cfg)), ('infolettres', lambda: infolettres(cfg)),
                    ('coupons', lambda: coupons(cfg)), ('recherche', lambda: recherche(cfg))):
        try:
            sortie[nom] = fn()
        except Exception as e:  # noqa: BLE001
            erreurs[nom] = _message(e, PERMISSIONS.get(nom, nom))
    try:
        if entrees is None:
            entrees = entrees_entonnoir(cfg)
        sortie['zones'] = zones(entrees)
        sortie['zones_total_entrees'] = len(entrees)
    except Exception as e:  # noqa: BLE001
        erreurs['zones'] = _message(e, PERMISSIONS['zones'])
    sortie['erreurs'] = erreurs
    return sortie


def _message(e, permission):
    t = str(e)
    if ' 403' in t or ' 401' in t or 'PERMISSION' in t.upper():
        return 'La clé API Wix n’a pas la permission « %s ». À cocher dans manage.wix.com > Paramètres du compte > Clés API (le jeton ne change pas).' % permission
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
