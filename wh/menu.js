/* =====================================================================
   IVOL Warehouse — menu voor de apps (7-10-2026)
   Drie apps, één database:
     IVOL Warehouse        warehouse.html                 Daan + Karin, dagelijkse basis
     IVOL Warehouse Test   test.html (+ containerplanning.html?test)   alles, om te bouwen en testen
     IVOL Warehouse Junior junior.html                    Sala + Kate (eigen menu, niet via dit bestand)
   Pagina roept WHM.zet(<sleutel>) aan bij elke schermwissel.
   ===================================================================== */
window.WHM = (function(){
'use strict';
const TEST = window.WH_APP === 'test' || /(^|[?&])test(=|&|$)/.test(location.search);
const W = TEST ? './test.html' : './warehouse.html';
const CP = TEST ? './containerplanning.html?test' : './containerplanning.html';
const LAB = { k:'lab', t:'Palletlabels', href:'./', sub:[
  ['labels', 'Palletlabels', './'], ['containerlabels', 'Container / Stockmove-PDF', './container-labels.html'], ['productkaart', 'Productkaart', './productkaart.html']] };

// IVOL Warehouse: alleen wat nu dagelijks draait
const BASIS = [
  { k:'vandaag', t:'Vandaag', href:W + '#/', sub:[['vandaag', 'Vandaag', W + '#/']] },
  { k:'aanvul', t:'Aanvuladvies', href:W + '#/aanvullen', sub:[['aanvullen', 'Aanvullen', W + '#/aanvullen']] },
  { k:'cont', t:'Containers', href:CP + '#/', sub:[['cp:home', 'Containers', CP + '#/']] },
  LAB,
  { k:'geg', t:'Gegevens', href:W + '#/gegevens', sub:[
    ['gegevens', 'Gegevens inladen', W + '#/gegevens'], ['cp:gegevens', 'Gegevens containers', CP + '#/gegevens']] }
];

// IVOL Warehouse Test: alles wat gebouwd is
const VOL = [
  { k:'vandaag', t:'Vandaag', href:W + '#/', sub:[
    ['vandaag', 'Vandaag', W + '#/'], ['live', 'Picqer live', W + '#/live'], ['planning', 'Planning', W + '#/planning']] },
  { k:'aanvul', t:'Aanvuladvies', href:W + '#/aanvullen', sub:[
    ['aanvullive', 'Live advies', W + '#/aanvullive'], ['aanvullen', 'Aanvullen (export)', W + '#/aanvullen'], ['base', 'Niveaus', W + '#/base'], ['abcheck', 'A/B-check', W + '#/abcheck'],
    ['invul', 'Invullen', W + '#/invul'], ['locaties', 'Locaties', W + '#/locaties'], ['stelling', 'Stellingen', W + '#/stelling'], ['triage', 'Triage', W + '#/triage'], ['backorders', 'Backorders', W + '#/backorders']] },
  { k:'cont', t:'Containers', href:CP + '#/', sub:[
    ['cp:home', 'Containers', CP + '#/'], ['cp:vooruit', 'Vooruit', CP + '#/vooruit'], ['containerdag', 'Containerdag', W + '#/containerdag'], ['controle', 'Controle', W + '#/controle'], ['wie', 'Wie deed wat', W + '#/wie'],
    ['ruimte', 'Ruimte', W + '#/ruimte'], ['cp:producten', 'Producten', CP + '#/producten'], ['cp:vloernamen', 'Vloernamen', CP + '#/vloernamen']] },
  LAB,
  { k:'geg', t:'Gegevens', href:W + '#/gegevens', sub:[
    ['gegevens', 'Gegevens inladen', W + '#/gegevens'], ['cp:gegevens', 'Gegevens containers', CP + '#/gegevens']] }
];

const GROEPEN = TEST ? VOL : BASIS;
// schermen zonder eigen menuregel: bij welk onderdeel horen ze
const ALIAS = { p:'aanvullen', overzicht:'vandaag', 'cp:c':'cp:home' };
const IN_APP = new Set(GROEPEN.flatMap(g => g.sub.map(s => s[0])).concat(Object.keys(ALIAS)));
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));

// staat dit scherm in deze app? (anders: alleen in Test)
const magHier = sleutel => TEST || IN_APP.has(sleutel);
// link naar hetzelfde scherm in de Test-app
function testLink(){
  const p = location.pathname;
  if(/containerplanning\.html$/.test(p)) return './containerplanning.html?test' + location.hash;
  return './test.html' + location.hash;
}
function nietHier(naam){
  return `<div class="card"><h2>${esc(naam || 'Dit onderdeel')} staat in IVOL Warehouse Test</h2>
    <p class="mt8 small muted">IVOL Warehouse toont alleen de dagelijkse basis. Alles wat nog gebouwd of getest wordt, staat in de Test-app (zelfde gegevens).</p>
    <div class="row wrap mt12"><a class="btn pri" href="${esc(testLink())}">Open in Test</a><a class="btn" href="./warehouse.html#/">Naar Vandaag</a></div></div>`;
}

try{ localStorage.removeItem('ivol-beheer'); }catch(e){}
const wst = document.createElement('style');
wst.textContent = '.appwissel{display:inline-flex;gap:2px;background:#1b222c;border-radius:8px;padding:2px;align-self:center}'
  + '.appwissel a{font-size:12px !important;padding:4px 10px !important;color:#8a98aa !important;border-radius:6px;text-decoration:none;font-weight:700;white-space:nowrap}'
  + '.appwissel a.on{background:#33404f;color:#fff !important}';
document.head.appendChild(wst);
function kop(){
  const h1 = document.querySelector('header.top h1');
  if(!h1 || h1.dataset.app) return;
  h1.dataset.app = TEST ? 'test' : 'warehouse';
  if(TEST){
    h1.innerHTML = 'IVOL <span>Warehouse</span> <em class="testlabel">TEST</em>';
    if(!/Test/.test(document.title)) document.title += ' · Test';
    const st = document.createElement('style');
    st.textContent = '.top h1 .testlabel{font-style:normal;font-size:11px;font-weight:800;letter-spacing:.12em;background:#f08a4b;color:#10151c;padding:3px 7px;border-radius:3px;vertical-align:3px;margin-left:4px}'
      + 'header.top{box-shadow:inset 0 4px 0 #f08a4b}';
    document.head.appendChild(st);
  }
}

let laatste = null;
function zet(sleutel){
  sleutel = ALIAS[sleutel] || sleutel;
  kop();
  if(sleutel === laatste && document.getElementById('subnav')) return;
  laatste = sleutel;
  const g = GROEPEN.find(x => x.sub.some(s => s[0] === sleutel)) || GROEPEN[0];
  const nav = document.getElementById('nav');
  // Warehouse en Test horen bij elkaar (Daan, Karin); Junior is een losse app en opent apart
  const rechts = '<span class="sep"></span><span class="appwissel">'
    + `<a data-app href="./warehouse.html#/" class="${TEST ? '' : 'on'}">Warehouse</a><a data-app href="./test.html#/" class="${TEST ? 'on' : ''}">Test</a></span>`
    + '<a data-app href="./junior.html#/" target="_blank" rel="noopener" class="klein" title="Opent Junior apart">Junior ↗</a>';
  if(nav) nav.innerHTML = GROEPEN.map(x => `<a href="${x.href}" class="${x === g ? 'on' : ''}">${esc(x.t)}</a>`).join('') + rechts;
  let sub = document.getElementById('subnav');
  if(!sub){ sub = document.createElement('nav'); sub.id = 'subnav'; sub.className = 'subnav'; const top = document.querySelector('header.top'); if(top) top.appendChild(sub); }
  sub.innerHTML = g.sub.length > 1 ? g.sub.map(([k, t, h]) => `<a href="${h}" class="${k === sleutel ? 'on' : ''}">${esc(t)}</a>`).join('') : '';
  sub.hidden = g.sub.length < 2;
}

// In Test blijven links binnen Test (oude links in de schermen wijzen nog naar warehouse.html / containerplanning.html)
if(TEST){
  document.addEventListener('click', ev => {
    const a = ev.target.closest && ev.target.closest('a[href]'); if(!a || a.target === '_blank' || a.hasAttribute('data-app')) return;
    const href = a.getAttribute('href');
    let nieuw = null;
    if(/^\.?\/?warehouse\.html/.test(href)) nieuw = href.replace(/^\.?\/?warehouse\.html/, './test.html');
    else if(/^\.?\/?containerplanning\.html(?!\?test)/.test(href)) nieuw = href.replace(/^\.?\/?containerplanning\.html/, './containerplanning.html?test');
    if(!nieuw) return;
    ev.preventDefault();
    location.href = nieuw;
  }, true);
}

return { zet, GROEPEN, TEST, magHier, nietHier, testLink };
})();
