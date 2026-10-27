# Per familie: ontwerp (Productdata, 27-10-2026)

Doel: Daan vult per familie, per maat, alleen in wat de app niet uit eigen data kan afleiden. Alles wat uit Picqer, inkoop,
verplaatsingen, verkoop of voorraad volgt, wordt automatisch getoond en voorgesteld, met de reden erbij. Nooit hetzelfde getal
voor alle producten. Een voorstel is nooit een opgeslagen waarde: alleen een klik of invoer van Daan slaat iets op.

Regels: alleen lezen uit Picqer (rem, bij 429/504 stoppen en later verder; Warehouse, Vandaag en Aanvullen gaan voor).
Schrijven alleen in eigen opslag. Productcode nooit aanpassen. Opgeslagen productdata, `wh-pd-fam` en Daans familienamen
nooit wissen of overschrijven; eerst een kopie van de oude waarden. Geen bedrijfsdata of sleutels in de repo.

## 1. Familie
- Familie = productlijn (bijv. "Schoonloopmat Mars"). Bestaande opgeslagen namen blijven.
- Maatgroep = alleen de maat uit de productnaam (120x180, 135x200, 40x60), in alle schrijfwijzen ("120 x 180", "120 x180",
  "120×180"), nooit kleur of overige tekst. Waarden in `wh-pd-fam.maat` met extra tekst ("135x200 · Rood") tellen als de maat.
- Bovenkant: naam, aantal producten, voortgang en een overzicht van producten zonder gewicht of met afwijkend gewicht.
- Tabs: (a) met picklocatie volgens Picqer (vast en tijdelijk apart); (b) zonder picklocatie maar met voorraad ("moet pick
  krijgen" / "geen pick", veld `pickkeuze`, buiten de tellers); (c) zonder voorraad: backorders, laatste inkoop, "uitlopend".

## 2. Werkscherm per maat
- Maat-kiezer en "Volgende maat". Eén rij per kleur met volledige Picqer-naam en code.
- Per rij: voorraad (pick en bulk per locatie, VST, zonder locatie), inkoop (gemiddelde per order, aantal, laatste datum,
  voorgekomen hoeveelheden), verkoop per maand (6 maanden, 28 dagen), gewicht per stuk, Soort.
- Gewicht: Picqer-waarde in kg (Picqer slaat gram op), "ontbreekt" bij leeg of 0, veld "Gewicht gecontroleerd" met vinkje
  "gewogen" (veld `kgst`, eigen opslag, gaat voor op Picqer), waarschuwing bij meer dan 30% afwijking van de andere kleuren of
  bij 0/ontbreekt, knop "Zelfde gewicht voor alle kleuren in deze maat".
- Soort: Pick, Deel, Pallet, Mix, Rol alleen backorder. Voorstel per product uit data met reden. "Rest van deze maat = Pick".
  - Pick: komt in kleine aantallen binnen en past helemaal op de pickplek, geen bulk.
  - Deel: komt op een pallet of in grotere hoeveelheid binnen dan op pick past; een deel gaat naar pick, de rest naar bulk,
    aanvullen met een deel van de bulkvoorraad.
  - Pallet: komt per volle pallet binnen en wordt per volle pallet aangevuld.
  - Mix: een pallet met meerdere producten erop, met een gedeelte naar pick gevuld.
  - Rol alleen backorder: alleen via backorder besteld.
  - Voorstel: verplaatsingen (hele bulkvoorraad in één keer naar pick = Pallet, een deel = Deel); bulk aanwezig en inkoop per
    order groter dan wat op pick past = Deel; geen bulk en kleine inkoop = Pick. Nooit een gok voorinvullen.

## 3. Velden per soort
- Pick: controle of er een picklocatie is (naam en aantal), "Max op pick" (voorstel: gemiddelde inkoop per order), gewicht.
- Deel / Pallet / Mix: Max op pick, stuks per pallet (meest voorkomende inkoophoeveelheid, hoeveelheden getoond), palletmaat,
  hoogte incl. pallet (uit afmetingen en stuks, naar boven op 10 cm), gewicht volle pallet (stuks x gewicht per stuk +
  palletgewicht, som getoond, Picqer-gewicht "te controleren"), plaatsen op ligger, max pallets per ligger. Palletmaat en
  plaatsen alleen uit vergelijkbare producten van dezelfde leverancier met dezelfde of vergelijkbare afmetingen, anders leeg.
  Knop "Zelfde voor andere Deel-producten in deze maat".
- Rol alleen backorder: geen velden.
- Rollen (maat boven 60x100): nooit een palletmaat of picklocatie-ruimte van die maat aannemen; de bestaande rolregels blijven.
- Verwijderd uit Per familie en `nodig()`: stuks per doos en doosmaat (verpakking is een later stadium; ingevulde waarden
  blijven in de opslag), de "klopte bij x%"-blokken, de "Gebruik"-knoppen en de kolomknoppen "geldt voor de hele familie".

## 4. Voortgang
`nodig()` en `telOpen()`: Pick telt soort, picklocatie, max op pick en gecontroleerd gewicht. Deel/Pallet/Mix tellen ook de
palletvelden. Rol alleen backorder telt alleen de soort.

## 5. Automatisch
Namen, voorraad per locatie en productlocaties live bij het openen van een familie (alleen lezen, met rem). Inkoop en
verplaatsingen worden automatisch bijgewerkt (rem, voorrang, stoppen bij 429/504).
