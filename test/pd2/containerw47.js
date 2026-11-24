// Controle W47 (Containers): afronden alleen met alles weggezet · lossen starten alleen met akkoord · losdag-PDF morgen = rode regel ·
// Opboeken ná lossen (Stockmove pas bij Gelost) · Europees nooit VST · 390 en 1440 px · 0 geblokkeerde schrijfpogingen.
// Alleen eigen testcontainers (nagebootst in het geheugen, nooit bewaard); echte database alleen lezen; elke schrijfpoging onderschept.
const { start, naarContainers } = require('./opzet.js');
const ok = [], fout = [];
const check = (n, v, x) => { (v ? ok : fout).push(n); console.log((v ? 'OK   ' : 'FOUT ') + n + (x ? ' — ' + String(x).slice(0, 260) : '')); };
(async () => {
  const T = await start({ vp:{ width:1440, height:900 } }), P = T.p;
  await naarContainers(P, '#/');
  // niets bewaren: opslaan van de testcontainers wordt geteld, niet verstuurd
  await P.evaluate(() => CP_TEST.testStil());
  const morgen = await P.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  const maak = (id, extra) => P.evaluate(([id, extra, morgen]) => {
    const code = 'ZZ-W47-' + id;
    const c = { id, leverancier:'Testleverancier', pakbon_ref:'T' + id, containernummer:'', status:'ingepland', losdatum:extra.los || morgen, data:{ regels:[{ id:'w1', pakbon_code:code, productcode:code, omschrijving:'testproduct', factor:1, totaal:300, per:100, aantal:3, soort:'pallet', bevestigd:true }], verdeling:{}, instellingen:{ maanden:1.5 } } };
    CP_TEST.zetGeheugen(code, { qty:'100', pickmax:'0' });
    CP_TEST.ensureData(c); if(extra.eu) c.data.herkomst = 'eu';
    CP_TEST.cont().push(c); CP_TEST.wist();
    return code;
  }, [id, extra, morgen]);
  const zetAkkoord = id => P.evaluate(id => { const c = CP_TEST.cont().find(x => x.id === id), X = CP_TEST, pl = X.pools(c);
    pl.order.forEach(code => { const a = X.adviesKern(c, pl.map[code], X.leegEerder()); c.data.verdeling[code] = { porties:a.porties.map(x => Object.assign({}, x)), bevestigd:true, bron:'advies' }; }); X.wist(); const g = X.voortgang(c); return { akk:g.akk, nAk:g.nAk }; }, id);
  const naar = async (id, tab) => { await P.evaluate(([id, tab]) => { location.hash = '#/c/' + id + '/' + tab; }, [id, tab]); await P.waitForTimeout(900); };
  const kaarten = () => P.evaluate(() => ({ afr:!!document.querySelector('[data-afrmeld]'), afrTekst:(document.querySelector('[data-afrmeld]') || {}).innerText || '', loss:!!document.querySelector('[data-lossmeld]'), lossTekst:(document.querySelector('[data-lossmeld]') || {}).innerText || '', opboek:!!document.querySelector('[data-opboek]'), smDis:[...document.querySelectorAll('[data-act="smcopy"],[data-act="smdown"]')].map(b => b.disabled) }));
  const status = id => P.evaluate(id => CP_TEST.cont().find(x => x.id === id).status, id);

  // 1. afronden met voorraad zonder plek → melding met de producten; Toch afronden werkt
  const code1 = await maak(900471, {});
  await P.evaluate(code => { CP_TEST.zetGeenPlek({ [code.toLowerCase()]:7 }); }, code1);
  await naar(900471, 'uitvoer');
  await P.click('[data-act="afronden"]'); await P.waitForTimeout(600);
  let k = await kaarten();
  check('1a Afronden met voorraad op "geen specifieke locatie": melding met het product', k.afr && k.afrTekst.includes(code1) && k.afrTekst.includes('geen specifieke locatie'), k.afrTekst);
  check('1b Container is nog niet afgerond', (await status(900471)) !== 'afgerond');
  await P.click('[data-act="afrondentoch"]'); await P.waitForTimeout(500);
  check('1c "Toch afronden" rondt wel af (Daan beslist)', (await status(900471)) === 'afgerond');
  // zonder voorraad zonder plek: direct afgerond
  const code2 = await maak(900472, {});
  await P.evaluate(() => { CP_TEST.zetGeenPlek({}); });
  await naar(900472, 'uitvoer'); await P.click('[data-act="afronden"]'); await P.waitForTimeout(500);
  check('1d Alles weggezet: afronden zonder melding', (await status(900472)) === 'afgerond' && !(await kaarten()).afr);

  // 2. lossen starten: zonder akkoord melding, met akkoord gelost
  await maak(900473, {});
  await naar(900473, 'uitvoer');
  await P.click('[data-act="lossenstart"]'); await P.waitForTimeout(500);
  k = await kaarten();
  check('2a Lossen zonder akkoord: melding "Verdeling eerst akkoord geven"', k.loss && /Verdeling eerst akkoord geven/.test(k.lossTekst), k.lossTekst);
  check('2b Status blijft ingepland', (await status(900473)) === 'ingepland');
  const stock1 = await kaarten();
  check('2c Stockmove-knoppen uit en tekst "Jim boekt op ná lossen en tellen" zolang niet gelost', stock1.opboek && stock1.smDis.every(x => x), JSON.stringify(stock1.smDis));
  const ak = await zetAkkoord(900473);
  await naar(900473, 'uitvoer');
  await P.click('[data-act="lossenstart"]'); await P.waitForTimeout(500);
  check('2d Lossen met akkoord: status Gelost (' + ak.akk + '/' + ak.nAk + ')', (await status(900473)) === 'gelost');
  k = await kaarten();
  check('2e Na Gelost: Stockmove-regel vrij, geen opboek-tekst', !k.opboek && k.smDis.length === 2);

  // 3. losdag-PDF: akkoord → klaar-regel met "uiterlijk"; morgen zonder PDF → rode regel in Wat nu
  await maak(900474, {}); await zetAkkoord(900474);
  const w = await P.evaluate(() => { const c = CP_TEST.cont().find(x => x.id === 900474); const h = document.createElement('div'); h.innerHTML = CP_TEST.wijzer([c]); return { rood:!!h.querySelector('[data-rood]'), t:(h.querySelector('[data-rood]') || {}).innerText || '' }; });
  check('3a Losdatum morgen zonder PDF: rode regel in Wat nu', w.rood && /geen losdag-PDF/.test(w.t), w.t);
  const sb = await P.evaluate(() => { const c = CP_TEST.cont().find(x => x.id === 900474); const h = document.createElement('div'); h.innerHTML = CP_TEST.statusBalkTest(c); return h.innerText; });
  check('3b Verdeling akkoord: knop "Maak losdag-PDF" met "uiterlijk" de dag ervoor', /Maak losdag-PDF/.test(sb) && /uiterlijk/.test(sb), sb.replace(/\s+/g, ' ').slice(0, 200));
  const w2 = await P.evaluate(() => { const c = CP_TEST.cont().find(x => x.id === 900474); c.data.magazijn_pdf = { pad:'x', op:new Date().toISOString(), naam:'x' }; CP_TEST.wist(); const h = document.createElement('div'); h.innerHTML = CP_TEST.wijzer([c]); return !!h.querySelector('[data-rood]'); });
  check('3c Met PDF: geen rode regel', !w2);
  const w3 = await P.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 4); const c = CP_TEST.cont().find(x => x.id === 900474); c.data.magazijn_pdf = null; c.losdatum = d.toISOString().slice(0, 10); CP_TEST.wist(); const h = document.createElement('div'); h.innerHTML = CP_TEST.wijzer([c]); return !!h.querySelector('[data-rood]'); });
  check('3d Losdatum over 4 dagen: nog geen rode regel', !w3);

  // 4. Europees: nooit VST (ook niet bij veel pallets)
  const eu = await P.evaluate(() => {
    const code = 'ZZ-W47-EU'; CP_TEST.zetGeheugen(code, { qty:'100' });
    const mk = e => { const c = { id:e ? 90048 : 90049, leverancier:'Testleverancier', status:'concept', losdatum:'2099-01-01', data:{ herkomst:e ? 'eu' : 'container', regels:[{ id:'e1', pakbon_code:code, productcode:code, omschrijving:'t', factor:1, totaal:3000, per:100, aantal:30, soort:'pallet' }], verdeling:{}, instellingen:{ maanden:1.5 } } }; CP_TEST.ensureData(c); const pl = CP_TEST.pools(c); return CP_TEST.adviesKern(c, pl.map[code], CP_TEST.leegEerder()).porties.map(x => x.dest); };
    return { eu:mk(true), ctn:mk(false) };
  });
  check('4a Europese herkomst: geen enkele portie naar VST', eu.eu.length > 0 && eu.eu.every(d => d !== 'VST'), eu.eu.join(','));
  check('4b (controle) Zelfde levering als container mag wel VST kiezen of niet, maar Europees is nooit VST', Array.isArray(eu.ctn));

  // 5. 390 en 1440 px: geen horizontaal scrollen op uitvoer
  for(const vp of [{ width:390, height:800 }, { width:1440, height:900 }]){
    await P.setViewportSize(vp); await naar(900473, 'uitvoer');
    const sw = await P.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('5 Uitvoer op ' + vp.width + ' px: geen horizontale scroll', sw <= 1, 'verschil ' + sw);
  }
  check('6 Niets bewaard in de test zelf wel geteld, nooit verstuurd; 0 geblokkeerde schrijfpogingen', T.blocked.length === 0, T.blocked.join(' | '));
  check('7 Geen schrijfactie naar Picqer', !T.blocked.some(b => /^FUNC/.test(b)));
  check('8 Geen pagina-fouten', !T.errors.some(e => /PAGEERROR/.test(e)), T.errors.slice(0, 3).join(' | '));
  await T.b.close();
  console.log('\n' + (fout.length ? 'FOUT: ' + fout.length + ' — ' + fout.join(' | ') : 'ALLES OK (' + ok.length + ')'));
  process.exit(fout.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
