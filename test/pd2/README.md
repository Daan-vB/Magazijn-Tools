# Tests Productdata 2.0

Ontwerp: `docs/productdata-2.0-ontwerp.md`. Deze tests lezen de echte database (alleen lezen). Elke schrijfpoging wordt in
de browser onderschept: `wh-pd2-*` en productdata gaan naar een kopie in het geheugen (nooit naar de database), al het andere
schrijven wordt geblokkeerd en geteld (moet 0 zijn). Picqer wordt niet aangeroepen. Er komt geen bedrijfsdata in de repo:
uitslagen en schermafdrukken gaan naar `UIT_MAP` (standaard de huidige map, niet in de repo zetten).

Nodig: Node met Playwright en Chromium. Repo serveren op poort 8811 (`python3 -m http.server 8811`), voor de regressie
ook de versie vóór 2.0 of `main` op 8812 (`git worktree add ../main-wt <commit>` en daar `python3 -m http.server 8812`).

| Script | Wat |
|---|---|
| `oefening.js` | doet elke oefening via de echte kaarten, maattegels, groepsbalk en het oefenkaartje en controleert de uitkomst (Mars 8 maattegels, Mars 120x180 Antraciet = Deel, alleen de velden van de soort, afgerond klapt in, ongedaan, gewicht, palletmaat anders…, kopieer voor Claude, opslag, wissen) |
| `ronde4.js` | ronde 4: geen maatstap bij 1 product per maat (inhoudsopgave), picklocatie als tekst + keuze op het voorstel, korte voorstelregel, max op pick bij Deel, uitlopend ook als het verkoopt, oefenantwoorden tellen niet mee |
| `week1.js` | week 1 · A: soort opslaan, kg bij vertrouwd, alle picklocaties, max per ligger uit het liggertype (100150WM op BB11A10 = 2), controle na invoer, Hoe vul je pick aan + Binnenkomst, palletlabel met andere code; schrijven naar productdata alleen met bron pd2 en vooraf een kopie |
| `containers.js` | week 1 · D: Containers leest productdata: FWB-regel "los, per 1" krijgt voorstel "pallets, per 50"; bevestigde regels nooit |
| `schermen.js` | ronde 3/4: schermafdruk van start (390, 1440) en het familiescherm op 1440, 1920 en 390 px voor Whiteboard Magnetisch, Schoonloopmat Mars en Kokos op rol, plus een rol, Weg en de groepsbalk; desktop: twee kolommen, inhoud ≥ 85% breed, op 1440 ≥ 3 kaarten in beeld; controleert: geen horizontale scroll, niets buiten beeld, geen gestippelde randen, geen oranje vlakken, geen tabellen of chips, startscherm ≤ 7 blokken boven de vouw |
| `regressie.js` | laadt elke oude pagina op main en op deze tak en vergelijkt tekst en DOM-structuur; in 3.0 apart het menu (er mag precies één regel bij) |
| `live.js` | Picqer nagebootst: live voorraad per rij (20 per vraag, 3 s ertussen) en bij 429 terugval op de export met datum en pauze |
| `meting.js` | ronde 2: per veld hoe vaak het voorstel klopt bij Daans eigen invoer (doet alsof elke waarde er niet is); schrijft alleen aantallen |
| `ronde2.js` | ronde 2: overzetten alleen tegen een kopie (eigen invoer blijft, terugdraaien), rollen, Weg voor alles, aandacht per familie (≤ 3), weeglijst (reachtruck en print), scores als lijst |
| `laadtijd.js` | laadtijd van #/pd2: eerste keer en daarna (met de momentopname) |
| `zelfcontrole.js` | correctie 2b: alle producten in de Belangrijk-families: per veld hoeveel voorstellen geel, twijfel, uitzoeken en per bron (alleen aantallen) |
| `db-hash.sh` | hash van productdata, wh-pd-fam, catalog-ean en de pd2-rijen; vóór en na een test draaien en vergelijken |

Voorbeeld: `UIT_MAP=/tmp/pd2 node test/pd2/oefening.js`
