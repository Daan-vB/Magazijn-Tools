// ronde 2: overzetten (alleen tegen een kopie), rollen, Weg voor alles, aandacht per familie, weeglijst (print + reachtruck)
const { start, open } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p; await open(T);
  const ev = (f, a) => P.evaluate(f, a);
  // overzetten: knop verborgen, echt uitvoeren weigert
  check('Overzetten: knop verborgen (vlag uit)', !(await P.isVisible('[data-a="overzet"]')) && (await ev(() => PD2R.pd2Overzetten)) === false);
  const echt = await ev(() => PD2R.overzetEcht({}).then(() => 'uitgevoerd', e => e.message));
  check('Overzetten: echt uitvoeren weigert', /staat uit/.test(echt), echt);
  // oefendata maken op producten met en zonder eigen invoer van Daan, dan plan op een kopie
  const r = await ev(() => {
    const rows = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(WHPD.S.pd).map(([c, x]) => [c, { data:x.data, meta:x.meta }]))));
    const daan = Object.keys(rows).filter(c => WH.D.P[c] && rows[c].meta && rows[c].meta.spp && ['daan', 'invul', 'samen', 'familie'].includes(rows[c].meta.spp.bron) && rows[c].data.spp).slice(0, 3);
    const leegC = Object.keys(WH.D.P).filter(c => !rows[c] && !PD2R.isKoppel(c)).slice(0, 3);
    daan.forEach(c => PD2R.poZet(c, p => { p.f.spp = { v:String(+rows[c].data.spp + 1), st:'aangepast', voor:'' }; p.so = { v:'deel', st:'bevestigd', voor:'deel' }; }));
    leegC.forEach(c => PD2R.poZet(c, p => { p.f.lvl = { v:'4', st:'aangepast', voor:'' }; p.gew = { st:'gewogen', kg:1.25 }; p.f.pickc = { v:'klopt', st:'bevestigd', voor:'klopt' }; }));
    const plan = PD2R.overzetPlan(rows);
    const t1 = PD2R.overzetToepassen(rows, plan, {});                       // geen keuzes: Daans invoer blijft
    const daanOk = daan.every(c => t1.rows[c].data.spp === rows[c].data.spp && t1.rows[c].meta.spp.bron === rows[c].meta.spp.bron);
    const kies = plan.filter(x => x.actie === 'kies').length;
    const nieuwOk = leegC.every(c => t1.rows[c] && t1.rows[c].data.lvl === '4' && t1.rows[c].meta.lvl.bron === 'pd2' && t1.rows[c].data.kgst === '1.25' && t1.rows[c].meta.kgst.gew === 1 && t1.rows[c].data.pick === 'ja');
    const k = {}; daan.forEach(c => { k[c + '|spp'] = 'nieuw'; });
    const t2 = PD2R.overzetToepassen(rows, plan, k);                        // gekozen: 2.0 gaat voor
    const keuzeOk = daan.every(c => t2.rows[c].data.spp === String(+rows[c].data.spp + 1) && t2.rows[c].meta.spp.bron === 'pd2');
    const terug = PD2R.overzetTerug(t2.rows, t2.kopie);
    const terugOk = JSON.stringify(Object.keys(rows).sort().map(c => [c, rows[c]])) === JSON.stringify(Object.keys(terug).sort().map(c => [c, terug[c]]));
    const onaangeroerd = Object.keys(rows).filter(c => !daan.includes(c) && !leegC.includes(c)).every(c => JSON.stringify(rows[c]) === JSON.stringify(t2.rows[c]));
    daan.concat(leegC).forEach(c => PD2R.poHerstel(c, null));
    return { daan:daan.length, leeg:leegC.length, plan:plan.length, kies, daanOk, nieuwOk, keuzeOk, terugOk, onaangeroerd };
  });
  check('Overzetten (kopie): eigen invoer van Daan blijft zonder keuze staan', r.daanOk && r.kies >= r.daan, JSON.stringify(r));
  check('Overzetten (kopie): nieuwe waarden met bron pd2 (ook gewicht gewogen, picklocatie)', r.nieuwOk);
  check('Overzetten (kopie): na keuze "neem 2.0" gaat 2.0 voor', r.keuzeOk);
  check('Overzetten (kopie): terugdraaien geeft precies de oude rijen', r.terugOk);
  check('Overzetten (kopie): andere producten onaangeroerd', r.onaangeroerd);
  // rollen
  const rol = await ev(() => { const k = Object.keys(WH.D.P).filter(c => PD2R.actief(c) && PD2R.rolKand(c)); const met = k.filter(c => { const I = PD2R.info(c); return PD2R.ROLNODIG.some(x => I.vs[x] && I.vs[x].v); }); const kok = k.filter(c => /^kokos\b/i.test(PD2R.naamVan(c))); const k2 = kok.find(c => /200/.test(PD2R.naamVan(c)) && /24\s*mm|-24$/i.test(PD2R.naamVan(c) + ' ' + c));
    return { kand:k.length, met:met.length, vol:met.filter(c => { const I = PD2R.info(c); return PD2R.ROLNODIG.filter(x => I.vs[x] && I.vs[x].v).length >= 3; }).length, kokos200:k2 ? ['rl', 'rmax', 'rvast'].map(x => (PD2R.info(k2).vs[x] || {}).v) : null }; });
  check('Rollen: voorstellen voor rolproducten', rol.met > 0, JSON.stringify(rol));
  check('Rollen: kokos 200 cm 24 mm = 6 m, 6 per pallet, vaste aantallen', rol.kokos200 && rol.kokos200.join() === '6,6,ja', JSON.stringify(rol.kokos200));
  // Weg voor alle producten: in een familie onder Weg de link "alle voorstellen Archief"
  await ev(() => { const c = Object.keys(WH.D.P).find(c => /waterhog/i.test(WH.D.P[c].naam || '') && PD2R.actief(c) && WHPD2.segVan(c) === 'weg'); WHPD2.openFam(PD2R.famVan(c), PD2R.maatVan(c)); });
  await P.click('[data-a="seg"][data-v="weg"]'); await P.waitForTimeout(200);
  await P.click('[data-a="wegalle"][data-v="archief"]'); await P.waitForTimeout(400);
  const weg = await ev(() => { const t = {}; Object.keys(WH.D.P).forEach(c => { const w = PD2R.wegLicht(c); if(w) t[w.v] = (t[w.v] || 0) + 1; }); return { t, scherm:document.querySelector('.pd2').dataset.scherm, kaarten:document.querySelectorAll('article.pd2-kaart').length, titel:document.querySelector('#pd2-maat h3').textContent, buiten:WHPD2.blokCodes().filter(c => PD2R.famVan(c) !== WHPD2.UI.fk).length }; });
  check('Weg: "alle voorstellen Archief" toont archief-voorstellen van alle producten', weg.scherm === 'wegalle' && weg.kaarten > 0 && /Archief/.test(weg.titel) && weg.buiten > 0, JSON.stringify(weg));
  // aandacht per familie: hooguit 3 tekstlinks in de kop
  const fam = await ev(() => { WHPD2.UI.view = null; WHPD2.openFam(WHPD2.families()[0].fk); return { links:[...document.querySelectorAll('.pd2-aand [data-a="aandacht"]')].map(x => x.textContent.trim()) }; });
  check('Familie toont hooguit 3 aandachtspunten als tekstlink', fam.links.length > 0 && fam.links.length <= 3, JSON.stringify(fam));
  // weeglijst: palletgewicht via reachtruck en printen
  const wc = await ev(() => { const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isKoppel(c) && WHPD2.segVan(c) === 'pallet' && PD2R.nOf(PD2R.waarde(c, 'spp').v) > 0); PD2R.poZet(c, p => { p.gew = { st:'tewegen' }; p.so = { v:'pallet', st:'bevestigd', voor:'pallet' }; }); WHPD2.UI.view = 'weeg'; WHPD2.teken(); return [c, PD2R.nOf(PD2R.waarde(c, 'spp').v)]; });
  const inp = P.locator(`.pd2-wrij[data-c="${wc[0]}"] [data-a="palletkg"]`);
  check('Weeglijst: veld palletgewicht bij een volle pallet', await inp.count() === 1);
  await inp.fill('515'); await inp.press('Tab'); await P.waitForTimeout(250);
  const g = await ev(c => PD2R.gewicht(c), wc[0]);
  check('Weeglijst: palletgewicht → kg per stuk = (pallet − 15) / stuks per pallet', g.st === 'gewogen' && Math.abs(g.kg - Math.round(500 / wc[1] * 1000) / 1000) < 1e-9 && g.via === 'reachtruck', JSON.stringify(g));
  check('Weeglijst: product blijft zichtbaar met ✓ en de locatie telt mee', await P.isVisible(`.pd2-wrij[data-c="${wc[0]}"].af`));
  await ev(() => { window.print = () => { window.__geprint = document.getElementById('pd2-printvak').innerHTML.length; }; });
  await ev(c => { PD2R.poZet(c, p => { p.gew = { st:'tewegen' }; }); WHPD2.teken(); }, wc[0]);
  await P.click('[data-a="weegprint"]'); await P.waitForTimeout(300);
  const pr = await ev(() => ({ n:window.__geprint || 0, reach:/reachtruck/.test(document.getElementById('pd2-printvak').textContent), vak:document.querySelectorAll('#pd2-printvak td.vak').length }));
  check('Weeglijst printbaar: A4-tabel per hal/gang met vakjes en reachtruck-regel', pr.n > 0 && pr.reach && pr.vak > 0, JSON.stringify(pr));
  await P.emulateMedia({ media:'print' }); await ev(() => document.documentElement.classList.add('pd2-print'));
  await P.screenshot({ path:(process.env.UIT_MAP || '.') + '/weeglijst-print.png', fullPage:true });
  await ev(() => document.documentElement.classList.remove('pd2-print')); await P.emulateMedia({ media:'screen' });
  // scores onder ⓘ en uitklapblok
  await ev(() => { WHPD2.UI.view = null; WHPD2.UI.fk = null; WHPD2.teken(); });
  await P.click('[data-a="oefmenu"]'); await P.click('.pd2-modal [data-a="view"][data-v="scores"]'); await P.waitForTimeout(300);
  const sc = await ev(() => ({ blok:!!document.getElementById('pd2-scores'), tekst:document.getElementById('pd2-scores').textContent.slice(0, 120), rijen:document.querySelectorAll('#pd2-scores .pd2-scorerij').length, tabel:document.querySelectorAll('#pd2-scores table').length }));
  check('"Hoe goed zijn de voorstellen" via Oefenmodus ⋯, als lijst (geen tabel)', sc.blok && /Hoe goed/.test(sc.tekst) && sc.rijen > 5 && sc.tabel === 0, JSON.stringify(sc));
  await ev(() => PD2R.flush()); await P.waitForTimeout(800);
  check('Ronde 2: alleen geschreven naar wh-pd2-oefen en wh-pd2-feedback', T.blocked.length === 0 && T.writes.every(k => /^wh-pd2-(oefen|feedback)$/.test(k)), 'writes ' + T.writes.length + ' geblokkeerd ' + T.blocked.length);
  console.log('ERRORS', T.errors.join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
