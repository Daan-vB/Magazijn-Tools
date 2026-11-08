/* =====================================================================
   IVOL Warehouse 3.0 — Doorloop: de open vragen van Te doen invullen (07-11-2026)
   Zelfde opbouw als de oefenversie (artifact "Te doen Doorloop"), met live data en echt opslaan.
   Route #/doorloop/<soort|gewicht|hoev>: alleen de belangrijke producten die voor die stap open staan, A vóór B, per familie;
   binnen de familie soort → gewicht → hoeveelheid. Eén vraag per scherm, onderaan ← · Later · Klopt (Enter = Klopt, 1–6 = keuzes).
   Welke vragen: dezelfde telling als Productdata 2.0 (PD2R.status en NODIG): Pallet/Deel/Bulk → per pallet, palletmaat, hoogte;
   Pick en Mix → max op pick; Weg → alleen Uitlopend/Backorder/Archief; SAM alleen max op pick; rol → de rolvragen; zonder palletbewijs
   nooit palletvragen. Gewicht volle pallet wordt nooit gevraagd: berekend (kg × per pallet + 15).
   Opslaan: elk Klopt schrijft via PD2R.poZet, dezelfde opslag en bron als Productdata 2.0 (bron pd2, vooraf een kopie van de rij in
   wh-pd2-kopie-<datum>). Uitgevinkt of Later blijft open en komt de volgende keer terug. Picqer: alleen lezen.
   ===================================================================== */
window.WHDL = (function(){
'use strict';
const { esc, nf, num } = WH;
const R = () => window.PD2R;
const SOORTEN = [['pallet', 'Pallet'], ['deel', 'Deel'], ['bulk', 'Bulk'], ['pick', 'Pick'], ['mix', 'Mix'], ['weg', 'Weg']];
const WEG = [['uitlopend', 'Uitlopend'], ['backorder', 'Backorder'], ['archief', 'Archief']];
const GEWST = [['vertrouwd', 'Vertrouwd'], ['tewegen', 'Te wegen'], ['gewogen', 'Gewogen']];
const PAL = ['pallet', 'deel', 'bulk'];
const VRAGEN = ['soort', 'gewicht', 'spp', 'maat', 'hoogte', 'maxpick', 'rl', 'rmax'];
const STAPNR = { soort:1, gewicht:2, spp:3, maat:3, hoogte:3, maxpick:3, rl:3, rmax:3 };
const STAPVAN = { soort:'soort', gewicht:'gewicht', hoev:'hoev' };
const GETAL = ['spp', 'hoogte', 'maxpick', 'rl', 'rmax'];
const HEEL = ['spp', 'maxpick', 'rmax'];   // aantallen: nooit decimalen
const NAAM = { soort:'soort', gewicht:'gewicht', spp:'stuks per pallet', maat:'palletmaat', hoogte:'hoogte', maxpick:'max op pick', rl:'lengte volle rol', rmax:'max rollen per pallet' };
const OK = ['bevestigd', 'aangepast', 'vastgelegd'];
const S = { laterModus:false, el:null, stap:'', fams:[], pad:[], i:0, A:{}, sel:null, openRij:null, melding:'', nieuweMaat:false, notities:{}, notId:{}, sleutel:'', klaar:false, terugNaar:null, prod:null, prodSnap:null, zoek:null, main:null, gast:false, akk:new Set(), vergC:null, vergT:null };
const naamSoort = v => (SOORTEN.find(s => s[0] === v) || [0, v || '?'])[1];
const naamWeg = v => (WEG.find(s => s[0] === v) || [0, v || '?'])[1];
const naamGew = v => (GEWST.find(s => s[0] === v) || [0, v || '?'])[1];
const fmt = v => v === null || v === undefined || v === '' ? '' : String(v).replace('.', ',');
const rang = a => a === 'A' ? 0 : a === 'B' ? 1 : 2;
const A = c => S.A[c] = S.A[c] || { later:{} };
const st = c => R().status(c);
// Later (wh-doorloop-later, wh/taak.js): telt niet mee en komt nooit vooraan in de gewone Doorloop
const LT = () => (window.WHTAAK && WHTAAK.later) || null;
const lat = (c, t) => !!(LT() && LT().is(c, t));
const nLater = () => LT() ? LT().lijst().length : 0;
const laterOpm = (c, t) => { const f = S.pad[S.i] && S.pad[S.i].f; return f ? String(S.notities[f.fk + '|' + t] || '') : ''; };
const mag = () => { const h = location.hash || ''; return h.startsWith('#/doorloop') && S.el && document.body.contains(S.el); };

/* ---------- stijl (alleen binnen .dl) ---------- */
function stijl(){
  if(document.getElementById('dl-stijl')) return;
  const s = document.createElement('style'); s.id = 'dl-stijl';
  s.textContent = `
.dl{--bg:#EDF0F4;--vlak:#FFFFFF;--inkt:#121820;--stil:#5C6675;--lijn:#D6DCE4;--accent:#EF8A4A;--accent-inkt:#1B1205;--voor:#2350A8;--voor-bg:#EAF0FB;--ok:#2E7D4F;--kop:#121820;--kop-inkt:#F4F6F9;
  background:var(--bg);color:var(--inkt);font:1rem/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;min-height:100%;display:flex;flex-direction:column}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .dl{--bg:#0F1318;--vlak:#181E26;--inkt:#E9EDF2;--stil:#97A1AE;--lijn:#2A333F;--voor:#8FB0F0;--voor-bg:#1A2740;--ok:#6FC793;--kop:#0A0D11}}
:root[data-theme="dark"] .dl{--bg:#0F1318;--vlak:#181E26;--inkt:#E9EDF2;--stil:#97A1AE;--lijn:#2A333F;--voor:#8FB0F0;--voor-bg:#1A2740;--ok:#6FC793;--kop:#0A0D11}
.dl *{box-sizing:border-box}
.dl .kop{display:block;position:sticky;top:0;z-index:5;background:var(--kop);color:var(--kop-inkt);padding:0.75rem 1rem}
.dl .kop-in{width:100%;min-width:0;margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:0.375rem 0.75rem}
.dl .kop b{font-size:0.9375rem}
.dl .kop .waar{font-size:0.8125rem;opacity:.75;flex:1 1 5.625rem;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dl .kop a{color:var(--kop-inkt);border:1px solid #ffffff40;border-radius:0.5rem;padding:0.375rem 0.625rem;font:600 0.8125rem inherit;text-decoration:none}
.dl .balk{height:0.25rem;background:#ffffff22;width:100%;margin:0.625rem 0 0;border-radius:2px;overflow:hidden}
.dl .balk i{display:block;height:100%;background:var(--accent);transition:width .3s}
.dl main{flex:1;width:100%;margin:0;padding:1.25rem 1rem 1.5rem;display:flex;flex-direction:column;gap:1rem}
.dl .fam{display:flex;flex-wrap:wrap;align-items:baseline;gap:0.25rem 0.625rem}
.dl .fam h1{font-size:1.375rem;margin:0;overflow-wrap:anywhere}
.dl .fam span{color:var(--stil);font-size:0.875rem}
.dl .stappen{display:flex;gap:0.375rem;flex-wrap:wrap}
.dl .stap{font-size:0.8125rem;font-weight:700;padding:0.25rem 0.625rem;border-radius:62.4375rem;border:1px solid var(--lijn);color:var(--stil)}
.dl .stap.nu{background:var(--inkt);color:var(--vlak);border-color:var(--inkt)}
.dl .stap.af{color:var(--ok);border-color:var(--ok)}
.dl .vraag{font-size:1.5rem;font-weight:750;margin:0.25rem 0 0;line-height:1.25}
.dl .waarom{font-size:0.9375rem;color:var(--stil);margin:0;overflow-wrap:anywhere}
.dl .waarom b{color:var(--voor);font-weight:600}
.dl .chips{display:flex;flex-wrap:wrap;gap:0.5rem}
.dl .chip{border:1.5px solid var(--lijn);background:var(--vlak);color:var(--inkt);border-radius:0.625rem;padding:0.625rem 0.875rem;font:600 1rem inherit;cursor:pointer;min-height:2.875rem}
.dl .chip.voor{border-color:var(--voor);color:var(--voor);background:var(--voor-bg)}
.dl .chip.on{background:var(--inkt);border-color:var(--inkt);color:var(--vlak)}
.dl .chip kbd{font:600 0.6875rem ui-monospace,Menlo,monospace;opacity:.5;margin-left:0.375rem}
.dl .sub{display:flex;flex-wrap:wrap;gap:0.5rem;padding-left:0.25rem}
.dl .lijst{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr));gap:.5rem}
.dl .rij{display:grid;grid-template-columns:1.75rem minmax(0,1fr) auto;gap:0.625rem;align-items:center;padding:0.75rem 0.875rem;background:var(--vlak);border:1px solid var(--lijn);border-radius:0.75rem;align-content:start}
.dl .rij.uit{opacity:.45}
.dl .rij input[type=checkbox]{width:1.375rem;height:1.375rem;accent-color:var(--inkt);margin:0}
.dl .rij .nm{min-width:0;overflow-wrap:anywhere}
.dl .rij .nm b{display:block;font-size:0.9375rem}
.dl .rij .nm code{font:0.75rem ui-monospace,Menlo,monospace;color:var(--stil)}
.dl .rij .feit{display:block;font-size:0.7812rem;color:var(--stil)}
.dl .waarde{font:700 1.0625rem inherit;font-variant-numeric:tabular-nums;border:1.5px solid var(--voor);background:var(--voor-bg);color:var(--voor);border-radius:0.625rem;padding:0.5rem 0.75rem;min-width:5.25rem;text-align:right;cursor:pointer;display:inline-block}
.dl .waarde.zelf{border-color:var(--inkt);background:var(--vlak);color:var(--inkt)}
.dl .waarde.leeg{border-style:dashed;border-color:var(--stil);background:transparent;color:var(--stil);font-weight:600;font-size:0.875rem}
.dl .waarde input{width:5.25rem;font:700 1.0625rem inherit;text-align:right;border:0;background:transparent;color:inherit;outline:none}
.dl .rijkeus{grid-column:2/-1;display:flex;flex-wrap:wrap;gap:0.5rem}
.dl .rijkeus .chip{min-height:2.5rem;padding:0.5rem 0.75rem;font-size:0.9375rem}
.dl .chips.maten .chip{min-height:2.625rem;padding:0.5rem 0.75rem;font-size:0.9375rem;font-variant-numeric:tabular-nums}
.dl .chip.eigen{border-style:dashed}
.dl .chip.nieuw{display:inline-flex;gap:0.375rem;align-items:center;padding:0.25rem 0.375rem 0.25rem 0.75rem}
.dl .chip.nieuw input{width:7.5rem;border:0;background:transparent;color:inherit;font:inherit;outline:none}
.dl .chip.nieuw button{border:0;border-radius:0.5rem;padding:0.375rem 0.625rem;font:700 0.875rem inherit;background:var(--accent);color:var(--accent-inkt);cursor:pointer}
.dl .rechts{display:flex;flex-direction:column;gap:0.375rem;align-items:flex-end}
.dl .waarde.kg{display:inline-flex;align-items:center;gap:0.25rem}
.dl .waarde.kg input{width:4.375rem}
.dl .waarde.kg small{font-size:0.8125rem;opacity:.7}
.dl .melding{border:1.5px solid var(--accent);border-radius:0.625rem;padding:0.625rem 0.75rem;font-size:0.9375rem;font-weight:600;overflow-wrap:anywhere}
.dl .klaar .open{color:var(--accent);font-weight:600}
.dl .notitie{display:flex;flex-direction:column;gap:0.375rem}
.dl .notitie button{align-self:flex-start;background:none;border:0;color:var(--stil);font:600 0.875rem inherit;padding:0;cursor:pointer;text-decoration:underline}
.dl .notitie textarea{font:0.9375rem inherit;border:1px solid var(--lijn);border-radius:0.625rem;padding:0.625rem;background:var(--vlak);color:var(--inkt);min-height:4.375rem;resize:vertical}
.dl .onder{position:sticky;bottom:0;background:var(--vlak);border-top:1px solid var(--lijn);padding:0.75rem 1rem}
.dl .onder-in{width:100%;margin:0;display:flex;gap:0.625rem}
.dl .knop{border-radius:0.75rem;padding:0.875rem 1rem;font:700 1.0625rem inherit;cursor:pointer;border:1.5px solid var(--lijn);background:var(--vlak);color:var(--inkt)}
.dl .knop.hoofd{flex:1;background:var(--accent);border-color:var(--accent);color:var(--accent-inkt)}
.dl .knop:disabled{opacity:.4;cursor:default}
.dl .knop:focus-visible,.dl .chip:focus-visible,.dl .waarde:focus-visible{outline:0.1875rem solid var(--voor);outline-offset:2px}
.dl .klaar{width:100%;background:var(--vlak);border:1px solid var(--lijn);border-radius:0.875rem;padding:1.125rem;display:flex;flex-direction:column;gap:0.5rem;overflow-wrap:anywhere}
.dl .klaar h2{margin:0;font-size:1.25rem}
.dl .klaar ul{margin:0;padding-left:1.125rem;color:var(--stil);font-size:0.9375rem}
.dl .klaar li b{color:var(--inkt)}
.dl .tip{font-size:0.8125rem;color:var(--stil)}
.dl .kop{min-width:0}
.dl .kopknop{white-space:nowrap;background:transparent;color:var(--kop-inkt);border:1px solid #ffffff40;border-radius:0.5rem;padding:0.375rem 0.625rem;font:600 0.8125rem inherit;cursor:pointer}
.dl .stap{background:transparent;font-family:inherit;cursor:pointer}
.dl .stap:focus-visible{outline:0.1875rem solid var(--voor);outline-offset:2px}
.dl .prodlijst{list-style:none;padding-left:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,24rem),1fr));gap:.25rem 1.5rem}
.dl .prodknop{background:none;border:0;text-align:left;font:inherit;color:inherit;width:100%;padding:0.5rem 0;cursor:pointer;overflow-wrap:anywhere;min-height:2.75rem}
.dl .zoekrij{padding:0.75rem 0.875rem;border-top:1px solid var(--lijn)}
.dl .zoekin{font:1.0625rem inherit;border:1.5px solid var(--lijn);border-radius:0.625rem;padding:0.75rem;background:var(--vlak);color:var(--inkt);width:100%}
.dl .afw{border:1.5px solid var(--accent);border-radius:0.625rem;padding:0.5rem 0.625rem;margin:0.375rem 0 2px;font-size:0.875rem;font-weight:600;display:flex;flex-wrap:wrap;gap:0.375rem 0.625rem;align-items:center;justify-content:space-between;overflow-wrap:anywhere;color:var(--inkt)}
.dl .afw>span:first-child{min-width:0;flex:1 1 13.75rem}
.dl .afwk{display:flex;gap:0.375rem}.dl .afwk .chip,.dl .kleinchip{min-height:2.25rem;padding:0.375rem 0.625rem;font-size:0.875rem}
.dl .verg{background:var(--vlak);border:1px solid var(--lijn);border-radius:0.75rem;padding:0.625rem 0.75rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr));gap:0.375rem 1rem}
.dl .verg>.tip{grid-column:1/-1}
.dl code{background:var(--lijn);color:var(--inkt);padding:1px 0.3125rem;border-radius:0.25rem;font:0.75rem ui-monospace,Menlo,monospace}
.dl .vrij{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0.25rem 0.625rem;align-items:center;font-size:0.875rem;overflow-wrap:anywhere}
.dl .vrij .vw{color:var(--stil);grid-column:1/2}.dl .vrij .chip{grid-column:2/3;grid-row:1/3;min-height:2.375rem;padding:0.375rem 0.625rem;font-size:0.875rem}
.dl .veld{display:flex;flex-direction:column;gap:0.5rem;padding:0.625rem 0;border-top:1px solid var(--lijn);min-width:0}
.dl .veldengrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr));gap:0 1.5rem;align-items:start}
.dl .leeg{color:var(--stil)}
@media (max-width:480px){.dl .vraag{font-size:21px}.dl .waarde{min-width:70px}}
@media (prefers-reduced-motion:reduce){.dl .balk i{transition:none}}`;
  document.head.appendChild(s);
}

/* ---------- pad: families met open vragen, A vóór B ---------- */
function bouw(stap){
  if(S.laterModus) return bouwLater();
  const P = R(), alle = P.belangrijk().filter(c => { let s; try{ s = st(c); }catch(e){ return false; } return !s.kop && !P.isKoppel(c) && (window.WHTAAK && WHTAAK.openZL ? WHTAAK.openZL(c, stap).length > 0 : (stap ? !s.stap[stap] : s.open.length > 0)); });
  const per = {}; alle.forEach(c => { (per[P.famVan(c)] = per[P.famVan(c)] || []).push(c); });
  S.fams = Object.entries(per).map(([fk, cs]) => {
    cs.sort((a, b) => rang(P.abcVan(a)) - rang(P.abcVan(b)) || P.naamVan(a).localeCompare(P.naamVan(b), 'nl', { numeric:true }) || a.localeCompare(b));
    const kl = ['A', 'B', 'C'].find(k => cs.some(c => P.abcVan(c) === k)) || '–';
    return { fk, naam:P.famNaam(fk), lev:String((WH.D.P[cs[0]] || {}).leverancier || fk.split('|')[0] || ''), kl, cs };
  }).sort((a, b) => rang(a.kl) - rang(b.kl) || b.cs.length - a.cs.length || a.naam.localeCompare(b.naam, 'nl', { numeric:true }));
  S.pad = []; S.fams.forEach(f => { VRAGEN.forEach(t => S.pad.push({ t, f })); S.pad.push({ t:'klaar', f }); });
  S.i = 0; S.A = {}; S.sel = null; S.openRij = null; S.melding = ''; S.nieuweMaat = false; S.klaar = false;
  laadNotities();
}

// Later-lijst: alleen de vragen die op Later staan, oudste eerst, per familie
function bouwLater(){
  const P = R(), items = LT() ? LT().lijst() : [], fams = [], perFam = {};
  items.forEach(x => { const fk = P.famVan(x.c); if(!perFam[fk]){ perFam[fk] = { fk, items:[] }; fams.push(perFam[fk]); } perFam[fk].items.push(x); });
  S.fams = fams.map(g => { const cs = [...new Set(g.items.map(x => x.c))]; const kl = ['A', 'B', 'C'].find(k => cs.some(c => P.abcVan(c) === k)) || '–';
    return { fk:g.fk, naam:P.famNaam(g.fk), lev:String((WH.D.P[cs[0]] || {}).leverancier || ''), kl, cs, items:g.items }; });
  S.pad = []; S.fams.forEach(f => { VRAGEN.forEach(t => { const rows = [...new Set(f.items.filter(x => x.t === t).map(x => x.c))]; if(rows.length) S.pad.push({ t, f, rows, laterlijst:true }); }); S.pad.push({ t:'klaar', f }); });
  S.i = 0; S.A = {}; S.sel = null; S.openRij = null; S.melding = ''; S.nieuweMaat = false; S.klaar = false;
  laadNotities();
}

/* ---------- rijen per vraag: live uit dezelfde status als Productdata 2.0 (één keer vastgezet zodra de vraag in beeld komt) ---------- */
function rijenNu(v){
  const P = R();
  if(v.t === 'soort') return v.f.cs.filter(c => !st(c).stap.soort && !lat(c, 'soort'));
  // soort eerst: gewicht en hoeveelheid pas na een bevestigde soort; Weg heeft verder geen vragen
  if(v.t === 'gewicht') return v.f.cs.filter(c => { const s = st(c); return s.stap.soort && s.so !== 'weg' && !P.isSam(c) && !s.stap.gewicht && !lat(c, 'gewicht'); });
  return v.f.cs.filter(c => { const s = st(c); return s.stap.soort && s.so !== 'weg' && s.open.includes(v.t) && !lat(c, v.t); });
}
// alle producten van de familie voor deze vraag, ook al bevestigde (voor ←, de stap-knoppen, zoeken): alleen wat bij de soort hoort (NODIG)
function alleRijen(v){
  const P = R(), leden = v.f.cs.filter(c => !P.isKoppel(c));
  if(v.t === 'soort') return leden;
  if(v.t === 'gewicht') return leden.filter(c => soortNu(c) && soortNu(c) !== 'weg' && !P.isSam(c));
  return leden.filter(c => { const so = soortNu(c); if(!so || so === 'weg') return false; try{ return P.nodigVan(c, so, P.info(c)).includes(v.t); }catch(e){ return false; } });
}
const rijenVoor = v => v.alle ? alleRijen(v) : (v.rows || rijenNu(v));

/* ---------- waarden: eigen antwoord in dit scherm > bevestigd > voorstel ---------- */
function waarde(v, c){
  const P = R(), a = A(c), I = P.info(c);
  if(v.t === 'soort'){
    if(a.soort) return { v:a.soort, zelf:true };
    const w = P.soortWaarde(c, I); return { v:w.v || null, zelf:OK.includes(w.st), why:w.why || '' };
  }
  if(v.t === 'gewicht'){
    if(a.gst) return { v:a.gst, zelf:true };
    const g = P.gewicht(c); if(g.st && g.st !== 'niet') return { v:g.st, zelf:true };
    const b = P.gewBewijs(c);
    return { v:b ? b.st : !(g.pq > 0) || P.gewAfwijking(c) ? 'tewegen' : 'vertrouwd', zelf:false, why:b ? b.why + ' · ' + b.som : P.gewAfwijking(c) || '' };
  }
  if(a.f && a.f[v.t] !== undefined) return { v:a.f[v.t], zelf:true };
  const w = P.waarde(c, v.t, I);
  return { v:w.v === '' || w.v === undefined ? null : (v.t === 'hoogte' && num(w.v) ? String(Math.ceil(num(w.v) / 10) * 10) : w.v), zelf:OK.includes(w.st), why:w.why || '' };
}
const wegVan = c => { const a = A(c); if(a.weg) return a.weg; try{ const w = R().wegWaarde(c); return w && w.v ? w.v : ''; }catch(e){ return ''; } };
const soortNu = c => A(c).soort || st(c).so;

/* ---------- feiten: één regel uit de eigen data van het product ---------- */
function feiten(v, c){
  const P = R(), I = P.info(c), d = [P.abcVan(c) || '–'];
  d.push(I.bewijs ? I.bewijs : 'geen palletbewijs');
  const vk = P.vk28(c); if(vk) d.push('verkoop ' + nf(vk) + ' / 28 dgn'); else if(P.vk6(c)) d.push('verkoop ' + nf(P.vk6(c)) + ' / mnd');
  if(v.t === 'gewicht'){ const g = P.gewicht(c); d.push(g.pq > 0 ? 'Picqer ' + fmt(g.pq) + ' kg' : 'Picqer heeft geen gewicht'); }
  if(v.t === 'hoogte'){ const w = waarde(v, c); if(num(w.v) > 140) d.push('te hoog voor 20-locatie hal A'); }
  if(v.t === 'spp' || v.t === 'gewicht'){ const vp = volPallet(c); if(vp) d.push(vp); }
  return d.join(' · ');
}
// CLAUDE.md §4: gewicht volle pallet = kg per stuk × per pallet + 15; alleen bij vertrouwd of gewogen, bij te wegen wacht het
function volPallet(c){
  const P = R(), g = P.gewicht(c), a = A(c), stg = a.gst || g.st, so = soortNu(c);
  if(!PAL.includes(so)) return '';
  const sp = num((a.f && a.f.spp) || P.waarde(c, 'spp').v); if(!sp) return '';
  if(stg === 'tewegen') return 'volle pallet: berekend na wegen';
  const kg = num(a.kg) > 0 ? num(a.kg) : stg === 'gewogen' ? g.kg : g.kg || g.pq;
  return kg > 0 && ['vertrouwd', 'gewogen'].includes(stg) ? 'volle pallet ' + nf(Math.ceil(sp * kg + 15)) + ' kg (berekend)' : '';
}

/* ---------- teksten ---------- */
function meesteVoorstel(v, rijen){
  const t = {}; rijen.forEach(c => { const w = waarde(v, c); if(w.v && !w.zelf){ t[w.v] = t[w.v] || { n:0, c, why:w.why }; t[w.v].n++; } });
  const b = Object.entries(t).sort((x, y) => y[1].n - x[1].n)[0]; return b ? { v:b[0], n:b[1].n, why:b[1].why, c:b[1].c } : null;
}
// wat al bevestigd is: "Bevestigd: Deel", of per product als het verschilt
function bevestigdTekst(v, rijen){
  const groepen = {};
  rijen.forEach(c => { const w = waarde(v, c); if(!w.zelf || w.v === null || w.v === undefined || w.v === '') return;
    const g = veldVan(c, v.t), t = toonVeld(v.t, Object.assign({}, g, { v:w.v })); (groepen[t] = groepen[t] || []).push(c); });
  const k = Object.keys(groepen); if(!k.length) return '';
  const alle = k.length === 1 && groepen[k[0]].length === rijen.length;
  return 'Bevestigd: ' + (alle ? k[0] : k.map(t => t + ' (' + groepen[t].join(', ') + ')').join(' · ')) + '.';
}
function tekst(v, rijen){
  const m = meesteVoorstel(v, rijen), bev = esc(bevestigdTekst(v, rijen)), n = rijen.length, kort = s => esc(String(s || '').replace(/\s+/g, ' ').slice(0, 160));
  switch(v.t){
    case 'soort': return ['Welke soort ' + (n === 1 ? 'is dit product' : 'zijn deze ' + n) + '?', m ? 'Voorstel <b>' + esc(naamSoort(m.v)) + '</b>: ' + kort(m.why) + (m.n < n ? ' (' + m.n + ' van ' + n + ')' : '') + '.' + (bev ? ' ' + bev : '') : bev || 'Geen voorstel uit de data: kies zelf.'];
    case 'gewicht': return ['Klopt het gewicht per stuk uit Picqer?', (m && m.why ? '<b>' + kort(m.why) + '</b>. ' : '') + 'Vertrouwd = Picqer klopt · te wegen = komt op de Weeglijst · gewogen = typ het echte gewicht.' + (bev ? ' ' + bev : '')];
    case 'spp': return ['Hoeveel stuks per pallet?', m ? 'Voorstel per product uit <b>' + kort(m.why) + '</b>. Tik een getal om het aan te passen.' + (bev ? ' ' + bev : '') : bev || 'Geen voorstel uit de data: typ per product het aantal.'];
    case 'maat': return ['Welke palletmaat?', 'Jouw vaste maten' + (R().EIGEN_MATEN.length ? ' plus je eigen toegevoegde maten' : '') + '. Een nieuwe maat wordt meteen bewaard en staat er de volgende keer gewoon tussen.' + (m ? ' Voorstel: <b>' + kort(m.why) + '</b>.' : '') + (bev ? ' ' + bev : '')];
    case 'hoogte': return ['Hoe hoog is een volle pallet, incl. pallet?', 'Wordt naar boven afgerond op 10 cm. Hal A 20-locatie: max ± 140 cm.' + (m ? ' Voorstel uit <b>' + kort(m.why) + '</b>.' : '') + (bev ? ' ' + bev : '')];
    case 'maxpick': return ['Max op pick?', 'Aanvullen bij + wat je aanvult.' + (m ? ' Voorstel uit <b>' + kort(m.why) + '</b>.' + (bev ? ' ' + bev : '') : bev ? ' ' + bev : ' Geen voorstel uit de data: typ per product.')];
    case 'rl': return ['Hoe lang is een volle rol (m)?', m ? 'Voorstel uit <b>' + kort(m.why) + '</b>.' + (bev ? ' ' + bev : '') : bev || 'Geen voorstel uit de data: typ per product.'];
    case 'rmax': return ['Hoeveel rollen passen op een pallet?', m ? 'Voorstel uit <b>' + kort(m.why) + '</b>.' + (bev ? ' ' + bev : '') : bev || 'Geen voorstel uit de data: typ per product.'];
  }
  return ['', ''];
}
const opties = (v, f) => v.t === 'soort' ? SOORTEN : v.t === 'gewicht' ? GEWST : R().matenVoor(f.cs[0]).map(m => [m, m]);

/* ---------- tekenen ---------- */
function telVragen(vanaf){ let n = 0; for(let j = vanaf; j < S.pad.length; j++){ const v = S.pad[j]; if(v.t !== 'klaar' && rijenVoor(v).length) n++; } return n; }
// vragen zonder producten (alles al vast, of soort Weg) overslaan, in de richting waarin Daan loopt
function sla(richting){
  while(S.pad[S.i] && S.pad[S.i].t !== 'klaar' && !rijenVoor(S.pad[S.i]).length){ const j = S.i + richting; if(j < 0 || j >= S.pad.length) break; S.i = j; }
}
function teken(){
  if(!S.el) return;
  if(!R() || !R().S.klaar){ S.el.innerHTML = `<div class="dl"><main><p class="leeg">Productdata laden…</p></main></div>`; return; }
  if(S.zoek){ S.el.innerHTML = zoekHtml(); const x = document.getElementById('dl-zoekin'); if(x){ x.focus(); const l = x.value.length; try{ x.setSelectionRange(l, l); }catch(e){} } return; }
  const nL = nLater(), laterKnop = nL > 0 && !S.laterModus ? `<a class="knop hoofd" href="#/doorloop/later" style="text-align:center;text-decoration:none">Later-lijst →</a>` : '';
  const eind = (kop, titel, tekst) => { S.el.innerHTML = `<div class="dl">${kopHtml(kop, 100)}<main><div class="klaar"><h2>${esc(titel)}</h2><p class="waarom">${esc(tekst)}</p><div class="rij">${laterKnop}<a class="knop${laterKnop ? '' : ' hoofd'}" href="#/todo" style="text-align:center;text-decoration:none">← Te doen</a></div></div></main></div>`; };
  if(!S.pad.length){
    if(S.laterModus) return eind('Later-lijst leeg', 'Niets meer op Later', 'Alles wat op Later stond is ingevuld.');
    return nL > 0 ? eind('Klaar, behalve ' + nL + ' op Later', 'Klaar, behalve ' + nL + ' op Later', 'Alles wat open stond is ingevuld. ' + nL + (nL === 1 ? ' vraag staat' : ' vragen staan') + ' op Later.')
      : eind('Niets open', 'Niets meer open' + (S.stap ? ' voor ' + R().STAPNAAM[S.stap] : ''), 'Alle belangrijke producten zijn ingevuld.');
  }
  if(S.klaar){
    if(S.laterModus) return eind('Klaar', 'Later-lijst doorlopen', nL > 0 ? nL + (nL === 1 ? ' vraag blijft' : ' vragen blijven') + ' op Later.' : 'Alles wat op Later stond is ingevuld.');
    return nL > 0 ? eind('Klaar, behalve ' + nL + ' op Later', 'Klaar, behalve ' + nL + ' op Later', 'Elk antwoord staat in Productdata. ' + nL + (nL === 1 ? ' vraag staat' : ' vragen staan') + ' op Later.')
      : eind('Klaar', 'Alles doorlopen', 'Elk antwoord staat in Productdata.');
  }
  const v = S.pad[S.i], f = v.f, fi = S.fams.indexOf(f);
  if(v.t !== 'klaar' && !v.rows && !v.alle) v.rows = rijenNu(v);
  const stp = S.prod ? 4 : STAPNR[v.t] || 4;
  let h = `<div class="fam"><h1>${esc(f.naam)}</h1><span>${esc(f.lev)} · ${esc(f.kl)} · ${f.cs.length} ${f.cs.length === 1 ? 'product' : 'producten'}</span></div>
  <div class="stappen">${['Soort', 'Gewicht', 'Hoeveelheid'].map((n, k) => `<button type="button" class="stap ${stp === k + 1 ? 'nu' : stp > k + 1 ? 'af' : ''}" data-stap="${k + 1}">${k + 1} ${n}</button>`).join('')}</div>`;
  const waar = 'Familie ' + (fi + 1) + ' van ' + S.fams.length + ' · nog ' + telVragen(S.i) + ' vragen';
  const pct = Math.round(S.i / S.pad.length * 100);
  if(S.prod){ S.el.innerHTML = `<div class="dl">${kopHtml(waar, pct)}<main>${prodHtml(S.prod)}</main>${onderHtml({ t:'prod' })}</div>`; return; }
  if(v.t === 'klaar'){ S.el.innerHTML = `<div class="dl">${kopHtml(waar, pct)}<main>${h}${klaarHtml(f)}</main>${onderHtml(v)}</div>`; return; }
  const rijen = rijenVoor(v), [vr, why] = tekst(v, rijen);
  h += `<p class="vraag">${esc(vr)}</p><p class="waarom">${why}</p>`;
  if(!S.sel || S.sel.v !== v) S.sel = { v, on:new Set(rijen) };
  if(['soort', 'gewicht', 'maat'].includes(v.t)){
    const opts = opties(v, f), gek = [...S.sel.on].map(c => waarde(v, c));
    const een = gek.length && gek.every(x => x.v === gek[0].v) ? gek[0].v : null, zelf = gek.length && gek.every(x => x.zelf);
    const eigen = R().EIGEN_MATEN;
    h += `<div class="tip">Selectie is: geldt voor alle aangevinkte producten. Eén product anders? Tik op zijn waarde rechts.</div>
    <div class="chips ${v.t === 'maat' ? 'maten' : ''}">${opts.map(([k, t], n) => `<button type="button" class="chip ${een === k ? (zelf ? 'on' : 'voor') : ''} ${v.t === 'maat' && eigen.includes(k) && !R().OPSLAG_MATEN.includes(k) ? 'eigen' : ''}" data-keus="${esc(k)}">${esc(t)}${v.t !== 'maat' ? `<kbd>${n + 1}</kbd>` : ''}</button>`).join('')}
    ${v.t === 'maat' ? (S.nieuweMaat ? `<span class="chip on nieuw"><input id="dl-nieuwemaat" inputmode="text" placeholder="bijv. 120 x 210" aria-label="nieuwe palletmaat"><button type="button" id="dl-maatok">Bewaar</button></span>` : `<button type="button" class="chip" id="dl-maatnieuw">+ Nieuwe maat</button>`) : ''}</div>`;
    if(v.t === 'soort' && [...S.sel.on].some(c => waarde(v, c).v === 'weg')){
      const wegC = [...S.sel.on].filter(c => waarde(v, c).v === 'weg');
      h += `<div class="tip"><b>Weg, welke?</b></div><div class="sub">${WEG.map(([k, t]) => `<button type="button" class="chip ${wegC.every(c => A(c).weg === k) ? 'on' : wegC.every(c => wegVan(c) === k) ? 'voor' : ''}" data-weg="${k}">${t}</button>`).join('')}</div>`;
    }
  }
  h += `<div class="lijst">${rijen.map(c => rijHtml(v, c)).join('')}</div>`;
  if(S.melding) h += `<div class="melding" role="alert">${esc(S.melding)}</div>`;
  const vc = S.vergC && rijen.includes(S.vergC) ? S.vergC : rijen.length === 1 ? rijen[0] : null;
  if(vc) h += vergHtml(vc, v.t);
  const nk = f.fk + '|' + v.t;
  h += `<div class="notitie">${S.notities[nk] != null ? `<textarea id="dl-not" placeholder="Jouw opmerking of regel bij deze vraag">${esc(S.notities[nk])}</textarea>` : `<button type="button" id="dl-notknop">+ Opmerking of eigen regel</button>`}</div>`;
  S.el.innerHTML = `<div class="dl">${kopHtml(waar, pct)}<main>${h}</main>${onderHtml(v)}</div>`;
  if(S.nieuweMaat){ const x = document.getElementById('dl-nieuwemaat'); if(x) x.focus(); }
}
const kopHtml = (waar, pct) => `<div class="kop"><div class="kop-in"><b>Doorloop</b><span class="waar" id="dl-waar">${esc(waar)}</span><button type="button" class="kopknop" id="dl-zoekknop" aria-label="Zoeken">🔍</button><a href="#/todo">Stoppen</a></div>${S.gast ? '<div class="kop-in" style="margin-top:8px"><button type="button" class="kopknop" id="dl-terugmain">← Terug naar waar ik was</button></div>' : ''}<div class="balk"><i style="width:${pct}%"></i></div></div>`;
function onderHtml(v){
  const laatste = S.i >= S.pad.length - 1;
  return `<div class="onder"><div class="onder-in"><button class="knop" id="dl-terug" type="button"${!S.prod && !S.zoek && !heeftTerug() ? ' disabled' : ''} aria-label="Terug">←</button>${v.t !== 'klaar' && v.t !== 'prod' ? '<button class="knop" id="dl-later" type="button">Later</button>' : ''}<button class="knop hoofd" id="dl-klopt" type="button">${v.t === 'klaar' ? (laatste ? 'Klaar' : 'Volgende familie →') : 'Klopt →'}</button></div></div>`;
}
function rijHtml(v, c){
  const P = R(), a = A(c), w = waarde(v, c), on = S.sel.on.has(c), keus = ['soort', 'gewicht', 'maat'].includes(v.t);
  let toon, inv = '';
  if(v.t === 'soort') toon = w.v === 'weg' ? 'Weg · ' + (wegVan(c) ? naamWeg(wegVan(c)) : '?') : w.v ? naamSoort(w.v) : 'kies soort';
  else if(v.t === 'gewicht'){ toon = naamGew(w.v) + (w.v !== 'gewogen' && num(a.kg) > 0 ? ' · ' + fmt(a.kg) + ' kg' : ''); if(w.v === 'gewogen') inv = `<span class="waarde zelf kg"><input data-kg="${esc(c)}" inputmode="decimal" value="${fmt(a.kg || P.gewicht(c).kg)}" placeholder="kg" aria-label="gewogen kg ${esc(c)}"><small>kg</small></span>`; }
  else if(v.t === 'maat') toon = w.v || 'kies maat';
  else { toon = w.v == null ? '' : fmt(w.v) + (v.t === 'hoogte' ? ' cm' : v.t === 'rl' ? ' m' : '');
    if(w.v == null) inv = `<span class="waarde leeg"><input data-num="${esc(c)}" inputmode="${v.t === 'rl' ? 'decimal' : 'numeric'}" placeholder="typ" aria-label="${esc(c)}"></span>`; }
  const attr = keus ? `data-kies="${esc(c)}"` : `data-tik="${esc(c)}"`;
  const wHtml = inv && v.t !== 'gewicht' ? inv : `<span class="waarde ${w.zelf ? 'zelf' : ''} ${!w.v ? 'leeg' : ''}" ${attr} tabindex="0" role="button">${esc(toon)}${keus ? ' ▾' : ''}</span>${inv}`;
  const opts = opties(v, v.f);
  const uit = keus && S.openRij === c ? `<span class="rijkeus">${opts.map(([k, t]) => `<button type="button" class="chip ${w.v === k ? (w.zelf ? 'on' : 'voor') : ''}" data-rijkeus="${esc(c)}|${esc(k)}">${esc(t)}</button>`).join('')}${v.t === 'soort' && w.v === 'weg' ? WEG.map(([k, t]) => `<button type="button" class="chip ${a.weg === k ? 'on' : ''}" data-rijweg="${esc(c)}|${k}">Weg · ${t}</button>`).join('') : ''}</span>` : '';
  return `<label class="rij ${on ? '' : 'uit'}"><input type="checkbox" data-sel="${esc(c)}" ${on ? 'checked' : ''} aria-label="${esc(c)} meenemen">
   <span class="nm"><b>${esc(P.naamVan(c))}</b><code>${esc(c)}</code><span class="feit">${esc(feiten(v, c))}</span>${afwHtml(c)}</span>
   <span class="rechts">${wHtml}</span>${uit}</label>`;
}
// overzicht na de familie: live uit productdata, per product wat vastligt en wat nog open is, en Daans opmerkingen
function klaarHtml(f){
  const P = R();
  const r = f.cs.map(c => {
    const s = st(c), I = P.info(c), d = [], open = [];
    const so = P.soortWaarde(c, I);
    if(s.stap.soort) d.push(naamSoort(so.v) + (so.v === 'weg' ? ' · ' + naamWeg(P.wegWaarde(c, I).v) : '')); else open.push('soort');
    if(so.v !== 'weg' && s.stap.soort){
      const g = P.gewicht(c);
      if(!P.isSam(c)){ if(s.stap.gewicht) d.push('gewicht ' + naamGew(g.st).toLowerCase() + (g.st === 'gewogen' && g.kg ? ' ' + fmt(g.kg) + ' kg' : '')); else open.push('gewicht'); }
      ['spp', 'maat', 'hoogte', 'maxpick', 'rl', 'rmax'].forEach(k => { const w = P.waarde(c, k, I); if(s.open.includes(k)) open.push(NAAM[k]); else if(OK.includes(w.st) && w.v) d.push(NAAM[k] + ' ' + w.v + (k === 'hoogte' ? ' cm' : '')); });
      const vp = volPallet(c); if(vp && !/na wegen/.test(vp)) d.push(vp);
    }
    return `<li><button type="button" class="prodknop" data-prod="${esc(c)}"><b>${esc(c)}</b> ${esc(d.join(' · ') || '–')}${open.length ? ` <span class="open">· nog open: ${esc(open.join(', '))}</span>` : ''} <span class="tip">· tik om aan te passen</span></button>${afwHtml(c)}</li>`;
  }).join('');
  const nots = Object.entries(S.notities).filter(([k, t]) => k.startsWith(f.fk + '|') && String(t || '').trim()).map(([, t]) => `<li>${esc(t)}</li>`).join('');
  const volgende = S.fams[S.fams.indexOf(f) + 1];
  return `<div class="klaar"><h2>${esc(f.naam)}</h2><ul class="prodlijst">${r}</ul>${nots ? `<div class="tip"><b>Jouw opmerkingen</b></div><ul>${nots}</ul>` : ''}
  <div class="tip">${volgende ? 'Volgende: ' + esc(volgende.naam) + ' (' + esc(volgende.kl) + ')' : 'Dit was de laatste familie.'}</div></div>`;
}

/* ---------- antwoorden in het scherm (nog niet opgeslagen tot Klopt) ---------- */
function kiesSoort(c, k){ const a = A(c); a.soort = k; delete a.later.soort; if(k !== 'weg') delete a.weg; }
function kiesGewicht(c, k){ const a = A(c); a.gst = k; delete a.later.gewicht; if(k !== 'gewogen') delete a.kg; }
function zetVeld(t, c, val){ const a = A(c); (a.f = a.f || {})[t] = String(val); delete a.later[t]; }
async function bewaarNieuweMaat(){
  const inp = document.getElementById('dl-nieuwemaat'); if(!inp) return;
  const m = R().maatSleutel(inp.value);
  if(!m){ S.melding = 'Typ de maat als lengte x breedte in cm, bijv. 120x210.'; teken(); return; }
  try{ await R().voegMaatToe(m); }catch(e){ S.melding = 'Bewaren van de maat lukte niet: ' + (e.message || e); teken(); return; }
  if(S.prod) zetVeld('maat', S.prod, m); else S.sel.on.forEach(c => zetVeld('maat', c, m)); S.nieuweMaat = false; S.melding = ''; teken();
  WH.toast('Maat ' + m + ' bewaard: staat nu overal in de lijst', 3000);
}
function zetGetal(v, c, raw){
  const x = String(raw).trim().replace(',', '.'); if(x === ''){ teken(); return; }
  if(isNaN(+x) || +x <= 0){ S.melding = 'Typ een getal.'; teken(); return; }
  if(HEEL.includes(v.t) && !Number.isInteger(+x)){ S.melding = 'Geen decimalen in aantallen: typ een heel getal (' + c + ').'; teken(); return; }
  zetVeld(v.t, c, v.t === 'hoogte' ? Math.ceil(+x / 10) * 10 : +x); S.melding = ''; teken();
}
function bewerk(v, el){
  const c = el.dataset.tik, w = waarde(v, c);
  el.innerHTML = `<input inputmode="${v.t === 'rl' ? 'decimal' : 'numeric'}" value="${fmt(w.v)}" aria-label="waarde ${esc(c)}">`;
  const inp = el.querySelector('input'); inp.focus(); inp.select();
  inp.addEventListener('blur', () => zetGetal(v, c, inp.value), { once:true });
}

/* ---------- controle vóór Klopt ---------- */
function controle(v){ return controleRijen(v.t, rijenVoor(v).filter(c => S.sel.on.has(c))); }
function controleRijen(t, rijen){
  const v = { t };
  if(v.t === 'soort'){
    const g = rijen.filter(c => !waarde(v, c).v); if(g.length) return 'Kies een soort bij ' + g.join(', ') + ', of vink uit en tik Later.';
    const w = rijen.filter(c => waarde(v, c).v === 'weg' && !A(c).weg); if(w.length) return 'Kies bij Weg: Uitlopend, Backorder of Archief (' + w.join(', ') + ').';
  }
  if(v.t === 'gewicht'){ const g = rijen.filter(c => waarde(v, c).v === 'gewogen' && !(num(A(c).kg) > 0 || (R().gewicht(c).st === 'gewogen' && R().gewicht(c).kg > 0))); if(g.length) return 'Gewogen: typ de kg bij ' + g.join(', ') + ', of kies Te wegen.'; }
  if(GETAL.includes(v.t) || v.t === 'maat'){
    const leeg = rijen.filter(c => waarde(v, c).v == null); if(leeg.length) return (v.t === 'maat' ? 'Kies een maat' : 'Typ een getal') + ' bij ' + leeg.join(', ') + ', of vink uit en tik Later.';
    if(HEEL.includes(v.t)){ const d = rijen.filter(c => !Number.isInteger(num(waarde(v, c).v))); if(d.length) return 'Geen decimalen in aantallen: ' + d.join(', ') + '.'; }
  }
  return '';
}

/* ---------- opslaan: zelfde opslag en bron als Productdata 2.0 (PD2R.poZet → productdata, bron pd2, kopie vooraf) ---------- */
function bewaar(v, c){
  const P = R(), I = P.info(c), w = waarde(v, c), t = new Date().toISOString();
  if(v.t === 'soort'){
    const so = w.v, nu = P.soortWaarde(c, I), voor = nu.st === 'vastgelegd' ? nu.v : I.vsSo ? I.vsSo.v : '';
    const weg = so === 'weg' ? A(c).weg : '', vw = I.vsWeg;
    P.poZet(c, p => { delete p.heropend; p.so = { v:so, st:voor === so ? 'bevestigd' : 'aangepast', voor, t };
      if(so === 'weg') p.weg = { v:weg, st:vw && vw.v === weg ? 'bevestigd' : 'aangepast', voor:vw ? vw.v : '', t }; else delete p.weg; });
    return;
  }
  if(v.t === 'gewicht'){
    const g = P.gewicht(c), stg = w.v, kg = num(A(c).kg) > 0 && stg !== 'tewegen' ? num(A(c).kg) : g.pq > 0 ? g.pq : null;
    P.poZet(c, p => { delete p.heropend; p.gew = Object.assign({ st:stg, t }, kg ? { kg } : {}); });
    return;
  }
  const vs = I.vs && I.vs[v.t], voor = vs && vs.v !== undefined && vs.v !== '' ? String(vs.v) : '', val = String(w.v);
  P.poZet(c, p => { delete p.heropend; p.f[v.t] = { v:val, st:voor && (voor === val || (v.t === 'hoogte' && String(Math.ceil(num(voor) / 10) * 10) === val)) ? 'bevestigd' : 'aangepast', voor, t }; });
}
// alleen schrijven wat nieuw is of door Daan hier anders is gekozen: een bevestigde waarde die hij niet aanraakte blijft zoals ze is
const wegOpgeslagen = c => { try{ const w = R().wegWaarde(c, R().info(c)); return OK.includes(w.st) ? w.v : ''; }catch(e){ return ''; } };
function verandert(t, c){
  const P = R(), a = A(c), I = P.info(c), w = waarde({ t }, c);
  if(t === 'soort'){ const sw = P.soortWaarde(c, I); if(!OK.includes(sw.st)) return !!w.v; return !!a.soort && (a.soort !== sw.v || (a.soort === 'weg' && !!a.weg && a.weg !== wegOpgeslagen(c))); }
  if(t === 'gewicht'){ const g = P.gewicht(c); if(g.st === 'niet') return true; return (!!a.gst && a.gst !== g.st) || (num(a.kg) > 0 && Math.abs(num(a.kg) - (g.kg || 0)) > 1e-9); }
  const o = P.waarde(c, t, I); if(!OK.includes(o.st)) return w.v != null && w.v !== '';
  return !!(a.f && a.f[t] !== undefined) && String(o.v) !== String(a.f[t]);
}
function bewaarIndien(t, c){ if(verandert(t, c)) bewaar({ t }, c); }
function volgende(){ S.melding = ''; S.sel = null; S.openRij = null; S.nieuweMaat = false; if(S.i < S.pad.length - 1){ S.i++; sla(1); } else S.klaar = true; teken(); if(S.el) S.el.scrollTop = 0; const nat = document.getElementById('native'); if(nat) nat.scrollTop = 0; }
function reset(){ S.melding = ''; S.sel = null; S.openRij = null; S.nieuweMaat = false; S.vergC = null; }
function klopt(){
  const v = S.pad[S.i]; if(!v) return;
  if(S.prod){ prodKlopt(); return; }
  if(v.t !== 'klaar'){
    const fout = controle(v); if(fout){ S.melding = fout; teken(); return; }
    const mee = rijenVoor(v).filter(c => S.sel.on.has(c));
    // uitgevinkt + Klopt = Later (bewaard, telt niet mee); wat nu wel is ingevuld gaat van de Later-lijst
    const uit = rijenVoor(v).filter(c => !S.sel.on.has(c));
    if(LT() && uit.length) LT().zet(uit.map(c => ({ c, t:v.t, opm:laterOpm(c, v.t) })));
    if(LT() && mee.some(c => lat(c, v.t))) LT().zet(mee.filter(c => lat(c, v.t)).map(c => ({ c, t:v.t, weg:true })));
    mee.filter(c => verandert(v.t, c)).forEach(c => bewaar(v, c));
    if(mee.length){ try{ R().flush && R().flush(); }catch(e){} }
    // latere vragen van deze familie opnieuw bepalen (soort kan net veranderd zijn)
    S.pad.forEach(x => { if(x.f === v.f && x !== v && !x.alle && !x.laterlijst && S.pad.indexOf(x) > S.i) delete x.rows; });
  }
  na();
}
// na Klopt of Later: na een sprong (stap-knop, overzicht) eerst de rest van die stap, dan terug naar waar Daan was; anders de volgende vraag
function na(){
  const v = S.pad[S.i];
  if(S.terugNaar != null && v){
    const grp = STAPNR[v.t];
    for(let j = S.i + 1; j < S.pad.length && S.pad[j].f === v.f && S.pad[j].t !== 'klaar'; j++){
      if(grp && STAPNR[S.pad[j].t] === grp){ S.pad[j].alle = true; if(rijenVoor(S.pad[j]).length){ S.i = j; reset(); teken(); return; } }
    }
    S.i = S.terugNaar; S.terugNaar = null; S.klaar = false; reset(); teken(); return;
  }
  volgende();
}
function later(){
  const v = S.pad[S.i]; if(!v || v.t === 'klaar' || S.prod) return;
  const rij = rijenVoor(v).filter(c => S.sel.on.has(c));
  if(LT() && rij.length) LT().zet(rij.map(c => ({ c, t:v.t, opm:laterOpm(c, v.t) })));   // bewaard in wh-doorloop-later, telt niet meer mee
  na();
}
// ← gaat altijd naar de vorige vraag van de familie, ook als die al beantwoord is (dan met de bevestigde waarden, aan te passen)
function heeftTerug(){
  if(S.klaar) return true;
  for(let j = S.i - 1; j >= 0; j--){ const x = S.pad[j]; if(x.t === 'klaar') return true; const keep = x.alle; x.alle = true; const n = rijenVoor(x).length; x.alle = keep; if(n) return true; }
  return false;
}
function terug(){
  if(S.zoek){ S.zoek = null; teken(); return; }
  if(S.prod){ if(S.prodSnap) S.A[S.prod] = S.prodSnap; S.prod = null; S.prodSnap = null; S.i = S.terugNaar != null ? S.terugNaar : S.i; S.terugNaar = null; reset(); teken(); return; }
  if(S.klaar){ S.klaar = false; S.i = S.pad.length - 1; reset(); teken(); return; }
  for(let j = S.i - 1; j >= 0; j--){
    const x = S.pad[j];
    if(x.t === 'klaar'){ S.i = j; reset(); teken(); return; }
    x.alle = true;
    if(rijenVoor(x).length){ S.i = j; S.terugNaar = null; reset(); teken(); return; }
  }
}
function springStap(n){
  const v = S.pad[S.i]; if(!v) return;
  const ts = n === 1 ? ['soort'] : n === 2 ? ['gewicht'] : ['spp', 'maat', 'hoogte', 'maxpick', 'rl', 'rmax'];
  for(let j = S.pad.findIndex(x => x.f === v.f); j < S.pad.length && S.pad[j].f === v.f; j++){
    const x = S.pad[j]; if(!ts.includes(x.t)) continue;
    x.alle = true;
    if(rijenVoor(x).length){ if(S.terugNaar == null) S.terugNaar = S.i; S.i = j; S.prod = null; reset(); teken(); return; }
  }
  WH.toast('Geen vragen voor deze stap bij deze producten', 3000);
}

/* ---------- controle: waarden die niet bij de familie passen (alleen melden, nooit zelf wijzigen) ---------- */
const fam = c => { try{ return window.WHPD.index().fam[R().famVan(c)] || []; }catch(e){ return []; } };
const bruikbaar = c => { try{ return R().actief(c) && !R().isKoppel(c); }catch(e){ return false; } };
const mediaan = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };
const fmtKg = x => fmt(Math.round(x * 100) / 100);
const korteCode = c => { const d = String(c).split('-'); return d.length >= 3 ? d.slice(0, -1).join('-') : c; };
function effStg(c){ return A(c).gst || R().gewicht(c).st; }
function effKg(c){ const a = A(c), g = R().gewicht(c); if(num(a.kg) > 0) return num(a.kg); if(effStg(c) === 'gewogen') return g.st === 'gewogen' ? g.kg : null; return g.kg > 0 && g.st !== 'niet' ? g.kg : g.pq > 0 ? g.pq : g.kg > 0 ? g.kg : null; }
function effVal(c, t){ const a = A(c); if(a.f && a.f[t] !== undefined) return a.f[t]; const w = R().waarde(c, t, R().info(c)); return w.v === '' || w.v === undefined ? null : (t === 'hoogte' && num(w.v) ? Math.ceil(num(w.v) / 10) * 10 : w.v); }
function volleCalc(c){ if(!PAL.includes(soortNu(c))) return null; const kg = effKg(c), spp = num(effVal(c, 'spp')); return kg > 0 && spp > 0 ? Math.ceil(kg * spp + 15) : null; }
// alleen een pick- of bulklocatie van dit product op een 20-locatie in hal A (A.. + sectie + plaats + 20) geeft een hoogtemelding
function halA20(c){
  try{ const f = R().locInfo(c), l = (f.pick || []).concat(f.bulk || []).map(x => x.n || x[0]).find(n => /^A[A-Z]\d{2}[A-D]20$/i.test(String(n || '').trim())); return l ? String(l).trim() : ''; }catch(e){ return ''; }
}
function afwijkLijn(c){
  const P = R();
  try{
    if(P.isSam(c)) return null;
    const so = soortNu(c); if(!so || so === 'weg') return null;
    const kg = effKg(c), delen = [], leden = fam(c).filter(x => x !== c && bruikbaar(x) && !P.isSam(x));
    const metKg = leden.map(x => ({ c:x, kg:effKg(x) })).filter(x => x.kg > 0);
    if(kg > 0 && metKg.length){
      const m = mediaan(metKg.map(x => x.kg)), dicht = metKg.slice().sort((x, y) => Math.abs(x.kg - m) - Math.abs(y.kg - m))[0];
      if(kg / m > 3 || kg / m < 1 / 3) delen.push(fmtKg(kg) + ' kg per stuk, ' + korteCode(dicht.c) + ' ' + fmtKg(dicht.kg) + ' kg');
      else { const mk = P.maatVan(c); if(mk){ const kl = metKg.filter(x => P.maatVan(x.c) === mk); if(kl.length >= 2){ const m2 = mediaan(kl.map(x => x.kg)); if(Math.abs(kg - m2) / m2 > 0.25) delen.push(fmtKg(kg) + ' kg per stuk, kleurgenoten ' + fmtKg(m2) + ' kg'); } } }
    }
    const vp = volleCalc(c), spp = num(effVal(c, 'spp'));
    if(vp && spp){ const gl = leden.filter(x => PAL.includes(soortNu(x)) && num(effVal(x, 'spp')) === spp).map(volleCalc).filter(Boolean); if(gl.length){ const m = mediaan(gl); if(vp / m > 2 || vp / m < 0.5) delen.push('volle pallet ' + nf(vp) + ' tegen ' + nf(Math.round(m)) + ' kg'); } }
    if(vp && (vp < 50 || vp > 1500)) delen.push('volle pallet ' + nf(vp) + ' kg is ' + (vp < 50 ? 'onder 50' : 'boven 1500') + ' kg');
    const h = num(effVal(c, 'hoogte')); if(h > 140 && PAL.includes(so)){ const loc = halA20(c); if(loc) delen.push('hoogte ' + h + ' cm is hoger dan 140 cm en het product staat op ' + loc + ' (20-locatie in hal A)'); }
    const mp = num(effVal(c, 'maxpick')); if(mp > 0 && spp > 0 && ['pallet', 'deel'].includes(so) && mp > spp) delen.push('max op pick ' + nf(mp) + ' is groter dan ' + nf(spp) + ' per pallet');
    if(!delen.length) return null;
    const tekst = c + ': ' + delen.join('; ') + '. Klopt dat?';
    return { c, tekst, key:c + '|' + tekst };
  }catch(e){ return null; }
}
function afwHtml(c, zonderAanpassen){
  const l = afwijkLijn(c); if(!l || S.akk.has(l.key)) return '';
  return `<div class="afw" role="note"><span>⚠ ${esc(l.tekst)}</span><span class="afwk"><button type="button" class="chip" data-akkoord="${esc(c)}">Klopt</button>${zonderAanpassen ? '' : `<button type="button" class="chip" data-aanpas="${esc(c)}">Aanpassen</button>`}</span></div>`;
}
function bewaarAkkoord(c){
  const l = afwijkLijn(c); if(!l) return;
  S.akk.add(l.key);
  try{ R().fbOpm({ bron:'doorloop-akkoord', key:l.key, tekst:l.tekst }); }catch(e){ console.error(e); }
}

/* ---------- vergelijkbare producten: kleurgenoten → zelfde familie andere maat → zelfde leverancier en hoofdwoord (nooit SAM, nooit "meerderheid bij de leverancier") ---------- */
let HW = null;
const hoofdwoord = c => { const w = String(R().naamVan(c)).toLowerCase().replace(/[^a-zà-ÿ\s]/g, ' ').split(/\s+/).filter(x => x.length >= 4 && !['rubber', 'mat', 'matten', 'set', 'voor', 'met', 'zwart', 'wit', 'bruin'].includes(x))[0]; return w || ''; };
function hwIndex(){
  if(HW) return HW; HW = {};
  Object.keys(WH.D.P).forEach(c => { if(!bruikbaar(c) || R().isSam(c)) return; const w = hoofdwoord(c); if(!w) return; const k = String((WH.D.P[c] || {}).leverancier || '') + '|' + w; (HW[k] = HW[k] || []).push(c); });
  return HW;
}
function veldVan(c, t){
  const P = R(), w = waarde({ t }, c);
  if(t === 'soort') return { v:w.v, zelf:w.zelf, weg:w.v === 'weg' ? wegVan(c) : '' };
  if(t === 'gewicht'){ const g = P.gewicht(c); return { v:w.v, zelf:w.zelf, kg:w.v === 'gewogen' ? (g.kg || null) : g.pq || null }; }
  return { v:w.v, zelf:w.zelf };
}
const basisNaam = c => { const d = String(R().naamVan(c)).toLowerCase().split(' - '); return (d.length >= 2 ? d.slice(0, -1) : d).join(' - ').trim(); };
const zelfdeMaat = (a, b) => { const P = R(), ma = P.maatVan(a); return ma === P.maatVan(b) && (ma !== '' || basisNaam(a) === basisNaam(b)); };
function vergelijkbaar(c, t){
  const P = R(); if(P.isSam(c)) return [];
  const uit = [], zie = new Set([c]), voeg = l => l.forEach(x => { if(uit.length < 5 && !zie.has(x)){ zie.add(x); uit.push(x); } });
  const leden = fam(c).filter(x => x !== c && bruikbaar(x) && !P.isSam(x));
  voeg(leden.filter(x => zelfdeMaat(x, c)));
  voeg(leden.filter(x => !zelfdeMaat(x, c)));
  if(uit.length < 5){ const w = hoofdwoord(c); if(w) voeg((hwIndex()[String((WH.D.P[c] || {}).leverancier || '') + '|' + w] || []).filter(x => x !== c && !P.isSam(x))); }
  return uit.map(x => Object.assign({ c:x, naam:P.naamVan(x) }, veldVan(x, t))).filter(x => x.v !== null && x.v !== undefined && x.v !== '');
}
const toonVeld = (t, x) => t === 'soort' ? (x.v === 'weg' ? 'Weg · ' + naamWeg(x.weg) : naamSoort(x.v)) : t === 'gewicht' ? naamGew(x.v) + (x.kg ? ' · ' + fmtKg(x.kg) + ' kg' : '') : fmt(x.v) + (t === 'hoogte' ? ' cm' : t === 'rl' ? ' m' : '');
function vergHtml(c, t){
  const l = vergelijkbaar(c, t); if(!l.length) return '';
  return `<div class="verg"><div class="tip"><b>Vergelijkbare producten</b> bij ${esc(c)} · ${esc(NAAM[t])}</div>${l.map(x => `<div class="vrij"><span class="vn"><code>${esc(x.c)}</code> ${esc(x.naam)}</span><span class="vw">${esc(toonVeld(t, x))} · ${x.zelf ? 'bevestigd' : 'voorstel'}</span><button type="button" class="chip" data-over="${esc(c)}|${t}|${esc(x.c)}">Neem over</button></div>`).join('')}</div>`;
}
// "Neem over": de waarde van het vergelijkbare product wordt bij dit product gezet (zwart, pas definitief na Klopt)
function neemOver(c, t, x){
  const o = veldVan(x, t); if(o.v === null || o.v === undefined || o.v === ''){ WH.toast('Dat product heeft hier nog geen waarde', 3000); return; }
  if(t === 'soort'){ kiesSoort(c, o.v); if(o.v === 'weg' && o.weg) A(c).weg = o.weg; }
  else if(t === 'gewicht'){ kiesGewicht(c, o.v); if(o.v !== 'tewegen' && o.kg > 0 && Math.abs(o.kg - (R().gewicht(c).pq || 0)) > 1e-9) A(c).kg = o.kg; }
  else zetVeld(t, c, t === 'hoogte' ? Math.ceil(num(o.v) / 10) * 10 : o.v);
  if(S.sel && S.sel.on) S.sel.on.add(c);
  teken();
}

/* ---------- één product: alle velden die bij zijn soort horen (vanuit het overzicht of een afwijking) ---------- */
function veldenVan(c){
  const P = R(), so = soortNu(c), l = ['soort'];
  if(so && so !== 'weg'){ if(!P.isSam(c)) l.push('gewicht'); try{ const n = P.nodigVan(c, so, P.info(c)); VRAGEN.forEach(k => { if(k !== 'soort' && k !== 'gewicht' && n.includes(k)) l.push(k); }); }catch(e){} }
  return l;
}
function openProd(c){ S.terugNaar = S.terugNaar != null && S.prod ? S.terugNaar : S.i; S.prodSnap = JSON.parse(JSON.stringify(A(c))); S.prod = c; S.vergT = null; reset(); teken(); const nat = document.getElementById('native'); if(nat) nat.scrollTop = 0; }
function prodHtml(c){
  const P = R(), f = S.pad[S.i].f, vtekst = { soort:'Welke soort?', gewicht:'Klopt het gewicht per stuk uit Picqer?', spp:'Hoeveel stuks per pallet?', maat:'Welke palletmaat?', hoogte:'Hoe hoog is een volle pallet, incl. pallet?', maxpick:'Max op pick?', rl:'Lengte volle rol (m)?', rmax:'Max rollen per pallet?' };
  let h = `<div class="fam"><h1>${esc(P.naamVan(c))}</h1><span>${esc(c)} · ${esc(f.naam)}</span></div>${afwHtml(c, true)}`;
  h += '<div class="veldengrid">';
  veldenVan(c).forEach(t => {
    const v = { t, f }, w = waarde(v, c), a = A(c);
    let ctrl = '';
    if(['soort', 'gewicht', 'maat'].includes(t)){
      const opts = t === 'maat' ? P.matenVoor(c).map(m => [m, m]) : t === 'soort' ? SOORTEN : GEWST;
      ctrl = `<div class="chips ${t === 'maat' ? 'maten' : ''}">${opts.map(([k, tx]) => `<button type="button" class="chip ${w.v === k ? (w.zelf ? 'on' : 'voor') : ''}" data-pk="${t}|${esc(k)}">${esc(tx)}</button>`).join('')}${t === 'maat' ? (S.nieuweMaat ? `<span class="chip on nieuw"><input id="dl-nieuwemaat" inputmode="text" placeholder="bijv. 120 x 210" aria-label="nieuwe palletmaat"><button type="button" id="dl-maatok">Bewaar</button></span>` : `<button type="button" class="chip" id="dl-maatnieuw">+ Nieuwe maat</button>`) : ''}</div>`;
      if(t === 'soort' && w.v === 'weg') ctrl += `<div class="sub">${WEG.map(([k, tx]) => `<button type="button" class="chip ${wegVan(c) === k ? 'on' : ''}" data-pweg="${k}">Weg · ${tx}</button>`).join('')}</div>`;
      if(t === 'gewicht'){ ctrl += `<div class="tip">Picqer ${P.gewicht(c).pq > 0 ? fmt(P.gewicht(c).pq) + ' kg' : 'heeft geen gewicht'}</div>`; if(w.v === 'gewogen') ctrl += `<span class="waarde zelf kg"><input data-kg="${esc(c)}" inputmode="decimal" value="${fmt(a.kg || P.gewicht(c).kg)}" placeholder="kg" aria-label="gewogen kg"><small>kg</small></span>`; }
    } else ctrl = `<span class="waarde ${w.zelf ? 'zelf' : ''} ${w.v == null ? 'leeg' : ''}"><input data-num="${esc(c)}" data-t="${t}" inputmode="${t === 'rl' ? 'decimal' : 'numeric'}" value="${esc(fmt(w.v))}" placeholder="typ" aria-label="${esc(NAAM[t])}">${t === 'hoogte' ? ' cm' : t === 'rl' ? ' m' : ''}</span>`;
    h += `<div class="veld"><p class="vraag" style="font-size:1.125rem">${esc(vtekst[t])}</p>${ctrl}<button type="button" class="chip kleinchip" data-vergt="${t}">Vergelijkbare producten ${S.vergT === t ? '▴' : '▾'}</button>${S.vergT === t ? vergHtml(c, t) : ''}</div>`;
  });
  h += '</div>';
  const vp = volPallet(c); if(vp) h += `<div class="tip"><b>${esc(vp)}</b></div>`;
  if(S.melding) h += `<div class="melding" role="alert">${esc(S.melding)}</div>`;
  return h;
}
function prodKlopt(){
  const c = S.prod, ts = veldenVan(c);
  for(const t of ts){ const fout = controleRijen(t, [c]); if(fout){ S.melding = fout; teken(); return; } }
  ts.forEach(t => bewaarIndien(t, c));
  try{ R().flush && R().flush(); }catch(e){}
  S.prod = null; S.prodSnap = null; S.i = S.terugNaar != null ? S.terugNaar : S.i; S.terugNaar = null; reset(); teken();
}

/* ---------- zoeken: elk product (ook beantwoord), de familie opent in de Doorloop met alle vragen ---------- */
function zoekHtml(){
  return `<div class="dl">${kopHtml('Zoeken', 0)}<main><p class="vraag">Zoek een product of familie</p><input id="dl-zoekin" class="zoekin" type="search" placeholder="code, naam of familie" value="${esc(S.zoek.q)}" autocomplete="off" aria-label="Zoeken"><div id="dl-zoekres">${zoekRes(S.zoek.q)}</div></main>
  <div class="onder"><div class="onder-in"><button class="knop hoofd" id="dl-zoeksluit" type="button">Sluiten</button></div></div></div>`;
}
function zoekRes(q){
  q = String(q || '').trim().toLowerCase(); if(q.length < 2) return '<p class="tip">Typ minstens 2 tekens.</p>';
  const P = R(), bel = new Set(P.belangrijk()), res = [];
  for(const c of Object.keys(WH.D.P)){
    if(!bruikbaar(c)) continue;
    const naam = P.naamVan(c); let ok = c.toLowerCase().includes(q) || naam.toLowerCase().includes(q);
    if(!ok){ try{ ok = String(P.famNaam(P.famVan(c))).toLowerCase().includes(q); }catch(e){} }
    if(ok) res.push(c);
  }
  res.sort((a, b) => (bel.has(b) ? 1 : 0) - (bel.has(a) ? 1 : 0) || a.localeCompare(b));
  if(!res.length) return '<p class="tip">Niets gevonden.</p>';
  return `<div class="lijst">${res.slice(0, 40).map(c => { let klaar = ''; try{ klaar = st(c).af ? 'klaar' : 'nog open'; }catch(e){} return `<button type="button" class="prodknop zoekrij" data-gast="${esc(c)}"><b>${esc(P.naamVan(c))}</b><br><code>${esc(c)}</code> · ${esc(P.famNaam(P.famVan(c)))} · ${klaar}${bel.has(c) ? '' : ' · niet belangrijk'}${P.isSam(c) ? ' · SAM Europe' : ''}</button>`; }).join('')}</div>${res.length > 40 ? `<p class="tip">${nf(res.length - 40)} meer: typ iets specifiekers.</p>` : ''}`;
}
function openGast(c){
  const P = R(), fk = P.famVan(c), bel = new Set(P.belangrijk());
  let cs = P.isSam(c) ? [c] : fam(c).filter(x => bruikbaar(x) && !P.isSam(x) && (bel.has(x) || x === c));
  if(!cs.includes(c)) cs.push(c);
  cs.sort((a, b) => rang(P.abcVan(a)) - rang(P.abcVan(b)) || P.naamVan(a).localeCompare(P.naamVan(b), 'nl', { numeric:true }) || a.localeCompare(b));
  const kl = ['A', 'B', 'C'].find(k => cs.some(x => P.abcVan(x) === k)) || '–';
  const f = { fk, naam:P.famNaam(fk), lev:String((WH.D.P[c] || {}).leverancier || ''), kl, cs };
  if(!S.main) S.main = { pad:S.pad, fams:S.fams, i:S.i, klaar:S.klaar, terugNaar:S.terugNaar };
  S.fams = [f]; S.pad = []; VRAGEN.forEach(t => S.pad.push({ t, f, alle:true })); S.pad.push({ t:'klaar', f });
  S.i = 0; S.gast = true; S.zoek = null; S.prod = null; S.terugNaar = null; S.klaar = false; reset(); sla(1); teken();
}
function terugMain(){
  if(!S.main) return;
  const m = S.main; S.main = null; S.gast = false; S.fams = m.fams; S.pad = m.pad; S.i = m.i; S.klaar = m.klaar; S.terugNaar = m.terugNaar; S.prod = null; S.zoek = null; reset(); teken();
}

/* ---------- opmerkingen: bewaard bij de familie (wh-pd2-feedback, bron doorloop) ---------- */
function laadNotities(){
  S.notities = {}; S.notId = {};
  try{ S.akk = new Set((R().S.fb.opm || []).filter(o => o && o.bron === 'doorloop-akkoord' && o.key).map(o => o.key)); }catch(e){ S.akk = new Set(); }
  try{ (R().S.fb.opm || []).filter(o => o && o.bron === 'doorloop' && o.fam).forEach(o => { const k = o.fam + '|' + o.vraag; S.notities[k] = o.tekst; S.notId[k] = o.id; }); }catch(e){}
}
function bewaarNotitie(k, tekst){
  const [fam, vraag] = k.split('|'); S.notities[k] = tekst;
  try{ if(S.notId[k]) R().fbOpmWeg(S.notId[k]); if(String(tekst).trim()){ R().fbOpm({ bron:'doorloop', fam, vraag, tekst:String(tekst) }); const l = R().S.fb.opm; S.notId[k] = l[l.length - 1].id; } else delete S.notId[k]; }catch(e){ console.error(e); }
}

/* ---------- gebeurtenissen ---------- */
let gekoppeld = false;
function koppel(){
  if(gekoppeld) return; gekoppeld = true;
  document.addEventListener('click', e => {
    if(!mag()) return;
    if(!e.target.closest || !e.target.closest('.dl')) return;
    if(e.target.closest('#dl-zoekknop')){ S.zoek = { q:'' }; teken(); return; }
    if(e.target.closest('#dl-zoeksluit')){ S.zoek = null; teken(); return; }
    if(e.target.closest('#dl-terugmain')){ terugMain(); return; }
    const gast = e.target.closest('[data-gast]'); if(gast){ openGast(gast.dataset.gast); return; }
    const stap = e.target.closest('[data-stap]'); if(stap){ springStap(+stap.dataset.stap); return; }
    const prodk = e.target.closest('[data-prod]'); if(prodk){ openProd(prodk.dataset.prod); return; }
    const akk = e.target.closest('[data-akkoord]'); if(akk){ bewaarAkkoord(akk.dataset.akkoord); teken(); return; }
    const aanp = e.target.closest('[data-aanpas]'); if(aanp){ openProd(aanp.dataset.aanpas); return; }
    const over = e.target.closest('[data-over]'); if(over){ const [c, t, x] = over.dataset.over.split('|'); neemOver(c, t, x); return; }
    const vt = e.target.closest('[data-vergt]'); if(vt){ S.vergT = S.vergT === vt.dataset.vergt ? null : vt.dataset.vergt; teken(); return; }
    if(S.prod){
      const pk = e.target.closest('[data-pk],[data-pweg],#dl-maatnieuw,#dl-maatok');
      if(pk){
        if(pk.id === 'dl-maatnieuw'){ S.nieuweMaat = true; teken(); return; }
        if(pk.id === 'dl-maatok'){ e.preventDefault(); bewaarNieuweMaat(); return; }
        S.melding = '';
        if(pk.dataset.pweg){ kiesSoort(S.prod, 'weg'); A(S.prod).weg = pk.dataset.pweg; teken(); return; }
        const i = pk.dataset.pk.indexOf('|'), t = pk.dataset.pk.slice(0, i), k = pk.dataset.pk.slice(i + 1);
        if(t === 'soort') kiesSoort(S.prod, k); else if(t === 'gewicht') kiesGewicht(S.prod, k); else zetVeld(t, S.prod, k);
        teken(); return;
      }
    }
    if(e.target.closest('#dl-klopt')){ klopt(); return; }
    if(e.target.closest('#dl-later')){ later(); return; }
    if(e.target.closest('#dl-terug')){ terug(); return; }
    const v = S.pad[S.i]; if(!v || v.t === 'klaar') return;
    const t = e.target.closest('[data-keus],[data-weg],[data-tik],[data-kies],[data-rijkeus],[data-rijweg],#dl-notknop,#dl-maatnieuw,#dl-maatok');
    if(!t) return;
    if(t.id === 'dl-notknop'){ S.notities[v.f.fk + '|' + v.t] = ''; teken(); const n = document.getElementById('dl-not'); if(n) n.focus(); return; }
    if(t.id === 'dl-maatnieuw'){ S.nieuweMaat = true; teken(); return; }
    if(t.id === 'dl-maatok'){ e.preventDefault(); bewaarNieuweMaat(); return; }
    S.melding = '';
    if(t.dataset.keus){ const k = t.dataset.keus; S.sel.on.forEach(c => { if(v.t === 'soort') kiesSoort(c, k); else if(v.t === 'gewicht') kiesGewicht(c, k); else zetVeld(v.t, c, k); }); teken(); return; }
    if(t.dataset.weg){ S.sel.on.forEach(c => { if(waarde(v, c).v === 'weg'){ kiesSoort(c, 'weg'); A(c).weg = t.dataset.weg; } }); teken(); return; }
    e.preventDefault();
    if(t.dataset.tik){ S.vergC = t.dataset.tik; bewerk(v, t); return; }
    if(t.dataset.kies){ S.vergC = t.dataset.kies; S.openRij = S.openRij === t.dataset.kies ? null : t.dataset.kies; teken(); return; }
    if(t.dataset.rijkeus){ const p = t.dataset.rijkeus.lastIndexOf('|'), c = t.dataset.rijkeus.slice(0, p), k = t.dataset.rijkeus.slice(p + 1);
      if(v.t === 'soort'){ kiesSoort(c, k); if(k === 'weg'){ teken(); return; } } else if(v.t === 'gewicht') kiesGewicht(c, k); else zetVeld(v.t, c, k);
      S.openRij = null; teken(); if(v.t === 'gewicht' && k === 'gewogen'){ const x = document.querySelector(`.dl [data-kg="${CSS.escape(c)}"]`); if(x) x.focus(); } return; }
    if(t.dataset.rijweg){ const p = t.dataset.rijweg.lastIndexOf('|'), c = t.dataset.rijweg.slice(0, p), k = t.dataset.rijweg.slice(p + 1); kiesSoort(c, 'weg'); A(c).weg = k; S.openRij = null; teken(); }
  });
  document.addEventListener('change', e => {
    if(!mag() || !e.target.closest || !e.target.closest('.dl')) return;
    const d = e.target.dataset || {}, v = S.pad[S.i];
    if(d.sel){ if(e.target.checked) S.sel.on.add(d.sel); else S.sel.on.delete(d.sel); teken(); return; }
    if(d.kg){ const x = e.target.value.trim().replace(',', '.'); if(x === '') delete A(d.kg).kg; else if(!isNaN(+x) && +x > 0){ A(d.kg).kg = +x; A(d.kg).gst = 'gewogen'; S.melding = ''; } else S.melding = 'Gewicht moet een getal zijn, bijv. 19,5.'; teken(); return; }
    if(d.num){ zetGetal(d.t ? { t:d.t, f:v.f } : v, d.num, e.target.value); return; }
    if(e.target.id === 'dl-not'){ bewaarNotitie(v.f.fk + '|' + v.t, e.target.value); }
  });
  document.addEventListener('input', e => {
    if(!mag() || !S.zoek || e.target.id !== 'dl-zoekin') return;
    S.zoek.q = e.target.value; const r = document.getElementById('dl-zoekres'); if(r) r.innerHTML = zoekRes(S.zoek.q);
  });
  document.addEventListener('keydown', e => {
    if(!mag()) return;
    if(e.target.id === 'dl-nieuwemaat' && e.key === 'Enter'){ e.preventDefault(); bewaarNieuweMaat(); return; }
    if(e.target.closest && e.target.closest('input,textarea,select')){ if(e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.closest('.dl')){ e.preventDefault(); e.target.blur(); } return; }
    if(e.key === 'Enter' && e.target.dataset && e.target.dataset.tik){ e.preventDefault(); bewerk(S.pad[S.i], e.target); return; }
    if(e.key === 'Enter'){ e.preventDefault(); klopt(); return; }
    const n = +e.key; if(n >= 1 && n <= 6 && S.pad[S.i] && S.pad[S.i].t !== 'maat'){ const b = S.el.querySelectorAll('[data-keus]')[n - 1]; if(b) b.click(); }
  });
}

/* ---------- route: #/doorloop/<soort|gewicht|hoev> ---------- */
async function render(el, rest){
  stijl(); koppel(); S.el = el;
  const eerste = String(rest || '').split('/')[0], stap = STAPVAN[eerste] || '';
  S.laterModus = eerste === 'later';
  if(!R() || !R().S.klaar){
    teken();
    if(window.WHTAAK) await WHTAAK.pdLaden();
    if(window.PD2R && PD2R.laad && !PD2R.S.klaar) await PD2R.laad().catch(e => console.error(e));
    if(S.el !== el || !mag()) return;
  }
  if(window.WHTAAK && WHTAAK.later) await WHTAAK.later.laad();
  try{ WHPD.zetLaterMee(false); }catch(e){}
  if(S.el !== el || !mag()) return;
  const sleutel = (S.laterModus ? 'later' : stap) + '|' + (location.hash || '');
  if(S.sleutel !== sleutel || !S.pad.length){ S.sleutel = sleutel; S.stap = stap; bouw(stap); sla(1); }
  teken();
}
return { render, S, bouw, teken, afwijkLijn, vergelijkbaar, halA20 };
})();
