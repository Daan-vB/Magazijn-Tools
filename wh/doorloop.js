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
const S = { el:null, stap:'', fams:[], pad:[], i:0, A:{}, sel:null, openRij:null, melding:'', nieuweMaat:false, notities:{}, notId:{}, sleutel:'', klaar:false };
const naamSoort = v => (SOORTEN.find(s => s[0] === v) || [0, v || '?'])[1];
const naamWeg = v => (WEG.find(s => s[0] === v) || [0, v || '?'])[1];
const naamGew = v => (GEWST.find(s => s[0] === v) || [0, v || '?'])[1];
const fmt = v => v === null || v === undefined || v === '' ? '' : String(v).replace('.', ',');
const rang = a => a === 'A' ? 0 : a === 'B' ? 1 : 2;
const A = c => S.A[c] = S.A[c] || { later:{} };
const st = c => R().status(c);
const mag = () => { const h = location.hash || ''; return h.startsWith('#/doorloop') && S.el && document.body.contains(S.el); };

/* ---------- stijl (alleen binnen .dl) ---------- */
function stijl(){
  if(document.getElementById('dl-stijl')) return;
  const s = document.createElement('style'); s.id = 'dl-stijl';
  s.textContent = `
.dl{--bg:#EDF0F4;--vlak:#FFFFFF;--inkt:#121820;--stil:#5C6675;--lijn:#D6DCE4;--accent:#EF8A4A;--accent-inkt:#1B1205;--voor:#2350A8;--voor-bg:#EAF0FB;--ok:#2E7D4F;--kop:#121820;--kop-inkt:#F4F6F9;
  background:var(--bg);color:var(--inkt);font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;min-height:100%;display:flex;flex-direction:column}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .dl{--bg:#0F1318;--vlak:#181E26;--inkt:#E9EDF2;--stil:#97A1AE;--lijn:#2A333F;--voor:#8FB0F0;--voor-bg:#1A2740;--ok:#6FC793;--kop:#0A0D11}}
:root[data-theme="dark"] .dl{--bg:#0F1318;--vlak:#181E26;--inkt:#E9EDF2;--stil:#97A1AE;--lijn:#2A333F;--voor:#8FB0F0;--voor-bg:#1A2740;--ok:#6FC793;--kop:#0A0D11}
.dl *{box-sizing:border-box}
.dl .kop{position:sticky;top:0;z-index:5;background:var(--kop);color:var(--kop-inkt);padding:12px 16px}
.dl .kop-in{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:12px}
.dl .kop b{font-size:15px}
.dl .kop .waar{font-size:13px;opacity:.75;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dl .kop a{color:var(--kop-inkt);border:1px solid #ffffff40;border-radius:8px;padding:6px 10px;font:600 13px inherit;text-decoration:none}
.dl .balk{height:4px;background:#ffffff22;max-width:720px;margin:10px auto 0;border-radius:2px;overflow:hidden}
.dl .balk i{display:block;height:100%;background:var(--accent);transition:width .3s}
.dl main{flex:1;width:100%;max-width:720px;margin:0 auto;padding:20px 16px 24px;display:flex;flex-direction:column;gap:16px}
.dl .fam{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
.dl .fam h1{font-size:22px;margin:0;overflow-wrap:anywhere}
.dl .fam span{color:var(--stil);font-size:14px}
.dl .stappen{display:flex;gap:6px;flex-wrap:wrap}
.dl .stap{font-size:13px;font-weight:700;padding:4px 10px;border-radius:999px;border:1px solid var(--lijn);color:var(--stil)}
.dl .stap.nu{background:var(--inkt);color:var(--vlak);border-color:var(--inkt)}
.dl .stap.af{color:var(--ok);border-color:var(--ok)}
.dl .vraag{font-size:24px;font-weight:750;margin:4px 0 0;line-height:1.25}
.dl .waarom{font-size:15px;color:var(--stil);margin:0;overflow-wrap:anywhere}
.dl .waarom b{color:var(--voor);font-weight:600}
.dl .chips{display:flex;flex-wrap:wrap;gap:8px}
.dl .chip{border:1.5px solid var(--lijn);background:var(--vlak);color:var(--inkt);border-radius:10px;padding:10px 14px;font:600 16px inherit;cursor:pointer;min-height:46px}
.dl .chip.voor{border-color:var(--voor);color:var(--voor);background:var(--voor-bg)}
.dl .chip.on{background:var(--inkt);border-color:var(--inkt);color:var(--vlak)}
.dl .chip kbd{font:600 11px ui-monospace,Menlo,monospace;opacity:.5;margin-left:6px}
.dl .sub{display:flex;flex-wrap:wrap;gap:8px;padding-left:4px}
.dl .lijst{background:var(--vlak);border:1px solid var(--lijn);border-radius:14px;overflow:hidden}
.dl .rij{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px 14px;border-top:1px solid var(--lijn)}
.dl .rij:first-child{border-top:0}
.dl .rij.uit{opacity:.45}
.dl .rij input[type=checkbox]{width:22px;height:22px;accent-color:var(--inkt);margin:0}
.dl .rij .nm{min-width:0;overflow-wrap:anywhere}
.dl .rij .nm b{display:block;font-size:15px}
.dl .rij .nm code{font:12px ui-monospace,Menlo,monospace;color:var(--stil)}
.dl .rij .feit{display:block;font-size:12.5px;color:var(--stil)}
.dl .waarde{font:700 17px inherit;font-variant-numeric:tabular-nums;border:1.5px solid var(--voor);background:var(--voor-bg);color:var(--voor);border-radius:10px;padding:8px 12px;min-width:84px;text-align:right;cursor:pointer;display:inline-block}
.dl .waarde.zelf{border-color:var(--inkt);background:var(--vlak);color:var(--inkt)}
.dl .waarde.leeg{border-style:dashed;border-color:var(--stil);background:transparent;color:var(--stil);font-weight:600;font-size:14px}
.dl .waarde input{width:84px;font:700 17px inherit;text-align:right;border:0;background:transparent;color:inherit;outline:none}
.dl .rijkeus{grid-column:2/-1;display:flex;flex-wrap:wrap;gap:8px}
.dl .rijkeus .chip{min-height:40px;padding:8px 12px;font-size:15px}
.dl .chips.maten .chip{min-height:42px;padding:8px 12px;font-size:15px;font-variant-numeric:tabular-nums}
.dl .chip.eigen{border-style:dashed}
.dl .chip.nieuw{display:inline-flex;gap:6px;align-items:center;padding:4px 6px 4px 12px}
.dl .chip.nieuw input{width:120px;border:0;background:transparent;color:inherit;font:inherit;outline:none}
.dl .chip.nieuw button{border:0;border-radius:8px;padding:6px 10px;font:700 14px inherit;background:var(--accent);color:var(--accent-inkt);cursor:pointer}
.dl .rechts{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
.dl .waarde.kg{display:inline-flex;align-items:center;gap:4px}
.dl .waarde.kg input{width:70px}
.dl .waarde.kg small{font-size:13px;opacity:.7}
.dl .melding{border:1.5px solid var(--accent);border-radius:10px;padding:10px 12px;font-size:15px;font-weight:600;overflow-wrap:anywhere}
.dl .klaar .open{color:var(--accent);font-weight:600}
.dl .notitie{display:flex;flex-direction:column;gap:6px}
.dl .notitie button{align-self:flex-start;background:none;border:0;color:var(--stil);font:600 14px inherit;padding:0;cursor:pointer;text-decoration:underline}
.dl .notitie textarea{font:15px inherit;border:1px solid var(--lijn);border-radius:10px;padding:10px;background:var(--vlak);color:var(--inkt);min-height:70px;resize:vertical}
.dl .onder{position:sticky;bottom:0;background:var(--vlak);border-top:1px solid var(--lijn);padding:12px 16px}
.dl .onder-in{max-width:720px;margin:0 auto;display:flex;gap:10px}
.dl .knop{border-radius:12px;padding:14px 16px;font:700 17px inherit;cursor:pointer;border:1.5px solid var(--lijn);background:var(--vlak);color:var(--inkt)}
.dl .knop.hoofd{flex:1;background:var(--accent);border-color:var(--accent);color:var(--accent-inkt)}
.dl .knop:disabled{opacity:.4;cursor:default}
.dl .knop:focus-visible,.dl .chip:focus-visible,.dl .waarde:focus-visible{outline:3px solid var(--voor);outline-offset:2px}
.dl .klaar{background:var(--vlak);border:1px solid var(--lijn);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:8px;overflow-wrap:anywhere}
.dl .klaar h2{margin:0;font-size:20px}
.dl .klaar ul{margin:0;padding-left:18px;color:var(--stil);font-size:15px}
.dl .klaar li b{color:var(--inkt)}
.dl .tip{font-size:13px;color:var(--stil)}
.dl .leeg{color:var(--stil)}
@media (max-width:480px){.dl .vraag{font-size:21px}.dl .waarde{min-width:70px}}
@media (prefers-reduced-motion:reduce){.dl .balk i{transition:none}}`;
  document.head.appendChild(s);
}

/* ---------- pad: families met open vragen, A vóór B ---------- */
function bouw(stap){
  const P = R(), alle = P.belangrijk().filter(c => { let s; try{ s = st(c); }catch(e){ return false; } return !s.kop && !P.isKoppel(c) && (stap ? !s.stap[stap] : s.open.length > 0); });
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

/* ---------- rijen per vraag: live uit dezelfde status als Productdata 2.0 (één keer vastgezet zodra de vraag in beeld komt) ---------- */
function rijenNu(v){
  const P = R();
  if(v.t === 'soort') return v.f.cs.filter(c => !st(c).stap.soort);
  // soort eerst: gewicht en hoeveelheid pas na een bevestigde soort; Weg heeft verder geen vragen
  if(v.t === 'gewicht') return v.f.cs.filter(c => { const s = st(c); return s.stap.soort && s.so !== 'weg' && !P.isSam(c) && !s.stap.gewicht; });
  return v.f.cs.filter(c => { const s = st(c); return s.stap.soort && s.so !== 'weg' && s.open.includes(v.t); });
}
const rijenVoor = v => v.rows || rijenNu(v);

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
  if(v.t === 'spp'){ const vp = volPallet(c); if(vp) d.push(vp); }
  return d.join(' · ');
}
// CLAUDE.md §4: gewicht volle pallet = kg per stuk × per pallet + 15; alleen bij vertrouwd of gewogen, bij te wegen wacht het
function volPallet(c){
  const P = R(), g = P.gewicht(c), a = A(c), stg = a.gst || g.st, so = soortNu(c);
  if(!PAL.includes(so)) return '';
  const sp = num((a.f && a.f.spp) || P.waarde(c, 'spp').v); if(!sp) return '';
  if(stg === 'tewegen') return 'volle pallet: berekend na wegen';
  const kg = stg === 'gewogen' ? (a.kg || g.kg) : g.kg || g.pq;
  return kg > 0 && ['vertrouwd', 'gewogen'].includes(stg) ? 'volle pallet ' + nf(Math.ceil(sp * kg + 15)) + ' kg (berekend)' : '';
}

/* ---------- teksten ---------- */
function meesteVoorstel(v, rijen){
  const t = {}; rijen.forEach(c => { const w = waarde(v, c); if(w.v && !w.zelf){ t[w.v] = t[w.v] || { n:0, c, why:w.why }; t[w.v].n++; } });
  const b = Object.entries(t).sort((x, y) => y[1].n - x[1].n)[0]; return b ? { v:b[0], n:b[1].n, why:b[1].why, c:b[1].c } : null;
}
function tekst(v, rijen){
  const m = meesteVoorstel(v, rijen), n = rijen.length, kort = s => esc(String(s || '').replace(/\s+/g, ' ').slice(0, 160));
  switch(v.t){
    case 'soort': return ['Welke soort ' + (n === 1 ? 'is dit product' : 'zijn deze ' + n) + '?', m ? 'Voorstel <b>' + esc(naamSoort(m.v)) + '</b>: ' + kort(m.why) + (m.n < n ? ' (' + m.n + ' van ' + n + ')' : '') + '.' : 'Geen voorstel uit de data: kies zelf.'];
    case 'gewicht': return ['Klopt het gewicht per stuk uit Picqer?', (m && m.why ? '<b>' + kort(m.why) + '</b>. ' : '') + 'Vertrouwd = Picqer klopt · te wegen = komt op de Weeglijst · gewogen = typ het echte gewicht.'];
    case 'spp': return ['Hoeveel stuks per pallet?', m ? 'Voorstel per product uit <b>' + kort(m.why) + '</b>. Tik een getal om het aan te passen.' : 'Geen voorstel uit de data: typ per product het aantal.'];
    case 'maat': return ['Welke palletmaat?', 'Jouw vaste maten' + (R().EIGEN_MATEN.length ? ' plus je eigen toegevoegde maten' : '') + '. Een nieuwe maat wordt meteen bewaard en staat er de volgende keer gewoon tussen.' + (m ? ' Voorstel: <b>' + kort(m.why) + '</b>.' : '')];
    case 'hoogte': return ['Hoe hoog is een volle pallet, incl. pallet?', 'Wordt naar boven afgerond op 10 cm. Hal A 20-locatie: max ± 140 cm.' + (m ? ' Voorstel uit <b>' + kort(m.why) + '</b>.' : '')];
    case 'maxpick': return ['Max op pick?', 'Aanvullen bij + wat je aanvult.' + (m ? ' Voorstel uit <b>' + kort(m.why) + '</b>.' : ' Geen voorstel uit de data: typ per product.')];
    case 'rl': return ['Hoe lang is een volle rol (m)?', m ? 'Voorstel uit <b>' + kort(m.why) + '</b>.' : 'Geen voorstel uit de data: typ per product.'];
    case 'rmax': return ['Hoeveel rollen passen op een pallet?', m ? 'Voorstel uit <b>' + kort(m.why) + '</b>.' : 'Geen voorstel uit de data: typ per product.'];
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
  if(!S.pad.length){ S.el.innerHTML = `<div class="dl">${kopHtml('Niets open', 100)}<main><div class="klaar"><h2>Niets meer open${S.stap ? ' voor ' + esc(R().STAPNAAM[S.stap]) : ''}</h2><p class="waarom">Alle belangrijke producten zijn ingevuld.</p><a class="knop hoofd" href="#/todo" style="text-align:center;text-decoration:none">← Te doen</a></div></main></div>`; return; }
  if(S.klaar){ S.el.innerHTML = `<div class="dl">${kopHtml('Klaar', 100)}<main><div class="klaar"><h2>Alles doorlopen</h2><p class="waarom">Elk antwoord staat in Productdata. Wat je uitvinkte of op Later zette, komt de volgende keer terug.</p><a class="knop hoofd" href="#/todo" style="text-align:center;text-decoration:none">← Te doen</a></div></main></div>`; return; }
  const v = S.pad[S.i], f = v.f, fi = S.fams.indexOf(f);
  if(v.t !== 'klaar' && !v.rows) v.rows = rijenNu(v);
  const stp = STAPNR[v.t] || 4;
  let h = `<div class="fam"><h1>${esc(f.naam)}</h1><span>${esc(f.lev)} · ${esc(f.kl)} · ${f.cs.length} ${f.cs.length === 1 ? 'product' : 'producten'}</span></div>
  <div class="stappen">${['Soort', 'Gewicht', 'Hoeveelheid'].map((n, k) => `<span class="stap ${stp === k + 1 ? 'nu' : stp > k + 1 ? 'af' : ''}">${k + 1} ${n}</span>`).join('')}</div>`;
  const waar = 'Familie ' + (fi + 1) + ' van ' + S.fams.length + ' · nog ' + telVragen(S.i) + ' vragen';
  const pct = Math.round(S.i / S.pad.length * 100);
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
  const nk = f.fk + '|' + v.t;
  h += `<div class="notitie">${S.notities[nk] != null ? `<textarea id="dl-not" placeholder="Jouw opmerking of regel bij deze vraag">${esc(S.notities[nk])}</textarea>` : `<button type="button" id="dl-notknop">+ Opmerking of eigen regel</button>`}</div>`;
  S.el.innerHTML = `<div class="dl">${kopHtml(waar, pct)}<main>${h}</main>${onderHtml(v)}</div>`;
  if(S.nieuweMaat){ const x = document.getElementById('dl-nieuwemaat'); if(x) x.focus(); }
}
const kopHtml = (waar, pct) => `<div class="kop"><div class="kop-in"><b>Doorloop</b><span class="waar" id="dl-waar">${esc(waar)}</span><a href="#/todo">Stoppen</a></div><div class="balk"><i style="width:${pct}%"></i></div></div>`;
function onderHtml(v){
  const laatste = S.i >= S.pad.length - 1;
  return `<div class="onder"><div class="onder-in"><button class="knop" id="dl-terug" type="button"${S.i === 0 ? ' disabled' : ''} aria-label="Terug">←</button>${v.t !== 'klaar' ? '<button class="knop" id="dl-later" type="button">Later</button>' : ''}<button class="knop hoofd" id="dl-klopt" type="button">${v.t === 'klaar' ? (laatste ? 'Klaar' : 'Volgende familie →') : 'Klopt →'}</button></div></div>`;
}
function rijHtml(v, c){
  const P = R(), a = A(c), w = waarde(v, c), on = S.sel.on.has(c), keus = ['soort', 'gewicht', 'maat'].includes(v.t);
  let toon, inv = '';
  if(v.t === 'soort') toon = w.v === 'weg' ? 'Weg · ' + (wegVan(c) ? naamWeg(wegVan(c)) : '?') : w.v ? naamSoort(w.v) : 'kies soort';
  else if(v.t === 'gewicht'){ toon = naamGew(w.v); if(w.v === 'gewogen') inv = `<span class="waarde zelf kg"><input data-kg="${esc(c)}" inputmode="decimal" value="${fmt(a.kg)}" placeholder="kg" aria-label="gewogen kg ${esc(c)}"><small>kg</small></span>`; }
  else if(v.t === 'maat') toon = w.v || 'kies maat';
  else { toon = w.v == null ? '' : fmt(w.v) + (v.t === 'hoogte' ? ' cm' : v.t === 'rl' ? ' m' : '');
    if(w.v == null) inv = `<span class="waarde leeg"><input data-num="${esc(c)}" inputmode="${v.t === 'rl' ? 'decimal' : 'numeric'}" placeholder="typ" aria-label="${esc(c)}"></span>`; }
  const attr = keus ? `data-kies="${esc(c)}"` : `data-tik="${esc(c)}"`;
  const wHtml = inv && v.t !== 'gewicht' ? inv : `<span class="waarde ${w.zelf ? 'zelf' : ''} ${!w.v ? 'leeg' : ''}" ${attr} tabindex="0" role="button">${esc(toon)}${keus ? ' ▾' : ''}</span>${inv}`;
  const opts = opties(v, v.f);
  const uit = keus && S.openRij === c ? `<span class="rijkeus">${opts.map(([k, t]) => `<button type="button" class="chip ${w.v === k ? (w.zelf ? 'on' : 'voor') : ''}" data-rijkeus="${esc(c)}|${esc(k)}">${esc(t)}</button>`).join('')}${v.t === 'soort' && w.v === 'weg' ? WEG.map(([k, t]) => `<button type="button" class="chip ${a.weg === k ? 'on' : ''}" data-rijweg="${esc(c)}|${k}">Weg · ${t}</button>`).join('') : ''}</span>` : '';
  return `<label class="rij ${on ? '' : 'uit'}"><input type="checkbox" data-sel="${esc(c)}" ${on ? 'checked' : ''} aria-label="${esc(c)} meenemen">
   <span class="nm"><b>${esc(P.naamVan(c))}</b><code>${esc(c)}</code><span class="feit">${esc(feiten(v, c))}</span></span>
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
    return `<li><b>${esc(c)}</b> ${esc(d.join(' · ') || '–')}${open.length ? ` <span class="open">· nog open: ${esc(open.join(', '))}</span>` : ''}</li>`;
  }).join('');
  const nots = Object.entries(S.notities).filter(([k, t]) => k.startsWith(f.fk + '|') && String(t || '').trim()).map(([, t]) => `<li>${esc(t)}</li>`).join('');
  const volgende = S.fams[S.fams.indexOf(f) + 1];
  return `<div class="klaar"><h2>${esc(f.naam)}</h2><ul>${r}</ul>${nots ? `<div class="tip"><b>Jouw opmerkingen</b></div><ul>${nots}</ul>` : ''}
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
  S.sel.on.forEach(c => zetVeld('maat', c, m)); S.nieuweMaat = false; S.melding = ''; teken();
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
function controle(v){
  const rijen = rijenVoor(v).filter(c => S.sel.on.has(c));
  if(v.t === 'soort'){
    const g = rijen.filter(c => !waarde(v, c).v); if(g.length) return 'Kies een soort bij ' + g.join(', ') + ', of vink uit en tik Later.';
    const w = rijen.filter(c => waarde(v, c).v === 'weg' && !A(c).weg); if(w.length) return 'Kies bij Weg: Uitlopend, Backorder of Archief (' + w.join(', ') + ').';
  }
  if(v.t === 'gewicht'){ const g = rijen.filter(c => waarde(v, c).v === 'gewogen' && !(A(c).kg > 0)); if(g.length) return 'Gewogen: typ de kg bij ' + g.join(', ') + ', of kies Te wegen.'; }
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
    const g = P.gewicht(c), stg = w.v, kg = stg === 'gewogen' ? A(c).kg : g.pq > 0 ? g.pq : null;
    P.poZet(c, p => { delete p.heropend; p.gew = Object.assign({ st:stg, t }, kg ? { kg } : {}); });
    return;
  }
  const vs = I.vs && I.vs[v.t], voor = vs && vs.v !== undefined && vs.v !== '' ? String(vs.v) : '', val = String(w.v);
  P.poZet(c, p => { delete p.heropend; p.f[v.t] = { v:val, st:voor && (voor === val || (v.t === 'hoogte' && String(Math.ceil(num(voor) / 10) * 10) === val)) ? 'bevestigd' : 'aangepast', voor, t }; });
}
function volgende(){ S.melding = ''; S.sel = null; S.openRij = null; S.nieuweMaat = false; if(S.i < S.pad.length - 1){ S.i++; sla(1); } else S.klaar = true; teken(); if(S.el) S.el.scrollTop = 0; const nat = document.getElementById('native'); if(nat) nat.scrollTop = 0; }
function klopt(){
  const v = S.pad[S.i]; if(!v) return;
  if(v.t !== 'klaar'){
    const fout = controle(v); if(fout){ S.melding = fout; teken(); return; }
    const mee = rijenVoor(v).filter(c => S.sel.on.has(c));
    rijenVoor(v).filter(c => !S.sel.on.has(c)).forEach(c => { A(c).later[v.t] = true; });   // uitgevinkt: blijft open
    mee.forEach(c => bewaar(v, c));
    if(mee.length){ try{ R().flush && R().flush(); }catch(e){} }
    // latere vragen van deze familie opnieuw bepalen (soort kan net veranderd zijn)
    S.pad.forEach(x => { if(x.f === v.f && x !== v && S.pad.indexOf(x) > S.i) delete x.rows; });
  }
  volgende();
}
function later(){ const v = S.pad[S.i]; if(!v || v.t === 'klaar') return; rijenVoor(v).forEach(c => { if(S.sel.on.has(c)) A(c).later[v.t] = true; }); volgende(); }
function terug(){ if(S.i <= 0) return; S.i--; sla(-1); if(S.pad[S.i] && S.pad[S.i].t !== 'klaar' && !rijenVoor(S.pad[S.i]).length){ S.i = 0; sla(1); } S.sel = null; S.openRij = null; S.melding = ''; S.nieuweMaat = false; S.klaar = false; teken(); }

/* ---------- opmerkingen: bewaard bij de familie (wh-pd2-feedback, bron doorloop) ---------- */
function laadNotities(){
  S.notities = {}; S.notId = {};
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
    if(t.dataset.tik){ bewerk(v, t); return; }
    if(t.dataset.kies){ S.openRij = S.openRij === t.dataset.kies ? null : t.dataset.kies; teken(); return; }
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
    if(d.num){ zetGetal(v, d.num, e.target.value); return; }
    if(e.target.id === 'dl-not'){ bewaarNotitie(v.f.fk + '|' + v.t, e.target.value); }
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
  const stap = STAPVAN[String(rest || '').split('/')[0]] || '';
  if(!R() || !R().S.klaar){
    teken();
    if(window.WHTAAK) await WHTAAK.pdLaden();
    if(window.PD2R && PD2R.laad && !PD2R.S.klaar) await PD2R.laad().catch(e => console.error(e));
    if(S.el !== el || !mag()) return;
  }
  const sleutel = stap + '|' + (location.hash || '');
  if(S.sleutel !== sleutel || !S.pad.length){ S.sleutel = sleutel; S.stap = stap; bouw(stap); sla(1); }
  teken();
}
return { render, S, bouw, teken };
})();
