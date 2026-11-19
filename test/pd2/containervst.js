// VST neemt ALLEEN volle pallets (Daan 19-11): los (rollen, dozen, stuks) gaat nooit naar VST; handmatig VST bij los = gele melding, geen blokkade. Zelfgemaakte voorbeeldregels, geen bedrijfsdata.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 260) : '')); };
(async () => {
  const T = await start({ vp:{ width:+(process.env.VP || 1440), height:900 } }), P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html#/');
  await P.waitForSelector('.ccard', { timeout:200000 });
  const r = await P.evaluate(() => {
    const X = CP_TEST;
    const bouw = (regels, geh, echt) => {
      const code = echt || 'ZZ-VST-' + Math.random().toString(36).slice(2, 7);
      if(geh) X.zetGeheugen(code, geh);
      const c = { id:-8, status:'concept', losdatum:'2099-01-01', data:{ regels:regels.map((g, i) => Object.assign({ id:'v' + i, pakbon_code:code, productcode:code, omschrijving:'t', factor:1 }, g)), verdeling:{}, instellingen:{ maanden:1.5 } } };
      X.ensureData(c);
      return { c, code, pool:X.pools(c).map[code] };
    };
    const adv = b => X.adviesKern(b.c, b.pool, X.leegEerder());
    const dest = a => a.porties.map(x => x.soort + ':' + x.n + (x.soort === 'pallet' ? '×' + x.per : '') + '→' + x.dest).join(' ');
    const uit = {};
    // 1. alleen los, geen regel, geen max op pick → alles Bulk + bij lossen bepalen
    const a1 = adv(bouw([{ totaal:20, per:1, aantal:20, soort:'los' }], null, 'RP0100'));   // echt product met verkoop (live data), alleen in het geheugen
    uit.zonderMax = { d:dest(a1), u:a1.uitleg, note:(a1.porties[0] || {}).note };
    // 2. los met max op pick (regel): eerst pick, rest bulk, nooit VST
    const a2 = adv(bouw([{ totaal:15, per:1, aantal:15, soort:'los' }], { pickmax:'3' }));
    uit.metMax = { d:dest(a2), u:a2.uitleg };
    // 3. oude regel / productgeheugen met restdest VST of losdest VST → los toch niet naar VST
    const a3 = adv(bouw([{ totaal:15, per:1, aantal:15, soort:'los' }], { pickmax:'3', restdest:'VST' }));
    const a4 = adv(bouw([{ totaal:9, per:1, aantal:9, soort:'los' }], { losdest:'VST' }));
    uit.restdestVst = dest(a3); uit.losdestVst = dest(a4);
    // 4. pallets mogen wel naar VST (meer pallets dan hier nodig)
    const b5 = bouw([{ totaal:900, per:150, aantal:6, soort:'pallet' }], { qty:'150' });
    const a5 = adv(b5);
    uit.pallets = dest(a5);
    // 5. pallets + los samen: pallets VST toegestaan, los nooit
    const b6 = bouw([{ totaal:450, per:150, aantal:3, soort:'pallet' }, { totaal:5, per:1, aantal:5, soort:'los' }], { qty:'150' });
    const a6 = adv(b6);
    uit.mix = dest(a6);
    // 6. alle bronnen: nooit een los-portie met VST
    uit.nooitLosVst = [a1, a2, a3, a4, a5, a6].every(a => a.porties.every(x => !(x.soort !== 'pallet' && x.dest === 'VST')));
    // 7. handmatig VST bij los: gele melding in de statusbalk, geen blokkade (verdeling blijft staan)
    const b7 = bouw([{ totaal:20, per:1, aantal:20, soort:'los' }]);
    b7.c.data.verdeling[b7.code] = { porties:[{ soort:'los', n:20, dest:'VST' }], bevestigd:false, bron:'handmatig' };
    const balk = X.statusBalkTest(b7.c);
    uit.melding = /VST neemt alleen pallets/.test(balk);
    uit.blokkade = X.pools(b7.c).map[b7.code] && b7.c.data.verdeling[b7.code].porties.length === 1;
    return uit;
  });
  console.log(JSON.stringify(r));
  check('Los zonder max op pick → alles naar Bulk (up) met "bij lossen bepalen", nooit VST', /^los:20→UP$/.test(r.zonderMax.d) && r.zonderMax.note === 'bij lossen bepalen' && /bij lossen bepalen/.test(r.zonderMax.u), r.zonderMax.d + ' | ' + r.zonderMax.u);
  check('Los met max op pick 3 → 3 naar pick, rest naar Bulk (up)', /los:3→PICK/.test(r.metMax.d) && /los:12→UP/.test(r.metMax.d) && !/VST/.test(r.metMax.d), r.metMax.d);
  check('Oude regel restdest VST / losdest VST → los toch naar Bulk (up), nooit VST', !/VST/.test(r.restdestVst) && !/VST/.test(r.losdestVst) && /UP/.test(r.restdestVst) && /los:9→UP/.test(r.losdestVst), r.restdestVst + ' | ' + r.losdestVst);
  check('Pallet-regel: VST toegestaan', /pallet:\d+×150→VST/.test(r.pallets), r.pallets);
  check('Pallets + los samen: los nooit VST, pallets wel toegestaan', /los:5→/.test(r.mix) && !/los:\d+→VST/.test(r.mix), r.mix);
  check('Geen enkel advies zet een los-portie op VST', r.nooitLosVst === true);
  check('Handmatig VST bij los: gele melding "VST neemt alleen pallets", geen blokkade', r.melding === true && r.blokkade === true);
  check('0 geblokkeerde schrijfpogingen', T.blocked.filter(x => !/^FUNC/.test(x)).length === 0, T.blocked.join(' | '));
  console.log(fout.length ? 'FOUTEN: ' + fout.join('; ') : 'ALLES OK (' + ok.length + ')');
  await T.b.close(); process.exit(fout.length ? 1 : 0);
})();
