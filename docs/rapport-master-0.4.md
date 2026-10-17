# Rapport masteropdracht 0.4 (17-10-2026)

Alles in één ronde, direct op `main`. Geen vragen gesteld; gekozen oplossingen staan per onderdeel. Niets naar Picqer geschreven, `supabase/functions/**` niet aangeraakt, Ploeg ongewijzigd.

## A. Productdata per product
- Nieuw bestand `.github/claude/daan-2026-10-17.json`: **79 producten, 404 waarden**, verwerkt door de workflow "Productdata door Claude".
- Workflow-log (run 13, geslaagd): **358 waarden gezet voor 79 producten, 46 overgeslagen**. De 46 zijn velden waar Daan zelf al iets had ingevuld of gekozen (vooral soort, stuks per pallet, aanvullen met, palletmaat/hoogte van `AK2017(26)-50x80` en de vloernaam/stuks per pallet van `MR65SX2.7-0.4-2` en `-0.5-2`); die staan nu zoals hij ze zette. Zijn eigen stuks per pallet bij de wandrekken is daardoor niet geparkeerd maar blijft staan.
- `schrijf.py` uitgebreid: `verwacht` mag een lijst zijn (alle waarden die nu mogen staan, ook leeg), zevende element `"park"` naast `"twijfel"`, en eigen invoer (`invul`, `spraak`, `tabel`, `overgezet`) wordt nooit overschreven, ook niet als `verwacht` toevallig gelijk is.
- Bronnen: besluiten van Daan = bron `daan`, reden "Daan 17-10 (oefening)", geen twijfel. Waarden die direct volgen uit zijn antwoorden (plaatsen uit palletmaat, max per ligger uit 3 plaatsen en 2000 kg) = bron `auto` met reden "Regel Daan". Alleen de hoogte 180 van `2031`/`2031-BLK` is een schatting met twijfel-vlag (zoals gevraagd). Vervangen schattingen van Claude hebben als `verwacht` de waarde uit de eerdere bestanden.
- Keuzes waar de opdracht niets over zei:
  - Trapmaantjes, wandrekken en deurmatten: soort `deel`, aanvullen met `deel`; "hele omdozen" zit in de aanvulregel (zie B3), niet in een nieuw veld.
  - Houders en trapleuningen: soort `4 pick` (alles op pick), aanvullen bij en max leeg.
  - Wandrekken: omdoos-aantal (behalve `ZJ-007` = 8), omdozen per pallet en max op pick zijn geparkeerd (notitie "Invulsheet wandrekken…"). De huidige max op pick is niet aangeraakt.
  - Ribbel (19 codes): vloernaam, gewicht per stuk, stuks per pallet leeg. Ook de uit "100 per pallet" afgeleide gewicht-, hoogte- en max-per-ligger-schattingen zijn leeggemaakt. Eigen pallet of mix (1–3 m / 4–10 m) is een voorstel in de app (B7), niet weggeschreven.
  - Deurmatten en roostermatten krijgen de opmerking "Zelf gebouwde pallet: los geleverd in de container"; zo herkent de app ze (B2). Roostermatten: geleverd = per stuk.
  - "Bevestigen" kan alleen waar de waarde bekend was uit de eerdere bestanden of in de opdracht staat. Staat een waarde alleen in aanvulbase of Picqer (niet in productdata), dan zet deze ronde daar niets neer.
  - PU-leer: aanvulwaarden leeg; familie en afdeling = "CF rubber rollen per meter" (niet midden) is in de app ingebouwd (zie B).
- Na deze ronde (simulatie op de eerdere bestanden, vóór de 46 overgeslagen velden): nog **66 schattingen van Claude** bij 28 van de 68 producten. Dat zijn vooral aanvullen bij/max van de ribbel-op-maat, gewicht-schattingen, vloernamen, `spd nvt` van wielklem/step/luchtbed, en aanvulniveau van SAM. Die staan onder Te controleren → Productdata.

## B. Regels in de app (`productdata.js`, `pdfamilie.js`, `aanvullive.js`)
1. **SAM Europe**: alleen pick, aanvullen bij en max op pick zijn nodig; geen voorstellen voor de rest; elk SAM-artikel staat alleen in een eigen familie en maatgroep, en telt niet mee als voorbeeld voor andere artikelen.
2. **Zelf gebouwde pallets**: stuks per pallet = grootste levering (pakbon) als een verplaatsing naar bulk dat aantal laat zien; anders het grootste aantal in één keer naar bulk; zonder verplaatsingen de grootste levering (laag vertrouwen).
3. **Hele omdozen/bundels**: aanvulronde in 3.0 rondt bij aanvullen met `deel`/`doos` af op hele dozen tot onder max op pick. Niet bij `pallet`.
4. **Alles op pick**: geen aanvulniveau voorgesteld; voor de poort nvt.
5. **Ruimte gaat voor verkoop**: is aanvullen bij bevestigd (niet automatisch), dan geen "1–2 weken verkoop" voor max.
6. **Zonder voorraad**: alleen pakbon-voorstellen, badge "wacht op levering", telt als compleet. Het aantal staat live in Poort 0.4 ("Daarvan: x wachten op levering"); ik heb geen echte data, dus geen getal.
7. **Rollen per lengte**: inkoop ≥ 25 per keer = eigen pallet, anders mix/pick-pallet; zonder inkoopgegevens 1–3 m eigen, 4–10 m mix.
8. **Pallets**: huishoudtrap 2 treden 80x120, 3–4 treden 100x150; omdoos breder dan 80 cm = 90x120 (max per ligger 2); basis 80x120x180. Nieuw voorstel voor max per ligger uit plaatsen en gewicht.
10. **Geparkeerd**: `meta.<veld>.park = 1` + notitie in `meta.<veld>.uit`; telt overal als compleet; lijst Notities in 3.0.
11. **Midden 80x120x160 vervallen** (ook in de aanname `p-maat`).
- PU-leer `PUR-R-…`: ingebouwde familie "CF rubber rollen per meter", zone CF, niet midden.
- Alle nieuwe regels staan in `wh/aannames.js` met `bevestigd: Daan (chat) 2026-10-17` (15 regels), plus groep Vervoerders (6) en dagritmeregels (10): 76 aannames, 0 open.

## C. Notities en taken
- Te controleren heeft een tab **Notities**: invulsheet wandrekken (vanaf week 43), idee parkeerplaats pennen, en alle geparkeerde velden gegroepeerd per notitie. Geen taak, geen teller in Te doen.
- Te doen: eenmalig gezaaid (vaste id's, marker in `wh-taken`, komt niet terug na afvinken of verwijderen): wegzetten leuningen/houder/profielen (aan Kate, mijn keuze) en bulklocatie "bulk leuningen" in Picqer (Daan), met knop Gedaan bovenaan Te doen.

## D. Vervoerders
Alleen vastgelegd: groep **Vervoerders** in `aannames.js` en tien gewone regels in het dagritme van Dagstart (14:00–15:00 DPD … afsluiten). Geen waarschuwingen, geen nieuw scherm. De extra Freight-afhaling staat alleen op maandag. Het dagritme komt uit `aannames.js`; `dag.js` (Warehouse) is niet gewijzigd.

## F. Andere apps lezen/schrijven productdata (schakelaar)
- Nieuw `wh/pdbron.js`, catalog `wh-pd-bron` (standaard uit, alleen Daan zet om in Test → Productdata → Poort 0.4).
- Aan, **lezen** (leeg, `onb` of een onnagekeken schatting met twijfel = terugval op de oude plek):
  - Warehouse en Junior: stuks per pallet, picklocatie, aanvullen bij, max op pick, stuks per doos en vloernaam (via de bestaande productdata-lezer), plus palletmaat, hoogte, gewicht, plaatsen en max per ligger (overlay op de producten).
  - Containers: palletmaat, hoogte, gewicht, plaatsen, max per ligger en stuks per pallet.
  - Palletlabels en Container-palletlabels: stuks per pallet.
- Aan, **schrijven** (ook naar productdata, bron `invul`, alleen leeg of `auto`; oude plek blijft geschreven): stuks per pallet (Warehouse), aanvulbase pick/bij/max (Warehouse, Junior), palletgegevens en stuks per pallet (Containers), stuks per pallet en vloernaam (Palletlabels).
- Niet omgezet: vloernaam in Containers en Palletlabels (de naam is daar de sleutel van het productgeheugen); stuks per doos in Containers/Palletlabels (kennen dat veld niet). `wh/ivol.js` (niet in de toegestane lijst) zegt nog "Warehouse en Junior volgen na akkoord" op de pagina Koppeling.
- Poort 0.4 heeft de regel "Andere apps lezen/schrijven productdata" (groen bij code + zelftest) en de schakelaarkaart.

## E. Testen
Emulator met verzonnen data (Playwright, Supabase en CDN's gemockt, vaste klok), basis (`29dfcca`) tegen nieuw:
- Regressie, schakelaar uit: zichtbare tekst **identiek**, geen nieuwe PAGEERROR, geen writes, op `warehouse.html#/`, `#/aanvullen`, `#/containers`, `junior.html#/`, `ploeg.html`, `containerplanning.html#/` en `#/c/1` (+ pakbon, verdeling, uitvoer, producten), `index.html`, `productkaart.html`, `claude.html`.
- Functioneel (69 controles, 0 fout): SAM, geparkeerd, wacht op levering, zelfbouw, alles-op-pick, ruimte, rollen, pallets, ligger, omdozen; Poort (regel, steekproef 19/20/fout, schakelaar, alleen Daan); Aannames (nieuwe groepen ✓, 0 open); Notities; Dagstart-vervoerders; taken gezaaid en niet dubbel; schakelaar aan voor Warehouse, Junior, Containers en Palletlabels (lezen, terugval, schrijven, Daans invoer blijft); schakelaar uit schrijft niets.
- `pdbron.js` zelftest (lezen met terugval, schrijven naar beide plekken, schakelaar uit) slaagt. `schrijf.py`: simulatie op de eerdere bestanden, eigen invoer blijft staan.
- Telefoon 390 px: geen horizontaal scrollen op Poort, Notities, Aannames, Dagstart en Te doen.
- Niet getest: echte data en echte Picqer; de apps zelf zijn niet visueel nagelopen.

## Wat Poort 0.4 nog tegenhoudt
1. De steekproef op de vloer: 20 producten, 0 fouten (Poort 0.4 → Steekproef). Dit is het enige dat ik verwachtte.
2. Mogelijk meer, afhankelijk van echte data: de overgebleven schattingen onder A (die Daan nog met Klopt bevestigt) en belangrijke producten buiten de 68 met open velden. Het echte getal staat in Poort 0.4.
3. Daan zet de schakelaar zelf aan wanneer hij de andere apps wil laten volgen; de poortregel wacht daar niet op.
