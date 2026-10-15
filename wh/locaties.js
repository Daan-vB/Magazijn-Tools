/* =====================================================================
   IVOL Warehouse 3.0 — Locaties opruimen (ronde 3, 16-10-2026)
   Geladen in 3.0 (ivol: alleen de telling, voor Hoe staat het ervoor, Fundament en taak 3.3) en in Test
   (de schermen, die 3.0 in het iframe opent). Warehouse laadt dit bestand niet.
     #/locaties                    aandachtspunten als tegels, gangen met "nagelopen"
     #/locaties/punt/<soort>       één kleine beslistabel per aandachtspunt
     #/locaties/<gang>             stellingkaart met hoogte-knoppen
     #/locaties/<gang>/<hh>        gang aflopen per hoogte
     #/locaties/import?punt=|gang= verse export inlezen → vergelijken → importbestand
   Besluiten: catalog-rij wh-locbesluit = { loc:{ <naam>:{ bulk, tijd, uitz, nagelopen, op, soort, basis:{ bulk, tijd, codes, vr } } },
     koppel:{ <naam>:{ ok:[code], weg:[{ code, op, vrToen, soort }] } }, zelf:[{ naam, code, wat, op, soort }],
     imports:[{ op, soort, nLoc, nKoppel, bestand, exportVan, filter, namen, koppel, test }], geteld:{ <code>:{ op, n } }, kar:{ <kar|code>:{ op, n } } }
   Een besluit is de gewenste stand. Nooit naar Picqer schrijven: alleen importbestanden die Daan zelf uploadt,
   en die doen maar drie dingen: bulk ja/nee, tijdelijk ja/nee, een product ontkoppelen van een locatie zonder voorraad.
   ===================================================================== */
window.WHLOC = (function(){
'use strict';
const { $, esc, nf, D, toast, isoDag, vandaag } = WH;
const KEY = 'wh-locbesluit', MAG = 3857, PQ = 'https://ivol.picqer.com';
const OUD_UUR = 2;
const B = { d:null, laden:null, fout:null, timer:null, vuil:false, status:'', pend:null, luister:[] };
const leeg = () => ({ loc:{}, koppel:{}, zelf:[], imports:[], geteld:{}, kar:{} });
const nieuwPend = () => ({ loc:new Set(), koppel:new Set(), geteld:new Set(), kar:new Set(), zelf:new Set(), imports:[] });
B.pend = nieuwPend();
function norm(d){
  d = d && typeof d === 'object' ? d : {};
  const n = leeg();
  Object.keys(n).forEach(k => { if(d[k] && typeof d[k] === 'object' && Array.isArray(d[k]) === Array.isArray(n[k])) n[k] = d[k]; });
  return n;
}
const nuIso = () => new Date().toISOString();
const meld = () => B.luister.forEach(f => { try{ f(); }catch(e){ console.error(e); } });

/* ---------- laden en bewaren (700 ms na de laatste klik, samengevoegd met wat een ander apparaat bewaarde) ---------- */
function laad(vers){
  if(B.laden && !vers) return B.laden;
  B.laden = (async () => {
    try{ const r = await WH.catHaal(KEY); if(!B.vuil) B.d = norm(r && r.data); B.fout = null; }
    catch(e){ B.fout = e; if(!B.d) B.d = leeg(); }
    B.laden = null;
    meld();
    return B.d;
  })();
  return B.laden;
}
function statusBalk(){ const s = $('lk-status'); if(s){ s.textContent = B.status; s.className = 'lk-status' + (/mislukt/.test(B.status) ? ' fout' : ''); } }
function wijzig(){ B.vuil = true; B.status = 'Opslaan…'; statusBalk(); clearTimeout(B.timer); B.timer = setTimeout(bewaar, 700); }
async function bewaar(){
  clearTimeout(B.timer);
  const pend = B.pend; B.pend = nieuwPend();
  try{
    const r = await WH.catHaal(KEY);
    const basis = norm(r && r.data), mijn = B.d;
    ['loc', 'koppel', 'geteld', 'kar'].forEach(k => pend[k].forEach(n => { if(mijn[k][n] === undefined) delete basis[k][n]; else basis[k][n] = mijn[k][n]; }));
    if(pend.zelf.size){
      basis.zelf = basis.zelf.filter(z => !pend.zelf.has(z.naam + '|' + z.code)).concat(mijn.zelf.filter(z => pend.zelf.has(z.naam + '|' + z.code)));
    }
    pend.imports.forEach(i => { if(!basis.imports.some(x => x.op === i.op && x.bestand === i.bestand)) basis.imports.push(i); });
    basis.imports = basis.imports.slice(-60);
    await WH.catZet(KEY, basis);
    if(!B.pend.loc.size && !B.pend.koppel.size && !B.pend.zelf.size && !B.pend.imports.length && !B.pend.geteld.size && !B.pend.kar.size){ B.d = basis; B.vuil = false; }
    B.status = 'Opgeslagen ✓ ' + new Date().toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  }catch(e){
    ['loc', 'koppel', 'geteld', 'kar', 'zelf'].forEach(k => pend[k].forEach(n => B.pend[k].add(n))); B.pend.imports = pend.imports.concat(B.pend.imports);
    B.status = 'Opslaan mislukt: ' + (e.message || e) + ' · probeer opnieuw';
  }
  statusBalk(); meld();
}

/* ---------- hulpjes ---------- */
const cc = c => D.PLOW[String(c || '').trim().toLowerCase()] || String(c || '').trim();
const naamP = c => String((D.P[c] || {}).naam || '');
const kortN = c => { const n = naamP(c); return n.length > 44 ? n.slice(0, 42) + '…' : n; };
const isKar = n => /^container\s*\d+$/i.test(String(n || '').trim());
const isMap = n => window.WHAL && WHAL.isPick ? !WHAL.isPick(n) : false;
const pqCode = c => { const q = D.PQ[c]; return q && q[3] ? q[3] : c; };   // exacte Picqer-code (soms met spatie)
const pqId = c => window.WHAL && WHAL.S.cat && WHAL.S.cat.ids ? WHAL.S.cat.ids[c] : null;
const pqLink = (c, t) => { const id = pqId(c); return id ? `<a href="${PQ}/products/${encodeURIComponent(id)}" target="_blank" rel="noopener">${esc(t || c)} ↗</a>` : `<span class="code">${esc(t || c)}</span>`; };
const dtTxt = iso => { if(!iso) return '–'; const d = new Date(String(iso).replace(' ', 'T')); return isNaN(d) ? String(iso) : d.toLocaleString('nl-NL', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).replace(',', ''); };
const uurOud = iso => { if(!iso) return 1e9; const d = new Date(String(iso).replace(' ', 'T')); return isNaN(d) ? 1e9 : (Date.now() - d.getTime()) / 36e5; };
const leeftijd = iso => { const h = uurOud(iso); return h > 1e8 ? 'onbekend' : h < 1 ? Math.max(0, Math.round(h * 60)) + ' min oud' : h < 48 ? Math.floor(h) + ' uur oud' : Math.floor(h / 24) + ' dagen oud'; };
const codesVan = naam => ((D.LOC[naam] || {}).codes || []).map(cc);
const koppelDatum = () => D.LOCCODES !== undefined ? D.LOCCODES : D.LOCDATUM;   // datum van de productkoppelingen
const sortLoc = (a, b) => WHL.sortLoc(a, b);
const hoogte = naam => { const i = WHL.locInfo(naam); return i.std ? String(i.h).padStart(2, '0') : ''; };
const kort = (s, n) => String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || '');
let IDX = null, IDXVAN = null;
function perProduct(){
  if(IDXVAN !== D.LOC){ IDX = {}; Object.values(D.LOC || {}).forEach(L => (L.codes || []).forEach(c => { c = cc(c); (IDX[c] = IDX[c] || []).push(L.naam); })); IDXVAN = D.LOC; }
  return IDX;
}
// voorraad hier volgens de laatste stand: de live stand van Picqer als die nieuwer is dan de voorraad-export
function hier(code, loc){
  const v = D.VR[code];
  let n = v ? (isKar(loc) ? (v.cont || {})[loc] : (v.locs || {})[loc]) || 0 : 0, bron = 'export', t = D.VRDATUM;
  const p = window.WHAL && WHAL.S.st && WHAL.S.st.p && WHAL.S.st.p[code];
  if(p && p.t && (!D.VRDATUM || new Date(String(p.t).replace(' ', 'T')) > new Date(D.VRDATUM))){
    const l = (p.l || []).find(x => x[0] === loc && (x[1] == null || Number(x[1]) === MAG));
    n = l ? l[4] || 0 : 0; bron = 'live'; t = p.t;
  }
  return { n, bron, t };
}
const basisVan = naam => { const L = D.LOC[naam] || {}; const codes = codesVan(naam); return { bulk:!!L.bulk, tijd:!!L.tijd, codes, vr:Object.fromEntries(codes.map(c => [c, hier(c, naam).n])) }; };
const voorraadTxt = () => `voorraad volgens ${D.VRDATUM ? 'export van ' + dtTxt(D.VRDATUM) : 'geen export'}${window.WHAL && WHAL.S.st && WHAL.S.st.bijgewerkt ? ', live stand ' + dtTxt(WHAL.S.st.bijgewerkt) + ' waar nieuwer' : ''} · locaties ${D.LOCBRON === 'picqer-live' ? 'live ' : ''}${dtTxt(D.LOCDATUM)} · koppelingen ${dtTxt(koppelDatum())}`;

/* ---------- de soorten aandachtspunten ---------- */
const SOORTEN = [
  { k:'tijdPick', t:'Picklocatie op tijdelijk', kort:'pick op tijdelijk', soort:'loc', u:'Picqer haalt het product eraf zodra de voorraad 0 is.',
    probleem:'Deze picklocaties staan in Picqer op tijdelijk.', picqer:'Bij voorraad 0 ontkoppelt Picqer het product; de volgende levering heeft dan geen vaste plek meer. "Moet vast" zet Tijdelijke locatie op nee.',
    a:{ t:'Moet vast', v:{ tijd:false } }, b:{ t:'Blijft tijdelijk' } },
  { k:'vloerBulk', t:'Vloer maar bulk', kort:'vloer maar bulk', soort:'loc', u:'Hoogte 00–09 is volgens de regel pick en vast.',
    probleem:'Deze locaties op de vloer of een legbord staan in Picqer als bulk.', picqer:'Picqer telt bulk niet als pickvoorraad: orders wachten op een verplaatsing die niet nodig is. "Wordt pick, vast" zet Bulklocatie en Tijdelijke locatie op nee.',
    a:{ t:'Wordt pick, vast', v:{ bulk:false, tijd:false } }, b:{ t:'Blijft bulk' } },
  { k:'hoogPick', t:'Hoog maar pick', kort:'hoog maar pick', soort:'loc', u:'Hoogte 10 en hoger is volgens de regel bulk en tijdelijk.',
    probleem:'Deze locaties op 10 of hoger staan in Picqer als pick.', picqer:'Picqer laat pickers hier picken, op hoogte. "Wordt bulk, tijdelijk" zet Bulklocatie en Tijdelijke locatie op ja.',
    a:{ t:'Wordt bulk, tijdelijk', v:{ bulk:true, tijd:true } }, b:{ t:'Blijft pick' } },
  { k:'regel', t:'Wijkt af van de regel', kort:'wijkt af van de regel', soort:'loc', u:'Pick/bulk of vast/tijdelijk anders dan de regel per hoogte.',
    probleem:'Deze locaties wijken af van de regel (00–09 pick en vast, 10+ bulk en tijdelijk; BY/BZ 15 en 30 bulk; AH alles pick).', picqer:'"Volgens de regel" zet bulk en tijdelijk zoals de regel zegt. "Uitzondering" verdwijnt voorgoed uit de aandachtspunten.',
    a:{ t:'Volgens de regel' }, b:{ t:'Uitzondering, laten zo' } },
  { k:'dubbel', t:'Foute BA-dubbeling', kort:'BA-dubbeling', soort:'koppel', u:'Locatie met streepje (…-06) naast dezelfde zonder streepje.',
    probleem:'Producten staan op een BA-locatie met streepje, die er ook zonder streepje is.', picqer:'Ontkoppelen haalt het product van de streepjeslocatie (alleen zonder voorraad hier én als het al op de versie zonder streepje staat). De rest: zelf in Picqer koppelen aan BA..06, voorraad verplaatsen, daarna de streepjeslocatie archiveren.' },
  { k:'rommel', t:'Losse namen', kort:'losse namen', soort:'koppel', u:'Locaties buiten het patroon, zoals BE, Tafel-AA, BE-tafel, Cf- Stellingkast.',
    probleem:'Producten staan op een locatie met een losse naam.', picqer:'Picqer telt een losse naam als pick, maar niemand vindt hem. Ontkoppelen kan alleen zonder voorraad hier; anders eerst verplaatsen in Picqer.' },
  { k:'opMap', t:'Op een map', kort:'op een map', soort:'koppel', u:'Producten op een bovenliggende locatie of een gang-/sectienaam op tijdelijk.',
    probleem:'Producten staan op een map (bovenliggende locatie, of een gang-, sectie- of plaatsnaam op tijdelijk).', picqer:'Een map is geen pick- of bulkplek. Ontkoppelen kan alleen zonder voorraad hier; anders eerst verplaatsen in Picqer.' },
  { k:'veel', t:'15+ producten op één locatie', kort:'15+ producten', soort:'koppel', u:'Wat staat hier echt?',
    probleem:'Op deze locaties staan 15 of meer producten gekoppeld.', picqer:'Per product: hoort hier, of weg (ontkoppelen, alleen zonder voorraad hier). Voorraad 0 is het voorstel om weg te halen.' },
  { k:'geen', t:'Voorraad zonder locatie', kort:'zonder locatie', soort:'geen', u:'Voorraad op "geen specifieke locatie": tellen en op de juiste plek zetten.',
    probleem:'Deze producten hebben voorraad op "geen specifieke locatie". Picqer telt dat als pick, maar op de plank ligt het niet.', picqer:'Tel het, zet het in Picqer op de juiste locatie en tik "Geteld en weggezet". Dat is alleen een notitie; er gaat niets naar Picqer.' },
  { k:'kar', t:'Retourkarren met voorraad', kort:'retourkar', soort:'kar', u:'Voorraad op Container 1–6 blokkeert orders.',
    probleem:'Op deze retourkarren staat voorraad.', picqer:'Een retourkar is nooit een bron voor orders of aanvullen. Terugzetten in Picqer en tik "Teruggezet" (alleen een notitie).' }
];
const SOORT = Object.fromEntries(SOORTEN.map(s => [s.k, s]));
const LOCSOORT = ['tijdPick', 'vloerBulk', 'hoogPick', 'regel'];

// welke locaties nu een probleem zijn (uit D.LOC, dus de laatste export of de live locaties)
let PV = null;
function problemen(){
  if(PV && PV.van === D.LOC && PV.pq === D.PQ && Date.now() - PV.t < 4000) return PV.r;
  const r = { tijdPick:[], vloerBulk:[], hoogPick:[], regel:[], dubbel:[], rommel:[], opMap:[], veel:[], info:{} };
  const namen = new Set(Object.keys(D.LOC || {}));
  Object.values(D.LOC || {}).forEach(L => {
    const i = WHL.locInfo(L.naam);
    if(i.std){
      const reg = WHL.regelSoort(i);
      if(reg === 'bulk' && !L.bulk) r.hoogPick.push(L.naam);
      else if(reg === 'pick' && L.bulk) r.vloerBulk.push(L.naam);
      else if(!L.bulk && L.tijd) r.tijdPick.push(L.naam);
      if((L.codes || []).length >= 15) r.veel.push(L.naam);
    }else if((L.codes || []).length && !isKar(L.naam)){
      const m = /^([A-Z]{2}\d{2}[A-D])-(\d{2})$/.exec(L.naam);
      if(m && namen.has(m[1] + m[2])){ r.dubbel.push(L.naam); r.info[L.naam] = m[1] + m[2]; }
      else if(isMap(L.naam)) r.opMap.push(L.naam);
      else r.rommel.push(L.naam);
    }
  });
  const al = new Set(r.tijdPick.concat(r.vloerBulk, r.hoogPick));
  try{ WHL.locAfwijkingen().forEach(a => { if(!al.has(a.naam)){ r.regel.push(a.naam); r.info[a.naam] = a; } }); }catch(e){ console.error(e); }
  Object.keys(r).forEach(k => { if(Array.isArray(r[k])) r[k].sort(sortLoc); });
  PV = { van:D.LOC, pq:D.PQ, t:Date.now(), r };
  return r;
}
// wat de regel zegt voor een locatie (null = geen regel)
function regelVan(naam){ const r = WHL.regelSoort(WHL.locInfo(naam)); return r ? { bulk:r === 'bulk', tijd:r === 'bulk' } : null; }

/* ---------- status per besluit: open → beslist → in import → verwerkt ---------- */
function inImport(naam, code, op){
  return (B.d.imports || []).some(i => i.op > op && (code ? (i.koppel || []).some(([n, c]) => n === naam && c === code) : (i.namen || []).includes(naam)));
}
function locStatus(naam){
  const b = B.d && B.d.loc[naam]; const L = D.LOC[naam];
  if(!b) return 'open';
  if(b.uitz) return 'klaar';
  if(b.bulk === undefined || b.tijd === undefined) return 'open';
  if(!L) return 'weg';
  if(!!L.bulk === !!b.bulk && !!L.tijd === !!b.tijd) return 'verwerkt';
  return inImport(naam, null, b.op) ? 'import' : 'beslist';
}
const zelfVan = (naam, code) => (B.d.zelf || []).find(z => z.naam === naam && z.code === code) || null;
function kopStatus(naam, code){
  const k = B.d && B.d.koppel[naam] || {};
  const op = codesVan(naam).includes(code);
  const w = (k.weg || []).find(x => x.code === code);
  if(w) return !op ? 'verwerkt' : inImport(naam, code, w.op) ? 'import' : 'beslist';
  if((k.ok || []).includes(code)) return op ? 'klaar' : 'verwerkt';
  const z = zelfVan(naam, code);
  if(z) return z.wat === 'koppelen' ? (op ? 'verwerkt' : 'zelf') : (op ? 'zelf' : 'verwerkt');
  return op ? 'open' : 'weg';
}
const telt = { open:'open', beslist:'wacht', import:'wacht', zelf:'wacht', verwerkt:'klaar', klaar:'klaar', weg:'klaar' };
const ST_TXT = { open:'', beslist:'beslist', import:'in import', zelf:'zelf doen in Picqer', verwerkt:'✓ verwerkt', klaar:'✓', weg:'✓ bestaat niet meer' };

// regels per soort: [{ id, naam, code?, st, ... }]
function regels(k){
  const P = problemen(), d = B.d || leeg();
  if(LOCSOORT.includes(k)){
    const namen = new Set(P[k]);
    Object.entries(d.loc).forEach(([n, b]) => { if(b.soort === k) namen.add(n); });
    return [...namen].filter(n => !(d.loc[n] && d.loc[n].uitz)).sort(sortLoc).map(naam => ({ id:naam, naam, st:locStatus(naam) }));
  }
  if(['dubbel', 'rommel', 'opMap', 'veel'].includes(k)){
    const namen = new Set(P[k]);
    Object.entries(d.koppel).forEach(([n, x]) => { if((x.weg || []).some(w => w.soort === k)) namen.add(n); });
    d.zelf.forEach(z => { if(z.soort === k) namen.add(z.naam); });
    const uit = [];
    [...namen].sort(sortLoc).forEach(naam => {
      const codes = new Set(codesVan(naam));
      ((d.koppel[naam] || {}).weg || []).forEach(w => { if(w.soort === k) codes.add(w.code); });
      d.zelf.forEach(z => { if(z.naam === naam && z.soort === k) codes.add(z.code); });
      [...codes].sort().forEach(code => uit.push({ id:naam + '|' + code, naam, code, st:kopStatus(naam, code) }));
    });
    return uit;
  }
  if(k === 'geen'){
    const uit = [], gezien = new Set();
    let Z = []; try{ Z = window.WHAL && WHAL.zonderLocatie ? WHAL.zonderLocatie() : []; }catch(e){ console.error(e); }
    Z.forEach(z => { gezien.add(z.code); uit.push({ id:z.code, code:z.code, n:z.n, pick:z.pick, krap:z.krap, plank:z.plank }); });
    Object.entries(D.VR || {}).filter(([c, v]) => v.geen > 0 && !gezien.has(c)).sort((a, b) => b[1].geen - a[1].geen || a[0].localeCompare(b[0]))
      .forEach(([c, v]) => uit.push({ id:c, code:c, n:v.geen, pick:[], krap:false }));
    Object.keys(d.geteld).forEach(c => { if(!uit.some(x => x.code === c)) uit.push({ id:c, code:c, n:0, pick:[], krap:false }); });
    uit.forEach(x => {
      const g = d.geteld[x.code];
      x.bulk = (perProduct()[x.code] || []).filter(l => D.LOC[l] && D.LOC[l].bulk).sort(sortLoc);
      x.st = !x.n ? (g ? 'verwerkt' : 'klaar') : g && (!D.VRDATUM || g.op >= D.VRDATUM) ? 'klaar' : 'open';
      x.opnieuw = !!(g && x.n && D.VRDATUM && g.op < D.VRDATUM);
    });
    return uit;
  }
  if(k === 'kar'){
    const per = {};
    Object.entries(D.VR || {}).forEach(([c, v]) => Object.entries(v.cont || {}).forEach(([kar, n]) => { if(n > 0) per[kar + '|' + c] = { kar, code:c, n, bron:'export' }; }));
    const st = window.WHAL && WHAL.S.st && WHAL.S.st.p;
    if(st) Object.entries(st).forEach(([c, p]) => {
      if(!p.t || (D.VRDATUM && new Date(String(p.t).replace(' ', 'T')) <= new Date(D.VRDATUM))) return;
      Object.keys(per).filter(id => id.endsWith('|' + c)).forEach(id => delete per[id]);
      (p.l || []).forEach(l => { if((l[3] === 1 || isKar(l[0])) && l[4] > 0) per[l[0] + '|' + c] = { kar:l[0], code:c, n:l[4], bron:'live' }; });
    });
    return Object.entries(per).sort((a, b) => a[1].kar.localeCompare(b[1].kar, 'nl', { numeric:true }) || a[1].code.localeCompare(b[1].code))
      .map(([id, x]) => { const g = d.kar[id]; return Object.assign({ id, st:g && (!D.VRDATUM || g.op >= D.VRDATUM) ? 'klaar' : 'open' }, x); });
  }
  return [];
}
function tel(k){
  const r = regels(k), t = { n:r.length, open:0, wacht:0, klaar:0, beslist:0 };
  r.forEach(x => { t[telt[x.st] || 'open']++; if(x.st !== 'open') t.beslist++; });
  t.werk = t.open + t.wacht;
  return t;
}
// telling voor Hoe staat het ervoor, Fundament, Te doen en taak 3.3 (besliste uitzonderingen en verwerkte besluiten tellen niet mee)
function telling(){
  if(!B.d) laad();
  const per = {}; SOORTEN.forEach(s => { try{ per[s.k] = tel(s.k); }catch(e){ console.error(e); per[s.k] = { n:0, open:0, wacht:0, klaar:0, beslist:0, werk:0 }; } });
  const zonderGeen = SOORTEN.filter(s => s.k !== 'geen');
  return { per, werk:zonderGeen.reduce((s, x) => s + per[x.k].werk, 0), open:zonderGeen.reduce((s, x) => s + per[x.k].open, 0), wacht:zonderGeen.reduce((s, x) => s + per[x.k].wacht, 0), geladen:!!B.d };
}

/* ---------- besluiten zetten ---------- */
function zetLoc(naam, v, soort){
  const L = D.LOC[naam]; if(!L) return;
  const oud = B.d.loc[naam] || {};
  const rec = Object.assign({}, oud, v, { op:nuIso(), soort:oud.soort && soort === 'gang' ? oud.soort : soort, basis:basisVan(naam) });
  if(v.uitz){ rec.bulk = !!L.bulk; rec.tijd = !!L.tijd; }
  else if('bulk' in v || 'tijd' in v){ delete rec.uitz; if(rec.bulk === undefined) rec.bulk = !!L.bulk; if(rec.tijd === undefined) rec.tijd = !!L.tijd; }
  B.d.loc[naam] = rec; B.pend.loc.add(naam); wijzig();
}
function wisLoc(naam){
  const oud = B.d.loc[naam]; if(!oud) return;
  if(oud.nagelopen){ const r = { nagelopen:true, op:nuIso(), soort:oud.soort }; B.d.loc[naam] = r; } else delete B.d.loc[naam];
  B.pend.loc.add(naam); wijzig();
}
function zetKop(naam, code, keuze, soort, wat){
  const k = B.d.koppel[naam] = Object.assign({ ok:[], weg:[] }, B.d.koppel[naam] || {});
  k.ok = (k.ok || []).filter(c => c !== code); k.weg = (k.weg || []).filter(x => x.code !== code);
  const had = !!zelfVan(naam, code);
  B.d.zelf = B.d.zelf.filter(z => !(z.naam === naam && z.code === code));
  if(keuze === 'ok') k.ok.push(code);
  if(keuze === 'weg') k.weg.push({ code, op:nuIso(), vrToen:hier(code, naam).n, soort });
  if(keuze === 'zelf') B.d.zelf.push({ naam, code, wat:wat || zelfWat(soort, naam, code), op:nuIso(), soort });
  if(keuze === 'zelf' || had) B.pend.zelf.add(naam + '|' + code);
  if(!k.ok.length && !k.weg.length) delete B.d.koppel[naam];
  B.pend.koppel.add(naam); wijzig();
}
function zelfWat(soort, naam, code){
  if(soort === 'dubbel'){ const z = problemen().info[naam] || naam.replace('-', ''); return 'koppelen aan ' + z + ', voorraad verplaatsen, daarna ' + naam + ' archiveren'; }
  return hier(code, naam).n > 0 ? 'voorraad verplaatsen naar een echte locatie, daarna ontkoppelen' : 'ontkoppelen of op een echte locatie zetten';
}
const gekozen = (naam, code) => { const k = B.d.koppel[naam] || {}; return (k.weg || []).some(x => x.code === code) ? 'weg' : (k.ok || []).includes(code) ? 'ok' : zelfVan(naam, code) ? 'zelf' : ''; };
// nagelopen: vanzelf zodra instellingen bevestigd en alle producten beoordeeld; handmatig kan ook
function nagelopen(naam){
  const b = B.d && B.d.loc[naam]; if(!b) return false;
  if(b.nagelopen) return true;
  if(b.bulk === undefined && !b.uitz) return false;
  return codesVan(naam).every(c => gekozen(naam, c));
}

/* ---------- stijl ---------- */
function stijl(){
  if($('lk-stijl')) return;
  const s = document.createElement('style'); s.id = 'lk-stijl';
  s.textContent = `
  .lk-status{position:sticky;top:0;z-index:20;font-size:12.5px;font-weight:700;color:var(--ok);background:var(--bg);padding:4px 0;min-height:22px}
  .lk-status.fout{color:var(--bad)}
  .lk-tegels{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
  .lk-tegel{background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(15,23,32,.08);padding:12px 14px;border-left:5px solid #e0a100;display:grid;gap:4px;align-content:start}
  .lk-tegel .n{font-size:26px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
  .lk-tegel .t{font-weight:800;font-size:14px}
  .lk-tegel .u{font-size:12.5px;color:var(--muted)}
  .lk-tegel .v{font-size:12.5px;font-weight:700}
  .lk-tegel.af{border-left-color:var(--ok)}
  .lk-af{display:flex;justify-content:space-between;gap:8px;align-items:center;background:#fff;border-radius:10px;padding:8px 14px;box-shadow:0 1px 4px rgba(15,23,32,.06);font-size:13px;color:var(--muted);min-height:44px;text-decoration:none}
  .lk-af b{color:var(--ok)}
  .lk-knop,.lk-k{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 14px;border-radius:9px;border:2px solid var(--line);background:#fff;color:var(--ink);font:inherit;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;white-space:nowrap}
  .lk-knop.pri{background:var(--blue);border-color:var(--blue);color:#fff}
  .lk-knop[disabled],.lk-k[disabled]{opacity:.45;cursor:not-allowed}
  .lk-k.aan{background:var(--ink);border-color:var(--ink);color:#fff}
  .lk-k.aan.groen{background:var(--ok);border-color:var(--ok)}
  .lk-k.vs{border-color:var(--blue)}
  .lk-k small{font-weight:600;font-size:11px;margin-left:4px;opacity:.8}
  .lk-keus{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  .lk-rij{display:grid;grid-template-columns:minmax(150px,1.1fr) minmax(0,2fr) auto;gap:6px 12px;align-items:center;padding:10px 0;border-top:1px solid #e6ebf1}
  .lk-rij:first-child{border-top:0}
  .lk-rij.klaar{opacity:.62}
  .lk-rij .loc{font-size:14px}
  .lk-wat{display:grid;gap:2px;min-width:0;font-size:13px}
  .lk-wat .desc{overflow-wrap:anywhere}
  .lk-st{font-size:11.5px;font-weight:800;color:var(--ok)}
  .lk-st.wacht{color:var(--warn)}
  .lk-kaart{background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(15,23,32,.08);padding:12px 14px;margin-bottom:10px;display:grid;gap:8px;scroll-margin-top:60px}
  .lk-kaart.na{box-shadow:inset 5px 0 0 var(--ok),0 2px 10px rgba(15,23,32,.08)}
  .lk-kaart.focus{outline:3px solid var(--orange)}
  .lk-kop{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline}
  .lk-kop .loc{font-size:17px}
  .lk-afw{color:var(--warn);font-weight:800}
  .lk-prod{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;align-items:center;padding:6px 0;border-top:1px solid #eef1f5}
  .lk-hoogtes{display:flex;gap:6px;flex-wrap:wrap}
  .lk-hoogtes a{display:inline-flex;align-items:center;justify-content:center;min-width:52px;min-height:44px;padding:6px 10px;border-radius:9px;background:#fff;border:2px solid var(--line);color:var(--ink);font-weight:800;text-decoration:none;font-variant-numeric:tabular-nums}
  .lk-hoogtes a.aan{border-color:var(--blue);background:var(--bulkbg)}
  .lk-hoogtes a small{font-weight:600;color:var(--muted);margin-left:5px}
  .lk-filter{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
  .lk-filter label{display:flex;gap:6px;align-items:center;min-height:44px;font-weight:700;cursor:pointer}
  .lk-bak{border-left:5px solid var(--line);padding-left:10px}
  .lk-bak.ok{border-left-color:var(--ok)} .lk-bak.let{border-left-color:#e0a100} .lk-bak.niet{border-left-color:var(--bad)}
  .lk-stap{display:flex;align-items:center;gap:8px}
  .lk-stap .nr{display:inline-flex;width:28px;height:28px;border-radius:50%;background:var(--ink);color:#fff;font-weight:800;align-items:center;justify-content:center;flex:none}
  .lk-stap.dicht{opacity:.5}
  ol.lk-ol{margin-left:20px;display:grid;gap:4px;font-size:13.5px}
  .lk-drop{border:2px dashed #9aa7b8;border-radius:12px;padding:18px;text-align:center;background:#fafbfd;cursor:pointer;display:block}
  .lk-drop.over{border-color:var(--blue);background:#eef4ff}
  .lk-zoek{display:flex;gap:8px;flex-wrap:wrap}
  .lk-zoek input{flex:1 1 220px;min-height:44px;font-size:16px}
  .lk-tabel td,.lk-tabel th{vertical-align:middle}
  .lk-mist{flex:1 1 170px;max-width:240px;min-height:44px;font-family:ui-monospace,Consolas,monospace;text-transform:uppercase}
  .lk-mist::placeholder{text-transform:none;font-family:inherit}
  #app a:focus-visible,#app button:focus-visible,#app input:focus-visible,#app summary:focus-visible{outline:3px solid var(--orange);outline-offset:2px}
  @media (max-width:700px){
    .lk-rij{grid-template-columns:1fr;gap:6px}
    .lk-keus .lk-k{flex:1 1 0}
    .lk-prod{grid-template-columns:1fr}
  }`;
  document.head.appendChild(s);
}

/* ---------- schermen ---------- */
const UI = { q:'', alleenProd:false, alleenAfw:false, focus:null, imp:{ sleutel:'', vers:null, keuze:{}, bericht:'', vorige:null } };
const app = () => $('app');
let HUIDIG = { delen:[], q:{} };
function kopBalk(terug, titel, sub){
  return `<div class="lk-status" id="lk-status" role="status" aria-live="polite">${esc(B.status)}</div>
    ${terug ? `<a href="${terug[0]}" class="small">← ${esc(terug[1])}</a>` : ''}
    <div class="card${terug ? ' mt8' : ''}"><h2>${esc(titel)}</h2>${sub ? `<div class="small muted mt4">${sub}</div>` : ''}</div>`;
}
function vtTekst(t){ return `${nf(t.beslist)} van ${nf(t.n)} beslist${t.wacht ? ' · ' + nf(t.wacht) + ' wachten op Picqer' : ''}`; }
function tegelHtml(s, t){
  if(!t.n) return '';
  if(!t.werk) return `<a class="lk-af" href="#/locaties/punt/${s.k}"><span><b>✓</b> ${esc(s.t)}</span><span>${nf(t.n)} klaar</span></a>`;
  return `<div class="lk-tegel${!t.open ? ' af' : ''}"><span class="n">${nf(t.open)}</span><span class="t">${esc(s.t)}</span><span class="u">${esc(s.u)}</span>
    <span class="v">${esc(vtTekst(t))}</span><a class="lk-knop pri" href="#/locaties/punt/${s.k}">Doorlopen</a></div>`;
}
function gangStats(){
  const per = {};
  Object.values(D.LOC).forEach(L => {
    const i = WHL.locInfo(L.naam); if(!i.std) return;
    const g = per[i.gang] = per[i.gang] || { gang:i.gang, hal:i.hal, pick:0, bulk:0, pickLeeg:0, bulkLeeg:0, tijdPick:0, secs:new Set(), producten:0, n:0, na:0 };
    g.n++; g.secs.add(i.sec);
    if(L.bulk){ g.bulk++; if(!L.codes.length) g.bulkLeeg++; } else { g.pick++; if(!L.codes.length) g.pickLeeg++; if(L.tijd) g.tijdPick++; }
    g.producten += L.codes.length;
    if(nagelopen(L.naam)) g.na++;
  });
  return Object.values(per).sort((a, b) => a.gang.localeCompare(b.gang));
}
function zoekHtml(q){
  q = (q || '').trim(); if(q.length < 2) return '';
  const Q = q.toUpperCase();
  const L = Object.values(D.LOC).filter(l => l.naam.toUpperCase().includes(Q)).sort((a, b) => sortLoc(a.naam, b.naam)).slice(0, 12);
  const pc = D.PLOW[q.toLowerCase()];
  const link = n => { const i = WHL.locInfo(n); return i.std ? `#/locaties/${i.gang}/${hoogte(n)}?l=${encodeURIComponent(n)}` : '#/locaties'; };
  let h = '';
  if(pc) h += `<div class="mt8"><span class="code">${esc(pc)}</span> ${esc(kortN(pc))}: ${(perProduct()[pc] || []).sort(sortLoc).map(n => `<a class="loc" href="${link(n)}">${esc(n)}</a>`).join(', ') || 'geen locatie'}</div>`;
  h += L.map(l => `<div class="mt4"><a class="loc" href="${link(l.naam)}">${esc(l.naam)}</a> <span class="desc">${l.bulk ? 'bulk' : 'pick'} · ${l.tijd ? 'tijdelijk' : 'vast'}${l.codes.length ? ' · ' + esc(l.codes.slice(0, 4).join(', ')) + (l.codes.length > 4 ? ' +' + (l.codes.length - 4) : '') : ''}</span></div>`).join('');
  return h || '<div class="small muted mt8">Niets gevonden.</div>';
}
function controleBanner(){
  // imports na de laatste export: nog niet te controleren; telt alleen wat Picqer nog niet laat zien
  const kd = koppelDatum(), ld = D.LOCDATUM;
  const open = (B.d.imports || []).filter(i => i.soort === 'ontkoppelen' ? !kd || kd <= i.op : !ld || ld <= i.op);
  const namen = new Set(), kop = new Set();
  open.forEach(i => {
    (i.namen || []).forEach(n => { if(['import', 'beslist'].includes(locStatus(n))) namen.add(n); });
    (i.koppel || []).forEach(([n, c]) => { if(['import', 'beslist'].includes(kopStatus(n, c))) kop.add(n + '|' + c); });
  });
  const n = namen.size + kop.size; if(!n) return '';
  const laatst = open[open.length - 1];
  return `<div class="card" style="border-left:5px solid #e0a100"><b>${open.length === 1 ? 'Import' : nf(open.length) + ' imports'} sinds de laatste export, nog niet gecontroleerd (laatste ${esc(dtTxt(laatst.op))}).</b>
    <div class="small muted mt4">Lees een verse export in; dan ziet de app of Picqer de import heeft verwerkt. Nog niet zichtbaar in Picqer: ${nf(namen.size)} locaties, ${nf(kop.size)} ontkoppelingen.</div>
    <div class="mt8"><a class="lk-knop pri" href="#/locaties/import">Verse export inlezen</a></div></div>`;
}
function viewOverzicht(){
  const T = telling();
  const perHal = {};
  gangStats().forEach(g => (perHal[g.hal] = perHal[g.hal] || []).push(g));
  const vrLive = window.WHAL && WHAL.S.st && WHAL.S.st.bijgewerkt;
  return `${kopBalk(null, 'Locaties', `${nf(Object.keys(D.LOC).length)} locaties · ${nf(Object.keys(D.LOC).filter(n => WHL.locInfo(n).std).length)} met standaardnaam · tik een tegel om door te lopen of een gang om af te lopen`)}
    <div class="card"><div class="small muted">Locaties (pick/bulk, vast/tijdelijk): <b>${D.LOCBRON === 'picqer-live' ? 'live uit Picqer' : 'locatie-export'}</b> ${esc(dtTxt(D.LOCDATUM))} (${esc(leeftijd(D.LOCDATUM))}) · productkoppelingen: export ${esc(dtTxt(koppelDatum()))} · voorraad per locatie: export ${esc(dtTxt(D.VRDATUM))}${vrLive ? ', live stand ' + esc(dtTxt(vrLive)) : ''}</div>
      <div class="lk-zoek mt8"><input id="lk-q" type="search" data-lk="q" placeholder="zoek locatie of productcode" aria-label="Zoek locatie of productcode" value="${esc(UI.q)}"></div><div id="lk-zoekres">${zoekHtml(UI.q)}</div></div>
    ${controleBanner()}
    <h3 class="mt12 mb8">Aandachtspunten</h3>
    <div class="lk-tegels">${SOORTEN.map(s => tegelHtml(s, T.per[s.k])).join('')}</div>
    ${SOORTEN.every(s => !T.per[s.k].n) ? '<div class="card empty">Geen aandachtspunten in de locaties.</div>' : ''}
    <div class="row wrap mt12"><a class="lk-knop" href="#/locaties/import">Naar import (alle besluiten)</a><a class="lk-knop" href="#/stelling">Stellingen</a></div>
    ${Object.entries(perHal).map(([h, gs]) => `<div class="card mt12"><h3>${esc(WHL.HAL_NAAM[h] || 'Hal ' + h)}</h3><div class="scroll mt8"><table>
      <tr><th>Gang</th><th class="n">Nagelopen</th><th class="n">Pick</th><th class="n hide-m">zonder product</th><th class="n">Bulk</th><th class="n hide-m">zonder product</th><th>Let op</th></tr>
      ${gs.map(g => `<tr><td><a class="code" href="#/locaties/${g.gang}" style="display:inline-flex;align-items:center;min-height:36px">${g.gang}</a> <span class="desc">${g.secs.size} secties</span></td><td class="n"><b>${nf(g.na)} / ${nf(g.n)}</b></td><td class="n">${nf(g.pick)}</td><td class="n hide-m">${nf(g.pickLeeg)}</td><td class="n">${nf(g.bulk)}</td><td class="n hide-m">${nf(g.bulkLeeg)}</td>
        <td>${g.tijdPick ? `<span class="badge b-warn">${g.tijdPick} pick tijdelijk</span>` : ''}</td></tr>`).join('')}</table></div></div>`).join('')}`;
}

// knoppen voor een keuze; aan = gekozen, vs = voorstel
const keusKnop = (attr, t, aan, vs, uit, groen) => `<button class="lk-k${aan ? ' aan' : ''}${aan && groen ? ' groen' : ''}${vs && !aan ? ' vs' : ''}" ${attr} aria-pressed="${aan ? 'true' : 'false'}" ${uit ? 'disabled' : ''}>${esc(t)}${vs ? '<small>voorstel</small>' : ''}</button>`;
const stHtml = st => ST_TXT[st] ? `<span class="lk-st${telt[st] === 'wacht' ? ' wacht' : ''}">${esc(ST_TXT[st])}</span>` : '';
const bulkTijd = (b, t) => (b ? 'bulk' : 'pick') + ' · ' + (t ? 'tijdelijk' : 'vast');
const prodKort = naam => { const c = codesVan(naam); return c.length ? c.slice(0, 3).map(x => `<span class="code">${esc(x)}</span> ${esc(kort(naamP(x), 28))}`).join('<br>') + (c.length > 3 ? `<div class="desc">+${c.length - 3} meer</div>` : '') : '<span class="desc">geen product</span>'; };
const vrHier = naam => { const c = codesVan(naam); if(!c.length) return ''; const n = c.reduce((s, x) => s + hier(x, naam).n, 0); return `voorraad hier ${nf(n)}`; };

function rijLoc(s, x){
  const L = D.LOC[x.naam] || {}, b = B.d.loc[x.naam], info = problemen().info[x.naam];
  const twijfel = WHL.TWIJFEL.has(x.naam);
  const reg = regelVan(x.naam);
  const doel = s.k === 'regel' ? (reg || {}) : s.a.v;
  const gekA = b && !b.uitz && b.bulk !== undefined && Object.keys(doel).every(k => !!b[k] === !!doel[k]);
  const gekB = b && b.uitz;
  const klaar = telt[x.st] === 'klaar';
  const nu = s.k === 'regel' ? `nu ${bulkTijd(L.bulk, L.tijd)}${reg ? ' · regel: ' + bulkTijd(reg.bulk, reg.tijd) : ''}` : vrHier(x.naam);
  return `<div class="lk-rij${klaar ? ' klaar' : ''}" data-rij="${esc(x.id)}"><div><span class="loc">${esc(x.naam)}</span>${twijfel ? ' <span class="badge b-warn">twijfel</span>' : ''}${L.excl ? ' <span class="badge b-grey">exclusief</span>' : ''} ${stHtml(x.st)}</div>
    <div class="lk-wat">${s.k === 'regel' ? `<span>${esc(nu)}</span><span class="desc">${codesVan(x.naam).length ? esc(codesVan(x.naam).length + ' product(en) · ' + vrHier(x.naam)) : 'geen product'}</span>` : `<span>${prodKort(x.naam)}</span><span class="desc">${esc(nu)}</span>`}</div>
    <div class="lk-keus">${keusKnop(`data-lk="loc-a" data-s="${s.k}" data-n="${esc(x.naam)}"`, s.a.t, gekA, !twijfel, x.st === 'weg', true)}${keusKnop(`data-lk="loc-b" data-s="${s.k}" data-n="${esc(x.naam)}"`, s.b.t, gekB, false, x.st === 'weg')}</div></div>`;
}
function rijKop(s, x){
  const h = hier(x.code, x.naam), g = gekozen(x.naam, x.code), klaar = telt[x.st] === 'klaar';
  const zonder = problemen().info[x.naam];
  const ookZonder = s.k === 'dubbel' && zonder ? codesVan(zonder).includes(x.code) : null;
  const magWeg = h.n <= 0 && (s.k !== 'dubbel' || ookZonder) && x.st !== 'weg';
  const andere = (perProduct()[x.code] || []).filter(l => l !== x.naam).sort(sortLoc);
  const waarom = h.n > 0 ? 'eerst verplaatsen in Picqer' : s.k === 'dubbel' && !ookZonder ? 'staat nog niet op ' + zonder : '';
  const z = zelfVan(x.naam, x.code);
  if(s.k === 'veel') return `<div class="lk-rij${klaar ? ' klaar' : ''}"><div><span class="code">${esc(x.code)}</span> ${stHtml(x.st)}</div>
      <div class="lk-wat"><span>${esc(kortN(x.code))}</span><span class="desc">voorraad hier <b>${nf(h.n)}</b>${h.n <= 0 ? ' · voorstel: weg' : ''}${waarom ? ' · ' + esc(waarom) : ''}</span></div>
      <div class="lk-keus">${keusKnop(`data-lk="kop" data-k="ok" data-s="${s.k}" data-n="${esc(x.naam)}" data-c="${esc(x.code)}"`, 'Hoort hier', g === 'ok', h.n > 0, x.st === 'weg', true)}${keusKnop(`data-lk="kop" data-k="weg" data-s="${s.k}" data-n="${esc(x.naam)}" data-c="${esc(x.code)}"`, 'Weg', g === 'weg', h.n <= 0, !magWeg && g !== 'weg')}</div></div>`;
  return `<div class="lk-rij${klaar ? ' klaar' : ''}"><div><span class="loc">${esc(x.naam)}</span> ${stHtml(x.st)}<div><span class="code">${esc(x.code)}</span></div></div>
    <div class="lk-wat"><span>${esc(kortN(x.code))}</span><span class="desc">voorraad hier <b>${nf(h.n)}</b>${s.k === 'dubbel' ? ` · op ${esc(zonder || '?')}: <b>${ookZonder ? 'ja' : 'nee'}</b>` : ` · andere locaties: ${andere.length ? esc(andere.slice(0, 4).join(', ')) + (andere.length > 4 ? ' +' + (andere.length - 4) : '') : '<b>geen</b>'}`}</span>
      ${waarom && g !== 'weg' ? `<span class="desc">Ontkoppelen kan niet: ${esc(waarom)}</span>` : ''}${z ? `<span class="desc">Zelf doen: ${esc(z.wat)}</span>` : ''}</div>
    <div class="lk-keus">${keusKnop(`data-lk="kop" data-k="weg" data-s="${s.k}" data-n="${esc(x.naam)}" data-c="${esc(x.code)}"`, 'Ontkoppelen', g === 'weg', magWeg, !magWeg && g !== 'weg', true)}${keusKnop(`data-lk="kop" data-k="zelf" data-s="${s.k}" data-n="${esc(x.naam)}" data-c="${esc(x.code)}"`, 'Zelf doen in Picqer', g === 'zelf', !magWeg, x.st === 'weg')}</div></div>`;
}
function rijGeen(x){
  const klaar = telt[x.st] === 'klaar';
  return `<div class="lk-rij${klaar ? ' klaar' : ''}"><div><span class="code">${esc(x.code)}</span> ${stHtml(x.st)}${x.krap ? ' <span class="badge b-warn">plank leeg of krap</span>' : ''}<div class="desc">${esc(kortN(x.code))}</div></div>
    <div class="lk-wat"><span>zonder locatie <b>${nf(x.n)}</b>${x.plank !== undefined ? ' · op de plank ' + nf(x.plank) : ''}</span><span class="desc">pick: ${x.pick.length ? esc(x.pick.join(', ')) : '<b>geen picklocatie</b>'} · bulk: ${x.bulk.length ? esc(x.bulk.slice(0, 4).join(', ')) : 'geen'}</span>${x.opnieuw ? '<span class="desc lk-afw">na tellen nog steeds zonder locatie in de nieuwste export</span>' : ''}</div>
    <div class="lk-keus">${keusKnop(`data-lk="geteld" data-c="${esc(x.code)}" data-v="${x.n}"`, 'Geteld en weggezet', x.st === 'klaar' && !!B.d.geteld[x.code], true, !x.n && !B.d.geteld[x.code], true)}</div></div>`;
}
function rijKar(x){
  const klaar = telt[x.st] === 'klaar';
  const pick = (perProduct()[x.code] || []).filter(l => D.LOC[l] && !D.LOC[l].bulk && !isKar(l) && !isMap(l)).sort(sortLoc);
  return `<div class="lk-rij${klaar ? ' klaar' : ''}"><div><span class="loc">${esc(x.kar)}</span> ${stHtml(x.st)}<div><span class="code">${esc(x.code)}</span></div></div>
    <div class="lk-wat"><span>${esc(kortN(x.code))}</span><span class="desc">op de kar <b>${nf(x.n)}</b> (${x.bron}) · terug naar: ${pick.length ? esc(pick.join(', ')) : 'geen picklocatie'}</span></div>
    <div class="lk-keus">${keusKnop(`data-lk="kar" data-id="${esc(x.id)}" data-v="${x.n}"`, 'Teruggezet', x.st === 'klaar', true, false, true)}</div></div>`;
}
function viewPunt(k){
  const s = SOORT[k]; if(!s) return viewOverzicht();
  const r = regels(k), t = tel(k);
  const MAX = 400;
  const body = r.length ? r.slice(0, MAX).map(x => s.soort === 'loc' ? rijLoc(s, x) : s.soort === 'koppel' ? rijKop(s, x) : s.soort === 'geen' ? rijGeen(x) : rijKar(x)).join('') : '<div class="empty">Niets in deze lijst.</div>';
  const kanImport = s.soort === 'loc' || s.soort === 'koppel';
  const uitz = s.soort === 'loc' ? Object.entries(B.d.loc).filter(([n, x]) => x.uitz && x.soort === k).map(([n]) => n).sort(sortLoc) : [];
  return `${kopBalk(['#/locaties', 'Locaties'], s.t, `${esc(s.probleem)} ${esc(s.picqer)}`)}
    <div class="card"><div class="row wrap between"><b>${esc(vtTekst(t))}</b><span class="small muted">${esc(voorraadTxt())}</span></div>
      ${s.k === 'geen' ? '<div class="small muted mt4">Eerst producten met een picklocatie en een lege of krappe plank, daarna de rest.</div>' : ''}
      <div class="mt8">${body}</div>${r.length > MAX ? `<div class="small muted mt8">Eerste ${MAX} van ${nf(r.length)}; wat klaar is verdwijnt.</div>` : ''}
      ${uitz.length ? `<details class="mt12"><summary>Uitzonderingen, laten zo (${nf(uitz.length)})</summary>${uitz.map(n => `<div class="lk-rij"><div><span class="loc">${esc(n)}</span></div><div class="lk-wat"><span class="desc">${esc(bulkTijd(D.LOC[n] && D.LOC[n].bulk, D.LOC[n] && D.LOC[n].tijd))} · beslist ${esc(dtTxt(B.d.loc[n].op))}</span></div><div class="lk-keus"><button class="lk-k" data-lk="loc-b" data-s="${k}" data-n="${esc(n)}">Terugzetten</button></div></div>`).join('')}</details>` : ''}
      ${kanImport ? `<div class="row wrap mt12"><a class="lk-knop pri" href="#/locaties/import?punt=${k}">Naar import</a></div>` : ''}</div>`;
}

/* ---------- gang en hoogte ---------- */
function locsGang(gang){ return Object.values(D.LOC).map(L => Object.assign({ L }, WHL.locInfo(L.naam))).filter(i => i.std && i.gang === gang); }
function hoogteKnoppen(gang, hh){
  const lg = locsGang(gang);
  const hs = [...new Set(lg.map(i => i.h))].sort((a, b) => a - b);
  return `<nav class="lk-hoogtes" aria-label="Hoogtes">${hs.map(h => { const p = String(h).padStart(2, '0'), n = lg.filter(i => i.h === h), na = n.filter(i => nagelopen(i.naam)).length;
    return `<a href="#/locaties/${gang}/${p}" class="${hh === p ? 'aan' : ''}" aria-current="${hh === p ? 'page' : 'false'}">${p}<small>${na}/${n.length}</small></a>`; }).join('')}<a href="#/locaties/${gang}" class="${!hh ? 'aan' : ''}">Alles</a></nav>`;
}
function viewGang(gang){
  const lg = locsGang(gang);
  if(!lg.length) return `${kopBalk(['#/locaties', 'Locaties'], 'Gang ' + gang, 'Geen locaties met deze gang.')}`;
  const secs = [...new Set(lg.map(i => i.sec))].sort((a, b) => a - b), pls = [...new Set(lg.map(i => i.pl))].sort(), hs = [...new Set(lg.map(i => i.h))].sort((a, b) => b - a);
  const idx = {}; lg.forEach(i => idx[i.sec + i.pl + i.h] = i);
  let grid = `<div class="rek" style="grid-template-columns:34px repeat(${secs.length * pls.length},22px)"><div></div>`;
  secs.forEach(s => grid += `<div class="hd" style="grid-column:span ${pls.length}">${String(s).padStart(2, '0')}</div>`);
  hs.forEach(h => {
    grid += `<div class="hl"><a href="#/locaties/${gang}/${String(h).padStart(2, '0')}">${String(h).padStart(2, '0')}</a></div>`;
    secs.forEach(s => pls.forEach(pl => {
      const i = idx[s + pl + h];
      if(!i){ grid += '<div class="c x"></div>'; return; }
      const cls = (i.L.bulk ? 'bk' : 'pk') + (i.L.codes.length ? ' f' : '') + (!i.L.bulk && i.L.tijd ? ' t' : '');
      grid += `<a class="c ${cls}" href="#/locaties/${gang}/${String(h).padStart(2, '0')}?l=${encodeURIComponent(i.naam)}" title="${esc(i.naam)}${i.L.codes.length ? ': ' + i.L.codes.length + ' product(en)' : ''}${nagelopen(i.naam) ? ' · nagelopen' : ''}" style="text-decoration:none;color:inherit">${nagelopen(i.naam) ? '✓' : i.L.codes.length > 1 ? i.L.codes.length : pl}</a>`;
    }));
  });
  grid += '</div>';
  const na = lg.filter(i => nagelopen(i.naam)).length;
  return `${kopBalk(['#/locaties', 'Locaties'], 'Gang ' + gang, `${nf(na)} van ${nf(lg.length)} nagelopen · kies een hoogte om de gang af te lopen`)}
    <div class="card">${hoogteKnoppen(gang, '')}
      <div class="legend mt12"><span><i style="background:var(--pick)"></i>pick bezet</span><span><i style="background:#c8ecd7"></i>pick zonder product</span><span><i style="background:var(--bulk)"></i>bulk bezet</span><span><i style="background:#d4e2f8"></i>bulk zonder product</span><span><i style="background:#fff;box-shadow:inset 0 0 0 2px #e0a100"></i>pick tijdelijk</span><span>✓ nagelopen</span></div>
      <div class="small muted mt4">Kolommen = sectie en plaats (A–D), rijen = hoogte. Tik een vak of een hoogte.</div>
      <div class="rekwrap mt12">${grid}</div>
      <div class="row wrap mt12"><a class="lk-knop pri" href="#/locaties/import?gang=${gang}">Naar import voor gang ${esc(gang)}</a><a class="lk-knop" href="#/stelling">Stellingen</a></div></div>`;
}
function kaartLoc(i){
  const L = i.L, naam = i.naam, b = B.d.loc[naam] || {}, reg = regelVan(naam);
  const gw = { bulk:b.bulk !== undefined ? !!b.bulk : !!L.bulk, tijd:b.tijd !== undefined ? !!b.tijd : !!L.tijd };
  const bevestigd = b.bulk !== undefined || b.uitz;
  const afw = reg && (reg.bulk !== !!L.bulk || reg.tijd !== !!L.tijd);
  const codes = codesVan(naam), na = nagelopen(naam);
  const z = (B.d.zelf || []).filter(x => x.naam === naam && x.wat === 'koppelen');
  return `<section class="lk-kaart${na ? ' na' : ''}${UI.focus === naam ? ' focus' : ''}" id="lk-${esc(naam)}" data-loc="${esc(naam)}" tabindex="-1">
    <div class="lk-kop"><div><span class="loc">${esc(naam)}</span> ${(() => { const st = locStatus(naam); const gelijk = b.basis && b.bulk !== undefined && !!b.basis.bulk === !!b.bulk && !!b.basis.tijd === !!b.tijd; return st === 'verwerkt' && gelijk ? '<span class="lk-st">✓ klopt</span>' : stHtml(st === 'open' ? '' : st); })()}</div>
      <div class="small">nu: <b>${esc(bulkTijd(L.bulk, L.tijd))}</b> · ${codes.length === 0 ? 'geen product' : codes.length === 1 ? 'één product' : codes.length + ' producten'}${L.excl ? ' · exclusief' : ''}${reg ? ` · <span class="${afw ? 'lk-afw' : 'muted'}">regel: ${esc(bulkTijd(reg.bulk, reg.tijd))}</span>` : ''}</div></div>
    <div class="row wrap" style="gap:12px"><div class="lk-keus" role="group" aria-label="Bulk ${esc(naam)}"><span class="small" style="min-width:58px"><b>Bulk</b></span>${keusKnop(`data-lk="g-bulk" data-n="${esc(naam)}" data-v="1"`, 'ja', bevestigd && gw.bulk, reg && reg.bulk, false)}${keusKnop(`data-lk="g-bulk" data-n="${esc(naam)}" data-v="0"`, 'nee', bevestigd && !gw.bulk, reg && !reg.bulk, false)}</div>
      <div class="lk-keus" role="group" aria-label="Tijdelijk ${esc(naam)}"><span class="small" style="min-width:58px"><b>Tijdelijk</b></span>${keusKnop(`data-lk="g-tijd" data-n="${esc(naam)}" data-v="1"`, 'ja', bevestigd && gw.tijd, reg && reg.tijd, false)}${keusKnop(`data-lk="g-tijd" data-n="${esc(naam)}" data-v="0"`, 'nee', bevestigd && !gw.tijd, reg && !reg.tijd, false)}</div>
      ${!bevestigd ? `<button class="lk-k" data-lk="g-klopt" data-n="${esc(naam)}">Instelling klopt</button>` : ''}</div>
    ${codes.map(c => { const h = hier(c, naam), g = gekozen(naam, c); return `<div class="lk-prod"><div><span class="code">${esc(c)}</span> ${esc(kortN(c))} <span class="desc">· voorraad hier <b>${nf(h.n)}</b></span>${h.n > 0 && g !== 'weg' ? '' : ''}</div>
      <div class="lk-keus">${keusKnop(`data-lk="kop" data-k="ok" data-s="gang" data-n="${esc(naam)}" data-c="${esc(c)}"`, '✓ juist', g === 'ok', false, false, true)}${keusKnop(`data-lk="kop" data-k="weg" data-s="gang" data-n="${esc(naam)}" data-c="${esc(c)}"`, h.n > 0 && g !== 'weg' ? 'weg (eerst verplaatsen)' : 'weg', g === 'weg', false, h.n > 0 && g !== 'weg')}</div></div>`; }).join('')}
    ${z.map(x => `<div class="small">Zelf koppelen in Picqer: <span class="code">${esc(x.code)}</span> <button class="btn sm ghost" data-lk="zelf-weg" data-n="${esc(naam)}" data-c="${esc(x.code)}" aria-label="Notitie ${esc(x.code)} weghalen">×</button></div>`).join('')}
    <div class="row wrap"><input class="lk-mist" data-lk-mist="${esc(naam)}" placeholder="Product ontbreekt? Code" aria-label="Productcode die op ${esc(naam)} ontbreekt"><button class="lk-k" data-lk="mist" data-n="${esc(naam)}">Zelf koppelen in Picqer</button>
      <span class="grow"></span>${na ? (b.nagelopen ? `<button class="lk-k aan groen" data-lk="na" data-n="${esc(naam)}" aria-pressed="true">Nagelopen ✓</button>` : '<span class="lk-st">Nagelopen ✓</span>') : `<button class="lk-k" data-lk="na" data-n="${esc(naam)}" aria-pressed="false">Nagelopen</button>`}</div></section>`;
}
function viewHoogte(gang, hh){
  const alle = locsGang(gang).filter(i => String(i.h).padStart(2, '0') === hh).sort((a, b) => a.sec - b.sec || a.pl.localeCompare(b.pl));
  const afwijkend = i => { const r = regelVan(i.naam); return r && (r.bulk !== !!i.L.bulk || r.tijd !== !!i.L.tijd); };
  const lijst = alle.filter(i => (!UI.alleenProd || i.L.codes.length) && (!UI.alleenAfw || afwijkend(i)));
  const na = alle.filter(i => nagelopen(i.naam)).length;
  return `${kopBalk(['#/locaties/' + gang, 'Gang ' + gang], 'Gang ' + gang + ' · hoogte ' + hh, `<b id="lk-vg">${esc(gang)} · ${esc(hh)} · ${nf(na)} van ${nf(alle.length)}</b> nagelopen · ${esc(voorraadTxt())}`)}
    <div class="card">${hoogteKnoppen(gang, hh)}
      <div class="lk-filter mt8"><label><input type="checkbox" data-lk="f-prod" ${UI.alleenProd ? 'checked' : ''}> alleen met product</label><label><input type="checkbox" data-lk="f-afw" ${UI.alleenAfw ? 'checked' : ''}> alleen afwijkend</label>
        <button class="lk-knop pri" data-lk="volgende">Volgende niet nagelopen</button></div></div>
    ${lijst.map(kaartLoc).join('') || '<div class="card empty">Geen locaties met dit filter.</div>'}
    <div class="row wrap mt12"><a class="lk-knop pri" href="#/locaties/import?gang=${gang}">Naar import voor gang ${esc(gang)}</a><a class="lk-knop" href="#/stelling">Stellingen</a></div>`;
}

/* ---------- import: verse export → vergelijken → bestanden ---------- */
// de besluiten in de selectie die een wijziging in Picqer vragen
function selectie(q){
  const d = B.d, uit = { loc:[], koppel:[], zelf:[] };
  const inSel = (naam, soort) => q.gang ? WHL.locInfo(naam).gang === q.gang : q.punt ? soort === q.punt : true;
  Object.entries(d.loc).forEach(([naam, b]) => {
    if(b.uitz || b.bulk === undefined || b.tijd === undefined) return;
    if(!inSel(naam, b.soort)) return;
    if(b.basis && !!b.basis.bulk === !!b.bulk && !!b.basis.tijd === !!b.tijd) return;   // bevestiging, geen wijziging
    uit.loc.push({ naam, b });
  });
  Object.entries(d.koppel).forEach(([naam, k]) => (k.weg || []).forEach(w => { if(inSel(naam, w.soort)) uit.koppel.push({ naam, code:w.code, w }); }));
  d.zelf.forEach(z => { if(inSel(z.naam, z.soort)) uit.zelf.push(z); });
  return uit;
}
const laatsteOp = sel => sel.loc.map(x => x.b.op).concat(sel.koppel.map(x => x.w.op), sel.zelf.map(z => z.op)).reduce((m, x) => x > m ? x : m, '');
function maakVers(){
  const loc = {}, per = {};
  Object.values(D.LOC).forEach(L => { const codes = (L.codes || []).map(cc); loc[L.naam] = { bulk:!!L.bulk, tijd:!!L.tijd, codes }; codes.forEach(c => (per[c] = per[c] || []).push(L.naam)); });
  Object.values(per).forEach(a => a.sort(sortLoc));
  return { loc, per, vr:JSON.parse(JSON.stringify(D.VR || {})), locDatum:koppelDatum(), bulkDatum:D.LOCDATUM, vrDatum:D.VRDATUM, op:nuIso() };
}
function versheid(sel){
  const laatst = laatsteOp(sel), kd = koppelDatum(), vd = D.VRDATUM, m = [];
  if(!kd) m.push('Geen locatie-export met productkoppelingen ingelezen.');
  else { if(uurOud(kd) > OUD_UUR) m.push('Locatie-export is ' + leeftijd(kd) + ' (' + dtTxt(kd) + '); maximaal ' + OUD_UUR + ' uur.'); if(laatst && kd < laatst) m.push('Locatie-export (' + dtTxt(kd) + ') is ouder dan je laatste besluit (' + dtTxt(laatst) + ').'); }
  if(!vd) m.push('Geen voorraad-per-locatie-export ingelezen.');
  else { if(uurOud(vd) > OUD_UUR) m.push('Voorraad-export is ' + leeftijd(vd) + ' (' + dtTxt(vd) + '); maximaal ' + OUD_UUR + ' uur.'); if(laatst && vd < laatst) m.push('Voorraad-export (' + dtTxt(vd) + ') is ouder dan je laatste besluit (' + dtTxt(laatst) + ').'); }
  return m;
}
// voorraad in de verse export (en de live stand als die nog nieuwer is)
function versHier(V, code, loc){
  const v = V.vr[code]; let n = v ? (isKar(loc) ? (v.cont || {})[loc] : (v.locs || {})[loc]) || 0 : 0;
  const p = window.WHAL && WHAL.S.st && WHAL.S.st.p && WHAL.S.st.p[code];
  if(p && p.t && V.vrDatum && new Date(String(p.t).replace(' ', 'T')) > new Date(V.vrDatum)){ const l = (p.l || []).find(x => x[0] === loc); if(l && l[4] > n) n = l[4]; }
  return n;
}
function inBackorder(code){
  if((D.BO || []).some(r => cc(r.productcode) === code)) return true;
  try{ const L = window.WHLIVE && WHLIVE.status(); const id = pqId(code); if(L && L.data && id) return L.data.backorders.some(b => String(b.p) === String(id)); }catch(e){}
  return false;
}
const isAB = c => ['A', 'B'].includes((D.P[c] || {}).abc) || (window.WHAL && WHAL.S.cat && ['A', 'B'].includes((WHAL.S.cat.abc || {})[c]));
const isPickV = (V, l) => V.loc[l] && !V.loc[l].bulk && !isKar(l) && !isMap(l);
function vergelijk(sel, V){
  const rijen = [];
  sel.loc.forEach(({ naam, b }) => {
    const L = V.loc[naam], id = 'L|' + naam, wat = L ? bulkTijd(L.bulk, L.tijd) + ' → ' + bulkTijd(b.bulk, b.tijd) : bulkTijd(b.bulk, b.tijd);
    const r = { id, soort:'loc', naam, b, wat, red:[] };
    if(!L){ r.bak = 'niet'; r.red.push('De locatie bestaat niet meer in Picqer.'); return rijen.push(r); }
    if(L.bulk === !!b.bulk && L.tijd === !!b.tijd){ r.bak = 'niet'; r.verwerkt = true; r.red.push('Picqer heeft al de gewenste stand. ✓ verwerkt'); return uurOud(b.op) < 24 * 30 ? rijen.push(r) : null; }
    const codes = L.codes;
    const toen = (b.basis && b.basis.codes) || [];
    if(toen.length !== codes.length || toen.some(c => !codes.includes(c))) r.red.push('Producten veranderd sinds je besluit: toen ' + (toen.join(', ') || 'geen') + ' ↔ nu ' + (codes.join(', ') || 'geen') + '.');
    const naarBulk = !L.bulk && b.bulk, naarTijd = !b.bulk && b.tijd && !L.tijd;
    if(naarBulk){
      const vrN = codes.reduce((s, c) => s + versHier(V, c, naam), 0);
      if(vrN > 0) r.red.push('Pick wordt bulk terwijl hier ' + nf(vrN) + ' voorraad ligt: orders kunnen in backorder blijven hangen.');
      codes.forEach(c => { if(!(V.per[c] || []).some(l => l !== naam && isPickV(V, l))) r.red.push(c + ': dit is de enige picklocatie; na bulk heeft het product geen pick meer.'); });
    }
    if(naarTijd && codes.length) r.red.push('Picklocatie wordt tijdelijk terwijl er ' + (codes.length === 1 ? 'een product' : codes.length + ' producten') + ' op staan: Picqer ontkoppelt bij voorraad 0.');
    if(naarBulk || naarTijd) codes.forEach(c => { if(inBackorder(c)) r.red.push(c + ' staat in backorder.'); if(isAB(c)) r.red.push(c + ' is een A/B-loper.'); });
    if(inImport(naam, null, b.op)) r.noot = 'zat al in een eerdere import';
    r.bak = r.red.length ? 'let' : 'ok';
    rijen.push(r);
  });
  sel.koppel.forEach(({ naam, code, w }) => {
    const L = V.loc[naam], id = 'K|' + naam + '|' + code;
    const r = { id, soort:'koppel', naam, code, w, wat:code + ' ontkoppelen van ' + naam, red:[] };
    if(!L){ r.bak = 'niet'; r.red.push('De locatie bestaat niet meer in Picqer.'); return rijen.push(r); }
    if(!L.codes.includes(code)){ r.bak = 'niet'; r.verwerkt = true; r.red.push('Het product staat al niet meer op deze locatie. ✓ verwerkt'); return uurOud(w.op) < 24 * 30 ? rijen.push(r) : null; }
    const n = versHier(V, code, naam);
    if(n > 0){ r.bak = 'niet'; r.red.push('Er ligt nu ' + nf(n) + ' voorraad op deze locatie: eerst verplaatsen in Picqer.'); return rijen.push(r); }
    const rest = (V.per[code] || []).filter(l => l !== naam);
    if(!rest.length) r.red.push('Het product verliest zijn laatste locatie in het Hoofdmagazijn.');
    else if(isPickV(V, naam) && !rest.some(l => isPickV(V, l))) r.red.push('Het product verliest zijn laatste picklocatie.');
    if(rest.some(isKar)) r.red.push('Het product staat ook op een retourkar: de import kan dan mislopen; eerst van de kar af.');
    if(inBackorder(code)) r.red.push(code + ' staat in backorder.');
    if(isAB(code)) r.red.push(code + ' is een A/B-loper.');
    if(inImport(naam, code, w.op)) r.noot = 'zat al in een eerdere import';
    r.bak = r.red.length ? 'let' : 'ok';
    rijen.push(r);
  });
  return rijen;
}
const meeGaan = (R, keuze) => R.filter(r => r.bak === 'ok' || (r.bak === 'let' && keuze[r.id] === 'mee'));
function bestanden(R, keuze, V){
  const mee = meeGaan(R, keuze);
  const locRijen = mee.filter(r => r.soort === 'loc').sort((a, b) => sortLoc(a.naam, b.naam)).map(r => ({ r, rij:[r.naam, !!r.b.tijd, !!r.b.bulk] }));
  const weg = {};
  mee.filter(r => r.soort === 'koppel').forEach(r => (weg[r.code] = weg[r.code] || []).push(r));
  const kopRijen = Object.keys(weg).sort().map(code => {
    const af = new Set(weg[code].map(r => r.naam));
    const lijst = (V.per[code] || []).filter(l => !af.has(l));
    return { code, rs:weg[code], rij:[pqCode(code), lijst.join(', ')], van:(V.per[code] || []).join(', '), naar:lijst.join(', ') };
  });
  return { locRijen, kopRijen };
}
function label(q){ return q.gang ? 'gang ' + q.gang : q.punt && SOORT[q.punt] ? SOORT[q.punt].kort : 'alles'; }
function downloaden(soort, rijen, q, test){
  const V = UI.imp.vers;
  const n = rijen.length; if(!n) return;
  const datum = vandaag();
  const bestand = 'Picqer import ' + soort + ' ' + label(q) + (test ? ' test' : '') + ' ' + datum + ' (' + n + ').xlsx';
  if(soort === 'locaties') WH.excel(['Naam', 'Tijdelijke locatie', 'Bulklocatie'], rijen.map(x => x.rij), bestand);
  else WH.excel(['Productcode', 'Voorraadlocatie Hoofdmagazijn'], rijen.map(x => x.rij), bestand);
  const imp = { op:nuIso(), soort, nLoc:soort === 'locaties' ? n : 0, nKoppel:soort === 'ontkoppelen' ? rijen.reduce((s, x) => s + x.rs.length, 0) : 0, bestand, exportVan:{ loc:V.locDatum, vr:V.vrDatum }, filter:q.gang ? { gang:q.gang } : q.punt ? { punt:q.punt } : {},
    namen:soort === 'locaties' ? rijen.map(x => x.r.naam) : [], koppel:soort === 'ontkoppelen' ? rijen.flatMap(x => x.rs.map(r => [r.naam, r.code])) : [], test:!!test };
  B.d.imports.push(imp); B.pend.imports.push(imp); wijzig();
}
const STAPPEN_EXPORT = `<ol class="lk-ol">
  <li><b>Locatie-export:</b> Picqer → Instellingen → Locaties → Import/Export → Exporteren, magazijn <b>Hoofdmagazijn</b>.</li>
  <li><b>Voorraad per locatie:</b> Picqer → Producten → Voorraad (per locatie) → Exporteren, magazijn <b>Hoofdmagazijn</b> (bestand "stock-…xlsx").</li>
  <li>Sleep beide bestanden hieronder in (of tik om te kiezen).</li></ol>`;
function viewImport(q){
  const sel = selectie(q), sleutel = JSON.stringify(q);
  if(UI.imp.sleutel !== sleutel){ UI.imp = { sleutel, vers:null, keuze:{}, bericht:'', vorige:null }; }
  const titel = 'Import · ' + label(q);
  const terug = q.gang ? ['#/locaties/' + q.gang, 'Gang ' + q.gang] : q.punt ? ['#/locaties/punt/' + q.punt, SOORT[q.punt] ? SOORT[q.punt].t : 'Terug'] : ['#/locaties', 'Locaties'];
  const nBesl = sel.loc.length + sel.koppel.length;
  const fris = versheid(sel);
  const V = UI.imp.vers;
  let h = `${kopBalk(terug, titel, `${nf(sel.loc.length)} locatie-besluiten en ${nf(sel.koppel.length)} ontkoppelingen in deze selectie${sel.zelf.length ? ' · ' + nf(sel.zelf.length) + ' zelf doen in Picqer' : ''}. Een import doet alleen: bulk ja/nee, tijdelijk ja/nee, ontkoppelen zonder voorraad. Altijd op een verse export.`)}`;
  // stap 1
  h += `<div class="card"><div class="lk-stap"><span class="nr">1</span><h3>Verse export inlezen</h3></div>
    <div class="mt8">${STAPPEN_EXPORT}</div>
    <label class="lk-drop mt8" id="lk-drop"><input type="file" id="lk-files" multiple accept=".xlsx,.xls,.csv" hidden><b>Bestanden kiezen of hierheen slepen</b><div class="small muted mt4">locatie-export en voorraad per locatie</div></label>
    <div id="lk-impst" class="status"></div>
    <div class="small mt8">Nu in de app: koppelingen ${esc(dtTxt(koppelDatum()))} (${esc(leeftijd(koppelDatum()))}) · voorraad ${esc(dtTxt(D.VRDATUM))} (${esc(leeftijd(D.VRDATUM))})</div>
    ${fris.length ? `<div class="status err mt8">${fris.map(esc).join('<br>')}<br>Lees eerst een verse export in; daarna gaat het verder.</div>`
      : V ? `<div class="status ok mt8">Verse export gebruikt: koppelingen ${esc(dtTxt(V.locDatum))}, voorraad ${esc(dtTxt(V.vrDatum))}.</div>`
      : `<div class="status ok mt8">De exports in de app zijn vers genoeg (niet ouder dan ${OUD_UUR} uur en nieuwer dan je laatste besluit).</div><div class="mt8"><button class="lk-knop pri" data-lk="imp-gebruik">Vergelijk met deze export</button></div>`}</div>`;
  if(!nBesl && !sel.zelf.length){ h += '<div class="card empty">Nog geen besluiten in deze selectie. Beslis eerst in de tabellen of in een gang.</div>'; return h; }
  if(!V || fris.length){ h += `<div class="card lk-stap dicht"><span class="nr">2</span><h3>Vergelijken en risico's</h3></div><div class="card lk-stap dicht"><span class="nr">3</span><h3>Import maken</h3></div>`; return h; }
  // stap 2
  const R = vergelijk(sel, V), K = UI.imp.keuze;
  const bak = b => R.filter(r => r.bak === b);
  const letOpen = bak('let').filter(r => !K[r.id]).length;
  const rij = r => `<div class="lk-rij"><div><span class="loc">${esc(r.naam)}</span>${r.code ? `<div><span class="code">${esc(r.code)}</span></div>` : ''}</div>
    <div class="lk-wat"><span>${esc(r.wat)}</span>${r.red.map(x => `<span class="desc">${esc(x)}</span>`).join('')}${r.noot ? `<span class="desc">${esc(r.noot)}</span>` : ''}</div>
    <div class="lk-keus">${r.bak === 'let' ? keusKnop(`data-lk="imp-k" data-id="${esc(r.id)}" data-v="mee"`, 'Toch meenemen', K[r.id] === 'mee', false, false, true) + keusKnop(`data-lk="imp-k" data-id="${esc(r.id)}" data-v="over"`, 'Overslaan', K[r.id] === 'over', false, false) : r.verwerkt ? '<span class="lk-st">✓ verwerkt</span>' : ''}</div></div>`;
  h += `<div class="card"><div class="lk-stap"><span class="nr">2</span><h3>Vergelijken en risico's</h3></div>
    <div class="mt8" style="font-size:16px"><b>${nf(bak('ok').length)} klopt · ${nf(bak('let').length)} let op · ${nf(bak('niet').length)} gaat niet</b></div>
    <div class="small muted mt4">Vergeleken met de export van ${esc(dtTxt(V.locDatum))} (koppelingen) en ${esc(dtTxt(V.vrDatum))} (voorraad).</div>
    ${bak('let').length ? `<div class="lk-bak let mt12"><h3>Let op, jij beslist (${nf(bak('let').length)})</h3>${bak('let').map(rij).join('')}</div>` : ''}
    ${bak('ok').length ? `<details class="lk-bak ok mt12"${bak('ok').length <= 20 ? ' open' : ''}><summary>Klopt, gaat mee (${nf(bak('ok').length)})</summary>${bak('ok').map(rij).join('')}</details>` : ''}
    ${bak('niet').length ? `<details class="lk-bak niet mt12"><summary>Gaat niet mee (${nf(bak('niet').length)})</summary>${bak('niet').map(rij).join('')}</details>` : ''}</div>`;
  // stap 3
  const F = bestanden(R, K, V);
  const eerste = s => !(B.d.imports || []).some(i => i.soort === s && !i.test);
  const klaar3 = !letOpen;
  h += `<div class="card${klaar3 ? '' : ' lk-stap dicht'}"><div class="lk-stap"><span class="nr">3</span><h3>Import maken</h3></div>
    ${!klaar3 ? `<div class="small mt8">Kies eerst bij elke "let op"-regel: Toch meenemen of Overslaan (nog ${nf(letOpen)}).</div>` : `
    <div class="small muted mt8">De bestanden komen uitsluitend uit de verse export. Alleen wat echt verandert.</div>
    <h3 class="mt12">Locaties (${nf(F.locRijen.length)})</h3>
    ${F.locRijen.length ? `<div class="scroll mt4"><table class="lk-tabel"><tr><th>Naam</th><th>Nu</th><th>Wordt</th></tr>${F.locRijen.map(x => `<tr><td class="loc">${esc(x.r.naam)}</td><td>${esc(bulkTijd(V.loc[x.r.naam].bulk, V.loc[x.r.naam].tijd))}</td><td><b>${esc(bulkTijd(x.r.b.bulk, x.r.b.tijd))}</b></td></tr>`).join('')}</table></div>
      <ol class="lk-ol mt8"><li>Picqer → Instellingen → Locaties → Import/Export → <b>Importeren</b>.</li><li>Kies het bestand; kolommen Naam, Tijdelijke locatie, Bulklocatie.</li><li>Daarna hier een verse locatie-export inlezen om te controleren.</li></ol>
      ${eerste('locaties') ? '<div class="status mt8" style="background:#fff1dc">Eerste keer: eerst het testbestand met 2 regels uploaden en in Picqer controleren.</div>' : ''}
      <div class="row wrap mt8"><button class="lk-knop" data-lk="imp-dl" data-s="locaties" data-t="1" ${F.locRijen.length ? '' : 'disabled'}>Testbestand met 2 regels</button><button class="lk-knop pri" data-lk="imp-dl" data-s="locaties">Download locaties (${nf(F.locRijen.length)})</button></div>` : '<div class="small muted">Geen locaties die veranderen.</div>'}
    <h3 class="mt16">Ontkoppelen (${nf(F.kopRijen.length)} producten)</h3>
    ${F.kopRijen.length ? `<div class="scroll mt4"><table class="lk-tabel"><tr><th>Productcode</th><th>Nu (verse export)</th><th>Wordt</th></tr>${F.kopRijen.map(x => `<tr><td class="code">${esc(x.rij[0])}</td><td class="small">${esc(x.van)}</td><td class="small"><b>${esc(x.naar || '(geen locatie)')}</b></td></tr>`).join('')}</table></div>
      <ol class="lk-ol mt8"><li>Picqer → Producten → <b>Importeren</b> → alleen <b>bestaande producten bijwerken</b>.</li><li>Kolom Voorraadlocatie Hoofdmagazijn = de volledige lijst die overblijft.</li><li><b>Onbekend</b> of Picqer deze lijst vervangt of aanvult: eerst testen met 2 producten. Werkt vervangen niet, gebruik dan de links hieronder.</li></ol>
      ${eerste('ontkoppelen') ? '<div class="status mt8" style="background:#fff1dc">Eerste keer: eerst het testbestand met 2 producten uploaden en in Picqer controleren of de koppeling weg is.</div>' : ''}
      <div class="row wrap mt8"><button class="lk-knop" data-lk="imp-dl" data-s="ontkoppelen" data-t="1">Testbestand met 2 regels</button><button class="lk-knop pri" data-lk="imp-dl" data-s="ontkoppelen">Download ontkoppelen (${nf(F.kopRijen.length)})</button></div>
      <div class="small mt8">Per product in Picqer: ${F.kopRijen.map(x => pqLink(x.code)).join(' · ')}</div>` : '<div class="small muted">Geen ontkoppelingen.</div>'}`}
    </div>`;
  // zelf doen
  const zelf = sel.zelf.filter(z => ['zelf'].includes(kopStatus(z.naam, z.code))).concat(R.filter(r => r.bak === 'niet' && !r.verwerkt && r.code).map(r => ({ naam:r.naam, code:r.code, wat:r.red[0] })));
  h += `<div class="card"><h3>Zelf doen in Picqer (${nf(zelf.length)})</h3><div class="small muted mt4">Wat een import niet mag: koppelen, verhuizen, voorraad verplaatsen, archiveren.</div>
    ${zelf.length ? `<div class="scroll mt8"><table class="lk-tabel"><tr><th>Locatie</th><th>Product</th><th>Wat</th></tr>${zelf.map(z => `<tr><td class="loc">${esc(z.naam)}</td><td>${pqLink(z.code)}</td><td class="small">${esc(z.wat)}</td></tr>`).join('')}</table></div>` : '<div class="small muted mt8">Niets.</div>'}</div>`;
  return h;
}

/* ---------- tekenen, klikken ---------- */
function teken(){
  const a = app(); if(!a || !/^#\/locaties/.test(location.hash || '')) return;
  const y = window.scrollY, act = document.activeElement, actId = act && act.id, pos = act && act.selectionStart;
  const { delen, q } = HUIDIG;
  let h;
  try{
    if(!Object.keys(D.LOC).length) h = '<div class="card empty">Lees eerst de locatie-export in bij <a href="#/gegevens">Gegevens</a> (Picqer → Instellingen → Locaties → Import/Export → Exporteren).</div>';
    else if(!B.d) h = '<div class="card empty">Besluiten laden…</div>';
    else if(delen[0] === 'punt') h = viewPunt(delen[1]);
    else if(delen[0] === 'import') h = viewImport(q);
    else if(delen[0] && delen[1]) h = viewHoogte(delen[0].toUpperCase(), delen[1]);
    else if(delen[0]) h = viewGang(delen[0].toUpperCase());
    else h = viewOverzicht();
  }catch(e){ console.error(e); h = `<div class="card"><h2>Er ging iets mis op dit scherm</h2><pre class="mono mt8">${esc(e.stack || e.message)}</pre></div>`; }
  a.innerHTML = h;
  window.scrollTo(0, y);
  if(actId && $(actId)){ const e = $(actId); e.focus(); try{ if(pos != null) e.setSelectionRange(pos, pos); }catch(x){} }
  koppelDrop();
}
function koppelDrop(){
  const inp = $('lk-files'), drop = $('lk-drop'); if(!inp || !drop) return;
  const lees = files => {
    if(!window.WHV || !WHV.inlezen) return toast('Inlezen kan hier niet');
    UI.imp.vers = null;
    WHV.inlezen(files, { statusId:'lk-impst', na:() => {
      const st = $('lk-impst') ? $('lk-impst').innerHTML : '';
      const sel = selectie(HUIDIG.q), fris = versheid(sel);
      if(!fris.length) UI.imp.vers = maakVers();
      teken();
      const s2 = $('lk-impst'); if(s2 && st) s2.innerHTML = st;
    } });
  };
  inp.onchange = () => { if(inp.files.length) lees([...inp.files]); inp.value = ''; };
  ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', ev => { const f = [...(ev.dataTransfer.files || [])]; if(f.length) lees(f); });
}
async function view(delen, q){
  stijl();
  HUIDIG = { delen:delen || [], q:q || {} };
  UI.focus = q && q.l ? q.l : null;
  teken();
  const voor = B.d ? JSON.stringify(B.d) : '';
  const wacht = [];
  if(window.WHAL && !WHAL.S.geladen) wacht.push(WHAL.laadOpslag());
  if(!B.vuil) wacht.push(laad(true));
  await Promise.all(wacht.map(p => p.catch(e => console.error(e))));
  if(!B.d || JSON.stringify(B.d) !== voor || !voor) teken();
  if(UI.focus){ const el = $('lk-' + UI.focus); if(el){ el.scrollIntoView({ block:'start' }); el.focus({ preventScroll:true }); } }
}
function klik(ev){
  const b = ev.target.closest && ev.target.closest('[data-lk]'); if(!b || !B.d || !/^#\/locaties/.test(location.hash || '')) return;
  const k = b.dataset.lk, n = b.dataset.n, c = b.dataset.c, s = b.dataset.s;
  if(['q', 'f-prod', 'f-afw'].includes(k)) return;
  if(k === 'loc-a'){
    const S = SOORT[s], cur = B.d.loc[n];
    const doel = s === 'regel' ? regelVan(n) : S.a.v;
    if(!doel) return;
    const al = cur && !cur.uitz && cur.bulk !== undefined && Object.keys(doel).every(x => !!cur[x] === !!doel[x]);
    if(al) wisLoc(n); else zetLoc(n, Object.assign({}, doel), s);
  }
  else if(k === 'loc-b'){ const cur = B.d.loc[n]; if(cur && cur.uitz) wisLoc(n); else zetLoc(n, { uitz:true }, s); }
  else if(k === 'kop'){ const nu = gekozen(n, c); zetKop(n, c, nu === b.dataset.k ? null : b.dataset.k, s); if(s === 'gang') naNagelopen(n); }
  else if(k === 'geteld'){ if(B.d.geteld[c] && (!D.VRDATUM || B.d.geteld[c].op >= D.VRDATUM)) delete B.d.geteld[c]; else B.d.geteld[c] = { op:nuIso(), n:+b.dataset.v || 0 }; B.pend.geteld.add(c); wijzig(); }
  else if(k === 'kar'){ const id = b.dataset.id; if(B.d.kar[id] && (!D.VRDATUM || B.d.kar[id].op >= D.VRDATUM)) delete B.d.kar[id]; else B.d.kar[id] = { op:nuIso(), n:+b.dataset.v || 0 }; B.pend.kar.add(id); wijzig(); }
  else if(k === 'g-bulk' || k === 'g-tijd'){ zetLoc(n, { [k === 'g-bulk' ? 'bulk' : 'tijd']:b.dataset.v === '1' }, 'gang'); naNagelopen(n); }
  else if(k === 'g-klopt'){ const L = D.LOC[n]; zetLoc(n, { bulk:!!L.bulk, tijd:!!L.tijd }, 'gang'); naNagelopen(n); }
  else if(k === 'na'){ const cur = B.d.loc[n] || {}; if(cur.nagelopen){ const r = Object.assign({}, cur); delete r.nagelopen; r.op = nuIso(); if(Object.keys(r).filter(x => !['op', 'soort', 'basis'].includes(x)).length) B.d.loc[n] = r; else delete B.d.loc[n]; B.pend.loc.add(n); wijzig(); } else { B.d.loc[n] = Object.assign({}, cur, { nagelopen:true, op:cur.op || nuIso(), soort:cur.soort || 'gang' }); B.pend.loc.add(n); wijzig(); } }
  else if(k === 'mist'){
    const i = document.querySelector(`[data-lk-mist="${CSS.escape(n)}"]`); const code = cc(i ? i.value : '');
    if(!code) return toast('Vul de productcode in');
    if(!D.P[code]) toast('Let op: ' + code + ' staat niet in de productexport');
    zetKop(n, code, 'zelf', 'gang', 'koppelen'); toast(code + ': zelf koppelen in Picqer (op het Zelf doen-lijstje)');
  }
  else if(k === 'zelf-weg'){ zetKop(n, c, null, 'gang'); }
  else if(k === 'volgende'){
    const kaarten = [...document.querySelectorAll('.lk-kaart')];
    const vanaf = kaarten.findIndex(e => e.getBoundingClientRect().top > 70);
    const v = kaarten.slice(Math.max(0, vanaf)).concat(kaarten).find(e => !e.classList.contains('na') && e.getBoundingClientRect().top > 70) || kaarten.find(e => !e.classList.contains('na'));
    if(v){ v.scrollIntoView({ behavior:'smooth', block:'start' }); v.focus({ preventScroll:true }); } else toast('Alles op deze hoogte is nagelopen');
    return;
  }
  else if(k === 'imp-gebruik'){ UI.imp.vers = maakVers(); }
  else if(k === 'imp-k'){ UI.imp.keuze[b.dataset.id] = UI.imp.keuze[b.dataset.id] === b.dataset.v ? undefined : b.dataset.v; }
  else if(k === 'imp-dl'){
    const V = UI.imp.vers; if(!V) return;
    const R = vergelijk(selectie(HUIDIG.q), V), F = bestanden(R, UI.imp.keuze, V);
    let rijen = s === 'locaties' ? F.locRijen : F.kopRijen;
    if(b.dataset.t) rijen = rijen.slice(0, 2);
    downloaden(s, rijen, HUIDIG.q, !!b.dataset.t);
  }
  else return;
  teken();
}
function naNagelopen(){ /* nagelopen wordt bij het tekenen vanzelf berekend */ }
document.addEventListener('click', klik);
document.addEventListener('change', ev => {
  const e = ev.target; if(!e.dataset || !/^f-/.test(e.dataset.lk || '')) return;
  if(e.dataset.lk === 'f-prod') UI.alleenProd = e.checked; else UI.alleenAfw = e.checked;
  teken();
});
document.addEventListener('input', ev => {
  const e = ev.target; if(!e.dataset || e.dataset.lk !== 'q') return;
  UI.q = e.value; clearTimeout(UI.qt); UI.qt = setTimeout(() => { const r = $('lk-zoekres'); if(r) r.innerHTML = zoekHtml(UI.q); }, 200);
});
document.addEventListener('keydown', ev => { const e = ev.target; if(ev.key === 'Enter' && e.dataset && e.dataset.lkMist !== undefined){ ev.preventDefault(); const k = document.querySelector(`[data-lk="mist"][data-n="${CSS.escape(e.dataset.lkMist)}"]`); if(k) k.click(); } });
// bij verlaten van de pagina: nog niet opgeslagen besluiten direct bewaren
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden' && B.vuil) bewaar(); });
window.addEventListener('pagehide', () => { if(B.vuil) bewaar(); });
// in 3.0: de telling bijwerken zodra de besluiten binnen zijn
B.luister.push(() => { try{ if(window.WHTAAK && WHTAAK.herteken && window.IVOL) WHTAAK.herteken(); if(window.WHX && WHX.herteken) WHX.herteken(); }catch(e){} });

return { view, laad, telling, regels, tel, problemen, SOORTEN, SOORT, locStatus, kopStatus, nagelopen, gangStats, selectie, vergelijk, maakVers, versheid, bestanden, hier, B, UI, opNieuw:f => B.luister.push(f), bewaar };
})();
