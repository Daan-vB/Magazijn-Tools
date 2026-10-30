// Te controleren (3.0) → Productdata: één vraag tegelijk, alleen wat Productdata 2.0 vraagt. Echte database alleen lezen; schrijven naar een kopie in het geheugen.
const { start, open } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  for(const W of [1440, 390]){
    const T = await start({ vp:{ width:W, height:900 }, mobiel:W < 600 }); const P = T.p;
    await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/nakijken');
    await P.waitForFunction(() => window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar && document.querySelector('.x-vraag'), null, { timeout:240000 });
    const ev = (f, a) => P.evaluate(f, a);
    const alle = await ev(() => WHX.vraagLijst().map(q => q.k));
    check(W + ' px: alleen vragen die Productdata 2.0 ook stelt (geen stuks per doos, picklocatie, aanvullen bij, vloernaam)', alle.length > 0 && alle.every(k => ['opslag', 'kgst', 'spp', 'maat', 'hoogte', 'maxpick', 'rol', 'rl', 'rmax'].includes(k)), [...new Set(alle)].join());
    check(W + ' px: één kaart met één vraag en bovenaan "nog n vragen"', await ev(() => document.querySelectorAll('.x-vraag').length === 1 && document.querySelectorAll('.x-vraag .x-q').length === 1 && /^nog \d+ vragen?$/.test(document.querySelector('.x-nog').textContent.trim())));
    const volg = await ev(() => { const L = WHX.vraagLijst(); return L.slice(0, 40).map(q => /^[AB]$/.test((WH.D.P[q.c] || {}).abc || '') ? 'AB' : 'C'); });
    check(W + ' px: A/B eerst', volg.indexOf('C') < 0 || volg.slice(volg.indexOf('C')).every(x => x === 'C'));
    // Kokos 100 cm zwart: alle andere vragen even op later
    await ev(() => { WHX.vraagLijst().filter(q => q.c !== '145-0-100-007').forEach(q => WHX.S.later.add(q.c + '|' + q.k)); WHX.herteken(); });
    const k = await ev(() => ({ code:(document.querySelector('.x-vraag') || {}).dataset?.code, tekst:(document.querySelector('.x-vraag') || {}).innerText || '', n:document.querySelector('.x-nog') && document.querySelector('.x-nog').textContent }));
    check(W + ' px: Kokos 100 cm zwart (145-0-100-007) toont één vraag, geen "Stuks per doos"', k.code === '145-0-100-007' && !/Stuks per doos/i.test(k.tekst), k.tekst.replace(/\n+/g, ' | ').slice(0, 160) + ' · ' + k.n);
    const n0 = +String(k.n).match(/\d+/)[0];
    await P.click('.x-vraag [data-x="vklopt"]'); await P.waitForTimeout(1500);
    const na = await ev(() => ({ n:document.querySelector('.x-nog') ? +document.querySelector('.x-nog').textContent.match(/\d+/)[0] : 0, q:document.querySelector('.x-vraag') ? document.querySelector('.x-vraag').dataset.k : '' }));
    check(W + ' px: Klopt gaat meteen door naar de volgende vraag, teller loopt af', na.n === n0 - 1, n0 + ' → ' + na.n + ' (' + na.q + ')');
    check(W + ' px: Kokos "Is dit een rol?" telt ook in Productdata 2.0 (zelfde opslag)', await ev(() => { const p = PD2R.po('145-0-100-007'); return !!(p && p.rol && p.rol.v === true); }));
    check(W + ' px: geen horizontale scroll', await ev(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await ev(() => PD2R.flush()); await P.waitForTimeout(800);
    check(W + ' px: 0 geblokkeerde schrijfpogingen (alleen wh-pd2-* en productdata, naar een kopie)', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
    if(W === 1440) console.log('VRAGEN TOTAAL', alle.length);
    console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
    await T.b.close();
  }
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
})().catch(e => { console.error('CRASH', e); process.exit(1); });
