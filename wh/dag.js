/* =====================================================================
   IVOL Warehouse — de werkdag (30-9-2026)
   Vandaag = één stroom: containers van de dag → controle → aanvullen
   (backorders eerst) → aanvulronde → ruimte maken. Op de telefoon:
   Invullen, product voor product alle ontbrekende gegevens.
   Bewaard in catalog wh-taken (gedeeld iPhone/Mac):
     cc:<cid>:<stap>          checklist per container
     cb:<cid>:<code>          pallets apart gezet voor orders
     cp:<cid>:<code>:<i>      bulkpallet geplaatst {loc}
     ck:<cid>:<code>:<i>      naar picklocatie gezet {loc}
     cv:<cid>:<code>          naar VST (Stockmove)
     dg:<datum>:<stap>        stappen van de dag
     mv:/rd:<datum>:<code>    aangevuld {aantal, van, naar}
   ===================================================================== */
window.WHD = (function(){
'use strict';
const { $, esc, leeg, num, nf, plural, fdate, fdt, dagenOud, toast, D, vandaag, isoDag, dd } = WH;
const V = () => window.WHV;
const app = $('app');
const UI = { dag:null, invul:{ bron:'', i:0, lijst:null }, open:{} };
const kort = d => d ? fdate(d, { day:'numeric', month:'short' }) : '';
const tik = k => !!D.TAKEN[k];
const tv = k => D.TAKEN[k] || null;
const dagenTussen = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const levKort = l => String(l || '').split(/[\s,.(]/)[0];
const cNaam = c => levKort(c.leverancier) + ' ' + (c.pakbon_ref || '') ;

async function zetTaak(k, v){
  if(v === null) delete D.TAKEN[k]; else D.TAKEN[k] = v;
  try{ await WH.catPatch('wh-taken', { [k]:v }); }catch(e){ /* melding al getoond */ }
}

/* =====================================================================
   CONTAINERS VAN DE DAG
   ===================================================================== */
function contVan(dag){ return D.CONT.filter(c => c.status !== 'afgerond' && c.losdatum === dag).sort((a, b) => String(a.lostijd || '').localeCompare(String(b.lostijd || '')) || a.id - b.id); }
function losdagen(){
  const vd = vandaag();
  return [...new Set(D.CONT.filter(c => c.status !== 'afgerond' && c.losdatum && c.losdatum >= isoDag(Date.now() - 7 * 864e5)).map(c => c.losdatum))].sort();
}
function kiesDag(){
  if(UI.dag) return UI.dag;
  const vd = vandaag();
  if(contVan(vd).length) return vd;
  // open containers van de afgelopen dagen (nog niet afgerond) of de eerstvolgende losdag binnen 3 dagen
  const d = losdagen();
  const eerder = d.filter(x => x < vd && !tik('cc:dag:' + x + ':controle'));
  if(eerder.length) return eerder[eerder.length - 1];
  const later = d.find(x => x > vd);
  return later && dagenTussen(vd, later) <= 3 ? later : vd;
}

// verdeling van een container → wat er met elke pallet gebeurt
function plan(c){
  const out = { bo:[], vst:[], up:[], pick:[], geen:[] };
  const verd = c.verdeling || {};
  const codes = [...new Set((c.regels || []).map(r => r.productcode).filter(Boolean))];
  codes.forEach(code => {
    const v = verd[code];
    if(!v || !(v.porties || []).length){ out.geen.push(code); return; }
    let upI = 0, pickI = 0;
    v.porties.forEach(x => {
      const n = num(x.n) || 0; if(!n) return;
      const per = num(x.per);
      const pal = x.soort === 'pallet';
      const base = { cid:c.id, c, code, note:x.note || '', dest:x.dest, pal };
      const stuks = pal ? n * (per || 0) : n;
      if(x.dest === 'BO' || x.dest === 'KLANT') out.bo.push(Object.assign(base, { n, per, stuks, key:'cb:' + c.id + ':' + code + ':' + x.dest }));
      else if(x.dest === 'VST') out.vst.push(Object.assign(base, { n, per, stuks, key:'cv:' + c.id + ':' + code }));
      else if(x.dest === 'UP' || x.dest === 'GROUND'){
        const grond = x.dest === 'GROUND';
        if(pal) for(let i = 0; i < n; i++){ const k = upI++; out.up.push(Object.assign({}, base, { i:k, stuks:per, per, grond, key:'cp:' + c.id + ':' + code + ':' + k })); }
        else { const k = upI++; out.up.push(Object.assign({}, base, { i:k, stuks:n, per:n, los:true, grond, key:'cp:' + c.id + ':' + code + ':' + k })); }
      }
      else if(x.dest === 'PICK'){ const k = pickI++; out.pick.push(Object.assign(base, { i:k, n, per, stuks, key:'ck:' + c.id + ':' + code + ':' + k })); }
    });
  });
  // tellen per product (voor "pallet 2 van 8")
  const perCode = {}; out.up.forEach(p => perCode[p.cid + p.code] = (perCode[p.cid + p.code] || 0) + 1);
  out.up.forEach(p => p.van = perCode[p.cid + p.code]);
  return out;
}
function dagPlan(dag, vastzetten){
  const cs = contVan(dag);
  const all = { cs, bo:[], vst:[], up:[], pick:[], geen:[] };
  cs.forEach(c => { const p = plan(c); ['bo', 'vst', 'up', 'pick'].forEach(k => all[k].push(...p[k])); p.geen.forEach(code => all.geen.push({ c, code })); });
  all.zones = zonesVan(cs);
  // producten zonder zone: de app kiest hele liggers (zo min mogelijk om te ruimen) en legt die vast
  const lv = ligVoorstel(all.up, all.zones), zp = {};
  Object.entries(lv).forEach(([k, v]) => {
    if(!v.ligs.length) return;
    const [cid, ...r] = k.split('|'), code = r.join('|');
    const tekst = v.ligs.map(ligToken).join(', ');
    all.zones[k] = { tekst, delen:parseZone(tekst).delen, vrij:false, bev:bevVan(cid), auto:true };
    zp['cz:' + cid + ':' + code] = { zone:tekst, auto:true, op:new Date().toISOString() };
  });
  // oude voorstellen van vóór de liggers (verspreide losse plekken) vervallen, ook voor de palletlabels
  if(vastzetten) all.up.forEach(p => {
    const vs = tv('cvs:' + p.key), t = tv(p.key);
    if(vs && vs.loc && !(t && t.loc) && all.zones[p.cid + '|' + p.code] && !/^(zone|ligger)/.test(vs.reden || '')) zp['cvs:' + p.key] = null;
  });
  if(vastzetten && Object.keys(zp).length){
    Object.entries(zp).forEach(([k, v]) => { if(v === null) delete D.TAKEN[k]; else D.TAKEN[k] = v; });
    WH.catPatch('wh-taken', zp).catch(() => {});
  }
  all.voorstel = bulkVoorstellen(all.up, all.zones);
  all.zoneInfo = zoneOverzicht(all.up, all.zones, all.voorstel);
  // voorstellen vastzetten (cvs:<pallet>): anders schuiven ze op zodra de nieuwe voorraad-export de plekken bezet meldt
  if(vastzetten){
    const patch = {};
    all.up.forEach(p => { const v = all.voorstel[p.key]; if(v && v.loc && !v.geplaatst && !v.vast) patch['cvs:' + p.key] = { loc:v.loc, extra:v.extra, reden:v.reden || '' }; });
    if(Object.keys(patch).length){ Object.assign(D.TAKEN, patch); WH.catPatch('wh-taken', patch).catch(() => {}); }
  }
  return all;
}

/* ---------- bulklocatie voorstellen ----------
   Liggers = gang + sectie + hoogte; plaatsen A–D. Vrij = geen product gekoppeld (locatie-export) en geen voorraad (voorraad per locatie).
   Brede pallets nemen meerdere naast elkaar liggende plaatsen (plaatsen uit Containers: 1,2/1,3 = 1 plek, 2 = 2, 3 = 3).
   Zwaar: max per ligger uit Containers en ±2000 kg per ligger. "zijkant/buiten" in de notitie = alleen op A of de laatste plek.
   Voorkeur: zelfde gang als de picklocatie (anders bestaande bulk, anders de gang waar die leverancier het meest staat), dichtbij, zwaar laag. */
function ligBouw(){
  const L = {};
  const vrl = new Set(); Object.values(D.VR).forEach(v => Object.entries(v.locs).forEach(([l, q]) => { if(q > 0) vrl.add(l); }));
  Object.values(D.LOC).forEach(l => {
    const i = WHL.locInfo(l.naam); if(!i.std || !l.bulk) return;
    if(i.gang === 'AH' || WHL.TWIJFEL.has(l.naam)) return;
    if(i.gang === 'AA' && i.sec < 6) return;                   // kleine stellingkasten
    const k = i.gang + dd(i.sec) + '|' + i.h;
    const g = L[k] = L[k] || { k, gang:i.gang, hal:i.hal, sec:i.sec, h:i.h, pos:{} };
    g.pos[i.pl] = { naam:l.naam, bezet:l.codes.length > 0 || vrl.has(l.naam), res:null };
  });
  return L;
}
let LEVREF = null;
function levRef(lev){
  if(!lev) return null;
  if(!LEVREF){
    LEVREF = {};
    const t = {};
    Object.values(D.P).forEach(p => {
      if(!p.leverancier || !p.locaties_hm) return;
      String(p.locaties_hm).split(',').map(s => s.trim()).forEach(l => { const i = WHL.locInfo(l); if(!i.std) return; const x = t[p.leverancier] = t[p.leverancier] || {}; x[i.gang] = (x[i.gang] || 0) + 1; });
    });
    Object.entries(t).forEach(([lv, g]) => { const best = Object.entries(g).sort((a, b) => b[1] - a[1])[0]; if(best) LEVREF[lv] = { gang:best[0], hal:best[0][0], sec:10, h:0, std:true }; });
  }
  return LEVREF[lev] || null;
}
const gangAfst = (a, b) => a[0] !== b[0] ? 9 : Math.abs(a.charCodeAt(1) - b.charCodeAt(1));
function palletInfo(code, note){
  const p = D.P[code] || {};
  const plaatsen = num(p.plaatsen) || 1;
  const k = plaatsen > 1.5 ? Math.ceil(plaatsen - 0.05) : 1;
  const kg = num(p.gewicht_kg) || 0;
  const maxLig = Math.max(1, Math.min(num(p.max_per_ligger) || 4, kg ? Math.floor(2000 / kg) : 4));
  const zij = /zijkant|buiten/i.test((p.opmerking || '') + ' ' + (note || ''));
  return { plaatsen, k, kg, maxLig, zij, maat:p.palletmaat || '', hoogte:num(p.hoogte_cm) };
}
/* ---------- ruimte plannen: zone per product (Daan geeft de richting, de app deelt in) ----------
   Zone-tekst: "CC 07-22" (gang + secties), "CD 23-21" (achteraan beginnen), "BE" (hele gang), meerdere met komma.
   Bewaard in wh-taken: cz:<cid>:<code> {zone}; czv:<cid>:<code> = zone vrijgemaakt (bezette plekken in de zone tellen dan als vrij). */
function parseZone(txt){
  const delen = [], fout = [];
  String(txt || '').toUpperCase().split(/[,;+]/).map(x => x.replace(/\s+/g, '').replace(/T\/M|TOT/g, '-')).filter(Boolean).forEach(d => {
    const lg = /^([A-Z]{2})(\d{1,2})\/(\d{1,2})$/.exec(d);                 // één ligger: CC07/10 = CC07A10 t/m D10
    if(lg){ delen.push({ gang:lg[1], van:+lg[2], tot:+lg[2], h:+lg[3], tekst:d }); return; }
    const m = /^([A-Z]{2})(\d{1,2})?(?:-(?:[A-Z]{2})?(\d{1,2}))?$/.exec(d);
    if(!m){ fout.push(d); return; }
    const a = m[2] ? +m[2] : null, b = m[3] ? +m[3] : a;
    delen.push({ gang:m[1], van:a === null ? 0 : a, tot:b === null ? 99 : b, tekst:d });
  });
  return { delen, fout };
}
// liggers die bevestigd leeg zijn (czl:<cid>:<ligger>)
function bevVan(cid){ const s = new Set(), pre = 'czl:' + cid + ':'; Object.keys(D.TAKEN).forEach(k => { if(k.startsWith(pre) && D.TAKEN[k]) s.add(k.slice(pre.length)); }); return s; }
function zonesVan(cs){
  const z = {};
  cs.forEach(c => {
    const bev = bevVan(c.id);
    Object.keys(D.TAKEN).forEach(k => {
      if(!k.startsWith('cz:' + c.id + ':')) return;
      const code = k.slice(('cz:' + c.id + ':').length), v = D.TAKEN[k];
      if(!v || !v.zone) return;
      const pz = parseZone(v.zone);
      if(pz.delen.length) z[c.id + '|' + code] = { tekst:v.zone, delen:pz.delen, vrij:!!D.TAKEN['czv:' + c.id + ':' + code], bev, auto:!!v.auto };
    });
  });
  return z;
}
const ligBev = (z, g) => !!(z && (z.vrij || (z.bev && z.bev.has(g.k))));
const ligToken = g => g.gang + dd(g.sec) + '/' + dd(g.h);
const ligBereik = g => { const l = Object.keys(g.pos).sort(); return g.gang + dd(g.sec) + l[0] + dd(g.h) + (l.length > 1 ? ' t/m ' + l[l.length - 1] + dd(g.h) : ''); };
// liggers van een zone in volgorde: secties in de opgegeven richting, dan hoogte laag → hoog
function zoneLiggers(L, zone){
  const out = [];
  zone.delen.forEach(d => {
    const lo = Math.min(d.van, d.tot), hi = Math.max(d.van, d.tot), af = d.van > d.tot;
    Object.values(L).filter(g => g.gang === d.gang && g.sec >= lo && g.sec <= hi && (d.h === undefined || g.h === d.h))
      .sort((a, b) => (af ? b.sec - a.sec : a.sec - b.sec) || a.h - b.h)
      .forEach(g => { if(!out.includes(g)) out.push(g); });
  });
  return out;
}
/* ---------- liggers kiezen ----------
   Basis: pallets naar bulk → plaatsen → hele liggers. Per product (in lossvolgorde) kiest de app liggers waar zo min mogelijk staat
   (elke bezette plaats = iets om te verplaatsen), dichtbij de picklocatie, aaneengesloten, zware pallets laag. Eerst de overgebleven
   plaatsen van liggers die al voor deze container gekozen zijn. Daan kan het zelf aanpassen (zone typen, bv. CC07/10) of "Andere liggers". */
// hoeveel pallets van dit soort passen in een lege ligger (aaneengesloten plaatsen, max per ligger, zijkant)
function capLigger(g, pi){
  const letters = Object.keys(g.pos).sort(); let c = 0, s0 = 0;
  while(s0 + pi.k <= letters.length){
    const run = letters.slice(s0, s0 + pi.k);
    if(run.some((l, j) => j && l.charCodeAt(0) !== run[j - 1].charCodeAt(0) + 1)){ s0++; continue; }
    c++; s0 += pi.k;
  }
  return Math.min(c, pi.maxLig, pi.zij && pi.k === 1 ? 2 : 99);
}
function ligVoorstel(up, zones){
  const uit = {};
  const L = ligBouw();
  if(!Object.keys(L).length) return uit;
  const claimed = new Set();
  up.forEach(p => { const t = tv(p.key); if(t && t.loc){ const i = WHL.locInfo(t.loc); if(i.std) claimed.add(i.gang + dd(i.sec) + '|' + i.h); } });
  Object.values(zones).forEach(z => zoneLiggers(L, z).forEach(g => claimed.add(g.k)));
  const groepen = [];
  up.forEach(p => {
    const k = p.cid + '|' + p.code;
    if(zones[k]) return;
    const t = tv(p.key); if(t && t.loc) return;
    let gr = groepen.find(x => x.k === k);
    if(!gr){ gr = { k, cid:p.cid, code:p.code, pi:palletInfo(p.code, p.note), grond:!!p.grond, n:0 }; groepen.push(gr); }
    gr.n++;
  });
  LEVREF = null;
  const gekozen = [];            // { g, vrijPl, kgMax }
  groepen.forEach(gr => {
    const pi = gr.pi, ex = new Set((tv('czx:' + gr.cid + ':' + gr.code) || {}).ex || []);
    const res = uit[gr.k] = { ligs:[], occ:0 };
    let n = gr.n;
    const capVan = g => capLigger(g, pi);
    // 1. overgebleven plaatsen in liggers die al voor deze planning gekozen zijn (niet bij zware pallets)
    if(pi.kg < 600) gekozen.forEach(e => {
      if(n <= 0 || e.kgMax >= 600 || e.g.h === 0 !== gr.grond || e.vrijPl < pi.k) return;
      const take = Math.min(n, Math.floor(e.vrijPl / pi.k), pi.maxLig);
      if(take <= 0) return;
      e.vrijPl -= take * pi.k; n -= take; e.kgMax = Math.max(e.kgMax, pi.kg);
      if(!res.ligs.includes(e.g)) res.ligs.push(e.g);
    });
    // 2. nieuwe liggers
    const refs = WHL.locsVan(gr.code).map(WHL.locInfo).filter(i => i.std);
    const ref = refs.find(i => i.h < 10) || refs[0] || levRef((D.P[gr.code] || {}).leverancier);
    while(n > 0){
      const anker = res.ligs[0] || null;
      let best = null;
      Object.values(L).forEach(g => {
        if(claimed.has(g.k) || ex.has(g.k) || gekozen.some(e => e.g === g)) return;
        if((g.h === 0) !== gr.grond) return;
        const cap = capVan(g); if(cap <= 0) return;
        const letters = Object.keys(g.pos);
        const occ = letters.filter(l => g.pos[l].bezet).length;
        let sc = occ * 12;
        if(ref && ref.gang){
          if(g.gang === ref.gang) sc += Math.abs(g.sec - ref.sec) * 2;
          else if(g.hal === ref.hal) sc += 60 + gangAfst(g.gang, ref.gang) * 15 + Math.abs(g.sec - ref.sec);
          else sc += 400 + Math.abs(g.sec - (ref.sec || 0));
        } else sc += 200;
        sc += Math.max(0, (g.h - 10) / 10) * (pi.kg >= 500 ? 8 : 2);
        if(anker) sc += g.gang === anker.gang ? Math.abs(g.sec - anker.sec) * 3 + Math.abs(g.h - anker.h) / 10 : 50;
        if(!best || sc < best.sc) best = { sc, g, cap, occ };
      });
      if(!best) break;
      const take = Math.min(n, best.cap);
      gekozen.push({ g:best.g, vrijPl:Object.keys(best.g.pos).length - take * pi.k, kgMax:pi.kg });
      res.ligs.push(best.g); res.occ += best.occ; n -= take;
    }
  });
  return uit;
}
function bulkVoorstellen(pallets, zones){
  zones = zones || {};
  LEVREF = null;
  const L = ligBouw();
  const res = {};
  const telLig = {};
  const reserveer = (naam, code) => {
    const i = WHL.locInfo(naam); if(!i.std) return;
    const g = L[i.gang + dd(i.sec) + '|' + i.h]; if(!g || !g.pos[i.pl]) return;
    g.pos[i.pl].res = code;
    const t = telLig[g.k] = telLig[g.k] || {}; t[code] = (t[code] || 0) + 1;
  };
  pallets.forEach(p => {
    const t = tv(p.key), vs = tv('cvs:' + p.key);
    if(t && t.loc){ reserveer(t.loc, p.code); res[p.key] = { loc:t.loc, extra:[], geplaatst:true }; }
    else if(vs && vs.loc && /^(zone|ligger)/.test(vs.reden || '')){ [vs.loc].concat(vs.extra || []).forEach(n => reserveer(n, p.code)); res[p.key] = { loc:vs.loc, extra:vs.extra || [], reden:vs.reden || '', vast:true }; }
  });
  // eerst de producten met een zone (in lossvolgorde), dan de rest
  pallets.forEach(p => {
    const z = zones[p.cid + '|' + p.code];
    if(res[p.key] || !z) return;
    const pi = palletInfo(p.code, p.note);
    for(const g of zoneLiggers(L, z)){
      if(!ligBev(z, g)) continue;                 // pas na "leeg bevestigd": Picqer ziet niet wat er los ligt
      const letters = Object.keys(g.pos).sort();
      const t = telLig[g.k] || {};
      if((t[p.code] || 0) >= pi.maxLig) continue;
      if(pi.kg >= 600 && Object.values(t).reduce((a, n) => a + n, 0) >= pi.maxLig) continue;
      let gevonden = null;
      for(let s0 = 0; s0 + pi.k <= letters.length; s0++){
        const run = letters.slice(s0, s0 + pi.k);
        if(run.some((l, j) => j && l.charCodeAt(0) !== run[j - 1].charCodeAt(0) + 1)) continue;
        if(run.some(l => g.pos[l].res || (g.pos[l].bezet && !ligBev(z, g)))) continue;
        gevonden = run; break;
      }
      if(!gevonden) continue;
      const namen = gevonden.map(l => g.pos[l].naam);
      namen.forEach(n => reserveer(n, p.code));
      res[p.key] = { loc:namen[0], extra:namen.slice(1), reden:(z.auto ? 'ligger ' : 'zone ') + ligToken(g) + (pi.k > 1 ? ' · ' + pi.k + ' plaatsen' : '') };
      break;
    }
    if(!res[p.key]) res[p.key] = { loc:null, extra:[], reden:(z.auto ? 'liggers ' : 'zone ') + z.tekst + ': eerst vrijmaken en leeg bevestigen (Ruimte plannen)', zoneVol:true };
  });
  pallets.forEach(p => {
    if(res[p.key]) return;
    const pi = palletInfo(p.code, p.note);
    const refs = WHL.locsVan(p.code).map(WHL.locInfo).filter(i => i.std);
    const ref = refs.find(i => i.h < 10) || refs[0] || levRef((D.P[p.code] || {}).leverancier);
    let best = null;
    Object.values(L).forEach(g => {
      if(p.grond ? g.h !== 0 : g.h === 0) return;
      const letters = Object.keys(g.pos).sort();
      const t = telLig[g.k] || {};
      if((t[p.code] || 0) >= pi.maxLig) return;
      if(pi.kg >= 600 && Object.values(t).reduce((s, n) => s + n, 0) >= pi.maxLig) return;
      for(let s = 0; s + pi.k <= letters.length; s++){
        if(pi.zij && pi.k === 1 && s !== 0 && s !== letters.length - 1) continue;
        const run = letters.slice(s, s + pi.k);
        // aaneengesloten (A,B,C…)
        if(run.some((l, j) => j && l.charCodeAt(0) !== run[j - 1].charCodeAt(0) + 1)) continue;
        if(run.some(l => g.pos[l].bezet || g.pos[l].res)) continue;
        let sc = 0;
        if(ref && ref.gang){
          if(g.gang === ref.gang) sc += Math.abs(g.sec - ref.sec) * 2;
          else if(g.hal === ref.hal) sc += 60 + gangAfst(g.gang, ref.gang) * 15 + Math.abs(g.sec - ref.sec);
          else sc += 400 + Math.abs(g.sec - (ref.sec || 0));
        } else sc += 200;
        sc += Math.max(0, (g.h - 10) / 10) * (pi.kg >= 500 ? 8 : 2);
        const leegLig = letters.every(l => !g.pos[l].bezet && (!g.pos[l].res || g.pos[l].res === p.code));
        if(pi.kg >= 600 && !leegLig) sc += 25;
        if(t[p.code]) sc -= 6;
        if(!best || sc < best.sc) best = { sc, g, run };
        break;
      }
    });
    if(!best){ res[p.key] = { loc:null, extra:[], reden:'geen vrije plek gevonden: kies zelf' }; return; }
    const namen = best.run.map(l => best.g.pos[l].naam);
    namen.forEach(n => reserveer(n, p.code));
    const r = [];
    if(ref && ref.gang === best.g.gang) r.push(refs.length ? 'bij ' + (refs.find(i => i.h < 10) || refs[0]).naam : 'gang ' + ref.gang);
    else if(ref && ref.gang) r.push((refs.length ? 'dichtbij ' + ref.naam : 'gang van ' + levKort((D.P[p.code] || {}).leverancier)) + ' (gang ' + ref.gang + ' vol)');
    if(pi.k > 1) r.push(pi.k + ' plaatsen');
    if(pi.zij) r.push('zijkant ligger');
    if(pi.kg >= 500) r.push(nf(pi.kg) + ' kg, max ' + pi.maxLig + ' per ligger');
    res[p.key] = { loc:namen[0], extra:namen.slice(1), reden:r.join(' · ') };
  });
  return res;
}
function pickDoel(code){
  const picks = WHL.locsVan(code).filter(l => WHL.soortLoc(l) === 'pick');
  if(picks.length) return { locs:picks };
  const e = D.AANVUL[code];
  if(e && e.pick) return { locs:[e.pick], nieuw:true };
  const pr = WHL.prof(code);
  if(pr && pr.final.pick) return { locs:[pr.final.pick], nieuw:true };
  return { locs:[] };
}
// per product (per container): pallets, plaatsen, waar ze nu heen gaan, en bij een zone: plekken, vrij, bezet
function zoneOverzicht(up, zones, voorstel){
  const L = ligBouw();
  const per = {};
  up.forEach(p => {
    const k = p.cid + '|' + p.code;
    const o = per[k] = per[k] || { k, cid:p.cid, c:p.c, code:p.code, pallets:0, plaatsen:0, geplaatst:0, toegewezen:0, gangen:{}, zone:zones[k] || null, keys:[] };
    const pi = palletInfo(p.code, p.note);
    o.pallets++; o.plaatsen += pi.k; o.keys.push(p.key);
    const v = voorstel[p.key] || {};
    if(v.loc){ o.toegewezen++; const g = WHL.locInfo(v.loc).gang; if(g) o.gangen[g] = (o.gangen[g] || 0) + 1; }
    if(v.geplaatst) o.geplaatst++;
  });
  Object.values(per).forEach(o => {
    o.tekort = o.pallets - o.toegewezen;
    if(!o.zone) return;
    o.plek = 0; o.vrijN = 0; o.bezet = []; o.liggers = zoneLiggers(L, o.zone); o.ligBev = 0;
    const pi0 = palletInfo(o.code); o.cap = o.liggers.reduce((n, g) => n + capLigger(g, pi0), 0); o.teKlein = o.pallets > o.cap;
    o.liggers.forEach(g => { const bv = ligBev(o.zone, g); if(bv) o.ligBev++; Object.keys(g.pos).sort().forEach(l => { const q = g.pos[l]; o.plek++; if(q.bezet && !bv) o.bezet.push(q.naam); else o.vrijN++; }); });
  });
  return per;
}
/* ---------- vrijmaken: wat staat er in de gekozen liggers en waar moet het heen ----------
   Per ligger die nog niet leeg bevestigd is: elke bezette plaats (Picqer-locatie of voorraad) is een verplaatsing, met een advies voor de nieuwe plek:
   een vrije plek buiten alle gekozen liggers, dichtbij de picklocatie van wat er staat, liefst bij hetzelfde product, brede pallets aaneengesloten. */
function vrijmaakLijst(P){
  const L = ligBouw();
  const per = new Map();
  Object.values(P.zoneInfo).forEach(o => {
    if(!o.zone) return;
    o.liggers.forEach(g => {
      const e = per.get(g.k) || { g, voor:[], cids:[], bev:true, units:[] };
      if(!e.voor.includes(o)) e.voor.push(o);
      if(!e.cids.includes(o.cid)) e.cids.push(o.cid);
      if(!ligBev(o.zone, g)) e.bev = false;
      per.set(g.k, e);
    });
  });
  const liggers = [...per.values()].sort((x, y) => x.g.gang.localeCompare(y.g.gang) || x.g.sec - y.g.sec || x.g.h - y.g.h);
  const zoneK = new Set(liggers.map(e => e.g.k));
  // wat staat waar: locatie-export (gekoppeld) + voorraad per locatie
  const vrLoc = {};
  Object.entries(D.VR).forEach(([code, v]) => Object.entries(v.locs).forEach(([l, q]) => { if(q > 0) (vrLoc[l] = vrLoc[l] || []).push([code, q]); }));
  const inh = naam => {
    const m = new Map();
    (((D.LOC[naam] || {}).codes) || []).forEach(c => { const cc = D.PLOW[String(c).toLowerCase()] || c; m.set(cc, 0); });
    (vrLoc[naam] || []).forEach(([c, q]) => m.set(c, q));
    return [...m.entries()].map(([code, qty]) => ({ code, qty }));
  };
  const zelfde = (a, b) => a.length === 1 && b.length === 1 && a[0].code === b[0].code;
  // 1. eenheden om te verplaatsen (brede pallets = meerdere plaatsen naast elkaar)
  const units = [];
  liggers.forEach(e => {
    if(e.bev) return;
    const letters = Object.keys(e.g.pos).sort();
    for(let i = 0; i < letters.length; ){
      const q = e.g.pos[letters[i]];
      if(!q.bezet){ i++; continue; }
      const codes = inh(q.naam);
      const k0 = codes.length === 1 ? palletInfo(codes[0].code).k : 1;
      const namen = [q.naam]; let j = i + 1;
      while(namen.length < k0 && j < letters.length && e.g.pos[letters[j]].bezet && letters[j].charCodeAt(0) === letters[j - 1].charCodeAt(0) + 1 && zelfde(codes, inh(e.g.pos[letters[j]].naam))){ namen.push(e.g.pos[letters[j]].naam); j++; }
      const u = { e, g:e.g, namen, codes, k:namen.length, naar:null, reden:'' };
      units.push(u); e.units.push(u); i = j;
    }
  });
  // 2. vrije plekken en wie er al zit
  const gereserveerd = new Set();
  Object.values(P.voorstel).forEach(v => { if(v.loc) [v.loc].concat(v.extra || []).forEach(n => gereserveerd.add(n)); });
  P.up.forEach(p => { const t = tv(p.key); if(t && t.loc) gereserveerd.add(t.loc); });
  const ligCodes = {};
  Object.values(L).forEach(g => { const set = ligCodes[g.k] = new Set(); Object.values(g.pos).forEach(q => { if(q.bezet) inh(q.naam).forEach(x => set.add(x.code)); }); });
  const gekozenDoel = new Set();
  units.slice().sort((x, y) => y.k - x.k).forEach(u => {
    const c0 = u.codes[0] ? u.codes[0].code : null;
    const refs = c0 ? WHL.locsVan(c0).map(WHL.locInfo).filter(i => i.std) : [];
    const ref = refs.find(i => i.h < 10) || refs.find(i => !u.namen.includes(i.naam)) || null;
    let best = null;
    Object.values(L).forEach(g => {
      if(zoneK.has(g.k) || (g.h === 0) !== (u.g.h === 0) || g.gang === 'AH') return;
      const letters = Object.keys(g.pos).sort();
      for(let s0 = 0; s0 + u.k <= letters.length; s0++){
        const run = letters.slice(s0, s0 + u.k);
        if(run.some((l, j) => (j && l.charCodeAt(0) !== run[j - 1].charCodeAt(0) + 1) || g.pos[l].bezet || gereserveerd.has(g.pos[l].naam))) continue;
        let sc = 0;
        if(ref){ if(g.gang === ref.gang) sc = Math.abs(g.sec - ref.sec) * 2; else if(g.hal === ref.hal) sc = 60 + gangAfst(g.gang, ref.gang) * 15 + Math.abs(g.sec - ref.sec); else sc = 400; }
        else sc = 200;
        sc += Math.max(0, (g.h - 10) / 10) * 2;
        const bijZelfde = c0 && ligCodes[g.k].has(c0);
        if(bijZelfde) sc -= 8;
        if(gekozenDoel.has(g.k)) sc -= 5;
        if(!best || sc < best.sc) best = { sc, g, run, bijZelfde, ref };
        break;
      }
    });
    if(!best){ u.reden = 'geen vrije plek gevonden: kies zelf'; return; }
    u.naar = best.run.map(l => best.g.pos[l].naam);
    u.naar.forEach(n => gereserveerd.add(n)); gekozenDoel.add(best.g.k);
    const r = [];
    if(best.ref && best.ref.gang === best.g.gang) r.push('zelfde gang als picklocatie ' + best.ref.naam);
    else if(best.ref) r.push('dichtbij picklocatie ' + best.ref.naam + ' (gang ' + best.ref.gang + ' vol)');
    if(best.bijZelfde) r.push('bij hetzelfde product');
    if(u.k > 1) r.push(u.k + ' plaatsen naast elkaar');
    u.reden = r.join(' · ');
  });
  return { liggers, units, n:units.length, open:liggers.filter(e => !e.bev) };
}
// Picqer-koppelimport: product → bulkplekken van liggers die leeg bevestigd zijn (ook als de voorraad nog niet is opgeboekt)
function koppelRijen(P){
  const per = {};
  P.up.forEach(p => {
    const v = P.voorstel[p.key]; if(!v || !v.loc || v.geplaatst) return;
    const z = P.zones[p.cid + '|' + p.code]; if(!z) return;
    const i = WHL.locInfo(v.loc); if(!i.std) return;
    if(!ligBev(z, { k:i.gang + dd(i.sec) + '|' + i.h })) return;
    const set = per[p.code] = per[p.code] || new Set();
    [v.loc].concat(v.extra || []).forEach(n => set.add(n));
  });
  const rijen = [];
  Object.entries(per).forEach(([code, set]) => {
    const bestaand = WHL.locsVan(code).filter(l => WHL.soortLoc(l) !== 'container');
    const nieuw = [...set].filter(n => !bestaand.includes(n)).sort(WHL.sortLoc);
    if(!nieuw.length) return;
    const q = D.PQ[code];
    rijen.push({ code, nieuw, rij:[q && q[3] ? q[3] : code, bestaand.concat(nieuw).join(', ')] });
  });
  return rijen.sort((a, b) => a.code.localeCompare(b.code));
}
function boVan(code){
  const r = D.BO.filter(x => (D.PLOW[String(x.productcode || '').toLowerCase()] || x.productcode) === code);
  return { orders:new Set(r.map(x => x.bestelling)).size, stuks:r.reduce((s, x) => s + (num(x.aantal) || 0), 0) };
}

/* ---------- scherm: containerdag ---------- */
const CHECK = [
  ['opgeboekt', 'Opgeboekt in Picqer (Jim)'],
  ['labels', 'Palletlabels geprint (Containers → Uitvoer)'],
  ['werkbon', 'Losplanning/werkbon geprint voor Sala en Valerii'],
  ['stockmove', 'Stockmove VST gedaan (Karin): palletnummers aangemaakt'],
  ['vstlabels', 'VST-stickers geprint en op de pallets']
];
function viewContainerdag(dagArg){
  if(dagArg) UI.dag = dagArg;
  const dag = kiesDag();
  const P = dagPlan(dag, true);
  const B = V();
  const dagen = losdagen();
  const kop = `<div class="card"><div class="row wrap between"><div><h2>Containerdag ${esc(fdate(dag, { weekday:'long', day:'numeric', month:'long' }))}</h2>
      <div class="small muted">${P.cs.map(c => `<b>${esc(cNaam(c))}</b> ${esc(c.containernummer || '')}${c.lostijd ? ' ' + esc(c.lostijd) : ''}`).join(' · ') || 'Geen containers op deze dag.'}</div></div>
      <div class="row wrap">${dagen.slice(0, 6).map(d => `<a class="btn sm ${d === dag ? 'pri' : ''}" href="#/containerdag/${d}">${esc(kort(d))}</a>`).join('')}<button class="btn sm" data-a="print">Print</button></div></div>
    ${!Object.keys(D.LOC).length ? '<div class="reason mt8">Locatie-export ontbreekt: zonder die kan de app geen bulklocaties voorstellen. <a href="#/gegevens">Inladen →</a></div>' : ''}
    ${P.geen.length ? `<div class="reason mt8">Nog geen verdeling voor: ${P.geen.map(x => `<span class="code">${esc(x.code)}</span>`).join(', ')}. <a href="./containerplanning.html">Containers → Verdeling</a></div>` : ''}</div>`;
  if(!P.cs.length){ app.innerHTML = kop; return; }

  // 1. voorbereiden
  const s1 = P.cs.map(c => {
    const vb = (c.voorboekingen || []);
    return `<div class="mt8"><b>${esc(cNaam(c))}</b> <span class="small muted">${esc(c.containernummer || '')}</span>
      ${CHECK.map(([k, t]) => {
        const key = 'cc:' + c.id + ':' + k;
        let extra = '';
        if(k === 'opgeboekt' && vb.length) extra = '<div class="td" style="color:var(--ok)">✓ ' + esc(vb.map(v => v.rc + ' (' + kort(v.datum) + '): ' + (v.regels || []).map(r => (r.code || r.productcode) + ' ' + nf(num(r.aantal))).join(', ')).join(' · ')) + '</div>';
        if(k === 'labels') extra = ` <a class="small" href="./containerplanning.html#/c/${c.id}/uitvoer">open Uitvoer</a>`;
        if((k === 'stockmove' || k === 'vstlabels') && !P.vst.some(v => v.cid === c.id)) return '';
        return `<div class="task ${tik(key) ? 'klaar' : ''}">${B.tikKnop(key)}<div class="grow"><div class="tt">${esc(t)}${extra}</div></div></div>`;
      }).join('')}</div>`;
  }).join('');

  // 2. apart voor orders
  const s2 = P.bo.length ? P.bo.map(x => {
    const bo = boVan(x.code);
    return `<div class="task ${tik(x.key) ? 'klaar' : ''}">${B.tikKnop(x.key, 'apart gezet')}<div class="grow">
      <div class="tt"><a class="code" href="#/p/${encodeURIComponent(x.code)}">${esc(x.code)}</a> ${x.pal ? plural(x.n, 'pallet', 'pallets') + ' × ' + nf(x.per) : nf(x.n) + ' los'} = <b>${nf(x.stuks)}</b> ${x.dest === 'KLANT' ? B.badge('klant, direct weg', 'b-info') : ''}</div>
      <div class="td">${esc(WHL.naamVan(x.code))} · ${esc(cNaam(x.c))}${bo.orders ? ' · ' + plural(bo.orders, 'order wacht', 'orders wachten') + ' (' + nf(bo.stuks) + ' st.)' : ''}${x.note ? ' · ' + esc(x.note) : ''}</div>
      <div class="td">Geen label. Apart zetten bij de paktafels; in Picqer op geen specifieke locatie laten${pickDoel(x.code).locs.length ? ' of naar ' + esc(pickDoel(x.code).locs[0]) : ''}. Daarna Backorders → Verwerk backorders.</div></div></div>`;
  }).join('') : '<div class="small muted">Geen pallets direct voor orders.</div>';

  // 3. naar bulk
  const upSort = P.up.slice().sort((a, b) => {
    const la = (tv(a.key) || {}).loc || (P.voorstel[a.key] || {}).loc || 'ZZ', lb = (tv(b.key) || {}).loc || (P.voorstel[b.key] || {}).loc || 'ZZ';
    return WHL.sortLoc(la, lb);
  });
  const nGepl = P.up.filter(p => tv(p.key) && tv(p.key).loc).length;
  let vorigeGang = null;
  const s3 = upSort.map(p => {
    const v = P.voorstel[p.key] || {}, t = tv(p.key);
    const loc = (t && t.loc) || v.loc;
    const gang = loc ? (WHL.locInfo(loc).gang || '–') : '–';
    let kopje = '';
    if(gang !== vorigeGang){ kopje = `<div class="gangkop"><b>Gang ${esc(gang)}</b></div>`; vorigeGang = gang; }
    const pi = palletInfo(p.code, p.note);
    return kopje + `<div class="mv ${t && t.loc ? 'klaar' : ''}" data-plek="${esc(p.key)}">
      <div class="aant" style="text-align:left;min-width:40px">${t && t.loc ? '✓' : ''}</div>
      <div><div><a class="code" href="#/p/${encodeURIComponent(p.code)}">${esc(p.code)}</a> <span class="desc">${esc(WHL.naamVan(p.code))}</span></div>
        <div class="route">${t && t.loc ? V().locBadge(t.loc) + ' <span class="small muted">geplaatst</span>' : v.loc ? V().locBadge(v.loc) + (v.extra.length ? ' <span class="small muted">+ ' + esc(v.extra.join(', ')) + '</span>' : '') : v.zoneVol ? '<span class="badge b-warn">wacht: ligger nog niet leeg bevestigd</span>' : '<span class="badge b-bad">kies zelf</span>'}</div>
        <div class="meta">pallet ${p.i + 1}/${p.van} · ${nf(p.stuks)} st.${pi.maat ? ' · ' + esc(pi.maat) : ''}${pi.kg ? ' · ' + nf(pi.kg) + ' kg' : ''} · ${esc(cNaam(p.c))}${v.reden ? ' · ' + esc(v.reden) : ''}${p.note ? ' · <i>' + esc(p.note) + '</i>' : ''}</div>
        <div class="row wrap mt4 noprint"><input class="loc" data-loc="${esc(p.key)}" value="${esc(loc || '')}" placeholder="locatie">
          <button class="btn sm ${t && t.loc ? '' : 'ok'}" data-d="plaats" data-k="${esc(p.key)}">${t && t.loc ? 'Wijzig' : 'Geplaatst'}</button>
          ${t && t.loc ? `<button class="btn sm ghost" data-d="plaats-weg" data-k="${esc(p.key)}">ongedaan</button>` : ''}</div>
        <div class="meta">Picqer: verplaats ${nf(p.stuks)} van geen specifieke locatie → ${esc(loc || '…')}</div></div>
      <div class="aant">${nf(p.stuks)}<small>stuks</small></div></div>`;
  }).join('');

  // 4. naar picklocatie
  const s4 = P.pick.length ? P.pick.map(x => {
    const d = pickDoel(x.code), t = tv(x.key);
    return `<div class="task ${t ? 'klaar' : ''}">${B.tikKnop(x.key, 'op pick')}<div class="grow">
      <div class="tt"><a class="code" href="#/p/${encodeURIComponent(x.code)}">${esc(x.code)}</a> ${x.pal ? plural(x.n, 'pallet', 'pallets') + ' × ' + nf(x.per) : 'los'} = <b>${nf(x.stuks)}</b> → ${d.locs.length ? d.locs.map(V().locBadge).join(' ') + (d.nieuw ? ' ' + B.badge('nieuwe picklocatie', 'b-warn') : '') : '<span class="badge b-warn">geen picklocatie: geef er een (Invullen)</span>'}</div>
      <div class="td">${esc(WHL.naamVan(x.code))} · ${esc(cNaam(x.c))}${x.note ? ' · ' + esc(x.note) : ''} · Picqer: verplaats ${nf(x.stuks)} van geen specifieke locatie → ${esc(d.locs[0] || 'picklocatie')}</div></div></div>`;
  }).join('') : '<div class="small muted">Niets naar een picklocatie.</div>';

  // 5. VST
  const s5 = P.vst.length ? P.vst.map(x => {
    const nieuw = vstNieuw(x.code);
    return `<div class="task ${tik(x.key) ? 'klaar' : ''}">${B.tikKnop(x.key, 'naar VST')}<div class="grow">
      <div class="tt"><a class="code" href="#/p/${encodeURIComponent(x.code)}">${esc(x.code)}</a> ${x.pal ? plural(x.n, 'pallet', 'pallets') + ' × ' + nf(x.per) : nf(x.n) + ' los'} = <b>${nf(x.stuks)}</b></div>
      <div class="td">${esc(WHL.naamVan(x.code))} · ${esc(cNaam(x.c))}${nieuw.length ? ' · palletnummers: <b>' + esc(nieuw.join(', ')) + '</b>' : ' · palletnummers: na de VST-export zichtbaar'}</div></div></div>`;
  }).join('') + `<div class="small muted mt8">Stockmove-lijst en VST-mail: <a href="./containerplanning.html">Containers → Uitvoer</a>.</div>` : '<div class="small muted">Niets naar VST.</div>';

  // 1. ruimte maken: hele liggers vrijmaken (dagen vooraf)
  const zi = Object.values(P.zoneInfo);
  const vl = vrijmaakLijst(P);
  const koppel = koppelRijen(P);
  const tijd = op => op ? new Date(op).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }) : '';
  const zoneRij = o => {
    const zk = o.cid + '|' + o.code;
    const wacht = o.zone && o.tekort > 0 && !o.teKlein && o.ligBev < o.liggers.length;
    return `<div class="mv" style="grid-template-columns:1fr auto">
      <div><div><a class="code" href="#/p/${encodeURIComponent(o.code)}">${esc(o.code)}</a> <span class="desc">${esc(WHL.naamVan(o.code))}</span></div>
        <div class="meta">${plural(o.pallets, 'pallet', 'pallets')}${o.plaatsen !== o.pallets ? ' · ' + nf(o.plaatsen) + ' plaatsen' : ''}${o.zone ? ' · liggers <b>' + esc(o.zone.tekst) + '</b>' + (o.zone.auto ? ' <i>(voorstel van de app)</i>' : '') : ''}</div>
        <div class="row wrap mt4 noprint"><input class="loc" data-zone="${esc(zk)}" value="${esc(o.zone ? o.zone.tekst : '')}" placeholder="liggers, bv. CC07/10, CC07/20" style="width:230px">
          <button class="btn sm" data-d="zone-op" data-k="${esc(zk)}">Opslaan</button>
          ${o.zone && o.zone.auto && !o.ligBev ? `<button class="btn sm ghost" data-d="lig-ander" data-k="${esc(zk)}">Andere liggers</button>` : ''}</div>
        ${!o.zone ? '<div class="meta rood">Nog geen liggers gekozen' + (Object.keys(D.LOC).length ? ': geen geschikte ligger gevonden, typ er een.' : ': locatie-export ontbreekt.') + '</div>' : ''}
        ${wacht ? '<div class="meta">Wacht tot de liggers leeg zijn bevestigd.</div>' : ''}
        ${o.zone && o.tekort > 0 && !wacht ? `<div class="meta rood">Past niet: de liggers bieden plek voor ${plural(o.cap, 'pallet', 'pallets')}, nodig ${nf(o.pallets)}${palletInfo(o.code).kg >= 500 ? ' (zwaar: max ' + palletInfo(o.code).maxLig + ' per ligger)' : ''}. ${o.zone.auto ? 'Tik Andere liggers of typ er een bij.' : 'Voeg een ligger toe, bv. ' + esc(o.zone.tekst) + ', CC08/10.'}</div>` : ''}</div>
      <div class="aant">${nf(o.toegewezen)}/${nf(o.pallets)}<small>ingedeeld</small></div></div>`;
  };
  const cBlok = c => {
    const os = zi.filter(o => o.cid === c.id);
    if(!os.length) return '';
    const pal = os.reduce((n, o) => n + o.pallets, 0), pl = os.reduce((n, o) => n + o.plaatsen, 0);
    const ligK = [];
    os.forEach(o => (o.liggers || []).forEach(g => { if(!ligK.some(x => x.k === g.k)) ligK.push(g); }));
    ligK.sort((x, y) => x.gang.localeCompare(y.gang) || x.sec - y.sec || x.h - y.h);
    const bevC = g => os.some(o => o.zone && (o.liggers || []).some(x => x.k === g.k) && ligBev(o.zone, g));
    const nBev = ligK.filter(bevC).length;
    const rij = g => {
      const voor = os.filter(o => o.zone && o.liggers.some(x => x.k === g.k));
      const tot = Object.keys(g.pos).length, bezetN = Object.values(g.pos).filter(q => q.bezet).length;
      const bv = bevC(g), op = (tv('czl:' + c.id + ':' + g.k) || {}).op;
      return `<tr><td><b class="loc">${esc(ligToken(g))}</b><div class="small muted">${esc(ligBereik(g))}</div></td>
        <td class="small">${voor.map(o => esc(o.code)).join('<br>')}</td>
        <td class="small">${bv ? '' : bezetN ? '<b style="color:var(--bad)">' + bezetN + ' van ' + tot + ' plaatsen bezet</b>' : 'Picqer: vrij, controleer ter plekke'}</td>
        <td class="noprint">${bv ? `<span class="badge b-ok">✓ leeg${op ? ' ' + esc(tijd(op)) : ''}</span> <button class="btn sm ghost" data-d="lig-leeg" data-cid="${c.id}" data-lk="${esc(g.k)}">ongedaan</button>` : `<button class="btn sm ok" data-d="lig-leeg" data-cid="${c.id}" data-lk="${esc(g.k)}">Leeg bevestigen</button>`}</td></tr>`;
    };
    return `<div class="mt8"><div class="row wrap between"><div><b>${esc(cNaam(c))}</b> <span class="small muted">${esc(c.containernummer || '')}</span></div>
        <span class="small">${esc(nBev + '/' + ligK.length)} liggers leeg</span></div>
      <div class="reason mt4"><b>${plural(pal, 'pallet', 'pallets')}</b> naar bulk = <b>${nf(pl, 1)} plaatsen</b> → ${ligK.length ? '<b>' + plural(ligK.length, 'ligger', 'liggers') + '</b> vrijmaken' : '<b>nog geen liggers gekozen</b>'}</div>
      ${os.map(zoneRij).join('')}
      ${ligK.length ? `<div class="scroll mt8"><table><tr><th>Ligger</th><th>Voor</th><th>Nu</th><th class="noprint"></th></tr>${ligK.map(rij).join('')}</table></div>
        ${nBev < ligK.length ? `<div class="mt8 noprint"><button class="btn sm" data-d="lig-alle" data-cid="${c.id}">Alle liggers leeg bevestigen</button></div>` : ''}` : ''}</div>`;
  };
  const bulkC = P.cs.filter(c => zi.some(o => o.cid === c.id));
  const ligTot = bulkC.reduce((n, c) => n + new Set(zi.filter(o => o.cid === c.id).flatMap(o => (o.liggers || []).map(g => g.k))).size, 0);
  const ligBevTot = bulkC.reduce((n, c) => { const os = zi.filter(o => o.cid === c.id); const ks = new Set(os.flatMap(o => (o.liggers || []).map(g => g.k))); return n + [...ks].filter(k => os.some(o => o.zone && o.liggers.some(g => g.k === k && ligBev(o.zone, g)))).length; }, 0);
  const s0 = zi.length ? `<div class="small muted mb8">1. De app kiest hele liggers voor de pallets naar bulk, met zo min mogelijk om te ruimen. Pas aan door liggers te typen (<b>CC07/10</b> = CC07A10 t/m D10, of <b>CC 07-09</b> voor een gang met secties) of tik <b>Andere liggers</b>.<br>
      2. Print de vrijmaaklijst hieronder voor de chauffeur: wat er nu staat en waar het heen gaat.<br>
      3. Is een ligger leeg (ook wat los ligt), tik <b>Leeg bevestigen</b>. Pas dan krijgen de pallets hun plek op het label.<br>
      4. Koppel de producten alvast aan die plekken in Picqer (onderaan), ook als de voorraad nog niet is opgeboekt.</div>
    ${bulkC.map(cBlok).join('')}` : '<div class="small muted">Geen pallets naar bulk.</div>';
  const prodTekst = c => esc(c.code + ' ' + WHL.naamVan(c.code).slice(0, 34)) + (c.qty ? ' · ' + nf(c.qty) + ' st.' + (WHL.sppVan(c.code) ? ' (≈ ' + nf(c.qty / WHL.sppVan(c.code), 1) + ' pallet)' : '') : '');
  const ligBlok = e => `<div class="lg"><b>Ligger ${esc(ligToken(e.g))}</b> <span class="small">${esc(ligBereik(e.g))} · voor ${esc(e.voor.map(o => o.code).join(', '))}</span></div>
    <table class="vtab"><tr><th></th><th>Van</th><th>Wat staat er</th><th>Naar</th></tr>
      ${e.units.map(u => `<tr><td class="vk"><span class="pvak"></span></td><td class="loc">${esc(u.namen.join(' + '))}</td>
        <td>${u.codes.length ? u.codes.map(prodTekst).join('<br>') : 'niets gekoppeld: kijk wat er staat'}</td>
        <td class="loc">${u.naar ? esc(u.naar.join(' + ')) : '<b>zelf kiezen</b>'}${u.reden ? '<div class="small">' + esc(u.reden) + '</div>' : ''}</td></tr>`).join('')}
      <tr><td class="vk"><span class="pvak"></span></td><td colspan="3"><b>Ligger leeg?</b> <span class="small">${e.units.length ? 'Kijk ook of er niets los ligt of ernaast.' : 'Picqer toont deze ligger vrij. Controleer ter plekke: niets los, past de pallet?'}</span></td></tr></table>`;
  const vrijKaart = vl.open.length ? `<div class="card vrijlijst"><div class="row wrap between"><div><h3>Vrijmaaklijst voor de chauffeur · ${plural(vl.open.length, 'ligger', 'liggers')} · ${plural(vl.n, 'verplaatsing', 'verplaatsingen')}</h3>
      <div class="small"><b>Containerdag ${esc(fdate(dag, { weekday:'long', day:'numeric', month:'long' }))}</b> · ${P.cs.map(c => esc(cNaam(c) + ' ' + (c.containernummer || ''))).join(' · ')}</div>
      <div class="small muted">Verplaats ook in Picqer (van → naar). Vrij = geen product gekoppeld${D.VRDATUM ? ' en geen voorraad' : ''} volgens de laatste export: kijk ter plekke. Daarna tikt Daan per ligger <b>Leeg bevestigen</b>.</div></div>
      <button class="btn sm pri noprint" data-d="print-vrij">Print lijst</button></div>
    ${vl.open.map(ligBlok).join('')}</div>`
    : vl.liggers.length ? '<div class="card" style="border-left:5px solid var(--ok)"><b>Alle liggers zijn leeg bevestigd.</b> <span class="small muted">Er is niets meer te verplaatsen.</span></div>' : '';
  const koppelKaart = vl.liggers.length ? `<div class="card"><h3>Producten alvast koppelen in Picqer</h3>
      <div class="small muted">Voor liggers die leeg bevestigd zijn. De producten worden aan de bulkplekken gekoppeld, ook als de voorraad nog niet is opgeboekt. Picqer: Producten → Importeren → alleen bestaande bijwerken. Eerst testen met 2 producten.</div>
      ${koppel.length ? `<div class="mt8">${koppel.map(x => `<div class="small"><span class="code">${esc(x.code)}</span> → ${esc(x.nieuw.join(', '))}</div>`).join('')}</div>
        <div class="mt8"><button class="btn sm pri" data-d="lig-koppel">Download Picqer-import (${koppel.length})</button></div>` : '<div class="small muted mt8">Nog geen ligger leeg bevestigd.</div>'}</div>` : '';

  const stap = (nr, titel, sub, body, open) => `<div class="card"><div class="row between"><h3>${nr}. ${esc(titel)}</h3><span class="small muted">${sub || ''}</span></div><div class="mt8">${body}</div></div>`;
  app.innerHTML = kop
    + stap(1, 'Ruimte maken: liggers vrijmaken (dagen vooraf)', ligBevTot + '/' + ligTot + ' liggers leeg', s0) + vrijKaart + koppelKaart
    + stap(2, 'Voor het lossen', '', s1)
    + stap(3, 'Apart zetten voor orders', P.bo.filter(x => tik(x.key)).length + '/' + P.bo.length, s2)
    + stap(4, 'Naar bulk (up)', nGepl + '/' + P.up.length + ' geplaatst', (P.up.length ? `<div class="small muted mb8">Plek per pallet (zone of voorstel van de app). Staat er toch iets? Typ de plek waar hij echt staat en tik Geplaatst.</div>` : '') + (s3 || '<div class="small muted">Geen pallets naar bulk.</div>'))
    + stap(5, 'Naar picklocatie (los en overig)', P.pick.filter(x => tik(x.key)).length + '/' + P.pick.length, s4)
    + stap(6, 'Naar VST', P.vst.filter(x => tik(x.key)).length + '/' + P.vst.length, s5)
    + `<div class="card" style="border-left:5px solid var(--ok)"><h3>7. Alles gedaan?</h3><div class="small muted mt4">Maak in Picqer de exports van ná het verplaatsen en laat de app alles nalopen: welke bulkplekken, juiste aantallen, gemiste locaties, wat nog op geen specifieke locatie staat en de VST-palletnummers.</div>
      <div class="row wrap mt8"><a class="btn ok" href="#/controle/${dag}">Klaar → controleren</a></div></div>`;
}
function vstNieuw(code){
  const nu = D.VSTLOC[code] || [], oud = new Set(D.VSTLOCVORIG[code] || []);
  const nieuw = nu.filter(p => !oud.has(p));
  return (Object.keys(D.VSTLOCVORIG).length ? nieuw : []).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
}

/* ---------- scherm: controle na het verplaatsen ---------- */
function viewControle(dagArg){
  if(dagArg) UI.dag = dagArg;
  const dag = kiesDag();
  const P = dagPlan(dag);
  const B = V();
  const vrVers = D.VRDATUM && isoDag(D.VRDATUM) >= dag;
  const vstVers = (D.VSTDATUM && isoDag(D.VSTDATUM) >= dag) || (D.VSTVRDATUM && isoDag(D.VSTVRDATUM) >= dag);
  const exp = `<div class="card"><div class="row wrap between"><div><h2>Controle ${esc(kort(dag))}</h2><div class="small muted">${P.cs.map(c => esc(cNaam(c))).join(' · ')}</div></div><a class="small" href="#/containerdag/${dag}">← containerdag</a></div>
    <div class="mt8"><b>Exports van ná het verplaatsen</b> (sleep ze tegelijk hierin):</div>
    <div class="small mt4">1. Voorraad per locatie, Hoofdmagazijn (zelfde export als stock-…xlsx van 2-9) ${B.exportLeeftijd(D.VRDATUM)}<br>
      2. VST: voorraad per locatie of locatie-export van magazijn Bulk van Spreuwel ${B.exportLeeftijd(D.VSTVRDATUM || D.VSTDATUM)}<br>
      3. Backorders (Backorders → Exporteer backorders) ${B.exportLeeftijd(B.dataDatums().backorders)}</div>
    <label class="drop mt8" id="cdrop" style="display:block"><input type="file" id="cfiles" multiple accept=".xlsx,.xls,.csv,.pdf" hidden><b>Bestanden kiezen of hierheen slepen</b></label>
    <div id="cst" class="status"></div></div>`;
  if(!vrVers){
    app.innerHTML = exp + `<div class="card empty">Nog geen voorraad-per-locatie van ${esc(kort(dag))} of later. Laad die eerst in; dan loopt de app alles na.</div>`;
    koppelDrop('cdrop', 'cfiles', 'cst', () => viewControle());
    return;
  }
  // per product: gepland vs gevonden
  const codes = [...new Set([].concat(P.up, P.pick, P.bo, P.vst).map(x => x.code))];
  let nGoed = 0, nFout = 0, nLet = 0;
  const rijen = codes.map(code => {
    const vr = D.VR[code] || { locs:{}, geen:0, cont:{} };
    const up = P.up.filter(p => p.code === code);
    const pick = P.pick.filter(p => p.code === code);
    const bo = P.bo.filter(p => p.code === code);
    const vst = P.vst.filter(p => p.code === code);
    const regels = [];
    // bulk: per locatie optellen wat er moest komen
    const moet = {};
    up.forEach(p => { const l = (tv(p.key) || {}).loc || (P.voorstel[p.key] || {}).loc; if(l) moet[l] = (moet[l] || 0) + p.stuks; else regels.push(['fout', 'pallet ' + (p.i + 1) + ' heeft geen locatie']); });
    Object.entries(moet).forEach(([l, n]) => {
      const q = vr.locs[l] || 0;
      if(q >= n) regels.push(['ok', l + ': ' + nf(q) + (q > n ? ' (moest ' + nf(n) + ', stond er al wat?)' : '')]);
      else if(q > 0) regels.push(['let', l + ': ' + nf(q) + ' van ' + nf(n)]);
      else regels.push(['fout', l + ': niets in Picqer (moest ' + nf(n) + ')']);
    });
    // pick
    const pd = pickDoel(code);
    let geenMag = 0;
    if(pick.length){
      const n = pick.reduce((s, x) => s + x.stuks, 0);
      if(!pd.locs.length){
        geenMag = n;
        regels.push([vr.geen >= n ? 'let' : 'fout', 'geen picklocatie: ' + nf(vr.geen) + ' op geen specifieke locatie (moest ' + nf(n) + '). Geef een picklocatie (Invullen)']);
      } else {
        const op = pd.locs.map(l => [l, vr.locs[l] || 0]);
        const q = op.reduce((s, x) => s + x[1], 0);
        regels.push([q >= n ? 'ok' : q > 0 ? 'let' : 'fout', 'pick ' + op.map(x => x[0] + ' ' + nf(x[1])).join(', ') + ' (moest minstens ' + nf(n) + ')' + (pd.nieuw ? ' · nieuwe picklocatie: koppelen in Picqer' : '')]);
      }
    }
    // andere bulk waar het product ook staat
    const ander = Object.entries(vr.locs).filter(([l, q]) => q > 0 && !moet[l] && !pd.locs.includes(l));
    if(ander.length) regels.push(['info', 'ook op ' + ander.map(([l, q]) => l + ' ' + nf(q)).join(', ')]);
    // geen specifieke locatie: mag alleen wat voor orders apart staat
    const boStuks = bo.reduce((s, x) => s + x.stuks, 0);
    if(vr.geen > geenMag){
      const bov = boVan(code);
      if(vr.geen <= boStuks && bov.orders) regels.push(['info', nf(vr.geen) + ' op geen specifieke locatie (voor ' + plural(bov.orders, 'order', 'orders') + ')']);
      else regels.push(['let', nf(vr.geen) + ' nog op geen specifieke locatie']);
    }
    // VST
    if(vst.length){
      const n = vst.reduce((s, x) => s + (x.pal ? x.n : 0), 0);
      const nieuw = vstNieuw(code);
      const metAantal = (D.VSTVR[code] || []).filter(([p]) => nieuw.includes(p));
      if(!vstVers) regels.push(['let', 'VST: export van ná de Stockmove ontbreekt']);
      else regels.push([nieuw.length >= n ? 'ok' : nieuw.length ? 'let' : 'fout', 'VST ' + nieuw.length + ' van ' + n + ' pallets' + (nieuw.length ? ': ' + (metAantal.length ? metAantal.map(([p, q]) => p + ' (' + nf(q) + ')').join(', ') : nieuw.join(', ')) : '')]);
    }
    const erg = regels.some(r => r[0] === 'fout') ? 'fout' : regels.some(r => r[0] === 'let') ? 'let' : 'ok';
    if(erg === 'fout') nFout++; else if(erg === 'let') nLet++; else nGoed++;
    return { code, erg, regels };
  }).sort((a, b) => ({ fout:0, let:1, ok:2 }[a.erg] - { fout:0, let:1, ok:2 }[b.erg]));
  const cls = { ok:'b-ok', let:'b-warn', fout:'b-bad', info:'b-grey' };
  const tabel = rijen.map(r => `<div class="mv" style="grid-template-columns:auto 1fr"><div>${B.badge(r.erg === 'ok' ? 'goed' : r.erg === 'let' ? 'let op' : 'mis', cls[r.erg])}</div>
    <div><a class="code" href="#/p/${encodeURIComponent(r.code)}">${esc(r.code)}</a> <span class="desc">${esc(WHL.naamVan(r.code))}</span>
    <div class="small mt4">${r.regels.map(([k, t]) => B.badge(t, cls[k])).join(' ')}</div></div></div>`).join('');
  // alles op geen specifieke locatie (hele magazijn)
  const geen = Object.entries(D.VR).filter(([c, v]) => v.geen > 0 && !codes.includes(c)).map(([c, v]) => ({ c, n:v.geen, bo:boVan(c).orders, vk:WHL.vkVan(c) || 0 }))
    .sort((a, b) => b.vk - a.vk || b.n - a.n);
  // VST-palletnummers van vandaag
  const vstRijen = P.vst.map(x => ({ code:x.code, nieuw:vstNieuw(x.code) })).filter(x => x.nieuw.length);
  app.innerHTML = exp + `<div class="card"><div class="row wrap between"><h3>Container-producten</h3><span>${B.badge(nGoed + ' goed', 'b-ok')} ${B.badge(nLet + ' let op', 'b-warn')} ${B.badge(nFout + ' mis', 'b-bad')}</span></div>
      <div class="small muted mt4">Voorraad per locatie van ${esc(fdt(D.VRDATUM))}. "Mis" = pallet niet gevonden op de plek waar hij hoort: plek vergeten in Picqer, of op een andere plek gezet.</div>
      <div class="mt8">${tabel}</div>
      <div class="row wrap mt8"><button class="btn ok" data-a="tik" data-k="cc:dag:${dag}:controle">${tik('cc:dag:' + dag + ':controle') ? '✓ Controle afgerond' : 'Controle afgerond'}</button></div></div>
    <div class="card"><h3>VST-palletnummers ${esc(kort(dag))}</h3>${vstRijen.length ? `<div class="scroll mt8"><table><tr><th>Product</th><th>Nieuwe palletnummers</th></tr>${vstRijen.map(x => `<tr><td class="code">${esc(x.code)}</td><td class="loc">${esc(x.nieuw.join(', '))}</td></tr>`).join('')}</table></div>
      <div class="row wrap mt8"><button class="btn sm" data-d="vst-xlsx" data-dag="${dag}">Download VST-lijst (Excel)</button></div>` : '<div class="small muted mt8">Nog geen nieuwe palletnummers gevonden. Laad de VST-export van ná de Stockmove in (de app vergelijkt met de vorige VST-export).</div>'}</div>
    <div class="card"><h3>Overig op geen specifieke locatie (${nf(geen.length)})</h3><div class="small muted mt4">Hele Hoofdmagazijn, lopers eerst. Geef ze een plek: <a href="#/invul/geen">Invullen → geen locatie</a>.</div>
      <div class="scroll mt8"><table><tr><th>Product</th><th class="n">Op geen locatie</th><th class="n">Verkoop/mnd</th><th>Heeft</th></tr>${geen.slice(0, 40).map(x => `<tr><td><a class="code" href="#/p/${encodeURIComponent(x.c)}">${esc(x.c)}</a><div class="desc">${esc(WHL.naamVan(x.c))}</div></td><td class="n">${nf(x.n)}</td><td class="n">${nf(x.vk, 1)}</td><td>${V().locs(WHL.locsVan(x.c).slice(0, 3))}</td></tr>`).join('')}</table></div>${geen.length > 40 ? `<div class="small muted mt4">+ ${nf(geen.length - 40)} meer</div>` : ''}</div>`;
  koppelDrop('cdrop', 'cfiles', 'cst', () => viewControle());
}
function koppelDrop(dropId, inpId, stId, na){
  const inp = $(inpId), drop = $(dropId); if(!inp || !drop) return;
  const lees = f => V().inlezen(f, { statusId:stId, na });
  inp.onchange = () => { if(inp.files.length) lees([...inp.files]); inp.value = ''; };
  ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', ev => { const f = [...(ev.dataTransfer.files || [])]; if(f.length) lees(f); });
}

/* =====================================================================
   BACKORDERS: wat is opgelost, wat staat nog open, wat is nieuw
   ===================================================================== */
function boDiff(){
  if(!D.BOVORIG || !D.BOVORIG.orders) return null;
  const oud = D.BOVORIG.orders;
  const nieuw = {};
  D.BO.forEach(r => (nieuw[r.bestelling] = nieuw[r.bestelling] || []).push([r.productcode, num(r.aantal), num(r.beschikbaar)]));
  const o = Object.keys(oud), n = Object.keys(nieuw);
  return { van:D.BOVORIG.datum, opgelost:o.filter(x => !nieuw[x]), open:n.filter(x => oud[x]), nieuw:n.filter(x => !oud[x]), oud, nieuwM:nieuw };
}
function viewBackorders(){
  const d = boDiff();
  const B = V();
  if(!d){ app.innerHTML = '<div class="card empty">Nog geen vergelijking: laad een nieuwe backorder-export in (de vorige wordt dan bewaard).</div>'; return; }
  const C = WHL.bereken();
  const mvOrders = new Set(C.mv.flatMap(m => m.orders));
  const regel = (nr, rr) => `<tr><td class="code">${esc(nr)}</td><td class="small">${rr.map(([c, a, b]) => `<a class="code" href="#/p/${encodeURIComponent(c)}">${esc(c)}</a> ×${nf(a)}${b >= a ? ' ' + B.badge('beschikbaar', 'b-ok') : ''}`).join('<br>')}</td><td class="small">${mvOrders.has(nr) ? B.badge('wacht op verplaatsen', 'b-bad') : ''}</td></tr>`;
  const blok = (titel, lijst, bron, open) => `<details class="card" ${open ? 'open' : ''}><summary>${esc(titel)} · ${lijst.length}</summary><div class="scroll mt8"><table><tr><th>Order</th><th>Regels</th><th></th></tr>${lijst.slice(0, 200).map(nr => regel(nr, bron[nr])).join('')}</table></div></details>`;
  app.innerHTML = `<div class="card"><h2>Backorders: vorige vs nu</h2><div class="small muted">Vorige export ${esc(fdt(d.van))} · nu ${esc(fdt(B.dataDatums().backorders))}.</div>
    <div class="tiles mt12"><div class="tile t-ok"><div class="lbl">Opgelost</div><div class="big">${nf(d.opgelost.length)}</div><div class="sub">orders niet meer in backorder</div></div>
      <div class="tile t-warn"><div class="lbl">Nog open</div><div class="big">${nf(d.open.length)}</div><div class="sub">${nf(d.open.filter(x => mvOrders.has(x)).length)} wachten op verplaatsen</div></div>
      <div class="tile t-bad"><div class="lbl">Nieuw</div><div class="big">${nf(d.nieuw.length)}</div><div class="sub">sinds de vorige export</div></div></div></div>
    ${blok('Nieuw', d.nieuw, d.nieuwM, true)}${blok('Nog open', d.open, d.nieuwM, false)}${blok('Opgelost', d.opgelost, d.oud, false)}`;
}

/* =====================================================================
   RUIMTE MAKEN voor de komende containers
   ===================================================================== */
function ruimte(){
  const vd = vandaag();
  const tot = isoDag(Date.now() + 21 * 864e5);
  const komend = D.CONT.filter(c => c.status !== 'afgerond' && c.losdatum && c.losdatum > vd && c.losdatum <= tot).sort((a, b) => a.losdatum.localeCompare(b.losdatum));
  const conts = komend.map(c => {
    const p = plan(c);
    let pal = 0, pl = 0, schat = false;
    if(Object.keys(c.verdeling || {}).length){
      p.up.concat(p.pick.filter(x => x.pal)).forEach(x => { const n = x.pal && x.n ? x.n : 1; const pi = palletInfo(x.code); pal += n; pl += n * Math.max(1, pi.plaatsen); });
    } else {
      schat = true;
      (c.regels || []).forEach(r => { if(r.soort === 'pallet' && r.productcode){ const n = num(r.aantal) || 0; pal += n; pl += n * Math.max(1, palletInfo(r.productcode).plaatsen); } });
    }
    return { c, pal, pl:Math.round(pl), schat };
  });
  // vrije bulkplaatsen per hal
  const L = ligBouw();
  const vrij = {};
  Object.values(L).forEach(g => Object.values(g.pos).forEach(p => { if(!p.bezet && g.h > 0) vrij[g.hal] = (vrij[g.hal] || 0) + 1; }));
  // naar VST: veel bulk en veel maanden voorraad
  const naarVst = [];
  Object.values(D.P).forEach(p => {
    const code = p.productcode;
    const bulks = WHL.locsVan(code).filter(l => WHL.soortLoc(l) === 'bulk');
    if(!bulks.length) return;
    const vk = WHL.vkVan(code); const hm = num(p.vrij_hm) || 0;
    if(!vk || hm <= 0 || boVan(code).orders) return;
    const mnd = hm / vk;
    if(mnd < 4) return;
    const spp = WHL.sppVan(code);
    const houd = spp ? Math.max(1, Math.ceil(1.5 * vk / spp)) : 1;
    const weg = bulks.length - houd;
    if(weg < 1) return;
    naarVst.push({ code, bulks, mnd, vk, weg, spp, hm });
  });
  naarVst.sort((a, b) => b.weg - a.weg || b.mnd - a.mnd);
  // gekoppeld maar zonder voorraad (alleen met verse voorraad-per-locatie)
  const leegGek = [];
  if(D.VRDATUM && dagenOud(D.VRDATUM) < 3){
    Object.values(D.LOC).forEach(l => {
      if(!l.bulk || !l.codes.length) return;
      const alleLeeg = l.codes.every(c => { const cc = D.PLOW[c.toLowerCase()] || c; const v = D.VR[cc]; return !v || !(v.locs[l.naam] > 0); });
      if(alleLeeg) leegGek.push(l.naam);
    });
  }
  const S = WHL.locStats();
  return { conts, vrij, naarVst, leegGek:leegGek.sort(WHL.sortLoc), aand:S.aand, nodig:conts.reduce((s, x) => s + x.pl, 0), vrijTot:Object.values(vrij).reduce((s, n) => s + n, 0) };
}
function viewRuimte(){
  const R = ruimte();
  const B = V();
  const tekort = R.nodig - R.vrijTot;
  app.innerHTML = `<div class="card"><h2>Ruimte maken</h2><div class="small muted">Komende 3 weken. Nodig = pallets die hier blijven (bulk + pick) × palletplaatsen (Containers). Vrij = bulkplaatsen zonder gekoppeld product${D.VRDATUM ? ' en zonder voorraad' : ''}: controleer ter plekke, "zonder product" is niet altijd leeg.</div>
    <div class="tiles mt12"><div class="tile ${tekort > 0 ? 't-bad' : 't-ok'}"><div class="lbl">Nodig</div><div class="big">${nf(R.nodig)}</div><div class="sub">palletplaatsen, ${R.conts.length} containers</div></div>
      <div class="tile t-info"><div class="lbl">Vrij (volgens Picqer)</div><div class="big">${nf(R.vrijTot)}</div><div class="sub">${Object.entries(R.vrij).sort().map(([h, n]) => 'hal ' + h + ' ' + nf(n)).join(' · ')}</div></div></div></div>
  <div class="card"><h3>Komende containers</h3><div class="scroll mt8"><table><tr><th>Losdag</th><th>Container</th><th class="n">Pallets hier</th><th class="n">Plaatsen</th><th></th></tr>
    ${R.conts.map(x => `<tr><td>${esc(fdate(x.c.losdatum))}</td><td><b>${esc(cNaam(x.c))}</b><div class="desc">${esc(x.c.containernummer || '')}</div></td><td class="n">${nf(x.pal)}</td><td class="n">${nf(x.pl)}</td><td class="small">${x.schat ? B.badge('nog geen verdeling: alle pallets geteld', 'b-warn') : B.badge('verdeling', 'b-ok')}</td></tr>`).join('')}</table></div></div>
  <div class="card"><h3>To-do</h3>
    ${todo('rm:vst', 'Naar VST: bulkpallets van producten met veel voorraad (' + R.naarVst.length + ')', 'Meer dan 4 maanden voorraad hier en geen orders. Houd 1,5 maand hier, rest via Stockmove naar VST (Karin). Eerst de producten bovenaan: meeste pallets.',
      R.naarVst.length ? `<div class="scroll mt8"><table><tr><th>Product</th><th class="n">Maanden</th><th class="n">Bulk</th><th class="n">Naar VST</th><th>Bulkplekken</th></tr>${R.naarVst.slice(0, 30).map(x => `<tr><td><a class="code" href="#/p/${encodeURIComponent(x.code)}">${esc(x.code)}</a><div class="desc">${esc(WHL.naamVan(x.code))}</div></td><td class="n">${nf(x.mnd, 1)}</td><td class="n">${x.bulks.length}</td><td class="n"><b>${x.weg}</b>${x.spp ? '' : '<div class="desc">stuks/pallet?</div>'}</td><td>${V().locs(x.bulks.slice(0, 4))}</td></tr>`).join('')}</table></div>` : '')}
    ${R.leegGek.length ? todo('rm:leeg', 'Bulk gekoppeld maar zonder voorraad (' + R.leegGek.length + ')', 'Picqer denkt dat er iets staat, de voorraad zegt 0. Kijk en ontkoppel of verplaats.', `<div class="small mt4">${R.leegGek.slice(0, 80).map(l => `<span class="loc">${esc(l)}</span>`).join(', ')}</div>`) : ''}
    ${todo('rm:ba', 'BA-dubbelingen leegmaken (' + R.aand.dubbel.length + ')', 'Producten van BA..-06 naar BA..06, daarna -06 archiveren.', `<div class="small mt4">${R.aand.dubbel.map(l => `<span class="loc">${esc(l)}</span>`).join(', ')}</div>`)}
    ${todo('rm:rommel', 'Losse namen en mappen met producten (' + (R.aand.rommel.length + R.aand.opMap.length) + ')', 'Naar een echte locatie.', `<div class="small mt4">${R.aand.rommel.concat(R.aand.opMap).map(l => `<span class="loc">${esc(l)}</span>`).join(', ')}</div>`)}
    ${R.conts.some(x => x.schat) ? todo('rm:verd', 'Verdeling vastleggen voor ' + R.conts.filter(x => x.schat).map(x => cNaam(x.c)).join(', '), 'Dan weet de app precies hoeveel plaatsen er nodig zijn.', '<a class="small" href="./containerplanning.html">Containers →</a>') : ''}
  </div>`;
}
function todo(k, titel, uitleg, body){
  const vd = vandaag(); const key = k + ':' + vd;
  return `<div class="task ${tik(key) ? 'klaar' : ''}">${V().tikKnop(key)}<div class="grow"><div class="tt">${esc(titel)}</div><div class="td">${esc(uitleg)}</div>${body || ''}</div></div>`;
}

/* =====================================================================
   INVULLEN (telefoon): product voor product alles wat mist
   ===================================================================== */
const BRONNEN = {
  nu:['Nu verplaatsen', 'producten die orders tegenhouden'],
  ronde:['Aanvulronde', 'rest van het aanvuladvies, per gang'],
  cont:['Containers van de dag', 'producten uit de containers'],
  geen:['Geen locatie', 'voorraad op geen specifieke locatie, lopers eerst'],
  voorstel:['Aanvulbase', 'voorstellen, meest verkocht eerst']
};
function invulLijst(bron){
  const C = WHL.bereken();
  const vd = vandaag();
  if(bron === 'nu') return C.mv.map(m => ({ code:m.code, taak:'mv:' + vd + ':' + m.code, van:m.van, naar:m.naar || (m.voorstelPick ? [m.voorstelPick] : []), aantal:m.verpl, info:plural(m.orders.length, 'order', 'orders') + ' wachten (' + nf(m.stuks) + ' voor orders)' }));
  if(bron === 'ronde') return C.ronde.map(r => ({ code:r.code, taak:'rd:' + vd + ':' + r.code, van:r.bulk || [], naar:r.pick || [], aantal:r.aantal, info:'advies ' + nf(r.aantal) + ' · pickvoorraad ' + nf(r.pickst) }));
  if(bron === 'cont'){ const P = dagPlan(kiesDag()); return [...new Set([].concat(P.up, P.pick, P.bo).map(x => x.code))].map(code => ({ code, info:'container' })); }
  if(bron === 'geen') return Object.entries(D.VR).filter(([c, v]) => v.geen > 0 && D.P[c]).map(([c, v]) => ({ code:c, info:nf(v.geen) + ' op geen specifieke locatie', vk:WHL.vkVan(c) || 0 })).sort((a, b) => b.vk - a.vk);
  return Object.values(C.prof).filter(p => p.status === 'voorstel' && p.picqerWijzigt).sort((a, b) => (b.vk || 0) - (a.vk || 0)).slice(0, 300).map(p => ({ code:p.code }));
}
function viewInvul(bron){
  const B = V();
  if(!bron || !BRONNEN[bron]){
    const vd = vandaag();
    app.innerHTML = `<div class="card"><h2>Invullen</h2><div class="small muted">Op de telefoon, tijdens het werk: één product per scherm. Wat je invult is meteen de waarheid voor de app (aanvulbase, picklocatie, stuks per pallet) en gaat mee in de Picqer-import.</div></div>
      ${Object.entries(BRONNEN).map(([k, [t, u]]) => { const n = invulLijst(k).length; const open = invulLijst(k).filter(x => !x.taak || !tik(x.taak)).length; return `<a class="card" style="display:block;text-decoration:none;color:inherit" href="#/invul/${k}"><div class="row between"><h3>${esc(t)}</h3><span class="badge ${open ? 'b-warn' : 'b-ok'}">${nf(open)} / ${nf(n)}</span></div><div class="small muted">${esc(u)}</div></a>`; }).join('')}`;
    return;
  }
  if(UI.invul.bron !== bron){ UI.invul = { bron, i:0 }; }
  const lijst = invulLijst(bron);
  if(!lijst.length){ app.innerHTML = `<a class="small" href="#/invul">← Invullen</a><div class="card empty mt8">Niets in deze lijst.</div>`; return; }
  // eerste open item als startpunt
  if(UI.invul.i >= lijst.length) UI.invul.i = lijst.length - 1;
  const it = lijst[UI.invul.i];
  const code = it.code;
  const pr = WHL.prof(code);
  const P = D.P[code] || {};
  const f = pr ? pr.final : {};
  const e = D.AANVUL[code] || {};
  const t = it.taak ? tv(it.taak) : null;
  const vr = D.VR[code];
  const mv = WH.maandVerkoop(code).slice(-12);
  const bo = boVan(code);
  const a = pr ? WHL.bereken().adv[code] : null;
  const spp = WHL.sppVan(code);
  const nOpen = lijst.filter(x => !x.taak || !tik(x.taak)).length;
  const typeNaam = B.typeNaam;
  app.innerHTML = `<div class="row between"><a class="small" href="#/invul">← ${esc(BRONNEN[bron][0])}</a><span class="small muted">${UI.invul.i + 1} / ${lijst.length} · ${nOpen} open</span></div>
  <div class="card mt8" style="${t ? 'border-left:5px solid var(--ok)' : ''}">
    <div class="row wrap between"><div><span class="code" style="font-size:18px">${esc(code)}</span>${t ? ' ' + B.badge('gedaan', 'b-ok') : ''}<div>${esc(P.naam || '')}</div><div class="small muted">${esc(P.leverancier || '')}${P.abc ? ' · ABC ' + esc(P.abc) : ''}</div></div>
      ${pr ? B.badge(typeNaam[f.type] || f.type || '', B.typeCls[f.type]) : ''}</div>
    ${it.info ? `<div class="reason">${esc(it.info)}${it.van && it.van.length ? ' · van ' + esc(it.van.join(', ')) : ''}${it.naar && it.naar.length ? ' → ' + esc(it.naar.join(', ')) : ''}</div>` : ''}
    <div class="kv mt8">
      <span>Voorraad</span><div>HM <b>${nf(num(P.voorraad_hm))}</b> (vrij ${nf(num(P.vrij_hm))}) · VST <b>${nf(num(P.voorraad_vst))}</b>${bo.orders ? ' · ' + B.badge(plural(bo.orders, 'order', 'orders') + ' wacht', 'b-bad') : ''}</div>
      <span>Per locatie</span><div>${vr ? Object.entries(vr.locs).filter(([, q]) => q).map(([l, q]) => V().locBadge(l) + ' ' + nf(q)).join(' ') + (vr.geen ? ' ' + B.badge('geen locatie ' + nf(vr.geen), 'b-warn') : '') : (V().locs(WHL.locsVan(code)) || '<span class="muted">geen locatie</span>') + ' <span class="tiny muted">(aantallen na export voorraad per locatie)</span>'}</div>
      ${a ? `<span>Advies</span><div>${nf(a.aantal)} van ${esc((a.bulk || []).join(', '))} → ${a.geenPick ? 'geen picklocatie' : esc((a.pick || []).join(', '))} · pickvoorraad ${nf(a.pickst)}</div>` : ''}
      <span>Verkoop</span><div>${pr && pr.vk !== null ? '<b>' + nf(pr.vk, 1) + '</b>/mnd' : 'onbekend'}${mv.length ? `<div class="tiny muted mt4">${mv.map(([m, q]) => `<span style="display:inline-block;margin-right:6px">${esc(m.slice(2).replace('-', '/'))} <b>${nf(q)}</b></span>`).join('')}</div>` : ''}</div>
      <span>Picqer nu</span><div>aanvullen onder ${esc(pr ? pr.pq.lvl ?? '–' : '–')}, vul aan tot ${esc(pr ? pr.pq.tot ?? '–' : '–')}</div>
    </div>
    ${pr && pr.redenen.length ? `<div class="small mt8">${pr.redenen.map(r => B.badge(r.t, r.lvl === 'let' ? 'b-warn' : 'b-grey')).join(' ')}</div>` : ''}
  </div>
  <div class="card" id="ivf">
    ${it.taak ? `<h3>Gedaan</h3><div class="fields mt8">
      <div class="fld"><label>Verplaatst (stuks)</label><input class="num" id="iv-aantal" inputmode="numeric" value="${esc(t && t.aantal !== undefined ? t.aantal : it.aantal ?? '')}"></div>
      <div class="fld"><label>Van</label><input class="loc" id="iv-van" value="${esc(t && t.van || (it.van || [])[0] || '')}"></div>
      <div class="fld"><label>Naar</label><input class="loc" id="iv-naar" value="${esc(t && t.naar || (it.naar || [])[0] || f.pick || '')}" placeholder="geen = leeg"></div></div>` : ''}
    <h3 class="${it.taak ? 'mt12' : ''}">Instellingen</h3>
    <div class="fields mt8">
      <div class="fld"><label>Picklocatie</label><input class="loc ${e.pick === undefined ? 'voor' : ''}" id="iv-pick" value="${esc(f.pick || '')}" placeholder="geen"></div>
      <div class="fld"><label>Soort</label><select id="iv-type" class="${e.type === undefined ? 'voor' : ''}">${['vloer', 'legbord', 'speciaal', 'bulk'].map(x => `<option value="${x}" ${f.type === x ? 'selected' : ''}>${esc(typeNaam[x])}</option>`).join('')}</select></div>
      <div class="fld"><label>Aanvullen onder</label><input class="num ${e.lvl === undefined ? 'voor' : ''}" id="iv-lvl" inputmode="numeric" value="${esc(f.lvl ?? '')}"></div>
      <div class="fld"><label>Vul aan tot</label><input class="num ${e.tot === undefined ? 'voor' : ''}" id="iv-tot" inputmode="numeric" value="${esc(f.tot ?? '')}"></div>
      <div class="fld"><label>Max op pick</label><input class="num" id="iv-max" inputmode="numeric" value="${esc(e.max ?? '')}" placeholder="?"></div>
      <div class="fld"><label>Stuks per pallet</label><input class="num ${spp ? '' : 'voor'}" id="iv-spp" inputmode="numeric" value="${esc(spp ?? '')}" placeholder="?"></div>
    </div>
    <div class="fld mt8"><label>Notitie</label><input id="iv-noot" value="${esc(e.noot || '')}" placeholder="bv. past maar half, doos van 10"></div>
    <div class="small muted mt8">Geel = voorstel van de app. Opslaan = bevestigd (gaat mee in de Picqer-import bij Aanvulbase).</div>
    <div class="row wrap mt12"><button class="btn ok" data-d="iv-op" style="flex:1;padding:12px">Opslaan → volgende</button></div>
    <div class="row wrap mt8"><button class="btn" data-d="iv-terug" ${UI.invul.i ? '' : 'disabled'}>← vorige</button><button class="btn" data-d="iv-over">Overslaan →</button><a class="btn ghost" href="#/p/${encodeURIComponent(code)}">productkaart</a></div>
  </div>`;
}
async function invulOpslaan(){
  const lijst = invulLijst(UI.invul.bron);
  const it = lijst[UI.invul.i]; if(!it) return;
  const code = it.code;
  const v = id => { const el = $(id); return el ? el.value.trim() : ''; };
  const n = id => v(id) === '' ? null : num(v(id));
  const knop = document.querySelector('[data-d="iv-op"]'); if(knop){ knop.disabled = true; knop.textContent = 'Opslaan…'; }
  try{
    const type = v('iv-type');
    const rec = { pick:v('iv-pick').toUpperCase() || null, lvl:n('iv-lvl'), tot:n('iv-tot'), type, ok:true, op:new Date().toISOString() };
    if(type === 'bulk'){ rec.lvl = null; rec.tot = null; }
    const max = n('iv-max'); if(max) rec.max = max;
    const noot = v('iv-noot'); if(noot) rec.noot = noot;
    await WH.catPatch('wh-aanvul', { [code]:rec });
    if(it.taak){
      const t = { op:new Date().toISOString(), aantal:n('iv-aantal'), van:v('iv-van').toUpperCase() || null, naar:v('iv-naar').toUpperCase() || null };
      await zetTaak(it.taak, t);
    }
    const spp = n('iv-spp');
    if(spp && spp > 0 && spp !== WHL.sppVan(code)) await WH.zetStuksPerPallet(code, spp);
    WHL.reset();
    toast(code + ' opgeslagen');
    UI.invul.i = Math.min(UI.invul.i + 1, invulLijst(UI.invul.bron).length - 1);
    V().rerender(); window.scrollTo(0, 0);
  }catch(e){ toast('Opslaan mislukt: ' + e.message, 6000); if(knop){ knop.disabled = false; knop.textContent = 'Opslaan → volgende'; } }
}

/* =====================================================================
   VANDAAG: de dag in stappen
   ===================================================================== */
function viewVandaag(){
  const B = V();
  const vd = vandaag();
  const C = WHL.bereken();
  const dt = B.dataDatums();
  const mis = B.nietKlaar();
  const dagNaam = new Date().toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long' });
  const nOrders = new Set(C.mv.flatMap(m => m.orders)).size;
  const mvOpen = C.mv.filter(m => WHL.mvStaat(m.code, vd) !== 'klaar').length;
  const rondeOpen = C.ronde.filter(r => !tik('rd:' + vd + ':' + r.code)).length;
  B.kpiVastleggen(vd, { mv:C.mv.length, orders:nOrders, vst:C.vst.length, vstOrders:C.vstOrders.length, ronde:C.ronde.length, vast:C.vast.length, bo:new Set(D.BO.map(r => r.bestelling)).size, bev:Object.values(C.prof).filter(p => p.status === 'bevestigd').length });
  const leeft = Object.assign({}, dt, { 'voorraad/locatie':D.VRDATUM });

  // blok containers
  const cdag = kiesDag();
  const P = dagPlan(cdag, cdag >= vd);
  let blokC = '';
  if(P.cs.length){
    const vb = P.cs.every(c => CHECK.every(([k]) => tik('cc:' + c.id + ':' + k) || ((k === 'stockmove' || k === 'vstlabels') && !P.vst.some(v => v.cid === c.id))));
    const nGepl = P.up.filter(p => tv(p.key) && tv(p.key).loc).length;
    const st = [
      ['Voor het lossen: opgeboekt, labels, werkbon, Stockmove, VST-stickers', vb],
      ['Apart zetten voor orders: ' + plural(P.bo.reduce((s, x) => s + (x.pal ? x.n : 0), 0), 'pallet', 'pallets'), P.bo.length && P.bo.every(x => tik(x.key))],
      ['Naar bulk: ' + nGepl + '/' + P.up.length + ' pallets geplaatst', P.up.length && nGepl === P.up.length],
      ['Naar picklocatie: ' + P.pick.length + ' regels', P.pick.length && P.pick.every(x => tik(x.key))],
      ['Naar VST: ' + plural(P.vst.reduce((s, x) => s + (x.pal ? x.n : 0), 0), 'pallet', 'pallets'), P.vst.length && P.vst.every(x => tik(x.key))],
      ['Klaar → controle met verse exports', tik('cc:dag:' + cdag + ':controle')]
    ];
    blokC = `<div class="card" style="border-left:5px solid var(--orange)"><div class="row wrap between"><div><h3>1 · Containers ${esc(cdag === vd ? 'vandaag' : kort(cdag))}</h3>
      <div class="small muted">${P.cs.map(c => `<b>${esc(cNaam(c))}</b> ${esc(c.containernummer || '')}`).join(' · ')}</div></div><a class="btn pri" href="#/containerdag/${cdag}">Open containerdag</a></div>
      <div class="mt8">${st.map(([t, ok], i) => `<div class="task ${ok ? 'klaar' : ''}"><div class="chk" style="cursor:default;color:var(--muted);font-size:13px">${ok ? '✓' : i + 1}</div><div class="grow"><div class="tt">${esc(t)}</div></div></div>`).join('')}</div>
      <div class="row wrap mt8"><a class="btn sm" href="#/controle/${cdag}">Controle</a><a class="btn sm" href="#/invul/cont">Invullen: container-producten</a></div></div>`;
  }

  // blok aanvullen
  const d = boDiff();
  const boVandaag = dt.backorders && isoDag(dt.backorders) === vd;
  const stA = [
    { t:'Nu verplaatsen: ' + plural(mvOpen, 'product', 'producten') + ' open, maakt ' + plural(nOrders, 'order', 'orders') + ' vrij', ok:C.mv.length && !mvOpen, links:[['#/aanvullen/nu', 'lijst'], ['#/invul/nu', 'invullen op telefoon']] },
    { t:'In Picqer: Backorders → Verwerk backorders', k:'dg:' + vd + ':verwerk' },
    { t:'Nieuwe backorder-export inladen', ok:!!(tv('dg:' + vd + ':verwerk') && dt.backorders && new Date(dt.backorders) > new Date(tv('dg:' + vd + ':verwerk').op)), extra:d ? `<div class="td">Vorige ${esc(fdt(d.van))} → nu: <b>${nf(d.opgelost.length)}</b> opgelost · <b>${nf(d.open.length)}</b> nog open · <b>${nf(d.nieuw.length)}</b> nieuw. <a href="#/backorders">details</a></div>` : '', drop:true },
    { t:'Aanvulronde per gang: ' + plural(rondeOpen, 'regel', 'regels') + ' open', ok:C.ronde.length && !rondeOpen, links:[['#/aanvullen/ronde', 'lijst'], ['#/invul/ronde', 'invullen op telefoon']] },
    { t:'Van VST halen: ' + plural(C.vst.length, 'product', 'producten') + ' (' + plural(C.vstOrders.length, 'order', 'orders') + ')', k:'dg:' + vd + ':vst', links:[['#/aanvullen/vst', 'mail']] },
    { t:'Ruimte maken voor de komende containers', k:'dg:' + vd + ':ruimte', links:[['#/ruimte', 'to-do']] }
  ];
  const blokA = `<div class="card" style="border-left:5px solid var(--blue)"><h3>${P.cs.length ? '2' : '1'} · Aanvullen</h3>
    <div class="mt8">${stA.map((s, i) => {
      const ok = s.k ? tik(s.k) : !!s.ok;
      return `<div class="task ${ok ? 'klaar' : ''}">${s.k ? B.tikKnop(s.k) : `<div class="chk" style="cursor:default;color:var(--muted);font-size:13px">${ok ? '✓' : i + 1}</div>`}<div class="grow"><div class="tt">${esc(s.t)}</div>${s.extra || ''}
        ${s.links ? `<div class="td">${s.links.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join(' · ')}</div>` : ''}
        ${s.drop ? `<label class="drop mt4" id="bdrop" style="padding:10px;display:block"><input type="file" id="bfiles" multiple accept=".xlsx,.xls,.csv,.pdf" hidden><span class="small"><b>Backorders (en aanvuladvies) hier</b> · backorders van ${esc(fdt(dt.backorders))}</span></label><div id="bst" class="status"></div>` : ''}</div></div>`;
    }).join('')}</div></div>`;

  // blok invullen
  const nVoorstel = Object.values(C.prof).filter(p => p.status === 'voorstel' && p.picqerWijzigt).length;
  const nGeen = Object.values(D.VR).filter(v => v.geen > 0).length;
  const blokI = `<div class="card" style="border-left:5px solid var(--ok)"><h3>${P.cs.length ? '3' : '2'} · Invullen op de telefoon</h3>
    <div class="small muted mt4">Bij elke stap meteen de gegevens: picklocatie, aanvullen onder / vul aan tot, max op pick, stuks per pallet. Eén product per scherm.</div>
    <div class="row wrap mt8"><a class="btn pri" href="#/invul/nu">Nu verplaatsen (${nf(C.mv.length)})</a><a class="btn" href="#/invul/ronde">Aanvulronde (${nf(C.ronde.length)})</a>${D.VRDATUM ? `<a class="btn" href="#/invul/geen">Geen locatie (${nf(nGeen)})</a>` : ''}<a class="btn" href="#/invul/voorstel">Aanvulbase (${nf(nVoorstel)})</a></div></div>`;

  const taken = WHP.TAKEN.filter(t => t.datum <= vd && !tik('t:' + t.id)).sort((a, b) => a.prio - b.prio || a.datum.localeCompare(b.datum));
  app.innerHTML = `<div class="card"><div class="row wrap between"><div><h2 style="font-size:19px;text-transform:capitalize">${esc(dagNaam)}</h2><div class="small muted">Week ${WHP.weekNr(vd)} · IVOL Warehouse</div></div>
      <div class="small">${Object.entries(leeft).map(([k, v]) => `<span style="white-space:nowrap;margin-left:8px">${esc(k)} ${B.exportLeeftijd(v)}</span>`).join(' ')}</div></div>
      ${mis.length ? `<div class="reason mt8"><b>Nog inladen:</b> ${esc(mis.join(', '))}. <a href="#/gegevens">Naar Gegevens →</a></div>` : ''}</div>
    ${blokC}${blokA}${blokI}
    <details class="card"><summary>Taken uit de planning (${taken.length})</summary>${taken.map(t => B.taakHtml(t, vd)).join('') || '<div class="empty">Niets open.</div>'}<div class="mt8"><a class="small" href="#/planning">Hele planning →</a></div></details>`;
  koppelDrop('bdrop', 'bfiles', 'bst', () => viewVandaag());
}

/* ---------- acties ---------- */
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-d]'); if(!b) return;
  const a = b.dataset.d;
  if(a === 'plaats'){
    const k = b.dataset.k;
    const inp = document.querySelector(`[data-loc="${CSS.escape(k)}"]`);
    const loc = inp ? inp.value.trim().toUpperCase() : '';
    if(!loc){ toast('Vul de locatie in'); return; }
    if(!D.LOC[loc] && Object.keys(D.LOC).length && !confirm(loc + ' staat niet in de locatie-export. Toch opslaan?')) return;
    b.disabled = true;
    await zetTaak(k, { loc, op:new Date().toISOString() });
    V().rerender(); return;
  }
  if(a === 'plaats-weg'){ await zetTaak(b.dataset.k, null); V().rerender(); return; }
  if(a === 'zone-op' || a === 'zone-alle'){
    const P = dagPlan(kiesDag());
    const lijst = a === 'zone-alle'
      ? Object.values(P.zoneInfo).map(o => [o, ($('zone-alle') || {}).value || ''])
      : [[P.zoneInfo[b.dataset.k], (document.querySelector(`[data-zone="${CSS.escape(b.dataset.k)}"]`) || {}).value || '']];
    const patch = {};
    for(const [o, tekst] of lijst){
      if(!o) continue;
      const z = tekst.trim().toUpperCase();
      const pz = parseZone(z);
      if(z && pz.delen.length && !pz.fout.length && Object.keys(D.LOC).length && !zoneLiggers(ligBouw(), { delen:pz.delen }).length){ toast('Geen liggers gevonden voor ' + z + ' (staan ze in de locatie-export?)'); return; }
      if(z && (!pz.delen.length || pz.fout.length)){ toast('Niet begrepen: ' + (pz.fout.join(', ') || z) + '. Voorbeeld: CC07/10, CC07/20 of CC 07-09'); return; }
      patch['cz:' + o.cid + ':' + o.code] = z ? { zone:z, op:new Date().toISOString() } : null;   // leeg = de app kiest opnieuw
      patch['czv:' + o.cid + ':' + o.code] = null;
      if(!z) patch['czx:' + o.cid + ':' + o.code] = null;
      o.keys.forEach(k => { const t = tv(k); if(!(t && t.loc)) patch['cvs:' + k] = null; });   // niet-geplaatste voorstellen opnieuw laten indelen
    }
    Object.entries(patch).forEach(([k, v]) => { if(v === null) delete D.TAKEN[k]; else D.TAKEN[k] = v; });
    b.disabled = true;
    try{ await WH.catPatch('wh-taken', patch); }catch(e){ /* melding al getoond */ }
    V().rerender(); return;
  }
  if(a === 'zone-vrij'){
    const [cid, ...rest] = b.dataset.k.split('|'); const code = rest.join('|');
    const k = 'czv:' + cid + ':' + code;
    const P = dagPlan(kiesDag()); const o = P.zoneInfo[b.dataset.k];
    const patch = { [k]:D.TAKEN[k] ? null : { op:new Date().toISOString() } };
    if(o) o.keys.forEach(x => { const t = tv(x); if(!(t && t.loc)) patch['cvs:' + x] = null; });
    Object.entries(patch).forEach(([x, v]) => { if(v === null) delete D.TAKEN[x]; else D.TAKEN[x] = v; });
    try{ await WH.catPatch('wh-taken', patch); }catch(e){}
    V().rerender(); return;
  }
  if(a === 'lig-leeg' || a === 'lig-alle'){
    const cid = b.dataset.cid, P = dagPlan(kiesDag());
    const patch = {};
    const wis = (lk) => P.up.forEach(p => {            // pallets die nog niet geplaatst zijn in deze ligger: voorstel laten vervallen
      if(String(p.cid) !== String(cid)) return;
      const t = tv(p.key); if(t && t.loc) return;
      const vs = tv('cvs:' + p.key); if(!(vs && vs.loc)) return;
      const i = WHL.locInfo(vs.loc);
      if(i.gang + dd(i.sec) + '|' + i.h === lk) patch['cvs:' + p.key] = null;
    });
    if(a === 'lig-alle'){
      const ks = new Set();
      Object.values(P.zoneInfo).forEach(o => { if(String(o.cid) === String(cid) && o.zone) o.liggers.forEach(g => ks.add(g.k)); });
      ks.forEach(k => { if(!D.TAKEN['czl:' + cid + ':' + k]) patch['czl:' + cid + ':' + k] = { op:new Date().toISOString() }; });
    } else {
      const key = 'czl:' + cid + ':' + b.dataset.lk;
      if(D.TAKEN[key]){ patch[key] = null; wis(b.dataset.lk); }
      else patch[key] = { op:new Date().toISOString() };
    }
    Object.entries(patch).forEach(([k, v]) => { if(v === null) delete D.TAKEN[k]; else D.TAKEN[k] = v; });
    try{ await WH.catPatch('wh-taken', patch); }catch(e){ /* melding al getoond */ }
    V().rerender(); return;
  }
  if(a === 'lig-ander'){
    const [cid, ...r] = b.dataset.k.split('|'), code = r.join('|');
    const P = dagPlan(kiesDag()); const o = P.zoneInfo[b.dataset.k]; if(!o || !o.zone) return;
    const eerder = (tv('czx:' + cid + ':' + code) || {}).ex || [];
    const ex = o.teKlein ? [] : eerder.concat(o.liggers.map(g => g.k));   // te klein? dan opnieuw zonder uitsluitingen
    const patch = { ['czx:' + cid + ':' + code]:ex.length ? { ex } : null, ['cz:' + cid + ':' + code]:null, ['czv:' + cid + ':' + code]:null };
    o.keys.forEach(k => { const t = tv(k); if(!(t && t.loc)) patch['cvs:' + k] = null; });
    Object.entries(patch).forEach(([k, v]) => { if(v === null) delete D.TAKEN[k]; else D.TAKEN[k] = v; });
    try{ await WH.catPatch('wh-taken', patch); }catch(e){ /* melding al getoond */ }
    V().rerender(); return;
  }
  if(a === 'lig-koppel'){
    const r = koppelRijen(dagPlan(kiesDag()));
    if(!r.length){ toast('Nog niets te koppelen: bevestig eerst dat een ligger leeg is'); return; }
    WH.excel(['Productcode', 'Voorraadlocatie Hoofdmagazijn'], r.map(x => x.rij), 'Picqer import bulkplekken koppelen ' + kiesDag() + ' (' + r.length + ').xlsx');
    return;
  }
  if(a === 'print-vrij'){ document.body.classList.add('printvrij'); if(window.Bestanden){ const dm = (location.hash.match(/\d{4}-\d{2}-\d{2}/) || [])[0]; Bestanden.printAls('Vrijmaaklijst containerdag' + (dm ? ' ' + dm : '') + ' - afgedrukt ' + vandaag()); } window.print(); setTimeout(() => document.body.classList.remove('printvrij'), 500); return; }
  if(a === 'iv-op'){ await invulOpslaan(); return; }
  if(a === 'iv-over'){ UI.invul.i++; V().rerender(); window.scrollTo(0, 0); return; }
  if(a === 'iv-terug'){ UI.invul.i = Math.max(0, UI.invul.i - 1); V().rerender(); window.scrollTo(0, 0); return; }
  if(a === 'vst-xlsx'){
    const P = dagPlan(b.dataset.dag);
    const rijen = [];
    P.vst.forEach(x => { const nieuw = vstNieuw(x.code); const q = Object.fromEntries(D.VSTVR[x.code] || []); nieuw.forEach(p => rijen.push([p, x.code, WHL.naamVan(x.code), q[p] ?? '', cNaam(x.c)])); });
    WH.excel(['Palletnummer', 'Productcode', 'Naam', 'Aantal', 'Container'], rijen, 'VST palletnummers ' + b.dataset.dag + '.xlsx');
    return;
  }
});
document.addEventListener('keydown', ev => {
  if(ev.key !== 'Enter') return;
  const inp = ev.target.closest && ev.target.closest('[data-loc]');
  if(inp){ ev.preventDefault(); const k = inp.dataset.loc; const btn = document.querySelector(`[data-d="plaats"][data-k="${CSS.escape(k)}"]`); if(btn) btn.click(); }
});

return { viewVandaag, viewContainerdag, viewControle, viewBackorders, viewRuimte, viewInvul, dagPlan, plan, bulkVoorstellen, ruimte, boDiff, kiesDag, invulLijst, parseZone, vrijmaakLijst, koppelRijen, ligVoorstel };
})();
