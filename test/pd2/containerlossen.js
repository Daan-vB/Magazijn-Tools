// Containerplanning: stand "bij lossen bepalen" (A) en de invullijst lossen (B). Echte database alleen lezen; alle schrijfacties onderschept.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p, onder = [];
  await P.route(/supabase\.co\/rest\/v1\/(containers|catalog)\?/, r => { const q = r.request(); if(q.method() === 'GET') return r.continue(); onder.push({ m:q.method(), u:q.url(), b:q.postData() || '' }); return r.fulfill({ status:200, contentType:'application/json', body:'[]' }); });
  await P.route(/supabase\.co\/storage\//, r => { const q = r.request(); if(q.method() === 'GET') return r.continue(); onder.push({ m:q.method(), u:q.url(), b:'' }); return r.fulfill({ status:200, contentType:'application/json', body:'{}' }); });
  // jsPDF nagebootst (cdn niet bereikbaar in de test): de teksten worden bewaard in window.__pdf
  await P.route(/jspdf/, r => r.fulfill({ status:200, contentType:'application/javascript', body:`window.jspdf = { jsPDF:function(){ const t = window.__pdf = { tekst:[], paginas:1 }; const n = () => {}; return { setProperties:n, setFont:n, setFontSize:n, setTextColor:n, setDrawColor:n, setFillColor:n, rect:n, roundedRect:n, line:n, addImage:n, addPage(){ t.paginas++; }, text(x){ t.tekst.push([].concat(x).join(' ')); }, splitTextToSize(x){ return [String(x)]; }, output(){ return new ArrayBuffer(8); } }; } };` }));
  const v0 = await (await fetch('https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/containers?id=eq.13&select=data', { headers:{ apikey:'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA' } })).json().then(r => r[0].data.verdeling);
  const url = h => (process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html' + h;
  await P.goto(url('#/c/13/verdeling')); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3000);
  const sum = await P.evaluate(() => document.querySelector('.sumbar').innerText.replace(/\s+/g, ' '));
  check('A: SEKU6023732 toont 14/14 akkoord · 9 bij lossen bepalen', /14\/14 akkoord · 9 bij lossen bepalen/i.test(sum), sum);
  check('A: geen knop "Advies invullen"', !(await P.evaluate(() => !!document.querySelector('[data-act="advalles"]'))));
  // B1: invullijst in de losdag-PDF (jsPDF nagebootst: we lezen de teksten)
  await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(300);
  const lossen9 = await P.evaluate(() => [...document.querySelectorAll('[data-ll-kaart]')].map(x => x.dataset.llKaart));
  check('B2: blok "Na het lossen (9)" met 9 producten', lossen9.length === 9 && /Na het lossen \(9\)/.test(await P.evaluate(() => document.body.innerText)), lossen9.join());
  await P.evaluate(() => { location.hash = '#/c/13/uitvoer'; }); await P.waitForSelector('#wbprev', { timeout:60000 });
  const wb = await P.evaluate(() => document.getElementById('wbprev').innerText);
  check('B4: werkbon zegt bij die producten "bij lossen bepalen — zie invullijst" (NL of EN)', /decide at unloading — see checklist|bij lossen bepalen — zie invullijst/.test(wb) && !/no plan yet|nog geen verdeling/.test(wb));
  await P.evaluate(() => document.querySelector('[data-act="pdfall"]').click()); await P.waitForTimeout(4000);
  const pdf = await P.evaluate(() => (window.__pdf || { tekst:[] }).tekst);
  const i0 = pdf.findIndex(t => /^(Invullijst lossen|Unloading checklist)$/.test(t)), i1 = pdf.findIndex((t, i) => i > i0 && /^Stockmove/.test(t));
  const opLijst = lossen9.filter(code => pdf.slice(i0, i1).some(t => t.startsWith(code + ' ')));
  const andere = pdf.slice(i0, i1).filter(t => /^\S+ {3}/.test(t)).map(t => t.split(' ')[0]).filter(c => !lossen9.includes(c));
  check('B1: losdag-PDF heeft een invullijst met precies die 9 producten', i0 > 0 && opLijst.length === 9 && !andere.length, 'gevonden ' + opLijst.length + (andere.length ? ', extra ' + andere.join() : ''));
  check('B1: velden op de invullijst (geteld, per doos, per pallet, palletmaat, hoogte, gewicht, opmerking)', ['^Counted|^Geteld', 'per box|per doos', 'Boxes per pallet|Dozen per pallet', 'Pallet size|Palletmaat', 'Height incl. pallet|Hoogte incl. pallet', 'Weight full pallet|Gewicht volle pallet', 'Note|Opmerking'].every(r => pdf.slice(i0, i1).some(t => new RegExp(r).test(t))));
  check('B1: pakbon "25 dozen à 20" (of EN) bij Snowbag', pdf.slice(i0, i1).some(t => /25 (dozen à|boxes of) 20/.test(t)));
  // B2: Snowbag invullen: 5 dozen per pallet
  onder.length = 0;
  await P.evaluate(() => { location.hash = '#/c/13/verdeling'; }); await P.waitForSelector('#lossen', { timeout:60000 });
  if(!(await P.evaluate(() => !!document.querySelector('[data-ll-kaart]')))) await P.click('#lossen [data-act="lltoggle"]');
  await P.selectOption('#lossen [data-llkeuze="Snowbag"]', 'nu'); await P.waitForTimeout(300);
  await P.fill('[data-ll-kaart="Snowbag"] [data-lk="dpp"]', '5'); await P.fill('[data-ll-kaart="Snowbag"] [data-lk="maat"]', '80x120');
  await P.click('[data-ll-kaart="Snowbag"] [data-act="llsave"]'); await P.waitForTimeout(3500);
  const cat = onder.filter(x => /catalog/.test(x.u)).map(x => JSON.parse(x.b)[0]);
  const ean = cat.find(x => x.key === 'catalog-ean'), kopieEerst = cat.length >= 2 && /^catalog-ean-kopie-/.test(cat[0].key) && cat[1].key === 'catalog-ean';
  const rec = ean && Object.values(ean.data).find(x => x && x.sub === 'Snowbag');
  check('B2: eerst een kopie van catalog-ean, dan het productgeheugen (onderschept)', kopieEerst, cat.map(x => x.key).join());
  check('B2: productgeheugen Snowbag: stuks per pallet 100, bron lossen, palletmaat 80x120', rec && String(rec.qty) === '100' && rec.lossen && rec.lossen.bron === 'lossen' && rec.lossen.maat === '80x120', JSON.stringify(rec && { qty:rec.qty, lossen:rec.lossen }));
  const cont = onder.filter(x => /containers/.test(x.u) && x.m === 'PATCH').map(x => JSON.parse(x.b)).pop();
  const vs = cont && cont.data && cont.data.verdeling && cont.data.verdeling.Snowbag;
  const pal = vs ? vs.porties.filter(x => x.soort === 'pallet' && +x.per === 100).reduce((a, x) => a + x.n, 0) : 0;
  check('B2: verdeling Snowbag = 5 pallets à 100, nog geen akkoord (onderschept)', pal === 5 && !vs.bevestigd && vs.porties.every(x => x.soort === 'pallet'), JSON.stringify(vs));
  check('B3: Snowbag staat daarna niet meer op de invullijst', !(await P.evaluate(() => !!document.querySelector('[data-ll-kaart="Snowbag"]'))));
  const anders = cont ? Object.keys(v0).filter(k => k !== 'Snowbag' && JSON.stringify(cont.data.verdeling[k]) !== JSON.stringify(v0[k])) : ['geen opslag'];
  check('Andere verdelingen en akkoorden ongewijzigd', anders.length === 0, anders.join());
  for(const w of [390, 1440]){ await P.setViewportSize({ width:w, height:900 }); await P.waitForTimeout(400); check('Verdeling met invulblok op ' + w + ' px zonder horizontale scroll', await P.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|jsPDF/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT', '| onderschept', onder.length, '| geblokkeerd', T.blocked.length);
  if(T.blocked.length) console.log('FOUT geblokkeerde schrijfpogingen', T.blocked.slice(0, 3));
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
