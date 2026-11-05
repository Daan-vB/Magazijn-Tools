// Pakbonnen controleren: aantal-controle bij het inlezen (gele melding "aantal nakijken") en de herstelde regels in de echte database (alleen lezen).
const { start } = require('./opzet.js');
const RXs = '/sub\\s*total|\\btotal\\b|\\btotaal\\b|say\\s+total|extra\\s+cost|freight|insurance|\\bcharge\\b|discount/i';
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 220) : '')); };
(async () => {
  const T = await start({}), P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html#/');
  await P.waitForSelector('.ccard', { timeout:200000 });
  const r = await P.evaluate((RXs) => {
    const RX = eval(RXs);
    const X = CP_TEST, rg = (code, oms, a, per, t) => ({ pakbon_code:code, productcode:code, omschrijving:oms, aantal:a, per, totaal:t, soort:'pallet', factor:1 });
    const norm = [rg('A1', 'a', 2, 50, 100), rg('A2', 'b', 3, 20, 60), rg('A3', 'c', 4, 10, 40), rg('A4', 'd', 5, 10, 50)];
    const kwaad = rg('7295163', '730042 black', 730042, 17, 12410714);
    const uit = X.aantalNakijken(norm.concat([kwaad]));
    const fake = { id:-1, status:'concept', data:{ regels:norm.concat([kwaad]) }, losdatum:'2099-01-01' };
    X.ensureData(fake);
    const pts = X.punten(fake, X.pools(fake)).filter(p => p.type === 'aantal');
    const ean = X.aantalNakijken([rg('28300501', '5601570700625 desk', 5601570700625, 20, 1)]);
    const schoon = X.aantalNakijken(norm);
    const hy = X.aantalNakijken([rg('IVB', '2026-002539 IVB120150BL/43011-1 mat', 1, 200, 200)]);
    const tot = X.aantalNakijken(norm.concat([{ pakbon_code:'Sub Total:', productcode:'', omschrijving:'', aantal:1090, per:47258, totaal:51511917, soort:'pallet', factor:1 }]));
    const co = X.cont(), c32 = co.find(c => c.id === 32);
    return { nKwaad:uit.size, geel:pts.length, lvl:pts[0] && pts[0].lvl, tekst:pts[0] && pts[0].tekst, ean:ean.size, schoon:schoon.size, hy:hy.size, tot:tot.size,
      groot:co.flatMap(c => (c.data.regels || []).filter(x => (x.aantal || 0) > 5000).map(x => c.id + ':' + x.pakbon_code)),
      st:(() => { const g = id => co.find(c => c.id === id), R = id => (g(id).data.regels || []), som = (id, k) => R(id).reduce((a, x) => a + (x[k] || 0), 0);
        const nl = co.find(c => c.pakbon_ref === 'NL-305'), td = co.find(c => (c.containernummer || '').includes('CAAU3043303'));
        return { c32:[R(32).length, som(32, 'aantal'), R(32).some(x => RX.test(x.pakbon_code + ' ' + x.omschrijving) || x.productcode === 'Extra'), JSON.stringify(R(32).filter(x => x.pakbon_code === '28300501').map(x => [x.aantal, x.per, x.totaal, x.productcode, x.soort])), R(32).filter(x => /^ST/.test(x.pakbon_code)).every(x => x.soort === 'los' && x.per === 1)],
          c29:[R(29).length, som(29, 'totaal')], c30:[R(30).length, som(30, 'totaal')], d:nl && [R(nl.id).length, som(nl.id, 'totaal'), nl.losdatum, nl.status], f:td && [R(td.id).length, som(td.id, 'totaal'), td.losdatum, td.leverancier],
          geen:co.flatMap(c => (c.data.regels || []).filter(x => RX.test(x.pakbon_code + ' ' + x.omschrijving) || (x.aantal || 0) < 0).map(x => c.id + ':' + x.pakbon_code)) }; })(),
      r7295163:c32.data.regels.filter(x => x.pakbon_code === '7295163').map(x => x.aantal + 'x' + x.per + '=' + x.totaal) };
  }, RXs);
  check('regel "730042 black" geeft melding aantal nakijken', r.nKwaad === 1 && r.geel === 1, JSON.stringify(r));
  check('melding is geel/info, geen fout', r.lvl === 'info', r.lvl);
  console.log('   tekst:', r.tekst);
  check('EAN in omschrijving als aantal geeft melding', r.ean === 1);
  check('normale regels, hyphen-nummers en totaalregels geven geen melding', r.schoon === 0 && r.hy === 0 && r.tot === 0, [r.schoon, r.hy, r.tot]);
  check('container 32: 7295163 heeft 17×30=510 en 35×30=1050', JSON.stringify(r.r7295163) === JSON.stringify(['17x30=510', '35x30=1050']), r.r7295163);
  check('geen regel > 5000 dozen in welke container ook', r.groot.length === 0, r.groot);
  const st = r.st;
  check('container 32: 21 productregels, 1090 colli, geen EXTRA COST/INSURANCE/Total, 28300501 20 dozen à 25 gekoppeld, rollen los', st.c32[0] === 21 && st.c32[1] === 1090 && !st.c32[2] && st.c32[3] === '[[20,25,496,"700625","los"]]' && st.c32[4], JSON.stringify(st.c32));
  check('container 29: 16 regels, 1090', st.c29[0] === 16 && st.c29[1] === 1090, st.c29);
  check('container 30: 20 regels, 4228 stuks', st.c30[0] === 20 && st.c30[1] === 4228, st.c30);
  check('nieuwe container D (NL-305): 1913, concept, geen losdatum (Nog geen ETA)', st.d && st.d[1] === 1913 && !st.d[2] && st.d[3] === 'concept', st.d);
  check('nieuwe container F (Todo): 4080, geen losdatum', st.f && st.f[1] === 4080 && !st.f[2], st.f);
  check('geen enkele totaalregel/negatieve regel meer', st.geen.length === 0, st.geen);
  check('0 geblokkeerde schrijfpogingen', T.blocked.filter(x => !/^FUNC/.test(x)).length === 0, T.blocked.join(' | '));
  console.log(fout.length ? 'FOUTEN: ' + fout.join('; ') : 'ALLES OK (' + ok.length + ')');
  await T.b.close(); process.exit(fout.length ? 1 : 0);
})();
