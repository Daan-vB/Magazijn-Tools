// Doet elke oefening via de echte UI (kaarten, maattegels, groepsbalk, oefenkaartje), met echte data (database, alleen lezen);
// schrijven alleen naar een kopie van wh-pd2-*
const { start, open } = require('./opzet.js');
const SCRATCH = process.env.UIT_MAP || '.';
const ok = [], fout = [];
const check = (naam, v, extra) => { (v ? ok : fout).push(naam + (extra ? ' — ' + extra : '')); console.log((v ? 'OK   ' : 'FOUT ') + naam + (extra ? ' — ' + extra : '')); };
(async () => {
  const T = await start(); const P = T.p;
  P.on('dialog', d => d.accept());
  await open(T);
  const ev = (f, a) => P.evaluate(f, a);
  const wacht = (ms = 150) => P.waitForTimeout(ms);
  const done = (tab, id) => ev(([t, i]) => !!(PD2R.S.o.oef[t] && PD2R.S.o.oef[t][i]), [tab, id]);
  const kaart = c => P.locator(`article.pd2-kaart[data-c="${c}"]`);
  const kaarten = () => ev(() => [...document.querySelectorAll('article.pd2-kaart[data-c]')].map(t => t.dataset.c));
  const st = c => ev(c => { const s = PD2R.status(c); return { af:s.af, open:s.open, so:s.so, soSt:s.soSt, gew:s.gew.st }; }, c);
  const vul = async (c, k, v, d) => { const l = kaart(c).locator(`input[data-k="${k}"]${d ? `[data-d="${d}"]` : ''}`).first(); await l.fill(String(v)); await l.press('Tab'); await wacht(200); };
  const kies = async (c, k, v) => { await kaart(c).locator(`select[data-k="${k}"]`).first().selectOption(v); await wacht(200); };
  const modalOk = async () => { await P.click('.pd2-modal [data-m="ok"]'); await wacht(200); };
  const vink = async cs => { for(const c of cs) await kaart(c).locator('[data-a="sel"]').check(); await wacht(100); };
  const groepKies = async (a2, v) => { await P.selectOption(`#pd2-actie select[data-a2="${a2}"]`, v); await wacht(250); };
  const oefSet = async s => { await P.selectOption('.pd2-oefkaart select[data-a2="oefset"]', s); await wacht(100); };
  const naarFam = (c, seg) => ev(([c, seg]) => { WHPD2.openFam(PD2R.famVan(c), PD2R.maatVan(c)); if(seg){ WHPD2.UI.seg = seg; WHPD2.verversAlles(); } }, [c, seg]);

  /* ===== oefenen aan via Oefenmodus ⋯ ===== */
  check('Startscherm: geen oefenblok, geen tabbalk, geen tabel', await ev(() => !document.querySelector('.pd2 table, .pd2-tabs, .pd2-oef, .pd2-oefkaart') && !!document.querySelector('.pd2[data-scherm="start"]')));
  await P.click('[data-a="oefmenu"]'); await wacht(); await P.click('.pd2-modal [data-a="oefaan"]'); await wacht();
  check('Oefenen aan: één klein kaartje rechtsonder', await P.isVisible('.pd2-oefkaart') && await ev(() => { const r = document.querySelector('.pd2-oefkaart').getBoundingClientRect(); return r.width <= 345 && r.right > innerWidth - 30; }));

  /* ===== 1 Pallet ===== */
  await oefSet('pallet');
  await P.click('.pd2-oefkaart [data-a="toon"][data-id="p1"]'); await wacht(300);
  const p1 = await ev(() => ({ fam:PD2R.famNaam(WHPD2.UI.fk), mk:WHPD2.UI.mk, seg:WHPD2.UI.seg }));
  let rijen = await kaarten();
  check('Pallet: Toon opent FWB met Pallet-kaarten', /whiteboard zonder rand/i.test(p1.fam) && p1.seg === 'pallet' && rijen.length > 0, JSON.stringify(p1) + ' · ' + rijen.length + ' kaarten');
  const voor = await ev(cs => cs.map(c => PD2R.po(c) ? JSON.stringify(PD2R.po(c)) : null), rijen);
  check('Groepsbalk alleen zichtbaar als er iets is aangevinkt', !(await P.isVisible('#pd2-actie .pd2-actie')));
  await P.check('.pd2-alle input[data-a="selalle"]'); await wacht();
  check('Na aanvinken: groepsbalk onderaan', await P.isVisible('#pd2-actie .pd2-actie'));
  await P.click('#pd2-actie [data-a="selklopt"]'); await wacht(300);
  check('Pallet: opdracht p1 (Selectie klopt) vinkt zichzelf af', await done('pallet', 'p1'));
  const naKlopt = await Promise.all(rijen.map(st));
  check('Selectie klopt bevestigt de soort', naKlopt.every(s => ['bevestigd', 'aangepast', 'vastgelegd'].includes(s.soSt)), JSON.stringify(naKlopt[0]));
  check('Gewicht blijft open na Selectie klopt (geen product afgerond zonder gewicht)', naKlopt.every(s => !s.af && s.open.includes('gewicht')));
  check('Ongedaan-melding staat er', await P.isVisible('#pd2-undo'));
  await P.click('#pd2-undo [data-a="ongedaan"]'); await wacht(250);
  const naUndo = await ev(cs => cs.map(c => PD2R.po(c) ? JSON.stringify(PD2R.po(c)) : null), rijen);
  check('Ongedaan herstelt de producten precies', JSON.stringify(naUndo) === JSON.stringify(voor));
  await P.check('.pd2-alle input[data-a="selalle"]'); await P.click('#pd2-actie [data-a="selklopt"]'); await wacht(300);
  rijen = await kaarten();
  const c1 = rijen[0];
  check('Pallet-kaart toont alleen de velden van Pallet', await ev(c => { const ks = [...document.querySelectorAll(`article.pd2-kaart[data-c="${c}"] .pd2-velden > .pd2-f`)].map(x => x.dataset.kc); return !ks.includes('maxpick') && !ks.includes('verp') && ks.includes('spp'); }, c1));
  const sppOud = await ev(c => PD2R.waarde(c, 'spp').v, c1);
  const nieuw = (parseInt(sppOud) || 40) + 7;
  await vul(c1, 'spp', nieuw);
  const gp = await ev(c => ({ cel:document.querySelector(`article.pd2-kaart[data-c="${c}"] [data-kc="gewpal"] .cv`)?.textContent, calc:PD2R.calc(c, 'gewpal').v, kg:PD2R.gewicht(c).kg, spp:PD2R.waarde(c, 'spp') }), c1);
  check('Pallet: stuks per pallet aangepast, status "aangepast"', gp.spp.st === 'aangepast' && +gp.spp.v === nieuw, JSON.stringify(gp.spp));
  check('Pallet: gewicht volle pallet = stuks × kg + 15 (grijs op de kaart)', !gp.kg || (+gp.calc === Math.ceil(nieuw * gp.kg + 15) && gp.cel === gp.calc), gp.calc + ' = ' + nieuw + ' × ' + gp.kg + ' + 15 · kaart ' + gp.cel);
  check('Pallet: opdracht p2 gedaan', await done('pallet', 'p2'));
  const c2 = rijen[rijen.length - 1];
  await kies(c2, 'soort', 'deel');
  check('Pallet: product naar Deel verdwijnt uit Pallet', !(await kaarten()).includes(c2));
  check('Pallet: opdracht p3 gedaan', await done('pallet', 'p3'));
  const open1 = await ev(() => WHPD2.kaartCodes().find(c => { const s = PD2R.status(c); return !s.af && s.open.length > 1 && s.open.includes('gewicht'); }) || WHPD2.famEcht(WHPD2.UI.fk).find(c => { const s = PD2R.status(c); return !s.af && s.open.length > 1 && s.open.includes('gewicht'); }));
  await naarFam(open1);
  await vink([open1]); await groepKies('gewicht', 'klopt');
  const so1 = await st(open1);
  check('Gewicht… kloppen maakt een product met open velden niet afgerond', so1.gew === 'vertrouwd' && !so1.af, JSON.stringify(so1.open));
  await ev(() => { WHPD2.UI.sel.clear(); WHPD2.verversAlles(); });

  /* ===== 2 Deel ===== */
  await oefSet('deel');
  await P.click('.pd2-oefkaart [data-a="toon"][data-id="d1"]'); await wacht(300);
  const d1 = await ev(() => ({ fk:WHPD2.UI.fk, mk:WHPD2.UI.mk }));
  check('Deel: Toon opent Schoonloopmat Mars 120x180', /mars/.test(d1.fk) && d1.mk === '120x180', JSON.stringify(d1));
  check('Deel: opdracht d1 gedaan', await done('deel', 'd1'));
  const ant = await ev(() => Object.keys(WH.D.P).find(c => /schoonloopmat antraciet - mars - 120\s*x\s*180/i.test(WH.D.P[c].naam || '')));
  const antS = await ev(c => PD2R.soortWaarde(c), ant);
  check('Mars 120x180 Antraciet: voorstel Deel', antS.v === 'deel', JSON.stringify(antS));
  check('Schoonloopmat Mars: 8 maattegels', (await ev(() => document.querySelectorAll('.pd2-maat').length)) === 8);
  check('Antraciet staat als kaart in de maat', (await kaarten()).includes(ant));
  await vul(ant, 'lvl', 10); await vul(ant, 'maxpick', 50);
  const am = await ev(c => PD2R.calc(c, 'aanvmet'), ant);
  check('Deel: aanvullen met = max − bij = 40', am.v === '40', JSON.stringify(am));
  check('Deel: opdracht d2 gedaan', await done('deel', 'd2'));
  await vul(ant, 'hoogte', 185);
  const hw = await ev(c => ({ v:PD2R.waarde(c, 'hoogte').v, w:document.querySelector(`article.pd2-kaart[data-c="${c}"] [data-kc="hoogte"] .u`)?.textContent }), ant);
  check('Hoogte naar boven afgerond op 10 cm', hw.v === '190', hw.v);
  check('Hoogte-melding bij 20-locatie hal A (grijs onder het veld)', /140/.test(hw.w || ''), hw.w);
  check('Pallet: opdracht p4 gedaan', await done('pallet', 'p4'));
  await vul(ant, 'verp', 15, 'n'); await kaart(ant).locator('select[data-k="verp"]').selectOption('doos'); await wacht(250);
  await vul(ant, 'lvl', 8);
  const am2 = await ev(c => PD2R.calc(c, 'aanvmet'), ant);
  check('Deel: melding als aanvullen met geen veelvoud van de doos is', /veelvoud/.test(am2.warn || ''), am2.v + ' · ' + am2.warn);
  check('Deel: opdracht d3 gedaan', await done('deel', 'd3'));
  await kies(ant, 'pickc', 'geenpick');
  const antSt = await st(ant);
  check('Deel: geen pick → bij en max niet meer nodig (en niet meer op de kaart)', !antSt.open.includes('lvl') && !antSt.open.includes('maxpick') && !(await kaart(ant).locator('input[data-k="maxpick"]').count()), JSON.stringify(antSt.open));
  check('Deel: opdracht d4 gedaan', await done('deel', 'd4'));
  await kaart(ant).locator('select[data-k="maat"]').selectOption('__anders'); await wacht();
  await P.fill('#pd2-maatin', '100 x 130'); await modalOk();
  check('Palletmaat "anders…": eigen maat typen (opmerking Daan)', (await ev(c => PD2R.waarde(c, 'maat').v, ant)) === '100x130' && (await kaart(ant).locator('select[data-k="maat"]').inputValue()) === '100x130');

  /* ===== 3 Pick ===== */
  const pk = await ev(() => Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isKoppel(c) && !PD2R.isSam(c) && WHPD2.segVan(c) === 'pick' && PD2R.info(c).f.pick.length && PD2R.info(c).ink && !PD2R.rolKand(c) && !PD2R.ingevuld(PD2R.waarde(c, 'pickc'))));
  await naarFam(pk, 'pick');
  check('Pick-kaart: alleen Picklocatie en Max op pick', await ev(c => [...document.querySelectorAll(`article.pd2-kaart[data-c="${c}"] .pd2-velden > .pd2-f`)].map(x => x.dataset.kc).join() === 'pickc,maxpick', pk));
  await kies(pk, 'pickc', 'klopt');
  check('Pick: opdracht k1 (picklocatie klopt) gedaan', await done('pick', 'k1'));
  const zpFam = await ev(() => { for(const f of WHPD2.families()){ const t = {}; WHPD2.famEcht(f.fk).forEach(c => WHPD2.aandachtVan(c).forEach(a => { t[a] = (t[a] || 0) + 1; })); const top = Object.keys(t).sort((a, b) => t[b] - t[a]).slice(0, 3); if(top.includes('zonderpick')) return f.fk; } return null; });
  await ev(fk => WHPD2.openFam(fk), zpFam);
  await P.click('.pd2-aand [data-a="aandacht"][data-v="zonderpick"]'); await wacht(300);
  const zps = await kaarten();
  check('Aandachtspunt "zonder picklocatie" toont alleen die kaarten', zps.length > 0 && await ev(cs => cs.every(c => !PD2R.info(c).f.pick.length), zps), zps.length + ' kaarten');
  await kies(zps[0], 'pickc', 'moetpick');
  check('Pick: opdracht k2 (moet pick krijgen) gedaan', await done('pick', 'k2'));
  await naarFam(pk, 'pick');
  await vul(pk, 'maxpick', 12);
  check('Pick: opdracht k3 (max op pick) gedaan', await done('pick', 'k3'));

  /* ===== 4 Mix ===== */
  await oefSet('mix');
  await P.click('.pd2-oefkaart [data-a="toon"][data-id="m1"]'); await wacht(300);
  rijen = (await kaarten()).slice(0, 3);
  await vink(rijen); await groepKies('allemaal', 'mix');
  check('Zijn allemaal… Mix zet de selectie op Mix', (await Promise.all(rijen.map(st))).every(s => s.so === 'mix'));
  await vink(rijen); await groepKies('zelfde', 'mixgroep');
  await P.fill('#pd2-kv', 'Test oefengroep'); await modalOk();
  check('Mix: opdracht m1 (3 producten zelfde mixgroep) gedaan', await done('mix', 'm1'));
  await ev(() => { WHPD2.UI.sel.clear(); WHPD2.verversAlles(); });
  const mx = rijen[0];
  await kaart(mx).locator('select[data-k="mixgroep"]').selectOption('__nieuw'); await wacht();
  await P.fill('#pd2-mgn', 'Nieuwe oefengroep'); await modalOk();
  check('Mix: nieuwe mixgroep gekozen', (await ev(c => PD2R.waarde(c, 'mixgroep').v, mx)) === 'Nieuwe oefengroep');
  check('Mix: opdracht m2 gedaan', await done('mix', 'm2'));
  await P.click('[data-a="seg"][data-v="mix"]'); await wacht();
  await P.click('.pd2-mg [data-a="mgregel"]'); await wacht(); await P.click('.pd2-modal [data-m="nee"]');
  check('Mix: opdracht m3 gedaan', await done('mix', 'm3'));

  /* ===== 5 Weg ===== */
  await oefSet('weg');
  await P.click('.pd2-oefkaart [data-a="toon"][data-id="w1"]'); await wacht(300);
  rijen = await kaarten();
  check('Weg: Waterhog zonder voorraad staat onder Weg', rijen.length > 1 && (await ev(() => WHPD2.UI.seg)) === 'weg' && await ev(c => /waterhog/i.test(PD2R.naamVan(c)), rijen[0]), rijen.length + ' kaarten');
  check('Weg-kaart: drie knoppen, geen velden', await ev(c => document.querySelectorAll(`article.pd2-kaart[data-c="${c}"] [data-a="wegkies"]`).length === 3 && !document.querySelector(`article.pd2-kaart[data-c="${c}"] .pd2-velden`), rijen[0]));
  await kaart(rijen[0]).locator('[data-a="wegkies"][data-v="backorder"]').click(); await wacht(250);
  check('Weg: opdracht w1 (Backorder) gedaan', await done('weg', 'w1'));
  await kaart(rijen[1]).locator('[data-a="wegkies"][data-v="archief"]').click(); await wacht(250);
  check('Weg: opdracht w2 (Archief) gedaan', await done('weg', 'w2'));
  const wst = await st(rijen[0]);
  check('Weg: alleen de keuze → afgerond, kaart klapt in onder Afgerond', wst.af && !(await kaarten()).includes(rijen[0]) && await P.locator(`.pd2-af .pd2-afrij[data-c="${rijen[0]}"]`).count() === 1, JSON.stringify(wst));
  await P.click('.pd2-af > summary'); await wacht();
  await P.click(`.pd2-afrij[data-c="${rijen[0]}"] [data-a="wegterug"]`); await wacht(300);
  check('Weg: terugzetten haalt hem uit Afgerond', (await kaarten()).includes(rijen[0]) && !(await ev(c => PD2R.status(c).af, rijen[0])));
  check('Weg: opdracht w3 gedaan', await done('weg', 'w3'));

  /* ===== Rollen ===== */
  await oefSet('rollen');
  await P.click('.pd2-oefkaart [data-a="toon"][data-id="r1"]'); await wacht(300);
  rijen = await kaarten();
  const kr = await ev(cs => cs.find(c => PD2R.rolKand(c) && !PD2R.rolBesl(c)), rijen);
  check('Rollen: Kokos-kaart met "Is dit een rol?"', !!kr && await kaart(kr).locator('.pd2-rolvraag').count() === 1, kr);
  await kaart(kr).locator('[data-a="rol"][data-v="1"]').click(); await wacht(300);
  check('Rollen: opdracht r1 (is rol) gedaan', await done('rollen', 'r1'));
  check('Rollen: kaart heeft nu een open blok Rolgegevens', await P.isVisible(`article.pd2-kaart[data-c="${kr}"] details.pd2-rol[open]`));
  await vul(kr, 'rb', 100); await vul(kr, 'rl', 25); await vul(kr, 'rkg', 50);
  const kgm = await ev(c => PD2R.calc(c, 'kgm').v, kr);
  check('Rollen: kg per meter = 50 / 25 = 2', kgm === '2' || kgm === '2,000', kgm);
  await ev(() => WHPD2.verversAlles());
  check('Rollen: opdracht r2 gedaan', await done('rollen', 'r2'));
  await kies(kr, 'rstand', 'staand');
  check('Rollen: opdracht r3 gedaan', await done('rollen', 'r3'));

  /* ===== Afgerond ===== */
  const vrijPick = x => ev(x => Object.keys(WH.D.P).find(c => !x.includes(c) && PD2R.actief(c) && !PD2R.isKoppel(c) && !PD2R.isSam(c) && WHPD2.segVan(c) === 'pick' && PD2R.info(c).f.pick.length && PD2R.info(c).ink && !PD2R.rolKand(c) && !PD2R.po(c)), x);
  const ap = await vrijPick([pk]);
  await naarFam(ap, 'pick');
  await vink([ap]); await P.click('#pd2-actie [data-a="selklopt"]'); await wacht(300);
  const apA = await st(ap);
  check('Afgerond: na Selectie klopt nog niet af (gewicht open)', !apA.af && apA.open.join() === 'gewicht', JSON.stringify(apA.open));
  check('Kaart staat na Selectie klopt nog open', (await kaarten()).includes(ap));
  await kaart(ap).locator('[data-a="gewst"][data-v="vertrouwd"]').click(); await wacht(300);
  check('Afgerond: na gewicht vertrouwd → afgerond', (await st(ap)).af);
  check('Afgerond: kaart klapt in tot één regel met ✓ onder Afgerond', !(await kaarten()).includes(ap) && await P.locator(`.pd2-af .pd2-afrij[data-c="${ap}"] .v`).count() === 1);
  check('Afgerond: opdracht a1 gedaan', await done('afgerond', 'a1'));
  await P.click('.pd2-af > summary'); await wacht();
  await P.click(`.pd2-afrij[data-c="${ap}"] [data-a="heropen"]`); await wacht(300);
  check('Afgerond: heropenen zet de kaart terug', (await kaarten()).includes(ap) && !(await st(ap)).af);
  check('Afgerond: opdracht a2 gedaan', await done('afgerond', 'a2'));
  const ap2 = await vrijPick([pk, ap]);
  await naarFam(ap2, 'pick');
  await vink([ap2]); await P.click('#pd2-actie [data-a="selklopt"]'); await wacht(300);
  await kaart(ap2).locator('[data-a="gewst"][data-v="tewegen"]').click(); await wacht(300);
  const a3 = await st(ap2);
  check('Afgerond met ⚖: te wegen telt als besproken', a3.af && a3.gew === 'tewegen' && /⚖/.test(await P.locator(`.pd2-afrij[data-c="${ap2}"]`).textContent()));
  check('Afgerond: opdracht a3 gedaan', await done('afgerond', 'a3'));
  check('Weeglijst: opdracht g2 (te wegen) gedaan', await done('weeglijst', 'g2'));

  /* ===== Weeglijst ===== */
  await naarFam(pk, 'pick');
  const two = (await kaarten()).slice(0, 2);
  await vink(two); await groepKies('gewicht', 'pop');
  await P.fill('#pd2-gp', '1,5'); await P.click('.pd2-modal [data-gst="gewogen"]'); await modalOk();
  const g1 = await ev(cs => cs.map(c => PD2R.gewicht(c)), two);
  check('Gewicht… aanpassen: 1,5 kg gewogen voor de selectie', g1.every(g => g.st === 'gewogen' && g.kg === 1.5), JSON.stringify(g1.map(g => g.st + ' ' + g.kg)));
  check('Weeglijst: opdracht g1 gedaan', await done('weeglijst', 'g1'));
  await ev(() => { WHPD2.UI.sel.clear(); WHPD2.verversAlles(); });
  await P.click('[data-a="famweg"]'); await wacht(300);
  await P.click('.pd2-voet [data-a="view"][data-v="weeg"]'); await wacht(300);
  check('Weeglijst: opdracht g3 gedaan', await done('weeglijst', 'g3'));
  check('Weeglijst toont het te-wegen product, gegroepeerd per hal', await P.locator(`.pd2-wrij[data-c="${ap2}"]`).count() === 1 && await P.isVisible('.pd2-wl h3'));
  await P.locator(`.pd2-wrij[data-c="${ap2}"] [data-a="gewogen"]`).fill('2,25'); await P.locator(`.pd2-wrij[data-c="${ap2}"] [data-a="gewogen"]`).press('Tab'); await wacht(300);
  const g4 = await ev(c => PD2R.gewicht(c), ap2);
  check('Weeglijst: gewogen kg invullen → status gewogen', g4.st === 'gewogen' && g4.kg === 2.25, JSON.stringify(g4));
  check('Weeglijst: opdracht g4 gedaan', await done('weeglijst', 'g4'));
  await P.click('[data-a="viewweg"]'); await wacht();

  /* ===== feedback, opmerkingen, aannames ===== */
  await oefSet('deel');
  for(let i = 0; i < 4; i++){ await P.click('.pd2-oefkaart [data-a="oefvolg"]'); await wacht(80); }
  check('Na de laatste opdracht: de vier vragen in het kaartje', await P.isVisible('.pd2-oefkaart .pd2-vragen'));
  await P.click('.pd2-oefkaart [data-a="fb"][data-k="layout"][data-v="bijna"]');
  await P.fill('#pd2-fb-mis', 'Test: ik mis de laatste besteldatum'); await P.press('#pd2-fb-mis', 'Tab');
  await P.click('.pd2-oefkaart [data-a="fb"][data-k="gevoel"][data-v="4"]');
  const fb = await ev(() => PD2R.S.fb.tabs.deel);
  check('Vier vragen bewaard in feedback', fb && fb.layout === 'bijna' && fb.gevoel === '4' && /besteldatum/.test(fb.mis), JSON.stringify(fb));
  await naarFam(ant);
  await kaart(ant).locator('select[data-k="maat"]').focus();
  await kaart(ant).locator('[data-a="opm"]').click(); await P.fill('#pd2-opm-t', 'Test: palletmaat klopt niet'); await modalOk();
  const opm = await ev(() => PD2R.S.fb.opm.slice(-1)[0]);
  check('💬 per kaart: soort, product en veld gaan mee', opm && opm.tab === 'deel' && opm.code === ant && opm.kolom === 'maat', JSON.stringify(opm));
  await P.click('[data-a="famweg"]'); await wacht();
  await P.click('[data-a="oefmenu"]'); await P.click('.pd2-modal [data-a="opmalg"]'); await wacht(); await P.fill('#pd2-opm-t', 'Test: algemene opmerking'); await modalOk();
  await P.click('.pd2-voet [data-a="view"][data-v="aann"]'); await wacht();
  check('Aannames: één lijst, geen chips in de pagina', await ev(() => document.querySelectorAll('.pd2-aannrij').length === Object.keys(PD2R.AANNAMES).length && !document.querySelector('.pd2-aan')));
  await P.click('.pd2-aannrij[data-id="soortkol"] [data-a="aannv"][data-v="nee"]'); await wacht();
  await P.click('.pd2-aannrij[data-id="soortkol"] [data-a="aanname"]'); await P.fill('#pd2-aopm', 'Test: liever een knop'); await modalOk();
  check('Aanname afkeuren bewaard', await ev(() => PD2R.S.fb.aann.soortkol && PD2R.S.fb.aann.soortkol.v === 'nee' && /knop/.test(PD2R.S.fb.aann.soortkol.opm)));
  await P.click('[data-a="viewweg"]'); await wacht();

  /* ===== tellers ===== */
  await naarFam(ant);
  const tel = await ev(() => { const knop = {}; document.querySelectorAll('.pd2-seg [data-a="seg"]').forEach(b => knop[b.dataset.v] = +b.querySelector('.n').textContent.replace(/\./g, '')); const echt = { open:WHPD2.openCodes().length }; WHPD2.openCodes().forEach(c => { const s = WHPD2.segVan(c); echt[s] = (echt[s] || 0) + 1; }); return { knop, echt }; });
  check('Tellers per soort = aantal kaarten', Object.keys(tel.knop).every(k => tel.knop[k] === (tel.echt[k] || 0)), JSON.stringify(tel));
  const verdeling = await ev(() => { const cs = WHPD2.blokCodes(); return { tot:cs.length, open:WHPD2.openCodes().length, af:WHPD2.afCodes().length }; });
  check('Elk product van de maat staat open of onder Afgerond', verdeling.open + verdeling.af === verdeling.tot, JSON.stringify(verdeling));
  const maatTel = await ev(() => WHPD2.maatgroepen().every(m => { const b = document.querySelector(`.pd2-maat[data-v="${CSS.escape(m.k)}"]`); return b && (m.open ? b.textContent.includes(m.velden + ' open') : b.textContent.includes('✓')); }));
  check('Maattegels: kleuren en open velden kloppen', maatTel);

  /* ===== kopieer alles voor Claude ===== */
  await P.click('[data-a="famweg"]'); await wacht();
  await P.click('[data-a="oefmenu"]'); await P.click('.pd2-modal [data-a="kopieer"]'); await wacht(400);
  const tekst = await P.textContent('.pd2-modal pre');
  check('Kopieer alles voor Claude geeft leesbare tekst', /== Pallet ==/.test(tekst) && /== Voorstellen/.test(tekst) && tekst.includes(ant + ' · Palletmaat: Test: palletmaat klopt niet') && /\d+ oefenantwoorden met het oefenkaartje aan: niet meegeteld/.test(tekst) && /algemene opmerking/.test(tekst), tekst.length + ' tekens');
  require('fs').writeFileSync(SCRATCH + '/claude-tekst.txt', tekst);
  await P.click('.pd2-modal [data-m="nee"]');

  /* ===== opslag ===== */
  await ev(() => PD2R.flush()); await wacht(800); await ev(() => PD2R.flush());
  check('Alleen geschreven naar wh-pd2-oefen en wh-pd2-feedback', T.blocked.length === 0 && T.writes.length > 0 && T.writes.every(k => /^wh-pd2-(oefen|feedback)$/.test(k)), 'writes ' + T.writes.length + ', geblokkeerd ' + T.blocked.length + ' ' + T.blocked.slice(0, 3).join(' | '));
  check('wh-pd2-oefen bevat de geoefende producten', Object.keys((T.mock['wh-pd2-oefen'] || {}).p || {}).length > 5);
  check('wh-pd2-feedback bevat opmerkingen', ((T.mock['wh-pd2-feedback'] || {}).opm || []).length >= 2);
  await P.reload(); await P.waitForFunction(() => window.PD2R && PD2R.S.klaar && document.querySelector('.pd2[data-scherm="start"]'), null, { timeout:120000 });
  check('Na herladen staat de oefendata er nog', await ev(c => PD2R.status(c).af === false && PD2R.waarde(c, 'lvl').v === '8', ant));
  check('Na herladen staat oefenen nog aan (kaartje)', await P.isVisible('.pd2-oefkaart'));
  await P.click('[data-a="oefmenu"]'); await P.click('.pd2-modal [data-a="wissen"]'); await wacht(900);
  check('Oefendata wissen: wh-pd2-oefen leeg, feedback blijft', Object.keys(T.mock['wh-pd2-oefen'].p).length === 0 && T.mock['wh-pd2-feedback'].opm.length >= 2);
  console.log('\nERRORS:\n' + T.errors.join('\n'));
  console.log('\n' + ok.length + ' OK, ' + fout.length + ' FOUT');
  require('fs').writeFileSync(SCRATCH + '/oef-uitslag.json', JSON.stringify({ ok, fout, errors:T.errors, blocked:T.blocked }, null, 1));
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
