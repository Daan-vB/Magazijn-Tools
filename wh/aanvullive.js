/* =====================================================================
   IVOL Warehouse — Aanvuladvies live uit Picqer (Test, 7-10-2026)
   Picqer heeft geen aanvuladvies in de API, dus de app rekent het zelf uit, zoals Picqer:
     vrije pickvoorraad op of onder "aanvullen onder" en er staat voorraad op bulk → aanvullen tot "vul aan tot"
     plus wat picklijsten op bulk gereserveerd hebben (vrij = voorraad min gereserveerd voor picklijsten;
     aantal begrensd door de bulkvoorraad). Pick = elke locatie die geen bulk, kar of map is, ook losse namen
     als BE of Tafel-AA; de vrije pick is de som ("op de plank"). Picqer telt ook retourkar en "geen specifieke
     locatie" als pick; dat getal dient alleen om met de PDF te vergelijken. Map, losse naam en zonder locatie: aandachtspunten.
   Gegevens:
     wh-pq-cat     alle producten met voorraad: id, voorraad Hoofdmagazijn / VST   (1× per 12 uur, ±10 verzoeken)
     wh-pickstand  voorraad per locatie van de kandidaten (pick + bulk gekoppeld)   (alleen gewijzigde producten)
     niveaus       uit de Picqer-productexport (wh-pq: aanvullen onder / vul aan tot); ontbreekt het daar,
                   dan het niveau uit Picqer (wh-pickstand.niv, opgehaald bij de vergelijking)
   Tabs: 1 Voor orders (live backorders) · 2 Aanvulronde · 3 Van VST · Vergelijk met de PDF van Picqer.
   Alleen lezen: de app verplaatst niets in Picqer.
   ===================================================================== */
window.WHAL = (function(){
'use strict';
const { $, esc, nf, plural, D, isoDag, fdate, toast } = WH;
const MAG = 3857;
const S = { cat:null, st:null, geladen:false, bezig:false, stap:'', voortgang:0, fout:null, gang:'', laatsteRun:null };
const app = () => $('app');
const dd = n => String(n).padStart(2, '0');
// Picqer-tijd = Nederlandse tijd, "jjjj-mm-dd uu:mm:ss"
const pqNu = ms => { const d = new Date(ms || Date.now()); return isoDag(d) + ' ' + dd(d.getHours()) + ':' + dd(d.getMinutes()) + ':' + dd(d.getSeconds()); };
const uurOud = iso => iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : 1e9;
const isKar = l => l[3] === 1 || /^container\s*\d+$/i.test(String(l[0] || '').trim());
const gangVan = n => String(n || '').slice(0, 2).toUpperCase();
// pick = elke locatie die geen bulk, kar of map is (zoals Picqer). Map = bovenliggende locatie van andere locaties,
// of een gang-, sectie- of plaatsnaam (AD, AD04, AD04B) die in Picqer op tijdelijk staat. BE staat op vast: telt als pick.
// Standaardnaam = GANG (2 letters) SECTIE (2 cijfers) PLAATS (A–D) HOOGTE (2 cijfers); andere picknamen heten "losse naam".
const PICK_RX = /^[A-Z]{2}\d{2}[A-D]\d{2}$/i, MAP_RX = /^[A-Z]{2}(\d{2}[A-D]?)?$/i;
const LOS = 'Losse locaties';
let MAPS = null, mapsVan = null;
function mappen(){
  if(mapsVan !== D.LOC){
    MAPS = new Set();
    Object.values(D.LOC || {}).forEach(L => { if(L.parent) MAPS.add(L.parent); if(!L.bulk && L.tijd && MAP_RX.test(L.naam)) MAPS.add(L.naam); });
    mapsVan = D.LOC;
  }
  return MAPS;
}
const isMap = naam => mappen().has(String(naam || '').trim());
const isPick = naam => !isMap(naam);
const isStd = naam => PICK_RX.test(String(naam || '').trim()) && !isMap(naam);
// aanvulniveau: uit de productexport, anders het niveau uit Picqer dat bij de stand bewaard is
function niveau(code){
  const q = D.PQ[code] || [];
  if(q[0] !== null && q[0] !== undefined) return q;
  const n = S.st && S.st.niv && S.st.niv[code];
  return n ? [n[0], n[1], q[2] || 0, 'picqer'] : q;
}
const heeftNiv = q => q[0] !== null && q[0] !== undefined;
const minOud = iso => iso ? (Date.now() - new Date(iso).getTime()) / 6e4 : 1e9;
const OUD_MIN = 30;   // stand ouder dan dit en dicht bij het niveau: opnieuw ophalen

/* ---------- opslag ---------- */
async function laadOpslag(){
  if(S.geladen) return;
  try{
    const rows = window.WHC ? await WHC.catalog(['wh-pq-cat', 'wh-pickstand']) : await WH.api('GET', 'catalog?key=in.(%22wh-pq-cat%22,%22wh-pickstand%22)&select=key,data,updated_at');
    (rows || []).forEach(r => { if(r.key === 'wh-pq-cat') S.cat = r.data; if(r.key === 'wh-pickstand') S.st = r.data; });
  }catch(e){ S.fout = e; }
  S.geladen = true;
}

/* ---------- kandidaten: producten met een picklocatie én een bulklocatie (export) of bulkvoorraad (vorige keer) ---------- */
function locIndex(){
  const idx = {};
  Object.values(D.LOC || {}).forEach(L => (L.codes || []).forEach(c => {
    const x = idx[c] = idx[c] || { pick:0, bulk:0 };
    if(/^container\s*\d/i.test(L.naam)) return;
    if(L.bulk) x.bulk++; else if(isPick(L.naam)) x.pick++;
  }));
  return idx;
}
// metPdf: ook alle producten uit het ingelezen PDF-advies (bij het ophalen van de stand), zodat elk PDF-product
// een live stand heeft om mee te vergelijken. De aanvulronde zelf rekent met de gewone kandidaten.
const pdfCodes = () => (D.ADV && D.ADV.rows ? D.ADV.rows.map(r => D.PLOW[String(r.code).toLowerCase()] || r.code) : []);
function kandidaten(metPdf){
  if(!S.cat) return [];
  if(metPdf){ const k = kandidaten(), set = new Set(k); pdfCodes().forEach(c => { if(S.cat.ids && S.cat.ids[c] && !set.has(c)){ set.add(c); k.push(c); } }); return k; }
  const idx = locIndex(), st = (S.st && S.st.p) || {};
  return Object.keys(S.cat.ids || {}).filter(code => {
    if(!((S.cat.hm || {})[code] > 0)) return false;
    if((D.PQ[code] || [])[2] === 1) return false;                   // virtueel
    const vorig = st[code];
    const metPick = !!(vorig && vorig.l && vorig.l.some(l => l[2] === 0 && !isKar(l) && !isGeen(l) && isPick(l[0])));   // regel zonder naam = geen specifieke locatie (voorstel functie)
    // zonder niveau alleen als picklijsten voorraad op bulk gereserveerd hebben
    if(!heeftNiv(niveau(code))) return metPick && vorig.l.some(l => l[2] === 1 && l[5] > 0 && !isKar(l));
    const x = idx[code];
    if(x && x.pick && x.bulk) return true;
    return metPick && vorig.l.some(l => l[2] === 1 && l[4] > 0 && !isKar(l));
  });
}

/* ---------- bijwerken ---------- */
const V = (a, p) => WHLIVE.vraag(a, p);
const wacht = ms => new Promise(r => setTimeout(r, ms));
// rustig aan: hooguit ±250 Picqer-verzoeken per minuut, zodat Stockmove en Auto-assign van Maxime ruimte houden
async function rustig(t0, ms){ const w = ms - (Date.now() - t0); if(w > 0) await wacht(w); }
function stap(t, v){ S.stap = t; S.voortgang = v; teken(); }
async function bijwerken(alles){
  if(S.bezig) return;
  S.bezig = true; S.fout = null;
  const start = Date.now();
  try{
    await laadOpslag();
    // 1. producten met voorraad (id's en voorraad per magazijn), hooguit 1× per 12 uur
    if(alles || !S.cat || uurOud(S.cat.t) > 12){
      const cat = { t:new Date().toISOString(), ids:{}, hm:{}, vst:{}, abc:{}, pd:{} };
      for(let van = 0, klaar = false, n = 0; !klaar && van < 30000; van += 1000, n++){
        stap('Producten ophalen uit Picqer… ' + nf(van) , Math.min(0.3, n * 0.03));
        const t0 = Date.now();
        const r = await V('catalogus', { van });
        (r.rijen || []).forEach(([id, code, hm, vst, abc, pd]) => { cat.ids[code] = id; if(hm) cat.hm[code] = hm; if(vst) cat.vst[code] = vst; if(abc) cat.abc[code] = abc; if(pd) cat.pd[code] = pd; });
        klaar = r.klaar;
        if(!klaar) await rustig(t0, 2500);
      }
      S.cat = cat;
      await WH.catZet('wh-pq-cat', cat);
    }
    // 2. wie moet opnieuw: alles bij de eerste keer of na 20 uur, anders alleen producten met een voorraadmutatie
    const kand = kandidaten(true);
    const st = (S.st && S.st.p) ? S.st : { p:{} };
    let vernieuw = kand;
    const nieuweSinds = pqNu(start - 120000);
    if(!alles && st.sinds && uurOud(st.bijgewerkt) < 20){
      stap('Voorraadmutaties sinds ' + st.sinds.slice(11, 16) + ' ophalen…', 0.32);
      const m = await V('mutaties', { sinds:st.sinds });
      if(m.vol) vernieuw = kand;
            else {
        const gewijzigd = new Set(m.ids || []);
        const opLijst = new Set(ronde().uit.concat(ronde().leeg).map(r => r.code));
        const dichtOud = new Set(teOud());
        vernieuw = kand.filter(c => !st.p[c] || gewijzigd.has(S.cat.ids[c]) || opLijst.has(c) || dichtOud.has(c));
      }

    }
    // 3. voorraad per locatie, 50 producten per keer
    const ids = vernieuw.map(c => S.cat.ids[c]).filter(Boolean);
    const codeVan = {}; Object.entries(S.cat.ids).forEach(([c, id]) => codeVan[id] = c);
    for(let i = 0; i < ids.length; i += 50){
      stap('Voorraad per locatie: ' + nf(Math.min(i + 50, ids.length)) + ' / ' + nf(ids.length) + (ids.length > 100 ? ' (± ' + Math.ceil((ids.length - i) / 50 * 12 / 60) + ' min)' : ''), 0.35 + 0.6 * (i / Math.max(1, ids.length)));
      const t0 = Date.now();
      const r = await V('locaties', { ids:ids.slice(i, i + 50).join(',') });
      (r.lijst || []).forEach(([id, l]) => { const c = codeVan[id]; if(c && l) zetStand(st, c, r.opgehaald, l); });
      if(i + 50 < ids.length) await rustig(t0, 12000);
    }
    // niet-kandidaten die geen voorraad meer hebben opruimen
    const kSet = new Set(kand);
    Object.keys(st.p).forEach(c => { if(!kSet.has(c) && !((S.cat.hm || {})[c] > 0)) delete st.p[c]; });
    st.sinds = nieuweSinds; st.bijgewerkt = new Date().toISOString(); st.kandidaten = kand.length; st.vernieuwd = ids.length;
    S.st = st;
    stap('Opslaan…', 0.97);
    await WH.catZet('wh-pickstand', st);
    S.laatsteRun = { duur:Math.round((Date.now() - start) / 1000), vernieuwd:ids.length, kandidaten:kand.length };
  }catch(e){ S.fout = e; }
  S.bezig = false; S.stap = ''; teken();
}

// nieuwe stand bewaren; de vorige blijft als o (oud) bewaard, zodat "veranderd sinds de PDF" aan te tonen is
function zetStand(st, c, t, l){
  const oud = st.p[c];
  st.p[c] = { t, l };
  if(oud && oud.l && oud.t && oud.t < t) st.p[c].o = { t:oud.t, l:oud.l };
}

/* ---------- rekenen ---------- */
// "geen specifieke locatie": rij zonder naam in de stand; zit die er niet in (de functie levert alleen locaties),
// dan uit de voorraad-per-locatie-export (D.VR[code].geen, zonder reserveringen)
const isGeen = l => !String(l[0] || '').trim() || /^geen specifieke locatie$/i.test(String(l[0]).trim());
function geenVan(hm, code){
  const g = hm.filter(isGeen);
  if(g.length) return { n:g.reduce((t, l) => t + l[4], 0), r:g.reduce((t, l) => t + (l[5] || 0), 0), bron:'live' };
  const v = code && D.VR && D.VR[code];
  return v && v.geen > 0 ? { n:v.geen, r:0, bron:'export', datum:D.VRDATUM } : null;
}
function standVan(p, code){
  const hm = p.l.filter(l => l[1] == null || Number(l[1]) === MAG);
  const eigen = hm.filter(l => l[2] === 0 && !isKar(l) && !isGeen(l));
  // standaardnamen eerst, dan losse namen
  const pick = eigen.filter(l => isPick(l[0])).sort((a, b) => (isStd(b[0]) ? 1 : 0) - (isStd(a[0]) ? 1 : 0)), map = eigen.filter(l => isMap(l[0]) && l[4] > 0);
  const los = pick.filter(l => !isStd(l[0]) && l[4] > 0);
  const bulk = hm.filter(l => l[2] === 1 && !isKar(l) && l[4] > 0).sort((a, b) => b[4] - a[4]);
  const kar = hm.filter(l => isKar(l) && l[4] > 0);
  const geen = geenVan(hm, code);
  const pickVrij = pick.reduce((s, l) => s + Math.max(0, l[4] - l[5]), 0), karVrij = kar.reduce((s, l) => s + Math.max(0, l[4] - (l[5] || 0)), 0);
  // pickVrij = pick op de plank (daar rekent de app mee); pqVrij = pick volgens Picqer: ook retourkar en zonder locatie
  return { t:p.t, pick, bulk, kar, map, los, geen, std:pick.find(l => isStd(l[0])) || null,
    pickFys:pick.reduce((s, l) => s + l[4], 0), pickVrij, karVrij, pqVrij:pickVrij + karVrij + (geen ? Math.max(0, geen.n - geen.r) : 0),
    bulkV:bulk.reduce((s, l) => s + l[4], 0), bulkRes:bulk.reduce((s, l) => s + (l[5] || 0), 0), karV:kar.reduce((s, l) => s + l[4], 0) };
}
// wat Picqer naast de plank als pick telt, als tekst: "46 zonder locatie", "43 op retourkar Container 2"
const extraTxt = s => [s.geen ? nf(s.geen.n) + ' zonder locatie' + (s.geen.bron === 'export' ? ' (volgens export van ' + standTxt(tijdMs(s.geen.datum)) + ')' : '') : '',
  s.kar.length ? nf(s.karV) + ' op retourkar ' + s.kar.map(l => l[0]).join(', ') : ''].filter(Boolean).join(' en ');
// Picqer adviseert niets omdat het kar of zonder-locatie als pick telt, terwijl de plank wel aangevuld moet worden
const picqerSlaatOver = (s, lvl, tot) => s.pqVrij > s.pickVrij && !nodigAanvul(Object.assign({}, s, { pickVrij:s.pqVrij }), lvl, tot);
function stand(code){
  const p = S.st && S.st.p && S.st.p[code]; if(!p) return null;
  return standVan(p, code);
}
// de stand van vóór de laatste keer ophalen (of null)
function vorigeStand(code){
  const p = S.st && S.st.p && S.st.p[code];
  return p && p.o ? standVan(p.o, code) : null;
}
// zoals Picqer: aanvullen bij vrije pick op of onder het niveau, of als picklijsten meer op bulk gereserveerd hebben
// dan er vrij op pick ligt. Aantal = vul aan tot + gereserveerd op bulk − vrij (begrensd door de bulk, in ronde()).
function nodigAanvul(s, lvl, tot){
  const met = lvl !== null && lvl !== undefined;
  if(!(met && s.pickVrij <= lvl) && !(s.pickVrij < s.bulkRes)) return 0;
  return Math.max(0, (met ? Math.max(tot || 0, lvl) : 0) + s.bulkRes - s.pickVrij);
}
function ronde(){
  const nuCodes = new Set((window.WHLIVE ? WHLIVE.nuLijst() : []).map(m => m.code));
  const uit = [], leeg = [];
  const inPdf = new Set(pdfCodes());   // staat hij in de PDF, dan slaat Picqer hem niet over (export kan verouderd zijn)
  kandidaten().forEach(code => {
    const s = stand(code); if(!s || !s.pick.length) return;
    const [lvl, tot, , nivBron] = niveau(code);
    const nodig = nodigAanvul(s, lvl, tot);
    if(!nodig) return;
    const naam = (D.P[code] || {}).naam || '';
    if(!s.bulk.length){ leeg.push({ code, naam, s, lvl, tot }); return; }
    uit.push({ code, naam, s, lvl, tot, nivBron:nivBron || '', aantal:Math.min(s.bulkV, nodig), gang:s.std ? gangVan(s.std[0]) : LOS, voorOrders:nuCodes.has(code),
      pqOver:!inPdf.has(code) && picqerSlaatOver(s, lvl, tot) ? extraTxt(s) : '' });
  });
  // looproute op de eerste standaardnaam; alleen losse namen achteraan
  uit.sort((a, b) => (a.s.std ? 0 : 1) - (b.s.std ? 0 : 1) || (a.s.std ? WHL.sortLoc(a.s.std[0], b.s.std[0]) : String(a.s.pick[0][0]).localeCompare(String(b.s.pick[0][0]))));
  // aandachtspunt: voorraad op een map (geen echte picklocatie), telt niet als pick
  const opMap = Object.keys((S.st && S.st.p) || {}).map(code => ({ code, s:stand(code) })).filter(x => x.s && x.s.map.length)
    .map(x => ({ code:x.code, naam:(D.P[x.code] || {}).naam || '', s:x.s })).sort((a, b) => String(a.s.map[0][0]).localeCompare(String(b.s.map[0][0])) || a.code.localeCompare(b.code));
  // aandachtspunt voor de locatieronde: voorraad op een losse naam (telt wel als pick)
  const losse = Object.keys((S.st && S.st.p) || {}).map(code => ({ code, s:stand(code) })).filter(x => x.s && x.s.los.length)
    .map(x => ({ code:x.code, naam:(D.P[x.code] || {}).naam || '', s:x.s })).sort((a, b) => String(a.s.los[0][0]).localeCompare(String(b.s.los[0][0])) || a.code.localeCompare(b.code));
  return { uit, leeg, opMap, losse };
}
// kandidaten dicht bij hun niveau (vrije pick ≤ 2× niveau) met een stand ouder dan 30 minuten
function teOud(){
  if(!S.st || !S.st.p) return [];
  return kandidaten().filter(c => {
    const p = S.st.p[c]; if(!p) return false;
    const lvl = niveau(c)[0];
    if(lvl === null || lvl === undefined || minOud(p.t) <= OUD_MIN) return false;
    return stand(c).pickVrij <= 2 * lvl;
  });
}
// orders die niet compleet zijn met voorraad hier, maar wel met VST
function vanVst(){
  const L = window.WHLIVE ? WHLIVE.status() : null;
  if(!L || !L.data || !S.cat) return null;
  const codeVan = {}; Object.entries(S.cat.ids).forEach(([c, id]) => codeVan[id] = c);
  const B = WHLIVE.backorderCijfers(L.data.backorders);
  const rest = Object.assign({}, S.cat.vst || {});
  const per = {}, orders = [];
  B.orderLijst.filter(o => !o.vol).forEach(o => {
    const kort = o.regels.filter(r => !r.hp && r.v < r.a);
    const kan = kort.every(r => { const c = codeVan[r.p]; return c && (rest[c] || 0) >= r.a - r.v; });
    if(!kan || !kort.length) return;
    orders.push(o.o);
    kort.forEach(r => {
      const c = codeVan[r.p], nodig = r.a - r.v;
      rest[c] -= nodig;
      const x = per[c] = per[c] || { code:c, naam:(D.P[c] || {}).naam || '', nodig:0, orders:[], oudste:o.oudste, vst:(S.cat.vst || {})[c] || 0 };
      x.nodig += nodig; x.orders.push(o.o); if(o.oudste < x.oudste) x.oudste = o.oudste;
    });
  });
  return { producten:Object.values(per).sort((a, b) => String(a.oudste).localeCompare(String(b.oudste))), orders };
}
// vergelijken met het laatst ingelezen PDF-advies van Picqer. De PDF bevat alles wat Picqer adviseert,
// dus vergelijken met Voor orders + Aanvulronde samen (staat een product in beide, dan telt de aanvulronde)
function appAdvies(R){
  const m = new Map();
  R.uit.forEach(r => m.set(r.code, { code:r.code, aantal:r.aantal, bron:'ronde', r }));
  (window.WHLIVE ? WHLIVE.nuLijst() : []).forEach(x => { if(!m.has(x.code)) m.set(x.code, { code:x.code, aantal:x.verpl, bron:'orders', n:x }); });
  return m;
}
function vergelijk(R){
  if(!D.ADV || !D.ADV.rows) return null;
  const pdf = new Map(D.ADV.rows.map(r => [D.PLOW[String(r.code).toLowerCase()] || r.code, r]));
  const app = appAdvies(R);
  const alleenPdf = [...pdf.keys()].filter(c => !app.has(c)).map(c => ({ code:c, pdf:pdf.get(c), s:stand(c), kand:!!(S.st && S.st.p && S.st.p[c]) }));
  const alleenLive = [...app.values()].filter(a => !pdf.has(a.code));
  const beide = [...app.values()].filter(a => pdf.has(a.code)).map(a => ({ code:a.code, a, r:a.r || null, pdf:pdf.get(a.code) }));
  return { datum:D.ADV.datum || D.ADV.ingelezen, alleenPdf, alleenLive, beide, nPdf:pdf.size };
}

/* ---------- PDF en live naast elkaar: elk verschil een reden ----------
   Eerlijk vergelijken kan alleen met een stand van ná de PDF, per product. Een verschil is pas verklaard
   als er een concrete reden bij staat; alleen onverklaard is werk. */
const tijdMs = t => { if(!t) return null; const d = new Date(t); return isNaN(d) ? null : d.getTime(); };
const hhmm = ms => ms == null ? '–' : new Date(ms).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit', hour12:false });
const standTxt = ms => ms == null ? '–' : isoDag(new Date(ms)) === isoDag() ? hhmm(ms) : new Date(ms).toLocaleString('nl-NL', { day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit', hour12:false });
function momenten(){
  const pdfT = D.ADV ? tijdMs(D.ADV.datum || D.ADV.ingelezen) : null;
  const st = S.st || {};
  const L = window.WHLIVE ? WHLIVE.status() : null;
  const standT = c => { const p = st.p && st.p[c]; return p ? tijdMs(p.t) : null; };
  return { pdfT, ordersT:L && L.data ? L.data.binnen : null, liveT:tijdMs(st.bijgewerkt), standT, vers:c => pdfT != null && (standT(c) || 0) >= pdfT };
}
// aanvulniveau zoals Picqer het nu heeft (opgehaald bij het verversen voor de vergelijking):
// [onder, tot] · null = opgehaald, Picqer heeft er geen · undefined = nog niet opgehaald
const niveauPicqer = c => { const n = S.st && S.st.pdfStand && S.st.pdfStand.niv; return n && Object.prototype.hasOwnProperty.call(n, c) ? n[c] : undefined; };
const nivTxt = (a, b) => nf(a) + ' / ' + nf(b);
const opMapTxt = s => s && s.map.length ? s.map.map(l => nf(l[4]) + ' op map ' + l[0]).join(', ') : '';
const verschiltNiv = (c, lvl, tot) => { const n = niveauPicqer(c); return n && (Number(n[0]) !== Number(lvl) || Number(n[1]) !== Number(tot)) ? n : null; };
// de Pickvoorraad in de PDF is de fysieke voorraad op pick (bueno-bruin: PDF 33, vrij 3)
const pickVeranderd = (pdf, s) => pdf.pickst != null && Number(pdf.pickst) !== s.pickFys;
// met de retourkar erbij zit de pick boven het niveau (de app telt de kar nooit als pick of bron)
const oudTxt = (c, M) => 'De stand van dit product is van ' + standTxt(M.standT(c)) + ', ouder dan de PDF (' + hhmm(M.pdfT) + '): eerst verversen';
// rekensom van de app: pick vrij, niveau, aanvullen tot, gereserveerd op bulk, bulk beschikbaar
function somTekst(s, lvl, tot, aantal){
  if(!s) return '';
  const met = lvl !== null && lvl !== undefined, res = s.bulkRes || 0;
  const bulk = 'bulk heeft ' + nf(s.bulkV) + (res ? ' (' + nf(res) + ' gereserveerd)' : '');
  if(!met && !res) return 'Pick vrij ' + nf(s.pickVrij) + ', geen aanvulniveau: de app vult niet aan';
  const nodig = nodigAanvul(s, lvl, tot);
  if(!nodig) return 'Pick vrij ' + nf(s.pickVrij) + (met ? ', niveau ' + nf(lvl) : '') + (met && s.pickVrij > lvl ? ' (erboven)' : '') + ' → de app vult niet aan';
  const tot2 = met ? Math.max(tot || 0, lvl) : 0;
  return 'Pick vrij ' + nf(s.pickVrij) + (met ? ', niveau ' + nf(lvl) + ', aanvullen tot ' + nf(tot2) : '') + (res ? ' + ' + nf(res) + ' gereserveerd op bulk' : '') + ' → aanvullen ' + nf(nodig) + '; ' + bulk + ' → app ' + nf(Math.min(s.bulkV, nodig));
}
// hoeveel producten met pick gelijk aan het niveau staan wél in de PDF: Picqer adviseert dus ook bij gelijk
const gelijkInPdf = () => { const C = vergelijk(ronde()); return C ? C.beide.filter(b => b.a.r && b.pdf.pickst != null && Number(b.pdf.pickst) === Number(b.a.r.lvl)).length : 0; };
// pick fysiek op het moment van de voorraadlijst (vóór de PDF); null als die er niet is
function fysToen(c, s){
  const vr = D.VR && D.VR[c]; if(!vr || !s.pick.length) return null;
  const t = tijdMs(D.VRDATUM), pdfT = D.ADV ? tijdMs(D.ADV.datum || D.ADV.ingelezen) : null;
  if(t == null || pdfT == null || t > pdfT) return null;
  return s.pick.reduce((sum, l) => sum + (vr.locs[l[0]] || 0), 0);
}
function bulkToen(c, s){
  const vr = D.VR && D.VR[c]; if(!vr || !s.bulk.length) return null;
  return s.bulk.reduce((sum, l) => sum + (vr.locs[l[0]] || 0), 0);
}
function redenPdf(x, M){
  const c = x.code, q = niveau(c), lvl = q[0], tot = q[1], pdf = x.pdf || {}, s = stand(c);
  const opMap = opMapTxt(s), pn = niveauPicqer(c);
  if(pdf.geenPick || (pdf.pick && !pdf.pick.length)) return { r:'Geen vaste picklocatie: Picqer adviseert dit voor orders, de app zet het bij Voor orders' + (opMap ? ' (' + opMap + '; een map telt niet als pick)' : '') + (!heeftNiv(q) ? '; de app heeft geen aanvulniveau' : ''), ok:true };
  if(!S.cat || !S.cat.ids || !S.cat.ids[c]) return { r:'Er is geen voorraad meer in het Hoofdmagazijn', ok:true };
  if(!s) return { r:'Nog geen stand van dit product: eerst verversen', ok:false };
  if(!M.vers(c)) return { r:oudTxt(c, M), ok:false };
  if(!s.pick.length) return { r:opMap ? 'De pick staat op een map (' + opMap + '); een map telt niet als picklocatie' : 'Picqer heeft geen picklocatie meer voor dit product (de PDF noemde ' + (pdf.pick || []).join(', ') + ')', ok:true };
  if(!heeftNiv(q) && !s.bulkRes){
    if(pn === null) return { r:'Er is geen aanvulniveau, ook niet in Picqer, en niets op bulk gereserveerd: Picqer adviseert dit voor orders, dus het hoort bij Voor orders', ok:true };
    return { r:'De app heeft geen aanvulniveau en het niveau in Picqer is nog niet opgehaald: eerst verversen', ok:false };
  }
  const n = verschiltNiv(c, lvl, tot);
  if(n) return { r:'Het aanvulniveau is anders: app ' + nivTxt(lvl, tot) + ', Picqer ' + nivTxt(n[0], n[1]), ok:true };
  if(!nodigAanvul(s, lvl, tot)){
    // de verse stand toont het: nu meer op pick dan in de PDF
    if(pdf.pickst != null && s.pickFys > pdf.pickst) return { r:'Inmiddels aangevuld: pick was ' + nf(pdf.pickst) + ' (PDF), nu ' + nf(s.pickFys) + ' (stand van ' + standTxt(M.standT(c)) + ')', ok:true };
    if(pickVeranderd(pdf, s)) return { r:'De voorraad is veranderd sinds de PDF: pick was ' + nf(pdf.pickst) + ', nu ' + nf(s.pickFys), ok:true };
    return { r:'Onverklaard: pick vrij ' + nf(s.pickVrij) + ' ligt boven het niveau ' + nf(lvl) + ' en de pick (' + nf(s.pickFys) + ') is nog zoals in de PDF', ok:false };
  }
  if(!s.bulk.length){
    const bulkPdf = (pdf.bulk || []).filter(Boolean);
    return { r:bulkPdf.length ? 'Er ligt niets meer op bulk (de PDF noemde nog ' + bulkPdf.slice(0, 2).join(', ') + '): niets om aan te vullen' : 'De pick is onder het niveau, maar er ligt niets op bulk', ok:true };
  }
  if(!kandidaten().includes(c)) return { r:'Niet in de aanvulronde: pick en bulk staan niet allebei gekoppeld in de locatielijst', ok:false };
  return { r:'Onverklaard: de app zou aanvullen maar neemt dit product niet op', ok:false };
}
// zonder locatie en retourkar als gewone zin (de Aanvulronde-tab houdt zijn eigen extraTxt)
const extraVg = s => [s.geen ? nf(s.geen.n) + ' zonder locatie' + (s.geen.bron === 'export' ? ' (telling van ' + standTxt(tijdMs(s.geen.datum)) + ')' : '') : '', s.kar.length ? nf(s.karV) + ' op retourkar ' + s.kar.map(l => l[0]).join(', ') : ''].filter(Boolean).join(' en ');
const extraZin = (g, kar, st) => [g ? nf(g.n) + ' zonder locatie' + (g.bron === 'export' ? ' (telling van ' + standTxt(tijdMs(g.datum)) + ')' : '') : '', kar ? nf(kar) + ' op retourkar ' + st.kar.map(l => l.n).join(', ') : ''].filter(Boolean).join(' en ');
function redenLive(a, M){
  const c = a.code;
  if(a.bron === 'orders'){
    if(M.pdfT == null || M.ordersT == null || M.ordersT < M.pdfT) return { r:'De orders van ' + standTxt(M.ordersT) + ' zijn ouder dan de PDF: eerst verversen', ok:false };
    const oudste = tijdMs(a.n.datum);
    if(oudste != null && oudste > M.pdfT) return { r:'Voor orders: order na de PDF (' + standTxt(oudste) + ')', ok:true };
    // live stand van het product (Picqer live): ligt er genoeg op de retourkar, dan adviseert Picqer niets
    const rij = window.WHLIVE && WHLIVE.rijen ? WHLIVE.rijen().find(x => x.p && x.p.code === c) : null, st = rij && rij.st;
    const kar = st ? st.kar.reduce((t, l) => t + Math.max(0, l.v - (l.r || 0)), 0) : 0;
    const g = geenVan([], c), geen = g ? g.n : 0;
    if(st && (kar || geen) && st.pickVrij + kar + geen >= a.n.stuks) return { r:'Er liggen ' + extraZin(g, kar, st) + '; Picqer telt die als pick en adviseert niets, de app niet (pick op de plank ' + nf(st.pickVrij) + '). De app verplaatst wat de orders vragen: ' + nf(a.aantal), ok:true };
    return { r:'Onverklaard: de app verplaatst ' + nf(a.aantal) + ' voor orders, Picqer adviseert niets' + (st ? ' (pick vrij ' + nf(st.pickVrij) + ', bulk ' + nf(st.bulkV) + ')' : ''), ok:false };
  }
  const r = a.r, s = r.s;
  if(!M.vers(c)) return { r:oudTxt(c, M), ok:false };
  const n = verschiltNiv(c, r.lvl, r.tot);
  if(n) return { r:'Het aanvulniveau is anders: app ' + nivTxt(r.lvl, r.tot) + ', Picqer ' + nivTxt(n[0], n[1]), ok:true };
  // aangetoond gedaald: een stand van ná de PDF stond nog boven het niveau, de nieuwste niet meer
  const v = vorigeStand(c), vT = v ? tijdMs(v.t) : null;
  if(v && vT >= M.pdfT && !nodigAanvul(v, r.lvl, r.tot)) return { r:'De voorraad is gedaald na de PDF: om ' + standTxt(vT) + ' was vrij ' + nf(v.pickVrij) + ', nu ' + nf(s.pickVrij) + ' (niveau ' + nf(r.lvl) + ')', ok:true };
  if(picqerSlaatOver(s, r.lvl, r.tot)) return { r:'Er liggen ' + extraVg(s) + '; Picqer telt die als pick, de app niet (pick op de plank ' + nf(s.pickVrij) + ', niveau ' + nf(r.lvl) + ')', ok:true };
  // Picqer rekent met de vrije pick (fysiek min gereserveerd). Lag de pick bij de PDF (export van 17:06) even hoog als nu en stond hij toen
  // boven het niveau, dan is het advies pas ontstaan doordat er daarna iets voor een order op de pick is gereserveerd
  const resPick = s.pick.reduce((t, l) => t + (l[5] || 0), 0), toen = fysToen(c, s);
  if(r.lvl != null && resPick > 0 && s.pickVrij <= r.lvl && s.pickFys > r.lvl && toen !== null && toen === s.pickFys)
    return { r:'Er is na de PDF ' + nf(resPick) + ' op de pick gereserveerd voor een order: de pick ligt op ' + nf(s.pickFys) + ' (zoals bij de PDF, boven het niveau ' + nf(r.lvl) + ') maar vrij is nu ' + nf(s.pickVrij) + ' = niveau, dus vult de app aan. Picqer rekent ook met vrij en zag bij de PDF nog ' + nf(s.pickFys) + ' vrij', ok:true };
  if(r.lvl != null && s.pickVrij === r.lvl) return { r:'Onverklaard: pick vrij ' + nf(s.pickVrij) + ' is gelijk aan het niveau en dit product staat niet in de PDF (' + plural(gelijkInPdf(), 'ander product met pick gelijk aan het niveau staat', 'andere producten met pick gelijk aan het niveau staan') + ' wel in de PDF)', ok:false };
  return { r:'Onverklaard: pick vrij ' + nf(s.pickVrij) + ' onder het niveau ' + nf(r.lvl) + ', bulk ' + nf(s.bulkV) + ', en niet in de PDF', ok:false };
}
// in beide, maar een ander aantal
function redenAantal(b, M){
  const c = b.code, a = b.a, pdf = b.pdf;
  if(Number(pdf.aantal) === Number(a.aantal)) return null;
  if(a.bron === 'orders') return { r:'Voor orders: de app verplaatst wat de orders vragen (' + nf(a.aantal) + '), Picqer vult aan tot het niveau (' + nf(pdf.aantal) + ')', ok:true };
  const r = a.r, s = r.s;
  if(!M.vers(c)) return { r:oudTxt(c, M), ok:false };
  if(pickVeranderd(pdf, s)) return { r:'De voorraad is veranderd sinds de PDF: pick was ' + nf(pdf.pickst) + ', nu ' + nf(s.pickFys), ok:true };
  const n = verschiltNiv(c, r.lvl, r.tot);
  if(n) return { r:'Het aanvulniveau is anders: app ' + nivTxt(r.lvl, r.tot) + ', Picqer ' + nivTxt(n[0], n[1]), ok:true };
  // Picqer telt zonder locatie en retourkar als pick: dan is het te vullen aantal kleiner dan de app (die alleen de plank telt)
  if(s.pqVrij > s.pickVrij){
    const nPq = nodigAanvul(Object.assign({}, s, { pickVrij:s.pqVrij }), r.lvl, r.tot), verwacht = Math.min(s.bulkV, nPq);
    if(verwacht === Number(pdf.aantal)) return { r:'Er ligt ' + extraVg(s) + '; Picqer telt dat als pick (' + nf(s.pqVrij) + ' in plaats van ' + nf(s.pickVrij) + ' op de plank) en adviseert ' + nf(pdf.aantal) + ', de app telt alleen de plank en adviseert ' + nf(a.aantal), ok:true };
  }
  if(a.aantal === s.bulkV && a.aantal < nodigAanvul(s, r.lvl, r.tot)) return { r:'Er ligt maar ' + nf(s.bulkV) + ' op bulk; de app adviseert nooit meer dan er ligt', ok:true };
  const d = Number(pdf.aantal) - Number(a.aantal);
  // niets veranderd in niveau, pick en bulk sinds de PDF en de PDF zit hoger dan de som: de enige term die dan kan verschillen is wat toen op bulk gereserveerd stond
  if(d > 0 && !s.bulkRes && niveauPicqer(c) !== undefined && fysToen(c, s) === s.pickFys && bulkToen(c, s) === s.bulkV)
    return { r:'De PDF telde ' + nf(d) + ' meer dan de som. Niveau (' + nivTxt(r.lvl, r.tot) + '), pick (' + nf(s.pickFys) + ') en bulk (' + nf(s.bulkV) + ') zijn sinds de PDF gelijk gebleven, dus dat moet ' + nf(d) + ' stuk(s) zijn dat toen op bulk gereserveerd stond voor een order (Picqer telt dat erbij) en nu niet meer: de order is na de PDF (' + hhmm(M.pdfT) + ') vervallen of aangepast', ok:true };
  return { r:'Onverklaard: zelfde pick (' + nf(s.pickFys) + ') en niveau, maar de PDF zegt ' + nf(pdf.aantal) + ' en de app ' + nf(a.aantal) + (d > 0 ? '. De PDF zit ' + nf(d) + ' hoger dan de som; dat past bij ' + nf(d) + ' stuks die toen op bulk gereserveerd stonden voor een order en nu niet meer. Dat is uit de gegevens niet meer te bewijzen: verversen en kijken of er nu iets gereserveerd staat' : ''), ok:false };
}
function uitleg(R){
  R = R || (S.st && S.st.p ? ronde() : null);
  if(!R) return null;
  const C = vergelijk(R); if(!C) return null;
  const M = Object.assign(momenten(), { idx:locIndex() });
  const rijen = C.alleenPdf.map(x => Object.assign({ code:x.code, soort:'pdf', x }, redenPdf(x, M)))
    .concat(C.alleenLive.map(a => Object.assign({ code:a.code, soort:'live', x:a }, redenLive(a, M))))
    .concat(C.beide.map(b => { const r = redenAantal(b, M); return r ? Object.assign({ code:b.code, soort:'beide', x:b }, r) : null; }).filter(Boolean));
  const verklaard = rijen.filter(r => r.ok).length;
  // pas vergelijken als de stand van alle PDF- en alleen-live-producten van ná de PDF is
  const nodig = [...new Set(C.alleenPdf.map(x => x.code).concat(C.beide.map(b => b.code), C.alleenLive.filter(a => a.bron === 'ronde').map(a => a.code)))]
    .filter(c => S.cat && S.cat.ids && S.cat.ids[c]);
  const oud = nodig.filter(c => !M.vers(c));
  const ordersOud = C.alleenLive.concat(C.beide.map(b => b.a)).some(a => a.bron === 'orders') && !(M.ordersT >= M.pdfT);
  // PDF-producten zonder niveau in de app: eerst het niveau in Picqer ophalen
  const zonderNiv = C.alleenPdf.filter(x => S.cat && S.cat.ids && S.cat.ids[x.code] && !(x.pdf.geenPick || (x.pdf.pick && !x.pdf.pick.length)) && !heeftNiv(niveau(x.code)) && niveauPicqer(x.code) === undefined).length;
  return { C, M, rijen, verschillen:rijen.length, verklaard, onverklaard:rijen.length - verklaard, oud, nodig:nodig.length,
    teOud:M.pdfT == null ? null : oud.length ? 'Stand van ' + plural(oud.length, 'product', 'producten') + ' ouder dan de PDF (' + hhmm(M.pdfT) + ') — eerst verversen'
      : ordersOud ? 'Orders ouder dan de PDF — eerst verversen' : zonderNiv ? 'Aanvulniveau in Picqer van ' + plural(zonderNiv, 'product', 'producten') + ' nog niet opgehaald — eerst verversen' : null };
}
// stand van alle PDF-producten en alle alleen-live-producten nu ophalen (alleen lezen in Picqer),
// met hun aanvulniveau in Picqer; na het inlezen van een nieuwe PDF en met de knop
async function verversPdf(adv){
  if(adv) D.ADV = adv;
  if(!window.WHLIVE || !WHLIVE.status().code) return false;
  await laadOpslag();
  if(!S.cat || !S.cat.ids || S.bezig) return false;
  S.bezig = true; S.fout = null;
  const st = (S.st && S.st.p) ? S.st : { p:{} };
  S.st = st;
  const codeVan = {}; Object.entries(S.cat.ids).forEach(([c, id]) => codeVan[id] = c);
  const gehaald = new Set(), niv = {};
  let oudeFunctie = false;
  const alleenLive = () => { const C = vergelijk(ronde()); return C ? C.alleenLive.map(a => a.code) : []; };
  async function haal(codes){
    codes = [...new Set(codes)].filter(c => S.cat.ids[c] && !gehaald.has(c));
    const ids = codes.map(c => S.cat.ids[c]);
    for(let i = 0; i < ids.length; i += 50){
      stap('Stand voor de vergelijking: ' + nf(gehaald.size + Math.min(i + 50, ids.length)) + ' producten…', 0.5);
      const t0 = Date.now();
      const r = await V('locaties', { ids:ids.slice(i, i + 50).join(',') });
      (r.lijst || []).forEach(([id, l]) => { const c = codeVan[id]; if(c && l) zetStand(st, c, r.opgehaald, l); });
      if(i + 50 < ids.length) await rustig(t0, 12000);
    }
    codes.forEach(c => gehaald.add(c));
    // aanvulniveaus in Picqer (functie: niveaus); oude functie zonder deze actie: overslaan
    if(oudeFunctie) return;
    try{
      for(let i = 0; i < ids.length; i += 60){
        const t0 = Date.now();
        const r = await V('niveaus', { ids:ids.slice(i, i + 60).join(',') });
        (r.lijst || []).forEach(([id, w]) => { const c = codeVan[id]; if(c) niv[c] = w && w[0] != null ? [w[0], w[1]] : null; });
        if(i + 60 < ids.length) await rustig(t0, 12000);
      }
    }catch(e){ if(/Onbekende actie/i.test(String(e && e.message))) oudeFunctie = true; else throw e; }
  }
  // niveau uit Picqer bewaren voor producten zonder niveau in de productexport (ook voor de volgende ronde)
  const zetNiv = () => { st.niv = st.niv || {}; Object.entries(niv).forEach(([c, w]) => { if(w && !heeftNiv(D.PQ[c] || [])) st.niv[c] = w; else delete st.niv[c]; }); };
  try{
    await haal(pdfCodes().concat(alleenLive()));
    zetNiv();
    await haal(alleenLive());      // met de nieuwe stand en niveaus kan de ronde veranderen: die producten ook vers
    zetNiv();
    st.pdfStand = { t:new Date().toISOString(), adv:D.ADV ? (D.ADV.ingelezen || D.ADV.datum) : null, n:gehaald.size, niv };
    stap('Opslaan…', 0.97);
    await WH.catZet('wh-pickstand', st);
  }catch(e){ S.fout = e; }
  S.bezig = false; S.stap = '';
  teken();
  return !S.fout;
}

/* ---------- scherm ---------- */
const locs = (ls, i) => ls.map(l => `<span class="loc">${esc(l[0])}</span> <span class="small">${nf(i === 'vrij' ? Math.max(0, l[4] - l[5]) : l[4])}</span>`).join('<br>');
// pickkolom: vrije voorraad per locatie, met een label bij een losse naam (geen standaardnaam)
const pickLocs = ls => ls.map(l => `<span class="loc">${esc(l[0])}</span> <span class="small">${nf(Math.max(0, l[4] - l[5]))}</span>${isStd(l[0]) ? '' : ' <span class="badge b-grey">losse naam</span>'}`).join('<br>');
const tijdTxt = iso => iso ? new Date(iso).toLocaleString('nl-NL', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '–';
// BASE = '#/aanvullen' (Warehouse) of '#/aanvullive' (Test); in Test ook "alles opnieuw" en Vergelijk
let BASE = '#/aanvullive';
const isTest = () => BASE === '#/aanvullive';
function kop(tab, R, V){
  const st = S.st || {};
  const L = window.WHLIVE ? WHLIVE.status() : null;
  const nNu = window.WHLIVE ? WHLIVE.nuLijst().length : 0;
  const t = (k, l, n) => `<a class="tab ${tab === k ? 'on' : ''}" href="${BASE}/${k}">${esc(l)} <span class="nr">${n == null ? '…' : nf(n)}</span></a>`;
  const bron = [L && L.data ? 'orders ' + new Date(L.data.binnen).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }) : null,
    st.bijgewerkt ? 'aanvulronde ' + tijdTxt(st.bijgewerkt) : null].filter(Boolean).join(' · ');
  return `<div class="card noprint"><div class="row wrap between"><div><h2>${isTest() ? 'Aanvuladvies live' : 'Aanvullen'}</h2>
      <div class="small muted">Live uit Picqer, alleen lezen${bron ? ' · ' + esc(bron) : ''}. Verplaatsen doe je in Picqer; daarna <b>Ververs</b> en wat klaar is verdwijnt van de lijst.</div></div>
      <div class="row">${S.bezig ? '' : `<button class="btn pri" data-al="ververs">Ververs</button>${isTest() ? '<button class="btn sm ghost" data-al="alles" title="Alle producten opnieuw ophalen">alles opnieuw</button>' : ''}`}</div></div>
    ${S.bezig ? `<div class="mt8"><div class="small"><b>${esc(S.stap)}</b></div><div class="ab-voortgang" style="text-align:left;min-width:0"><div class="balk"><i style="width:${Math.round(S.voortgang * 100)}%"></i></div></div></div>`
      : isTest() ? `<div class="small muted mt8">${nf(st.kandidaten || 0)} producten met pick én bulk${S.laatsteRun ? ` · laatste keer ${nf(S.laatsteRun.vernieuwd)} vernieuwd in ${S.laatsteRun.duur} s` : ''}${S.cat ? ` · productlijst ${esc(tijdTxt(S.cat.t))}` : ''} · niveaus uit de productexport van ${esc(D.PQDATUM ? fdate(D.PQDATUM) : '–')}</div>` : ''}
    ${(() => { const n = !S.bezig && S.st && S.st.p ? teOud().length : 0; return n ? `<div class="small mt8" style="color:#7a4b00">Stand van ${plural(n, 'product', 'producten')} ouder dan 30 min (dicht bij het aanvulniveau): <b>Ververs</b> haalt ze opnieuw op.</div>` : ''; })()}
    ${S.fout ? `<div class="status err">${esc(S.fout.message)}</div>` : ''}</div>
  <div class="tabs noprint">${t('orders', '1 · Voor orders', nNu)}${t('ronde', '2 · Aanvulronde', R ? R.uit.length : null)}${t('vst', '3 · Van VST', V ? V.producten.length : null)}${isTest() ? tabVgl(tab, R) : ''}</div>`;
}
// tab Vergelijk: aantal onverklaard (0 = groen vinkje); grijs bolletje zolang de vergelijking niet geladen of nog voorlopig is
function tabVgl(tab, R){
  let U = null; try{ U = R && D.ADV && D.ADV.rows ? uitleg(R) : null; }catch(e){ console.error(e); }
  const nr = !U || U.teOud ? `<span class="nr" style="background:transparent;border:1.5px solid #b9c0c8;min-width:12px;height:12px;padding:0" title="${U ? 'eerst verversen' : 'nog niet geladen'}"></span>`
    : U.onverklaard ? `<span class="nr" style="background:var(--bad);color:#fff" title="onverklaard">${nf(U.onverklaard)}</span>`
    : '<span class="nr" style="background:#1a7f37;color:#fff" title="0 onverklaard">✓</span>';
  return `<a class="tab ${tab === 'vergelijk' ? 'on' : ''}" href="${BASE}/vergelijk">Vergelijk met PDF ${nr}</a>`;
}
// wat vandaag op de lijst stond en er nu niet meer op staat (= gedaan); gedeeld via wh-taken
function registreer(){
  const L = window.WHLIVE ? WHLIVE.status() : null;
  const k = 'alz:' + isoDag(), oud = (D.TAKEN || {})[k] || {};
  const nu = L && L.klaar && !L.prodLaden && !L.fout ? WHLIVE.nuLijst().map(m => m.code) : [];
  const rd = S.st && S.st.p ? ronde().uit.map(r => r.code) : [];
  const a = [...new Set((oud.nu || []).concat(nu))], b = [...new Set((oud.ronde || []).concat(rd))];
  if(a.length !== (oud.nu || []).length || b.length !== (oud.ronde || []).length)
    WH.catPatch('wh-taken', { [k]:{ nu:a, ronde:b, op:new Date().toISOString() } }).catch(() => {});
}
function gedaan(soort){
  const x = (D.TAKEN || {})['alz:' + isoDag()] || {};
  if(soort === 'nu'){ const L = WHLIVE.status(); if(!L.klaar) return []; const nu = new Set(WHLIVE.nuLijst().map(m => m.code)); return (x.nu || []).filter(c => !nu.has(c)); }
  if(!S.st || !S.st.p) return [];
  const nu = new Set(ronde().uit.map(r => r.code));
  return (x.ronde || []).filter(c => !nu.has(c));
}
const gedaanHtml = soort => { const g = gedaan(soort); return g.length ? `<details class="mt12 noprint"><summary>Vandaag al gedaan (${g.length})</summary><div class="small mt8">${g.map(c => `<span class="code">${esc(c)}</span> <span class="desc">${esc((D.P[c] || {}).naam || '')}</span>`).join('<br>')}</div></details>` : ''; };
function printKop(titel){ return `<div class="printonly pkop"><b>${esc(titel)}</b><span>Picqer ${esc(tijdTxt((S.st || {}).bijgewerkt))}</span></div>`; }
function tabOrders(){
  const L = window.WHLIVE ? WHLIVE.status() : null;
  if(!L || !L.code) return `<div class="card">Eerst Picqer koppelen op <a href="#/live">Picqer live</a>.</div>`;
  const lijst = WHLIVE.nuLijst();
  return `<div class="card"><div class="row wrap between"><div><h3>1 · Voor orders: nu verplaatsen</h3><div class="small muted">Orders waarvan alles op voorraad is; alleen deze verplaatsing houdt ze tegen. Live uit Picqer.</div></div><button class="btn sm noprint" data-al="print" data-t="Aanvullen voor orders">Print</button></div>
    ${printKop('Aanvullen voor orders')}
    ${lijst.length ? `<div class="scroll mt8"><table><tr><th>Product</th><th>Van (bulk)</th><th>Naar (pick)</th><th class="n">Verplaatsen</th><th class="n">Orders</th></tr>
      ${lijst.map(m => `<tr><td><span class="code">${esc(m.code)}</span><div class="desc">${esc(m.naam || '')}</div></td><td>${m.van.map(v => `<span class="loc">${esc(v)}</span>`).join(' ')}</td>
        <td>${m.naar.length ? m.naar.map(v => `<span class="loc">${esc(v)}</span>`).join(' ') : '<span class="badge b-warn">geen specifieke locatie</span>'}</td><td class="n"><b>${nf(m.verpl)}</b></td><td class="n">${nf(m.orders.length)}</td></tr>`).join('')}</table></div>`
      : `<div class="empty">${L.klaar ? 'Niets: geen orders die alleen op een verplaatsing wachten.' : 'Ophalen…'}</div>`}${gedaanHtml('nu')}</div>`;
}
// aandachtspunt: producten met een picklocatie én voorraad op "geen specifieke locatie" (tellen en op de juiste plek zetten).
// Eerst waar de plank leeg of op/onder het niveau is. Live stand waar die er is, anders de voorraad-per-locatie-export.
function zonderLocatie(){
  const codes = new Set(Object.keys(D.VR || {}).filter(c => D.VR[c].geen > 0));
  Object.keys((S.st && S.st.p) || {}).forEach(c => { const s = stand(c); if(s && s.geen) codes.add(c); });
  return [...codes].map(code => {
    const s = stand(code), v = (D.VR || {})[code];
    let pick, plank, g;
    if(s){ pick = s.pick.map(l => l[0]); plank = s.pickVrij; g = s.geen; }
    else { pick = Object.keys(v.locs).filter(l => { const L = (D.LOC || {})[l]; return L && !L.bulk && !isMap(l); }); plank = pick.reduce((t, l) => t + (v.locs[l] || 0), 0); g = { n:v.geen, r:0, bron:'export' }; }
    if(!g || !pick.length) return null;
    const [lvl, tot] = niveau(code);
    return { code, naam:(D.P[code] || {}).naam || '', n:g.n, r:g.bron === 'live' ? g.r : null, bron:s ? 'live' : 'export', pick, plank, lvl, tot,
      krap:plank === 0 || (lvl !== null && lvl !== undefined && plank <= lvl) };
  }).filter(Boolean).sort((a, b) => (b.krap - a.krap) || ((b.lvl != null) - (a.lvl != null)) || b.n - a.n || a.code.localeCompare(b.code));
}
function tabZonderLocatie(){
  const Z = zonderLocatie(); if(!Z.length) return '';
  const nKrap = Z.filter(z => z.krap).length, MAX = 300;
  return `<details class="mt12"><summary>Voorraad zonder locatie (${Z.length}${nKrap ? ', ' + nKrap + ' met lege of krappe plank' : ''})</summary>
    <div class="small muted mt8">Producten met een picklocatie én voorraad op "geen specifieke locatie". Picqer telt die als pickvoorraad, op de plank ligt hij niet. Tellen en op de juiste plek zetten in Picqer. Zonder locatie uit de voorraad-per-locatie-export van ${esc(standTxt(tijdMs(D.VRDATUM)))}; picklocatie uit de live stand, anders uit de export.</div>
    <div class="scroll mt8"><table><tr><th>Product</th><th class="n">Zonder locatie</th><th class="n">Op picklijsten</th><th>Picklocatie</th><th class="n">Op de plank</th><th class="n">Onder / tot</th></tr>
    ${Z.slice(0, MAX).map(z => `<tr><td><span class="code">${esc(z.code)}</span><div class="desc">${esc(z.naam)}</div></td><td class="n"><b>${nf(z.n)}</b></td><td class="n">${z.r == null ? '–' : nf(z.r)}</td>
      <td>${z.pick.map(l => `<span class="loc">${esc(l)}</span>`).join(' ')}${z.bron === 'export' ? '<div class="desc">export</div>' : ''}</td><td class="n">${nf(z.plank)}${z.krap ? ' <span class="badge b-warn">krap</span>' : ''}</td><td class="n">${nf(z.lvl)} / ${nf(z.tot)}</td></tr>`).join('')}</table></div>
    ${Z.length > MAX ? `<div class="small muted mt8">+${nf(Z.length - MAX)} meer</div>` : ''}</details>`;
}
// 3.0 en Test (ook Warehouse binnen 3.0): volle pallets, retourkar eerst en productdata in de aanvulronde.
// Warehouse los, Junior en de rekenregels (ronde, rondeLijst) blijven zoals ze waren.
const in30 = () => { if(isTest()) return true; try{ return window.parent !== window && !!window.parent.IVOL; }catch(e){ return false; } };
const pdVan = c => (D.PDAAN && D.PD && D.PD[c]) || {};
const vrijL = l => Math.max(0, l[4] - (l[5] || 0));
// aanvullen met volle pallets (Daan 16-10, aanname a-pal en a-bulk):
//  - pick onder "bij" → 1 volle pallet;
//  - orders in backorder vragen meer dan max op pick → wat de orders vragen, ook boven max (hele pallets);
//  - volle pallet groter dan max op pick → hele dozen plus de losse stuks tot zo dicht mogelijk onder max;
//  - welke bulkplek: eerst het restje (deelpallet), daarna maakt het niet uit (looproute). Altijd eerst eigen bulk.
function palletAdvies(r, vraagArg){
  const pd = pdVan(r.code), met = String(pd.met || '').trim().toLowerCase();
  const spp = WHL.sppVan(r.code);
  if(met !== 'pallet' || !(spp > 0)) return null;
  const maxp = WH.num(pd.maxpick) || 0, spd = WH.num(pd.spd) > 1 ? WH.num(pd.spd) : 0;
  let vraag = vraagArg;
  if(vraag === undefined){ vraag = 0; try{ const x = (window.WHLIVE ? WHLIVE.nuLijst() : []).find(m => m.code === r.code); if(x) vraag = x.stuks || 0; }catch(e){} }
  const pickNu = r.s.pickFys != null ? r.s.pickFys : r.s.pickVrij;
  const opRoute = (a, b) => WHL.sortLoc(a[0], b[0]);
  const rest = r.s.bulk.filter(l => vrijL(l) > 0 && vrijL(l) % spp !== 0).sort((a, b) => vrijL(a) - vrijL(b) || opRoute(a, b));
  const vol = r.s.bulk.filter(l => vrijL(l) >= spp && vrijL(l) % spp === 0).sort(opRoute);
  // 1. volle pallet past niet onder max: dozen + losse stuks
  if(maxp > 0 && !(vraag > maxp) && spp > maxp){
    const ruimte = Math.max(0, maxp - pickNu);
    const bron = rest[0] || vol[0] || null;
    const losOp = spd ? spp % spd : 0;
    const los = Math.min(losOp, ruimte), dozen = spd ? Math.floor((ruimte - los) / spd) : 0;
    const stuks = spd ? dozen * spd + los : ruimte;
    return { soort:'doos', spp, spd, maxp, dozen, los, stuks, na:pickNu + stuks, van:bron && stuks > 0 ? [[bron[0], stuks, 'doos']] : [], geen:!bron || stuks <= 0, tekort:0, pal:0, n:0 };
  }
  // 2. orders vragen meer dan max op pick: wat de orders vragen; 3. anders 1 volle pallet
  const voorOrders = maxp > 0 && vraag > maxp;
  const n = voorOrders ? Math.max(1, Math.ceil(Math.max(0, vraag - r.s.pickVrij) / spp)) : 1;
  const nodig = n * spp, van = []; let st = 0;
  rest.forEach(l => { if(st < nodig && (st === 0 || voorOrders)){ van.push([l[0], vrijL(l), 'rest']); st += vrijL(l); } });
  // na een restje alleen een volle pallet erbij als de pick dan nog op of onder "bij" zit (aanname a-rest), of als de orders meer vragen
  const lvl = r.lvl != null ? r.lvl : null;
  const nogNodig = () => voorOrders ? st < nodig : st === 0 || (lvl !== null && pickNu + st <= lvl);
  vol.forEach(l => { let k = 0; while(nogNodig() && k < vrijL(l) / spp){ k++; st += spp; } if(k) van.push([l[0], k, 'pal']); });
  const pal = van.filter(v => v[2] === 'pal').reduce((t, v) => t + v[1], 0), restSt = van.filter(v => v[2] === 'rest').reduce((t, v) => t + v[1], 0);
  return { soort:voorOrders ? 'orders' : 'pallet', spp, n, pal, rest:restSt, stuks:pal * spp + restSt, van, tekort:voorOrders || !st ? Math.max(0, Math.ceil((nodig - st) / spp)) : 0, geen:!van.length, maxp, vraag };
}
/* Aanvullen met hele omdozen of bundels (Daan 17-10, aanname a-doos): bij X, aanvullen met hele omdozen/bundels tot zo dicht mogelijk onder max op pick
   (wandrekken bij 2, deurmatten per 10 en Weave per 5, trapprofiel per 15). Alleen als aanvullen met = deel of doos en stuks per doos en max op pick bekend zijn;
   producten die per pallet worden geleverd (aanvullen met = pallet) vallen onder palletAdvies. Eerst het restje (kleinste bulkvoorraad). */
function dozenAdvies(r){
  const pd = pdVan(r.code), met = String(pd.met || '').trim().toLowerCase();
  if(met !== 'deel' && met !== 'doos') return null;
  const spd = WH.num(pd.spd) > 1 ? WH.num(pd.spd) : 0, maxp = WH.num(pd.maxpick) || 0;
  if(!spd || !(maxp > 0)) return null;
  const pickNu = r.s.pickFys != null ? r.s.pickFys : r.s.pickVrij;
  const ruimte = Math.max(0, maxp - pickNu), dozen = Math.max(1, Math.floor(ruimte / spd));
  const bron = r.s.bulk.filter(l => vrijL(l) >= spd).sort((a, b) => vrijL(a) - vrijL(b) || WHL.sortLoc(a[0], b[0]))[0] || null;
  const stuks = bron ? Math.min(dozen * spd, Math.floor(vrijL(bron) / spd) * spd) : 0;
  return { soort:'doos', spp:WHL.sppVan(r.code) || 0, spd, maxp, dozen:Math.floor(stuks / spd), los:0, stuks, na:pickNu + stuks, van:bron && stuks > 0 ? [[bron[0], stuks, 'doos']] : [], geen:!bron || stuks <= 0, tekort:0, pal:0, n:0 };
}
function pdRegel(c){
  const pd = pdVan(c), d = [];
  if(pd.spd && !/^(nvt|onb)$/i.test(pd.spd)) d.push(nf(WH.num(pd.spd)) + ' per doos');
  if(pd.maxpick && WH.num(pd.maxpick) > 0) d.push('max op pick ' + nf(WH.num(pd.maxpick)));
  return d.join(' · ');
}
function rijNieuw(r){
  const pd = pdVan(r.code), P = palletAdvies(r) || dozenAdvies(r), regel = pdRegel(r.code);
  const met = String(pd.met || '').trim().toLowerCase();
  const kolBulk = P && !P.geen ? r.s.bulk.slice().sort((a, b) => (P.van.some(v => v[0] === b[0]) ? 1 : 0) - (P.van.some(v => v[0] === a[0]) ? 1 : 0)).slice(0, 3) : r.s.bulk.slice(0, 3);
  const badge = v => v[2] === 'rest' ? 'restje eerst' : v[2] === 'doos' ? 'hieruit' : v[1] > 1 ? v[1] + ' volle pallets' : 'volle pallet';
  const bulkHtml = kolBulk.map(l => `<span class="loc">${esc(l[0])}</span> <span class="small">${nf(l[4])}</span>${(() => { const v = P && P.van.find(x => x[0] === l[0]); return v ? ` <span class="badge b-ok">${badge(v)}</span>` : ''; })()}`).join('<br>');
  const wat = P => P.soort === 'doos' ? (P.spd ? plural(P.dozen, 'doos', 'dozen') + (P.los ? ' + ' + nf(P.los) + ' los' : '') : nf(P.stuks) + ' los')
    : [P.rest ? 'restje ' + nf(P.rest) : '', P.pal ? plural(P.pal, 'pallet', 'pallets') : ''].filter(Boolean).join(' + ');
  const aanv = P && !P.geen ? `<b style="font-size:16px">${esc(wat(P))}</b><div class="desc">${nf(P.stuks)} stuks${P.soort === 'doos' ? ' · daarna ' + nf(P.na) + ' op pick (max ' + nf(P.maxp) + ')' : ' · ' + nf(P.spp) + ' per pallet'}</div>${P.soort === 'orders' ? `<div class="desc" style="color:var(--warn)">orders vragen ${nf(P.vraag)}: boven max op pick (${nf(P.maxp)})</div>` : ''}${P.tekort ? `<div class="desc">nog ${nf(P.tekort * P.spp)} los: niet genoeg volle pallets</div>` : ''}`
    : `<b style="font-size:16px">${nf(r.aantal)}</b>${P && P.geen ? '<div class="desc">losse stuks: geen volle pallet op bulk</div>' : met === 'deel' ? '<div class="desc">deel van een pallet</div>' : ''}`;
  return `<tr><td><span class="code">${esc(r.code)}</span>${r.voorOrders ? ' <span class="badge b-bad">ook voor orders</span>' : ''}${r.pqOver ? ` <span class="badge b-warn">Picqer slaat dit over: ${esc(r.pqOver)}</span>` : ''}${pd.vn ? `<div><b>${esc(pd.vn)}</b></div>` : ''}<div class="desc">${esc(r.naam)}</div>${regel ? `<div class="desc">${esc(regel)}</div>` : ''}</td>
          <td>${pickLocs(r.s.pick)}${r.s.pickFys !== r.s.pickVrij ? `<div class="desc">fysiek ${nf(r.s.pickFys)}</div>` : ''}</td><td class="n">${nf(r.lvl)} / ${nf(r.tot)}${r.nivBron === 'picqer' ? '<div class="desc">niveau uit Picqer</div>' : ''}</td>
          <td>${bulkHtml}${r.s.bulk.length > 3 ? `<div class="desc">+${r.s.bulk.length - 3}</div>` : ''}</td><td class="n">${aanv}${r.s.bulkRes ? `<div class="desc">waarvan ${nf(r.s.bulkRes)} voor picklijsten op bulk</div>` : ''}</td></tr>`;
}
// retourkar (Container 1–6): voorraad daarop blokkeert orders (Picqer telt hem als pick), dus eerst terugzetten
function karBlok(){
  const rijen = [];
  Object.keys((S.st && S.st.p) || {}).forEach(code => { const s = stand(code); if(s) s.kar.forEach(l => rijen.push({ code, kar:String(l[0]), n:l[4], pick:s.pick.map(x => x[0]), bron:'live' })); });
  const gezien = new Set(rijen.map(x => x.code));
  Object.entries(D.VR || {}).forEach(([code, v]) => {
    if(gezien.has(code)) return;
    Object.entries(v.cont || {}).forEach(([kar, n]) => { if(n > 0) rijen.push({ code, kar, n, pick:WHL.locsVan(code).filter(l => WHL.soortLoc(l) === 'pick' && !isMap(l)), bron:'export' }); });
  });
  if(!rijen.length) return '';
  rijen.sort((a, b) => a.kar.localeCompare(b.kar, 'nl', { numeric:true }) || a.code.localeCompare(b.code));
  return `<div class="card" style="border-left:5px solid var(--bad)"><div class="row wrap between"><div><h3>Eerst terugzetten: retourkar (${rijen.length})</h3><div class="small muted">Voorraad op een retourkar blokkeert orders: Picqer telt hem als pick, maar op de plank ligt hij niet. Eerst terugzetten op de picklocatie (en in Picqer verplaatsen), dan aanvullen.</div></div></div>
    <div class="scroll mt8"><table><tr><th>Kar</th><th>Product</th><th class="n">Op de kar</th><th>Terug naar</th></tr>
    ${rijen.map(x => { const pd = pdVan(x.code); return `<tr><td><span class="loc">${esc(x.kar)}</span>${x.bron === 'export' ? '<div class="desc">export</div>' : ''}</td><td><span class="code">${esc(x.code)}</span>${pd.vn ? `<div><b>${esc(pd.vn)}</b></div>` : ''}<div class="desc">${esc((D.P[x.code] || {}).naam || '')}</div></td><td class="n"><b>${nf(x.n)}</b></td><td>${x.pick.length ? x.pick.map(l => `<span class="loc">${esc(l)}</span>`).join(' ') : '<span class="badge b-warn">geen picklocatie</span>'}</td></tr>`; }).join('')}</table></div></div>`;
}
function tabRonde(R){
  if(!S.st || !S.st.p) return `<div class="card empty">Nog niet uitgerekend. ${isTest() ? 'Klik <b>alles opnieuw</b> (de eerste keer duurt een paar minuten).' : 'Dat gebeurt één keer in Test → Live advies.'}</div>`;
  const gangen = [...new Set(R.uit.map(r => r.gang))];
  const lijst = R.uit.filter(r => !S.gang || r.gang === S.gang);
  let vorige = '';
  return (in30() ? karBlok() : '') + `<div class="card"><div class="row wrap between"><div><h3>2 · Aanvulronde</h3><div class="small muted">Per gang, in looproute. Pick (vrij) = voorraad op de picklocatie min wat al op een picklijst staat. Zoals Picqer: aanvullen als die op of onder het niveau zit.</div></div><button class="btn sm noprint" data-al="print" data-t="Aanvulronde${S.gang ? ' ' + S.gang : ''}">Print</button></div>
    <div class="filters mt8 noprint"><button class="btn sm ${!S.gang ? 'pri' : ''}" data-al="gang" data-g="">alle</button>${gangen.map(g => `<button class="btn sm ${S.gang === g ? 'pri' : ''}" data-al="gang" data-g="${esc(g)}">${esc(g)} <span class="badge b-grey">${R.uit.filter(r => r.gang === g).length}</span></button>`).join('')}</div>
    ${printKop('Aanvulronde' + (S.gang ? ' ' + S.gang : ''))}
    ${lijst.length ? `<div class="scroll mt8"><table><tr><th>Product</th><th>Pick (vrij)</th><th class="n">Onder / tot</th><th>Bulk</th><th class="n">Aanvullen</th></tr>
      ${lijst.map(r => { const g = r.gang !== vorige ? (vorige = r.gang, `<tr class="pgang"><td colspan="5"><b>${esc(r.gang)}</b></td></tr>`) : '';
        return g + (in30() ? rijNieuw(r) : `<tr><td><span class="code">${esc(r.code)}</span>${r.voorOrders ? ' <span class="badge b-bad">ook voor orders</span>' : ''}${r.pqOver ? ` <span class="badge b-warn">Picqer slaat dit over: ${esc(r.pqOver)}</span>` : ''}<div class="desc">${esc(r.naam)}</div></td>
          <td>${pickLocs(r.s.pick)}${r.s.pickFys !== r.s.pickVrij ? `<div class="desc">fysiek ${nf(r.s.pickFys)}</div>` : ''}</td><td class="n">${nf(r.lvl)} / ${nf(r.tot)}${r.nivBron === 'picqer' ? '<div class="desc">niveau uit Picqer</div>' : ''}</td>
          <td>${locs(r.s.bulk.slice(0, 3))}${r.s.bulk.length > 3 ? `<div class="desc">+${r.s.bulk.length - 3}</div>` : ''}</td><td class="n"><b style="font-size:16px">${nf(r.aantal)}</b>${r.s.bulkRes ? `<div class="desc">waarvan ${nf(r.s.bulkRes)} voor picklijsten op bulk</div>` : ''}</td></tr>`); }).join('')}</table></div>`
      : '<div class="empty">Niets aan te vullen.</div>'}
    ${R.leeg.length ? `<details class="mt12"><summary>Onder het niveau, maar geen bulkvoorraad (${R.leeg.length})</summary><div class="scroll mt8"><table><tr><th>Product</th><th>Pick (vrij)</th><th class="n">Onder / tot</th><th>Retourkar</th></tr>
      ${R.leeg.map(r => `<tr><td><span class="code">${esc(r.code)}</span><div class="desc">${esc(r.naam)}</div></td><td>${pickLocs(r.s.pick)}</td><td class="n">${nf(r.lvl)} / ${nf(r.tot)}</td><td>${r.s.kar.length ? locs(r.s.kar) : ''}${(S.cat.vst || {})[r.code] ? `<div class="desc">VST ${nf(S.cat.vst[r.code])}</div>` : ''}</td></tr>`).join('')}</table></div></details>` : ''}
    ${R.opMap && R.opMap.length ? `<details class="mt12"><summary>Voorraad op een map, telt niet als pick (${R.opMap.length})</summary><div class="small muted mt8">Een map (bv. AD) of een locatie buiten het patroon gang-sectie-plaats-hoogte (bv. AD19A06) is geen picklocatie. Verplaats de voorraad naar een echte locatie in Picqer.</div><div class="scroll mt8"><table><tr><th>Product</th><th>Op een map</th><th>Pick</th><th>Bulk</th></tr>
      ${R.opMap.map(r => `<tr><td><span class="code">${esc(r.code)}</span><div class="desc">${esc(r.naam)}</div></td><td>${locs(r.s.map)}</td><td>${r.s.pick.length ? pickLocs(r.s.pick) : '<span class="desc">geen</span>'}</td><td>${locs(r.s.bulk.slice(0, 2))}</td></tr>`).join('')}</table></div></details>` : ''}
    ${R.losse && R.losse.length ? `<details class="mt12"><summary>Voorraad op een losse naam, voor de locatieronde (${R.losse.length})</summary><div class="small muted mt8">Telt mee als pick (zoals in Picqer), maar heeft geen standaardnaam gang-sectie-plaats-hoogte. Alleen een lijst, geen actie.</div><div class="scroll mt8"><table><tr><th>Product</th><th>Losse naam</th><th>Andere pick</th></tr>
      ${R.losse.map(r => `<tr><td><span class="code">${esc(r.code)}</span><div class="desc">${esc(r.naam)}</div></td><td>${locs(r.s.los)}</td><td>${r.s.std ? pickLocs(r.s.pick.filter(l => isStd(l[0]))) : '<span class="desc">geen</span>'}</td></tr>`).join('')}</table></div></details>` : ''}${isTest() ? tabZonderLocatie() : ''}${gedaanHtml('ronde')}</div>`;
}
function tabVst(V){
  if(!V) return `<div class="card empty">Wacht op Picqer-gegevens (backorders en productlijst). Klik eventueel <b>Ververs</b>.</div>`;
  return `<div class="card"><div class="row wrap between"><div><h3>3 · Van VST halen</h3><div class="small muted">Orders die niet compleet zijn met de voorraad hier, maar wel met de voorraad bij VST. Oudste order eerst.</div></div><button class="btn sm noprint" data-al="print" data-t="Van VST halen">Print</button></div>
    ${printKop('Van VST halen')}
    ${V.producten.length ? `<div class="scroll mt8"><table><tr><th>Product</th><th class="n">Nodig</th><th class="n">Op VST</th><th>Palletnummers (laatste export)</th><th class="n">Orders</th></tr>
      ${V.producten.map(p => `<tr><td><span class="code">${esc(p.code)}</span><div class="desc">${esc(p.naam)}</div></td><td class="n"><b>${nf(p.nodig)}</b></td><td class="n">${nf(p.vst)}</td>
        <td class="small">${esc(((D.VSTLOC || {})[p.code] || []).slice(0, 6).join(', '))}</td><td class="n">${nf(p.orders.length)}</td></tr>`).join('')}</table></div>
      <div class="small muted mt8">${plural(V.orders.length, 'order wordt', 'orders worden')} compleet met VST.</div>` : '<div class="empty">Geen orders die met VST compleet worden.</div>'}</div>`;
}
// één regel per product: Product · Plek · PDF zei · App zegt · Waarom (één zin) met de rekensom eronder
function vgRegels(U){
  const C = U.C, M = U.M, uit = [];
  const naamVan = c => (D.P[c] || {}).naam || '';
  const plekVan = (s, pdf) => s && s.pick.length ? s.pick[0][0] : (pdf && pdf.pick && pdf.pick[0]) || (s && s.map.length ? s.map[0][0] : '');
  const aantalTxt = n => n === null || n === undefined ? 'niets' : nf(n);
  const som = (a, s, lvl, tot, aantal) => a && a.bron === 'orders' ? 'Orders vragen ' + nf(a.n.stuks) + ', de app verplaatst ' + nf(a.aantal) + (s ? '; pick vrij ' + nf(s.pickVrij) + ', bulk ' + nf(s.bulkV) : '')
    : s ? somTekst(s, lvl, tot, aantal) : '';
  const red = {}; U.rijen.forEach(r => { red[r.soort + '|' + r.code] = r; });
  C.alleenPdf.forEach(x => { const r = red['pdf|' + x.code]; if(!r) return; const q = niveau(x.code);
    uit.push({ code:x.code, label:'alleen in de PDF', plek:plekVan(x.s, x.pdf), pdf:aantalTxt(x.pdf.aantal), app:'niets', r:r.r, ok:r.ok, som:x.s && x.s.pick.length ? somTekst(x.s, q[0], q[1], 0) + '. PDF: pick was ' + nf(x.pdf.pickst) + ', aanvullen ' + nf(x.pdf.aantal) : 'PDF: aanvullen ' + nf(x.pdf.aantal) }); });
  C.alleenLive.forEach(a => { const r = red['live|' + a.code]; if(!r) return; const s = a.r ? a.r.s : stand(a.code);
    uit.push({ code:a.code, label:'alleen in de app', plek:plekVan(s, null), pdf:'niets', app:aantalTxt(a.aantal), r:r.r, ok:r.ok, som:som(a, s, a.r ? a.r.lvl : null, a.r ? a.r.tot : null, a.aantal) }); });
  const gelijk = [];
  C.beide.forEach(b => { const a = b.a, s = a.r ? a.r.s : stand(b.code), r = red['beide|' + b.code];
    const regel = { code:b.code, label:a.bron === 'orders' ? 'voor orders' : '', plek:plekVan(s, b.pdf), pdf:aantalTxt(b.pdf.aantal), app:aantalTxt(a.aantal), r:r ? r.r : 'Zelfde aantal', ok:r ? r.ok : true, som:som(a, s, a.r ? a.r.lvl : null, a.r ? a.r.tot : null, a.aantal) };
    (r ? uit : gelijk).push(regel); });
  uit.forEach(x => { x.naam = naamVan(x.code); }); gelijk.forEach(x => { x.naam = naamVan(x.code); });
  return { onv:uit.filter(x => !x.ok), ver:uit.filter(x => x.ok), gelijk };
}
const VG_CSS = `<style>.vg-kop,.vg-rij{display:grid;grid-template-columns:minmax(0,1.5fr) 84px 64px 64px minmax(0,4fr);gap:6px 12px;align-items:start}
.vg-kop{font-size:12px;font-weight:700;color:var(--muted,#6b7a89);padding:4px 0;border-bottom:1px solid var(--line,#d6dde5)}
.vg-rij{padding:9px 0;border-bottom:1px solid var(--line,#e6ebf0)} .vg-rij .n{text-align:right} .vg-rij .som{color:var(--muted,#55626f);font-size:13px;margin-top:3px}
.vg-rij .lab{display:none;font-size:11px;color:var(--muted,#6b7a89)}
@media (max-width:760px){.vg-kop{display:none}.vg-rij{grid-template-columns:1fr 1fr 1fr}.vg-rij .p{grid-column:1/-1}.vg-rij .w{grid-column:1/-1}.vg-rij .n{text-align:left}.vg-rij .lab{display:block}}</style>`;
function vgRij(x){
  return `<div class="vg-rij"><div class="p"><span class="code">${esc(x.code)}</span>${x.label ? ` <span class="badge b-grey">${esc(x.label)}</span>` : ''}<div class="desc">${esc(x.naam)}</div></div>
    <div><span class="lab">Plek</span>${x.plek ? `<span class="loc">${esc(x.plek)}</span>` : '<span class="desc">geen</span>'}</div>
    <div class="n"><span class="lab">PDF zei</span>${esc(x.pdf)}</div><div class="n"><span class="lab">App zegt</span><b>${esc(x.app)}</b></div>
    <div class="w">${x.ok ? '' : '<span class="badge b-bad">onverklaard</span> '}${esc(x.r)}${x.som ? `<div class="som">${esc(x.som)}</div>` : ''}</div></div>`;
}
const vgLijst = l => `<div class="vg-kop"><div>Product</div><div>Plek</div><div class="n" style="text-align:right">PDF zei</div><div class="n" style="text-align:right">App zegt</div><div>Waarom</div></div>${l.map(vgRij).join('')}`;
function tabVergelijk(R){
  const U = uitleg(R);
  if(!U) return '<div class="card empty">Geen PDF-advies van Picqer ingeladen om mee te vergelijken (Gegevens → aanvuladvies-PDF).</div>';
  const C = U.C, V = vgRegels(U);
  return `${VG_CSS}<div class="card" id="vg"><h3>Vergelijk met het PDF-advies van Picqer</h3><div class="small muted">PDF van ${esc(tijdTxt(C.datum))} (${nf(C.nPdf)} regels) tegen wat de app adviseert (Voor orders + Aanvulronde). Bij elk verschil staat de reden in één zin en de rekensom eronder, zodat je ziet wie gelijk heeft.</div>
    ${U.teOud ? `<div class="status mt8 row wrap between" style="gap:8px;background:#fff1dc;color:#7a4b00;padding:8px 10px;border-radius:8px"><b>${esc(U.teOud)}</b>${S.bezig ? `<span class="small">${esc(S.stap || 'Bezig…')}</span>` : '<button class="btn pri sm" data-al="ververs-pdf">Live stand nu verversen</button>'}</div>` : ''}
    <div class="mt12"><b style="font-size:17px">${plural(U.verschillen, 'verschil', 'verschillen')} · ${nf(U.verklaard)} verklaard · ${nf(U.onverklaard)} onverklaard</b>${U.teOud ? ' <span class="badge b-warn">voorlopig</span>' : ''}</div>
    ${V.onv.length ? `<h4 class="mt12">Onverklaard (${nf(V.onv.length)})</h4>${vgLijst(V.onv)}` : ''}
    ${V.ver.length ? `<h4 class="mt12">Verklaard (${nf(V.ver.length)})</h4>${vgLijst(V.ver)}` : ''}
    ${V.gelijk.length ? `<details class="mt12"><summary>${nf(V.gelijk.length)} gelijk</summary>${vgLijst(V.gelijk)}</details>` : ''}</div>`;
}

let TAB = 'ronde';
const LUISTER = [];
const meld = () => LUISTER.forEach(f => { try{ f(); }catch(e){ console.error(e); } });
function teken(){
  meld();
  if(!(location.hash || '').startsWith(BASE)) return;
  const a = app(); if(!a) return;
  const y = window.scrollY;
  const R = S.st && S.st.p ? ronde() : null;
  const Vs = vanVst();
  a.innerHTML = kop(TAB, R, Vs) + (TAB === 'orders' ? tabOrders() : TAB === 'vst' ? tabVst(Vs) : TAB === 'vergelijk' && isTest() ? (R ? tabVergelijk(R) : tabRonde(R)) : tabRonde(R || { uit:[], leeg:[] }));
  window.scrollTo(0, y);
}
// verversen: nieuwste stand uit de database (een ander apparaat kan net bijgewerkt hebben), Picqer-orders opnieuw,
// en alleen als de stand ouder is dan minMin minuten zelf de gewijzigde producten ophalen
async function ververs(minMin){
  if(S.bezig) return;
  if(window.WHLIVE && WHLIVE.status().code) WHLIVE.laad(true);
  S.geladen = false; await laadOpslag();
  if(S.st && S.st.bijgewerkt && window.WHLIVE && WHLIVE.status().code && uurOud(S.st.bijgewerkt) * 60 >= (minMin == null ? 1 : minMin)) await bijwerken(false);
  registreer(); teken();
}
// Junior: aanvulronde in dezelfde vorm als de export-lijst
function rondeLijst(){
  if(!S.st || !S.st.p) return null;
  return ronde().uit.map(r => ({ live:true, code:r.code, naam:r.naam, bulk:r.s.bulk.map(l => l[0]), pick:r.s.pick.map(l => l[0]), geenPick:false,
    gang:r.gang, aantal:r.aantal, pickst:r.s.pickVrij, lvl:r.lvl, tot:r.tot }));
}
async function view(tab, base){
  BASE = base || '#/aanvullive';
  const tabs = ['orders', 'ronde', 'vst'].concat(isTest() ? ['vergelijk'] : []);
  TAB = tabs.includes(tab) ? tab : (isTest() ? 'ronde' : 'orders');
  teken();
  if(window.WHLIVE && WHLIVE.status().code && !WHLIVE.status().data && !WHLIVE.status().laden) WHLIVE.laad();
  if(!S.geladen){ await laadOpslag(); teken(); }
  // automatisch verversen als de stand ouder is dan 10 minuten
  if(!S.bezig && S.st && WHLIVE.status().code && uurOud(S.st.bijgewerkt) > 1 / 6) ververs(10);
}
if(window.WHLIVE) WHLIVE.opNieuw(() => { registreer(); teken(); });
// elke 5 minuten vers zolang het scherm open staat
setInterval(() => { if(document.visibilityState === 'visible' && (location.hash || '').startsWith(BASE) && !S.bezig) ververs(10); }, 300000);
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-al]'); if(!b) return;
  const k = b.dataset.al;
  if(k === 'ververs' || k === 'bijwerken') ververs(1);
  if(k === 'alles') bijwerken(true);
  if(k === 'ververs-pdf'){ ververs(0).then(() => verversPdf()); }
  if(k === 'gang'){ S.gang = b.dataset.g || ''; teken(); }
  if(k === 'print'){
    const oud = document.title, n = new Date();
    document.title = b.dataset.t + ' ' + isoDag(n) + ' ' + dd(n.getHours()) + dd(n.getMinutes());
    window.print(); setTimeout(() => { document.title = oud; }, 500);
  }
});
return { palletAdvies, dozenAdvies, view, ververs, bijwerken, ronde, rondeLijst, vanVst, kandidaten, stand, gedaan, registreer, laadOpslag, uitleg, momenten, verversPdf, teOud, isPick, zonderLocatie, opNieuw:f => LUISTER.push(f), S };
})();
