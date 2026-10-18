/* =====================================================================
   IVOL Warehouse 3.0 — Picqer-geschiedenis ophalen (18-10-2026, alleen lezen)
   Haalt de verplaatsingen vanaf 2025-01-01 per belangrijk product (laag 1–3 van Poort 0.4) op via de functie "picqer"
   (koppelcode zoals Vandaag) en bewaart ze compact per kwartaal in catalog-rijen. Geen enkel scherm laadt deze rijen; alleen de export leest ze.
     wh-hist-index        { p:{idproduct:code}, l:{idlocation:naam}, u:{iduser:naam} }   (via actie idindex)
     wh-vp-hist-2025q1 …  { v, kw, rows:[[id, tijd, iduser, idproduct, aantal, van-idlocation, naar-idlocation, 0]] }   (per kwartaal op tijd; van/naar 0 = geen specifieke locatie)
     wh-hist-voortgang    { idx:{soort:{offset, klaar}}, pr:{ tot, klaar, p:{idproduct:cursor}, fout:{idproduct:melding}, op } }   (hervatten per product)
   Volgorde: historietest → namen (idindex: producten, daarna locaties en gebruikers) → codes van de belangrijke producten → idproduct →
   per product historielicht (idproduct, sinds 2025-01-01, tot nu, 5 pagina's; vol → verder vanaf laatste).
   Fouten: altijd de echte fout in de diagnoseregel. Alleen wachten als Picqer dat vraagt (wachtSec, max. 3 keer per vraag).
   Mislukt een vraag, dan eerst opnieuw testen; test 3 keer achter elkaar mislukt of 3 producten achter elkaar mislukt = stoppen.
   Ontvangsten worden niet meer opgehaald (bestaande wh-ont-hist-rijen blijven staan).
   ===================================================================== */
window.WHHIST = (function(){
'use strict';
const { $, esc, nf } = WH;
const START = '2025-01-01 00:00:00';
const PAUZE = 3, WACHT_MAX = 3, TEST_MAX = 3, REEKS_MAX = 3, PAGINAS = 5, BEWAAR_MS = 60e3;   // seconden, keren, pagina's, ms
const VOORTGANG = 'wh-hist-voortgang', INDEX = 'wh-hist-index', PREFIX = 'wh-vp-hist-';
const S = { diag:'', test:'', log:[], eta:'', bezig:false, pct:0, tekst:'', fout:'', klaar:'', stop:false };

const wacht = ms => new Promise(r => setTimeout(r, ms));
const isDaan = () => { try{ return (localStorage.getItem('ivol-ik') || 'Daan') === 'Daan'; }catch(e){ return true; } };
const kwVan = t => { const m = String(t || '').match(/^(\d{4})-(\d{2})/); return m ? m[1] + 'q' + (Math.floor((+m[2] - 1) / 3) + 1) : null; };
const ms = t => new Date(String(t || '').replace(' ', 'T')).getTime();
const stempel = t => String(t || '').replace('T', ' ').slice(0, 19);
const fmt = t => { const d = new Date(t), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()); };
const plus1s = t => fmt(ms(t) + 1000);
const sec = n => nf(n / 1000, 1) + ' s';
const stopFout = () => Object.assign(new Error('Gestopt'), { soort:'stop' });
const hard = e => !!e && ['code', 'jwt', 'stop', 'test', 'reeks', 'picqer'].includes(e.soort);

async function wachtMet(s, tekst){
  const basis = S.tekst;
  S.wachten = true;
  for(let i = Math.ceil(s); i > 0 && !S.stop; i--){ zet(null, tekst.replace('{s}', i)); await wacht(1000); }
  S.wachten = false; S.tekst = basis;
}
function log(regel){
  const d = new Date(), z = n => String(n).padStart(2, '0');
  S.log.push(z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()) + ' ' + regel);
  if(S.log.length > 12) S.log.shift();
}

/* ---------- tussenstation: eigen fetch, zodat de echte fout zichtbaar blijft (HTTP-status, functieantwoord of browsermelding + duur) ---------- */
const FN_STD = () => WH.URL_ + '/functions/v1/picqer';
const fnUrl = () => { try{ return localStorage.getItem('ivol-fn') || FN_STD(); }catch(e){ return FN_STD(); } };
const koppelcode = () => { try{ return localStorage.getItem('ivol-koppelcode') || ''; }catch(e){ return ''; } };
const diagTekst = d => d ? 'Picqer ' + (d.picqerStatus == null ? '–' : d.picqerStatus) + ' · ' + sec(d.ms || 0) + ' · ' + nf(d.paginas || 0) + ' pag.' + (d.retryAfter ? ' · Retry-After ' + d.retryAfter + ' s' : '') : 'geen diag';
async function roep(actie, params){
  const qs = new URLSearchParams(Object.assign({ actie }, params || {})).toString();
  const t0 = Date.now();
  let r, t;
  try{
    r = await fetch(fnUrl() + '?' + qs, { headers:{ apikey:WH.KEY, 'x-ivol-code':koppelcode() }, cache:'no-store' });
    t = await r.text();
  }catch(e){ throw Object.assign(new Error('fetch mislukt na ' + sec(Date.now() - t0) + ': ' + ((e && e.message) || String(e))), { soort:'net' }); }
  let j = null; try{ j = JSON.parse(t); }catch(e){}
  if(r.ok && j) return j;
  if(j && j.code === 'koppelcode'){ if(window.WHLIVE) WHLIVE.zetCode(''); throw Object.assign(new Error('Koppelcode klopt niet. Vul hem opnieuw in (bij Vandaag).'), { soort:'code' }); }
  if(r.status === 401 && !j) throw Object.assign(new Error('HTTP 401: Supabase weigert het verzoek. Zet bij de functie "picqer" Verify JWT uit.'), { soort:'jwt' });
  const wat = j && j.fout ? j.fout : t ? (r.ok ? 'geen JSON: ' : '') + t.replace(/\s+/g, ' ').slice(0, 160) : 'leeg antwoord';
  throw Object.assign(new Error('HTTP ' + r.status + ': ' + wat + (j && j.diag ? ' · ' + diagTekst(j.diag) : '') + ' · na ' + sec(Date.now() - t0)), { soort:'http', status:r.status, wachtSec:(j && j.wachtSec) || 0 });
}

// één vraag: alleen bij wachtSec van Picqer die tijd wachten en opnieuw (max. 3 keer); elke andere fout gaat direct terug
async function vraag(actie, params, wat){
  for(let w = 0; ; w++){
    if(S.stop) throw stopFout();
    S.diag = wat + ' · bezig…'; teken();
    try{
      const r = await roep(actie, params);
      S.diag = wat + ' · HTTP 200 · ' + diagTekst(r.diag) + (r.onderbroken ? ' · onderbroken: ' + r.onderbroken : '');
      return r;
    }catch(e){
      if(hard(e)) throw e;
      S.diag = wat + ' · ' + e.message; log(S.diag);
      if(e.wachtSec && w < WACHT_MAX){ await wachtMet(e.wachtSec, wat + ' · Picqer vraagt ' + e.wachtSec + ' s te wachten (' + (w + 1) + ' van ' + WACHT_MAX + ') · nog {s} s'); continue; }
      throw e;
    }
  }
}

// historietest: één pagina, één regel op het scherm; 3 keer achter elkaar mislukt = stoppen met de volledige diagnose
async function test(){
  for(let i = 1; ; i++){
    if(S.stop) throw stopFout();
    zet(null, 'Test ' + i + ' van ' + TEST_MAX + '…');
    let ra = 0;
    try{
      const r = await roep('historietest');
      S.test = r.ok ? 'Test: Picqer ' + r.picqerStatus + ' in ' + sec(r.ms) + ', ' + nf(r.aantal) + ' regels'
        : 'Test: ' + (r.fout || 'mislukt') + ' · Picqer ' + (r.picqerStatus == null ? '–' : r.picqerStatus) + ' in ' + sec(r.ms) + (r.retryAfter ? ' · Retry-After ' + r.retryAfter + ' s' : '');
      log(S.test);
      if(r.ok) return r;
      ra = r.retryAfter || 0;
    }catch(e){
      if(hard(e)) throw e;
      S.test = 'Test: ' + e.message; log(S.test);
    }
    if(i >= TEST_MAX) throw Object.assign(new Error('De test is ' + TEST_MAX + ' keer achter elkaar mislukt. Gestopt; de voortgang is bewaard.'), { soort:'test' });
    await wachtMet(Math.min(120, ra || 10), 'Test ' + i + ' van ' + TEST_MAX + ' mislukt · nieuwe test over {s} s');
  }
}
// mislukt een vraag: eerst testen (stopt zelf na 3 mislukte tests), dan één keer opnieuw
async function vraagMetTest(actie, params, wat){
  try{ return await vraag(actie, params, wat); }
  catch(e){ if(hard(e)) throw e; await test(); }
  return await vraag(actie, params, wat + ' · 2e poging');
}
async function pauze(wachtSec){
  if(wachtSec) await wachtMet(wachtSec, S.tekst + ' · Picqer vraagt ' + wachtSec + ' s te wachten · nog {s} s');
  else await wacht(PAUZE * 1000);
}

/* ---------- verplaatsingen: één regel per verplaatsing, met id's in plaats van namen ---------- */
function converteer(hist){
  const seen = new Set(), rows = [];
  hist.forEach(h => {
    if(!h || h.change_type !== 'movement') return;
    const n = Number(h.stock_change); if(!n) return;
    const hier = h.idlocation || 0, ander = h.contra_idlocation || 0;
    const van = n > 0 ? ander : hier, naar = n > 0 ? hier : ander;
    const tijd = String(h.changed_at || '').replace(' ', 'T');
    const k = [h.idproduct, tijd, van, naar, Math.abs(n)].join('|');
    if(seen.has(k)) return;
    seen.add(k);
    rows.push([h.idproduct_location_stock_history, tijd, h.iduser || 0, h.idproduct, Math.abs(n), van, naar, 0]);
  });
  return rows;
}
const sleutelVp = r => [r[3], r[1], r[5], r[6], r[4]].join('|');

/* ---------- kwartalen: één keer lezen per ronde, nieuwe rijen erbij, af en toe (en aan het eind) wegschrijven, gesorteerd op tijd ---------- */
let KW = {};
async function kwartaal(k){
  if(!KW[k]){
    const oud = await WH.catHaal(PREFIX + k);
    const m = new Map(); (((oud && oud.data) || {}).rows || []).forEach(r => m.set(sleutelVp(r), r));
    KW[k] = { m, vuil:false };
  }
  return KW[k];
}
async function voegToe(rows){
  let nieuw = 0;
  for(const r of rows){
    const k = kwVan(r[1]); if(!k) continue;
    const q = await kwartaal(k), s = sleutelVp(r);
    if(!q.m.has(s)){ q.m.set(s, r); q.vuil = true; nieuw++; }
  }
  return nieuw;
}
// eerst de rijen, dan de voortgang: een onderbreking kost hooguit een minuut opnieuw ophalen, nooit een gat
async function bewaar(vg, nu){
  if(!nu && Date.now() - S.bewaard < BEWAAR_MS) return;
  for(const k of Object.keys(KW).sort()){
    const q = KW[k]; if(!q.vuil) continue;
    const rows = [...q.m.values()].sort((a, b) => String(a[1]).localeCompare(String(b[1])) || (a[0] || 0) - (b[0] || 0));
    await WH.catZet(PREFIX + k, { v:1, kw:k, rows });
    q.vuil = false;
  }
  if(vg.pr) vg.pr.op = new Date().toISOString();
  await WH.catZet(VOORTGANG, vg);
  S.bewaard = Date.now();
}

/* ---------- namen: hervatbaar (idindex), bewaard in wh-hist-index ---------- */
const SOORT = { producten:'p', locaties:'l', gebruikers:'u' };
async function haalIndex(vg, ix, soorten){
  const st0 = vg.idx = vg.idx || {};
  for(const soort of soorten){
    const st = st0[soort] = st0[soort] || { offset:0, klaar:false };
    while(!st.klaar){
      if(S.stop) throw stopFout();
      zet(null, 'Namen ophalen (' + soort + ')');
      const r = await vraagMetTest('idindex', { soort, offset:st.offset, paginas:10 }, 'Namen ' + soort + ' vanaf ' + nf(st.offset));
      (r.lijst || []).forEach(x => { if(x && x[0]) ix[SOORT[soort]][x[0]] = x[1]; });
      await WH.catZet(INDEX, ix);
      if(r.volgende == null) st.klaar = true; else st.offset = r.volgende;
      await WH.catZet(VOORTGANG, vg);
      if(!st.klaar) await pauze(r.wachtSec);
    }
  }
}

/* ---------- belangrijke producten (laag 1–3 van Poort 0.4) → idproduct ---------- */
async function belangrijk(ix){
  if(!window.WHPD) throw new Error('Productdata is niet geladen.');
  if(!(WHPD.S && WHPD.S.klaar)) await (window.WHTAAK ? WHTAAK.pdLaden() : WHPD.laad());
  if(WHPD.S.fout) throw WHPD.S.fout;
  const codes = WHPD.lijst('belangrijk', false);
  const opCode = {}, opLaag = {};
  Object.keys(ix.p).forEach(id => { const c = ix.p[id]; if(c){ opCode[c] = +id; opLaag[String(c).toLowerCase()] = +id; } });
  const cat = (WHPD.S.cat && WHPD.S.cat.ids) || {};   // reserve: id's uit wh-pq-cat (producten met voorraad)
  const lijst = [], zonder = [];
  codes.forEach(c => { const id = opCode[c] || opLaag[String(c).toLowerCase()] || +cat[c] || 0; if(id > 0) lijst.push([id, c]); else zonder.push(c); });
  return { lijst, zonder };
}

/* ---------- per product: historielicht met idproduct; vol → verder vanaf laatste ---------- */
async function haalProduct(vg, id, code, wat){
  const pr = vg.pr;
  pr.o = pr.o || {};
  let off = pr.o[id] || 0, nieuw = 0;
  for(;;){
    // Picqer geeft de geschiedenis nieuwste-eerst: we lopen de pagina's af met offset, de volgorde maakt niet uit
    const r = await vraagMetTest('historielicht', { sinds:START, tot:pr.tot, paginas:PAGINAS, idproduct:id, offset:off }, wat);
    S.n.vragen++;
    if((r.historie || []).some(h => h && h.idproduct && +h.idproduct !== +id)) throw Object.assign(new Error('Picqer gaf verplaatsingen van andere producten terug (idproduct genegeerd?). Gestopt; dit antwoord is niet bewaard.'), { soort:'picqer' });
    const hist = (r.historie || []).filter(h => h && h.change_type === 'movement' && +h.idproduct === +id);
    nieuw += await voegToe(converteer(hist));
    if(r.volgende == null){ delete pr.o[id]; pr.p[id] = pr.tot; return nieuw; }
    pr.o[id] = off = r.volgende;
    await bewaar(vg, false);
    await pauze(r.wachtSec);
  }
}

async function haal(){
  if(S.bezig) return;
  Object.assign(S, { bezig:true, stop:false, wachten:false, fout:'', klaar:'', eta:'', diag:'', test:'', log:[], bewaard:Date.now(), n:{ vragen:0, rijen:0 } });
  KW = {};
  zet(1, 'Starten…');
  let vg = null;
  const t0 = Date.now();
  try{
    await test();
    const oud = await WH.catHaal(VOORTGANG);
    vg = (oud && oud.data) || {};
    const io = await WH.catHaal(INDEX);
    const ix = Object.assign({ p:{}, l:{}, u:{} }, (io && io.data) || {});
    // (a) namen: producten, daarna locaties en gebruikers
    zet(2, 'Namen ophalen');
    await haalIndex(vg, ix, ['producten', 'locaties', 'gebruikers']);
    // (b) belangrijke producten → idproduct
    zet(4, 'Belangrijke producten zoeken');
    const { lijst, zonder } = await belangrijk(ix);
    if(zonder.length) log(nf(zonder.length) + ' zonder idproduct: ' + zonder.slice(0, 8).join(', ') + (zonder.length > 8 ? ' …' : ''));
    // (c) per product; een afgeronde ronde begint opnieuw met tot = nu (alleen wat er sindsdien bij kwam)
    const pr = vg.pr = vg.pr || {};
    if(!pr.tot || pr.klaar){ pr.tot = fmt(Date.now()); pr.klaar = false; pr.fout = {}; }
    pr.p = pr.p || {}; pr.fout = pr.fout || {};
    const M = lijst.length, tP = Date.now();
    let gedaan = 0, reeks = 0;
    for(let i = 0; i < M; i++){
      const [id, code] = lijst[i];
      if((pr.p[id] || '') >= pr.tot) continue;
      if(S.stop) throw stopFout();
      const rest = M - i, per = gedaan ? (Date.now() - tP) / gedaan : (PAUZE + 4) * 1000;
      S.eta = ' · nog ca. ' + nf(Math.max(1, Math.ceil(rest * per / 6e4))) + ' min';
      zet(5 + 90 * i / Math.max(1, M), 'Product ' + nf(i + 1) + ' van ' + nf(M));
      try{
        S.n.rijen += await haalProduct(vg, id, code, 'Product ' + nf(i + 1) + ' van ' + nf(M) + ' (' + code + ')');
        delete pr.fout[id]; reeks = 0;
      }catch(e){
        if(hard(e)) throw e;
        pr.fout[id] = e.message.slice(0, 200); reeks++;
        log('Product ' + code + ' overgeslagen: ' + e.message);
        if(reeks >= REEKS_MAX) throw Object.assign(new Error(REEKS_MAX + ' producten achter elkaar mislukt. Gestopt; de voortgang is bewaard.'), { soort:'reeks' });
      }
      gedaan++;
      await bewaar(vg, false);
      if(i < M - 1) await pauze(0);
    }
    const mislukt = Object.keys(pr.fout).length;
    pr.klaar = !mislukt;
    await bewaar(vg, true);
    S.klaar = 'Klaar: ' + nf(M) + ' producten · ' + nf(M - mislukt) + ' compleet · ' + nf(mislukt) + ' mislukt · ' + nf(zonder.length) + ' zonder id · ' + nf(S.n.rijen) + ' nieuwe verplaatsingen · ' + nf(S.n.vragen) + ' vragen · ' + nf(Math.round((Date.now() - t0) / 6e4)) + ' min';
    S.eta = ''; zet(100, '');
  }catch(e){
    if(e && e.soort === 'stop') S.klaar = 'Gestopt. De voortgang is bewaard; de knop gaat verder.';
    else{ S.fout = (e && e.message) || String(e); log('Gestopt: ' + S.fout); }
  }finally{
    if(vg) try{ await bewaar(vg, true); }catch(e){ S.fout = (S.fout ? S.fout + ' · ' : '') + 'Opslaan mislukt: ' + ((e && e.message) || e); }
    S.bezig = false; teken();
  }
}

/* ---------- scherm ---------- */
function zet(pct, tekst){ if(pct != null) S.pct = pct; if(tekst != null) S.tekst = tekst; teken(); }
function binnen(){
  return `<div class="row between wrap"><div><h3>Geschiedenis ophalen</h3>
    <div class="small muted mt4">${S.bezig ? esc(S.tekst || 'Bezig…') + (S.wachten ? '' : esc(S.eta)) + '<br>Laat dit scherm open.' : S.fout ? '<span style="color:var(--bad)">' + esc(S.fout) + '</span> Druk nog eens: het gaat verder waar het bleef.' : S.klaar ? esc(S.klaar) : 'Haalt de verplaatsingen sinds 2025 van de belangrijke producten (laag 1–3) uit Picqer (alleen lezen) en bewaart ze in de database.'}</div></div>
    ${S.bezig ? '<button class="btn" data-hist="stop">Stop</button>' : '<button class="btn" data-hist="haal">Geschiedenis ophalen</button>'}</div>
    ${S.test ? `<div class="tiny muted mt8">${esc(S.test)}</div>` : ''}
    ${S.diag && S.bezig ? `<div class="tiny muted mt4">${esc(S.diag)}</div>` : ''}
    ${S.fout && !S.bezig && S.log.length ? `<div class="tiny muted mt8" style="white-space:pre-wrap;word-break:break-word">${esc(S.log.join('\n'))}</div>` : ''}
    ${S.bezig ? `<div style="height:8px;background:#e6eaf0;border-radius:4px;margin-top:12px;overflow:hidden"><div style="height:100%;width:${Math.round(S.pct)}%;background:var(--blue)"></div></div>` : ''}`;
}
function teken(){ const e = $('hist-kaart'); if(e) e.innerHTML = binnen(); }
function kaart(){ return isDaan() ? `<div class="card" id="hist-kaart" style="border-left:4px solid var(--blue)">${binnen()}</div>` : ''; }

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-hist]');
  if(b && b.dataset.hist === 'haal'){ e.preventDefault(); haal(); }
  if(b && b.dataset.hist === 'stop'){ e.preventDefault(); S.stop = true; }
});

return { kaart, haal, S, converteer };
})();
