// Te doen / Poort 0.4 tellen als Productdata 2.0; Dubbel in palletlabels altijd bewerkbaar. Echte database alleen lezen; schrijven gaat naar een kopie in het geheugen.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p, B = process.env.PD2_URL || 'http://localhost:8811/';
  const ev = (f, a) => P.evaluate(f, a);
  await P.goto(B + 'ivol.html#/taak/0.4');
  await P.waitForFunction(() => window.WHPD && WHPD.S.klaar && window.PD2R && PD2R.S.klaar && /producten open/.test(document.body.innerText), null, { timeout:300000 });
  const t = await ev(() => {
    const bel = WHPD.poort().bel, n2 = bel.filter(c => { const s = PD2R.status(c); return !s.kop && s.open.length; }).length;
    const veld = bel.reduce((a, c) => a + (PD2R.status(c).kop ? 0 : PD2R.status(c).open.length), 0);
    const kgst = bel.filter(c => WHPD.openStappen(c).some(k => k === 'kgst' || k === 'maxlig')).length;
    const bw = bel.filter(c => ['bulk', 'weg'].includes(PD2R.status(c).so) && WHPD.openStappen(c).some(k => ['maxpick', 'lvl', 'pick', 'met'].includes(k))).length;
    const oud = bel.filter(c => [1, 2, 3].some(l => WHPD.open(c, l).length)).length;
    const oudK = bel.filter(c => [1, 2, 3].some(l => WHPD.open(c, l).some(k => k === 'kgst' || k === 'maxlig'))).length;
    const oudBW = bel.filter(c => ['bulk', 'weg'].includes(PD2R.status(c).so) && [1, 2, 3].some(l => WHPD.open(c, l).some(k => ['maxpick', 'lvl', 'pick', 'met'].includes(k)))).length;
    return { n2, veld, kgst, bw, oud, oudK, oudBW, tekst:document.body.innerText.match(/(\d[\d.]*) producten open/g), poort:WHPD.poort().items.slice(3, 6).map(x => x.t + ' | ' + x.u) };
  });
  console.log(JSON.stringify(t));
  const getal = +String((t.tekst || [''])[0]).replace(/\D/g, '');
  check('Te doen toont het aantal producten met een open stap in Productdata 2.0 (niet 334)', getal === t.n2 && getal !== 334, 'scherm ' + getal + ' · 2.0 ' + t.n2);
  check('Poort: velden open komt uit 2.0', t.poort.length === 3 && t.poort.every(x => /Productdata 2\.0/.test(x)), t.poort.join(' // '));
  check('kgst en maxlig tellen niet; Bulk en Weg niet op max op pick, aanvullen bij, picklocatie', t.kgst === 0 && t.bw === 0 && t.oudK === 0 && t.oudBW === 0);
  await P.goto(B + 'ivol.html#/productdata/dubbel');
  const fr = async () => { await P.waitForSelector('#frame:not([hidden])', { timeout:240000 }).catch(() => {}); return P.frames().find(f => /productdata|test/.test(f.url()) && f !== P.mainFrame()) || P.mainFrame(); };
  await P.goto(B + 'warehouse.html#/productdata/dubbel');
  await P.waitForFunction(() => window.WHPD && WHPD.S.klaar && document.querySelector('[data-pd="save"][data-ks]'), null, { timeout:300000 });
  for(const code of ['FTP-106106010', 'chrglck24-kp-Schweiz']){
    const r = await ev(c => { const k = document.querySelector('[data-pd="save"][data-code="' + c + '"]'); if(!k) return null; const kaart = k.closest('.card'); return { inv:[...kaart.querySelectorAll('input[data-pdk],button[data-pdk]')].map(e => e.dataset.pdk), nvt:!!kaart.querySelector('.pd-rij.nvt') }; }, code);
    check(code + ': bewerkbaar veld, niet n.v.t.', r && r.inv.length > 0 && !r.nvt, JSON.stringify(r));
  }
  for(const code of ['FTP-106106010', 'chrglck24-kp-Schweiz']){
    await ev(c => { const kaart = document.querySelector('[data-pd="save"][data-code="' + c + '"]').closest('.card'); const knop = kaart.querySelector('button.pd-pill[data-pdk]') ; if(knop) knop.click(); }, code);
    await P.waitForTimeout(400);
    await ev(c => document.querySelector('[data-pd="save"][data-code="' + c + '"]').click(), code);
    await P.waitForTimeout(1500);
    const weg = await ev(c => !document.querySelector('[data-pd="save"][data-code="' + c + '"]'), code);
    check(code + ': weg uit de lijst na Klopt, opslaan', weg);
  }
  await P.goto(B + 'warehouse.html#/productdata/p/FTP-106106010');
  await P.waitForTimeout(3000);
  check('oude kaart werkt nog', await ev(() => /FTP-106106010/.test(document.body.innerText) && !!document.querySelector('.pd-rij')));
  check('0 geblokkeerde schrijfpogingen', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 2)));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
