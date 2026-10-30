// Containerplanning advies: hele aantallen, losse goederen in hele dozen, geen advies zonder gecontroleerde data.
// Echte database alleen lezen; opslaan (PATCH) wordt onderschept en nooit verstuurd.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p, onderschept = [];
  await P.route(/supabase\.co\/rest\/v1\/containers\?/, r => { if(r.request().method() === 'GET') return r.continue(); onderschept.push(r.request().method()); return r.fulfill({ status:200, contentType:'application/json', body:'[]' }); });
  const url = (h) => (process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html' + h;
  await P.goto(url('#/c/13/verdeling')); await P.waitForTimeout(9000);
  const tekst = c => P.evaluate(c => { const t = document.body.innerText, i = t.indexOf('\n' + c + '\n'); return i < 0 ? '' : t.slice(i, i + 520); }, c);
  for(const c of ['Snowbag', 'SWB-165-BLA']){ const t = await tekst(c); check(c + ': advies "nog te bepalen — verdeel zelf"', /nog te bepalen, verdeel zelf/.test(t), t.replace(/\n+/g, ' | ').slice(0, 120)); }
  // Per 20 / Per 15: 42x22rub100 gaat deels naar pick: veelvoud van "Per"
  await P.evaluate(() => document.querySelectorAll('[data-act="advneem"]').forEach(b => { if(b.dataset.code === '42x22rub100') b.click(); }));
  await P.waitForTimeout(600);
  const n = await P.evaluate(() => { const k = [...document.querySelectorAll('[data-code="42x22rub100"]')][0]; return k ? [...k.querySelectorAll('input[data-p="n"]')].map(i => i.value) : []; });
  check('42x22rub100 (Per 15): advies neemt hele dozen over (4 + 30 dozen = 60 + 450 st.)', n.join() === '4,30', n.join());
  // geen decimalen in welke verdeling dan ook: alle advies overnemen in alle containers
  const ids = await P.evaluate(async () => (await (await fetch(location.origin.includes('localhost') ? 'https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/containers?select=id&status=neq.afgerond' : '', { headers:{ apikey:'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA' } })).json()).map(x => x.id));
  let dec = [], totaal = 0;
  for(const id of ids){
    await P.goto(url('#/c/' + id + '/verdeling')); await P.waitForTimeout(4000);
    await P.evaluate(() => document.querySelectorAll('[data-act="advneem"]').forEach(b => b.click())); await P.waitForTimeout(500);
    const w = await P.evaluate(() => [...document.querySelectorAll('input[data-p="n"]')].map(i => i.value));
    totaal += w.length; w.forEach(v => { if(!/^\d+$/.test(String(v).trim())) dec.push(id + ':' + v); });
  }
  check('Na "Advies overnemen" overal alleen hele aantallen (' + ids.length + ' containers, ' + totaal + ' porties)', dec.length === 0 && totaal > 0, dec.slice(0, 5).join(' '));
  check('Geen schrijfpoging bereikte de database (onderschept: ' + onderschept.length + ')', T.blocked.length === 0 && T.writes.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n')); console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
