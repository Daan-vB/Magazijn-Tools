/* =====================================================================
   IVOL Warehouse — logica: locaties, productprofielen (aanvulbase),
   backorders vrijmaken, VST terughalen, aanvulronde, Picqer-imports
   Regels (Daan, 30-9-2026):
   - locatiecode GANG(2) SECTIE(2) PLAATS(A-D) HOOGTE(2)
   - hoogte 00–09 = pick (vast), 10/20/30 = bulk (tijdelijk); BX/BY/BZ: 15/30 bulk; AH = alles pick
   - vloer (00) = palletpick → aanvullen met een hele pallet
   - legbord (02–08) = klein spul, aanvullen met een doos/deel (capaciteit beperkt)
   - producten zonder picklocatie en (bijna) zonder verkoop: alleen bulk, orders zetten de verplaatsing in gang
   ===================================================================== */
window.WHL = (function(){
'use strict';
const { D, num, leeg } = WH;
let C = null;                 // cache van alle berekeningen, leeg na elke load of wijziging
const reset = () => { C = null; };

/* ---------- locaties ---------- */
const RX = /^([A-Z]{2})(\d{2})([A-D])(\d{2})$/;
const HAL_NAAM = { A:'Hal A', B:'Hal B', C:'Hal C', D:'Hal C (achter, DA–DE)' };
function locInfo(naam){
  const m = RX.exec(naam || '');
  const L = D.LOC[naam];
  const o = { naam, bestaat:!!L, bulk:L ? L.bulk : null, tijd:L ? L.tijd : null, excl:L ? L.excl : false, codes:L ? L.codes : [] };
  if(m){ o.std = true; o.gang = m[1]; o.hal = m[1][0]; o.sec = +m[2]; o.pl = m[3]; o.h = +m[4]; }
  else { o.std = false; o.container = /^Container \d+/i.test(naam || ''); }
  return o;
}
// wat de locatie volgens Daans regels hoort te zijn
function regelSoort(i){
  if(!i.std) return null;
  if(i.gang === 'AH') return 'pick';
  if(i.gang === 'BY' || i.gang === 'BZ') return i.h === 15 || i.h === 30 ? 'bulk' : i.h < 10 ? 'pick' : null;
  return i.h < 10 ? 'pick' : 'bulk';
}
function soortLoc(naam){
  if(/^Container \d+/i.test(naam || '')) return 'container';
  const L = D.LOC[naam];
  if(L) return L.bulk ? 'bulk' : 'pick';
  const i = locInfo(naam); const r = regelSoort(i);
  return r || 'onbekend';
}
const sortLoc = (a, b) => {
  const x = locInfo(a), y = locInfo(b);
  if(x.std && y.std) return x.gang.localeCompare(y.gang) || x.sec - y.sec || x.pl.localeCompare(y.pl) || x.h - y.h;
  if(x.std !== y.std) return x.std ? -1 : 1;
  return String(a).localeCompare(String(b));
};
// twijfelgevallen (30-9) die Daan later beslist: niet automatisch in een locatie-import
const TWIJFEL = new Set(['AA01A10','AA01B10','AA01C10','AA03A10','AA03B10','AA03C10','AD21C10','AD22A10','AD22B10','AE04B10','AE08A10','AE10A10','AF13A10','AF13B10','AF13C10','AF14C10',
  'BB22A00','CA12C00','CF23A00','CF23C00','DB02A00','DB02C00','DB02D00','DB06A00','DB06D00']);

/* ---------- producten ---------- */
function locsVan(code){ const p = D.P[code]; return p && p.locaties_hm ? String(p.locaties_hm).split(',').map(s => s.trim()).filter(Boolean) : []; }
function sppVan(code){ const g = (D.GEH[String(code).toLowerCase()] || []).find(x => num(x.qty) > 0); return g ? num(g.qty) : null; }
function vkVan(code){ const v = D.VK[code]; return v ? num(v.per_maand) : null; }
function naamVan(code){ const p = D.P[code]; return (p && p.naam) || ''; }
const heelGetal = x => Math.max(0, Math.ceil(x - 1e-9));

// vrije picklocatie op de vloer direct onder een bulklocatie (zelfde gang/sectie/plaats, hoogte 00)
function vrijeVloerOnder(bulks, bezet){
  for(const b of bulks){
    const i = locInfo(b); if(!i.std || i.h < 10) continue;
    const kand = [i.gang + String(i.sec).padStart(2, '0') + i.pl + '00'];
    ['A','B','C','D'].forEach(pl => { if(pl !== i.pl) kand.push(i.gang + String(i.sec).padStart(2, '0') + pl + '00'); });
    for(const k of kand){
      const L = D.LOC[k];
      if(L && !L.bulk && !L.codes.length && !bezet.has(k)) return { loc:k, direct:k === kand[0] };
    }
  }
  return null;
}

// vloer (00) = hele pallet; legbord (02–08), midden/whiteboards (AD–AH) en AH = doos/bak
const KLEIN = new Set(['AD', 'AE', 'AF', 'AG', 'AH']);
function pickSoort(i, spp){
  if(!i.std) return 'speciaal';
  if(i.gang === 'AH') return 'legbord';
  if(i.h > 0) return 'legbord';
  if(KLEIN.has(i.gang) && !spp) return 'legbord';
  return 'vloer';
}
function maakProfiel(code, bezet){
  const p = D.P[code] || {};
  const pq = D.PQ[code] || [];
  const locs = locsVan(code);
  const picks = locs.filter(l => soortLoc(l) === 'pick');
  const bulks = locs.filter(l => soortLoc(l) === 'bulk');
  const conts = locs.filter(l => soortLoc(l) === 'container');
  const vk = vkVan(code), spp = sppVan(code);
  const abc = p.abc || null;
  const bo = (C.boPer[code] || { orders:0, stuks:0 });
  const pr = {
    code, naam:p.naam || '', lev:p.leverancier || '', abc, st:num(p.voorraad_hm) || 0, vrij:num(p.vrij_hm), vst:num(p.voorraad_vst) || 0,
    vk, spp, locs, picks, bulks, conts, vstPallets:(D.VSTLOC[code] || []), pq:{ lvl:leeg(pq[0]) ? null : pq[0], tot:leeg(pq[1]) ? null : pq[1] }, virt:pq[2] === 1,
    bo, redenen:[]
  };
  const pi = picks.length ? locInfo(picks[0]) : null;
  pr.pickSoort = pi ? pickSoort(pi, spp) : null;
  if(pi && pi.bestaat && pi.tijd) pr.redenen.push({ lvl:'let', t:'picklocatie ' + picks[0] + ' staat op tijdelijk (ontkoppelt bij 0)' });
  if(picks.length > 1) pr.redenen.push({ lvl:'info', t:picks.length + ' picklocaties' });
  if(conts.length) pr.redenen.push({ lvl:'let', t:'staat (ook) op retourkar ' + conts.join(', ') });

  // ---- voorstel ----
  const wk = vk === null ? null : vk / 4.33;
  const loper = vk !== null ? vk >= 2 : (abc === 'A' || abc === 'B' || bo.orders >= 2);
  const v = { pick:picks[0] || null, nieuwePick:false, lvl:null, tot:null, type:null, zeker:vk !== null, loper };
  if(!picks.length){
    if(loper && bulks.length){
      const vrij = vrijeVloerOnder(bulks, bezet);
      if(vrij){ v.pick = vrij.loc; v.nieuwePick = true; bezet.add(vrij.loc); pr.redenen.push({ lvl:'info', t:'voorstel picklocatie ' + vrij.loc + (vrij.direct ? ' (vloer onder de bulk)' : ' (vloer in dezelfde sectie)') }); }
      else pr.redenen.push({ lvl:'let', t:'loopt, maar geen vrije vloerplek onder de bulk: kies zelf een picklocatie' });
    }
  }
  if(!v.pick){
    if(pr.st <= 0) v.type = 'leeg';
    else if(bulks.length) v.type = 'bulk';          // alleen bulk: order zet verplaatsing in gang, niet aanvullen
    else if(conts.length) v.type = 'retour';        // alleen op een retourkar
    else {
      v.type = 'los';                               // voorraad op "geen specifieke locatie" (wel pickbaar)
      if(loper) pr.redenen.push({ lvl:'let', t:'loopt, maar staat op geen specifieke locatie: geef een vaste picklocatie' });
    }
  }else{
    const soort = pickSoort(locInfo(v.pick), spp);
    v.type = soort;
    const huidigTot = num(pr.pq.tot);
    if(vk === 0 && !bo.orders){
      // loopt niet: laag houden, niet verlagen wat er al staat
      v.lvl = 1; v.tot = Math.max(2, huidigTot || 0, soort === 'vloer' && spp ? Math.min(spp, 5) : 2);
    }else if(soort === 'vloer' && spp){
      // hele pallet: zakt de pick onder ±1 week verkoop, dan precies één volle pallet erbij
      const l = wk === null ? 1 : Math.min(Math.max(1, heelGetal(wk)), Math.max(1, spp - 1));
      v.lvl = l; v.tot = l - 1 + spp;
      if(wk !== null && wk > spp) pr.redenen.push({ lvl:'let', t:'verkoopt ' + Math.round(wk / spp * 10) / 10 + ' pallets per week: dagelijks aanvullen of 2 pallets op de vloer' });
    }else if(soort === 'vloer'){
      const l = wk === null ? 1 : Math.max(1, heelGetal(wk));
      v.lvl = l; v.tot = Math.max(l + 1, huidigTot || 0, wk === null ? 0 : heelGetal(4 * wk));
      pr.redenen.push({ lvl:'info', t:'stuks per pallet onbekend (Palletlabels): aanvullen met ±1 maand verkoop' });
    }else{
      // doos/bak: aanvullen voordat een week verkoop op is; "vul aan tot" nooit lager dan nu (capaciteit onbekend)
      const l = wk === null ? Math.max(1, num(pr.pq.lvl) || 1) : Math.max(1, heelGetal(wk));
      v.lvl = l; v.tot = Math.max(l + 1, huidigTot || 0, wk === null ? 0 : heelGetal(3 * wk));
      pr.redenen.push({ lvl:'info', t:'doos/bak: controleer of ' + v.tot + ' op de picklocatie past' });
    }
    if(vk === null) pr.redenen.push({ lvl:'info', t:'geen verkoopcijfers: voorlopige waarden' });
  }
  pr.voorstel = v;

  // ---- eigen (bevestigd/aangepast in de app) ----
  const e = D.AANVUL[code] || null;
  pr.eigen = e;
  const f = Object.assign({}, v);
  if(e){
    ['pick', 'lvl', 'tot', 'type'].forEach(k => { if(e[k] !== undefined) f[k] = e[k]; });
    if(e.pick !== undefined) f.nieuwePick = !!e.pick && !locs.includes(e.pick);
  }
  pr.final = f;
  pr.imp = importWaarden(pr);
  const gelijk = !pr.imp;
  pr.status = e && e.ok ? 'bevestigd' : gelijk && !f.nieuwePick ? 'gelijk' : 'voorstel';
  pr.picqerWijzigt = !!pr.imp || f.nieuwePick;
  return pr;
}
// wat de Picqer-import voor dit product zou zetten (null = niets veranderen)
function importWaarden(pr){
  const f = pr.final;
  if(f.type === 'leeg' || f.type === 'los' || f.type === 'retour') return null;    // geen voorraad hier / geen locatie / retourkar: niets aan veranderen
  if(f.type === 'bulk' && pr.voorstel.loper && !(pr.eigen && pr.eigen.ok)) return null;   // loopt maar mist een picklocatie: eerst kiezen
  let lvl = f.lvl, tot = f.tot;
  if(f.type === 'bulk'){ lvl = null; tot = null; }                              // alleen bulk: uit het advies
  if(String(lvl ?? '') === String(pr.pq.lvl ?? '') && String(tot ?? '') === String(pr.pq.tot ?? '')) return null;
  return { lvl, tot };
}

/* ---------- alles berekenen ---------- */
function bereken(){
  if(C) return C;
  C = { boPer:{}, prof:{}, orders:[] };
  // backorders per order en per product
  const perOrder = {};
  D.BO.forEach(r => {
    const code = D.PLOW[String(r.productcode || '').toLowerCase()] || r.productcode; if(!code) return;
    const o = perOrder[r.bestelling] = perOrder[r.bestelling] || { nr:r.bestelling, regels:[], datum:r.besteld_op };
    if(r.besteld_op && (!o.datum || r.besteld_op < o.datum)) o.datum = r.besteld_op;
    o.regels.push({ code, aantal:num(r.aantal) || 0, besch:num(r.beschikbaar) || 0 });
    const b = C.boPer[code] = C.boPer[code] || { orders:0, stuks:0, set:new Set() };
    b.stuks += num(r.aantal) || 0; if(!b.set.has(r.bestelling)){ b.set.add(r.bestelling); b.orders++; }
  });
  C.orders = Object.values(perOrder).sort((a, b) => String(a.datum).localeCompare(String(b.datum)));

  // profielen: producten met voorraad hier, of in advies/backorders/aanvulbase; lopers eerst (die krijgen als eerste een vrije vloerplek)
  const codes = new Set();
  Object.values(D.P).forEach(p => { if((num(p.voorraad_hm) || 0) > 0 || (num(p.voorraad_vst) || 0) > 0) codes.add(p.productcode); });
  Object.keys(C.boPer).forEach(c => codes.add(c));
  Object.keys(D.AANVUL).forEach(c => codes.add(c));
  (D.ADV && D.ADV.rows || []).forEach(r => codes.add(D.PLOW[r.code.toLowerCase()] || r.code));
  const volg = [...codes].filter(c => D.P[c] && !((D.PQ[c] || [])[2] === 1)).sort((a, b) => (vkVan(b) || 0) - (vkVan(a) || 0) || String(a).localeCompare(b));
  const bezet = new Set();
  Object.values(D.AANVUL).forEach(e => { if(e && e.pick) bezet.add(e.pick); });
  volg.forEach(c => { C.prof[c] = maakProfiel(c, bezet); });

  // advies per product
  C.adv = {};
  (D.ADV && D.ADV.rows || []).forEach(r => { const c = D.PLOW[r.code.toLowerCase()] || r.code; C.adv[c] = r; });

  // voorgeboekt maar container nog niet (helemaal) gelost
  C.voorgeboekt = {};
  D.CONT.forEach(c => {
    if(c.status === 'afgerond') return;
    (c.voorboekingen || []).forEach(v => (v.regels || []).forEach(r => {
      const c0 = r.code || r.productcode; if(!c0) return;
      const code = D.PLOW[String(c0).toLowerCase()] || c0;
      C.voorgeboekt[code] = { cont:c, aantal:(num(r.aantal) || 0) };
    }));
  });

  analyseOrders();
  return C;
}
const prof = code => bereken().prof[code] || null;

// Waarom staat een volledig beschikbare order nog in backorder?
function blokkade(code){
  const pr = C.prof[code]; const a = C.adv[code];
  if(C.voorgeboekt[code]) return { soort:'container', t:'voorraad vooraf opgeboekt, container ' + (C.voorgeboekt[code].cont.pakbon_ref || '') + ' nog niet gelost' };
  if(a) return { soort:'advies', t:'pickvoorraad ' + (a.pickst ?? '?') + ', verplaatsen van bulk' };
  if(pr && pr.conts.length && !pr.picks.length && !pr.bulks.length) return { soort:'retour', t:'staat alleen op retourkar ' + pr.conts.join(', ') };
  if(pr && !pr.picks.length && pr.bulks.length) return { soort:'bulk', t:'geen picklocatie: van bulk naar geen specifieke locatie' };
  if(pr && pr.conts.length) return { soort:'retour', t:'deels op retourkar ' + pr.conts.join(', ') };
  return null;
}

function analyseOrders(){
  const mv = {}, vst = {}, vast = [], vstOrders = [];
  let nVol = 0;
  // VST-voorraad verdelen over de orders op volgorde (oudste eerst)
  const vstRest = {};
  C.orders.forEach(o => {
    const vol = o.regels.every(r => r.besch >= r.aantal);
    o.vol = vol;
    if(vol){
      nVol++;
      const blok = o.regels.map(r => ({ r, b:blokkade(r.code) })).filter(x => x.b);
      o.blok = blok;
      if(!blok.length){ vast.push({ o, reden:'alles beschikbaar en geen reden gevonden: gepauzeerd, handmatig of wacht op picklijst? (Verwerk backorders)' }); return; }
      if(blok.every(x => x.b.soort === 'container')){ vast.push({ o, reden:blok[0].b.t, soort:'container' }); return; }
      blok.forEach(({ r, b }) => {
        if(b.soort === 'container') return;
        const m = mv[r.code] = mv[r.code] || { code:r.code, stuks:0, orders:[], datum:o.datum, soort:b.soort, t:b.t };
        m.stuks += r.aantal; m.orders.push(o.nr); if(o.datum < m.datum) m.datum = o.datum;
      });
      return;
    }
    // niet alles hier: kan VST het aanvullen?
    const kort = o.regels.filter(r => r.besch < r.aantal);
    const kan = kort.every(r => {
      const pr = C.prof[r.code]; const beschikbaarVst = vstRest[r.code] ?? (pr ? pr.vst : num((D.P[r.code] || {}).voorraad_vst) || 0);
      return beschikbaarVst >= r.aantal - r.besch;
    });
    if(!kan) return;                              // ook met VST niet compleet: niet tonen (wacht op inkoop)
    o.vst = true; vstOrders.push(o);
    kort.forEach(r => {
      const nodig = r.aantal - r.besch;
      const pr = C.prof[r.code];
      vstRest[r.code] = (vstRest[r.code] ?? (pr ? pr.vst : 0)) - nodig;
      const v = vst[r.code] = vst[r.code] || { code:r.code, nodig:0, orders:[], datum:o.datum };
      v.nodig += nodig; v.orders.push(o.nr); if(o.datum < v.datum) v.datum = o.datum;
    });
  });
  // verplaatslijst verrijken en sorteren (oudste order eerst)
  C.mv = Object.values(mv).map(m => {
    const pr = C.prof[m.code] || {}; const a = C.adv[m.code];
    const van = a && a.bulk && a.bulk.length ? a.bulk : (pr.bulks || []);
    const naar = a && a.pick && a.pick.length ? a.pick : pr.picks && pr.picks.length ? pr.picks : [];
    m.van = van.length ? van : (pr.conts || []);
    m.naar = naar.length ? naar : null;          // null = geen specifieke locatie
    m.voorstelPick = !naar.length && pr.final && pr.final.nieuwePick ? pr.final.pick : null;
    m.advAantal = a ? a.aantal : null;
    m.pickst = a ? a.pickst : null;
    m.naam = pr.naam || naamVan(m.code);
    m.gang = (locInfo(m.van[0] || '').gang) || '–';
    return m;
  }).sort((a, b) => String(a.datum).localeCompare(String(b.datum)) || sortLoc(a.van[0] || 'ZZ', b.van[0] || 'ZZ'));
  // VST-lijst
  C.vst = Object.values(vst).map(v => {
    const pr = C.prof[v.code] || {};
    const vk = pr.vk, spp = pr.spp;
    const vrijHier = Math.max(0, pr.vrij || 0);
    const doel = vk ? heelGetal(1.5 * vk) : 0;
    let terug = v.nodig + Math.max(0, doel - vrijHier);
    terug = Math.min(terug, pr.vst || terug);
    v.pallets = spp ? Math.ceil(terug / spp) : null;
    if(spp) terug = Math.min(pr.vst || Infinity, v.pallets * spp);
    v.terug = terug; v.vk = vk; v.spp = spp; v.vstVoorraad = pr.vst; v.naam = pr.naam || naamVan(v.code); v.doel = doel;
    return v;
  }).sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
  C.vast = vast;
  C.vstOrders = vstOrders;
  C.nVol = nVol;
  // aanvulronde: advies zonder orders die al in de verplaatslijst staan
  const inMv = new Set(C.mv.map(m => m.code));
  C.ronde = (D.ADV && D.ADV.rows || []).map(r => {
    const code = D.PLOW[r.code.toLowerCase()] || r.code;
    const pr = C.prof[code] || null;
    return Object.assign({}, r, { code, pr, gang:(locInfo((r.bulk || [])[0] || '').gang) || '–' });
  }).filter(r => !inMv.has(r.code)).sort((a, b) => sortLoc((a.bulk || [])[0] || 'ZZ', (b.bulk || [])[0] || 'ZZ'));
  // in het advies, zonder picklocatie, weinig verkoop → knopje uit / niveaus leeg
  C.uitzetten = C.ronde.filter(r => r.geenPick && r.pr && r.pr.final.type === 'bulk' && !(C.boPer[r.code] || {}).orders);
}

/* ---------- Picqer-importbestanden ---------- */
const pqCode = code => { const q = D.PQ[code]; return q && q[3] ? q[3] : code; };   // exacte code (soms met spatie)
const leegOf = v => leeg(v) ? '' : v;
function importAanvul(filter){
  const b = bereken();
  const rijen = [];
  Object.values(b.prof).forEach(pr => {
    if(filter && !filter(pr)) return;
    if(pr.imp) rijen.push([pqCode(pr.code), leegOf(pr.imp.lvl), leegOf(pr.imp.tot)]);
  });
  return rijen.sort((a, b) => String(a[0]).localeCompare(b[0]));
}
function importKoppel(filter){
  const b = bereken();
  const rijen = [];
  Object.values(b.prof).forEach(pr => {
    if(filter && !filter(pr)) return;
    const f = pr.final;
    if(!f.pick || pr.locs.includes(f.pick)) return;
    if(pr.conts.length) return;                    // eerst van de retourkar af, anders kan de import mislopen
    const nieuw = pr.locs.filter(l => soortLoc(l) !== 'container').concat([f.pick]);
    rijen.push([pqCode(pr.code), nieuw.join(', ')]);
  });
  return rijen.sort((a, b) => String(a[0]).localeCompare(b[0]));
}
function locAfwijkingen(){
  const out = [];
  Object.values(D.LOC).forEach(L => {
    const i = locInfo(L.naam); const r = regelSoort(i); if(!r) return;
    const wilBulk = r === 'bulk', wilTijd = r === 'bulk';
    if(L.bulk === wilBulk && L.tijd === wilTijd) return;
    out.push({ naam:L.naam, bulk:L.bulk, tijd:L.tijd, wilBulk, wilTijd, n:L.codes.length, twijfel:TWIJFEL.has(L.naam) });
  });
  // voorgestelde nieuwe picklocaties moeten vast staan
  const b = bereken();
  Object.values(b.prof).forEach(pr => {
    const p = pr.final.pick; if(!p || !pr.final.nieuwePick) return;
    const L = D.LOC[p]; if(L && L.tijd && !out.some(o => o.naam === p)) out.push({ naam:p, bulk:L.bulk, tijd:L.tijd, wilBulk:false, wilTijd:false, n:L.codes.length, twijfel:false });
  });
  return out.sort((a, b) => sortLoc(a.naam, b.naam));
}

/* ---------- locatie-overzicht ---------- */
function locStats(){
  const per = {};
  const aand = { tijdPick:[], hoogPick:[], vloerBulk:[], dubbel:[], rommel:[], opMap:[], veel:[] };
  const namen = new Set(Object.keys(D.LOC));
  Object.values(D.LOC).forEach(L => {
    const i = locInfo(L.naam);
    if(i.std){
      const g = per[i.gang] = per[i.gang] || { gang:i.gang, hal:i.hal, pick:0, bulk:0, pickLeeg:0, bulkLeeg:0, tijdPick:0, secs:new Set(), producten:0 };
      g.secs.add(i.sec);
      if(L.bulk){ g.bulk++; if(!L.codes.length) g.bulkLeeg++; } else { g.pick++; if(!L.codes.length) g.pickLeeg++; if(L.tijd) g.tijdPick++; }
      g.producten += L.codes.length;
      const r = regelSoort(i);
      if(!L.bulk && L.tijd) aand.tijdPick.push(L.naam);
      if(r === 'bulk' && !L.bulk) aand.hoogPick.push(L.naam);
      if(r === 'pick' && L.bulk) aand.vloerBulk.push(L.naam);
      if(L.codes.length >= 15) aand.veel.push(L.naam);
    }else{
      const m = /^([A-Z]{2}\d{2}[A-D])-(\d{2})$/.exec(L.naam);
      if(m && namen.has(m[1] + m[2])){ if(L.codes.length) aand.dubbel.push(L.naam); }
      else if(/^[A-Z]{1,2}(\d{2}[A-D]?)?$/.test(L.naam)){ if(L.codes.length) aand.opMap.push(L.naam); }
      else if(L.codes.length) aand.rommel.push(L.naam);
    }
  });
  return { gangen:Object.values(per).sort((a, b) => a.gang.localeCompare(b.gang)), aand };
}

return { reset, bereken, prof, locInfo, regelSoort, soortLoc, sortLoc, TWIJFEL, HAL_NAAM, locsVan, sppVan, vkVan, naamVan,
  importAanvul, importKoppel, locAfwijkingen, locStats };
})();
