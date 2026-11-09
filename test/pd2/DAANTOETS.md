# Regelmatrix — Daantoets

Elke regel uit `CLAUDE.md` → welke schermen hij raakt → hoe hij automatisch getoetst wordt.
`test/pd2/daantoets.js` voert elke toets met een nummer (D-nr) uit; een rode controle noemt de regel (§ en nummer).
Lees dit vóór elke opdracht. Nieuwe regel van Daan = nieuwe rij hier én een nieuwe controle in `daantoets.js`.

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
| 3 | Soorten Pallet · Deel · Bulk · Pick · Mix · Weg; Weg = Uitlopend / Backorder / Archief | DL, TD | de soortkeuze en "Andere soort" tonen precies deze zes; Weg vraagt een van de drie | D22 |
| 3 | Bulk: nooit max op pick of aanvuladvies naar pick | DL, PD2 | geen Bulk-product met max op pick of aanvullen bij als vraag of voorstel | D23 |
| 3 | Palletvragen alleen met palletbewijs | DL, PD2 | geen product zonder palletbewijs met stuks per pallet, palletmaat of hoogte als vraag | D24 |
| 3 | Gewicht volle pallet nooit vragen; stuks per doos, doosmaat, inkoopverpakking niet vragen | DL, PD2 | geen vraag `gewpal`, `spd`, `verp` | D25 |
| 3 | Per familie invullen, waarden per product uit de eigen data | TD | voorstel staat per product; Picklocaties: "ieder zijn voorstel" als de producten verschillen | D26 |
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
| 2 | Picklocaties/Bulklocaties: werklijst "Klaar voor Picqer" per hal → gedeelte → gang met Wijzig | TD | na "Pick nodig" staan ze onder Klaar voor Picqer bij de gekozen gang (Kokos → C · D · DD) | D17 |
| 7 | Containers: Deel nooit een hele pallet naar pick; pick krijgt hele dozen of niets | CT | geen "pallet(s) à … → Picklocatie" bij Deel | D38 |
| 7 | Containers: voorraad op "geen specifieke locatie" telt niet als pick-voorraad | CT | KOKOS200NAT niet "pick is vol genoeg" door voorraad zonder plek | D39 |
| 10 | Vaste woorden (Productgeheugen, Soort, Kleurgenoten, Klaar voor Picqer, Later · moet nog) | TD | woorden komen voor zoals afgesproken | D40 |
| 9 | Oude pagina's blijven werken | Warehouse, Junior, Palletlabels, Containers | `regressie.js` (main ↔ tak); Warehouse, Junior en Palletlabels ongewijzigd (schakelaar `wh-pd-bron` niet omgezet) | D41 |
| 5 | Aanvullen bij / max op pick (Claudes keuze 09-11): Deel en Pallet met picklocatie krijgen ze alleen als ze ontbreken | DL, PD2 | vraag `lvl` (en bij Deel `maxpick`) alleen bij een vaste picklocatie en alleen als leeg | D42 |

Handmatig (niet automatisch te toetsen): §6 regels per leverancier (Kokos, ribbelmat, wandrekken) zitten in de voorstelregels van Productdata 2.0 en hebben hun eigen tests (`week1.js`, `rolcheck.js`, `bronnen.js`); §8 backorders (`containerbo.js`).
