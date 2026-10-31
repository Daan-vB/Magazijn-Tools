// Soort Bulk in Warehouse 3.0 (aanvullen): geen picklocatie-voorstel, geen aanvulniveau uit productdata. Echte database alleen lezen; soort Bulk alleen in het geheugen gezet.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/nakijken');
  await P.waitForFunction(() => window.WHL && window.WH && window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar, null, { timeout:240000 });
  const r = await P.evaluate(() => {
    const D = WH.D; WHL.reset(); const C = WHL.bereken();
    // lopers zonder picklocatie met bulk, waar de app nu een picklocatie voorstelt
    const kand = Object.values(C.prof).filter(p => !p.picks.length && p.bulks.length && !p.alleenBulk && p.voorstel.loper).map(p => p.code).slice(0, 5);
    const metPick = Object.values(C.prof).find(p => p.picks.length === 1 && !p.alleenBulk);
    const zet = [...kand, metPick && metPick.code].filter(Boolean);
    zet.forEach(c => { D.PD[c] = Object.assign({}, D.PD[c] || {}, { opslag:'bulk', lvl:'10', maxpick:'77' }); });
    WHL.reset(); const C2 = WHL.bereken();
    const uit = kand.map(c => { const p = C2.prof[c]; return { c, pick:p.final.pick, type:p.final.type, lvl:p.final.lvl, uitPd:!!p.final.uitPd, r:p.redenen.map(x => x.t).join(' | ') }; });
    const mp = metPick ? C2.prof[metPick.code] : null;
    return { kand, uit, mp:mp && { c:mp.code, uitPd:!!mp.final.uitPd, r:mp.redenen.map(x => x.t).join(' | ') } };
  });
  check('kandidaten gevonden (zonder pick, met bulk, loper)', r.kand.length > 0, r.kand.join());
  check('soort Bulk: geen nieuwe picklocatie, type bulk', r.uit.every(x => !x.pick && x.type === 'bulk'), JSON.stringify(r.uit.slice(0, 2)));
  check('soort Bulk: reden "Productdata: soort Bulk"', r.uit.every(x => /soort Bulk/.test(x.r)));
  check('soort Bulk mét picklocatie: geen aanvulniveau uit productdata, wel melding', r.mp && !r.mp.uitPd && /soort Bulk.*picklocatie/.test(r.mp.r), JSON.stringify(r.mp));
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
