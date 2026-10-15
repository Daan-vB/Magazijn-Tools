/* =====================================================================
   IVOL Warehouse 3.0 — bouwplan (15-10-2026)
   De ruggengraat van 3.0: één stap tegelijk. Was een los claude.ai-artifact, nu hier.
   Route en teksten: wh/bouwplan-route.js (WHBP_ROUTE). Stand: catalog-rij wh-bouwplan
     { v:1, t:<ms>, s:{ "<stap>":{ c:{}, f:{}, done, note, hold, holdWhy, holdAt } }, park:[…], inst:{} }
   Regels (zoals in het artifact):
     - stap i is "nu" als alle eerdere stappen af of op wacht staan
     - afronden kan pas als alle vinkjes en verplichte velden kloppen
     - op wacht zetten met reden, hervatten; alleen de laatst afgeronde stap kan weer open
   Opslaan 700 ms na de laatste wijziging; bij openen en elke 2 minuten opnieuw lezen.
   De app zet zelf vinkjes en velden die hij kan zien (taak.js registreert die per stap): die tellen mee
   bij afronden en worden pas bij Stap afronden in de stand vastgelegd.
   ===================================================================== */
window.WHBP = (function(){
'use strict';
const { esc, nf } = WH;
const R = window.WHBP_ROUTE;
const KEY = 'wh-bouwplan';

/* ---------- stappen ---------- */
const STEPS = [];
R.PHASES.forEach(p => p.steps.forEach(s => STEPS.push(Object.assign(s, { phase:p, pillar:s.pillar || p.pillar }))));
const BYID = {}; STEPS.forEach((s, i) => { s.i = i; BYID[s.id] = s; });

/* ---------- stand ---------- */
// "Neem je bouwplan over": de stand uit het artifact op 15 okt 19:00
const OVERNAME = {"v":1,"t":1792083600000,"park":[{"at":"0.3","id":"1791379500001","t":"2026-10-07T13:25:00.000Z","txt":"Visie voor Jim en Maxime: wat is gebouwd, waarom, welke voordelen. Daarna pas de kosten van Supabase Pro voorleggen (stap 0.3)."},{"at":"0.2","id":"1791393000001","t":"2026-10-07T17:28:00.000Z","txt":"Na 0.2: Supabase-egress omlaag (5,5 van 5 GB op 7 okt). Uitzoeken welke schermen grote tabellen steeds opnieuw ophalen en dat zuiniger maken, zodat het gratis abonnement volstaat."}],"s":{"0.1":{"c":{"0":true,"1":true},"done":"2026-10-07T04:38:01.132Z","f":{"abpick":"22","exports":"5","gang":"451","noloc":"610","std":"1070"},"note":""},"0.2":{"c":{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true},"done":"2026-10-07T18:12:08.824Z","f":{"datum":"2026-10-06","domein":"https://ivol-dev.picqer.com"},"hold":false,"note":"7 okt: testomgeving ivol-dev.picqer.com werkt (101 producten, 540 locaties hoofdmagazijn). Eigen testsleutel staat alleen als geheim in Supabase. Aparte testfunctie picqer-test (alleen lezen), live functie picqer onaangeroerd. Schakelaar Live/Test staat in de Test-app en toont \"Bron: TEST · ivol-dev.picqer.com\". Schrijven naar test pas na akkoord Maxime."},"0.3":{"c":{},"done":null,"f":{},"hold":true,"holdAt":"2026-10-07T18:25:00.000Z","holdWhy":"Eerst 0.4. Daarna zelf vaststellen, Maxime heeft groen licht, Jim niet nodig","note":""},"0.4":{"c":{"0":true,"1":true,"2":false,"3":true,"4":false},"done":null,"f":{},"hold":false,"holdAt":"2026-10-07T13:25:00.000Z","holdWhy":"Raakt live Supabase en Maxime. Eerst de basis stabiel","note":"7 okt: 0.4 is nu de hele productdata-stap (oude 4.1 t/m 4.4 zitten erin). Belangrijke producten = A, B en wat binnenkomt: 475. Werkvolgorde: 1) Overzetten, 2) Dubbel in palletlabels (51), 3) laag 1, 2 en 3 per familie, 4) steekproef van 20 op de vloer, 5) poortcode hier invullen. Claude zet daarna de apps over op productdata.\n15 okt (Claude): vinkjes 'overgezet' en 'Prioriteit 100%' weer uit, want Poort 0.4 zegt: 2 waarden nog over te zetten, laag 1 = 402 van 462. Open: 70 producten, waarvan 39 Later en 11 Ribbel op maat (tellen nu mee). Gedaan: 3.0 en Test lezen Productdata; scherm Productdata → Gelijkzetten (Palletlabels en Containers) staat klaar, nog niet uitgevoerd. Warehouse en Junior volgen na akkoord."}},"inst":{"poortLaterMee":true}};
const norm = d => ({ v:1, t:+d.t || 0, s:(d.s && typeof d.s === 'object') ? d.s : {}, park:Array.isArray(d.park) ? d.park : [], inst:(d.inst && typeof d.inst === 'object') ? d.inst : {} });
const B = { state:norm({}), bestaat:null, vuil:false, timer:null, status:'', fout:null, laden:null, luister:[], auto:{} };

function rec(id){ return B.state.s[id] || { c:{}, f:{}, done:null, note:'' }; }
function mrec(id){ if(!B.state.s[id]) B.state.s[id] = { c:{}, f:{}, done:null, note:'' }; const r = B.state.s[id]; r.c = r.c || {}; r.f = r.f || {}; return r; }
const isDone = id => !!(B.state.s[id] && B.state.s[id].done);
const isHold = id => !!(B.state.s[id] && B.state.s[id].hold && !B.state.s[id].done);
function curIdx(){ for(const s of STEPS){ if(!isDone(s.id) && !isHold(s.id)) return s.i; } for(const s of STEPS){ if(!isDone(s.id)) return s.i; } return -1; }
function lastDoneIdx(){ let l = -1; STEPS.forEach(s => { if(isDone(s.id)) l = s.i; }); return l; }
function nextOpen(c){ return STEPS.find(x => x.i > c && !isDone(x.id) && !isHold(x.id)) || null; }
function holdList(c){ return STEPS.filter(s => isHold(s.id) && s.i !== c); }
// "nu" = alle eerdere stappen af of op wacht, zelf niet af en niet op wacht
const isNu = id => { const s = BYID[id]; return !!s && !isDone(id) && !isHold(id) && STEPS.slice(0, s.i).every(x => isDone(x.id) || isHold(x.id)); };
const huidig = () => { const i = curIdx(); return i < 0 ? null : STEPS[i]; };

/* ---------- controles ---------- */
// poortcode uit Productdata (hoort bij het aantal belangrijke producten), percentage 100
const CHECKS = {
  pdcode:(v, r) => { const m = String(v).trim().toUpperCase().match(/^PD-(\d+)-([0-9A-Z]{4})$/); if(!m) return false; let h = 0; for(const ch of 'ivol-0.4-' + m[1]) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 1679616).toString(36).toUpperCase().padStart(4, '0') === m[2] && String((r.f && r.f.aantal) || '').trim() === m[1]; },
  honderd:v => Number(String(v).replace(',', '.')) === 100
};
const fieldOk = (f, r) => { const v = String(r.f[f.k] ?? '').trim(); return v !== '' && (!f.check || CHECKS[f.check](v, r)); };

/* ---------- wat de app zelf ziet ----------
   taak.js registreert per stap een functie die { c:{ index:true|false }, f:{ veld:waarde } } teruggeeft (of null als de
   gegevens er nog niet zijn). Een automatisch vinkje is niet aan te klikken; een automatisch veld geldt zolang Daan
   het leeg laat. Afgeronde stappen tonen wat er bij afronden is vastgelegd. */
function autoVan(id){
  if(isDone(id) || !B.auto[id]) return null;
  try{ return B.auto[id]() || null; }catch(e){ console.error(e); return null; }
}
function eff(id){
  const r = rec(id), a = autoVan(id);
  const c = Object.assign({}, r.c || {}), f = Object.assign({}, r.f || {}), autoC = new Set(), autoF = new Set();
  if(a){
    Object.entries(a.c || {}).forEach(([i, v]) => { c[i] = !!v; autoC.add(+i); });
    Object.entries(a.f || {}).forEach(([k, v]) => { if(String(f[k] ?? '').trim() === '' && v !== null && v !== undefined && v !== ''){ f[k] = String(v); autoF.add(k); } });
  }
  return Object.assign({}, r, { c, f, autoC, autoF, autoBekend:!!a });
}
function missing(s){ const r = eff(s.id); let mc = 0, mf = 0; s.checks.forEach((_, i) => { if(!r.c[i]) mc++; }); s.fields.forEach(f => { if(f.req && !fieldOk(f, r)) mf++; }); return { mc, mf }; }
const kanAf = id => { const s = BYID[id]; if(!s || !isNu(id)) return false; const m = missing(s); return !m.mc && !m.mf; };

/* ---------- opslaan en lezen ---------- */
function meld(){ B.luister.forEach(f => { try{ f(); }catch(e){ console.error(e); } }); }
function zetStatus(t){ B.status = t; document.querySelectorAll('[data-bp-status]').forEach(el => { el.textContent = t; }); }
function wijzig(fn, stil){
  fn(B.state); B.state.t = Date.now(); B.vuil = true; zetStatus('Opslaan…');
  clearTimeout(B.timer); B.timer = setTimeout(bewaar, 700);
  if(!stil) meld();
}
async function bewaar(){
  const t = B.state.t;
  try{
    await WH.catZet(KEY, B.state);
    B.bestaat = true; B.fout = null;
    if(B.state.t === t){ B.vuil = false; zetStatus('Opgeslagen ✓'); }
  }catch(e){
    B.fout = e; zetStatus('Opslaan mislukt');
    WH.toast('Bouwplan opslaan mislukt: ' + e.message, 6000);
  }
}
async function laad(){
  if(B.laden) return B.laden;
  B.laden = (async () => {
    try{
      const r = await WH.catHaal(KEY);
      if(r && r.data && r.data.s){
        const d = norm(r.data);
        B.bestaat = true;
        // nieuwer opgeslagen (bijv. op de iPhone) en hier niets onopgeslagen: de nieuwe stand tonen
        if(!B.vuil && d.t > B.state.t){ B.state = d; meld(); }
      } else if(B.bestaat === null){ B.bestaat = false; meld(); }
      B.fout = null;
    }catch(e){ B.fout = e; if(B.bestaat === null) meld(); }
    B.laden = null;
  })();
  return B.laden;
}
async function overnemen(){
  B.state = norm(JSON.parse(JSON.stringify(OVERNAME)));
  zetStatus('Opslaan…'); meld();
  clearTimeout(B.timer); B.vuil = true;
  await bewaar();
  meld();
}
setInterval(() => { if(document.visibilityState !== 'hidden') laad(); }, 2 * 60e3);

/* ---------- handelingen ---------- */
function vink(id, i){ const s = BYID[id]; if(!s || isDone(id) || eff(id).autoC.has(+i)) return; wijzig(st => { const r = mrec(id); r.c[i] = !r.c[i]; }); }
function veld(id, k, v){ if(isDone(id)) return; wijzig(() => { mrec(id).f[k] = v; }, true); }
function notitie(id, v){ wijzig(() => { mrec(id).note = v; }, true); }
function afronden(id){
  if(!kanAf(id)) return false;
  const e = eff(id);
  wijzig(() => { const r = mrec(id); r.c = Object.assign({}, e.c); r.f = Object.assign({}, e.f); r.done = new Date().toISOString(); r.hold = false; });
  return true;
}
function opWacht(id, reden){ if(isDone(id)) return; wijzig(() => { const r = mrec(id); r.hold = true; r.holdWhy = String(reden || '').trim(); r.holdAt = new Date().toISOString(); }); }
function hervat(id){ wijzig(() => { const r = mrec(id); r.hold = false; }); }
function heropen(){ const l = lastDoneIdx(); if(l < 0) return; const id = STEPS[l].id; wijzig(() => { mrec(id).done = null; }); return id; }
function parkeer(txt){ txt = String(txt || '').trim(); if(!txt) return; const h = huidig(); wijzig(st => { st.park.unshift({ at:h ? h.id : '', id:String(Date.now()), t:new Date().toISOString(), txt }); }); }
function parkeerWeg(pid){ wijzig(st => { st.park = st.park.filter(p => p.id !== pid); }); }
function zetInst(k, v){ wijzig(st => { st.inst[k] = v; }); }
const inst = k => B.state.inst[k];

/* ---------- kerncijfers: de nieuwste waarde uit de velden met kpi ---------- */
function kpiNu(k){
  let uit = null;
  STEPS.forEach(s => s.fields.forEach(f => {
    if(f.kpi !== k) return;
    const v = String(eff(s.id).f[f.k] ?? '').trim();
    if(v !== '' && (isDone(s.id) || isNu(s.id) || isHold(s.id))) uit = { v, stap:s.id, op:rec(s.id).done };
  }));
  return uit;
}

/* ---------- weergave ---------- */
const datum = iso => { if(!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('nl-NL', { day:'numeric', month:'short' }); };
const datumTijd = iso => { if(!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : datum(iso) + ' ' + d.toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit', hour12:false }); };
const pijler = s => (R.PILLARS[s.pillar] || {}).n || '';
function staatVan(s){
  if(isDone(s.id)) return { k:'af', t:'af ' + datum(rec(s.id).done) };
  if(isHold(s.id)) return { k:'wacht', t:'op wacht' };
  if(isNu(s.id)) return { k:'nu', t:'nu' };
  return { k:'dicht', t:'dicht' };
}
// stellingbalk: per fase een vak tussen twee blauwe staanders, per stap een oranje ligger (vol = af)
function stelling(){
  const af = STEPS.filter(s => isDone(s.id)).length;
  return `<div class="stelling" role="img" aria-label="${af} van ${STEPS.length} stappen af">
    ${R.PHASES.map(p => `<div class="vak" title="${esc(p.n)}"><div class="vakin">${p.steps.slice().reverse().map(s => `<i class="ligger ${staatVan(s).k}" title="${esc(s.id + ' ' + s.t)}"></i>`).join('')}</div><b>${esc(p.id.slice(1))}</b></div>`).join('')}
  </div><div class="klein muted">${nf(af)} van ${nf(STEPS.length)} stappen af</div>`;
}
const TABS = [['nu', 'Nu'], ['route', 'Route'], ['visie', 'Visie'], ['data', 'Data'], ['log', 'Logboek'], ['park', 'Parkeerplaats']];
function tabs(nu){
  return `<nav class="tabs" aria-label="Bouwplan">${TABS.map(([k, t]) => `<a href="#/bouwplan/${k}" class="${k === nu ? 'aan' : ''}"${k === nu ? ' aria-current="page"' : ''}>${esc(t)}${k === 'park' && B.state.park.length ? ` <i class="tel">${nf(B.state.park.length)}</i>` : ''}</a>`).join('')}</nav>`;
}
function kop(tab){
  return `<div class="bpkop"><h1>Bouwplan</h1><span class="bpstatus" data-bp-status>${esc(B.status)}</span></div>${stelling()}${tabs(tab)}`;
}
function viewOvernemen(){
  return `<div class="pagina"><h1>Bouwplan</h1>
    ${B.fout && B.bestaat === null ? `<div class="melding">Bouwplan lezen lukte niet: ${esc(B.fout.message || String(B.fout))}</div>` : ''}
    ${B.bestaat === null ? '<div class="leeg">Bouwplan laden…</div>' : `<section class="blok"><h2>Nog geen bouwplan in 3.0</h2>
      <p class="muted">Je bouwplan staat nog in het oude claude.ai-artifact. Eén keer overnemen; daarna werk je alleen hier.</p>
      <div class="rij"><button class="knop pri" data-a="bp-overnemen">Neem je bouwplan over (stand 15 okt)</button></div></section>`}
  </div>`;
}
function viewRoute(){
  return R.PHASES.map(p => `<section class="blok"><div class="fkop"><span class="fnr">${esc(p.id.slice(1))}</span><div><h2>${esc(p.n)}</h2><div class="klein muted">${esc((R.PILLARS[p.pillar] || {}).n || '')} · ${esc(p.goal)}</div></div></div>
    <ul class="stappen">${p.steps.map(s => { const st = staatVan(s), r = rec(s.id), m = st.k === 'af' ? null : missing(s);
      return `<li class="stap ${st.k}"><a href="#/taak/${esc(s.id)}"><span class="snr">${esc(s.id)}</span><span class="stt"><b>${esc(s.t)}</b>${st.k === 'wacht' && r.holdWhy ? `<span class="klein muted">${esc(r.holdWhy)}</span>` : st.k === 'nu' ? `<span class="klein muted">${nf(s.checks.length - m.mc)} van ${nf(s.checks.length)} vinkjes${s.fields.some(f => f.req) ? ' · ' + nf(m.mf) + ' velden open' : ''}</span>` : ''}</span><i class="sst ${st.k}">${st.k === 'dicht' ? '🔒 ' : ''}${esc(st.t)}</i></a></li>`; }).join('')}</ul></section>`).join('');
}
function viewVisie(){
  return `<section class="blok"><h2>Kerncijfers</h2><div class="tabel"><table><thead><tr><th>Wat</th><th>Start</th><th>Nu</th><th>Doel</th></tr></thead><tbody>
      ${R.KPIS.map(k => { const n = kpiNu(k.k); return `<tr><td>${esc(k.n)}</td><td>${k.s === null ? '–' : nf(k.s)}${k.sd ? ` <span class="muted klein">${esc(k.sd)}</span>` : ''}</td><td><b>${n ? esc(n.v) : '–'}</b>${n ? ` <span class="muted klein">stap ${esc(n.stap)}</span>` : ''}</td><td>${esc(k.d)}</td></tr>`; }).join('')}
    </tbody></table></div></section>
    <div class="fund">${Object.entries(R.PILLARS).map(([k, p]) => `<section class="fblok"><div class="fkop"><span class="fnr">${esc(k.slice(1))}</span><h2>${esc(p.n)}</h2></div><p>${esc(p.e)}</p><p class="klein muted"><b>Stand bij de start:</b> ${esc(p.nu)}</p></section>`).join('')}</div>
    <section class="blok"><h2>Spelregels</h2><ol class="stappen">${R.RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ol></section>`;
}
function viewData(){
  return R.DATA.map(g => `<section class="blok"><h2>${esc(g.g)}</h2><div class="tabel"><table><thead><tr><th>Gegeven</th><th>Eigenaar</th><th>Stap</th></tr></thead><tbody>
    ${g.rows.map(([n, e, s]) => `<tr><td>${esc(n)}</td><td>${esc(e)}</td><td><a href="#/taak/${esc(s)}">${esc(s)}</a></td></tr>`).join('')}</tbody></table></div></section>`).join('');
}
function viewLog(){
  const ev = [];
  STEPS.forEach(s => {
    const r = rec(s.id);
    if(r.done) ev.push({ t:r.done, s, w:'Afgerond' });
    if(r.hold && !r.done && r.holdAt) ev.push({ t:r.holdAt, s, w:'Op wacht', u:r.holdWhy });
    if(String(r.note || '').trim()) ev.push({ t:r.done || r.holdAt || '', s, w:'Notitie', u:r.note });
  });
  B.state.park.forEach(p => ev.push({ t:p.t, s:BYID[p.at], w:'Geparkeerd', u:p.txt }));
  ev.sort((a, b) => String(b.t).localeCompare(String(a.t)));
  return `<section class="blok"><h2>Logboek</h2>${ev.length ? `<ul class="log">${ev.map(e => `<li><span class="muted klein">${esc(datumTijd(e.t) || '–')}</span><b>${esc(e.w)}${e.s ? ` · <a href="#/taak/${esc(e.s.id)}">${esc(e.s.id)} ${esc(e.s.t)}</a>` : ''}</b>${e.u ? `<span class="note">${esc(e.u)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Nog niets gebeurd.</p>'}</section>`;
}
function viewPark(){
  const h = huidig();
  return `<section class="blok"><h2>Parkeerplaats</h2><p class="muted klein">Ideeën voor later. Niet nu bouwen: eerst de stap van nu.</p>
    <div class="veldrij"><textarea id="bp-park" rows="2" placeholder="Idee of vraag voor later"></textarea><button class="knop pri" data-a="bp-parkeer">Parkeer${h ? ' bij ' + esc(h.id) : ''}</button></div>
    ${B.state.park.length ? `<ul class="log">${B.state.park.map(p => `<li><span class="muted klein">${esc(datumTijd(p.t))}${p.at ? ' · bij ' + esc(p.at) : ''}</span><span class="note">${esc(p.txt)}</span><button class="knop klein" data-a="bp-parkweg" data-id="${esc(p.id)}" aria-label="Weg">×</button></li>`).join('')}</ul>` : '<p class="muted">Leeg.</p>'}</section>`;
}
// de bouwplanpagina (tabbladen); "Nu" is de takenpagina van de huidige stap (taak.js)
function view(rest){
  if(B.bestaat !== true) return viewOvernemen();
  const tab = TABS.some(t => t[0] === rest) ? rest : 'nu';
  if(tab === 'nu'){
    const h = huidig();
    return `<div class="pagina">${kop('nu')}${h ? (window.WHTAAK ? WHTAAK.inhoud(h.id) : '') : '<section class="blok"><h2>Alles af</h2><p>Het bouwplan is klaar.</p></section>'}</div>`;
  }
  return `<div class="pagina">${kop(tab)}${tab === 'route' ? viewRoute() : tab === 'visie' ? viewVisie() : tab === 'data' ? viewData() : tab === 'log' ? viewLog() : viewPark()}</div>`;
}

laad();
return { R, STEPS, BYID, B, laad, overnemen, rec, eff, isDone, isHold, isNu, curIdx, huidig, lastDoneIdx, nextOpen, holdList, missing, fieldOk, kanAf, CHECKS,
  vink, veld, notitie, afronden, opWacht, hervat, heropen, parkeer, parkeerWeg, zetInst, inst, kpiNu, staatVan, pijler, datum, datumTijd, view, kop,
  opNieuw:f => B.luister.push(f), registreer:(id, fn) => { B.auto[id] = fn; } };
})();
