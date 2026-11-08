// Schermvullend voor altijd (CLAUDE.md §2): elke route uit het menu (3.0, Containers, Junior) op 390, 1440 en 2560 px, en op 1440 px met zoom 50% en 200%.
// Faalt als (a) de pagina horizontaal scrollt, (b) de inhoud minder dan 90% van de breedte gebruikt (op 1440, 2560 en zoom 50%),
// of (c) er nog een max-width in px/rem/em op een pagina, kop, kaart, lijst of balk staat (in een stijlregel of inline, of als het die breedte werkelijk begrenst).
// Echte database alleen lezen (schrijven wordt onderschept), Picqer wordt niet aangeroepen.
// Alleen een deel van de routes: ROUTES=regex (bijv. ROUTES="doorloop|todo"); AUDIT=1 meldt zonder te falen.
const { start } = require('./opzet.js');
const B = process.env.PD2_URL || 'http://localhost:8811/';
const VP = [['390', 390, 844], ['1440', 1440, 900], ['2560', 2560, 1300], ['zoom 50%', 2880, 1800], ['zoom 200%', 720, 450]];
const WIDTH = new Set(['1440', '2560', 'zoom 50%']);   // hier moet de inhoud ≥ 90% van de breedte vullen
const fouten = [], goed = [];
const meld = (route, vp, wat, x) => { fouten.push(route + ' @ ' + vp + ': ' + wat + (x ? ' — ' + x : '')); console.log('FOUT ' + route + ' @ ' + vp + ': ' + wat + (x ? ' — ' + x : '')); };

// loopt in de pagina (of iframe) en geeft terug wat er mis is
function meet(opt){
  const doc = document, W = innerWidth;
  const sichtbaar = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const uit = { hscroll:doc.documentElement.scrollWidth > W + 1, breed:null, caps:[], regels:[] };
  // gebruikte breedte: de bakken (blokken met rand, achtergrond of tekst) binnen het inhoudsvlak
  const pane = opt.pane ? doc.querySelector(opt.pane) : doc.body;
  const pr = pane ? pane.getBoundingClientRect() : { left:0, right:W, width:W };
  let lo = Infinity, hi = -Infinity;
  const skip = new Set(['HTML', 'BODY', 'SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'BR']);
  doc.querySelectorAll((opt.pane || 'body') + ' *').forEach(e => {
    if(skip.has(e.tagName) || !sichtbaar(e)) return;
    const r = e.getBoundingClientRect(); if(r.right < 0 || r.left > W) return;
    const cs = getComputedStyle(e), pos = cs.position;
    if(pos === 'fixed' || pos === 'sticky' || [...(function*(){ let x = e.parentElement; while(x && x !== doc.body){ const q = getComputedStyle(x).position; yield q; x = x.parentElement; } })()].some(q => q === 'fixed' || q === 'sticky')) return;   // koppen en knoppenbalken tellen niet mee
    // een blok telt mee als het zelf iets toont: rand, achtergrond of eigen tekst
    const heeftTekst = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const heeftRand = parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderTopWidth) > 0 || (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)');
    if(!heeftTekst && !heeftRand && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'IMG', 'SVG', 'CANVAS'].includes(e.tagName.toUpperCase())) return;
    lo = Math.min(lo, r.left); hi = Math.max(hi, r.right);
  });
  uit.breed = hi > lo ? (hi - lo) / Math.max(1, pr.width) : 0;
  uit.paneBreed = Math.round(pr.width);
  // (c) werkelijk begrenzende max-width (px) op structuur: niet op tekstblokken en formuliervelden
  const vrij = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'LABEL', 'SPAN', 'A', 'CODE', 'SMALL', 'B', 'I', 'STRONG', 'EM', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'IMG', 'SVG', 'CANVAS', 'TD', 'TH', 'KBD', 'PRE', 'SUMMARY', 'OPTION']);
  doc.querySelectorAll('body *').forEach(e => {
    if(vrij.has(e.tagName.toUpperCase()) || !sichtbaar(e) || (typeof e.className === 'string' && /(^|\s)bc(\s|$)/.test(e.className))) return;
    const cs = getComputedStyle(e), m = cs.maxWidth; if(!m || m === 'none' || !/px$/.test(m)) return;
    const w = e.getBoundingClientRect().width, mx = parseFloat(m);
    if(cs.position === 'fixed' && /toast/i.test(e.className + e.id)) return;
    if(w >= mx - 1 && w < W - 4) uit.caps.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '') + ' ' + Math.round(w) + 'px (max ' + m + ')');
  });
  // (c) stijlregels met max-width in px/rem/em (media-voorwaarden tellen niet): op pagina, kop, kaart, lijst of balk
  const uitzonder = /(^|[\s,>+~])(td|th|input|select|textarea|button|img|svg|canvas|kbd|pre|code|p|li|h1|h2|h3|summary|option)([\s.,:#\[>+~]|$)|toast|tooltip|\.kbd|placeholder|\.bc\b/i;
  const loop = (regels) => { for(const r of regels){
    if(r.cssRules && r.type !== 4 && r.type !== 1) { /* @keyframes e.d. */ }
    if(r.type === 4 && r.cssRules) loop(r.cssRules);   // @media: de regels erin tellen mee
    if(r.type !== 1 || !r.style) continue;
    const v = r.style.getPropertyValue('max-width'); if(!v || !/px\s*$/.test(v.trim())) continue;
    if(uitzonder.test(r.selectorText || '')) continue;
    uit.regels.push((r.selectorText || '').slice(0, 60) + ' { max-width:' + v + ' }');
  } };
  for(const sh of doc.styleSheets){ let rs; try{ rs = sh.cssRules; }catch(e){ continue; } loop(rs); }
  doc.querySelectorAll('[style*="max-width"]').forEach(e => { if(vrij.has(e.tagName.toUpperCase())) return; const v = e.style.maxWidth; if(v && /px$/.test(v)) uit.regels.push('inline ' + e.tagName.toLowerCase() + ' max-width:' + v); });
  return uit;
}

(async () => {
  const T = await start(); const P = T.p;
  await P.setViewportSize({ width:1440, height:900 });
  await P.goto(B + 'ivol.html#/todo');
  await P.waitForSelector('#menulijst a', { timeout:120000 });
  let routes = await P.evaluate(() => {
    document.querySelectorAll('#menulijst details').forEach(d => { d.open = true; });
    return [...new Set([...document.querySelectorAll('#menulijst a')].map(a => a.getAttribute('href')).filter(h => h && h.startsWith('#/')))];
  });
  const extra = ['junior.html', 'junior.html#/'];
  if(process.env.ROUTES) routes = routes.filter(r => new RegExp(process.env.ROUTES).test(r));
  console.log(routes.length + ' routes in het menu');
  const lijst = routes.map(r => ({ naam:r, url:B + 'ivol.html' + r })).concat(process.env.ROUTES ? [] : [{ naam:'junior.html', url:B + 'junior.html' }]);
  for(const rt of lijst){
    try{
      await P.setViewportSize({ width:1440, height:900 });
      await P.goto(rt.url); await P.reload();
      await P.waitForTimeout(rt.naam === 'junior.html' ? 6000 : 7000);
      // iframe-pagina's: wacht tot de frame iets toont
      for(let i = 0; i < 20; i++){ const klaar = await P.evaluate(() => { const f = document.getElementById('frame'); if(f && !f.hidden){ try{ const d = f.contentDocument; return !!(d && d.body && d.body.innerText.trim().length > 20); }catch(e){ return true; } } const n = document.getElementById('native'); return n && !n.hidden ? n.innerText.trim().length > 5 : (document.body.innerText.trim().length > 5); }).catch(() => true); if(klaar) break; await P.waitForTimeout(1500); }
      for(const [vn, w, h] of VP){
        await P.setViewportSize({ width:w, height:h }); await P.waitForTimeout(500);
        // meten in de pagina zelf of in het iframe dat de pagina toont
        const r = await P.evaluate(async ([fnSrc, naam]) => {
          const meet = eval('(' + fnSrc + ')');
          const f = document.getElementById('frame');
          if(f && !f.hidden){ let d; try{ d = f.contentDocument; }catch(e){ return null; } if(!d || !d.body) return null;
            const code = '(' + fnSrc + ')'; const win = f.contentWindow; const res = win.eval('(function(){ const meet = ' + fnSrc + '; return JSON.stringify(meet({ pane:null })); })()');
            const o = JSON.parse(res); o.frame = true; o.paneBreed = win.innerWidth; return o; }
          return Object.assign(meet({ pane:'#native' }), { frame:false });
        }, [meet.toString(), rt.naam]);
        if(!r){ meld(rt.naam, vn, 'niet meetbaar'); continue; }
        if(r.hscroll) meld(rt.naam, vn, 'de pagina scrollt horizontaal');
        if(WIDTH.has(vn) && r.breed < 0.9) meld(rt.naam, vn, 'inhoud gebruikt ' + Math.round(r.breed * 100) + '% van de breedte (' + r.paneBreed + ' px)');
        if(vn === '1440'){ r.caps.forEach(c => meld(rt.naam, vn, 'begrenzende max-width', c)); r.regels.forEach(c => meld(rt.naam, vn, 'max-width in stijlregel', c)); }
      }
      goed.push(rt.naam);
    }catch(e){ meld(rt.naam, '-', 'route faalde', e.message.slice(0, 120)); }
  }
  console.log('\n' + lijst.length + ' routes, ' + fouten.length + ' fouten');
  const uniek = [...new Set(fouten.map(f => f.replace(/^.* @ [^:]+: /, '')))];
  if(fouten.length) console.log('Unieke meldingen:\n' + uniek.slice(0, 80).join('\n'));
  console.log('0 geblokkeerde schrijfpogingen: ' + (T.blocked.length === 0 ? 'ja' : 'NEE ' + JSON.stringify(T.blocked.slice(0, 2))));
  console.log(fouten.length || T.blocked.length ? (process.env.AUDIT ? 'AUDIT: ' + fouten.length + ' FOUT' : '0 OK, ' + (fouten.length + T.blocked.length) + ' FOUT') : (lijst.length + ' OK, 0 FOUT'));
  await T.b.close();
  if(!process.env.AUDIT && (fouten.length || T.blocked.length)) process.exit(1);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
