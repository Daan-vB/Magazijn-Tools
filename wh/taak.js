/* =====================================================================
   IVOL Warehouse 3.0 — Te doen is de werkplek (15-10-2026)
   Te doen: Nu (de bouwplanstap van nu) · Vandaag (alleen operationeel) · Later (hoort bij een latere stap).
   Takenpagina #/taak/<stap>: opdracht, wat nog moet (live uit de gegevens), klaar als, vastleggen, notitie,
   op wacht / afronden, opdracht voor Claude. Elke knop opent het scherm in 3.0 en 3.0 onthoudt de taak
   (sessionStorage ivol-taak): een smalle balk brengt Daan terug.
   Productdata (wh/productdata.js) wordt pas geladen als een taak hem nodig heeft.
   ===================================================================== */
window.WHTAAK = (function(){
'use strict';
const { $, esc, nf, D } = WH;
const BP = window.WHBP, R = window.WHBP_ROUTE;
const IV = () => window.IVOL;
const SS = 'ivol-taak';
const ssHaal = () => { try{ return sessionStorage.getItem(SS); }catch(e){ return null; } };
const ssZet = v => { try{ if(v) sessionStorage.setItem(SS, v); else sessionStorage.removeItem(SS); }catch(e){} };
const eersteZin = t => { const m = String(t || '').match(/^.*?[.!?](\s|$)/); return (m ? m[0] : String(t || '')).trim(); };
const knop = (stap, href, t, pri) => `<a class="knop${pri ? ' pri' : ''}" href="${esc(href)}" data-taak="${esc(stap)}">${esc(t)} →</a>`;
const ext = (href, t) => `<a class="knop" href="${esc(href)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`;

/* ---------- productdata in 3.0: pas laden als een taak hem nodig heeft ---------- */
const PD = { p:null, fout:null, cache:null, sinds:0, pd2fout:null };
const pdKlaar = () => !!(window.WHPD && WHPD.S && WHPD.S.klaar && !WHPD.S.fout);
function pdLaden(){
  if(pdKlaar()) return Promise.resolve(true);
  if(!PD.p) PD.p = (async () => {
    PD.sinds = Date.now();
    try{
      // eerst de gedeelde gegevens (WH.load in 3.0); IVOL bestaat pas als ivol.js klaar is met opstarten
      while(!IV()) await new Promise(r => setTimeout(r, 50));
      await IV().geladen();
      // zelfde manier als de lader in ivol.html: altijd de nieuwste versie (Per familie na Productdata)
      const laadJs = f => fetch(f, { cache:'no-cache' }).then(r => { if(!r.ok) throw new Error('status ' + r.status); return r.text(); })
        .then(t => { const s = document.createElement('script'); s.textContent = t + '\n//# sourceURL=' + f; document.body.appendChild(s); })
        .catch(() => new Promise((ok, nee) => { const s = document.createElement('script'); s.src = f; s.onload = ok; s.onerror = () => nee(new Error(f + ' laden lukte niet')); document.body.appendChild(s); }));
      if(!window.WHPD) await laadJs('wh/productdata.js');
      if(!window.WHPDF) await laadJs('wh/pdfamilie.js').catch(e => console.error(e));
      if(!window.WHPD) throw new Error('Productdata niet beschikbaar');
      await WHPD.laad();
      if(window.PD2R && PD2R.laad && !(PD2R.S && PD2R.S.klaar)){ herteken(); await PD2R.laad().catch(e => { PD.pd2fout = e; console.error(e); }); }   // Productdata 2.0 is de telling
      await laadLater();
      WHPD.zetLaterMee(false);   // Later en Op maat tellen nooit mee in de poort (08-11)
      WHPD.S.idx = null;   // index opnieuw op de volledig geladen gegevens
      if(WHPD.S.fout) throw WHPD.S.fout;
      PD.fout = null; PD.cache = null;
    }catch(e){ PD.fout = e; console.error(e); }
    PD.p = null;
    herteken();
    return pdKlaar();
  })();
  return PD.p;
}

/* ---------- Later (08-11): bewaard in catalog-rij wh-doorloop-later, telt niet mee, staat apart bovenaan Te doen ----------
   Per product en vraag: { op:<ISO>, opm:<opmerking> }. Elke schrijfactie maakt eerst een kopie (wh-doorloop-later-kopie-<datum>) en voegt samen
   met de nieuwste versie in de database, zodat een ander apparaat niets overschrijft. */
const LKEY = 'wh-doorloop-later';
const LATER = { klaar:false, items:{}, p:null, q:Promise.resolve() };
const lk = (c, t) => c + '|' + t;
function laadLater(vers){
  if(LATER.p && !vers) return LATER.p;
  LATER.p = WH.catHaal(LKEY).then(r => { LATER.items = (r && r.data && r.data.items) || {}; LATER.klaar = true; }).catch(e => { console.error(e); LATER.klaar = true; });
  return LATER.p;
}
// wijz: [{ c, t, opm }] zet op Later (de oorspronkelijke datum blijft), [{ c, t, weg:true }] haalt eraf
function zetLater(wijz){
  const pas = (items, nu) => wijz.forEach(w => { const k = lk(w.c, w.t); if(w.weg) delete items[k]; else items[k] = { op:(items[k] && items[k].op) || nu, opm:String(w.opm !== undefined ? w.opm : (items[k] && items[k].opm) || '') }; });
  const nu = new Date().toISOString(); pas(LATER.items, nu);
  LATER.q = LATER.q.catch(() => {}).then(async () => {
    const r = await WH.catHaal(LKEY).catch(() => null), remote = (r && r.data && r.data.items) || {};
    if(r && r.data) await WH.catZet(LKEY + '-kopie-' + WH.isoDag(), r.data);   // kopie vóór schrijven
    pas(remote, nu); await WH.catZet(LKEY, { items:remote, op:nu });
    LATER.items = Object.assign({}, remote);
  }).catch(e => { console.error(e); WH.toast('Later bewaren lukte niet: ' + (e.message || e), 6000); });
  return LATER.q;
}
const isLater = (c, t) => !!LATER.items[lk(c, t)];
const STAPKEYS = { soort:k => k === 'soort' || k === 'weg', gewicht:k => k === 'gewicht', hoev:k => !['soort', 'weg', 'gewicht'].includes(k) };
const laterT = k => k === 'weg' ? 'soort' : k;
// de open sleutels van een product voor een stap, zonder wat op Later staat; '' = alle drie de stappen
function openZL(c, stap){
  try{
    const s = PD2R.status(c); if(s.kop) return [];
    const stappen = stap ? [stap] : ['soort', 'gewicht', 'hoev'];
    return stappen.flatMap(p => s.stap[p] ? [] : s.open.filter(STAPKEYS[p]).filter(k => !isLater(c, laterT(k))));
  }catch(e){ return []; }
}
// telling per stap zonder Later: een stap is klaar als alles behalve Later is ingevuld
function telStapZL(codes, stap){
  let vol = 0, velden = 0;
  codes.forEach(c => {
    let s; try{ s = PD2R.status(c); }catch(e){ s = null; }
    if(!s || s.kop || s.stap[stap]){ vol++; return; }
    const ks = s.open.filter(STAPKEYS[stap]);
    if(!ks.length){ velden += 1; return; }
    const open = ks.filter(k => !isLater(c, laterT(k))).length;
    if(!open) vol++; else velden += open;
  });
  return { vol, tot:codes.length, velden };
}
function wachtOpZL(codes){
  const W = PD2R.wachtOp(codes), uit = {};
  ['soort', 'gewicht', 'hoev'].forEach(k => { const rest = c => openZL(c, k).length > 0, bew = W[k].bewezen.filter(b => rest(b.c)), vr = W[k].vraag.filter(rest); uit[k] = { open:bew.length + vr.length, bewezen:bew, vraag:vr }; });
  return uit;
}
// Later-items die nog echt open zijn (een antwoord in Productdata 2.0 haalt ze vanzelf van de lijst), oudste eerst
function laterOpen(){
  return Object.entries(LATER.items).map(([k, v]) => { const i = k.lastIndexOf('|'); return { c:k.slice(0, i), t:k.slice(i + 1), op:v.op, opm:v.opm || '' }; })
    .filter(x => WH.D.P[x.c] && pd2Klaar() && (() => { try{ const s = PD2R.status(x.c); if(s.kop) return false; if(x.t === 'soort') return !s.stap.soort; if(!s.stap.soort || s.so === 'weg') return false; return x.t === 'gewicht' ? !s.stap.gewicht : s.open.includes(x.t); }catch(e){ return false; } })())
    .sort((a, b) => String(a.op).localeCompare(String(b.op)));
}

/* ---------- 0.4: Poort 0.4 uit Productdata ----------
   Te doen toont bij stap 0.4 alleen de poort: de regels die nog rood zijn, elk met één knop (Daan 17-10).
   Het werk zelf (open velden per laag) staat in het scherm "Nog open" in Productdata. */
// live: de telling komt uit Productdata 2.0 (PD2R.status) en wordt opnieuw gemaakt zodra er iets is opgeslagen (S.ver) of nieuwe gegevens binnenkomen
const pd2Klaar = () => !!(window.PD2R && PD2R.S && PD2R.S.klaar);
function data04(){
  if(!pdKlaar()) return null;
  if(!pd2Klaar() && !PD.pd2fout) return null;   // wacht op Productdata 2.0; bij een mislukte lading valt de telling terug op de oude regels (voorlopig)
  if(!LATER.klaar) return null;
  const sleutel = (pd2Klaar() ? PD2R.S.ver + '|' + PD2R.S.dataVer : 'terugval') + '|' + Object.keys(LATER.items).length + '|' + Object.values(LATER.items).map(x => x.op).join(',').length;
  if(PD.cache && PD.cache.sleutel === sleutel && Date.now() - PD.cache.op < 120e3) return PD.cache.d;
  const P = WHPD.poort();
  const open = [];
  P.bel.forEach(c => { const v = pd2Klaar() ? openZL(c, '') : WHPD.openStappen(c); if(v.length) open.push({ c, v }); });
  // Soort · Gewicht · Hoeveelheid zonder Later (een stap is klaar als alles behalve Later is ingevuld)
  if(pd2Klaar()) PD2STAP.forEach((stap, n) => { const x = P.items[3 + n]; if(!x || !x.pd2) return; const v = telStapZL(P.bel, stap); x.ok = v.tot > 0 && v.vol === v.tot; x.u = nf(v.vol) + ' van ' + nf(v.tot) + ' compleet · ' + nf(v.velden) + ' velden open'; });
  if(window.WHCP){ const sp = WHCP.poortSteek(), x = P.items.find(y => y.steek); if(x){ x.ok = sp.groen; x.u = sp.n ? sp.gedaan + ' van ' + sp.n + ' gecontroleerd · ' + sp.fouten + ' fouten' : 'nog niet gemaakt: Te doen → Overzicht → Steekproef maken'; x.kan = true; x.a = '#/todo/overzicht'; } }
  if(pd2Klaar()){ P.groen = P.items.every(x => x.ok); if(P.groen && !P.code) try{ P.code = WHPD.poortCode(P.bel.length); }catch(e){} }
  const d = { P, open, voorlopig:!pd2Klaar() };
  PD.cache = { op:Date.now(), d, sleutel };
  return d;
}
const PD2STAP = ['soort', 'gewicht', 'hoev'];
const pdLink = c => '#/pd2/p/' + encodeURIComponent(c);
const vnLink = c => '#/vloernamen/?q=' + encodeURIComponent(c);
// eerste product met een dubbele waarde in palletlabels: aantal per pallet in Productdata 2.0, alleen de vloernaam in Vloernamen
function dubbelLink(){
  try{
    const open = (x, k) => WHPD.staat(x.code, k).s === 'open', d = WHPD.dubbel();
    const a = d.find(x => x.sppConflict && open(x, 'spp'));
    if(a) return pdLink(a.code);
    const v = d.find(x => x.vnConflict && open(x, 'vn'));
    if(v) return vnLink(v.code);
  }catch(e){}
  return '#/pd2/open';
}
BP.registreer('0.4', () => {
  const d = data04(); if(!d) return null;
  const it = d.P.items, ok = i => !!(it[i] && it[i].ok);
  const pct = d.P.bel.length ? Math.floor((d.P.bel.length - d.open.length) / d.P.bel.length * 100) : 0;
  // vinkje 0 (besluit gelezen) en 8 (apps lezen productdata) blijven handmatig
  return { c:{ 1:ok(0), 2:ok(1), 3:ok(2), 4:ok(3), 5:ok(4), 6:ok(5), 7:ok(6) }, f:Object.assign({ aantal:d.P.bel.length, pdata:pct }, d.P.groen && d.P.code ? { code:d.P.code } : {}) };
});
// per laag: open nu · waarvan bewezen voorstel klaar (één tik) · waarvan echte vraag aan Daan
function lagenBlok(d){
  if(!pd2Klaar() || !PD2R.wachtOp) return '';
  const W = wachtOpZL(d.P.bel);
  return `<ul class="nog">${['soort', 'gewicht', 'hoev'].map(k => { const w = W[k];
    return `<li><span class="nt"><b>${esc(PD2R.STAPNAAM[k])}: ${nf(w.open)} open</b><span class="muted klein">${nf(w.bewezen.length)} met bewezen voorstel (één tik) · ${nf(w.vraag.length)} echte vraag aan jou</span></span>`
      + `${w.bewezen.length ? knop('0.4', '#/pd2/voorstel/' + k, 'Bevestigen', true) : ''}${w.vraag.length ? knop('0.4', '#/doorloop/' + k, 'Invullen') : ''}</li>`; }).join('')}</ul>`;
}
function nodig04(id){
  if(PD.fout) return `<div class="melding">Productdata laden lukte niet: ${esc(PD.fout.message || String(PD.fout))}</div>`;
  const d = data04(); if(!d){ pdLaden(); return '<div class="leeg">Productdata laden…</div>'; }
  const it = d.P.items;
  const nGroen = it.filter(x => x.ok).length;
  // alles gaat naar Productdata 2.0 (31-10); alleen de steekproef woont nog op de oude poortpagina, de vloernaam in Vloernamen
  const link = (x, i) => i === 2 ? dubbelLink() : x.steek ? '#/todo/overzicht' : x.pd2 && i >= 3 && i < 6 ? '#/doorloop/' + PD2STAP[i - 3] : '#/pd2/open';
  const knopT = (x, i) => i === 1 ? 'Overzetten' : i === 2 ? 'Kiezen' : x.laag || x.pd2 ? 'Invullen' : x.steek ? 'Steekproef' : 'Bekijken';
  const regels = it.map((x, i) => x.ok ? '' : `<li><span class="nt"><b>${esc(x.t)}</b><span class="muted klein">${esc(x.u || '')}</span></span>${i === 1 ? `<button class="knop" data-a="pd-overzet">${esc((x.u || '').match(/\d+/) ? 'Zet ' + (x.u.match(/\d+/) || [''])[0] + ' waarden over' : 'Overzetten')}</button>` : x.steek && !x.kan ? '<span class="knop" aria-disabled="true" style="opacity:.55;cursor:not-allowed">Kan als laag 1–3 klaar zijn</span>' : knop(id, link(x, i), knopT(x, i))}</li>`).join('');
  return `<p class="kern"><b>${nf(nGroen)}</b> van ${nf(it.length)} groen in Poort 0.4 · ${nf(d.P.bel.length)} belangrijke producten · <b>${nf(d.open.length)}</b> producten open</p>
    ${lagenBlok(d)}
    <ul class="nog">${regels || '<li><span class="nt"><b>Alle regels van Poort 0.4 zijn groen.</b></span></li>'}</ul>
    <p class="muted klein">Wat op Later staat telt niet mee en staat apart bovenaan Te doen.</p>`;
}
// "…" mag nooit blijven staan: na 45 s staat er wat er mis is, en terwijl er geladen wordt tekent Te doen zichzelf elke 3 s opnieuw
let laadT = null;
function wachtOpLaden(){
  if(laadT) return;
  laadT = setTimeout(() => { laadT = null; const m = IV() && IV().huidig && IV().huidig(); if(m && ['todo', 'taak'].includes(m.native) && !data04()) herteken(); }, 3000);
}
function kort04(){
  const d = data04();
  if(!d){
    if(PD.fout) return '';
    wachtOpLaden();
    const sec = PD.sinds ? Math.round((Date.now() - PD.sinds) / 1000) : 0;
    return sec > 45 ? 'tellen duurt lang (' + sec + ' s): Productdata en Productdata 2.0 worden nog geladen' : 'tellen…';
  }
  return nf(d.open.length) + ' producten open' + (d.voorlopig ? ' (voorlopig: Productdata 2.0 laadde niet)' : '');
}

/* ---------- overige stappen ---------- */
const SB = 'https://supabase.com/dashboard/project/jarbgetbwkjtxwtcfwmq';
function nodig03(){
  return `<ul class="nog">
    <li><span class="nt"><b>Project Palletlabels</b><span class="muted klein">Abonnement en dataverkeer</span></span>${ext(SB, 'Dashboard')}</li>
    <li><span class="nt"><b>Back-ups</b><span class="muted klein">Database → Backups: dagelijkse back-up zichtbaar?</span></span>${ext(SB + '/database/backups/scheduled', 'Back-ups')}</li>
    <li><span class="nt"><b>Gebruik</b><span class="muted klein">Dataverkeer (egress) tegen de grens van het abonnement</span></span>${ext(SB + '/settings/billing/usage', 'Gebruik')}</li>
    <li><span class="nt"><b>Prijzen</b><span class="muted klein">Maandbedrag Pro voor Jim</span></span>${ext('https://supabase.com/pricing', 'Prijzen')}</li></ul>`;
}
function nodig11(id){
  const S = IV() && IV().stats(); if(!S) return '<div class="leeg">Gegevens laden…</div>';
  const U = S.uitleg;
  if(!U) return `<p class="muted">${S.nPdf ? 'Nog geen live stand om te vergelijken.' : 'Nog geen aanvuladvies-PDF ingelezen.'}</p><ul class="nog"><li><span class="nt"><b>Live naast PDF</b></span>${knop(id, '#/vergelijk', 'Vergelijking')}</li></ul>`;
  return `<p class="kern"><b>${nf(U.onverklaard)}</b> onverklaard · ${nf(U.verschillen)} verschillen · ${nf(U.verklaard)} verklaard</p>
    ${U.teOud ? `<p class="let">${esc(U.teOud)}</p>` : ''}
    <ul class="nog"><li><span class="nt"><b>Live naast PDF</b><span class="muted klein">Doel: 0 onverklaarde verschillen. Alleen onverklaard is werk.</span></span>${knop(id, '#/vergelijk', 'Vergelijking', !!U.onverklaard)}</li></ul>`;
}
function kort11(){ const S = IV() && IV().stats(); return S && S.uitleg ? nf(S.uitleg.onverklaard) + ' onverklaard' : ''; }
// telling uit wh/locaties.js (besliste uitzonderingen en verwerkte besluiten tellen niet mee); anders de ruwe telling
const locT = () => { try{ const T = window.WHLOC ? WHLOC.telling() : null; return T && T.geladen ? T : null; }catch(e){ console.error(e); return null; } };
function locRegels(S){
  const T = locT();
  if(T) return WHLOC.SOORTEN.filter(s => s.k !== 'geen').map(s => [s.t + (T.per[s.k].wacht ? ' (' + nf(T.per[s.k].wacht) + ' wachten op Picqer)' : ''), T.per[s.k].werk]);
  const A = S.A;
  return [['Pick of bulk / vast of tijdelijk wijkt af', S.afw], ['Picklocaties op tijdelijk', A.tijdPick.length], ['Dubbele BA-locaties met producten', A.dubbel.length], ['Rommel-locaties met producten', A.rommel.length], ['Producten op een gang- of niveaumap', A.opMap.length]];
}
function nodig33(id){
  const T = locT();
  if(T){
    const G = WHLOC.gangStats(), na = G.reduce((s, g) => s + g.na, 0), n = G.reduce((s, g) => s + g.n, 0);
    const r = WHLOC.SOORTEN.map(s => { const x = T.per[s.k]; if(!x.n) return '';
      return `<li><span class="nt"><b>${x.werk ? nf(x.open) + ' open · ' : '✓ '}${esc(s.t)}</b><span class="muted klein">${nf(x.beslist)} van ${nf(x.n)} beslist${x.wacht ? ' · ' + nf(x.wacht) + ' wachten op Picqer' : ''}</span></span>${knop(id, '#/locaties/punt/' + s.k, x.werk ? 'Doorlopen' : 'Bekijken', !!x.open)}</li>`; }).join('');
    return `<ul class="nog">${r || '<li><span class="nt">Geen aandachtspunten in de locaties.</span></li>'}
      <li><span class="nt"><b>Locaties</b><span class="muted klein">Alle aandachtspunten, gangen en de import op een verse export</span></span>${knop(id, '#/locaties', 'Locaties', true)}</li></ul>
      <details class="pgroep"><summary><b>Gangen nalopen per hoogte</b> <i class="tel">${nf(na)} / ${nf(n)}</i></summary>
      <ul class="nog">${G.map(g => `<li><span class="nt"><b>Gang ${esc(g.gang)}</b><span class="muted klein">${nf(g.na)} van ${nf(g.n)} locaties nagelopen</span></span>${knop(id, '#/locaties/' + g.gang, 'Gang ' + g.gang)}</li>`).join('')}</ul></details>`;
  }
  const S = IV() && IV().stats(); if(!S) return '<div class="leeg">Gegevens laden…</div>';
  const r = locRegels(S).filter(x => x[1]);
  return `<ul class="nog">${r.map(([t, n]) => `<li><span class="nt"><b>${nf(n)} · ${esc(t)}</b></span></li>`).join('') || '<li><span class="nt">Geen punten in de locatie-export.</span></li>'}
    <li><span class="nt"><b>Locaties</b><span class="muted klein">Stellingkaart, aandachtspunten, locatie-import</span></span>${knop(id, '#/locaties', 'Locaties', true)}</li></ul>`;
}
function kort33(){ const T = locT(); if(T) return nf(T.werk) + ' punten'; const S = IV() && IV().stats(); return S ? nf(locRegels(S).reduce((s, x) => s + x[1], 0)) + ' punten' : ''; }
function nodig41(id){
  const S = IV() && IV().stats(); if(!S) return '<div class="leeg">Gegevens laden…</div>';
  return `<ul class="nog">
    <li><span class="nt"><b>${nf(S.cnt.nivPd)} · aanvulniveaus klaar in Productdata</b><span class="muted klein">${nf(S.cnt.niveau)} lopers hebben nog geen aanvulniveau in Picqer</span></span></li>
    <li><span class="nt"><b>${nf(S.cnt.pickPd)} · lopers met picklocatie "ja" maar zonder plek</b><span class="muted klein">${nf(S.cnt.pick)} lopers zonder vaste picklocatie in Picqer</span></span></li>
    <li><span class="nt"><b>A/B-check</b><span class="muted klein">Lopers stap voor stap: picklocatie, vast, niveaus</span></span>${knop(id, '#/abcheck', 'A/B-check', true)}</li></ul>`;
}
function kort41(){ const S = IV() && IV().stats(); return S ? nf(S.cnt.nivPd) + ' niveaus klaar' : ''; }
const LEV = {
  '0.3':{ nodig:nodig03 },
  '0.4':{ nodig:nodig04, kort:kort04, pd:true },
  '1.1':{ nodig:nodig11, kort:kort11 },
  '3.3':{ nodig:nodig33, kort:kort33 },
  '4.1':{ nodig:nodig41, kort:kort41 }
};
const kortVan = id => (LEV[id] && LEV[id].kort) ? LEV[id].kort() : '';

/* ---------- takenpagina ---------- */
const UIT = { wacht:null };
function veldHtml(s, f, e, slot){
  const v = e.f[f.k] ?? '', auto = e.autoF.has(f.k), ok = BP.fieldOk(f, e), gevuld = String(v).trim() !== '';
  const a = `id="bp-f-${esc(f.k)}" data-bp-veld="${esc(f.k)}" data-stap="${esc(s.id)}" ${slot ? 'disabled' : ''} ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}`;
  const inp = f.type === 'area' ? `<textarea ${a} rows="4">${esc(v)}</textarea>`
    : f.type === 'select' ? `<select ${a}><option value=""></option>${(f.opts || []).map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
    : `<input ${a} type="${f.type === 'date' ? 'date' : 'text'}" ${f.type === 'num' ? 'inputmode="decimal"' : ''} value="${esc(v)}" class="${auto ? 'auto' : ''}">`;
  return `<div class="veld" data-veldbox="${esc(f.k)}"><label for="bp-f-${esc(f.k)}">${esc(f.l)}${f.req ? '' : ' <span class="muted klein">(mag leeg)</span>'}${auto ? ' <i class="autotag">automatisch</i>' : ''}</label>${inp}
    ${veldMsg(f, gevuld, ok)}</div>`;
}
const veldMsg = (f, gevuld, ok) => `<span class="msg klein ${gevuld && !ok ? 'fout' : gevuld && f.check ? 'goed' : 'muted'}">${esc(gevuld && !ok ? (f.hint || 'Klopt nog niet.') : gevuld && f.check ? 'Klopt ✓' : (f.hint || ''))}</span>`;
const nogTekst = m => m.mc || m.mf ? 'Nog ' + [m.mc ? nf(m.mc) + (m.mc === 1 ? ' vinkje' : ' vinkjes') : '', m.mf ? nf(m.mf) + (m.mf === 1 ? ' veld' : ' velden') : ''].filter(Boolean).join(' en ') : 'Alles klopt.';
// tijdens het typen: alleen de controle bij het veld en de knop Stap afronden bijwerken (niet de hele pagina)
function werkBij(id){
  const s = BP.BYID[id]; if(!s) return;
  const e = BP.eff(id), m = BP.missing(s);
  s.fields.forEach(f => { const box = document.querySelector('[data-veldbox="' + f.k + '"] .msg'); if(box) box.outerHTML = veldMsg(f, String(e.f[f.k] ?? '').trim() !== '', BP.fieldOk(f, e)); });
  const b = document.querySelector('[data-a="bp-af"]'); if(b){ b.disabled = !!(m.mc || m.mf); const t = document.querySelector('[data-bp-nog]'); if(t) t.textContent = nogTekst(m); }
}
function inhoud(id){
  const s = BP.BYID[id];
  if(!s) return `<section class="blok"><h2>Stap ${esc(id)} bestaat niet</h2><a class="knop" href="#/bouwplan/route">Route</a></section>`;
  if(LEV[id] && LEV[id].pd && !pdKlaar() && !PD.fout) pdLaden();
  const st = BP.staatVan(s), e = BP.eff(id), m = st.k === 'af' ? { mc:0, mf:0 } : BP.missing(s);
  const slot = st.k === 'af' || st.k === 'dicht';
  const voor = BP.STEPS.slice(0, s.i).find(x => !BP.isDone(x.id) && !BP.isHold(x.id));
  const isLaatsteAf = st.k === 'af' && BP.lastDoneIdx() === s.i;
  const nVink = s.checks.filter((_, i) => e.c[i]).length;
  const volgende = st.k === 'af' ? BP.huidig() : null;
  return `<section class="taak taakkop">
      <span class="eyebrow">Stap ${esc(s.id)} · ${esc(BP.pijler(s))}</span>
      <h2>${esc(s.t)}</h2>
      <p class="doel"><b>Doel van de fase:</b> ${esc(s.phase.goal)}</p>
      <div class="rij"><i class="sst ${st.k}">${st.k === 'dicht' ? '🔒 ' : ''}${esc(st.t)}</i>${st.k === 'wacht' ? `<span class="klein">${esc(e.holdWhy || '')}</span>` : ''}${st.k === 'dicht' && voor ? `<span class="klein">Gaat open na stap ${esc(voor.id)} (${esc(voor.t)})</span>` : ''}</div>
    </section>
    <section class="blok"><h2>Opdracht</h2><p>${esc(s.do)}</p><h3>Waarom</h3><p class="muted">${esc(s.why)}</p></section>
    ${LEV[id] && st.k !== 'af' ? `<section class="blok nogblok"><h2>Nog te doen</h2>${LEV[id].nodig(id)}</section>` : ''}
    <section class="blok"><div class="rij tussen"><h2>Klaar als</h2><span class="muted klein">${nf(nVink)} van ${nf(s.checks.length)}</span></div>
      <ul class="vinken">${s.checks.map((c, i) => { const auto = e.autoC.has(i); return `<li><label class="vink${auto ? ' auto' : ''}"><input type="checkbox" data-a="bp-vink" data-stap="${esc(id)}" data-i="${i}" ${e.c[i] ? 'checked' : ''} ${auto || slot ? 'disabled' : ''}><span>${esc(c)}${auto ? ' <i class="autotag">automatisch</i>' : ''}</span></label></li>`; }).join('')}</ul></section>
    ${s.fields.length ? `<section class="blok"><h2>Vastleggen</h2><div class="velden">${s.fields.map(f => veldHtml(s, f, e, slot)).join('')}</div></section>` : ''}
    <section class="blok"><h2>Notitie</h2><textarea id="bp-note" data-stap="${esc(id)}" rows="4" placeholder="Wat je tegenkwam, met datum">${esc(e.note || '')}</textarea><span class="muted klein" data-bp-status>${esc(BP.B.status)}</span></section>
    <section class="blok acties">
      ${st.k === 'nu' ? `<div class="rij tussen"><div><button class="knop pri groot" data-a="bp-af" data-stap="${esc(id)}" ${m.mc || m.mf ? 'disabled' : ''}>Stap afronden</button>
          <span class="muted klein" data-bp-nog>${esc(nogTekst(m))}</span></div>
          ${UIT.wacht === id ? `<div class="veldrij"><input id="bp-wachtwhy" placeholder="Reden (verplicht)"><button class="knop" data-a="bp-wacht-ok" data-stap="${esc(id)}">Op wacht zetten</button><button class="knop" data-a="bp-wacht-terug">Annuleer</button></div>` : `<button class="knop" data-a="bp-wacht" data-stap="${esc(id)}">Zet op wacht</button>`}</div>` : ''}
      ${st.k === 'wacht' ? `<div class="rij"><button class="knop pri" data-a="bp-hervat" data-stap="${esc(id)}">Hervat</button><span class="muted klein">Op wacht sinds ${esc(BP.datumTijd(e.holdAt))}</span></div>` : ''}
      ${st.k === 'af' ? `<div class="rij"><span>Afgerond ${esc(BP.datumTijd(e.done))}.</span>${volgende ? `<a class="knop pri" href="#/taak/${esc(volgende.id)}">Naar stap ${esc(volgende.id)} →</a>` : ''}${isLaatsteAf ? `<button class="knop" data-a="bp-heropen">Heropen</button>` : ''}</div>` : ''}
      ${st.k === 'dicht' ? `<p class="muted">Eén stap tegelijk. Deze gaat open als de stappen ervoor af of op wacht zijn.</p>` : ''}
    </section>
    ${s.claude ? `<section class="blok"><div class="rij tussen"><h2>Opdracht voor Claude</h2><button class="knop" data-a="bp-kopieer" data-stap="${esc(id)}">Kopieer</button></div><pre class="claude">${esc(s.claude)}</pre></section>` : ''}`;
}
function viewTaak(id){
  if(BP.B.bestaat !== true) return BP.view('');
  return `<div class="pagina">
    <div class="rij"><a class="knop" href="#/todo">← Te doen</a><a class="knop" href="#/bouwplan/route">Route</a></div>
    ${inhoud(id)}</div>`;
}

/* ---------- Te doen ---------- */
function blokNu(){
  if(BP.B.bestaat === null) return '<div class="leeg">Bouwplan laden…</div>';
  if(BP.B.bestaat === false) return `<section class="taak"><span class="eyebrow">Nu</span><h2>Bouwplan nog niet overgenomen</h2><p>Eén keer overnemen uit het oude artifact, daarna staat hier steeds de stap van nu.</p><div class="rij"><a class="knop pri" href="#/bouwplan">Naar Bouwplan</a></div></section>`;
  const s = BP.huidig();
  if(!s) return `<section class="taak"><span class="eyebrow">Nu</span><h2>Bouwplan af</h2></section>`;
  if(LEV[s.id] && LEV[s.id].pd && !pdKlaar() && !PD.fout) pdLaden();
  const e = BP.eff(s.id), n = s.checks.filter((_, i) => e.c[i]).length, k = kortVan(s.id);
  const wacht = BP.holdList(s.i).filter(w => w.id !== '1.1');   // 1.1 staat geparkeerd tot spoor 3 begint
  return `<section class="taak nu"><span class="eyebrow">Nu · stap ${esc(s.id)} · ${esc(BP.pijler(s))}</span>
      <h2>${esc(s.t)}</h2><p>${esc(eersteZin(s.do))}</p>
      <p class="voortgang">${nf(n)} van ${nf(s.checks.length)} klaar${k ? ' · ' + esc(k) : ''}</p>
      <div class="rij"><a class="knop pri groot" href="#/taak/${esc(s.id)}">Open taak</a></div></section>
    ${(BP.meelopers ? BP.meelopers() : []).filter(m => m.id !== '1.1').map(m => { const em = BP.eff(m.id), nm = m.checks.filter((_, i) => em.c[i]).length, km = kortVan(m.id);
      return `<section class="taak nu"><span class="eyebrow">Loopt mee · stap ${esc(m.id)} · ${esc(BP.pijler(m))}</span><h2>${esc(m.t)}</h2><p>${esc(eersteZin(m.do))}</p>
        <p class="voortgang">${nf(nm)} van ${nf(m.checks.length)} klaar${km ? ' · ' + esc(km) : ''}</p><div class="rij"><a class="knop" href="#/taak/${esc(m.id)}">Open taak</a></div></section>`; }).join('')}
    ${wacht.map(w => `<div class="wachtregel"><span><b>Wacht: ${esc(w.id)}</b> · ${esc(BP.rec(w.id).holdWhy || w.t)}</span><button class="knop" data-a="bp-hervat" data-stap="${esc(w.id)}">Hervat</button></div>`).join('')}`;
}
function blokVandaag(){
  const S = IV() && IV().stats(), B = window.IVL ? IVL.bronnen() : null, it = [];
  const zet = (n, t, w, href, k) => it.push({ n, t, w, href, k });
  if(B && !B.gekoppeld) zet(null, 'Koppel 3.0 met Picqer', 'Eén keer op dit apparaat. Daarna haalt 3.0 alles zelf op.', '#/bronnen', 'Koppelen');
  if(B && B.functieOud) zet(null, 'Picqer-functie bijwerken', 'Locaties en aanvulniveaus live: 5 minuten op de Mac.', '#/bronnen', 'Stappen');
  if(S){
    if(S.lossenVandaag) zet(S.lossenVandaag, S.lossenVandaag === 1 ? 'Container lost vandaag' : 'Containers lossen vandaag', 'Losdag: plekken klaar, palletlabels, Stockmove.', '#/containers', 'Containers');
    if(S.lossenMorgen) zet(S.lossenMorgen, S.lossenMorgen === 1 ? 'Container lost morgen' : 'Containers lossen morgen', 'Vandaag ruimte maken en de losdag voorbereiden.', '#/containers', 'Containers');
    if(S.voorbij) zet(S.voorbij, S.voorbij === 1 ? 'Container met losdatum voorbij' : 'Containers met losdatum voorbij', 'Gelost? Dan ontvangst inlezen en afronden.', '#/containers', 'Containers');
    if(S.zonder) zet(S.zonder, S.zonder === 1 ? 'Container zonder losdatum' : 'Containers zonder losdatum', 'Vervoerder bellen of verwachte datum zetten.', '#/containers', 'Containers');
    if(S.oudExp && S.oudExp.length) zet(S.oudExp.length, S.oudExp.length === 1 ? 'Export ouder dan zijn ritme' : 'Exports ouder dan hun ritme', S.oudExp.map(x => x.t + ' (' + x.w + ')').join(' · '), '#/gegevens', 'Gegevens inladen');
  }
  if(!S && !it.length) return '<div class="leeg">Gegevens laden…</div>';
  if(!it.length) return '<p class="muted">Niets operationeels voor vandaag.</p>';
  return `<div class="todos">${it.map(x => `<a class="todo zn" href="${esc(x.href)}"><span class="tt"><b>${x.n != null ? nf(x.n) + ' · ' : ''}${esc(x.t)}</b><span>${esc(x.w)}</span></span><span class="tk">${esc(x.k)} →</span></a>`).join('')}</div>`;
}
function laterGroepen(){
  const S = IV() && IV().stats(); if(!S) return [];
  const g = [];
  const U = S.uitleg;
  g.push(['3.3', locRegels(S)]);
  g.push(['4.1', [['Aanvulniveaus naar Picqer: lopers zonder niveau' + (S.cnt.nivPd ? ' (' + nf(S.cnt.nivPd) + ' klaar in Productdata)' : ''), S.cnt.niveau], ['Lopers zonder vaste picklocatie (4.1/4.2)', S.cnt.pick]]]);
  const nu = BP.huidig();
  return g.map(([id, r]) => [id, r.filter(x => x[1])]).filter(([id, r]) => r.length && (!nu || nu.id !== id) && !BP.isDone(id) && !BP.isNu(id));
}
function blokLater(){
  const S = IV() && IV().stats(); if(!S) return '<div class="leeg">Gegevens laden…</div>';
  const g = laterGroepen();
  if(!g.length) return '<p class="muted">Niets voor later.</p>';
  return g.map(([id, r]) => { const s = BP.BYID[id];
    return `<section class="later"><h3><span aria-hidden="true">🔒</span> ${esc(id)} · ${esc(s ? s.t : '')} <i class="tel">${nf(r.reduce((t, x) => t + x[1], 0))}</i></h3>
      <ul>${r.map(([t, n]) => `<li><span>${esc(t)}</span><b>${nf(n)}</b></li>`).join('')}</ul></section>`; }).join('');
}
// producten die op Daans tik wachten: Te controleren plus de bewezen voorstellen in Productdata 2.0, met één knop die bij het grootste blok begint
function blokTik(){
  if(!pd2Klaar() || !PD2R.wachtOp){ if(!PD.fout && !pdKlaar()) pdLaden(); wachtOpLaden(); return '<p class="muted klein">Wat op jouw tik wacht wordt geteld…</p>'; }
  const W = wachtOpZL(PD2R.belangrijk()), codes = new Set(), grootste = ['soort', 'gewicht', 'hoev'].slice().sort((a, b) => W[b].bewezen.length - W[a].bewezen.length)[0];
  ['soort', 'gewicht', 'hoev'].forEach(k => W[k].bewezen.forEach(b => codes.add(b.c)));
  let tc = null; try{ if(window.WHX && WHX.S && WHX.S.pd) tc = new Set(WHX.vraagLijst().map(q => q.c)); }catch(e){}
  const bewezen = codes.size; if(tc) tc.forEach(c => codes.add(c));
  const href = W[grootste].bewezen.length ? '#/pd2/voorstel/' + grootste : '#/nakijken';
  return `<section class="taak nu"><span class="eyebrow">Wacht op jouw tik</span><h2>${nf(codes.size)} producten wachten op jouw tik</h2>
    <p class="muted klein">${nf(bewezen)} met een voorstel dat de data bewijst (één tik per groep, uitvinken kan)${tc ? ' · ' + nf(tc.size) + ' om te controleren' : ' · Te controleren wordt nog geteld'}</p>
    <div class="rij"><a class="knop pri groot" href="${href}">Begin</a></div></section>`;
}
// stap 1.1 (Live advies tegen de PDF) hoort bij spoor 3 (Aanvullen): op de parkeerlijst tot dat spoor begint, met een kopie vooraf van de bouwplan-rij
let parkeerP = null;
function parkeer11(){
  if(parkeerP || !BP.B || BP.B.bestaat !== true || !BP.BYID['1.1'] || BP.isDone('1.1') || BP.isHold('1.1')) return;
  parkeerP = (async () => {
    try{ const r = await WH.catHaal('wh-bouwplan').catch(() => null); if(r && r.data) await WH.catZet('wh-bouwplan-kopie-' + WH.isoDag(), r.data); }catch(e){ console.error(e); }
    BP.opWacht('1.1', 'Geparkeerd tot spoor 3 (Aanvullen) begint. De pagina Live advies blijft bereikbaar in het menu.');
  })();
}
const LNAAM = { soort:'Soort', gewicht:'Gewicht', spp:'Hoeveelheid: stuks per pallet', maat:'Hoeveelheid: palletmaat', hoogte:'Hoeveelheid: hoogte', maxpick:'Hoeveelheid: max op pick', rl:'Hoeveelheid: lengte volle rol', rmax:'Hoeveelheid: max rollen per pallet' };
const dagTijd = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.getDate() + '-' + (d.getMonth() + 1) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
// Later · moet nog: eigen kaart bovenaan, geen onderdeel van de tellingen
function blokLaterKaart(){
  if(!LATER.klaar || !pd2Klaar()) return '';
  const l = laterOpen(); if(!l.length) return '';
  return `<section class="taak nu laterkaart" id="later-kaart"><span class="eyebrow">Later</span><h2>Later · moet nog (${nf(l.length)})</h2>
    <ul class="nog">${l.slice(0, 8).map(x => `<li><span class="nt"><b>${esc(x.c)} · ${esc((WH.D.P[x.c] || {}).naam || '')}</b><span class="muted klein">${esc(LNAAM[x.t] || x.t)} · sinds ${esc(dagTijd(x.op))}${x.opm ? ' · ' + esc(x.opm) : ''}</span></span></li>`).join('')}${l.length > 8 ? `<li><span class="nt muted klein">+ ${nf(l.length - 8)} meer</span></li>` : ''}</ul>
    <div class="rij"><a class="knop pri groot" href="#/doorloop/later" data-taak="0.4">Later-lijst →</a></div></section>`;
}
// de controleronde (wh/controle-pd.js) wordt geladen als Te doen opent
let cpP = null;
function laadCp(){
  if(window.WHCP) return Promise.resolve();
  if(!cpP) cpP = fetch('wh/controle-pd.js', { cache:'no-cache' }).then(r => { if(!r.ok) throw new Error('status ' + r.status); return r.text(); })
    .then(t => { const s = document.createElement('script'); s.textContent = t + '\n//# sourceURL=wh/controle-pd.js'; document.body.appendChild(s); WHCP.koppel(); return WHCP.laad(); })
    .then(() => herteken()).catch(e => { cpP = null; console.error(e); });
  return cpP;
}
function viewTodo(rest){
  parkeer11();
  if(!pdKlaar() && !PD.fout) pdLaden();
  laadCp();
  const tab = String(rest || '').split('/')[0] || 'overzicht';
  const tabs = window.WHCP && pd2Klaar() && LATER.klaar ? WHCP.html(tab) : '<p class="muted klein">De controleronde wordt berekend…</p>';
  return `<div class="pagina">
    <div class="bouwtekening"><a class="knop" href="https://claude.ai/artifact/8mvbCuxpKQLhz9hKG6SnVS" target="_blank" rel="noopener">Bouwtekening ↗</a><span class="muted klein">de pilaren en wat deze week gebouwd wordt</span></div>
    <h1>Te doen</h1>
    <div class="cpwrap">${tabs}</div>
    ${blokNu()}
    <h2 class="bt">Vandaag</h2>${blokVandaag()}
    <h2 class="bt">Later</h2><p class="muted klein">Hoort bij een latere stap van het bouwplan. Nu niet aan beginnen.</p>${blokLater()}
  </div>`;
}

/* ---------- taakbalk: terug naar de taak vanaf een geopend scherm ---------- */
function balk(){
  const el = $('taakbalk'); if(!el) return;
  const id = ssHaal(), s = id && BP.BYID[id];
  const opTaak = id && (location.hash === '#/taak/' + id || (location.hash.replace(/\/$/, '') === '#/bouwplan' || location.hash === '#/bouwplan/nu') && BP.huidig() && BP.huidig().id === id);
  if(opTaak){ ssZet(null); }
  if(!s || opTaak){ el.hidden = true; el.innerHTML = ''; return; }
  const k = kortVan(id);
  el.innerHTML = `<span class="tb"><b>Taak ${esc(s.id)}</b> · ${esc(s.t)}${k ? ' · ' + esc(k) : ''}</span><a class="bk" href="#/taak/${esc(s.id)}">← Terug naar taak</a><button class="bx" data-a="taakbalk-weg" aria-label="Taakbalk sluiten">×</button>`;
  el.hidden = false;
}

/* ---------- tekenen ---------- */
let wachtTeken = false;
const bezigMetTypen = () => { const a = document.activeElement, nat = $('native'); return !!(a && nat && nat.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox'); };
function huidigeRoute(){ const m = location.hash.match(/^#\/([\w-]+)(?:\/(.+))?$/) || []; return { id:m[1] || '', rest:m[2] || '' }; }
function render(native, rest){
  const nat = $('native'); if(!nat) return;
  const y = nat.scrollTop, open = [...nat.querySelectorAll('details[open] summary b')].map(b => b.textContent);
  nat.innerHTML = native === 'todo' ? viewTodo(rest) : native === 'taak' ? viewTaak(decodeURIComponent(rest || (BP.huidig() || {}).id || '')) : BP.view(rest);
  nat.querySelectorAll('details summary b').forEach(b => { if(open.includes(b.textContent)) b.closest('details').open = true; });
  nat.scrollTop = y;
}
function herteken(){
  balk();
  const iv = IV(); if(!iv) return;
  const m = iv.huidig(); if(!m || !['todo', 'taak', 'bouwplan'].includes(m.native)) return;
  if(bezigMetTypen()){ wachtTeken = true; return; }
  wachtTeken = false;
  render(m.native, huidigeRoute().rest);
}
document.addEventListener('focusout', () => { if(wachtTeken) setTimeout(() => { if(!bezigMetTypen()) herteken(); }, 50); });

/* ---------- gebeurtenissen ---------- */
async function kopieer(t){
  try{ await navigator.clipboard.writeText(t); WH.toast('Gekopieerd'); }
  catch(e){ const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); WH.toast('Gekopieerd'); }catch(e2){ WH.toast('Kopiëren lukte niet'); } ta.remove(); }
}
// de bekende waarden uit palletlabels en containers naar productdata (kopie eerst, in WHPD.overzetten); daarna vóór en na naast elkaar
async function overzet04(){
  try{
    const voor = WHPD.telOud(), vN = Object.values(voor.t).reduce((x, y) => x + y, 0);
    const m = await WHPD.overzetten();
    const na = WHPD.telOud(), nN = Object.values(na.t).reduce((x, y) => x + y, 0);
    PD.cache = null;
    WH.toast(nf(m.n) + ' producten overgezet (' + nf(vN) + ' waarden vooraf, ' + nf(nN) + ' nog over); kopie in wh-kopie-productdata', 7000);
  }catch(e){ console.error(e); WH.toast('Overzetten lukte niet: ' + (e.message || e), 7000); }
  herteken();
}
document.addEventListener('click', ev => {
  const l = ev.target.closest('[data-taak]'); if(l) ssZet(l.dataset.taak);
  const k = ev.target.closest('[data-a]'); if(!k) return;
  const a = k.dataset.a, id = k.dataset.stap;
  if(a === 'taakbalk-weg'){ ssZet(null); balk(); return; }
  if(a === 'pd-overzet'){ k.disabled = true; overzet04(); return; }
  if(a === 'bp-overnemen'){ k.disabled = true; BP.overnemen().then(herteken); return; }
  if(a === 'bp-af'){ if(BP.afronden(id)) WH.toast('Stap ' + id + ' afgerond'); return; }
  if(a === 'bp-wacht'){ UIT.wacht = id; herteken(); const i = $('bp-wachtwhy'); if(i) i.focus(); return; }
  if(a === 'bp-wacht-terug'){ UIT.wacht = null; herteken(); return; }
  if(a === 'bp-wacht-ok'){ const r = (($('bp-wachtwhy') || {}).value || '').trim(); if(!r){ WH.toast('Reden is verplicht'); return; } UIT.wacht = null; BP.opWacht(id, r); return; }
  if(a === 'bp-hervat'){ BP.hervat(id); return; }
  if(a === 'bp-heropen'){ const h = BP.heropen(); if(h) WH.toast('Stap ' + h + ' weer open'); return; }
  if(a === 'bp-kopieer'){ const s = BP.BYID[id]; if(s) kopieer(s.claude); return; }
  if(a === 'bp-parkeer'){ const t = $('bp-park'); if(t && t.value.trim()){ BP.parkeer(t.value); } return; }
  if(a === 'bp-parkweg'){ BP.parkeerWeg(k.dataset.id); return; }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if(t.dataset && t.dataset.a === 'bp-vink'){ BP.vink(t.dataset.stap, +t.dataset.i); return; }
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if(t.dataset && t.dataset.bpVeld){ BP.veld(t.dataset.stap, t.dataset.bpVeld, t.value); werkBij(t.dataset.stap); }
  else if(t.id === 'bp-note') BP.notitie(t.dataset.stap, t.value);
});
BP.opNieuw(herteken);

return { viewTodo, viewTaak, inhoud, render, herteken, balk, pdLaden, data04, kortVan, openZL, later:{ laad:laadLater, is:isLater, zet:zetLater, lijst:laterOpen, items:() => LATER.items, klaar:() => LATER.klaar } };
})();
