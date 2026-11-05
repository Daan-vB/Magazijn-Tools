// Containers: zelf koppelen (alias, code, EAN, open inkoop). Echte Picqer-gegevens in de database (alleen lezen); tussenstation nagebootst; schrijven onderschept en geteld.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 240) : '')); };
(async () => {
  const mobiel = process.env.VP === '390';
  const T = await start({ vp:mobiel ? { width:390, height:844 } : { width:1440, height:900 }, mobiel });
  const P = T.p;
  // nagebootst tussenstation: open inkoop met referentie
  await P.route(/functions\/v1\/picqer-inkoop/, r => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ orders:[[901, '2026-10-20', 'purchased', 7, [['700625', 500, 0], ['70198-Black', 300, 0]], 'PO2026-009001'], [902, '2026-10-21', 'purchased', 7, [['120150WM', 480, 0], ['90180wm', 520, 0]], 'PO2026-009002']] }) }));
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html#/');
  await P.waitForSelector('.ccard', { timeout:200000 });
  const r = await P.evaluate(async () => {
    const X = CP_TEST, rg = (code, oms, t, extra) => Object.assign({ id:'t' + code, pakbon_code:code, productcode:'', omschrijving:oms || '', aantal:t, per:1, totaal:t, soort:'los', factor:1, match:'onbekend', bevestigd:false }, extra || {});
    const k = (code, oms) => { const x = X.koppel(rg(code, oms, 20), 'Testleverancier zonder aliassen'); return [x.productcode, x.match, x.bevestigd, x.reden].join('|'); };
    const uit = {};
    uit.ean = k('28300501', '5601570700625');
    uit.brushed = k('70198-Brushed', 'fixture brushed');
    uit.eanVrij = k('ZZ-NIETBESTAAND', 'niets 99999999999');
    // open inkoop
    const mk = (regels, ref) => { const c = { id:-5, leverancier:'Ningbo Henri Development Trade Co', pakbon_ref:ref, status:'concept', data:{ regels, verdeling:{}, pakbon:{}, instellingen:{}, punten_eigen:[], punten_klaar:{}, werkbon:{} } }; return c; };
    const orders = [[901, '2026-10-20', 'purchased', 7, [['700625', 500, 0], ['70198-Black', 300, 0]], 'PO2026-009001'], [902, '2026-10-21', 'purchased', 7, [['120150WM', 480, 0], ['90180wm', 520, 0]], 'PO2026-009002'], [903, '2026-10-01', 'completed', 7, [['6090WM', 100, 100]], 'PO2026-009003']];
    const c1 = mk([rg('LEV-X1', 'onbekende leverancierscode', 520)], 'PO2026-009001');   // PO klopt, aantal 520 vs 500 (±10%)
    X.koppelInkoopMet(c1, orders); const a = c1.data.regels[0];
    uit.inkoop = [a.productcode, a.match, a.bevestigd, a.reden].join('|');
    const c2 = mk([rg('LEV-X2', 'onbekend', 500)], 'PO2026-009002');   // twee kandidaten (480 en 520, beide binnen 10%) → oranje
    X.koppelInkoopMet(c2, orders); const b = c2.data.regels[0];
    uit.twee = [b.productcode, b.match, b.bevestigd, b.reden].join('|');
    const c3 = mk([rg('LEV-X3', 'onbekend', 500)], 'PO2026-000000');   // geen passende PO → alleen voorstel
    X.koppelInkoopMet(c3, orders); uit.zonderPO = [c3.data.regels[0].match, c3.data.regels[0].bevestigd].join('|');
    const c4 = mk([rg('LEV-X4', 'onbekend', 100)], 'PO2026-009003');   // order afgerond → niets
    X.koppelInkoopMet(c4, orders); uit.afgerond = c4.data.regels[0].productcode || '';
    // bestaande bevestigde koppelingen ongewijzigd; voorstel dat nu zeker is wordt bevestigd
    const c5 = mk([rg('120150WM', 'whiteboard', 111, { productcode:'120150WM', match:'handmatig', bevestigd:true }), rg('ZJ-007', 'black', 304, { productcode:'ZJ-007', match:'voorstel', bevestigd:false }),
                   rg('70198-Black', 'x', 60, { productcode:'ANDERS-BEVESTIGD', match:'handmatig', bevestigd:true })], null);
    const voor = JSON.stringify(c5.data.regels.map(x => [x.productcode, x.match, x.bevestigd]));
    X.herkoppelRegels(c5);
    uit.bevestigdGelijk = JSON.stringify([c5.data.regels[0], c5.data.regels[2]].map(x => [x.productcode, x.match, x.bevestigd])) === JSON.stringify([JSON.parse(voor)[0], JSON.parse(voor)[2]]);
    uit.voorstelBevestigd = [c5.data.regels[1].productcode, c5.data.regels[1].match, c5.data.regels[1].bevestigd].join('|');
    const c32 = X.cont().find(c => c.id === 32);
    uit.c32 = { open:c32.data.regels.filter(x => !(x.productcode && x.bevestigd)).length, onbekend:c32.data.regels.filter(x => !x.productcode).length,
      k:c32.data.regels.filter(x => ['28300501', '70198-Brushed'].includes(x.pakbon_code)).map(x => [x.pakbon_code, x.productcode, x.match, x.bevestigd].join('|')) };
    uit.alias = ['28300501', '70198brushed'].map(k => (CP_TEST.alias ? CP_TEST.alias() : []).filter(a => a.pakbon_code === k).map(a => a.productcode).join(','));
    return uit;
  });
  console.log(JSON.stringify(r));
  check('28300501 + omschrijving 5601570700625 → 700625 (EAN) bevestigd', /^700625\|ean\|true\|EAN 5601570700625/.test(r.ean), r.ean);
  check('70198-Brushed → 70198Brushed bevestigd', /^70198Brushed\|exact\|true/.test(r.brushed), r.brushed);
  check('getal zonder passend product is geen koppeling', /^\|onbekend\|false/.test(r.eanVrij) || /\|voorstel\|false/.test(r.eanVrij), r.eanVrij);
  check('PO-nummer klopt + aantal binnen 10% + één product → gekoppeld en bevestigd', /^700625\|inkoop\|true\|open inkoop PO2026-009001/.test(r.inkoop), r.inkoop);
  check('twee kandidaten → oranje voorstel, niet bevestigd', /\|voorstel\|false\|.*meer kandidaten/.test(r.twee), r.twee);
  check('zonder passend PO-nummer alleen oranje voorstel', r.zonderPO === 'voorstel|false' || r.zonderPO === 'onbekend|false', r.zonderPO);
  check('afgeronde inkooporder telt niet mee', r.afgerond === '', r.afgerond);
  check('bestaande bevestigde koppelingen ongewijzigd', r.bevestigdGelijk === true);
  check('voorstel met gelijke code wordt bevestigd', r.voorstelBevestigd === 'ZJ-007|exact|true', r.voorstelBevestigd);
  check('container 32: 0 open koppelingen, 0 onbekend; 28300501 → 700625 en 70198-Brushed → 70198Brushed bevestigd', r.c32.open === 0 && r.c32.onbekend === 0 && r.c32.k.includes('28300501|700625|ean|true') === true || (r.c32.open === 0 && r.c32.onbekend === 0 && /700625/.test(r.c32.k.join()) && /70198Brushed/.test(r.c32.k.join())), JSON.stringify(r.c32));
  check('aliassen geleerd: 28300501 → 700625, 70198brushed → 70198Brushed', r.alias[0] === '700625' && r.alias[1] === '70198Brushed', r.alias);
  const sx = await P.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('geen horizontale scroll (' + (mobiel ? '390' : '1440') + ' px)', sx);
  check('0 onbedoelde schrijfpogingen', T.blocked.filter(x => !/^FUNC/.test(x)).length === 0, T.blocked.join(' | '));
  console.log(fout.length ? 'FOUTEN: ' + fout.join('; ') : 'ALLES OK (' + ok.length + ')');
  await T.b.close(); process.exit(fout.length ? 1 : 0);
})();
