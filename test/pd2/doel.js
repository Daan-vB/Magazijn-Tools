// Invullen → toont alleen wat open is (31-10): doel per stap in Productdata 2.0, telling = Te doen, Volgende familie slaat klaar-families over. Echte database alleen lezen; schrijven gaat naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
const num = t => +String(t).replace(/\D/g, '');
(async () => {
  const T = await start(); const P = T.p, B = process.env.PD2_URL || 'http://localhost:8811/';
  const ev = (f, a) => P.evaluate(f, a);
  await P.goto(B + 'ivol.html#/taak/0.4');
  await P.waitForFunction(() => window.PD2R && PD2R.S.klaar && document.querySelectorAll('a.knop[data-taak]').length >= 3 && /velden open/.test(document.body.innerText), null, { timeout:300000 });
  const regels = await ev(() => [...document.querySelectorAll('ul.nog li')].map(li => ({ t:li.innerText, h:(li.querySelector('a.knop') || {}).getAttribute ? li.querySelector('a.knop').getAttribute('href') : '' })).filter(x => /^Belangrijke producten · \d\./.test(x.t)));
  console.log(JSON.stringify(regels).slice(0, 500));
  const STAPPEN = [['soort', 'Soort'], ['gewicht', 'Gewicht'], ['hoev', 'Hoeveelheid']];
  for(const [s, naam] of STAPPEN){
    const r = regels.find(x => x.h === '#/pd2/stap/' + s);
    if(!r){ check('Invullen bij ' + naam + ' wijst naar #/pd2/stap/' + s, false, JSON.stringify(regels.map(x => x.h))); continue; }
    const teDoen = num((r.t.match(/(\d[\d.]*) velden open/) || [])[1]);
    for(const vp of [{ width:1440, height:900 }, { width:390, height:844 }]){
      await P.setViewportSize(vp);
      await P.goto(B + 'ivol.html#/pd2/stap/' + s); await P.reload();
      await P.waitForFunction(() => document.querySelector('#pd2-doel'), null, { timeout:200000 });
      const o = await ev(() => ({ bar:document.querySelector('#pd2-doel b').innerText, rijen:[...document.querySelectorAll('.pd2-famlijst .pd2-fam')].map(b => ({ klaar:b.classList.contains('klaar'), n:(b.querySelector('.n') || {}).innerText || '' })), hs:document.documentElement.scrollWidth > innerWidth + 1 || document.querySelector('.pd2').scrollWidth > innerWidth + 1 }));
      if(vp.width === 1440) check(naam + ': balk "' + o.bar + '" = Te doen-regel (' + teDoen + ')', num(o.bar) === teDoen && o.bar.startsWith(naam), o.bar);
      if(vp.width === 1440) check(naam + ': ' + o.rijen.length + ' families, geen klaar-familie, elk met open producten', o.rijen.length > 0 && o.rijen.every(x => !x.klaar && num(x.n) > 0));
      check(naam + ' (' + vp.width + '): geen horizontale scroll', !o.hs);
    }
    await P.setViewportSize({ width:1440, height:900 });
    // eerste familie: direct de gevraagde stap
    await ev(() => document.querySelector('.pd2-famlijst .pd2-fam').click());
    await P.waitForSelector('.pd2[data-scherm="fam"]', { timeout:60000 });
    const st = await ev(() => { const a = document.querySelector('.pd2-stappen button.aan'); return a ? a.textContent.trim() : ''; });
    check(naam + ': familie opent direct op de gevraagde stap', st.toLowerCase().includes(naam.toLowerCase().slice(0, 4)), st);
    if(s === 'soort'){
      const voor = await ev(() => document.querySelector('#pd2-doel b').innerText);
      const kz = await ev(() => { const b = document.querySelector('article.pd2-kaart button[data-a="soortkies"].vs') || document.querySelector('article.pd2-kaart button[data-a="soortkies"]'); if(!b) return false; b.click(); return true; });
      await P.waitForTimeout(1500);
      const na = await ev(() => document.querySelector('#pd2-doel b').innerText);
      check('Soort bevestigen: getal in de balk telt af (' + voor + ' → ' + na + ')', kz && num(na) < num(voor));
      const volg = await ev(() => { const fk0 = document.querySelector('#pd2-fkop b, #pd2-fkop h2') ? document.querySelector('#pd2-fkop').innerText.slice(0, 40) : ''; const b = document.querySelector('[data-a="volgfam"]'); if(b) b.click(); return fk0; });
      await P.waitForTimeout(1000);
      const nu = await ev(() => document.querySelector('#pd2-fkop') ? document.querySelector('#pd2-fkop').innerText.slice(0, 40) : 'lijst');
      check('Volgende familie gaat door de doellijst', nu !== volg || nu === 'lijst', volg + ' → ' + nu);
    }
  }
  // menu Productdata 2.0 toont weer alles
  await P.goto(B + 'ivol.html#/pd2');
  await P.waitForTimeout(3000);
  const alles = await ev(() => ({ doel:!!document.querySelector('#pd2-doel'), rijen:document.querySelectorAll('.pd2-famlijst .pd2-fam').length, klaar:document.querySelectorAll('.pd2-famlijst .pd2-fam.klaar').length }));
  check('Menu Productdata 2.0 toont alles (geen doel, ook klaar-families)', !alles.doel && alles.rijen > 0, JSON.stringify(alles));
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|locaties/.test(e)).slice(0, 4).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
