# CLAUDE.md — vaste regels van Daan (IVOL Warehouse)

Lees dit vóór elke opdracht in deze repo, samen met docs/BLAUWDRUK.md (Daans 16 basispunten: de rode lijn van alles) en test/pd2/DAANTOETS.md. Alles wat je bouwt of voorstelt moet hiermee kloppen. Botst een opdracht met een regel hieronder: volg de regel en meld het in het rapport. Daan heeft deze regels vaak herhaald; hij wil ze nooit meer hoeven te herhalen. Nieuwe regels van Daan komen hier bij (kort, één regel per afspraak).

## 1. Systeem en data
- Picqer alleen lezen. Nooit schrijven naar Picqer (pas na akkoord van Maxime). Schrijven alleen in eigen opslag (Supabase), en altijd eerst een kopie van wat je overschrijft.
- Alles live uit Picqer via het tussenstation (Supabase-functie "picqer", koppelcode in localStorage 'ivol-koppelcode'). Nooit Daan om een export, screenshot of bestand vragen voor iets wat live te lezen is.
- Verkoop per maand (wh-verkoop-gepickt, wh-verkoop-besteld, wh-verkoop-mnd + tabel verkoop), voorraad per locatie (wh-voorraad) en locaties (wh-locaties) verversen elke nacht 05:30 vanzelf uit live Picqer (GitHub-workflow ververs.yml, script .github/ververs/ververs.py; Daan exporteert niet meer). Bij elke dataset staat de datum ververst; ouder dan 36 uur = oranje melding. Excel-import blijft reserve. Log is openbaar: alleen aantallen, nooit producten.
- VASTE REGEL twee tellingen verkoop (Daan 22-11): verkoop-gepickt = fysieke picks uit de voorraadmutaties van het Hoofdmagazijn, op pickdatum (onderdelen van sets tellen mee, sets zelf niet); verkoop-besteld = bestellingen op besteldatum. ABC en aanvulniveaus gebruiken verkoop-gepickt (wh-verkoop-mnd en tabel verkoop), inkoop en backorders verkoop-besteld (wh-verkoop-besteld). Elke nacht beide; 0 producten mogen gepickt zijn zonder verkoop.
- De nachtelijke workflow logt in bij het tussenstation met het bestaande SUPABASE_ACCESS_TOKEN (header x-ivol-beheer): alleen project jarbgetbwkjtxwtcfwmq, alleen de functie picqer, alleen GET en alleen status, catalogus, locaties, locatielijst, bestellingen en gepickt. Token nooit loggen of bewaren.
- Picqer is eigenaar van naam, productcode, EAN en prijzen. Het magazijn is eigenaar van gewicht en aanvulinstellingen. Productcode is heilig.
- Inkoop en alles buiten het magazijn: zichtbaar, nooit bewerkbaar.
- Nooit stil wijzigen wat Daan heeft bevestigd of zelf heeft ingevuld; een akkoord blijft akkoord.
- Antwoorden in oefeningen zijn geen echte productdata.
- API-sleutels nooit in de repo of in logs; geen bedrijfsdata in de repo.

## 2. Vragen en schermen
- Vraag alleen wat de data niet kan beantwoorden. Leid eerst af uit Picqer, palletlabels (± 1000 producten), VST, verplaatsingen, pakbonnen en inkoop.
- Eén vraag tegelijk, rustig scherm: geen tabellen met horizontaal scrollen, weinig kleur en knoppen, schermvullend, 390 en 1440 px.
- VASTE REGEL schermvullend: nergens een vaste max-width op pagina, kop, kaart, lijst of knoppenbalk (alleen lopende tekst mag max 70ch). Breed scherm of uitzoomen = meer naast elkaar (kolommen), inzoomen = groter en herschikken. Maten in rem/%, geen px-breedtes. De test schermvullend.js (elke route op 390, 1440 en 2560 px en zoom 50% en 200%: geen lege zijkanten, geen horizontaal scrollen) hoort bij de regressie en moet groen zijn vóór elke push.
- VASTE REGEL samenvoegen: elke lijst en elke tab werkt per familie (en maat), nooit product voor product. Familie tonen met alle producten aangevinkt, één vraag, "Selectie is: …" voor alles wat aangevinkt is (soort, pickwens hal/gang, alleen bulk, gewicht, aantal per pallet); uitvinken voor de uitzonderingen. Voorstel voor de hele familie uit waar de familie nu al staat.
- Groepsacties: vinkje per product; "Selectie is: Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg · Backorder"; een familieknop laat altijd zien welke producten eronder vallen en laat uitvinken.
- Samenvoegen gaat per groep → familie → product. Groep = leverancier + hoofdwoord ("Rubberselect · loper"), nooit SAM Europe. Ook "Volgende familie" en zoeken (Doorloop, Productdata 2.0) volgen de groep.
- Eén product = één punt per tab (alle redenen eronder); tellers tellen producten. Beslist = weg: na een besluit verdwijnt het product uit de open lijst en telt de tab af.
- Elk beslisscherm toont bij elk product en elke groep de feiten om te kiezen (voorraad per plek, verkoop, inkoop, backorders). Kiezen = meteen opslaan, met ongedaan maken.
- Picklocaties: de groep krijgt één voorstel (de gang waar de meeste producten van de groep nu staan); wat duidelijk ergens anders staat, staat als uitzondering al uitgevinkt met een eigen voorstel.
- Picklocaties en Bulklocaties: na het besluit staat het onder "Klaar voor Picqer" (werklijst per hal → gedeelte → gang, met Wijzig); het verdwijnt zodra Picqer het laat zien.
- Soort eerst. Pas na een door Daan bevestigde soort komen gewicht en hoeveelheid.
- Elk invulscherm: altijd terug kunnen naar een eerdere vraag, elke bevestigde waarde aanpasbaar, zoeken op code/naam/familie, en bij aanpassen vergelijkbare producten (kleurgenoten → familie → zelfde hoofdwoord bij dezelfde leverancier) met "Neem over". Afwijkende waarden in een familie melden (nooit zelf wijzigen).
- Later = bewust uitstellen: wordt bewaard (ook na herstart en op elk apparaat), telt niet mee voor het afronden van een stap of poort, en staat apart bovenaan Te doen als "Later · moet nog" (prioriteit). Komt alleen terug als Daan de Later-lijst opent. Nooit weer vooraan in de gewone Doorloop.
- Te doen = tabs per categorie (Overzicht met Claudes analyse eerst · Later · Twijfels · Picklocaties · Bulklocaties · Hercontrole · Gewicht controleren · Te wegen · Aantal per pallet). Elk punt met Claudes voorstel en reden; Daan beslist met één tik. Picqer-locaties koppelen/ontkoppelen doet Daan zelf; de app maakt per hal/gang de werklijst (pickwens).
- VASTE REGEL Weekendcheck (Daan 23-11): afgeleide vragen per regel bekijken, nooit product voor product: één kaart per regel (vraagsoort + antwoord + reden) met Klopt / Niet goed; Klopt geldt voor alle producten eronder (één antwoord-rij, bron daan-regel), Niet goed = typveld en de regel gaat naar Twijfels; losse producten alleen als ze afwijken. Bovenin het vraagscherm "nog N open (x voor jou · y voorstellen)"; na de laatste open vraag een klaar-scherm met "x overgeslagen — bekijken", nooit eindeloos terug. Voorsteltekst met de datum van de snapshot, feiten live (bij sets verkoop-besteld).
- Tijden altijd 24-uurs.
- Nooit decimalen in aantallen (stuks, dozen, rollen, pallets).

## 3. Soort en welke vragen erbij horen
- Pallet = komt per volle pallet binnen en wordt per volle pallet aangevuld.
- Deel = komt op een pallet of in grotere hoeveelheid dan op pick past; deel naar pick, rest naar bulk; aanvullen met een deel van de bulkvoorraad.
- Bulk = pallet staat alleen op bulk, geen picklocatie. Alleen als het besteld wordt: het bestelde aantal (niet 1 stuk) van bulk naar geen specifieke locatie verplaatsen, alleen als de hele order daardoor weg kan; bij een deelzending alleen dat deel. Daarna Verwerk backorders, zodat het op de picklijst komt (basis 23-11). Nooit aanvuladvies naar pick. Vragen: gewicht en de palletvragen (per pallet, palletmaat, hoogte); geen max op pick. Voorbeeld: alle Sprinttrack kunstgras.
- Pick = kleine hoeveelheden, geen bulk. Enige vraag: max op pick.
- VASTE REGEL nooit Pick (Daan 22-11): Pick alleen voor producten die nooit meer binnenkrijgen dan op pick past. Voorraad op bulk of bij VST (pallets), of inkoop groter dan op pick past = nooit Pick, ook niet via kleurgenoten. De verplaatsingen naar pick beslissen: Pallet alleen als de hele bulkplek in minstens 70% van de keren naar pick ging (Daan 22-11), anders Deel; zeggen ze nog niets, dan voorstel Pallet of Deel met twijfel, nooit Pick.
- Mix = pallet met meerdere producten, met een deel naar pick.
- VASTE REGEL Deel en Mix (Daan 22-11): Deel = hoe de pickplek wordt aangevuld (met een deel van de bulkvoorraad); Mix = het product staat (ook) op een mixpallet. Een product kan volle bulkpallets hebben, op een mixpallet staan én Deel zijn: nooit als tegenstrijdig melden of twijfel maken, en nooit Daans bestaande Deel- of Mix-keuze veranderen. Het veld "Op mixpallet" (ja/nee) staat sinds 23-11 naast de soort; een apart veld aanvulwijze komt later.
- Op mixpallet = eigenschap (ja/nee) naast de soort; mixpallets ontstaan voor ruimte (dozen samengevoegd), niet bij binnenkomst. Geen vaste mixgroep (basis 23-11).
- Soort volgens de blauwdruk (§8): Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg · Backorder.
- Weg = keuzemenu Uitlopend (geen data meer nodig) / Archief. Backorder = eigen soort: alleen voor backorders ingekocht (oude Weg · Backorder telt als Backorder); geen opslagdata, wel alle productdata (basis 23-11). Containers: alleen de backorders, rest VST.
- Twijfel = "weet ik nog niet": telt niet als afgerond, geen gewicht- of hoeveelheidsvragen, staat in Te doen → Twijfels ("Soort nog niet beslist"). Containers: bij lossen bepalen. Twijfel is ook een markering bij elke keuze (knop Twijfel in Doorloop, Te controleren en Productdata 2.0): de keuze is bewaard en komt niet terug tijdens het verzamelen; de markering staat in Te doen → Twijfels tot "Klopt zo (twijfel weg)" (basis 23-11).
- Hercontrole: "Weg met voorraad" alleen bij Archief (en Backorder met meer voorraad dan backorders); Uitlopend met voorraad is normaal. Andere soort bij kleurgenoten niet melden als één van beide Weg is. Elk punt met Claudes visie (1–2 zinnen) en een voorstel.
- Pallet, Deel en Bulk: stuks per pallet, palletmaat, hoogte incl. pallet. Gewicht volle pallet nooit vragen (zie §4). Stuks per doos, doosmaat en inkoopverpakking niet vragen (later).
- VASTE REGEL palletvragen: palletvragen (per pallet, palletmaat, hoogte, gewicht volle pallet, plaatsen, max per ligger) alleen voor producten waarvan de data bewijst dat ze per pallet komen of liggen: bulk- of VST-voorraad, palletlabels, pallet-verplaatsingen naar pick, of inkoop van minstens één volle pallet. Producten met voorraad 0 of minimaal, alleen voor backorders ingekocht, of per enkele stuks of rollen binnen: voorstel Pick (of Backorder) en nooit palletvragen.
- Per familie invullen, maar waarden per product uit de eigen data van dat product (inkoop, gewicht, verkoop), nooit één getal voor alles.
- Volgorde van bronnen voor een voorstel: 1) eigen data van het product (palletbewijs-regel gaat altijd voor), 2) kleurgenoten of dezelfde familie en maat, 3) dezelfde familie. Nooit "meerderheid bij de leverancier": één leverancier levert heel verschillende producten (lockers zijn geen whiteboards).

## 4. Gewicht
- Status: gewogen (echt gewogen) · vertrouwd (Daan vertrouwt de Picqer-waarde) · te wegen (nu zeker fout; komt op de Weeglijst, kg niet verplicht).
- Picqer-gewichten zijn bij bijna elke leverancier deels fout. Losse producten op de weegschaal.
- Picqer-gewicht = productgewicht, incl. eigen verpakking van het product (stoel in doos), nooit onze verzenddoos of -pallet (basis 23-11).
- Gewicht van de leverancier (sheet/Packing List Template) = vertrouwd en gaat voor; weegt Daan zelf en wijkt het > 10% af, dan melding en Daans weging geldt. Opnieuw wegen alleen als verpakking of leverancier wijzigt (basis 23-11).
- Gewicht per cm/meter nooit opslaan: volle rol ÷ lengte van die rol (basis 23-11).
- Gewicht controleren: voorstel alleen uit kleurgenoten; een andere maat alleen naar verhouding met een rekensom (per meter, per m², kg in de naam), anders geen voorstel maar "Naar Te wegen".
- Twee tegen elkaar (of een gelijke stand in een grotere groep): niet te zeggen welke klopt, geen voorstel, alle Naar Te wegen. Nooit elkaars waarde voorstellen.
- Gewicht volle pallet = gewicht per stuk × stuks per pallet + 15 kg pallet. Altijd berekend, nooit een vraag. Alleen met gewicht vertrouwd of gewogen; staat het op te wegen, dan wacht de berekening op het gewogen gewicht.

## 5. Hoeveelheden, pallets en locaties
- Max op pick = aanvullen bij + wat je aanvult (bij 10 + pallet van 67 = 77), zoals "vul aan tot" in Picqer.
- Deel en Pallet met picklocatie: "aanvullen bij" (Deel ook "max op pick") alleen vragen als het ontbreekt; Pallet: max op pick = aanvullen bij + stuks per pallet, berekend (Claudes keuze 09-11, Daan kan overrulen).
- Pallethoogtes naar boven afronden op 10 cm.
- Maatpallets: alle maten voor opslag én transport, behalve 40x120 en 40x200 (alleen transport). Lege pallet altijd 15 kg. Europallets komen via het ruilsysteem DHL/DPD, niet uit containers (basis 23-11).
- VASTE REGEL onmogelijke waarden (Daan 23-11): maten en gewichten buiten de grens (hoogte 10–300 cm, palletmaat per zijde 20–400 cm, gewicht per stuk tot 2.000 kg, volle pallet tot 3.000 kg, rol: breedte tot 600 cm, dikte tot 300 mm, lengte tot 1.000 m, diameter 5–300 cm, kg per rol tot 2.000) geven bij invullen een melding en worden alleen na bevestiging opgeslagen; weigeren = de oude waarde blijft (wh/grenzen.js, op elk invulscherm).
- Palletmaat kiezen: altijd de hele lijst vaste opslagmaten tonen (niet 3 maten + typen). Een nieuwe maat die Daan typt wordt meteen bewaard en staat daarna overal in de lijst.
- Elk scherm vóór oplevering zelf doorlopen met alle antwoorden (elke soort, Weg-keuzes, gewogen zonder kg, geen voorstel, uitvinken, Later, terug) tegen deze regels.
- Drie hallen: A, B en C. Er is geen hal D: hal C heeft twee stellingdelen, gedeelte C (gangen C..) en gedeelte D (gangen D..). Keuze altijd: hal → gedeelte (alleen bij C) → gang, met alleen gangen die echt bestaan.
- Hal A heeft alleen 3-liggers en een lager dak (20-locatie ± 140 cm). Hal B en C bijna allemaal 4-liggers, behalve begin/eind van een gang. BA en BB hebben 10, 20 en 30.
- Vloernaam = productcode + " - " + korte omschrijving (bijv. "4560WM - Whiteboard magnetisch 45x60"); bij lopers/matten de dikte erin.
- Rubber per stuk (ringmat, sportvloer, stalmat), A/B met picklocatie: aanvullen bij 10 met een hele pallet.
- Rollen: alleen als rol behandelen als Daan het product als rol kiest. Elke rol op een koker van 10 cm. Per rol: breedte, lengte volle rol, diameter, kg per rol, max rollen per pallet, staand/liggend, wat op pick past. Geen één aanvulregel voor alle rollen.

## 6. Leveranciers en families
- SAM Europe: alleen picklocatie, bulklocaties en aanvulniveau; niets anders vragen; nooit combineren of vergelijken met andere artikelen.
- Selected Furniture (Daan 22-11): elke stoel (bureau-, vergader-, eetkamer-, werkplaatsstoel; geen wieltjes, glijders, gasveren, kussens of dopjes) met voorraad en een inkoop in de laatste 6 maanden is soort Pallet: stoelen gaan per volle pallet naar pick. Nooit Deel voorstellen.
- Whiteboards: alleen FWB van Hebei komen in kratten van 50. Ningbo Henri komt los in de container; het team stapelt zelf pallets met een vast aantal per product (4560WM: 100 per pallet, 80x120x140); pick wordt per hele pallet aangevuld.
- Kokos: alleen 100 of 200 cm breed. 100 breed: een stuk tot 30 kg in een doos, daarboven op pallet (rol max 600 cm); losse stukken in één order elk een eigen doos. 200 breed: tot 2 m en onder 30 kg in een doos, anders pallet.
- Kokos rollengte per leverancier (Wallace 6 m, Hamat 12 m). Max op pick: 3 rollen van 6 m (1800 cm) of 2 rollen van 12 m (2400 cm); aanvullen bij 600 cm (basis 23-11).
- Foamrand: alleen FWB-whiteboards (Hebei) vanaf 90x150 (basis 23-11).
- Families: voorlopig alleen 5 hoofdcategorieën (Rubber, Kantoor, Huis en tuin, Auto, Sport/fitness); bestaande families/groepen blijven werkgroepen tot Daan ze samen uitwerkt (basis 23-11).
- Rubber ribbelmat op rol: losse lengtes 1–10 m bestaan pas enkele maanden; per 25 of meer een eigen pallet, rest op een mix/pick-pallet.
- Great Wall (Daan 23-11): pakbonregel "NBR 3 mm × 1,4 m × 10 m" = RPNBR0300PM (per meter), 1 rol = 10 meter.
- Wandrekken (Ningbo Henri): omdozen met vast aantal per type, meestal 6 omdozen per pallet (80x120x180, liefst op 10-locaties, vaak effectief 90x120); aanvullen bij 2 met hele omdozen tot wat op pick past.

## 7. Containers (containerplanning.html)
- Containers komen binnen in dozen; het team bouwt zelf pallets. "Los" alleen bij een pakbonregel met Per = 1; anders dozen ("5 dozen à 100").
- Nooit losse stuks uit een doos naar pick; pick krijgt hele dozen of niets.
- VASTE REGEL VST (Daan 19-11): naar VST gaan ALLEEN volle pallets (regels "pallets à N"). Losse rollen, dozen en stuks gaan NOOIT naar VST: eerst naar pick tot max op pick, rest naar bulk (IVOL); zonder max op pick alles los naar bulk + "bij lossen bepalen". Geldt voor het advies, ook bij oude regels (restdest/losdest VST) en het productgeheugen. Kiest iemand handmatig VST bij een los-regel: gele melding "VST neemt alleen pallets", geen blokkade.
- Voorraad op "geen specifieke locatie" telt niet als pick-voorraad.
- Opslagpallet per product + leverancier (zie §11). Europese leveringen: alles naar het hoofdmagazijn, niets naar VST (basis 23-11).
- Een krat (bijv. E4005-10KG, krat van 100) telt als 1 pallet.
- Pakbon = hoe het binnenkomt (info). Verdeling = hoe wij wegzetten: opslagpallet uit het productgeheugen, per regel aan te passen; akkoord telt alleen het totaal.
- Geen gecontroleerde data = geen automatisch advies: "bij lossen bepalen" en op de invullijst lossen; Daan voert het daarna één keer in, dan is het product voor elke volgende container bekend.
- Pakbonregel zonder Picqer-product (verpakking zoals WASHER PUMP BOX) = "geen voorraad", gaat naar Karin en Kate, geen fout.
- Onbekend of nieuw = info, nooit een fout. Geen meldingen die Daan niets laten doen.
- Verkoop in Containers = bestellingen uit Picqer (ook backorders), niet alleen verzonden.
- De pakbon bepaalt WELKE producten en HOEVEEL er in een container zitten. De Picqer-inkooporder (PO-nummer in de pakbon, of gekozen uit de open inkooporders van de leverancier) levert alleen de exacte Picqer-code (code, genormaliseerd of kleur, bijv. SE121V-black = SE121V-BLA) en een controle; nooit een inkoopregel toevoegen die niet op de pakbon staat. Alleen zonder leesbare pakbon: alle open inkoopregels, oranje, met melding "geen pakbon … nakijken". Een PO verdeeld over meerdere containers is normaal: controle = som over alle containers met die PO ≤ nog te ontvangen in Picqer; alleen bij overschrijding of een pakbonregel die niet in de inkooporder staat één gele regel "pakbon zegt X, inkoop zegt Y" met "Pakbon klopt" / "Inkoop klopt", nooit stil overnemen. Foto of PDF blijft bijlage.
- Een tekst-PDF wordt met posities gelezen (kolommen Item NO, Color, QTY PCS, PCS/CTN, CTNS, GW, REMARKS), geen OCR; "Total" = pakbontotaal voor de sluitende controle; REMARKS "50pcs from PO… / 50pcs from PO…" = verdeling over PO's, bij de regel bewaard; "free sample" = monster, telt mee.
- Het containernummer is de identiteit: een ander containernummer is altijd een andere container. Nooit bijwerken, hernoemen, samenvoegen of "Mogelijk dubbel" bij verschillend containernummer, ook niet bij dezelfde CI, PO, leverancier of producten; bij inlezen nooit het containernummer of de naam van een bestaande container overschrijven.
- VASTE REGEL afronden, lossen en opboeken (controle W47): afronden alleen als niets meer op "geen specifieke locatie" staat (anders melding met de producten en "Toch afronden", Daan beslist); "Lossen starten" alleen met akkoord verdeling (bij-lossen-bepalen blokkeert niet); losdag-PDF uiterlijk de dag ervoor, losdatum morgen zonder PDF = rode regel in Wat nu; Jim boekt op ná lossen en tellen: Stockmove-regel pas bij status Gelost; gegevens (verkoop, voorraad) vers = nachtelijke verversing, oranje na 36 uur, backorders live.
- VASTE REGEL palletlabel (Daan, W47): de naam past altijd binnen de marge (eerst kleiner tot 24 pt, dan 2 regels, nooit afsnijden; productcode altijd volledig); barcode EAN13/EAN8 alleen met kloppend controlegetal, anders CODE128 met de EAN of de productcode en één gele regel "barcode van <code> via terugval gemaakt"; nooit een label met foutmelding (wh/labelkern.js, test containerlabels.js).
- Foto-OCR is terugval: kop-, adres-, fax-, tel-, bankregels, specificaties (Density, Hardness, …) en regels met totaal 0 worden nooit een productregel (specificatie hoort bij de regel erboven); elke foto-regel blijft oranje "nakijken".
- Excel lezen op kopteksten (Item NO / Commodity / Model = code, Description = omschrijving, QTY, CTNS, PLT, Gr. Wt.; PO NO = po en nooit de code); packing list gaat voor, een invoice-tabblad met dezelfde regels telt niet mee. Leverancier uit de kopregels tegen de leverancierslijst; niet gevonden = melden en leeg laten, nooit de eerste uit de lijst.
- Inlezen bij een bestaande container (zelfde containernummer, pakbon-ref of PO + leverancier) = "Bijwerken" (standaard) of "Toch nieuwe container"; bijwerken vervangt alleen niet-bevestigde en niet-verdeelde regels. Verwijderen = prullenbak (30 dagen, Terugzetten onderaan Containers); samenvoegen = regels van B in A, dubbele regels (zelfde productcode + aantal) één keer, B naar de prullenbak. "Mogelijk dubbel" is alleen een label: de app verwijdert nooit zelf. Vóór elke wijziging aan een container een kopie van de rij: wh-kopie-containers-<id>-<jjjjmmdd>.

## 8. Backorders
- Alleen backorders die door aanvullen/verplaatsen of door inkomende goederen komen, zijn magazijnwerk. Echte backorders (wachten op inkoop) niet als probleem tonen.

## 9. Werkwijze bij elke opdracht
- Eerst git pull --rebase origin main. Eén run, geen vragen; wat onduidelijk is: kies de regel hierboven en meld het.
- Alleen de genoemde bestanden; oude pagina's blijven werken (regressietest).
- Tests lezen de echte database, maar elke schrijfpoging wordt onderschept (0 geblokkeerd).
- Push altijd naar main, nooit alleen naar een zijtak.
- VASTE REGEL tests (Daan 23-11): tests verwachten nooit een vaste container of vaste aantallen uit de echte data. Ze kiezen zelf een container of product met open punten, rekenen de verwachting uit die data en openen ingeklapte kaarten eerst (opzet.js: kiesContainer, openKaart). Eigen testinvoer (zelfgemaakte pakbon, nagebootste bestellingen) mag vaste getallen hebben.
- Elke opdracht: daantoets.js groen vóór push. Nieuwe regel van Daan = ook een nieuwe controle in daantoets.js. Eerst de regelmatrix (test/pd2/DAANTOETS.md) lezen.
- Rapport kort, in het Nederlands, zonder vaktaal.
- Goedkeuren: officieel alleen Daan, Ryan en Karin (basis 23-11).

## 10. Woorden (vaste namen, nooit andere gebruiken)
- Productgeheugen = Supabase catalog-rij catalog-ean (palletlabels, vloernaam, stuks per pallet, palletregels). Productdata = Supabase-tabel productdata (Daans waarheid per product).
- Soort = Pick · Bulk · Deel · Pallet · Mix · Twijfel · Weg (Uitlopend / Archief) · Backorder. Palletbewijs = bulk- of VST-voorraad, palletlabel, pallet-verplaatsing naar pick of inkoop van een volle pallet.
- Gewicht-status = gewogen · vertrouwd · te wegen. Max op pick = aanvullen bij + aanvullen met.
- Bulk = 10/20/30-plek boven pick (tijdelijk). Pick = vaste picklocatie (nooit tijdelijk). VST = externe opslag Van Spreuwel. Geen specifieke locatie = voorraad zonder plek.
- Familie → maat → kleurgenoten (zelfde familie en maat). Maat ook uit de naam: afmetingen, lengte (3 m, 4,5 m), gewicht (4 kg), aantal (3 treden), dikte; andere maat = geen kleurgenoot. A/B/C = verkoopklasse.
- Containers: Pakbon → Verdeling → Uitvoer (losdag-PDF, labels). "Bij lossen bepalen" = nog geen gecontroleerde data, staat op de invullijst lossen. "Na het lossen" = één keer invullen door Daan.
- Productdata 2.0 = per maat 3 stappen: 1 Soort · 2 Gewicht · 3 Hoeveelheid. Te controleren = alleen vragen die regels en data niet beantwoorden, soort eerst, per familie.
- Sporen: 1 Containers · 2 Productdata 2.0 / Te controleren · 3 Warehouse 3.0 (fundering + pilaren 1 Aanvullen · 2 Voorraad op plek · 3 Inkomend · 4 VST · 5 Orders).

## 11. Leveringsgegevens en opslagpallets (basis 23-11)
- Leveringsgegevens (leveringsvorm, stuks per omdoos, rollengte, rolgewicht, pallet zoals geleverd) én stuks per opslagpallet zijn per product + leverancier; de app kiest via de inkooporder (rh100x150: Rubberselect 60 per pallet, Wallace 50). Elke pallet houdt het aantal van zijn levering. Herkomst (container/Europees) hoort bij de inkooporder.
- Stapelbaar (ja/nee) per product: alleen producten die in grote aantallen komen (bijv. stalmat 80x120, sportvloer tegel 15 mm).
