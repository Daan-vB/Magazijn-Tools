# CLAUDE.md — vaste regels van Daan (IVOL Warehouse)

Lees dit vóór elke opdracht in deze repo. Alles wat je bouwt of voorstelt moet hiermee kloppen. Botst een opdracht met een regel hieronder: volg de regel en meld het in het rapport. Daan heeft deze regels vaak herhaald; hij wil ze nooit meer hoeven te herhalen. Nieuwe regels van Daan komen hier bij (kort, één regel per afspraak).

## 1. Systeem en data
- Picqer alleen lezen. Nooit schrijven naar Picqer (pas na akkoord van Maxime). Schrijven alleen in eigen opslag (Supabase), en altijd eerst een kopie van wat je overschrijft.
- Alles live uit Picqer via het tussenstation (Supabase-functie "picqer", koppelcode in localStorage 'ivol-koppelcode'). Nooit Daan om een export, screenshot of bestand vragen voor iets wat live te lezen is.
- Picqer is eigenaar van naam, productcode, EAN en prijzen. Het magazijn is eigenaar van gewicht en aanvulinstellingen. Productcode is heilig.
- Inkoop en alles buiten het magazijn: zichtbaar, nooit bewerkbaar.
- Nooit stil wijzigen wat Daan heeft bevestigd of zelf heeft ingevuld; een akkoord blijft akkoord.
- Antwoorden in oefeningen zijn geen echte productdata.
- API-sleutels nooit in de repo of in logs; geen bedrijfsdata in de repo.

## 2. Vragen en schermen
- Vraag alleen wat de data niet kan beantwoorden. Leid eerst af uit Picqer, palletlabels (± 1000 producten), VST, verplaatsingen, pakbonnen en inkoop.
- Eén vraag tegelijk, rustig scherm: geen tabellen met horizontaal scrollen, weinig kleur en knoppen, schermvullend, 390 en 1440 px.
- Groepsacties: vinkje per product; "Selectie is: Pallet · Deel · Pick · Mix · Weg"; een familieknop laat altijd zien welke producten eronder vallen en laat uitvinken.
- Soort eerst. Pas na een door Daan bevestigde soort komen gewicht en hoeveelheid.
- Tijden altijd 24-uurs.
- Nooit decimalen in aantallen (stuks, dozen, rollen, pallets).

## 3. Soort en welke vragen erbij horen
- Pallet = komt per volle pallet binnen en wordt per volle pallet aangevuld.
- Deel = komt op een pallet of in grotere hoeveelheid dan op pick past; deel naar pick, rest naar bulk; aanvullen met een deel van de bulkvoorraad.
- Pick = kleine hoeveelheden, geen bulk. Enige vraag: max op pick.
- Mix = pallet met meerdere producten, met een deel naar pick.
- Weg = keuzemenu Uitlopend (geen data meer nodig) / Backorder (alleen voor backorders ingekocht; voorlopig wegfilteren) / Archief.
- Pallet en Deel: stuks per pallet, palletmaat, hoogte incl. pallet, gewicht volle pallet. Stuks per doos, doosmaat en inkoopverpakking niet vragen (later).
- VASTE REGEL palletvragen: palletvragen (per pallet, palletmaat, hoogte, gewicht volle pallet, plaatsen, max per ligger) alleen voor producten waarvan de data bewijst dat ze per pallet komen of liggen: bulk- of VST-voorraad, palletlabels, pallet-verplaatsingen naar pick, of inkoop van minstens één volle pallet. Producten met voorraad 0 of minimaal, alleen voor backorders ingekocht, of per enkele stuks of rollen binnen: voorstel Pick (of Weg → Backorder) en nooit palletvragen.
- Per familie invullen, maar waarden per product uit de eigen data van dat product (inkoop, gewicht, verkoop), nooit één getal voor alles.
- Volgorde van bronnen voor een voorstel: 1) eigen data van het product (palletbewijs-regel gaat altijd voor), 2) kleurgenoten of dezelfde familie en maat, 3) dezelfde familie. Nooit "meerderheid bij de leverancier": één leverancier levert heel verschillende producten (lockers zijn geen whiteboards).

## 4. Gewicht
- Status: gewogen (echt gewogen) · vertrouwd (Daan vertrouwt de Picqer-waarde) · te wegen (nu zeker fout; komt op de Weeglijst, kg niet verplicht).
- Picqer-gewichten zijn bij bijna elke leverancier deels fout. Losse producten op de weegschaal, volle pallets met de reachtruck.

## 5. Hoeveelheden, pallets en locaties
- Max op pick = aanvullen bij + wat je aanvult (bij 10 + pallet van 67 = 77), zoals "vul aan tot" in Picqer.
- Pallethoogtes naar boven afronden op 10 cm.
- Hal A heeft alleen 3-liggers en een lager dak (20-locatie ± 140 cm). Hal B en C bijna allemaal 4-liggers, behalve begin/eind van een gang. BA en BB hebben 10, 20 en 30.
- Vloernaam = productcode + " - " + korte omschrijving (bijv. "4560WM - Whiteboard magnetisch 45x60"); bij lopers/matten de dikte erin.
- Rubber per stuk (ringmat, sportvloer, stalmat), A/B met picklocatie: aanvullen bij 10 met een hele pallet.
- Rollen: alleen als rol behandelen als Daan het product als rol kiest. Elke rol op een koker van 10 cm. Per rol: breedte, lengte volle rol, diameter, kg per rol, max rollen per pallet, staand/liggend, wat op pick past. Geen één aanvulregel voor alle rollen.

## 6. Leveranciers en families
- SAM Europe: alleen picklocatie, bulklocaties en aanvulniveau; niets anders vragen; nooit combineren of vergelijken met andere artikelen.
- Whiteboards: alleen FWB van Hebei komen in kratten van 50. Ningbo Henri komt los in de container; het team stapelt zelf pallets met een vast aantal per product (4560WM: 100 per pallet, 80x120x140); pick wordt per hele pallet aangevuld.
- Kokos: alleen 100 of 200 cm breed. 100 breed: een stuk tot 30 kg in een doos, daarboven op pallet (rol max 600 cm); losse stukken in één order elk een eigen doos. 200 breed: tot 2 m en onder 30 kg in een doos, anders pallet.
- Rubber ribbelmat op rol: losse lengtes 1–10 m bestaan pas enkele maanden; per 25 of meer een eigen pallet, rest op een mix/pick-pallet.
- Wandrekken (Ningbo Henri): omdozen met vast aantal per type, meestal 6 omdozen per pallet (80x120x180, liefst op 10-locaties, vaak effectief 90x120); aanvullen bij 2 met hele omdozen tot wat op pick past.

## 7. Containers (containerplanning.html)
- Containers komen binnen in dozen; het team bouwt zelf pallets. "Los" alleen bij een pakbonregel met Per = 1; anders dozen ("5 dozen à 100").
- Nooit losse stuks uit een doos naar pick; pick krijgt hele dozen of niets.
- Een krat (bijv. E4005-10KG, krat van 100) telt als 1 pallet.
- Geen gecontroleerde data = geen automatisch advies: "bij lossen bepalen" en op de invullijst lossen; Daan voert het daarna één keer in, dan is het product voor elke volgende container bekend.
- Pakbonregel zonder Picqer-product (verpakking zoals WASHER PUMP BOX) = "geen voorraad", gaat naar Karin en Kate, geen fout.
- Onbekend of nieuw = info, nooit een fout. Geen meldingen die Daan niets laten doen.

## 8. Backorders
- Alleen backorders die door aanvullen/verplaatsen of door inkomende goederen komen, zijn magazijnwerk. Echte backorders (wachten op inkoop) niet als probleem tonen.

## 9. Werkwijze bij elke opdracht
- Eerst git pull --rebase origin main. Eén run, geen vragen; wat onduidelijk is: kies de regel hierboven en meld het.
- Alleen de genoemde bestanden; oude pagina's blijven werken (regressietest).
- Tests lezen de echte database, maar elke schrijfpoging wordt onderschept (0 geblokkeerd).
- Rapport kort, in het Nederlands, zonder vaktaal.

## 10. Woorden (vaste namen, nooit andere gebruiken)
- Productgeheugen = Supabase catalog-rij catalog-ean (palletlabels, vloernaam, stuks per pallet, palletregels). Productdata = Supabase-tabel productdata (Daans waarheid per product).
- Soort = Pallet · Deel · Pick · Mix · Weg (Uitlopend / Backorder / Archief). Palletbewijs = bulk- of VST-voorraad, palletlabel, pallet-verplaatsing naar pick of inkoop van een volle pallet.
- Gewicht-status = gewogen · vertrouwd · te wegen. Max op pick = aanvullen bij + aanvullen met.
- Bulk = 10/20/30-plek boven pick (tijdelijk). Pick = vaste picklocatie (nooit tijdelijk). VST = externe opslag Van Spreuwel. Geen specifieke locatie = voorraad zonder plek.
- Familie → maat → kleurgenoten (zelfde familie en maat). A/B/C = verkoopklasse.
- Containers: Pakbon → Verdeling → Uitvoer (losdag-PDF, labels). "Bij lossen bepalen" = nog geen gecontroleerde data, staat op de invullijst lossen. "Na het lossen" = één keer invullen door Daan.
- Productdata 2.0 = per maat 3 stappen: 1 Soort · 2 Gewicht · 3 Hoeveelheid. Te controleren = alleen vragen die regels en data niet beantwoorden, soort eerst, per familie.
- Sporen: 1 Containers · 2 Productdata 2.0 / Te controleren · 3 Warehouse 3.0 (fundering + pilaren 1 Aanvullen · 2 Voorraad op plek · 3 Inkomend · 4 VST · 5 Orders).
