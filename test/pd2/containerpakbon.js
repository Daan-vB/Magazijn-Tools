// Pakbonnen controleren: aantal-controle bij het inlezen (gele melding "aantal nakijken") en de herstelde regels in de echte database (alleen lezen).
const { start } = require('./opzet.js');
const RXs = '/sub\\s*total|\\btotal\\b|\\btotaal\\b|say\\s+total|extra\\s+cost|freight|insurance|\\bcharge\\b|discount/i';
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 220) : '')); };
(async () => {
  const T = await start({}), P = T.p;
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html#/');
  await P.waitForSelector('.ccard', { timeout:200000 });
  const r = await P.evaluate((RXs) => {
    const RX = eval(RXs);
    const X = CP_TEST, rg = (code, oms, a, per, t) => ({ pakbon_code:code, productcode:code, omschrijving:oms, aantal:a, per, totaal:t, soort:'pallet', factor:1 });
    const norm = [rg('A1', 'a', 2, 50, 100), rg('A2', 'b', 3, 20, 60), rg('A3', 'c', 4, 10, 40), rg('A4', 'd', 5, 10, 50)];
    const kwaad = rg('7295163', '730042 black', 730042, 17, 12410714);
    const uit = X.aantalNakijken(norm.concat([kwaad]));
    const fake = { id:-1, status:'concept', data:{ regels:norm.concat([kwaad]) }, losdatum:'2099-01-01' };
    X.ensureData(fake);
    const pts = X.punten(fake, X.pools(fake)).filter(p => p.type === 'aantal');
    const ean = X.aantalNakijken([rg('28300501', '5601570700625 desk', 5601570700625, 20, 1)]);
    const schoon = X.aantalNakijken(norm);
    const hy = X.aantalNakijken([rg('IVB', '2026-002539 IVB120150BL/43011-1 mat', 1, 200, 200)]);
    const tot = X.aantalNakijken(norm.concat([{ pakbon_code:'Sub Total:', productcode:'', omschrijving:'', aantal:1090, per:47258, totaal:51511917, soort:'pallet', factor:1 }]));
    const co = X.cont();
    // Daan 23-11: geen vaste container of vaste aantallen; regels die voor elke container gelden
    const ctl = co.map(c => { let k = null; try{ k = X.pakbonControle(c); }catch(e){} return { id:c.id, af:c.status === 'afgerond', k }; }).filter(x => x.k && x.k.heeft);
    return { nKwaad:uit.size, geel:pts.length, lvl:pts[0] && pts[0].lvl, tekst:pts[0] && pts[0].tekst, ean:ean.size, schoon:schoon.size, hy:hy.size, tot:tot.size,
      groot:co.flatMap(c => (c.data.regels || []).filter(x => (x.aantal || 0) > 5000).map(x => c.id + ':' + x.pakbon_code)),
      geen:co.flatMap(c => (c.data.regels || []).filter(x => RX.test(x.pakbon_code + ' ' + x.omschrijving) || (x.aantal || 0) < 0).map(x => c.id + ':' + x.pakbon_code)),
      perPallet:co.flatMap(c => (c.data.regels || []).filter(x => x.soort === 'pallet' && (+x.per || 0) > 0 && (+x.aantal || 0) > 0 && Math.abs((+x.aantal) * (+x.per) - (+x.totaal || 0)) > 0.5).map(x => c.id + ':' + x.pakbon_code + ' ' + x.aantal + '×' + x.per + '≠' + x.totaal)),
      ctlN:ctl.filter(x => !x.af).length, ctlRood:ctl.filter(x => !x.af && !x.k.ok && !x.k.akkoord).map(x => x.id + ': ' + x.k.tekst), ctlAf:ctl.filter(x => x.af && !x.k.ok && !x.k.akkoord).map(x => x.id + ': ' + x.k.tekst),
      zonderDatum:co.filter(c => !c.losdatum && ['afgerond', 'ingepland'].includes(c.status)).map(c => c.id + ':' + c.status) };
  }, RXs);
  check('regel "730042 black" geeft melding aantal nakijken', r.nKwaad === 1 && r.geel === 1, JSON.stringify(r));
  check('melding is geel/info, geen fout', r.lvl === 'info', r.lvl);
  console.log('   tekst:', r.tekst);
  check('EAN in omschrijving als aantal geeft melding', r.ean === 1);
  check('normale regels, hyphen-nummers en totaalregels geven geen melding', r.schoon === 0 && r.hy === 0 && r.tot === 0, [r.schoon, r.hy, r.tot]);
  check('palletregels: aantal × per pallet = totaal (alle containers)', r.perPallet.length === 0, r.perPallet.slice(0, 5).join(', '));
  check('geen regel > 5000 dozen in welke container ook', r.groot.length === 0, r.groot);
  // open containers: de pakbon moet sluiten (of geaccepteerd zijn); afgeronde containers zijn geschiedenis: alleen ter info
  check('sluitende pakboncontrole: elke open container met een pakbontotaal klopt of is geaccepteerd (' + r.ctlN + ')', r.ctlRood.length === 0, r.ctlRood.slice(0, 4).join(' · '));
  if(r.ctlAf.length) console.log('   ter info, afgerond:', r.ctlAf.join(' · '));
  check('geen afgeronde of ingeplande container zonder losdatum (zonder ETA = concept)', r.zonderDatum.length === 0, r.zonderDatum.join(', '));
  check('geen enkele totaalregel/negatieve regel meer', r.geen.length === 0, r.geen);
  check('0 geblokkeerde schrijfpogingen', T.blocked.filter(x => !/^FUNC/.test(x)).length === 0, T.blocked.join(' | '));
  console.log(fout.length ? 'FOUTEN: ' + fout.join('; ') : 'ALLES OK (' + ok.length + ')');
  await T.b.close(); process.exit(fout.length ? 1 : 0);
})();
