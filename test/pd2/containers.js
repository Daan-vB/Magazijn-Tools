// Week 1 · D: Containers leest productdata. Een pakbonregel "los, per 1" van een product dat in productdata Pallet of Deel is met
// stuks per pallet krijgt het voorstel "pallets, per <stuks per pallet>". Nooit automatisch; een bevestigde regel nooit.
// Alleen lezen: de echte database wordt gelezen, schrijven wordt onderschept (moet 0 zijn).
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html#/');
  await P.waitForFunction(() => window.CPTEST && CPTEST.CONT().length, null, { timeout:90000 });
  await P.evaluate(() => CPTEST.laadPdVoorstel());
  const r = await P.evaluate(() => {
    const open = CPTEST.CONT().filter(c => c.status !== 'afgerond'), regels = open.flatMap(c => (c.data.regels || []).map(r => ({ c, r })));
    const fwb = regels.find(x => /^FWB/i.test(x.r.productcode || '') && CPTEST.PDS()[x.r.productcode]);
    if(!fwb) return { geen:true, open:open.length };
    const los = Object.assign({}, fwb.r, { soort:'los', per:1, aantal:fwb.r.totaal, factor:1 }); delete los.soortOk;
    const bevestigd = Object.assign({}, los, { soortOk:true }), alPallet = Object.assign({}, fwb.r, { soort:'pallet' });
    const n = regels.filter(x => CPTEST.pdVoorstel(x.r)).length;
    return { open:open.length, code:fwb.r.productcode, cont:fwb.c.containernummer || fwb.c.pakbon_ref, pd:CPTEST.PDS()[fwb.r.productcode], vs:CPTEST.pdVoorstel(los), bevestigd:CPTEST.pdVoorstel(bevestigd), alPallet:CPTEST.pdVoorstel(alPallet), nu:n, onveranderd:fwb.r.soort };
  });
  check('Productdata wordt gelezen voor de open containers', r.open > 0 && !r.geen && r.pd && r.pd.spp > 0, JSON.stringify({ open:r.open, code:r.code, pd:r.pd }));
  check('FWB-regel "los, per 1" krijgt het voorstel "pallets, per 50"', r.vs && r.vs.per === 50 && /productdata: (Pallet|Deel), 50 per pallet/.test(r.vs.why), JSON.stringify(r.vs));
  check('Een al bevestigde regel krijgt geen voorstel (nooit stil wijzigen)', r.bevestigd === null);
  check('Een regel die al op pallets staat krijgt geen voorstel', r.alPallet === null);
  check('Niets automatisch toegepast: de echte regel is onveranderd', r.onveranderd === 'pallet' || r.onveranderd === 'los', 'nu ' + r.nu + ' regels met voorstel op open containers');
  check('Containers: niets geschreven tijdens lezen', T.blocked.length === 0, T.blocked.slice(0, 3).join(' | '));
  console.log('ERRORS', T.errors.filter(e => !/cdnjs|ERR_|Failed to load resource/.test(e)).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
