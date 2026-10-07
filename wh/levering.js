/* =====================================================================
   IVOL Warehouse — Ontvangsten van Europese leveranciers (8-10-2026)
   Alleen Europese leveringen. Containers van buiten Europa lopen via
   Containerplanning; die werken heel anders en blijven hier buiten.

   Hoe het loopt:
     Gino bestelt · Karin bewaakt de orderbevestigingen en levertijden
     levering komt binnen · Daan, Kate of Sala controleren de pakbon
     Karin boekt op in Picqer (geen specifieke locatie) en verwerkt backorders
     → vanaf hier neemt deze app het over:

     1. Klopt het?    — besteld naast opgeboekt; tekort blijft bij de leverancier
     2. Direct weg    — wat er aan orders/backorders wacht gaat niet de stelling in
     3. Palletlabels  — alleen voor de pallets die een label nodig hebben
     4. Waarheen      — per product: picklocatie of de stelling erboven
     5. Controleer    — de app kijkt in Picqer of alles echt verplaatst is

   VST komt hier niet voor: Europese pallets gaan vrijwel nooit naar de opslag.
   Een uitzondering kan met één klik.

   Alles wat uit Picqer komt wordt alleen gelezen. Wat de app zelf onthoudt
   (verdeling, afgevinkte stappen, koppeling aan een container) staat in de
   catalog-rij "wh-leveringen".
   ===================================================================== */
window.WHLEV = (function(){
'use strict';
const { $, esc, nf, num, D, isoDag, toast, catPatch } = WH;
const app = () => $('app');

/* ---------- geheugen in dit tabblad ---------- */
const S = {
  bezig:false, stap:'', fout:'', data:null, klaar:null, auto:false,
  dagen:30, tab:'binnen', open:null, demo:false
};
const BEWAARD = () => D.LEV || {};
const vanLev = k => BEWAARD()[k] || {};
async function onthoud(k, patch){
  const cur = Object.assign({}, vanLev(k), patch);
  D.LEV = Object.assign({}, BEWAARD(), { [k]:cur });
  if(S.demo){ try{ localStorage.setItem('ivol-lev-demo', JSON.stringify(D.LEV)); }catch(e){} return cur; }
  await catPatch('wh-leveringen', { [k]:cur });
  return cur;
}

/* ---------- Picqer ophalen ---------- */
async function laad(){
  if(S.bezig) return;
  S.bezig = true; S.fout = ''; S.stap = 'Inkoop en ontvangsten ophalen…'; teken();
  try{
    const sinds = isoDag(Date.now() - (S.dagen - 1) * 864e5);
    S.data = S.demo ? WHDEMO.keten(sinds) : await WHLIVE.vraag('keten', { sinds });
    const nu = new Date();
    S.klaar = String(nu.getHours()).padStart(2, '0') + ':' + String(nu.getMinutes()).padStart(2, '0');
  }catch(e){ S.fout = (e && e.message) || String(e); }
  S.bezig = false; S.stap = ''; teken();
}
function teken(){ const B = WHV(); if(B && B.rerender && /^#\/lever/.test(location.hash)) B.rerender(); }
const WHV = () => window.WHV;

/* =====================================================================
   Leveringen samenstellen: ontvangst ↔ inkooporder ↔ container
   ===================================================================== */
const sleutelVan = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const levKort = s => String(s || '').split(/[\s,.(]/)[0];

// hoort deze inkooporder bij een container uit de containerplanning?
function containerBij(po){
  if(!po) return null;
  const refs = [po.nummer, po.opmerking].map(sleutelVan).filter(x => x.length > 3);
  const lev = sleutelVan(levKort(po.leverancier));
  let beste = null;
  (D.CONT || []).forEach(c => {
    if(c.status === 'afgerond') return;
    const cref = sleutelVan(c.pakbon_ref), cnr = sleutelVan(c.containernummer);
    const viaRef = (cref && refs.some(r => r.includes(cref))) || (cnr && refs.some(r => r.includes(cnr)));
    const zelfdeLev = lev && sleutelVan(levKort(c.leverancier)).startsWith(lev.slice(0, 6));
    let score = 0;
    if(viaRef) score += 10;
    if(zelfdeLev) score += 3;
    if(zelfdeLev && po.verwacht_op && c.losdatum){
      const d = Math.abs(new Date(c.losdatum + 'T12:00:00') - new Date(String(po.verwacht_op).slice(0, 10) + 'T12:00:00')) / 864e5;
      if(d <= 10) score += 3; else if(d <= 30) score += 1;
    }
    if(score >= 6 && (!beste || score > beste.score)) beste = { score, c };
  });
  return beste ? beste.c : null;
}

/* Alle leveringen: elke ontvangst is er één; elke inkooporder zonder ontvangst ook. */
function leveringen(){
  const d = S.data || { inkoop:[], ontvangsten:[] };
  const poVan = {}; (d.inkoop || []).forEach(p => poVan[p.id] = p);
  const uit = [];
  const gebruikt = new Set();
  (d.ontvangsten || []).forEach(o => {
    const po = o.idinkooporder ? poVan[o.idinkooporder] : null;
    if(po) gebruikt.add(po.id);
    const key = 'o' + o.id;
    const b = vanLev(key);
    const cont = b.container ? (D.CONT || []).find(c => String(c.id) === String(b.container)) : containerBij(po || { leverancier:o.leverancier, nummer:o.inkooporder, verwacht_op:(o.klaar || o.aangemaakt || '') });
    uit.push({
      key, soort:'ontvangst', id:o.id,
      leverancier: o.leverancier || (po && po.leverancier) || '',
      nummer: o.nummer || '', inkoop: po ? po.nummer : (o.inkooporder || ''), po,
      wie: o.wie || '', datum: (o.klaar || o.aangemaakt || '').slice(0, 10),
      tijd: (o.klaar || o.aangemaakt || ''), status: o.status || '',
      container: cont || null,
      regels: regelsVan(o, po), bewaard:b
    });
  });
  (d.inkoop || []).forEach(p => {
    if(gebruikt.has(p.id)) return;
    if(/completed|cancelled|canceled/i.test(p.status || '')) return;
    const key = 'i' + p.id;
    const b = vanLev(key);
    const cont = b.container ? (D.CONT || []).find(c => String(c.id) === String(b.container)) : containerBij(p);
    uit.push({
      key, soort:'inkoop', id:p.id, leverancier:p.leverancier || '', nummer:'', inkoop:p.nummer || '', po:p,
      wie:'', datum:(p.verwacht_op || '').slice(0, 10), tijd:p.verwacht_op || '', status:p.status || '',
      container:cont || null,
      regels:(p.regels || []).map(r => ({ code:code(r.code), naam:r.naam, besteld:r.besteld, ontvangen:0, prijs:r.prijs })),
      bewaard:b
    });
  });
  return uit.sort((a, b) => String(b.tijd || '').localeCompare(String(a.tijd || '')));
}
// productcode precies zoals Picqer hem kent
const code = c => D.PLOW[String(c || '').toLowerCase()] || String(c || '');
function regelsVan(o, po){
  const per = {};
  (o.producten || []).forEach(p => {
    const k = code(p.code); if(!k) return;
    (per[k] = per[k] || { code:k, naam:p.naam || '', besteld:0, ontvangen:0, prijs:0 }).ontvangen += num(p.aantal) || 0;
  });
  (po && po.regels || []).forEach(r => {
    const k = code(r.code); if(!k) return;
    const x = per[k] = per[k] || { code:k, naam:r.naam || '', besteld:0, ontvangen:0, prijs:0 };
    x.besteld += num(r.besteld) || 0; x.prijs = num(r.prijs) || x.prijs; if(!x.naam) x.naam = r.naam || '';
  });
  return Object.values(per).sort((a, b) => (b.ontvangen || b.besteld) - (a.ontvangen || a.besteld));
}

// levertijd: hoeveel dagen zat er tussen bestellen en binnenkomen, per leverancier
function levertijden(){
  const d = S.data || {}; const per = {};
  (d.inkoop || []).forEach(p => {
    if(!p.besteld_op || !p.klaar_op) return;
    const n = Math.round((new Date(String(p.klaar_op).slice(0, 10) + 'T12:00:00') - new Date(String(p.besteld_op).slice(0, 10) + 'T12:00:00')) / 864e5);
    if(!(n >= 0 && n < 400)) return;
    const k = levKort(p.leverancier).toLowerCase();
    (per[k] = per[k] || []).push(n);
  });
  const uit = {};
  Object.entries(per).forEach(([k, v]) => uit[k] = { n:v.length, gem:Math.round(v.reduce((a, b) => a + b, 0) / v.length), min:Math.min(...v), max:Math.max(...v) });
  return uit;
}
function levertijdTekst(lev){
  const t = levertijden()[levKort(lev.leverancier).toLowerCase()];
  const po = lev.po;
  const eigen = po && po.besteld_op && (po.klaar_op || po.verwacht_op)
    ? Math.round((new Date(String(po.klaar_op || po.verwacht_op).slice(0, 10) + 'T12:00:00') - new Date(String(po.besteld_op).slice(0, 10) + 'T12:00:00')) / 864e5) : null;
  const d = [];
  if(eigen !== null && eigen >= 0) d.push('levertijd ' + eigen + ' dagen');
  if(t && t.n >= 2) d.push('deze leverancier gemiddeld ' + t.gem + ' dagen (' + t.min + '–' + t.max + ', ' + t.n + ' leveringen)');
  return d.join(' · ');
}

/* =====================================================================
   Verdeling: het advies
   Regels (uit de containerplanning, hier ook voor Europese leveringen):
     1. backorders gaan er eerst af — die moeten vandaag de deur uit
     2. picklocatie bijvullen als daar weinig ligt
     3. hier aanvullen tot het doel: verkoop per maand × aantal maanden
     4. wat dan nog over is in hele pallets → VST, de rest blijft hier
   ===================================================================== */
const DEST = {
  BO:{ nl:'backorders', kleur:'b-bad', uitleg:'gaat direct naar de orders die erop wachten' },
  PICK:{ nl:'picklocatie', kleur:'b-ok', uitleg:'aanvullen op de picklocatie' },
  UP:{ nl:'bulk (boven pick)', kleur:'b-blue', uitleg:'pallet in de stelling boven de picklocatie' },
  VST:{ nl:'VST (uitzondering)', kleur:'b-warn', uitleg:'naar Van Spreuwel — bij Europese leveringen een uitzondering' }
};
function feiten(c){
  const p = D.P[c] || {};
  const bo = boStuks(c);
  const hm = num(p.voorraad_hm) || 0;
  return {
    hm, vst:num(p.voorraad_vst) || 0,
    vrij: p.vrij_hm === null || p.vrij_hm === undefined || p.vrij_hm === '' ? hm - bo : num(p.vrij_hm),
    rate: window.WHL ? WHL.vkVan(c) : null,
    bo, spp: window.WHL ? WHL.sppVan(c) : null,
    pick: pickVoorraad(c), naam: window.WHL ? WHL.naamVan(c) : ''
  };
}
function boStuks(c){
  return (D.BO || []).filter(x => code(x.productcode) === c).reduce((s, x) => s + (num(x.aantal) || 0), 0);
}
// hoeveel ligt er op de picklocatie(s)
function pickVoorraad(c){
  const v = D.VR[c];
  if(!v) return null;
  const bulk = l => (D.LOC[l] || {}).bulk;
  return Object.entries(v.locs || {}).filter(([l]) => !bulk(l)).reduce((s, [, n]) => s + n, 0);
}
function advies(c, aantal, opt){
  opt = opt || {};
  const f = feiten(c);
  const maanden = num(opt.maanden) || 1.5;
  const spp = num(opt.spp) || f.spp || 0;
  const porties = [], uitleg = [];
  let rest = Math.max(0, num(aantal) || 0);
  if(!rest) return { porties, uitleg:'niets ontvangen', f, spp };
  // 1. backorders: alleen wat er niet al ligt
  const boNodig = Math.min(rest, Math.max(0, f.bo - f.hm));
  if(boNodig > 0){ porties.push({ dest:'BO', stuks:boNodig }); rest -= boNodig; uitleg.push(nf(boNodig) + ' voor backorders (' + nf(f.bo) + ' open, ' + nf(f.hm) + ' ligt er)'); }
  // wat blijft hier liggen als de backorders de deur uit zijn
  const staatHier = Math.max(0, f.hm - f.bo);
  const perMaand = f.rate || 0;
  // 2. picklocatie bijvullen als daar weinig ligt
  if(rest > 0 && f.pick !== null && perMaand > 0 && f.pick < perMaand * 0.5){
    const bij = Math.min(rest, spp > 0 ? spp : Math.round(perMaand * 0.5));
    if(bij > 0){ porties.push({ dest:'PICK', stuks:bij }); rest -= bij; uitleg.push(nf(bij) + ' bij op de picklocatie (daar ligt ' + nf(f.pick) + ')'); }
  }
  // 3. hier aanvullen tot het doel
  const doel = perMaand ? perMaand * maanden : 0;
  let nodig = perMaand ? Math.max(0, doel - staatHier) : rest;
  if(!perMaand) uitleg.push('geen verkoophistorie: alles blijft hier');
  else uitleg.push('doel hier ' + nf(doel) + ' (' + nf(maanden, 1) + ' mnd × ' + nf(perMaand) + '/mnd), ligt er straks ' + nf(staatHier));
  let hier = 0;
  if(spp > 0){
    while(rest >= spp && hier + spp <= nodig + 0.001){ porties.push({ dest:'UP', stuks:spp, pallet:true }); rest -= spp; hier += spp; }
  } else if(nodig > 0){
    const n = Math.min(rest, nodig); if(n > 0){ porties.push({ dest:'PICK', stuks:n }); rest -= n; hier += n; }
  }
  // 4. de rest blijft ook hier: hele pallets de stelling in, het restje naar de pick
  if(rest > 0){
    if(spp > 0 && rest >= spp){
      const n = Math.floor(rest / spp);
      for(let i = 0; i < n; i++) porties.push({ dest:'UP', stuks:spp, pallet:true });
      rest -= n * spp;
      uitleg.push('de overige ' + n + ' pallet' + (n === 1 ? '' : 's') + ' ook in de stelling (meer dan ' + nf(maanden, 1) + ' maand voorraad)');
    }
    if(rest > 0){ porties.push({ dest:'PICK', stuks:rest }); rest = 0; }
  }
  return { porties:samen(porties), uitleg:uitleg.join(' · '), f, spp };
}
function samen(porties){
  const volgorde = { BO:0, PICK:1, UP:2, VST:3 };
  const los = {}, pallets = [];
  porties.forEach(p => {
    const n = num(p.n) || 1;
    if(p.pallet){ for(let i = 0; i < n; i++) pallets.push({ dest:p.dest, stuks:num(p.stuks) || 0, pallet:true }); }
    else los[p.dest] = (los[p.dest] || 0) + n * (num(p.stuks) || 0);
  });
  const uit = [];
  Object.entries(los).forEach(([dest, stuks]) => { if(stuks > 0) uit.push({ n:1, dest, stuks }); });
  pallets.forEach(p => {
    const l = uit.find(x => x.pallet && x.dest === p.dest && x.stuks === p.stuks);
    if(l) l.n++; else uit.push({ n:1, dest:p.dest, stuks:p.stuks, pallet:true });
  });
  return uit.sort((a, b) => volgorde[a.dest] - volgorde[b.dest] || (a.pallet ? 1 : 0) - (b.pallet ? 1 : 0));
}
const portieStuks = p => (num(p.n) || 1) * (num(p.stuks) || 0);
// de verdeling van een levering: vastgelegd door Daan, anders het advies
function verdelingVan(lev){
  const vast = (lev.bewaard || {}).verdeling || {};
  const mnd = num((lev.bewaard || {}).maanden) || 1.5;
  const uit = {};
  lev.regels.forEach(r => {
    const aantal = r.ontvangen || r.besteld || 0;
    const a = advies(r.code, aantal, { maanden:mnd, spp:(lev.bewaard.spp || {})[r.code] });
    const v = vast[r.code];
    uit[r.code] = { aantal, advies:a, porties:(v && v.porties) ? v.porties : a.porties, vast:!!(v && v.porties), uitleg:a.uitleg, spp:a.spp, f:a.f };
  });
  return uit;
}

/* ---------- taken voor de vloer ---------- */
function takenVan(lev){
  const vd = verdelingVan(lev);
  const uit = [];
  Object.entries(vd).forEach(([c, v]) => {
    v.porties.forEach((p, i) => {
      if(!portieStuks(p)) return;
      uit.push({
        id:c + ':' + i, code:c, dest:p.dest, stuks:portieStuks(p), n:num(p.n) || 1, per:num(p.stuks) || 0, pallet:!!p.pallet,
        pick:pickLocs(c), bulk:bulkLocs(c),
        tekst: (p.pallet ? (p.n > 1 ? p.n + ' pallets' : '1 pallet') + ' (' + nf(p.stuks) + ' per pallet)' : nf(portieStuks(p)) + ' stuks') + ' → ' + DEST[p.dest].nl
      });
    });
  });
  return uit;
}
/* ---------- regels voor Picqer ---------- */
function picqerRegels(lev){
  const t = takenVan(lev);
  const vst = [], hier = [];
  t.forEach(x => {
    if(x.dest === 'VST'){ for(let i = 0; i < x.n; i++) vst.push(x.code + '\t' + nf(x.per).replace(/\./g, '')); }
    else if(x.dest !== 'BO') hier.push({ code:x.code, stuks:x.stuks, dest:x.dest });
  });
  return { vst, hier };
}

/* =====================================================================
   Europees of container?
   Containers lopen via Containerplanning. Een levering heet hier "container"
   als hij aan een containerrecord hangt of als de leverancier eerder zo is
   gemerkt. Met één klik om te zetten; de app onthoudt het per leverancier.
   ===================================================================== */
const levSleutel = l => 'lev:' + sleutelVan(levKort(l.leverancier) || l.inkoop || l.key);
function soortVan(l){
  const eigen = (l.bewaard || {}).soort;
  if(eigen) return eigen;
  const perLev = BEWAARD()[levSleutel(l)];
  if(perLev && perLev.soort) return perLev.soort;
  return l.container ? 'container' : 'eu';
}
async function zetSoort(l, soort){
  await onthoud(l.key, { soort });
  await onthoud(levSleutel(l), { soort, leverancier:l.leverancier || '' });
}

/* =====================================================================
   Controleren in Picqer: is alles ook echt verplaatst?
   ===================================================================== */
const CTRL = {};
async function controleer(lev){
  const k = lev.key;
  CTRL[k] = { bezig:true };
  teken();
  try{
    const sinds = (lev.datum || isoDag(Date.now())) + ' 00:00';
    const obj = await WHLIVE.vraag('verplaatsingen', { sinds });
    await WH.impVerplaatsingen(obj);
    CTRL[k] = { bezig:false, op:new Date().toISOString(), rijen:rapport(lev) };
  }catch(e){ CTRL[k] = { bezig:false, fout:(e && e.message) || String(e) }; }
  teken();
}
const isBulk = loc => !!(D.LOC[loc] || {}).bulk;
// per product: hoeveel moest er naar pick en naar bulk, en hoeveel is er volgens Picqer heen gegaan
function rapport(lev){
  const taken = takenVan(lev);
  const vp = ((D.VP && D.VP !== 'laden' && D.VP.rows) || []).filter(r => String(r[1]).slice(0, 10) >= (lev.datum || ''));
  const per = {};
  taken.forEach(t => {
    const x = per[t.code] = per[t.code] || { code:t.code, moet:{ PICK:0, UP:0, BO:0, VST:0 }, ging:{ PICK:0, UP:0, VST:0 } };
    x.moet[t.dest] += t.stuks;
  });
  vp.forEach(r => {
    const c = code(r[3]); const x = per[c]; if(!x) return;
    if(r[5]) return;                                  // alleen vanaf "geen specifieke locatie"
    const naar = r[6];
    if(r[7] === 'Bulk van Spreuwel') x.ging.VST += r[4];
    else if(isBulk(naar)) x.ging.UP += r[4];
    else if(naar) x.ging.PICK += r[4];
  });
  return Object.values(per).map(x => {
    const moetHier = x.moet.PICK + x.moet.UP, gingHier = x.ging.PICK + x.ging.UP;
    const staat = !moetHier ? 'bo' : gingHier >= moetHier ? 'ok' : gingHier > 0 ? 'deel' : 'niets';
    return Object.assign(x, { moetHier, gingHier, staat });
  }).sort((a, b) => ({ niets:0, deel:1, bo:2, ok:3 }[a.staat] - { niets:0, deel:1, bo:2, ok:3 }[b.staat]));
}

/* =====================================================================
   Schermen
   ===================================================================== */
function kaartBron(){
  const code = window.WHLIVE && WHLIVE.status().code;
  const knop = `<button class="btn pri sm" data-d="lev-ververs"${S.bezig ? ' disabled' : ''}>${S.bezig ? 'Bezig…' : 'Ververs uit Picqer'}</button>`;
  const dag = (n, t) => `<button class="btn sm ${S.dagen === n ? 'pri' : ''}" data-d="lev-dagen" data-v="${n}">${t}</button>`;
  return `<div class="card"><div class="row wrap between"><div><h2>Ontvangsten</h2>
      <div class="small muted">Europese leveranciers. Zodra Karin de ontvangst heeft opgeboekt, staat hier wat ermee moet gebeuren.</div></div>${knop}</div>
    <div class="row wrap mt8">${dag(7, '7 dagen')}${dag(30, '30 dagen')}${dag(90, '90 dagen')}
      <button class="btn sm ${S.demo ? 'ok' : 'ghost'}" data-d="lev-demo">${S.demo ? '✓ Demo aan' : 'Demo aanzetten'}</button>
      ${S.demo ? '<span class="badge b-warn">DEMO — verzonnen leveringen, Picqer wordt niet gelezen</span>' : ''}</div>
    ${S.bezig ? `<div class="small mt8">${esc(S.stap)}</div>` : ''}
    ${S.fout ? `<div class="small mt8"><span class="bad">${esc(S.fout)}</span></div>` : ''}
    ${!code && !S.demo ? '<div class="small mt8">Eerst de koppelcode invullen: open Vandaag, daar vraagt de app er één keer om.</div>' : ''}
    ${S.klaar ? `<div class="small muted mt8">Bijgewerkt ${esc(S.klaar)}${S.demo ? '' : ' · rechtstreeks uit Picqer, alleen lezen'}</div>` : ''}</div>`;
}
const STAPPEN = [['controle', 'Gecontroleerd'], ['verdeling', 'Vrijgegeven'], ['labels', 'Labels geprint'], ['verplaatst', 'Verplaatst']];
function voortgang(lev){
  const g = (lev.bewaard || {}).gedaan || {};
  return STAPPEN.filter(([k]) => g[k]).length;
}
function viewLijst(){
  const B = WHV();
  const alle = leveringen();
  const eu = alle.filter(l => soortVan(l) === 'eu');
  const cont = alle.filter(l => soortVan(l) !== 'eu');
  const binnen = eu.filter(l => l.soort === 'ontvangst');
  const verwacht = eu.filter(l => l.soort === 'inkoop');
  const tabKnop = (k, t, n) => `<button class="btn ${S.tab === k ? 'pri' : ''}" data-d="lev-tab" data-v="${k}">${t}${n ? ' (' + n + ')' : ''}</button>`;
  const lijst = S.tab === 'verwacht' ? verwacht : binnen;
  const rij = l => {
    const stuks = l.regels.reduce((s, r) => s + (r.ontvangen || r.besteld || 0), 0);
    const waarde = l.regels.reduce((s, r) => s + (r.besteld || r.ontvangen || 0) * (r.prijs || 0), 0);
    const v = voortgang(l);
    const tekort = l.soort === 'ontvangst' && l.regels.some(r => r.besteld > 0 && r.ontvangen < r.besteld);
    return `<a class="mv" style="grid-template-columns:1fr auto;text-decoration:none;color:inherit" href="#/levering/${esc(l.key)}">
      <div><b>${esc(l.leverancier || 'Leverancier onbekend')}</b> <span class="muted small">${esc([l.nummer, l.inkoop].filter(Boolean).join(' · '))}</span>
        <div class="small mt4">${WH.plural(l.regels.length, 'product', 'producten')} · ${nf(stuks)} stuks${waarde ? ' · € ' + nf(waarde) : ''}${l.wie ? ' · ' + esc(l.wie) : ''}
          ${tekort ? B.badge('niet compleet geleverd', 'b-warn') : ''}</div></div>
      <div class="small muted" style="text-align:right">${esc(dagTekst(l))}${l.soort === 'inkoop' && levertijdTekst(l) ? '<div class="mt4">' + esc(levertijdTekst(l)) + '</div>' : ''}
        <div class="mt4">${v === STAPPEN.length ? B.badge('klaar', 'b-ok') : B.badge(v + '/' + STAPPEN.length + ' stappen', v ? 'b-warn' : 'b-grey')}</div></div></a>`;
  };
  app().innerHTML = kaartBron()
    + `<div class="card"><div class="row wrap">${tabKnop('binnen', 'Binnengekomen', binnen.length)}${tabKnop('verwacht', 'Verwacht', verwacht.length)}</div>
      <div class="small muted mt8">${S.tab === 'verwacht' ? 'Inkooporders van Europese leveranciers die nog moeten komen.' : (S.demo ? 'Verzonnen leveringen om mee te oefenen. Kies er een en volg de stappen.' : 'Kies de levering waar je mee bezig bent.')}</div>
      <div class="mt8">${lijst.length ? lijst.map(rij).join('') : '<div class="small muted">Niets gevonden in deze periode.</div>'}</div></div>`
    + (cont.length ? `<div class="card"><h3>Containers (${cont.length})</h3>
      <div class="small muted mt4">Deze horen bij Containerplanning en blijven hier buiten. Staat er iets tussen dat wél een gewone Europese levering is? Zet hem om.</div>
      <div class="mt8">${cont.map(l => `<div class="mv" style="grid-template-columns:1fr auto"><div><b>${esc(l.leverancier || '?')}</b>
        <span class="muted small">${esc([l.nummer, l.inkoop].filter(Boolean).join(' · '))}</span>
        ${l.container ? B.badge('container ' + (l.container.pakbon_ref || l.container.containernummer || l.container.id), 'b-blue') : ''}</div>
        <div><button class="btn sm" data-d="lev-soort" data-k="${esc(l.key)}" data-v="eu">Dit is Europees</button></div></div>`).join('')}</div></div>` : '');
}
function dagTekst(l){
  if(!l.datum) return '';
  const d = Math.round((new Date(l.datum + 'T12:00:00') - new Date(isoDag(Date.now()) + 'T12:00:00')) / 864e5);
  const dt = WH.fdate ? WH.fdate(l.datum) : l.datum;
  if(l.soort === 'inkoop') return d === 0 ? 'vandaag verwacht' : d > 0 ? 'over ' + d + ' dag' + (d === 1 ? '' : 'en') : dt + ' (te laat)';
  return d === 0 ? 'vandaag' : d === -1 ? 'gisteren' : dt;
}

/* ---------- één ontvangst: alles wat ermee moet gebeuren ---------- */
const pickLocs = c => (window.WHL ? WHL.locsVan(c) : []).filter(l => !isBulk(l));
const bulkLocs = c => (window.WHL ? WHL.locsVan(c) : []).filter(l => isBulk(l));
function naarTekst(t){
  if(t.dest === 'BO') return 'apart houden voor de orders die erop wachten';
  if(t.dest === 'VST') return 'naar VST';
  if(t.dest === 'PICK'){ const l = pickLocs(t.code); return 'naar de picklocatie' + (l.length ? ' ' + l.slice(0, 2).join(' / ') : ' (nog geen picklocatie bekend)'); }
  const b = bulkLocs(t.code);
  return 'in de stelling boven de pick' + (b.length ? ' (staat nu ook op ' + b.slice(0, 3).join(', ') + ')' : '');
}
function viewLevering(key){
  const B = WHV();
  const lev = leveringen().find(l => l.key === key);
  if(!lev){
    app().innerHTML = kaartBron() + '<div class="card empty">Deze ontvangst staat niet in de opgehaalde periode. Klik hierboven op Ververs uit Picqer of kies een langere periode.</div>';
    return;
  }
  const g = (lev.bewaard || {}).gedaan || {};
  const vd = verdelingVan(lev);
  const taken = takenVan(lev);
  const gedaanT = (lev.bewaard || {}).taken || {};
  const mnd = num((lev.bewaard || {}).maanden) || 1.5;
  const stuks = lev.regels.reduce((s, r) => s + (r.ontvangen || r.besteld || 0), 0);
  const waarde = lev.regels.reduce((s, r) => s + (r.besteld || r.ontvangen || 0) * (r.prijs || 0), 0);
  const vink = (k, t) => `<button class="btn sm ${g[k] ? 'ok' : ''}" data-d="lev-stap" data-k="${esc(lev.key)}" data-s="${k}">${g[k] ? '✓ ' + t : t}</button>`;

  // 1. klopt de ontvangst
  const ctrl = lev.regels.map(r => {
    const tekort = r.besteld > 0 ? r.besteld - r.ontvangen : 0;
    const kl = !r.besteld ? 'b-grey' : tekort > 0 ? 'b-warn' : tekort < 0 ? 'b-bad' : 'b-ok';
    const t = !r.besteld ? 'niet besteld — stond niet op de inkooporder'
      : tekort > 0 ? nf(tekort) + ' te weinig — blijft openstaan bij de leverancier'
      : tekort < 0 ? nf(-tekort) + ' te veel geleverd' : 'compleet';
    return `<tr><td><a class="code" href="#/p/${encodeURIComponent(r.code)}">${esc(r.code)}</a><div class="desc">${esc(r.naam || (window.WHL ? WHL.naamVan(r.code) : ''))}</div></td>
      <td class="n">${r.besteld ? nf(r.besteld) : '—'}</td><td class="n"><b>${nf(r.ontvangen)}</b></td><td>${B.badge(t, kl)}</td></tr>`;
  }).join('');
  const mankement = lev.regels.some(r => r.besteld > 0 && r.ontvangen !== r.besteld) || lev.regels.some(r => !r.besteld);

  // 2. direct weg voor orders
  const bo = taken.filter(t => t.dest === 'BO');

  // 3. labels
  const labels = taken.filter(t => t.pallet);
  const zonderNaam = [...new Set(labels.map(t => t.code))].filter(c => !labelNaam(c));

  // 4. waarheen
  const stelling = taken.filter(t => t.dest !== 'BO');
  const open = stelling.filter(t => !gedaanT[t.id]);
  const takenHtml = stelling.map(t => `<div class="mv" style="grid-template-columns:auto 1fr auto">
      <div><button class="btn sm ${gedaanT[t.id] ? 'ok' : ''}" data-d="lev-taak" data-k="${esc(lev.key)}" data-t="${esc(t.id)}">${gedaanT[t.id] ? '✓' : 'klaar'}</button></div>
      <div><a class="code" href="#/p/${encodeURIComponent(t.code)}">${esc(t.code)}</a> <span class="desc">${esc(window.WHL ? WHL.naamVan(t.code) : '')}</span>
        <div class="small mt4"><b>${esc(t.pallet ? (t.n > 1 ? t.n + ' pallets' : '1 pallet') + ' van ' + nf(t.per) : nf(t.stuks) + ' stuks')}</b> — ${esc(naarTekst(t))}</div></div>
      <div>${B.badge(DEST[t.dest].nl, DEST[t.dest].kleur)}</div></div>`).join('');

  // 5. controle
  const c = CTRL[lev.key] || {};
  const rap = c.rijen || [];
  const ctrlHtml = !rap.length ? '' : `<div class="mt8">${rap.map(x => {
      const kl = { ok:'b-ok', deel:'b-warn', niets:'b-bad', bo:'b-grey' }[x.staat];
      const t = x.staat === 'bo' ? 'alleen apart gehouden voor orders'
        : x.staat === 'ok' ? 'alles verplaatst (' + nf(x.gingHier) + ' stuks)'
        : x.staat === 'deel' ? nf(x.gingHier) + ' van ' + nf(x.moetHier) + ' verplaatst'
        : 'nog niets verplaatst (' + nf(x.moetHier) + ' stuks)';
      return `<div class="mv" style="grid-template-columns:auto 1fr"><div>${B.badge(x.staat === 'ok' ? 'goed' : x.staat === 'bo' ? '—' : x.staat === 'deel' ? 'half' : 'open', kl)}</div>
        <div><a class="code" href="#/p/${encodeURIComponent(x.code)}">${esc(x.code)}</a> <span class="desc">${esc(window.WHL ? WHL.naamVan(x.code) : '')}</span>
        <div class="small mt4">${esc(t)}${x.ging.VST ? ' · ' + nf(x.ging.VST) + ' naar VST' : ''}</div></div></div>`;
    }).join('')}</div>`;

  app().innerHTML = `<div class="card"><div class="row wrap between"><div><h2>${esc(lev.leverancier || 'Ontvangst')}</h2>
      <div class="small muted">${esc([lev.nummer && 'ontvangst ' + lev.nummer, lev.inkoop && 'inkooporder ' + lev.inkoop, lev.wie && 'opgeboekt door ' + lev.wie, lev.datum && (WH.fdate ? WH.fdate(lev.datum) : lev.datum)].filter(Boolean).join(' · '))}</div>
      ${lev.po && lev.po.besteld_op ? `<div class="small muted mt4">besteld ${esc(String(lev.po.besteld_op).slice(0, 10))}${levertijdTekst(lev) ? ' · ' + esc(levertijdTekst(lev)) : ''}</div>` : ''}</div>
      <a class="small" href="#/leveringen">← alle ontvangsten</a></div>
    <div class="small mt8">${WH.plural(lev.regels.length, 'product', 'producten')} · ${nf(stuks)} stuks${waarde ? ' · € ' + nf(waarde) + ' inkoopwaarde' : ''}
      ${(() => { const sm = { BO:0, PICK:0, UP:0, VST:0 }; taken.forEach(x => sm[x.dest] += x.stuks);
        return ['BO', 'PICK', 'UP', 'VST'].filter(k => sm[k] > 0).map(k => B.badge(nf(sm[k]) + ' → ' + DEST[k].nl, DEST[k].kleur)).join(' '); })()}</div>
    <div class="row wrap mt8">${STAPPEN.map(([k, t]) => `<span class="badge ${g[k] ? 'b-ok' : 'b-grey'}">${g[k] ? '✓ ' : ''}${esc(t)}</span>`).join(' ')}</div>
    <div class="row wrap mt8"><button class="btn sm ghost" data-d="lev-soort" data-k="${esc(lev.key)}" data-v="container">Dit is een container →</button></div></div>

  <div class="card"><h3>1. Klopt de ontvangst?</h3>
    <div class="small muted mt4">Wat Gino besteld heeft naast wat Karin heeft opgeboekt. ${mankement ? 'Er staat iets open — meld dat bij Karin.' : 'Alles komt overeen.'}</div>
    <div class="scroll mt8"><table><tr><th>Product</th><th class="n">Besteld</th><th class="n">Opgeboekt</th><th>Klopt het?</th></tr>${ctrl}</table></div>
    <div class="row wrap mt8">${vink('controle', 'Gecontroleerd')}</div></div>

  <div class="card"><h3>2. Gaat direct weg voor orders</h3>
    ${bo.length ? `<div class="small muted mt4">Dit hoeft de stelling niet in: er wachten orders op. Laat het bij de inpaktafel of op de picklocatie.</div>
      <div class="mt8">${bo.map(t => `<div class="mv" style="grid-template-columns:1fr auto"><div><a class="code" href="#/p/${encodeURIComponent(t.code)}">${esc(t.code)}</a>
        <span class="desc">${esc(window.WHL ? WHL.naamVan(t.code) : '')}</span><div class="small mt4"><b>${nf(t.stuks)} stuks</b> — ${esc(boTekst(t.code))}</div></div>
        <div>${B.badge('direct weg', 'b-bad')}</div></div>`).join('')}</div>`
      : '<div class="small muted mt4">Niets: er wachten geen orders op deze producten.</div>'}</div>

  <div class="card"><h3>3. Palletlabels</h3>
    <div class="small muted mt4">${labels.length ? nf(labels.reduce((s, t) => s + t.n, 0)) + ' labels — alleen voor de pallets die de stelling in gaan. Losse stuks en wat direct weggaat krijgen geen label.' : 'Geen pallets in deze levering, dus geen labels nodig.'}</div>
    ${zonderNaam.length ? `<div class="small mt8">${B.badge('Geen vloernaam voor: ' + zonderNaam.join(', '), 'b-warn')} <a class="small" href="#/productdata">vul aan bij Productdata</a></div>` : ''}
    <div class="row wrap mt8">${labels.length ? `<button class="btn pri sm" data-d="lev-labels" data-k="${esc(lev.key)}">Palletlabels maken (PDF)</button>` : ''}${vink('labels', 'Labels geprint')}</div></div>

  <div class="card"><div class="row wrap between"><h3>4. Waar gaat het heen?</h3><span>${B.badge(stelling.length - open.length + ' van ' + stelling.length + ' klaar', open.length ? 'b-warn' : 'b-ok')}</span></div>
    <div class="small muted mt4">Volg deze lijst. Doel: ${nf(mnd, 1)} maand verkoop op voorraad hier.
      ${[1, 1.5, 2, 3].map(m => `<button class="btn sm ${mnd === m ? 'pri' : ''}" data-d="lev-mnd" data-k="${esc(lev.key)}" data-v="${m}">${nf(m, 1)} mnd</button>`).join('')}</div>
    <div class="mt8">${takenHtml || '<div class="small muted">Niets te verplaatsen.</div>'}</div>
    <div class="row wrap mt8">${vink('verdeling', 'Vrijgeven aan het magazijn')}${vink('verplaatst', 'Verplaatst')}</div>
    <div class="small muted mt4">Zolang je niet vrijgeeft, ziet het magazijn deze ontvangst niet in Junior.</div></div>

  <div class="card"><h3>5. Controleer</h3>
    <div class="small muted mt4">De app kijkt in Picqer of alles ook echt verplaatst is, precies zoals hierboven staat.</div>
    <div class="row wrap mt8"><button class="btn pri sm" data-d="lev-ctrl" data-k="${esc(lev.key)}"${c.bezig ? ' disabled' : ''}>${c.bezig ? 'Bezig…' : 'Controleer in Picqer'}</button>
      ${c.op ? `<span class="small muted">gecontroleerd om ${esc(new Date(c.op).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }))}</span>` : ''}</div>
    ${c.fout ? `<div class="small mt8"><span class="bad">${esc(c.fout)}</span></div>` : ''}
    ${ctrlHtml}</div>

  <div class="card"><h3>Aanpassen</h3>
    <div class="small muted mt4">Klopt een bestemming niet? Zet het om — de app onthoudt het voor de volgende keer.</div>
    <div class="mt8">${lev.regels.map(r => { const v = vd[r.code]; return `<div class="mv" style="grid-template-columns:1fr">
      <div><a class="code" href="#/p/${encodeURIComponent(r.code)}">${esc(r.code)}</a> <span class="desc">${esc(r.naam || v.f.naam)}</span>
        <div class="small mt4">${v.porties.filter(p => portieStuks(p)).map(p => B.badge((p.pallet ? (p.n > 1 ? p.n + '× pallet ' + nf(p.stuks) : 'pallet ' + nf(p.stuks)) : nf(portieStuks(p)) + ' stuks') + ' → ' + DEST[p.dest].nl, DEST[p.dest].kleur)).join(' ')}
          ${v.vast ? B.badge('zelf aangepast', 'b-blue') : ''}</div>
        <div class="small muted mt4">${esc(v.uitleg)}</div>
        <div class="small muted">nu hier ${nf(v.f.hm)}${v.f.pick !== null ? ' (pick ' + nf(v.f.pick) + ')' : ''} · verkoop ${v.f.rate ? nf(v.f.rate) + '/mnd' : 'onbekend'}${v.f.bo ? ' · ' + nf(v.f.bo) + ' backorder' : ''}</div>
        <div class="row wrap mt4"><span class="small muted">Stuks per pallet:</span>
          <input type="number" min="1" step="1" value="${v.spp || ''}" placeholder="?" data-spp="${esc(r.code)}" style="width:80px;padding:5px 7px;border:1px solid #cdd5df;border-radius:6px">
          <button class="btn sm" data-d="lev-spp" data-k="${esc(lev.key)}" data-c="${esc(r.code)}">Opslaan</button>
          ${['BO', 'PICK', 'UP', 'VST'].map(dd => `<button class="btn sm" data-d="lev-schuif" data-k="${esc(lev.key)}" data-c="${esc(r.code)}" data-dest="${dd}">alles → ${DEST[dd].nl}</button>`).join('')}
          ${v.vast ? `<button class="btn sm ghost" data-d="lev-advies" data-k="${esc(lev.key)}" data-c="${esc(r.code)}">terug naar advies</button>` : ''}</div></div></div>`; }).join('')}</div></div>`;
}
function boTekst(c){
  const b = (D.BO || []).filter(x => code(x.productcode) === c);
  const orders = [...new Set(b.map(x => x.bestelling).filter(Boolean))];
  return orders.length ? WH.plural(orders.length, 'order', 'orders') + ' wacht' + (orders.length === 1 ? '' : 'en') + ' hierop' + (orders.length <= 3 ? ' (' + orders.join(', ') + ')' : '') : 'wacht op orders';
}

/* ---------- palletlabels ---------- */
const labelNaam = c => { const g = (D.GEH[String(c).toLowerCase()] || [])[0]; return (g && String(g.name || '').trim()) || ''; };
const eanVan = c => { const g = (D.GEH[String(c).toLowerCase()] || []).find(x => x.ean); return (g && String(g.ean).trim()) || ''; };
function maakLabels(lev){
  if(!window.jspdf){ toast('De labelmaker is nog niet geladen. Probeer het zo nog eens.', 5000); return; }
  const taken = takenVan(lev).filter(t => t.pallet);
  const lijst = [];
  taken.forEach(t => { for(let i = 0; i < t.n; i++) lijst.push({ code:t.code, name:labelNaam(t.code) || t.code, ean:eanVan(t.code) || t.code, stuks:t.per }); });
  if(!lijst.length) return toast('Geen pallets om een label voor te maken.', 4000);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  try{ doc.viewerPreferences({ PrintScaling:'None', FitWindow:true }); }catch(e){}
  const W = 297;
  const size = n => n <= 8 ? 110 : n <= 12 ? 95 : n <= 16 ? 78 : n <= 22 ? 60 : n <= 30 ? 46 : 36;
  const isEan = s => /^\d{12,13}$/.test(s) || /^\d{8}$/.test(s);
  lijst.forEach((r, i) => {
    if(i) doc.addPage('a4', 'landscape');
    doc.setTextColor(16, 21, 28); doc.setFont('helvetica', 'bold'); doc.setFontSize(size(r.name.length));
    doc.text(r.name, W / 2, 48, { align:'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(18); doc.setTextColor(57, 67, 79);
    doc.text(r.code, W / 2, 60, { align:'center' });
    doc.setTextColor(16, 21, 28);
    try{
      const cv = document.createElement('canvas');
      JsBarcode(cv, r.ean, { format:isEan(r.ean) ? (r.ean.length === 8 ? 'EAN8' : 'EAN13') : 'CODE128', height:130, width:4, displayValue:true, fontSize:34, font:'Arial', fontOptions:'bold', margin:6 });
      const w = 180, h = Math.min(50, w * (cv.height / cv.width));
      doc.addImage(cv.toDataURL('image/png'), 'PNG', (W - w) / 2, 82, w, h);
    }catch(e){}
    if(r.stuks){
      doc.setFont('helvetica', 'bold'); doc.setFontSize(58);
      doc.text(nf(r.stuks).replace(/\./g, ''), W / 2 - 8, 178, { align:'right' });
      doc.setFontSize(15); doc.text('STUKS', W / 2 + 6, 178, { align:'left' });
    }
  });
  const naam = 'Palletlabels ' + (lev.leverancier || 'levering').split(' ')[0] + ' ' + (lev.nummer || lev.inkoop || '') + '.pdf';
  doc.save(naam.replace(/\s+/g, ' ').trim());
  toast(lijst.length + ' label' + (lijst.length === 1 ? '' : 's') + ' klaar.', 4000);
}

/* ---------- klikken ---------- */
async function klik(a, b){
  if(a === 'lev-ververs'){ laad(); return true; }
  if(a === 'lev-dagen'){ S.dagen = +b.dataset.v; laad(); return true; }
  if(a === 'lev-tab'){ S.tab = b.dataset.v; teken(); return true; }
  if(a === 'lev-demo'){
    const aan = !S.demo;
    S.demo = aan; S.data = null; S.auto = false; S.klaar = null;
    try{ localStorage.setItem('ivol-lev-demo-aan', aan ? '1' : '0'); }catch(e){}
    if(aan){ try{ D.LEV = JSON.parse(localStorage.getItem('ivol-lev-demo') || '{}'); }catch(e){ D.LEV = {}; } }
    else D.LEV = (D.LEVECHT || {});
    location.hash = '#/leveringen'; laad(); return true;
  }
  const key = b.dataset.k;
  const lev = key ? leveringen().find(l => l.key === key) : null;
  if(a === 'lev-stap' && lev){
    const g = Object.assign({}, (lev.bewaard || {}).gedaan);
    const s = b.dataset.s; g[s] = !g[s];
    await onthoud(key, { gedaan:g }); teken(); return true;
  }
  if(a === 'lev-taak' && lev){
    const t = Object.assign({}, (lev.bewaard || {}).taken);
    const id = b.dataset.t; t[id] = !t[id];
    await onthoud(key, { taken:t }); teken(); return true;
  }
  if(a === 'lev-mnd' && lev){ await onthoud(key, { maanden:+b.dataset.v }); teken(); return true; }
  if(a === 'lev-schuif' && lev){
    const c = b.dataset.c, dest = b.dataset.dest;
    const vd = verdelingVan(lev)[c];
    const spp = vd.spp;
    const porties = dest === 'UP' || dest === 'VST'
      ? (spp > 0 ? samen(Array.from({ length:Math.floor(vd.aantal / spp) }, () => ({ dest, stuks:spp, pallet:true })).concat(vd.aantal % spp ? [{ dest:'PICK', stuks:vd.aantal % spp }] : [])) : [{ n:1, dest:'PICK', stuks:vd.aantal }])
      : [{ n:1, dest, stuks:vd.aantal }];
    const v = Object.assign({}, (lev.bewaard || {}).verdeling, { [c]:{ porties } });
    await onthoud(key, { verdeling:v }); teken(); return true;
  }
  if(a === 'lev-advies' && lev){
    const v = Object.assign({}, (lev.bewaard || {}).verdeling); delete v[b.dataset.c];
    await onthoud(key, { verdeling:v }); teken(); return true;
  }
  if(a === 'lev-spp' && lev){
    const c = b.dataset.c;
    const inp = document.querySelector('[data-spp="' + (window.CSS && CSS.escape ? CSS.escape(c) : c) + '"]');
    const n = inp ? num(inp.value) : 0;
    if(!(n > 0)) return toast('Vul een getal groter dan 0 in.', 4000), true;
    await WH.zetStuksPerPallet(c, n);
    toast(c + ': ' + nf(n) + ' per pallet opgeslagen.');
    teken(); return true;
  }
  if(a === 'lev-soort' && lev){
    await zetSoort(lev, b.dataset.v);
    if(b.dataset.v === 'container') location.hash = '#/leveringen'; else teken();
    return true;
  }
  if(a === 'lev-ctrl' && lev){ controleer(lev); return true; }
  if(a === 'lev-labels' && lev){ maakLabels(lev); return true; }
  if(a === 'lev-kopieer' && lev){
    const t = picqerRegels(lev).vst.join('\n');
    try{ await navigator.clipboard.writeText(t); toast('Gekopieerd.'); }catch(e){ toast('Kopiëren lukte niet, selecteer de tekst zelf.', 5000); }
    return true;
  }
  return false;
}

function view(delen){
  if(!S.demo){ try{ S.demo = localStorage.getItem('ivol-lev-demo-aan') === '1'; }catch(e){} }
  if(S.demo && D.LEVECHT === undefined) D.LEVECHT = D.LEV || {};
  if(S.demo && !D.LEV){ try{ D.LEV = JSON.parse(localStorage.getItem('ivol-lev-demo') || '{}'); }catch(e){ D.LEV = {}; } }
  if(!S.auto && !S.data && !S.bezig && (S.demo ? !!window.WHDEMO : !!(window.WHLIVE && WHLIVE.status().code))){ S.auto = true; setTimeout(laad, 0); }
  if(delen && delen[0]) return viewLevering(delen[0]);
  return viewLijst();
}
document.addEventListener('change', async ev => {
  const b = ev.target.closest('[data-d="lev-cont"]'); if(!b) return;
  const key = b.dataset.k;
  await onthoud(key, { container:b.value || null });
  teken();
});
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-d]'); if(!b) return;
  if(!/^lev-/.test(b.dataset.d || '') || b.tagName === 'SELECT') return;
  try{ await klik(b.dataset.d, b); }catch(e){ toast('Lukte niet: ' + ((e && e.message) || e), 6000); }
});
return { view, klik, laad, advies, leveringen, takenVan, naarTekst, soortVan, picqerRegels, verdelingVan, S,
  demoAan:v => { S.demo = !!v; S.data = null; S.auto = false; try{ localStorage.setItem('ivol-lev-demo-aan', v ? '1' : '0'); }catch(e){} } };
})();
