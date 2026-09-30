/* =====================================================================
   IVOL Warehouse — planning: oktober 2026, dagritme, open vragen
   Afvinken wordt bewaard in catalog wh-taken (gedeeld iPhone/Mac).
   ===================================================================== */
window.WHP = (function(){
'use strict';

const L = { aanvullen:'#/aanvullen', vst:'#/aanvullen/vst', ronde:'#/aanvullen/ronde', base:'#/base', loc:'#/locaties', geg:'#/gegevens', cont:'./containerplanning.html' };

// prio 1 = moet, 2 = belangrijk, 3 = als er tijd is
const TAKEN = [
  // ---- week 40 ----
  { id:'o-0930-wallace', datum:'2026-09-30', prio:1, wie:'Daan · Sala · Valerii', titel:'Wallace NL-297 + NL-298 lossen', uitleg:'Containers → container → Uitvoer: losdag-PDF, palletlabels, Stockmove-lijst. Jim heeft ISM80X120 en ISM100X100 van NL-297 al opgeboekt.', link:L.cont },
  { id:'o-0930-export', datum:'2026-09-30', prio:1, wie:'Daan', titel:'Voorraad per locatie exporteren (Hoofdmagazijn + Bulk van Spreuwel)', uitleg:'Zelfde export als stock-…xlsx van 2-9, één keer per magazijn. Inladen bij Gegevens. Productexport, locaties, backorders, advies en verkoop per maand zijn al ingeladen (30-9 nacht).', link:L.geg },
  { id:'o-0930-nuverpl', datum:'2026-09-30', prio:1, wie:'Daan · reachtruck', titel:'Aanvullen → Nu verplaatsen afwerken', uitleg:'Alleen wat orders vrijmaakt, oudste order eerst. Daarna in Picqer: Backorders → Verwerk backorders.', link:L.aanvullen },
  { id:'o-0930-stockmove', datum:'2026-09-30', prio:2, wie:'Karin · Daan', titel:'Stockmove NL-297/298 en ontvangst inlezen', uitleg:'Na het lossen: Stockmove (Karin), daarna in Containers de Picqer-inruimlijst per container inlezen (restant NL-297 + NL-298).', link:L.cont },
  { id:'o-0930-vst', datum:'2026-09-30', prio:2, wie:'Daan', titel:'Van VST halen: terughaallijst naar Edwin', uitleg:'Aanvullen → Van VST: orders die compleet worden met VST-voorraad. Mailtekst staat klaar.', link:L.vst },
  { id:'o-1001-ronde', datum:'2026-10-01', prio:1, wie:'Daan · reachtruck', titel:'Aanvulronde per gang', uitleg:'Aanvullen → Aanvulronde: rest van het advies, gesorteerd per gang. Op de scanner verplaatsen, in de app aftikken en meteen aanvulniveau/picklocatie invullen waar het schuurt.', link:L.ronde },
  { id:'o-1001-testdag', datum:'2026-10-01', prio:1, wie:'Daan · Claude', titel:'Verwerking testdag 30-9 doorlopen', uitleg:'Project-doc testdag-30-9.md: nieuwe schermen (Nu verplaatsen, Niet nu, Junior, Ruimte plannen, labels met plek) en §6 beslissingen.', link:L.aanvullen },
  { id:'o-1001-iceworld', datum:'2026-10-02', prio:2, wie:'Daan', titel:'Ice World (650 stalmatten, 20-10): één reserveringslocatie', uitleg:'Pallets bij elkaar op één locatie die klopt (bv. RES-ICEWORLD), voorraad én picklijst-reserveringen daarheen verplaatsen in Picqer. Vloerstapel CD een eigen locatie (bulk, tijdelijk).', link:null },
  { id:'o-1001-knopjes', datum:'2026-10-01', prio:2, wie:'Daan', titel:'Knopje "Vul pickvoorraad aan van bulk" uit voor producten zonder picklocatie', uitleg:'Lijst onderaan Aanvullen → Aanvulronde. Kan niet via import, per product in Picqer (Product → Aanvulstrategie).', link:L.ronde },
  { id:'o-1001-rollen', datum:'2026-10-01', prio:2, wie:'Daan', titel:'Rollen per cm een picklocatie geven', uitleg:'KOKOS100NAT, spag-120-BLK, 145-0-200-007, SBR-2-0-200 staan alleen op bulk: met "houd in backorder" blijft elke order hangen. Voorstel staat in Aanvulbase (filter: nieuwe picklocatie).', link:L.base },
  { id:'o-1002-abbase', datum:'2026-10-02', prio:2, wie:'Daan', titel:'Aanvulbase: A- en B-producten bevestigen en importeren', uitleg:'Aanvulbase → filter ABC A/B → controleren → Bevestig zichtbare → Picqer-import aanvulniveaus. Test eerst met 3 producten.', link:L.base },
  { id:'o-1002-week', datum:'2026-10-02', prio:3, wie:'Daan', titel:'Weekafsluiting: cijfers vastleggen', uitleg:'Vandaag-scherm: aantal orders dat vastzit door bulk, VST-orders, adviesregels. Vergelijk volgende week.', link:'#/' },
  // ---- week 41: aanvulbase per afdeling ----
  { id:'o-1005-rubber', datum:'2026-10-05', prio:2, wie:'Daan', titel:'Aanvulbase hal C en DA–DE (rubber, tegels, rollen)', uitleg:'Vloerpick = hele pallet. Controleer stuks per pallet (Palletlabels) en bevestig per gang, daarna import.', link:L.base + '?gang=CA,CB,CC,CD,CE,CF,DA,DB,DC,DD,DE' },
  { id:'o-1005-selected', datum:'2026-10-05', prio:2, wie:'Daan', titel:'Selected-container voorbereiden', uitleg:'Containers: producten invullen en verdeling vóór de losdag.', link:L.cont },
  { id:'o-1006-midden', datum:'2026-10-06', prio:2, wie:'Daan', titel:'Aanvulbase midden (AD/AE/AF legborden)', uitleg:'Legbord = aanvullen met een doos. Vul per product in hoeveel er op de picklocatie past (vul aan tot).', link:L.base + '?gang=AD,AE,AF' },
  { id:'o-1007-wb', datum:'2026-10-07', prio:2, wie:'Daan', titel:'Aanvulbase whiteboards (AF/AG/BA)', uitleg:'Bevestig per gang, daarna import.', link:L.base + '?gang=AG,BA' },
  { id:'o-1008-stoelen', datum:'2026-10-08', prio:2, wie:'Daan', titel:'Aanvulbase stoelen (BD–BF) en BX/BY/BZ', uitleg:'Bevestig per gang, daarna import.', link:L.base + '?gang=BD,BE,BF,BX,BY,BZ' },
  { id:'o-1009-koppel', datum:'2026-10-09', prio:1, wie:'Daan', titel:'Picklocaties koppelen voor lopers zonder picklocatie', uitleg:'Aanvulbase → filter "nieuwe picklocatie" → controleren → koppel-import (test eerst 2 producten).', link:L.base + '?f=nieuw' },
  { id:'o-1009-twijfel', datum:'2026-10-09', prio:2, wie:'Daan', titel:'Beslis de 25 twijfel-locaties', uitleg:'Locaties → Aandachtspunten: hoog maar pick (16), vloer maar bulk (9). Daarna locatie-import.', link:L.loc },
  // ---- week 42: opruimen ----
  { id:'o-1012-ba', datum:'2026-10-12', prio:2, wie:'Daan · team', titel:'BA-dubbelingen opruimen', uitleg:'Producten van BA..-06 naar BA..06 verplaatsen (12 locaties met producten), daarna de -06 locaties archiveren.', link:L.loc },
  { id:'o-1012-retour', datum:'2026-10-12', prio:2, wie:'Daan · Kate', titel:'Retourflow ontwerpen', uitleg:'Eigen chat in het project met retouren-flow.md: wie doet wat, wanneer, welk scherm. Kate is eigenaar.', link:null },
  { id:'o-1013-rommel', datum:'2026-10-13', prio:2, wie:'Daan · team', titel:'Rommel-locaties leegmaken', uitleg:'".", kwijt, Jim kantoor, tafels, Cf- Stellingkast 1-3, af23A00, bd05a30, CF-06-*, producten op gang-/niveaumappen. Lijst in Locaties.', link:L.loc },
  { id:'o-1014-bulkA', datum:'2026-10-14', prio:2, wie:'Valerii · Sala', titel:'Bulk-controleronde hal A', uitleg:'Klopt wat er in de stelling staat met Picqer? Niet-gekoppelde pallets koppelen of verplaatsen. Lijst per gang in Locaties.', link:L.loc },
  { id:'o-1015-bulkB', datum:'2026-10-15', prio:2, wie:'Valerii · Sala', titel:'Bulk-controleronde hal B', uitleg:'Idem hal B (BA–BF, BX/BY/BZ).', link:L.loc },
  { id:'o-1016-bulkC', datum:'2026-10-16', prio:2, wie:'Valerii · Sala', titel:'Bulk-controleronde hal C en DA–DE', uitleg:'Idem hal C.', link:L.loc },
  // ---- week 43: borgen ----
  { id:'o-1019-ritme', datum:'2026-10-19', prio:1, wie:'Daan · team', titel:'Vaste aanvulmomenten invoeren', uitleg:'Voorstel: 07:30 Nu verplaatsen, 13:00 aanvulronde, 16:30 Verwerk backorders. Wie doet wat (reachtruck).', link:'#/' },
  { id:'o-1020-halc', datum:'2026-10-20', prio:3, wie:'Daan', titel:'Hal C en DA–DE uitdiepen', uitleg:'Looproute en gangvolgorde vastleggen, zodat de app lijsten in looprichting sorteert.', link:L.loc },
  { id:'o-1021-legbord', datum:'2026-10-21', prio:3, wie:'Daan', titel:'Legbordcapaciteit midden vastleggen', uitleg:'Per product max aantal op de picklocatie (vul aan tot). Aanvulbase → filter legbord.', link:L.base + '?f=legbord' },
  { id:'o-1022-maxime', datum:'2026-10-22', prio:2, wie:'Daan · Maxime', titel:'Maxime: app laten zien en koppeling bespreken', uitleg:'app-fundament.md + demo IVOL Warehouse. Vraag: API-sleutel met alleen lezen (producten, voorraad per locatie, voorraadgeschiedenis, backorders, verkoop). Voorraad per locatie en geschiedenis zijn niet te exporteren in Picqer.', link:null },
  { id:'o-1023-eval', datum:'2026-10-23', prio:3, wie:'Daan', titel:'Evaluatie aanvullen', uitleg:'Hoeveel orders zaten vast door bulk op 30-9 en nu? Wat kost de aanvulronde?', link:'#/' },
  // ---- week 44 ----
  { id:'o-1026-verkoop', datum:'2026-10-26', prio:2, wie:'Daan', titel:'Aanvulbase herberekenen met verse verkoop', uitleg:'Magazijnverkopen 6 maanden inladen; app past voorstellen aan; afwijkingen importeren.', link:L.geg },
  { id:'o-1028-retour', datum:'2026-10-28', prio:3, wie:'Kate · Hektor', titel:'Nieuwe retourflow testen', uitleg:'Volgens het ontwerp uit week 42.', link:null },
  { id:'o-1030-maand', datum:'2026-10-30', prio:2, wie:'Daan', titel:'Maandafsluiting oktober', uitleg:'KPI\'s, besluit over de Picqer-koppeling, planning november.', link:'#/' }
];

// elke werkdag
const DAGRITME = [
  { id:'d-exports', tijd:'07:30', titel:'Backorders + aanvuladvies-PDF inladen', uitleg:'Productexport 1× per week (maandag).', link:L.geg },
  { id:'d-nuverpl', tijd:'08:00', titel:'Nu verplaatsen afwerken', uitleg:'Daarna in Picqer: Backorders → Verwerk backorders.', link:L.aanvullen },
  { id:'d-vst', tijd:'10:00', titel:'Van VST: terughalen nodig?', uitleg:'Mailtekst voor Edwin staat klaar.', link:L.vst },
  { id:'d-ronde', tijd:'13:00', titel:'Aanvulronde per gang', uitleg:'Aftikken + aanvulniveaus bijstellen waar het schuurt.', link:L.ronde },
  { id:'d-eind', tijd:'16:30', titel:'Verwerk backorders + advies leeg?', uitleg:'Wat blijft staan: waarom? (Vastzittend)', link:L.aanvullen + '/vast' }
];

// wat de app nog van Daan nodig heeft (niet gevraagd, hier verzameld)
const VRAGEN = [
  { id:'v-verkoop', titel:'Magazijnverkopen elke maand (1e werkdag): vorige maand, alle leveranciers', waarom:'Verkoop per maand staat erin t/m september 2026. Elke maand één bestand erbij, maand in de naam: "Magazijnverkopen 2026-10.xlsx".', waar:'Picqer → Rapporten → Magazijnverkopen → inladen bij Gegevens.' },
  { id:'v-2025', titel:'Klopt de volgorde van de verkoop 2025-09 t/m 2025-12?', waarom:'Die vier bestanden hadden geen datum; op volgorde van export als sep–dec 2025 genoemd. 2026-01 t/m 09 is gecontroleerd (totaal gelijk aan de export 1-1 t/m 30-9).', waar:'' },
  { id:'v-mutaties', titel:'Voorraadgeschiedenis / verplaatsingen', waarom:'Per product zichtbaar in Picqer, niet als export; wel via de API (met locatie, reden en wie). Dan leert de app hoeveel er per keer wordt aangevuld.', waar:'Via Maxime (alleen lezen).' },
  { id:'v-legbord', titel:'Hoeveel past er op een legbordlocatie (midden, whiteboards)?', waarom:'Bepaalt "vul aan tot" voor klein spul. Per product invullen in Aanvulbase of een vuistregel per gang.', waar:'Aanvulbase → filter legbord.' },
  { id:'v-avloer', titel:'Hal A vloer (00): altijd een pallet, of ook bakken/dozen?', waarom:'Vloerpick = aanvullen met een hele pallet. Klopt dat ook in hal A?', waar:'' },
  { id:'v-ritme', titel:'Vaste aanvulmomenten en wie (reachtruck)', waarom:'Dan zet de app het dagritme op naam en tijd.', waar:'' },
  { id:'v-twijfel', titel:'De 25 twijfel-locaties: pick of bulk?', waarom:'Staan buiten de locatie-import van 30-9.', waar:'Locaties → Aandachtspunten.' },
  { id:'v-route', titel:'Looproute per hal (vooral hal C en DA–DE)', waarom:'Lijsten nu op gang/sectie gesorteerd; met de looproute in looprichting.', waar:'' },
  { id:'v-vstdag', titel:'VST: vaste lever- en ophaaldagen, tot hoe laat bestellen?', waarom:'Dan plant de app het terughalen op de juiste dag.', waar:'' },
  { id:'v-sql', titel:'Eigen tabellen in Supabase (1× SQL plakken)', waarom:'Nu staat de aanvulbase als één blok in de catalog-tabel. Werkt, maar eigen tabellen zijn sneller en veiliger bij veel gebruikers.', waar:'Pas als de basis stabiel is.' },
  { id:'v-api', titel:'Picqer-koppeling via Maxime (alleen lezen eerst)', waarom:'Geen exports meer. Gepland week 43.', waar:'' }
];

const weekNr = d => { const t = new Date(d + 'T12:00:00'); const j = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())); const dag = j.getUTCDay() || 7; j.setUTCDate(j.getUTCDate() + 4 - dag); const y = new Date(Date.UTC(j.getUTCFullYear(), 0, 1)); return Math.ceil(((j - y) / 864e5 + 1) / 7); };
const werkdag = d => { const w = new Date(d + 'T12:00:00').getDay(); return w >= 1 && w <= 5; };

return { TAKEN, DAGRITME, VRAGEN, weekNr, werkdag };
})();
