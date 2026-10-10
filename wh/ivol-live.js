/* =====================================================================
   IVOL Warehouse 3.0 — Picqer live (alleen lezen), houdt zichzelf bij zolang 3.0 open staat.
     elke 2 min    picklijsten + backorders              (functie: vandaag)              → geheugen
     elke 10 min   voorraad per locatie van aanvulkandidaten (catalogus 12u + mutaties)  → wh-pq-cat, wh-pickstand
     elke 12 uur   alle locaties met bulk/tijdelijk       (functie: locatielijst)         → wh-locaties (productkoppelingen blijven uit de export)
     doorlopend    aanvulniveaus, 240 producten per 5 min (functie: niveaus)              → wh-pq-live; na een volle ronde
                   en als ≥ 90% gelijk is aan de export → ook wh-pq (de waarheid voor alle apps)
   Meta in catalog-rij wh-live3. Nieuwe functie-acties ontbreken? Dan meldt Bronnen dat de functie bijgewerkt moet worden.
   ===================================================================== */
window.IVL = (function(){
'use strict';
const { D, nf } = WH;
const META = 'wh-live3', NIV = 'wh-pq-live';
const S = { meta:{}, niv:null, bezig:'', fout:null, functieOud:false, laatst:{}, luister:[] };
const uurOud = iso => iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : 1e9;
const wacht = ms => new Promise(r => setTimeout(r, ms));
const code = () => { try{ return localStorage.getItem('ivol-koppelcode') || ''; }catch(e){ return ''; } };
const V = (a, p) => WHLIVE.vraag(a, p);
const meld = () => S.luister.forEach(f => { try{ f(); }catch(e){ console.error(e); } });
const isOud = e => /Onbekende actie/i.test(String(e && e.message || ''));

async function laadMeta(){
  try{
    const rows = window.WHC ? await WHC.catalog([META, NIV]) : await WH.api('GET', 'catalog?key=in.(%22' + META + '%22,%22' + NIV + '%22)&select=key,data,updated_at');
    (rows || []).forEach(r => { if(r.key === META) S.meta = r.data || {}; if(r.key === NIV) S.niv = r.data || null; });
  }catch(e){ S.fout = e; }
}
const zetMeta = patch => { Object.assign(S.meta, patch); return WH.catZet(META, S.meta).catch(() => {}); };

/* ---------- locaties: alle locaties live, productkoppelingen blijven uit de export ---------- */
async function locaties(){
  if(!Object.keys(D.LOC || {}).length) throw new Error('Locaties nog niet geladen uit de database; niets overschreven.');
  S.bezig = 'Locaties ophalen uit Picqer…'; meld();
  const alle = [];
  for(let van = 0, klaar = false; !klaar && van < 30000; van += 1000){
    const r = await V('locatielijst', { van });
    (r.rijen || []).forEach(x => alle.push(x));
    klaar = r.klaar;
    if(!klaar) await wacht(2500);
  }
  if(alle.length < 100) throw new Error('Te weinig locaties terug uit Picqer (' + alle.length + '), niets overschreven.');
  const naamVan = {}; alle.forEach(([id, naam]) => naamVan[id] = naam);
  const rows = alle.map(([id, naam, bulk, tijd, excl, parent]) => [naam, bulk, tijd, excl, parent ? (naamVan[parent] || '') : '', ((D.LOC[naam] || {}).codes || []).join('|')]);
  const datum = new Date().toISOString();
  // datum van de productkoppelingen = de laatste locatie-export (live levert alleen de locaties zelf)
  const vorigeLive = S.meta.loc && S.meta.loc.t;
  const codesDatum = vorigeLive && vorigeLive === D.LOCDATUM ? (S.meta.loc.codes || null) : D.LOCDATUM;
  await WH.catZet('wh-locaties', { datum, bron:'picqer-live', codes:codesDatum, rows });
  D.LOC = {}; D.LOCDATUM = datum;
  rows.forEach(([naam, bulk, tijd, excl, parent, codes]) => { D.LOC[naam] = { naam, bulk:!!bulk, tijd:!!tijd, excl:!!excl, parent, codes:codes ? codes.split('|') : [] }; });
  if(window.WHL) WHL.reset();
  await zetMeta({ loc:{ t:datum, n:rows.length, codes:codesDatum } });
}

/* ---------- aanvulniveaus: doorlopend, 240 producten per ronde ---------- */
async function niveausStap(){
  const cat = WHAL.S.cat;
  if(!cat || !cat.ids) return;
  const codes = Object.keys(cat.hm || {}).filter(c => cat.ids[c]).sort();
  if(!codes.length) return;
  const n = S.niv && S.niv.m ? S.niv : { start:new Date().toISOString(), cursor:0, m:{} };
  const van = n.cursor || 0;
  const deel = codes.slice(van, van + 240);
  S.bezig = 'Aanvulniveaus ' + nf(van) + '–' + nf(van + deel.length) + ' van ' + nf(codes.length) + '…'; meld();
  const codeVan = {}; deel.forEach(c => codeVan[cat.ids[c]] = c);
  for(let i = 0; i < deel.length; i += 60){
    const r = await V('niveaus', { ids:deel.slice(i, i + 60).map(c => cat.ids[c]).join(',') });
    (r.lijst || []).forEach(([id, w]) => { const c = codeVan[id]; if(c && w) n.m[c] = [w[0], w[1]]; });
    if(i + 60 < deel.length) await wacht(8000);
  }
  n.cursor = van + deel.length; n.t = new Date().toISOString(); n.totaal = codes.length;
  if(n.cursor >= codes.length){ n.klaar = n.t; n.cursor = 0; n.vorige = n.start; n.start = new Date().toISOString(); await naarPq(n); }
  S.niv = n;
  await WH.catZet(NIV, n).catch(() => {});
}
// na een volle ronde: vergelijken met de export; pas bij ≥ 90% gelijk de live waarden als waarheid in wh-pq zetten
async function naarPq(n){
  let gelijk = 0, beide = 0;
  Object.entries(n.m).forEach(([c, [a, b]]) => { const q = D.PQ[c]; if(!q || q[0] == null) return; beide++; if(Number(q[0]) === Number(a) && Number(q[1]) === Number(b)) gelijk++; });
  n.check = { beide, gelijk, pct:beide ? Math.round(gelijk / beide * 100) : null, op:new Date().toISOString() };
  if(beide && n.check.pct < 90){ n.check.uitkomst = 'niet overgenomen: wijkt te veel af van de export'; return; }
  const m = Object.assign({}, D.PQ);
  Object.entries(n.m).forEach(([c, [a, b]]) => { const oud = m[c] || []; m[c] = [a, b, oud[2] || 0]; });
  const datum = new Date().toISOString();
  await WH.catZet('wh-pq', { datum, bron:'picqer-live', m });
  D.PQ = m; D.PQDATUM = datum;
  if(window.WHL) WHL.reset();
  n.check.uitkomst = 'overgenomen in wh-pq';
}

/* ---------- de lus ---------- */
async function ronde(forceer){
  if(S.bezig || !code()) return;
  S.fout = null;
  try{
    const s = WHLIVE.status();
    if(forceer || !s.data || Date.now() - s.data.binnen > 120000){ S.laatst.vandaag = Date.now(); WHLIVE.laad(true); }
    if(!S.meta.geladen){ await laadMeta(); S.meta.geladen = true; }
    if(!WHAL.S.geladen) await WHAL.laadOpslag();
    if(forceer || !WHAL.S.st || uurOud(WHAL.S.st.bijgewerkt) * 60 >= 10){ S.bezig = 'Voorraad per locatie bijwerken…'; meld(); if(!WHAL.S.st || !WHAL.S.cat) await WHAL.bijwerken(false); else await WHAL.ververs(forceer ? 1 : 10); S.laatst.stand = Date.now(); }
    if(!S.functieOud){
      try{
        if(forceer || uurOud((S.meta.loc || {}).t) > 12) await locaties();
        if(forceer || !S.laatst.niv || Date.now() - S.laatst.niv > 290000){ S.laatst.niv = Date.now(); await niveausStap(); }
      }catch(e){ if(isOud(e)) S.functieOud = true; else throw e; }
    }
  }catch(e){ S.fout = e; console.error(e); }
  S.bezig = ''; meld();
}
setInterval(() => { if(document.visibilityState === 'visible') ronde(false); }, 60000);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') ronde(false); });
if(window.WHLIVE) WHLIVE.opNieuw(meld);
if(window.WHAL) WHAL.opNieuw(meld);

function bronnen(){
  const s = WHLIVE.status(), st = WHAL.S.st, cat = WHAL.S.cat, n = S.niv;
  return {
    gekoppeld:!!code(), functieOud:S.functieOud, bezig:S.bezig || (WHAL.S.bezig ? (WHAL.S.stap || 'Voorraad bijwerken…') : ''), fout:S.fout || s.fout || WHAL.S.fout,
    rijen:[
      { t:'Picklijsten en backorders', bron:'live', op:s.data ? new Date(s.data.binnen).toISOString() : null, ritme:'elke 2 minuten', vervangt:'backorder-export' },
      { t:'Producten met voorraad, ABC, picks per dag', bron:'live', op:cat && cat.t, ritme:'elke 12 uur', vervangt:'deel van de productexport' },
      { t:'Voorraad per locatie (aanvulkandidaten)', bron:'live', op:st && st.bijgewerkt, ritme:'elke 10 minuten', vervangt:'voorraad-per-locatie-export, aanvuladvies-PDF' },
      { t:'Locaties: pick/bulk, vast/tijdelijk', bron:S.functieOud ? 'export' : 'live', op:(S.meta.loc || {}).t || D.LOCDATUM, ritme:S.functieOud ? 'na functie-update: elke 12 uur' : 'elke 12 uur', vervangt:'locatie-export' },
      { t:'Aanvulniveaus', bron:S.functieOud ? 'export' : 'live', op:n && (n.klaar || n.t), ritme:S.functieOud ? 'na functie-update: doorlopend' : 'doorlopend, ±90 min per ronde', vervangt:'productexport (niveaus)',
        extra:n ? (n.cursor ? 'ronde ' + nf(n.cursor) + ' / ' + nf(n.totaal || 0) : '') + (n.check ? ' · controle: ' + n.check.pct + '% gelijk aan export, ' + n.check.uitkomst : '') : '' },
      { t:'Producten per locatie (koppelingen)', bron:'export', op:(S.meta.loc && S.meta.loc.t) ? (S.meta.loc.codes || null) : D.LOCDATUM, ritme:'met de productexport (wekelijks)', vervangt:'', extra:(S.meta.loc && S.meta.loc.t && !S.meta.loc.codes) ? 'uit de laatste locatie-export, datum onbekend' : '' },
      { t:'Magazijnverkopen per maand', bron:'export', op:null, ritme:'maandelijks', vervangt:'' }
    ]
  };
}
return { S, ronde, bronnen, opNieuw:f => S.luister.push(f) };
})();
