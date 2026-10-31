// Te controleren (3.0) volgens CLAUDE.md: regels eerst, soort eerst (familiekaart), daarna alleen wat per product open blijft.
// Echte database alleen lezen; schrijven naar een kopie in het geheugen. Schrijft een verslag naar UIT_MAP (niet in de repo).
const { start } = require('./opzet.js');
const fs = require('fs');
const UIT = process.env.UIT_MAP || '.';
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  for(const W of [1440, 390]){
    const T = await start({ vp:{ width:W, height:900 }, mobiel:W < 600 }); const P = T.p;
    await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/nakijken');
    await P.waitForFunction(() => window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar && document.querySelector('.x-vraag'), null, { timeout:240000 });
    const ev = (f, a) => P.evaluate(f, a);
    const v = await ev(() => { const stat = {}, L = WHX.vraagLijst(stat); return { stat, keys:[...new Set(L.map(q => q.k))], n:L.length }; });
    check(W + ' px: alleen vragen die 2.0 stelt; nooit stuks per doos, picklocatie, aanvullen bij, vloernaam, rol zonder keuze', v.n > 0 && v.keys.every(k => ['soort', 'kgst', 'spp', 'maat', 'hoogte', 'maxpick', 'rl', 'rmax'].includes(k)), v.keys.join());
    if(W === 1440){
      // verslag: per regel hoeveel vervielen, wat overblijft, 20 voorbeelden met de reden waarom de data ze niet kon beantwoorden
      const r = await ev(() => { const stat = {}, L = WHX.vraagLijst(stat), wacht = stat.soorteerst || 0;
        const vb = L.slice(0, 400).filter((q, i, a) => a.findIndex(y => y.fam === q.fam) === i).slice(0, 20).map(q => { const w = q.k === 'soort' ? PD2R.soortWaarde(q.c) : PD2R.waarde(q.c, q.k);
          const waarom = q.k === 'soort' ? (w.st === 'twijfel' ? 'twijfel tussen ' + (w.alt || []).join(' / ') + ': ' : 'soort nog niet door Daan bevestigd; voorstel uit de data: ') + (w.why || 'geen voorstel') : (q.v ? 'schatting of regelcontrole, nog niet bevestigd: ' : 'geen bron in de data: ') + (q.uit || w.why || '');
          return q.c + ' · ' + q.k + ' = ' + (q.v || '–') + ' — ' + waarom; });
        return { stat, over:L.length, perVraag:L.reduce((a, q) => (a[q.k] = (a[q.k] || 0) + 1, a), {}), wacht, vb }; });
      const tekst = ['Te controleren volgens CLAUDE.md — ' + new Date().toISOString(), '', 'Vervallen per regel:'].concat(Object.entries(r.stat).map(([k, n]) => '  ' + k + ': ' + n))
        .concat(['', 'Over: ' + r.over + ' vragen nu zichtbaar (' + Object.entries(r.perVraag).map(([k, n]) => k + ' ' + n).join(', ') + '), plus ' + r.wacht + ' die wachten tot de soort is bevestigd.', '', '20 voorbeelden (elk uit een andere familie):']).concat(r.vb.map(x => '  ' + x));
      fs.writeFileSync(UIT + '/tecontroleren-verslag.txt', tekst.join('\n'));
      console.log('VERSLAG', UIT + '/tecontroleren-verslag.txt', '· over', r.over, '· wacht op soort', r.wacht, JSON.stringify(r.stat));
    }
    // soort eerst: de eerste kaart is een familiekaart met per product de voorgestelde soort en vinkjes
    const k1 = await ev(() => { const L = WHX.vraagLijst(), q = L[0], k = document.querySelector('.x-vraag'); return { soort:q.k === 'soort', fam:!!k.dataset.famkaart, rijen:k.querySelectorAll('.x-famrij').length, n:L.filter(y => y.fam === q.fam && y.k === 'soort').length, sel:[...k.querySelectorAll('[data-x="vsoort"]')].map(b => b.dataset.v).join() }; });
    check(W + ' px: eerste kaart = familiekaart (soort) met vinkjes, Selectie klopt en Selectie is: Pallet · Deel · Bulk · Pick · Mix · Weg', k1.soort && k1.fam && k1.rijen === k1.n && k1.sel === 'pallet,deel,bulk,pick,mix,weg', JSON.stringify(k1));
    const n0 = await ev(() => WHX.vraagLijst().length);
    await P.click('.x-vraag [data-x="famklopt"]'); await P.waitForTimeout(2000);
    const n1 = await ev(() => WHX.vraagLijst().length);
    check(W + ' px: Selectie klopt handelt de familie in één klik af, teller loopt af', n1 < n0 && n1 >= n0 - k1.n, n0 + ' → ' + n1);
    // een kaart met een product-vraag toont "soort: … ▾"
    const k2 = await ev(() => { const L = WHX.vraagLijst(), q = L.find(y => y.k !== 'soort'); if(!q) return { geen:true }; L.filter(y => y !== q).forEach(y => WHX.S.later.add(y.c + '|' + y.k)); WHX.herteken(); return { k:q.k, soortw:!!document.querySelector('.x-vraag [data-x2="soortwijzig"]') }; });
    check(W + ' px: productkaart toont "soort: … ▾" om te wijzigen', k2.geen || k2.soortw, JSON.stringify(k2));
    check(W + ' px: geen horizontale scroll', await ev(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await ev(() => PD2R.flush()); await P.waitForTimeout(800);
    check(W + ' px: 0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
    console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
    await T.b.close();
  }
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
})().catch(e => { console.error('CRASH', e); process.exit(1); });
