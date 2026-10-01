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
      <button class="btn sm pri" data-s="exp" ${Object.keys(S).length ? '' : 'disabled'}>Exporteer (Excel)</button></div></div>
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
    <div class="row wrap mt12"><button class="btn ok" data-s="opslaan" data-g="${esc(gang)}">Opslaan</button></div></div>
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
return { view, maatVan, gangInfo };
})();
