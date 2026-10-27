/* =====================================================================
   IVOL Warehouse 3.0 — Kennisbank (15-10-2026, Claude)
   Daans eigen plek: 158 korte vragen, één per scherm, wanneer hij er ruimte voor heeft.
   Los van bouwplan, Te doen, Vandaag en kerncijfers: geen taak, geen deadline, geen melding.
   Vragen: wh/kennisbank-vragen.js (window.WHKB_DATA). Antwoorden en voorstellen NIET in de repo:
   catalog-rij wh-kennisbank = { antw:{ <id>:{ a, s:'ok'|'wie'|'later', wie, van, t, keuzes:[…] } }, voorstel:{ <id>:{ a, bron:'doc'|'gok' } } }
   keuzes = personen/keuzes van de knoppen (Gino, Karin, "ja, bewust"): een apart veld, nooit achter de antwoordtekst a geplakt.
   notitie + later = "Later / notitie" en het vinkje "ook later" (voor de IVOL-app van Ryan): los van de status, dus bevestigd én later kan samen.
   Reserve: localStorage 'ivol-kennisbank' (als de catalog niet bereikbaar is).
   Eigen antwoorden van Daan worden nooit stil overschreven (samenvoegen per vraag op tijd t).
   ===================================================================== */
window.WHKB = (function(){
'use strict';
const { $, esc } = WH;
const KEY = 'wh-kennisbank', LKEY = 'ivol-kennisbank';
const DATA = window.WHKB_DATA || { blokken:{}, mensen:[], vragen:[] };
const V = DATA.vragen;
const WIE = DATA.mensen.concat(['Elise', 'Jolijn'].filter(n => !DATA.mensen.includes(n)));
const S = { d:null, laden:null, i:null, blok:null, el:null, opslag:'', timer:null, fout:false, aangeraakt:false, kz:[], kzId:null };

/* ---------- staat ---------- */
const lsLees = () => { try{ return JSON.parse(localStorage.getItem(LKEY) || 'null'); }catch(e){ return null; } };
const lsZet = d => { try{ localStorage.setItem(LKEY, JSON.stringify(d)); }catch(e){} };
const leeg = () => ({ antw:{}, voorstel:{} });
// twee standen samenvoegen: per vraag wint het nieuwste antwoord; voorstellen alleen aanvullen
function voegSamen(a, b){
  const d = leeg();
  [a, b].forEach(x => {
    if(!x) return;
    Object.entries(x.antw || {}).forEach(([id, r]) => { if(r && (!d.antw[id] || (r.t || '') > (d.antw[id].t || ''))) d.antw[id] = r; });
    Object.entries(x.voorstel || {}).forEach(([id, r]) => { if(r && !d.voorstel[id]) d.voorstel[id] = r; });
  });
  return d;
}
function laad(){
  if(S.laden) return S.laden;
  S.d = voegSamen(lsLees(), null);
  S.laden = (async () => {
    try{ const r = await WH.catHaal(KEY); S.d = voegSamen((r && r.data) || null, S.d); S.fout = false; }
    catch(e){ S.fout = true; }
    lsZet(S.d); teller();
    if(!S.aangeraakt && !(($('kb-tekst') || {}).value)){ S.i = null; S.blok = null; S.kzId = null; herteken(); }   // online stand binnen: opnieuw naar de eerste open vraag
  })();
  return S.laden;
}

/* ---------- opslaan: 700 ms na de laatste wijziging ---------- */
function bewaar(){
  lsZet(S.d);
  S.opslag = 'Opslaan…'; zetOpslag();
  clearTimeout(S.timer);
  S.timer = setTimeout(async () => {
    try{
      const r = await WH.catHaal(KEY);
      S.d = voegSamen(S.d, (r && r.data) || null);   // ander apparaat tussendoor: niets kwijt
      await WH.catZet(KEY, S.d);
      lsZet(S.d); S.fout = false; S.opslag = 'Opgeslagen ✓';
    }catch(e){ S.fout = true; S.opslag = 'Op dit apparaat bewaard (online lukt nu niet)'; }
    zetOpslag();
  }, 700);
}
function zetOpslag(){ const s = $('kb-opslag'); if(s) s.textContent = S.opslag; }

/* ---------- tellers ---------- */
const antw = id => (S.d && S.d.antw[id]) || null;
const kzVan = a => Array.isArray(a && a.keuzes) ? a.keuzes.map(String) : [];
const zelfde = (x, y) => x.length === y.length && x.every((k, i) => k === y[i]);
const voorstel = id => (S.d && S.d.voorstel[id]) || null;
const ok = id => (antw(id) || {}).s === 'ok';
const nBevestigd = () => V.filter(v => ok(v.id)).length;
const nVoorstel = () => V.filter(v => !ok(v.id) && voorstel(v.id)).length;
function open(){ if(!S.d) laad(); return V.length - (S.d ? nBevestigd() : 0); }
function teller(){ const t = document.querySelector('[data-kbtel]'); if(t) t.textContent = open() + ' open'; }
const blokVan = id => id.charAt(0);
// eerst: nog nergens aangeraakt; daarna: alles wat niet bevestigd is
function volgendOpen(vanaf){
  const n = V.length;
  for(const f of [v => !antw(v.id), v => !ok(v.id)])
    for(let k = 1; k <= n; k++){ const j = (vanaf + k) % n; if(f(V[j])) return j; }
  return (vanaf + 1) % n;
}

/* ---------- stijl ---------- */
function stijl(){
  if($('kb-stijl')) return;
  const s = document.createElement('style'); s.id = 'kb-stijl';
  s.textContent = `
  .kb{max-width:680px;margin:0 auto;padding:14px 16px 80px;display:grid;gap:14px}
  .kb>*{min-width:0}
  .kb-balk{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px;font-weight:700}
  .kb-balk .muted{font-weight:600}
  .kb-vg{height:6px;background:#e3e8ee;border-radius:3px;overflow:hidden}.kb-vg i{display:block;height:100%;background:var(--ok)}
  .kb-kaart{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(15,23,32,.08);padding:16px;display:grid;gap:12px}
  .kb-kop{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted)}
  .kb-kop b{font-family:ui-monospace,Consolas,monospace;color:var(--ink);font-size:14px}
  .kb-st{font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:9px;background:#e9ecf0;color:#5b6673}
  .kb-st.ok{background:#dff3e8;color:var(--ok)} .kb-st.vs{background:#e3ecfb;color:var(--blauw)}
  .kb-vraag{font-size:19px;font-weight:800;line-height:1.3}
  .kb-hint{font-size:13.5px;color:var(--muted)}
  .kb-vs{background:#e8f0fd;border-left:5px solid var(--blauw);border-radius:8px;padding:10px 12px;display:grid;gap:4px;color:#123a7a}
  .kb-vs small{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--blauw)}
  .kb-vs p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:15.5px}
  .kb textarea{width:100%;min-height:96px;font:inherit;font-size:16px;padding:12px;border:1px solid var(--lijn);border-radius:10px;resize:none;overflow:hidden;background:#fff;color:var(--ink)}
  .kb textarea:focus{outline:3px solid #f08a4b;outline-offset:1px}
  .kb-chips{display:flex;flex-wrap:wrap;gap:8px}
  .kb-chips button,.kb-wie button{min-height:44px;padding:8px 14px;border-radius:22px;border:1px solid var(--lijn);background:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer;color:var(--ink)}
  .kb-chips button.aan{background:var(--ink);border-color:var(--ink);color:#fff}
  .kb-later{display:grid;gap:6px;background:var(--zacht);border-radius:10px;padding:10px}
  .kb-later textarea{min-height:60px;font-size:15px}
  .kb-vink{display:flex;gap:8px;align-items:center;font-size:14px;min-height:44px}
  .kb-vink input{width:22px;height:22px}
  .kb-knoppen{display:flex;flex-wrap:wrap;gap:8px}
  .kb-knoppen .knop{flex:1 1 auto}
  .kb-knop-ok{background:var(--blauw) !important;border-color:var(--blauw) !important;color:#fff !important}
  .kb-wie{display:flex;flex-wrap:wrap;gap:8px;padding:10px;background:var(--zacht);border-radius:10px}
  .kb-wie p{flex-basis:100%;font-size:13.5px;font-weight:700}
  .kb-nav{display:flex;justify-content:space-between;gap:8px;align-items:center}
  #kb-opslag{font-size:13px;color:var(--ok);font-weight:700;text-align:center;min-height:18px}
  .kb-blokken{display:flex;flex-wrap:wrap;gap:6px}
  .kb-blokken button{min-width:52px;min-height:44px;border:1px solid var(--lijn);background:#fff;border-radius:8px;font:inherit;font-size:13px;cursor:pointer;display:grid;line-height:1.15;padding:4px 6px;color:var(--ink)}
  .kb-blokken button b{font-size:15px}
  .kb-blokken button span{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
  .kb-blokken button.aan{background:var(--ink);color:#fff;border-color:var(--ink)} .kb-blokken button.aan span{color:#c4cfdd}
  .kb-blokken button.af{border-color:var(--ok)}
  ul.kb-lijst{list-style:none;display:grid}
  ul.kb-lijst button{all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:grid;grid-template-columns:44px 1fr auto;gap:8px;align-items:center;padding:9px 4px;border-bottom:1px solid #eef1f5;min-height:44px;font-size:14px}
  ul.kb-lijst button:focus-visible{outline:3px solid #f08a4b}
  ul.kb-lijst li.nu button{background:#fff3ea}
  ul.kb-lijst .id{font-family:ui-monospace,Consolas,monospace;font-weight:800;font-size:13px}
  ul.kb-lijst .vr{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .kb-imp{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .kb-imp label.knop input{display:none}
  `;
  document.head.appendChild(s);
}

/* ---------- scherm ---------- */
function status(id){
  const a = antw(id), v = voorstel(id);
  if(a && a.s === 'ok') return ['bevestigd', 'ok'];
  if(a && a.s === 'wie') return ['weet ' + (a.wie || 'iemand anders'), ''];
  if(a && a.s === 'later') return ['later', ''];
  if(v) return ['voorstel', 'vs'];
  return ['open', ''];
}
function view(){
  if(!V.length) return '<div class="kb"><p class="leeg">Geen vragen gevonden.</p></div>';
  if(S.i === null) S.i = antw(V[0].id) ? volgendOpen(-1) : 0;
  const v = V[S.i], a = antw(v.id), vs = voorstel(v.id);
  const bl = blokVan(v.id);
  if(S.blok === null) S.blok = bl;
  const [stT, stK] = status(v.id);
  const tekst = a && a.a ? a.a : '';
  const nB = nBevestigd();
  const toonVs = vs && !(a && a.s === 'ok');
  const vraagteken = vs && /^\s*\?/.test(vs.a || '');
  if(S.kzId !== v.id){ S.kzId = v.id; S.kz = kzVan(a); }   // de gekozen knoppen horen bij het antwoord, niet bij de tekst
  const gekozen = S.kz;
  const blokken = Object.keys(DATA.blokken);
  const inBlok = V.map((x, j) => [x, j]).filter(([x]) => blokVan(x.id) === S.blok);
  return `<div class="kb">
    <div class="kb-balk"><span>${nB} / ${V.length} bevestigd · ${nVoorstel()} voorstellen</span><span class="muted">Kennisbank</span></div>
    <div class="kb-vg"><i style="width:${(nB / V.length * 100).toFixed(1)}%"></i></div>
    <section class="kb-kaart">
      <div class="kb-kop"><b>${esc(v.id)}</b><span>${esc(DATA.blokken[bl] || '')}</span><span class="kb-st ${stK}">${esc(stT)}</span><span style="margin-left:auto">${S.i + 1} / ${V.length}</span></div>
      <div class="kb-vraag">${esc(v.vraag)}</div>
      ${v.hint ? `<div class="kb-hint">${esc(v.hint)}</div>` : ''}
      ${toonVs ? `<div class="kb-vs"><small>Voorstel van Claude · ${vs.bron === 'doc' ? 'uit je documenten' : 'gegokt'}</small><p>${esc(vs.a)}</p></div>` : ''}
      ${v.keuzes.length ? `<div class="kb-chips">${v.keuzes.map((k, n) => `<button data-kb="chip" data-n="${n}" class="${gekozen.includes(k) ? 'aan' : ''}">${esc(k)}</button>`).join('')}</div>` : ''}
      <textarea id="kb-tekst" rows="3" placeholder="${toonVs ? (vraagteken ? 'Typ je antwoord' : 'Klopt? Enter. Anders: typ je eigen antwoord') : 'Typ je antwoord'}" enterkeyhint="next">${esc(tekst)}</textarea>
      <div class="kb-later"><label for="kb-notitie"><b>Later / notitie</b> <span class="kb-hint">komt niet in het antwoord</span></label><textarea id="kb-notitie" rows="2" placeholder="Bijv. later in de IVOL-app van Ryan">${esc(a && a.notitie ? a.notitie : '')}</textarea>
        <label class="kb-vink"><input type="checkbox" id="kb-later" ${a && a.later ? 'checked' : ''}> ook later (komt op de lijst Voor de IVOL-app van Ryan)</label></div>
      <div class="kb-knoppen">
        ${toonVs && !vraagteken ? `<button class="knop kb-knop-ok" data-kb="klopt">Klopt →</button><button class="knop" data-kb="aanpassen">Aanpassen</button>` : ''}
        <button class="knop pri" data-kb="opslaan">Opslaan →</button>
        <button class="knop" data-kb="weetniet">Weet ik niet</button>
        <button class="knop" data-kb="later">Later</button>
      </div>
      <div class="kb-wie" id="kb-wie" hidden><p>Wie weet het?</p>${WIE.map(n => `<button data-kb="wie" data-wie="${esc(n)}" class="${a && a.s === 'wie' && a.wie === n ? 'aan' : ''}">${esc(n)}</button>`).join('')}</div>
      <div class="kb-nav"><button class="knop" data-kb="vorige">← Vorige</button><span id="kb-opslag">${esc(S.opslag)}</span><button class="knop" data-kb="volgende">Volgende →</button></div>
    </section>
    <section class="kb-kaart">
      <div class="kb-blokken">${blokken.map(b => { const xs = V.filter(x => blokVan(x.id) === b), n = xs.filter(x => ok(x.id)).length;
        return `<button data-kb="blok" data-b="${b}" class="${b === S.blok ? 'aan' : ''} ${n === xs.length ? 'af' : ''}" title="${esc(DATA.blokken[b])}"><b>${b}</b><span>${n}/${xs.length}</span></button>`; }).join('')}</div>
      <b>${esc(S.blok)} · ${esc(DATA.blokken[S.blok] || '')}</b>
      <ul class="kb-lijst">${inBlok.map(([x, j]) => { const [t, k] = status(x.id);
        return `<li class="${j === S.i ? 'nu' : ''}"><button data-kb="ga" data-i="${j}"><span class="id">${esc(x.id)}</span><span class="vr">${esc(x.vraag)}</span><span class="kb-st ${k}">${esc(t)}</span></button></li>`; }).join('')}</ul>
      <div class="kb-imp">
        <button class="knop" data-kb="kopieer">Kopieer alle antwoorden</button>
        <label class="knop">Voorstellen laden<input type="file" id="kb-bestand" accept="application/json,.json"></label>
      </div>
      <p class="klein muted">Voorstellen laden: kies <code>kennisbank-voorstellen.json</code>. Je eigen antwoorden blijven altijd staan.</p>
    </section>
  </div>`;
}
function herteken(){
  if(!S.el || !S.el.isConnected || !$('kb-root')) return;
  S.el.querySelector('#kb-root').innerHTML = view();
  const ta = $('kb-tekst');
  if(ta){ groei(ta); try{ if(window.matchMedia('(pointer:fine)').matches) ta.focus({ preventScroll:true }); }catch(e){} }
  zetOpslag();
}
function render(el){
  stijl();
  S.el = el;
  el.innerHTML = '<div id="kb-root"></div>';
  if(!S.d) laad();
  S.i = null; S.blok = null; S.aangeraakt = false; S.kzId = null;   // altijd verder waar Daan stopte: eerste open vraag
  herteken();
  if(!el.dataset.kb){ el.dataset.kb = '1'; koppel(el); }
}
const groei = ta => { ta.style.height = 'auto'; ta.style.height = Math.max(96, ta.scrollHeight + 2) + 'px'; };

/* ---------- acties ---------- */
const nu = () => new Date().toISOString();
function zet(id, r){ S.d.antw[id] = Object.assign({ a:'', s:'ok', wie:'', van:'', keuzes:[], notitie:'', later:false, t:nu() }, r); bewaar(); teller(); }
// notitie en vinkje komen uit de velden op het scherm; zonder scherm blijft wat er al stond
const laterVelden = () => ({ notitie:(($('kb-notitie') || {}).value || '').trim(), later:!!(($('kb-later') || {}).checked) });
function ga(i){ S.aangeraakt = true; S.i = (i + V.length) % V.length; S.blok = blokVan(V[S.i].id); herteken(); const k = S.el && S.el.querySelector('.kb'); if(k && k.scrollIntoView) S.el.scrollTop = 0; }
function opslaan(){
  const v = V[S.i], vs = voorstel(v.id), a = antw(v.id);
  const t = ($('kb-tekst').value || '').trim(), kzs = S.kz.slice(), lv = laterVelden();
  if(!t && !kzs.length && (lv.notitie || lv.later)){ zet(v.id, Object.assign({ a:'', s:(a && a.s === 'ok') ? 'ok' : 'later', keuzes:[], van:(a && a.van) || '' }, lv)); ga(volgendOpen(S.i)); return; }   // alleen een notitie of vinkje: geen bevestigd antwoord
  if(!t && !kzs.length){
    if(vs && !(a && a.s === 'ok')){
      if(/^\s*\?/.test(vs.a || '')){ $('kb-tekst').focus(); return; }   // voorstel met "?": eerst zelf antwoorden
      zet(v.id, { a:vs.a, van:'claude-bevestigd' });
    }
    ga(volgendOpen(S.i)); return;
  }
  if(!(a && a.s === 'ok' && a.a === t && zelfde(kzVan(a), kzs) && (a.notitie || '') === lv.notitie && !!a.later === lv.later)) zet(v.id, { a:t, keuzes:kzs, notitie:lv.notitie, later:lv.later, van:vs ? (t && t === String(vs.a).trim() && !kzs.length ? 'claude-bevestigd' : 'claude-aangepast') : (a && a.van) || '' });
  ga(volgendOpen(S.i));
}
function klopt(){ const v = V[S.i], vs = voorstel(v.id); if(!vs || /^\s*\?/.test(vs.a || '')) return; zet(v.id, { a:vs.a, van:'claude-bevestigd' }); ga(volgendOpen(S.i)); }
// een knop zet alleen de keuze aan of uit in het aparte veld keuzes; de antwoordtekst blijft zoals hij is
function chip(n){
  const v = V[S.i], k = v.keuzes[n]; if(!$('kb-tekst')) return;
  if(v.soort === '1') S.kz = S.kz.includes(k) ? [] : [k];
  else { const j = S.kz.findIndex(x => x.toLowerCase() === k.toLowerCase()); if(j >= 0) S.kz.splice(j, 1); else S.kz.push(k); }
  S.el.querySelectorAll('[data-kb="chip"]').forEach(b => b.classList.toggle('aan', S.kz.includes(v.keuzes[+b.dataset.n])));
}
function nietWeten(){ const w = $('kb-wie'); if(w) w.hidden = !w.hidden; }
function wie(naam){ const v = V[S.i], a = antw(v.id) || {}; zet(v.id, { a:($('kb-tekst').value || '').trim() || (a.s !== 'ok' ? a.a || '' : ''), s:'wie', wie:naam, van:a.van || '', keuzes:S.kz.slice(), ...laterVelden() }); ga(volgendOpen(S.i)); }
function later(){ const v = V[S.i], a = antw(v.id) || {}; zet(v.id, { a:($('kb-tekst').value || '').trim() || a.a || '', s:'later', van:a.van || '', keuzes:S.kz.slice(), ...laterVelden(), later:true }); ga(volgendOpen(S.i)); }

// antwoordtekst en personen/keuzes blijven gescheiden, ook in de export
const antwTekst = a => (a.a || '') + (kzVan(a).length ? (a.a ? ' | ' : '') + 'personen/keuzes: ' + kzVan(a).join(', ') : '') + (a.notitie ? ' | later/notitie: ' + a.notitie : '') + (a.later ? ' | ook later' : '');
function alsTekst(){
  const regels = [];
  Object.keys(DATA.blokken).forEach(b => {
    regels.push('', '## ' + b + ' · ' + DATA.blokken[b]);
    V.filter(x => blokVan(x.id) === b).forEach(x => {
      const a = antw(x.id), vs = voorstel(x.id);
      let r = '';
      if(a && a.s === 'ok') r = antwTekst(a) + (a.van === 'claude-bevestigd' ? ' (voorstel Claude, klopt)' : a.van === 'claude-aangepast' ? ' (voorstel Claude, aangepast)' : '');
      else if(a && a.s === 'wie') r = '[weet ik niet: ' + (a.wie || '?') + ']' + (antwTekst(a) ? ' ' + antwTekst(a) : '');
      else if(a && a.s === 'later') r = '[later]' + (antwTekst(a) ? ' ' + antwTekst(a) : '');
      else r = vs ? '[open, voorstel: ' + vs.a + ']' : '[open]';
      regels.push(x.id + ' ' + x.vraag + '\n→ ' + r);
    });
  });
  return 'Kennisbank IVOL Warehouse · ' + nBevestigd() + ' / ' + V.length + ' bevestigd · ' + new Date().toLocaleString('nl-NL', { hour12:false }) + '\n' + regels.join('\n');
}
async function kopieer(){
  const t = alsTekst();
  try{ await navigator.clipboard.writeText(t); WH.toast('Alle antwoorden gekopieerd'); return; }catch(e){}
  const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length);
  let gelukt = false; try{ gelukt = document.execCommand('copy'); }catch(e){}
  ta.remove();
  WH.toast(gelukt ? 'Alle antwoorden gekopieerd' : 'Kopiëren lukt niet op dit apparaat');
}

// kennisbank-voorstellen.json: { voorstellen, antwoorden }. Eigen antwoorden blijven; alleen ontbrekende ids worden gevuld.
function lijstVan(x){
  if(!x) return [];
  if(Array.isArray(x)) return x.filter(r => r && r.id).map(r => [String(r.id), r]);
  return Object.entries(x);
}
function inlezen(j){
  const ids = new Set(V.map(v => v.id));
  let nV = 0, nA = 0, nOver = 0;
  lijstVan(j.antwoorden).forEach(([id, r]) => {
    if(!ids.has(id)) return;
    if(antw(id)){ nOver++; return; }
    const o = typeof r === 'string' ? { a:r } : r;
    const s = ['ok', 'wie', 'later'].includes(o.s) ? o.s : 'ok';
    const a = String(o.a ?? o.antwoord ?? '').trim(), keuzes = Array.isArray(o.keuzes) ? o.keuzes.map(String) : []; if(!a && s === 'ok' && !keuzes.length) return;
    S.d.antw[id] = { a, s, wie:o.wie || '', van:['claude-bevestigd', 'claude-aangepast'].includes(o.van) ? o.van : '', keuzes, notitie:String(o.notitie || ''), later:!!o.later, t:o.t || nu() };
    nA++;
  });
  lijstVan(j.voorstellen).forEach(([id, r]) => {
    if(!ids.has(id) || ok(id)) return;
    const o = typeof r === 'string' ? { a:r } : r;
    const a = String(o.a ?? o.voorstel ?? '').trim(); if(!a) return;
    S.d.voorstel[id] = { a, bron:o.bron === 'doc' ? 'doc' : 'gok' };
    nV++;
  });
  bewaar(); teller();
  S.i = null; S.blok = null; herteken();
  WH.toast(nV + ' voorstellen en ' + nA + ' antwoorden geladen' + (nOver ? ' · ' + nOver + ' eigen antwoorden bleven staan' : ''), 4000);
}
function bestand(f){
  if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    let j = null; try{ j = JSON.parse(r.result); }catch(e){}
    if(!j || typeof j !== 'object' || (!j.voorstellen && !j.antwoorden)){ WH.toast('Dit bestand kan ik niet lezen (verwacht: voorstellen, antwoorden)', 4000); return; }
    laad().then(() => inlezen(j));
  };
  r.readAsText(f);
}

function koppel(el){
  el.addEventListener('click', ev => {
    const k = ev.target.closest('[data-kb]'); if(!k || !$('kb-root') || !S.d) return;
    const a = k.dataset.kb;
    if(a === 'opslaan') opslaan();
    else if(a === 'klopt') klopt();
    else if(a === 'aanpassen'){ const ta = $('kb-tekst'), vs = voorstel(V[S.i].id); if(vs){ ta.value = vs.a; groei(ta); ta.focus(); } }
    else if(a === 'chip') chip(+k.dataset.n);
    else if(a === 'weetniet') nietWeten();
    else if(a === 'wie') wie(k.dataset.wie);
    else if(a === 'later') later();
    else if(a === 'vorige') ga(S.i - 1);
    else if(a === 'volgende') ga(S.i + 1);
    else if(a === 'blok'){ S.aangeraakt = true; S.blok = k.dataset.b; herteken(); }
    else if(a === 'ga') ga(+k.dataset.i);
    else if(a === 'kopieer') kopieer();
  });
  el.addEventListener('keydown', ev => {
    if(ev.target.id !== 'kb-tekst' || ev.key !== 'Enter' || ev.shiftKey || ev.isComposing) return;
    ev.preventDefault(); opslaan();
  });
  el.addEventListener('input', ev => {
    if(ev.target.id !== 'kb-tekst') return;
    groei(ev.target);
  });
  el.addEventListener('change', ev => { if(ev.target.id === 'kb-bestand'){ bestand(ev.target.files[0]); ev.target.value = ''; } });
}

/* ---------- Voor de IVOL-app van Ryan: alle antwoorden met "ook later" ---------- */
function ryanItems(){ return V.filter(v => { const a = antw(v.id); return a && (a.later || a.s === 'later'); }); }
function ryanTekst(){
  return 'Voor de IVOL-app van Ryan · ' + ryanItems().length + ' onderwerpen · ' + new Date().toLocaleString('nl-NL', { hour12:false }) + '\n' +
    ryanItems().map(v => { const a = antw(v.id); return v.id + ' ' + v.vraag + '\n→ ' + (antwTekst(a).replace(/ \| ook later$/, '') || '(geen antwoord)'); }).join('\n');
}
function renderRyan(el){
  stijl();
  el.innerHTML = '<div id="kb-ryan" class="kb"><p class="leeg">Laden…</p></div>';
  laad().then(() => {
    const L = ryanItems();
    el.querySelector('#kb-ryan').innerHTML = `<div class="kb-balk"><span>Voor de IVOL-app van Ryan · ${L.length} onderwerpen</span><button class="knop" data-ry="kopieer">Kopieer lijst</button></div>
      <p class="klein muted">Alle antwoorden waar "ook later" aanstaat, met je notitie. Aanvinken doe je bij de vraag in de Kennisbank.</p>
      ${L.map(v => { const a = antw(v.id), kz = kzVan(a);
        return `<section class="kb-kaart"><div class="kb-kop"><b>${esc(v.id)}</b><span>${esc(DATA.blokken[blokVan(v.id)] || '')}</span><span class="kb-st ${a.s === 'ok' ? 'ok' : ''}">${a.s === 'ok' ? 'bevestigd' : esc(status(v.id)[0])}</span></div>
          <div class="kb-vraag" style="font-size:16px">${esc(v.vraag)}</div>
          ${a.a || kz.length ? `<p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(a.a || '')}${kz.length ? `<span class="muted">${a.a ? ' · ' : ''}${esc(kz.join(', '))}</span>` : ''}</p>` : ''}
          ${a.notitie ? `<div class="kb-vs"><small>Later / notitie</small><p>${esc(a.notitie)}</p></div>` : ''}</section>`; }).join('') || '<div class="kb-kaart"><p>Nog niets met "ook later".</p></div>'}`;
    const k = el.querySelector('[data-ry="kopieer"]');
    if(k) k.onclick = async () => { try{ await navigator.clipboard.writeText(ryanTekst()); WH.toast('Lijst gekopieerd'); }catch(e){ WH.toast('Kopiëren lukt niet op dit apparaat'); } };
  });
}
return { render, renderRyan, ryanItems, open, laad, S };
})();
