/* =====================================================================
   IVOL Warehouse 3.0 — Te doen in tabs: de controleronde (08-11-2026)
   Per categorie een tab met alles wat nog aandacht nodig heeft, live uit productdata en Picqer (zelfde data als Productdata 2.0):
     1 Overzicht (Claudes analyse) · 2 Later · 3 Picklocaties · 4 Bulklocaties · 5 Hercontrole · 6 Gewicht controleren · 7 Te wegen · 8 Aantal per pallet
   Alleen producten met een bevestigde soort, nooit SAM Europe, A/B eerst, per familie. Claude stelt voor, Daan beslist met één tik; niets wordt
   zelf gewijzigd. "Klopt zo" wordt onthouden (catalog-rij wh-controle-klopt) en komt pas terug als de data verandert. Elke schrijfactie maakt eerst
   een kopie (wh-kopie-productdata-<datum>-8 voor productdata; <rij>-kopie-<datum> voor eigen rijen). Picqer: alleen lezen — locaties koppelen en
   ontkoppelen doet Daan zelf in Picqer, de app maakt de lijst.
   ===================================================================== */
window.WHCP = (function(){
'use strict';
const { esc, nf, num } = WH;
const R = () => window.PD2R;
const KL = 'wh-controle-klopt', RE = 'wh-controle-reacties', SP = 'wh-controle-steekproef';
const TABS = [['overzicht', 'Overzicht'], ['later', 'Later'], ['picklocaties', 'Picklocaties'], ['bulklocaties', 'Bulklocaties'], ['hercontrole', 'Hercontrole'], ['gewicht', 'Gewicht controleren'], ['tewegen', 'Te wegen'], ['aantal', 'Aantal per pallet']];
const S = { klopt:{}, reacties:[], steek:null, klaar:false, p:null, memo:null, memoKey:'', hal:'', ged:'', gang:'', uit:{}, keuze:{}, q:Promise.resolve(), open:null };
const SOORTT = { pallet:'Pallet', deel:'Deel', bulk:'Bulk', pick:'Pick', mix:'Mix', weg:'Weg' };
const nu = () => new Date().toISOString();
const dt = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.getDate() + '-' + (d.getMonth() + 1) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const fmtKg = x => String(Math.round(x * 1000) / 1000).replace('.', ',');
const rang = a => a === 'A' ? 0 : a === 'B' ? 1 : 2;
const mediaan = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };

/* ---------- opslag ---------- */
function laad(vers){
  if(S.p && !vers) return S.p;
  S.p = Promise.all([WH.catHaal(KL), WH.catHaal(RE), WH.catHaal(SP)]).then(([k, r, s]) => {
    S.klopt = (k && k.data && k.data.items) || {}; S.reacties = (r && r.data && r.data.lijst) || []; S.steek = (s && s.data) || null; S.klaar = true; S.memo = null;
  }).catch(e => { console.error(e); S.klaar = true; });
  return S.p;
}
// schrijven met kopie vooraf en samenvoegen met de nieuwste versie (een ander apparaat overschrijft niets)
function schrijfRij(key, lees, pas){
  S.q = S.q.catch(() => {}).then(async () => {
    const r = await WH.catHaal(key).catch(() => null), data = (r && r.data) || {};
    if(r && r.data) await WH.catZet(key + '-kopie-' + WH.isoDag(), r.data);
    const nieuw = pas(JSON.parse(JSON.stringify(data))); await WH.catZet(key, nieuw); return nieuw;
  }).catch(e => { console.error(e); WH.toast('Bewaren lukte niet: ' + (e.message || e), 6000); });
  return S.q;
}
function zetKlopt(cat, c, opm, sig, extra){
  const e = Object.assign({ op:nu(), opm:opm || '', sig:sig || '' }, extra || {});
  S.klopt[cat + '|' + c] = e; S.memo = null;
  return schrijfRij(KL, null, d => { d.items = d.items || {}; d.items[cat + '|' + c] = e; return d; });
}
// Later vanuit een tab: verborgen tot de data verandert, en zichtbaar in de tab Later
const laterTabs = () => Object.entries(S.klopt).filter(([, v]) => v.later).map(([k, v]) => { const i = k.indexOf('|'); return { cat:k.slice(0, i), c:k.slice(i + 1), op:v.op, opm:v.opm }; });
function zetKloptMeer(cat, lijst, opm, extra){
  const t = nu(); lijst.forEach(x => { S.klopt[cat + '|' + x.c] = Object.assign({ op:t, opm:opm || '', sig:x.sig || '' }, extra || {}); }); S.memo = null;
  return schrijfRij(KL, null, d => { d.items = d.items || {}; lijst.forEach(x => { d.items[cat + '|' + x.c] = Object.assign({ op:t, opm:opm || '', sig:x.sig || '' }, extra || {}); }); return d; });
}
function weesKlopt(cat, c){ delete S.klopt[cat + '|' + c]; S.memo = null; return schrijfRij(KL, null, d => { d.items = d.items || {}; delete d.items[cat + '|' + c]; return d; }); }
const isKlopt = (cat, c, sig) => { const k = S.klopt[cat + '|' + c]; return !!k && k.sig === (sig || ''); };

/* ---------- gegevens per product ---------- */
const fam = c => { try{ return window.WHPD.index().fam[R().famVan(c)] || []; }catch(e){ return []; } };
const bruikbaar = c => { try{ return R().actief(c) && !R().isKoppel(c) && !R().isSam(c); }catch(e){ return false; } };
const ribbel = c => { try{ return !!WHPD.intern.ribbelMaat(c); }catch(e){ return false; } };   // ribbel op maat: eigen pallet-indeling en gewicht per lengte
const naam = c => (WH.D.P[c] || {}).naam || '';
const abc = c => { try{ return R().abcVan(c) || ''; }catch(e){ return ''; } };
const kleurgenoten = c => { const mk = R().maatVan(c); return fam(c).filter(x => x !== c && bruikbaar(x) && R().maatVan(x) === mk && (mk !== '' || basis(x) === basis(c))); };
const basis = c => { const d = String(naam(c)).toLowerCase().split(' - '); return (d.length >= 2 ? d.slice(0, -1) : d).join(' - ').trim(); };
const soortVan = c => { try{ const s = R().status(c); return s.stap.soort ? s.so : ''; }catch(e){ return ''; } };
const vastePick = c => { try{ return (R().locInfo(c).pick || []).filter(x => !x.tijd).map(x => x.n); }catch(e){ return []; } };
const bulkLocs = c => { try{ return (R().locInfo(c).bulk || []).filter(x => x.v > 0).map(x => x.n); }catch(e){ return []; } };
/* hallen: er zijn er drie, A, B en C. Hal C heeft twee stellingdelen: gedeelte C (gangen C..) en gedeelte D (gangen D..). Geen hal D. */
const HALLEN = ['A', 'B', 'C'];
const halGang = n => { const m = String(n || '').match(/^([A-Z])([A-Z])/i); if(!m) return { hal:'', ged:'', gang:'' }; const l = m[1].toUpperCase(); return { hal:l === 'D' ? 'C' : l, ged:l === 'C' || l === 'D' ? l : '', gang:(m[1] + m[2]).toUpperCase() }; };
let GC = null;
function gangenLijst(){ const loc = WH.D.LOC || {}; if(GC && GC.van === loc) return GC.l; const set = new Set(); Object.keys(loc).forEach(n => { if(/^[A-Z]{2}\d{2}[A-D]\d{2}$/.test(n)) set.add(n.slice(0, 2)); }); const l = [...set].sort().map(g => halGang(g)).filter(x => HALLEN.includes(x.hal)); GC = { van:loc, l }; return l; }
// een eerder bewaarde pickwens lezen in de nieuwe vorm: hal D bestaat niet meer (= hal C, gedeelte D); er wordt niets herschreven
const wensN = w => { const g = halGang(w.gang || ''), hal = w.hal === 'D' ? 'C' : (w.hal || g.hal); return { hal, ged:hal === 'C' ? (w.ged || (w.hal === 'D' ? 'D' : g.ged)) : '', gang:String(w.gang || '').toUpperCase(), opm:w.opm || '' }; };
const wensHg = w => { const n = wensN(w); return { hal:n.hal, ged:n.ged, gang:n.gang }; };
// voorstel voor een familie: de gang waar de familie of de kleurgenoten nu al pick, bulk of een pickwens hebben
function gangVoorstel(items){
  const tel = {}, cod = new Set(); items.forEach(x => fam(x.c).forEach(y => cod.add(y)));
  cod.forEach(y => { if(!bruikbaar(y)) return; vastePick(y).concat(bulkLocs(y)).forEach(n => { const g = halGang(n); if(g.gang) tel[g.gang] = (tel[g.gang] || 0) + 1; }); const w = pickwens(y); if(w){ const g = wensN(w); if(g.gang) tel[g.gang] = (tel[g.gang] || 0) + 1; } });
  const top = Object.entries(tel).sort((a, b) => b[1] - a[1])[0]; if(!top) return null;
  const g = halGang(top[0]); return { hal:g.hal, ged:g.ged, gang:g.gang, reden:'Voorstel: ' + hgTekst(g) + ' — daar hebben ' + top[1] + ' producten van deze familie al pick, bulk of een pickwens' };
}
const eigen = (c, k) => { const w = R().waarde(c, k, R().info(c)); return w && w.v !== '' && w.v !== undefined && ['bevestigd', 'aangepast', 'vastgelegd'].includes(w.st) ? w.v : null; };
const kg = c => { try{ const g = R().gewicht(c); return g.kg > 0 ? g.kg : g.pq > 0 ? g.pq : null; }catch(e){ return null; } };
const pdRij = c => { try{ return WHPD.S.pd[c] || {}; }catch(e){ return {}; } };
const pickwens = c => { const d = (pdRij(c).data || {}).pickwens; return d && typeof d === 'object' ? d : null; };
const moetPick = c => { const d = pdRij(c).data || {}; if(/moet/i.test(String(d.pickkeuze || ''))) return true; try{ const w = R().waarde(c, 'pickc', R().info(c)); return !!w && w.v === 'moetpick'; }catch(e){ return false; } };

/* ---------- de categorieën ---------- */
function berekenen(){
  const P = R(), uit = { picklocaties:[], pickklaar:[], bulklocaties:[], bulkeraf:[], hercontrole:[], gewicht:[], tewegen:[], aantal:[] };
  const codes = Object.keys(WH.D.P).filter(c => bruikbaar(c) && soortVan(c));
  codes.forEach(c => {
    const so = soortVan(c), a = abc(c), item = (cat, extra) => Object.assign({ c, cat, naam:naam(c), fam:P.famNaam(P.famVan(c)), abc:a, so }, extra);
    const pick = vastePick(c);
    // 3 Picklocaties: Pallet of Deel zonder picklocatie in Picqer, en alles met "moet pick krijgen"
    if(!pick.length && (['pallet', 'deel'].includes(so) || moetPick(c))){
      const w = pickwens(c);
      // beslist (pickwens bewaard) = weg uit de open lijst; het product staat dan op de werklijst "Klaar voor Picqer" tot Picqer klopt
      uit[w ? 'pickklaar' : 'picklocaties'].push(item(w ? 'pickklaar' : 'picklocaties', { reden:moetPick(c) ? 'Keuze "moet pick krijgen", nog geen picklocatie in Picqer' : SOORTT[so] + ' zonder picklocatie in Picqer', wens:w, sig:'p', loc:bulkLocs(c)[0] || '' }));
    }
    // 4 Bulklocaties: soort Bulk maar met een picklocatie in Picqer
    if(so === 'bulk' && pick.length){
      const loc = pick[0], sig = pick.join(',');
      if(S.klopt['bulkeraf|' + c]) uit.bulkeraf.push(item('bulkeraf', { reden:'Picklocatie eraf in Picqer', loc, sig }));
      else uit.bulklocaties.push(item('bulklocaties', { reden:'Soort Bulk, maar Picqer heeft picklocatie ' + pick.join(', '), loc, sig }));
    }
    // 5 Hercontrole
    const her = (reden, voorstel, extra) => uit.hercontrole.push(item('hercontrole', Object.assign({ reden, voorstel, sig:reden + '|' + JSON.stringify(voorstel || {}) }, extra)));
    let bulkV = 0, vst = 0; try{ const f = P.locInfo(c); bulkV = (f.bulk || []).reduce((s, x) => s + (x.v || 0), 0); vst = f.vst || 0; }catch(e){}
    if(so === 'pick' && (bulkV > 0 || vst > 0)) her('Soort Pick, maar er ligt ' + (bulkV > 0 ? nf(bulkV) + ' op bulk' : '') + (bulkV > 0 && vst > 0 ? ' en ' : '') + (vst > 0 ? nf(vst) + ' in VST' : '') + ' (Pick = kleine hoeveelheden, geen bulk)', { soort:'deel', tekst:'Voorstel: Deel' });
    if(so === 'weg' && num((WH.D.P[c] || {}).voorraad_hm) > 0) her('Soort Weg, maar er ligt ' + nf(num((WH.D.P[c] || {}).voorraad_hm)) + ' op een locatie', { soort:'pick', tekst:'Voorstel: Pick (of Deel als het per pallet komt)' });
    const h = num(eigen(c, 'hoogte'));
    if(h > 0 && h % 10 !== 0) her('Hoogte ' + h + ' cm staat niet op 10 cm', { veld:'hoogte', waarde:String(Math.ceil(h / 10) * 10), tekst:'Voorstel: ' + Math.ceil(h / 10) * 10 + ' cm (naar boven op 10 cm)' });
    const gl = kleurgenoten(c).filter(x => soortVan(x) && !ribbel(x));
    ['maat', 'hoogte'].forEach(k => {
      const mijn = eigen(c, k); if(!mijn || gl.length < 2) return;
      const ander = gl.map(x => eigen(x, k)).filter(Boolean); if(ander.length < 2) return;
      const tel = {}; ander.forEach(v => { tel[v] = (tel[v] || 0) + 1; });
      const [top, n] = Object.entries(tel).sort((x, y) => y[1] - x[1])[0];
      if(String(top) !== String(mijn) && n >= 2 && n > ander.length / 2) her('Kleurgenoten hebben ' + (k === 'maat' ? 'palletmaat' : 'hoogte') + ' ' + top + ' (' + n + ' van ' + ander.length + '), dit product ' + mijn, { veld:k, waarde:String(top), tekst:'Voorstel: ' + top + (k === 'hoogte' ? ' cm' : '') });
    });
    if(PALL.includes(so)){
      const vp = volleCalc(c);
      if(vp && vp > 1500) her('Volle pallet ' + nf(vp) + ' kg is boven 1.500 kg (kg per stuk ' + fmtKg(kg(c)) + ' × ' + nf(num(eigen(c, 'spp'))) + ' per pallet + 15)', null, { tekstVoorstel:'Controleer het gewicht per stuk of het aantal per pallet' });
      if(vp && vp < 50) her('Volle pallet ' + nf(vp) + ' kg is onder 50 kg (kg per stuk ' + fmtKg(kg(c)) + ' × ' + nf(num(eigen(c, 'spp'))) + ' per pallet + 15)', null, { tekstVoorstel:'Controleer het gewicht per stuk of het aantal per pallet' });
    }
    const andere = [...new Set(gl.map(soortVan))].filter(x => x && x !== so);
    if(andere.length && gl.length >= 2 && gl.filter(x => soortVan(x) === andere[0]).length > gl.length / 2) { const dv = verkoopGelijk(c, gl); if(dv) her('Kleurgenoten hebben soort ' + SOORTT[andere[0]] + ', dit product ' + SOORTT[so] + ' (verkoop is vergelijkbaar)', { soort:andere[0], tekst:'Voorstel: ' + SOORTT[andere[0]] }); }
    // 6 Gewicht controleren
    const gw = ribbel(c) ? null : gewichtVoorstel(c, gl); if(gw) uit.gewicht.push(item('gewicht', gw));
    // 7 Te wegen
    try{ if(P.gewicht(c).st === 'tewegen') uit.tewegen.push(item('tewegen', { reden:'Gewicht staat op te wegen', loc:(pick[0] || bulkLocs(c)[0] || ''), sig:'w' })); }catch(e){}
    // 8 Aantal per pallet
    if(PALL.includes(so) && !ribbel(c)){
      const mijn = eigen(c, 'spp');
      if(mijn){
        const ander = gl.map(x => ({ c:x, v:eigen(x, 'spp') })).filter(x => x.v);
        if(ander.length >= 1){ const tel = {}; ander.forEach(x => { tel[x.v] = (tel[x.v] || 0) + 1; }); const [top, n] = Object.entries(tel).sort((x, y) => y[1] - x[1])[0];
          if(String(top) !== String(mijn)) uit.aantal.push(item('aantal', { reden:'Kleurgenoten hebben ' + nf(num(top)) + ' per pallet (' + n + ' van ' + ander.length + '), dit product ' + nf(num(mijn)), voorstel:{ veld:'spp', waarde:String(top), tekst:'Voorstel: ' + nf(num(top)) + ' per pallet' }, sig:mijn + '|' + top })); }
        try{ const lab = WHPD.intern.oudeWaarde(c, 'spp'); if(lab && lab.v && !lab.conflict && String(num(lab.v)) !== String(num(mijn))) uit.aantal.push(item('aantal', { reden:'Palletlabel (productgeheugen) zegt ' + nf(num(lab.v)) + ' per pallet, productdata ' + nf(num(mijn)), voorstel:{ veld:'spp', waarde:String(num(lab.v)), tekst:'Voorstel: ' + nf(num(lab.v)) + ' per pallet (zoals het palletlabel)' }, sig:'lab|' + mijn + '|' + lab.v })); }catch(e){}
      }
    }
  });
  const sorteer = l => l.sort((x, y) => rang(x.abc) - rang(y.abc) || x.fam.localeCompare(y.fam, 'nl', { numeric:true }) || x.c.localeCompare(y.c));
  Object.keys(uit).forEach(k => sorteer(uit[k]));
  // "Klopt zo" onthouden: alleen terug als de data verandert (sig verandert)
  Object.keys(uit).forEach(k => { if(k !== 'bulkeraf' && k !== 'pickklaar') uit[k] = uit[k].filter(x => !isKlopt(k, x.c, x.sig)); });
  uit.tewegen.sort((x, y) => (halGang(x.loc).gang || 'ZZ').localeCompare(halGang(y.loc).gang || 'ZZ') || String(x.loc).localeCompare(String(y.loc)));
  return uit;
}
const PALL = ['pallet', 'deel', 'bulk'];
function volleCalc(c){ const k = kg(c), s = num(eigen(c, 'spp')); return k > 0 && s > 0 ? Math.ceil(k * s + 15) : null; }
// verkoop vergelijkbaar (binnen 3×): dan verklaart verkoop het verschil in soort niet
function verkoopGelijk(c, gl){ const v = R().vk28(c) || 0, w = mediaan(gl.map(x => R().vk28(x) || 0)) || 0; return v === 0 || w === 0 || (v / w < 3 && w / v < 3); }
// 6: gewicht wijkt af van kleurgenoten (>25%) of familie (>3×), of "vertrouwd" terwijl Picqer geen gewicht heeft; Claude stelt een gewicht voor
function gewichtVoorstel(c, gl){
  const P = R(); let g; try{ g = P.gewicht(c); }catch(e){ return null; }
  if(g.st === 'tewegen' || g.st === 'gewogen') return null;
  const mijn = g.kg > 0 ? g.kg : g.pq > 0 ? g.pq : null;
  const metKg = x => { const k = kg(x); return k > 0 ? { c:x, kg:k } : null; };
  const kl = gl.map(metKg).filter(Boolean), lv = fam(c).filter(x => x !== c && bruikbaar(x)).map(metKg).filter(Boolean);
  const mk = kl.length >= 2 ? mediaan(kl.map(x => x.kg)) : kl.length === 1 ? kl[0].kg : null, mf = lv.length >= 2 ? mediaan(lv.map(x => x.kg)) : null;
  if(!(g.pq > 0) && g.st !== 'niet'){ const v = mk || mf; if(v) return { reden:'Gewicht ' + (g.st === 'vertrouwd' ? 'is vertrouwd' : 'staat') + ' terwijl Picqer geen gewicht heeft', voorstel:{ kg:v, tekst:'Voorstel: ' + fmtKg(v) + ' kg ' + (mk ? 'zoals de kleurgenoten' : 'naar de familie') }, sig:'geenpq|' + (mijn || '') }; }
  if(!(g.pq > 0) && g.st === 'niet' && (mk || mf)) return { reden:'Picqer heeft geen gewicht', voorstel:{ kg:mk || mf, tekst:'Voorstel: ' + fmtKg(mk || mf) + ' kg ' + (mk ? 'zoals de kleurgenoten' : 'naar de familie') }, sig:'geenpq|' };
  if(mijn && mk && kl.length >= 1 && Math.abs(mijn - mk) / mk > 0.25) return { reden:'Gewicht ' + fmtKg(mijn) + ' kg wijkt ' + Math.round(Math.abs(mijn - mk) / mk * 100) + '% af van de kleurgenoten (' + fmtKg(mk) + ' kg)', voorstel:{ kg:mk, tekst:'Voorstel: ' + fmtKg(mk) + ' kg zoals de andere kleuren (nu ' + fmtKg(mijn) + ')' }, sig:'kl|' + mijn + '|' + mk };
  if(mijn && mf && (mijn / mf > 3 || mijn / mf < 1 / 3) && !meeMetLengte(c)) return { reden:'Gewicht ' + fmtKg(mijn) + ' kg is meer dan 3× anders dan de familie (' + fmtKg(mf) + ' kg)', voorstel:{ kg:mf, tekst:'Voorstel: ' + fmtKg(mf) + ' kg naar de familie (nu ' + fmtKg(mijn) + ')' }, sig:'fam|' + mijn + '|' + mf };
  return null;
}
// gewicht loopt mee met lengte of maat (rollen, matten per meter): daar verschilt het gewicht terecht per product
const meeMetLengte = c => /\b\d+\s*(m|cm|mm)\b|\bx\s*\d+|rol|per meter|\d+x\d+/i.test(naam(c)) && fam(c).length > 1;

function cats(){
  const R_ = R(); if(!R_ || !R_.S.klaar || !S.klaar) return null;
  const key = R_.S.ver + '|' + R_.S.dataVer + '|' + Object.keys(S.klopt).length + '|' + Object.values(WHPD.S.pd || {}).filter(r => r && r.data && r.data.pickwens).length + '|' + (window.WHTAAK && WHTAAK.later ? Object.keys(WHTAAK.later.items()).length : 0);
  if(S.memo && S.memoKey === key) return S.memo;
  S.memo = berekenen(); S.memoKey = key; return S.memo;
}
function tel(){
  const c = cats(); if(!c) return null;
  const l = window.WHTAAK && WHTAAK.later ? WHTAAK.later.lijst().length : 0;
  return { overzicht:1, later:l + laterTabs().length, picklocaties:c.picklocaties.length, bulklocaties:c.bulklocaties.length, klaar:{ picklocaties:c.pickklaar.length, bulklocaties:c.bulkeraf.length }, hercontrole:c.hercontrole.length, gewicht:c.gewicht.length, tewegen:c.tewegen.length, aantal:c.aantal.length };
}

/* ---------- acties (alleen voorstellen; Daan beslist met één tik; kopie vooraf) ---------- */
async function kopie(codes){ try{ return await R().kopieProductdata(codes, 8); }catch(e){ WH.toast('Kopie van productdata maken lukte niet: niets vastgelegd (' + (e.message || e) + ')', 6000); return null; } }
async function neemOver(it){ return neemOverMeer([it]); }
async function neemOverMeer(lijst){
  const P = R(); if(!lijst.length || !(await kopie(lijst.map(x => x.c)))) return false;
  const t = nu();
  lijst.forEach(it => { const c = it.c, v = it.voorstel || {};
    if(v.soort){ const voor = P.soortWaarde(c, P.info(c)).v; P.poZet(c, p => { delete p.heropend; p.so = { v:v.soort, st:'aangepast', voor, t, door:'Daan' }; if(v.soort !== 'weg') delete p.weg; }); }
    else if(v.veld){ const voor = String(P.waarde(c, v.veld, P.info(c)).v || ''); P.poZet(c, p => { delete p.heropend; p.f[v.veld] = { v:String(v.waarde), st:'aangepast', voor, t, door:'Daan' }; }); }
    else if(v.kg){ P.poZet(c, p => { delete p.heropend; p.gew = { st:'vertrouwd', kg:v.kg, t, door:'Daan', via:'controle' }; }); } });
  try{ P.flush && P.flush(); }catch(e){}
  S.memo = null; return true;
}
// soort kiezen voor de aangevinkte producten ("Andere soort" / "Fout, wordt"); Weg krijgt zijn keuze mee
async function zetSoort(codes, so, weg){
  const P = R(); if(!codes.length || !(await kopie(codes))) return false; const t = nu();
  codes.forEach(c => { const voor = P.soortWaarde(c, P.info(c)).v; P.poZet(c, p => { delete p.heropend; p.so = { v:so, st:'aangepast', voor, t, door:'Daan' }; if(so === 'weg') p.weg = { v:weg || 'uitlopend', st:'aangepast', voor:'', t }; else delete p.weg; }); });
  try{ P.flush && P.flush(); }catch(e){}
  S.memo = null; return true;
}
async function naarTeWegen(c){ const l = [].concat(c); if(!(await kopie(l))) return; l.forEach(x => R().poZet(x, p => { delete p.heropend; p.gew = { st:'tewegen', t:nu(), door:'Daan' }; })); try{ R().flush(); }catch(e){} S.memo = null; }
async function gewogen(c, kgw){ if(!(await kopie([c]))) return; R().poZet(c, p => { delete p.heropend; p.gew = { st:'gewogen', kg:kgw, t:nu(), door:'Daan' }; }); try{ R().flush(); }catch(e){} S.memo = null; }
async function bewaarPickwens(codes, w){
  codes = [].concat(codes); if(!(await kopie(codes))) return false;
  const t = nu(), rijen = [];
  for(const c of codes){
    const vers = await WH.api('GET', 'productdata?productcode=eq.' + encodeURIComponent(c) + '&select=productcode,data,meta');
    const rij = (vers && vers[0]) || { productcode:c, data:{}, meta:{} };
    const data = Object.assign({}, rij.data), meta = Object.assign({}, rij.meta);
    if(w){ data.pickwens = { hal:w.hal, ged:w.hal === 'C' ? w.ged : '', gang:w.gang, opm:w.opm || '' }; meta.pickwens = { op:t, bron:'pd2', uit:'Te doen · Picklocaties' }; } else { delete data.pickwens; delete meta.pickwens; }
    rijen.push({ productcode:c, data, meta, updated_at:t });
  }
  await WH.upsert('productdata', rijen, 'productcode');
  rijen.forEach(r => { try{ WHPD.S.pd[r.productcode] = { data:r.data, meta:r.meta, t }; }catch(e){} });
  S.memo = null; return true;
}

/* ---------- weergave: per familie (en maat) één kaart, alles aangevinkt, één vraag, "Selectie is: …" ---------- */
const alle = () => cats();
const maatLabel = c => { try{ return R().maatVan(c) || ''; }catch(e){ return ''; } };
const gKey = (x, metMaat) => x.fam + (metMaat !== false && maatLabel(x.c) ? ' · ' + maatLabel(x.c) : '');
function groepen(lijst, metMaat){ const per = new Map(); lijst.forEach(x => { const k = gKey(x, metMaat); if(!per.has(k)) per.set(k, []); per.get(k).push(x); }); return [...per.entries()]; }
const uitgevinkt = x => !!S.uit[x.cat + '|' + x.c];
const gekozenVan = items => items.filter(x => !uitgevinkt(x));
const locTekst = x => x.loc ? ' · <code>' + esc(x.loc) + '</code>' : '';
const hgTekst = k => 'hal ' + (k.hal || '…') + (k.hal === 'C' ? ' · gedeelte ' + (k.ged || '…') : '') + ' · gang ' + (k.gang || '…');
const selOpt = (waarden, huidig, leeg) => (leeg ? '<option value="">' + esc(leeg) + '</option>' : '') + waarden.map(v => `<option${String(huidig) === String(v) ? ' selected' : ''}>${esc(v)}</option>`).join('');

// filters bovenaan: hal → (bij C) gedeelte → gang, alleen gangen die echt bestaan
function filterBalk(){
  const g = gangenLijst().filter(x => (!S.hal || x.hal === S.hal) && (!S.ged || x.ged === S.ged));
  return `<div class="cp-filter"><label>Hal <select data-cp-f="hal">${selOpt(HALLEN, S.hal, 'alle')}</select></label>
    ${S.hal === 'C' ? `<label>Gedeelte <select data-cp-f="ged">${selOpt(['C', 'D'], S.ged, 'alle')}</select></label>` : ''}
    <label>Gang <select data-cp-f="gang">${selOpt(g.map(x => x.gang), S.gang, 'alle')}</select></label></div>`;
}
const pastFilter = hg => (!S.hal || hg.hal === S.hal) && (!S.ged || hg.ged === S.ged) && (!S.gang || hg.gang === S.gang);
const filt = l => (S.hal || S.ged || S.gang) ? l.filter(x => pastFilter(halGang(x.loc))) : l;

function itemRij(x, extra){
  return `<div class="cp-item" data-c="${esc(x.c)}" data-cat="${esc(x.cat)}"><label class="cp-v"><input type="checkbox" data-cp-sel${uitgevinkt(x) ? '' : ' checked'} aria-label="${esc(x.c)}"></label>
    <div class="cp-m"><div class="cp-t"><b>${esc(x.c)}</b> ${esc(x.naam)} <span class="cp-k">${esc(x.abc || '')}${x.so ? ' · ' + esc(SOORTT[x.so] || x.so) : ''}${locTekst(x)}</span></div>
      <div class="cp-r">${esc(x.reden)}</div>${x.voorstel && x.voorstel.tekst ? `<div class="cp-vs">${esc(x.voorstel.tekst)}</div>` : x.tekstVoorstel ? `<div class="cp-vs">${esc(x.tekstVoorstel)}</div>` : ''}${extra || ''}</div></div>`;
}
const knop = (a, t, c, cat, ex) => `<button type="button" class="cp-b${ex ? ' ' + ex : ''}" data-cp="${a}" data-c="${esc(c)}" data-cat="${esc(cat)}">${esc(t)}</button>`;
const gknop = (a, t, ex, data) => `<button type="button" class="cp-b${ex ? ' ' + ex : ''}" data-cp="${a}"${data || ''}>${t}</button>`;
const aanpas = (c, cat) => `<a class="cp-b klein" href="#/doorloop/p/${encodeURIComponent(c)}/${cat}" data-taak="0.4">Aanpassen</a>`;
// de kaart van één familie: kop met aantal, "Selectie is: …", knoppen, en de producten met vinkjes
function famKaart(cat, key, items, vraag){
  const n = items.length, g = gekozenVan(items).length;
  return `<section class="cp-fam" data-fam="${esc(key)}" data-cat="${esc(cat)}"><h3>${esc(key)} <span class="muted klein">${nf(n)} producten</span></h3>
    <div class="cp-groep"><div class="cp-sel"><b>Selectie is:</b> ${vraag}<span class="muted klein"> · geldt voor ${nf(g)} van ${nf(n)} aangevinkte producten; uitvinken voor uitzonderingen, die blijven staan voor een volgende keuze.</span></div></div>
    ${items.map(x => itemRij(x, cat === 'hercontrole' || cat === 'gewicht' || cat === 'aantal' ? `<div class="cp-kn">${aanpas(x.c, cat)}</div>` : cat === 'bulklocaties' ? `<div class="cp-kn"><a class="cp-b klein" href="#/doorloop/p/${encodeURIComponent(x.c)}/bulklocaties" data-taak="0.4">Aanpassen</a></div>` : '')).join('')}</section>`;
}
const leegTab = t => `<p class="muted">${t || 'Niets meer in deze tab.'}</p>`;

/* 3 Picklocaties */
function keuzeVan(key, items){
  if(!S.keuze[key]){
    const v = gangVoorstel(items), w = items.map(x => x.wens && wensN(x.wens)).find(Boolean);
    S.keuze[key] = Object.assign({ hal:'', ged:'', gang:'', opm:'', reden:'' }, v || {}, w && !v ? w : {});
  }
  return S.keuze[key];
}
function pickKaart(key, items){
  const k = keuzeVan(key, items), kd = encodeURIComponent(key);
  const gl = gangenLijst().filter(x => x.hal === k.hal && (k.hal !== 'C' || !k.ged || x.ged === k.ged));
  const sel = `<span class="cp-wens" data-key="${esc(kd)}"><label>hal <select data-cp-k="hal">${selOpt(HALLEN, k.hal, 'kies')}</select></label>
    ${k.hal === 'C' ? `<label>gedeelte <select data-cp-k="ged">${selOpt(['C', 'D'], k.ged, 'kies')}</select></label>` : ''}
    <label>gang <select data-cp-k="gang">${selOpt(gl.map(x => x.gang), k.gang, 'kies')}</select></label>
    <label>opmerking <input data-cp-k="opm" value="${esc(k.opm)}" aria-label="opmerking"></label></span>`;
  const soorten = [['bulk', 'Bulk'], ['pallet', 'Pallet'], ['deel', 'Deel'], ['pick', 'Pick'], ['mix', 'Mix'], ['weg|uitlopend', 'Weg · Uitlopend'], ['weg|backorder', 'Weg · Backorder'], ['weg|archief', 'Weg · Archief']];
  const vraag = `<b>Pick nodig in ${esc(hgTekst(k))}</b>${k.reden ? `<div class="cp-vs">${esc(k.reden)}</div>` : ''}${sel}
    <div class="cp-rij">${gknop('g-wens', 'Pick nodig in ' + esc(hgTekst(k)), 'hoofd', ` data-key="${esc(kd)}"`)}${gknop('g-later', 'Later')}</div>
    <div class="cp-rij"><span class="muted klein">Andere soort:</span>${soorten.map(([s, t]) => gknop('g-soort', t, '', ` data-so="${s}"`)).join('')}</div>`;
  return famKaart('picklocaties', key, items, vraag);
}
// "Klaar voor Picqer": de werklijst per hal → gedeelte → gang
function klaarBlok(lijst, soort){
  const l = lijst.filter(x => pastFilter(x.hg)); if(!lijst.length) return '';
  const per = new Map(); l.forEach(x => { const k = hgTekst(x.hg); if(!per.has(k)) per.set(k, { hg:x.hg, items:[] }); per.get(k).items.push(x); });
  const delen = [...per.entries()].sort((a, b) => (a[1].hg.hal + a[1].hg.ged + a[1].hg.gang).localeCompare(b[1].hg.hal + b[1].hg.ged + b[1].hg.gang));
  const wat = soort === 'pick' ? 'pick aanmaken' : 'picklocatie eraf';
  return `<section class="cp-klaar" id="cp-klaar-${soort}"><h3>Klaar voor Picqer <span class="muted klein">${nf(lijst.length)}</span></h3><p class="muted klein">Werklijst voor Picqer (${wat}): jij koppelt of ontkoppelt zelf. Het product verdwijnt hier vanzelf zodra Picqer klopt.</p>
    ${delen.length ? delen.map(([t, d]) => `<div class="cp-werk" data-gang="${esc(d.hg.gang)}"><b>${esc(t.charAt(0).toUpperCase() + t.slice(1))}</b> <span class="muted klein">${nf(d.items.length)}</span><div class="cp-route">${d.items.map(x => `<div class="cp-item" data-c="${esc(x.c)}" data-cat="${soort === 'pick' ? 'pickklaar' : 'bulkeraf'}"><div class="cp-m"><div class="cp-t"><b>${esc(x.c)}</b> ${esc(x.naam)} <span class="cp-k">${esc(x.abc || '')}${x.loc && soort !== 'pick' ? ' · picklocatie <code>' + esc(x.loc) + '</code>' : ''}</span></div>${x.opm ? `<div class="cp-r">${esc(x.opm)}</div>` : ''}<div class="cp-kn"><button type="button" class="cp-b" data-cp="wijzig" data-c="${esc(x.c)}" data-cat="${soort === 'pick' ? 'pickklaar' : 'bulkeraf'}">Wijzig</button></div></div></div>`).join('')}</div></div>`).join('') : '<p class="muted">Niets in deze hal/gang.</p>'}</section>`;
}
function tabPick(c){
  const open = filt(c.picklocaties), klaar = c.pickklaar.map(x => Object.assign({ hg:wensHg(x.wens), opm:x.wens.opm }, x));
  return `${filterBalk()}<p class="muted klein">Pallet of Deel zonder picklocatie in Picqer, en alles met "moet pick krijgen". Per familie één keuze voor alle aangevinkte producten; de app maakt de werklijst, Picqer koppelen doe je zelf.</p>
    ${open.length ? groepen(open, false).map(([k, items]) => pickKaart(k, items)).join('') : leegTab(c.picklocaties.length ? 'Niets in deze hal of gang.' : 'Alles is beslist. Zie hieronder wat nog in Picqer moet.')}
    ${klaarBlok(klaar, 'pick')}`;
}
/* 4 Bulklocaties */
function tabBulk(c){
  const open = filt(c.bulklocaties), klaar = c.bulkeraf.map(x => Object.assign({ hg:halGang(x.loc) }, x));
  const vraag = (key, items) => `<b>alleen bulk (picklocatie eraf in Picqer)</b><div class="cp-rij">${gknop('g-bulk', 'Klopt, alleen bulk', 'hoofd')}${gknop('g-later', 'Later')}</div>
    <div class="cp-rij"><span class="muted klein">Fout, wordt:</span>${gknop('g-soort', 'Deel', '', ' data-so="deel"')}${gknop('g-soort', 'Pallet', '', ' data-so="pallet"')}</div>`;
  return `${filterBalk()}<p class="muted klein">Soort Bulk, maar Picqer heeft nog een picklocatie. Per familie in één keer "alleen bulk"; daarna staat de picklocatie op de werklijst waar jij hem in Picqer afhaalt.</p>
    ${open.length ? groepen(open, false).map(([k, items]) => famKaart('bulklocaties', k, items, vraag(k, items))).join('') : leegTab(c.bulklocaties.length ? 'Niets in deze hal of gang.' : 'Alles is beslist. Zie hieronder wat nog in Picqer moet.')}
    ${klaarBlok(klaar, 'bulk')}`;
}
/* 5 Hercontrole · 6 Gewicht controleren · 8 Aantal per pallet */
function tabMetVoorstel(lijst, cat){
  if(!lijst.length) return leegTab();
  const heeft = items => items.some(x => x.voorstel && (x.voorstel.soort || x.voorstel.veld || x.voorstel.kg));
  return groepen(lijst).map(([k, items]) => famKaart(cat, k, items, `<b>${heeft(items) ? 'voorstel overnemen' : 'geen voorstel: kijk per product'}</b><div class="cp-rij">${heeft(items) ? gknop('g-neem', 'Voorstel overnemen', 'hoofd') : ''}${gknop('g-klopt', cat === 'aantal' ? 'Klopt zo, verschil is terecht' : 'Klopt zo', heeft(items) ? '' : 'hoofd')}${cat === 'gewicht' ? gknop('g-tewegen', 'Naar Te wegen') : ''}${gknop('g-later', 'Later')}</div>`)).join('');
}
const tabGewicht = c => tabMetVoorstel(c.gewicht, 'gewicht');
/* 7 Te wegen: per familie, binnen de familie op locatie */
function tabTeWegen(c){
  const l = filt(c.tewegen);
  return `${filterBalk()}<p class="muted klein">Alleen wat echt gewogen moet worden, per familie en binnen de familie op locatie (looproute). Typ het gewogen gewicht per stuk: het wordt "gewogen".</p>
    ${l.length ? groepen(l, false).map(([k, items]) => `<section class="cp-fam" data-fam="${esc(k)}" data-cat="tewegen"><h3>${esc(k)} <span class="muted klein">${nf(items.length)} producten</span></h3>
      ${items.slice().sort((a, b) => String(a.loc || 'ZZ').localeCompare(String(b.loc || 'ZZ'))).map(x => `<div class="cp-item" data-c="${esc(x.c)}" data-cat="tewegen"><div class="cp-m"><div class="cp-t"><code>${esc(x.loc || 'geen locatie')}</code> <b>${esc(x.c)}</b> ${esc(x.naam)} <span class="cp-k">${esc(x.abc || '')}</span></div>
      <div class="cp-kn"><label>kg per stuk <input data-cp-kg inputmode="decimal" size="6" aria-label="gewogen kg ${esc(x.c)}"></label>${gknop('gewogen', 'Gewogen', 'hoofd', ` data-c="${esc(x.c)}" data-cat="tewegen"`)}</div></div></div>`).join('')}</section>`).join('') : '<p class="muted">Niets te wegen.</p>'}`;
}

function tabLater(){
  const l = window.WHTAAK && WHTAAK.later ? WHTAAK.later.lijst() : [], lt = laterTabs();
  if(!l.length && !lt.length) return '<p class="muted">Niets op Later.</p>';
  const T = { soort:'Soort', gewicht:'Gewicht', spp:'Hoeveelheid: stuks per pallet', maat:'Hoeveelheid: palletmaat', hoogte:'Hoeveelheid: hoogte', maxpick:'Hoeveelheid: max op pick', rl:'Hoeveelheid: lengte volle rol', rmax:'Hoeveelheid: max rollen per pallet' };
  return `<div id="later-kaart"><h2>Later · moet nog (${nf(l.length + lt.length)})</h2><p class="muted klein">Wat je bewust hebt uitgesteld, oudste eerst. Telt niet mee voor het afronden; een antwoord (waar dan ook) haalt het van de lijst.</p><div class="cp-rij"><a class="cp-b hoofd knop" href="#/doorloop/later" data-taak="0.4">Doorlopen →</a></div>
    ${l.map(x => `<div class="cp-item"><div class="cp-m"><div class="cp-t"><b>${esc(x.c)}</b> ${esc(naam(x.c))}</div><div class="cp-r">${esc(T[x.t] || x.t)} · sinds ${esc(dt(x.op))}${x.opm ? ' · ' + esc(x.opm) : ''}</div></div></div>`).join('')}
    ${lt.map(x => `<div class="cp-item"><div class="cp-m"><div class="cp-t"><b>${esc(x.c)}</b> ${esc(naam(x.c))}</div><div class="cp-r">${esc(x.opm || 'Later')} · sinds ${esc(dt(x.op))}</div><div class="cp-kn">${knop('terug-later', 'Weer op de lijst', x.c, x.cat)}</div></div></div>`).join('')}</div>`;
}

/* Overzicht = Claudes analyse */
const UITLEG = {
  picklocaties:'Pallet of Deel die in Picqer geen vaste picklocatie hebben, of die "moet pick krijgen" kregen: Daan zegt per product in welke hal en gang de pick moet komen.',
  bulklocaties:'Soort Bulk, maar Picqer heeft nog een picklocatie: die moet in Picqer eraf, of de soort klopt niet.',
  hercontrole:'Duidelijke tegenstrijdigheden: Pick met bulk of VST, Weg met voorraad, kleurgenoten met andere maat of hoogte, hoogte niet op 10 cm, volle pallet buiten 50–1.500 kg.',
  gewicht:'Gewicht dat afwijkt van de kleurgenoten (meer dan 25%) of de familie (meer dan 3×), of "vertrouwd" terwijl Picqer geen gewicht heeft; met een voorgesteld gewicht.',
  tewegen:'Producten die echt gewogen moeten worden, gesorteerd op locatie (looproute).',
  aantal:'Kleurgenoten met een ander aantal per pallet, of een palletlabel dat afwijkt van productdata.'
};
function watKlopt(){
  // patronen die 3.0 herkent: 549/551/574 — kleur -007 en -052 Deel, rest Pick; het verschil komt door verkoop
  const groepen = ['549', '551', '574'].map(pf => { const cs = Object.keys(WH.D.P).filter(c => new RegExp('^' + pf + '-').test(c) && bruikbaar(c) && soortVan(c)); const deel = cs.filter(c => soortVan(c) === 'deel' && /-(007|052)$/.test(c)).length, pick = cs.filter(c => soortVan(c) === 'pick' && !/-(007|052)$/.test(c)).length; return { pf, n:cs.length, deel, pick }; }).filter(g => g.n);
  return groepen.length ? `<li><b>549 / 551 / 574</b>: de kleuren -007 en -052 zijn Deel (${groepen.map(g => g.pf + ': ' + g.deel).join(', ')}), de rest Pick (${groepen.map(g => g.pf + ': ' + g.pick).join(', ')}). Het verschil komt door de verkoop, niet door een fout; deze reeks staat daarom niet in Hercontrole.</li>` : '';
}
function overzicht(c, t){
  const voorb = (l, n) => l.slice(0, n).map(x => `<code>${esc(x.c)}</code>`).join(' ');
  const rij = (k, titel, lijst, klaar) => `<div class="cp-ov"><div><b>${esc(titel)} · ${nf(lijst.length)}</b>${klaar ? ` <span class="muted klein">· ${nf(klaar)} klaar voor Picqer</span>` : ''}<div class="muted klein">${esc(UITLEG[k])}</div>${lijst.length ? `<div class="klein">Bijvoorbeeld ${voorb(lijst, 5)}</div>` : ''}</div><a class="cp-b${lijst.length ? ' hoofd' : ''}" href="#/todo/${k}">${lijst.length ? 'Naar de tab →' : klaar ? 'Naar de werklijst →' : 'Leeg'}</a></div>`;
  const nl = t ? t.later : 0;
  const st = S.steek;
  const reactie = `<div class="cp-reactie"><b>Jouw reactie</b><div class="muted klein">Wat is fout of wat mis je in deze analyse? Kort is genoeg; het wordt bewaard met datum.</div><textarea id="cp-reactie" rows="3" placeholder="Bijv. 549-1-135 klopt gewoon, en ik mis …"></textarea><button type="button" class="cp-b hoofd" data-cp="reactie">Bewaar</button>
    ${S.reacties.length ? `<ul class="cp-reacties">${S.reacties.slice().reverse().slice(0, 6).map(r => `<li><span class="muted klein">${esc(dt(r.op))}</span> ${esc(r.tekst)}</li>`).join('')}</ul>` : ''}</div>`;
  const steek = st && st.codes ? `<div class="cp-steek"><b>Steekproef (${st.codes.length})</b>${st.codes.map(x => `<div class="cp-item" data-c="${esc(x.c)}"><div class="cp-m"><div class="cp-t"><code>${esc(x.loc || '–')}</code> <b>${esc(x.c)}</b> ${esc(naam(x.c))}</div><div class="cp-r">Controleer op de vloer: ${esc(x.wat)}</div><div class="cp-kn">${st.uit && st.uit[x.c] === 'klopt' ? '<span class="ok">klopt</span>' : st.uit && st.uit[x.c] === 'fout' ? '<span class="fout">fout</span>' : ''}${knop('sp-klopt', 'Klopt', x.c, 'sp')}${knop('sp-fout', 'Fout', x.c, 'sp')}</div></div></div>`).join('')}
    <div class="${steekGroen() ? 'ok' : 'muted'}"><b>${nf(Object.keys(st.uit || {}).length)} van ${st.codes.length} gecontroleerd · ${nf(Object.values(st.uit || {}).filter(v => v === 'fout').length)} fouten${steekGroen() ? ' · GROEN' : ''}</b></div></div>` : '';
  return `<p class="muted">Claudes analyse van de data, live berekend. Elk punt is een voorstel: jij beslist met één tik. Alleen producten met een bevestigde soort, nooit SAM Europe.</p>
    ${rij('picklocaties', '3 Picklocaties', c.picklocaties, c.pickklaar.length)}${rij('bulklocaties', '4 Bulklocaties', c.bulklocaties, c.bulkeraf.length)}${rij('hercontrole', '5 Hercontrole', c.hercontrole)}${rij('gewicht', '6 Gewicht controleren', c.gewicht)}${rij('tewegen', '7 Te wegen', c.tewegen)}${rij('aantal', '8 Aantal per pallet', c.aantal)}
    <div class="cp-ov"><div><b>2 Later · ${nf(nl)}</b><div class="muted klein">Bewust uitgesteld; telt niet mee voor het afronden.</div></div><a class="cp-b${nl ? ' hoofd' : ''}" href="#/todo/later">${nl ? 'Naar de tab →' : 'Leeg'}</a></div>
    <h3>Wat klopt</h3><ul class="cp-wat">${watKlopt() || '<li class="muted">Geen herkende patronen in deze data.</li>'}<li>Productdata in gebruik: <b>3.0 en Containers</b> · Warehouse, Junior en Palletlabels pas na de steekproef.</li></ul>
    <h3>Steekproef voor Poort 0.4</h3><p class="muted klein">20 producten uit tab 3–8 (A/B eerst) als vloerlijst. 20 gecontroleerd met 0 fouten = groen.</p><button type="button" class="cp-b hoofd" data-cp="steekmaken">Steekproef maken</button>${steek}
    ${reactie}`;
}
const steekGroen = () => !!(S.steek && S.steek.codes && S.steek.codes.length === 20 && Object.keys(S.steek.uit || {}).length === 20 && !Object.values(S.steek.uit).includes('fout'));
function steekMaken(){
  const c = cats(); if(!c) return;
  const bron = [['picklocaties', x => 'staat er een vaste picklocatie? gewenst: ' + (x.wens ? 'hal ' + x.wens.hal + ' gang ' + x.wens.gang : 'pick nodig')], ['bulklocaties', x => 'is er nog een picklocatie (' + x.loc + ')?'], ['hercontrole', x => x.reden], ['gewicht', x => 'weeg één stuk; app zegt ' + (x.voorstel && x.voorstel.kg ? fmtKg(x.voorstel.kg) + ' kg' : 'onbekend')], ['tewegen', x => 'wegen: kg per stuk'], ['aantal', x => 'tel de stuks per pallet']];
  const kand = []; bron.forEach(([k, wat]) => c[k].forEach(x => kand.push({ c:x.c, abc:x.abc, loc:x.loc || '', wat:wat(x), cat:k })));
  const gezien = new Set(), pool = kand.sort((a, b) => rang(a.abc) - rang(b.abc)).filter(x => !gezien.has(x.c) && gezien.add(x.c));
  const ab = pool.filter(x => rang(x.abc) < 2), rest = pool.filter(x => rang(x.abc) >= 2);
  const kies = a => { const u = a.slice(); for(let i = u.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [u[i], u[j]] = [u[j], u[i]]; } return u; };
  const codes = kies(ab).concat(kies(rest)).slice(0, 20);
  S.steek = { op:nu(), codes, uit:{} };
  schrijfRij(SP, null, () => S.steek);
}

function stijl(){
  if(document.getElementById('cp-stijl')) return;
  const s = document.createElement('style'); s.id = 'cp-stijl';
  s.textContent = `.cp-tabs{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0}.cp-tab{border:1.5px solid var(--lijn,#d6dce4);background:var(--vlak,#fff);color:inherit;border-radius:.6rem;padding:.5rem .8rem;font:600 .95rem inherit;text-decoration:none;display:inline-flex;gap:.4rem;align-items:center}
.cp-tab.aan{background:var(--ink,#121820);color:#fff;border-color:var(--ink,#121820)}.cp-tab i{font-style:normal;background:#ef8a4a;color:#1b1205;border-radius:1rem;padding:0 .45rem;font-size:.8rem}
.cp-inh{display:grid;gap:.75rem}.cp-fam{display:grid;gap:.5rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,24rem),1fr));align-items:start}.cp-fam>h3,.cp-fam>.cp-groep{grid-column:1/-1}
.cp-item{display:flex;gap:.6rem;align-items:flex-start;background:var(--vlak,#fff);border:1px solid var(--lijn,#d6dce4);border-radius:.75rem;padding:.7rem .8rem;min-width:0}.cp-m{min-width:0;flex:1;overflow-wrap:anywhere}
.cp-v input{width:1.3rem;height:1.3rem;margin-top:.2rem}.cp-k{color:#5c6675;font-size:.85rem}.cp-r{font-size:.92rem}.cp-vs{color:#2350a8;font-weight:600;font-size:.92rem}
.cp-kn,.cp-groep,.cp-rij,.cp-filter{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.4rem;align-items:center}.cp-b{border:1.5px solid var(--lijn,#d6dce4);background:var(--vlak,#fff);color:inherit;border-radius:.6rem;padding:.45rem .75rem;font:600 .9rem inherit;cursor:pointer;text-decoration:none;display:inline-block}
.cp-b.hoofd{background:#ef8a4a;border-color:#ef8a4a;color:#1b1205}.cp-wens{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}.cp-wens input,.cp-wens select,.cp-filter select,.cp-kn input{font:inherit;padding:.3rem .4rem;border:1px solid var(--lijn,#d6dce4);border-radius:.4rem;background:var(--vlak,#fff);color:inherit}
.cp-ov{display:flex;gap:.8rem;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;background:var(--vlak,#fff);border:1px solid var(--lijn,#d6dce4);border-radius:.75rem;padding:.8rem}.cp-ov>div{min-width:0;flex:1 1 20rem;overflow-wrap:anywhere}
.cp-reactie textarea{width:100%;font:inherit;border:1px solid var(--lijn,#d6dce4);border-radius:.5rem;padding:.5rem;background:var(--vlak,#fff);color:inherit;margin:.4rem 0}.cp-route{display:grid;gap:.4rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,24rem),1fr))}
.cp-sel{display:grid;gap:.4rem;width:100%}.cp-b.klein{padding:.25rem .55rem;font-size:.82rem}.cp-klaar{display:grid;gap:.6rem;margin-top:1.2rem;border-top:2px solid var(--lijn,#d6dce4);padding-top:.8rem}.cp-werk{display:grid;gap:.4rem}.cp-wat li{margin:.3rem 0}.cp-steek .ok,.cp-reactie .ok{color:#2e7d4f}.fout{color:#c0392b;font-weight:700}code{overflow-wrap:anywhere}`;
  document.head.appendChild(s);
}
function tabHtml(tab){
  const c = cats();
  if(!c) return '<p class="muted">Controleronde berekenen…</p>';
  const t = tel();
  switch(tab){
    case 'later': return tabLater();
    case 'picklocaties': return tabPick(c);
    case 'bulklocaties': return tabBulk(c);
    case 'hercontrole': return tabMetVoorstel(c.hercontrole, 'hercontrole');
    case 'gewicht': return tabGewicht(c);
    case 'tewegen': return tabTeWegen(c);
    case 'aantal': return tabMetVoorstel(c.aantal, 'aantal');
    default: return overzicht(c, t);
  }
}
function html(tab){
  stijl();
  const t = tel();
  tab = TABS.some(x => x[0] === tab) ? tab : 'overzicht';
  const nav = TABS.filter(([k]) => k === 'overzicht' || !t || t[k] > 0 || (t.klaar && t.klaar[k] > 0) || k === tab).map(([k, n]) => `<a class="cp-tab${tab === k ? ' aan' : ''}" href="#/todo/${k}">${esc(n)}${t && k !== 'overzicht' && t[k] ? ` <i>${nf(t[k])}</i>` : ''}</a>`).join('');
  return `<nav class="cp-tabs" aria-label="Te doen">${nav}</nav><div class="cp-inh" id="cp-inh">${tabHtml(tab)}</div>`;
}

/* ---------- gebeurtenissen ---------- */
let gekoppeld = false;
const vind = (cat, c) => { const l = cats(); return l && (l[cat] || []).find(x => x.c === c); };
function koppel(){
  if(gekoppeld) return; gekoppeld = true;
  const herteken = () => { try{ WHTAAK.herteken(); }catch(e){} };
  const inNative = el => { const n = document.getElementById('native'); return !!n && n.contains(el); };
  document.addEventListener('change', ev => {
    const t = ev.target; if(!t.closest || !inNative(t)) return;
    const f = t.closest('[data-cp-f]');
    if(f){ S[f.dataset.cpF] = f.value; if(f.dataset.cpF === 'hal'){ S.ged = ''; S.gang = ''; } if(f.dataset.cpF === 'ged') S.gang = ''; herteken(); return; }
    const sel = t.closest('[data-cp-sel]');
    if(sel){ const it = sel.closest('.cp-item'), k = it.dataset.cat + '|' + it.dataset.c; if(sel.checked) delete S.uit[k]; else S.uit[k] = true; herteken(); return; }
    const kz = t.closest('[data-cp-k]');
    if(kz){ const w = kz.closest('[data-key]'), key = decodeURIComponent(w.dataset.key), k = S.keuze[key]; if(!k) return; k[kz.dataset.cpK] = kz.value; if(kz.dataset.cpK === 'hal'){ k.ged = ''; k.gang = ''; } if(kz.dataset.cpK === 'ged') k.gang = ''; k.reden = ''; herteken(); }
  });
  document.addEventListener('input', ev => { const kz = ev.target.closest && ev.target.closest('[data-cp-k="opm"]'); if(!kz || !inNative(kz)) return; const w = kz.closest('[data-key]'), k = S.keuze[decodeURIComponent(w.dataset.key)]; if(k) k.opm = kz.value; });
  document.addEventListener('click', async ev => {
    const b = ev.target.closest && ev.target.closest('[data-cp]'); if(!b || !inNative(b)) return;
    const a = b.dataset.cp, c = b.dataset.c, cat = b.dataset.cat, sec = b.closest('.cp-fam');
    const gek = () => sec ? [...sec.querySelectorAll('.cp-item')].filter(e => e.querySelector('[data-cp-sel]') && e.querySelector('[data-cp-sel]').checked).map(e => vind(sec.dataset.cat, e.dataset.c)).filter(Boolean) : [];
    b.disabled = true;
    try{
      if(a.startsWith('g-')){
        const l = gek(); if(!l.length){ WH.toast('Vink minstens één product aan', 3000); b.disabled = false; return; }
        const kat = sec.dataset.cat, codes = l.map(x => x.c);
        if(a === 'g-neem'){ await neemOverMeer(l.filter(x => x.voorstel)); }
        else if(a === 'g-klopt'){ await zetKloptMeer(kat, l); }
        else if(a === 'g-later'){ await zetKloptMeer(kat, l, 'Later · tab ' + kat, { later:true }); }
        else if(a === 'g-tewegen'){ await naarTeWegen(codes); }
        else if(a === 'g-bulk'){ await zetKloptMeer('bulkeraf', l); }
        else if(a === 'g-soort'){ const [so, weg] = String(b.dataset.so).split('|'); if(await zetSoort(codes, so, weg)) await zetKloptMeer(kat, l, 'Andere soort: ' + SOORTT[so] + (weg ? ' · ' + weg : '')); }
        else if(a === 'g-wens'){
          const k = S.keuze[decodeURIComponent(b.dataset.key)] || {};
          if(!k.hal || (k.hal === 'C' && !k.ged) || !k.gang){ WH.toast('Kies hal' + (k.hal === 'C' ? ', gedeelte' : '') + ' en gang', 3500); b.disabled = false; return; }
          if(await bewaarPickwens(codes, { hal:k.hal, ged:k.ged, gang:k.gang, opm:k.opm })) WH.toast('Pick nodig bewaard voor ' + codes.length + ' producten: ' + hgTekst(k), 3500);
        }
      }
      else if(a === 'wijzig'){
        if(cat === 'bulkeraf') await weesKlopt('bulkeraf', c);
        else { const x = vind('pickklaar', c); if(x && x.wens){ const n = wensN(x.wens), key = gKey(x); S.keuze[key] = Object.assign({}, n, { reden:'Eerdere keuze' }); } await bewaarPickwens([c], null); }
      }
      else if(a === 'gewogen'){ const inp = b.closest('.cp-kn').querySelector('[data-cp-kg]'), v = num(String(inp.value).replace(',', '.')); if(!(v > 0)){ WH.toast('Typ het gewogen gewicht per stuk in kg', 3500); b.disabled = false; return; } await gewogen(c, v); }
      else if(a === 'terug-later'){ await weesKlopt(cat, c); }
      else if(a === 'reactie'){ const t = (document.getElementById('cp-reactie') || {}).value || ''; if(t.trim()){ S.reacties.push({ op:nu(), tekst:t.trim() }); await schrijfRij(RE, null, d => { d.lijst = (d.lijst || []).concat([{ op:nu(), tekst:t.trim() }]); return d; }); } }
      else if(a === 'steekmaken'){ steekMaken(); }
      else if(a === 'sp-klopt' || a === 'sp-fout'){ S.steek.uit = S.steek.uit || {}; S.steek.uit[c] = a === 'sp-klopt' ? 'klopt' : 'fout'; await schrijfRij(SP, null, () => S.steek); }
    }catch(e){ console.error(e); WH.toast('Mislukt: ' + (e.message || e), 5000); }
    S.memo = null; herteken();
  });
}
// Poort 0.4: de steekproef komt uit de controleronde
function poortSteek(){ return { gedaan:S.steek && S.steek.codes ? Object.keys(S.steek.uit || {}).length : 0, n:S.steek && S.steek.codes ? S.steek.codes.length : 0, fouten:S.steek && S.steek.uit ? Object.values(S.steek.uit).filter(v => v === 'fout').length : 0, groen:steekGroen() }; }
return { html, tel, cats, laad, koppel, poortSteek, S, TABS, zetKlopt, tabHtml };
})();
