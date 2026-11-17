/* =====================================================================
   Containerplanning: pakbon lezen zonder rommel (alleen rekenen, geen scherm, geen netwerk)
   - zoekPO            PO-nummers (PO2026-002539, 2026-002539, PO#2026-002539) in tekst
   - herkenLeverancier leverancier uit de kopregels tegen de leverancierslijst (genormaliseerd)
   - schoonOcr         foto-OCR: kop/adres/fax/bank, specificaties en nul-regels worden nooit een productregel
   - leesExcelKoppen   Excel op koptekst (Item NO / Commodity / Model = code, QTY, CTNS, PLT, Gr. Wt., PO NO = po)
   - dubbelParen       "Mogelijk dubbel": zelfde containernummer, zelfde PO, of zelfde leverancier + >= 60% dezelfde producten (minstens 2 gedeelde productcodes: een enkel gedeeld product is geen bewijs)
   - tabelHtml         een Excel-tabblad als HTML-tabel (Bekijken)
   Werkt in de browser (window.CPLEZER) en in node (require).
   ===================================================================== */
(function(root){
'use strict';
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const txt = v => v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
function getal(v){
  if(v == null || v === '') return null;
  if(typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s/g, '').replace(/[,.;:]+$/, '');
  if(!/^[-+]?[\d.,]+$/.test(s)) return null;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if(lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if(lc > -1) s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/* ---------- PO-nummers ---------- */
function poNorm(jaar, nr){ return 'PO' + jaar + '-' + String(nr).padStart(6, '0'); }
function zoekPO(tekst){
  const s = String(tekst == null ? '' : tekst), uit = [];
  const add = x => { if(!uit.includes(x)) uit.push(x); };
  let m;
  const metPo = /\bP[O0]\s*[#:.\-]?\s*(20\d\d)\s*[-–]\s*(\d{4,6})(?!\d)/gi;       // PO2026-002539, PO#2026-002539, PO 2026-2539
  while((m = metPo.exec(s))) add(poNorm(m[1], m[2]));
  const kaal = /(?<![\d-])(20\d\d)\s*[-–]\s*(\d{6})(?!\d)/g;                       // 2026-002539 (zes cijfers, geen datum)
  while((m = kaal.exec(s))) add(poNorm(m[1], m[2]));
  return uit;
}
const poVanCel = v => { const x = zoekPO(txt(v)); return x[0] || null; };

/* ---------- leverancier uit de kopregels ---------- */
const BEDRIJFSWOORD = /\b(co|ltd|limited|company|corp|corporation|inc|gmbh|bv|nv|llc|sa|s a|ltda|sti|ve|sanayi|ticaret|group|imp|exp|import|export|and|the)\b/g;
const GEWOON = new Set(['rubber', 'industry', 'industrial', 'trade', 'trading', 'products', 'product', 'plastic', 'furniture', 'education', 'equipment', 'development', 'international', 'manufacturing', 'technology', 'modern', 'sports', 'sport', 'fitness']);
function levKern(naam){
  return String(naam == null ? '' : naam).toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[.,&]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(BEDRIJFSWOORD, ' ').replace(/\s+/g, ' ').trim();
}
// geeft { naam, kandidaten } ; naam = null als geen of meer dan één leverancier even goed past (nooit de eerste van de lijst)
function herkenLeverancier(kopTekst, lijst){
  const hooi = norm(kopTekst), hits = [];
  (lijst || []).forEach(naam => {
    const kern = levKern(naam), w = kern.split(' ').filter(Boolean);
    if(norm(kern).length < 6) return;                                          // "2x3 S.A." en andere korte namen: nooit blind
    let tier = 0;
    if(hooi.includes(norm(kern))) tier = 3;
    else if(w.length >= 2 && norm(w[0] + w[1]).length >= 9 && hooi.includes(norm(w[0] + w[1]))) tier = 2;
    else if(w.some(x => x.length >= 8 && !GEWOON.has(x) && hooi.includes(x))) tier = 1;
    if(tier) hits.push({ naam, tier, len:norm(kern).length });
  });
  if(!hits.length) return { naam:null, kandidaten:[] };
  const top = Math.max(...hits.map(h => h.tier)), beste = hits.filter(h => h.tier === top);
  const lang = Math.max(...beste.map(h => h.len)), best = beste.filter(h => h.len === lang);
  return { naam:best.length === 1 ? best[0].naam : null, kandidaten:hits.map(h => h.naam) };
}

/* ---------- foto-OCR opschonen ---------- */
const RX_KOP = /\b(fax|tel|telephone|phone|mobile|mob|e-?mail|www|https?|swift|iban|a\/c|address|add\s*:|province|district|zip|post\s?code|contact|attn|beneficiary|signature|consignee|shipper|notify|vessel|voyage)\b|bank\s*(name|:|of|account|co)|\bP\.?\s?R\.?\s?China\b|\bmade\s+in\s+china\b/i;
const RX_SPECWOORD = /^\W*(density|hardness|tensile|elongation|shore|abrasion|tear|temperature|specifications?|compression|resilience|tolerance)\b/i;
const RX_SPECEENHEID = /g\s*\/\s*cm|\bmpa\b|kg\s*\/\s*m3|\bn\s*\/\s*mm|\bshore\s*[ad]\b|\+\s*\/\s*-/i;
function codeGeloofwaardig(code){
  const c = txt(code);
  if(c.length < 3) return false;
  if(/^\+/.test(c) || /^[\d\s().+\-\/:]+$/.test(c) && /[().+:]/.test(c)) return false;   // telefoonnummer
  const letters = (c.match(/[a-z]/gi) || []).length;
  return /\d/.test(c) || /-/.test(c) || letters >= 6;
}
// regels: [{ pakbon_code, omschrijving, totaal, aantal, context }] -> { regels, weg:[{ tekst, reden }] }
function schoonOcr(regels){
  const kept = [], weg = [];
  (regels || []).forEach(r => {
    const code = txt(r.pakbon_code), oms = txt(r.omschrijving), alles = (!code || norm(oms) === norm(code) || (norm(code).length >= 3 && norm(oms).startsWith(norm(code))) ? oms : (code + ' ' + oms)).trim();
    const totaal = getal(r.totaal), aantal = getal(r.aantal);
    const zeg = reden => weg.push({ tekst:alles || '(leeg)', reden });
    if(RX_SPECWOORD.test(alles) || (RX_SPECEENHEID.test(alles) && !codeGeloofwaardig(code))){
      const vorige = kept[kept.length - 1];
      if(vorige){ vorige.omschrijving = (txt(vorige.omschrijving) + ' · ' + alles).trim(); zeg('specificatie (bij de regel erboven gezet)'); }
      else zeg('specificatie');
      return;
    }
    if(RX_KOP.test(alles)){ zeg('kop/adres/fax/tel/bank'); return; }
    if(!(totaal > 0) && !(aantal > 0)){ zeg(totaal === 0 || aantal === 0 ? 'totaal 0' : 'geen aantal'); return; }
    if(totaal === 0){ zeg('totaal 0'); return; }
    if(!txt(code) && !(aantal > 0)){ zeg('geen code en geen aantal'); return; }
    if(!codeGeloofwaardig(code) && (!oms || norm(oms) === norm(code) || oms.length < 12 || !/\d/.test(oms))){ zeg('geen code'); return; }
    kept.push(Object.assign({}, r, { ocr:true }));
  });
  return { regels:kept, weg };
}

/* ---------- Excel op koptekst ---------- */
const ROLLEN = [
  ['po',      n => /^(pono|ponr|ponumber|po|orderno|ordernr|purchaseorder|purchaseorderno|pnr)$/.test(n)],
  ['code',    n => /^(itemno|itemnr|itemnumber|itemcode|commodity|commoditycode|model|modelno|modelnr|articleno|articlecode|articlenumber|artikelnr|artikelnummer|artikelcode|productcode|productno|sku|partno|partnumber|code|ref|reference)$/.test(n)],
  ['oms',     n => /^(description|descriptions|descr|desc|omschrijving|goodsdescription|goods|nameofgoods|productname|itemname|name|product|commodityname|descriptionofgoods)$/.test(n)],
  ['totaal',  n => /^(qty|quantity|qtypcs|qtypc|qtysets?|totalqty|totalquantity|pcs|pc|qtyofpcs|stuks|aantal|quantitypcs|qtyunit)$/.test(n)],
  ['colli',   n => /^(ctns?|ctnsqty|noofctns?|cartons?|noofcartons?|pkgs?|noofpkgs?|packages?|colli|boxes|noofboxes|qtyctns?|ctnqty|nrofctns?)$/.test(n)],
  ['pallets', n => /^(plts?|pltqty|noofplts?|pltsqty|pallets?|palletqty|noofpallets?)$/.test(n)],
  ['bruto',   n => /^(gw|grwt|grweight|grosswt|grossweight|gwkgs?|grwtkgs?|grosswtkgs?|totalgw|gross)$/.test(n)],
  ['netto',   n => /^(nw|netwt|netweight|nwkgs?|netwtkgs?|totalnw|net)$/.test(n)],
  ['cbm',     n => /^(cbm|m3|volume|measurement|meas)$/.test(n)]
];
function rolMap(cellen){
  const m = {};
  cellen.forEach((c, j) => {
    const n = norm(c); if(!n) return;
    for(const [rol, f] of ROLLEN){ if(f(n)){ if(m[rol] === undefined) m[rol] = j; break; } }
  });
  return m;
}
const aantalRollen = m => Object.keys(m).length;
function koptekstRij(rijen, i, dubbel){
  const a = rijen[i] || [], b = dubbel ? (rijen[i + 1] || []) : [], n = Math.max(a.length, b.length), uit = [];
  for(let j = 0; j < n; j++) uit.push([txt(a[j]), txt(b[j])].filter(Boolean).join(' '));
  return uit;
}
function geldigeKop(m){ return m.totaal !== undefined && (m.code !== undefined || m.oms !== undefined) && aantalRollen(m) >= 3; }
const RX_TOTAAL = /^(sub\s*)?total\b|^say\b|^grand\s*total|^total\s*:|^totaal\b/i;
// één tabblad (rijen = array van arrays) -> { regels, totaal_stuks, totaal_eenheden, po, kopRij } of null
function leesTab(rijen){
  let hi = -1, kop = null, kopCellen = null;
  for(let i = 0; i < Math.min(rijen.length, 60) && hi < 0; i++){
    for(const dubbel of [false, true]){
      const cel = koptekstRij(rijen, i, dubbel), m = rolMap(cel);
      if(geldigeKop(m)){ hi = i + (dubbel ? 1 : 0); kop = m; kopCellen = cel; break; }
    }
  }
  if(hi < 0) return null;
  // samengevoegde kop "Commodity" over twee kolommen: eerste = code, tweede = omschrijving
  if(kop.code !== undefined && /^commodity/.test(norm(kopCellen[kop.code])) && kop.oms === undefined && !txt(kopCellen[kop.code + 1])) kop.oms = kop.code + 1;
  const res = { regels:[], totaal_stuks:null, totaal_eenheden:null, po:[], kopRij:hi, kolommen:kop };
  const som = () => res.regels.reduce((a, r) => a + (r.totaal || 0), 0);
  for(let i = hi + 1; i < rijen.length; i++){
    const rij = rijen[i] || [];
    const cellen = rij.map(txt).filter(Boolean);
    if(!cellen.length) continue;
    const eerste = cellen[0];
    if(RX_TOTAAL.test(eerste)){
      if(res.regels.length){
        const q = kop.totaal !== undefined ? getal(rij[kop.totaal]) : null, c = kop.colli !== undefined ? getal(rij[kop.colli]) : null;
        if(q != null) res.totaal_stuks = q;
        if(c != null) res.totaal_eenheden = c;
        break;
      }
      continue;
    }
    const qty = kop.totaal !== undefined ? getal(rij[kop.totaal]) : null;
    let code = kop.code !== undefined ? txt(rij[kop.code]) : '', oms = kop.oms !== undefined ? txt(rij[kop.oms]) : '';
    let po = kop.po !== undefined ? poVanCel(rij[kop.po]) : null;
    if(code && /^(20\d\d)\s*[-–]\s*\d{6}$/.test(code)){ if(!po) po = poVanCel(code); code = ''; }   // een PO-nummer is nooit een productcode
    if(!code && !oms){
      // totaalrij zonder woord "total": QTY · CTNS · PLT · … die precies de som van de regels is
      if(qty != null && qty > 0 && res.regels.length && Math.abs(qty - som()) < 0.5){
        res.totaal_stuks = qty;
        const c = kop.colli !== undefined ? getal(rij[kop.colli]) : null; if(c != null) res.totaal_eenheden = c;
      }
      continue;
    }
    if(qty == null || qty <= 0) continue;                                         // tussenkopjes, lege aantallen
    const regel = { code, oms, totaal:qty, colli:kop.colli !== undefined ? getal(rij[kop.colli]) : null, pallets:kop.pallets !== undefined ? getal(rij[kop.pallets]) : null,
      bruto:kop.bruto !== undefined ? getal(rij[kop.bruto]) : null, netto:kop.netto !== undefined ? getal(rij[kop.netto]) : null, cbm:kop.cbm !== undefined ? getal(rij[kop.cbm]) : null, po, rij:i };
    res.regels.push(regel);
    if(po && !res.po.includes(po)) res.po.push(po);
  }
  return res.regels.length ? res : null;
}
const RX_INVOICE = /invoice|\binv\b|factuur|commercial|^ci$/i, RX_PAKLIJST = /pack|paklijst|\bpl\b|p\.?\s?l\.?$/i;
const sig = r => norm(r.code || r.oms) + ':' + r.totaal;
// sheets = [{ naam, rijen }] -> { gekozen:{ naam, ...leesTab }, genegeerd:[{ naam, reden }], kopTekst, containers, po }
function leesExcelKoppen(sheets){
  const geparsed = [], genegeerd = [];
  (sheets || []).forEach(s => {
    const r = leesTab(s.rijen || []);
    if(r) geparsed.push(Object.assign({ naam:s.naam }, r)); else genegeerd.push({ naam:s.naam, reden:'geen productregels herkend' });
  });
  const prio = p => RX_PAKLIJST.test(p.naam) ? 0 : RX_INVOICE.test(p.naam) ? 2 : 1;
  geparsed.sort((a, b) => prio(a) - prio(b));
  const gekozen = geparsed[0] || null;
  if(gekozen) geparsed.slice(1).forEach(p => {
    const A = new Set(gekozen.regels.map(sig)), B = p.regels.map(sig), gelijk = B.filter(x => A.has(x)).length;
    genegeerd.push({ naam:p.naam, reden:gelijk / Math.max(1, Math.min(A.size, B.length)) >= 0.8 ? 'zelfde regels als tabblad "' + gekozen.naam + '"' + (RX_INVOICE.test(p.naam) ? ' (invoice)' : '') : 'ander tabblad (' + p.regels.length + ' regels), niet meegeteld om dubbel tellen te voorkomen' });
  });
  const kopTekst = (sheets || []).map(s => (s.rijen || []).slice(0, 15).map(r => (r || []).map(txt).filter(Boolean).join(' ')).join(' ')).join(' ');
  const alle = (sheets || []).map(s => (s.rijen || []).map(r => (r || []).map(txt).filter(Boolean).join(' ')).join('\n')).join('\n');
  const conts = [...new Set(alle.match(/\b[A-Z]{3}U\d{7}\b/g) || [])];
  const po = [...new Set([].concat(gekozen ? gekozen.po : [], zoekPO(alle)))];
  return { gekozen, genegeerd, kopTekst, containers:conts, po, tekst:alle };
}

/* ---------- Mogelijk dubbel ---------- */
const codesVan = c => new Set(((c.data && c.data.regels) || []).filter(r => !r.geenVoorraad).map(r => norm(r.productcode || r.pakbon_code)).filter(Boolean));
function posVan(c){
  const s = new Set(), d = c.data || {};
  zoekPO(c.pakbon_ref).forEach(x => s.add(x));
  if(d.po && d.po.nr) zoekPO(d.po.nr).forEach(x => s.add(x));
  (d.po_nrs || []).forEach(x => zoekPO(x).forEach(y => s.add(y)));
  (d.regels || []).forEach(r => { if(r.po) zoekPO(r.po).forEach(y => s.add(y)); });
  return s;
}
function dubbelParen(containers, opt){
  const levK = (opt && opt.levKort) || (l => norm(String(l || '').split(/\s+/).slice(0, 2).join('')));
  const lijst = (containers || []).map(c => ({ c, codes:codesVan(c), po:posVan(c), cn:norm(c.containernummer), lk:levK(c.leverancier) }));
  const uit = [];
  for(let i = 0; i < lijst.length; i++) for(let j = i + 1; j < lijst.length; j++){
    const a = lijst[i], b = lijst[j], redenen = [];
    if(a.cn && b.cn && a.cn !== b.cn) continue;   // ander containernummer = altijd een andere container
    if(a.cn && a.cn === b.cn) redenen.push('zelfde containernummer ' + a.c.containernummer);
    const gpo = [...a.po].filter(x => b.po.has(x));
    if(gpo.length) redenen.push('zelfde PO ' + gpo.join(', '));
    let gedeeld = 0;
    if(a.lk && a.lk === b.lk && a.codes.size && b.codes.size){
      gedeeld = [...a.codes].filter(x => b.codes.has(x)).length;
      const klein = Math.min(a.codes.size, b.codes.size);
      if(gedeeld >= 2 && gedeeld / klein >= 0.6) redenen.push('zelfde leverancier en ' + gedeeld + ' van ' + klein + ' productcodes gelijk (' + Math.round(gedeeld / klein * 100) + '%)');
    }
    if(redenen.length) uit.push({ a:a.c, b:b.c, redenen, gedeeld });
  }
  return uit;
}
function dubbelPerContainer(paren){
  const m = {};
  (paren || []).forEach(p => { (m[p.a.id] = m[p.a.id] || []).push({ met:p.b, redenen:p.redenen }); (m[p.b.id] = m[p.b.id] || []).push({ met:p.a, redenen:p.redenen }); });
  return m;
}

/* ---------- Excel-tabblad als tabel ---------- */
function tabelHtml(rijen, max){
  max = max || 3000;
  const R = (rijen || []).slice(0, max), breed = R.reduce((a, r) => Math.max(a, (r || []).length), 0);
  if(!R.length) return '<p>Leeg tabblad.</p>';
  const body = R.map((r, i) => '<tr><th class="rn">' + (i + 1) + '</th>' + Array.from({ length:breed }, (_, j) => { const v = (r || [])[j]; return '<td>' + (v == null || v === '' ? '' : esc(v)) + '</td>'; }).join('') + '</tr>').join('');
  return '<table class="xl">' + body + '</table>' + ((rijen || []).length > max ? '<p>… nog ' + ((rijen || []).length - max) + ' rijen, download het bestand voor de rest.</p>' : '');
}

const API = { norm, zoekPO, levKern, herkenLeverancier, codeGeloofwaardig, schoonOcr, rolMap, leesTab, leesExcelKoppen, dubbelParen, dubbelPerContainer, codesVan, posVan, tabelHtml, getal };
if(typeof module !== 'undefined' && module.exports) module.exports = API;
root.CPLEZER = API;
})(typeof window !== 'undefined' ? window : globalThis);
