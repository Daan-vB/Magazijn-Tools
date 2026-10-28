// Week 1 · A: soort opslaan bij Klopt/Alles klopt, kg vastleggen bij vertrouwd, alle picklocaties volledig, max per ligger uit het
// liggertype, controle na invoer (oranje), "Hoe vul je pick aan?" + Binnenkomst, palletlabel met andere productcode niet gebruikt.
// Schrijven: wh-pd2-* en productdata (bron pd2) gaan naar een kopie in het geheugen, nooit naar de database.
const { start, open } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const T = await start(); const P = T.p; await open(T);
  const ev = (f, a) => P.evaluate(f, a);
  // 4 max per ligger: 100150WM op BB11A10 (4-ligger), palletmaat 100x150 = 2 plaatsen → 2
  const lg = await ev(() => ({ type:PD2R.liggerVan('BB11A10'), plaatsen:PD2R.calc('100150WM', 'plaatsen').v, maxlig:PD2R.calc('100150WM', 'maxlig') }));
  check('100150WM op BB11A10 (4-ligger) geeft max per ligger 2', lg.type === 4 && lg.maxlig.v === '2', JSON.stringify(lg));
  const zonder = await ev(() => { const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.info(c).f.bulk.length && PD2R.calc(c, 'plaatsen').v); return c ? PD2R.calc(c, 'maxlig').v : ''; });
  check('Zonder bulklocatie: "3-ligger x · 4-ligger y"', /^3-ligger \d+ · 4-ligger \d+$/.test(zonder), zonder);
  // 7 palletlabel met de naam van een andere productcode
  const lab = await ev(() => ({ lijst:PD2R.labelsVerbeteren().filter(x => x.c === '100150WM'), alle:(WH.D.GEH['100150wm'] || []).map(g => g.name), gebruikt:PD2R.labelsGoed('100150WM').map(g => g.name) }));
  check('Label van 100150WM met naam "100200WM": niet als voorstel, wel op de lijst om te verbeteren', lab.lijst.length === 1 && lab.lijst[0].ander === '100200WM' && lab.alle.includes('100200WM') && !lab.gebruikt.includes('100200WM'), JSON.stringify(lab));
  await ev(() => { WHPD2.UI.view = 'labels'; WHPD2.teken(); });
  check('Scherm "Palletlabels om te verbeteren" toont het label', await ev(() => /100200WM/.test(document.querySelector('.pd2').textContent)));
  // 1 + 2: Alles klopt slaat ook een vastgelegde soort op; vertrouwd legt de Picqer-kg vast
  const c = await ev(() => { const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isKoppel(c) && !PD2R.isSam(c) && PD2R.soortWaarde(c).st === 'vastgelegd' && PD2R.soortWaarde(c).v !== 'weg' && PD2R.kgPq(c) > 0 && !PD2R.po(c)); WHPD2.UI.view = null; WHPD2.openFam(PD2R.famVan(c), PD2R.maatVan(c)); return c; });
  await P.click(`article.pd2-kaart[data-c="${c}"] [data-a="rijklopt"]`).catch(() => {});
  await P.waitForTimeout(300);
  const so = await ev(c => PD2R.po(c) && PD2R.po(c).so, c);
  check('Alles klopt slaat de soort echt op (ook als die al vastlag)', so && so.v && so.st === 'bevestigd', JSON.stringify(so));
  await P.click(`article.pd2-kaart[data-c="${c}"] [data-a="gewst"][data-v="vertrouwd"]`); await P.waitForTimeout(300);
  const g = await ev(c => ({ gew:PD2R.po(c).gew, pq:PD2R.kgPq(c) }), c);
  check('Gewicht vertrouwd: de Picqer-kg wordt vastgelegd', g.gew.st === 'vertrouwd' && g.gew.kg === g.pq, JSON.stringify(g));
  await ev(() => PD2R.pdFlush()); await P.waitForTimeout(600);
  const rij = T.pdWrites.filter(x => x.productcode === c).pop();
  check('…en gaat direct naar productdata (opslag en kgst, bron pd2) met vooraf een kopie', rij && rij.meta.kgst && rij.meta.kgst.bron === 'pd2' && T.writes.some(k => /^wh-pd2-kopie-/.test(k)), JSON.stringify(rij && { kgst:rij.data.kgst, opslag:rij.data.opslag }));
  // 3 alle picklocaties volledig, 6 label en Binnenkomst
  const pk = await ev(() => { const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isKoppel(c) && PD2R.info(c).f.pick.length >= 2 && ['pallet', 'deel'].includes(PD2R.status(c).so)); WHPD2.openFam(PD2R.famVan(c), PD2R.maatVan(c)); return c; });
  const pi = await ev(c => { const k = document.querySelector(`article.pd2-kaart[data-c="${c}"]`); const locs = [...k.querySelectorAll('[data-kc="pickc"] .locs .m')]; return { n:PD2R.info(c).f.pick.length, getoond:locs.length, afgekapt:locs.some(x => x.scrollWidth > x.clientWidth + 1), label:k.querySelector('.pd2-soort label').textContent, binnen:!!k.querySelector('[data-kc="binnen"] select') }; }, pk);
  check('Alle picklocaties onder elkaar, niet afgekapt', pi.getoond === pi.n && pi.n >= 2 && !pi.afgekapt, JSON.stringify(pi));
  check('"Hoe vul je pick aan?" met Binnenkomst bij Pallet/Deel', pi.label === 'Hoe vul je pick aan?' && pi.binnen);
  // 5 controle na invoer
  const nc = await ev(() => { const c = Object.keys(WH.D.P).find(c => { try{ const b = WHPD.intern.sppBronnen(c) || {}; return b.vst2 && PD2R.actief(c) && !PD2R.isKoppel(c); }catch(e){ return false; } }); const v = String((+WHPD.intern.sppBronnen(c).vst2.v) + 7); PD2R.S.echt = false; PD2R.poZet(c, p => { p.f.spp = { v, st:'aangepast', voor:'' }; }); PD2R.S.echt = true; const t = PD2R.naControle(c, 'spp'); WHPD2.openFam(PD2R.famVan(c), PD2R.maatVan(c)); const el = document.querySelector(`article.pd2-kaart[data-c="${c}"] [data-kc="spp"] .pd2-oranje`); const w = PD2R.waarde(c, 'spp').v; PD2R.S.echt = false; PD2R.poHerstel(c, null); PD2R.S.echt = true; return { c, t, getoond:!!el, waarde:w, kleur:el ? getComputedStyle(el).color : '' }; });
  check('Controle na invoer: VST zegt iets anders → oranje onder het veld, waarde niet gewijzigd', /^VST: /.test(nc.t) && nc.getoond && /rgb\(176, 90, 0\)/.test(nc.kleur), JSON.stringify(nc));
  check('Schrijven alleen naar wh-pd2-* en productdata met bron pd2', T.blocked.length === 0 && T.writes.every(k => /^(wh-pd2-(oefen|feedback|kopie-.+)|productdata)$/.test(k)), JSON.stringify([...new Set(T.writes)]));
  console.log('ERRORS', T.errors.join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  await T.b.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
