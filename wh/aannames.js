/* =====================================================================
   IVOL Warehouse 3.0 — Aannames (15-10-2026)
   Alles wat Claude heeft ingevuld zonder dat Daan het zei, staat hier op één plek.
   3.0 → Te controleren toont elke aanname; Daan zet hem op ✓ of past de waarde aan.
   Zijn keuze staat in catalog-rij `wh-aannames` = { <id>: { ok:true, waarde, op, door } } en gaat voor op de waarde hieronder.
   Geen bedrijfsdata hier (openbare repo): alleen regels en grenzen.
   ===================================================================== */
window.WHAAN = (function(){
'use strict';
const LIJST = [
  // kerncijfers: [oranje vanaf, rood vanaf]
  { id:'k-o12', groep:'Kerncijfers', t:'Orders (picklijsten) ouder dan 12 uur', waarde:'1 · 1', eenheid:'oranje vanaf · rood vanaf', waarom:'Daan (kennisbank A1.9): om 12:00 zijn alle orders ouder dan 12 uur verwerkt. Vóór 12:00 oranje, na 12:00 rood.' },
  { id:'k-o24', groep:'Kerncijfers', t:'Open picklijsten ouder dan 24 uur', waarde:'1 · 1', eenheid:'oranje vanaf · rood vanaf', waarom:'Ouder dan een dag is altijd een probleem.' },
  { id:'k-bo', groep:'Kerncijfers', t:'Backorders (aantal orders)', waarde:'10 · 25', eenheid:'oranje vanaf · rood vanaf', waarom:'Schatting Claude; nog geen nulmeting.' },
  { id:'k-nu', groep:'Kerncijfers', t:'Nu verplaatsen open (na 12:00)', waarde:'1 · 5', eenheid:'oranje vanaf · rood vanaf', waarom:'Wat een klantorder vrijmaakt, hoort vóór de middag gedaan te zijn.' },
  { id:'k-taak', groep:'Kerncijfers', t:'Taken achter', waarde:'1 · 3', eenheid:'oranje vanaf · rood vanaf', waarom:'Schatting Claude.' },
  { id:'k-geen', groep:'Kerncijfers', t:'Producten met voorraad op "geen specifieke locatie"', waarde:'1 · 50', eenheid:'oranje vanaf · rood vanaf', waarom:'Daan (A1.2): niets staat op geen specifieke locatie. Doel 0.' },
  // dagritme: waarde = "uu:mm · wie · wat"
  { id:'d-01', groep:'Dagritme gewone dag', t:'Ochtendoverleg coördinatoren', waarde:'07:00 · Kate, Sala', waarom:'Daan (A1.1): planning, taken, prioriteiten en aandachtspunten verdeeld.' },
  { id:'d-02', groep:'Dagritme gewone dag', t:'Nu verplaatsen (wat een order vrijmaakt)', waarde:'07:15 · rijder', waarom:'Eerst de klant: oudste order eerst (besluit 1.2).' },
  { id:'d-03', groep:'Dagritme gewone dag', t:'Picken op prioriteit', waarde:'07:30 · pickers', waarom:'Daan (A1.5).' },
  { id:'d-04', groep:'Dagritme gewone dag', t:'Aanvulronde 1', waarde:'10:00 · rijder', waarom:'Schatting Claude.' },
  { id:'d-05', groep:'Dagritme gewone dag', t:'Check: orders ouder dan 12 uur', waarde:'11:30 · Kate', waarom:'Zodat om 12:00 alles ouder dan 12 uur weg is (A1.9).' },
  { id:'d-06', groep:'Dagritme gewone dag', t:'Kerncijfers lezen', waarde:'12:00 · Daan', waarom:'Schatting Claude.' },
  { id:'d-07', groep:'Dagritme gewone dag', t:'Aanvulronde 2', waarde:'13:00 · rijder', waarom:'Schatting Claude.' },
  { id:'d-08', groep:'Dagritme gewone dag', t:'Van VST en VST-mail', waarde:'14:00 · Karin', waarom:'Schatting Claude; ritdagen nog onbekend (kennisbank J3).' },
  { id:'d-09', groep:'Dagritme gewone dag', t:'Verzendklaar voor de cut-off', waarde:'15:30 · Sala', waarom:'Cut-off-tijden nog onbekend (kennisbank C4).' },
  { id:'d-10', groep:'Dagritme gewone dag', t:'Einde dag: vloer vrij, gangen berijdbaar, geen rommel/bandjes/hout', waarde:'16:30 · Kate', waarom:'Daan (A1.4).' },
  { id:'c-01', groep:'Containerdag (extra)', t:'Ruimte vrijmaken en labels printen', waarde:'dag ervoor · Kate', waarom:'Daan (A1.6): ruimte vooraf vrij, labels klaar.' },
  { id:'c-02', groep:'Containerdag (extra)', t:'Stockmove en VST-lijst', waarde:'07:00 · Karin', waarom:'Masterdocument §3.5.' },
  { id:'c-03', groep:'Containerdag (extra)', t:'Lossen volgens de 7 stappen', waarde:'na aankomst · Kate + rijder', waarom:'Containers → Containerdag.' },
  { id:'c-04', groep:'Containerdag (extra)', t:'Controle: alles op een plek in Picqer', waarde:'einde dag · Kate', waarom:'Containers → Controle.' },
  // productdata: de regels achter de schattingen
  { id:'p-lvl', groep:'Productdata-schattingen', t:'Aanvullen bij (als er niets bekend is)', waarde:'± 1 week verkoop, minimaal 1', waarom:'Regel uit het masterdocument §10.' },
  { id:'p-max', groep:'Productdata-schattingen', t:'Max op pick (als er niets bekend is)', waarde:'bij + volle pallet; anders ± 3 weken verkoop', waarom:'Afspraak 8-10 (max = bij + wat je bijvult) en masterdocument §10.' },
  { id:'p-maat', groep:'Productdata-schattingen', t:'Palletmaat (als er niets bekend is)', waarde:'80x120, of de kleinste maat waar het product in past', waarom:'Schatting Claude.' },
  { id:'p-hoogte', groep:'Productdata-schattingen', t:'Hoogte incl. pallet (als er niets bekend is)', waarde:'hal A 120 cm · hal B/C 150 cm', waarom:'Max bulk hal A 140, hal B/C 220 (masterdocument §2).' },
  { id:'p-gew', groep:'Productdata-schattingen', t:'Gewicht volle pallet', waarde:'stuks × Picqer-gewicht + 15 kg', waarom:'Getoetst 82% (productdata-bronnen).' },
  { id:'p-lig', groep:'Productdata-schattingen', t:'Max pallets per ligger', waarde:'2000 kg per ligger; 3 plaatsen (hal A), 4 (hal B/C)', waarom:'Bulkvoorstel containerdag (masterdocument §10).' },
  // locaties (ronde 3, 16-10): keuzes van Claude bij het bouwen van Locaties opruimen
  { id:'l-map', groep:'Locaties opruimen', t:'Wat is een map', waarde:'bovenliggende locatie, of gang-/sectie-/plaatsnaam op tijdelijk', waarom:'Uit ronde 1c (Live advies). Container 1–6 telt als retourkar, niet als losse naam.' },
  { id:'l-hoog', groep:'Locaties opruimen', t:'Hoge pick op tijdelijk', waarde:'alleen onder Hoog maar pick', waarom:'Schatting Claude: één locatie hoort in één tabel, anders botsen "moet vast" en "wordt bulk, tijdelijk".' },
  { id:'l-vr', groep:'Locaties opruimen', t:'Voorraad hier', waarde:'live stand als die nieuwer is dan de voorraad-export', waarom:'Schatting Claude: de nieuwste stand beslist of ontkoppelen kan.' },
  { id:'l-geteld', groep:'Locaties opruimen', t:'Geteld en weggezet / Teruggezet', waarde:'klaar tot een nieuwere voorraad-export het weer laat zien', waarom:'Schatting Claude: het is alleen een notitie; de volgende export controleert het.' },
  { id:'l-waar', groep:'Locaties opruimen', t:'Waarden in de locatie-import', waarde:'WAAR / ONWAAR', waarom:'Zelfde formaat als de locatie-import die Picqer op 30-9 accepteerde.' },
  { id:'l-30d', groep:'Locaties opruimen', t:'Verwerkte besluiten in "gaat niet mee"', waarde:'30 dagen zichtbaar', waarom:'Schatting Claude: daarna alleen nog als ✓ in de tabellen.' },
  // aanvullen (ronde C, 16-10)
  { id:'a-pal', groep:'Aanvullen', t:'Aanvullen met volle pallet: hoeveel pallets', waarde:'afronden op hele pallets, minimaal 1, niet boven max op pick', waarom:'Schatting Claude: afspraak 8-10 (max = bij + een volle pallet).' },
  { id:'a-bulk', groep:'Aanvullen', t:'Welke bulkpallet', waarde:'eerst een plek met precies één pallet, dan een plek met een veelvoud; in looproute', waarom:'Schatting Claude; reserveringen op bulk tellen niet als volle pallet.' },
  // Per familie (16-10): regelcontrole in de cel en eenheid per familie
  { id:'p-ligkg', groep:'Productdata-regels', t:'Max gewicht per ligger', waarde:'2000', eenheid:'kg per ligger', waarom:'Bulkvoorstel containerdag (masterdocument §10): max pallets per ligger × gewicht volle pallet mag hier niet boven.' },
  { id:'p-dooskg', groep:'Productdata-regels', t:'Max gewicht per doos', waarde:'30', eenheid:'kg per doos', waarom:'Regel Daan: tot 30 kg een doos via DPD/DHL pakket, boven 30 kg een pallet via VST/DHL Freight. Uitzonderingen bestaan: Deze houden.' },
  { id:'p-dooscm', groep:'Productdata-regels', t:'Stuks per doos bij producten per cm', waarde:'50', eenheid:'cm, naar beneden afronden', waarom:'Max cm onder het doosgewicht, met gewicht per cm = (gewicht volle pallet − 15 kg pallet) / stuks per pallet. Schatting Claude: afronden op 50 cm.' },
  { id:'p-ehcm', groep:'Productdata-regels', t:'Eenheid vast per familie', waarde:'Kokos op rol: cm (Picqer-eenheid negeren)', waarom:'Besluit Daan 16-10: de 24 mm-rollen staan in Picqer per stuk, maar alles is per cm. Per familie aan of uit te zetten in Per familie.' },
  { id:'p-mix', groep:'Productdata-schattingen', t:'Mix: geleverd', waarde:'wisselt, tot de inkoop het aantal per doos bevestigt', waarom:'Schatting Claude.' }
];
const S = { keus:null, laden:null };
async function laad(vers){
  if(S.laden && !vers) return S.laden;
  S.laden = (async () => { try{ const r = await WH.catHaal('wh-aannames'); S.keus = (r && r.data) || {}; }catch(e){ S.keus = S.keus || {}; } return S.keus; })();
  return S.laden;
}
const keus = id => (S.keus || {})[id] || null;
const waarde = id => { const k = keus(id), a = LIJST.find(x => x.id === id); return k && k.waarde ? k.waarde : a ? a.waarde : ''; };
const open = () => LIJST.filter(a => !(keus(a.id) && keus(a.id).ok));
// grenzen "oranje · rood" als getallen
const grens = id => { const p = String(waarde(id)).split(/[·;,/]/).map(s => parseFloat(s)); return { oranje:isNaN(p[0]) ? 1 : p[0], rood:isNaN(p[1]) ? (isNaN(p[0]) ? 1 : p[0]) : p[1] }; };
async function zet(id, w){
  const door = (() => { try{ return localStorage.getItem('ivol-ik') || 'Daan'; }catch(e){ return 'Daan'; } })();
  const item = { ok:true, waarde:w, op:new Date().toISOString(), door };
  S.keus = Object.assign({}, S.keus, { [id]:item });
  await WH.catPatch('wh-aannames', { [id]:item });
}
async function terug(id){ const n = Object.assign({}, S.keus); delete n[id]; S.keus = n; await WH.catPatch('wh-aannames', { [id]:null }); }
return { LIJST, laad, keus, waarde, open, grens, zet, terug };
})();
