// Aides pour corriger la version mobile dans l'éditeur Wix Studio (console de l'éditeur).
// Chargement : (0,eval)(await (await fetch(RAW_URL)).text())
(() => {
  // API de l'éditeur, trouvée par le contexte React
  window.__trouverEAPI = () => {
    for (const el of document.querySelectorAll('[data-hook]')) {
      const k = Object.keys(el).find(k => k.startsWith('__reactFiber'));
      if (!k) continue;
      let f = el[k], n = 0;
      while (f && n < 200) {
        const p = f.memoizedProps;
        if (p && p.editorAPI && p.editorAPI.dsRead) return (window.__EAPI = p.editorAPI);
        let c = f.dependencies && f.dependencies.firstContext;
        while (c) {
          const v = c.memoizedValue;
          if (v && v.editorAPI && v.editorAPI.dsRead) return (window.__EAPI = v.editorAPI);
          c = c.next;
        }
        f = f.return; n++;
      }
    }
    return null;
  };
  const E = window.__EAPI || window.__trouverEAPI();
  const R = E.dsRead, A = E.dsActions;
  const attendre = ms => new Promise(r => setTimeout(r, ms));

  // Mise en page d'un élément pour un point de rupture (vi : 1 = tablette, 2 = mobile)
  // pid : la page, ou la section d'en-tête/pied de page (ex. comp-kbgajy18)
  window.__setM = (pid, id, fn, vi = 2) => {
    const p = { id, type: 'DESKTOP' };
    const bp = R.breakpoints.get({ id: pid, type: 'DESKTOP' });
    const vp = R.components.variants.getPointer(p, [bp.pointers[vi]]);
    let l = R.components.responsiveLayout.get(vp);
    const base = JSON.parse(JSON.stringify(R.components.responsiveLayout.get(p)));
    if (!l || !l.componentLayout || !Object.keys(l.componentLayout).length) {
      const keepItem = l && l.itemLayout && Object.keys(l.itemLayout).length ? l.itemLayout : null;
      l = base;
      if (keepItem) l.itemLayout = JSON.parse(JSON.stringify(keepItem));
    } else {
      l = JSON.parse(JSON.stringify(l));
      for (const k of ['componentLayout', 'itemLayout', 'containerLayout']) {
        if (!l[k] || !Object.keys(l[k]).length) l[k] = base[k];
      }
    }
    delete l.id;
    fn(l);
    A.components.responsiveLayout.update(vp, l);
    return 'ok ' + id;
  };
  window.__getM = (pid, id, vi = 2) => {
    const bp = R.breakpoints.get({ id: pid, type: 'DESKTOP' });
    return R.components.responsiveLayout.get(R.components.variants.getPointer({ id, type: 'DESKTOP' }, [bp.pointers[vi]]));
  };

  // Défilement de l'aperçu
  window.__sv = y => { const d = window.__doc(); d.documentElement.scrollTop = y; d.body.scrollTop = y; return y; };

  // Audit mobile de la page affichée : débordements, textes trop petits, chevauchements
  window.__mAudit = async () => {
    const d = window.__doc(), w = d.defaultView, W = w.innerWidth;
    const sy = () => d.documentElement.scrollTop || d.body.scrollTop;
    const over = [], small = [], ov = [];
    d.querySelectorAll('[id^="comp-"]').forEach(e => {
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || w.getComputedStyle(e).visibility === 'hidden') return;
      if (r.right > W + 2 || r.left < -2) over.push(e.id + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + '] y' + Math.round(r.top + sy()));
    });
    d.querySelectorAll('.wixui-rich-text__text').forEach(e => {
      const r = e.getBoundingClientRect();
      if (r.width < 2) return;
      const f = parseFloat(w.getComputedStyle(e).fontSize);
      if (f < 13) small.push(Math.round(f) + 'px ' + (e.closest('[id^="comp-"]') || {}).id + ' ' + e.textContent.trim().slice(0, 25));
    });
    const items = [...d.querySelectorAll('.wixui-rich-text, .wixui-button')].map(e => e.closest('[id^="comp-"]') || e)
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && w.getComputedStyle(e).visibility !== 'hidden'; });
    const R2 = items.map(e => { const r = e.getBoundingClientRect(); return { e, l: r.left, r: r.right, t: r.top + sy(), b: r.bottom + sy() }; });
    for (let i = 0; i < R2.length; i++) for (let j = i + 1; j < R2.length; j++) {
      const a = R2[i], b = R2[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l), iy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (ix > 6 && iy > 4) ov.push(a.e.id + ' x ' + b.e.id + ' y' + Math.round(Math.max(a.t, b.t)) + ' (' + a.e.textContent.trim().slice(0, 15) + ' / ' + b.e.textContent.trim().slice(0, 15) + ')');
    }
    const clip = [];
    d.querySelectorAll('section').forEach(s => {
      const sr = s.getBoundingClientRect();
      s.querySelectorAll('.wixui-rich-text, .wixui-button').forEach(t => {
        const r = t.getBoundingClientRect();
        if (r.height > 2 && (r.bottom > sr.bottom + 4 || r.top < sr.top - 4)) clip.push(((t.closest('[id^="comp-"]') || {}).id) + ' ' + t.textContent.trim().slice(0, 20) + ' y' + Math.round(r.top + sy()));
      });
    });
    return { W, H: d.documentElement.scrollHeight, over: over.slice(0, 20), small: small.slice(0, 20), ov: ov.slice(0, 25), clip: clip.slice(0, 20) };
  };

  // Sections : retire les hauteurs minimales mobiles et le vide en bas (> 110 px)
  window.__fixSections = async (pid, vi = 2) => {
    const d = window.__doc(), out = [];
    const sy = d.documentElement.scrollTop || d.body.scrollTop;
    for (const s of R.components.getChildren({ id: pid, type: 'DESKTOP' })) {
      if (!/Section/.test(R.components.getType(s))) continue;
      const e = d.getElementById(s.id);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      if (r.height < 5) continue;
      let maxB = r.top;
      e.querySelectorAll('[id^="comp-"]').forEach(c => {
        const rc = c.getBoundingClientRect();
        if (rc.height > 1 && rc.width > 1 && rc.bottom > maxB && rc.bottom <= r.bottom + 2) maxB = rc.bottom;
      });
      const vide = r.bottom - maxB;
      window.__setM(pid, s.id, l => {
        const cl = l.containerLayout || {};
        if (cl.rows) cl.rows = cl.rows.map(row => row.type === 'MinMaxSize' ? Object.assign({}, row, { min: { type: 'px', value: 0 } }) : row);
        l.containerLayout = cl;
        if (l.componentLayout) { l.componentLayout.minHeight = { type: 'px', value: 0 }; if (l.componentLayout.height && l.componentLayout.height.type !== 'auto') l.componentLayout.height = { type: 'auto' }; }
      }, vi);
      out.push(s.id + ' h' + Math.round(r.height) + ' vide' + Math.round(vide));
    }
    return out.join('\n');
  };

  window.__sauver = () => new Promise(res => {
    E.history.add('mobile');
    E.saveManager.saveInBackground(() => res('ok'), e => res('err ' + JSON.stringify(e).slice(0, 200)));
    setTimeout(() => res('timeout'), 20000);
  });
  return 'aide-mobile ok';
})();
