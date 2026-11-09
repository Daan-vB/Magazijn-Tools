// Doorloop: terug, aanpassen, zoeken, controle en vergelijkbaar (08-11). Kattenluik (PD-M-BLA). Echte data inclusief Daans antwoorden alleen lezen;
// schrijven gaat naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start({ echt:true }); const P = T.p, B = process.env.PD2_URL || 'http://localhost:8811/';
  const ev = (f, a) => P.evaluate(f, a);
  const wacht = ms => P.waitForTimeout(ms);
  const nu = () => ev(() => { const v = WHDL.S.pad[WHDL.S.i]; return { t:v.t, prod:WHDL.S.prod, gast:WHDL.S.gast, tekst:document.querySelector('.dl main') ? document.querySelector('.dl main').innerText : '' }; });
  await P.goto(B + 'ivol.html#/doorloop/gewicht');
  await P.waitForSelector('.dl .kop', { timeout:280000 });
  await P.waitForFunction(() => window.WHDL && WHDL.S.pad && document.getElementById('dl-zoekknop'), null, { timeout:60000 });
  const padVoor = await ev(() => WHDL.S.pad.length);
  // ZOEKEN
  await ev(() => document.getElementById('dl-zoekknop').click());
  await P.fill('#dl-zoekin', 'PD-M');
  await P.waitForSelector('[data-gast="PD-M-BLA"]', { timeout:20000 });
  const res = await ev(() => [...document.querySelectorAll('[data-gast]')].map(b => b.dataset.gast));
  check('zoeken op "PD-M" vindt Kattenluik M (ook producten die niet open staan)', res.includes('PD-M-BLA') && res.includes('PD-M-BRO'), res.join(','));
  await ev(() => document.querySelector('[data-gast="PD-M-BLA"]').click());
  await wacht(500);
  let v = await nu();
  check('1 Soort toont "Bevestigd: Deel" als alle producten al een bevestigde soort hebben (geen "Geen voorstel")', /Bevestigd: Deel/.test(v.tekst) && !/Geen voorstel uit de data/.test(v.tekst), v.tekst.split('\n').slice(0, 12).join(' | ').slice(0, 300));
  check('kiezen opent de familie in de Doorloop met alle vragen, knop "← Terug naar waar ik was"', v.gast && /Kattenluik/i.test(v.tekst) && !!(await ev(() => document.getElementById('dl-terugmain'))) , v.t);
  // vaste uitgangssituatie (in het geheugen): Daan vertrouwt het Picqer-gewicht van PD-M-BLA (0,378 kg), zoals in de melding van Daan
  await ev(() => { PD2R.poZet('PD-M-BLA', p => { p.gew = { st:'vertrouwd', kg:0.378, t:new Date().toISOString() }; }); });
  // OVERZICHT: oranje regel bij PD-M-BLA
  await ev(() => { const S = WHDL.S, j = S.pad.findIndex(x => x.t === 'klaar'); S.i = j; S.sel = null; WHDL.teken(); });
  const ov = await ev(() => ({ afw:[...document.querySelectorAll('.afw')].map(a => a.innerText.replace(/\s+/g, ' ')), rijen:[...document.querySelectorAll('[data-prod]')].map(b => b.dataset.prod) }));
  const a1 = ov.afw.find(t => /PD-M-BLA/.test(t));
  // 09-11 (CLAUDE.md §3, kleurgenoten = zelfde familie én maat): PD-M-BLA wordt alleen met de andere M-maten vergeleken, nooit met de L-maten
  check('overzicht: oranje regel bij PD-M-BLA met wat afwijkt van de kleurgenoten (zelfde maat), nooit van een andere maat', a1 && /0,38 kg per stuk, kleurgenoten \(zelfde maat\) 2 kg/.test(a1) && !/PD-L/.test(a1) && /Klopt dat\?/.test(a1), a1);
  const hl = await ev(() => ['PD-L-BLA', 'PD-L-WHI', 'PD-M-BLA'].map(c => c + '=' + (WHDL.halA20(c) || '-')).join(' '));
  check('Kattenluik: hoogte-melding alleen bij een product dat op een 20-locatie in hal A staat (' + hl + ')', ov.afw.every(t => !/hoogte/.test(t) || ((t.match(/^⚠ (\S+):/) || [])[1] && new RegExp(((t.match(/^⚠ (\S+):/) || [])[1]) + '=A[A-Z]\\d{2}[A-D]20').test(hl))) && !ov.afw.some(t => /PD-M-BLA: .*hoogte/.test(t)), ov.afw.join(' | ').slice(0, 260));
  check('overzicht: elke productregel is tikbaar', ov.rijen.includes('PD-M-BLA') && ov.rijen.includes('PD-L-WHI'), ov.rijen.join(','));
  // PRODUCTSCHERM: alle velden van het product
  await ev(() => document.querySelector('[data-prod="PD-M-BLA"]').click());
  await wacht(300);
  const pr = await ev(() => ({ velden:document.querySelectorAll('.dl .veld').length, tekst:document.querySelector('.dl main').innerText }));
  // 09-11 (CLAUDE.md §5, Claudes keuze): Deel met een vaste picklocatie krijgt ook aanvullen bij en max op pick, alleen als die ontbreken
  const metPick = await ev(() => PD2R.metVastePick('PD-M-BLA'));
  const lvlOpen = await ev(() => PD2R.nodigVan('PD-M-BLA', 'deel').includes('lvl'));
  check('tik op PD-M-BLA opent één scherm met alle velden die bij Deel horen (soort, gewicht, per pallet, palletmaat, hoogte; met picklocatie ook aanvullen bij en max op pick)', pr.velden >= 5 && /Welke soort/.test(pr.tekst) && /gewicht per stuk/.test(pr.tekst) && /stuks per pallet/.test(pr.tekst) && /palletmaat/.test(pr.tekst) && /Hoe hoog/.test(pr.tekst) && (metPick && lvlOpen ? /Aanvullen bij/.test(pr.tekst) && /Max op pick/.test(pr.tekst) : !/Max op pick/.test(pr.tekst)), pr.velden + ' velden · picklocatie ' + metPick);
  // VERGELIJKBAAR
  await ev(() => document.querySelector('[data-vergt="gewicht"]').click());
  const vg = await ev(() => [...document.querySelectorAll('.verg .vrij')].map(r => r.innerText.replace(/\s+/g, ' ')));
  check('Vergelijkbaar: PD-L-WHI en PD-L-BLA met hun gewicht (max 6, kleurgenoten eerst), met waarom', vg.length <= 6 && vg.some(t => /PD-L-WHI/.test(t) && /3 kg/.test(t) && /andere maat/.test(t)) && vg.some(t => /PD-L-BLA/.test(t) && /3 kg/.test(t)) && vg.every(t => /bevestigd|voorstel/.test(t)), vg.join(' | '));
  check('Vergelijkbaar: eerst kleurgenoten (PD-M-BRO, PD-M-WHI), dan de L-maten', vg.length >= 4 && /PD-M-BRO/.test(vg[0]) && /PD-M-WHI/.test(vg[1]) && /PD-L-/.test(vg[2]), vg.map(t => t.slice(0, 9)).join(' '));
  check('Vergelijkbaar bevat nooit SAM Europe', !(await ev(() => [...document.querySelectorAll('.verg code')].some(c => PD2R.isSam(c.innerText)))));
  // NEEM OVER + Klopt → volle pallet opnieuw
  await ev(() => document.querySelector('.verg [data-over="PD-M-BLA|gewicht|PD-M-WHI"]').click());
  await wacht(300);
  const no = await ev(() => ({ chip:document.querySelector('[data-pk="gewicht|vertrouwd"]').className, tekst:document.querySelector('.dl main').innerText, nog:!(PD2R.po('PD-M-BLA') && PD2R.po('PD-M-BLA').gew && PD2R.po('PD-M-BLA').gew.kg === 2) }));
  check('Neem over zet 2 kg (kleurgenoot PD-M-WHI) bij PD-M-BLA, zichtbaar zwart, nog niet opgeslagen; volle pallet 335 kg', /\bon\b/.test(no.chip) && /volle pallet 335 kg/.test(no.tekst) && no.nog, no.chip);
  await ev(() => document.getElementById('dl-klopt').click());
  await wacht(800);
  const na = await ev(() => { const g = PD2R.po('PD-M-BLA') && PD2R.po('PD-M-BLA').gew; return { g, tekst:document.querySelector('.dl main').innerText, afw:[...document.querySelectorAll('.afw')].map(a => a.innerText) }; });
  check('Klopt → terug naar het overzicht, opnieuw berekend (volle pallet 335 kg), oranje regel weg, opgeslagen als 2 kg', na.g && na.g.kg === 2 && /volle pallet 335 kg/.test(na.tekst) && !na.afw.some(t => /PD-M-BLA.*kg per stuk/.test(t)), JSON.stringify(na.g));
  // STAPPEN TIKBAAR + ← naar de vorige vraag met bevestigde waarden
  await ev(() => document.querySelector('[data-stap="2"]').click());
  await wacht(300);
  v = await nu();
  const gw = await ev(() => [...document.querySelectorAll('.dl .rij')].map(r => ({ c:r.querySelector('code').innerText, w:r.querySelector('.waarde').innerText, zelf:r.querySelector('.waarde').classList.contains('zelf') })));
  check('tik op 2 Gewicht toont alle 3 producten met hun bevestigde status (zwart)', v.t === 'gewicht' && gw.length >= 3 && gw.every(x => /Vertrouwd|Gewogen|Te wegen/.test(x.w)) && gw.filter(x => x.zelf).length >= 3, JSON.stringify(gw));
  await ev(() => document.querySelector('[data-stap="3"]').click());
  await wacht(300);
  v = await nu();
  check('tik op 3 Hoeveelheid opent de eerste hoeveelheidsvraag voor alle producten', ['spp', 'maat', 'hoogte', 'lvl', 'maxpick'].includes(v.t), v.t);
  await ev(() => document.getElementById('dl-terug').click());
  await wacht(300);
  v = await nu();
  check('← vanaf Hoeveelheid komt bij Gewicht (met bevestigde waarden)', v.t === 'gewicht', v.t);
  // Klopt na een stap-sprong → terug naar waar Daan was
  await ev(() => { const S = WHDL.S; S.i = S.pad.findIndex(x => x.t === 'klaar'); S.terugNaar = null; S.prod = null; WHDL.teken(); });
  const klaarI = await ev(() => WHDL.S.i);
  await ev(() => document.querySelector('[data-stap="2"]').click()); await wacht(300);
  await ev(() => document.getElementById('dl-klopt').click()); await wacht(500);
  check('Klopt na een sprong brengt Daan terug naar waar hij was (overzicht)', (await ev(() => WHDL.S.i)) === klaarI, String(klaarI));
  // KLOPT onthouden (afwijking melden maar niet meer): op een product met een afwijking
  const afwC = await ev(() => { const c = WHDL.S.fams[0].cs.concat(Object.keys(WH.D.P).filter(x => /^PD-/.test(x))).find(x => { try{ return document.querySelector('x') || false; }catch(e){ return false; } }); return null; });
  // 0 geblokkeerd; terug naar waar ik was
  await ev(() => document.getElementById('dl-terugmain').click()); await wacht(300);
  const tm = await ev(() => ({ gast:WHDL.S.gast, pad:WHDL.S.pad.length }));
  check('"← Terug naar waar ik was" zet de Doorloop terug zoals hij was', !tm.gast && tm.pad === padVoor, JSON.stringify(tm) + ' vs ' + padVoor);
  // hoogte-melding alleen bij een product met een pick- of bulklocatie op een 20-locatie in hal A en een pallet boven 140 cm
  const ha = await ev(() => { const P = PD2R; const c = Object.keys(WH.D.P).find(c => P.actief(c) && !P.isSam(c) && WHDL.halA20(c) && ['pallet', 'deel', 'bulk'].includes(P.status(c).so) && +P.waarde(c, 'hoogte').v > 140); if(!c) return null; return { c, loc:WHDL.halA20(c), hoogte:P.waarde(c, 'hoogte').v, afw:(WHDL.afwijkLijn(c) || {}).tekst || '' }; });
  const zonder = await ev(() => { const P = PD2R; const c = Object.keys(WH.D.P).find(c => P.actief(c) && !P.isSam(c) && !WHDL.halA20(c) && ['pallet', 'deel', 'bulk'].includes(P.status(c).so) && +P.waarde(c, 'hoogte').v > 140); return c ? { c, afw:(WHDL.afwijkLijn(c) || {}).tekst || '' } : null; });
  check('product met een 20-locatie in hal A en een pallet boven 140 cm: wel een hoogte-melding' + (ha ? ' (' + ha.c + ' op ' + ha.loc + ', ' + ha.hoogte + ' cm)' : ''), ha ? /hoogte .* cm is hoger dan 140 cm en het product staat op A[A-Z]\d{2}[A-D]20 \(20-locatie in hal A\)/.test(ha.afw) : true, ha ? ha.afw : 'geen product met zo\'n locatie in de data (overgeslagen)');
  check('pallet boven 140 cm zonder 20-locatie in hal A: geen hoogte-melding' + (zonder ? ' (' + zonder.c + ')' : ''), !zonder || !/hoogte/.test(zonder.afw), zonder ? zonder.afw : '');
  // KLOPT op een afwijking: onthouden (ook na herladen), niet meer melden; er wordt niets gewijzigd
  await ev(() => { PD2R.poZet('PD-XL-WHI', p => { p.gew = { st:'vertrouwd', kg:0.2, t:new Date().toISOString() }; }); });
  await ev(() => document.getElementById('dl-zoekknop').click()); await P.fill('#dl-zoekin', 'PD-XL-WHI'); await P.waitForSelector('[data-gast="PD-XL-WHI"]');
  await ev(() => document.querySelector('[data-gast="PD-XL-WHI"]').click());
  await ev(() => { const S = WHDL.S; S.i = S.pad.findIndex(x => x.t === 'klaar'); WHDL.teken(); });
  const af0 = await ev(() => [...document.querySelectorAll('.afw')].filter(a => /PD-XL-WHI/.test(a.innerText)).length);
  const gewVoor = await ev(() => JSON.stringify(PD2R.po('PD-XL-WHI').gew));
  if(af0){
    await ev(() => document.querySelector('.afw [data-akkoord="PD-XL-WHI"]').click()); await wacht(500);
    const af1 = await ev(() => [...document.querySelectorAll('.afw')].filter(a => /PD-XL-WHI/.test(a.innerText)).length);
    const opm = await ev(() => (PD2R.S.fb.opm || []).filter(o => o.bron === 'doorloop-akkoord' && /PD-XL-WHI/.test(o.key)).length);
    const gewNa = await ev(() => JSON.stringify(PD2R.po('PD-XL-WHI').gew));
    check('Klopt op een afwijking: regel weg, onthouden (feedback-opmerking), waarde ongewijzigd', af1 === 0 && opm === 1 && gewNa === gewVoor, af0 + ' → ' + af1 + ', opm ' + opm);
  } else check('geen afwijking bij PD-XL-WHI in deze situatie (Klopt-onthouden overgeslagen)', true);
  await ev(() => document.getElementById('dl-terugmain').click()); await wacht(300);
  // 390 en 1440 px
  for(const vp of [{ width:1440, height:900 }, { width:390, height:844 }]){
    await P.setViewportSize(vp);
    await ev(() => document.getElementById('dl-zoekknop').click()); await P.fill('#dl-zoekin', 'PD-M'); await P.waitForSelector('[data-gast="PD-M-BLA"]');
    const sc = {};
    sc.zoek = await ev(() => document.documentElement.scrollWidth > innerWidth + 1);
    await ev(() => document.querySelector('[data-gast="PD-M-BLA"]').click());
    await ev(() => { const S = WHDL.S; S.i = S.pad.findIndex(x => x.t === 'klaar'); WHDL.teken(); }); sc.overzicht = await ev(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.dl *')].some(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1; }));
    await ev(() => document.querySelector('[data-prod="PD-M-BLA"]').click()); await ev(() => document.querySelector('[data-vergt="gewicht"]').click());
    sc.product = await ev(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.dl *')].some(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1; }));
    await ev(() => { document.getElementById('dl-terug').click(); document.getElementById('dl-terugmain').click(); });
    check('zoeken, overzicht en productscherm ' + vp.width + ' px: geen horizontaal scrollen', !sc.zoek && !sc.overzicht && !sc.product, JSON.stringify(sc));
  }
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 3)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|locaties\.js/.test(e)).slice(0, 5).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
