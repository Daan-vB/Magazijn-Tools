// Containerplanning: losse pakken met Per > 1 worden als dozen getoond en geteld (Per 1 blijft los/pallets). Echte database alleen lezen; opslaan onderschept.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p, onderschept = [];
  await P.route(/supabase\.co\/rest\/v1\/containers\?/, r => { if(r.request().method() === 'GET') return r.continue(); onderschept.push(1); return r.fulfill({ status:200, contentType:'application/json', body:'[]' }); });
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html#/c/13/verdeling');
  await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(4000);
  const kaart = async code => { await P.evaluate(c => { const b = document.querySelector(`[data-code="${c}"] [data-act="vopen"]`); if(b) b.click(); }, code); await P.waitForTimeout(500);
    return P.evaluate(c => { const x = document.body.innerText, i = x.indexOf('\n' + c + '\n'); return x.slice(i, i + 700).replace(/\n+/g, ' | '); }, code); };
  let t = await kaart('NW-002-BLA');
  check('NW-002-BLA: "Binnen: 5 dozen à 100"', /5 dozen à 100/.test(t), t.slice(0, 260));
  t = await kaart('70198-Black');
  check('70198-Black: "25 dozen, inhoud wisselt (± 59)"', /25 dozen, inhoud wisselt \(± 59\)/.test(t), t.slice(0, 260));
  t = await kaart('80110WM');
  check('80110WM (Per 1): blijft los en pallets, geen dozen', /pallets à 50/.test(t) && /17 los/.test(t) && !/dozen/.test(t.slice(0, 400)), t.slice(0, 300));
  // pakbon-tab
  await P.evaluate(() => { location.hash = '#/c/13/pakbon'; }); await P.waitForTimeout(3500);
  t = await P.evaluate(() => document.body.innerText);
  check('Pakbon-tab: "5 dozen à 100 = 500 op de pakbon"', /5 dozen à 100 = 500/.test(t) || /5 dozen à 100/.test(t));
  // werkbon (Uitvoer)
  await P.evaluate(() => { location.hash = '#/c/13/uitvoer'; }); await P.waitForSelector('#wbprev', { timeout:60000 });
  t = await P.evaluate(() => document.getElementById('wbprev').innerText);
  check('Werkbon telt in boxes/dozen voor NW-002-BLA en 70198-Black, niet voor whiteboards', /NW-002-BLA[\s\S]{0,200}\d+ box/.test(t) && /70198-Black[\s\S]{0,200}25 boxes/.test(t) && !/80110WM[\s\S]{0,120}box/.test(t), t.slice(0, 0));
  const v = await P.evaluate(async () => (await (await fetch('https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/containers?id=eq.13&select=updated_at', { headers:{ apikey:'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA' } })).json())[0].updated_at);
  check('Niets stil gewijzigd: geen schrijfpogingen (onderschept ' + onderschept.length + ')', T.blocked.length === 0 && onderschept.length === 0, v);
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|jsPDF/.test(e)).join('\n')); console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
