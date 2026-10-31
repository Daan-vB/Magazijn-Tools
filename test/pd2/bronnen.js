// CLAUDE.md §3 "Volgorde van bronnen": nooit meerderheid bij de leverancier; palletbewijs gaat vóór kleurgenoten en familie. Plus: Soorten laadt binnen 15 s.
// Echte database alleen lezen; schrijven naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p;
  // Soorten (3.0): de pagina in het frame toont de soorten binnen 15 s
  const t0 = Date.now();
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/soorten');
  let ms = null;
  for(let i = 0; i < 60 && ms === null; i++){ await P.waitForTimeout(500); const fr = P.frames().find(f => f.url().includes('productdata/soort')); const t = fr ? await fr.evaluate(() => document.body.innerText).catch(() => '') : ''; if(/Soorten[\s\S]*Pallet[\s\S]*Deel/.test(t) && !/Productdata laden/.test(t)) ms = Date.now() - t0; }
  check('Soorten laadt binnen 15 s', ms !== null && ms <= 15000, ms === null ? 'niet geladen in 30 s' : (ms / 1000).toFixed(1) + ' s');
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/nakijken');
  await P.waitForFunction(() => window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar && document.querySelector('.x-vraag, .blok'), null, { timeout:240000 });
  const ev = (f, a) => P.evaluate(f, a);
  const lev = await ev(() => ['LC-9R-B', 'SV615V-White-Cushion', 'SL006-500'].filter(c => WH.D.P[c]).map(c => { const I = PD2R.info(c), w = [I.vsSo].concat(Object.entries(I.vs).filter(([k]) => k !== 'mixgroep').map(([, x]) => x)).filter(Boolean).map(x => x.why || '').filter(t => /leverancier/i.test(t)); return { c, so:(I.vsSo || {}).v, why:(I.vsSo || {}).why, lev:w }; }));
  check('LC-9R-B, SV615V-White-Cushion, SL006-500: geen voorstel uit andere producten van de leverancier (mixgroep-naam telt niet: geen vraag)', lev.length === 3 && lev.every(x => !x.lev.length), JSON.stringify(lev));
  const pb = await ev(() => ['FWB100200-GREY', '549-0-120-010'].filter(c => WH.D.P[c]).map(c => { const I = PD2R.info(c); return { c, bewijs:I.bewijs || '', so:(I.vsSo || {}).v, why:(I.vsSo || {}).why }; }));
  check('FWB100200-GREY en 549-0-120-010: Pick tenzij eigen palletbewijs (ook als kleurgenoten Deel of Pallet zijn)', pb.length === 2 && pb.every(x => x.bewijs ? true : (x.so === 'pick' || x.so === 'weg')), JSON.stringify(pb));
  const n = await ev(() => WHX.vraagLijst().length); console.log('VRAGEN', n);
  await ev(() => PD2R.flush()); await P.waitForTimeout(800);
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
