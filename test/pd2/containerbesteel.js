// Besteel-opbouw: zelfde product op twee regels (264 op 24 pallets + 76 los), pallet-kostenregel is geen product, verdeling rekent met het totaal. Zelfgemaakte voorbeeldregels, geen bedrijfsdata.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 260) : '')); };
const S = '   ';
(async () => {
  const T = await start({ vp:{ width:+(process.env.VP || 1440), height:900 } }), P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html#/');
  await P.waitForSelector('.ccard', { timeout:200000 });
  const pdf = ['LUOYANG BESTEEL CO.,LTD', 'PI NO: BS-T20260101', 'ZZ-TEST-A',
    ['Testmat', '0.50', '12.00', 264, 'US$ 5.00', 'US$ 1320.00'].join(S),
    ['Pallet 960*1120*120 For ZZ-TEST-A', '0.10', '5.00', 24, 'US$ 8.00', 'US$ 192.00'].join(S),
    'ZZ-TEST-A', 'in the container upper space and without pallets',
    ['Testmat', '0.20', '4.00', 76, 'US$ 5.00', 'US$ 380.00'].join(S),
    ['IN TOTAL', 340, '/'].join(S)].join('\n');
  const r = await P.evaluate(pdf => {
    const X = CP_TEST, x = X.leesPakbonTekst2(pdf);
    const regels = x.regels.map(r => [r.pakbon_code, r.totaal, r.per, r.aantal, r.soort].join('/'));
    const kosten = x.regels.filter(X.isGeenProduct).length + x.regels.filter(r => /^pallet\b/i.test(r.pakbon_code + ' ' + r.omschrijving)).length;
    const bouw = window.__bouw = (maxpal, spp, regels) => {
      const code = 'ZZ-TEST-' + Math.random().toString(36).slice(2, 6);
      const c = { id:-7, status:'concept', losdatum:'2099-01-01', data:{ regels:regels.map((g, i) => Object.assign({ id:'t' + i, pakbon_code:code, productcode:code, omschrijving:'t', factor:1 }, g)), verdeling:{}, instellingen:{ maanden:1.5 } } };
      X.ensureData(c);
      return { c, code };
    };
    const uit = {};
    const reg = [{ totaal:264, per:11, aantal:24, soort:'pallet' }, { totaal:76, per:1, aantal:76, soort:'los' }];
    const a = bouw(11, null, reg), b = bouw(null, null, reg);
    window.__t = { a, b };
    return { lev:x.lev, regels, kosten, tot:x.totaal_stuks, som:x.regels.reduce((s, r) => s + r.totaal, 0) };
  }, pdf);
  console.log(JSON.stringify(r));
  check('Lezer: 2 productregels (264 pallets à 11, 76 los), 0 kostenregels, totaal 340', r.regels.length === 2 && r.regels[0] === 'ZZ-TEST-A/264/11/24/pallet' && r.regels[1] === 'ZZ-TEST-A/76/1/76/los' && r.kosten === 0 && r.tot === 340 && r.som === 340, r.regels);
  const v = await P.evaluate(() => {
    const X = CP_TEST, { a, b } = window.__t, bouw = window.__bouw;
    // palletregel maxpal 11 in het productgeheugen (alleen in het geheugen)
    X.zetGeheugen && X.zetGeheugen(a.code, { maxpal:'11' });
    const pa = X.pools(a.c).map[a.code];
    const c2 = bouw(null, null, [{ totaal:264, per:11, aantal:24, soort:'pallet' }, { totaal:76, per:1, aantal:76, soort:'los' }]);
    X.zetGeheugen(c2.code, { qty:'11' });
    const pc = X.pools(c2.c).map[c2.code];
    const pb = X.pools(b.c).map[b.code];
    const ad = X.adviesKern(b.c, pb, X.leegEerder ? X.leegEerder() : { bo:0, hier:0 });
    return { totaal:pa.totaalU, pa:Object.entries(pa.maten).map(([k, n]) => n + 'x' + k).join(' '), losA:pa.losU, bUitleg:ad.uitleg, bPorties:ad.porties.length, spp:Object.entries(pc.maten).map(([k, n]) => n + 'x' + k).join(' '), losC:pc.losU };
  });
  console.log(JSON.stringify(v));
  check('Zonder palletregel: twee regels (pallets + los) → bij lossen bepalen, geen porties', /bij lossen bepalen/.test(v.bUitleg) && v.bPorties === 0, v.bUitleg);
  check('Palletregel maxpal 11: 340 → 30 pallets van 11 + 10 (rest), niet alleen de laatste regel (76)', /30x11/.test(v.pa) && /1x10/.test(v.pa) && v.totaal === 340, v.pa + ' los ' + v.losA);
  check('Stuks per pallet 11 (zoals LM-FA01-Black): 30 pallets van 11 + 10 los', v.spp === '30x11' && v.losC === 10, v.spp + ' los ' + v.losC);
  check('Pool rekent met het totaal van alle regels (340)', v.totaal === 340, v.totaal);
  check('0 geblokkeerde schrijfpogingen', T.blocked.filter(x => !/^FUNC/.test(x)).length === 0, T.blocked.join(' | '));
  console.log(fout.length ? 'FOUTEN: ' + fout.join('; ') : 'ALLES OK (' + ok.length + ')');
  await T.b.close(); process.exit(fout.length ? 1 : 0);
})();
