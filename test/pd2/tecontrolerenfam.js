// Te controleren: familiekaart (soort eerst) — vinkjes, één uitvinken blijft open, Selectie is: Pick zet één soort voor de selectie.
// Echte database alleen lezen; schrijven naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start({ vp:{ width:390, height:844 }, mobiel:true }); const P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/nakijken');
  await P.waitForFunction(() => window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar && document.querySelector('.x-vraag'), null, { timeout:240000 });
  const ev = (f, a) => P.evaluate(f, a);
  // een familie met minstens 3 open soorten
  const fam = await ev(() => { const L = WHX.vraagLijst(), per = {}; L.filter(q => q.k === 'soort').forEach(q => (per[q.fam] = per[q.fam] || []).push(q.c)); const f = Object.entries(per).find(([, cs]) => cs.length >= 3); if(!f) return null; L.filter(q => !(q.fam === f[0] && q.k === 'soort')).forEach(q => WHX.S.later.add(q.c + '|' + q.k)); WHX.herteken(); return f[1]; });
  check('Familiekaart met de producten van de familie, vinkjes standaard aan', !!fam && await ev(n => document.querySelectorAll('.x-famsoort .x-famrij input:checked').length === n, fam.length), JSON.stringify(fam));
  const n0 = await ev(() => WHX.vraagLijst().length), uit = fam[1];
  await P.click(`.x-famrij input[data-code="${uit}"]`); await P.waitForTimeout(200);
  check('Uitvinken: Selectie klopt telt mee', new RegExp('\\(' + (fam.length - 1) + '\\)').test(await ev(() => document.querySelector('[data-x="famklopt"]').textContent)));
  await P.click('.x-famsoort [data-x="vsoort"][data-v="pick"]'); await P.waitForTimeout(2000);
  const na = await ev(([cs, u]) => ({ n:WHX.vraagLijst().length, so:cs.map(c => c + ':' + PD2R.status(c).so + '/' + PD2R.status(c).soSt), open:WHX.vraagLijst().some(q => q.c === u && q.k === 'soort') }), [fam, uit]);
  check('Selectie is: Pick zet Pick voor de aangevinkte (in 2.0), teller loopt af met het aantal', na.so.filter(x => !x.startsWith(uit + ':')).every(x => /:pick\/(bevestigd|aangepast)$/.test(x)) && na.n === n0 - (fam.length - 1), na.so.join() + ' · ' + n0 + ' → ' + na.n);
  check('Niet aangevinkt product blijft open als eigen vraag', na.open);
  check('390 px zonder horizontale scroll', await ev(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await ev(() => PD2R.flush()); await P.waitForTimeout(800);
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
