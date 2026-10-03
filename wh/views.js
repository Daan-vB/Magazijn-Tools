/* =====================================================================
   IVOL Warehouse — schermen
   ===================================================================== */
(function(){
'use strict';
const { $, esc, leeg, num, nf, plural, fdate, fdt, dagenOud, toast, D, vandaag, isoDag } = WH;
const app = $('app');
const UI = { mvGang:'', rondeGang:'', base:{ q:'', hal:'', type:'', status:'', abc:'', f:'', gang:'', afd:'', tri:'', max:150 }, lastHash:'', locSel:null, locQ:'', vk:{ van:'', tot:'', vol:true }, open:{} };

/* ---------- kleine bouwstenen ---------- */
const badge = (t, cls) => `<span class="badge ${cls || 'b-grey'}">${esc(t)}</span>`;
const locBadge = l => { const s = WHL.soortLoc(l); return `<span class="badge ${s === 'pick' ? 'b-pick' : s === 'bulk' ? 'b-bulk' : s === 'container' ? 'b-warn' : 'b-grey'}"><span class="loc">${esc(l)}</span></span>`; };
const locs = arr => (arr || []).map(locBadge).join(' ');
const bc = code => window.WHB ? WHB.svg(code) : '';                 // kleine barcode (EAN) om in Picqer te scannen
const kort = d => d ? fdate(d, { day:'numeric', month:'short' }) : '';
const tik = key => !!(D.TAKEN[key]);
function tikKnop(key, label){ return `<button class="chk" data-a="tik" data-k="${esc(key)}" aria-label="${esc(label || 'klaar')}">${tik(key) ? '✓' : ''}</button>`; }
const typeNaam = { vloer:'pallet (vloer)', legbord:'doos/bak (klein)', speciaal:'speciale plek', bulk:'alleen bulk', los:'geen locatie', retour:'alleen retourkar', leeg:'geen voorraad hier' };
const typeCls = { vloer:'b-pick', legbord:'b-info', speciaal:'b-grey', bulk:'b-bulk', los:'b-warn', retour:'b-warn', leeg:'b-grey' };
function exportLeeftijd(iso){
  if(!iso) return badge('ontbreekt', 'b-bad');
  const d = dagenOud(iso);
  return badge(d < 1 ? 'vandaag ' + new Date(iso).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }) : Math.floor(d) + ' dag' + (Math.floor(d) === 1 ? '' : 'en') + ' oud', d < 1 ? 'b-ok' : d < 7 ? 'b-warn' : 'b-bad');
}
function dataDatums(){
  const eerste = (arr, k) => arr.reduce((m, r) => r[k] && (!m || r[k] > m) ? r[k] : m, null);
  return {
    producten: eerste(Object.values(D.P), 'picqer_datum'),
    backorders: eerste(D.BO, 'geimporteerd_op'),
    verkoop: eerste(Object.values(D.VK), 'geimporteerd_op'),
    locaties: D.LOCDATUM,
    advies: D.ADV ? (D.ADV.ingelezen || D.ADV.datum) : null
  };
}
function nietKlaar(){
  const m = [];
  if(!Object.keys(D.P).length) m.push('productexport');
  if(!Object.keys(D.LOC).length) m.push('locatie-export');
  if(!D.BO.length) m.push('backorders');
  if(!D.ADV) m.push('aanvuladvies-PDF');
  if(!Object.keys(D.VK).length) m.push('Magazijnverkopen');
  return m;
}

/* ---------- routering ---------- */
function parseHash(){
  const h = location.hash || '#/';
  const [pad, qs] = h.slice(1).split('?');
  const delen = pad.split('/').filter(Boolean).map(decodeURIComponent);
  const q = {}; (qs || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); q[k] = decodeURIComponent(v || ''); });
  return { delen, q };
}
function route(){
  const { delen, q } = parseHash();
  const naam = delen[0] || 'vandaag';
  if(window.WHM) WHM.zet(naam);
  if(D.fout){ app.innerHTML = geenVerbinding(); return; }
  try{
    if(naam === 'containerdag') return WHD.viewContainerdag(delen[1]);
    if(naam === 'controle') return WHD.viewControle(delen[1]);
    if(naam === 'wie') return WHD.viewWie();
    if(naam === 'invul') return WHD.viewInvul(delen[1]);
    if(naam === 'backorders') return WHD.viewBackorders();
    if(naam === 'ruimte') return WHD.viewRuimte();
    if(naam === 'overzicht') return viewVandaag();
    if(naam === 'aanvullen') return viewAanvullen(delen[1] || 'nu');
    if(naam === 'base') return viewBase(q);
    if(naam === 'abcheck') return viewAB();
    if(naam === 'locaties') return viewLocaties(delen[1] || '', q);
    if(naam === 'stelling') return WHS.view(delen[1] || '');
    if(naam === 'triage') return WHT.view();
    if(naam === 'planning') return viewPlanning();
    if(naam === 'gegevens') return viewGegevens();
    if(naam === 'p') return viewProduct(delen.slice(1).join('/'));
    return WHD.viewVandaag();
  }catch(e){
    console.error(e);
    app.innerHTML = `<div class="card"><h2>Er ging iets mis op dit scherm</h2><pre class="mono mt8">${esc(e.stack || e.message)}</pre></div>`;
  }
}
function geenVerbinding(){
  return `<div class="card"><h2>Geen verbinding met de database</h2><p class="mt8">${esc(D.fout && D.fout.message)}</p>
    <p class="mt8">Staat Supabase op pauze? Ga naar <a href="https://supabase.com/dashboard" target="_blank">supabase.com/dashboard</a>, open project <b>Palletlabels</b> en klik <b>Resume project</b>. Herlaad daarna deze pagina.</p></div>`;
}
const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };

/* =====================================================================
   VANDAAG
   ===================================================================== */
function viewVandaag(){
  const vd = vandaag();
  const C = WHL.bereken();
  const mis = nietKlaar();
  const dt = dataDatums();
  const dagNaam = new Date().toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long' });
  const nVol = new Set(C.mv.flatMap(m => m.orders)).size;
  const mvOpen = C.mv.filter(m => !tik('mv:' + vd + ':' + m.code)).length;
  const rondeOpen = C.ronde.filter(r => !tik('rd:' + vd + ':' + r.code)).length;
  const basis = Object.values(C.prof);
  const nVoorstel = basis.filter(p => p.picqerWijzigt && p.status !== 'bevestigd').length;
  const nNieuw = basis.filter(p => p.final.nieuwePick).length;
  const nBev = basis.filter(p => p.status === 'bevestigd').length;

  // containers die vandaag/morgen lossen
  const morgen = isoDag(Date.now() + 864e5);
  const cont = D.CONT.filter(c => c.status !== 'afgerond' && c.losdatum && c.losdatum <= morgen && c.losdatum >= isoDag(Date.now() - 3 * 864e5));
  const STAP = [['jim', 'Voorboeking Jim gecontroleerd'], ['lossen', 'Gelost + palletlabels'], ['stockmove', 'Stockmove VST (Karin)'], ['ontvangst', 'Ontvangst ingelezen in Containers'], ['bo', 'Backorders uit deze container naar pick']];
  const contHtml = cont.map(c => {
    const klaar = STAP.filter(([k]) => tik('c:' + c.id + ':' + k)).length;
    return `<div class="card" style="border-left:5px solid var(--orange)">
      <div class="row wrap between"><h3>${esc((c.leverancier || '').split(' ')[0])} ${esc(c.pakbon_ref || '')} <span class="muted small">${esc(c.containernummer || '')}</span></h3>
      <span class="small"><b>${esc(fdate(c.losdatum))}</b>${c.lostijd ? ' ' + esc(c.lostijd) : ''} · ${klaar}/${STAP.length}</span></div>
      <div class="mt8">${STAP.map(([k, t]) => `<div class="task ${tik('c:' + c.id + ':' + k) ? 'klaar' : ''}">${tikKnop('c:' + c.id + ':' + k)}<div class="grow"><div class="tt">${esc(t)}</div></div></div>`).join('')}</div>
      <div class="mt8"><a class="btn sm pri" href="./containerplanning.html#/c/${c.id}/uitvoer">Open container</a></div></div>`;
  }).join('');

  const taken = WHP.TAKEN.filter(t => t.datum <= vd && !tik('t:' + t.id)).sort((a, b) => a.prio - b.prio || a.datum.localeCompare(b.datum));
  const klaarVandaag = WHP.TAKEN.filter(t => t.datum === vd && tik('t:' + t.id));
  const straks = WHP.TAKEN.filter(t => t.datum > vd).slice(0, 5);
  const ritme = WHP.werkdag(vd) ? WHP.DAGRITME : [];
  const openVragen = WHP.VRAGEN.filter(v => !tik('v:' + v.id)).length;
  kpiVastleggen(vd, { mv:C.mv.length, orders:nVol, vst:C.vst.length, vstOrders:C.vstOrders.length, ronde:C.ronde.length, vast:C.vast.length, bo:new Set(D.BO.map(r => r.bestelling)).size, bev:nBev });

  app.innerHTML = `
  <div class="card"><div class="row wrap between"><div><h2 style="font-size:19px;text-transform:capitalize">${esc(dagNaam)}</h2>
    <div class="small muted">Week ${WHP.weekNr(vd)} · IVOL Warehouse</div></div>
    <div class="small">${Object.entries(dt).map(([k, v]) => `<span style="white-space:nowrap;margin-left:8px">${k} ${exportLeeftijd(v)}</span>`).join(' ')}</div></div>
    ${mis.length ? `<div class="reason mt8"><b>Nog inladen:</b> ${esc(mis.join(', '))}. Pas dan kan de app alles invullen. <a href="#/gegevens">Naar Gegevens →</a></div>` : ''}
  </div>

  <div class="tiles mb12">
    <a class="tile ${mvOpen ? 't-bad' : 't-ok'}" href="#/aanvullen/nu"><div class="lbl">Nu verplaatsen</div><div class="big">${nf(mvOpen)}</div><div class="sub">maakt ${plural(nVol, 'order', 'orders')} vrij</div></a>
    <a class="tile t-vst" href="#/aanvullen/vst"><div class="lbl">Van VST halen</div><div class="big">${nf(C.vst.length)}</div><div class="sub">${plural(C.vstOrders.length, 'order', 'orders')} compleet met VST</div></a>
    <a class="tile ${rondeOpen ? 't-warn' : 't-ok'}" href="#/aanvullen/ronde"><div class="lbl">Aanvulronde</div><div class="big">${nf(rondeOpen)}</div><div class="sub">adviesregels zonder order</div></a>
    <a class="tile ${C.vast.length ? 't-warn' : 't-ok'}" href="#/aanvullen/vast"><div class="lbl">Vastzittend</div><div class="big">${nf(C.vast.length)}</div><div class="sub">alles beschikbaar, toch backorder</div></a>
    <a class="tile t-info" href="#/base?status=voorstel"><div class="lbl">Aanvulbase</div><div class="big">${nf(nVoorstel)}</div><div class="sub">voorstellen · ${nf(nBev)} bevestigd · ${nf(nNieuw)} nieuwe pick</div></a>
  </div>

  ${contHtml ? `<h3 class="mb8">Containers</h3>${contHtml}` : ''}

  <div class="card"><div class="row between"><h3>Taken</h3><a class="small" href="#/planning">Hele planning →</a></div>
    ${taken.length ? taken.map(t => taakHtml(t, vd)).join('') : '<div class="empty">Alles voor vandaag is klaar.</div>'}
    ${klaarVandaag.length ? `<details class="mt8"><summary>${klaarVandaag.length} klaar vandaag</summary>${klaarVandaag.map(t => taakHtml(t, vd)).join('')}</details>` : ''}
    ${straks.length ? `<details class="mt8"><summary>Hierna</summary>${straks.map(t => taakHtml(t, vd)).join('')}</details>` : ''}
  </div>

  ${ritme.length ? `<div class="card"><h3>Dagritme</h3>${ritme.map(r => `<div class="task ${tik('r:' + vd + ':' + r.id) ? 'klaar' : ''}">${tikKnop('r:' + vd + ':' + r.id)}
     <div class="grow"><div class="tt"><span class="code">${esc(r.tijd)}</span> ${esc(r.titel)}</div><div class="td">${esc(r.uitleg)} ${r.link ? `<a href="${esc(r.link)}">open</a>` : ''}</div></div></div>`).join('')}</div>` : ''}

  <div class="card"><div class="row between"><h3>Nog van jou nodig</h3><a class="small" href="#/planning">${openVragen} open →</a></div>
    <div class="small muted mt4">De app bouwt door zonder deze antwoorden; ze maken de voorstellen beter.</div></div>`;
}
// cijfers per dag bewaren (eerste keer per dag, en alleen als de backorders van vandaag zijn) → trend op Planning
function kpiVastleggen(vd, k){
  const bo = dataDatums().backorders;
  if(!bo || isoDag(bo) !== vd) return;
  const oud = D.TAKEN['kpi:' + vd];
  if(oud && oud.bo === k.bo && oud.mv === k.mv && oud.ronde === k.ronde) return;
  const v = Object.assign({ op:new Date().toISOString() }, k);
  D.TAKEN['kpi:' + vd] = v;
  WH.catPatch('wh-taken', { ['kpi:' + vd]:v }).catch(() => {});
}
function kpiTabel(){
  const rijen = Object.entries(D.TAKEN).filter(([k]) => k.startsWith('kpi:')).map(([k, v]) => Object.assign({ dag:k.slice(4) }, v)).sort((a, b) => b.dag.localeCompare(a.dag)).slice(0, 20);
  if(!rijen.length) return '<div class="small muted">Nog geen cijfers. Elke dag dat je de backorders inlaadt en Vandaag opent, legt de app ze vast.</div>';
  return `<div class="scroll"><table><tr><th>Dag</th><th class="n">Backorders</th><th class="n">Vast door bulk</th><th class="n">te verplaatsen</th><th class="n">VST-orders</th><th class="n">Aanvulronde</th><th class="n">Vastzittend</th><th class="n">Bevestigd</th></tr>
    ${rijen.map(r => `<tr><td>${esc(fdate(r.dag))}</td><td class="n">${nf(r.bo)}</td><td class="n">${nf(r.orders)}</td><td class="n">${nf(r.mv)}</td><td class="n">${nf(r.vstOrders)}</td><td class="n">${nf(r.ronde)}</td><td class="n">${nf(r.vast)}</td><td class="n">${nf(r.bev)}</td></tr>`).join('')}</table></div>`;
}
function taakHtml(t, vd){
  const k = 't:' + t.id;
  const laat = t.datum < vd && !tik(k);
  return `<div class="task ${tik(k) ? 'klaar' : ''}">${tikKnop(k)}<div class="grow">
    <div class="tt"><span class="prio p${t.prio}"></span>${esc(t.titel)} ${laat ? badge('sinds ' + kort(t.datum), 'b-bad') : t.datum !== vd ? badge(kort(t.datum), 'b-grey') : ''}</div>
    <div class="td">${esc(t.uitleg)} ${t.link ? `<a href="${esc(t.link)}">open</a>` : ''}</div>
    <div class="wie mt4">${esc(t.wie)}</div></div></div>`;
}

/* =====================================================================
   AANVULLEN
   ===================================================================== */
function viewAanvullen(tab){
  const C = WHL.bereken();
  const vd = vandaag();
  const mis = [];
  if(!D.BO.length) mis.push('backorders');
  if(!D.ADV) mis.push('aanvuladvies-PDF');
  if(!Object.keys(D.LOC).length) mis.push('locatie-export');
  const tabs = [['nu', '1 · Nu verplaatsen', C.mv.filter(m => WHL.mvStaat(m.code, vd) !== 'klaar').length, 'hot'], ['vst', 'Van VST', C.vst.length, 'vst'],
    ['ronde', '2 · Aanvulronde', C.ronde.filter(r => !tik('rd:' + vd + ':' + r.code) && !C.uitzetten.includes(r)).length, ''], ['niet', 'Niet nu', C.deels.length, ''], ['vast', 'Vastzittend', C.vast.length, '']];
  const kop = `<div class="tabs">${tabs.map(([k, t, n, cls]) => `<a class="tab ${k === tab ? 'on' : ''} ${n ? cls : ''}" href="#/aanvullen/${k}">${esc(t)} <span class="nr">${nf(n)}</span></a>`).join('')}</div>
    ${mis.length ? `<div class="card reason">Ontbreekt: <b>${esc(mis.join(', '))}</b>. <a href="#/gegevens">Inladen →</a></div>` : ''}
    ${D.ADV ? `<div class="small muted mb8 noprint">Advies van ${esc(fdt(D.ADV.datum))} · backorders van ${esc(fdt(dataDatums().backorders))}</div>` : ''}`;
  let body = '';
  if(tab === 'vst') body = tabVst(C, vd);
  else if(tab === 'ronde') body = tabRonde(C, vd);
  else if(tab === 'vast') body = tabVast(C);
  else if(tab === 'niet') body = tabNiet(C);
  else body = tabNu(C, vd);
  app.innerHTML = kop + body;
}
function gangFilter(items, sel, veld){
  const g = [...new Set(items.map(x => x[veld]).filter(Boolean))].sort();
  if(g.length < 2) return '';
  return `<div class="filters mb8"><span class="small muted">Gang</span> <button class="btn sm ${!sel ? 'pri' : ''}" data-a="gang" data-v="" data-w="${veld}">alle</button>${g.map(x => `<button class="btn sm ${sel === x ? 'pri' : ''}" data-a="gang" data-v="${esc(x)}" data-w="${veld}">${esc(x)}</button>`).join('')}</div>`;
}
function volgorde(){ try{ return localStorage.getItem('wh-volg') === 'route' ? 'route' : 'oud'; }catch(e){ return 'oud'; } }
function tabNu(C, vd){
  if(!C.mv.length) return `<div class="card empty">Geen orders die wachten op een verplaatsing van bulk.${C.vast.length ? ` <a href="#/aanvullen/vast">${C.vast.length} vastzittend →</a>` : ''}</div>`;
  const volg = volgorde();
  const lijst = C.mv.filter(m => !UI.mvGang || m.gang === UI.mvGang).slice().sort(WHL.mvSort(volg));
  const open = lijst.filter(m => WHL.mvStaat(m.code, vd) !== 'klaar');
  const nOrders = new Set(C.mv.flatMap(m => m.orders)).size;
  const vw = D.TAKEN['dg:' + vd + ':verwerk'];
  return `<div class="card scherm"><div class="row wrap between"><div><h2>1 · Nu verplaatsen</h2>
      <div class="small muted">${plural(C.mv.length, 'product', 'producten')} houden ${plural(nOrders, 'order', 'orders')} tegen die verder compleet zijn. Groot getal = verplaatsen (Picqer-advies, nooit minder dan de orders nodig hebben; naar geen specifieke locatie alleen wat de orders nodig hebben).</div></div>
      <div class="row"><span class="badge b-bad">${open.length} open</span><button class="btn sm pri" data-a="print">Print lijst</button></div></div>
    <div class="filters mt12"><span class="small muted">Volgorde</span>
      <button class="btn sm ${volg === 'oud' ? 'pri' : ''}" data-a="volg" data-v="oud">oudste order eerst</button>
      <button class="btn sm ${volg === 'route' ? 'pri' : ''}" data-a="volg" data-v="route">looproute</button></div>
    <div class="mt8">${gangFilter(C.mv, UI.mvGang, 'gang')}</div>
    ${lijst.map(m => mvHtml(m, vd)).join('')}
    <div class="verwerk mt12 ${vw ? 'klaar' : ''}"><div class="row wrap between"><div>${vw ? '✓ Verwerk backorders gedaan om ' + esc(new Date(vw.op).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' })) : 'Alles verplaatst en in Picqer verwerkt? Picqer → Backorders → <b>Verwerk backorders</b>.'}
      <div class="small muted mt4">Daarna de backorder-export opnieuw inladen: wat er dan nog staat, wordt rood.</div></div>
      <button class="btn ${vw ? '' : 'pri'}" data-a="verwerk">${vw ? 'Toch niet' : 'Verwerk backorders gedaan'}</button></div></div></div>
  ${printTabel('1 · Nu verplaatsen', open.map(m => ({ code:m.code, naam:m.naam, van:m.van, naar:m.naar, geen:!m.naar, aantal:m.verpl, extra:mvMeta(m) })))}`;
}
function mvMeta(m){
  const d = [plural(m.orders.length, 'order', 'orders') + ' · oudste ' + kort(m.datum)];
  if(m.pickst !== null && m.pickst !== undefined) d.push('op pick ' + nf(m.pickst));
  d.push(nf(m.stuks) + ' voor orders');
  if(m.naar && m.spp && m.verpl >= m.spp && m.verpl % m.spp === 0) d.push('= ' + plural(m.verpl / m.spp, 'pallet', 'pallets'));
  if(m.soort === 'retour') d.push('van retourkar ' + (m.van || []).join(', '));
  if(m.dz) d.push('deelzending');
  return d.join(' · ');
}
function mvHtml(m, vd){
  const k = 'mv:' + vd + ':' + m.code;
  const st = WHL.mvStaat(m.code, vd);
  const tk = D.TAKEN[k], vw = D.TAKEN['dg:' + vd + ':verwerk'];
  const pr = WHL.prof(m.code);
  const tijd = iso => new Date(iso).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' });
  const naar = m.naar ? locs(m.naar) : m.voorstelPick ? `<span class="badge b-warn">geen specifieke locatie</span> <span class="small muted">of nieuw:</span> ${locBadge(m.voorstelPick)}` : '<span class="badge b-warn">geen specifieke locatie</span>';
  return `<div class="mv metbc ${st === 'klaar' ? 'klaar' : ''} ${st === 'nogopen' ? 'nogopen' : ''}">
    <div class="task" style="border:0;padding:0">${tikKnop(k, 'verplaatst')}</div>
    <div><div><a class="code" href="#/p/${encodeURIComponent(m.code)}">${esc(m.code)}</a> <span class="desc">${esc(m.naam)}</span>${m.dz ? ' ' + badge('deelzending', 'b-info') : ''}</div>
      <div class="route"><span class="rl">van</span>${locs(m.van) || '<span class="badge b-grey">bulk onbekend</span>'}<span class="pijl">→</span><span class="rl">naar</span>${naar}</div>
      <div class="meta">${esc(mvMeta(m))}${m.advAantal && m.advAantal !== m.verpl ? ' · Picqer-advies ' + nf(m.advAantal) : ''}${m.soort === 'bulk' ? ' · ' + esc(m.t) : ''}</div>
      <div class="meta">${m.od.map(o => esc(o.nr) + ' ×' + nf(o.aantal) + (o.dz ? ' (van ' + nf(o.besteld) + ')' : '') + ' <span class="muted">' + esc(kort(o.datum)) + '</span>').join(' · ')}</div>
      ${st === 'nogopen' ? `<div class="meta rood">Afgevinkt om ${esc(tijd(tk.op))}, maar na Verwerk backorders (${esc(tijd(vw.op))}) staat hij er nog. In Picqer echt verplaatst? Genoeg?</div>` : ''}
      ${pr && pr.final.type === 'bulk' && pr.bulks.length ? '<div class="meta">Alleen bulk: na verplaatsen blijft er geen picklocatie. Loopt het vaker? Geef een picklocatie in <a href="#/p/' + encodeURIComponent(m.code) + '">Aanvulbase</a>.</div>' : ''}
    </div>
    <div class="bc">${bc(m.code)}</div>
    <div class="aant">${nf(m.verpl)}<small>verplaatsen</small></div>
  </div>`;
}
// papieren lijst (zelfde als Junior): één regel per product, barcode om in Picqer te scannen, vakje en ruimte voor het echte aantal
function printTabel(titel, rijen, perGang){
  let vorige = null;
  const tijd = new Date().toLocaleString('nl-NL', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
  const tr = rijen.map(r => {
    let kop = '';
    if(perGang && r.gang !== vorige){ kop = `<tr class="pgang"><td colspan="7">Gang ${esc(r.gang)}</td></tr>`; vorige = r.gang; }
    return kop + `<tr><td class="pv"><span class="pvak"></span></td>
      <td><b class="code">${esc(r.code)}</b><div class="pn">${esc(r.naam || '')}</div><div class="pm">${esc(r.extra || '')}</div></td>
      <td class="loc">${(r.van || []).map(esc).join('<br>')}</td>
      <td class="loc naar">${r.geen ? '<span class="pgeen">geen specifieke locatie</span>' : (r.naar || []).map(esc).join('<br>')}</td>
      <td class="pa">${nf(r.aantal)}</td><td class="pbc">${bc(r.code)}</td><td class="pg"></td></tr>`;
  }).join('');
  const pnaam = 'Aanvullen - ' + titel.replace(/^\d\s*·\s*/, '').replace(/\s*·\s*/g, ' ');
  return `<div class="printonly" data-printnaam="${esc(pnaam)}"><div class="pkop"><b>IVOL · ${esc(titel)}</b><span>afgedrukt ${esc(tijd)} · backorders ${esc(fdt(dataDatums().backorders))} · advies ${esc(fdt(dataDatums().advies))}</span></div>
    <div class="ptip">Picqer-app → Aanvuladvies: scan de barcode, het verplaatsvenster opent. Kies bij NAAR de picklocatie, niet een container (containers 1–6 zijn retourkarren).</div>
    <table class="ptab"><colgroup><col style="width:5%"><col style="width:29%"><col style="width:13%"><col style="width:14%"><col style="width:8%"><col style="width:23%"><col style="width:8%"></colgroup>
    <thead><tr><th></th><th>Product</th><th>Van (bulk)</th><th>Naar (pick)</th><th>Aantal</th><th></th><th>Gedaan</th></tr></thead><tbody>${tr}</tbody></table>
    <div class="ptip mt8">Klaar? Picqer → Backorders → <b>Verwerk backorders</b>.</div></div>`;
}
function tabNiet(C){
  if(!C.deels.length) return '<div class="card empty">Geen backorders waarbij verplaatsen een order niet compleet maakt.</div>';
  const regel = x => {
    const r = x.anderen && x.anderen.length && !x.eigen ? 'wacht ook op ' + x.anderen.map(a => a.code + ' (' + nf(a.besch) + '/' + nf(a.aantal) + ')').join(', ')
      : x.vst ? 'rest komt van VST (zie Van VST)' : nf(x.besch) + ' van ' + nf(x.aantal) + ' op voorraad';
    const dz = tik('dz:' + x.nr);
    return `<div class="row wrap mt4"><span class="code">${esc(x.nr)}</span> <span class="small muted">${esc(kort(x.datum))}</span> <span class="small">${esc(r)}</span>
      <button class="btn sm ${dz ? 'ok' : ''}" data-a="dz" data-nr="${esc(x.nr)}">${dz ? '✓ deelzending: staat bij Nu verplaatsen' : 'Deelzending afgesproken'}</button></div>`;
  };
  return `<div class="card"><h2>Niet nu</h2><div class="small muted">Wel backorder en voorraad op bulk, maar verplaatsen maakt de order niet compleet: het product is maar deels op voorraad, of de order wacht ook op iets anders. Picqer adviseert ze toch (vooral "naar geen specifieke locatie"). Niet verplaatsen. Spreek je met de klantenservice een deelzending af, tik dan <b>Deelzending afgesproken</b>: het beschikbare deel komt bij Nu verplaatsen. Maak de deelzending zelf in Picqer.</div>
    ${C.deels.map(d => `<div class="mv" style="grid-template-columns:1fr auto">
      <div><div><a class="code" href="#/p/${encodeURIComponent(d.code)}">${esc(d.code)}</a> <span class="desc">${esc(d.naam || '')}</span> ${d.adv ? badge('in Picqer-advies: ' + nf(d.adv.aantal), 'b-warn') : badge('niet in het advies', 'b-grey')}</div>
        <div class="route"><span class="rl">van</span>${locs(d.van)}<span class="pijl">→</span><span class="rl">naar</span>${d.naar ? locs(d.naar) : '<span class="badge b-warn">geen specifieke locatie</span>'}</div>
        ${d.orders.map(regel).join('')}</div>
      <div></div></div>`).join('')}</div>`;
}
// palletnummers bij VST: laagste (= oudste) eerst, zoveel als nodig
function vstPallets(v){
  const p = (D.VSTLOC[v.code] || []).slice().sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
  return v.pallets ? p.slice(0, v.pallets) : p;
}
function tabVst(C, vd){
  if(!C.vst.length) return '<div class="card empty">Geen backorders die met VST-voorraad compleet worden.</div>';
  const rijen = C.vst.map(v => {
    const k = 'vst:' + vd + ':' + v.code;
    return `<tr class="${tik(k) ? 'muted' : ''}"><td>${tikKnop(k, 'aangevraagd').replace('class="chk"', 'class="chk" style="width:24px;height:24px"')}</td>
      <td><a class="code" href="#/p/${encodeURIComponent(v.code)}">${esc(v.code)}</a><div class="desc">${esc(v.naam)}</div></td>
      <td class="n">${nf(v.nodig)}</td><td class="n">${nf(v.vstVoorraad)}</td><td class="n hide-m">${v.vk === null ? '–' : nf(v.vk, 1)}</td>
      <td class="n"><b>${nf(v.terug)}</b>${v.pallets ? `<div class="desc">${plural(v.pallets, 'pallet', 'pallets')} à ${nf(v.spp)}</div>` : '<div class="desc">stuks/pallet onbekend</div>'}</td>
      <td class="small hide-m">${plural(v.orders.length, 'order', 'orders')}<div class="desc">sinds ${esc(kort(v.datum))}</div>${(D.VSTLOC[v.code] || []).length ? `<div class="desc">${D.VSTLOC[v.code].length} pallets bij VST · voorstel: ${esc(vstPallets(v).join(', '))}</div>` : ''}</td></tr>`;
  }).join('');
  const mail = 'Hoi Edwin,\n\nWil je de volgende producten terugsturen naar IVOL?\n\n' + C.vst.filter(v => !tik('vst:' + vd + ':' + v.code)).map(v => '- ' + v.code + ': ' + (v.pallets ? v.pallets + ' pallet' + (v.pallets > 1 ? 's' : '') + ' (' + v.terug + ' stuks)' : v.terug + ' stuks') + ((D.VSTLOC[v.code] || []).length ? ' — palletnummers' + (v.pallets && v.pallets < D.VSTLOC[v.code].length ? ' (voorstel, oudste eerst)' : '') + ': ' + vstPallets(v).join(', ') : '')).join('\n') + '\n\nAlvast bedankt.\n\nMet vriendelijke groet,\nDaan van Brunschot\nIVOL';
  const mailto = 'mailto:planning@vanspreuweltransport.nl,edwin@vanspreuweltransport.nl?cc=' + encodeURIComponent('sala@ivol.nl') + '&subject=' + encodeURIComponent('Terughalen naar IVOL') + '&body=' + encodeURIComponent(mail);
  return `<div class="card"><h2>Van VST halen</h2>
    <div class="small muted">Orders die niet compleet zijn in het Hoofdmagazijn maar wel met de voorraad bij VST. Terughalen = nodig voor de orders + aanvullen tot 1,5 maand verkoop, afgerond op hele pallets. Orders die ook met VST niet compleet zijn staan hier niet (wacht op inkoop). Palletnummers: Stockmove-terughaaladvies.</div>
    <div class="scroll mt12"><table><tr><th></th><th>Product</th><th class="n">Nodig</th><th class="n">Bij VST</th><th class="n hide-m">Verkoop/mnd</th><th class="n">Terughalen</th><th class="hide-m">Orders</th></tr>${rijen}</table></div>
    <h3 class="mt16">Mail aan VST</h3><pre class="mono mt8" id="vstmail">${esc(mail)}</pre>
    <div class="row wrap mt8"><button class="btn pri" data-a="kopieer" data-id="vstmail">Kopieer tekst</button><a class="btn" href="${esc(mailto)}">Open in Mail</a></div></div>`;
}
function tabRonde(C, vd){
  if(!D.ADV) return '<div class="card empty">Lees eerst het aanvuladvies (PDF) in bij <a href="#/gegevens">Gegevens</a>.</div>';
  const uitSet = new Set(C.uitzetten.map(r => r.code));
  const lijst = C.ronde.filter(r => !uitSet.has(r.code) && (!UI.rondeGang || r.gang === UI.rondeGang));
  let vorige = null, html = '';
  lijst.forEach(r => {
    if(r.gang !== vorige){
      const n = lijst.filter(x => x.gang === r.gang);
      html += `<div class="gangkop"><b>Gang ${esc(r.gang)}</b><span class="small muted">${n.filter(x => !tik('rd:' + vd + ':' + x.code)).length} open van ${n.length}</span></div>`;
      vorige = r.gang;
    }
    html += rondeHtml(r, vd);
  });
  const uit = C.uitzetten;
  const openR = lijst.filter(r => !tik('rd:' + vd + ':' + r.code));
  return `<div class="card scherm"><div class="row wrap between"><div><h2>2 · Aanvulronde</h2>
      <div class="small muted">Rest van het Picqer-advies (zonder wachtende orders), per gang in looprichting van de bulk. Tik af wat je hebt verplaatst; pas meteen de instellingen aan waar het advies niet klopt.</div></div>
      <button class="btn sm pri" data-a="print">Print lijst</button></div>
    <div class="mt12">${gangFilter(C.ronde, UI.rondeGang, 'gang')}</div>${html || '<div class="empty">Leeg.</div>'}</div>
    ${printTabel('2 · Aanvulronde' + (UI.rondeGang ? ' · gang ' + UI.rondeGang : ''), openR.map(r => ({ code:r.code, naam:r.naam || (r.pr && r.pr.naam) || '', van:r.bulk, naar:r.geenPick ? null : r.pick, geen:r.geenPick, aantal:r.aantal, extra:'op pick ' + nf(r.pickst) + (r.deels ? ' · order nog niet compleet' : ''), gang:r.gang })), true)}
    ${uit.length ? `<div class="card noprint"><h3>Uit het advies halen (${uit.length})</h3>
      <div class="small muted">Geen picklocatie, (bijna) geen verkoop, geen orders: horen niet in het advies. <b>1.</b> Neem ze mee in de Picqer-import (aanvulniveau en vul aan tot leeg). <b>2.</b> Blijven ze staan, zet dan in Picqer bij het product het knopje "Vul pickvoorraad aan van bulk locaties" uit.</div>
      <div class="mt8">${uit.map(r => `<span class="code">${esc(r.code)}</span>`).join(', ')}</div>
      <div class="row wrap mt8"><button class="btn" data-a="exp-uit">Picqer-import: niveaus leeg (${uit.length})</button></div></div>` : ''}`;
}
function rondeHtml(r, vd){
  const k = 'rd:' + vd + ':' + r.code;
  const pr = r.pr;
  const open = UI.open['r:' + r.code];
  const f = pr ? pr.final : null;
  return `<div class="mv metbc ${tik(k) ? 'klaar' : ''}">
    <div class="task" style="border:0;padding:0">${tikKnop(k, 'aangevuld')}</div>
    <div><div><a class="code" href="#/p/${encodeURIComponent(r.code)}">${esc(r.code)}</a> <span class="desc">${esc(r.naam || (pr && pr.naam) || '')}</span></div>
      <div class="route"><span class="rl">van</span>${locs(r.bulk)}<span class="pijl">→</span><span class="rl">naar</span>${r.geenPick ? '<span class="badge b-warn">geen picklocatie</span>' : locs(r.pick)}</div>
      ${r.deels ? `<div class="meta">${badge('backorder, order nog niet compleet', 'b-grey')} ${esc(r.deels.orders.map(o => o.nr).join(', '))}: gewoon aanvullen, maakt de order niet compleet</div>` : ''}
      ${WHL.bereken().vst.some(v => v.code === r.code) ? '<div class="meta"><span class="badge b-vst">wacht op VST</span> verplaatsen maakt geen order compleet, zie Van VST</div>' : ''}
      <div class="meta">pickvoorraad ${nf(r.pickst)}${pr && f.type !== 'bulk' ? ' · Picqer ' + (pr.pq.lvl ?? '–') + '/' + (pr.pq.tot ?? '–') + ' → voorstel ' + (f.lvl ?? '–') + '/' + (f.tot ?? '–') : ''}${pr ? ' ' + badge(typeNaam[f.type] || f.type || '', typeCls[f.type]) : ''} <button class="btn ghost sm" data-a="open" data-k="r:${esc(r.code)}">${open ? 'sluit' : 'instellen'}</button></div>
      ${open && pr ? `<div class="edit">${editVelden(pr)}</div>` : ''}
    </div>
    <div class="bc">${bc(r.code)}</div>
    <div class="aant">${nf(r.aantal)}<small>advies</small></div></div>`;
}
function tabVast(C){
  if(!C.vast.length) return '<div class="card empty">Geen orders die volledig beschikbaar zijn en toch vastzitten.</div>';
  return `<div class="card"><h2>Vastzittend</h2><div class="small muted">Alle regels beschikbaar, maar de app vindt geen bulkverplaatsing die de order tegenhoudt. Kijk in Picqer: gepauzeerd, handmatige picklijst, of nog niet verwerkt (Verwerk backorders).</div>
    <div class="scroll mt12"><table><tr><th>Order</th><th>Sinds</th><th>Regels</th><th>Reden</th></tr>
    ${C.vast.map(({ o, reden }) => `<tr><td class="code">${esc(o.nr)}</td><td class="small">${esc(kort(o.datum))}</td>
      <td class="small">${o.regels.map(r => `<a class="code" href="#/p/${encodeURIComponent(r.code)}">${esc(r.code)}</a> ×${nf(r.aantal)}`).join('<br>')}</td><td class="small">${esc(reden)}</td></tr>`).join('')}</table></div></div>`;
}

/* ---------- invulvelden per product (overal hetzelfde) ---------- */
function editVelden(pr){
  const f = pr.final, v = pr.voorstel, e = pr.eigen || {};
  const cls = k => e[k] === undefined ? 'voor' : '';
  const pickOpties = [...new Set([].concat(pr.picks, v.pick && !pr.picks.includes(v.pick) ? [v.pick] : [], f.pick && !pr.picks.includes(f.pick) ? [f.pick] : []))];
  return `<div class="fields" data-pr="${esc(pr.code)}">
    <div class="fld"><label>Picklocatie</label><input class="loc ${cls('pick')}" data-f="pick" value="${esc(f.pick || '')}" list="dl-${esc(pr.code)}" placeholder="geen"><datalist id="dl-${esc(pr.code)}">${pickOpties.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
    <div class="fld"><label>Aanvullen onder</label><input class="num ${cls('lvl')}" data-f="lvl" inputmode="numeric" value="${esc(f.lvl ?? '')}"></div>
    <div class="fld"><label>Vul aan tot</label><input class="num ${cls('tot')}" data-f="tot" inputmode="numeric" value="${esc(f.tot ?? '')}"></div>
    <div class="fld"><label>Soort</label><select data-f="type" class="${cls('type')}">${['vloer', 'legbord', 'speciaal', 'bulk'].map(t => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${esc(typeNaam[t])}</option>`).join('')}</select></div>
  </div>
  <div class="small muted mt8">Picqer nu: ${esc(pr.pq.lvl ?? '–')} / ${esc(pr.pq.tot ?? '–')}${pr.spp ? ' · ' + nf(pr.spp) + ' per pallet' : ''}${pr.vk !== null ? ' · verkoop ' + nf(pr.vk, 1) + '/mnd' : ''}. Geel = voorstel van de app.</div>
  ${pr.redenen.length ? `<div class="small mt4">${pr.redenen.map(r => badge(r.t, r.lvl === 'let' ? 'b-warn' : 'b-grey')).join(' ')}</div>` : ''}
  <div class="row wrap mt8"><button class="btn sm ok" data-a="bev" data-code="${esc(pr.code)}">Klopt, bevestig</button>
    ${pr.eigen ? `<button class="btn sm" data-a="herstel" data-code="${esc(pr.code)}">Terug naar voorstel</button>` : ''}
    <a class="btn sm ghost" href="#/p/${encodeURIComponent(pr.code)}">productkaart</a></div>`;
}
function leesVelden(code){
  const box = document.querySelector(`[data-pr="${CSS.escape(code)}"]`);
  if(!box) return null;
  const val = f => { const el = box.querySelector(`[data-f="${f}"]`); return el ? el.value.trim() : ''; };
  const pick = val('pick').toUpperCase();
  const lvl = val('lvl') === '' ? null : num(val('lvl'));
  const tot = val('tot') === '' ? null : num(val('tot'));
  const type = val('type');
  return { pick:pick || null, lvl, tot, type };
}
async function bevestig(codes, velden){
  const patch = {};
  codes.forEach(code => {
    const pr = WHL.prof(code); if(!pr) return;
    const v = (velden && velden[code]) || { pick:pr.final.pick, lvl:pr.final.lvl, tot:pr.final.tot, type:pr.final.type };
    if(v.type === 'bulk'){ v.lvl = null; v.tot = null; }
    patch[code] = { pick:v.pick || null, lvl:v.lvl, tot:v.tot, type:v.type, ok:true, op:new Date().toISOString() };
  });
  if(!Object.keys(patch).length) return;
  await WH.catPatch('wh-aanvul', patch);
  WHL.reset();
  toast(Object.keys(patch).length === 1 ? Object.keys(patch)[0] + ' bevestigd' : Object.keys(patch).length + ' producten bevestigd');
  rerender();
}

/* =====================================================================
   AANVULBASE
   ===================================================================== */
function viewBase(q){
  const C = WHL.bereken();
  // filters uit de link alleen toepassen als de link zelf verandert (anders overschrijft de link je eigen keuze)
  if(location.hash !== UI.lastHash){
    UI.lastHash = location.hash;
    if(Object.keys(q || {}).length){ Object.assign(UI.base, { q:'', hal:'', type:'', status:'', abc:'', f:'', gang:'', afd:'', tri:'', max:150 }); Object.keys(q).forEach(k => { if(k in UI.base) UI.base[k] = q[k]; }); }
  }
  const B = UI.base;
  const gangen = B.gang ? String(B.gang).split(',') : null;
  const alle = Object.values(C.prof);
  const zoek = B.q.trim().toLowerCase();
  const lijst = alle.filter(p => {
    if(zoek && !(p.code.toLowerCase().includes(zoek) || p.naam.toLowerCase().includes(zoek) || p.locs.some(l => l.toLowerCase().includes(zoek)))) return false;
    const g = WHL.locInfo(p.final.pick || p.bulks[0] || '').gang || '';
    if(B.hal && !g.startsWith(B.hal)) return false;
    if(gangen && !gangen.includes(g)) return false;
    if(B.type && p.final.type !== B.type) return false;
    if(B.status && p.status !== B.status) return false;
    if(B.abc && (p.abc || '-') !== B.abc) return false;
    if(B.afd && (window.WHT ? WHT.afdVan(p.code) : '') !== (B.afd === '-' ? '' : B.afd)) return false;
    if(B.tri && (window.WHT ? WHT.statusVan(p.code) : '') !== (B.tri === '-' ? '' : B.tri)) return false;
    if(B.f === 'nieuw' && !p.final.nieuwePick) return false;
    if(B.f === 'legbord' && p.final.type !== 'legbord') return false;
    if(B.f === 'wijzigt' && !p.picqerWijzigt) return false;
    if(B.f === 'tijd' && !p.redenen.some(r => /tijdelijk/.test(r.t))) return false;
    if(B.f === 'gemeld' && !(p.eigen && p.eigen.meld)) return false;
    return true;
  }).sort((a, b) => (b.vk || 0) - (a.vk || 0) || a.code.localeCompare(b.code));
  const tel = s => alle.filter(p => p.status === s).length;
  const toon = lijst.slice(0, B.max);
  const nWijzigt = lijst.filter(p => p.imp).length;
  const nKoppel = lijst.filter(p => p.final.nieuwePick && !p.conts.length).length;
  const nBevZichtbaar = lijst.filter(p => p.status !== 'bevestigd').length;
  app.innerHTML = `<div class="card"><div class="row wrap between"><div><h2>Aanvulbase</h2>
    <div class="small muted">Per product: picklocatie, wanneer aanvullen (onder) en tot hoeveel. De app vult alles voor op basis van locatie, stuks per pallet en verkoop (geel). Bevestigen = jouw waarheid; de Picqer-import neemt alleen mee wat afwijkt van Picqer.</div></div>
    <div class="small">${badge(tel('voorstel') + ' voorstel', 'b-warn')} ${badge(tel('bevestigd') + ' bevestigd', 'b-ok')} ${badge(tel('gelijk') + ' gelijk aan Picqer', 'b-grey')}</div></div>
    <div class="filters mt12">
      <input class="q" data-bf="q" placeholder="zoek code, naam of locatie" value="${esc(B.q)}">
      <select data-bf="hal"><option value="">alle hallen</option>${['A', 'B', 'C', 'D'].map(h => `<option ${B.hal === h ? 'selected' : ''}>${h}</option>`).join('')}</select>
      <select data-bf="type"><option value="">alle soorten</option>${Object.entries(typeNaam).map(([k, t]) => `<option value="${k}" ${B.type === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <select data-bf="status"><option value="">alle statussen</option>${['voorstel', 'bevestigd', 'gelijk'].map(s => `<option ${B.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <select data-bf="abc"><option value="">ABC</option>${['A', 'B', 'C', '-'].map(s => `<option ${B.abc === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <select data-bf="afd"><option value="">alle afdelingen</option>${['-'].concat(window.WHT ? WHT.afdelingen() : []).map(s => `<option value="${esc(s)}" ${B.afd === s ? 'selected' : ''}>${s === '-' ? 'zonder afdeling' : esc(s)}</option>`).join('')}</select>
      <select data-bf="tri"><option value="">triage: alles</option>${[['g', 'Belangrijk'], ['o', 'Medium'], ['r', 'Zelden'], ['x', 'Weg'], ['-', 'nog niet beoordeeld']].map(([k, t]) => `<option value="${k}" ${B.tri === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select data-bf="f"><option value="">geen extra filter</option>${[['nieuw', 'nieuwe picklocatie'], ['wijzigt', 'wijkt af van Picqer'], ['legbord', 'doos/bak: capaciteit'], ['tijd', 'picklocatie tijdelijk'], ['gemeld', 'gemeld vanuit het magazijn (Junior)']].map(([k, t]) => `<option value="${k}" ${B.f === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
      ${B.gang ? `<span class="badge b-info">gang ${esc(B.gang)}</span> <button class="btn ghost sm" data-a="basegang">×</button>` : ''}
    </div>
    <div class="row wrap mt12">
      <span class="small"><b>${nf(lijst.length)}</b> producten</span>
      <button class="btn sm ok" data-a="bev-alle" ${nBevZichtbaar ? '' : 'disabled'}>Bevestig zichtbare (${nf(nBevZichtbaar)})</button>
      <button class="btn sm pri" data-a="exp-aanvul" ${nWijzigt ? '' : 'disabled'}>Picqer-import aanvulniveaus (${nf(nWijzigt)})</button>
      <button class="btn sm" data-a="exp-koppel" ${nKoppel ? '' : 'disabled'}>Picqer-import picklocaties koppelen (${nf(nKoppel)})</button>
    </div>
    <div class="small muted mt8">Import in Picqer: Producten → Importeren → "Alleen bestaande producten bijwerken". Test een nieuw soort import eerst met 2–3 producten.</div></div>
  <div class="card">${toon.map(baseRij).join('') || '<div class="empty">Geen producten met deze filters.</div>'}
    ${lijst.length > toon.length ? `<div class="row mt12"><button class="btn" data-a="meer">Toon meer (${nf(lijst.length - toon.length)} verborgen)</button></div>` : ''}</div>`;
  app.__lijst = lijst;
}
const triBadges = c => {
  if(!window.WHT) return '';
  const s = WHT.statusVan(c), a = WHT.afdVan(c);
  return (s ? badge(WHT.SL[s], { g:'b-ok', o:'b-warn', r:'b-bad', x:'b-grey' }[s]) + ' ' : '') + (a ? badge(a, 'b-info') + ' ' : '');
};
function baseRij(p){
  const f = p.final, open = UI.open['b:' + p.code];
  const st = { voorstel:['voorstel', 'b-warn'], bevestigd:['bevestigd', 'b-ok'], gelijk:['= Picqer', 'b-grey'] }[p.status];
  return `<div class="mv" style="grid-template-columns:1fr auto">
    <div><div><a class="code" href="#/p/${encodeURIComponent(p.code)}">${esc(p.code)}</a> <span class="desc">${esc(p.naam)}</span></div>
      <div class="route">${p.picks.length ? locs(p.picks) : ''}${f.nieuwePick ? ' ' + badge('nieuw: ' + f.pick, 'b-warn') : ''}${p.bulks.length ? ' <span class="pijl">·</span> ' + locs(p.bulks.slice(0, 4)) + (p.bulks.length > 4 ? ' +' + (p.bulks.length - 4) : '') : ''}${p.conts.length ? ' ' + locs(p.conts) : ''}</div>
      <div class="meta">${badge(typeNaam[f.type] || f.type, typeCls[f.type])} ${p.abc ? badge('ABC ' + p.abc, 'b-grey') : ''} ${triBadges(p.code)}voorraad ${nf(p.st)}${p.vst ? ' · VST ' + nf(p.vst) : ''} · verkoop ${p.vk === null ? '?' : nf(p.vk, 1)}/mnd${p.spp ? ' · ' + nf(p.spp) + '/pallet' : ''} · Picqer ${p.pq.lvl ?? '–'}/${p.pq.tot ?? '–'} → <b>${f.lvl ?? '–'}/${f.tot ?? '–'}</b>
        <button class="btn ghost sm" data-a="open" data-k="b:${esc(p.code)}">${open ? 'sluit' : 'aanpassen'}</button></div>
      ${open ? `<div class="edit">${editVelden(p)}</div>` : ''}</div>
    <div>${badge(st[0], st[1])}</div></div>`;
}

/* =====================================================================
   A/B-CHECK: lopers die een goede picklocatie en echte aanvulniveaus moeten hebben
   Loper = ABC A of B (Picqer) of triage Belangrijk/Medium. Per loper wat er nog mist, meest verkocht eerst.
   ===================================================================== */
const AB_STAP = [
  ['pick', 'Geen picklocatie', 'Staat alleen op bulk of op geen specifieke locatie. Met "bulk in backorder" blijft elke order hangen tot iemand verplaatst. Geef een vaste picklocatie (voorstel: vrije vloerplek onder de bulk).'],
  ['tijd', 'Picklocatie op tijdelijk', 'Ontkoppelt bij voorraad 0: daarna weet Picqer niet meer waar hij hoort. Zet de locatie op vast (Locaties → import).'],
  ['niveau', 'Geen aanvulniveau in Picqer', 'Heeft een picklocatie, maar Picqer vult niet aan (aanvulniveau of "vul aan tot" leeg). Vul de niveaus in en importeer.'],
  ['afwijk', 'Niveau wijkt af van het voorstel', 'Picqer-waarden (vaak de standaard 1 / 11) passen niet bij de verkoop of de palletgrootte. Controleer en bevestig.'],
  ['meer', 'Meerdere picklocaties', 'Twee of meer picklocaties: bewust (bv. pallet + doos) of opruimen?'],
  ['ok', 'In orde', 'Picklocatie vast, niveaus in Picqer en bevestigd of gelijk aan het voorstel.']
];
function abLopers(){
  const C = WHL.bereken();
  const tri = c => window.WHT ? WHT.statusVan(c) : '';
  return Object.values(C.prof).filter(p => {
    if(p.virt || (D.P[p.code] || {}).actief === false) return false;
    const t = tri(p.code);
    if(t === 'r' || t === 'x') return false;                     // triage zegt zelden/weg
    return p.abc === 'A' || p.abc === 'B' || t === 'g' || t === 'o';
  }).map(p => {
    const f = p.final, mist = [];
    const pi = f.pick ? WHL.locInfo(f.pick) : null;
    if(!f.pick || f.type === 'bulk' || f.type === 'los') mist.push('pick');
    else {
      if(pi && pi.bestaat && pi.tijd) mist.push('tijd');
      if(p.pq.lvl === null || p.pq.tot === null) mist.push('niveau');
      else if(p.imp && p.status !== 'bevestigd') mist.push('afwijk');
      if(p.picks.length > 1) mist.push('meer');
      if(f.nieuwePick && p.status !== 'bevestigd') mist.push('pick');
    }
    return { p, mist, stap:mist[0] || 'ok' };
  }).sort((a, b) => (b.p.vk || 0) - (a.p.vk || 0) || a.p.code.localeCompare(b.p.code));
}
function viewAB(){
  const lijst = abLopers();
  const sel = UI.ab || (lijst.some(x => x.stap === 'pick') ? 'pick' : 'niveau');
  const tel = k => lijst.filter(x => k === 'ok' ? x.stap === 'ok' : x.mist.includes(k)).length;
  const rij = AB_STAP.find(x => x[0] === sel) || AB_STAP[0];
  const toon = lijst.filter(x => sel === 'ok' ? x.stap === 'ok' : x.mist.includes(sel));
  const max = UI.abMax || 100;
  const nA = lijst.filter(x => x.p.abc === 'A').length, nB = lijst.filter(x => x.p.abc === 'B').length;
  const ok = tel('ok');
  // zonder picklocatie alleen bevestigen als de app een picklocatie voorstelt (anders zou je "alleen bulk" bevestigen)
  const magBev = x => x.p.status !== 'bevestigd' && !(sel === 'pick' && !x.p.final.nieuwePick);
  const nBev = toon.filter(magBev).length;
  app.__bev = toon.filter(magBev).map(x => x.p.code);
  app.innerHTML = `<div class="card"><div class="row wrap between"><div><h2>A/B-check</h2>
      <div class="small muted">${nf(lijst.length)} lopers (${nf(nA)} A, ${nf(nB)} B, rest triage Belangrijk/Medium). Een loper hoort een vaste picklocatie en echte aanvulniveaus te hebben, anders blijven orders in backorder hangen. Werk de stappen van links naar rechts af; meest verkocht eerst.</div></div>
      <div class="ab-voortgang"><b>${nf(ok)}</b> / ${nf(lijst.length)} in orde<div class="balk"><i style="width:${lijst.length ? Math.round(ok / lijst.length * 100) : 0}%"></i></div></div></div>
    <div class="tabs mt12">${AB_STAP.map(([k, t]) => `<a class="tab ${k === sel ? 'on' : ''} ${k !== 'ok' && tel(k) ? 'hot' : ''}" href="javascript:void 0" data-a="ab" data-v="${k}">${esc(t)} <span class="nr">${nf(tel(k))}</span></a>`).join('')}</div>
    <div class="reason">${esc(rij[2])}${sel === 'pick' ? ' Zonder voorstel: tik instellen en typ zelf een picklocatie.' : ''}</div></div>
  <div class="card">${toon.slice(0, max).map(x => abRij(x)).join('') || '<div class="empty">Niets in deze stap.</div>'}
    ${toon.length > max ? `<div class="row mt12"><button class="btn" data-a="ab-meer">Toon meer (${nf(toon.length - max)})</button></div>` : ''}</div>
  <div class="card"><h3>Naar Picqer</h3><div class="small muted mt4">Alleen de lopers uit deze stap. Import in Picqer: Producten → Importeren → "Alleen bestaande producten bijwerken". Test een nieuw soort import eerst met 2–3 producten.</div>
    <div class="row wrap mt8"><button class="btn sm ok" data-a="ab-bev" ${nBev ? '' : 'disabled'}>Bevestig alle zichtbare (${nf(nBev)})</button>
      <button class="btn sm pri" data-a="ab-exp-aanvul">Picqer-import aanvulniveaus</button>
      <button class="btn sm" data-a="ab-exp-koppel">Picqer-import picklocaties koppelen</button>
      ${sel === 'tijd' ? '<a class="btn sm" href="#/locaties">Locatie-import (vast zetten)</a>' : ''}</div></div>`;
  app.__lijst = toon.map(x => x.p);
}
function abRij(x){
  const p = x.p, f = p.final, open = UI.open['ab:' + p.code];
  const st = { voorstel:['voorstel', 'b-warn'], bevestigd:['bevestigd', 'b-ok'], gelijk:['= Picqer', 'b-grey'] }[p.status];
  const naamStap = k => (AB_STAP.find(s => s[0] === k) || [k, k])[1].toLowerCase();
  return `<div class="mv" style="grid-template-columns:1fr auto">
    <div><div><a class="code" href="#/p/${encodeURIComponent(p.code)}">${esc(p.code)}</a> <span class="desc">${esc(p.naam)}</span> ${p.abc ? badge('ABC ' + p.abc, 'b-grey') : ''} ${triBadges(p.code)}</div>
      <div class="route">${p.picks.length ? '<span class="rl">pick</span>' + locs(p.picks) : ''}${f.nieuwePick ? ' ' + badge('voorstel pick: ' + f.pick, 'b-warn') : ''}${p.bulks.length ? ' <span class="rl">bulk</span>' + locs(p.bulks.slice(0, 3)) + (p.bulks.length > 3 ? ' +' + (p.bulks.length - 3) : '') : ''}${p.conts.length ? ' ' + locs(p.conts) : ''}${!p.locs.length ? badge('geen locatie', 'b-warn') : ''}</div>
      <div class="meta">verkoop ${p.vk === null ? '?' : nf(p.vk, 1)}/mnd${p.spp ? ' · ' + nf(p.spp) + '/pallet' : ''} · voorraad ${nf(p.st)}${p.vst ? ' · VST ' + nf(p.vst) : ''} · Picqer ${p.pq.lvl ?? '–'}/${p.pq.tot ?? '–'} → <b>${f.lvl ?? '–'}/${f.tot ?? '–'}</b> ${badge(typeNaam[f.type] || f.type || '', typeCls[f.type])}${x.mist.length > 1 ? ' · ook: ' + esc(x.mist.slice(1).map(naamStap).join(', ')) : ''}
        <button class="btn ghost sm" data-a="open" data-k="ab:${esc(p.code)}">${open ? 'sluit' : 'instellen'}</button></div>
      ${open ? `<div class="edit">${editVelden(p)}</div>` : ''}</div>
    <div>${badge(st[0], st[1])}</div></div>`;
}

/* =====================================================================
   PRODUCTKAART (aanvul-kant)
   ===================================================================== */
function viewProduct(code){
  const C = WHL.bereken();
  code = D.PLOW[String(code).toLowerCase()] || code;
  const p = C.prof[code];
  const P = D.P[code];
  if(!P){ app.innerHTML = `<a href="#/base" class="small">← Aanvulbase</a><div class="card empty">Product <b>${esc(code)}</b> staat niet in de productimport.</div>`; return; }
  const bo = D.BO.filter(r => (D.PLOW[String(r.productcode || '').toLowerCase()] || r.productcode) === code);
  const a = C.adv[code];
  app.innerHTML = `<a href="javascript:history.back()" class="small">← terug</a>
  <div class="card mt8"><div class="row wrap between"><div><span class="code" style="font-size:16px">${esc(code)}</span><div>${esc(P.naam || '')}</div><div class="small muted">${esc(P.leverancier || '')}</div></div>
    ${p ? badge(typeNaam[p.final.type] || p.final.type, typeCls[p.final.type]) : ''}</div>
    <div class="kv mt12">
      <span>Voorraad</span><div>Hoofdmagazijn <b>${nf(num(P.voorraad_hm))}</b> (vrij ${nf(num(P.vrij_hm))}) · VST <b>${nf(num(P.voorraad_vst))}</b></div>
      <span>Locaties</span><div>${locs(WHL.locsVan(code)) || '<span class="muted">geen (geen specifieke locatie)</span>'}</div>
      <span>Verkoop</span><div>${p && p.vk !== null ? nf(p.vk, 1) + ' per maand' : 'onbekend (Magazijnverkopen inladen)'}${P.abc ? ' · ABC ' + esc(P.abc) : ''}</div>
      <span>Per pallet</span><div>${p && p.spp ? nf(p.spp) : 'onbekend (Palletlabels)'}</div>
      <span>Picqer</span><div>aanvullen onder ${esc(p ? p.pq.lvl ?? '–' : '–')}, vul aan tot ${esc(p ? p.pq.tot ?? '–' : '–')}</div>
      ${a ? `<span>Aanvuladvies</span><div>${nf(a.aantal)} van ${locs(a.bulk)} naar ${a.geenPick ? 'geen picklocatie' : locs(a.pick)} · pickvoorraad ${nf(a.pickst)}</div>` : ''}
      ${bo.length ? `<span>Backorders</span><div>${bo.map(r => esc(r.bestelling) + ' ×' + nf(num(r.aantal)) + ' (' + nf(num(r.beschikbaar)) + ' beschikbaar)').join('<br>')}</div>` : ''}
    </div></div>
  ${p ? `<div class="card"><h3>Aanvulinstellingen</h3><div class="mt8">${editVelden(p)}</div></div>` : ''}`;
}

/* =====================================================================
   LOCATIES
   ===================================================================== */
function viewLocaties(gang, q){
  if(!Object.keys(D.LOC).length){ app.innerHTML = '<div class="card empty">Lees eerst de locatie-export in bij <a href="#/gegevens">Gegevens</a> (Picqer → Instellingen → Locaties → Import/Export → Exporteren).</div>'; return; }
  const S = WHL.locStats();
  if(gang) return viewGang(gang, S);
  const perHal = {};
  S.gangen.forEach(g => (perHal[g.hal] = perHal[g.hal] || []).push(g));
  const afw = WHL.locAfwijkingen();
  const afwOk = afw.filter(a => !a.twijfel);
  const zoekRes = zoekLocatie(UI.locQ);
  app.innerHTML = `<div class="card"><div class="row wrap between"><div><h2>Locaties</h2><div class="small muted">Export van ${esc(fdt(D.LOCDATUM))} · ${nf(Object.keys(D.LOC).length)} locaties. Tik een gang voor de stellingkaart.</div></div></div>
    <div class="filters mt12"><input class="q" data-a="locq" placeholder="zoek locatie of productcode" value="${esc(UI.locQ)}"></div>${zoekRes}</div>
  ${Object.entries(perHal).map(([h, gs]) => `<div class="card"><h3>${esc(WHL.HAL_NAAM[h] || 'Hal ' + h)}</h3><div class="scroll mt8"><table>
    <tr><th>Gang</th><th class="n">Pick</th><th class="n">zonder product</th><th class="n">Bulk</th><th class="n">zonder product</th><th class="n hide-m">Producten</th><th>Let op</th></tr>
    ${gs.map(g => `<tr><td><a class="code" href="#/locaties/${g.gang}">${g.gang}</a> <span class="desc">${g.secs.size} secties</span></td><td class="n">${nf(g.pick)}</td><td class="n">${nf(g.pickLeeg)}</td><td class="n">${nf(g.bulk)}</td><td class="n">${nf(g.bulkLeeg)}</td><td class="n hide-m">${nf(g.producten)}</td>
      <td>${g.tijdPick ? badge(g.tijdPick + ' pick tijdelijk', 'b-warn') : ''}</td></tr>`).join('')}</table></div></div>`).join('')}
  <div class="card"><h3>Aandachtspunten</h3>
    ${aandBlok('Picklocatie staat op tijdelijk (ontkoppelt bij 0)', S.aand.tijdPick)}
    ${aandBlok('Hoog (10+) maar pick', S.aand.hoogPick, 'twijfel: Daan beslist')}
    ${aandBlok('Vloer maar bulk', S.aand.vloerBulk, 'twijfel: Daan beslist')}
    ${aandBlok('Foute BA-dubbelingen (…-06) met producten', S.aand.dubbel, 'verplaatsen naar de versie zonder streepje, daarna archiveren')}
    ${aandBlok('Losse namen met producten', S.aand.rommel, 'opruimen')}
    ${aandBlok('Producten op een gang-/niveaumap', S.aand.opMap, 'naar een echte locatie')}
    ${aandBlok('Locaties met 15+ producten', S.aand.veel, 'wat staat hier echt?')}
    <div class="mt12 row wrap"><button class="btn pri" data-a="exp-loc" ${afwOk.length ? '' : 'disabled'}>Locatie-import volgens de regels (${afwOk.length})</button>
      <span class="small muted">zonder de ${afw.length - afwOk.length} twijfelgevallen</span></div></div>`;
}
function aandBlok(titel, lijst, noot){
  if(!lijst.length) return '';
  return `<details class="mt8"><summary>${esc(titel)} · ${lijst.length}${noot ? ' · ' + esc(noot) : ''}</summary><div class="small mt4">${lijst.sort(WHL.sortLoc).map(l => `<span class="loc">${esc(l)}</span>`).join(', ')}</div></details>`;
}
function zoekLocatie(q){
  q = (q || '').trim(); if(q.length < 2) return '';
  const Q = q.toUpperCase();
  const L = Object.values(D.LOC).filter(l => l.naam.toUpperCase().includes(Q)).slice(0, 12);
  const pc = D.PLOW[q.toLowerCase()];
  let h = '';
  if(pc) h += `<div class="mt8"><a class="code" href="#/p/${encodeURIComponent(pc)}">${esc(pc)}</a> ${esc(WHL.naamVan(pc))}: ${locs(WHL.locsVan(pc)) || 'geen locatie'}</div>`;
  h += L.map(l => `<div class="mt4">${locBadge(l.naam)} ${l.tijd ? badge('tijdelijk', 'b-warn') : ''} ${l.codes.slice(0, 8).map(c => `<a class="code" href="#/p/${encodeURIComponent(c)}">${esc(c)}</a>`).join(', ')}${l.codes.length > 8 ? ' +' + (l.codes.length - 8) : ''}</div>`).join('');
  return h ? `<div class="mt8">${h}</div>` : '<div class="small muted mt8">Niets gevonden.</div>';
}
function viewGang(gang, S){
  const locsG = Object.values(D.LOC).map(L => Object.assign({ L }, WHL.locInfo(L.naam))).filter(i => i.std && i.gang === gang);
  const secs = [...new Set(locsG.map(i => i.sec))].sort((a, b) => a - b);
  const pls = [...new Set(locsG.map(i => i.pl))].sort();
  const hs = [...new Set(locsG.map(i => i.h))].sort((a, b) => b - a);
  const idx = {}; locsG.forEach(i => idx[i.sec + i.pl + i.h] = i);
  const cols = secs.length * pls.length;
  let grid = `<div class="rek" style="grid-template-columns:34px repeat(${cols},22px)"><div></div>`;
  secs.forEach(s => grid += `<div class="hd" style="grid-column:span ${pls.length}">${String(s).padStart(2, '0')}</div>`);
  hs.forEach(h => {
    grid += `<div class="hl">${String(h).padStart(2, '0')}</div>`;
    secs.forEach(s => pls.forEach(pl => {
      const i = idx[s + pl + h];
      if(!i){ grid += '<div class="c x"></div>'; return; }
      const cls = (i.L.bulk ? 'bk' : 'pk') + (i.L.codes.length ? ' f' : '') + (!i.L.bulk && i.L.tijd ? ' t' : '') + (UI.locSel === i.naam ? ' sel' : '');
      grid += `<div class="c ${cls}" data-a="cel" data-l="${i.naam}" title="${i.naam}${i.L.codes.length ? ': ' + i.L.codes.length + ' product(en)' : ''}">${i.L.codes.length > 1 ? i.L.codes.length : pl}</div>`;
    }));
  });
  grid += '</div>';
  const g = S.gangen.find(x => x.gang === gang) || {};
  const sel = UI.locSel && D.LOC[UI.locSel] && UI.locSel.startsWith(gang) ? D.LOC[UI.locSel] : null;
  app.innerHTML = `<a href="#/locaties" class="small">← Locaties</a>
  <div class="card mt8"><div class="row wrap between"><h2>Gang ${esc(gang)}</h2><div class="small">${nf(g.pick)} pick (${nf(g.pickLeeg)} zonder product) · ${nf(g.bulk)} bulk (${nf(g.bulkLeeg)} zonder product)</div></div>
    <div class="legend mt8"><span><i style="background:var(--pick)"></i>pick bezet</span><span><i style="background:#c8ecd7"></i>pick zonder product</span><span><i style="background:var(--bulk)"></i>bulk bezet</span><span><i style="background:#d4e2f8"></i>bulk zonder product</span><span><i style="background:#fff;box-shadow:inset 0 0 0 2px #e0a100"></i>pick tijdelijk</span></div>
    <div class="small muted mt4">Kolommen = sectie en plaats op de ligger (A–D), rijen = hoogte. Cijfer = aantal producten op de locatie.</div>
    <div class="rekwrap mt12">${grid}</div></div>
  ${sel ? `<div class="card"><div class="row wrap between"><h3>${locBadge(sel.naam)} ${sel.tijd ? badge('tijdelijk', 'b-warn') : badge('vast', 'b-grey')}</h3></div>
    ${sel.codes.length ? `<div class="scroll mt8"><table><tr><th>Product</th><th class="n">Voorraad HM</th><th>Andere locaties</th></tr>${sel.codes.map(c => { const cc = D.PLOW[c.toLowerCase()] || c; const P = D.P[cc] || {}; return `<tr><td><a class="code" href="#/p/${encodeURIComponent(cc)}">${esc(cc)}</a><div class="desc">${esc(P.naam || '')}</div></td><td class="n">${nf(num(P.voorraad_hm))}</td><td>${locs(WHL.locsVan(cc).filter(l => l !== sel.naam))}</td></tr>`; }).join('')}</table></div>` : '<div class="small muted mt8">Geen product gekoppeld. (Kan fysiek toch vol staan.)</div>'}</div>` : ''}`;
}

/* =====================================================================
   PLANNING
   ===================================================================== */
function viewPlanning(){
  const vd = vandaag();
  const weken = {};
  WHP.TAKEN.forEach(t => (weken[WHP.weekNr(t.datum)] = weken[WHP.weekNr(t.datum)] || []).push(t));
  const nu = WHP.weekNr(vd);
  const totaal = WHP.TAKEN.length, klaar = WHP.TAKEN.filter(t => tik('t:' + t.id)).length;
  const titel = { 40:'Week 40 · Wallace lossen en aanvuladvies leeg', 41:'Week 41 · Aanvulbase per afdeling', 42:'Week 42 · Opruimen en controleren', 43:'Week 43 · Borgen en koppeling voorbereiden', 44:'Week 44 · Herberekenen en afsluiten' };
  app.innerHTML = `<div class="card"><div class="row wrap between"><div><h2>Planning oktober</h2><div class="small muted">Wat, wanneer en wie. Afvinken hier of op Vandaag.</div></div><span class="badge b-info">${klaar}/${totaal} klaar</span></div></div>
  ${Object.entries(weken).map(([w, ts]) => `<div class="card week ${+w === nu ? 'nu' : ''}"><h3>${esc(titel[w] || 'Week ' + w)}</h3>
    ${ts.map(t => `<div class="task ${tik('t:' + t.id) ? 'klaar' : ''}">${tikKnop('t:' + t.id)}<div class="grow"><div class="tt"><span class="prio p${t.prio}"></span>${esc(t.titel)} ${badge(fdate(t.datum), t.datum === vd ? 'b-warn' : 'b-grey')}</div>
      <div class="td">${esc(t.uitleg)} ${t.link ? `<a href="${esc(t.link)}">open</a>` : ''}</div><div class="wie mt4">${esc(t.wie)}</div></div></div>`).join('')}</div>`).join('')}
  <div class="card"><h3>Cijfers per dag</h3><div class="small muted mb8">Orders in backorder, hoeveel daarvan alleen op een bulkverplaatsing wachten, en de rest. Hiermee meet je of het beter gaat.</div>${kpiTabel()}</div>
  <div class="card"><h3>Dagritme (elke werkdag)</h3>${WHP.DAGRITME.map(r => `<div class="task"><div class="code" style="flex:0 0 46px">${esc(r.tijd)}</div><div class="grow"><div class="tt">${esc(r.titel)}</div><div class="td">${esc(r.uitleg)}</div></div></div>`).join('')}</div>
  <div class="card" id="vragen"><h3>Nog van jou nodig</h3><div class="small muted">Verzameld tijdens het bouwen, niet dringend. Vink af als het geregeld is.</div>
    ${WHP.VRAGEN.map(v => `<div class="task ${tik('v:' + v.id) ? 'klaar' : ''}">${tikKnop('v:' + v.id)}<div class="grow"><div class="tt">${esc(v.titel)}</div><div class="td">${esc(v.waarom)}${v.waar ? ' <i>' + esc(v.waar) + '</i>' : ''}</div></div></div>`).join('')}</div>`;
}

/* =====================================================================
   GEGEVENS
   ===================================================================== */
function viewGegevens(){
  if(!D.VP) WH.laadVerplaatsingen().then(() => { if(/^#\/gegevens/.test(location.hash)) viewGegevens(); });
  const dt = dataDatums();
  if(!UI.vk.van){ UI.vk.tot = isoDag(Date.now() - 864e5); UI.vk.van = isoDag(Date.now() - 182 * 864e5); }
  const rij = (naam, k, n, hoe) => `<tr><td><b>${esc(naam)}</b><div class="desc">${hoe}</div></td><td>${exportLeeftijd(dt[k])}</td><td class="n">${n}</td></tr>`;
  app.innerHTML = `<div class="card"><h2>Gegevens inladen</h2>
    <div class="small muted">Sleep alle Picqer-bestanden tegelijk hierin (of tik om te kiezen). De app herkent zelf wat het is.</div>
    <label class="drop mt12" id="drop"><input type="file" id="files" multiple accept=".xlsx,.xls,.csv,.pdf,.json" hidden>
      <b>Bestanden kiezen of hierheen slepen</b><div class="small muted mt4">productexport · locatie-export (Hoofdmagazijn en VST) · voorraad per locatie · backorders · Magazijnverkopen (per maand: maand in de bestandsnaam, bv. "Magazijnverkopen 2026-10.xlsx") · aanvuladvies (PDF)</div></label>
    <div class="fields mt12"><div class="fld"><label>Magazijnverkopen van</label><input type="date" id="vkvan" value="${esc(UI.vk.van)}"></div>
      <div class="fld"><label>tot en met</label><input type="date" id="vktot" value="${esc(UI.vk.tot)}"></div>
      <div class="fld"><label>Verkoop-export</label><label class="small" style="text-transform:none;font-weight:600;color:var(--ink)"><input type="checkbox" id="vkvol" ${UI.vk.vol ? 'checked' : ''}> alle leveranciers</label></div></div>
    <div id="impst" class="status"></div></div>
  <div class="card"><h3>Stand</h3><div class="scroll mt8"><table><tr><th>Bron</th><th>Leeftijd</th><th class="n">Aantal</th></tr>
    ${rij('Productexport', 'producten', nf(Object.keys(D.P).length), 'Picqer → Producten → Exporteren (alle producten). Neemt ook aanvulniveaus mee.')}
    ${rij('Locatie-export', 'locaties', nf(Object.keys(D.LOC).length), 'Picqer → Instellingen → Locaties → Import/Export → Exporteren.')}
    <tr><td><b>VST-palletlocaties</b><div class="desc">Zelfde locatie-export, maar dan van magazijn Bulk van Spreuwel: palletnummers per product.</div></td><td>${exportLeeftijd(D.VSTDATUM)}</td><td class="n">${nf(Object.keys(D.VSTLOC).length)} producten</td></tr>
    <tr><td><b>Voorraad per locatie</b><div class="desc">Aantal per product per locatie, incl. geen specifieke locatie en retourkarren (export "stock-….xlsx"). Nodig voor de controle na het lossen.</div></td><td>${exportLeeftijd(D.VRDATUM)}</td><td class="n">${nf(Object.keys(D.VR).length)} producten</td></tr>
    <tr><td><b>VST: voorraad per pallet</b><div class="desc">Zelfde export, magazijn Bulk van Spreuwel.</div></td><td>${exportLeeftijd(D.VSTVRDATUM)}</td><td class="n">${nf(Object.keys(D.VSTVR).length)} producten</td></tr>
    ${rij('Backorders', 'backorders', nf(D.BO.length) + ' regels', 'Picqer → Backorders → Exporteer backorders. De vorige stand wordt bewaard (opgelost / open / nieuw).')}
    ${rij('Magazijnverkopen', 'verkoop', nf(Object.keys(D.VK).length), 'Picqer → Rapporten → Magazijnverkopen. Per maand: maand in de bestandsnaam. Anders periode hierboven invullen.')}
    <tr><td><b>Verplaatsingen uit Picqer</b><div class="desc">Mac-script "Verplaatsingen ophalen" → bestand in 00_Inbox (.json). Laatste 60 dagen blijven bewaard.</div></td><td>${D.VP && D.VP !== 'laden' && D.VP.datum ? exportLeeftijd(D.VP.datum) : '–'}</td><td class="n">${D.VP && D.VP !== 'laden' && D.VP.rows ? nf(D.VP.rows.length) + ' verplaatsingen' + (D.VP.rows.length ? ' · ' + esc(String(D.VP.rows.reduce((m, r) => r[1] < m ? r[1] : m, '9')).slice(0, 10)) + ' t/m ' + esc(String(D.VP.rows.reduce((m, r) => r[1] > m ? r[1] : m, '')).slice(0, 10)) : '') : '–'}</td></tr>
    <tr><td><b>Verkoop per maand</b><div class="desc">Verkoop/maand = gemiddelde van de laatste 6 maanden.</div></td><td>${exportLeeftijd(D.VKM && D.VKM.datum)}</td><td class="n">${D.VKM ? esc(D.VKM.maanden[0] + ' t/m ' + D.VKM.maanden[D.VKM.maanden.length - 1]) : '–'}</td></tr>
    ${rij('Aanvuladvies', 'advies', D.ADV ? nf(D.ADV.rows.length) + ' regels' : '–', 'Picqer → Aanvuladvies → PDF (picklijst bulklocaties).')}
  </table></div>
  <div class="small muted mt8">Zelfde database als Containers en Palletlabels. Back-up: Containers → Gegevens → Back-up downloaden.</div></div>`;
  const inp = $('files'), drop = $('drop');
  inp.onchange = () => { if(inp.files.length) inlezen([...inp.files]); inp.value = ''; };
  ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', ev => { const f = [...(ev.dataTransfer.files || [])]; if(f.length) inlezen(f); });
  ['vkvan', 'vktot'].forEach(id => $(id).onchange = () => { UI.vk.van = $('vkvan').value; UI.vk.tot = $('vktot').value; });
  $('vkvol').onchange = () => UI.vk.vol = $('vkvol').checked;
}
async function inlezen(files, opts){
  opts = opts || {};
  const stId = opts.statusId || 'impst';
  const st = $(stId);
  const log = [];
  const zet = (m, cls) => { const s = $(stId) || st; if(!s) return; s.innerHTML = log.concat(m ? [esc(m)] : []).join('<br>'); s.className = 'status ' + (cls || ''); };
  // volgorde: producten eerst (codes), dan locaties, voorraad, verkoop, backorders, advies
  const soorten = [];
  for(const f of files){
    if(/\.pdf$/i.test(f.name)){ soorten.push({ f, s:'advies' }); continue; }
    if(/\.json$/i.test(f.name)){
      try{ const o = JSON.parse(await f.text()); soorten.push({ f, s:o && o.bron === 'picqer-location-stock-history' ? 'verplaatsingen' : null, obj:o, fout:'onbekend JSON-bestand' }); }
      catch(e){ soorten.push({ f, s:null, fout:e.message }); }
      continue;
    }
    try{ const arr = await WH.leesSheet(f); soorten.push({ f, s:WH.soortVan(arr[0] || []), arr }); }
    catch(e){ soorten.push({ f, s:null, fout:e.message }); }
  }
  // Magazijnverkopen met een maand in de naam ("… 2026-09.xlsx") = verkoop per maand
  soorten.forEach(x => { if(x.s === 'verkoop'){ const ym = WH.maandUitNaam(x.f.name); if(ym){ x.s = 'verkoopmaand'; x.ym = ym; } } });
  const ORDE = { producten:1, locaties:2, voorraad:3, verkoop:4, verkoopmaand:4, backorders:5, advies:6, verplaatsingen:7 };
  soorten.sort((a, b) => (ORDE[a.s] || 9) - (ORDE[b.s] || 9));
  // meerdere maanden verkoop: eerst allemaal lezen, dan één keer opslaan en herberekenen
  const maanden = soorten.filter(x => x.s === 'verkoopmaand');
  let maandenKlaar = false;
  for(const x of soorten){
    const naam = x.f.name;
    try{
      if(!x.s){ log.push('✗ ' + esc(naam) + ': niet herkend' + (x.fout ? ' (' + esc(x.fout) + ')' : '')); continue; }
      if(x.s === 'verkoopmaand'){
        if(maandenKlaar) continue;
        maandenKlaar = true;
        const per = {};
        maanden.forEach(m => {
          const head = (m.arr[0] || []).map(h => String(h ?? '').trim());
          const ic = head.indexOf('Productcode'), ia = head.indexOf('Aantal'), im = head.indexOf('Magazijn');
          const som = per[m.ym] = {};
          for(let i = 1; i < m.arr.length; i++){
            const code = WH.txt(m.arr[i][ic]); if(!code) continue;
            if(im >= 0 && m.arr[i][im] && !/hoofdmagazijn/i.test(String(m.arr[i][im]))) continue;
            const c2 = D.PLOW[code.toLowerCase()] || code;
            som[c2] = (som[c2] || 0) + (num(m.arr[i][ia]) || 0);
          }
        });
        const msg = await WH.verkoopMaandenOpslaan(per, m => zet('Verkoop per maand: ' + m));
        log.push('✓ Magazijnverkopen per maand (' + maanden.map(m => m.ym).sort().join(', ') + '): ' + esc(msg));
        continue;
      }
      zet(naam + ': bezig…');
      let msg = '';
      const s = m => zet(naam + ': ' + m);
      if(x.s === 'producten') msg = await WH.impProducten(x.arr, s);
      else if(x.s === 'locaties') msg = await WH.impLocaties(x.arr, WH.datumUitNaam(naam));
      else if(x.s === 'voorraad'){ msg = await WH.impVoorraad(x.arr, WH.datumUitNaam(naam)); if(WH.datumUitNaam(naam) && dagenOud(WH.datumUitNaam(naam)) > 1) msg += ' · LET OP: export van ' + fdt(WH.datumUitNaam(naam)); }
      else if(x.s === 'backorders') msg = await WH.impBackorders(x.arr, s);
      else if(x.s === 'verkoop' && maanden.length){ log.push('– ' + esc(naam) + ': overgeslagen (geen maand in de naam; de maandbestanden zijn leidend)'); continue; }
      else if(x.s === 'verkoop'){ if(!$('vkvan')) throw new Error('Magazijnverkopen zonder maand in de naam: laad hem in bij Gegevens (periode invullen) of zet de maand in de naam, bv. "Magazijnverkopen 2026-10.xlsx"'); msg = await WH.impVerkoop(x.arr, $('vkvan').value, $('vktot').value, $('vkvol').checked, s); }
      else if(x.s === 'advies') msg = await WH.impAdvies(x.f);
      else if(x.s === 'verplaatsingen'){ msg = await WH.impVerplaatsingen(x.obj); try{ msg += ' · ' + WHD.vpAfTekst(await WHD.vpAfleiden()); }catch(e){ msg += ' · afvinken mislukt: ' + e.message; } }
      log.push('✓ ' + esc(naam) + ': ' + esc(msg));
      if(x.s === 'producten') await WH.load();          // codes nodig voor de volgende bestanden
    }catch(e){ log.push('✗ ' + esc(naam) + ': ' + esc(e.message)); }
  }
  zet('Alles opnieuw laden…');
  await WH.load();
  if(opts.na) opts.na(); else viewGegevens();
  const st2 = $(stId); if(st2){ st2.innerHTML = log.join('<br>') + (opts.na ? '' : '<br><a href="#/">Naar Vandaag →</a>'); st2.className = 'status ' + (log.some(l => l.startsWith('✗')) ? 'err' : 'ok'); }
}

/* =====================================================================
   acties
   ===================================================================== */
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-a]'); if(!b) return;
  const a = b.dataset.a;
  if(a === 'tik'){
    const k = b.dataset.k; const aan = !tik(k);
    D.TAKEN[k] = aan ? { op:new Date().toISOString() } : undefined; if(!aan) delete D.TAKEN[k];
    rerender();
    try{ await WH.catPatch('wh-taken', { [k]:aan ? { op:new Date().toISOString() } : null }); }catch(e){ /* melding al getoond */ }
    return;
  }
  if(a === 'open'){ UI.open[b.dataset.k] = !UI.open[b.dataset.k]; rerender(); return; }
  if(a === 'volg'){ try{ localStorage.setItem('wh-volg', b.dataset.v); }catch(e){} rerender(); return; }
  if(a === 'ab'){ UI.ab = b.dataset.v; UI.abMax = 100; rerender(); return; }
  if(a === 'ab-meer'){ UI.abMax = (UI.abMax || 100) + 200; rerender(); return; }
  if(a === 'ab-bev'){
    const l = app.__bev || [];
    if(!l.length || !confirm(l.length + ' producten bevestigen zoals ze nu staan (picklocatie en niveaus)?')) return;
    await bevestig(l); return;
  }
  if(a === 'ab-exp-aanvul' || a === 'ab-exp-koppel'){
    const set = new Set((app.__lijst || []).map(p => p.code));
    if(a === 'ab-exp-aanvul'){
      const r = WHL.importAanvul(p => set.has(p.code));
      if(!r.length){ toast('Niets dat afwijkt van Picqer'); return; }
      WH.excel(['Productcode', 'Aanvulniveau Hoofdmagazijn', 'Vul pickvoorraad aan tot Hoofdmagazijn'], r, 'Picqer import aanvulniveaus AB ' + vandaag() + ' (' + r.length + ').xlsx');
    } else {
      const r = WHL.importKoppel(p => set.has(p.code));
      if(!r.length){ toast('Geen nieuwe picklocaties in deze stap'); return; }
      WH.excel(['Productcode', 'Voorraadlocatie Hoofdmagazijn'], r, 'Picqer import picklocaties koppelen AB ' + vandaag() + ' (' + r.length + ').xlsx');
    }
    return;
  }
  if(a === 'verwerk' || a === 'dz'){
    const k = a === 'verwerk' ? 'dg:' + vandaag() + ':verwerk' : 'dz:' + b.dataset.nr;
    const v = D.TAKEN[k] ? null : { op:new Date().toISOString() };
    if(v) D.TAKEN[k] = v; else delete D.TAKEN[k];
    WHL.reset(); rerender();
    try{ await WH.catPatch('wh-taken', { [k]:v }); }catch(e){ /* melding al getoond */ }
    return;
  }
  if(a === 'gang'){ if(b.dataset.w === 'gang'){ if(location.hash.includes('ronde')) UI.rondeGang = b.dataset.v; else UI.mvGang = b.dataset.v; } rerender(); return; }
  if(a === 'bev'){ const c = b.dataset.code; const v = leesVelden(c); await bevestig([c], v ? { [c]:v } : null); return; }
  if(a === 'herstel'){ await WH.catPatch('wh-aanvul', { [b.dataset.code]:null }); WHL.reset(); toast('Terug naar het voorstel'); rerender(); return; }
  if(a === 'bev-alle'){
    const lijst = (app.__lijst || []).filter(p => p.status !== 'bevestigd');
    if(!lijst.length) return;
    if(!confirm(lijst.length + ' producten bevestigen zoals ze nu staan?')) return;
    await bevestig(lijst.map(p => p.code)); return;
  }
  if(a === 'meer'){ UI.base.max += 300; rerender(); return; }
  if(a === 'basegang'){ UI.base.gang = ''; UI.lastHash = '#/base'; location.hash = '#/base'; return; }
  if(a === 'exp-aanvul'){
    const set = new Set((app.__lijst || []).map(p => p.code));
    const r = WHL.importAanvul(p => set.has(p.code));
    if(!r.length){ toast('Niets dat afwijkt van Picqer'); return; }
    WH.excel(['Productcode', 'Aanvulniveau Hoofdmagazijn', 'Vul pickvoorraad aan tot Hoofdmagazijn'], r, 'Picqer import aanvulniveaus ' + vandaag() + ' (' + r.length + ').xlsx');
    return;
  }
  if(a === 'exp-uit'){
    const C = WHL.bereken();
    const r = C.uitzetten.map(x => [x.code, '', '']);
    WH.excel(['Productcode', 'Aanvulniveau Hoofdmagazijn', 'Vul pickvoorraad aan tot Hoofdmagazijn'], r, 'Picqer import uit advies ' + vandaag() + ' (' + r.length + ').xlsx');
    return;
  }
  if(a === 'exp-koppel'){
    const set = new Set((app.__lijst || []).map(p => p.code));
    const r = WHL.importKoppel(p => set.has(p.code));
    if(!r.length){ toast('Geen nieuwe picklocaties'); return; }
    WH.excel(['Productcode', 'Voorraadlocatie Hoofdmagazijn'], r, 'Picqer import picklocaties koppelen ' + vandaag() + ' (' + r.length + ').xlsx');
    return;
  }
  if(a === 'exp-loc'){
    const r = WHL.locAfwijkingen().filter(x => !x.twijfel).map(x => [x.naam, x.wilTijd, x.wilBulk]);
    WH.excel(['Naam', 'Tijdelijke locatie', 'Bulklocatie'], r, 'Picqer import locaties ' + vandaag() + ' (' + r.length + ').xlsx');
    return;
  }
  if(a === 'cel'){ UI.locSel = b.dataset.l; rerender(); return; }
  if(a === 'print'){ window.print(); return; }
  if(a === 'kopieer'){
    const t = $(b.dataset.id).textContent;
    try{ await navigator.clipboard.writeText(t); toast('Gekopieerd'); }catch(e){ toast('Kopiëren lukt niet; selecteer de tekst'); }
    return;
  }
});
document.addEventListener('input', ev => {
  const el = ev.target;
  if(el.dataset && el.dataset.bf){
    UI.base[el.dataset.bf] = el.value; UI.base.max = 150;
    clearTimeout(UI.t); UI.t = setTimeout(() => { const pos = el.selectionStart; rerender(); const n = document.querySelector(`[data-bf="${el.dataset.bf}"]`); if(n && n.tagName === 'INPUT'){ n.focus(); try{ n.setSelectionRange(pos, pos); }catch(_){} } }, el.tagName === 'INPUT' ? 250 : 0);
  }
  if(el.dataset && el.dataset.a === 'locq'){
    UI.locQ = el.value; clearTimeout(UI.t); UI.t = setTimeout(() => { rerender(); const n = document.querySelector('[data-a="locq"]'); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250);
  }
});
document.addEventListener('keydown', ev => {
  if(ev.key !== 'Enter') return;
  const box = ev.target.closest && ev.target.closest('[data-pr]');
  if(box){ ev.preventDefault(); const c = box.dataset.pr; const v = leesVelden(c); bevestig([c], v ? { [c]:v } : null); }
});
window.addEventListener('hashchange', route);
// hulpjes voor wh/dag.js
window.WHV = { badge, locBadge, locs, tikKnop, exportLeeftijd, dataDatums, nietKlaar, kpiVastleggen, taakHtml, typeNaam, typeCls, inlezen, rerender, editVelden };
// terug in de app na > 2 minuten: vers laden (niet tijdens typen)
document.addEventListener('visibilitychange', async () => {
  if(document.visibilityState !== 'visible' || Date.now() - D.geladen < 120000) return;
  const a = document.activeElement; if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  if(await WH.load()) rerender();
});

(async () => { await WH.load(); route(); })();
})();
