/* =====================================================================
   IVOL Warehouse Test — gegevens uit de Picqer-testomgeving (8-10-2026)

   Staat de bron bovenin op TEST, dan werkt de app niet met de exports uit
   Supabase (die gaan over het echte magazijn), maar met wat er in de
   Picqer-testomgeving staat: producten, locaties, voorraad per locatie en
   backorders. Precies waar het bouwplan naartoe werkt: gevoed door Picqer
   in plaats van door exports.

   Alleen lezen, en alleen in het geheugen van dit tabblad. Er gaat niets naar
   de database; core.js weigert bij bron TEST elk schrijven behalve rijen die
   zelf op "-test" eindigen. Bij LIVE doet dit bestand helemaal niets.

   Alleen geladen door test.html.
   ===================================================================== */
(function(){
'use strict';
if(window.WH_BRON !== 'test' || !window.WH) return;

const D = WH.D;
const origLoad = WH.load;
let bezig = null;

function melden(t, cls){
  const s = document.getElementById('sync');
  if(s){ s.textContent = t; s.className = 'sync ' + (cls || ''); }
}

async function vraag(deel, extra){
  return await WHLIVE.vraag('basis', Object.assign({ deel }, extra || {}));
}

async function locaties(){
  const r = await vraag('locaties');
  const loc = {};
  (r.rijen || []).forEach(([naam, bulk, tijd, excl]) => {
    loc[naam] = { naam, bulk:!!bulk, tijd:!!tijd, excl:!!excl, parent:'', codes:[] };
  });
  return loc;
}

async function producten(loc){
  const P = {}, PLOW = {}, VR = {};
  const nu = new Date().toISOString();
  let van = 0, klaar = false, ronde = 0;
  while(!klaar && ronde++ < 60){
    const r = await vraag('producten', { van });
    (r.rijen || []).forEach(p => {
      const c = p.code; if(!c) return;
      const locs = p.locaties || [];
      const namen = locs.filter(l => !l.kar).map(l => l.naam);
      P[c] = {
        productcode:c, naam:p.naam || '', leverancier:p.leverancier || '', leverancier_code:p.leverancier_code || '',
        ean:p.ean || '', locaties_hm:namen.join(', '),
        voorraad_hm:p.voorraad_hm || 0, gereserveerd_hm:p.gereserveerd_hm || 0,
        vrij_hm:p.vrij_hm === null || p.vrij_hm === undefined ? null : p.vrij_hm,
        voorraad_vst:p.voorraad_vst || 0, abc:p.abc || '', actief:p.actief ? 1 : 0,
        tags:'', eenheid:'', palletmaat:'', picqer_datum:nu, gewicht_kg:p.gewicht_kg || null,
        picks_per_dag:p.picks_per_dag ?? null
      };
      PLOW[c.toLowerCase()] = c;
      const v = VR[c] = { locs:{}, geen:p.zonder_locatie || 0, cont:{} };
      locs.forEach(l => {
        if(l.kar) v.cont[l.naam] = (v.cont[l.naam] || 0) + (l.aantal || 0);
        else v.locs[l.naam] = (v.locs[l.naam] || 0) + (l.aantal || 0);
        if(loc[l.naam] && loc[l.naam].codes.indexOf(c) < 0) loc[l.naam].codes.push(c);
      });
    });
    klaar = !!r.klaar; van = r.volgende;
    melden('test: ' + Object.keys(P).length + (r.totaal ? ' / ' + r.totaal : '') + ' producten…');
  }
  return { P, PLOW, VR };
}

async function laadTest(){
  if(!window.WHLIVE || !WHLIVE.status().code){
    melden('test: koppelcode nodig', 'err');
    return false;
  }
  melden('test: locaties…');
  const loc = await locaties();
  const { P, PLOW, VR } = await producten(loc);
  melden('test: backorders…');
  const bo = await vraag('backorders');
  const nu = new Date().toISOString();

  // pas hier alles in één keer omzetten: bij een fout blijft de vorige stand staan
  D.LOC = loc; D.LOCDATUM = nu;
  D.P = P; D.PLOW = PLOW;
  D.VR = VR; D.VRDATUM = nu;
  D.BO = (bo.rijen || []).map(b => ({ productcode:b.productcode, aantal:b.aantal, orderid:b.order, geimporteerd_op:b.aangemaakt }));
  // dit komt niet uit Picqer: leeg laten in plaats van de echte cijfers tonen
  D.VK = {}; D.VKM = null; D.BOVORIG = null; D.ADV = null;
  D.VSTLOC = {}; D.VSTLOCVORIG = {}; D.VSTVR = {}; D.PQ = {};
  if(window.WHL) WHL.reset();
  if(window.WHB) WHB.reset();
  melden('test: ' + Object.keys(P).length + ' producten · ' + Object.keys(loc).length + ' locaties', 'ok');
  return true;
}

// WH.load blijft hetzelfde doen (taken, leveringen en de rest komen uit Supabase),
// daarna zetten we producten, locaties, voorraad en backorders uit de testomgeving erbovenop.
WH.load = async function(){
  const ok = await origLoad.apply(this, arguments);
  if(bezig) { await bezig.catch(() => {}); return ok; }
  bezig = laadTest().catch(e => { melden('test: ' + ((e && e.message) || e), 'err'); return false; });
  await bezig; bezig = null;
  return ok;
};
})();
