/* =====================================================================
   IVOL Warehouse 3.0 — schermen voor iedereen (15-10-2026, Claude)
   Native schermen in de 3.0-schil (geen iframe):
     nakijken  Te controleren: schattingen van Claude in Productdata (meta.tw), aannames (wh/aannames.js) en de lijst Notities (geparkeerd, meta.park)
     dag       Dagstart: zes kerncijfers, dagritme om af te vinken, ochtendoverleg
     stand     Hoe staat het magazijn ervoor: Daans tien punten (kennisbank A1), alleen lezen (management)
     zoek      Product zoeken voor de vloer: waar ligt het, wat weten we, en een meldknop
     hulp      Hulp: per rol drie zinnen over wat je ziet en wat je doet (16-10)
   Opslag: productdata (alleen na een tik van Daan), catalog wh-aannames, wh-dag, wh-todo (meldingen).
   Leest alleen uit Picqer (via WHLIVE); schrijft nooit naar Picqer.
   ===================================================================== */
window.WHX = (function(){
'use strict';
const { $, esc, nf, D, isoDag, vandaag, toast } = WH;
const S = { later:new Set(), aanpas:false, fam:null, famUit:new Set(), famAanpas:false, pd:null, pdLaden:null, pdFout:null, dag:null, dagLaden:null, tab:'pd', zoek:'', gekozen:null, el:null, naam:'', rest:'' };
const ik = () => { try{ return localStorage.getItem('ivol-ik') || 'Daan'; }catch(e){ return 'Daan'; } };
const VELD = { opslag:'Soort', spp:'Stuks per pallet', pick:'Picklocatie', maxpick:'Max op pick', lvl:'Aanvullen bij', met:'Aanvullen met', geleverd:'Geleverd', mixgroep:'Mixgroep',
  maat:'Palletmaat', hoogte:'Hoogte incl. pallet (cm)', gewicht:'Gewicht volle pallet (kg)', plaatsen:'Plaatsen op ligger', vn:'Vloernaam', spd:'Stuks per doos', maxlig:'Max pallets per ligger', kgst:'Gewicht per stuk (kg)', doos:'Doosmaat', opm:'Opmerking' };
const VOLG = Object.keys(VELD);
const VHULP = { spd:'Stuks in één inkoopverpakking (doos, bundel of rol) zoals het binnenkomt. Bij per-cm- of per-meter-producten: cm of m per rol.', geleverd:'Wat er gewoonlijk per levering binnenkomt in totaal (meerdere dozen = meer dan 1 doos), of "wisselt".', spp:'Stuks op een volle pallet.', gewicht:'Gewicht van een volle pallet inclusief pallet.', maxpick:'Hoeveel er maximaal op de picklocatie past.', lvl:'Bij dit aantal op pick wordt aangevuld.', met:'Waarmee je aanvult: hele omdozen, pakketten of pallets.', kgst:'Gewicht van één stuk.', plaatsen:'Hoeveel ligger-plaatsen een pallet inneemt.' };
const ABC = { A:0, B:1, C:2 };
const naamVan = c => String((D.P[c] || {}).naam || '');
const abcVan = c => (D.P[c] || {}).abc || '';
const tijdNu = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/* ---------- stijl (eenmalig) ---------- */
function stijl(){
  if($('whx-stijl')) return;
  const s = document.createElement('style'); s.id = 'whx-stijl';
  s.textContent = `
  .x-tabs{display:flex;gap:6px;flex-wrap:wrap}
  .x-tabs button{border:1px solid var(--lijn);background:#fff;border-radius:999px;padding:7px 14px;min-height:44px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
  .x-tabs button.aan{background:var(--ink);color:#fff;border-color:var(--ink)}
  .x-tabs b{font-variant-numeric:tabular-nums;margin-left:4px}
  .x-kaart{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(15,23,32,.08);padding:14px 16px;display:grid;gap:8px}
  .x-kop{display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap}
  .x-kop .code{font-family:ui-monospace,Consolas,monospace;font-weight:800}
  .x-abc{display:inline-block;font-size:11px;font-weight:800;border-radius:4px;padding:1px 6px;background:#eef1f5;margin-left:6px}
  .x-abc.A{background:#1c7a4a;color:#fff}.x-abc.B{background:#cfe8da}
  .x-rij{display:grid;grid-template-columns:minmax(120px,190px) minmax(90px,170px) 1fr auto;grid-template-areas:"l i w k" ". . e .";gap:8px;align-items:center;padding:6px 0;border-top:1px solid #eef1f5}
  .x-rij>.x-ex{grid-area:e;display:flex;gap:8px;flex-wrap:wrap}.x-rij>.x-ex .x-btn{min-height:36px;font-size:13px}.x-hulp{display:block;color:#5b6573;font-size:13px;margin-bottom:2px}.x-rij.vast input{background:#fff}.x-rij>b{grid-area:l}.x-rij>input{grid-area:i}.x-rij>.x-why{grid-area:w}.x-rij>button{grid-area:k}
  .x-rij input{width:100%;min-height:44px;border:1px solid var(--lijn);border-radius:6px;padding:7px 9px;font:inherit;font-size:15px;background:#fffbea}
  .x-rij input.ok{background:#fff}
  .x-why{font-size:12.5px;color:var(--muted)}
  .x-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border:1px solid var(--lijn);background:#fff;border-radius:8px;padding:7px 12px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;text-decoration:none;color:inherit}
  .x-btn.ok{background:var(--ok);border-color:var(--ok);color:#fff}
  .x-vraag{max-width:720px}.x-q{font-size:15px;overflow-wrap:anywhere}.x-acties{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.x-acties input{flex:1 1 160px;min-width:0;min-height:44px;border:1px solid var(--lijn);border-radius:6px;padding:7px 9px;font:inherit;font-size:15px}.x-vraag .code{font-family:ui-monospace,Consolas,monospace;font-weight:800}.x-btn.aan{border-color:var(--ink)}.x-btn.vs{border-color:#1d4ea0;color:#123a7a;background:#f5f8fe}.x-soortw select{min-height:36px;border:1px solid var(--lijn);border-radius:6px;font:inherit;font-size:14px;padding:2px 6px;max-width:100%}.x-fam{display:grid;gap:4px;border-top:1px solid #eef1f5;padding-top:8px}.x-famrij{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;min-height:44px;cursor:pointer}.x-famrij input{width:20px;height:20px}.x-fn{overflow-wrap:anywhere}.x-fv{font-variant-numeric:tabular-nums}
  .x-btn.pri{background:#f08a4b;border-color:#f08a4b}
  .x-btn:disabled{opacity:.5;cursor:default}
  .x-tegels{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
  .x-tegel{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(15,23,32,.08);padding:14px;border-top:6px solid #d3d9e0;display:grid;gap:4px;text-decoration:none;color:inherit}
  .x-tegel.groen{border-top-color:var(--ok)}.x-tegel.oranje{border-top-color:#e0a100}.x-tegel.rood{border-top-color:var(--rood)}
  .x-tegel .n{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1}
  .x-tegel .t{font-weight:700;font-size:14px}.x-tegel .u{font-size:12.5px;color:var(--muted)}
  .x-ritme{display:grid;gap:0}
  .x-ritme label{display:grid;grid-template-columns:28px 78px 1fr auto;gap:8px;align-items:center;padding:9px 0;border-top:1px solid #eef1f5;cursor:pointer}
  .x-ritme input{width:20px;height:20px}
  .x-ritme .tijd{font-variant-numeric:tabular-nums;font-weight:800;font-size:13px;line-height:1.2}
  .x-ritme .wie{font-size:12.5px;color:var(--muted)}
  .x-ritme label.af .wat{text-decoration:line-through;color:var(--muted)}
  .x-ritme label.nu{background:#fff6e5}
  .x-punten{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
  .x-punt{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(15,23,32,.08);padding:14px;border-left:6px solid #d3d9e0;display:grid;gap:6px}
  .x-punt.groen{border-left-color:var(--ok)}.x-punt.oranje{border-left-color:#e0a100}.x-punt.rood{border-left-color:var(--rood)}
  .x-punt .nr{font-size:12px;font-weight:800;color:var(--muted)}
  .x-punt .m{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
  .x-punt a.small{display:inline-flex;align-items:center;min-height:44px;justify-self:start}
  .x-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .x-ritme label:focus-within{outline:3px solid #f08a4b;outline-offset:-3px;border-radius:6px}
  #native input:focus-visible,#native textarea:focus-visible,#native select:focus-visible,#native summary:focus-visible{outline:3px solid #f08a4b;outline-offset:2px}
  .x-zoek input{width:100%;font:inherit;font-size:18px;padding:12px 14px;border:2px solid var(--ink);border-radius:10px}
  .x-res{display:grid;gap:6px}
  .x-res button{all:unset;cursor:pointer;background:#fff;border-radius:10px;padding:10px 12px;box-shadow:0 1px 4px rgba(15,23,32,.08);display:grid;gap:2px}
  .x-res button:focus-visible{outline:3px solid var(--blauw)}
  .x-loc{display:flex;flex-wrap:wrap;gap:6px}
  .x-loc span{font-family:ui-monospace,Consolas,monospace;font-weight:800;font-size:16px;background:#eef1f5;border-radius:6px;padding:4px 9px}
  .x-loc span.pick{background:#1d4ea0;color:#fff}
  .x-meld{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
  .x-meld button{padding:14px;font-size:15px}
  .x-feit{list-style:none;display:grid;font-size:14px}.x-feit li{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #eef1f5}.x-feit li:last-child{border-bottom:0}
  .x-notitie{width:100%;min-height:110px;font:inherit;font-size:15px;padding:10px;border:1px solid var(--lijn);border-radius:8px}
  @media (max-width:640px){ .x-rij{grid-template-columns:1fr auto;grid-template-areas:"l l" "i k" "w w" "e e";gap:6px 8px;padding:8px 0} }
  `;
  document.head.appendChild(s);
}

/* ---------- laden ---------- */
function laadPd(vers){
  if(S.pdLaden && !vers) return S.pdLaden;
  S.pdLaden = (async () => {
    try{
      const rows = await WH.getAll('productdata', 'select=productcode,data,meta');
      S.pd = {}; (rows || []).forEach(r => { S.pd[r.productcode] = { data:r.data || {}, meta:r.meta || {} }; });
      S.pdFout = null;
    }catch(e){ S.pdFout = e; }
    herteken();
  })();
  return S.pdLaden;
}
function laadDag(vers){
  if(S.dagLaden && !vers) return S.dagLaden;
  S.dagLaden = (async () => { try{ const r = await WH.catHaal('wh-dag'); S.dag = (r && r.data) || {}; }catch(e){ S.dag = S.dag || {}; } herteken(); })();
  return S.dagLaden;
}
// alle schattingen van Claude die nog niet gecontroleerd zijn: [{ c, velden:[{k, v, uit}] }]
function twLijst(){
  if(!S.pd) return [];
  const uit = [];
  Object.entries(S.pd).forEach(([c, r]) => {
    const v = VOLG.concat(Object.keys(r.meta).filter(k => !VELD[k])).filter(k => r.meta[k] && r.meta[k].tw && r.data[k] !== undefined && r.data[k] !== '')
      .map(k => ({ k, v:String(r.data[k]), uit:r.meta[k].uit || '' }));
    if(v.length) uit.push({ c, velden:v });
  });
  // regelcontrole (Daan 17-10): waarden die tegen een bevestigde regel ingaan staan hier ook (zodra Productdata geladen is); Klopt zet ze op compleet
  const rc = window.WHPD && WHPD.S && WHPD.S.klaar && !WHPD.S.fout && WHPD.regelLijst ? WHPD.regelLijst() : [];
  rc.forEach(r => {
    let x = uit.find(y => y.c === r.c); if(!x){ x = { c:r.c, velden:[] }; uit.push(x); }
    if(!x.velden.some(f => f.k === r.k)){ x.velden.push({ k:r.k, v:r.v, uit:'Regelcontrole: ' + r.uit }); x.velden.sort((a, b) => VOLG.indexOf(a.k) - VOLG.indexOf(b.k)); }
  });
  return uit.sort((a, b) => (ABC[abcVan(a.c)] ?? 3) - (ABC[abcVan(b.c)] ?? 3) || naamVan(a.c).localeCompare(naamVan(b.c)));
}
/* ---------- één vraag tegelijk (Daan 30-10): alleen wat Productdata 2.0 ook vraagt ----------
   Soort, gewicht per stuk en de hoeveelheid van de soort (Pallet/Deel: stuks per pallet, palletmaat, hoogte; Pick/Mix: max op pick).
   Stuks per doos, picklocatie, aanvullen bij en vloernaam worden niet meer gevraagd; hun waarden blijven staan. */
const PD2VRAAG = { soort:'Soort', opslag:'Soort', kgst:'Gewicht per stuk (kg)', spp:'Stuks per pallet', maat:'Palletmaat', hoogte:'Hoogte incl. pallet (cm)', maxpick:'Max op pick', rol:'Is dit een rol?', rl:'Lengte volle rol (m)', rmax:'Max rollen per pallet' };
const PD2EIGEN = new Set(['soort', 'rol', 'rl', 'rmax']);
const PALLETVRAAG = new Set(['spp', 'maat', 'hoogte', 'gewicht', 'plaatsen', 'maxlig', 'rmax']);   // vaste regel: alleen met bewijs voor pallets
const SOORTT = { pallet:'Pallet', deel:'Deel', pick:'Pick', mix:'Mix', weg:'Weg' }, WEGT = { uitlopend:'Uitlopend', backorder:'Backorder', archief:'Archief' };
const soortTekst = v => { const [a, b] = String(v || '').split(':'); return (SOORTT[a] || a) + (b ? ' → ' + (WEGT[b] || b) : ''); };
const zonderPallet = c => { try{ return pd2Klaar() && !PD2R.info(c).bewijs; }catch(e){ return false; } };   // alleen in de opslag van Productdata 2.0 (niet in productdata)
const PD2SOORT = { spp:['pallet', 'deel'], maat:['pallet', 'deel'], hoogte:['pallet', 'deel'], maxpick:['pick', 'mix'] };
const pd2Klaar = () => !!(window.PD2R && PD2R.S && PD2R.S.klaar);
function soortVan(c){
  let so = ((S.pd || {})[c] || { data:{} }).data.opslag;
  try{ if(pd2Klaar()) so = PD2R.status(c).so || so; }catch(e){}
  return String(so || '').trim().toLowerCase();
}
function famVan(c){
  try{ if(pd2Klaar()) return PD2R.famVan(c); }catch(e){}
  return ((D.P[c] || {}).leverancier || '') + '|' + naamVan(c).split(' - ')[0].trim().toLowerCase();
}
// CLAUDE.md eerst: elke regel wordt toegepast vóór een vraag aan Daan. stat (optioneel) telt per regel wat verviel.
const REGELT = { nietin2:'niet in Productdata 2.0 (picklocatie, aanvullen bij, vloernaam, mixgroep, plaatsen, …)', doos:'stuks per doos, doosmaat, inkoopverpakking: nooit vragen (§3)',
  sam:'SAM Europe: alleen picklocatie, bulklocaties, aanvulniveau (§6)', uitlopend:'Uitlopend: geen vragen (§3)', backorder:'Weg → Backorder: voorlopig wegfilteren (§3)', weg:'Weg: alleen het Weg-menu (§3)',
  pallet:'palletvragen alleen bij bewijs van pallets (§3)', soortnietbij:'hoort niet bij de soort (Pick: alleen max op pick)', rol:'rollen alleen als Daan ze als rol koos (§5)',
  soorteerst:'soort eerst: gewicht en hoeveelheid pas na een bevestigde soort (§2)', later:'op later gezet' };
const DOOSK = new Set(['spd', 'doos', 'verp']);
function vraagLijst(stat){
  const L = [], VO = Object.keys(PD2VRAAG), tel = r => { if(stat) stat[r] = (stat[r] || 0) + 1; };
  const pk = pd2Klaar(), ab = c => /^[AB]$/.test(abcVan(c)) ? 0 : 1;
  const sam = c => { try{ return pk ? PD2R.isSam(c) : /sam europe/i.test(String((D.P[c] || {}).leverancier || '')); }catch(e){ return false; } };
  const stand = c => { if(!pk) return { so:soortVan(c), ok:true, weg:'' }; const st = PD2R.status(c), w = st.so === 'weg' ? PD2R.wegWaarde(c).v : ''; return { so:st.so, ok:st.stap.soort, weg:w || '' }; };
  const codes = new Set();
  twLijst().forEach(x => {
    if(!D.P[x.c]) return; codes.add(x.c);
    const sd = stand(x.c);
    x.velden.forEach(f => {
      if(DOOSK.has(f.k)) return tel('doos');
      if(!PD2VRAAG[f.k]) return tel('nietin2');
      if(f.k === 'opslag' && pk) return;   // de soort vraagt 2.0 zelf (hieronder), met zijn eigen voorstel
      if(sam(x.c) && f.k !== 'maxpick') return tel('sam');
      if(sd.so === 'weg') return tel(sd.weg === 'uitlopend' ? 'uitlopend' : sd.weg === 'backorder' ? 'backorder' : 'weg');
      if(PALLETVRAAG.has(f.k) && zonderPallet(x.c)) return tel('pallet');
      if(PD2SOORT[f.k] && !PD2SOORT[f.k].includes(sd.so)) return tel('soortnietbij');
      if(!sd.ok && !sam(x.c)) return tel('soorteerst');
      if(S.later.has(x.c + '|' + f.k)) return tel('later');
      // beantwoordt een regel het al (bijv. FWB van Hebei 50 per pallet): voorstel met reden "regel: …"
      let rv = null; try{ if(pk){ const w = (PD2R.info(x.c).vs || {})[f.k]; if(w && w.v && /^regel/.test(w.why || '')) rv = w; } }catch(e){}
      L.push({ c:x.c, k:f.k, v:rv ? String(rv.v) : f.v, uit:rv ? rv.why : f.uit, fam:famVan(x.c), ab:ab(x.c) });
    });
  });
  // vragen die alleen 2.0 stelt: de soort (eerst) en, als Daan het als rol koos, de rolgegevens
  if(pk) codes.forEach(c => {
    try{
      const st = PD2R.status(c), fam = famVan(c), sd = stand(c);
      if(PD2R.rolVoorstel(c)) tel('rol');
      if(sam(c)) return;
      if(!st.stap.soort){
        const w = PD2R.soortWaarde(c), ww = w.v === 'weg' ? PD2R.wegWaarde(c) : null;
        if(ww && ww.v === 'uitlopend') return tel('uitlopend');
        if(ww && ww.v === 'backorder') return tel('backorder');
        if(S.later.has(c + '|soort')) return tel('later');
        L.push({ c, k:'soort', v:w.v ? w.v + (ww && ww.v ? ':' + ww.v : '') : '', uit:w.why || '', fam, ab:ab(c) });
        return;
      }
      if(sd.so === 'weg') return;
      ['rl', 'rmax'].forEach(k => { if(!st.open.includes(k)) return; if(k === 'rmax' && zonderPallet(c)) return tel('pallet'); if(S.later.has(c + '|' + k)) return tel('later'); const w = PD2R.waarde(c, k); L.push({ c, k, v:w.v || '', uit:w.why || '', fam, ab:ab(c) }); });
    }catch(e){}
  });
  // A/B eerst, dan per familie en per vraag (soort eerst): dezelfde vraag komt achter elkaar
  return L.sort((a, b) => a.ab - b.ab || a.fam.localeCompare(b.fam) || VO.indexOf(a.k) - VO.indexOf(b.k) || naamVan(a.c).localeCompare(naamVan(b.c), 'nl', { numeric:true }));
}
// zelfde opslag als Productdata 2.0: productdata met bron pd2, vooraf een kopie van de rijen in wh-pd2-kopie-<dag>
async function pd2Zet(items){
  const eigen = items.filter(x => PD2EIGEN.has(x.k)); items = items.filter(x => !PD2EIGEN.has(x.k));
  if(eigen.length){
    const nu = new Date().toISOString();
    eigen.forEach(({ c, k, v }) => PD2R.poZet(c, p => {
      if(k === 'rol') p.rol = { v:/^(ja|j|1|true)$/i.test(String(v).trim()), st:'bevestigd', t:nu };
      else if(k === 'soort'){   // zelfde opslag als de soortknop in 2.0; Weg met reden (weg:backorder)
        const [so, wg] = String(v).trim().toLowerCase().split(':'), I = PD2R.info(c), nuSo = PD2R.soortWaarde(c, I), voor = nuSo.st === 'vastgelegd' ? nuSo.v : I.vsSo ? I.vsSo.v : '';
        if(!SOORTT[so]) return;
        p.so = { v:so, st:voor === so ? 'bevestigd' : 'aangepast', voor, t:nu };
        if(so === 'weg' && WEGT[wg]){ const vw = I.vsWeg; p.weg = { v:wg, st:vw && vw.v === wg ? 'bevestigd' : 'aangepast', voor:vw ? vw.v : '', t:nu }; }
      }
      else { const w = PD2R.waarde(c, k), voor = w && ['voorstel', 'twijfel'].includes(w.st) ? String(w.v) : ''; p.f[k] = { v:String(v), st:voor && voor === String(v) ? 'bevestigd' : 'aangepast', voor, t:nu }; }
    }));
    await PD2R.flush();
  }
  if(!items.length) return;
  const codes = [...new Set(items.map(x => x.c))], nu = new Date().toISOString();
  const lijst = codes.map(c => '"' + String(c).replace(/"/g, '\\"') + '"').join(',');
  const vers = await WH.api('GET', 'productdata?productcode=in.(' + encodeURIComponent(lijst) + ')&select=productcode,data,meta');
  const oud = {}; (vers || []).forEach(r => { oud[r.productcode] = r; });
  const dag = nu.slice(0, 10), key = 'wh-pd2-kopie-' + dag, k0 = await WH.catHaal(key).catch(() => null), kd = (k0 && k0.data && Array.isArray(k0.data.rijen)) ? k0.data : { dag, rijen:[] };
  codes.forEach(c => kd.rijen.push({ c, t:nu, rij:oud[c] || null, wijz:items.filter(x => x.c === c).map(x => x.k) }));
  await WH.catZet(key, kd);
  const rijen = codes.map(c => {
    const r = oud[c] || { productcode:c, data:{}, meta:{} }, data = Object.assign({}, r.data || {}), meta = Object.assign({}, r.meta || {});
    items.filter(x => x.c === c).forEach(({ k, v }) => {
      v = String(v ?? '').trim(); if(!v) return;
      const was = meta[k] && meta[k].tw ? ' (was schatting Claude' + (String(data[k]) !== v ? ': ' + data[k] : '') + ')' : '';
      data[k] = v; meta[k] = { op:nu, bron:'pd2', uit:'Te controleren (3.0) door ' + ik() + was };
      if(window.WHPD && WHPD.regelFout && WHPD.regelFout(c, k, v)) meta[k].rok = 1;
    });
    return { productcode:c, data, meta, updated_at:nu };
  });
  await WH.upsert('productdata', rijen, 'productcode');
  rijen.forEach(r => {
    if(S.pd) S.pd[r.productcode] = { data:r.data, meta:r.meta };
    if(D.PD) D.PD[r.productcode] = r.data;
    if(window.WHPD && WHPD.S && WHPD.S.pd) WHPD.S.pd[r.productcode] = { data:r.data, meta:r.meta, t:nu };
    try{ if(window.PD2R && PD2R.ongeldig) PD2R.ongeldig(r.productcode); }catch(e){}
  });
}
// familielijst onder de kaart: vinkje (standaard aan), naam, code en de huidige waarde; niet aangevinkt blijft open als eigen vraag
function famLijst(q, fam){
  const n = fam.filter(y => !S.famUit.has(y.c)).length;
  return `<div class="x-fam" data-fam="${esc(q.fam + '|' + q.k)}">
    ${fam.map(y => `<label class="x-famrij"><input type="checkbox" data-x="famvink" data-code="${esc(y.c)}" ${S.famUit.has(y.c) ? '' : 'checked'}><span class="x-fn">${esc(naamVan(y.c))}<span class="small muted"> · <span class="code">${esc(y.c)}</span></span></span><b class="x-fv">${y.v ? esc(q.k === 'soort' ? soortTekst(y.v) : y.v) : '–'}</b></label>`).join('')}
    ${S.famAanpas ? `<div class="x-acties"><input id="x-famin" value="${esc(q.v)}" aria-label="${esc(PD2VRAAG[q.k])} voor de selectie" autocomplete="off"><button class="x-btn ok" data-x="famopslaan">Opslaan voor selectie</button></div>` : ''}
    <div class="x-acties"><button class="x-btn ok" data-x="famklopt">Klopt voor selectie (${nf(n)})</button>${S.famAanpas ? '' : `<button class="x-btn" data-x="famaanpas">Aanpassen voor selectie</button>`}</div>
  </div>`;
}
const soortOpties = huidig => `<option value="">${esc(huidig ? soortTekst(huidig) : '–')} ▾</option>` + ['pallet', 'deel', 'pick', 'mix'].map(k => `<option value="${k}">${SOORTT[k]}</option>`).join('') + Object.keys(WEGT).map(k => `<option value="weg:${k}">Weg → ${WEGT[k]}</option>`).join('');
// soortvraag: Pallet · Deel · Pick · Mix · Weg met het voorstel; bij Weg alleen het Weg-menu
function soortKnoppen(q){
  const [vs, vw] = String(q.v || '').split(':');
  return `<div class="x-acties x-soorten">${Object.keys(SOORTT).map(k => `<button class="x-btn${vs === k ? ' vs' : ''}" data-x="vsoort" data-v="${k}">${SOORTT[k]}${vs === k ? ' (voorstel)' : ''}</button>`).join('')}</div>
    ${S.wegOpen || vs === 'weg' ? `<div class="x-acties">${Object.keys(WEGT).map(k => `<button class="x-btn${vw === k ? ' vs' : ''}" data-x="vsoort" data-v="weg:${k}">Weg → ${WEGT[k]}${vw === k ? ' (voorstel)' : ''}</button>`).join('')}</div>` : ''}`;
}
// familiekaart (soort eerst): per product de voorgestelde soort met reden en een vinkje; Selectie klopt of Selectie is: …
function famSoortHtml(L, q){
  const fam = L.filter(x => x.fam === q.fam && x.k === 'soort'), n = fam.filter(y => !S.famUit.has(y.c)).length;
  const fnaam = (() => { try{ return pd2Klaar() ? PD2R.famNaam(q.fam) : naamVan(q.c); }catch(e){ return naamVan(q.c); } })();
  return `<div class="small muted x-nog">nog ${nf(L.length)} ${L.length === 1 ? 'vraag' : 'vragen'}</div>
    <div class="x-kaart x-vraag x-famsoort" data-code="${esc(q.c)}" data-k="soort" data-famkaart="1">
      <div><b>${esc(fnaam)}</b><div class="small muted">${esc((D.P[q.c] || {}).leverancier || '')} · ${mv(fam.length, 'product', 'producten')} · soort eerst, daarna gewicht en hoeveelheid</div></div>
      <div class="x-fam">${fam.map(y => `<label class="x-famrij"><input type="checkbox" data-x="famvink" data-code="${esc(y.c)}" ${S.famUit.has(y.c) ? '' : 'checked'}><span class="x-fn">${esc(naamVan(y.c))}<span class="small muted"> · <span class="code">${esc(y.c)}</span></span>${y.uit ? `<span class="x-why"> — ${esc(String(y.uit).replace(/\s+/g, ' ').slice(0, 110))}</span>` : ''}</span><b class="x-fv">${y.v ? esc(soortTekst(y.v)) : '–'}</b></label>`).join('')}</div>
      <div class="x-acties"><button class="x-btn ok" data-x="famklopt">Selectie klopt (${nf(n)})</button><button class="x-btn" data-x="vlaterfam">Later</button></div>
      <div class="x-acties x-soorten"><span class="small">Selectie is:</span>${Object.keys(SOORTT).map(k => `<button class="x-btn" data-x="vsoort" data-v="${k}">${SOORTT[k]}</button>`).join('')}</div>
      ${S.wegOpen ? `<div class="x-acties">${Object.keys(WEGT).map(k => `<button class="x-btn" data-x="vsoort" data-v="weg:${k}">Weg → ${WEGT[k]}</button>`).join('')}</div>` : ''}
    </div>`;
}
const mv = (n, een, meer) => nf(n) + ' ' + (n === 1 ? een : meer);
function vraagHtml(){
  const L = vraagLijst(), q = L[0];
  if(q && q.k === 'soort') return famSoortHtml(L, q);
  if(!q) return `<div class="blok"><b>Niets meer te controleren in Productdata.</b>${S.later.size ? ` <span class="muted">${nf(S.later.size)} op later gezet (komen terug na herladen).</span>` : ''}</div>`;
  const p = D.P[q.c] || {}, fam = L.filter(x => x.fam === q.fam && x.k === q.k);
  const feiten = [p.leverancier, abcVan(q.c) ? 'ABC ' + abcVan(q.c) : '', p.voorraad_hm != null ? 'voorraad ' + nf(+p.voorraad_hm || 0) : '', soortVan(q.c) ? 'soort ' + soortVan(q.c) : ''].filter(Boolean).join(' · ');
  const reden = String(q.uit || '').replace(/\s+/g, ' ').slice(0, 140);
  return `<div class="small muted x-nog">nog ${nf(L.length)} ${L.length === 1 ? 'vraag' : 'vragen'}</div>
    <div class="x-kaart x-vraag" data-code="${esc(q.c)}" data-k="${esc(q.k)}">
      <div><b>${esc(naamVan(q.c))}</b><div class="small muted"><span class="code">${esc(q.c)}</span>${feiten ? ' · ' + esc(feiten) : ''}</div></div>
      <div class="x-q"><b>${esc(PD2VRAAG[q.k])}</b>: <b class="x-vs">${q.v ? esc(q.k === 'soort' ? soortTekst(q.v) : q.v) : 'geen voorstel'}</b>${reden ? ` <span class="x-why">— ${esc(reden)}</span>` : ''}</div>
      ${q.k === 'soort' ? soortKnoppen(q) : `<label class="x-soortw small">soort: <select data-x2="soortwijzig" aria-label="Soort wijzigen">${soortOpties(soortVan(q.c))}</select></label>`}
      ${S.aanpas ? `<div class="x-acties"><input id="x-vin" value="${esc(q.v)}" aria-label="${esc(PD2VRAAG[q.k])}" autocomplete="off"><button class="x-btn ok" data-x="vopslaan">Opslaan</button></div>` : ''}
      <div class="x-acties">${q.v ? '<button class="x-btn ok" data-x="vklopt">Klopt</button>' : ''}${S.aanpas ? '' : '<button class="x-btn" data-x="vaanpas">Aanpassen</button>'}<button class="x-btn" data-x="vlater">Later</button>${fam.length > 1 ? `<button class="x-btn${S.fam === q.fam + '|' + q.k ? ' aan' : ''}" data-x="vfam" aria-expanded="${S.fam === q.fam + '|' + q.k}">geldt voor alle ${nf(fam.length)} in deze familie</button>` : ''}</div>
      ${fam.length > 1 && S.fam === q.fam + '|' + q.k ? famLijst(q, fam) : ''}
    </div>`;
}
async function bevestig(c, waarden){
  // waarden = { veld: waarde }; vers lezen, samenvoegen, één rij terugschrijven
  const nu = new Date().toISOString();
  const vers = await WH.api('GET', 'productdata?productcode=eq.' + encodeURIComponent(c) + '&select=productcode,data,meta');
  const r = (vers && vers[0]) || { productcode:c, data:{}, meta:{} };
  const data = Object.assign({}, r.data || {}), meta = Object.assign({}, r.meta || {});
  Object.entries(waarden).forEach(([k, v]) => {
    v = String(v ?? '').trim(); if(!v) return;
    const was = meta[k] && meta[k].tw ? ' (was schatting Claude' + (String(data[k]) !== v ? ': ' + data[k] : '') + ')' : '';
    data[k] = v; meta[k] = { op:nu, bron:'invul', uit:'gecontroleerd door ' + ik() + was };
    if(window.WHPD && WHPD.regelFout && WHPD.regelFout(c, k, v)) meta[k].rok = 1;   // tegen een regel in en toch bevestigd: telt als compleet
  });
  await WH.upsert('productdata', [{ productcode:c, data, meta, updated_at:nu }], 'productcode');
  if(S.pd) S.pd[c] = { data, meta };
  if(D.PD) D.PD[c] = data;
  if(window.WHPD && WHPD.S && WHPD.S.pd) WHPD.S.pd[c] = { data, meta, t:nu };
}

/* ---------- Notities (Daan 17-10): besproken en bewust geparkeerd ----------
   Los van het bouwplan: geen taak en geen teller in Te doen. Geparkeerde velden (productdata meta.<veld>.park = 1, notitie in meta.<veld>.uit) staan hier,
   samen met een paar vaste notities. Een geparkeerd veld telt in Poort 0.4 als compleet. */
const NOTITIES_VAST = [
  { id:'wandrek-sheet', t:'Invulsheet wandrekken', tekst:'19 wandrekken; de printbare PDF ligt bij Daan. Kate of een medewerker laat de sheet invullen, vanaf week 43. Daarna invullen in Oefenen 3.0 ("Wandrekken invullen") of aan Claude geven. Blokkeert niets in het bouwplan. Tot de sheet terug is blijft de huidige max op pick staan.' },
  { id:'parkeerplaats-pennen', t:'Idee (niet bouwen): parkeerplaats pennen', tekst:'Vaste plek bij de inpaktafel met een bak per soort kunststof pen (3–4 soorten), duidelijk gelabeld, en een mixpallet pennen op bulk.' }
];
function parkGroepen(){
  const g = {};
  Object.entries(S.pd || {}).forEach(([c, r]) => Object.keys(r.meta || {}).forEach(k => { const m = r.meta[k]; if(m && m.park && D.P[c]){ const t = m.uit || ''; (g[t] = g[t] || []).push({ c, k }); } }));
  return Object.entries(g).map(([tekst, items]) => ({ tekst, items })).sort((a, b) => b.items.length - a.items.length);
}
/* ---------- Taken uit de masteropdracht 17-10 (eenmalig in Te doen, wh-todo) ----------
   Vaste id's: bestaat de taak al of is hij verwijderd na het zaaien (marker in wh-taken), dan komt hij niet terug. Schrijft nooit naar Picqer. */
const ZAAI_MARKER = 'zaai:2026-10-17';
const ZAAI_TAKEN = [
  { id:'zaai-20261017-wegzetten', titel:'Wegzetten: trapleuningen design 200/250 en rond 350, vierkante houder en trapprofielen', noot:'Ze staan op "geen specifieke locatie" terwijl de picks leeg zijn (design-200-black, design-250-black, TRLBLACK-350, holder-black-square, 42x21x100ALU). Op de picklocatie zetten en in Picqer verplaatsen.', wie:['Kate'], prio:2 },
  { id:'zaai-20261017-bulk-leuningen', titel:'Picqer: bulklocatie "bulk leuningen" aanmaken en op bulk zetten', noot:'Achterwand AF, waar de extra dozen leuningen rechtop staan. In Picqer zelf aanmaken (de app schrijft niet naar Picqer).', wie:['Daan'], prio:2 }
];
function zaaiTaken(){
  if(S.zaaiP) return S.zaaiP;
  S.zaaiP = (async () => {
    try{
      if(!D.geladen || (D.TAKEN || {})[ZAAI_MARKER]) return;
      const nu = new Date().toISOString(), datum = vandaag(), nieuw = {};
      ZAAI_TAKEN.forEach(t => { if(!(D.TODO || {})[t.id]) nieuw[t.id] = Object.assign({ noot:'', tijd:'', herhaal:null, door:'Claude', op:nu, klaar:null, datum }, t); });
      if(Object.keys(nieuw).length) await WH.catPatch('wh-todo', nieuw);
      await WH.catPatch('wh-taken', { [ZAAI_MARKER]:{ op:nu } });
    }catch(e){ S.zaaiP = null; console.warn('taken zaaien:', e.message || e); }
  })();
  return S.zaaiP;
}

function overigeVelden(x){
  const r = (S.pd || {})[x.c]; if(!r) return [];
  const open = new Set(x.velden.map(f => f.k));
  return VOLG.filter(k => !open.has(k) && r.data && r.data[k] !== undefined && r.data[k] !== '' && !(r.meta && r.meta[k] && r.meta[k].park))
    .map(k => ({ k, v:String(r.data[k]), uit:(r.meta && r.meta[k] && r.meta[k].uit) || '' }));
}
async function parkeer(c, k, reden){
  const nu = new Date().toISOString();
  const vers = await WH.api('GET', 'productdata?productcode=eq.' + encodeURIComponent(c) + '&select=productcode,data,meta');
  const r = (vers && vers[0]) || { productcode:c, data:{}, meta:{} };
  const data = Object.assign({}, r.data || {}), meta = Object.assign({}, r.meta || {});
  delete data[k]; meta[k] = { op:nu, bron:'daan', park:1, uit:reden };
  await WH.upsert('productdata', [{ productcode:c, data, meta, updated_at:nu }], 'productcode');
  if(S.pd) S.pd[c] = { data, meta };
  if(D.PD) D.PD[c] = data;
  if(window.WHPD && WHPD.S && WHPD.S.pd) WHPD.S.pd[c] = { data, meta, t:nu };
}

/* ---------- Te controleren ---------- */
function viewNakijken(){
  const tw = twLijst(), nTw = S.pd ? vraagLijst().length : 0;
  const aan = window.WHAAN ? WHAAN.open() : [];
  const zonder = Object.entries(D.VR || {}).filter(([c, v]) => v.geen > 0).length;
  const tab = S.tab;
  const kop = `<div class="pagina"><h1>Te controleren</h1>
    <p class="lede">Wat Claude heeft ingevuld of aangenomen zonder dat jij het zei. Alles is al bruikbaar, maar telt pas als zeker nadat jij op <b>Klopt</b> tikt of het aanpast. Productdata-schattingen tellen tot dan als open in Poort 0.4.</p>
    <div class="x-tabs" role="tablist">
      <button role="tab" aria-selected="${tab === 'pd'}" class="${tab === 'pd' ? 'aan' : ''}" data-x="tab" data-v="pd">Productdata<b>${S.pd ? nf(nTw) : '…'}</b></button>
      <button role="tab" aria-selected="${tab === 'aan'}" class="${tab === 'aan' ? 'aan' : ''}" data-x="tab" data-v="aan">Aannames<b>${nf(aan.length)}</b></button>
      <button role="tab" aria-selected="${tab === 'notities'}" class="${tab === 'notities' ? 'aan' : ''}" data-x="tab" data-v="notities">Notities<b>${S.pd ? nf(NOTITIES_VAST.length + parkGroepen().length) : NOTITIES_VAST.length}</b></button>
      <button role="tab" aria-selected="${tab === 'data'}" class="${tab === 'data' ? 'aan' : ''}" data-x="tab" data-v="data">Uit de data</button>
    </div>`;
  let body = '';
  if(tab === 'pd'){
    if(S.pdFout) body = `<div class="blok let">Productdata laden lukte niet: ${esc(S.pdFout.message || String(S.pdFout))}</div>`;
    else if(!S.pd){ laadPd(); body = '<div class="leeg">Productdata laden…</div>'; }
    else if(!(window.WHPD && WHPD.S && WHPD.S.klaar) && window.WHTAAK && !S.rcPoging){ S.rcPoging = true; WHTAAK.pdLaden().then(() => { S.rcKlaar = true; herteken(); }, () => { S.rcKlaar = true; herteken(); }); body = '<div class="leeg">Regelcontrole laden…</div>'; }
    else if(!nTw && window.WHPD && WHPD.S && WHPD.S.klaar) body = vraagHtml();
    else if(!tw.length) body = S.rcKlaar ? '<div class="blok"><b>Niets meer te controleren in de schattingen van Claude.</b> <span class="muted">De regelcontrole (waarden die tegen een regel ingaan) kon niet laden.</span></div>' : '<div class="leeg">Regelcontrole laden…</div>';
    else { if(window.PD2R && PD2R.laad && !pd2Klaar() && !S.pd2Poging){ S.pd2Poging = true; PD2R.laad().then(herteken, herteken); } body = vraagHtml(); }
  } else if(tab === 'aan'){
    const groepen = [...new Set(WHAAN.LIJST.map(a => a.groep))];
    const nOk = WHAAN.LIJST.length - aan.length;
    body = `<div class="small muted">${nf(aan.length)} open · ${nf(nOk)} ✓ (door jou in de app, of besloten in de chat). Een eigen keuze in de app gaat voor, behalve als je daarna in de chat iets anders besloot.</div>` + groepen.map(g => { const L = WHAAN.LIJST.filter(a => a.groep === g), nO = L.filter(a => !WHAAN.status(a.id).ok).length;
      return `<section class="blok"><h2>${esc(g)} <span class="small muted">${nO ? nf(nO) + ' open' : '✓ alles'}</span></h2>${L.map(a => { const k = WHAAN.status(a.id), kern = a.groep === 'Kerncijfers';
        return `<div class="x-rij" data-aan="${esc(a.id)}"><b>${esc(a.t)}</b><input class="${k.ok ? 'ok' : ''}" value="${esc(WHAAN.waarde(a.id))}" aria-label="${esc(a.t)}"${kern ? ' data-grens="1" inputmode="numeric"' : ''}><span class="x-why">${kern ? `<b class="x-grens" aria-live="polite">${esc(WHAAN.grensTekst(WHAAN.waarde(a.id)))}</b><br>` : ''}${esc(a.waarom)}${a.eenheid ? ' · ' + esc(a.eenheid) : ''}${k.ok ? ` · <b style="color:var(--ok)">✓ ${esc(k.door || '')} ${esc(String(k.op || '').slice(0, 10))}</b>` : ''}</span>${k.ok ? `<button class="x-btn" data-x="aanterug" data-id="${esc(a.id)}">Opnieuw</button>` : `<button class="x-btn" data-x="aanok" data-id="${esc(a.id)}">Klopt</button>`}</div>`; }).join('')}</section>`; }).join('');
  } else if(tab === 'notities'){
    if(!S.pd && !S.pdFout) laadPd();
    const pg = S.pd ? parkGroepen() : [];
    body = `<div class="small muted">Besproken en bewust open gelaten, of een idee. Los van het bouwplan: geen taak en geen teller in Te doen. Een geparkeerd veld telt in Poort 0.4 als compleet.</div>` +
      NOTITIES_VAST.map(n => `<section class="blok"><h2>${esc(n.t)}</h2><p class="small">${esc(n.tekst)}</p></section>`).join('') +
      (S.pdFout ? `<div class="blok let">Geparkeerde velden laden lukte niet: ${esc(S.pdFout.message || String(S.pdFout))}</div>` : !S.pd ? '<div class="leeg">Geparkeerde velden laden…</div>' :
        pg.length ? pg.map(g => { const codes = [...new Set(g.items.map(i => i.c))]; return `<section class="blok"><h2>${esc(g.tekst || 'Geparkeerd')}</h2>
          <p class="small muted">${nf(codes.length)} producten · ${nf(g.items.length)} velden geparkeerd</p>
          <div class="small">${codes.slice(0, 60).map(c => `<a href="#/zoek/${encodeURIComponent(c)}">${esc(c)}</a> <span class="muted">${esc(g.items.filter(i => i.c === c).map(i => VELD[i.k] || i.k).join(', '))}</span>`).join(' · ')}${codes.length > 60 ? ' · +' + nf(codes.length - 60) : ''}</div></section>`; }).join('')
        : '<div class="small muted">Geen geparkeerde velden in Productdata.</div>');
  } else {
    const bo = D.BO || [];
    body = `<section class="blok"><h2>Twijfel die uit de gegevens komt</h2><div class="tabel"><table><tbody>
      <tr><td><b>Voorraad op "geen specifieke locatie"</b><br><span class="muted">Picqer telt dit als pick, maar niemand vindt het. Tellen en op de juiste plek zetten.</span></td><td><b>${nf(zonder)}</b> producten</td><td><a class="knop" href="#/aanvullive">Live advies →</a></td></tr>
      <tr><td><b>Locatie-aandachtspunten</b><br><span class="muted">Pick op tijdelijk, vloer maar bulk, hoog maar pick, BA-dubbelingen, losse namen.</span></td><td></td><td><a class="knop" href="#/locaties">Locaties →</a></td></tr>
      <tr><td><b>Dubbel in palletlabels</b><br><span class="muted">Twee aantallen per pallet voor één product.</span></td><td></td><td><a class="knop" href="#/productdata">Productdata →</a></td></tr>
      <tr><td><b>Backorders (export)</b><br><span class="muted">Regels in de laatst ingelezen backorder-export.</span></td><td><b>${nf(bo.length)}</b></td><td><a class="knop" href="#/backorders">Backorders →</a></td></tr>
    </tbody></table></div></section>`;
  }
  return kop + body + '</div>';
}

/* ---------- kerncijfers (gedeeld door Dagstart en Stand) ---------- */
function kleur(n, id, extra){
  if(n === null || n === undefined) return '';
  if(extra === 'voor12') return '';   // Daan 16-10: vóór 12:00 neutraal, telt vanaf 12:00
  const g = WHAAN.grens(id);
  return n >= g.rood ? 'rood' : n >= g.oranje ? 'oranje' : 'groen';
}
// containers die nog binnenkomen (niet afgerond): productcodes uit de regels en voorboekingen
function inkomendCodes(){
  const s = new Set(), vd = vandaag();
  (D.CONT || []).filter(c => c.status !== 'afgerond' && (!c.losdatum || c.losdatum >= isoDag(Date.now() - 7 * 864e5))).forEach(c => {
    (c.regels || []).concat(...(c.voorboekingen || []).map(v => v.regels || [])).forEach(r => { const c0 = r && (r.code || r.productcode); if(c0) s.add(D.PLOW[String(c0).toLowerCase()] || c0); });
  });
  return s;
}
// backorders die wij oplossen: elke regel op voorraad in het Hoofdmagazijn (aanvullen/verplaatsen), of het product komt binnen met een container
function boOplossen(data){
  const B = WHLIVE.backorderCijfers(data.backorders), codeVan = {};
  try{ const ids = (window.WHAL && WHAL.S.cat && WHAL.S.cat.ids) || {}; Object.entries(ids).forEach(([c, id]) => { codeVan[id] = c; }); }catch(e){}
  try{ WHLIVE.rijen().forEach(r => { if(r.p) codeVan[r.b.id] = r.p.code; }); }catch(e){}
  const komt = inkomendCodes(), uit = { n:0, bulk:0, inkomend:0, o30:0, echt:0 };
  B.orderLijst.forEach(o => {
    const ok = o.regels.every(r => r.v >= r.a || (codeVan[r.p] && komt.has(codeVan[r.p])));
    if(!ok){ uit.echt++; return; }
    uit.n++; if(o.vol) uit.bulk++; else uit.inkomend++;
    if((WHLIVE.uren(o.oudste) ?? 0) >= 30 * 24) uit.o30++;
  });
  return uit;
}
function cijfers(){
  const st = window.WHLIVE ? WHLIVE.status() : { code:false };
  const data = st.data;
  const P = data ? WHLIVE.picklijstCijfers(data.picklijsten) : null;
  const B = data ? WHLIVE.backorderCijfers(data.backorders) : null;
  // orders langer dan 30 dagen in backorder (oudste regel van de order)
  if(B) B.o30 = B.orderLijst.filter(o => (WHLIVE.uren(o.oudste) ?? 0) >= 30 * 24).length;
  let BO = null; try{ BO = data ? boOplossen(data) : null; }catch(e){ console.error(e); }
  let nu = null; try{ nu = data && st.klaar ? WHLIVE.nuLijst().length : null; }catch(e){}
  const vd = vandaag(), tn = tijdNu();
  const takenAchter = Object.values(D.TODO || {}).filter(t => t && t.titel && !t.klaar && (t.datum < vd || (t.datum === vd && t.tijd && t.tijd < tn))).length;
  // voorraad van een opgeboekte container die wacht op lossen/Stockmove telt niet mee (Daan 16-10)
  const wacht = window.WHLOC && WHLOC.wachtOpLossen ? WHLOC.wachtOpLossen() : {};
  const geen = Object.entries(D.VR || {}).filter(([c, v]) => v.geen > (wacht[c] || 0)).length;
  const binnen = (D.CONT || []).filter(c => c.losdatum === vd && c.status !== 'afgerond');
  const na12 = tn >= '12:00';
  return { st, P, B, BO, nu, takenAchter, geen, binnen, na12, live:!!data };
}
function tegels(K){
  const KL = { groen:'op schema', oranje:'let op', rood:'nu iets doen' };
  const t = (n, titel, uitleg, kl, href) => `<a class="x-tegel ${kl}" href="${href || '#/dag'}"><span class="n">${n === null || n === undefined ? '–' : nf(n)}</span><span class="t">${esc(titel)}</span><span class="u">${esc(uitleg)}</span>${KL[kl] ? `<span class="x-sr">, ${KL[kl]}</span>` : ''}</a>`;
  const geenLive = K.st.code ? (K.st.laden ? 'laden…' : K.st.fout ? 'Picqer: ' + (K.st.fout.message || 'fout') : 'nog niet geladen') : 'geen koppelcode op dit apparaat';
  return `<div class="x-tegels">
    ${t(K.P ? K.P.o12 : null, 'Orders ouder dan 12 uur', K.P ? (K.na12 ? 'na 12:00: moet 0 zijn' : 'telt vanaf 12:00') : geenLive, K.P ? kleur(K.P.o12, 'k-o12', K.na12 ? '' : 'voor12') : '', '#/live')}
    ${t(K.P ? K.P.o24 : null, 'Picklijsten ouder dan 24 uur', K.P ? (K.P.oudsteUur ? 'oudste ' + Math.round(K.P.oudsteUur) + ' uur' : 'geen open') : geenLive, K.P ? kleur(K.P.o24, 'k-o24') : '', '#/live')}
    ${t(K.BO ? K.BO.n : null, 'Backorders die wij oplossen', K.BO ? nf(K.BO.bulk) + ' met voorraad hier · ' + nf(K.BO.inkomend) + ' container onderweg' + (K.BO.o30 ? ' · waarvan ' + nf(K.BO.o30) + ' > 30 dagen' : '') : geenLive, K.BO ? kleur(K.BO.n, 'k-bo2') : '', '#/live')}
    ${t(K.nu, 'Nu verplaatsen open', K.nu === null ? (K.live ? 'voorraad laden…' : geenLive) : 'van bulk naar pick voor orders', K.nu === null ? '' : K.na12 ? kleur(K.nu, 'k-nu') : (K.nu ? 'oranje' : 'groen'), '#/aanvullive')}
    ${t(K.takenAchter, 'Taken achter', 'niet afgevinkt op tijd', kleur(K.takenAchter, 'k-taak'), '#/vandaag')}
    ${t(K.binnen.length, 'Inkomend vandaag', K.binnen.length ? K.binnen.map(c => c.leverancier || c.containernummer || '').filter(Boolean).slice(0, 2).join(', ') : 'geen container gepland', K.binnen.length ? 'oranje' : 'groen', '#/containers')}
  </div>`;
}

/* ---------- Dagstart ---------- */
// containerstap op de dag ten opzichte van de losdag: 0 = losdag, 1 = dag ervoor, 1–3 = vooraf
function contDagen(w){ w = String(w || '').toLowerCase(); if(/vooraf/.test(w)){ const m = w.match(/(\d+)\D+(\d+)/); return m ? [+m[1], +m[2]] : [1, 3]; } if(/ervoor/.test(w)) return [1, 1]; return [0, 0]; }
// sorteertijd voor tekst als "hele dag", "ochtend", "bij aankomst"
function sorteer(w, lostijd){
  const m = String(w || '').match(/(\d\d):(\d\d)/); if(m) return m[1] + ':' + m[2];
  w = String(w || '').toLowerCase();
  if(/hele dag/.test(w)) return '00:00'; if(/ochtend/.test(w)) return '07:45'; if(/aankomst/.test(w)) return /^\d\d:\d\d/.test(lostijd || '') ? lostijd.slice(0, 5) : '09:00';
  if(/einde dag/.test(w)) return '17:30'; if(/vooraf/.test(w)) return '09:00'; if(/ervoor/.test(w)) return '15:00'; return '99:99';
}
// ochtendoverleg en einde dag uit de aannames (d-01a, d-01b, d-10); de planning hoort er een half uur na het laatste overleg te staan
const OVERLEG = ['d-01a', 'd-01b'];
const delen = id => String(WHAAN.waarde(id) || '').split('·').map(s => s.trim());
const overlegTekst = () => OVERLEG.map(delen).filter(p => p[0]).map(p => p[0] + ' ' + p.slice(1).join(', ')).join(' en ');
function planningUiterlijk(){
  const m = OVERLEG.map(id => delen(id)[0].match(/^(\d\d):(\d\d)/)).filter(Boolean).map(x => +x[1] * 60 + +x[2] + 30);
  if(!m.length) return '09:30';
  const n = Math.max(...m); return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}
const opgeboekt = c => (c.voorboekingen || []).length > 0 || !!(D.TAKEN || {})['cc:' + c.id + ':opgeboekt'];
function ritme(){
  const vd = vandaag(), dagen = d => Math.round((new Date(d + 'T12:00') - new Date(vd + 'T12:00')) / 864e5);
  const conts = (D.CONT || []).filter(c => c.status !== 'afgerond' && c.losdatum && dagen(c.losdatum) >= 0 && dagen(c.losdatum) <= 3);
  const uit = [];
  WHAAN.LIJST.forEach(a => {
    const w = WHAAN.waarde(a.id), p = w.split('·').map(s => s.trim());
    if(/alleen maandag/i.test(w) && new Date().getDay() !== 1) return;   // bijv. de extra DHL Freight-afhaling van maandag
    const r = { id:a.id, wat:a.t, wanneer:p[0], wie:p.slice(1).join(' · ').replace(/\s*·?\s*alleen maandag/i, ''), cont:false };
    if(a.groep === 'Dagritme gewone dag'){ uit.push(Object.assign(r, { tijd:(p[0].match(/^(\d\d:\d\d)/) || [])[1] || '', sort:sorteer(p[0]) })); return; }
    if(a.groep !== 'Containerdag (extra)') return;
    const [van, tot] = contDagen(p[0]);
    conts.filter(c => { const d = dagen(c.losdatum); return d >= van && d <= tot; }).forEach(c => {
      const naam = c.leverancier || c.containernummer || 'container';
      let wie = r.wie;
      if(a.id === 'c-stock' && !opgeboekt(c)) wie += (wie ? ' · ' : '') + 'wacht op opboeken door Jim';
      uit.push(Object.assign({}, r, { id:a.id + (conts.length > 1 ? ':' + c.id : ''), wat:a.t + ' · ' + naam + (dagen(c.losdatum) ? ' (' + (dagen(c.losdatum) === 1 ? 'morgen' : 'over ' + dagen(c.losdatum) + ' dagen') + ')' : ''),
        wie, cont:true, tijd:(p[0].match(/(\d\d:\d\d)/) || [])[1] || '', sort:sorteer(p[0], c.lostijd) }));
    });
  });
  return uit.sort((a, b) => a.sort.localeCompare(b.sort));
}
function viewDag(){
  if(!S.dag) laadDag();
  const K = cijfers(), vd = vandaag(), dg = (S.dag || {})[vd] || {}, af = dg.af || {}, tn = tijdNu();
  const R = ritme(); const volgende = R.find(r => !af[r.id] && r.tijd && r.tijd >= tn) || null;
  const nAf = R.filter(r => af[r.id]).length;
  const tw = S.pd ? new Set(vraagLijst().map(q => q.c)).size : null;
  if(!S.pd) laadPd();
  return `<div class="pagina"><h1>Dagstart · ${esc(new Date().toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long' }))}</h1>
    <p class="lede">Zes cijfers, het ritme van de dag en het ochtendoverleg. Groen = op schema, oranje = let op, rood = nu iets doen. Grenzen en tijden staan onder Te controleren (aannames).</p>
    ${tegels(K)}
    <section class="blok"><div class="x-kop"><h2>Ritme van vandaag</h2><span class="small muted">${nf(nAf)} van ${nf(R.length)} gedaan${volgende ? ' · volgende: ' + esc(volgende.tijd) + ' ' + esc(volgende.wat) : ''}</span></div>
      <div class="x-ritme">${R.map(r => `<label class="${af[r.id] ? 'af' : ''}${volgende && volgende.id === r.id ? ' nu' : ''}"><input type="checkbox" id="x-r-${esc(r.id)}" data-x="ritme" data-id="${esc(r.id)}" ${af[r.id] ? 'checked' : ''}><span class="tijd">${esc(r.wanneer)}</span><span><span class="wat">${esc(r.wat)}</span>${r.cont ? ' <span class="x-abc">container</span>' : ''}<div class="wie">${esc(r.wie)}${af[r.id] ? ' · gedaan ' + esc(String(af[r.id].op || '').slice(11, 16)) + ' door ' + esc(af[r.id].door || '') : ''}</div></span><span></span></label>`).join('')}</div>
    </section>
    <section class="blok"><h2>Ochtendoverleg (${esc(overlegTekst())})</h2>
      <ul class="small" style="padding-left:18px;display:grid;gap:4px">
        <li>Oudste open picklijst: <b>${K.P && K.P.oudsteUur ? Math.round(K.P.oudsteUur) + ' uur' : '–'}</b> · urgent: <b>${K.P ? nf(K.P.urgent) : '–'}</b></li>
        <li>Backorders die met verplaatsen vrijkomen: <b>${K.B ? nf(K.B.vol) : '–'}</b> orders → <a href="#/aanvullive">Nu verplaatsen</a></li>
        <li>Inkomend vandaag: <b>${K.binnen.length ? K.binnen.map(c => esc((c.leverancier || '') + ' ' + (c.lostijd || ''))).join(', ') : 'niets gepland'}</b></li>
        <li>Producten op "geen specifieke locatie": <b>${nf(K.geen)}</b> (export ${esc(D.VRDATUM ? String(D.VRDATUM).slice(0, 10) : '–')})</li>
        <li>Te controleren voor Daan: <b>${tw === null ? '…' : nf(tw)}</b> producten · <a href="#/nakijken">openen</a></li>
      </ul>
      <label class="small" for="x-notitie"><b>Verdeling vandaag</b> (wie doet wat, prioriteiten, aandachtspunten)</label>
      <textarea id="x-notitie" class="x-notitie" placeholder="Bijv. Kate: containers + AD/AE · Sala: verzenden + CF · Valerii: Nu verplaatsen, daarna aanvulronde hal B">${esc(dg.notitie || '')}</textarea>
      <div class="x-kop"><span class="small muted">${dg.notitieOp ? 'Opgeslagen ' + esc(String(dg.notitieOp).slice(11, 16)) + ' door ' + esc(dg.notitieDoor || '') : 'Nog niet ingevuld'}</span><button class="x-btn pri" data-x="notitie">Opslaan</button></div>
    </section></div>`;
}
async function zetDag(patch){
  const vd = vandaag();
  S.dag = S.dag || {};
  const dg = Object.assign({}, S.dag[vd] || {}, patch);
  S.dag[vd] = dg;
  // alleen de laatste 21 dagen bewaren
  const weg = Object.keys(S.dag).filter(d => d < isoDag(Date.now() - 21 * 864e5));
  await WH.catPatch('wh-dag', Object.assign({ [vd]:dg }, Object.fromEntries(weg.map(d => [d, null]))));
}

/* ---------- Hoe staat het magazijn ervoor (management) ---------- */
function viewStand(){
  if(!S.dag) laadDag();
  if(!S.pd) laadPd();
  const K = cijfers(), vd = vandaag(), dg = (S.dag || {})[vd] || {}, gis = (S.dag || {})[isoDag(Date.now() - 864e5)] || {};
  let d04 = null; try{ d04 = window.WHTAAK && window.WHPD ? WHTAAK.data04() : null; if(!d04 && window.WHTAAK) WHTAAK.pdLaden().then(herteken); }catch(e){}
  const pdPct = d04 && d04.P.bel.length ? Math.floor((d04.P.bel.length - d04.open.length) / d04.P.bel.length * 100) : null;
  // locatie-aandachtspunten: telling uit wh/locaties.js (zonder besliste uitzonderingen en verwerkte besluiten)
  let locA = null; try{ const T = window.WHLOC ? WHLOC.telling() : null; if(T && T.geladen) locA = T.werk; else if(window.WHL && WHL.locStats){ const a = WHL.locStats().aand || {}; locA = Object.values(a).reduce((s, x) => s + (Array.isArray(x) ? x.length : 0), 0); } }catch(e){}
  const contN = (D.CONT || []).filter(c => c.status !== 'afgerond' && c.losdatum && c.losdatum >= vd && c.losdatum <= isoDag(Date.now() + 14 * 864e5));
  const tw = S.pd ? new Set(vraagLijst().map(q => q.c)).size : null;
  const daanOpen = Object.values(D.TODO || {}).filter(t => t && t.titel && !t.klaar && (t.wie || []).includes('Daan') && t.datum <= vd).length;
  const p = (nr, titel, meting, kl, uitleg, href) => `<div class="x-punt ${kl}"><span class="nr">${nr}</span><b>${esc(titel)}</b><span class="m">${meting}</span><span class="small muted">${uitleg}</span>${href ? `<a class="small" href="${href}">bekijken →</a>` : ''}</div>`;
  const geenBron = 'nog geen bron';
  return `<div class="pagina"><h1>Hoe staat het magazijn ervoor</h1>
    <p class="lede">De tien punten waarop Daan het magazijn beoordeelt, met het cijfer dat de app er nu over kan geven. Alleen lezen. Grijs = nog niet meetbaar.</p>
    ${tegels(K)}
    <div class="x-punten">
      ${p(1, 'Ochtend: planning staat', dg.notitie ? '✓ verdeeld' : '–', dg.notitie ? 'groen' : (tijdNu() > planningUiterlijk() ? 'oranje' : ''), dg.notitie ? 'Ochtendoverleg ingevuld om ' + esc(String(dg.notitieOp || '').slice(11, 16)) : 'Verdeling van vandaag nog niet ingevuld', '#/dag')}
      ${p(2, 'Picqer klopt: niets op geen specifieke locatie', nf(K.geen) + ' producten', kleur(K.geen, 'k-geen'), 'Voorraad op geen specifieke locatie (export ' + esc(D.VRDATUM ? String(D.VRDATUM).slice(0, 10) : '–') + ')' + (locA !== null ? ' · ' + nf(locA) + ' locatie-aandachtspunten' : ''), '#/locaties')}
      ${p(3, 'Verpakking en maatpallets op orde', '–', '', geenBron + ' (kennisbank E5)', '')}
      ${p(4, 'Vloer vrij en berijdbaar', (gis.af || {})['d-10'] ? '✓ gisteren' : '–', (gis.af || {})['d-10'] ? 'groen' : '', 'Einde-dag-check (' + esc(delen('d-10')[0]) + ') afgevinkt in Dagstart', '#/dag')}
      ${p(5, 'Pickers op prioriteit', K.P ? nf(K.P.urgent) + ' urgent open' : '–', K.P ? (K.P.urgent ? 'oranje' : 'groen') : '', 'Urgente picklijsten die nog open staan', '#/live')}
      ${p(6, 'Containerdag volgens plan', nf(contN.length) + ' in 14 dagen', contN.length ? '' : 'groen', contN.slice(0, 3).map(c => esc((c.losdatum || '').slice(5) + ' ' + (c.leverancier || ''))).join(' · ') || 'geen gepland', '#/containers')}
      ${p(7, 'Inrichting op logica', pdPct !== null ? pdPct + '% productdata' : '…', pdPct === null ? '' : pdPct >= 100 ? 'groen' : pdPct >= 85 ? 'oranje' : 'rood', 'Belangrijke producten met complete productdata (Poort 0.4)' + (locA !== null ? ' · ' + nf(locA) + ' locatie-aandachtspunten open' : '') + '; herindeling volgt na de analyses', '#/todo')}
      ${p(8, 'Verzenden juist verpakt', '–', '', geenBron + ' (kennisbank E6/E8)', '')}
      ${p(9, '12:00: orders ouder dan 12 uur verwerkt', K.P ? nf(K.P.o12) : '–', K.P ? kleur(K.P.o12, 'k-o12', K.na12 ? '' : 'voor12') : '', K.na12 ? 'Na 12:00 moet dit 0 zijn' : 'Telt vanaf 12:00', '#/live')}
      ${p(10, 'Daan managet in plaats van oplost', nf(daanOpen) + ' taken · ' + (tw === null ? '…' : nf(tw)) + ' te controleren', daanOpen + (tw || 0) ? 'oranje' : 'groen', 'Open taken voor Daan en wat hij nog moet nakijken', '#/nakijken')}
    </div></div>`;
}

/* ---------- Product zoeken (vloer) ---------- */
function zoekRes(q){
  q = String(q || '').trim().toLowerCase(); if(q.length < 2) return [];
  const exact = D.PLOW[q]; const uit = [];
  if(exact) uit.push(exact);
  for(const c of Object.keys(D.P)){
    if(uit.length >= 25) break;
    if(c === exact) continue;
    const p = D.P[c];
    if(c.toLowerCase().includes(q) || String(p.ean || '') === q || String(p.naam || '').toLowerCase().includes(q)) uit.push(c);
  }
  return uit.sort((a, b) => (a === exact ? -1 : b === exact ? 1 : 0) || (ABC[abcVan(a)] ?? 3) - (ABC[abcVan(b)] ?? 3));
}
function locs(c){
  const vr = D.VR[c] || { locs:{}, geen:0, cont:{} }, pick = [], bulk = [];
  Object.entries(vr.locs || {}).forEach(([l, n]) => (D.LOC[l] && D.LOC[l].bulk ? bulk : pick).push([l, n]));
  String((D.P[c] || {}).locaties_hm || '').split(/[,|]/).map(s => s.trim()).filter(l => l && !/^container/i.test(l)).forEach(l => {
    if(!pick.some(x => x[0] === l) && !bulk.some(x => x[0] === l)) (D.LOC[l] && D.LOC[l].bulk ? bulk : pick).push([l, 0]);
  });
  return { pick, bulk, geen:vr.geen || 0, kar:Object.entries(vr.cont || {}) };
}
function viewZoek(){
  const res = S.gekozen ? [] : zoekRes(S.zoek);
  let det = '';
  if(S.gekozen && D.P[S.gekozen]){
    const c = S.gekozen, p = D.P[c], L = locs(c), pd = (S.pd && S.pd[c] && S.pd[c].data) || D.PD[c] || {};
    const f = (k, t) => pd[k] ? `<li><span>${esc(t)}</span><b>${esc(pd[k])}</b></li>` : '';
    det = `<div class="x-kaart"><div class="x-kop"><div><span class="code">${esc(c)}</span>${p.abc ? `<span class="x-abc ${esc(p.abc)}">${esc(p.abc)}</span>` : ''}<div>${esc(pd.vn || p.naam || '')}</div><div class="small muted">${esc(p.naam || '')}${p.ean ? ' · EAN ' + esc(p.ean) : ''}</div></div><button class="x-btn" data-x="terug">← zoeken</button></div>
      <div><div class="small muted">Picklocatie</div><div class="x-loc">${L.pick.length ? L.pick.map(([l, n]) => `<span class="pick">${esc(l)} · ${nf(n)}</span>`).join('') : '<span>geen picklocatie</span>'}</div></div>
      <div><div class="small muted">Bulk en overige voorraad</div><div class="x-loc">${L.bulk.length ? L.bulk.map(([l, n]) => `<span>${esc(l)} · ${nf(n)}</span>`).join('') : (L.geen || L.kar.length ? '' : '<span>–</span>')}${L.geen ? `<span style="background:#fde2e1">geen specifieke locatie · ${nf(L.geen)}</span>` : ''}${L.kar.map(([l, n]) => `<span style="background:#fff2d6">${esc(l)} · ${nf(n)}</span>`).join('')}</div></div>
      <ul class="x-feit">${f('spd', 'Stuks per doos')}${f('spp', 'Stuks per pallet')}${f('maxpick', 'Max op pick')}${f('lvl', 'Aanvullen bij')}${f('opm', 'Let op')}</ul>
      <div class="small muted">Voorraad Hoofdmagazijn ${nf(p.voorraad_hm || 0)}${p.voorraad_vst ? ' · VST ' + nf(p.voorraad_vst) : ''} · locaties volgens export ${esc(D.VRDATUM ? String(D.VRDATUM).slice(0, 10) : '–')}</div>
      <b>Klopt er iets niet? Meld het (gaat naar Kate en Sala):</b>
      <div class="x-meld">
        <button class="x-btn" data-x="meld" data-v="Plek leeg">Plek leeg</button>
        <button class="x-btn" data-x="meld" data-v="Aantal klopt niet">Aantal klopt niet</button>
        <button class="x-btn" data-x="meld" data-v="Ligt op verkeerde plek">Verkeerde plek</button>
        <button class="x-btn" data-x="meld" data-v="Beschadigd">Beschadigd</button>
      </div></div>`;
  }
  return `<div class="pagina"><h1>Product zoeken</h1>
    <div class="x-zoek"><input id="x-zoek" type="search" inputmode="search" autocomplete="off" placeholder="Code, naam of EAN (scan)" value="${esc(S.zoek)}" aria-label="Zoek product"></div>
    ${det}
    ${!S.gekozen && S.zoek.trim().length >= 2 ? (res.length ? `<div class="x-res">${res.map(c => { const L = locs(c); return `<button data-x="kies" data-code="${esc(c)}"><b>${esc(c)}</b><span class="small">${esc(naamVan(c).slice(0, 80))}</span><span class="small muted">${L.pick.length ? 'pick ' + esc(L.pick.map(x => x[0]).join(', ')) : 'geen picklocatie'}${L.bulk.length ? ' · bulk ' + esc(L.bulk.slice(0, 3).map(x => x[0]).join(', ')) : ''}</span></button>`; }).join('')}</div>` : '<div class="leeg">Niets gevonden.</div>') : ''}
  </div>`;
}
async function meld(soort){
  const c = S.gekozen; if(!c) return;
  const L = locs(c), id = 'meld-' + Date.now().toString(36);
  const taak = { id, titel:soort + ': ' + c + (L.pick[0] ? ' (' + L.pick[0][0] + ')' : ''), noot:naamVan(c).slice(0, 80) + ' · gemeld via Product zoeken', wie:['Kate', 'Sala'], datum:vandaag(), tijd:'', herhaal:null, prio:1, door:ik(), op:new Date().toISOString(), klaar:null };
  D.TODO = Object.assign({}, D.TODO, { [id]:taak });
  try{ await WH.catPatch('wh-todo', { [id]:taak }); toast('Gemeld: ' + soort); }catch(e){ toast('Melden lukte niet'); }
}

/* ---------- Hulp: per rol wat je ziet en wat je doet ---------- */
const HULP = [
  { rol:'daan', t:'Daan', z:[
    'Je start op Te doen: de bouwplanstap van nu, wat vandaag moet, en bovenaan Te controleren met wat Claude heeft geschat of aangenomen.',
    'Tik bij Te controleren op Klopt of pas de waarde aan; bij Locaties tik je een tegel, beslis je per regel met één knop en ga je via Naar import altijd langs een verse export (maximaal 2 uur oud).',
    'Importbestanden upload je zelf in Picqer, de eerste keer per soort eerst het testbestand met 2 regels; de app schrijft nooit naar Picqer.'] },
  { rol:'karin', t:'Karin', z:[
    'Je start op Dagstart: zes kerncijfers (groen op schema, oranje let op, rood nu iets doen), het ritme van de dag en het ochtendoverleg.',
    'Vink in het ritme af wat gedaan is, zoals Van VST om 14:00 en op containerdag de Stockmove; bij Containers zie je wat er binnenkomt.',
    'Aanvullen en Product zoeken staan in het menu; wijzigingen doe je zelf in Picqer, de app leest alleen.'] },
  { rol:'vloer', t:'Vloer (Kate, Sala, Valerii, pickers)', z:[
    'Je start op Dagstart: de cijfers van vandaag en het ritme; na het ochtendoverleg (08:00 en 09:00) staat de verdeling van het werk in Verdeling vandaag.',
    'Rijders doen eerst Nu verplaatsen (wat een order vrijmaakt), dan de aanvulronde: eerst de retourkar terugzetten, en een volle pallet pakken waar dat bij het product staat.',
    'Klopt er iets niet, zoek het product op in Product zoeken en tik de meldknop; Kate en Sala krijgen dan een taak.'] },
  { rol:'mgmt', t:'Management (Jim, Maxime, Ryan, Gino)', z:[
    'Je start op Hoe staat het ervoor: de tien punten waarop Daan het magazijn beoordeelt, met het cijfer dat de app er nu over kan geven.',
    'Grijs is nog niet meetbaar, groen op schema, oranje let op, rood nu iets doen; bovenaan staan dezelfde zes kerncijfers als op Dagstart.',
    'Je kijkt alleen, je verandert niets; vragen of keuzes gaan naar Daan.'] }
];
function viewHulp(){
  let rol = 'daan'; try{ rol = localStorage.getItem('ivol-rol') || 'daan'; }catch(e){}
  const lijst = HULP.slice().sort((a, b) => (b.rol === rol) - (a.rol === rol));
  return `<div class="pagina"><h1>Hulp</h1>
    <p class="lede">Per rol in drie zinnen: wat je ziet en wat je doet. Kies je rol rechtsboven; die van jou staat bovenaan.</p>
    ${lijst.map(h => `<section class="blok"${h.rol === rol ? ' style="border-left:6px solid #f08a4b"' : ''}><h2>${esc(h.t)}${h.rol === rol ? ' <span class="x-abc">jouw rol</span>' : ''}</h2><ol class="stappen">${h.z.map(z => `<li>${esc(z)}</li>`).join('')}</ol></section>`).join('')}
    <section class="blok"><h2>Altijd zo</h2><ul class="small" style="padding-left:18px;display:grid;gap:4px">
      <li>De app leest alleen uit Picqer. Iets veranderen doe je in Picqer zelf, of met een importbestand dat Daan uploadt.</li>
      <li>Tijden in 24 uur. "Nieuwe versie klaar" bovenin: tik Vernieuwen als je niet aan het typen bent.</li>
      <li>Iets vreemds gezien? Meld het via Product zoeken of bij Daan.</li></ul></section></div>`;
}

/* ---------- tekenen en klikken ---------- */
function herteken(){
  if(!S.el || S.el.hidden) return;
  const actief = document.activeElement, id = actief && actief.id, pos = actief && actief.selectionStart;
  const y = S.el.scrollTop;
  S.el.innerHTML = S.naam === 'nakijken' ? viewNakijken() : S.naam === 'dag' ? viewDag() : S.naam === 'stand' ? viewStand() : S.naam === 'hulp' ? viewHulp() : viewZoek();
  S.el.scrollTop = y;
  if(id && $(id)){ const e = $(id); e.focus(); try{ if(pos != null) e.setSelectionRange(pos, pos); }catch(x){} }
}
function render(naam, el, rest){
  stijl();
  S.naam = naam; S.el = el; S.rest = rest || '';
  el.innerHTML = '<div class="leeg">Laden…</div>';
  // IVOL bestaat pas als ivol.js klaar is met opstarten; eerst de gedeelde gegevens (WH.load)
  (async () => { while(!window.IVOL) await new Promise(r => setTimeout(r, 50)); await IVOL.geladen(); })().then(() => Promise.all([window.WHAAN ? WHAAN.laad() : null])).then(() => {
    if(naam === 'zoek' && rest){ const c = D.PLOW[decodeURIComponent(rest).toLowerCase()]; if(c){ S.gekozen = c; S.zoek = c; } }
    if(['dag', 'stand'].includes(naam) && window.WHLIVE){ const st = WHLIVE.status(); if(st.code && !st.data && !st.laden) WHLIVE.laad(); }
    herteken();
    zaaiTaken();
  });
}
let gebonden = false;
function bind(){
  if(gebonden) return; gebonden = true;
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-x]'); if(!b || !S.el || !S.el.contains(b)) return;
    const x = b.dataset.x;
    try{
      if(x === 'tab'){ S.tab = b.dataset.v; herteken(); }
      else if(x === 'vsoort'){
        const kaart = b.closest('.x-vraag'), c = kaart.dataset.code, v = b.dataset.v;
        if(v === 'weg'){ S.wegOpen = true; herteken(); return; }
        const L = vraagLijst(), q = L.find(y => y.c === c && y.k === 'soort');
        const items = (kaart.dataset.famkaart || (S.fam && q && S.fam === q.fam + '|soort')) && q ? L.filter(y => y.fam === q.fam && y.k === 'soort' && !S.famUit.has(y.c)).map(y => ({ c:y.c, k:'soort', v })) : [{ c, k:'soort', v }];
        kaart.querySelectorAll('button').forEach(z => { z.disabled = true; });
        await pd2Zet(items); S.wegOpen = false; S.fam = null; S.famUit = new Set(); toast('Soort ' + soortTekst(v) + (items.length > 1 ? ' voor ' + items.length + ' producten' : ': ' + c)); herteken();
      }
      else if(x === 'vlaterfam'){ const kaart = b.closest('.x-vraag'), L = vraagLijst(), q = L.find(y => y.c === kaart.dataset.code && y.k === 'soort'); if(q) L.filter(y => y.fam === q.fam && y.k === 'soort').forEach(y => S.later.add(y.c + '|soort')); S.famUit = new Set(); S.wegOpen = false; herteken(); }
      else if(x === 'vfam'){ const kaart = b.closest('.x-vraag'), q = vraagLijst().find(y => y.c === kaart.dataset.code && y.k === kaart.dataset.k); if(!q) return; const key = q.fam + '|' + q.k; S.fam = S.fam === key ? null : key; S.famUit = new Set(); S.famAanpas = false; herteken(); }
      else if(x === 'famvink'){ if(b.checked) S.famUit.delete(b.dataset.code); else S.famUit.add(b.dataset.code); const kn = S.el.querySelector('[data-x="famklopt"]'); if(kn) kn.textContent = 'Klopt voor selectie (' + S.el.querySelectorAll('[data-x="famvink"]:checked').length + ')'; return; }
      else if(x === 'famaanpas'){ S.famAanpas = true; herteken(); const i2 = $('x-famin'); if(i2){ i2.focus(); i2.select(); } }
      else if(x === 'famklopt' || x === 'famopslaan'){
        const kaart = b.closest('.x-vraag'), k = kaart.dataset.k, L = vraagLijst(), q = L.find(y => y.c === kaart.dataset.code && y.k === k); if(!q) return;
        const sel = L.filter(y => y.fam === q.fam && y.k === k && !S.famUit.has(y.c)), inp = $('x-famin'), w = x === 'famopslaan' ? (inp ? inp.value.trim() : '') : null;
        if(x === 'famopslaan' && !w){ toast('Vul een waarde in'); return; }
        const items = sel.map(y => ({ c:y.c, k, v:w === null ? y.v : w })).filter(y => y.v);
        if(!items.length){ toast('Niets aangevinkt met een waarde'); return; }
        kaart.querySelectorAll('button').forEach(z => { z.disabled = true; });
        try{ await pd2Zet(items); toast(PD2VRAAG[k] + (w === null ? ' klopt' : ' ' + w) + ' voor ' + items.length + ' producten'); S.fam = null; S.famUit = new Set(); S.famAanpas = false; }
        catch(err){ toast('Opslaan mislukt: ' + (err.message || err)); }
        herteken();
      }
      else if(['vklopt', 'vopslaan'].includes(x)){
        const kaart = b.closest('.x-vraag'), c = kaart.dataset.code, k = kaart.dataset.k, inp = $('x-vin');
        const L = vraagLijst(), q = L.find(y => y.c === c && y.k === k); if(!q) return;
        const v = x === 'vopslaan' ? (inp ? inp.value.trim() : q.v) : q.v;
        if(!v){ toast('Vul een waarde in'); return; }
        const items = [{ c, k, v }];
        kaart.querySelectorAll('button').forEach(z => { z.disabled = true; });
        try{ await pd2Zet(items); S.aanpas = false; S.fam = null; S.famUit = new Set(); toast(items.length > 1 ? (PD2VRAAG[k] + ' ' + v + ' voor ' + items.length + ' producten') : c + ': ' + PD2VRAAG[k] + ' ' + v); }
        catch(err){ toast('Opslaan mislukt: ' + (err.message || err)); }
        herteken(); const i2 = $('x-vin'); if(i2) i2.focus();
      }
      else if(x === 'vaanpas'){ S.aanpas = true; herteken(); const i2 = $('x-vin'); if(i2){ i2.focus(); i2.select(); } }
      else if(x === 'vlater'){ const kaart = b.closest('.x-vraag'); S.later.add(kaart.dataset.code + '|' + kaart.dataset.k); S.aanpas = false; S.fam = null; S.famUit = new Set(); herteken(); }
      else if(x === 'een' || x === 'alles'){
        const kaart = b.closest('.x-kaart'), c = b.dataset.code, w = {};
        kaart.querySelectorAll('input[data-k]').forEach(i => { if(x === 'alles' ? i.dataset.open : i.dataset.k === b.dataset.k) w[i.dataset.k] = i.value; });
        b.disabled = true; await bevestig(c, w); toast(x === 'alles' ? c + ': alles bevestigd' : c + ': ' + (VELD[b.dataset.k] || b.dataset.k) + ' bevestigd'); herteken();
      }
      else if(x === 'later' || x === 'overbodig'){
        const c = b.dataset.code, k = b.dataset.k; b.disabled = true;
        await parkeer(c, k, x === 'later' ? 'Later, bij volgende levering berekenen' : 'Nu niet nodig');
        toast(c + ': ' + (VELD[k] || k) + ' geparkeerd'); herteken();
      }
      else if(x === 'aanok'){ const rij = b.closest('[data-aan]'); b.disabled = true; await WHAAN.zet(b.dataset.id, rij.querySelector('input').value.trim()); herteken(); }
      else if(x === 'aanterug'){ await WHAAN.terug(b.dataset.id); herteken(); }
      else if(x === 'notitie'){ b.disabled = true; await zetDag({ notitie:$('x-notitie').value, notitieOp:new Date().toISOString(), notitieDoor:ik() }); toast('Verdeling opgeslagen'); herteken(); }
      else if(x === 'kies'){ S.gekozen = b.dataset.code; herteken(); }
      else if(x === 'terug'){ S.gekozen = null; herteken(); const z = $('x-zoek'); if(z) z.focus(); }
      else if(x === 'meld'){ b.disabled = true; await meld(b.dataset.v); b.disabled = false; }
    }catch(err){ console.error(err); toast('Opslaan lukte niet: ' + (err.message || err)); b.disabled = false; }
  });
  document.addEventListener('change', async e => {
    const sw = e.target.closest && e.target.closest('[data-x2="soortwijzig"]');
    if(sw && S.el && S.el.contains(sw)){
      // soort wijzigen vanaf elke kaart (ook voor de aangevinkte familie-selectie); daarna vervallen vragen die niet meer bij de soort horen
      const v = sw.value; if(!v) return;
      const kaart = sw.closest('.x-vraag'), c = kaart.dataset.code, k = kaart.dataset.k, L = vraagLijst(), q = L.find(y => y.c === c && y.k === k);
      const codes = S.fam && q && S.fam === q.fam + '|' + k ? L.filter(y => y.fam === q.fam && y.k === k && !S.famUit.has(y.c)).map(y => y.c) : [c];
      try{ await pd2Zet(codes.map(x => ({ c:x, k:'soort', v }))); toast('Soort ' + soortTekst(v) + (codes.length > 1 ? ' voor ' + codes.length + ' producten' : ': ' + c)); }
      catch(err){ toast('Opslaan lukte niet: ' + (err.message || err)); }
      S.fam = null; S.famUit = new Set(); herteken(); return;
    }
    const i = e.target.closest('[data-x="ritme"]'); if(!i || !S.el || !S.el.contains(i)) return;
    const vd = vandaag(), af = Object.assign({}, ((S.dag || {})[vd] || {}).af || {});
    if(i.checked) af[i.dataset.id] = { op:new Date().toISOString().replace(/\.\d+Z$/, 'Z'), door:ik() }; else delete af[i.dataset.id];
    // tijd in Nederland voor de weergave
    if(af[i.dataset.id]){ const d = new Date(); af[i.dataset.id].op = isoDag(d.getTime()) + 'T' + tijdNu() + ':00'; }
    try{ await zetDag({ af }); }catch(err){ toast('Opslaan lukte niet'); }
    herteken();
  });
  document.addEventListener('input', e => {
    if(e.target.dataset && e.target.dataset.grens){ const g = e.target.closest('[data-aan]'); const s = g && g.querySelector('.x-grens'); if(s) s.textContent = WHAAN.grensTekst(e.target.value); return; }
    if(e.target.id !== 'x-zoek') return;
    S.zoek = e.target.value; S.gekozen = null;
    clearTimeout(S.zt); S.zt = setTimeout(herteken, 150);
  });
  document.addEventListener('keydown', e => {
    if(e.target.id === 'x-zoek' && e.key === 'Enter'){ const r = zoekRes(S.zoek); if(r.length){ S.gekozen = r[0]; herteken(); } }
  });
  if(window.WHLIVE) WHLIVE.opNieuw(() => { if(['dag', 'stand'].includes(S.naam)) herteken(); });
}
bind();
// banner bovenaan Te doen: wat er nog te controleren is (alleen als er iets is).
// Te doen tekent zichzelf geregeld opnieuw: een observer zet de banner er dan weer boven.
let bannerHtml = '', obs = null, bannerEl = null, bannerTel = { n:0, a:0 };
function zetBanner(el){
  if(!bannerHtml || !el || el.hidden || el.querySelector('#x-banner')) return;
  if(!window.IVOL || (IVOL.huidig() || {}).id !== 'todo') return;
  const d = document.createElement('div'); d.id = 'x-banner'; d.innerHTML = bannerHtml; el.prepend(d);
}
// open taken uit de masteropdracht (wegzetten, bulklocatie in Picqer): bovenaan Te doen, met een knop Gedaan
function takenHtml(){
  const t = Object.values(D.TODO || {}).filter(x => x && x.id && /^zaai-/.test(x.id) && x.titel && !x.klaar);
  if(!t.length) return '';
  return `<div class="pagina" style="padding-bottom:0"><div class="x-kaart" style="border-left:6px solid #1d4ea0"><div class="x-kop"><b>Taken</b><span class="small muted">${nf(t.length)} open</span></div>
    ${t.map(x => `<div class="x-kop" style="border-top:1px solid #eef1f5;padding-top:8px"><div style="min-width:0"><b>${esc(x.titel)}</b><div class="small muted">${esc((x.wie || []).join(' · '))}${x.noot ? ' · ' + esc(x.noot) : ''}</div></div><button class="x-btn ok" data-xt="klaar" data-id="${esc(x.id)}">Gedaan</button></div>`).join('')}</div></div>`;
}
function maakBanner(){
  const { n, a } = bannerTel;
  bannerHtml = (n + a ? `<div class="pagina" style="padding-bottom:0"><a class="x-kaart" href="#/nakijken" style="text-decoration:none;color:inherit;border-left:6px solid #e0a100"><div class="x-kop"><div><b>Te controleren</b><div class="small muted">${n ? nf(n) + ' producten met een schatting van Claude of een waarde tegen een regel in' : ''}${n && a ? ' · ' : ''}${a ? nf(a) + ' aannames (kerncijfers, dagritme, regels)' : ''}. Tik Klopt of pas aan; tot dan tellen ze als open.</div></div><span class="x-btn pri">Openen →</span></div></a></div>` : '') + takenHtml();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-xt="klaar"]'); if(!b) return;
  const t = (D.TODO || {})[b.dataset.id]; if(!t) return;
  b.disabled = true;
  try{
    await WH.catPatch('wh-todo', { [t.id]:Object.assign({}, t, { klaar:{ op:new Date().toISOString(), door:ik() } }) });
    maakBanner();
    const oud = document.getElementById('x-banner'); if(oud) oud.remove();
    zetBanner(bannerEl);
  }catch(err){ console.error(err); b.disabled = false; }
});
async function banner(el){
  try{
    await (async () => { while(!window.IVOL) await new Promise(r => setTimeout(r, 50)); await IVOL.geladen(); })();
    await Promise.all([window.WHAAN ? WHAAN.laad() : null, laadPd()]);
    await zaaiTaken();   // eenmalig: de taken uit de masteropdracht 17-10
    bannerTel = { n:new Set(vraagLijst().map(q => q.c)).size, a:window.WHAAN ? WHAAN.open().length : 0 };
    stijl();
    bannerEl = el; maakBanner();
    zetBanner(el);
    if(!obs && window.MutationObserver){ obs = new MutationObserver(() => zetBanner(el)); obs.observe(el, { childList:true }); }
  }catch(e){ console.error(e); }
}
return { render, herteken, twLijst, vraagLijst, laadPd, cijfers, banner, S };
})();
