// Weekendcheck (ivol.html#/weekendcheck): snapshot laden uit de echte database (alleen lezen), antwoorden opslaan wordt onderschept
// (nooit naar de database, nooit naar productdata). Snapshot v2: elke vraag is afgeleid zeker · voorstel (1 tik) · bij leverancier ·
// voor Daan · actie. Controleert: tellers per deel, Daans vragen eerst (containers hoog → A → B → C), afgeleid niet in de lijst maar
// wel onder "Afgeleid — bekijken", groepsknop "Alle voorstellen in deze groep kloppen", "Selectie is:" met uitvinken, export met bron
// claude-afgeleid + leverancier + acties, Kopieer overzicht, 390 px zonder horizontaal scrollen, laden < 3 s.
// Gebruik: repo serveren op 8811 (python3 -m http.server 8811) en `node test/pd2/weekendcheck.js`.
const { start } = require('./opzet.js');
const fs = require('fs');
const B = process.env.PD2_URL || 'http://localhost:8811/';
const ok = [], fout = [];
const check = (n, waar, x) => { (waar ? ok : fout).push(n); console.log((waar ? 'OK   ' : 'FOUT ') + n + (x !== undefined && x !== '' ? ' — ' + String(x).slice(0, 300) : '')); };
(async () => {
  const T = await start({ vp:{ width:390, height:844 }, mobiel:true }); const P = T.p;
  await T.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin:B.replace(/\/$/, '') }).catch(() => {});
  // eigen onderschepping: antwoorden lezen = leeg (afgeleid geldt ook zonder rij), antwoorden schrijven = in het geheugen
  const antw = [];
  await P.route(/supabase\.co\/rest\/v1\/catalog/, async r => {
    const q = r.request(), u = decodeURIComponent(q.url());
    if(q.method() === 'GET' && /weekendcheck-antwoorden/.test(u)) return r.fulfill({ status:200, contentType:'application/json', body:'[]' });
    if(q.method() === 'POST' && /weekendcheck-antwoorden/.test(q.postData() || '')){ antw.push(JSON.parse(q.postData())); return r.fulfill({ status:201, body:'' }); }
    return r.fallback();
  });
  const ev = (f, a) => P.evaluate(f, a);
  const hscroll = () => ev(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#native, #native *')].some(e => e.scrollWidth > e.clientWidth + 1 && !['hidden', 'visible', 'auto', 'scroll'].includes(getComputedStyle(e).overflowX) ));
  const klik = async sel => { await P.click(sel); await P.waitForTimeout(250); };
  const huidigId = () => ev(() => WHWK.S.id);
  const rij = id => antw.flatMap(x => x).reverse().find(x => x.data && x.data[id]);

  // 1 laden < 3 s, overzicht, tellers per deel
  const t0 = Date.now();
  await P.goto(B + 'ivol.html#/weekendcheck');
  await P.waitForSelector('.wk[data-scherm="start"] .tegel', { timeout:30000 });
  const ms = Date.now() - t0;
  check('laadt < 3 s op 390 px (snapshot uit de database, zonder koppelcode)', ms < 3000, ms + ' ms');
  const st = await ev(() => {
    const V = WHWK.S.snap.vragen, k = v => v.k || 'daan';
    const tel = d => ['zeker', 'voorstel', 'leverancier', 'daan', 'actie'].map(x => V.filter(v => v.d === d && k(v) === x).length);
    const tegel = d => [...document.querySelectorAll('.wk .tegel[data-d="' + d + '"] .teller b')].map(b => +b.textContent.replace(/\./g, ''));
    return { v:WHWK.S.snap.v, n:V.length, ov:document.querySelectorAll('.wk ol.ov li').length, tc:tel('c'), ti:tel('i'), gc:tegel('c'), gi:tegel('i'),
      labels:[...document.querySelectorAll('.wk .tegel[data-d="i"] .teller span')].map(s => s.textContent), start:!!document.querySelector('.wk .tegel[data-d="alle"]'),
      afg:!!document.querySelector('.wk .tegel[data-d="afgeleid"]'), acties:!!document.querySelector('.wk details[data-blok="acties"]'), lev:!!document.querySelector('.wk details[data-blok="leveranciers"]') };
  });
  check('snapshot v2 met indeling (' + st.n + ' vragen)', st.v === 2 && st.n > 0, st.v);
  check('start: Daan-overzicht in 5 regels', st.ov === 5, st.ov);
  check('start per deel: afgeleid zeker · voorstel (1 tik) · bij leverancier · voor Daan', st.labels.join('|') === 'afgeleid zeker|voorstel (1 tik)|bij leverancier|voor Daan', st.labels.join('|'));
  check('tellers kloppen met de snapshot (containers incl. acties, inventaris)', JSON.stringify(st.gc) === JSON.stringify(st.tc) && JSON.stringify(st.gi) === JSON.stringify(st.ti.slice(0, 4)), JSON.stringify([st.gc, st.tc, st.gi, st.ti]));
  check('alle vragen ingedeeld: som van de tellers = aantal vragen', st.tc.concat(st.ti).reduce((a, b) => a + b, 0) === st.n);
  check('"voor Daan" < 100 vragen', st.tc[3] + st.ti[3] < 100, st.tc[3] + st.ti[3]);
  check('start: knop "eerst jouw vragen", "Afgeleid — bekijken", acties per persoon en leveranciers', st.start && st.afg && st.acties && st.lev);
  check('start: 390 px zonder horizontaal scrollen', !(await hscroll()));
  check('leest niet live uit Picqer (geen koppelcode nodig)', !/koppelcode/i.test(await ev(() => document.querySelector('.wk').innerText)));

  // 2 jouw vragen: alleen voor Daan + voorstel, Daan eerst (containers hoog → midden → A → B → C, wegen per hal/gang), afgeleid nooit
  const volg = await ev(() => { const l = WHWK.vragen('alle'); return { k:l.map(v => v.k), f:l.filter(v => v.k === 'daan' && !/^weeg\|/.test(v.gk)).map(v => v.f), zeker:l.filter(v => v.k === 'zeker' || v.k === 'leverancier' || v.k === 'actie').length }; });
  const R = { hoog:0, midden:1, A:2, B:3, C:4 };
  check('lijst bevat geen afgeleide, leverancier- of actievragen', volg.zeker === 0);
  check('Daans vragen eerst, daarna de voorstellen', volg.k.lastIndexOf('daan') < volg.k.indexOf('voorstel'));
  check('volgorde voor Daan: containers hoog → midden → A → B → C', volg.f.every((f, i) => i === 0 || R[volg.f[i - 1]] <= R[f]), volg.f.slice(0, 5).join(','));
  await klik('.wk .tegel[data-d="alle"]');
  await P.waitForSelector('.wk[data-scherm="vraag"]');
  const v1 = await huidigId();
  const scherm1 = await ev(() => ({ k:WHWK.S.snap.vragen.find(v => v.id === WHWK.S.id).k, label:document.querySelector('.wk .label').textContent, knoppen:[...document.querySelectorAll('.wk .knoppen button')].map(b => b.textContent) }));
  check('eerste vraag is "voor jou"', scherm1.k === 'daan' && scherm1.label === 'voor jou', scherm1.label);
  check('vraagscherm: Klopt / Aanpassen / Twijfel / Overslaan (of keuzes)', ['Aanpassen', 'Twijfel', 'Overslaan'].every(k => scherm1.knoppen.includes(k)), scherm1.knoppen.join(','));
  check('vraagscherm: 390 px zonder horizontaal scrollen', !(await hscroll()));
  const knopH = await ev(() => Math.min(...[...document.querySelectorAll('.wk .knoppen button')].map(b => b.getBoundingClientRect().height)));
  check('grote knoppen (≥ 44 px hoog)', knopH >= 44, Math.round(knopH));
  // aanpassen (soort-keuze of getal)
  await klik('.wk [data-wk="aanpassen"]');
  const isKeus = await ev(() => !!document.querySelector('.wk [data-wk="kies"]'));
  if(isKeus){
    const opties = await ev(() => [...document.querySelectorAll('.wk [data-wk="kies"]')].map(b => b.textContent));
    check('soort: keuze Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg · Backorder', opties.join(' · ') === 'Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg · Backorder', opties.join(' · '));
    await klik('.wk [data-wk="kies"][data-w="Deel"]');
  } else { await P.fill('#wk-w', '12'); await klik('.wk [data-wk="bewaar"]'); }
  await P.waitForTimeout(500);
  const a1 = rij(v1);
  check('antwoord van Daan opgeslagen in weekendcheck-antwoorden (onderschept), bron daan', !!a1 && a1.key === 'weekendcheck-antwoorden' && a1.data[v1].bron === 'daan' && !!a1.data[v1].t, JSON.stringify(a1 && a1.data[v1]));
  const v2 = await huidigId();
  check('direct de volgende vraag', !!v2 && v2 !== v1);
  await klik('.wk [data-wk="vorige"]');
  check('terug kan altijd: vorige vraag met het eerdere antwoord', (await huidigId()) === v1 && await ev(() => /Eerder:/.test(document.querySelector('.wk').innerText)));
  await klik('.wk [data-wk="verder"]');
  const v4 = await huidigId(); await klik('.wk [data-wk="twijfel"]'); await P.waitForTimeout(300);
  const v5 = await huidigId(); await klik('.wk [data-wk="overslaan"]'); await P.waitForTimeout(300);
  const s45 = await ev(([a, b]) => [WHWK.S.ant[a] && WHWK.S.ant[a].a, WHWK.S.ant[b] && WHWK.S.ant[b].a], [v4, v5]);
  check('Twijfel en Overslaan worden bewaard', s45[0] === 'twijfel' && s45[1] === 'overslaan', s45.join(','));

  // 3 groepsknop "Alle voorstellen in deze groep kloppen"
  const gv = await ev(() => { const c = {}; WHWK.vragen('alle').filter(v => v.k === 'voorstel' && !WHWK.S.ant[v.id] && v.vs).forEach(v => { (c[v.gk] = c[v.gk] || []).push(v.id); }); const g = Object.values(c).find(l => l.length >= 2); WHWK.S.id = g[0]; WHWK.S.deel = 'alle'; WHWK.render(document.getElementById('native'), 'alle'); return g; });
  await P.waitForTimeout(300);
  const knop = await ev(() => { const b = document.querySelector('.wk [data-wk="groepkies"][data-w="__allevoorstel"]'); return b ? b.textContent : ''; });
  check('groepsknop "Alle voorstellen in deze groep kloppen" bij een voorstel met groepsgenoten', /Alle voorstellen in deze groep kloppen/.test(knop), knop);
  await klik('.wk [data-wk="groepkies"][data-w="__allevoorstel"]'); await P.waitForTimeout(600);
  const gst = await ev(l => l.map(id => WHWK.S.ant[id] ? WHWK.S.ant[id].a + (WHWK.S.ant[id].g ? '+g' : '') : 'open'), gv);
  check('groepsknop: alle voorstellen van de groep in één tik "klopt"', gst.every(x => x === 'klopt+g'), gst.join(','));

  // 4 Selectie is met uitvinken (soortgroep met minstens 3 open vragen)
  const gid = await ev(() => { const c = {}; WHWK.vragen('alle').filter(v => v.v === 'soort' && !WHWK.S.ant[v.id]).forEach(v => { (c[v.gk] = c[v.gk] || []).push(v.id); }); const g = Object.values(c).find(l => l.length >= 3); WHWK.S.id = g[0]; WHWK.render(document.getElementById('native'), 'alle'); return g; });
  await P.waitForTimeout(300);
  await klik('.wk [data-wk="groep"]');
  check('groep: "Selectie is:" met alle producten aangevinkt', /Selectie is:/.test(await ev(() => document.querySelector('.wk .groep').innerText)) && await ev(() => [...document.querySelectorAll('.wk [data-wk="vink"]')].every(i => i.checked)));
  await P.click('.wk [data-wk="vink"][data-id="' + gid[1] + '"]'); await P.waitForTimeout(250);
  await klik('.wk [data-wk="groepkies"][data-w="Pick"]'); await P.waitForTimeout(600);
  const sst = await ev(l => l.map(id => WHWK.S.ant[id] ? WHWK.S.ant[id].a + (WHWK.S.ant[id].g ? '+g' : '') : 'open'), gid);
  check('Selectie is → alle aangevinkte beantwoord, uitgevinkte blijft open', sst[1] === 'open' && sst.filter((x, i) => i !== 1).every(x => /\+g$/.test(x)), sst.join(','));

  // 5 afgeleid: niet in de lijst, wel te bekijken en aan te passen
  await P.goto(B + 'ivol.html#/weekendcheck/afgeleid'); await P.waitForSelector('.wk[data-scherm="afgeleid"]', { timeout:30000 });
  const afg = await ev(() => ({ n:document.querySelectorAll('.wk [data-wk="bekijk"]').length, z:WHWK.vragen('afgeleid').length, bron:WHWK.vragen('afgeleid').every(v => WHWK.ant(v) && WHWK.ant(v).bron === 'claude-afgeleid' && WHWK.ant(v).a === 'klopt') }));
  check('"Afgeleid — bekijken" toont alle afgeleide vragen (' + afg.z + ')', afg.n === afg.z && afg.z > 0, afg.n + ' van ' + afg.z);
  check('afgeleid = vooraf "Klopt (afgeleid)" met bron claude-afgeleid', afg.bron);
  await ev(() => { document.querySelector('.wk details[data-blok="afgeleid"]').open = true; });
  await klik('.wk [data-wk="bekijk"]');
  check('afgeleide vraag te openen, met "Afgeleid uit de data" en Aanpassen', await ev(() => /Afgeleid uit de data/.test(document.querySelector('.wk').innerText) && !!document.querySelector('.wk [data-wk="aanpassen"]')));
  check('afgeleid: 390 px zonder horizontaal scrollen', !(await hscroll()));

  // 6 export voor Claude
  await P.goto(B + 'ivol.html#/weekendcheck'); await P.waitForSelector('.wk[data-scherm="start"]', { timeout:30000 });
  await ev(a => { a.forEach(r => Object.assign(WHWK.S.ant, r.data)); }, antw.flatMap(x => x));
  const dl = []; P.on('download', d => dl.push(d));
  await klik('.wk [data-wk="export"]'); await P.waitForTimeout(2000);
  let json = null, md = '';
  for(const d of dl){ const t = fs.readFileSync(await d.path(), 'utf8'); if(/\.json$/.test(d.suggestedFilename())) json = JSON.parse(t); else md = t; }
  check('export: weekendcheck-antwoorden.json + samenvatting .md', dl.map(d => d.suggestedFilename()).join(',') === 'weekendcheck-antwoorden.json,weekendcheck-samenvatting.md', dl.map(d => d.suggestedFilename()).join(','));
  const ex = json ? json.antwoorden : [];
  check('export: afgeleide antwoorden met bron claude-afgeleid en zekerheid', ex.filter(a => a.bron === 'claude-afgeleid' && a.antwoord === 'klopt').length === afg.z && ex.some(a => a.zekerheid !== null), ex.filter(a => a.bron === 'claude-afgeleid').length);
  check('export: leverancier- en actievragen doorgezet, Daans antwoorden met bron daan', ex.some(a => a.indeling === 'leverancier') && ex.some(a => a.indeling === 'actie' && a.wie) && ex.some(a => a.bron === 'daan'));
  check('export: elke regel heeft vraag, voorstel, antwoord, indeling, tijd', ex.every(a => a.id && a.antwoord && a.indeling && 'voorstel' in a && a.tijd));
  check('export: samenvatting noemt afgeleid, leveranciers en Daans antwoorden', /Afgeleid door Claude/.test(md) && /Bij leveranciers/.test(md) && /## Aangepast door Daan/.test(md));
  await klik('.wk [data-wk="kopieer"]'); await P.waitForTimeout(400);
  const klem = await ev(() => navigator.clipboard.readText().catch(() => '')) || await ev(() => (document.querySelector('.wk pre.tekst') || {}).innerText || '');
  check('Kopieer overzicht: platte tekst met het overzicht', /Weekendcheck/.test(klem) && klem.split('\n').length >= 6, klem.slice(0, 60));
  check('24-uurs tijden', !/\d{1,2}:\d{2}\s?(AM|PM)/i.test(await ev(() => document.body.innerText)));

  // 7 veiligheid
  check('nooit naar productdata geschreven', T.pdWrites.length === 0, T.pdWrites.length);
  check('alleen weekendcheck-antwoorden geschreven (onderschept), verder 0 geblokkeerd', T.blocked.filter(b => !/FUNC/.test(b)).length === 0 && antw.flatMap(x => x).every(x => x.key === 'weekendcheck-antwoorden'), JSON.stringify(T.blocked.slice(0, 3)));
  check('geen fouten in de pagina', !T.errors.filter(e => /weekendcheck|WHWK/i.test(e)).length, T.errors.filter(e => /weekendcheck|WHWK/i.test(e)).slice(0, 2).join(' | '));
  console.log('\n' + ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
  process.exit(fout.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
