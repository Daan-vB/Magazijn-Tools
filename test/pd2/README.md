# Tests Productdata 2.0

Ontwerp: `docs/productdata-2.0-ontwerp.md`. Deze tests lezen de echte database (alleen lezen). Elke schrijfpoging wordt in
de browser onderschept: `wh-pd2-oefen` en `wh-pd2-feedback` gaan naar een kopie in het geheugen, al het andere schrijven
wordt geblokkeerd en geteld (moet 0 zijn). Picqer wordt niet aangeroepen. Er komt geen bedrijfsdata in de repo:
uitslagen en schermafdrukken gaan naar `UIT_MAP` (standaard de huidige map, niet in de repo zetten).

Nodig: Node met Playwright en Chromium. Repo serveren op poort 8811 (`python3 -m http.server 8811`), voor de regressie
ook `main` op 8812 (`git worktree add ../main-wt origin/main` en daar `python3 -m http.server 8812`).

| Script | Wat |
|---|---|
| `oefening.js` | doet elke oefening via de echte knoppen en velden en controleert de uitkomst (Mars 8 maatgroepen, Mars 120x180 Antraciet = Deel, tellers, afgerond, ongedaan, gewicht, kopieer voor Claude, opslag, wissen) |
| `schermen.js` | schermafdruk van elke tab op 390 en 1440 px; controleert dat niets buiten beeld valt en dat de eerste kolom vast blijft |
| `regressie.js` | laadt elke oude pagina op main en op deze tak en vergelijkt tekst en DOM-structuur; in 3.0 apart het menu (er mag precies één regel bij) |
| `live.js` | Picqer nagebootst: live voorraad per rij (20 per vraag, 3 s ertussen) en bij 429 terugval op de export met datum en pauze |
| `db-hash.sh` | hash van productdata, wh-pd-fam, catalog-ean en de pd2-rijen; vóór en na een test draaien en vergelijken |

Voorbeeld: `UIT_MAP=/tmp/pd2 node test/pd2/oefening.js`
