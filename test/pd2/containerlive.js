// Containerplanning live: een product dat niet in de import staat wordt via het tussenstation (nagebootst) opgezocht en is daarna kiesbaar.
// Echte database alleen lezen; elke schrijfpoging wordt geblokkeerd en geteld. Geen echte Picqer: de functie "picqer" is nagebootst.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p;
  const vragen = [], schrijf = [];
  await P.route(/supabase\.co\/functions\/v1\/picqer/, r => {
    const u = new URL(r.request().url()), a = u.searchParams.get('actie'); vragen.push({ a, code:r.request().headers()['x-ivol-code'], m:r.request().method() });
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if(r.request().method() === 'OPTIONS') return r.fulfill({ status:204, headers:cors });
    if(a === 'idindex') return r.fulfill({ status:200, contentType:'application/json', headers:cors, body:JSON.stringify({ soort:'producten', offset:0, volgende:null, lijst:[[1, 'AAA'], [987654, 'ZZ-LIVE-TEST']] }) });
    if(a === 'producten') return r.fulfill({ status:200, contentType:'application/json', headers:cors, body:JSON.stringify({ producten:[{ id:987654, code:'ZZ-LIVE-TEST', naam:'Livetest product', ean:'', loc:[], vw:[] }] }) });
    return r.fulfill({ status:404, headers:cors, body:'{}' });
  });
  await P.addInitScript(() => { try{ localStorage.setItem('ivol-koppelcode', 'testcode'); }catch(e){} });
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html#/c/13');
  await P.waitForSelector('select[data-k="soort"], tr input[data-k="productcode"]', { timeout:120000 });
  const i = await P.evaluate(() => [...document.querySelectorAll('input[data-k="productcode"]')].findIndex(x => !x.value));
  check('Container 13 heeft een regel zonder product', i >= 0);
  const inp = P.locator('input[data-k="productcode"]').nth(i);
  const voor = await P.evaluate(() => document.querySelectorAll('#dl-codes option').length);
  await inp.fill('zz-live-test'); await inp.press('Tab'); await P.waitForTimeout(1500);
  check('Niet in de import: live opgezocht via idindex en producten, met de koppelcode', vragen.some(v => v.a === 'idindex') && vragen.some(v => v.a === 'producten') && vragen.every(v => v.code === 'testcode' || v.m === 'OPTIONS'), JSON.stringify(vragen.map(v => v.a)));
  const rij = await P.evaluate(i => document.querySelectorAll('input[data-k="productcode"]')[i].value, i);
  check('De regel staat daarna op het live gevonden product', rij === 'ZZ-LIVE-TEST', rij);
  check('Geen melding "Importeer eerst"', !(await P.evaluate(() => /Importeer eerst/.test(document.body.innerText))));
  const inp2 = P.locator('input[data-k="productcode"]').nth(i);
  await inp2.fill('BESTAAT-NIET-123'); await inp2.press('Tab'); await P.waitForTimeout(1200);
  check('Product dat ook live niet bestaat: melding, regel blijft zoals hij was', /ook live in Picqer niet gevonden/.test(await P.evaluate(() => document.body.innerText)) && (await P.evaluate(i => document.querySelectorAll('input[data-k="productcode"]')[i].value, i)) === 'ZZ-LIVE-TEST');
  await P.evaluate(() => { localStorage.removeItem('ivol-koppelcode'); });
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|net::/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT', '| geblokkeerde schrijfpogingen (verwacht: opslaan van de test)', T.blocked.length);
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
