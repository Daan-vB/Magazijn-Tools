/* =====================================================================
   IVOL Warehouse — Triage (overgenomen uit de losse Triage-app)
   Per product: Belangrijk / Medium (beide picklocatie), Zelden (alleen bulk), Weg (uit administratie)
   + afdeling. Beslissingen staan in catalog-rij `wh-triage` = { productcode: { s, a } }.
   De Aanvulbase gebruikt ze: Belangrijk/Medium telt als loper, Zelden/Weg niet.
   Lijsten (welke producten bij welke lijst horen) komen uit wh/triage-lijsten.json (stand augustus);
   producten die daar niet in staan maar wel voorraad/verkoop hebben komen onder "Overig".
   ===================================================================== */
window.WHT = (function(){
'use strict';
const { $, esc, num, nf, toast, D } = WH;
const SL = { g:'Belangrijk', o:'Medium', r:'Zelden', x:'Weg' };
const SLANG = { g:'Belangrijk — picklocatie', o:'Medium — ook picklocatie', r:'Zelden — alleen bulk', x:'Weg uit administratie' };
const UI = { tab:null, filter:'todo', q:'', lev:{}, fam:{}, max:400 };
const T = { seed:null, laden:null, byCode:null, overig:null, overigTijd:0 };

/* ---------- lijsten laden ---------- */
function laad(){
  if(!T.laden){
    T.laden = fetch('wh/triage-lijsten.json?v=2').then(r => { if(!r.ok) throw new Error('triage-lijsten.json niet gevonden (' + r.status + ')'); return r.json(); }).then(s => {
      T.seed = s; T.byCode = new Map();
      Object.entries(s.tabs).forEach(([tab, arr]) => arr.forEach(([code, fam, lev, afd, st]) => T.byCode.set(code, { tab, fam, lev, afd: s.afds[afd] || '', st: st || '' })));
      if(window.WHL) WHL.reset();
      return s;
    }).catch(e => { T.laden = null; throw e; });
  }
  return T.laden;
}
const prod = c => (D.P && (D.P[c] || D.P[String(c).trim()])) || null;
const rec = c => (D.TRIAGE || {})[c] || null;
const statusVan = c => { const r = rec(c); if(r && r.s !== undefined) return r.s || ''; const z = T.byCode && T.byCode.get(c); return (z && z.st) || ''; };
const afdVan = c => { const r = rec(c); if(r && r.a !== undefined) return r.a || ''; const z = T.byCode && T.byCode.get(c); return (z && z.afd) || ''; };
const vkVan = c => { const v = D.VK && D.VK[c]; return v && v.per_maand !== undefined && v.per_maand !== null ? Number(v.per_maand) : null; };

function overigLijst(){
  if(T.overig && T.overigTijd === D.geladen) return T.overig;
  T.overigTijd = D.geladen;
  T.overig = Object.values(D.P || {}).filter(p => p.actief !== false && !T.byCode.has(p.productcode) && ((num(p.voorraad_hm) || 0) > 0 || (vkVan(p.productcode) || 0) > 0)).map(p => p.productcode);
  return T.overig;
}
function codesVan(tab){
  if(tab === 'Overig') return overigLijst();
  return (T.seed.tabs[tab] || []).map(z => z[0]);
}
const tabNamen = () => Object.keys(T.seed.tabs).concat(['Overig']);

/* ---------- opslaan ---------- */
async function zet(patch){
  const upd = {};
  Object.entries(patch).forEach(([c, v]) => {
    const cur = Object.assign({}, D.TRIAGE[c] || {});
    if(v === null){ delete cur.s; delete cur.a; }
    else Object.keys(v).forEach(k => {
      let w = v[k];
      if(k === 's' && (w === null || w === undefined)){ const z = T.byCode.get(c); w = z && z.st ? '' : undefined; }   // seed-status wissen = expliciet leeg
      if(k === 'a' && (w === null || w === undefined)){ const z = T.byCode.get(c); w = z && z.afd ? '' : undefined; }
      if(w === undefined) delete cur[k]; else cur[k] = w;
    });
    if(Object.keys(cur).length){ D.TRIAGE[c] = cur; upd[c] = cur; } else { delete D.TRIAGE[c]; upd[c] = null; }
  });
  if(window.WHL) WHL.reset();
  render();
  try{ await WH.catPatch('wh-triage', upd); }catch(e){ /* melding al getoond */ }
}

/* ---------- import uit de oude Triage-app ---------- */
function verwerkState(state, bron){
  const nieuw = {}; let gelijk = 0, verschilt = 0, onbekend = 0;
  Object.keys(state || {}).forEach(tab => Object.entries(state[tab] || {}).forEach(([code, r]) => {
    if(!r) return;
    const rc = {};
    if(r.s !== undefined && r.s !== null) rc.s = r.s;
    if(r.a !== undefined && r.a !== null) rc.a = r.a;
    if(!Object.keys(rc).length) return;
    const b = D.TRIAGE[code];
    if(b){ if(JSON.stringify(b) === JSON.stringify(rc)) gelijk++; else verschilt++; return; }
    nieuw[code] = rc; if(!prod(code)) onbekend++;
  }));
  const n = Object.keys(nieuw).length;
  if(!n){ toast('Niets nieuws in ' + bron + (gelijk ? ' (' + gelijk + ' stonden er al)' : ''), 5000); return; }
  const tel = {}; Object.values(nieuw).forEach(r => { const k = r.s || 'alleen afdeling'; tel[k] = (tel[k] || 0) + 1; });
  const txt = n + ' beslissingen uit ' + bron + ' overnemen?\n' + Object.entries(tel).map(([k, v]) => (SL[k] || k) + ': ' + v).join(' · ')
    + (verschilt ? '\n' + verschilt + ' bestaan al met een andere keuze: die blijven zoals ze nu zijn.' : '')
    + (onbekend ? '\n' + onbekend + ' productcodes staan niet in de huidige Picqer-export (worden wel bewaard).' : '');
  if(!confirm(txt)) return;
  zet(nieuw).then(() => toast(n + ' beslissingen overgenomen', 4000));
}
async function importBestand(file){
  try{
    const d = JSON.parse(await file.text());
    if(!d || !d.state) throw new Error('geen Triage-export (er staat geen "state" in)');
    verwerkState(d.state, file.name);
  }catch(e){ toast('Import mislukt: ' + e.message, 6000); }
}
function importLokaal(){
  try{
    const s = localStorage.getItem('triage_v1');
    if(!s){ toast('Op dit apparaat staan geen Triage-beslissingen (in de app op je beginscherm gebruik je Export en dan hier het bestand kiezen)', 8000); return; }
    verwerkState(JSON.parse(s), 'dit apparaat');
  }catch(e){ toast('Lezen mislukt: ' + e.message, 6000); }
}

/* ---------- scherm ---------- */
function css(){
  if($('tri-css')) return;
  const s = document.createElement('style'); s.id = 'tri-css';
  s.textContent = `
  .tri-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}.tri-tabs::-webkit-scrollbar{display:none}
  .tri-tabs .btn{white-space:nowrap}
  .tri-lev{border:1px solid var(--line);border-radius:10px;margin-top:8px;overflow:hidden;background:#fff}
  .tri-lh{display:flex;align-items:center;gap:10px;padding:11px 12px;cursor:pointer;font-weight:700}
  .tri-lh .n{margin-left:auto;font-weight:600;color:var(--muted);font-size:12px;white-space:nowrap}
  .tri-fh{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--soft);border-top:1px solid var(--line);cursor:pointer;font-weight:700;color:var(--blue);font-size:12.5px;text-transform:capitalize}
  .tri-fh .n{margin-left:auto;color:var(--muted);font-weight:600;font-size:11.5px}
  .tri-bulk{display:flex;flex-wrap:wrap;gap:5px;padding:7px 12px;background:var(--soft);align-items:center}
  .tri-bulk b{font-size:10.5px;text-transform:uppercase;color:var(--muted)}
  .tri-p{border-top:1px solid #e6ebf1;padding:9px 12px 10px;display:flex;flex-direction:column;gap:6px}
  .tri-p[data-s=g]{box-shadow:inset 4px 0 0 var(--ok)}.tri-p[data-s=o]{box-shadow:inset 4px 0 0 #d98324}.tri-p[data-s=r]{box-shadow:inset 4px 0 0 var(--bad)}.tri-p[data-s=x]{box-shadow:inset 4px 0 0 #9aa0a6}
  .tri-p[data-s=x] .tn{text-decoration:line-through;color:var(--muted)}
  .tri-p .tn{font-size:13.5px;line-height:1.3}
  .tri-p .tm{font-size:11.5px;color:var(--muted)}
  .tri-row{display:flex;gap:6px;align-items:center}
  .tri-s{display:flex;gap:4px;flex:0 0 auto}
  .tri-s button,.tri-bulk button{border:1.5px solid var(--line);background:#fff;border-radius:7px;padding:7px 8px;font-size:12px;font-weight:700;color:#5b6673;min-width:0;cursor:pointer}
  .tri-s button.on[data-v=g]{background:var(--ok);border-color:var(--ok);color:#fff}
  .tri-s button.on[data-v=o]{background:#d98324;border-color:#d98324;color:#fff}
  .tri-s button.on[data-v=r]{background:var(--bad);border-color:var(--bad);color:#fff}
  .tri-s button.on[data-v=x]{background:#9aa0a6;border-color:#9aa0a6;color:#fff}
  .tri-row select{flex:1;min-width:0;padding:6px 8px;font-size:12px}
  .tri-row select.leeg{color:var(--bad);background:#fdf1f0}
  `;
  document.head.appendChild(s);
}
function stats(codes){
  const t = { g:0, o:0, r:0, x:0, todo:0, weg:0 };
  codes.forEach(c => { if(!prod(c)){ t.weg++; return; } const s = statusVan(c); if(s) t[s]++; else t.todo++; });
  return t;
}
function passend(c){
  const p = prod(c); if(!p) return false;
  const s = statusVan(c);
  if(UI.filter === 'todo' && s) return false;
  if(UI.filter !== 'all' && UI.filter !== 'todo' && s !== UI.filter) return false;
  const q = UI.q.trim().toLowerCase();
  if(q && !((c + ' ' + (p.naam || '') + ' ' + (p.leverancier || '') + ' ' + (p.locaties_hm || '')).toLowerCase().includes(q))) return false;
  return true;
}
function rij(c){
  const p = prod(c), s = statusVan(c), a = afdVan(c), vk = vkVan(c);
  const lijst = T.seed.afdelingen.slice(); if(a && !lijst.includes(a)) lijst.push(a);
  const loc = String(p.locaties_hm || '').replace(/\s+/g, ' ').trim();
  return `<div class="tri-p" data-c="${esc(c)}" data-s="${esc(s)}">
    <div class="tn"><a class="code" href="#/p/${encodeURIComponent(c)}">${esc(c)}</a> ${esc(p.naam || '')}</div>
    <div class="tm">voorraad ${nf(num(p.voorraad_hm) || 0)} · verkoop ${vk === null ? '?' : nf(vk, 1)}/mnd${p.abc ? ' · ABC ' + esc(p.abc) : ''}${loc ? ' · ' + esc(loc.length > 60 ? loc.slice(0, 60) + '…' : loc) : ' · geen locatie'}</div>
    <div class="tri-row"><div class="tri-s">${['g', 'o', 'r', 'x'].map(k => `<button data-t="s" data-v="${k}" class="${s === k ? 'on' : ''}" title="${esc(SLANG[k])}">${SL[k]}</button>`).join('')}</div>
      <select data-t="afd"${a ? '' : ' class="leeg"'}><option value="">${a ? 'geen afdeling' : 'kies afdeling…'}</option>${lijst.map(x => `<option ${x === a ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
  </div>`;
}
function render(){
  const app = $('app'); if(!app) return;
  css();
  if(!T.seed){ app.innerHTML = '<div class="card"><h2>Triage</h2><p class="muted mt8">Lijsten laden…</p></div>'; laad().then(render).catch(e => { app.innerHTML = '<div class="card"><h2>Triage</h2><p class="mt8 status err">' + esc(e.message) + '</p></div>'; }); return; }
  const namen = tabNamen();
  if(!UI.tab || !namen.includes(UI.tab)) UI.tab = namen.find(n => n !== 'Overig' && stats(codesVan(n)).todo) || namen[0];
  const alle = codesVan(UI.tab);
  const st = stats(alle);
  const groepen = new Map();
  let zichtbaar = 0;
  alle.forEach(c => {
    if(!passend(c)) return;
    zichtbaar++;
    const p = prod(c), z = T.byCode.get(c);
    const lev = (p && p.leverancier) || (z && T.seed.levs[z.lev]) || '—';
    const fam = z ? T.seed.fams[z.fam] : '';
    if(!groepen.has(lev)) groepen.set(lev, new Map());
    const f = groepen.get(lev); if(!f.has(fam)) f.set(fam, []);
    f.get(fam).push(c);
  });
  const levs = [...groepen.entries()].map(([lev, f]) => ({ lev, f, n: [...f.values()].reduce((a, b) => a + b.length, 0) })).sort((a, b) => b.n - a.n || a.lev.localeCompare(b.lev));
  const zoek = UI.q.trim() !== '';
  let getoond = 0;
  const body = levs.map(L => {
    const open = zoek || UI.lev[UI.tab + '|' + L.lev] === true;
    const fams = [...L.f.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    return `<div class="tri-lev"><div class="tri-lh" data-t="lev" data-k="${esc(L.lev)}"><span>${open ? '▾' : '▸'}</span><span>${esc(L.lev)}</span><span class="n">${L.n}</span></div>
      ${open ? fams.map(([fam, codes]) => {
        const k = UI.tab + '|' + L.lev + '|' + fam;
        const fo = UI.fam[k] === undefined ? (codes.length <= 8 || zoek) : UI.fam[k];
        const kop = fam ? `<div class="tri-fh" data-t="fam" data-k="${esc(k)}"><span>${fo ? '▾' : '▸'}</span><span>${esc(fam)}</span><span class="n">${codes.length}</span></div>` : '';
        const bulk = fam && fo && codes.length > 1 ? `<div class="tri-bulk"><b>Alle ${codes.length}:</b>${['g', 'o', 'r', 'x'].map(v => `<button data-t="fs" data-v="${v}" data-k="${esc(k)}">${SL[v]}</button>`).join('')}
          <select data-t="fafd" data-k="${esc(k)}" style="flex:1;min-width:120px;padding:6px 8px;font-size:12px"><option value="">afdeling voor alle…</option>${T.seed.afdelingen.map(x => `<option>${esc(x)}</option>`).join('')}</select></div>` : '';
        let rijen = '';
        if(fo || !fam){ rijen = codes.filter(() => getoond++ < UI.max).map(rij).join(''); }
        return kop + bulk + rijen;
      }).join('') : ''}</div>`;
  }).join('');
  const filters = [['todo', 'Nog te doen (' + st.todo + ')'], ['g', 'Belangrijk (' + st.g + ')'], ['o', 'Medium (' + st.o + ')'], ['r', 'Zelden (' + st.r + ')'], ['x', 'Weg (' + st.x + ')'], ['all', 'Alles']];
  app.innerHTML = `<div class="card"><div class="row wrap between"><div><h2>Triage</h2>
      <div class="small muted">Per product bepalen: <b>Belangrijk / Medium</b> = picklocatie, <b>Zelden</b> = alleen bulk, <b>Weg</b> = uit de administratie. Kies ook de afdeling. De Aanvulbase gebruikt dit voor de vraag wie een picklocatie krijgt.</div></div></div>
    <div class="tri-tabs mt12">${namen.map(n => { const s = stats(codesVan(n)); return `<button class="btn sm ${n === UI.tab ? 'pri' : ''}" data-t="tab" data-k="${esc(n)}">${esc(n)} <span style="opacity:.75;font-weight:600">${s.todo}</span></button>`; }).join('')}</div>
    <div class="tri-tabs mt8">${filters.map(([k, t]) => `<button class="btn sm ${UI.filter === k ? 'pri' : ''}" data-t="flt" data-k="${k}">${esc(t)}</button>`).join('')}</div>
    <input class="mt8" data-t="q" placeholder="zoek op code, naam, leverancier of locatie" value="${esc(UI.q)}">
    <div class="small muted mt8">${nf(alle.length - st.weg)} producten in deze lijst${st.weg ? ' · ' + st.weg + ' uit de oude lijst staan niet meer in de Picqer-export' : ''}${UI.tab === 'Overig' ? ' · producten met voorraad of verkoop die in geen oude lijst staan' : ''}. Getoond: ${nf(Math.min(zichtbaar, UI.max))} van ${nf(zichtbaar)}.</div>
    <details class="mt8"><summary class="small" style="cursor:pointer;color:var(--blue);font-weight:700">Beslissingen uit de oude Triage-app overnemen</summary>
      <div class="small muted mt8">Open de oude Triage-app, tik <b>Export</b> en kies hier het bestand (<span class="mono">triage-export-….json</span>). Bestaande keuzes hier worden niet overschreven.</div>
      <div class="row wrap mt8"><label class="btn sm file">Kies export-bestand<input type="file" accept="application/json,.json" data-t="imp"></label><button class="btn sm" data-t="implok">Zoek op dit apparaat</button></div></details></div>
    ${body || '<div class="card"><div class="empty">Niets te tonen met deze filters.</div></div>'}
    ${zichtbaar > UI.max ? '<div class="card"><button class="btn" data-t="meer">Toon meer</button></div>' : ''}`;
}

/* ---------- acties ---------- */
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-t]');
  if(!b || !$('app') || !$('app').contains(b) || !/^#\/triage/.test(location.hash)) return;
  const t = b.dataset.t;
  if(t === 'tab'){ UI.tab = b.dataset.k; UI.max = 400; render(); return; }
  if(t === 'flt'){ UI.filter = b.dataset.k; UI.max = 400; render(); return; }
  if(t === 'lev'){ const k = UI.tab + '|' + b.dataset.k; UI.lev[k] = !UI.lev[k]; render(); return; }
  if(t === 'fam'){ const k = b.dataset.k; const codes = famCodes(k); const nu = UI.fam[k] === undefined ? codes.length <= 8 : UI.fam[k]; UI.fam[k] = !nu; render(); return; }
  if(t === 'meer'){ UI.max += 400; render(); return; }
  if(t === 'implok'){ importLokaal(); return; }
  if(t === 's'){
    const c = b.closest('[data-c]').dataset.c, v = b.dataset.v;
    zet({ [c]: { s: statusVan(c) === v ? null : v } }); return;
  }
  if(t === 'fs'){
    const codes = famCodes(b.dataset.k).filter(c => UI.filter === 'todo' ? !statusVan(c) : true);
    if(!codes.length) return;
    if(codes.length > 10 && !confirm(codes.length + ' producten op "' + SLANG[b.dataset.v] + '" zetten?')) return;
    const p = {}; codes.forEach(c => p[c] = { s: b.dataset.v }); zet(p); return;
  }
});
document.addEventListener('change', ev => {
  const el = ev.target;
  if(!el.dataset || !el.dataset.t || !/^#\/triage/.test(location.hash)) return;
  if(el.dataset.t === 'afd'){ const c = el.closest('[data-c]').dataset.c; zet({ [c]: { a: el.value || null } }); return; }
  if(el.dataset.t === 'fafd'){
    if(!el.value) return;
    const codes = famCodes(el.dataset.k).filter(c => UI.filter === 'todo' ? !afdVan(c) : true);
    if(!codes.length){ toast('Alle producten hier hebben al een afdeling'); el.value = ''; return; }
    if(codes.length > 10 && !confirm(codes.length + ' producten naar "' + el.value + '" zetten?')){ el.value = ''; return; }
    const p = {}; codes.forEach(c => p[c] = { a: el.value }); zet(p); return;
  }
  if(el.dataset.t === 'imp' && el.files && el.files[0]){ importBestand(el.files[0]); el.value = ''; }
});
document.addEventListener('input', ev => {
  const el = ev.target;
  if(!el.dataset || el.dataset.t !== 'q' || !/^#\/triage/.test(location.hash)) return;
  UI.q = el.value; clearTimeout(UI.timer);
  UI.timer = setTimeout(() => { UI.max = 400; render(); const n = document.querySelector('[data-t="q"]'); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250);
});
// alle codes van een familie in de huidige lijst (sleutel = lijst|leverancier|familie)
function famCodes(k){
  const [tab, lev, fam] = k.split('|');
  return codesVan(tab).filter(c => {
    const p = prod(c); if(!p) return false;
    const z = T.byCode.get(c);
    const l = (p.leverancier) || (z && T.seed.levs[z.lev]) || '—';
    return l === lev && (z ? T.seed.fams[z.fam] : '') === fam && passend(c);
  });
}

laad().catch(() => {});   // op de achtergrond, zodat de Aanvulbase de afdelingen kent
return { view: render, laad, statusVan, afdVan, SL, SLANG, afdelingen: () => (T.seed ? T.seed.afdelingen : []) };
})();
