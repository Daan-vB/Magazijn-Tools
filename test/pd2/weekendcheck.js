// Weekendcheck (ivol.html#/weekendcheck): snapshot laden uit de echte database (alleen lezen), antwoorden opslaan wordt onderschept
// (nooit naar de database, nooit naar productdata), export van weekendcheck-antwoorden.json + samenvatting .md, Kopieer overzicht.
// 390 px zonder horizontaal scrollen, laden < 3 s, één vraag per scherm met Klopt / Aanpassen / Twijfel / Overslaan, terug, groep met "Selectie is:".
// Gebruik: repo serveren op 8811 (python3 -m http.server 8811) en `node test/pd2/weekendcheck.js`.
const { start } = require('./opzet.js');
const fs = require('fs');
const B = process.env.PD2_URL || 'http://localhost:8811/';
const ok = [], fout = [];
const check = (n, waar, x) => { (waar ? ok : fout).push(n); console.log((waar ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 300) : '')); };
(async () => {
  const T = await start({ vp:{ width:390, height:844 }, mobiel:true }); const P = T.p;
  await T.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin:B.replace(/\/$/, '') }).catch(() => {});
  // eigen onderschepping: antwoorden lezen = leeg, antwoorden schrijven = in het geheugen (niet in de database)
  const antw = [];
  await P.route(/supabase\.co\/rest\/v1\/catalog/, async r => {
    const q = r.request(), u = decodeURIComponent(q.url());
    if(q.method() === 'GET' && /weekendcheck-antwoorden/.test(u)) return r.fulfill({ status:200, contentType:'application/json', body:'[]' });
    if(q.method() === 'POST' && /weekendcheck-antwoorden/.test(q.postData() || '')){ antw.push(JSON.parse(q.postData())); return r.fulfill({ status:201, body:'' }); }
    return r.fallback();
  });
  const ev = (f, a) => P.evaluate(f, a);
  const hscroll = () => ev(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#native, #native *')].some(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden' && getComputedStyle(e).overflowX !== 'visible'));
  const scherm = () => ev(() => (document.querySelector('.wk') || {}).dataset && document.querySelector('.wk').dataset.scherm);
  const klik = async sel => { await P.click(sel); await P.waitForTimeout(250); };
  const huidigId = () => ev(() => WHWK.S.id);

  // 1 laden < 3 s (vanaf openen tot de tegels er staan)
  const t0 = Date.now();
  await P.goto(B + 'ivol.html#/weekendcheck');
  await P.waitForSelector('.wk[data-scherm="start"] .tegel', { timeout:30000 });
  const ms = Date.now() - t0;
  check('laadt < 3 s op 390 px (snapshot uit de database, zonder koppelcode)', ms < 3000, ms + ' ms');
  const st = await ev(() => ({ ov:document.querySelectorAll('.wk ol.ov li').length, tegels:[...document.querySelectorAll('.wk .tegel b')].map(b => b.textContent), balk:document.querySelectorAll('.wk .tegel .balk').length, n:WHWK.S.snap.vragen.length, id:WHWK.S.snap.id, functies:0 }));
  check('start: Daan-overzicht in 5 regels', st.ov === 5, st.ov);
  check('start: tegels "Containers deze week" en "Inventaris A/B/C" met voortgang', st.tegels.join('|') === 'Containers deze week|Inventaris A/B/C' && st.balk === 2, st.tegels.join('|'));
  check('snapshot ' + st.id + ' met invulvragen', st.n > 0, st.n + ' vragen');
  check('start: 390 px zonder horizontaal scrollen', !(await hscroll()));
  const picqer = T.blocked.filter(b => /FUNC/.test(b));
  check('leest niet live uit Picqer (geen aanroep van het tussenstation nodig)', !(await ev(() => document.querySelector('.wk').innerText)).match(/koppelcode/i));

  // 2 containers: volgorde hoog → midden, Klopt bewaart en gaat door
  await klik('.wk .tegel[data-d="c"]');
  await P.waitForSelector('.wk[data-scherm="vraag"]');
  const fasen = await ev(() => WHWK.S.snap.vragen.filter(v => v.d === 'c').map(v => v.f));
  check('containervragen: eerst ernst hoog, dan midden', fasen.indexOf('midden') > fasen.lastIndexOf('hoog') && fasen[0] === 'hoog', fasen.slice(0, 3).join(','));
  const v1 = await huidigId();
  const knoppen = await ev(() => [...document.querySelectorAll('.wk .knoppen button')].map(b => b.textContent));
  check('vraagscherm: Klopt / Aanpassen / Twijfel / Overslaan', ['Klopt', 'Aanpassen', 'Twijfel', 'Overslaan'].every(k => knoppen.includes(k)), knoppen.join(','));
  check('vraagscherm: 390 px zonder horizontaal scrollen', !(await hscroll()));
  const knopH = await ev(() => Math.min(...[...document.querySelectorAll('.wk .knoppen button')].map(b => b.getBoundingClientRect().height)));
  check('grote knoppen (≥ 44 px hoog)', knopH >= 44, knopH);
  await klik('.wk [data-wk="klopt"]');
  await P.waitForTimeout(600);
  const v2 = await huidigId();
  const a1 = antw.flatMap(x => x).find(x => x.data && x.data[v1]);
  check('Klopt: antwoord opgeslagen in weekendcheck-antwoorden (onderschept) en direct de volgende vraag', !!a1 && a1.key === 'weekendcheck-antwoorden' && a1.data[v1].a === 'klopt' && !!a1.data[v1].t && v2 && v2 !== v1, JSON.stringify(a1 && a1.data[v1]));
  // terug
  await klik('.wk [data-wk="vorige"]');
  const terug = await huidigId(), eerder = await ev(() => document.querySelector('.wk').innerText.includes('Eerder: klopt'));
  check('terug kan altijd: vorige vraag met het eerdere antwoord', terug === v1 && eerder);
  await klik('.wk [data-wk="verder"]');
  // aanpassen met eigen tekst
  const v3 = await huidigId();
  await klik('.wk [data-wk="aanpassen"]');
  await P.fill('#wk-w', 'Jim boekt maandag op');
  await klik('.wk [data-wk="bewaar"]'); await P.waitForTimeout(500);
  const a3 = antw.flatMap(x => x).reverse().find(x => x.data && x.data[v3]);
  check('Aanpassen (veld): waarde opgeslagen als aangepast', !!a3 && a3.data[v3].a === 'aangepast' && a3.data[v3].w === 'Jim boekt maandag op', JSON.stringify(a3 && a3.data[v3]));
  // twijfel en overslaan
  const v4 = await huidigId(); await klik('.wk [data-wk="twijfel"]'); await P.waitForTimeout(400);
  const v5 = await huidigId(); await klik('.wk [data-wk="overslaan"]'); await P.waitForTimeout(400);
  const s45 = await ev(([a, b]) => [WHWK.S.ant[a] && WHWK.S.ant[a].a, WHWK.S.ant[b] && WHWK.S.ant[b].a], [v4, v5]);
  check('Twijfel en Overslaan worden bewaard', s45[0] === 'twijfel' && s45[1] === 'overslaan', s45.join(','));

  // 3 inventaris: A → B → C per groep, soort eerst, groepsantwoord "Selectie is"
  await P.goto(B + 'ivol.html#/weekendcheck/i'); await P.waitForSelector('.wk[data-scherm="vraag"]', { timeout:30000 });
  const vol = await ev(() => { const l = WHWK.S.snap.vragen.filter(v => v.d === 'i').map(v => v.f).join(''); return /^A*B*C*$/.test(l); });
  check('inventarisvragen in volgorde A → B → C', vol);
  // zoek een groep met minstens 3 open vragen en ga erheen
  const gid = await ev(() => { const c = {}; WHWK.S.snap.vragen.filter(v => v.d === 'i' && v.v === 'soort').forEach(v => { (c[v.gk] = c[v.gk] || []).push(v.id); }); const g = Object.values(c).find(l => l.length >= 3); WHWK.S.id = g[0]; WHWK.render(document.getElementById('native'), 'i'); return g; });
  await P.waitForTimeout(300);
  check('groep: knop "Hele groep" bij een vraag met groepsgenoten', await ev(() => !!document.querySelector('.wk [data-wk="groep"]')));
  await klik('.wk [data-wk="groep"]');
  const sel = await ev(() => document.querySelector('.wk .groep').innerText);
  check('groep: "Selectie is:" met alle producten aangevinkt', /Selectie is:/.test(sel) && (await ev(() => [...document.querySelectorAll('.wk [data-wk="vink"]')].every(i => i.checked))));
  await P.click('.wk [data-wk="vink"][data-id="' + gid[1] + '"]'); await P.waitForTimeout(250);
  const voor = antw.length;
  await klik('.wk [data-wk="groepkies"]'); await P.waitForTimeout(700);
  const gst = await ev(l => l.map(id => WHWK.S.ant[id] ? WHWK.S.ant[id].a + (WHWK.S.ant[id].g ? '+g' : '') : 'open'), gid);
  check('groep: Selectie is → alle aangevinkte beantwoord, uitgevinkte blijft open', gst[1] === 'open' && gst.filter((x, i) => i !== 1).every(x => /\+g$/.test(x)) && antw.length > voor, gst.join(','));
  // soort-vraag kiezen via Aanpassen
  const soortId = await ev(() => { const v = WHWK.S.snap.vragen.find(v => v.d === 'i' && v.v === 'soort' && !WHWK.S.ant[v.id]); WHWK.S.id = v.id; WHWK.render(document.getElementById('native'), 'i'); return v.id; });
  await klik('.wk [data-wk="aanpassen"]');
  const opties = await ev(() => [...document.querySelectorAll('.wk [data-wk="kies"]')].map(b => b.textContent));
  check('soort: keuze Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg · Backorder', opties.join(' · ') === 'Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg · Backorder', opties.join(' · '));
  await klik('.wk [data-wk="kies"][data-w="Twijfel"]'); await P.waitForTimeout(500);
  check('soort: keuze opgeslagen', await ev(id => !!WHWK.S.ant[id] && WHWK.S.ant[id].w === 'Twijfel', soortId));
  check('inventaris: 390 px zonder horizontaal scrollen', !(await hscroll()));

  // 4 export voor Claude
  await P.goto(B + 'ivol.html#/weekendcheck'); await P.waitForSelector('.wk[data-scherm="start"]', { timeout:30000 });
  // antwoorden uit het geheugen terugzetten (de onderschepte rij is niet in de database)
  await ev(a => { a.forEach(r => Object.assign(WHWK.S.ant, r.data)); }, antw.flatMap(x => x));
  const dl = [];
  P.on('download', d => dl.push(d));
  await klik('.wk [data-wk="export"]'); await P.waitForTimeout(2000);
  const namen = dl.map(d => d.suggestedFilename());
  let json = null, md = '';
  for(const d of dl){ const p = await d.path(); const t = fs.readFileSync(p, 'utf8'); if(/\.json$/.test(d.suggestedFilename())) json = JSON.parse(t); else md = t; }
  check('export: weekendcheck-antwoorden.json + samenvatting .md', namen.includes('weekendcheck-antwoorden.json') && namen.some(n => /\.md$/.test(n)), namen.join(','));
  check('export: json bevat elk antwoord (vraag, voorstel, antwoord, waarde, tijd)', json && json.antwoorden.length >= 6 && json.antwoorden.every(a => a.id && a.antwoord && a.tijd && 'voorstel' in a), json && json.antwoorden.length);
  check('export: samenvatting noemt de stand en de aangepaste antwoorden', /Weekendcheck/.test(md) && /## Aangepast/.test(md) && /Jim boekt maandag op/.test(md));
  await klik('.wk [data-wk="kopieer"]'); await P.waitForTimeout(400);
  const klem = await ev(() => navigator.clipboard.readText().catch(() => '')) || await ev(() => (document.querySelector('.wk pre.tekst') || {}).innerText || '');
  check('Kopieer overzicht: platte tekst met het overzicht', /Weekendcheck/.test(klem) && klem.split('\n').length >= 6, klem.slice(0, 80));
  check('24-uurs tijden', !/\d{1,2}:\d{2}\s?(AM|PM)/i.test(await ev(() => document.body.innerText)));

  // 5 veiligheid
  check('nooit naar productdata geschreven', T.pdWrites.length === 0, T.pdWrites.length);
  check('alleen weekendcheck-antwoorden geschreven (onderschept), verder 0 geblokkeerd', T.blocked.filter(b => !/FUNC/.test(b)).length === 0 && antw.flatMap(x => x).every(x => x.key === 'weekendcheck-antwoorden'), JSON.stringify(T.blocked.slice(0, 3)));
  check('geen fouten in de pagina', !T.errors.filter(e => /weekendcheck|WHWK/i.test(e)).length, T.errors.filter(e => /weekendcheck|WHWK/i.test(e)).slice(0, 2).join(' | '));
  console.log('\n' + ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
  process.exit(fout.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
