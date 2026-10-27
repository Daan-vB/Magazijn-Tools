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

## Aannames ronde 1
Staan ook als chip "aanname" in de pagina (en onderaan de pagina in één lijst). Daan keurt ze goed of af in de oefening;
het oordeel komt mee in "Kopieer alles voor Claude". Bron in de code: `AANNAMES` bovenin `wh/pd2-reken.js` (samen bijwerken).
- `zoek`: Zoeken kijkt in alle actieve producten, ook buiten de gekozen scope (anders vind je bijv. Waterhog zonder voorraad niet).
- `soortkol`: Elke soort-tab heeft een kolom Soort, zodat je per rij een product naar een andere tab kunt zetten.
- `selgew`: "Selectie klopt" en "Alle voorstellen kloppen" laten het gewicht staan: gewicht keur je apart goed (Gewichten kloppen of de chip).
- `blijf`: Een product dat compleet wordt terwijl je typt, blijft zichtbaar (met ✓) tot je van tab of groep wisselt; bij "Selectie klopt" verdwijnt het meteen.
- `geenpick`: Bij picklocatie "geen pick" (alleen bulk, per order verplaatsen) zijn Aanvullen bij en Max op pick niet nodig.
- `uitl`: Uitlopend wordt alleen voorgesteld als er nog voorraad is, geen inkoop in 12 maanden én geen verkoop meer (of "uitlopend" in de naam). Verkoopt het nog, dan blijft de gewone soort staan.
- `backord`: Backorder wordt voorgesteld bij geen voorraad en wel inkoop, backorders of verkoop in de laatste 12 maanden.
- `mix`: Mix wordt voorgesteld als alle bulkplekken van het product ook voorraad van andere producten hebben (gedeelde plek of mixpallet), er geen pallet-aantal bekend is en er geen volle pallet wordt ingekocht. Gedeelde plek mét pallet-aantal, of eigen én gedeelde plekken = twijfel Deel/Mix. Let op: een 20-locatie kan meerdere pallets van verschillende producten hebben.
- `pallet85`: Pallet: meest voorkomende inkoop ≥ 85% van stuks per pallet én de verplaatsingen laten zien dat de hele bulkvoorraad in één keer naar pick gaat. Alleen per volle pallet verplaatst = twijfel Pallet/Deel; alleen een volle pallet ingekocht maar in delen verplaatst = Deel.
- `tegen`: Tegenstrijdig stuks per pallet: de grootste inkooporder is kleiner dan de helft van een pallet, of twee bronnen noemen een ander aantal.
- `vk28`: Verkoop over 28 dagen = Picqer-analyse "stuks per dag" × 30 (zoals in Per familie).
- `gewafw`: Gewicht "sterk anders": meer dan 30% afwijking van het midden (mediaan) van de familie, per m² als de maat in de naam staat, anders per stuk binnen dezelfde maat.
- `maxlig`: Max per ligger: 3 plaatsen per ligger (bestaande regel van Daan) en 2.000 kg per ligger; de kleinste van de twee telt.
- `hoogte`: Hoogte-waarschuwing kijkt naar de bulklocaties van het product: niveau 00 → max 200 cm, niveau 10 → max 190 cm, niveau 20 in hal A → ± 140 cm. Hal = eerste letter, niveau = laatste twee cijfers van de locatie.
- `maat`: Een palletmaat die al vastligt maar niet in de nieuwe keuzelijst staat (bijv. 90x150) blijft zichtbaar als extra keuze, oranje.
- `koppel`: Koppelproduct = code met BOL- ervoor of -BOL / -set erachter waarvan het hoofdproduct bestaat (staat bij de familie van het hoofdproduct), of een samengesteld product dat in Picqer virtueel is (sets, pakketten). Niet invullen, niet in de tabs, telt niet als open.
- `vastpd`: Vastgelegd in productdata = ingevuld door Daan (invoer, familie, samen, kleurgenoot, spraak, aanvulregel). Schattingen van Claude en automatische waarden tellen als voorstel.
- `kaart`: Productkaart kent nog geen directe link per product: de link opent Productkaart in een nieuw tabblad en zet de code op het klembord om te plakken.
- `wissen`: "Oefendata wissen" wist alleen wh-pd2-oefen; je feedback en opmerkingen (wh-pd2-feedback) blijven staan.
- `famtop`: Zonder familiekeuze staan de 24 belangrijkste families als tegel (meeste A/B-producten en inkomend eerst); "Meer" toont de rest.
- `live`: Voorraad per locatie: live uit Picqer (de rijen die op het scherm staan, 20 per vraag, 3 s ertussen; ook de pickstand van het live advies telt als live). Live geldt 30 minuten en wordt na 10 minuten ververst. Wacht als de live-ronde van 3.0 bezig is of Picqer net "te veel" zei; bij een fout 2, 4, 8 … max 30 min pauze. Niet gekoppeld of nog niet opgehaald: de export, met de datum erbij.
- `wandrek`: Wandrekken: aanvullen bij 2 (met hele omdozen) geldt voor producten met "wandrek" in de naam.
- `vn`: Vloernaam: code korter dan 7 tekens → code + korte omschrijving in kleine letters; anders de korte omschrijving uit de Picqer-naam (zonder leverancier, prijzen en "per cm/meter").
- `rolkand`: Rol? verschijnt bij Picqer-eenheid meter/cm/rol of "rol"/"rollen" in de naam.
