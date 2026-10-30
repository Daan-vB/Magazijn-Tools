// Containerplanning: stand "bij lossen bepalen" (A) en de invullijst lossen (B). Echte database alleen lezen; alle schrijfacties onderschept.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p, onder = [];
  await P.route(/supabase\.co\/rest\/v1\/(containers|catalog)\?/, r => { const q = r.request(); if(q.method() === 'GET') return r.continue(); onder.push({ m:q.method(), u:q.url(), b:q.postData() || '' }); return r.fulfill({ status:200, contentType:'application/json', body:'[]' }); });
  await P.route(/supabase\.co\/storage\//, r => { const q = r.request(); if(q.method() === 'GET') return r.continue(); onder.push({ m:q.method(), u:q.url(), b:'' }); return r.fulfill({ status:200, contentType:'application/json', body:'{}' }); });
  const url = h => (process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html' + h;
  await P.goto(url('#/c/13/verdeling')); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3000);
  const sum = await P.evaluate(() => document.querySelector('.sumbar').innerText.replace(/\s+/g, ' '));
  check('A: SEKU6023732 toont 14/14 akkoord · 9 bij lossen bepalen', /14\/14 akkoord · 9 bij lossen bepalen/i.test(sum), sum);
  check('A: geen knop "Advies invullen"', !(await P.evaluate(() => !!document.querySelector('[data-act="advalles"]'))));
  const kaart = await P.evaluate(() => document.querySelector('a[href="#/"]') ? '' : '');
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|jsPDF/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT', '| onderschept', onder.length, '| geblokkeerd', T.blocked.length);
  if(T.blocked.length) console.log('FOUT geblokkeerde schrijfpogingen', T.blocked.slice(0, 3));
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
