"""BDPPAD (FADQ) -> GeoJSON lignes pour tippecanoe : contour des parcelles + groupe de production simple.
Géométrie simplifiée à ~1 m, coordonnées arrondies à 6 décimales."""
import sys, json, subprocess, re
shp, sortie = sys.argv[1], sys.argv[2]
info = subprocess.run(["ogrinfo", "-so", "-al", shp], capture_output=True, text=True).stdout
champs = [l.split(":")[0].strip() for l in info.splitlines() if re.match(r"^\s*[A-Za-z_0-9]+: (String|Integer|Real|Integer64)", l)]
print("Champs :", champs)
cand = [c for c in champs if re.search(r"GROUP|GRP|CULT|PROD", c, re.I)]
print("Candidats production :", cand)
subprocess.run(["ogr2ogr", "-f", "GeoJSONSeq", "-t_srs", "EPSG:4326", "-lco", "COORDINATE_PRECISION=6",
                "-simplify", "0.00001", "/tmp/b/brut.geojsonl", shp], check=True)
def groupe(p):
    txt = " ".join(str(p.get(c, "")) for c in cand).lower()
    for g, mots in [("verger", ["pomm", "verger", "bleuet", "fruit", "vign", "petits fruits", "canneb"]),
                    ("maraicher", ["maraîch", "maraich", "légume", "legume", "pomme de terre", "patate"]),
                    ("fourrage", ["fourrag", "foin", "prairie", "pâtur", "patur", "luzerne"]),
                    ("cereale", ["maïs", "mais", "soya", "soja", "blé", "ble", "orge", "avoine", "céréal", "cereal", "canola", "grain"])]:
        if any(m in txt for m in mots): return g
    return "autre"
n = 0
with open("/tmp/b/brut.geojsonl") as f, open(sortie, "w") as o:
    for l in f:
        l = l.strip().lstrip("\x1e")
        if not l: continue
        ft = json.loads(l)
        if not ft.get("geometry"): continue
        o.write(json.dumps({"type": "Feature", "geometry": ft["geometry"], "properties": {"g": groupe(ft.get("properties") or {})}}, separators=(",", ":")) + "\n")
        n += 1
print(n, "parcelles")
