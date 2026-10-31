// Soort Bulk: opslaan zet ook pick = nee (Te controleren, "Selectie is: Bulk"); containers: Bulk met stuks per pallet = "pallets à n → Bulk (up)"; keuzelijst ook op de productkaart (Verdeling).
// Echte database alleen lezen; alle schrijfacties onderschept.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
const KEY = 'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA';
(async () => {
  const T = await start(); const P = T.p, onder = [];
  const base = process.env.PD2_URL || 'http://localhost:8811/';
  // 1. Te controleren: Selectie is: Bulk voor Sprinttrack
  await P.goto(base + 'ivol.html#/nakijken');
  await P.waitForFunction(() => window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar && document.querySelector('.x-vraag'), null, { timeout:240000 });
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
  // 2 en 3. containers
  await P.route(/supabase\.co\/rest\/v1\/(containers|catalog)\?/, r => { const qq = r.request(); if(qq.method() === 'GET') return r.continue(); onder.push({ m:qq.method(), u:qq.url(), b:qq.postData() || '' }); return r.fulfill({ status:200, contentType:'application/json', body:qq.method() === 'PATCH' ? JSON.stringify([{ id:13, updated_at:new Date().toISOString() }]) : '[]' }); });
  await P.goto(base + 'containerplanning.html#/c/13/verdeling'); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3000);
  const kaart = () => P.evaluate(() => { const k = document.querySelector('#v-Snowbag'); return k ? { sel:!!k.querySelector('[data-llkeuze="Snowbag"]'), txt:k.innerText.replace(/\s+/g, ' ') } : null; });
  let k = await kaart();
  check('Snowbag-kaart (bij lossen bepalen) heeft zelf de keuzelijst', k && k.sel && !/kies bij "Na het lossen"/.test(k.txt), k && k.txt.slice(-120));
  await P.selectOption('#v-Snowbag [data-llkeuze="Snowbag"]', 'naar:UP'); await P.waitForTimeout(1500);
  if(!(await P.evaluate(() => !!document.querySelector('[data-ll-kaart]')))) await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(400);
  k = await kaart();
  check('"Alles naar Bulk (up)" op de kaart geeft "25 dozen → Bulk (up)" in blok en kaart', k && k.sel && /25 dozen → Bulk \(up\)/.test(await P.evaluate(() => document.querySelector('[data-ll-kaart="Snowbag"]') ? document.querySelector('[data-ll-kaart="Snowbag"]').innerText : '')) , k && k.txt.slice(-160));
  check('beide plekken tonen dezelfde keuze', await P.evaluate(() => [...document.querySelectorAll('[data-llkeuze="Snowbag"]')].length === 2 && new Set([...document.querySelectorAll('[data-llkeuze="Snowbag"]')].map(s => s.value)).size === 1 && document.querySelector('[data-llkeuze="Snowbag"]').value === 'naar:UP'));
  await P.selectOption('#v-Snowbag [data-llkeuze="Snowbag"]', 'lossen'); await P.waitForTimeout(1500);
  check('terug naar bij lossen bepalen vanaf de kaart', (await P.evaluate(() => document.querySelector('[data-ll-kaart="Snowbag"]') && document.querySelector('[data-ll-kaart="Snowbag"]').dataset.llStand)) === 'lossen');
  // Bulk-product met stuks per pallet: advies (productdata nagebootst: schakelaar aan, soort bulk)
  await P.goto(base + 'containerplanning.html#/c/23/verdeling'); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3000);
  const kand = await P.evaluate(() => [...document.querySelectorAll('.vcard[id^="v-"]')].filter(k => /Binnen:\s*\d+ pallets? à/.test(k.innerText)).map(k => k.id.slice(2)));
  check('container 23 heeft producten met pallets op de pakbon', kand.length > 0, kand.join());
  const code = kand.includes('ISM80X120') ? 'ISM80X120' : kand[0];
  await P.route(/supabase\.co\/rest\/v1\/catalog\?key=eq\.wh-pd-bron/, r => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([{ data:{ aan:true, door:'test' } }]) }));
  await P.route(/supabase\.co\/rest\/v1\/productdata\?select=productcode,data,meta/, r => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([{ productcode:code, data:{ opslag:'bulk' }, meta:{} }]) }));
  await P.goto(base + 'containerplanning.html#/c/23/verdeling'); await P.reload(); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3500);
  const adv = await P.evaluate(code => { const k = document.querySelector('#v-' + CSS.escape(code)); const a = k && k.querySelector('.adv'); return a ? { t:a.innerText.replace(/\s+/g, ' '), bin:k.innerText.replace(/\s+/g, ' ').match(/Binnen:[^=]*/)[0] } : null; }, code);
  check('Bulk-product met stuks per pallet: "pallets à n → Bulk (up)", nooit pick', adv && /\d+× \d+ → Bulk/.test(adv.t) && /Bulk \(up\)/.test(adv.t) && !/Picklocatie/.test(adv.t), JSON.stringify(adv));
  for(const [W, H] of [[390, 800], [1440, 900]]){
    await P.setViewportSize({ width:W, height:H }); await P.waitForTimeout(500);
    check(W + ' px zonder horizontale scroll (Verdeling)', await P.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  }
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT | onderschept ' + onder.length);
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
