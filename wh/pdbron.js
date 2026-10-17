/* =====================================================================
   IVOL Warehouse — Andere apps gebruiken productdata (17-10-2026, bouwplan 0.4, laatste vinkje)
   Schakelaar in 3.0 (Test → Productdata → Poort 0.4): catalog-rij `wh-pd-bron` = { aan:true|false, door, op }. Standaard UIT.
   UIT: niets verandert. Warehouse, Junior, Palletlabels en Containers doen exact wat ze deden.
   AAN:
     lezen    stuks per pallet, palletmaat, hoogte, gewicht, plaatsen, max per ligger, stuks per doos (en in Warehouse/Junior ook vloernaam,
              picklocatie, aanvullen bij en max op pick) komen eerst uit `productdata`. Leeg of `onb` = terugvallen op de oude plek (reserve).
     schrijven waar die apps zelf zo'n waarde opslaan, gaat hij ook naar `productdata` (bron invul, alleen als het veld leeg is of bron auto;
              Daans invoer, schattingen en geparkeerde velden worden nooit overschreven). De oude plek blijft ook gewoon geschreven.
   Per apparaat te overrulen met localStorage 'ivol-pd-bron' = 'aan' of 'uit' (testen).
   Dit bestand heeft geen afhankelijkheden: Palletlabels en Containers laden het los, de andere apps via wh/lijst.json.
   Schrijft nooit naar Picqer.
   ===================================================================== */
window.PDBRON = (function(){
'use strict';
const URL_ = 'https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/';
const KEY = 'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA';   // publieke sleutel, staat ook in wh/core.js
const SLEUTEL = 'wh-pd-bron';
const S = { aan:false, door:'', op:'', pd:{}, laden:null, fout:null };
const leeg = v => v === null || v === undefined || String(v).trim() === '';
const onb = v => leeg(v) || /^onb$/i.test(String(v).trim());
const getal = v => { if(leeg(v)) return null; const n = parseFloat(String(v).trim().replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
// eigen invoer van Daan of een schatting/park: een andere app mag daar nooit overheen
const BESCHERMD = new Set(['invul', 'spraak', 'tabel', 'overgezet', 'daan', 'claude', 'familie', 'maatgroep', 'samen', 'klein', 'kleuren', 'basisregel', 'regel', 'import']);

async function rest(method, pad, body, extra){
  const h = Object.assign({ apikey:KEY, Authorization:'Bearer ' + KEY }, body !== undefined ? { 'Content-Type':'application/json' } : {}, extra || {});
  const r = await fetch(URL_ + pad, { method, headers:h, body:body !== undefined ? JSON.stringify(body) : undefined });
  if(!r.ok) throw new Error(method + ' ' + pad.split('?')[0] + ' ' + r.status);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
function apparaat(){ try{ const o = localStorage.getItem('ivol-pd-bron'); return o === 'aan' ? true : o === 'uit' ? false : null; }catch(e){ return null; } }

/* ---------- laden: de schakelaar, en alleen als hij aan staat ook productdata ---------- */
function laad(vers, alleenSchakelaar){
  if(S.laden && !vers) return S.laden;
  S.laden = (async () => {
    try{
      const rij = await rest('GET', 'catalog?key=eq.' + SLEUTEL + '&select=data');
      const d = (rij && rij[0] && rij[0].data) || {};
      S.aan = d.aan === true; S.door = d.door || ''; S.op = d.op || '';
      const ap = apparaat(); if(ap !== null) S.aan = ap;
      S.pd = {};
      if(S.aan && !alleenSchakelaar){
        for(let van = 0; ; van += 1000){
          const deel = await rest('GET', 'productdata?select=productcode,data,meta&order=productcode&limit=1000&offset=' + van);
          (deel || []).forEach(r => { S.pd[r.productcode] = { data:r.data || {}, meta:r.meta || {} }; });
          if(!deel || deel.length < 1000) break;
        }
      }
      S.fout = null;
    }catch(e){ S.fout = e; S.aan = false; S.pd = {}; }   // lukt het niet, dan doen de apps gewoon wat ze deden
    return S.aan;
  })();
  return S.laden;
}
const aan = () => S.aan;
// zoals D.PD in core.js verwacht: alleen wat andere apps mogen lezen (geen onnagekeken schattingen)
const rijen = () => Object.keys(S.pd).map(c => { const r = S.pd[c], d = {}; Object.keys(r.data).forEach(k => { if(!(r.meta[k] && r.meta[k].tw)) d[k] = r.data[k]; }); return { productcode:c, data:d }; });

/* ---------- lezen ---------- */
// waarde uit productdata, of null (leeg, onb of schakelaar uit → de oude plek geldt)
function lees(code, veld, st){
  const stand = st || S;
  if(!(st ? true : S.aan)) return null;
  const r = stand.pd[code]; if(!r) return null;
  if(r.meta && r.meta[veld] && r.meta[veld].tw) return null;   // schatting van Claude die Daan nog niet heeft nagekeken: geen waarheid voor andere apps
  const v = r.data[veld]; const x = v && typeof v === 'object' ? v.v : v;
  return onb(x) ? null : String(x).trim();
}
// zelfde, maar productcode in elke schrijfwijze (het productgeheugen kent de hoofdletters niet altijd)
let lagen = null;
function leesLos(code, veld){
  if(!S.aan || leeg(code)) return null;
  if(!lagen || lagen.n !== Object.keys(S.pd).length){ lagen = { n:Object.keys(S.pd).length, m:{} }; Object.keys(S.pd).forEach(c => { lagen.m[c.toLowerCase()] = c; }); }
  const c = lagen.m[String(code).trim().toLowerCase()]; return c ? lees(c, veld) : null;
}
// alleen lezen-pagina's (Container-palletlabels): stuks per pallet van de regels in het productgeheugen (catalog-ean) eerst uit productdata
function overlayCatalog(cat){
  let n = 0;
  if(!S.aan) return 0;
  Object.values(cat || {}).forEach(g => {
    if(!g || !g.sub) return;
    const x = leesLos(g.sub, 'spp'); if(x === null) return;
    if(/^nvt$/i.test(x)){ g.qty = 'nvt'; n++; } else if(getal(x) > 0){ g.qty = String(getal(x)); n++; }
  });
  return n;
}
// pure keuze, voor de zelftest: productdata gaat voor, leeg of onb = reserve
const kies = (pdWaarde, oud) => onb(pdWaarde) ? oud : String(pdWaarde).trim();
const KOLOM = [['maat', 'palletmaat'], ['hoogte', 'hoogte_cm'], ['gewicht', 'gewicht_kg'], ['plaatsen', 'plaatsen'], ['maxlig', 'max_per_ligger']];
// producten-rijen (P): palletgegevens uit productdata, de rest blijft zoals het was. nvt telt niet (geen pallet).
function overlayProducten(P, st){
  const stand = st || S; let n = 0;
  if(!(st ? true : S.aan)) return 0;
  Object.keys(P || {}).forEach(code => {
    const r = stand.pd[code]; if(!r) return;
    KOLOM.forEach(([veld, kol]) => {
      const x = lees(code, veld, stand); if(x === null || /^nvt$/i.test(x)) return;
      if(veld === 'maat'){
        const m = x.replace(/\s/g, '').toLowerCase().replace('×', 'x').match(/^(\d+)x(\d+)$/); if(!m) return;
        P[code] = Object.assign({}, P[code], { palletmaat:m[1] + 'x' + m[2], lengte_cm:+m[1], breedte_cm:+m[2] }); n++;
      }else{
        const g = getal(x); if(g === null) return;
        P[code] = Object.assign({}, P[code], { [kol]:g }); n++;
      }
    });
  });
  return n;
}
// productgeheugen (catalog-ean) per productcode in kleine letters → regels: stuks per pallet uit productdata (alleen een getal of nvt; 0 en onb blijven zoals ze waren)
function overlayGeh(GEH, st){
  const stand = st || S; let n = 0;
  if(!(st ? true : S.aan)) return 0;
  Object.keys(GEH || {}).forEach(k => {
    const code = Object.keys(stand.pd).find(c => c.toLowerCase() === k); if(!code) return;
    const x = lees(code, 'spp', stand); if(x === null) return;
    const q = /^nvt$/i.test(x) ? 'nvt' : getal(x) > 0 ? String(getal(x)) : null; if(q === null) return;
    GEH[k] = GEH[k].map(g => Object.assign({}, g, { qty:q })); n++;
  });
  return n;
}

/* ---------- schrijven: naast de oude plek, nooit over eigen invoer heen ---------- */
// pure: wat zou er in de rij komen? (zelftest en schrijf gebruiken dezelfde regel)
function plan(rij, wijz, nu, reden){
  const data = Object.assign({}, rij && rij.data), meta = Object.assign({}, rij && rij.meta), gezet = [], over = [];
  Object.keys(wijz || {}).forEach(veld => {
    const w = wijz[veld]; if(onb(w)) return;   // niets leeg of onb wegschrijven
    const cv = data[veld], m = meta[veld] || {}, nu0 = !leeg(cv) && !/^onb$/i.test(String(cv).trim());
    if(nu0 && m.bron !== 'auto'){ if(String(cv).trim() !== String(w).trim()) over.push(veld); return; }   // al ingevuld door iemand of iets anders
    if(m.park || m.tw){ over.push(veld); return; }
    data[veld] = String(w).trim(); meta[veld] = { op:nu, bron:'invul', uit:reden || 'Andere app' }; gezet.push(veld);
  });
  return { data, meta, gezet, over };
}
async function schrijf(code, wijz, reden){
  if(!S.aan || !code) return { gezet:[], over:[] };
  try{
    const nu = new Date().toISOString();
    const vers = await rest('GET', 'productdata?select=productcode,data,meta&productcode=eq.' + encodeURIComponent(code));
    const rij = (vers && vers[0]) || { productcode:code, data:{}, meta:{} };
    const p = plan(rij, wijz, nu, reden);
    if(p.gezet.length){
      await rest('POST', 'productdata?on_conflict=productcode', [{ productcode:code, data:p.data, meta:p.meta, updated_at:nu }], { Prefer:'resolution=merge-duplicates,return=minimal' });
      S.pd[code] = { data:p.data, meta:p.meta };
    }
    return p;
  }catch(e){ console.warn('productdata schrijven:', e.message); return { gezet:[], over:[], fout:e.message }; }
}
// producten-kolommen (Containers, Productkaart) → productdata-velden
function vanProducten(row){
  const w = {};
  KOLOM.forEach(([veld, kol]) => { if(!leeg(row[kol])) w[veld] = veld === 'maat' ? String(row[kol]).replace(/\s/g, '').toLowerCase() : String(row[kol]); });
  return w;
}
const schrijfRij = (code, row, reden) => schrijf(code, vanProducten(row || {}), reden);
// wh-aanvul (Warehouse, Junior): { code: { pick, lvl, tot, max, type } } → pick, aanvullen bij, max op pick
function spiegelAanvul(patch){
  if(!S.aan) return;
  Object.keys(patch || {}).forEach(code => {
    const r = patch[code]; if(!r || typeof r !== 'object') return;
    const w = {}, mx = getal(r.max ?? r.tot);
    if(r.type === 'bulk') w.pick = 'nee'; else if(r.pick) w.pick = 'ja';
    if(getal(r.lvl) > 0) w.lvl = String(getal(r.lvl));
    if(mx > 0) w.maxpick = String(mx);
    if(Object.keys(w).length) schrijf(code, w, 'Warehouse/Junior: aanvulbase');
  });
}

/* ---------- zelftest: lezen met terugval, schrijven naar beide plekken, schakelaar uit = niets ---------- */
function zelftest(){
  const f = [];
  const eis = (ok, t) => { if(!ok) f.push(t); };
  const st = { pd:{ A:{ data:{ spp:'12', maat:'100x150', hoogte:'', gewicht:'onb', plaatsen:'2', maxlig:'1' }, meta:{} }, B:{ data:{ spp:'nvt' }, meta:{} } } };
  eis(lees('A', 'spp', st) === '12', 'lezen: waarde uit productdata');
  { const t = { pd:{ T:{ data:{ spp:'7', maat:'80x120' }, meta:{ spp:{ tw:1 } } } } }; eis(lees('T', 'spp', t) === null && lees('T', 'maat', t) === '80x120', 'lezen: een onnagekeken schatting (tw) telt niet, de rest wel'); }
  eis(lees('A', 'hoogte', st) === null, 'lezen: leeg → reserve');
  eis(lees('A', 'gewicht', st) === null, 'lezen: onb → reserve');
  eis(kies('onb', '8') === '8' && kies('', '8') === '8' && kies('12', '8') === '12', 'kiezen: productdata gaat voor, leeg of onb is reserve');
  const P = { A:{ productcode:'A', palletmaat:'80x120', hoogte_cm:150, gewicht_kg:300, plaatsen:1, max_per_ligger:3 }, B:{ productcode:'B', palletmaat:'80x120' }, C:{ productcode:'C', palletmaat:'90x120' } };
  overlayProducten(P, st);
  eis(P.A.palletmaat === '100x150' && P.A.lengte_cm === 100 && P.A.breedte_cm === 150, 'overlay: palletmaat uit productdata');
  eis(P.A.hoogte_cm === 150 && P.A.gewicht_kg === 300, 'overlay: leeg of onb laat de oude waarde staan');
  eis(P.A.plaatsen === 2 && P.A.max_per_ligger === 1, 'overlay: plaatsen en max per ligger uit productdata');
  eis(P.B.palletmaat === '80x120' && P.C.palletmaat === '90x120', 'overlay: nvt en onbekende producten blijven zoals ze waren');
  const GEH = { a:[{ name:'X', qty:'8', sub:'A' }, { name:'Y', qty:'9', sub:'A' }], c:[{ name:'Z', qty:'5', sub:'C' }] };
  overlayGeh(GEH, st);
  eis(GEH.a.every(g => g.qty === '12') && GEH.c[0].qty === '5', 'overlay: stuks per pallet uit productdata, rest ongemoeid');
  const nu = 'T';
  const p1 = plan({ data:{}, meta:{} }, { spp:'40', maat:'80x120' }, nu);
  eis(p1.gezet.length === 2 && p1.data.spp === '40' && p1.meta.spp.bron === 'invul', 'schrijven: leeg veld wordt gevuld met bron invul');
  const p2 = plan({ data:{ spp:'10', hoogte:'120', maat:'100x150', gewicht:'200', plaatsen:'1' }, meta:{ spp:{ bron:'auto' }, hoogte:{ bron:'invul' }, maat:{ bron:'daan' }, gewicht:{ bron:'claude', tw:1 }, plaatsen:{ bron:'daan', park:1 } } },
    { spp:'40', hoogte:'150', maat:'80x120', gewicht:'250', plaatsen:'2' }, nu);
  eis(p2.data.spp === '40' && p2.gezet.join() === 'spp', 'schrijven: alleen bron auto wordt vervangen');
  eis(p2.data.hoogte === '120' && p2.data.maat === '100x150' && p2.data.gewicht === '200' && p2.data.plaatsen === '1', 'schrijven: eigen invoer, Daan, schatting en geparkeerd blijven');
  eis(plan({ data:{}, meta:{} }, { spp:'', hoogte:'onb' }, nu).gezet.length === 0, 'schrijven: leeg of onb gaat nooit naar productdata');
  const uit = { pd:st.pd }; const nu0 = S.aan; S.aan = false;
  eis(lees('A', 'spp') === null && overlayProducten({ A:{ palletmaat:'80x120' } }) === 0 && overlayGeh({ a:[{ qty:'8' }] }) === 0, 'schakelaar uit: niets gelezen, niets veranderd');
  S.aan = nu0;
  eis(JSON.stringify(vanProducten({ palletmaat:'100 X 150', hoogte_cm:130, gewicht_kg:null, plaatsen:2, max_per_ligger:1 })) === JSON.stringify({ maat:'100x150', hoogte:'130', plaatsen:'2', maxlig:'1' }), 'schrijven: producten-kolommen naar productdata-velden');
  return { ok:!f.length, fouten:f };
}

return { laad, aan, rijen, lees, leesLos, overlayCatalog, kies, overlayProducten, overlayGeh, plan, schrijf, schrijfRij, vanProducten, spiegelAanvul, zelftest, S, BESCHERMD };
})();
