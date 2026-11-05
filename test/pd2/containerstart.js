// Containerplanning startscherm: tijd tot getekend bij 6x trager CPU, aantal aanroepen per render, langste blokkade. Alleen lezen; schrijven onderschept.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 220) : '')); };
const url = h => (process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html' + h;
(async () => {
  const T = await start({ vp:{ width:390, height:844 }, mobiel:true }), P = T.p;
  const cdp = await P.context().newCDPSession(P);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate:6 });
  await P.addInitScript(() => {
    window.__tel = { lang:[], teken:null }; const t0 = performance.now();
    try{ new PerformanceObserver(l => l.getEntries().forEach(e => window.__tel.lang.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ entryTypes:['longtask'] }); }catch(e){}
    window.__t0 = t0;
    const w = setInterval(() => { if(window.__tel.teken === null && document.querySelector('.ccard, .cgrid .empty, .card.empty')){ window.__tel.teken = Math.round(performance.now()); } if(window.__tel.teken !== null && window.__wrapped) clearInterval(w); }, 20);
  });
  const t0 = Date.now();
  await P.goto(url('#/'));
  await P.waitForSelector('.ccard', { timeout:120000 });
  const tPaint = Date.now() - t0;
  await P.waitForTimeout(8000);
  const tel = await P.evaluate(() => window.__tel);
  const netEind = await P.evaluate(t => Math.round(Math.max(0, ...performance.getEntriesByType('resource').filter(e => /supabase\.co\/rest/.test(e.name) && e.responseEnd < t).map(e => e.responseEnd))), tel.teken);
  tel.rek = tel.teken - netEind;
  console.log('laatste data binnen op', netEind, 'ms; verwerken + tekenen tot eerste kaart:', tel.rek, 'ms');
  console.log('startscherm getekend (ms, 6x trager, incl. netwerk):', tPaint, 'eerste kaart in pagina-tijd:', tel.teken, 'longtasks:', JSON.stringify(tel.lang));
  await P.waitForSelector('.wijzer, #wijzerbox:empty', { state:'attached', timeout:120000 }).catch(() => {});
  await P.waitForFunction(() => CP_TEST.home(), null, { timeout:120000 });
  const tKlaar = Date.now() - t0;
  const n0 = await P.evaluate(() => Object.assign({}, CP_TEST.TEL));
  await P.evaluate(() => CP_TEST.rerender()); await P.waitForTimeout(500);
  await P.waitForFunction(() => CP_TEST.home(), null, { timeout:120000 });
  const n1 = await P.evaluate(() => Object.assign({}, CP_TEST.TEL));
  const per = {}; Object.keys(n1).forEach(k => per[k] = n1[k] - n0[k]);
  console.log('alles klaar na (ms):', tKlaar, '| aanroepen per render:', JSON.stringify(per), '| werkelijk berekend (poolsBouw):', per.bouw, '| containers:', await P.evaluate(() => document.querySelectorAll('.ccard').length));
  check('pools() per container hoogstens 1x berekend per render', per.bouw <= await P.evaluate(() => CP_TEST.cont().length), per.bouw);
  const lang = await P.evaluate(() => window.__tel.lang);
  const na = lang.filter(l => tel.teken !== null && l[0] >= tel.teken - 50).map(l => l[1]); const max = Math.max(0, ...na);
  check('startscherm getekend < 2 s bij 6x CPU (vanaf laatste data binnen; netwerk telt niet mee)', tel.teken !== null && tel.rek < 2000, tel.rek + ' ms');
  check('geen blokkade > 200 ms (longtask)', max <= 200, 'langste longtask na eerste kaart ' + max + ' ms');
  check('0 geblokkeerde schrijfpogingen', T.blocked.filter(x => !/^FUNC/.test(x)).length === 0, T.blocked.join(' | '));
  console.log(fout.length ? 'FOUTEN: ' + fout.join('; ') : 'ALLES OK (' + ok.length + ')');
  await T.b.close(); process.exit(fout.length ? 1 : 0);
})();
