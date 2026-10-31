// Containerplanning "Na het lossen": keuze per kaart (bij lossen bepalen · alles naar … · nu invullen), blok ingeklapt, en "per pallet" gaat vóór "Alles los naar".
// Echte database alleen lezen; alle schrijfacties onderschept.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
const KEY = 'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA';
(async () => {
  const T = await start(); const P = T.p, onder = [];
  await P.route(/supabase\.co\/rest\/v1\/(containers|catalog)\?/, r => { const q = r.request(); if(q.method() === 'GET') return r.continue(); onder.push({ m:q.method(), u:q.url(), b:q.postData() || '' }); return r.fulfill({ status:200, contentType:'application/json', body:q.method() === 'PATCH' ? JSON.stringify([{ id:13, updated_at:new Date().toISOString() }]) : '[]' }); });
  await P.route(/jspdf/, r => r.fulfill({ status:200, contentType:'application/javascript', body:`window.jspdf = { jsPDF:function(){ const t = window.__pdf = { tekst:[], paginas:1 }; const n = () => {}; return { setProperties:n, setFont:n, setFontSize:n, setTextColor:n, setDrawColor:n, setFillColor:n, rect:n, roundedRect:n, line:n, addImage:n, addPage(){ t.paginas++; }, text(x){ t.tekst.push([].concat(x).join(' ')); }, splitTextToSize(x){ return [String(x)]; }, output(){ return new ArrayBuffer(8); } }; } };` }));
  const v0 = await (await fetch('https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/containers?id=eq.13&select=data', { headers:{ apikey:KEY } })).json().then(r => r[0].data.verdeling);
  const url = h => (process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html' + h;
  await P.goto(url('#/c/13/verdeling')); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3000);
  const kop = await P.evaluate(() => (document.querySelector('#lossen h2') || {}).innerText || '');
  check('A2: blok heet "Na het lossen (9)" en staat ingeklapt', kop === 'Na het lossen (9)' && !(await P.evaluate(() => document.querySelectorAll('[data-ll-kaart]').length)), kop);
  await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(400);
  const st = await P.evaluate(() => [...document.querySelectorAll('[data-ll-kaart]')].map(x => x.dataset.llStand));
  const velden = await P.evaluate(() => document.querySelectorAll('#lossen [data-lk]').length);
  check('A1: na openen 9 kaarten, alle "bij lossen bepalen", 0 kaarten open (geen invulvelden)', st.length === 9 && st.every(x => x === 'lossen') && velden === 0, st.join() + ' velden ' + velden);
  const rij = await P.evaluate(() => document.querySelector('[data-ll-kaart="Snowbag"]').innerText.replace(/\s+/g, ' '));
  check('A1: ingeklapte kaart = code · naam · pakbon · bij lossen bepalen', /Snowbag/.test(rij) && /pakbon 25 dozen à 20/.test(rij) && /bij lossen bepalen/.test(rij), rij);
  const som = () => P.evaluate(() => document.querySelector('.sumbar').innerText.replace(/\s+/g, ' '));
  let sum = await som();
  check('A: teller "akkoord · 9 bij lossen bepalen"', /\d+\/\d+ akkoord · 9 bij lossen bepalen/i.test(sum), sum);
  check('A: geen onderschepte schrijfactie door alleen kijken', onder.length === 0, onder.length);
  // Alles naar → Bulk (up) bij Snowbag
  await P.selectOption('[data-llkeuze="Snowbag"]', 'naar:UP'); await P.waitForTimeout(1500);
  const sb = await P.evaluate(() => document.querySelector('[data-ll-kaart="Snowbag"]').innerText.replace(/\s+/g, ' '));
  check('A1: "Alles naar → Bulk (up)" bij Snowbag geeft "25 dozen → Bulk (up)" met Akkoord-knop', /25 dozen → Bulk \(up\)/.test(sb) && await P.evaluate(() => !!document.querySelector('[data-ll-kaart="Snowbag"] [data-act="vakk"]:not([disabled])')), sb);
  sum = await som();
  check('A: teller daarna "· 8 bij lossen bepalen"', /akkoord · 8 bij lossen bepalen/i.test(sum), sum);
  // MM-BLK-10x120: Per = 1 → los
  await P.selectOption('[data-llkeuze="MM-BLK-10x120"]', 'naar:PICK'); await P.waitForTimeout(1500);
  const mm = await P.evaluate(() => document.querySelector('[data-ll-kaart="MM-BLK-10x120"]').innerText.replace(/\s+/g, ' '));
  check('A1: "Alles naar → Picklocatie" bij MM-BLK-10x120 geeft "7 st. los → Picklocatie"', /7 st\. los → Picklocatie/.test(mm), mm);
  const laatste = () => { const c = onder.filter(x => /containers/.test(x.u) && x.m === 'PATCH').map(x => JSON.parse(x.b)).pop(); return c && c.data && c.data.verdeling; };
  await P.waitForTimeout(1200);
  let ver = laatste();
  check('A1: opgeslagen (onderschept): Snowbag 500 los → UP, bron allesnaar, geen akkoord', ver && ver.Snowbag && ver.Snowbag.bron === 'allesnaar' && !ver.Snowbag.bevestigd && JSON.stringify(ver.Snowbag.porties) === JSON.stringify([{ soort:'los', n:500, dest:'UP' }]), JSON.stringify(ver && ver.Snowbag));
  // terugdraaien MM-BLK
  await P.selectOption('[data-llkeuze="MM-BLK-10x120"]', 'lossen'); await P.waitForTimeout(1800);
  ver = laatste();
  check('A1: terugdraaien zonder akkoord: MM-BLK-10x120 weer "bij lossen bepalen", oude verdeling terug', await P.evaluate(() => document.querySelector('[data-ll-kaart="MM-BLK-10x120"]').dataset.llStand) === 'lossen' && JSON.stringify(ver['MM-BLK-10x120']) === JSON.stringify(v0['MM-BLK-10x120']), JSON.stringify(ver['MM-BLK-10x120']));
  // Uitvoer opent, Snowbag staat nog op de invullijst in de losdag-PDF
  await P.evaluate(() => { location.hash = '#/c/13/uitvoer'; }); await P.waitForSelector('#wbprev', { timeout:60000 });
  check('A: Uitvoer opent', true);
  await P.evaluate(() => document.querySelector('[data-act="pdfall"]').click()); await P.waitForTimeout(4000);
  const pdf = await P.evaluate(() => (window.__pdf || { tekst:[] }).tekst);
  const i0 = pdf.findIndex(t => /^(Invullijst lossen|Unloading checklist)$/.test(t)), i1 = pdf.findIndex((t, i) => i > i0 && /^Stockmove/.test(t));
  const lijst = pdf.slice(i0, i1).filter(t => /^\S+ {3}/.test(t)).map(t => t.split(' ')[0]);
  check('A1: Snowbag staat nog op de invullijst in de losdag-PDF (9 producten)', lijst.includes('Snowbag') && lijst.length === 9, lijst.join());
  // Nu invullen: blok open, velden zichtbaar, Opslaan werkt en de Alles-naar-verdeling blijft staan bij akkoord
  await P.evaluate(() => { location.hash = '#/c/13/verdeling'; }); await P.waitForSelector('#lossen', { timeout:60000 }); await P.waitForTimeout(500);
  if(!(await P.evaluate(() => !!document.querySelector('[data-ll-kaart]')))) await P.click('#lossen [data-act="lltoggle"]');
  await P.selectOption('[data-llkeuze="SWB-165-BLA"]', 'nu'); await P.waitForTimeout(500);
  check('A1: "Nu invullen" opent de velden (blok open)', await P.evaluate(() => document.querySelectorAll('[data-ll-kaart="SWB-165-BLA"] [data-lk]').length >= 7 && !!document.querySelector('[data-ll-kaart="SWB-165-BLA"] [data-act="llsave"]')));
  await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(300);
  check('A2: blok klapt in op tikken', await P.evaluate(() => !document.querySelector('[data-ll-kaart]')));
  for(const w of [390, 1440]){ await P.setViewportSize({ width:w, height:900 }); await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(400); check('Na het lossen open op ' + w + ' px zonder horizontale scroll', await P.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(200); }
  // E4005: per pallet 100 + "Alles los naar Picklocatie" (in de test, niet opgeslagen) → volle pallets à 100, rest naar pick
  const T2 = await start(); const Q = T2.p;
  await Q.route(/supabase\.co\/rest\/v1\/(containers|catalog)\?/, async r => {
    const q = r.request(), u = decodeURIComponent(q.url());
    if(q.method() !== 'GET'){ onder.push({ m:q.method(), u, b:'' }); return r.fulfill({ status:200, contentType:'application/json', body:'[]' }); }
    const res = await r.fetch(), rows = await res.json();
    if(/catalog/.test(u)) rows.forEach(x => { if(x.key === 'catalog-ean' && x.data) Object.values(x.data).forEach(g => { if(g && g.sub === 'E4005-10KG') g.losdest = 'PICK'; }); });
    if(/containers/.test(u)) rows.forEach(c => { if(c.id === 13 && c.data){ c.data.regels.forEach(x => { if(x.productcode === 'E4005-10KG'){ x.aantal = 250; x.totaal = 250; } }); delete c.data.verdeling['E4005-10KG']; } });
    return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(rows) });
  });
  await Q.goto(url('#/c/13/verdeling')); await Q.waitForSelector('#tabbody', { timeout:90000 }); await Q.waitForTimeout(3000);
  const e4 = await Q.evaluate(() => { const k = document.getElementById('v-E4005-10KG'); return k ? k.querySelector('.adv').innerText.replace(/\s+/g, ' ') : ''; });
  check('A3: E4005-10KG met per pallet 100 en "Alles los naar Picklocatie": volle pallets à 100, alleen de rest (50) naar pick', /2× 100 →/.test(e4) && /50 los → Picklocatie/.test(e4) && !/250 los/.test(e4), e4);
  const e4b = await Q.evaluate(() => { const k = document.getElementById('v-E4005-10KG'); return k ? k.innerText.replace(/\s+/g, ' ') : ''; });
  check('A3: Binnen: 2 pallets à 100 + 50 los', /2 pallets à 100 \+ 50 los/.test(e4b), e4b.slice(0, 160));
  await T2.b.close();
  const anders = (laatste() ? Object.keys(v0).filter(k => !['Snowbag'].includes(k) && JSON.stringify(laatste()[k]) !== JSON.stringify(v0[k])) : ['geen opslag']);
  check('Andere verdelingen en akkoorden ongewijzigd', anders.length === 0, anders.join());
  console.log('ERRORS', T.errors.concat(T2.errors).filter(e => !/Failed to load resource|jsPDF/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT', '| onderschept', onder.length, '| geblokkeerd', T.blocked.length + T2.blocked.length);
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
