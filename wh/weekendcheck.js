/* =====================================================================
   IVOL 3.0 — Weekendcheck (route #/weekendcheck), voor de iPhone.
   Leest NIET live uit Picqer: alles komt uit de snapshot-rij in catalog (bijv. "weekendcheck-2026-w47"), die Claude
   bij de weekendcheck wegschrijft (bevindingen + invulvragen). Zo werkt het zonder koppelcode.
   Antwoorden gaan naar catalog-rij "weekendcheck-antwoorden" (per vraag: antwoord, waarde, tijd), NOOIT naar productdata:
   dat doet Claude na "check klaar". Eén vraag per scherm, voorstel uit de data, Klopt / Aanpassen / Twijfel / Overslaan,
   per groep "Selectie is: …". Geen bedrijfsdata in de repo: alles staat in de database.
   ===================================================================== */
window.WHWK = (function(){
'use strict';
const SNAP_KEY = 'weekendcheck-2026-w47', ANT_KEY = 'weekendcheck-antwoorden';
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
const S = { snap:null, ant:{}, fout:null, laden:false, deel:'', id:'', aanpas:false, uit:new Set(), groepOpen:false, el:null, bewaar:0 };
const DEEL = { c:'Containers deze week', i:'Inventaris A/B/C' };
const FASE = { hoog:'hoog', midden:'midden', A:'klasse A', B:'klasse B', C:'klasse C' };
const GEDAAN = a => a && ['klopt', 'aangepast', 'twijfel'].includes(a.a);
const tijd24 = iso => { try{ return new Date(iso).toLocaleString('nl-NL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', hour12:false }); }catch(e){ return iso || ''; } };
const getal = v => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? null : n; };

/* ---------- stijl (rem/%, geen vaste breedtes) ---------- */
const CSS = `
.wk{--vlak:#fff;--lijn:#d6dce4;--stil:#5c6675;--voor:#1d4ea0;--voor-bg:#eaf0fb;--ok:#1c7a4a;--let:#b86e00;width:100%;padding:1rem 1rem 6rem;display:grid;gap:1rem;align-content:start}
.wk h1{font-size:1.6rem;font-weight:800;line-height:1.2}
.wk .stil{color:var(--stil)} .wk .klein{font-size:.85rem}
.wk .vlak{background:var(--vlak);border:1px solid var(--lijn);border-radius:.75rem;padding:1rem}
.wk ol.ov{display:grid;gap:.35rem;padding-left:1.4rem;font-size:1rem}
.wk .tegels{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))}
.wk .tegel{display:grid;gap:.5rem;text-align:left;font:inherit;color:inherit;cursor:pointer;background:var(--vlak);border:1px solid var(--lijn);border-radius:.75rem;padding:1.1rem;min-height:7rem}
.wk .tegel b{font-size:1.25rem}
.wk .balk{height:.6rem;border-radius:.3rem;background:#e3e8ef;overflow:hidden} .wk .balk i{display:block;height:100%;background:var(--ok)}
.wk .knoppen{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))}
.wk button.k{font:inherit;font-size:1.1rem;font-weight:800;min-height:3.4rem;border-radius:.65rem;border:1px solid var(--lijn);background:var(--vlak);color:inherit;cursor:pointer;padding:.5rem .8rem}
.wk button.k.pri{background:var(--voor);border-color:var(--voor);color:#fff}
.wk button.k.aan{outline:3px solid var(--voor);outline-offset:1px}
.wk button.k:disabled{opacity:.45;cursor:default}
.wk .kopregel{display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;justify-content:space-between}
.wk .terug{font:inherit;font-weight:800;background:none;border:0;color:var(--voor);min-height:2.75rem;cursor:pointer;padding:0}
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
.wk .label.hoog{background:#fde2df;color:#8c1d16} .wk .label.midden{background:#fff1dc;color:#7a4a00}
.wk .melding{background:#fff1dc;border:1px solid #f0d3a2;border-radius:.6rem;padding:.8rem 1rem}
.wk pre.tekst{white-space:pre-wrap;word-break:break-word;font:inherit;font-size:.9rem}
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
const vragen = deel => (S.snap ? S.snap.vragen : []).filter(v => !deel || v.d === deel);
const ant = v => S.ant[v.id];
const vind = id => S.snap.vragen.find(v => v.id === id);
function tel(lijst){ const n = lijst.length, k = lijst.filter(v => GEDAAN(ant(v))).length, o = lijst.filter(v => ant(v) && ant(v).a === 'overslaan').length; return { n, k, o, pct:n ? Math.round(k / n * 100) : 100 }; }
// tekst van een vraag (containervragen delen hun tekst per bevinding)
function info(v){
  const b = v.d === 'c' ? (S.snap.b[v.gk] || {}) : {};
  const p = (S.snap.p || {})[v.c] || [];
  return { q:v.q || b.q || '', vs:v.vs ?? b.vs ?? '', r:v.r || b.r || '', nu:b.nu || '', wie:b.wie || '', ctrl:b.ctrl || '', cont:b.n || '', naam:p[0] || '', fe:p.slice(1), groep:(S.snap.g || {})[v.gk] || '' };
}
function volgende(van, deel){
  const l = vragen(deel), i = van ? l.findIndex(v => v.id === van) : -1;
  for(let j = i + 1; j < l.length; j++) if(!ant(l[j])) return l[j].id;
  for(let j = 0; j < l.length; j++) if(!ant(l[j])) return l[j].id;
  for(let j = 0; j < l.length; j++) if(ant(l[j]) && ant(l[j]).a === 'overslaan') return l[j].id;
  return '';
}

/* ---------- opslaan: alleen de rij weekendcheck-antwoorden (samenvoegen met wat er al staat) ---------- */
function zet(lijst){
  const nu = new Date().toISOString(), patch = {};
  lijst.forEach(([v, a, w, g]) => { const x = { a, w:w ?? '', t:nu }; if(g) x.g = 1; S.ant[v.id] = x; patch[v.id] = x; });
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
function groepsAntwoord(v, keuze){
  const leden = groepLeden(v).filter(x => !S.uit.has(x.id));
  const rij = leden.map(x => {
    const I = info(x);
    if(keuze === '__voorstel') return I.vs !== '' ? [x, 'klopt', I.vs, 1] : null;
    if(keuze === '__twijfel') return [x, 'twijfel', '', 1];
    if(keuze === '__tewegen') return [x, 'aangepast', 'te wegen', 1];
    return [x, I.vs === keuze ? 'klopt' : 'aangepast', keuze, 1];
  }).filter(Boolean);
  if(!rij.length){ WH.toast('Geen voorstel voor de aangevinkte producten: vul ze per product in'); return; }
  zet(rij); WH.toast(rij.length + ' antwoorden bewaard' + (leden.length > rij.length ? ' (' + (leden.length - rij.length) + ' zonder voorstel blijven open)' : ''));
  S.uit = new Set(); S.groepOpen = false; S.id = volgende(v.id, S.deel) || ''; teken();
}
const groepLeden = v => vragen(v.d).filter(x => x.gk === v.gk && (x.id === v.id || !GEDAAN(ant(x))));

/* ---------- export ---------- */
function exportData(){
  const l = S.snap.vragen.filter(v => ant(v)).map(v => { const I = info(v), a = ant(v); return { id:v.id, deel:v.d === 'c' ? 'containers' : 'inventaris', fase:v.f, groep:I.groep, product:v.c, veld:v.v, vraag:I.q, voorstel:I.vs, antwoord:a.a, waarde:a.w, groepsantwoord:!!a.g, tijd:a.t }; });
  return { snapshot:S.snap.id || SNAP_KEY, snapshot_gemaakt:S.snap.gemaakt, export:new Date().toISOString(), aantal:l.length, antwoorden:l };
}
function samenvatting(){
  const c = tel(vragen('c')), i = tel(vragen('i')), e = exportData().antwoorden;
  const per = k => e.filter(x => x.antwoord === k);
  const regel = x => '- ' + (x.product || x.groep) + ' · ' + x.vraag + ': ' + (x.waarde || '—') + (x.antwoord === 'twijfel' ? ' (twijfel)' : '');
  return ['# Weekendcheck — antwoorden van Daan', '', 'Snapshot: ' + (S.snap.id || SNAP_KEY) + ' (' + tijd24(S.snap.gemaakt) + '), export ' + tijd24(new Date().toISOString()), '',
    ...S.snap.overzicht.map((t, n) => (n + 1) + '. ' + t), '',
    '## Stand', '- Containers: ' + c.k + ' van ' + c.n + ' beantwoord' + (c.o ? ', ' + c.o + ' overgeslagen' : ''),
    '- Inventaris: ' + i.k + ' van ' + i.n + ' beantwoord' + (i.o ? ', ' + i.o + ' overgeslagen' : ''),
    '- Klopt: ' + per('klopt').length + ' · Aangepast: ' + per('aangepast').length + ' · Twijfel: ' + per('twijfel').length + ' · Overgeslagen: ' + per('overslaan').length, '',
    '## Aangepast', ...(per('aangepast').map(regel).slice(0, 400)), '', '## Twijfel', ...(per('twijfel').map(regel).slice(0, 400)), '',
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
  const c = tel(vragen('c')), i = tel(vragen('i'));
  return ['Weekendcheck ' + (S.snap.id || SNAP_KEY) + ' (' + tijd24(S.snap.gemaakt) + ')', ...S.snap.overzicht.map((t, n) => (n + 1) + '. ' + t),
    'Beantwoord: containers ' + c.k + '/' + c.n + ', inventaris ' + i.k + '/' + i.n + '.'].join('\n');
}
async function kopieer(){
  const t = platteTekst();
  try{ await navigator.clipboard.writeText(t); WH.toast('Overzicht gekopieerd'); }
  catch(e){ S.toonTekst = t; teken(); }
}

/* ---------- schermen ---------- */
function start(){
  const sn = S.snap, c = tel(vragen('c')), i = tel(vragen('i'));
  const kl = ['A', 'B', 'C'].map(k => { const t = tel(vragen('i').filter(v => v.f === k)); return 'klasse ' + k + ': ' + t.k + '/' + t.n; }).join(' · ');
  const tegel = (d, titel, t, sub) => `<button class="tegel" data-wk="deel" data-d="${d}"><b>${esc(titel)}</b><span>${t.k} van ${t.n} beantwoord${t.o ? ' · ' + t.o + ' overgeslagen' : ''}</span><div class="balk"><i style="width:${t.pct}%"></i></div><span class="stil klein">${esc(sub)}</span></button>`;
  return `<div class="kopregel"><h1>Weekendcheck</h1><span class="stil klein">Stand ${esc(tijd24(sn.gemaakt))} · ${esc(sn.bron || '')}</span></div>
    <section class="vlak"><ol class="ov">${sn.overzicht.map(t => `<li>${esc(t)}</li>`).join('')}</ol></section>
    <div class="tegels">${tegel('c', DEEL.c, c, (sn.containers || []).length + ' containers · eerst ernst hoog, dan midden')}${tegel('i', DEEL.i, i, kl)}</div>
    <section class="vlak" style="display:grid;gap:.75rem"><b>Klaar?</b><span class="stil">De antwoorden staan al veilig in de database. Exporteren is voor Claude: daarna zet Claude ze over naar productdata.</span>
      <div class="knoppen"><button class="k pri" data-wk="export">Klaar — export voor Claude</button><button class="k" data-wk="kopieer">Kopieer overzicht</button></div>
      ${S.geexporteerd ? `<span class="stil klein">Gedownload om ${esc(tijd24(S.geexporteerd))}: weekendcheck-antwoorden.json en weekendcheck-samenvatting.md.</span>` : ''}
      ${S.toonTekst ? `<pre class="tekst vlak">${esc(S.toonTekst)}</pre>` : ''}</section>`;
}
function veldHtml(v, I){
  const a = ant(v), w = a && a.a === 'aangepast' ? a.w : (I.vs || '');
  if(v.t === 'keus') return `<div class="knoppen">${(v.o || []).map(o => `<button class="k ${o === I.vs ? 'aan' : ''}" data-wk="kies" data-w="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  const inp = v.t === 'getal' ? `<input id="wk-w" inputmode="decimal" value="${esc(String(w).replace(/[^\d.,]/g, ''))}" placeholder="${esc(v.eh || '')}">`
    : `<input id="wk-w" value="${esc(v.d === 'c' ? (a && a.a === 'aangepast' ? a.w : '') : w)}" placeholder="${esc(v.ph || (v.d === 'c' ? 'wat moet er gebeuren?' : ''))}">`;
  return `<label class="veld"><span>${v.t === 'getal' ? 'Getal' + (v.eh ? ' (' + esc(v.eh) + ')' : '') : v.d === 'c' ? 'Jouw actie of opmerking' : 'Waarde'}</span>${inp}</label><div class="knoppen"><button class="k pri" data-wk="bewaar">Bewaar</button><button class="k" data-wk="annuleer">Annuleer</button></div>`;
}
function groepHtml(v, I){
  const leden = groepLeden(v); if(leden.length < 2) return '';
  const keuzes = v.t === 'keus' ? (v.o || []).map(o => [o, o]) : v.v === 'gewicht' ? [['__voorstel', 'vertrouwd (eigen Picqer-kg)'], ['__tewegen', 'te wegen']] : v.d === 'c' ? [['__voorstel', 'Klopt'], ['__twijfel', 'Twijfel']] : [['__voorstel', 'voorstel (per product)'], ['__twijfel', 'Twijfel']];
  const aan = leden.filter(x => !S.uit.has(x.id)).length;
  const metVs = leden.filter(x => !S.uit.has(x.id) && info(x).vs !== '').length;   // "voorstel" kan alleen waar de data een voorstel geeft
  if(!metVs) keuzes.forEach(k => { if(k[0] === '__voorstel') k[1] = 'geen voorstel: per product invullen'; });
  return `<section class="vlak groep"><button class="terug" data-wk="groep">${S.groepOpen ? '▾' : '▸'} Hele groep: ${leden.length} ${v.d === 'c' ? 'producten met deze bevinding' : 'producten met deze vraag'} (${aan} aangevinkt)</button>
    ${S.groepOpen ? `<div class="lijst">${leden.map(x => { const J = info(x); return `<label><input type="checkbox" data-wk="vink" data-id="${esc(x.id)}" ${S.uit.has(x.id) ? '' : 'checked'}><span><b>${esc(x.c || J.cont)}</b> ${esc(J.naam)}${J.vs !== '' && v.d !== 'c' ? ' · <span class="stil">voorstel ' + esc(J.vs) + '</span>' : ''}</span></label>`; }).join('')}</div>
      <b>Selectie is:</b><div class="knoppen">${keuzes.map(([k, t]) => `<button class="k" data-wk="groepkies" data-w="${esc(k)}" ${aan && (k !== '__voorstel' || metVs) ? '' : 'disabled'}>${esc(t)}</button>`).join('')}</div>
      <span class="stil klein">Geldt voor alles wat aangevinkt is; vink uitzonderingen uit. Waarden per product uit de eigen data.</span>` : ''}</section>`;
}
function vraagScherm(){
  const v = vind(S.id); if(!v) { S.id = ''; return start(); }
  const lijst = vragen(S.deel), pos = lijst.findIndex(x => x.id === v.id), t = tel(lijst), I = info(v), a = ant(v);
  const titel = v.d === 'c' ? (I.cont + (v.c ? ' · ' + v.c : '')) : v.c;
  return `<div class="kopregel"><button class="terug" data-wk="home">← Weekendcheck</button><span class="stil">${esc(DEEL[S.deel])} · ${pos + 1} van ${lijst.length}</span></div>
    <div class="balk"><i style="width:${t.pct}%"></i></div>
    <div class="scherm">
      <section class="vlak">
        <div><span class="label ${esc(v.f)}">${esc(FASE[v.f] || v.f)}</span> <span class="stil klein">${esc(I.groep)}</span></div>
        <div class="code">${esc(titel)}</div>${I.naam ? `<div>${esc(I.naam)}</div>` : ''}
        <div class="vraag">${esc(I.q)}</div>
        <div class="voorstel"><span class="stil klein">${v.d === 'c' ? 'Voorstel' : 'Voorstel uit de data'}</span><b>${esc(I.vs !== '' ? I.vs : 'geen voorstel')}</b>${I.r ? `<span class="klein">${esc(I.r)}</span>` : ''}</div>
        ${a ? `<div class="stil klein">Eerder: ${esc({ klopt:'klopt', aangepast:'aangepast', twijfel:'twijfel', overslaan:'overgeslagen' }[a.a])}${a.w ? ' · ' + esc(a.w) : ''} (${esc(tijd24(a.t))})</div>` : ''}
        ${S.aanpas ? veldHtml(v, I) : `<div class="knoppen"><button class="k pri" data-wk="klopt" ${I.vs === '' && v.d !== 'c' ? 'disabled' : ''}>Klopt</button><button class="k" data-wk="aanpassen">Aanpassen</button><button class="k" data-wk="twijfel">Twijfel</button><button class="k" data-wk="overslaan">Overslaan</button></div>`}
        <div class="kopregel"><button class="terug" data-wk="vorige" ${pos > 0 ? '' : 'disabled'}>← Vorige</button><button class="terug" data-wk="verder">Volgende →</button></div>
      </section>
      <div style="display:grid;gap:1rem">
        <section class="vlak"><b>Feiten</b><ul class="feit">${(v.d === 'c' ? [I.ctrl, I.nu ? 'nu (live): ' + I.nu : '', I.wie ? 'wie: ' + I.wie : ''].concat(I.fe) : I.fe).filter(Boolean).map(f => `<li>${esc(f)}</li>`).join('')}</ul></section>
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
  let h;
  if(S.fout && !S.snap) h = `<div class="melding">${esc(S.fout.message || S.fout)}</div>`;
  else if(!S.snap) h = `<div class="stil">Weekendcheck laden…</div>`;
  else h = (S.fout ? `<div class="melding">${esc(S.fout.message)}</div>` : '') + (!S.deel ? start() : S.id ? vraagScherm() : klaarScherm());
  el.innerHTML = `<div class="wk" data-scherm="${!S.snap ? 'laden' : !S.deel ? 'start' : S.id ? 'vraag' : 'klaar'}">${h}</div>`;
}
function render(el, rest){
  stijl(); S.el = el;
  const d = String(rest || '').split('/')[0];
  if(d === 'c' || d === 'i'){ if(S.deel !== d){ S.deel = d; S.id = ''; } } else S.deel = '';
  if(!el.dataset.wk){ el.dataset.wk = '1'; }
  teken(); laad().then(() => { if(S.deel && !S.id && S.snap){ S.id = volgende('', S.deel); teken(); } });
  if(S.snap && S.deel && !S.id){ S.id = volgende('', S.deel); teken(); }
}
document.addEventListener('click', ev => {
  const k = ev.target.closest('.wk [data-wk]'); if(!k || !S.snap) return;
  const a = k.dataset.wk, v = S.id ? vind(S.id) : null;
  if(a === 'deel'){ location.hash = '#/weekendcheck/' + k.dataset.d; return; }
  if(a === 'home'){ location.hash = '#/weekendcheck'; return; }
  if(a === 'export'){ exporteer(); return; }
  if(a === 'kopieer'){ kopieer(); return; }
  if(!v) return;
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
    const waarde = v.t === 'getal' && v.v !== 'gewicht' ? String(Math.round(getal(w))) : w;   // nooit decimalen in aantallen
    beantwoord(v, waarde === I.vs ? 'klopt' : 'aangepast', v.v === 'gewicht' ? 'gewogen ' + waarde + ' kg' : waarde); return;
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
return { S, render, laad, exportData, samenvatting, platteTekst, SNAP_KEY, ANT_KEY };
})();
