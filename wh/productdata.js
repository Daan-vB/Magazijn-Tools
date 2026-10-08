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
  maxpick: { t:'Max op pick', laag:1, type:'num', eh:true, hint:'Aanvullen bij + wat je bijvult. Bij 10 en een pallet van 67: 77' },
  lvl:     { t:'Aanvullen bij', laag:1, type:'num', eh:true, hint:'aanvullen als er dit of minder ligt' },
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
const S = { pd:{}, extra:{}, cat:null, labels:{}, mv:{}, toets:null, klaar:false, laden:null, mist:false, fout:null, idx:null };
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
        (window.WHC ? WHC.catalog(['wh-pq-cat', 'catalog-ean', 'wh-verplaatsingen']) : api('GET', 'catalog?key=in.(%22wh-pq-cat%22,%22catalog-ean%22,%22wh-verplaatsingen%22)&select=key,data,updated_at')).catch(() => [])
      ]);
      S.pd = {}; rows.forEach(r => { S.pd[r.productcode] = { data:r.data || {}, meta:r.meta || {}, t:r.updated_at }; });
      S.extra = {}; extra.forEach(r => { S.extra[r.productcode] = r; });
      S.cat = ((cat || []).find(r => r.key === 'wh-pq-cat') || {}).data || null;
      S.labels = ((cat || []).find(r => r.key === 'catalog-ean') || {}).data || {};
      // verplaatsingen uit Picqer: [id, tijd, wie, code, aantal, van, naar, magazijn]
      S.mv = {}; (((cat || []).find(r => r.key === 'wh-verplaatsingen') || {}).data || {}).rows?.forEach(r => { const c = D.PLOW[String(r[3] || '').toLowerCase()] || r[3]; (S.mv[c] = S.mv[c] || []).push({ n:num(r[4]) || 0, van:r[5] || '', naar:r[6] || '', vst:/spreuwel/i.test(r[7] || '') }); });
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
  if(S.toets && S.toets.code === code && S.toets.k === k) return null;
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
const pdWaarde = (code, k) => { if(S.toets && S.toets.code === code && S.toets.k === k) return null; const r = S.pd[code]; return r && r.data && !leeg(r.data[k]) ? String(r.data[k]) : null; };
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
/* Hoe vaak klopte een regel? Gemeten op 8-10-2026 tegen alles wat al vastlag (palletlabels, containers, jouw invoer):
   per regel het deel dat precies gelijk was. Zie toets(). Vanaf ZEKER wordt een waarde automatisch ingevuld. */
const ZEKER = 0.75;
// [kans, aantal getoetst] · gemeten met toets() op de export van 8-10-2026 03:53
const KANS = {
  'spp:mvvst':[1, 11], 'spp:vst2':[.83, 179], 'spp:bulk2':[.84, 63], 'spp:genoot':[.85, 205], 'spp:eens':[.65, 20], 'spp:vst1':[.66, 29], 'spp:bulk1':[.30, 125], 'spp:pakbon':[.43, 7], 'spp:mvontv':[.22, 9], 'spp:fam':[.51, 55],
  'pick:picqer':[1, 46], 'pick:genoot':[1, 5], 'pick:bulk':[0, 2],
  // Picqer-aanvulinstelling (alleen als die bewust is gezet, dus > 1): de huidige instelling, overgenomen tot jij iets anders kiest
  'maxpick:picqer':[.8, 0], 'lvl:picqer':[.8, 0],
  'maxpick:aanvulbase':[1, 3], 'maxpick:genoot':[1, 11], 'maxpick:som':[1, 26], 'maxpick:nu':[0, 0],
  'lvl:aanvulbase':[1, 2], 'lvl:genoot':[1, 11], 'lvl:verkoop':[.07, 30],
  'met:genoot':[1, 18], 'met:som':[1, 33], 'met:geenpallet':[1, 2],
  'maat:genoot':[1, 35], 'maat:afm':[.94, 17], 'maat:fam':[.64, 33],
  'hoogte:genoot':[1, 35], 'hoogte:fam':[.86, 14], 'hoogte:cbm':[.64, 14], 'hoogte:afm':[.36, 14],
  'gewicht:genoot':[.94, 35], 'gewicht:pakbon':[.89, 19], 'gewicht:picqer':[.82, 39], 'gewicht:fam':[.5, 2],
  'plaatsen:maat':[1, 98], 'maxlig:genoot':[1, 23], 'spd:genoot':[.85, 0], 'doos:genoot':[.85, 0], 'opm:genoot':[.85, 0], 'maxlig:fam':[.91, 22], 'vn:genoot':[.92, 142], 'vn:picqer':[.13, 571]
};
function uit(r, v, bron, extra){
  const k = KANS[r], p = k ? k[0] : null;
  return Object.assign({ v:String(v), bron:bron + (k && k[1] ? ' · klopte bij ' + Math.round(p * 100) + '% van ' + k[1] + ' getoetst' : ''), r, p, z:p === null ? 'mid' : p >= ZEKER ? 'hoog' : 'laag' }, extra || {});
}
function vanGenoten(lijst, k, bron, r){
  const vals = {};
  lijst.forEach(x => { const st = staat(x, k); if(st.s !== 'open' && !NVT(st.v)) (vals[st.v] = vals[st.v] || []).push(x); });
  const best = Object.entries(vals).sort((a, b) => b[1].length - a[1].length)[0];
  if(!best) return null;
  return uit(r, best[0], bron + ' ' + best[1].slice(0, 2).join(', ') + (best[1].length > 2 ? ' +' + (best[1].length - 2) : ''));
}
// alle aanwijzingen voor stuks per pallet, per bron
function sppBronnen(code){
  const b = {};
  const vst = modus((D.VSTVR[code] || []).map(a => num(a[1]) || 0));
  if(vst) b[vst.n >= 2 ? 'vst2' : 'vst1'] = { v:vst.v, t:'VST: ' + vst.n + ' van ' + vst.van + ' pallets hebben ' + nf(vst.v) };
  const vmax = Math.max(0, ...(D.VSTVR[code] || []).map(a => num(a[1]) || 0)); if(vmax && (!vst || vmax !== vst.v)) b.vstmax = { v:vmax, t:'VST: grootste pallet ' + nf(vmax) };
  const bl = modus(locaties(code).bulk.map(a => num(a[1]) || 0));
  if(bl) b[bl.n >= 2 ? 'bulk2' : 'bulk1'] = { v:bl.v, t:'bulk: ' + bl.n + ' pallet' + (bl.n > 1 ? 's' : '') + ' van ' + nf(bl.v) };
  const mv = S.mv[code] || [];
  const naarVst = modus(mv.filter(m => m.vst).map(m => m.n)); if(naarVst) b.mvvst = { v:naarVst.v, t:'verplaatst naar VST in pallets van ' + nf(naarVst.v) };
  const ontv = modus(mv.filter(m => !m.vst && !m.van && D.LOC[m.naar] && D.LOC[m.naar].bulk).map(m => m.n)); if(ontv) b.mvontv = { v:ontv.v, t:'binnengeboekt op bulk in pallets van ' + nf(ontv.v) };
  const r = pbRegels(code).find(r => r.soort === 'pallet' && num(r.per)); if(r) b.pakbon = { v:num(r.per) * (num(r.factor) || 1), t:'pakbon: ' + nf(num(r.per)) + ' per pallet' };
  return b;
}
function voorstel(code, k, w){
  const p = D.P[code] || {}, x = S.extra[code] || {}, eh = eenheid(code), kg = kleurgenoten(code);
  const oud = oudeWaarde(code, k);
  if(oud && oud.conflict){
    const st = staat(code, k);
    if(st.s === 'open') return { v:oud.conflict[0].v, bron:'palletlabels heeft ' + oud.conflict.length + ' verschillende: ' + oud.conflict.map(c => c.v + (c.waar && c.waar.length && k === 'spp' ? ' (' + c.waar.join(', ') + ')' : '')).join(' / ') + ' · eerste = laatst gebruikt, kies de juiste', z:'laag', r:'conflict' };
  }
  if(oud && !LEEGWAARDE(oud.v) && pdWaarde(code, k) === null) return { v:oud.v, bron:'stond al in ' + oud.bron, z:'hoog', r:'oud', p:1 };
  const genoot = kg.length ? vanGenoten(kg, k, 'zelfde als', k + ':genoot') : null;
  const fam = () => vanGenoten(famLeden(code).filter(c => !kg.includes(c)), k, 'familie:', k + ':fam');
  switch(k){
    case 'spp': {
      const b = sppBronnen(code);
      for(const r of ['mvvst', 'vst2', 'bulk2']) if(b[r]) return uit('spp:' + r, b[r].v, b[r].t);
      if(genoot) return genoot;
      // twee losse bronnen die hetzelfde zeggen
      const los = ['vstmax', 'vst1', 'bulk1', 'mvontv', 'pakbon'].filter(r => b[r]), tel = {};
      los.forEach(r => (tel[b[r].v] = tel[b[r].v] || []).push(r));
      const eens = Object.entries(tel).filter(([, rs]) => rs.length >= 2).sort((a, z) => z[1].length - a[1].length)[0];
      if(eens) return uit('spp:eens', eens[0], eens[1].map(r => b[r].t).join(' + '));
      for(const r of ['pakbon', 'vstmax', 'vst1', 'mvontv', 'bulk1']) if(b[r]) return uit('spp:' + r, b[r].v, b[r].t + (r === 'vst1' || r === 'bulk1' ? ' (kan een restpallet zijn)' : ''));
      return fam();
    }
    case 'pick': {
      const l = locaties(code);
      if(l.pick.length) return uit('pick:picqer', 'ja', 'Picqer: picklocatie ' + l.pick.map(a => a[0]).slice(0, 3).join(', '));
      if(l.bulk.length) return uit('pick:bulk', 'nee', 'Picqer: alleen bulk (' + l.bulk.map(a => a[0]).slice(0, 2).join(', ') + ')');
      return genoot;
    }
    case 'maxpick': {
      const pq = D.PQ[code], a = D.AANVUL[code];
      if(a && a.ok && num(a.max ?? a.tot) > 1) return uit('maxpick:aanvulbase', num(a.max ?? a.tot), 'aanvulbase: max ' + nf(num(a.max ?? a.tot)));
      if(pq && num(pq[1]) > 1) return uit('maxpick:picqer', num(pq[1]), 'Picqer: vul aan tot ' + nf(num(pq[1])));
      // afspraak: max op pick = aanvullen bij + wat je bijvult (bij aanvullen met volle pallet: + stuks per pallet)
      const lv = num(w('lvl')), spp = num(w('spp'));
      if(lv !== null && spp && w('met') === 'pallet') return uit('maxpick:som', lv + spp, 'aanvullen bij ' + nf(lv) + ' + volle pallet ' + nf(spp));
      if(genoot) return genoot;
      const l = locaties(code), m = Math.max(0, ...l.pick.map(a => num(a[1]) || 0));
      if(m > 0) return uit('maxpick:nu', m, 'nu ' + nf(m) + ' op pick');
      return null;
    }
    case 'lvl': {
      const pq = D.PQ[code], a = D.AANVUL[code];
      if(a && a.ok && num(a.lvl) > 1) return uit('lvl:aanvulbase', num(a.lvl), 'aanvulbase: aanvullen bij ' + nf(num(a.lvl)));
      if(pq && num(pq[0]) > 1) return uit('lvl:picqer', num(pq[0]), 'Picqer: aanvulniveau ' + nf(num(pq[0])));
      if(genoot) return genoot;
      // ± 2 dagen picken, nooit meer dan de helft van wat er op pick past
      const pd = pdVan(code), vk = vkmVan(code), mx = num(w('maxpick'));
      let v = pd > 0 ? Math.ceil(pd * 2) : vk > 0 ? Math.ceil(vk / 10) : null;
      if(v === null) return null;
      if(mx) v = Math.max(1, Math.min(v, Math.floor(mx / 2)));
      return uit('lvl:verkoop', v, '± 2 dagen picken' + (mx ? ', max de helft van max op pick' : '') + (pq && num(pq[0]) === 1 ? ' · Picqer staat op standaard 1' : ''));
    }
    case 'met': {
      if(genoot) return genoot;
      if(NVT(w('spp'))) return uit('met:geenpallet', 'doos', 'komt niet op pallet');
      const spp = num(w('spp')), mx = num(w('maxpick')), lv = num(w('lvl')) || 0, bij = mx ? mx - lv : 0;
      if(spp && mx) return bij >= spp ? uit('met:som', 'pallet', 'bijvullen (' + nf(bij) + ') ≥ 1 pallet') : uit('met:som', 'deel', 'bijvullen (' + nf(bij) + ') < 1 pallet (' + nf(spp) + ')');
      // wat er in Picqer van bulk naar pick ging
      const mv = (S.mv[code] || []).filter(m => D.LOC[m.van] && D.LOC[m.van].bulk && m.naar && !(D.LOC[m.naar] && D.LOC[m.naar].bulk));
      if(spp && mv.length) return mv.every(m => m.n >= spp) ? uit('met:mv', 'pallet', 'aangevuld met ' + mv.map(m => nf(m.n)).join(', ') + ' (≥ 1 pallet)') : uit('met:mv', 'deel', 'aangevuld met ' + mv.map(m => nf(m.n)).join(', ') + ' (minder dan 1 pallet)');
      return null;
    }
    case 'maat': {
      if(genoot) return genoot;
      const r = pbRegels(code).find(r => r.palletmaat || r.maat);
      if(r) return uit('maat:pakbon', String(r.palletmaat || r.maat), 'pakbon');
      const f = fam(); if(f) return f;
      const L = num(x.lengte_product_cm), B = num(x.breedte_product_cm);
      if(L >= 60 && B >= 60){ const m = passendeMaat(L, B); if(m) return uit('maat:afm', m, 'productmaat ' + nf(L) + '×' + nf(B) + ' cm (Picqer)'); }
      return null;
    }
    case 'hoogte': {
      if(genoot) return genoot;
      // pakbon: m³ per pallet gedeeld door de palletvloer
      const m = String(w('maat') || '').match(/(\d+)\s*x\s*(\d+)/);
      const r = pbRegels(code).find(r => r.soort === 'pallet' && num(r.cbm) && num(r.aantal));
      if(m && r){ const h = num(r.cbm) / num(r.aantal) / (m[1] * m[2] / 1e4) * 100; if(h > 20 && h < 260) return uit('hoogte:cbm', Math.round(h / 5) * 5, 'pakbon: ' + nf(num(r.cbm) / num(r.aantal), 2) + ' m³ per pallet op ' + m[1] + 'x' + m[2]); }
      const spp = num(w('spp')), L = num(x.lengte_product_cm), B = num(x.breedte_product_cm), H = num(x.hoogte_product_cm);
      if(m && spp && L && B && H && eh.e === 'st'){
        const PL = +m[1], PB = +m[2], per = Math.max(Math.floor(PL / L) * Math.floor(PB / B), Math.floor(PL / B) * Math.floor(PB / L), 1), lagen = Math.ceil(spp / per);
        return uit('hoogte:afm', Math.round(lagen * H + 15), 'Picqer-afmetingen: ' + per + ' per laag, ' + lagen + ' lagen × ' + nf(H) + ' cm + 15 cm pallet');
      }
      return fam();
    }
    case 'gewicht': {
      if(genoot) return genoot;
      const r = pbRegels(code).find(r => r.soort === 'pallet' && num(r.bruto_per));
      if(r) return uit('gewicht:pakbon', Math.ceil(num(r.bruto_per)), 'pakbon: bruto per pallet');
      const spp = num(w('spp')), g = num(x.gewicht_product_g);
      if(spp && g && eh.e === 'st') return uit('gewicht:picqer', Math.ceil(spp * g / 1000 + 15), nf(spp) + ' × ' + nf(g / 1000, 2) + ' kg (Picqer) + 15 kg pallet');
      return fam();
    }
    case 'plaatsen': {
      const m = w('maat');
      if(m && /\d+\s*x\s*\d+/.test(m)) return uit('plaatsen:maat', plaatsenUitMaat(m), 'uit palletmaat ' + m + ' (plaats = 90 cm)');
      return genoot;
    }
    case 'vn': {
      const kg2 = vnVanGenoot(code); if(kg2) return kg2;
      const s = vnVoorstel(p.naam); return s ? uit('vn:picqer', s, 'uit Picqer-naam') : null;
    }
    case 'spd': {
      if(genoot) return genoot;
      const r = pbRegels(code).find(r => r.soort !== 'pallet' && num(r.per) > 1);
      if(r) return uit('spd:pakbon', num(r.per) * (num(r.factor) || 1), 'pakbon: ' + nf(num(r.per)) + ' per pak');
      return fam();
    }
    case 'maxlig': return genoot || fam();
    case 'kgst': { const g = num(x.gewicht_product_g); return g ? { v:String(g / 1000), bron:'Picqer', z:'mid', r:'kgst' } : genoot; }
    case 'doos': return genoot;
    case 'opm': return genoot;
  }
  return null;
}
// Toets: doe per vastgelegde waarde alsof die er niet is en kijk wat de regels dan voorstellen. Per regel: hoe vaak gelijk.
function gelijk(k, a, b){
  if(leeg(a) || leeg(b)) return false;
  a = String(a).trim().toLowerCase(); b = String(b).trim().toLowerCase();
  if(k === 'maat'){ const s = v => v.replace(/\s/g, '').split('x').map(Number).sort((p, q) => p - q).join('x'); return s(a) === s(b); }
  const x = num(a), y = num(b);
  if(k === 'gewicht' && x && y) return Math.abs(x - y) / y <= 0.10;
  if(k === 'hoogte' && x && y) return Math.abs(x - y) <= 10;
  if(x !== null && y !== null) return Math.abs(x - y) < 1e-6;
  return a === b;
}
function toets(velden){
  const uitk = {};
  (velden || VOLG).forEach(k => Object.keys(S.pd).forEach(code => {
    if(!D.P[code]) return;
    const m = (S.pd[code].meta || {})[k], v = (S.pd[code].data || {})[k];
    if(leeg(v) || LEEGWAARDE(v) || NVT(v) || !m || /^auto/.test(m.bron || '')) return;
    S.toets = { code, k };
    let vs = null; try{ vs = voorstel(code, k, waardeFn(code)); }catch(e){}
    S.toets = null;
    const r = vs && vs.r ? vs.r : k + ':geen';
    const u = uitk[r] = uitk[r] || { goed:0, tot:0, fout:[] };
    u.tot++; if(vs && gelijk(k, vs.v, v)) u.goed++; else if(u.fout.length < 4 && vs) u.fout.push(code + ': ' + vs.v + ' ≠ ' + v);
  }));
  return uitk;
}
// "Sportvloer 6 mm oranje volle rol" bij de oranje kleurgenoot → "Sportvloer 6 mm geel volle rol" voor geel
function vnVanGenoot(code){
  const woorden = c => String((D.P[c] || {}).naam || '').split(/\s+/).filter(w => /[a-zà-ÿ]/i.test(w));
  for(const g of kleurgenoten(code)){
    const st = staat(g, 'vn'); if(st.s !== 'ok' || !st.v) continue;
    const a = woorden(g), b = woorden(code), al = a.map(w => w.toLowerCase()), bl = b.map(w => w.toLowerCase());
    const van = a.filter(w => !bl.includes(w.toLowerCase())), naar = b.filter(w => !al.includes(w.toLowerCase()));
    if(van.length !== 1 || naar.length !== 1) continue;
    const re = new RegExp('\\b' + van[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), m = st.v.match(re);
    if(!m) continue;
    const nw = m[0] === m[0].toLowerCase() ? naar[0].toLowerCase() : m[0] === m[0].toUpperCase() ? naar[0].toUpperCase() : naar[0].charAt(0).toUpperCase() + naar[0].slice(1).toLowerCase();
    return uit('vn:genoot', st.v.replace(re, nw), 'zoals ' + g + ' (' + st.v + ')');
  }
  return null;
}
function passendeMaat(L, B){
  const a = Math.max(L, B), b = Math.min(L, B);
  // tot 7 cm overstek is gewoon (een bord van 104x184 staat op 100x200)
  const kand = MATEN.map(m => m.split('x').map(Number)).map(([x, y]) => [Math.max(x, y), Math.min(x, y)]).filter(([x, y]) => x >= a - 7 && y >= b - 7).sort((p, q) => p[0] * p[1] - q[0] * q[1]);
  return kand.length ? kand[0][1] + 'x' + kand[0][0] : null;
}
function vnVoorstel(naam){
  let s = String(naam || '').trim(); if(!s) return '';
  s = s.replace(/\s*-\s*PER\s+(CM|METER|ROL|STUK|M2)\s*$/i, '').replace(/\s*-\s*\d+([.,]\d+)?\s*x\s*\d+([.,]\d+)?\s*m\s*$/i, '');
  s = s.replace(/\s*[-\/]\s*FULL ROLL\s*$/i, '').replace(/\s*-\s*€.*$/, '').replace(/\s{2,}/g, ' ').replace(/\s*-\s*$/, '').trim();
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
        const extra = v && typeof v === 'object' ? v : null;
        v = String((extra ? extra.v : v) ?? '').trim();
        if(!v){ delete data[k]; delete meta[k]; }
        else { data[k] = v; meta[k] = Object.assign({ op:nu, bron:bron || 'invul' }, extra && extra.uit ? { uit:extra.uit, r:extra.r } : {}); }
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
const chip = (t, cls) => `<span class="pd-c ${cls || ''}">${esc(t)}</span>`;
// kleurvelden: gelijk voor alle kleuren van dezelfde maat. De rest is per product.
const GROEP = new Set(['spp', 'maat', 'hoogte', 'gewicht', 'plaatsen', 'spd', 'maxlig', 'kgst', 'doos', 'opm']);
const actief = c => !!D.P[c] && D.P[c].actief !== false;
const genotenActief = code => kleurgenoten(code).filter(actief);
const ehVan = (code, k) => VELDEN[k].eh ? eenheid(code).mv : (VELDEN[k].eh2 || '');
const ENKEL = { 'st.':'stuk', rollen:'rol', m:'m', cm:'cm', 'm²':'m²' };
const datumKort = t => { try{ return new Date(t).toLocaleDateString('nl-NL', { day:'numeric', month:'short' }); }catch(e){ return ''; } };
const BRONNAAM = { overgezet:'overgezet', invul:'ingevuld', familie:'ingevuld voor de familie', samen:'samen ingevuld', basisregel:'basisregel aanvullen', regel:'aanvulregel', kleuren:'via een kleurgenoot' };
const idVan = s => String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
function toonWaarde(code, k, v){
  if(leeg(v)) return '';
  if(NVT(v)) return 'n.v.t.';
  const d = VELDEN[k], o = d.opt && d.opt.find(o => o[0] === v), eh = ehVan(code, k);
  return o ? o[1] : v + (eh && num(v) !== null && k !== 'maat' ? ' ' + eh : '');
}
// het deel van de naam waarin producten van elkaar verschillen ("Zwart / Rood", "60x90")
function verschilNamen(codes){
  const woorden = c => String((D.P[c] || {}).naam || '').split(/\s+/).filter(Boolean);
  const tel = {};
  codes.forEach(c => new Set(woorden(c).map(w => w.toLowerCase())).forEach(w => tel[w] = (tel[w] || 0) + 1));
  const uit = {};
  codes.forEach(c => {
    const naam = String((D.P[c] || {}).naam || c);
    if(codes.length < 2){ uit[c] = naam; return; }
    const rest = woorden(c).filter(w => tel[w.toLowerCase()] < codes.length).join(' ').replace(/^[\s\-–\/,|*]+|[\s\-–\/,|*]+$/g, '');
    uit[c] = rest ? rest.slice(0, 70) : c;
  });
  return uit;
}
function labels(codes){
  const per = {}, uit = {};
  codes.forEach(c => { const fk = index().famVan[c]; (per[fk] = per[fk] || []).push(c); });
  const meer = Object.keys(per).length > 1;
  Object.entries(per).forEach(([fk, cs]) => {
    const v = verschilNamen(cs), t = famTitel(fk, cs);
    cs.forEach(c => { uit[c] = { kort:v[c], fam:meer && cs.length > 1 ? t.slice(0, 48) : '' }; });
  });
  return uit;
}
// status van een product over laag 1 t/m 3: ok = compleet, dub = dubbel te kiezen, '' = nog niet compleet
function prodStatus(c){
  const w = waardeFn(c);
  let dub = false, open = false;
  [1, 2, 3].forEach(n => inLaag(n).forEach(k => { if(!nodig(c, k, w)) return; const st = staat(c, k); if(st.s === 'ok') return; if(st.conflict) dub = true; else open = true; }));
  return dub ? 'dub' : open ? '' : 'ok';
}

/* ---------- invoer onthouden (per apparaat, tot je opslaat) ---------- */
function leesJson(k, std){ try{ const v = JSON.parse(bewaard(k) || 'null'); return v === null ? std : v; }catch(e){ return std; } }
function bewaarConcept(){ bewaar('concept', JSON.stringify({ t:Date.now(), c:UI.concept })); }
function bewaarSel(){ bewaar('sel', JSON.stringify([...UI.sel])); }
function bewaarSamen(){ bewaar('samen', JSON.stringify(UI.samen || null)); }
(() => {
  const c = leesJson('concept', null);
  if(c && c.c && Date.now() - (c.t || 0) < 3 * 864e5) UI.concept = c.c;
  UI.sel = new Set(leesJson('sel', []));
  UI.samen = leesJson('samen', null);
  UI.anders = {};
})();

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
  .pd-bar{height:9px;background:#e6ebf0;border-radius:5px;overflow:hidden}
  .pd-bar i{display:block;height:100%;background:var(--ok);border-radius:5px}
  .pd-laag .pct{text-align:right;font-variant-numeric:tabular-nums;font-weight:800}
  .pd-laag .pct small{display:block;font-weight:600;color:var(--muted);font-size:11.5px}
  .pd-start{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .pd-start a{display:block;text-decoration:none;color:inherit;border:1px solid var(--line);border-radius:10px;padding:14px 16px;background:#fff}
  .pd-start a:hover{border-color:var(--blue)}
  .pd-start a b{font-size:16px;display:block} .pd-start a span{font-size:12.5px;color:var(--muted)}
  .pd-leg{font-size:12px;color:var(--muted)}
  .pd-steek{border-collapse:collapse;width:100%;font-size:13px;min-width:760px}
  .pd-steek th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line)}
  .pd-steek td{padding:8px;border-bottom:1px solid #eef1f5;vertical-align:top}
  .pd-steek tr.ok td{background:#f3faf6} .pd-steek tr.fout td{background:#fdf0ee}
  .pd-acties{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px}

  .pd-sec{background:#fff;border:1px solid #d6dde5;border-radius:10px;overflow:hidden;margin-bottom:14px}
  .pd-sec-kop{display:flex;justify-content:space-between;gap:8px 12px;flex-wrap:wrap;align-items:center;padding:12px 16px;border-bottom:1px solid #e3e8ee;background:#fbfcfd}
  .pd-sec-kop h3{font-size:16px;margin:0}
  .pd-sec-kop .l{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;min-width:0}
  .pd-nr{font-family:ui-monospace,Consolas,monospace;font-size:12px;font-weight:700;color:#fff;background:var(--ink);border-radius:4px;padding:2px 7px}
  .pd-kopsec{padding:16px 18px;display:grid;gap:8px}
  .pd-titel{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
  .pd-titel .code{font-size:19px;white-space:normal;overflow-wrap:anywhere}
  .pd-naam{font-size:15px;font-weight:600}
  .pd-tel{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:13px;align-items:center}
  .pd-c{display:inline-block;font-size:12px;font-weight:700;padding:2px 9px;border-radius:999px;white-space:nowrap}
  .c-ok{background:#e3f1e8;color:#1c6b3f} .c-voor{background:#fff3c4;color:#6b4f00} .c-dub{background:#fdebd8;color:#9a4205}
  .c-nodig{background:#eef1f5;color:#3f4d5b} .c-nvt{color:#6b7a89;border:1px solid #d6dde5;background:#fff} .c-fout{background:#fde2e1;color:#a1251b}
  .c-nieuw{background:#e3ecf9;color:var(--blue)} .c-auto{background:#e0f2ee;color:#0f6a58}
  .pd-bereik{display:inline-block;align-self:flex-start;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px}
  .pd-bereik.groep{background:#e8eef7;color:var(--blue)} .pd-bereik.prod{background:#f1eef7;color:#5a3e8f}
  .pd-pq{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px 18px;padding:14px 16px}
  .pd-pq > div{min-width:0}
  .pd-pq span{display:block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
  .pd-pq div div{font-size:14px;font-weight:600;overflow-wrap:anywhere}
  .pd-pqsec{background:#f7f9fb}
  .pd-rij{display:grid;grid-template-columns:190px minmax(0,1fr) minmax(0,240px);gap:8px 18px;padding:12px 16px;border-bottom:1px solid #eef1f4;align-items:start}
  .pd-rij:last-child{border-bottom:0}
  .pd-rij.voorstel{background:#fffdf3} .pd-rij.dubbel{background:#fffaf4} .pd-rij.fout{background:#fff6f5} .pd-rij.nieuw{background:#f7faff}
  .pd-lab{display:flex;flex-direction:column;gap:4px;padding-top:8px;min-width:0}
  .pd-lab label{font-weight:700;font-size:14px}
  .pd-ctl{display:flex;flex-direction:column;gap:8px;min-width:0}
  .pd-st{display:flex;flex-direction:column;gap:4px;padding-top:8px;min-width:0}
  .pd-st .br{font-size:12.5px;color:#4a5a6a;overflow-wrap:anywhere}
  .pd-vast{padding:9px 12px;border-radius:8px;font-size:14px;color:#6b7a89;background:#f7f9fb;border:1px solid #e3e8ee}
  .pd-pills{display:flex;flex-wrap:wrap;gap:6px}
  .pd-pill{border:1px solid #c3ccd6;background:#fff;color:var(--ink);border-radius:8px;padding:8px 11px;font:inherit;font-weight:700;font-size:13.5px;cursor:pointer;min-height:42px;text-align:left;line-height:1.25}
  .pd-pill:hover{border-color:#8796a8}
  .pd-pill.on{background:var(--blue);border-color:var(--blue);color:#fff}
  .pd-pill.voor.on{background:#fff3c4;color:var(--ink);border:2px solid var(--blue)}
  .pd-pill.anders{color:var(--blue);border:1px dashed var(--blue)}
  .pd-pill.anders.on{background:#e8eef7;color:var(--blue);border:2px solid var(--blue)}
  .pd-pill.klein{min-height:34px;padding:5px 9px;font-size:12.5px;font-weight:600}
  .pd-pill:disabled{opacity:.4;cursor:not-allowed}
  .pd-inv{display:inline-flex;gap:8px;align-items:center;min-width:0}
  .pd-ctl .pd-inv{display:flex}
  .pd-inv input{flex:1 1 auto;min-width:0;max-width:340px;font-size:16px;padding:9px 11px;min-height:42px}
  .pd-inv.klein input{width:90px;flex:none}
  .pd-inv .eh{font-size:13px;color:var(--muted);white-space:nowrap}
  .pd-inv input.voor{background:#fff8d6;border-color:#d9b640}
  .pd-inv input.fout{background:#fff6f5;border:2px solid var(--bad)}
  .pd-inv input.nodig{border-style:dashed;border-color:#9aa7b5}
  .pd-inv input.ok{background:#f3f9f5;border-color:#b9dbc5}
  .pd-inv input.nieuw{background:#eef4fc;border-color:#9db8e3}
  .pd-inv input:disabled{background:#f3f5f8;color:#8795a4;border-color:#e3e8ee}
  .pd-schat{font-size:12.5px;background:#fff4e5;border:1px solid #f1d2a8;border-radius:8px;padding:6px 8px;color:#6b4300}
  .pd-schat button{margin-left:6px}
  .pd-t{border-collapse:collapse;width:100%;min-width:780px;font-size:13px}
  .pd-t th{text-align:left;padding:8px 10px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);font-weight:700;border-bottom:1px solid #e3e8ee;background:#fbfcfd;white-space:nowrap}
  .pd-t td{padding:8px 10px;border-bottom:1px solid #eef1f4;white-space:nowrap}
  .pd-t tr.nu td{background:#f3f7fd}
  .pd-t td.nieuw{background:#eef4fc;color:var(--ink);font-weight:600}
  .pd-t td.over{background:#fdebd8;color:#7a3500;font-weight:600}
  .pd-t td.blijft{color:#8795a4}
  .pd-t td.dub{background:#fdebd8;color:#9a4205;font-weight:600}
  .pd-tab{overflow-x:auto}
  .pd-voet{position:sticky;bottom:0;z-index:5;background:rgba(255,255,255,.97);border:1px solid #d6dde5;border-bottom:0;box-shadow:0 -6px 18px rgba(19,32,44,.07);padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));border-radius:10px 10px 0 0;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;margin-top:6px}
  .pd-voet .grow{flex:1 1 300px}
  .pd-voet .btn{min-height:44px;font-size:14.5px}
  .pd-voet .fout{color:var(--bad)}
  .pd-famk{background:#fff;border:1px solid #d6dde5;border-radius:10px;padding:12px;margin-bottom:10px;display:grid;gap:8px}
  .pd-leden{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:4px 8px}
  .pd-lid{display:flex;align-items:stretch;gap:2px;border-radius:8px;min-width:0}
  .pd-lid.gekozen{background:#fff1e6}
  .pd-lid label{flex:none;display:flex;align-items:center;justify-content:center;width:40px;min-height:44px;cursor:pointer}
  .pd-lid label input{transform:scale(1.35);accent-color:var(--orange);cursor:pointer;margin:0}
  .pd-lid a{flex:1 1 auto;min-width:0;display:flex;gap:10px;align-items:flex-start;border:1px solid #e3e8ee;border-radius:8px;padding:7px 10px;text-decoration:none;color:inherit;background:#fff;font-size:13.5px}
  .pd-lid a:hover{border-color:var(--blue)}
  .pd-lidt{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
  .pd-lidt b{font-weight:600;overflow-wrap:anywhere}
  .pd-lidt .mono{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:var(--muted);overflow-wrap:anywhere}
  .pd-dot{flex:none;width:10px;height:10px;border-radius:50%;margin-top:5px;border:2px solid #8795a4;box-sizing:border-box}
  .pd-dot.ok{background:var(--ok);border-color:var(--ok)} .pd-dot.dub{background:#c2570c;border-color:#c2570c}
  .pd-srij{display:grid;grid-template-columns:220px minmax(0,1fr) minmax(0,240px);gap:8px 18px;padding:12px 16px;border-bottom:1px solid #eef1f4;align-items:start}
  .pd-srij.uit{background:#f7f9fb}
  .pd-saan{display:flex;gap:10px;align-items:center;min-height:42px;cursor:pointer}
  .pd-saan input{transform:scale(1.3);accent-color:var(--blue);margin:0 4px}
  .pd-sctl{display:flex;flex-direction:column;gap:8px;min-width:0}
  .pd-sctl .units{display:flex;gap:10px 16px;flex-wrap:wrap}
  .pd-shint{font-size:12.5px;color:#4a5a6a;padding-top:10px}
  .pd-shint .fout{color:var(--bad);font-weight:700}
  .pd-prij{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;padding:10px 16px;border-bottom:1px solid #eef1f4}
  .pd-pnaam{flex:1 1 240px;min-width:0}
  .pd-pnaam .mono{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:var(--muted);overflow-wrap:anywhere}
  .pd-vnrij{display:grid;grid-template-columns:230px minmax(0,1fr) auto;gap:6px 16px;align-items:start;padding:10px 16px;border-bottom:1px solid #eef1f4}
  .pd-vnrij .pd-inv{display:flex}
  .pd-vnrij .pd-inv input{max-width:none}
  .pd-codes{display:flex;flex-wrap:wrap;gap:6px}
  .pd-codes span{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;background:#eef1f5;border-radius:4px;padding:3px 7px}
  @media (max-width:760px){
    .pd-rij,.pd-srij,.pd-vnrij{grid-template-columns:1fr}
    .pd-lab,.pd-st,.pd-shint{padding-top:0}
    .pd-laag{grid-template-columns:1fr 70px} .pd-laag .pd-bar{grid-column:1/-1;order:3} .pd-start{grid-template-columns:1fr}
  }`;
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
const zoekVeld = () => `<input id="pd-zoek" data-pd="zoek" value="${esc(UI.zoek)}" placeholder="zoek code of naam" style="max-width:260px">`;
function laagTabs(codes){
  return `<div class="pd-chips">${LAGEN.map(l => { const v = voortgang(codes, l.n); const o = v.velden - v.gevuld; return `<button class="pd-chip ${UI.laag === l.n ? 'on' : ''}" data-pd="laag" data-v="${l.n}">${l.n}. ${esc(l.t)}<span class="n">${o ? nf(o) + ' open' : '✓'}</span></button>`; }).join('')}</div>`;
}

/* ---------- productkaart: wat er staat, wat er komt ---------- */
// Wat de kaart toont en bij Klopt opslaat. Volgorde: wat je net invulde > vastgelegd > dubbel (kiezen) > voorstel.
// Een schatting (minder zeker) wordt niet vooraf ingevuld: die neem je over met Gebruik.
function kaartWaarde(code, k, f){
  const c = UI.concept[code], st = staat(code, k);
  if(c && c[k] !== undefined){
    let v; try{ v = check(k, c[k]); }catch(e){ return { v:String(c[k]), s:'fout', fout:e.message, conflict:st.conflict, invoer:true }; }
    if(v === '') return { v:'', s:st.s === 'ok' ? 'wis' : 'open', conflict:st.conflict, invoer:true };
    return { v, s:st.s === 'ok' && v === st.v ? 'ok' : 'nieuw', was:st.s === 'ok' ? st.v : null, conflict:st.conflict, invoer:true };
  }
  if(st.s === 'ok') return { v:st.v, s:'ok' };
  if(st.conflict) return { v:'', s:'dubbel', conflict:st.conflict };
  if(k === 'kgst') return { v:'', s:'open' };
  const vs = voorstel(code, k, f);
  if(vs && !leeg(vs.v)){
    let v = null; try{ v = check(k, vs.v); }catch(e){}
    if(v === null || v === '' || vs.z === 'laag') return { v:'', s:'open', schatting:{ v:String(vs.v), bron:vs.bron } };
    return { v, s:'voorstel', bron:vs.bron };
  }
  return { v:'', s:'open' };
}
function kaartFn(code){
  const memo = {};
  const f = k => { if(!memo[k]){ memo[k] = { v:'', s:'open' }; memo[k] = kaartWaarde(code, k, f); } return memo[k].s === 'fout' ? '' : memo[k].v; };
  f.info = k => { f(k); return memo[k]; };
  return f;
}
function nvtReden(code, k){
  if(['maat', 'hoogte', 'gewicht', 'plaatsen', 'maxlig'].includes(k)) return 'Komt niet op een pallet (stuks per pallet is nvt)';
  if(['maxpick', 'lvl', 'met'].includes(k)) return 'Alleen bulk, geen picklocatie';
  if(['spd', 'doos'].includes(k)) return 'Picqer telt ' + eenheid(code).t + ', geen doos';
  return '';
}
function okBron(code, k){
  const m = S.pd[code] && S.pd[code].meta && S.pd[code].meta[k];
  if(!m) return '';
  const o = m.bron === 'overgezet' ? oudeWaarde(code, k) : null;
  if(m.bron === 'auto') return 'Automatisch uit ' + (m.uit || 'de bronnen') + (m.op ? ' · ' + datumKort(m.op) : '') + '. Klopt het niet? Pas aan en druk Klopt.';
  return (m.bron === 'overgezet' ? 'Overgezet' + (o && o.bron ? ' uit ' + o.bron : '') : 'Vastgelegd: ' + (m.uit || BRONNAAM[m.bron] || m.bron)) + (m.op ? ' · ' + datumKort(m.op) : '');
}
function veldCtrl(code, k, i){
  const d = VELDEN[k], at = `data-pdc="${esc(code)}" data-pdk="${k}"`, id = 'pd-' + idVan(code) + '-' + k, eh = ehVan(code, k);
  const voor = i.s === 'voorstel';
  const pill = (v, t, on, extra = '') => `<button type="button" class="pd-pill${on ? ' on' : ''}${extra}" ${at} data-pdv="${esc(v)}">${esc(t)}</button>`;
  const cls = { voorstel:'voor', fout:'fout', ok:'ok', nieuw:'nieuw' }[i.s] || 'nodig';
  const inp = (val, ph) => `<div class="pd-inv"><input id="${id}" ${at} value="${esc(val)}" placeholder="${esc(ph || '')}" class="${cls}" ${d.type === 'num' ? 'inputmode="decimal"' : ''} autocomplete="off" autocapitalize="off">${eh && d.type !== 'maat' ? `<span class="eh">${esc(eh)}</span>` : ''}</div>`;
  if(d.type === 'keus') return `<div class="pd-pills">${d.opt.map(([v, t]) => pill(v, t, String(i.v) === v, voor ? ' voor' : '')).join('')}</div>`;
  if(d.type === 'maat'){
    const v = String(i.v || ''), vast = MATEN.includes(v), anders = !!UI.anders[code + '|maat'] || (!!v && !vast && !NVT(v));
    return `<div class="pd-pills">${MATEN.map(m => pill(m, m, v === m, voor ? ' voor' : '')).join('')}<button type="button" class="pd-pill anders${anders ? ' on' : ''}" ${at} data-pdv="__anders">Andere maat</button></div>${anders ? inp(vast ? '' : v, 'bijv. 115x115 (lengte x breedte in cm)') : ''}`;
  }
  if(i.conflict){
    const opts = i.conflict.map(c => c.v), gekozen = opts.includes(String(i.v));
    return `<div class="pd-pills">${opts.map(o => pill(o, o + (k === 'spp' && !NVT(o) ? ' ' + eh : ''), String(i.v) === o)).join('')}</div>${inp(gekozen ? '' : i.v, 'of typ een eigen ' + (k === 'vn' ? 'naam' : 'waarde'))}`;
  }
  return inp(i.v, d.type === 'num' ? (d.hint && /nvt/.test(d.hint) ? 'getal, nvt of onb' : '') : '');
}
function veldRij(code, k, f, o = {}){
  const d = VELDEN[k], ng = o.zonderBereik ? 0 : genotenActief(code).length;
  const bereik = ng ? (GROEP.has(k) ? `<span class="pd-bereik groep">Alle kleuren (${ng + 1})</span>` : `<span class="pd-bereik prod">Alleen dit product</span>`) : '';
  const lab = `<div class="pd-lab"><label for="pd-${idVan(code)}-${k}">${esc(d.t)}</label>${bereik}</div>`;
  if(k !== 'kgst' && !nodig(code, k, f)) return `<div class="pd-rij nvt">${lab}<div class="pd-ctl"><div class="pd-vast">Niet van toepassing</div></div><div class="pd-st">${chip('N.v.t.', 'c-nvt')}<span class="br">${esc(nvtReden(code, k))}</span></div></div>`;
  const i = f.info(k);
  let ch, br = '';
  switch(i.s){
    case 'ok': { const m = S.pd[code] && S.pd[code].meta && S.pd[code].meta[k]; ch = m && m.bron === 'auto' && !i.invoer ? chip('Automatisch', 'c-auto') : chip('Vastgelegd', 'c-ok'); br = esc(okBron(code, k)); break; }
    case 'nieuw': ch = chip('Ingevuld', 'c-nieuw'); br = 'Wordt opgeslagen bij Klopt' + (i.was ? ' (was ' + esc(toonWaarde(code, k, i.was)) + ')' : ''); break;
    case 'wis': ch = chip('Wordt gewist', 'c-fout'); br = 'Leeg gemaakt: bij Klopt gaat de waarde eruit'; break;
    case 'fout': ch = chip('Klopt niet', 'c-fout'); br = esc(i.fout); break;
    case 'voorstel': ch = chip('Voorstel · controleer', 'c-voor'); br = esc(i.bron); break;
    case 'dubbel': ch = chip('Dubbel · kies', 'c-dub'); br = 'Palletlabels heeft ' + i.conflict.length + ' verschillende' + (k === 'spp' ? ': ' + esc(i.conflict.map(c => c.v + (c.waar && c.waar.length ? ' (' + c.waar.slice(0, 2).join(', ') + ')' : '')).join(' / ')) : '') + '. Kies of typ de juiste.'; break;
    default:
      if(k === 'kgst'){ const g = num((S.extra[code] || {}).gewicht_product_g); ch = chip('Optioneel', 'c-nvt'); br = (g ? 'Picqer: ' + esc(nf(g / 1000, 3)) + ' kg. ' : 'Picqer heeft geen gewicht. ') + 'Alleen invullen als dat niet klopt.'; }
      else { ch = chip('Nog nodig', 'c-nodig'); br = esc(d.hint || ''); }
  }
  if(i.s === 'open' && i.schatting){
    br += `<div class="pd-schat">Schatting: <b>${esc(toonWaarde(code, k, i.schatting.v))}</b> · ${esc(i.schatting.bron)}<button type="button" class="btn sm" data-pd="neem" data-code="${esc(code)}" data-k="${k}" data-v="${esc(i.schatting.v)}">Gebruik</button></div>`;
  }
  return `<div class="pd-rij ${i.s}">${lab}<div class="pd-ctl">${veldCtrl(code, k, i)}</div><div class="pd-st">${ch}<span class="br">${br}</span></div></div>`;
}
function kaartTel(code, f){
  const t = { tot:0, klaar:0, dub:0, voor:0, nodig:0 };
  [1, 2, 3].forEach(n => inLaag(n).forEach(k => {
    if(!nodig(code, k, f)) return;
    const s = f.info(k).s; t.tot++;
    if(s === 'ok') t.klaar++; else if(s === 'dubbel') t.dub++; else if(s === 'voorstel' || s === 'nieuw') t.voor++; else t.nodig++;
  }));
  return t;
}
function kaartKop(code, f){
  const p = D.P[code] || {}, t = kaartTel(code, f), pct = t.tot ? Math.round(100 * t.klaar / t.tot) : 100, g = genotenActief(code), sig = maatSig(p.naam);
  return `<section class="pd-sec pd-kopsec">
    <div class="pd-titel"><span class="code">${esc(code)}</span>${abcBadge(code)}${index().binnen.has(code) ? badge('komt binnen', 'b-warn') : ''}${p.actief === false ? badge('niet actief', 'b-bad') : ''}</div>
    <div class="pd-naam">${esc(p.naam || '')}</div>
    <div class="small muted">${g.length ? `<span class="pd-bereik groep">Kleurgroep</span> ${plural(g.length + 1, 'product', 'producten')}${sig ? ' in ' + esc(sig) : ''} delen pallet- en doosgegevens` : 'Geen andere kleuren van deze maat: eigen pallet- en doosgegevens'}</div>
    <div class="pd-tel"><span><b>${t.klaar}</b> van <b>${t.tot}</b> velden vastgelegd <span class="muted">(laag 1 t/m 3)</span></span>
      <span class="pd-chips">${t.dub ? chip(t.dub + ' dubbel', 'c-dub') : ''}${t.voor ? chip(t.voor + ' te bevestigen', 'c-voor') : ''}${t.nodig ? chip(t.nodig + ' nog nodig', 'c-nodig') : ''}${!t.dub && !t.voor && !t.nodig ? chip('compleet', 'c-ok') : ''}</span></div>
    <div class="pd-bar"><i style="width:${pct}%"></i></div>
  </section>`;
}
function pqBlok(code){
  const p = D.P[code] || {}, x = S.extra[code] || {}, pq = D.PQ[code] || [], l = locaties(code), eh = eenheid(code), bo = index().bo[code] || 0, vkm = vkmVan(code);
  const f = (lab, v, mono) => `<div><span>${esc(lab)}</span><div${mono ? ' class="code" style="white-space:normal"' : ''}>${v === '' || v === null || v === undefined ? '<span class="muted">–</span>' : v}</div></div>`;
  const afm = [x.lengte_product_cm, x.breedte_product_cm, x.hoogte_product_cm].every(v => !leeg(v)) ? nf(num(x.lengte_product_cm)) + ' × ' + nf(num(x.breedte_product_cm)) + ' × ' + nf(num(x.hoogte_product_cm)) + ' cm' : '';
  const lijstLoc = (a, n) => a.slice(0, n).map(q => esc(q[0]) + (q[1] ? ' (' + nf(q[1]) + ')' : '')).join(', ') + (a.length > n ? ' +' + (a.length - n) : '');
  return `<section class="pd-sec pd-pqsec"><div class="pd-sec-kop"><h3>Picqer weet <span class="muted" style="font-weight:600">· alleen lezen, hier pas je niets aan</span></h3><span class="small muted">eigenaar: Picqer</span></div>
    <div class="pd-pq">${[
      f('EAN', esc(p.ean || ''), true), f('Leverancier', esc(p.leverancier || '')), f('Code leverancier', esc(x.leverancier_code || p.leverancier_code || ''), true),
      f('Picqer telt', esc(eh.t)), f('Gewicht per stuk', !leeg(x.gewicht_product_g) ? nf(num(x.gewicht_product_g) / 1000, 3) + ' kg' : ''), f('Afmetingen', afm),
      f('Voorraad hier', nf(num(p.voorraad_hm) || 0) + ' ' + esc(eh.mv)), f('Voorraad VST', nf(num(p.voorraad_vst) || 0) + ' ' + esc(eh.mv)), f('Verkoop per maand', vkm ? nf(vkm) + ' ' + esc(eh.mv) : ''),
      f('Picklocatie', lijstLoc(l.pick, 3), true), f('Bulk', lijstLoc(l.bulk, 4) + (l.geen ? (l.bulk.length ? ' · ' : '') + nf(l.geen) + ' zonder locatie' : ''), true), f('Backorders', bo ? nf(bo) : ''),
      f('Aanvulniveau Picqer', !leeg(pq[0]) ? nf(num(pq[0])) + (num(pq[0]) === 1 ? ' <span class="muted">(standaard)</span>' : '') : ''), f('Vul aan tot (Picqer)', !leeg(pq[1]) ? nf(num(pq[1])) : ''),
      f('ABC', esc(abcVan(code) || '')), f('Tags', esc(p.tags || ''))
    ].join('')}</div>
    <div class="small muted" style="padding:0 16px 12px">Prijzen, inkoop en levertijd komen hier zodra de Picqer-koppeling leest.</div></section>`;
}
function laagSec(code, L, f){
  const ks = inLaag(L.n);
  let open = 0, tot = 0;
  ks.forEach(k => { if(!nodig(code, k, f)) return; tot++; if(f.info(k).s !== 'ok') open++; });
  return `<section class="pd-sec"><div class="pd-sec-kop"><div class="l"><span class="pd-nr">${L.n}</span><h3>${esc(L.t)}</h3><span class="small muted">${esc(L.u)}</span></div>${tot ? chip(open ? open + ' van ' + tot + ' open' : 'compleet', open ? 'c-nodig' : 'c-ok') : chip('niets nodig', 'c-nvt')}</div>${ks.map(k => veldRij(code, k, f)).join('')}</section>`;
}
function genotenTabel(code){
  const g = genotenActief(code); if(!g.length) return '';
  const alle = [code].concat(g).sort((a, b) => rang(a) - rang(b)), vn = verschilNamen(alle);
  const cel = (c, k) => { const st = staat(c, k); if(st.s === 'ok') return `<td>${esc(toonWaarde(c, k, st.v))}</td>`; if(st.conflict) return `<td class="dub">${st.conflict.length}× verschillend</td>`; return '<td class="blijft">nog nodig</td>'; };
  return `<section class="pd-sec"><div class="pd-sec-kop"><div style="min-width:0"><h3>Kleuren van dezelfde maat</h3><div class="small muted mt4">Kleurvelden (blauw label) zijn voor allemaal gelijk. Per kleur verschillen code, EAN, picklocatie, aanvullen en vloernaam.</div></div>
      <button class="btn sm" data-pd="samenkleur" data-code="${esc(code)}">Alle ${alle.length} samen invullen →</button></div>
    <div class="pd-tab"><table class="pd-t"><thead><tr><th>Kleur</th><th>Code</th><th>Per pallet</th><th>Palletmaat</th><th>Hoogte</th><th>Gewicht</th><th>Picklocatie</th><th>Max op pick</th><th>Vloernaam</th><th>Voorraad</th></tr></thead><tbody>
    ${alle.map(c => `<tr class="${c === code ? 'nu' : ''}"><td><b>${esc(vn[c])}</b></td><td><a class="code" href="#/productdata/p/${encodeURIComponent(c)}">${esc(c)}</a> ${abcBadge(c)}</td>${cel(c, 'spp')}${cel(c, 'maat')}${cel(c, 'hoogte')}${cel(c, 'gewicht')}<td class="code">${esc((locaties(c).pick[0] || [''])[0])}</td>${cel(c, 'maxpick')}${cel(c, 'vn')}<td>${nf(num(D.P[c].voorraad_hm) || 0)}</td></tr>`).join('')}
    </tbody></table></div></section>`;
}
// wat Klopt opslaat: dit product, en met alle = ook de kleurvelden van de kleurgenoten
function kaartPlan(code, alle, ks){
  const f = kaartFn(code), eigen = {}, wijz = {}, over = [];
  (ks || VOLG).forEach(k => {
    if(k !== 'kgst' && !nodig(code, k, f)) return;
    const i = f.info(k);
    if(i.s === 'fout') throw new Error(code + ' · ' + i.fout);
    if(i.s === 'wis'){ (wijz[code] = wijz[code] || {})[k] = ''; return; }
    if(leeg(i.v)) return;
    eigen[k] = i.v;
    if(i.s !== 'ok') (wijz[code] = wijz[code] || {})[k] = i.v;
  });
  if(alle) genotenActief(code).forEach(g => {
    const fg = waardeFn(g);
    Object.entries(eigen).forEach(([k, v]) => {
      if(!GROEP.has(k)) return;
      if(k !== 'kgst' && !nodig(g, k, fg) && !NVT(v)) return;
      const st = staat(g, k);
      if(st.s === 'ok' && st.v === v) return;
      if(st.s === 'ok' && !LEEGWAARDE(st.v)) over.push({ code:g, k, van:st.v, naar:v });
      (wijz[g] = wijz[g] || {})[k] = v;
    });
  });
  return { wijz, over };
}
function kaartVoet(code, inRij){
  const g = genotenActief(code);
  let plan = null, fout = '';
  try{ plan = kaartPlan(code, g.length > 0); }catch(e){ fout = e.message; }
  const nEigen = plan && plan.wijz[code] ? Object.keys(plan.wijz[code]).length : 0;
  const anderen = plan ? Object.keys(plan.wijz).filter(c => c !== code) : [];
  const nAnder = anderen.reduce((s, c) => s + Object.keys(plan.wijz[c]).length, 0);
  let tekst;
  if(fout) tekst = `<span class="fout">${esc(fout)}</span>`;
  else if(!nEigen && !nAnder) tekst = 'Alles op deze kaart is al vastgelegd.';
  else tekst = 'Klopt legt vast wat op deze kaart staat, ook de gele voorstellen: ' + plural(nEigen, 'waarde', 'waarden') + ' voor ' + esc(code) + (g.length ? (nAnder ? ', en ' + plural(nAnder, 'kleurveld', 'kleurvelden') + ' voor ' + plural(anderen.length, 'andere kleur', 'andere kleuren') : '; de andere kleuren hebben dezelfde kleurvelden al') : '') + '.';
  if(plan && plan.over.length) tekst += `<div class="fout mt4">Let op, overschrijft bij kleurgenoten: ${plan.over.slice(0, 4).map(o => esc(o.code + ' ' + VELDEN[o.k].t.toLowerCase() + ' ' + o.van + ' → ' + o.naar)).join(' · ')}${plan.over.length > 4 ? ' +' + (plan.over.length - 4) : ''}</div>`;
  const dis = fout ? 'disabled' : '';
  const knoppen = g.length
    ? `<button class="btn acc" data-pd="save" data-code="${esc(code)}" data-alle="1" ${dis}>${inRij ? 'Klopt, alle ' + (g.length + 1) + ' kleuren →' : 'Klopt, opslaan voor alle ' + (g.length + 1) + ' kleuren'}</button><button class="btn" data-pd="save" data-code="${esc(code)}" ${dis}>Alleen dit product</button>`
    : `<button class="btn acc" data-pd="save" data-code="${esc(code)}" ${dis}>${inRij ? 'Klopt →' : 'Klopt, opslaan'}</button>`;
  return `<div class="pd-voet"><div class="grow small">${tekst}</div><div class="row wrap">${inRij ? `${UI.i ? '<button class="btn ghost" data-pd="terug">← vorige</button>' : ''}<button class="btn" data-pd="over">Overslaan</button>` : ''}${knoppen}</div></div>`;
}
function productKaart(code, inRij){
  const f = kaartFn(code);
  return `<div class="pd-kaart">${kaartKop(code, f)}${pqBlok(code)}${LAGEN.map(L => laagSec(code, L, f)).join('')}${genotenTabel(code)}${kaartVoet(code, inRij)}</div>`;
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
    <div class="row wrap mt8">${levKeuze()}${zoekVeld()}</div>
  </div>
  ${S.mist ? `<div class="card" style="border-left:4px solid var(--bad)"><h3>Tabel productdata bestaat nog niet</h3><p class="small mt8">Ververs over een minuut. Blijft dit staan, meld het aan Claude.</p></div>` : ''}
  ${!S.mist && migN ? `<div class="card" style="border-left:4px solid var(--blue)"><h3>Eerst: overzetten wat al bekend is</h3>
    <p class="small mt8">Van ${nf(mig.prod)} producten staan gegevens nog verspreid over palletlabels, containers en de aanvulbase: ${Object.entries(mig.t).map(([k, n]) => nf(n) + ' × ' + esc(VELDEN[k].t.toLowerCase())).join(', ')}. Eén klik zet ze over naar productdata. De oude plekken blijven ongemoeid. Wat dubbel en verschillend in palletlabels staat, gaat niet mee: dat kies je zelf.</p>
    <div class="row wrap mt12"><button class="btn pri" data-pd="mig">Zet ${nf(migN)} waarden over</button></div></div>` : ''}
  ${UI.mig ? `<div class="card" style="border-left:4px solid var(--ok)"><h3>Overgezet</h3><div class="small mt8">${Object.keys(UI.mig.voor).map(k => esc(VELDEN[k].t) + ': vóór <b>' + nf(UI.mig.voor[k]) + '</b>, na <b>' + nf(UI.mig.na[k] || 0) + '</b>' + ((UI.mig.na[k] || 0) === UI.mig.voor[k] ? ' ✓' : ' <span class="badge b-bad">verschil</span>')).join('<br>')}</div></div>` : ''}
  <a class="card" href="#/productdata/auto" style="display:block;text-decoration:none;color:inherit;border-left:4px solid var(--ok)"><div class="row between wrap"><div><h3>Automatisch invullen uit alle bronnen</h3><div class="small muted mt4">Palletlabels, containers, pakbonnen, VST, bulk, verplaatsingen, Picqer en kleurgenoten naast elkaar. Alleen wat getoetst zeker genoeg is, jouw invoer blijft staan.</div></div><span class="btn ok">Bekijken →</span></div></a>
  ${poortKaart()}
  ${opschonenKaart()}
  <div class="card">
    <h3>Hoe ver ben je</h3><div class="small muted mt4">${nf(codes.length)} producten in deze selectie. Kies een laag en vul die eerst helemaal.</div>
    <div class="pd-lagen mt12">${LAGEN.map(l => { const v = voortgang(codes, l.n); const pct = v.velden ? Math.round(100 * v.gevuld / v.velden) : 100; return `<button class="pd-laag ${UI.laag === l.n ? 'on' : ''}" data-pd="laag" data-v="${l.n}"><div><b>${l.n}. ${esc(l.t)}</b><div class="u">${esc(l.u)}</div></div><div class="pd-bar"><i style="width:${pct}%"></i></div><div class="pct">${pct}%<small>${nf(v.vol)} / ${nf(v.tot)} compleet</small></div></button>`; }).join('')}</div>
  </div>
  <a class="card" href="#/productdata/regels" style="display:block;text-decoration:none;color:inherit;border-left:4px solid var(--blue)"><div class="row between wrap"><div><h3>Aanvulregels</h3><div class="small muted mt4">Vaste regels voor ringmat op rol, per cm, rubber rollen per meter, rubber matten, bureaustoelen en whiteboards. Plus een overzicht van tegels zonder picklocatie of aanvuladvies.</div></div><span class="btn">Instellen →</span></div></a>
  <div class="pd-start">
    <a href="#/productdata/kies"><b>Selecteren en samen invullen →</b><span>${nf(fams.filter(f => f.open).length)} families met open velden in ${esc(LAGEN[UI.laag - 1].t)}. Vink alle kleuren van één soort aan en vul ze in één keer in.${UI.sel.size ? ' Nu ' + nf(UI.sel.size) + ' geselecteerd.' : ''}</span></a>
    <a href="#/productdata/een"><b>Eén voor één →</b><span>${nf(openLaag)} producten met open velden in ${esc(LAGEN[UI.laag - 1].t)}. Lopers eerst, de hele kaart per product.</span></a>
  </div>
  <div class="card mt12"><div class="pd-leg">${chip('Vastgelegd', 'c-ok')} staat vast · ${chip('Voorstel · controleer', 'c-voor')} wordt vastgelegd als je Klopt drukt · ${chip('Nog nodig', 'c-nodig')} invullen, een schatting neem je over met Gebruik</div>
  <div class="small muted mt8">Getoetst tegen wat al bekend was (stuks per pallet): voorstel van een kleurgenoot klopte 83%, van VST-pallets 80%, van bulkpallets 84%. Een schatting uit de familie klopte maar 43%: daarom staat die niet vooraf ingevuld.</div></div>`;
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
  const toonV = (c, k) => { const st = staat(c, k); if(st.s !== 'ok') return '–'; return esc(toonWaarde(c, k, st.v)); };
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
  const isOpen = x => (x.sppConflict && staat(x.code, 'spp').s === 'open') || (x.vnConflict && staat(x.code, 'vn').s === 'open');
  const openD = d.filter(isOpen), klaarD = d.filter(x => !isOpen(x));
  const kaart = x => {
    const code = x.code, f = kaartFn(code), ks = [x.sppConflict ? 'spp' : null, x.vnConflict ? 'vn' : null].filter(Boolean);
    const regels = x.regels.map(g => `<div class="small"><span class="mono">${esc(g.name || '')}</span> · ${esc(String(g.qty ?? '') || 'leeg')} per pallet${g.used ? ' · laatst gebruikt ' + esc(new Date(g.used).toLocaleDateString('nl-NL')) : ''}</div>`).join('');
    return `<div class="card"><div class="pd-titel"><a class="code" href="#/productdata/p/${encodeURIComponent(code)}">${esc(code)}</a>${abcBadge(code)}<span class="small">${esc((D.P[code] || {}).naam || '')}</span></div>
      <div class="mt8" style="background:var(--soft);border-radius:6px;padding:8px 10px"><div class="tiny muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.04em">Regels in palletlabels</div>${regels}</div>
      <div class="pd-sec mt8" style="margin-bottom:0">${ks.map(k => veldRij(code, k, f, { zonderBereik:true })).join('')}</div>
      <div class="pd-acties"><button class="btn acc" data-pd="save" data-code="${esc(code)}" data-ks="${ks.join(',')}">Klopt, opslaan</button><a class="btn ghost" href="#/productdata/p/${encodeURIComponent(code)}">hele kaart</a></div></div>`;
  };
  app.innerHTML = `<a class="small" href="#/productdata">← Productdata</a>
  <div class="card mt8"><h2>Dubbel in palletlabels</h2><p class="small muted mt4">Kies per product welk aantal en welke vloernaam klopt en druk Klopt. Dat wordt de waarheid in productdata. Palletlabels zelf blijft ongemoeid tot de apps uit productdata lezen. Nog ${nf(openD.length)} te kiezen.</p></div>
  ${openD.map(kaart).join('') || '<div class="card empty">Geen dubbele waarden meer te kiezen.</div>'}
  ${klaarD.length ? `<div class="card"><details><summary class="small" style="cursor:pointer;font-weight:700">${nf(klaarD.length)} al gekozen</summary><div class="mt8">${klaarD.map(x => `<div class="small"><a class="mono" href="#/productdata/p/${encodeURIComponent(x.code)}">${esc(x.code)}</a> · ${esc(toonWaarde(x.code, 'spp', staat(x.code, 'spp').v))} · ${esc(staat(x.code, 'vn').v || '')}</div>`).join('')}</div></details></div>` : ''}
  ${w.length ? `<div class="card"><details><summary class="small" style="cursor:pointer;font-weight:700">${nf(w.length)} labelregels zonder bestaand Picqer-product</summary><div class="mt8">${w.map(x => `<div class="small"><span class="mono">${esc(x.naam)}</span> → ${esc(x.sub || '–')} · ${esc(x.waarom)}</div>`).join('')}</div></details></div>` : ''}`;
}

/* ---------- families en selecteren ---------- */
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
// leden van een familie die ertoe doen: in de selectie, of ze bewegen, of ze hebben voorraad
const famZichtbaar = fk => (index().fam[fk] || []).filter(c => actief(c) && (inScope(c) || inScope(c, 'beweegt') || inScope(c, 'voorraad')));
const selCodes = () => [...UI.sel].filter(c => D.P[c]).sort((a, b) => (index().famVan[a] || '').localeCompare(index().famVan[b] || '') || (index().varVan[a] || '').localeCompare(index().varVan[b] || '') || rang(a) - rang(b));
function famKaart(f){
  const leden = f.leden.slice().sort((a, b) => (index().varVan[a] || '').localeCompare(index().varVan[b] || '') || String(D.P[a].naam).localeCompare(String(D.P[b].naam)));
  const alleAan = leden.every(c => UI.sel.has(c)), lab = verschilNamen(leden);
  return `<div class="pd-famk" id="fam-${idVan(f.fk)}">
    <div class="row between" style="gap:8px;align-items:flex-start"><div style="min-width:0"><b style="font-size:14.5px">${esc(famTitel(f.fk, leden))}</b><div class="small muted">${esc(f.fk.split('|')[0])} · ${plural(leden.length, 'product', 'producten')}${f.maten > 1 ? ' in ' + f.maten + ' maten' : ''}${f.open ? ' · ' + nf(f.open) + ' open in ' + esc(LAGEN[UI.laag - 1].t) : ''}</div></div>
      ${leden.length > 1 ? `<button class="btn sm" data-pd="selfam" data-fk="${esc(f.fk)}">${alleAan ? 'geen' : 'alle ' + leden.length}</button>` : ''}</div>
    <div class="pd-leden">${leden.map(c => { const s = prodStatus(c), on = UI.sel.has(c); return `<div class="pd-lid${on ? ' gekozen' : ''}"><label><input type="checkbox" data-pd="sel" data-code="${esc(c)}" ${on ? 'checked' : ''} aria-label="Selecteer ${esc(c)}"></label><a href="#/productdata/p/${encodeURIComponent(c)}"><span class="pd-dot ${s}"></span><span class="pd-lidt">${leden.length > 1 ? `<b>${esc(lab[c])}</b><span class="mono">${esc(c)}</span>` : `<b class="mono" style="color:var(--ink)">${esc(c)}</b>`}</span>${abcBadge(c)}</a></div>`; }).join('')}</div>
  </div>`;
}
function viewKies(){
  const codes = zoekFilter(lijst()), fams = families(codes), n = UI.kiesN || 40, toon = fams.slice(0, n), nSel = selCodes().length;
  app.innerHTML = `<a class="small" href="#/productdata">← Productdata</a>
  <div class="card mt8"><div class="pd-kop"><div><h2>Selecteren</h2><div class="small muted mt4">Vink producten aan die je samen wilt invullen, bijvoorbeeld alle kleuren van één soort. Klik op een product voor de hele kaart.</div></div></div>
    <div class="mt12">${scopeChips()}</div><div class="row wrap mt8">${levKeuze()}${zoekVeld()}</div>
    <div class="row wrap mt12 small muted" style="gap:14px"><span class="row" style="gap:6px"><span class="pd-dot ok" style="margin:0"></span>compleet</span><span class="row" style="gap:6px"><span class="pd-dot dub" style="margin:0"></span>dubbel, kies</span><span class="row" style="gap:6px"><span class="pd-dot" style="margin:0"></span>nog niet compleet</span><span>(laag 1 t/m 3)</span></div></div>
  ${toon.map(famKaart).join('') || '<div class="card empty">Geen producten in deze selectie.</div>'}
  ${fams.length > toon.length ? `<div class="row wrap" style="justify-content:center;margin:6px 0 14px"><button class="btn" data-pd="meer">Toon meer (${nf(fams.length - toon.length)} families)</button></div>` : ''}
  <div class="pd-voet"><div class="grow"><b>${nSel ? plural(nSel, 'product', 'producten') + ' geselecteerd' : 'Niets geselecteerd'}</b><div class="small muted">${nSel ? 'De selectie blijft staan, ook als je een andere filter kiest.' : 'Vink eerst producten aan (vakje links), dan kun je ze samen invullen.'}</div></div>
    <div class="row wrap">${nSel ? '<button class="btn" data-pd="selniets">Niets</button>' : ''}<button class="btn acc" data-pd="samen" ${nSel ? '' : 'disabled'}>Samen invullen (${nSel}) →</button></div></div>`;
  if(UI.naFk){ const fk = UI.naFk; UI.naFk = null; setTimeout(() => { const el = $('fam-' + idVan(fk)); if(el) el.scrollIntoView({ block:'center' }); }, 60); }
}

/* ---------- samen invullen ---------- */
// huidige waarde zoals de kaart hem zou tonen: vastgelegd, anders een zeker voorstel (geen schatting, geen dubbel)
function nuWaarde(c, k){
  const st = staat(c, k);
  if(st.s === 'ok') return st.v;
  if(st.conflict || k === 'kgst') return '';
  const v = voorstel(c, k, waardeFn(c));
  if(!v || v.z === 'laag' || leeg(v.v)) return '';
  try{ return check(k, v.v); }catch(e){ return ''; }
}
function zelfde(codes, k){ const vals = [...new Set(codes.map(c => nuWaarde(c, k)).filter(v => v !== ''))]; return vals.length === 1 ? vals[0] : ''; }
function eenheden(codes){ const m = {}; codes.forEach(c => { const u = eenheid(c).mv; (m[u] = m[u] || []).push(c); }); return m; }
const kgVan = c => { const st = staat(c, 'kgst'); if(st.s === 'ok' && num(st.v)) return st.v; const g = num((S.extra[c] || {}).gewicht_product_g); return g ? String(Math.round(g) / 1000) : ''; };
const spdNodig = c => nodig(c, 'spd', waardeFn(c));
function startSamen(codes){
  const per = eenheden(codes);
  const b = { key:codes.join('|'), aan:{ spp:true, maat:true, hoogte:true, kg:true, plaatsen:true, maxlig:true, spd:true }, spp:{}, spd:{}, kg:{}, bij:{}, max:{}, kgModus:'stuk', gewicht:'', pick:{}, perProduct:false, bijP:{}, maxP:{}, vn:{}, met:'', maatAnders:false };
  Object.entries(per).forEach(([u, cs]) => {
    b.spp[u] = zelfde(cs, 'spp');
    b.spd[u] = zelfde(cs.filter(spdNodig), 'spd');
    const kgs = [...new Set(cs.map(kgVan).filter(Boolean))]; b.kg[u] = kgs.length === 1 ? kgs[0] : '';
  });
  b.maat = zelfde(codes, 'maat'); b.hoogte = zelfde(codes, 'hoogte'); b.plaatsen = zelfde(codes, 'plaatsen'); b.maxlig = zelfde(codes, 'maxlig'); b.met = zelfde(codes, 'met');
  if(Object.values(b.kg).every(v => !v)){ b.kgModus = 'pallet'; b.gewicht = zelfde(codes, 'gewicht'); }
  codes.forEach(c => {
    const pk = nuWaarde(c, 'pick'); if(pk) b.pick[c] = pk;
    b.bijP[c] = nuWaarde(c, 'lvl'); b.maxP[c] = nuWaarde(c, 'maxpick');
    const st = staat(c, 'vn'); b.vn[c] = st.conflict ? st.conflict[0].v : nuWaarde(c, 'vn');
  });
  const ja = codes.filter(c => b.pick[c] !== 'nee');
  Object.entries(eenheden(ja)).forEach(([u, cs]) => {
    b.bij[u] = zelfde(cs, 'lvl'); b.max[u] = zelfde(cs, 'maxpick');
    // verschillen ze al per product? dan per product invullen
    if((!b.bij[u] && cs.some(c => b.bijP[c])) || (!b.max[u] && cs.some(c => b.maxP[c]))) b.perProduct = true;
  });
  return b;
}
function samenPlan(b, codes){
  const rijen = [], fouten = [];
  let maatN = '';
  if(b.aan.maat && b.maat){ try{ maatN = check('maat', b.maat); }catch(e){ fouten.push(e.message); } }
  codes.forEach(c => {
    const u = eenheid(c).mv, w = {}, fc = waardeFn(c);
    const zet = (k, v) => { if(leeg(v) || !String(v).trim()) return; try{ const nv = check(k, v); if(nv) w[k] = nv; }catch(e){ fouten.push(c + ' · ' + e.message); } };
    const fn = k => w[k] !== undefined ? w[k] : fc(k);   // nieuwe waarde telt mee voor wat nodig is
    if(b.aan.spp) zet('spp', (b.spp || {})[u]);
    if(b.pick[c]) w.pick = b.pick[c];
    if(!NVT(fn('spp'))){
      if(maatN) w.maat = maatN;
      if(b.aan.hoogte) zet('hoogte', b.hoogte);
      if(b.aan.kg){
        if(b.kgModus === 'pallet') zet('gewicht', b.gewicht);
        else {
          const n = num(fn('spp')), kg = num((b.kg || {})[u]);
          if(n && kg){
            w.gewicht = String(Math.ceil(n * kg + 15));
            const pq = num((S.extra[c] || {}).gewicht_product_g);
            if(!pq || Math.abs(pq / 1000 - kg) > 0.005) w.kgst = String(kg);   // alleen als Picqer iets anders zegt
          }
        }
      }
      if(b.aan.plaatsen){ const pl = b.plaatsen || (maatN ? plaatsenUitMaat(maatN) : ''); if(pl) w.plaatsen = pl; }
      if(b.aan.maxlig) zet('maxlig', b.maxlig);
    }
    if(b.aan.spd && nodig(c, 'spd', fn)) zet('spd', (b.spd || {})[u]);
    if(fn('pick') !== 'nee'){
      zet('lvl', b.perProduct ? b.bijP[c] : (b.bij || {})[u]);
      zet('maxpick', b.perProduct ? b.maxP[c] : (b.max || {})[u]);
      if(b.met) w.met = b.met;
    }
    zet('vn', b.vn[c]);
    const nieuw = {}, over = {};
    Object.entries(w).forEach(([k, v]) => { const st = staat(c, k); if(st.s === 'ok' && st.v === v) return; nieuw[k] = v; if(st.s === 'ok' && !LEEGWAARDE(st.v)) over[k] = st.v; });
    rijen.push({ code:c, w, nieuw, over });
  });
  return { rijen, fouten, maatN };
}
function viewSamen(){
  const codes = selCodes();
  const terug = `<a class="small" href="#/productdata/kies">← Selectie</a>`;
  if(!codes.length){ app.innerHTML = terug + `<div class="card empty mt8">Niets geselecteerd.<div class="mt12"><a class="btn acc" href="#/productdata/kies">Producten kiezen →</a></div></div>`; return; }
  if(!UI.samen || UI.samen.key !== codes.join('|')){ UI.samen = startSamen(codes); bewaarSamen(); }
  const b = UI.samen, per = eenheden(codes), units = Object.keys(per), lab = labels(codes);
  const { rijen, fouten, maatN } = samenPlan(b, codes);
  const nW = rijen.reduce((s, r) => s + Object.keys(r.nieuw).length, 0), nP = rijen.filter(r => Object.keys(r.nieuw).length).length;
  const nOver = rijen.reduce((s, r) => s + Object.keys(r.over).length, 0);
  const ja = codes.filter(c => (b.pick[c] || waardeFn(c)('pick')) !== 'nee'), perJa = eenheden(ja);
  const aan = k => b.aan[k] !== false;
  const pill = (k, v, t, on, extra = '', dis = false, attrs = '') => `<button type="button" class="pd-pill${on ? ' on' : ''}${extra}" data-pds="${k}" data-v="${esc(v)}" ${attrs} ${dis ? 'disabled' : ''}>${esc(t)}</button>`;
  const inp = (k, val, o = {}) => `<span class="pd-inv${o.klein ? ' klein' : ''}"><input id="s-${k}${o.u !== undefined ? '-' + idVan(o.u) : ''}${o.code !== undefined ? '-' + idVan(o.code) : ''}" data-pds="${k}" ${o.u !== undefined ? `data-u="${esc(o.u)}"` : ''} ${o.code !== undefined ? `data-code="${esc(o.code)}"` : ''} value="${esc(val || '')}" placeholder="${esc(o.ph || '')}" ${o.num ? 'inputmode="decimal"' : ''} ${o.dis ? 'disabled' : ''} autocomplete="off" aria-label="${esc(o.lab || k)}">${o.eh ? `<span class="eh">${esc(o.eh)}</span>` : ''}</span>`;
  const perUnit = (k, obj, us, o = {}) => `<div class="units">${us.map(u => inp(k, (obj || {})[u], Object.assign({ u, num:true, klein:true, eh:o.ehFn ? o.ehFn(u) : u }, o))).join('')}</div>`;
  const rij = (k, label, ctrl, hint) => `<div class="pd-srij${aan(k) ? '' : ' uit'}"><label class="pd-saan"><input type="checkbox" id="s-aan-${k}" tabindex="-1" data-pds="aan" data-k="${k}" ${aan(k) ? 'checked' : ''}><b>${esc(label)}</b></label><div class="pd-sctl">${ctrl}</div><div class="pd-shint">${hint || ''}</div></div>`;
  const naam = c => `<div class="pd-pnaam"><b>${esc(lab[c].kort)}</b>${lab[c].fam ? ` <span class="muted">· ${esc(lab[c].fam)}</span>` : ''}<div class="mono">${esc(c)}</div></div>`;

  // blok 1: gelijk voor allemaal
  let maatFout = false; try{ if(b.maat) check('maat', b.maat); }catch(e){ maatFout = true; }
  const mDisp = (() => { try{ return b.maat ? check('maat', b.maat) : ''; }catch(e){ return ''; } })();
  const mVast = MATEN.includes(mDisp);
  const anders = !!b.maatAnders || (!!b.maat && !mVast);
  const plaatsVoor = maatN ? plaatsenUitMaat(maatN) : '', plaatsNu = b.plaatsen || plaatsVoor;
  const vb = rijen.find(r => r.w.gewicht && r.w.spp) || rijen.find(r => r.w.gewicht);
  const spdCodes = codes.filter(spdNodig), spdUnits = Object.keys(eenheden(spdCodes));
  const gelijk = [
    rij('spp', 'Stuks per pallet', perUnit('spp', b.spp, units, { dis:!aan('spp'), ph:'bijv. 11' }), units.length > 1 ? 'Picqer telt deze producten in ' + esc(units.join(' en ')) + ': per eenheid apart.' : 'Geldt voor alle ' + codes.length + ' · nvt = komt niet op een pallet'),
    rij('maat', 'Palletmaat', `<div class="pd-pills">${MATEN.map(m => pill('maat', m, m, !anders && mDisp === m, '', !aan('maat'))).join('')}${pill('maat', '__anders', 'Andere maat', anders, ' anders', !aan('maat'))}</div>${anders ? inp('maat', mVast ? '' : b.maat, { ph:'bijv. 115x115', eh:'cm', dis:!aan('maat'), lab:'Andere palletmaat' }) : ''}`,
      maatFout ? '<span class="fout">Klopt niet: schrijf als lengte x breedte, bijv. 115x115</span>' : 'Kies een vaste maat, of Andere maat'),
    rij('hoogte', 'Hoogte incl. pallet', inp('hoogte', b.hoogte, { eh:'cm', num:true, klein:true, ph:'bijv. 140', dis:!aan('hoogte') }), 'Een volle pallet, gemeten vanaf de vloer'),
    rij('kg', 'Gewicht', `<div class="pd-pills">${pill('kgModus', 'stuk', 'Per stuk', b.kgModus !== 'pallet', ' klein', !aan('kg'))}${pill('kgModus', 'pallet', 'Volle pallet', b.kgModus === 'pallet', ' klein', !aan('kg'))}</div>${b.kgModus === 'pallet' ? inp('gewicht', b.gewicht, { eh:'kg', num:true, klein:true, ph:'bijv. 840', dis:!aan('kg') }) : perUnit('kg', b.kg, units, { dis:!aan('kg'), ehFn:u => 'kg per ' + (ENKEL[u] || u) })}`,
      b.kgModus === 'pallet' ? 'Een volle pallet inclusief pallet' : vb ? 'Volle pallet ' + esc(vb.code) + ': ' + esc(nf(num(vb.w.spp || waardeFn(vb.code)('spp')))) + ' × ' + esc(nf(num(b.kg[eenheid(vb.code).mv]), 3)) + ' kg + 15 kg pallet = <b>' + esc(vb.w.gewicht) + ' kg</b>' : 'Volle pallet = stuks × gewicht per stuk + 15 kg pallet. Ingevuld uit Picqer waar dat bekend is.'),
    rij('plaatsen', 'Plaatsen op ligger', `<div class="pd-pills">${PLAATSEN.map(x => pill('plaatsen', x, x, plaatsNu === x, !b.plaatsen && plaatsVoor === x ? ' voor' : '', !aan('plaatsen'))).join('')}</div>`, plaatsVoor ? 'Voorstel uit palletmaat ' + esc(maatN) + ': ' + esc(plaatsVoor) + ' (een plaats is 90 cm)' : 'Kies eerst de palletmaat voor een voorstel'),
    rij('maxlig', 'Max pallets per ligger', inp('maxlig', b.maxlig, { eh:'pallets', num:true, klein:true, ph:'bijv. 3', dis:!aan('maxlig') }), vb ? 'Een volle pallet weegt ' + esc(vb.w.gewicht) + ' kg' : '')
  ].concat(spdCodes.length ? [rij('spd', 'Stuks per doos', perUnit('spd', b.spd, spdUnits, { dis:!aan('spd'), ph:'bijv. 6' }), 'nvt = geen doos' + (spdCodes.length < codes.length ? ' · alleen voor ' + spdCodes.length + ' van de ' + codes.length : ''))] : []);
  const nAan = Object.keys(b.aan).filter(k => aan(k) && (k !== 'spd' || spdCodes.length)).length, nRij = 6 + (spdCodes.length ? 1 : 0);

  // blok 2: picklocatie
  const pickRij = c => { const l = locaties(c), v = b.pick[c] || ''; const at = `data-code="${esc(c)}"`;
    return `<div class="pd-prij">${naam(c).replace('</div></div>', ' · Picqer: ' + esc(l.pick.length ? l.pick.map(a => a[0]).slice(0, 2).join(', ') : 'geen picklocatie') + (l.bulk.length ? ' · bulk ' + esc(l.bulk.map(a => a[0]).slice(0, 2).join(', ')) : '') + '</div></div>')}<div class="pd-pills">${pill('pick', 'ja', 'Ja, picklocatie', v === 'ja', '', false, at)}${pill('pick', 'nee', 'Nee, alleen bulk', v === 'nee', '', false, at)}</div></div>`; };

  // blok 3: aanvullen
  const jaUnits = Object.keys(perJa);
  const aanvul = !ja.length ? '<div class="small muted" style="padding:14px 16px">Geen van de gekozen producten heeft een picklocatie: niets aan te vullen.</div>' : `
    <div class="pd-srij"><div class="pd-saan"><b>Aanvullen bij</b></div><div class="pd-sctl">${perUnit('bij', b.bij, jaUnits, { dis:b.perProduct, ph:'bijv. 2' })}</div><div class="pd-shint">Aanvullen als er minder dan dit op de picklocatie ligt</div></div>
    <div class="pd-srij"><div class="pd-saan"><b>Max op pick</b></div><div class="pd-sctl">${perUnit('max', b.max, jaUnits, { dis:b.perProduct, ph:'bijv. 77' })}</div><div class="pd-shint">Aanvullen bij + wat je bijvult. Bij 10 en een pallet van 67: 77</div></div>
    <div class="pd-srij"><div class="pd-saan"><b>Aanvullen met</b></div><div class="pd-sctl"><div class="pd-pills">${VELDEN.met.opt.map(([v, t]) => pill('met', v, t, b.met === v)).join('')}</div></div><div class="pd-shint">Nog een keer klikken = niet aanpassen</div></div>
    <label class="pd-srij" style="cursor:pointer;display:flex;gap:10px;align-items:center"><input type="checkbox" id="s-perproduct" data-pds="perProduct" ${b.perProduct ? 'checked' : ''} style="transform:scale(1.3);accent-color:var(--blue);margin:0 4px;width:auto"><span><b>Verschilt per product</b> <span class="muted">· vul aanvullen bij en max op pick per product in</span></span></label>
    ${b.perProduct ? ja.map(c => `<div class="pd-prij">${naam(c)}<div class="row wrap" style="gap:10px"><span class="small muted">bij</span>${inp('bijP', b.bijP[c], { code:c, num:true, klein:true, lab:'Aanvullen bij ' + c })}<span class="small muted">max</span>${inp('maxP', b.maxP[c], { code:c, num:true, klein:true, eh:eenheid(c).mv, lab:'Max op pick ' + c })}</div></div>`).join('') : ''}
    <div class="small muted" style="padding:10px 16px">Leeg laten = niet aanpassen.</div>`;

  // blok 4: vloernaam
  const vnRij = c => { const st = staat(c, 'vn'), alt = st.conflict ? st.conflict.map(x => x.v) : [];
    const tag = st.conflict ? chip('had ' + alt.length + ' namen', 'c-dub') : st.s === 'ok' ? chip('vastgelegd', 'c-ok') : labelNamen(c).length ? chip('uit palletlabels', 'c-ok') : chip('nieuw voorstel', 'c-voor');
    return `<div class="pd-vnrij">${naam(c)}<div style="min-width:0">${inp('vn', b.vn[c], { code:c, lab:'Vloernaam ' + c })}${alt.length ? `<div class="pd-pills mt4">${alt.map(a => pill('vnAlt', a, a, b.vn[c] === a, ' klein', false, `data-code="${esc(c)}"`)).join('')}</div>` : ''}</div><div>${tag}</div></div>`; };

  // voorbeeld
  const KOL = [['spp', 'Per pallet'], ['maat', 'Palletmaat'], ['hoogte', 'Hoogte'], ['gewicht', 'Gewicht'], ['plaatsen', 'Plaatsen'], ['maxlig', 'Max/ligger'], ['spd', 'Per doos'], ['pick', 'Picklocatie'], ['lvl', 'Aanvullen bij'], ['maxpick', 'Max op pick'], ['met', 'Aanvullen met'], ['vn', 'Vloernaam']].filter(([k]) => k !== 'spd' || spdCodes.length);
  const cel = (r, k) => {
    const c = r.code;
    if(r.nieuw[k] !== undefined) return r.over[k] !== undefined ? `<td class="over">${esc(toonWaarde(c, k, r.over[k]))} → ${esc(toonWaarde(c, k, r.nieuw[k]))}</td>` : `<td class="nieuw">${esc(toonWaarde(c, k, r.nieuw[k]))}</td>`;
    const st = staat(c, k);
    return `<td class="blijft">${st.s === 'ok' ? esc(toonWaarde(c, k, st.v)) : '–'}</td>`;
  };
  const kgstN = rijen.filter(r => r.nieuw.kgst !== undefined).length;

  app.innerHTML = `${terug}
  <section class="pd-sec mt8"><div class="pd-kopsec"><div class="row between wrap"><h2 style="font-size:20px">Samen invullen · ${plural(codes.length, 'product', 'producten')}</h2><a class="btn" href="#/productdata/kies">Selectie aanpassen</a></div>
    <div class="pd-codes">${codes.map(c => `<span>${esc(lab[c].kort.slice(0, 40))} · ${esc(c)}</span>`).join('')}</div>
    <div class="small muted">Vier blokken van boven naar beneden, dan opslaan. Wat je uitvinkt in blok 1 blijft zoals het is. Leeg laten = niet aanpassen.</div></div></section>
  <section class="pd-sec"><div class="pd-sec-kop"><div class="l"><span class="pd-nr">1</span><h3>Wat is voor allemaal hetzelfde?</h3><span class="small muted">${nAan} van ${nRij} aangevinkt</span></div></div>${gelijk.join('')}</section>
  <section class="pd-sec"><div class="pd-sec-kop"><div class="l"><span class="pd-nr">2</span><h3>Picklocatie</h3><span class="small muted">${ja.length} met picklocatie · ${codes.length - ja.length} alleen bulk</span></div>
    <div class="row wrap"><button type="button" class="btn sm" data-pds="pickAlle" data-v="ja">Allemaal ja</button><button type="button" class="btn sm" data-pds="pickAlle" data-v="nee">Allemaal alleen bulk</button></div></div>${codes.map(pickRij).join('')}</section>
  <section class="pd-sec"><div class="pd-sec-kop"><div class="l"><span class="pd-nr">3</span><h3>Aanvullen</h3><span class="small muted">Alleen de ${ja.length} met picklocatie</span></div></div>${aanvul}</section>
  <section class="pd-sec"><div class="pd-sec-kop"><div class="l"><span class="pd-nr">4</span><h3>Vloernaam per product</h3><span class="small muted">De naam op het palletlabel. Per product, één keer goed.</span></div></div>${codes.map(vnRij).join('')}</section>
  <section class="pd-sec"><div class="pd-sec-kop"><div style="min-width:0"><h3>Dit wordt opgeslagen</h3><div class="small muted mt4">${nW} waarden voor ${nP} producten. Blauw = wordt opgeslagen, oranje = overschrijft een vastgelegde waarde, grijs = blijft zoals het is.${kgstN ? ' Bij ' + kgstN + ' producten wijkt het gewicht per stuk af van Picqer: dat wordt apart bewaard.' : ''}</div></div></div>
    <div class="pd-tab"><table class="pd-t"><thead><tr><th>Product</th>${KOL.map(([, t]) => `<th>${esc(t)}</th>`).join('')}</tr></thead><tbody>
    ${rijen.map(r => `<tr><td><b>${esc(lab[r.code].kort.slice(0, 40))}</b><div class="code" style="font-size:11.5px;font-weight:600">${esc(r.code)}</div></td>${KOL.map(([k]) => cel(r, k)).join('')}</tr>`).join('')}
    </tbody></table></div></section>
  <div class="pd-voet"><div class="grow"><b>${nW ? nW + ' waarden voor ' + plural(nP, 'product', 'producten') : 'Nog niets te bewaren'}</b><div class="small ${fouten.length ? 'fout' : 'muted'}">${fouten.length ? esc(fouten[0]) + (fouten.length > 1 ? ' (+' + (fouten.length - 1) + ')' : '') : nOver ? nOver + ' vastgelegde waarden worden overschreven (oranje in de tabel).' : 'Wordt bewaard in productdata. Je invoer blijft bewaard tot je opslaat.'}</div></div>
    <div class="row wrap"><button class="btn" data-pd="samenstop">Annuleren</button><button class="btn acc" data-pd="samensave" ${!nW || fouten.length ? 'disabled' : ''}>Opslaan voor ${plural(nP, 'product', 'producten')}</button></div></div>`;
}
function samenInvoer(el){
  const b = UI.samen; if(!b) return;
  const k = el.dataset.pds, u = el.dataset.u, c = el.dataset.code, v = el.value;
  if(u !== undefined) (b[k] = b[k] || {})[u] = v;
  else if(c !== undefined) (b[k] = b[k] || {})[c] = v;
  else b[k] = v;
  if(k === 'maat' && !b.plaatsenGekozen) b.plaatsen = '';
  bewaarSamen();
}
function samenKlik(s){
  const b = UI.samen; if(!b) return;
  const k = s.dataset.pds, v = s.dataset.v, c = s.dataset.code;
  if(k === 'maat'){ if(v === '__anders'){ b.maatAnders = true; if(MATEN.includes(b.maat)) b.maat = ''; } else { b.maat = v; b.maatAnders = false; } if(!b.plaatsenGekozen) b.plaatsen = ''; }
  else if(k === 'plaatsen'){ b.plaatsen = b.plaatsen === v ? '' : v; b.plaatsenGekozen = !!b.plaatsen; }
  else if(k === 'kgModus') b.kgModus = v;
  else if(k === 'pick') b.pick[c] = v;
  else if(k === 'pickAlle') selCodes().forEach(x => { b.pick[x] = v; });
  else if(k === 'met') b.met = b.met === v ? '' : v;
  else if(k === 'vnAlt') b.vn[c] = v;
  else return;
  bewaarSamen(); rerender();
  if(k === 'maat' && v === '__anders') setTimeout(() => { const n = $('s-maat'); if(n) n.focus(); }, 0);
}
async function bewaarSamenNu(){
  const codes = selCodes(), { rijen, fouten } = samenPlan(UI.samen, codes);
  if(fouten.length) throw new Error(fouten[0]);
  const wijz = {}; rijen.forEach(r => { if(Object.keys(r.nieuw).length) wijz[r.code] = r.nieuw; });
  const nW = Object.values(wijz).reduce((s, w) => s + Object.keys(w).length, 0);
  const n = await opslaan(wijz, 'samen');
  UI.naFk = index().famVan[codes[0]];
  UI.sel.clear(); bewaarSel(); UI.samen = null; bewaarSamen();
  return { n, nW };
}

/* ---------- aanvulregels: vaste regels per soort product (afgesproken met Daan, 8-10-2026) ----------
   Alleen producten met een picklocatie in Picqer. Midden (Batch Midden) slaan we over: dat is van Katerina.
   Elke regel zet: picklocatie ja, aanvullen bij, aanvullen met, max op pick (= aanvullen bij + wat erbij komt). */
const BASIS_NAAM = /ringmat|sportvloer|stalmat|rubber|tegel|werkplaatsmat|beschermmat|fitness/i;
const BASIS_NIET = /\brol\b|op rol|per meter|per cm|strekkende|borstel|connector|trap ?strip|deurmat|kokos|tape|lijm/i;
const RUBBER = /rubber|nbr|epdm|siliconen|viton|neopreen|isolatiemat|hoogspanningsloper|vde loper|cobra|hamerslag/i;
const WB_NIET = /marker|wisser|houder|\bkit\b|magne(et|ten)|sheets|ezel|onderstel|untergestell|klembord|accessoire|reiniger|spray|\bset\b|stift|pen\b|scheidingswand|akoestisch/i;
// outlet = losse retourstukken: geen aanvulregel
const isOutlet = c => /outlet/i.test(c) || /outlet/i.test(naamVan(c));
const isMidden = c => /batch midden/i.test(String((D.P[c] || {}).tags || ''));
const naamVan = c => String((D.P[c] || {}).naam || '');
const tagsVan = c => String((D.P[c] || {}).tags || '').toLowerCase();
function breedteCm(naam){
  const n = String(naam || '').toLowerCase();
  const m = n.match(/breedte\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\b/) || n.match(/(\d+(?:[.,]\d+)?)\s*(cm)\s*breed/);
  if(!m) return null;
  let v = num(m[1]); const u = m[2] || (v < 5 ? 'm' : 'cm');
  return u === 'm' ? v * 100 : u === 'mm' ? v / 10 : v;
}
// rollengte in meter: uit de naam ("rol van 10 m", "lengte 15 m") of de pakbon (factor = cm per rol)
function rolLengte(c){
  const ui = UI.regels && UI.regels.in[c]; if(!leeg(ui) && num(ui)) return { v:num(ui), bron:'ingevuld' };
  const m = naamVan(c).toLowerCase().match(/(?:rol van|lengte)\s*(\d+(?:[.,]\d+)?)\s*m\b/); if(m) return { v:num(m[1]), bron:'naam' };
  const r = pbRegels(c).find(r => num(r.factor) >= 100); if(r) return { v:num(r.factor) / 100, bron:'pakbon' };
  return null;
}
const spp = c => { const st = staat(c, 'spp'); return st.s === 'ok' && !NVT(st.v) ? num(st.v) : null; };
const REGELS = [
  { id:'ringrol', t:'Ringmat op rol, volle rollen', u:'Aanvullen bij 1 rol, met een volle pallet. Max op pick = 1 + rollen per pallet.',
    past:c => eenheid(c).e === 'rol' && /ringmat/i.test(naamVan(c)),
    doel:c => ({ lvl:1, met:'pallet', max:spp(c) ? 1 + spp(c) : null }) },
  { id:'cm', t:'Per cm verkocht', u:'Aanvullen bij 600 cm. Rol van 6 m of korter: aanvullen met 2 rollen. Rol van 10 of 15 m: met 1 rol. Max op pick = 600 + wat erbij komt.', invoer:'rol',
    past:c => eenheid(c).e === 'cm',
    doel:c => { const L = rolLengte(c); if(!L) return { lvl:600, met:'deel', max:null, mist:'rollengte' }; const n = L.v <= 6 ? 2 : 1; return { lvl:600, met:'deel', max:600 + Math.round(n * L.v * 100), uitleg:n + ' × rol van ' + nf(L.v) + ' m (' + L.bron + ')' }; } },
  { id:'breed', t:'Rubber rollen per meter, breder dan 150 cm', u:'Ook ringmat, cobra en hamerslag. Aanvullen bij 10 m met 2 rollen = 20 m. Max op pick = 30 m.',
    past:c => eenheid(c).e === 'm' && (RUBBER.test(naamVan(c)) || /ringmat/i.test(naamVan(c))) && breedteCm(naamVan(c)) > 150,
    doel:() => ({ lvl:10, met:'deel', max:30 }) },
  { id:'smal', t:'Rubber rollen per meter, 150 cm of smaller', u:'Geen ringmat, geen sportvloer. Aanvullen bij 10 m met 3 rollen = 30 m. Max op pick = 40 m.',
    past:c => { const n = naamVan(c), b = breedteCm(n); return eenheid(c).e === 'm' && RUBBER.test(n) && !/ringmat|sportvloer/i.test(n) && b !== null && b <= 150; },
    doel:() => ({ lvl:10, met:'deel', max:40 }) },
  { id:'mpal', t:'Rubber op rol per meter, per pallet', u:'Ringmat op rol per meter (tot 150 cm), sportvloer per meter, werkplaatsmat op rol. Aanvullen bij 10 m met een volle pallet. Max op pick = 10 + meters per pallet.',
    past:c => eenheid(c).e === 'm' && /ringmat|sportvloer|werkplaatsmat|rubber/i.test(naamVan(c)),
    doel:c => ({ lvl:10, met:'pallet', max:spp(c) ? 10 + spp(c) : null }) },
  { id:'mat', t:'Rubber matten per stuk (A/B)', u:'Ringmat, sportvloer tegel en mat, stalmat, tegels. Aanvullen bij 10 met een volle pallet. Max op pick = 10 + stuks per pallet.',
    past:c => { const n = naamVan(c), a = abcVan(c); return (a === 'A' || a === 'B') && eenheid(c).e === 'st' && !/batch/i.test(String((D.P[c] || {}).tags || '')) && BASIS_NAAM.test(n) && !BASIS_NIET.test(n); },
    doel:c => ({ lvl:10, met:'pallet', max:spp(c) ? 10 + spp(c) : null }) },
  { id:'stoel', t:'Bureaustoelen', u:'Aanvullen als de picklocatie leeg is, met een volle pallet. Max op pick = stuks per pallet.',
    past:c => eenheid(c).e === 'st' && /bureaustoel/i.test(naamVan(c)),
    doel:c => ({ lvl:0, met:'pallet', max:spp(c) || null }) },
  { id:'wb', t:'Whiteboards', u:'Aanvullen bij 3 met een volle pallet. Past er minder op de picklocatie dan bij + een pallet? Vul in hoeveel er past: dan aanvullen tot dat aantal (deel van pallet).', invoer:'past',
    past:c => eenheid(c).e === 'st' && /board/.test(tagsVan(c)) && /whiteboard/i.test(naamVan(c)) && !WB_NIET.test(naamVan(c)),
    doel:c => { const p = num(UI.regels && UI.regels.in[c]), s = spp(c); if(p && (!s || p < 3 + s)) return { lvl:3, met:'deel', max:p, uitleg:'past ' + nf(p) + ' op pick' }; return { lvl:3, met:'pallet', max:s ? 3 + s : null }; } }
];
const regelSt = () => UI.regels = UI.regels || { r:'mat', hand:false, uit:{}, in:leesJson('regelin', {}) };
// welke regel geldt voor een product: de eerste die past
let regelCache = null;
function regelIndeling(){
  if(regelCache && regelCache.t === S.idx) return regelCache;
  const per = {}, zonderPick = {};
  REGELS.forEach(R => { per[R.id] = []; zonderPick[R.id] = 0; });
  Object.keys(D.P).forEach(c => {
    if(!actief(c) || isMidden(c) || isOutlet(c)) return;
    const R = REGELS.find(R => R.past(c)); if(!R) return;
    if(locaties(c).pick.length) per[R.id].push(c); else zonderPick[R.id]++;
  });
  Object.values(per).forEach(l => l.sort((a, b) => String(index().famVan[a]).localeCompare(String(index().famVan[b])) || rang(a) - rang(b)));
  regelCache = { t:S.idx || index(), per, zonderPick };
  return regelCache;
}
const basisKandidaten = () => regelIndeling().per.mat;
function sppVoor(c){
  const st = staat(c, 'spp');
  if(st.s === 'ok') return { v:st.v, bron:'vastgelegd' };
  if(st.conflict) return { v:'', bron:'dubbel in palletlabels' };
  const v = nuWaarde(c, 'spp'); return v ? { v, bron:'voorstel' } : { v:'', bron:'' };
}
function regelPlan(R, codes, b){
  return codes.map(c => {
    const w = {}, over = {}, vast = {}, d = R.doel(c);
    const zet = (k, v) => {
      v = String(v);
      const st = staat(c, k);
      if(st.s === 'ok'){
        if(st.v === v) return;
        const m = S.pd[c] && S.pd[c].meta && S.pd[c].meta[k];
        // jouw eigen invoer blijft staan; wat overgezet of automatisch was, wint de regel
        if(b.hand || (m && (m.bron === 'overgezet' || m.bron === 'auto'))) over[k] = st.v; else { vast[k] = st.v; return; }
      }
      w[k] = v;
    };
    zet('pick', 'ja'); zet('lvl', d.lvl); zet('met', d.met);
    if(d.max !== null && d.max !== undefined) zet('maxpick', d.max);
    return { code:c, w, over, vast, d, geenMax:d.max === null || d.max === undefined };
  });
}
function viewRegels(){
  const b = regelSt(), ind = regelIndeling();
  const tegelN = tegelOverzicht().length;
  if(b.r !== 'tegels' && !REGELS.find(R => R.id === b.r)) b.r = 'mat';
  const tabs = REGELS.map(R => { const open = regelPlan(R, ind.per[R.id], Object.assign({}, b, { hand:false })).filter(r => Object.keys(r.w).length || r.geenMax).length;
    return `<button class="pd-chip ${b.r === R.id ? 'on' : ''}" data-pd="regel" data-v="${R.id}" style="margin:0 6px 6px 0">${esc(R.t)}<span class="n">${open ? nf(open) + ' open' : ind.per[R.id].length ? '✓' : '0'}</span></button>`; }).join('')
    + `<button class="pd-chip ${b.r === 'tegels' ? 'on' : ''}" data-pd="regel" data-v="tegels" style="margin:0 6px 6px 0">Tegels CE: overzicht<span class="n">${nf(tegelN)}</span></button>`;
  const kop = `<a class="small" href="#/productdata">← Productdata</a>
  <section class="pd-sec mt8"><div class="pd-kopsec"><h2 style="font-size:20px">Aanvulregels</h2>
    <div class="small muted">Vaste regels per soort product. Alleen producten met een picklocatie in Picqer; Midden slaan we over. Max op pick = aanvullen bij + wat erbij komt. Wat al volgens de regel staat, verdwijnt uit de lijst.</div>
    <div>${tabs}</div>
    <label class="row small" style="gap:6px;cursor:pointer"><input type="checkbox" id="pdr-hand" data-pdr="hand" ${b.hand ? 'checked' : ''}> Ook waarden overschrijven die ik zelf heb ingevuld</label></div></section>`;
  if(b.r === 'tegels'){ app.innerHTML = kop + tegelBlok(); return; }
  const R = REGELS.find(R => R.id === b.r), uit = b.uit[R.id] = b.uit[R.id] || new Set();
  const klaarRij = regelPlan(R, ind.per[R.id], Object.assign({}, b, { hand:false })).filter(r => !Object.keys(r.w).length && !r.geenMax).map(r => r.code);
  const klaar = new Set(klaarRij), alle = ind.per[R.id].filter(c => !klaar.has(c)), codes = alle.filter(c => !uit.has(c));
  const rijen = regelPlan(R, alle, b), rij = Object.fromEntries(rijen.map(r => [r.code, r])), mee = rijen.filter(r => !uit.has(r.code));
  const nW = mee.reduce((s, r) => s + Object.keys(r.w).length, 0), nP = mee.filter(r => Object.keys(r.w).length).length;
  const nOver = mee.reduce((s, r) => s + Object.keys(r.over).length, 0), nGeen = mee.filter(r => r.geenMax).length;
  const lab = labels(alle.length ? alle : ['']);
  const cel = (r, k) => {
    if(r.w[k] !== undefined) return r.over[k] !== undefined ? `<td class="over">${esc(toonWaarde(r.code, k, r.over[k]))} → ${esc(toonWaarde(r.code, k, r.w[k]))}</td>` : `<td class="nieuw">${esc(toonWaarde(r.code, k, r.w[k]))}</td>`;
    if(r.vast[k] !== undefined) return `<td class="blijft">${esc(toonWaarde(r.code, k, r.vast[k]))} <span title="Zelf ingevuld, blijft staan">🔒</span></td>`;
    const st = staat(r.code, k); return `<td class="blijft">${st.s === 'ok' ? esc(toonWaarde(r.code, k, st.v)) : '–'}</td>`;
  };
  const invoerKop = R.invoer === 'rol' ? '<th>Rollengte (m)</th>' : R.invoer === 'past' ? '<th>Past op pick</th>' : '';
  const invoerCel = c => {
    if(!R.invoer) return '';
    const v = b.in[c] ?? '', ph = R.invoer === 'rol' ? ((rolLengte(c) || {}).v ?? '') : '';
    return `<td><span class="pd-inv klein"><input id="pdr-in-${idVan(c)}" data-pdr="in" data-code="${esc(c)}" value="${esc(v)}" placeholder="${esc(String(ph))}" inputmode="decimal" autocomplete="off" aria-label="${R.invoer === 'rol' ? 'Rollengte' : 'Past op pick'} ${esc(c)}"></span></td>`;
  };
  app.innerHTML = kop + `
  <section class="pd-sec"><div class="pd-sec-kop"><div style="min-width:0"><h3>${esc(R.t)}</h3><div class="small mt4">${esc(R.u)}</div>
      <div class="small muted mt4">${klaar.size ? plural(klaar.size, 'product staat', 'producten staan') + ' al volgens de regel · ' : ''}${alle.length ? plural(alle.length, 'product', 'producten') + ' nog te doen, ' + codes.length + ' aangevinkt' : 'alles staat volgens de regel'}${ind.zonderPick[R.id] ? ' · ' + nf(ind.zonderPick[R.id]) + ' zonder picklocatie (niet meegenomen)' : ''}</div></div>
    <div class="row wrap"><button class="btn sm" data-pd="regelalles" data-v="1">Alles aan</button><button class="btn sm" data-pd="regelalles" data-v="0">Alles uit</button>${alle.length ? `<button class="btn sm" data-pd="regelsamen">Deze ${alle.length} zelf invullen →</button>` : ''}</div></div>
    ${nGeen ? `<div class="small" style="padding:10px 16px;background:#fff8dc;border-bottom:1px solid #eef1f4"><b>${nGeen} zonder ${R.invoer === 'rol' ? 'bekende rollengte' : 'bekende stuks per pallet'}.</b> Die krijgen aanvullen bij en aanvullen met, max op pick nog niet. ${R.invoer === 'rol' ? 'Vul de rollengte in de kolom in.' : 'Vul eerst stuks per pallet in (Samen invullen) en kom hier terug.'}</div>` : ''}
    ${alle.length ? `<div class="pd-tab"><table class="pd-t"><thead><tr><th></th><th>Product</th><th>Per pallet</th><th>Picklocatie</th>${invoerKop}<th>Picklocatie ja</th><th>Aanvullen bij</th><th>Aanvullen met</th><th>Max op pick</th></tr></thead><tbody>
    ${alle.map(c => { const on = !uit.has(c), r = rij[c], sp = sppVoor(c), pl = locaties(c).pick.slice(0, 2).map(a => a[0]).join(', ');
      const prod = `<td><b>${esc(lab[c].kort.slice(0, 50))}</b>${lab[c].fam ? `<div class="tiny muted">${esc(lab[c].fam)}</div>` : ''}<div class="code" style="font-size:11.5px;font-weight:600"><a href="#/productdata/p/${encodeURIComponent(c)}">${esc(c)}</a> ${abcBadge(c)}</div></td>`;
      if(!on) return `<tr style="opacity:.5"><td><input type="checkbox" data-pdr="inc" data-code="${esc(c)}" aria-label="Meenemen ${esc(c)}"></td>${prod}<td colspan="${6 + (R.invoer ? 1 : 0)}" class="blijft">niet meegenomen</td></tr>`;
      return `<tr><td><input type="checkbox" data-pdr="inc" data-code="${esc(c)}" checked aria-label="Meenemen ${esc(c)}"></td>${prod}
        <td>${sp.v ? esc(toonWaarde(c, 'spp', sp.v)) + (sp.bron === 'voorstel' ? ' <span class="muted">(voorstel)</span>' : '') : `<span class="pd-c c-dub">${esc(sp.bron || 'onbekend')}</span>`}</td><td class="code">${esc(pl)}</td>${invoerCel(c)}${cel(r, 'pick')}${cel(r, 'lvl')}${cel(r, 'met')}${r.geenMax && r.w.maxpick === undefined ? `<td class="dub">${R.invoer === 'rol' ? 'rollengte nodig' : 'stuks per pallet nodig'}</td>` : cel(r, 'maxpick')}</tr>`; }).join('')}
    </tbody></table></div>` : '<div class="empty">Niets meer te doen voor deze regel.</div>'}</section>
  <div class="pd-voet"><div class="grow"><b>${nW ? nW + ' waarden voor ' + plural(nP, 'product', 'producten') : 'Niets te bewaren'}</b><div class="small muted">${nOver ? nOver + ' waarden worden overschreven (oranje). ' : ''}Wordt bewaard in productdata, met bron "regel: ${esc(R.t.toLowerCase())}".</div></div>
    <div class="row wrap"><button class="btn acc" data-pd="regelsave" ${nW ? '' : 'disabled'}>Regel toepassen op ${plural(nP, 'product', 'producten')}</button></div></div>`;
}
async function bewaarRegel(){
  const b = regelSt(), R = REGELS.find(R => R.id === b.r), uit = b.uit[R.id] = b.uit[R.id] || new Set();
  const codes = regelIndeling().per[R.id].filter(c => !uit.has(c)), rijen = regelPlan(R, codes, b);
  const wijz = {}; rijen.forEach(r => { if(Object.keys(r.w).length) wijz[r.code] = Object.fromEntries(Object.entries(r.w).map(([k, v]) => [k, { v, uit:'regel ' + R.t.toLowerCase() + (r.d.uitleg ? ' (' + r.d.uitleg + ')' : ''), r:'regel:' + R.id }])); });
  const nW = Object.values(wijz).reduce((s, w) => s + Object.keys(w).length, 0);
  const n = await opslaan(wijz, 'regel');
  b.uit[R.id] = new Set(regelIndeling().per[R.id]);   // wat overblijft staat uit; wat klaar is verdwijnt
  return { n, nW };
}
// tegels in CE: wat regelmatig gepickt wordt maar geen picklocatie heeft, of wel een picklocatie maar geen aanvuladvies
function tegelOverzicht(){
  return Object.keys(D.P).filter(c => {
    if(!actief(c) || isMidden(c) || isOutlet(c)) return false;
    const p = D.P[c], tags = String(p.tags || '').toLowerCase();
    if(/kunststof pen|\bpin\b|pen voor|pennen/i.test(p.naam || '')) return false;
    const tegel = /tile5050|tile50100/.test(tags) || String(p.locaties_hm || '').split(',').some(l => /^\s*CE/i.test(l)) || /rubber tegel|puzzeltegel|vloertegel/i.test(p.naam || '');
    if(!tegel || eenheid(c).e !== 'st') return false;
    if(!(pdVan(c) > 0 || vkmVan(c) > 0)) return false;
    const pick = locaties(c).pick.length > 0, pq = D.PQ[c] || [], heeftAdvies = num(pq[0]) > 1 || num(pq[1]) > 1 || staat(c, 'lvl').s === 'ok';
    return !pick || !heeftAdvies;
  }).sort((a, b) => pdVan(b) - pdVan(a));
}
function tegelBlok(){
  const l = tegelOverzicht(), zonder = l.filter(c => !locaties(c).pick.length), geenAdv = l.filter(c => locaties(c).pick.length);
  const tab = (titel, cs) => `<section class="pd-sec"><div class="pd-sec-kop"><h3>${esc(titel)} · ${cs.length}</h3></div>${cs.length ? `<div class="pd-tab"><table class="pd-t"><thead><tr><th>Product</th><th>ABC</th><th>Per dag</th><th>Verkoop/mnd</th><th>Locaties</th><th>Picqer aanvul</th><th>Voorraad</th></tr></thead><tbody>
    ${cs.map(c => { const pq = D.PQ[c] || [], p = D.P[c]; return `<tr><td><a class="code" href="#/productdata/p/${encodeURIComponent(c)}">${esc(c)}</a><div class="tiny muted">${esc(naamVan(c).slice(0, 60))}</div></td><td>${abcBadge(c) || '–'}</td><td>${nf(pdVan(c), 1)}</td><td>${nf(vkmVan(c))}</td><td class="code" style="white-space:normal">${esc(String(p.locaties_hm || '–'))}</td><td>${pq.length ? 'bij ' + nf(num(pq[0]) || 0) + ' · tot ' + nf(num(pq[1]) || 0) : '–'}</td><td>${nf(num(p.voorraad_hm) || 0)}</td></tr>`; }).join('')}
    </tbody></table></div>` : '<div class="empty">Geen.</div>'}</section>`;
  return `<section class="pd-sec"><div class="pd-kopsec"><h3>Tegels: alleen een overzicht</h3><div class="small muted">Tegels die regelmatig gepickt worden (verkoop of picks per dag), zonder Midden. Hier wordt niets ingesteld.</div></div></section>`
    + tab('Gepickt, maar geen picklocatie', zonder) + tab('Wel picklocatie, maar geen aanvuladvies', geenAdv);
}

/* ---------- automatisch invullen: alles wat zeker genoeg is, in één keer ----------
   Per product en veld: alleen als het veld nog leeg is (jouw invoer en wat al vastlag blijven staan),
   niet dubbel in palletlabels, en de regel klopte bij minstens 75% van de bekende waarden.
   Bron = "auto", met per waarde waar hij vandaan komt. Terugdraaien haalt alleen deze waarden weg. */
const AUTO_VOLG = ['spp', 'pick', 'maat', 'hoogte', 'gewicht', 'plaatsen', 'maxlig', 'spd', 'doos', 'opm', 'vn', 'lvl', 'met', 'maxpick', 'met', 'maxpick'];
function autoPlan(codes){
  const rijen = [], tel = {};
  VOLG.forEach(k => tel[k] = { al:0, nieuw:0, schat:0, dub:0, geen:0, nvt:0, regels:{} });
  codes.forEach(code => {
    const nieuw = {}, basis = waardeFn(code);
    const w = k => nieuw[k] ? nieuw[k].v : basis(k);
    for(const k of AUTO_VOLG){
      if(nieuw[k]) continue;
      const st = staat(code, k);
      if(st.s === 'ok' || st.conflict || !nodig(code, k, w)) continue;
      const vs = voorstel(code, k, w);
      if(!vs || leeg(vs.v) || vs.p == null || vs.p < ZEKER) continue;
      let v = null; try{ v = check(k, vs.v); }catch(e){}
      if(v) nieuw[k] = { v, uit:vs.bron, r:vs.r };
    }
    VOLG.forEach(k => {
      if(k === 'kgst') return;
      const t = tel[k];
      if(!nodig(code, k, w)){ t.nvt++; return; }
      const st = staat(code, k);
      if(st.s === 'ok') t.al++;
      else if(nieuw[k]){ t.nieuw++; t.regels[nieuw[k].r] = (t.regels[nieuw[k].r] || 0) + 1; }
      else if(st.conflict) t.dub++;
      else { const vs = voorstel(code, k, w); if(vs && !leeg(vs.v)) t.schat++; else t.geen++; }
    });
    if(Object.keys(nieuw).length) rijen.push({ code, nieuw });
  });
  return { rijen, tel };
}
const REGELNAAM = { 'maxpick:picqer':'Picqer-instelling', 'lvl:picqer':'Picqer-instelling', 'hoogte:genoot':'kleurgenoot', 'vn:genoot':'naam kleurgenoot', 'spp:mvvst':'verplaatst naar VST', 'spp:vst2':'VST-pallets', 'spp:bulk2':'bulkpallets', oud:'palletlabels / containers', 'pick:picqer':'Picqer-locatie', 'maxpick:aanvulbase':'aanvulbase', 'lvl:aanvulbase':'aanvulbase', 'maxpick:som':'bij + volle pallet', 'met:som':'uit bij en max', 'met:geenpallet':'komt niet op pallet', 'maat:afm':'Picqer-afmetingen', 'hoogte:fam':'familie', 'gewicht:pakbon':'pakbon', 'gewicht:picqer':'Picqer-gewicht', 'plaatsen:maat':'uit palletmaat', 'maxlig:fam':'familie' };
const regelNaam = r => REGELNAAM[r] || (/:genoot$/.test(r) ? 'kleurgenoot' : r);
function viewAuto(){
  const sc = UI.autoScope || 'belangrijk', codes = lijst(sc, false);
  const { rijen, tel } = autoPlan(codes);
  const nW = rijen.reduce((s, r) => s + Object.keys(r.nieuw).length, 0);
  const nAuto = Object.values(S.pd).reduce((s, r) => s + Object.values(r.meta || {}).filter(m => m && m.bron === 'auto').length, 0);
  const rij = k => { const t = tel[k], nodigN = t.al + t.nieuw + t.schat + t.dub + t.geen, na = nodigN ? Math.round(100 * (t.al + t.nieuw) / nodigN) : 100;
    return `<tr><td><b>${esc(VELDEN[k].t)}</b><div class="tiny muted">laag ${VELDEN[k].laag}</div></td><td>${nf(t.al)}</td><td class="${t.nieuw ? 'nieuw' : 'blijft'}">${t.nieuw ? '+' + nf(t.nieuw) : '–'}${t.nieuw ? `<div class="tiny muted">${Object.entries(t.regels).sort((a, b) => b[1] - a[1]).map(([r, n]) => esc(regelNaam(r)) + ' ' + n).join(' · ')}</div>` : ''}</td><td>${t.schat ? nf(t.schat) : '–'}</td><td>${t.dub ? nf(t.dub) : '–'}</td><td>${t.geen ? nf(t.geen) : '–'}</td><td><b>${na}%</b></td></tr>`; };
  app.innerHTML = `<a class="small" href="#/productdata">← Productdata</a>
  <section class="pd-sec mt8"><div class="pd-kopsec"><h2 style="font-size:20px">Automatisch invullen uit alle bronnen</h2>
    <div class="small muted">Per product en per veld naast elkaar gelegd: palletlabels, containers en pakbonnen, VST-voorraad per pallet, bulkvoorraad per locatie, verplaatsingen in Picqer, Picqer-locaties, -gewicht en -afmetingen, aanvulbase, Picqer-aanvulniveaus en kleurgenoten. Elke regel is getoetst tegen wat al vastlag. Alleen regels die bij minstens ${Math.round(ZEKER * 100)}% klopten vullen automatisch. Wat jij hebt ingevuld en wat dubbel staat in palletlabels blijft staan.</div>
    <div class="mt4">${SCOPES.map(([k, t]) => `<button class="pd-chip ${sc === k ? 'on' : ''}" data-pd="autoscope" data-v="${k}" style="margin:0 6px 6px 0">${esc(t)}<span class="n">${nf(lijst(k, false).length)}</span></button>`).join('')}</div>
  </div></section>
  <section class="pd-sec"><div class="pd-sec-kop"><div style="min-width:0"><h3>${plural(codes.length, 'product', 'producten')} · ${nW ? nf(nW) + ' waarden kunnen er automatisch bij, bij ' + plural(rijen.length, 'product', 'producten') : 'niets meer automatisch in te vullen'}</h3>
      <div class="small muted mt4">Schatting = er is een aanwijzing, maar die klopte te vaak niet: zie de productkaart, knop Gebruik. Geen bron = nergens te vinden, dat weet alleen de vloer.</div></div></div>
    <div class="pd-tab"><table class="pd-t"><thead><tr><th>Veld</th><th>Al ingevuld</th><th>Nu automatisch</th><th>Alleen schatting</th><th>Dubbel, kies</th><th>Geen bron</th><th>Daarna gevuld</th></tr></thead><tbody>
      ${VOLG.filter(k => k !== 'kgst').map(rij).join('')}
    </tbody></table></div></section>
  ${rijen.length ? `<section class="pd-sec"><div class="pd-sec-kop"><h3>Voorbeeld: eerste ${Math.min(25, rijen.length)} producten</h3></div><div class="pd-tab"><table class="pd-t"><thead><tr><th>Product</th><th>Wat erbij komt</th></tr></thead><tbody>
    ${rijen.slice(0, 25).map(r => `<tr><td><a class="code" href="#/productdata/p/${encodeURIComponent(r.code)}">${esc(r.code)}</a> ${abcBadge(r.code)}<div class="tiny muted">${esc(String((D.P[r.code] || {}).naam || '').slice(0, 50))}</div></td><td style="white-space:normal">${Object.entries(r.nieuw).map(([k, x]) => `<span title="${esc(x.uit)}"><b>${esc(VELDEN[k].t)}</b> ${esc(toonWaarde(r.code, k, x.v))} <span class="muted">(${esc(regelNaam(x.r))})</span></span>`).join(' · ')}</td></tr>`).join('')}
  </tbody></table></div></section>` : ''}
  <div class="pd-voet"><div class="grow"><b>${nW ? nf(nW) + ' waarden voor ' + plural(rijen.length, 'product', 'producten') : 'Alles wat zeker is, staat er al in'}</b><div class="small muted">Bron per waarde zie je op de productkaart (groen label Automatisch). ${nAuto ? nf(nAuto) + ' waarden staan er nu automatisch in.' : ''}</div></div>
    <div class="row wrap">${nAuto ? `<button class="btn" data-pd="autoweg">Automatische waarden weghalen</button>` : ''}<button class="btn acc" data-pd="autosave" ${nW ? '' : 'disabled'}>Vul ${nf(nW)} waarden in</button></div></div>`;
}
async function bewaarAuto(){
  const { rijen } = autoPlan(lijst(UI.autoScope || 'belangrijk', false));
  const wijz = {}; rijen.forEach(r => { wijz[r.code] = r.nieuw; });
  const n = await opslaan(wijz, 'auto');
  return { n, nW:rijen.reduce((s, r) => s + Object.keys(r.nieuw).length, 0) };
}
async function autoWeg(){
  const wijz = {};
  Object.entries(S.pd).forEach(([code, r]) => Object.entries(r.meta || {}).forEach(([k, m]) => { if(m && m.bron === 'auto') (wijz[code] = wijz[code] || {})[k] = ''; }));
  return opslaan(wijz, 'auto');
}

/* ---------- scherm: één voor één ---------- */
function rij1(){ return zoekFilter(lijst()).filter(c => open(c, UI.laag).length && !UI.over.has(c)); }
function viewEen(){
  const r = rij1();
  if(UI.i >= r.length) UI.i = Math.max(0, r.length - 1);
  const code = r[UI.i];
  const kop = `<div class="row between wrap"><a class="small" href="#/productdata">← Productdata</a><span class="small muted">${r.length ? (UI.i + 1) + ' / ' + nf(r.length) + ' met open velden in ' + esc(LAGEN[UI.laag - 1].t) : ''}</span></div>
    <div class="card mt8">${laagTabs(zoekFilter(lijst()))}<div class="mt8">${scopeChips()}</div></div>`;
  if(!code){ app.innerHTML = kop + `<div class="card empty">Alles in ${esc(LAGEN[UI.laag - 1].t)} is ingevuld voor deze selectie.${UI.laag < 4 ? `<div class="mt12"><button class="btn pri" data-pd="laag" data-v="${UI.laag + 1}">Door naar ${esc(LAGEN[UI.laag].t)}</button></div>` : ''}</div>`; return; }
  app.innerHTML = kop + productKaart(code, true);
}
function viewProduct(code){
  code = D.PLOW[String(code || '').toLowerCase()] || code;
  if(!D.P[code]){ app.innerHTML = `<a class="small" href="#/productdata">← Productdata</a><div class="card empty mt8">Product ${esc(code)} staat niet in de Picqer-import.</div>`; return; }
  app.innerHTML = `<a class="small" href="javascript:history.back()">← terug</a><div class="mt8">${productKaart(code, false)}</div>`;
}

/* ---------- opslaan vanaf de kaart ---------- */
async function bewaarProduct(code, alle, ks){
  const plan = kaartPlan(code, alle, ks);
  const eigen = plan.wijz[code] ? { [code]:plan.wijz[code] } : null;
  const rest = Object.fromEntries(Object.entries(plan.wijz).filter(([c]) => c !== code));
  if(eigen) await opslaan(eigen, 'invul');
  if(Object.keys(rest).length) await opslaan(rest, 'kleuren');
  delete UI.concept[code]; delete UI.anders[code + '|maat']; bewaarConcept();
  return { n:eigen ? Object.keys(eigen[code]).length : 0, nAnder:Object.keys(rest).length };
}

/* ---------- gebeurtenissen ---------- */
let busy = false, knopOmlaag = false;
// een klik op een knop begint met pointerdown en daarna verlaat je het invulveld (change). Dan niet opnieuw tekenen,
// anders verdwijnt de knop onder je vinger. De knop zelf tekent na de klik opnieuw.
app.addEventListener('pointerdown', ev => { knopOmlaag = !!(ev.target.closest && ev.target.closest('button, a')); }, true);
document.addEventListener('pointerup', () => { knopOmlaag = false; }, true);
document.addEventListener('pointercancel', () => { knopOmlaag = false; }, true);
app.addEventListener('click', async ev => {
  const s = ev.target.closest('button[data-pds]');
  if(s && app.contains(s)){ samenKlik(s); return; }
  const b = ev.target.closest('[data-pd],[data-pdv]'); if(!b || !app.contains(b)) return;
  if(b.dataset.pdv !== undefined && b.dataset.pdc){   // keuzeknop op de kaart
    const cw = b.dataset.pdc, k = b.dataset.pdk, v = b.dataset.pdv;
    if(v === '__anders'){ UI.anders[cw + '|' + k] = true; rerender(); setTimeout(() => { const n = $('pd-' + idVan(cw) + '-' + k); if(n) n.focus(); }, 0); return; }
    delete UI.anders[cw + '|' + k];
    (UI.concept[cw] = UI.concept[cw] || {})[k] = v; bewaarConcept(); rerender(); return;
  }
  const a = b.dataset.pd;
  if(a === 'sel' || a === 'zoek' || a === 'lev') return;   // via change / input
  if(a === 'scope'){ UI.scope = b.dataset.v; bewaar('scope2', UI.scope); UI.i = 0; UI.kiesN = 40; rerender(); return; }
  if(a === 'laag'){ UI.laag = +b.dataset.v; bewaar('laag', UI.laag); UI.i = 0; rerender(); return; }
  if(a === 'over'){ UI.over.add(rij1()[UI.i]); rerender(); window.scrollTo(0, 0); return; }
  if(a === 'terug'){ UI.i = Math.max(0, UI.i - 1); rerender(); window.scrollTo(0, 0); return; }
  if(a === 'naarlaag'){ UI.laag = +b.dataset.v; bewaar('laag', UI.laag); UI.scope = 'belangrijk'; bewaar('scope2', UI.scope); UI.i = 0; location.hash = '#/productdata/kies'; return; }
  if(a === 'neem'){ (UI.concept[b.dataset.code] = UI.concept[b.dataset.code] || {})[b.dataset.k] = b.dataset.v; bewaarConcept(); rerender(); return; }
  if(a === 'selfam'){ const leden = famZichtbaar(b.dataset.fk), alle = leden.every(c => UI.sel.has(c)); leden.forEach(c => alle ? UI.sel.delete(c) : UI.sel.add(c)); bewaarSel(); rerender(); return; }
  if(a === 'selniets'){ UI.sel.clear(); bewaarSel(); rerender(); return; }
  if(a === 'samen'){ location.hash = '#/productdata/samen'; return; }
  if(a === 'samenkleur'){ const c = b.dataset.code; UI.sel = new Set([c].concat(genotenActief(c))); bewaarSel(); UI.samen = null; location.hash = '#/productdata/samen'; return; }
  if(a === 'samenstop'){ UI.samen = null; bewaarSamen(); location.hash = '#/productdata/kies'; return; }
  if(a === 'regel'){ regelSt().r = b.dataset.v; rerender(); window.scrollTo(0, 0); return; }
  if(a === 'regelalles'){ const bs = regelSt(); bs.uit[bs.r] = b.dataset.v === '1' ? new Set() : new Set(regelIndeling().per[bs.r] || []); rerender(); return; }
  if(a === 'regelsamen'){ const bs = regelSt(), R = REGELS.find(R => R.id === bs.r); const kl = new Set(regelPlan(R, regelIndeling().per[R.id], Object.assign({}, bs, { hand:false })).filter(r => !Object.keys(r.w).length && !r.geenMax).map(r => r.code)); UI.sel = new Set(regelIndeling().per[R.id].filter(c => !kl.has(c))); bewaarSel(); UI.samen = null; location.hash = '#/productdata/samen'; return; }
  if(a === 'autoscope'){ UI.autoScope = b.dataset.v; rerender(); return; }
  if(a === 'meer'){ UI.kiesN = (UI.kiesN || 40) + 40; rerender(); return; }
  if(busy) return;
  busy = true; b.disabled = true;
  try{
    if(a === 'save'){
      const code = b.dataset.code, ks = b.dataset.ks ? b.dataset.ks.split(',') : null;
      const r = await bewaarProduct(code, !!b.dataset.alle, ks);
      toast(r.n || r.nAnder ? code + ': ' + plural(r.n, 'waarde', 'waarden') + ' vastgelegd' + (r.nAnder ? ' + ' + plural(r.nAnder, 'kleurgenoot', 'kleurgenoten') : '') : code + ': niets veranderd');
      if(/\/een/.test(location.hash)){ const nog = open(code, UI.laag).length; if(nog) toast(code + ': nog ' + plural(nog, 'veld', 'velden') + ' open in ' + LAGEN[UI.laag - 1].t + '. Vul in of kies Overslaan.', 4500); }
      rerender(); if(/\/een/.test(location.hash)) window.scrollTo(0, 0);
    }
    if(a === 'samensave'){ b.textContent = 'Bezig…'; const r = await bewaarSamenNu(); toast(plural(r.nW, 'waarde', 'waarden') + ' opgeslagen voor ' + plural(r.n, 'product', 'producten'), 4000); location.hash = '#/productdata/kies'; }
    if(a === 'regelsave'){ b.textContent = 'Bezig…'; const r = await bewaarRegel(); toast(plural(r.nW, 'waarde', 'waarden') + ' opgeslagen voor ' + plural(r.n, 'product', 'producten'), 4000); rerender(); }
    if(a === 'autosave'){ b.textContent = 'Bezig…'; const r = await bewaarAuto(); toast(plural(r.nW, 'waarde', 'waarden') + ' automatisch ingevuld bij ' + plural(r.n, 'product', 'producten'), 5000); rerender(); }
    if(a === 'autoweg'){ b.textContent = 'Bezig…'; const n = await autoWeg(); toast('Automatische waarden weggehaald bij ' + plural(n, 'product', 'producten'), 5000); rerender(); }
    if(a === 'trek'){ await trekSteekproef(); rerender(); }
    if(a === 'steek'){ await steekUitslag(b.dataset.code, b.dataset.v); rerender(); }
    if(a === 'mig'){ b.textContent = 'Bezig…'; const m = await overzetten(); toast(plural(m.n, 'product', 'producten') + ' overgezet'); rerender(); }
  }catch(e){ toast(e.message, 6000); }
  finally{ busy = false; if(document.body.contains(b)) b.disabled = false; }
});
app.addEventListener('input', ev => {
  const el = ev.target; if(!el.dataset) return;
  if(el.dataset.pdr === 'in'){ const bs = regelSt(); bs.in[el.dataset.code] = el.value; bewaar('regelin', JSON.stringify(bs.in)); return; }
  if(el.dataset.pdc){ (UI.concept[el.dataset.pdc] = UI.concept[el.dataset.pdc] || {})[el.dataset.pdk] = el.value; el.classList.remove('voor'); bewaarConcept(); return; }
  if(el.dataset.pds && el.type !== 'checkbox'){ samenInvoer(el); return; }
  if(el.dataset.pd === 'zoek'){ UI.zoek = el.value; UI.i = 0; clearTimeout(UI.t); UI.t = setTimeout(() => rerender(), 300); }
});
app.addEventListener('change', ev => {
  const el = ev.target; if(!el.dataset) return;
  if(el.dataset.pd === 'lev'){ UI.lev = el.value; bewaar('lev', UI.lev); UI.i = 0; rerender(); return; }
  if(el.dataset.pdr && el.dataset.pdr !== 'in'){ const bs = regelSt(); if(el.dataset.pdr === 'hand') bs.hand = el.checked; if(el.dataset.pdr === 'inc'){ const u = bs.uit[bs.r] = bs.uit[bs.r] || new Set(); if(el.checked) u.delete(el.dataset.code); else u.add(el.dataset.code); } clearTimeout(UI.rt); UI.rt = setTimeout(rerender, 0); return; }
  if(el.dataset.pd === 'sel'){ const c = el.dataset.code; if(el.checked) UI.sel.add(c); else UI.sel.delete(c); bewaarSel(); rerender(); return; }
  if(el.dataset.pds === 'aan'){ if(UI.samen){ UI.samen.aan[el.dataset.k] = el.checked; bewaarSamen(); } rerender(); return; }
  if(el.dataset.pds === 'perProduct'){ if(UI.samen){ UI.samen.perProduct = el.checked; bewaarSamen(); } rerender(); return; }
  // status, voorstellen en tabel bijwerken, pas als de cursor in het volgende veld staat (Tab of klik), zodat die focus blijft
  if((el.dataset.pdc || el.dataset.pds || el.dataset.pdr === 'in') && !knopOmlaag){ clearTimeout(UI.rt); UI.rt = setTimeout(() => { if(!knopOmlaag) rerender(); }, 0); }
});
app.addEventListener('keydown', ev => {
  if(ev.key !== 'Enter' || !ev.target.dataset) return;
  if(ev.target.dataset.pds){ ev.preventDefault(); rerender(); return; }
  if(!ev.target.dataset.pdc) return;
  ev.preventDefault();
  const knop = document.querySelector('.pd-voet [data-pd="save"]:not([disabled]), [data-pd="save"]:not([disabled])'); if(knop) knop.click();
});
function rerender(){
  const y = window.scrollY, a = document.activeElement;
  const id = a && a.id && app.contains(a) ? a.id : null;
  let pos = null; try{ if(id && a.selectionStart != null) pos = [a.selectionStart, a.selectionEnd]; }catch(e){}
  view(huidig.delen); window.scrollTo(0, y);
  if(id){ const n = $(id); if(n){ try{ n.focus({ preventScroll:true }); if(pos) n.setSelectionRange(pos[0], pos[1]); }catch(e){} } }
}

/* ---------- ingang ---------- */
const huidig = { delen:[] };
async function view(delen){
  huidig.delen = delen || [];
  stijl();
  if(!S.klaar){ app.innerHTML = '<div class="card empty">Productdata laden…</div>'; await laad(); }
  if(S.fout){ app.innerHTML = `<div class="card"><h2>Productdata laden mislukt</h2><p class="mt8 small">${esc(S.fout.message)}</p></div>`; return; }
  if(location.hash.indexOf('#/productdata') !== 0) return;     // intussen weggeklikt
  const [sub, arg] = huidig.delen;
  if(sub === 'kies' || sub === 'fam') return viewKies();
  if(sub === 'samen') return viewSamen();
  if(sub === 'basis' || sub === 'regels') return viewRegels();
  if(sub === 'auto') return viewAuto();
  if(sub === 'een') return viewEen();
  if(sub === 'p' && arg) return viewProduct(arg);
  if(sub === 'dubbel') return viewDubbel();
  if(sub === 'poort') return viewPoort();
  return viewStart();
}
// na het opnieuw laden van de app (WH.load) ook de index vernieuwen
const herlaad = async () => { S.idx = null; await laad(true); };

return { view, herlaad, S, UI, KANS, toets, autoPlan, voorstel, staat, famNaam, maatSig, index, opslaan, poort, poortCode, open, lijst, inLaag, nodig, waardeFn, kaartPlan, samenPlan, startSamen, selCodes };
})();
