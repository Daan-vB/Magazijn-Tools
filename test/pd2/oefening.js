// Doet elke oefening via de echte UI (kaarten, maattegels, drie stappen, groepsbalk, oefenkaartje), met echte data (database, alleen lezen);
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
  const st = c => ev(c => { const s = PD2R.status(c); return { af:s.af, open:s.open, so:s.so, soSt:s.soSt, gew:s.gew.st, stap:s.stap }; }, c);
  const vul = async (c, k, v) => { const l = kaart(c).locator(`input[data-k="${k}"]`).first(); await l.fill(String(v)); await l.press('Tab'); await wacht(200); };
  const kies = async (c, k, v) => { await kaart(c).locator(`select[data-k="${k}"]`).first().selectOption(v); await wacht(200); };
  const modalOk = async () => { await P.click('.pd2-modal [data-m="ok"]'); await wacht(200); };
  const vink = async cs => { for(const c of cs) await kaart(c).locator('[data-a="sel"]').check(); await wacht(100); };
  const oefSet = async s => { await P.selectOption('.pd2-oefkaart select[data-a2="oefset"]', s); await wacht(100); };
  const stap = async s => { await P.click(`[data-a="stap"][data-v="${s}"]`); await wacht(200); };
  const naarFam = (c, s) => ev(([c, s]) => { WHPD2.openFam(PD2R.famVan(c), PD2R.maatVan(c)); if(s){ WHPD2.UI.stap = s; WHPD2.verversAlles(); } }, [c, s]);
  const meer = async () => { if(!(await ev(() => document.querySelector('.pd2-meer2').open))) await P.click('.pd2-meer2 > summary'); };

  /* ===== start: alleen Meer onderaan ===== */
  check('Startscherm: geen tabbalk, geen tabel; "Meer" ingeklapt', await ev(() => !document.querySelector('.pd2 table, .pd2-tabs, .pd2-oefkaart, .pd2[data-scherm="start"] .pd2-seg') && !!document.querySelector('.pd2-meer2') && !document.querySelector('.pd2-meer2').open));
  await meer();
  check('Meer bevat Weeglijst, Aannames, Rollen controleren, Palletlabels en Oefenmodus', await ev(() => ['weeg', 'aann', 'rolcheck', 'labels'].every(v => document.querySelector(`.pd2-meer2 [data-a="view"][data-v="${v}"]`)) && !!document.querySelector('.pd2-meer2 [data-a="oefmenu"]')));
  await P.click('[data-a="oefmenu"]'); await wacht(); await P.click('.pd2-modal [data-a="oefaan"]'); await wacht();
  check('Oefenen aan: één klein kaartje rechtsonder', await P.isVisible('.pd2-oefkaart') && await ev(() => { const r = document.querySelector('.pd2-oefkaart').getBoundingClientRect(); return r.width <= 345 && r.right > innerWidth - 30; }));

  /* ===== stap 1 Soort ===== */
  await oefSet('pallet');
  await P.click('.pd2-oefkaart [data-a="toon"][data-id="p1"]'); await wacht(300);
  const p1 = await ev(() => ({ fam:PD2R.famNaam(WHPD2.UI.fk), mk:WHPD2.UI.mk, stap:WHPD2.UI.stap, tabs:[...document.querySelectorAll('.pd2-segbalk [data-a="seg"]')].map(b => b.dataset.v).join(), stappen:[...document.querySelectorAll('.pd2-stappen [data-a="stap"]')].map(b => b.textContent.replace(/\s+/g, ' ').trim().replace(/ [\d✓]+$/, '')).join(' · ') }));
  check('Toon opent FWB; tabs alleen Open en Afgerond; stappen 1 Soort · 2 Gewicht · 3 Hoeveelheid', /whiteboard zonder rand/i.test(p1.fam) && p1.tabs === 'open,afgerond' && p1.stappen === '1 Soort · 2 Gewicht · 3 Hoeveelheid', JSON.stringify(p1));
  // een maat met open producten (FWB kan al ingevuld zijn)
  await ev(() => { const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isKoppel(c) && !PD2R.isSam(c) && !PD2R.rolKand(c) && PD2R.status(c).so === 'pallet' && !PD2R.status(c).stap.soort && PD2R.status(c).open.includes('gewicht') && PD2R.status(c).open.includes('spp') && WHPD2.famEcht(PD2R.famVan(c)).filter(x => PD2R.maatVan(x) === PD2R.maatVan(c) && PD2R.status(x).so === 'pallet' && !PD2R.status(x).stap.soort).length > 1); WHPD2.openFam(PD2R.famVan(c), PD2R.maatVan(c)); WHPD2.UI.stap = 'soort'; WHPD2.verversAlles(); });
  let rijen = await kaarten();
  const voor = await ev(cs => cs.map(c => PD2R.po(c) ? JSON.stringify(PD2R.po(c)) : null), rijen);
  const kq = await ev(c => { const k = document.querySelector(`article.pd2-kaart[data-c="${c}"]`); return { vragen:k.querySelectorAll('.pd2-vraag').length, knoppen:[...k.querySelectorAll('[data-a="soortkies"]')].map(b => b.dataset.v).join(), voorstel:k.querySelectorAll('.pd2-kz.vs').length, pick:!!k.querySelector('[data-kc="pickc"]'), klopt:!!k.querySelector('[data-a="klopt"], [data-a="rijklopt"]'), rood:!!k.querySelector('.rood'), feiten:k.querySelector('.pd2-feiten').innerText.replace(/\s+/g, ' ') }; }, rijen[0]);
  check('Kaart in stap Soort: één vraag met Pallet/Deel/Pick/Mix/Weg en één voorstel; geen picklocatie, Klopt-knop of rode tekst', kq.vragen === 1 && kq.knoppen === 'pallet,deel,pick,mix,weg' && kq.voorstel === 1 && !kq.pick && !kq.klopt && !kq.rood && /inkoop/i.test(kq.feiten) && /\*6 \/ .*\*28/.test(kq.feiten), JSON.stringify(kq));
  check('Groepsbalk alleen zichtbaar als er iets is aangevinkt', !(await P.isVisible('#pd2-actie .pd2-actie')));
  check('Onderaan de stap: "Alle voorstellen kloppen"', await P.isVisible('#pd2-stapacties [data-a="stapklopt"]'));
  await P.check('.pd2-alle input[data-a="selalle"]'); await wacht();
  check('Na aanvinken: groepsbalk met alleen "Selectie klopt"', await P.isVisible('#pd2-actie [data-a="selklopt"]') && await ev(() => document.querySelectorAll('#pd2-actie button.knop:not(.pd2-x)').length === 1));
  await P.click('#pd2-actie [data-a="selklopt"]'); await wacht(300);
  check('Opdracht p1 (Selectie klopt) vinkt zichzelf af', await done('pallet', 'p1'));
  const naKlopt = await Promise.all(rijen.map(st));
  check('Selectie klopt bevestigt de soort, product nog niet afgerond (gewicht en hoeveelheid open)', naKlopt.every(s => ['bevestigd', 'aangepast', 'vastgelegd'].includes(s.soSt) && s.stap.soort && !s.af), JSON.stringify(naKlopt[0]));
  check('Ongedaan-melding staat er', await P.isVisible('#pd2-undo'));
  await P.click('#pd2-undo [data-a="ongedaan"]'); await wacht(250);
  check('Ongedaan herstelt de producten precies', JSON.stringify(await ev(cs => cs.map(c => PD2R.po(c) ? JSON.stringify(PD2R.po(c)) : null), rijen)) === JSON.stringify(voor));
  await stap('soort');
  await P.click('#pd2-stapacties [data-a="stapklopt"]'); await wacht(300);
  check('Alle voorstellen kloppen (stap Soort): soort bevestigd voor de hele maat, daarna automatisch naar stap 2', (await Promise.all(rijen.map(st))).every(s => s.stap.soort) && (await ev(() => WHPD2.UI.stap)) === 'gewicht');

  /* ===== Mars: Deel, soort kiezen, stap 3 ===== */
  await oefSet('deel');
  await P.click('.pd2-oefkaart [data-a="toon"][data-id="d1"]'); await wacht(300);
  const d1 = await ev(() => ({ fk:WHPD2.UI.fk, mk:WHPD2.UI.mk }));
  check('Toon opent Schoonloopmat Mars 120x180', /mars/.test(d1.fk) && d1.mk === '120x180', JSON.stringify(d1));
  check('Opdracht d1 gedaan', await done('deel', 'd1'));
  const ant = await ev(() => Object.keys(WH.D.P).find(c => /schoonloopmat antraciet - mars - 120\s*x\s*180/i.test(WH.D.P[c].naam || '')));
  const antS = await ev(c => PD2R.soortWaarde(c), ant);
  check('Mars 120x180 Antraciet: voorstel Deel', antS.v === 'deel', JSON.stringify(antS));
  check('Schoonloopmat Mars: 8 maattegels', (await ev(() => document.querySelectorAll('.pd2-maat').length)) === 8);
  await stap('soort');
  check('Antraciet staat als kaart in de maat, voorstel Deel is het blauwe knopje', (await kaarten()).includes(ant) && await kaart(ant).locator('.pd2-kz.vs[data-v="deel"]').count() === 1);
  await kaart(ant).locator('[data-a="soortkies"][data-v="deel"]').click(); await wacht(250);
  check('Klik op het voorgestelde knopje slaat de soort op (bevestigd)', (await st(ant)).soSt === 'bevestigd');
  await stap('hoev');
  const ks = await ev(c => [...document.querySelectorAll(`article.pd2-kaart[data-c="${c}"] .pd2-velden > .pd2-f`)].map(x => x.dataset.kc).join(), ant);
  check('Stap 3 bij Deel: alleen stuks per pallet, palletmaat en hoogte', ks === 'spp,maat,hoogte', ks);
  const oudSpp = await ev(c => PD2R.waarde(c, 'spp').v, ant);
  await vul(ant, 'spp', (parseInt(oudSpp) || 40) + 7);
  check('Stuks per pallet aangepast; opdracht d2 gedaan', (await ev(c => PD2R.waarde(c, 'spp').st, ant)) === 'aangepast' && await done('deel', 'd2'));
  await vul(ant, 'hoogte', 185);
  check('Hoogte naar boven afgerond op 10 cm', (await ev(c => PD2R.waarde(c, 'hoogte').v, ant)) === '190');
  await kaart(ant).locator('select[data-k="maat"]').selectOption('__anders'); await wacht();
  await P.fill('#pd2-maatin', '100 x 130'); await modalOk();
  check('Palletmaat "anders…": eigen maat typen', (await ev(c => PD2R.waarde(c, 'maat').v, ant)) === '100x130');
  check('Product is pas afgerond als alle drie de stappen klaar zijn (gewicht nog open)', await ev(c => !PD2R.status(c).af && PD2R.status(c).stap.hoev && !PD2R.status(c).stap.gewicht, ant));
  // pick: alleen max op pick
  const pk = await ev(() => Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isKoppel(c) && !PD2R.isSam(c) && WHPD2.segVan(c) === 'pick' && PD2R.info(c).f.pick.length && PD2R.info(c).ink && !PD2R.rolKand(c) && !PD2R.po(c)));
  await naarFam(pk, 'hoev');
  check('Stap 3 bij Pick: alleen max op pick', await ev(c => [...document.querySelectorAll(`article.pd2-kaart[data-c="${c}"] .pd2-velden > .pd2-f`)].map(x => x.dataset.kc).join() === 'maxpick', pk));
  await vul(pk, 'maxpick', 12);
  check('Opdracht k3 (max op pick) gedaan', await done('pick', 'k3'));
  await ev(() => WHPD2.UI.stap = 'hoev');
  check('Mix: ook alleen max op pick', await ev(() => { const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isKoppel(c) && !PD2R.isSam(c)); return JSON.stringify(PD2R.nodigVan(c, 'mix', PD2R.info(c))) === '["maxpick"]'; }));

  /* ===== Weg ===== */
  await oefSet('weg');
  await P.click('.pd2-oefkaart [data-a="toon"][data-id="w1"]'); await wacht(300);
  rijen = await kaarten();
  check('Waterhog zonder voorraad staat in de maat, stap Soort', rijen.length > 1 && await ev(c => /waterhog/i.test(PD2R.naamVan(c)), rijen[0]), rijen.length + ' kaarten');
  await kaart(rijen[0]).locator('[data-a="soortkies"][data-v="weg"]').click(); await wacht(250);
  check('Weg: alleen één keuzemenu Uitlopend / Backorder / Archief', await kaart(rijen[0]).locator('select[data-k="wegkeuze"] option:not([value=""])').count() === 3 && await kaart(rijen[0]).locator('.pd2-velden').count() === 0);
  await kies(rijen[0], 'wegkeuze', 'backorder');
  check('Opdracht w1 (Backorder) gedaan', await done('weg', 'w1'));
  await kaart(rijen[1]).locator('[data-a="soortkies"][data-v="weg"]').click(); await wacht(250);
  await kies(rijen[1], 'wegkeuze', 'archief');
  check('Opdracht w2 (Archief) gedaan', await done('weg', 'w2'));
  const wst = await st(rijen[0]);
  check('Weg: soort + keuze = afgerond (gewicht en hoeveelheid vervallen)', wst.af && !(await kaarten()).includes(rijen[0]), JSON.stringify(wst));
  await P.click('[data-a="seg"][data-v="afgerond"]'); await wacht();
  check('Tab Afgerond toont de afgeronde regel', await P.locator(`.pd2-afrij[data-c="${rijen[0]}"]`).count() === 1);
  await P.click(`.pd2-afrij[data-c="${rijen[0]}"] [data-a="wegterug"]`); await wacht(300);
  check('Weg terugzetten: product staat weer open; opdracht w3 gedaan', (await kaarten()).includes(rijen[0]) && !(await ev(c => PD2R.status(c).af, rijen[0])) && await done('weg', 'w3'));

  /* ===== Rollen ===== */
  await oefSet('rollen');
  await P.click('.pd2-oefkaart [data-a="toon"][data-id="r1"]'); await wacht(300);
  await stap('hoev');
  rijen = await kaarten();
  const kr = await ev(cs => cs.find(c => PD2R.rolKand(c) && !PD2R.rolBesl(c) && !['weg'].includes(PD2R.status(c).so)), rijen);
  check('Rol: stap 3 toont "Is dit een rol?"', !!kr && await kaart(kr).locator('.pd2-rolvraag').count() === 1, kr);
  await kaart(kr).locator('[data-a="rol"][data-v="1"]').click(); await wacht(300);
  check('Opdracht r1 (is rol) gedaan', await done('rollen', 'r1'));
  const rks = await ev(c => PD2R.nodigVan(c, PD2R.status(c).so, PD2R.info(c)).join(), kr);
  const so = await ev(c => PD2R.status(c).so, kr);
  check('Rol op pallet/deel: lengte volle rol en max rollen per pallet', !['pallet', 'deel'].includes(so) || rks === 'rl,rmax', so + ' ' + rks);
  check('Rol: kaart toont die velden', !['pallet', 'deel'].includes(so) || await ev(c => [...document.querySelectorAll(`article.pd2-kaart[data-c="${c}"] .pd2-velden > .pd2-f`)].map(x => x.dataset.kc).join() === 'rl,rmax', kr));
  if(['pallet', 'deel'].includes(so)){ await vul(kr, 'rl', 25); await vul(kr, 'rmax', 6); }
  check('Opdracht r2 gedaan (lengte en max rollen bevestigd)', ['pallet', 'deel'].includes(so) ? await done('rollen', 'r2') : true);

  /* ===== stap 2 Gewicht en afgerond ===== */
  const vrijPick = x => ev(x => Object.keys(WH.D.P).find(c => !x.includes(c) && PD2R.actief(c) && !PD2R.isKoppel(c) && !PD2R.isSam(c) && WHPD2.segVan(c) === 'pick' && PD2R.info(c).f.pick.length && PD2R.info(c).ink && !PD2R.rolKand(c) && !PD2R.po(c)), x);
  const ap = await vrijPick([pk, ant]);
  await naarFam(ap, 'soort');
  await kaart(ap).locator('[data-a="soortkies"][data-v="pick"]').click(); await wacht(250);
  await stap('hoev'); await vul(ap, 'maxpick', 9);
  check('Na soort en hoeveelheid nog niet af (gewicht open)', await ev(c => !PD2R.status(c).af, ap));
  await stap('gewicht');
  const gk = await ev(c => { const k = document.querySelector(`article.pd2-kaart[data-c="${c}"]`); return { vragen:k.querySelectorAll('.pd2-vraag').length, label:k.querySelector('.pd2-gw .pd2-q').textContent, knoppen:[...k.querySelectorAll('[data-a="gewst"]')].map(b => b.dataset.v).join() }; }, ap);
  check('Stap 2: één vraag, kg met gewogen / vertrouwd / te wegen', gk.vragen === 1 && /^Gewicht \(kg/.test(gk.label) && gk.knoppen === 'gewogen,vertrouwd,tewegen', JSON.stringify(gk));
  await kaart(ap).locator('[data-a="gewst"][data-v="vertrouwd"]').click(); await wacht(300);
  check('Gewicht vertrouwd + soort + hoeveelheid → afgerond; kaart verdwijnt uit Open', (await st(ap)).af && !(await kaarten()).includes(ap));
  check('Opdracht a1 gedaan', await done('afgerond', 'a1'));
  await P.click('[data-a="seg"][data-v="afgerond"]'); await wacht();
  await P.click(`.pd2-afrij[data-c="${ap}"] [data-a="heropen"]`); await wacht(300);
  await P.click('[data-a="seg"][data-v="open"]'); await wacht();
  check('Heropenen zet de kaart terug; opdracht a2 gedaan', (await kaarten()).includes(ap) && !(await st(ap)).af && await done('afgerond', 'a2'));
  const ap2 = await vrijPick([pk, ant, ap]);
  await naarFam(ap2, 'soort');
  await kaart(ap2).locator('[data-a="soortkies"][data-v="pick"]').click(); await wacht(250);
  await stap('hoev'); await vul(ap2, 'maxpick', 9);
  await stap('gewicht'); await kaart(ap2).locator('[data-a="gewst"][data-v="tewegen"]').click(); await wacht(300);
  const a3 = await st(ap2);
  check('Afgerond met ⚖: te wegen telt als besproken; opdracht a3 en g2 gedaan', a3.af && a3.gew === 'tewegen' && await done('afgerond', 'a3') && await done('weeglijst', 'g2'));

  /* ===== groepsacties gewicht ===== */
  await naarFam(pk, 'gewicht');
  const two = (await kaarten()).slice(0, 2);
  check('Stap 2 onderaan: "Alle gewichten kloppen" en "Aanpassen"', await P.isVisible('#pd2-stapacties [data-a="gewklopt"]') && await P.isVisible('#pd2-stapacties [data-a="gewpop"]'));
  await vink(two); await P.click('#pd2-stapacties [data-a="gewpop"]'); await wacht();
  await P.fill('#pd2-gp', '1,5'); await P.click('.pd2-modal [data-gst="gewogen"]'); await modalOk();
  const g1 = await ev(cs => cs.map(c => PD2R.gewicht(c)), two);
  check('Aanpassen: 1,5 kg gewogen voor de selectie; opdracht g1 gedaan', g1.every(g => g.st === 'gewogen' && g.kg === 1.5) && await done('weeglijst', 'g1'), JSON.stringify(g1.map(g => g.st + ' ' + g.kg)));
  await ev(() => { WHPD2.UI.sel.clear(); WHPD2.verversAlles(); });
  const rest = await ev(() => WHPD2.kaartCodes().filter(c => { const g = PD2R.gewicht(c); return g.st === 'niet' && g.pq > 0 && !PD2R.isSam(c) && PD2R.status(c).so !== 'weg'; }));
  if(rest.length){ await P.click('#pd2-stapacties [data-a="gewklopt"]'); await wacht(300);
    check('Alle gewichten kloppen: vertrouwd met de Picqer-kg', (await ev(cs => cs.map(c => PD2R.gewicht(c).st), rest)).every(s => s === 'vertrouwd')); }

  /* ===== Weeglijst, aannames (onder Meer) ===== */
  await P.click('[data-a="famweg"]'); await wacht(300); await meer();
  await P.click('.pd2-meer2 [data-a="view"][data-v="weeg"]'); await wacht(300);
  check('Opdracht g3 gedaan', await done('weeglijst', 'g3'));
  check('Weeglijst toont het te-wegen product, gegroepeerd per hal', await P.locator(`.pd2-wrij[data-c="${ap2}"]`).count() === 1 && await P.isVisible('.pd2-wl h3'));
  await P.locator(`.pd2-wrij[data-c="${ap2}"] [data-a="gewogen"]`).fill('2,25'); await P.locator(`.pd2-wrij[data-c="${ap2}"] [data-a="gewogen"]`).press('Tab'); await wacht(300);
  const g4 = await ev(c => PD2R.gewicht(c), ap2);
  check('Gewogen kg invullen → status gewogen; opdracht g4 gedaan', g4.st === 'gewogen' && g4.kg === 2.25 && await done('weeglijst', 'g4'), JSON.stringify(g4));
  await P.click('[data-a="viewweg"]'); await wacht();

  /* ===== feedback, opmerkingen, aannames ===== */
  await oefSet('deel');
  for(let i = 0; i < 2; i++){ await P.click('.pd2-oefkaart [data-a="oefvolg"]'); await wacht(80); }
  check('Na de laatste opdracht: de vier vragen in het kaartje', await P.isVisible('.pd2-oefkaart .pd2-vragen'));
  await P.click('.pd2-oefkaart [data-a="fb"][data-k="layout"][data-v="bijna"]');
  await P.fill('#pd2-fb-mis', 'Test: ik mis de laatste besteldatum'); await P.press('#pd2-fb-mis', 'Tab');
  await P.click('.pd2-oefkaart [data-a="fb"][data-k="gevoel"][data-v="4"]');
  const fb = await ev(() => PD2R.S.fb.tabs.deel);
  check('Vier vragen bewaard in feedback', fb && fb.layout === 'bijna' && fb.gevoel === '4' && /besteldatum/.test(fb.mis), JSON.stringify(fb));
  await naarFam(ant, 'hoev');
  await kaart(ant).locator('[data-a="info"]').click(); await wacht(200);
  check('Naam op de kaart opent "waarom deze voorstellen" met een opmerkingsknop', await P.isVisible('.pd2-modal') && await P.isVisible('.pd2-modal [data-a="opm"]'));
  await P.click('.pd2-modal [data-a="opm"]'); await wacht(200); await P.fill('#pd2-opm-t', 'Test: palletmaat klopt niet'); await modalOk();
  const opm = await ev(() => PD2R.S.fb.opm.slice(-1)[0]);
  check('Opmerking per product: soort en product gaan mee', opm && opm.code === ant && opm.tab === 'deel', JSON.stringify(opm));
  await P.click('[data-a="famweg"]'); await wacht();
  await meer(); await P.click('[data-a="oefmenu"]'); await P.click('.pd2-modal [data-a="opmalg"]'); await wacht(); await P.fill('#pd2-opm-t', 'Test: algemene opmerking'); await modalOk();
  await meer(); await P.click('.pd2-meer2 [data-a="view"][data-v="aann"]'); await wacht();
  check('Aannames: één lijst', await ev(() => document.querySelectorAll('.pd2-aannrij').length === Object.keys(PD2R.AANNAMES).length));
  await P.click('.pd2-aannrij[data-id="soortkol"] [data-a="aannv"][data-v="nee"]'); await wacht();
  check('Aanname afkeuren bewaard', await ev(() => PD2R.S.fb.aann.soortkol && PD2R.S.fb.aann.soortkol.v === 'nee'));
  await P.click('[data-a="viewweg"]'); await wacht();

  /* ===== tellers ===== */
  await naarFam(ant);
  const verdeling = await ev(() => { const cs = WHPD2.blokCodes(); return { tot:cs.length, open:WHPD2.openCodes().length, af:WHPD2.afCodes().length }; });
  check('Elk product van de maat staat open of onder Afgerond', verdeling.open + verdeling.af === verdeling.tot, JSON.stringify(verdeling));
  const stapTel = await ev(() => { const cs = WHPD2.openCodes(); return [...document.querySelectorAll('.pd2-stappen [data-a="stap"]')].every(b => { const o = cs.filter(c => !PD2R.status(c).stap[b.dataset.v]).length; return b.textContent.includes(o ? String(o) : '✓'); }); });
  check('Stapknoppen tonen hoeveel producten nog open staan', stapTel);
  const maatTel = await ev(() => WHPD2.maatgroepen().every(m => { const b = document.querySelector(`.pd2-maat[data-v="${CSS.escape(m.k)}"]`); return b && (m.open ? b.textContent.includes(m.velden + ' open') : b.textContent.includes('✓')); }));
  check('Maattegels: kleuren en open velden kloppen', maatTel);

  /* ===== kopieer alles voor Claude ===== */
  await P.click('[data-a="famweg"]'); await wacht();
  await meer(); await P.click('[data-a="oefmenu"]'); await P.click('.pd2-modal [data-a="kopieer"]'); await wacht(400);
  const tekst = await P.textContent('.pd2-modal pre');
  check('Kopieer alles voor Claude geeft leesbare tekst', /== Pallet ==/.test(tekst) && /== Voorstellen/.test(tekst) && /algemene opmerking/.test(tekst) && /\d+ oefenantwoorden met het oefenkaartje aan: niet meegeteld/.test(tekst));
  require('fs').writeFileSync(SCRATCH + '/claude-tekst.txt', tekst);
  await P.click('.pd2-modal [data-m="nee"]');

  /* ===== opslag ===== */
  await ev(() => PD2R.flush()); await wacht(800); await ev(() => PD2R.flush());
  check('Met het oefenkaartje aan: alleen geschreven naar wh-pd2-oefen en wh-pd2-feedback (niet naar productdata)', T.blocked.length === 0 && T.writes.length > 0 && T.writes.every(k => /^wh-pd2-(oefen|feedback)$/.test(k)), 'writes ' + T.writes.length + ', geblokkeerd ' + T.blocked.length + ' ' + T.blocked.slice(0, 2).join(' | '));
  check('wh-pd2-oefen bevat de geoefende producten', Object.keys((T.mock['wh-pd2-oefen'] || {}).p || {}).length > 5);
  check('wh-pd2-feedback bevat opmerkingen', ((T.mock['wh-pd2-feedback'] || {}).opm || []).length >= 2);
  await P.reload(); await P.waitForFunction(() => window.PD2R && PD2R.S.klaar && document.querySelector('.pd2[data-scherm="start"]'), null, { timeout:120000 });
  check('Na herladen staat de oefendata er nog', await ev(c => PD2R.waarde(c, 'spp').st === 'aangepast', ant));
  check('Na herladen staat oefenen nog aan (kaartje)', await P.isVisible('.pd2-oefkaart'));
  await meer(); await P.click('[data-a="oefmenu"]'); await P.click('.pd2-modal [data-a="wissen"]'); await wacht(900);
  const rest2 = Object.entries(T.mock['wh-pd2-oefen'].p).map(([c, p]) => [c, Object.entries(p.f || {}).filter(([k, x]) => x && x.oef).map(([k]) => k).concat(['so', 'weg', 'gew', 'rol'].filter(k => p[k] && p[k].oef))]).filter(x => x[1].length);
  check('Oefenantwoorden wissen: geen oefenantwoord meer in wh-pd2-oefen, feedback blijft', rest2.length === 0 && T.mock['wh-pd2-feedback'].opm.length >= 2, JSON.stringify(rest2.slice(0, 3)));
  console.log('\nERRORS:\n' + T.errors.join('\n'));
  console.log('\n' + ok.length + ' OK, ' + fout.length + ' FOUT');
  require('fs').writeFileSync(SCRATCH + '/oef-uitslag.json', JSON.stringify({ ok, fout, errors:T.errors, blocked:T.blocked }, null, 1));
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
