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
  // één product kiezen binnen zijn familiekaart (de rest uitvinken) en op de knop van de kaart tikken
  const alleenDit = async (cat, c, a, extra) => { await ev(([cat, c]) => { const f = document.querySelector(`.cp-fam[data-cat="${cat}"] .cp-item[data-c="${CSS.escape(c)}"]`).closest('.cp-fam'); f.querySelectorAll('.cp-item').forEach(e => { if(e.dataset.c !== c) WHCP.S.uit[cat + '|' + e.dataset.c] = true; else delete WHCP.S.uit[cat + '|' + c]; }); WHTAAK.herteken(); }, [cat, c]); await wacht(500); await ev(([cat, c, a, ex]) => { const f = document.querySelector(`.cp-fam[data-cat="${cat}"] .cp-item[data-c="${CSS.escape(c)}"]`).closest('.cp-fam'); f.querySelector(`[data-cp="${a}"]${ex || ''}`).click(); }, [cat, c, a, extra]); await wacht(2200); };
  const heeft = (tab, c) => ev(([t, c]) => (WHCP.cats()[t] || []).some(x => x.c === c), [tab, c]);
  // 1 Overzicht
  await laad('overzicht');
  let t = await tekst();
  const tabs = await ev(() => [...document.querySelectorAll('.cp-tab')].map(a => a.innerText.replace(/\s+/g, ' ').trim()));
  check('tabs met teller, Overzicht eerst; tab weg bij 0 (Later telt mee als er iets op staat)', /^Overzicht/.test(tabs[0]) && tabs.some(x => /^Picklocaties \d+/.test(x)) && tabs.some(x => /^Aantal per pallet \d+/.test(x)) && tabs.some(x => /^Later \d+/.test(x)) === ((await ev(() => WHCP.tel().later)) > 0), tabs.join(' | '));
  check('Overzicht = Claudes analyse: per categorie aantal, uitleg en voorbeelden; Wat klopt; Jouw reactie', /3 Picklocaties · \d+/.test(t) && /Bijvoorbeeld/.test(t) && /Wat klopt/.test(t) && /549 \/ 551 \/ 574/.test(t) && /Jouw reactie/.test(t), '');
  check('Overzicht: "Productdata in gebruik: 3.0 en Containers"', /Productdata in gebruik: 3\.0 en Containers/.test(t));
  check('Te doen: geen losse kaarten "Te controleren" of "Wacht op jouw tik" of "Later · moet nog" meer; wel taakkaart Stap 0.4', !/Wacht op jouw tik/.test(t) && !/producten met een schatting/i.test(t) && !/Later · moet nog/.test(t) && /0\.4/.test(t), '');
  await P.fill('#cp-reactie', 'Test: dit klopt niet'); await ev(() => document.querySelector('[data-cp="reactie"]').click()); await wacht(800);
  check('Jouw reactie wordt bewaard (met datum)', T.mock['wh-controle-reacties'] && T.mock['wh-controle-reacties'].lijst.some(r => /dit klopt niet/.test(r.tekst) && r.op), '');
  // 1 hallen en 2 per familie: Picklocaties
  const strip = re => ev(re => { Object.keys(WHPD.S.pd).forEach(c => { if(new RegExp(re).test(c) && WHPD.S.pd[c].data && WHPD.S.pd[c].data.pickwens){ delete WHPD.S.pd[c].data.pickwens; } }); WHCP.S.memo = null; WHTAAK.herteken(); }, re);
  await laad('picklocaties'); await strip('^KOKOS|^DT140-711'); await wacht(1200);
  const keuzen = await ev(() => [...document.querySelectorAll('select')].map(s => ({ n:s.dataset.cpF || s.dataset.cpK, o:[...s.options].map(o => o.text) })));
  check('geen "hal D" in keuzes of filters: hal = alle/A/B/C, gedeelte C/D', keuzen.filter(k => k.n === 'hal').every(k => k.o.join() === 'alle,A,B,C' || k.o.join() === 'kies,A,B,C'), JSON.stringify(keuzen.filter(k => k.n === 'hal').map(k => k.o.join())));
  const kok = await ev(() => { const f = [...document.querySelectorAll('.cp-fam[data-cat="picklocaties"]')].find(x => /^Kokos op rol/.test(x.dataset.fam)); return f ? { fam:f.dataset.fam, n:f.querySelectorAll('.cp-item').length, aan:f.querySelectorAll('[data-cp-sel]:checked').length, sel:f.querySelector('.cp-sel').innerText.replace(/\s+/g, ' '), codes:[...f.querySelectorAll('.cp-item')].map(e => e.dataset.c) } : null; });
  check('Kokos staat als één familiekaart met alle producten aangevinkt en "n producten"', kok && kok.n >= 10 && kok.aan === kok.n && /\d+ producten/.test(await ev(() => document.querySelector('.cp-fam[data-cat="picklocaties"] h3').innerText)), kok && kok.n + '/' + kok.aan);
  check('voorstel voor Kokos: hal C · gedeelte D · gang DD, met reden', kok && /Selectie is:/.test(kok.sel) && /Pick nodig in hal C · gedeelte D · gang DD/.test(kok.sel) && /Voorstel: hal C · gedeelte D · gang DD — daar hebben/.test(kok.sel), kok && kok.sel.slice(0, 260));
  // uitvinken voor een uitzondering, dan "Selectie is: Pick nodig" bewaren
  await ev(() => { const f = [...document.querySelectorAll('.cp-fam[data-cat="picklocaties"]')].find(x => /^Kokos op rol/.test(x.dataset.fam)); f.querySelector('.cp-item[data-c="KOKOS200NAT"] [data-cp-sel]').click(); }); await wacht(900);
  const nTel0 = await ev(() => WHCP.tel().picklocaties);
  await ev(() => { const f = [...document.querySelectorAll('.cp-fam[data-cat="picklocaties"]')].find(x => /^Kokos op rol/.test(x.dataset.fam)); f.querySelector('[data-cp="g-wens"]').click(); }); for(let i = 0; i < 60 && T.pdWrites.filter(r => /^KOKOS/.test(r.productcode)).length < kok.n - 1; i++) await wacht(500); await wacht(1500);
    const kw = T.pdWrites.filter(r => /^KOKOS/.test(r.productcode) && r.data && r.data.pickwens);
  check('"Pick nodig" bewaart voor alle aangevinkte Kokos (hal C, gedeelte D, gang DD) en niet voor de uitgevinkte', kw.length === kok.n - 1 && kw.every(r => r.data.pickwens.hal === 'C' && r.data.pickwens.ged === 'D' && r.data.pickwens.gang === 'DD' && r.meta.pickwens.bron === 'pd2') && !kw.some(r => r.productcode === 'KOKOS200NAT'), kw.length + ' van ' + (kok.n - 1));
  check('kopie vooraf (wh-kopie-productdata-…-8)', Object.keys(T.mock).some(k => /^wh-kopie-productdata-\d{4}-\d{2}-\d{2}-8$/.test(k)));
  const na1 = await ev(() => ({ tel:WHCP.tel().picklocaties, klaar:WHCP.tel().klaar.picklocaties, kok:WHCP.cats().picklocaties.filter(x => /^KOKOS/.test(x.c) && !/^KOKOS80120/.test(x.c)).map(x => x.c), tekst:document.getElementById('cp-klaar-pick') ? document.getElementById('cp-klaar-pick').innerText : '' }));
  check('beslist = weg uit de open lijst: tab telt af, de uitgevinkte blijft staan', na1.tel === nTel0 - (kok.n - 1) && na1.kok.join() === 'KOKOS200NAT', nTel0 + ' → ' + na1.tel + ' · over: ' + na1.kok.join());
  check('"Klaar voor Picqer (n)" toont Kokos onder hal C · gedeelte D · gang DD', /Klaar voor Picqer\s*\d+/.test(na1.tekst) && /Hal C · gedeelte D · gang DD\s*\d+\s*KOKOS/.test(na1.tekst.replace(/\n+/g, ' ')) || /Hal C · gedeelte D · gang DD/.test(na1.tekst) && /KOKOS100BLK-24/.test(na1.tekst), na1.tekst.replace(/\n+/g, ' ').slice(0, 200));
  // oude pickwens met hal D lezen als hal C, gedeelte D (niet herschrijven)
  await ev(() => { WHPD.S.pd['DT140-711'].data = Object.assign({}, WHPD.S.pd['DT140-711'].data, { pickwens:{ hal:'D', gang:'DD', opm:'oud' } }); WHCP.S.memo = null; WHTAAK.herteken(); }); await wacht(1000);
  const oud = await ev(() => { const x = WHCP.cats().pickklaar.find(y => y.c === 'DT140-711'); return x ? { w:x.wens, t:document.getElementById('cp-klaar-pick').innerText.replace(/\n+/g, ' ') } : null; });
  check('pickwens met hal "D" wordt gelezen als hal C · gedeelte D (DT140-711), onaangeroerd opgeslagen', oud && oud.w.hal === 'D' && /Hal C · gedeelte D · gang DD[^]*DT140-711/.test(oud.t) && !T.pdWrites.some(r => r.productcode === 'DT140-711'), oud && oud.t.slice(0, 120));
  // filters: hal C → gedeelte D → alleen echte gangen
  await ev(() => { const h = document.querySelector('[data-cp-f="hal"]'); h.value = 'C'; h.dispatchEvent(new Event('change', { bubbles:true })); }); await wacht(700);
  await ev(() => { const h = document.querySelector('[data-cp-f="ged"]'); h.value = 'D'; h.dispatchEvent(new Event('change', { bubbles:true })); }); await wacht(700);
  const gg = await ev(() => [...document.querySelector('[data-cp-f="gang"]').options].map(o => o.text).slice(1));
  check('filter hal C · gedeelte D: alleen gangen DA–DE (DD staat onder hal C gedeelte D)', gg.join() === 'DA,DB,DC,DD,DE', gg.join());
  await ev(() => { const g = document.querySelector('[data-cp-f="gang"]'); g.value = 'DD'; g.dispatchEvent(new Event('change', { bubbles:true })); }); await wacht(700);
  const werk = await ev(() => [...document.querySelectorAll('#cp-klaar-pick .cp-werk')].map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 60)));
  check('filter op gang DD geeft de werklijst met alleen gang DD', werk.length === 1 && /gang DD/.test(werk[0]), werk.join(' | '));
  // Wijzig: terug naar de open lijst
  await ev(() => { document.querySelector('#cp-klaar-pick [data-cp="wijzig"][data-c="KOKOS100BLK-24"]').click(); }); await wacht(2500);
  check('"Wijzig" zet het product terug in de open lijst met de eerdere keuze', await heeft('picklocaties', 'KOKOS100BLK-24') && !(await ev(() => WHCP.cats().pickklaar.some(x => x.c === 'KOKOS100BLK-24'))));
  // Andere soort voor de selectie
  await laad('picklocaties'); await strip('^KOKOS'); await wacht(800);
  await ev(() => { const f = [...document.querySelectorAll('.cp-fam[data-cat="picklocaties"]')].find(x => /^Kokos op rol/.test(x.dataset.fam)); f.querySelectorAll('[data-cp-sel]').forEach((c, i) => { if(i > 0) c.click(); }); }); await wacht(600);
  // 4 Bulklocaties: PBVF als familie in één keer
  await laad('bulklocaties');
  const bg = await ev(() => (WHCP.cats().bulklocaties.find(x => x.c === 'BGB100150-BLA') || {}).reden);
  check('Bulklocaties: BGB100150-BLA met picklocatie BB03D00', /BB03D00/.test(bg || ''), bg);
  const pb = await ev(() => { const f = [...document.querySelectorAll('.cp-fam[data-cat="bulklocaties"]')].find(x => x.querySelector('.cp-item[data-c^="PBVF"]')); return f ? { n:f.querySelectorAll('.cp-item').length, codes:[...f.querySelectorAll('.cp-item')].map(e => e.dataset.c), sel:f.querySelector('.cp-sel').innerText.replace(/\s+/g, ' ') } : null; });
  check('PBVF staat als familie bij elkaar, "Selectie is: alleen bulk (picklocatie eraf in Picqer)" en "Fout, wordt: Deel / Pallet"', pb && pb.n >= 2 && /Selectie is: alleen bulk \(picklocatie eraf in Picqer\)/.test(pb.sel) && /Fout, wordt/.test(pb.sel), pb && pb.n + ' ' + pb.sel.slice(0, 120));
  const bTel0 = await ev(() => WHCP.tel().bulklocaties);
  await ev(() => { const f = [...document.querySelectorAll('.cp-fam[data-cat="bulklocaties"]')].find(x => x.querySelector('.cp-item[data-c^="PBVF"]')); f.querySelector('[data-cp="g-bulk"]').click(); }); await wacht(2500);
  const eraf = await ev(() => ({ tel:WHCP.tel().bulklocaties, klaar:WHCP.tel().klaar.bulklocaties, lijst:WHCP.cats().bulkeraf.map(x => x.c), tekst:document.getElementById('cp-klaar-bulk') ? document.getElementById('cp-klaar-bulk').innerText.replace(/\n+/g, ' ') : '' }));
  check('"Alleen bulk" voor de hele familie: tab telt af en ze staan onder "Klaar voor Picqer" bij hun gang (met locatie)', pb && pb.codes.every(c => eraf.lijst.includes(c)) && eraf.tel === bTel0 - pb.n && /Klaar voor Picqer/.test(eraf.tekst) && /Hal B · gang BB/.test(eraf.tekst) && /PBVF/.test(eraf.tekst) && /BB\d\d[A-D]\d\d/.test(eraf.tekst), bTel0 + ' → ' + eraf.tel + ' · ' + eraf.tekst.slice(0, 160));
  // 5 Hercontrole
  await laad('hercontrole');
  const her = await ev(() => Object.fromEntries(['TRAILER10', 'E400560-10KG', 'KOKOS200NAT', 'SM90X120CM'].map(c => [c, (WHCP.cats().hercontrole.find(x => x.c === c) || {})])));
  check('Hercontrole: TRAILER10 met voorstel Deel', her.TRAILER10.voorstel && her.TRAILER10.voorstel.soort === 'deel', her.TRAILER10.reden);
  check('Hercontrole: E400560-10KG, KOKOS200NAT en SM90X120CM staan erin', !!her['E400560-10KG'].c && !!her.KOKOS200NAT.c && !!her.SM90X120CM.c && /1\.955/.test(her.SM90X120CM.reden || ''), [her['E400560-10KG'].reden, her.KOKOS200NAT.reden, her.SM90X120CM.reden].join(' || '));
  check('549-1-135-reeks staat niet in Hercontrole (alleen bij "Wat klopt")', !(await ev(() => WHCP.cats().hercontrole.some(x => /^549-1-135/.test(x.c)))));
  await alleenDit('hercontrole', 'TRAILER10', 'g-neem');
  const tr = await ev(() => ({ so:PD2R.po('TRAILER10') && PD2R.po('TRAILER10').so, nog:WHCP.cats().hercontrole.some(x => x.c === 'TRAILER10' && x.voorstel && x.voorstel.soort) }));
  check('Neem voorstel over: TRAILER10 wordt Deel (aangepast, door Daan), kopie gemaakt, verdwijnt uit de tab', tr.so && tr.so.v === 'deel' && tr.so.st === 'aangepast' && !tr.nog, JSON.stringify(tr.so));
  // 6 Gewicht controleren
  await laad('gewicht');
  const gw = await ev(() => Object.fromEntries(['1711-white-set', '3028-4'].map(c => [c, (WHCP.cats().gewicht.find(x => x.c === c) || {})])));
  check('Gewicht controleren: 1711-white-set met voorstel 0,045 kg', gw['1711-white-set'].voorstel && /0,045/.test(gw['1711-white-set'].voorstel.tekst), gw['1711-white-set'].voorstel && gw['1711-white-set'].voorstel.tekst);
  check('Gewicht controleren: 3028-4 (Picqer leeg) staat erin met voorstel', !!gw['3028-4'].c && !!gw['3028-4'].voorstel, gw['3028-4'].reden);
  await alleenDit('gewicht', '3028-4', 'g-tewegen');
  check('Naar Te wegen: gewicht op te wegen, product in de tab Te wegen', (await ev(() => PD2R.po('3028-4').gew)).st === 'tewegen' && await heeft('tewegen', '3028-4'));
  // 7 Te wegen: gesorteerd op locatie
  await laad('tewegen');
  const fams = await ev(() => [...document.querySelectorAll('.cp-fam[data-cat="tewegen"]')].map(f => ({ fam:f.dataset.fam, locs:[...f.querySelectorAll('.cp-item code')].map(c => c.innerText).filter(x => x !== 'geen locatie') })));
  check('Te wegen: per familie gegroepeerd, binnen de familie op locatie', fams.length > 3 && fams.every(f => f.locs.every((l, i) => i === 0 || f.locs[i - 1] <= l)), fams.length + ' families');
  const c0 = await ev(() => document.querySelector('.cp-item[data-cat="tewegen"]').dataset.c);
  await P.fill(`.cp-item[data-c="${c0}"] [data-cp-kg]`, '2,5'); await ev(c => document.querySelector(`.cp-item[data-c="${c}"] [data-cp="gewogen"]`).click(), c0); await wacht(1500);
  check('gewogen gewicht invullen: status gewogen met kg', (await ev(c => PD2R.po(c).gew, c0)).st === 'gewogen' && (await ev(c => PD2R.po(c).gew.kg, c0)) === 2.5);
  // 8 Aantal per pallet + Klopt zo blijft weg na herladen
  await laad('aantal');
  check('Aantal per pallet: 100030-969 en PBVF-100x150-GREY', await heeft('aantal', '100030-969') && await heeft('aantal', 'PBVF-100x150-GREY'));
  await alleenDit('aantal', '100030-969', 'g-klopt');
  check('"Klopt zo, verschil is terecht" haalt het weg en wordt bewaard (met kopie vooraf bij herhaling)', !(await heeft('aantal', '100030-969')) && T.mock['wh-controle-klopt'] && T.mock['wh-controle-klopt'].items['aantal|100030-969'], '');
  await laad('aantal');
  check('na herladen blijft "Klopt zo" weg', !(await heeft('aantal', '100030-969')));
  // groep in één tik met vinkjes: Gewicht controleren en Aantal per pallet per familie
  for(const [tab, cat] of [['gewicht', 'gewicht'], ['aantal', 'aantal']]){
    await laad(tab);
    const voor = await ev(cat => WHCP.tel()[cat], cat);
    const grp = await ev(cat => { const f = [...document.querySelectorAll(`.cp-fam[data-cat="${cat}"]`)].find(x => new Set([...x.querySelectorAll('.cp-item')].map(e => e.dataset.c)).size >= 2); if(!f) return null; return { n:new Set([...f.querySelectorAll('.cp-item')].map(e => e.dataset.c)).size, uit:f.querySelector('.cp-item').dataset.c, sel:f.querySelector('.cp-sel').innerText.replace(/\s+/g, ' ') }; }, cat);
    if(!grp){ check(tab + ': familie met meerdere producten', false, 'geen'); continue; }
    check(tab + ': kaart toont "Selectie is: …" en "n producten"', /Selectie is:/.test(grp.sel), grp.sel.slice(0, 100));
    await ev(([cat, c]) => { const f = document.querySelector(`.cp-fam[data-cat="${cat}"] .cp-item[data-c="${CSS.escape(c)}"]`).closest('.cp-fam'); WHCP.S.uit[cat + '|' + c] = true; WHTAAK.herteken(); }, [cat, grp.uit]); await wacht(700);
    await ev(([cat, c]) => { const f = document.querySelector(`.cp-fam[data-cat="${cat}"] .cp-item[data-c="${CSS.escape(c)}"]`).closest('.cp-fam'); f.querySelector('[data-cp="g-klopt"]').click(); }, [cat, grp.uit]); await wacht(2500);
    const na = await ev(cat => ({ tel:WHCP.tel()[cat], nog:WHCP.cats()[cat].some(x => true) }), cat);
    check(tab + ': met één tik de hele familie beslist, uitgevinkt product blijft staan (' + voor + ' → ' + na.tel + ')', na.tel === voor - (grp.n - 1) && await heeft(cat, grp.uit));
  }
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
    for(const tab of ['overzicht', 'picklocaties', 'bulklocaties', 'hercontrole', 'tewegen']){
      await laad(tab);
      check('Te doen ' + tab + ' ' + vp.width + ' px: geen horizontaal scrollen', !(await ev(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#native *')].some(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1; }))));
    }
  }
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 3)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|locaties\.js/.test(e)).slice(0, 4).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
