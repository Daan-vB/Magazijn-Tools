/* =====================================================================
   IVOL Warehouse 3.0 — nulpunt (10-10-2026)
   Eén ingang voor alles wat in vier weken is gebouwd. Eén menu, ingedeeld op het fundament:
   aanvuladvies → locaties → producten → inkomend. Rollen: Daan (alles), Karin (administratie), Vloer (Kate, Salah).
   De onderdelen zelf zijn de bestaande pagina's (Warehouse, Test, Containers, Junior, Palletlabels …),
   hier in één schil. Vanaf hier wordt elk onderdeel één voor één naar de gedeelde modules overgezet.
   Startpagina "Fundament": de stand van de vier fundamentpunten, uit de echte gegevens.
   ===================================================================== */
window.IVOL = (function(){
'use strict';
const { $, esc, nf, D, vandaag, isoDag } = WH;

/* ---------- alle onderdelen: één lijst, waaruit menu en kaart worden gemaakt ---------- */
const W = h => './warehouse.html' + h, T = h => './test.html' + h, CP = h => './containerplanning.html' + h, CPT = h => './containerplanning.html?test' + h;
const DV = ['daan'], DK = ['daan', 'karin'], ALLE = ['daan', 'karin', 'vloer'];
const GROEPEN = [
  { k:'start', t:'Start' },
  { k:'vandaag', t:'Vandaag' },
  { k:'aanvul', t:'1 · Aanvuladvies', f:1 },
  { k:'loc', t:'2 · Locaties', f:2 },
  { k:'prod', t:'3 · Producten', f:3 },
  { k:'inkomend', t:'4 · Inkomend', f:4 },
  { k:'labels', t:'Labels' },
  { k:'vloer', t:'Vloer' },
  { k:'geg', t:'Gegevens' },
  { k:'park', t:'Geparkeerd' }
];
const M = [
  { id:'fundament', g:'start', t:'Fundament', native:'fundament', st:'draait', r:DK, uit:'Stand van de vier fundamentpunten, uit de echte gegevens.' },
  { id:'kaart', g:'start', t:'Kaart van alles', native:'kaart', st:'draait', r:DV, uit:'Elk onderdeel, waar het staat, welke gegevens, en de status.' },

  { id:'vandaag', g:'vandaag', t:'Vandaag', u:W('#/'), st:'draait', r:DK, data:'wh-taken, wh-todo, Picqer live', uit:'De dag in stappen, taken, leeftijd van de exports.' },
  { id:'live', g:'vandaag', t:'Picqer live', u:T('#/live'), st:'proef', r:DV, data:'functie picqer', uit:'Picklijsten en backorders rechtstreeks uit Picqer.' },
  { id:'planning', g:'vandaag', t:'Planning', u:T('#/planning'), st:'proef', r:DV, data:'wh-taken', uit:'Cijfers per dag en wat nog van Daan nodig is.' },

  { id:'aanvullen', g:'aanvul', t:'Aanvullen', u:W('#/aanvullen'), st:'draait', r:DK, data:'backorders, wh-advies', uit:'Nu verplaatsen, Aanvulronde, Niet nu, Van VST.' },
  { id:'aanvullive', g:'aanvul', t:'Live advies', u:T('#/aanvullive'), st:'proef', r:DV, data:'wh-pq-cat, wh-pickstand', uit:'Het advies zelf uitgerekend uit Picqer, zonder PDF.' },
  { id:'vergelijk', g:'aanvul', t:'Live naast PDF', u:T('#/aanvullive/vergelijk'), st:'proef', r:DV, data:'wh-advies', uit:'De ene taak: klopt het live advies met de PDF van Picqer?' },
  { id:'backorders', g:'aanvul', t:'Backorders', u:T('#/backorders'), st:'proef', r:DV, data:'backorders, wh-bo-vorige', uit:'Vorige export naast nu: opgelost, nog open, nieuw.' },

  { id:'locaties', g:'loc', t:'Locaties', u:T('#/locaties'), st:'proef', r:DV, data:'wh-locaties', uit:'Stellingkaart per gang, aandachtspunten, locatie-import.' },
  { id:'stelling', g:'loc', t:'Stellingen', u:T('#/stelling'), st:'proef', r:DV, data:'wh-stellingen', uit:'Maten per stelling en ligger.' },
  { id:'triage', g:'loc', t:'Triage', u:T('#/triage'), st:'proef', r:DV, data:'wh-triage', uit:'Per product: belangrijk, medium, zelden, weg.' },

  { id:'abcheck', g:'prod', t:'A/B-check', u:T('#/abcheck'), st:'proef', r:DV, data:'producten, wh-pq, wh-aanvul', uit:'Lopers stap voor stap op orde: picklocatie, vast, niveaus.' },
  { id:'base', g:'prod', t:'Niveaus', u:T('#/base'), st:'proef', r:DV, data:'wh-aanvul', uit:'Aanvulbase: picklocatie, aanvullen onder, vul aan tot.' },
  { id:'invul', g:'prod', t:'Invullen', u:T('#/invul'), st:'proef', r:DV, data:'wh-aanvul, catalog-ean', uit:'Op de telefoon, één product per scherm.' },
  { id:'productdata', g:'prod', t:'Productdata', u:T('#/productdata'), st:'proef', r:DV, data:'producten, catalog-ean', uit:'Afdelingen doorlopen, automatisch invullen, importeren.' },
  { id:'soorten', g:'prod', t:'Soorten', u:T('#/productdata/soort'), st:'proef', r:DV, data:'opslag', uit:'1 pallet · 2 deel · 3 mix · 4 pick.' },
  { id:'productkaart', g:'prod', t:'Productkaart', u:'./productkaart.html', st:'draait', r:DK, data:'catalog-ean, producten', uit:'Alles over één product.' },
  { id:'cp-producten', g:'prod', t:'Producten per leverancier', u:CPT('#/producten'), st:'proef', r:DV, data:'pakbon_alias, producten', uit:'Palletgegevens en koppelingen per leverancier.' },
  { id:'vloernamen', g:'prod', t:'Vloernamen', u:CPT('#/vloernamen'), st:'proef', r:DV, data:'catalog-ean', uit:'Namen zoals de vloer ze kent.' },

  { id:'containers', g:'inkomend', t:'Containers', u:CP('#/'), st:'draait', r:DK, data:'containers, pakbon_alias, Storage pakbonnen', uit:'Pakbon, verdeling, losdag-PDF, palletlabels, Stockmove, VST-mail.' },
  { id:'vooruit', g:'inkomend', t:'Vooruit', u:CPT('#/vooruit'), st:'proef', r:DV, data:'containers', uit:'Per week wat er komt en hoeveel plaatsen nodig zijn.' },
  { id:'containerdag', g:'inkomend', t:'Containerdag', u:T('#/containerdag'), st:'proef', r:DV, data:'wh-taken', uit:'Liggers vrijmaken, plekken per pallet, geplaatst.' },
  { id:'controle', g:'inkomend', t:'Controle', u:T('#/controle'), st:'proef', r:DV, data:'functie picqer: verplaatsingen', uit:'Na het verplaatsen: klopt het per product?' },
  { id:'wie', g:'inkomend', t:'Wie deed wat', u:T('#/wie'), st:'proef', r:DV, data:'wh-verplaatsingen', uit:'Verplaatsingen per persoon uit Picqer.' },
  { id:'ruimte', g:'inkomend', t:'Ruimte', u:T('#/ruimte'), st:'proef', r:DV, data:'containers, wh-locaties', uit:'Plaatsen nodig tegenover vrije bulk.' },
  { id:'leveringen', g:'inkomend', t:'Ontvangsten Europees', u:T('#/leveringen'), st:'proef', r:DV, data:'wh-leveringen, functie picqer: keten', uit:'Europese leveranciers: klopt, direct weg, labels, waar heen, controle.' },
  { id:'ontvangsten', g:'inkomend', t:'Ontvangsten uit Picqer', u:T('#/ontvangsten'), st:'proef', r:DV, data:'functie picqer', uit:'Ruwe lijst ontvangsten.' },

  { id:'labels', g:'labels', t:'Palletlabels', u:'./index.html', st:'draait', r:ALLE, data:'catalog-ean', uit:'Labels printen; het productgeheugen.' },
  { id:'containerlabels', g:'labels', t:'Container / Stockmove-PDF', u:'./container-labels.html', st:'draait', r:ALLE, data:'catalog-ean', uit:'Labels voor een hele container.' },

  { id:'junior', g:'vloer', t:'Junior', u:'./junior.html', st:'draait', r:ALLE, eigenKop:true, data:'zelfde database', uit:'Kate, Salah, rijders: Nu verplaatsen, Aanvulronde, Containers, Handleiding (NL/EN/ES/EL).' },

  { id:'gegevens', g:'geg', t:'Gegevens inladen', u:W('#/gegevens'), st:'draait', r:DK, data:'alle exports', uit:'Picqer-exports inslepen.' },
  { id:'cp-gegevens', g:'geg', t:'Gegevens containers', u:CP('#/gegevens'), st:'draait', r:DK, data:'producten, verkoop, backorders', uit:'Exports en back-up voor containers.' },
  { id:'picqertest', g:'geg', t:'Picqer API-test', u:'./picqer-test.html', st:'naslag', r:DV, data:'Picqer API', uit:'Eerste leestest van de koppeling.' },
  { id:'testdata', g:'geg', t:'Testdata Picqer', u:'./testdata.html', st:'naslag', r:DV, data:'Picqer-testomgeving', uit:'Testgegevens voor de Picqer-testomgeving.' },

  { id:'ploeg', g:'park', t:'Ploeg', u:'./ploeg.html', st:'geparkeerd', r:DV, data:'wh-ploeg', uit:'Takenverdeling per persoon. Pas na fundament 1–3.' }
];
// alleen in de kaart: oude pagina's die niet meer in het menu horen
const OUD = [
  ['artikel-review.html', 'Artikel Review (Van Gennip)', 'oude tool, eigen database'],
  ['invoer.html', 'Productinvoer', 'vervangen door Productdata'],
  ['cleanup-export.html', 'Opschonen & exporteren', 'hoort bij Artikel Review'],
  ['import-catalog-ean.html', 'Eenmalige import productgeheugen', 'eenmalig, gedaan'],
  ['import-eenmalig.html', 'Eenmalige import Artikel Review', 'eenmalig, gedaan'],
  ['triage/', 'Picklocatie-triage (los)', 'vervangen door Triage in de app'],
  ['productkaart (1).html', 'Kopie productkaart', 'dubbel bestand, opruimen'],
  ['productkaart (2).html', 'Kopie productkaart', 'dubbel bestand, opruimen'],
  ['test (1).html', 'Kopie test', 'dubbel bestand, opruimen']
];
const ROLLEN = { daan:'Daan', karin:'Karin', vloer:'Vloer' };
const ST = { draait:['draait', 'ok'], proef:['proef', 'warn'], geparkeerd:['geparkeerd', 'grijs'], naslag:['naslag', 'grijs'] };

/* ---------- staat ---------- */
const ls = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsZet = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
const UI = { rol:ROLLEN[ls('ivol-rol')] ? ls('ivol-rol') : 'daan', menu:false, geladen:false, cache:null };
const zichtbaar = () => M.filter(m => m.r.includes(UI.rol));
const startVan = rol => rol === 'vloer' ? 'junior' : rol === 'karin' ? 'vandaag' : 'fundament';
function huidig(){
  const id = (location.hash.match(/^#\/([\w-]+)/) || [])[1];
  const m = zichtbaar().find(x => x.id === id);
  return m || zichtbaar().find(x => x.id === startVan(UI.rol)) || zichtbaar()[0];
}

/* ---------- menu ---------- */
function tekenMenu(){
  const nu = huidig();
  const lijst = zichtbaar();
  $('menu').innerHTML = GROEPEN.map(g => {
    const items = lijst.filter(m => m.g === g.k); if(!items.length) return '';
    return `<div class="groep"><div class="gt">${esc(g.t)}</div>${items.map(m => `<a href="#/${m.id}" class="${m === nu ? 'aan' : ''}">${esc(m.t)}${UI.rol === 'daan' && m.st !== 'draait' ? ` <i class="st ${ST[m.st][1]}">${ST[m.st][0]}</i>` : ''}</a>`).join('')}</div>`;
  }).join('');
  document.querySelectorAll('#rollen button').forEach(b => b.classList.toggle('aan', b.dataset.rol === UI.rol));
  $('kruimel').textContent = nu ? ((GROEPEN.find(g => g.k === nu.g) || {}).t || '') + ' · ' + nu.t : '';
  const uit = $('nieuwtab');
  if(nu && nu.u){ uit.href = nu.u; uit.hidden = false; } else uit.hidden = true;
}

/* ---------- inhoud ---------- */
let frameUrl = null;
function toon(){
  const m = huidig();
  document.body.classList.toggle('menu-open', false);
  tekenMenu();
  const fr = $('frame'), nat = $('native');
  if(m.native){
    fr.hidden = true; nat.hidden = false;
    nat.innerHTML = m.native === 'kaart' ? viewKaart() : viewFundament();
    nat.scrollTop = 0;
    if(m.native === 'fundament') rekenFundament();
    return;
  }
  nat.hidden = true; fr.hidden = false;
  if(frameUrl !== m.u){ frameUrl = m.u; fr.dataset.eigenKop = m.eigenKop ? '1' : ''; fr.src = m.u; }
}
// de eigen kop van Warehouse, Test en Containers verbergen: het menu staat in de schil
function frameGeladen(){
  const fr = $('frame');
  try{
    const d = fr.contentDocument; if(!d || fr.dataset.eigenKop) return;
    if(!d.getElementById('ivol3-stijl')){
      const s = d.createElement('style'); s.id = 'ivol3-stijl';
      s.textContent = 'header.top,#subnav,.subnav{display:none !important}';
      d.head.appendChild(s);
    }
  }catch(e){ /* andere herkomst: kop blijft staan */ }
}

/* ---------- kaart van alles ---------- */
function viewKaart(){
  const tel = s => M.filter(m => m.st === s).length;
  return `<div class="pagina">
    <h1>Kaart van alles</h1>
    <p class="lede">Alles wat in vier weken is gebouwd, op één plek. ${tel('draait')} onderdelen draaien, ${tel('proef')} zijn proef (alleen voor Daan), ${tel('geparkeerd')} geparkeerd, ${tel('naslag')} naslag. Eén database: Supabase "Palletlabels". Picqer alleen lezen via de functie <code>picqer</code>.</p>
    ${GROEPEN.filter(g => g.k !== 'start').map(g => {
      const items = M.filter(m => m.g === g.k); if(!items.length) return '';
      return `<section class="blok"><h2>${esc(g.t)}</h2><div class="tabel"><table><thead><tr><th>Onderdeel</th><th>Status</th><th>Voor</th><th>Gegevens</th><th>Waar</th></tr></thead><tbody>
        ${items.map(m => `<tr><td><a href="#/${m.id}"><b>${esc(m.t)}</b></a><br><span class="muted">${esc(m.uit)}</span></td><td><i class="st ${ST[m.st][1]}">${ST[m.st][0]}</i></td><td>${m.r.map(r => ROLLEN[r]).join(', ')}</td><td class="code">${esc(m.data || '')}</td><td class="code">${esc((m.u || '').replace('./', ''))}</td></tr>`).join('')}
      </tbody></table></div></section>`;
    }).join('')}
    <section class="blok"><h2>Oud, niet meer in het menu</h2><div class="tabel"><table><thead><tr><th>Bestand</th><th>Wat</th><th>Waarom niet</th></tr></thead><tbody>
      ${OUD.map(([f, t, w]) => `<tr><td class="code">${esc(f)}</td><td>${esc(t)}</td><td class="muted">${esc(w)}</td></tr>`).join('')}
    </tbody></table></div></section>
    <section class="blok"><h2>Gegevens (Supabase "Palletlabels")</h2><div class="tabel"><table><thead><tr><th>Waar</th><th>Wat</th></tr></thead><tbody>
      <tr><td class="code">producten</td><td>Picqer-productexport + palletdata</td></tr>
      <tr><td class="code">catalog-ean</td><td>Productgeheugen: stuks per pallet, labelnaam, EAN (gedeeld met Palletlabels)</td></tr>
      <tr><td class="code">containers · pakbon_alias</td><td>Containers met regels, verdeling, ontvangst; geleerde koppelingen pakbon → Picqer</td></tr>
      <tr><td class="code">backorders · verkoop</td><td>Exports; verkoop per maand = gemiddelde laatste 6 maanden</td></tr>
      <tr><td class="code">wh-locaties · wh-pq · wh-voorraad</td><td>Locatie-export, aanvulniveaus uit Picqer, voorraad per locatie</td></tr>
      <tr><td class="code">wh-advies · wh-pq-cat · wh-pickstand</td><td>Aanvuladvies-PDF; productlijst en pickstand voor het live advies</td></tr>
      <tr><td class="code">wh-aanvul · wh-triage · wh-stellingen</td><td>Bevestigde niveaus en picklocaties; triage; stellingmaten</td></tr>
      <tr><td class="code">wh-taken · wh-todo · wh-leveringen · wh-ploeg</td><td>Afvinken en dagritme; taken; ontvangsten Europees; Ploeg (geparkeerd)</td></tr>
      <tr><td class="code">Storage pakbonnen</td><td>Pakbon, ontvangst en inkoopbestelling per container</td></tr>
    </tbody></table></div></section>
  </div>`;
}

/* ---------- fundament ---------- */
function viewFundament(){
  return `<div class="pagina">
    <h1>Fundament</h1>
    <p class="lede">Eerst moet het systeem kloppen, dan pas mensen en taken. Vier punten, in deze volgorde. Elk getal komt uit de gegevens in de database.</p>
    <section class="taak"><span class="eyebrow">De ene taak</span><h2>Live advies naast de aanvuladvies-PDF leggen</h2>
      <p>Klopt het, dan gaat Live advies naar Warehouse en Junior en vervalt de PDF-export. Klopt het niet, dan schrijven we de verschillen op en lossen we alleen die op.</p>
      <div class="rij"><a class="knop pri" href="#/vergelijk">Live naast PDF openen</a></div></section>
    <div id="fund" class="fund">${UI.cache || `<div class="leeg">Gegevens laden…</div>`}</div>
  </div>`;
}
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const dag2 = iso => { if(!iso) return null; const d = new Date(String(iso).length <= 10 ? iso + 'T12:00:00' : iso); return isNaN(d) ? null : d; };
const oud = iso => { const d = dag2(iso); if(!d) return null; const a = new Date(isoDag(d) + 'T12:00:00'), n = new Date(vandaag() + 'T12:00:00'); return Math.round((n - a) / 864e5); };
const wanneer = iso => { const d = dag2(iso); if(!d) return 'nooit'; const n = oud(iso); return n === 0 ? 'vandaag' : n === 1 ? 'gisteren' : n + ' dagen geleden'; };
function blok(nr, titel, kleur, kern, regels, linkId, linkTxt){
  return `<section class="fblok ${kleur}"><div class="fkop"><span class="fnr">${nr}</span><h2>${esc(titel)}</h2></div>
    <div class="kern">${kern}</div>
    <ul>${regels.map(r => `<li class="${r[2] || ''}"><span>${esc(r[0])}</span><b>${r[1]}</b></li>`).join('')}</ul>
    ${linkId ? `<a class="knop" href="#/${linkId}">${esc(linkTxt)}</a>` : ''}</section>`;
}
async function rekenFundament(){
  if(!UI.geladen){
    UI.geladen = 'bezig';
    await WH.load();
    try{ await WHAL.laadOpslag(); }catch(e){}
    UI.geladen = true;
  }
  if(UI.geladen !== true) return;
  let h = '';
  try{
    // 1 aanvuladvies
    let R = null, V = null;
    try{ if(WHAL.S.st && WHAL.S.st.p){ R = WHAL.ronde(); V = WHAL.vergelijk(R); } }catch(e){ console.error(e); }
    const nPdf = D.ADV && D.ADV.rows ? D.ADV.rows.length : 0;
    const r1 = [
      ['Aanvuladvies-PDF', D.ADV ? `${nf(nPdf)} regels · ${wanneer(D.ADV.ingelezen || D.ADV.datum)}` : 'niet ingelezen', D.ADV && oud(D.ADV.ingelezen || D.ADV.datum) > 1 ? 'let' : ''],
      ['Live advies', R ? `${nf(R.uit.length)} regels · stand ${wanneer(WHAL.S.st.bijgewerkt)}` : 'nog geen stand', R ? '' : 'let']
    ];
    if(V) r1.push(['In beide', nf(V.beide.length)], ['Alleen in de PDF', nf(V.alleenPdf.length), V.alleenPdf.length ? 'let' : ''], ['Alleen live', nf(V.alleenLive.length), V.alleenLive.length ? 'let' : '']);
    const overeen = V ? pct(V.beide.length, V.beide.length + V.alleenPdf.length + V.alleenLive.length) : null;
    h += blok(1, 'Aanvuladvies klopt', V && overeen >= 95 ? 'groen' : 'oranje', V ? `<b>${overeen}%</b> overeenkomst live en PDF` : 'Nog niet te vergelijken: PDF en live stand nodig', r1, 'vergelijk', 'Live naast PDF');

    // 2 locaties
    const LS = WHL.locStats(), A = LS.aand;
    const afw = WHL.locAfwijkingen();
    const nLoc = Object.keys(D.LOC).length;
    const punten = A.tijdPick.length + A.dubbel.length + A.rommel.length + A.opMap.length + afw.length;
    h += blok(2, 'Locaties kloppen', !nLoc ? 'oranje' : punten ? 'oranje' : 'groen', nLoc ? `<b>${nf(punten)}</b> punten om op te ruimen · ${nf(nLoc)} locaties` : 'Locatie-export niet ingelezen', [
      ['Locatie-export', D.LOCDATUM ? wanneer(D.LOCDATUM) : 'niet ingelezen', oud(D.LOCDATUM) > 7 ? 'let' : ''],
      ['Pick of bulk / vast of tijdelijk wijkt af', nf(afw.length), afw.length ? 'let' : ''],
      ['Picklocaties op tijdelijk', nf(A.tijdPick.length), A.tijdPick.length ? 'let' : ''],
      ['Dubbele BA-locaties met producten', nf(A.dubbel.length), A.dubbel.length ? 'let' : ''],
      ['Rommel-locaties met producten', nf(A.rommel.length), A.rommel.length ? 'let' : ''],
      ['Producten op een gang- of niveaumap', nf(A.opMap.length), A.opMap.length ? 'let' : ''],
      ['Bulkplekken met 15+ producten', nf(A.veel.length)]
    ], 'locaties', 'Locaties');

    // 3 producten: lopers
    const C = WHL.bereken();
    const tri = c => window.WHT ? WHT.statusVan(c) : '';
    const lopers = Object.values(C.prof).filter(p => {
      if(p.virt || (D.P[p.code] || {}).actief === false) return false;
      const t = tri(p.code); if(t === 'r' || t === 'x') return false;
      return p.abc === 'A' || p.abc === 'B' || t === 'g' || t === 'o';
    });
    const cnt = { pick:0, tijd:0, niveau:0, meer:0, spp:0, ok:0 };
    lopers.forEach(p => {
      const f = p.final, pi = f.pick ? WHL.locInfo(f.pick) : null, mist = [];
      if(!f.pick || f.type === 'bulk' || f.type === 'los' || (f.nieuwePick && p.status !== 'bevestigd')) mist.push('pick');
      else {
        if(pi && pi.bestaat && pi.tijd) mist.push('tijd');
        if(p.pq.lvl === null || p.pq.tot === null) mist.push('niveau');
        if(p.picks.length > 1) mist.push('meer');
      }
      if(!p.spp) cnt.spp++;
      mist.forEach(k => cnt[k]++);
      if(!mist.length && p.spp) cnt.ok++;
    });
    const nA = lopers.filter(p => p.abc === 'A').length, nB = lopers.filter(p => p.abc === 'B').length;
    h += blok(3, 'Lopers compleet', cnt.ok === lopers.length && lopers.length ? 'groen' : 'oranje', lopers.length ? `<b>${nf(cnt.ok)}</b> van ${nf(lopers.length)} lopers compleet (${pct(cnt.ok, lopers.length)}%)<div class="balk"><i style="width:${pct(cnt.ok, lopers.length)}%"></i></div>` : 'Productexport niet ingelezen', [
      ['Lopers', `${nf(lopers.length)} (${nf(nA)} A, ${nf(nB)} B, rest triage)`],
      ['Zonder vaste picklocatie', nf(cnt.pick), cnt.pick ? 'let' : ''],
      ['Picklocatie op tijdelijk', nf(cnt.tijd), cnt.tijd ? 'let' : ''],
      ['Geen aanvulniveau in Picqer', nf(cnt.niveau), cnt.niveau ? 'let' : ''],
      ['Meerdere picklocaties', nf(cnt.meer)],
      ['Stuks per pallet onbekend', nf(cnt.spp), cnt.spp ? 'let' : '']
    ], 'abcheck', 'A/B-check');

    // 4 inkomend
    const open = (D.CONT || []).filter(c => c.status !== 'afgerond');
    const v = vandaag(), over14 = isoDag(new Date(Date.now() + 14 * 864e5));
    const komend = open.filter(c => c.losdatum && c.losdatum >= v && c.losdatum <= over14);
    const voorbij = open.filter(c => c.losdatum && c.losdatum < v);
    const zonder = open.filter(c => !c.losdatum);
    h += blok(4, 'Elke ontvangst krijgt een plek', voorbij.length ? 'oranje' : 'groen', `<b>${nf(komend.length)}</b> containers in de komende 14 dagen`, [
      ['Open containers', nf(open.length)],
      ['Losdatum voorbij, nog niet afgerond', nf(voorbij.length), voorbij.length ? 'let' : ''],
      ['Zonder losdatum', nf(zonder.length), zonder.length ? 'let' : ''],
      ['Europese ontvangsten', 'proef in Test, bevroren']
    ], 'containers', 'Containers');

    // gegevens: hoe vers
    const boD = (D.BO || []).reduce((m, r) => r.geimporteerd_op && (!m || r.geimporteerd_op > m) ? r.geimporteerd_op : m, null);
    const pD = Object.values(D.P).reduce((m, r) => r.picqer_datum && (!m || r.picqer_datum > m) ? r.picqer_datum : m, null);
    const rij = (t, iso, max) => `<tr><td>${esc(t)}</td><td class="${oud(iso) == null || oud(iso) > max ? 'let' : ''}">${esc(wanneer(iso))}</td><td class="muted">${max === 0 ? 'dagelijks' : max === 1 ? 'dagelijks' : 'elke ' + max + ' dagen'}</td></tr>`;
    h += `<section class="blok vers"><h2>Hoe vers zijn de gegevens</h2><div class="tabel"><table><thead><tr><th>Export</th><th>Laatst</th><th>Ritme</th></tr></thead><tbody>
      ${rij('Backorders', boD, 1)}${rij('Aanvuladvies-PDF', D.ADV && (D.ADV.ingelezen || D.ADV.datum), 1)}${rij('Voorraad per locatie', D.VRDATUM, 1)}${rij('Producten', pD, 7)}${rij('Locaties', D.LOCDATUM, 7)}${rij('Aanvulniveaus (Picqer)', D.PQDATUM, 7)}
      </tbody></table></div><p class="muted klein">Picqer live: ${LIVE() ? 'gekoppeld op dit apparaat' : 'niet gekoppeld op dit apparaat'}. Met de vaste koppeling (gesprek Maxime) vervallen deze exports.</p></section>`;
  }catch(e){ console.error(e); h = `<div class="melding">Rekenen lukte niet: ${esc(e.message)}</div>`; }
  UI.cache = h;
  const el = $('fund'); if(el) el.innerHTML = h;
}
const LIVE = () => { try{ return !!localStorage.getItem('ivol-koppelcode'); }catch(e){ return false; } };

/* ---------- gebeurtenissen ---------- */
window.addEventListener('hashchange', toon);
document.addEventListener('click', ev => {
  const r = ev.target.closest('#rollen button');
  if(r){ UI.rol = r.dataset.rol; lsZet('ivol-rol', UI.rol); location.hash = '#/' + startVan(UI.rol); toon(); return; }
  if(ev.target.closest('#menuknop')){ document.body.classList.toggle('menu-open'); return; }
});
$('frame').addEventListener('load', frameGeladen);
toon();
return { M, GROEPEN, toon };
})();
