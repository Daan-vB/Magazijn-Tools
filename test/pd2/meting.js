// meting: hoe vaak klopt het pd2-voorstel bij Daans eigen invoer in productdata (alleen percentages)
const { start, open } = require('./opzet.js');
(async () => {
  const T = await start(); await open(T);
  const t0 = Date.now();
  const r = await T.p.evaluate(async () => ({ m:await PD2R.meet() }));
  console.log('meting', Date.now() - t0, 'ms, items', r.m.n);
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
  Object.entries(r.m.velden).forEach(([k, v]) => console.log(k.padEnd(9), 'tot', v.tot, 'voorstel', pct(v.met, v.tot), 'goed', pct(v.goed, v.tot), 'precisie', pct(v.goed, v.met)));
  Object.entries(r.m.regels).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => console.log('  ', k.padEnd(22), v.tot, pct(v.goed, v.tot)));
  require('fs').writeFileSync((process.env.UIT_MAP || '.') + '/meting.json', JSON.stringify(r.m, null, 1));   // alleen aantallen, geen productcodes
  console.log(T.errors.join('\n'));
  await T.b.close();
})();
