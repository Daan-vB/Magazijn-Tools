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
