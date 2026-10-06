/* =====================================================================
   IVOL Warehouse — gegevens bewaren op het apparaat (7-10-2026)
   Supabase Free heeft 5 GB dataverkeer per maand. Elke app haalde bij elk
   openen (en Junior elke 5 minuten) alle producten, verkoop, backorders en
   catalogusrijen opnieuw op. Nu:
     1. eerst een "vingerafdruk" per tabel (aantal rijen + laatste wijziging, een paar bytes)
     2. alleen als die veranderd is de hele tabel ophalen; anders de kopie op dit apparaat
     3. catalogusrijen (wh-*, catalog-ean): alleen rijen met een nieuwe updated_at
   Lukt de kopie niet (privévenster, oude browser): gewoon alles ophalen zoals vroeger.
   ===================================================================== */
window.WHC = (function(){
'use strict';
const URL_ = 'https://jarbgetbwkjtxwtcfwmq.supabase.co';
const KEY  = 'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA';
const H    = { apikey:KEY, Authorization:'Bearer ' + KEY };
const STAT = { tabelVers:0, tabelKopie:0, catVers:0, catKopie:0 };

/* ---------- IndexedDB ---------- */
let dbP = null;
function db(){
  if(dbP) return dbP;
  dbP = new Promise((ok, nee) => {
    try{
      const r = indexedDB.open('ivol-warehouse-cache', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => nee(r.error);
      r.onblocked = () => nee(new Error('blocked'));
    }catch(e){ nee(e); }
  }).catch(() => null);
  return dbP;
}
async function lees(k){
  const d = await db(); if(!d) return null;
  return new Promise(ok => {
    try{ const r = d.transaction('kv', 'readonly').objectStore('kv').get(k); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); }
    catch(e){ ok(null); }
  });
}
async function schrijf(k, v){
  const d = await db(); if(!d) return;
  return new Promise(ok => {
    try{ const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => ok(); t.onerror = () => ok(); t.onabort = () => ok(); }
    catch(e){ ok(); }
  });
}

/* ---------- Supabase ---------- */
async function get(path, extra){
  const res = await fetch(URL_ + '/rest/v1/' + path, { headers:Object.assign({}, H, extra || {}) });
  const t = await res.text();
  if(!res.ok){ const e = new Error(res.status + ' ' + t.slice(0, 240)); e.status = res.status; e.body = t; throw e; }
  return { rows:t ? JSON.parse(t) : null, res };
}
async function alles(table, qs){
  const out = [];
  for(let from = 0; ; from += 1000){
    const { rows } = await get(table + '?' + qs, { Range:from + '-' + (from + 999), 'Range-Unit':'items' });
    out.push(...rows);
    if(rows.length < 1000) break;
  }
  return out;
}
// aantal rijen + nieuwste waarde van de tijdkolommen
async function vinger(table, kolommen){
  const delen = await Promise.all(kolommen.map(async (k, i) => {
    const { rows, res } = await get(table + '?select=' + k + '&order=' + k + '.desc.nullslast&limit=1', i === 0 ? { Prefer:'count=exact' } : undefined);
    const tel = i === 0 ? ((res.headers.get('content-range') || '').split('/')[1] || '?') : '';
    return (rows && rows[0] ? rows[0][k] : '') + (i === 0 ? '#' + tel : '');
  }));
  return delen.join('|');
}

/* Tabel ophalen, of de kopie als er niets veranderd is.
   kolommen = tijdkolommen die bij elke wijziging worden bijgewerkt (bv. ['updated_at']) */
async function tabel(table, qs, kolommen){
  const sleutel = 't|' + table + '|' + qs;
  let v = null;
  try{ v = await vinger(table, kolommen); }catch(e){ if(e.status === 404 || /PGRST205|42P01/.test(e.body || '')) throw e; v = null; }
  if(v && !v.includes('#?')){
    const c = await lees(sleutel);
    if(c && c.v === v && Array.isArray(c.rows)){ STAT.tabelKopie++; return c.rows; }
  }
  const rows = await alles(table, qs);
  STAT.tabelVers++;
  if(v) schrijf(sleutel, { v, rows, op:Date.now() });
  return rows;
}

/* Catalogusrijen: eerst alleen key + updated_at, dan alleen de gewijzigde rijen met data */
const inLijst = keys => encodeURIComponent(keys.map(k => '"' + String(k).replace(/"/g, '') + '"').join(','));
async function catalog(keys){
  const { rows:lijst } = await get('catalog?key=in.(' + inLijst(keys) + ')&select=key,updated_at');
  const uit = [], halen = [];
  for(const r of lijst || []){
    const c = await lees('c|' + r.key);
    if(c && r.updated_at && c.updated_at === r.updated_at){ uit.push(c); STAT.catKopie++; }
    else halen.push(r.key);
  }
  if(halen.length){
    const { rows } = await get('catalog?key=in.(' + inLijst(halen) + ')&select=key,data,updated_at');
    (rows || []).forEach(r => { uit.push(r); STAT.catVers++; if(r.updated_at) schrijf('c|' + r.key, r); });
  }
  return uit;
}

return { tabel, catalog, STAT };
})();
