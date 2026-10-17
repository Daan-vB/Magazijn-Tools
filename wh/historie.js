/* =====================================================================
   IVOL Warehouse 3.0 — Picqer-geschiedenis ophalen (17-10-2026, alleen lezen)
   Haalt verplaatsingen (vanaf 2025-01-01) en ontvangsten op via de bestaande functie "picqer" (WHLIVE.vraag, koppelcode zoals Vandaag)
   en bewaart ze compact per kwartaal in nieuwe catalog-rijen. Geen enkel scherm laadt deze rijen; alleen de export leest ze.
     wh-vp-hist-2025q1 …  { v, kw, rows:[[id, tijd, iduser, idproduct, aantal, van-idlocation, naar-idlocation, idwarehouse]], p:{idproduct:code}, l:{idlocation:naam}, u:{iduser:naam} }
                          (van/naar 0 = geen specifieke locatie)
     wh-ont-hist-2025q1 … { v, kw, rows:[[id, nummer, inkooporder, status, aangemaakt, klaar, wie, [[code, aantal], …]]] }
     wh-hist-voortgang    { vp:{ cursor, vensters:[[van, tot, regels, vol]], klaar, op }, ont:{ n, op } }   (hervatten)
   De functie heeft geen eindtijd: elke vraag geeft de eerste 6000 regels vanaf "sinds". Is het antwoord vol, dan telt alleen wat zeker
   compleet is en begint het volgende venster op het laatste moment (het venster is dan zo klein als nodig).
   ===================================================================== */
window.WHHIST = (function(){
'use strict';
const { $, esc, nf, toast } = WH;
const START = '2025-01-01 00:00:00';
const PAUZE = 15, FOUT_WACHT = 65, POGINGEN = 8, DRIE_DAGEN = 3 * 864e5;   // seconden
const VOORTGANG = 'wh-hist-voortgang';
const S = { eta:'', bezig:false, pct:0, tekst:'', fout:'', klaar:'', stop:false };

const wacht = ms => new Promise(r => setTimeout(r, ms));
const isDaan = () => { try{ return (localStorage.getItem('ivol-ik') || 'Daan') === 'Daan'; }catch(e){ return true; } };
const kwVan = t => { const m = String(t || '').match(/^(\d{4})-(\d{2})/); return m ? m[1] + 'q' + (Math.floor((+m[2] - 1) / 3) + 1) : null; };
const ms = t => new Date(String(t || '').replace(' ', 'T')).getTime();
const stempel = t => String(t || '').replace('T', ' ').slice(0, 19);
const plus1s = t => { const d = new Date(ms(t) + 1000), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()); };

/* ---------- vragen: bij een fout (429, 5xx, net) 65 s wachten en hetzelfde venster opnieuw, tot 8 keer ---------- */
async function wachtMet(sec, tekst){
  for(let i = sec; i > 0 && !S.stop; i--){ zet(null, tekst.replace('{s}', i)); await wacht(1000); }
}
async function vraag(actie, params){
  for(let poging = 1; ; poging++){
    try{ return await WHLIVE.vraag(actie, params); }
    catch(e){
      if(e && (e.soort === 'code' || e.soort === 'jwt')) throw e;
      if(poging >= POGINGEN) throw e;
      await wachtMet(FOUT_WACHT, 'Picqer vraagt even te wachten… nog {s} s (poging ' + poging + ' van ' + POGINGEN + ' mislukt)');
    }
  }
}

/* ---------- verplaatsingen: één regel per verplaatsing, met id's in plaats van namen ---------- */
function verplaatsingRijen(r){
  const L = {}, P = {}, U = {};
  (r.locaties || []).forEach(l => { if(l && l.idlocation) L[l.idlocation] = { n:l.name || ('#' + l.idlocation), w:l.idwarehouse || 0 }; });
  (r.producten || []).forEach(p => { if(p && p.idproduct) P[p.idproduct] = p.productcode || ('#' + p.idproduct); });
  (r.gebruikers || []).forEach(u => { if(u && u.iduser) U[u.iduser] = [u.firstname, u.lastname].filter(Boolean).join(' ') || u.username || ('#' + u.iduser); });
  return { L, P, U };
}
function converteer(hist, ix){
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
    const w = (ix.L[h.idlocation] || ix.L[h.contra_idlocation] || {}).w || 0;
    rows.push([h.idproduct_location_stock_history, tijd, h.iduser || 0, h.idproduct, Math.abs(n), van, naar, w]);
  });
  return rows;
}
const sleutelVp = r => [r[3], r[1], r[5], r[6], r[4]].join('|');

async function bewaarKwartalen(prefix, rijen, tijdVan, sleutel, index){
  const per = {};
  rijen.forEach(r => { const k = kwVan(tijdVan(r)); if(k) (per[k] = per[k] || []).push(r); });
  for(const k of Object.keys(per).sort()){
    const key = prefix + k;
    const oud = await WH.catHaal(key);
    const m = new Map(); (((oud && oud.data) || {}).rows || []).forEach(r => m.set(sleutel(r), r));
    per[k].forEach(r => m.set(sleutel(r), r));
    const rows = [...m.values()].sort((a, b) => String(tijdVan(a)).localeCompare(String(tijdVan(b))));
    const data = { v:1, kw:k, rows };
    if(index){
      const o = (oud && oud.data) || {};
      const p = Object.assign({}, o.p, index.P), l = Object.assign({}, o.l, index.l), u = Object.assign({}, o.u, index.u);
      const pg = {}, lg = {}, ug = {};
      rows.forEach(r => { if(p[r[3]]) pg[r[3]] = p[r[3]]; if(l[r[5]]) lg[r[5]] = l[r[5]]; if(l[r[6]]) lg[r[6]] = l[r[6]]; if(u[r[2]]) ug[r[2]] = u[r[2]]; });
      data.p = pg; data.l = lg; data.u = ug;
    }
    await WH.catZet(key, data);
  }
}

async function haalVerplaatsingen(vg){
  const vp = vg.vp = vg.vp || { cursor:START, vensters:[], klaar:false };
  const begin = ms(vp.cursor), t0 = Date.now();
  while(!S.stop){
    const r = await vraag('verplaatsingen', { sinds:vp.cursor });
    const hist = (r.historie || []).filter(h => h && h.change_type === 'movement');
    const max = hist.reduce((m, h) => h.changed_at && h.changed_at > m ? h.changed_at : m, '');
    const nu = ms(r.opgehaald) || Date.now();
    const vol = !!r.vol || (!!max && nu - ms(max) > DRIE_DAGEN);        // de functie meldt vol alleen als alle 6000 regels verplaatsingen zijn
    let nuttig = hist;
    if(vol && max){                                                       // laatste moment kan half zijn: het volgende venster begint daar
      const zonder = hist.filter(h => h.changed_at !== max);
      nuttig = zonder.length ? zonder : hist;
    }
    const ix = verplaatsingRijen(r);
    const rows = converteer(nuttig, ix);
    await bewaarKwartalen('wh-vp-hist-', rows, x => x[1], sleutelVp, { P:ix.P, l:Object.fromEntries(Object.entries(ix.L).map(([k, v]) => [k, v.n])), u:ix.U });
    const van = vp.cursor;
    const volgende = !vol || !max ? null : (nuttig === hist && hist.every(h => h.changed_at === max) ? plus1s(max) : stempel(max));
    vp.vensters.push([van.slice(0, 16), (max || van).slice(0, 16), rows.length, vol ? 1 : 0]);
    vp.op = new Date().toISOString();
    const nieuwGeen = !hist.length || (volgende && volgende === van);
    if(!vol || nieuwGeen){ vp.klaar = true; vp.cursor = stempel(max || van); await WH.catZet(VOORTGANG, vg); break; }
    vp.cursor = volgende;
    await WH.catZet(VOORTGANG, vg);
    const deel = Math.max(0.001, Math.min(1, (ms(vp.cursor) - begin) / Math.max(1, nu - begin))), min = Math.ceil((Date.now() - t0) / deel * (1 - deel) / 6e4 + PAUZE / 60);
    S.eta = ' · nog ca. ' + nf(min) + ' min';
    zet(Math.max(1, Math.min(90, deel * 90)), 'Verplaatsingen tot ' + vp.cursor.slice(0, 10));
    await wachtMet(PAUZE, 'Verplaatsingen tot ' + vp.cursor.slice(0, 10) + ' · volgende vraag over {s} s');
  }
}

/* ---------- ontvangsten: de functie geeft de 40 nieuwste vanaf een datum; dat is wat er te halen is ---------- */
async function haalOntvangsten(vg){
  zet(92, 'Ontvangsten');
  const r = await vraag('ontvangstenlijst', { sinds:START.slice(0, 10) });
  const rows = (r.ontvangsten || []).map(o => [o.id, o.nummer || '', o.inkooporder || '', o.status || '', String(o.aangemaakt || '').replace(' ', 'T'), String(o.klaar || '').replace(' ', 'T'), o.wie || '',
    (o.producten || []).map(p => [p.code, p.aantal])]);
  await bewaarKwartalen('wh-ont-hist-', rows, x => x[4] || x[5], x => x[0], null);
  vg.ont = { n:rows.length, op:new Date().toISOString() };
  await WH.catZet(VOORTGANG, vg);
  return rows.length;
}

async function haal(){
  if(S.bezig) return;
  S.bezig = true; S.stop = false; S.fout = ''; S.klaar = ''; S.eta = ''; zet(1, 'Starten…');
  try{
    const oud = await WH.catHaal(VOORTGANG);
    const vg = (oud && oud.data) || {};
    if(vg.vp && vg.vp.klaar) vg.vp.klaar = false;                        // nieuwe ronde: verder vanaf de cursor
    await haalVerplaatsingen(vg);
    const o = await haalOntvangsten(vg);
    const vp = vg.vp, v = vp.vensters;
    S.klaar = nf(v.length) + ' vensters · ' + nf(v.reduce((s, x) => s + x[2], 0)) + ' verplaatsingen (' + nf(v.filter(x => x[3]).length) + ' vol) · ' + nf(o) + ' ontvangsten';
    zet(100, '');
  }catch(e){ S.fout = (e && e.message) || String(e); }
  finally{ S.bezig = false; teken(); }
}

/* ---------- scherm ---------- */
function zet(pct, tekst){ if(pct != null) S.pct = pct; if(tekst != null) S.tekst = tekst; teken(); }
function binnen(){
  return `<div class="row between wrap"><div><h3>Geschiedenis ophalen</h3>
    <div class="small muted mt4">${S.bezig ? esc(S.tekst || 'Bezig…') + esc(S.eta) + '<br>Laat dit scherm open: het kan een uur duren.' : S.fout ? '<span style="color:var(--bad)">' + esc(S.fout) + '</span> Druk nog eens: het gaat verder waar het bleef.' : S.klaar ? esc(S.klaar) : 'Haalt verplaatsingen en ontvangsten sinds 2025 uit Picqer (alleen lezen) en bewaart ze in de database.'}</div></div>
    <button class="btn" data-hist="haal" ${S.bezig ? 'disabled' : ''}>Geschiedenis ophalen</button></div>
    ${S.bezig ? `<div style="height:8px;background:#e6eaf0;border-radius:4px;margin-top:12px;overflow:hidden"><div style="height:100%;width:${Math.round(S.pct)}%;background:var(--blue)"></div></div>` : ''}`;
}
function teken(){ const e = $('hist-kaart'); if(e) e.innerHTML = binnen(); }
function kaart(){ return isDaan() ? `<div class="card" id="hist-kaart" style="border-left:4px solid var(--blue)">${binnen()}</div>` : ''; }

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-hist]');
  if(b && b.dataset.hist === 'haal'){ e.preventDefault(); haal(); }
});

return { kaart, haal, S, converteer, verplaatsingRijen };
})();
