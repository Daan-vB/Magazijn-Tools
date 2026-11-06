// Containers voor Karin: pakbon lezen per leverancier met sluitende controle, Great Wall koppelen op maat, statusbalk, Voor Daan, één klik Alles akkoord.
// Testregels zelf gemaakt in dezelfde opbouw als de echte pakbonnen (geen bedrijfsdata). Echte database alleen lezen; elke schrijfpoging onderschept.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 260) : '')); };
const S = '   ', J = a => a.join(S);
// ---------- testpakbonnen ----------
const GW_RIJEN = [['Black SBR rubber Sheet', 1, 1.4, 10, 30, 21], ['Black SBR rubber Sheet', 2, 1.4, 10, 20, 42], ['Black SBR rubber Sheet', 3, 1.4, 10, 30, 63], ['Black NBRrubber Sheet(NBR)', 3, 1.4, 10, 20, 63],
  ['Black Wide Ribbed rubber Sheet', 3, 1, 10, 13, 42], ['Black Wide Ribbed rubber Sheet', 6, 1, 10, 3, 84], ['Black Fine Ribbed rubber Sheet', 3, 1, 10, 60, 37.5], ['Black Fine Ribbed rubber Sheet', 3, 1.8, 10, 8, 78.3],
  ['Black Willow rubber Sheet', 3, 1.5, 10, 9, 63], ['Black TearDrop rubber Sheet(checker)', 3, 1.4, 10, 5, 58.8], ['Black Mini Diamond rubber Sheet', 3, 1.2, 10, 4, 54], ['Black Rice Design rubber Sheet(orange peal)', 3, 1.5, 10, 13, 63],
  ['Black Stud rubber Sheet', 3, 1.2, 10, 30, 50.4], ['Trailer Mat', 10, 1.22, 1.83, 100, 27.91], ['Trailer Mat', 17, 1, 2, 60, 42.5], ['HAMER BLOW MATS', 6, 1.8, 10, 7, 156.6], ['HAMER BLOW MATS', 6, 2, 10, 7, 174]];
const gw = rijen => ['SANHE GREAT WALL RUBBER CO., LTD.', 'S/C No.: GW2099-TEST', J(['Item', 'Size', 'Thickness', 'Width', 'Length', 'Quantity', 'kg/roll', 'Total weight'])]
  .concat(rijen.map(([n, mm, b, l, q, kg]) => J([n, mm + 'mm x' + b + 'm x ' + l + 'm', mm, b, l, q, kg, Math.round(q * kg)])))
  .concat([J(['SUM', 419, 9999])]).join('\n');
const NB_RIJEN = [[18, 1080], [17, 1020], [5, 193], [20, 496], [17, 510], [35, 1050], [250, 250], [15, 300], [38, 304], [5, 5], [5, 5], [16, 16], [10, 10], [6, 6], [111, 111], [90, 90], [34, 34], [129, 129], [1, 1], [48, 48], [220, 220]];
const nb = rijen => ['NINGBO HENRI DEVELOPMENT TRADE', 'INVOICE NO: HR99999', '1. TESTGOED  (PO2099-000001']
  .concat(rijen.map(([c, q], i) => J(['NB-' + (i + 1), 'testomschrijving', c, q, 'PCS', 1.5, (q * 1.5).toFixed(1)])))
  .concat([J(['EXTRA COST FOR FREIGHT', -1900]), J(['INSURANCE CHARGE', 41.55]), J(['Sub Total:', 1090, 47258.6]), J(['TOTAL：', 1090, 47258.6])]).join('\n');
const RS_RIJEN = [50, 84, 15, 50, 25, 50, 116, 150, 200, 50, 50, 50, 50, 50, 50];
const rs = rijen => ['RED SUN EDUCATION FACILITIES CO.,LTD', 'Inv. No.: 26099-001']
  .concat(rijen.map((q, i) => J(['RS-' + (i + 1), 'Testbord ' + (i + 1), q, q, '2.10', '3.70', '0.0301', '105.0', '185.0', '1.51'])))
  .concat([J(['MBW-T', 'Testbord verrijdbaar', 50, '12.20', '14.30', '0.082', '610.0', '715.0', '4.10']), '50', J(['1090', '8098.9', '10722.6', '71.5'])]).join('\n');
const wl = (ref, rijen, totS, totE) => ['WALLACE LANGFORD & ASSOCIATES', 'PACKING LIST ' + ref, 'CONTAINER # TEST1234567']
  .concat(rijen.map(([t, p, a], i) => (i + 1) + ' TEST MAT ' + String.fromCharCode(65 + i) + ' RUBBER ' + t + ' ' + p + ' ' + a + ' ' + (i + 1) + '-' + (i + a) + ' 10.0 ' + (p * 12) + '.0 ' + (p * 12 * a) + '.0 1.2'))
  .concat(['TOTAL ' + totS + ' ' + totE]).join('\n');
const WL306 = [[100, 100, 1], [100, 50, 2], [24, 12, 2], [300, 50, 6], [180, 20, 9], [2, 1, 2], [6, 6, 1], [6, 6, 1], [12, 12, 1], [4, 1, 4], [24, 12, 2], [300, 100, 3], [150, 150, 1]];
const WL305 = [[150, 50, 3], [55, 55, 1], [350, 50, 7], [240, 120, 2], [95, 95, 1], [80, 80, 1], [86, 86, 1], [200, 100, 2], [650, 50, 13], [7, 1, 7]];
const HC = [[1000, 5], [500, 2.5], [500, 2.5], [50, 50], [100, 100], [100, 100], [400, 400], [200, 200], [350, 70], [100, 100], [100, 100], [100, 100], [50, 50], [100, 100], [78, 78], [200, 200], [100, 100], [50, 50], [50, 50], [100, 100]];
const hc = rijen => ['Xiamen Honorchain industry', 'INVOICE No.:PO2099-000001', 'CTNS:1*40HQ  TEST1234567']
  .concat(rijen.map(([q, c], i) => J(['2099-000001', 'HC-' + (i + 1), 'Testartikel ' + (i + 1), q, c, '/', 10, 9, 0.1])))
  .concat([J(['4228', '1958', '0.8', '10516', '9444.8', '68.7'])]).join('\n');
const TD = [[1, 50], [1, 50], [12, 1140], [6, 300], [4, 1200], [12, 804], [8, 536]];
const td = rijen => ['QINGDAO TODO RUBBER CO., LTD', 'Shipping Mark   Container No']
  .concat(rijen.map(([p, q], i) => J(['TEST ARTIKEL ' + (i + 1), p + ' PKG', q + ' pcs', (q * 2) + ' kgs', (q * 2 + 20) + ' kgs'])))
  .concat([J(['TOTAL', '44 PKG', '4080 pcs', '9000 kgs', '9200 kgs'])]).join('\n');
const PAKBONNEN = [
  ['Great Wall 419 rollen', gw, GW_RIJEN, /419 rollen/], ['Ningbo HR 1090 colli (5.878 st)', nb, NB_RIJEN, /1\.090 colli/], ['Red Sun 1090', rs, RS_RIJEN, /1\.090 colli/],
  ['Wallace NL-306 1208', r => wl('NL-306', r, 1208, 35), WL306, /1\.208 stuks/], ['Wallace NL-305 1913', r => wl('NL-305', r, 1913, 38), WL305, /1\.913 stuks/],
  ['Honorchain 4228', hc, HC, /4\.228 stuks/], ['Todo 4080', td, TD, /4\.080 stuks/]];
(async () => {
  const mobiel = process.env.VP === '390';
  const T = await start({ vp:mobiel ? { width:390, height:844 } : { width:1440, height:900 }, mobiel }), P = T.p;
  const onder = [];
  await P.route(/supabase\.co\/(rest\/v1\/containers|rest\/v1\/pakbon_alias|storage\/v1\/object\/pakbonnen)/, async r => {
    const q = r.request(), m = q.method(), u = q.url();
    if(m === "GET" && /rest\/v1\/(containers|pakbon_alias)/.test(u)) return r.continue();
    onder.push(m + ' ' + u.slice(0, 80));
    if(m === 'POST' && /rest\/v1\/containers/.test(u)){ const b = JSON.parse(q.postData() || '[]')[0] || {}; return r.fulfill({ status:201, contentType:'application/json', body:JSON.stringify([Object.assign({ id:99001, updated_at:new Date().toISOString() }, b)]) }); }
    if(m === 'PATCH') return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([{ id:99001, updated_at:new Date().toISOString() }]) });
    return r.fulfill({ status:200, contentType:'application/json', body:'{}' });
  });
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html#/');
  await P.waitForSelector('.ccard', { timeout:200000 });
  // 1. sluitende controle per referentiepakbon; een bewust gedropte regel geeft rood
  const res = await P.evaluate(lijst => lijst.map(([naam, tekst, tekstMin]) => { const a = CP_TEST.leesControle(tekst), b = CP_TEST.leesControle(tekstMin); return { naam, a, b }; }),
    PAKBONNEN.map(([naam, f, rijen]) => [naam, f(rijen), f(rijen.slice(1))]));
  res.forEach((x, i) => {
    check(x.naam + ': controle groen', x.a.ok && x.a.heeft && PAKBONNEN[i][3].test(x.a.tekst), JSON.stringify(x.a));
    check(x.naam + ': één regel minder = rood', !x.b.ok && /ontbreken/.test(x.b.tekst), x.b.tekst);
  });
  check('Ningbo: vracht, verzekering en totaal worden geen regel; 5.878 stuks', res[1].a.regels === 21 && res[1].a.stuks === 5878, JSON.stringify(res[1].a));
  // 2. Great Wall op maat (zonder geleerde alias) tegen de Picqer-kopie
  const gwk = await P.evaluate(() => {
    const X = CP_TEST, k = t => { const r = { pakbon_code:t, omschrijving:t, totaal:1, per:1, aantal:1 }; const x = X.koppel(r, 'Sanhe Great Wall Rubber Co., Ltd.'); return [x.productcode, x.match, x.bevestigd, (x.kandidaten || []).join(',')].join('|'); };
    const heeft = c => !!CP_TEST.heeftProduct(c);
    return { sbr1:k('SBR sheet black 1mm x1.4m x 10m nieuw'), sbr2:k('SBR sheet black 2mm x1.4m x 10m nieuw'), nbr3:k('NBR sheet black 3mm x1.4m x 10m nieuw'), trailer:k('Trailer Mat nieuw 10mm x1.22m x 1.83m'),
      p:{ RP0100:heeft('RP0100'), RP0200:heeft('RP0200'), RPNBR0300:heeft('RPNBR0300') } };
  });
  console.log('   GW:', JSON.stringify(gwk));
  if(gwk.p.RP0100) check('Great Wall "1mm x1.4m x 10m SBR" → RP0100 (zeker)', /^RP0100\|maat\|true/.test(gwk.sbr1), gwk.sbr1);
  if(gwk.p.RP0200) check('Great Wall "2mm" → RP0200 (zeker)', /^RP0200\|maat\|true/.test(gwk.sbr2), gwk.sbr2);
  if(gwk.p.RPNBR0300) check('Great Wall "3mm x1.4m NBR" → RPNBR0300 (zeker)', /^RPNBR0300\|maat\|true/.test(gwk.nbr3), gwk.nbr3);
  // 2b. geleerd van Great Wall container 8: elke bevestigde regel heeft een alias; een iets andere tekst met dezelfde maat koppelt via die alias
  const c8 = await P.evaluate(() => { const X = CP_TEST, c = X.cont().find(c => c.id === 8); if(!c) return null; const al = X.alias(), n = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const zonder = c.data.regels.filter(r => r.bevestigd && !al.some(a => a.leverancier === c.leverancier && a.pakbon_code === n(r.pakbon_code) && a.productcode === r.productcode)).map(r => r.pakbon_code);
    const v = X.koppel({ pakbon_code:'Willow rubber sheet black 3mm x 1.5m x 10m', omschrijving:'', totaal:1, per:1, aantal:1 }, c.leverancier);
    return { zonder, v:[v.productcode, v.match, v.bevestigd, v.factor].join('|') }; });
  if(c8){ check('container 8: elke bevestigde regel heeft een geleerde alias', c8.zonder.length === 0, c8.zonder.join(', '));
    check('Great Wall: andere tekst, zelfde maat → geleerde koppeling (RTDIAM0315, factor 10)', /^RTDIAM0315\|maat\|true\|10$/.test(c8.v), c8.v); }
  await P.evaluate(() => { location.hash = '#/voordaan'; }); await P.waitForTimeout(1500);
  const vdl = await P.evaluate(() => document.body.innerText);
  check('Voor Daan toont producten die bij een geloste container op bij lossen bepalen bleven', /bleef bij lossen bepalen/.test(vdl) || !/GW2026-BH013/.test(vdl), (vdl.match(/.{0,60}bleef bij lossen.{0,60}/) || [''])[0]);
  await P.evaluate(() => { location.hash = '#/'; }); await P.waitForTimeout(1500);
  // 3. onbekend product → Voor Daan, niet bij Karin
  const vd = await P.evaluate(() => {
    const X = CP_TEST, c = X.ensureData({ id:-77, leverancier:'Testleverancier zonder aliassen', status:'concept', data:{ regels:[{ id:'q1', pakbon_code:'ZQXW-PLORK', omschrijving:'qzxw vbnm', totaal:5, per:1, aantal:5, soort:'los', factor:1, productcode:'', match:'onbekend', bevestigd:false }] } });
    const d = document.createElement('div'); d.innerHTML = X.statusBalkTest(c);
    return { daan:X.voorDaan(c).map(x => x.reden), karin:d.innerText.replace(/\s+/g, ' ') };
  });
  check('onbekend product staat bij Voor Daan', vd.daan.some(x => /Nieuw product/.test(x)), JSON.stringify(vd.daan));
  check('onbekend product is geen melding voor Karin', !/niet herkend|Kies/.test(vd.karin), vd.karin);
  // 4. Karin-stroom: pakbon inlezen (startscherm) → container → groene controle → Alles akkoord → Uitvoer, zonder iets te typen
  let typ = 0; await P.exposeFunction('__typ', () => typ++); await P.evaluate(() => document.addEventListener('keydown', () => window.__typ(), true));
  await P.setInputFiles('input[data-change="pakbonnenBulk"]', { name:'GW2099-TEST paklijst.txt', mimeType:'text/plain', buffer:Buffer.from(gw(GW_RIJEN)) });
  await P.waitForFunction(() => CP_TEST.cont().some(c => c.id === 99001 && (c.data.regels || []).length), null, { timeout:60000 });
  await P.evaluate(() => { location.hash = '#/c/99001/pakbon'; }); await P.waitForSelector('.statusbalk', { timeout:30000 }); await P.waitForTimeout(800);
  const s1 = await P.evaluate(() => document.querySelector('.statusbalk').innerText.replace(/\s+/g, ' '));
  check('Karin: statusbalk toont "Pakbon klopt: 419 rollen"', /Pakbon klopt: 419 rollen, 17 regels/.test(s1), s1);
  const vraag = await P.evaluate(() => [...document.querySelectorAll('input[data-pk], select[data-pk]')].filter(e => e.offsetParent !== null).length);
  check('Karin: geen productvraag in beeld (omrekening, gewicht, palletdata)', vraag === 0, vraag);
  const sx1 = await P.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('pakbonstap zonder horizontaal scrollen (' + (mobiel ? 390 : 1440) + ' px)', sx1);
  const knop = await P.$('.statusbalk [data-act="akkalles"]');
  const allesBev = await P.$('.statusbalk [data-act="allesbev"]');
  if(allesBev){ await allesBev.click(); await P.waitForTimeout(800); }
  const knop2 = await P.$('.statusbalk [data-act="akkalles"]');
  if(knop2){ await knop2.click(); await P.waitForTimeout(1500); }
  const h = await P.evaluate(() => location.hash);
  const s2 = await P.evaluate(() => (document.querySelector('.statusbalk') || {}).innerText || '');
  check('Karin: Alles akkoord → direct naar Uitvoer, balk groen', /uitvoer$/.test(h) && /Klaar/.test(s2), h + ' | ' + s2.replace(/\s+/g, ' ').slice(0, 200));
  const sx2 = await P.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('uitvoer zonder horizontaal scrollen', sx2);
  check('Karin heeft niets getypt', typ === 0, typ);
  check('0 echte schrijfacties (alles onderschept: ' + onder.length + ')', T.blocked.filter(x => !/^FUNC/.test(x)).length === 0, T.blocked.join(' | '));
  console.log(fout.length ? 'FOUTEN: ' + fout.join('; ') : 'ALLES OK (' + ok.length + ')');
  await T.b.close(); process.exit(fout.length ? 1 : 0);
})();
