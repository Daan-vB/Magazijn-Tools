// Vaste regel (Daan 30-10): palletvragen alleen met bewijs voor pallets; soort eerst in Te controleren. Echte database alleen lezen; schrijven naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/nakijken');
  await P.waitForFunction(() => window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar && document.querySelector('.x-vraag'), null, { timeout:240000 });
  const ev = (f, a) => P.evaluate(f, a);
  const rp = await ev(() => ['RPEPDM0400', 'RPEPDM0500', 'RPEPDM0600', 'RPEPDM1000'].map(c => { const I = PD2R.info(c), so = PD2R.status(c).so; return { c, bewijs:I.bewijs || '', vs:(I.vsSo || {}).v, nodig:PD2R.nodigVan(c, so, I).join(), vragen:WHX.vraagLijst().filter(q => q.c === c).map(q => q.k).join() }; }));
  check('RPEPDM0400–1000: geen hoogte-vraag, soort-voorstel Pick, geen palletvragen in 2.0', rp.every(x => !x.bewijs && x.vs === 'pick' && !/hoogte|spp|maat/.test(x.vragen) && !/hoogte|spp|maat/.test(x.nodig)), JSON.stringify(rp));
  const vst = await ev(() => { const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isKoppel(c) && !PD2R.isSam(c) && !PD2R.isRol(c) && PD2R.info(c).f.vst > 0 && !PD2R.som(PD2R.info(c).f.bulk) && !(WH.D.P[c].locaties_hm || '').length && ['pallet', 'deel'].includes(PD2R.status(c).so)); const I = PD2R.info(c); return { c, bewijs:I.bewijs, nodig:PD2R.nodigVan(c, PD2R.status(c).so, I).join() }; });
  check('Product met VST-pallets houdt zijn palletvragen', /VST/.test(vst.bewijs) && /spp/.test(vst.nodig) && /hoogte/.test(vst.nodig), JSON.stringify(vst));
  const tel = await ev(() => { const L = WHX.vraagLijst(); return { n:L.length, pallet:L.filter(q => ['spp', 'maat', 'hoogte', 'rmax'].includes(q.k) && !PD2R.info(q.c).bewijs).length, opslag:L.filter(q => q.k === 'opslag').length, soort:L.filter(q => q.k === 'soort').length }; });
  check('Te controleren: geen palletvragen zonder bewijs, soortvraag uit 2.0', tel.pallet === 0 && tel.opslag === 0, JSON.stringify(tel));
  // soort eerst: een product met een open soort toont "Soort" als eerste vraag van dat product
  const s1 = await ev(() => { const L = WHX.vraagLijst(), q = L.find(y => y.k === 'soort'); if(!q) return null; const eerste = L.find(y => y.c === q.c); L.filter(y => y.c !== q.c).forEach(y => WHX.S.later.add(y.c + '|' + y.k)); WHX.herteken(); return { c:q.c, eerste:eerste.k, kaart:document.querySelector('.x-vraag').dataset.k, knoppen:[...document.querySelectorAll('.x-vraag [data-x="vsoort"]')].map(b => b.dataset.v).join(), n:WHX.vraagLijst().length }; });
  check('Soort nog niet bevestigd: eerste vraag "Soort: Pallet · Deel · Pick · Mix · Weg" met voorstel', s1 && s1.eerste === 'soort' && s1.kaart === 'soort' && s1.knoppen.startsWith('pallet,deel,pick,mix,weg'), JSON.stringify(s1));
  await P.click('.x-vraag [data-x="vsoort"][data-v="pick"]'); await P.waitForTimeout(1500);
  const na = await ev(c => ({ so:PD2R.status(c).so, st:PD2R.status(c).soSt, vragen:WHX.vraagLijst().filter(q => q.c === c).map(q => q.k), soortw:!!document.querySelector('.x-vraag [data-x2="soortwijzig"]') || !document.querySelector('.x-vraag') }), s1.c);
  check('Na Pick: soort opgeslagen in 2.0, geen palletvragen meer (alleen max op pick, gewicht of rol), kaart toont "soort ▾"', na.so === 'pick' && ['bevestigd', 'aangepast'].includes(na.st) && na.vragen.every(k => ['maxpick', 'kgst', 'rol', 'rl'].includes(k)) && na.soortw, JSON.stringify(na));
  await ev(() => PD2R.flush()); await P.waitForTimeout(800);
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('VRAGEN', tel.n);
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
