/* =====================================================================
   IVOL Warehouse — Productdata per familie (15-10-2026, bouwplan 0.4)
   Een hele productfamilie in één keer invullen, voor alle lagen tegelijk, elke waarde op het niveau waar hij gedeeld wordt:
     Familie     soort, picklocatie, aanvullen met, aanvullen bij, geleverd, mixgroep
     Maatgroep   stuks per pallet, max op pick, palletmaat, hoogte, gewicht, plaatsen, per doos, per ligger, kg per stuk, doosmaat
     Product     vloernaam, opmerking en de uitzonderingen
   Per veld "verschilt per maat / per product" en terug "geldt voor de hele familie" (concept bewaart elke rij, niets gaat verloren).
   Eén waarheid blijft de tabel productdata: opslaan schrijft per product, meta[veld].bron = 'familie' of 'maatgroep'.
   Eigen invoer van Daan wordt nooit stil overschreven: verschil in beeld, Daan kiest familie volgen of deze houden.
   Schattingen van Claude (bron claude met meta.tw) zijn geen eigen invoer: de familie overschrijft ze, ze staan geel
   als "schatting Claude" in de cel, en na Opslaan is tw weg (bron familie, maatgroep of invul).
   Indeling corrigeren, familienaam, niveaus en uitzonderingen: catalog-rij wh-pd-fam (index() in productdata.js geeft
   die voorrang). Uitlopend = productdata.uitlopend (datum): geen velden meer nodig, telt nergens mee.
   Leren: per veld een paar uitlegbare regels uit inkoop, aanvullingen, eenheid en ABC, getoetst per familie
   (doe alsof de hele familie leeg is). ≥ 75% goed = vooraf ingevuld (geel), daaronder schatting met Gebruik.
   ===================================================================== */
window.WHPDF = (function(){
'use strict';
const { $, esc, nf, plural, num, leeg, toast, D, isoDag } = WH;
const P = () => window.WHPD, X = () => WHPD.intern;
const KEY = 'wh-pd-fam';
const app = () => $('app');

/* ---------- velden en niveaus ---------- */
const STD_NIV = { opslag:'fam', pick:'fam', met:'fam', lvl:'fam', geleverd:'fam', mixgroep:'fam',
  spp:'maat', maxpick:'maat', maat:'maat', hoogte:'maat', gewicht:'maat', plaatsen:'maat', spd:'maat', maxlig:'maat', kgst:'maat', doos:'maat',
  vn:'prod', opm:'prod' };
const VELD = () => Object.keys(P().VELDEN);
const NIVNAAM = { fam:'familie', maat:'maatgroep', prod:'product' };
// eigen invoer van Daan: nooit stil overschrijven (familie, maatgroep en auto mogen wel opnieuw)
const EIGEN = new Set(['invul', 'spraak', 'samen', 'overgezet', 'claude', 'regel', 'tabel', 'klein', 'kleuren', 'basisregel', 'import']);
const bronVan = (c, k) => { const r = P().S.pd[c]; return (r && r.meta && r.meta[k] && r.meta[k].bron) || ''; };
const isUitl = c => !!X().pdWaarde(c, 'uitlopend');
const naamUitl = c => /uitlopend/i.test(String((D.P[c] || {}).naam || '')) && !isUitl(c);   // voorstel "Uitlopend?", nooit automatisch
const cor = () => P().S.fcor || (P().S.fcor = X().famCorNorm(null));

/* ---------- indeling ---------- */
const famVan = c => P().index().famVan[c];
const maatVan = c => { const vk = P().index().varVan[c] || ''; return vk.slice(String(famVan(c) || '').length + 1); };
const zichtbaar = c => X().actief(c) && (isUitl(c) || X().inScope(c, 'belangrijk', false) || X().inScope(c, 'beweegt', false) || X().inScope(c, 'voorraad', false));
const leden = fk => (P().index().fam[fk] || []).filter(zichtbaar).sort((a, b) => maatVan(a).localeCompare(maatVan(b)) || X().rang(a) - X().rang(b));
const actiefLeden = fk => leden(fk).filter(c => !isUitl(c));
const famNaam = fk => { const n = cor().naam[fk]; return n || X().famTitel(fk, leden(fk).length ? leden(fk) : (P().index().fam[fk] || [])); };
function maatgroepen(fk){
  const m = new Map();
  actiefLeden(fk).forEach(c => { const k = maatVan(c); if(!m.has(k)) m.set(k, []); m.get(k).push(c); });
  return [...m.entries()].map(([k, cs]) => ({ k, cs, t:k || 'zonder maat' }));
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
    P().S.fcor = X().famCorNorm(d); P().S.idx = null; LEER.x = null; vers();
    if(tekst) toast(tekst, 3500);
  }catch(e){ toast('Opslaan indeling mislukt: ' + e.message, 6000); }
  X().rerender();
}
// voorstel voor de twee proeffamilies (Daan neemt het over met één klik, of niet)
const VOORSTEL = [
  { id:'kokos', naam:'Kokos op rol', uit:'Kokos 100 en 200 cm, 17 en 24 mm (rollen per cm) uit twee families samen; de deurmatten blijven apart.',
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

/* ---------- concept (per apparaat tot je opslaat) ---------- */
const CK = 'famconcept';
const CON = (() => { const c = X().leesJson(CK, {}); return c && typeof c === 'object' ? c : {}; })();
const bewaarCon = () => X().bewaar(CK, JSON.stringify(CON));
function con(fk){ const c = CON[fk] = CON[fk] || {}; ['f', 'm', 'p', 'niv', 'keuze'].forEach(k => { if(!c[k] || typeof c[k] !== 'object') c[k] = {}; }); return c; }
const niv = (fk, k) => con(fk).niv[k] || (cor().niv[fk] || {})[k] || STD_NIV[k] || 'prod';

/* ---------- waarden per niveau ---------- */
const meest = vals => { const t = {}; vals.forEach(v => t[v] = (t[v] || 0) + 1); const e = Object.entries(t).sort((a, b) => b[1] - a[1]); return e.length ? { v:e[0][0], n:e[0][1], soorten:e.length } : null; };
function norm(k, v){ try{ return X().check(k, v); }catch(e){ return null; } }
// startwaarde van een rij (nog niets getypt): wat vastligt bij de leden, anders een voorstel
const twVan = (c, k) => { const r = P().S.pd[c], m = r && r.meta && r.meta[k]; return m && m.tw && r.data && !leeg(r.data[k]) ? String(r.data[k]) : null; };
function start(fk, k, cs, ctx){
  const sts = cs.map(c => P().staat(c, k)), ok = sts.filter(st => st.s === 'ok').map(st => st.v);
  if(ok.length){
    const m = meest(ok), alle = ok.length === cs.length && m.n === ok.length;
    // nog niet bij iedereen ingevuld: geel, de waarde van de rest wordt bij opslaan de familiewaarde
    return { v:m.v, s:alle ? 'ok' : 'voorstel', n:ok.length, van:cs.length, wijkt:ok.length - m.n, p:1, why:alle ? '' : 'al ingevuld bij ' + m.n + ' van ' + cs.length };
  }
  // geen invoer van Daan, wel een schatting van Claude: geel, de familie neemt hem over bij Opslaan
  const tw = cs.map(c => twVan(c, k)).filter(v => v !== null).map(v => norm(k, v)).filter(Boolean);
  if(tw.length){ const m = meest(tw); return { v:m.v, s:'voorstel', claude:true, why:'schatting Claude' + (cs.length > 1 ? ' (' + m.n + ' van ' + cs.length + ')' : '') + ', te controleren' }; }
  const vs = voorstelRij(fk, k, cs, ctx);
  return vs ? Object.assign({ s:vs.p >= X().ZEKER ? 'voorstel' : 'schatting' }, vs) : { v:'', s:'open' };
}
// voorstel voor een rij: eigen afspraken eerst (max = bij + pallet, plaatsen uit maat), dan Productdata, dan wat de app leerde
function voorstelRij(fk, k, cs, ctx){
  const w = ctx || {};
  if(k === 'maxpick'){
    const lv = num(w.lvl), sp = num(w.spp);
    if(lv !== null && sp && w.met === 'pallet') return { v:String(lv + sp), why:'aanvullen bij ' + nf(lv) + ' + volle pallet ' + nf(sp), p:1, r:'maxpick:som' };
  }
  if(k === 'plaatsen' && w.maat && /\d+\s*x\s*\d+/.test(w.maat)) return { v:X().plaatsenUitMaat(w.maat), why:'uit palletmaat ' + w.maat + ' (plaats = 90 cm)', p:1, r:'plaatsen:maat' };
  if(k === 'met' && MET[w.opslag]) return { v:MET[w.opslag], why:'volgt uit soort ' + w.opslag, p:1, r:'met:klein' };
  // Productdata-voorstellen per lid (getoetst, KANS-tabel)
  const vs = cs.map(c => { try{ return P().voorstel(c, k, P().waardeFn(c)); }catch(e){ return null; } }).filter(v => v && !leeg(v.v) && v.r !== 'conflict');
  const pd = vs.length ? meest(vs.map(v => norm(k, v.v)).filter(Boolean)) : null;
  const pdBest = pd && vs.find(v => norm(k, v.v) === pd.v);
  const pdP = pdBest ? (pdBest.p ?? (pdBest.z === 'hoog' ? 0.8 : 0.5)) : 0;
  const lr = LEER.voorspel ? leerRij(k, cs) : null;
  if(pdBest && pdP >= X().ZEKER && (!lr || lr.p <= pdP)) return { v:pd.v, why:pdBest.bron + (cs.length > 1 ? ' (' + pd.n + ' van ' + cs.length + ')' : ''), p:pdP, r:pdBest.r };
  if(lr && (!pdBest || lr.p >= pdP)) return lr;
  if(pdBest) return { v:pd.v, why:pdBest.bron, p:pdP, r:pdBest.r };
  return null;
}
const MET = { pallet:'pallet', deel:'deel', mix:'doos' };
// waarde van een rij: getypt (concept) of de startwaarde
function rijWaarde(fk, rij, k, cs, ctx){
  const c = con(fk), bak = rij === 'fam' ? c.f : rij.startsWith('m:') ? (c.m[rij.slice(2)] = c.m[rij.slice(2)] || {}) : (c.p[rij.slice(2)] = c.p[rij.slice(2)] || {});
  if(bak[k] !== undefined){ const n = norm(k, bak[k]); return { v:n === null ? String(bak[k]) : n, s:n === null ? 'fout' : 'nieuw', getypt:true }; }
  return start(fk, k, cs, ctx);
}
// alles voor één familie op een rij: per veld en per product de waarde die opslaan zou schrijven
function rek(fk){
  const ls = actiefLeden(fk), mg = maatgroepen(fk), velden = VELD(), R = { fam:{}, maat:{}, prod:{}, eff:{} };
  const famCtx = {};
  velden.filter(k => niv(fk, k) === 'fam').forEach(k => { R.fam[k] = rijWaarde(fk, 'fam', k, ls, famCtx); if(R.fam[k].s !== 'schatting') famCtx[k] = R.fam[k].v; });
  mg.forEach(g => {
    const ctx = Object.assign({}, famCtx), r = R.maat[g.k] = {};
    // volgorde: eerst wat andere velden nodig hebben (spp en maat voor max en plaatsen)
    ['spp', 'maat', 'hoogte'].concat(velden).filter((k, i, a) => a.indexOf(k) === i && niv(fk, k) === 'maat').forEach(k => { r[k] = rijWaarde(fk, 'm:' + g.k, k, g.cs, ctx); if(r[k].s !== 'schatting') ctx[k] = r[k].v; });
    g.cs.forEach(c => {
      const pc = Object.assign({}, ctx), rp = R.prod[c] = {};
      velden.filter(k => niv(fk, k) === 'prod').forEach(k => { rp[k] = rijWaarde(fk, 'p:' + c, k, [c], pc); if(rp[k].s !== 'schatting') pc[k] = rp[k].v; });
      R.eff[c] = k => { const L = niv(fk, k), x = L === 'fam' ? R.fam[k] : L === 'maat' ? r[k] : rp[k]; return x && x.s !== 'schatting' && x.s !== 'fout' ? x.v : ''; };
    });
  });
  return R;
}

/* ---------- opslaan: per product, eigen invoer nooit stil overschrijven ---------- */
function plan(fk){
  const R = rek(fk), c = con(fk), uitz = cor().uitz || {}, wijz = {}, keuzes = [], uitzNu = {}, fouten = [], nodigVan = {};
  const pd = P().S.pd;
  actiefLeden(fk).forEach(code => {
    const eff = R.eff[code]; if(!eff) return;
    // nodig() kijkt naar de opgeslagen soort: tijdelijk de werkbladwaarden eroverheen
    const oud = pd[code];
    const data = Object.assign({}, (oud && oud.data) || {}); VELD().forEach(k => { const v = eff(k); if(v !== '') data[k] = v; });
    pd[code] = { data, meta:(oud && oud.meta) || {}, t:oud && oud.t };
    let nodigK;
    try{ nodigK = VELD().filter(k => P().nodig(code, k, eff)); } finally { if(oud) pd[code] = oud; else delete pd[code]; }
    nodigVan[code] = new Set(nodigK);
    nodigK.forEach(k => {
      const L = niv(fk, k), x = L === 'fam' ? R.fam[k] : L === 'maat' ? R.maat[maatVan(code)][k] : R.prod[code][k];
      if(x && x.s === 'fout'){ fouten.push(code + ' · ' + P().VELDEN[k].t); return; }
      const v = eff(k); if(v === '') return;
      const st = P().staat(code, k), bron = bronVan(code, k), ke = (c.keuze[code] || {})[k];
      if(st.s === 'ok' && String(st.v) === String(v)) return;
      if(st.s === 'ok' && EIGEN.has(bron)){
        if(ke === 'fam'){ (wijz[code] = wijz[code] || {})[k] = { v, bron:L === 'fam' ? 'familie' : L === 'maat' ? 'maatgroep' : 'invul' }; return; }
        if(ke === 'houd' || (uitz[code] || {})[k]){ (uitzNu[code] = uitzNu[code] || {})[k] = true; return; }
        keuzes.push({ code, k, eigen:st.v, fam:v, bron, L });
        return;
      }
      (wijz[code] = wijz[code] || {})[k] = { v, bron:L === 'fam' ? 'familie' : L === 'maat' ? 'maatgroep' : 'invul' };
    });
  });
  return { R, wijz, keuzes, uitzNu, fouten, nodigVan, n:Object.keys(wijz).length, nUitz:Object.values(uitzNu).reduce((s, o) => s + Object.keys(o).length, 0) };
}
async function opslaan(fk){
  const p = plan(fk);
  if(p.fouten.length){ toast('Eerst verbeteren: ' + p.fouten.slice(0, 3).join(', '), 6000); return; }
  UI.bezig = true; X().rerender();
  try{
    const n = await P().opslaan(p.wijz, 'familie');
    // niveaus en uitzonderingen bij de familie bewaren
    const c = con(fk);
    await bewaarCor(d => {
      d.niv[fk] = Object.assign({}, d.niv[fk] || {}, c.niv);
      Object.keys(d.uitz).forEach(code => { if(famVan(code) !== fk) return; Object.keys(d.uitz[code]).forEach(k => { if((c.keuze[code] || {})[k] === 'fam') delete d.uitz[code][k]; }); if(!Object.keys(d.uitz[code]).length) delete d.uitz[code]; });
      Object.entries(p.uitzNu).forEach(([code, ks]) => { d.uitz[code] = Object.assign({}, d.uitz[code] || {}, ks); });
    });
    delete CON[fk]; bewaarCon(); vers();
    LEER.x = null;    // leert mee: regels opnieuw toetsen met de nieuwe waarden
    UI.uitslag = { fk, n, uitz:p.nUitz, open:p.keuzes.length, op:Date.now() };
    toast(plural(n, 'product', 'producten') + ' bijgewerkt, ' + plural(p.nUitz, 'uitzondering', 'uitzonderingen') + (p.keuzes.length ? ' · ' + nf(p.keuzes.length) + ' keuzes nog open' : ''), 6000);
  }catch(e){ toast('Opslaan mislukt: ' + e.message, 8000); }
  UI.bezig = false; X().rerender();
}
// voorstel-indeling overnemen: familie, naam, vaste maatgroepen en (op aanwijzing van Daan) uitlopend
async function neemOver(id){
  const x = voorstelInfo(VOORSTEL.find(v => v.id === id) || {}); if(!x) return null;
  await bewaarCor(d => { x.cs.forEach(c => { d.fam[c] = x.doel; const m = x.v.maat && x.v.maat(c); if(m) d.maat[c] = m; }); d.naam[x.doel] = x.v.naam; }, 'Indeling ' + x.v.naam + ' overgenomen');
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

/* ---------- leren: Daans patronen ----------
   Kenmerken per product komen alleen uit bestaande data. Regels zijn eenvoudig en uitlegbaar; elke regel wordt per familie
   getoetst: de familie telt niet mee bij het leren en ook haar eigen waarden niet (alsof de familie leeg is). */
const LEER = { x:null, voorspel:true };
const mediaan = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };
function kenmerken(c){
  const S = P().S, e = P().eenheid(c).e, abc = X().abcVan(c);
  const sb = X().sppBronnen(c), sppH = ['mvvst', 'vst2', 'bulk2', 'vst1', 'bulk1', 'pakbon'].map(r => sb[r]).find(Boolean);
  const spp = sppH ? num(sppH.v) : null, sterk = ['mvvst', 'vst2', 'bulk2'].map(r => sb[r]).find(Boolean), sppSterk = sterk ? num(sterk.v) : null;
  const ink = ((S.ink && S.ink.p && S.ink.p[c]) || []).map(x => num(x[1]) || 0).filter(x => x > 0);
  let veelvoud = null;
  if(ink.length >= 3){
    const tel = {};
    ink.forEach(a => { for(let d = 2; d * d <= a; d++) if(a % d === 0){ tel[d] = (tel[d] || 0) + 1; if(d * d !== a) tel[a / d] = (tel[a / d] || 0) + 1; } tel[a] = (tel[a] || 0) + 1; });
    const ds = Object.keys(tel).map(Number).filter(d => d >= 2 && tel[d] / ink.length >= 0.8).sort((x, y) => y - x);
    veelvoud = ds.length ? ds[0] : null;
  }
  const vollePal = spp && ink.length >= 2 ? ink.filter(a => a % spp === 0).length / ink.length >= 0.8 : false;
  const LOC = D.LOC || {};
  const aanv = (S.mv[c] || []).filter(m => !m.vst && m.van && LOC[m.van] && LOC[m.van].bulk && m.naar && !(LOC[m.naar] && LOC[m.naar].bulk)).map(m => m.n).filter(n => n > 0);
  const tijden = (S.mv[c] || []).map(m => Date.parse(m.t)).filter(t => t > 0);
  const maanden = tijden.length ? Math.max(1, (Math.max(...tijden) - Math.min(...tijden)) / (30.4 * 864e5)) : 1;
  const ratio = spp && aanv.length ? mediaan(aanv.map(n => n / spp)) : null;
  const pb = X().pbRegels(c).find(r => r.soort !== 'pallet' && num(r.per) > 1);
  const pq = D.PQ[c] || [];
  const soort = P().famNaam(String((D.P[c] || {}).naam || '')).split(' ').filter(w => w.length > 2)[0] || '';
  return { lev:X().levKort(c), soort, e, abc, ab:/^[AB]$/.test(abc) ? 'A/B' : 'C', vkm:X().vkmVan(c), pd:X().pdVan(c), spp, sppSterk, sppT:sppH ? sppH.t : '', ink, veelvoud, vollePal, aanv, aanvMed:mediaan(aanv), ratio, perMaand:aanv.length / maanden,
    pakbon:pb ? num(pb.per) * (num(pb.factor) || 1) : null, pq0:num(pq[0]), pq1:num(pq[1]), pick:P().locaties(c).pick.length > 0, regel:X().regelVan(c) };
}
const EHT = { st:'per stuk', m:'per meter', cm:'per cm', rol:'per rol', m2:'per m²' };
// regels per veld: vaste regels (f) en een beslistabel (key) die uit Daans keuzes leert
const REGELS = {
  opslag:[
    { id:'aanv', t:'aanvullingen ≈ 1 pallet → 1 Pallet; minder dan een pallet → 2 Deel', f:x => x.ratio === null || x.aanv.length < 2 ? null : x.ratio >= 0.9 ? { v:'pallet', why:x.aanv.filter(n => n >= 0.9 * x.spp).length + ' van ' + x.aanv.length + ' aanvullingen waren een volle pallet van ' + nf(x.spp) } : { v:'deel', why:'aanvullingen meestal ' + nf(x.aanvMed) + ', minder dan een pallet van ' + nf(x.spp) } },
    { id:'tabel', t:'zelfde eenheid, ABC en picklocatie → wat je bij die producten koos', key:x => x.e + '|' + x.ab + '|' + (x.pick ? 'pick' : 'geen'), kt:k => { const [e, ab, p] = k.split('|'); return (EHT[e] || e) + ', ' + ab + ', ' + (p === 'pick' ? 'met picklocatie' : 'zonder picklocatie'); } }
  ],
  met:[
    { id:'aanv', t:'aanvullingen ≈ 1 pallet → volle pallet; minder → deel van pallet', f:x => x.ratio === null || x.aanv.length < 2 ? null : x.ratio >= 0.9 ? { v:'pallet', why:x.aanv.filter(n => n >= 0.9 * x.spp).length + ' van ' + x.aanv.length + ' aanvullingen waren een volle pallet van ' + nf(x.spp) } : { v:'deel', why:'aanvullingen meestal ' + nf(x.aanvMed) + ' (pallet ' + nf(x.spp) + ')' } },
    { id:'tabel', t:'zelfde eenheid en ABC → wat je bij die producten koos', key:x => x.e + '|' + x.ab, kt:k => { const [e, ab] = k.split('|'); return (EHT[e] || e) + ', ' + ab; } }
  ],
  geleverd:[
    { id:'veelvoud', t:'inkoop bijna altijd een veelvoud van x (geen volle pallets) → doos van x', f:x => x.veelvoud && !x.vollePal && (!x.spp || x.veelvoud < x.spp) ? { v:String(x.veelvoud), why:'inkoop ' + x.ink.filter(a => a % x.veelvoud === 0).length + ' van ' + x.ink.length + ' keer een veelvoud van ' + nf(x.veelvoud) } : null },
    { id:'pakbon', t:'pakbon zegt x per doos → doos van x', f:x => x.pakbon ? { v:String(x.pakbon), why:'pakbon: ' + nf(x.pakbon) + ' per doos' } : null },
    { id:'tabel', t:'zelfde eenheid en ABC → wat je bij die producten koos', key:x => x.e + '|' + x.ab, kt:k => { const [e, ab] = k.split('|'); return (EHT[e] || e) + ', ' + ab; } }
  ],
  lvl:[
    { id:'regel', t:'jouw aanvulregel (bijv. rubber per stuk A/B → aanvullen bij 10)', f:x => { const R = x.regel, d = R && R.doel ? R.doel(x.c) : null; return d && !leeg(d.lvl) ? { v:String(d.lvl), why:'aanvulregel: ' + R.t } : null; } },
    { id:'picqer', t:'het aanvulniveau dat nu in Picqer staat (als het bewust is gezet, > 1)', f:x => x.pq0 > 1 ? { v:String(x.pq0), why:'Picqer: aanvullen bij ' + nf(x.pq0) } : null },
    { id:'tabel', t:'zelfde eenheid en ABC → het niveau dat je daar meestal koos', key:x => x.e + '|' + x.ab, kt:k => { const [e, ab] = k.split('|'); return (EHT[e] || e) + ', ' + ab; } }
  ],
  maxpick:[
    { id:'aanv', t:'aanvullen bij + wat je meestal bijvult', f:x => x.lvlEigen !== null && x.aanvMed ? { v:String(x.lvlEigen + x.aanvMed), why:'aanvullen bij ' + nf(x.lvlEigen) + ' + meestal ' + nf(x.aanvMed) + ' bijgevuld (' + x.aanv.length + ' keer)' } : null },
    { id:'picqer', t:'"vul aan tot" dat nu in Picqer staat', f:x => x.pq1 > 1 && !(x.pq0 === 1 && x.pq1 === 11) ? { v:String(x.pq1), why:'Picqer: vul aan tot ' + nf(x.pq1) } : null }
  ],
  mixgroep:[
    { id:'lev', min:1, t:'zelfde leverancier en soort product als een al ingevulde mixgroep', key:x => x.soort ? x.lev + '|' + x.soort : null, kt:k => { const [l, w] = k.split('|'); return 'van ' + l + ' (' + w + ')'; } }
  ],
  spp:[
    { id:'bron', t:'minstens 2 pallets op VST of bulk met hetzelfde aantal', f:x => x.sppSterk ? { v:String(x.sppSterk), why:x.sppT } : null },
    { id:'bron1', t:'één pallet op VST of bulk, of de pakbon', f:x => !x.sppSterk && x.spp ? { v:String(x.spp), why:x.sppT + ' (kan een restpallet zijn)' } : null },
    { id:'inkoop', t:'inkoop altijd in volle pallets van x', f:x => x.veelvoud && x.ink.length >= 3 && x.veelvoud >= 20 ? { v:String(x.veelvoud), why:'inkoop altijd een veelvoud van ' + nf(x.veelvoud) } : null }
  ]
};
const LEERVELDEN = Object.keys(REGELS);
const TABELMIN = R => R.min || 3;
function eigenWaarde(c, k){
  const r = P().S.pd[c], m = r && r.meta && r.meta[k], v = r && r.data && r.data[k];
  if(leeg(v) || X().LEEGWAARDE(v) || X().NVT(v) || !m || /^auto/.test(m.bron || '') || m.tw) return null;   // auto en schattingen met twijfel leren niet mee
  return norm(k, v);
}
// alles leren en per familie toetsen (lokaal, geen server)
function leer(){
  if(LEER.x) return LEER.x;
  const I = P().index(), codes = Object.keys(P().S.pd).filter(c => D.P[c]);
  const kx = {}; const K = c => kx[c] || (kx[c] = Object.assign(kenmerken(c), { c, lvlEigen:eigenWaarde(c, 'lvl') !== null ? num(eigenWaarde(c, 'lvl')) : null }));
  const uit = {};
  LEERVELDEN.forEach(k => {
    const train = codes.map(c => ({ c, v:eigenWaarde(c, k), fk:I.famVan[c] })).filter(x => x.v !== null);
    const regels = REGELS[k].map(R => ({ R, goed:0, tot:0, fout:[] }));
    // beslistabel per regel: key → {waarde: {fam: aantal}}
    const tabel = {};
    REGELS[k].forEach(R => { if(!R.key) return; const t = tabel[R.id] = {}; train.forEach(x => { const key = R.key(K(x.c)); if(key === null) return; const b = t[key] = t[key] || {}; const w = b[x.v] = b[x.v] || {}; w[x.fk] = (w[x.fk] || 0) + 1; }); });
    const kies = (R, x, zonder) => {
      if(R.f) return R.f(x);
      const key = R.key(x); if(key === null) return null;
      const b = (tabel[R.id] || {})[key]; if(!b) return null;
      const tel = Object.entries(b).map(([v, per]) => [v, Object.entries(per).reduce((s, [fk, n]) => s + (fk === zonder ? 0 : n), 0)]).filter(e => e[1] > 0).sort((p, q) => q[1] - p[1]);
      const tot = tel.reduce((s, e) => s + e[1], 0);
      if(!tel.length || tot < (R.min || 3) || tel[0][1] / tot < 0.5) return null;
      return { v:tel[0][0], why:'bij andere producten ' + R.kt(key) + ' koos je ' + tel[0][1] + ' van ' + tot + ' keer ' + tel[0][0] };
    };
    // toets: per product, met de eigen familie eruit (en zijn eigen waarde voor dit veld niet bekend)
    let goedBest = 0, totBest = 0;
    train.forEach(x => {
      const fx = K(x.c);
      let eerste = null;
      regels.forEach(g => { const r = kies(g.R, fx, x.fk); if(!r) return; const v = norm(k, r.v); g.tot++; if(v !== null && v === x.v) g.goed++; else if(g.fout.length < 4) g.fout.push(x.c + ': ' + r.v + ' ≠ ' + x.v); if(!eerste) eerste = { g, v }; });
      if(eerste){ totBest++; if(eerste.v === x.v) goedBest++; }
    });
    regels.forEach(g => { g.p = g.tot ? g.goed / g.tot : 0; P().KANS['leer:' + k + ':' + g.R.id] = [Math.round(g.p * 100) / 100, g.tot]; });
    // volgorde voor voorspellen: hoogste score eerst
    const volg = regels.slice().sort((a, b) => b.p - a.p || b.tot - a.tot);
    uit[k] = { n:train.length, regels, volg, kies, goedBest, totBest };
  });
  LEER.x = { uit, K, op:Date.now() };
  return LEER.x;
}
// voorspelling voor een rij producten: per lid de beste regel die iets zegt, dan de meeste
function leerRij(k, cs){
  if(!REGELS[k]) return null;
  const L = leer(), u = L.uit[k]; if(!u) return null;
  const vs = cs.map(c => { const x = L.K(c); for(const g of u.volg){ if(g.R.key && g.tot < TABELMIN(g.R)) continue; const r = u.kies(g.R, x, null); if(r){ const v = norm(k, r.v); if(v !== null) return { v, why:r.why, g }; } } return null; }).filter(Boolean);
  if(!vs.length) return null;
  const m = meest(vs.map(v => v.v)), b = vs.find(v => v.v === m.v);
  return { v:m.v, why:b.why + (cs.length > 1 ? ' (' + m.n + ' van ' + cs.length + ')' : ''), p:b.g.p, score:'klopte ' + Math.round(b.g.p * 100) + '% bij andere families (' + b.g.tot + ' getoetst)', r:'leer:' + k + ':' + b.g.R.id };
}

/* ---------- weergave ---------- */
const UI = { zoek:'', n:40, open:{}, bezig:false, uitslag:null };
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
  @media (max-width:760px){ .pf-rij{grid-template-columns:1fr} .pf-rij label{padding-top:0} }`;
  document.head.appendChild(s);
}
const pct = (a, b) => b ? Math.round(a / b * 100) : 100;
function famUrl(fk){ return '#/productdata/familie/' + encodeURIComponent(fk); }
function viewLijst(){
  const L = famLijst(), q = UI.zoek.trim().toLowerCase();
  const f = q ? L.filter(x => x.naam.toLowerCase().includes(q) || x.fk.toLowerCase().includes(q) || actiefLeden(x.fk).some(c => c.toLowerCase().includes(q))) : L;
  const open = f.filter(x => x.open), v = voortgang(), vg = volgende();
  const vs = VOORSTEL.map(voorstelInfo).filter(x => x && !x.klaar);
  app().innerHTML = `<a class="small" href="#/productdata">← Productdata</a>
  <div class="card mt8"><div class="pd-kop"><div><h2>Per familie</h2><div class="small muted mt4">Een hele familie in één keer, alle lagen tegelijk. Wat de hele familie deelt vul je één keer in, wat per maat verschilt per maatgroep, en per product alleen de vloernaam en wat afwijkt.</div></div>
    ${vg ? `<a class="btn acc" href="${famUrl(vg.fk)}">Volgende familie →</a>` : ''}</div>
    <div class="small mt8"><b>${nf(v.klaar)}</b> van ${nf(v.tot)} families klaar (laag 1–3, families met een A-, B- of binnenkomend product)</div>
    <div class="row wrap mt8"><input id="pf-zoek" data-pfz="1" value="${esc(UI.zoek)}" placeholder="zoek familie, code of naam" style="max-width:300px"></div></div>
  ${vs.map(x => `<div class="card" style="border-left:4px solid var(--blue)"><div class="row between wrap"><div><h3>Voorstel indeling: ${esc(x.v.naam)}</h3><div class="small muted mt4">${esc(x.v.uit)} Nu ${plural(x.cs.length, 'product', 'producten')} in ${plural(x.fks.length, 'familie', 'families')}.</div></div>
    <button class="btn pri" data-pfa="voorstel" data-id="${esc(x.v.id)}">Indeling overnemen</button></div></div>`).join('')}
  <div class="pf-lijst">${(q ? f : open.concat(f.filter(x => !x.open))).slice(0, UI.n).map(x => `<a class="pf-fam${x.open ? '' : ' klaar'}" href="${famUrl(x.fk)}"><div><b>${esc(x.naam)}</b><div class="u">${esc(x.fk.split('|')[0])} · ${plural(x.n, 'product', 'producten')} · ${plural(x.maten, 'maatgroep', 'maatgroepen')}${x.ab ? ' · A/B' : ''}${x.binnen ? ' · komt binnen' : ''}</div></div>
    <div class="pf-pct">${x.open ? nf(x.gevuld) + ' van ' + nf(x.velden) + ' velden' : '✓ klaar'}</div></a>`).join('') || '<div class="card empty">Geen families gevonden.</div>'}</div>
  ${f.length > UI.n ? `<div class="row" style="justify-content:center;margin:10px 0"><button class="btn" data-pfa="meer">Toon meer (${nf(f.length - UI.n)})</button></div>` : ''}
  ${toetsRapport()}`;
}
function toetsRapport(){
  const L = leer();
  return `<details class="card mt12"><summary><b>Wat de app van je leerde</b> <span class="small muted">per veld getoetst per familie (alsof die familie leeg is)</span></summary>
    ${LEERVELDEN.map(k => { const u = L.uit[k]; return `<div class="mt12"><b>${esc(P().VELDEN[k].t)}</b> <span class="small muted">${nf(u.n)} producten met jouw waarde · ${nf(u.totBest)} getoetst (een regel zei iets) · ${pct(u.goedBest, u.totBest)}% goed</span>
      <ul class="pf-regels">${u.volg.map(g => `<li>${esc(g.R.t)} — <b>${g.tot ? Math.round(g.p * 100) + '%' : '–'}</b> <span class="muted">(${nf(g.goed)} van ${nf(g.tot)})</span>${g.p >= X().ZEKER && g.tot >= 3 ? ' · vult vooraf in' : g.tot ? ' · alleen schatting' : ''}</li>`).join('')}</ul></div>`; }).join('')}
    <div class="small muted mt8">≥ 75% goed: vooraf ingevuld (geel). Daaronder een schatting met Gebruik. Na elke opgeslagen familie opnieuw getoetst.</div></details>`;
}
// één invoercel
function cel(fk, rij, k, x, opt){
  const o = opt || {}, id = 'pf-' + X().idVan(rij + '-' + k);
  const sch = x.s === 'schatting', d = P().VELDEN[k];
  const ph = sch ? x.v : (d.type === 'num' ? 'getal, nvt, onb' : '');
  const val = sch ? '' : x.v;
  const eh = d.eh && o.eh ? o.eh : (d.eh2 || '');
  const why = x.s === 'ok' || (x.van && x.n) ? (x.why ? `<span>${esc(x.why)}</span>` : '') + (x.wijkt ? `<span><span class="pf-dot"></span>${nf(x.wijkt)} wijkt af</span>` : '') + ''
    : x.s === 'voorstel' || sch ? `<span>${esc(x.why || '')}</span>${x.score ? `<span class="sc">${esc(x.score)}</span>` : x.p ? `<span class="sc">klopte ${Math.round(x.p * 100)}%</span>` : ''}${sch ? ` <button class="pf-k" data-pfa="gebruik" data-r="${esc(rij)}" data-k="${k}" data-v="${esc(x.v)}">Gebruik</button>` : ''}`
    : x.s === 'fout' ? '<span style="color:var(--bad)">' + esc((() => { try{ X().check(k, x.v); return ''; }catch(e){ return e.message; } })()) + '</span>' : '';
  return `<input id="${id}" class="pf-in ${x.s}" data-pf="1" data-r="${esc(rij)}" data-k="${k}" value="${esc(val)}" placeholder="${esc(ph)}" ${d.type === 'num' ? 'inputmode="decimal"' : ''} autocomplete="off" ${UI.bezig ? 'disabled' : ''}>${eh ? `<span class="small muted"> ${esc(eh)}</span>` : ''}${why ? `<div class="pf-why">${why}</div>` : ''}${o.knop || ''}`;
}
const keusHint = k => { const d = P().VELDEN[k]; return d.opt ? d.opt.map(o => o[0]).join(' · ') : d.type === 'geleverd' ? 'stuk · getal · wisselt' : ''; };
function viewWerkblad(fk){
  if(!P().index().fam[fk]){ app().innerHTML = `<a class="small" href="#/productdata/familie">← Per familie</a><div class="card empty mt8">Familie niet gevonden.</div>`; return; }
  const ls = actiefLeden(fk), uitl = leden(fk).filter(isUitl), mg = maatgroepen(fk), R = rek(fk), pl = plan(fk);
  // alleen velden die bij minstens één product nodig zijn (soort, picklocatie en eenheid bepalen dat)
  const nodigIem = k => ls.some(c => pl.nodigVan[c] && pl.nodigVan[c].has(k));
  const velden = VELD().filter(nodigIem), famV = velden.filter(k => niv(fk, k) === 'fam'), maatV = velden.filter(k => niv(fk, k) === 'maat'), prodV = velden.filter(k => niv(fk, k) === 'prod');
  const ehAlle = (() => { const m = {}; ls.forEach(c => { const e = P().eenheid(c).t; (m[e] = m[e] || []).push(c); }); return m; })();
  const I = P().index(), t = telOpen(fk);
  const vkm = ls.reduce((s, c) => s + X().vkmVan(c), 0), pdd = ls.reduce((s, c) => s + X().pdVan(c), 0);
  const abc = ls.reduce((m, c) => { const a = X().abcVan(c) || '–'; m[a] = (m[a] || 0) + 1; return m; }, {});
  const cont = new Set(); (D.CONT || []).filter(c => c.status !== 'afgerond').forEach(c => ((c.regels || (c.data && c.data.regels)) || []).forEach(r => { const k = r && (D.PLOW[String(r.productcode || '').toLowerCase()] || r.productcode); if(k && ls.includes(k)) cont.add(c.id || c.containernummer || c.pakbon_ref); }));
  const vg = volgende(fk);
  const keuzeVan = {}; pl.keuzes.forEach(x => { (keuzeVan[x.code] = keuzeVan[x.code] || []).push(x); });
  const uitz = cor().uitz || {};
  const lab = X().verschilNamen(ls.length ? ls : uitl);
  // per veld de knop om een niveau te zakken of terug te gaan
  const zak = (k, van) => van === 'fam' ? `<button class="pf-k" data-pfa="niv" data-k="${k}" data-v="maat">verschilt per maat</button>` : van === 'maat' ? `<button class="pf-k" data-pfa="niv" data-k="${k}" data-v="prod">verschilt per product</button>` : '';
  const terug = (k, L) => {
    const rijen = L === 'maat' ? mg.map(g => R.maat[g.k][k]) : ls.map(c => R.prod[c][k]);
    const vals = [...new Set(rijen.filter(x => x && x.s !== 'schatting').map(x => x.v))];
    const naar = L === 'maat' ? 'fam' : 'maat';
    return vals.length <= 1 && (L === 'maat' || mg.length === 1 || mg.every(g => { const v = [...new Set(g.cs.map(c => R.prod[c][k]).filter(x => x && x.s !== 'schatting').map(x => x.v))]; return v.length <= 1; }))
      ? `<button class="pf-k" data-pfa="niv" data-k="${k}" data-v="${naar}">geldt voor de hele ${naar === 'fam' ? 'familie' : 'maatgroep'}</button>` : '';
  };
  const ehVan = cs => [...new Set(cs.map(c => P().eenheid(c).mv))];
  const famOpts = (() => { const lev = fk.split('|')[0], woorden = fk.split('|')[1].split(' ').filter(w => w.length > 3);
    return Object.keys(I.fam).filter(f => f !== fk && f.split('|')[0] === lev && woorden.some(w => f.includes(w)) && actiefLeden(f).length).slice(0, 40); })();
  app().innerHTML = `<a class="small" href="#/productdata/familie">← Per familie</a>
  <div class="card mt8 pf-kop"><div class="pd-kop"><div><h2>${esc(famNaam(fk))}</h2><div class="small muted">${esc(fk.split('|')[0])} · ${plural(ls.length, 'product', 'producten')} · ${plural(mg.length, 'maatgroep', 'maatgroepen')} · ${nf(t.gevuld)} van ${nf(t.velden)} velden (laag 1–3)</div></div>
      ${vg ? `<a class="btn" href="${famUrl(vg.fk)}">Volgende familie →</a>` : ''}</div>
    <div class="pf-stats"><span>Verkoop <b>${nf(Math.round(vkm))}</b> per maand</span><span>Picks <b>${nf(pdd, 1)}</b> per dag</span><span>ABC ${Object.entries(abc).map(([a, n]) => `<b>${esc(a)}</b> ${n}`).join(' · ')}</span><span>Open containers <b>${nf(cont.size)}</b></span></div>
    <div class="row wrap" style="gap:8px"><input id="pf-naam" data-pfnaam="1" value="${esc(cor().naam[fk] || '')}" placeholder="Naam voor deze familie (bijv. Kokos)" style="max-width:280px"><button class="btn sm" data-pfa="naam">Naam bewaren</button>
      ${famOpts.length ? `<select id="pf-erbij" style="max-width:280px"><option value="">Familie erbij…</option>${famOpts.map(f => `<option value="${esc(f)}">${esc(famNaam(f))} (${actiefLeden(f).length})</option>`).join('')}</select><button class="btn sm" data-pfa="erbij">Samenvoegen</button>` : ''}</div>
    ${(() => { const u = ls.filter(naamUitl); return u.length ? `<div class="pf-keus"><b>Uitlopend?</b> ${plural(u.length, 'product heeft', 'producten hebben')} UITLOPEND in de naam: ${esc(u.map(c => lab[c] || c).join(', '))}<button class="pf-k" data-pfa="uitl" data-codes="${esc(u.join('\n'))}" data-aan="1">${u.length > 1 ? 'Alle ' + u.length + ' op uitlopend' : 'Op uitlopend'}</button></div>` : ''; })()}
    ${Object.keys(ehAlle).length > 1 ? `<div class="small" style="color:var(--bad)"><b>Eenheid verschilt in Picqer:</b> ${Object.entries(ehAlle).map(([e, cs]) => nf(cs.length) + ' ' + esc(e) + (cs.length <= 4 ? ' (' + esc(cs.join(', ')) + ')' : '')).join(' · ')}. Controleer dat stuks per pallet, aanvullen bij en max op pick in de eenheid van Picqer staan.</div>` : ''}
    ${UI.uitslag && UI.uitslag.fk === fk && Date.now() - UI.uitslag.op < 6e5 ? `<div class="small" style="color:var(--ok)"><b>Opgeslagen: ${plural(UI.uitslag.n, 'product', 'producten')} bijgewerkt, ${plural(UI.uitslag.uitz, 'uitzondering', 'uitzonderingen')}${UI.uitslag.open ? ' · ' + nf(UI.uitslag.open) + ' keuzes nog open' : ''}</b></div>` : ''}</div>

  <section class="pf-sec"><h3>1 · Familie <span class="u">geldt voor alle ${plural(ls.length, 'product', 'producten')}</span></h3>
    ${famV.map(k => `<div class="pf-rij"><label for="pf-${X().idVan('fam-' + k)}">${esc(P().VELDEN[k].t)}${keusHint(k) ? `<div class="small muted" style="font-weight:400">${esc(keusHint(k))}</div>` : ''}</label><div>${cel(fk, 'fam', k, R.fam[k], { eh:ehVan(ls).join('/') })}</div><div class="pf-why" style="padding-top:8px">${zak(k, 'fam')}</div></div>`).join('') || '<div class="pf-rij"><span class="muted small">Alle velden verschillen per maat of product.</span></div>'}
  </section>

  <section class="pf-sec"><h3>2 · Maatgroepen <span class="u">per maat dezelfde palletgegevens</span></h3>
    <div class="pf-tab"><table class="pf-t"><thead><tr><th>Maat</th>${maatV.map(k => `<th>${esc(P().VELDEN[k].t)}${terug(k, 'maat')}${zak(k, 'maat')}</th>`).join('')}</tr></thead><tbody>
    ${mg.map(g => { const eh = ehVan(g.cs);
      return `<tr><td class="kop"><b>${esc(g.t)}</b><div class="small muted">${plural(g.cs.length, 'product', 'producten')} · ${esc(eh.join(' / '))}</div>${eh.length > 1 ? `<div class="small" style="color:var(--bad)">Eenheid verschilt (${esc(g.cs.map(c => c + ': ' + P().eenheid(c).t).join(', '))}): controleer dat stuks per pallet in de eenheid van Picqer staat.</div>` : ''}
        <div class="row wrap mt4" style="gap:4px">${g.cs.length > 1 ? `<button class="pf-k" data-pfa="splits" data-m="${esc(g.k)}">splitsen</button>` : ''}${mg.length > 1 ? `<select class="pf-k" data-pfa="voeg" data-m="${esc(g.k)}"><option value="">samenvoegen met…</option>${mg.filter(h => h.k !== g.k).map(h => `<option value="${esc(h.k)}">${esc(h.t)}</option>`).join('')}</select>` : ''}<button class="pf-k" data-pfa="uitl" data-codes="${esc(g.cs.join('\n'))}" data-aan="1">uitlopend</button></div></td>
        ${maatV.map(k => `<td>${cel(fk, 'm:' + g.k, k, R.maat[g.k][k], { eh:eh.join('/') })}</td>`).join('')}</tr>`; }).join('')}
    </tbody></table></div></section>

  <details class="pf-sec" ${Object.keys(keuzeVan).length || UI.open[fk] ? 'open' : ''} data-pfdet="${esc(fk)}"><summary style="padding:10px 14px;font-weight:700;cursor:pointer">3 · Producten <span class="small muted">vloernaam, opmerking en uitzonderingen${pl.keuzes.length ? ' · ' + nf(pl.keuzes.length) + ' keuzes open' : ''}</span></summary>
    <div class="pf-tab"><table class="pf-t"><thead><tr><th>Product</th>${prodV.map(k => `<th>${esc(P().VELDEN[k].t)}${terug(k, 'prod')}</th>`).join('')}<th>Indeling</th></tr></thead><tbody>
    ${ls.map(c => { const kz = keuzeVan[c] || [], ux = Object.keys(uitz[c] || {});
      return `<tr><td class="kop">${kz.length || ux.length ? '<span class="pf-dot" title="wijkt af"></span>' : ''}<b>${esc(lab[c] || c)}</b><div class="small muted mono">${esc(c)} ${X().abcBadge(c)}</div><div class="small muted">${esc(maatVan(c) || 'zonder maat')}</div>
        ${kz.map(x => `<div class="pf-keus"><b>${esc(P().VELDEN[x.k].t)}</b> eigen <b>${esc(X().toonWaarde(c, x.k, x.eigen))}</b> · ${esc(NIVNAAM[x.L])} <b>${esc(X().toonWaarde(c, x.k, x.fam))}</b><button class="pf-k" data-pfa="keus" data-c="${esc(c)}" data-k="${x.k}" data-v="fam">${esc(NIVNAAM[x.L])} volgen</button><button class="pf-k" data-pfa="keus" data-c="${esc(c)}" data-k="${x.k}" data-v="houd">deze houden</button></div>`).join('')}
        ${ux.length ? `<div class="small" style="color:#9a4205">Uitzondering: ${esc(ux.map(k => P().VELDEN[k] ? P().VELDEN[k].t + ' ' + X().toonWaarde(c, k, P().staat(c, k).v) : k).join(', '))} <button class="pf-k" data-pfa="uitzweg" data-c="${esc(c)}">familie volgen</button></div>` : ''}</td>
        ${prodV.map(k => `<td>${cel(fk, 'p:' + c, k, R.prod[c][k], {})}</td>`).join('')}
        <td><select class="pf-k" data-pfa="naarfam" data-c="${esc(c)}"><option value="">hoort niet in deze familie…</option><option value="eigen|${esc(c)}">eigen familie</option>${famOpts.map(f => `<option value="${esc(f)}">${esc(famNaam(f))}</option>`).join('')}</select>
          <div class="mt4"><button class="pf-k" data-pfa="uitl" data-codes="${esc(c)}" data-aan="1">${naamUitl(c) ? 'Uitlopend? (staat in de naam)' : 'uitlopend'}</button></div></td></tr>`; }).join('')}
    ${uitl.map(c => `<tr class="pf-uitl"><td class="kop"><b>${esc(lab[c] || c)}</b><div class="small mono">${esc(c)}</div><div class="small">uitlopend sinds ${esc(String(X().pdWaarde(c, 'uitlopend')))}</div></td>${prodV.map(() => '<td></td>').join('')}<td><button class="pf-k" data-pfa="uitl" data-codes="${esc(c)}" data-aan="">terugzetten</button></td></tr>`).join('')}
    </tbody></table></div></details>

  <div class="pf-voet"><div><b>${pl.n ? plural(pl.n, 'product', 'producten') + ' bij te werken' : 'Niets nieuws om op te slaan'}</b><div class="small muted">${pl.nUitz ? plural(pl.nUitz, 'uitzondering', 'uitzonderingen') + ' blijven · ' : ''}${pl.keuzes.length ? nf(pl.keuzes.length) + ' keuzes open (eigen waarde wijkt af) · ' : ''}${pl.fouten.length ? '<span style="color:var(--bad)">' + nf(pl.fouten.length) + ' fout</span> · ' : ''}concept blijft bewaard tot je opslaat</div></div>
    <div class="row wrap" style="gap:8px">${Object.keys(con(fk).f).length + Object.keys(con(fk).m).length + Object.keys(con(fk).p).length ? '<button class="btn" data-pfa="wis">Concept wissen</button>' : ''}<button class="btn acc" data-pfa="opslaan" ${pl.n && !pl.fouten.length && !UI.bezig ? '' : 'disabled'}>${UI.bezig ? 'Opslaan…' : 'Opslaan'}</button></div></div>`;
}
function view(arg){
  stijl();
  if(!P().S.fcor) P().S.fcor = X().famCorNorm(null);
  if(arg) return viewWerkblad(arg);
  return viewLijst();
}

/* ---------- invoer ---------- */
const fkNu = () => { const m = (location.hash || '').match(/^#\/productdata\/familie\/(.+)$/); return m ? decodeURIComponent(m[1]) : null; };
function zetConcept(fk, rij, k, v){
  const c = con(fk), bak = rij === 'fam' ? c.f : rij.startsWith('m:') ? (c.m[rij.slice(2)] = c.m[rij.slice(2)] || {}) : (c.p[rij.slice(2)] = c.p[rij.slice(2)] || {});
  bak[k] = v; bewaarCon();
}
// niveau wijzigen: de huidige waarde wordt het voorstel voor elke rij eronder; omhoog alleen als alles gelijk is (niets gaat verloren)
function zetNiv(fk, k, naar){
  const R = rek(fk), c = con(fk), van = niv(fk, k), mg = maatgroepen(fk);
  if(van === 'fam' && naar === 'maat'){ const x = R.fam[k]; if(x && x.v !== '' && x.s !== 'schatting') mg.forEach(g => { const b = c.m[g.k] = c.m[g.k] || {}; if(b[k] === undefined) b[k] = x.v; }); }
  if(van === 'maat' && naar === 'prod'){ mg.forEach(g => { const x = R.maat[g.k][k]; if(x && x.v !== '' && x.s !== 'schatting') g.cs.forEach(cd => { const b = c.p[cd] = c.p[cd] || {}; if(b[k] === undefined) b[k] = x.v; }); }); }
  if(naar === 'fam'){ const v = mg.map(g => R.maat[g.k][k]).find(x => x && x.v !== '' && x.s !== 'schatting'); if(v && c.f[k] === undefined) c.f[k] = v.v; }
  if(van === 'prod' && naar === 'maat'){ mg.forEach(g => { const v = g.cs.map(cd => R.prod[cd][k]).find(x => x && x.v !== '' && x.s !== 'schatting'); const b = c.m[g.k] = c.m[g.k] || {}; if(v && b[k] === undefined) b[k] = v.v; }); }
  c.niv[k] = naar; bewaarCon(); X().rerender();
}
document.addEventListener('input', ev => {
  const t = ev.target; if(!t || !t.dataset) return;
  if(t.dataset.pfz){ UI.zoek = t.value; X().rerender(); return; }
  if(t.dataset.pf){ const fk = fkNu(); if(fk) zetConcept(fk, t.dataset.r, t.dataset.k, t.value); }
});
document.addEventListener('change', ev => {
  const t = ev.target; if(!t || !t.dataset) return;
  if(t.dataset.pf){ X().rerender(); return; }
  const fk = fkNu(); if(!fk) return;
  if(t.dataset.pfa === 'voeg' && t.value){ const g = maatgroepen(fk).find(x => x.k === t.dataset.m), naar = t.value; if(g) bewaarCor(d => { g.cs.forEach(c => { d.maat[c] = naar; }); }, 'Maatgroepen samengevoegd'); }
  if(t.dataset.pfa === 'naarfam' && t.value){ const c = t.dataset.c, naar = t.value; bewaarCor(d => { d.fam[c] = naar; delete d.maat[c]; }, c + ' naar ' + (naar.startsWith('eigen|') ? 'een eigen familie' : famNaam(naar))); }
});
document.addEventListener('keydown', ev => {
  const t = ev.target; if(ev.key !== 'Enter' || !t || !t.dataset || !t.dataset.pf) return;
  ev.preventDefault();
  // Enter = volgende cel
  const alle = [...document.querySelectorAll('input[data-pf]')], i = alle.indexOf(t), id = alle[i + 1] && alle[i + 1].id;
  X().rerender();
  if(id){ const n = $(id); if(n){ n.focus(); try{ n.select(); }catch(e){} } }
});
document.addEventListener('toggle', ev => { const t = ev.target; if(t && t.dataset && t.dataset.pfdet) UI.open[t.dataset.pfdet] = t.open; }, true);
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-pfa]'); if(!b || b.tagName === 'SELECT') return;
  const a = b.dataset.pfa, fk = fkNu();
  if(a === 'meer'){ UI.n += 40; X().rerender(); return; }
  if(a === 'voorstel'){ neemOver(b.dataset.id); return; }
  if(!fk) return;
  if(a === 'gebruik'){ zetConcept(fk, b.dataset.r, b.dataset.k, b.dataset.v); X().rerender(); return; }
  if(a === 'niv'){ zetNiv(fk, b.dataset.k, b.dataset.v); return; }
  if(a === 'keus'){ const c = con(fk); (c.keuze[b.dataset.c] = c.keuze[b.dataset.c] || {})[b.dataset.k] = b.dataset.v; bewaarCon(); X().rerender(); return; }
  if(a === 'uitzweg'){ const code = b.dataset.c, ks = Object.keys((cor().uitz || {})[code] || {}), c = con(fk); c.keuze[code] = Object.assign(c.keuze[code] || {}, Object.fromEntries(ks.map(k => [k, 'fam']))); bewaarCor(d => { delete d.uitz[code]; }); return; }
  if(a === 'naam'){ const v = (($('pf-naam') || {}).value || '').trim(); bewaarCor(d => { if(v) d.naam[fk] = v; else delete d.naam[fk]; }, v ? 'Naam bewaard' : 'Naam weg'); return; }
  if(a === 'erbij'){ const f = ($('pf-erbij') || {}).value; if(!f) return; const cs = P().index().fam[f] || []; bewaarCor(d => { cs.forEach(c => { d.fam[c] = fk; }); }, plural(cs.length, 'product', 'producten') + ' erbij'); return; }
  if(a === 'splits'){ const g = maatgroepen(fk).find(x => x.k === b.dataset.m); if(g){ const lab = X().verschilNamen(g.cs); bewaarCor(d => { g.cs.forEach(c => { d.maat[c] = (g.k ? g.k + ' · ' : '') + String(lab[c] || c).slice(0, 30); }); }, 'Maatgroep gesplitst'); } return; }
  if(a === 'uitl'){ zetUitlopend(String(b.dataset.codes || '').split('\n').filter(Boolean), !!b.dataset.aan); return; }
  if(a === 'wis'){ delete CON[fk]; bewaarCon(); X().rerender(); return; }
  if(a === 'opslaan'){ opslaan(fk); return; }
});

return { view, opslaan, neemOver, naamUitl, zetUitlopend, bewaarCor, famLijst, volgende, voortgang, leer, rek, plan, famNaam, maatgroepen, actiefLeden, leden, con, niv, zetNiv, VOORSTEL, voorstelInfo, kenmerken, REGELS, EIGEN, LEER };
})();
