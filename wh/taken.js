/* =====================================================================
   IVOL Warehouse — Taken op Vandaag (7-10-2026)
   Daan en Karin zetten taken neer en verdelen ze over Daan, Karin, Kate, Sala en Valerii.
   Alleen zichtbaar in IVOL Warehouse (en Test), niet in Junior.
   Opslag: catalog-rij wh-todo = { <id>: taak }, per taak samengevoegd (iPhone en Mac tegelijk kan).
   taak = { id, titel, noot, wie:[namen], datum:'jjjj-mm-dd', tijd:'uu:mm'|'', herhaal:'week'|null, prio:1|2|3, door, op, klaar:{op,door}|null }
   Herhaal 'week': bij afvinken komt dezelfde taak een week later terug (zelfde weekdag en tijd).
   ===================================================================== */
window.WHTAAK = (function(){
'use strict';
const { $, esc, D, isoDag, fdate, toast } = WH;
const MENSEN = ['Daan', 'Karin', 'Kate', 'Sala', 'Valerii'];
const PRIO = { 1:'Moet vandaag', 2:'Belangrijk', 3:'Als er tijd is' };
const UI = { form:false, bewerk:null, wie:[], datum:'', prio:2, herhaal:null, toonKlaar:false, toonLater:false };
const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const weekdag = d => DAGEN[new Date(d + 'T12:00:00').getDay()] || '';
const plusDagen = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return isoDag(x.getTime()); };
let HERTEKEN = () => {};

const ls = (k, v) => { try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } };
const ik = () => MENSEN.includes(ls('ivol-ik')) ? ls('ivol-ik') : 'Daan';
const filter = () => { const f = ls('ivol-taak-filter'); return MENSEN.includes(f) ? f : ''; };
const alle = () => Object.values(D.TODO || {}).filter(t => t && t.id && t.titel);
const sorteer = (a, b) => (a.prio || 2) - (b.prio || 2) || String(a.datum).localeCompare(String(b.datum)) || String(a.op).localeCompare(String(b.op));
const voor = (t, f) => !f || (t.wie || []).includes(f);
const dagTxt = d => d === isoDag() ? 'vandaag' : d === isoDag(Date.now() + 864e5) ? 'morgen' : d === isoDag(Date.now() - 864e5) ? 'gisteren' : fdate(d);

async function bewaar(id, taak){
  if(taak) D.TODO = Object.assign({}, D.TODO, { [id]:taak }); else { const n = Object.assign({}, D.TODO); delete n[id]; D.TODO = n; }
  HERTEKEN();
  try{ await WH.catPatch('wh-todo', { [id]:taak || null }); }catch(e){ /* melding al getoond */ }
  HERTEKEN();
}
// afgevinkte taken ouder dan 30 dagen opruimen (houdt de rij klein)
function opruimen(){
  const grens = new Date(Date.now() - 30 * 864e5).toISOString();
  const weg = alle().filter(t => t.klaar && t.klaar.op && t.klaar.op < grens);
  if(weg.length) WH.catPatch('wh-todo', Object.fromEntries(weg.map(t => [t.id, null]))).catch(() => {});
}

function taakRegel(t, vd){
  const laat = !t.klaar && t.datum < vd;
  return `<div class="task ${t.klaar ? 'klaar' : ''}">
    <button class="chk" data-tk="klaar" data-id="${esc(t.id)}" aria-label="klaar">${t.klaar ? '✓' : ''}</button>
    <div class="grow"><div class="tt"><span class="prio p${t.prio || 2}" title="${esc(PRIO[t.prio || 2])}"></span>${esc(t.titel)}</div>
      ${t.noot ? `<div class="td">${esc(t.noot)}</div>` : ''}
      ${t.herhaal === 'week' || t.tijd ? `<div class="td">${t.herhaal === 'week' ? 'elke ' + esc(weekdag(t.datum)) : ''}${t.herhaal === 'week' && t.tijd ? ' · ' : ''}${t.tijd ? esc(t.tijd) : ''}</div>` : ''}
      <div class="td">${laat ? `<span style="color:var(--bad);font-weight:700">te laat, sinds ${esc(dagTxt(t.datum))}</span> · ` : t.datum !== vd && !t.klaar ? esc(dagTxt(t.datum)) + ' · ' : ''}${t.klaar ? 'gedaan ' + esc(new Date(t.klaar.op).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' })) + (t.klaar.door ? ' (' + esc(t.klaar.door) + ')' : '') + ' · ' : ''}<span class="small">gezet door ${esc(t.door || '?')}</span></div>
      <div class="wie mt4">${(t.wie || []).map(esc).join(' · ') || 'niemand'}</div></div>
    <div class="noprint" style="white-space:nowrap"><button class="btn sm ghost" data-tk="bewerk" data-id="${esc(t.id)}">✎</button><button class="btn sm ghost" data-tk="weg" data-id="${esc(t.id)}" title="verwijderen">✕</button></div></div>`;
}
function formHtml(){
  const t = UI.bewerk ? D.TODO[UI.bewerk] : null;
  const wie = UI.wie, datum = UI.datum || isoDag(), prio = UI.prio;
  return `<div class="takenform noprint" style="background:var(--soft);border-radius:10px;padding:12px;margin-top:10px">
    <input id="tk-titel" placeholder="Wat moet er gebeuren?" value="${esc(t ? t.titel : '')}" style="font-size:15px">
    <textarea id="tk-noot" rows="2" class="mt8" placeholder="Toelichting (optioneel)">${esc(t ? t.noot || '' : '')}</textarea>
    <div class="row wrap mt8"><span class="small muted">Voor</span>${MENSEN.map(m => `<button class="btn sm ${wie.includes(m) ? 'pri' : ''}" data-tk="wie" data-m="${m}">${m}</button>`).join('')}</div>
    <div class="row wrap mt8"><span class="small muted">Wanneer</span><input id="tk-datum" type="date" value="${esc(datum)}" style="width:auto">
      <button class="btn sm" data-tk="dag" data-d="0">vandaag</button><button class="btn sm" data-tk="dag" data-d="1">morgen</button>
      <span class="small muted">om</span><input id="tk-tijd" type="time" value="${esc(UI.concept && UI.concept.tijd !== undefined ? UI.concept.tijd : (t ? t.tijd || '' : ''))}" style="width:auto"></div>
    <div class="row wrap mt8"><span class="small muted">Herhalen</span><button class="btn sm ${!UI.herhaal ? 'pri' : ''}" data-tk="herh" data-h="">Eenmalig</button><button class="btn sm ${UI.herhaal === 'week' ? 'pri' : ''}" data-tk="herh" data-h="week">Elke week op ${esc(weekdag(datum))}</button></div>
    <div class="row wrap mt8"><span class="small muted">Prioriteit</span>${[1, 2, 3].map(p => `<button class="btn sm ${prio === p ? 'pri' : ''}" data-tk="prio" data-p="${p}"><span class="prio p${p}"></span>${PRIO[p]}</button>`).join('')}</div>
    <div class="row wrap mt12"><button class="btn ok" data-tk="opslaan">${t ? 'Opslaan' : 'Taak toevoegen'}</button><button class="btn" data-tk="annuleer">Annuleren</button>
      <span class="small muted right">gezet door <select id="tk-ik" style="width:auto">${['Daan', 'Karin'].map(m => `<option ${ik() === m ? 'selected' : ''}>${m}</option>`).join('')}</select></span></div></div>`;
}
function kaart(){
  const vd = isoDag(), f = filter();
  const lijst = alle();
  const nu = lijst.filter(t => !t.klaar && t.datum <= vd && voor(t, f)).sort(sorteer);
  const klaar = lijst.filter(t => t.klaar && isoDag(t.klaar.op) === vd && voor(t, f)).sort((a, b) => String(b.klaar.op).localeCompare(String(a.klaar.op)));
  const later = lijst.filter(t => !t.klaar && t.datum > vd && voor(t, f)).sort((a, b) => String(a.datum).localeCompare(String(b.datum)) || sorteer(a, b));
  const telOpen = m => lijst.filter(t => !t.klaar && t.datum <= vd && voor(t, m)).length;
  return `<div class="card takenkaart" id="taken"><div class="row wrap between"><div><h3>Taken vandaag</h3>
      <div class="small muted">${nu.length ? nu.length + ' open' : 'Niets open'}${klaar.length ? ' · ' + klaar.length + ' gedaan' : ''}${later.length ? ' · ' + later.length + ' gepland' : ''}</div></div>
      <div class="row noprint">${nu.length ? '<button class="btn sm" data-tk="print">Print</button>' : ''}<button class="btn sm pri" data-tk="nieuw">+ Taak</button></div></div>
    <div class="row wrap mt8 noprint"><button class="btn sm ${!f ? 'pri' : ''}" data-tk="filter" data-m="">Iedereen</button>${MENSEN.map(m => `<button class="btn sm ${f === m ? 'pri' : ''}" data-tk="filter" data-m="${m}">${m}${telOpen(m) ? ` <span class="badge b-grey">${telOpen(m)}</span>` : ''}</button>`).join('')}</div>
    ${UI.form ? formHtml() : ''}
    <div class="printonly pkop"><b>Taken ${esc(fdate(vd))}${f ? ' · ' + esc(f) : ''}</b><span>IVOL Warehouse</span></div>
    <div class="mt8">${nu.map(t => taakRegel(t, vd)).join('') || '<div class="small muted">Geen open taken' + (f ? ' voor ' + esc(f) : '') + '.</div>'}</div>
    ${klaar.length ? `<details class="mt8 noprint" ${UI.toonKlaar ? 'open' : ''} data-tk-det="klaar"><summary>Gedaan vandaag (${klaar.length})</summary>${klaar.map(t => taakRegel(t, vd)).join('')}</details>` : ''}
    ${later.length ? `<details class="mt8 noprint" ${UI.toonLater ? 'open' : ''} data-tk-det="later"><summary>Gepland (${later.length})</summary>${later.map(t => taakRegel(t, vd)).join('')}</details>` : ''}</div>`;
}
function leesForm(){
  return { titel:($('tk-titel') || {}).value || '', noot:($('tk-noot') || {}).value || '', datum:($('tk-datum') || {}).value || isoDag(), tijd:($('tk-tijd') || {}).value || '' };
}

document.addEventListener('click', async ev => {
  const b = ev.target.closest && ev.target.closest('[data-tk]'); if(!b) return;
  const a = b.dataset.tk, id = b.dataset.id;
  if(a === 'nieuw'){ UI.form = true; UI.bewerk = null; UI.wie = filter() ? [filter()] : []; UI.datum = isoDag(); UI.prio = 2; UI.herhaal = null; UI.concept = null; HERTEKEN(); const i = $('tk-titel'); if(i) i.focus(); return; }
  if(a === 'annuleer'){ UI.form = false; UI.bewerk = null; HERTEKEN(); return; }
  if(a === 'wie' || a === 'dag' || a === 'prio' || a === 'herh'){
    const f = leesForm();
    if(a === 'wie'){ const m = b.dataset.m; UI.wie = UI.wie.includes(m) ? UI.wie.filter(x => x !== m) : UI.wie.concat(m); }
    if(a === 'dag') f.datum = isoDag(Date.now() + (+b.dataset.d) * 864e5);
    if(a === 'prio') UI.prio = +b.dataset.p;
    if(a === 'herh') UI.herhaal = b.dataset.h || null;
    UI.datum = f.datum; UI.concept = f;
    HERTEKEN();
    if($('tk-titel')){ $('tk-titel').value = f.titel; $('tk-noot').value = f.noot; }
    return;
  }
  if(a === 'opslaan'){
    const f = leesForm(); const titel = f.titel.trim();
    if(!titel){ toast('Vul in wat er moet gebeuren'); return; }
    if(!UI.wie.length){ toast('Kies voor wie'); return; }
    const sel = $('tk-ik'); if(sel) ls('ivol-ik', sel.value);
    const oud = UI.bewerk ? D.TODO[UI.bewerk] : null;
    const nid = oud ? oud.id : 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const taak = Object.assign({}, oud || {}, { id:nid, titel, noot:f.noot.trim(), wie:UI.wie.slice(), datum:f.datum || isoDag(), tijd:f.tijd || '', herhaal:UI.herhaal || null, prio:UI.prio,
      door:oud ? oud.door : ik(), op:oud ? oud.op : new Date().toISOString(), klaar:oud ? oud.klaar || null : null });
    if(oud) taak.gewijzigd = { op:new Date().toISOString(), door:ik() };
    UI.form = false; UI.bewerk = null; UI.concept = null;
    await bewaar(nid, taak);
    toast(oud ? 'Taak opgeslagen' : 'Taak toegevoegd');
    opruimen();
    return;
  }
  if(a === 'klaar'){
    const t = D.TODO[id]; if(!t) return;
    if(t.herhaal === 'week' && !t.klaar){
      // volgende keer: zelfde weekdag, eerste datum na vandaag
      let d = plusDagen(t.datum, 7); while(d <= isoDag()) d = plusDagen(d, 7);
      const nid = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const volg = Object.assign({}, t, { id:nid, datum:d, klaar:null, op:new Date().toISOString(), volgende:null, gewijzigd:undefined });
      await bewaar(nid, volg);
      await bewaar(id, Object.assign({}, t, { klaar:{ op:new Date().toISOString(), door:ik() }, volgende:nid }));
      toast('Gedaan. Volgende keer: ' + dagTxt(d));
      return;
    }
    if(t.klaar && t.volgende && D.TODO[t.volgende] && !D.TODO[t.volgende].klaar) await bewaar(t.volgende, null);   // afvinken ongedaan: herhaling terugdraaien
    await bewaar(id, Object.assign({}, t, { klaar:t.klaar ? null : { op:new Date().toISOString(), door:ik() }, volgende:null }));
    return;
  }
  if(a === 'bewerk'){
    const t = D.TODO[id]; if(!t) return;
    UI.form = true; UI.bewerk = id; UI.wie = (t.wie || []).slice(); UI.datum = t.datum; UI.prio = t.prio || 2; UI.herhaal = t.herhaal || null; UI.concept = null;
    HERTEKEN(); const k = document.querySelector('.takenform'); if(k) k.scrollIntoView({ block:'nearest' });
    return;
  }
  if(a === 'weg'){
    const t = D.TODO[id]; if(!t) return;
    b.dataset.tk = 'wegzeker'; b.textContent = 'zeker?'; b.classList.add('acc'); setTimeout(() => { if(b.isConnected){ b.dataset.tk = 'weg'; b.textContent = '✕'; b.classList.remove('acc'); } }, 4000);
    return;
  }
  if(a === 'wegzeker'){ await bewaar(id, null); toast('Taak verwijderd'); return; }
  if(a === 'filter'){ ls('ivol-taak-filter', b.dataset.m || ''); HERTEKEN(); return; }
  if(a === 'print'){
    const oud = document.title, f = filter();
    document.title = 'Taken ' + isoDag() + (f ? ' ' + f : '');
    document.body.classList.add('printtaken'); window.print();
    setTimeout(() => { document.body.classList.remove('printtaken'); document.title = oud; }, 500);
  }
});
document.addEventListener('toggle', ev => {
  const d = ev.target; if(!d || !d.dataset || !d.dataset.tkDet) return;
  if(d.dataset.tkDet === 'klaar') UI.toonKlaar = d.open; else UI.toonLater = d.open;
}, true);
const st = document.createElement('style');
st.textContent = '@media print{body.printtaken #app>*:not(.takenkaart){display:none !important} body.printtaken .takenkaart .noprint{display:none !important} body.printtaken .takenkaart .chk{display:inline-block !important}}';
document.head.appendChild(st);

return { kaart, opHerteken:f => { HERTEKEN = f; }, formOpen:() => UI.form, MENSEN };
})();
