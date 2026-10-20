"""BDPPAD (FADQ) -> GeoJSON lignes pour tippecanoe : contour des parcelles + groupe de production simple.
Géométrie simplifiée à ~1 m, coordonnées arrondies à 6 décimales."""
import sys, json, subprocess, re, os
os.makedirs("champs", exist_ok=True)
shp, sortie = sys.argv[1], sys.argv[2]
info = subprocess.run(["ogrinfo", "-so", "-al", shp], capture_output=True, text=True).stdout
champs = [l.split(":")[0].strip() for l in info.splitlines() if re.match(r"^\s*[A-Za-z_0-9]+: (String|Integer|Real|Integer64)", l)]
print("Champs :", champs)
cand = [c for c in champs if re.search(r"GROUP|GRP|CULT|PROD", c, re.I)]
print("Candidats production :", cand)
subprocess.run(["ogr2ogr", "-f", "GeoJSONSeq", "-t_srs", "EPSG:4326", "-lco", "COORDINATE_PRECISION=6",
                "-simplify", "0.00001", "/tmp/b/brut.geojsonl", shp], check=True)
GRO = {"cereale": "SOY MGR BPA AVO ORG SEI CNL PRT", "fourrage": "FOI MAF",
       "maraicher": "CMA LDT PDT DIV RAC FEU VIV", "fruits": "PTF POM FRU"}
GRO = {c: g for g, l in GRO.items() for c in l.split()}
def groupe(p):
    g = GRO.get(str(p.get("GROPRO") or "").strip())
    if g: return g
    # groupe « Multiples », « Autres » ou « Inconnu » : la première production le précise
    d = str(p.get("DESCODPR1") or "").lower()
    for g, mots in [("fruits", ["bleuet", "canneberge", "fraise", "framboise", "pomme", "vign", "camerise", "petits fruits"]),
                    ("maraicher", ["maraîch", "maraich", "légume", "pommes de terre", "chou", "carotte", "oignon", "laitue", "tomate", "citrouille", "courge", "ail "]),
                    ("fourrage", ["foin", "pâturage", "fourrag", "luzerne", "prairie"]),
                    ("cereale", ["maïs", "soya", "blé", "orge", "avoine", "seigle", "canola", "sarrasin", "pois", "haricot sec", "triticale", "épeautre"])]:
        if any(m in d for m in mots): return g
    return "autre"
import collections
stats = collections.defaultdict(collections.Counter)
n = 0
with open("/tmp/b/brut.geojsonl") as f, open(sortie, "w") as o:
    for l in f:
        l = l.strip().lstrip("\x1e")
        if not l: continue
        ft = json.loads(l)
        if not ft.get("geometry"): continue
        for c2, v2 in (ft.get("properties") or {}).items():
            if c2 in ("GROPRO", "DESGROPRO", "DESCODPR1"): stats[c2][str(v2)] += 1
        o.write(json.dumps({"type": "Feature", "geometry": ft["geometry"], "properties": {"g": groupe(ft.get("properties") or {})}}, separators=(",", ":")) + "\n")
        n += 1
print(n, "parcelles")
gr = collections.Counter()
with open(sortie) as f:
    for l in f: gr[json.loads(l)["properties"]["g"]] += 1
json.dump({"champs": champs, "candidats": cand, "groupes": gr,
           "valeurs": {c2: cn.most_common(60) for c2, cn in stats.items() if len(cn) < 5000}},
          open("champs/stats.json", "w"), ensure_ascii=False, indent=1)
