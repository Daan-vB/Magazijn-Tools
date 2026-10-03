/* =====================================================================
   IVOL Warehouse — één menu voor alle schermen (1-10-2026)
   Vier hoofdtabs, daaronder de onderdelen. Zelfde menu in warehouse.html en containerplanning.html.
   Pagina roept WHM.zet(<sleutel>) aan bij elke schermwissel.
   ===================================================================== */
window.WHM = (function(){
'use strict';
const W = './warehouse.html', CP = './containerplanning.html';
const GROEPEN = [
  { k:'vandaag', t:'Vandaag', href:W + '#/', sub:[
    ['vandaag', 'Vandaag', W + '#/'], ['planning', 'Planning', W + '#/planning']] },
  { k:'aanvul', t:'Aanvuladvies', href:W + '#/aanvullen', sub:[
    ['aanvullen', 'Aanvullen', W + '#/aanvullen'], ['base', 'Niveaus', W + '#/base'], ['abcheck', 'A/B-check', W + '#/abcheck'],
    ['invul', 'Invullen', W + '#/invul'], ['locaties', 'Locaties', W + '#/locaties'], ['stelling', 'Stellingen', W + '#/stelling'], ['triage', 'Triage', W + '#/triage'], ['backorders', 'Backorders', W + '#/backorders']] },
  { k:'cont', t:'Containers', href:CP + '#/', sub:[
    ['cp:home', 'Containers', CP + '#/'], ['cp:vooruit', 'Vooruit', CP + '#/vooruit'], ['containerdag', 'Containerdag', W + '#/containerdag'], ['controle', 'Controle', W + '#/controle'], ['wie', 'Wie deed wat', W + '#/wie'],
    ['ruimte', 'Ruimte', W + '#/ruimte'], ['cp:producten', 'Producten', CP + '#/producten'], ['cp:vloernamen', 'Vloernamen', CP + '#/vloernamen'],
    ['labels', 'Palletlabels', './'], ['productkaart', 'Productkaart', './productkaart.html']] },
  { k:'geg', t:'Gegevens', href:W + '#/gegevens', sub:[
    ['gegevens', 'Gegevens inladen', W + '#/gegevens'], ['cp:gegevens', 'Gegevens containers', CP + '#/gegevens']] }
];
// schermen zonder eigen menuregel: bij welk onderdeel horen ze
const ALIAS = { p:'base', overzicht:'vandaag', 'cp:c':'cp:home' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
let laatste = null;
function zet(sleutel){
  sleutel = ALIAS[sleutel] || sleutel;
  if(sleutel === laatste && document.getElementById('subnav')) return;
  laatste = sleutel;
  const g = GROEPEN.find(x => x.sub.some(s => s[0] === sleutel)) || GROEPEN[0];
  const nav = document.getElementById('nav');
  if(nav) nav.innerHTML = GROEPEN.map(x => `<a href="${x.href}" class="${x === g ? 'on' : ''}">${esc(x.t)}</a>`).join('')
    + '<span class="sep"></span><a href="./junior.html" class="klein">Junior</a>';
  let sub = document.getElementById('subnav');
  if(!sub){ sub = document.createElement('nav'); sub.id = 'subnav'; sub.className = 'subnav'; const top = document.querySelector('header.top'); if(top) top.appendChild(sub); }
  sub.innerHTML = g.sub.map(([k, t, h]) => `<a href="${h}" class="${k === sleutel ? 'on' : ''}">${esc(t)}</a>`).join('');
}
return { zet, GROEPEN };
})();
