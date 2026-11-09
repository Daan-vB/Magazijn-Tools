// DAANTOETS — de vaste regels van Daan (CLAUDE.md) als test. Verplicht groen vóór elke push (CLAUDE.md §9), samen met schermvullend.js en regressie.js.
// Regelmatrix: test/pd2/DAANTOETS.md (elke regel → schermen → controle D-nr). Een rode controle noemt de regel uit CLAUDE.md.
// Echte database alleen lezen; elke schrijfpoging wordt onderschept (productdata en eigen rijen gaan naar een kopie in het geheugen, al het andere
// wordt geblokkeerd en geteld: moet 0 zijn). Picqer (het tussenstation) wordt niet aangeroepen.
// Gebruik: repo serveren op 8811 (python3 -m http.server 8811) en `node test/pd2/daantoets.js`. ALLEEN=D17,D29 draait een deel.
const { start } = require('./opzet.js');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const B = process.env.PD2_URL || 'http://localhost:8811/';
const ok = [], fout = [], info = [];
const ALLEEN = process.env.ALLEEN ? new Set(process.env.ALLEEN.split(',')) : null;
const doe = d => !ALLEEN || ALLEEN.has(d);
function check(d, regel, waar, x){
  const naam = d + ' · CLAUDE.md ' + regel;
  (waar ? ok : fout).push(naam);
  console.log((waar ? 'OK   ' : 'FOUT ') + naam + (x ? ' — ' + String(x).slice(0, 400) : ''));
}
(async () => {
  const T = await start({ echt:true }); const P = T.p;
  const ev = (f, a) => P.evaluate(f, a);
  const wacht = ms => P.waitForTimeout(ms);
  const laadTodo = async tab => { await P.goto(B + 'ivol.html#/todo/' + tab); await P.waitForFunction(() => window.WHCP && WHCP.tel && WHCP.tel() && document.querySelector('.cp-tabs'), null, { timeout:280000 }); await wacht(400); };
  const naarTab = async tab => { await ev(t => { location.hash = '#/todo/' + t; }, tab); await wacht(700); };
  const herteken = () => ev(() => { WHCP.S.memo = null; WHTAAK.herteken(); });
  const TABS = ['overzicht', 'later', 'picklocaties', 'bulklocaties', 'hercontrole', 'gewicht', 'tewegen', 'aantal'];

  /* ---------- openen zonder tik: niets geschreven (§1 nooit stil wijzigen) ---------- */
  await laadTodo('overzicht');
  const teksten = {};
  for(const t of TABS){ await naarTab(t); teksten[t] = await ev(() => document.querySelector('#native').innerText); }
  await P.goto(B + 'ivol.html#/doorloop/soort'); await P.waitForFunction(() => window.WHDL && WHDL.S.pad && document.querySelector('.dl'), null, { timeout:280000 }); await wacht(1500);
  teksten.doorloop = await ev(() => document.querySelector('.dl').innerText);
  await P.goto(B + 'ivol.html#/pd2'); await P.waitForFunction(() => document.querySelector('.pd2[data-scherm]:not([data-scherm="laden"])'), null, { timeout:280000 }).catch(() => {}); await wacht(1500);
  teksten.pd2 = await ev(() => document.querySelector('#native') ? document.querySelector('#native').innerText : document.body.innerText);
  if(doe('D5')) check('D5', '§1 Nooit stil wijzigen wat Daan bevestigde: alle tabs, Doorloop en Productdata 2.0 openen zonder tik = 0 schrijfacties naar productdata of Te doen', T.pdWrites.length === 0 && !T.writes.some(k => /^wh-controle|^wh-doorloop-later$|^productdata$/.test(k)), JSON.stringify(T.writes.slice(0, 5)));
  if(doe('D3')){ const l = Object.entries(teksten).filter(([, t]) => /exporteer|upload (een|de) export|stuur (een )?screenshot|importeer eerst/i.test(t)).map(([k]) => k); check('D3', '§1 Alles live: nooit om een export, screenshot of bestand vragen', !l.length, l.join(',')); }
  if(doe('D20')){ const l = Object.entries(teksten).filter(([, t]) => /\d{1,2}:\d{2}\s?(AM|PM|am|pm)\b/.test(t)).map(([k]) => k); check('D20', '§2 Tijden altijd 24-uurs', !l.length, l.join(',')); }
  if(doe('D35')){ const l = Object.entries(teksten).filter(([, t]) => /\bhal D\b/i.test(t)).map(([k]) => k); check('D35', '§5 Drie hallen A, B, C (C met gedeelte C en D): nergens "hal D"', !l.length, l.join(',')); }
  if(doe('D40')) check('D40', '§10 Vaste woorden: Later · moet nog, Klaar voor Picqer, Selectie is, kleurgenoten (zelfde maat)', /Later · moet nog/.test(teksten.later) && /Selectie is:/.test(teksten.picklocaties) && /Klaar voor Picqer/.test(teksten.picklocaties + teksten.overzicht) && /zelfde maat/.test(teksten.overzicht + teksten.hercontrole + teksten.gewicht), '');

  await laadTodo('overzicht');
  /* ---------- structuur van de tabs ---------- */
  if(doe('D15')){ const r = await ev(() => ({ tabs:WHCP.TABS.map(x => x[1]), zonder:Object.entries(WHCP.cats()).flatMap(([k, l]) => l.filter(x => !x.redenen || !x.redenen.length || !x.redenen[0].t).map(x => k + ':' + x.c)) }));
    check('D15', '§2 Te doen = tabs Overzicht · Later · Picklocaties · Bulklocaties · Hercontrole · Gewicht controleren · Te wegen · Aantal per pallet; elk punt met reden', r.tabs.join('|') === 'Overzicht|Later|Picklocaties|Bulklocaties|Hercontrole|Gewicht controleren|Te wegen|Aantal per pallet' && !r.zonder.length, r.tabs.join('|') + ' ' + r.zonder.slice(0, 5)); }
  if(doe('D16')){ const r = await ev(() => { const c = WHCP.cats(), t = WHCP.tel(), dub = []; Object.entries(c).forEach(([k, l]) => { const s = new Set(); l.forEach(x => { if(s.has(x.c)) dub.push(k + ':' + x.c); s.add(x.c); }); }); return { dub, tel:['picklocaties', 'bulklocaties', 'hercontrole', 'gewicht', 'tewegen', 'aantal'].every(k => t[k] === c[k].length), t, pb:['PBVF-60x90-BLUE', 'ST210-Black', 'FLM66x110-B'].map(x => Object.entries(c).filter(([, l]) => l.filter(y => y.c === x).length > 1).length) }; });
    check('D16', '§2 Eén product = één punt per tab (alle redenen eronder); tellers tellen producten (PBVF-60x90-BLUE, ST210-Black, FLM66x110-B niet dubbel)', !r.dub.length && r.tel && r.pb.every(n => n === 0), JSON.stringify(r.dub.slice(0, 5)) + ' ' + JSON.stringify(r.t)); }
  if(doe('D36')){ const r = await ev(() => { const c = WHCP.cats(), sam = Object.keys(WH.D.P).filter(x => PD2R.isSam(x) && PD2R.actief(x)); const inTab = Object.values(c).flat().filter(x => PD2R.isSam(x.c)).map(x => x.c); const g = sam.slice(0, 20).map(x => PD2R.groepVan(x)); const verg = []; return { inTab, alleen:g.every(x => /^sam\|/.test(x.k)), n:sam.length, verg }; });
    check('D36', '§6 SAM Europe: nooit in de tabs, nooit vergeleken, eigen groep', !r.inTab.length && r.alleen && !r.verg.length, JSON.stringify(r).slice(0, 300)); }
  if(doe('D28')){ const r = await ev(() => { const P = PD2R, fout = [];
      Object.keys(WH.D.P).filter(P.actief).forEach(c => { P.kleurgenoten(c).forEach(x => { if(P.maatVan(x) !== P.maatVan(c) || P.famVan(x) !== P.famVan(c)) fout.push(c + '~' + x); }); });
      const paren = [['MM-BLK-10x120', 'MM-BLK-4x120'], ['3028-3', '3028-4'], ['3028-4', '3028-5'], ['KB-blkred-4kg', 'KB-blkblue-12kg'], ['Ring-roll-3m', 'Ring-roll-6m'], ['HM-10-0-2.5', 'HM-10-0-2.5-2M'], ['Ring-rol-150-10', 'Ring-rol-150-5'], ['PD-M-BLA', 'PD-L-BLA']].filter(([a, b]) => WH.D.P[a] && WH.D.P[b]).map(([a, b]) => [a, b, P.zelfdeMaat(a, b)]);
      const wel = [['1711-white-set', '1711-black-set'], ['MM-BLK-10x120', 'MM-BLUE-10x120']].filter(([a, b]) => WH.D.P[a] && WH.D.P[b]).map(([a, b]) => [a, b, P.zelfdeMaat(a, b)]);
      return { fout:fout.slice(0, 5), paren, wel }; });
    check('D28', '§3/§10 Kleurgenoten = zelfde familie én maat (maat ook uit de naam): nooit een andere maat', !r.fout.length && r.paren.every(x => !x[2]) && r.wel.every(x => x[2]) && r.paren.length >= 6, JSON.stringify(r)); }
  if(doe('D29')){ const r = await ev(() => { const g = c => { const x = WHCP.gewichtPunt(c); return x && x.voorstel ? x.voorstel.kg : null; }, c = WHCP.cats();
      const kb = g('KB-blkred-4kg'), r3 = g('Ring-roll-3m'), r6 = g('Ring-roll-6m'), t = ['3028-3', '3028-4', '3028-5'].map(g), w = g('1711-white-set');
      const mm = c.gewicht.filter(x => /^MM-/.test(x.c) && /kleurgenoten/.test(x.reden)).map(x => x.c);
      const zonderBron = c.gewicht.filter(x => x.voorstel && !/kleurgenoten \(zelfde maat\)|andere maat, naar verhouding/.test(x.voorstel.tekst)).map(x => x.c);
      return { kb, r3, r6, t, w, mm, zonderBron, wegen:c.gewicht.filter(x => !x.voorstel).map(x => x.c).slice(0, 8) }; });
    check('D29', '§4 Gewicht controleren: voorstel alleen uit kleurgenoten, andere maat alleen met rekensom, anders Naar Te wegen (KB-blkred-4kg nooit 12 kg; Ring-roll 3 m ≠ 6 m; 3028 nooit allemaal 8 kg; MM 10x120 ↔ 4x120 niet; 1711-white-set → 0,045)', r.kb !== 12 && (r.r3 === null || r.r3 !== r.r6) && !r.t.some(x => x === 8) && !r.mm.length && r.w === 0.045 && !r.zonderBron.length, JSON.stringify(r)); }
  if(doe('D37')){ const r = await ev(() => {
      // Daan beslist live verder: E400560-10KG als Weg · Archief met voorraad (en daarna als Uitlopend) alleen in het geheugen nagebootst, niets geschreven
      const P = PD2R, c = 'E400560-10KG', oud = P.S.o.p[c] ? JSON.parse(JSON.stringify(P.S.o.p[c])) : null, t = new Date().toISOString();
      const zet = w => { P.S.o.p[c] = Object.assign({ f:{} }, oud || {}, { so:{ v:'weg', st:'aangepast', t }, weg:{ v:w, st:'aangepast', t } }); P.ongeldig(c); WHCP.S.memo = null; return WHCP.cats().hercontrole.some(x => x.c === c); };
      const archief = num(WH.D.P[c] && WH.D.P[c].voorraad_hm) > 0 ? zet('archief') : true, uitlopend = zet('uitlopend');
      if(oud) P.S.o.p[c] = oud; else delete P.S.o.p[c]; P.ongeldig(c); WHCP.S.memo = null;
      function num(v){ return +v || 0; }
      const l = WHCP.cats().hercontrole, wegVan = c => (PD2R.wegWaarde(c) || {}).v || '';
      return { e4archief:archief, e4uitlopend:uitlopend, uitl:l.filter(x => x.so === 'weg' && wegVan(x.c) === 'uitlopend').map(x => x.c), 
        wegSoort:l.filter(x => x.redenen.some(y => /soort/.test(y.t) && /Kleurgenoten/.test(y.t)) && (x.so === 'weg' || x.voorstellen.some(v => v.soort === 'weg'))).map(x => x.c),
        zonderVisie:l.filter(x => x.redenen.some(y => !y.visie)).map(x => x.c) }; });
    check('D37', '§3 Hercontrole: geen Uitlopend met voorraad, wel E400560-10KG (Archief); nooit soortfout met een Weg-kleurgenoot; elk punt met Claudes visie', !r.uitl.length && r.e4archief && !r.e4uitlopend && !r.wegSoort.length && !r.zonderVisie.length, JSON.stringify(r)); }
  if(doe('D45')){ const r = await ev(() => { const P = PD2R, g = c => WHCP.gewichtPunt(c), si = ['SI60120BR-2-0', 'SI60120TP-2-0'].map(c => { const x = g(c); return { c, reden:x && x.reden, vs:x && x.voorstel, wegen:x && x.wegen }; });
      // nooit elkaars waarde: geen voorstel als er maar één kleurgenoot met een gewicht is en die het oneens is
      const twee = WHCP.cats().gewicht.filter(x => x.voorstel && /kleurgenoten/.test(x.voorstel.tekst) && P.kleurgenoten(x.c).filter(y => P.gewicht(y).kg > 0 || P.gewicht(y).pq > 0).length === 1).map(x => x.c);
      return { si, twee }; });
    check('D45', '§4 Twee tegen elkaar (SI60120BR 10 kg ↔ SI60120TP 4 kg) of een gelijke stand: geen voorstel, beide Naar Te wegen met die reden; nooit elkaars waarde', r.si.every(x => !x.vs && x.wegen && /oneens/.test(x.reden || '')) && !r.twee.length, JSON.stringify(r)); }
  if(doe('D46')){ const r = await ev(() => { const P = PD2R, t = new Date().toISOString(), oudBo = Object.keys(P.S.o.p).filter(c => { const p = P.S.o.p[c]; return p.so && p.so.v === 'weg' && p.weg && p.weg.v === 'backorder'; });
      const leesBo = oudBo.every(c => P.soortWaarde(c).v === 'backorder' && P.status(c).so === 'backorder');
      // Twijfel alleen in het geheugen: niet afgerond, geen gewicht- of hoeveelheidsvragen, onder Later, niet in de gewone Doorloop
      const c = Object.keys(WH.D.P).find(x => P.actief(x) && !P.isSam(x) && !P.isKoppel(x) && P.status(x).so === 'deel' && P.belangrijk().includes(x)), oud = P.S.o.p[c] ? JSON.parse(JSON.stringify(P.S.o.p[c])) : null;
      P.S.o.p[c] = Object.assign({ f:{} }, oud || {}, { so:{ v:'twijfel', st:'aangepast', t } }); P.ongeldig(c); WHCP.S.memo = null;
      const st = P.status(c), tw = { af:st.af, open:st.open, nodig:P.nodigVan(c, 'twijfel'), later:WHCP.twijfelItems().some(x => x.c === c), telLater:WHCP.tel().later };
      if(oud) P.S.o.p[c] = oud; else delete P.S.o.p[c]; P.ongeldig(c); WHCP.S.memo = null;
      // oude vorm wordt pas bij de volgende bewaaractie omgezet (in het geheugen nagebootst, zonder te schrijven)
      const b = oudBo[0], ob = b ? JSON.parse(JSON.stringify(P.S.o.p[b])) : null; let omgezet = true;
      if(b){ const was = P.S.echt; P.S.echt = false; try{ P.poZet(b, p => { p.gew = p.gew || { st:'tewegen', t }; }); omgezet = P.S.o.p[b].so.v === 'backorder' && !P.S.o.p[b].weg; } finally { P.S.echt = was; P.S.o.p[b] = ob; P.ongeldig(b); } }
      return { n:oudBo.length, leesBo, c, tw, omgezet, kies:P.SOORTEN.map(x => x[0]).includes('twijfel') && P.SOORTEN.map(x => x[0]).includes('backorder') }; });
    check('D46', '§3 Twijfel en Backorder zijn soorten: Weg · Backorder wordt gelezen als Backorder (pas bij de volgende bewaaractie omgezet); Twijfel telt niet als afgerond, geen gewicht/hoeveelheid, staat onder Later', r.kies && r.leesBo && r.omgezet && !r.tw.af && r.tw.open.join() === 'soort' && !r.tw.nodig.length && r.tw.later, JSON.stringify(r)); }
  if(doe('D35')){ const r = await ev(() => { const g = PD2R.gangen(); return { g:g.map(h => h.gang), hal:[...new Set(g.map(h => h.hal))], dDeel:g.filter(h => h.gang[0] === 'D').every(h => h.hal === 'C' && h.deel === 'D'), cDeel:g.filter(h => h.gang[0] === 'C').every(h => h.hal === 'C' && h.deel === 'C'), oud:PD2R.wensNorm({ hal:'D', gang:'DD' }) }; });
    check('D35', '§5 Keuze hal → gedeelte → gang: gangen D.. = hal C gedeelte D, alleen bestaande gangen; oude pickwens "D" leest als C/D', r.hal.every(h => ['A', 'B', 'C'].includes(h)) && r.dDeel && r.cDeel && r.oud.hal === 'C' && r.oud.deel === 'D', JSON.stringify(r).slice(0, 300)); }
  if(doe('D23') || doe('D24') || doe('D25') || doe('D42')){
    const r = await ev(() => { const P = PD2R, bulk = [], pal = [], verb = [], lvl = []; let nLvl = 0, nMax = 0, nSam = 0; const bel = new Set(P.belangrijk());
      Object.keys(WH.D.P).filter(c => P.actief(c) && !P.isKoppel(c)).forEach(c => { let s; try{ s = P.status(c); }catch(e){ return; } const I = P.info(c), n = P.nodigVan(c, s.so, I);
        if(s.so === 'bulk' && (n.includes('maxpick') || n.includes('lvl') || (I.vs.maxpick && I.vs.maxpick.v) || (I.vs.lvl && I.vs.lvl.v))) bulk.push(c);
        if(['pallet', 'deel', 'bulk'].includes(s.so) && !I.bewijs && n.some(k => ['spp', 'maat', 'hoogte', 'rmax'].includes(k))) pal.push(c);
        if(n.some(k => ['gewpal', 'spd', 'verp', 'kgst', 'maxlig', 'plaatsen'].includes(k))) verb.push(c);
        if(n.includes('lvl') && !(['pallet', 'deel'].includes(s.so) && P.metVastePick(c, I))) lvl.push(c);
        if(s.so === 'pallet' && n.includes('maxpick') && I.bewijs) lvl.push('max:' + c);
        const a = bel.has(c) && s.stap.soort && s.open.includes('lvl'), b = bel.has(c) && s.stap.soort && s.so === 'deel' && I.bewijs && P.metVastePick(c, I) && s.open.includes('maxpick');
        if(a) nLvl++; if(b) nMax++; if(a || b) nSam++; });
      return { bulk, pal, verb, lvl, nLvl, nMax, nSam }; });
    if(doe('D23')) check('D23', '§3 Bulk: nooit max op pick of aanvullen bij (vraag of voorstel)', !r.bulk.length, r.bulk.slice(0, 5).join(','));
    if(doe('D24')) check('D24', '§3 VASTE REGEL palletvragen alleen met palletbewijs', !r.pal.length, r.pal.slice(0, 5).join(','));
    if(doe('D25')) check('D25', '§3/§4 Gewicht volle pallet, stuks per doos, inkoopverpakking nooit als vraag', !r.verb.length, r.verb.slice(0, 5).join(','));
    if(doe('D42')){ check('D42', '§5 Aanvullen bij (en bij Deel max op pick) alleen bij Deel/Pallet met vaste picklocatie; Pallet: max op pick nooit gevraagd', !r.lvl.length, r.lvl.slice(0, 5).join(',')); info.push('Punt 12: ' + r.nSam + ' belangrijke producten krijgen een vraag: ' + r.nLvl + ' "aanvullen bij", ' + r.nMax + ' Deel-producten ook "max op pick"'); }
  }

  /* ---------- groep → familie → product, Selectie is (§2 VASTE REGEL samenvoegen) ---------- */
  if(doe('D9') || doe('D13') || doe('D7')){
    const per = {};
    for(const t of ['later', 'picklocaties', 'bulklocaties', 'hercontrole', 'gewicht', 'tewegen', 'aantal']){
      await naarTab(t);
      per[t] = await ev(() => { const g = [...document.querySelectorAll('.cp-grp')], n = (WHCP.tel() || {})[location.hash.split('/')[2]] || 0;
        return { n, g:g.length, sel:g.every(x => /Selectie is:/.test(x.innerText)), geldt:g.every(x => /Geldt voor/.test(x.innerText) && x.querySelector('.cp-geldt code')), aan:[...document.querySelectorAll('[data-cp-sel]')].every(i => { const k = i.dataset.cpSel, j = k.indexOf('|'), cat = k.slice(0, j), c = k.slice(j + 1), l = cat === 'later' ? WHCP.laterItems() : (WHCP.cats()[cat] || []), x = l.find(y => y.c === c); return i.checked === !(x && x.uitz); }), feit:[...document.querySelectorAll('.cp-item')].every(i => /verkoop 28 d \d/.test(i.innerHTML) && /(pick |bulk |VST |geen plek |geen voorraad)/.test(i.innerHTML)), kop:g.every(x => /(product|producten) · pick [\d.]+ · bulk [\d.]+ · VST [\d.]+ · geen plek [\d.]+ · verkoop 28 d [\d.]+ · (nu in|staat nog nergens)/.test(x.querySelector('.cp-gt').textContent)), famkop:[...document.querySelectorAll('.cp-famblok .cp-gt')].every(x => /verkoop 28 d/.test(x.textContent)), fam:g.every(x => x.querySelector('[data-cp-fam]')),
          aanpas:[...document.querySelectorAll('.cp-item')].every(i => i.querySelector('a[href^="#/doorloop/p/"]')), table:!!document.querySelector('#cp-inh table') }; });
    }
    const slecht = Object.entries(per).filter(([, x]) => x.n > 0 && !(x.g > 0 && x.sel && x.geldt && x.aan && x.fam)).map(([k]) => k);
    if(doe('D9')) check('D9', '§2 VASTE REGEL samenvoegen: elke tab groep → familie → product, alles aangevinkt, één vraag "Selectie is: …", "Geldt voor" met de codes', !slecht.length, slecht.join(',') + ' ' + JSON.stringify(per).slice(0, 300));
    if(doe('D13')) check('D13', '§2 Elk punt aanpasbaar: per product "Aanpassen" (opent de Doorloop)', Object.values(per).every(x => !x.n || x.aanpas), '');
    if(doe('D7')) check('D7', '§2 Rustig scherm: geen tabellen in Te doen', Object.values(per).every(x => !x.table), '');
    if(doe('D43')) check('D43', '§2 Feiten om te kiezen: bij elk product voorraad per plek (pick/bulk/VST/geen plek) en verkoop 28 d en 6 mnd; in de kop van elke groep en familie producten, voorraad per plek, verkoop en waar de groep nu staat', Object.values(per).every(x => !x.n || (x.feit && x.kop && x.famkop)), JSON.stringify(Object.fromEntries(Object.entries(per).map(([k, x]) => [k, [x.feit, x.kop, x.famkop]]))));
  }
  if(doe('D22')){
    await naarTab('picklocaties');
    const r = await ev(async () => { const g = document.querySelector('.cp-grp'); if(!g) return null; const k = [...g.querySelectorAll('[data-cp="g-soort"]')].map(b => b.innerText); const w = g.querySelector('[data-cp="g-soort"][data-v="weg"]'); w.click(); await new Promise(r => setTimeout(r, 900)); const g2 = document.querySelector('.cp-grp[data-gk="' + CSS.escape(g.dataset.gk) + '"]'); return { k, weg:[...g2.querySelectorAll('[data-cp="g-weg"]')].map(b => b.innerText), r:PD2R.SOORTEN.map(x => x[1]).join(','), rw:PD2R.WEG.map(x => x[1]).join(',') }; });
    check('D22', '§3 Soort = Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg · Backorder (blauwdruk §8); Weg = Uitlopend / Archief', r && r.k.join(',') === 'Pick,Bulk,Deel,Pallet,Mix,Twijfel,Weg,Backorder' && r.weg.join(',') === 'Weg · Uitlopend,Weg · Archief' && r.r === 'Pick,Bulk,Deel,Pallet,Mix,Twijfel,Weg,Backorder' && r.rw === 'Uitlopend,Archief', JSON.stringify(r));
  }
  if(doe('D26')){ const r = await ev(() => { const l = WHCP.cats().picklocaties, u = l.filter(x => x.uitz); return { n:u.length, goed:u.every(x => x.pv && document.querySelector('[data-cp="g-pick"][data-een="' + CSS.escape(x.c) + '"][data-v="' + x.pv.gang + '"]') && x.voorstellen.length), uit:u.every(x => { const i = document.querySelector('[data-cp-sel="picklocaties|' + CSS.escape(x.c) + '"]'); return i && !i.checked; }) }; });
    check('D26', '§3 Waarden per product uit de eigen data: wat duidelijk ergens anders staat is een uitzondering, uitgevinkt, met een eigen voorstel en eigen knop', r.n === 0 || (r.goed && r.uit), JSON.stringify(r)); }

  /* ---------- D17 Picklocaties: Wallace · kokos → één tik → Klaar voor Picqer bij DD, ongedaan maken ---------- */
  if(doe('D17') || doe('D44')){
    // uitgangssituatie vóór het besluit (alleen in het geheugen): de pickwensen van Kokos weg
    await ev(() => { Object.keys(WHPD.S.pd).filter(c => /^KOKOS/i.test(c)).forEach(c => { const r = WHPD.S.pd[c]; if(r && r.data && r.data.pickwens){ r.data = Object.assign({}, r.data); delete r.data.pickwens; } }); WHCP.S.memo = null; });
    await naarTab('picklocaties'); await herteken(); await wacht(500);
    const voor = await ev(() => { const gr = WHCP.groepeer(WHCP.cats().picklocaties).find(g => g.naam === 'Wallace · kokos'); if(!gr) return null; const el = document.querySelector('.cp-grp[data-gk="' + CSS.escape(gr.k) + '"]');
      const aanV = c => !!el.querySelector('[data-cp-sel="picklocaties|' + CSS.escape(c) + '"]:checked');
      return { gk:gr.k, n:gr.items.length, tel:WHCP.tel().picklocaties, kop:el.querySelector('.cp-gt').textContent, voorstel:(el.querySelector('.cp-gu') || {}).textContent || '', knop:(el.querySelector('.cp-sel [data-cp="g-pick"]') || {}).dataset,
        rollen:gr.items.filter(x => /^KOKOS(100|200)/.test(x.c) && !x.uitz).map(x => x.c), rolAan:gr.items.filter(x => /^KOKOS(100|200)/.test(x.c) && !x.uitz).every(x => aanV(x.c) && x.pv.gang === 'DD'),
        matten:gr.items.filter(x => /^KOKOS80120/.test(x.c)).map(x => x.c + ':' + (x.uitz ? 'uit' : 'AAN') + ':' + (x.pv ? x.pv.gang : '-') + ':' + aanV(x.c)), mattenUit:gr.items.filter(x => /^KOKOS80120/.test(x.c)).every(x => x.uitz && !aanV(x.c) && x.pv && x.pv.gang !== 'DD'),
        oudeKnop:/Pick nodig|Wens bijwerken/.test(document.querySelector('#cp-inh').innerText) }; });
    check('D17a', '§2 Picklocaties groep "Wallace · kokos": kop met voorraad, verkoop en "nu in DD …"; voorstel C · D · DD voor de rollen; matten 80x120 uitgevinkt met eigen voorstel', voor && /nu in DD \d+/.test(voor.kop) && /verkoop 28 d [\d.]+/.test(voor.kop) && /hal C · gedeelte D · gang DD/.test(voor.voorstel) && voor.knop && voor.knop.v === 'DD' && voor.rollen.length >= 8 && voor.rolAan && voor.mattenUit, JSON.stringify(voor).slice(0, 600));
    if(voor){
      const pw0 = T.pdWrites.length;
      await P.waitForFunction(() => !document.getElementById('cp-bewaard') || document.getElementById('cp-bewaard').hidden, null, { timeout:8000 }).catch(() => {});
      await ev(gk => document.querySelector('.cp-grp[data-gk="' + CSS.escape(gk) + '"] .cp-sel [data-cp="g-pick"]').click(), voor.gk);
      await P.waitForFunction(() => document.getElementById('cp-bewaard') && !document.getElementById('cp-bewaard').hidden && /pick in/.test(document.getElementById('cp-bewaard').innerText), null, { timeout:20000 }).catch(() => {}); await wacht(300);
      const na = await ev(codes => { const c = WHCP.cats(); return { tel:WHCP.tel().picklocaties, open:c.picklocaties.filter(x => codes.includes(x.c)).map(x => x.c), klaar:c.pickklaar.filter(x => codes.includes(x.c)).map(x => x.c + '@' + x.wens.hal + x.wens.deel + x.wens.gang), lijst:(document.getElementById('cp-klaar') || {}).innerText || '', bar:(document.getElementById('cp-bewaard') || {}).innerText || '', zicht:!!(document.getElementById('cp-bewaard') && !document.getElementById('cp-bewaard').hidden) }; }, voor.rollen);
      check('D17b', '§2 Kiezen = opslaan: één tik bewaart (geen knop "Pick nodig"), de tab telt af, de rollen staan onder "Klaar voor Picqer" bij hal C · gedeelte D · gang DD', !voor.oudeKnop && na.tel === voor.tel - voor.rollen.length && !na.open.length && na.klaar.length === voor.rollen.length && na.klaar.every(x => /@CDDD$/.test(x)) && /Hal C · gedeelte D · gang DD/.test(na.lijst), voor.tel + ' → ' + na.tel + ' · ' + na.klaar.slice(0, 4).join(' '));
      const wr = T.pdWrites.slice(pw0).filter(r => r.data && r.data.pickwens && /^KOKOS/.test(r.productcode));
      check('D2', '§1 Schrijven alleen met een kopie vooraf (wh-kopie-productdata) en nooit hal "D" in een nieuwe pickwens', wr.length > 0 && wr.every(r => ['A', 'B', 'C'].includes(r.data.pickwens.hal) && (r.data.pickwens.gang[0] !== 'D' || (r.data.pickwens.hal === 'C' && r.data.pickwens.ged === 'D'))) && T.writes.findIndex(k => /^wh-kopie-productdata-/.test(k)) > -1 && T.writes.findIndex(k => /^wh-kopie-productdata-/.test(k)) < T.writes.indexOf('productdata'), JSON.stringify(wr.slice(0, 2).map(r => r.productcode + ':' + JSON.stringify(r.data.pickwens))));
      // ongedaan maken: binnen 3 seconden zet het de rijen terug zoals ze in de database stonden (met kopie)
      const pw1 = T.pdWrites.length;
      await ev(() => { const b = document.querySelector('#cp-bewaard [data-cp-undo]'); if(b) b.click(); }); await wacht(2500);
      const terugRijen = T.pdWrites.slice(pw1).filter(r => voor.rollen.includes(r.productcode)).map(r => ({ c:r.productcode, pw:(r.data || {}).pickwens || null }));
      const db = await ev(async codes => { const q = codes.map(c => '"' + c + '"').join(','); const r = await WH.api('GET', 'productdata?productcode=in.(' + encodeURIComponent(q) + ')&select=productcode,data'); return Object.fromEntries((r || []).map(x => [x.productcode, (x.data || {}).pickwens || null])); }, voor.rollen);
      const gelijk = terugRijen.length === voor.rollen.length && terugRijen.every(x => JSON.stringify(x.pw) === JSON.stringify(db[x.c] || null));
      check('D44', '§2 Kiezen = meteen opslaan met 3 s "Bewaard · ongedaan maken"; ongedaan maken schrijft de rijen terug zoals ze in de database stonden', na.zicht && /Bewaard · .*pick in C · D · DD.*ongedaan maken/s.test(na.bar) && gelijk, JSON.stringify({ bar:na.bar, terug:terugRijen.length, gelijk }));
      // per product kiezen: een uitzondering (mat 80x120) met één tik op zijn eigen voorstel
      const m = await ev(gk => { const x = WHCP.cats().picklocaties.find(y => y.gk === gk && y.uitz); if(!x) return null; document.querySelector('[data-cp="g-pick"][data-een="' + CSS.escape(x.c) + '"]').click(); return { c:x.c, gang:x.pv.gang }; }, voor.gk); await wacht(2500);
      const mk = m ? await ev(c => (WHCP.cats().pickklaar.find(x => x.c === c) || {}).wens, m.c) : null;
      check('D44b', '§2 Kiezen bij één product: de uitzondering bewaart met één tik haar eigen voorstel', m && mk && mk.gang === m.gang, JSON.stringify({ m, mk }));
    }
  }
  if(doe('D44')){
    await naarTab('hercontrole');
    const x = await ev(() => { const x = WHCP.cats().hercontrole[0]; return x ? { c:x.c, tel:WHCP.tel().hercontrole } : null; });
    if(x){
      await P.waitForFunction(() => !document.getElementById('cp-bewaard') || document.getElementById('cp-bewaard').hidden, null, { timeout:8000 }).catch(() => {});   // de balk van een vorige keuze eerst weg
      await ev(c => document.querySelector('[data-cp="g-klopt"][data-een="' + CSS.escape(c) + '"]').click(), x.c);
      await P.waitForFunction(() => document.getElementById('cp-bewaard') && !document.getElementById('cp-bewaard').hidden && /klopt zo/.test(document.getElementById('cp-bewaard').innerText), null, { timeout:15000 }).catch(() => {});
      const na = await ev(c => ({ tel:WHCP.tel().hercontrole, er:WHCP.cats().hercontrole.some(y => y.c === c) }), x.c);
      await ev(() => { const b = document.querySelector('#cp-bewaard [data-cp-undo]'); if(b) b.click(); }); await wacht(1800);
      const terug = await ev(c => ({ tel:WHCP.tel().hercontrole, er:WHCP.cats().hercontrole.some(y => y.c === c) }), x.c);
      await wacht(3200); const weg = await ev(() => !document.getElementById('cp-bewaard') || document.getElementById('cp-bewaard').hidden);
      check('D44c', '§2 "Klopt zo" bij één product: meteen weg en de tab telt af; ongedaan maken zet het terug; de balk verdwijnt na 3 seconden', !na.er && na.tel === x.tel - 1 && terug.er && terug.tel === x.tel && weg, JSON.stringify({ x, na, terug, weg }));
    }
  }
  /* ---------- D18 Bulklocaties: PBVF als groep "Alleen bulk" ---------- */
  if(doe('D18')){
    // Daan beslist live verder: zijn "alleen bulk" voor de prikborden (PBVF) alleen in het geheugen weggehaald, zodat ze weer open staan
    await ev(() => { Object.keys(WHCP.S.klopt).filter(k => /^bulkeraf\|PBVF-/.test(k)).forEach(k => { delete WHCP.S.klopt[k]; }); WHCP.S.memo = null; });
    await naarTab('bulklocaties'); await herteken(); await wacht(500);
    const voor = await ev(() => { const gr = WHCP.groepeer(WHCP.cats().bulklocaties).find(g => g.items.some(x => /^PBVF-/.test(x.c))); return gr ? { gk:gr.k, naam:gr.naam, n:gr.items.length, tel:WHCP.tel().bulklocaties, codes:gr.items.map(x => x.c) } : null; });
    if(voor){ await ev(gk => document.querySelector('.cp-grp[data-gk="' + CSS.escape(gk) + '"] [data-cp="g-bulkok"]').click(), voor.gk); await wacht(2500); }
    const na = voor ? await ev(codes => ({ tel:WHCP.tel().bulklocaties, eraf:WHCP.cats().bulkeraf.filter(x => codes.includes(x.c)).length, lijst:(document.getElementById('cp-klaar') || {}).innerText || '' }), voor.codes) : null;
    check('D18', '§2 Bulklocaties: PBVF als groep "Alleen bulk" → tab telt af, werklijst "picklocatie eraf" per hal → gang', voor && na.tel === voor.tel - voor.n && na.eraf === voor.n && /Klaar voor Picqer/.test(na.lijst) && !/hal D/i.test(na.lijst), JSON.stringify(voor && { naam:voor.naam, n:voor.n }) + ' ' + JSON.stringify(na).slice(0, 200));
  }
  /* ---------- D19 + D10: Voorstel overnemen, Klopt zo met uitzondering, Later ---------- */
  if(doe('D19') || doe('D10') || doe('D14')){
    await naarTab('hercontrole');
    const tr = await ev(() => { const x = WHCP.cats().hercontrole.find(y => y.c === 'TRAILER10'); return x ? { gk:x.gk, tel:WHCP.tel().hercontrole, n:WHCP.cats().hercontrole.filter(y => y.gk === x.gk).length } : null; });
    if(tr){
      // alleen TRAILER10 aangevinkt
      await ev(gk => { const el = document.querySelector('.cp-grp[data-gk="' + CSS.escape(gk) + '"]'); el.querySelectorAll('[data-cp-sel]').forEach(i => { if(!/TRAILER10$/.test(i.dataset.cpSel)){ i.checked = false; i.dispatchEvent(new Event('change', { bubbles:true })); } }); }, tr.gk); await wacht(600);
      await ev(gk => document.querySelector('.cp-grp[data-gk="' + CSS.escape(gk) + '"] [data-cp="g-neem"]').click(), tr.gk); await wacht(2500);
      const na = await ev(() => ({ tel:WHCP.tel().hercontrole, er:WHCP.cats().hercontrole.some(y => y.c === 'TRAILER10'), so:PD2R.po('TRAILER10') && PD2R.po('TRAILER10').so }));
      if(doe('D19')) check('D19', '§2 Beslist = weg: "Voorstel overnemen" (TRAILER10 → Deel) haalt het product uit de open lijst; de tab telt af; uitgevinkte blijven staan', !na.er && na.tel === tr.tel - 1 && na.so && na.so.v === 'deel' && na.so.st === 'aangepast', tr.tel + ' → ' + na.tel + ' ' + JSON.stringify(na.so));
    }
    const grp = await ev(() => { const gr = WHCP.groepeer(WHCP.cats().hercontrole).find(g => g.items.length >= 2); return gr ? { gk:gr.k, codes:gr.items.map(x => x.c), tel:WHCP.tel().hercontrole } : null; });
    if(grp && doe('D10')){
      await ev(([gk, c]) => { const i = document.querySelector('.cp-grp[data-gk="' + CSS.escape(gk) + '"] [data-cp-sel="hercontrole|' + CSS.escape(c) + '"]'); i.checked = false; i.dispatchEvent(new Event('change', { bubbles:true })); }, [grp.gk, grp.codes[0]]); await wacht(600);
      const geldt = await ev(gk => document.querySelector('.cp-grp[data-gk="' + CSS.escape(gk) + '"] .cp-geldt').innerText, grp.gk);
      await ev(gk => document.querySelector('.cp-grp[data-gk="' + CSS.escape(gk) + '"] [data-cp="g-klopt"]').click(), grp.gk); await wacht(2500);
      const na = await ev(codes => ({ tel:WHCP.tel().hercontrole, rest:WHCP.cats().hercontrole.filter(x => codes.includes(x.c)).map(x => x.c), kl:Object.keys(WHCP.S.klopt).filter(k => k.startsWith('hercontrole|')) }), grp.codes);
      check('D10', '§2 Uitvinken voor de uitzonderingen: "Klopt zo" voor de aangevinkte, de uitgevinkte blijft staan; "Geldt voor" toont het', na.rest.length === 1 && na.rest[0] === grp.codes[0] && na.tel === grp.tel - (grp.codes.length - 1) && /uitgevinkt/.test(geldt), grp.tel + ' → ' + na.tel + ' rest ' + na.rest.join(','));
    }
    if(doe('D14')){
      // Later vanuit een tab: weg uit de open lijst, in tab Later, telt niet mee
      const l = await ev(() => { const x = WHCP.cats().aantal[0]; return x ? { c:x.c, gk:x.gk, tel:WHCP.tel().aantal, later:WHCP.tel().later, n:WHCP.cats().aantal.filter(y => y.gk === x.gk).length } : null; });
      if(l){
        await naarTab('aantal');
        await ev(gk => document.querySelector('.cp-grp[data-gk="' + CSS.escape(gk) + '"] [data-cp="g-later"]').click(), l.gk); await wacht(2500);
        const na = await ev(c => ({ tel:WHCP.tel().aantal, later:WHCP.tel().later, inLater:WHCP.laterItems().some(x => x.c === c), open:WHCP.cats().aantal.some(x => x.c === c) }), l.c);
        // Later in de Doorloop: niet vooraan, alleen in de Later-lijst
        await P.goto(B + 'ivol.html#/doorloop'); await P.waitForFunction(() => window.WHDL && WHDL.S.pad && document.querySelector('.dl'), null, { timeout:200000 }); await wacht(1000);
        const dl = await ev(async () => { const S = WHDL.S, v = S.pad.find(x => x.t !== 'klaar' && WHDL.rijenVoor(x).length); if(!v) return null; const c = WHDL.rijenVoor(v)[0], t = v.t, stap = t === 'soort' ? 'soort' : t === 'gewicht' ? 'gewicht' : 'hoev';
          await WHTAAK.later.zet([{ c, t, opm:'daantoets' }]); WHDL.bouw(''); const nog = WHDL.S.pad.some(x => x.t === t && WHDL.rijenVoor(x).includes(c)); return { c, t, nog, lijst:WHTAAK.later.lijst().some(x => x.c === c && x.t === t), zl:WHTAAK.openZL(c, stap).filter(k => k === t).length }; });
        check('D14', '§2 Later: bewaard, telt niet mee, staat in tab Later en nooit vooraan in de gewone Doorloop', !na.open && na.inLater && na.tel === l.tel - l.n && dl && !dl.nog && dl.lijst && dl.zl === 0 && T.writes.includes('wh-doorloop-later'), JSON.stringify({ voor:l, na, dl }));
      }
    }
  }
  /* ---------- Doorloop ---------- */
  await P.goto(B + 'ivol.html#/doorloop/hoev'); await P.waitForFunction(() => window.WHDL && WHDL.S.pad && document.querySelector('.dl'), null, { timeout:200000 }); await wacht(1500);
  if(doe('D11')){ const r = await ev(() => WHDL.S.pad.filter(v => v.t !== 'soort' && v.t !== 'klaar').flatMap(v => WHDL.rijenVoor(v).filter(c => !PD2R.status(c).stap.soort).map(c => v.t + ':' + c)));
    check('D11', '§2 Soort eerst: geen gewicht- of hoeveelheidsvraag zonder bevestigde soort', !r.length, r.slice(0, 5).join(',')); }
  if(doe('D8')){ const r = await ev(() => ({ n:document.querySelectorAll('.dl .vraag').length }));
    check('D8a', '§2 Eén vraag tegelijk in de Doorloop', r.n === 1, JSON.stringify(r)); }
  // productscherm PD-M-BLA (Kattenluik M): terug, zoeken, vergelijkbaar met de vaste Neem-over-regel
  await P.goto(B + 'ivol.html#/doorloop/p/PD-M-BLA/gewicht'); await wacht(2500);
  if(doe('D12') || doe('D27')){
    await ev(() => { const b = document.querySelector('[data-vergt="gewicht"]'); if(b) b.click(); }); await wacht(400);
    const r = await ev(() => ({ terug:!!document.getElementById('dl-terug'), zoek:!!document.getElementById('dl-zoekknop'), regel:(document.querySelector('.verg .neemregel') || {}).innerText || '', rijen:[...document.querySelectorAll('.verg .vrij')].map(x => x.innerText.replace(/\s+/g, ' ')), over:document.querySelectorAll('.verg [data-over]').length }));
    if(doe('D12')) check('D12', '§2 Elk invulscherm: terug, zoeken, Vergelijkbare producten met "Neem over" en de vaste regel (code, naam, waarde, bevestigd/voorstel, waarom)', r.terug && r.zoek && /^Neem over zet dit getal bij PD-M-BLA; pas definitief na Klopt\. Klopt zonder Neem over bewaart de waarde die rechts staat/.test(r.regel) && r.over > 0 && r.rijen.every(t => /bevestigd|voorstel/.test(t) && /zelfde maat|andere maat|zelfde groep/.test(t)), r.regel + ' | ' + r.rijen.slice(0, 3).join(' | '));
    if(doe('D27')){ const w = r.rijen.map(t => /zelfde maat/.test(t) ? 0 : /andere maat/.test(t) ? 1 : 2); check('D27', '§3 Volgorde van bronnen: kleurgenoten → familie → groep (leverancier + hoofdwoord), nooit "meerderheid bij de leverancier"', w.every((x, i) => i === 0 || w[i - 1] <= x) && w[0] === 0, w.join(',')); }
    // leesbare code in licht en donker
    const contrast = async () => ev(() => { const e = document.querySelector('.verg code.vcode'); if(!e) return null; const cs = getComputedStyle(e); const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number); const lum = c => { const a = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }; const l1 = lum(rgb(cs.color)), l2 = lum(rgb(cs.backgroundColor)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); });
    const licht = await contrast(); await P.emulateMedia({ colorScheme:'dark' }); await wacht(300); const donker = await contrast(); await P.emulateMedia({ colorScheme:'light' });
    if(doe('D12')) check('D12b', '§2 Vergelijkbaar: code leesbaar in licht en donker (contrast ≥ 4,5)', licht >= 4.5 && donker >= 4.5, 'licht ' + (licht && licht.toFixed(1)) + ' · donker ' + (donker && donker.toFixed(1)));
  }
  if(doe('D21') || doe('D33') || doe('D34') || doe('D30') || doe('D22')){
    const deel = await ev(() => Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isSam(c) && !PD2R.isKoppel(c) && PD2R.status(c).so === 'deel' && PD2R.info(c).bewijs && !PD2R.isRol(c) && PD2R.gewicht(c).st !== 'gewogen'));
    await P.goto(B + 'ivol.html#/doorloop/p/' + encodeURIComponent(deel) + '/hercontrole'); await wacht(2500);
    if(doe('D22')){ const k = await ev(() => [...document.querySelectorAll('[data-pk^="soort|"]')].map(b => b.innerText)); check('D22b', '§3 Doorloop: soortkeuze Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg · Backorder', k.join(',') === 'Pick,Bulk,Deel,Pallet,Mix,Twijfel,Weg,Backorder', k.join(',')); }
    if(doe('D30')){
      const r = await ev(async c => { const k = [...document.querySelectorAll('[data-pk^="gewicht|"]')].map(b => b.innerText); document.querySelector('[data-pk="gewicht|gewogen"]').click(); await new Promise(r => setTimeout(r, 200)); delete WHDL.A(c).kg; document.getElementById('dl-klopt').click(); await new Promise(r => setTimeout(r, 300)); const m = WHDL.S.melding; WHDL.A(c).gst = undefined; delete WHDL.A(c).gst; return { k, melding:m }; }, deel);
      check('D30', '§4 Gewicht-status gewogen · vertrouwd · te wegen; gewogen zonder kg wordt niet bewaard', r.k.join(',') === 'Vertrouwd,Te wegen,Gewogen' && /Gewogen: typ de kg/.test(r.melding), JSON.stringify(r));
      await P.goto(B + 'ivol.html#/doorloop/p/' + encodeURIComponent(deel) + '/hercontrole'); await wacht(1500);
    }
    const zet = (t, v) => ev(([t, v]) => { const i = document.querySelector('.dl input[data-t="' + t + '"]'); if(!i) return 'geen veld ' + t; i.value = v; i.dispatchEvent(new Event('change', { bubbles:true })); return WHDL.S.melding; }, [t, v]);
    if(doe('D21')){ const m1 = await zet('spp', '2,5'), m2 = await zet('maxpick', '7.5'), m3 = await zet('lvl', '1,5'); check('D21', '§2 Nooit decimalen in aantallen (stuks per pallet, aanvullen bij, max op pick)', /Geen decimalen/.test(m1) && [m2, m3].every(m => /Geen decimalen/.test(m) || /geen veld/.test(m)), m1 + ' | ' + m2 + ' | ' + m3); }
    if(doe('D33')){ await zet('hoogte', '143'); const h = await ev(c => (WHDL.A(c).f || {}).hoogte, deel); check('D33', '§5 Pallethoogtes naar boven afronden op 10 cm (143 → 150)', String(h) === '150', deel + ' ' + h); }
    if(doe('D34')){
      const r = await ev(async c => { const m = [...document.querySelectorAll('[data-pk^="maat|"]')].map(b => b.dataset.pk.slice(5)); const vast = PD2R.OPSLAG_MATEN.every(x => m.includes(x)); document.getElementById('dl-maatnieuw').click(); await new Promise(r => setTimeout(r, 200)); const i = document.getElementById('dl-nieuwemaat'); i.value = '125 x 215'; document.getElementById('dl-maatok').click(); await new Promise(r => setTimeout(r, 1500)); return { vast, n:m.length, nieuw:PD2R.matenVoor(c).includes('125x215') }; }, deel);
      check('D34', '§5 Palletmaat: altijd de hele lijst vaste opslagmaten; een nieuwe maat wordt meteen bewaard en staat daarna in de lijst', r.vast && r.nieuw && T.mock['wh-palletmaten'] && JSON.stringify(T.mock['wh-palletmaten']).includes('125x215'), JSON.stringify(r));
    }
  }
  if(doe('D31')){ const r = await ev(() => { const c = Object.keys(WH.D.P).find(c => PD2R.actief(c) && !PD2R.isSam(c) && ['pallet', 'deel'].includes(PD2R.status(c).so) && PD2R.nOf(PD2R.waarde(c, 'spp').v) > 0 && PD2R.gewicht(c).kg > 0 && PD2R.gewicht(c).st === 'vertrouwd'); if(!c) return null; const a = WHDL.volPallet(c); WHDL.A(c).gst = 'tewegen'; const b = WHDL.volPallet(c); delete WHDL.A(c).gst; const g = PD2R.gewicht(c), spp = PD2R.nOf(PD2R.waarde(c, 'spp').v); return { c, a, b, verwacht:Math.ceil(spp * g.kg + 15) }; });
    check('D31', '§4 Gewicht volle pallet = kg × per pallet + 15, alleen bij vertrouwd of gewogen; bij te wegen wacht de berekening', r && /\(berekend\)/.test(r.a) && r.a.replace(/\D/g, '') === String(r.verwacht) && /berekend na wegen/.test(r.b), JSON.stringify(r)); }
  if(doe('D32')){ const r = await ev(() => { const P = PD2R, c = Object.keys(WH.D.P).find(c => P.actief(c) && !P.isSam(c) && !P.isRol(c) && P.status(c).so === 'pallet' && P.info(c).bewijs && P.nOf(P.waarde(c, 'spp').v) > 0 && !(P.po(c) && P.po(c).f && P.po(c).f.maxpick) && P.waarde(c, 'maxpick').st !== 'vastgelegd'); if(!c) return null; const spp = P.nOf(P.waarde(c, 'spp').v); P.poZet(c, p => { p.f.lvl = { v:'10', st:'aangepast', voor:'', t:new Date().toISOString() }; }); const mp = P.po(c).f.maxpick; return { c, spp, mp:mp && mp.v, calc:mp && mp.calc, gevraagd:P.nodigVan(c, 'pallet', P.info(c)).includes('maxpick') }; });
    check('D32', '§5 Pallet: max op pick = aanvullen bij + stuks per pallet (berekend, nooit gevraagd)', r && r.mp === String(10 + r.spp) && r.calc && !r.gevraagd, JSON.stringify(r)); }
  if(doe('D36')){ const v = await ev(() => Object.keys(WH.D.P).filter(x => !PD2R.isSam(x) && PD2R.actief(x) && !PD2R.isKoppel(x)).slice(0, 600).filter(x => WHDL.vergelijkbaar(x, 'soort').some(y => PD2R.isSam(y.c))));
    check('D36b', '§6 SAM Europe nooit in Vergelijkbare producten', !v.length, v.slice(0, 5).join(',')); }
  if(doe('D4')){ const codes = await ev(rs => rs.filter(r => !WH.D.P[r]), T.pdWrites.map(r => r.productcode)); check('D4', '§1 Productcode is heilig: elke geschreven rij heeft precies de productcode uit Picqer', T.pdWrites.length > 0 && !codes.length, T.pdWrites.length + ' rijen · ' + codes.join(',')); }
  /* ---------- Productdata 2.0: hal-filter ---------- */
  if(doe('D35')){
    await P.goto(B + 'ivol.html#/pd2'); await P.waitForFunction(() => document.querySelector('.pd2[data-scherm]:not([data-scherm="laden"])'), null, { timeout:200000 }).catch(() => {}); await wacht(1500);
    const r = await ev(async () => { const f = document.querySelector('[data-a="filter"]'); if(f) f.click(); await new Promise(r => setTimeout(r, 600)); const h = document.querySelector('[data-f="hal"]'); return h ? [...h.options].map(o => o.textContent) : null; });
    check('D35b', '§5 Productdata 2.0: hal-filter alleen Hal A, B, C (C met gedeelte)', r && !r.some(t => /Hal D/.test(t)) && r.some(t => /Hal C/.test(t)), JSON.stringify(r));
  }
  /* ---------- Te doen op 390, 1440 en 2560 px ---------- */
  if(doe('D8')){
    const fouten = [];
    for(const [w, h] of [[390, 844], [1440, 900], [2560, 1300]]){
      await P.setViewportSize({ width:w, height:h });
      for(const t of ['overzicht', 'picklocaties', 'hercontrole', 'tewegen']){
        await laadTodo(t);
        const r = await ev(() => ({ h:document.documentElement.scrollWidth > innerWidth + 1, uit:[...document.querySelectorAll('#native *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1; }).length }));
        if(r.h || r.uit) fouten.push(t + '@' + w);
      }
    }
    await P.setViewportSize({ width:1440, height:900 });
    check('D8', '§2 Schermvullend: Te doen op 390, 1440 en 2560 px zonder horizontaal scrollen (volledig: schermvullend.js)', !fouten.length, fouten.join(','));
  }
  /* ---------- Containers ---------- */
  if(doe('D38') || doe('D39') || doe('D47')){
    await P.goto(B + 'containerplanning.html'); await wacht(5000);
    const ids = await ev(async () => { try{ const r = await (await fetch(WH_URL_TEST(), { headers:{ apikey:'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA' } })).json(); return r; }catch(e){ return []; } function WH_URL_TEST(){ return 'https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/containers?select=id,data&order=id.desc&limit=60'; } });
    const metKokos = (ids || []).filter(x => JSON.stringify(x.data || {}).includes('KOKOS200NAT')).map(x => x.id);
    let kok = '', deelFout = [];
    for(const id of metKokos.concat((ids || []).map(x => x.id).filter(x => !metKokos.includes(x)).slice(0, 2))){
      await P.goto(B + 'containerplanning.html#/c/' + id + '/verdeling'); await wacht(9000);
      const r = await ev(() => [...document.querySelectorAll('[id^="v-"]')].map(e => ({ c:e.id.slice(2), t:e.innerText.replace(/\s+/g, ' ') })));
      const k = r.find(x => x.c === 'KOKOS200NAT'); if(k && !kok) kok = k.t;
      r.filter(x => /productdata: Deel/.test(x.t) && /\d+× [^·→]*→ Picklocatie/.test(x.t)).forEach(x => deelFout.push(id + ':' + x.c));
    }
    if(doe('D39')) check('D39', '§7 Containers: voorraad op "geen specifieke locatie" telt niet als pick-voorraad (KOKOS200NAT nooit "pick is vol genoeg" door voorraad zonder plek)', kok && !/pick is vol genoeg/.test(kok) && /geen specifieke locatie telt niet mee|pick nu \d/.test(kok), kok.slice(0, 400) || 'KOKOS200NAT in geen container');
    if(doe('D47')){
      // Backorder → alleen de backorders, rest VST; Twijfel → bij lossen bepalen (productdata in het geheugen nagebootst voor KOKOS200NAT)
      const r = await ev(() => { try{ const T_ = window.CP_TEST, c = T_.cont().find(x => ((x.data && x.data.regels) || []).some(y => y.productcode === 'KOKOS200NAT')); if(!c) return null; const pool = T_.pools(c).map['KOKOS200NAT'], orig = PDBRON.cp;
        const met = so => { PDBRON.cp = code => code === 'KOKOS200NAT' ? Object.assign({}, orig(code) || { code }, { soort:so }) : orig(code); try{ return T_.adviesKern(c, pool, T_.leegEerder()); } finally { PDBRON.cp = orig; } };
        const bo = met('backorder'), tw = met('twijfel'); return { bo:{ uitleg:bo.uitleg, dest:bo.porties.map(x => x.dest + ':' + x.n) }, tw:{ uitleg:tw.uitleg, n:tw.porties.length } }; }catch(e){ return { fout:String(e) }; } });
      check('D47', '§3/§7 Containers: Backorder → alleen de backorders, rest VST; Twijfel → bij lossen bepalen', r && /Backorder → alleen de backorders/.test(r.bo.uitleg) && r.bo.dest.every(d => /^(BO|VST):/.test(d)) && /Twijfel — bij lossen bepalen/.test(r.tw.uitleg) && r.tw.n === 0, JSON.stringify(r));
    }
    if(doe('D38')) check('D38', '§7 Containers: Deel nooit een hele pallet naar pick (pick krijgt hele dozen of niets)', !deelFout.length, deelFout.join(','));
  }
  /* ---------- repo ---------- */
  const root = path.join(__dirname, '..', '..');
  if(doe('D6')){
    const files = execSync('git ls-files', { cwd:root }).toString().split('\n').filter(Boolean);
    const geheim = files.filter(f => !/\.(png|jpg|ico)$/.test(f) && !['test/pd2/daantoets.js', 'test/pd2/DAANTOETS.md'].includes(f)).filter(f => { try{ const s = fs.readFileSync(path.join(root, f), 'utf8'); return /service_role|sb_secret_[A-Za-z0-9]/.test(s); }catch(e){ return false; } });
    const exp = files.filter(f => /\.(xlsx|xls|csv)$/i.test(f));
    check('D6', '§1 Geen API-sleutels of bedrijfsdata-exports in de repo', !geheim.length && !exp.length, geheim.concat(exp).join(','));
  }
  if(doe('D41')){ const core = fs.readFileSync(path.join(root, 'wh', 'core.js'), 'utf8'); check('D41', '§9 Warehouse, Junior en Palletlabels blijven zoals ze zijn: productdata alleen in 3.0 en Test (schakelaar wh-pd-bron niet omgezet)', /const PD_APPS = \['test', 'ivol'\];/.test(core) && !T.writes.includes('wh-pd-bron'), ''); }
  /* ---------- schrijven: alles onderschept, productcode heilig ---------- */
  if(doe('D1')) check('D1', '§1 Picqer alleen lezen: 0 geblokkeerde schrijfpogingen, geen aanroep van het tussenstation', T.blocked.length === 0, JSON.stringify(T.blocked.slice(0, 3)));
  console.log('\nINFO ' + info.join('\nINFO '));
  console.log('ERRORS', T.errors.filter(e => !/Failed to load resource|locaties\.js/.test(e)).slice(0, 5).join('\n'));
  console.log(ok.length + ' OK, ' + fout.length + ' FOUT');
  if(fout.length) console.log('ROOD:\n' + fout.join('\n'));
  await T.b.close();
  if(fout.length) process.exit(1);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
