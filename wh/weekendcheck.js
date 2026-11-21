/* =====================================================================
   IVOL 3.0 — Weekendcheck (route #/weekendcheck), voor de iPhone.
   Leest NIET live uit Picqer: alles komt uit de snapshot-rij in catalog (bijv. "weekendcheck-2026-w47") die Claude wegschrijft.
   Elke vraag heeft een indeling (snapshot v2): zeker (vooraf beantwoord "Klopt (afgeleid)") · voorstel (één tik) · leverancier
   (opvraaglijst voor Gino) · daan (alleen Daan: wegen of een keuze die geen data geeft) · actie (containerpunt voor een persoon).
   In de vragenlijst staan alleen "voor Daan" (eerst: containers hoog → A → B → C) en daarna de voorstellen; afgeleid is terug te zien
   onder "Afgeleid — bekijken". Antwoorden gaan naar catalog-rij "weekendcheck-antwoorden", NOOIT naar productdata (dat doet Claude
   na "check klaar"). Geen bedrijfsdata in de repo: alles staat in de database.
   ===================================================================== */
window.WHWK = (function(){
'use strict';
const SNAP_KEY = 'weekendcheck-2026-w47', ANT_KEY = 'weekendcheck-antwoorden';
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
const S = { snap:null, ant:{}, fout:null, laden:false, deel:'', id:'', aanpas:false, uit:new Set(), groepOpen:false, el:null, bewaar:0 };
const DEEL = { c:'Containers deze week', i:'Inventaris A/B/C', alle:'Jouw vragen', afgeleid:'Afgeleid — bekijken' };
const FASE = { hoog:'hoog', midden:'midden', A:'klasse A', B:'klasse B', C:'klasse C' };
const SOORT = { daan:'voor jou', voorstel:'voorstel · 1 tik', zeker:'afgeleid', leverancier:'bij leverancier', actie:'actie' };
const GEDAAN = a => a && ['klopt', 'aangepast', 'twijfel'].includes(a.a);
const tijd24 = iso => { try{ return new Date(iso).toLocaleString('nl-NL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', hour12:false }); }catch(e){ return iso || ''; } };
const getal = v => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? null : n; };
const nf = n => Number(n || 0).toLocaleString('nl-NL');

/* ---------- stijl (rem/%, geen vaste breedtes) ---------- */
const CSS = `
.wk{--vlak:#fff;--lijn:#d6dce4;--stil:#5c6675;--voor:#1d4ea0;--voor-bg:#eaf0fb;--ok:#1c7a4a;--let:#b86e00;width:100%;padding:1rem 1rem 6rem;display:grid;gap:1rem;align-content:start}
.wk h1{font-size:1.6rem;font-weight:800;line-height:1.2} .wk h2{font-size:1.15rem;font-weight:800}
.wk .stil{color:var(--stil)} .wk .klein{font-size:.85rem}
.wk .vlak{background:var(--vlak);border:1px solid var(--lijn);border-radius:.75rem;padding:1rem}
.wk ol.ov{display:grid;gap:.35rem;padding-left:1.4rem;font-size:1rem}
.wk .tegels{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))}
.wk .tegel{display:grid;gap:.5rem;text-align:left;font:inherit;color:inherit;cursor:pointer;background:var(--vlak);border:1px solid var(--lijn);border-radius:.75rem;padding:1.1rem;min-height:7rem}
.wk .tegel.pri{border:2px solid var(--voor)}
.wk .tegel b{font-size:1.25rem}
.wk .tellers{display:grid;gap:.4rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,8rem),1fr))}
.wk .teller{background:#f3f5f8;border-radius:.5rem;padding:.45rem .6rem;display:grid}
.wk .teller b{font-size:1.15rem}
.wk .balk{height:.6rem;border-radius:.3rem;background:#e3e8ef;overflow:hidden} .wk .balk i{display:block;height:100%;background:var(--ok)}
.wk .knoppen{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))}
.wk button.k{font:inherit;font-size:1.1rem;font-weight:800;min-height:3.4rem;border-radius:.65rem;border:1px solid var(--lijn);background:var(--vlak);color:inherit;cursor:pointer;padding:.5rem .8rem}
.wk button.k.pri{background:var(--voor);border-color:var(--voor);color:#fff}
.wk button.k.aan{outline:3px solid var(--voor);outline-offset:1px}
.wk button.k:disabled{opacity:.45;cursor:default}
.wk .kopregel{display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;justify-content:space-between}
.wk .terug{font:inherit;font-weight:800;background:none;border:0;color:var(--voor);min-height:2.75rem;cursor:pointer;padding:0;text-align:left}
.wk .code{font-size:1.5rem;font-weight:800;word-break:break-word}
.wk .vraag{font-size:1.35rem;font-weight:800}
.wk .voorstel{background:var(--voor-bg);border-radius:.6rem;padding:.8rem 1rem;display:grid;gap:.25rem}
.wk .voorstel b{font-size:1.25rem;word-break:break-word}
.wk ul.feit{list-style:none;display:grid;gap:.2rem}
.wk ul.feit li::before{content:'· ';color:var(--stil)}
.wk .scherm{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr));align-items:start}
.wk .scherm > .vlak{display:grid;gap:.85rem}
.wk .veld{display:grid;gap:.5rem}
.wk .veld input,.wk .veld select{font:inherit;font-size:1.2rem;min-height:3.2rem;width:100%;border:1px solid var(--lijn);border-radius:.6rem;padding:.4rem .7rem;background:#fff}
.wk .groep label{display:flex;gap:.6rem;align-items:center;min-height:2.75rem;border-bottom:1px solid #edf0f4;cursor:pointer}
.wk .groep input[type=checkbox]{width:1.4rem;height:1.4rem;flex:none}
.wk .groep .lijst{display:grid;max-height:40vh;overflow-y:auto}
.wk .label{display:inline-block;font-size:.8rem;font-weight:800;border-radius:1rem;padding:.1rem .6rem;background:#e9ecf0;color:#3d4753}
.wk .label.hoog{background:#fde2df;color:#8c1d16} .wk .label.midden{background:#fff1dc;color:#7a4a00} .wk .label.daan{background:#fde2df;color:#8c1d16} .wk .label.voorstel{background:#e3ecfb;color:#1d3f7a} .wk .label.zeker{background:#dff3e8;color:#1c5c3a}
.wk .melding{background:#fff1dc;border:1px solid #f0d3a2;border-radius:.6rem;padding:.8rem 1rem}
.wk pre.tekst{white-space:pre-wrap;word-break:break-word;font:inherit;font-size:.9rem}
.wk details.vlak > summary{cursor:pointer;font-weight:800;min-height:2.75rem;display:flex;align-items:center}
.wk .rijen{display:grid;gap:0}
.wk .rij2{display:grid;gap:.15rem;padding:.55rem 0;border-bottom:1px solid #edf0f4}
.wk .kolommen{display:grid;gap:.25rem 1.5rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))}
`;
function stijl(){ if(document.getElementById('wk-stijl')) return; const s = document.createElement('style'); s.id = 'wk-stijl'; s.textContent = CSS; document.head.appendChild(s); }

/* ---------- laden ---------- */
async function laad(){
  if(S.laden || S.snap) return; S.laden = true; S.fout = null;
  try{
    const [s, a] = await Promise.all([WH.catHaal(SNAP_KEY), WH.catHaal(ANT_KEY).catch(() => null)]);
    if(!s || !s.data) throw new Error('De snapshot "' + SNAP_KEY + '" staat nog niet in de database.');
    S.snap = s.data;
    S.ant = (a && a.data && typeof a.data === 'object') ? a.data : {};
  }catch(e){ S.fout = e; }
  S.laden = false; teken();
}
const soortVan = v => v.k || 'daan';                                        // snapshot v1 had nog geen indeling: alles was een vraag
const inLijst = v => ['daan', 'voorstel'].includes(soortVan(v));
// een afgeleid (zeker) antwoord geldt ook zonder rij in de database; een eigen antwoord van Daan gaat altijd voor
const ant = v => S.ant[v.id] || (soortVan(v) === 'zeker' ? { a:'klopt', w:v.vs || '', bron:'claude-afgeleid', z:v.z, t:S.snap.gemaakt } : null);
const alle = () => S.snap ? S.snap.vragen : [];
function vragen(deel){
  if(deel === 'afgeleid') return alle().filter(v => soortVan(v) === 'zeker');
  if(deel === 'alle') return alle().filter(inLijst);
  return alle().filter(v => v.d === deel && inLijst(v));
}
const vind = id => alle().find(v => v.id === id);
const eigenAnt = v => S.ant[v.id] && S.ant[v.id].bron !== 'claude-afgeleid';
function tel(lijst){ const n = lijst.length, k = lijst.filter(v => GEDAAN(ant(v))).length, o = lijst.filter(v => ant(v) && ant(v).a === 'overslaan').length; return { n, k, o, pct:n ? Math.round(k / n * 100) : 100 }; }
function telDeel(d){ const l = alle().filter(v => v.d === d), t = {}; ['zeker', 'voorstel', 'leverancier', 'daan', 'actie'].forEach(k => { t[k] = l.filter(v => soortVan(v) === k).length; }); return t; }
function info(v){
  const b = v.d === 'c' ? ((S.snap.b || {})[v.gk] || {}) : {};
  const p = (S.snap.p || {})[v.c] || [];
  return { q:v.q || b.q || '', vs:v.vs ?? b.vs ?? '', r:v.r || b.r || '', nu:b.nu || '', wie:v.wie || b.wie || '', ctrl:b.ctrl || '', cont:b.n || '', naam:p[0] || '', fe:p.slice(1), groep:(S.snap.g || {})[v.gk] || '', z:v.z };
}
const open = v => !ant(v) || (soortVan(v) !== 'zeker' && !GEDAAN(ant(v)) && ant(v).a !== 'overslaan');
function volgende(van, deel){
  const l = vragen(deel), i = van ? l.findIndex(v => v.id === van) : -1;
  if(deel === 'afgeleid') return i + 1 < l.length ? l[i + 1].id : '';
  for(let j = i + 1; j < l.length; j++) if(!ant(l[j])) return l[j].id;
  for(let j = 0; j < l.length; j++) if(!ant(l[j])) return l[j].id;
  for(let j = 0; j < l.length; j++) if(ant(l[j]) && ant(l[j]).a === 'overslaan') return l[j].id;
  return '';
}

/* ---------- opslaan: alleen de rij weekendcheck-antwoorden (samenvoegen met wat er al staat) ---------- */
function zet(lijst){
  const nu = new Date().toISOString(), patch = {};
  lijst.forEach(([v, a, w, g]) => { const x = { a, w:w ?? '', t:nu, bron:'daan' }; if(g) x.g = 1; S.ant[v.id] = x; patch[v.id] = x; });
  patch._snapshot = S.snap.id || SNAP_KEY; S.ant._snapshot = patch._snapshot;
  S.bewaar++;
  return WH.catPatch(ANT_KEY, patch).then(d => { S.bewaar--; if(d && typeof d === 'object') Object.keys(d).forEach(k => { if(!(k in S.ant)) S.ant[k] = d[k]; }); teken(); })
    .catch(e => { S.bewaar--; S.fout = new Error('Opslaan mislukt: ' + (e.message || e) + '. Je antwoord staat nog op dit scherm; probeer opnieuw.'); teken(); });
}
function beantwoord(v, a, w){
  zet([[v, a, w]]);
  S.aanpas = false; S.uit = new Set(); S.groepOpen = false;
  S.id = volgende(v.id, S.deel) || ''; teken();
}
const groepLeden = v => (S.deel === 'afgeleid' ? [v] : vragen(S.deel || v.d).filter(x => x.gk === v.gk && (x.id === v.id || !GEDAAN(ant(x)))));
function groepsAntwoord(v, keuze){
  const leden = groepLeden(v).filter(x => !S.uit.has(x.id));
  const rij = leden.map(x => {
    const I = info(x);
    if(keuze === '__voorstel') return I.vs !== '' ? [x, 'klopt', I.vs, 1] : null;
    if(keuze === '__allevoorstel') return soortVan(x) === 'voorstel' && I.vs !== '' ? [x, 'klopt', I.vs, 1] : null;
    if(keuze === '__twijfel') return [x, 'twijfel', '', 1];
    if(keuze === '__tewegen') return [x, 'aangepast', 'te wegen', 1];
    return [x, I.vs === keuze ? 'klopt' : 'aangepast', keuze, 1];
  }).filter(Boolean);
  if(!rij.length){ WH.toast('Geen voorstel voor de aangevinkte producten: vul ze per product in'); return; }
  zet(rij); WH.toast(rij.length + ' antwoorden bewaard' + (leden.length > rij.length ? ' (' + (leden.length - rij.length) + ' blijven open)' : ''));
  S.uit = new Set(); S.groepOpen = false; S.id = volgende(v.id, S.deel) || ''; teken();
}

/* ---------- export ---------- */
function exportData(){
  const l = alle().filter(v => ant(v) || ['leverancier', 'actie'].includes(soortVan(v))).map(v => {
    const I = info(v), a = ant(v) || { a:soortVan(v), w:soortVan(v) === 'actie' ? I.vs : '', bron:'claude-afgeleid', t:S.snap.gemaakt };
    return { id:v.id, deel:v.d === 'c' ? 'containers' : 'inventaris', fase:v.f, indeling:soortVan(v), groep:I.groep, product:v.c, veld:v.v, vraag:I.q, voorstel:I.vs,
      antwoord:a.a, waarde:a.w, bron:a.bron || 'daan', zekerheid:a.z ?? v.z ?? null, uitleg:I.r, wie:v.wie || a.wie || '', groepsantwoord:!!a.g, tijd:a.t };
  });
  return { snapshot:S.snap.id || SNAP_KEY, snapshot_gemaakt:S.snap.gemaakt, export:new Date().toISOString(), aantal:l.length, antwoorden:l };
}
function samenvatting(){
  const e = exportData().antwoorden, van = b => e.filter(x => x.bron === b);
  const d = van('daan'), per = k => d.filter(x => x.antwoord === k);
  const regel = x => '- ' + (x.product || x.groep) + ' · ' + x.vraag + ': ' + (x.waarde || '—') + (x.antwoord === 'twijfel' ? ' (twijfel)' : '');
  const jij = tel(vragen('alle'));
  return ['# Weekendcheck — antwoorden', '', 'Snapshot: ' + (S.snap.id || SNAP_KEY) + ' (' + tijd24(S.snap.gemaakt) + '), export ' + tijd24(new Date().toISOString()), '',
    ...S.snap.overzicht.map((t, n) => (n + 1) + '. ' + t), '',
    '## Stand', '- Jouw vragen en voorstellen: ' + jij.k + ' van ' + jij.n + ' beantwoord' + (jij.o ? ', ' + jij.o + ' overgeslagen' : ''),
    '- Afgeleid door Claude (zeker): ' + e.filter(x => x.bron === 'claude-afgeleid' && x.antwoord === 'klopt').length,
    '- Bij leveranciers: ' + e.filter(x => x.indeling === 'leverancier').length + ' · acties per persoon: ' + e.filter(x => x.indeling === 'actie').length,
    '- Daan: klopt ' + per('klopt').length + ' · aangepast ' + per('aangepast').length + ' · twijfel ' + per('twijfel').length + ' · overgeslagen ' + per('overslaan').length, '',
    '## Aangepast door Daan', ...(per('aangepast').map(regel).slice(0, 400)), '', '## Twijfel', ...(per('twijfel').map(regel).slice(0, 400)), '',
    'Nog niet in productdata: Claude zet dit over na "check klaar".'].join('\n');
}
function download(naam, tekst, type){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([tekst], { type })); a.download = naam;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function exporteer(){
  download('weekendcheck-antwoorden.json', JSON.stringify(exportData(), null, 1), 'application/json');
  setTimeout(() => download('weekendcheck-samenvatting.md', samenvatting(), 'text/markdown'), 700);
  S.geexporteerd = new Date().toISOString(); teken();
}
function platteTekst(){
  const j = tel(vragen('alle'));
  return ['Weekendcheck ' + (S.snap.id || SNAP_KEY) + ' (' + tijd24(S.snap.gemaakt) + ')', ...S.snap.overzicht.map((t, n) => (n + 1) + '. ' + t),
    'Beantwoord door Daan: ' + j.k + ' van ' + j.n + '.'].join('\n');
}
async function kopieer(){
  const t = platteTekst();
  try{ await navigator.clipboard.writeText(t); WH.toast('Overzicht gekopieerd'); }
  catch(e){ S.toonTekst = t; teken(); }
}

/* ---------- schermen ---------- */
function tellers(t, d){
  const r = [['zeker', 'afgeleid zeker'], ['voorstel', 'voorstel (1 tik)'], ['leverancier', 'bij leverancier'], ['daan', 'voor Daan']].concat(d === 'c' ? [['actie', 'acties']] : []);
  return `<div class="tellers">${r.map(([k, l]) => `<div class="teller" data-tel="${k}"><b>${nf(t[k])}</b><span class="klein stil">${l}</span></div>`).join('')}</div>`;
}
function start(){
  const sn = S.snap, jij = vragen('alle'), tj = tel(jij), daanL = jij.filter(v => soortVan(v) === 'daan'), td = tel(daanL);
  const tegel = (d, titel, sub) => { const t = telDeel(d), tt = tel(vragen(d)); return `<button class="tegel" data-wk="deel" data-d="${d}"><b>${esc(titel)}</b>${tellers(t, d)}<span>${tt.k} van ${tt.n} gedaan (voor Daan + voorstellen)</span><div class="balk"><i style="width:${tt.pct}%"></i></div><span class="stil klein">${esc(sub)}</span></button>`; };
  const act = sn.acties || {}, lev = sn.leveranciers || [], weeg = sn.weeglijst || {};
  return `<div class="kopregel"><h1>Weekendcheck</h1><span class="stil klein">Stand ${esc(tijd24(sn.gemaakt))} · ${esc(sn.bron || '')}</span></div>
    <section class="vlak"><ol class="ov">${sn.overzicht.map(t => `<li>${esc(t)}</li>`).join('')}</ol></section>
    <div class="tegels"><button class="tegel pri" data-wk="deel" data-d="alle"><b>Start: eerst jouw vragen</b><span>${td.k} van ${td.n} voor jou · ${tj.k - td.k} van ${tj.n - td.n} voorstellen</span><div class="balk"><i style="width:${tj.pct}%"></i></div><span class="stil klein">Volgorde: containers hoog → A → B → C, wegen per hal en gang, daarna de voorstellen van één tik.</span></button>
      ${tegel('c', DEEL.c, (sn.containers || []).length + ' containers · datafixes en acties per persoon')}${tegel('i', DEEL.i, 'per groep (leverancier + hoofdwoord)')}</div>
    <div class="tegels">
      <button class="tegel" data-wk="deel" data-d="afgeleid"><b>Afgeleid — bekijken</b><span>${nf(vragen('afgeleid').length)} vragen vooraf beantwoord uit de data, met bron en zekerheid. Aanpassen kan altijd.</span></button>
      ${Object.keys(weeg).length ? `<section class="vlak"><h2>Weeglijst</h2><ul class="feit">${Object.entries(weeg).map(([h, l]) => `<li>${esc(h.replace(/^Wegen · /, ''))}: ${esc(l.join(', '))}</li>`).join('')}</ul></section>` : ''}
    </div>
    ${Object.keys(act).length ? `<details class="vlak" data-blok="acties"><summary>Acties per persoon (${Object.values(act).reduce((s, l) => s + l.length, 0)})</summary><div class="kolommen">${Object.entries(act).sort((a, b) => b[1].length - a[1].length).map(([w, l]) => `<div class="rijen"><b>${esc(w)}</b>${l.map(x => `<div class="rij2"><span>${esc(x.cont)} · ${esc(x.wat)}</span><span class="klein stil">${esc(x.doe)} — ${esc(x.codes.slice(0, 6).join(', '))}${x.n > 6 ? ' +' + (x.n - 6) : ''}</span></div>`).join('')}</div>`).join('')}</div></details>` : ''}
    ${lev.length ? `<details class="vlak" data-blok="leveranciers"><summary>Bij leveranciers (${lev.length} opvraaglijsten, ${nf(lev.reduce((s, x) => s + x.n, 0))} producten)</summary><div class="kolommen">${lev.map(x => `<div class="rij2"><b>${esc(x.lev)}</b><span class="klein stil">${x.n} producten (${Object.entries(x.abc).map(([k, n]) => k + ' ' + n).join(' · ')}): ${esc(Object.entries(x.velden).map(([k, n]) => k + ' ' + n).join(', '))}</span></div>`).join('')}</div><p class="klein stil">Excel per leverancier in iCloud Drive/IVOL/Opvragen (gele cellen = invullen).</p></details>` : ''}
    <section class="vlak" style="display:grid;gap:.75rem"><b>Klaar?</b><span class="stil">De antwoorden staan al veilig in de database. Exporteren is voor Claude: daarna zet Claude ze over naar productdata.</span>
      <div class="knoppen"><button class="k pri" data-wk="export">Klaar — export voor Claude</button><button class="k" data-wk="kopieer">Kopieer overzicht</button></div>
      ${S.geexporteerd ? `<span class="stil klein">Gedownload om ${esc(tijd24(S.geexporteerd))}: weekendcheck-antwoorden.json en weekendcheck-samenvatting.md.</span>` : ''}
      ${S.toonTekst ? `<pre class="tekst vlak">${esc(S.toonTekst)}</pre>` : ''}</section>`;
}
function afgeleidScherm(){
  const l = vragen('afgeleid'), per = {};
  l.forEach(v => { const k = (v.d === 'c' ? 'Containers · ' : 'Inventaris · ') + ({ soort:'soort', gewicht:'gewicht', maxpick:'max op pick', spp:'stuks per pallet', pallet:'palletmaat en hoogte', vn:'vloernaam', container:'datafix' }[v.v] || v.v); (per[k] = per[k] || []).push(v); });
  return `<div class="kopregel"><button class="terug" data-wk="home">← Weekendcheck</button><span class="stil">${nf(l.length)} afgeleid</span></div><h1>Afgeleid — bekijken</h1>
    <p class="stil">Vooraf beantwoord uit de eigen data (palletbewijs, palletlabels, mutaties, containerverdeling, kleurgenoten, vaste regels). Tik een regel om hem te bekijken of aan te passen.</p>
    ${Object.entries(per).map(([k, lst]) => `<details class="vlak" data-blok="afgeleid"><summary>${esc(k)} (${lst.length})</summary><div class="rijen">${lst.map(v => { const a = ant(v); return `<button class="terug rij2" data-wk="bekijk" data-id="${esc(v.id)}"><span><b>${esc(v.c || info(v).cont)}</b> · ${esc(a && a.w || v.vs || '')}${eigenAnt(v) ? ' <span class="label voorstel">aangepast door jou</span>' : ''}</span><span class="klein stil">${esc(String(v.r || '').slice(0, 140))}</span></button>`; }).join('')}</div></details>`).join('')}`;
}
function veldHtml(v, I){
  const a = ant(v), w = a && a.a === 'aangepast' ? a.w : (I.vs || '');
  if(v.t === 'keus') return `<div class="knoppen">${(v.o || []).map(o => `<button class="k ${o === I.vs ? 'aan' : ''}" data-wk="kies" data-w="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  const inp = v.t === 'getal' ? `<input id="wk-w" inputmode="decimal" value="${esc(String(w).replace(/[^\d.,]/g, ''))}" placeholder="${esc(v.eh || '')}">`
    : `<input id="wk-w" value="${esc(v.d === 'c' && soortVan(v) === 'daan' ? (a && a.a === 'aangepast' ? a.w : '') : w)}" placeholder="${esc(v.ph || (v.d === 'c' ? 'wat moet er gebeuren?' : ''))}">`;
  return `<label class="veld"><span>${v.t === 'getal' ? 'Getal' + (v.eh ? ' (' + esc(v.eh) + ')' : '') : v.d === 'c' ? 'Jouw waarde of opmerking' : 'Waarde'}</span>${inp}</label><div class="knoppen"><button class="k pri" data-wk="bewaar">Bewaar</button><button class="k" data-wk="annuleer">Annuleer</button></div>`;
}
function groepHtml(v, I){
  const leden = groepLeden(v); if(leden.length < 2) return '';
  const keuzes = v.t === 'keus' ? (v.o || []).map(o => [o, o]) : v.v === 'gewicht' ? [['__voorstel', 'voorstel (eigen data per product)'], ['__tewegen', 'te wegen']] : v.d === 'c' ? [['__voorstel', 'Klopt'], ['__twijfel', 'Twijfel']] : [['__voorstel', 'voorstel (per product)'], ['__twijfel', 'Twijfel']];
  const aan = leden.filter(x => !S.uit.has(x.id)).length;
  const metVs = leden.filter(x => !S.uit.has(x.id) && info(x).vs !== '').length;
  const nVs = leden.filter(x => !S.uit.has(x.id) && soortVan(x) === 'voorstel' && info(x).vs !== '').length;
  if(!metVs) keuzes.forEach(k => { if(k[0] === '__voorstel') k[1] = 'geen voorstel: per product invullen'; });
  return `<section class="vlak groep">${nVs ? `<button class="k pri" data-wk="groepkies" data-w="__allevoorstel">Alle voorstellen in deze groep kloppen (${nVs})</button>` : ''}
    <button class="terug" data-wk="groep">${S.groepOpen ? '▾' : '▸'} Hele groep: ${leden.length} ${v.d === 'c' ? 'producten met deze bevinding' : 'producten met deze vraag'} (${aan} aangevinkt)</button>
    ${S.groepOpen ? `<div class="lijst">${leden.map(x => { const J = info(x); return `<label><input type="checkbox" data-wk="vink" data-id="${esc(x.id)}" ${S.uit.has(x.id) ? '' : 'checked'}><span><b>${esc(x.c || J.cont)}</b> ${esc(J.naam)}${J.vs !== '' ? ' · <span class="stil">' + esc(SOORT[soortVan(x)]) + ': ' + esc(J.vs) + '</span>' : ''}</span></label>`; }).join('')}</div>
      <b>Selectie is:</b><div class="knoppen">${keuzes.map(([k, t]) => `<button class="k" data-wk="groepkies" data-w="${esc(k)}" ${aan && (k !== '__voorstel' || metVs) ? '' : 'disabled'}>${esc(t)}</button>`).join('')}</div>
      <span class="stil klein">Geldt voor alles wat aangevinkt is; vink uitzonderingen uit. Waarden per product uit de eigen data.</span>` : ''}</section>`;
}
function vraagScherm(){
  const v = vind(S.id); if(!v){ S.id = ''; return start(); }
  const lijst = vragen(S.deel), pos = lijst.findIndex(x => x.id === v.id), t = tel(lijst), I = info(v), a = ant(v), k = soortVan(v);
  const titel = v.d === 'c' ? (I.cont + (v.c ? ' · ' + v.c : '')) : v.c;
  const zk = I.z != null ? ' · klopte bij ' + Math.round(I.z * 100) + '%' : '';
  const feiten = (v.d === 'c' ? [I.ctrl, I.nu ? 'nu (live): ' + I.nu : '', I.wie ? 'wie: ' + I.wie : ''].concat(I.fe) : I.fe).filter(Boolean);
  return `<div class="kopregel"><button class="terug" data-wk="home">← Weekendcheck</button><span class="stil">${esc(DEEL[S.deel])} · ${pos + 1} van ${lijst.length}</span></div>
    <div class="balk"><i style="width:${t.pct}%"></i></div>
    <div class="scherm">
      <section class="vlak">
        <div><span class="label ${esc(k)}">${esc(SOORT[k])}</span> <span class="label ${esc(v.f)}">${esc(FASE[v.f] || v.f)}</span> <span class="stil klein">${esc(I.groep)}</span></div>
        <div class="code">${esc(titel)}</div>${I.naam ? `<div>${esc(I.naam)}</div>` : ''}
        <div class="vraag">${esc(I.q)}</div>
        <div class="voorstel"><span class="stil klein">${k === 'zeker' ? 'Afgeleid uit de data' + zk : k === 'daan' ? 'Wat de data zegt' : 'Voorstel uit de data' + zk}</span><b>${esc(I.vs !== '' ? I.vs : 'geen voorstel')}</b>${I.r ? `<span class="klein">${esc(I.r)}</span>` : ''}${v.alt && v.alt.length ? `<span class="klein stil">twijfel tussen ${esc(v.alt.join(' / '))}</span>` : ''}</div>
        ${a && (k !== 'zeker' || eigenAnt(v)) ? `<div class="stil klein">Eerder: ${esc({ klopt:'klopt', aangepast:'aangepast', twijfel:'twijfel', overslaan:'overgeslagen' }[a.a] || a.a)}${a.w ? ' · ' + esc(a.w) : ''} (${esc(tijd24(a.t))})</div>` : ''}
        ${S.aanpas ? veldHtml(v, I) : `<div class="knoppen"><button class="k pri" data-wk="klopt" ${I.vs === '' && v.d !== 'c' ? 'disabled' : ''}>Klopt</button><button class="k" data-wk="aanpassen">Aanpassen</button><button class="k" data-wk="twijfel">Twijfel</button>${S.deel === 'afgeleid' ? '' : '<button class="k" data-wk="overslaan">Overslaan</button>'}</div>`}
        <div class="kopregel"><button class="terug" data-wk="vorige" ${pos > 0 ? '' : 'disabled'}>← Vorige</button><button class="terug" data-wk="verder">Volgende →</button></div>
      </section>
      <div style="display:grid;gap:1rem">
        <section class="vlak"><b>Feiten</b><ul class="feit">${feiten.map(f => `<li>${esc(f)}</li>`).join('')}</ul></section>
        ${groepHtml(v, I)}
      </div>
    </div>`;
}
function klaarScherm(){
  const t = tel(vragen(S.deel));
  return `<div class="kopregel"><button class="terug" data-wk="home">← Weekendcheck</button></div><section class="vlak" style="display:grid;gap:.75rem"><h1>${esc(DEEL[S.deel])}: klaar</h1>
    <span>${t.k} van ${t.n} beantwoord${t.o ? ', ' + t.o + ' overgeslagen' : ''}.</span><div class="knoppen"><button class="k pri" data-wk="home">Terug naar het begin</button></div></section>`;
}
function teken(){
  const el = S.el; if(!el || !el.isConnected) return;
  let h, sch;
  if(S.fout && !S.snap){ h = `<div class="melding">${esc(S.fout.message || S.fout)}</div>`; sch = 'fout'; }
  else if(!S.snap){ h = `<div class="stil">Weekendcheck laden…</div>`; sch = 'laden'; }
  else {
    sch = !S.deel ? 'start' : S.deel === 'afgeleid' && !S.id ? 'afgeleid' : S.id ? 'vraag' : 'klaar';
    h = (S.fout ? `<div class="melding">${esc(S.fout.message)}</div>` : '') + (sch === 'start' ? start() : sch === 'afgeleid' ? afgeleidScherm() : sch === 'vraag' ? vraagScherm() : klaarScherm());
  }
  el.innerHTML = `<div class="wk" data-scherm="${sch}">${h}</div>`;
}
function render(el, rest){
  stijl(); S.el = el;
  const d = String(rest || '').split('/')[0];
  if(['c', 'i', 'alle', 'afgeleid'].includes(d)){ if(S.deel !== d){ S.deel = d; S.id = ''; } } else S.deel = '';
  teken();
  laad().then(() => { if(S.deel && S.deel !== 'afgeleid' && !S.id && S.snap){ S.id = volgende('', S.deel); teken(); } });
  if(S.snap && S.deel && S.deel !== 'afgeleid' && !S.id){ S.id = volgende('', S.deel); teken(); }
}
document.addEventListener('click', ev => {
  const k = ev.target.closest('.wk [data-wk]'); if(!k || !S.snap) return;
  const a = k.dataset.wk;
  if(a === 'deel'){ location.hash = '#/weekendcheck/' + k.dataset.d; return; }
  if(a === 'home'){ location.hash = '#/weekendcheck'; return; }
  if(a === 'export'){ exporteer(); return; }
  if(a === 'kopieer'){ kopieer(); return; }
  if(a === 'bekijk'){ S.id = k.dataset.id; S.aanpas = false; teken(); const n = document.getElementById('native'); if(n) n.scrollTop = 0; return; }
  const v = S.id ? vind(S.id) : null; if(!v) return;
  const I = info(v);
  if(a === 'klopt'){ beantwoord(v, 'klopt', I.vs); return; }
  if(a === 'twijfel'){ beantwoord(v, 'twijfel', ''); return; }
  if(a === 'overslaan'){ beantwoord(v, 'overslaan', ''); return; }
  if(a === 'aanpassen'){ S.aanpas = true; teken(); const i = document.getElementById('wk-w'); if(i) i.focus(); return; }
  if(a === 'annuleer'){ S.aanpas = false; teken(); return; }
  if(a === 'kies'){ beantwoord(v, k.dataset.w === I.vs ? 'klopt' : 'aangepast', k.dataset.w); return; }
  if(a === 'bewaar'){
    const w = ((document.getElementById('wk-w') || {}).value || '').trim(); if(!w) return;
    if(v.t === 'getal' && getal(w) === null){ WH.toast('Vul een getal in'); return; }
    const kg = v.v === 'gewicht' || v.eh === 'kg';
    const waarde = v.t === 'getal' && !kg ? String(Math.round(getal(w))) : w;   // nooit decimalen in aantallen
    beantwoord(v, waarde === I.vs ? 'klopt' : 'aangepast', kg && v.t === 'getal' ? 'gewogen ' + waarde + ' kg' : waarde); return;
  }
  if(a === 'vorige'){ const l = vragen(S.deel), i = l.findIndex(x => x.id === v.id); if(i > 0){ S.id = l[i - 1].id; S.aanpas = false; S.uit = new Set(); teken(); } return; }
  if(a === 'verder'){ const l = vragen(S.deel), i = l.findIndex(x => x.id === v.id); S.id = i + 1 < l.length ? l[i + 1].id : ''; S.aanpas = false; S.uit = new Set(); teken(); return; }
  if(a === 'groep'){ S.groepOpen = !S.groepOpen; teken(); return; }
  if(a === 'groepkies'){ groepsAntwoord(v, k.dataset.w); return; }
});
document.addEventListener('change', ev => {
  const k = ev.target.closest('.wk [data-wk="vink"]'); if(!k) return;
  if(k.checked) S.uit.delete(k.dataset.id); else S.uit.add(k.dataset.id); teken();
});
document.addEventListener('keydown', ev => { if(ev.key === 'Enter' && ev.target && ev.target.id === 'wk-w'){ const b = document.querySelector('.wk [data-wk="bewaar"]'); if(b) b.click(); } });
return { S, render, laad, exportData, samenvatting, platteTekst, vragen, telDeel, ant, SNAP_KEY, ANT_KEY };
})();
