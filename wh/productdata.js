/* =====================================================================
   IVOL Warehouse — Productdata (7-10-2026, bouwplan 0.4 "Eén waarheid")
   Eén kaart per product voor alles wat Picqer niet kent. Sleutel = exacte Picqer-productcode.
   Tabel productdata: productcode → data {veld: waarde}, meta {veld: {op, bron}}.
   Picqer blijft eigenaar van naam, code, EAN, leverancier en prijzen: hier alleen zichtbaar.

   Velden in 4 lagen, je vult laag voor laag:
     1 Prioriteit  elke dag nodig (aanvullen, labels)
     2 Belangrijk  bulk, containers, VST
     3 Medium      labels, dozen, stapelen
     4 Extra       als de rest af is
   Voorstellen (geel, altijd controleren) komen uit: wat al bekend was (palletlabels, containers,
   aanvulbase), kleurgenoten (zelfde product en maat), pakbonnen, VST-pallets, bulkpallets,
   Picqer-instellingen en de productfamilie. Getoetst op 7-10 tegen de bekende waarden (stuks per pallet):
   kleurgenoot 83% gelijk, VST ≥ 2 gelijke pallets 80%, bulk ≥ 2 gelijke pallets 84%, pakbon 66%,
   familie (andere maat) 43% → die heet "schatting". Palletmaat en hoogte van een kleurgenoot: 100%.
   ===================================================================== */
window.WHPD = (function(){
'use strict';
const { $, esc, leeg, num, nf, plural, toast, api, upsert, D } = WH;
const app = $('app');
const V = () => window.WHV;

/* ---------- velden ---------- */
const LAGEN = [
  { n:1, t:'Prioriteit', u:'Elke dag nodig: aanvullen en labels' },
  { n:2, t:'Belangrijk', u:'Bulk, containers en VST' },
  { n:3, t:'Medium', u:'Labels, dozen en stapelen' },
  { n:4, t:'Extra', u:'Als de rest af is' }
];
const PLAATSEN = ['1', '1,3', '2', '3'];
const MATEN = ['80x120', '100x100', '100x120', '110x110', '90x120', '100x150', '120x150', '120x180', '100x200', '120x200', '120x240', '130x210', '130x250', '40x120', '40x200'];
const VELDEN = {
  spp:     { t:'Stuks per pallet', laag:1, type:'num', eh:true, hint:'nvt = komt niet op pallet · onb = weet ik niet' },
  pick:    { t:'Picklocatie', laag:1, type:'keus', opt:[['ja', 'Ja'], ['nee', 'Nee, alleen bulk']] },
  maxpick: { t:'Max op pick', laag:1, type:'num', eh:true, hint:'zoveel past er op de picklocatie' },
  lvl:     { t:'Aanvullen bij', laag:1, type:'num', eh:true, hint:'aanvullen als er minder ligt dan dit' },
  met:     { t:'Aanvullen met', laag:1, type:'keus', opt:[['pallet', 'Volle pallet'], ['deel', 'Deel van pallet'], ['doos', 'Doos / los']] },
  maat:    { t:'Palletmaat', laag:2, type:'maat', eh2:'cm' },
  hoogte:  { t:'Hoogte incl. pallet', laag:2, type:'num', eh2:'cm' },
  gewicht: { t:'Gewicht volle pallet', laag:2, type:'num', eh2:'kg' },
  plaatsen:{ t:'Plaatsen op ligger', laag:2, type:'keus', opt:PLAATSEN.map(x => [x, x]) },
  vn:      { t:'Vloernaam (label)', laag:3, type:'tekst', breed:true },
  spd:     { t:'Stuks per doos', laag:3, type:'num', eh:true, hint:'nvt = geen doos' },
  maxlig:  { t:'Max pallets per ligger', laag:3, type:'num', hint:'gewicht of hoogte' },
  kgst:    { t:'Gewicht per stuk', laag:3, type:'num', eh2:'kg', hint:'alleen als Picqer niet klopt' },
  doos:    { t:'Doosmaat l×b×h', laag:4, type:'tekst', eh2:'cm', hint:'bijv. 60x40x30' },
  opm:     { t:'Opmerking opbouw / stapelen', laag:4, type:'tekst', breed:true }
};
const VOLG = Object.keys(VELDEN);
const inLaag = n => VOLG.filter(k => VELDEN[k].laag === n);
const LEEGWAARDE = v => leeg(v) || String(v).trim().toLowerCase() === 'onb';
const NVT = v => String(v ?? '').trim().toLowerCase() === 'nvt';

/* ---------- toestand ---------- */
const S = { pd:{}, extra:{}, cat:null, labels:{}, klaar:false, laden:null, mist:false, fout:null, idx:null };
const bewaard = k => { try{ return localStorage.getItem('wh-pd-' + k); }catch(e){ return null; } };
const bewaar = (k, v) => { try{ localStorage.setItem('wh-pd-' + k, v); }catch(e){} };
const UI = { scope:bewaard('scope2') || 'belangrijk', laag:+(bewaard('laag') || 1), lev:bewaard('lev') || '', zoek:'', over:new Set(), i:0, concept:{}, alles:{}, mig:null };

/* ---------- laden ---------- */
const isMissing = e => !!e && (e.status === 404 || /PGRST205|42P01|does not exist|Could not find the table/i.test(e.body || ''));
async function laad(vers){
  if(S.laden && !vers) return S.laden;
  S.laden = (async () => {
    const T = window.WHC ? WHC.tabel : (t, q) => WH.getAll(t, q);
    try{
      const [rows, extra, cat] = await Promise.all([
        T('productdata', 'select=*', ['updated_at']).catch(e => { if(isMissing(e)){ S.mist = true; return []; } throw e; }),
        T('producten', 'select=productcode,gewicht_product_g,lengte_product_cm,breedte_product_cm,hoogte_product_cm,leverancier_code&order=productcode', ['picqer_datum', 'updated_at']).catch(() => []),
        (window.WHC ? WHC.catalog(['wh-pq-cat', 'catalog-ean']) : api('GET', 'catalog?key=in.(%22wh-pq-cat%22,%22catalog-ean%22)&select=key,data,updated_at')).catch(() => [])
      ]);
      S.pd = {}; rows.forEach(r => { S.pd[r.productcode] = { data:r.data || {}, meta:r.meta || {}, t:r.updated_at }; });
      S.extra = {}; extra.forEach(r => { S.extra[r.productcode] = r; });
      S.cat = ((cat || []).find(r => r.key === 'wh-pq-cat') || {}).data || null;
      S.labels = ((cat || []).find(r => r.key === 'catalog-ean') || {}).data || {};
      S.idx = null; S.klaar = true; S.fout = null;
    }catch(e){ S.fout = e; }
  })();
  return S.laden;
}

/* ---------- productfamilies ---------- */
// Familie = zelfde leverancier + zelfde naam zonder kleuren, maten en getallen ("alle Napoli-stoelen", "alle whiteboards van Red Sun").
// Maatgroep = familie + zelfde maten in de naam: kleurgenoten, die delen alle palletgegevens.
const KLEUR = /\b(zwart|zwarte|grijs|grijze|lichtgrijs|donkergrijs|blauw|blauwe|rood|rode|groen|groene|wit|witte|bruin|bruine|geel|gele|oranje|beige|zand|sand|antraciet|grafiet|graniet|paars|roze|naturel|natural|natuur|black|grey|gray|blue|red|green|white|brown|yellow|orange|purple|pink|multicolor|assorti|zilver|silver|goud|gold|transparant|blank|bla|gre|whi|blk|gry|brn|nat)\b/g;
const STOP = new Set('per breedte breed dikte dik lengte lang hoogte hoog let op uit de het een en van voor met in rol cm mm incl ca stuk stuks set'.split(' '));
function famNaam(n){
  let s = String(n || '').toLowerCase();
  s = s.replace(/€\s*[\d.,]+(\s*per\s*m2)?/g, ' ').replace(KLEUR, ' ');
  s = s.replace(/\d+[.,]?\d*\s*[x×]\s*\d+[.,]?\d*(\s*[x×]\s*\d+[.,]?\d*)?\s*(cm|mm|m)?/g, ' ');
  s = s.replace(/\d+[.,]?\d*\s*(mm|cm|m2|m²|m|kg|gr|g|kv|l|st|stuks)\b/g, ' ').replace(/\d+/g, ' ').replace(/[^a-zà-ÿ]+/g, ' ');
  return s.split(' ').filter(w => w.length > 1 && !STOP.has(w)).join(' ');
}
function maatSig(n){
  let s = String(n || '').toLowerCase();
  const d = [], u = [];
  s = s.replace(/(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)(?:\s*[x×]\s*(\d+[.,]?\d*))?\s*(cm|mm|m)?/g, (m0, a, b, c) => { d.push([a, b, c].filter(Boolean).join('x')); return ' '; });
  s.replace(/(\d+[.,]?\d*)\s*(mm|cm|m2|kv)\b/g, (m0, a, b) => { u.push(a + ' ' + b); return ''; });
  return d.concat(u).join(' · ');
}
function index(){
  if(S.idx) return S.idx;
  const fam = {}, famVan = {}, varVan = {}, vari = {};
  Object.values(D.P).forEach(p => {
    const code = p.productcode, fn = famNaam(p.naam);
    const fk = String(p.leverancier || '?').slice(0, 24) + '|' + (fn || code.toLowerCase());
    const vk = fk + '|' + maatSig(p.naam);
    (fam[fk] = fam[fk] || []).push(code); famVan[code] = fk;
    (vari[vk] = vari[vk] || []).push(code); varVan[code] = vk;
  });
  // pakbonregels per product (alle containers, ook afgeronde)
  const pb = {};
  (D.CONT || []).forEach(c => ((c.regels || (c.data && c.data.regels)) || []).forEach(r => { if(r && r.productcode){ const k = D.PLOW[String(r.productcode).toLowerCase()] || r.productcode; (pb[k] = pb[k] || []).push(r); } }));
  // producten op een open container (komt binnen)
  const binnen = new Set();
  (D.CONT || []).filter(c => c.status !== 'afgerond').forEach(c => ((c.regels || (c.data && c.data.regels)) || []).forEach(r => { if(r && r.productcode) binnen.add(D.PLOW[String(r.productcode).toLowerCase()] || r.productcode); }));
  const bo = {}; (D.BO || []).forEach(b => { const k = D.PLOW[String(b.productcode || '').toLowerCase()] || b.productcode; bo[k] = (bo[k] || 0) + 1; });
  S.idx = { fam, famVan, varVan, vari, pb, binnen, bo };
  return S.idx;
}
const kleurgenoten = code => (index().vari[index().varVan[code]] || []).filter(x => x !== code);
const famLeden = code => (index().fam[index().famVan[code]] || []).filter(x => x !== code);

/* ---------- feiten over een product ---------- */
const abcVan = code => (D.P[code] && D.P[code].abc) || (S.cat && S.cat.abc && S.cat.abc[code]) || '';
const pdVan = code => num(S.cat && S.cat.pd && S.cat.pd[code]) || 0;
const vkmVan = code => num(D.VK[code] && D.VK[code].per_maand) || 0;
const ABCR = { A:0, B:1, C:2 };
const rang = code => (ABCR[abcVan(code)] ?? 3) * 1e7 - pdVan(code) * 100 - vkmVan(code);
function eenheid(code){
  const p = D.P[code] || {}, t = String(p.tags || '').toLowerCase(), n = String(p.naam || '').toLowerCase();
  if(t.includes('meterroll') || /per meter|per strekkende meter/.test(n)) return { e:'m', mv:'m', t:'per meter' };
  if(t.includes('cmroll') || /per cm\b/.test(n)) return { e:'cm', mv:'cm', t:'per cm' };
  if(t.includes('fullroll')) return { e:'rol', mv:'rollen', t:'per rol' };
  if(/per m2|per m²/.test(n)) return { e:'m2', mv:'m²', t:'per m²' };
  return { e:'st', mv:'st.', t:'per stuk' };
}
const geh1 = code => (D.GEH[String(code || '').toLowerCase()] || [])[0] || null;
function locaties(code){
  const vr = D.VR[code] || { locs:{}, geen:0, cont:{} };
  const pick = [], bulk = [];
  Object.entries(vr.locs || {}).forEach(([l, n]) => { (D.LOC[l] && D.LOC[l].bulk ? bulk : pick).push([l, n]); });
  // Picqer-export kent ook locaties zonder voorraad (vaste picklocatie)
  String((D.P[code] || {}).locaties_hm || '').split(/[,|]/).map(s => s.trim()).filter(l => l && !/^container/i.test(l)).forEach(l => {
    if(!pick.some(x => x[0] === l) && !bulk.some(x => x[0] === l)) (D.LOC[l] && D.LOC[l].bulk ? bulk : pick).push([l, 0]);
  });
  return { pick, bulk, geen:vr.geen || 0 };
}
function modus(lijst){
  const c = {}; lijst.filter(n => n > 0).forEach(n => c[n] = (c[n] || 0) + 1);
  const best = Object.entries(c).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  return best ? { v:+best[0], n:best[1], van:lijst.filter(n => n > 0).length } : null;
}

/* ---------- waarden: productdata, anders wat al bekend was ---------- */
// palletlabels (catalog-ean) kan meerdere regels per product hebben: zelfde product, andere vloernaam of ander aantal.
// Eén waarde → overzetten. Verschillende waarden → niet overzetten, Daan kiest (conflict).
const labelRegels = code => (D.GEH[String(code || '').toLowerCase()] || []).slice().sort((a, b) => (b.used || 0) - (a.used || 0));
function labelSpp(code){
  const m = new Map();   // volgorde: laatst gebruikte regel eerst (een gewoon object zet getallen op volgorde)
  labelRegels(code).forEach(g => {
    const q = String(g.qty ?? '').trim(); if(!q || /^0+([.,]0+)?$/.test(q) || /^onb/i.test(q) || /^x$/i.test(q)) return;   // 0 = label zonder aantal
    const k = NVT(q) ? 'nvt' : (num(q) !== null ? String(num(q)) : q);
    if(!m.has(k)) m.set(k, []);
    m.get(k).push(g.name || g.sub);
  });
  return m;
}
function labelNamen(code){ return [...new Set(labelRegels(code).map(g => String(g.name || '').replace(/\s+/g, ' ').trim()).filter(Boolean))]; }
function oudeWaarde(code, k){
  const g = geh1(code), p = D.P[code] || {}, a = D.AANVUL[code], lr = labelRegels(code);
  switch(k){
    case 'spp': { const m = labelSpp(code), ks = [...m.keys()]; if(!ks.length) return null; if(ks.length > 1) return { conflict:ks.map(v => ({ v, waar:m.get(v) })), bron:'palletlabels' }; return { v:ks[0], bron:'palletlabels' }; }
    case 'vn': { const n = labelNamen(code); if(!n.length) return null; if(n.length > 1) return { conflict:n.map(v => ({ v, waar:[] })), bron:'palletlabels' }; return { v:n[0], bron:'palletlabels' }; }
    case 'met': return lr.some(g => g.aanvul === 'deel' || /^0+$/.test(String(g.qty ?? '').trim())) ? { v:'deel', bron:'palletlabels (aanvulpallet)' } : null;
    case 'maat': return p.palletmaat ? { v:p.palletmaat, bron:'containers' } : null;
    case 'hoogte': return !leeg(p.hoogte_cm) ? { v:String(p.hoogte_cm), bron:'containers' } : null;
    case 'gewicht': return !leeg(p.gewicht_kg) ? { v:String(p.gewicht_kg), bron:'containers' } : null;
    case 'plaatsen': return !leeg(p.plaatsen) ? { v:plaatsOpt(p.plaatsen), bron:'containers' } : null;
    case 'maxlig': return !leeg(p.max_per_ligger) ? { v:String(p.max_per_ligger), bron:'containers' } : null;
    case 'opm': return p.opmerking ? { v:p.opmerking, bron:'containers' } : null;
    case 'maxpick': return a && a.ok && !leeg(a.max ?? a.tot) ? { v:String(a.max ?? a.tot), bron:'aanvulbase' } : null;
    case 'lvl': return a && a.ok && !leeg(a.lvl) ? { v:String(a.lvl), bron:'aanvulbase' } : null;
    case 'pick': return a && a.ok ? { v:a.pick ? 'ja' : (a.type === 'bulk' ? 'nee' : null), bron:'aanvulbase' } : null;
  }
  return null;
}
const pdWaarde = (code, k) => { const r = S.pd[code]; return r && r.data && !leeg(r.data[k]) ? String(r.data[k]) : null; };
function plaatsOpt(v){
  const n = num(v); if(n === null) return String(v);
  return PLAATSEN.reduce((b, x) => Math.abs(num(x) - n) < Math.abs(num(b) - n) ? x : b, PLAATSEN[0]);
}
function plaatsenUitMaat(maat){
  const m = String(maat || '').match(/(\d+)\s*x\s*(\d+)/); if(!m) return null;
  const a = +m[1], b = +m[2], voor = Math.max(a, b) > 120 ? Math.max(a, b) : Math.min(a, b);
  const v = voor / 90;
  return plaatsOpt(v <= 1 ? 1 : v > 1.5 ? Math.ceil(v) : Math.ceil(v * 10) / 10);
}
// is dit veld nodig voor dit product? (n.v.t. door een ander antwoord)
function nodig(code, k, w){
  const spp = w('spp'), pick = w('pick'), e = eenheid(code).e;
  if(['maat', 'hoogte', 'gewicht', 'plaatsen', 'maxlig'].includes(k) && NVT(spp)) return false;
  if(['maxpick', 'lvl', 'met'].includes(k) && pick === 'nee') return false;
  if(['spd', 'doos'].includes(k) && (e === 'm' || e === 'cm' || e === 'rol')) return false;
  if(k === 'kgst') return false;   // optioneel: alleen invullen als het Picqer-gewicht niet klopt
  return true;
}
// huidige toestand van een veld
function staat(code, k){
  const v = pdWaarde(code, k), o = oudeWaarde(code, k);
  const r = S.pd[code], bron = r && r.meta && r.meta[k] && r.meta[k].bron;
  if(v !== null && !LEEGWAARDE(v)){
    // eerder overgezet terwijl palletlabels twee waarden had: opnieuw laten kiezen
    if(bron === 'overgezet' && o && o.conflict) return { v:'', s:'open', conflict:o.conflict };
    return { v, s:'ok' };
  }
  if(o && o.conflict) return { v:'', s:'open', conflict:o.conflict };
  if(o && !LEEGWAARDE(o.v)) return { v:o.v, s:'oud', bron:o.bron };
  return { v:v || '', s:'open' };
}
// producten met dubbele regels in palletlabels
function dubbel(){
  const uit = [];
  Object.keys(D.P).forEach(code => {
    const lr = labelRegels(code); if(lr.length < 2) return;
    const spp = oudeWaarde(code, 'spp'), vn = oudeWaarde(code, 'vn');
    uit.push({ code, regels:lr, sppConflict:!!(spp && spp.conflict), vnConflict:!!(vn && vn.conflict) });
  });
  return uit.sort((a, b) => b.sppConflict - a.sppConflict || rang(a.code) - rang(b.code));
}
// labelregels die niet bij een bestaand Picqer-product horen
function wees(){
  const uit = [];
  Object.entries(S.labels || {}).forEach(([naam, g]) => {
    if(!g) return;
    const sub = String(g.sub ?? '').trim();
    if(!sub) uit.push({ naam, sub:'', qty:g.qty, waarom:'geen productcode' });
    else if(!D.PLOW[sub.toLowerCase()]) uit.push({ naam, sub, qty:g.qty, waarom:'niet in Picqer' });
  });
  return uit;
}
const waardeFn = code => k => { const st = staat(code, k); return st.s === 'open' ? (UI.concept[code] && UI.concept[code][k]) || '' : st.v; };
// voor op het scherm: wat er nu staat, anders het voorstel (zo rekent plaatsen mee met een voorgestelde palletmaat)
const schermFn = code => { const f = k => { const c = UI.concept[code]; if(c && c[k] !== undefined) return c[k]; const st = staat(code, k); if(st.s === 'ok') return st.v; const v = voorstel(code, k, f); return v && !leeg(v.v) ? v.v : st.v; }; return f; };
function open(code, laag){
  const w = waardeFn(code);
  return inLaag(laag).filter(k => nodig(code, k, w) && staat(code, k).s !== 'ok');
}

/* ---------- voorstellen ---------- */
function vanGenoten(lijst, k, bron){
  const vals = {};
  lijst.forEach(x => { const st = staat(x, k); if(st.s !== 'open' && !NVT(st.v)) (vals[st.v] = vals[st.v] || []).push(x); });
  const best = Object.entries(vals).sort((a, b) => b[1].length - a[1].length)[0];
  if(!best) return null;
  return { v:best[0], bron:bron + ' ' + best[1].slice(0, 2).join(', ') + (best[1].length > 2 ? ' +' + (best[1].length - 2) : ''), z:'hoog' };
}
function pbRegels(code){ return index().pb[code] || []; }
function voorstel(code, k, w){
  const p = D.P[code] || {}, x = S.extra[code] || {}, eh = eenheid(code), kg = kleurgenoten(code);
  const oud = oudeWaarde(code, k);
  if(oud && oud.conflict){
    const st = staat(code, k);
    if(st.s === 'open') return { v:oud.conflict[0].v, bron:'palletlabels heeft ' + oud.conflict.length + ' verschillende: ' + oud.conflict.map(c => c.v + (c.waar && c.waar.length && k === 'spp' ? ' (' + c.waar.join(', ') + ')' : '')).join(' / ') + ' · eerste = laatst gebruikt, kies de juiste', z:'laag' };
  }
  if(oud && !LEEGWAARDE(oud.v) && pdWaarde(code, k) === null) return { v:oud.v, bron:'stond al in ' + oud.bron, z:'hoog' };
  const genoot = kg.length ? vanGenoten(kg, k, 'zelfde als') : null;
  const fam = () => { const f = vanGenoten(famLeden(code).filter(c => !kg.includes(c)), k, 'familie:'); if(f) f.z = 'laag'; return f; };
  switch(k){
    case 'spp': {
      const vst = modus((D.VSTVR[code] || []).map(a => num(a[1]) || 0));
      if(vst && vst.n >= 2) return { v:String(vst.v), bron:'VST: ' + vst.n + ' van ' + vst.van + ' pallets hebben ' + nf(vst.v), z:'hoog' };
      const bl = modus(locaties(code).bulk.map(a => num(a[1]) || 0));
      if(bl && bl.n >= 2) return { v:String(bl.v), bron:'bulk: ' + bl.n + ' pallets van ' + nf(bl.v), z:'hoog' };
      if(genoot) return genoot;
      const r = pbRegels(code).find(r => r.soort === 'pallet' && num(r.per));
      if(r) return { v:String(num(r.per) * (num(r.factor) || 1)), bron:'pakbon: ' + nf(num(r.per)) + ' per pallet', z:'mid' };
      if(vst) return { v:String(vst.v), bron:'VST: 1 pallet van ' + nf(vst.v) + ' (kan een restpallet zijn)', z:'laag' };
      return fam();
    }
    case 'pick': {
      const l = locaties(code);
      if(l.pick.length) return { v:'ja', bron:'Picqer: ' + l.pick.map(a => a[0]).slice(0, 3).join(', '), z:'hoog' };
      if(l.bulk.length) return { v:'nee', bron:'Picqer: alleen bulk (' + l.bulk.map(a => a[0]).slice(0, 2).join(', ') + ')', z:'mid' };
      return genoot;
    }
    case 'maxpick': {
      const pq = D.PQ[code];
      if(pq && num(pq[1]) > 1) return { v:String(num(pq[1])), bron:'Picqer: vul aan tot ' + nf(num(pq[1])), z:'mid' };
      if(genoot) return Object.assign(genoot, { z:'mid' });
      const l = locaties(code), m = Math.max(0, ...l.pick.map(a => num(a[1]) || 0));
      if(m > 0) return { v:String(m), bron:'nu ' + nf(m) + ' op pick', z:'laag' };
      return null;
    }
    case 'lvl': {
      const pq = D.PQ[code];
      if(pq && num(pq[0]) > 1) return { v:String(num(pq[0])), bron:'Picqer: aanvulniveau ' + nf(num(pq[0])), z:'mid' };
      if(genoot) return Object.assign(genoot, { z:'mid' });
      // ± 2 dagen picken, nooit meer dan de helft van wat er op pick past
      const pd = pdVan(code), vk = vkmVan(code), mx = num(w('maxpick'));
      let v = pd > 0 ? Math.ceil(pd * 2) : vk > 0 ? Math.ceil(vk / 10) : null;
      if(v === null) return null;
      if(mx) v = Math.max(1, Math.min(v, Math.floor(mx / 2)));
      return { v:String(v), bron:'± 2 dagen picken' + (mx ? ', max de helft van max op pick' : '') + (pq && num(pq[0]) === 1 ? ' · Picqer staat op standaard 1' : ''), z:'laag' };
    }
    case 'met': {
      if(genoot) return genoot;
      const spp = num(w('spp')), mx = num(w('maxpick'));
      if(NVT(w('spp'))) return { v:'doos', bron:'komt niet op pallet', z:'mid' };
      if(spp && mx) return mx >= spp ? { v:'pallet', bron:'max op pick ≥ 1 pallet', z:'mid' } : { v:'deel', bron:'max op pick (' + nf(mx) + ') < 1 pallet (' + nf(spp) + ')', z:'mid' };
      return null;
    }
    case 'maat': {
      if(genoot) return genoot;
      const r = pbRegels(code).find(r => r.palletmaat || r.maat);
      if(r) return { v:String(r.palletmaat || r.maat), bron:'pakbon', z:'mid' };
      const f = fam(); if(f) return f;
      const L = num(x.lengte_product_cm), B = num(x.breedte_product_cm);
      if(L >= 60 && B >= 60){ const m = passendeMaat(L, B); if(m) return { v:m, bron:'productmaat ' + nf(L) + '×' + nf(B) + ' cm (Picqer)', z:'laag' }; }
      return null;
    }
    case 'hoogte': {
      return genoot || fam();
    }
    case 'gewicht': {
      if(genoot) return genoot;
      const r = pbRegels(code).find(r => r.soort === 'pallet' && num(r.bruto_per));
      if(r) return { v:String(Math.ceil(num(r.bruto_per))), bron:'pakbon: bruto per pallet', z:'mid' };
      const spp = num(w('spp')), g = num(x.gewicht_product_g);
      if(spp && g && eh.e === 'st') return { v:String(Math.ceil(spp * g / 1000 + 15)), bron:nf(spp) + ' × ' + nf(g / 1000, 2) + ' kg (Picqer-gewicht) + 15 kg pallet', z:'laag' };
      return fam();
    }
    case 'plaatsen': {
      const m = w('maat');
      if(m && /\d+\s*x\s*\d+/.test(m)) return { v:plaatsenUitMaat(m), bron:'uit palletmaat ' + m + ' (plaats = 90 cm)', z:'hoog' };
      return genoot;
    }
    case 'vn': {
      if(genoot && false) return genoot;
      const s = vnVoorstel(p.naam); return s ? { v:s, bron:'uit Picqer-naam', z:'mid' } : null;
    }
    case 'spd': {
      if(genoot) return genoot;
      const r = pbRegels(code).find(r => r.soort !== 'pallet' && num(r.per) > 1);
      if(r) return { v:String(num(r.per) * (num(r.factor) || 1)), bron:'pakbon: ' + nf(num(r.per)) + ' per pak', z:'mid' };
      return fam();
    }
    case 'maxlig': return genoot || fam();
    case 'kgst': { const g = num(x.gewicht_product_g); return g ? { v:String(g / 1000), bron:'Picqer', z:'mid' } : genoot; }
    case 'doos': return genoot;
    case 'opm': return genoot;
  }
  return null;
}
function passendeMaat(L, B){
  const a = Math.max(L, B), b = Math.min(L, B);
  const kand = MATEN.map(m => m.split('x').map(Number)).map(([x, y]) => [Math.max(x, y), Math.min(x, y)]).filter(([x, y]) => x >= a && y >= b).sort((p, q) => p[0] * p[1] - q[0] * q[1]);
  return kand.length ? kand[0][1] + 'x' + kand[0][0] : null;
}
function vnVoorstel(naam){
  let s = String(naam || '').trim(); if(!s) return '';
  s = s.replace(/\s*-\s*PER\s+(CM|METER|ROL|STUK|M2)\s*$/i, '').replace(/\s*-\s*\d+([.,]\d+)?\s*x\s*\d+([.,]\d+)?\s*m\s*$/i, '');
  s = s.replace(/\s*-\s*€.*$/, '').replace(/\s{2,}/g, ' ').replace(/\s*-\s*$/, '').trim();
  if(s && s === s.toUpperCase() && /[A-Z]/.test(s)) s = s.toLowerCase().replace(/(^|[\s'/(])([a-z])/g, (m0, p1, p2) => p1 + p2.toUpperCase()).replace(/\b(Cm|Mm|Kg)\b/g, m0 => m0.toLowerCase());
  return s;
}

/* ---------- welke producten ---------- */
const SCOPES = [
  ['belangrijk', 'Belangrijk'],
  ['A', 'A-lopers'], ['AB', 'A + B'], ['beweegt', 'Alles dat beweegt'], ['binnen', 'Komt binnen'], ['voorraad', 'Alles met voorraad']
];
function inScope(code, sc, metFilter = true){
  const p = D.P[code]; if(!p || p.actief === false) return false;
  if(metFilter && UI.lev && p.leverancier !== UI.lev) return false;
  const abc = abcVan(code);
  switch(sc || UI.scope){
    case 'belangrijk': return abc === 'A' || abc === 'B' || index().binnen.has(code);
    case 'A': return abc === 'A';
    case 'AB': return abc === 'A' || abc === 'B';
    case 'beweegt': return !!(abc || pdVan(code) > 0 || vkmVan(code) > 0 || index().bo[code]);
    case 'binnen': return index().binnen.has(code);
    case 'voorraad': return (num(p.voorraad_hm) || 0) > 0 || (num(p.voorraad_vst) || 0) > 0;
  }
  return false;
}
const lijst = (sc, metFilter = true) => Object.keys(D.P).filter(c => inScope(c, sc, metFilter)).sort((a, b) => rang(a) - rang(b));
function zoekFilter(codes){
  const q = UI.zoek.trim().toLowerCase(); if(!q) return codes;
  return codes.filter(c => c.toLowerCase().includes(q) || String((D.P[c] || {}).naam || '').toLowerCase().includes(q));
}

/* ---------- opslaan ---------- */
const inList = codes => encodeURIComponent(codes.map(c => '"' + String(c).replace(/"/g, '\\"') + '"').join(','));
async function opslaan(wijz, bron){
  // wijz = { code: { veld: waarde } }; leeg = veld weghalen
  const codes = Object.keys(wijz).filter(c => Object.keys(wijz[c]).length);
  if(!codes.length) return 0;
  const nu = new Date().toISOString(), rijen = [];
  for(let i = 0; i < codes.length; i += 80){
    const deel = codes.slice(i, i + 80);
    const vers = await api('GET', 'productdata?productcode=in.(' + inList(deel) + ')&select=productcode,data,meta');
    const m = {}; (vers || []).forEach(r => m[r.productcode] = r);
    deel.forEach(code => {
      const r = m[code] || { productcode:code, data:{}, meta:{} };
      const data = Object.assign({}, r.data || {}), meta = Object.assign({}, r.meta || {});
      Object.entries(wijz[code]).forEach(([k, v]) => {
        v = String(v ?? '').trim();
        if(!v){ delete data[k]; delete meta[k]; }
        else { data[k] = v; meta[k] = { op:nu, bron:bron || 'invul' }; }
      });
      rijen.push({ productcode:code, data, meta, updated_at:nu });
    });
  }
  await upsert('productdata', rijen, 'productcode');
  rijen.forEach(r => { S.pd[r.productcode] = { data:r.data, meta:r.meta, t:r.updated_at }; });
  return rijen.length;
}
// controle van één ingevulde waarde
function check(k, v){
  v = String(v ?? '').trim();
  if(!v || NVT(v) || v.toLowerCase() === 'onb') return v.toLowerCase();
  const d = VELDEN[k];
  if(d.type === 'num'){ const n = num(v); if(n === null || n < 0) throw new Error(d.t + ': vul een getal in (of nvt / onb)'); return String(n); }
  if(d.type === 'maat'){ const m = v.replace(/\s/g, '').toLowerCase().replace('×', 'x'); if(!/^\d{2,3}x\d{2,3}$/.test(m)) throw new Error(d.t + ': schrijf als 100x120'); return m; }
  if(d.type === 'keus'){ if(!d.opt.some(o => o[0] === v)) throw new Error(d.t + ': kies een optie'); return v; }
  return v.replace(/\s+/g, ' ');
}

/* ---------- overzetten (eenmalig): wat al bekend was → productdata ---------- */
function telOud(){
  const t = {}; let prod = 0;
  Object.keys(D.P).forEach(code => {
    let iets = false;
    VOLG.forEach(k => { const o = oudeWaarde(code, k); if(o && !LEEGWAARDE(o.v) && pdWaarde(code, k) === null){ t[k] = (t[k] || 0) + 1; iets = true; } });
    if(iets) prod++;
  });
  return { t, prod };
}
async function overzetten(){
  const voor = telOud(), wijz = {};
  Object.keys(D.P).forEach(code => VOLG.forEach(k => {
    const o = oudeWaarde(code, k);
    if(o && !LEEGWAARDE(o.v) && pdWaarde(code, k) === null){ (wijz[code] = wijz[code] || {})[k] = o.v; }
  }));
  const n = await opslaan(wijz, 'overgezet');
  // na: tel per veld wat er nu in productdata staat met bron overgezet
  const na = {}; Object.values(S.pd).forEach(r => Object.entries(r.meta || {}).forEach(([k, m]) => { if(m && m.bron === 'overgezet') na[k] = (na[k] || 0) + 1; }));
  UI.mig = { voor:voor.t, na, n, op:new Date().toISOString() };
  try{ await WH.catPatch('wh-taken', { 'pd:overgezet':{ voor:voor.t, na, n, op:UI.mig.op } }); }catch(e){}
  return UI.mig;
}

/* ---------- weergave: kleine bouwstenen ---------- */
const badge = (t, cls) => `<span class="badge ${cls || 'b-grey'}">${esc(t)}</span>`;
const abcBadge = code => { const a = abcVan(code); return a ? badge(a, a === 'A' ? 'b-ok' : a === 'B' ? 'b-info' : 'b-grey') : ''; };
function stijl(){
  if($('pd-stijl')) return;
  const s = document.createElement('style'); s.id = 'pd-stijl';
  s.textContent = `
  .pd-kop{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .pd-kop h2{font-size:20px}
  .pd-chips{display:flex;gap:6px;flex-wrap:wrap}
  .pd-chip{border:1px solid var(--line);background:#fff;border-radius:16px;padding:6px 12px;font-weight:700;font-size:13px;cursor:pointer;color:var(--ink)}
  .pd-chip.on{background:var(--ink);border-color:var(--ink);color:#fff}
  .pd-chip .n{font-weight:600;opacity:.65;margin-left:4px}
  .pd-lagen{display:grid;gap:10px}
  .pd-laag{display:grid;grid-template-columns:150px 1fr 120px;gap:12px;align-items:center;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:#fff;cursor:pointer;text-align:left;font:inherit;color:inherit}
  .pd-laag.on{border-color:var(--orange);box-shadow:0 0 0 2px #f08a4b40}
  .pd-laag b{font-size:15px} .pd-laag .u{font-size:12px;color:var(--muted)}
  .pd-bar{height:10px;background:#e9edf2;border-radius:6px;overflow:hidden}
  .pd-bar i{display:block;height:100%;background:var(--ok);border-radius:6px}
  .pd-laag .pct{text-align:right;font-variant-numeric:tabular-nums;font-weight:800}
  .pd-laag .pct small{display:block;font-weight:600;color:var(--muted);font-size:11.5px}
  .pd-start{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .pd-start a{display:block;text-decoration:none;color:inherit;border:1px solid var(--line);border-radius:10px;padding:14px 16px;background:#fff}
  .pd-start a:hover{border-color:var(--blue)}
  .pd-start a b{font-size:16px;display:block} .pd-start a span{font-size:12.5px;color:var(--muted)}
  .pd-prod{border-left:4px solid var(--orange)}
  .pd-titel{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
  .pd-titel .code{font-family:ui-monospace,Consolas,monospace;font-weight:800;font-size:16px}
  .pd-titel .naam{font-size:14px}
  .pd-feit{font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.7}
  .pd-feit b{color:var(--ink);font-weight:700}
  .pd-velden{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px 14px;margin-top:14px}
  .pd-v.breed{grid-column:1/-1}
  .pd-v label{display:block;font-size:12px;font-weight:800;color:var(--ink);margin-bottom:5px}
  .pd-v label .eh{font-weight:600;color:var(--muted)}
  .pd-v input,.pd-v select{font-size:16px;padding:9px 10px}
  .pd-v .br{font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.35}
  .pd-v .br.laag{color:var(--warn)}
  .pd-v.klaar input,.pd-v.klaar select{background:#f3f7f4;border-color:#cfe3d6}
  .pd-seg{display:flex;gap:6px;flex-wrap:wrap}
  .pd-seg button{flex:1 1 auto;border:1px solid var(--line);background:#fff;border-radius:7px;padding:9px 10px;font:inherit;font-weight:700;font-size:13.5px;cursor:pointer;color:var(--ink)}
  .pd-seg button.on{background:var(--blue);border-color:var(--blue);color:#fff}
  .pd-seg button.voor{background:#fff8dc;border-color:#e8c860}
  .pd-seg button.voor.on{background:#fff8dc;border-color:var(--blue);color:var(--ink);box-shadow:inset 0 0 0 1px var(--blue)}
  .pd-acties{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:16px}
  .pd-acties .btn.acc{font-size:15px;padding:10px 18px}
  .pd-meer summary{cursor:pointer;font-size:12.5px;color:var(--blue);font-weight:700;margin-top:12px}
  .pd-meer .kv{margin-top:8px}
  .pd-fam{display:grid;grid-template-columns:1fr auto;gap:4px 12px;padding:12px 14px;border-bottom:1px solid #eef1f5;text-decoration:none;color:inherit}
  .pd-fam:hover{background:var(--soft)}
  .pd-fam .t{font-weight:800} .pd-fam .s{font-size:12px;color:var(--muted)}
  .pd-var{border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-top:12px;background:#fff}
  .pd-var h3{font-size:14px} .pd-var .leden{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
  .pd-var .leden a{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;background:var(--soft);border-radius:4px;padding:2px 6px;text-decoration:none;color:var(--ink)}
  .pd-var .leden a.vol{background:#dff3e8;color:var(--ok)}
  .pd-steek{border-collapse:collapse;width:100%;font-size:13px;min-width:760px}
  .pd-steek th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line)}
  .pd-steek td{padding:8px;border-bottom:1px solid #eef1f5;vertical-align:top}
  .pd-steek tr.ok td{background:#f3faf6} .pd-steek tr.fout td{background:#fdf0ee}
  .pd-leg{font-size:12px;color:var(--muted)} .pd-leg i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:4px;background:#fff8dc;border:1px solid #e8c860}
  .pd-leg i.ok{background:#f3f7f4;border-color:#cfe3d6}
  @media (max-width:700px){ .pd-laag{grid-template-columns:1fr 70px} .pd-laag .pd-bar{grid-column:1/-1;order:3} .pd-start{grid-template-columns:1fr} .pd-velden{grid-template-columns:1fr 1fr} }
  @media (max-width:420px){ .pd-velden{grid-template-columns:1fr} }`;
  document.head.appendChild(s);
}
function voortgang(codes, laag){
  let vol = 0, velden = 0, gevuld = 0;
  codes.forEach(c => {
    const w = waardeFn(c), ks = inLaag(laag).filter(k => nodig(c, k, w));
    const o = ks.filter(k => staat(c, k).s !== 'ok').length;
    velden += ks.length; gevuld += ks.length - o; if(!o) vol++;
  });
  return { vol, tot:codes.length, velden, gevuld };
}
function scopeChips(){
  return `<div class="pd-chips">${SCOPES.map(([k, t]) => `<button class="pd-chip ${UI.scope === k ? 'on' : ''}" data-pd="scope" data-v="${k}">${esc(t)}<span class="n">${nf(lijst(k).length)}</span></button>`).join('')}</div>`;
}
function levKeuze(){
  const lev = [...new Set(Object.values(D.P).filter(p => inScope(p.productcode, UI.scope === 'voorraad' ? 'voorraad' : 'beweegt') || p.leverancier === UI.lev).map(p => p.leverancier).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return `<select data-pd="lev" style="width:auto;max-width:100%"><option value="">Alle leveranciers</option>${lev.map(l => `<option ${l === UI.lev ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}
function feitRegel(code){
  const p = D.P[code] || {}, x = S.extra[code] || {}, l = locaties(code), eh = eenheid(code);
  const d = [];
  d.push('voorraad <b>' + nf(num(p.voorraad_hm) || 0) + '</b> hier · <b>' + nf(num(p.voorraad_vst) || 0) + '</b> VST');
  if(vkmVan(code)) d.push('verkoop <b>' + nf(vkmVan(code)) + '</b> ' + eh.mv + '/mnd');
  if(index().bo[code]) d.push('<b>' + index().bo[code] + '</b> backorder' + (index().bo[code] > 1 ? 's' : ''));
  if(l.pick.length) d.push('pick ' + l.pick.slice(0, 2).map(a => '<b>' + esc(a[0]) + '</b>' + (a[1] ? ' (' + nf(a[1]) + ')' : '')).join(', '));
  if(l.geen) d.push('<b>' + nf(l.geen) + '</b> zonder locatie');
  if(l.bulk.length) d.push('bulk ' + l.bulk.slice(0, 3).map(a => '<b>' + esc(a[0]) + '</b> (' + nf(a[1]) + ')').join(', ') + (l.bulk.length > 3 ? ' +' + (l.bulk.length - 3) : ''));
  if(eh.e !== 'st') d.push('Picqer telt <b>' + eh.t + '</b>');
  if(index().binnen.has(code)) d.push('<span class="badge b-warn">komt binnen</span>');
  return d.join(' · ');
}
function picqerBlok(code){
  const p = D.P[code] || {}, x = S.extra[code] || {}, pq = D.PQ[code] || [];
  const rij = (l, v) => v === '' || v === null || v === undefined ? '' : `<span>${esc(l)}</span><div>${v}</div>`;
  const afm = [x.lengte_product_cm, x.breedte_product_cm, x.hoogte_product_cm].every(v => !leeg(v)) ? nf(num(x.lengte_product_cm)) + ' × ' + nf(num(x.breedte_product_cm)) + ' × ' + nf(num(x.hoogte_product_cm)) + ' cm' : '<span class="muted">leeg</span>';
  return `<details class="pd-meer"><summary>Alles wat Picqer weet (alleen lezen)</summary><div class="kv">
    ${rij('Productcode', '<span class="mono">' + esc(code) + '</span>')}${rij('Naam', esc(p.naam || ''))}${rij('EAN', esc(p.ean || '') || '<span class="muted">leeg</span>')}
    ${rij('Leverancier', esc(p.leverancier || ''))}${rij('Code leverancier', esc(x.leverancier_code || p.leverancier_code || ''))}${rij('ABC', esc(abcVan(code) || '–'))}
    ${rij('Gewicht', !leeg(x.gewicht_product_g) ? nf(num(x.gewicht_product_g) / 1000, 3) + ' kg' : '<span class="muted">leeg</span>')}${rij('Afmetingen', afm)}
    ${rij('Aanvulniveau', !leeg(pq[0]) ? nf(num(pq[0])) + (num(pq[0]) === 1 ? ' <span class="muted">(standaard)</span>' : '') : '<span class="muted">leeg</span>')}${rij('Vul aan tot', !leeg(pq[1]) ? nf(num(pq[1])) : '<span class="muted">leeg</span>')}
    ${rij('Locaties', esc(p.locaties_hm || '') || '<span class="muted">geen</span>')}${rij('Tags', esc(p.tags || ''))}
  </div></details>`;
}
// één invulveld; cw = concept-sleutel (product of maatgroep)
function veldHtml(cw, k, st, vs, ehLabel){
  const d = VELDEN[k], c = UI.concept[cw] || {};
  const heeft = c[k] !== undefined;
  let val = heeft ? c[k] : (st.s === 'ok' ? st.v : (vs ? vs.v : st.v));
  const isVoor = !heeft && st.s !== 'ok' && vs && !leeg(vs.v);
  const cls = st.s === 'ok' && !heeft ? ' klaar' : '';
  const eh = d.eh ? ' <span class="eh">(' + esc(ehLabel) + ')</span>' : d.eh2 ? ' <span class="eh">(' + d.eh2 + ')</span>' : '';
  const at = `data-pdc="${esc(cw)}" data-pdk="${k}"`;
  let inp;
  if(d.type === 'keus'){
    inp = `<div class="pd-seg">${d.opt.map(([v, t]) => `<button type="button" ${at} data-pdv="${esc(v)}" class="${String(val) === v ? 'on' : ''}${isVoor && String(val) === v ? ' voor' : ''}">${esc(t)}</button>`).join('')}</div>`;
  } else if(d.type === 'maat'){
    const v = String(val || '');
    inp = `<input ${at} list="pd-maten" value="${esc(v)}" placeholder="bijv. 100x120" autocomplete="off" autocapitalize="off" ${isVoor ? 'class="voor"' : ''}>`;
  } else {
    inp = `<input ${at} value="${esc(val)}" ${d.type === 'num' ? 'inputmode="decimal"' : 'autocomplete="off"'} ${isVoor ? 'class="voor"' : ''}>`;
  }
  const br = isVoor ? `<div class="br ${vs.z === 'laag' ? 'laag' : ''}">${vs.z === 'laag' ? 'schatting' : 'voorstel'}: ${esc(vs.bron)}</div>`
    : st.s === 'oud' && !heeft ? `<div class="br">uit ${esc(st.bron)}</div>`
    : st.s === 'ok' && !heeft ? `<div class="br">✓ vastgelegd</div>` : d.hint ? `<div class="br">${esc(d.hint)}</div>` : '';
  return `<div class="pd-v${d.breed ? ' breed' : ''}${cls}">${'<label>' + esc(d.t) + eh + '</label>'}${inp}${br}</div>`;
}
const maatLijst = () => `<datalist id="pd-maten">${MATEN.map(m => `<option value="${m}">`).join('')}</datalist>`;
function laagTabs(codes){
  return `<div class="pd-chips">${LAGEN.map(l => { const v = voortgang(codes, l.n); const o = v.velden - v.gevuld; return `<button class="pd-chip ${UI.laag === l.n ? 'on' : ''}" data-pd="laag" data-v="${l.n}">${l.n}. ${esc(l.t)}<span class="n">${o ? nf(o) + ' open' : '✓'}</span></button>`; }).join('')}</div>`;
}

/* ---------- scherm: start ---------- */
function viewStart(){
  const codes = zoekFilter(lijst());
  const mig = telOud();
  const migN = Object.values(mig.t).reduce((a, b) => a + b, 0);
  const fams = families(codes);
  const openLaag = codes.filter(c => open(c, UI.laag).length).length;
  app.innerHTML = `
  <div class="card">
    <div class="pd-kop"><div><h2>Productdata</h2><div class="small muted mt4">Eén kaart per product voor alles wat Picqer niet weet. Naam, code, EAN, leverancier en prijzen blijven van Picqer: die zie je, maar pas je hier niet aan.</div></div></div>
    <div class="mt12">${scopeChips()}</div>
    <div class="row wrap mt8">${levKeuze()}<input data-pd="zoek" value="${esc(UI.zoek)}" placeholder="zoek code of naam" style="max-width:260px"></div>
  </div>
  ${S.mist ? `<div class="card" style="border-left:4px solid var(--bad)"><h3>Tabel productdata bestaat nog niet</h3><p class="small mt8">Ververs over een minuut. Blijft dit staan, meld het aan Claude.</p></div>` : ''}
  ${!S.mist && migN ? `<div class="card" style="border-left:4px solid var(--blue)"><h3>Eerst: overzetten wat al bekend is</h3>
    <p class="small mt8">Van ${nf(mig.prod)} producten staan gegevens nog verspreid over palletlabels, containers en de aanvulbase: ${Object.entries(mig.t).map(([k, n]) => nf(n) + ' × ' + esc(VELDEN[k].t.toLowerCase())).join(', ')}. Eén klik zet ze over naar productdata. De oude plekken blijven ongemoeid. Wat dubbel en verschillend in palletlabels staat, gaat niet mee: dat kies je zelf.</p>
    <div class="row wrap mt12"><button class="btn pri" data-pd="mig">Zet ${nf(migN)} waarden over</button></div></div>` : ''}
  ${UI.mig ? `<div class="card" style="border-left:4px solid var(--ok)"><h3>Overgezet</h3><div class="small mt8">${Object.keys(UI.mig.voor).map(k => esc(VELDEN[k].t) + ': vóór <b>' + nf(UI.mig.voor[k]) + '</b>, na <b>' + nf(UI.mig.na[k] || 0) + '</b>' + ((UI.mig.na[k] || 0) === UI.mig.voor[k] ? ' ✓' : ' <span class="badge b-bad">verschil</span>')).join('<br>')}</div></div>` : ''}
  ${poortKaart()}
  ${opschonenKaart()}
  <div class="card">
    <h3>Hoe ver ben je</h3><div class="small muted mt4">${nf(codes.length)} producten in deze selectie. Kies een laag en vul die eerst helemaal.</div>
    <div class="pd-lagen mt12">${LAGEN.map(l => { const v = voortgang(codes, l.n); const pct = v.velden ? Math.round(100 * v.gevuld / v.velden) : 100; return `<button class="pd-laag ${UI.laag === l.n ? 'on' : ''}" data-pd="laag" data-v="${l.n}"><div><b>${l.n}. ${esc(l.t)}</b><div class="u">${esc(l.u)}</div></div><div class="pd-bar"><i style="width:${pct}%"></i></div><div class="pct">${pct}%<small>${nf(v.vol)} / ${nf(v.tot)} compleet</small></div></button>`; }).join('')}</div>
  </div>
  <div class="pd-start">
    <a href="#/productdata/fam"><b>Per familie →</b><span>${nf(fams.filter(f => f.open).length)} families met open velden in ${esc(LAGEN[UI.laag - 1].t)}. Eén keer invullen voor alle kleuren en maten tegelijk.</span></a>
    <a href="#/productdata/een"><b>Eén voor één →</b><span>${nf(openLaag)} producten met open velden in ${esc(LAGEN[UI.laag - 1].t)}. Lopers eerst, alleen wat nog mist.</span></a>
  </div>
  <div class="card mt12"><div class="pd-leg"><i></i>geel = voorstel, controleer en druk Klopt · <i class="ok"></i>groen = vastgelegd · "schatting" in oranje = minder zeker, kijk extra goed</div>
  <div class="small muted mt8">Getoetst tegen wat al bekend was (stuks per pallet): voorstel van een kleurgenoot klopte 83%, van VST-pallets 80%, van bulkpallets 84%. Een schatting uit de familie klopte maar 43%: kijk daar dus goed.</div></div>`;
}

/* ---------- poort 0.4: pas verder als alles klopt ----------
   Belangrijke producten = A- en B-lopers + alles op een open container.
   Groen als: tabel staat · alles overgezet · geen dubbele labelwaarden open · laag 1 t/m 3 voor 100% ·
   steekproef van 20 op de vloer zonder fout. Dan verschijnt de poortcode voor het bouwplan. */
const STEEK_N = 20;
const STEEK_VELDEN = ['spp', 'maat', 'hoogte', 'maxpick', 'met', 'vn'];
function poortCode(n){
  let h = 0; for(const ch of 'ivol-0.4-' + n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 'PD-' + n + '-' + (h % 1679616).toString(36).toUpperCase().padStart(4, '0');
}
const steek = () => D.TAKEN['pd:steekproef'] || null;
function poort(){
  const bel = lijst('belangrijk', false);
  const mig = telOud(), migOpen = Object.values(mig.t).reduce((a, b) => a + b, 0);
  const dub = dubbel().filter(x => (x.sppConflict && staat(x.code, 'spp').s === 'open') || (x.vnConflict && staat(x.code, 'vn').s === 'open')).length;
  const lagen = [1, 2, 3].map(n => voortgang(bel, n));
  const sp = steek(), spCodes = sp ? sp.codes || [] : [], spUit = sp ? sp.uit || {} : {};
  const spGeteld = spCodes.filter(c => spUit[c]).length, spFout = spCodes.filter(c => spUit[c] === 'fout').length;
  const items = [
    { t:'Tabel productdata staat in Supabase', ok:!S.mist, u:S.mist ? 'ontbreekt' : '' },
    { t:'Bekende gegevens overgezet, vóór en na gelijk', ok:!migOpen, u:migOpen ? nf(migOpen) + ' waarden nog over te zetten' : '', a:migOpen ? '#/productdata' : '' },
    { t:'Dubbel in palletlabels: niets meer te kiezen', ok:!dub, u:dub ? nf(dub) + ' producten te kiezen' : '', a:dub ? '#/productdata/dubbel' : '' }
  ].concat(lagen.map((v, i) => ({ t:'Belangrijke producten · ' + (i + 1) + '. ' + LAGEN[i].t + ' 100%', ok:v.tot > 0 && v.vol === v.tot, u:nf(v.vol) + ' van ' + nf(v.tot) + ' compleet · ' + nf(v.velden - v.gevuld) + ' velden open', laag:i + 1 })));
  const dataKlaar = items.every(x => x.ok);
  items.push({ t:'Steekproef op de vloer: ' + STEEK_N + ' producten, 0 fouten', ok:dataKlaar && spCodes.length === STEEK_N && spGeteld === STEEK_N && !spFout,
    u:!sp ? (dataKlaar ? 'nog niet getrokken' : 'kan pas als alles hierboven groen is') : spFout ? nf(spFout) + ' fout: verbeter en trek een nieuwe steekproef' : nf(spGeteld) + ' van ' + STEEK_N + ' gecontroleerd', a:'#/productdata/poort' });
  const groen = items.every(x => x.ok);
  const pct = lagen.reduce((s, v) => s + v.gevuld, 0) / Math.max(1, lagen.reduce((s, v) => s + v.velden, 0));
  return { bel, items, groen, dataKlaar, code:groen ? poortCode(bel.length) : null, pct:Math.floor(pct * 100), sp };
}
function poortKaart(){
  const p = poort(), n = p.items.filter(x => x.ok).length;
  return `<a class="card" href="#/productdata/poort" style="display:block;text-decoration:none;color:inherit;border-left:4px solid ${p.groen ? 'var(--ok)' : 'var(--orange)'}">
    <div class="row between wrap"><div><h3>Poort 0.4 · ${p.groen ? 'groen' : n + ' van ' + p.items.length + ' groen'}</h3>
    <div class="small muted mt4">${nf(p.bel.length)} belangrijke producten (A, B en wat binnenkomt). Pas als alles groen is, ga je in je bouwplan verder.</div></div>
    <span class="btn ${p.groen ? 'ok' : 'acc'}">${p.groen ? 'Poortcode bekijken' : 'Bekijk wat nog moet'} →</span></div></a>`;
}
function viewPoort(){
  const p = poort(), sp = p.sp;
  const rij = x => `<div class="row" style="gap:12px;padding:10px 0;border-bottom:1px solid #eef1f5;align-items:flex-start">
      <span style="font-size:18px;line-height:1;width:22px;color:${x.ok ? 'var(--ok)' : 'var(--bad)'}">${x.ok ? '✓' : '○'}</span>
      <div class="grow"><b>${esc(x.t)}</b>${x.u ? `<div class="small muted mt4">${esc(x.u)}</div>` : ''}</div>
      ${!x.ok && x.laag ? `<button class="btn sm" data-pd="naarlaag" data-v="${x.laag}">Invullen →</button>` : !x.ok && x.a && x.a !== '#/productdata/poort' ? `<a class="btn sm" href="${x.a}">Openen →</a>` : ''}</div>`;
  const toonV = (c, k) => { const st = staat(c, k); if(st.s !== 'ok') return '–'; const d = VELDEN[k]; const o = d.opt && d.opt.find(o => o[0] === st.v); return esc(o ? o[1] : st.v) + (k === 'spp' || k === 'maxpick' ? ' ' + eenheid(c).mv : k === 'hoogte' ? ' cm' : ''); };
  const plek = c => { const l = locaties(c); return (l.bulk[0] || l.pick[0] || [''])[0]; };
  const steekBlok = !p.dataKlaar ? '' : `<div class="card"><div class="row between wrap"><div><h3>Steekproef op de vloer</h3><div class="small muted mt4">${STEEK_N} willekeurige belangrijke producten. Loop ze langs, kijk op de pallet en de picklocatie of het klopt. Eén fout = verbeteren en een nieuwe steekproef.</div></div>
      <button class="btn ${sp ? '' : 'acc'}" data-pd="trek">${sp ? 'Nieuwe steekproef' : 'Trek steekproef van ' + STEEK_N}</button></div>
    ${sp ? `<div class="small muted mt8">Getrokken ${esc(new Date(sp.op).toLocaleString('nl-NL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }))}</div>
    <div class="mt8" style="overflow-x:auto"><table class="pd-steek"><thead><tr><th>Product</th><th>Plek</th>${STEEK_VELDEN.map(k => `<th>${esc(VELDEN[k].t)}</th>`).join('')}<th></th></tr></thead><tbody>
    ${sp.codes.map(c => { const u = (sp.uit || {})[c]; return `<tr class="${u === 'ok' ? 'ok' : u === 'fout' ? 'fout' : ''}"><td><a class="mono" href="#/productdata/p/${encodeURIComponent(c)}">${esc(c)}</a><div class="tiny muted">${esc(String((D.P[c] || {}).naam || '').slice(0, 60))}</div></td><td class="mono">${esc(plek(c))}</td>${STEEK_VELDEN.map(k => `<td>${toonV(c, k)}</td>`).join('')}
      <td style="white-space:nowrap"><button class="btn sm ${u === 'ok' ? 'ok' : ''}" data-pd="steek" data-code="${esc(c)}" data-v="ok">Klopt</button> <button class="btn sm ${u === 'fout' ? 'acc' : ''}" data-pd="steek" data-code="${esc(c)}" data-v="fout">Fout</button></td></tr>`; }).join('')}
    </tbody></table></div>` : ''}</div>`;
  app.innerHTML = `<a class="small" href="#/productdata">← Productdata</a>
  <div class="card mt8" style="border-left:4px solid ${p.groen ? 'var(--ok)' : 'var(--orange)'}"><h2>Poort 0.4 · Eén waarheid</h2>
    <p class="small mt8">Je gaat in het bouwplan pas verder als alles hieronder groen is. Belangrijke producten zijn de A- en B-lopers plus alles wat op een open container staat: nu <b>${nf(p.bel.length)}</b>. "onb" telt als leeg: twijfel zoek je uit, je gokt niet.</p>
    <div class="mt12">${p.items.map(rij).join('')}</div>
    ${p.groen ? `<div class="mt16" style="background:#dff3e8;border-radius:8px;padding:14px 16px"><div class="small" style="font-weight:700;color:var(--ok)">Alles groen. Poortcode voor stap 0.4 in je bouwplan:</div><div class="mono mt8" style="font-size:24px;font-weight:800;letter-spacing:.06em">${esc(p.code)}</div><div class="small mt8">Vul ook in: belangrijke producten <b>${nf(p.bel.length)}</b>, compleet <b>100</b>%, datum steekproef <b>${esc(new Date(p.sp.op).toLocaleDateString('nl-NL'))}</b>.</div></div>`
      : `<div class="small muted mt12">Laag 1 t/m 3 samen: <b>${p.pct}%</b> ingevuld.</div>`}
  </div>${steekBlok}`;
}
async function trekSteekproef(){
  const kand = lijst('belangrijk', false).filter(c => [1, 2, 3].every(n => !open(c, n).length));
  const pool = kand.slice(), codes = [];
  while(codes.length < STEEK_N && pool.length){ const i = Math.floor(Math.random() * pool.length); codes.push(pool.splice(i, 1)[0]); }
  const sp = { op:new Date().toISOString(), codes, uit:{} };
  await WH.catPatch('wh-taken', { 'pd:steekproef':sp });
}
async function steekUitslag(code, v){
  const sp = Object.assign({}, steek() || {}); sp.uit = Object.assign({}, sp.uit || {});
  sp.uit[code] = sp.uit[code] === v ? null : v; if(!sp.uit[code]) delete sp.uit[code];
  await WH.catPatch('wh-taken', { 'pd:steekproef':sp });
}

/* ---------- opschonen: dubbele en losse labelregels ---------- */
function opschonenKaart(){
  const d = dubbel(), w = wees();
  if(!d.length && !w.length) return '';
  const nC = d.filter(x => x.sppConflict || x.vnConflict).length, nQ = d.filter(x => x.sppConflict).length;
  const open = d.filter(x => (x.sppConflict && staat(x.code, 'spp').s === 'open') || (x.vnConflict && staat(x.code, 'vn').s === 'open')).length;
  return `<div class="card" style="border-left:4px solid var(--warn)"><h3>Dubbel in palletlabels</h3>
    <p class="small mt8">${plural(d.length, 'product heeft', 'producten hebben')} meer dan één labelregel. Bij ${nf(nQ)} staat er een ander aantal per pallet, bij ${nf(nC - nQ)} alleen een andere vloernaam. Die zijn <b>niet</b> overgezet: jij kiest welke klopt. ${w.length ? nf(w.length) + ' labelregels horen bij geen bestaand Picqer-product (outlet-codes, losse getallen, geen code); die gaan nergens heen.' : ''}</p>
    <div class="row wrap mt12"><a class="btn ${open ? 'acc' : ''}" href="#/productdata/dubbel">${open ? nf(open) + ' te kiezen →' : 'Bekijken'}</a></div></div>`;
}
function viewDubbel(){
  const d = dubbel().filter(x => x.sppConflict || x.vnConflict), w = wees();
  const kaart = x => {
    const ks = [x.sppConflict ? 'spp' : null, x.vnConflict ? 'vn' : null].filter(Boolean);
    const regels = x.regels.map(g => `<div class="small"><span class="mono">${esc(g.name || '')}</span> · ${esc(String(g.qty ?? '') || 'leeg')} per pallet${g.used ? ' · laatst gebruikt ' + esc(new Date(g.used).toLocaleDateString('nl-NL')) : ''}</div>`).join('');
    return productKaart(x.code, ks, false).replace('<div class="pd-velden">', `<div class="mt8" style="background:var(--soft);border-radius:6px;padding:8px 10px"><div class="tiny muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.04em">Regels in palletlabels</div>${regels}</div><div class="pd-velden">`);
  };
  app.innerHTML = `<a class="small" href="#/productdata">← Productdata</a>${maatLijst()}
  <div class="card mt8"><h2>Dubbel in palletlabels</h2><p class="small muted mt4">Kies per product welk aantal en welke vloernaam klopt en druk Klopt. Dat wordt de waarheid in productdata. Palletlabels zelf blijft ongemoeid tot de apps uit productdata lezen.</p></div>
  ${d.map(kaart).join('') || '<div class="card empty">Geen dubbele waarden meer.</div>'}
  ${w.length ? `<div class="card"><details><summary class="small" style="cursor:pointer;font-weight:700">${nf(w.length)} labelregels zonder bestaand Picqer-product</summary><div class="mt8">${w.map(x => `<div class="small"><span class="mono">${esc(x.naam)}</span> → ${esc(x.sub || '–')} · ${esc(x.waarom)}</div>`).join('')}</div></details></div>` : ''}`;
}

/* ---------- families ---------- */
function families(codes){
  const per = {};
  codes.forEach(c => { const fk = index().famVan[c]; (per[fk] = per[fk] || []).push(c); });
  return Object.entries(per).map(([fk, leden]) => {
    const alle = famZichtbaar(fk);
    const o = alle.reduce((s, c) => s + open(c, UI.laag).length, 0);
    const maten = new Set(alle.map(c => index().varVan[c])).size;
    return { fk, leden:alle.sort((a, b) => rang(a) - rang(b)), open:o, maten, rang:Math.min(...alle.map(rang)) };
  }).sort((a, b) => (b.open > 0) - (a.open > 0) || a.rang - b.rang);
}
function famTitel(fk, leden){
  const namen = leden.map(c => String((D.P[c] || {}).naam || ''));
  if(namen.length === 1) return namen[0];
  // gemeenschappelijk begin van de namen, anders de familienaam
  let pre = namen[0];
  namen.forEach(n => { let i = 0; while(i < pre.length && i < n.length && pre[i].toLowerCase() === n[i].toLowerCase()) i++; pre = pre.slice(0, i); });
  pre = pre.replace(/[\s\-–,(]+[^\s]*$/, '').replace(/[\s\-–,(]+$/, '').trim();
  return pre.length >= 6 ? pre : fk.split('|')[1];
}
const famId = fk => encodeURIComponent(fk);
// leden van een familie die ertoe doen: in de selectie, of ze bewegen, of ze hebben voorraad
const famZichtbaar = fk => (index().fam[fk] || []).filter(c => D.P[c] && D.P[c].actief !== false && (inScope(c) || inScope(c, 'beweegt') || inScope(c, 'voorraad')));
function viewFamilies(){
  const codes = zoekFilter(lijst()), fams = families(codes);
  const tonen = fams.slice(0, 150);
  app.innerHTML = `<a class="small" href="#/productdata">← Productdata</a>
  <div class="card mt8"><div class="pd-kop"><div><h2>Per familie</h2><div class="small muted mt4">Producten die op elkaar lijken (zelfde leverancier en soort, andere kleur of maat). Kleuren van dezelfde maat delen alle palletgegevens.</div></div></div>
    <div class="mt12">${scopeChips()}</div><div class="row wrap mt8">${levKeuze()}<input data-pd="zoek" value="${esc(UI.zoek)}" placeholder="zoek code of naam" style="max-width:260px"></div>
    <div class="mt12">${laagTabs(codes)}</div></div>
  <div class="card" style="padding:4px 0">${tonen.map(f => `<a class="pd-fam" href="#/productdata/fam/${famId(f.fk)}">
      <div><div class="t">${esc(famTitel(f.fk, f.leden))}</div><div class="s">${esc(f.fk.split('|')[0])} · ${plural(f.leden.length, 'product', 'producten')}${f.maten > 1 ? ' in ' + f.maten + ' maten' : ''}</div></div>
      <div class="row">${[...new Set(f.leden.map(abcVan).filter(Boolean))].sort().map(a => badge(a, a === 'A' ? 'b-ok' : a === 'B' ? 'b-info' : 'b-grey')).join(' ')} ${f.open ? badge(nf(f.open) + ' open', 'b-warn') : badge('✓', 'b-ok')}</div></a>`).join('') || '<div class="empty">Geen producten in deze selectie.</div>'}
    ${fams.length > tonen.length ? `<div class="small muted" style="padding:10px 14px">+ ${nf(fams.length - tonen.length)} families. Kies een leverancier of zoek om ze te zien.</div>` : ''}</div>`;
}
function viewFamilie(fk){
  const alle = (index().fam[fk] || []).filter(c => D.P[c] && D.P[c].actief !== false);
  if(!alle.length){ app.innerHTML = `<a class="small" href="#/productdata/fam">← Families</a><div class="card empty mt8">Familie niet gevonden.</div>`; return; }
  // maatgroepen: alleen de leden in de selectie, de rest telt als genoot mee voor voorstellen
  const leden = famZichtbaar(fk).length ? famZichtbaar(fk) : alle;
  const groepen = {};
  leden.forEach(c => { const vk = index().varVan[c]; (groepen[vk] = groepen[vk] || []).push(c); });
  const g = Object.entries(groepen).sort((a, b) => Math.min(...a[1].map(rang)) - Math.min(...b[1].map(rang)));
  const ks = inLaag(UI.laag);
  const kaart = ([vk, cs]) => {
    cs.sort((a, b) => rang(a) - rang(b));
    const eerste = cs[0], cw = 'g:' + vk, eh = eenheid(eerste).mv;
    const w = k => { const c = UI.concept[cw] || {}; if(c[k] !== undefined) return c[k]; const st = groepStaat(cs, k); return st.s !== 'open' ? st.v : ((voorstel(eerste, k, w) || {}).v || ''); };
    const velden = ks.filter(k => cs.some(c => nodig(c, k, w)));
    const sig = maatSig((D.P[eerste] || {}).naam) || 'zelfde maat';
    const kleuren = cs.length > 1 ? plural(cs.length, 'product', 'producten') + ' (kleuren)' : '';
    return `<div class="pd-var" data-groep="${esc(vk)}">
      <div class="row between wrap"><h3>${esc(sig)}</h3><span class="small muted">${esc(kleuren)}</span></div>
      <div class="leden">${cs.map(c => `<a href="#/productdata/p/${encodeURIComponent(c)}" class="${open(c, UI.laag).length ? '' : 'vol'}" title="${esc((D.P[c] || {}).naam || '')}">${esc(c)}</a>`).join('')}</div>
      ${velden.length ? `<div class="pd-velden">${velden.map(k => { const st = groepStaat(cs, k); return veldHtml(cw, k, st, st.s === 'ok' ? null : groepVoorstel(cs, k, w), eh); }).join('')}</div>` : '<div class="small muted mt8">Niets nodig in deze laag.</div>'}
    </div>`;
  };
  const titel = famTitel(fk, alle);
  const nOpen = leden.reduce((s, c) => s + open(c, UI.laag).length, 0);
  app.innerHTML = `<a class="small" href="#/productdata/fam">← Families</a>${maatLijst()}
  <div class="card mt8"><div class="pd-kop"><div><h2>${esc(titel)}</h2><div class="small muted mt4">${esc(fk.split('|')[0])} · ${plural(leden.length, 'product', 'producten')} in ${plural(g.length, 'maat', 'maten')}</div></div></div>
    <div class="mt12">${laagTabs(leden)}</div>
    <div class="pd-leg mt8"><i></i>geel = voorstel · <i class="ok"></i>groen = vastgelegd · wat je hier invult geldt voor alle kleuren van die maat</div></div>
  ${g.map(kaart).join('')}
  <div class="pd-acties"><button class="btn acc" data-pd="famsave">Klopt, opslaan voor ${plural(leden.length, 'product', 'producten')}</button>
    <span class="small muted">${nOpen ? nf(nOpen) + ' velden open in deze laag' : 'alles in deze laag is vastgelegd'}</span></div>`;
}
// staat van een veld over alle kleurgenoten van een maatgroep
function groepStaat(cs, k){
  const st = cs.map(c => staat(c, k)), vol = st.filter(s => s.s !== 'open');
  const vals = [...new Set(vol.map(s => s.v))];
  if(vol.length === cs.length && vals.length === 1) return st.every(s => s.s === 'ok') ? { v:vals[0], s:'ok' } : { v:vals[0], s:'oud', bron:st.find(s => s.s === 'oud').bron };
  if(vals.length > 1) return { v:'', s:'open', verschil:vals };
  return { v:'', s:'open' };
}
function groepVoorstel(cs, k, w){
  const gs = groepStaat(cs, k);
  if(gs.verschil) return { v:'', bron:'verschilt per kleur: ' + gs.verschil.join(' / ') + ' (leeg laten = niets veranderen)', z:'laag' };
  if(gs.s === 'oud') return { v:gs.v, bron:'stond al in ' + gs.bron, z:'hoog' };
  const vol = cs.map(c => staat(c, k)).find(s => s.s !== 'open');
  if(vol) return { v:vol.v, bron:'zelfde als de andere kleur' + (vol.bron ? ' (' + vol.bron + ')' : ''), z:'hoog' };
  for(const c of cs){ const v = voorstel(c, k, w); if(v && !leeg(v.v)) return v; }
  return null;
}

/* ---------- scherm: één voor één ---------- */
function rij1(){ return zoekFilter(lijst()).filter(c => open(c, UI.laag).length && !UI.over.has(c)); }
function viewEen(){
  const r = rij1();
  if(UI.i >= r.length) UI.i = Math.max(0, r.length - 1);
  const code = r[UI.i];
  const kop = `<div class="row between wrap"><a class="small" href="#/productdata">← Productdata</a><span class="small muted">${r.length ? (UI.i + 1) + ' / ' + nf(r.length) + ' open' : ''}</span></div>
    <div class="card mt8">${laagTabs(zoekFilter(lijst()))}<div class="mt8">${scopeChips()}</div></div>`;
  if(!code){ app.innerHTML = kop + `<div class="card empty">Alles in ${esc(LAGEN[UI.laag - 1].t)} is ingevuld voor deze selectie.${UI.laag < 4 ? `<div class="mt12"><button class="btn pri" data-pd="laag" data-v="${UI.laag + 1}">Door naar ${esc(LAGEN[UI.laag].t)}</button></div>` : ''}</div>`; return; }
  app.innerHTML = kop + maatLijst() + productKaart(code, UI.alles[code] ? VOLG : open(code, UI.laag), true);
}
function productKaart(code, ks, inRij){
  const p = D.P[code] || {}, eh = eenheid(code).mv, w = schermFn(code);
  const zichtbaar = ks.filter(k => nodig(code, k, w));
  return `<div class="card pd-prod">
    <div class="pd-titel"><span class="code">${esc(code)}</span>${abcBadge(code)}<span class="naam">${esc(p.naam || '')}</span></div>
    <div class="pd-feit">${feitRegel(code)}</div>
    <div class="pd-velden">${zichtbaar.map(k => veldHtml(code, k, staat(code, k), voorstel(code, k, w), eh)).join('')}</div>
    <div class="pd-acties">
      <button class="btn acc" data-pd="save" data-code="${esc(code)}">${inRij ? 'Klopt →' : 'Klopt, opslaan'}</button>
      ${inRij ? `<button class="btn" data-pd="over">Overslaan</button>${UI.i ? '<button class="btn ghost" data-pd="terug">← vorige</button>' : ''}` : ''}
      <button class="btn ghost" data-pd="alles" data-code="${esc(code)}">${UI.alles[code] ? 'alleen wat open is' : 'alle velden'}</button>
      ${kleurgenoten(code).length ? `<a class="btn ghost" href="#/productdata/fam/${famId(index().famVan[code])}">hele familie</a>` : ''}
    </div>
    ${picqerBlok(code)}
  </div>`;
}
function viewProduct(code){
  code = D.PLOW[String(code || '').toLowerCase()] || code;
  if(!D.P[code]){ app.innerHTML = `<a class="small" href="#/productdata">← Productdata</a><div class="card empty mt8">Product ${esc(code)} staat niet in de Picqer-import.</div>`; return; }
  app.innerHTML = `<a class="small" href="javascript:history.back()">← terug</a>${maatLijst()}<div class="mt8">${productKaart(code, VOLG, false)}</div>`;
}

/* ---------- invoer lezen en opslaan ---------- */
function leesKaart(cw, ks){
  const c = UI.concept[cw] || {}, uit = {};
  document.querySelectorAll(`input[data-pdc="${CSS.escape(cw)}"]`).forEach(el => { uit[el.dataset.pdk] = el.value; });
  document.querySelectorAll(`.pd-seg button.on[data-pdc="${CSS.escape(cw)}"]`).forEach(el => { uit[el.dataset.pdk] = el.dataset.pdv; });
  Object.entries(c).forEach(([k, v]) => { if(uit[k] === undefined) uit[k] = v; });
  return ks ? Object.fromEntries(Object.entries(uit).filter(([k]) => ks.includes(k))) : uit;
}
async function bewaarProduct(code){
  const uit = leesKaart(code), wijz = {};
  for(const [k, v] of Object.entries(uit)){
    const st = staat(code, k), nv = check(k, v);
    if(!nv && st.s === 'open') continue;              // leeg gelaten
    if(st.s === 'ok' && nv === st.v) continue;          // niets veranderd
    wijz[k] = nv;                                        // ook "oud" bevestigen = vastleggen
  }
  const n = Object.keys(wijz).length;
  if(n) await opslaan({ [code]:wijz }, 'invul');
  delete UI.concept[code]; delete UI.alles[code];
  return n;
}
async function bewaarFamilie(){
  const wijz = {};
  for(const el of document.querySelectorAll('.pd-var[data-groep]')){
    const vk = el.dataset.groep, zicht = famZichtbaar(index().famVan[(index().vari[vk] || [])[0]]);
    const cs = (index().vari[vk] || []).filter(c => zicht.length ? zicht.includes(c) : D.P[c] && D.P[c].actief !== false);
    const uit = leesKaart('g:' + vk);
    for(const [k, v] of Object.entries(uit)){
      const nv = check(k, v); if(!nv) continue;
      cs.forEach(c => { const st = staat(c, k); if(st.s === 'ok' && st.v === nv) return; if(!nodig(c, k, waardeFn(c)) && !NVT(nv)) return; (wijz[c] = wijz[c] || {})[k] = nv; });
    }
    delete UI.concept['g:' + vk];
  }
  return opslaan(wijz, 'familie');
}

/* ---------- gebeurtenissen ---------- */
let busy = false;
app.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-pd],[data-pdv]'); if(!b || !app.contains(b)) return;
  if(b.dataset.pdv !== undefined && b.dataset.pdc){   // keuzeknop
    const cw = b.dataset.pdc, k = b.dataset.pdk, c = UI.concept[cw] = UI.concept[cw] || {};
    c[k] = b.classList.contains('on') && !b.classList.contains('voor') ? '' : b.dataset.pdv;
    rerender(); return;
  }
  const a = b.dataset.pd;
  if(a === 'scope'){ UI.scope = b.dataset.v; bewaar('scope2', UI.scope); UI.i = 0; rerender(); return; }
  if(a === 'laag'){ UI.laag = +b.dataset.v; bewaar('laag', UI.laag); UI.i = 0; rerender(); return; }
  if(a === 'over'){ UI.over.add(rij1()[UI.i]); rerender(); window.scrollTo(0, 0); return; }
  if(a === 'terug'){ UI.i = Math.max(0, UI.i - 1); rerender(); window.scrollTo(0, 0); return; }
  if(a === 'alles'){ const c = b.dataset.code; UI.alles[c] = !UI.alles[c]; rerender(); return; }
  if(a === 'naarlaag'){ UI.laag = +b.dataset.v; bewaar('laag', UI.laag); UI.scope = 'belangrijk'; bewaar('scope2', UI.scope); UI.i = 0; location.hash = '#/productdata/fam'; return; }
  if(busy) return;
  busy = true; b.disabled = true;
  try{
    if(a === 'save'){
      const code = b.dataset.code, n = await bewaarProduct(code);
      toast(n ? code + ': ' + plural(n, 'veld', 'velden') + ' vastgelegd' : code + ': niets veranderd');
      rerender(); if(/\/een/.test(location.hash)) window.scrollTo(0, 0);
    }
    if(a === 'famsave'){ const n = await bewaarFamilie(); toast(n ? plural(n, 'product', 'producten') + ' bijgewerkt' : 'Niets veranderd'); rerender(); }
    if(a === 'trek'){ await trekSteekproef(); rerender(); }
    if(a === 'steek'){ await steekUitslag(b.dataset.code, b.dataset.v); rerender(); }
    if(a === 'mig'){ b.textContent = 'Bezig…'; const m = await overzetten(); toast(plural(m.n, 'product', 'producten') + ' overgezet'); rerender(); }
  }catch(e){ toast(e.message, 6000); }
  finally{ busy = false; b.disabled = false; }
});
app.addEventListener('input', ev => {
  const el = ev.target;
  if(el.dataset && el.dataset.pdc){ const c = UI.concept[el.dataset.pdc] = UI.concept[el.dataset.pdc] || {}; c[el.dataset.pdk] = el.value; if(el.dataset.pdk === 'maat') el.classList.remove('voor'); else el.classList.remove('voor'); return; }
  if(el.dataset && el.dataset.pd === 'zoek'){ UI.zoek = el.value; UI.i = 0; clearTimeout(UI.t); UI.t = setTimeout(() => { rerender(); const n = document.querySelector('[data-pd="zoek"]'); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 300); }
});
app.addEventListener('change', ev => {
  const el = ev.target;
  if(el.dataset && el.dataset.pd === 'lev'){ UI.lev = el.value; bewaar('lev', UI.lev); UI.i = 0; rerender(); }
  if(el.dataset && el.dataset.pdc && el.dataset.pdk === 'maat') rerender();   // plaatsen en hoogte rekenen mee
});
app.addEventListener('keydown', ev => {
  if(ev.key !== 'Enter' || !ev.target.dataset || !ev.target.dataset.pdc) return;
  ev.preventDefault();
  const knop = document.querySelector('[data-pd="save"],[data-pd="famsave"]'); if(knop) knop.click();
});
function rerender(){ const y = window.scrollY; view(huidig.delen); window.scrollTo(0, y); }

/* ---------- ingang ---------- */
const huidig = { delen:[] };
async function view(delen){
  huidig.delen = delen || [];
  stijl();
  if(!S.klaar){ app.innerHTML = '<div class="card empty">Productdata laden…</div>'; await laad(); }
  if(S.fout){ app.innerHTML = `<div class="card"><h2>Productdata laden mislukt</h2><p class="mt8 small">${esc(S.fout.message)}</p></div>`; return; }
  if(location.hash.indexOf('#/productdata') !== 0) return;     // intussen weggeklikt
  const [sub, arg] = huidig.delen;
  if(sub === 'fam' && arg) return viewFamilie(arg);
  if(sub === 'fam') return viewFamilies();
  if(sub === 'een') return viewEen();
  if(sub === 'p' && arg) return viewProduct(arg);
  if(sub === 'dubbel') return viewDubbel();
  if(sub === 'poort') return viewPoort();
  return viewStart();
}
// na het opnieuw laden van de app (WH.load) ook de index vernieuwen
const herlaad = async () => { S.idx = null; await laad(true); };

return { view, herlaad, S, UI, voorstel, staat, famNaam, maatSig, index, opslaan, poort, poortCode, open, lijst, inLaag, nodig, waardeFn };
})();
