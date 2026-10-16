/* =====================================================================
   IVOL Warehouse 3.0 — Aannames (15-10-2026, bijgewerkt 16-10-2026 met de besluiten van Daan)
   Alles wat Claude heeft ingevuld zonder dat Daan het zei, staat hier op één plek.
   3.0 → Te controleren toont elke aanname; Daan zet hem op ✓ of past de waarde aan.
   Zijn keuze staat in catalog-rij `wh-aannames` = { <id>: { ok, waarde, op, door } } en gaat altijd voor.
   `bevestigd` = Daan heeft het in de chat besloten (16-10); telt als ✓ zolang er geen eigen keuze in de catalog staat.
   `bevestigd.sinds` = Daan besliste in de chat iets nieuws (ronde 2, 16-10): een keuze in de app van vóór dat moment telt dan niet meer,
   een latere keuze (Klopt, aanpassen, Opnieuw) wel. De rij in de catalog blijft staan.
   Geen bedrijfsdata hier (openbare repo): alleen regels en grenzen.
   ===================================================================== */
window.WHAAN = (function(){
'use strict';
const CHAT = { door:'Daan (chat)', op:'2026-10-16' };
const CHAT2 = { door:'Daan (chat)', op:'2026-10-16', sinds:'2026-10-16T14:35:00.000Z' };   // ronde 2: nieuwer dan eerdere keuzes in de app
const LIJST = [
  // kerncijfers: [oranje vanaf, rood vanaf]
  { id:'k-o12', groep:'Kerncijfers', t:'Orders (picklijsten) ouder dan 12 uur', waarde:'1 · 1', eenheid:'oranje vanaf · rood vanaf (telt vanaf 12:00)', waarom:'Daan 16-10: vanaf 12:00 de orders van gisteren oppakken, niet pas om 16:00. Vóór 12:00 neutraal.', bevestigd:CHAT },
  { id:'k-o24', groep:'Kerncijfers', t:'Open picklijsten ouder dan 24 uur', waarde:'4 · 8', eenheid:'oranje vanaf · rood vanaf', waarom:'Daan 16-10: tot 3 goed, 4–7 oranje, boven 7 rood.', bevestigd:CHAT2 },
  { id:'k-bo2', groep:'Kerncijfers', t:'Backorders die wij oplossen', waarde:'5 · 10', eenheid:'oranje vanaf · rood vanaf', waarom:'Daan 16-10: orders in backorder waarvan de voorraad in eigen bulk ligt (aanvullen/verplaatsen lost ze op), plus backorders waarvoor een container binnenkomt. Echte backorders (wachten op inkoop) tellen niet. Grens: Daan 16-10.', bevestigd:CHAT2 },
  { id:'k-nu', groep:'Kerncijfers', t:'Nu verplaatsen open (na 12:00)', waarde:'5 · 11', eenheid:'oranje vanaf · rood vanaf', waarom:'Daan 16-10: tot 4 goed, 5–10 oranje, boven 10 rood. Wat een klantorder vrijmaakt, hoort vóór de middag gedaan te zijn.', bevestigd:CHAT2 },
  { id:'k-taak', groep:'Kerncijfers', t:'Taken achter', waarde:'4 · 6', eenheid:'oranje vanaf · rood vanaf', waarom:'Daan 16-10: tot 3 goed, 4–5 oranje, boven 5 rood.', bevestigd:CHAT2 },
  { id:'k-geen', groep:'Kerncijfers', t:'Producten met voorraad op "geen specifieke locatie"', waarde:'26 · 76', eenheid:'oranje vanaf · rood vanaf', waarom:'Daan 16-10: tot 25 goed, 26–75 oranje, boven 75 rood. Doel blijft 0 (A1.2). Voorraad van een opgeboekte container die wacht op lossen/Stockmove telt niet mee.', bevestigd:CHAT2 },
  // dagritme: waarde = "wanneer · wie · extra"
  { id:'d-01a', groep:'Dagritme gewone dag', t:'Ochtendoverleg', waarde:'08:00 · Daan, Karin, Kate', waarom:'Daan 16-10 (was 07:00 Kate, Sala). A1.1: planning, taken, prioriteiten en aandachtspunten verdeeld.', bevestigd:CHAT2 },
  { id:'d-01b', groep:'Dagritme gewone dag', t:'Ochtendoverleg', waarde:'09:00 · Daan, Kate, Sala', waarom:'Daan 16-10. A1.1: planning, taken, prioriteiten en aandachtspunten verdeeld.', bevestigd:CHAT2 },
  { id:'d-rij', groep:'Dagritme gewone dag', t:'Aanvullen en verplaatsen: aanvuladvies op de scanner volgen', waarde:'hele dag · rijder · 1e prioriteit', waarom:'Daan 16-10: één doorlopende taak van de rijder, feitelijk elk 1–2 uur (was: Nu verplaatsen, aanvulronde 1 en 2).', bevestigd:CHAT },
  { id:'d-rij2', groep:'Dagritme gewone dag', t:'Extra rijderstaken: container wegrijden, ruimte maken voor container, inkomende goederen op locatie zetten', waarde:'hele dag · rijder', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'d-03', groep:'Dagritme gewone dag', t:'Picken op prioriteit', waarde:'09:00–17:30 · orderpickers', waarom:'Daan 16-10 (was 07:30). A1.5.', bevestigd:CHAT2 },
  { id:'d-08a', groep:'Dagritme gewone dag', t:'VST-mail: alles wat we vandaag willen ontvangen', waarde:'ochtend · Karin', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'d-05', groep:'Dagritme gewone dag', t:'Oude orders oppakken (wachten op spullen, driver, zoekwerk)', waarde:'12:00–13:00 · Kate, Sala', waarom:'Daan 16-10: rond 12/13:00 oppakken voorkomt stress, afboekingen en een dag later bestellen.', bevestigd:CHAT },
  { id:'d-06', groep:'Dagritme gewone dag', t:'Kerncijfers lezen', waarde:'12:00 · Daan', waarom:'Daan 16-10: klopt.', bevestigd:CHAT },
  { id:'d-08b', groep:'Dagritme gewone dag', t:'VST-mail: aanvulling voor morgen', waarde:'16:30 · Karin', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'d-10', groep:'Dagritme gewone dag', t:'Einde dag: vloer vrij, gangen berijdbaar, geen rommel/bandjes/hout', waarde:'17:00–17:30 · Kate, Sala', waarom:'Daan 16-10: controle, pickers aansturen waar nodig (was 16:30 Kate). A1.4.', bevestigd:CHAT2 },
  // containerdag: wanneer t.o.v. de losdag
  { id:'c-ruimte', groep:'Containerdag (extra)', t:'Ruimte vrijmaken', waarde:'1–3 dagen vooraf · rijder, Sala of Daan', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'c-labels', groep:'Containerdag (extra)', t:'Labels printen', waarde:'dag ervoor · Karin of Daan', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'c-stock', groep:'Containerdag (extra)', t:'Stockmove en VST-lijst', waarde:'dag ervoor ± 17:00 · Karin', waarom:'Daan 16-10: kan pas als Jim de container in Picqer heeft opgeboekt en de voorraad op "geen specifieke locatie" staat; dan via de Stockmove-app naar VST verplaatsen en palletnummers printen.', bevestigd:CHAT },
  { id:'c-los', groep:'Containerdag (extra)', t:'Lossen, uitrijden, sealen', waarde:'bij aankomst · magazijnmedewerkers', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'c-stuur', groep:'Containerdag (extra)', t:'Aansturen, controleren, labelen', waarde:'bij aankomst · Kate (anders Daan of Sala)', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'c-weg', groep:'Containerdag (extra)', t:'Wegrijden en op locatie zetten', waarde:'bij aankomst · rijder', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'c-controle', groep:'Containerdag (extra)', t:'Controle: alles op een plek in Picqer', waarde:'einde dag · Daan, anders Karin', waarom:'Daan 16-10.', bevestigd:CHAT },
  // productdata: de regels achter de schattingen (als er niets bekend is)
  { id:'p-lvl', groep:'Productdata-schattingen', t:'Aanvullen bij (als er niets bekend is)', waarde:'1', waarom:'Daan 16-10: de echte waarde hangt af van product, locatie, ruimte en pallet/doos/los.', bevestigd:CHAT },
  { id:'p-max', groep:'Productdata-schattingen', t:'Aanvullen met en max op pick (als er niets bekend is)', waarde:'aanvullen met minimaal 1 à 2 weken verkoop; max op pick = bij + aanvullen met', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'p-maat', groep:'Productdata-schattingen', t:'Palletmaat L×B×H (als er niets bekend is)', waarde:'midden 80x120x160 · bureaustoel 80x120x180 · whiteboard t/m 80x120: 80x120x180, groter: kleinste van 100x150, 120x150, 120x180, 100x200 (onbekend 100x150x140) · sportvloer tegel en rubber tegel CE 110x110x160 · rubber ringmat 100x150x120 · rubber rol ≤120 breed 80x120x140, 120–160 100x150x100, >160 120x180x100 · rest 80x120x180', waarom:'Daan 16-10. Productmaat uit naam/omschrijving; alleen opslagmaten 80x120, 90x120, 100x100, 100x150, 110x110, 120x150, 120x180, 100x200, 120x200, 120x240 (nooit 40x120/40x200, 130x210, 130x250, 120x210: alleen transport).', bevestigd:CHAT },
  { id:'p-wbh', groep:'Productdata-schattingen', t:'Hoogte pallet grote whiteboards (maat bekend)', waarde:'140', eenheid:'cm incl. pallet', waarom:'Daan 16-10: klopt. Zelfde als bij onbekende maat (100x150x140). Past een board op geen van de vier grote maten (bijv. 120x240), dan de kleinste opslagmaat waar het wel op past.', bevestigd:CHAT },
  { id:'p-hoogte', groep:'Productdata-schattingen', t:'Hoogte incl. pallet (als er niets bekend is)', waarde:'de H uit de palletmaat-regel', waarom:'Daan 16-10 (L×B×H).', bevestigd:CHAT },
  { id:'p-gew', groep:'Productdata-schattingen', t:'Gewicht volle pallet', waarde:'stuks × Picqer-gewicht + 15 kg', waarom:'Daan 16-10. Sterk afwijkend van de familie: gemarkeerd met "klopt dit gewicht in Picqer?".', bevestigd:CHAT },
  { id:'p-gewafw', groep:'Productdata-schattingen', t:'Wanneer is een Picqer-gewicht afwijkend', waarde:'meer dan 2× of minder dan de helft van de mediaan van de familie', waarom:'Daan 16-10: klopt.', bevestigd:CHAT },
  { id:'p-lig', groep:'Productdata-schattingen', t:'Max pallets per ligger', waarde:'2000 kg per ligger; past de laatste pallet er niet onder → andere ligger', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'p-mix', groep:'Productdata-schattingen', t:'Mix: geleverd', waarde:'nooit/zelden volle pallets; meestal meerdere per doos; verschillende producten op een mixpallet', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'p-gesch', groep:'Productdata-schattingen', t:'Leren uit de verplaatsingen', waarde:'3× of vaker de hele voorraad van een bulklocatie naar pick = volle pallet; 3× of vaker hetzelfde aantal van een bulklocatie (niet de hele voorraad) = deel van een pallet, stuks = het gemiddelde daarvan; retourkar telt niet', waarom:'Daan 16-10. Hele voorraad = de bulklocatie was daarna leeg, teruggerekend vanaf de voorraad-export.', bevestigd:CHAT2 },
  // locaties opruimen
  { id:'l-map', groep:'Locaties opruimen', t:'Wat is een map', waarde:'tussenniveau (gang AD, stelling AD13) zonder product: geen probleem; product op een tussenniveau: melden; zelfgemaakte vloerplekken (Sportvloer bulk, BE-tafel …): niet melden', waarom:'Daan 16-10. Echte locatie = gang + stelling + plaats A–D + hoogte 00–30 (AA02A00, AD13C10). Container 1–6 = retourkar.', bevestigd:CHAT },
  { id:'l-hoog', groep:'Locaties opruimen', t:'Hoog (10/20/30)', waarde:'altijd bulk + tijdelijk, ook leeg in AE/AF; uitzondering alleen AE/AF met een vast product dat daar gepickt wordt en geen andere picklocatie heeft', waarom:'Daan 16-10.', bevestigd:CHAT },
  { id:'l-vr', groep:'Locaties opruimen', t:'Voorraad hier', waarde:'de voorraad-export beslist, niet de live stand', waarom:'Daan 16-10: zegt de laatste export voorraad, dan niet ontkoppelen (eerst een nieuwe export), ook als live 0 zegt.', bevestigd:CHAT },
  { id:'l-geteld', groep:'Locaties opruimen', t:'Geteld en weggezet', waarde:'nieuwe export 0 → ✓ houden; nog voorraad → weer open en taak voor Kate', waarom:'Daan 16-10. Voorraad van een opgeboekte container die wacht op lossen/Stockmove staat apart.', bevestigd:CHAT },
  { id:'l-waar', groep:'Locaties opruimen', t:'Waarden in de locatie-import', waarde:'WAAR / ONWAAR', waarom:'Daan 16-10: klopt.', bevestigd:CHAT },
  { id:'l-30d', groep:'Locaties opruimen', t:'Verwerkte besluiten', waarde:'niet in "Gaat niet mee"; alleen ✓ in de gang-tabel', waarom:'Daan 16-10.', bevestigd:CHAT },
  // aanvullen
  { id:'a-pal', groep:'Aanvullen', t:'Aanvullen met volle pallet: hoeveel', waarde:'onder "bij" → 1 volle pallet; orders vragen meer dan max → wat de orders vragen, ook boven max; pallet groter dan max → hele dozen plus de losse stuks tot zo dicht mogelijk onder max', waarom:'Daan 16-10 (voorbeeld: 10 per doos, pallet 13 dozen + 3 los, pick 3, max 50 → 4 dozen + 3 los = 46).', bevestigd:CHAT },
  { id:'a-rest', groep:'Aanvullen', t:'Na het restje', waarde:'alleen een volle pallet erbij als de pick dan nog op of onder "bij" zit, of als de orders meer vragen', waarom:'Daan 16-10: klopt. Eerst het restje (deelpallet) weg.', bevestigd:CHAT },
  { id:'a-bulk', groep:'Aanvullen', t:'Welke bulkpallet', waarde:'eerst het restje (deelpallet); daarna maakt het niet uit. Altijd eerst eigen bulk, VST pas als eigen bulk op is', waarom:'Daan 16-10.', bevestigd:CHAT },
  // productdata-regels
  { id:'p-ligkg', groep:'Productdata-regels', t:'Max gewicht per ligger', waarde:'2000', eenheid:'kg per ligger', waarom:'Daan 16-10: overal; past de laatste pallet er niet onder → andere ligger.', bevestigd:CHAT },
  { id:'p-dooskg', groep:'Productdata-regels', t:'Max gewicht per doos', waarde:'30', eenheid:'kg per doos', waarom:'Daan 16-10: t/m 30 kg doos, erboven pallet. Whiteboards t/m 90x120 altijd pakket (uitzondering verrijdbaar 90x120). Verzendregels bepaalt Picqer.', bevestigd:CHAT },
  { id:'p-dooscm', groep:'Productdata-regels', t:'Stuks per doos bij producten per cm', waarde:'50', eenheid:'cm, naar beneden afronden', waarom:'Daan 16-10: alleen als Picqer duidelijk "per cm" zegt; nooit boven 30 kg. Rubber rollen per meter: alleen hele meters. Lengte telt ook: DPD max 170 cm.', bevestigd:CHAT },
  { id:'p-dpdcm', groep:'Productdata-regels', t:'Max lengte doos (DPD)', waarde:'170', eenheid:'cm', waarom:'Daan 16-10: DPD max 170 cm; DHL geen max maar toeslagen.', bevestigd:CHAT },
  { id:'p-kokos', groep:'Productdata-regels', t:'Grens breedte kokos doos/pallet', waarde:'', eenheid:'cm breed: breder = pallet', waarom:'Daan 16-10: 200 breed → pallet, 100 breed → doos. De vaste grens volgt nog.' },
  { id:'p-ehcm', groep:'Productdata-regels', t:'Eenheid vast per familie', waarde:'kokos op rol: cm · sportvloer op rol: per meter of per volle rol zoals de productnaam zegt', waarom:'Daan 16-10 ("… volle rol", "… PER meter"); Picqer-eenheid niet volgen als de naam het zegt.', bevestigd:CHAT }
];
const S = { keus:null, laden:null };
async function laad(vers){
  if(S.laden && !vers) return S.laden;
  S.laden = (async () => { try{ const r = await WH.catHaal('wh-aannames'); S.keus = (r && r.data) || {}; }catch(e){ S.keus = S.keus || {}; } return S.keus; })();
  return S.laden;
}
const item = id => LIJST.find(x => x.id === id) || null;
// een eigen keuze in de catalog, tenzij Daan daarna in de chat anders besloot (bevestigd.sinds)
function keus(id){
  const k = (S.keus || {})[id] || null, a = item(id);
  if(k && a && a.bevestigd && a.bevestigd.sinds && (Date.parse(k.op) || 0) < Date.parse(a.bevestigd.sinds)) return null;
  return k;
}
// ✓ of open: een eigen keuze in de catalog gaat altijd voor, anders telt een besluit uit de chat als ✓
function status(id){
  const k = keus(id);
  if(k) return k.ok ? { ok:true, door:k.door || '', op:k.op || '', bron:'app' } : { ok:false };
  const a = item(id);
  return a && a.bevestigd ? { ok:true, door:a.bevestigd.door, op:a.bevestigd.op, bron:'chat' } : { ok:false };
}
const waarde = id => { const k = keus(id), a = item(id); return k && k.waarde ? k.waarde : a ? a.waarde : ''; };
const open = () => LIJST.filter(a => !status(a.id).ok);
// grenzen "oranje · rood" als getallen; 6.10, 6/10, 6 · 10, 6-10, 6,10 en 6 10 betekenen allemaal 6 en 10
const getallen = s => (String(s || '').match(/\d+/g) || []).map(Number);
function grens(id){
  const p = getallen(waarde(id));
  const o = p.length ? p[0] : 1, r = p.length > 1 ? p[1] : o;
  return { oranje:o, rood:Math.max(o, r) };
}
// in gewone taal: "0–5 goed · 6–9 let op · 10+ probleem"
function grensTekst(o, r){
  if(o === undefined){ return ''; }
  if(typeof o === 'string'){ const p = getallen(o); if(!p.length) return ''; r = p.length > 1 ? p[1] : p[0]; o = p[0]; }
  r = Math.max(o, r);
  const deel = (a, b, t) => a > b ? '' : (a === b ? a : a + '–' + b) + ' ' + t;
  return [deel(0, o - 1, 'goed'), deel(o, r - 1, 'let op'), r + '+ probleem'].filter(Boolean).join(' · ');
}
const normGrens = s => { const p = getallen(s); return p.length >= 2 ? p[0] + ' · ' + p[1] : p.length ? String(p[0]) : String(s || '').trim(); };
async function zet(id, w){
  const door = (() => { try{ return localStorage.getItem('ivol-ik') || 'Daan'; }catch(e){ return 'Daan'; } })();
  const a = item(id);
  if(a && a.groep === 'Kerncijfers') w = normGrens(w);
  const it = { ok:true, waarde:w, op:new Date().toISOString(), door };
  S.keus = Object.assign({}, S.keus, { [id]:it });
  await WH.catPatch('wh-aannames', { [id]:it });
}
// opnieuw: eigen keuze weg; een besluit uit de chat gaat weer open (ok:false), zodat hij opnieuw te beoordelen is
async function terug(id){
  const a = item(id), n = Object.assign({}, S.keus);
  if(a && a.bevestigd){
    const door = (() => { try{ return localStorage.getItem('ivol-ik') || 'Daan'; }catch(e){ return 'Daan'; } })();
    n[id] = { ok:false, op:new Date().toISOString(), door }; S.keus = n; await WH.catPatch('wh-aannames', { [id]:n[id] });
  }else{ delete n[id]; S.keus = n; await WH.catPatch('wh-aannames', { [id]:null }); }
}
return { LIJST, laad, keus, status, waarde, open, grens, grensTekst, getallen, zet, terug, S };
})();
