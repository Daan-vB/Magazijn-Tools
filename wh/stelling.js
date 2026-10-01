/* =====================================================================
   IVOL Warehouse — Stellingen opmeten (1-10-2026)
   Eenmalig per gang: vrije hoogte per pickniveau, liggerbreedte, diepte.
   Afwijkende secties apart. Opslag: catalog 'wh-stellingen'. Export: Excel per locatie.
   Basis voor later: max op picklocatie per product (doosmaat × ruimte).
   ===================================================================== */
window.WHS = (function(){
'use strict';
const { D, esc, nf, num, toast, fdate } = WH;
const KEY = 'wh-stellingen';
const NIV_STD = [0, 2, 4, 6, 8];
const p2 = n => String(n).padStart(2, '0');
const app = () => document.getElementById('app');
let open = {};          // gang → welke afwijking-formulier open

function data(){ return D.STEL || {}; }

// pick-locaties per gang uit de locatie-export
function gangInfo(){
  const G = {};
  Object.values(D.LOC).forEach(L => {
    const i = WHL.locInfo(L.naam);
    if(!i.std) return;
    if(!(i.h < 10 || i.gang === 'AH')) return;
    const g = G[i.gang] = G[i.gang] || { gang:i.gang, hal:i.hal, secs:new Set(), niv:new Set(), plPerSec:{}, n:0, locs:[] };
    g.secs.add(i.sec); g.niv.add(i.h); g.n++;
    (g.plPerSec[i.sec] = g.plPerSec[i.sec] || new Set()).add(i.pl);
    g.locs.push(i);
  });
  Object.values(G).forEach(g => {
    const tel = {}; Object.values(g.plPerSec).forEach(s => tel[s.size] = (tel[s.size] || 0) + 1);
    g.plaatsen = +Object.entries(tel).sort((a, b) => b[1] - a[1])[0][0];
  });
  return G;
}
function niveausVan(g){ return g && g.niv.size ? [...g.niv].sort((a, b) => a - b) : NIV_STD; }
const secLijst = s => String(s || '').split(/[\s,;]+/).map(x => x.replace(/\D/g, '')).filter(Boolean).map(x => +x);

function status(gang){
  const s = data()[gang];
  if(!s) return ['niet gemeten', 'b-grey'];
  const leeg = Object.values(s.niveaus || {}).filter(v => !(v > 0)).length;
  if(!s.breedte || !s.diepte || leeg) return ['deels', 'b-warn'];
  return ['gemeten', 'b-ok'];
}

/* ---------- overzicht ---------- */
function view(gang){
  if(gang) return viewGang(gang);
  const G = gangInfo();
  const S = data();
  const gangen = [...new Set(Object.keys(G).concat(Object.keys(S)))].sort();
  const gemeten = gangen.filter(g => status(g)[0] === 'gemeten').length;
  const perHal = {};
  gangen.forEach(g => (perHal[g[0]] = perHal[g[0]] || []).push(g));
  app().innerHTML = `<div class="card"><h2>Stellingen opmeten</h2>
    <div class="small muted mt4">Eenmalig per gang: hoe hoog is elk pickniveau, hoe breed is de ligger en hoe diep. Daarmee rekent de app straks per product hoeveel er op de picklocatie passen (max op pick → vul aan tot).</div>
    <div class="ab-voortgang mt8"><b>${nf(gemeten)}</b> / ${nf(gangen.length)} gangen gemeten<div class="balk"><i style="width:${gangen.length ? Math.round(gemeten / gangen.length * 100) : 0}%"></i></div></div>
    ${!Object.keys(D.LOC).length ? '<div class="reason mt8">Nog geen locatie-export ingeladen: de app weet niet welke gangen en niveaus er zijn. Je kunt wel een gang typen.</div>' : ''}
    <div class="row wrap mt12"><input class="loc" id="s-nieuw" placeholder="gang, bv. AD" maxlength="2" style="width:110px"><button class="btn sm" data-s="ga">Open gang</button>
      <button class="btn sm pri" data-s="exp" ${Object.keys(S).length ? '' : 'disabled'}>Exporteer (Excel)</button></div>
    <div class="row wrap mt8"><input id="s-print-g" placeholder="gangen, bv. AD AE (leeg = alle nog niet gemeten)" style="flex:1;min-width:200px"><button class="btn sm" data-s="print">Print meetformulier</button></div>
    <div class="small muted mt4">Eén A4 per gang met tekening, vakjes om in te vullen en uitleg in NL/EN/ES/EL. Daarna typ je de getallen hier over.</div></div>
  ${Object.entries(perHal).map(([h, gs]) => `<div class="card"><h3>${esc(WHL.HAL_NAAM[h] || 'Hal ' + h)}</h3>
    <div class="s-gangen mt8">${gs.map(g => { const st = status(g); const gi = G[g]; return `<a class="s-gang" href="#/stelling/${g}"><b>${g}</b><span class="badge ${st[1]}">${st[0]}</span>${gi ? `<small>${gi.secs.size} secties · niv ${niveausVan(gi).map(p2).join(' ')}</small>` : ''}</a>`; }).join('')}</div></div>`).join('')}`;
}

/* ---------- één gang ---------- */
function velden(pref, waarde, niveaus){
  const v = waarde || {};
  return `<div class="s-velden">
    ${niveaus.slice().reverse().map(n => `<div class="fld"><label>Niveau ${p2(n)}${n === 0 ? ' (vloer)' : ''} · vrije hoogte cm</label><input inputmode="numeric" data-sf="${pref}h${n}" value="${esc((v.niveaus || {})[p2(n)] ?? '')}"></div>`).join('')}
    <div class="fld"><label>Liggerbreedte cm (binnenmaat)</label><input inputmode="numeric" data-sf="${pref}breedte" value="${esc(v.breedte ?? '')}"></div>
    <div class="fld"><label>Diepte cm</label><input inputmode="numeric" data-sf="${pref}diepte" value="${esc(v.diepte ?? '')}"></div>
    <div class="fld"><label>Plaatsen op een ligger</label><input inputmode="numeric" data-sf="${pref}plaatsen" value="${esc(v.plaatsen ?? '')}"></div>
    <div class="fld s-breed"><label>Notitie</label><input data-sf="${pref}notitie" value="${esc(v.notitie || '')}" placeholder="bv. sectie 12 heeft een tussenschot"></div>
  </div>`;
}
function perPlaats(v, plaatsen){
  const n = num(v && v.plaatsen) || plaatsen;
  return v && v.breedte && n ? `≈ ${nf(Math.floor(v.breedte / n))} cm breed per plaats (${n} plaatsen)` : '';
}
function viewGang(gang){
  gang = gang.toUpperCase();
  const G = gangInfo(); const g = G[gang];
  const s = data()[gang] || {};
  const niveaus = niveausVan(g);
  const pl = g ? g.plaatsen : 4;
  const afw = s.afwijk || {};
  app().innerHTML = `<a href="#/stelling" class="small">← Stellingen</a>
  <div class="card mt8"><div class="row wrap between"><h2>Gang ${esc(gang)}</h2><span class="badge ${status(gang)[1]}">${status(gang)[0]}</span></div>
    <div class="small muted mt4">${g ? `${g.secs.size} secties (${[...g.secs].sort((a, b) => a - b).map(p2).join(', ')}) · pickniveaus ${niveaus.map(p2).join(', ')} · meestal ${pl} plaatsen per ligger` : 'Gang niet in de locatie-export: standaard niveaus 00–08.'}${s.op ? ' · laatst opgeslagen ' + esc(fdate(s.op)) : ''}</div>
    <details class="mt8"><summary class="small">Hoe meten?</summary><ul class="small mt4">
      <li><b>Vrije hoogte</b>: van de vloer of de bovenkant van de ligger tot de onderkant van de ligger erboven. Niveau 08: tot de onderkant van de bulkligger (10).</li>
      <li><b>Liggerbreedte</b>: binnenmaat tussen de staanders.</li>
      <li><b>Diepte</b>: voorkant tot achterkant van het legbord.</li>
      <li><b>Plaatsen</b>: hoeveel picklocaties (A–D) er op één ligger zitten. Leeg = wat de locatie-export zegt (${pl}).</li></ul></details>
    <div class="mt12" data-sg="${esc(gang)}">${velden('', s, niveaus)}</div>
    <div class="small muted mt4" id="s-pp">${esc(perPlaats(s, pl))}</div>
    <div class="row wrap mt12"><button class="btn ok" data-s="opslaan" data-g="${esc(gang)}">Opslaan</button><button class="btn" data-s="print" data-g="${esc(gang)}">Print meetformulier</button></div></div>
  <div class="card"><h3>Afwijkende secties</h3><div class="small muted mt4">Alleen als een sectie anders is dan de rest van de gang (andere liggerhoogte, smaller, extra legbord).</div>
    ${Object.entries(afw).map(([k, v]) => `<div class="s-afw mt12"><div class="row between"><b>Sectie ${esc(secLijst(k).map(p2).join(', '))}</b><button class="btn ghost sm" data-s="afw-weg" data-g="${esc(gang)}" data-k="${esc(k)}">verwijder</button></div>
      <div data-sa="${esc(k)}">${velden('a', v, niveaus)}</div>
      <div class="row mt8"><button class="btn sm ok" data-s="afw-op" data-g="${esc(gang)}" data-k="${esc(k)}">Opslaan</button></div></div>`).join('')}
    ${open[gang] ? `<div class="s-afw mt12"><div class="fld"><label>Sectie(s)</label><input inputmode="numeric" id="s-afw-sec" placeholder="bv. 06 of 06, 07"></div>
      <div data-sa="__nieuw">${velden('a', null, niveaus)}</div>
      <div class="row mt8"><button class="btn sm ok" data-s="afw-op" data-g="${esc(gang)}" data-k="__nieuw">Opslaan</button></div></div>`
      : `<div class="row mt12"><button class="btn sm" data-s="afw-nieuw" data-g="${esc(gang)}">+ Afwijkende sectie</button></div>`}</div>`;
}

function lees(box, pref, niveaus){
  const val = f => { const el = box.querySelector(`[data-sf="${pref}${f}"]`); return el ? el.value.trim() : ''; };
  const getal = f => { const x = val(f); return x === '' ? null : num(x.replace(',', '.')); };
  const o = { niveaus:{} };
  niveaus.forEach(n => { o.niveaus[p2(n)] = getal('h' + n); });
  o.breedte = getal('breedte'); o.diepte = getal('diepte'); o.plaatsen = getal('plaatsen');
  o.notitie = val('notitie');
  return o;
}
async function bewaar(gang, nieuw){
  const d = await WH.catPatch(KEY, { [gang]:nieuw });
  D.STEL = d;
}

async function klik(e){
  const b = e.target.closest('[data-s]'); if(!b) return;
  const a = b.dataset.s, gang = b.dataset.g;
  const niveaus = gang ? niveausVan(gangInfo()[gang]) : NIV_STD;
  if(a === 'ga'){ const g = (document.getElementById('s-nieuw').value || '').trim().toUpperCase(); if(/^[A-Z]{2}$/.test(g)) location.hash = '#/stelling/' + g; else toast('Typ een gang van 2 letters, bv. AD'); return; }
  if(a === 'exp') return exporteer();
  if(a === 'print'){
    let lijst = gang ? [gang] : String((document.getElementById('s-print-g') || {}).value || '').toUpperCase().split(/[^A-Z]+/).filter(x => /^[A-Z]{2}$/.test(x));
    if(!lijst.length){ const G = gangInfo(); lijst = Object.keys(G).sort().filter(g => status(g)[0] !== 'gemeten'); }
    if(!lijst.length){ toast('Alle gangen zijn al gemeten'); return; }
    return printFormulier(lijst);
  }
  if(a === 'opslaan'){
    const box = document.querySelector(`[data-sg="${CSS.escape(gang)}"]`);
    const oud = data()[gang] || {};
    const n = Object.assign({}, oud, lees(box, '', niveaus), { op:new Date().toISOString() });
    try{ await bewaar(gang, n); toast('Gang ' + gang + ' opgeslagen'); WH.D.STEL = D.STEL; viewGang(gang); }catch(err){ /* melding al getoond */ }
    return;
  }
  if(a === 'afw-nieuw'){ open[gang] = true; viewGang(gang); return; }
  if(a === 'afw-op'){
    const k0 = b.dataset.k;
    const box = document.querySelector(`[data-sa="${CSS.escape(k0)}"]`);
    const k = k0 === '__nieuw' ? secLijst(document.getElementById('s-afw-sec').value).map(p2).join(',') : k0;
    if(!k){ toast('Vul de sectie in'); return; }
    const oud = Object.assign({}, data()[gang] || { niveaus:{} });
    oud.afwijk = Object.assign({}, oud.afwijk || {});
    if(k0 !== '__nieuw' && k0 !== k) delete oud.afwijk[k0];
    oud.afwijk[k] = lees(box, 'a', niveaus);
    oud.op = new Date().toISOString();
    try{ await bewaar(gang, oud); open[gang] = false; toast('Sectie ' + k + ' opgeslagen'); viewGang(gang); }catch(err){}
    return;
  }
  if(a === 'afw-weg'){
    if(!confirm('Afwijking sectie ' + b.dataset.k + ' verwijderen?')) return;
    const oud = Object.assign({}, data()[gang]); oud.afwijk = Object.assign({}, oud.afwijk || {}); delete oud.afwijk[b.dataset.k];
    try{ await bewaar(gang, oud); viewGang(gang); }catch(err){}
  }
}
function invoer(e){
  const box = e.target.closest('[data-sg]'); if(!box) return;
  const gang = box.dataset.sg; const g = gangInfo()[gang];
  const v = lees(box, '', niveausVan(g));
  const el = document.getElementById('s-pp'); if(el) el.textContent = perPlaats(v, g ? g.plaatsen : 4);
}

/* ---------- maat van één locatie (ook voor later: max op pick) ---------- */
function maatVan(naam){
  const i = WHL.locInfo(naam); if(!i.std) return null;
  const s = data()[i.gang]; if(!s) return null;
  let bron = s, waar = 'gang';
  Object.entries(s.afwijk || {}).forEach(([k, v]) => { if(secLijst(k).includes(i.sec)){ bron = v; waar = 'sectie ' + k; } });
  const g = gangInfo()[i.gang];
  const n = num(bron.plaatsen) || num(s.plaatsen) || (g && g.plaatsen) || null;
  const breedte = bron.breedte || s.breedte;
  return { hoogte:(bron.niveaus || {})[p2(i.h)] ?? (s.niveaus || {})[p2(i.h)] ?? null, breedte:breedte && n ? Math.floor(breedte / n) : null,
    diepte:bron.diepte || s.diepte || null, bron:waar, notitie:bron.notitie || s.notitie || '' };
}

/* ---------- meetformulier op papier ---------- */
const UITLEG = [
  ['NL', 'Meet in cm. <b>Vrije hoogte</b> = van de vloer of de bovenkant van de ligger tot de onderkant van de ligger erboven. <b>Breedte</b> = binnenmaat tussen de staanders. <b>Diepte</b> = voorkant tot achterkant. Is een sectie anders? Schrijf hem onderaan.'],
  ['EN', 'Measure in cm. <b>Free height</b> = from the floor or the top of the beam to the underside of the beam above. <b>Width</b> = inside measurement between the uprights. <b>Depth</b> = front to back. Is a section different? Write it at the bottom.'],
  ['ES', 'Mide en cm. <b>Altura libre</b> = desde el suelo o la parte de arriba del larguero hasta la parte de abajo del larguero de encima. <b>Ancho</b> = medida interior entre los bastidores. <b>Fondo</b> = de delante a atrás. ¿Una sección es diferente? Escríbela abajo.'],
  ['EL', 'Μέτρα σε cm. <b>Ελεύθερο ύψος</b> = από το πάτωμα ή το πάνω μέρος της δοκού μέχρι το κάτω μέρος της δοκού από πάνω. <b>Πλάτος</b> = εσωτερική απόσταση ανάμεσα στις κολόνες. <b>Βάθος</b> = από μπροστά μέχρι πίσω. Διαφέρει ένα τμήμα; Γράψ’ το κάτω.']
];
function tekening(niveaus){
  // vooraanzicht: staanders, liggers per niveau, pijl per vrije hoogte; plus bovenaanzicht voor de diepte
  const W = 360, H = 250, x0 = 70, x1 = 250, vloer = 225, top = 20;
  const lagen = niveaus.slice().sort((a, b) => a - b);
  const n = lagen.length, stap = (vloer - top) / (n + 0.4);
  const yL = i => vloer - i * stap;                 // onderkant van ligger i (i=0 = vloer)
  let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:380px" font-family="Arial" font-size="11">`;
  g += `<line x1="20" y1="${vloer}" x2="${x1 + 30}" y2="${vloer}" stroke="#000" stroke-width="2"/>`;
  g += `<rect x="${x0 - 8}" y="${top - 6}" width="8" height="${vloer - top + 6}" fill="#555"/><rect x="${x1}" y="${top - 6}" width="8" height="${vloer - top + 6}" fill="#555"/>`;
  lagen.forEach((lv, i) => {
    const onder = yL(i), boven = yL(i + 1);
    if(i > 0) g += `<rect x="${x0}" y="${onder}" width="${x1 - x0}" height="6" fill="#e07b00"/><text x="${x1 + 14}" y="${onder + 6}">${p2(lv)}</text>`;
    const a = i > 0 ? onder : onder, b = boven + 6;
    const xm = x0 + 30 + (i % 2) * 40;
    g += `<line x1="${xm}" y1="${a - 2}" x2="${xm}" y2="${b + 2}" stroke="#c00" stroke-width="1.5" marker-start="url(#pk)" marker-end="url(#pk)"/>`;
    g += `<text x="${xm + 6}" y="${(a + b) / 2 + 4}" fill="#c00" font-weight="bold">${p2(lv)}</text>`;
  });
  const yTop = yL(n);
  g += `<rect x="${x0}" y="${yTop}" width="${x1 - x0}" height="6" fill="#1a56c4"/><text x="${x1 + 14}" y="${yTop + 6}">10 bulk</text>`;
  g += `<text x="22" y="${vloer - 4}">00</text>`;
  g += `<line x1="${x0 + 2}" y1="${top}" x2="${x1 - 2}" y2="${top}" stroke="#06c" stroke-width="1.5" marker-start="url(#pb)" marker-end="url(#pb)"/><text x="${(x0 + x1) / 2 - 30}" y="${top - 4}" fill="#06c" font-weight="bold">breedte / width</text>`;
  g += `<defs><marker id="pk" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#c00"/></marker>
    <marker id="pb" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#06c"/></marker></defs></svg>`;
  return g;
}
function formulierGang(gang){
  const g = gangInfo()[gang], s = data()[gang] || {};
  const niveaus = niveausVan(g);
  const oud = v => v !== null && v !== undefined && v !== '' ? `<span class="s-oud">${esc(v)}</span>` : '';
  const vak = v => `<td class="s-vak">${oud(v)}</td>`;
  return `<section class="s-blad">
    <div class="pkop"><b>IVOL · Stelling meten · Gang ${esc(gang)}</b><span>${g ? 'secties ' + [...g.secs].sort((a, b) => a - b).map(p2).join(', ') + ' · ' : ''}pickniveaus ${niveaus.map(p2).join(', ')}</span></div>
    <div class="s-prij">
      <div class="s-pteken">${tekening(niveaus)}</div>
      <div class="s-puitleg">${UITLEG.map(([t, x]) => `<p><b>${t}</b> ${x}</p>`).join('')}</div>
    </div>
    <table class="s-ptab"><tr><th>Niveau / Level</th><th>Vrije hoogte / Free height (cm)</th></tr>
      ${niveaus.slice().reverse().map(n => `<tr><td><b>${p2(n)}</b>${n === 0 ? ' vloer / floor' : ''}${n === Math.max(...niveaus) ? ' (tot ligger 10)' : ''}</td>${vak((s.niveaus || {})[p2(n)])}</tr>`).join('')}
      <tr><td><b>Liggerbreedte</b> / width</td>${vak(s.breedte)}</tr>
      <tr><td><b>Diepte</b> / depth</td>${vak(s.diepte)}</tr>
      <tr><td><b>Plaatsen op een ligger</b> / places per beam (A–D)</td>${vak(s.plaatsen ?? (g ? g.plaatsen : ''))}</tr></table>
    <table class="s-ptab mt8"><tr><th style="width:18%">Afwijkende sectie / different section</th><th>Wat is anders + maten (cm) / what is different + sizes</th></tr>
      ${Object.entries(s.afwijk || {}).map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td><span class="s-oud">${esc(Object.entries(v.niveaus || {}).filter(x => x[1]).map(x => x[0] + ': ' + x[1]).join(' · ') + (v.breedte ? ' · breedte ' + v.breedte : '') + (v.diepte ? ' · diepte ' + v.diepte : '') + (v.notitie ? ' · ' + v.notitie : ''))}</span></td></tr>`).join('')}
      ${'<tr><td class="s-vak"></td><td class="s-vak"></td></tr>'.repeat(4)}</table>
    <div class="s-pvoet">Gemeten door / measured by: ______________________ &nbsp; Datum / date: ____________</div>
    ${Object.keys(s).length ? '<div class="s-pvoet">Grijs = staat al in de app: klopt het? Streep door en schrijf het juiste getal erbij.</div>' : ''}
  </section>`;
}
function printFormulier(gangen){
  let box = document.getElementById('s-print');
  if(!box){ box = document.createElement('div'); box.id = 's-print'; box.className = 'printonly'; document.getElementById('app').appendChild(box); }
  box.innerHTML = gangen.map(formulierGang).join('');
  document.body.classList.add('s-pr');
  const weg = () => { document.body.classList.remove('s-pr'); window.removeEventListener('afterprint', weg); };
  window.addEventListener('afterprint', weg);
  setTimeout(() => window.print(), 50);
}

function exporteer(){
  const S = data(); const G = gangInfo();
  const wb = XLSX.utils.book_new();
  const kopL = ['Locatie', 'Gang', 'Sectie', 'Plaats', 'Niveau', 'Vrije hoogte cm', 'Breedte plaats cm', 'Diepte cm', 'Bron', 'Producten', 'Notitie'];
  const rijL = [];
  Object.keys(S).sort().forEach(gang => {
    const g = G[gang]; if(!g) return;
    g.locs.slice().sort((x, y) => x.sec - y.sec || x.pl.localeCompare(y.pl) || x.h - y.h).forEach(i => {
      const m = maatVan(i.naam) || {};
      rijL.push([i.naam, i.gang, p2(i.sec), i.pl, p2(i.h), m.hoogte ?? '', m.breedte ?? '', m.diepte ?? '', m.bron || '', (D.LOC[i.naam] || {}).codes ? D.LOC[i.naam].codes.join(', ') : '', m.notitie || '']);
    });
  });
  const alleNiv = [...new Set(Object.values(S).flatMap(s => Object.keys(s.niveaus || {})))].sort();
  const kopG = ['Gang', 'Secties', 'Liggerbreedte cm', 'Diepte cm', 'Plaatsen per ligger'].concat(alleNiv.map(n => 'Niveau ' + n + ' cm'), ['Afwijkende secties', 'Notitie', 'Opgeslagen']);
  const rijG = Object.keys(S).sort().map(gang => { const s = S[gang], g = G[gang];
    return [gang, g ? g.secs.size : '', s.breedte ?? '', s.diepte ?? '', s.plaatsen ?? (g ? g.plaatsen : '')].concat(alleNiv.map(n => (s.niveaus || {})[n] ?? ''),
      [Object.entries(s.afwijk || {}).map(([k, v]) => 'sectie ' + k + ': ' + Object.entries(v.niveaus || {}).filter(x => x[1]).map(x => x[0] + '=' + x[1]).join(' ') + (v.breedte ? ' breedte ' + v.breedte : '') + (v.diepte ? ' diepte ' + v.diepte : '') + (v.notitie ? ' (' + v.notitie + ')' : '')).join(' | '), s.notitie || '', s.op ? s.op.slice(0, 10) : '']); });
  const w1 = XLSX.utils.aoa_to_sheet([kopG].concat(rijG)); w1['!cols'] = kopG.map(k => ({ wch:Math.max(10, k.length + 2) }));
  const w2 = XLSX.utils.aoa_to_sheet([kopL].concat(rijL)); w2['!cols'] = kopL.map(k => ({ wch:Math.max(10, k.length + 2) }));
  XLSX.utils.book_append_sheet(wb, w1, 'Gangen'); XLSX.utils.book_append_sheet(wb, w2, 'Picklocaties');
  const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const naam = 'Stellingen opgemeten ' + WH.vandaag() + '.xlsx';
  if(window.Bestanden) Bestanden.aanbieden(blob, naam, 'export', { titel:'Stellingen-export klaar' });
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = naam; a.click(); }
}

document.addEventListener('click', klik);
document.addEventListener('input', invoer);
return { view, maatVan, gangInfo, printFormulier };
})();
