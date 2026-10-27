// Doet elke oefening via de echte UI, met echte data (database, alleen lezen); schrijven alleen naar een kopie van wh-pd2-*
const { start, open } = require('./opzet.js');
const SCRATCH = process.env.UIT_MAP || '.';
const ok = [], fout = [];
const check = (naam, v, extra) => { (v ? ok : fout).push(naam + (extra ? ' — ' + extra : '')); console.log((v ? 'OK   ' : 'FOUT ') + naam + (extra ? ' — ' + extra : '')); };
(async () => {
  const T = await start(); const P = T.p;
  P.on('dialog', d => d.accept());
  await open(T);
  const ev = (f, a) => P.evaluate(f, a);
  const ui = o => ev(o => { Object.assign(WHPD2.UI, o); WHPD2.teken(); }, o);
  const done = (tab, id) => ev(([t, i]) => !!(PD2R.S.o.oef[t] && PD2R.S.o.oef[t][i]), [tab, id]);
  const rij = c => P.locator(`#pd2-lijst tr[data-c="${c}"]`);
  const lijst = () => ev(() => [...document.querySelectorAll('#pd2-lijst tbody tr[data-c]')].map(t => t.dataset.c));
  const tab = async t => { await P.click(`#pd2-tabs [data-a="tab"][data-v="${t}"]`); await P.waitForTimeout(150); };
  const st = c => ev(c => { const s = PD2R.status(c); return { af:s.af, open:s.open, so:s.so, soSt:s.soSt, gew:s.gew.st }; }, c);
  const vul = async (c, k, v, d) => { const l = rij(c).locator(`[data-k="${k}"]${d ? `[data-d="${d}"]` : ''}`).first(); await l.fill(String(v)); await l.press('Tab'); await P.waitForTimeout(120); };
  const kies = async (c, k, v) => { await rij(c).locator(`select[data-k="${k}"]`).first().selectOption(v); await P.waitForTimeout(150); };
  const modalOk = async () => { await P.click('.pd2-modal [data-m="ok"]'); await P.waitForTimeout(150); };

  /* ===== 1 Pallet ===== */
  await tab('pallet');
  await P.click('[data-a="toon"][data-id="p1"]'); await P.waitForTimeout(300);
  // maat met pallet-producten
  const tegels = await ev(() => WHPD2.maatgroepen().map(m => [m.k, m.per.pallet || 0]));
  const mt = (tegels.find(x => x[1] > 0) || tegels[0]);
  await P.click(`.pd2-tegel[data-a="maat"][data-v="${mt[0]}"]`); await P.waitForTimeout(200);
  if(await ev(() => WHPD2.UI.tab) !== 'pallet') await tab('pallet');
  let rijen = await lijst();
  check('Pallet: FWB-maat ' + mt[0] + ' heeft pallet-producten', rijen.length > 0, rijen.length + ' rijen');
  const voor = await ev(cs => cs.map(c => PD2R.po(c) ? JSON.stringify(PD2R.po(c)) : null), rijen);
  await P.check('#pd2-lijst [data-a="selalle"]'); await P.waitForTimeout(100);
  await P.click('#pd2-actie [data-a="selklopt"]'); await P.waitForTimeout(250);
  check('Pallet: opdracht p1 (Selectie klopt) vinkt zichzelf af', await done('pallet', 'p1'));
  const naKlopt = await Promise.all(rijen.map(st));
  check('Selectie klopt bevestigt de soort', naKlopt.every(s => ['bevestigd', 'aangepast', 'vastgelegd'].includes(s.soSt)), JSON.stringify(naKlopt[0]));
  check('Gewicht blijft open na Selectie klopt (geen product afgerond zonder gewicht)', naKlopt.every(s => !s.af && s.open.includes('gewicht')));
  check('Ongedaan-melding staat er', await P.isVisible('#pd2-undo'));
  await P.click('#pd2-undo [data-a="ongedaan"]'); await P.waitForTimeout(200);
  const naUndo = await ev(cs => cs.map(c => PD2R.po(c) ? JSON.stringify(PD2R.po(c)) : null), rijen);
  check('Ongedaan herstelt de rijen precies', JSON.stringify(naUndo) === JSON.stringify(voor));
  // opnieuw, en daarna p2: stuks per pallet aanpassen → gewicht volle pallet rekent mee
  await P.check('#pd2-lijst [data-a="selalle"]'); await P.click('#pd2-actie [data-a="selklopt"]'); await P.waitForTimeout(250);
  rijen = await lijst();
  const c1 = rijen[0];
  const sppOud = await ev(c => PD2R.waarde(c, 'spp').v, c1);
  const nieuw = (parseInt(sppOud) || 40) + 7;
  await vul(c1, 'spp', nieuw);
  const gp = await ev(c => ({ cel:document.querySelector(`#pd2-lijst tr[data-c="${CSS.escape(c)}"] td.c-calc:nth-last-child(3)`)?.textContent, calc:PD2R.calc(c, 'gewpal').v, kg:PD2R.gewicht(c).kg, spp:PD2R.waarde(c, 'spp') }), c1);
  check('Pallet: stuks per pallet aangepast, status "aangepast"', gp.spp.st === 'aangepast' && +gp.spp.v === nieuw, JSON.stringify(gp.spp));
  check('Pallet: gewicht volle pallet = stuks × kg + 15', !gp.kg || +gp.calc === Math.ceil(nieuw * gp.kg + 15), gp.calc + ' = ' + nieuw + ' × ' + gp.kg + ' + 15');
  check('Pallet: opdracht p2 gedaan', await done('pallet', 'p2'));
  // p3: één product naar Deel
  const c2 = rijen[rijen.length - 1];
  await kies(c2, 'soort', 'deel');
  check('Pallet: product naar Deel verdwijnt uit de Pallet-lijst', !(await lijst()).includes(c2));
  check('Pallet: opdracht p3 gedaan', await done('pallet', 'p3'));
  // gewicht bevestigen maakt niets afgerond als er nog velden open zijn
  const open1 = await ev(() => { const c = WHPD2.selCodes().find(c => { const s = PD2R.status(c); return !s.af && s.open.length > 1 && s.open.includes('gewicht'); }); return c; });
  await ev(c => { WHPD2.UI.sel = new Set([c]); WHPD2.verversAlles(); }, open1);
  await P.click('#pd2-actie [data-a="gewklopt"]'); await P.waitForTimeout(200);
  const so1 = await st(open1);
  check('Gewichten kloppen maakt een product met open velden niet afgerond', so1.gew === 'vertrouwd' && !so1.af, JSON.stringify(so1.open));
  await ev(() => { WHPD2.UI.sel.clear(); WHPD2.verversAlles(); });

  /* ===== 2 Deel ===== */
  await tab('deel');
  await P.click('[data-a="toon"][data-id="d1"]'); await P.waitForTimeout(300);
  const d1 = await ev(() => ({ fk:WHPD2.UI.fk, mk:WHPD2.UI.mk, tab:WHPD2.UI.tab }));
  check('Deel: Toon opent Schoonloopmat Mars 120x180', /mars/.test(d1.fk) && d1.mk === '120x180', JSON.stringify(d1));
  check('Deel: opdracht d1 gedaan', await done('deel', 'd1'));
  const ant = await ev(() => Object.keys(WH.D.P).find(c => /schoonloopmat antraciet - mars - 120\s*x\s*180/i.test(WH.D.P[c].naam || '')));
  const antS = await ev(c => PD2R.soortWaarde(c), ant);
  check('Mars 120x180 Antraciet: voorstel Deel', antS.v === 'deel', JSON.stringify(antS));
  const marsMaten = await ev(() => WHPD2.maatgroepen().length);
  check('Schoonloopmat Mars: 8 maatgroepen', marsMaten === 8, String(marsMaten));
  check('Antraciet staat in de Deel-lijst', (await lijst()).includes(ant));
  await vul(ant, 'lvl', 10); await vul(ant, 'maxpick', 50);
  const am = await ev(c => PD2R.calc(c, 'aanvmet'), ant);
  check('Deel: aanvullen met = max − bij = 40', am.v === '40', JSON.stringify(am));
  check('Deel: opdracht d2 gedaan', await done('deel', 'd2'));
  // hoogte 190 op een 20-locatie in hal A (AF11A20): waarschuwing (opdracht p4)
  await vul(ant, 'hoogte', 185);
  const hw = await ev(c => ({ v:PD2R.waarde(c, 'hoogte').v, w:document.querySelector(`#pd2-lijst tr[data-c="${c}"] td[data-kc="hoogte"] .pd2-w`)?.textContent }), ant);
  check('Hoogte naar boven afgerond op 10 cm', hw.v === '190', hw.v);
  check('Hoogte-waarschuwing bij 20-locatie hal A', /140/.test(hw.w || ''), hw.w);
  check('Pallet: opdracht p4 gedaan', await done('pallet', 'p4'));
  // d3: inkoopverpakking 15 doos, aanvullen met geen veelvoud
  await vul(ant, 'verp', 15, 'n'); await rij(ant).locator('select[data-k="verp"]').selectOption('doos'); await P.waitForTimeout(200);
  await vul(ant, 'lvl', 8);
  const am2 = await ev(c => PD2R.calc(c, 'aanvmet'), ant);
  check('Deel: waarschuwing als aanvullen met geen veelvoud van de doos is', /veelvoud/.test(am2.warn || ''), am2.v + ' · ' + am2.warn);
  check('Deel: opdracht d3 gedaan', await done('deel', 'd3'));
  await kies(ant, 'pickc', 'geenpick');
  const antSt = await st(ant);
  check('Deel: geen pick → bij en max niet meer nodig', !antSt.open.includes('lvl') && !antSt.open.includes('maxpick'), JSON.stringify(antSt.open));
  check('Deel: opdracht d4 gedaan', await done('deel', 'd4'));

  /* ===== 3 Pick ===== */
  await ui({ zoek:'', fk:null, mk:null, scope:'belangrijk', aandacht:null, tab:'pick' });
  rijen = await lijst();
  const pk = await ev(cs => cs.find(c => PD2R.info(c).f.pick.length), rijen);
  await kies(pk, 'pickc', 'klopt');
  check('Pick: opdracht k1 (picklocatie klopt) gedaan', await done('pick', 'k1'));
  await P.click('[data-a="aandacht"][data-v="zonderpick"]'); await P.waitForTimeout(250);
  const zp = (await lijst())[0];
  check('Aandacht "zonder picklocatie" filtert de lijst', !!zp && await ev(c => !PD2R.info(c).f.pick.length, zp));
  await kies(zp, 'pickc', 'moetpick');
  check('Pick: opdracht k2 (moet pick krijgen) gedaan', await done('pick', 'k2'));
  await ui({ aandacht:null, tab:'pick' });
  const pk2 = (await lijst())[0];
  await vul(pk2, 'maxpick', 12);
  check('Pick: opdracht k3 (max op pick) gedaan', await done('pick', 'k3'));

  /* ===== 4 Mix ===== */
  await ui({ zoek:'', fk:null, mk:null, tab:'mix' });
  rijen = (await lijst()).slice(0, 3);
  await ev(cs => { WHPD2.UI.sel = new Set(cs); WHPD2.verversAlles(); }, rijen);
  await P.click('#pd2-actie [data-a="kolom"]'); await P.selectOption('#pd2-kk', 'mixgroep'); await P.fill('#pd2-kv', 'Test oefengroep'); await modalOk();
  check('Mix: opdracht m1 (3 producten zelfde mixgroep) gedaan', await ev(() => { WHPD2.teken(); return !!(PD2R.S.o.oef.mix && PD2R.S.o.oef.mix.m1); }));
  await ev(() => { WHPD2.UI.sel.clear(); WHPD2.verversAlles(); });
  const mx = (await lijst())[3] || (await lijst())[0];
  await rij(mx).locator('select[data-k="mixgroep"]').selectOption('__nieuw'); await P.waitForTimeout(150);
  await P.fill('#pd2-mgn', 'Nieuwe oefengroep'); await modalOk();
  check('Mix: nieuwe mixgroep gekozen', (await ev(c => PD2R.waarde(c, 'mixgroep').v, mx)) === 'Nieuwe oefengroep');
  check('Mix: opdracht m2 gedaan', await done('mix', 'm2'));
  await P.click('#pd2-lijst [data-a="mgregel"]'); await P.waitForTimeout(150); await P.click('.pd2-modal [data-m="nee"]');
  check('Mix: opdracht m3 gedaan', await done('mix', 'm3'));

  /* ===== 5 Weg ===== */
  await tab('weg');
  await P.click('[data-a="toon"][data-id="w1"]'); await P.waitForTimeout(300);
  if(await ev(() => WHPD2.UI.tab) !== 'weg') await tab('weg');
  rijen = await lijst();
  check('Weg: Waterhog zonder voorraad staat in Weg', rijen.length > 0 && await ev(c => /waterhog/i.test(PD2R.naamVan(c)), rijen[0]), rijen.length + ' rijen');
  await kies(rijen[0], 'weg', 'backorder');
  check('Weg: opdracht w1 (Backorder) gedaan', await done('weg', 'w1'));
  await kies(rijen[1], 'weg', 'archief');
  check('Weg: opdracht w2 (Archief) gedaan', await done('weg', 'w2'));
  const wst = await st(rijen[0]);
  check('Weg: alleen de keuze → afgerond', wst.af, JSON.stringify(wst));
  await P.click('#pd2-lijst [data-a="map"][data-v="backorder"]'); await P.waitForTimeout(150);
  check('Weg: map Backorder toont het product', (await lijst()).includes(rijen[0]));
  await rij(rijen[0]).locator('[data-a="wegterug"]').click(); await P.waitForTimeout(200);
  check('Weg: terugzetten haalt het uit de map', !(await lijst()).includes(rijen[0]) && !(await ev(c => PD2R.status(c).af, rijen[0])));
  check('Weg: opdracht w3 gedaan', await done('weg', 'w3'));

  /* ===== Rollen ===== */
  await tab('rollen');
  await P.click('[data-a="toon"][data-id="r1"]'); await P.waitForTimeout(300);
  const rt = await ev(() => WHPD2.UI.tab);
  rijen = await lijst();
  const kr = await ev(cs => cs.find(c => PD2R.rolKand(c) && !PD2R.rolBesl(c)), rijen);
  check('Rollen: Kokos-product met chip "rol?" in tab ' + rt, !!kr, kr);
  await rij(kr).locator('[data-a="rol"][data-v="1"]').click(); await P.waitForTimeout(200);
  check('Rollen: opdracht r1 (is rol) gedaan', await done('rollen', 'r1'));
  await tab('rollen');
  check('Rollen: product staat in Rollen', (await lijst()).includes(kr));
  check('Rollen: product staat ook nog in zijn soort-tab', await ev(([c, t]) => WHPD2.tabCodes(t).includes(c), [kr, rt]));
  await vul(kr, 'rb', 100); await vul(kr, 'rl', 25); await vul(kr, 'rkg', 50);
  const kgm = await ev(c => PD2R.calc(c, 'kgm').v, kr);
  check('Rollen: kg per meter = 50 / 25 = 2', kgm === '2' || kgm === '2,000', kgm);
  await ev(() => WHPD2.teken());
  check('Rollen: opdracht r2 gedaan', await done('rollen', 'r2'));
  await kies(kr, 'rstand', 'staand');
  check('Rollen: opdracht r3 gedaan', await done('rollen', 'r3'));

  /* ===== Afgerond ===== */
  // een Pick-product helemaal afronden: alle voorstellen kloppen + gewicht vertrouwd
  await ui({ zoek:'', fk:null, mk:null, scope:'belangrijk', aandacht:null, tab:'pick' });
  const ap = await ev(() => WHPD2.tabCodes('pick').find(c => { const I = PD2R.info(c); return I.f.pick.length && I.ink && !PD2R.isSam(c) && !PD2R.rolKand(c); }));
  await ev(c => { WHPD2.UI.sel = new Set([c]); WHPD2.verversAlles(); }, ap);
  await P.click('#pd2-actie [data-a="selklopt"]'); await P.waitForTimeout(200);
  const apA = await st(ap);
  check('Afgerond: na Selectie klopt nog niet af (gewicht open)', !apA.af && apA.open.join() === 'gewicht', JSON.stringify(apA.open));
  check('Pick-product na Selectie klopt nog in de Pick-lijst', (await lijst()).includes(ap));
  await rij(ap).locator('[data-a="gew"]').click(); await P.click('.pd2-modal [data-gst="vertrouwd"]'); await modalOk();
  check('Afgerond: na gewicht vertrouwd → afgerond', (await st(ap)).af);
  check('Afgerond: blijft zichtbaar met ✓ tot je van groep wisselt', (await lijst()).includes(ap));
  await tab('afgerond');
  check('Afgerond: staat in de tab Afgerond', (await lijst()).includes(ap));
  check('Afgerond: opdracht a1 gedaan', await done('afgerond', 'a1'));
  await rij(ap).locator('[data-a="heropen"]').click(); await P.waitForTimeout(200);
  check('Afgerond: heropenen haalt hem uit Afgerond', !(await lijst()).includes(ap) && await ev(c => WHPD2.tabCodes('pick').includes(c), ap));
  check('Afgerond: opdracht a2 gedaan', await done('afgerond', 'a2'));
  // a3: afronden met gewicht te wegen
  await tab('pick');
  const ap2 = await ev(x => WHPD2.tabCodes('pick').find(c => c !== x && PD2R.info(c).f.pick.length && PD2R.info(c).ink && !PD2R.isSam(c) && !PD2R.rolKand(c)), ap);
  await ev(c => { WHPD2.UI.sel = new Set([c]); WHPD2.verversAlles(); }, ap2);
  await P.click('#pd2-actie [data-a="selklopt"]'); await P.waitForTimeout(200);
  await rij(ap2).locator('[data-a="gew"]').click(); await P.click('.pd2-modal [data-gst="tewegen"]'); await modalOk();
  const a3 = await st(ap2);
  check('Afgerond met ⚖: te wegen telt als besproken', a3.af && a3.gew === 'tewegen');
  await ev(() => WHPD2.teken());
  check('Afgerond: opdracht a3 gedaan', await done('afgerond', 'a3'));
  check('Weeglijst: opdracht g2 (te wegen) gedaan', await done('weeglijst', 'g2'));

  /* ===== Weeglijst ===== */
  await tab('pick');
  const two = (await lijst()).slice(0, 2);
  await ev(cs => { WHPD2.UI.sel = new Set(cs); WHPD2.verversAlles(); }, two);
  await P.click('#pd2-actie [data-a="gewpop"]'); await P.fill('#pd2-gp', '1,5'); await P.click('.pd2-modal [data-gst="gewogen"]'); await modalOk();
  const g1 = await ev(cs => cs.map(c => PD2R.gewicht(c)), two);
  check('Gewichten aanpassen…: 1,5 kg gewogen voor de selectie', g1.every(g => g.st === 'gewogen' && g.kg === 1.5), JSON.stringify(g1));
  check('Weeglijst: opdracht g1 gedaan', await done('weeglijst', 'g1'));
  await ev(() => { WHPD2.UI.sel.clear(); WHPD2.verversAlles(); });
  await tab('weeglijst');
  check('Weeglijst: opdracht g3 gedaan', await done('weeglijst', 'g3'));
  const wl = await lijst();
  check('Weeglijst toont het te-wegen product, gegroepeerd per hal', wl.includes(ap2) && await P.isVisible('.pd2-wl h3'));
  await rij(ap2).locator('[data-a="gewogen"]').fill('2,25'); await rij(ap2).locator('[data-a="gewogen"]').press('Tab'); await P.waitForTimeout(200);
  const g4 = await ev(c => PD2R.gewicht(c), ap2);
  check('Weeglijst: gewogen kg invullen → status gewogen', g4.st === 'gewogen' && g4.kg === 2.25, JSON.stringify(g4));
  check('Weeglijst: opdracht g4 gedaan', await done('weeglijst', 'g4'));

  /* ===== feedback, opmerkingen, aannames ===== */
  await tab('deel');
  await P.click('#pd2-oef details.pd2-vragen-d > summary');
  await P.click('#pd2-oef [data-a="fb"][data-k="layout"][data-v="bijna"]');
  await P.fill('#pd2-fb-mis', 'Test: ik mis de laatste besteldatum'); await P.press('#pd2-fb-mis', 'Tab');
  await P.click('#pd2-oef [data-a="fb"][data-k="gevoel"][data-v="4"]');
  const fb = await ev(() => PD2R.S.fb.tabs.deel);
  check('Vier vragen bewaard in feedback', fb && fb.layout === 'bijna' && fb.gevoel === '4' && /besteldatum/.test(fb.mis), JSON.stringify(fb));
  await ui({ zoek:'schoonloopmat mars', fk:await ev(c => PD2R.famVan(c), ant), mk:'120x180', tab:'deel' });
  await rij(ant).locator('td[data-kc="maat"] select').focus();
  await rij(ant).locator('[data-a="opm"]').click(); await P.fill('#pd2-opm-t', 'Test: palletmaat klopt niet'); await modalOk();
  const opm = await ev(() => PD2R.S.fb.opm.slice(-1)[0]);
  check('💬 per rij: tab, product en kolom gaan mee', opm && opm.tab === 'deel' && opm.code === ant && opm.kolom === 'maat', JSON.stringify(opm));
  await P.click('#pd2-oef [data-a="opmtab"]'); await P.fill('#pd2-opm-t', 'Test: opmerking bij de tab'); await modalOk();
  await P.click('.pd2-aan[data-id="soortkol"] >> nth=0'); await P.click('.pd2-modal [data-av="nee"]'); await P.fill('#pd2-aopm', 'Test: liever een knop'); await modalOk();
  check('Aanname afkeuren bewaard', await ev(() => PD2R.S.fb.aann.soortkol && PD2R.S.fb.aann.soortkol.v === 'nee'));

  /* ===== tellers ===== */
  await ui({ zoek:'', fk:null, mk:null, scope:'belangrijk', aandacht:null });
  await tab('pallet');
  const tel = await ev(() => { const knop = {}; document.querySelectorAll('#pd2-tabs [data-a="tab"]').forEach(b => knop[b.dataset.v] = +b.querySelector('i').textContent.replace(/\./g, '')); const lijst = {}; ['pallet', 'deel', 'pick', 'mix', 'weg', 'rollen', 'afgerond', 'weeglijst'].forEach(t => lijst[t] = WHPD2.tabCodes(t).length); return { knop, lijst }; });
  check('Tellers per tab = aantal in de lijst', JSON.stringify(tel.knop) === JSON.stringify(tel.lijst), JSON.stringify(tel));
  const totaal = await ev(() => WHPD2.selCodes().length);
  check('Elk product staat in precies één soort-tab of Afgerond', ['pallet', 'deel', 'pick', 'mix', 'weg', 'afgerond'].reduce((s, t) => s + tel.lijst[t], 0) === totaal, totaal);

  /* ===== kopieer alles voor Claude ===== */
  await P.click('[data-a="kopieer"]'); await P.waitForTimeout(400);
  const tekst = await P.textContent('.pd2-modal pre');
  check('Kopieer alles voor Claude geeft leesbare tekst', /== Tab 1 Pallet ==/.test(tekst) && /== Voorstellen/.test(tekst) && tekst.includes(ant + ' · Palletmaat: Test: palletmaat klopt niet') && /stuks per pallet: \d+× klopt/i.test(tekst), tekst.length + ' tekens');
  require('fs').writeFileSync(SCRATCH + '/claude-tekst.txt', tekst);
  await P.click('.pd2-modal [data-m="nee"]');

  /* ===== opslag ===== */
  await ev(() => PD2R.flush()); await P.waitForTimeout(800); await ev(() => PD2R.flush());
  check('Alleen geschreven naar wh-pd2-oefen en wh-pd2-feedback', T.blocked.length === 0 && T.writes.length > 0 && T.writes.every(k => /^wh-pd2-(oefen|feedback)$/.test(k)), 'writes ' + T.writes.length + ', geblokkeerd ' + T.blocked.length + ' ' + T.blocked.slice(0, 3).join(' | '));
  check('wh-pd2-oefen bevat de geoefende producten', Object.keys((T.mock['wh-pd2-oefen'] || {}).p || {}).length > 5);
  check('wh-pd2-feedback bevat opmerkingen', ((T.mock['wh-pd2-feedback'] || {}).opm || []).length >= 2);
  // herladen: alles staat er nog (uit de opslag)
  await P.reload(); await P.waitForFunction(() => window.PD2R && PD2R.S.klaar && document.getElementById('pd2-lijst'), null, { timeout:120000 });
  check('Na herladen staat de oefendata er nog', await ev(c => PD2R.status(c).af === false && PD2R.waarde(c, 'lvl').v === '8', ant));
  // wissen
  await P.click('[data-a="wissen"]'); await P.waitForTimeout(800);
  check('Oefendata wissen: wh-pd2-oefen leeg, feedback blijft', Object.keys(T.mock['wh-pd2-oefen'].p).length === 0 && T.mock['wh-pd2-feedback'].opm.length >= 2);
  console.log('\nERRORS:\n' + T.errors.join('\n'));
  console.log('\n' + ok.length + ' OK, ' + fout.length + ' FOUT');
  require('fs').writeFileSync(SCRATCH + '/oef-uitslag.json', JSON.stringify({ ok, fout, errors:T.errors, blocked:T.blocked }, null, 1));
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
