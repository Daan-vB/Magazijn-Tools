# Productdata 2.0 — ontwerp (oefensimulatie, ronde 1, 27-10-2026)

Dit document is de enige bron voor Productdata 2.0. Elke volgende ronde werkt dit document bij.
Geen bedrijfsdata in dit document: productnamen staan er alleen als voorbeeld uit het gesprek met Daan.

Doel: in Warehouse 3.0 (`ivol.html`) een nieuw onderdeel "Productdata 2.0" onder 3 · Producten, badge "oefen".
Daan oefent per tab of layout, velden en werkwijze kloppen. Alles werkt met echte producten en echte data, maar niets
wordt echt vastgelegd. Na zijn feedback volgen kleine correctierondes tot hij zegt "dit is het"; pas dan vervangt 2.0 de
oude pagina's.

## Harde regels
1. Alle bestaande pagina's en apps blijven exact zoals ze zijn (A/B-check, Niveaus, Invullen, Productdata, Per familie,
   Gelijkzetten, Soorten, Productkaart, Producten per leverancier, Vloernamen, Warehouse, Junior, Containers,
   Palletlabels). Alleen het menu van 3.0 krijgt één regel erbij. Bewezen met een regressietest.
2. Picqer: alleen lezen, nooit schrijven. De bestaande live-laag en caches (`wh/ivol-live.js`, `wh-inkoop`,
   `wh-verplaatsingen`, verkoop, voorraad per locatie). Geen nieuwe grote ophaalrondes. Warehouse, Vandaag en Aanvullen
   houden voorrang op de rate limit; bij 429/504 stoppen en later verder.
3. Schrijven alleen in twee nieuwe catalog-rijen: `wh-pd2-oefen` (alles wat Daan in 2.0 doet) en `wh-pd2-feedback`
   (opmerkingen en oefenantwoorden). Nooit naar `productdata`, `wh-pd-fam`, `catalog-ean`/palletlabels, containers of
   andere rijen. Lezen mag.
4. Productcode is heilig. Geen sleutels tonen of opslaan. Geen bedrijfsdata, exports of productlijsten in de repo of in logs.
5. Vanilla JS op `window.*`, geen nieuwe libraries, bestaande stijl van 3.0. Eigen bestanden (`wh/pd2.js`, `wh/pd2.css`).
   Functies uit `wh/productdata.js` (index, voorstel, aanvulregels, regelcontrole, plaatsen, max per ligger) worden
   hergebruikt zonder hun gedrag voor de oude pagina's te veranderen. Moet iets anders werken: eigen versie in pd2.
6. Een voorstel is nooit een vastgelegde waarde. Alleen een klik of invoer van Daan slaat iets op (in `wh-pd2-oefen`).
7. Elke keuze die niet in dit ontwerp staat, staat in de pagina als chip "aanname" met uitleg bij tikken, zodat Daan hem
   in de oefening ziet en kan afkeuren.

## A. Plek en opslag
- Menu 3 · Producten → "Productdata 2.0" (badge oefen), route `#/pd2`.
- Bovenaan altijd een smalle balk: "Oefenmodus: niets gaat naar de echte productdata", met knoppen "Oefendata wissen"
  (met bevestiging) en "Kopieer alles voor Claude" (zie H).
- `wh-pd2-oefen` bewaart per product: soort, velden, status per veld (voorstel / bevestigd / aangepast), gewichtstatus,
  rol ja/nee, weg-keuze, tijd. Zo kan alles wat Daan bevestigt later in één keer naar productdata als hij dat zegt. Dat
  overzetten wordt nu nog niet gebouwd.
- Werkt op iPhone (390 px) en desktop (1440 px). Telefoon: tabel met vaste eerste kolom (product) en horizontaal scrollen,
  geen losse kaartjes.

## B. Opbouw van de pagina (op elke tab hetzelfde, van boven naar onder)
1. Filters: zoeken (code, naam, locatie), leverancier, afdeling, hal, ABC, scope: Belangrijk · A+B · Alles dat beweegt ·
   Komt binnen (producten uit open pakbonnen/containers, met ETA) · Alles met voorraad.
2. Basisinfo (één kort blok): familienaam met productlijn (bijv. "Schoonloopmat Mars"), leverancier, afdeling en gangen,
   aantal producten en maten, ABC-verdeling, verkoop familie als "13*6 / 8*28" (gemiddeld per maand, gemeten over
   6 maanden / over 28 dagen; uitleg bij tikken), inkomend (container/pakbon + ETA), aantal zonder picklocatie, aantal met
   voorraad op geen specifieke locatie. Zonder familiekeuze: hetzelfde voor de hele filterselectie.
3. Voortgangsbalk, drie regels: Status (x van y afgerond, per tab hoeveel) · Doel (wat nog open is om af te ronden) ·
   Aandacht (gewicht te wegen/onbekend, zonder picklocatie, tegenstrijdigheden zoals "1500 per pallet maar nooit meer dan
   300 besteld", twijfel-soorten). Tik op een aandachtspunt = lijst filtert op die producten.
4. Filtertegels: zonder familiekeuze = families (belangrijkste eerst, met voortgang); met familie = maatgroepen (bij rollen
   breedte + dikte). Tegel toont bijv. "40x60 · 5 · 1 Deel 4 Pick · 3 open". Tik = lijst eronder ververst zonder
   paginawissel. Knoppen "Volgende maat" en "Volgende familie".
   Maatgroep = alleen de maat uit de naam, in alle schrijfwijzen ("120x180", "120 x 180", "120×180"), nooit kleur of andere
   tekst. Schoonloopmat Mars = 8 maatgroepen. Daans correcties en namen in `wh-pd-fam` hebben voorrang.
5. Tabbalk: 1 Pallet · 2 Deel · 3 Pick · 4 Mix · 5 Weg · Rollen · Afgerond · Weeglijst, elk met teller voor de huidige
   selectie. Een product staat in de tab van zijn soort (voorgesteld of bevestigd). Rollen is een extra tab: een rol staat
   ook in zijn soort-tab.
6. De lijst.

## C. Productrij (in elke tab dezelfde eerste kolommen, zelfde volgorde)
vinkje · code + volledige Picqer-naam (afgekapt, volledig bij tikken; code linkt naar Productkaart) · ABC · voorraad (pick:
locatie + aantal, vast/tijdelijk; bulk: locaties + aantallen; VST; geen locatie) · inkoop: alleen de meest gebruikte
hoeveelheid ("meestal 300") · verkoop "13*6 / 8*28" · gewicht per stuk in kg met status-chip · ⓘ (redenen van de
voorstellen in deze rij) · 💬 (opmerking).
Niet tonen: aantal orders, laatste besteldatum en andere details.
Daarna de kolommen van de tab (D). Kleuren overal gelijk: geel = voorstel, groen = bevestigd door Daan of al vastgelegd in
productdata (bron daan), oranje = twijfel/tegenstrijdig, grijs = berekend (niet invulbaar), rood = ontbreekt.
Invoer zoals Excel: tik en typ, Tab/Enter naar volgende cel, plakken over meerdere cellen, "nvt" en "onb" werken. Elke
invoer bewaart direct, ook bij wegtikken of tabwissel.

## D. De tabs (Daans definities)
**1 Pallet** — komt per volle pallet binnen en wordt per volle pallet aangevuld.
- Invullen: Picklocatie (controle) · Aanvullen bij · Stuks per pallet · Palletmaat (keuzelijst) · Hoogte incl. pallet
  (naar boven afgerond op 10 cm; waarschuwing als hij niet past: hal A 20-locaties ± 140 cm, meestal 180–200 tussen 00 en
  10, 180–190 tussen 10 en 20) · Vloernaam.
- Berekend (grijs): Max op pick = bij + stuks per pallet · Gewicht volle pallet = stuks × kg + 15 · Plaatsen op ligger
  (uit palletmaat) · Max per ligger (2.000 kg per ligger).

**2 Deel** — komt op een pallet of in grotere hoeveelheid binnen dan op pick past; een deel naar pick, de rest naar bulk;
aanvullen met een deel van de bulkvoorraad. Ook: alleen bulk en per order verplaatsen (pickkeuze "geen pick").
- Invullen: Picklocatie · Aanvullen bij · Max op pick (wat op de picklocatie past) · Inkoopverpakking · Stuks per pallet ·
  Palletmaat · Hoogte · Vloernaam.
- Berekend: Aanvullen met = max − bij (waarschuwing als geen veelvoud van de inkoopverpakking, bijv. doos van 15) ·
  Gewicht volle pallet · Plaatsen · Max per ligger.

**3 Pick** — komt in kleine aantallen binnen, past helemaal op pick, geen bulk.
- Invullen: alleen Picklocatie (controle) en Max op pick (voorstel = meest gebruikte inkoop per order). Niets anders.

**4 Mix** — op een mixpallet met andere producten; naar pick met een portie.
- Invullen: Picklocatie · Aanvullen bij · Max op pick · Inkoopverpakking · Mixgroep (keuzelijst + nieuw; voorstel: zelfde
  leverancier, vergelijkbaar product).
- Berekend: Aanvullen met = max − bij. Boven de lijst per mixgroep één regel: naam, leden, bulklocaties (lezen).

**5 Weg** — keuze per product: Uitlopend (uit de vaste data, naar map Uitlopend) · Backorder (alleen besteld voor
backorders, naar map Backorder; nu geen velden, de app leert later welke gegevens nodig zijn) · Archief (helemaal uit beeld).
- Per rij: voorraad, laatste inkoop, open backorders, verkoop. Voorstel: Archief = geen voorraad, geen verkoop en geen
  inkoop in 12 maanden, geen backorders; Backorder = inkoop alleen rond backorders, geen vaste voorraad; Uitlopend = nog
  voorraad, geen inkoop meer.
- Bovenaan drie mapknoppen (Uitlopend n · Backorder n · Archief n) om te bekijken en terug te zetten. Producten in deze
  mappen tellen nergens meer als open.

**Rollen** — alleen producten die Daan als rol markeert. Een rol houdt zijn soort. Producten per meter/cm of met "rol" in
de naam krijgen in hun soort-tab een chip "rol?" met knop "is rol / geen rol".
- Invullen: Breedte (cm) · Dikte (mm) · Lengte volle rol (m) · Diameter (cm) · Gewicht volle rol (kg) · Staand of liggend ·
  Max rollen per pallet · Vaste palletaantallen ja/nee.
- Berekend: kg per meter en per cm. Max op pick en aanvullen staan in de soort-tab.

**Afgerond** — alleen lezen, met "heropenen".

**Weeglijst** — alle producten met gewicht "te wegen", gegroepeerd per hal, gang en locatie, met invulveld "gewogen kg"
(bruikbaar op de telefoon op de vloer). Invullen zet de status op gewogen.

**Picklocatie (elke tab)**: live uit Picqer, alleen controle. Toon locatie, aantal, vast/tijdelijk. Keuze: klopt · moet
anders (met opmerking) · bij geen picklocatie "moet pick krijgen" / "geen pick". Nooit naar Picqer schrijven.

**Palletmaat-keuzelijst**: alleen 80x120, 90x120, 100x100, 100x150, 110x110, 120x150, 120x180, 100x200, 120x200, 120x240,
en voor grote whiteboards ook 120x210, 130x210, 130x250. Nooit 40x120 of 40x200.

**Inkoopverpakking**: aantal + soort (doos, omdoos, bundel, pak, rol, los, wisselend, nvt) = hoe het binnenkomt.
Voorbeeld: 15 per doos; een wandrek per stuk in een doos, 8 in een omdoos → "8 per omdoos". Niet de verzenddoos
(verzending is een later stadium, geen veld).

**SAM Europe**: alleen picklocatie, bulklocaties (lezen), aanvullen bij en max op pick; andere velden verborgen met chip
"SAM: minimaal". SAM nooit als voorstelbron voor andere producten.

## E. Groepsacties
- Vinkje per rij; bovenaan "selecteer alles in deze groep".
- Bij ≥ 1 vinkje een vaste actiebalk onderaan: Selectie klopt · Zijn allemaal: Pallet / Deel / Pick / Mix / Weg ·
  Gewichten kloppen · Gewichten aanpassen… · Is rol · Zelfde waarde voor kolom… (pop-up: kies kolom, typ één keer, geldt
  voor alle geselecteerde).
- Boven elke tab: "Alle voorstellen kloppen" voor de zichtbare groep.
- "Selectie klopt" bevestigt alle voorstellen in die rijen, ook de soort. Een product dat dan compleet is gaat naar
  Afgerond en verdwijnt uit de lijst; niet-complete blijven staan met de bevestigde velden groen.
- Elke groepsactie is één keer ongedaan te maken (melding met "ongedaan", 10 s).

## F. Gewicht
- Gewicht per stuk uit Picqer (Picqer slaat gram op, omgerekend naar kg). Status-chip met 4 standen: niet gecontroleerd
  (start) · gewogen (fysiek gewogen) · vertrouwd (Picqer-waarde klopt volgens Daan; telt als goedgekeurd) · te wegen (nu
  zeker fout; naar de Weeglijst).
- "Gewichten kloppen" → vertrouwd. "Gewichten aanpassen…" → pop-up: één keer het gewicht typen, kies gewogen of vertrouwd,
  geldt voor alle geselecteerde. Per rij: tik op de chip.
- Automatisch markeren: gewicht 0 of leeg, of sterk anders dan vergelijkbare producten in de familie (per stuk of per m²)
  → aandachtspunt.
- Gewicht bevestigen maakt een product nooit afgerond zolang andere velden open zijn. "Te wegen" telt als besproken: het
  product kan afgerond worden met een ⚖-teken en blijft op de Weeglijst.

## G. Voorstellen (per product uit zijn eigen data, nooit één getal voor alles; reden onder ⓘ)
- Soort: Pick als inkoop per order meestal op pick past en er geen bulk is; Deel als er bulkvoorraad is of meer wordt
  ingekocht dan op pick past en er in delen van bulk naar pick wordt verplaatst; Pallet als inkoop meestal ≥ 85% van een
  volle pallet is en er per volle pallet wordt verplaatst; Mix als het in kleine aantallen per doos komt en met andere
  producten op één bulkplek of mixpallet staat; Weg zoals bij tab 5. Tegenstrijdig: oranje "twijfel" met beide opties.
  Toets: Schoonloopmat Mars 120x180 Antraciet (picklocatie en bulk, inkoop per order meer dan op pick ligt) = Deel, niet Pick.
- Stuks per pallet, bronnen op betrouwbaarheid: verplaatst naar VST, kleurgenoot met dezelfde maat, ≥ 2 bulk- of
  VST-pallets met hetzelfde aantal, meest voorkomende inkoophoeveelheid, palletlabel. Tegenstrijdigheden markeren.
- Palletmaat en hoogte: bevestigde regels en kleurgenoten (bestaande regelcontrole), anders uit afmetingen per stuk; nooit
  uit een andere maat of familie zonder match.
- Aanvullen bij: bestaande aanvulregels (rubber per stuk A/B bij 10 met volle pallet; whiteboards bij 3; bureaustoelen bij
  0 met volle pallet; wandrekken bij 2 met hele omdozen; rollen volgens de rolregels), anders de huidige Picqer-instelling
  (> 1) als "huidige stand".
- Max op pick (Pick): meest gebruikte inkoop per order.
- Vloernaam: korte code → code + korte omschrijving ("A4001 yoga bal zwart"); anders korte omschrijving; lopers en matten
  met dikte ("Torrance loper 2mm 100 cm zwart").
- Waarden die Daan al in productdata vastlegde (bron daan): groen "vastgelegd", geen voorstel.
- Koppelproducten (bijv. …-BOL sets): "gekoppeld aan <hoofdproduct>, niet invullen", tellen niet als open.

## H. Oefensimulatie en feedback (het belangrijkste van deze ronde)
- Elke tab (ook Rollen, Afgerond, Weeglijst) heeft bovenaan een inklapbaar blok "Oefening" met 3–5 korte opdrachten op
  echte producten die in die tab passen. Een opdracht vinkt zichzelf af als Daan hem gedaan heeft. Waar mogelijk:
  Schoonloopmat Mars, Vica trapmat Spurt (Antraciet/Beige deel, Grijs twijfel, Rood/Blauw mix, Rood 26x65 pick, -BOL
  gekoppeld), Kokos (rollen 100/200 cm, 17/24 mm), FWB-whiteboards (per pallet), ringmat op rol, wandrekken Ningbo Henri,
  een SAM Europe-product, Waterhog (geen voorraad → Weg). Voorbeelden:
  - Pallet: kies een maat en druk "Selectie klopt"; pas stuks per pallet aan en zie het palletgewicht meerekenen; zet één
    product naar Deel.
  - Deel: vul bij en max in en zie "aanvullen met"; zie de waarschuwing bij geen veelvoud van de doos.
  - Pick: controleer een picklocatie; kies bij een product zonder picklocatie "moet pick krijgen".
  - Mix: geef 3 producten dezelfde mixgroep.
  - Weg: zet er één op Backorder, één op Archief, zet er één terug.
  - Rollen: markeer een product als rol, vul de rolgegevens, zie kg per meter.
  - Gewicht: pas met de pop-up het gewicht van een selectie aan, zet er één op te wegen, open de Weeglijst.
- Na de opdrachten per tab vier vragen: Layout (klopt / bijna / nee) · Wat mis je? · Wat is overbodig? · Gevoel 1–5.
  Opslaan in `wh-pd2-feedback`.
- 💬 per rij en per tab: opmerking typen of dicteren; tab, product en kolom gaan automatisch mee.
- Per veld tellen hoe vaak een voorstel is bevestigd of aangepast (bijv. "stuks per pallet: 12× klopt, 3× aangepast,
  300 → 600").
- "Kopieer alles voor Claude": alle feedback, oefenantwoorden, opmerkingen en de voorstel-telling als nette tekst op het
  klembord, per tab, met productcode en kolom. Geen klantgegevens.

## I. Tellen en afgerond
Afgerond = soort bevestigd en de velden van die soort ingevuld of bevestigd:
- Pallet: picklocatie gecontroleerd, bij, stuks per pallet, palletmaat, hoogte, vloernaam, gewicht (gewogen, vertrouwd of
  te wegen).
- Deel: hetzelfde + max op pick en inkoopverpakking.
- Pick: picklocatie gecontroleerd, max op pick, gewicht.
- Mix: picklocatie, bij, max op pick, inkoopverpakking, mixgroep, gewicht.
- Weg: alleen de keuze.
- Rol: daarbovenop de rolgegevens.
- SAM Europe: picklocatie, bij, max op pick.
Berekende velden tellen nooit als open. "nvt" = ingevuld, "onb" = open.

## Techniek (ronde 1)
- Bestanden: `wh/pd2.js` (scherm, rekenen, opslag), `wh/pd2.css` (stijl, geladen door pd2.js). In `wh/lijst.json` staat
  `wh/pd2.js` achteraan bij `ivol`; `wh/ivol.js` kreeg één menuregel (en de status "oefen" voor de badge en de aanroep van
  het scherm). `wh/productdata.js` en `wh/pdfamilie.js` worden pas geladen als 2.0 opent (zoals Te doen dat al deed) en
  alleen gebruikt om te lezen en te rekenen; 2.0 roept nooit hun opslaan aan.
- Opslag `wh-pd2-oefen`: `{ v:1, p:{ <code>:{ t, so:{v,st,voor,t}, weg:{v,st,voor,t}, f:{ <veld>:{v,st,voor,t,opm} },
  gew:{st,kg,t}, rol:{v,t}, heropend } }, mg:[mixgroepen], oef:{ <tab>:{ <opdracht>:tijd } }, gewist }`. Velden: pickc
  (picklocatie-controle: klopt / anders + opm / moetpick / geenpick), lvl, maxpick, spp, maat, hoogte, vn, verp, mixgroep,
  rol: rb, rd, rl, rdia, rkg, rstand, rmax, rvast. Afgerond wordt niet opgeslagen maar berekend (I).
  Status per veld: `bevestigd` (gelijk aan het voorstel) of `aangepast` (anders); zonder opslag = voorstel.
  Schrijven: na 0,6 s rust, eerst de nieuwste versie ophalen en alleen de gewijzigde producten samenvoegen (iPhone en Mac
  overschrijven elkaar niet).
- Opslag `wh-pd2-feedback`: `{ v:1, tabs:{ <tab>:{ layout, mis, over, gevoel, t } }, opm:[{ id, tab, code, kolom, tekst, t }] }`.
- Een schrijfpoging naar een andere rij wordt in pd2 zelf geweigerd (grendel in de opslagfunctie).
- Voorraad per locatie (ronde 1b, 27-10): live uit Picqer, alleen lezen. 2.0 vraagt de rijen op het scherm (en de geopende
  familie) op via de functie `picqer` (actie `producten`, 20 per vraag, 3 s ertussen); de pickstand van het live advies telt
  ook als live, de nieuwste wint. Live geldt 30 minuten en wordt na 10 minuten ververst (kopie op het apparaat, niet in de
  database). Voorrang: is de live-ronde van 3.0 (Vandaag, Aanvullen, Warehouse) bezig of zei Picqer net "te veel", dan wacht
  2.0. Bij 429/504 of een andere fout stopt de rij en probeert hij het na 2, 4, 8 … max 30 minuten opnieuw. Valt live weg
  (of is het apparaat niet gekoppeld), dan toont 2.0 de export met de datum erbij ("voorraad van 15-10"), per rij en in de
  balk bovenaan.

## Ronde 2 (27-10-2026): betere voorstellen, snelheid, voorbereiding
**1. Voorstellen meten en verbeteren.** Toetsset = elke waarde die Daan zelf in productdata vastlegde (meta-bron daan, invul,
samen, overgezet, familie, kleuren, klein, spraak; geen schattingen). Per waarde doet 2.0 alsof hij er niet is (zowel in pd2
als in productdata.js), rekent het voorstel uit en vergelijkt: exact gelijk, hoogte binnen 10 cm, gewicht binnen 10%.
Meting (alleen percentages):

| Veld | Getoetst | Klopt ronde 1 | Klopt nu | Voorstel bij | Klopt als er een voorstel is |
|---|---|---|---|---|---|
| Soort | 465 | 40% | 72% | 100% | 72% |
| Stuks per pallet | 745 | 50% | 61% | 89% | 69% |
| Palletmaat | 173 | 53% | 68% | 76% | 89% |
| Hoogte incl. pallet | 143 | 50% | 65% | 81% | 80% |
| Aanvullen bij | 121 | 30% | 61% | 71% | 86% |
| Max op pick | 97 | 38% | 63% | 85% | 74% |
| Vloernaam | 796 | 22% | 60% | 100% | 60% |
| Gewicht per stuk | 75 | 44% | 75% | 100% | 75% |
| Gewicht volle pallet | 127 | 58% | 65% | 98% | 67% |

Verbeteringen: leren van Daans eigen invoer, per veld in deze volgorde: kleurgenoten (zelfde familie en maat) → familie →
leverancier + maat (Spurt-achtige patronen bij andere lijnen van dezelfde leverancier) → leverancier. Een patroon telt bij
minstens 2 producten (kleurgenoot: 1) en ≥ 60% van de groep; het product zelf telt nooit mee. Soort: geleerde soort gaat
voor de dataregels (behalve "volle pallet ingekocht én per volle pallet verplaatst"); een product zonder voorraad waarvan
de familie al een soort heeft, is tijdelijk op en geen Weg. Vloernaam: 2.0 leert de vorm die Daan gebruikt (alleen de code,
code + naam, naam, eerste deel van de naam, naam - code …) en past die toe; zonder voorbeeld alleen de code (Daans meest
gebruikte vorm). Max op pick: kleurgenoot en leverancier + maat vóór de Picqer-stand. Gewicht per stuk: wat Daan bij
kleurgenoten of dezelfde leverancier en maat woog. Gemeten en niet gebruikt: max op pick naar boven op hele dozen (klopte 0%
van 6), vloernaam op leveranciersniveau gaf alleen winst als laatste stap.
Elke regel heeft een id; zijn score staat onder ⓘ ("dit soort voorstel klopte 84% bij jouw eigen invoer"). Score < 60% bij
minstens 5 getoetst = twijfel (oranje), niet geel. De meting staat ingebouwd (`SCORE0` in `wh/pd2-reken.js`) en kan op het
apparaat opnieuw (knop "Meet opnieuw" in het uitklapblok "Hoe goed zijn de voorstellen" onderaan; resultaat in
localStorage `pd2-meting`). Let op: gewicht per stuk legt Daan vooral vast als Picqer níet klopt, dus de Picqer-score is daar
vanzelf laag.

**2. Rollen voorinvullen.** Rol = Picqer-eenheid meter, cm of rol, of de naam zegt op rol / rol van / per rol / volle rol /
rollen / per meter / per cm, of "rol" met een breedte of dikte (niet rolstoel, roller, rolluik). Zo'n product is een
rol-voorstel (staat in Rollen en in zijn soort-tab, telt als open tot "is rol / geen rol"; "Selectie klopt" bevestigt het).
Voorstellen: breedte en dikte uit naam (kokos ook dikte uit de code -17/-24), lengte uit naam of pakbon, kokos 6 m (600 cm),
gewicht volle rol = gewicht per meter/cm × lengte, kokos 200 cm 17 mm 12 per pallet en 24 mm 6 (vaste aantallen), ringmat op
rol heavy duty staand, 6 per pallet, palletmaat 100x150. Elk met reden.

**3. Aandacht.** Per product vooraf (en bewaard per familie-versie): gewicht te wegen; gewicht 0, leeg of > 30% afwijkend van
de familie; loper (A/B) zonder picklocatie; zonder picklocatie; voorraad op geen specifieke locatie; stuks per pallet groter
dan de grootste inkooporder; hoogte past niet in de hal; palletgewicht boven ligger-limiet; aanvullen met geen veelvoud van
de doos; twijfel-soort. Familietegels tonen het aantal aandachtspunten en sorteren op belang (A/B, inkomend, aandacht).

**4. Weg voorsorteren.** Weg-voorstel (Archief / Backorder / Uitlopend) voor alle actieve producten, ook buiten de scope,
met dezelfde regels. Tab 5: knoppen "Toon alle voorstellen Archief" (en Backorder, Uitlopend) om ze in één keer na te kijken
en met "Selectie klopt" te bevestigen.

**5. Snelheid.** Momentopname in IndexedDB (`ivol-pd2`, alleen op het apparaat, max 7 dagen oud): 2.0 tekent meteen
("gegevens van hh:mm, bijwerken…") en ververst op de achtergrond ("bijgewerkt hh:mm"); typt Daan net, dan wacht het
hertekenen. De oefendata staat apart in die opslag en wordt na elke keer bewaren bijgewerkt. Gemeten (localhost, echte
database): eerste keer op een apparaat ± 14 s (alles uit de database, niet sneller zonder serverwerk), daarna 1,5 s (was
3,1–3,5 s). Familie openen 0,05–0,7 s.

**6. Overzetten (UIT).** `overzetPlan` / `overzetToepassen` / `overzetTerug` / `overzetEcht` in `wh/pd2-reken.js`: alles wat
Daan bevestigde of aanpaste gaat naar productdata met meta-bron `pd2`; Daans eigen invoer wordt nooit zonder keuze
overschreven (verschil tonen, per regel "neem 2.0"); vooraf een kopie in catalog-rij `wh-pd2-kopie-<tijd>`; terugdraaien met
die kopie. Vlag `pd2Overzetten = false`: knop verborgen, `overzetEcht` weigert. Alleen getest tegen een kopie van de data.

**7. Weeglijst voor de vloer.** Per hal, gang en locatie, per locatie "x van y klaar". Reachtruck-regel bovenaan en per
product: Pallet of Deel met stuks per pallet = volle pallet met de reachtruck (veld palletgewicht: (pallet − 15) / stuks per
pallet), de rest los op de weegschaal. Knop "Print weeglijst (A4)": tabel per hal en gang met vakjes voor kg.

## Correctie ronde 2b (27-10-2026): alle bronnen, controle vóór tonen
Aanleiding: bij Whiteboard Magnetisch (Ningbo Henri) stelde 2.0 200 per pallet voor (= inkoop van meerdere pallets), hoogtes
van 340–1.620 cm, een palletgewicht van 2.415 kg, max op pick 203, een vloernaam met alleen de code en geen palletmaat.

**Bronnen per product, in deze volgorde** (de bron staat onder ⓘ bij elk voorstel):
a. Daans eigen invoer in productdata → "vastgelegd". b. Palletlabel-generator (catalog-ean): stuks per pallet (qty, alleen een
echt getal) en de labelnaam; verschillende labelregels = twijfel met de opties. c. Verplaatsingen: aantal naar VST en van
bulk naar pick bij volle pallets. d. ≥ 2 VST- of bulkpallets met hetzelfde aantal. e. Pakbonnen/containers: per pallet, m³
(hoogte), palletmaat. f. Kleurgenoot (zelfde familie en maat) met een waarde uit a–e. g. Inkoop: alleen bewijs voor de soort,
nooit stuks per pallet. Daarna Daans patronen bij dezelfde leverancier en maat (of familie). Nooit een aantal van een andere
leverancier; een regel als "50 per krat" bestaat niet in de code.
Palletmaat komt altijd uit de maatregels als er geen bron is (whiteboards: kleinste opslagmaat waar het bord in past, grote
borden met ruimte in de lengte; ringmatten plat op hun maat; ringmat op rol 100x150; bureaustoelen 80x120; tegels CE
110x110; al het andere 80x120, met twijfel als de productmaat uit de naam nergens op past). Hoogte: kleurgenoot, pakbon (m³),
Daans patroon, de maatregel, anders lagen op de palletmaat uit de afmetingen per stuk (elke richting, 7 cm overstek), nooit
stuks × dikte.

**Controle vóór tonen** (alleen voorstellen; jouw invoer en vastgelegde waarden niet): hoogte 30–250 cm, anders rood
"uitzoeken" met de reden (het afgewezen voorstel staat erbij); stuks per pallet moet fysiek passen (Picqer-afmetingen op de
palletmaat tot 250 cm, > 15% erboven = twijfel) en het palletgewicht mag niet boven 1.500 kg komen (twijfel); gewicht volle
pallet boven 1.500 kg = "uitzoeken", boven 1.000 kg = oranje "controleer"; max op pick meer dan 3 maanden verkoop of zonder
verkoop = oranje "controleer". Geen bron = leeg, rood, "uitzoeken" met de reden.

**Vloernaam**: productcode (tot 14 tekens) + " - " + korte omschrijving met de onderscheidende kenmerken (merk/lijn, kleur,
maat zonder "cm", dikte bij lopers en matten), bijv. "4560WM - Whiteboard magnetisch 45x60". Een palletlabel-naam gaat voor,
tenzij die alleen de code is.

**Meting tegen Daans eigen invoer** (bron a weggelaten; het palletlabel van hetzelfde product ook, omdat dat vaak de bron van
Daans waarde was):

| Veld | Ronde 1 | Ronde 2 | Nu | Klopt als er een voorstel is |
|---|---|---|---|---|
| Soort | 40% | 72% | 72% | 72% |
| Stuks per pallet | 50% | 61% | 65% | 83% |
| Palletmaat | 53% | 68% | 86% | 86% |
| Hoogte incl. pallet | 50% | 65% | 62% | 64% |
| Aanvullen bij | 30% | 61% | 59% | 83% |
| Max op pick | 38% | 63% | 63% | 74% |
| Vloernaam | 22% | 60% | 1% | 1% |
| Gewicht per stuk | 44% | 75% | 75% | 75% |
| Gewicht volle pallet | 58% | 65% | 80% | 82% |

Stuks per pallet heeft nu minder vaak een voorstel (geen inkoop meer), maar als er een is klopt het in 83% (was 69%).
Vloernaam: Daans oude vloernamen zijn vaak alleen de code; de nieuwe vorm is zijn eigen regel, de score zegt daar niets.

**Zelfcontrole** (alle producten in de Belangrijk-families, zonder Weg): 1049 producten in 274 families.
- Stuks per pallet: leeg 484, voorstel 392, twijfel 94, vastgelegd 37. Bron: label 386, genoot 72, leer-levmaat 14, pallets 11, pakbon 2, verplaatst 1.
- Palletmaat: voorstel 905, vastgelegd 80, twijfel 12, leeg 10. Hoogte: twijfel 714, voorstel 163, leeg 70, vastgelegd 55, uitzoeken 5 (de twijfel komt vooral van de maatregel-hoogtes, die bij jouw invoer 43% klopten).
- Aanvullen bij: voorstel 555, leeg 289, vastgelegd 163. Max op pick: voorstel 395, leeg 344, vastgelegd 137, twijfel 131. Vloernaam: voorstel 910, vastgelegd 86, leeg 10, twijfel 1.
- Gewicht volle pallet: leeg 520, ok 452, controleer 31, uitzoeken 4. Max op pick (pallet, berekend): leeg 634, ok 227, controleer 146.
Regel voor regel bekeken: Whiteboard Magnetisch (Ningbo), FWB (Hebei), Schoonloopmat Mars, Trapmaantje Spurt, Kokos, ringmat
(op rol en met maat), bureaustoelen, rubber tegels CE.

## Ronde 3 (27-10-2026): herbouw scherm, rust zoals Per familie
Vervangt de opbouw uit B, C, E en het oefenblok uit H; data, voorstellen, berekeningen en opslag (wh-pd2-*) zijn gelijk
gebleven. Eén ding tegelijk: start = families, familie = maten, maat = productkaarten.
- **Start**: titel, "x van y families klaar", knop "Volgende familie →", zoekveld + knop "Filter" (scope, leverancier,
  afdeling, hal, ABC ingeklapt), familierijen (naam · leverancier · producten · maten, rechts "n open" = open velden),
  belangrijkste eerst. Onderaan klein: Weeglijst (n) · Aannames (n) · Oefenmodus ⋯ (oefenen, hoe goed zijn de
  voorstellen, opmerking, kopieer alles voor Claude, oefendata wissen).
- **Familie**: kop (naam, leverancier · producten · maten; verkoop "13*6 / 8*28" · ABC · inkomend; Volgende familie),
  voortgangsbalk met één regel, hooguit 3 aandachtspunten als tekstlink (tik = alleen die kaarten, uit alle maten),
  grijs "voorraad live · hh:mm" (rood als hij níet live is), maattegels zoals Per familie ("30x45 · 1 kleur · 6 open";
  rollen: breedte · dikte), daaronder de gekozen maat: Alle voorstellen in deze maat kloppen · Volgende maat →,
  ingeklapt "uitleg per soort" en "Gewicht voor de hele maat", segmentkeuze Open · Pallet · Deel · Pick · Mix · Weg (met
  aantallen, standaard Open), de kaarten, en ingeklapt "Afgerond (n)".
- **Kaart**: vinkje, naam, code, ABC, rechtsboven ⓘ en 💬; drie grijze regels Voorraad · Inkoop · Verkoop; Gewicht (kg typen
  = gewogen, knopjes gewogen / vertrouwd / te wegen); "Hoe komt dit binnen?" met blauw voorstelvak + Klopt, of een grijze
  hint met knop als de data iets anders zegt; daaronder alleen de velden van die soort (ontwerp D) in een raster van max 4
  per rij (telefoon: onder elkaar), elk met blauw voorstelvak + Klopt en de reden; berekende velden grijs; rood alleen bij
  ontbreekt of kan niet. Rol: "Is dit een rol? ja / nee", bij ja een inklapbaar blok Rolgegevens. Weg: knoppen
  Uitlopend / Backorder / Archief. Onderaan "Alle voorstellen van dit product kloppen (n)". Afgerond = één regel met ✓
  onder "Afgerond (n)" (heropenen, of bij Weg terugzetten). Palletmaat heeft "anders…" om zelf een maat te typen
  (opmerking van Daan bij het oefenen).
- **Groepsacties**: alleen als er iets is aangevinkt, één balk onderaan: Selectie klopt · Zijn allemaal… · Gewicht… (kloppen /
  aanpassen…) · Is rol · Zelfde waarde… · ×. Ongedaan (10 s) blijft.
- **Oefenen**: standaard uit; aan via Oefenmodus ⋯ → Oefenen. Eén kaartje rechtsonder: "Opdracht 1 van 4: …" met Toon en
  Volgende, keuze van de soort; na de laatste opdracht de vier vragen. Feedback-sleutels per soort zijn gelijk gebleven.
- **Weg**: tabbalk, tabellen, chips (aanname, twijfel, rol, SAM, bron), oefenbalk, basisblok, Doel-regel, aandacht-chips en
  oranje/gele celvlakken. Aannames staan alleen nog in de lijst "Aannames (n)" met klopt / keur af.
- **Getest**: oefentest via de echte kaarten (86 checks), ronde-2-test, live/429, schermafdrukken op 390 en 1440 px
  (start, familie Whiteboard Magnetisch, maat 30x45, Mars 40x60, rol, Weg, groepsbalk): geen horizontale scroll, geen
  gestippelde randen, geen oranje vlakken, geen tabellen of chips, startscherm 4 blokken boven de vouw; regressie oude
  pagina's gelijk; database-hashes van productdata, wh-pd-fam en catalog-ean ongewijzigd.

## Ronde 4 (27-10-2026): familiescherm vol scherm en compact
Startscherm ongewijzigd. Vervangt de familie- en kaartopbouw uit ronde 3.
- **Volle breedte**: het familiescherm gebruikt de hele breedte van het 3.0-venster (marges 18 px). Desktop (≥ 1100 px): twee
  kolommen. Links (280 px, blijft staan bij scrollen): familiekop (naam, leverancier, verkoop, ABC, inkomend), voortgang, max 3
  aandachtspunten, "voorraad live · tijd", de maten als verticale lijst ("45x60 · 6 open") en Volgende maat / Volgende familie.
  Rechts de kaarten. Telefoon/tablet: onder elkaar, maten als tegels; Volgende maat staat ook onderaan de kaarten.
- **Maten alleen als het iets toevoegt**: heeft elke maat maar 1 product (bijv. Whiteboard Magnetisch), dan geen maatstap: alle
  producten als kaarten onder elkaar, op maat gesorteerd; de maatlijst is dan een inhoudsopgave (tik = naar die kaart).
- **Compacte kaart** (± 190 px op 1920, ± 260 px op 1440: 3 kaarten in beeld op 1440, 5 op 1920): bovenste regel vinkje · naam ·
  code · ABC, rechts (Is dit een rol? ja/nee) · Alles klopt (n) · ⓘ · 💬. Voorraad · Inkoop · Verkoop (verkoop als "13*6 / 8*28")
  naast elkaar. "Hoe komt dit binnen?" en Gewicht op één regel. Velden van de soort op één rij over de volle breedte (zoveel als
  passen, dan de volgende rij); per veld label, vak en direct eronder één korte regel "voorstel 3 · Klopt" (op smalle velden
  alleen "3 · Klopt"); de reden bij hover of ⓘ. Berekende velden als één grijze regel eronder.
- **Picklocatie**: "AD01B04 · 12 · vast" als tekst met daarnaast de keuze (klopt / moet anders / geen pick). Keuzelijsten staan
  standaard op het voorstel (blauwe tekst); pas Klopt of een andere keuze slaat iets op.
- **Max op pick bij Deel**: wat op de picklocatie past, nooit "bij + stuks per pallet": huidige Picqer-instelling, anders de
  grootste aanvulling van bulk naar pick in de verplaatsingen, anders kleurgenoot; anders leeg (uitzoeken).
- **Uitlopend**: nog voorraad en geen inkoop in 12 maanden, ook als het nog verkoopt (niet als het binnenkomt).
- **Oefenantwoorden** (oefenkaartje aan) krijgen een oefen-merk en tellen niet mee voor kleurgenoten, leren, de telling in
  "Kopieer alles voor Claude" en het overzetten. Score en leren gebruiken alleen productdata.
- **Getest**: oefentest 86, ronde 2 17, ronde 4 10 checks; live/429; schermafdrukken familiescherm op 1440, 1920 en 390 px voor
  Whiteboard Magnetisch, Schoonloopmat Mars en Kokos op rol (inhoud 97–98% van de breedte, geen horizontale scroll, 3 kaarten
  in beeld op 1440); regressie oude pagina's gelijk; hashes van productdata, wh-pd-fam en catalog-ean ongewijzigd.

## Aannames (ronde 1 t/m 4)
Staan in één lijst "Aannames (n)" (link onderaan het startscherm), met klopt / keur af en een opmerking; het oordeel komt mee
in "Kopieer alles voor Claude". Bron in de code: `AANNAMES` bovenin `wh/pd2-reken.js` (samen bijwerken).
- `zoek`: Zoeken kijkt in alle actieve producten, ook buiten de gekozen scope (anders vind je bijv. Waterhog zonder voorraad niet).
- `soortkol`: Elke productkaart heeft "Hoe komt dit binnen?": daar zet je een product op een andere soort; de soortkeuze boven de kaarten (Open · Pallet · …) filtert alleen.
- `selgew`: "Selectie klopt", "Alle voorstellen … kloppen" laten het gewicht staan: gewicht keur je apart goed (knopjes bij Gewicht, of Gewicht… → kloppen).
- `blijf`: Een product dat compleet wordt (alle velden van zijn soort en het gewicht), klapt meteen in tot één regel en staat dan onder "Afgerond (n)" onderaan de maat. Weg-producten zet je daar terug met "terugzetten".
- `geenpick`: Bij picklocatie "geen pick" (alleen bulk, per order verplaatsen) zijn Aanvullen bij en Max op pick niet nodig.
- `uitl`: Uitlopend wordt voorgesteld als er nog voorraad is en geen inkoop in 12 maanden, ook als het nog verkoopt (verkoop is geen voorwaarde). Komt het binnen (open pakbon/container), dan niet.
- `backord`: Backorder wordt voorgesteld bij geen voorraad en wel inkoop, backorders of verkoop in de laatste 12 maanden.
- `mix`: Mix wordt voorgesteld als alle bulkplekken van het product ook voorraad van andere producten hebben (gedeelde plek of mixpallet), er geen pallet-aantal bekend is en er geen volle pallet wordt ingekocht. Gedeelde plek mét pallet-aantal, of eigen én gedeelde plekken = twijfel Deel/Mix. Let op: een 20-locatie kan meerdere pallets van verschillende producten hebben.
- `pallet85`: Pallet: meest voorkomende inkoop ≥ 85% van stuks per pallet én de verplaatsingen laten zien dat de hele bulkvoorraad in één keer naar pick gaat. Alleen per volle pallet verplaatst = twijfel Pallet/Deel; alleen een volle pallet ingekocht maar in delen verplaatst = Deel.
- `score`: Een voorstel waarvan de regel bij jouw eigen invoer minder dan 60% klopte (minstens 5 keer getoetst), staat als twijfel: in het blauwe vak staat "twijfel" en hoe vaak hij klopte.
- `leer`: Leren van jouw invoer: een waarde telt als patroon als minstens 2 producten (kleurgenoot: 1) in die groep hem hebben en hij ≥ 60% van die groep is. Groepen: kleurgenoten, familie, leverancier + maat, leverancier.
- `reach`: Weeglijst: hoe wegen volgt uit de soort. Pallet of Deel met stuks per pallet = volle pallet met de reachtruck (palletgewicht − 15 kg, gedeeld door stuks per pallet); de rest los op de weegschaal.
- `ligger`: Palletgewicht boven ligger-limiet: een pallet van meer dan 2.000 kg, of zo zwaar dat door het gewicht minder pallets op een ligger passen dan door de plaatsen (3 plaatsen per ligger).
- `wegalle`: Weg-voorstel voor alle producten: dezelfde regels als in tab 5. Heeft Daan in de familie al een soort gekozen, dan telt "geen voorraad" als tijdelijk op en komt er geen Weg-voorstel.
- `snap`: Snel openen: 2.0 bewaart na het laden een kopie op dit apparaat (IndexedDB, max 7 dagen oud) en tekent daar eerst mee ("gegevens van hh:mm, bijwerken…"); daarna ververst het op de achtergrond. Typ je net, dan wacht het verversen tot je klaar bent.
- `overzet`: Overzetten naar de echte productdata is gebouwd maar staat uit (pd2Overzetten = false, knop verborgen). Overgezet wordt alleen wat jij bevestigde of aanpaste; Uitlopend gaat als datum mee, Backorder en Archief hebben nog geen veld in productdata.
- `bronnen`: Stuks per pallet alleen uit palletlabel, verplaatsingen, ≥ 2 gelijke pallets, pakbon of kleurgenoot (daarna Daans patroon bij dezelfde leverancier en maat). Nooit uit inkoop en nooit van een andere leverancier. Zonder bron: leeg, "uitzoeken".
- `fysiek`: Past fysiek: de Picqer-afmetingen per stuk in alle richtingen op de palletmaat, 7 cm overstek, tot 250 cm hoog incl. 15 cm pallet. Meer dan 15% boven wat past = twijfel. Kloppen de afmetingen in Picqer niet (bijv. doosdikte), dan zie je dat hier.
- `labelqty`: Een palletlabel met een aantal dat geen getal is (bijv. "6090WM") telt niet als stuks per pallet.
- `grootwb`: Grote whiteboards (200 cm en langer) krijgen een palletmaat met ruimte in de lengte (120x200 → 120x210, 120x240 → 130x250), zoals in jouw eigen invoer.
- `ringmat`: Ringmatten met een maat in de naam liggen plat op de kleinste opslagmaat waar ze op passen (100x100, 80x120, 100x200); ringmat op rol → 100x150.
- `lvlnaam`: Bureaustoelen bij 0 en whiteboards bij 3 gelden ook voor producten zonder picklocatie (de aanvulregel zelf geldt alleen met picklocatie).
- `vnregel`: Vloernaam = code + " - " + korte omschrijving (code langer dan 14 tekens: alleen de omschrijving). Je oude vloernamen waren vaak alleen de code, dus de gemeten score (1%) zegt hier niets en maakt geen twijfel.
- `maxverk`: Max op pick: "controleer" (grijze melding onder Max op pick) als het meer is dan 3 maanden verkoop, gemeten als het hoogste van 6-maanden- en 28-dagengemiddelde per maand; zonder verkoop ook "controleer".
- `tegen`: Per pallet meer dan ooit besteld: stuks per pallet groter dan de grootste inkooporder van 12 maanden, of twee bronnen noemen een ander aantal.
- `vk28`: Verkoop over 28 dagen = Picqer-analyse "stuks per dag" × 30 (zoals in Per familie).
- `gewafw`: Gewicht "sterk anders": meer dan 30% afwijking van het midden (mediaan) van de familie, per m² als de maat in de naam staat, anders per stuk binnen dezelfde maat.
- `maxlig`: Max per ligger: 3 plaatsen per ligger (bestaande regel van Daan) en 2.000 kg per ligger; de kleinste van de twee telt.
- `hoogte`: Hoogte-waarschuwing kijkt naar de bulklocaties van het product: niveau 00 → max 200 cm, niveau 10 → max 190 cm, niveau 20 in hal A → ± 140 cm. Hal = eerste letter, niveau = laatste twee cijfers van de locatie.
- `maat`: Een palletmaat die al vastligt of wordt voorgesteld maar niet in de nieuwe keuzelijst staat (bijv. 90x150), staat bovenaan de keuzelijst erbij.
- `koppel`: Koppelproduct = code met BOL- ervoor of -BOL / -set erachter waarvan het hoofdproduct bestaat (staat bij de familie van het hoofdproduct), of een samengesteld product dat in Picqer virtueel is (sets, pakketten). Niet invullen, niet in de tabs, telt niet als open.
- `vastpd`: Vastgelegd in productdata = ingevuld door Daan (invoer, familie, samen, kleurgenoot, spraak, aanvulregel). Schattingen van Claude en automatische waarden tellen als voorstel.
- `wissen`: "Oefendata wissen" wist alleen wh-pd2-oefen; je feedback en opmerkingen (wh-pd2-feedback) blijven staan.
- `famtop`: Families staan op belang: 3 per A-product + 2 per B-product + 2 per inkomend product + 1 per aandachtspunt. Eerst 30, "Meer families" toont de rest. "Volgende familie" = de belangrijkste die nog niet klaar is. "n open" = aantal open velden (zoals Per familie).
- `live`: Voorraad per locatie: live uit Picqer (de rijen die op het scherm staan, 20 per vraag, 3 s ertussen; ook de pickstand van het live advies telt als live). Live geldt 30 minuten en wordt na 10 minuten ververst. Wacht als de live-ronde van 3.0 bezig is of Picqer net "te veel" zei; bij een fout 2, 4, 8 … max 30 min pauze. Niet gekoppeld of nog niet opgehaald: de export, met de datum erbij.
- `wandrek`: Wandrekken: aanvullen bij 2 (met hele omdozen) geldt voor producten met "wandrek" in de naam.
- `vn`: Vloernaam: een naam op het palletlabel gaat voor, tenzij die alleen de code is (of bijna). Verschillen de labels, dan twijfel met de opties.
- `rolkand`: Rol (vraag "Is dit een rol? ja / nee" op de kaart) alleen bij Picqer-eenheid meter, cm of rol, of als de naam "op rol", "rol van", "per rol", "volle rol", "rollen", "per meter" of "per cm" zegt, of "rol" samen met een breedte of dikte (niet bij rolstoel, roller, rolluik). Het telt als open tot je kiest.
- `famheel`: In een familie zie je altijd alle actieve producten van die familie (zoals Per familie), ook als de scope of de filters op het startscherm een deel ervan weglaten. Koppelproducten staan alleen als aantal in de kop.
- `maatauto`: Bij het openen van een familie staat de eerste maat met iets open gekozen, en de soortkeuze op "Open" (alles wat nog niet af is). Rollen hebben geen eigen tab meer: rolgegevens staan op de kaart.
- `invoer`: Een voorstel staat als korte regel "voorstel 3 · Klopt" onder het vak (reden bij hover of ⓘ). Invulvakken blijven leeg (voorstel grijs als hint); keuzelijsten staan op het voorstel in blauwe tekst. Opgeslagen wordt pas bij Klopt, typen, een andere keuze of Enter in een leeg vak. Groen = door jou bevestigd of vastgelegd.
- `aand3`: Bovenaan een familie staan hooguit de 3 aandachtspunten die het vaakst voorkomen; tikken toont alleen die producten (uit alle maten).
- `gewknop`: Gewicht: getal typen = gewogen. "vertrouwd" = het Picqer-gewicht klopt. "gewogen" zonder getal vraagt eerst het gewicht. Nog een keer op de gekozen knop = terug naar niet gecontroleerd.
- `plat`: Heeft elke maat in de familie maar 1 product, dan is er geen maatstap: alle kaarten onder elkaar op maat, de maten zijn een inhoudsopgave.
- `maxdeel`: Max op pick bij Deel: Picqer-instelling, anders de grootste aanvulling van bulk naar pick in de verplaatsingen (één verplaatsing), anders kleurgenoot; geen aanvulregel of leren (die gaven bij + pallet).
- `oefentel`: Wat je invult terwijl het oefenkaartje aan staat, krijgt een oefen-merk: het geldt voor dat product, maar telt niet mee voor kleurgenoten, leren, de telling in "Kopieer alles voor Claude" en het overzetten. Alleen invoer met oefenen uit telt.
- `oefen`: Oefenen staat standaard uit (Oefenmodus ⋯ → Oefenen); dan één kaartje rechtsonder met de opdrachten per soort en na de laatste de vier vragen. Je bewerkt de oefenkopie ook als oefenen uit staat.
- `rolregel`: Rolregels ronde 2: kokos rol = 600 cm lang (6 m); kokos 200 cm 17 mm = 12 rollen per pallet, 24 mm = 6 (vaste aantallen); voor 100 cm kokos geen aantal bekend. Ringmat op rol heavy duty: staand, 6 per pallet, palletmaat 100x150. Gewicht volle rol = gewicht per meter of cm × lengte.
