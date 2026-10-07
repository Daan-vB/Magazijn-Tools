/* =====================================================================
   IVOL Warehouse — Aanvuladvies live uit Picqer (Test, 7-10-2026)
   Picqer heeft geen aanvuladvies in de API, dus de app rekent het zelf uit, zoals Picqer:
     pickvoorraad onder "aanvullen onder" en er staat voorraad op bulk → aanvullen tot "vul aan tot".
   Gegevens:
     wh-pq-cat     alle producten met voorraad: id, voorraad Hoofdmagazijn / VST   (1× per 12 uur, ±10 verzoeken)
     wh-pickstand  voorraad per locatie van de kandidaten (pick + bulk gekoppeld)   (alleen gewijzigde producten)
     niveaus       uit de Picqer-productexport (wh-pq: aanvullen onder / vul aan tot)
   Tabs: 1 Voor orders (live backorders) · 2 Aanvulronde · 3 Van VST · Vergelijk met de PDF van Picqer.
   Alleen lezen: de app verplaatst niets in Picqer.
   ===================================================================== */
window.WHAL = (function(){
'use strict';
const { $, esc, nf, plural, D, isoDag, fdate, toast } = WH;
const MAG = 3857;
const S = { cat:null, st:null, geladen:false, bezig:false, stap:'', voortgang:0, fout:null, gang:'', laatsteRun:null };
const app = () => $('app');
const dd = n => String(n).padStart(2, '0');
// Picqer-tijd = Nederlandse tijd, "jjjj-mm-dd uu:mm:ss"
const pqNu = ms => { const d = new Date(ms || Date.now()); return isoDag(d) + ' ' + dd(d.getHours()) + ':' + dd(d.getMinutes()) + ':' + dd(d.getSeconds()); };
const uurOud = iso => iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : 1e9;
const isKar = l => l[3] === 1 || /^container\s*\d+$/i.test(String(l[0] || '').trim());
const gangVan = n => String(n || '').slice(0, 2).toUpperCase();

/* ---------- opslag ---------- */
async function laadOpslag(){
  if(S.geladen) return;
  try{
    const rows = window.WHC ? await WHC.catalog(['wh-pq-cat', 'wh-pickstand']) : await WH.api('GET', 'catalog?key=in.(%22wh-pq-cat%22,%22wh-pickstand%22)&select=key,data,updated_at');
    (rows || []).forEach(r => { if(r.key === 'wh-pq-cat') S.cat = r.data; if(r.key === 'wh-pickstand') S.st = r.data; });
  }catch(e){ S.fout = e; }
  S.geladen = true;
}

/* ---------- kandidaten: producten met een picklocatie én een bulklocatie (export) of bulkvoorraad (vorige keer) ---------- */
function locIndex(){
  const idx = {};
  Object.values(D.LOC || {}).forEach(L => (L.codes || []).forEach(c => {
    const x = idx[c] = idx[c] || { pick:0, bulk:0 };
    if(/^container\s*\d/i.test(L.naam)) return;
    if(L.bulk) x.bulk++; else x.pick++;
  }));
  return idx;
}
function kandidaten(){
  if(!S.cat) return [];
  const idx = locIndex(), st = (S.st && S.st.p) || {};
  return Object.keys(S.cat.ids || {}).filter(code => {
    if(!((S.cat.hm || {})[code] > 0)) return false;
    const q = D.PQ[code]; if(!q || q[0] === null || q[0] === undefined) return false;
    if(q[2] === 1) return false;                                    // virtueel
    const x = idx[code];
    if(x && x.pick && x.bulk) return true;
    const vorig = st[code];
    return !!(vorig && vorig.l && vorig.l.some(l => l[2] === 1 && l[4] > 0 && !isKar(l)) && vorig.l.some(l => l[2] === 0 && !isKar(l)));
  });
}

/* ---------- bijwerken ---------- */
const V = (a, p) => WHLIVE.vraag(a, p);
const wacht = ms => new Promise(r => setTimeout(r, ms));
// rustig aan: hooguit ±250 Picqer-verzoeken per minuut, zodat Stockmove en Auto-assign van Maxime ruimte houden
async function rustig(t0, ms){ const w = ms - (Date.now() - t0); if(w > 0) await wacht(w); }
function stap(t, v){ S.stap = t; S.voortgang = v; teken(); }
async function bijwerken(alles){
  if(S.bezig) return;
  S.bezig = true; S.fout = null;
  const start = Date.now();
  try{
    await laadOpslag();
    // 1. producten met voorraad (id's en voorraad per magazijn), hooguit 1× per 12 uur
    if(alles || !S.cat || uurOud(S.cat.t) > 12){
      const cat = { t:new Date().toISOString(), ids:{}, hm:{}, vst:{}, abc:{}, pd:{} };
      for(let van = 0, klaar = false, n = 0; !klaar && van < 30000; van += 1000, n++){
        stap('Producten ophalen uit Picqer… ' + nf(van) , Math.min(0.3, n * 0.03));
        const t0 = Date.now();
        const r = await V('catalogus', { van });
        (r.rijen || []).forEach(([id, code, hm, vst, abc, pd]) => { cat.ids[code] = id; if(hm) cat.hm[code] = hm; if(vst) cat.vst[code] = vst; if(abc) cat.abc[code] = abc; if(pd) cat.pd[code] = pd; });
        klaar = r.klaar;
        if(!klaar) await rustig(t0, 2500);
      }
      S.cat = cat;
      await WH.catZet('wh-pq-cat', cat);
    }
    // 2. wie moet opnieuw: alles bij de eerste keer of na 20 uur, anders alleen producten met een voorraadmutatie
    const kand = kandidaten();
    const st = (S.st && S.st.p) ? S.st : { p:{} };
    let vernieuw = kand;
    const nieuweSinds = pqNu(start - 120000);
    if(!alles && st.sinds && uurOud(st.bijgewerkt) < 20){
      stap('Voorraadmutaties sinds ' + st.sinds.slice(11, 16) + ' ophalen…', 0.32);
      const m = await V('mutaties', { sinds:st.sinds });
      if(m.vol) vernieuw = kand;
      else {
        const gewijzigd = new Set(m.ids || []);
        vernieuw = kand.filter(c => !st.p[c] || gewijzigd.has(S.cat.ids[c]));
      }
    }
    // 3. voorraad per locatie, 50 producten per keer
    const ids = vernieuw.map(c => S.cat.ids[c]).filter(Boolean);
    const codeVan = {}; Object.entries(S.cat.ids).forEach(([c, id]) => codeVan[id] = c);
    for(let i = 0; i < ids.length; i += 50){
      stap('Voorraad per locatie: ' + nf(Math.min(i + 50, ids.length)) + ' / ' + nf(ids.length) + (ids.length > 100 ? ' (± ' + Math.ceil((ids.length - i) / 50 * 12 / 60) + ' min)' : ''), 0.35 + 0.6 * (i / Math.max(1, ids.length)));
      const t0 = Date.now();
      const r = await V('locaties', { ids:ids.slice(i, i + 50).join(',') });
      (r.lijst || []).forEach(([id, l]) => { const c = codeVan[id]; if(c && l) st.p[c] = { t:r.opgehaald, l }; });
      if(i + 50 < ids.length) await rustig(t0, 12000);
    }
    // niet-kandidaten die geen voorraad meer hebben opruimen
    const kSet = new Set(kand);
    Object.keys(st.p).forEach(c => { if(!kSet.has(c) && !((S.cat.hm || {})[c] > 0)) delete st.p[c]; });
    st.sinds = nieuweSinds; st.bijgewerkt = new Date().toISOString(); st.kandidaten = kand.length; st.vernieuwd = ids.length;
    S.st = st;
    stap('Opslaan…', 0.97);
    await WH.catZet('wh-pickstand', st);
    S.laatsteRun = { duur:Math.round((Date.now() - start) / 1000), vernieuwd:ids.length, kandidaten:kand.length };
  }catch(e){ S.fout = e; }
  S.bezig = false; S.stap = ''; teken();
}

/* ---------- rekenen ---------- */
function stand(code){
  const p = S.st && S.st.p && S.st.p[code]; if(!p) return null;
  const hm = p.l.filter(l => l[1] == null || Number(l[1]) === MAG);
  const pick = hm.filter(l => l[2] === 0 && !isKar(l)), bulk = hm.filter(l => l[2] === 1 && !isKar(l) && l[4] > 0).sort((a, b) => b[4] - a[4]);
  const kar = hm.filter(l => isKar(l) && l[4] > 0);
  return { t:p.t, pick, bulk, kar, pickFys:pick.reduce((s, l) => s + l[4], 0), pickVrij:pick.reduce((s, l) => s + Math.max(0, l[4] - l[5]), 0), bulkV:bulk.reduce((s, l) => s + l[4], 0) };
}
function ronde(){
  const nuCodes = new Set((window.WHLIVE ? WHLIVE.nuLijst() : []).map(m => m.code));
  const uit = [], leeg = [];
  kandidaten().forEach(code => {
    const s = stand(code); if(!s || !s.pick.length) return;
    const [lvl, tot] = D.PQ[code] || [];
    if(lvl === null || lvl === undefined || s.pickVrij >= lvl) return;
    const naam = (D.P[code] || {}).naam || '';
    if(!s.bulk.length){ leeg.push({ code, naam, s, lvl, tot }); return; }
    const doel = Math.max(tot || 0, lvl);
    const aantal = Math.max(1, Math.min(s.bulkV, doel - s.pickVrij));
    uit.push({ code, naam, s, lvl, tot, aantal, gang:gangVan(s.pick[0][0]), voorOrders:nuCodes.has(code) });
  });
  uit.sort((a, b) => WHL.sortLoc(a.s.pick[0][0], b.s.pick[0][0]));
  return { uit, leeg };
}
// orders die niet compleet zijn met voorraad hier, maar wel met VST
function vanVst(){
  const L = window.WHLIVE ? WHLIVE.status() : null;
  if(!L || !L.data || !S.cat) return null;
  const codeVan = {}; Object.entries(S.cat.ids).forEach(([c, id]) => codeVan[id] = c);
  const B = WHLIVE.backorderCijfers(L.data.backorders);
  const rest = Object.assign({}, S.cat.vst || {});
  const per = {}, orders = [];
  B.orderLijst.filter(o => !o.vol).forEach(o => {
    const kort = o.regels.filter(r => !r.hp && r.v < r.a);
    const kan = kort.every(r => { const c = codeVan[r.p]; return c && (rest[c] || 0) >= r.a - r.v; });
    if(!kan || !kort.length) return;
    orders.push(o.o);
    kort.forEach(r => {
      const c = codeVan[r.p], nodig = r.a - r.v;
      rest[c] -= nodig;
      const x = per[c] = per[c] || { code:c, naam:(D.P[c] || {}).naam || '', nodig:0, orders:[], oudste:o.oudste, vst:(S.cat.vst || {})[c] || 0 };
      x.nodig += nodig; x.orders.push(o.o); if(o.oudste < x.oudste) x.oudste = o.oudste;
    });
  });
  return { producten:Object.values(per).sort((a, b) => String(a.oudste).localeCompare(String(b.oudste))), orders };
}
// vergelijken met het laatst ingelezen PDF-advies van Picqer
function vergelijk(R){
  if(!D.ADV || !D.ADV.rows) return null;
  const pdf = new Map(D.ADV.rows.map(r => [D.PLOW[String(r.code).toLowerCase()] || r.code, r]));
  const live = new Map(R.uit.map(r => [r.code, r]));
  const alleenPdf = [...pdf.keys()].filter(c => !live.has(c)).map(c => ({ code:c, pdf:pdf.get(c), s:stand(c), kand:!!(S.st && S.st.p && S.st.p[c]) }));
  const alleenLive = R.uit.filter(r => !pdf.has(r.code));
  const beide = R.uit.filter(r => pdf.has(r.code)).map(r => ({ r, pdf:pdf.get(r.code) }));
  return { datum:D.ADV.datum || D.ADV.ingelezen, alleenPdf, alleenLive, beide, nPdf:pdf.size };
}

/* ---------- scherm ---------- */
const locs = (ls, i) => ls.map(l => `<span class="loc">${esc(l[0])}</span> <span class="small">${nf(i === 'vrij' ? Math.max(0, l[4] - l[5]) : l[4])}</span>`).join('<br>');
const tijdTxt = iso => iso ? new Date(iso).toLocaleString('nl-NL', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '–';
function kop(tab, R, V){
  const st = S.st || {};
  const nNu = window.WHLIVE ? WHLIVE.nuLijst().length : 0;
  const t = (k, l, n) => `<a class="tab ${tab === k ? 'on' : ''}" href="#/aanvullive/${k}">${esc(l)} <span class="nr">${n == null ? '…' : nf(n)}</span></a>`;
  return `<div class="card noprint"><div class="row wrap between"><div><h2>Aanvuladvies live</h2>
      <div class="small muted">Uitgerekend uit Picqer: pickvoorraad (vrij) onder "aanvullen onder" en voorraad op bulk. Niveaus uit de productexport van ${esc(D.PQDATUM ? fdate(D.PQDATUM) : '–')}. Alleen lezen.</div></div>
      <div class="row">${S.bezig ? '' : `<button class="btn pri" data-al="bijwerken">Bijwerken</button><button class="btn sm ghost" data-al="alles" title="Alle producten opnieuw ophalen">alles opnieuw</button>`}</div></div>
    ${S.bezig ? `<div class="mt8"><div class="small"><b>${esc(S.stap)}</b></div><div class="ab-voortgang" style="text-align:left;min-width:0"><div class="balk"><i style="width:${Math.round(S.voortgang * 100)}%"></i></div></div></div>`
      : `<div class="small muted mt8">Bijgewerkt ${esc(tijdTxt(st.bijgewerkt))} · ${nf(st.kandidaten || 0)} producten met pick én bulk${S.laatsteRun ? ` · laatste keer ${nf(S.laatsteRun.vernieuwd)} vernieuwd in ${S.laatsteRun.duur} s` : ''}${S.cat ? ` · productlijst ${esc(tijdTxt(S.cat.t))}` : ''}</div>`}
    ${S.fout ? `<div class="status err">${esc(S.fout.message)}</div>` : ''}</div>
  <div class="tabs noprint">${t('orders', '1 · Voor orders', nNu)}${t('ronde', '2 · Aanvulronde', R ? R.uit.length : null)}${t('vst', '3 · Van VST', V ? V.producten.length : null)}${t('vergelijk', 'Vergelijk met PDF', null)}</div>`;
}
function printKop(titel){ return `<div class="printonly pkop"><b>${esc(titel)}</b><span>Picqer ${esc(tijdTxt((S.st || {}).bijgewerkt))}</span></div>`; }
function tabOrders(){
  const L = window.WHLIVE ? WHLIVE.status() : null;
  if(!L || !L.code) return `<div class="card">Eerst Picqer koppelen op <a href="#/live">Picqer live</a>.</div>`;
  const lijst = WHLIVE.nuLijst();
  return `<div class="card"><div class="row wrap between"><div><h3>1 · Voor orders: nu verplaatsen</h3><div class="small muted">Orders waarvan alles op voorraad is; alleen deze verplaatsing houdt ze tegen. Live uit Picqer.</div></div><button class="btn sm noprint" data-al="print" data-t="Aanvullen voor orders">Print</button></div>
    ${printKop('Aanvullen voor orders')}
    ${lijst.length ? `<div class="scroll mt8"><table><tr><th>Product</th><th>Van (bulk)</th><th>Naar (pick)</th><th class="n">Verplaatsen</th><th class="n">Orders</th></tr>
      ${lijst.map(m => `<tr><td><span class="code">${esc(m.code)}</span><div class="desc">${esc(m.naam || '')}</div></td><td>${m.van.map(v => `<span class="loc">${esc(v)}</span>`).join(' ')}</td>
        <td>${m.naar.length ? m.naar.map(v => `<span class="loc">${esc(v)}</span>`).join(' ') : '<span class="badge b-warn">geen specifieke locatie</span>'}</td><td class="n"><b>${nf(m.verpl)}</b></td><td class="n">${nf(m.orders.length)}</td></tr>`).join('')}</table></div>`
      : `<div class="empty">${L.klaar ? 'Niets: geen orders die alleen op een verplaatsing wachten.' : 'Ophalen…'}</div>`}</div>`;
}
function tabRonde(R){
  if(!S.st || !S.st.p) return `<div class="card empty">Nog niet uitgerekend. Klik <b>Bijwerken</b> (de eerste keer duurt een paar minuten).</div>`;
  const gangen = [...new Set(R.uit.map(r => r.gang))];
  const lijst = R.uit.filter(r => !S.gang || r.gang === S.gang);
  let vorige = '';
  return `<div class="card"><div class="row wrap between"><div><h3>2 · Aanvulronde</h3><div class="small muted">Per gang, in looproute. Pick (vrij) = voorraad op de picklocatie min wat al op een picklijst staat.</div></div><button class="btn sm noprint" data-al="print" data-t="Aanvulronde${S.gang ? ' ' + S.gang : ''}">Print</button></div>
    <div class="filters mt8 noprint"><button class="btn sm ${!S.gang ? 'pri' : ''}" data-al="gang" data-g="">alle</button>${gangen.map(g => `<button class="btn sm ${S.gang === g ? 'pri' : ''}" data-al="gang" data-g="${esc(g)}">${esc(g)} <span class="badge b-grey">${R.uit.filter(r => r.gang === g).length}</span></button>`).join('')}</div>
    ${printKop('Aanvulronde' + (S.gang ? ' ' + S.gang : ''))}
    ${lijst.length ? `<div class="scroll mt8"><table><tr><th>Product</th><th>Pick (vrij)</th><th class="n">Onder / tot</th><th>Bulk</th><th class="n">Aanvullen</th></tr>
      ${lijst.map(r => { const g = r.gang !== vorige ? (vorige = r.gang, `<tr class="pgang"><td colspan="5"><b>${esc(r.gang)}</b></td></tr>`) : '';
        return g + `<tr><td><span class="code">${esc(r.code)}</span>${r.voorOrders ? ' <span class="badge b-bad">ook voor orders</span>' : ''}<div class="desc">${esc(r.naam)}</div></td>
          <td>${locs(r.s.pick, 'vrij')}${r.s.pickFys !== r.s.pickVrij ? `<div class="desc">fysiek ${nf(r.s.pickFys)}</div>` : ''}</td><td class="n">${nf(r.lvl)} / ${nf(r.tot)}</td>
          <td>${locs(r.s.bulk.slice(0, 3))}${r.s.bulk.length > 3 ? `<div class="desc">+${r.s.bulk.length - 3}</div>` : ''}</td><td class="n"><b style="font-size:16px">${nf(r.aantal)}</b></td></tr>`; }).join('')}</table></div>`
      : '<div class="empty">Niets aan te vullen.</div>'}
    ${R.leeg.length ? `<details class="mt12"><summary>Onder het niveau, maar geen bulkvoorraad (${R.leeg.length})</summary><div class="scroll mt8"><table><tr><th>Product</th><th>Pick (vrij)</th><th class="n">Onder / tot</th><th>Retourkar</th></tr>
      ${R.leeg.map(r => `<tr><td><span class="code">${esc(r.code)}</span><div class="desc">${esc(r.naam)}</div></td><td>${locs(r.s.pick, 'vrij')}</td><td class="n">${nf(r.lvl)} / ${nf(r.tot)}</td><td>${r.s.kar.length ? locs(r.s.kar) : ''}${(S.cat.vst || {})[r.code] ? `<div class="desc">VST ${nf(S.cat.vst[r.code])}</div>` : ''}</td></tr>`).join('')}</table></div></details>` : ''}</div>`;
}
function tabVst(V){
  if(!V) return `<div class="card empty">Wacht op Picqer-gegevens (backorders en productlijst). Klik eventueel <b>Bijwerken</b>.</div>`;
  return `<div class="card"><div class="row wrap between"><div><h3>3 · Van VST halen</h3><div class="small muted">Orders die niet compleet zijn met de voorraad hier, maar wel met de voorraad bij VST. Oudste order eerst.</div></div><button class="btn sm noprint" data-al="print" data-t="Van VST halen">Print</button></div>
    ${printKop('Van VST halen')}
    ${V.producten.length ? `<div class="scroll mt8"><table><tr><th>Product</th><th class="n">Nodig</th><th class="n">Op VST</th><th>Palletnummers (laatste export)</th><th class="n">Orders</th></tr>
      ${V.producten.map(p => `<tr><td><span class="code">${esc(p.code)}</span><div class="desc">${esc(p.naam)}</div></td><td class="n"><b>${nf(p.nodig)}</b></td><td class="n">${nf(p.vst)}</td>
        <td class="small">${esc(((D.VSTLOC || {})[p.code] || []).slice(0, 6).join(', '))}</td><td class="n">${nf(p.orders.length)}</td></tr>`).join('')}</table></div>
      <div class="small muted mt8">${plural(V.orders.length, 'order wordt', 'orders worden')} compleet met VST.</div>` : '<div class="empty">Geen orders die met VST compleet worden.</div>'}</div>`;
}
function tabVergelijk(R){
  const C = vergelijk(R);
  if(!C) return '<div class="card empty">Geen PDF-advies van Picqer ingeladen om mee te vergelijken (Gegevens → aanvuladvies-PDF).</div>';
  const rij = x => `<tr><td><span class="code">${esc(x.code)}</span></td><td>${x.pdf ? esc((x.pdf.pick || []).join ? x.pdf.pick.join(' ') : x.pdf.pick || '') : ''}</td><td class="n">${x.pdf ? nf(x.pdf.pickst) : ''}</td><td class="n">${x.pdf ? nf(x.pdf.aantal) : ''}</td>
    <td>${x.s ? locs(x.s.pick, 'vrij') : '<span class="desc">niet in de berekening</span>'}</td><td class="small">${x.reden || ''}</td></tr>`;
  const reden = x => {
    if(!x.kand) return 'geen kandidaat (geen pick én bulk gekoppeld in de locatie-export, of geen niveau)';
    const q = D.PQ[x.code] || []; if(!x.s) return '';
    if(!x.s.bulk.length) return 'geen bulkvoorraad meer';
    if(x.s.pickVrij >= q[0]) return 'pick vrij ' + nf(x.s.pickVrij) + ' ≥ niveau ' + nf(q[0]) + ' (inmiddels aangevuld?)';
    return '';
  };
  return `<div class="card"><h3>Vergelijk met het PDF-advies van Picqer</h3><div class="small muted">PDF van ${esc(tijdTxt(C.datum))} (${nf(C.nPdf)} regels) tegen de live berekening van ${esc(tijdTxt((S.st || {}).bijgewerkt))}. Verschillen door tijd zijn normaal; structurele verschillen wil ik weten.</div>
    <div class="tiles mt12"><div class="tile t-ok"><div class="lbl">In beide</div><div class="big">${nf(C.beide.length)}</div></div>
      <div class="tile t-warn"><div class="lbl">Alleen in PDF</div><div class="big">${nf(C.alleenPdf.length)}</div></div><div class="tile t-info"><div class="lbl">Alleen live</div><div class="big">${nf(C.alleenLive.length)}</div></div></div>
    ${C.beide.length ? `<details class="mt12"><summary>In beide: aantal PDF tegen live</summary><div class="scroll mt8"><table><tr><th>Product</th><th class="n">PDF aanvullen</th><th class="n">Live aanvullen</th></tr>${C.beide.map(x => `<tr><td><span class="code">${esc(x.r.code)}</span></td><td class="n">${nf(x.pdf.aantal)}</td><td class="n">${nf(x.r.aantal)}</td></tr>`).join('')}</table></div></details>` : ''}
    ${C.alleenPdf.length ? `<details class="mt12" open><summary>Alleen in PDF (${C.alleenPdf.length})</summary><div class="scroll mt8"><table><tr><th>Product</th><th>Pick (PDF)</th><th class="n">Pickvrd PDF</th><th class="n">Aantal PDF</th><th>Pick nu (vrij)</th><th>Waarom niet live</th></tr>${C.alleenPdf.map(x => rij(Object.assign(x, { reden:reden(x) }))).join('')}</table></div></details>` : ''}
    ${C.alleenLive.length ? `<details class="mt12"><summary>Alleen live (${C.alleenLive.length})</summary><div class="scroll mt8"><table><tr><th>Product</th><th>Pick (vrij)</th><th class="n">Onder / tot</th><th class="n">Aanvullen</th></tr>${C.alleenLive.map(r => `<tr><td><span class="code">${esc(r.code)}</span></td><td>${locs(r.s.pick, 'vrij')}</td><td class="n">${nf(r.lvl)} / ${nf(r.tot)}</td><td class="n">${nf(r.aantal)}</td></tr>`).join('')}</table></div></details>` : ''}</div>`;
}

let TAB = 'ronde';
function teken(){
  if(!/^#\/aanvullive/.test(location.hash || '')) return;
  const a = app(); if(!a) return;
  const y = window.scrollY;
  const R = S.st && S.st.p ? ronde() : null;
  const Vs = vanVst();
  a.innerHTML = kop(TAB, R, Vs) + (TAB === 'orders' ? tabOrders() : TAB === 'vst' ? tabVst(Vs) : TAB === 'vergelijk' ? (R ? tabVergelijk(R) : tabRonde(R)) : tabRonde(R || { uit:[], leeg:[] }));
  window.scrollTo(0, y);
}
async function view(tab){
  TAB = ['orders', 'ronde', 'vst', 'vergelijk'].includes(tab) ? tab : 'ronde';
  teken();
  if(window.WHLIVE && WHLIVE.status().code && !WHLIVE.status().data && !WHLIVE.status().laden) WHLIVE.laad();
  if(!S.geladen){ await laadOpslag(); teken(); }
  // automatisch bijwerken als het langer dan 30 minuten geleden is
  if(!S.bezig && WHLIVE.status().code && (!S.st || uurOud(S.st.bijgewerkt) > 0.5) && S.st) bijwerken(false);
}
if(window.WHLIVE) WHLIVE.opNieuw(() => teken());
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-al]'); if(!b) return;
  const k = b.dataset.al;
  if(k === 'bijwerken') bijwerken(false);
  if(k === 'alles') bijwerken(true);
  if(k === 'gang'){ S.gang = b.dataset.g || ''; teken(); }
  if(k === 'print'){
    const oud = document.title, n = new Date();
    document.title = b.dataset.t + ' ' + isoDag(n) + ' ' + dd(n.getHours()) + dd(n.getMinutes());
    window.print(); setTimeout(() => { document.title = oud; }, 500);
  }
});
return { view, bijwerken, ronde, vanVst, kandidaten, stand, S };
})();
