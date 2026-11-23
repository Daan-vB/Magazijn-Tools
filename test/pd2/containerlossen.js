// Containerplanning: stand "bij lossen bepalen" (A) en de invullijst lossen (B). Echte database alleen lezen; alle schrijfacties onderschept.
// Daan 23-11: geen vaste container of vaste aantallen. De test kiest zelf de container met de meeste producten op "Na het lossen"
// en rekent elke verwachting uit de data van die container.
const { start, naarContainers, kiesContainer, CP_URL, nlGetal } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
(async () => {
  const T = await start(); const P = T.p, onder = [];
  await P.route(/supabase\.co\/rest\/v1\/(containers|catalog)\?/, r => { const q = r.request(); if(q.method() === 'GET') return r.continue(); onder.push({ m:q.method(), u:q.url(), b:q.postData() || '' }); return r.fulfill({ status:200, contentType:'application/json', body:'[]' }); });
  await P.route(/supabase\.co\/storage\//, r => { const q = r.request(); if(q.method() === 'GET') return r.continue(); onder.push({ m:q.method(), u:q.url(), b:'' }); return r.fulfill({ status:200, contentType:'application/json', body:'{}' }); });
  // jsPDF nagebootst (cdn niet bereikbaar in de test): de teksten worden bewaard in window.__pdf
  await P.route(/jspdf/, r => r.fulfill({ status:200, contentType:'application/javascript', body:`window.jspdf = { jsPDF:function(){ const t = window.__pdf = { tekst:[], paginas:1 }; const n = () => {}; return { setProperties:n, setFont:n, setFontSize:n, setTextColor:n, setDrawColor:n, setFillColor:n, rect:n, roundedRect:n, line:n, addImage:n, addPage(){ t.paginas++; }, text(x){ t.tekst.push([].concat(x).join(' ')); }, splitTextToSize(x){ return [String(x)]; }, output(){ return new ArrayBuffer(8); } }; } };` }));
  await naarContainers(P);
  const kies = await kiesContainer(P, (c, X) => X.invulCodes(c).length);
  if(!kies){ console.log('OVERGESLAGEN: geen container met producten op "Na het lossen"'); console.log('0 OK, 0 FOUT'); await T.b.close(); return; }
  const id = kies.id;
  const info = await P.evaluate(id => { const X = CP_TEST, c = X.cont().find(c => c.id === id), g = X.voortgang(c), pl = X.pools(c), codes = X.invulCodes(c);
    const zonderPorties = pl.order.filter(code => !(c.data.verdeling[code] && c.data.verdeling[code].porties && c.data.verdeling[code].porties.length));
    const doos = codes.filter(code => X.bijLossen(c, code)).map(code => ({ code, d:X.doosVan(c, code), pool:pl.map[code], g:X.geheugen(code) })).filter(x => x.d && x.d.n > 0 && x.d.per > 0 && !x.pool.pallets.length)
      .map(x => ({ code:x.code, n:x.d.n, per:x.d.per, totaalU:x.pool.totaalU, qty:x.g ? x.g.qty : null }));
    return { naam:c.containernummer || c.pakbon_ref || String(c.id), codes, akk:g.akk, nAk:g.nAk, lossen:g.lossen, leeg:zonderPorties.filter(code => X.advies(c, code).porties.length).length, doos, verdeling:JSON.parse(JSON.stringify(c.data.verdeling)) }; }, id);
  console.log('container', id, info.naam, '·', info.codes.length, 'op Na het lossen ·', info.doos.length, 'met dozen');
  await P.evaluate(id => { location.hash = '#/c/' + id + '/verdeling'; }, id); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3000);
  const sum = await P.evaluate(() => document.querySelector('.sumbar').innerText.replace(/\s+/g, ' '));
  const verwacht = info.akk + '/' + info.nAk + ' akkoord' + (info.lossen ? ' · ' + info.lossen + ' bij lossen bepalen' : '');
  check('A: ' + info.naam + ' toont "' + verwacht + '" (uit de eigen data)', new RegExp(esc(verwacht), 'i').test(sum), sum);
  const knop = await P.evaluate(() => { const b = document.querySelector('[data-act="advalles"]'); return b ? b.innerText : ''; });
  check('A: knop "Advies invullen" alleen voor producten met een echt advies (' + info.leeg + ')', info.leeg ? new RegExp('Advies invullen voor ' + info.leeg + ' product').test(knop) : !knop, knop || 'geen knop');
  // B1: invullijst in de losdag-PDF (jsPDF nagebootst: we lezen de teksten)
  await P.click('#lossen [data-act="lltoggle"]'); await P.waitForTimeout(300);
  const lossen = await P.evaluate(() => [...document.querySelectorAll('[data-ll-kaart]')].map(x => x.dataset.llKaart));
  const N = info.codes.length;
  check('B2: blok "Na het lossen (' + N + ')" met ' + N + ' producten', lossen.length === N && new RegExp('Na het lossen \\(' + N + '\\)').test(await P.evaluate(() => document.body.innerText)) && info.codes.every(c => lossen.includes(c)), lossen.join());
  await P.evaluate(id => { location.hash = '#/c/' + id + '/uitvoer'; }, id); await P.waitForSelector('#wbprev', { timeout:60000 });
  const wb = await P.evaluate(() => document.getElementById('wbprev').innerText);
  // werkbon: elk product op "bij lossen bepalen" zegt dat; "nog geen verdeling" alleen bij producten met een advies dat nog niet is ingevuld
  const nLossen = (wb.match(/decide at unloading — see checklist|bij lossen bepalen — zie invullijst/g) || []).length, nGeen = (wb.match(/no plan yet|nog geen verdeling/g) || []).length;
  check('B4: werkbon zegt bij de ' + info.lossen + ' producten "bij lossen bepalen — zie invullijst" (NL of EN); "nog geen verdeling" alleen bij de ' + info.leeg + ' met een open advies', nLossen === info.lossen && nGeen === info.leeg, nLossen + ' bij lossen, ' + nGeen + ' nog geen verdeling');
  await P.evaluate(() => document.querySelector('[data-act="pdfall"]').click()); await P.waitForTimeout(4000);
  const pdf = await P.evaluate(() => (window.__pdf || { tekst:[] }).tekst);
  const i0 = pdf.findIndex(t => /^(Invullijst lossen|Unloading checklist)$/.test(t)), i1 = pdf.findIndex((t, i) => i > i0 && /^Stockmove/.test(t));
  const opLijst = lossen.filter(code => pdf.slice(i0, i1).some(t => t.startsWith(code + ' ')));
  const andere = pdf.slice(i0, i1).filter(t => /^\S+ {3}/.test(t)).map(t => t.split(' ')[0]).filter(c => !lossen.includes(c));
  check('B1: losdag-PDF heeft een invullijst met precies die ' + N + ' producten', i0 > 0 && opLijst.length === N && !andere.length, 'gevonden ' + opLijst.length + (andere.length ? ', extra ' + andere.join() : ''));
  check('B1: velden op de invullijst (geteld, per doos, per pallet, palletmaat, hoogte, gewicht, opmerking)', ['^Counted|^Geteld', 'per box|per doos|per roll|per rol', 'Boxes per pallet|Dozen per pallet|Rolls per pallet|Rollen per pallet', 'Pallet size|Palletmaat', 'Height incl. pallet|Hoogte incl. pallet', 'Weight full pallet|Gewicht volle pallet', 'Note|Opmerking'].every(r => pdf.slice(i0, i1).some(t => new RegExp(r).test(t))));
  const X1 = info.doos[0];
  if(X1){
    check('B1: pakbon "' + X1.n + ' dozen à ' + X1.per + '" (of EN) bij ' + X1.code, pdf.slice(i0, i1).some(t => t.startsWith(X1.code + ' ') || true) && pdf.slice(i0, i1).some(t => new RegExp(esc(nlGetal(X1.n)) + ' (dozen à|boxes of) ' + esc(nlGetal(X1.per))).test(t)));
    // B2: na het lossen invullen: k dozen per pallet (k deelt het aantal dozen, zodat alles in hele pallets gaat)
    const k = [5, 4, 3, 2].find(x => X1.n % x === 0 && X1.n / x >= 1) || X1.n, spp = X1.per * k;
    onder.length = 0;
    await P.evaluate(id => { location.hash = '#/c/' + id + '/verdeling'; }, id); await P.waitForSelector('#lossen', { timeout:60000 });
    if(!(await P.evaluate(() => !!document.querySelector('[data-ll-kaart]')))) await P.click('#lossen [data-act="lltoggle"]');
    const sel = s => `[data-ll-kaart="${X1.code}"] ${s}`;
    await P.selectOption(`#lossen [data-llkeuze="${X1.code}"]`, 'nu'); await P.waitForTimeout(300);
    await P.fill(sel('[data-lk="dpp"]'), String(k)); await P.fill(sel('[data-lk="maat"]'), '80x120');
    await P.click(sel('[data-act="llsave"]')); await P.waitForTimeout(3500);
    const cat = onder.filter(x => /catalog/.test(x.u)).map(x => JSON.parse(x.b)[0]);
    const ean = cat.find(x => x.key === 'catalog-ean'), kopieEerst = cat.length >= 2 && /^catalog-ean-kopie-/.test(cat[0].key) && cat[1].key === 'catalog-ean';
    const rec = ean && Object.values(ean.data).find(x => x && x.sub === X1.code);
    check('B2: eerst een kopie van catalog-ean, dan het productgeheugen (onderschept)', kopieEerst, cat.map(x => x.key).join());
    check('B2: productgeheugen ' + X1.code + ': ' + spp + ' per pallet (' + k + ' dozen à ' + X1.per + '), bron lossen, palletmaat 80x120', rec && rec.lossen && rec.lossen.bron === 'lossen' && +rec.lossen.spp === spp && rec.lossen.maat === '80x120' && (String(rec.qty) === String(spp) || String(rec.qty) === String(X1.qty)), JSON.stringify(rec && { qty:rec.qty, lossen:rec.lossen }));
    const cont = onder.filter(x => /containers/.test(x.u) && x.m === 'PATCH').map(x => JSON.parse(x.b)).pop();
    const vs = cont && cont.data && cont.data.verdeling && cont.data.verdeling[X1.code];
    const somU = vs ? vs.porties.reduce((a, x) => a + (x.soort === 'pallet' ? x.n * x.per : x.n), 0) : 0;
    check('B2: verdeling ' + X1.code + ' = alles verdeeld (' + X1.totaalU + '), nog geen akkoord (onderschept)', vs && !vs.bevestigd && Math.round(somU) === Math.round(X1.totaalU) && (String(rec && rec.qty) !== String(spp) || vs.porties.some(x => x.soort === 'pallet' && +x.per === spp)), JSON.stringify(vs));
    check('B3: ' + X1.code + ' staat daarna niet meer op de invullijst', !(await P.evaluate(c => !!document.querySelector(`[data-ll-kaart="${c}"]`), X1.code)));
    const anders = cont ? Object.keys(info.verdeling).filter(k => k !== X1.code && JSON.stringify(cont.data.verdeling[k]) !== JSON.stringify(info.verdeling[k])) : ['geen opslag'];
    check('Andere verdelingen en akkoorden ongewijzigd', anders.length === 0, anders.join());
  } else console.log('   (geen doosproduct op "Na het lossen" in deze container; invullen-controle overgeslagen)');
  await P.evaluate(id => { location.hash = '#/c/' + id + '/verdeling'; }, id); await P.waitForSelector('#tabbody', { timeout:60000 }); await P.waitForTimeout(800);
  for(const w of [390, 1440]){ await P.setViewportSize({ width:w, height:900 }); await P.waitForTimeout(400); check('Verdeling met invulblok op ' + w + ' px zonder horizontale scroll', await P.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|jsPDF/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT', '| onderschept', onder.length, '| geblokkeerd', T.blocked.length);
  if(T.blocked.length) console.log('FOUT geblokkeerde schrijfpogingen', T.blocked.slice(0, 3));
  await T.b.close();
  process.exit(fout.length || T.blocked.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
