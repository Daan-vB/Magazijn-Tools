/* =====================================================================
   IVOL Warehouse — inkoop en verplaatsingen houden zichzelf bij (27-10-2026)
   Voor Productdata (Per familie): wat er is ingekocht en wat er tussen locaties is verplaatst komt vanzelf uit Picqer,
   zonder knop. Alleen lezen uit Picqer (functies "picqer" en "picqer-inkoop"); schrijven alleen in onze eigen opslag:
     wh-inkoop          { t, sinds, n, p:{ code:[[datum, besteld, ontvangen, afgerond 1/0, inkooporder-id], ...] } }   12 maanden
     wh-verplaatsingen  { datum, opgehaald, sinds, rows:[[id, tijd, wie, code, aantal, van, naar, magazijn]] }       60 dagen
     wh-pdvers-vp       { tot, op, venster, klaar, n, lease }       voortgang verplaatsingen, hervatbaar
   wh-pdvers-ink      { op, volledig, sinds, n, lease }           voortgang inkoop
   Eerste vulling: verplaatsingen in vensters van één dag (halveert bij een vol antwoord), inkoop in één keer over 12 maanden
   (lijst, daarna de regels per 60 orders met pauze). Daarna: verplaatsingen elk half uur vanaf het laatste moment (1 uur overlap),
   inkoop elke 24 uur over de laatste 45 dagen plus alle orders die nog open stonden. Eigen invoer en productdata blijven ongemoeid.
   De ronde in wh/ivol-live.js roept PDVERS.ronde() aan; waar dat bestand niet draait (Warehouse, Test) doet dit bestand dat zelf.
   Staat de bron op TEST, dan doet dit bestand niets. Geen koppelcode op dit apparaat: ook niets.
   ===================================================================== */
window.PDVERS = (function(){
'use strict';
if(!window.WH) return {};
const { D, isoDag } = WH;
const META = { vp:'wh-pdvers-vp', ink:'wh-pdvers-ink' }, INK = 'wh-inkoop';
const VP_DAGEN = 60, INK_DAGEN = 365, INK_BIJ = 45;
const DAG = 864e5, UUR = 36e5;
const S = { meta:{ vp:{}, ink:{} }, vpBezig:false, inkBezig:false, tekst:'', fout:null, foutOp:0, oudeFunctie:false, laatst:0, luister:[], id:Math.random().toString(36).slice(2, 10) };
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
function fout(naam, e){ S.fout = e; S.foutOp = Date.now(); console.error('PDVERS ' + naam + ':', e); const m = S.meta[naam]; if(m){ m.fout = String((e && e.message) || e).slice(0, 200); m.foutOp = new Date().toISOString(); } }
const geblokkeerd = () => S.foutOp && Date.now() - S.foutOp < 10 * 60e3;   // na een fout 10 minuten rust

/* ---------- verplaatsingen: 60 dagen, in vensters, hervatbaar ---------- */
// vijf vensters worden samen bewaard: zo gaat de rij van 60 dagen niet bij elk venster opnieuw over de lijn
const voeg = (a, b) => { ['historie', 'locaties', 'producten', 'gebruikers', 'magazijnen'].forEach(k => { a[k] = (a[k] || []).concat(b[k] || []); }); a.opgehaald = b.opgehaald; a.vol = a.vol || b.vol; return a; };
async function verplaatsingen(forceer){
  if(S.vpBezig || uit() || !D.PLOW || !Object.keys(D.PLOW).length) return;
  S.vpBezig = true; meld();
  let buf = null, nBuf = 0, bufTot = null;
  const m0 = { m:null };
  const leegBuf = async () => {
    if(!buf) return;
    const m = m0.m;
    await WH.impVerplaatsingen(buf);
    if(window.WHPD && WHPD.zetVers) WHPD.zetVers({ vp:D.VP });
    m.tot = bufTot; m.op = new Date().toISOString(); m.n = D.VP && D.VP.rows ? D.VP.rows.length : m.n; m.vol = !!buf.vol; delete m.fout; delete m.foutOp;
    buf = null; nBuf = 0;
    await bewaarMeta('vp'); meld();
  };
  try{
    const nu = Date.now(), grens = nu - VP_DAGEN * DAG;
    const m = m0.m = await laadMeta('vp');
    if(!forceer && m.klaar && m.op && nu - ms(m.op) < 30 * 60e3) return;
    if(!(await claim('vp'))) return;
    // doorgaan tot we bij nu zijn (elk venster is één vraag), met pauze tussen de vragen
    for(let ronde = 0; ronde < 80; ronde++){
      const n2 = Date.now();
      let van = (bufTot || m.tot) ? ms(bufTot || m.tot) - UUR : grens;   // 1 uur overlap: gemiste verplaatsingen komen alsnog
      if(van < grens) van = grens;
      const venster = Math.max(UUR, Math.min(DAG, m.venster || DAG));
      const tot = Math.min(n2 + 60e3, van + venster);
      S.tekst = 'Verplaatsingen ophalen: ' + String(fmt(van)).slice(0, 10) + '…';
      meld();
      const obj = await vraag('picqer', 'actie=verplaatsingen&sinds=' + encodeURIComponent(fmt(van)) + '&tot=' + encodeURIComponent(fmt(tot)));
      if(!obj.tot) S.oudeFunctie = true;                   // functie nog zonder "tot": geeft alles sinds van, hooguit 6000
      if(obj.vol && venster > UUR && obj.tot){            // te veel in dit venster: kleiner opnieuw, niets bewaard
        m.venster = Math.max(UUR, venster / 2); await wacht(3000); continue;
      }
      buf = buf ? voeg(buf, obj) : Object.assign({}, obj); nBuf++;
      bufTot = fmt(S.oudeFunctie ? n2 : tot);
      const klaar = S.oudeFunctie || tot >= n2;
      m.klaar = klaar; m.venster = Math.min(DAG, venster * 2);
      S.fout = null;
      if(klaar || nBuf >= 5) await leegBuf();
      if(klaar) break;
      await wacht(15000);                                   // binnen de limiet van Picqer
    }
  }catch(e){
    try{ await leegBuf(); }catch(e2){ console.warn('PDVERS bewaren:', e2.message); }
    fout('vp', e); await bewaarMeta('vp');
  }
  finally{ S.vpBezig = false; S.tekst = ''; const m = S.meta.vp; if(m && m.lease){ delete m.lease; await bewaarMeta('vp'); } meld(); }
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
    if(!forceer && m.volledig && m.op && nu - ms(m.op) < 24 * UUR) return;
    if(!(await claim('ink'))) return;
    const cur = await WH.catHaal(INK).catch(() => null), oud = (cur && cur.data) || null;
    const volledig = !m.volledig || forceer === 'volledig';
    const sinds = isoDag(nu - (volledig ? INK_DAGEN : INK_BIJ) * DAG);
    S.tekst = 'Inkoop ophalen: lijst…'; meld();
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
      S.tekst = 'Inkoop ophalen: regels ' + Math.min(i + 60, zonder.length) + ' van ' + zonder.length + '…'; meld();
      const d = await vraag('picqer-inkoop', 'stap=detail&ids=' + zonder.slice(i, i + 60).join(','));
      (d.orders || []).forEach(o => { regels[o[0]] = o[4] || []; extra[o[0]] = o; });
      if(i + 60 < zonder.length) await wacht(8000);
    }
    const alle = orders.map(o => [o[0], o[1], o[2], o[3], regels[o[0]] || null]).concat([...open].filter(id => extra[id]).map(id => [id, extra[id][1], extra[id][2], extra[id][3], regels[id]]));
    const data = bouwInk(oud, alle, sinds, volledig);
    await WH.catZet(INK, data);
    if(window.WHPD && WHPD.zetVers) WHPD.zetVers({ ink:data });
    m.op = new Date().toISOString(); m.volledig = true; m.sinds = sinds; m.n = alle.length; delete m.fout; delete m.foutOp;
    S.fout = null; await bewaarMeta('ink');
  }catch(e){ fout('ink', e); await bewaarMeta('ink'); }
  finally{ S.inkBezig = false; S.tekst = ''; if(S.meta.ink && S.meta.ink.lease){ delete S.meta.ink.lease; await bewaarMeta('ink'); } meld(); }
}

// aangeroepen door de ronde (ivol-live.js) en door Per familie; start op de achtergrond en wacht nergens op
function ronde(forceer){
  if(uit() || geblokkeerd() && !forceer) return;
  if(Date.now() - S.laatst < 20e3 && !forceer) return;
  S.laatst = Date.now();
  verplaatsingen(forceer); inkoop(forceer);   // twee onafhankelijke taken
}
// waar ivol-live.js niet draait (Warehouse, Test): zelf elke minuut kijken of er iets te doen is
setInterval(() => { if(!window.IVL && document.visibilityState === 'visible') ronde(false); }, 60000);
function status(){
  const v = S.meta.vp || {}, i = S.meta.ink || {};
  return { bezig:S.vpBezig || S.inkBezig, tekst:S.tekst, fout:S.fout, oudeFunctie:S.oudeFunctie, vp:{ op:v.op || null, tot:v.tot || null, klaar:!!v.klaar, n:v.n || 0, vol:!!v.vol }, ink:{ op:i.op || null, volledig:!!i.volledig, n:i.n || 0 } };
}
return { ronde, verplaatsingen, inkoop, status, bouwInk, fmt, opNieuw:f => S.luister.push(f), S };
})();
