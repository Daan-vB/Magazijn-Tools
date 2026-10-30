# Tests Productdata 2.0

Ontwerp: `docs/productdata-2.0-ontwerp.md`. Deze tests lezen de echte database (alleen lezen). Elke schrijfpoging wordt in
de browser onderschept: `wh-pd2-*` en productdata gaan naar een kopie in het geheugen (nooit naar de database), al het andere
schrijven wordt geblokkeerd en geteld (moet 0 zijn). Picqer wordt niet aangeroepen. Er komt geen bedrijfsdata in de repo:
uitslagen en schermafdrukken gaan naar `UIT_MAP` (standaard de huidige map, niet in de repo zetten).

Nodig: Node met Playwright en Chromium. Repo serveren op poort 8811 (`python3 -m http.server 8811`), voor de regressie
ook de versie vóór 2.0 of `main` op 8812 (`git worktree add ../main-wt <commit>` en daar `python3 -m http.server 8812`).

| Script | Wat |
|---|---|
| `oefening.js` | doet elke oefening via de drie stappen per maat (1 Soort · 2 Gewicht · 3 Hoeveelheid), de maattegels, groepsbalk en het oefenkaartje en controleert de uitkomst (Meer ingeklapt, tabs Open/Afgerond, Mars 8 maattegels, Antraciet = Deel, velden per soort, Weg met één menu, rol, afgerond pas na alle drie, ongedaan, Alle gewichten kloppen / Aanpassen, kopieer voor Claude, opslag, wissen) |
| `ronde4.js` | ronde 4: geen maatstap bij 1 product per maat (inhoudsopgave), kaart met één vraag zonder picklocatie of Klopt-knop, max op pick bij Deel, uitlopend ook als het verkoopt, oefenantwoorden tellen niet mee |
| `week1.js` | week 1 · A: soort opslaan, kg bij vertrouwd, max per ligger uit het liggertype (bulk op een 4-ligger, 2 plaatsen = 2), controle na invoer, palletlabel met andere code, rol (diameter op koker 10 cm, familielengte als voorstel); schrijven naar productdata alleen met bron pd2 en vooraf een kopie |
| `rolcheck.js` | Rollen controleren: alle rollen met diameter, kg per rol en kg per m² per mm; klopt = vertrouwd, moet gewogen = te wegen, per familie getoetst zonder afwijking klopt; 390 px zonder horizontale scroll; schrijven alleen naar wh-pd2-* en productdata (bron pd2) |
| `schermen.js` | ronde 3/4: schermafdruk van start (390, 1440) en het familiescherm op 1440, 1920 en 390 px voor Whiteboard Magnetisch, Schoonloopmat Mars en Kokos op rol, plus een rol, Weg en de groepsbalk; desktop: twee kolommen, inhoud ≥ 85% breed, op 1440 ≥ 3 kaarten in beeld; controleert: geen horizontale scroll, niets buiten beeld, geen gestippelde randen, geen oranje vlakken, geen tabellen of chips, startscherm ≤ 7 blokken boven de vouw |
| `containerlive.js` | Containerplanning live: een product dat niet in de import staat wordt via het (nagebootste) tussenstation opgezocht (idindex, producten, koppelcode) en is daarna kiesbaar; geen melding "Importeer eerst"; onbekende code ook live niet gevonden = melding |
| `containerbo.js` | Containerplanning backorders live via het (nagebootste) tussenstation (vandaag + idindex): "Backorders live · tijd", zonder koppelcode één regel met reden en laatste stand, verdeling telt live backorders mee, vers vlak vóór PDF maken |
| `containerdozen.js` | Containerplanning: losse pakken met Per > 1 als dozen getoond en geteld (NW-002-BLA 5 dozen à 100, 70198-Black 25 dozen inhoud wisselt, whiteboards Per 1 blijven los/pallets); niets opgeslagen |
| `containerlossen.js` | Containerplanning: stand "bij lossen bepalen" (SEKU6023732 14/14 akkoord · 9 bij lossen), invullijst lossen in de losdag-PDF (jsPDF nagebootst) en werkbon, "Na het lossen invullen" voor Snowbag → kopie catalog-ean, stuks per pallet 100, 5 pallets à 100 (alles onderschept); 390/1440 px |
| `tecontroleren.js` | Te controleren (3.0) → Productdata: één vraag tegelijk, alleen vragen die Productdata 2.0 stelt (soort, gewicht, hoeveelheid per soort, rol), A/B eerst; Kokos 100 cm zwart: één vraag, Klopt → volgende, teller loopt af; 390/1440 px |
| `tecontrolerenfam.js` | Te controleren: "geldt voor alle n in deze familie" opent een lijst met vinkjes (RPEPDM0400 hoogte: 4 producten), 1 uitvinken → 3 afgehandeld en 1 blijft open, Aanpassen voor selectie zet één waarde; 390 px |
| `regressie.js` | laadt elke oude pagina op main en op deze tak en vergelijkt tekst en DOM-structuur; in 3.0 apart het menu (er mag precies één regel bij) |
| `live.js` | Picqer nagebootst: live voorraad per rij (20 per vraag, 3 s ertussen) en bij 429 terugval op de export met datum en pauze |
| `meting.js` | ronde 2: per veld hoe vaak het voorstel klopt bij Daans eigen invoer (doet alsof elke waarde er niet is); schrijft alleen aantallen |
| `ronde2.js` | ronde 2: overzetten alleen tegen een kopie (eigen invoer blijft, terugdraaien), rollen, Weg voor alles, aandacht per familie (≤ 3), weeglijst (reachtruck en print), scores als lijst |
| `laadtijd.js` | laadtijd van #/pd2: eerste keer en daarna (met de momentopname) |
| `zelfcontrole.js` | correctie 2b: alle producten in de Belangrijk-families: per veld hoeveel voorstellen geel, twijfel, uitzoeken en per bron (alleen aantallen) |
| `db-hash.sh` | hash van productdata, wh-pd-fam, catalog-ean en de pd2-rijen; vóór en na een test draaien en vergelijken |

Voorbeeld: `UIT_MAP=/tmp/pd2 node test/pd2/oefening.js`
