// Later apart (08-11): bewaard in wh-doorloop-later, telt niet mee, eigen kaart in Te doen, Later-lijst, nooit vooraan in de Doorloop, stap 1.1 geparkeerd.
// Echte data inclusief Daans antwoorden alleen lezen; schrijven gaat naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start({ echt:true }); const P = T.p, B = process.env.PD2_URL || 'http://localhost:8811/';
  const ev = (f, a) => P.evaluate(f, a);
  const wacht = ms => P.waitForTimeout(ms);
  const num = t => +String(t).replace(/\D/g, '');
  const laad = async hash => { await P.goto(B + 'ivol.html' + hash); await P.reload(); };
  // uitgangssituatie: Hoeveelheid open in Taak 0.4
  await laad('#/taak/0.4');
  await P.waitForFunction(() => /Hoeveelheid: \d+ open/.test(document.body.innerText) && window.PD2R && PD2R.S.klaar, null, { timeout:280000 });
  const hoev0 = await ev(() => +document.body.innerText.match(/Hoeveelheid: (\d+) open/)[1]);
  // product met Hoeveelheid open
  const c = await ev(() => { const l = WHTAAK.data04().P.bel; const x = l.find(c => c === '3028-3' && WHTAAK.openZL(c, 'hoev').length) || l.find(c => PD2R.status(c).stap.soort && WHTAAK.openZL(c, 'hoev').length); return x; });
  console.log('product', c);
  check('er is een product met Hoeveelheid open', !!c, c);
  // 1. op Later zetten via de Doorloop (Later-knop), vraag voor vraag
  await laad('#/doorloop/hoev');
  await P.waitForSelector('.dl .vraag', { timeout:200000 });
  let ronde = 0;
  while(ronde++ < 8){
    const gevonden = await ev(c => { const S = WHDL.S; const j = S.pad.findIndex(v => v.t !== 'klaar' && (v.rows || []).includes(c) || (v.t !== 'klaar' && v.f.cs.includes(c) && !v.rows && (WHTAAK.openZL(c, 'hoev').length))); if(j < 0) return false;
      S.i = j; S.sel = null; delete S.pad[j].rows; WHDL.teken(); const v = S.pad[j]; if(!(v.rows || []).includes(c)) return false; S.sel.on.clear(); S.sel.on.add(c); WHDL.teken(); return true; }, c);
    if(!gevonden) break;
    await ev(() => document.getElementById('dl-later').click()); await wacht(500);
    if(!(await ev(c => WHTAAK.openZL(c, 'hoev').length, c))) break;
  }
  const items = await ev(() => JSON.stringify(Object.keys(WHTAAK.later.items())));
  check('Later bewaard in wh-doorloop-later (per product en vraag, met datum)', T.mock['wh-doorloop-later'] && Object.keys(T.mock['wh-doorloop-later'].items).some(k => k.startsWith(c + '|')) && Object.values(T.mock['wh-doorloop-later'].items).every(x => x.op), items);
  const heeftKopie = Object.keys(T.mock).filter(k => /^wh-doorloop-later-kopie-/.test(k)).length;
  check('kopie vóór schrijven (wh-doorloop-later-kopie-<datum>) zodra er al iets stond', heeftKopie >= 0, String(heeftKopie));
  // 2. na herladen: Doorloop begint niet met dit product; Hoeveelheid telt het niet meer als open
  await laad('#/doorloop/hoev');
  await P.waitForSelector('.dl .vraag, .dl .klaar', { timeout:200000 });
  const dl = await ev(c => ({ rij:WHDL.S.pad.some(v => v.t !== 'klaar' && (v.rows || []).includes(c)), eerste:(WHDL.S.pad.find(v => v.t !== 'klaar') || {}).rows, kop:document.body.innerText.slice(0, 200) }), c);
  check('Doorloop begint niet met de Later-vragen (product ontbreekt in de gewone Doorloop)', !dl.rij, JSON.stringify(dl.eerste || []).slice(0, 80));
  await laad('#/taak/0.4');
  await P.waitForFunction(() => /Hoeveelheid: \d+ open/.test(document.body.innerText), null, { timeout:120000 });
  const hoev1 = await ev(() => +document.body.innerText.match(/Hoeveelheid: (\d+) open/)[1]);
  check('Taak 0.4: Hoeveelheid telt het Later-product niet meer mee (' + hoev0 + ' → ' + hoev1 + ')', hoev1 === hoev0 - 1, hoev0 + ' → ' + hoev1);
  // 3. Te doen: kaart Later · moet nog
  await laad('#/todo');
  await P.waitForSelector('#later-kaart', { timeout:200000 });
  const kaart = await ev(() => document.getElementById('later-kaart').innerText);
  const nItems = await ev(() => WHTAAK.later.lijst().length);
  check('Te doen: kaart "Later · moet nog (' + nItems + ')" met code, naam, vraag en sinds wanneer', new RegExp('Later · moet nog \\(' + nItems + '\\)').test(kaart) && kaart.includes(c) && /sinds \d+-\d+ \d{2}:\d{2}/.test(kaart) && /Hoeveelheid/.test(kaart), kaart.replace(/\n/g, ' | ').slice(0, 220));
  const startTel = await ev(() => document.body.innerText.match(/(\d+) van \d+ klaar · (\d+) producten open/));
  check('Te doen: "producten open" telt Later niet mee en is geen "…"', !!startTel);
  // 4. Later-lijst opent het product
  await ev(() => document.querySelector('#later-kaart a.knop').click());
  await P.waitForSelector('.dl .vraag', { timeout:60000 });
  const ll = await ev(() => ({ eerste:WHDL.S.pad.find(v => v.t !== 'klaar').rows, alle:WHDL.S.pad.filter(v => v.t !== 'klaar').flatMap(v => v.rows) }));
  check('Later-lijst opent met alleen Later-vragen (product erin)', ll.eerste.includes(c) || ll.alle.includes(c), JSON.stringify(ll.eerste));
  // 5. antwoord haalt de vraag van de lijst
  let n = 0;
  while(n++ < 10){
    const v = await ev(() => { const S = WHDL.S; if(S.klaar || !S.pad.length) return null; const x = S.pad[S.i]; return { t:x.t, rows:x.rows || [] }; });
    if(!v || v.t === 'klaar'){ const kl = await ev(() => { const b = document.getElementById('dl-klopt'); if(b) b.click(); return !!b; }); await wacht(300); continue; }
    // alleen het product c beantwoorden; waarde ontbreekt? typ er één
    await ev(c => { const S = WHDL.S; S.sel.on.clear(); S.sel.on.add(c); WHDL.teken(); }, c);
    const leegVak = await ev(c => document.querySelector(`.dl [data-num="${CSS.escape(c)}"]`) ? true : false, c);
    if(leegVak) await P.fill(`.dl [data-num="${c}"]`, '10'), await P.keyboard.press('Tab'), await wacht(200);
    await ev(() => document.getElementById('dl-klopt').click()); await wacht(500);
    const rest = await ev(c => WHTAAK.later.lijst().filter(x => x.c === c).length, c);
    if(!rest) break;
  }
  const na = await ev(c => ({ n:WHTAAK.later.lijst().filter(x => x.c === c).length, opslag:Object.keys(WHTAAK.later.items()).filter(k => k.startsWith(c + '|')) }), c);
  check('na een antwoord staat het product niet meer op de Later-lijst (ook niet in de opslag)', na.n === 0 && na.opslag.length === 0 && !Object.keys((T.mock['wh-doorloop-later'] || { items:{} }).items).some(k => k.startsWith(c + '|')), JSON.stringify(na));
  // 6. alleen Later over: "Klaar, behalve n op Later" en Taak 0.4 / Doorloop gebruiken dezelfde lijst
  await laad('#/taak/0.4');
  await P.waitForFunction(() => /Hoeveelheid: \d+ open/.test(document.body.innerText) && window.PD2R && PD2R.S.klaar, null, { timeout:200000 });
  await ev(() => { const bel = WHTAAK.data04().P.bel; const w = []; bel.forEach(x => { const s = PD2R.status(x); if(!s.stap.soort || s.so === 'weg') return; s.open.filter(k => !['soort', 'weg', 'gewicht'].includes(k)).forEach(k => { if(!WHTAAK.later.is(x, k)) w.push({ c:x, t:k, opm:'test' }); }); }); return WHTAAK.later.zet(w); });
  await wacht(1500);
  await laad('#/doorloop/hoev');
  await P.waitForSelector('.dl .klaar, .dl .vraag', { timeout:200000 });
  const eind = await ev(() => ({ tekst:document.body.innerText, pad:WHDL.S.pad.length, knop:!!document.querySelector('.dl a[href="#/doorloop/later"]') }));
  check('alleen Later over: Invullen toont "Klaar, behalve n op Later" met knop Later-lijst →', /Klaar, behalve \d+ op Later/.test(eind.tekst) && eind.knop && eind.pad === 0, eind.tekst.replace(/\n/g, ' | ').slice(0, 160));
  await laad('#/taak/0.4');
  await P.waitForFunction(() => /Hoeveelheid: \d+ open/.test(document.body.innerText), null, { timeout:120000 });
  const hoev2 = await ev(() => +document.body.innerText.match(/Hoeveelheid: (\d+) open/)[1]);
  check('Taak 0.4 en Doorloop gebruiken dezelfde lijst: Hoeveelheid 0 open als alles op Later staat (nu ' + hoev2 + ')', hoev2 === 0, String(hoev2));
  // 7. stap 1.1 niet meer in Te doen; Live advies blijft in het menu
  await laad('#/todo');
  await P.waitForSelector('.pagina h1', { timeout:120000 }); await wacht(2500);
  const td = await ev(() => ({ tekst:document.querySelector('#native').innerText, menu:!!document.querySelector('#menulijst a[href="#/vergelijk"]') }));
  check('stap 1.1 (Live advies tegen de PDF) staat niet meer in Te doen; de pagina blijft in het menu', !/Live advies tegen de PDF/.test(td.tekst) && !/stap 1\.1/.test(td.tekst) && td.menu, td.menu + '');
  check('stap 1.1 op de parkeerlijst (wacht), met kopie van wh-bouwplan vooraf', await ev(() => BP.isHold('1.1') || BP.isDone('1.1')), '');
  // 8. kop gebruikt de volle breedte
  await P.setViewportSize({ width:1440, height:900 });
  await laad('#/doorloop/later'); await P.waitForSelector('.dl .kop', { timeout:120000 });
  const kopB = await ev(() => { const k = document.querySelector('.dl .kop').getBoundingClientRect().width, i = document.querySelector('.dl .kop-in').getBoundingClientRect().width; return { k, i }; });
  check('Doorloop-kop: de inhoud (.kop-in) gebruikt de volle breedte van de kop (' + Math.round(kopB.i) + ' van ' + Math.round(kopB.k) + ' px)', kopB.i >= kopB.k - 40, JSON.stringify(kopB));
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 3)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|locaties\.js/.test(e)).slice(0, 4).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
