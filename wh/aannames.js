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
const CHAT3 = { door:'Daan (chat)', op:'2026-10-17' };   // masteropdracht 17-10
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
  { id:'p-maat', groep:'Productdata-schattingen', t:'Palletmaat L×B×H (als er niets bekend is)', waarde:'bureaustoel 80x120x180 · whiteboard t/m 80x120: 80x120x180, groter: kleinste opslagmaat waar het bord in past (uit de maat in de naam; onbekend 100x150x140) · sportvloer tegel en rubber tegel CE 110x110x160 · rubber ringmat 100x150x120 · rubber rol ≤120 breed 80x120x140, 120–160 100x150x100, >160 120x180x100 · rest 80x120x180', waarom:'Daan 16-10. Productmaat uit naam/omschrijving; de vaste maat 80x120x160 voor midden-producten vervalt (Daan 17-10: de hoogte hangt af van hal en ligger, hal A heeft een lager dak; hallen en hoogtes zijn nog geen vaste gegevens); alleen opslagmaten 80x120, 90x120, 100x100, 100x150, 110x110, 120x150, 120x180, 100x200, 120x200, 120x240 (nooit 40x120/40x200, 130x210, 130x250, 120x210: alleen transport).', bevestigd:Object.assign({}, CHAT3, { sinds:'2026-10-17T00:00:00.000Z' }) },
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
  { id:'j-vst', groep:'Aanvullen', t:'Naar VST: maanden verkoop die hier blijft', waarde:'1,5', eenheid:'maanden verkoop', waarom:'Daan (kennisbank J1): 1,5 maand verkoop hier, de rest naar VST. Alle voorraad daarboven staat op de lijst Naar VST (Ruimte maken).', bevestigd:{ door:'Daan (kennisbank)', op:'2026-10-27' } },
  { id:'a-pal', groep:'Aanvullen', t:'Aanvullen met volle pallet: hoeveel', waarde:'onder "bij" → 1 volle pallet; orders vragen meer dan max → wat de orders vragen, ook boven max; pallet groter dan max → hele dozen plus de losse stuks tot zo dicht mogelijk onder max', waarom:'Daan 16-10 (voorbeeld: 10 per doos, pallet 13 dozen + 3 los, pick 3, max 50 → 4 dozen + 3 los = 46).', bevestigd:CHAT },
  { id:'a-rest', groep:'Aanvullen', t:'Na het restje', waarde:'alleen een volle pallet erbij als de pick dan nog op of onder "bij" zit, of als de orders meer vragen', waarom:'Daan 16-10: klopt. Eerst het restje (deelpallet) weg.', bevestigd:CHAT },
  { id:'a-bulk', groep:'Aanvullen', t:'Welke bulkpallet', waarde:'eerst het restje (deelpallet); daarna maakt het niet uit. Altijd eerst eigen bulk, VST pas als eigen bulk op is', waarom:'Daan 16-10.', bevestigd:CHAT },
  // productdata-regels
  { id:'p-ligkg', groep:'Productdata-regels', t:'Max gewicht per ligger', waarde:'2000', eenheid:'kg per ligger', waarom:'Daan 16-10: overal; past de laatste pallet er niet onder → andere ligger.', bevestigd:CHAT },
  { id:'p-dooskg', groep:'Productdata-regels', t:'Max gewicht per doos', waarde:'30', eenheid:'kg per doos', waarom:'Daan 16-10: t/m 30 kg doos, erboven pallet. Whiteboards t/m 90x120 altijd pakket (uitzondering verrijdbaar 90x120). Verzendregels bepaalt Picqer.', bevestigd:CHAT },
  { id:'p-dooscm', groep:'Productdata-regels', t:'Stuks per doos bij producten per cm', waarde:'50', eenheid:'cm, naar beneden afronden', waarom:'Daan 16-10: alleen als Picqer duidelijk "per cm" zegt; nooit boven 30 kg. Rubber rollen per meter: alleen hele meters. Lengte telt ook: DPD max 170 cm.', bevestigd:CHAT },
  { id:'p-dpdcm', groep:'Productdata-regels', t:'Max lengte doos (DPD)', waarde:'170', eenheid:'cm', waarom:'Daan 16-10: DPD max 170 cm; DHL geen max maar toeslagen.', bevestigd:CHAT },
  { id:'p-kokos', groep:'Productdata-regels', t:'Kokos op rol: doos of pallet', waarde:'200 breed: lengte boven 200 cm = pallet; 100 breed: gewicht beslist; boven 30 kg altijd pallet', eenheid:'breedte en lengte in cm, gewicht per doos in kg', waarom:'Daan 16-10 (vervangt de eerdere kokosregels): breder dan 100 cm én langer dan 200 cm = pallet. Uitkomst in Productdata: max cm per doos, langer = pallet. Daan controleert nog of dit de vaste richtlijn is.', bevestigd:CHAT2 },
  { id:'p-ehcm', groep:'Productdata-regels', t:'Eenheid vast per familie', waarde:'kokos op rol: cm · sportvloer op rol: per meter of per volle rol zoals de productnaam zegt', waarom:'Daan 16-10 ("… volle rol", "… PER meter"); Picqer-eenheid niet volgen als de naam het zegt.', bevestigd:CHAT },
  // masteropdracht 17-10: regels uit de controlesessies (schattingen), alles besloten door Daan
  { id:'p-sam', groep:'Productdata-regels', t:'SAM Europe (leverancier)', waarde:'alleen picklocatie, bulklocaties en aanvulniveau', waarom:'Daan 17-10. Geen doos, pallet, hoogte, gewicht, plaatsen of mixgroep schatten of vragen; voor de poort tellen die velden als nvt. SAM wordt nooit gecombineerd of vergeleken met andere artikelen: geen familie-, kleurgenoot- of maatgroepwaarden van of naar SAM.', bevestigd:CHAT3 },
  { id:'p-zelfbouw', groep:'Productdata-regels', t:'Zelf gebouwde pallets (los in de container geleverd, bijv. deurmatten, roostermatten)', waarde:'stuks per pallet = grootste geleverde aantal per levering', waarom:'Daan 17-10. Als de verplaatsingen laten zien dat het op één pallet paste; anders het grootste aantal dat in één keer naar bulk ging. Herkenbaar aan de opmerking "Zelf gebouwde pallet …".', bevestigd:CHAT3 },
  { id:'p-pick', groep:'Productdata-regels', t:'Alles op pick, geen bulk (houders, trapleuningen)', waarde:'geen aanvulniveau voorstellen; voor de poort nvt', waarom:'Daan 17-10. Soort 4 pick: alles gaat direct naar de picklocatie.', bevestigd:CHAT3 },
  { id:'p-ruimte', groep:'Productdata-regels', t:'Ruimte gaat voor verkoop', waarde:'is aanvullen bij of max bevestigd, dan geen voorstel "1–2 weken verkoop" eroverheen', waarom:'Daan 17-10.', bevestigd:CHAT3 },
  { id:'p-wacht', groep:'Productdata-regels', t:'Product zonder voorraad: wacht op levering', waarde:'eerst inkoop/containerlijst (pakbon), anders niets schatten tot het product op voorraad is; telt voor de poort als compleet zolang er geen voorraad is', waarom:'Daan 17-10. Zichtbaar als "wacht op levering"; Poort 0.4 noemt hoeveel het er zijn.', bevestigd:CHAT3 },
  { id:'p-rol', groep:'Productdata-regels', t:'Rollen per lengte: eigen pallet of mix', waarde:'lengtes die per 25 of meer worden ingekocht krijgen een eigen pallet, de rest een mix/pick-pallet', waarom:'Daan 17-10. Ribbel 40 en 50 cm: 1, 2 en 3 m eigen pallet (stuks per pallet open), 4 t/m 10 m mix/pick-pallet. Zonder inkoopgegevens geldt deze indeling.', bevestigd:CHAT3 },
  { id:'p-pallets', groep:'Productdata-regels', t:'Palletmaten', waarde:'basis losse producten 80x120x180 · huishoudtrappen 2 treden 80x120, 3 en 4 treden 100x150 · omdozen breder dan 80 cm = 90x120 (2 pallets op een 3-ligger, 3 op een 4-ligger)', waarom:'Daan 17-10. Het rubber ringmat-, whiteboard- en rolbeleid hierboven blijft.', bevestigd:CHAT3 },
  { id:'p-park', groep:'Productdata-regels', t:'Geparkeerd (notitie voor ons geheugen)', waarde:'telt als besproken', waarom:'Geparkeerd telt als besproken; Claude parkeert alleen wat niet nodig is om een bouwplanstap te laten werken. Data of bestanden die een bouwplanstap echt nodig heeft, worden niet geparkeerd. Een geparkeerd veld telt in Poort 0.4 (en elke latere poort) als compleet en staat in de lijst Notities (Te controleren), los van het bouwplan: geen taak en geen teller in Te doen.', bevestigd:CHAT3 },
  { id:'p-pur', groep:'Productdata-regels', t:'PU-leer per meter (PUR-R-…)', waarde:'familie en afdeling = CF rubber rollen per meter (niet midden); aanvulwaarde leeg', waarom:'Daan 17-10.', bevestigd:CHAT3 },
  { id:'p-steek', groep:'Productdata-regels', t:'Steekproef in Poort 0.4', waarde:'20 willekeurige belangrijke producten (geen SAM, niet geparkeerd, niet zonder voorraad, alle getoonde velden gevuld), per product goed of fout; 20 goed = groen. Pas te trekken als laag 1 t/m 3 op 100% staan', waarom:'Daan 17-10. Toont pick, bulk, stuks per pallet en per doos en palletmaat. Een steekproef die is getrokken terwijl er nog velden open stonden vervalt (17-10 04:55).', bevestigd:CHAT3 },
  { id:'p-verworpen', groep:'Productdata-regels', t:'Verworpen = geen voorstel', waarde:'een veld dat leeg staat met bron daan (Daan maakte het bewust leeg) krijgt geen voorstel, geen familie- of kleurgenootwaarde en wordt niet voorgevuld of overgezet uit palletlabels; het telt wel als open zolang het nodig is', waarom:'Daan 17-10 (ronde 0.4b). Voorbeelden: stuks per pallet van de ribbel op maat (100 vervalt), mixgroep van single-mounting-pin.', bevestigd:CHAT3 },
  { id:'p-ribbel-spp', groep:'Productdata-regels', t:'Ribbel op maat: stuks per pallet', waarde:'nooit een "zelfde als"-voorstel van of naar een ribbel op maat (MR65SX2.7-0.4-N en -0.5-N); de ribbel telt mee in de poort', waarom:'Daan 17-10 (ronde 0.4b). De 100 kwam van de eigen invoer bij MR65SX2.7-0.4-2 en -0.5-2 en vervalt. Vervangt "slaan we over" van 9-10.', bevestigd:CHAT3 },
  { id:'p-maatvolgorde', groep:'Productdata-regels', t:'Palletmaat: bevestigde maatregels gaan voor een familievoorstel', waarde:'volgorde: kleurgenoot, pakbon, bevestigde maatregel (whiteboard groter dan 80x120 = kleinste opslagmaat waar het bord in past; rubber ringmat met rand 100x150, behalve kleine matten met midden-pick), dan familie, dan productmaat uit de naam, dan 80x120x180. Hoogte volgt dezelfde volgorde', waarom:'Daan 17-10 (ronde 0.4b). Voorbeelden: 120240WM → 120x240, 120200WM en 11103.267 → 120x200, rm150x90 → 100x150; de familie stelde 80x120 voor.', bevestigd:CHAT3 },
  { id:'p-nogopen', groep:'Productdata-regels', t:'Invullen toont alleen wat nog open is', waarde:'per laag een rustig scherm "Nog open · laag N": alleen belangrijke producten met open velden in die laag, alleen die velden, per familie (meeste open velden eerst; binnen een familie A-lopers, dan B, dan binnenkomend), Later onderaan ingeklapt', waarom:'Daan 17-10. Een schatting van Claude staat voorgevuld met Klopt; geen filters of selecties bovenaan. Te doen bij stap 0.4 toont alleen de rode poortregels.', bevestigd:CHAT3 },
  { id:'p-regelcheck', groep:'Productdata-regels', t:'Regelcontrole: een waarde die tegen een bevestigde regel ingaat telt als open', waarde:'zoals een schatting van Claude: open in de poort, met een korte reden, in "Nog open" en onder Te controleren → Productdata; aanpassen of Klopt = compleet', waarom:'Daan 17-10. Alleen tonen en tellen, er wordt niets weggeschreven. De drie regels hieronder.', bevestigd:CHAT3 },
  { id:'p-rc-dooscm', groep:'Productdata-regels', t:'Regelcontrole per cm of per meter: gewicht per doos', waarde:'stuks per doos × gewicht per eenheid boven 30 kg = open; gewicht onbekend = niet controleren', waarom:'Daan 17-10, regel p-dooscm (max 30 kg per doos). Gewicht per eenheid: eigen waarde, anders Picqer.', bevestigd:CHAT3 },
  { id:'p-rc-maat', groep:'Productdata-regels', t:'Regelcontrole palletmaat', waarde:'alleen opslagmaten 80x120, 90x120, 100x100, 100x150, 110x110, 120x150, 120x180, 100x200, 120x200, 120x240; andere maat = open; nvt en leeg buiten de controle', waarom:'Daan 17-10, regel p-maat.', bevestigd:CHAT3 },
  { id:'a-rc-doos', groep:'Aanvullen', t:'Regelcontrole aanvullen met hele omdozen of bundels', waarde:'max op pick kleiner dan één omdoos of bundel (stuks per doos) = open; alleen aanvullen met deel of doos, per stuk', waarom:'Daan 17-10, regel a-doos (voorbeeld: max 14 bij bundels van 15).', bevestigd:CHAT3 },
  { id:'p-historie', groep:'Productdata-regels', t:'Picqer-geschiedenis ophalen (alleen lezen)', waarde:'knop Test → Productdata (alleen Daan): verplaatsingen vanaf 2025-01-01 en ontvangsten, compact per kwartaal in catalog wh-vp-hist-… en wh-ont-hist-… (voortgang: wh-hist-voortgang). Geen scherm laadt deze rijen; alleen de export leest ze. Analyse door Claude (chat) op de export.', waarom:'Daan 17-10: productdata (stuks per pallet, binnenkomst, aanvullen, locaties) afleiden uit de volledige geschiedenis, niet uit losse vragen.', bevestigd:CHAT3 },
  { id:'p-pdbron', groep:'Productdata-regels', t:'Andere apps gebruiken productdata (schakelaar)', waarde:'standaard uit; alleen Daan zet hem om (Test → Productdata → Poort 0.4), geen override per apparaat', waarom:'Daan 17-10 (het testen gaat via de emulator). Uit: niets verandert. Aan: Warehouse, Junior, Palletlabels en Containers lezen eerst uit productdata (leeg of onb = oude plek) en schrijven ook naar productdata (alleen als het veld leeg is of automatisch). Catalog wh-pd-bron.', bevestigd:CHAT3 },
  { id:'a-doos', groep:'Aanvullen', t:'Aanvullen met hele omdozen of pakketten', waarde:'bij X, aanvullen met hele omdozen of bundels tot zo dicht mogelijk onder max op pick', waarom:'Daan 17-10: wandrekken bij 2, deurmatten per 10 en Weave per 5, trapprofiel per 15. Niet voor producten die per pallet worden geleverd.', bevestigd:CHAT3 },
  // vervoerders: alleen vastleggen (Daan 17-10). Geen extra laag in de app: geen cut-off-waarschuwingen en geen nieuw scherm; Picqer kiest de vervoerder (regels van Maxime).
  { id:'v-dpd', groep:'Vervoerders', t:'DPD Parcel', waarde:'ma–vr 2× ophalen: 14:00–15:00 en 18:00–19:00', waarom:'Daan 17-10. Bij de 1e afhaling gaat alles mee wat dan ingepakt en op pallets staat. Vast aantal palletplaatsen per afhaling; past het niet, dan buitenland laten staan zodat NL/BE op tijd is. Gordelmaat ≤ 300 cm, lengte max 170 cm, max 31,5 kg.', bevestigd:CHAT3 },
  { id:'v-dhl', groep:'Vervoerders', t:'DHL Parcel', waarde:'zondag t/m vrijdag, rond 14:00 live afhaling, daarna standtrailer gewisseld tussen 18:00 en 19:00', waarom:'Daan 17-10. Zondag live laden. Geen capaciteitsgrens.', bevestigd:CHAT3 },
  { id:'v-vst', groep:'Vervoerders', t:'VST (zendingen naar klanten)', waarde:'geen vaste ophaaltijd, laatste wagen 17:30–18:00, ma–vr', waarom:'Daan 17-10. Boeken in Transsmart uiterlijk 17:00, max 17:15. Verzendklaar = gewikkeld, label + pakbon, in het VST-vak.', bevestigd:CHAT3 },
  { id:'v-freight', groep:'Vervoerders', t:'DHL Freight (pallets buiten Benelux)', waarde:'ophalen 14:00 en 16:00, maandag extra rond 11:00–12:00', waarom:'Daan 17-10. Boeken in IVOL - Freight (prijs opvragen, boeken, label). Na 16:00 gemaakt = gaat de volgende dag. Zondag gemaakt = maandag opgehaald. Fout bij boeken: eerst Daan, Kate of Sala, daarna Maxime.', bevestigd:CHAT3 },
  { id:'v-alg', groep:'Vervoerders', t:'Algemeen', waarde:'DPD en DHL Parcel tot 17:30 maken en printen; op zondag wordt gewerkt', waarom:'Daan 17-10. Urgente orders en NL/BE-orders die vóór 17:00 binnen zijn gaan dezelfde dag weg; buitenland Freight de volgende dag. Te laat = volgende ophaaldag. Verzendklaar (DPD/DHL) = ingepakt, label erop, op de plek. Verzendvakken in hal B (gekleurde tape): DPD, DHL Parcel, VST, DHL Freight.', bevestigd:CHAT3 },
  { id:'v-wie', groep:'Vervoerders', t:'Verantwoordelijk', waarde:'Daan, Kate en Sala checken samen de orders aan het eind van de dag; wie afsluit regelt alle vervoerders', waarom:'Daan 17-10. Wie afsluit zorgt dat alles meegaat.', bevestigd:CHAT3 },
  // dagritme: de vervoerderstijden als gewone regels (geen kleuren, geen waarschuwingen)
  { id:'d-v1', groep:'Dagritme gewone dag', t:'DPD 1e afhaling: alles wat ingepakt is en op pallets staat gaat mee', waarde:'14:00–15:00 · DPD', waarom:'Daan 17-10 (vervoerders).', bevestigd:CHAT3 },
  { id:'d-v2', groep:'Dagritme gewone dag', t:'DHL Parcel live afhaling', waarde:'14:00 · DHL Parcel', waarom:'Daan 17-10 (vervoerders). Zondag t/m vrijdag.', bevestigd:CHAT3 },
  { id:'d-v3', groep:'Dagritme gewone dag', t:'DHL Freight 1e afhaling (boeken in IVOL - Freight)', waarde:'14:00 · DHL Freight', waarom:'Daan 17-10 (vervoerders).', bevestigd:CHAT3 },
  { id:'d-v4', groep:'Dagritme gewone dag', t:'DHL Freight 2e afhaling (na 16:00 gemaakt gaat de volgende dag)', waarde:'16:00 · DHL Freight', waarom:'Daan 17-10 (vervoerders).', bevestigd:CHAT3 },
  { id:'d-v5', groep:'Dagritme gewone dag', t:'DHL Freight extra afhaling op maandag', waarde:'11:00–12:00 · DHL Freight · alleen maandag', waarom:'Daan 17-10 (vervoerders). Zondag gemaakt = maandag opgehaald.', bevestigd:CHAT3 },
  { id:'d-v6', groep:'Dagritme gewone dag', t:'Laatste VST-boeking in Transsmart (max 17:15)', waarde:'17:00 · VST', waarom:'Daan 17-10 (vervoerders).', bevestigd:CHAT3 },
  { id:'d-v7', groep:'Dagritme gewone dag', t:'Laatste DPD en DHL Parcel maken en printen', waarde:'17:30 · DPD, DHL Parcel', waarom:'Daan 17-10 (vervoerders).', bevestigd:CHAT3 },
  { id:'d-v8', groep:'Dagritme gewone dag', t:'Laatste VST-wagen', waarde:'17:30–18:00 · VST', waarom:'Daan 17-10 (vervoerders).', bevestigd:CHAT3 },
  { id:'d-v9', groep:'Dagritme gewone dag', t:'DPD 2e afhaling en DHL-trailer gewisseld', waarde:'18:00–19:00 · DPD, DHL Parcel', waarom:'Daan 17-10 (vervoerders).', bevestigd:CHAT3 },
  { id:'d-v10', groep:'Dagritme gewone dag', t:'Afsluiten: wie afsluit regelt alle vervoerders en zorgt dat alles meegaat', waarde:'einde dag · wie afsluit', waarom:'Daan 17-10 (vervoerders). Daan, Kate en Sala checken samen de orders aan het eind van de dag.', bevestigd:CHAT3 }
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
