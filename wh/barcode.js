/* =====================================================================
   IVOL Warehouse — kleine barcode per product (scannen in Picqer i.p.v. opzoeken)
   Waarde: eerste barcode uit Picqer (kolom Barcode; bij meerdere de eerste),
   anders de EAN uit het palletlabel-geheugen, anders de productcode zelf (Code128, gemarkeerd).
   EAN-13 / EAN-8 als het een geldige EAN is, anders Code128 met exact dezelfde tekens.
   ===================================================================== */
window.WHB = (function(){
'use strict';
const cache = new Map();
function waarde(code){
  const D = WH.D;
  const p = D.P[code] || {};
  const eerste = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean)[0] || '';
  let v = eerste(p.ean), bron = 'ean';
  if(!v){
    const g = (D.GEH[String(code).trim().toLowerCase()] || []).find(x => x && x.ean);
    if(g){ v = eerste(g.ean); bron = 'geheugen'; }
  }
  if(!v){ v = String(code); bron = 'code'; }
  return { v, bron };
}
function svg(code){
  if(!code) return '';
  if(cache.has(code)) return cache.get(code);
  let out = '';
  if(window.JsBarcode){
    const { v, bron } = waarde(code);
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const opt = { height:30, width:1.4, margin:0, displayValue:true, fontSize:11, textMargin:1, font:'Consolas, monospace', background:'transparent' };
    const fmt = /^\d{13}$/.test(v) ? 'EAN13' : /^\d{8}$/.test(v) ? 'EAN8' : null;
    let ok = false;
    if(fmt) try{ JsBarcode(el, v, Object.assign({ format:fmt, flat:true }, opt)); ok = true; }catch(e){}
    if(!ok) try{ JsBarcode(el, v, Object.assign({ format:'CODE128' }, opt, v.length > 13 ? { width:1 } : {})); ok = true; }catch(e){}   // lange codes smallere streepjes, blijft scanbaar
    if(ok) out = el.outerHTML + (bron === 'code' ? '<div class="bc-noot">geen EAN · productcode</div>' : '');
  }
  cache.set(code, out);
  return out;
}
// als het product opnieuw is ingeladen (andere EAN): cache leeg
function reset(){ cache.clear(); }
return { svg, waarde, reset };
})();
