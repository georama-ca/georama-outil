"""Pont entre l'agent du Hub Georama et Georama Production (v2, 8 nov. 2026).

Lancé par l'agent quand on clique un bouton Georama Production dans la fiche d'une commande du hub.

    python produire_hub.py --mode apercu|3mf|pdf --lien URL --numero G-2026-001 --sortie DOSSIER_DU_HUB
                           [--client "Nom"] [--gamme boreal|sapiniere|arctique|terre|unie]
                           [--format base|gf4|gf6]

  apercu : calcul rapide (comme « Aperçu rapide ») -> apercu-rapide.png, coupe.png, plan-plaques.png
  3mf    : production complète (comme Produire.bat) -> georama_<numéro>_<AAAAMMJJ-HHMM>.3mf (+ images)
  pdf    : PDF client à partir du dernier calcul (fait un aperçu rapide d'abord s'il n'y en a pas)

Ancienne forme gardée (agent 1.1) : python produire_hub.py <lien> <numero> <dossier_sortie>  (= mode 3mf)

Le calcul se fait dans commandes\\georama_<numéro> comme dans l'interface (parametres.json compris),
donc la commande s'ouvre aussi dans « Mes commandes » de Georama Production. Rien n'est changé
dans Georama Production lui-même.
La dernière ligne affichée commence par « ##RESULTAT » (JSON) : l'agent la lit.
"""
import argparse
import base64
import glob
import json
import os
import re
import shutil
import sys
import time
import traceback
from datetime import datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
for flux in (sys.stdout, sys.stderr):
    try:
        flux.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass

FORMATS = {"gf4": "508x609.6", "gf6": "609.6x762"}          # 20 × 24 po (4 plaques), 24 × 30 po (6 plaques)
GAMMES = {"boreal", "sapiniere", "arctique", "terre", "unie"}
IMAGES = {"apercu_plan.png": "apercu-rapide.png", "coupe.png": "coupe.png", "plan_plaques.png": "plan-plaques.png"}


def resultat(**d):
    print("##RESULTAT " + json.dumps(d, ensure_ascii=False), flush=True)


def ajuster_lien(lien, gamme="", fmt=""):
    """Change la gamme (g) et le format (fm) dans le lien du client, sans toucher au reste."""
    if gamme not in GAMMES and fmt not in ("base", *FORMATS):
        return lien.strip()
    u = urlparse(lien.strip())
    q = [(k, v) for k, v in parse_qsl(u.query, keep_blank_values=True)]
    if gamme in GAMMES:
        q = [(k, v) for k, v in q if k != "g"] + [("g", gamme)]
    if fmt == "base":
        q = [(k, v) for k, v in q if k != "fm"]
    elif fmt in FORMATS:
        q = [(k, v) for k, v in q if k != "fm"] + [("fm", FORMATS[fmt])]
    return urlunparse(u._replace(query=urlencode(q, safe=",;!:")))


def ident(numero, lien):
    if numero:
        return re.sub(r"[^\w\-]", "_", numero.strip())
    import hashlib
    return "zone-" + hashlib.sha1(lien.strip().encode()).hexdigest()[:8]


def dict_lien(lien):
    from georama_prod import lien as lien_mod
    cmd = lien_mod.lire_lien(lien)
    return {
        "profil": cmd.profil, "gamme": cmd.gamme, "lat": cmd.lat, "lon": cmd.lon, "largeur_km": cmd.largeur_km,
        "rotation": cmd.rotation, "couches": sorted(cmd.couches), "ville": sorted(cmd.ville), "lots": cmd.lots,
        "postes": [{"t": t, "lat": la, "lon": lo} for t, la, lo in cmd.postes],
        "traces": len(cmd.traces), "trace_points": [[list(p) for p in tr] for tr in cmd.traces][:20],
        "cadre": cmd.cadre, "numero": cmd.numero,
        "format_mm": list(cmd.format_mm) if cmd.format_mm else None, "lots_exclus": [], "plaques": {},
        "objets_exclus": [], "types_exclus": [],
    }


def calculer(lien, numero, dossier, mode, client):
    from georama_prod import principal
    os.makedirs(dossier, exist_ok=True)
    par = {"lien": lien, "numero": numero, "mode": mode, "source": "hub", "date": datetime.now().isoformat(timespec="seconds")}
    if client:
        par["commande"] = {"client": client}
    with open(os.path.join(dossier, "parametres.json"), "w", encoding="utf-8") as f:
        json.dump(par, f, indent=2, ensure_ascii=False)
    return principal.produire(lien, numero, dossier, mode=mode)


def copier_images(dossier, sortie, depuis):
    faits = []
    for src, dst in IMAGES.items():
        f = os.path.join(dossier, src)
        if os.path.exists(f) and os.path.getmtime(f) >= depuis:
            shutil.copy2(f, os.path.join(sortie, dst))
            faits.append(dst)
    return faits


def derniere_capture(sortie):
    """Dernier rendu 3D de l'agent (…-rendu.png) : sert de vue 3D en page 1 du PDF."""
    rendus = sorted(glob.glob(os.path.join(sortie, "*-rendu.png")), key=os.path.getmtime)
    if not rendus:
        return {}
    with open(rendus[-1], "rb") as f:
        return {"perspective": "data:image/png;base64," + base64.b64encode(f.read()).decode()}


def faire_pdf(lien, numero, dossier, sortie, client):
    from georama_prod import pdf
    rapports = [os.path.join(dossier, n) for n in ("rapport.json", "rapport_rapide.json") if os.path.exists(os.path.join(dossier, n))]
    if not rapports:
        print("Pas encore de calcul pour cette commande : aperçu rapide d'abord.")
        calculer(lien, numero, dossier, "rapide", client)
        rapports = [os.path.join(dossier, "rapport_rapide.json")]
    with open(max(rapports, key=os.path.getmtime), encoding="utf-8") as f:
        rapport = json.load(f)
    commande = dict_lien(lien)
    approbation = commande.get("profil") == "entreprise"
    nom = ("Previsualisation_Georama_" if approbation else "Maquette_Georama_") + re.sub(r"[^\w\-]", "_", numero or "commande") + ".pdf"   # 13 nov. : plus « Confirmation_ » (confusion)
    chemin = os.path.join(dossier, nom)
    pdf.creer(chemin, dossier, rapport, commande, derniere_capture(sortie), client=client, numero=numero, perso=[], approbation=approbation)
    shutil.copy2(chemin, os.path.join(sortie, nom))
    return nom


def main(argv):
    if len(argv) >= 3 and not argv[0].startswith("--"):          # forme de l'agent 1.1
        argv = ["--mode", "3mf", "--lien", argv[0], "--numero", argv[1], "--sortie", argv[2]]
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=("apercu", "3mf", "pdf"), required=True)
    ap.add_argument("--lien", required=True)
    ap.add_argument("--numero", default="")
    ap.add_argument("--sortie", required=True)
    ap.add_argument("--client", default="")
    ap.add_argument("--gamme", default="")
    ap.add_argument("--format", default="")
    a = ap.parse_args(argv)

    from georama_prod import config
    lien = ajuster_lien(a.lien, a.gamme, a.format)
    numero = a.numero.strip()
    dossier = os.path.join(ICI, "commandes", f"georama_{ident(numero, lien)}")
    os.makedirs(a.sortie, exist_ok=True)
    print(f"Georama Production v{config.VERSION} depuis le hub : {a.mode}, commande {numero or '(sans numéro)'}")
    if a.gamme or a.format:
        print(f"  Gamme : {a.gamme or 'celle du lien'} ; format : {a.format or 'celui du lien'}")
    t0 = time.time() - 2
    try:
        if a.mode == "apercu":
            calculer(lien, numero, dossier, "rapide", a.client)
            fichiers = copier_images(dossier, a.sortie, t0)
            resultat(statut="fait", fichiers=fichiers, message="Aperçu rapide prêt (" + ", ".join(fichiers) + ").")
        elif a.mode == "3mf":
            chemin, _r = calculer(lien, numero, dossier, "complet", a.client)
            tampon = time.strftime("%Y%m%d-%H%M")
            nouveaux = sorted(f for f in glob.glob(os.path.join(dossier, "*.3mf")) if os.path.getmtime(f) >= t0) or [chemin]
            fichiers = []
            for f in nouveaux:
                base, ext = os.path.splitext(os.path.basename(f))
                cible = f"{base}_{tampon}{ext}"
                shutil.copy2(f, os.path.join(a.sortie, cible))
                fichiers.append(cible)
            fichiers += copier_images(dossier, a.sortie, t0)
            n = len(nouveaux)
            ctrl = (_r or {}).get("controle") or []                       # v4.21 : contrôle qualité de Production
            if ctrl:
                rates = [f"{x['nom']} ({x['detail']})" for x in ctrl if not x.get("ok")]
                qc = (f"Contrôle qualité {len(ctrl)}/{len(ctrl)} : prêt à trancher." if not rates
                      else f"Contrôle qualité {len(ctrl) - len(rates)}/{len(ctrl)}, à regarder : " + " ; ".join(rates) + ".")
            else:
                qc = ""
            resultat(statut="fait", fichiers=fichiers, message=f"{n} fichier(s) .3mf produit(s). {qc} Le rendu 3D suit.".replace("  ", " "),
                     controle=ctrl)
        else:
            par = os.path.join(dossier, "parametres.json")
            if not (a.gamme or a.format) and os.path.exists(par):      # même gamme et format que le dernier calcul
                with open(par, encoding="utf-8") as f:
                    lien = json.load(f).get("lien") or lien
            nom = faire_pdf(lien, numero, dossier, a.sortie, a.client)
            resultat(statut="fait", fichiers=[nom], message="PDF client prêt : " + nom)
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        resultat(statut="erreur", message=f"Georama Production : {e}"[:400])
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
