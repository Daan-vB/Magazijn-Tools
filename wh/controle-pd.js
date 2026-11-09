/* =====================================================================
   IVOL Warehouse 3.0 — Te doen in tabs: de controleronde (08-11-2026, herzien 09-11-2026)
   Per categorie een tab met alles wat nog aandacht nodig heeft, live uit productdata en Picqer (zelfde data als Productdata 2.0):
     1 Overzicht (Claudes analyse) · 2 Later · 3 Picklocaties · 4 Bulklocaties · 5 Hercontrole · 6 Gewicht controleren · 7 Te wegen · 8 Aantal per pallet
   Vaste regels (CLAUDE.md): elke tab werkt per groep → familie → product (groep = leverancier + hoofdwoord, nooit SAM Europe), alles aangevinkt,
   één vraag, "Selectie is: …" voor alle aangevinkte, uitvinken voor de uitzonderingen (die blijven staan). Eén product = één punt per tab (alle
   redenen eronder); tellers tellen producten. Beslist = weg: na een besluit verdwijnt het product uit de open lijst en telt de tab af.
   Kleurgenoten = zelfde familie én maat (PD2R.kleurgenoten, één functie overal). Gewicht van een andere maat alleen naar verhouding met een
   rekensom (per meter, per m², kg in de naam), anders geen voorstel maar "Naar Te wegen". Drie hallen A, B, C (C met gedeelte C en D).
   Claude stelt voor, Daan beslist met één tik; niets wordt zelf gewijzigd. "Klopt zo" wordt onthouden (catalog-rij wh-controle-klopt) en komt pas
   terug als de data verandert. Elke schrijfactie maakt eerst een kopie (wh-kopie-productdata-<datum>-8 voor productdata; <rij>-kopie-<datum> voor
   eigen rijen). Picqer: alleen lezen — locaties koppelen en ontkoppelen doet Daan zelf in Picqer, de app maakt de werklijst per hal → gedeelte → gang.
   ===================================================================== */
window.WHCP = (function(){
'use strict';
const { esc, nf, num } = WH;
const R = () => window.PD2R;
const KL = 'wh-controle-klopt', RE = 'wh-controle-reacties', SP = 'wh-controle-steekproef';
const TABS = [['overzicht', 'Overzicht'], ['later', 'Later'], ['picklocaties', 'Picklocaties'], ['bulklocaties', 'Bulklocaties'], ['hercontrole', 'Hercontrole'], ['gewicht', 'Gewicht controleren'], ['tewegen', 'Te wegen'], ['aantal', 'Aantal per pallet']];
const S = { klopt:{}, reacties:[], steek:null, klaar:false, p:null, memo:null, memoKey:'', f:{ hal:'', deel:'', gang:'' }, q:Promise.resolve(), uit:new Set(), aan:new Set(), open:new Set(), keuze:{}, wegOpen:new Set(), wijzig:new Set(), kg:{}, bezig:false, undo:null, undoT:null };
// soort volgens de blauwdruk (§8): Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg · Backorder; Weg = Uitlopend of Archief (09-11)
const SOORTK = ['pick', 'bulk', 'deel', 'pallet', 'mix', 'twijfel', 'weg', 'backorder'];
const SOORTT = { pick:'Pick', bulk:'Bulk', deel:'Deel', pallet:'Pallet', mix:'Mix', twijfel:'Twijfel', weg:'Weg', backorder:'Backorder' };
const ZONDER = new Set(['weg', 'backorder', 'twijfel']);   // geen gewicht- of hoeveelheidsvragen
const WEGT = { uitlopend:'Uitlopend', archief:'Archief' };
const nu = () => new Date().toISOString();
const dt = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.getDate() + '-' + (d.getMonth() + 1) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const fmtKg = x => String(Math.round(x * 1000) / 1000).replace('.', ',');
const fmt = x => String(x).replace('.', ',');
const rang = a => a === 'A' ? 0 : a === 'B' ? 1 : 2;
const mv = (n, e, m) => nf(n) + ' ' + (n === 1 ? e : m);
const mediaan = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };
const spreidOk = a => a.length > 0 && Math.max(...a) / Math.min(...a) <= 1.25;

/* ---------- opslag ---------- */
function laad(vers){
  if(S.p && !vers) return S.p;
  S.p = Promise.all([WH.catHaal(KL), WH.catHaal(RE), WH.catHaal(SP)]).then(([k, r, s]) => {
    S.klopt = (k && k.data && k.data.items) || {}; S.reacties = (r && r.data && r.data.lijst) || []; S.steek = (s && s.data) || null; S.klaar = true; S.memo = null;
  }).catch(e => { console.error(e); S.klaar = true; });
  return S.p;
}
// schrijven met kopie vooraf en samenvoegen met de nieuwste versie (een ander apparaat overschrijft niets)
function schrijfRij(key, pas){
  S.q = S.q.catch(() => {}).then(async () => {
    const r = await WH.catHaal(key).catch(() => null), data = (r && r.data) || {};
    if(r && r.data) await WH.catZet(key + '-kopie-' + WH.isoDag(), r.data);
    const nieuw = pas(JSON.parse(JSON.stringify(data))); await WH.catZet(key, nieuw); return nieuw;
  }).catch(e => { console.error(e); WH.toast('Bewaren lukte niet: ' + (e.message || e), 6000); });
  return S.q;
}
// lijst [{ cat, c, opm, sig, later }] in één schrijfactie
function zetKloptVeel(lijst){
  if(!lijst.length) return Promise.resolve();
  const e = lijst.map(x => [x.cat + '|' + x.c, Object.assign({ op:nu(), opm:x.opm || '', sig:x.sig || '' }, x.later ? { later:true } : {})]);
  e.forEach(([k, v]) => { S.klopt[k] = v; }); S.memo = null;
  return schrijfRij(KL, d => { d.items = d.items || {}; e.forEach(([k, v]) => { d.items[k] = v; }); return d; });
}
const zetKlopt = (cat, c, opm, sig, extra) => zetKloptVeel([Object.assign({ cat, c, opm, sig }, extra || {})]);
function weesKloptVeel(keys){ keys.forEach(k => { delete S.klopt[k]; }); S.memo = null; return schrijfRij(KL, d => { d.items = d.items || {}; keys.forEach(k => { delete d.items[k]; }); return d; }); }
// Later vanuit een tab: verborgen tot de data verandert, en zichtbaar in de tab Later
const laterTabs = () => Object.entries(S.klopt).filter(([, v]) => v.later).map(([k, v]) => { const i = k.indexOf('|'); return { cat:k.slice(0, i), c:k.slice(i + 1), op:v.op, opm:v.opm }; }).filter(x => WH.D.P[x.c]);
const isKlopt = (cat, c, sig) => { const k = S.klopt[cat + '|' + c]; return !!k && k.sig === (sig || ''); };

/* ---------- gegevens per product ---------- */
const fam = c => { try{ return window.WHPD.index().fam[R().famVan(c)] || []; }catch(e){ return []; } };
const bruikbaar = c => { try{ return R().actief(c) && !R().isKoppel(c) && !R().isSam(c); }catch(e){ return false; } };
const ribbel = c => { try{ return !!WHPD.intern.ribbelMaat(c); }catch(e){ return false; } };   // ribbel op maat: eigen pallet-indeling en gewicht per lengte
const naam = c => (WH.D.P[c] || {}).naam || '';
const abc = c => { try{ return R().abcVan(c) || ''; }catch(e){ return ''; } };
const kleurgenoten = c => { try{ return R().kleurgenoten(c).filter(bruikbaar); }catch(e){ return []; } };
const soortVan = c => { try{ const s = R().status(c); return s.stap.soort ? s.so : ''; }catch(e){ return ''; } };
const wegVan = c => { try{ const w = R().wegWaarde(c, R().info(c)); return w && w.v ? w.v : ''; }catch(e){ return ''; } };
const vastePick = c => { try{ return (R().locInfo(c).pick || []).filter(x => !x.tijd && x.n).map(x => x.n); }catch(e){ return []; } };
const bulkLocs = c => { try{ return (R().locInfo(c).bulk || []).filter(x => x.v > 0).map(x => x.n); }catch(e){ return []; } };
const halVan = x => R().halVan(x);
const eigen = (c, k) => { const w = R().waarde(c, k, R().info(c)); return w && w.v !== '' && w.v !== undefined && ['bevestigd', 'aangepast', 'vastgelegd'].includes(w.st) ? w.v : null; };
// gewicht: alleen wat Daan vertrouwt of woog telt als bron voor een ander product; Picqer alleen als niemand in de groep iets vertrouwds heeft
const kgVast = c => { try{ const g = R().gewicht(c); return ['gewogen', 'vertrouwd'].includes(g.st) && g.kg > 0 ? g.kg : null; }catch(e){ return null; } };
const kgElk = c => { try{ const g = R().gewicht(c); return g.kg > 0 ? g.kg : g.pq > 0 ? g.pq : null; }catch(e){ return null; } };
const pdRij = c => { try{ return WHPD.S.pd[c] || {}; }catch(e){ return {}; } };
const pickwens = c => { try{ return R().wensNorm((pdRij(c).data || {}).pickwens); }catch(e){ return null; } };
const moetPick = c => { const d = pdRij(c).data || {}; if(/moet/i.test(String(d.pickkeuze || ''))) return true; try{ const w = R().waarde(c, 'pickc', R().info(c)); return !!w && w.v === 'moetpick'; }catch(e){ return false; } };
const voorraadHier = c => num((WH.D.P[c] || {}).voorraad_hm) || 0;
const soortNu = c => { try{ return R().status(c).so || ''; }catch(e){ return ''; } };

/* ---------- feiten om te kiezen (blauwdruk 9–14): voorraad per plek, verkoop, inkoop, backorders, soort en gewicht ---------- */
const som = l => (l || []).reduce((t, x) => t + (x.v || 0), 0);
const dagNl = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? +m[3] + '-' + +m[2] + '-' + m[1].slice(2) : ''; };
function plekken(c){
  let f; try{ f = R().locInfo(c); }catch(e){ return { pick:[], bulk:[], vst:0, geen:0 }; }
  return { pick:(f.pick || []).filter(x => x.n && !x.tijd), bulk:(f.bulk || []).filter(x => x.n && x.v > 0), vst:f.vst || 0, geen:f.geen || 0 };
}
// gangen waar het product nu staat: vaste pick en bulk met voorraad
const plekGangen = c => { const p = plekken(c), s = new Set(); p.pick.concat(p.bulk).forEach(x => { const h = halVan(x.n); if(h) s.add(h.gang); }); return [...s]; };
function laatsteInkoop(c){
  let r = []; try{ r = ((WHPD.S.ink && WHPD.S.ink.p && WHPD.S.ink.p[c]) || []).map(x => ({ d:String(x[0] || ''), b:num(x[1]) || 0 })).filter(x => x.b > 0).sort((a, b) => b.d.localeCompare(a.d)); }catch(e){}
  if(!r.length) return '';
  const x = r[0], spp = num(eigen(c, 'spp')); let t = 'laatste inkoop ' + (dagNl(x.d) ? dagNl(x.d) + ': ' : '') + nf(x.b);
  if(spp > 0 && x.b >= spp){ const n = Math.floor(x.b / spp), rest = x.b - n * spp; t += ' = ' + n + (n === 1 ? ' pallet' : ' pallets') + ' à ' + nf(spp) + (rest ? ' + ' + nf(rest) : ''); }
  return t;
}
const GST = { gewogen:'gewogen', vertrouwd:'vertrouwd', tewegen:'te wegen', niet:'niet gecontroleerd' };
const gewTekst = c => { try{ const g = R().gewicht(c); return 'gewicht ' + (GST[g.st] || g.st) + (g.kg > 0 && g.st !== 'tewegen' && g.st !== 'niet' ? ' ' + fmtKg(g.kg) + ' kg' : g.pq > 0 ? ' (Picqer ' + fmtKg(g.pq) + ' kg)' : ''); }catch(e){ return ''; } };
function feitenHtml(c){
  const P = R(), p = plekken(c), loc = [];
  p.pick.slice(0, 3).forEach(x => loc.push('pick ' + x.n + ' ' + nf(x.v)));
  p.bulk.slice(0, 3).forEach(x => loc.push('bulk ' + x.n + ' ' + nf(x.v)));
  if(p.bulk.length > 3) loc.push('+' + (p.bulk.length - 3) + ' bulkplekken (' + nf(som(p.bulk.slice(3))) + ')');
  if(p.vst > 0) loc.push('VST ' + nf(p.vst)); if(p.geen > 0) loc.push('geen plek ' + nf(p.geen));
  const so = soortNu(c), bo = P.backorders(c), ink = laatsteInkoop(c);
  const r1 = [abc(c) || '–', so ? SOORTT[so] || so : 'soort open', gewTekst(c), 'verkoop 28 d ' + nf(P.vk28(c) || 0) + ' · 6 mnd ' + nf(P.vk6(c) || 0) + '/mnd', ink, bo ? 'backorders ' + bo.n + ' (' + nf(bo.stuks) + ' st)' : ''].filter(Boolean).join(' · ');
  return `<div class="cp-feit">${esc(r1)}</div><div class="cp-feit">${esc(loc.length ? loc.join(' · ') : 'geen voorraad')}</div>`;
}
function totaal(codes){ const t = { n:codes.length, pick:0, bulk:0, vst:0, geen:0, vk:0 }; codes.forEach(c => { const p = plekken(c); t.pick += som(p.pick); t.bulk += som(p.bulk); t.vst += p.vst; t.geen += p.geen; t.vk += R().vk28(c) || 0; }); return t; }
// waar staan deze producten nu: per gang het aantal producten (pick of bulk)
function staatNu(codes){ const t = {}; codes.forEach(c => plekGangen(c).forEach(g => { t[g] = (t[g] || 0) + 1; })); return Object.entries(t).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
const famCodes = fks => [...new Set(fks.flatMap(fk => (WHPD.index().fam[fk] || []).filter(bruikbaar)))];
const nuTekst = nu => nu.length ? 'nu in ' + nu.slice(0, 5).map(([g, n]) => g + ' ' + n).join(' · ') + (nu.length > 5 ? ' …' : '') : 'staat nog nergens';
const totaalTekst = (t, nu) => [mv(t.n, 'product', 'producten'), 'pick ' + nf(t.pick), 'bulk ' + nf(t.bulk), 'VST ' + nf(t.vst), 'geen plek ' + nf(t.geen), 'verkoop 28 d ' + nf(t.vk), nuTekst(nu)].join(' · ');

/* ---------- voorstellen ---------- */
// waar moet de pick komen: waar kleurgenoten of de familie nu pick hebben (of hun pickwens), anders waar het product of de familie op bulk ligt
function pickVoorstel(c){
  const P = R(), kl = kleurgenoten(c), leden = fam(c).filter(x => x !== c && bruikbaar(x));
  const top = (cs, plekken) => { const t = {}; cs.forEach(x => plekken(x).forEach(l => { const h = halVan(l); if(h) t[h.gang] = (t[h.gang] || 0) + 1; })); const e = Object.entries(t).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]; return e ? { h:halVan(e[0]), n:e[1], tot:Object.values(t).reduce((a, b) => a + b, 0) } : null; };
  const wensGang = x => { const w = pickwens(x); return w && w.gang ? [w.gang] : []; };
  const pogingen = [[kl, vastePick, 'kleurgenoten hebben pick in'], [leden, vastePick, 'de familie heeft pick in'], [kl.concat(leden), wensGang, 'zoals de pickwens van de familie:'], [[c], bulkLocs, 'ligt nu op bulk in'], [kl.concat(leden), bulkLocs, 'de familie ligt op bulk in']];
  for(const [cs, f, t] of pogingen){ const v = top(cs, f); if(v) return Object.assign({}, v.h, { reden:t + ' ' + v.h.gang + (v.tot > 1 ? ' (' + v.n + ' van ' + v.tot + ')' : '') }); }
  return null;
}
// Picklocaties: de groep krijgt één voorstel = de gang waar de meeste producten van de groep nu staan (pick of bulk); zonder plek: de pickwens van de groep
// (de groep = de families van deze groep die in de tab staan, zoals de kop van de groep)
const GV = { m:{}, fks:{} };
function groepVoorstel(gk){
  if(gk in GV.m) return GV.m[gk];
  const cs = famCodes([...(GV.fks[gk] || new Set(R().groepLeden(gk)))]), nu = staatNu(cs);
  let v = nu.length ? { h:halVan(nu[0][0]), n:nu[0][1], nu, reden:'de meeste producten van de groep staan nu in ' + nu[0][0] + ' (' + nu[0][1] + ')' } : null;
  if(!v){ const t = {}; cs.forEach(c => { const w = pickwens(c); if(w && w.gang) t[w.gang] = (t[w.gang] || 0) + 1; }); const e = Object.entries(t).sort((a, b) => b[1] - a[1])[0]; if(e) v = { h:halVan(e[0]), n:e[1], nu:[], reden:'zoals de pickwens van de groep (' + e[1] + ' producten in ' + e[0] + ')' }; }
  return (GV.m[gk] = v);
}
// staat een product duidelijk ergens anders (eigen pick of bulk elders, of de familie elders), dan is het een uitzondering met een eigen voorstel
function eigenPick(c, gang){
  const p = plekken(c), eig = plekGangen(c);
  if(eig.length){
    if(gang && eig.includes(gang)) return null;
    const top = staatNu([c])[0][0], pk = p.pick.find(x => (halVan(x.n) || {}).gang === top), bk = p.bulk.filter(x => (halVan(x.n) || {}).gang === top);
    return { h:halVan(top), reden:pk ? 'eigen pick ' + pk.n + ' in ' + top : 'eigen bulk in ' + top + ' (' + nf(som(bk)) + ' op ' + bk.slice(0, 2).map(x => x.n).join(', ') + ')' };
  }
  const nu = staatNu(fam(c).filter(bruikbaar));
  if(nu.length && nu[0][0] !== gang) return { h:halVan(nu[0][0]), reden:'de familie ' + R().famNaam(R().famVan(c)) + ' staat ' + nuTekst(nu) };
  return null;
}
// gewicht naar verhouding voor een andere maat: kg in de naam, per meter (zelfde dikte en breedte) of per m² (zelfde dikte)
function rekensom(c){
  const P = R(), m = P.maatGetallen(c);
  const leden = fam(c).filter(x => x !== c && bruikbaar(x) && !ribbel(x)).map(x => ({ c:x, kg:kgVast(x), g:P.maatGetallen(x) })).filter(x => x.kg > 0);
  if(m.kg > 0){
    const r = leden.filter(x => x.g.kg > 0).map(x => x.kg / x.g.kg), f = r.length && spreidOk(r) ? mediaan(r) : 1;
    const kg = Math.round(m.kg * f * 1000) / 1000;
    return { n:9, kg, som:fmt(m.kg) + ' kg in de naam' + (Math.abs(f - 1) > 0.02 ? ' × ' + fmt(Math.round(f * 100) / 100) + ' zoals de familie' : '') };
  }
  if(m.m > 0){
    const bron = leden.filter(x => x.g.m > 0 && x.g.mm === m.mm && x.g.cm === m.cm && JSON.stringify(x.g.dims) === JSON.stringify(m.dims));
    const r = bron.map(x => x.kg / x.g.m);
    if(r.length && spreidOk(r)){ const k = mediaan(r); return { n:r.length, kg:Math.round(k * m.m * 1000) / 1000, som:fmtKg(k) + ' kg per meter × ' + fmt(m.m) + ' m (zoals ' + bron.slice(0, 2).map(x => x.c).join(', ') + ')' }; }
  }
  if(m.m2 > 0){
    const bron = leden.filter(x => x.g.m2 > 0 && x.g.mm === m.mm);
    const r = bron.map(x => x.kg / x.g.m2);
    if(r.length && spreidOk(r)){ const k = mediaan(r); return { n:r.length, kg:Math.round(k * m.m2 * 1000) / 1000, som:fmtKg(k) + ' kg per m² × ' + fmt(Math.round(m.m2 * 100) / 100) + ' m² (zoals ' + bron.slice(0, 2).map(x => x.c).join(', ') + ')' }; }
  }
  return null;
}
// Gewicht controleren: voorstel alleen uit kleurgenoten (zelfde maat), een andere maat alleen met een rekensom; anders geen voorstel maar "Naar Te wegen"
function gewichtPunt(c){
  const P = R(); let g; try{ g = P.gewicht(c); }catch(e){ return null; }
  if(g.st === 'tewegen' || g.st === 'gewogen') return null;
  const mijn = g.kg > 0 ? g.kg : g.pq > 0 ? g.pq : null, geenPq = !(g.pq > 0);
  const gl = kleurgenoten(c).filter(x => !ribbel(x));
  let kl = gl.map(x => ({ c:x, kg:kgVast(x) })).filter(x => x.kg > 0);
  if(!kl.length) kl = gl.map(x => ({ c:x, kg:kgElk(x) })).filter(x => x.kg > 0);
  let vs = null;
  if(kl.length){
    // groepjes van gelijke gewichten (binnen 20%): alleen een duidelijke meerderheid geeft een voorstel; bij een gelijke stand (1 tegen 1, 2 tegen 2)
    // is niet te zeggen welke klopt: geen voorstel, beide Naar Te wegen (nooit elkaars waarde voorstellen)
    const vals = kl.map(x => ({ c:x.c, kg:x.kg })).concat(mijn ? [{ c, kg:mijn }] : []), gelijk = (a, b) => Math.abs(a - b) / Math.max(a, b) <= 0.2;
    const groepen = []; vals.slice().sort((a, b) => a.kg - b.kg).forEach(v => { const g = groepen.find(x => gelijk(x[0].kg, v.kg)); if(g) g.push(v); else groepen.push([v]); });
    groepen.sort((a, b) => b.length - a.length);
    const top = groepen[0], tweede = groepen[1], eigenG = groepen.find(g => g.some(v => v.c === c));
    if(tweede && tweede.length === top.length){
      const tegen = vals.filter(v => v.c !== c && !(eigenG && eigenG.includes(v)));
      if(mijn && tegen.length && (eigenG === top || eigenG === tweede)) return { reden:'Kleurgenoten (zelfde maat) zijn het oneens: ' + vals.slice(0, 4).map(v => v.c + ' ' + fmtKg(v.kg) + ' kg').join(' ↔ '), visie:'Gelijke stand: niet te zeggen welk gewicht klopt. Geen voorstel; wegen geeft zekerheid (ook voor ' + tegen.slice(0, 3).map(v => v.c).join(', ') + ').', voorstel:null, wegen:true, sig:'gelijk|' + vals.map(v => v.kg).sort().join(',') };
      if(!mijn && geenPq) return { reden:'Picqer heeft geen gewicht en de kleurgenoten zijn het oneens (' + kl.slice(0, 3).map(x => x.c + ' ' + fmtKg(x.kg) + ' kg').join(' ↔ ') + ')', visie:'Gelijke stand bij de kleurgenoten: geen voorstel, wegen.', voorstel:null, wegen:true, sig:'gelijk0|' + kl.map(x => x.kg).sort().join(',') };
    }
    const meer = (mijn ? groepen.filter(g => !g.some(v => v.c === c)) : groepen)[0];
    if(meer && (!eigenG || meer.length > eigenG.length) && !(tweede && tweede.length === top.length && !mijn)){ const mk = mediaan(meer.map(x => x.kg)); vs = { kg:mk, bron:'kl', som:'kleurgenoten (zelfde maat) ' + meer.slice(0, 3).map(x => x.c + ' ' + fmtKg(x.kg) + ' kg').join(', '), sig:'kl|' + mk }; }
    else if(eigenG && mijn) vs = { kg:mijn, bron:'kl', som:'kleurgenoten (zelfde maat)', sig:'kl|' + mijn };
  }
  else { const r = rekensom(c); if(r) vs = { kg:r.kg, n:r.n, bron:'som', som:'andere maat, naar verhouding: ' + r.som, sig:'som|' + r.kg }; }
  const kop = geenPq ? (g.st === 'vertrouwd' ? 'Gewicht is vertrouwd (' + fmtKg(mijn) + ' kg) terwijl Picqer geen gewicht heeft' : 'Picqer heeft geen gewicht') : '';
  if(vs){
    const af = mijn ? Math.abs(mijn - vs.kg) / vs.kg : null;
    if(geenPq && !(af !== null && af <= 0.25 && g.st === 'vertrouwd')) return { reden:kop, visie:vs.bron === 'kl' ? 'Kleurgenoten van dezelfde maat wegen ' + fmtKg(vs.kg) + ' kg; dat is het beste voorstel tot het gewogen is.' : 'Er is geen kleurgenoot van dezelfde maat, dus naar verhouding gerekend: ' + vs.som.replace(/^andere maat, naar verhouding: /, '') + '.', voorstel:{ kg:vs.kg, tekst:'Voorstel: ' + fmtKg(vs.kg) + ' kg (' + vs.som + ')' }, sig:'geenpq|' + (mijn || '') + '|' + vs.sig };
    // afwijking melden: tegen kleurgenoten, of tegen een rekensom met minstens twee andere maten (één ander product is te weinig bewijs)
    if(mijn && af > 0.25 && (vs.bron === 'kl' || vs.n >= 2)) return { reden:'Gewicht ' + fmtKg(mijn) + ' kg wijkt ' + Math.round(af * 100) + '% af van ' + (vs.bron === 'kl' ? 'de kleurgenoten (' + fmtKg(vs.kg) + ' kg)' : 'de rekensom (' + fmtKg(vs.kg) + ' kg)'), visie:vs.bron === 'kl' ? 'Zelfde familie en zelfde maat horen hetzelfde te wegen; zo’n verschil is meestal een fout in Picqer.' : 'Naar verhouding (' + vs.som.replace(/^andere maat, naar verhouding: /, '') + ') zou het ' + fmtKg(vs.kg) + ' kg zijn; zo’n verschil is meestal een fout in Picqer.', voorstel:{ kg:vs.kg, tekst:'Voorstel: ' + fmtKg(vs.kg) + ' kg (' + vs.som + ', nu ' + fmtKg(mijn) + ')' }, sig:'af|' + mijn + '|' + vs.sig };
    return null;
  }
  if(geenPq) return { reden:kop, visie:'Geen kleurgenoot van dezelfde maat met een gewicht en geen rekensom (per meter, per m² of kg in de naam): Claude doet geen voorstel. Wegen is zeker.', voorstel:null, wegen:true, sig:'geenvs|' + (mijn || '') + '|' + g.st };
  return null;
}

/* ---------- de categorieën: één punt per product per tab ---------- */
const PALL = ['pallet', 'deel', 'bulk'];
function volleCalc(c){ const k = kgVast(c) || kgElk(c), s = num(eigen(c, 'spp')); return k > 0 && s > 0 ? Math.ceil(k * s + 15) : null; }
// verkoop vergelijkbaar (binnen 3×): dan verklaart verkoop het verschil in soort niet
function verkoopGelijk(c, gl){ const v = R().vk28(c) || 0, w = mediaan(gl.map(x => R().vk28(x) || 0)) || 0; return v === 0 || w === 0 || (v / w < 3 && w / v < 3); }
function berekenen(){
  const P = R(), uit = { picklocaties:[], pickklaar:[], bulklocaties:[], bulkeraf:[], hercontrole:[], gewicht:[], tewegen:[], aantal:[] }, per = {};
  Object.keys(uit).forEach(k => { per[k] = {}; });
  const codes = Object.keys(WH.D.P).filter(c => bruikbaar(c) && soortVan(c));
  // vooraf: welke families staan per groep open in Picklocaties (daaruit komt het groepsvoorstel)
  GV.m = {}; GV.fks = {};
  codes.forEach(c => { const so = soortVan(c); if(vastePick(c).length || !(['pallet', 'deel'].includes(so) || moetPick(c))) return; const w = pickwens(c); if(w && w.gang && !S.wijzig.has(c)) return; const gk = P.groepVan(c).k; (GV.fks[gk] = GV.fks[gk] || new Set()).add(P.famVan(c)); });
  codes.forEach(c => {
    const so = soortVan(c), g = P.groepVan(c), fk = P.famVan(c);
    const punt = (cat, reden, visie, voorstel, sig, extra) => {
      let it = per[cat][c];
      if(!it){ it = per[cat][c] = { c, cat, naam:naam(c), fk, fam:P.famNaam(fk), gk:g.k, gnaam:g.naam, abc:abc(c), so, loc:'', redenen:[], voorstellen:[], sigs:[] }; uit[cat].push(it); }
      // één voorstel per veld: het eerste (eigen data van het product) gaat voor, een tweede voor hetzelfde veld staat alleen als reden
      const soortGelijk = (a, b) => (a.soort && b.soort) || (a.veld && a.veld === b.veld) || (a.kg && b.kg);
      it.redenen.push({ t:reden, visie:visie || '' }); if(voorstel && !it.voorstellen.some(v => soortGelijk(v, voorstel))) it.voorstellen.push(voorstel); it.sigs.push(sig || reden);
      if(extra) Object.assign(it, extra);
      return it;
    };
    const pick = vastePick(c);
    // 3 Picklocaties: Pallet of Deel zonder vaste picklocatie in Picqer, en alles met "moet pick krijgen". Met een pickwens = beslist: werklijst "Klaar voor Picqer".
    if(!pick.length && (['pallet', 'deel'].includes(so) || moetPick(c))){
      const w = pickwens(c), reden = moetPick(c) ? 'Keuze "moet pick krijgen", nog geen picklocatie in Picqer' : SOORTT[so] + ' zonder picklocatie in Picqer';
      if(w && w.gang && !S.wijzig.has(c)) punt('pickklaar', reden, '', null, 'w', { wens:w, loc:w.gang });
      else {
        const gv = groepVoorstel(g.k), eig = w && w.gang ? { h:halVan(w.gang), reden:'jouw eerdere pickwens' } : eigenPick(c, gv && gv.h ? gv.h.gang : '');
        const v = eig ? Object.assign({}, eig.h, { reden:eig.reden }) : gv && gv.h ? Object.assign({}, gv.h, { reden:gv.reden }) : pickVoorstel(c);
        punt('picklocaties', reden, v ? 'Pick in ' + R().halTekst(v) + ': ' + v.reden + '.' : 'Geen plek in de groep of familie: kies zelf hal, gedeelte en gang.', v ? { pick:v, tekst:'Voorstel: ' + R().halTekst(v, true) + (eig ? ' (' + eig.reden + ')' : '') } : null, 'p', { pv:v, loc:v ? v.gang : '', uitz:!!(eig && gv && gv.h && eig.h && eig.h.gang !== gv.h.gang) });
      }
    }
    // 4 Bulklocaties: soort Bulk maar met een picklocatie in Picqer. "Alleen bulk" = beslist: werklijst "picklocatie eraf".
    if(so === 'bulk' && pick.length){
      const sig = pick.join(',');
      if(S.klopt['bulkeraf|' + c]) punt('bulkeraf', 'Picklocatie ' + pick.join(', ') + ' eraf in Picqer', '', null, sig, { loc:pick[0] });
      else punt('bulklocaties', 'Soort Bulk, maar Picqer heeft picklocatie ' + pick.join(', '), 'Bulk = alleen op bulk, geen picklocatie. Klopt de soort, dan moet de picklocatie er in Picqer af; komt het toch naar pick, dan is het Deel of Pallet.', null, sig, { loc:pick[0] });
    }
    // 5 Hercontrole: duidelijke tegenstrijdigheden, elk met Claudes visie en een voorstel
    let bulkV = 0, vst = 0; try{ const f = P.locInfo(c); bulkV = (f.bulk || []).reduce((s, x) => s + (x.v || 0), 0); vst = f.vst || 0; }catch(e){}
    if(so === 'pick' && (bulkV > 0 || vst > 0)) punt('hercontrole', 'Soort Pick, maar er ligt ' + (bulkV > 0 ? nf(bulkV) + ' op bulk' : '') + (bulkV > 0 && vst > 0 ? ' en ' : '') + (vst > 0 ? nf(vst) + ' in VST' : ''), 'Pick = kleine hoeveelheden zonder bulk. Er ligt voorraad op ' + (bulkV > 0 ? 'bulk' : 'VST') + ', dus het komt in grotere hoeveelheden binnen dan op pick past: dat is Deel.', { soort:'deel', tekst:'Voorstel: Deel' }, 'pickbulk');
    if(so === 'weg' || so === 'backorder'){
      const w = so === 'backorder' ? 'backorder' : wegVan(c), hier = voorraadHier(c), bo = (P.backorders(c) || {}).stuks || 0;
      if(w === 'archief' && hier > 0) punt('hercontrole', 'Weg · Archief, maar er ligt ' + nf(hier) + ' op een locatie', 'Archief = klaar met dit product, maar er ligt nog voorraad. Zolang het verkocht wordt hoort het bij Pick (of Deel als het per pallet ligt); anders afboeken.', { soort:'pick', tekst:'Voorstel: Pick (of Deel als het per pallet komt)' }, 'archief|' + (hier > 0));
      if(w === 'backorder' && hier > bo) punt('hercontrole', 'Backorder, maar er ligt ' + nf(hier) + ' en er staan ' + nf(bo) + ' in backorder', 'Backorder = alleen ingekocht voor backorders. Er ligt meer dan de backorders vragen: de rest heeft een plek en een soort nodig.', { soort:'pick', tekst:'Voorstel: Pick (of Deel als het per pallet komt)' }, 'bo|' + (hier > bo));
    }
    const h = num(eigen(c, 'hoogte'));
    if(h > 0 && h % 10 !== 0) punt('hercontrole', 'Hoogte ' + h + ' cm staat niet op 10 cm', 'Pallethoogtes worden altijd naar boven afgerond op 10 cm.', { veld:'hoogte', waarde:String(Math.ceil(h / 10) * 10), tekst:'Voorstel: ' + Math.ceil(h / 10) * 10 + ' cm' }, 'h10|' + h);
    const gl = kleurgenoten(c).filter(x => soortVan(x) && !ribbel(x));
    if(!ZONDER.has(so)) ['maat', 'hoogte'].forEach(k => {
      const mijn = eigen(c, k), glw = gl.filter(x => !ZONDER.has(soortVan(x))); if(!mijn || glw.length < 2) return;
      const ander = glw.map(x => eigen(x, k)).filter(Boolean); if(ander.length < 2) return;
      const tel = {}; ander.forEach(v => { tel[v] = (tel[v] || 0) + 1; });
      const [top, n] = Object.entries(tel).sort((x, y) => y[1] - x[1])[0];
      if(String(top) !== String(mijn) && n >= 2 && n > ander.length / 2) punt('hercontrole', 'Kleurgenoten (zelfde maat) hebben ' + (k === 'maat' ? 'palletmaat' : 'hoogte') + ' ' + top + (k === 'hoogte' ? ' cm' : '') + ' (' + n + ' van ' + ander.length + '), dit product ' + mijn, 'Zelfde familie en maat staan meestal op dezelfde pallet; een afwijkende ' + (k === 'maat' ? 'palletmaat' : 'hoogte') + ' is vaak een tikfout.', { veld:k, waarde:String(top), tekst:'Voorstel: ' + top + (k === 'hoogte' ? ' cm' : '') }, k + '|' + mijn + '|' + top);
    });
    if(PALL.includes(so)){
      const vp = volleCalc(c), uitleg = vp ? 'kg per stuk ' + fmtKg(kgVast(c) || kgElk(c)) + ' × ' + nf(num(eigen(c, 'spp'))) + ' per pallet + 15' : '';
      if(vp && vp > 1500) punt('hercontrole', 'Volle pallet ' + nf(vp) + ' kg is boven 1.500 kg (' + uitleg + ')', 'Een volle pallet van ' + nf(vp) + ' kg is onwaarschijnlijk: meestal klopt het gewicht per stuk of het aantal per pallet niet.', { tekst:'Voorstel: controleer gewicht per stuk of aantal per pallet (Aanpassen)' }, 'vp>|' + vp);
      if(vp && vp < 50) punt('hercontrole', 'Volle pallet ' + nf(vp) + ' kg is onder 50 kg (' + uitleg + ')', 'Een volle pallet van ' + nf(vp) + ' kg is onwaarschijnlijk licht: meestal klopt het gewicht per stuk of het aantal per pallet niet.', { tekst:'Voorstel: controleer gewicht per stuk of aantal per pallet (Aanpassen)' }, 'vp<|' + vp);
    }
    // andere soort dan de kleurgenoten: nooit als een van beide Weg is (Weg is een eigen keuze per product)
    if(!ZONDER.has(so)){
      const glw = gl.filter(x => !ZONDER.has(soortVan(x))), andere = [...new Set(glw.map(soortVan))].filter(x => x && x !== so);
      if(andere.length && glw.length >= 2){ const top = andere.map(a => [a, glw.filter(x => soortVan(x) === a).length]).sort((a, b) => b[1] - a[1])[0];
        if(top[1] > glw.length / 2 && verkoopGelijk(c, glw)) punt('hercontrole', 'Kleurgenoten (zelfde maat) hebben soort ' + SOORTT[top[0]] + ' (' + top[1] + ' van ' + glw.length + '), dit product ' + SOORTT[so], 'De verkoop is vergelijkbaar, dus ze komen waarschijnlijk op dezelfde manier binnen; het verschil in soort lijkt geen bewuste keuze.', { soort:top[0], tekst:'Voorstel: ' + SOORTT[top[0]] }, 'soort|' + so + '|' + top[0]); }
    }
    // 6 Gewicht controleren
    if(!ZONDER.has(so) && !ribbel(c)){ const gw = gewichtPunt(c); if(gw) punt('gewicht', gw.reden, gw.visie, gw.voorstel ? Object.assign({ kg:gw.voorstel.kg }, gw.voorstel) : null, gw.sig, { wegen:!!gw.wegen }); }
    // 7 Te wegen
    try{ if(P.gewicht(c).st === 'tewegen') punt('tewegen', 'Gewicht staat op te wegen', '', null, 'w', { loc:pick[0] || bulkLocs(c)[0] || '' }); }catch(e){}
    // 8 Aantal per pallet
    if(PALL.includes(so) && !ribbel(c)){
      const mijn = eigen(c, 'spp');
      if(mijn){
        const ander = gl.map(x => ({ c:x, v:eigen(x, 'spp') })).filter(x => x.v);
        if(ander.length >= 1){ const tel = {}; ander.forEach(x => { tel[x.v] = (tel[x.v] || 0) + 1; }); const [top, n] = Object.entries(tel).sort((x, y) => y[1] - x[1])[0];
          if(String(top) !== String(mijn)) punt('aantal', 'Kleurgenoten (zelfde maat) hebben ' + nf(num(top)) + ' per pallet (' + n + ' van ' + ander.length + '), dit product ' + nf(num(mijn)), 'Zelfde familie en maat komen meestal met hetzelfde aantal per pallet; is het verschil terecht, tik dan Klopt zo.', { veld:'spp', waarde:String(top), tekst:'Voorstel: ' + nf(num(top)) + ' per pallet (zoals de kleurgenoten)' }, 'kl|' + mijn + '|' + top); }
        try{ const lab = WHPD.intern.oudeWaarde(c, 'spp'); if(lab && lab.v && !lab.conflict && String(num(lab.v)) !== String(num(mijn))) punt('aantal', 'Palletlabel (productgeheugen) zegt ' + nf(num(lab.v)) + ' per pallet, productdata ' + nf(num(mijn)), 'Het palletlabel is wat er echt op de vloer stond; productdata wijkt daarvan af.', { veld:'spp', waarde:String(num(lab.v)), tekst:'Voorstel: ' + nf(num(lab.v)) + ' per pallet (zoals het palletlabel)' }, 'lab|' + mijn + '|' + lab.v); }catch(e){}
      }
    }
  });
  Object.values(uit).forEach(l => l.forEach(it => { it.sig = it.sigs.join('§'); it.reden = it.redenen.map(r => r.t).join(' · '); it.voorstel = it.voorstellen[0] || null; }));
  // "Klopt zo" en "Later" onthouden: alleen terug als de data verandert (sig verandert)
  ['picklocaties', 'bulklocaties', 'hercontrole', 'gewicht', 'tewegen', 'aantal'].forEach(k => { uit[k] = uit[k].filter(x => !isKlopt(k, x.c, x.sig)); });
  // staan in een groep alleen nog uitzonderingen open, dan wordt hun eigen voorstel het groepsvoorstel (niets meer uitgevinkt)
  const pg = {}; uit.picklocaties.forEach(x => (pg[x.gk] = pg[x.gk] || []).push(x));
  Object.entries(pg).forEach(([gk, l]) => {
    if(!l.every(x => x.uitz)) return;
    const t = {}; l.forEach(x => { if(x.pv && x.pv.gang) t[x.pv.gang] = (t[x.pv.gang] || 0) + 1; });
    const top = Object.entries(t).sort((a, b) => b[1] - a[1])[0]; if(!top) return;
    GV.m[gk] = { h:halVan(top[0]), n:top[1], nu:[], reden:l.find(x => x.pv && x.pv.gang === top[0]).pv.reden };
    l.forEach(x => { x.uitz = !!(x.pv && x.pv.gang !== top[0]); });
  });
  const sorteer = l => l.sort((x, y) => rang(x.abc) - rang(y.abc) || x.fam.localeCompare(y.fam, 'nl', { numeric:true }) || x.c.localeCompare(y.c));
  Object.keys(uit).forEach(k => sorteer(uit[k]));
  return uit;
}

function cats(){
  const R_ = R(); if(!R_ || !R_.S.klaar || !S.klaar) return null;
  const key = R_.S.ver + '|' + R_.S.dataVer + '|' + Object.keys(S.klopt).length + '|' + JSON.stringify(Object.values(S.klopt).map(x => x.sig).length) + '|' + [...S.wijzig].join(',') + '|' + (window.WHTAAK && WHTAAK.later ? Object.keys(WHTAAK.later.items()).length : 0) + '|' + Object.keys(WHPD.S.pd || {}).length;
  if(S.memo && S.memoKey === key) return S.memo;
  S.memo = berekenen(); S.memoKey = key; return S.memo;
}
// Later-tab: Doorloop-vragen op Later en wat in een tab op Later is gezet, één punt per product
const TVRAAG = { soort:'Soort', gewicht:'Gewicht', spp:'Hoeveelheid: stuks per pallet', maat:'Hoeveelheid: palletmaat', hoogte:'Hoeveelheid: hoogte', lvl:'Hoeveelheid: aanvullen bij', maxpick:'Hoeveelheid: max op pick', rl:'Hoeveelheid: lengte volle rol', rmax:'Hoeveelheid: max rollen per pallet' };
const TABNAAM = Object.fromEntries(TABS);
function laterItems(){
  const P = R(), per = {}, uit = [];
  const voeg = (c, t, op, opm, bron) => { if(!WH.D.P[c]) return; let it = per[c]; if(!it){ const g = P.groepVan(c), fk = P.famVan(c); it = per[c] = { c, cat:'later', naam:naam(c), fk, fam:P.famNaam(fk), gk:g.k, gnaam:g.naam, abc:abc(c), so:soortVan(c), loc:'', redenen:[], voorstellen:[], bron:[], op }; uit.push(it); }
    it.redenen.push({ t:t + ' · sinds ' + dt(op) + (opm ? ' · ' + opm : ''), visie:'' }); it.bron.push(bron); if(String(op) < String(it.op)) it.op = op; };
  (window.WHTAAK && WHTAAK.later ? WHTAAK.later.lijst() : []).forEach(x => voeg(x.c, 'Doorloop-vraag ' + (TVRAAG[x.t] || x.t), x.op, x.opm, { dl:x.t }));
  laterTabs().forEach(x => voeg(x.c, 'Tab ' + (TABNAAM[x.cat] || x.cat), x.op, x.opm && !/^Later · tab/.test(x.opm) ? x.opm : '', { tab:x.cat }));
  return uit.sort((a, b) => String(a.op).localeCompare(String(b.op)));
}
// Twijfel: soort "weet ik nog niet" — staat in tab Later onder "Twijfel (n)"
function twijfelItems(){
  const P = R();
  return Object.keys(WH.D.P).filter(c => bruikbaar(c) && soortNu(c) === 'twijfel').map(c => { const g = P.groepVan(c), fk = P.famVan(c); return { c, cat:'twijfel', naam:naam(c), fk, fam:P.famNaam(fk), gk:g.k, gnaam:g.naam, abc:abc(c), so:'twijfel', loc:'', redenen:[{ t:'Soort Twijfel: nog niet beslist', visie:'' }], voorstellen:[], sig:'twijfel' }; });
}
function tel(){
  const c = cats(); if(!c) return null;
  return { overzicht:1, later:laterItems().length + twijfelItems().length, picklocaties:c.picklocaties.length, bulklocaties:c.bulklocaties.length, hercontrole:c.hercontrole.length, gewicht:c.gewicht.length, tewegen:c.tewegen.length, aantal:c.aantal.length };
}

/* ---------- acties (alleen voorstellen; Daan beslist met één tik; kopie vooraf) ---------- */
async function kopie(codes){ try{ return await R().kopieProductdata(codes, 8); }catch(e){ WH.toast('Kopie van productdata maken lukte niet: niets vastgelegd (' + (e.message || e) + ')', 6000); return null; } }
function zetSoort(c, so, weg){
  const P = R(), t = nu(), voor = P.soortWaarde(c, P.info(c)).v;
  P.poZet(c, p => { delete p.heropend; p.so = { v:so, st:'aangepast', voor, t, door:'Daan' }; if(so === 'weg') p.weg = { v:weg, st:'aangepast', voor:(P.wegWaarde(c, P.info(c)) || {}).v || '', t }; else delete p.weg; });
}
function neemOverZonderKopie(it){
  const P = R(), c = it.c, t = nu();
  (it.voorstellen || []).forEach(v => {
    if(v.soort) zetSoort(c, v.soort, v.weg);
    else if(v.veld){ const voor = String(P.waarde(c, v.veld, P.info(c)).v || ''); P.poZet(c, p => { delete p.heropend; p.f[v.veld] = { v:String(v.waarde), st:'aangepast', voor, t, door:'Daan' }; }); }
    else if(v.kg){ P.poZet(c, p => { delete p.heropend; p.gew = { st:'vertrouwd', kg:v.kg, t, door:'Daan', via:'controle' }; }); }
  });
}
const heeftVoorstel = it => (it.voorstellen || []).some(v => v.soort || v.veld || v.kg);
async function bewaarPickwensen(lijst){   // [{ c, h:{ hal, deel, gang }, opm }]
  if(!lijst.length || !(await kopie(lijst.map(x => x.c)))) return false;
  const t = nu(), codes = lijst.map(x => x.c), rijen = [];
  for(let i = 0; i < codes.length; i += 60){ const q = codes.slice(i, i + 60).map(c => '"' + String(c).replace(/"/g, '\\"') + '"').join(','); rijen.push(...((await WH.api('GET', 'productdata?productcode=in.(' + encodeURIComponent(q) + ')&select=productcode,data,meta')) || [])); }
  const op = lijst.map(x => { const r = rijen.find(y => y.productcode === x.c) || { productcode:x.c, data:{}, meta:{} };
    const data = Object.assign({}, r.data, { pickwens:{ hal:x.h.hal, ged:x.h.hal === 'C' ? (x.h.deel || '') : '', gang:x.h.gang, opm:x.opm || '' } }), meta = Object.assign({}, r.meta, { pickwens:{ op:t, bron:'pd2', uit:'Te doen · Picklocaties' } });
    return { productcode:x.c, data, meta, updated_at:t }; });
  await WH.upsert('productdata', op, 'productcode');
  op.forEach(r => { try{ WHPD.S.pd[r.productcode] = { data:r.data, meta:r.meta, t }; }catch(e){} S.wijzig.delete(r.productcode); });
  S.memo = null;
  const oud = {}; codes.forEach(c => { const r = rijen.find(y => y.productcode === c); oud[c] = r ? { data:r.data || {}, meta:r.meta || {} } : null; });
  return oud;   // de rijen zoals ze waren, voor "ongedaan maken"
}
function flush(){ try{ R().flush && R().flush(); }catch(e){} S.memo = null; }

/* ---------- weergave: groep → familie → product ---------- */
const plekVan = x => x.cat === 'pickklaar' ? (x.wens && x.wens.gang) : x.loc;
const filt = l => l.filter(x => { const h = halVan(plekVan(x)); if(!S.f.hal) return true; if(!h || h.hal !== S.f.hal) return false; if(S.f.deel && h.deel !== S.f.deel) return false; if(S.f.gang && h.gang !== S.f.gang) return false; return true; });
function filterBalk(lijst){
  const hs = lijst.map(x => halVan(plekVan(x))).filter(Boolean); if(!hs.length) return '';
  const hallen = [...new Set(hs.map(h => h.hal))].sort(), delen = [...new Set(hs.filter(h => h.hal === 'C').map(h => h.deel))].sort();
  const gangen = [...new Set(hs.filter(h => (!S.f.hal || h.hal === S.f.hal) && (!S.f.deel || h.deel === S.f.deel)).map(h => h.gang))].sort();
  return `<div class="cp-filter"><label>Hal <select data-cp-f="hal"><option value="">alle</option>${hallen.map(h => `<option${S.f.hal === h ? ' selected' : ''}>${esc(h)}</option>`).join('')}</select></label>
    ${S.f.hal === 'C' ? `<label>Gedeelte <select data-cp-f="deel"><option value="">alle</option>${delen.map(d => `<option${S.f.deel === d ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select></label>` : ''}
    <label>Gang <select data-cp-f="gang"><option value="">alle</option>${gangen.map(g => `<option${S.f.gang === g ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select></label></div>`;
}
function groepeer(items){
  const g = new Map();
  items.forEach(x => { let e = g.get(x.gk); if(!e){ e = { k:x.gk, naam:x.gnaam, fams:new Map(), items:[] }; g.set(x.gk, e); } e.items.push(x); let f = e.fams.get(x.fk); if(!f){ f = { fk:x.fk, naam:x.fam, items:[] }; e.fams.set(x.fk, f); } f.items.push(x); });
  return [...g.values()].map(e => Object.assign(e, { fams:[...e.fams.values()], kl:Math.min(...e.items.map(x => rang(x.abc))) })).sort((a, b) => a.kl - b.kl || b.items.length - a.items.length || a.naam.localeCompare(b.naam, 'nl'));
}
const sk = (cat, c) => cat + '|' + c;
// aangevinkt: alles, behalve wat Daan uitvinkte; een uitzondering (staat duidelijk ergens anders) begint uitgevinkt
const aan = (cat, x) => x.uitz ? S.aan.has(sk(cat, x.c)) : !S.uit.has(sk(cat, x.c));
const zetAan = (cat, x, ja) => { const k = sk(cat, x.c); if(ja){ S.uit.delete(k); S.aan.add(k); } else { S.aan.delete(k); S.uit.add(k); } };
const knop = (a, t, cat, gk, ex, v) => `<button type="button" class="cp-b${ex ? ' ' + ex : ''}" data-cp="${a}" data-cat="${esc(cat)}" data-gk="${esc(gk)}"${v !== undefined ? ` data-v="${esc(v)}"` : ''}>${esc(t)}</button>`;
// kiezen bij één product: dezelfde actie, alleen voor dit product (meteen bewaard)
const rknop = (a, t, cat, c, ex, v) => `<button type="button" class="cp-b klein${ex ? ' ' + ex : ''}" data-cp="${a}" data-een="${esc(c)}" data-cat="${esc(cat)}"${v !== undefined ? ` data-v="${esc(v)}"` : ''}>${esc(t)}</button>`;
function rijHtml(cat, x, o){
  const on = aan(cat, x);
  return `<div class="cp-item${on ? '' : ' uit'}${x.uitz ? ' uitz' : ''}" data-c="${esc(x.c)}" data-cat="${esc(cat)}"><label class="cp-v"><input type="checkbox" data-cp-sel="${esc(sk(cat, x.c))}"${on ? ' checked' : ''} aria-label="${esc(x.c)} meenemen"></label>
    <div class="cp-m"><div class="cp-t"><code class="cp-code">${esc(x.c)}</code> ${esc(x.naam)}</div>${feitenHtml(x.c)}
    ${x.uitz ? '<div class="cp-uitz">Uitzondering: staat ergens anders dan de groep, daarom uitgevinkt.</div>' : ''}
    ${x.redenen.map(r => `<div class="cp-r">${esc(r.t)}${r.visie ? `<div class="cp-visie"><b>Claudes visie:</b> ${esc(r.visie)}</div>` : ''}</div>`).join('')}
    ${x.voorstellen.length ? `<div class="cp-vs">${x.voorstellen.map(v => esc(v.tekst)).join(' · ')}</div>` : ''}${o.rijExtra ? o.rijExtra(x) : ''}
    <div class="cp-kn">${o.rijKnop ? o.rijKnop(x) : ''}<a class="cp-b klein" href="#/doorloop/p/${encodeURIComponent(x.c)}/${esc(cat)}" data-taak="0.4">Aanpassen</a></div></div></div>`;
}
function famHtml(cat, f, o){
  const n = f.items.filter(x => aan(cat, x)).length, l = o.sorteer ? o.sorteer(f.items.slice()) : f.items;
  return `<div class="cp-famblok"><label class="cp-famkop"><input type="checkbox" data-cp-fam="${esc(cat + '|' + f.fk)}"${n === f.items.length ? ' checked' : ''} aria-label="familie ${esc(f.naam)} meenemen"> <b>${esc(f.naam)}</b> <span class="muted klein">${n} van ${f.items.length} aangevinkt</span></label>
    <div class="cp-gt">${esc(totaalTekst(totaal(f.items.map(x => x.c)), staatNu(famCodes([f.fk]))))}</div>
    <div class="cp-prods">${l.map(x => rijHtml(cat, x, o)).join('')}</div></div>`;
}
function groepHtml(cat, gr, o){
  const sel = gr.items.filter(x => aan(cat, x)), n = gr.items.length, uitgevinkt = gr.items.filter(x => !aan(cat, x)), open = S.open.has(cat + '|' + gr.k);
  const kl = ['A', 'B', 'C'].filter(k => gr.items.some(x => x.abc === k)).join('/') || '–';
  return `<section class="cp-grp" data-cat="${esc(cat)}" data-gk="${esc(gr.k)}"><div class="cp-gk"><h3>${esc(gr.naam)} <span class="cp-n">(${n})</span></h3><span class="cp-k">${esc(kl)} · ${mv(gr.fams.length, 'familie', 'families')}</span></div>
    <div class="cp-gt">${esc(totaalTekst(totaal(gr.items.map(x => x.c)), staatNu(famCodes(gr.fams.map(f => f.fk)))))}</div>
    ${o.uitleg ? `<div class="cp-gu">${o.uitleg(gr, sel)}</div>` : ''}
    <div class="cp-sel"><span class="cp-sl">Selectie is:</span>${sel.length ? o.keuzes(gr, sel) : '<span class="muted klein">niets aangevinkt</span>'}</div>
    <div class="cp-geldt">Geldt voor ${sel.length === n ? (n === 1 ? '' : 'alle ') + mv(n, 'product', 'producten') : sel.length + ' van ' + n}: ${sel.slice(0, 14).map(x => `<code class="cp-code">${esc(x.c)}</code>`).join(' ')}${sel.length > 14 ? ' … +' + (sel.length - 14) : ''}${uitgevinkt.length ? `<span class="muted"> · uitgevinkt (blijven staan): ${uitgevinkt.slice(0, 8).map(x => esc(x.c)).join(', ')}${uitgevinkt.length > 8 ? ' …' : ''}</span>` : ''}</div>
    <details class="cp-det" data-open="${esc(cat + '|' + gr.k)}"${open ? ' open' : ''}><summary>Uitklappen: ${gr.fams.length > 1 ? mv(gr.fams.length, 'familie', 'families') + ', ' : ''}${mv(n, 'product', 'producten')} met de feiten · uitvinken voor uitzonderingen</summary>
    <div class="cp-rij">${knop('g-alle', 'Alles aanvinken', cat, gr.k)}${knop('g-geen', 'Alles uitvinken', cat, gr.k)}</div>${gr.fams.map(f => famHtml(cat, f, o)).join('')}</details></section>`;
}
function lijstHtml(cat, items, o){
  if(!items.length) return `<p class="muted">${esc(o.leeg || 'Niets meer in deze tab.')}</p>`;
  return `<div class="cp-grps">${groepeer(items).map(gr => groepHtml(cat, gr, o)).join('')}</div>`;
}
// Klaar voor Picqer: werklijst per hal → gedeelte → gang, met "Wijzig"
function werklijstHtml(titel, items, wat, wijzigActie){
  if(!items.length) return '';
  const per = {};
  items.forEach(x => { const h = halVan(plekVan(x)) || { hal:'?', deel:'', gang:'?' }; const k = 'Hal ' + h.hal + (h.deel ? ' · gedeelte ' + h.deel : '') + ' · gang ' + h.gang; (per[k] = per[k] || []).push(x); });
  return `<section class="cp-klaar" id="cp-klaar"><h3>${esc(titel)} (${nf(items.length)})</h3><p class="muted klein">${esc(wat)} Doe je dat in Picqer, dan verdwijnt het hier vanzelf zodra Picqer het laat zien.</p>
    ${Object.keys(per).sort().map(k => `<div class="cp-gang"><h4>${esc(k)} <span class="muted klein">${per[k].length}</span></h4>${per[k].map(x => `<div class="cp-kl" data-c="${esc(x.c)}"><span><code class="cp-code">${esc(x.c)}</code> ${esc(x.naam)}${x.cat === 'bulkeraf' ? ' · picklocatie <code>' + esc(x.loc) + '</code> eraf' : ' · pick aanmaken' + (x.wens && x.wens.opm ? ' · ' + esc(x.wens.opm) : '')}</span><button type="button" class="cp-b" data-cp="${wijzigActie}" data-c="${esc(x.c)}" data-cat="${esc(x.cat)}">Wijzig</button></div>`).join('')}</div>`).join('')}</section>`;
}

/* ---------- de tabs: kiezen = meteen opslaan (met kopie), 3 seconden "Bewaard · ongedaan maken" ---------- */
const SOORTKNOP = (cat, gk, zonder) => `<span class="cp-ks">Andere soort:</span>${SOORTK.filter(k => k !== zonder).map(k => knop('g-soort', SOORTT[k], cat, gk, '', k)).join('')}${S.wegOpen.has(cat + '|' + gk) ? `<span class="cp-ks">Weg, welke?</span>${Object.entries(WEGT).map(([k, t]) => knop('g-weg', 'Weg · ' + t, cat, gk, 'hoofd', k)).join('')}` : ''}`;
// minder knoppen in beeld: de hoofdkeuze staat open, andere plek of soort achter "Anders…" (blijft open na herladen)
const anders = (cat, gk, inhoud) => `<details class="cp-anders" data-open="${esc('anders|' + cat + '|' + gk)}"${S.open.has('anders|' + cat + '|' + gk) || S.wegOpen.has(cat + '|' + gk) || S.keuze[cat + '|' + gk] ? ' open' : ''}><summary>Anders…</summary><div class="cp-sel">${inhoud}</div></details>`;
// andere plek kiezen: hal → gedeelte (bij C) → gang; het kiezen van de gang bewaart meteen
function plekKeuze(cat, gk){
  const k = S.keuze[cat + '|' + gk] || {}, G = R().gangen(), gangen = G.filter(h => (!k.hal || h.hal === k.hal) && (k.hal !== 'C' || !k.deel || h.deel === k.deel)), sk_ = x => esc(cat + '|' + gk + '|' + x);
  return `<span class="cp-wens"><span class="cp-ks">Andere plek:</span><label>hal <select data-cp-k="${sk_('hal')}">${['', 'A', 'B', 'C'].map(h => `<option value="${h}"${(k.hal || '') === h ? ' selected' : ''}>${h || 'kies'}</option>`).join('')}</select></label>
    ${k.hal === 'C' ? `<label>gedeelte <select data-cp-k="${sk_('deel')}">${['', 'C', 'D'].map(d => `<option value="${d}"${(k.deel || '') === d ? ' selected' : ''}>${d || 'kies'}</option>`).join('')}</select></label>` : ''}
    <label>gang <select data-cp-k="${sk_('gang')}"><option value="">kies (bewaart meteen)</option>${k.hal ? gangen.map(h => `<option>${esc(h.gang)}</option>`).join('') : ''}</select></label>
    <label>opmerking <input data-cp-k="${sk_('opm')}" value="${esc(k.opm || '')}" aria-label="opmerking"></label></span>`;
}
function tabPick(c){
  const open = c.picklocaties, klaar = c.pickklaar;
  const o = {
    uitleg:(gr) => { const gv = groepVoorstel(gr.k), u = gr.items.filter(x => x.uitz).length; return gv && gv.h ? `Claudes voorstel voor de groep: <b>${esc(R().halTekst(gv.h))}</b> — ${esc(gv.reden)}.${u ? ' ' + mv(u, 'product staat', 'producten staan') + ' duidelijk ergens anders: uitgevinkt, met een eigen voorstel bij het product.' : ''}` : 'Geen plek in de groep: kies hal, gedeelte en gang.'; },
    keuzes:(gr) => { const gv = groepVoorstel(gr.k); return `${gv && gv.h ? knop('g-pick', 'Pick in ' + R().halTekst(gv.h, true), 'picklocaties', gr.k, 'hoofd', gv.h.gang) : ''}${knop('g-later', 'Later', 'picklocaties', gr.k)}${anders('picklocaties', gr.k, plekKeuze('picklocaties', gr.k) + `<span class="cp-soort">${SOORTKNOP('picklocaties', gr.k)}</span>`)}`; },
    rijKnop:x => x.pv ? rknop('g-pick', 'Pick in ' + R().halTekst(x.pv, true), 'picklocaties', x.c, x.uitz ? 'hoofd' : '', x.pv.gang) : ''
  };
  return `${filterBalk(open.concat(klaar))}<p class="muted klein">Pallet of Deel zonder picklocatie in Picqer, en alles met "moet pick krijgen". Eén tik bewaart de pickwens; daarna staat het onderaan op de werklijst per hal → gedeelte → gang. Picqer koppelen doe je zelf.</p>
    ${lijstHtml('picklocaties', filt(open), o)}
    ${werklijstHtml('Klaar voor Picqer', filt(klaar), 'Pick aanmaken in Picqer op de gekozen plek.', 'wijzig-pick')}`;
}
function tabBulk(c){
  const o = { keuzes:(gr) => `${knop('g-bulkok', 'Alleen bulk (picklocatie eraf)', 'bulklocaties', gr.k, 'hoofd')}${knop('g-soort', 'Fout, wordt: Deel', 'bulklocaties', gr.k, '', 'deel')}${knop('g-soort', 'Fout, wordt: Pallet', 'bulklocaties', gr.k, '', 'pallet')}${knop('g-later', 'Later', 'bulklocaties', gr.k)}`,
    uitleg:() => 'Soort Bulk, maar Picqer heeft nog een picklocatie.', rijKnop:x => rknop('g-bulkok', 'Alleen bulk', 'bulklocaties', x.c) };
  return `${filterBalk(c.bulklocaties.concat(c.bulkeraf))}<p class="muted klein">"Alleen bulk" zet het onderaan op de werklijst: de picklocatie moet in Picqer eraf (dat doe je zelf).</p>
    ${lijstHtml('bulklocaties', filt(c.bulklocaties), o)}
    ${werklijstHtml('Klaar voor Picqer', filt(c.bulkeraf), 'Picklocatie eraf in Picqer.', 'wijzig-eraf')}`;
}
function tabMetVoorstel(lijst, cat, extra, rijExtraKnop){
  const o = {
    uitleg:(gr, sel) => { const n = sel.filter(heeftVoorstel).length; return n ? `${mv(n, 'product heeft', 'producten hebben')} een voorstel van Claude (staat bij elk product, uit zijn eigen data).` : 'Geen voorstel van Claude: Klopt zo, Later of Aanpassen.'; },
    keuzes:(gr, sel) => { const n = sel.filter(heeftVoorstel).length; return `${n ? knop('g-neem', 'Voorstel overnemen' + (n < sel.length ? ' (' + n + ')' : ''), cat, gr.k, 'hoofd') : ''}${extra ? extra(gr, sel) : ''}${knop('g-klopt', cat === 'aantal' ? 'Klopt zo (verschil is terecht)' : 'Klopt zo', cat, gr.k)}${knop('g-later', 'Later', cat, gr.k)}${cat === 'hercontrole' ? anders(cat, gr.k, `<span class="cp-soort">${SOORTKNOP(cat, gr.k)}</span>`) : ''}`; },
    rijKnop:x => `${heeftVoorstel(x) ? rknop('g-neem', 'Voorstel overnemen', cat, x.c, 'hoofd') : ''}${rijExtraKnop ? rijExtraKnop(x) : ''}${rknop('g-klopt', 'Klopt zo', cat, x.c)}`
  };
  return lijstHtml(cat, lijst, o);
}
function tabTeWegen(c){
  const l = filt(c.tewegen);
  const o = {
    sorteer:a => a.sort((x, y) => (x.loc || 'ZZZ').localeCompare(y.loc || 'ZZZ')),
    uitleg:() => 'Binnen de familie op locatie (looproute). Typ het gewogen gewicht per stuk bij het product.',
    rijExtra:x => `<div class="cp-kn"><label>kg per stuk <input data-cp-kg="${esc(x.c)}" inputmode="decimal" size="6" value="${esc(S.kg[x.c] || '')}" aria-label="gewogen kg ${esc(x.c)}"></label></div>`,
    rijKnop:x => rknop('g-gewogen', 'Gewogen', 'tewegen', x.c, 'hoofd'),
    keuzes:(gr, sel) => `${knop('g-gewogen', 'Gewogen (ingevulde kg)', 'tewegen', gr.k, 'hoofd')}${sel.some(x => (R().gewicht(x.c).pq || 0) > 0) ? knop('g-vertrouwd', 'Vertrouwd (Picqer klopt)', 'tewegen', gr.k) : ''}${knop('g-later', 'Later', 'tewegen', gr.k)}`
  };
  return `${filterBalk(c.tewegen)}<p class="muted klein">Alleen wat echt gewogen moet worden. Losse producten op de weegschaal; een gewogen gewicht wordt "gewogen".</p>${lijstHtml('tewegen', l, Object.assign(o, { leeg:'Niets te wegen.' }))}`;
}
function tabLater(){
  const l = laterItems(), tw = twijfelItems();
  const o = { uitleg:(gr) => 'Bewust uitgesteld: telt niet mee voor het afronden en komt alleen terug als je deze lijst opent.' + `<ul class="cp-later">${gr.items.slice(0, 8).map(x => `<li><code class="cp-code">${esc(x.c)}</code> ${esc(x.redenen.map(r => r.t).join(' · '))}</li>`).join('')}${gr.items.length > 8 ? `<li class="muted">… en ${gr.items.length - 8} meer (uitklappen)</li>` : ''}</ul>`,
    keuzes:(gr) => `<a class="cp-b hoofd" href="#/doorloop/later" data-taak="0.4">Doorlopen →</a>${knop('g-terug', 'Weer op de lijst (niet meer Later)', 'later', gr.k)}` };
  const ot = { uitleg:() => 'Soort Twijfel: "weet ik nog niet". Telt niet als afgerond; geen gewicht- of hoeveelheidsvragen tot je een soort kiest.', keuzes:(gr) => `<span class="cp-soort">${SOORTK.filter(k => k !== 'twijfel').map(k => knop('g-soort', SOORTT[k], 'twijfel', gr.k, '', k)).join('')}${S.wegOpen.has('twijfel|' + gr.k) ? Object.entries(WEGT).map(([k, t]) => knop('g-weg', 'Weg · ' + t, 'twijfel', gr.k, 'hoofd', k)).join('') : ''}</span>` };
  return `<div id="later-kaart"><h2>Later · moet nog (${nf(l.length + tw.length)})</h2>${lijstHtml('later', l, Object.assign(o, { leeg:'Niets op Later.' }))}
    <h2 id="cp-twijfel">Twijfel (${nf(tw.length)})</h2>${lijstHtml('twijfel', tw, Object.assign(ot, { leeg:'Geen producten op Twijfel.' }))}</div>`;
}

/* Overzicht = Claudes analyse */
const UITLEG = {
  picklocaties:'Pallet of Deel zonder vaste picklocatie in Picqer, of "moet pick krijgen": per groep één keuze voor hal → gedeelte → gang; daarna staat het op de werklijst "Klaar voor Picqer".',
  bulklocaties:'Soort Bulk, maar Picqer heeft nog een picklocatie: alleen bulk (picklocatie eraf) of de soort klopt niet.',
  hercontrole:'Duidelijke tegenstrijdigheden: Pick met bulk of VST, Archief met voorraad, Backorder met meer voorraad dan backorders, kleurgenoten (zelfde maat) met andere palletmaat, hoogte of soort, hoogte niet op 10 cm, volle pallet buiten 50–1.500 kg. Uitlopend met voorraad is normaal.',
  gewicht:'Gewicht dat afwijkt van de kleurgenoten (zelfde familie én maat) of van een rekensom (per meter, per m², kg in de naam), of geen gewicht in Picqer. Zonder kleurgenoot en rekensom geen voorstel: Naar Te wegen.',
  tewegen:'Producten die echt gewogen moeten worden, per familie op locatie (looproute).',
  aantal:'Kleurgenoten (zelfde maat) met een ander aantal per pallet, of een palletlabel dat afwijkt van productdata.'
};
function watKlopt(){
  const groepen = ['549', '551', '574'].map(pf => { const cs = Object.keys(WH.D.P).filter(c => new RegExp('^' + pf + '-').test(c) && bruikbaar(c) && soortVan(c)); const deel = cs.filter(c => soortVan(c) === 'deel' && /-(007|052)$/.test(c)).length, pick = cs.filter(c => soortVan(c) === 'pick' && !/-(007|052)$/.test(c)).length; return { pf, n:cs.length, deel, pick }; }).filter(g => g.n);
  return groepen.length ? `<li><b>549 / 551 / 574</b>: de kleuren -007 en -052 zijn Deel (${groepen.map(g => g.pf + ': ' + g.deel).join(', ')}), de rest Pick (${groepen.map(g => g.pf + ': ' + g.pick).join(', ')}). Het verschil komt door de verkoop, niet door een fout.</li>` : '';
}
function overzicht(c, t){
  const voorb = (l, n) => l.slice(0, n).map(x => `<code>${esc(x.c)}</code>`).join(' ');
  const ng = l => groepeer(l).length;
  const rij = (k, titel, lijst, extra) => `<div class="cp-ov"><div><b>${esc(titel)} · ${mv(lijst.length, 'product', 'producten')}${lijst.length ? ' in ' + mv(ng(lijst), 'groep', 'groepen') : ''}</b>${extra || ''}<div class="muted klein">${esc(UITLEG[k])}</div>${lijst.length ? `<div class="klein">Bijvoorbeeld ${voorb(lijst, 5)}</div>` : ''}</div><a class="cp-b${lijst.length ? ' hoofd' : ''}" href="#/todo/${k}">${lijst.length ? 'Naar de tab →' : 'Leeg'}</a></div>`;
  const nl = t ? t.later : 0, st = S.steek;
  const reactie = `<div class="cp-reactie"><b>Jouw reactie</b><div class="muted klein">Wat is fout of wat mis je in deze analyse? Kort is genoeg; het wordt bewaard met datum.</div><textarea id="cp-reactie" rows="3" placeholder="Bijv. 549-1-135 klopt gewoon, en ik mis …"></textarea><button type="button" class="cp-b hoofd" data-cp="reactie">Bewaar</button>
    ${S.reacties.length ? `<ul class="cp-reacties">${S.reacties.slice().reverse().slice(0, 6).map(r => `<li><span class="muted klein">${esc(dt(r.op))}</span> ${esc(r.tekst)}</li>`).join('')}</ul>` : ''}</div>`;
  const steek = st && st.codes ? `<div class="cp-steek"><b>Steekproef (${st.codes.length})</b>${st.codes.map(x => `<div class="cp-item" data-c="${esc(x.c)}"><div class="cp-m"><div class="cp-t"><code>${esc(x.loc || '–')}</code> <b>${esc(x.c)}</b> ${esc(naam(x.c))}</div><div class="cp-r">Controleer op de vloer: ${esc(x.wat)}</div><div class="cp-kn">${st.uit && st.uit[x.c] === 'klopt' ? '<span class="ok">klopt</span>' : st.uit && st.uit[x.c] === 'fout' ? '<span class="fout">fout</span>' : ''}<button type="button" class="cp-b" data-cp="sp-klopt" data-c="${esc(x.c)}">Klopt</button><button type="button" class="cp-b" data-cp="sp-fout" data-c="${esc(x.c)}">Fout</button></div></div></div>`).join('')}
    <div class="${steekGroen() ? 'ok' : 'muted'}"><b>${nf(Object.keys(st.uit || {}).length)} van ${st.codes.length} gecontroleerd · ${nf(Object.values(st.uit || {}).filter(v => v === 'fout').length)} fouten${steekGroen() ? ' · GROEN' : ''}</b></div></div>` : '';
  return `<p class="muted">Claudes analyse van de data, live berekend. Elk punt is een voorstel met Claudes visie: jij beslist met één tik, per groep (leverancier + hoofdwoord) met "Selectie is". Alleen producten met een bevestigde soort, nooit SAM Europe. Tellers tellen producten.</p>
    ${rij('picklocaties', '3 Picklocaties', c.picklocaties, c.pickklaar.length ? `<div class="klein">Klaar voor Picqer: ${mv(c.pickklaar.length, 'product', 'producten')}</div>` : '')}${rij('bulklocaties', '4 Bulklocaties', c.bulklocaties, c.bulkeraf.length ? `<div class="klein">Klaar voor Picqer: ${mv(c.bulkeraf.length, 'product', 'producten')}</div>` : '')}${rij('hercontrole', '5 Hercontrole', c.hercontrole)}${rij('gewicht', '6 Gewicht controleren', c.gewicht)}${rij('tewegen', '7 Te wegen', c.tewegen)}${rij('aantal', '8 Aantal per pallet', c.aantal)}
    <div class="cp-ov"><div><b>2 Later · ${mv(nl, 'product', 'producten')}</b><div class="muted klein">Bewust uitgesteld; telt niet mee voor het afronden.</div></div><a class="cp-b${nl ? ' hoofd' : ''}" href="#/todo/later">${nl ? 'Naar de tab →' : 'Leeg'}</a></div>
    <h3>Wat klopt</h3><ul class="cp-wat">${watKlopt() || '<li class="muted">Geen herkende patronen in deze data.</li>'}<li>Uitlopend met voorraad is normaal en staat niet in Hercontrole.</li><li>Productdata in gebruik: <b>3.0 en Containers</b> · Warehouse, Junior en Palletlabels pas na de steekproef.</li></ul>
    <h3>Steekproef voor Poort 0.4</h3><p class="muted klein">20 producten uit tab 3–8 (A/B eerst) als vloerlijst. 20 gecontroleerd met 0 fouten = groen.</p><button type="button" class="cp-b hoofd" data-cp="steekmaken">Steekproef maken</button>${steek}
    ${reactie}`;
}
const steekGroen = () => !!(S.steek && S.steek.codes && S.steek.codes.length === 20 && Object.keys(S.steek.uit || {}).length === 20 && !Object.values(S.steek.uit).includes('fout'));
function steekMaken(){
  const c = cats(); if(!c) return;
  const bron = [['picklocaties', x => 'staat er een vaste picklocatie? gewenst: ' + (x.pv ? R().halTekst(x.pv) : 'pick nodig')], ['bulklocaties', x => 'is er nog een picklocatie (' + x.loc + ')?'], ['hercontrole', x => x.reden], ['gewicht', x => 'weeg één stuk; app zegt ' + (x.voorstel && x.voorstel.kg ? fmtKg(x.voorstel.kg) + ' kg' : 'onbekend')], ['tewegen', () => 'wegen: kg per stuk'], ['aantal', () => 'tel de stuks per pallet']];
  const kand = []; bron.forEach(([k, wat]) => c[k].forEach(x => kand.push({ c:x.c, abc:x.abc, loc:x.loc || '', wat:wat(x), cat:k })));
  const gezien = new Set(), pool = kand.sort((a, b) => rang(a.abc) - rang(b.abc)).filter(x => !gezien.has(x.c) && gezien.add(x.c));
  const ab = pool.filter(x => rang(x.abc) < 2), rest = pool.filter(x => rang(x.abc) >= 2);
  const kies = a => { const u = a.slice(); for(let i = u.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [u[i], u[j]] = [u[j], u[i]]; } return u; };
  S.steek = { op:nu(), codes:kies(ab).concat(kies(rest)).slice(0, 20), uit:{} };
  schrijfRij(SP, () => S.steek);
}

function stijl(){
  if(document.getElementById('cp-stijl')) return;
  const s = document.createElement('style'); s.id = 'cp-stijl';
  s.textContent = `.cp-tabs{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0}.cp-tab{border:1.5px solid var(--lijn,#d6dce4);background:var(--vlak,#fff);color:inherit;border-radius:.6rem;padding:.5rem .8rem;font:600 .95rem inherit;text-decoration:none;display:inline-flex;gap:.4rem;align-items:center}
.cp-tab.aan{background:var(--ink,#121820);color:#fff;border-color:var(--ink,#121820)}.cp-tab i{font-style:normal;background:#ef8a4a;color:#1b1205;border-radius:1rem;padding:0 .45rem;font-size:.8rem}
.cp-inh{display:grid;gap:.75rem}.cp-grps{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,34rem),1fr));align-items:start}
.cp-grp{background:var(--vlak,#fff);border:1px solid var(--lijn,#d6dce4);border-radius:.85rem;padding:.8rem .9rem;display:grid;gap:.45rem;min-width:0}
.cp-gk{display:flex;flex-wrap:wrap;gap:.2rem .6rem;align-items:baseline}.cp-gk h3{margin:0;font-size:1.1rem;overflow-wrap:anywhere}.cp-n{color:#5c6675;font-weight:600}
.cp-gu{font-size:.92rem;overflow-wrap:anywhere}.cp-sel{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}.cp-sl{font-weight:700}.cp-ks{font-size:.85rem;color:#5c6675;margin-left:.2rem}
.cp-soort{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}
.cp-geldt{font-size:.85rem;overflow-wrap:anywhere}.cp-det>summary{cursor:pointer;font-weight:600;font-size:.9rem;padding:.3rem 0}
.cp-famblok{border-top:1px solid var(--lijn,#d6dce4);padding-top:.5rem;margin-top:.4rem;display:grid;gap:.4rem}.cp-famkop{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}
.cp-famkop input{width:1.2rem;height:1.2rem}.cp-prods{display:grid;gap:.4rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))}
.cp-item{display:flex;gap:.6rem;align-items:flex-start;background:var(--zacht,#f6f8fb);border:1px solid var(--lijn,#d6dce4);border-radius:.7rem;padding:.6rem .7rem;min-width:0}.cp-item.uit{opacity:.55}.cp-m{min-width:0;flex:1;overflow-wrap:anywhere}
.cp-v input{width:1.3rem;height:1.3rem;margin-top:.2rem}.cp-k{color:#5c6675;font-size:.85rem}.cp-r{font-size:.92rem;margin-top:.15rem}.cp-visie{font-size:.86rem;color:#2c3440;margin-top:.1rem}.cp-vs{color:#2350a8;font-weight:600;font-size:.92rem}
.cp-code{background:#e9ecf0;color:#10151c;font-weight:700}
.cp-kn,.cp-rij,.cp-filter{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.4rem;align-items:center}.cp-b{border:1.5px solid var(--lijn,#d6dce4);background:var(--vlak,#fff);color:inherit;border-radius:.6rem;padding:.45rem .75rem;font:600 .9rem inherit;cursor:pointer;text-decoration:none;display:inline-block}
.cp-b.hoofd{background:#ef8a4a;border-color:#ef8a4a;color:#1b1205}.cp-b:disabled{opacity:.5}.cp-wens{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}.cp-wens input,.cp-wens select,.cp-filter select,.cp-kn input{font:inherit;padding:.3rem .4rem;border:1px solid var(--lijn,#d6dce4);border-radius:.4rem;background:var(--vlak,#fff);color:inherit}
.cp-klaar{background:var(--vlak,#fff);border:1.5px solid #2e7d4f;border-radius:.85rem;padding:.8rem .9rem;display:grid;gap:.4rem}.cp-klaar h3{margin:0}.cp-gang{display:grid;gap:.3rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))}.cp-gang h4{grid-column:1/-1;margin:.4rem 0 0}
.cp-kl{display:flex;gap:.5rem;justify-content:space-between;align-items:center;flex-wrap:wrap;border:1px solid var(--lijn,#d6dce4);border-radius:.6rem;padding:.4rem .6rem;overflow-wrap:anywhere}.cp-kl>span{min-width:0;flex:1 1 14rem}
.cp-ov{display:flex;gap:.8rem;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;background:var(--vlak,#fff);border:1px solid var(--lijn,#d6dce4);border-radius:.75rem;padding:.8rem}.cp-ov>div{min-width:0;flex:1 1 20rem;overflow-wrap:anywhere}
.cp-reactie textarea{width:100%;font:inherit;border:1px solid var(--lijn,#d6dce4);border-radius:.5rem;padding:.5rem;background:var(--vlak,#fff);color:inherit;margin:.4rem 0}
.cp-feit{font-size:.82rem;color:#3c4653;overflow-wrap:anywhere}.cp-gt{font-size:.85rem;color:#3c4653;overflow-wrap:anywhere}.cp-uitz{font-size:.85rem;font-weight:600;color:#8a4b00}.cp-item.uitz{border-style:dashed}.cp-b.klein{padding:.3rem .55rem;font-size:.82rem}
#cp-bewaard{position:fixed;left:50%;bottom:calc(1rem + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:70;display:flex;gap:.75rem;align-items:center;background:#10151c;color:#fff;border-radius:.6rem;padding:.6rem .9rem;box-shadow:0 .25rem 1rem rgba(0,0,0,.25);font-size:.95rem;width:max-content;max-width:calc(100% - 2rem)}#cp-bewaard[hidden]{display:none}#cp-bewaard button{background:#ef8a4a;color:#1b1205;border:0;border-radius:.4rem;padding:.35rem .6rem;font:700 .9rem inherit;cursor:pointer}
.cp-anders>summary{cursor:pointer;font-weight:600;font-size:.9rem;color:#3c4653;padding:.2rem 0}.cp-anders{flex-basis:100%}
.cp-wat li{margin:.3rem 0}.cp-later{margin:.3rem 0 0;padding-left:1.1rem;font-size:.9rem}.cp-later li{overflow-wrap:anywhere}.cp-steek .ok,.cp-reactie .ok{color:#2e7d4f}.fout{color:#c0392b;font-weight:700}code{overflow-wrap:anywhere}`;
  document.head.appendChild(s);
}
function tabHtml(tab){
  const c = cats();
  if(!c) return '<p class="muted">Controleronde berekenen…</p>';
  switch(tab){
    case 'later': return tabLater();
    case 'picklocaties': return tabPick(c);
    case 'bulklocaties': return tabBulk(c);
    case 'hercontrole': return tabMetVoorstel(c.hercontrole, 'hercontrole');
    case 'gewicht': return `${tabMetVoorstel(c.gewicht, 'gewicht', (gr) => knop('g-tewegen', 'Naar Te wegen', 'gewicht', gr.k), x => heeftVoorstel(x) ? '' : rknop('g-tewegen', 'Naar Te wegen', 'gewicht', x.c, 'hoofd'))}`;
    case 'tewegen': return tabTeWegen(c);
    case 'aantal': return tabMetVoorstel(c.aantal, 'aantal');
    default: return overzicht(c, tel());
  }
}
function html(tab){
  stijl();
  const t = tel();
  tab = TABS.some(x => x[0] === tab) ? tab : 'overzicht';
  if(S.tab !== tab){ S.tab = tab; S.f = { hal:'', deel:'', gang:'' }; }
  const nav = TABS.filter(([k]) => k === 'overzicht' || !t || t[k] > 0 || k === tab || (k === 'picklocaties' && cats() && cats().pickklaar.length) || (k === 'bulklocaties' && cats() && cats().bulkeraf.length)).map(([k, n]) => `<a class="cp-tab${tab === k ? ' aan' : ''}" href="#/todo/${k}">${esc(n)}${t && k !== 'overzicht' && t[k] ? ` <i>${nf(t[k])}</i>` : ''}</a>`).join('');
  return `<nav class="cp-tabs" aria-label="Te doen">${nav}</nav><div class="cp-inh" id="cp-inh">${tabHtml(tab)}</div>`;
}

/* ---------- gebeurtenissen: kiezen = meteen opslaan, met "Bewaard · ongedaan maken" ---------- */
let gekoppeld = false;
const lijstVan = cat => { const c = cats(); if(!c) return []; return cat === 'later' ? laterItems() : cat === 'twijfel' ? twijfelItems() : (c[cat] || []); };
const groepItems = (cat, gk) => lijstVan(cat).filter(x => x.gk === gk);
// 3 seconden "Bewaard · ongedaan maken" (onderaan, vast in beeld)
function bewaard(tekst, terug){
  S.undo = { tekst, terug, id:Date.now() + Math.random() };
  let el = document.getElementById('cp-bewaard'); if(!el){ el = document.createElement('div'); el.id = 'cp-bewaard'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<span>Bewaard · ${esc(tekst)}</span><button type="button" data-cp-undo>ongedaan maken</button>`; el.hidden = false;
  const id = S.undo.id; clearTimeout(S.undoT); S.undoT = setTimeout(() => { if(S.undo && S.undo.id === id){ S.undo = null; el.hidden = true; } }, 3000);
}
// ongedaan maken: productdata en 2.0 terug zoals het was (met kopie), eigen rijen terug
const kloon = x => x ? JSON.parse(JSON.stringify(x)) : null;
function poTerug(codes){ const oud = Object.fromEntries(codes.map(c => [c, kloon(R().po(c))])); return async () => { if(!(await kopie(codes))) return; codes.forEach(c => R().poHerstel(c, oud[c])); flush(); }; }
function kloptTerug(keys){ const oud = Object.fromEntries(keys.map(k => [k, kloon(S.klopt[k])])); return async () => { keys.forEach(k => { if(oud[k]) S.klopt[k] = oud[k]; else delete S.klopt[k]; }); S.memo = null; await schrijfRij(KL, d => { d.items = d.items || {}; keys.forEach(k => { if(oud[k]) d.items[k] = oud[k]; else delete d.items[k]; }); return d; }); }; }
async function pickwensTerug(oud){
  const codes = Object.keys(oud); if(!codes.length || !(await kopie(codes))) return;
  const t = nu(), rijen = codes.map(c => { const r = oud[c] || { data:{}, meta:{} }, data = Object.assign({}, r.data), meta = Object.assign({}, r.meta); if(!(r.data || {}).pickwens){ delete data.pickwens; delete meta.pickwens; } return { productcode:c, data, meta, updated_at:t }; });
  await WH.upsert('productdata', rijen, 'productcode');
  rijen.forEach(r => { try{ WHPD.S.pd[r.productcode] = { data:r.data, meta:r.meta, t }; }catch(e){} });
}
async function doeActie(a, cat, sel, v, gk){
  const P = R(), codes = sel.map(x => x.c), n = mv(sel.length, 'product', 'producten');
  if(!sel.length){ WH.toast('Niets aangevinkt', 2500); return; }
  const klaar = () => { if(gk){ groepItems(cat, gk).forEach(x => { S.uit.delete(sk(cat, x.c)); S.aan.delete(sk(cat, x.c)); }); S.wegOpen.delete(cat + '|' + gk); delete S.keuze[cat + '|' + gk]; } S.memo = null; };
  if(a === 'g-soort' && v === 'weg'){ if(gk) S.wegOpen.add(cat + '|' + gk); return; }
  if(a === 'g-soort' || a === 'g-weg'){ const terug = poTerug(codes); if(!(await kopie(codes))) return; sel.forEach(x => zetSoort(x.c, a === 'g-weg' ? 'weg' : v, a === 'g-weg' ? v : '')); flush(); klaar(); bewaard(n + ': soort ' + (a === 'g-weg' ? 'Weg · ' + WEGT[v] : SOORTT[v]), terug); return; }
  if(a === 'g-pick'){
    const k = gk ? S.keuze[cat + '|' + gk] || {} : {}, h = halVan(v);
    if(!h){ WH.toast('Kies de gang', 3000); return; }
    const r = await bewaarPickwensen(sel.map(x => ({ c:x.c, h, opm:k.opm || '' })));
    if(r){ klaar(); bewaard(n + ': pick in ' + R().halTekst(h, true) + ' (onder Klaar voor Picqer)', () => pickwensTerug(r)); }
    return;
  }
  if(a === 'g-bulkok'){ const keys = sel.map(x => 'bulkeraf|' + x.c), terug = kloptTerug(keys); await zetKloptVeel(sel.map(x => ({ cat:'bulkeraf', c:x.c, sig:x.sig, opm:'Alleen bulk' }))); klaar(); bewaard(n + ': alleen bulk (picklocatie eraf)', terug); return; }
  if(a === 'g-klopt'){ const terug = kloptTerug(sel.map(x => sk(cat, x.c))); await zetKloptVeel(sel.map(x => ({ cat, c:x.c, sig:x.sig, opm:'Klopt zo' }))); klaar(); bewaard(n + ': klopt zo', terug); return; }
  if(a === 'g-later'){ const terug = kloptTerug(sel.map(x => sk(cat, x.c))); await zetKloptVeel(sel.map(x => ({ cat, c:x.c, sig:x.sig, opm:'Later · tab ' + (TABNAAM[cat] || cat), later:true }))); klaar(); bewaard(n + ' op Later', terug); return; }
  if(a === 'g-neem'){
    const mee = sel.filter(heeftVoorstel); if(!mee.length) return;
    const mc = mee.map(x => x.c), terugP = poTerug(mc), terugK = kloptTerug(mc.map(c => sk(cat, c)));
    if(!(await kopie(mc))) return;
    mee.forEach(neemOverZonderKopie); flush();
    // beslist = weg: staat het product na het overnemen nog in de tab (bijv. een tweede reden), dan wordt het besluit onthouden tot de data weer verandert
    const nog = (cats()[cat] || []).filter(x => mc.includes(x.c));
    if(nog.length) await zetKloptVeel(nog.map(x => ({ cat, c:x.c, sig:x.sig, opm:'Voorstel overgenomen' })));
    klaar(); bewaard(mv(mee.length, 'voorstel', 'voorstellen') + ' overgenomen', async () => { await terugP(); await terugK(); }); return;
  }
  if(a === 'g-tewegen'){ const terug = poTerug(codes); if(!(await kopie(codes))) return; sel.forEach(x => P.poZet(x.c, p => { delete p.heropend; p.gew = { st:'tewegen', t:nu(), door:'Daan' }; })); flush(); klaar(); bewaard(n + ' naar Te wegen', terug); return; }
  if(a === 'g-gewogen'){
    const met = sel.map(x => ({ x, kg:num(String(S.kg[x.c] || '').replace(',', '.')) })).filter(y => y.kg > 0);
    if(!met.length){ WH.toast('Typ het gewogen gewicht per stuk (kg) bij het product', 3500); return; }
    const mc = met.map(y => y.x.c), terug = poTerug(mc); if(!(await kopie(mc))) return;
    met.forEach(y => { P.poZet(y.x.c, p => { delete p.heropend; p.gew = { st:'gewogen', kg:y.kg, t:nu(), door:'Daan' }; }); delete S.kg[y.x.c]; }); flush(); klaar();
    bewaard(mv(met.length, 'product', 'producten') + ' gewogen' + (met.length < sel.length ? ' · ' + (sel.length - met.length) + ' zonder kg blijven staan' : ''), terug); return;
  }
  if(a === 'g-vertrouwd'){ const met = sel.filter(x => (P.gewicht(x.c).pq || 0) > 0), mc = met.map(x => x.c); if(!met.length) return; const terug = poTerug(mc); if(!(await kopie(mc))) return; met.forEach(x => P.poZet(x.c, p => { delete p.heropend; p.gew = { st:'vertrouwd', kg:P.gewicht(x.c).pq, t:nu(), door:'Daan' }; })); flush(); klaar(); bewaard(mv(met.length, 'product', 'producten') + ' vertrouwd', terug); return; }
  if(a === 'g-terug'){
    const dl = [], tab = [];
    sel.forEach(x => (x.bron || []).forEach(b => { if(b.dl) dl.push({ c:x.c, t:b.dl }); if(b.tab) tab.push(b.tab + '|' + x.c); }));
    const terugK = kloptTerug(tab), oudDl = dl.map(x => Object.assign({ opm:((WHTAAK.later.items() || {})[x.c + '|' + x.t] || {}).opm || '' }, x));
    if(dl.length && window.WHTAAK && WHTAAK.later) await WHTAAK.later.zet(dl.map(x => Object.assign({ weg:true }, x)));
    if(tab.length) await weesKloptVeel(tab);
    klaar(); bewaard(n + ' weer op de lijst', async () => { if(oudDl.length) await WHTAAK.later.zet(oudDl); await terugK(); }); return;
  }
}
function groepActie(a, cat, gk, v){
  const alle = groepItems(cat, gk);
  if(a === 'g-alle' || a === 'g-geen'){ alle.forEach(x => zetAan(cat, x, a === 'g-alle')); S.open.add(cat + '|' + gk); return Promise.resolve(); }
  return doeActie(a, cat, alle.filter(x => aan(cat, x)), v, gk);
}
function koppel(){
  if(gekoppeld) return; gekoppeld = true;
  const herteken = () => { try{ WHTAAK.herteken(); }catch(e){} };
  const binnen = el => document.getElementById('native') && document.getElementById('native').contains(el);
  document.addEventListener('change', async ev => {
    const t = ev.target; if(!t.closest || !binnen(t)) return;
    const f = t.closest('[data-cp-f]'); if(f){ S.f[f.dataset.cpF] = f.value; if(f.dataset.cpF === 'hal'){ S.f.deel = ''; S.f.gang = ''; } if(f.dataset.cpF === 'deel') S.f.gang = ''; t.blur(); herteken(); return; }
    if(t.dataset.cpSel){ const i = t.dataset.cpSel.indexOf('|'), cat = t.dataset.cpSel.slice(0, i), c = t.dataset.cpSel.slice(i + 1), x = lijstVan(cat).find(y => y.c === c); if(x) zetAan(cat, x, t.checked); herteken(); return; }
    if(t.dataset.cpFam){ const i = t.dataset.cpFam.indexOf('|'), cat = t.dataset.cpFam.slice(0, i), fk = t.dataset.cpFam.slice(i + 1); lijstVan(cat).filter(x => x.fk === fk).forEach(x => zetAan(cat, x, t.checked)); herteken(); return; }
    if(t.dataset.cpK){ const d = t.dataset.cpK.split('|'), veld = d.pop(), key = d.join('|'), cat = d[0], gk = d.slice(1).join('|');
      const k = S.keuze[key] = Object.assign({ hal:'', deel:'', opm:'' }, S.keuze[key] || {}); k[veld] = t.value;
      if(veld === 'hal') k.deel = t.value === 'C' ? k.deel : '';
      // de gang kiezen = meteen bewaren voor alle aangevinkte producten
      if(veld === 'gang' && t.value){ t.blur(); if(S.bezig) return; S.bezig = true; try{ await groepActie('g-pick', cat, gk, t.value); }catch(e){ console.error(e); WH.toast('Mislukt: ' + (e.message || e), 5000); } S.bezig = false; S.memo = null; herteken(); return; }
      if(veld !== 'opm'){ t.blur(); herteken(); } return; }
  });
  document.addEventListener('input', ev => { const t = ev.target; if(t && t.dataset && t.dataset.cpKg !== undefined && binnen(t)) S.kg[t.dataset.cpKg] = t.value; });
  document.addEventListener('toggle', ev => { const d = ev.target; if(d && d.dataset && d.dataset.open && binnen(d)){ if(d.open) S.open.add(d.dataset.open); else S.open.delete(d.dataset.open); } }, true);
  document.addEventListener('click', async ev => {
    const u = ev.target.closest && ev.target.closest('[data-cp-undo]');
    if(u){ const x = S.undo; S.undo = null; const el = document.getElementById('cp-bewaard'); if(el) el.hidden = true; if(!x) return; try{ await x.terug(); WH.toast('Teruggezet: ' + x.tekst, 2500); }catch(e){ console.error(e); WH.toast('Ongedaan maken lukte niet: ' + (e.message || e), 5000); } S.memo = null; herteken(); return; }
    const b = ev.target.closest && ev.target.closest('[data-cp]'); if(!b || !binnen(b)) return;
    const a = b.dataset.cp, c = b.dataset.c, cat = b.dataset.cat;
    if(S.bezig) return; S.bezig = true; b.disabled = true;
    try{
      if(b.dataset.een){ const x = lijstVan(cat).find(y => y.c === b.dataset.een); if(x) await doeActie(a, cat, [x], b.dataset.v); }
      else if(a.startsWith('g-')) await groepActie(a, cat, b.dataset.gk, b.dataset.v);
      else if(a === 'wijzig-pick'){ S.wijzig.add(c); S.memo = null; }
      else if(a === 'wijzig-eraf'){ await weesKloptVeel(['bulkeraf|' + c]); }
      else if(a === 'reactie'){ const t = (document.getElementById('cp-reactie') || {}).value || ''; if(t.trim()){ S.reacties.push({ op:nu(), tekst:t.trim() }); await schrijfRij(RE, d => { d.lijst = (d.lijst || []).concat([{ op:nu(), tekst:t.trim() }]); return d; }); } }
      else if(a === 'steekmaken'){ steekMaken(); }
      else if(a === 'sp-klopt' || a === 'sp-fout'){ S.steek.uit = S.steek.uit || {}; S.steek.uit[c] = a === 'sp-klopt' ? 'klopt' : 'fout'; await schrijfRij(SP, () => S.steek); }
    }catch(e){ console.error(e); WH.toast('Mislukt: ' + (e.message || e), 5000); }
    S.bezig = false; S.memo = null; herteken();
  });
}
// Poort 0.4: de steekproef komt uit de controleronde
function poortSteek(){ return { gedaan:S.steek && S.steek.codes ? Object.keys(S.steek.uit || {}).length : 0, n:S.steek && S.steek.codes ? S.steek.codes.length : 0, fouten:S.steek && S.steek.uit ? Object.values(S.steek.uit).filter(v => v === 'fout').length : 0, groen:steekGroen() }; }
return { html, tel, cats, laad, koppel, poortSteek, S, TABS, zetKlopt, tabHtml, groepeer, laterItems, twijfelItems, gewichtPunt, rekensom, pickVoorstel, groepActie, doeActie, groepVoorstel, feitenHtml };
})();
