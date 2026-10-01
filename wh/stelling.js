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
    const g = G[i.gang] = G[i.gang] || { gang:i.gang, hal:i.hal, secs:new Set(), niv:new Set(), bniv:new Set(), plPerSec:{}, bplPerSec:{}, n:0, locs:[] };
    const pick = i.h < 10 || i.gang === 'AH';
    g.secs.add(i.sec); g.n++; g.locs.push(i);
    if(pick){ g.niv.add(i.h); (g.plPerSec[i.sec] = g.plPerSec[i.sec] || new Set()).add(i.pl); }
    else { g.bniv.add(i.h); (g.bplPerSec[i.sec] = g.bplPerSec[i.sec] || new Set()).add(i.pl); }
  });
  const meest = per => { const tel = {}; Object.values(per).forEach(s => tel[s.size] = (tel[s.size] || 0) + 1); const e = Object.entries(tel).sort((a, b) => b[1] - a[1])[0]; return e ? +e[0] : null; };
  Object.values(G).forEach(g => { g.plaatsen = meest(g.plPerSec); g.bplaatsen = meest(g.bplPerSec); });
  return G;
}
function niveausVan(g){ return g && g.niv.size ? [...g.niv].sort((a, b) => a - b) : g && g.bniv.size ? [] : NIV_STD; }
function bulkVan(g){ return g && g.bniv.size ? [...g.bniv].sort((a, b) => a - b) : g && g.niv.size ? [] : [10, 20]; }
const alleNivVan = g => niveausVan(g).concat(bulkVan(g));
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
    <div class="s-gangen mt8">${gs.map(g => { const st = status(g); const gi = G[g]; return `<a class="s-gang" href="#/stelling/${g}"><b>${g}</b><span class="badge ${st[1]}">${st[0]}</span>${gi ? `<small>${gi.secs.size} secties · pick ${niveausVan(gi).map(p2).join(' ') || '–'} · bulk ${bulkVan(gi).map(p2).join(' ') || '–'}</small>` : ''}</a>`; }).join('')}</div></div>`).join('')}`;
}

/* ---------- één gang ---------- */
function velden(pref, waarde, niveaus, bulk){
  const v = waarde || {};
  const veld = (n, label) => `<div class="fld"><label>${label}</label><input inputmode="numeric" data-sf="${pref}h${n}" value="${esc((v.niveaus || {})[p2(n)] ?? '')}"></div>`;
  const topB = Math.max(...bulk);
  return `${bulk.length ? `<div class="s-groep">Bulk (pallets)</div><div class="s-velden">
    ${bulk.slice().reverse().map(n => veld(n, `Bulk ${p2(n)} · vrije hoogte cm${n === topB ? ' (tot bovenkant)' : ''}`)).join('')}
    <div class="fld"><label>Palletplaatsen op een ligger</label><input inputmode="numeric" data-sf="${pref}palletplaatsen" value="${esc(v.palletplaatsen ?? '')}"></div></div>` : ''}
  ${niveaus.length ? `<div class="s-groep">Pick</div><div class="s-velden">
    ${niveaus.slice().reverse().map(n => veld(n, `Niveau ${p2(n)}${n === 0 ? ' (vloer)' : ''} · vrije hoogte cm`)).join('')}
    <div class="fld"><label>Pickplaatsen op een ligger</label><input inputmode="numeric" data-sf="${pref}plaatsen" value="${esc(v.plaatsen ?? '')}"></div></div>` : ''}
  <div class="s-groep">Stelling</div><div class="s-velden">
    <div class="fld"><label>Liggerbreedte cm (binnenmaat)</label><input inputmode="numeric" data-sf="${pref}breedte" value="${esc(v.breedte ?? '')}"></div>
    <div class="fld"><label>Diepte cm</label><input inputmode="numeric" data-sf="${pref}diepte" value="${esc(v.diepte ?? '')}"></div>
    <div class="fld s-breed"><label>Notitie</label><input data-sf="${pref}notitie" value="${esc(v.notitie || '')}" placeholder="bv. sectie 12 heeft een tussenschot"></div>
  </div>`;
}
function perPlaats(v, plaatsen, bplaatsen){
  if(!v || !v.breedte) return '';
  const n = num(v.plaatsen) || plaatsen, b = num(v.palletplaatsen) || bplaatsen;
  return [n ? `pick ≈ ${nf(Math.floor(v.breedte / n))} cm per plaats (${n})` : '', b ? `bulk ≈ ${nf(Math.floor(v.breedte / b))} cm per palletplaats (${b})` : ''].filter(Boolean).join(' · ');
}
function viewGang(gang){
  gang = gang.toUpperCase();
  const G = gangInfo(); const g = G[gang];
  const s = data()[gang] || {};
  const niveaus = niveausVan(g), bulk = bulkVan(g);
  const pl = (g && g.plaatsen) || 4, bpl = (g && g.bplaatsen) || null;
  const afw = s.afwijk || {};
  app().innerHTML = `<a href="#/stelling" class="small">← Stellingen</a>
  <div class="card mt8"><div class="row wrap between"><h2>Gang ${esc(gang)}</h2><span class="badge ${status(gang)[1]}">${status(gang)[0]}</span></div>
    <div class="small muted mt4">${g ? `${g.secs.size} secties (${[...g.secs].sort((a, b) => a - b).map(p2).join(', ')}) · pick ${niveaus.map(p2).join(', ') || '–'} · bulk ${bulk.map(p2).join(', ') || '–'} · locatie-export: ${pl} pickplaatsen${bpl ? ', ' + bpl + ' bulkplaatsen' : ''} per ligger` : 'Gang niet in de locatie-export: standaard pick 00–08 en bulk 10, 20.'}${s.op ? ' · laatst opgeslagen ' + esc(fdate(s.op)) : ''}</div>
    <details class="mt8"><summary class="small">Hoe meten?</summary><ul class="small mt4">
      <li><b>Vrije hoogte</b>: van de vloer of de bovenkant van de ligger tot de onderkant van de ligger erboven. Bovenste pickniveau: tot de onderkant van de eerste bulkligger.</li>
      <li><b>Bulk</b>: van de bovenkant van de ligger tot de onderkant van de ligger erboven. Bovenste bulkniveau: tot de bovenkant van de stelling (of sprinkler/plafond als dat lager is). <b>Palletplaatsen</b> = hoeveel pallets er naast elkaar op één ligger passen.</li>
      <li><b>Liggerbreedte</b>: binnenmaat tussen de staanders.</li>
      <li><b>Diepte</b>: voorkant tot achterkant van het legbord.</li>
      <li><b>Pickplaatsen</b>: hoeveel picklocaties (A–D) er op één ligger zitten. Leeg = wat de locatie-export zegt (${pl}).</li></ul></details>
    <div class="mt12" data-sg="${esc(gang)}">${velden('', s, niveaus, bulk)}</div>
    <div class="small muted mt4" id="s-pp">${esc(perPlaats(s, pl, bpl))}</div>
    <div class="row wrap mt12"><button class="btn ok" data-s="opslaan" data-g="${esc(gang)}">Opslaan</button><button class="btn" data-s="print" data-g="${esc(gang)}">Print meetformulier</button></div></div>
  <div class="card"><h3>Afwijkende secties</h3><div class="small muted mt4">Alleen als een sectie anders is dan de rest van de gang (andere liggerhoogte, smaller, extra legbord).</div>
    ${Object.entries(afw).map(([k, v]) => `<div class="s-afw mt12"><div class="row between"><b>Sectie ${esc(secLijst(k).map(p2).join(', '))}</b><button class="btn ghost sm" data-s="afw-weg" data-g="${esc(gang)}" data-k="${esc(k)}">verwijder</button></div>
      <div data-sa="${esc(k)}">${velden('a', v, niveaus, bulk)}</div>
      <div class="row mt8"><button class="btn sm ok" data-s="afw-op" data-g="${esc(gang)}" data-k="${esc(k)}">Opslaan</button></div></div>`).join('')}
    ${open[gang] ? `<div class="s-afw mt12"><div class="fld"><label>Sectie(s)</label><input inputmode="numeric" id="s-afw-sec" placeholder="bv. 06 of 06, 07"></div>
      <div data-sa="__nieuw">${velden('a', null, niveaus, bulk)}</div>
      <div class="row mt8"><button class="btn sm ok" data-s="afw-op" data-g="${esc(gang)}" data-k="__nieuw">Opslaan</button></div></div>`
      : `<div class="row mt12"><button class="btn sm" data-s="afw-nieuw" data-g="${esc(gang)}">+ Afwijkende sectie</button></div>`}</div>`;
}

function lees(box, pref, niveaus){
  const val = f => { const el = box.querySelector(`[data-sf="${pref}${f}"]`); return el ? el.value.trim() : ''; };
  const getal = f => { const x = val(f); return x === '' ? null : num(x.replace(',', '.')); };
  const o = { niveaus:{} };
  niveaus.forEach(n => { o.niveaus[p2(n)] = getal('h' + n); });
  o.breedte = getal('breedte'); o.diepte = getal('diepte'); o.plaatsen = getal('plaatsen'); o.palletplaatsen = getal('palletplaatsen');
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
  const niveaus = gang ? alleNivVan(gangInfo()[gang]) : NIV_STD;
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
  const v = lees(box, '', alleNivVan(g));
  const el = document.getElementById('s-pp'); if(el) el.textContent = perPlaats(v, (g && g.plaatsen) || 4, g && g.bplaatsen);
}

/* ---------- maat van één locatie (ook voor later: max op pick) ---------- */
function maatVan(naam){
  const i = WHL.locInfo(naam); if(!i.std) return null;
  const s = data()[i.gang]; if(!s) return null;
  let bron = s, waar = 'gang';
  Object.entries(s.afwijk || {}).forEach(([k, v]) => { if(secLijst(k).includes(i.sec)){ bron = v; waar = 'sectie ' + k; } });
  const g = gangInfo()[i.gang];
  const bulkLoc = !(i.h < 10 || i.gang === 'AH');
  const n = bulkLoc ? (num(bron.palletplaatsen) || num(s.palletplaatsen) || (g && g.bplaatsen) || null) : (num(bron.plaatsen) || num(s.plaatsen) || (g && g.plaatsen) || null);
  const breedte = bron.breedte || s.breedte;
  return { hoogte:(bron.niveaus || {})[p2(i.h)] ?? (s.niveaus || {})[p2(i.h)] ?? null, breedte:breedte && n ? Math.floor(breedte / n) : null,
    diepte:bron.diepte || s.diepte || null, bron:waar, notitie:bron.notitie || s.notitie || '', soort:bulkLoc ? 'bulk' : 'pick' };
}

/* ---------- meetformulier op papier ---------- */
const UITLEG = [
  ['NL', 'Meet in cm. <b>Vrije hoogte</b> = van de vloer of de bovenkant van de ligger tot de onderkant van de ligger erboven. <b>Breedte</b> = binnenmaat tussen de staanders. <b>Diepte</b> = voorkant tot achterkant. Bovenste bulkniveau: tot de bovenkant van de stelling. <b>Palletplaatsen</b> = hoeveel pallets naast elkaar op één ligger. Is een sectie anders? Schrijf hem onderaan.'],
  ['EN', 'Measure in cm. <b>Free height</b> = from the floor or the top of the beam to the underside of the beam above. <b>Width</b> = inside measurement between the uprights. <b>Depth</b> = front to back. Top bulk level: to the top of the rack. <b>Pallets per beam</b> = how many pallets side by side on one beam. Is a section different? Write it at the bottom.'],
  ['ES', 'Mide en cm. <b>Altura libre</b> = desde el suelo o la parte de arriba del larguero hasta la parte de abajo del larguero de encima. <b>Ancho</b> = medida interior entre los bastidores. <b>Fondo</b> = de delante a atrás. Nivel bulk de arriba: hasta la parte superior de la estantería. <b>Palés por larguero</b> = cuántos palés caben uno al lado del otro en un larguero. ¿Una sección es diferente? Escríbela abajo.'],
  ['EL', 'Μέτρα σε cm. <b>Ελεύθερο ύψος</b> = από το πάτωμα ή το πάνω μέρος της δοκού μέχρι το κάτω μέρος της δοκού από πάνω. <b>Πλάτος</b> = εσωτερική απόσταση ανάμεσα στις κολόνες. <b>Βάθος</b> = από μπροστά μέχρι πίσω. Πάνω επίπεδο bulk: μέχρι την κορυφή του ραφιού. <b>Παλέτες ανά δοκό</b> = πόσες παλέτες χωράνε δίπλα-δίπλα σε μία δοκό. Διαφέρει ένα τμήμα; Γράψ’ το κάτω.']
];
function tekening(niveaus, bulk){
  // vooraanzicht: staanders, liggers per niveau (oranje = pick, blauw = bulk), pijl per vrije hoogte
  const W = 360, H = 270, x0 = 70, x1 = 250, vloer = 245, top = 22;
  const lagen = niveaus.concat(bulk).sort((a, b) => a - b);
  if(lagen[0] !== 0) lagen.unshift(0);      // vloer telt altijd mee als begin
  const n = lagen.length, stap = (vloer - top) / (n + 0.2);
  const yL = i => vloer - i * stap;
  const isBulk = lv => bulk.includes(lv);
  let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:380px" font-family="Arial" font-size="11">`;
  g += `<line x1="20" y1="${vloer}" x2="${x1 + 30}" y2="${vloer}" stroke="#000" stroke-width="2"/>`;
  g += `<rect x="${x0 - 8}" y="${top}" width="8" height="${vloer - top}" fill="#555"/><rect x="${x1}" y="${top}" width="8" height="${vloer - top}" fill="#555"/>`;
  lagen.forEach((lv, i) => {
    const onder = yL(i), boven = i + 1 < n ? yL(i + 1) + 6 : top;
    const kl = isBulk(lv) ? '#06c' : '#c00';
    if(i > 0) g += `<rect x="${x0}" y="${onder}" width="${x1 - x0}" height="6" fill="${isBulk(lv) ? '#1a56c4' : '#e07b00'}"/><text x="${x1 + 14}" y="${onder + 6}">${p2(lv)}${isBulk(lv) ? ' bulk' : ''}</text>`;
    if(lv === 0 && !niveaus.includes(0)) return;
    const xm = x0 + 30 + (i % 2) * 50;
    g += `<line x1="${xm}" y1="${onder - 2}" x2="${xm}" y2="${boven + 2}" stroke="${kl}" stroke-width="1.5" marker-start="url(#p${isBulk(lv) ? 'b' : 'k'})" marker-end="url(#p${isBulk(lv) ? 'b' : 'k'})"/>`;
    g += `<text x="${xm + 6}" y="${(onder + boven) / 2 + 4}" fill="${kl}" font-weight="bold">${p2(lv)}</text>`;
  });
  g += `<text x="22" y="${vloer - 4}">00</text><text x="${x1 + 14}" y="${top + 8}">top</text>`;
  g += `<line x1="${x0 + 2}" y1="${vloer + 14}" x2="${x1 - 2}" y2="${vloer + 14}" stroke="#333" stroke-width="1.5" marker-start="url(#pz)" marker-end="url(#pz)"/><text x="${(x0 + x1) / 2 - 30}" y="${vloer + 25}" font-weight="bold">breedte / width</text>`;
  g += `<defs>${[['k', '#c00'], ['b', '#06c'], ['z', '#333']].map(([k, c]) => `<marker id="p${k}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`).join('')}</defs></svg>`;
  return g;
}
function formulierGang(gang){
  const g = gangInfo()[gang], s = data()[gang] || {};
  const niveaus = niveausVan(g), bulk = bulkVan(g);
  const topB = Math.max(...bulk), topP = Math.max(...niveaus);
  const oud = v => v !== null && v !== undefined && v !== '' ? `<span class="s-oud">${esc(v)}</span>` : '';
  const vak = v => `<td class="s-vak">${oud(v)}</td>`;
  return `<section class="s-blad">
    <div class="pkop"><b>IVOL · Stelling meten · Gang ${esc(gang)}</b><span>${g ? 'secties ' + [...g.secs].sort((a, b) => a - b).map(p2).join(', ') + ' · ' : ''}pick ${niveaus.map(p2).join(', ') || '–'} · bulk ${bulk.map(p2).join(', ') || '–'}</span></div>
    <div class="s-prij">
      <div class="s-pteken">${tekening(niveaus, bulk)}</div>
      <div class="s-puitleg">${UITLEG.map(([t, x]) => `<p><b>${t}</b> ${x}</p>`).join('')}</div>
    </div>
    <table class="s-ptab"><tr><th>Niveau / Level</th><th>Vrije hoogte / Free height (cm)</th></tr>
      ${bulk.slice().reverse().map(n => `<tr><td><b>${p2(n)}</b> bulk${n === topB ? ' (tot bovenkant / to top)' : ''}</td>${vak((s.niveaus || {})[p2(n)])}</tr>`).join('')}
      ${niveaus.slice().reverse().map(n => `<tr><td><b>${p2(n)}</b>${n === 0 ? ' vloer / floor' : ''}${n === topP && bulk.length ? ' (tot ligger ' + p2(bulk[0]) + ')' : ''}</td>${vak((s.niveaus || {})[p2(n)])}</tr>`).join('')}
      <tr><td><b>Liggerbreedte</b> / width</td>${vak(s.breedte)}</tr>
      <tr><td><b>Diepte</b> / depth</td>${vak(s.diepte)}</tr>
      ${bulk.length ? `<tr><td><b>Palletplaatsen op een ligger</b> / pallets per beam</td>${vak(s.palletplaatsen ?? (g && g.bplaatsen) ?? '')}</tr>` : ''}
      ${niveaus.length ? `<tr><td><b>Pickplaatsen op een ligger</b> / pick places per beam (A–D)</td>${vak(s.plaatsen ?? (g && g.plaatsen) ?? '')}</tr>` : ''}</table>
    <table class="s-ptab mt8"><tr><th style="width:18%">Afwijkende sectie / different section</th><th>Wat is anders + maten (cm) / what is different + sizes</th></tr>
      ${Object.entries(s.afwijk || {}).map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td><span class="s-oud">${esc(Object.entries(v.niveaus || {}).filter(x => x[1]).map(x => x[0] + ': ' + x[1]).join(' · ') + (v.breedte ? ' · breedte ' + v.breedte : '') + (v.palletplaatsen ? ' · palletplaatsen ' + v.palletplaatsen : '') + (v.diepte ? ' · diepte ' + v.diepte : '') + (v.notitie ? ' · ' + v.notitie : ''))}</span></td></tr>`).join('')}
      ${'<tr><td class="s-vak"></td><td class="s-vak"></td></tr>'.repeat(4)}</table>
    <div class="s-pvoet">Gemeten door / measured by: ______________________ &nbsp; Datum / date: ____________</div>
    ${Object.keys(s).length ? '<div class="s-pvoet">Grijs = staat al in de app: klopt het? Streep door en schrijf het juiste getal erbij.</div>' : ''}
  </section>`;
}
function printFormulier(gangen){
  let box = document.getElementById('s-print');
  if(!box){ box = document.createElement('div'); box.id = 's-print'; box.className = 'printonly'; document.getElementById('app').appendChild(box); }
  box.innerHTML = gangen.map(formulierGang).join('');
  box.dataset.printnaam = 'Stelling meetformulier - ' + (gangen.length <= 6 ? 'gang ' + gangen.join(' ') : gangen.length + ' gangen ' + gangen[0] + '-' + gangen[gangen.length - 1]);
  document.body.classList.add('s-pr');
  const weg = () => { document.body.classList.remove('s-pr'); window.removeEventListener('afterprint', weg); };
  window.addEventListener('afterprint', weg);
  setTimeout(() => window.print(), 50);
}

function exporteer(){
  const S = data(); const G = gangInfo();
  const wb = XLSX.utils.book_new();
  const kopL = ['Locatie', 'Gang', 'Sectie', 'Plaats', 'Niveau', 'Soort', 'Vrije hoogte cm', 'Breedte plaats cm', 'Diepte cm', 'Bron', 'Producten', 'Notitie'];
  const rijL = [];
  Object.keys(S).sort().forEach(gang => {
    const g = G[gang]; if(!g) return;
    g.locs.slice().sort((x, y) => x.sec - y.sec || x.pl.localeCompare(y.pl) || x.h - y.h).forEach(i => {
      const m = maatVan(i.naam) || {};
      rijL.push([i.naam, i.gang, p2(i.sec), i.pl, p2(i.h), m.soort || '', m.hoogte ?? '', m.breedte ?? '', m.diepte ?? '', m.bron || '', (D.LOC[i.naam] || {}).codes ? D.LOC[i.naam].codes.join(', ') : '', m.notitie || '']);
    });
  });
  const alleNiv = [...new Set(Object.values(S).flatMap(s => Object.keys(s.niveaus || {})))].sort();
  const kopG = ['Gang', 'Secties', 'Liggerbreedte cm', 'Diepte cm', 'Pickplaatsen per ligger', 'Palletplaatsen per ligger'].concat(alleNiv.map(n => 'Niveau ' + n + ' cm'), ['Afwijkende secties', 'Notitie', 'Opgeslagen']);
  const rijG = Object.keys(S).sort().map(gang => { const s = S[gang], g = G[gang];
    return [gang, g ? g.secs.size : '', s.breedte ?? '', s.diepte ?? '', s.plaatsen ?? (g && g.plaatsen) ?? '', s.palletplaatsen ?? (g && g.bplaatsen) ?? ''].concat(alleNiv.map(n => (s.niveaus || {})[n] ?? ''),
      [Object.entries(s.afwijk || {}).map(([k, v]) => 'sectie ' + k + ': ' + Object.entries(v.niveaus || {}).filter(x => x[1]).map(x => x[0] + '=' + x[1]).join(' ') + (v.breedte ? ' breedte ' + v.breedte : '') + (v.palletplaatsen ? ' palletplaatsen ' + v.palletplaatsen : '') + (v.diepte ? ' diepte ' + v.diepte : '') + (v.notitie ? ' (' + v.notitie + ')' : '')).join(' | '), s.notitie || '', s.op ? s.op.slice(0, 10) : '']); });
  const w1 = XLSX.utils.aoa_to_sheet([kopG].concat(rijG)); w1['!cols'] = kopG.map(k => ({ wch:Math.max(10, k.length + 2) }));
  const w2 = XLSX.utils.aoa_to_sheet([kopL].concat(rijL)); w2['!cols'] = kopL.map(k => ({ wch:Math.max(10, k.length + 2) }));
  XLSX.utils.book_append_sheet(wb, w1, 'Gangen'); XLSX.utils.book_append_sheet(wb, w2, 'Locaties');
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
