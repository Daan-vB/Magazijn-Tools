// Te doen in tabs (08-11): Overzicht, Later, Picklocaties, Bulklocaties, Hercontrole, Gewicht controleren, Te wegen, Aantal per pallet + steekproef.
// Echte data inclusief Daans antwoorden alleen lezen; schrijven gaat naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start({ echt:true }); const P = T.p, B = process.env.PD2_URL || 'http://localhost:8811/';
  const ev = (f, a) => P.evaluate(f, a);
  const wacht = ms => P.waitForTimeout(ms);
  const laad = async tab => { await P.goto(B + 'ivol.html#/todo/' + tab); await P.reload(); await P.waitForFunction(() => window.WHCP && WHCP.tel && WHCP.tel() && document.querySelector('.cp-tabs'), null, { timeout:280000 }); await wacht(500); };
  const tekst = () => ev(() => document.querySelector('#native').innerText);
  const heeft = (tab, c) => ev(([t, c]) => (WHCP.cats()[t] || []).some(x => x.c === c), [tab, c]);
  // alleen deze producten aangevinkt in hun groep (de rest uitgevinkt), dan de groepsknop
  const alleen = (tab, codes) => ev(([tab, codes]) => { const gk = WHCP.cats()[tab].find(x => x.c === codes[0]).gk, el = document.querySelector('.cp-grp[data-gk="' + CSS.escape(gk) + '"]');
    el.querySelectorAll('[data-cp-sel]').forEach(i => { const c = i.dataset.cpSel.slice(tab.length + 1), aan = codes.includes(c); if(i.checked !== aan){ i.checked = aan; i.dispatchEvent(new Event('change', { bubbles:true })); } }); return gk; }, [tab, codes]);
  const groepKnop = (gk, actie, v) => ev(([gk, a, v]) => document.querySelector('.cp-grp[data-gk="' + CSS.escape(gk) + '"] [data-cp="' + a + '"]' + (v ? '[data-v="' + v + '"]' : '')).click(), [gk, actie, v || '']);
  // 1 Overzicht
  await laad('overzicht');
  let t = await tekst();
  const tabs = await ev(() => [...document.querySelectorAll('.cp-tab')].map(a => a.innerText.replace(/\s+/g, ' ').trim()));
  const nLater = await ev(() => WHCP.tel().later);
  check('tabs met teller, Overzicht eerst; tab weg bij 0', /^Overzicht/.test(tabs[0]) && tabs.some(x => /^Picklocaties \d+/.test(x)) && tabs.some(x => /^Aantal per pallet \d+/.test(x)) && (nLater > 0) === tabs.some(x => /^Later/.test(x)), tabs.join(' | '));
  check('Overzicht = Claudes analyse: per categorie aantal producten en groepen, uitleg en voorbeelden; Wat klopt; Jouw reactie', /3 Picklocaties · \d+ producten? in \d+ groep/.test(t) && /Bijvoorbeeld/.test(t) && /Wat klopt/.test(t) && /549 \/ 551 \/ 574/.test(t) && /Jouw reactie/.test(t), '');
  check('Overzicht: "Productdata in gebruik: 3.0 en Containers"', /Productdata in gebruik: 3\.0 en Containers/.test(t));
  check('Te doen: geen losse kaarten "Te controleren" of "Wacht op jouw tik" meer; wel taakkaart Stap 0.4', !/Wacht op jouw tik/.test(t) && !/producten met een schatting/i.test(t) && /0\.4/.test(t), '');
  await P.fill('#cp-reactie', 'Test: dit klopt niet'); await ev(() => document.querySelector('[data-cp="reactie"]').click()); await wacht(800);
  check('Jouw reactie wordt bewaard (met datum)', T.mock['wh-controle-reacties'] && T.mock['wh-controle-reacties'].lijst.some(r => /dit klopt niet/.test(r.tekst) && r.op), '');
  // 3 Picklocaties: per groep "Pick nodig in hal · gedeelte · gang"
  await laad('picklocaties');
  check('Picklocaties: KOKOS100BLK-24 (open of klaar voor Picqer) en DT140-711', (await heeft('picklocaties', 'KOKOS100BLK-24') || await heeft('pickklaar', 'KOKOS100BLK-24')) && await heeft('picklocaties', 'DT140-711'));
  let gk = await alleen('picklocaties', ['DT140-711']); await wacht(600);
  const kies = async (veld, w) => { await ev(([gk, veld, w]) => { const s = document.querySelector('.cp-grp[data-gk="' + CSS.escape(gk) + '"] [data-cp-k$="|' + veld + '"]'); s.value = w; s.dispatchEvent(new Event('change', { bubbles:true })); }, [gk, veld, w]); await wacht(500); };
  // kiezen = opslaan (09-11): hal → gedeelte → gang; het kiezen van de gang bewaart meteen (geen knop "Pick nodig")
  await kies('opm', 'nieuwe pick naast de ingang'); await kies('hal', 'C'); await kies('deel', 'D'); await kies('gang', 'DD'); await wacht(2000);
  const wens = T.pdWrites.find(r => r.productcode === 'DT140-711' && r.data && r.data.pickwens);
  check('pickwens {hal, gedeelte, gang, opm} bewaard in productdata (bron pd2) met kopie -8', wens && wens.data.pickwens.hal === 'C' && wens.data.pickwens.ged === 'D' && wens.data.pickwens.gang === 'DD' && /ingang/.test(wens.data.pickwens.opm) && wens.meta.pickwens.bron === 'pd2' && Object.keys(T.mock).some(k => /^wh-kopie-productdata-\d{4}-\d{2}-\d{2}-8$/.test(k)), JSON.stringify(wens && wens.data.pickwens));
  check('na Pick nodig: DT140-711 uit de open lijst, de rest van de groep blijft staan', !(await heeft('picklocaties', 'DT140-711')) && await heeft('pickklaar', 'DT140-711') && await heeft('picklocaties', 'DT140-747'));
  await ev(() => { const f = document.querySelector('[data-cp-f="hal"]'); f.value = 'C'; f.dispatchEvent(new Event('change', { bubbles:true })); }); await wacht(600);
  await ev(() => { const f = document.querySelector('[data-cp-f="deel"]'); f.value = 'D'; f.dispatchEvent(new Event('change', { bubbles:true })); }); await wacht(600);
  await ev(() => { const g = document.querySelector('[data-cp-f="gang"]'); g.value = 'DD'; g.dispatchEvent(new Event('change', { bubbles:true })); }); await wacht(600);
  const werk = await ev(() => (document.getElementById('cp-klaar') || {}).innerText || '');
  check('filter hal C → gedeelte D → gang DD: werklijst "Klaar voor Picqer" met DT140-711 onder Hal C · gedeelte D · gang DD', /DT140-711/.test(werk) && /Hal C · gedeelte D · gang DD/.test(werk), werk.slice(0, 200));
  // 4 Bulklocaties (Daan beslist live verder: zijn eerdere "alleen bulk" alleen in het geheugen weggehaald, zodat er weer open punten zijn)
  await laad('bulklocaties');
  await ev(() => { Object.keys(WHCP.S.klopt).filter(k => /^bulkeraf\|/.test(k)).forEach(k => delete WHCP.S.klopt[k]); WHCP.S.memo = null; WHTAAK.herteken(); }); await wacht(500);
  const bx = await ev(() => { const x = WHCP.cats().bulklocaties[0]; return x ? { c:x.c, reden:x.reden, loc:x.loc } : null; });
  check('Bulklocaties: soort Bulk met een picklocatie in Picqer, met die locatie in de reden', bx && /Soort Bulk, maar Picqer heeft picklocatie/.test(bx.reden) && bx.reden.includes(bx.loc), JSON.stringify(bx));
  if(bx){
    gk = await alleen('bulklocaties', [bx.c]); await wacht(500); await groepKnop(gk, 'g-bulkok'); await wacht(1500);
    const eraf = await ev(c => ({ lijst:WHCP.cats().bulkeraf.map(x => x.c), meer:WHCP.cats().bulklocaties.some(x => x.c === c), werk:(document.getElementById('cp-klaar') || {}).innerText || '' }), bx.c);
    check('"Alleen bulk (picklocatie eraf)" zet het op de werklijst "Klaar voor Picqer" (met locatie)', eraf.lijst.includes(bx.c) && !eraf.meer && eraf.werk.includes(bx.loc), JSON.stringify(eraf.lijst.slice(0, 5)));
  }
  // 5 Hercontrole (Daan beslist live verder: E400560-10KG als Weg · Archief en TRAILER10 als Pick alleen in het geheugen nagebootst)
  await laad('hercontrole');
  await ev(() => { const t = new Date().toISOString(), zet = (c, so) => { PD2R.S.o.p[c] = Object.assign({ f:{} }, PD2R.S.o.p[c] || {}, so); PD2R.ongeldig(c); };
    if(WH.D.P['E400560-10KG'] && !WHCP.cats().hercontrole.some(x => x.c === 'E400560-10KG')) zet('E400560-10KG', { so:{ v:'weg', st:'aangepast', t }, weg:{ v:'archief', st:'aangepast', t } });
    if(!WHCP.cats().hercontrole.some(x => x.c === 'TRAILER10')) zet('TRAILER10', { so:{ v:'pick', st:'aangepast', t } });
    Object.keys(WHCP.S.klopt).filter(k => /^hercontrole\|(TRAILER10|E400560-10KG)$/.test(k)).forEach(k => delete WHCP.S.klopt[k]); WHCP.S.memo = null; WHTAAK.herteken(); }); await wacht(500);
  const her = await ev(() => Object.fromEntries(['TRAILER10', 'E400560-10KG', 'KOKOS200NAT', 'SM90X120CM'].map(c => [c, (WHCP.cats().hercontrole.find(x => x.c === c) || {})])));
  check('Hercontrole: TRAILER10 met voorstel Deel', her.TRAILER10.voorstel && her.TRAILER10.voorstel.soort === 'deel', her.TRAILER10.reden);
  check('Hercontrole: E400560-10KG, KOKOS200NAT en SM90X120CM staan erin, elk met Claudes visie', !!her['E400560-10KG'].c && !!her.KOKOS200NAT.c && !!her.SM90X120CM.c && /1\.955/.test(her.SM90X120CM.reden || '') && [her['E400560-10KG'], her.KOKOS200NAT, her.SM90X120CM].every(x => x.redenen.every(r => r.visie)), [her['E400560-10KG'].reden, her.KOKOS200NAT.reden, her.SM90X120CM.reden].join(' || '));
  check('549-1-135-reeks staat niet in Hercontrole (alleen bij "Wat klopt")', !(await ev(() => WHCP.cats().hercontrole.some(x => /^549-1-135/.test(x.c)))));
  gk = await alleen('hercontrole', ['TRAILER10']); await wacht(500); await groepKnop(gk, 'g-neem'); await wacht(1800);
  const tr = await ev(() => ({ so:PD2R.po('TRAILER10') && PD2R.po('TRAILER10').so, nog:WHCP.cats().hercontrole.some(x => x.c === 'TRAILER10') }));
  check('Voorstel overnemen: TRAILER10 wordt Deel (aangepast, door Daan), kopie gemaakt, verdwijnt uit de tab', tr.so && tr.so.v === 'deel' && tr.so.st === 'aangepast' && !tr.nog, JSON.stringify(tr.so));
  // 6 Gewicht controleren
  await laad('gewicht');
  const gw = await ev(() => Object.fromEntries(['1711-white-set', '3028-4'].map(c => [c, (WHCP.cats().gewicht.find(x => x.c === c) || {})])));
  check('Gewicht controleren: 1711-white-set met voorstel 0,045 kg (kleurgenoten, zelfde maat)', gw['1711-white-set'].voorstel && /0,045/.test(gw['1711-white-set'].voorstel.tekst), gw['1711-white-set'].voorstel && gw['1711-white-set'].voorstel.tekst);
  check('Gewicht controleren: 3028-4 (Picqer leeg, andere maat dan 3028-3/-5) staat erin zonder voorstel: Naar Te wegen', !!gw['3028-4'].c && !gw['3028-4'].voorstel, gw['3028-4'].reden);
  gk = await alleen('gewicht', ['3028-4']); await wacht(500); await groepKnop(gk, 'g-tewegen'); await wacht(1800);
  check('Naar Te wegen: gewicht op te wegen, product in de tab Te wegen', (await ev(() => PD2R.po('3028-4').gew)).st === 'tewegen' && await heeft('tewegen', '3028-4'));
  // 7 Te wegen: per groep en familie, binnen de familie op locatie (looproute)
  await laad('tewegen');
  await ev(() => document.querySelectorAll('.cp-det').forEach(d => { d.open = true; })); await wacht(300);
  const route = await ev(() => [...document.querySelectorAll('.cp-famblok')].map(f => [...f.querySelectorAll('.cp-item')].map(i => (WHCP.cats().tewegen.find(x => x.c === i.dataset.c) || {}).loc || 'ZZZ')));
  check('Te wegen: binnen elke familie gesorteerd op locatie (looproute)', route.length > 3 && route.every(l => l.every((g, i) => i === 0 || l[i - 1] <= g)), JSON.stringify(route.slice(0, 3)));
  const c0 = await ev(() => document.querySelector('.cp-item[data-cat="tewegen"]').dataset.c);
  await P.fill(`[data-cp-kg="${c0}"]`, '2,5'); await wacht(200);
  gk = await alleen('tewegen', [c0]); await wacht(500); await groepKnop(gk, 'g-gewogen'); await wacht(1800);
  check('gewogen gewicht invullen: status gewogen met kg', (await ev(c => PD2R.po(c).gew, c0)).st === 'gewogen' && (await ev(c => PD2R.po(c).gew.kg, c0)) === 2.5);
  // 8 Aantal per pallet + Klopt zo blijft weg na herladen
  await laad('aantal');
  check('Aantal per pallet: 100030-969 en PBVF-100x150-GREY', await heeft('aantal', '100030-969') && await heeft('aantal', 'PBVF-100x150-GREY'));
  gk = await alleen('aantal', ['100030-969']); await wacht(500); await groepKnop(gk, 'g-klopt'); await wacht(1500);
  check('"Klopt zo (verschil is terecht)" haalt het weg en wordt bewaard', !(await heeft('aantal', '100030-969')) && T.mock['wh-controle-klopt'] && T.mock['wh-controle-klopt'].items['aantal|100030-969'], '');
  await laad('aantal');
  check('na herladen blijft "Klopt zo" weg', !(await heeft('aantal', '100030-969')));
  // groep in één klik met vinkjes (uitvinken kan)
  await laad('hercontrole');
  const voor = await ev(() => WHCP.cats().hercontrole.length);
  await ev(() => { const sec = [...document.querySelectorAll('.cp-grp')].find(f => f.querySelectorAll('[data-cp-sel]').length >= 2); const cb = sec.querySelector('[data-cp-sel]'); cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles:true })); });
  await wacht(600);
  await ev(() => { const sec = [...document.querySelectorAll('.cp-grp')].find(f => /uitgevinkt/.test(f.innerText)); sec.querySelector('[data-cp="g-klopt"]').click(); });
  await wacht(2500);
  const na = await ev(() => WHCP.cats().hercontrole.length);
  check('groep in één klik met vinkjes (uitvinken kan): de uitgevinkte bleef over', na < voor && na >= 1, voor + ' → ' + na);
  // 14 Steekproef
  await laad('overzicht');
  await ev(() => document.querySelector('[data-cp="steekmaken"]').click()); await wacht(2000);
  const sp = await ev(() => ({ n:(WHCP.S.steek && WHCP.S.steek.codes || []).length, ab:(WHCP.S.steek.codes || []).filter(x => /^[AB]$/.test(x.abc)).length }));
  check('Steekproef maken kiest 20 producten (A/B eerst) uit tab 3–8 als vloerlijst', sp.n === 20, JSON.stringify(sp));
  for(let i = 0; i < 20; i++){ await ev(() => { const b = [...document.querySelectorAll('[data-cp="sp-klopt"]')].find(x => !x.closest('.cp-kn').querySelector('.ok')); if(b) b.click(); }); await wacht(500); }
  await wacht(1500);
  await laad('overzicht');
  check('20 gecontroleerd met 0 fouten = groen', await ev(() => WHCP.poortSteek().groen) && /GROEN/.test(await tekst()), JSON.stringify(await ev(() => WHCP.poortSteek())));
  await P.goto(B + 'ivol.html#/taak/0.4'); await P.reload(); await P.waitForFunction(() => /gecontroleerd/.test(document.body.innerText), null, { timeout:200000 }).catch(() => {}); await wacht(1500);
  check('Poort 0.4: steekproef staat niet meer open (groen)', !/nog niet gemaakt: Te doen/.test(await ev(() => document.body.innerText)) && !/gecontroleerd · [1-9]\d* fouten/.test(await ev(() => document.body.innerText)));
  // 390 en 1440 px
  for(const vp of [{ width:1440, height:900 }, { width:390, height:844 }]){
    await P.setViewportSize(vp);
    for(const tab of ['overzicht', 'picklocaties', 'hercontrole', 'tewegen']){
      await laad(tab);
      check('Te doen ' + tab + ' ' + vp.width + ' px: geen horizontaal scrollen', !(await ev(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#native *')].some(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1; }))));
    }
  }
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 3)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|locaties\.js/.test(e)).slice(0, 4).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
