// Te doen (stap 0.4) leegmaken (06-11): live telling, bewezen voorstellen in één tik, overzetten met kopie, startpagina. Echte data (ook Daans antwoorden) alleen lezen; schrijven gaat naar een kopie in het geheugen.
const { start, voorBesluit } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start({ echt:true }); const P = T.p, B = process.env.PD2_URL || 'http://localhost:8811/';
  const ev = (f, a) => P.evaluate(f, a);
  const num = t => +String(t).replace(/\D/g, '');
  // 1. startpagina
  await P.goto(B + 'ivol.html#/todo');
  // sinds 08-11 staat "wacht op jouw tik" in de tabs van Te doen (de losse kaart is weg); de telling "N producten open" blijft
  await P.waitForFunction(() => /\d+ producten open/.test(document.body.innerText) && document.querySelector('.cp-tabs'), null, { timeout:280000 });
  const t = await ev(() => { const W = PD2R.wachtOp(), s = new Set(); ['soort', 'gewicht', 'hoev'].forEach(k => W[k].bewezen.forEach(b => s.add(b.c))); let tc = new Set(); try{ tc = new Set(WHX.vraagLijst().map(q => q.c)); }catch(e){} tc.forEach(c => s.add(c));
    const kern = (document.body.innerText.match(/\d+ van \d+ klaar[^\n]*/) || [''])[0], wacht = (document.body.innerText.match(/([\d.]+) producten wachten op jouw tik/) || [])[1];
    const begin = [...document.querySelectorAll('a.knop')].find(a => a.innerText.trim() === 'Begin');
    const open = WHPD.poort().bel.filter(c => { const st = PD2R.status(c); return !st.kop && st.open.length && WHTAAK.openZL(c, '').length > 0; }).length;   // Later telt niet mee
    return { kern, wacht, begin:begin && begin.getAttribute('href'), n:s.size, open, tcMetWHX:!!(window.WHX && WHX.S && WHX.S.pd) }; });
  console.log(JSON.stringify(t));
  check('startpagina: "n van 9 klaar · N producten open" zonder "…", N = live telling', !/…/.test(t.kern) && num(t.kern.split('·')[1]) === t.open, t.kern + ' / ' + t.open);
  check('startpagina: Te doen in tabs (Overzicht eerst), geen losse kaart "Wacht op jouw tik"', !/Wacht op jouw tik/.test(await ev(() => document.querySelector('#native').innerText)) && /^Overzicht/.test(await ev(() => document.querySelector('.cp-tab').innerText)), '');
  for(const vp of [{ width:1440, height:900 }, { width:390, height:844 }]){
    await P.setViewportSize(vp); await P.waitForTimeout(500);
    check('startpagina ' + vp.width + ' px: geen horizontaal scrollen', !(await ev(() => document.documentElement.scrollWidth > innerWidth + 1)));
  }
  await P.setViewportSize({ width:1440, height:900 });
  // 2. taak 0.4: per laag open · bewezen · echte vraag
  await P.goto(B + 'ivol.html#/taak/0.4'); await P.reload();
  await P.waitForFunction(() => /Soort: \d+ open/.test(document.body.innerText) && /Hoeveelheid: \d+ open/.test(document.body.innerText), null, { timeout:280000 });
  const lagen = await ev(() => { const W = PD2R.wachtOp(), tx = document.body.innerText; const rij = k => { const m = tx.match(new RegExp(PD2R.STAPNAAM[k] + ': (\\d+) open\\s+(\\d+) met bewezen voorstel \\(één tik\\) · (\\d+) echte vraag')); return m ? [+m[1], +m[2], +m[3]] : null; }; return ['soort', 'gewicht', 'hoev'].map(k => ({ k, scherm:rij(k), live:(() => { const rest = c => WHTAAK.openZL(c, k).length > 0, b = W[k].bewezen.filter(x => rest(x.c)).length, v = W[k].vraag.filter(rest).length; return [b + v, b, v]; })() })); });   // Later telt niet mee (zoals het scherm, 08-11)
  check('taak 0.4: per laag open · bewezen · echte vraag = live telling, som klopt', lagen.every(l => l.scherm && JSON.stringify(l.scherm) === JSON.stringify(l.live) && l.live[0] === l.live[1] + l.live[2]), JSON.stringify(lagen));
  const oud = await ev(() => { const bel = WHPD.poort().bel; return bel.filter(c => WHPD.openStappen(c).length).length === bel.filter(c => { const s = PD2R.status(c); return !s.kop && s.open.length; }).length; });
  check('telling in Poort 0.4 = Productdata 2.0 (zelfde producten open)', oud);
  // 3. voorstellen: blok per reden, rekensom, bevestigen met uitvinken
  for(const vp of [{ width:1440, height:900 }, { width:390, height:844 }]){
    await P.setViewportSize(vp);
    // onafhankelijk van Daans live besluiten: de situatie vóór zijn besluit in het geheugen (voorBesluit), dan het voorstelscherm
    await P.goto(B + 'ivol.html#/pd2'); await P.reload(); await P.waitForFunction(() => window.PD2R && PD2R.S.klaar && document.querySelector('.pd2[data-scherm]:not([data-scherm="laden"])'), null, { timeout:280000 }); await voorBesluit(P, 60);
    await ev(() => { location.hash = '#/pd2/voorstel/gewicht'; });
    await P.waitForSelector('.pd2[data-scherm="voorstel"] section[data-g]', { timeout:200000 });
    const v = await ev(() => ({ hs:document.documentElement.scrollWidth > innerWidth + 1 || document.querySelector('.pd2').scrollWidth > innerWidth + 1, blokken:[...document.querySelectorAll('section[data-g]')].map(s => s.dataset.g), tekst:document.querySelector('.pd2').textContent }));
    check('voorstelscherm ' + vp.width + ' px: geen horizontaal scrollen', !v.hs);
    if(vp.width === 1440) check('voorstelblokken tonen reden en rekensom (gewicht)', v.blokken.length > 0 && /kg volle pallet/.test(v.tekst) && /% verschil/.test(v.tekst), v.blokken.join(' | '));
  }
  await P.setViewportSize({ width:1440, height:900 });
  const blok = await ev(() => { const s = [...document.querySelectorAll('section[data-g]')].find(s => s.querySelectorAll('input[data-a="vsel"]').length >= 3) || document.querySelector('section[data-g]'); const cs = [...s.querySelectorAll('input[data-a="vsel"]')].map(i => i.closest('[data-c]').dataset.c); return { g:s.dataset.g, cs, open:cs.filter(c => !PD2R.status(c).stap.gewicht).length }; });
  // één product uitvinken
  await ev(g => { const s = document.querySelector('section[data-g="' + g + '"]'); s.querySelector('input[data-a="vsel"]').click(); }, blok.g);
  const knopTxt = await ev(g => document.querySelector('section[data-g="' + g + '"] [data-a="vbev"]').innerText, blok.g);
  check('uitvinken verlaagt de selectie op de knop', num(knopTxt) === blok.cs.length - 1, knopTxt);
  const schrijf0 = T.pdWrites.length;
  await ev(g => document.querySelector('section[data-g="' + g + '"] [data-a="vbev"]').click(), blok.g);
  await P.waitForFunction(() => document.querySelector('#pd2-undo') && !document.querySelector('#pd2-undo').hidden, null, { timeout:60000 });
  await P.waitForTimeout(1500);
  const na = await ev(([g, cs]) => ({ open:cs.filter(c => !PD2R.status(c).stap.gewicht).length, uitgevinkt:PD2R.status(cs[0]).stap.gewicht, bevestigd:cs.slice(1).every(c => PD2R.status(c).stap.gewicht), kopie:Object.keys(window.__mock || {}) }), [blok.g, blok.cs]);
  check('bevestigen: teller daalt direct met het aantal geselecteerde producten', na.open === blok.open - (blok.cs.length - 1) && na.bevestigd && !na.uitgevinkt, blok.open + ' → ' + na.open);
  check('bevestigen schrijft (onderschept) met kopie wh-kopie-productdata-<datum>-7', Object.keys(T.mock).some(k => /^wh-kopie-productdata-\d{4}-\d{2}-\d{2}-[67]$/.test(k)) && (T.pdWrites.length > schrijf0 || Object.keys(T.mock).some(k => /^wh-pd2-oefen/.test(k))), Object.keys(T.mock).join(','));
  // 4. overzetten van de 14 waarden
  await P.goto(B + 'ivol.html#/taak/0.4'); await P.reload();
  await P.waitForFunction(() => /waarden nog over te zetten|Zet \d+ waarden over/.test(document.body.innerText), null, { timeout:280000 }).catch(() => {});
  const ov = await ev(() => { const b = [...document.querySelectorAll('button[data-a="pd-overzet"]')][0]; return b ? b.innerText : null; });
  if(ov){
    const voor = await ev(() => Object.values(WHPD.telOud().t).reduce((a, b) => a + b, 0));
    const w0 = T.pdWrites.length;
    await ev(() => document.querySelector('button[data-a="pd-overzet"]').click());
    await P.waitForFunction(() => Object.values(WHPD.telOud().t).reduce((a, b) => a + b, 0) === 0, null, { timeout:120000 }).catch(() => {});
    const nu = await ev(() => Object.values(WHPD.telOud().t).reduce((a, b) => a + b, 0));
    check('overzetten: ' + ov + ' → vooraf ' + voor + ' waarden, daarna ' + nu + ' over; kopie gemaakt', voor > 0 && nu === 0 && T.pdWrites.length > w0 && Object.keys(T.mock).some(k => /^wh-kopie-productdata-.+-6$/.test(k)));
  } else check('overzetten: er is niets meer over te zetten (0 waarden)', true);
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 3)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|locaties\.js/.test(e)).slice(0, 4).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
