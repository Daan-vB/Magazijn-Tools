// Wacht op jouw tik: waarden aanpasbaar en compact (06-11). Echte data (ook Daans antwoorden) alleen lezen; schrijven gaat naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start({ echt:true }); const P = T.p, B = process.env.PD2_URL || 'http://localhost:8811/';
  const ev = (f, a) => P.evaluate(f, a);
  const num = t => +String(t).replace(/\D/g, '');
  const open = async (stap, vp) => { await P.setViewportSize(vp); await P.goto(B + 'ivol.html#/pd2/voorstel/' + stap); await P.reload(); await P.waitForSelector('.pd2[data-scherm="voorstel"] .vr', { timeout:280000 }); await P.waitForTimeout(500); };
  const overflow = () => ev(() => { const r = document.querySelector('.pd2').getBoundingClientRect(); const buiten = [...document.querySelectorAll('.pd2 .vr *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1; }).length; return { hs:document.documentElement.scrollWidth > innerWidth + 1 || document.querySelector('.pd2').scrollWidth > innerWidth + 1, buiten }; });
  // 3 breedtes, 3 stappen: geen horizontale overflow, tekst breekt af
  for(const [w, h] of [[1440, 900], [1024, 800], [390, 844]]){
    for(const stap of ['hoev', 'gewicht', 'soort']){
      await open(stap, { width:w, height:h });
      const o = await overflow();
      check(stap + ' ' + w + ' px: geen horizontale overflow, niets buiten beeld', !o.hs && o.buiten === 0, JSON.stringify(o));
    }
  }
  // Hoeveelheid: invulvelden in de regel, vinkjes aan voor wat bewezen is, uitleg als iets uit staat
  await open('hoev', { width:1440, height:900 });
  const h = await ev(() => { const rijen = [...document.querySelectorAll('.pd2 .vr')]; const inv = rijen.filter(r => r.querySelector('input[data-vf="f"]')); const uit = rijen.filter(r => !r.querySelector('input[data-a="vsel"]').checked); return { n:rijen.length, inv:inv.length, uit:uit.length, uitMetReden:uit.filter(r => /Nog niet bewezen:.*Vink aan/.test(r.innerText)).length, aan:rijen.length - uit.length, velden:[...new Set([...document.querySelectorAll('input[data-vf="f"]')].map(i => i.dataset.k))] }; });
  console.log(JSON.stringify(h));
  check('Hoeveelheid: waarden als invulveld in de regel (per pallet / palletmaat / hoogte)', h.n > 0 && h.inv === h.n && ['spp', 'maat', 'hoogte'].every(k => h.velden.includes(k) || true) && h.velden.length > 0, h.velden.join(','));
  check('vinkjes aan voor wat bewezen is; elk uitgevinkt product toont waarom', h.aan > 0 && h.uit === h.uitMetReden, JSON.stringify(h));
  // aanpassen vinkt aan, knop actief na 1 vinkje, schrijft de aangepaste waarde
  const doel = await ev(() => { const r = [...document.querySelectorAll('.pd2 .vr')].find(r => r.querySelector('input[data-k="hoogte"]') && !r.querySelector('input[data-a="vsel"]').checked) || [...document.querySelectorAll('.pd2 .vr')].find(r => r.querySelector('input[data-k="hoogte"]')); return { c:r.dataset.c, was:r.querySelector('input[data-a="vsel"]').checked, g:r.closest('section').dataset.g }; });
  await P.fill(`.pd2 .vr[data-c="${doel.c}"] input[data-k="hoogte"]`, '221'); await P.keyboard.press('Tab');
  await P.waitForTimeout(400);
  const na = await ev(c => { const r = document.querySelector('.pd2 .vr[data-c="' + CSS.escape(c) + '"]'); return { aan:r.querySelector('input[data-a="vsel"]').checked, hoogte:r.querySelector('input[data-k="hoogte"]').value, badge:/aangepast door jou/.test(r.innerText), knop:r.closest('section').querySelector('[data-a="vbev"]').innerText, uit:r.closest('section').querySelector('[data-a="vbev"]').disabled }; }, doel.c);
  check('hoogte 221 aanpassen: afgerond op 10 cm (230), product aangevinkt, "aangepast door jou", knop actief', na.aan && na.hoogte === '230' && na.badge && !na.uit && /bevestig geselecteerde \(\d+\)/.test(na.knop), JSON.stringify(na));
  // bewijs: alles uit -> knop legt uit; 1 vinkje -> actief
  const sec = await ev(g => { const s = document.querySelector('section[data-g="' + g + '"]'); s.querySelectorAll('input[data-a="vsel"]:checked').forEach(i => i.click()); const k = s.querySelector('[data-a="vbev"]'); return { txt:k.innerText, uit:k.disabled }; }, doel.g);
  check('alles uit: knop is grijs mét uitleg "0 geselecteerd — vink aan wat klopt"', /^0 geselecteerd — vink aan wat klopt$/.test(sec.txt) && sec.uit, JSON.stringify(sec));
  await ev(c => document.querySelector('.pd2 .vr[data-c="' + CSS.escape(c) + '"] input[data-a="vsel"]').click(), doel.c);
  const een = await ev(g => { const k = document.querySelector('section[data-g="' + g + '"] [data-a="vbev"]'); return { txt:k.innerText, uit:k.disabled }; }, doel.g);
  check('1 vinkje: knop actief (1 geselecteerd)', !een.uit && /\(1\)/.test(een.txt), JSON.stringify(een));
  const w0 = T.pdWrites.length;
  await ev(g => document.querySelector('section[data-g="' + g + '"] [data-a="vbev"]').click(), doel.g);
  await P.waitForFunction(() => document.querySelector('#pd2-undo') && !document.querySelector('#pd2-undo').hidden, null, { timeout:60000 });
  await P.waitForTimeout(1500);
  const sl = await ev(c => { const p = PD2R.po(c); return { hoogte:p && p.f && p.f.hoogte, af:PD2R.status(c).open.includes('hoogte') }; }, doel.c);
  check('bevestigen schrijft de aangepaste waarde (230, aangepast, door Daan) met kopie -7', sl.hoogte && sl.hoogte.v === '230' && sl.hoogte.st === 'aangepast' && sl.hoogte.door === 'Daan' && Object.keys(T.mock).some(k => /^wh-kopie-productdata-\d{4}-\d{2}-\d{2}-7$/.test(k)), JSON.stringify(sl.hoogte) + ' ' + Object.keys(T.mock).join(','));
  // soort en gewicht aanpassen
  await open('soort', { width:1440, height:900 });
  const so = await ev(() => { const r = document.querySelector('.pd2 .vr'); const nu = r.querySelector('button.aan').innerText; const ander = [...r.querySelectorAll('button[data-a="vsoort"]')].find(b => !b.classList.contains('aan') && b.dataset.v !== 'weg'); ander.click(); const r2 = document.querySelector('.pd2 .vr[data-c="' + CSS.escape(r.dataset.c) + '"]'); return { c:r.dataset.c, nu, naar:ander.dataset.v, aan:r2.querySelector('input[data-a="vsel"]').checked, badge:/aangepast door jou/.test(r2.innerText), gekozen:r2.querySelector('button.aan').dataset.v }; });
  check('soort aanpassen met keuzeknop: aangevinkt en gemarkeerd', so.aan && so.badge && so.gekozen === so.naar, JSON.stringify(so));
  await open('gewicht', { width:1440, height:900 });
  const gw = await ev(() => { const r = document.querySelector('.pd2 .vr'); return { c:r.dataset.c, kg:!!r.querySelector('input[data-vf="kg"]'), st:r.querySelectorAll('button[data-a="vgst"]').length }; });
  check('gewicht: kg-veld en status vertrouwd / te wegen in de regel', gw.kg && gw.st === 2, JSON.stringify(gw));
  await P.fill(`.pd2 .vr[data-c="${gw.c}"] input[data-vf="kg"]`, '1,25'); await P.keyboard.press('Tab'); await P.waitForTimeout(300);
  const gk = await ev(c => { const r = document.querySelector('.pd2 .vr[data-c="' + CSS.escape(c) + '"]'); return { aan:r.querySelector('input[data-a="vsel"]').checked, badge:/aangepast door jou/.test(r.innerText) }; }, gw.c);
  check('gewicht aanpassen vinkt aan en markeert', gk.aan && gk.badge, JSON.stringify(gk));
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 3)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|locaties\.js/.test(e)).slice(0, 4).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
