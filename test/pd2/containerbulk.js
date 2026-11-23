// Soort Bulk: opslaan zet ook pick = nee (Te controleren, "Selectie is: Bulk"); containers: Bulk met stuks per pallet = "pallets à n → Bulk (up)"; keuzelijst ook op de productkaart (Verdeling).
// Echte database alleen lezen; alle schrijfacties onderschept.
const { start, naarContainers, openKaart, CP_URL } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
const KEY = 'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA';
(async () => {
  const T = await start(); const P = T.p, onder = [];
  const base = process.env.PD2_URL || 'http://localhost:8811/';
  // 1. Te controleren: Selectie is: Bulk voor Sprinttrack
  await P.goto(base + 'ivol.html#/nakijken');
  await P.waitForFunction(() => window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar && !PD2R.S.uitSnap && document.querySelector('.x-vraag'), null, { timeout:240000 });
  // Daan werkt live verder (Sprinttrack staat al op Bulk): de soort van de Sprinttrack-familie alleen in het geheugen weer open, zoals vóór zijn besluit
  await P.evaluate(() => { Object.keys(WH.D.P).filter(c => /sprinttrack/i.test(PD2R.naamVan(c))).forEach(c => { const x = PD2R.S.o.p[c]; if(x){ const y = JSON.parse(JSON.stringify(x)); delete y.so; delete y.weg; PD2R.S.o.p[c] = y; } const r = WHPD.S.pd[c]; if(r && r.data){ const d = Object.assign({}, r.data); delete d.opslag; delete d.pick; delete d.uitlopend; WHPD.S.pd[c] = Object.assign({}, r, { data:d }); } PD2R.ongeldig(c); }); PD2R.dataVers(); try{ WHX.herteken(); }catch(e){} });
  const q = await P.evaluate(() => { const L = WHX.vraagLijst(), q = L.find(y => y.k === 'soort' && /sprinttrack/i.test(PD2R.naamVan(y.c))); if(!q) return null; L.filter(y => !(y.fam === q.fam && y.k === 'soort')).forEach(y => WHX.S.later.add(y.c + '|' + y.k)); WHX.herteken(); return { c:q.c, fam:q.fam, n:L.filter(y => y.fam === q.fam && y.k === 'soort').length }; });
  check('Sprinttrack-familie staat open in Te controleren', !!q, JSON.stringify(q));
  if(q){
    await P.waitForSelector('.x-famsoort [data-x="vsoort"][data-v="bulk"]');
    await P.click('.x-famsoort [data-x="vsoort"][data-v="bulk"]'); await P.waitForTimeout(3000);
    await P.evaluate(() => PD2R.flush()); await P.waitForTimeout(1500);
    const w = T.pdWrites.map(x => ({ c:x.productcode, so:x.data && x.data.opslag, pick:x.data && x.data.pick }));
    check('Selectie is: Bulk geeft per product soort bulk + pick nee', w.length > 0 && w.every(x => x.so === 'bulk' && x.pick === 'nee'), JSON.stringify(w.slice(0, 4)) + ' n=' + w.length);
    check('alle ' + q.n + ' producten van de selectie opgeslagen', new Set(T.pdWrites.map(x => x.productcode)).size === q.n);
    // bulk → pick: pick = nee blijft staan
    const c = q.c, nu = await P.evaluate(c => { const r = PD2R.S.pd ? null : null; return null; }, c);
    const pw = await P.evaluate(c => { const p = PD2R.po(c); return p && p.so && p.so.v; }, c);
    check('soort bulk staat in 2.0', pw === 'bulk', pw);
    const tel = T.pdWrites.length;
    await P.evaluate(c => PD2R.poZet(c, p => { p.so = { v:'pick', st:'aangepast', t:new Date().toISOString() }; }), c); await P.evaluate(() => PD2R.flush()); await P.waitForTimeout(1500);
    const na = T.pdWrites.slice(tel).filter(x => x.productcode === c);
    check('wisselen van Bulk naar Pick laat pick = nee staan', na.every(x => x.data.pick === undefined || x.data.pick === 'nee') && na.every(x => x.data.opslag === 'pick'), JSON.stringify(na.map(x => x.data)));
  }
  // 2 en 3. containers — Daan 23-11: geen vaste container; de test kiest zelf een product op "bij lossen bepalen" en een product met pallets op de pakbon
  await P.route(/supabase\.co\/rest\/v1\/(containers|catalog)\?/, r => { const qq = r.request(); if(qq.method() === 'GET') return r.fallback(); onder.push({ m:qq.method(), u:qq.url(), b:qq.postData() || '' }); return r.fulfill({ status:200, contentType:'application/json', body:qq.method() === 'PATCH' ? JSON.stringify([{ id:+((qq.url().match(/id=eq\.(\d+)/) || [])[1] || 0), updated_at:new Date().toISOString() }]) : '[]' }); });
  await naarContainers(P);
  const keus = await P.evaluate(() => { const X = CP_TEST; let los = null, pal = null;
    X.cont().slice().sort((a, b) => b.id - a.id).forEach(c => { const pl = X.pools(c);
      X.invulCodes(c).filter(code => X.bijLossen(c, code)).forEach(code => { const d = X.doosVan(c, code), pool = pl.map[code]; const k = { id:c.id, code, doos:d && d.n > 0 ? d.n : 0, pallets:pool.pallets.length };
        if(!los || (k.doos && !k.pallets && !(los.doos && !los.pallets))) los = k; });
      if(!pal) pl.order.forEach(code => { if(!pal && (c.data.regels || []).some(r => r.productcode === code && r.soort === 'pallet' && (+r.per || 0) > 1) && X.eenheid(code) === 'st.' && /^\d+$/.test(String((X.geheugen(code) || {}).qty || '').trim())) pal = { id:c.id, code, spp:(X.geheugen(code) || {}).qty }; }); });   // stuks per pallet bekend in het productgeheugen
    return { los, pal }; });
  console.log('gekozen', JSON.stringify(keus));
  if(keus.los){
    const L = keus.los, sel = `[id="v-${L.code}"]`;
    await P.evaluate(id => { location.hash = '#/c/' + id + '/verdeling'; }, L.id); await P.waitForSelector(sel, { timeout:90000 }).catch(() => {}); await P.waitForTimeout(3000);
    await openKaart(P, L.code);
    const kaart = () => P.evaluate(c => { const k = document.getElementById('v-' + c); return k ? { sel:!!k.querySelector(`[data-llkeuze="${c}"]`), txt:k.innerText.replace(/\s+/g, ' ') } : null; }, L.code);
    let k = await kaart();
    check(L.code + '-kaart (bij lossen bepalen, container ' + L.id + ') heeft zelf de keuzelijst', k && k.sel && !/kies bij "Na het lossen"/.test(k.txt), k && k.txt.slice(-120));
    await P.selectOption(`${sel} [data-llkeuze="${L.code}"]`, 'naar:UP'); await P.waitForTimeout(1500);
    if(!(await P.evaluate(() => !!document.querySelector('[data-ll-kaart]')))) await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(400);
    k = await kaart();
    const blok = await P.evaluate(c => { const x = document.querySelector(`[data-ll-kaart="${c}"]`); return x ? x.innerText.replace(/\s+/g, ' ') : ''; }, L.code);
    const verwacht = L.doos && !L.pallets ? L.doos.toLocaleString('nl-NL') + ' dozen → Bulk (up)' : '→ Bulk (up)';
    check('"Alles naar Bulk (up)" op de kaart geeft "' + verwacht + '" in blok en kaart', k && k.sel && blok.includes(verwacht) && k.txt.includes('Bulk (up)'), blok.slice(-160));
    check('beide plekken tonen dezelfde keuze', await P.evaluate(c => [...document.querySelectorAll(`[data-llkeuze="${c}"]`)].length === 2 && new Set([...document.querySelectorAll(`[data-llkeuze="${c}"]`)].map(s => s.value)).size === 1 && document.querySelector(`[data-llkeuze="${c}"]`).value === 'naar:UP', L.code));
    await P.selectOption(`${sel} [data-llkeuze="${L.code}"]`, 'lossen'); await P.waitForTimeout(1500);
    check('terug naar bij lossen bepalen vanaf de kaart', (await P.evaluate(c => { const x = document.querySelector(`[data-ll-kaart="${c}"]`); return x && x.dataset.llStand; }, L.code)) === 'lossen');
  } else console.log('OVERGESLAGEN (2): geen product op "bij lossen bepalen" in de containers');
  // Bulk-product met stuks per pallet: advies (productdata nagebootst: schakelaar aan, soort bulk) voor een product met pallets op de pakbon dat de test zelf kiest
  check('er is een container met een product met pallets op de pakbon', !!keus.pal, JSON.stringify(keus.pal));
  if(keus.pal){
    const code = keus.pal.code;
    await P.route(/supabase\.co\/rest\/v1\/catalog\?key=eq\.wh-pd-bron/, r => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([{ data:{ aan:true, door:'test' } }]) }));
    await P.route(/supabase\.co\/rest\/v1\/productdata\?select=productcode,data,meta/, r => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([{ productcode:code, data:{ opslag:'bulk' }, meta:{} }]) }));
    await P.goto(CP_URL('#/c/' + keus.pal.id + '/verdeling')); await P.reload(); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3500);
    await openKaart(P, code);
    const adv = await P.evaluate(code => { const k = document.getElementById('v-' + code); const a = k && k.querySelector('.adv'); return a ? { t:a.innerText.replace(/\s+/g, ' '), bin:(k.innerText.replace(/\s+/g, ' ').match(/Binnen:[^=]*/) || [''])[0] } : null; }, code);
    check('Bulk-product met stuks per pallet (' + code + ', container ' + keus.pal.id + '): "pallets à n → Bulk (up)", nooit pick', adv && /\d+× [\d.]+ → Bulk/.test(adv.t) && /Bulk \(up\)/.test(adv.t) && !/Picklocatie/.test(adv.t), JSON.stringify(adv));
  }
  for(const [W, H] of [[390, 800], [1440, 900]]){
    await P.setViewportSize({ width:W, height:H }); await P.waitForTimeout(500);
    check(W + ' px zonder horizontale scroll (Verdeling)', await P.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  }
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT | onderschept ' + onder.length);
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
