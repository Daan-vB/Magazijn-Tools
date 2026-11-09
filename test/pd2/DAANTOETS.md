# Regelmatrix — Daantoets

Elke regel uit `CLAUDE.md` → welke schermen hij raakt → hoe hij automatisch getoetst wordt.
`test/pd2/daantoets.js` voert elke toets met een nummer (D-nr) uit; een rode controle noemt de regel (§ en nummer).
Lees dit vóór elke opdracht, samen met `docs/BLAUWDRUK.md` (Daans 16 basispunten). Nieuwe regel van Daan = nieuwe rij hier én een nieuwe controle in `daantoets.js`.

Schermen: **DL** = Doorloop (`#/doorloop/...`) · **PD2** = Productdata 2.0 (`#/pd2`) · **TD** = Te doen-tabs (`#/todo/<tab>`) · **CT** = Containers / Containerdag (`containerplanning.html`) · **alle** = elke route uit het menu.

Draaien: `node test/pd2/daantoets.js` (repo op poort 8811). Moet groen zijn vóór elke push, samen met `schermvullend.js` en `regressie.js`.

| § | Regel (kort) | Schermen | Toets | D-nr |
|---|---|---|---|---|
| 1 | Picqer alleen lezen; schrijven alleen in eigen opslag, altijd eerst een kopie | alle | 0 geblokkeerde schrijfpogingen (ook geen aanroep van het tussenstation); elke schrijfactie naar productdata heeft vooraf een kopie (`wh-kopie-productdata-*`) | D1, D2 |
| 1 | Alles live; nooit om een export, screenshot of bestand vragen | TD, DL, PD2 | geen tekst "exporteer", "upload een export", "stuur een screenshot" in de schermen | D3 |
| 1 | Productcode is heilig | alle | elke geschreven productdata-rij heeft precies de productcode uit Picqer | D4 |
| 1 | Nooit stil wijzigen wat Daan bevestigde | TD, DL, PD2 | alle tabs, Doorloop en Productdata 2.0 openen zonder tik = 0 schrijfacties | D5 |
| 1 | Geen API-sleutels of bedrijfsdata in de repo | repo | geen geheime Supabase-sleutel (service- of secret-sleutel), koppelcode-waarde of `.xlsx/.csv`-export in de repo | D6 |
| 2 | Eén vraag tegelijk, rustig scherm, geen tabellen met horizontaal scrollen | DL, TD | Doorloop: precies één `.vraag`; Te doen: geen `<table>`; 390 en 1440 px zonder horizontaal scrollen | D7, D8 |
| 2 | Schermvullend (390/1440/2560, zoom 50%/200%) | alle | `schermvullend.js` (hoort bij de regressie); daantoets meet Te doen op 390, 1440 en 2560 px | D8 |
| 2 | Samenvoegen: elke lijst en tab per familie (groep → familie → product), alles aangevinkt, één vraag, "Selectie is: …", uitvinken voor uitzonderingen | TD, DL, PD2 | elke tab met punten toont groepen met "Selectie is:", alles aangevinkt, per familie een vinkje; uitvinken → blijft staan na het besluit | D9, D10 |
| 2 | Familieknop laat zien welke producten eronder vallen | TD | elke groep heeft "Geldt voor …" met de codes | D9 |
| 2 | Soort eerst; gewicht en hoeveelheid pas na bevestigde soort | DL | geen gewicht- of hoeveelheidsvraag voor een product zonder bevestigde soort | D11 |
| 2 | Elk invulscherm: terug, aanpasbaar, zoeken, vergelijkbaar met "Neem over", afwijkingen melden | DL, TD | Doorloop heeft ←, 🔍, Vergelijkbare producten met "Neem over" en de vaste uitlegregel; Te doen heeft per product "Aanpassen" (opent de Doorloop) | D12, D13 |
| 2 | Later: bewaard, telt niet mee, apart (tab Later), nooit vooraan in de Doorloop | TD, DL | een vraag op Later staat niet in de gewone Doorloop, wel in tab Later; tabtellers tellen hem niet | D14 |
| 2 | Te doen = tabs Overzicht · Later · Picklocaties · Bulklocaties · Hercontrole · Gewicht controleren · Te wegen · Aantal per pallet; elk punt met voorstel en reden | TD | volgorde van de tabs; elk punt heeft een reden | D15 |
| 2 | Eén product = één punt per tab; tellers tellen producten | TD | geen product twee keer in een tab; teller = aantal producten | D16 |
| 2 | Beslist = weg: tab telt af | TD | na Pick nodig, Alleen bulk, Voorstel overnemen, Klopt zo of Later verdwijnt het product uit de open lijst | D17, D18, D19 |
| 2 | Tijden 24-uurs | TD, DL | geen AM/PM in de schermen | D20 |
| 2 | Nooit decimalen in aantallen | DL, CT, TD | Doorloop weigert 2,5 bij stuks per pallet, aanvullen bij en max op pick; tellers zijn hele getallen | D21 |
| 3 | Soort = Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg · Backorder (blauwdruk §8); Weg = Uitlopend / Archief | DL, TD, PD2 | "Andere soort" in de tabs, de soortlijst van 2.0 en de Doorloop tonen precies deze acht; Weg vraagt Uitlopend of Archief | D22, D22b |
| 3 | Bulk: nooit max op pick of aanvuladvies naar pick | DL, PD2 | geen Bulk-product met max op pick of aanvullen bij als vraag of voorstel | D23 |
| 3 | Palletvragen alleen met palletbewijs | DL, PD2 | geen product zonder palletbewijs met stuks per pallet, palletmaat of hoogte als vraag | D24 |
| 3 | Gewicht volle pallet nooit vragen; stuks per doos, doosmaat, inkoopverpakking niet vragen | DL, PD2 | geen vraag `gewpal`, `spd`, `verp` | D25 |
| 3 | Per familie invullen, waarden per product uit de eigen data | TD | wat duidelijk ergens anders staat (eigen pick/bulk of de familie elders) is een uitzondering: uitgevinkt, met een eigen voorstel en eigen knop | D26 |
| 3 | Bronnen: eigen data → kleurgenoten → familie; nooit "meerderheid bij de leverancier" | DL | Vergelijkbaar: kleurgenoten → familie → groep (leverancier + hoofdwoord), nooit andere hoofdwoorden | D27 |
| 3/10 | Kleurgenoten = zelfde familie én zelfde maat (maat ook uit de naam: afmetingen, lengte, kg, aantal, dikte) | TD, DL, PD2 | nooit een kleurgenoot met een andere maat (MM 10x120 ↔ 4x120, 3028-3/-4/-5, KB-…-4kg/-12kg, Ring-roll 3 m/6 m) | D28 |
| 4 | Gewicht: voorstel alleen uit kleurgenoten; andere maat alleen met rekensom; anders Naar Te wegen | TD | geen gewichtsvoorstel uit een andere maat zonder rekensom (KB-blkred-4kg nooit 12 kg, Ring-roll 3 m ≠ 6 m, 3028 nooit allemaal 8 kg); 1711-white-set → 0,045 kg | D29 |
| 4 | Status gewogen · vertrouwd · te wegen; gewogen zonder kg niet bewaren | DL | de gewichtkeuze toont precies die drie; gewogen zonder kg geeft een melding | D30 |
| 4 | Gewicht volle pallet = kg × per pallet + 15, alleen bij vertrouwd of gewogen | DL | te wegen → "berekend na wegen"; vertrouwd → berekend getal | D31 |
| 5 | Max op pick = aanvullen bij + aanvullen met (Pallet: + stuks per pallet, berekend) | DL, PD2 | Pallet met aanvullen bij 10 en 67 per pallet → max op pick 77, nooit gevraagd | D32 |
| 5 | Pallethoogtes naar boven op 10 cm | DL, TD | 143 wordt 150; hoogte niet op 10 cm staat in Hercontrole | D33 |
| 5 | Palletmaat: altijd de hele lijst; nieuwe maat wordt bewaard en staat overal | DL | alle vaste opslagmaten als keuze; "+ Nieuwe maat" schrijft `wh-palletmaten` | D34 |
| 5 | Drie hallen A, B, C; hal C met gedeelte C en D; geen hal D; alleen bestaande gangen | TD, PD2 | nergens "hal D"; keuze hal → gedeelte → gang; gangen alleen uit de locaties | D35 |
| 6 | SAM Europe: nooit combineren of vergelijken | TD, DL | geen SAM in de tabs of in Vergelijkbaar; SAM staat in een eigen groep | D36 |
| 3 | Hercontrole: "Weg met voorraad" alleen bij Archief (en Backorder met meer voorraad dan backorders); Uitlopend met voorraad is normaal; andere soort bij kleurgenoten niet als één van beide Weg is; elk punt met Claudes visie en voorstel | TD | geen Uitlopend in Hercontrole, wel E400560-10KG; geen soortfout met een Weg-kleurgenoot; elk punt heeft een visie | D37 |
| 2 | Picklocaties: de groep krijgt één voorstel (gang waar de meeste producten staan); werklijst "Klaar voor Picqer" per hal → gedeelte → gang met Wijzig | TD | Wallace · kokos: kop met voorraad, verkoop en "nu in DD …"; voorstel C · D · DD voor de rollen, matten 80x120 uitgevinkt met eigen voorstel; één tik → Klaar voor Picqer bij DD | D17a, D17b |
| 7 | Containers: Deel nooit een hele pallet naar pick; pick krijgt hele dozen of niets | CT | geen "pallet(s) à … → Picklocatie" bij Deel | D38 |
| 7 | Containers: voorraad op "geen specifieke locatie" telt niet als pick-voorraad | CT | KOKOS200NAT niet "pick is vol genoeg" door voorraad zonder plek | D39 |
| 2 | Feiten om te kiezen (blauwdruk 9–14): bij elk product voorraad per plek, verkoop 28 d en 6 mnd, laatste inkoop, backorders, soort en gewicht-status; in de kop van elke groep en familie het aantal, de voorraad per plek, de verkoop en waar de groep nu staat | TD | elk product heeft "verkoop 28 d" en pick/bulk/VST/geen plek; elke groeps- en familiekop heeft producten · pick · bulk · VST · geen plek · verkoop 28 d · nu in … | D43 |
| 2 | Kiezen = meteen opslaan (met kopie), 3 seconden "Bewaard · ongedaan maken"; geen aparte knoppen "Pick nodig" / "Wens bijwerken" | TD | één tik bewaart; ongedaan maken schrijft terug zoals het was; kiezen bij één product werkt ook; de balk verdwijnt na 3 s | D44, D44b, D44c |
| 4 | Twee tegen elkaar (of een gelijke stand): geen voorstel, alle Naar Te wegen met die reden; nooit elkaars waarde | TD | SI60120BR 10 kg ↔ SI60120TP 4 kg: geen voorstel, beide wegen; nooit een voorstel uit één kleurgenoot die het oneens is | D45 |
| 3 | Twijfel = soort "weet ik nog niet" (niet afgerond, geen gewicht/hoeveelheid, onder Later); Backorder = eigen soort (oude Weg · Backorder telt als Backorder, pas bij de volgende bewaaractie omgezet) | TD, DL, PD2 | Twijfel-product: niet afgerond, alleen "soort" open, geen vragen, in tab Later; elke oude Weg · Backorder leest als Backorder en wordt bij bewaren omgezet | D46 |
| 3/7 | Containers: Backorder → alleen de backorders, rest VST; Twijfel → bij lossen bepalen | CT | advies voor KOKOS200NAT met soort Backorder en Twijfel (in het geheugen) | D47 |
| 10 | Vaste woorden (Productgeheugen, Soort, Kleurgenoten, Klaar voor Picqer, Later · moet nog) | TD | woorden komen voor zoals afgesproken | D40 |
| 9 | Oude pagina's blijven werken | Warehouse, Junior, Palletlabels, Containers | `regressie.js` (main ↔ tak); Warehouse, Junior en Palletlabels ongewijzigd (schakelaar `wh-pd-bron` niet omgezet) | D41 |
| 5 | Aanvullen bij / max op pick (Claudes keuze 09-11): Deel en Pallet met picklocatie krijgen ze alleen als ze ontbreken | DL, PD2 | vraag `lvl` (en bij Deel `maxpick`) alleen bij een vaste picklocatie en alleen als leeg | D42 |
| 7 | Verkoop in Containers = bestellingen uit Picqer (ook backorders), niet alleen verzonden; "geen verkoophistorie" alleen bij 6 maanden zonder bestelling | CT | situatie in het geheugen (nagebootst tussenstation, actie `bestellingen`): container NL-300, KOKOS100BLK-24 en KOKOS100NAT-24 tonen "Verkoop: x/mnd (6 mnd) · y laatste 28 dgn" met x > 0 en het advies zegt niet "geen verkoophistorie" | D43 |
| 7 | Containers: "Verkoop niet live" noemt altijd de echte reden (geen koppelcode, koppelcode klopt niet, time-out, geen verbinding, functie kent de actie niet, Picqer weigert, te traag); tijdens ophalen voortgang in blokken van 14 dagen, wat binnen is blijft bewaard | CT | nagebootst tussenstation: Onbekende actie, 429, Picqer-sleutel geweigerd, tijd op → elk zijn eigen reden; functie heeft actie `versie` | D48 |

Handmatig (niet automatisch te toetsen): §6 regels per leverancier (Kokos, ribbelmat, wandrekken) zitten in de voorstelregels van Productdata 2.0 en hebben hun eigen tests (`week1.js`, `rolcheck.js`, `bronnen.js`); §8 backorders (`containerbo.js`).
