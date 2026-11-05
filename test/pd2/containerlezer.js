// Pakbonlezer: zelfgemaakte voorbeeldregels in dezelfde opbouw als Ningbo Henri (Excel), Xiamen Honorchain (Excel) en Red Sun (PDF). Geen bedrijfsdata.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 260) : '')); };
const S = '   ';
(async () => {
  const T = await start({}), P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html#/');
  await P.waitForSelector('.ccard', { timeout:200000 });
  const nb = ['NINGBO HENRI DEVELOPMENT TRADE', 'INVOICE NO: HR99999', '1. BANISTERS  (PO2026-000001',
    ['AB-1', 'fixture   black', 18, 1080, 'PCS', 4.17, 4503.6].join(S), ['AB-2', 5601570700625, 20, 496, 'PCS', 4.32, 2142.72].join(S),
    ['ZZ-TEST', '730042  black', 17, 510, 'PCS', 2.8, 1428].join(S), ['SB-1', 250, 250, 'PCS', 16.7, 4175].join(S), ['RL-1', '1.0m x5m', 5, 5, 'ROLL', 162, 810].join(S),
    ['EXTRA COST FOR FREIGHT', -1900].join(S), ['INSURANCE CHARGE', 41.55].join(S), ['Sub Total:', 1090, 47258.64].join(S), ['TOTAL：', 1090, 47258.64].join(S)].join('\n');
  const hc = ['Xiamen Honorchain industry', 'INVOICE No.:PO2026-000001', 'CTNS:1*40HQ  SEKU1234567',
    ['2026-000001', 'AAA-1', 'Test set', 1000, 5, '/', 41, 40, 0.04].join(S), ['2026-000001', 'BBB-1 wit set', 'Test set', 500, 2.5, '/', 20.5, 20, 0.02].join(S),
    ['2026-000001', 'CCC-1', 'Test tafel', 350, 70, '/', 980, 945, 4.79].join(S), ['2026-000001', 'DDD-1', 'Test stoel', 100, 100, '/', 310, 275, 1.17].join(S),
    ['', 4228, 1958, 0.8, 10516, 9444.8, 68.7].join(S)].join('\n');
  const rs = ['RED SUN EDUCATION FACILITIES CO.,LTD', 'Inv. No.: 26033-999',
    ['AAA-1', 'Krijtbord zwart', 50, 50, '2.10', '3.70', '0.0301', '105.0', '185.0', '1.51'].join(S),
    ['MBW-X', 'Verrijdbaar whiteboard Premium', 50, '12.20', '14.30', '0.082', '610.0', '715.0', '4.10'].join(S), '50',
    ['MBW-Y', 'Verrijdbaar whiteboard Premium', 50, '25.30', '27.20', '0.050', '1265.0', '1360.0', '2.51'].join(S),
    ['1090', '8098.9', '10722.6', '71.5'].join(S)].join('\n');
  const r = await P.evaluate(([a, b, c]) => { const f = t => { const x = CP_TEST.leesPakbonTekst2(t); return { lev:x.lev, ref:x.ref, regels:x.regels.map(r => [r.pakbon_code, r.aantal, r.per, r.totaal, r.soort].join('/')), geen:x.regels.filter(CP_TEST.isGeenProduct).length, stuks:x.regels.reduce((s, r) => s + r.totaal, 0) }; }; return { nb:f(a), hc:f(b), rs:f(c) }; }, [nb, hc, rs]);
  console.log(JSON.stringify(r));
  check('Ningbo Excel: 5 productregels, geen vracht/verzekering/totaalregels', r.nb.regels.length === 5 && r.nb.geen === 0, r.nb.regels);
  check('Ningbo: EAN en "730042 black" worden niet als aantal gelezen', r.nb.regels.includes('AB-2/20/25/496/los') && r.nb.regels.includes('ZZ-TEST/17/30/510/los'), r.nb.regels);
  check('Ningbo: CTNS = QTY is los (per 1); rollen los', r.nb.regels.includes('SB-1/250/1/250/los') && r.nb.regels.includes('RL-1/5/1/5/los'));
  check('Honorchain: 4 regels, 1950 stuks, dozen/los juist (2,5 doos = los)', r.hc.regels.length === 4 && r.hc.stuks === 1950 && r.hc.regels.includes('AAA-1/5/200/1000/los') && r.hc.regels.includes('BBB-1 wit set/500/1/500/los') && r.hc.regels.includes('CCC-1/70/5/350/los'), r.hc.regels);
  check('Honorchain herkend', /honorchain/i.test(r.hc.lev || ''), r.hc.lev);
  check('Red Sun: regel met aantal dozen op een eigen regel wordt gelezen', r.rs.regels.length === 3 && r.rs.regels.includes('MBW-X/50/1/50/los') && r.rs.regels.includes('MBW-Y/50/1/50/los'), r.rs.regels);
  check('0 geblokkeerde schrijfpogingen', T.blocked.filter(x => !/^FUNC/.test(x)).length === 0, T.blocked.join(' | '));
  console.log(fout.length ? 'FOUTEN: ' + fout.join('; ') : 'ALLES OK (' + ok.length + ')');
  await T.b.close(); process.exit(fout.length ? 1 : 0);
})();
