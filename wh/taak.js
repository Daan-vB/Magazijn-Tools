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
const PD = { p:null, fout:null, cache:null };
const pdKlaar = () => !!(window.WHPD && WHPD.S && WHPD.S.klaar && !WHPD.S.fout);
function pdLaden(){
  if(pdKlaar()) return Promise.resolve(true);
  if(!PD.p) PD.p = (async () => {
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
      if(window.PD2R && PD2R.laad && !(PD2R.S && PD2R.S.klaar)) await PD2R.laad().catch(e => console.error(e));   // Productdata 2.0 is de telling
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

/* ---------- 0.4: Poort 0.4 uit Productdata ----------
   Te doen toont bij stap 0.4 alleen de poort: de regels die nog rood zijn, elk met één knop (Daan 17-10).
   Het werk zelf (open velden per laag) staat in het scherm "Nog open" in Productdata. */
function data04(){
  if(!pdKlaar()) return null;
  if(PD.cache && Date.now() - PD.cache.op < 15e3) return PD.cache.d;
  const P = WHPD.poort();
  const open = [];
  P.bel.forEach(c => { const v = WHPD.openStappen(c); if(v.length) open.push({ c, v }); });
  const d = { P, open };
  PD.cache = { op:Date.now(), d };
  return d;
}
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
function nodig04(id){
  if(PD.fout) return `<div class="melding">Productdata laden lukte niet: ${esc(PD.fout.message || String(PD.fout))}</div>`;
  const d = data04(); if(!d){ pdLaden(); return '<div class="leeg">Productdata laden…</div>'; }
  const it = d.P.items, nGroen = it.filter(x => x.ok).length;
  // alles gaat naar Productdata 2.0 (31-10); alleen de steekproef woont nog op de oude poortpagina, de vloernaam in Vloernamen
  const link = (x, i) => i === 2 ? dubbelLink() : x.steek ? '#/productdata/poort' : '#/pd2/open';
  const knopT = (x, i) => i === 1 ? 'Overzetten' : i === 2 ? 'Kiezen' : x.laag || x.pd2 ? 'Invullen' : x.steek ? 'Steekproef' : 'Bekijken';
  const regels = it.map((x, i) => x.ok ? '' : `<li><span class="nt"><b>${esc(x.t)}</b><span class="muted klein">${esc(x.u || '')}</span></span>${x.steek && !x.kan ? '<span class="knop" aria-disabled="true" style="opacity:.55;cursor:not-allowed">Kan als laag 1–3 klaar zijn</span>' : knop(id, link(x, i), knopT(x, i))}</li>`).join('');
  const later = BP.inst('poortLaterMee') !== false;
  return `<p class="kern"><b>${nf(nGroen)}</b> van ${nf(it.length)} groen in Poort 0.4 · ${nf(d.P.bel.length)} belangrijke producten · <b>${nf(d.open.length)}</b> producten open</p>
    <ul class="nog">${regels || '<li><span class="nt"><b>Alle regels van Poort 0.4 zijn groen.</b></span></li>'}</ul>
    <label class="schakel"><input type="checkbox" data-a="bp-latermee" ${later ? 'checked' : ''}> Later en Op maat tellen mee in de poort</label>`;
}
function kort04(){ const d = data04(); if(!d) return PD.fout ? '' : '… producten open'; return nf(d.open.length) + ' producten open'; }

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
  const wacht = BP.holdList(s.i);
  return `<section class="taak nu"><span class="eyebrow">Nu · stap ${esc(s.id)} · ${esc(BP.pijler(s))}</span>
      <h2>${esc(s.t)}</h2><p>${esc(eersteZin(s.do))}</p>
      <p class="voortgang">${nf(n)} van ${nf(s.checks.length)} klaar${k ? ' · ' + esc(k) : ''}</p>
      <div class="rij"><a class="knop pri groot" href="#/taak/${esc(s.id)}">Open taak</a></div></section>
    ${(BP.meelopers ? BP.meelopers() : []).map(m => { const em = BP.eff(m.id), nm = m.checks.filter((_, i) => em.c[i]).length, km = kortVan(m.id);
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
  if(U && U.onverklaard) g.push(['1.1', [['Live naast PDF: onverklaarde verschillen', U.onverklaard]]]);
  else if(!U && S.V) g.push(['1.1', [['Live naast PDF: verschillen', S.V.alleenPdf.length + S.V.alleenLive.length]]]);
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
function viewTodo(){
  return `<div class="pagina">
    <div class="bouwtekening"><a class="knop" href="https://claude.ai/artifact/8mvbCuxpKQLhz9hKG6SnVS" target="_blank" rel="noopener">Bouwtekening ↗</a><span class="muted klein">de pilaren en wat deze week gebouwd wordt</span></div>
    <h1>Te doen</h1>
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
  nat.innerHTML = native === 'todo' ? viewTodo() : native === 'taak' ? viewTaak(decodeURIComponent(rest || (BP.huidig() || {}).id || '')) : BP.view(rest);
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
document.addEventListener('click', ev => {
  const l = ev.target.closest('[data-taak]'); if(l) ssZet(l.dataset.taak);
  const k = ev.target.closest('[data-a]'); if(!k) return;
  const a = k.dataset.a, id = k.dataset.stap;
  if(a === 'taakbalk-weg'){ ssZet(null); balk(); return; }
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
  if(t.dataset && t.dataset.a === 'bp-latermee'){
    const v = t.checked;
    BP.zetInst('poortLaterMee', v);
    if(window.WHPD) WHPD.zetLaterMee(v);
    try{ const fw = $('frame') && $('frame').contentWindow; if(fw && fw.WHPD) fw.WHPD.zetLaterMee(v); }catch(e){}
    PD.cache = null; herteken(); return;
  }
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if(t.dataset && t.dataset.bpVeld){ BP.veld(t.dataset.stap, t.dataset.bpVeld, t.value); werkBij(t.dataset.stap); }
  else if(t.id === 'bp-note') BP.notitie(t.dataset.stap, t.value);
});
BP.opNieuw(herteken);

return { viewTodo, viewTaak, inhoud, render, herteken, balk, pdLaden, data04, kortVan };
})();
