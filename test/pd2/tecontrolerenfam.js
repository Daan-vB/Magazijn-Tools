// Te controleren: "geldt voor alle <n> in deze familie" → lijst met vinkjes; Klopt / Aanpassen voor selectie; niet aangevinkt blijft open.
// Echte database alleen lezen; schrijven naar productdata en wh-pd2-* gaat naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start({ vp:{ width:390, height:844 }, mobiel:true }); const P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/nakijken');
  await P.waitForFunction(() => window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar && document.querySelector('.x-vraag'), null, { timeout:240000 });
  const ev = (f, a) => P.evaluate(f, a);
  // RPEPDM0400, hoogte incl. pallet: de rest even op later
  const fam = await ev(() => { const q = WHX.vraagLijst().find(y => y.c === 'RPEPDM0400' && y.k === 'hoogte'); if(!q) return null; WHX.vraagLijst().filter(y => !(y.fam === q.fam && y.k === 'hoogte')).forEach(y => WHX.S.later.add(y.c + '|' + y.k)); WHX.herteken(); return WHX.vraagLijst().map(y => y.c); });
  check('RPEPDM0400 heeft een vraag "hoogte incl. pallet" met familie', !!fam && fam.includes('RPEPDM0400'), JSON.stringify(fam));
  const n0 = await ev(() => +document.querySelector('.x-nog').textContent.match(/\d+/)[0]);
  await P.click('.x-vraag [data-x="vfam"]'); await P.waitForTimeout(300);
  const lijst = await ev(() => [...document.querySelectorAll('.x-famrij')].map(r => ({ c:r.querySelector('input').dataset.code, aan:r.querySelector('input').checked, w:r.querySelector('.x-fv').textContent })));
  check('Knop opent de lijst met de 4 familieproducten, vinkjes standaard aan, met waarde', lijst.length === 4 && lijst.every(r => r.aan && r.w) && lijst.some(r => r.c === 'RPEPDM0400'), JSON.stringify(lijst));
  const uit = lijst.find(r => r.c !== 'RPEPDM0400').c;
  await P.click(`.x-famrij input[data-code="${uit}"]`); await P.waitForTimeout(200);
  check('Uitvinken: knop telt mee (3)', /\(3\)/.test(await ev(() => document.querySelector('[data-x="famklopt"]').textContent)));
  const voor = T.pdWrites.length;
  await P.click('[data-x="famklopt"]'); await P.waitForTimeout(2000);
  const na = await ev(() => ({ n:document.querySelector('.x-nog') ? +document.querySelector('.x-nog').textContent.match(/\d+/)[0] : 0, open:WHX.vraagLijst().map(y => y.c + '|' + y.k) }));
  const gezet = T.pdWrites.slice(voor).flatMap(r => r.meta && r.meta.hoogte && r.meta.hoogte.bron === 'pd2' ? [r.productcode] : []);
  check('Klopt voor selectie: 3 afgehandeld (bron pd2), teller loopt 3 af', gezet.length === 3 && !gezet.includes(uit) && na.n === n0 - 3, gezet.join() + ' · ' + n0 + ' → ' + na.n);
  check('Niet aangevinkt product blijft open als eigen vraag', na.open.includes(uit + '|hoogte') && await ev(c => document.querySelector('.x-vraag').dataset.code === c, uit));
  // Aanpassen voor selectie: één waarde (zet de rest terug van later en neem een familie met meer dan 1 vraag)
  const f2 = await ev(() => { WHX.S.later.clear(); const L = WHX.vraagLijst(), per = {}; L.forEach(y => { const k = y.fam + '|' + y.k; (per[k] = per[k] || []).push(y); }); const g = Object.values(per).find(x => x.length >= 2 && x.every(y => !['rol', 'rl', 'rmax'].includes(y.k))); L.filter(y => !(g.includes(y))).forEach(y => WHX.S.later.add(y.c + '|' + y.k)); WHX.herteken(); return g.map(y => y.c + '|' + y.k); });
  await P.click('.x-vraag [data-x="vfam"]'); await P.click('[data-x="famaanpas"]'); await P.waitForTimeout(200);
  const k2 = f2[0].split('|')[1], waarde = k2 === 'maat' ? '80x120' : k2 === 'opslag' ? 'pick' : '123';
  await P.fill('#x-famin', waarde); const v2 = T.pdWrites.length; await P.click('[data-x="famopslaan"]'); await P.waitForTimeout(2000);
  const w2 = T.pdWrites.slice(v2).filter(r => r.data && String(r.data[k2]) === waarde).map(r => r.productcode);
  check('Aanpassen voor selectie zet één waarde voor alle aangevinkte (' + f2.length + ')', w2.length === f2.length, k2 + ' = ' + waarde + ' · ' + w2.join());
  check('390 px zonder horizontale scroll', await ev(() => document.documentElement.scrollWidth <= innerWidth + 1));
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
