// Soort Bulk (Daan 31-10): pallet alleen op bulk, geen picklocatie; vragen gewicht en palletvragen, geen max op pick, nooit aanvuladvies. Echte database alleen lezen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/nakijken');
  await P.waitForFunction(() => window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar && document.querySelector('.x-vraag'), null, { timeout:240000 });
  const ev = (f, a) => P.evaluate(f, a);
  check('Soorten: Pallet · Deel · Bulk · Pick · Mix · Weg', await ev(() => PD2R.SOORTEN.map(x => x[0]).join() === 'pallet,deel,bulk,pick,mix,weg'));
  const sp = await ev(() => Object.keys(WH.D.P).filter(c => /sprinttrack/i.test(PD2R.naamVan(c)) && PD2R.actief(c) && !PD2R.isKoppel(c)).map(c => { const I = PD2R.info(c); return { c, bulk:PD2R.som(I.f.bulk), pick:I.f.pick.length, vs:(I.vsSo || {}).v, so:PD2R.status(c).so }; }));
  const kand = sp.filter(x => x.bulk > 0 && !x.pick);
  check('Sprinttrack kunstgras met bulk en zonder picklocatie: voorstel Bulk', kand.length > 0 && kand.every(x => x.vs === 'bulk' || (x.vs === 'weg')), JSON.stringify(sp.slice(0, 8)));
  const n = await ev(() => { const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isKoppel(c) && !PD2R.isSam(c) && !PD2R.isRol(c) && PD2R.info(c).bewijs); const I = PD2R.info(c); return { c, nodig:PD2R.nodigVan(c, 'bulk', I).join(), zonder:PD2R.nodigVan(Object.keys(WH.D.P).find(x => PD2R.actief(x) && !PD2R.isKoppel(x) && !PD2R.isSam(x) && !PD2R.isRol(x) && !PD2R.info(x).bewijs), 'bulk').join() }; });
  check('Bulk: stap 3 alleen stuks per pallet, palletmaat, hoogte (geen max op pick); zonder palletbewijs niets', n.nodig === 'spp,maat,hoogte' && n.zonder === '', JSON.stringify(n));
  const b = await ev(() => { const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isKoppel(c) && PD2R.status(c).so === 'bulk'); if(!c) return null; const I = PD2R.info(c); return { c, max:I.vs.maxpick, lvl:I.vs.lvl, vragen:WHX.vraagLijst().filter(q => q.c === c).map(q => q.k).join() }; });
  check('Bulk-product: geen voorstel voor max op pick of aanvullen bij, geen vraag max op pick', b && !b.max && !b.lvl && !/maxpick/.test(b.vragen), JSON.stringify(b));
  const kn = await ev(() => [...document.querySelectorAll('.x-vraag [data-x="vsoort"]')].map(x => x.dataset.v).filter(v => !/:/.test(v)).join());
  check('Te controleren: soortknoppen met Bulk', !kn || /^pallet,deel,bulk,pick,mix,weg$/.test(kn), kn);
  await ev(() => PD2R.flush()); await P.waitForTimeout(800);
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
