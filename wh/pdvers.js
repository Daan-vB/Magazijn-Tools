/* =====================================================================
   IVOL Warehouse — inkoop en verplaatsingen houden zichzelf bij (27-10-2026)
   Voor Productdata (Per familie): wat er is ingekocht en wat er tussen locaties is verplaatst komt vanzelf uit Picqer,
   zonder knop. Alleen lezen uit Picqer (functies "picqer" en "picqer-inkoop"); schrijven alleen in onze eigen opslag:
     wh-inkoop          { t, sinds, n, p:{ code:[[datum, besteld, ontvangen, afgerond 1/0, inkooporder-id], ...] } }   12 maanden
     wh-verplaatsingen  { datum, opgehaald, sinds, rows:[[id, tijd, wie, code, aantal, van, naar, magazijn]] }       60 dagen
     wh-pdvers-vp       { tot, op, gat, fouten, wachtTot, fout, lease }   voortgang verplaatsingen
     wh-pdvers-ink      { op, volledig, sinds, n, fouten, wachtTot, fout, lease }   voortgang inkoop
   Inkoop: eenmalig 12 maanden, daarna elke 24 uur de laatste 45 dagen plus orders die nog open stonden.
   Verplaatsingen: GEEN vulling van 60 dagen via Picqer. De historie komt uit wh-vp-hist (Geschiedenis ophalen) en het Mac-script
   (Verplaatsingen ophalen), Productdata leest beide. Hier alleen incrementeel vanaf het laatst bekende moment, in uurvensters:
     - vaste rem: minstens 90 seconden tussen twee vragen aan Picqer
     - voorrang: zolang Vandaag, Aanvullen of de 3.0-ronde bezig is (of 429 meldde) wacht dit bestand
     - bij 429, 504 of een andere fout: stoppen en oplopend wachten (10 min, 20, 40 … max 6 uur), bewaard in de voortgangsrij;
       nooit direct opnieuw in een lus
     - gat van meer dan 1 dag sinds het laatst bekende moment: alleen de laatste 24 uur ophalen en het gat melden onder Bronnen
   Eigen invoer en productdata blijven ongemoeid. De ronde in wh/ivol-live.js roept PDVERS.ronde() aan; waar dat bestand niet
   draait (Warehouse, Test) doet dit bestand dat zelf. Staat de bron op TEST, dan doet dit bestand niets. Geen koppelcode: ook niets.
   ===================================================================== */
window.PDVERS = (function(){
'use strict';
if(!window.WH) return {};
const { D, isoDag } = WH;
const META = { vp:'wh-pdvers-vp', ink:'wh-pdvers-ink' }, INK = 'wh-inkoop';
const INK_DAGEN = 365, INK_BIJ = 45, VP_KEY = 'wh-verplaatsingen', VP_REM = 90e3;
const DAG = 864e5, UUR = 36e5;
const S = { meta:{ vp:{}, ink:{} }, vpBezig:false, inkBezig:false, tekst:{ vp:'', ink:'' }, fout:null, oudeFunctie:false, laatst:0, luister:[], id:Math.random().toString(36).slice(2, 10) };
const wacht = ms => new Promise(r => setTimeout(r, ms));
const ms = t => new Date(String(t || '').replace(' ', 'T')).getTime();
const z2 = n => String(n).padStart(2, '0');
// Picqer-tijd = tijd in Nederland (de browser draait daar ook)
const fmt = t => { const d = new Date(t); return d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate()) + ' ' + z2(d.getHours()) + ':' + z2(d.getMinutes()) + ':' + z2(d.getSeconds()); };
const code = () => { try{ return localStorage.getItem('ivol-koppelcode') || ''; }catch(e){ return ''; } };
const meld = () => S.luister.forEach(f => { try{ f(); }catch(e){ console.error(e); } });
const uit = () => window.WH_BRON === 'test' || !code();

async function vraag(fn, qs){
  const r = await fetch(WH.URL_ + '/functions/v1/' + fn + '?' + qs, { headers:{ apikey:WH.KEY, 'x-ivol-code':code() }, cache:'no-store' });
  const t = await r.text(); let j = null; try{ j = JSON.parse(t); }catch(e){}
  if(!r.ok) throw Object.assign(new Error((j && j.fout) || ('Tussenstation gaf status ' + r.status + (r.status === 404 ? ' (functie ' + fn + ' staat nog niet live)' : ''))), { status:r.status });
  return j;
}

/* ---------- voortgang (eigen catalog-rij, hervatbaar, met een korte claim tegen dubbel werk) ---------- */
// elke taak heeft zijn eigen voortgangsrij: de twee taken lopen tegelijk zonder elkaar te overschrijven
async function laadMeta(naam){
  try{ const r = await WH.catHaal(META[naam]); S.meta[naam] = (r && r.data) || S.meta[naam] || {}; }catch(e){ S.meta[naam] = S.meta[naam] || {}; }
  return S.meta[naam];
}
const bewaarMeta = naam => WH.catZet(META[naam], S.meta[naam]).catch(e => console.warn('pdvers meta:', e.message));
async function claim(naam){
  const m = S.meta[naam], nu = Date.now();
  if(m.lease && m.leaseId !== S.id && nu - ms(m.lease) < 6 * 60e3) return false;   // een ander apparaat is bezig
  m.lease = new Date().toISOString(); m.leaseId = S.id;
  await bewaarMeta(naam);
  return true;
}
// na een fout (429, 504, …): stoppen en oplopend wachten; blijft bewaard, dus ook na opnieuw laden
function wachtOp(naam, e){
  const m = S.meta[naam]; if(!m) return;
  m.fouten = (m.fouten || 0) + 1;
  const wacht = Math.min(6 * UUR, 10 * 60e3 * Math.pow(2, m.fouten - 1));
  m.wachtTot = new Date(Date.now() + wacht).toISOString();
  m.fout = String((e && e.message) || e).slice(0, 200); m.foutOp = new Date().toISOString();
  S.fout = e; console.warn('PDVERS ' + naam + ': wacht tot ' + m.wachtTot + ' (' + m.fout + ')');
}
const moetWachten = m => !!(m && m.wachtTot && Date.now() < ms(m.wachtTot));
const gelukt = m => { m.fouten = 0; delete m.wachtTot; delete m.fout; delete m.foutOp; S.fout = null; };
// voorrang: Vandaag (WHLIVE), Aanvullen (WHAL) en de 3.0-ronde gaan voor; meldde een van die een 429, dan blijven wij 10 minuten weg
function drukBezig(){
  const L = window.WHLIVE && WHLIVE.status && WHLIVE.status();
  if(L && L.laden) return true;
  if(window.WHAL && WHAL.S && WHAL.S.bezig) return true;
  if(window.IVL && IVL.S && IVL.S.bezig) return true;
  const f = (L && L.fout) || (window.WHAL && WHAL.S && WHAL.S.fout) || (window.IVL && IVL.S && IVL.S.fout);
  if(f && /429|rate limit/i.test(String(f.message || f)) && f !== S.limietFout){ S.limietFout = f; S.limietGezien = Date.now(); }
  return !!(S.limietGezien && Date.now() - S.limietGezien < 10 * 60e3);
}
async function wachtVrij(){ for(let i = 0; i < 6; i++){ if(!drukBezig()) return true; await wacht(20000); } return false; }

/* ---------- verplaatsingen: alleen incrementeel, uurvensters, met rem ---------- */
async function verplaatsingen(forceer){
  if(S.vpBezig || uit() || !D.PLOW || !Object.keys(D.PLOW).length) return;
  S.vpBezig = true; meld();
  try{
    const m = await laadMeta('vp'), nu = Date.now();
    if(moetWachten(m)) return;
    if(!forceer && m.op && nu - ms(m.op) < 30 * 60e3) return;      // elk half uur
    if(drukBezig()) return;
    if(!(await claim('vp'))) return;
    // laatst bekende moment: onze eigen voortgang, of de nieuwste verplaatsing in wh-verplaatsingen (ook van het Mac-script)
    const cur = await WH.catHaal(VP_KEY).catch(() => null), rows = (cur && cur.data && cur.data.rows) || [];
    let laatste = 0; rows.forEach(r => { const t = ms(r[1]); if(t > laatste) laatste = t; });
    const bekend = Math.min(nu, Math.max(laatste, m.tot ? ms(m.tot) : 0));
    let van;
    if(!bekend || nu - bekend > DAG){
      van = nu - DAG;                                                // gat van meer dan 1 dag: alleen de laatste 24 uur
      m.gat = { van:bekend ? fmt(bekend) : null, tot:fmt(van), op:new Date().toISOString() };
    }else{
      van = bekend - UUR;                                            // 1 uur overlap: niets gemist, dubbelen worden weggefilterd
      if(m.gat && nu - ms(m.gat.op) > 3 * DAG) delete m.gat;
    }
    let n = 0, vorige = 0;
    while(van < Date.now() - 60e3 && n < 26){
      if(!(await wachtVrij())) return;                               // Warehouse, Vandaag en Aanvullen gaan voor: later verder
      const pauze = vorige ? VP_REM - (Date.now() - vorige) : 0;     // vaste rem tussen twee vragen
      if(pauze > 0) await wacht(pauze);
      vorige = Date.now();
      const tot = Math.min(Date.now() + 60e3, van + UUR);
      S.tekst.vp = 'Verplaatsingen ophalen: ' + String(fmt(van)).slice(5, 16) + '…'; meld();
      let obj;
      try{ obj = await vraag('picqer', 'actie=verplaatsingen&sinds=' + encodeURIComponent(fmt(van)) + '&tot=' + encodeURIComponent(fmt(tot))); }
      catch(e){ wachtOp('vp', e); await bewaarMeta('vp'); meld(); return; }   // 429/504: stoppen, niet opnieuw in een lus
      if(!obj.tot) S.oudeFunctie = true;                              // functie nog zonder "tot": één antwoord, dan klaar
      await WH.impVerplaatsingen(obj);
      if(window.WHPD && WHPD.zetVers) WHPD.zetVers({ vp:D.VP });
      m.tot = fmt(S.oudeFunctie ? Date.now() : tot); m.op = new Date().toISOString(); m.n = D.VP && D.VP.rows ? D.VP.rows.length : m.n; m.vol = !!obj.vol;
      gelukt(m); await bewaarMeta('vp'); meld();
      n++; van = tot;
      if(S.oudeFunctie) break;
    }
  }catch(e){ wachtOp('vp', e); await bewaarMeta('vp'); }
  finally{ S.vpBezig = false; S.tekst.vp = ''; const m = S.meta.vp; if(m && m.lease){ delete m.lease; await bewaarMeta('vp'); } meld(); }
}

/* ---------- inkoop: 12 maanden, incrementeel ---------- */
const nu0 = () => Date.now();
// samenvoegen: een opnieuw gelezen order vervangt zijn oude regels (via het order-id). Oudere regels zonder order-id (eerste versie van de knop)
// verdwijnen alleen als ze naast een nieuwe regel van dezelfde dag en hoeveelheid staan; wat we niet opnieuw kunnen lezen blijft staan.
function bouwInk(oud, orders, sinds, volledig){
  const ids = new Set(orders.filter(o => Array.isArray(o[4])).map(o => o[0]));
  const grens = isoDag(nu0() - INK_DAGEN * DAG), nieuw = {}, p = {};
  orders.forEach(o => {
    if(!Array.isArray(o[4]) || /cancel/i.test(o[2] || '')) return;
    o[4].forEach(([c, b, g]) => { const k = D.PLOW[String(c).toLowerCase()] || c; (nieuw[k] = nieuw[k] || []).push([o[1], b, g, o[2] === 'completed' ? 1 : 0, o[0]]); });
  });
  Object.keys((oud && oud.p) || {}).forEach(c => {
    const nw = nieuw[c] || [], gebruikt = new Set();
    const keep = oud.p[c].filter(x => {
      if(String(x[0]) < grens) return false;                         // ouder dan 12 maanden
      if(x[4]) return !ids.has(x[4]);                                 // order opnieuw gelezen: vervangen door de nieuwe regels
      const i = nw.findIndex((y, j) => !gebruikt.has(j) && y[0] === x[0] && (Number(y[1]) || 0) === (Number(x[1]) || 0));
      if(i >= 0){ gebruikt.add(i); return false; }                    // zonder id, zelfde als een nieuwe regel: die vervangt hem
      return true;
    });
    if(keep.length) p[c] = keep;
  });
  Object.keys(nieuw).forEach(c => { p[c] = (p[c] || []).concat(nieuw[c]); });
  const n = volledig || !oud ? orders.filter(o => !/cancel/i.test(o[2] || '')).length : Math.max((oud && oud.n) || 0, orders.length);
  return { t:new Date().toISOString(), sinds:grens, n, p };
}
async function inkoop(forceer){
  if(S.inkBezig || uit() || !D.PLOW || !Object.keys(D.PLOW).length) return;
  S.inkBezig = true; meld();
  try{
    const m = await laadMeta('ink'), nu = Date.now();
    if(moetWachten(m)) return;
    if(!forceer && m.volledig && m.op && nu - ms(m.op) < 24 * UUR) return;
    if(drukBezig()) return;
    if(!(await claim('ink'))) return;
    const cur = await WH.catHaal(INK).catch(() => null), oud = (cur && cur.data) || null;
    const volledig = !m.volledig || forceer === 'volledig';
    const sinds = isoDag(nu - (volledig ? INK_DAGEN : INK_BIJ) * DAG);
    S.tekst.ink = 'Inkoop ophalen: lijst…'; meld();
    const l = await vraag('picqer-inkoop', 'stap=lijst&sinds=' + sinds);
    const orders = (l.orders || []).filter(o => !/cancel/i.test(o[2] || ''));
    const bekend = new Set(orders.map(o => o[0]));
    // orders van vóór het venster die nog open stonden: opnieuw lezen, hun ontvangen aantal verandert
    const open = new Set();
    Object.values((oud && oud.p) || {}).forEach(r => r.forEach(x => { if(x[4] && !x[3] && !bekend.has(x[4])) open.add(x[4]); }));
    const zonder = orders.filter(o => !Array.isArray(o[4])).map(o => o[0]).concat([...open]);
    const regels = {}; orders.forEach(o => { if(Array.isArray(o[4])) regels[o[0]] = o[4]; });
    const extra = {};
    for(let i = 0; i < zonder.length; i += 60){
      S.tekst.ink = 'Inkoop ophalen: regels ' + Math.min(i + 60, zonder.length) + ' van ' + zonder.length + '…'; meld();
      const d = await vraag('picqer-inkoop', 'stap=detail&ids=' + zonder.slice(i, i + 60).join(','));
      (d.orders || []).forEach(o => { regels[o[0]] = o[4] || []; extra[o[0]] = o; });
      if(i + 60 < zonder.length) await wacht(8000);
    }
    const alle = orders.map(o => [o[0], o[1], o[2], o[3], regels[o[0]] || null]).concat([...open].filter(id => extra[id]).map(id => [id, extra[id][1], extra[id][2], extra[id][3], regels[id]]));
    const data = bouwInk(oud, alle, sinds, volledig);
    await WH.catZet(INK, data);
    if(window.WHPD && WHPD.zetVers) WHPD.zetVers({ ink:data });
    m.op = new Date().toISOString(); m.volledig = true; m.sinds = sinds; m.n = alle.length;
    gelukt(m); await bewaarMeta('ink');
  }catch(e){ wachtOp('ink', e); await bewaarMeta('ink'); }
  finally{ S.inkBezig = false; S.tekst.ink = ''; if(S.meta.ink && S.meta.ink.lease){ delete S.meta.ink.lease; await bewaarMeta('ink'); } meld(); }
}

// aangeroepen door de ronde (ivol-live.js) en door Per familie; start op de achtergrond en wacht nergens op
function ronde(forceer){
  if(uit()) return;
  if(Date.now() - S.laatst < 20e3 && !forceer) return;
  S.laatst = Date.now();
  verplaatsingen(forceer); inkoop(forceer);   // twee onafhankelijke taken; elk met zijn eigen wachttijd na een fout
}
// waar ivol-live.js niet draait (Warehouse, Test): zelf elke minuut kijken of er iets te doen is
setInterval(() => { if(!window.IVL && document.visibilityState === 'visible') ronde(false); }, 60000);
function status(){
  const v = S.meta.vp || {}, i = S.meta.ink || {};
  const wacht = m => moetWachten(m) ? m.wachtTot : null;
  return { bezig:S.vpBezig || S.inkBezig, tekst:S.vpBezig ? S.tekst.vp : S.tekst.ink, tekstVp:S.tekst.vp, tekstInk:S.tekst.ink, fout:S.fout, oudeFunctie:S.oudeFunctie,
    vp:{ op:v.op || null, tot:v.tot || null, n:v.n || 0, vol:!!v.vol, gat:v.gat || null, wachtTot:wacht(v), fout:v.fout || null, fouten:v.fouten || 0 },
    ink:{ op:i.op || null, volledig:!!i.volledig, n:i.n || 0, wachtTot:wacht(i), fout:i.fout || null, fouten:i.fouten || 0 } };
}
return { ronde, verplaatsingen, inkoop, status, bouwInk, fmt, opNieuw:f => S.luister.push(f), S };
})();
