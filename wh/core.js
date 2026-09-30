/* =====================================================================
   IVOL Warehouse — core: hulpjes, database, gegevens laden, imports
   Zelfde Supabase-project als Containerplanning en Palletlabels.
   Nieuwe gegevens staan als rijen in tabel `catalog` (key → data jsonb):
     wh-locaties   Picqer-locatie-export (naam, bulk, tijdelijk, exclusief, bovenliggend, productcodes)
     wh-pq         extra Picqer-productvelden: [aanvulniveau, vul aan tot, virtueel]
     wh-advies     laatst ingelezen Picqer-aanvuladvies (PDF)
     wh-aanvul     aanvulbase: per product bevestigde of aangepaste instellingen
     wh-taken      afgevinkte taken, verplaatsingen, dagritme, notities
   ===================================================================== */
window.WH = (function(){
'use strict';
const URL_ = 'https://jarbgetbwkjtxwtcfwmq.supabase.co';
const KEY  = 'sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA';
const H    = { apikey:KEY, Authorization:'Bearer ' + KEY };
const CAT_KEYS = ['wh-locaties', 'wh-vst-locaties', 'wh-vst-locaties-vorige', 'wh-pq', 'wh-advies', 'wh-aanvul', 'wh-taken', 'wh-triage', 'wh-voorraad', 'wh-vst-voorraad', 'wh-verkoop-mnd', 'wh-bo-vorige'];
if(window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/* ---------- hulpjes ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const leeg = v => v === null || v === undefined || v === '';
function num(v){
  if(leeg(v)) return null;
  if(typeof v === 'number') return isNaN(v) ? null : v;
  if(typeof v === 'boolean') return null;
  let s = String(v).trim().replace(/\s/g, '').replace(/[,.;:]+$/, '');
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if(lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if(lc > -1) s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
const txt = v => leeg(v) ? null : (String(v).trim() || null);
const bool = v => v === true || /^(true|ja|yes|1|waar)$/i.test(String(v ?? '').trim());
const nf = (n, d = 0) => (n === null || n === undefined || isNaN(n)) ? '–' : Number(n).toLocaleString('nl-NL', { maximumFractionDigits:d });
const plural = (n, een, meer) => nf(n) + ' ' + (n === 1 ? een : meer);
const dd = n => String(n).padStart(2, '0');
const isoDag = d => { d = d ? new Date(d) : new Date(); return d.getFullYear() + '-' + dd(d.getMonth() + 1) + '-' + dd(d.getDate()); };
const vandaag = () => isoDag(new Date());
function fdate(d, opt){
  if(!d) return '';
  const dt = new Date(String(d).length <= 10 ? d + 'T12:00:00' : d);
  if(isNaN(dt)) return String(d);
  return dt.toLocaleDateString('nl-NL', opt || { weekday:'short', day:'numeric', month:'short' });
}
const fdt = d => d ? new Date(d).toLocaleString('nl-NL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
const dagenOud = d => d ? (Date.now() - new Date(d).getTime()) / 864e5 : null;
function toast(msg, ms){
  const t = $('toast'); if(!t) return; t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms || 2600);
}
function setSync(t, cls){ const s = $('sync'); if(s){ s.textContent = t; s.className = 'sync ' + (cls || ''); } }
function setSaved(t){ const s = $('saved'); if(s) s.textContent = t || ''; }

/* ---------- database ---------- */
async function api(method, path, body, extra){
  const headers = Object.assign({}, H, extra || {});
  if(body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(URL_ + '/rest/v1/' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await res.text();
  if(!res.ok){ const e = new Error(res.status + ' ' + t.slice(0, 240)); e.status = res.status; e.body = t; throw e; }
  return t ? JSON.parse(t) : null;
}
async function getAll(table, qs){
  const out = [];
  for(let from = 0; ; from += 1000){
    const rows = await api('GET', table + '?' + qs, undefined, { Range:from + '-' + (from + 999), 'Range-Unit':'items' });
    out.push(...rows);
    if(rows.length < 1000) break;
  }
  return out;
}
async function upsert(table, rows, onConflict, prog){
  for(let i = 0; i < rows.length; i += 500){
    if(prog) prog(i, rows.length);
    await api('POST', table + (onConflict ? '?on_conflict=' + onConflict : ''), rows.slice(i, i + 500), { Prefer:'resolution=merge-duplicates,return=minimal' });
  }
}
const isMissing = e => !!e && (e.status === 404 || /PGRST205|42P01|does not exist|Could not find the table/i.test(e.body || ''));

let MODE = 'wh';
async function catZet(key, data){
  const rij = m => [{ key, mode:m, data, updated_at:new Date().toISOString() }];
  try{ await api('POST', 'catalog?on_conflict=key', rij(MODE), { Prefer:'resolution=merge-duplicates,return=minimal' }); }
  catch(e){
    if(MODE === 'wh' && /23514|check|mode/i.test(e.body || '')){ MODE = 'ean'; return catZet(key, data); }
    throw e;
  }
  D.catTijd[key] = new Date().toISOString();
}
async function catHaal(key){
  const r = await api('GET', 'catalog?key=eq.' + encodeURIComponent(key) + '&select=data,updated_at');
  return r && r.length ? r[0] : null;
}
// kleine wijziging in een map (wh-aanvul, wh-taken): eerst de nieuwste versie ophalen, dan samenvoegen
// (iPhone en Mac tegelijk overschrijven elkaar zo niet)
const PATCH_Q = {};
function catPatch(key, patch){
  const vorige = PATCH_Q[key] || Promise.resolve();
  const p = vorige.catch(() => {}).then(async () => {
    setSaved('Opslaan…');
    const r = await catHaal(key);
    const d = (r && r.data) || {};
    Object.entries(patch).forEach(([k, v]) => { if(v === null) delete d[k]; else d[k] = v; });
    await catZet(key, d);
    const veld = { 'wh-aanvul':'AANVUL', 'wh-taken':'TAKEN', 'wh-triage':'TRIAGE' }[key];
    if(veld) D[veld] = d;
    setSaved('Opgeslagen ' + new Date().toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }));
    return d;
  });
  PATCH_Q[key] = p;
  return p.catch(e => { setSaved(''); toast('Opslaan mislukt: ' + e.message, 6000); throw e; });
}

/* ---------- gegevens in het geheugen ---------- */
const D = {
  P:{}, PLOW:{}, VK:{}, BO:[], GEH:{}, CONT:[],
  LOC:{}, LOCDATUM:null, VSTLOC:{}, VSTDATUM:null, VSTLOCVORIG:{}, PQ:{}, PQDATUM:null, ADV:null, AANVUL:{}, TAKEN:{}, TRIAGE:{},
  VR:{}, VRDATUM:null, VSTVR:{}, VSTVRDATUM:null, VKM:null, BOVORIG:null, PAL:{},
  catTijd:{}, missend:[], geladen:0, fout:null
};
const PROD_SEL = 'productcode,naam,leverancier,leverancier_code,ean,locaties_hm,voorraad_hm,gereserveerd_hm,vrij_hm,voorraad_vst,abc,actief,tags,eenheid,palletmaat,picqer_datum,plaatsen,max_per_ligger,gewicht_kg,hoogte_cm,opmerking';
async function load(){
  setSync('laden…');
  D.missend = [];
  const safe = (t, p) => p.catch(e => { if(isMissing(e)){ D.missend.push(t); return []; } throw e; });
  try{
    const keys = ['catalog-ean'].concat(CAT_KEYS).map(k => '"' + k + '"').join(',');
    const [prod, cat, vk, bo, co] = await Promise.all([
      safe('producten', getAll('producten', 'select=' + PROD_SEL + '&order=productcode').catch(e => /column/i.test(e.body || '') ? getAll('producten', 'select=*&order=productcode') : Promise.reject(e))),
      api('GET', 'catalog?key=in.(' + encodeURIComponent(keys) + ')&select=key,data,updated_at'),
      safe('verkoop', getAll('verkoop', 'select=*')),
      safe('backorders', getAll('backorders', 'select=*')),
      safe('containers', getAll('containers', 'select=id,leverancier,pakbon_ref,containernummer,losdatum,lostijd,status,updated_at,verwacht:data->verwacht,regels:data->regels,voorboekingen:data->voorboekingen,geleverd:data->geleverd,verdeling:data->verdeling&order=losdatum'))
    ]);
    D.P = {}; D.PLOW = {};
    prod.forEach(r => { if(!r.productcode) return; D.P[r.productcode] = r; D.PLOW[r.productcode.toLowerCase()] = r.productcode; });
    D.VK = {}; vk.forEach(r => D.VK[r.productcode] = r);
    D.BO = bo;
    D.CONT = co || [];
    const C = {}; (cat || []).forEach(r => { C[r.key] = r.data; D.catTijd[r.key] = r.updated_at; });
    D.GEH = {};
    Object.values(C['catalog-ean'] || {}).forEach(x => {
      if(!x || !x.sub) return;
      const k = String(x.sub).trim().toLowerCase();
      (D.GEH[k] = D.GEH[k] || []).push(x);
    });
    zetLocaties(C['wh-locaties']);
    zetPQ(C['wh-pq']);
    D.VSTLOC = {}; D.VSTDATUM = C['wh-vst-locaties'] ? C['wh-vst-locaties'].datum : null;
    ((C['wh-vst-locaties'] || {}).rows || []).forEach(([pal, codes]) => String(codes).split('|').forEach(c => (D.VSTLOC[c] = D.VSTLOC[c] || []).push(pal)));
    D.VSTLOCVORIG = {};
    ((C['wh-vst-locaties-vorige'] || {}).rows || []).forEach(([pal, codes]) => String(codes).split('|').forEach(c => (D.VSTLOCVORIG[c] = D.VSTLOCVORIG[c] || []).push(pal)));
    zetVoorraad(C['wh-voorraad']);
    zetVstVoorraad(C['wh-vst-voorraad']);
    D.VKM = C['wh-verkoop-mnd'] || null;
    D.BOVORIG = C['wh-bo-vorige'] || null;
    D.ADV = C['wh-advies'] || null;
    D.AANVUL = C['wh-aanvul'] || {};
    D.TAKEN = C['wh-taken'] || {};
    D.TRIAGE = C['wh-triage'] || {};
    D.geladen = Date.now(); D.fout = null;
    if(window.WHL) WHL.reset();
    if(window.WHB) WHB.reset();
    setSync('verbonden', 'ok');
    return true;
  }catch(e){
    D.fout = e;
    setSync('fout', 'err');
    return false;
  }
}
function zetLocaties(d){
  D.LOC = {}; D.LOCDATUM = d ? d.datum : null;
  if(!d || !d.rows) return;
  d.rows.forEach(r => {
    const [naam, bulk, tijd, excl, parent, codes] = r;
    D.LOC[naam] = { naam, bulk:!!bulk, tijd:!!tijd, excl:!!excl, parent:parent || '', codes:codes ? codes.split('|') : [] };
  });
}
function zetPQ(d){
  D.PQ = {}; D.PQDATUM = d ? d.datum : null;
  if(d && d.m) D.PQ = d.m;
}
// voorraad per locatie (Picqer "stock"-export): per product { locs:{loc:aantal}, geen:aantal op geen specifieke locatie, cont:{kar:aantal} }
function zetVoorraad(d){
  D.VR = {}; D.VRDATUM = d ? d.datum : null;
  ((d && d.rows) || []).forEach(([code, loc, n, cont]) => {
    const c = D.PLOW[String(code).toLowerCase()] || code;
    const v = D.VR[c] = D.VR[c] || { locs:{}, geen:0, cont:{} };
    if(!loc) v.geen += n || 0;
    else if(cont) v.cont['Container ' + loc] = (v.cont['Container ' + loc] || 0) + (n || 0);
    else v.locs[loc] = (v.locs[loc] || 0) + (n || 0);
  });
}
function zetVstVoorraad(d){
  D.VSTVR = {}; D.VSTVRDATUM = d ? d.datum : null;
  ((d && d.rows) || []).forEach(([code, pal, n]) => {
    const c = D.PLOW[String(code).toLowerCase()] || code;
    (D.VSTVR[c] = D.VSTVR[c] || []).push([pal, n]);
  });
}

/* ---------- bestanden lezen ---------- */
function leesSheet(file){
  return file.arrayBuffer().then(buf => {
    const wb = XLSX.read(buf, { type:'array', cellDates:false });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, blankrows:false, defval:null, raw:true });
  });
}
function soortVan(head){
  const h = head.map(x => String(x ?? '').trim());
  const has = n => h.includes(n);
  if(has('Naam') && has('Bulklocatie') && has('Tijdelijke locatie')) return 'locaties';
  if(has('#') && has('Bestelling/Retour')) return 'backorders';
  if(has('Productcode') && (has('Voorraadlocatie Hoofdmagazijn') || has('Aanvulniveau Hoofdmagazijn'))) return 'producten';
  if(has('Productcode') && has('Voorraadlocatie') && has('Vrije voorraad')) return 'voorraad';
  if(has('Productcode') && has('Aantal')) return 'verkoop';
  return null;
}

/* ---------- import: Picqer-productexport ---------- */
const PROD_MAP = { productcode:'Productcode', naam:'Naam', leverancier:'Leverancier', leverancier_code:'Productcode leverancier', ean:'Barcode',
  gewicht_product_g:'Gewicht', lengte_product_cm:'Lengte', breedte_product_cm:'Breedte', hoogte_product_cm:'Hoogte', actief:'Actief',
  abc:'ABC classificatie', locaties_hm:'Voorraadlocatie Hoofdmagazijn', voorraad_hm:'Voorraad Hoofdmagazijn',
  gereserveerd_hm:'Gereserveerde voorraad Hoofdmagazijn', vrij_hm:'Vrije voorraad Hoofdmagazijn', voorraad_vst:'Voorraad Bulk van Spreuwel', tags:'Tags' };
const PROD_NUM = ['gewicht_product_g','lengte_product_cm','breedte_product_cm','hoogte_product_cm','voorraad_hm','gereserveerd_hm','vrij_hm','voorraad_vst'];
async function impProducten(arr, st){
  const head = (arr[0] || []).map(h => String(h ?? '').trim());
  // "Breedte/Hoogte/Lengte" komen twee keer voor (product + productveld): neem de eerste
  const idx = {}; Object.entries(PROD_MAP).forEach(([k, h]) => idx[k] = head.indexOf(h));
  const iPQ = ['Aanvulniveau Hoofdmagazijn', 'Vul pickvoorraad aan tot Hoofdmagazijn'].map(h => head.indexOf(h));
  const iType = head.indexOf('Type');
  if(idx.productcode < 0) throw new Error('kolom "Productcode" niet gevonden');
  const nu = new Date().toISOString(), rows = [], pq = {}, gezien = new Set(), dubbel = [];
  for(let i = 1; i < arr.length; i++){
    const a = arr[i], code = txt(a[idx.productcode]);
    if(!code) continue;
    const rauw = String(a[idx.productcode]);
    // twee Picqer-codes die alleen in een spatie/tab verschillen (bv. "Outlet-trapleuning8" en "Outlet-trapleuning8<tab>"): één keer opslaan
    if(gezien.has(code)){
      if(rauw !== code){ dubbel.push(JSON.stringify(rauw)); continue; }       // de variant met spatie/tab overslaan
      const j = rows.findIndex(x => x.productcode === code);                  // de schone code wint van een eerdere variant
      if(j >= 0){ dubbel.push(JSON.stringify(rows[j].__rauw)); rows.splice(j, 1); delete pq[code]; }
    }
    gezien.add(code);
    const r = { productcode:code, picqer_datum:nu };
    Object.keys(PROD_MAP).forEach(k => {
      if(k === 'productcode' || idx[k] < 0) return;
      const v = a[idx[k]];
      if(PROD_NUM.includes(k)) r[k] = num(v);
      else if(k === 'actief') r[k] = leeg(v) ? null : bool(v);
      else r[k] = txt(v);
    });
    Object.defineProperty(r, '__rauw', { value:rauw, enumerable:false });
    rows.push(r);
    const lvl = iPQ[0] < 0 ? null : num(a[iPQ[0]]), tot = iPQ[1] < 0 ? null : num(a[iPQ[1]]);
    const virt = iType >= 0 && /virtu|oneindig/i.test(String(a[iType] || ''));
    // [aanvulniveau, vul aan tot, virtueel, exacte Picqer-code als die spaties heeft]
    if(lvl !== null || tot !== null || virt || rauw !== code) pq[code] = [lvl, tot, virt ? 1 : 0].concat(rauw !== code ? [rauw] : []);
  }
  if(!rows.length) throw new Error('geen producten gevonden');
  await upsert('producten', rows, 'productcode', (i, n) => st('Producten opslaan… ' + nf(i) + ' / ' + nf(n)));
  // extra velden: samenvoegen met wat er al stond (een export per leverancier overschrijft de rest niet)
  const oud = await catHaal('wh-pq');
  const m = Object.assign({}, (oud && oud.data && oud.data.m) || {});
  rows.forEach(r => { if(pq[r.productcode]) m[r.productcode] = pq[r.productcode]; else delete m[r.productcode]; });
  await catZet('wh-pq', { datum:nu, m });
  return rows.length + ' producten bijgewerkt (met aanvulniveaus uit Picqer)' + (dubbel.length ? ' · dubbele code overgeslagen: ' + dubbel.join(', ') + ' (in Picqer opruimen)' : '');
}

/* ---------- import: Picqer-locatie-export ---------- */
async function impLocaties(arr, datumBestand){
  const datum = datumBestand || new Date().toISOString();
  const head = (arr[0] || []).map(h => String(h ?? '').trim());
  const c = n => head.indexOf(n);
  const iN = c('Naam'), iP = c('Bovenliggende locatie'), iT = c('Tijdelijke locatie'), iB = c('Bulklocatie'), iC = c('Productcodes'), iE = c('Exclusieve locatie');
  const rows = [];
  for(let i = 1; i < arr.length; i++){
    const a = arr[i], naam = txt(a[iN]); if(!naam) continue;
    const codes = iC >= 0 && a[iC] ? String(a[iC]).split(',').map(s => s.trim()).filter(Boolean).join('|') : '';
    rows.push([naam, bool(a[iB]) ? 1 : 0, bool(a[iT]) ? 1 : 0, iE >= 0 && bool(a[iE]) ? 1 : 0, iP >= 0 ? (txt(a[iP]) || '') : '', codes]);
  }
  if(!rows.length) throw new Error('geen locaties gevonden');
  // Picqer exporteert per magazijn. VST ("Bulk van Spreuwel") = palletnummers (cijfers): apart bewaren, anders overschrijft hij het Hoofdmagazijn
  const numeriek = rows.filter(r => /^\d/.test(r[0])).length;
  if(numeriek > rows.length * 0.6){
    // vorige VST-stand bewaren: zo ziet de app welke palletnummers nieuw zijn (Stockmove van vandaag)
    const oud = await catHaal('wh-vst-locaties');
    if(oud && oud.data && oud.data.rows) await catZet('wh-vst-locaties-vorige', oud.data);
    await catZet('wh-vst-locaties', { datum, rows:rows.filter(r => r[5]).map(r => [r[0], r[5]]) });
    return rows.length + ' VST-palletlocaties ingelezen (Bulk van Spreuwel), ' + rows.filter(r => r[5]).length + ' met product';
  }
  await catZet('wh-locaties', { datum, rows });
  return rows.length + ' locaties Hoofdmagazijn ingelezen';
}

/* ---------- import: backorders ---------- */
async function impBackorders(arr, st){
  const head = (arr[0] || []).map(h => String(h ?? '').trim());
  const col = n => head.indexOf(n);
  ['#', 'Productcode', 'Aantal'].forEach(n => { if(col(n) < 0) throw new Error('kolom "' + n + '" niet gevonden'); });
  const nu = new Date().toISOString(), rows = [];
  for(let i = 1; i < arr.length; i++){
    const a = arr[i], id = num(a[col('#')]); if(!id) continue;
    const bd = a[col('Besteld op')];
    rows.push({ id, bestelling:txt(a[col('Bestelling/Retour')]), leverancier:txt(a[col('Leverancier')]), productcode:txt(a[col('Productcode')]), product:txt(a[col('Product')]),
      aantal:num(a[col('Aantal')]), beschikbaar:num(a[col('Beschikbaar')]), verwacht:txt(a[col('Verwacht')]), magazijn:txt(a[col('Magazijn')]),
      besteld_op:bd && !isNaN(new Date(bd)) ? new Date(bd).toISOString() : null, geimporteerd_op:nu });
  }
  const levs = [...new Set(rows.map(r => r.leverancier).filter(Boolean))];
  st('Oude regels opruimen…');
  if(levs.length >= 8 || !levs.length){
    // vorige stand bewaren: dan laat de app zien wat er is opgelost, wat nog open staat en wat nieuw is
    if(D.BO.length){
      const orders = {};
      D.BO.forEach(r => (orders[r.bestelling] = orders[r.bestelling] || []).push([r.productcode, num(r.aantal), num(r.beschikbaar)]));
      const datum = D.BO.reduce((m, r) => r.geimporteerd_op && (!m || r.geimporteerd_op > m) ? r.geimporteerd_op : m, null);
      await catZet('wh-bo-vorige', { datum, orders });
    }
    // volledige export (Backorders → Exporteer backorders): alles vervangen
    await api('DELETE', 'backorders?id=gt.0', undefined, { Prefer:'return=minimal' });
  }else{
    await api('DELETE', 'backorders?leverancier=in.(' + levs.map(l => '"' + l.replace(/"/g, '') + '"').map(encodeURIComponent).join(',') + ')', undefined, { Prefer:'return=minimal' });
    if(rows.some(r => !r.leverancier)) await api('DELETE', 'backorders?leverancier=is.null', undefined, { Prefer:'return=minimal' });
  }
  await upsert('backorders', rows, 'id', (i, n) => st('Backorders opslaan… ' + i + ' / ' + n));
  return rows.length + ' backorderregels (' + new Set(rows.map(r => r.bestelling)).size + ' orders)';
}

/* ---------- import: Magazijnverkopen ---------- */
async function impVerkoop(arr, van, tot, volledig, st){
  if(!van || !tot || tot < van) throw new Error('vul eerst de periode van de export in');
  const maanden = (new Date(tot) - new Date(van)) / 864e5 / 30.44 + 1 / 30.44;
  const head = (arr[0] || []).map(h => String(h ?? '').trim());
  const ic = head.indexOf('Productcode'), ia = head.indexOf('Aantal'), il = head.indexOf('Leverancier'), im = head.indexOf('Magazijn');
  const som = {}, levVan = {};
  for(let i = 1; i < arr.length; i++){
    const code = txt(arr[i][ic]); if(!code) continue;
    if(im >= 0 && arr[i][im] && !/hoofdmagazijn/i.test(String(arr[i][im]))) continue;
    const c2 = D.PLOW[code.toLowerCase()] || code;
    som[c2] = (som[c2] || 0) + (num(arr[i][ia]) || 0);
    if(il >= 0 && arr[i][il]) levVan[c2] = String(arr[i][il]).trim();
  }
  const nu = new Date().toISOString();
  const rij = (code, a) => ({ productcode:code, leverancier:levVan[code] || (D.P[code] && D.P[code].leverancier) || null, aantal:a, periode_van:van, periode_tot:tot, maanden:+maanden.toFixed(2), per_maand:+(a / maanden).toFixed(2), geimporteerd_op:nu });
  const rows = Object.entries(som).map(([c, a]) => rij(c, a));
  const levs = new Set(Object.values(levVan));
  Object.keys(D.P).forEach(code => {
    if(code in som) return;
    if(volledig || levs.has(D.P[code].leverancier)) rows.push(rij(code, 0));
  });
  await upsert('verkoop', rows, 'productcode', (i, n) => st('Verkoop opslaan… ' + nf(i) + ' / ' + nf(n)));
  return Object.keys(som).length + ' producten met verkoop (' + nf(maanden, 1) + ' maanden)';
}

/* ---------- import: Magazijnverkopen per maand ----------
   Bestandsnaam met de maand erin ("Magazijnverkopen 2026-09.xlsx"). Alle maanden samen in catalog wh-verkoop-mnd
   { maanden:['2025-09', …], v:{ code:[aantal per maand] } }. Daarna rekent de app verkoop/maand opnieuw uit
   (gemiddelde van de laatste 6 maanden) en zet die in tabel verkoop (die Containers ook gebruikt). */
function maandUitNaam(naam){
  const m = /(20\d{2})[-_ ](0[1-9]|1[0-2])(?![-_]?\d)/.exec(String(naam || ''));
  return m ? m[1] + '-' + m[2] : null;
}
async function impVerkoopMaand(arr, ym, st){
  const head = (arr[0] || []).map(h => String(h ?? '').trim());
  const ic = head.indexOf('Productcode'), ia = head.indexOf('Aantal'), im = head.indexOf('Magazijn');
  if(ic < 0 || ia < 0) throw new Error('kolommen Productcode/Aantal niet gevonden');
  const som = {};
  for(let i = 1; i < arr.length; i++){
    const code = txt(arr[i][ic]); if(!code) continue;
    if(im >= 0 && arr[i][im] && !/hoofdmagazijn/i.test(String(arr[i][im]))) continue;
    const c2 = D.PLOW[code.toLowerCase()] || code;
    som[c2] = (som[c2] || 0) + (num(arr[i][ia]) || 0);
  }
  return verkoopMaandenOpslaan({ [ym]:som }, st);
}
async function verkoopMaandenOpslaan(perMaand, st){
  st = st || (() => {});
  const oud = await catHaal('wh-verkoop-mnd');
  const o = (oud && oud.data) || { maanden:[], v:{} };
  // uitpakken naar maand → code → aantal, nieuwe maanden erin, weer inpakken
  const M = {};
  o.maanden.forEach((ym, i) => { M[ym] = {}; Object.entries(o.v).forEach(([c, a]) => { if(a[i]) M[ym][c] = a[i]; }); });
  Object.entries(perMaand).forEach(([ym, som]) => { M[ym] = som; });
  const maanden = Object.keys(M).sort();
  const codes = new Set(); maanden.forEach(ym => Object.keys(M[ym]).forEach(c => codes.add(c)));
  const v = {};
  codes.forEach(c => { v[c] = maanden.map(ym => Math.round((M[ym][c] || 0) * 100) / 100); });
  const data = { maanden, v, datum:new Date().toISOString() };
  st('Maanden opslaan…');
  await catZet('wh-verkoop-mnd', data);
  D.VKM = data;
  // verkoop per maand = gemiddelde van de laatste 6 maanden (lopende maand telt mee als hij bijna vol is)
  const laatste = maanden.slice(-6);
  const idx = laatste.map(ym => maanden.indexOf(ym));
  const van = laatste[0] + '-01';
  const [ly, lm] = laatste[laatste.length - 1].split('-').map(Number);
  const eind = new Date(ly, lm, 0); const tot = eind.getFullYear() + '-' + dd(eind.getMonth() + 1) + '-' + dd(eind.getDate());
  const nu = new Date().toISOString();
  const rows = [];
  const alle = new Set(Object.keys(D.P).concat([...codes]));
  alle.forEach(c => {
    const a = v[c] ? idx.reduce((s, i) => s + (v[c][i] || 0), 0) : 0;
    rows.push({ productcode:c, leverancier:(D.P[c] && D.P[c].leverancier) || null, aantal:a, periode_van:van, periode_tot:tot, maanden:laatste.length, per_maand:+(a / laatste.length).toFixed(2), geimporteerd_op:nu });
  });
  await upsert('verkoop', rows, 'productcode', (i, n) => st('Verkoop per maand opslaan… ' + nf(i) + ' / ' + nf(n)));
  return maanden.length + ' maanden (' + maanden[0] + ' t/m ' + maanden[maanden.length - 1] + '); verkoop/maand = gemiddelde ' + laatste[0] + ' t/m ' + laatste[laatste.length - 1];
}
// verkoop per maand van één product: [[maand, aantal], …]
function maandVerkoop(code){
  if(!D.VKM || !D.VKM.v) return [];
  const a = D.VKM.v[code]; if(!a) return D.VKM.maanden.map(ym => [ym, 0]);
  return D.VKM.maanden.map((ym, i) => [ym, a[i] || 0]);
}

/* ---------- import: voorraad per locatie (Picqer stock-export) ----------
   Eén regel per product per locatie; lege locatie = geen specifieke locatie; Container = retourkar.
   Export van magazijn Bulk van Spreuwel (palletnummers) wordt apart bewaard. */
// exporttijd uit de Picqer-bestandsnaam (stock-20260930061500.xlsx), anders nu
function datumUitNaam(naam){
  const m = /(20\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(String(naam || ''));
  if(!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d) ? null : d.toISOString();
}
async function impVoorraad(arr, datumBestand){
  const head = (arr[0] || []).map(h => String(h ?? '').trim());
  const c = n => head.indexOf(n);
  const iC = c('Productcode'), iL = c('Voorraadlocatie'), iV = c('Voorraad'), iK = c('Container');
  const rows = [];
  for(let i = 1; i < arr.length; i++){
    const a = arr[i], code = txt(a[iC]); if(!code) continue;
    const loc = txt(a[iL]) || '', n = num(a[iV]) || 0, kar = iK >= 0 && bool(a[iK]);
    if(!loc && !n) continue;
    rows.push([code, loc, n, kar ? 1 : 0]);
  }
  if(!rows.length) throw new Error('geen regels gevonden');
  const metLoc = rows.filter(r => r[1] && !r[3]);
  const numeriek = metLoc.filter(r => /^\d+$/.test(r[1])).length;
  const datum = datumBestand || new Date().toISOString();
  if(metLoc.length && numeriek > metLoc.length * 0.6){
    await catZet('wh-vst-voorraad', { datum, rows:rows.filter(r => r[1]).map(r => [r[0], r[1], r[2]]) });
    return nf(numeriek) + ' VST-pallets met voorraad (Bulk van Spreuwel)';
  }
  await catZet('wh-voorraad', { datum, rows });
  const geen = rows.filter(r => !r[1] && r[2] > 0).length;
  return nf(rows.length) + ' regels voorraad per locatie · ' + nf(geen) + ' producten met voorraad op geen specifieke locatie';
}

/* ---------- stuks per pallet (productgeheugen catalog-ean, zelfde als Palletlabels en Containers) ---------- */
async function zetStuksPerPallet(code, stuks){
  const r = await api('GET', 'catalog?key=eq.catalog-ean&select=data');
  const cat = (r && r.length ? r[0].data : {}) || {};
  const k = String(code).toLowerCase();
  const hits = Object.keys(cat).filter(x => cat[x] && String(cat[x].sub || '').trim().toLowerCase() === k);
  if(hits.length) hits.forEach(x => { cat[x].qty = String(stuks); cat[x].used = Date.now(); });
  else {
    const p = D.P[code] || {};
    const naam = (p.naam || code).toUpperCase();
    cat[naam] = { name:p.naam || code, ean:String(p.ean || code), qty:String(stuks), sub:code, used:Date.now() };
  }
  await api('POST', 'catalog?on_conflict=key', [{ key:'catalog-ean', mode:'ean', data:cat, updated_at:new Date().toISOString() }], { Prefer:'resolution=merge-duplicates,return=minimal' });
  D.GEH[k] = Object.values(cat).filter(x => x && String(x.sub || '').trim().toLowerCase() === k);
}

/* ---------- import: Picqer-aanvuladvies (PDF) ---------- */
async function pdfWoorden(file){
  const pdf = await pdfjsLib.getDocument({ data:await file.arrayBuffer() }).promise;
  const paginas = [];
  for(let p = 1; p <= pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale:1 });
    const tc = await page.getTextContent();
    const w = [];
    tc.items.forEach(it => {
      const s = it.str; if(!s || !s.trim()) return;
      const x0 = it.transform[4], top = vp.height - it.transform[5];
      // pdf.js geeft soms hele zinnen; splits op spaties met geschatte x
      const cw = it.width && s.length ? it.width / s.length : 5;
      let off = 0;
      s.split(/(\s+)/).forEach(part => { if(part.trim()) w.push({ t:part, x:x0 + off * cw, top }); off += part.length; });
    });
    paginas.push(w);
  }
  return paginas;
}
async function impAdvies(file){
  const pag = await pdfWoorden(file);
  const alle = pag.flat();
  if(!alle.some(w => /Aanvuladvies/i.test(w.t))) throw new Error('dit lijkt geen Picqer-aanvuladvies');
  // kolomgrenzen uit de kop van pagina 1
  const kop = n => { const w = alle.find(x => x.t === n); return w ? w.x : null; };
  const xNaam = kop('Productnaam') || 120, xVan = kop('Van') || 265, xNaar = kop('Naar') || 385, xAant = kop('Aantal') || 465, xPick = kop('Pickvoorraad') || 500;
  let datum = null;
  const ai = alle.findIndex(w => w.t === 'Aangemaakt');
  if(ai >= 0){ const m = alle.slice(ai, ai + 6).map(w => w.t).join(' ').match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2})/); if(m) datum = m[3] + '-' + m[2] + '-' + m[1] + 'T' + m[4]; }
  const rows = [];
  pag.forEach(ws => {
    const kopY = (ws.find(w => w.t === 'Productcode') || {}).top || 0;
    const voet = ws.filter(w => /^Page$/i.test(w.t)).map(w => w.top);           // "Page 1" onderaan
    const body = ws.filter(w => w.top > kopY + 4 && !voet.some(t => Math.abs(t - w.top) < 3));
    const anc = body.filter(w => w.x >= xPick + 20 && /^-?\d+$/.test(w.t)).sort((a, b) => a.top - b.top);
    anc.forEach((a, i) => {
      const top = a.top - 4, bot = i + 1 < anc.length ? anc[i + 1].top - 4 : 1e9;
      const seg = body.filter(w => w.top >= top && w.top < bot).sort((p, q) => (Math.round(p.top) - Math.round(q.top)) || (p.x - q.x));
      const k = (lo, hi) => seg.filter(w => w.x >= lo && w.x < hi).map(w => w.t);
      const code = k(0, xNaam - 2).join('');
      const naam = k(xNaam - 2, xVan - 2).join(' ');
      const bulk = k(xVan - 2, xNaar - 2).join(' ').split(',').map(s => s.trim()).filter(Boolean);
      const naar = k(xNaar - 2, xAant - 2).join(' ');
      const aant = num(k(xAant - 2, xPick + 20).join(''));
      const geen = /Geen/i.test(naar);
      const pick = geen ? [] : naar.split(',').map(s => s.trim()).filter(Boolean);
      if(code) rows.push({ code, naam, bulk, pick, geenPick:geen, aantal:aant, pickst:num(a.t) });
    });
  });
  if(!rows.length) throw new Error('geen regels gevonden in het aanvuladvies');
  const onbekend = rows.filter(r => !D.P[r.code] && !D.PLOW[r.code.toLowerCase()]).map(r => r.code);
  await catZet('wh-advies', { datum:datum || new Date().toISOString(), ingelezen:new Date().toISOString(), rows });
  return rows.length + ' adviesregels' + (onbekend.length ? ' · ' + onbekend.length + ' codes niet in de productimport (' + onbekend.slice(0, 5).join(', ') + (onbekend.length > 5 ? '…' : '') + ')' : '');
}

/* ---------- Excel maken (Picqer-importbestanden) ---------- */
function excel(kop, rijen, bestandsnaam){
  const ws = XLSX.utils.aoa_to_sheet([kop].concat(rijen));
  ws['!cols'] = kop.map(k => ({ wch:Math.max(12, String(k).length + 2) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  if(window.Bestanden) Bestanden.aanbieden(blob, bestandsnaam, 'picqer', { titel:'Picqer-importbestand klaar' });
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = bestandsnaam; a.click(); }
}

return { URL_, KEY, $, esc, leeg, num, txt, bool, nf, plural, dd, isoDag, vandaag, fdate, fdt, dagenOud, toast, setSync, setSaved,
  api, getAll, upsert, catZet, catHaal, catPatch, D, load, leesSheet, soortVan,
  impProducten, impLocaties, impBackorders, impVerkoop, impAdvies, excel,
  impVerkoopMaand, verkoopMaandenOpslaan, maandUitNaam, maandVerkoop, impVoorraad, zetStuksPerPallet, datumUitNaam };
})();
