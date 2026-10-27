/* =====================================================================
   IVOL Warehouse — Productdata per familie (27-10-2026, ontwerp: docs/per-familie-ontwerp.md)
   Werkscherm per maat: kies een maat, zie alle kleuren onder elkaar, één rij per product.
   Alles wat de app uit Picqer, inkoop, verplaatsingen, verkoop en voorraad kan afleiden wordt getoond en voorgesteld,
   met de reden erbij. Een voorstel is nooit een opgeslagen waarde: alleen een klik of invoer van Daan slaat iets op,
   per product in productdata (bron invul), en ingevulde waarden blijven altijd staan.
   Per soort andere vragen: Pick = picklocatie, max op pick en gecontroleerd gewicht; Deel, Pallet en Mix ook de palletvelden;
   Rol alleen backorder niets. Maatgroep = alleen de maat uit de naam. Familienamen, indeling en eenheid: catalog-rij wh-pd-fam
   (index() in productdata.js geeft die voorrang). Uitlopend = productdata.uitlopend (datum): geen velden, telt nergens mee.
   Voorraad per locatie, inkoop en backorders: live uit Picqer (alleen lezen, met rem), anders de export.
   ===================================================================== */
window.WHPDF = (function(){
'use strict';
const { $, esc, nf, plural, num, leeg, toast, D, isoDag } = WH;
const P = () => window.WHPD, X = () => WHPD.intern;
const KEY = 'wh-pd-fam';
const app = () => $('app');


/* ---------- hulpjes ---------- */
const bronVan = (c, k) => { const r = P().S.pd[c]; return (r && r.meta && r.meta[k] && r.meta[k].bron) || ''; };
const isUitl = c => !!X().pdWaarde(c, 'uitlopend');
const naamUitl = c => /uitlopend/i.test(String((D.P[c] || {}).naam || '')) && !isUitl(c);   // voorstel "Uitlopend?", nooit automatisch
const cor = () => P().S.fcor || (P().S.fcor = X().famCorNorm(null));
// grenzen uit wh/aannames.js (Daan kan ze in Te controleren aanpassen)
const aan = (id, std) => { const v = window.WHAAN ? parseFloat(String(WHAAN.waarde(id) || '').replace(',', '.')) : NaN; return isNaN(v) ? std : v; };
const LIGKG = () => aan('p-ligkg', 2000), DOOSKG = () => aan('p-dooskg', 30), DOOSCM = () => aan('p-dooscm', 50), DPDCM = () => aan('p-dpdcm', 170);
// breedte van een rol uit de naam ("… 125 cm breed", "Kokos 200 cm …"), voor de doos-lengte
const breedteNaam = c => { const n = String((D.P[c] || {}).naam || ''); const m = n.match(/(\d{2,3})\s*cm\s*(breed|br\b)/i) || n.match(/breed(?:te)?\s*(\d{2,3})/i) || n.match(/\b(\d{2,3})\s*cm\b/i); return m ? +m[1] : null; };
// eenheid per familie vastzetten ("cm, Picqer-eenheid negeren"); Kokos op rol staat standaard op cm (besluit Daan 16-10)
const EH_STD = { 'Kokos op rol':'cm' };
const ehVast = fk => { const v = X().famCorWaarde('eh', fk); if(v) return v === 'picqer' ? '' : v; return EH_STD[famNaam(fk)] || ''; };
const EHT2 = { cm:{ e:'cm', mv:'cm', t:'per cm' }, m:{ e:'m', mv:'m', t:'per meter' }, st:{ e:'st', mv:'st.', t:'per stuk' } };
const ehProd = (fk, c) => { const v = ehVast(fk); return v && EHT2[v] ? EHT2[v] : P().eenheid(c); };

/* ---------- indeling ---------- */
const famVan = c => P().index().famVan[c];
const maatVan = c => { const vk = P().index().varVan[c] || ''; return vk.slice(String(famVan(c) || '').length + 1); };
const zichtbaar = c => X().actief(c) && (isUitl(c) || X().inScope(c, 'belangrijk', false) || X().inScope(c, 'beweegt', false) || X().inScope(c, 'voorraad', false));
const leden = fk => (P().index().fam[fk] || []).filter(zichtbaar).sort((a, b) => maatVan(a).localeCompare(maatVan(b)) || X().rang(a) - X().rang(b));
const actiefLeden = fk => leden(fk).filter(c => !isUitl(c));
const famNaam = fk => { const n = X().famCorWaarde('naam', fk); return n || X().famTitel(fk, leden(fk).length ? leden(fk) : (P().index().fam[fk] || [])); };
function maatgroepen(fk){
  const m = new Map();
  actiefLeden(fk).forEach(c => { const k = maatVan(c); if(!m.has(k)) m.set(k, []); m.get(k).push(c); });
  // naam: de volledigste maat die bij de producten hoort ("200 cm · 17 mm", ook als de groep na samenvoegen "200 cm" heet)
  const delen = x => String(x || '').split('·').filter(y => y.trim()).length;
  return [...m.entries()].map(([k, cs]) => {
    const nat = cs.map(c => P().maatSig(String((D.P[c] || {}).naam || ''))).filter(x => x && (!k || x.startsWith(k)));
    const t = [k].concat(nat).filter(Boolean).sort((a, b) => delen(b) - delen(a) || b.length - a.length)[0];
    return { k, cs, t:t || 'zonder maat' };
  });
}
// open velden laag 1–3 van de leden (voor de lijst en de voortgang)
function telOpen(fk){
  let velden = 0, gevuld = 0;
  actiefLeden(fk).forEach(c => { const w = P().waardeFn(c); [1, 2, 3].forEach(n => P().inLaag(n).forEach(k => { if(!P().nodig(c, k, w)) return; velden++; if(P().staat(c, k).s === 'ok') gevuld++; })); });
  return { velden, gevuld, open:velden - gevuld };
}
// families die ertoe doen: minstens één belangrijk product (A, B of op een open container)
const LC = { idx:null, ver:-1, v:null };
let VER = 0;
const vers = () => { VER++; };
function famLijst(){
  const I = P().index();
  if(LC.idx === I && LC.ver === VER && LC.v) return LC.v;
  const uit = [];
  Object.keys(I.fam).forEach(fk => {
    const ls = actiefLeden(fk); if(!ls.length) return;
    const bel = ls.filter(c => X().inScope(c, 'belangrijk', false));
    if(!bel.length) return;
    const t = telOpen(fk);
    uit.push({ fk, naam:famNaam(fk), n:ls.length, maten:new Set(ls.map(maatVan)).size, ab:ls.some(c => /^[AB]$/.test(X().abcVan(c))), binnen:ls.some(c => I.binnen.has(c)), ...t });
  });
  uit.sort((a, b) => ((b.ab || b.binnen) - (a.ab || a.binnen)) || b.n - a.n || a.naam.localeCompare(b.naam));
  Object.assign(LC, { idx:I, ver:VER, v:uit });
  return uit;
}
// volgende familie met open velden (Te doen 0.4, knop Volgende familie)
function volgende(na){
  const L = famLijst().filter(f => f.open);
  if(!na) return L[0] || null;
  const i = L.findIndex(f => f.fk === na);
  return L[i + 1] || L.find(f => f.fk !== na) || null;
}
function voortgang(){ const L = famLijst(); return { klaar:L.filter(f => !f.open).length, tot:L.length }; }

/* ---------- correcties bewaren (wh-pd-fam) ---------- */
async function bewaarCor(fn, tekst){
  const d = JSON.parse(JSON.stringify(cor()));
  fn(d);
  try{
    await WH.catZet(KEY, d);
    P().S.fcor = X().famCorNorm(d); P().S.idx = null; vers();
    if(tekst) toast(tekst, 3500);
  }catch(e){ toast('Opslaan indeling mislukt: ' + e.message, 6000); }
  X().rerender();
}
// voorstel voor de twee proeffamilies (Daan neemt het over met één klik, of niet)
const VOORSTEL = [
  { id:'kokos', naam:'Kokos op rol', eh:'cm', uit:'Kokos 100 en 200 cm, 17 en 24 mm (rollen per cm) uit twee families samen; de deurmatten blijven apart.',
    codes:() => Object.values(D.P).filter(p => /^(kokos\s+(100|200)\s*cm|kokos\s+rol|kokosmat\s+op\s+rol)/i.test(String(p.naam || '').trim())).map(p => p.productcode) },
  { id:'trapmat', naam:'Trapmat', uit:'Alle trapmatten van Vica (Bueno, Luego, Baleno, Novelle, Turbo, Lines, Multi Stripes) in één familie, maatgroepen per maat; Bueno en Luego samen in 16x56. Turbo 25x60 en Novelle bruin 20x56 gaan op uitlopend (Daan, 16-10). Pakketten van 15 (BOL-) en rubber/aluminium blijven apart.',
    codes:() => Object.values(D.P).filter(p => /^vica/i.test(String(p.leverancier || '')) && /^trapmat\b/i.test(String(p.naam || '').trim())).map(p => p.productcode),
    maat:c => /^trapmat\s+(bueno|luego)\b/i.test(String((D.P[c] || {}).naam || '')) ? '16x56' : null,
    uitl:c => /^trapmat\s+(turbo\b.*25x60|novelle\s+bruin\b.*20x56)/i.test(String((D.P[c] || {}).naam || '')) }
];
function voorstelInfo(v){
  const cs = v.codes().filter(c => D.P[c] && X().actief(c));
  if(cs.length < 2) return null;
  const fks = [...new Set(cs.map(famVan))];
  return { v, cs, fks, doel:fks.sort((a, b) => (P().index().fam[b] || []).length - (P().index().fam[a] || []).length)[0], klaar:fks.length === 1 && cor().naam[fks[0]] === v.naam };
}

// voorstel-indeling overnemen: familie, naam, vaste maatgroepen en (op aanwijzing van Daan) uitlopend
async function neemOver(id){
  const x = voorstelInfo(VOORSTEL.find(v => v.id === id) || {}); if(!x) return null;
  await bewaarCor(d => { x.cs.forEach(c => { d.fam[c] = x.doel; const m = x.v.maat && x.v.maat(c); if(m) d.maat[c] = m; }); d.naam[x.doel] = x.v.naam; if(x.v.eh) d.eh[x.doel] = x.v.eh; }, 'Indeling ' + x.v.naam + ' overgenomen');
  const u = x.v.uitl ? x.cs.filter(c => x.v.uitl(c) && !isUitl(c)) : [];
  if(u.length) await zetUitlopend(u, true);
  return { doel:x.doel, n:x.cs.length, uitl:u };
}
async function zetUitlopend(codes, aan){
  const wijz = {}; codes.forEach(c => { wijz[c] = { uitlopend:aan ? isoDag() : '' }; });
  try{ await P().opslaan(wijz, 'invul'); P().S.idx = null; vers(); toast(plural(codes.length, 'product', 'producten') + (aan ? ' op uitlopend' : ' terug'), 3500); }
  catch(e){ toast('Opslaan mislukt: ' + e.message, 6000); }
  X().rerender();
}

/* ---------- voorstellen per product, uit eigen data (nooit een gok, nooit voorgevuld) ----------
   Een voorstel heeft altijd een reden en wordt pas opgeslagen na een klik of invoer van Daan. */
const SOORTEN = [['pick', 'Pick'], ['deel', 'Deel'], ['pallet', 'Pallet'], ['mix', 'Mix'], ['rol', 'Rol alleen backorder']];
const SOORTT = Object.fromEntries(SOORTEN);
const UITLEG = [
  ['Pick', 'komt in kleine aantallen binnen en past helemaal op de pickplek, geen bulk.'],
  ['Deel', 'komt op een pallet of in grotere hoeveelheid binnen dan op pick past; een deel gaat naar pick, de rest naar bulk, aanvullen met een deel van de bulkvoorraad.'],
  ['Pallet', 'komt per volle pallet binnen en wordt per volle pallet aangevuld.'],
  ['Mix', 'een pallet met meerdere producten erop, met een gedeelte naar pick gevuld.'],
  ['Rol alleen backorder', 'alleen via backorder besteld.']
];
// velden per soort: Pick = picklocatie, max op pick en gewicht; Deel, Pallet en Mix ook de palletvelden; Rol alleen backorder niets
const PALVELDEN = ['maat', 'hoogte', 'plaatsen', 'maxlig'];
const veldenVan = so => so === 'rol' ? [] : so === 'pick' ? ['pick', 'maxpick', 'kgst'] : ['pick', 'maxpick', 'spp', 'maat', 'hoogte', 'gewicht', 'plaatsen', 'maxlig', 'kgst'];
const VELDT = { pick:'Picklocatie', maxpick:'Max op pick', spp:'Stuks per pallet', maat:'Palletmaat', hoogte:'Hoogte incl. pallet', gewicht:'Gewicht volle pallet', plaatsen:'Plaatsen op ligger', maxlig:'Max pallets per ligger', kgst:'Gewicht gecontroleerd' };
const ikRijen = c => ((P().S.ink && P().S.ink.p && P().S.ink.p[c]) || []).map(x => ({ d:String(x[0] || ''), b:num(x[1]) || 0 })).filter(x => x.b > 0);
// hoeveelheden per inkooporder die voorkwamen, meest voorkomend eerst (bij gelijk: de recentste)
function hoeveel(c){
  const t = {}; ikRijen(c).forEach(x => { const e = t[x.b] = t[x.b] || { v:x.b, n:0, d:'' }; e.n++; if(x.d > e.d) e.d = x.d; });
  return Object.values(t).sort((a, b) => b.n - a.n || b.d.localeCompare(a.d));
}
const hoeveelTxt = h => h.slice(0, 6).map(x => nf(x.v) + (x.n > 1 ? ' (' + x.n + '×)' : '')).join(', ') + (h.length > 6 ? ' …' : '');
// wat er op de pickplek past: "vul aan tot" in Picqer (de standaard 1 / 11 telt niet)
function capPick(c){ const pq = D.PQ[c] || [], a = num(pq[0]), b = num(pq[1]); return b > 1 && !(a === 1 && b === 11) ? b : null; }
const eigenOk = (c, k) => { const st = P().staat(c, k); return st.s === 'ok' ? st : null; };    // alleen echte invoer; schattingen en oude waarden zijn voorstellen
const eigenV = (c, k) => { const st = eigenOk(c, k); return st ? String(st.v) : ''; };
const soortNu = c => { const v = eigenV(c, 'opslag'); return SOORTT[v] ? v : ''; };
const maatDims = c => { const m = String(P().maatSig(naamVan(c)) || '').match(/(\d+[.,]?\d*)x(\d+[.,]?\d*)/); return m ? [parseFloat(m[1].replace(',', '.')), parseFloat(m[2].replace(',', '.'))].sort((a, b) => a - b) : null; };
const maatKey = c => { const d = maatDims(c); return d ? d.join('x') : ''; };
// rollen komen boven 60x100 opgerold binnen: daar nooit een palletmaat of plaats uit de afmeting afleiden (de bestaande rolregels blijven)
const rolMaat = c => { const e = P().eenheid(c).e; if(e === 'cm' || e === 'm' || e === 'rol') return true; const d = maatDims(c); return !!d && (d[0] > 60 || d[1] > 100); };
const PALKG = () => { const m = String(window.WHAAN ? WHAAN.waarde('p-gew') : '').match(/\+\s*(\d+)\s*kg/); return m ? +m[1] : 15; };
const EHN = { st:'stuk', m:'meter', cm:'cm', rol:'rol', m2:'m²' };
const mediaanVan = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };
const kgTxt = n => nf(n, n < 10 ? 2 : 1) + ' kg';

/* gewicht per stuk: Picqer slaat gram op (gewicht_product_g), hier in kg; het gecontroleerde gewicht (veld kgst) gaat voor */
function gewInfo(c){
  const e = eigenOk(c, 'kgst'), v = e ? num(e.v) : null, m = P().S.pd[c] && P().S.pd[c].meta && P().S.pd[c].meta.kgst;
  const pq = P().kgPicqer(c) || null;
  return { eig:v > 0 ? v : null, gewogen:!!(m && m.gew), pq, eff:v > 0 ? v : pq, uitPq:!(v > 0) && !!pq };
}
// afwijking van de andere kleuren in dezelfde maat (meer dan 30%), of 0/ontbreekt
function gewWaarsch(c, cs){
  const g = gewInfo(c);
  if(!g.eff) return 'ontbreekt';
  const rest = cs.filter(x => x !== c).map(x => gewInfo(x).eff).filter(x => x > 0), med = mediaanVan(rest);
  if(med && Math.abs(g.eff - med) / med > 0.3) return 'wijkt ' + Math.round(Math.abs(g.eff - med) / med * 100) + '% af van de andere kleuren (' + kgTxt(med) + ')';
  return '';
}

/* vergelijkbare producten: zelfde leverancier en dezelfde afmeting, met al bevestigde palletgegevens */
let CMP = { ver:-1, idx:null, m:null };
function cmpIndex(){
  const I = P().index();
  if(CMP.idx === I && CMP.ver === VER && CMP.m) return CMP.m;
  const m = {};
  Object.values(D.P).forEach(p => { const c = p.productcode, k = maatKey(c), l = String(p.leverancier || '').trim(); if(!k || !l || X().isSam(c)) return; (m[l + '|' + k] = m[l + '|' + k] || []).push(c); });
  CMP = { ver:VER, idx:I, m };
  return m;
}
function vsVergelijk(c, k){
  const key = maatKey(c), l = String((D.P[c] || {}).leverancier || '').trim(); if(!key || !l) return null;
  const rest = (cmpIndex()[l + '|' + key] || []).filter(x => x !== c && eigenV(x, k) !== '' && !X().NVT(eigenV(x, k)) && !X().LEEGWAARDE(eigenV(x, k)));
  if(!rest.length) return null;
  const t = {}; rest.forEach(x => { const v = eigenV(x, k); (t[v] = t[v] || []).push(x); });
  const e = Object.entries(t).sort((a, b) => b[1].length - a[1].length), top = e[0];
  if(top[1].length / rest.length < 0.5) return null;
  return { v:top[0], why:'zelfde leverancier en dezelfde afmeting (' + key + '): ' + plural(top[1].length, 'product heeft', 'producten hebben') + ' ' + X().toonWaarde(top[1][0], k, top[0]) + ' (' + top[1].slice(0, 3).join(', ') + (top[1].length > 3 ? ' …' : '') + ')' };
}
// hoogte uit de afmetingen per stuk en stuks per pallet, naar boven op 10 cm; de afmetingen komen uit Picqer
function vsHoogte(c, spp, maat){
  const e = P().S.extra[c] || {}, l = num(e.lengte_product_cm), b = num(e.breedte_product_cm), h = num(e.hoogte_product_cm);
  if(!(l > 0 && b > 0 && h > 0)) return { miss:'afmetingen per stuk ontbreken in Picqer' };
  if(!(spp > 0)) return { miss:'eerst stuks per pallet' };
  const pm = String(maat || '').match(/(\d+)\s*x\s*(\d+)/), PL = pm ? +pm[1] : 120, PB = pm ? +pm[2] : 80;
  const per = Math.max(Math.floor(PL / l) * Math.floor(PB / b), Math.floor(PL / b) * Math.floor(PB / l), 1), lagen = Math.ceil(spp / per);
  const v = Math.ceil((lagen * h + 15) / 10) * 10;
  return { v:String(v), why:nf(spp) + ' stuks, ' + nf(per) + ' per laag = ' + nf(lagen) + ' lagen × ' + nf(h) + ' cm + 15 cm pallet, naar boven op 10 cm (pallet ' + (pm ? pm[0] : '120x80') + ')' };
}

/* alle voorstellen voor één product, met reden. ctx = het product zoals het nu is of na de voorstellen */
function vsProduct(c, f, cs){
  const V = {}, ik = P().inkVan(c), hv = hoeveel(c), cap = capPick(c);
  const nu = k => eigenV(c, k);
  // soort
  let so = soortNu(c);
  const bewaardSo = so;
  {
    const ms = X().mvSoort(c);
    if(ms) V.opslag = { v:ms.soort, why:ms.t };
    else if(f.opBulk > 0 || f.bulk.length){
      if(ik && cap !== null && ik.gem > cap) V.opslag = { v:'deel', why:'bulk ' + nf(f.opBulk) + ', inkoop ø ' + nf(ik.gem, 0) + ' per order: past niet op pick (vul aan tot ' + nf(cap) + ')' };
      else if(ik && ik.gem > Math.max(f.opPick, 1)) V.opslag = { v:'deel', why:'bulk ' + nf(f.opBulk) + ', inkoop ø ' + nf(ik.gem, 0) + ' per order: meer dan er nu op pick ligt (' + nf(f.opPick) + ')' };
      else if(ik) V.opslag = { v:'pick', why:'bulk ' + nf(f.opBulk) + ', maar inkoop ø ' + nf(ik.gem, 0) + ' per order past op pick' };
      else V.opslag = { v:'deel', why:'bulk ' + nf(f.opBulk) + ' aanwezig, geen inkoop in 12 maanden' };
    }else if(f.tot === 0 && f.bo && !ik && rolMaat(c)) V.opslag = { v:'rol', why:'geen voorraad, geen inkoop in 12 maanden, wel ' + plural(f.bo.n, 'openstaande backorder', 'openstaande backorders') };
    else if(ik) V.opslag = { v:'pick', why:'geen bulk, inkoop ø ' + nf(ik.gem, 0) + ' per order' };
    else if(f.tot > 0) V.opslag = { v:'pick', why:'geen bulk, voorraad ' + nf(f.tot) + ', geen inkoop in 12 maanden' };
    else { const st = P().staat(c, 'opslag'); if(st.s === 'oud' && st.v) V.opslag = { v:st.v, why:st.bron || 'eerder ingevuld', oud:true }; }
    if(bewaardSo){ if(V.opslag && !V.opslag.oud && V.opslag.v !== bewaardSo) V.opslagAfw = V.opslag; delete V.opslag; }
    else so = V.opslag ? V.opslag.v : '';
  }
  const velden = veldenVan(so);
  // picklocatie
  if(velden.includes('pick') && !eigenOk(c, 'pick')){
    if(f.heeftPick) V.pick = { v:'ja', why:'Picqer: picklocatie ' + f.pick.slice(0, 3).map(x => x.n + ' (' + nf(x.v) + ')').join(', ') };
    else if(f.tot > 0) V.pick = { v:'nee', why:'geen picklocatie in Picqer, voorraad ' + nf(f.tot) };
  }
  const picknee = (eigenV(c, 'pick') || (V.pick && V.pick.v)) === 'nee';
  // max op pick: Pick = gemiddelde inkoop per order; Deel/Pallet/Mix = bestaande regels, anders het Picqer-niveau
  if(velden.includes('maxpick') && !picknee && !eigenOk(c, 'maxpick')){
    if(so === 'pick'){
      if(ik) V.maxpick = { v:String(Math.round(ik.gem)), why:'gemiddelde inkoop ø ' + nf(ik.gem, 0) + ' per order (' + plural(ik.n, 'order', 'orders') + ')' };
    }else{
      let r = null; try{ r = P().voorstel(c, 'maxpick', P().waardeFn(c)); }catch(e){}
      if(r && !leeg(r.v) && r.r !== 'conflict' && !r.tw) V.maxpick = { v:String(r.v), why:r.bron || 'regel' };
      else if(cap !== null) V.maxpick = { v:String(cap), why:'Picqer: vul aan tot ' + nf(cap) };
    }
  }
  if(velden.includes('spp') && !eigenOk(c, 'spp')){
    if(hv.length) V.spp = { v:String(hv[0].v), why:'meest voorkomende hoeveelheid per inkooporder: ' + hoeveelTxt(hv), hv };
    else { let sb = null; try{ const b = X().sppBronnen(c); sb = ['mvvst', 'vst2', 'bulk2', 'vst1', 'bulk1', 'pakbon'].map(r => b[r]).find(Boolean); }catch(e){}
      if(sb && num(sb.v) > 0) V.spp = { v:String(num(sb.v)), why:sb.t || 'uit pakbon of voorraad' }; }
  }
  const sppEff = num(eigenV(c, 'spp')) || (V.spp ? num(V.spp.v) : null);
  const rol = rolMaat(c);
  // palletmaat en plaatsen: alleen uit vergelijkbare producten (rollen: de bestaande rolregels)
  ['maat', 'plaatsen', 'maxlig'].forEach(k => {
    if(!velden.includes(k) || eigenOk(c, k)) return;
    let r = null;
    if(rol && k !== 'maxlig'){ try{ const x = P().voorstel(c, k, P().waardeFn(c)); if(x && !leeg(x.v) && x.r !== 'conflict' && !x.tw) r = { v:String(x.v), why:(x.bron || 'rolregel') + ' (bestaande rolregel)' }; }catch(e){} }
    else r = vsVergelijk(c, k);
    if(r) V[k] = r;
  });
  if(velden.includes('hoogte') && !eigenOk(c, 'hoogte')){
    if(rol){ try{ const x = P().voorstel(c, 'hoogte', P().waardeFn(c)); if(x && !leeg(x.v) && x.r !== 'conflict' && !x.tw) V.hoogte = { v:String(x.v), why:(x.bron || 'rolregel') + ' (bestaande rolregel)' }; }catch(e){} }
    else { const h = vsHoogte(c, sppEff, eigenV(c, 'maat') || (V.maat && V.maat.v)); if(h.v) V.hoogte = h; else V.hoogteMis = h.miss; }
  }
  // gewicht volle pallet = stuks per pallet × gewicht per stuk + palletgewicht
  const g = gewInfo(c);
  const palGew = sppEff > 0 && g.eff > 0 ? sppEff * g.eff + PALKG() : null;
  if(velden.includes('gewicht') && palGew){
    const som = nf(sppEff) + ' × ' + kgTxt(g.eff) + ' + ' + nf(PALKG()) + ' kg pallet = ' + nf(palGew, 1) + ' kg';
    if(!eigenOk(c, 'gewicht')) V.gewicht = { v:String(Math.round(palGew)), som, why:'', te:g.uitPq };
    else V.gewichtRef = { som, te:g.uitPq };
  }
  if(velden.includes('maxlig') && !eigenOk(c, 'maxlig') && !V.maxlig){
    const gw = num(eigenV(c, 'gewicht')) || palGew;
    if(gw > 0) V.maxlig = { v:String(Math.max(1, Math.floor(LIGKG() / gw))), why:nf(LIGKG()) + ' kg per ligger / ' + nf(gw, 0) + ' kg per pallet (alleen op gewicht)' };
  }
  return { V, so, velden };
}
// vlag voor een voorstel met een gok van Claude: staat ingevuld als schatting, telt niet; hier alleen tonen
const gokVan = (c, k) => { const st = P().staat(c, k); return st.s === 'oud' && st.tw && st.v ? { v:String(st.v), why:st.bron || 'schatting Claude, te controleren', gok:true } : null; };

/* ---------- voortgang per maat ---------- */
function telCs(cs){
  let velden = 0, gevuld = 0;
  cs.forEach(c => { const w = P().waardeFn(c); [1, 2, 3].forEach(n => P().inLaag(n).forEach(k => { if(!P().nodig(c, k, w)) return; velden++; if(P().staat(c, k).s === 'ok') gevuld++; })); });
  return { velden, gevuld, open:velden - gevuld };
}
function gewichtOverzicht(fk){
  const per = {}; actiefLeden(fk).forEach(c => { (per[maatVan(c)] = per[maatVan(c)] || []).push(c); });
  let zonder = 0, afw = 0;
  Object.values(per).forEach(cs => cs.forEach(c => { const w = gewWaarsch(c, cs); if(w === 'ontbreekt') zonder++; else if(w) afw++; }));
  return { zonder, afw };
}
const maatSort = (a, b) => { const da = (a.cs[0] && maatDims(a.cs[0])) || [1e9, 1e9], db = (b.cs[0] && maatDims(b.cs[0])) || [1e9, 1e9]; return da[0] * da[1] - db[0] * db[1] || String(a.k).localeCompare(String(b.k)); };

/* ---------- weergave ---------- */
const UI = { zoek:'', n:40, open:{}, bezig:false, uitslag:null, vopen:{}, vtab:'', asub:'' };
function stijl(){
  if($('pdf-stijl')) return;
  const s = document.createElement('style'); s.id = 'pdf-stijl';
  s.textContent = `
  .pf-lijst{display:grid;gap:8px}
  .pf-fam{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:center;background:#fff;border:1px solid #d6dde5;border-radius:10px;padding:10px 14px;text-decoration:none;color:inherit}
  .pf-fam:hover{border-color:var(--blue)} .pf-fam.klaar{opacity:.6}
  .pf-fam b{font-size:15px} .pf-fam .u{font-size:12.5px;color:var(--muted)}
  .pf-pct{font-variant-numeric:tabular-nums;font-weight:800;text-align:right;white-space:nowrap}
  .pf-kop{display:grid;gap:6px}
  .pf-stats{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px}
  .pf-stats b{font-variant-numeric:tabular-nums}
  .pf-sec{background:#fff;border:1px solid #d6dde5;border-radius:10px;margin-bottom:14px;overflow:hidden}
  .pf-sec > h3{margin:0;padding:10px 14px;font-size:15px;background:#fbfcfd;border-bottom:1px solid #e3e8ee;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
  .pf-sec > h3 .u{font-size:12px;font-weight:600;color:var(--muted)}
  .pf-rij{display:grid;grid-template-columns:170px minmax(0,220px) minmax(0,1fr);gap:6px 14px;padding:9px 14px;border-bottom:1px solid #eef1f4;align-items:start}
  .pf-rij:last-child{border-bottom:0}
  .pf-rij label{font-weight:700;font-size:13.5px;padding-top:8px}
  .pf-in{width:100%;font-size:15px;padding:8px 10px;min-height:40px}
  .pf-in.ok{background:#f3f9f5;border-color:#b9dbc5} .pf-in.voorstel{background:#fff8d6;border-color:#d9b640}
  .pf-in.schatting{background:#fff;border-style:dashed} .pf-in.nieuw{background:#eef4fc;border-color:#9db8e3} .pf-in.fout{background:#fff6f5;border:2px solid var(--bad)}
  .pf-why{font-size:12px;color:#4a5a6a;padding-top:4px;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}
  .pf-why .sc{color:var(--muted)}
  .pf-k{font-size:11px;padding:2px 7px;border:1px solid #c9ced6;border-radius:4px;background:#f6f7f9;color:#445;cursor:pointer;white-space:nowrap}
  .pf-k:hover{border-color:var(--blue);color:var(--blue)}
  .pf-tab{overflow-x:auto}
  .pf-t{border-collapse:separate;border-spacing:0;font-size:13px;min-width:100%}
  .pf-t th{text-align:left;padding:6px;font-size:10.5px;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);font-weight:700;border-bottom:1px solid #d6dde5;background:#fbfcfd;white-space:nowrap;vertical-align:bottom}
  .pf-t th .pf-k{display:block;margin-top:3px;text-transform:none;letter-spacing:0;font-weight:600}
  .pf-t td{padding:4px;border-bottom:1px solid #e3e8ee;vertical-align:top}
  .pf-t td.kop{position:sticky;left:0;background:#fff;z-index:1;min-width:150px;max-width:260px;white-space:normal;border-right:1px solid #d6dde5}
  .pf-t .pf-in{min-width:84px;font-size:14px;min-height:36px;padding:5px 7px}
  .pf-t .pf-why{max-width:170px;font-size:11px}
  .pf-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#e8891c;margin-right:4px}
  .pf-keus{font-size:12.5px;background:#fff4e5;border:1px solid #f1d2a8;border-radius:8px;padding:6px 8px;margin-top:4px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .pf-uitl td{background:#f3f5f8;color:#8795a4}
  .pf-voet{position:sticky;bottom:0;z-index:5;background:rgba(255,255,255,.97);border:1px solid #d6dde5;border-bottom:0;box-shadow:0 -6px 18px rgba(19,32,44,.07);padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));border-radius:10px 10px 0 0;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between}
  .pf-voet .btn{min-height:44px}
  .pf-regels{font-size:13px} .pf-regels li{margin:3px 0}
  .pf-mt{table-layout:fixed;width:100%;min-width:0}
  .pf-mt col.kopcol{width:150px}
  .pf-mt th{white-space:normal;overflow-wrap:anywhere;hyphens:auto;line-height:1.25}
  .pf-mt th .pf-k{white-space:normal;text-align:left;width:100%}
  .pf-mt td.kop{position:static;min-width:0;max-width:none}
  .pf-mt .pf-in{min-width:0;width:100%;padding:5px 6px}
  .pf-mt .pf-why{max-width:none;overflow-wrap:anywhere}
  .pf-mt .pf-acties select{width:100%}
  .pf-mld{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:3px;color:inherit;border-bottom:1px dashed currentColor;line-height:1.4}
  .pf-mld:hover,.pf-mld:focus-visible{color:var(--blue);outline:none}
  .pf-mld.rood{color:var(--bad);font-size:12.5px;display:block;border-bottom:0;text-decoration:underline dashed}
  .pf-regel{margin-top:4px;font-size:12px;color:var(--bad);background:#fff3f2;border:1px solid #f0c3be;border-radius:6px;padding:4px 6px;display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center}
  .pf-in.regel{border:2px solid var(--bad)}
  .pf-paneel{margin-top:6px;background:#fffdf5;border:1px solid #e6d27a;border-radius:8px;padding:8px 10px;font-size:13px;box-shadow:0 2px 8px rgba(19,32,44,.08)}
  .pf-pzin{font-weight:600;margin-bottom:6px}
  .pf-ptab{width:100%;border-collapse:collapse} .pf-ptab td{padding:4px 6px;border-top:1px solid #eee3b8;vertical-align:top}
  .pf-ptab tr.gelijk td{color:#7a8795}
  .pf-pact{text-align:right} .pf-pzet{display:inline-flex;gap:4px;align-items:center}
  .pf-pzet input{width:96px;min-height:34px;padding:4px 6px}
  .pf-k.pri{background:var(--blue);border-color:var(--blue);color:#fff}
  .pf-paneelrij td{background:#fffdf5}
  .pf-mg{border-bottom:1px solid #d6dde5} .pf-mg:last-child{border-bottom:0}
  .pf-mgkop{padding:10px 14px;background:#f7f9fb;border-bottom:1px solid #e3e8ee}
  .pf-acties > summary{list-style:none;display:inline-block} .pf-acties > summary::-webkit-details-marker{display:none}
  .pf-acties select{max-width:100%}
  .pf-vrs{color:#4a5a6a;margin-top:2px;font-weight:400}
  .pf-sec > h3 .pf-k{margin-left:auto}
  .pf-vrstand{padding:6px 14px 0}
  .pf-vrtabs{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px 4px}
  .pf-vrtabs.sub{padding:2px 14px 4px}
  .pf-vrtab{border:1px solid #c9ced6;background:#f6f7f9;border-radius:8px;padding:8px 12px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;min-height:40px;color:inherit}
  .pf-vrtab.klein{font-size:12.5px;min-height:34px;padding:5px 10px;font-weight:600}
  .pf-vrtab.on{background:var(--blue);border-color:var(--blue);color:#fff}
  .pf-vrtab .n{font-variant-numeric:tabular-nums;opacity:.85;margin-left:6px}
  .pf-vrsam{padding:6px 14px 8px;color:#4a5a6a}
  .pf-vrmg{border-top:1px solid #e3e8ee}
  .pf-vrmg > summary{padding:9px 14px;cursor:pointer;background:#f7f9fb}
  .pf-vrrij{display:grid;grid-template-columns:minmax(170px,1.2fr) minmax(0,2fr) minmax(0,1.8fr) auto;gap:6px 14px;padding:9px 14px;border-top:1px solid #eef1f4;align-items:start;font-size:13px}
  .pf-vrrij .l{font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);font-weight:700;margin-right:3px}
  .pf-loc{display:inline-block;background:#eef4fc;border:1px solid #cddcf2;border-radius:5px;padding:1px 6px;margin:1px 3px 1px 0;font-size:12.5px}
  .pf-loc.tijd{background:#fff4e5;border-color:#f1d2a8}
  .pf-vrkeuze{display:flex;gap:6px;flex-wrap:wrap}
  @media (max-width:760px){
    .pf-vrrij{grid-template-columns:1fr;padding:10px 12px} .pf-vrtab{flex:1 1 auto}
    .pf-rij{grid-template-columns:1fr;padding:10px 12px} .pf-rij label{padding-top:0}
    .pf .btn, .pf .pf-k, .pf input, .pf select{min-height:44px}
    .pf .pf-k{display:inline-flex;align-items:center;padding:8px 10px;font-size:13px;border-radius:6px}
    .pf .pf-t th .pf-k{display:flex;margin-top:4px}
    .pf .pf-t .pf-in{min-height:44px;font-size:15px;min-width:96px}
    .pf .pf-t td.kop{min-width:132px;max-width:170px}
    .pf .pf-why{font-size:12px}
    .pf .pf-fam{padding:12px}
    .pf input#pf-naam, .pf select#pf-erbij{max-width:none!important;width:100%}
    .pf .pf-voet .btn{flex:1 1 auto}
    .pf .pf-mld{min-height:44px} .pf .pf-mld.rood{min-height:0;padding:6px 0}
    .pf .pf-ptab td{display:block;border-top:0;padding:2px 0} .pf .pf-ptab tr{display:block;border-top:1px solid #eee3b8;padding:6px 0}
    .pf .pf-pact{text-align:left} .pf .pf-pzet input{width:120px}
  }
  .pf-bar{height:6px;background:#e3e8ee;border-radius:3px;overflow:hidden;margin-top:4px} .pf-bar i{display:block;height:100%;background:var(--ok)}
  .pw-top{padding:10px 14px;display:grid;gap:4px;border-bottom:1px solid #e3e8ee}
  .pw-rood{color:var(--bad)} .pw-oranje{color:#b86e00}
  .pw-h{margin:0;padding:10px 14px;font-size:15px;background:#fbfcfd;border-bottom:1px solid #e3e8ee;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
  .pw-h .u{font-size:12px;font-weight:600;color:var(--muted)} .pw-h .pf-k{margin-left:auto}
  .pw-kies{display:flex;gap:6px;flex-wrap:wrap;padding:12px 14px 4px}
  .pw-maat{border:1px solid #c9ced6;background:#f6f7f9;border-radius:10px;padding:8px 12px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;min-height:48px;color:inherit;display:grid;text-align:left;line-height:1.2}
  .pw-maat .n{font-size:11.5px;font-weight:600;color:var(--muted)} .pw-maat.af{border-color:#9bd0b0}
  .pw-maat.on{background:var(--blue);border-color:var(--blue);color:#fff} .pw-maat.on .n{color:#dbe7ff}
  .pw-maatblok{padding:8px 14px 14px;display:grid;gap:10px}
  .pw-mkop{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
  .pw-mkop h3{margin:0;font-size:17px} .pw-mkop h3 .u{font-size:12.5px;font-weight:600;color:var(--muted)}
  .pw-uitleg{background:#f4f8ff;border:1px solid #cfdcf3;border-radius:8px;padding:6px 12px;font-size:13px}
  .pw-uitleg summary{cursor:pointer;min-height:36px;display:flex;align-items:center;gap:8px} .pw-uitleg ul{margin:4px 0 6px 18px}
  .pw-zelfde{background:#fbfcfd;border:1px solid #e3e8ee;border-radius:8px;padding:8px 12px;display:grid;gap:4px}
  .pw-rijen{display:grid;gap:12px}
  .pw-rij{border:1px solid #d6dde5;border-radius:10px;padding:10px 12px;display:grid;gap:8px;background:#fff}
  .pw-rij.leegvoorraad{background:#fafbfc}
  .pw-naam b{font-size:15px;overflow-wrap:anywhere}
  .pw-feiten{display:grid;gap:3px}
  .pw-feiten .l,.pw-gk .l{font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);font-weight:700;margin-right:4px}
  .pw-gew{display:grid;gap:4px;background:#f8fafc;border-radius:8px;padding:6px 10px}
  .pw-waarsch{font-size:12.5px;font-weight:700;color:#9a4205;background:#fff4e5;border:1px solid #f1d2a8;border-radius:6px;padding:3px 8px}
  .pw-soort{display:grid;gap:4px}
  .pw-vel{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px}
  .pw-f{display:grid;gap:3px;align-content:start} .pw-f > label{font-weight:700;font-size:13px}
  .pw-in{width:100%;font:inherit;font-size:15px;padding:8px 10px;min-height:44px;border:1px solid #c5ccd6;border-radius:8px;background:#fff;color:inherit}
  .pw-in.ok{background:#f3f9f5;border-color:#b9dbc5}
  .pw-vs{font-size:12.5px;color:#123a7a;background:#eaf1fd;border-left:4px solid var(--blue);border-radius:6px;padding:5px 8px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
  .pw-vs.gok{background:#f4f4f6;border-left-color:#9aa5b1;color:#4a5a6a} .pw-vs.leeg{background:#f6f7f9;border-left-color:#c9ced6;color:#5b6673}
  .pw-vs em{font-style:normal;font-weight:700;color:#9a4205}
  .pw-ref{font-size:12px;color:var(--muted)} .pw-pickinfo{font-size:13px}
  .pw-k{border:1px solid #c9ced6;background:#f6f7f9;border-radius:8px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;min-height:40px;color:inherit}
  .pw-k:hover{border-color:var(--blue);color:var(--blue)} .pw-k.pri{background:var(--blue);border-color:var(--blue);color:#fff}
  .pw-vs .pw-k{background:var(--blue);border-color:var(--blue);color:#fff;min-height:36px}
  .pw-vink{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:13px;min-height:40px} .pw-vink input{width:20px;height:20px}
  .pw-acties,.pw-keuze{display:flex;gap:6px;flex-wrap:wrap}
  .pw-leeg{padding:6px 0}
  @media (max-width:760px){ .pw-maatblok{padding:8px 10px 12px} .pw-kies{padding:10px 10px 4px} .pw-maat{flex:1 1 130px} }
  `;
  document.head.appendChild(s);
}

const pct = (a, b) => b ? Math.round(a / b * 100) : 100;
function famUrl(fk){ return '#/productdata/familie/' + encodeURIComponent(fk); }
function viewLijst(){
  const L = famLijst(), q = UI.zoek.trim().toLowerCase();
  const f = q ? L.filter(x => x.naam.toLowerCase().includes(q) || x.fk.toLowerCase().includes(q) || actiefLeden(x.fk).some(c => c.toLowerCase().includes(q))) : L;
  const open = f.filter(x => x.open), v = voortgang(), vg = volgende();
  const vs = VOORSTEL.map(voorstelInfo).filter(x => x && !x.klaar);
  app().innerHTML = `<div class="pf"><a class="small" href="#/productdata">← Productdata</a>
  <div class="card mt8"><div class="pd-kop"><div><h2>Per familie</h2><div class="small muted mt4">Kies een familie en daarbinnen een maat: je ziet alle kleuren onder elkaar. De app toont en stelt voor wat uit Picqer, inkoop, verplaatsingen en verkoop volgt, met de reden. Jij bevestigt met een klik of typt het zelf; er wordt niets opgeslagen zonder jouw klik.</div></div>
    ${vg ? `<a class="btn acc" href="${famUrl(vg.fk)}">Volgende familie →</a>` : ''}</div>
    <div class="small mt8"><b>${nf(v.klaar)}</b> van ${nf(v.tot)} families klaar (laag 1–3, families met een A-, B- of binnenkomend product)</div>
    <div class="row wrap mt8"><input id="pf-zoek" data-pfz="1" value="${esc(UI.zoek)}" placeholder="zoek familie, code of naam" style="max-width:300px"></div></div>
  ${vs.map(x => `<div class="card" style="border-left:4px solid var(--blue)"><div class="row between wrap"><div><h3>Voorstel indeling: ${esc(x.v.naam)}</h3><div class="small muted mt4">${esc(x.v.uit)} Nu ${plural(x.cs.length, 'product', 'producten')} in ${plural(x.fks.length, 'familie', 'families')}.</div></div>
    <button class="btn pri" data-pfa="voorstel" data-id="${esc(x.v.id)}">Indeling overnemen</button></div></div>`).join('')}
  <div class="pf-lijst">${(q ? f : open.concat(f.filter(x => !x.open))).slice(0, UI.n).map(x => `<a class="pf-fam${x.open ? '' : ' klaar'}" href="${famUrl(x.fk)}"><div><b>${esc(x.naam)}</b><div class="u">${esc(x.fk.split('|')[0])} · ${plural(x.n, 'product', 'producten')} · ${plural(x.maten, 'maatgroep', 'maatgroepen')}${x.ab ? ' · A/B' : ''}${x.binnen ? ' · komt binnen' : ''}</div></div>
    <div class="pf-pct">${x.open ? nf(x.gevuld) + ' van ' + nf(x.velden) + ' velden' : '✓ klaar'}</div></a>`).join('') || '<div class="card empty">Geen families gevonden.</div>'}</div>
  ${f.length > UI.n ? `<div class="row" style="justify-content:center;margin:10px 0"><button class="btn" data-pfa="meer">Toon meer (${nf(f.length - UI.n)})</button></div>` : ''}
  </div>`;
}

// eenheid: paneel bij de rode regel
function paneelEh(fk, ls){
  const per = {}; ls.forEach(c => { const e = P().eenheid(c).t; (per[e] = per[e] || []).push(c); });
  const lab = X().verschilNamen(ls), vast = ehVast(fk);
  return `<div class="pf-paneel"><div class="pf-pzin">${vast ? 'Eenheid staat vast op ' + esc(EHT2[vast].t) + ' voor de hele familie; de eenheid in Picqer wordt genegeerd.' : 'Picqer heeft hier verschillende eenheden. Stuks per pallet, aanvullen bij en max op pick moeten in één eenheid staan.'}</div>
    ${Object.entries(per).map(([e, cs]) => `<div class="mt4"><b>${esc(e)} in Picqer</b> <span class="small muted">${esc(cs.map(c => (lab[c] || c) + ' (' + c + ')').join(', '))}</span></div>`).join('')}
    <div class="row wrap mt8" style="gap:6px">${vast ? `<button class="pf-k" data-pfa="ehvast" data-v="picqer">Picqer-eenheid volgen</button>` : `<button class="pf-k pri" data-pfa="ehvast" data-v="cm">cm, Picqer-eenheid negeren</button><button class="pf-k" data-pfa="ehvast" data-v="st">per stuk, Picqer-eenheid negeren</button>`}<button class="pf-k" data-pfa="paneeldicht">Sluiten</button></div></div>`;
}
// direct oplossen vanuit het paneel (opslaan per product)

/* ---------- voorraad en inkoop per product: live uit Picqer (alleen lezen), anders de export ----------
   Drie tabs per familie: (a) met picklocatie (vast en tijdelijk apart via de tijd-vlag van de locatie), (b) zonder picklocatie
   maar met voorraad (per product: moet pick krijgen / geen pick, veld pickkeuze in productdata, buiten de tellers),
   (c) zonder voorraad (openstaande backorders en de laatste inkoop). Elke tab per maatgroep samengevat en uitklapbaar. */
const naamVan = c => String((D.P[c] || {}).naam || c);
// productlijn per product, alleen zichtbaar als de familie er meer dan één heeft (bijv. Vica-trapmat: Bueno, Luego, Baleno, Novelle)
let LJ = { lijn:{}, meer:false };
function lijnInfo(fk){
  const cs = actiefLeden(fk).concat(leden(fk).filter(isUitl)), sch = {};
  cs.forEach(c => { sch[c] = X().schoneNaam(naamVan(c)).split(' ').filter(Boolean); });
  let pre = null;
  cs.forEach(c => { const w = sch[c]; if(pre === null) pre = w.slice(); else { let j = 0; while(j < pre.length && j < w.length && pre[j].toLowerCase() === w[j].toLowerCase()) j++; pre = pre.slice(0, j); } });
  const n = (pre || []).length, lijn = {};
  cs.forEach(c => { lijn[c] = sch[c].slice(n).join(' '); });
  return { lijn, meer:new Set(Object.values(lijn)).size > 1 };
}
const dk = iso => { const s = String(iso || ''); return s.length >= 10 ? s.slice(8, 10) + '-' + s.slice(5, 7) + '-' + s.slice(0, 4) : ''; };
const uurTxt = t => { const d = new Date(t); return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const WL = () => window.WHLIVE;
const LIVE = { prod:{}, bezig:{}, fout:{}, foutOp:{}, foutN:{}, op:{}, ids:null, idsBezig:null };
const pauze = ms => new Promise(r => setTimeout(r, ms));
// Picqer-id van een productcode: wh-pq-cat (producten met voorraad), anders de index van de geschiedenis (wh-hist-index, alle producten)
function idVan(c){
  const cat = (P().S.cat && P().S.cat.ids) || {}; if(cat[c]) return +cat[c];
  const m = LIVE.ids && LIVE.ids[String(c).toLowerCase()]; return m ? +m : 0;
}
function laadIds(){
  if(LIVE.ids) return Promise.resolve();
  if(LIVE.idsBezig) return LIVE.idsBezig;
  LIVE.idsBezig = (async () => {
    try{ const r = await WH.catHaal('wh-hist-index'), p = (r && r.data && r.data.p) || {}, m = {}; Object.keys(p).forEach(id => { m[String(p[id]).toLowerCase()] = +id; }); LIVE.ids = m; }
    catch(e){ LIVE.ids = {}; }
  })();
  return LIVE.idsBezig;
}
async function haalLive(fk, forceer){
  const L = WL(); if(!L || !L.status().code || LIVE.bezig[fk]) return;
  // na een fout (429, 504, …) niet bij elke tekenbeurt opnieuw: oplopend wachten (2, 4, 8 … max 30 minuten), Vernieuwen hooguit na 30 seconden
  if(LIVE.fout[fk]){ const w = Math.min(30 * 60e3, 2 * 60e3 * Math.pow(2, (LIVE.foutN[fk] || 1) - 1)); if(Date.now() - (LIVE.foutOp[fk] || 0) < (forceer ? 30e3 : w)) return; }
  if(!L.status().data && !L.status().laden) L.laad(false);   // backorders live (zelfde als Vandaag)
  const cs = actiefLeden(fk), oud = c => forceer || !LIVE.prod[c] || Date.now() - LIVE.prod[c].t > 120e3;
  if(!cs.some(oud)) return;
  LIVE.bezig[fk] = true; LIVE.fout[fk] = null;
  try{
    if(cs.some(c => oud(c) && !idVan(c))) await laadIds();
    const todo = cs.filter(c => oud(c) && idVan(c));
    for(let i = 0; i < todo.length; i += 20){
      if(i) await pauze(3000);                                       // rem: 20 producten per vraag, 3 seconden ertussen
      const deel = todo.slice(i, i + 20), perId = {}; deel.forEach(c => { perId[idVan(c)] = c; });
      const r = await L.vraag('producten', { ids:deel.map(idVan).join(',') });
      (r.producten || []).forEach(p => { const c = perId[p.id]; if(c) LIVE.prod[c] = { t:Date.now(), p, mag:r.magazijn, vst:r.vst || 3991 }; });
      updVr();
    }
    LIVE.op[fk] = Date.now(); LIVE.foutN[fk] = 0;
  }catch(e){ LIVE.fout[fk] = e; LIVE.foutOp[fk] = Date.now(); LIVE.foutN[fk] = (LIVE.foutN[fk] || 0) + 1; }
  LIVE.bezig[fk] = false; updVr();
}
// openstaande backorders per product: live (picqer vandaag, per idproduct) als die er is, anders de backorder-export
const BOEXP = { ref:null, m:null };
function boVan(c){
  const L = WL(), d = L && L.status().data, id = idVan(c);
  if(d && d.backorders && id){
    const r = d.backorders.filter(b => +b.p === id && !b.hp); if(!r.length) return null;
    return { n:new Set(r.map(b => b.o)).size, stuks:r.reduce((s, b) => s + (b.a || 0), 0), besch:r.reduce((s, b) => s + Math.min(b.a || 0, b.v || 0), 0), oudste:r.reduce((m, b) => b.c && (!m || b.c < m) ? b.c : m, ''), bron:'live' };
  }
  if(BOEXP.ref !== D.BO || !BOEXP.m){
    const m = {}; (D.BO || []).forEach(b => { const k = D.PLOW[String(b.productcode || '').toLowerCase()] || b.productcode; (m[k] = m[k] || []).push(b); });
    BOEXP.ref = D.BO; BOEXP.m = m;
  }
  const r = BOEXP.m[c]; if(!r || !r.length) return null;
  return { n:new Set(r.map(b => b.bestelling)).size, stuks:r.reduce((s, b) => s + (num(b.aantal) || 0), 0), besch:r.reduce((s, b) => s + Math.min(num(b.aantal) || 0, num(b.beschikbaar) || 0), 0), oudste:r.reduce((m, b) => b.geimporteerd_op && (!m || b.geimporteerd_op < m) ? b.geimporteerd_op : m, ''), bron:'export' };
}
const pickkeuze = c => { const r = P().S.pd[c]; return (r && r.data && r.data.pickkeuze) || ''; };
// alles wat we van één product weten: locaties met aantallen, VST, zonder locatie, inkoop, verkoop, backorders
function feit(c){
  const p = D.P[c] || {}, Lv = LIVE.prod[c], tijd = n => !!(D.LOC[n] && D.LOC[n].tijd);
  const f = { c, naam:naamVan(c), pick:[], bulk:[], kar:0, vst:0, geen:0, bron:'export' };
  if(Lv){
    const q = Lv.p, mag = +Lv.mag;
    (q.loc || []).forEach(l => {
      if(l.w !== null && l.w !== undefined && +l.w !== mag) return;                     // andere magazijnen (VST) via de voorraad per magazijn
      if(l.t === 'container' || /^container\s*\d+$/i.test(String(l.n || '').trim())){ f.kar += l.v || 0; return; }
      (l.b ? f.bulk : f.pick).push({ n:l.n, v:l.v || 0, tijd:tijd(l.n) });
    });
    const w = id => ((q.vw || []).find(x => +x[0] === +id) || [0, null])[1];
    const hm = w(mag), vst = w(Lv.vst);
    f.vst = vst || 0;
    f.geen = hm === null ? 0 : Math.max(0, hm - f.pick.concat(f.bulk).reduce((s, x) => s + x.v, 0) - f.kar);
    f.bron = 'live';
    f.vk28 = q.perDag === null || q.perDag === undefined ? null : Math.round((Number(q.perDag) || 0) * 30);   // Picqer: gemiddeld per dag over 28 dagen, per maand
  }else{
    const l = P().locaties(c);
    f.pick = l.pick.map(([n, v]) => ({ n, v:num(v) || 0, tijd:tijd(n) })); f.bulk = l.bulk.map(([n, v]) => ({ n, v:num(v) || 0 }));
    f.geen = num(l.geen) || 0; f.vst = num(p.voorraad_vst) || 0;
    f.kar = Object.values(((D.VR[c] || {}).cont) || {}).reduce((s, v) => s + (num(v) || 0), 0);
  }
  f.opPick = f.pick.reduce((s, x) => s + x.v, 0); f.opBulk = f.bulk.reduce((s, x) => s + x.v, 0);
  f.tot = f.opPick + f.opBulk + f.kar + f.geen + f.vst;
  f.heeftPick = f.pick.length > 0; f.vast = f.pick.some(x => !x.tijd);
  f.ink = P().inkVan(c); f.vk = X().vkmVan(c) || 0; f.bo = boVan(c); f.keuze = pickkeuze(c);
  return f;
}
const tabVan = f => f.heeftPick ? 'a' : f.tot > 0 ? 'b' : 'c';
const locChips = a => a.length ? a.map(x => `<span class="pf-loc${x.tijd ? ' tijd' : ''}" title="${x.tijd ? 'tijdelijke locatie' : 'vaste locatie'}">${esc(x.n)} <b>${nf(x.v)}</b></span>`).join('') : '<span class="muted">–</span>';
function inkTxt(i){
  if(!i) return '<span class="muted">geen inkoop in 12 maanden</span>';
  return `ø <b>${nf(i.gem, 0)}</b> per order · <b>${nf(i.n)}</b>× · laatst <b>${dk(i.laatste)}</b> (${nf(i.laatsteB)} besteld, ${nf(i.laatsteO)} ontvangen${i.laatsteOpen ? ', nog open' : ''})`;
}
const boTxt = b => b ? `<b>${nf(b.n)}</b> ${b.n === 1 ? 'order' : 'orders'} · ${nf(b.stuks)} st.${b.besch ? ' (' + nf(b.besch) + ' beschikbaar)' : ''} · oudste ${dk(b.oudste)}` : '<span class="muted">geen openstaande backorders</span>';

/* ---------- werkscherm per maat ---------- */
const WK = { maat:{}, tab:{}, sub:{} };     // gekozen maat, tab en subtab per familie
const gekozenMaat = (fk, mg) => { const w = WK.maat[fk]; if(w !== undefined && mg.some(g => g.k === w)) return w; const open = mg.find(g => telCs(g.cs).open); return (open || mg[0] || {}).k; };
const ehNaam = (fk, c) => EHN[ehProd(fk, c).e] || 'stuk';
function veldCtl(c, k, waarde, extra){
  const id = 'pw-' + X().idVan(c + '-' + k), d = P().VELDEN[k];
  const dis = UI.bezig ? ' disabled' : '';
  if(d.type === 'keus'){
    const opt = d.opt || [];
    return `<select id="${id}" class="pw-in${waarde !== '' ? ' ok' : ''}" data-pw="veld" data-c="${esc(c)}" data-k="${k}"${dis}><option value="">–</option>${opt.map(o => `<option value="${esc(o[0])}"${String(waarde) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  }
  return `<input id="${id}" class="pw-in${waarde !== '' ? ' ok' : ''}" data-pw="veld" data-c="${esc(c)}" data-k="${k}" value="${esc(waarde)}" placeholder="${esc(extra || '')}" ${d.type === 'num' ? 'inputmode="decimal"' : ''} autocomplete="off"${dis}>`;
}
// één veld: invoer, eenheid en (zolang er niets staat) het voorstel met reden en een knop om het te bevestigen
function veld(c, k, vs, fk, opt){
  const o = opt || {}, d = P().VELDEN[k], eig = eigenOk(c, k), waarde = eig ? String(eig.v) : '';
  const eh = k === 'maxpick' || k === 'spp' ? ehNaam(fk, c) : (d.eh2 || '');
  const v = !eig ? (vs[k] || gokVan(c, k)) : null;
  const vtxt = v ? `<div class="pw-vs${v.gok ? ' gok' : ''}"><span>${v.gok ? 'Schatting Claude (niet ingevuld)' : 'Voorstel'}: <b>${esc(X().toonWaarde(c, k, v.v))}</b>${v.som ? ' = ' + esc(v.som) : ''}${v.why ? ' · ' + esc(v.why) : ''}${v.te ? ' · <em>op basis van Picqer-gewicht, te controleren</em>' : ''}</span><button class="pw-k" data-pwa="klopt" data-c="${esc(c)}" data-k="${k}" data-v="${esc(v.v)}">Klopt</button></div>`
    : k === 'hoogte' && vs.hoogteMis ? `<div class="pw-vs leeg"><span>Geen voorstel: ${esc(vs.hoogteMis)}</span></div>` : '';
  const ref = o.ref ? `<div class="pw-ref">${o.ref}</div>` : (k === 'gewicht' && vs.gewichtRef ? `<div class="pw-ref">Berekend: ${esc(vs.gewichtRef.som)}${vs.gewichtRef.te ? ' · <em>op basis van Picqer-gewicht, te controleren</em>' : ''}</div>` : '');
  return `<div class="pw-f"><label for="pw-${X().idVan(c + '-' + k)}">${esc(o.label || VELDT[k] || d.t)}${eh ? ` <span class="muted">(${esc(eh)})</span>` : ''}</label>${veldCtl(c, k, waarde, v && !v.gok ? v.v : '')}${ref}${vtxt}</div>`;
}
function rijHtml2(fk, c, f, cs, tab){
  const so = soortNu(c), { V, so: soE, velden } = vsProduct(c, f, cs), g = gewInfo(c), w = gewWaarsch(c, cs);
  const vso = !so && V.opslag ? V.opslag : null;
  const ik = P().inkVan(c), hv = hoeveel(c);
  const soortSel = `<select id="pw-${X().idVan(c + '-opslag')}" class="pw-in${so ? ' ok' : ''}" data-pw="veld" data-c="${esc(c)}" data-k="opslag"${UI.bezig ? ' disabled' : ''}><option value="">Kies hoe deze maat binnenkomt…</option>${SOORTEN.map(([v, t]) => `<option value="${v}"${so === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const kz = (v, t) => `<button class="pw-k${f.keuze === v ? ' pri' : ''}" data-pwa="pick1" data-c="${esc(c)}" data-v="${v}" aria-pressed="${f.keuze === v}">${t}</button>`;
  const pickInfo = f.pick.length ? locChips(f.pick) : '<span class="muted">geen picklocatie in Picqer</span>';
  const eh = ehNaam(fk, c);
  const gewRegel = `<div class="pw-gew"><div class="pw-gk"><span class="l">Gewicht per ${esc(eh)}</span> ${g.pq ? `<b>${kgTxt(g.pq)}</b> <span class="muted">Picqer${g.eig ? '' : ', te controleren'}</span>` : '<b class="pw-rood">ontbreekt</b> <span class="muted">in Picqer</span>'}</div>
      <div class="pw-f"><label for="pw-${X().idVan(c + '-kgst')}">Gewicht gecontroleerd <span class="muted">(kg per ${esc(eh)})</span></label>${veldCtl(c, 'kgst', g.eig ? String(g.eig) : '', g.pq ? nf(g.pq, 3) : '')}
        <label class="pw-vink"><input type="checkbox" data-pwa="gewogen" data-c="${esc(c)}" ${g.gewogen ? 'checked' : ''} ${g.eig ? '' : 'disabled'}> gewogen</label></div>
      ${w ? `<div class="pw-waarsch">⚠ ${esc(w === 'ontbreekt' ? 'Gewicht ontbreekt of is 0' : 'Gewicht ' + w)}</div>` : ''}</div>`;
  let vel = '';
  if(so === 'rol') vel = '<div class="pw-leeg muted">Rol alleen backorder: geen verdere velden.</div>';
  else if(so){
    const palKnop = so !== 'pick' ? `<button class="pw-k" data-pwa="zelfdedeel" data-c="${esc(c)}" title="Palletmaat, hoogte, plaatsen en max pallets per ligger van dit product overnemen bij de andere ${esc(SOORTT[so])}-producten in deze maat die dat nog niet hebben">Zelfde voor andere ${esc(SOORTT[so])}-producten in deze maat</button>` : '';
    vel = `<div class="pw-vel">${velden.filter(k => k !== 'kgst').map(k => {
      if(k === 'pick') return `<div class="pw-f"><label>Picklocatie</label><div class="pw-pickinfo">${pickInfo}</div>${veldCtl(c, 'pick', eigenV(c, 'pick'))}${!eigenOk(c, 'pick') && V.pick ? `<div class="pw-vs"><span>Voorstel: <b>${V.pick.v === 'ja' ? 'Ja' : 'Nee, alleen bulk'}</b> · ${esc(V.pick.why)}</span><button class="pw-k" data-pwa="klopt" data-c="${esc(c)}" data-k="pick" data-v="${V.pick.v}">Klopt</button></div>` : ''}</div>`;
      if(k === 'maxpick'){
        const cap = capPick(c);
        return veld(c, k, V, fk, { ref:cap !== null ? `Picqer: vul aan tot <b>${nf(cap)}</b>` : '' });
      }
      return veld(c, k, V, fk);
    }).join('')}</div>${palKnop ? `<div class="pw-acties">${palKnop}</div>` : ''}`;
  }
  const extraTab = tab === 'b' ? `<div class="pw-keuze">${kz('moet', 'Moet pick krijgen')}${kz('geen', 'Geen pick')}</div>`
    : tab === 'c' ? `<div class="small">${boTxt(f.bo)}</div><div class="pw-keuze"><button class="pw-k" data-pwa="uitl" data-c="${esc(c)}">Uitlopend</button></div>` : '';
  const voorstelBlok = vso ? `<div class="pw-vs"><span>Voorstel: <b>${esc(SOORTT[vso.v] || vso.v)}</b> · ${esc(vso.why)}${vso.oud ? ' (eerder ingevuld)' : ''}</span><button class="pw-k" data-pwa="klopt" data-c="${esc(c)}" data-k="opslag" data-v="${esc(vso.v)}">Klopt</button></div>`
    : !so && gokVan(c, 'opslag') ? `<div class="pw-vs gok"><span>Schatting Claude (niet ingevuld): <b>${esc(SOORTT[gokVan(c, 'opslag').v] || gokVan(c, 'opslag').v)}</b> · ${esc(gokVan(c, 'opslag').why)}</span><button class="pw-k" data-pwa="klopt" data-c="${esc(c)}" data-k="opslag" data-v="${esc(gokVan(c, 'opslag').v)}">Klopt</button></div>` : '';
  const afwHint = V.opslagAfw ? `<div class="pw-vs leeg"><span>De data wijst op <b>${esc(SOORTT[V.opslagAfw.v] || V.opslagAfw.v)}</b>: ${esc(V.opslagAfw.why)}. Jouw keuze (${esc(SOORTT[so] || so)}) blijft staan.</span><button class="pw-k" data-pwa="klopt" data-c="${esc(c)}" data-k="opslag" data-v="${esc(V.opslagAfw.v)}">Zet op ${esc(SOORTT[V.opslagAfw.v] || V.opslagAfw.v)}</button></div>` : '';
  const nVs = Object.keys(V).filter(k => !['hoogteMis', 'opslagAfw', 'gewichtRef'].includes(k) && V[k] && !V[k].gok).length;
  return `<div class="pw-rij${f.tot === 0 ? ' leegvoorraad' : ''}" data-c="${esc(c)}">
    <div class="pw-naam"><b>${esc(f.naam)}</b><div class="small muted mono">${esc(c)} ${X().abcBadge(c)}${LJ.meer && LJ.lijn[c] ? ' · ' + esc(LJ.lijn[c]) : ''}</div></div>
    <div class="pw-feiten small">
      <div><span class="l">Voorraad</span> Pick ${locChips(f.pick)} Bulk ${locChips(f.bulk)} · VST <b>${nf(f.vst)}</b> · zonder locatie <b>${nf(f.geen)}</b>${f.kar ? ' · retourkar <b>' + nf(f.kar) + '</b>' : ''}</div>
      <div><span class="l">Inkoop</span> ${inkTxt(ik)}${hv.length ? ' · voorgekomen: <b>' + esc(hoeveelTxt(hv)) + '</b>' : ''}</div>
      <div><span class="l">Verkoop</span> <b>${nf(Math.round(f.vk))}</b> per maand (6 maanden)${f.vk28 !== null && f.vk28 !== undefined ? ' · <b>' + nf(f.vk28) + '</b> per maand (28 dagen, Picqer)' : ''}</div></div>
    ${gewRegel}
    <div class="pw-soort"><label for="pw-${X().idVan(c + '-opslag')}"><b>Hoe komt deze maat binnen?</b></label>${soortSel}${voorstelBlok}${afwHint}</div>
    ${vel}${extraTab}
    ${nVs ? `<div class="pw-acties"><button class="pw-k" data-pwa="rijklopt" data-c="${esc(c)}">Alle voorstellen van dit product kloppen (${nVs})</button></div>` : ''}
  </div>`;
}
function werkInner(fk){
  LJ = lijnInfo(fk);
  const ls = actiefLeden(fk), mg0 = maatgroepen(fk).sort(maatSort), t = telCs(ls), go = gewichtOverzicht(fk);
  const F = {}; ls.forEach(c => { F[c] = feit(c); });
  const mk = gekozenMaat(fk, mg0), g = mg0.find(x => x.k === mk) || mg0[0];
  const tabs = g ? g.cs.reduce((m, c) => { m[tabVan(F[c])].push(c); return m; }, { a:[], b:[], c:[] }) : { a:[], b:[], c:[] };
  const tab = WK.tab[fk] || 'alle';
  const sub = WK.sub[fk] || 'alle';
  const vastA = tabs.a.filter(c => F[c].vast), tijdA = tabs.a.filter(c => !F[c].vast);
  const lijst = !g ? [] : tab === 'a' ? (sub === 'vast' ? vastA : sub === 'tijd' ? tijdA : tabs.a) : tab === 'alle' ? g.cs : tabs[tab];
  const nl = ls.filter(c => F[c].bron === 'live').length, L = WL(), pv = window.PDVERS ? PDVERS.status() : null;
  const bron = LIVE.fout[fk] ? `export van ${dk(D.VRDATUM)} · live mislukt: ${esc(LIVE.fout[fk].message || LIVE.fout[fk])}`
    : nl && nl === ls.length ? `live uit Picqer${LIVE.op[fk] ? ' · ' + uurTxt(LIVE.op[fk]) : ''}`
    : LIVE.bezig[fk] ? 'live uit Picqer ophalen…' : nl ? `${nl} van ${ls.length} live, rest export`
    : L && L.status().code ? `export van ${dk(D.VRDATUM)} · live volgt` : `export van ${dk(D.VRDATUM)} · geen koppelcode op dit apparaat`;
  const stand = pv ? `Inkoop ${pv.ink.op ? 'bijgewerkt ' + dk(pv.ink.op) : (pv.tekstInk ? esc(pv.tekstInk) : 'wordt opgehaald')} · verplaatsingen ${pv.vp.tot ? 'bijgewerkt t/m ' + dk(pv.vp.tot) + ' ' + String(pv.vp.tot).slice(11, 16) : (pv.tekstVp ? esc(pv.tekstVp) : 'worden opgehaald')}` : '';
  const tb = (k, tx, n) => `<button class="pf-vrtab${tab === k ? ' on' : ''}" data-pwa="tab" data-v="${k}" role="tab" aria-selected="${tab === k}">${tx}<span class="n">${nf(n)}</span></button>`;
  const idx = mg0.findIndex(x => x.k === mk);
  const unieke = g ? g.cs.map(c => gewInfo(c).pq).filter(x => x > 0) : [];
  const mediaan = mediaanVan(unieke);
  return `<div class="pw-top">
      <div class="pw-voortgang"><b>${nf(t.gevuld)}</b> van ${nf(t.velden)} velden af${t.open ? ` · nog ${nf(t.open)} open` : ' · ✓ klaar'}<div class="pf-bar"><i style="width:${pct(t.gevuld, t.velden)}%"></i></div></div>
      <div class="pw-gewovz small">Gewicht: <b class="${go.zonder ? 'pw-rood' : ''}">${nf(go.zonder)}</b> ${go.zonder === 1 ? 'product' : 'producten'} zonder gewicht · <b class="${go.afw ? 'pw-oranje' : ''}">${nf(go.afw)}</b> met afwijkend gewicht (meer dan 30% anders dan de andere kleuren in de maat)</div>
    </div>
    <h3 class="pw-h">Voorraad en inkoop <span class="u">${bron}</span><button class="pf-k" data-pwa="vernieuw">Vernieuwen</button></h3>
    ${stand ? `<div class="pf-vrstand small muted">${stand}</div>` : ''}
    <div class="pw-kies" role="tablist" aria-label="Maat">${mg0.map(x => { const tc = telCs(x.cs); return `<button class="pw-maat${x.k === mk ? ' on' : ''}${tc.open ? '' : ' af'}" data-pwa="maat" data-m="${esc(x.k)}">${esc(x.t)}<span class="n">${plural(x.cs.length, 'kleur', 'kleuren')}${tc.open ? ' · ' + nf(tc.open) + ' open' : ' · ✓'}</span></button>`; }).join('')}</div>
    ${g ? `<section class="pw-maatblok"><div class="pw-mkop"><div><h3>${esc(g.t)} <span class="u">${plural(g.cs.length, 'kleur', 'kleuren')}</span></h3>${LJ.meer ? `<div class="small muted">Lijnen: ${esc([...new Set(g.cs.map(c => LJ.lijn[c] || '–'))].join(', '))}</div>` : ''}</div>
      <div class="row wrap" style="gap:6px"><button class="pw-k" data-pwa="maatklopt">Alle voorstellen in deze maat kloppen</button><button class="pw-k" data-pwa="restpick" title="Producten in deze maat zonder soort op Pick zetten">Rest van deze maat = Pick</button>${idx >= 0 && mg0.length > 1 ? `<button class="pw-k pri" data-pwa="volgmaat">Volgende maat →</button>` : ''}</div></div>
      <details class="pw-uitleg" open><summary><b>Hoe komt deze maat binnen?</b> <span class="small muted">uitleg per soort</span></summary><ul>${UITLEG.map(([a, b]) => `<li><b>${esc(a)}</b>: ${esc(b)}</li>`).join('')}</ul></details>
      <div class="pw-zelfde"><label for="pw-kgmaat"><b>Zelfde gewicht voor alle kleuren in deze maat</b></label>
        <div class="row wrap" style="gap:6px;align-items:center"><input id="pw-kgmaat" class="pw-in" inputmode="decimal" placeholder="${mediaan ? nf(mediaan, 3) + ' (Picqer, mediaan)' : 'kg per ' + esc(g.cs[0] ? ehNaam(fk, g.cs[0]) : 'stuk')}" autocomplete="off"><label class="pw-vink"><input type="checkbox" id="pw-kgmaat-gew"> gewogen</label><button class="pw-k" data-pwa="zelfdekg">Zelfde gewicht voor alle kleuren in deze maat</button></div>
        <div class="small muted">Alleen producten zonder gecontroleerd gewicht krijgen het; ingevulde gewichten blijven staan.</div></div>
      <div class="pf-vrtabs" role="tablist">${tb('alle', 'Alle kleuren', g.cs.length)}${tb('a', 'Met picklocatie', tabs.a.length)}${tb('b', 'Zonder pick, met voorraad', tabs.b.length)}${tb('c', 'Zonder voorraad', tabs.c.length)}</div>
      ${tab === 'a' ? `<div class="pf-vrtabs sub">${[['alle', 'Alle', tabs.a.length], ['vast', 'Vaste picklocatie', vastA.length], ['tijd', 'Alleen tijdelijke picklocatie', tijdA.length]].map(([k, tx, n]) => `<button class="pf-vrtab klein${sub === k ? ' on' : ''}" data-pwa="sub" data-v="${k}">${tx}<span class="n">${nf(n)}</span></button>`).join('')}</div>` : ''}
      <div class="pw-rijen">${lijst.map(c => rijHtml2(fk, c, F[c], g.cs, tabVan(F[c]))).join('') || '<div class="pw-leeg muted">Geen producten in deze tab.</div>'}</div>
    </section>` : '<div class="card empty">Geen producten.</div>'}`;
}
function updWerk(){
  const el = $('pw'), fk = fkNu(); if(!el || !fk || !P().index().fam[fk]) return;
  const a = document.activeElement, id = a && a.id && el.contains(a) ? a.id : '', pos = a && typeof a.selectionStart === 'number' ? a.selectionStart : null;
  const y = window.scrollY;
  el.innerHTML = werkInner(fk);
  if(id){ const n = $(id); if(n){ n.focus({ preventScroll:true }); try{ if(pos !== null) n.setSelectionRange(pos, pos); }catch(e){} } }
  window.scrollTo(0, y);
}
const updVr = updWerk;

/* ---------- opslaan: alleen na een klik of invoer van Daan, per product, ingevulde waarden blijven staan ---------- */
async function slaOp(wijz, tekst){
  const n = Object.keys(wijz).length; if(!n) return 0;
  UI.bezig = true;
  try{ await P().opslaan(wijz, 'invul'); vers(); if(tekst) toast(tekst, 3500); }
  catch(e){ toast('Opslaan mislukt: ' + e.message, 7000); }
  UI.bezig = false; updWerk();
  return n;
}
const putV = (wijz, c, k, v, extra) => { (wijz[c] = wijz[c] || {})[k] = Object.assign({ v, bron:'invul' }, extra || {}); };
// een ingetypte of gekozen waarde (leeg = niets doen: een ingevulde waarde wissen we nooit zomaar)
async function zetVeld(c, k, raw){
  raw = String(raw || '').trim();
  if(!raw){ updWerk(); return; }
  let v; try{ v = X().check(k, raw); }catch(e){ toast(e.message, 4500); updWerk(); return; }
  if(v === '' ){ updWerk(); return; }
  const w = {}; putV(w, c, k, v, k === 'kgst' ? { gew:gewInfo(c).gewogen } : null);
  await slaOp(w);
}
// alle voorstellen van één product die Daan bevestigt; alleen lege velden, nooit een ingevulde waarde
function voorstellenVan(fk, c, cs, F){
  const w = {}, f = F[c] || feit(c); let { V } = vsProduct(c, f, cs);
  if(V.opslag && !V.opslag.gok) putV(w, c, 'opslag', V.opslag.v);
  // de velden die bij die soort horen: opnieuw rekenen met de soort erbij
  const so = soortNu(c) || (V.opslag && V.opslag.v) || '';
  if(!soortNu(c) && V.opslag){
    const keep = P().S.pd[c], tmp = Object.assign({}, (keep && keep.data) || {}, { opslag:V.opslag.v });
    P().S.pd[c] = { data:tmp, meta:(keep && keep.meta) || {}, t:keep && keep.t };
    try{ V = vsProduct(c, f, cs).V; } finally { if(keep) P().S.pd[c] = keep; else delete P().S.pd[c]; }
  }
  veldenVan(so).forEach(k => { if(k !== 'kgst' && V[k] && !V[k].gok && !eigenOk(c, k)) putV(w, c, k, String(V[k].v)); });
  return w;
}
function veldenMaat(fk){ const mg = maatgroepen(fk).sort(maatSort), g = mg.find(x => x.k === gekozenMaat(fk, mg)); return g || null; }
async function actie(a, b){
  const fk = fkNu(); if(!fk) return;
  const g = veldenMaat(fk), c = b.dataset.c, F = {}; (g ? g.cs : []).forEach(x => { F[x] = feit(x); });
  if(a === 'maat'){ WK.maat[fk] = b.dataset.m; WK.tab[fk] = 'alle'; updWerk(); return; }
  if(a === 'volgmaat'){
    const mg = maatgroepen(fk).sort(maatSort), i = mg.findIndex(x => g && x.k === g.k), na = mg.slice(i + 1).concat(mg.slice(0, i)), v = na.find(x => telCs(x.cs).open) || na[0];
    if(v){ WK.maat[fk] = v.k; WK.tab[fk] = 'alle'; updWerk(); window.scrollTo(0, 0); } return;
  }
  if(a === 'tab'){ WK.tab[fk] = b.dataset.v; updWerk(); return; }
  if(a === 'sub'){ WK.sub[fk] = b.dataset.v; updWerk(); return; }
  if(a === 'vernieuw'){ if(window.PDVERS) PDVERS.ronde(true); haalLive(fk, true); updWerk(); return; }
  if(a === 'klopt'){ const w = {}; putV(w, c, b.dataset.k, b.dataset.v); await slaOp(w); return; }
  if(a === 'rijklopt'){ const w = voorstellenVan(fk, c, g.cs, F); const n = Object.values(w).reduce((s, o) => s + Object.keys(o).length, 0); await slaOp(w, n ? plural(n, 'voorstel', 'voorstellen') + ' bevestigd' : ''); return; }
  if(a === 'maatklopt'){
    if(!g) return;
    const w = {}; g.cs.forEach(x => Object.assign(w, voorstellenVan(fk, x, g.cs, F)));
    const n = Object.values(w).reduce((s, o) => s + Object.keys(o).length, 0);
    if(!n){ toast('Geen voorstellen om te bevestigen', 3000); return; }
    await slaOp(w, plural(n, 'voorstel', 'voorstellen') + ' bevestigd bij ' + plural(Object.keys(w).length, 'product', 'producten')); return;
  }
  if(a === 'restpick'){
    if(!g) return; const w = {}; g.cs.forEach(x => { if(!soortNu(x)) putV(w, x, 'opslag', 'pick'); });
    await slaOp(w, Object.keys(w).length ? plural(Object.keys(w).length, 'product', 'producten') + ' op Pick' : ''); if(!Object.keys(w).length) toast('Alle producten in deze maat hebben al een soort', 3000); return;
  }
  if(a === 'zelfdedeel'){
    if(!g) return; const so = soortNu(c), w = {}; let n = 0;
    g.cs.filter(x => x !== c && soortNu(x) === so).forEach(x => PALVELDEN.forEach(k => { const v = eigenV(c, k); if(v && !eigenOk(x, k)){ putV(w, x, k, v); n++; } }));
    await slaOp(w, n ? plural(n, 'waarde', 'waarden') + ' overgenomen bij ' + plural(Object.keys(w).length, 'product', 'producten') : ''); if(!n) toast('Niets over te nemen: vul eerst palletmaat, hoogte, plaatsen of max pallets in, of de andere producten hebben ze al', 4500); return;
  }
  if(a === 'zelfdekg'){
    if(!g) return; const raw = ($('pw-kgmaat') || {}).value || ''; let v;
    try{ v = X().check('kgst', raw || String(mediaanVan(g.cs.map(x => gewInfo(x).pq).filter(y => y > 0)) || '')); }catch(e){ toast(e.message, 4000); return; }
    if(!v || v === 'onb' || v === 'nvt'){ toast('Vul een gewicht in kg in', 3500); return; }
    const gew = !!($('pw-kgmaat-gew') || {}).checked, w = {}; let over = 0;
    g.cs.forEach(x => { if(eigenOk(x, 'kgst')) over++; else putV(w, x, 'kgst', v, { gew }); });
    await slaOp(w, plural(Object.keys(w).length, 'product', 'producten') + ' op ' + kgTxt(+v) + (over ? ' · ' + plural(over, 'ingevuld gewicht blijft', 'ingevulde gewichten blijven') + ' staan' : '')); return;
  }
  if(a === 'pick1'){
    const v = pickkeuze(c) === b.dataset.v ? '' : b.dataset.v;   // nogmaals klikken haalt de keuze weg
    P().opslaan({ [c]:{ pickkeuze:{ v, bron:'invul' } } }, 'invul').then(() => updWerk()).catch(e => toast('Opslaan mislukt: ' + e.message, 6000)); return;
  }
  if(a === 'uitl'){ await zetUitlopend([c], true); updWerk(); return; }
}

/* ---------- bovenkant van de familie en de pagina ---------- */
function viewWerkblad(fk){
  if(!P().index().fam[fk]){ app().innerHTML = `<a class="small" href="#/productdata/familie">← Per familie</a><div class="card empty mt8">Familie niet gevonden.</div>`; return; }
  const ls = actiefLeden(fk), uitl = leden(fk).filter(isUitl), mg = maatgroepen(fk);
  const ehAlle = (() => { const m = {}; ls.forEach(c => { const e = ehProd(fk, c).t; (m[e] = m[e] || []).push(c); }); return m; })();
  const ehPicqer = new Set(ls.map(c => P().eenheid(c).t)).size > 1;
  LJ = lijnInfo(fk);
  const I = P().index();
  const vkm = ls.reduce((s, c) => s + X().vkmVan(c), 0), pdd = ls.reduce((s, c) => s + X().pdVan(c), 0);
  const abc = ls.reduce((m, c) => { const a = X().abcVan(c) || '–'; m[a] = (m[a] || 0) + 1; return m; }, {});
  const cont = new Set(); (D.CONT || []).filter(c => c.status !== 'afgerond').forEach(c => ((c.regels || (c.data && c.data.regels)) || []).forEach(r => { const k = r && (D.PLOW[String(r.productcode || '').toLowerCase()] || r.productcode); if(k && ls.includes(k)) cont.add(c.id || c.containernummer || c.pakbon_ref); }));
  const vg = volgende(fk);
  const lab = X().verschilNamen(ls.length ? ls : uitl);
  const famOpts = (() => { const lev = fk.split('|')[0], woorden = fk.split('|')[1].split(' ').filter(w => w.length > 3);
    return Object.keys(I.fam).filter(f => f !== fk && f.split('|')[0] === lev && lev !== 'SAM Europe' && woorden.some(w => f.includes(w)) && actiefLeden(f).length).slice(0, 40); })();
  app().innerHTML = `<div class="pf"><a class="small" href="#/productdata/familie">← Per familie</a>
  <div class="card mt8 pf-kop"><div class="pd-kop"><div><h2>${esc(famNaam(fk))}</h2><div class="small muted">${esc(fk.split('|')[0])} · ${plural(ls.length, 'product', 'producten')} · ${plural(mg.length, 'maatgroep', 'maatgroepen')}</div></div>
      ${vg ? `<a class="btn" href="${famUrl(vg.fk)}">Volgende familie →</a>` : ''}</div>
    <div class="pf-stats"><span>Verkoop <b>${nf(Math.round(vkm))}</b> per maand</span><span>Picks <b>${nf(pdd, 1)}</b> per dag</span><span>ABC ${Object.entries(abc).map(([a, n]) => `<b>${esc(a)}</b> ${n}`).join(' · ')}</span><span>Open containers <b>${nf(cont.size)}</b></span></div>
    <div class="row wrap" style="gap:8px"><input id="pf-naam" data-pfnaam="1" value="${esc(X().famCorWaarde('naam', fk) || '')}" placeholder="Naam voor deze familie (bijv. Kokos)" style="max-width:280px"><button class="btn sm" data-pfa="naam">Naam bewaren</button>
      ${famOpts.length ? `<select id="pf-erbij" style="max-width:280px"><option value="">Familie erbij…</option>${famOpts.map(f => `<option value="${esc(f)}">${esc(famNaam(f))} (${actiefLeden(f).length})</option>`).join('')}</select><button class="btn sm" data-pfa="erbij">Samenvoegen</button>` : ''}</div>
    ${(() => { const u = ls.filter(naamUitl); return u.length ? `<div class="pf-keus"><b>Uitlopend?</b> ${plural(u.length, 'product heeft', 'producten hebben')} UITLOPEND in de naam: ${esc(u.map(c => lab[c] || c).join(', '))}<button class="pf-k" data-pfa="uitl" data-codes="${esc(u.join('\n'))}" data-aan="1">${u.length > 1 ? 'Alle ' + u.length + ' op uitlopend' : 'Op uitlopend'}</button></div>` : ''; })()}
    ${Object.keys(ehAlle).length > 1 ? `<button class="pf-mld rood" data-pfa="ehpaneel"><b>Eenheid verschilt in Picqer:</b> ${Object.entries(ehAlle).map(([e, cs]) => nf(cs.length) + ' ' + esc(e) + (cs.length <= 4 ? ' (' + esc(cs.join(', ')) + ')' : '')).join(' · ')}. Controleer dat stuks per pallet en max op pick in de eenheid van Picqer staan.</button>`
      : ehVast(fk) && ehPicqer ? `<div class="small muted">Eenheid: <b>${esc(EHT2[ehVast(fk)].t)}</b> voor de hele familie, Picqer-eenheid genegeerd <button class="pf-k" data-pfa="ehpaneel">wijzigen</button></div>` : ''}
    ${UI.paneel && UI.paneel.fk === fk && UI.paneel.eh ? paneelEh(fk, ls) : ''}</div>

  <section class="pf-sec" id="pw">${werkInner(fk)}</section>

  ${uitl.length ? `<details class="pf-sec"><summary style="padding:10px 14px;font-weight:700;cursor:pointer">Uitlopend <span class="small muted">${plural(uitl.length, 'product', 'producten')}, geen velden</span></summary><div style="padding:6px 14px 12px">${uitl.map(c => `<div class="small" style="padding:4px 0;border-top:1px solid #eef1f4"><b>${esc(naamVan(c))}</b> <span class="muted mono">${esc(c)}</span> · uitlopend sinds ${esc(String(X().pdWaarde(c, 'uitlopend')))}</div>`).join('')}</div></details>` : ''}
  </div>`;
}
let aanGeladen = false;
function view(arg){
  if(!aanGeladen && window.WHAAN){ aanGeladen = true; WHAAN.laad().then(() => { if(location.hash.indexOf('#/productdata/familie') === 0) X().rerender(); }).catch(() => {}); }
  stijl();
  if(!P().S.fcor) P().S.fcor = X().famCorNorm(null);
  if(arg){ if(window.PDVERS) PDVERS.ronde(false); if(P().index().fam[arg]) setTimeout(() => haalLive(arg, false), 0); return viewWerkblad(arg); }
  return viewLijst();
}

/* ---------- invoer ---------- */
const fkNu = () => { const m = (location.hash || '').match(/^#\/productdata\/familie\/(.+)$/); return m ? decodeURIComponent(m[1]) : null; };
document.addEventListener('input', ev => {
  const t = ev.target; if(!t || !t.dataset) return;
  if(t.dataset.pfz){ UI.zoek = t.value; X().rerender(); }
});
// een ingevulde of gekozen waarde wordt opgeslagen zodra je het veld verlaat of Enter drukt (invoer van Daan)
document.addEventListener('change', ev => {
  const t = ev.target; if(!t || !t.dataset || !fkNu()) return;
  if(t.dataset.pw === 'veld'){ zetVeld(t.dataset.c, t.dataset.k, t.value); return; }
  if(t.dataset.pwa === 'gewogen'){
    const c = t.dataset.c, g = gewInfo(c); if(!g.eig) return;
    const w = {}; putV(w, c, 'kgst', String(g.eig), { gew:t.checked }); slaOp(w); return;
  }
  const fk = fkNu();
  if(t.dataset.pfa === 'naarfam' && t.value){ const c = t.dataset.c, naar = t.value; bewaarCor(d => { d.fam[c] = naar; delete d.maat[c]; }, c + ' naar ' + (naar.startsWith('eigen|') ? 'een eigen familie' : famNaam(naar))); }
});
document.addEventListener('keydown', ev => {
  const t = ev.target; if(!t || !t.dataset || !fkNu()) return;
  if(ev.key === 'Escape' && UI.paneel){ UI.paneel = null; X().rerender(); return; }
  if(ev.key === 'Enter' && t.tagName === 'INPUT' && (t.dataset.pw === 'veld' || t.id === 'pw-kgmaat')){ ev.preventDefault(); if(t.id === 'pw-kgmaat') actie('zelfdekg', t); else t.blur(); }
});
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-pfa],[data-pwa]'); if(!b || b.tagName === 'SELECT') return;
  if(b.dataset.pwa){ if(b.tagName === 'INPUT') return; actie(b.dataset.pwa, b); return; }
  const a = b.dataset.pfa, fk = fkNu();
  if(a === 'meer'){ UI.n += 40; X().rerender(); return; }
  if(a === 'voorstel'){ neemOver(b.dataset.id); return; }
  if(!fk) return;
  if(a === 'ehpaneel'){ UI.paneel = UI.paneel && UI.paneel.eh ? null : { fk, eh:true }; X().rerender(); return; }
  if(a === 'ehvast'){ const v = b.dataset.v; UI.paneel = null; bewaarCor(d => { d.eh[fk] = v; }, v === 'picqer' ? 'Eenheid volgt Picqer' : 'Eenheid vast: ' + EHT2[v].t); return; }
  if(a === 'naam'){ const v = (($('pf-naam') || {}).value || '').trim(); bewaarCor(d => { if(v) d.naam[fk] = v; else delete d.naam[fk]; }, v ? 'Naam bewaard' : 'Naam weg'); return; }
  if(a === 'erbij'){ const f = ($('pf-erbij') || {}).value; if(!f) return; const cs = P().index().fam[f] || []; bewaarCor(d => { cs.forEach(c => { d.fam[c] = fk; }); }, plural(cs.length, 'product', 'producten') + ' erbij'); return; }
  if(a === 'uitl'){ zetUitlopend(String(b.dataset.codes || '').split('\n').filter(Boolean), !!b.dataset.aan); return; }
});

return { view, ehVast, neemOver, naamUitl, zetUitlopend, bewaarCor, famLijst, volgende, voortgang, famNaam, maatgroepen, actiefLeden, leden, telOpen, VOORSTEL, voorstelInfo, vsProduct, gewInfo, gewWaarsch, gewichtOverzicht };
})();
