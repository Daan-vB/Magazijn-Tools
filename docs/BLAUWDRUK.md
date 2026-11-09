# Blauwdruk productdata — Daans 16 basispunten (de rode lijn)

Lees dit vóór elke opdracht, samen met CLAUDE.md. Alles wat gebouwd wordt (Doorloop, Productdata 2.0, Te doen-tabs, Containers, Aanvullen, Labels, Verzenden) leest en vult deze 16 punten. Een scherm toont bij elk product de feiten die nodig zijn om te kiezen, en laat alleen invullen wat de data niet weet.

| # | Punt | Wat precies | Eigenaar |
|---|---|---|---|
| 1 | Productnaam | naam zoals in Picqer | Picqer (lezen) |
| 2 | Vloernaam | productcode + " - " + korte omschrijving (dikte bij lopers/matten) | productdata / Vloernamen |
| 3 | Productcode | heilig, sleutel van alles | Picqer |
| 4 | EAN | barcode | Picqer |
| 5 | Leverancier | naam + herkomst Europees of Container | Picqer + productdata |
| 6 | Gewicht | per stuk · per doos · per cm/meter · volle rol · omdoos; status gewogen/vertrouwd/te wegen | productdata |
| 7 | Afmetingen | product los l×b×h · doos · rol per m/cm · volle rol · omdoos · pallet (maat + hoogte) | productdata |
| 8 | Soort | Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg · Backorder | productdata (Daan) |
| 9 | Locaties | pick · bulk · VST · geen plek · tijdelijk; pickwens hal → gedeelte → gang | Picqer (lezen) + productdata |
| 10 | Inkoop | historie: aantallen, data, meestal | Picqer (lezen) |
| 11 | Verkoop | 28 dagen · 6 maanden · ABC | Picqer (lezen) |
| 12 | Aanvulhoeveelheden | aanvullen bij · aanvullen met · max op pick (= bij + met) | productdata |
| 13 | Palletaantallen | stuks per pallet (palletbewijs) · gewicht volle pallet (berekend) | productdata / palletlabels |
| 14 | Leverhoeveelheden | per levering: dozen à n, pallets à n (pakbon "Per"), meestal-aantal | pakbonnen + inkoop |
| 15 | Palletplaatsen | plaatsen op ligger · max per ligger · past op 10/20/30, hal A 140 cm | productdata |
| 16 | Verzenden | max per doos · welke doos · welke pallet · verzendmethode (DPD · DHL pakket · VST · DHL Freight) | productdata |

Werkwijze: elk scherm heeft een schermkaart (welke punten tonen, welke invullen); Te doen = de gaten in deze 16 punten per groep/familie met voorstel en feiten; nieuw of veranderd scherm eerst als oefenversie met echte data, pas na Daans akkoord bouwen; elke opdracht eindigt met daantoets.js groen.
