# MASTEROPDRACHT Claude Code: schattingen + vervoerders verwerken (17-10-2026)

Repo **Daan-vB/Magazijn-Tools**, branch `main`. Twee controle-sessies van Daan zijn voltooid: **productdata-schattingen** (de 68 open belangrijke producten) en **cut-off per vervoerder**. Verwerk alles in één ronde. Geen vragen: kies de redelijkste oplossing en zet die in het eindrapport. Doel: daarna kan Daan **Poort 0.4** (Test → Productdata) zo ver mogelijk groen krijgen.

## Harde regels
- Nooit naar Picqer schrijven. `supabase/functions/**` niet aanraken.
- **Warehouse, Junior, Ploeg, Containers en Palletlabels blijven ongewijzigd.** Alleen 3.0: `wh/ivol-x.js`, `wh/productdata.js`, `wh/pdfamilie.js`, `wh/aannames.js`, `wh/aanvullive.js`, `wh/dag.js` waar nodig.
- Productdata alleen via een nieuw bestand `.github/claude/daan-2026-10-17.json` + workflow "Productdata door Claude" (`schrijf.py`). Eigen invoer van Daan (bron `invul`, `spraak`, `tabel`, `overgezet`) nooit overschrijven. Een schatting van Claude (`bron claude`, twijfel `tw`) vervang je door als `verwacht` de waarde uit `.github/claude/claude-belangrijk-schatting-2026-10-15.json` (of `autopiloot-*-2026-10-16.json`) mee te geven. Besluiten van Daan: bron `daan`, reden "Daan 17-10 (oefening)", **geen** twijfel-vlag. "Bevestigen" = zelfde waarde opnieuw zetten met bron `daan` en `verwacht` = huidige waarde, zodat de twijfel-vlag verdwijnt.
- Een veld leegmaken = waarde `""` met `verwacht`. Productcode is heilig. Openbare repo: geen klantgegevens, namen van externe contactpersonen of statistieken uit andere systemen in commits.
- Nieuwe regels altijd ook als aanname in `wh/aannames.js` met `bevestigd: Daan (chat) 2026-10-17`.

## A. Productdata per product
1. `single-mounting-pin`: mixgroep leeg.
2. `SSRTEARHR`, `RGM1` (trapmaantjes): maat 100x150, hoogte 120, plaatsen 2, per doos 5, opslag deel. Max per ligger herberekenen met de bestaande ligger-regel (2000 kg, plaatsen). Aanvullen bevestigen: Tear bij 15 · max 31, Deco bij 11 · max 26.
3. `RH40x60`: maat 80x120 en plaatsen 1 bevestigen; per doos `nvt` (los).
4. `HN3188-black`, `holder-black-flat`, `holder-black-square`: aanvullen bij en max op pick leeg (alles op pick, geen bulk); geleverd `wisselt` bevestigen.
5. `HL-S1009-Bla`: per doos 5 bevestigen.
6. `MR65SX2.7-0.4` (40 cm × 1 m): aanvullen bij 5 · max 20 bevestigen.
7. Ringmatten: `rh50x80` 80x120, 100 per pallet, per doos `nvt`, aanvullen bevestigen. `rh50x100` 100x150, 125 per pallet, plaatsen 2, per doos `nvt`, aanvullen bevestigen. `RH40x60-CLOSED` 80x120, per doos 10 (plastic pakketten), stuks per pallet leeg, gewicht-schatting leeg. `RH100x200-16`: stuks per pallet 100, gewicht volle pallet 1270 (pakbon container NL-301); overige schattingen leeg.
8. Magneetsets `1711-black-set`, `1711-white-set`, `1711-blue-set`: 100 per doos. `IWW01`: per doos `wisselt` bevestigen. `14016.400`, `14016.401`: 10 per doos.
9. SAM Europe in de lijst (`WBSKB000001`, `WBCLS000200`, `WBCLS000100`, `WBERB000005`, `WBMPH000000`): doos-, pallet-, hoogte-, gewicht-, plaatsen- en mixgroep-schattingen leeg.
10. Wandrekken (`ZJ-007`, `ZJ-017`, `VD-ZJ-201`, `VD-CJ-202`, `VD-HX-E04-B`, `CJ-001`): aanvullen bij 2, aanvullen met hele omdozen. `ZJ-007`: 8 per omdoos. Overige omdoos-aantallen, omdozen per pallet, 80x120 of 90x120 en max op pick: **open** tot de invulsheet terug is (week 43). Pallethoogte basis 180 (twijfel-vlag laten staan bij maat/plaatsen).
11. Deurmatten (Wallace): pallet 80x120, hoogte 120; per doos 10 (bundel in plastic), `BWM…` (Weave) 5. Stuks per pallet: `368-1-441-001` 200, `368-1-402-302` 200, `AK2017(26)-50x80` 100, `BTMSD4080` 300, `RPM60100` 110, `KJCRB711` 68, `KJCRB705` 60, `BWM61x91` 78. Aanvullen bevestigen zoals het staat.
12. Huishoudtrappen `2031`, `2031-BLK` (4 treden): 100x150, plaatsen 2, 50 per pallet; hoogte 180 met twijfel-vlag (niet door Daan genoemd). Wielklem `thansen-40790` (56), aerobic step `C4001` (50), luchtbed `D76-GREY` (100): 80x120, hoogte 180, plaatsen 1. `LT805`: 10 per doos. `SWH01`: 50 per doos bevestigen. `9030-1`: aanvullen bevestigen. Aanvullen van deze groep bevestigen zoals het staat.
13. Trapleuningen `design-200-black`, `design-250-black`, `TRLBLACK-350`: aanvullen bij en max op pick leeg (geen bulk; zie C3). Trapprofiel `42x21x100ALU`: per bundel 15, aanvullen met bundels van 15; bulk = 00-locaties AF18.
14. PU-leer per meter (`PUR-R-…`): aanvulwaarde leeg; familie/afdeling = CF rubber rollen per meter (niet midden).
15. Rubbermat op rol fijne ribbel, alle `MR65SX2.7-0.4…` en `MR65SX2.7-0.5…` (ook buiten de 68): vloernaam **"Ribbel 40cm lengte N Meter"** / **"Ribbel 50cm lengte N Meter"** (vervangt eerdere vormen, ook 1 m). Gewicht per stuk (`kgst`) = gewicht van 1 m × lengte (40 cm: 1,1 kg/m; 50 cm: 1,4 kg/m). "100 per pallet" vervalt (leeg, bij eigen invoer niet aanraken). 40 en 50 cm × 1, 2, 3 m = eigen pallet (stuks per pallet open); 4–10 m = mix/pick-pallet.
16. Roostermatten `MM-…` (6): geleverd los in de container (zelf gebouwde pallet); overige schattingen leeg. Borstelmatten `BRE-60x90`, `BRE-80x120`: alle schattingen leeg.

## B. Regels in de app (3.0, `wh/productdata.js` / `wh/pdfamilie.js` / `wh/aanvullive.js`)
1. **SAM Europe** (leverancier): alleen picklocatie, bulklocaties en aanvulniveau. Geen doos, pallet, hoogte, gewicht, plaatsen of mixgroep schatten of vragen. SAM nooit combineren of vergelijken met andere artikelen (geen familie-, kleurgenoot- of maatgroepwaarden van of naar SAM). Voor de poort tellen die velden als `nvt`.
2. **Zelf gebouwde pallets** (los in de container, bijv. deurmatten, roostermatten): stuks per pallet = grootste geleverde aantal per levering, als de verplaatsingen laten zien dat het op één pallet paste; anders het grootste aantal dat in één keer naar bulk ging.
3. **Aanvullen met hele omdozen/pakketten**: bij X, aanvullen met hele omdozen of bundels tot zo dicht mogelijk onder max op pick (wandrekken bij 2; deurmatten per 10, Weave 5; trapprofiel per 15). Niet voor producten die per pallet worden geleverd.
4. **Alles op pick, geen bulk** (houders, trapleuningen): geen aanvulniveau voorstellen; voor de poort `nvt`.
5. **Ruimte gaat voor verkoop**: als Daan aanvullen bij/max heeft bevestigd, geen voorstel "1–2 weken verkoop" eroverheen.
6. **Zonder voorraad**: eerst inkoop/containerlijst (pakbon) gebruiken; anders niets schatten tot het product op voorraad is. Toon zo'n product als "wacht op levering"; voor de poort telt het als compleet zolang er geen voorraad is (in het rapport vermelden hoeveel).
7. **Eigen pallet of mix (rollen per lengte)**: lengtes die per 25 of meer worden ingekocht krijgen een eigen pallet, de rest een mix/pick-pallet.
8. **Pallets**: basis losse producten 80x120x180; huishoudtrappen 2 treden 80x120, 3 en 4 treden 100x150; omdozen breder dan 80 cm = 90x120 (2 pallets op een 3-ligger, 3 op een 4-ligger).
9. Vervallen regel: "midden-producten altijd 80x120x160" klopt niet; hoogte hangt af van hal/ligger (hal A lager dak). Niet meer als vaste schatting gebruiken; hallen/hoogtes nog niet als vaste gegevens bouwen.

## C. Taken in Te doen (3.0, `wh-taken`)
1. Week 43 (vanaf ma 19-10): invulsheet wandrekken (19 wandrekken, printbare PDF bij Daan) laten invullen door Kate of een medewerker; daarna in Oefenen 3.0 ("Wandrekken invullen") of aan Claude geven.
2. Wegzetten: trapleuningen design 200/250 en rond 350, vierkante houder en trapprofielen staan op "geen specifieke locatie" terwijl de picks leeg zijn.
3. Daan: in Picqer een bulklocatie "bulk leuningen" (achterwand AF, waar de extra dozen leuningen rechtop staan) aanmaken en op bulk zetten.
4. Parkeerplaats (idee, niet bouwen): vaste plek bij de inpaktafel met een bak per soort kunststof pen (3–4 soorten), duidelijk gelabeld, en een mixpallet pennen op bulk.

## D. Vervoerders (cut-off) — alleen vastleggen, geen waarschuwingen
Daan: **geen extra laag in de app per vervoerder** (geen cut-off-waarschuwingen, geen nieuw scherm). Picqer kiest de vervoerder (regels van Maxime); de app bouwt dat niet na.
1. In `wh/aannames.js` een groep **Vervoerders**, alles bevestigd door Daan:
   - **DPD Parcel**: ma–vr 2× ophalen: 14:00–15:00 en 18:00–19:00. Bij de 1e afhaling gaat alles mee wat dan ingepakt en op pallets staat. Vast aantal palletplaatsen per afhaling; past het niet, dan buitenland laten staan zodat NL/BE op tijd is. Gordelmaat ≤ 300 cm, lengte max 170 cm, max 31,5 kg.
   - **DHL Parcel**: rond 14:00 live afhaling, daarna standtrailer aan het dock, gewisseld tussen 18:00 en 19:00. Zondag t/m vrijdag (zondag live laden). Geen capaciteitsgrens.
   - **VST** (zendingen naar klanten): geen vaste ophaaltijd, laatste wagen 17:30–18:00, ma–vr. Boeken in Transsmart uiterlijk 17:00, max 17:15. Verzendklaar = gewikkeld, label + pakbon, in het VST-vak.
   - **DHL Freight** (pallets buiten Benelux): boeken in IVOL - Freight (prijs opvragen, boeken, label). Ophalen 14:00 en 16:00, maandag extra rond 11:00–12:00. Na 16:00 gemaakt = gaat de volgende dag. Zondag gemaakt = maandag opgehaald. Fout bij boeken: eerst Daan, Kate of Sala, daarna Maxime.
   - **Algemeen**: DPD en DHL Parcel kunnen tot 17:30 gemaakt en geprint worden. Urgente orders en NL/BE-orders die vóór 17:00 binnen zijn gaan dezelfde dag weg; buitenland Freight de volgende dag. Te laat = volgende ophaaldag. Verzendklaar (DPD/DHL) = ingepakt, label erop, op de plek. Verzendvakken in hal B (gekleurde tape): DPD, DHL Parcel, VST, DHL Freight. Op zondag wordt gewerkt.
   - **Verantwoordelijk**: Daan, Kate en Sala checken samen de orders aan het eind van de dag; **wie afsluit** regelt alle vervoerders en zorgt dat alles meegaat.
2. In het **dagritme** (`wh/dag.js`), als gewone regels zonder kleuren of waarschuwingen: 14:00–15:00 DPD 1e afhaling · 14:00 DHL live · 14:00 en 16:00 Freight (ma ook 11:00–12:00) · 17:00 (max 17:15) laatste VST-boeking · 17:30 laatste DPD/DHL maken en printen · 17:30–18:00 laatste VST-wagen · 18:00–19:00 DPD 2e afhaling en DHL-trailer · afsluiten: wie afsluit regelt alle vervoerders.

## E. Testen
Zelfde aanpak als ronde 2 (emulator met verzonnen data, geen echte datakopie nodig): regressie op `warehouse.html#/`, `#/aanvullen`, `junior.html#/`, `ploeg.html`, `containerplanning.html#/`, `index.html`, `productkaart.html`, `claude.html` (zichtbare tekst identiek, geen nieuwe `PAGEERROR`); in 3.0 Te controleren → Aannames (nieuwe groepen op ✓), Productdata/Per familie (SAM, zelf gebouwde pallets, alles-op-pick, wacht op levering), Dagstart (vervoerdersregels), Te doen (taken C1–C3); telefoon 390 px zonder horizontaal scrollen.

## Eindrapport
`docs/rapport-master-0.4.md`, kort, per onderdeel A–E: wat gedaan, aantallen geschreven/overgeslagen uit het workflow-log, en **wat Poort 0.4 nog tegenhoudt** (verwacht: max op pick/omdozen van de wandrekken tot de invulsheet terug is; steekproef op de vloer door Daan).
