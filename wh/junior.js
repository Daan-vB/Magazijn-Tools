/* =====================================================================
   IVOL Warehouse Junior — de uitvoerende versie voor het magazijn
   Zelfde database en berekening als IVOL Warehouse (wh/core.js, wh/logica.js),
   alleen: Vandaag, Aanvullen (Nu verplaatsen + Aanvulronde), Containers, Palletlabels.
   Afvinken gebruikt dezelfde sleutels als de grote app (wh-taken: mv:/rd:<datum>:<code>),
   dus Daan ziet wat hier is gedaan en andersom.
   ===================================================================== */
(function(){
'use strict';
const { $, esc, num, nf, D, vandaag, isoDag, toast } = WH;
const app = $('app');
const UI = { gangNu:'', gangRonde:'', cont:null, contTijd:0 };

/* ---------- taal ---------- */
const TALEN = ['nl', 'en', 'es', 'el'];
let taal = 'nl';
try{ const s = localStorage.getItem('junior-taal'); if(TALEN.includes(s)) taal = s; else { const b = (navigator.language || '').slice(0, 2); if(TALEN.includes(b)) taal = b; } }catch(e){}
function t(k, v){
  let s = (JT[taal] && JT[taal][k] !== undefined) ? JT[taal][k] : (JT.nl[k] !== undefined ? JT.nl[k] : k);
  if(typeof s !== 'string') return s;
  if(v && v.n !== undefined && s.includes('|')){ const [een, meer] = s.split('|'); s = Number(v.n) === 1 ? een : meer; }
  else if(s.includes('|')) s = s.split('|')[1];
  return s.replace(/\{(\w+)\}/g, (m, x) => v && v[x] !== undefined ? v[x] : m);
}
const loc = () => JT[taal].loc;
const hoofdletter = s => s.charAt(0).toLocaleUpperCase(loc()) + s.slice(1);
const datum = (d, opt) => {
  if(!d) return '';
  const dt = new Date(String(d).length <= 10 ? d + 'T12:00:00' : d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString(loc(), opt || { weekday:'short', day:'numeric', month:'short' });
};
const tijd = d => new Date(d).toLocaleTimeString(loc(), { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
const wanneer = iso => { if(!iso) return t('nietIngeladen'); return isoDag(iso) === vandaag() ? t('vandaagOm', { x:tijd(iso) }) : datum(iso, { day:'numeric', month:'short' }) + ' ' + tijd(iso); };
function zetTaal(tl){
  taal = tl;
  try{ localStorage.setItem('junior-taal', tl); }catch(e){}
  document.documentElement.lang = tl;
  kop(); route();
}

/* ---------- kop en navigatie ---------- */
function kop(){
  document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
  document.querySelectorAll('#talen button').forEach(b => b.classList.toggle('on', b.dataset.taal === taal));
  document.querySelectorAll('.ico[data-a="vernieuw"]').forEach(b => b.title = t('vernieuw'));
  syncTekst();
}
let syncStand = 'laden';
function syncTekst(){
  const s = $('jsync'); if(!s) return;
  s.textContent = t('sync.' + syncStand);
  s.className = 'sync ' + (syncStand === 'ok' ? 'ok' : syncStand === 'fout' ? 'err' : '');
}
async function laden(){
  syncStand = 'laden'; syncTekst();
  const ok = await WH.load();
  syncStand = ok ? 'ok' : 'fout'; syncTekst();
  UI.cont = null;
  return ok;
}

/* ---------- bouwstenen ---------- */
const tik = k => !!D.TAKEN[k];
const tikKnop = k => `<button class="chk" data-a="tik" data-k="${esc(k)}" aria-label="✓">${tik(k) ? '✓' : ''}</button>`;
const locBadge = l => { const s = WHL.soortLoc(l); return `<span class="badge ${s === 'pick' ? 'b-pick' : s === 'bulk' ? 'b-bulk' : s === 'container' ? 'b-warn' : 'b-grey'}"><span class="loc">${esc(l)}</span></span>`; };
const locs = arr => (arr || []).map(locBadge).join(' ');
const boDatum = () => D.BO.reduce((m, r) => r.geimporteerd_op && (!m || r.geimporteerd_op > m) ? r.geimporteerd_op : m, null);
const advDatum = () => D.ADV ? (D.ADV.ingelezen || D.ADV.datum) : null;
const lijstOud = () => { const b = boDatum(); return !b || isoDag(b) !== vandaag(); };
function lijsten(){
  const C = WHL.bereken();
  const uit = new Set(C.uitzetten.map(r => r.code));           // hoort niet in het advies (Daan ruimt op)
  const vstSet = new Set(C.vst.map(v => v.code));
  return { C, mv:C.mv, ronde:C.ronde.filter(r => !uit.has(r.code)), vstSet };
}

/* ---------- routering ---------- */
function route(){
  const h = (location.hash || '#/').slice(2).split('/');
  const naam = h[0] || 'vandaag';
  document.querySelectorAll('#nav a[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === naam));
  if(D.fout){ app.innerHTML = `<div class="card"><h2>${esc(t('geenVerb'))}</h2><p class="mt8">${esc(t('geenVerbTekst'))}</p><p class="small muted mt8">${esc(D.fout.message || '')}</p></div>`; return; }
  try{
    if(naam === 'aanvullen') return viewAanvullen(h[1] === 'ronde' ? 'ronde' : 'nu');
    if(naam === 'containers') return viewContainers();
    return viewVandaag();
  }catch(e){
    console.error(e);
    app.innerHTML = `<div class="card"><h2>${esc(t('misScherm'))}</h2><pre class="mono mt8">${esc(e.stack || e.message)}</pre></div>`;
  }
}
const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };

/* ---------- Vandaag ---------- */
function viewVandaag(){
  const vd = vandaag();
  const { mv, ronde } = lijsten();
  const mvOpen = mv.filter(m => !tik('mv:' + vd + ':' + m.code)).length;
  const nOrders = new Set(mv.flatMap(m => m.orders)).size;
  const rondeOpen = ronde.filter(r => !tik('rd:' + vd + ':' + r.code)).length;
  const cs = D.CONT.filter(c => c.status !== 'afgerond').sort(contSort);
  const vc = cs.find(c => c.losdatum && c.losdatum >= vd) || cs[0];
  const d = new Date();
  app.innerHTML = `
  <div class="card"><h2 class="dag">${esc(hoofdletter(d.toLocaleDateString(loc(), { weekday:'long', day:'numeric', month:'long' })))}</h2>
    <div class="small muted">${esc(t('lijstVan', { b:wanneer(boDatum()), a:wanneer(advDatum()) }))}</div>
    ${lijstOud() ? `<div class="reason mt8">${esc(t('oud'))} <a href="#/aanvullen">${esc(t('oudKnop'))}</a></div>` : ''}</div>
  <div class="tiles">
    <a class="tile ${mvOpen ? 't-bad' : 't-ok'}" href="#/aanvullen/nu"><div class="lbl">${esc(t('tegel.nu'))}</div><div class="big">${nf(mvOpen)}</div><div class="sub">${esc(t('ordersWacht', { n:nf(nOrders) }))}</div></a>
    <a class="tile ${rondeOpen ? 't-warn' : 't-ok'}" href="#/aanvullen/ronde"><div class="lbl">${esc(t('tegel.ronde'))}</div><div class="big">${nf(rondeOpen)}</div><div class="sub">${esc(t('tegel.rondeSub'))}</div></a>
    <a class="tile t-info" href="#/containers"><div class="lbl">${esc(t('tegel.cont'))}</div><div class="big">${nf(cs.length)}</div><div class="sub">${esc(vc ? t('volgende', { x:contKort(vc) + (vc.losdatum ? ' · ' + dagTekst(vc.losdatum) : '') }) : t('geenGepland'))}</div></a>
    <a class="tile t-vst" href="./" target="_blank" rel="noopener"><div class="lbl">${esc(t('tegel.labels'))} ↗</div><div class="big">▦</div><div class="sub">${esc(t('tegel.labelsSub'))}</div></a>
  </div>`;
}

/* ---------- Aanvullen ---------- */
function uitlegOpen(){ try{ return localStorage.getItem('junior-uitleg') !== 'dicht'; }catch(e){ return true; } }
function viewAanvullen(tab){
  const vd = vandaag();
  const L = lijsten();
  const nNu = L.mv.filter(m => !tik('mv:' + vd + ':' + m.code)).length;
  const nRonde = L.ronde.filter(r => !tik('rd:' + vd + ':' + r.code)).length;
  const kopHtml = `
  <div class="card noprint"><div class="row wrap between"><h3>${esc(t('vernieuwTitel'))}</h3><span class="small muted">${esc(t('lijstVan', { b:wanneer(boDatum()), a:wanneer(advDatum()) }))}</span></div>
    ${lijstOud() ? `<div class="reason mt8">${esc(t('oud'))}</div>` : ''}
    <label class="drop mt8" id="drop"><input type="file" id="files" multiple accept=".xlsx,.xls,.csv,.pdf" hidden><b>${esc(t('dropTekst'))}</b></label>
    <div id="impst" class="status"></div></div>
  <details class="card noprint" id="uitleg" ${uitlegOpen() ? 'open' : ''}><summary>${esc(t('uitlegTitel'))}</summary>
    <ol class="uitleg">${t('uitleg').map(s => `<li>${s}</li>`).join('')}</ol></details>
  <div class="tabs noprint">
    <a class="tab ${tab === 'nu' ? 'on' : ''} ${nNu ? 'hot' : ''}" href="#/aanvullen/nu">${esc(t('tegel.nu'))} <span class="nr">${nf(nNu)}</span></a>
    <a class="tab ${tab === 'ronde' ? 'on' : ''}" href="#/aanvullen/ronde">${esc(t('tegel.ronde'))} <span class="nr">${nf(nRonde)}</span></a>
  </div>`;
  app.innerHTML = kopHtml + (tab === 'ronde' ? tabRonde(L, vd) : tabNu(L, vd));
  koppelDrop();
  const u = $('uitleg'); if(u) u.addEventListener('toggle', () => { try{ localStorage.setItem('junior-uitleg', u.open ? 'open' : 'dicht'); }catch(e){} });
}
function gangFilter(items, sel, w){
  const g = [...new Set(items.map(x => x.gang).filter(Boolean))].sort();
  if(g.length < 2) return '';
  return `<div class="filters mb8 noprint"><span class="small muted">${esc(t('gang'))}</span> <button class="btn sm ${!sel ? 'pri' : ''}" data-a="gang" data-w="${w}" data-v="">${esc(t('alle'))}</button>${g.map(x => `<button class="btn sm ${sel === x ? 'pri' : ''}" data-a="gang" data-w="${w}" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
}
function tabNu(L, vd){
  if(!L.mv.length) return `<div class="card empty">${esc(t('leegNu'))}</div>`;
  const lijst = L.mv.filter(m => !UI.gangNu || m.gang === UI.gangNu);
  const open = lijst.filter(m => !tik('mv:' + vd + ':' + m.code)).length;
  return `<div class="card"><div class="row wrap between"><div><h2>${esc(t('tegel.nu'))}</h2><div class="small muted">${esc(t('introNu'))}</div></div>
      <div class="row"><span class="badge b-bad">${esc(t('open', { n:open }))}</span><button class="btn sm noprint" data-a="print">${esc(t('print'))}</button></div></div>
    <div class="mt12">${gangFilter(L.mv, UI.gangNu, 'nu')}</div>
    ${lijst.map(m => mvHtml(m, vd)).join('')}
    <div class="reason mt12">${t('klaarNu')}</div></div>`;
}
function mvHtml(m, vd){
  const k = 'mv:' + vd + ':' + m.code;
  const naar = m.naar ? locs(m.naar) : `<span class="badge b-warn">${esc(t('geenLoc'))}</span>` + (m.voorstelPick ? ` <span class="small muted">${esc(t('ofNieuw'))}</span> ${locBadge(m.voorstelPick)}` : '');
  const retour = m.soort === 'retour' ? ' · ' + esc(t('retourkar', { x:(m.van || []).join(', ') })) : '';
  return `<div class="mv ${tik(k) ? 'klaar' : ''}">
    <div>${tikKnop(k)}</div>
    <div><div><span class="code">${esc(m.code)}</span> <span class="desc">${esc(m.naam || '')}</span></div>
      <div class="route">${locs(m.van) || `<span class="badge b-grey">${esc(t('bulkOnb'))}</span>`}<span class="pijl">→</span>${naar}</div>
      <div class="meta">${esc(t('orders', { n:m.orders.length }))} ${esc(t('sinds', { x:datum(m.datum, { day:'numeric', month:'short' }) }))}${m.pickst !== null && m.pickst !== undefined ? ' · ' + esc(t('pickvrd', { n:nf(m.pickst) })) : ''}${m.advAantal ? ' · ' + esc(t('pqAdv', { n:nf(m.advAantal) })) : ''}${retour}</div>
    </div>
    <div class="aant">${nf(m.stuks)}<small>${esc(t('voorOrders'))}</small></div>
  </div>`;
}
function tabRonde(L, vd){
  if(!D.ADV || !L.ronde.length) return `<div class="card empty">${esc(t('leegRonde'))}</div>`;
  const lijst = L.ronde.filter(r => !UI.gangRonde || r.gang === UI.gangRonde);
  let vorige = null, html = '';
  lijst.forEach(r => {
    if(r.gang !== vorige){
      const n = lijst.filter(x => x.gang === r.gang);
      html += `<div class="gangkop"><b>${esc(t('gang'))} ${esc(r.gang)}</b><span class="small muted">${esc(t('openVan', { a:n.filter(x => !tik('rd:' + vd + ':' + x.code)).length, b:n.length }))}</span></div>`;
      vorige = r.gang;
    }
    const k = 'rd:' + vd + ':' + r.code;
    html += `<div class="mv ${tik(k) ? 'klaar' : ''}">
      <div>${tikKnop(k)}</div>
      <div><div><span class="code">${esc(r.code)}</span> <span class="desc">${esc(r.naam || (r.pr && r.pr.naam) || '')}</span></div>
        <div class="route">${locs(r.bulk)}<span class="pijl">→</span>${r.geenPick ? `<span class="badge b-warn">${esc(t('geenPick'))}</span>` : locs(r.pick)}</div>
        <div class="meta">${esc(t('pickvrd', { n:nf(r.pickst) }))}</div>
        ${L.vstSet.has(r.code) ? `<div class="meta"><span class="badge b-vst">VST</span> ${esc(t('wachtVst'))}</div>` : ''}
      </div>
      <div class="aant">${nf(r.aantal)}<small>${esc(t('advies'))}</small></div></div>`;
  });
  const open = lijst.filter(r => !tik('rd:' + vd + ':' + r.code)).length;
  return `<div class="card"><div class="row wrap between"><div><h2>${esc(t('tegel.ronde'))}</h2><div class="small muted">${esc(t('introRonde'))}</div></div>
      <div class="row"><span class="badge b-warn">${esc(t('open', { n:open }))}</span><button class="btn sm noprint" data-a="print">${esc(t('print'))}</button></div></div>
    <div class="mt12">${gangFilter(L.ronde, UI.gangRonde, 'ronde')}</div>${html}</div>`;
}

/* ---------- lijst vernieuwen: alleen backorders + aanvuladvies ---------- */
function koppelDrop(){
  const inp = $('files'), drop = $('drop'); if(!inp || !drop) return;
  inp.onchange = () => { if(inp.files.length) inlezen([...inp.files]); inp.value = ''; };
  ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', ev => { const f = [...(ev.dataTransfer.files || [])]; if(f.length) inlezen(f); });
}
async function inlezen(files){
  const log = [];
  const zet = (m, cls) => { const s = $('impst'); if(!s) return; s.innerHTML = log.concat(m ? [esc(m)] : []).join('<br>'); s.className = 'status ' + (cls || ''); };
  // backorders eerst, dan advies
  const werk = [];
  for(const f of files){
    if(/\.pdf$/i.test(f.name)){ werk.push({ f, s:'advies' }); continue; }
    try{ const arr = await WH.leesSheet(f); werk.push({ f, s:WH.soortVan(arr[0] || []), arr }); }
    catch(e){ werk.push({ f, s:null }); }
  }
  werk.sort((a, b) => (a.s === 'backorders' ? 0 : 1) - (b.s === 'backorders' ? 0 : 1));
  let iets = false;
  for(const x of werk){
    try{
      if(x.s === 'backorders'){
        zet(t('bezig', { x:x.f.name }));
        const msg = await WH.impBackorders(x.arr, () => {});
        log.push(esc(t('okBo', { n:((msg.match(/\((\d+) orders?\)/) || [])[1] || '?') })));
        iets = true;
      } else if(x.s === 'advies'){
        zet(t('bezig', { x:x.f.name }));
        const msg = await WH.impAdvies(x.f);
        log.push(esc(t('okAdv', { n:(msg.match(/^\d+/) || [''])[0] })));
        iets = true;
      } else log.push(esc(t('nietNodig', { x:x.f.name })));
    }catch(e){ log.push('✗ ' + esc(x.f.name) + ': ' + esc(e.message)); }
  }
  if(iets){ zet(t('sync.laden')); await laden(); }
  route();
  const s = $('impst');
  if(s){ s.innerHTML = log.join('<br>'); s.className = 'status ' + (log.some(l => l.startsWith('✗')) ? 'err' : 'ok'); }
  if(iets) toast(t('bijgewerkt'));
}

/* ---------- Containers ---------- */
function contSort(a, b){ return String(a.losdatum || '9999').localeCompare(String(b.losdatum || '9999')) || String(a.lostijd || '').localeCompare(String(b.lostijd || '')) || a.id - b.id; }
const contKort = c => String(c.leverancier || '').split(/[\s,.(]/)[0] + (c.pakbon_ref ? ' ' + c.pakbon_ref : '');
function dagTekst(d){
  if(d === vandaag()) return t('vandaag');
  if(d === isoDag(Date.now() + 864e5)) return t('morgen');
  return datum(d, { weekday:'short', day:'numeric', month:'short' });
}
async function haalContainers(){
  const r = await WH.api('GET', 'containers?select=id,leverancier,pakbon_ref,containernummer,losdatum,lostijd,transporteur,status,verwacht:data->verwacht,pakbon:data->pakbon_bestand,pdf:data->magazijn_pdf&order=losdatum');
  UI.cont = (r || []).filter(c => c.status !== 'afgerond').sort(contSort);
  UI.contTijd = Date.now();
}
function viewContainers(){
  if(!UI.cont || Date.now() - UI.contTijd > 60000){
    if(!UI.cont) app.innerHTML = `<div class="card empty">${esc(t('sync.laden'))}</div>`;
    haalContainers().then(() => { if(/^#\/containers/.test(location.hash)) viewContainers(); }).catch(e => { app.innerHTML = `<div class="card"><h2>${esc(t('geenVerb'))}</h2><p class="small muted mt8">${esc(e.message)}</p></div>`; });
    if(!UI.cont) return;
  }
  const kaart = c => {
    const ver = !!c.verwacht;
    const wanneerTxt = c.losdatum ? `<span class="badge ${ver ? 'b-grey' : c.losdatum <= vandaag() ? 'b-bad' : 'b-info'}">${esc(ver ? t('eta') : t('lossen'))}</span> <b>${esc(dagTekst(c.losdatum))}</b>${c.lostijd && !ver ? ' ' + esc(String(c.lostijd).slice(0, 5)) : ''}` : `<span class="badge b-grey">${esc(t('geenDatum'))}</span>`;
    return `<div class="card cont ${c.losdatum && c.losdatum <= vandaag() && !ver ? 'nu' : ''}">
      <div class="row wrap between"><div><h3>${esc(contKort(c))}</h3><div class="small muted">${esc([c.containernummer, c.transporteur].filter(Boolean).join(' · '))}</div></div>
        <div class="right-t"><div>${wanneerTxt}</div><div class="small muted mt4">${esc(t('st.' + (c.status || 'concept')))}</div></div></div>
      <div class="row wrap mt12">
        ${c.pakbon && c.pakbon.pad ? `<button class="btn" data-a="bestand" data-pad="${esc(c.pakbon.pad)}">${esc(t('pakbon'))}</button>` : ''}
        ${c.pdf && c.pdf.pad ? `<button class="btn pri" data-a="bestand" data-pad="${esc(c.pdf.pad)}">${esc(t('losplanning'))}</button><span class="small muted">${esc(t('gemaakt', { x:datum(c.pdf.op, { day:'numeric', month:'short' }) + ' ' + tijd(c.pdf.op) }))}</span>` : `<span class="badge b-grey">${esc(t('losplanningVolgt'))}</span>`}
      </div></div>`;
  };
  app.innerHTML = `<div class="card"><h2>${esc(t('tegel.cont'))}</h2><div class="small muted">${esc(t('contIntro'))}</div></div>
    ${UI.cont.length ? UI.cont.map(kaart).join('') : `<div class="card empty">${esc(t('geenCont'))}</div>`}`;
}
async function openBestand(pad){
  // eerst het venster openen (anders blokkeert de browser het), dan het bestand erin zetten
  const w = window.open('', '_blank');
  if(w) try{ w.document.title = t('bestandLaden'); w.document.body.textContent = t('bestandLaden'); }catch(e){}
  try{
    const r = await fetch(WH.URL_ + '/storage/v1/object/pakbonnen/' + pad.split('/').map(encodeURIComponent).join('/'), { headers:{ apikey:WH.KEY, Authorization:'Bearer ' + WH.KEY }, cache:'no-store' });
    if(!r.ok) throw new Error(r.status + '');
    const url = URL.createObjectURL(await r.blob());
    if(w) w.location.href = url;
    else { const a = document.createElement('a'); a.href = url; a.download = pad.split('/').pop(); document.body.appendChild(a); a.click(); a.remove(); }
  }catch(e){ if(w) w.close(); toast(t('openMislukt', { x:e.message }), 5000); }
}

/* ---------- acties ---------- */
document.addEventListener('click', async ev => {
  const tb = ev.target.closest('#talen button');
  if(tb){ zetTaal(tb.dataset.taal); return; }
  const b = ev.target.closest('[data-a]'); if(!b) return;
  const a = b.dataset.a;
  if(a === 'tik'){
    const k = b.dataset.k, aan = !tik(k);
    const v = aan ? { op:new Date().toISOString(), via:'junior' } : null;
    if(aan) D.TAKEN[k] = v; else delete D.TAKEN[k];
    rerender();
    try{ await WH.catPatch('wh-taken', { [k]:v }); }catch(e){ /* melding al getoond */ }
    return;
  }
  if(a === 'gang'){ if(b.dataset.w === 'ronde') UI.gangRonde = b.dataset.v; else UI.gangNu = b.dataset.v; rerender(); return; }
  if(a === 'print'){ window.print(); return; }
  if(a === 'bestand'){ openBestand(b.dataset.pad); return; }
  if(a === 'vernieuw'){ await laden(); rerender(); return; }
});
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });

// vers houden: terug in beeld na 2 minuten, en elke 5 minuten zolang het scherm openstaat (niet tijdens typen/inlezen)
async function ververs(){
  if(document.visibilityState !== 'visible' || Date.now() - D.geladen < 120000) return;
  const a = document.activeElement; if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  if(/bezig|…/.test(($('impst') || {}).textContent || '')) return;
  if(await laden()) rerender();
}
document.addEventListener('visibilitychange', ververs);
setInterval(ververs, 300000);

document.documentElement.lang = taal;
kop();
(async () => { await laden(); route(); })();
})();
