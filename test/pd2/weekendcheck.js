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
  const pdp = await ev(() => ({ info:!!(WHWK.S.pdInfo && WHWK.S.pdInfo.gezet_op), paneel:(document.querySelector('.wk [data-blok="productdata"]') || {}).innerText || '' }));
  check('start: "In productdata gezet op <datum tijd>" met de dekking per klasse A/B/C (24-uurs)', !pdp.info || (/In productdata gezet op .*\d{2}:\d{2}/.test(pdp.paneel) && /klasse A \d+%/.test(pdp.paneel) && /klasse B \d+%/.test(pdp.paneel) && /klasse C \d+%/.test(pdp.paneel) && !/\b(AM|PM)\b/i.test(pdp.paneel)), pdp.paneel.replace(/\n/g, ' | ').slice(0, 200));
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
  // B1: bovenin "nog N open (x voor jou · y voorstellen)", niet de plek in de lijst ("39 van 623")
  const kopT = await ev(() => { const o = WHWK.vragen('alle').filter(v => !WHWK.ant(v)), nf = n => n.toLocaleString('nl-NL'); return { tekst:(document.querySelector('[data-wk-kop]') || {}).textContent, ver:'nog ' + nf(o.length) + ' open (' + nf(o.filter(v => v.k === 'daan').length) + ' voor jou · ' + nf(o.filter(v => v.k === 'voorstel').length) + ' voorstellen)' }; });
  check('vraagscherm: bovenin "nog N open (x voor jou · y voorstellen)"', kopT.tekst === kopT.ver, kopT.tekst + ' ≠ ' + kopT.ver);
  check('vraagscherm: niet meer de plek in de lijst ("39 van 623")', !/\d+ van [\d.]+/.test(await ev(() => document.querySelector('.wk .kopregel').innerText)));

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
  check('na Selectie is: meteen de uitgevinkte uitzondering van dezelfde groep (niet ergens verderop in de lijst)', (await huidigId()) === gid[1], await huidigId());
  // uitzondering eerst overslaan en via "Nog open — per groep" terugvinden
  await klik('.wk [data-wk="overslaan"]'); await P.waitForTimeout(300);
  await P.goto(B + 'ivol.html#/weekendcheck'); await P.waitForSelector('.wk[data-scherm="start"]', { timeout:30000 });
  await ev(a => { a.forEach(r => Object.assign(WHWK.S.ant, r.data)); WHWK.render(document.getElementById('native'), ''); }, antw.flatMap(x => x));
  check('start: tegel "Nog open — per groep" met deels gedane groepen', /deels gedaan/.test(await ev(() => (document.querySelector('.wk .tegel[data-d="open"]') || {}).innerText || '')));
  await klik('.wk .tegel[data-d="open"]'); await P.waitForSelector('.wk[data-scherm="open"]');
  const og = await ev(id => { const b = [...document.querySelectorAll('.wk [data-wk="opengroep"]')]; const i = b.findIndex(x => x.dataset.id === id); return { n:b.length, i, deels:i >= 0 && /deels gedaan/.test(b[i].innerText) }; }, gid[1]);
  check('"Nog open — per groep" toont de groep met de overgeslagen uitzondering als deels gedaan', og.i >= 0 && og.deels, JSON.stringify(og));
  check('Nog open: 390 px zonder horizontaal scrollen', !(await hscroll()));
  await klik('.wk [data-wk="opengroep"][data-id="' + gid[1] + '"]'); await P.waitForTimeout(400);
  check('tik op de groep opent de open vraag in die groep', (await huidigId()) === gid[1] && await ev(() => document.querySelector('.wk').dataset.scherm === 'vraag'));

  // B2: na de laatste open vraag een klaar-scherm met "x overgeslagen — bekijken"; overgeslagen komen één keer langs, nooit eindeloos
  const kl = await ev(() => { const l = WHWK.vragen('alle'), t = new Date().toISOString(), n = l.length; l.forEach(v => { WHWK.S.ant[v.id] = { a:'klopt', w:v.vs || 'x', t, bron:'daan' }; });
    WHWK.S.ant[l[n - 3].id] = { a:'overslaan', w:'', t, bron:'daan' }; WHWK.S.ant[l[n - 2].id] = { a:'overslaan', w:'', t, bron:'daan' }; delete WHWK.S.ant[l[n - 1].id];
    WHWK.S.skip = false; WHWK.S.fertig = false; WHWK.S.deel = 'alle'; WHWK.S.id = l[n - 1].id; WHWK.render(document.getElementById('native'), 'alle'); return { sk:[l[n - 3].id, l[n - 2].id] }; });
  await klik('.wk [data-wk="twijfel"]');
  check('na de laatste open vraag: klaar-scherm met "2 overgeslagen — bekijken"', await ev(() => document.querySelector('.wk').dataset.scherm === 'klaar' && /2 overgeslagen — bekijken/.test(document.querySelector('.wk [data-wk="skip"]').innerText)));
  check('klaar-scherm: niet automatisch terug langs de overgeslagen vragen', await ev(() => { WHWK.render(document.getElementById('native'), 'alle'); return document.querySelector('.wk').dataset.scherm === 'klaar'; }));
  await klik('.wk [data-wk="skip"]');
  check('bekijken: eerste overgeslagen vraag, kop "2 overgeslagen te bekijken"', (await huidigId()) === kl.sk[0] && /2 overgeslagen te bekijken/.test(await ev(() => document.querySelector('[data-wk-kop]').textContent)));
  await klik('.wk [data-wk="overslaan"]');
  check('opnieuw overslaan: door naar de volgende overgeslagen vraag', (await huidigId()) === kl.sk[1], await huidigId());
  await klik('.wk [data-wk="overslaan"]');
  check('na de laatste overgeslagen vraag weer het klaar-scherm (geen eindeloze ronde)', await ev(() => document.querySelector('.wk').dataset.scherm === 'klaar' && /2 overgeslagen — bekijken/.test(document.querySelector('.wk').innerText)));

  // B3: voorsteltekst met de datum van de snapshot, feiten live en nooit tegenstrijdig; bij sets verkoop-besteld
  await P.goto(B + 'ivol.html?vers=' + Date.now() + '#/weekendcheck/i'); await P.waitForSelector('.wk[data-scherm="vraag"]', { timeout:30000 });
  await P.waitForFunction(() => window.WHWK && WHWK.S.live, null, { timeout:60000 });
  const f3 = await ev(async () => {
    const V = WHWK.S.snap.vragen.filter(v => v.d === 'i' && ['daan', 'voorstel'].includes(v.k)), pq = WHWK.S.snap.p, vr = await WH.catHaal('wh-voorraad');
    const tot = c => (vr.data.rows || []).filter(r => !r[3] && String(r[0]).trim().toLowerCase() === c.toLowerCase()).reduce((s, r) => s + (Number(r[2]) || 0), 0);
    const metVr = v => (pq[v.c] || []).some(f => /^voorraad/i.test(f));
    const zet = V.find(v => { const F = WHWK.liveFeiten(v.c); return F && metVr(v) && F.besteld !== null && F.gepickt < 0.5 && F.besteld >= 0.5; });
    const gewoon = V.find(v => { const F = WHWK.liveFeiten(v.c); return F && metVr(v) && F.gepickt >= 1; });
    const toon = v => { WHWK.S.deel = 'i'; WHWK.S.id = v.id; WHWK.render(document.getElementById('native'), 'i'); const F = WHWK.liveFeiten(v.c);
      return { feiten:[...document.querySelectorAll('.wk ul.feit li')].map(l => l.textContent), reden:(document.querySelector('[data-wk-reden]') || {}).textContent || '', vr:tot(v.c).toLocaleString('nl-NL'), gepickt:F.gepickt, besteld:F.besteld }; };
    const afw = V.find(v => { const m = /nog ([\d.]+) op voorraad/.exec(v.r || ''); return m && Number(m[1].replace(/\./g, '')) !== Number(tot(v.c)); });
    let sinds = null; if(afw){ const x = toon(afw), m = /nog ([\d.]+) op voorraad/.exec(afw.r); sinds = { tekst:(document.querySelector('[data-wk-sinds]') || {}).textContent || '', oud:m[1], nu:x.vr, reden:x.reden }; }
    return { zet:zet ? toon(zet) : null, gewoon:gewoon ? toon(gewoon) : null, gemaakt:WHWK.S.snap.gemaakt, sinds };
  });
  const feitCheck = (x, naam) => check(naam + ': feiten live (voorraad uit de database, één voorraadregel, geen oude snapshot-voorraad/verkoop ernaast)', !x || (x.feiten.filter(f => /^voorraad/.test(f)).length === 1 && x.feiten.some(f => new RegExp('^voorraad ' + x.vr.replace(/\./g, '\\.') + ' \\(live ').test(f)) && x.feiten.filter(f => /^uit de snapshot/.test(f)).every(f => !/voorraad \d|verkoop/i.test(f)) && !x.feiten.some(f => /^verkoop \d/.test(f))), x ? x.feiten.join(' | ').slice(0, 260) : 'geen product gevonden');
  feitCheck(f3.zet, 'product met verkoop-gepickt 0');
  feitCheck(f3.gewoon, 'gewoon product');
  check('voorsteltekst met de datum van de snapshot erbij', [f3.zet, f3.gewoon].filter(Boolean).every(x => /^Stand \d{1,2} .*\d{2}:\d{2} \(snapshot\): /.test(x.reden) && !/\b(AM|PM)\b/i.test(x.reden)), (f3.zet || f3.gewoon || {}).reden);
  check('voorsteltekst en feiten spreken elkaar niet tegen: wat sinds de snapshot veranderde (voorraad, verkoop) staat er expliciet bij', !f3.sinds || (f3.sinds.tekst.includes('voorraad ' + f3.sinds.oud + ' → ' + f3.sinds.nu) && /^Sinds de snapshot veranderd \(live .*\d{2}:\d{2}\)/.test(f3.sinds.tekst)), f3.sinds ? f3.sinds.tekst + ' | ' + f3.sinds.reden.slice(0, 120) : 'geen verschil gevonden');
  check('bij sets (verkoop-gepickt 0, wel besteld) staat verkoop-besteld in de feiten, naast gepickt 0,0/mnd', !f3.zet || f3.zet.feiten.some(f => /^verkoop-besteld [\d.,]+\/mnd · gepickt [\d.,]+\/mnd \(sets tellen zelf niet mee/.test(f)), f3.zet ? f3.zet.feiten[1] : 'geen set gevonden');
  check('gewoon product: verkoop gepickt en besteld', !f3.gewoon || f3.gewoon.feiten.some(f => /^verkoop gepickt [\d.,]+\/mnd · besteld [\d.,]+\/mnd/.test(f)), f3.gewoon ? f3.gewoon.feiten[1] : '');

  // 5 afgeleid per REGEL (Daan 23-11): één kaart per regel, Klopt = de regel voor alle producten eronder, Niet goed = typveld + Twijfels, nooit product voor product
  await P.goto(B + 'ivol.html?vers=' + Date.now() + '#/weekendcheck/afgeleid'); await P.waitForSelector('.wk[data-scherm="afgeleid"]', { timeout:30000 });
  const afg = await ev(() => ({ kaarten:document.querySelectorAll('.wk article.regel').length, regels:WHWK.regels().length, z:WHWK.vragen('afgeleid').length,
    som:WHWK.regels().reduce((n, r) => n + r.leden.length, 0), bron:WHWK.vragen('afgeleid').every(v => WHWK.ant(v) && WHWK.ant(v).bron === 'claude-afgeleid' && WHWK.ant(v).a === 'klopt'),
    knoppen:[...document.querySelectorAll('.wk article.regel')].every(k => k.querySelector('[data-wk="regelklopt"]') && k.querySelector('[data-wk="regelniet"]')),
    voorb:[...document.querySelectorAll('.wk article.regel')].every(k => { const n = k.querySelectorAll('[data-wk-vb] .vb').length; return n >= 1 && n <= 3 && n === Math.min(3, WHWK.regels().find(r => r.id === k.dataset.regel).leden.length); }),
    aantal:[...document.querySelectorAll('.wk article.regel')].every(k => /\d+ product/.test(k.innerText)), bekijk:document.querySelectorAll('.wk [data-wk="bekijk"]').length, vorigVolg:!!document.querySelector('.wk [data-wk="vorige"], .wk [data-wk="verder"]') }));
  check('"Afgeleid — bekijken": één kaart per regel (' + afg.kaarten + ' regels voor ' + afg.z + ' vragen), niet product voor product', afg.kaarten === afg.regels && afg.kaarten > 0 && afg.kaarten < afg.z / 3, afg.kaarten + ' kaarten, ' + afg.z + ' vragen');
  check('elke vraag valt onder precies één regel (som van de aantallen = alle afgeleide vragen)', afg.som === afg.z, afg.som + ' van ' + afg.z);
  check('afgeleid = vooraf "Klopt (afgeleid)" met bron claude-afgeleid', afg.bron);
  check('regelkaart: regel in één zin, aantal producten, 3 voorbeelden, knoppen Klopt en Niet goed', afg.knoppen && afg.voorb && afg.aantal);
  check('geen losse producten in de lijst zolang niets afwijkt, geen Vorige/Volgende per product', afg.bekijk === 0 && !afg.vorigVolg, afg.bekijk);
  check('afgeleid: 390 px zonder horizontaal scrollen', !(await hscroll()));
  // Klopt op de grootste regel: één rij voor de regel, niets per product
  const groot = await ev(() => { const r = WHWK.regels()[0]; return { id:r.id, n:r.leden.length, ids:r.leden.map(v => v.id) }; });
  const n0 = antw.length;
  await klik('.wk article.regel[data-regel="' + groot.id + '"] [data-wk="regelklopt"]'); await P.waitForTimeout(500);
  const rijen = antw.slice(n0).flatMap(x => x).filter(x => x.key === 'weekendcheck-antwoorden'), sleutels = [...new Set(rijen.flatMap(x => Object.keys(x.data)))].filter(k => k !== '_snapshot');
  check('Klopt op een regel: één antwoord-rij (id r-…, bron daan-regel), per product niets opgeslagen', sleutels.length === 1 && sleutels[0] === groot.id && rijen.every(x => x.data[groot.id].bron === 'daan-regel' && x.data[groot.id].a === 'klopt' && x.data[groot.id].n === groot.n), sleutels.slice(0, 3).join(','));
  const lid = await ev(id => { const v = WHWK.vragen('afgeleid').find(x => x.id === id), a = WHWK.ant(v); return { a:a.a, bron:a.bron, eigen:!!WHWK.S.ant[id] }; }, groot.ids[0]);
  check('regel goedgekeurd geldt voor alle producten eronder (bron daan-regel)', lid.a === 'klopt' && lid.bron === 'daan-regel' && !lid.eigen, JSON.stringify(lid));
  check('kaart toont de beoordeling en kan worden teruggenomen', await ev(id => { const k = document.querySelector('.wk article.regel[data-regel="' + id + '"]'); return /regel klopt/.test(k.innerText) && !!k.querySelector('[data-wk="regelterug"]'); }, groot.id));
  // Niet goed: typveld, regel gaat naar Twijfels
  const tweede = await ev(id => { const r = WHWK.regels().find(x => x.id !== id && x.leden.length >= 2) || WHWK.regels().find(x => x.id !== id); return { id:r.id, n:r.leden.length, lid:r.leden[0].id }; }, groot.id);
  await klik('.wk article.regel[data-regel="' + tweede.id + '"] [data-wk="regelniet"]');
  check('Niet goed opent een typveld', await ev(() => !!document.getElementById('wk-rw')));
  await P.fill('#wk-rw', 'dit is geen Pick maar Deel'); await klik('.wk [data-wk="regelbewaar"]'); await P.waitForTimeout(500);
  const rij2 = antw.slice(antw.length - 1).flatMap(x => x).find(x => x.data && x.data[tweede.id]);
  check('Niet goed: regel bewaard als twijfel met jouw tekst (bron daan-regel), voor alle producten eronder', !!rij2 && rij2.data[tweede.id].a === 'twijfel' && rij2.data[tweede.id].w === 'dit is geen Pick maar Deel' && await ev(id => WHWK.ant(WHWK.vragen('afgeleid').find(x => x.id === id)).a === 'twijfel', tweede.lid), JSON.stringify(rij2 && rij2.data[tweede.id]));
  check('Niet goed zonder tekst wordt niet bewaard', await ev(async () => { const r = WHWK.regels().find(x => !WHWK.S.ant[x.id]); if(!r) return true; document.querySelector('.wk article.regel[data-regel="' + r.id + '"] [data-wk="regelniet"]').click(); document.querySelector('.wk [data-wk="regelbewaar"]').click(); const nog = !!document.getElementById('wk-rw') && !WHWK.S.ant[r.id]; document.querySelector('.wk [data-wk="regelannuleer"]').click(); return nog; }));
  // een los product alleen als het afwijkt van zijn regel
  const afw = await ev(() => { const r = WHWK.regels().find(x => !WHWK.S.ant[x.id] && x.leden.length >= 2); const v = r.leden[0]; WHWK.S.ant[v.id] = { a:'aangepast', w:'Deel', t:new Date().toISOString(), bron:'daan' }; WHWK.render(document.getElementById('native'), 'afgeleid'); return { id:v.id, n:document.querySelectorAll('.wk [data-wk="bekijk"]').length, kaart:!!document.querySelector('.wk article.regel[data-regel="' + r.id + '"] [data-wk="bekijk"][data-id="' + v.id + '"]') }; });
  check('afgeleid: een product dat afwijkt van zijn regel staat los onder de regel (anders niet)', afw.n === 1 && afw.kaart, JSON.stringify(afw));
  await klik('.wk [data-wk="bekijk"]');
  check('afwijkend product: vraagscherm zonder Vorige/Volgende, met terugknop naar de regels', await ev(() => document.querySelector('.wk').dataset.scherm === 'vraag' && !document.querySelector('.wk [data-wk="vorige"], .wk [data-wk="verder"]') && !!document.querySelector('.wk [data-wk="afgterug"]') && !!document.querySelector('.wk [data-wk="aanpassen"]')));
  await klik('.wk [data-wk="afgterug"]');
  check('terug naar het regeloverzicht', await ev(() => document.querySelector('.wk').dataset.scherm === 'afgeleid'));
  await ev(id => { delete WHWK.S.ant[id]; }, afw.id);

  // 6 export voor Claude
  await P.goto(B + 'ivol.html#/weekendcheck'); await P.waitForSelector('.wk[data-scherm="start"]', { timeout:30000 });
  await ev(a => { a.forEach(r => Object.assign(WHWK.S.ant, r.data)); }, antw.flatMap(x => x));
  const dl = []; P.on('download', d => dl.push(d));
  await klik('.wk [data-wk="export"]'); await P.waitForTimeout(2000);
  let json = null, md = '';
  for(const d of dl){ const t = fs.readFileSync(await d.path(), 'utf8'); if(/\.json$/.test(d.suggestedFilename())) json = JSON.parse(t); else md = t; }
  check('export: weekendcheck-antwoorden.json + samenvatting .md', dl.map(d => d.suggestedFilename()).join(',') === 'weekendcheck-antwoorden.json,weekendcheck-samenvatting.md', dl.map(d => d.suggestedFilename()).join(','));
  const ex = json ? json.antwoorden : [];
  check('export: afgeleide antwoorden met bron claude-afgeleid (of daan-regel bij een beoordeelde regel) en zekerheid, regels apart', ex.filter(a => ['claude-afgeleid', 'daan-regel'].includes(a.bron) && ['klopt', 'twijfel'].includes(a.antwoord)).length >= afg.z - 1 && ex.some(a => a.zekerheid !== null) && (json.regels || []).length >= 2 && json.regels.some(r => r.antwoord === 'klopt') && json.regels.some(r => r.antwoord === 'twijfel'), ex.filter(a => a.bron === 'claude-afgeleid').length + ' / regels ' + (json.regels || []).length);
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
