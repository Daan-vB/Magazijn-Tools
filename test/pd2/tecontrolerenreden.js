// Te controleren: de reden bij een soortvraag begint altijd met het eigen palletbewijs, daarna pas de bron (kleurgenoten of familie).
// Alleen de tekst verandert: voorstellen en aantal vragen blijven gelijk. Echte database alleen lezen; schrijven naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'ivol.html#/nakijken');
  await P.waitForFunction(() => window.WHX && WHX.S.pd && window.PD2R && PD2R.S.klaar && document.querySelector('.x-vraag'), null, { timeout:240000 });
  const r = await P.evaluate(() => { const L = WHX.vraagLijst({}), so = L.filter(q => q.k === 'soort');
    return { n:L.length, so:so.map(q => ({ c:q.c, v:q.v, uit:q.uit, bewijs:PD2R.info(q.c).bewijs || '' })),
      st:['ST105-GREY', 'ST110-GREY'].map(c => ({ c, bewijs:PD2R.info(c).bewijs || '', v:(PD2R.info(c).vsSo || {}).v, why:(PD2R.info(c).vsSo || {}).why || '', vraag:(so.find(q => q.c === c) || {}).uit || '' })) }; });
  console.log('Te controleren: ' + r.n + ' vragen, ' + r.so.length + ' soortvragen');
  const metBron = r.so.filter(q => /kleurgenoten|familie/.test(q.uit));
  check('Geen reden meer met alleen "Daans keuze bij …" (ook niet bij de leverancier)', r.so.every(q => !/Daans keuze|leverancier/.test(q.uit)), r.so.filter(q => /Daans keuze|leverancier/.test(q.uit)).map(q => q.c).join());
  check('Met palletbewijs: reden begint met het eigen bewijs (bulk/VST/palletlabel/verplaatsing/inkoop), daarna "soort zoals …"', metBron.length > 0 && metBron.every(q => q.bewijs && /^(bulk|VST|palletlabel|inkoop|verplaats|\d)/i.test(q.uit) && /· soort zoals (kleurgenoten|de familie) \d+ van \d+/.test(q.uit)), metBron.filter(q => !/^(bulk|VST|palletlabel|inkoop|verplaats|\d)/i.test(q.uit)).slice(0, 3).map(q => q.c + ': ' + q.uit).join(' | ') || metBron.length + ' vragen');
  check('Eén korte regel (≤ 100 tekens) bij bewijs + kleurgenoten/familie', metBron.every(q => q.uit.length <= 100), metBron.filter(q => q.uit.length > 100).map(q => q.c).join());
  const [a, b] = r.st;
  check('ST105-GREY: eerst eigen bewijs, daarna "zoals de familie"', /^bulk \d+ op \S+/.test(a.why) && /soort zoals de familie/.test(a.why) && a.why.indexOf('bulk') < a.why.indexOf('familie'), a.why);
  check('ST110-GREY blijft Pick met de palletregel', b.v === 'pick' && !b.bewijs && /^regel: geen bewijs/.test(b.why), b.v + ' — ' + b.why);
  const VERWACHT = +(process.env.AANTAL || 0);
  if(VERWACHT) check('Aantal vragen gelijk aan vóór de wijziging (' + VERWACHT + ')', r.n === VERWACHT, r.n);
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT', '| geblokkeerd', T.blocked.length);
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
