/* =====================================================================
   IVOL Warehouse Test — schakelaar Live/Test voor de Picqer-bron
   Alleen geladen door test.html. Warehouse en Junior gebruiken dit niet
   en praten altijd met de echte functie "picqer".
   LIVE: functie "picqer"       (echte Picqer, alleen lezen)
   TEST: functie "picqer-test"  (Picqer-testomgeving, alleen lezen)
   De keuze blijft op dit apparaat bewaard. De knop bovenin laat altijd zien
   welke bron actief is; bij TEST controleert hij of het antwoord echt uit
   de testomgeving komt.
   ===================================================================== */
(function(){
'use strict';
if(window.WH_APP !== 'test' || !window.WH || !WH.URL_) return;
const LS = 'ivol-test-bron';
const FN = WH.URL_ + '/functions/v1/picqer';
let test = false;
try{ test = localStorage.getItem(LS) === 'test'; }catch(e){}
window.WH_BRON = test ? 'test' : 'live';   // andere schermen in Test kunnen zo hun eigen opslag kiezen

// alleen aanroepen naar het tussenstation omleiden, de rest blijft gelijk
const echt = window.fetch.bind(window);
window.fetch = function(inv, opt){
  if(test && typeof inv === 'string' && (inv === FN || inv.startsWith(FN + '?'))) inv = FN + '-test' + inv.slice(FN.length);
  return echt(inv, opt);
};

function teken(tekst, klasse, titel){
  const b = document.getElementById('bron'); if(!b) return;
  b.className = 'bron ' + klasse; b.textContent = tekst; b.title = titel || '';
  document.body.classList.toggle('bron-test', test);
}
async function controleer(){
  if(!test || !window.WHLIVE) return;
  if(!WHLIVE.status().code) return teken('Bron: TEST · koppelcode nodig', 'test', 'Vul de koppelcode in bij Picqer live');
  try{
    const r = await WHLIVE.vraag('status');
    if(r && r.omgeving === 'test') teken('Bron: TEST · ' + (r.domein || 'testomgeving'), 'test', 'Antwoord komt uit de Picqer-testomgeving. Tik om naar LIVE te gaan.');
    else teken('Bron: TEST ✗ antwoord niet uit test', 'fout', 'Het antwoord komt niet van de testfunctie. Tik om naar LIVE te gaan.');
  }catch(e){ teken('Bron: TEST ✗ niet bereikbaar', 'fout', String((e && e.message) || e)); }
}
function maak(){
  const brand = document.querySelector('.top .brand'); if(!brand || document.getElementById('bron')) return;
  const b = document.createElement('button'); b.id = 'bron'; b.type = 'button';
  b.addEventListener('click', () => { try{ localStorage.setItem(LS, test ? 'live' : 'test'); }catch(e){} location.reload(); });
  brand.appendChild(b);
  if(test) teken('Bron: TEST · controleren…', 'test', '');
  else teken('Bron: LIVE · echte Picqer', 'live', 'Tik om naar de testomgeving te gaan');
  controleer();
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maak); else maak();
})();
