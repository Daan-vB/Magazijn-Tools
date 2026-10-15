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
const BOUWPLAN = 'https://claude.ai/artifact/7a3juevLzzxWRtPJY8K2bn';
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
  { id:'todo', g:'start', t:'Te doen', native:'todo', st:'draait', r:DV, uit:'De werkplek: de bouwplanstap van nu, wat vandaag moet en wat later komt. Elke knop opent het scherm waar je het doet.' },
  { id:'bouwplan', g:'start', t:'Bouwplan', native:'bouwplan', st:'draait', r:DV, uit:'De route, stap voor stap: Nu, Route, Visie, Data, Logboek, Parkeerplaats.' },
  { id:'taak', g:'start', t:'Taak', native:'taak', st:'draait', r:DV, verborgen:true, uit:'Eén bouwplanstap: wat nog moet, klaar als, vastleggen, afronden.' },
  { id:'fundament', g:'start', t:'Fundament', native:'fundament', st:'draait', r:DK, uit:'Stand van de vier fundamentpunten, uit de echte gegevens.' },
  { id:'kaart', g:'start', t:'Kaart van alles', native:'kaart', st:'draait', r:DV, uit:'Elk onderdeel, waar het staat, welke gegevens, en de status.' },
  { id:'naslag', g:'start', t:'Naslag', native:'naslag', st:'draait', r:DV, uit:'Alle links, koppelingen, functies, mappen en documenten op één plek.' },

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
  { id:'gelijk', g:'prod', t:'Gelijkzetten', u:T('#/productdata/gelijk'), st:'proef', r:DV, data:'productdata, catalog-ean, producten', uit:'Productdata naar Palletlabels en Containers zetten.' },
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

  { id:'bronnen', g:'geg', t:'Koppeling Picqer', native:'bronnen', st:'draait', r:DV, uit:'Wat live uit Picqer komt, hoe vers, en wat nog een export is.' },
  { id:'gegevens', g:'geg', t:'Gegevens inladen', u:W('#/gegevens'), st:'draait', r:DK, data:'alle exports', uit:'Picqer-exports inslepen.' },
  { id:'cp-gegevens', g:'geg', t:'Gegevens containers', u:CP('#/gegevens'), st:'draait', r:DK, data:'producten, verkoop, backorders', uit:'Exports en back-up voor containers.' },
  { id:'picqertest', g:'geg', t:'Picqer API-test', u:'./picqer-test.html', st:'naslag', r:DV, data:'Picqer API', uit:'Eerste leestest van de koppeling.' },
  { id:'testdata', g:'geg', t:'Testdata Picqer', u:'./testdata.html', st:'naslag', r:DV, data:'Picqer-testomgeving', uit:'Testgegevens voor de Picqer-testomgeving.' },

  { id:'ploeg', g:'park', t:'Ploeg', u:'./ploeg.html', st:'geparkeerd', r:DV, data:'wh-ploeg', uit:'Takenverdeling per persoon. Pas na fundament 1–3.' }
];
// alleen in de kaart: oude pagina's die niet meer in het menu horen
const OUD = [
  ['oud/artikel-review.html', 'Artikel Review (Van Gennip)', 'oude tool, eigen database'],
  ['oud/invoer.html', 'Productinvoer', 'vervangen door Productdata'],
  ['oud/cleanup-export.html', 'Opschonen & exporteren', 'hoort bij Artikel Review'],
  ['oud/import-catalog-ean.html', 'Eenmalige import productgeheugen', 'eenmalig, gedaan'],
  ['oud/import-eenmalig.html', 'Eenmalige import Artikel Review', 'eenmalig, gedaan'],
  ['triage/', 'Picklocatie-triage (los)', 'vervangen door Triage in de app; blijft staan (kan als app op een telefoon staan)'],
  ['oud/productkaart-kopie-1.html', 'Kopie productkaart', 'dubbel bestand (15-10 naar oud/)'],
  ['oud/productkaart-kopie-2.html', 'Kopie productkaart', 'dubbel bestand (15-10 naar oud/)'],
  ['oud/test-kopie.html', 'Kopie test', 'dubbel bestand (15-10 naar oud/)']
];
const ROLLEN = { daan:'Daan', karin:'Karin', vloer:'Vloer' };
const ST = { draait:['draait', 'ok'], proef:['proef', 'warn'], geparkeerd:['geparkeerd', 'grijs'], naslag:['naslag', 'grijs'] };

/* ---------- staat ---------- */
const ls = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsZet = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
const UI = { rol:ROLLEN[ls('ivol-rol')] ? ls('ivol-rol') : 'daan', menu:false, geladen:false, cache:null };
const zichtbaar = () => M.filter(m => m.r.includes(UI.rol));
const inMenu = () => zichtbaar().filter(m => !m.verborgen);
const startVan = rol => rol === 'vloer' ? 'junior' : rol === 'karin' ? 'vandaag' : 'todo';
function huidig(){
  const id = (location.hash.match(/^#\/([\w-]+)/) || [])[1];
  UI.rest = (location.hash.match(/^#\/[\w-]+\/(.+)$/) || [])[1] || '';
  const m = zichtbaar().find(x => x.id === id && !x.ext);
  return m || zichtbaar().find(x => x.id === startVan(UI.rol)) || zichtbaar()[0];
}

/* ---------- menu ---------- */
function tekenMenu(){
  const nu = huidig();
  const lijst = inMenu();
  $('menulijst').innerHTML = GROEPEN.map(g => {
    const items = lijst.filter(m => m.g === g.k); if(!items.length) return '';
    return `<div class="groep"><div class="gt">${esc(g.t)}</div>${items.map(m => `<a href="${m.ext ? esc(m.ext) + '" target="_blank" rel="noopener' : '#/' + m.id}" class="${m === nu ? 'aan' : ''}">${esc(m.t)}${UI.rol === 'daan' && m.st !== 'draait' ? ` <i class="st ${ST[m.st][1]}">${ST[m.st][0]}</i>` : ''}</a>`).join('')}</div>`;
  }).join('');
  document.querySelectorAll('#rollen button').forEach(b => b.classList.toggle('aan', b.dataset.rol === UI.rol));
  $('kruimel').textContent = nu ? ((GROEPEN.find(g => g.k === nu.g) || {}).t || '') + ' · ' + nu.t + (nu.id === 'taak' && UI.rest ? ' ' + decodeURIComponent(UI.rest) : '') : '';
  const uit = $('nieuwtab');
  if(nu && nu.u){ uit.href = nu.u; uit.hidden = false; } else uit.hidden = true;
}

/* ---------- zijmenu: smal schuift het over de inhoud, breed klapt het in (keuze onthouden) ---------- */
const smal = () => window.matchMedia('(max-width:820px)').matches;
const zijOpen = () => smal() ? document.body.classList.contains('menu-open') : !document.body.classList.contains('zij-dicht');
function zetZij(open){
  const b = document.body, was = zijOpen();
  if(smal()) b.classList.toggle('menu-open', open);
  else { b.classList.toggle('zij-dicht', !open); lsZet('ivol-zij', open ? 'open' : 'dicht'); }
  $('menuknop').setAttribute('aria-expanded', String(open));
  if(open && smal()) $('zijdicht').focus();
  else if(!open && was) $('menuknop').focus();
}
const zijAria = () => $('menuknop').setAttribute('aria-expanded', String(zijOpen()));
zijAria();
try{ window.matchMedia('(max-width:820px)').addEventListener('change', zijAria); }catch(e){}

/* ---------- inhoud ---------- */
let frameUrl = null;
function toon(){
  const m = huidig();
  if(document.body.classList.contains('menu-open')) zetZij(false);
  tekenMenu();
  const fr = $('frame'), nat = $('native');
  WHTAAK.balk();
  if(m.native){
    fr.hidden = true; nat.hidden = false;
    if(['todo', 'taak', 'bouwplan'].includes(m.native)){ nat.scrollTop = 0; WHTAAK.render(m.native, UI.rest); nat.scrollTop = 0; }
    else { nat.innerHTML = m.native === 'kaart' ? viewKaart() : m.native === 'bronnen' ? viewBronnen() : m.native === 'naslag' ? viewNaslag() : viewFundament(); nat.scrollTop = 0; }
    if(m.native === 'naslag') laadNaslag();
    if(['fundament', 'todo', 'taak', 'bouwplan'].includes(m.native)) rekenFundament();
    return;
  }
  nat.hidden = true; fr.hidden = false;
  const url = m.u + (UI.rest ? '/' + UI.rest : '');
  // ook opnieuw zetten als het scherm in het iframe intussen ergens anders heen ging (bijv. via een knop uit een taak)
  let nu = null; try{ nu = fr.contentWindow && fr.contentWindow.location.href; }catch(e){}
  if(frameUrl !== url || (nu && nu !== 'about:blank' && nu !== new URL(url, location.href).href)){ frameUrl = url; fr.dataset.eigenKop = m.eigenKop ? '1' : ''; fr.src = url; }
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
      const items = M.filter(m => m.g === g.k && !m.verborgen); if(!items.length) return '';
      return `<section class="blok"><h2>${esc(g.t)}</h2><div class="tabel"><table><thead><tr><th>Onderdeel</th><th>Status</th><th>Voor</th><th>Gegevens</th><th>Waar</th></tr></thead><tbody>
        ${items.map(m => `<tr><td><a href="#/${m.id}"><b>${esc(m.t)}</b></a><br><span class="muted">${esc(m.uit)}</span></td><td><i class="st ${ST[m.st][1]}">${ST[m.st][0]}</i></td><td>${m.r.map(r => ROLLEN[r]).join(', ')}</td><td class="code">${esc(m.data || '')}</td><td class="code">${esc((m.u || '').replace('./', ''))}</td></tr>`).join('')}
      </tbody></table></div></section>`;
    }).join('')}
    <section class="blok"><h2>Oud, niet meer in het menu</h2><div class="tabel"><table><thead><tr><th>Bestand</th><th>Wat</th><th>Waarom niet</th></tr></thead><tbody>
      ${OUD.map(([f, t, w]) => `<tr><td class="code">${esc(f)}</td><td>${esc(t)}</td><td class="muted">${esc(w)}</td></tr>`).join('')}
    </tbody></table></div></section>
    <section class="blok"><h2>Gegevens (Supabase "Palletlabels")</h2><div class="tabel"><table><thead><tr><th>Waar</th><th>Wat</th></tr></thead><tbody>
      <tr><td class="code">producten</td><td>Picqer-productexport + palletdata</td></tr>
      <tr><td class="code">productdata</td><td>Eén kaart per product voor alles wat Picqer niet weet (bouwplan 0.4). De bron in 3.0 en Test; Warehouse en Junior na akkoord</td></tr>
      <tr><td class="code">catalog-ean</td><td>Oud productgeheugen: stuks per pallet, labelnaam, EAN (Palletlabels en Containers lezen dit nog)</td></tr>
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
    <p class="lede">Eerst moet het systeem kloppen, dan pas mensen en taken. Vier punten, in deze volgorde. Elk getal komt uit de gegevens in de database. Wat nu aan de beurt is, zegt het bouwplan (Te doen).</p>
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
  if(!(await geladen())) return;
  let h = '';
  try{
    // 1 aanvuladvies: alleen onverklaarde verschillen tussen live en PDF zijn werk (doel 0)
    let R = null, V = null, U = null;
    try{
      if(WHAL.S.st && WHAL.S.st.p){
        R = WHAL.ronde();
        if(D.ADV && D.ADV.rows){
          const pdf = new Set(D.ADV.rows.map(r => D.PLOW[String(r.code).toLowerCase()] || r.code));
          const live = new Set(R.uit.map(r => r.code));
          V = { beide:[...live].filter(c => pdf.has(c)), alleenPdf:[...pdf].filter(c => !live.has(c)), alleenLive:[...live].filter(c => !pdf.has(c)) };
          U = WHAL.uitleg(R);
        }
      }
    }catch(e){ console.error(e); }
    const nPdf = D.ADV && D.ADV.rows ? D.ADV.rows.length : 0;
    const r1 = [
      ['Aanvuladvies-PDF', D.ADV ? `${nf(nPdf)} regels · ${wanneer(D.ADV.ingelezen || D.ADV.datum)}` : 'niet ingelezen', D.ADV && oud(D.ADV.ingelezen || D.ADV.datum) > 1 ? 'let' : ''],
      ['Live advies', R ? `${nf(R.uit.length)} regels · stand ${wanneer(WHAL.S.st.bijgewerkt)}` : 'nog geen stand', R ? '' : 'let']
    ];
    if(V) r1.push(['In beide', nf(V.beide.length)], ['Verschillen', nf(U ? U.verschillen : V.alleenPdf.length + V.alleenLive.length)], ['Verklaard', nf(U ? U.verklaard : 0)], ['Onverklaard', nf(U ? U.onverklaard : 0), U && U.onverklaard ? 'let' : '']);
    if(U && U.teOud) r1.push(['Zelfde moment', U.teOud, 'let']);
    h += blok(1, 'Aanvuladvies klopt', U && !U.onverklaard && !U.teOud ? 'groen' : 'oranje', U ? `<b>${nf(U.onverklaard)}</b> onverklaarde verschillen live en PDF (doel 0)` : 'Nog niet te vergelijken: PDF en live stand nodig', r1, 'vergelijk', 'Live naast PDF');

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
    const cnt = { pick:0, tijd:0, niveau:0, meer:0, spp:0, ok:0, pickPd:0, nivPd:0, bewust:0 };
    lopers.forEach(p => {
      const f = p.final, pi = f.pick ? WHL.locInfo(f.pick) : null, mist = [];
      const geenPick = !f.pick || f.type === 'bulk' || f.type === 'los' || (f.nieuwePick && p.status !== 'bevestigd');
      if(geenPick && p.pdPick === 'nee' && !p.picks.length) cnt.bewust++;          // Productdata: bewust alleen bulk
      else if(geenPick){ mist.push('pick'); if(p.pdPick === 'ja') cnt.pickPd++; }
      else {
        if(pi && pi.bestaat && pi.tijd) mist.push('tijd');
        if(p.pq.lvl === null || p.pq.tot === null){ mist.push('niveau'); if(p.pdLvl !== null && p.pdMax !== null) cnt.nivPd++; }
        if(p.picks.length > 1) mist.push('meer');
      }
      const sppNodig = p.bulks.length > 0 || p.pickSoort === 'vloer' || f.type === 'vloer';   // legbord zonder bulk: stuks per pallet doet er niet toe
      if(sppNodig && !p.spp && !p.sppNvt){ cnt.spp++; mist.push('spp'); }
      mist.forEach(k => { if(k !== 'spp') cnt[k]++; });
      if(!mist.length) cnt.ok++;
    });
    const nA = lopers.filter(p => p.abc === 'A').length, nB = lopers.filter(p => p.abc === 'B').length;
    UI.stats = { V, R, U, uitleg:U, nPdf, pdfVandaag:!!(D.ADV && isoDag(dag2(D.ADV.ingelezen || D.ADV.datum) || new Date(0)) === vandaag()), A, afw:afw.length, nLoc, cnt, lopers:lopers.length, nA, nB };
    h += blok(3, 'Lopers compleet', cnt.ok === lopers.length && lopers.length ? 'groen' : 'oranje', lopers.length ? `<b>${nf(cnt.ok)}</b> van ${nf(lopers.length)} lopers compleet (${pct(cnt.ok, lopers.length)}%)<div class="balk"><i style="width:${pct(cnt.ok, lopers.length)}%"></i></div>` : 'Productexport niet ingelezen', [
      ['Lopers', `${nf(lopers.length)} (${nf(nA)} A, ${nf(nB)} B, rest triage)`],
      ['Zonder vaste picklocatie in Picqer', nf(cnt.pick) + (D.PDAAN && cnt.pickPd ? ` · ${nf(cnt.pickPd)} staan in Productdata op ja` : ''), cnt.pick ? 'let' : ''],
      ...(D.PDAAN ? [['Bewust alleen bulk (Productdata)', nf(cnt.bewust)]] : []),
      ['Picklocatie op tijdelijk', nf(cnt.tijd), cnt.tijd ? 'let' : ''],
      ['Geen aanvulniveau in Picqer', nf(cnt.niveau) + (D.PDAAN && cnt.nivPd ? ` · ${nf(cnt.nivPd)} klaar in Productdata` : ''), cnt.niveau ? 'let' : ''],
      ['Meerdere picklocaties', nf(cnt.meer)],
      ['Stuks per pallet onbekend (met bulk of vloerpallet)', nf(cnt.spp), cnt.spp ? 'let' : '']
    ], 'abcheck', 'A/B-check');

    // 4 inkomend
    const open = (D.CONT || []).filter(c => c.status !== 'afgerond');
    const v = vandaag(), over14 = isoDag(new Date(Date.now() + 14 * 864e5));
    const komend = open.filter(c => c.losdatum && c.losdatum >= v && c.losdatum <= over14);
    const voorbij = open.filter(c => c.losdatum && c.losdatum < v);
    const zonder = open.filter(c => !c.losdatum);
    const morgen = isoDag(new Date(Date.now() + 864e5));
    Object.assign(UI.stats, { open:open.length, voorbij:voorbij.length, zonder:zonder.length, komend:komend.length,
      lossenVandaag:open.filter(c => c.losdatum === v).length, lossenMorgen:open.filter(c => c.losdatum === morgen).length });
    h += blok(4, 'Elke ontvangst krijgt een plek', voorbij.length ? 'oranje' : 'groen', `<b>${nf(komend.length)}</b> containers in de komende 14 dagen`, [
      ['Open containers', nf(open.length)],
      ['Losdatum voorbij, nog niet afgerond', nf(voorbij.length), voorbij.length ? 'let' : ''],
      ['Zonder losdatum', nf(zonder.length), zonder.length ? 'let' : ''],
      ['Europese ontvangsten', 'proef in Test, bevroren']
    ], 'containers', 'Containers');

    // gegevens: hoe vers
    const boD = (D.BO || []).reduce((m, r) => r.geimporteerd_op && (!m || r.geimporteerd_op > m) ? r.geimporteerd_op : m, null);
    const pD = Object.values(D.P).reduce((m, r) => r.picqer_datum && (!m || r.picqer_datum > m) ? r.picqer_datum : m, null);
    UI.stats.oudExp = [['Backorders', boD, 1], ['Aanvuladvies-PDF', D.ADV && (D.ADV.ingelezen || D.ADV.datum), 1], ['Voorraad per locatie', D.VRDATUM, 1], ['Producten', pD, 7], ['Locaties', D.LOCDATUM, 7], ['Aanvulniveaus (Picqer)', D.PQDATUM, 7]]
      .filter(([t, iso, max]) => oud(iso) == null || oud(iso) > max).map(([t, iso]) => ({ t, w:wanneer(iso) }));
    const rij = (t, iso, max) => `<tr><td>${esc(t)}</td><td class="${oud(iso) == null || oud(iso) > max ? 'let' : ''}">${esc(wanneer(iso))}</td><td class="muted">${max === 0 ? 'dagelijks' : max === 1 ? 'dagelijks' : 'elke ' + max + ' dagen'}</td></tr>`;
    h += `<section class="blok vers"><h2>Hoe vers zijn de gegevens</h2><div class="tabel"><table><thead><tr><th>Export</th><th>Laatst</th><th>Ritme</th></tr></thead><tbody>
      ${rij('Backorders', boD, 1)}${rij('Aanvuladvies-PDF', D.ADV && (D.ADV.ingelezen || D.ADV.datum), 1)}${rij('Voorraad per locatie', D.VRDATUM, 1)}${rij('Producten', pD, 7)}${rij('Locaties', D.LOCDATUM, 7)}${rij('Aanvulniveaus (Picqer)', D.PQDATUM, 7)}
      </tbody></table></div><p class="muted klein">Picqer live: ${LIVE() ? 'gekoppeld op dit apparaat' : 'niet gekoppeld op dit apparaat'}. Met de vaste koppeling (gesprek Maxime) vervallen deze exports.</p></section>`;
  }catch(e){ console.error(e); h = `<div class="melding">Rekenen lukte niet: ${esc(e.message)}</div>`; }
  UI.cache = h;
  const el = $('fund'); if(el) el.innerHTML = h;
  WHTAAK.herteken();
}
const LIVE = () => { try{ return !!localStorage.getItem('ivol-koppelcode'); }catch(e){ return false; } };

/* ---------- laden (één keer, gedeeld) ---------- */
let laadP = null;
function geladen(){
  if(!laadP) laadP = (async () => { const ok = await WH.load(); try{ await WHAL.laadOpslag(); }catch(e){} UI.geladen = true; return ok !== false; })();
  return laadP;
}

/* ---------- naslag: alle links, koppelingen, functies, mappen en documenten op één plek ----------
   Vaste inhoud hieronder staat in de openbare repo: alleen wat daar al staat (adressen, namen), nooit sleutels of bedrijfsdata.
   Eigen regels (bijv. iCloud-mappen) staan in catalog-rij `wh-naslag` in de database: { rijen:[{ id, g, naam, adres, noot, op }] } */
const NASLAG = [
  { g:'Apps', rijen:[
    ['IVOL Warehouse 3.0', './ivol.html', 'Jouw ingang: alles in één menu'],
    ['IVOL Warehouse', './warehouse.html', 'Dagelijkse basis voor Daan en Karin'],
    ['Junior', './junior.html', 'Kate, Salah, Valerii · NL/EN/ES/EL'],
    ['Containers', './containerplanning.html', 'Pakbon, verdeling, losdag, labels, Stockmove, VST-mail'],
    ['Palletlabels', './index.html', 'Labels printen; het oude productgeheugen (catalog-ean)'],
    ['Productkaart', './productkaart.html', 'Alles over één product'],
    ['Testdata Picqer', './testdata.html', 'Picqer-testomgeving vullen (schrijft alleen naar ivol-dev)'],
    ['Ploeg', './ploeg.html', 'Geparkeerd tot bouwplan stap 2.1'],
    ['Bouwplan', '#/bouwplan', 'De route, stap voor stap: staat nu in 3.0'],
    ['Oud bouwplan (claude.ai, archief)', BOUWPLAN, 'Alleen nog naslag; de stand is overgenomen in 3.0 → Bouwplan'] ] },
  { g:'Code · GitHub', rijen:[
    ['Repo Magazijn-Tools', 'https://github.com/Daan-vB/Magazijn-Tools', 'Openbaar: nooit sleutels of bedrijfsdata in de repo'],
    ['Automatische taken (Actions)', 'https://github.com/Daan-vB/Magazijn-Tools/actions', 'Functies live zetten · versleutelde data-export · spraak naar tekst · Productdata door Claude · database-opbouw'],
    ['Gedeelde code (map wh/)', 'https://github.com/Daan-vB/Magazijn-Tools/tree/main/wh', 'Eén code voor 3.0, Warehouse, Test, Junior en Ploeg; welke app wat laadt: wh/lijst.json'] ] },
  { g:'Database · Supabase "Palletlabels"', rijen:[
    ['Dashboard', 'https://supabase.com/dashboard/project/jarbgetbwkjtxwtcfwmq', 'Frankfurt · gratis abonnement (bouwplan 0.3) · organisatie Daan_Private'],
    ['Back-ups', 'https://supabase.com/dashboard/project/jarbgetbwkjtxwtcfwmq/database/backups/scheduled', 'Dagelijkse back-ups (vanaf Pro, bouwplan 0.3)'],
    ['Gebruik', 'https://supabase.com/dashboard/project/jarbgetbwkjtxwtcfwmq/settings/billing/usage', 'Dataverkeer en opslag tegen de grens van het abonnement'],
    ['Tabellen', '', 'producten · productdata · catalog (rijen wh-… en catalog-ean) · containers · pakbon_alias · verkoop · backorders · todos'],
    ['Edge Functions', 'https://supabase.com/dashboard/project/jarbgetbwkjtxwtcfwmq/functions', 'picqer (live, lezen) · picqer-inkoop (live, lezen) · picqer-test (test, lezen) · picqer-seed (test, schrijven) · db-setup (eenmalig)'],
    ['Geheimen (alleen de namen)', '', 'Onder Edge Functions → Secrets: PICQER_DOMAIN, PICQER_KEY, PICQER_WAREHOUSE, PICQER_VST, IVOL_CODE (koppelcode), PICQER_TEST_DOMAIN, PICQER_TEST_KEY, PICQER_TEST_WAREHOUSE, PICQER_TEST_VST'] ] },
  { g:'Picqer', rijen:[
    ['Picqer live', 'https://ivol.picqer.com', 'De echte. De apps lezen alleen (functie picqer). Hoofdmagazijn 3857 · Bulk van Spreuwel (VST) 3991'],
    ['Picqer test (ivol-dev)', 'https://ivol-dev.picqer.com', 'Hier mag alles (Maxime, 7 okt). Hoofdmagazijn 13337 · External (VST) 13523'] ] },
  { g:'Documenten', rijen:[
    ['Stand van zaken 15 okt', 'https://claude.ai/code/artifact/5bc0ce06-516e-4c90-843e-3fc087995f57', 'Alle tools en data doorgelicht, met voorstel'],
    ['Projectdocumenten (claude.ai-project IVOL Warehouse Test)', '', 'masterdocument · app-fundament · ivol-warehouse-app · picqer-api-test · bouwplan · picqer-testomgeving · aanvulregels · productdata-bronnen · opslagtypen · spraak-invoer · aandachtspunten'] ] }
];
const NASLAG_VOORSTEL = [
  ['iCloud-mappen', 'Inbox', 'iCloud Drive/Daan_System/00_Inbox', 'Picqer-exports en downloads komen hier binnen'],
  ['iCloud-mappen', 'Back-up database', 'iCloud Drive/02_Werk_IVOL/Backup', 'Maandelijkse export van alle tabellen (bouwplan 0.3)']
];
const NS = { d:null, laden:false, fout:null };
async function laadNaslag(){
  if(NS.laden) return; NS.laden = true;
  try{ const r = await WH.catHaal('wh-naslag'); NS.d = (r && r.data) || { rijen:[] }; NS.fout = null; }
  catch(e){ NS.fout = e; NS.d = NS.d || { rijen:[] }; }
  NS.laden = false;
  const nat = $('native'); if(nat && huidig().native === 'naslag') nat.innerHTML = viewNaslag();
}
const linkCel = (a) => !a ? '' : /^#\//.test(a) ? `<a href="${esc(a)}">3.0 ${esc(a)}</a>` : /^(https?:|\.\/)/.test(a) ? `<a href="${esc(a)}" target="_blank" rel="noopener">${esc(a.replace(/^https?:\/\//, '').replace(/^\.\//, ''))}</a>` : `<span class="code">${esc(a)}</span>`;
function viewNaslag(){
  const eigen = (NS.d && NS.d.rijen) || [];
  const groepen = [...new Set(eigen.map(r => r.g || 'Overig'))];
  const voorstel = NASLAG_VOORSTEL.filter(([g, n, a]) => !eigen.some(r => r.adres === a));
  return `<div class="pagina">
    <h1>Naslag</h1>
    <p class="lede">Alles op één plek: apps, code, database, Picqer, mappen en documenten. Geen wachtwoorden of sleutels hier: de database is nog niet afgeschermd (bouwplan 0.3).</p>
    ${NASLAG.map(g => `<section class="blok"><h2>${esc(g.g)}</h2><div class="tabel"><table><tbody>
      ${g.rijen.map(([n, a, w]) => `<tr><td><b>${esc(n)}</b></td><td>${linkCel(a)}</td><td class="muted">${esc(w)}</td></tr>`).join('')}
    </tbody></table></div></section>`).join('')}
    <section class="blok"><h2>Eigen regels</h2>
      <p class="muted klein">Mappen op je Mac of iCloud, extra links, notities. Staat in de database (rij wh-naslag), niet in de openbare repo.</p>
      ${NS.fout ? `<div class="melding">Laden lukte niet: ${esc(NS.fout.message || String(NS.fout))}</div>` : ''}
      ${!NS.d ? '<div class="leeg">Laden…</div>' : eigen.length ? groepen.map(gr => `<h3 style="font-size:14px;margin-top:6px">${esc(gr)}</h3><div class="tabel"><table><tbody>
        ${eigen.filter(r => (r.g || 'Overig') === gr).map(r => `<tr><td><b>${esc(r.naam)}</b></td><td>${linkCel(r.adres)}</td><td class="muted">${esc(r.noot || '')}</td><td style="width:1%"><button class="knop" data-a="naslag-weg" data-id="${esc(r.id)}" aria-label="Verwijder">×</button></td></tr>`).join('')}
      </tbody></table></div>`).join('') : '<p class="muted">Nog geen eigen regels.</p>'}
      ${voorstel.length ? `<div class="rij">${voorstel.map(([g, n, a], i) => `<button class="knop" data-a="naslag-voorstel" data-i="${NASLAG_VOORSTEL.findIndex(x => x[2] === a)}">+ ${esc(g)}: ${esc(n)}</button>`).join('')}</div>` : ''}
      <div class="rij" style="margin-top:6px">
        <input id="ns-g" list="ns-groepen" placeholder="Groep (bijv. iCloud-mappen)" style="font:inherit;padding:8px 10px;border:1px solid var(--lijn);border-radius:8px;min-width:160px">
        <datalist id="ns-groepen"><option>iCloud-mappen</option><option>Links</option><option>Mensen en afspraken</option><option>Overig</option></datalist>
        <input id="ns-n" placeholder="Naam" style="font:inherit;padding:8px 10px;border:1px solid var(--lijn);border-radius:8px;min-width:140px">
        <input id="ns-a" placeholder="Link of pad" style="font:inherit;padding:8px 10px;border:1px solid var(--lijn);border-radius:8px;min-width:220px;flex:1">
        <input id="ns-w" placeholder="Notitie" style="font:inherit;padding:8px 10px;border:1px solid var(--lijn);border-radius:8px;min-width:160px;flex:1">
        <button class="knop pri" data-a="naslag-plus">Toevoegen</button>
      </div></section>
  </div>`;
}
async function naslagBewaar(rijen){
  const vorig = NS.d; NS.d = { rijen };
  const nat = $('native'); if(nat) nat.innerHTML = viewNaslag();
  try{ await WH.catZet('wh-naslag', NS.d); WH.toast('Opgeslagen'); }
  catch(e){ NS.d = vorig; if(nat) nat.innerHTML = viewNaslag(); WH.toast('Opslaan mislukt: ' + e.message, 6000); }
}

/* ---------- koppeling Picqer ---------- */
const tijdKort = iso => { if(!iso) return '–'; const d = new Date(iso); if(isNaN(d)) return '–'; const m = Math.round((Date.now() - d.getTime()) / 6e4); return m < 1 ? 'net' : m < 60 ? m + ' min geleden' : m < 1440 ? Math.round(m / 60) + ' uur geleden' : Math.round(m / 1440) + ' dagen geleden'; };
function viewBronnen(){
  const B = IVL.bronnen();
  return `<div class="pagina">
    <h1>Koppeling Picqer</h1>
    <p class="lede">3.0 leest alleen uit Picqer, via de functie <code>picqer</code> in Supabase. Zolang 3.0 open staat, haalt hij alles zelf op. Wat hier "live" is, hoef je niet meer te exporteren.</p>
    ${B.gekoppeld ? '' : `<section class="blok"><h2>Koppelen</h2><p class="muted">Eén keer per apparaat. De koppelcode staat bij de Secrets in Supabase (IVOL_CODE).</p>
      <div class="rij"><input id="kcode" type="password" autocomplete="off" placeholder="koppelcode" style="font:inherit;padding:8px 10px;border:1px solid var(--lijn);border-radius:8px;min-width:200px"><button class="knop pri" data-a="koppel">Koppelen</button></div></section>`}
    ${B.functieOud ? `<section class="blok let"><h2>Functie bijwerken (5 minuten, op de Mac)</h2>
      <p class="muted">Locaties en aanvulniveaus live vragen twee nieuwe acties in de functie. Alleen lezen, zoals de rest.</p>
      <ol class="stappen">
        <li>Open <b>github.com/Daan-vB/Magazijn-Tools</b> → map <code>supabase/functions/picqer</code> → <code>index.ts</code> → knop <b>Raw</b> → alles selecteren → kopiëren.</li>
        <li>Open <b>supabase.com/dashboard</b> → project <b>Palletlabels</b> → <b>Edge Functions</b> → <b>picqer</b> → <b>Code</b>.</li>
        <li>Alles in de editor selecteren, plakken, <b>Deploy updates</b>.</li>
        <li>Terug in 3.0: <b>Nu verversen</b> hieronder.</li>
      </ol></section>` : ''}
    <section class="blok"><div class="rij" style="justify-content:space-between;align-items:center"><h2>Gegevens</h2><button class="knop" data-a="ververs" ${B.bezig ? 'disabled' : ''}>Nu verversen</button></div>
      ${B.bezig ? `<p class="muted">${esc(B.bezig)}</p>` : ''}${B.fout ? `<div class="melding">${esc(B.fout.message || String(B.fout))}</div>` : ''}
      <div class="tabel"><table><thead><tr><th>Gegevens</th><th>Bron</th><th>Laatst</th><th>Ritme</th><th>Vervangt</th></tr></thead><tbody>
      ${B.rijen.map(r => `<tr><td><b>${esc(r.t)}</b>${r.extra ? `<br><span class="muted">${esc(r.extra)}</span>` : ''}</td><td><i class="st ${r.bron === 'live' ? 'ok' : 'warn'}">${r.bron}</i></td><td>${esc(tijdKort(r.op))}</td><td class="muted">${esc(r.ritme)}</td><td class="muted">${esc(r.vervangt)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="muted klein">Aanvulniveaus worden pas de waarheid voor alle apps na een volle ronde én als ze voor minstens 90% gelijk zijn aan de laatste export. Zo weten we zeker dat de velden uit Picqer de goede zijn.</p></section>
    <section class="blok"><h2>Productdata als bron</h2>
      <p>${D.PDAAN ? `<b>Aan</b> op dit scherm: stuks per pallet, aanvullen bij, max op pick en "alleen bulk" komen eerst uit Productdata (${nf(Object.keys(D.PD).length)} producten), daarna pas uit het oude palletgeheugen.` : '<b>Uit</b> op dit scherm: alles komt nog uit het oude palletgeheugen.'}</p>
      <p class="muted klein">Aan in 3.0 en Test. Warehouse en Junior volgen na jouw akkoord; Palletlabels en Containers lezen het oude geheugen tot Productdata daar is gelijkgezet (Productdata → Gelijkzetten).</p></section>
  </div>`;
}
function tekenPill(){
  const el = $('livepill'); if(!el || !window.IVL) return;
  const B = IVL.bronnen(), s = WHLIVE.status();
  el.className = 'pill ' + (!B.gekoppeld ? 'uit' : B.fout ? 'fout' : B.bezig ? 'bezig' : 'ok');
  el.textContent = !B.gekoppeld ? 'Picqer: koppelen' : B.fout ? 'Picqer: fout' : B.bezig ? 'Picqer: bijwerken…' : 'Picqer live' + (s.data ? ' · ' + tijdKort(new Date(s.data.binnen).toISOString()).replace(' geleden', '') : '');
}
let herT = null;
function herreken(){
  tekenPill();
  const m = huidig();
  if(m && m.native === 'bronnen'){ const nat = $('native'); if(nat && !(document.activeElement && document.activeElement.id === 'kcode')) nat.innerHTML = viewBronnen(); }
  if(m && ['todo', 'fundament', 'taak', 'bouwplan'].includes(m.native)){ clearTimeout(herT); herT = setTimeout(rekenFundament, 4000); }
}

/* ---------- nieuwe versie: elke 5 minuten (en bij terugkomen) kijken of de bestanden op GitHub Pages veranderd zijn ----------
   Alleen een balk, nooit zelf herladen: Daan kiest het moment (er kan in een invulveld getypt worden). */
const VERSIE_BESTANDEN = ['wh/lijst.json', 'wh/ivol.js', 'wh/productdata.js', 'test.html'];
const VS = { basis:null, bezig:false };
async function versieKijk(){
  if(VS.bezig) return; VS.bezig = true;
  const nu = {};
  await Promise.all(VERSIE_BESTANDEN.map(async f => {
    try{
      const r = await fetch(f, { method:'HEAD', cache:'no-store' }); if(!r.ok) return;
      const sig = (r.headers.get('ETag') || '') + '|' + (r.headers.get('Last-Modified') || '');
      if(sig !== '|') nu[f] = sig;
    }catch(e){ /* geen verbinding of geen headers: niets doen */ }
  }));
  VS.bezig = false;
  if(!VS.basis){ VS.basis = nu; return; }
  if(Object.keys(nu).some(f => VS.basis[f] && VS.basis[f] !== nu[f])) $('versiebalk').hidden = false;
  Object.keys(nu).forEach(f => { if(!VS.basis[f]) VS.basis[f] = nu[f]; });
}
async function vernieuw(){
  // eerst de html in de browsercache verversen (GitHub Pages bewaart hem 10 minuten), dan 3.0 met iframe opnieuw laden
  const fr = $('frame'), pad = fr && fr.src ? new URL(fr.src, location.href).pathname : null;
  await Promise.all(['ivol.html', 'test.html', 'warehouse.html', pad].filter(Boolean).map(u => fetch(u, { cache:'reload' }).catch(() => {})));
  location.reload();
}
setInterval(versieKijk, 5 * 60e3);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') versieKijk(); });
versieKijk();

/* ---------- gebeurtenissen ---------- */
window.addEventListener('hashchange', toon);
document.addEventListener('click', ev => {
  const r = ev.target.closest('#rollen button');
  if(r){ UI.rol = r.dataset.rol; lsZet('ivol-rol', UI.rol); location.hash = '#/' + startVan(UI.rol); toon(); return; }
  if(ev.target.closest('#menuknop')){ zetZij(!zijOpen()); return; }
  if(ev.target.closest('#zijdicht') || ev.target.closest('#zijdek')){ zetZij(false); return; }
  if(ev.target.closest('#menulijst a') && smal() && zijOpen()){ zetZij(false); }   // ook het actieve item sluit het menu
  const k = ev.target.closest('[data-a]');
  if(k && k.dataset.a === 'vernieuw'){ k.disabled = true; vernieuw(); return; }
  if(k && k.dataset.a === 'koppel'){ const v = (($('kcode') || {}).value || '').trim(); if(!v) return; WHLIVE.zetCode(v); IVL.ronde(true); toon(); return; }
  if(k && k.dataset.a === 'ververs'){ IVL.ronde(true); herreken(); return; }
  if(k && k.dataset.a === 'naslag-plus'){
    const v = id => (($(id) || {}).value || '').trim();
    if(!v('ns-n') && !v('ns-a')) return;
    naslagBewaar(((NS.d && NS.d.rijen) || []).concat([{ id:Date.now().toString(36), g:v('ns-g') || 'Overig', naam:v('ns-n') || v('ns-a'), adres:v('ns-a'), noot:v('ns-w'), op:new Date().toISOString() }])); return;
  }
  if(k && k.dataset.a === 'naslag-voorstel'){
    const x = NASLAG_VOORSTEL[+k.dataset.i]; if(!x) return;
    naslagBewaar(((NS.d && NS.d.rijen) || []).concat([{ id:Date.now().toString(36), g:x[0], naam:x[1], adres:x[2], noot:x[3], op:new Date().toISOString() }])); return;
  }
  if(k && k.dataset.a === 'naslag-weg'){ naslagBewaar(((NS.d && NS.d.rijen) || []).filter(r => r.id !== k.dataset.id)); return; }
});
document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && smal() && zijOpen()) zetZij(false); });
$('frame').addEventListener('load', frameGeladen);
toon();
IVL.opNieuw(herreken);
WHAL.opNieuw(herreken);
geladen().then(() => { tekenPill(); herreken(); IVL.ronde(false); });
return { M, GROEPEN, toon, huidig, geladen, stats:() => UI.stats || null };
})();
