/* =====================================================================
   Palletlabels: gedeelde regels voor tekst en barcode (A4 liggend, 297 mm breed)
   - eanKies      welke barcode hoort bij dit veld: EAN13/EAN8 (alleen met kloppend controlegetal), anders CODE128
   - barcodeMaak  tekent de barcode op een canvas; mislukt EAN, dan CODE128 met de EAN, dan CODE128 met de productcode; nooit een fout naar buiten
   - passTekst    tekst binnen de marge: eerst kleiner tot een leesbaar minimum, dan over 2 regels (nooit afsnijden)
   - tekenNaam    zet de naam (en de productcode) met passTekst op het label
   Werkt in de browser (window.LABELKERN) en in node (require).
   ===================================================================== */
(function(root){
'use strict';
const PT_MM = 25.4 / 72;
// alles wat niet zichtbaar is (spaties, niet-brekende spatie, nul-breedte tekens) weg; getal of tekst maakt niet uit
const schoon = v => String(v == null ? '' : v).normalize('NFKC').replace(/[\s ​-‏⁠﻿]+/g, '');
function controle13(s){ let t = 0; for(let i = 0; i < 12; i++) t += (+s[i]) * (i % 2 ? 3 : 1); return (10 - t % 10) % 10; }
function controle8(s){ let t = 0; for(let i = 0; i < 7; i++) t += (+s[i]) * (i % 2 ? 1 : 3); return (10 - t % 10) % 10; }
const geldig13 = s => /^\d{13}$/.test(s) && controle13(s) === +s[12];
const geldig8 = s => /^\d{8}$/.test(s) && controle8(s) === +s[7];
const code128Kan = s => s.length > 0 && /^[\x20-\x7e]+$/.test(s);
// { waarde, formaat, terugval, reden }: terugval = niet de EAN13/EAN8 die je verwacht
function eanKies(ean, code){
  const ruw = String(ean == null ? '' : ean);
  const stukken = ruw.split(/[,;/|]+/).map(schoon).filter(Boolean);   // "a, b" = twee EAN's: de eerste geldige
  for(const s of stukken){ if(geldig13(s)) return { waarde:s, formaat:'EAN13', terugval:false, reden:'' }; if(geldig8(s)) return { waarde:s, formaat:'EAN8', terugval:false, reden:'' }; }
  const c = schoon(code);
  const eerste = stukken[0] || '';
  if(eerste && code128Kan(eerste)) return { waarde:eerste, formaat:'CODE128', terugval:true, reden:/^\d{8}$|^\d{12,13}$/.test(eerste) ? 'EAN klopt niet (controlegetal)' : 'geen EAN13/EAN8 in Picqer' };
  if(code128Kan(c)) return { waarde:c, formaat:'CODE128', terugval:true, reden:'geen EAN: productcode als barcode' };
  return { waarde:'', formaat:'', terugval:true, reden:'geen barcode mogelijk' };
}
// opt = JsBarcode-opties; geeft { ok, waarde, formaat, terugval, reden }; gooit nooit
function barcodeMaak(JsB, cv, ean, code, opt){
  let k = eanKies(ean, code);
  const probeer = (waarde, formaat) => { try{ JsB(cv, waarde, Object.assign({ format:formaat }, opt)); return true; }catch(e){ return false; } };
  if(k.formaat && probeer(k.waarde, k.formaat)) return Object.assign({ ok:true }, k);
  const c = schoon(code);
  if(k.formaat !== 'CODE128' && k.waarde && code128Kan(k.waarde) && probeer(k.waarde, 'CODE128')) return Object.assign({ ok:true }, k, { formaat:'CODE128', terugval:true, reden:k.reden || 'EAN-barcode mislukt' });
  if(code128Kan(c) && probeer(c, 'CODE128')) return { ok:true, waarde:c, formaat:'CODE128', terugval:true, reden:'productcode als barcode' };
  return { ok:false, waarde:'', formaat:'', terugval:true, reden:'geen barcode mogelijk' };
}
// meet(tekst, pt) = breedte in mm; geeft { pt, regels } met elke regel ≤ breed mm. Eerst één regel van max naar min, daarna twee regels van max naar min,
// daarna blijft de letter krimpen (≥ vloer) tot het past: nooit afsnijden.
function passTekst(meet, tekst, breed, o){
  o = o || {}; const max = o.max || 110, min = o.min || 24, vloer = o.vloer || 10, stap = o.stap || 1;
  tekst = String(tekst == null ? '' : tekst).replace(/\s+/g, ' ').trim();
  const breek = (t, pt, n) => {   // woorden over ≤ n regels; null = past niet
    const w = t.split(' '), r = [''];
    for(const x of w){
      const probe = r[r.length - 1] ? r[r.length - 1] + ' ' + x : x;
      if(meet(probe, pt) <= breed) r[r.length - 1] = probe;
      else if(r[r.length - 1] && r.length < n && meet(x, pt) <= breed) r.push(x);
      else return null;
    }
    return r;
  };
  for(let pt = max; pt >= min; pt -= stap) if(meet(tekst, pt) <= breed) return { pt, regels:[tekst] };
  for(let pt = Math.min(max, 60); pt >= min; pt -= stap){ const r = breek(tekst, pt, 2); if(r) return { pt, regels:r }; }
  for(let pt = min; pt >= vloer; pt -= 1){ const r = breek(tekst, pt, 2); if(r) return { pt, regels:r }; }
  // één woord/code zonder spaties dat zelfs op de vloer niet past: op de vloer laten staan
  return { pt:vloer, regels:[tekst] };
}
// jsPDF-doc: naam (vet) bovenaan, laatste regel op y; productcode eronder (altijd volledig)
function tekenNaam(doc, naam, code, W, o){
  o = o || {}; const marge = o.marge == null ? 14 : o.marge, breed = W - 2 * marge, yNaam = o.yNaam || 48, yCode = o.yCode || 60;
  doc.setFont('helvetica', 'bold');
  const meet = (t, pt) => { doc.setFontSize(pt); return doc.getTextWidth(t); };
  const p = passTekst(meet, naam, breed, { max:o.max || 110, min:o.min || 24 });
  doc.setFontSize(p.pt);
  const lh = p.pt * PT_MM * 1.12;
  p.regels.forEach((t, i) => doc.text(t, W / 2, yNaam - (p.regels.length - 1 - i) * lh, { align:'center' }));
  let c = null;
  if(code){
    doc.setFont('helvetica', 'normal'); doc.setTextColor(57, 67, 79);
    c = passTekst((t, pt) => { doc.setFontSize(pt); return doc.getTextWidth(t); }, code, breed, { max:o.codePt || 18, min:12 });
    doc.setFontSize(c.pt); c.regels.forEach((t, i) => doc.text(t, W / 2, yCode + i * c.pt * PT_MM * 1.2, { align:'center' }));
    doc.setTextColor(16, 21, 28);
  }
  return { naam:p, code:c, yCode };
}
// kort tekstje op het label als er echt geen barcode te maken is (nooit een foutmelding printen)
function geenBarcode(doc, code, W, y){ doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(16, 21, 28); doc.text('GEEN BARCODE – scan op productcode: ' + code, W / 2, y || 105, { align:'center' }); }
// één gele regel voor boven de printknop: voor welke producten de barcode via terugval komt
function terugvalTekst(lijst){   // lijst = [{ code, ean }]
  const seen = new Map();
  lijst.forEach(r => { const k = eanKies(r.ean, r.code); if(k.terugval && !seen.has(r.code)) seen.set(r.code, k.reden); });
  if(!seen.size) return '';
  const codes = [...seen.keys()];
  return 'Barcode van ' + codes.slice(0, 5).join(', ') + (codes.length > 5 ? ' en ' + (codes.length - 5) + ' andere' : '') + ' via terugval gemaakt (CODE128). Karin: kijk de EAN in Picqer na.';
}
const API = { schoon, eanKies, barcodeMaak, passTekst, tekenNaam, geenBarcode, terugvalTekst, geldig13, geldig8 };
if(typeof module !== 'undefined' && module.exports) module.exports = API;
root.LABELKERN = API;
})(typeof window !== 'undefined' ? window : globalThis);
