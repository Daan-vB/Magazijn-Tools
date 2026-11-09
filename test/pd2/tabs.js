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
  // 1 Overzicht
  await laad('overzicht');
  let t = await tekst();
  const tabs = await ev(() => [...document.querySelectorAll('.cp-tab')].map(a => a.innerText.replace(/\s+/g, ' ').trim()));
  check('tabs met teller, Overzicht eerst; tab weg bij 0 (Later is leeg)', /^Overzicht/.test(tabs[0]) && tabs.some(x => /^Picklocaties \d+/.test(x)) && tabs.some(x => /^Aantal per pallet \d+/.test(x)) && !tabs.some(x => /^Later/.test(x)), tabs.join(' | '));
  check('Overzicht = Claudes analyse: per categorie aantal, uitleg en voorbeelden; Wat klopt; Jouw reactie', /3 Picklocaties · \d+/.test(t) && /Bijvoorbeeld/.test(t) && /Wat klopt/.test(t) && /549 \/ 551 \/ 574/.test(t) && /Jouw reactie/.test(t), '');
  check('Overzicht: "Productdata in gebruik: 3.0 en Containers"', /Productdata in gebruik: 3\.0 en Containers/.test(t));
  check('Te doen: geen losse kaarten "Te controleren" of "Wacht op jouw tik" of "Later · moet nog" meer; wel taakkaart Stap 0.4', !/Wacht op jouw tik/.test(t) && !/producten met een schatting/i.test(t) && !/Later · moet nog/.test(t) && /0\.4/.test(t), '');
  await P.fill('#cp-reactie', 'Test: dit klopt niet'); await ev(() => document.querySelector('[data-cp="reactie"]').click()); await wacht(800);
  check('Jouw reactie wordt bewaard (met datum)', T.mock['wh-controle-reacties'] && T.mock['wh-controle-reacties'].lijst.some(r => /dit klopt niet/.test(r.tekst) && r.op), '');
  // 3 Picklocaties
  await laad('picklocaties');
  check('Picklocaties: KOKOS100BLK-24 en DT140-711', await heeft('picklocaties', 'KOKOS100BLK-24') && await heeft('picklocaties', 'DT140-711'));
  await ev(() => { const k = document.querySelector('.cp-item[data-c="DT140-711"]'); k.querySelector('[data-cp-hal]').value = 'C'; k.querySelector('[data-cp-gang]').value = 'DD'; k.querySelector('[data-cp-opm]').value = 'nieuwe pick naast de ingang'; k.querySelector('[data-cp="wens"]').click(); });
  await wacht(1500);
  const wens = T.pdWrites.find(r => r.productcode === 'DT140-711' && r.data && r.data.pickwens);
  check('pickwens {hal, gang, opm} bewaard in productdata (bron pd2) met kopie -8', wens && wens.data.pickwens.hal === 'C' && wens.data.pickwens.gang === 'DD' && wens.meta.pickwens.bron === 'pd2' && Object.keys(T.mock).some(k => /^wh-kopie-productdata-\d{4}-\d{2}-\d{2}-8$/.test(k)), JSON.stringify(wens && wens.data.pickwens));
  await ev(() => { document.querySelector('[data-cp-f="hal"]').value = 'C'; document.querySelector('[data-cp-f="hal"]').dispatchEvent(new Event('change', { bubbles:true })); });
  await wacht(600);
  await ev(() => { const g = document.querySelector('[data-cp-f="gang"]'); g.value = 'DD'; g.dispatchEvent(new Event('change', { bubbles:true })); });
  await wacht(600);
  const werk = await ev(() => ({ lijst:(document.querySelector('.cp-werk') || {}).innerText || '', kaarten:[...document.querySelectorAll('.cp-item')].map(e => e.dataset.c) }));
  check('filter op hal C en gang DD geeft de werklijst met DT140-711', /DT140-711/.test(werk.lijst) && werk.kaarten.includes('DT140-711'), werk.lijst);
  // 4 Bulklocaties
  await laad('bulklocaties');
  const bg = await ev(() => (WHCP.cats().bulklocaties.find(x => x.c === 'BGB100150-BLA') || {}).reden);
  check('Bulklocaties: BGB100150-BLA met picklocatie BB03D00', /BB03D00/.test(bg || ''), bg);
  await ev(() => document.querySelector('.cp-item[data-c="BGB100150-BLA"] [data-cp="bulk-ok"]').click()); await wacht(1200);
  const eraf = await ev(() => ({ lijst:WHCP.cats().bulkeraf.map(x => x.c), meer:WHCP.cats().bulklocaties.some(x => x.c === 'BGB100150-BLA') }));
  check('"Klopt, alleen bulk" zet het op de lijst "Picklocatie eraf in Picqer" (met locatie)', eraf.lijst.includes('BGB100150-BLA') && !eraf.meer, JSON.stringify(eraf.lijst));
  // 5 Hercontrole
  await laad('hercontrole');
  const her = await ev(() => Object.fromEntries(['TRAILER10', 'E400560-10KG', 'KOKOS200NAT', 'SM90X120CM'].map(c => [c, (WHCP.cats().hercontrole.find(x => x.c === c) || {})])));
  check('Hercontrole: TRAILER10 met voorstel Deel', her.TRAILER10.voorstel && her.TRAILER10.voorstel.soort === 'deel', her.TRAILER10.reden);
  check('Hercontrole: E400560-10KG, KOKOS200NAT en SM90X120CM staan erin', !!her['E400560-10KG'].c && !!her.KOKOS200NAT.c && !!her.SM90X120CM.c && /1\.955/.test(her.SM90X120CM.reden || ''), [her['E400560-10KG'].reden, her.KOKOS200NAT.reden, her.SM90X120CM.reden].join(' || '));
  check('549-1-135-reeks staat niet in Hercontrole (alleen bij "Wat klopt")', !(await ev(() => WHCP.cats().hercontrole.some(x => /^549-1-135/.test(x.c)))));
  await ev(() => document.querySelector('.cp-item[data-c="TRAILER10"] [data-cp="neem"]').click()); await wacht(1500);
  const tr = await ev(() => ({ so:PD2R.po('TRAILER10') && PD2R.po('TRAILER10').so, nog:WHCP.cats().hercontrole.some(x => x.c === 'TRAILER10' && x.voorstel && x.voorstel.soort) }));
  check('Neem voorstel over: TRAILER10 wordt Deel (aangepast, door Daan), kopie gemaakt, verdwijnt uit de tab', tr.so && tr.so.v === 'deel' && tr.so.st === 'aangepast' && !tr.nog, JSON.stringify(tr.so));
  // 6 Gewicht controleren
  await laad('gewicht');
  const gw = await ev(() => Object.fromEntries(['1711-white-set', '3028-4'].map(c => [c, (WHCP.cats().gewicht.find(x => x.c === c) || {})])));
  check('Gewicht controleren: 1711-white-set met voorstel 0,045 kg', gw['1711-white-set'].voorstel && /0,045/.test(gw['1711-white-set'].voorstel.tekst), gw['1711-white-set'].voorstel && gw['1711-white-set'].voorstel.tekst);
  check('Gewicht controleren: 3028-4 (Picqer leeg) staat erin met voorstel', !!gw['3028-4'].c && !!gw['3028-4'].voorstel, gw['3028-4'].reden);
  await ev(() => document.querySelector('.cp-item[data-c="3028-4"] [data-cp="tewegen"]').click()); await wacht(1500);
  check('Naar Te wegen: gewicht op te wegen, product in de tab Te wegen', (await ev(() => PD2R.po('3028-4').gew)).st === 'tewegen' && await heeft('tewegen', '3028-4'));
  // 7 Te wegen: gesorteerd op locatie
  await laad('tewegen');
  const route = await ev(() => WHCP.cats().tewegen.filter(x => x.loc).map(x => x.loc.slice(0, 2)));
  check('Te wegen: gesorteerd op hal/gang (looproute)', route.length > 3 && route.every((g, i) => i === 0 || route[i - 1] <= g), route.slice(0, 8).join(' '));
  const c0 = await ev(() => document.querySelector('.cp-item[data-cat="tewegen"]').dataset.c);
  await P.fill(`.cp-item[data-c="${c0}"] [data-cp-kg]`, '2,5'); await ev(c => document.querySelector(`.cp-item[data-c="${c}"] [data-cp="gewogen"]`).click(), c0); await wacht(1500);
  check('gewogen gewicht invullen: status gewogen met kg', (await ev(c => PD2R.po(c).gew, c0)).st === 'gewogen' && (await ev(c => PD2R.po(c).gew.kg, c0)) === 2.5);
  // 8 Aantal per pallet + Klopt zo blijft weg na herladen
  await laad('aantal');
  check('Aantal per pallet: 100030-969 en PBVF-100x150-GREY', await heeft('aantal', '100030-969') && await heeft('aantal', 'PBVF-100x150-GREY'));
  await ev(() => document.querySelector('.cp-item[data-c="100030-969"] [data-cp="klopt"]').click()); await wacht(1200);
  check('"Klopt zo, verschil is terecht" haalt het weg en wordt bewaard (met kopie vooraf bij herhaling)', !(await heeft('aantal', '100030-969')) && T.mock['wh-controle-klopt'] && T.mock['wh-controle-klopt'].items['aantal|100030-969'], '');
  await laad('aantal');
  check('na herladen blijft "Klopt zo" weg', !(await heeft('aantal', '100030-969')));
  // groep in één klik met vinkjes
  await laad('hercontrole');
  const voor = await ev(() => WHCP.cats().hercontrole.length);
  await ev(() => { const sec = [...document.querySelectorAll('.cp-fam')].find(f => f.querySelectorAll('.cp-item').length >= 2) || document.querySelector('.cp-fam'); const cb = sec.querySelector('[data-cp-sel]'); cb.checked = false; sec.querySelector('[data-cp="groep-klopt"]').click(); });
  await wacht(2500);
  const na = await ev(() => WHCP.cats().hercontrole.length);
  check('groep in één klik met vinkjes (uitvinken kan): één product bleef over', na < voor && na >= 1, voor + ' → ' + na);
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
