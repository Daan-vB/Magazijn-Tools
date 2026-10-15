/* =====================================================================
   IVOL Warehouse — Aanvuladvies live uit Picqer (Test, 7-10-2026)
   Picqer heeft geen aanvuladvies in de API, dus de app rekent het zelf uit, zoals Picqer:
     vrije pickvoorraad op of onder "aanvullen onder" en er staat voorraad op bulk → aanvullen tot "vul aan tot"
     (vrij = voorraad min gereserveerd voor picklijsten; aantal begrensd door de bulkvoorraad).
     Alleen echte picklocaties tellen (GANG SECTIE PLAATS HOOGTE, bv. AD19A06); voorraad op een map is een aandachtspunt.
   Gegevens:
     wh-pq-cat     alle producten met voorraad: id, voorraad Hoofdmagazijn / VST   (1× per 12 uur, ±10 verzoeken)
     wh-pickstand  voorraad per locatie van de kandidaten (pick + bulk gekoppeld)   (alleen gewijzigde producten)
     niveaus       uit de Picqer-productexport (wh-pq: aanvullen onder / vul aan tot)
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
// picklocatie = GANG (2 letters) SECTIE (2 cijfers) PLAATS (A–D) HOOGTE (2 cijfers) en geen map van andere locaties
const PICK_RX = /^[A-Z]{2}\d{2}[A-D]\d{2}$/i;
let MAPS = null, mapsVan = null;
function mappen(){
  if(mapsVan !== D.LOC){ MAPS = new Set(); Object.values(D.LOC || {}).forEach(L => { if(L.parent) MAPS.add(L.parent); }); mapsVan = D.LOC; }
  return MAPS;
}
const isPick = naam => { const n = String(naam || '').trim(); return PICK_RX.test(n) && !mappen().has(n); };
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
    const q = D.PQ[code]; if(!q || q[0] === null || q[0] === undefined) return false;
    if(q[2] === 1) return false;                                    // virtueel
    const x = idx[code];
    if(x && x.pick && x.bulk) return true;
    const vorig = st[code];
    return !!(vorig && vorig.l && vorig.l.some(l => l[2] === 1 && l[4] > 0 && !isKar(l)) && vorig.l.some(l => l[2] === 0 && !isKar(l) && isPick(l[0])));
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
function standVan(p){
  const hm = p.l.filter(l => l[1] == null || Number(l[1]) === MAG);
  const eigen = hm.filter(l => l[2] === 0 && !isKar(l));
  const pick = eigen.filter(l => isPick(l[0])), map = eigen.filter(l => !isPick(l[0]) && l[4] > 0);
  const bulk = hm.filter(l => l[2] === 1 && !isKar(l) && l[4] > 0).sort((a, b) => b[4] - a[4]);
  const kar = hm.filter(l => isKar(l) && l[4] > 0);
  return { t:p.t, pick, bulk, kar, map, pickFys:pick.reduce((s, l) => s + l[4], 0), pickVrij:pick.reduce((s, l) => s + Math.max(0, l[4] - l[5]), 0), bulkV:bulk.reduce((s, l) => s + l[4], 0) };
}
function stand(code){
  const p = S.st && S.st.p && S.st.p[code]; if(!p) return null;
  return standVan(p);
}
// de stand van vóór de laatste keer ophalen (of null)
function vorigeStand(code){
  const p = S.st && S.st.p && S.st.p[code];
  return p && p.o ? standVan(p.o) : null;
}
// zoals Picqer: aanvullen bij vrije pick op of onder het niveau, aantal = vul aan tot − vrij, begrensd door de bulk
const nodigAanvul = (s, lvl, tot) => lvl === null || lvl === undefined || s.pickVrij > lvl ? 0 : Math.max(0, Math.max(tot || 0, lvl) - s.pickVrij);
function ronde(){
  const nuCodes = new Set((window.WHLIVE ? WHLIVE.nuLijst() : []).map(m => m.code));
  const uit = [], leeg = [];
  kandidaten().forEach(code => {
    const s = stand(code); if(!s || !s.pick.length) return;
    const [lvl, tot] = D.PQ[code] || [];
    const nodig = nodigAanvul(s, lvl, tot);
    if(!nodig) return;
    const naam = (D.P[code] || {}).naam || '';
    if(!s.bulk.length){ leeg.push({ code, naam, s, lvl, tot }); return; }
    uit.push({ code, naam, s, lvl, tot, aantal:Math.min(s.bulkV, nodig), gang:gangVan(s.pick[0][0]), voorOrders:nuCodes.has(code) });
  });
  uit.sort((a, b) => WHL.sortLoc(a.s.pick[0][0], b.s.pick[0][0]));
  // aandachtspunt: voorraad op een map (geen echte picklocatie), telt niet als pick
  const opMap = Object.keys((S.st && S.st.p) || {}).map(code => ({ code, s:stand(code) })).filter(x => x.s && x.s.map.length)
    .map(x => ({ code:x.code, naam:(D.P[x.code] || {}).naam || '', s:x.s })).sort((a, b) => String(a.s.map[0][0]).localeCompare(String(b.s.map[0][0])) || a.code.localeCompare(b.code));
  return { uit, leeg, opMap };
}
// kandidaten dicht bij hun niveau (vrije pick ≤ 2× niveau) met een stand ouder dan 30 minuten
function teOud(){
  if(!S.st || !S.st.p) return [];
  return kandidaten().filter(c => {
    const p = S.st.p[c]; if(!p) return false;
    const lvl = (D.PQ[c] || [])[0];
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
// aanvulniveau zoals Picqer het nu heeft (opgehaald bij het verversen voor de vergelijking)
const niveauPicqer = c => { const n = S.st && S.st.pdfStand && S.st.pdfStand.niv; return n && n[c] ? n[c] : null; };
const nivTxt = (a, b) => nf(a) + ' / ' + nf(b);
const opMapTxt = s => s && s.map.length ? s.map.map(l => nf(l[4]) + ' op map ' + l[0]).join(', ') : '';
const verschiltNiv = (c, lvl, tot) => { const n = niveauPicqer(c); return n && (Number(n[0]) !== Number(lvl) || Number(n[1]) !== Number(tot)) ? n : null; };
function redenPdf(x, M){
  const c = x.code, q = D.PQ[c] || [], lvl = q[0], pdf = x.pdf || {}, s = stand(c);
  const opMap = opMapTxt(s);
  if(pdf.geenPick || (pdf.pick && !pdf.pick.length)) return { r:'Geen picklocatie: hoort bij Voor orders' + (opMap ? ' (' + opMap + ', telt niet als pick)' : '') + (lvl === null || lvl === undefined ? '; geen aanvulniveau in de app' : ''), ok:true };
  if(!S.cat || !S.cat.ids || !S.cat.ids[c]) return { r:'Geen voorraad meer in het Hoofdmagazijn', ok:true };
  if(lvl === null || lvl === undefined){ const n = niveauPicqer(c); return { r:'Geen aanvulniveau in de app (Picqer heeft er wel een' + (n ? ': ' + nivTxt(n[0], n[1]) : '') + ')', ok:true }; }
  if(!s) return { r:'Nog geen live stand van dit product: eerst verversen', ok:false };
  if(!M.vers(c)) return { r:'Stand van ' + standTxt(M.standT(c)) + ' is ouder dan de PDF: eerst verversen', ok:false };
  if(!s.pick.length) return { r:opMap ? 'Pick staat op een map (' + opMap + '): telt niet als picklocatie' : 'Geen picklocatie meer in Picqer (PDF: ' + (pdf.pick || []).join(', ') + ')', ok:true };
  const n = verschiltNiv(c, lvl, q[1]);
  if(n) return { r:'Aanvulniveau verschilt: app ' + nivTxt(lvl, q[1]) + ', Picqer ' + nivTxt(n[0], n[1]), ok:true };
  const toen = pdf.pickst, nu = s.pickVrij;
  if(nu > lvl){
    // de verse stand toont het: pick nu boven het niveau en hoger dan in de PDF
    if(toen != null && nu > toen) return { r:'Inmiddels aangevuld: pick toen ' + nf(toen) + ', nu ' + nf(nu) + ' (stand ' + standTxt(M.standT(c)) + ')', ok:true };
    if(toen != null && toen !== nu) return { r:'Voorraad veranderd sinds de PDF (pick toen ' + nf(toen) + ', nu ' + nf(nu) + ')', ok:true };
    return { r:'Onverklaard: pick ' + nf(nu) + ' boven het niveau ' + nf(lvl) + ', ook al in de PDF', ok:false };
  }
  if(!nodigAanvul(s, lvl, q[1])) return { r:'Onverklaard: vul aan tot ' + nf(q[1]) + ' is niet hoger dan de vrije pick ' + nf(nu), ok:false };
  if(!s.bulk.length){
    const bulkPdf = (pdf.bulk || []).filter(Boolean);
    return { r:bulkPdf.length ? 'Bulk is leeg (PDF noemde nog ' + bulkPdf.slice(0, 2).join(', ') + ')' : 'Onder het niveau, maar geen bulk', ok:true };
  }
  if(!kandidaten().includes(c)) return { r:'Niet in de aanvulronde: pick en bulk niet allebei gekoppeld in de locatie-export', ok:false };
  return { r:'Onverklaard', ok:false };
}
function redenLive(a, M){
  const c = a.code;
  if(a.bron === 'orders'){
    if(M.pdfT == null || M.ordersT == null || M.ordersT < M.pdfT) return { r:'Orders van ' + standTxt(M.ordersT) + ' zijn ouder dan de PDF: eerst verversen', ok:false };
    const oudste = tijdMs(a.n.datum);
    if(oudste != null && oudste > M.pdfT) return { r:'Voor orders: order binnengekomen na de PDF (' + standTxt(oudste) + ')', ok:true };
    return { r:'Onverklaard: voor orders (' + nf(a.aantal) + '), niet in de PDF', ok:false };
  }
  const r = a.r, s = r.s;
  if(!M.vers(c)) return { r:'Stand van ' + standTxt(M.standT(c)) + ' is ouder dan de PDF: eerst verversen', ok:false };
  const n = verschiltNiv(c, r.lvl, r.tot);
  if(n) return { r:'Aanvulniveau verschilt: app ' + nivTxt(r.lvl, r.tot) + ', Picqer ' + nivTxt(n[0], n[1]), ok:true };
  // aangetoond gedaald: een stand van ná de PDF stond nog boven het niveau, de nieuwste niet meer
  const v = vorigeStand(c), vT = v ? tijdMs(v.t) : null;
  if(v && vT >= M.pdfT && v.pickVrij > r.lvl) return { r:'Voorraad gedaald na de PDF: om ' + standTxt(vT) + ' pick ' + nf(v.pickVrij) + ', nu ' + nf(s.pickVrij) + ' (niveau ' + nf(r.lvl) + ')', ok:true };
  return { r:'Onverklaard: live op of onder het niveau (pick ' + nf(s.pickVrij) + ', niveau ' + nf(r.lvl) + '), niet in de PDF', ok:false };
}
// in beide, maar een ander aantal
function redenAantal(b, M){
  const c = b.code, a = b.a, pdf = b.pdf;
  if(Number(pdf.aantal) === Number(a.aantal)) return null;
  const w = ' (PDF ' + nf(pdf.aantal) + ', app ' + nf(a.aantal) + ')';
  if(a.bron === 'orders') return { r:'Voor orders: de app verplaatst wat de orders vragen, Picqer vult aan tot het niveau' + w, ok:true };
  const r = a.r, s = r.s;
  if(!M.vers(c)) return { r:'Stand van ' + standTxt(M.standT(c)) + ' is ouder dan de PDF: eerst verversen' + w, ok:false };
  if(pdf.pickst != null && Number(pdf.pickst) !== s.pickVrij) return { r:'Voorraad veranderd sinds de PDF: pick toen ' + nf(pdf.pickst) + ', nu ' + nf(s.pickVrij) + w, ok:true };
  const n = verschiltNiv(c, r.lvl, r.tot);
  if(n) return { r:'Aanvulniveau verschilt: app ' + nivTxt(r.lvl, r.tot) + ', Picqer ' + nivTxt(n[0], n[1]) + w, ok:true };
  if(a.aantal === s.bulkV && a.aantal < nodigAanvul(s, r.lvl, r.tot)) return { r:'Begrensd door de bulkvoorraad (' + nf(s.bulkV) + ')' + w, ok:true };
  return { r:'Onverklaard: zelfde pick, ander aantal' + w, ok:false };
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
  return { C, M, rijen, verschillen:rijen.length, verklaard, onverklaard:rijen.length - verklaard, oud, nodig:nodig.length,
    teOud:M.pdfT == null ? null : oud.length ? 'Stand van ' + plural(oud.length, 'product', 'producten') + ' ouder dan de PDF (' + hhmm(M.pdfT) + ') — eerst verversen' : ordersOud ? 'Orders ouder dan de PDF — eerst verversen' : null };
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
  const alleenLive = () => { const C = vergelijk(ronde()); return C ? C.alleenLive.filter(a => a.bron === 'ronde').map(a => a.code) : []; };
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
        (r.lijst || []).forEach(([id, w]) => { const c = codeVan[id]; if(c && w && w[0] != null) niv[c] = [w[0], w[1]]; });
        if(i + 60 < ids.length) await rustig(t0, 12000);
      }
    }catch(e){ if(/Onbekende actie/i.test(String(e && e.message))) oudeFunctie = true; else throw e; }
  }
  try{
    await haal(pdfCodes().concat(alleenLive()));
    await haal(alleenLive());      // met de nieuwe stand kan de ronde veranderen: die producten ook vers
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
  <div class="tabs noprint">${t('orders', '1 · Voor orders', nNu)}${t('ronde', '2 · Aanvulronde', R ? R.uit.length : null)}${t('vst', '3 · Van VST', V ? V.producten.length : null)}${isTest() ? t('vergelijk', 'Vergelijk met PDF', null) : ''}</div>`;
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
function tabRonde(R){
  if(!S.st || !S.st.p) return `<div class="card empty">Nog niet uitgerekend. ${isTest() ? 'Klik <b>alles opnieuw</b> (de eerste keer duurt een paar minuten).' : 'Dat gebeurt één keer in Test → Live advies.'}</div>`;
  const gangen = [...new Set(R.uit.map(r => r.gang))];
  const lijst = R.uit.filter(r => !S.gang || r.gang === S.gang);
  let vorige = '';
  return `<div class="card"><div class="row wrap between"><div><h3>2 · Aanvulronde</h3><div class="small muted">Per gang, in looproute. Pick (vrij) = voorraad op de picklocatie min wat al op een picklijst staat. Zoals Picqer: aanvullen als die op of onder het niveau zit.</div></div><button class="btn sm noprint" data-al="print" data-t="Aanvulronde${S.gang ? ' ' + S.gang : ''}">Print</button></div>
    <div class="filters mt8 noprint"><button class="btn sm ${!S.gang ? 'pri' : ''}" data-al="gang" data-g="">alle</button>${gangen.map(g => `<button class="btn sm ${S.gang === g ? 'pri' : ''}" data-al="gang" data-g="${esc(g)}">${esc(g)} <span class="badge b-grey">${R.uit.filter(r => r.gang === g).length}</span></button>`).join('')}</div>
    ${printKop('Aanvulronde' + (S.gang ? ' ' + S.gang : ''))}
    ${lijst.length ? `<div class="scroll mt8"><table><tr><th>Product</th><th>Pick (vrij)</th><th class="n">Onder / tot</th><th>Bulk</th><th class="n">Aanvullen</th></tr>
      ${lijst.map(r => { const g = r.gang !== vorige ? (vorige = r.gang, `<tr class="pgang"><td colspan="5"><b>${esc(r.gang)}</b></td></tr>`) : '';
        return g + `<tr><td><span class="code">${esc(r.code)}</span>${r.voorOrders ? ' <span class="badge b-bad">ook voor orders</span>' : ''}<div class="desc">${esc(r.naam)}</div></td>
          <td>${locs(r.s.pick, 'vrij')}${r.s.pickFys !== r.s.pickVrij ? `<div class="desc">fysiek ${nf(r.s.pickFys)}</div>` : ''}</td><td class="n">${nf(r.lvl)} / ${nf(r.tot)}</td>
          <td>${locs(r.s.bulk.slice(0, 3))}${r.s.bulk.length > 3 ? `<div class="desc">+${r.s.bulk.length - 3}</div>` : ''}</td><td class="n"><b style="font-size:16px">${nf(r.aantal)}</b></td></tr>`; }).join('')}</table></div>`
      : '<div class="empty">Niets aan te vullen.</div>'}
    ${R.leeg.length ? `<details class="mt12"><summary>Onder het niveau, maar geen bulkvoorraad (${R.leeg.length})</summary><div class="scroll mt8"><table><tr><th>Product</th><th>Pick (vrij)</th><th class="n">Onder / tot</th><th>Retourkar</th></tr>
      ${R.leeg.map(r => `<tr><td><span class="code">${esc(r.code)}</span><div class="desc">${esc(r.naam)}</div></td><td>${locs(r.s.pick, 'vrij')}</td><td class="n">${nf(r.lvl)} / ${nf(r.tot)}</td><td>${r.s.kar.length ? locs(r.s.kar) : ''}${(S.cat.vst || {})[r.code] ? `<div class="desc">VST ${nf(S.cat.vst[r.code])}</div>` : ''}</td></tr>`).join('')}</table></div></details>` : ''}
    ${R.opMap && R.opMap.length ? `<details class="mt12"><summary>Voorraad op een map, telt niet als pick (${R.opMap.length})</summary><div class="small muted mt8">Een map (bv. AD) of een locatie buiten het patroon gang-sectie-plaats-hoogte (bv. AD19A06) is geen picklocatie. Verplaats de voorraad naar een echte locatie in Picqer.</div><div class="scroll mt8"><table><tr><th>Product</th><th>Op een map</th><th>Pick</th><th>Bulk</th></tr>
      ${R.opMap.map(r => `<tr><td><span class="code">${esc(r.code)}</span><div class="desc">${esc(r.naam)}</div></td><td>${locs(r.s.map)}</td><td>${r.s.pick.length ? locs(r.s.pick, 'vrij') : '<span class="desc">geen</span>'}</td><td>${locs(r.s.bulk.slice(0, 2))}</td></tr>`).join('')}</table></div></details>` : ''}${gedaanHtml('ronde')}</div>`;
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
function tabVergelijk(R){
  const U = uitleg(R);
  if(!U) return '<div class="card empty">Geen PDF-advies van Picqer ingeladen om mee te vergelijken (Gegevens → aanvuladvies-PDF).</div>';
  const C = U.C, M = U.M, red = {}; U.rijen.forEach(r => { red[r.soort + '|' + r.code] = r; });
  const rd = (soort, code) => { const r = red[soort + '|' + code]; return r ? `<span class="badge ${r.ok ? 'b-grey' : 'b-bad'}">${r.ok ? 'verklaard' : 'onverklaard'}</span> ${esc(r.r)}` : ''; };
  // leeftijd van de stand per product; ouder dan de PDF = oranje
  const leeft = (c, bron) => { const t = bron === 'orders' ? M.ordersT : M.standT(c); if(t == null) return '<span class="desc">geen stand</span>';
    const oud = M.pdfT != null && t < M.pdfT; return `<span class="${oud ? 'badge b-warn' : 'small'}" title="${oud ? 'ouder dan de PDF' : 'na de PDF'}">${esc(standTxt(t))}</span>`; };
  const bronTxt = a => a.bron === 'orders' ? '<span class="badge b-bad">voor orders</span>' : '<span class="badge b-grey">aanvulronde</span>';
  const pdfPick = p => esc((p.pick || []).join ? p.pick.join(' ') : p.pick || '');
  const rijPdf = x => `<tr><td><span class="code">${esc(x.code)}</span></td><td>${x.pdf ? pdfPick(x.pdf) : ''}</td><td class="n">${x.pdf ? nf(x.pdf.pickst) : ''}</td><td class="n">${x.pdf ? nf(x.pdf.aantal) : ''}</td>
    <td>${x.s ? (x.s.pick.length ? locs(x.s.pick, 'vrij') : '') + (x.s.map.length ? `<div class="desc">op een map: ${locs(x.s.map)}</div>` : '') || '<span class="desc">geen pick</span>' : '<span class="desc">geen live stand</span>'}</td><td>${leeft(x.code)}</td><td class="small">${rd('pdf', x.code)}</td></tr>`;
  const rijBeide = b => { const a = b.a, s = a.r ? a.r.s : stand(b.code), af = Number(b.pdf.aantal) !== Number(a.aantal);
    return `<tr${af ? ' style="background:#fff1dc"' : ''}><td><span class="code">${esc(b.code)}</span></td><td>${bronTxt(a)}</td><td class="n">${nf(b.pdf.pickst)} → ${s ? nf(s.pickVrij) : '–'}</td>
      <td class="n">${nf(b.pdf.aantal)}</td><td class="n"><b>${nf(a.aantal)}</b>${af ? ' <span class="badge b-warn">anders</span>' : ''}</td><td>${leeft(b.code, a.bron)}</td><td class="small">${af ? rd('beide', b.code) : ''}</td></tr>`; };
  const rijLive = a => { const r = a.r, s = r ? r.s : stand(a.code);
    return `<tr><td><span class="code">${esc(a.code)}</span></td><td>${bronTxt(a)}</td><td>${s ? locs(s.pick, 'vrij') : ''}</td><td class="n">${r ? nivTxt(r.lvl, r.tot) : ''}</td><td class="n">${nf(a.aantal)}</td><td>${leeft(a.code, a.bron)}</td><td class="small">${rd('live', a.code)}</td></tr>`; };
  const nAnders = C.beide.filter(b => Number(b.pdf.aantal) !== Number(b.a.aantal)).length;
  return `<div class="card"><h3>Vergelijk met het PDF-advies van Picqer</h3><div class="small muted">PDF van ${esc(tijdTxt(C.datum))} (${nf(C.nPdf)} regels) tegen wat de app adviseert: Voor orders + Aanvulronde. Per product de tijd van de stand; vergelijken telt pas als elke stand van ná de PDF is. Alleen onverklaarde verschillen zijn werk.</div>
    ${U.teOud ? `<div class="status mt8 row wrap between" style="gap:8px;background:#fff1dc;color:#7a4b00;padding:8px 10px;border-radius:8px"><b>${esc(U.teOud)}</b>${S.bezig ? `<span class="small">${esc(S.stap || 'Bezig…')}</span>` : '<button class="btn pri sm" data-al="ververs-pdf">Live stand nu verversen</button>'}</div>` : ''}
    <div class="mt12"><b style="font-size:17px">${plural(U.verschillen, 'verschil', 'verschillen')} · ${nf(U.verklaard)} verklaard · ${nf(U.onverklaard)} onverklaard</b>${U.teOud ? ' <span class="badge b-warn">voorlopig</span>' : ''}</div>
    <div class="tiles mt12"><div class="tile t-ok"><div class="lbl">In beide</div><div class="big">${nf(C.beide.length)}</div>${nAnders ? `<div class="sub">${nf(nAnders)} met ander aantal</div>` : ''}</div>
      <div class="tile t-warn"><div class="lbl">Alleen in PDF</div><div class="big">${nf(C.alleenPdf.length)}</div></div><div class="tile t-info"><div class="lbl">Alleen live</div><div class="big">${nf(C.alleenLive.length)}</div></div></div>
    ${C.beide.length ? `<details class="mt12"${nAnders ? ' open' : ''}><summary>In beide: aantal PDF ↔ app (${C.beide.length})</summary><div class="scroll mt8"><table><tr><th>Product</th><th>In de app</th><th class="n">Pick PDF → nu</th><th class="n">PDF</th><th class="n">App</th><th>Stand</th><th>Reden</th></tr>${C.beide.map(rijBeide).join('')}</table></div></details>` : ''}
    ${C.alleenPdf.length ? `<details class="mt12" open><summary>Alleen in PDF (${C.alleenPdf.length})</summary><div class="scroll mt8"><table><tr><th>Product</th><th>Pick (PDF)</th><th class="n">Pickvrd PDF</th><th class="n">Aantal PDF</th><th>Pick nu (vrij)</th><th>Stand</th><th>Reden</th></tr>${C.alleenPdf.map(rijPdf).join('')}</table></div></details>` : ''}
    ${C.alleenLive.length ? `<details class="mt12" open><summary>Alleen live (${C.alleenLive.length})</summary><div class="scroll mt8"><table><tr><th>Product</th><th>In de app</th><th>Pick (vrij)</th><th class="n">Onder / tot</th><th class="n">Aanvullen</th><th>Stand</th><th>Reden</th></tr>${C.alleenLive.map(rijLive).join('')}</table></div></details>` : ''}</div>`;
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
return { view, ververs, bijwerken, ronde, rondeLijst, vanVst, kandidaten, stand, gedaan, registreer, laadOpslag, uitleg, momenten, verversPdf, teOud, isPick, opNieuw:f => LUISTER.push(f), S };
})();
