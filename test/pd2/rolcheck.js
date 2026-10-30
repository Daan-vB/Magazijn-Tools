// Rollen controleren: alle rollen met berekende gegevens; per rol "klopt" (gewicht vertrouwd) of "moet gewogen" (te wegen),
// per familie "rest klopt". Schrijven gaat naar een kopie in het geheugen, nooit naar de database.
const { start, open } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p; await open(T);
  const ev = (f, a) => P.evaluate(f, a);
  const l = await ev(() => { const l = PD2R.rolCheck(); return { n:l.length, afw:l.filter(x => x.afw).length, mist:l.filter(x => x.mist).length, metDia:l.filter(x => x.dia).length, metKg:l.filter(x => x.kgrol).length, dicht:l.filter(x => x.dicht).length }; });
  check('Alle rollen in de lijst, met diameter, kg per rol en kg per m² per mm', l.n > 50 && l.metDia > 0 && l.metKg > 0 && l.dicht > 0, JSON.stringify(l));
  await P.click('.pd2-meer2 > summary'); await P.click('[data-a="view"][data-v="rolcheck"]'); await P.waitForTimeout(400);
  const s = await ev(() => ({ rijen:document.querySelectorAll('.pd2-rc').length, h:document.querySelector('.pd2 h2').textContent, breed:document.documentElement.scrollWidth <= innerWidth + 1 }));
  check('Scherm "Rollen controleren" toont de rollen, zonder horizontale scroll', s.rijen > 0 && /Rollen controleren/.test(s.h) && s.breed, JSON.stringify(s));
  const c = await ev(() => document.querySelector('.pd2-rc:not(.af)').dataset.c);
  await P.click(`.pd2-rc[data-c="${c}"] [data-a="gewst"][data-v="vertrouwd"]`); await P.waitForTimeout(400);
  const g1 = await ev(c => PD2R.gewicht(c), c);
  check('Klopt = gewicht vertrouwd met de Picqer-kg', g1.st === 'vertrouwd' && g1.kg === g1.pq, JSON.stringify(g1));
  const c2 = await ev(() => document.querySelector('.pd2-rc:not(.af)').dataset.c);
  await P.click(`.pd2-rc[data-c="${c2}"] [data-a="gewst"][data-v="tewegen"]`); await P.waitForTimeout(400);
  check('Moet gewogen = te wegen (Weeglijst)', await ev(c => PD2R.gewicht(c).st === 'tewegen', c2));
  check('Na een keuze verdwijnt de rol uit "Nog te checken"', await ev(([a, b]) => !document.querySelector(`.pd2-rc[data-c="${a}"]`) && !document.querySelector(`.pd2-rc[data-c="${b}"]`), [c, c2]));
  const f = await ev(() => { const k = document.querySelector('[data-a="rcfam"]'); if(!k) return null; const fk = k.dataset.f, voor = PD2R.rolCheck().filter(x => x.fam === fk && x.g.st === 'niet' && x.dicht && !x.afw && x.g.pq > 0).map(x => x.c); k.click(); return { fk, voor }; });
  await P.waitForTimeout(400);
  const fn = f && await ev(cs => cs.every(c => PD2R.gewicht(c).st === 'vertrouwd'), f.voor);
  check('Familie: getoetst zonder afwijking klopt in één keer', !f || fn, f ? f.voor.length + ' rollen' : 'geen familieknop');
  await ev(() => PD2R.pdFlush()); await P.waitForTimeout(600);
  check('Schrijven alleen naar wh-pd2-* en productdata (bron pd2)', T.blocked.length === 0 && T.writes.every(k => /^(wh-pd2-(oefen|feedback|kopie-.+)|productdata)$/.test(k)), JSON.stringify([...new Set(T.writes)]));
  await P.setViewportSize({ width:390, height:844 }); await P.waitForTimeout(300);
  check('Telefoon 390 px: geen horizontale scroll', await ev(() => document.documentElement.scrollWidth <= innerWidth + 1));
  console.log('ERRORS', T.errors.join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
