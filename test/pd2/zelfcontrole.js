// zelfcontrole: alle producten in de Belangrijk-families: per veld geel / twijfel / uitzoeken, per bron hoeveel producten
const { start, open } = require('./opzet.js');
(async () => {
  const T = await start(); await open(T);
  const r = await T.p.evaluate(() => {
    const fams = new Set(WHPD2.families().map(f => f.fk));
    const cs = Object.keys(WH.D.P).filter(c => PD2R.actief(c) && !PD2R.isKoppel(c) && fams.has(PD2R.famVan(c)));
    const velden = ['spp', 'maat', 'hoogte', 'lvl', 'maxpick', 'vn'], st = {}, bron = {}, calc = { gewpal:{}, maxcalc:{} };
    cs.forEach(c => { const I = PD2R.info(c), so = PD2R.soortWaarde(c, I).v; if(so === 'weg') return;
      velden.forEach(k => { const w = PD2R.waarde(c, k, I); const t = st[k] = st[k] || {}; t[w.st] = (t[w.st] || 0) + 1; if(['voorstel', 'twijfel', 'uitzoeken'].includes(w.st) && w.r){ const b = bron[k] = bron[k] || {}; const id = w.r.split(':')[1]; b[id] = (b[id] || 0) + 1; } });
      ['gewpal', 'maxcalc'].forEach(k => { const x = PD2R.calc(c, k, I); const t = calc[k]; const s2 = !x.v ? 'leeg' : x.uitzoeken ? 'uitzoeken' : x.oranje ? 'controleer' : 'ok'; t[s2] = (t[s2] || 0) + 1; }); });
    return { n:cs.length, fams:fams.size, st, bron, calc };
  });
  console.log(JSON.stringify(r, null, 1));
  require('fs').writeFileSync((process.env.UIT_MAP || '.') + '/zelfcontrole.json', JSON.stringify(r, null, 1));
  await T.b.close();
})();
