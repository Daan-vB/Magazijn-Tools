# Rapport: Picqer-geschiedenis ophalen (17-10-2026)

**Gebouwd**
- `wh/historie.js` (nieuw), knop "Geschiedenis ophalen" onder Poort 0.4 in Test → Productdata (alleen Daan): één knop, voortgangsbalk, daarna één regel met aantallen.
- Alleen lezen, via `WHLIVE.vraag` (functie `picqer`, koppelcode uit dezelfde opslag als Vandaag). Functies, Warehouse, Junior, Ploeg, Containers, Palletlabels en `core.js` ongewijzigd. `lijst.json`: alleen `ivol` en `test`. Aanname `p-historie` toegevoegd (bevestigd Daan (chat) 2026-10-17).

**Opslag (nieuwe catalog-rijen, door geen scherm geladen)**
- `wh-vp-hist-2025q1…`: rijen `[id, tijd, iduser, idproduct, aantal, van-idlocation, naar-idlocation, idwarehouse]` (0 = geen specifieke locatie) + index `p` (idproduct→productcode), `l` (idlocation→naam), `u` (iduser→medewerker). Retourkar staat erin.
- `wh-ont-hist-2025q1…`: `[id, nummer, inkooporder, status, aangemaakt, klaar, wie, [[code, aantal]…]]`. Geen leveranciersnamen.
- `wh-hist-voortgang`: cursor en per venster `[van, tot, regels, vol]`; een onderbroken ronde gaat verder vanaf de cursor. `wh-verplaatsingen` blijft ongemoeid.
- Pauze 15 s tussen vragen. Bij elke fout (429, 5xx, netwerk) 65 s wachten (met aftelling "Picqer vraagt even te wachten…") en hetzelfde venster opnieuw, tot 8 keer; daarna stoppen met de melding. De voortgang (cursor) blijft bewaard, de knop gaat verder. Scherm toont "nog ca. N min" en dat het scherm open moet blijven (kan een uur duren).

**Beperkingen van de bestaande functie (niet aangepast, wel van belang)**
1. `verplaatsingen` heeft geen eindtijd en geeft de eerste 6000 regels vanaf `sinds`. Vensters van 1, 2 of 4 dagen of halveren veranderen daar niets aan: elke vraag kost dezelfde ≤60 pagina's en kleinere vensters geven alleen méér vragen. Daarom is een venster wat de functie teruggeeft (max. 6000 regels) en bepalen pauze en herhaling het tempo. Daarom: is het antwoord vol, dan telt wat zeker compleet is (laatste moment valt af) en begint het volgende venster op dat moment. Het venster is dan zo klein als nodig.
2. `vol` wordt alleen gemeld als alle 6000 regels verplaatsingen zijn; staan er ook andere mutaties tussen, dan meldt de functie ten onrechte niet-vol. Daarom geldt ook als vol: laatste regel meer dan 3 dagen vóór het ophaalmoment. Een periode met alleen niet-verplaatsingen kan zo onzichtbaar blijven.
3. `ontvangstenlijst` geeft maximaal de 40 nieuwste ontvangsten (uit de eerste 2000 die Picqer geeft) vanaf een datum, zonder eindtijd. Oudere ontvangsten zijn via deze functie niet op te halen. Voor volledige ontvangsten is een functie-aanpassing nodig (eindtijd/offset), of de inkoophistorie (`wh-inkoop`) gebruiken.

**Test (emulator, verzonnen data, functie gemockt)**: 39.180 verplaatsingen over 8 kwartalen in 15 vensters, geen dubbelen, geen gemiste rijen; vol-venster krimpt en gaat door; fout → wachten → één nieuwe poging; onderbreken na 3 vensters en hervatten geeft hetzelfde totaal; alleen de nieuwe catalog-rijen geschreven; verder geen schermen veranderd (alleen een kaart onder Poort 0.4).

Echte aantallen staan na het ophalen op het scherm; niet gedraaid tegen Picqer.

**Update rate limit (17-10)**: test met 429 op een venster: zelfde venster herhaald en doorgegaan; altijd 429: stopt na 8 pogingen, rest bewaard; alleen catalog-rijen geschreven.

**Update 504/429 (17-10)**: pauze 20 s; bij elke fout 90 s wachten en hetzelfde venster opnieuw, tot 12 pogingen; daarna wacht de ronde 10 min (aftelling) en begint vanzelf opnieuw vanaf de bewaarde cursor, tot Daan op Stop klikt (knop Stop vervangt de startknop). Eén diagnoseregel: venster (datum+tijd), poging n van 12, laatste status (getal + korte tekst). Test (verzonnen data): 12× 429/504 door elkaar op hetzelfde venster, ronde stopt, 600 s wachten, tweede ronde gaat door, totaal exact, geen dubbelen; Stop bewaart de cursor; alleen catalog-rijen geschreven.

**Niet gedaan: vensters van 3 uur / halveren.** `verplaatsingen` heeft geen eindtijd; elke vraag kost dezelfde ≤60 pagina's plus opzoekingen van producten, locaties en gebruikers, hoe klein het venster ook is. Kleiner venster in de app geeft alleen méér vragen. De oorzaak van de 504 zit dus in de functie. Echte oplossing: in `picqer` een eindtijd (of paginalimiet) toevoegen; dan kan `historie.js` direct met vensters van 3 uur werken. Tot dan: lange wachttijden en 's avonds/'s nachts laten lopen.

**Update lichte leesactie (17-10, Daan akkoord)**
- `picqer` (alleen toevoegingen; diff bevat geen verwijderde regels, `verplaatsingen` en andere acties ongewijzigd, `picqer-test` niet aangeraakt): `historielicht?sinds&tot&paginas` (standaard 8, max. 10; alleen movement, zelfde velden, `vol`, `laatste`; `tot` is exclusief, geen opzoekingen) en `idindex?soort&offset&paginas` (producten/locaties/gebruikers → `[id, code/naam]`, `volgende` of null). `locatielijst` kon dit niet hergebruiken (alleen Hoofdmagazijn, andere velden), dus nieuw.
- Eigen aanvraagfunctie `pqLicht` met budget van 100 s voor 429/5xx-herhalingen; daarna een nette fout (429 of 502) in plaats van een 504. Bestaande `pq` onaangeraakt. Aflopende volgorde van Picqer geeft een duidelijke fout (geen gaten).
- `historie.js`: eerst eenmalig en hervatbaar de namen (`wh-hist-index`: p/l/u), daarna vensters van 1 dag via `historielicht`; vol → verder vanaf `laatste` (laatste moment valt af en wordt opnieuw gehaald, dubbelen vallen weg op productsleutel). Kwartaalrijen zonder eigen index (8e veld 0; oude rijen blijven bruikbaar, namen altijd via `wh-hist-index`). Ontvangsten ongewijzigd. Tekst: "Namen ophalen", daarna "Verplaatsingen tot <datum> · nog ca. N minuten".
- Test (verzonnen data, gemockte functie): vol-vensters (147 van 198) gaan door vanaf `laatste`, 429/504 wisselend en zelfde venster herhaald, geen gaten of dubbelen (58.800 rijen exact), hervatten slaat index en klaar-vensters over, alleen catalog-rijen geschreven. Server-acties met gemockte Picqer: paginalimiet/vol, `tot`, 429 → nette fout, aflopend → fout, ongeldig moment 400, zonder koppelcode 401.
