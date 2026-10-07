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
const UI = { gangNu:'', gangRonde:'', cont:null, contTijd:0, meld:null };

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
// Nu verplaatsen komt live uit Picqer (koppelcode op dit apparaat); anders uit de laatste backorder-export
const LV = () => window.WHLIVE ? WHLIVE.status() : null;
const isLive = () => { const s = LV(); return !!(s && s.klaar && !s.fout); };
// aanvulronde live (uitgerekend uit Picqer, gedeeld via de database) of nog uit de PDF
const rondeLive = () => window.WHAL && WHAL.S.st && WHAL.S.st.p ? WHAL.rondeLijst() : null;
const lijstOud = () => { if(isLive()){ if(rondeLive()) return false; const a = advDatum(); return !a || isoDag(a) !== vandaag(); } const b = boDatum(); return !b || isoDag(b) !== vandaag(); };
const bronTekst = () => {
  if(!isLive()) return t('lijstVan', { b:wanneer(boDatum()), a:wanneer(advDatum()) });
  const r = rondeLive() ? t('rondeLive', { x:wanneer(WHAL.S.st.bijgewerkt) }) : t('lijstVan', { b:'', a:wanneer(advDatum()) }).replace(/^[^·]*·\s*/, '');
  return t('live', { x:tijd(LV().data.binnen) }) + ' · ' + r + (window.WHAL && WHAL.S.bezig ? ' · ' + t('bezigLive') : '');
};
function koppelKaart(){
  const s = LV();
  if(!s || s.code) return s && s.fout ? `<div class="reason mt8">${esc(t('live.fout'))} <span class="small muted">${esc(s.fout.message)}</span></div>` : '';
  return `<div class="card noprint"><h3>${esc(t('live.titel'))}</h3><div class="small muted mt4">${esc(t('live.uitleg'))}</div>
    <div class="row wrap mt8"><input id="j-code" type="password" autocomplete="off" style="max-width:220px;padding:8px 10px;font-size:15px;border:1px solid #cdd5df;border-radius:6px"><button class="btn pri" data-a="koppel">${esc(t('live.knop'))}</button></div></div>`;
}
function lijsten(){
  const C = WHL.bereken();
  if(isLive()){
    const uit = new Set(C.uitzetten.map(r => r.code)), inRonde = new Set(C.ronde.map(r => r.code));
    const rl = rondeLive();
    return { C, live:true, rondeLive:!!rl, mv:WHLIVE.nuLijst(), ronde:rl || C.ronde.filter(r => !uit.has(r.code)), vstSet:rl ? new Set() : new Set(C.vst.map(v => v.code)), niet:rl ? [] : C.deels.filter(d => d.adv && !inRonde.has(d.code)) };
  }
  const uit = new Set(C.uitzetten.map(r => r.code));           // hoort niet in het advies (Daan ruimt op)
  const vstSet = new Set(C.vst.map(v => v.code));
  const inRonde = new Set(C.ronde.map(r => r.code));
  // "niet nu": Picqer-advies dat alleen door een onvolledige order bestaat (heeft het product een picklocatie onder het niveau, dan is het gewoon aanvulronde)
  return { C, mv:C.mv, ronde:C.ronde.filter(r => !uit.has(r.code)), vstSet, niet:C.deels.filter(d => d.adv && !inRonde.has(d.code)) };
}

/* ---------- routering ---------- */
function route(){
  const h = (location.hash || '#/').slice(2).split('/');
  const naam = h[0] || 'vandaag';
  document.querySelectorAll('#nav a[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === naam));
  if(D.fout){ app.innerHTML = `<div class="card"><h2>${esc(t('geenVerb'))}</h2><p class="mt8">${esc(t('geenVerbTekst'))}</p><p class="small muted mt8">${esc(D.fout.message || '')}</p></div>`; return; }
  try{
    if(naam === 'aanvullen') return viewAanvullen(h[1] === 'ronde' ? 'ronde' : h[1] === 'niet' ? 'niet' : 'nu');
    if(naam === 'containers') return viewContainers();
    if(naam === 'leveringen') return viewLeveringen(h[1] || '');
    if(naam === 'handleiding') return viewHandleiding();
    return viewVandaag();
  }catch(e){
    console.error(e);
    app.innerHTML = `<div class="card"><h2>${esc(t('misScherm'))}</h2><pre class="mono mt8">${esc(e.stack || e.message)}</pre></div>`;
  }
}
const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };


/* ---------- Leveringen: wat is binnen en waar moet het heen ---------- */
const LEVUI = { bezig:false, auto:false };
function levLaad(){
  if(LEVUI.bezig || !window.WHLEV) return;
  LEVUI.bezig = true;
  WHLEV.laad().then(() => { LEVUI.bezig = false; if(/^#\/leveringen/.test(location.hash)) rerender(); })
    .catch(() => { LEVUI.bezig = false; });
}
function levTekst(x){
  const naar = t('lev.naar.' + x.dest);
  if(x.pallet) return t('lev.pallets', { n:x.n }) + ' (' + t('lev.perPallet', { n:nf(x.per) }) + ') — ' + naar;
  return t('lev.stuks', { n:nf(x.stuks) }) + ' — ' + naar;
}
function viewLeveringen(key){
  if(!window.WHLEV){ app.innerHTML = `<div class="card empty">${esc(t('sync.laden'))}</div>`; return; }
  if(!LEVUI.auto && !WHLEV.S.data){ LEVUI.auto = true; levLaad(); }
  // alleen leveringen die Daan heeft nagekeken en vrijgegeven (stap 'Verdeling akkoord')
  const alle = WHLEV.leveringen().filter(l => l.soort === 'ontvangst' && ((l.bewaard || {}).gedaan || {}).verdeling);
  if(key){
    const lev = alle.find(l => l.key === key);
    if(lev){
      const taken = WHLEV.takenVan(lev);
      const gedaan = (lev.bewaard || {}).taken || {};
      const n = taken.filter(x => gedaan[x.id]).length;
      app.innerHTML = `<div class="card"><div class="row wrap between"><div><h2>${esc(lev.leverancier || t('lev.titel'))}</h2>
          <div class="small muted">${esc([lev.nummer, lev.datum && datum(lev.datum)].filter(Boolean).join(' · '))}</div></div>
          <a class="small" href="#/leveringen">${esc(t('lev.terug'))}</a></div>
        <div class="mt8"><span class="badge ${n === taken.length ? 'b-ok' : 'b-info'}">${esc(t('lev.taken', { n, m:taken.length }))}</span></div></div>
        ${n === taken.length && taken.length ? `<div class="card empty">${esc(t('lev.alles'))}</div>` : ''}
        ${taken.map(x => `<div class="card cont ${gedaan[x.id] ? '' : 'nu'}"><div class="row wrap between">
          <div><h3>${esc(x.code)}</h3><div class="small muted">${esc(WHL.naamVan(x.code))}</div>
            <div class="mt8"><b>${esc(levTekst(x))}</b></div></div>
          <button class="btn ${gedaan[x.id] ? '' : 'pri'}" data-a="levtaak" data-k="${esc(lev.key)}" data-t="${esc(x.id)}">${gedaan[x.id] ? '✓' : esc(t('lev.klaar'))}</button>
        </div></div>`).join('')}`;
      return;
    }
  }
  const kaart = l => {
    const taken = WHLEV.takenVan(l);
    const gedaan = (l.bewaard || {}).taken || {};
    const n = taken.filter(x => gedaan[x.id]).length;
    return `<a class="card cont ${n === taken.length && taken.length ? '' : 'nu'}" style="display:block;text-decoration:none;color:inherit" href="#/leveringen/${esc(l.key)}">
      <div class="row wrap between"><div><h3>${esc(l.leverancier || '?')}</h3>
        <div class="small muted">${esc([l.nummer, l.datum && datum(l.datum)].filter(Boolean).join(' · '))}</div></div>
        <span class="badge ${n === taken.length && taken.length ? 'b-ok' : 'b-info'}">${esc(t('lev.taken', { n, m:taken.length }))}</span></div></a>`;
  };
  app.innerHTML = `<div class="card"><div class="row wrap between"><h2>${esc(t('lev.titel'))}</h2>
      <button class="btn pri" data-a="levververs"${LEVUI.bezig ? ' disabled' : ''}>↻ ${esc(t('vernieuw'))}</button></div>
      <div class="small muted mt4">${esc(t('lev.kies'))}</div></div>
    ${alle.length ? alle.map(kaart).join('') : `<div class="card empty">${esc(LEVUI.bezig ? t('sync.laden') : t('lev.geen'))}</div>`}`;
}

/* ---------- Vandaag ---------- */
function viewVandaag(){
  const vd = vandaag();
  const { mv, ronde, niet, live } = lijsten();
  const mvOpen = mv.filter(m => mvStaat(m, vd) !== 'klaar').length;
  const nOrders = new Set(mv.flatMap(m => m.orders)).size;
  const rondeOpen = live ? ronde.length : ronde.filter(r => !tik('rd:' + vd + ':' + r.code)).length;
  const cs = D.CONT.filter(c => c.status !== 'afgerond').sort(contSort);
  const vc = cs.find(c => c.losdatum && c.losdatum >= vd) || cs[0];
  const d = new Date();
  app.innerHTML = `
  <div class="card"><h2 class="dag">${esc(hoofdletter(d.toLocaleDateString(loc(), { weekday:'long', day:'numeric', month:'long' })))}</h2>
    <div class="small muted">${esc(bronTekst())}</div>
    ${lijstOud() ? `<div class="reason mt8">${esc(t('oud'))} <a href="#/aanvullen">${esc(t('oudKnop'))}</a></div>` : ''}</div>
  ${koppelKaart()}
  ${window.WHLIVE ? WHLIVE.overzicht({ prodHref:'#/aanvullen/nu', nProd:isLive() ? mv.length : null }) : ''}
  <div class="tiles">
    <a class="tile ${mvOpen ? 't-bad' : 't-ok'}" href="#/aanvullen/nu"><div class="lbl">1 · ${esc(t('tegel.nu'))}</div><div class="big">${nf(mvOpen)}</div><div class="sub">${esc(t('ordersWacht', { n:nf(nOrders) }))}</div></a>
    <a class="tile ${rondeOpen ? 't-warn' : 't-ok'}" href="#/aanvullen/ronde"><div class="lbl">2 · ${esc(t('tegel.ronde'))}</div><div class="big">${nf(rondeOpen)}</div><div class="sub">${esc(t('tegel.rondeSub'))}</div></a>
    ${live ? '' : `<a class="tile t-grey" href="#/aanvullen/niet"><div class="lbl">${esc(t('tegel.niet'))}</div><div class="big">${nf(niet.length)}</div><div class="sub">${esc(t('tegel.nietSub'))}</div></a>`}
    <a class="tile t-info" href="#/containers"><div class="lbl">${esc(t('tegel.cont'))}</div><div class="big">${nf(cs.length)}</div><div class="sub">${esc(vc ? t('volgende', { x:contKort(vc) + (vc.losdatum ? ' · ' + dagTekst(vc.losdatum) : '') }) : t('geenGepland'))}</div></a>
    <a class="tile t-vst" href="./" target="_blank" rel="noopener"><div class="lbl">${esc(t('tegel.labels'))} ↗</div><div class="big">▦</div><div class="sub">${esc(t('tegel.labelsSub'))}</div></a>
  </div>`;
}

/* ---------- Aanvullen ---------- */
function uitlegOpen(){ try{ return localStorage.getItem('junior-uitleg') !== 'dicht'; }catch(e){ return true; } }
function volgorde(){ try{ return localStorage.getItem('junior-volg') === 'route' ? 'route' : 'oud'; }catch(e){ return 'oud'; } }
// status van een regel in "Nu verplaatsen": open / klaar / nog open (afgevinkt, maar na Verwerk backorders staat hij er nog)
const mvStaat = (m, vd) => {
  if(!m.live) return WHL.mvStaat(m.code, vd);
  return 'open';                 // live: wat klaar is, verdwijnt na Vernieuwen vanzelf van de lijst
};
function viewAanvullen(tab){
  const vd = vandaag();
  const L = lijsten();
  const nNu = L.mv.filter(m => mvStaat(m, vd) !== 'klaar').length;
  const nRonde = L.live ? L.ronde.length : L.ronde.filter(r => !tik('rd:' + vd + ':' + r.code)).length;
  if(L.live){
    if(tab === 'niet') tab = 'nu';
    const bezig = window.WHAL && WHAL.S.bezig;
    app.innerHTML = `<div class="card noprint"><div class="row wrap between"><div><h3>${esc(t('nav.aanvullen'))}</h3><div class="small muted">${esc(bronTekst())}</div></div>
        <button class="btn pri" data-a="lververs" ${bezig ? 'disabled' : ''}>↻ ${esc(t('vernieuw'))}</button></div>
        <div class="small mt8">${esc(t('liveTip'))}</div>${L.rondeLive ? '' : `<div class="reason mt8">${esc(t('rondeNog'))}</div>`}</div>
      <div class="tabs noprint">
        <a class="tab ${tab === 'nu' ? 'on' : ''} ${nNu ? 'hot' : ''}" href="#/aanvullen/nu">1 · ${esc(t('tegel.nu'))} <span class="nr">${nf(nNu)}</span></a>
        <a class="tab ${tab === 'ronde' ? 'on' : ''}" href="#/aanvullen/ronde">2 · ${esc(t('tegel.ronde'))} <span class="nr">${nf(nRonde)}</span></a></div>`
      + (tab === 'ronde' ? tabRonde(L, vd) : tabNu(L, vd));
    return;
  }
  const kopHtml = `
  <div class="card noprint"><div class="row wrap between"><h3>${esc(t('vernieuwTitel'))}</h3><span class="small muted">${esc(bronTekst())}</span></div>
    ${lijstOud() ? `<div class="reason mt8">${esc(t('oud'))}</div>` : ''}
    ${diffTekst() ? `<div class="small mt8">${esc(diffTekst())}</div>` : ''}
    <label class="drop mt8" id="drop"><input type="file" id="files" multiple accept=".xlsx,.xls,.csv,.pdf" hidden><b>${esc(t('dropTekst'))}</b></label>
    <div id="impst" class="status"></div></div>
  <details class="card noprint" id="uitleg" ${uitlegOpen() ? 'open' : ''}><summary>${esc(t('uitlegTitel'))}</summary>
    <ol class="uitleg">${t('uitleg').map(s => `<li>${s}</li>`).join('')}</ol></details>
  <div class="tabs noprint">
    <a class="tab ${tab === 'nu' ? 'on' : ''} ${nNu ? 'hot' : ''}" href="#/aanvullen/nu">1 · ${esc(t('tegel.nu'))} <span class="nr">${nf(nNu)}</span></a>
    <a class="tab ${tab === 'ronde' ? 'on' : ''}" href="#/aanvullen/ronde">2 · ${esc(t('tegel.ronde'))} <span class="nr">${nf(nRonde)}</span></a>
    <a class="tab ${tab === 'niet' ? 'on' : ''}" href="#/aanvullen/niet">${esc(t('tegel.niet'))} <span class="nr">${nf(L.niet.length)}</span></a>
  </div>`;
  app.innerHTML = kopHtml + (tab === 'ronde' ? tabRonde(L, vd) : tab === 'niet' ? tabNiet(L) : tabNu(L, vd));
  koppelDrop();
  const u = $('uitleg'); if(u) u.addEventListener('toggle', () => { try{ localStorage.setItem('junior-uitleg', u.open ? 'open' : 'dicht'); }catch(e){} });
}
function gangFilter(items, sel, w){
  const g = [...new Set(items.map(x => x.gang).filter(Boolean))].sort();
  if(g.length < 2) return '';
  return `<div class="filters mb8 noprint"><span class="small muted">${esc(t('gang'))}</span> <button class="btn sm ${!sel ? 'pri' : ''}" data-a="gang" data-w="${w}" data-v="">${esc(t('alle'))}</button>${g.map(x => `<button class="btn sm ${sel === x ? 'pri' : ''}" data-a="gang" data-w="${w}" data-v="${esc(x)}">${esc(x === 'Retourkar' ? t('kar') : x)}</button>`).join('')}</div>`;
}
const kortDatum = d => datum(d, { day:'numeric', month:'short' });
// "klopt niet": wat past er op de picklocatie + opmerking → aanvulbase (Daan bevestigt, gaat later mee in de Picqer-import)
function meldKnop(code){
  const e = D.AANVUL[code] || {};
  const iets = e.max || e.noot;
  return `<button class="btn sm ghost noprint" data-a="meld" data-code="${esc(code)}">✎ ${esc(t(iets ? 'meldGedaan' : 'meldKnop'))}</button>`;
}
function meldForm(code){
  if(UI.meld !== code) return '';
  const e = D.AANVUL[code] || {};
  return `<div class="meld noprint" data-meld="${esc(code)}"><div class="small muted">${esc(t('meldUitleg'))}</div>
    <div class="row wrap mt8"><label class="small">${esc(t('meldMax'))}<br><input class="num" data-mf="max" inputmode="numeric" value="${esc(e.max ?? '')}"></label>
      <label class="small grow">${esc(t('meldNoot'))}<br><input data-mf="noot" value="${esc(e.noot || '')}" placeholder="${esc(t('meldVb'))}"></label></div>
    <div class="row wrap mt8"><button class="btn sm pri" data-a="meld-op" data-code="${esc(code)}">${esc(t('opslaan'))}</button><button class="btn sm" data-a="meld" data-code="">${esc(t('sluit'))}</button></div></div>`;
}
const bc = code => window.WHB ? WHB.svg(code) : '';
const naarHtml = m => m.naar ? locs(m.naar) : `<span class="badge b-warn">${esc(t('geenLoc'))}</span>` + (m.voorstelPick ? ` <span class="small muted">${esc(t('ofNieuw'))}</span> ${locBadge(m.voorstelPick)}` : '');
function tabNu(L, vd){
  if(!L.mv.length) return `<div class="card empty">${esc(t('leegNu'))}</div>` + (L.live ? `<div class="card">${gedaanLijst('nu') || ''}</div>` : '');
  const volg = volgorde();
  const lijst = L.mv.filter(m => !UI.gangNu || m.gang === UI.gangNu).slice().sort(WHL.mvSort(volg));
  const open = lijst.filter(m => mvStaat(m, vd) !== 'klaar');
  const vw = D.TAKEN['dg:' + vd + ':verwerk'];
  return `<div class="card scherm"><div class="row wrap between"><div><h2>1 · ${esc(t('tegel.nu'))}</h2><div class="small muted">${esc(t('introNu'))}</div></div>
      <div class="row"><span class="badge b-bad">${esc(t('open', { n:open.length }))}</span><button class="btn sm pri noprint" data-a="print">${esc(t('print'))}</button></div></div>
    <div class="filters mt12 noprint"><span class="small muted">${esc(t('volg'))}</span>
      <button class="btn sm ${volg === 'oud' ? 'pri' : ''}" data-a="volg" data-v="oud">${esc(t('volgOud'))}</button>
      <button class="btn sm ${volg === 'route' ? 'pri' : ''}" data-a="volg" data-v="route">${esc(t('volgRoute'))}</button></div>
    <div class="mt8">${gangFilter(L.mv, UI.gangNu, 'nu')}</div>
    <div class="reason mt8">${esc(t('scanTip'))}</div>
    ${lijst.map(m => mvHtml(m, vd)).join('')}
    ${L.live ? gedaanLijst('nu') : `<div class="card verwerk mt12 ${vw ? 'klaar' : ''}"><div class="row wrap between"><div>${vw ? esc(t('verwerkOm', { x:tijd(vw.op) })) : t('klaarNu')}<div class="small muted mt4">${esc(t('verwerkNa'))}</div></div>
      <button class="btn ${vw ? '' : 'pri'}" data-a="verwerk">${esc(vw ? t('verwerkUit') : t('verwerkKnop'))}</button></div></div>`}</div>
  ${printTabel('1 · ' + t('tegel.nu'), open.map(m => ({ code:m.code, naam:m.naam, van:m.van, naar:m.naar, geen:!m.naar, aantal:m.verpl, extra:mvMeta(m) })), false, 'Junior - Nu verplaatsen')}`;
}
function mvMeta(m){
  const delen = [t('orders', { n:m.orders.length }) + ' · ' + t('oudste', { x:kortDatum(m.datum) })];
  if(m.pickst !== null && m.pickst !== undefined) delen.push(t('pickvrd', { n:nf(m.pickst) }));
  delen.push(t('voorOrd', { n:nf(m.stuks) }));
  if(m.naar && m.spp && m.verpl >= m.spp && m.verpl % m.spp === 0) delen.push('= ' + t('pallets', { n:m.verpl / m.spp }));
  if(m.soort === 'retour') delen.push(t('retourkar', { x:(m.van || []).join(', ') }));
  if(m.dz) delen.push(t('dz'));
  return delen.join(' · ');
}
function mvHtml(m, vd){
  const k = 'mv:' + vd + ':' + m.code;
  const st = mvStaat(m, vd);
  const tk = D.TAKEN[k], vw = D.TAKEN['dg:' + vd + ':verwerk'];
  return `<div class="mv metbc ${st === 'klaar' ? 'klaar' : ''} ${st === 'nogopen' ? 'nogopen' : ''}">
    <div>${m.live ? '' : tikKnop(k)}</div>
    <div><div><span class="code">${esc(m.code)}</span> <span class="desc">${esc(m.naam || '')}</span>${m.dz ? ` <span class="badge b-info">${esc(t('dz'))}</span>` : ''}</div>
      <div class="route"><span class="rl">${esc(t('van'))}</span>${locs(m.van) || `<span class="badge b-grey">${esc(t('bulkOnb'))}</span>`}<span class="pijl">→</span><span class="rl">${esc(t('naar'))}</span>${naarHtml(m)}</div>
      <div class="meta">${esc(mvMeta(m))}</div>
      ${st === 'nogopen' ? `<div class="meta rood">${esc(t('nogOpen', { a:tijd(tk.op), b:tijd(vw.op) }))}</div>` : ''}
      <div class="mt4">${meldKnop(m.code)}</div>${meldForm(m.code)}
    </div>
    <div class="bc">${bc(m.code)}</div>
    <div class="aant">${nf(m.verpl)}<small>${esc(t('verpl'))}</small></div>
  </div>`;
}
function tabRonde(L, vd){
  if((!L.rondeLive && !D.ADV) || !L.ronde.length) return `<div class="card empty">${esc(t('leegRonde'))}</div>` + (L.rondeLive ? `<div class="card">${gedaanLijst('ronde') || ''}</div>` : '');
  const lijst = L.ronde.filter(r => !UI.gangRonde || r.gang === UI.gangRonde);
  let vorige = null, html = '';
  lijst.forEach(r => {
    if(r.gang !== vorige){
      const n = lijst.filter(x => x.gang === r.gang);
      html += `<div class="gangkop"><b>${esc(t('gang'))} ${esc(r.gang)}</b><span class="small muted">${esc(L.rondeLive ? String(n.length) : t('openVan', { a:n.filter(x => !tik('rd:' + vd + ':' + x.code)).length, b:n.length }))}</span></div>`;
      vorige = r.gang;
    }
    const k = 'rd:' + vd + ':' + r.code;
    html += `<div class="mv metbc ${!L.rondeLive && tik(k) ? 'klaar' : ''}">
      <div>${L.rondeLive ? '' : tikKnop(k)}</div>
      <div><div><span class="code">${esc(r.code)}</span> <span class="desc">${esc(r.naam || (r.pr && r.pr.naam) || '')}</span></div>
        <div class="route"><span class="rl">${esc(t('van'))}</span>${locs(r.bulk)}<span class="pijl">→</span><span class="rl">${esc(t('naar'))}</span>${r.geenPick ? `<span class="badge b-warn">${esc(t('geenPick'))}</span>` : locs(r.pick)}</div>
        <div class="meta">${esc(rondeMeta(r))}</div>
        ${L.vstSet.has(r.code) ? `<div class="meta"><span class="badge b-vst">VST</span> ${esc(t('wachtVst'))}</div>` : ''}
        <div class="mt4">${meldKnop(r.code)}</div>${meldForm(r.code)}
      </div>
      <div class="bc">${bc(r.code)}</div>
      <div class="aant">${nf(r.aantal)}<small>${esc(t('advies'))}</small></div></div>`;
  });
  const open = L.rondeLive ? lijst : lijst.filter(r => !tik('rd:' + vd + ':' + r.code));
  return `<div class="card scherm"><div class="row wrap between"><div><h2>2 · ${esc(t('tegel.ronde'))}</h2><div class="small muted">${esc(t('introRonde'))}</div></div>
      <div class="row"><span class="badge b-warn">${esc(t('open', { n:open.length }))}</span><button class="btn sm pri noprint" data-a="print">${esc(t('print'))}</button></div></div>
    <div class="mt12">${gangFilter(L.ronde, UI.gangRonde, 'ronde')}</div>
    <div class="reason mt8">${esc(t('scanTip'))}</div>${html}${L.rondeLive ? gedaanLijst('ronde') : ''}</div>
  ${printTabel('2 · ' + t('tegel.ronde') + (UI.gangRonde ? ' · ' + t('gang') + ' ' + UI.gangRonde : ''), open.map(r => ({ code:r.code, naam:r.naam || (r.pr && r.pr.naam) || '', van:r.bulk, naar:r.geenPick ? null : r.pick, geen:r.geenPick, aantal:r.aantal, extra:rondeMeta(r), gang:r.gang })), true, 'Junior - Aanvulronde' + (UI.gangRonde ? ' gang ' + UI.gangRonde : ''))}`;
}
// vandaag al gedaan (stond vandaag op de lijst, nu niet meer) — gedeeld met Warehouse
function gedaanLijst(soort){
  const g = window.WHAL ? WHAL.gedaan(soort) : [];
  return g.length ? `<details class="mt12 noprint"><summary>${esc(t('gedaan', { n:g.length }))}</summary><div class="small mt8">${g.map(c => `<span class="code">${esc(c)}</span> <span class="desc">${esc((D.P[c] || {}).naam || '')}</span>`).join('<br>')}</div></details>` : '';
}
function rondeMeta(r){
  const d = [t('pickvrd', { n:nf(r.pickst) })];
  if(r.live && r.lvl != null) d.push(nf(r.lvl) + ' / ' + nf(r.tot));
  if(r.deels) d.push(t('deelsKort'));
  return d.join(' · ');
}
function tabNiet(L){
  if(!L.niet.length) return `<div class="card empty">${esc(t('leegNiet'))}</div>`;
  const regel = x => x.anderen && x.anderen.length && !x.eigen ? t('deelsAnder', { nr:x.nr, x:x.anderen.map(a => a.code).join(', ') })
    : x.vst ? t('deelsVst', { nr:x.nr }) : t('deelsEigen', { nr:x.nr, b:nf(x.besch), a:nf(x.aantal) });
  return `<div class="card"><h2>${esc(t('tegel.niet'))}</h2><div class="reason mt8">${esc(t('introNiet'))}</div>
    ${L.niet.map(d => `<div class="mv" style="grid-template-columns:1fr auto">
      <div><div><span class="code">${esc(d.code)}</span> <span class="desc">${esc(d.naam || '')}</span></div>
        <div class="route"><span class="rl">${esc(t('van'))}</span>${locs(d.van)}<span class="pijl">→</span><span class="rl">${esc(t('naar'))}</span>${d.naar ? locs(d.naar) : `<span class="badge b-warn">${esc(t('geenLoc'))}</span>`}</div>
        <div class="meta">${d.orders.slice(0, 4).map(x => esc(regel(x))).join('<br>')}${d.orders.length > 4 ? '<br>+' + (d.orders.length - 4) : ''}</div></div>
      <div class="aant muted">${d.adv ? nf(d.adv.aantal) : ''}<small>${esc(t('advies'))}</small></div></div>`).join('')}</div>`;
}
// papieren lijst: één regel per product, barcode om te scannen, vakje en ruimte voor het echte aantal
function printTabel(titel, rijen, perGang, pnaam){
  let vorige = null;
  const tr = rijen.map(r => {
    let kop = '';
    if(perGang && r.gang !== vorige){ kop = `<tr class="pgang"><td colspan="7">${esc(t('gang'))} ${esc(r.gang)}</td></tr>`; vorige = r.gang; }
    return kop + `<tr><td class="pv"><span class="pvak"></span></td>
      <td><b class="code">${esc(r.code)}</b><div class="pn">${esc(r.naam || '')}</div><div class="pm">${esc(r.extra || '')}</div></td>
      <td class="loc">${(r.van || []).map(esc).join('<br>')}</td>
      <td class="loc naar">${r.geen ? `<span class="pgeen">${esc(t('geenLoc'))}</span>` : (r.naar || []).map(esc).join('<br>')}</td>
      <td class="pa">${nf(r.aantal)}</td>
      <td class="pbc">${bc(r.code)}</td>
      <td class="pg"></td></tr>`;
  }).join('');
  return `<div class="printonly" data-printnaam="${esc(pnaam || titel)}"><div class="pkop"><b>IVOL · ${esc(titel)}</b><span>${esc(t('printOp', { x:datum(new Date(), { weekday:'short', day:'numeric', month:'short' }) + ' ' + tijd(new Date()) }))} · ${esc(t('lijstVan', { b:wanneer(boDatum()), a:wanneer(advDatum()) }))}</span></div>
    <div class="ptip">${esc(t('scanTip'))}</div>
    <table class="ptab"><colgroup><col style="width:5%"><col style="width:29%"><col style="width:13%"><col style="width:14%"><col style="width:8%"><col style="width:23%"><col style="width:8%"></colgroup><thead><tr><th></th><th>${esc(t('kolProduct'))}</th><th>${esc(t('kolVan'))}</th><th>${esc(t('kolNaar'))}</th><th>${esc(t('kolAantal'))}</th><th></th><th>${esc(t('kolGedaan'))}</th></tr></thead><tbody>${tr}</tbody></table>
    <div class="ptip mt8">${t('klaarNu')}</div></div>`;
}
// wat is er veranderd sinds de vorige backorder-export
function diffTekst(){
  if(!D.BOVORIG || !D.BOVORIG.orders) return '';
  const oud = D.BOVORIG.orders, nu = new Set(D.BO.map(r => r.bestelling));
  const o = Object.keys(oud);
  return t('diff', { a:nf(o.filter(x => !nu.has(x)).length), b:nf(o.filter(x => nu.has(x)).length), c:nf([...nu].filter(x => !oud[x]).length) });
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
      } else log.push(esc(t(x.s ? 'nietNodig' : 'nietHerkend', { x:x.f.name })));
    }catch(e){ log.push('✗ ' + esc(x.f.name) + ': ' + esc(e.message)); }
  }
  if(iets){ zet(t('sync.laden')); await laden(); }
  route();
  const s = $('impst');
  if(s){ s.innerHTML = log.join('<br>'); s.className = 'status ' + (log.some(l => l.startsWith('✗')) ? 'err' : 'ok'); }
  if(iets) toast(t('bijgewerkt'));
}

/* ---------- Handleiding ---------- */
function viewHandleiding(){
  const h = (window.JH && (JH[taal] || JH.nl)) || '';
  app.innerHTML = `<div class="card noprint"><div class="row wrap between"><span class="small muted">${esc(t('handTaal'))}</span><button class="btn sm pri" data-a="print">${esc(t('print'))}</button></div></div>
    <div class="card handleiding" data-printnaam="IVOL Junior - Handleiding ${esc(taal.toUpperCase())}">${h}</div>`;
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
  if(a === 'levtaak'){
    const k = b.dataset.k, id = b.dataset.t;
    const lev = WHLEV.leveringen().find(l => l.key === k);
    if(lev){
      const tk = Object.assign({}, (lev.bewaard || {}).taken); tk[id] = !tk[id];
      D.LEV = Object.assign({}, D.LEV, { [k]:Object.assign({}, lev.bewaard, { taken:tk }) });
      rerender();
      try{ await WH.catPatch('wh-leveringen', { [k]:D.LEV[k] }); }catch(e){}
    }
    return;
  }
  if(a === 'levververs'){ levLaad(); rerender(); return; }
  if(a === 'gang'){ if(b.dataset.w === 'ronde') UI.gangRonde = b.dataset.v; else UI.gangNu = b.dataset.v; rerender(); return; }
  if(a === 'print'){ window.print(); return; }
  if(a === 'meld'){ UI.meld = b.dataset.code || null; rerender(); const i = document.querySelector('[data-meld] input'); if(i) i.focus(); return; }
  if(a === 'meld-op'){
    const code = b.dataset.code, box = document.querySelector(`[data-meld="${CSS.escape(code)}"]`); if(!box) return;
    const max = num(box.querySelector('[data-mf="max"]').value), noot = box.querySelector('[data-mf="noot"]').value.trim();
    const oud = Object.assign({}, D.AANVUL[code] || {});
    if(max && max > 0) oud.max = max; else delete oud.max;
    if(noot) oud.noot = noot; else delete oud.noot;
    oud.meld = { op:new Date().toISOString(), via:'junior' };
    b.disabled = true;
    try{ await WH.catPatch('wh-aanvul', { [code]:oud }); WHL.reset(); UI.meld = null; toast(t('opgeslagen')); rerender(); }
    catch(e){ b.disabled = false; }
    return;
  }
  if(a === 'volg'){ try{ localStorage.setItem('junior-volg', b.dataset.v); }catch(e){} rerender(); return; }
  if(a === 'verwerk'){
    const k = 'dg:' + vandaag() + ':verwerk';
    const v = D.TAKEN[k] ? null : { op:new Date().toISOString(), via:'junior' };
    if(v) D.TAKEN[k] = v; else delete D.TAKEN[k];
    rerender();
    try{ await WH.catPatch('wh-taken', { [k]:v }); }catch(e){ /* melding al getoond */ }
    if(v) setTimeout(() => live(true), 20000);        // Picqer maakt de picklijsten; daarna vers ophalen
    return;
  }
  if(a === 'bestand'){ openBestand(b.dataset.pad); return; }
  if(a === 'vernieuw' || a === 'lververs'){ if(a === 'vernieuw') await laden(); rerender(); live(true); if(window.WHAL) WHAL.ververs(1); return; }
  if(a === 'koppel'){ const v = (($('j-code') || {}).value || '').trim(); if(!v) return; WHLIVE.zetCode(v); live(true); return; }
});
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });

// vers houden: terug in beeld na 2 minuten, en elke 5 minuten zolang het scherm openstaat (niet tijdens typen/inlezen)
async function ververs(){
  if(document.visibilityState !== 'visible' || Date.now() - D.geladen < 120000) return;
  const a = document.activeElement; if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  if(/bezig|…/.test(($('impst') || {}).textContent || '')) return;
  if(await laden()) rerender();
  live();
  if(window.WHAL) WHAL.ververs(10);
}
// live uit Picqer: ophalen en opnieuw tekenen (niet tijdens typen); overzicht in de taal van Junior
if(window.WHLIVE) WHLIVE.taal(k => (JT[taal] || {})['lv.' + k], () => loc());
function live(vers){ if(window.WHLIVE && WHLIVE.status().code) WHLIVE.laad(vers); }
if(window.WHAL) WHAL.opNieuw(() => {
  const a = document.activeElement; if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  if(/^#\/(aanvullen(\/(nu|ronde))?)?$/.test(location.hash || '#/') || !location.hash) rerender();
});
if(window.WHLIVE) WHLIVE.opNieuw(() => {
  const a = document.activeElement; if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  if(/^#\/(aanvullen(\/nu)?)?$/.test(location.hash || '#/') || !location.hash) rerender();
});
document.addEventListener('visibilitychange', ververs);
setInterval(ververs, 300000);

document.documentElement.lang = taal;
kop();
(async () => { await laden(); route(); live(); if(window.WHAL){ await WHAL.laadOpslag(); rerender(); WHAL.ververs(10); } })();
})();
