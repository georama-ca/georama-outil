// Audit d'une page Wix publiée : images (netteté, alt, poids), débordements, textes à surveiller.
// Usage dans la console : await __audit()
window.__audit = async function () {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  // faire défiler pour charger les images paresseuses
  const H = () => document.documentElement.scrollHeight;
  for (let y = 0; y < H(); y += Math.max(400, innerHeight * 0.8)) { scrollTo(0, y); await pause(250); }
  scrollTo(0, 0); await pause(600);
  const dpr = devicePixelRatio || 1;
  const imgs = [];
  document.querySelectorAll("img").forEach((im) => {
    const r = im.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return;
    const cs = getComputedStyle(im);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    const src = im.currentSrc || im.src || "";
    const m = src.match(/media\/([^/]+?)(?:\/v1\/(\w+)\/([^/]+))?(?:\/|$)/);
    const p = {};
    if (m && m[3]) m[3].split(",").forEach((kv) => { const [k, v] = kv.split("_"); p[k] = v; });
    // taille réellement affichée de l'image (object-fit cover : la plus grande échelle)
    const nw = im.naturalWidth, nh = im.naturalHeight;
    const echelle = nw && nh ? Math.max(r.width / nw, r.height / nh) * dpr : 0;
    imgs.push({
      id: m ? m[1] : src.slice(0, 80),
      alt: im.alt || "",
      affiche: Math.round(r.width) + "x" + Math.round(r.height),
      naturel: nw + "x" + nh,
      agrandi: +echelle.toFixed(2),            // > 1.15 : flou probable
      q: p.q || "", blur: p.blur || "",
      y: Math.round(r.top + scrollY),
    });
  });
  // débordement horizontal
  const W = document.documentElement.clientWidth, deb = [];
  document.querySelectorAll("body *").forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.right > W + 2 && getComputedStyle(e).position !== "fixed") {
      const t = (e.innerText || "").trim().slice(0, 40);
      if (t && deb.length < 8) deb.push({ tag: e.tagName, t, right: Math.round(r.right) });
    }
  });
  const txt = document.body.innerText;
  const surveiller = ["85 $", "145 $", "8,5 × 11", "8,5 x 11", "17 × 22", "Lorem", "lorem", "Premium", "hobbeyiste", "approuv", "TBD", "À venir", "Titre", "Paragraphe", "Ajoutez", "Add ", "Placeholder"]
    .filter((s) => txt.includes(s))
    .map((s) => { const i = txt.indexOf(s); return s + " → « " + txt.slice(Math.max(0, i - 40), i + 50).replace(/\s+/g, " ") + " »"; });
  return JSON.stringify({
    url: location.pathname, largeur: innerWidth, dpr, hauteur: H(),
    title: document.title,
    h1: [...document.querySelectorAll("h1")].map((e) => e.textContent.trim().slice(0, 60)),
    sansAlt: imgs.filter((i) => !i.alt).length,
    flous: imgs.filter((i) => i.agrandi > 1.15),
    imgs: imgs.length,
    debordements: deb,
    surveiller,
    scrollX: document.documentElement.scrollWidth > W + 2,
  });
};
"ok";
