/* =====================================================================
   IVOL Warehouse Test — DEMO-leveringen (7-10-2026)
   Verzonnen inkooporders en ontvangsten, zodat de hele keten te testen is
   zonder op een echte levering te wachten. Picqer wordt niet gelezen en
   niet geschreven; wat de app in demo onthoudt blijft op dit apparaat.

   De producten zijn wél echt: de app pakt bestaande productcodes uit de
   database, met hun echte voorraad, verkoop en stuks per pallet. Daardoor
   is het advies net zo realistisch als bij een echte levering.
   ===================================================================== */
window.WHDEMO = (function(){
'use strict';
const { D, num, isoDag } = WH;

// vaste volgorde zodat elke keer dezelfde demo verschijnt
function kandidaten(){
  const spp = c => (window.WHL ? WHL.sppVan(c) : null);
  const vk = c => (window.WHL ? WHL.vkVan(c) : null);
  const codes = Object.keys(D.P || {}).filter(c => {
    const p = D.P[c];
    return p && p.actief !== false && spp(c) > 0;
  });
  codes.sort((a, b) => (vk(b) || 0) - (vk(a) || 0) || String(a).localeCompare(b));
  return codes;
}
const dag = n => isoDag(Date.now() + n * 864e5);
const tijd = (n, u) => dag(n) + 'T' + String(u).padStart(2, '0') + ':15:00';

function regel(code, aantalPallets, losExtra){
  const spp = (window.WHL ? WHL.sppVan(code) : 0) || 1;
  const besteld = aantalPallets * spp + (losExtra || 0);
  return { code, naam:(window.WHL ? WHL.naamVan(code) : '') || code, besteld, spp };
}
function keten(sinds){
  const c = kandidaten();
  if(c.length < 6) return { bron:'demo', versie:1, sinds, inkoop:[], ontvangsten:[], leeg:true };
  const p = (i) => c[i % c.length];
  // ---------- de leveringen ----------
  const ORDERS = [
    { id:9001, nummer:'DEMO-PO-1001', leverancier:'Rubber Select B.V.', besteld:-14, verwacht:0, binnen:0, uur:9, wie:'Karin',
      regels:[regel(p(0), 6), regel(p(1), 2), regel(p(2), 1, 40), regel(p(3), 3)],
      ontvangen:{ 0:'compleet', 1:'compleet', 2:'tekort', 3:'compleet' }, extra:p(12) },
    { id:9002, nummer:'DEMO-PO-1002', leverancier:'MFL Europe', besteld:-21, verwacht:-1, binnen:-1, uur:14, wie:'Karin',
      regels:[regel(p(4), 12), regel(p(5), 8), regel(p(6), 2)], ontvangen:{} },
    { id:9003, nummer:'DEMO-PO-1003', leverancier:'Greentyre', besteld:-9, verwacht:0, binnen:0, uur:11, wie:'Sala',
      regels:[regel(p(7), 0, 25), regel(p(8), 0, 60)], ontvangen:{} },
    { id:9004, nummer:'DEMO-PO-1004', leverancier:'Wallace Industrial (container)', besteld:-70, verwacht:0, binnen:0, uur:8, wie:'Karin',
      regels:[regel(p(9), 28), regel(p(10), 16), regel(p(11), 9), regel(p(13), 4)], ontvangen:{} }
  ];
  const VERWACHT = [
    { id:9101, nummer:'DEMO-PO-1101', leverancier:'Rubber Select B.V.', besteld:-5, verwacht:3, regels:[regel(p(0), 4), regel(p(14), 2)] },
    { id:9102, nummer:'DEMO-PO-1102', leverancier:'MFL Europe', besteld:-12, verwacht:10, regels:[regel(p(4), 10), regel(p(15), 6), regel(p(16), 3)] },
    { id:9103, nummer:'DEMO-PO-1103', leverancier:'Shandong Hongli (container)', besteld:-30, verwacht:21, regels:[regel(p(9), 30), regel(p(17), 18), regel(p(18), 12)] }
  ];
  const prijs = code => Math.round(((num((D.P[code] || {}).voorraad_hm) || 50) % 37 + 8) * 100) / 100;
  const inkoop = ORDERS.map(o => ({
    id:o.id, nummer:o.nummer, status:'completed', leverancier:o.leverancier, idleverancier:o.id,
    besteld_op:tijd(o.besteld, 10), verwacht_op:dag(o.verwacht), klaar_op:tijd(o.binnen, o.uur), magazijn:3857,
    opmerking:'Demo-levering', regels:o.regels.map(r => ({ code:r.code, naam:r.naam, besteld:r.besteld, ontvangen:r.besteld, prijs:prijs(r.code) }))
  })).concat(VERWACHT.map(o => ({
    id:o.id, nummer:o.nummer, status:'purchased', leverancier:o.leverancier, idleverancier:o.id,
    besteld_op:tijd(o.besteld, 10), verwacht_op:dag(o.verwacht), klaar_op:null, magazijn:3857,
    opmerking:'Demo-inkooporder', regels:o.regels.map(r => ({ code:r.code, naam:r.naam, besteld:r.besteld, ontvangen:0, prijs:prijs(r.code) }))
  })));
  const ontvangsten = ORDERS.map((o, i) => {
    const prod = o.regels.map(r => ({
      idproduct:null, code:r.code, naam:r.naam,
      aantal: o.ontvangen[o.regels.indexOf(r)] === 'tekort' ? Math.max(1, r.besteld - r.spp) : r.besteld
    }));
    if(o.extra) prod.push({ idproduct:null, code:o.extra, naam:(window.WHL ? WHL.naamVan(o.extra) : '') || o.extra, aantal:(window.WHL ? WHL.sppVan(o.extra) : 10) || 10 });
    return {
      id:9500 + i, nummer:'DEMO-RC-' + (2001 + i), status:'completed',
      inkooporder:o.nummer, idinkooporder:o.id, leverancier:o.leverancier, wie:o.wie,
      aangemaakt:tijd(o.binnen, o.uur - 1), klaar:tijd(o.binnen, o.uur), producten:prod
    };
  });
  return { bron:'demo', versie:1, sinds, opgehaald:new Date().toISOString(), demo:true, inkoop, ontvangsten };
}
return { keten };
})();
