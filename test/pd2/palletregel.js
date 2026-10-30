// Vaste regel (Daan 30-10): palletvragen alleen met bewijs voor pallets; soort eerst in Te controleren. Echte database alleen lezen; schrijven naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/nakijken');
  await P.waitForFunction(() => window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar && document.querySelector('.x-vraag'), null, { timeout:240000 });
  const ev = (f, a) => P.evaluate(f, a);
  const rp = await ev(() => { const L = WHX.vraagLijst(); return Object.keys(WH.D.P).filter(c => /^RPEPDM(04|05|06|08|10)00$/.test(c) && PD2R.actief(c)).map(c => { const I = PD2R.info(c), so = PD2R.status(c).so; return { c, bewijs:I.bewijs || '', vs:(I.vsSo || {}).v, nodig:PD2R.nodigVan(c, so, I).join(), vragen:L.filter(q => q.c === c).map(q => q.k + '=' + q.v).join() }; }); });
  check('RPEPDM0400–1000: geen hoogte- of palletvraag, soort-voorstel Pick (zonder bewijs voor pallets)', rp.length > 0 && rp.every(x => !x.bewijs && !/hoogte|spp|maat/.test(x.vragen) && !/hoogte|spp|maat/.test(x.nodig)) && rp.filter(x => /soort/.test(x.vragen)).every(x => /soort=pick/.test(x.vragen)), JSON.stringify(rp));
  const fk = await ev(() => { const L = WHX.vraagLijst(), q = L.find(y => y.c === 'RPEPDM0400' && y.k === 'soort'); if(!q) return null; L.filter(y => !(y.fam === q.fam && y.k === 'soort')).forEach(y => WHX.S.later.add(y.c + '|' + y.k)); WHX.herteken(); const k = document.querySelector('.x-vraag'); return { fam:!!k.dataset.famkaart, rijen:[...k.querySelectorAll('.x-famrij')].map(r => r.querySelector('input').dataset.code + ':' + r.querySelector('.x-fv').textContent).join() }; });
  check('RPEPDM0400: één familiekaart met voorstel Pick', fk && fk.fam && /RPEPDM0400:Pick/.test(fk.rijen), JSON.stringify(fk));
  await ev(() => { WHX.S.later.clear(); WHX.herteken(); });
  const vst = await ev(() => { const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isKoppel(c) && !PD2R.isSam(c) && !PD2R.isRol(c) && PD2R.info(c).f.vst > 0 && !PD2R.som(PD2R.info(c).f.bulk) && !(WH.D.P[c].locaties_hm || '').length && ['pallet', 'deel'].includes(PD2R.status(c).so)); const I = PD2R.info(c); return { c, bewijs:I.bewijs, nodig:PD2R.nodigVan(c, PD2R.status(c).so, I).join() }; });
  check('Product met VST-pallets houdt zijn palletvragen', /VST/.test(vst.bewijs) && /spp/.test(vst.nodig) && /hoogte/.test(vst.nodig), JSON.stringify(vst));
  const tel = await ev(() => { const L = WHX.vraagLijst(); return { n:L.length, pallet:L.filter(q => ['spp', 'maat', 'hoogte', 'rmax'].includes(q.k) && !PD2R.info(q.c).bewijs).length, opslag:L.filter(q => q.k === 'opslag').length, soort:L.filter(q => q.k === 'soort').length }; });
  check('Te controleren: geen palletvragen zonder bewijs, soortvraag uit 2.0', tel.pallet === 0 && tel.opslag === 0, JSON.stringify(tel));
  await ev(() => PD2R.flush()); await P.waitForTimeout(800);
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('VRAGEN', tel.n);
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
