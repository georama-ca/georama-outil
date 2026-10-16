// Petites fonctions utilisées par Claude dans l'éditeur Wix (rien n'est publié)
window.__norm = (s) => String(s || '').replace(/[​ ]/g, ' ').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
window.__frame = () => document.querySelector('iframe[name="preview-frame"]');
window.__doc = () => window.__frame().contentDocument;
window.__k = () => 800 / window.innerWidth;
window.__trouver = function (debut, n) { const e = [...window.__doc().querySelectorAll('[data-testid="richTextElement"]')].filter((e) => window.__norm(e.innerText).startsWith(window.__norm(debut)))[n || 0]; if (e) e.scrollIntoView({ block: 'center' }); return e; };
window.__pt = function (e) { const R = window.__frame().getBoundingClientRect(), k = window.__k(); const t = e.querySelector('p,h1,h2,h3,h4,span') || e; const r = t.getBoundingClientRect(); return { x: Math.round((R.left + r.left + Math.min(r.width, 120) / 2) * k), y: Math.round((R.top + r.top + Math.max(Math.min(r.height, 30), 10) / 2) * k) }; };
window.__pos2 = function (debut, n) { const e = [...window.__doc().querySelectorAll('[data-testid="richTextElement"]')].filter((e) => window.__norm(e.innerText).startsWith(window.__norm(debut)))[n || 0]; return e ? window.__pt(e) : 'introuvable'; };
window.__posId = function (id) { const e = window.__doc().getElementById(id); return e ? window.__pt(e) : 'introuvable'; };
window.__sel = () => [...document.querySelectorAll('.wds-breadcrumbs__item')].map((x) => x.textContent.trim()).filter(Boolean).slice(-1)[0] || '';
window.__cke = () => [...document.querySelectorAll('iframe.cke_wysiwyg_frame')].filter((f) => { const r = f.getBoundingClientRect(); return r.width > 0 && r.left >= 0; });
window.__etat = (d) => JSON.stringify([window.__sel(), window.__pos2(d), window.__cke().map((f) => window.__norm(f.contentDocument.body.innerText).slice(0, 25))]);
window.__verif = function (debut) { const f = window.__cke().find((f) => window.__norm(f.contentDocument.body.innerText).startsWith(window.__norm(debut))); if (!f) throw new Error('pas en édition sur le bon texte: ' + window.__sel() + ' ' + JSON.stringify(window.__cke().map((f) => window.__norm(f.contentDocument.body.innerText).slice(0, 25)))); if (document.activeElement !== f) { f.focus(); f.contentWindow.focus(); } return 'ok ' + window.__norm(f.contentDocument.body.innerText).slice(0, 30); };
window.__scrollX = (dx) => { const sc = [...document.querySelectorAll('[class*="layout-scrollable"]')].find((e) => e.scrollWidth > e.clientWidth); if (sc) sc.scrollLeft = dx === 0 ? 0 : sc.scrollLeft + dx; return sc ? sc.scrollLeft : null; };
window.__textes = (re) => [...window.__doc().querySelectorAll('[data-testid="richTextElement"]')].map((e) => window.__norm(e.innerText)).filter((t) => re.test(t)).map((t) => t.slice(0, 40));
'aides prêtes';
