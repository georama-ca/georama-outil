# -*- coding: utf-8 -*-
"""Rendu 3D d'aperçu d'un fichier .3mf (maquette Georama) en image PNG.

Aucun logiciel 3D requis : lecture du .3mf (zip + XML), projection en vue
plongeante, z-buffer et ombrage simple avec numpy. Les couleurs viennent du
fichier (filaments Bambu Studio, matériaux 3MF) ou, à défaut, du nom des pièces.

Utilisation :  python rendu3mf.py maquette.3mf [sortie.png]
"""
import json
import math
import os
import re
import struct
import sys
import zipfile
import zlib
import xml.etree.ElementTree as ET

import numpy as np

NS_CORE = '{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}'
NS_PROD = '{http://schemas.microsoft.com/3dmanufacturing/production/2015/06}'

FOND_HAUT = np.array([0x35, 0x3B, 0x36], float)
FOND_BAS = np.array([0x1E, 0x22, 0x1F], float)

# Couleurs des filaments Georama (PETG Basic), utilisées quand le fichier n'en donne pas
MOTS_COULEURS = [
    (('eau', 'lac', 'riviere', 'rivière', 'water', 'bathy'), '#0086D6'),
    (('haut-fond', 'hautfond'), '#8CC8EC'),
    (('fosse', 'profond'), '#001489'),
    (('foret', 'forêt', 'arbre', 'tree', 'resineux', 'résineux'), '#034638'),
    (('feuillu', 'parc'), '#009639'),
    (('erabl', 'érabl'), '#D6001C'),
    (('lot', 'trace', 'tracé', 'gpx', 'repere', 'repère', 'chemin', 'route'), '#FF671F'),
    (('batiment', 'bâtiment', 'building', 'beton', 'béton'), '#7F7E83'),
    (('humide', 'marais'), '#4F2C1D'),
    (('socle', 'base', 'fond'), '#000000'),
    (('texte', 'logo', 'piste'), '#FFFFFF'),
    (('terrain', 'sol', 'relief', 'terre'), '#DBC8B6'),
]
PALETTE_SECOURS = ['#DBC8B6', '#009639', '#0086D6', '#FF671F', '#7F7E83', '#034638', '#8CC8EC', '#4F2C1D', '#FFFFFF']


def hex_rgb(h):
    h = (h or '').strip().lstrip('#')
    if len(h) >= 6:
        try:
            return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], float)
        except ValueError:
            pass
    return None


def couleur_par_nom(nom, i):
    n = (nom or '').lower()
    for mots, c in MOTS_COULEURS:
        if any(m in n for m in mots):
            return hex_rgb(c)
    return hex_rgb(PALETTE_SECOURS[i % len(PALETTE_SECOURS)])


def matrice(txt):
    """Transformation 3MF (12 nombres) -> matrice 4x4 pour vecteurs ligne."""
    m = np.eye(4)
    if txt:
        v = [float(x) for x in txt.split()]
        if len(v) == 12:
            m[0, :3] = v[0:3]
            m[1, :3] = v[3:6]
            m[2, :3] = v[6:9]
            m[3, :3] = v[9:12]
    return m


RE_OBJ = re.compile(r'<object\b([^>]*)>(.*?)</object>', re.S)
RE_ATTR = re.compile(r'([\w:]+)="([^"]*)"')
RE_VERT = re.compile(r'<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"')
RE_TRI = re.compile(r'<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"')
RE_COMP = re.compile(r'<component\b([^>]*)/?>')


def lire_modele(texte):
    """Retourne {id: objet} pour un fichier .model."""
    objets = {}
    for attrs, corps in RE_OBJ.findall(texte):
        a = dict(RE_ATTR.findall(attrs))
        oid = a.get('id')
        o = {'nom': a.get('name', ''), 'pid': a.get('pid'), 'pindex': a.get('pindex'), 'mesh': None, 'composants': []}
        if '<mesh' in corps:
            v = RE_VERT.findall(corps)
            t = RE_TRI.findall(corps)
            if v and t:
                o['mesh'] = (np.array(v, dtype=float), np.array(t, dtype=np.int64))
            else:  # format inhabituel : lecture XML complète
                el = ET.fromstring('<object xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' + corps + '</object>')
                vv = [(float(x.get('x')), float(x.get('y')), float(x.get('z'))) for x in el.iter(NS_CORE + 'vertex')]
                tt = [(int(x.get('v1')), int(x.get('v2')), int(x.get('v3'))) for x in el.iter(NS_CORE + 'triangle')]
                if vv and tt:
                    o['mesh'] = (np.array(vv, float), np.array(tt, np.int64))
        for c in RE_COMP.findall(corps):
            ca = dict(RE_ATTR.findall(c))
            chemin = ca.get('p:path') or ca.get('path')
            o['composants'].append((chemin, ca.get('objectid'), matrice(ca.get('transform'))))
        objets[oid] = o
    return objets


def lire_3mf(chemin):
    z = zipfile.ZipFile(chemin)
    noms = z.namelist()
    principal = next((n for n in noms if n.lower() == '3d/3dmodel.model'), None)
    if not principal:
        principal = next((n for n in noms if n.lower().endswith('.model')), None)
    if not principal:
        raise ValueError('Aucun modèle 3D dans ce fichier.')
    modeles = {}
    for n in noms:
        if n.lower().endswith('.model'):
            modeles['/' + n] = lire_modele(z.read(n).decode('utf-8', 'replace'))
    texte = z.read(principal).decode('utf-8', 'replace')

    # Matériaux 3MF (basematerials) : displaycolor
    materiaux = {}
    for m in re.finditer(r'<basematerials\b[^>]*id="(\d+)"[^>]*>(.*?)</basematerials>', texte, re.S):
        materiaux[m.group(1)] = [c for c in re.findall(r'displaycolor="([^"]+)"', m.group(2))]
    for m in re.finditer(r'<m:colorgroup\b[^>]*id="(\d+)"[^>]*>(.*?)</m:colorgroup>', texte, re.S):
        materiaux[m.group(1)] = [c for c in re.findall(r'color="([^"]+)"', m.group(2))]

    # Bambu Studio : filament de chaque objet / pièce + couleurs des filaments
    filaments = []
    extrudeur_obj, extrudeur_piece = {}, {}
    if 'Metadata/project_settings.config' in noms:
        try:
            ps = json.loads(z.read('Metadata/project_settings.config').decode('utf-8', 'replace'))
            filaments = ps.get('filament_colour') or []
        except (ValueError, KeyError):
            pass
    if 'Metadata/model_settings.config' in noms:
        try:
            ms = ET.fromstring(z.read('Metadata/model_settings.config'))
            for ob in ms.iter('object'):
                oid = ob.get('id')
                for md in ob.findall('metadata'):
                    if md.get('key') == 'extruder':
                        extrudeur_obj[oid] = int(md.get('value') or 1)
                for pa in ob.iter('part'):
                    for md in pa.findall('metadata'):
                        if md.get('key') == 'extruder':
                            extrudeur_piece[(oid, pa.get('id'))] = int(md.get('value') or 1)
        except ET.ParseError:
            pass

    build = []
    for item in re.finditer(r'<item\b([^>]*)/?>', texte):
        a = dict(RE_ATTR.findall(item.group(1)))
        build.append((a.get('objectid'), matrice(a.get('transform'))))
    if not build:
        build = [(oid, np.eye(4)) for oid in modeles['/' + principal]]

    pieces = []  # (sommets monde, triangles, couleur rgb, nom)
    compteur = [0]

    def couleur(o, oid_haut, oid_piece):
        e = extrudeur_piece.get((oid_haut, oid_piece)) or extrudeur_obj.get(oid_haut)
        if e and filaments and 0 < e <= len(filaments):
            c = hex_rgb(filaments[e - 1])
            if c is not None:
                return c
        if o.get('pid') in materiaux and o.get('pindex') is not None:
            liste = materiaux[o['pid']]
            i = int(o['pindex'])
            if 0 <= i < len(liste):
                c = hex_rgb(liste[i])
                if c is not None:
                    return c
        compteur[0] += 1
        return couleur_par_nom(o.get('nom'), compteur[0])

    def visiter(chemin_modele, oid, m, oid_haut, profondeur=0):
        objets = modeles.get(chemin_modele) or {}
        o = objets.get(oid)
        if o is None or profondeur > 8:
            return
        if o['mesh'] is not None:
            v, t = o['mesh']
            vh = np.c_[v, np.ones(len(v))] @ m
            pieces.append((vh[:, :3], t, couleur(o, oid_haut, oid if profondeur else None), o.get('nom')))
        for chemin, cid, cm in o['composants']:
            visiter(chemin or chemin_modele, cid, cm @ m, oid_haut, profondeur + 1)

    for oid, m in build:
        visiter('/' + principal, oid, m, oid)
    if not pieces:
        raise ValueError('Le fichier ne contient aucune surface.')
    return pieces


def rendre(pieces, largeur=1600, hauteur=1200, azimut=-28.0, elevation=38.0, sur=2):
    """Image RGB (uint8) de la maquette en vue plongeante."""
    W, H = largeur * sur, hauteur * sur
    tous = np.vstack([p[0] for p in pieces])
    centre = (tous.min(0) + tous.max(0)) / 2.0
    az, el = math.radians(azimut), math.radians(elevation)
    # Caméra orthographique placée au sud, qui regarde vers le nord et vers le bas.
    # Lignes : droite de l'écran, haut de l'écran, profondeur (plus grand = plus loin).
    rz = np.array([[math.cos(az), -math.sin(az), 0], [math.sin(az), math.cos(az), 0], [0, 0, 1]])
    rx = np.array([[1, 0, 0], [0, math.sin(el), math.cos(el)], [0, math.cos(el), -math.sin(el)]])
    r = rx @ rz
    p = (tous - centre) @ r.T
    xmin, xmax, ymin, ymax = p[:, 0].min(), p[:, 0].max(), p[:, 1].min(), p[:, 1].max()
    echelle = 0.86 * min(W / max(1e-6, xmax - xmin), H / max(1e-6, ymax - ymin))
    ox, oy = W / 2 - echelle * (xmin + xmax) / 2, H / 2 + echelle * (ymin + ymax) / 2

    img = np.zeros((H, W, 3), float)
    t = np.linspace(0, 1, H)[:, None]
    img[:] = (FOND_HAUT * (1 - t) + FOND_BAS * t)[:, None, :]
    zbuf = np.full((H, W), np.inf)
    lum = np.array([-0.35, -0.55, 0.75])
    lum /= np.linalg.norm(lum)

    for v, tri, rgb, _nom in pieces:
        if len(tri) == 0:
            continue
        a, b, c = v[tri[:, 0]], v[tri[:, 1]], v[tri[:, 2]]
        n = np.cross(b - a, c - a)
        ln = np.linalg.norm(n, axis=1)
        ok = ln > 1e-12
        a, b, c, n, ln = a[ok], b[ok], c[ok], n[ok], ln[ok]
        n = n / ln[:, None]
        # Ombrage : face éclairée des deux côtés (normales parfois inversées)
        d = np.abs(n @ lum)
        haut = np.clip(n[:, 2], -1, 1)
        intensite = 0.38 + 0.62 * d * (0.75 + 0.25 * np.abs(haut))
        col = np.clip(rgb[None, :] * intensite[:, None], 0, 255)

        def ecran(q):
            s = (q - centre) @ r.T
            return np.c_[ox + echelle * s[:, 0], oy - echelle * s[:, 1], s[:, 2]]
        A, B, C = ecran(a), ecran(b), ecran(c)
        mins = np.minimum(np.minimum(A, B), C)
        maxs = np.maximum(np.maximum(A, B), C)
        taille = np.maximum(maxs[:, 0] - mins[:, 0], maxs[:, 1] - mins[:, 1])
        petit = taille < 2.5

        # Petits triangles : un point par sommet et au centre, le plus proche gagne
        if petit.any():
            pts = np.vstack([A[petit], B[petit], C[petit], (A[petit] + B[petit] + C[petit]) / 3])
            cc = np.vstack([col[petit]] * 4)
            xs = np.round(pts[:, 0]).astype(np.int64)
            ys = np.round(pts[:, 1]).astype(np.int64)
            dz = pts[:, 2]
            dedans = (xs >= 0) & (xs < W) & (ys >= 0) & (ys < H)
            xs, ys, dz, cc = xs[dedans], ys[dedans], dz[dedans], cc[dedans]
            lin = ys * W + xs
            ordre = np.lexsort((-dz, lin))  # par pixel, du plus loin au plus proche
            lin, dz, cc = lin[ordre], dz[ordre], cc[ordre]
            dernier = np.r_[lin[1:] != lin[:-1], True]
            lin, dz, cc = lin[dernier], dz[dernier], cc[dernier]
            zf = zbuf.reshape(-1)
            devant = dz < zf[lin]
            zf[lin[devant]] = dz[devant]
            img.reshape(-1, 3)[lin[devant]] = cc[devant]

        # Grands triangles : remplissage par coordonnées barycentriques
        for i in np.nonzero(~petit)[0]:
            x0, y0 = int(max(0, math.floor(mins[i, 0]))), int(max(0, math.floor(mins[i, 1])))
            x1, y1 = int(min(W - 1, math.ceil(maxs[i, 0]))), int(min(H - 1, math.ceil(maxs[i, 1])))
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            (ax, ay, az_), (bx, by, bz), (cx, cy, cz) = A[i], B[i], C[i]
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-9:
                continue
            w1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den
            w2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / den
            w3 = 1 - w1 - w2
            m = (w1 >= -1e-6) & (w2 >= -1e-6) & (w3 >= -1e-6)
            if not m.any():
                continue
            z = w1 * az_ + w2 * bz + w3 * cz
            zb = zbuf[y0:y1 + 1, x0:x1 + 1]
            m &= z < zb
            zb[m] = z[m]
            img[y0:y1 + 1, x0:x1 + 1][m] = col[i]

    # Contour doux : assombrir les bords de profondeur (lisibilité du relief)
    zf = np.where(np.isinf(zbuf), np.nan, zbuf)
    if np.isfinite(zf).any():
        dzx = np.abs(np.diff(np.nan_to_num(zf, nan=1e9), axis=1, prepend=0))
        dzy = np.abs(np.diff(np.nan_to_num(zf, nan=1e9), axis=0, prepend=0))
        seuil = 1.5  # mm de saut de profondeur entre deux pixels voisins
        bord = (np.maximum(dzx, dzy) > seuil) & np.isfinite(zf)
        img[bord] *= 0.72
    # Anticrénelage : moyenne des blocs sur x sur
    img = img.reshape(hauteur, sur, largeur, sur, 3).mean(axis=(1, 3))
    return np.clip(img, 0, 255).astype(np.uint8)


def ecrire_png(chemin, img):
    h, w, _ = img.shape
    brut = b''.join(b'\x00' + img[y].tobytes() for y in range(h))

    def bloc(type_, data):
        c = struct.pack('>I', len(data)) + type_ + data
        return c + struct.pack('>I', zlib.crc32(type_ + data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + bloc(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    png += bloc(b'IDAT', zlib.compress(brut, 6)) + bloc(b'IEND', b'')
    tmp = chemin + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(png)
    os.replace(tmp, chemin)


def rendre_fichier(source, sortie=None, largeur=1600, hauteur=1200):
    pieces = lire_3mf(source)
    img = rendre(pieces, largeur, hauteur)
    sortie = sortie or os.path.splitext(source)[0] + '-rendu.png'
    ecrire_png(sortie, img)
    nb = sum(len(p[1]) for p in pieces)
    return {'fichier': os.path.basename(sortie), 'pieces': len(pieces), 'triangles': int(nb)}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    print(rendre_fichier(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None))
