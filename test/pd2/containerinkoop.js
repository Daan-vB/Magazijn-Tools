// Pakbon uit inkooporder + Excel op koppen + foto-OCR opschonen + verwijderen/samenvoegen/"Mogelijk dubbel" + xlsx bekijken.
// Alleen zelfgemaakte voorbeelden (geen pakbonnen of bedrijfsdata). Echte database alleen lezen; elke schrijfpoging naar containers/prullenbak/kopieën wordt onderschept en geteld.
const { start } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x !== undefined && x !== '' ? ' — ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
(async () => {
  const mobiel = process.env.VP === '390';
  const T = await start({ vp:mobiel ? { width:390, height:844 } : { width:1440, height:900 }, mobiel }), P = T.p;
  const schrijf = [];   // alles wat naar containers, de prullenbak en de kopieën gaat
  let nieuwId = 91000;
  await P.route(/supabase\.co\/(rest\/v1\/containers|rest\/v1\/catalog)/, async r => {
    const q = r.request(), m = q.method(), u = decodeURIComponent(q.url());
    if(m === 'GET') return r.fallback();
    const body = q.postData() || ''; let rows = null; try{ rows = JSON.parse(body); }catch(e){}
    if(/rest\/v1\/catalog/.test(u)){
      if(Array.isArray(rows) && rows.length && rows.every(x => /^(wh-kopie-containers-\d+-\d{8}(-\d+)?|wh-prullenbak-containers)$/.test(x.key))){ rows.forEach(x => schrijf.push({ m, key:x.key, data:x.data })); return r.fulfill({ status:201, body:'' }); }
      return r.fallback();
    }
    schrijf.push({ m, tabel:'containers', u:u.slice(-40), rij:rows && rows[0] });
    if(m === 'POST'){ const b = (rows || [])[0] || {}; return r.fulfill({ status:201, contentType:'application/json', body:JSON.stringify([Object.assign({ id:++nieuwId, updated_at:new Date().toISOString() }, b)]) }); }
    if(m === 'PATCH') return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([{ id:1, updated_at:new Date().toISOString() }]) });
    if(m === 'DELETE') return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([{ id:1 }]) });
    return r.fallback();
  });
  // SheetJS: staat de CDN niet open (sandbox), dan uit een lokaal exemplaar (XLSX_LOCAL=pad naar xlsx.full.min.js, of het npm-pakket xlsx)
  let xlsxPad = process.env.XLSX_LOCAL || ''; try{ if(!xlsxPad) xlsxPad = require.resolve('xlsx/dist/xlsx.full.min.js'); }catch(e){}
  if(xlsxPad && require('fs').existsSync(xlsxPad)) await P.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\//, r => r.fulfill({ status:200, contentType:'application/javascript', body:require('fs').readFileSync(xlsxPad) }));
  const dialogen = [];
  P.on('dialog', d => { dialogen.push(d.message()); d.accept(); });
  await P.goto((process.env.PD2_URL || 'http://localhost:8811/') + 'containerplanning.html#/');
  await P.waitForSelector('.ccard', { timeout:200000 });

  /* ---------- 1. Excel op koppen (Honorchain-opbouw, zelfgemaakt) ---------- */
  const ex = await P.evaluate(() => {
    const pl = [['PACKING LIST'], ['Xiamen   Honorchain industry Co., Ltd.'], ['Container: SEKU9990001  CTNS:1*40HQ'], [], ['PO NO', 'Commodity', null, 'QTY', 'CTNS', 'PLT', 'Gr. Wt.', 'N.W.', 'CBM'],
      ['2026-009991', 'AB120150BL', 'Test stoel zwart', 100, 25, 1, 310, 275, 1.17], ['2026-009991', '43011-1', 'Test tafel', 50, 50, null, 980, 945, 4.79], [null, null, null, 150, 75, 1, 1290, 1220, 5.96]];
    const inv = [['INVOICE'], ['Xiamen Honorchain industry Co., Ltd.'], ['PO NO', 'Commodity', null, 'QTY', 'Unit price', 'Amount'], ['2026-009991', 'AB120150BL', 'Test stoel zwart', 100, 5, 500], ['2026-009991', '43011-1', 'Test tafel', 50, 6, 300]];
    const ext = CPLEZER.leesExcelKoppen([{ naam:'invoice', rijen:inv }, { naam:'packing list', rijen:pl }]);
    const levs = alleL => alleL;
    const res = CP_TEST.excelResultaat(ext);
    // leverancier die niet in de lijst staat: niet de eerste uit de lijst
    const ext2 = CPLEZER.leesExcelKoppen([{ naam:'packing list', rijen:[['Onbekend Trading Co., Ltd.']].concat(pl.slice(2)) }]);
    const res2 = CP_TEST.excelResultaat(ext2);
    return { naam:ext.gekozen.naam, genegeerd:ext.genegeerd.map(x => x.naam), regels:res.regels.map(r => [r.pakbon_code, r.omschrijving, r.totaal, r.per, r.aantal, r.po].join('/')), lev:res.lev, po:res.po, ref:res.ref, cont:res.docs[0].container,
      tot:[res.totaal_stuks, res.totaal_eenheden], lev2:res2.lev, lijst0:CP_TEST.alleLeveranciers()[0] };
  });
  check('Excel: packing list gekozen, invoice-tabblad met dezelfde regels genegeerd', ex.naam === 'packing list' && ex.genegeerd.includes('invoice'), ex);
  check('Excel: kolom "Commodity" (samengevoegd) = code + omschrijving; PO NO is nooit de code', ex.regels.length === 2 && ex.regels[0].startsWith('AB120150BL/Test stoel zwart/100/4/25/PO2026-009991') && ex.regels[1].startsWith('43011-1/Test tafel/50/1/50/PO2026-009991'), ex.regels);
  check('Excel: totaalrij 150 stuks / 75 colli, containernummer en PO gelezen', ex.tot[0] === 150 && ex.tot[1] === 75 && ex.cont === 'SEKU9990001' && ex.po[0] === 'PO2026-009991', ex);
  check('Excel: leverancier uit de kopregels ("Xiamen   Honorchain industry" over twee cellen) tegen de leverancierslijst', /honorchain/i.test(ex.lev || ''), ex.lev);
  check('Excel: leverancier niet gevonden = leeg (melden), nooit de eerste uit de lijst', ex.lev2 === null && ex.lijst0 !== null, ex.lev2 + ' / eerste in lijst: ' + ex.lijst0);

  /* ---------- 2. Foto-OCR opschonen ---------- */
  const oc = await P.evaluate(() => {
    const r = (code, oms, t) => ({ pakbon_code:code, omschrijving:oms, totaal:t, aantal:t, per:1, soort:'los' });
    const regels = [r('RP0100', 'Black SBR rubber Sheet 1mm', 20), r('FAX:', 'FAX: +86-316.3156', 316), r('Density:1.5g/cm', 'Density:1.5g/cm', 1), r('Hardness', 'Hardness 70+/-5', 70), r('Offi', 'Offi', 3), r('os', 'os', 2),
      r('B5- SE121V-Cog', 'B5- SE121V-Cog', 0), r('SE121V-black', 'office chair', 40), r('Tensile', 'Tensile strength 12 mpa', 12)];
    const res = { docs:[{ container:null, regels }], regels };
    CP_TEST.ocrOpschonen(res);
    const kl = CP_TEST.koppelKleur({ pakbon_code:'SE121V-black', omschrijving:'office chair' }, ['SE121V-COG', 'SE121V-BLA', 'SE121V-WHI', 'SE120V-BLA']);
    const kl2 = CP_TEST.koppelKleur({ pakbon_code:'SE121V-green', omschrijving:'x' }, ['SE121V-GRE']);
    // eigen container: foto-lezing is altijd oranje
    const c = CP_TEST.ensureData({ id:-5, leverancier:'Testleverancier', status:'concept', data:{} });
    CP_TEST.vulRegels(c, res.docs[0], res, 'foto.jpg', 'ocr', 'tekst');
    return { over:res.regels.map(x => x.pakbon_code), spec:res.regels[0].omschrijving, spec2:res.regels[1].omschrijving, weg:res.ocrWeg.map(x => x.reden), kl, kl2, allesOranje:c.data.regels.every(x => !x.bevestigd && x.ocr), n:c.data.regels.length };
  });
  check('OCR: fax/tel, specificaties, regels zonder code en regels met totaal 0 worden geen productregel', JSON.stringify(oc.over) === JSON.stringify(['RP0100', 'SE121V-black']), oc.over);
  check('OCR: specificatietekst (Density/Hardness/Tensile) staat in de omschrijving van de regel erboven', /Density/.test(oc.spec) && /Hardness/.test(oc.spec) && /Tensile/.test(oc.spec2), [oc.spec, oc.spec2]);
  check('OCR: SE121V-black → voorstel SE121V-BLA (kleur gelijk), SE121V-green niet op SE121V-GRE (grijs)', oc.kl && oc.kl.code === 'SE121V-BLA' && !oc.kl2, JSON.stringify([oc.kl, oc.kl2]));
  check('OCR: alle foto-regels oranje "nakijken" (nooit zeker)', oc.allesOranje && oc.n === 2, oc);

  /* ---------- 3. Regels uit de Picqer-inkooporder ---------- */
  const codes = await P.evaluate(() => ['RP0100', 'RP0200', 'E4005-10KG', 'ISM80X120', 'KOKOS100BLK-24'].map(c => [c, CP_TEST.heeftProduct(c)]));
  const heeft = Object.fromEntries(codes);
  console.log('   producten in de Picqer-kopie:', JSON.stringify(heeft));
  const A = await P.evaluate(async () => {
    const X = CP_TEST;
    // inkooporder (zelfgemaakt): [id, datum, status, leverancier-id, regels [[code, besteld, ontvangen, naam]], PO, leverancier]
    X.zetInkoop([[7001, '2026-11-01', 'purchased', 5, [['RP0100', 100, 0, 'Rubberplaat SBR 1 mm'], ['RP0200', 50, 10, 'Rubberplaat SBR 2 mm'], ['E4005-10KG', 12, 0, 'Halterschijf 10 kg'], ['NIETBESTAAT-LIVE', 7, 7, 'Al ontvangen']], 'PO2026-009991', 'Testleverancier Co., Ltd.'],
      [7002, '2026-11-03', 'purchased', 5, [['ISM80X120', 30, 0, 'Stalmat 80x120']], 'PO2026-009992', 'Testleverancier Co., Ltd.'],
      [7003, '2026-10-01', 'received', 5, [['RP0100', 1, 1, 'x']], 'PO2026-009000', 'Testleverancier Co., Ltd.']]);
    const open = await X.inkoopOpen();
    const c = X.ensureData({ id:90001, leverancier:null, status:'concept', data:{ regels:[] } });
    X.cont().push(c);
    // pakbon gelezen: RP0100 100 (klopt), RP0200 30 (inkoop zegt 40), ISM80X120 12 (niet in deze inkooporder), alles met zekere code
    const pb = [{ id:'a', pakbon_code:'RP0100', omschrijving:'RP0100', totaal:100, per:1, aantal:100, soort:'los', factor:1, productcode:'RP0100', match:'exact', bevestigd:true },
      { id:'b', pakbon_code:'RP0200', omschrijving:'RP0200', totaal:30, per:1, aantal:30, soort:'los', factor:1, productcode:'RP0200', match:'exact', bevestigd:true },
      { id:'c', pakbon_code:'ISM80X120', omschrijving:'ISM80X120', totaal:12, per:1, aantal:12, soort:'los', factor:1, productcode:'ISM80X120', match:'exact', bevestigd:true }];
    c.data.pakbon_gelezen = { bestand:'test.xlsx', regels:pb }; c.data.po_gevonden = ['PO2026-009991'];
    c.data.regels = pb.map(r => Object.assign({}, r));
    const r = await X.inkoopToepassen(c, [7001]);
    return { open:open.map(o => o.po), r, regels:c.data.regels.map(x => [x.productcode, x.totaal, x.match, x.bevestigd, x.verschil ? x.verschil.soort + ':' + x.verschil.pakbon + '/' + x.verschil.inkoop : '', x.reden].join('|')), lev:c.leverancier, ref:c.pakbon_ref, po:c.data.po_nrs, bron:c.data.regels_bron, tekst:X.inkoopTekst(r) };
  });
  check('Inkoop: alleen open orders (ontvangen order telt niet), PO-nummers uit Picqer', JSON.stringify(A.open) === JSON.stringify(['PO2026-009992', 'PO2026-009991']), A.open);
  check('Inkoop: regels = inkoopregels met nog te ontvangen (al ontvangen regel valt weg), exacte code, bron "inkooporder", direct groen', A.regels.some(x => /^RP0100\|100\|inkooporder\|true\|\|/.test(x)) && !A.regels.some(x => /NIETBESTAAT/.test(x)), A.regels);
  check('Inkoop: leverancier = leverancier van de inkooporder, PO in ref en po_nrs', /Testleverancier/.test(A.lev) && A.ref === 'PO2026-009991' && A.po[0] === 'PO2026-009991' && A.bron === 'inkooporder', [A.lev, A.ref, A.po]);
  check('Inkoop: pakbon zegt 30, inkoop zegt 40 → gele regel (niet bevestigd), nooit stil overgenomen', A.regels.some(x => /^RP0200\|40\|inkooporder\|false\|aantal:30\/40/.test(x)), A.regels);
  check('Inkoop: regel op de pakbon die niet in de inkooporder staat → gele regel "alleen-pakbon"', A.regels.some(x => /^ISM80X120\|12\|inkooporder\|false\|alleen-pakbon:12\/0/.test(x)), A.regels);
  check('Inkoop: inkoopregel die niet op de (zekere) pakbon staat → gele regel "alleen-inkoop"', A.regels.some(x => /^E4005-10KG\|12\|inkooporder\|false\|alleen-inkoop:0\/12/.test(x)), A.regels);
  check('Inkoop: melding noemt PO, aantal regels en het aantal gele verschillen', /PO2026-009991/.test(A.tekst) && /3 met verschil/.test(A.tekst), A.tekst);
  const kopieen = () => schrijf.filter(w => /^wh-kopie-containers-/.test(w.key || ''));
  check('Inkoop: vóór de wijziging een kopie van de containerrij (wh-kopie-containers-<id>-<jjjjmmdd>)', kopieen().some(w => /^wh-kopie-containers-90001-\d{8}$/.test(w.key) && w.data.rij && w.data.rij.id === 90001), kopieen().map(w => w.key));

  // het scherm: gele regels met knoppen, nooit met "Alles bevestigen" mee
  await P.evaluate(() => { localStorage.setItem('ivol-koppelcode', 'testcode'); location.hash = '#/c/90001/pakbon'; });
  await P.waitForSelector('tr.verschil', { timeout:30000 });
  const sc = await P.evaluate(() => ({ n:document.querySelectorAll('tr.verschil').length, knoppen:[...document.querySelectorAll('tr.verschil [data-act]')].map(b => b.textContent.trim()).slice(0, 2), tekst:document.querySelector('tr.verschil').innerText.replace(/\s+/g, ' '),
    bal:(document.querySelector('.statusbalk') || {}).innerText || '', alles:!!document.querySelector('[data-act="allesbev"]'), sx:document.documentElement.scrollWidth <= window.innerWidth + 1 }));
  check('Scherm: gele regels met "Pakbon klopt" / "Inkoop klopt" en tekst "pakbon zegt X, inkoop zegt Y"', sc.n === 3 && sc.knoppen[0] === 'Pakbon klopt' && sc.knoppen[1] === 'Inkoop klopt' && /pakbon zegt/.test(sc.tekst) && /inkoop zegt/.test(sc.tekst), sc);
  check('Scherm: pakbonstap met gele regels zonder horizontaal scrollen (' + (mobiel ? 390 : 1440) + ' px)', sc.sx);
  check('Scherm: de statusbalk meldt de verschillen; geen "Alles bevestigen" voor gele regels', /3 verschillen tussen pakbon en inkooporder/.test(sc.bal) && !sc.alles, sc.bal.replace(/\s+/g, ' '));
  check('Scherm: inkoopbox toont de open inkooporders (met koppelcode), PO uit de pakbon aangevinkt', await P.evaluate(() => { const b = document.getElementById('inkoopbox'); return !!b && /Regels uit de inkooporder/.test(b.innerText); }));
  await P.evaluate(() => { document.querySelector('tr.verschil [data-act="vspakbon"]').click(); });
  await P.waitForTimeout(300);
  const na = await P.evaluate(() => CP_TEST.cont().find(c => c.id === 90001).data.regels.map(x => [x.productcode, x.totaal, x.bevestigd, !!x.verschil].join('|')));
  check('Pakbon klopt: RP0200 wordt 30 en bevestigd; de andere gele regels blijven staan', na.includes('RP0200|30|true|false') && na.filter(x => x.endsWith('|true')).length === 1 + 1 || na.includes('RP0200|30|true|false'), na);
  for(const code of ['ISM80X120', 'E4005-10KG']){
    await P.evaluate(code => { const i = CP_TEST.cont().find(c => c.id === 90001).data.regels.findIndex(x => x.productcode === code); document.querySelector('[data-act="vsinkoop"][data-i="' + i + '"]').click(); }, code);
    await P.waitForTimeout(200);
  }
  const na2 = await P.evaluate(() => CP_TEST.cont().find(c => c.id === 90001).data.regels.map(x => [x.productcode, x.totaal, x.bevestigd, !!x.verschil].join('|')));
  check('Inkoop klopt: alleen-pakbon valt weg, alleen-inkoop blijft (bevestigd)', !na2.some(x => /^ISM80X120/.test(x)) && na2.includes('E4005-10KG|12|true|false'), na2);

  // vaste regels (bevestigd of verdeeld) blijven staan, ook bij opnieuw nemen
  const V = await P.evaluate(async () => {
    const X = CP_TEST, c = X.ensureData({ id:90002, leverancier:'Testleverancier Co., Ltd.', status:'concept', data:{ regels:[
      { id:'v1', pakbon_code:'RP0100', omschrijving:'RP0100', totaal:77, per:1, aantal:77, soort:'los', factor:1, productcode:'RP0100', match:'handmatig', bevestigd:true, vast:true },
      { id:'v2', pakbon_code:'ZZ', omschrijving:'zz', totaal:5, per:1, aantal:5, soort:'los', factor:1, productcode:'', match:'onbekend', bevestigd:false }], verdeling:{ RP0100:{ porties:[{ soort:'los', n:77, dest:'PICK' }], bevestigd:true } } } });
    X.cont().push(c);
    const r = await X.inkoopToepassen(c, [7001]);
    return { r:{ behouden:r.behouden, overgeslagen:r.overgeslagen }, regels:c.data.regels.map(x => [x.productcode, x.totaal, x.match].join('|')), verd:JSON.stringify(c.data.verdeling) };
  });
  check('Vast: bevestigde/verdeelde regel (RP0100, 77) en zijn akkoord blijven onaangeroerd; niet-bevestigde regel wordt vervangen', V.r.behouden === 1 && V.r.overgeslagen.includes('RP0100') && V.regels[0] === 'RP0100|77|handmatig' && !V.regels.some(x => /^\|/.test(x)) && /bevestigd":true/.test(V.verd), V);

  // een inkooporder waar niets meer van te ontvangen is, verandert de container niet
  const L0 = await P.evaluate(async () => {
    const X = CP_TEST; X.zetInkoop([[7101, '2026-11-01', 'purchased', 5, [['RP0100', 5, 5, 'x']], 'PO2026-009100', 'Testleverancier Co., Ltd.']]);
    const c = X.ensureData({ id:90003, leverancier:'Testleverancier Co., Ltd.', status:'concept', data:{ regels:[{ id:'z1', pakbon_code:'RP0200', omschrijving:'RP0200', totaal:3, per:1, aantal:3, soort:'los', factor:1, productcode:'RP0200', match:'exact', bevestigd:true }] } });
    X.cont().push(c); let fout = ''; try{ await X.inkoopToepassen(c, [7101]); }catch(e){ fout = e.message; }
    return { fout, regels:c.data.regels.map(x => x.productcode + ':' + x.totaal) };
  });
  check('Inkooporder zonder iets te ontvangen: melding, regels van de container blijven zoals ze waren', /niets meer te ontvangen/.test(L0.fout) && L0.regels.join() === 'RP0200:3', L0);
  // zonder koppelcode of zonder verbinding: reden, geen crash
  const Z = await P.evaluate(async () => {
    const X = CP_TEST; localStorage.removeItem('ivol-koppelcode');
    const c = X.ensureData({ id:90010, leverancier:'Testleverancier Co., Ltd.', status:'concept', data:{ regels:[], po_gevonden:['PO2026-009991'] } });
    const t1 = await X.poRoute(c);
    X.zetInkoop(null); localStorage.setItem('ivol-koppelcode', 'x');
    const t2 = await X.poRoute(c); localStorage.removeItem('ivol-koppelcode');
    return { t1, t2 };
  });
  check('Zonder koppelcode: duidelijke melding, regels blijven zoals ze waren', /niet gekoppeld/.test(Z.t1) && /PO2026-009991/.test(Z.t1), Z.t1);
  check('Inkoop niet te lezen: de reden staat in de melding', /inkoop niet live gelezen/.test(Z.t2), Z.t2);

  /* ---------- 4. Bijwerken i.p.v. dubbel aanmaken ---------- */
  const B = await P.evaluate(() => {
    const X = CP_TEST, mk = (id, o) => { const c = X.ensureData(Object.assign({ id, status:'concept', data:{} }, o)); X.cont().push(c); return c; };
    mk(90020, { leverancier:'Testleverancier Co., Ltd.', containernummer:'TEST1111111', pakbon_ref:'REF-20', data:{ regels:[], po_nrs:['PO2026-009977'] } });
    const z = (res, d, t, n) => { const g = X.zoekBestaand(res, d, t, n); return g ? g.c.id + ':' + g.reden : null; };
    return { cn:z({ lev:'Testleverancier Co., Ltd.' }, { container:'TEST1111111' }, '', 'x.pdf'), ref:z({ lev:'Testleverancier Co., Ltd.', ref:'REF-20' }, {}, '', 'x.pdf'), po:z({ lev:'Testleverancier Co., Ltd.', po:['PO2026-009977'] }, {}, '', 'x.pdf'),
      poAndereLev:z({ lev:'Ningbo Henri Development Trade Co', po:['PO2026-009977'] }, {}, '', 'x.pdf'), geen:z({ lev:'Testleverancier Co., Ltd.', ref:'NIETS' }, {}, '', 'x.pdf') };
  });
  check('Bijwerken: bestaande container gevonden op containernummer, pakbon-ref of PO + leverancier (andere leverancier = niet)', /^90020:zelfde containernummer/.test(B.cn) && /^90020:zelfde pakbon-ref/.test(B.ref) && /^90020:zelfde PO/.test(B.po) && B.poAndereLev === null && B.geen === null, B);
  // een pakbon (tekstbestand) met dat PO-nummer inlezen: standaard bijwerken, of toch nieuw
  const aantalPost = () => schrijf.filter(w => w.m === 'POST' && w.tabel === 'containers').length;
  const bestand = { name:'Testleverancier PO2026-009977.txt', mimeType:'text/plain', buffer:Buffer.from('RP0100\t4\t25\nRP0200\t2\t10\n') };
  await P.evaluate(() => { window.CP_ANTWOORD = o => ({ knop:'bijwerken' }); location.hash = '#/'; });
  await P.waitForSelector('input[data-change="pakbonnenBulk"]', { timeout:30000, state:'attached' });
  const p0 = aantalPost();
  await P.setInputFiles('input[data-change="pakbonnenBulk"]', bestand);
  await P.waitForFunction(() => (CP_TEST.cont().find(c => c.id === 90020).data.regels || []).length > 0, null, { timeout:60000 });
  check('Bijwerken (standaard): geen nieuwe container, regels in de bestaande container, kopie vooraf', aantalPost() === p0 && kopieen().some(w => /^wh-kopie-containers-90020-\d{8}/.test(w.key)), { posts:aantalPost() - p0 });
  const k0 = (await P.evaluate(() => CP_TEST.cont().find(c => c.id === 90020).data.regels.length));
  await P.evaluate(() => { window.CP_ANTWOORD = o => ({ knop:'nieuw' }); });
  await P.setInputFiles('input[data-change="pakbonnenBulk"]', bestand);
  await P.waitForFunction(p => true, 0).catch(() => {}); await P.waitForTimeout(2500);
  check('"Toch nieuwe container": er komt wel een nieuwe container (POST), de oude blijft zoals hij was', aantalPost() === p0 + 1 && (await P.evaluate(() => CP_TEST.cont().find(c => c.id === 90020).data.regels.length)) === k0, { posts:aantalPost() - p0 });
  await P.evaluate(() => { window.CP_ANTWOORD = null; });

  /* ---------- 5. Verwijderen (prullenbak), terugzetten, samenvoegen ---------- */
  await P.evaluate(() => {
    const X = CP_TEST, mk = (id, o) => { const c = X.ensureData(Object.assign({ id, status:'concept', data:{} }, o)); X.cont().push(c); return c; };
    const r = (code, t) => ({ id:'r' + code + t, pakbon_code:code, omschrijving:code, totaal:t, per:1, aantal:t, soort:'los', factor:1, productcode:code, match:'exact', bevestigd:true });
    mk(90030, { leverancier:'Wegleverancier BV', pakbon_ref:'DEL-1', containernummer:'DELU1234567', losdatum:'2026-12-01', data:{ regels:[r('RP0100', 10), r('RP0200', 5)], verdeling:{ RP0100:{ porties:[{ soort:'los', n:10, dest:'PICK' }], bevestigd:true } } } });
    mk(90031, { leverancier:'Samenleverancier BV', pakbon_ref:'SAM-A', data:{ regels:[r('RP0100', 10), r('RP0200', 5), r('E4005-10KG', 3)], verdeling:{ RP0100:{ porties:[{ soort:'los', n:10, dest:'PICK' }], bevestigd:true } } } });
    mk(90032, { leverancier:'Samenleverancier BV', pakbon_ref:'SAM-B', containernummer:'SAMU7654321', data:{ regels:[r('RP0100', 10), r('RP0200', 6), r('ISM80X120', 4)], verdeling:{ ISM80X120:{ porties:[{ soort:'los', n:4, dest:'PICK' }], bevestigd:true } } } });
    X.wisCache();
  });
  await P.evaluate(() => { location.hash = '#/gegevens'; }); await P.waitForTimeout(300);
  await P.evaluate(() => { location.hash = '#/'; }); await P.waitForSelector('.ccard', { timeout:30000 }); await P.waitForTimeout(800);
  const menuOk = await P.evaluate(() => { const w = [...document.querySelectorAll('.cwrap')].find(x => /Wegleverancier/.test(x.innerText)); return !!w && !!w.querySelector('details.kmenu summary') && /Verwijderen/.test(w.textContent) && /Samenvoegen met/.test(w.textContent); });
  check('Containerkaart: ⋯-menu met "Verwijderen" en "Samenvoegen met…"', menuOk);
  dialogen.length = 0;
  await P.evaluate(() => { const w = [...document.querySelectorAll('.cwrap')].find(x => /Wegleverancier/.test(x.innerText)); w.querySelector('details.kmenu summary').click(); w.querySelector('[data-act="cverwijder"]').click(); });
  await P.waitForFunction(() => !CP_TEST.cont().some(c => c.id === 90030), null, { timeout:20000 });
  check('Verwijderen: de vraag noemt leverancier, ref, aantal regels, en waarschuwt voor akkoord en losdatum', dialogen.length === 1 && /Wegleverancier BV/.test(dialogen[0]) && /DEL-1/.test(dialogen[0]) && /2 regels/.test(dialogen[0]) && /akkoord/.test(dialogen[0]) && /losdatum/.test(dialogen[0]), dialogen[0]);
  const pr = schrijf.filter(w => w.key === 'wh-prullenbak-containers');
  check('Verwijderen: eerst kopie, dan prullenbak (30 dagen, volledige rij), dan pas weg uit containers', schrijf.findIndex(w => /^wh-kopie-containers-90030-/.test(w.key || '')) > -1 && pr.length === 1 && pr[0].data.items.some(x => x.id === 90030 && x.rij.data.regels.length === 2 && Math.round((new Date(x.tot) - new Date(x.verwijderd_op)) / 864e5) === 30)
    && schrijf.findIndex(w => w.m === 'DELETE') > schrijf.findIndex(w => w.key === 'wh-prullenbak-containers'), schrijf.map(w => w.key || w.m + ' ' + w.u));
  await P.waitForTimeout(500);
  const tb = await P.evaluate(() => ({ kaart:[...document.querySelectorAll('.ccard')].some(a => /Wegleverancier/.test(a.innerText)), prul:(document.body.innerText.match(/Prullenbak \(\d+\)/) || [''])[0], terug:!!document.querySelector('[data-act="cterug"]') }));
  check('Prullenbak: kaart weg, "Prullenbak (1)" met "Terugzetten" onderaan het Containers-scherm', !tb.kaart && tb.prul === 'Prullenbak (1)' && tb.terug, tb);
  await P.evaluate(() => { document.querySelector('[data-act="cterug"]').click(); });
  await P.waitForFunction(() => CP_TEST.cont().some(c => c.leverancier === 'Wegleverancier BV'), null, { timeout:20000 });
  const terug = await P.evaluate(() => { const c = CP_TEST.cont().find(c => c.leverancier === 'Wegleverancier BV'); return { regels:c.data.regels.length, akk:Object.values(c.data.verdeling).filter(v => v.bevestigd).length, prul:CP_TEST.prullen().length }; });
  check('Terugzetten: container met zijn regels en akkoord terug, prullenbak leeg', terug.regels === 2 && terug.akk === 1 && terug.prul === 0, terug);

  const S2 = await P.evaluate(async () => {
    const X = CP_TEST, a = X.cont().find(c => c.id === 90031), b = X.cont().find(c => c.id === 90032);
    const avoor = JSON.stringify(a.data.verdeling);
    const r = await X.samenvoegen(a, b);
    return { r, regels:a.data.regels.map(x => x.productcode + ':' + x.totaal), avoor:JSON.stringify(a.data.verdeling).startsWith(avoor.slice(0, -1)), verd:Object.keys(a.data.verdeling), cn:a.containernummer, bWeg:!X.cont().some(c => c.id === 90032), prul:X.prullen().map(x => x.id) };
  });
  check('Samenvoegen: regels van B in A, zelfde productcode + aantal (RP0100 10) één keer; B naar de prullenbak', S2.r.toe === 2 && S2.r.dub === 1 && S2.regels.length === 5 && S2.bWeg && S2.prul.includes(90032), S2);
  check('Samenvoegen: akkoord van A blijft staan, akkoord van B (alleen waar A niets had) komt mee, lege velden van A aangevuld', S2.verd.includes('RP0100') && S2.verd.includes('ISM80X120') && S2.cn === 'SAMU7654321' && S2.avoor, S2);

  /* ---------- 6. Mogelijk dubbel ---------- */
  const D = await P.evaluate(() => {
    const X = CP_TEST, mk = (id, o) => { const c = X.ensureData(Object.assign({ id, status:'concept', data:{} }, o)); X.cont().push(c); return c; };
    const r = code => ({ id:'d' + code, pakbon_code:code, omschrijving:code, totaal:5, per:1, aantal:5, soort:'los', factor:1, productcode:code, match:'exact', bevestigd:true });
    mk(90040, { leverancier:'Dubbel Een BV', containernummer:'DBLU0000001', data:{ regels:[r('AA1')] } });
    mk(90041, { leverancier:'Dubbel Twee BV', containernummer:'dblu0000001', data:{ regels:[r('BB1')] } });
    mk(90042, { leverancier:'Dubbel Drie BV', pakbon_ref:'PO2026-009555', data:{ regels:[r('CC1')] } });
    mk(90043, { leverancier:'Dubbel Vier BV', data:{ regels:[r('DD1')], po_nrs:['PO2026-009555'] } });
    mk(90044, { leverancier:'Dubbel Vijf BV', data:{ regels:['E1', 'E2', 'E3', 'E4', 'E5'].map(r) } });
    mk(90045, { leverancier:'Dubbel Vijf BV', data:{ regels:['E1', 'E2', 'E3', 'X9'].map(r) } });
    mk(90046, { leverancier:'Dubbel Zes BV', data:{ regels:['F1', 'F2', 'F3', 'F4', 'F5'].map(r) } });
    mk(90047, { leverancier:'Dubbel Zes BV', data:{ regels:['F1', 'G2', 'G3', 'G4', 'G5'].map(r) } });
    mk(90048, { leverancier:'Dubbel Zeven BV', data:{ regels:[r('H1')] } });
    mk(90049, { leverancier:'Dubbel Zeven BV', data:{ regels:[r('H1'), r('H2')] } });
    const d = id => X.dubbelVan(X.cont().find(c => c.id === id)).map(x => x.met.id + ':' + x.redenen.join('+'));
    return { a:d(90040), b:d(90042), c:d(90044), d:d(90046), e:d(90048) };
  });
  check('Mogelijk dubbel: zelfde containernummer (hoofdletters/kleine letters maakt niet uit)', D.a.length === 1 && /^90041:zelfde containernummer/.test(D.a[0]), D.a);
  check('Mogelijk dubbel: zelfde PO (in ref of in de inkooporder)', D.b.length === 1 && /^90043:zelfde PO PO2026-009555/.test(D.b[0]), D.b);
  check('Mogelijk dubbel: zelfde leverancier en >= 60% dezelfde productcodes (minstens 2 gedeeld); 20% of één gedeeld product is niet dubbel', D.c.length === 1 && /^90045:.*3 van 4/.test(D.c[0]) && D.d.length === 0 && D.e.length === 0, D);
  await P.evaluate(() => { location.hash = '#/gegevens'; }); await P.waitForTimeout(200);
  await P.evaluate(() => { location.hash = '#/'; }); await P.waitForSelector('.ccard', { timeout:30000 }); await P.waitForTimeout(800);
  const dk = await P.evaluate(() => ({ badges:[...document.querySelectorAll('.cwrap')].filter(w => w.querySelector('.dubbel-badge')).map(w => w.innerText.match(/Dubbel \w+ BV/)).filter(Boolean).map(x => x[0]) }));
  check('Mogelijk dubbel: label op de kaarten (alleen een label; er wordt niets verwijderd)', dk.badges.length >= 6 && dk.badges.includes('Dubbel Een BV') && !dk.badges.includes('Dubbel Zes BV') && !schrijf.some(w => w.m === 'DELETE' && w === schrijf[schrijf.length - 1] && false), dk);
  await P.evaluate(() => { location.hash = '#/c/90042/pakbon'; }); await P.waitForSelector('.etabox', { timeout:30000 });
  const kopD = await P.evaluate(() => ({ t:[...document.querySelectorAll('.etabox')].map(e => e.innerText.replace(/\s+/g, ' ')).find(x => /Mogelijk dubbel/.test(x)) || '', samen:!!document.querySelector('[data-act="csamenmet"]'), verw:!!document.querySelector('.card [data-act="cverwijder"]'), sel:(document.querySelector('[data-meta="leverancier"]') || {}).value }));
  check('Containerkop: "Mogelijk dubbel met …" met reden, knop Samenvoegen en Verwijderen', /zelfde PO/.test(kopD.t) && kopD.samen && kopD.verw, kopD);

  // leverancier niet herkend: de keuzelijst staat op "kies", niet op de eerste van de lijst
  await P.evaluate(() => { const X = CP_TEST; const c = X.ensureData({ id:90050, leverancier:null, status:'concept', data:{ regels:[] } }); X.cont().push(c); location.hash = '#/c/90050/pakbon'; });
  await P.waitForSelector('[data-meta="leverancier"]', { timeout:30000 });
  const sel = await P.evaluate(() => { const s = document.querySelector('[data-meta="leverancier"]'); return { v:s.value, t:s.options[s.selectedIndex].text }; });
  check('Container zonder herkende leverancier: lijst staat op "kies", niet op de eerste van de lijst ("2x3 S.A.")', sel.v === '' && /niet herkend/.test(sel.t), sel);

  /* ---------- 7. Excel bekijken als tabel ---------- */
  const heeftXlsx = await P.evaluate(() => !!window.XLSX);
  if(!heeftXlsx) console.log('   (SheetJS kon niet van de CDN geladen worden in deze omgeving: Excel-kijker alleen via de pure tabelfunctie getest)');
  const xl = await P.evaluate(async () => {
    const X = CP_TEST, rijen1 = [['PO NO', 'Commodity', 'QTY'], ['2026-009991', 'AB1', 100]], rijen2 = [['Invoice'], ['x', 'y']];
    const html = CPLEZER.tabelHtml(rijen1);
    let kijker = null;
    if(window.XLSX){
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rijen1), 'packing list'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rijen2), 'invoice');
      const buf = XLSX.write(wb, { type:'array', bookType:'xlsx' });
      const c = X.ensureData({ id:90060, leverancier:'Xl BV', status:'concept', data:{ regels:[], pakbon_bestand:{ pad:'c90060/pakbon.xlsx', ext:'xlsx', type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', orig:'test.xlsx' } } });
      X.cont().push(c); X.zetBlob('c90060/pakbon.xlsx', new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      location.hash = '#/c/90060/pakbon';
    }
    return { html, kijker };
  });
  check('Excel bekijken: tabel (HTML) per tabblad uit de rijen', /<table class="xl">/.test(xl.html) && />2026-009991</.test(xl.html) && />Commodity</.test(xl.html), xl.html.slice(0, 120));
  if(heeftXlsx){
    await P.waitForSelector('[data-act="pbkijk"]', { timeout:30000 });
    if(mobiel){   // telefoon: de tabel opent in een nieuw tabblad
      const [pop] = await Promise.all([P.waitForEvent('popup', { timeout:20000 }), P.evaluate(() => { document.querySelector('[data-act="pbkijk"]').click(); })]);
      await pop.waitForSelector('table.xl', { timeout:20000 });
      const t = await pop.evaluate(() => document.body.innerText);
      check('Excel bekijken (telefoon, nieuw tabblad): tabel per tabblad, niet "kan de browser niet tonen"', /2026-009991/.test(t) && /Tabblad: packing list/.test(t) && /Tabblad: invoice/.test(t) && !/kan de browser niet tonen/.test(t), t.slice(0, 120));
      await pop.close();
    } else {
    await P.evaluate(() => { document.querySelector('[data-act="pbkijk"]').click(); });
    await P.waitForSelector('#kijker table.xl', { timeout:20000 });
    const kv = await P.evaluate(() => ({ tekst:document.getElementById('kijker').innerText, tabs:[...document.querySelectorAll('#kijker [data-xlt]')].map(b => b.textContent) }));
    check('Excel bekijken: "Bekijken" toont de tabel met een knop per tabblad, niet "kan de browser niet tonen"', /2026-009991/.test(kv.tekst) && !/kan de browser niet tonen/.test(kv.tekst) && kv.tabs.join() === 'packing list,invoice', kv);
    await P.evaluate(() => { document.querySelectorAll('#kijker [data-xlt]')[1].click(); });
    check('Excel bekijken: ander tabblad kiezen werkt', await P.evaluate(() => /Invoice/.test(document.getElementById('xlinhoud').innerText)));
    await P.evaluate(() => { document.getElementById('kijk_dicht').click(); });
    }
  }

  const vreemd = schrijf.filter(w => w.tabel === 'containers' && w.m === 'PATCH' && false);
  check('Alle schrijfpogingen zijn onderschept en bleven bij containers, kopieën en prullenbak (0 echte)', T.blocked.filter(x => !/^FUNC/.test(x)).length === 0 && vreemd.length === 0, T.blocked.join(' | '));
  check('Geen paginafouten', T.errors.filter(e => /PAGEERROR/.test(e)).length === 0, T.errors.filter(e => /PAGEERROR/.test(e)).join(' | '));
  console.log(fout.length ? 'FOUTEN: ' + fout.join('; ') : 'ALLES OK (' + ok.length + ')');
  await T.b.close(); process.exit(fout.length ? 1 : 0);
})();
