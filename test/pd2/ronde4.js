// Ronde 4: familiescherm zonder maatstap (inhoudsopgave), picklocatie als tekst + keuze op het voorstel, max op pick bij Deel,
// uitlopend ook als het nog verkoopt, oefenantwoorden tellen niet mee
const { start, open } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p; await open(T);
  const ev = (f, a) => P.evaluate(f, a);
  // 1 elke maat 1 product: geen maatstap, kaarten op maat, maten = inhoudsopgave
  await ev(() => WHPD2.openFam('SMIT Visual B.V.|whiteboard magnetisch')); await P.waitForTimeout(300);
  const wm = await ev(() => ({ toc:!!document.querySelector('.pd2-maten.toc'), kaarten:[...document.querySelectorAll('article.pd2-kaart')].map(k => k.dataset.c), maten:WHPD2.maatgroepen().map(m => m.cs[0]), volgmaat:!!document.querySelector('[data-a="volgmaat"]') }));
  check('Whiteboard Magnetisch: geen maatstap, alle producten als kaarten op maat', wm.toc && wm.kaarten.join() === wm.maten.filter(c => wm.kaarten.includes(c)).join() && wm.kaarten.length >= 10 && !wm.volgmaat, wm.kaarten.length + ' kaarten');
  const doel = wm.maten[Math.floor(wm.maten.length / 2)];
  await P.click(`.pd2-maten [data-a="naar"][data-c="${doel}"]`); await P.waitForTimeout(300);
  const top = await ev(c => { const r = document.querySelector(`article.pd2-kaart[data-c="${c}"]`).getBoundingClientRect(); return Math.round(r.top); }, doel);
  check('Inhoudsopgave: tik op een maat = scroll naar die kaart', top >= 0 && top < 120, 'top ' + top);
  await ev(() => WHPD2.openFam('Hamat|schoonloopmat mars')); await P.waitForTimeout(300);
  check('Mars (5 kleuren per maat): wel maatstap', await ev(() => !document.querySelector('.pd2-maten.toc') && document.querySelectorAll('.pd2-maat').length === 8));
  // 2 picklocatie: tekst + keuze, standaard op het voorstel (zonder op te slaan)
  const pk = await ev(() => WHPD2.kaartCodes().find(c => PD2R.info(c).f.pick.length && PD2R.waarde(c, 'pickc').st === 'voorstel'));
  const pi = await ev(c => { const f = document.querySelector(`article.pd2-kaart[data-c="${c}"] [data-kc="pickc"]`); return { tekst:f.querySelector('.pd2-pick .m').textContent, keuze:f.querySelector('select').value, vs:PD2R.waarde(c, 'pickc').v, opgeslagen:!!PD2R.eigen(c, 'pickc') }; }, pk);
  check('Picklocatie: "AD01B04 · 12 · vast" als tekst, keuze staat op het voorstel, niets opgeslagen', /^[A-Z]{2}\d{2}[A-Z]\d{2} · \d+ · (vast|tijdelijk)/.test(pi.tekst) && pi.keuze === pi.vs && !pi.opgeslagen, JSON.stringify(pi));
  check('Kaart: voorstel als één korte regel met Klopt, reden alleen bij hover/ⓘ (geen blauwe blokken)', await ev(c => { const k = document.querySelector(`article.pd2-kaart[data-c="${c}"]`); return !k.querySelector('.pd2-vs') && k.querySelectorAll('.pd2-vr [data-a="klopt"]').length > 2 && [...k.querySelectorAll('.pd2-f:not(.vnveld) .pd2-vr')].every(x => x.getBoundingClientRect().height <= 32 && x.title); }, pk));
  // 3 max op pick bij Deel: nooit bij + stuks per pallet; alleen Picqer, aanvulling naar pick of kleurgenoot
  const mx = await ev(() => { const t = {}; let fout = 0, n = 0; Object.keys(WH.D.P).filter(c => PD2R.actief(c) && !PD2R.isKoppel(c) && !PD2R.isSam(c) && PD2R.soortWaarde(c).v === 'deel').slice(0, 800).forEach(c => { const I = PD2R.info(c), v = I.vs.maxpick; n++; const r = v ? (v.r || (v.mis ? 'leeg' : '?')) : 'leeg'; t[r] = (t[r] || 0) + 1; if(v && v.v && !/^max:(picqer|mvpick|genoot)$/.test(v.r)) fout++; }); return { n, t, fout }; });
  check('Max op pick bij Deel alleen uit Picqer, aanvulling naar pick of kleurgenoot (anders leeg)', mx.fout === 0 && mx.n > 50, JSON.stringify(mx));
  // 5a uitlopend ook als het nog verkoopt
  const ul = await ev(() => { const l = Object.keys(WH.D.P).filter(c => { const w = PD2R.wegLicht(c); return w && w.v === 'uitlopend'; }); return { n:l.length, verkoopt:l.filter(c => PD2R.vk6(c) > 0 || (PD2R.vk28(c) || 0) > 0).length, metInkoop:l.filter(c => PD2R.inkoop(c)).length }; });
  check('Uitlopend: nog voorraad en geen inkoop in 12 maanden, ook als het verkoopt', ul.n > 0 && ul.verkoopt > 0 && ul.metInkoop === 0, JSON.stringify(ul));
  // 5b oefenantwoorden tellen niet mee
  const oe = await ev(() => {
    const m = WHPD2.maatgroepen('Hamat|schoonloopmat mars').find(x => x.cs.length >= 3), [a, b] = m.cs;
    PD2R.S.oefenen = true; PD2R.poZet(a, p => { p.f.spp = { v:'777', st:'aangepast', voor:'' }; }); PD2R.S.oefenen = false;
    const tijdensOef = PD2R.po(a).f.spp.oef === 1, genootOef = (PD2R.info(b).vs.spp || {}).v !== '777', telOef = !(PD2R.telling().spp || { aangepast:0 }).aangepast;
    PD2R.poZet(a, p => { p.f.spp = { v:'777', st:'aangepast', voor:'' }; });
    const echt = !PD2R.po(a).f.spp.oef, genootEcht = (PD2R.info(b).vs.spp || {}).v === '777' || !!PD2R.eigen(b, 'spp'), telEcht = (PD2R.telling().spp || {}).aangepast === 1;
    PD2R.poHerstel(a, null);
    return { tijdensOef, genootOef, telOef, echt, genootEcht, telEcht };
  });
  check('Oefenantwoord (kaartje aan) krijgt oefen-merk en telt niet mee voor kleurgenoot en telling', oe.tijdensOef && oe.genootOef && oe.telOef, JSON.stringify(oe));
  check('Zelfde invoer met oefenen uit telt wel mee', oe.echt && oe.genootEcht && oe.telEcht);
  await ev(() => PD2R.flush()); await P.waitForTimeout(800);
  check('Alleen geschreven naar wh-pd2-* en productdata (bron pd2)', T.blocked.length === 0 && T.writes.every(k => /^(wh-pd2-(oefen|feedback|kopie-.+)|productdata)$/.test(k)), 'writes ' + T.writes.length + ' geblokkeerd ' + T.blocked.length);
  console.log('ERRORS', T.errors.join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
