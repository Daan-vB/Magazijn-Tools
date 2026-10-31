// Groepskeuze: Schoonloopmat Mars 40x60: 4 aanvinken → "Pick" → alle 4 Pick; 5 aanvinken → Aanpassen → te wegen zonder kg → op de Weeglijst. Schrijven geblokkeerd/geteld.
const { start, open } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p; await open(T);
  const ev = (f, a) => P.evaluate(f, a), w = (ms = 250) => P.waitForTimeout(ms);
  await ev(() => { WHPD2.openFam('Hamat|schoonloopmat mars', '40x60'); });
  await w(400);
  const alle = await ev(() => WHPD2.kaartCodes());
  check('Mars 40x60: minstens 4 open kaarten in stap Soort', alle.length >= 4 && await ev(() => WHPD2.UI.stap) === 'soort', alle.length + '');   // echte data: wat Daan al afrondde staat onder Afgerond
  const vink = async cs => { for(const c of cs) await P.locator(`article.pd2-kaart[data-c="${c}"] [data-a="sel"]`).check(); await w(100); };
  await vink(alle.slice(0, 4));
  check('Balk: n aangevinkt · Selectie is: Pallet Deel Bulk Pick Mix Weg · Selectie klopt · ×', await ev(() => { const b = document.querySelector('#pd2-actie .pd2-actie'); return /4 aangevinkt/.test(b.innerText) && [...b.querySelectorAll('[data-a="selsoort"]')].map(x => x.dataset.v).join() === 'pallet,deel,bulk,pick,mix,weg' && !!b.querySelector('[data-a="selklopt"]') && !!b.querySelector('[data-a="selweg"]'); }));
  await P.click('#pd2-actie [data-a="selsoort"][data-v="pick"]'); await w(400);
  const so = await ev(cs => cs.map(c => PD2R.status(c).so + '/' + PD2R.status(c).soSt), alle.slice(0, 4));
  check('Alle 4 staan op Pick (opgeslagen), vinkjes weg', so.every(x => /^pick\/(bevestigd|aangepast)$/.test(x)) && await ev(() => WHPD2.UI.sel.size === 0), so.join());
  await P.click('#pd2-undo [data-a="ongedaan"]'); await w(300);
  check('Ongedaan herstelt de soort', (await ev(cs => cs.map(c => PD2R.po(c) && PD2R.po(c).so), alle.slice(0, 4))).every(x => !x));
  await P.click('[data-a="stap"][data-v="gewicht"]'); await w();
  await vink(alle);
  await P.click('#pd2-actie [data-a="gewpop"]'); await w();
  check('Pop-up heeft gewogen · vertrouwd · te wegen', await ev(() => [...document.querySelectorAll('.pd2-modal [data-gst]')].map(b => b.dataset.gst).join() === 'gewogen,vertrouwd,tewegen'));
  await P.click('.pd2-modal [data-gst="gewogen"]'); await P.click('.pd2-modal [data-m="ok"]'); await w();
  check('Gewogen zonder kg: nog steeds verplicht (pop-up blijft)', await P.isVisible('.pd2-modal'));
  await P.click('.pd2-modal [data-gst="tewegen"]'); await P.click('.pd2-modal [data-m="ok"]'); await w(400);
  const g = await ev(cs => cs.map(c => PD2R.gewicht(c).st), alle);
  check('Alle aangevinkte (' + alle.length + ') te wegen, zonder kg', g.length === alle.length && g.every(x => x === 'tewegen'), g.join());
  check('Alle aangevinkte op de Weeglijst', await ev(cs => { const l = WHPD2.weegCodes(); return cs.every(c => l.includes(c)); }, alle));
  await ev(() => PD2R.flush()); await w(800);
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.join('\n')); console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
