// Productdata 2.0 is de enige route (31-10): links uit Te doen/taken, oude kaart met verwijzing, geen palletvraag zonder bewijs, 390 en 1440 px. Echte database alleen lezen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p, B = process.env.PD2_URL || 'http://localhost:8811/';
  const ev = (f, a) => P.evaluate(f, a);
  await P.goto(B + 'ivol.html#/taak/0.4');
  await P.waitForFunction(() => window.PD2R && PD2R.S.klaar && /producten open/.test(document.body.innerText), null, { timeout:300000 });
  const hr = await ev(() => [...document.querySelectorAll('a.knop[data-taak]')].map(a => a.getAttribute('href')));
  check('Invullen/Kiezen/Overzetten openen nooit de laag-tabel of oude kaart', hr.length > 0 && hr.every(h => !/productdata\/(open|p\/|dubbel)|#\/productdata$/.test(h)), hr.join(' '));
  const getal = +((await ev(() => document.body.innerText.match(/(\d[\d.]*) producten open/)[1])).replace(/\D/g, ''));
  const n2 = await ev(() => WHPD.poort().bel.filter(c => { const s = PD2R.status(c); return !s.kop && s.open.length; }).length);
  check('Te doen: producten open = Productdata 2.0 (niet 334)', getal === n2 && getal !== 334, getal + ' / ' + n2);
  const prod = async (code, vp) => {
    await P.setViewportSize(vp);
    await P.goto(B + 'ivol.html#/pd2/p/' + code);
    await P.waitForFunction(c => document.querySelector('.pd2[data-scherm="fam"] [data-c="' + c + '"]'), code, { timeout:120000 });
    await P.waitForTimeout(800);
    return ev(c => { const k = document.querySelector('.pd2 [data-c="' + c + '"]'), r = k.getBoundingClientRect(); return { zicht:r.bottom > 0 && r.top < innerHeight, naam:/Sportvloer|Puzzel/i.test(document.body.innerText), hs:document.documentElement.scrollWidth > innerWidth + 1 || document.querySelector('.pd2').scrollWidth > innerWidth + 1, stappen:[...document.querySelectorAll('.pd2-stappen button')].map(b => b.textContent.trim()).join('|'), tekst:k.innerText.slice(0, 300) }; }, code);
  };
  for(const vp of [{ width:1440, height:900 }, { width:390, height:844 }]){
    const r = await prod('FTP-106106010', vp);
    check('FTP-106106010 opent Productdata 2.0, product zichtbaar, geen horizontale scroll (' + vp.width + ')', r.zicht && !r.hs && r.naam, JSON.stringify(r).slice(0, 220));
  }
  await P.setViewportSize({ width:1440, height:900 });
  const open = await ev(() => WHPD.poort().bel.find(c => { const st = PD2R.status(c); return !st.kop && st.so && st.so !== 'weg' && st.stap && st.stap.soort && !st.stap.gewicht; }));
  await P.goto(B + 'ivol.html#/pd2/p/' + open); await P.reload();
  await P.waitForFunction(c => document.querySelector('.pd2[data-scherm="fam"] [data-c="' + c + '"]'), open, { timeout:120000 });
  const gt = await ev(() => { const b = [...document.querySelectorAll('.pd2-stappen button')].find(b => /Gewicht/.test(b.textContent)); if(b) b.click(); return document.querySelector('.pd2').innerText; });
  await P.waitForTimeout(500);
  const gt2 = await ev(() => document.querySelector('.pd2').innerText);
  check('stap 2 Gewicht (' + open + '): gewogen · vertrouwd · te wegen', /gewogen/i.test(gt2) && /vertrouwd/i.test(gt2) && /te wegen/i.test(gt2));
  const set = await ev(() => Object.keys(WH.D.P).filter(c => /^1711-.*-set$/i.test(c)).map(c => { const st = PD2R.status(c); return { c, bewijs:!!PD2R.info(c).bewijs, pal:(st.open || []).filter(k => ['spp', 'maat', 'hoogte'].includes(k)) }; }));
  check('1711-*-set: nooit een palletvraag zonder bewijs', set.length > 0 && set.every(x => x.bewijs || !x.pal.length), JSON.stringify(set.slice(0, 4)));
  await P.goto(B + 'ivol.html#/vloernamen/?q=FTP-106106010');
  await P.waitForTimeout(8000);
  const fr = P.frames().find(f => /containerplanning/.test(f.url()));
  const q = fr ? await fr.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value)) : [];
  check('Vloernamen opent met FTP-106106010 in het zoekveld', q.includes('FTP-106106010'), q.join(','));
  for(const vp of [{ width:1440, height:900 }, { width:390, height:844 }]){
    await P.setViewportSize(vp);
    await P.goto(B + 'warehouse.html#/productdata/p/FTP-106106010');
    await P.waitForFunction(() => document.querySelector('[data-oudekaart]'), null, { timeout:120000 });
    const o = await ev(() => { const k = document.querySelector('[data-oudekaart]'); return { n:k.querySelectorAll('a.btn').length, tekst:k.innerText, hs:document.documentElement.scrollWidth > innerWidth + 1, h:[...k.querySelectorAll('a')].map(a => a.getAttribute('href')) }; });
    check('oude kaart: regel + twee knoppen, geen horizontale scroll (' + vp.width + ')', o.n === 2 && /Oude pagina/.test(o.tekst) && !o.hs, JSON.stringify(o.h));
  }
  await P.setViewportSize({ width:1440, height:900 });
  await P.goto(B + 'warehouse.html#/productdata/dubbel'); await P.reload();
  await P.waitForFunction(() => document.querySelector('.card h2') && /Dubbel in palletlabels/.test(document.body.innerText) && /te kiezen|Geen dubbele/.test(document.body.innerText), null, { timeout:300000 });
  for(const code of ['FTP-106106010', 'chrglck24-kp-Schweiz']){
    const r = await ev(c => { const k = document.querySelector('[data-pd="save"][data-code="' + c + '"]'); if(!k) return { gekozen:[...document.querySelectorAll('details .mono')].some(e => e.textContent === c) }; const kaart = k.closest('.card'); return { inv:kaart.querySelectorAll('input[data-pdk],button[data-pdk]').length, nvt:!!kaart.querySelector('.pd-rij.nvt') }; }, code);
    if(r.gekozen){ check(code + ': staat al in "al gekozen" (door Daan na de vorige versie), niet meer open', true); continue; }
    check(code + ': bewerkbare vloernaam', r.inv > 0 && !r.nvt);
    await ev(c => { const kaart = document.querySelector('[data-pd="save"][data-code="' + c + '"]').closest('.card'); const b = kaart.querySelector('button.pd-pill[data-pdk]'); if(b) b.click(); }, code);
    await P.waitForTimeout(400);
    await ev(c => document.querySelector('[data-pd="save"][data-code="' + c + '"]').click(), code);
    await P.waitForTimeout(1500);
    check(code + ': weg na Klopt, opslaan', await ev(c => !document.querySelector('[data-pd="save"][data-code="' + c + '"]'), code));
  }
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
