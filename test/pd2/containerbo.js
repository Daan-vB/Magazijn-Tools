// Containerplanning: backorders live via het (nagebootste) tussenstation; de verdeling telt ze mee zoals bij de export. Echte database alleen lezen; schrijven onderschept.
// Daan 23-11: geen vaste container of vast product. De test kiest zelf een container met twee stuksproducten; de backorders zijn de eigen testinvoer (30 + 12 − 4 = 38).
const { start, naarContainers, kiesContainer, openKaart } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p, vragen = []; let keus = { a:'', b:'' };
  await P.route(/supabase\.co\/functions\/v1\/picqer/, r => {
    const a = new URL(r.request().url()).searchParams.get('actie'), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if(r.request().method() === 'OPTIONS') return r.fulfill({ status:204, headers:cors }); vragen.push(a);
    const j = o => r.fulfill({ status:200, contentType:'application/json', headers:cors, body:JSON.stringify(o) });
    if(a === 'idindex') return j({ soort:'producten', offset:0, volgende:null, lijst:[[555, keus.a], [556, keus.b]] });
    if(a === 'vandaag') return j({ opgehaald:new Date().toISOString(), picklijsten:[], backorders:[{ id:1, o:5, p:555, a:30, v:0 }, { id:2, o:6, p:555, a:12, v:4 }, { id:3, o:7, p:556, a:7, v:7 }] });
    return r.fulfill({ status:404, headers:cors, body:'{}' });
  });
  await P.route(/supabase\.co\/rest\/v1\/containers\?/, r => r.request().method() === 'GET' ? r.continue() : r.fulfill({ status:200, contentType:'application/json', body:'[]' }));
  const url = h => (process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html' + h;
  await naarContainers(P);
  const kies = await kiesContainer(P, (c, X) => { const st = X.pools(c).order.filter(code => X.eenheid(code) === 'st.'); return st.length >= 2 ? { score:1, a:st[0], b:st[1] } : 0; });
  keus = { a:kies.info.a, b:kies.info.b }; const id = kies.id;
  console.log('container', id, '· producten', keus.a, keus.b);
  // zonder koppelcode: één regel met reden en laatste stand
  await P.goto(url('#/c/' + id + '/uitvoer')); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(3000);
  let t = await P.evaluate(() => document.body.innerText);
  console.log((t.match(/Backorders[^\n]*/g) || []).join(' || '));
  check('Zonder koppelcode: "Backorders niet live: geen koppelcode" met laatste stand', /Backorders niet live: geen koppelcode/.test(t) && /Laatste stand:/.test(t));
  check('Melding "verse backorder-export" is weg', !/verse backorder-export/.test(t));
  // met koppelcode
  await P.evaluate(() => localStorage.setItem('ivol-koppelcode', 'testcode'));
  await P.reload(); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(4000);
  t = await P.evaluate(() => document.body.innerText);
  check('Met koppelcode: "Backorders live · hh:mm"', /Backorders live · \d\d:\d\d/.test(t) && !/Backorders niet live/.test(t), vragen.join());
  // de verdeling telt de live backorders mee (zoals bij de export: open = aantal − beschikbaar)
  await P.evaluate(id => { location.hash = '#/c/' + id + '/verdeling'; }, id);
  await P.waitForTimeout(6000); await openKaart(P, keus.a); await P.waitForTimeout(800);
  t = await P.evaluate(c => { const k = document.getElementById('v-' + c); return k ? k.innerText : ''; }, keus.a);
  console.log(JSON.stringify(t.replace(/\n+/g, ' | ').slice(0, 400)));
  check(keus.a + ': Backorders 38 (30 + 12 − 4) in de verdeling', /Backorders 38\b/.test(t), t.replace(/\n+/g, ' | ').slice(0, 220));
  const n0 = vragen.filter(v => v === 'vandaag').length;
  await P.evaluate(id => { location.hash = '#/c/' + id + '/uitvoer'; }, id); await P.waitForSelector('#tabbody', { timeout:90000 }); await P.waitForTimeout(2000);
  await P.evaluate(() => { const b = document.querySelector('[data-act="pdfall"]'); if(b) b.click(); }); await P.waitForTimeout(3000);
  check('Vlak vóór "PDF maken" opnieuw vers opgehaald', vragen.filter(v => v === 'vandaag').length >= n0 + 1, n0 + ' → ' + vragen.filter(v => v === 'vandaag').length);
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0 && T.writes.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|jsPDF/.test(e)).join('\n')); console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
  process.exit(fout.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
